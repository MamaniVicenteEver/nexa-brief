#!/usr/bin/env python3
"""song.mp3 → lyrics.json (formato Whisper con tiempos por palabra) usando el guion como guía.

  · faster-whisper large-v3 con word_timestamps y el guion como `initial_prompt`
    (así acierta nombres propios: Turing, Bletchley Park, Hamilton…);
  · después alinea palabra por palabra con el guion (difflib) y, donde Whisper
    escribió distinto una palabra que el guion tiene (tildes, nombres), usa la del
    guion conservando los tiempos de Whisper. Los números quedan en cifras
    (1940, 1202), que se leen mejor en subtítulos.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/explainer-kit/tools/transcribe.py AUDIO.mp3 SCRIPT.json OUT_lyrics.json
"""
import difflib, json, pathlib, re, sys, unicodedata

def norm(w):
    w = unicodedata.normalize("NFD", w.lower()); w = "".join(c for c in w if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-zñ0-9]", "", w)

def main(audio, script_path, out):
    from faster_whisper import WhisperModel
    script = json.loads(pathlib.Path(script_path).read_text())
    ref_txt = " ".join(s["text"] for s in script["segments"])
    names = ", ".join(sorted(set(re.findall(r"\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+(?:\s[A-Z][a-z]+)*", ref_txt))))[:400]
    m = WhisperModel("large-v3", device="cpu", compute_type="int8")
    # condition_on_previous_text=False + VAD: con True, Whisper entró en bucle e inventó frases
    # ("un millón de pulgadas", "el código de la vida"…) que la voz nunca dijo
    segs, info = m.transcribe(audio, language="es", word_timestamps=True, beam_size=5, vad_filter=True,
                              initial_prompt=f"Documental narrado en español. Nombres: {names}.", condition_on_previous_text=False)
    segments, dropped = [], 0
    for s in segs:
        ws = [w for w in (s.words or [])]
        # huella de alucinación: palabras de duración ~0 (en racha); se descartan
        keep = [w for i, w in enumerate(ws) if not ((w.end - w.start) < 0.03 and any((x.end - x.start) < 0.03 for x in ws[max(0, i - 1):i + 2] if x is not w))]
        # palabra repetida pegada a sí misma y ultracorta ("llegó[1,0 s] Llegó[0,14 s]"): eco de Whisper
        keep = [w for i, w in enumerate(keep) if not (i and norm(w.word) == norm(keep[i - 1].word) and (w.end - w.start) < 0.25)]
        dropped += len(ws) - len(keep)
        if not keep: continue
        segments.append({"start": round(keep[0].start, 3), "end": round(keep[-1].end, 3), "text": "".join(w.word for w in keep),
                         "words": [{"word": w.word, "start": round(w.start, 3), "end": round(w.end, 3), "probability": round(w.probability, 3)} for w in keep]})
    fixed, extra = clean_with_script(segments, ref_txt)
    doc = {"metadata": {"source": pathlib.Path(audio).name, "model": "faster-whisper large-v3", "language": "es",
                        "duration": round(info.duration, 3), "script_fixes": fixed, "dropped_zero_len": dropped, "dropped_not_in_script": extra}, "segments": segments}
    pathlib.Path(out).write_text(json.dumps(doc, ensure_ascii=False, indent=1))
    n = sum(len(s["words"]) for s in segments)
    print(f"✓ {out}: {len(segments)} segmentos, {n} palabras, {info.duration:.1f} s, {fixed} correcciones del guion, {dropped} palabras-fantasma, {extra} palabras fuera del guion descartadas")

def clean_with_script(segments, ref_txt):
    """El guion es la verdad de lo que la voz debía decir. Alineando palabra por palabra:
    · donde Whisper escribió distinto una palabra del guion (tildes, nombres) → se usa la del guion;
    · palabras que Whisper agregó y NO están en el guion ("sus sus", "un un", "segundo.") → se descartan
      (salvo cifras: Whisper escribe "1989" donde el guion dice "mil novecientos ochenta y nueve")."""
    hyp = [w for s in segments for w in s["words"]]
    ref = re.findall(r"[\wÁÉÍÓÚáéíóúÑñü¿¡?!.,:;«»-]+", ref_txt)
    sm = difflib.SequenceMatcher(a=[norm(w) for w in ref], b=[norm(w["word"]) for w in hyp], autojunk=False)
    fixed, drop = 0, set()
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op == "equal":                       # misma palabra: queda con la grafía exacta del guion
            for ra, hb in zip(range(a0, a1), range(b0, b1)):
                if hyp[hb]["word"].strip() != ref[ra]: hyp[hb]["word"] = " " + ref[ra]
        elif op == "replace" and (a1 - a0) == (b1 - b0):
            for ra, hb in zip(range(a0, a1), range(b0, b1)):
                if re.search(r"\d", hyp[hb]["word"]): continue          # cifras: se quedan
                hyp[hb]["word"] = " " + ref[ra]; fixed += 1
        elif op == "replace" and not any(re.search(r"\d", hyp[hb]["word"]) for hb in range(b0, b1)) and max(a1 - a0, b1 - b0) <= 4:
            # distinta cantidad de palabras ("Bonn -Hommer -Strasse" ↔ "Bornholmer Strasse"): las palabras del
            # guion se reparten sobre el tramo de Whisper conservando su inicio y su fin
            hs, rs = hyp[b0:b1], ref[a0:a1]
            for k, hb in enumerate(hs):
                if k < len(rs): hb["word"] = " " + (" ".join(rs[k:]) if k == len(hs) - 1 else rs[k]); fixed += 1
                else: drop.add(id(hb))
            if len(hs) > len(rs): hs[len(rs) - 1]["end"] = hs[-1]["end"]
        elif op == "insert":
            for hb in range(b0, b1):
                if not re.search(r"\d", hyp[hb]["word"]): drop.add(id(hyp[hb]))
    for s in segments:
        s["words"] = [w for w in s["words"] if id(w) not in drop]
        s["text"] = "".join(w["word"] for w in s["words"])
    segments[:] = [s for s in segments if s["words"]]
    return fixed, len(drop)

if __name__ == "__main__":
    if sys.argv[1] == "--clean":          # solo limpiar un lyrics.json existente contra el guion
        sc = json.loads(pathlib.Path(sys.argv[3]).read_text()); doc = json.loads(pathlib.Path(sys.argv[2]).read_text())
        f, e = clean_with_script(doc["segments"], " ".join(x["text"] for x in sc["segments"]))
        doc.setdefault("metadata", {}).update(script_fixes=f, dropped_not_in_script=e)
        pathlib.Path(sys.argv[2]).write_text(json.dumps(doc, ensure_ascii=False, indent=1)); print(f"✓ limpiado: {f} correcciones, {e} palabras fuera del guion")
    else:
        main(*sys.argv[1:4])

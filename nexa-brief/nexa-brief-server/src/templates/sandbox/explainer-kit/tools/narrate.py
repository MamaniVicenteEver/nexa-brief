#!/usr/bin/env python3
"""Narración completa de un guion (script.json) con Gemini TTS + control de calidad.

Estrategia (ver audio/ESTUDIO-VOZ.md):
  · UNA petición `interactions` por video (o pocas, con --parts) para que la voz
    sea la misma de punta a punta; cada segmento lleva su propio
    speech_metadata.style (tono + intensidad) → la emoción cambia frase a frase;
  · etiquetas de ritmo dentro del texto: <short pause> entre oraciones en los
    tonos lentos, <long pause> antes de los giros (silencio, duelo), <breath>
    antes de los clímax; nada de etiquetas en los tonos rápidos;
  · control: Whisper large-v3 transcribe el resultado y se compara contra el
    guion (palabras faltantes, repetidas, duración). Si falla, se regenera solo
    la parte rota (--only-part).
Salida: <out>.wav (24 kHz) + <out>.mp3 (192 kbps) + <out>.qc.json

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/sandbox/explainer-kit/tools/narrate.py SCRIPT.json OUT_SIN_EXTENSION \
      --voice Charon [--model gemini-3.8-flash-tts] [--parts 1] [--dry]
"""
from __future__ import annotations
import argparse, json, pathlib, re, subprocess, sys, unicodedata, wave
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import tts  # noqa: E402

BASE = ("Narrador de documental, voz humana madura y cercana, español latinoamericano neutro "
        "(sin ceceo ni acento de España). No imitar a ninguna persona real. Dicción clara, respiración natural.")
STYLE = {
    "intriga": "Empieza bajo y cercano, con intriga contenida, como quien cuenta un secreto. Ritmo moderado.",
    "suspenso": "Suspenso: voz contenida, casi susurrada al principio, frases cortas con aire entre ellas.",
    "explicativo": "Claro y cálido, ritmo medio, como un buen profesor que disfruta explicar.",
    "asombro": "Asombro tranquilo: baja un poco la velocidad en las cifras y dales peso.",
    "tensión": "Tensión controlada: voz firme, un poco más grave, sin dramatizar.",
    "tensión creciente": "La tensión sube frase a frase: cada repetición un poco más intensa.",
    "descubrimiento": "Curiosidad que se enciende: el tono sube levemente hacia la idea clave.",
    "complicidad": "Cómplice, como contando un truco ingenioso; leve sonrisa en la voz.",
    "aceleración": "Acelera un poco; las frases cortas finales marcadas y contundentes, como golpes.",
    "clímax": "Clímax: sube la intensidad de forma progresiva, energía firme y emocionada, sin gritar; pequeñas pausas dramáticas.",
    "peso": "Grave y lento: cada dato cae con peso. Una pausa breve antes de la frase final del segmento.",
    "silencio": "Baja a casi un susurro, lento, íntimo. Mucho espacio entre las frases.",
    "curiosidad": "Pensativo y curioso; la pregunta suena genuina, abierta, sin dramatizar.",
    "revelación": "Revelación: firme y luminoso, enfatiza la idea central con calma segura.",
    "dolor contenido": "Dolor contenido: voz baja, ritmo lento, sin quebrarse; los hechos dichos con sobriedad.",
    "duelo": "Duelo: muy bajo y lento, tristeza contenida, pausas largas antes de los datos finales. Natural, sin melodrama.",
    "reparación": "Mesurado, con un poco de esperanza que vuelve; cálido.",
    "cierre": "Cierre firme y cálido; la última frase lenta, con convicción, dejando eco.",
    "urgencia": "Urgente: más rápido pero claro, respiración tensa; la última palabra ('Go') corta y decidida.",
    "alivio": "Alivio: suelta el aire, voz emocionada y cálida, más lenta, sonrisa.",
    "reflexivo": "Reflexivo, sereno, ritmo medio-lento.",
    "cercano": "Cercano, como hablándole a una sola persona; cálido.",
    "admiración": "Con admiración y respeto; el nombre propio dicho con claridad y una mínima pausa antes.",
}
SLOW = {"intriga", "suspenso", "asombro", "peso", "silencio", "dolor contenido", "duelo", "cierre", "reflexivo", "alivio"}
BEFORE_LONG = {"silencio", "dolor contenido", "duelo"}
BEFORE_BREATH = {"clímax", "urgencia", "tensión creciente"}

def mark(seg: dict, prev: dict | None) -> str:
    """inserta etiquetas de ritmo según el tono (y el del segmento anterior)."""
    t = seg["text"].strip()
    if seg["tone"] in SLOW:          # pausa corta entre oraciones
        t = re.sub(r"([.?!])\s+(?=[¿¡A-ZÁÉÍÓÚÑ])", r"\1 <short pause> ", t)
    if prev is not None and seg["tone"] in BEFORE_LONG: t = "<long pause> " + t
    elif seg["tone"] in BEFORE_BREATH: t = "<breath> " + t
    return t

def chunks(script: dict, base: str = None) -> list[dict]:
    base = base or BASE
    out, prev = [], None
    for s in script["segments"]:
        inten = s.get("intensity", 0.5)
        lvl = "muy baja" if inten < 0.3 else "baja" if inten < 0.5 else "media" if inten < 0.75 else "alta" if inten < 0.95 else "máxima"
        style = f"{base} {STYLE.get(s['tone'], 'Natural, documental.')} Intensidad {lvl}."
        if s.get("delivery_note"):
            style += f" {s['delivery_note']}"
        out.append({"id": s["id"], "text": mark(s, prev), "style": style})
        prev = s
    return out

def norm(s: str) -> list[str]:
    s = unicodedata.normalize("NFD", s.lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"<[^>]+>", " ", s)
    return re.findall(r"[a-zñ0-9]+", s)

_U = "cero uno dos tres cuatro cinco seis siete ocho nueve diez once doce trece catorce quince dieciseis diecisiete dieciocho diecinueve veinte veintiun veintidos veintitres veinticuatro veinticinco veintiseis veintisiete veintiocho veintinueve".split()
_D = {3: "treinta", 4: "cuarenta", 5: "cincuenta", 6: "sesenta", 7: "setenta", 8: "ochenta", 9: "noventa"}
_C = {1: "ciento", 2: "doscientos", 3: "trescientos", 4: "cuatrocientos", 5: "quinientos", 6: "seiscientos", 7: "setecientos", 8: "ochocientos", 9: "novecientos"}
def es_num(n: int) -> str:
    """número → palabras en español sin tildes (para comparar la transcripción de Whisper, que usa cifras)"""
    if n < 30: return _U[n]
    if n < 100: return _D[n // 10] + ("" if n % 10 == 0 else " y " + _U[n % 10])
    if n < 1000: return ("cien" if n == 100 else _C[n // 100]) + ("" if n % 100 == 0 or n == 100 else " " + es_num(n % 100))
    if n < 1_000_000:
        k, r = divmod(n, 1000); return ("mil" if k == 1 else es_num(k) + " mil") + ("" if r == 0 else " " + es_num(r))
    m, r = divmod(n, 1_000_000); return ("un millon" if m == 1 else es_num(m) + " millones") + ("" if r == 0 else " " + es_num(r))
def NUMW(w: str) -> str:
    return es_num(int(w)) if w.isdigit() and len(w) < 10 else w

def qc(script: dict, wav: pathlib.Path, files=None) -> dict:
    """transcribe con faster-whisper y compara con el guion (alineación por diferencias)."""
    import difflib
    from faster_whisper import WhisperModel
    m = WhisperModel("large-v3", device="cpu", compute_type="int8")
    # por partes y sin condicionar al texto anterior: en audios largos Whisper a veces "repite"
    # frases que el TTS dijo una sola vez (falso positivo visto en producción)
    hyp_txt = ""
    for f in (files or [wav]):
        segs, info = m.transcribe(str(f), language="es", word_timestamps=False, vad_filter=True, beam_size=5, condition_on_previous_text=False)
        hyp_txt += " " + " ".join(s.text for s in segs)
    hyp = []
    for w in norm(hyp_txt): hyp += NUMW(w).split()
    ref = norm(" ".join(s["text"] for s in script["segments"]))
    sm = difflib.SequenceMatcher(a=ref, b=hyp, autojunk=False)
    missing, extra = [], []
    for op, a0, a1, b0, b1 in sm.get_opcodes():
        if op in ("delete", "replace"): missing.append(" ".join(ref[a0:a1]))
        if op in ("insert", "replace"): extra.append(" ".join(hyp[b0:b1]))
    with wave.open(str(wav)) as w: dur = w.getnframes() / w.getframerate()
    errs = sum(len(x.split()) for x in missing) + sum(len(x.split()) for x in extra)
    return {"dur_s": round(dur, 2), "words_ref": len(ref), "wer_aprox": round(errs / max(1, len(ref)), 3), "wpm": round(len(ref) / dur * 60),
            "faltan": missing[:30], "sobran": extra[:30], "transcripcion": hyp_txt.strip()}

def concat(parts: list[pathlib.Path], dest: pathlib.Path, gap=0.35):
    frames, rate = b"", 24000
    for i, p in enumerate(parts):
        with wave.open(str(p)) as w: rate = w.getframerate(); frames += w.readframes(w.getnframes())
        if i < len(parts) - 1: frames += b"\x00\x00" * int(rate * gap)
    tts._save_pcm(frames, dest, rate)

def load_design(d: str) -> dict:
    p = pathlib.Path(d)
    if not p.exists(): p = pathlib.Path(__file__).resolve().parents[1] / "designs" / d / "design.json"
    return json.loads(p.read_text())

def generate_group(script, grp, f, voice, model):
    """una parte con un modelo, rotando claves. 3.1 no tiene `interactions`: va por prompt de director."""
    def call(key):
        if "3.1" in model:
            segs = [dict(x, text=c["text"]) for x, c in zip([x for x in script["segments"] if x["id"] in {c["id"] for c in grp}], grp)]
            return tts.gemini_director(tts.director_prompt(script, segs), f, voice=voice, model=model, api_key=key)
        return tts.gemini_annotated([{"text": c["text"], "style": c["style"]} for c in grp], f, voice=voice, model=model, api_key=key)
    return tts.with_key_rotation(model, call)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("script"); ap.add_argument("out")
    ap.add_argument("--design", default="", help="id o ruta de design.json: voz, modelos, silencios y estilo base")
    ap.add_argument("--voice", default=""); ap.add_argument("--model", default="", help="forzar un modelo (si no, la cadena del diseño)")
    ap.add_argument("--parts", type=int, default=0, help="0 = automático (1 pedido; si el servidor falla, 3 partes)")
    ap.add_argument("--only-part", type=int, default=-1)
    ap.add_argument("--dry", action="store_true"); ap.add_argument("--no-qc", action="store_true")
    ap.add_argument("--lead", type=float, default=None); ap.add_argument("--tail", type=float, default=None)
    a = ap.parse_args()
    script = json.loads(pathlib.Path(a.script).read_text())
    D = load_design(a.design or script.get("design", "binary"))
    V = D.get("voice", {})
    voice = a.voice or script.get("voice") or V.get("voice", "Charon")
    models = [a.model] if a.model else V.get("models", ["gemini-3.8-flash-tts"])
    lead = a.lead if a.lead is not None else V.get("lead", 1.2); tail = a.tail if a.tail is not None else V.get("tail", 6.0)
    cs = chunks(script, V.get("base"))
    if a.dry:
        for c in cs: print(f"[{c['id']}] {c['style']}\n   {c['text']}\n")
        return
    out = pathlib.Path(a.out); out.parent.mkdir(parents=True, exist_ok=True)
    plans = [a.parts] if a.parts else [1, 3]
    prov, files, n = [], [], 1
    for n in plans:
        size = -(-len(cs) // n); groups = [cs[i:i + size] for i in range(0, len(cs), size)]
        files, prov, ok = [], [], True
        for k, grp in enumerate(groups):
            f = out.with_name(out.name + (f".part{k}" if n > 1 else "") + ".wav"); files.append(f)
            if a.only_part >= 0 and a.only_part != k: continue
            done = False
            for model in models:
                print(f"→ parte {k + 1}/{len(groups)}: {len(grp)} segmentos ({sum(len(c['text'].split()) for c in grp)} palabras) · {model} · {voice}", flush=True)
                try:
                    dur = generate_group(script, grp, f, voice, model)
                    print(f"  ✓ {dur:.1f} s", flush=True); prov.append({"part": k, "model": model, "voice": voice, "dur": round(dur, 2)}); done = True; break
                except tts.QuotaError as e:
                    print(f"  ✗ {model}: {e} → siguiente modelo", flush=True)
                except RuntimeError as e:
                    print(f"  ✗ {model}: {str(e)[:160]}", flush=True)
                    if n == 1 and len(plans) > 1: break       # pedido largo falló: probar en partes
            if not done: ok = False; break
        if ok: break
    else:
        raise SystemExit("no se pudo generar la narración con ningún modelo/clave")
    wav = out.with_suffix(".wav")
    if n > 1: concat(files, wav)
    elif files[0] != wav: files[0].rename(wav)
    # mp3 final: silencio al principio (el título se arma antes de la primera palabra) y al final
    # (el cierre de canal: gracias por ver / suscríbete), y loudness de redes (-16 LUFS)
    filters = []
    if lead > 0:
        filters.append(f"adelay={int(lead * 1000)}|{int(lead * 1000)}")
    if tail > 0:
        filters.append(f"apad=pad_dur={tail}")
    filters.append("loudnorm=I=-16:TP=-1.5:LRA=11")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-af",
                    ",".join(filters), "-ar", "44100", "-b:a", "192k", str(out.with_suffix(".mp3"))], check=True)
    r = {"voice": voice, "parts": n, "provenance": prov, "lead": lead, "tail": tail}
    if not a.no_qc:
        r.update(qc(script, wav, files if n > 1 else None))
        print(f"QC: {r['dur_s']} s · {r['wpm']} ppm · WER≈{r['wer_aprox']} · faltan {r['faltan'][:6]} · sobran {r['sobran'][:6]}")
    out.with_suffix(".qc.json").write_text(json.dumps(r, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()

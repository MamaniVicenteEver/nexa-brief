#!/usr/bin/env python3
"""outro.py · cierre con voz del canal (gracias por ver · like · suscríbete · campana · apoyo).

El cierre es el mismo en todos los videos de un canal, así que NO se genera con TTS en cada video:
vive una sola vez en `explainer-kit/outro/`:

  outro/voices/<voz>.mp3 + .json   el audio aprobado y sus palabras/tiempos (una voz por diseño:
                                   sadaltager = rough · charon = binary y los demás)
  outro/channels.json              los textos que dibuja <familia>.outrov1 por canal (nodetech, nodehistory)

Este paso lo pega al final de la narración de un video:
  · assets/song-with-outro.mp3 = assets/song.mp3 (narración, no se toca) hasta la última palabra
    + una pausa + el cierre del canal;
  · lyrics.json suma las palabras del cierre (segmento marcado "outro": true) y metadata.outro;
  · config.json → audio.src = song-with-outro.mp3 y config.outro = textos del canal + inicio + tiempos
    (el motor dibuja <familia>.outrov1 sincronizado con la voz; el storyboard no lo lleva).
Se puede correr las veces que haga falta (rehace todo desde song.mp3). `kit.py transcribe` lo corre solo.

Uso (desde nexa-brief-server/):  .venv/bin/python src/templates/_tools/explainer-kit/tools/outro.py <carpeta-del-video>
                                  (o `kit.py outro <video-id>`)

Ediciones en otro idioma (la edición maestra da voz, textos, audio de cierre y rutas de la revisión):
  outro.py --edition <edition.json>               pega el cierre a la narración de la revisión
  outro.py --edition <edition.json> --make-voice  genera una vez el cierre hablado de esa voz e idioma
                                                  (outro/voices/<locale>/<Voz>.mp3 + .json)
"""
from __future__ import annotations

import json, pathlib, re, subprocess, sys, unicodedata
from contextlib import nullcontext
sys.path.insert(0, str(pathlib.Path(__file__).parent))
import edition_context  # noqa: E402

KIT = pathlib.Path(__file__).resolve().parents[1]
OUTRO = KIT / "outro"
GAP = 1.2          # pausa entre la última palabra de la narración y "Gracias por llegar hasta aquí"
TAIL = 0.6         # silencio final (el último cuadro no corta la voz)
OUTRO_BEAT = re.compile(r"\.outro(?:v\d+)?$")


def _json(path: pathlib.Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _save(path: pathlib.Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def channel_of(video: pathlib.Path, channels: dict) -> str | None:
    """Canal del video: su carpeta de categoría (nodetech, nodehistory; también en sandbox/<carpeta>)
    o la categoría del manifest (node_tech → nodetech)."""
    if video.parent.name in channels:
        return video.parent.name
    category = (_json(video / "manifest.json").get("category") or "") if (video / "manifest.json").exists() else ""
    key = category.split("/", 1)[0].replace("_", "")
    return key if key in channels else None


def spec_for(video: pathlib.Path) -> dict | None:
    """Voz + textos del cierre de este video, o None si su canal/voz no tiene cierre grabado."""
    raw = _json(video / "assets" / "config.json")
    cfg = raw["configs"][0] if "configs" in raw else raw
    design = _json(KIT / "designs" / cfg.get("design", "binary") / "design.json")
    voice = str(design.get("voice", {}).get("voice", "")).lower()
    channels = _json(OUTRO / "channels.json")
    channel = channel_of(video, channels)
    audio = OUTRO / "voices" / f"{voice}.mp3"
    if not channel or not audio.exists():
        return None
    return {"channel": channel, "texts": channels[channel], "use": outro_component(design["family"]), "audio": audio,
            "meta": _json(OUTRO / "voices" / f"{voice}.json")}


def outro_component(family: str) -> str:
    """El cierre que tiene el diseño: <familia>.outrov1 (binary, rough) o <familia>.outro (los demás)."""
    names = {c["name"] for c in _json(KIT / "catalog.json")["comps"]}
    return f"{family}.outrov1" if f"{family}.outrov1" in names else f"{family}.outro"


def spec_for_edition(ctx) -> dict | None:
    audio = ctx.outro_audio()
    if audio is None or not audio.exists() or not audio.with_suffix(".json").exists():
        return None
    texts = {k: ctx.outro[k] for k in ("channel", "thanks", "cta", "support", "handle") if k in ctx.outro}
    return {"channel": texts.get("channel", ""), "texts": texts, "use": ctx.outro["use"], "audio": audio,
            "meta": _json(audio.with_suffix(".json"))}


def apply(video: pathlib.Path, ctx=None) -> dict | None:
    """ctx (edición): rutas, voz y textos de la revisión; sin ctx, el video original como siempre."""
    spec = spec_for_edition(ctx) if ctx is not None else spec_for(video)
    if spec is None:
        if ctx is not None:
            print(f"· {ctx.locale}: falta el cierre hablado {ctx.outro.get('audio')} (generarlo con --make-voice)")
        else:
            print(f"· {video.name}: su canal/voz no tiene cierre grabado en outro/ (se usa el cierre sin voz del diseño)")
        return None
    A = video / "assets"
    if ctx is not None:
        lyrics_path, sb_path = ctx.path_of("lyrics"), ctx.path_of("storyboard")
        song, out, config_path, src = ctx.path_of("audio"), ctx.path_of("audio_with_outro"), ctx.path_of("config"), ctx.rel("audio_with_outro")
    else:
        lyrics_path, sb_path = A / "lyrics.json", A / "storyboard.json"
        song, out, config_path, src = A / "song.mp3", A / "song-with-outro.mp3", A / "config.json", "assets/song-with-outro.mp3"
    lyrics = _json(lyrics_path)
    # rehacer desde cero: sin el cierre de una corrida anterior ("outro": true) ni el de un cierre
    # pegado a mano antes de esta herramienta (palabras desde el beat de cierre del storyboard)
    lyrics["segments"] = [s for s in lyrics["segments"] if not s.get("outro")]
    manual = [b.get("t") for b in (_json(sb_path).get("beats", []) if sb_path.exists() else [])
              if OUTRO_BEAT.search(b.get("use", "")) and b.get("t") is not None]
    # Source-language beat timestamps do not describe a translated narration.
    # Only legacy original audio may already contain the manually placed outro.
    if manual and ctx is None:
        cut = min(manual) - 0.05
        for s in lyrics["segments"]:
            s["words"] = [w for w in s.get("words", []) if w["start"] < cut]
            s["text"] = "".join(w["word"] for w in s["words"])
        lyrics["segments"] = [s for s in lyrics["segments"] if s["words"]]
    words = [w for s in lyrics["segments"] for w in s.get("words", [])]
    if not words:
        sys.exit(f"{video.name}: lyrics.json no tiene palabras (correr kit.py transcribe primero)")
    t0 = round(max(w["end"] for w in words) + GAP, 3)
    meta = spec["meta"]
    fmt = "aformat=sample_rates=44100:channel_layouts=mono"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(song), "-i", str(spec["audio"]),
        "-filter_complex",
        f"[0:a]{fmt},apad=whole_dur={t0},atrim=0:{t0},asetpts=PTS-STARTPTS[n];[1:a]{fmt}[c];"
        f"[n][c]concat=n=2:v=0:a=1,apad=pad_dur={TAIL}[o]",
        "-map", "[o]", "-ar", "44100", "-b:a", "192k", str(out),
    ], check=True)
    total = round(t0 + meta["dur"] + TAIL, 3)
    outro_words = [{"word": w["word"], "start": round(t0 + w["start"], 3), "end": round(t0 + w["end"], 3)} for w in meta["words"]]
    lyrics["segments"].append({"start": outro_words[0]["start"], "end": outro_words[-1]["end"], "outro": True,
                               "text": "".join(w["word"] for w in outro_words), "words": outro_words})
    lyrics.setdefault("metadata", {}).update(duration=total, outro={"start": t0, "voice": meta["voice"], "channel": spec["channel"]})
    _save(lyrics_path, lyrics)

    raw = _json(config_path)
    cfg = raw["configs"][0] if "configs" in raw else raw
    cfg["audio"] = {**(cfg.get("audio") or {}), "src": src}
    fade_out = (cfg.get("outro") or {}).get("fadeOut")
    cfg["outro"] = {**({"fadeOut": fade_out} if fade_out is not None else {}), "enabled": True, "use": spec["use"], "start": t0, "dur": round(meta["dur"] + TAIL, 3),
                    **spec["texts"], **meta["timings"]}
    _save(config_path, raw)

    # el cierre lo agrega el motor desde config.outro: un beat de cierre escrito a mano sobra
    if sb_path.exists():
        sb = _json(sb_path)
        kept = [b for b in sb.get("beats", []) if not OUTRO_BEAT.search(b.get("use", ""))]
        if len(kept) != len(sb.get("beats", [])):
            sb["beats"] = kept
            _save(sb_path, sb)
    print(f"✓ {video.name}: cierre de {spec['texts']['channel']} con voz {meta['voice']} a los {t0:.1f} s → {src} ({total:.1f} s)")
    return {"start": t0, "total": total, "channel": spec["channel"]}


def _norm(word: str) -> str:
    word = unicodedata.normalize("NFD", word.lower())
    return re.sub(r"[^a-z0-9]", "", "".join(c for c in word if unicodedata.category(c) != "Mn"))


def make_voice(ctx, force: bool = False) -> pathlib.Path:
    """Genera UNA vez el cierre hablado de la voz e idioma de la edición: TTS con la voz de la
    identidad, Whisper del idioma para las palabras y tiempos, y los instantes like/suscribir/
    campana/apoyo a partir de las palabras clave declaradas en la identidad (outro_spoken.cues).
    Si el audio ya existe y solo falta su medición (.json), se reutiliza sin volver a pedir TTS."""
    spoken = ctx.outro_spoken
    if not spoken or not spoken.get("text"):
        sys.exit(f"{ctx.locale}: la identidad no declara texts.outro_spoken (texto hablado del cierre)")
    dest = ctx.outro_audio()
    if dest.exists() and dest.with_suffix(".json").exists() and not force:
        print(f"· ya existe {dest.relative_to(KIT)}")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.exists() and not force:
        print(f"· reutilizo el audio ya generado {dest.relative_to(KIT)}; solo falta medirlo")
    else:
        _synthesize(ctx, spoken, dest)
    return _measure(ctx, spoken, dest)


def _synthesize(ctx, spoken, dest):
    import tts
    wav = dest.with_suffix(".wav")
    style = f"{ctx.direction} Language: {ctx.language_name} ({ctx.locale}). Warm, grateful channel sign-off, unhurried."
    text = ctx.speakable(spoken["text"])
    voice = ctx.voice["voice"]
    for model in ctx.voice.get("models") or ["gemini-3.8-flash-tts"]:
        try:
            tts.LAST_USAGE.clear()
            if not ctx.is_source:
                import edition_usage
                observation = edition_usage.observe(ctx, tts, model=model, role="voice", step="outro")
            else:
                observation = nullcontext()
            with observation:
                if "3.1" in model:
                    prompt = ("GENERATE SPEECH AUDIO ONLY.\n\nAUDIO PROFILE\n" + style + "\n\nTRANSCRIPT BEGINS\n" + text + "\nTRANSCRIPT ENDS")
                    tts.with_key_rotation(model, lambda key: tts.gemini_director(prompt, wav, voice=voice, model=model, api_key=key))
                else:
                    tts.with_key_rotation(model, lambda key: tts.gemini_annotated([{"text": text, "style": style}], wav, voice=voice, model=model, api_key=key))
            break
        except (tts.QuotaError, RuntimeError) as exc:
            print(f"  ✗ {model}: {str(exc)[:160]}", flush=True)
    else:
        sys.exit("no se pudo generar el cierre con ningún modelo/clave")
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", str(wav), "-af", "silenceremove=start_periods=1:start_threshold=-50dB,loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-b:a", "192k", str(dest)], check=True)
    wav.unlink(missing_ok=True)


def _measure(ctx, spoken, dest):
    from faster_whisper import WhisperModel
    m = WhisperModel("large-v3", device="cpu", compute_type="int8")
    # sin initial_prompt: con el texto como prompt Whisper llegó a omitir palabras clave
    segs, info = m.transcribe(str(dest), language=ctx.whisper_language, word_timestamps=True, beam_size=5,
                              condition_on_previous_text=False)
    words = [{"word": w.word, "start": round(w.start, 2), "end": round(w.end, 2)} for s in segs for w in (s.words or [])]
    if not words:
        sys.exit("Whisper no reconoció palabras en el cierre generado")
    spoken_words = [_norm(w) for w in spoken["text"].split()]
    timings, warnings = {}, []
    for key, cue in (spoken.get("cues") or {}).items():
        target = _norm(cue)
        hit = next((w for w in words if _norm(w["word"]).startswith(target)), None)
        if hit is None:
            # Whisper la escribió distinto: se estima por su posición en el texto conocido
            idx = next((i for i, w in enumerate(spoken_words) if w.startswith(target)), None)
            if idx is None:
                sys.exit(f"la palabra clave {cue} ({key}) no está en texts.outro_spoken")
            hit = words[min(len(words) - 1, round(idx * len(words) / max(1, len(spoken_words))))]
            warnings.append({"kind": "outro_cue_estimated", "cue": key, "target_phrase": cue, "start": hit["start"]})
            print(f"  · {cue} estimada por posición en el texto: {hit['start']} s")
        timings[key] = hit["start"]
    meta = {"voice": ctx.voice["voice"], "locale": ctx.locale, "source": f"generado por outro.py --make-voice ({ctx.locale})",
            "dur": round(info.duration, 2), "text": spoken["text"], "timings": timings, "words": words, "warnings": warnings}
    dest.with_suffix(".json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"✓ cierre {ctx.locale} con voz {meta['voice']}: {dest.relative_to(KIT)} ({meta['dur']} s) · {timings}")
    return dest


if __name__ == "__main__":
    ctx = edition_context.from_argv()
    if ctx is not None:
        args = sys.argv[1:]
        if "--make-voice" in args:
            make_voice(ctx, force="--force" in args)
        else:
            apply(ctx.production, ctx)
    else:
        if len(sys.argv) != 2:
            sys.exit(__doc__)
        apply(pathlib.Path(sys.argv[1]).resolve())

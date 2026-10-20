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
"""
from __future__ import annotations

import json, pathlib, re, subprocess, sys

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


def apply(video: pathlib.Path) -> dict | None:
    spec = spec_for(video)
    if spec is None:
        print(f"· {video.name}: su canal/voz no tiene cierre grabado en outro/ (se usa el cierre sin voz del diseño)")
        return None
    A = video / "assets"
    lyrics = _json(A / "lyrics.json")
    # rehacer desde cero: sin el cierre de una corrida anterior ("outro": true) ni el de un cierre
    # pegado a mano antes de esta herramienta (palabras desde el beat de cierre del storyboard)
    lyrics["segments"] = [s for s in lyrics["segments"] if not s.get("outro")]
    sb_path = A / "storyboard.json"
    manual = [b.get("t") for b in (_json(sb_path).get("beats", []) if sb_path.exists() else [])
              if OUTRO_BEAT.search(b.get("use", "")) and b.get("t") is not None]
    if manual:
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
    out = A / "song-with-outro.mp3"
    fmt = "aformat=sample_rates=44100:channel_layouts=mono"
    subprocess.run([
        "ffmpeg", "-y", "-v", "error", "-i", str(A / "song.mp3"), "-i", str(spec["audio"]),
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
    _save(A / "lyrics.json", lyrics)

    raw = _json(A / "config.json")
    cfg = raw["configs"][0] if "configs" in raw else raw
    cfg["audio"] = {**(cfg.get("audio") or {}), "src": "assets/song-with-outro.mp3"}
    cfg["outro"] = {"enabled": True, "use": spec["use"], "start": t0, "dur": round(meta["dur"] + TAIL, 3),
                    **spec["texts"], **meta["timings"]}
    _save(A / "config.json", raw)

    # el cierre lo agrega el motor desde config.outro: un beat de cierre escrito a mano sobra
    if sb_path.exists():
        sb = _json(sb_path)
        kept = [b for b in sb.get("beats", []) if not OUTRO_BEAT.search(b.get("use", ""))]
        if len(kept) != len(sb.get("beats", [])):
            sb["beats"] = kept
            _save(sb_path, sb)
    print(f"✓ {video.name}: cierre de {spec['texts']['channel']} con voz {meta['voice']} a los {t0:.1f} s → assets/song-with-outro.mp3 ({total:.1f} s)")
    return {"start": t0, "total": total, "channel": spec["channel"]}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    apply(pathlib.Path(sys.argv[1]).resolve())

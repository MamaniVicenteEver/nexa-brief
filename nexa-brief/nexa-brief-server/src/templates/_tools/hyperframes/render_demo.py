"""Render de validación HyperFrames: el contenido POR DEFECTO de cada plantilla
(su canción, letra y fondo de assets/), N segundos, en todos los formatos del
nicho (16:9 y 9:16), con el mismo HyperframesAdapter que usa el pipeline.

Por plantilla deja en output/hf-demo-<template_id>/:
  youtube_video.mp4 / reels_video.mp4   los videos
  check-16x9.png / check-9x16.png       4 cuadros en momentos con letra cantada
  result.json                           tiempos de render, ffprobe y los momentos
                                        chequeados (palabra cantada en cada t)

Uso (desde nexa-brief-server/):
  PYTHONPATH=. .venv/bin/python src/templates/_tools/hyperframes/render_demo.py \
      [--seconds 30] [--skip-done] <template_id> [...]
Sin template_ids: todas las de lyrics/ y commercial/ con nicho, salvo las de la
categoría "in_progress" (En desarrollo), que solo se renderizan nombrándolas.

Validar = mirar cada check-*.png contra result.json["checks"]: la palabra de
cada cuadro tiene que ser la que se canta en ese segundo.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]          # nexa-brief-server/
TEMPLATES = ROOT / "src" / "templates"
OUTPUT = ROOT / "output"
sys.path.insert(0, str(ROOT))

from src.adapters.recorder.infrastructure.hyperframes_adapter import HyperframesAdapter  # noqa: E402
from src.config.niche_config import list_all_niches  # noqa: E402

_IMAGE_EXT = (".jpg", ".jpeg", ".png", ".webp")


def _manifest() -> dict:
    return json.loads((TEMPLATES / "templates.json").read_text(encoding="utf-8"))["templates"]


def _default_config(asset_dir: Path) -> dict:
    raw = json.loads((asset_dir / "config.json").read_text(encoding="utf-8"))
    return raw["configs"][0] if "configs" in raw else raw


def _words(lyrics_path: Path, until: float) -> list[tuple[float, float, str]]:
    data = json.loads(lyrics_path.read_text(encoding="utf-8"))
    return [
        (w["start"], w["end"], w["word"].strip())
        for seg in data.get("segments", [])
        for w in seg.get("words", [])
        if w["start"] < until
    ]


def _check_times(words: list[tuple[float, float, str]], seconds: int) -> list[dict]:
    """4 momentos repartidos en el clip, cada uno justo después de una palabra cantada."""
    targets = [seconds * f for f in (0.18, 0.42, 0.66, 0.9)]
    checks = []
    for target in targets:
        candidates = [w for w in words if w[0] <= target - 0.3]
        if not candidates:
            continue
        start, end, word = candidates[-1]
        t = round(min(start + 0.35, seconds - 0.2), 2)
        checks.append({"t": t, "word_sung": word, "word_start": round(start, 2)})
    return checks


def _probe(path: Path) -> dict:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,width,height:format=duration",
         "-of", "json", str(path)], capture_output=True, text=True, check=False,
    )
    return json.loads(out.stdout or "{}")


def _tile(video: Path, checks: list[dict], dest: Path, width: int) -> None:
    if not checks:
        return
    frames = "+".join(f"eq(n\\,{round(c['t'] * 30)})" for c in checks)
    subprocess.run(
        ["ffmpeg", "-v", "error", "-y", "-i", str(video), "-vf",
         f"select='{frames}',scale={width}:-1,tile={len(checks)}x1", "-frames:v", "1", str(dest)],
        check=False,
    )


async def render(template_id: str, niche, seconds: int) -> dict:
    entry = _manifest()[template_id]
    asset_dir = TEMPLATES / entry["folder"] / "assets"
    cfg = _default_config(asset_dir)
    out = OUTPUT / f"hf-demo-{template_id}"
    out.mkdir(parents=True, exist_ok=True)

    audio = asset_dir / Path(cfg["audio"]["src"]).name
    lyrics = asset_dir / Path(cfg.get("lyricsUrl", "assets/lyrics.json")).name
    shutil.copy(audio, out / audio.name)
    if lyrics.exists():
        shutil.copy(lyrics, out / "lyrics.json")
    # Fondo: solo lo exige el adapter si la plantilla usa media. Se copia un
    # archivo de assets/ del mismo tipo que espera el nicho (bg.mp4 → un video,
    # bg.jpg → una imagen); la plantilla igual lee su config por defecto.
    media_name = niche.template.media_src_filename
    wanted = (".mp4", ".webm", ".mov") if Path(media_name).suffix.lower() in (".mp4", ".webm", ".mov") else _IMAGE_EXT
    source = next((p for p in sorted(asset_dir.iterdir()) if p.suffix.lower() in wanted), None)
    if source is not None:
        shutil.copy(source, out / media_name)

    started = time.monotonic()
    result = await HyperframesAdapter().record(
        html_path=out / "index.html", audio_path=out / audio.name, output_dir=out,
        duration_seconds=seconds, niche_cfg=niche, render_target="local",
    )
    elapsed = round(time.monotonic() - started, 1)

    checks = _check_times(_words(lyrics, seconds), seconds) if lyrics.exists() else []
    report = {
        "template_id": template_id,
        "niche_id": niche.id,
        "seconds": seconds,
        "render_seconds": elapsed,
        "stats": result.stats,
        "checks": checks,
        "files": {},
    }
    for label, path, width in (("16x9", result.youtube_path, 480), ("9x16", result.reels_path, 270)):
        if path and Path(path).exists():
            report["files"][label] = {"path": str(path), "probe": _probe(Path(path))}
            _tile(Path(path), checks, out / f"check-{label}.png", width)
    (out / "result.json").write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("templates", nargs="*")
    parser.add_argument("--seconds", type=int, default=30)
    parser.add_argument("--skip-done", action="store_true", help="saltea las que ya tienen result.json")
    args = parser.parse_args()

    manifest = _manifest()
    niches = {n.template.template_id: n for n in list_all_niches() if n.template and n.template.template_id}
    ids = args.templates or sorted(
        k for k, v in manifest.items()
        if v["folder"].removeprefix("nodemotion/").split("/")[0] in ("lyrics", "commercial") and v["category_id"] != "in_progress" and k in niches
    )
    for template_id in ids:
        if template_id not in niches:
            print(f"✗ {template_id}: sin nicho", flush=True)
            continue
        if args.skip_done and (OUTPUT / f"hf-demo-{template_id}" / "result.json").exists():
            print(f"· {template_id}: ya renderizada", flush=True)
            continue
        print(f"▶ {template_id} ({args.seconds}s)…", flush=True)
        try:
            report = asyncio.run(render(template_id, niches[template_id], args.seconds))
            passes = report["stats"].get("pass_seconds")
            print(f"✓ {template_id}: {report['render_seconds']}s total, por formato {passes}", flush=True)
        except Exception as exc:  # noqa: BLE001 — una plantilla rota no frena el lote
            print(f"✗ {template_id}: {exc}", flush=True)


if __name__ == "__main__":
    main()

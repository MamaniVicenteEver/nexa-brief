"""Recodifica los <video> de una plantilla con GOP corto para el render HyperFrames.

El reloj nb-hf-clock posiciona cada video visible en su cuadro exacto con un
seek por cuadro. Con los MP4 de stock (2-3 keyframes cada 10 s) cada seek
decodifica hasta ~100 cuadros y los renders con muchos clips no terminan.
Con un keyframe cada 5 cuadros el seek decodifica como mucho 4.

Calidad: x264 CRF 12 preset slow, misma resolución, fps y pix_fmt yuv420p
(medido sobre lyrics-grunge: SSIM 0.996 / PSNR 50 dB, visualmente idéntico).
No toca colores, encuadre ni duración; quita la pista de audio (las plantillas
los usan muteados, el audio sale de la canción).

Los originales se guardan en media_originals/<template_id>/<ruta relativa>
(una sola vez: si ya hay copia, no se pisa). --revert los restaura.

Uso (desde nexa-brief-server/):
  .venv/bin/python src/templates/_tools/hyperframes/reencode_media.py [--revert] <template_id> [...]
"""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TEMPLATES = HERE.parents[1]
BACKUP = HERE / "media_originals"
VIDEO_EXT = (".mp4", ".webm", ".mov")
GOP = 5

FFMPEG_ARGS = [
    "-c:v", "libx264", "-preset", "slow", "-crf", "12",
    "-g", str(GOP), "-keyint_min", str(GOP), "-sc_threshold", "0", "-bf", "0",
    "-pix_fmt", "yuv420p", "-an", "-movflags", "+faststart",
]


def _folder(template_id: str) -> Path:
    manifest = json.loads((TEMPLATES / "templates.json").read_text(encoding="utf-8"))["templates"]
    return TEMPLATES / manifest[template_id]["folder"]


def _max_gop(path: Path) -> int:
    """Mayor distancia (en cuadros) entre keyframes del video."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "packet=flags",
         "-of", "csv=p=0", str(path)], capture_output=True, text=True, check=False,
    ).stdout.split()
    gap, worst = 0, 0
    for flags in out:
        if "K" in flags:
            worst, gap = max(worst, gap), 0
        gap += 1
    return max(worst, gap)


def reencode(template_id: str) -> None:
    folder = _folder(template_id)
    for src in sorted(p for p in folder.rglob("*") if p.suffix.lower() in VIDEO_EXT):
        rel = src.relative_to(folder)
        if _max_gop(src) <= GOP:
            print(f"  · {rel}: ya tiene GOP corto")
            continue
        backup = BACKUP / template_id / rel
        if not backup.exists():
            backup.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(src, backup)
        tmp = src.with_name(src.stem + ".hfgop" + src.suffix)
        cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(backup), *FFMPEG_ARGS]
        if src.suffix.lower() != ".mp4":
            cmd = [c for c in cmd if c not in ("-movflags", "+faststart")]
        subprocess.run([*cmd, str(tmp)], check=True)
        tmp.replace(src)
        print(f"  ✓ {rel}: {backup.stat().st_size // 1024} KB → {src.stat().st_size // 1024} KB")


def revert(template_id: str) -> None:
    folder, saved = _folder(template_id), BACKUP / template_id
    if not saved.exists():
        print("  · sin originales guardados")
        return
    for backup in sorted(p for p in saved.rglob("*") if p.is_file()):
        shutil.copy2(backup, folder / backup.relative_to(saved))
        print(f"  ↺ {backup.relative_to(saved)}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("templates", nargs="+")
    parser.add_argument("--revert", action="store_true", help="restaura los originales")
    args = parser.parse_args()
    for template_id in args.templates:
        print(f"▶ {template_id}", flush=True)
        try:
            (revert if args.revert else reencode)(template_id)
        except Exception as exc:  # noqa: BLE001 — una plantilla rota no frena el lote
            print(f"  ✗ {exc}", file=sys.stderr, flush=True)


if __name__ == "__main__":
    main()

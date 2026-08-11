#!/usr/bin/env python3
"""Captura el PRIMER fotograma de un video — el paso 0 del caso 04-video-motion.

Es la única pieza del pipeline que difiere del caso 01 (imagen): al modelo de
visión no se le manda el video, se le manda UNA captura del primer fotograma
(ver Example.md, Prompt 1). El script también imprime los metadatos del archivo
(resolución, fps, duración) para pegarlos junto a la captura en el mismo
mensaje — la duración del loop no es visible en un fotograma, y el prompt la
aprovecha como contexto.

Uso:
    python3 capture_frame.py video.mp4                 # -> video_f1.jpg al lado del video
    python3 capture_frame.py video.mp4 -o captura.jpg  # ruta de salida explícita

Solo stdlib; requiere ffmpeg/ffprobe en el PATH (mismos binarios que usa el
recorder real en src/adapters/recorder/).
"""

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path


def probe(video: Path) -> dict:
    """Devuelve width/height/fps/duración del primer stream de video."""
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height,r_frame_rate,duration",
         "-show_entries", "format=duration",
         "-of", "json", str(video)],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    num, den = stream["r_frame_rate"].split("/")
    fps = float(num) / float(den) if float(den) else 0.0
    # la duración puede venir en el stream o solo en el format según el mux
    duration = float(stream.get("duration") or data["format"].get("duration") or 0)
    return {
        "width_px": stream["width"],
        "height_px": stream["height"],
        "fps": round(fps, 3),
        "duration_s": round(duration, 3),
    }


def capture_first_frame(video: Path, output: Path) -> None:
    subprocess.run(
        ["ffmpeg", "-y", "-v", "error", "-i", str(video),
         "-frames:v", "1", "-q:v", "2", str(output)],
        check=True,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("video", type=Path, help="ruta al video (mp4/webm/...)")
    parser.add_argument("-o", "--output", type=Path, default=None,
                        help="ruta del jpg de salida (default: <video>_f1.jpg al lado del video)")
    args = parser.parse_args()

    for tool in ("ffmpeg", "ffprobe"):
        if not shutil.which(tool):
            print(f"ERROR: falta `{tool}` en el PATH", file=sys.stderr)
            return 1
    if not args.video.is_file():
        print(f"ERROR: no existe el archivo {args.video}", file=sys.stderr)
        return 1

    output = args.output or args.video.with_name(args.video.stem + "_f1.jpg")
    capture_first_frame(args.video, output)
    meta = probe(args.video)

    print(f"captura : {output}")
    print("metadatos para pegar junto a la captura en el Prompt 1:")
    print(json.dumps({"file": args.video.name, **meta}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())

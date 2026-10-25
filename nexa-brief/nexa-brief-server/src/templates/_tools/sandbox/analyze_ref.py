#!/usr/bin/env python3
"""Analiza videos e imágenes de referencia con FFmpeg y Whisper local.

Uso (desde nexa-brief-server/):
  python src/templates/_tools/sandbox/analyze_ref.py \
      src/templates/sandbox/referencias/nodehistory/idea --out /tmp/idea
  Para cada archivo escribe escenas, frames, contacto, paleta, probe y resumen;
  si un video tiene audio también crea transcript.json con faster-whisper.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Iterable

from PIL import Image, ImageDraw, ImageFont

TOOL_DIR = Path(__file__).resolve().parent
TEMPLATES_ROOT = TOOL_DIR.parents[1]
VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".webm", ".m4v", ".avi"}
IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tif", ".tiff"}
SHOWINFO_TIME = re.compile(r"\bpts_time:\s*(-?(?:\d+(?:\.\d*)?|\.\d+))")


def parse_ffmpeg_scene_times(stderr: str) -> list[float]:
    """Extrae timestamps de líneas showinfo producidas por el filtro scene.

    Ejemplo: parse_ffmpeg_scene_times("[Parsed_showinfo] n:1 pts_time:2.500").
    """
    times: list[float] = []
    for match in SHOWINFO_TIME.finditer(stderr):
        value = float(match.group(1))
        if math.isfinite(value) and value >= 0:
            times.append(value)
    return times


def build_scenes(
    change_times: Iterable[float], duration: float, min_scene_seconds: float = 0.35
) -> list[dict[str, float]]:
    """Convierte cortes detectados en intervalos contiguos y redondeados.

    Ejemplo: build_scenes([4.2, 8.0], 10) devuelve 3 escenas.
    """
    if not math.isfinite(duration) or duration <= 0:
        return []
    boundaries = [0.0]
    for value in sorted(float(t) for t in change_times if math.isfinite(float(t))):
        value = min(duration, max(0.0, value))
        if value < 0.15 or value >= duration - 0.10:
            continue
        if value - boundaries[-1] >= min_scene_seconds:
            boundaries.append(value)
    if len(boundaries) > 1 and duration - boundaries[-1] < min_scene_seconds:
        boundaries.pop()
    boundaries.append(duration)
    return [
        {"start": round(start, 3), "end": round(end, 3), "duration": round(end - start, 3)}
        for start, end in zip(boundaries, boundaries[1:])
        if end > start
    ]


def make_contact_sheet(
    tiles: list[tuple[Image.Image, str]], max_width: int = 2000,
    cell_width: int = 380, cell_height: int = 390,
) -> Image.Image:
    """Arma una grilla legible con rótulo y timestamp sin superar max_width.

    Ejemplo: make_contact_sheet([(Image.open("1.jpg"), "t=1.2s")]).
    """
    if not tiles:
        raise ValueError("No hay cuadros para la grilla de contacto")
    gap, margin, header = 8, 10, 34
    columns = max(1, min(len(tiles), 5, (max_width - 2 * margin + gap) // (cell_width + gap)))
    rows = math.ceil(len(tiles) / columns)
    width = columns * cell_width + (columns - 1) * gap + 2 * margin
    height = rows * cell_height + (rows - 1) * gap + 2 * margin
    sheet = Image.new("RGB", (width, height), (24, 27, 31))
    draw = ImageDraw.Draw(sheet)
    font = _font(17)
    for index, (source, label) in enumerate(tiles):
        column, row = index % columns, index // columns
        x, y = margin + column * (cell_width + gap), margin + row * (cell_height + gap)
        draw.rectangle((x, y, x + cell_width - 1, y + header - 1), fill=(40, 48, 57))
        draw.text((x + 8, y + 8), label[:48], fill=(245, 247, 250), font=font)
        frame_box = (x + 6, y + header + 4, x + cell_width - 6, y + cell_height - 6)
        frame_w, frame_h = frame_box[2] - frame_box[0], frame_box[3] - frame_box[1]
        thumb = source.convert("RGB").copy()
        thumb.thumbnail((frame_w, frame_h), Image.Resampling.LANCZOS)
        tx = frame_box[0] + (frame_w - thumb.width) // 2
        ty = frame_box[1] + (frame_h - thumb.height) // 2
        sheet.paste(thumb, (tx, ty))
    if sheet.width > max_width:
        scale = max_width / sheet.width
        sheet = sheet.resize((max_width, round(sheet.height * scale)), Image.Resampling.LANCZOS)
    return sheet


def palette_for(image: Image.Image) -> list[dict[str, object]]:
    """Extrae hasta ocho colores dominantes y conserva cinco entradas como mínimo."""
    small = image.convert("RGB")
    small.thumbnail((128, 128), Image.Resampling.LANCZOS)
    quantized = small.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette() or []
    counts = sorted(quantized.getcolors(128 * 128) or [], reverse=True)
    colors = []
    total = sum(count for count, _ in counts) or 1
    for count, index in counts[:8]:
        offset = index * 3
        rgb = palette[offset:offset + 3]
        if len(rgb) == 3:
            colors.append({"hex": "#%02X%02X%02X" % tuple(rgb), "share": round(count / total, 4)})
    while colors and len(colors) < 5:
        colors.append({"hex": colors[-1]["hex"], "share": 0.0})
    if not colors:
        colors = [{"hex": "#000000", "share": 1.0}] * 5
    return colors[:8]


def _font(size: int) -> ImageFont.ImageFont:
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf",
    ):
        if Path(path).is_file():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _run(command: list[str]) -> subprocess.CompletedProcess[str]:
    result = subprocess.run(command, text=True, capture_output=True, check=False)
    if result.returncode:
        message = (result.stderr or result.stdout or "comando fallido").strip()
        raise RuntimeError(message[-1800:])
    return result


def probe_video(path: Path) -> dict[str, object]:
    """Lee metadatos de duración, fps, resolución y audio con ffprobe."""
    result = _run([
        "ffprobe", "-v", "error", "-show_entries",
        "format=duration:stream=codec_type,width,height,avg_frame_rate,r_frame_rate",
        "-of", "json", str(path),
    ])
    data = json.loads(result.stdout)
    streams = data.get("streams", [])
    video = next((stream for stream in streams if stream.get("codec_type") == "video"), {})
    duration = float((data.get("format") or {}).get("duration") or 0)
    fps_text = video.get("avg_frame_rate") or video.get("r_frame_rate") or "0/1"
    numerator, _, denominator = str(fps_text).partition("/")
    fps = float(numerator) / float(denominator or 1) if float(denominator or 1) else 0.0
    return {
        "duration": round(duration, 3),
        "fps": round(fps, 3),
        "resolution": {"width": video.get("width"), "height": video.get("height")},
        "audio": any(stream.get("codec_type") == "audio" for stream in streams),
    }


def _scene_cuts(path: Path) -> list[float]:
    result = subprocess.run(
        [
            "ffmpeg", "-hide_banner", "-i", str(path), "-filter:v",
            "select='gt(scene,0.12)',showinfo", "-an", "-f", "null", "-",
        ], text=True, capture_output=True, check=False,
    )
    # Un umbral moderado capta transiciones graduales de mapas animados.
    # FFmpeg puede devolver 0 aunque select no emita cuadros.
    if result.returncode:
        raise RuntimeError((result.stderr or "ffmpeg scene detect falló")[-1800:])
    return parse_ffmpeg_scene_times(result.stderr)


def _extract_frame(video: Path, second: float, destination: Path) -> None:
    _run([
        "ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(video),
        "-ss", f"{second:.3f}", "-frames:v", "1", "-vf", "scale='min(1280,iw)':-2",
        "-q:v", "3", str(destination),
    ])


def _load_whisper(model_name: str = "large-v3"):
    """Carga el modelo faster-whisper configurado, sin enviar audio a una API."""
    try:
        from faster_whisper import WhisperModel
    except ImportError as error:
        raise RuntimeError("Hay audio, pero faster-whisper no está instalado en el .venv del servidor") from error
    return WhisperModel(model_name, device="cpu", compute_type="int8")


def transcribe_video(path: Path, model, model_name: str = "large-v3") -> dict[str, object]:
    """Transcribe audio de un video con el modelo faster-whisper local indicado."""
    segments, metadata = model.transcribe(
        str(path), language="es", word_timestamps=True, beam_size=5,
        vad_filter=True, condition_on_previous_text=False,
    )
    rows = []
    for segment in segments:
        words = [
            {"word": word.word, "start": round(word.start, 3), "end": round(word.end, 3)}
            for word in (segment.words or [])
        ]
        row: dict[str, object] = {
            "start": round(segment.start, 3), "end": round(segment.end, 3),
            "text": segment.text, "words": words,
        }
        rows.append(row)
    return {
        "metadata": {
            "source": path.name, "model": f"faster-whisper {model_name}",
            "language": getattr(metadata, "language", "es"),
            "duration": round(float(getattr(metadata, "duration", 0) or 0), 3),
        },
        "segments": rows,
    }


def _image_probe(path: Path, image: Image.Image) -> dict[str, object]:
    return {
        "duration": 0.0, "fps": None,
        "resolution": {"width": image.width, "height": image.height}, "audio": False,
    }


def _analysis_markdown(
    path: Path, probe: dict[str, object], scenes: list[dict[str, float]],
    palettes: list[dict], transcription_status: str,
) -> str:
    durations = [scene["duration"] for scene in scenes]
    median = sorted(durations)[len(durations) // 2] if durations else 0
    colors = []
    for row in palettes:
        for color in row["colors"]:
            value = color["hex"]
            if value not in colors:
                colors.append(value)
    resolution = probe["resolution"]
    lines = [
        f"# Análisis automático · {path.name}", "",
        f"- Duración: {probe['duration']:.2f} s" if probe["duration"] else "- Imagen fija",
        f"- Resolución: {resolution['width']} × {resolution['height']}",
        f"- FPS: {probe['fps']}" if probe["fps"] is not None else "- FPS: no aplica",
        f"- Audio: {'sí' if probe['audio'] else 'no'}",
        f"- Transcripción: {transcription_status}",
        f"- Escenas: {len(scenes)}; duración mediana: {median:.2f} s",
        "- Colores dominantes: " + (", ".join(colors[:8]) or "sin datos"),
        "", "## Ritmo por escena", "",
        "| # | Inicio | Fin | Duración |", "|---:|---:|---:|---:|",
    ]
    lines.extend(
        f"| {index} | {scene['start']:.2f} s | {scene['end']:.2f} s | {scene['duration']:.2f} s |"
        for index, scene in enumerate(scenes, 1)
    )
    return "\n".join(lines) + "\n"


def _media_files(reference_dir: Path) -> list[Path]:
    supported = VIDEO_EXTENSIONS | IMAGE_EXTENSIONS
    return sorted(
        path for path in reference_dir.iterdir()
        if path.is_file() and path.suffix.lower() in supported
    )


def analyze_reference(
    reference_dir: Path, out_dir: Path, whisper_model: str = "large-v3",
    skip_transcription: bool = False,
) -> list[Path]:
    """Analiza archivos de una referencia y devuelve sus carpetas de salida."""
    if not shutil.which("ffmpeg") or not shutil.which("ffprobe"):
        raise RuntimeError("Se necesitan ffmpeg y ffprobe en PATH")
    reference_dir = reference_dir.expanduser().resolve()
    if not reference_dir.is_dir():
        raise FileNotFoundError(f"No existe la carpeta de referencia: {reference_dir}")
    media = _media_files(reference_dir)
    if not media:
        raise ValueError(f"No encontré mp4 ni imágenes en {reference_dir}")
    out_dir = out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    item_dirs: list[Path] = []
    aggregate_tiles: list[tuple[Image.Image, str]] = []
    whisper = None
    whisper_error: str | None = None
    for index, path in enumerate(media, 1):
        name = path.stem
        if any(existing.name == name for existing in item_dirs):
            name = f"{name}-{index}"
        item_out = out_dir / name
        item_out.mkdir(parents=True, exist_ok=False)
        item_dirs.append(item_out)
        (item_out / "frames").mkdir()
        image_input = path.suffix.lower() in IMAGE_EXTENSIONS
        transcription_status = "sin audio"
        if image_input:
            with Image.open(path) as original:
                frame = original.convert("RGB")
            probe = _image_probe(path, frame)
            scenes = [{"start": 0.0, "end": 0.0, "duration": 0.0}]
            frame_path = item_out / "frames" / "001.jpg"
            frame.save(frame_path, quality=92)
            frame_images = [frame]
        else:
            probe = probe_video(path)
            cuts = _scene_cuts(path)
            scenes = build_scenes(cuts, float(probe["duration"]))
            frame_images = []
            for scene_index, scene in enumerate(scenes, 1):
                second = scene["start"] + scene["duration"] / 2
                second = min(max(0.0, second), max(0.0, float(probe["duration"]) - 0.04))
                frame_path = item_out / "frames" / f"{scene_index:03d}.jpg"
                _extract_frame(path, second, frame_path)
                with Image.open(frame_path) as frame:
                    frame_images.append(frame.convert("RGB"))
            if probe["audio"]:
                if skip_transcription:
                    transcription_status = "omitida por configuración; ver transcript.json"
                    transcript = {
                        "metadata": {
                            "source": path.name, "model": f"faster-whisper {whisper_model}",
                            "language": "es", "duration": probe["duration"],
                            "status": "omitida",
                            "reason": "se solicitó --skip-transcription o NEXA_SKIP_WHISPER=1",
                        },
                        "segments": [],
                    }
                else:
                    if whisper is None and whisper_error is None:
                        try:
                            whisper = _load_whisper(whisper_model)
                        except Exception as error:
                            whisper_error = f"{type(error).__name__}: {error}"
                    if whisper is None:
                        transcription_status = "no disponible; ver transcript.json"
                        transcript = {
                            "metadata": {
                                "source": path.name, "model": f"faster-whisper {whisper_model}",
                                "language": "es", "duration": probe["duration"],
                                "status": "no_disponible", "error": whisper_error,
                            },
                            "segments": [],
                        }
                    else:
                        transcription_status = f"generada con faster-whisper {whisper_model}"
                        transcript = transcribe_video(path, whisper, whisper_model)
                (item_out / "transcript.json").write_text(
                    json.dumps(transcript, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
                )

        palette_rows = [
            {"scene": scene_index, "colors": palette_for(frame)}
            for scene_index, frame in enumerate(frame_images, 1)
        ]
        (item_out / "scenes.json").write_text(
            json.dumps(scenes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (item_out / "palette.json").write_text(
            json.dumps(palette_rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        (item_out / "probe.json").write_text(
            json.dumps(probe, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        local_tiles = []
        for scene_index, (scene, frame) in enumerate(zip(scenes, frame_images), 1):
            time_label = f"{scene['start']:.2f}–{scene['end']:.2f}s" if scene["duration"] else "imagen"
            local_tiles.append((frame, f"Escena {scene_index} · {time_label}"))
            aggregate_tiles.append((frame, f"V{index:02d} · {time_label}"))
        make_contact_sheet(local_tiles).save(item_out / "contact.jpg", quality=88)
        (item_out / "ANALISIS.md").write_text(
            _analysis_markdown(path, probe, scenes, palette_rows, transcription_status), encoding="utf-8"
        )

    # Hoja general útil cuando la idea contiene varios videos; cada archivo también
    # tiene su propia hoja completa dentro de su subcarpeta.
    make_contact_sheet(aggregate_tiles).save(out_dir / "contact.jpg", quality=88)
    summary = ["# Análisis de la carpeta de referencia", ""]
    for media_index, (path, item_out) in enumerate(zip(media, item_dirs), 1):
        summary.append(f"- V{media_index:02d}: [{path.name}](./{item_out.name}/ANALISIS.md)")
    (out_dir / "ANALISIS.md").write_text("\n".join(summary) + "\n", encoding="utf-8")
    return item_dirs


def main(argv: list[str] | None = None) -> int:
    """Analiza una carpeta de referencias y escribe resultados en --out."""
    parser = argparse.ArgumentParser(description="Analizar escenas y estilo de una referencia.")
    parser.add_argument("reference_dir", type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument(
        "--whisper-model", default=os.environ.get("NEXA_WHISPER_MODEL", "large-v3"),
        help="Modelo local faster-whisper (por defecto large-v3; NEXA_WHISPER_MODEL también lo configura)",
    )
    parser.add_argument(
        "--skip-transcription", action="store_true",
        default=os.environ.get("NEXA_SKIP_WHISPER", "0") == "1",
        help="No cargar pesos locales; deja transcript.json con estado omitido",
    )
    args = parser.parse_args(argv)
    try:
        results = analyze_reference(args.reference_dir, args.out, args.whisper_model, args.skip_transcription)
    except (OSError, ValueError, RuntimeError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1
    print(f"Análisis listo: {len(results)} archivo(s) en {args.out.resolve()}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

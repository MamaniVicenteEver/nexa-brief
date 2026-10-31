"""Ficha técnica de un video de Biblioteca (pestaña "Info técnica" del reproductor).

Junta lo que ya existe en disco — nada se inventa: lo que no se guardó queda en None.
  - Registro de job_tracker: categoría, fechas, duración, tiempo de generación, archivos.
  - Pipeline (NodeMotion): `logs/07_grabacion_stats.json` (motor, destino, tiempos
    por pasada) y `manifest.json` (plantilla). Copy: `logs/08_resumen_final.json`.
  - Explainer: `manifest.json` / `publish.json` del video en el kit (diseño, idioma,
    estrategias). `generation_seconds` ES el tiempo de grabación (ver
    `recorder._register_for_scheduling`).
  - Cada archivo de video: ffprobe (resolución, fps, códecs, bitrate, audio, peso),
    cacheado en memoria por (ruta, mtime, tamaño) para que abrir el panel sea instantáneo.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import structlog

from src.config.settings import settings
from src.core import job_tracker

logger = structlog.get_logger(__name__)

EXPLAINER_ENGINE = "explainer-kit"
# Copia que `instagram_media` genera al lado del 9:16 para cumplir los límites de Instagram.
INSTAGRAM_COPY_SUFFIX = "-ig"

# (ruta absoluta) → (mtime_ns, tamaño, resultado de ffprobe)
_probe_cache: dict[str, tuple[int, int, dict[str, Any] | None]] = {}


def _read_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}
    return data if isinstance(data, dict) else {}


def resolve_output_path(stored: str | None) -> Path | None:
    """Ruta guardada → archivo real en este servidor. Los jobs creados en otro host
    guardan rutas absolutas de allá: se rebasa lo que sigue a `output/` sobre OUTPUT_DIR."""
    if not stored:
        return None
    path = Path(stored)
    if path.exists():
        return path
    output_root = Path(settings.output_dir).resolve()
    for index in reversed([i for i, part in enumerate(path.parts) if part == "output"]):
        suffix = path.parts[index + 1 :]
        if not suffix or ".." in suffix:
            continue
        candidate = (output_root / Path(*suffix)).resolve()
        if candidate.is_relative_to(output_root) and candidate.exists():
            return candidate
    return None


def relative_output_dir(stored: str | None) -> str | None:
    """`output/<...>` sin la parte del host (no se expone la ruta absoluta)."""
    if not stored:
        return None
    parts = Path(stored).parts
    indexes = [i for i, part in enumerate(parts) if part == "output"]
    if not indexes:
        return Path(stored).name
    return str(Path(*parts[indexes[-1] :]))


# ── ffprobe ──────────────────────────────────────────────────────────────────

async def _run_ffprobe(path: Path) -> dict[str, Any] | None:
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffprobe", "-v", "error",
            "-print_format", "json",
            "-show_format", "-show_streams",
            str(path),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await proc.communicate()
    except OSError:
        logger.warning("job_technical_ffprobe_failed", path=str(path))
        return None
    if proc.returncode != 0 or not stdout.strip():
        return None
    try:
        return json.loads(stdout)
    except ValueError:
        return None


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _fps(rate: Any) -> float | None:
    """'30000/1001' → 29.97."""
    if not isinstance(rate, str) or "/" not in rate:
        return _to_float(rate)
    num, den = rate.split("/", 1)
    num_f, den_f = _to_float(num), _to_float(den)
    if not num_f or not den_f:
        return None
    return round(num_f / den_f, 2)


def _kbps(bits: Any) -> int | None:
    value = _to_float(bits)
    return round(value / 1000) if value else None


def parse_probe(raw: dict[str, Any]) -> dict[str, Any]:
    """Salida JSON de ffprobe → campos de `JobTechnicalFile` (None si no viene)."""
    streams = raw.get("streams") or []
    video = next((s for s in streams if s.get("codec_type") == "video"), {})
    audio = next((s for s in streams if s.get("codec_type") == "audio"), {})
    fmt = raw.get("format") or {}
    sample_rate = _to_float(audio.get("sample_rate"))
    duration = _to_float(fmt.get("duration"))
    return {
        "width": video.get("width"),
        "height": video.get("height"),
        "fps": _fps(video.get("avg_frame_rate")) or _fps(video.get("r_frame_rate")),
        "video_codec": video.get("codec_name"),
        "video_bitrate_kbps": _kbps(video.get("bit_rate")),
        "total_bitrate_kbps": _kbps(fmt.get("bit_rate")),
        "audio_codec": audio.get("codec_name"),
        "audio_bitrate_kbps": _kbps(audio.get("bit_rate")),
        "audio_sample_rate_khz": round(sample_rate / 1000, 1) if sample_rate else None,
        "audio_channels": audio.get("channels"),
        "duration_seconds": round(duration, 2) if duration else None,
    }


async def probe_file(path: Path) -> dict[str, Any] | None:
    """ffprobe cacheado: se vuelve a leer solo si el archivo cambió (mtime o tamaño)."""
    try:
        stat = path.stat()
    except OSError:
        return None
    key = str(path)
    cached = _probe_cache.get(key)
    if cached and cached[0] == stat.st_mtime_ns and cached[1] == stat.st_size:
        return cached[2]
    raw = await _run_ffprobe(path)
    result = parse_probe(raw) if raw else None
    _probe_cache[key] = (stat.st_mtime_ns, stat.st_size, result)
    return result


# ── Archivos del job ─────────────────────────────────────────────────────────

def video_files(record: dict[str, Any]) -> list[tuple[str, Path]]:
    """(clave, archivo) por cada MP4 distinto del job: 16x9, 9x16, tiktok (si es otro
    archivo) y la copia para Instagram (`<nombre>-ig.mp4`) si ya se generó."""
    candidates: list[tuple[str, str | None]] = []
    aspect = job_tracker.format_paths(record)
    files: dict[str, str] = record.get("file_paths") or {}
    candidates += [("16x9", aspect.get("16x9")), ("9x16", aspect.get("9x16"))]
    candidates.append(("tiktok", files.get("tiktok")))
    seen: set[Path] = set()
    found: list[tuple[str, Path]] = []
    for key, stored in candidates:
        path = resolve_output_path(stored)
        if path is None or not path.is_file() or path in seen:
            continue
        seen.add(path)
        found.append((key, path))
    vertical = next((p for k, p in found if k in ("9x16", "tiktok")), None)
    if vertical is not None:
        ig_copy = vertical.with_name(f"{vertical.stem}{INSTAGRAM_COPY_SUFFIX}.mp4")
        if ig_copy.is_file() and ig_copy not in seen:
            found.append(("instagram", ig_copy))
    return found


async def describe_files(record: dict[str, Any]) -> list[dict[str, Any]]:
    files = video_files(record)
    probes = await asyncio.gather(*(probe_file(path) for _, path in files))
    output_dir = resolve_output_path(record.get("output_dir"))
    described = []
    for (key, path), probe in zip(files, probes):
        try:
            size_mb = round(path.stat().st_size / (1024 * 1024), 2)
        except OSError:
            size_mb = None
        name = str(path.relative_to(output_dir)) if output_dir and path.is_relative_to(output_dir) else path.name
        described.append({"key": key, "file_name": name, "size_mb": size_mb, **(probe or {})})
    return described


# ── Metadatos por origen ─────────────────────────────────────────────────────

def _pipeline_details(record: dict[str, Any], output_dir: Path | None) -> dict[str, Any]:
    stats = _read_json(output_dir / "logs" / "07_grabacion_stats.json") if output_dir else {}
    manifest = _read_json(output_dir / "manifest.json") if output_dir else {}
    pass_seconds = [s for s in (stats.get("pass_seconds") or []) if isinstance(s, (int, float))]
    return {
        "source": "pipeline",
        "template": manifest.get("template_id") or manifest.get("style") or None,
        "template_label": manifest.get("niche_display_name") or None,
        "engine": stats.get("engine") or None,
        "engine_target": stats.get("engine_target") or None,
        "render_seconds": round(sum(pass_seconds), 1) if pass_seconds else None,
        "render_passes": [str(p) for p in stats.get("passes") or []],
        "language": None,
        "strategies": {},
    }


def _explainer_details(record: dict[str, Any]) -> dict[str, Any]:
    # Import local: el catálogo del kit solo hace falta para jobs del explainer.
    from src.core.explainer.catalog import find_video_dir

    video_id = record.get("video_id") or ""
    video_dir = find_video_dir(video_id) if video_id else None
    manifest = _read_json(video_dir / "manifest.json") if video_dir else {}
    publish = _read_json(video_dir / "publish.json") if video_dir else {}
    strategies = publish.get("strategies_used") or {}
    return {
        "source": "explainer",
        "template": record.get("design") or manifest.get("design") or None,
        "template_label": manifest.get("design_name") or None,
        "engine": EXPLAINER_ENGINE,
        # El kit graba en esta máquina (subproceso `kit.py render`).
        "engine_target": "local",
        "render_seconds": record.get("generation_seconds"),
        "render_passes": [],
        "language": manifest.get("language") or None,
        "strategies": {str(k): str(v) for k, v in strategies.items() if v} if isinstance(strategies, dict) else {},
    }


async def build_technical(record: dict[str, Any]) -> dict[str, Any]:
    """Todo lo que muestra la pestaña "Info técnica" para un registro de job_tracker."""
    output_dir = resolve_output_path(record.get("output_dir"))
    if record.get("source") == "explainer":
        details = _explainer_details(record)
    else:
        details = _pipeline_details(record, output_dir)

    summary = job_tracker.get_summary(record["job_id"]) or {}
    copies = summary.get("platform_copies") or {}
    if not details["strategies"]:
        details["strategies"] = {
            platform: str(copy["strategy"])
            for platform, copy in copies.items()
            if isinstance(copy, dict) and copy.get("strategy")
        }
    youtube_copy = copies.get("youtube") if isinstance(copies.get("youtube"), dict) else {}
    details["language"] = details["language"] or summary.get("language") or youtube_copy.get("language") or None

    return {
        "job_id": record["job_id"],
        "category": record.get("category"),
        "title": record.get("title"),
        "stage": record.get("stage"),
        **details,
        "duration_seconds": record.get("duration_seconds"),
        "generation_seconds": job_tracker.generation_seconds(record),
        "formats": sorted(job_tracker.format_paths(record)),
        "files": await describe_files(record),
        "created_at": record.get("created_at"),
        "updated_at": record.get("updated_at"),
        "output_dir": relative_output_dir(record.get("output_dir")),
    }

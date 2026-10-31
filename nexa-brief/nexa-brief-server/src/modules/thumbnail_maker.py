"""Miniatura de un video grabado: un cuadro del final de la intro (el cartel con el nombre de la canción).

Sale del video 16:9 ya grabado, así funciona igual con cualquier motor (HyperFrames, navegador,
Remotion) y es idéntica a lo que se ve en el video. Dos archivos de la misma captura:
  thumbnail.jpg   1280×720, ≤ 2 MB — el que se sube a YouTube (thumbnails.set acepta JPEG/PNG, no WebP)
  thumbnail.webp  liviano — el que muestra la web

Qué cuadro:
  1. El segundo que declara la intro de la plantilla, en su components/intro.js:
       // @nexa thumbnail-at: 1.5
     (el momento en que el cartel está completo; cada intro dura distinto, por eso lo declara ella).
  2. Control de calidad: se revisan los cuadros de ±0,3 s alrededor y se descartan los vacíos/negros
     y los que están en plena transición o animación (los que salen deformes o borrosos); gana el
     más estable. Así un desfase de unos cuadros nunca deja una miniatura a medio animar.
"""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

WIDTH, HEIGHT = 1280, 720
_MAX_BYTES = 2 * 1024 * 1024
_DEFAULT_AT = 1.0
_MARK = re.compile(r"@nexa\s+thumbnail-at:\s*([0-9]+(?:\.[0-9]+)?)")
# Búsqueda del cuadro estable: ventana alrededor del segundo declarado, a 30 fps y en miniatura.
_WINDOW = 0.3
_PROBE_W, _PROBE_H, _PROBE_FPS = 96, 54, 30
# Un cuadro casi liso (pantalla negra, fundido) tiene muy poca variación de brillo.
_MIN_CONTRAST = 6.0


# ── qué segundo ──────────────────────────────────────────────────────────────

def declared_at(intro_js: Path) -> float | None:
    """El `@nexa thumbnail-at: <s>` de un components/intro.js, si lo tiene."""
    try:
        match = _MARK.search(intro_js.read_text(encoding="utf-8")[:2000])
    except OSError:
        return None
    return float(match.group(1)) if match else None


def capture_at(template_id: str | None) -> float:
    """Segundo de la captura según la intro de la plantilla; 1 s si no lo declara."""
    if template_id:
        from src.config.template_manifest import get_template_root

        root = get_template_root(template_id)
        at = declared_at(root / "components" / "intro.js") if root else None
        if at is not None:
            return at
    return _DEFAULT_AT


# ── qué cuadro (control de calidad) ──────────────────────────────────────────

async def _probe_frames(video: Path, start: float, duration: float) -> list[bytes]:
    """Cuadros chicos en gris de [start, start+duration] (para comparar, no para mostrar)."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-v", "error", "-ss", f"{start:.3f}", "-t", f"{duration:.3f}", "-i", str(video),
        "-vf", f"fps={_PROBE_FPS},scale={_PROBE_W}:{_PROBE_H},format=gray", "-f", "rawvideo", "-",
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    raw, _ = await proc.communicate()
    size = _PROBE_W * _PROBE_H
    return [raw[i:i + size] for i in range(0, len(raw) - size + 1, size)]


def _contrast(frame: bytes) -> float:
    mean = sum(frame) / len(frame)
    return (sum((p - mean) ** 2 for p in frame[::4]) / (len(frame) / 4)) ** 0.5


def _change(a: bytes, b: bytes) -> float:
    return sum(abs(x - y) for x, y in zip(a[::4], b[::4])) / (len(a) / 4)


# Cuánto pesa alejarse del segundo declarado (por cuadro): entre cuadros igual de quietos, gana el
# más cercano al momento que eligió la intro.
_DISTANCE_WEIGHT = 0.15


def pick_stable(frames: list[bytes], center: int | None = None) -> int | None:
    """Índice del cuadro más quieto (menos cambio con sus vecinos) entre los que tienen contenido,
    prefiriendo el más cercano a `center` si empatan. None si todos están vacíos."""
    best, best_score = None, None
    for i, frame in enumerate(frames):
        if _contrast(frame) < _MIN_CONTRAST:
            continue
        neighbours = [frames[j] for j in (i - 1, i + 1) if 0 <= j < len(frames)]
        score = sum(_change(frame, n) for n in neighbours) / max(1, len(neighbours))
        if center is not None:
            score += _DISTANCE_WEIGHT * abs(i - center)
        if best_score is None or score < best_score:
            best, best_score = i, score
    return best


async def stable_time(video: Path, at: float) -> float:
    """El instante más estable y con contenido cerca de `at` (o `at` si no se puede analizar)."""
    start = max(0.0, at - _WINDOW)
    try:
        frames = await _probe_frames(video, start, 2 * _WINDOW)
    except Exception as exc:  # noqa: BLE001 — sin análisis, se usa el segundo declarado
        logger.warning("thumbnail_probe_failed", video=str(video), error=str(exc))
        return at
    index = pick_stable(frames, center=round((at - start) * _PROBE_FPS))
    if index is None:
        return at
    # entre empates de estabilidad, pick_stable ya prefiere el primero; se toma el centro del cuadro
    return start + (index + 0.5) / _PROBE_FPS


# ── archivos ─────────────────────────────────────────────────────────────────

async def _ffmpeg_frame(video: Path, at: float, dest: Path, quality: int) -> bool:
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-v", "error", "-ss", f"{at:.3f}", "-i", str(video), "-frames:v", "1",
        "-vf", f"scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2",
        "-q:v", str(quality), str(dest),
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0 or not dest.exists():
        logger.warning("thumbnail_frame_failed", video=str(video), error=stderr.decode()[-300:])
        return False
    return True


def write_webp(jpg: Path) -> Path | None:
    """Copia liviana para la web (la API de YouTube no acepta WebP)."""
    try:
        from PIL import Image

        webp = jpg.with_suffix(".webp")
        Image.open(jpg).convert("RGB").save(webp, "WEBP", quality=80, method=6)
        return webp
    except Exception as exc:  # noqa: BLE001
        logger.warning("thumbnail_webp_failed", file=str(jpg), error=str(exc))
        return None


async def make_thumbnail(video: Path, out_dir: Path, at: float) -> Path | None:
    """thumbnail.jpg (+ .webp) en `out_dir` desde el cuadro estable cerca de `at`. None si no se pudo."""
    chosen = await stable_time(video, at)
    jpg = out_dir / "thumbnail.jpg"
    for quality in (2, 4, 7):   # baja la calidad solo si pasa los 2 MB de YouTube
        if not await _ffmpeg_frame(video, chosen, jpg, quality):
            return None
        if jpg.stat().st_size <= _MAX_BYTES:
            break
    write_webp(jpg)
    logger.info("thumbnail_ready", file=str(jpg), declared=round(at, 2), chosen=round(chosen, 2), bytes=jpg.stat().st_size)
    return jpg


async def ensure_for_job(file_paths: dict[str, str]) -> Path | None:
    """La miniatura de un video ya grabado; si no tiene (grabado antes de esto), la saca de su 16:9
    en el segundo que declara la intro de su plantilla (manifest.json → template_id)."""
    existing = file_paths.get("thumbnail")
    if existing and Path(existing).exists() and Path(existing).suffix.lower() in (".jpg", ".jpeg", ".png"):
        return Path(existing)
    landscape = file_paths.get("youtube")
    if not landscape or not Path(landscape).exists():
        return None
    out_dir = Path(landscape).parent
    if (out_dir / "thumbnail.jpg").exists():   # ya se sacó antes (descarga o publicación)
        return out_dir / "thumbnail.jpg"
    template_id = None
    manifest = out_dir / "manifest.json"
    try:
        template_id = json.loads(manifest.read_text(encoding="utf-8")).get("template_id") if manifest.exists() else None
    except (OSError, ValueError):
        template_id = None
    return await make_thumbnail(Path(landscape), out_dir, capture_at(template_id))


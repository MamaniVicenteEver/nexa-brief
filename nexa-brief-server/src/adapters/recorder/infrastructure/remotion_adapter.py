"""Remotion adapter — renderiza el video de letras frame-por-frame vía Node/React.

Motor alternativo a PlaywrightFFmpegAdapter, seleccionable por niche (ver
factory.py). Calidad sensiblemente mejor (sin artefactos de captura de
pantalla en vivo) a cambio de un render mucho más lento — 40min-2h+ para
~4min de video, según los benchmarks documentados en el README de
nexa-brief-video-test. Trade-off aceptado explícitamente para las niches que
declaren recorder_engine="remotion" en niches.json.

Reutiliza config.json/lyrics.json/song.mp3/<bg asset> que html_generator,
lyrics_transcriber y resource_fetcher ya dejaron en output_dir antes de que
el pipeline llegue a este stage (config_driven_template branch, ver
pipeline.py) — no hace falta ninguna plomería de datos nueva.

Hoy solo produce un archivo 16:9 (youtube_path); reels_path/tiktok_path
apuntan al MISMO archivo (sin crop ni render aparte) — decisión explícita
para esta primera integración. Ver el comentario en record() marcando el
punto de extensión para cuando se quiera derivar un 9:16 real.

Dónde corre el render es seleccionable vía settings.remotion_render_target
("local" | "aws"), sin tocar código — ver record(): arma los mismos props
(config/lyrics/audio/bg/duración) y solo cambia qué script Node invoca:
scripts/render-node.mjs (local, subproceso en esta máquina) o
scripts/render-lambda.mjs (AWS Lambda — sube los assets del job a S3 vía
URL prefirmada, dispara el render, y descarga el resultado a un path local
normal; ver nexa-brief-docs/guia_migracion_remotion_lambda.md).
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import TYPE_CHECKING

import structlog

from src.config.exceptions import RecordingError
from src.config.settings import settings
from src.core.ports.recorder_port import RecorderPort, RecordingResult

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig

logger = structlog.get_logger(__name__)

_VIDEO_EXTENSIONS = {".mp4", ".mov", ".webm", ".mkv"}

# Límite de renders Remotion simultáneos en TODO el servidor — separado del
# semáforo de max_concurrent_recordings (ese es para Playwright, mucho más
# corto y con otro perfil de CPU/RAM; ver settings.remotion_max_concurrent_renders).
_semaphore: asyncio.Semaphore | None = None


def _get_render_semaphore() -> asyncio.Semaphore:
    global _semaphore
    if _semaphore is None:
        _semaphore = asyncio.Semaphore(settings.remotion_max_concurrent_renders)
    return _semaphore


def _last_json_line(raw: bytes) -> dict | None:
    """Última línea de progreso emitida por render-node.mjs, para loguear
    contexto útil (cuántos frames se llegaron a renderizar) si el proceso
    termina con exit code != 0."""
    lines = [line for line in raw.decode(errors="replace").splitlines() if line.strip()]
    if not lines:
        return None
    try:
        return json.loads(lines[-1])
    except ValueError:
        return None


class RemotionAdapter(RecorderPort):
    """Invoca scripts/render-node.mjs (nexa-brief-video-test) como subproceso Node."""

    async def record(
        self,
        html_path: Path,
        audio_path: Path,
        output_dir: Path,
        duration_seconds: int,
        niche_cfg: "NicheConfig | None" = None,
    ) -> RecordingResult:
        if niche_cfg is None:
            raise RecordingError("RemotionAdapter requiere niche_cfg (necesita template.media_src_filename).")

        config_path = output_dir / "config.json"
        lyrics_path = output_dir / "lyrics.json"
        if not config_path.exists() or not lyrics_path.exists():
            raise RecordingError(
                f"RemotionAdapter: faltan config.json/lyrics.json en {output_dir} "
                "(¿corrieron html_generator/lyrics_transcriber antes de este stage?)."
            )

        bg_filename = niche_cfg.template.media_src_filename
        composition_id = "NeonLetrasVideo" if Path(bg_filename).suffix.lower() in _VIDEO_EXTENSIONS else "NeonLetras"

        lyrics_data = json.loads(lyrics_path.read_text(encoding="utf-8"))
        effective_duration_seconds = duration_seconds

        debug_cap = settings.remotion_debug_max_duration_seconds
        if debug_cap is not None and debug_cap < effective_duration_seconds:
            # calculateMetadata (index.js) prioriza lyricsData.metadata.audio_duration_sec
            # por sobre durationSeconds — truncar solo duration_seconds NO alcanza,
            # hay que recortar también los datos de letra o el video sigue durando
            # lo que dura la canción real.
            effective_duration_seconds = debug_cap
            lyrics_data["metadata"]["audio_duration_sec"] = debug_cap
            lyrics_data["segments"] = [
                seg for seg in lyrics_data.get("segments", []) if seg.get("start", 0) < debug_cap
            ]
            logger.warning(
                "remotion_debug_duration_cap_active",
                cap_seconds=debug_cap,
                original_duration_seconds=duration_seconds,
            )

        props = {
            "configData": json.loads(config_path.read_text(encoding="utf-8")),
            "lyricsData": lyrics_data,
            "audioSrc": audio_path.name,
            "bgSrc": bg_filename,
            "durationSeconds": effective_duration_seconds,
        }
        props_path = output_dir / "_remotion_props.json"
        props_path.write_text(json.dumps(props), encoding="utf-8")

        video_format = niche_cfg.get_16x9_format()
        output_filename = video_format.output_filename if video_format else "youtube_video.mp4"
        youtube_path = output_dir / output_filename

        common_args = [
            f"--props={props_path}",
            f"--composition={composition_id}",
            f"--output={youtube_path}",
            f"--codec={settings.remotion_codec}",
            f"--crf={settings.remotion_crf}",
            f"--timeout-ms={settings.remotion_render_timeout_seconds * 1000}",
        ]

        if settings.remotion_render_target == "aws":
            if not settings.remotion_aws_function_name or not settings.remotion_aws_serve_url:
                raise RecordingError(
                    "RemotionAdapter: remotion_render_target='aws' pero falta "
                    "REMOTION_AWS_FUNCTION_NAME/REMOTION_AWS_SERVE_URL — correr "
                    "scripts/lambda-deploy.sh primero (ver guia_migracion_remotion_lambda.md)."
                )
            render_script = settings.remotion_project_dir / "scripts" / "render-lambda.mjs"
            cmd = [
                "node",
                str(render_script),
                *common_args,
                f"--asset-dir={output_dir}",
                f"--job-id={output_dir.name}",
                f"--region={settings.remotion_aws_region}",
                f"--function-name={settings.remotion_aws_function_name}",
                f"--serve-url={settings.remotion_aws_serve_url}",
                f"--frames-per-lambda={settings.remotion_aws_frames_per_lambda}",
            ]
        else:
            render_script = settings.remotion_project_dir / "scripts" / "render-node.mjs"
            cmd = [
                "node",
                str(render_script),
                *common_args,
                f"--public-dir={output_dir}",
                f"--concurrency={settings.remotion_concurrency}",
            ]

        logger.info(
            "remotion_render_start",
            engine_target=settings.remotion_render_target,
            composition=composition_id,
            output=str(youtube_path),
            duration_seconds=effective_duration_seconds,
        )

        try:
            async with _get_render_semaphore():
                proc = await asyncio.create_subprocess_exec(
                    *cmd,
                    cwd=str(settings.remotion_project_dir),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                try:
                    stdout, stderr = await asyncio.wait_for(
                        proc.communicate(),
                        timeout=settings.remotion_render_timeout_seconds,
                    )
                except asyncio.TimeoutError:
                    proc.kill()
                    raise RecordingError(
                        f"Remotion render timed out after {settings.remotion_render_timeout_seconds}s "
                        f"(composition={composition_id})"
                    )
        finally:
            props_path.unlink(missing_ok=True)

        if proc.returncode != 0:
            err = stderr.decode(errors="replace")[-500:] if stderr else "no stderr"
            logger.error(
                "remotion_render_failed",
                returncode=proc.returncode,
                last_progress=_last_json_line(stdout),
                stderr_tail=err,
            )
            raise RecordingError(f"Remotion render failed (exit {proc.returncode}): {err}")

        if not youtube_path.exists():
            raise RecordingError(f"Remotion render exited 0 pero {youtube_path} no fue creado")

        logger.info("remotion_render_done", output=str(youtube_path))

        # Por ahora Remotion solo produce 16:9 — los demás formatos declarados
        # en niches.json (ej. "reels") publican el MISMO contenido, vía hardlink
        # (packager exige que exista un archivo físico por cada
        # VideoFormat.output_filename, sin importar qué path devuelva este
        # RecordingResult — ver packager._required_files()). Extender esto
        # (ffmpeg-crop del centro, o un render nativo aparte por formato) el día
        # que se quiera un 9:16 real derivado de este motor.
        for fmt in niche_cfg.video.formats:
            fmt_path = output_dir / fmt.output_filename
            if fmt_path == youtube_path:
                continue
            fmt_path.unlink(missing_ok=True)
            fmt_path.hardlink_to(youtube_path)

        reels_format = niche_cfg.get_9x16_format()
        reels_path = (output_dir / reels_format.output_filename) if reels_format else youtube_path
        # None cuando el nicho no genera clip de TikTok — mismo contrato que
        # PlaywrightFFmpegAdapter (ver RecordingResult en recorder_port.py).
        tiktok_path = reels_path if niche_cfg.video.generate_tiktok_clip else None

        return RecordingResult(
            youtube_path=youtube_path,
            reels_path=reels_path,
            tiktok_path=tiktok_path,
            stats={
                "engine": "remotion",
                "engine_target": settings.remotion_render_target,
                "composition": composition_id,
                "duration_seconds": effective_duration_seconds,
                "debug_duration_cap_seconds": debug_cap,
            },
        )

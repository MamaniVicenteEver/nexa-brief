"""Playwright + FFmpeg recorder adapter.

Genera un archivo de video por cada `VideoFormat` definido en el nicho, más
el clip de TikTok derivado del formato 9:16 disponible:
  - youtube_video.mp4  — 16:9, duración completa
  - reels_video.mp4    — 9:16, duración completa
  - tiktok_video.mp4   — 9:16, clip 61s con fade in/out (derivado de reels o youtube)

Cada `VideoFormat.generation_method` decide CÓMO se produce ese formato:
  - "crop_safe_zone" (default, legado): una única grabación de Playwright al
    viewport fijo settings.video_width/height produce el 16:9; cualquier
    formato 9:16 "crop_safe_zone" se deriva recortando el centro de ese 16:9
    con FFmpeg. Comportamiento ORIGINAL, sin cambios — usado por los nichos
    con generación de HTML libre (ambient_music, animated_study, etc).
  - "rerecord": una pasada de Playwright COMPLETA e independiente al viewport
    propio de ese formato (format.width × format.height), grabando los
    duration_seconds completos. Necesario para plantillas config-driven (ej.
    src/templates/image/01-image-bg/) cuyo motor JS decide su layout (flanking vs.
    bandas top/bottom) según el ancho real del viewport — grabar solo en 16:9
    y recortar después nunca dispara el layout angosto, y el crop puede
    cortar texto que el layout habría reposicionado. Escala linealmente con
    duration_seconds — para canciones largas es lento (ver "loop").
  - "loop": mismo viewport correcto que "rerecord", pero graba solo
    `format.loop_seconds` (rápido, tiempo constante) y estira ese clip corto
    con FFmpeg -stream_loop hasta cubrir duration_seconds completo, mezclado
    con el audio real completo. Compromiso: el video se repite en loop duro
    cada loop_seconds en vez de tener movimiento distinto en toda su duración.

IMPORTANTE — por qué se sirve output_dir por HTTP en vez de navegar a file://:
`fetch()` en Chromium RECHAZA el esquema file:// incondicionalmente ("URL
scheme 'file' is not supported") — esto es una restricción dura del propio
Fetch API, NO relacionada con CORS, así que `--disable-web-security` no la
evita. Las plantillas config-driven (ej. src/templates/image/01-image-bg/) cargan
su config con `fetch("config.json")`, así que navegar por file:// las deja
SIEMPRE en su estado sin estilos (CONFIG nunca se resuelve) — un bug real,
confirmado reproduciendo la grabación con Playwright real y capturando el
error de consola. Por eso record() levanta un servidor HTTP local efímero
sobre output_dir y navega a http://127.0.0.1:{port}/index.html en su lugar.
"""

from __future__ import annotations

import asyncio
import contextlib
import functools
import http.server
import shutil
import socket
import threading
import time
from pathlib import Path
from typing import TYPE_CHECKING

import structlog
from playwright.async_api import async_playwright

from src.config.exceptions import RecordingError
from src.config.settings import settings
from src.core.ports.recorder_port import RecorderPort, RecordingResult
from src.core.progress import report_step_progress

if TYPE_CHECKING:
    from src.config.niche_config import NicheConfig, VideoFormat

logger = structlog.get_logger(__name__)

_WARMUP_SECONDS = 3
# Share of the recorder step taken by the live capture; the FFmpeg encode after it covers the rest.
_CAPTURE_PROGRESS_SHARE = 0.85


async def _wait_reporting_progress(seconds: float) -> None:
    """Sleep through the live capture while reporting how much of it has elapsed."""
    started = time.monotonic()
    while (elapsed := time.monotonic() - started) < seconds:
        report_step_progress(_CAPTURE_PROGRESS_SHARE * elapsed / seconds)
        await asyncio.sleep(min(1.0, seconds - elapsed))
    report_step_progress(_CAPTURE_PROGRESS_SHARE)

# Semáforo GLOBAL (todo el servidor, no por-Job) — independiente del
# Semaphore de max_parallel_jobs del Orchestrator. La captura en vivo de
# Playwright (Chromium renderizando en tiempo real durante toda la duración
# del video) es la fase más sensible a contención de CPU de todo el pipeline:
# si el frame rate no se sostiene en cualquier instante, el trabazo queda
# grabado permanentemente — no hay forma de arreglarlo en el _encode()
# posterior. Serializa SOLO esa ventana (ver _record_at_viewport); el resto de
# los stages de cada Job (fetch, generación de config, encode de un job que ya
# terminó de grabar) sigue corriendo en paralelo según max_parallel_jobs.
_recording_semaphore: asyncio.Semaphore | None = None


def _get_recording_semaphore() -> asyncio.Semaphore:
    global _recording_semaphore
    if _recording_semaphore is None:
        _recording_semaphore = asyncio.Semaphore(settings.max_concurrent_recordings)
    return _recording_semaphore


class _QuietStaticHandler(http.server.SimpleHTTPRequestHandler):
    """SimpleHTTPRequestHandler sin logging por request (no ensuciar los logs
    estructurados con una línea por cada bg.jpg/song.mp3/config.json servido)."""

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        pass


def _find_free_port() -> int:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@contextlib.contextmanager
def _serve_directory(directory: Path):
    """Levanta un servidor HTTP efímero sobre *directory* en un hilo daemon.
    Yields la base_url ("http://127.0.0.1:{port}"). Se apaga al salir del bloque.
    """
    port = _find_free_port()
    handler = functools.partial(_QuietStaticHandler, directory=str(directory))
    httpd = http.server.ThreadingHTTPServer(("127.0.0.1", port), handler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{port}"
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=2)

# Crop 9:16 desde el centro de un frame 16:9 (1920×1080)
# Mantiene la altura completa (1080), toma el ancho central (1080 * 9/16 ≈ 607px)
# Luego escala a 1080×1920 para HD vertical.
_CROP_9x16 = "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920"


class PlaywrightFFmpegAdapter(RecorderPort):
    """Graba el visualizador HTML headlessly via Playwright, mezcla audio con FFmpeg."""

    async def record(
        self,
        html_path: Path,
        audio_path: Path,
        output_dir: Path,
        duration_seconds: int,
        niche_cfg: "NicheConfig | None" = None,
        render_target: str | None = None,
    ) -> RecordingResult:
        if not shutil.which("ffmpeg"):
            raise RecordingError("ffmpeg is not installed or not in PATH.")

        output_dir.mkdir(parents=True, exist_ok=True)
        with _serve_directory(output_dir) as base_url:
            page_url = f"{base_url}/{html_path.name}"
            return await self._record_all_formats(
                page_url, audio_path, output_dir, duration_seconds, niche_cfg
            )

    async def _record_all_formats(
        self,
        page_url: str,
        audio_path: Path,
        output_dir: Path,
        duration_seconds: int,
        niche_cfg: "NicheConfig | None",
    ) -> RecordingResult:
        t_start = time.monotonic()

        formats: list["VideoFormat"] = list(niche_cfg.video.formats) if niche_cfg else []
        rerecord_formats = [f for f in formats if f.generation_method == "rerecord"]
        loop_formats = [f for f in formats if f.generation_method == "loop"]
        crop_formats = [f for f in formats if f.generation_method not in ("rerecord", "loop")]

        produced: dict[str, Path] = {}  # format.id (+ "youtube"/"reels" aliases) -> archivo final

        # ── Ruta legada: al menos un formato crop_safe_zone, o sin niche_cfg ──
        # Comportamiento IDÉNTICO al original: una grabación maestra a viewport
        # fijo, 16:9 codificado desde ahí, y el 9:16 "crop_safe_zone" (si existe)
        # derivado por crop de ese mismo 16:9.
        if crop_formats or not formats:
            fmt_16x9 = next((f for f in crop_formats if f.aspect_ratio == "16:9"), None)
            fmt_9x16 = next((f for f in crop_formats if f.aspect_ratio == "9:16"), None)
            youtube_path = output_dir / (fmt_16x9.output_filename if fmt_16x9 else "youtube_video.mp4")

            raw_webm = await self._record_at_viewport(
                page_url, output_dir, duration_seconds, settings.video_width, settings.video_height
            )
            await self._encode(
                raw_webm, audio_path, youtube_path,
                crf=fmt_16x9.crf if fmt_16x9 else 18,
                preset=fmt_16x9.preset if fmt_16x9 else "fast",
            )
            raw_webm.unlink(missing_ok=True)
            logger.info("youtube_video_ready", path=str(youtube_path), method="crop_safe_zone")
            produced["youtube"] = youtube_path
            if fmt_16x9:
                produced[fmt_16x9.id] = youtube_path

            if fmt_9x16:
                reels_path = output_dir / fmt_9x16.output_filename
                await self._run_ffmpeg(
                    "-y",
                    "-i", str(youtube_path),
                    "-vf", _CROP_9x16,
                    "-c:v", "libx264",
                    "-crf", str(fmt_9x16.crf),
                    "-preset", fmt_9x16.preset,
                    "-c:a", "aac",
                    "-b:a", "192k",
                    str(reels_path),
                )
                logger.info("reels_video_ready", path=str(reels_path), method="crop_safe_zone")
                produced[fmt_9x16.id] = reels_path
                produced["reels"] = reels_path

        # ── rerecord: una pasada de Playwright independiente por formato ────
        for fmt in rerecord_formats:
            fmt_path = output_dir / fmt.output_filename
            record_kwargs, crop_vf = self._viewport_kwargs_for(fmt)
            raw_webm = await self._record_at_viewport(
                page_url, output_dir, duration_seconds, **record_kwargs
            )
            await self._encode(raw_webm, audio_path, fmt_path, crf=fmt.crf, preset=fmt.preset, vf=crop_vf)
            raw_webm.unlink(missing_ok=True)
            logger.info(
                "format_video_ready", format_id=fmt.id, path=str(fmt_path),
                method="rerecord", device_viewport=fmt.use_device_viewport,
            )
            produced[fmt.id] = fmt_path
            if fmt.aspect_ratio == "9:16":
                produced["reels"] = fmt_path
            if fmt.aspect_ratio == "16:9":
                produced["youtube"] = fmt_path

        # ── loop: graba un clip corto UNA vez por formato, lo estira con FFmpeg ──
        for fmt in loop_formats:
            fmt_path = output_dir / fmt.output_filename
            loop_seconds = min(fmt.loop_seconds, duration_seconds)
            record_kwargs, crop_vf = self._viewport_kwargs_for(fmt)
            raw_webm = await self._record_at_viewport(
                page_url, output_dir, loop_seconds, **record_kwargs
            )
            await self._encode_looped(
                raw_webm, audio_path, fmt_path,
                crf=fmt.crf, preset=fmt.preset, duration_seconds=duration_seconds, vf=crop_vf,
            )
            raw_webm.unlink(missing_ok=True)
            logger.info(
                "format_video_ready", format_id=fmt.id, path=str(fmt_path),
                method="loop", loop_seconds=loop_seconds, target_duration=duration_seconds,
                device_viewport=fmt.use_device_viewport,
            )
            produced[fmt.id] = fmt_path
            if fmt.aspect_ratio == "9:16":
                produced["reels"] = fmt_path
            if fmt.aspect_ratio == "16:9":
                produced["youtube"] = fmt_path

        youtube_path = produced.get("youtube")
        reels_path = produced.get("reels")
        if youtube_path is None:
            raise RecordingError(
                "No se produjo ningún formato 16:9 — el nicho debe definir un VideoFormat "
                "con aspect_ratio='16:9' (youtube)."
            )

        # ── TikTok: clip 61s con fades, derivado del 9:16 disponible (o del 16:9) ──
        # Se salta por completo si el nicho no lo necesita (generate_tiktok_clip=False)
        # — es un archivo redundante con reels_path si no se va a publicar en TikTok.
        wants_tiktok_clip = niche_cfg.video.generate_tiktok_clip if niche_cfg else True
        tiktok_path: Path | None = None
        if wants_tiktok_clip:
            tiktok_path = output_dir / "tiktok_video.mp4"
            tiktok_source = reels_path or youtube_path
            await self._build_tiktok_clip(tiktok_source, tiktok_path)
            logger.info(
                "tiktok_video_ready",
                path=str(tiktok_path),
                source="reels" if reels_path else "youtube",
            )
        else:
            logger.info("tiktok_video_skipped", reason="generate_tiktok_clip=False")

        elapsed = time.monotonic() - t_start
        stats: dict = {
            "duration_seconds": duration_seconds,
            "processing_seconds": round(elapsed, 2),
            "youtube_size_mb": round(youtube_path.stat().st_size / 1_048_576, 2),
        }
        if tiktok_path is not None:
            stats["tiktok_size_mb"] = round(tiktok_path.stat().st_size / 1_048_576, 2)
        if reels_path and reels_path.exists():
            stats["reels_size_mb"] = round(reels_path.stat().st_size / 1_048_576, 2)

        return RecordingResult(
            youtube_path=youtube_path,
            tiktok_path=tiktok_path,
            reels_path=reels_path,
            stats=stats,
        )

    # ── Helpers ────────────────────────────────────────────────────────────────

    @staticmethod
    def _device_viewport_plan(fmt: "VideoFormat") -> dict:
        """Calcula los parámetros para grabar fmt (9:16) con el viewport CSS
        realista de settings.mobile_reference_viewport_width/height.

        NOTA: Playwright graba el video al tamaño CSS real del viewport
        (device_scale_factor NO escala la captura de video, solo afecta
        cosas como screenshots/densidad de raster — comprobado empíricamente:
        pedir un record_video_size mayor solo agrega relleno gris, no escala).
        Por eso el escalado al ancho final se hace con FFmpeg (-vf scale)
        después de grabar, no con device_scale_factor.

        NO se recorta a fmt.height exacto — el motor JS posiciona el texto
        usando el viewport real (390×844 ≈ 9:19.5, más angosto que 9:16), y
        recortar a 9:16 después cortaba el texto sin saber dónde había quedado
        (comprobado: con crop centrado el texto directamente desaparecía).
        El video final queda en la proporción real del celular de referencia
        (más alto que 9:16 estricto) — TikTok/Reels/Shorts aceptan ese rango
        de proporciones altas sin problema, y así no se pierde nada de lo que
        el layout ya posicionó correctamente.
        """
        device_w = settings.mobile_reference_viewport_width
        device_h = settings.mobile_reference_viewport_height
        scale = fmt.width / device_w
        scaled_w = round(device_w * scale / 2) * 2  # par, libx264 lo requiere; == fmt.width
        scaled_h = round(device_h * scale / 2) * 2
        return {
            "device_width": device_w,
            "device_height": device_h,
            "vf": f"scale={scaled_w}:{scaled_h}",
        }

    def _viewport_kwargs_for(self, fmt: "VideoFormat") -> tuple[dict, str | None]:
        """Devuelve (kwargs para _record_at_viewport, filtro -vf de escala o None).

        Si fmt.use_device_viewport (solo tiene efecto en 9:16): graba con el
        viewport CSS realista de _device_viewport_plan (tamaño crudo = el
        viewport de referencia) y devuelve el filtro que lo escala a un ancho
        de fmt.width (el alto final sale de la proporción real del viewport,
        no de fmt.height — ver _device_viewport_plan). Si no, graba directo a
        fmt.width×fmt.height como viewport (comportamiento actual, sin cambios).
        """
        if fmt.use_device_viewport and fmt.aspect_ratio == "9:16":
            plan = self._device_viewport_plan(fmt)
            return {"width": plan["device_width"], "height": plan["device_height"]}, plan["vf"]
        return {"width": fmt.width, "height": fmt.height}, None

    async def _record_at_viewport(
        self, page_url: str, output_dir: Path, duration_seconds: int, width: int, height: int
    ) -> Path:
        """Graba page_url (servida por HTTP, ver _serve_directory) con Playwright
        en un viewport CSS width×height. Devuelve el .webm crudo (mismas
        dimensiones que el viewport — el escalado a la resolución final, si
        hace falta, se hace después con FFmpeg, ver _device_viewport_plan)."""
        raw_webm = output_dir / "_raw.webm"
        logger.info("recording_start", url=page_url, duration=duration_seconds, width=width, height=height)
        recording_semaphore = _get_recording_semaphore()
        try:
            # Solo la captura en vivo (launch → esperar duration_seconds real →
            # close) queda serializada server-wide — todo lo anterior/posterior
            # a este bloque (fetch de recursos, encode, etc. de OTROS jobs) sigue
            # corriendo en paralelo según max_parallel_jobs.
            if recording_semaphore._value == 0:
                logger.info("recording_waiting_for_slot", url=page_url)
            report_step_progress(0.0)  # waiting for the recorder slot is not progress
            async with recording_semaphore:
                async with async_playwright() as pw:
                    launch_options: dict = {
                        "args": [
                            "--autoplay-policy=no-user-gesture-required",
                            "--disable-web-security",
                            "--no-sandbox",
                        ]
                    }
                    if settings.playwright_chromium_executable_path:
                        launch_options["executable_path"] = settings.playwright_chromium_executable_path
                    browser = await pw.chromium.launch(**launch_options)
                    context = await browser.new_context(
                        viewport={"width": width, "height": height},
                        record_video_dir=str(output_dir),
                        record_video_size={"width": width, "height": height},
                    )
                    page = await context.new_page()
                    # Loguear errores de JS/consola — si config.json (u otro fetch) falla
                    # en cargar, la página queda sin estilos y esto es lo único que lo delata.
                    page.on("pageerror", lambda exc: logger.warning("recording_page_error", url=page_url, error=str(exc)))
                    page.on("console", lambda msg: (
                        logger.warning("recording_console_error", url=page_url, text=msg.text)
                        if msg.type == "error" else None
                    ))
                    await page.goto(page_url)
                    await page.wait_for_load_state("domcontentloaded")
                    logger.info("recording_warmup", warmup_seconds=_WARMUP_SECONDS)
                    await _wait_reporting_progress(_WARMUP_SECONDS + duration_seconds)
                    await context.close()
                    await browser.close()
        except Exception as exc:
            raise RecordingError(f"Playwright recording failed: {exc}") from exc

        candidates = [f for f in output_dir.glob("*.webm") if f.name != raw_webm.name]
        if not candidates:
            raise RecordingError("Playwright did not produce a .webm file.")
        candidates[0].rename(raw_webm)
        logger.info("playwright_recording_done", webm=str(raw_webm))
        return raw_webm

    async def _encode(
        self, raw_webm: Path, audio_path: Path, dest_path: Path,
        *, crf: int, preset: str, vf: str | None = None,
    ) -> None:
        """Mezcla el .webm crudo con audio_path y codifica a H.264/AAC en dest_path.

        vf: filtro de video opcional (ej. un "scale=..." para escalar al
        ancho final cuando se grabó con un viewport CSS realista más chico —
        ver _device_viewport_plan).

        El encoder (software libx264 vs. hardware h264_vaapi) es
        settings.ffmpeg_video_encoder — ver esa doc para por qué no se
        auto-detecta. VAAPI libera casi toda la CPU durante el encode (medido:
        libx264 sube a ~600% CPU con los settings default), dejándola
        disponible para una grabación Playwright concurrente — ver el
        semáforo en _record_at_viewport.
        """
        args = ["-y"]
        use_vaapi = settings.ffmpeg_video_encoder == "h264_vaapi"
        if use_vaapi:
            args += ["-vaapi_device", settings.ffmpeg_vaapi_device]
        args += ["-i", str(raw_webm), "-i", str(audio_path)]

        if use_vaapi:
            # El decode del .webm crudo sigue siendo software (no hace falta
            # decode por hardware acá) — el filtro escala en CPU si hace falta
            # (vf) y recién después sube el frame a memoria de la GPU
            # (hwupload) para que el encoder lo tome.
            hw_filter = f"{vf},format=nv12,hwupload" if vf else "format=nv12,hwupload"
            args += ["-vf", hw_filter]
            args += [
                "-c:v", "h264_vaapi",
                # VAAPI no tiene -crf/-preset — -qp es el control de calidad
                # equivalente más cercano (misma escala aproximada 0-51 que el
                # crf de libx264, no idéntica — validar visualmente antes de
                # confiar en el mapeo 1:1).
                "-qp", str(crf),
            ]
        else:
            if vf:
                args += ["-vf", vf]
            args += [
                "-c:v", "libx264",
                "-crf", str(crf),
                "-preset", preset,
            ]

        args += [
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(dest_path),
        ]
        await self._run_ffmpeg(*args)

    async def _encode_looped(
        self, raw_webm: Path, audio_path: Path, dest_path: Path,
        *, crf: int, preset: str, duration_seconds: int, vf: str | None = None,
    ) -> None:
        """Como _encode, pero repite raw_webm en loop duro (-stream_loop) hasta
        cubrir duration_seconds — usado cuando raw_webm es un clip CORTO
        (generation_method='loop'), no la grabación completa. El audio se usa
        completo (no se repite); -t corta el resultado a duration_seconds exactos.
        """
        args = ["-y", "-stream_loop", "-1", "-i", str(raw_webm), "-i", str(audio_path)]
        if vf:
            args += ["-vf", vf]
        args += [
            "-c:v", "libx264",
            "-crf", str(crf),
            "-preset", preset,
            "-c:a", "aac",
            "-b:a", "192k",
            "-t", str(duration_seconds),
            str(dest_path),
        ]
        await self._run_ffmpeg(*args)

    async def _build_tiktok_clip(self, source_path: Path, dest_path: Path) -> None:
        """Recorta un clip de settings.tiktok_clip_duration_seconds con fade in/out."""
        fi = settings.tiktok_fade_in_seconds
        fo = settings.tiktok_fade_out_seconds
        clip_dur = settings.tiktok_clip_duration_seconds
        fade_out_start = clip_dur - fo - 1
        await self._run_ffmpeg(
            "-y",
            "-i", str(source_path),
            "-t", str(clip_dur),
            "-vf", f"fade=t=in:st=0:d={fi},fade=t=out:st={fade_out_start}:d={fo}",
            "-af", f"afade=t=in:st=0:d={fi},afade=t=out:st={fade_out_start}:d={fo}",
            "-c:v", "libx264",
            "-crf", "20",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "192k",
            str(dest_path),
        )

    @staticmethod
    async def _run_ffmpeg(*args: str) -> None:
        cmd = ["ffmpeg", *args]
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        _, stderr = await proc.communicate()
        if proc.returncode != 0:
            raise RecordingError(f"FFmpeg error:\n{stderr.decode()[-500:]}")

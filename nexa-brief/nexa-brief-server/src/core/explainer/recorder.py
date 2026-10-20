"""Grabación de videos del explainer-kit: render → output/<categoría>/ → programar o publicar.

Duraciones:
  - "10" / "20": preview de los primeros N segundos (rápido, para probar). Se
    guarda en output/.../preview-Ns/ y NUNCA se programa ni publica.
  - "full": video completo. Se guarda en output/<categoría>/<diseño>/<id>/,
    se registra como job empaquetado en job_tracker (así los horarios de la
    categoría lo recogen solos) y puede publicarse ahora.

Formatos: en una grabación normal se guardan los formatos marcados; en publicación
cada cuenta elige 16:9, 9:16 o ambos y se sube una publicación por formato.

Renders simultáneos: EXPLAINER_MAX_CONCURRENT_RECORDINGS (por defecto 1; CPU pesada). Publicar es opt-in y, por defecto,
en privado. El render y el publicador se inyectan para poder probar sin
renderizar ni subir nada real.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import sys
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Awaitable, Callable

import structlog

from src.config.settings import settings
from src.core.data import collection
from src.core import notification_tracker
from src.core.notification import Notification
from src.core.schedule import queue_repository
from src.core.explainer import thumbnails
from src.core.explainer.publishing.store import read_publish
from src.core.explainer.catalog import KIT_DIR, ExplainerVideo
from src.core.job import JobStage
from src.core.metadata.sanitize import strip_emojis
from src.core.publish_log import record_published_video
from src.modules.video_compressor import compress_for_publishing

logger = structlog.get_logger(__name__)

KIT_CLI: Path = KIT_DIR / "tools" / "kit.py"
FORMATS = ("9x16", "16x9")
DEFAULT_FORMATS = ("16x9",)   # desktop; 9:16 (móvil) solo si se pide
PREVIEW_SECONDS = ("10", "20")
DURATIONS = (*PREVIEW_SECONDS, "full")
# TikTok necesita vertical; YouTube y Facebook usan horizontal.
PLATFORM_FORMAT = {"tiktok": "9x16", "instagram": "9x16", "youtube": "16x9", "facebook": "16x9"}


def render_filename(video_id: str, fmt: str, seconds: int | None) -> str:
    """Nombre que escribe `kit.py render` (ver cmd_render): '<id>-<fmt>.mp4' o '<id>-<fmt>-<N>s.mp4'."""
    return f"{video_id}-{fmt}-{seconds}s.mp4" if seconds else f"{video_id}-{fmt}.mp4"


class RecordState(str, Enum):
    queued = "queued"
    rendering = "rendering"
    publishing = "publishing"
    done = "done"
    failed = "failed"


class RenderError(RuntimeError):
    pass


RenderRunner = Callable[[str, int | None, tuple[str, ...]], Awaitable[None]]
# Captura la miniatura de un video (thumbnails.render): (video, opciones) → {opción: archivo}
ThumbnailRenderer = Callable[[ExplainerVideo, tuple[str, ...]], Awaitable[dict[str, Path]]]


def resolve_formats(formats: list[str] | tuple[str, ...] | None, selectors: list[str]) -> tuple[str, ...]:
    """Formatos pedidos + los que exigen los canales elegidos, en el orden de FORMATS."""
    wanted = set(formats or DEFAULT_FORMATS)
    unknown = wanted - set(FORMATS)
    if unknown:
        raise ValueError(f"formato inválido: {', '.join(sorted(unknown))} (usa {', '.join(FORMATS)})")
    wanted |= {PLATFORM_FORMAT[s.split(":", 1)[0]] for s in selectors if s.split(":", 1)[0] in PLATFORM_FORMAT}
    return tuple(f for f in FORMATS if f in wanted)


async def run_kit_render(video_id: str, seconds: int | None, formats: tuple[str, ...] = FORMATS) -> None:
    """Llama a `kit.py render <id>`; con `seconds` hace un preview de ese largo."""
    cmd = [sys.executable, str(KIT_CLI), "render", video_id, "--formats", ",".join(formats)]
    if seconds:
        cmd += ["--seconds", str(seconds)]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )
    out, _ = await proc.communicate()
    if proc.returncode != 0:
        tail = out.decode("utf-8", "replace")[-800:]
        raise RenderError(f"kit.py render terminó con código {proc.returncode}: {tail}")


def _clean(text: str) -> str:
    """Sin emojis (regla de los canales), conservando los saltos de línea de la descripción."""
    return "\n".join(strip_emojis(line) for line in (text or "").split("\n"))


def _copy_for(video: ExplainerVideo, platform: str) -> tuple[str, str, list[str]]:
    """Título, descripción y tags propios de cada red (publish.json), con YouTube de respaldo."""
    if platform == "tiktok" and video.tiktok_caption:
        title, description, tags = video.tiktok_caption, video.tiktok_caption, video.tiktok_hashtags or video.youtube_tags
    elif platform in ("facebook", "instagram") and video.facebook_title:
        title, description, tags = video.facebook_title, video.facebook_description or video.youtube_description, video.youtube_tags
    else:
        title, description, tags = video.youtube_title, video.youtube_description, video.youtube_tags
    return _clean(title), _clean(description), [t for t in (strip_emojis(t) for t in tags) if t.strip("#")]


@dataclass
class RecordJob:
    job_id: str
    video_id: str
    category_path: str
    duration: str
    publish: bool
    privacy: str
    account_selector: str | None
    account_selectors: list[str] = field(default_factory=list)   # varios canales a la vez
    account_formats: dict[str, tuple[str, ...]] = field(default_factory=dict)
    formats: tuple[str, ...] = DEFAULT_FORMATS
    state: RecordState = RecordState.queued
    error: str | None = None
    outputs: list[str] = field(default_factory=list)
    output_dir: str | None = None
    scheduled_job_id: str | None = None
    publish_result: dict[str, Any] | None = None            # el primero (compatibilidad)
    publish_results: list[dict[str, Any]] = field(default_factory=list)
    render_seconds: float | None = None   # cuánto tardó la grabación (render + copia)
    thumbnail: str | None = None          # miniatura elegida ("A" introv1 / "B" introv2); None = la del paquete

    @property
    def seconds(self) -> int | None:
        return None if self.duration == "full" else int(self.duration)


class ExplainerRecorder:
    def __init__(
        self,
        render_runner: RenderRunner = run_kit_render,
        publisher_getter: Callable[[], Any] | None = None,
        output_root: Path | None = None,
        thumbnail_renderer: ThumbnailRenderer | None = None,
    ) -> None:
        self._render = render_runner
        # None = no se capturan miniaturas (tests); la API pasa thumbnails.render
        self._render_thumbnail = thumbnail_renderer
        self._publisher_getter = publisher_getter
        self._output_root = output_root or settings.output_dir
        self._slots = asyncio.Semaphore(max(1, settings.explainer_max_concurrent_recordings))
        self._jobs: dict[str, RecordJob] = {}
        self._tasks: set[asyncio.Task] = set()

    def get_job(self, job_id: str) -> RecordJob | None:
        return self._jobs.get(job_id)

    def latest_for_video(self, video_id: str) -> RecordJob | None:
        matches = [j for j in self._jobs.values() if j.video_id == video_id]
        return matches[-1] if matches else None

    def submit(
        self,
        video: ExplainerVideo,
        *,
        duration: str = "10",
        publish: bool = False,
        privacy: str = "private",
        account_selector: str | None = None,
        account_selectors: list[str] | None = None,
        formats: list[str] | tuple[str, ...] | None = None,
        account_formats: dict[str, list[str] | tuple[str, ...]] | None = None,
        thumbnail: str | None = None,
    ) -> RecordJob:
        # un canal (account_selector) o varios (account_selectors), sin repetir
        selectors = list(dict.fromkeys([*(account_selectors or []), *([account_selector] if account_selector else [])]))
        if not video.ready:
            raise ValueError(f"{video.video_id} no está listo (estado: {video.status})")
        if duration not in DURATIONS:
            raise ValueError(f"duración inválida: {duration} (usa {', '.join(DURATIONS)})")
        if privacy not in ("private", "unlisted", "public"):
            raise ValueError(f"privacidad inválida: {privacy}")
        if publish:
            if duration != "full":
                raise ValueError("publicar requiere una grabación completa (duration='full')")
            if not video.publish_ready:
                raise ValueError(f"{video.video_id} no tiene youtube_title en publish.json")
            if not selectors:
                raise ValueError("publish=true requiere al menos un canal ('youtube:alias', ...)")
            for selector in selectors:
                platform = selector.split(":", 1)[0]
                if platform not in PLATFORM_FORMAT:
                    raise ValueError(f"plataforma no soportada: {platform}")
        resolved_account_formats: dict[str, tuple[str, ...]] = {}
        if publish and account_formats is not None:
            for selector in selectors:
                selected = set(account_formats[selector] if selector in account_formats else ("16x9",))
                unknown = selected - set(FORMATS)
                if unknown:
                    raise ValueError(f"formato inválido para {selector}: {', '.join(sorted(unknown))}")
                if not selected:
                    raise ValueError(f"elige al menos un formato para {selector}")
                resolved_account_formats[selector] = tuple(fmt for fmt in FORMATS if fmt in selected)
            resolved_formats = tuple(
                fmt for fmt in FORMATS
                if any(fmt in values for values in resolved_account_formats.values())
            )
        else:
            resolved_formats = resolve_formats(formats, selectors if publish else [])
            if publish:
                resolved_account_formats = {
                    selector: (PLATFORM_FORMAT[selector.split(":", 1)[0]],)
                    for selector in selectors
                }
        if thumbnail is not None:
            thumbnails.choose(video, thumbnail)   # ThumbnailError (ValueError) si no está disponible

        job = RecordJob(
            job_id=uuid.uuid4().hex[:12],
            video_id=video.video_id,
            category_path=video.category_path,
            duration=duration,
            publish=publish,
            privacy=privacy,
            account_selector=selectors[0] if selectors else None,
            account_selectors=selectors,
            account_formats=resolved_account_formats,
            formats=resolved_formats,
            thumbnail=thumbnail,
        )
        self._jobs[job.job_id] = job
        task = asyncio.create_task(self._run(job, video))
        self._tasks.add(task)
        task.add_done_callback(self._tasks.discard)
        return job

    async def wait(self, job_id: str) -> RecordJob:
        """Espera a que un job termine (útil en tests y scripts)."""
        while True:
            job = self._jobs[job_id]
            if job.state in (RecordState.done, RecordState.failed):
                return job
            await asyncio.sleep(0.01)

    async def _run(self, job: RecordJob, video: ExplainerVideo) -> None:
        async with self._slots:
            try:
                await self._run_locked(job, video)
            except Exception as exc:  # noqa: BLE001 - el job guarda el error
                job.state = RecordState.failed
                job.error = str(exc)[-800:]
                logger.error("explainer_record_failed", video_id=job.video_id, error=job.error)
            finally:
                if job.duration == "full":
                    successful = sum(bool(r.get("url")) for r in job.publish_results)
                    failed = len(job.publish_results) - successful
                    if job.state == RecordState.failed:
                        title, severity = "Falló la grabación o publicación", "error"
                    elif failed:
                        title, severity = "Publicación parcial", "warning"
                    elif job.publish:
                        title, severity = "Video publicado", "info"
                    else:
                        title, severity = "Video listo", "info"
                    message = (
                        f"{video.youtube_title or video.title}: {successful} publicación(es) realizadas, "
                        f"{failed} fallidas."
                        if job.publish else f"{video.youtube_title or video.title} terminó de grabarse."
                    )
                    try:
                        await notification_tracker.create(Notification(
                            type="video_failed" if job.state == RecordState.failed else "video_ready",
                            severity=severity, title=title, message=message,
                            job_id=job.scheduled_job_id,
                        ))
                    except Exception as exc:  # una notificación no debe alterar el resultado
                        logger.warning("explainer_notification_failed", video_id=job.video_id, error=str(exc))

    async def _run_locked(self, job: RecordJob, video: ExplainerVideo) -> None:
        started = time.monotonic()
        render_dir = video.path / "render"
        seconds = job.seconds
        src_dir = render_dir / "preview" if seconds else render_dir

        job.state = RecordState.rendering
        missing = tuple(f for f in job.formats if not (src_dir / render_filename(video.video_id, f, seconds)).exists())
        if missing:
            await self._render(video.video_id, seconds, missing)

        out_dir = self._output_root / video.category_path / video.design / video.video_id
        if seconds:
            out_dir = out_dir / f"preview-{seconds}s"
        else:
            # una carpeta por grabación: grabar de nuevo no pisa (ni borrar uno se lleva) los archivos
            # de una grabación anterior que sigue en la Biblioteca
            recording_id = uuid.uuid4().hex[:8]
            out_dir = out_dir / recording_id
        out_dir.mkdir(parents=True, exist_ok=True)
        job.output_dir = str(out_dir)
        for fmt in job.formats:
            src = src_dir / render_filename(video.video_id, fmt, seconds)
            if not src.exists():
                raise RenderError(f"falta el archivo renderizado: {src.name}")
            dst = out_dir / src.name
            shutil.copy2(src, dst)
            job.outputs.append(str(dst))

        if seconds:
            job.render_seconds = round(time.monotonic() - started, 1)
            job.state = RecordState.done
            return
        # La copia que se publica va comprimida; el original sigue en render/ (no hace falta master).
        for output in job.outputs:
            await compress_for_publishing(Path(output), keep_master=False)
        job.render_seconds = round(time.monotonic() - started, 1)

        thumbnail = await self._thumbnail(video, out_dir)
        job.scheduled_job_id = await self._register_for_scheduling(
            video, out_dir, job.formats, job.render_seconds, thumbnail, recording_id=recording_id
        )

        if not job.publish:
            job.state = RecordState.done
            return

        job.state = RecordState.publishing
        facade = self._publisher_getter()
        failures: list[str] = []
        pinned_comment = _clean(read_publish(video.path).get("pinned_comment") or "")
        published_count = 0
        for selector in job.account_selectors:
            platform, alias = selector.split(":", 1)
            title, description, tags = _copy_for(video, platform)
            selected_formats = job.account_formats.get(selector) or (PLATFORM_FORMAT[platform],)
            for fmt in selected_formats:
                extra = {"thumbnail_path": thumbnail} if platform == "youtube" and thumbnail else {}
                if platform == "youtube" and pinned_comment:
                    extra["comment_text"] = pinned_comment
                queue_entry = await queue_repository.start_direct(
                    job.scheduled_job_id, platform, alias, format=fmt
                )
                try:
                    result = await facade.publish_video(
                        video_path=out_dir / f"{video.video_id}-{fmt}.mp4",
                        title=title,
                        description=description,
                        tags=tags,
                        account_selector=selector,
                        privacy=job.privacy,
                        **extra,
                    )
                except Exception as exc:  # noqa: BLE001 - un canal caído no frena a los demás
                    failures.append(f"{selector} ({fmt}): {exc}")
                    job.publish_results.append({
                        "account_selector": selector, "format": fmt, "error": str(exc)[:300]
                    })
                    await queue_repository.mark_failed(queue_entry.entry_id, str(exc)[:500])
                    logger.error(
                        "explainer_publish_failed", video_id=job.video_id, selector=selector,
                        format=fmt, error=str(exc),
                    )
                    continue
                entry = {
                    "account_selector": selector, "format": fmt,
                    "post_id": result.post_id, "url": result.url,
                    "platform": result.platform, "account_alias": result.account_alias,
                }
                published_count += 1
                job.publish_results.append(entry)
                job.publish_result = job.publish_result or entry
                await queue_repository.mark_published(queue_entry.entry_id, result.post_id, result.url)
                await record_published_video(
                    platform=result.platform, alias=result.account_alias,
                    post_id=result.post_id, url=result.url, title=title,
                    job_id=job.scheduled_job_id,
                )
                if platform == "youtube" and pinned_comment and result.raw_response.get("comment_posted") is False:
                    try:
                        await notification_tracker.create(Notification(
                            type="video_failed", severity="warning", title="Comentario de YouTube pendiente",
                            message=f"El video se publicó en YouTube, pero no se pudo añadir el comentario: {result.url}",
                            job_id=job.scheduled_job_id, account_alias=alias,
                        ))
                    except Exception as exc:
                        logger.warning("explainer_comment_notification_failed", error=str(exc))
        if failures and published_count == 0:
            raise RuntimeError("no se publicó en ningún canal: " + "; ".join(failures))
        job.error = "; ".join(failures) or None
        job.state = RecordState.done

    async def _thumbnail(self, video: ExplainerVideo, out_dir: Path) -> Path | None:
        """Captura de nuevo la miniatura elegida (los textos pueden haber cambiado) y la copia a la salida.

        Si el diseño no tiene intros o la captura falla, el video se graba igual, sin miniatura propia.
        """
        option = thumbnails.chosen_option(video)
        if self._render_thumbnail is None or option not in thumbnails.intro_specs(video):
            return None
        try:
            await self._render_thumbnail(video, (option,))
        except thumbnails.ThumbnailError as exc:
            logger.warning("explainer_thumbnail_failed", video_id=video.video_id, error=str(exc))
            return None
        dest = out_dir / "thumbnail.jpg"
        shutil.copy2(thumbnails.thumbnail_file(video, option), dest)
        return dest

    async def _register_for_scheduling(
        self, video: ExplainerVideo, out_dir: Path, formats: tuple[str, ...], render_seconds: float,
        thumbnail: Path | None = None,
        recording_id: str | None = None,
    ) -> str:
        """Registra la grabación completa como job empaquetado en job_tracker.

        Así los horarios de la categoría (slot.niche_filter = 'node_tech', etc.)
        la encuentran con el mismo `_pick_oldest_ready_job` que los videos del
        pipeline, y `publish_entry` resuelve su archivo y su texto.
        """
        job_id = f"explainer-{video.video_id}-{recording_id or uuid.uuid4().hex[:8]}"
        logs = out_dir / "logs"
        logs.mkdir(parents=True, exist_ok=True)
        # mismos textos (y misma limpieza) que la publicación inmediata
        copies = {platform: _copy_for(video, platform) for platform in ("youtube", "facebook", "tiktok", "instagram")}
        if not video.tiktok_caption:   # sin caption propio, TikTok lleva el título (no la descripción larga)
            text = _clean(video.youtube_title)
            tags = [h for h in (strip_emojis(h) for h in video.tiktok_hashtags or video.youtube_tags) if h.strip("#")]
            copies["tiktok"] = (text, text, tags)
        summary = {
            "job_id": job_id,
            "video_id": video.video_id,
            "pinned_comment": _clean(read_publish(video.path).get("pinned_comment") or ""),
            "platform_copies": {
                platform: {"title": title, "description": description, "tags": tags}
                for platform, (title, description, tags) in copies.items()
            },
        }
        (logs / "08_resumen_final.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

        now = datetime.now(timezone.utc)
        # La Biblioteca muestra "Generado en …" con generation_seconds: acá es el tiempo de grabación.
        created = datetime.fromtimestamp(now.timestamp() - render_seconds, timezone.utc).isoformat()
        file_paths = {
            platform: str(out_dir / f"{video.video_id}-{fmt}.mp4")
            for platform, fmt in (("youtube", "16x9"), ("tiktok", "9x16"), ("instagram", "9x16"))
            if fmt in formats
        }
        if "9x16" in formats:
            file_paths["reels"] = str(out_dir / f"{video.video_id}-9x16.mp4")
        if thumbnail:
            file_paths["thumbnail"] = str(thumbnail)   # la sube publish_entry al publicar en YouTube
        await collection("jobs").insert({
            "job_id": job_id,
            "category": video.category_path,
            "title": video.youtube_title or video.title,
            "stage": JobStage.PACKAGED.value,
            "output_dir": str(out_dir),
            "errors": [],
            "created_at": created,
            "updated_at": now.isoformat(),
            "generation_seconds": render_seconds,
            "duration_seconds": video.duration_seconds,
            "file_paths": file_paths,
            "format_paths": {
                fmt: str(out_dir / f"{video.video_id}-{fmt}.mp4") for fmt in formats
            },
            "ready_formats": [k for k in file_paths if k != "thumbnail"],
            "formats": list(formats),
            "source": "explainer",
            "video_id": video.video_id,
            "design": video.design,
        })
        logger.info("explainer_job_registered", job_id=job_id, category=video.category_path)
        return job_id

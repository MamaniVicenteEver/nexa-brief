"""Grabación de videos del explainer-kit: render → output/<categoría>/ → programar o publicar.

Duraciones:
  - "10" / "20": preview de los primeros N segundos (rápido, para probar). Se
    guarda en output/.../preview-Ns/ y NUNCA se programa ni publica.
  - "full": video completo. Se guarda en output/<categoría>/<diseño>/<id>/,
    se registra como job empaquetado en job_tracker (así los horarios de la
    categoría lo recogen solos) y puede publicarse ahora.

Un solo render a la vez (CPU pesada). Publicar es opt-in y, por defecto,
en privado. El render y el publicador se inyectan para poder probar sin
renderizar ni subir nada real.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import sys
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Awaitable, Callable

import structlog

from src.config.settings import settings
from src.core.data import collection
from src.core.explainer.catalog import KIT_DIR, ExplainerVideo
from src.core.job import JobStage
from src.core.publish_log import record_published_video

logger = structlog.get_logger(__name__)

KIT_CLI: Path = KIT_DIR / "tools" / "kit.py"
FORMATS = ("9x16", "16x9")
PREVIEW_SECONDS = ("10", "20")
DURATIONS = (*PREVIEW_SECONDS, "full")
# TikTok necesita vertical; YouTube y Facebook usan horizontal.
PLATFORM_FORMAT = {"tiktok": "9x16", "youtube": "16x9", "facebook": "16x9"}


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


RenderRunner = Callable[[str, int | None], Awaitable[None]]


async def run_kit_render(video_id: str, seconds: int | None) -> None:
    """Llama a `kit.py render <id>`; con `seconds` hace un preview de ese largo."""
    cmd = [sys.executable, str(KIT_CLI), "render", video_id, "--formats", ",".join(FORMATS)]
    if seconds:
        cmd += ["--seconds", str(seconds)]
    proc = await asyncio.create_subprocess_exec(
        *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT
    )
    out, _ = await proc.communicate()
    if proc.returncode != 0:
        tail = out.decode("utf-8", "replace")[-800:]
        raise RenderError(f"kit.py render terminó con código {proc.returncode}: {tail}")


def _copy_for(video: ExplainerVideo, platform: str) -> tuple[str, str, list[str]]:
    """Título, descripción y tags propios de cada red (publish.json), con YouTube de respaldo."""
    if platform == "tiktok" and video.tiktok_caption:
        return video.tiktok_caption, video.tiktok_caption, video.tiktok_hashtags or video.youtube_tags
    if platform == "facebook" and video.facebook_title:
        return video.facebook_title, video.facebook_description or video.youtube_description, video.youtube_tags
    return video.youtube_title, video.youtube_description, video.youtube_tags


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
    state: RecordState = RecordState.queued
    error: str | None = None
    outputs: list[str] = field(default_factory=list)
    output_dir: str | None = None
    scheduled_job_id: str | None = None
    publish_result: dict[str, Any] | None = None            # el primero (compatibilidad)
    publish_results: list[dict[str, Any]] = field(default_factory=list)

    @property
    def seconds(self) -> int | None:
        return None if self.duration == "full" else int(self.duration)


class ExplainerRecorder:
    def __init__(
        self,
        render_runner: RenderRunner = run_kit_render,
        publisher_getter: Callable[[], Any] | None = None,
        output_root: Path | None = None,
    ) -> None:
        self._render = render_runner
        self._publisher_getter = publisher_getter
        self._output_root = output_root or settings.output_dir
        self._lock = asyncio.Lock()
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

        job = RecordJob(
            job_id=uuid.uuid4().hex[:12],
            video_id=video.video_id,
            category_path=video.category_path,
            duration=duration,
            publish=publish,
            privacy=privacy,
            account_selector=selectors[0] if selectors else None,
            account_selectors=selectors,
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
        async with self._lock:
            try:
                await self._run_locked(job, video)
            except Exception as exc:  # noqa: BLE001 - el job guarda el error
                job.state = RecordState.failed
                job.error = str(exc)[-800:]
                logger.error("explainer_record_failed", video_id=job.video_id, error=job.error)

    async def _run_locked(self, job: RecordJob, video: ExplainerVideo) -> None:
        render_dir = video.path / "render"
        seconds = job.seconds
        src_dir = render_dir / "preview" if seconds else render_dir

        job.state = RecordState.rendering
        if not all((src_dir / render_filename(video.video_id, f, seconds)).exists() for f in FORMATS):
            await self._render(video.video_id, seconds)

        out_dir = self._output_root / video.category_path / video.design / video.video_id
        if seconds:
            out_dir = out_dir / f"preview-{seconds}s"
        out_dir.mkdir(parents=True, exist_ok=True)
        job.output_dir = str(out_dir)
        for fmt in FORMATS:
            src = src_dir / render_filename(video.video_id, fmt, seconds)
            if not src.exists():
                raise RenderError(f"falta el archivo renderizado: {src.name}")
            dst = out_dir / src.name
            shutil.copy2(src, dst)
            job.outputs.append(str(dst))

        if seconds:
            job.state = RecordState.done
            return

        job.scheduled_job_id = await self._register_for_scheduling(video, out_dir)

        if not job.publish:
            job.state = RecordState.done
            return

        job.state = RecordState.publishing
        facade = self._publisher_getter()
        failures: list[str] = []
        for selector in job.account_selectors:
            platform = selector.split(":", 1)[0]
            title, description, tags = _copy_for(video, platform)
            try:
                result = await facade.publish_video(
                    video_path=out_dir / f"{video.video_id}-{PLATFORM_FORMAT[platform]}.mp4",
                    title=title,
                    description=description,
                    tags=tags,
                    account_selector=selector,
                    privacy=job.privacy,
                )
            except Exception as exc:  # noqa: BLE001 - un canal caído no frena a los demás
                failures.append(f"{selector}: {exc}")
                job.publish_results.append({"account_selector": selector, "error": str(exc)[:300]})
                logger.error("explainer_publish_failed", video_id=video.video_id, selector=selector, error=str(exc))
                continue
            entry = {
                "account_selector": selector,
                "post_id": result.post_id,
                "url": result.url,
                "platform": result.platform,
                "account_alias": result.account_alias,
            }
            job.publish_results.append(entry)
            job.publish_result = job.publish_result or entry
            await record_published_video(
                platform=result.platform,
                alias=result.account_alias,
                post_id=result.post_id,
                url=result.url,
                title=title,
            )
        if failures and len(failures) == len(job.account_selectors):
            raise RuntimeError("no se publicó en ningún canal: " + "; ".join(failures))
        job.error = "; ".join(failures) or None
        job.state = RecordState.done

    async def _register_for_scheduling(self, video: ExplainerVideo, out_dir: Path) -> str:
        """Registra la grabación completa como job empaquetado en job_tracker.

        Así los horarios de la categoría (slot.niche_filter = 'node_tech', etc.)
        la encuentran con el mismo `_pick_oldest_ready_job` que los videos del
        pipeline, y `publish_entry` resuelve su archivo y su texto.
        """
        job_id = f"explainer-{video.video_id}-{uuid.uuid4().hex[:8]}"
        logs = out_dir / "logs"
        logs.mkdir(parents=True, exist_ok=True)
        copy = {
            "title": video.youtube_title,
            "description": video.youtube_description,
            "tags": video.youtube_tags,
        }
        tiktok_text = video.tiktok_caption or video.youtube_title
        summary = {
            "job_id": job_id,
            "video_id": video.video_id,
            "platform_copies": {
                "youtube": copy,
                "facebook": {
                    "title": video.facebook_title or video.youtube_title,
                    "description": video.facebook_description or video.youtube_description,
                    "tags": video.youtube_tags,
                },
                "tiktok": {
                    "title": tiktok_text,
                    "description": tiktok_text,
                    "tags": video.tiktok_hashtags or video.youtube_tags,
                },
            },
        }
        (logs / "08_resumen_final.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")

        now = datetime.now(timezone.utc).isoformat()
        await collection("jobs").insert({
            "job_id": job_id,
            "category": video.category_path,
            "title": video.youtube_title or video.title,
            "stage": JobStage.PACKAGED.value,
            "output_dir": str(out_dir),
            "errors": [],
            "created_at": now,
            "updated_at": now,
            "duration_seconds": video.duration_seconds,
            "file_paths": {
                "youtube": str(out_dir / f"{video.video_id}-16x9.mp4"),
                "tiktok": str(out_dir / f"{video.video_id}-9x16.mp4"),
            },
            "ready_formats": ["youtube", "tiktok"],
            "source": "explainer",
            "video_id": video.video_id,
            "design": video.design,
        })
        logger.info("explainer_job_registered", job_id=job_id, category=video.category_path)
        return job_id

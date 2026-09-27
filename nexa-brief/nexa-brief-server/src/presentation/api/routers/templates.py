"""Templates router — listado de plantillas + preview en vivo (sin grabar).

El preview corre el pipeline SOLO hasta HTML_GENERATED (antes de
video_recorder/packager) — ver `pipeline.run(..., stop_after=...)`. Fire-and-
forget, igual que /videos/upload, pero trackeado en memoria (`preview_tracker`,
NO `job_tracker`) porque un intento de preview es descartable y no debe
aparecer en Biblioteca/historial de videos reales.
"""

from __future__ import annotations

import asyncio
import mimetypes
from pathlib import Path

import structlog
from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile
from starlette.responses import Response

from src.config.niche_config import NicheConfig, find_niche_by_template_id, list_all_niches
from src.config.template_manifest import (
    get_template_asset_dir,
    get_template_display_name,
    get_template_native_orientation,
    get_template_paths,
    get_template_preview_assets,
)
from src.core import pipeline, preview_tracker
from src.core.job import JobStage, SongInfo
from src.core.orchestrator import Orchestrator
from src.presentation.api.file_streaming import serve_file_with_range
from src.presentation.api.resource_sources import (
    resolve_image_source,
    resolve_music_source,
    resolve_video_source,
)
from src.presentation.api.schemas.template_schema import (
    PREVIEW_ALLOWED_FILENAMES,
    PreviewStatusResponse,
    TemplatePreviewAcceptedResponse,
    TemplateResponse,
)

router = APIRouter(tags=["templates"])
logger = structlog.get_logger(__name__)

_preview_tasks: set[asyncio.Task] = set()


def _log_preview_task_exception(task: asyncio.Task) -> None:
    _preview_tasks.discard(task)
    if task.cancelled():
        return
    exc = task.exception()
    if exc is not None:
        logger.error("preview_task_failed", error=str(exc))


def _build_template_response(niche: NicheConfig) -> TemplateResponse:
    template_id = niche.template.template_id

    # src/templates/templates.json es la única fuente de verdad para nombre,
    # descripción y orientación pública de cada template — reemplaza el
    # manifest.json por carpeta (retirado) y el display_name de niches.json,
    # que solían tener textos distintos entre sí.
    display_name = get_template_display_name(template_id, fallback=niche.display_name)
    native_orientation = get_template_native_orientation(template_id)
    preview_assets = get_template_preview_assets(template_id)

    def asset_url(kind: str) -> str | None:
        path = preview_assets[kind]
        asset_dir = get_template_asset_dir(template_id)
        if path is None or asset_dir is None:
            return None
        relative_path = path.relative_to(asset_dir).as_posix()
        return f"/api/v1/templates/{template_id}/asset/{relative_path}"

    return TemplateResponse(
        template_id=template_id,
        niche_id=niche.id,
        display_name=display_name,
        native_orientation=native_orientation,
        requires_image=niche.template.requires_image,
        requires_video=niche.template.requires_video,
        requires_lyrics=niche.template.requires_lyrics,
        active=niche.active,
        preview_image_url=asset_url("image"),
        preview_video_url=asset_url("video"),
        preview_audio_url=asset_url("audio"),
        showcase_url=(
            f"/api/v1/templates/{template_id}/showcase/index.html"
            if get_template_paths(template_id)["index_html"] is not None
            else None
        ),
    )


@router.get("/templates", response_model=list[TemplateResponse])
async def list_templates() -> list[TemplateResponse]:
    return [
        _build_template_response(n)
        for n in list_all_niches()
        if n.active and n.pipeline_type == "config_driven_template"
    ]


@router.get("/templates/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: str) -> TemplateResponse:
    niche = find_niche_by_template_id(template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")
    return _build_template_response(niche)


@router.get("/templates/{template_id}/asset/{asset_path:path}")
async def get_template_asset(template_id: str, asset_path: str, request: Request) -> Response:
    """Sirve solo los assets seleccionados como preview para esa plantilla."""
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    preview_assets = get_template_preview_assets(template_id)
    allowed_paths = {
        path.resolve()
        for path in preview_assets.values()
        if path is not None
    }
    root = asset_dir.resolve()
    path = (root / asset_path).resolve()
    if not path.is_relative_to(root) or path not in allowed_paths or not path.exists():
        raise HTTPException(status_code=404, detail="Preview asset not available")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)


_HIDE_RECORDER_STYLE = "<style>#rec-btn,#rec-panel{display:none!important}</style>"


@router.get("/templates/{template_id}/showcase/{file_path:path}")
async def get_template_showcase_file(template_id: str, file_path: str, request: Request) -> Response:
    """Sirve el HTML real de la plantilla y sus assets versionados."""
    asset_dir = get_template_asset_dir(template_id)
    if asset_dir is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    template_root = asset_dir.parent.resolve()
    path = (template_root / file_path).resolve()
    allowed_suffixes = {
        ".html", ".json", ".mp3", ".mp4", ".webm", ".mov", ".jpg", ".jpeg",
        ".png", ".webp", ".svg", ".woff", ".woff2", ".ttf",
    }
    if (
        not path.is_relative_to(template_root)
        or path.suffix.lower() not in allowed_suffixes
        or not path.is_file()
    ):
        raise HTTPException(status_code=404, detail="Showcase file not available")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    if path.suffix.lower() in {".html", ".json"}:
        content = path.read_text(encoding="utf-8")
        if path.suffix.lower() == ".html":
            preview_script = ""
            if request.query_params.get("preview") == "card" or request.query_params.get("controls") == "1":
                preview_script = """
<script>
(() => {
  const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window);
  const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  const nativePlay = HTMLMediaElement.prototype.play;
  const queuedFrames = new Map();
  const queryParams = new URLSearchParams(window.location.search);
  const isCardPreview = queryParams.get("preview") === "card";
  const isControlledPreview = queryParams.get("controls") === "1";
  const requestedLimit = Number(queryParams.get("limit"));
  const maxDuration = Number.isFinite(requestedLimit) && requestedLimit > 0
    ? requestedLimit
    : Number.POSITIVE_INFINITY;
  const initialPlaying = !isCardPreview;
  let requestedPlaying = initialPlaying;
  let isPlaying = initialPlaying;

  const previewStyle = document.createElement("style");
  previewStyle.textContent = `
    html[data-nexa-preview-paused] *,
    html[data-nexa-preview-paused] *::before,
    html[data-nexa-preview-paused] *::after {
      animation-play-state: paused !important;
      transition: none !important;
    }
  `;
  document.head.appendChild(previewStyle);

  window.requestAnimationFrame = (callback) => {
    const id = nativeRequestAnimationFrame((time) => {
      if (!isPlaying) {
        queuedFrames.set(id, callback);
        return;
      }
      queuedFrames.delete(id);
      callback(time);
    });
    return id;
  };

  window.cancelAnimationFrame = (id) => {
    queuedFrames.delete(id);
    nativeCancelAnimationFrame(id);
  };

  window.setInterval = (callback, delay, ...args) => nativeSetInterval(() => {
    if (isPlaying) callback(...args);
  }, delay);

  HTMLMediaElement.prototype.play = function () {
    if (this.tagName === "VIDEO" || isCardPreview) {
      this.muted = true;
      this.volume = 0;
    }
    if (!isPlaying) {
      this.pause();
      return Promise.resolve();
    }
    return nativePlay.call(this);
  };

  const setMediaPlaying = (playing) => {
    document.querySelectorAll("audio, video").forEach((media) => {
      if (media.tagName === "VIDEO" || isCardPreview) {
        media.muted = true;
        media.volume = 0;
      }
      if (playing) {
        void media.play().catch(() => {});
      } else {
        media.pause();
      }
      });
  };

  const getPrimaryMedia = () => document.querySelector("audio") || document.querySelector("video");

  const reportMediaTime = (media) => {
    if (!isControlledPreview) return;
    window.parent.postMessage({
      type: "nexa-template-time",
      currentTime: Number.isFinite(media.currentTime) ? media.currentTime : 0,
      duration: Number.isFinite(media.duration) ? media.duration : 0,
    }, "*");
  };

  const finishPreview = () => {
    if (!isControlledPreview) return;
    setPlaying(false);
    window.parent.postMessage({ type: "nexa-template-ended" }, "*");
  };

  const seekMedia = (time) => {
    const media = getPrimaryMedia();
    if (!media) return;
    const duration = Number.isFinite(media.duration) && media.duration > 0
      ? Math.min(media.duration, maxDuration)
      : maxDuration;
    const nextTime = Math.max(0, Math.min(Number(time) || 0, duration));
    media.currentTime = nextTime;
    reportMediaTime(media);
    if (nextTime >= maxDuration) finishPreview();
  };

  const setPlaying = (playing) => {
    isPlaying = playing;
    document.documentElement.toggleAttribute("data-nexa-preview-paused", !playing);
    setMediaPlaying(playing);

    if (playing) {
      const callbacks = [...queuedFrames.values()];
      queuedFrames.clear();
      callbacks.forEach((callback) => {
        nativeRequestAnimationFrame((time) => callback(time));
      });
    }
  };

  window.addEventListener("message", (event) => {
    if (event.data?.type === "nexa-template-seek") {
      seekMedia(event.data.time);
      return;
    }

    if (event.data?.type === "nexa-template-skip") {
      const media = getPrimaryMedia();
      if (media) seekMedia(media.currentTime + (Number(event.data.seconds) || 0));
      return;
    }

    if (
      event.data?.type !== "nexa-template-preview" &&
      event.data?.type !== "nexa-template-playback"
    ) return;
    requestedPlaying = event.data.playing === true;
    setPlaying(requestedPlaying);
  });

  document.addEventListener("timeupdate", (event) => {
    if (!isControlledPreview || !(event.target instanceof HTMLMediaElement)) return;
    if (event.target !== getPrimaryMedia()) return;
    reportMediaTime(event.target);
    if (event.target.currentTime >= maxDuration) finishPreview();
  }, true);

  document.addEventListener("loadedmetadata", (event) => {
    if (event.target instanceof HTMLMediaElement && event.target === getPrimaryMedia()) {
      reportMediaTime(event.target);
    }
  }, true);

  document.addEventListener("ended", (event) => {
    if (event.target instanceof HTMLMediaElement && event.target === getPrimaryMedia()) {
      finishPreview();
    }
  }, true);

  window.addEventListener(
    "load",
    () => window.setTimeout(() => setPlaying(requestedPlaying), 100),
    { once: true },
  );
})();
</script>
"""

            mute_script = """
<script>
(() => {
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this.tagName === "AUDIO") {
      this.muted = true;
      this.volume = 0;
    }
    return play.call(this);
  };
  document.querySelectorAll("audio").forEach((audio) => {
    audio.muted = true;
    audio.volume = 0;
  });
})();
</script>
"""
            volume_script = """
<script>
(() => {
  let volume = Number(new URLSearchParams(window.location.search).get("volume"));
  if (!Number.isFinite(volume)) volume = 0.05;
  volume = Math.max(0, Math.min(1, volume));
  let muted = false;

  const applyVolume = (media) => {
    if (media.tagName === "VIDEO") {
      media.muted = true;
      media.volume = 0;
      return;
    }
    media.volume = volume;
    media.muted = muted;
  };

  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    applyVolume(this);
    return play.call(this);
  };

  const applyToAllMedia = () => {
    document.querySelectorAll("audio, video").forEach(applyVolume);
  };

  document.addEventListener("play", (event) => {
    if (event.target instanceof HTMLMediaElement) applyVolume(event.target);
  }, true);

  window.addEventListener("message", (event) => {
    if (event.data?.type !== "nexa-template-volume") return;
    volume = Math.max(0, Math.min(1, Number(event.data.volume) || 0));
    muted = event.data.muted === true;
    applyToAllMedia();
  });

  document.addEventListener("DOMContentLoaded", applyToAllMedia, { once: true });
  window.addEventListener("load", applyToAllMedia, { once: true });
  applyToAllMedia();
})();
</script>
"""
            scripts = ""
            if request.query_params.get("preview") == "card" or request.query_params.get("controls") == "1":
                scripts += preview_script
            if request.query_params.get("muted") == "1":
                scripts += mute_script
            if request.query_params.get("controls") == "1":
                scripts += volume_script
            if request.query_params.get("norec") == "1":
                # Vista de solo lectura (ej. la landing): oculta el motor de
                # grabación que trae cada plantilla, sin tocar sus index.html.
                scripts += _HIDE_RECORDER_STYLE
            if scripts:
                content = content.replace("</head>", f"{scripts}</head>", 1)
        return Response(content=content, media_type=media_type)
    return serve_file_with_range(path, request.headers.get("range"), media_type)


@router.post("/templates/{template_id}/preview", response_model=TemplatePreviewAcceptedResponse, status_code=202)
async def create_template_preview(
    template_id: str,
    user_context: str | None = Form(default=None, max_length=500),
    song_name: str | None = Form(default=None),
    artist: str | None = Form(default=None),
    topic: str | None = Form(default=None),
    song_description: str | None = Form(default=None),
    language: str | None = Form(default=None),
    image_file: UploadFile | None = File(default=None),
    music_file: UploadFile | None = File(default=None),
    video_file: UploadFile | None = File(default=None),
    image_asset_id: str | None = Form(default=None),
    music_asset_id: str | None = Form(default=None),
    video_asset_id: str | None = Form(default=None),
) -> TemplatePreviewAcceptedResponse:
    """Corre el pipeline hasta HTML_GENERATED (sin grabar) y responde casi al
    instante con un `preview_id` — el progreso se consulta con
    GET /templates/preview/{preview_id}/status."""
    niche = find_niche_by_template_id(template_id)
    if niche is None:
        raise HTTPException(status_code=404, detail=f"Template '{template_id}' not found")

    image_source = await resolve_image_source(niche, niche.id, image_file, image_asset_id)
    music_source = await resolve_music_source(niche, niche.id, music_file, music_asset_id, song_name, artist)
    video_source = await resolve_video_source(niche.id, video_file, video_asset_id)

    song_info = None
    if any([song_name, artist, topic, song_description, language]):
        song_info = SongInfo(
            song_name=song_name, artist=artist, topic=topic,
            description=song_description, language=language,
        )

    orchestrator = Orchestrator()
    job = orchestrator.build_jobs(
        category_name=niche.id,
        quantity=1,
        user_context=user_context,
        image_source=image_source,
        music_source=music_source,
        video_source=video_source,
        song_info=song_info,
    )[0]

    preview_tracker.create(job)

    task = asyncio.create_task(
        pipeline.run(job, on_stage=preview_tracker.update, stop_after=JobStage.HTML_GENERATED)
    )
    _preview_tasks.add(task)
    task.add_done_callback(_log_preview_task_exception)

    return TemplatePreviewAcceptedResponse(
        preview_id=job.job_id,
        template_id=template_id,
        category_name=niche.id,
        stage=job.stage.value,
    )


@router.get("/templates/preview/{preview_id}/status", response_model=PreviewStatusResponse)
async def get_preview_status(preview_id: str) -> PreviewStatusResponse:
    record = preview_tracker.get(preview_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Preview '{preview_id}' not found")
    return PreviewStatusResponse.from_record(record)


@router.get("/templates/preview/{preview_id}/{filename}")
async def get_preview_file(preview_id: str, filename: str, request: Request) -> Response:
    if filename not in PREVIEW_ALLOWED_FILENAMES:
        raise HTTPException(status_code=404, detail=f"Unknown preview file '{filename}'")

    record = preview_tracker.get(preview_id)
    if record is None:
        raise HTTPException(status_code=404, detail=f"Preview '{preview_id}' not found")

    output_dir_str = record.get("output_dir")
    if not output_dir_str:
        raise HTTPException(status_code=404, detail="Preview output not ready yet")

    output_dir = Path(output_dir_str).resolve()
    path = (output_dir / filename).resolve()
    if not path.is_relative_to(output_dir) or not path.exists():
        raise HTTPException(status_code=404, detail=f"'{filename}' not available for this preview")

    if filename == "index.html":
        return Response(content=path.read_bytes(), media_type="text/html; charset=utf-8")

    media_type = mimetypes.guess_type(str(path))[0] or "application/octet-stream"
    return serve_file_with_range(path, request.headers.get("range"), media_type)

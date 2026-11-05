"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager
import asyncio

import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config.logging_config import setup_logging
from src.config.settings import settings
from src.presentation.api.routers import sound_design
from src.presentation.api.routers import (
    categories,
    history,
    library,
    niches,
    notifications,
    publisher,
    realtime,
    schedule,
    templates,
    videos,
    youtube_oauth,
    stats,
    stock,
    drafts,
    explainer,
    sandbox,
    prototypes,
    media_plans,
    voice,
    image_posts,
    publications,
)


logger = structlog.get_logger(__name__)

_scheduler = None  # Holds the APScheduler instance during the app lifetime


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    (settings.output_dir / "logs").mkdir(exist_ok=True)
    # output/node_tech, output/node_history, output/node_motion/letras, …
    from src.core.categories import ensure_output_dirs
    ensure_output_dirs(settings.output_dir)
    logger.info("nexa_brief_started", output_dir=str(settings.output_dir))

    # Marcar runs que quedaron sin proceso al reiniciar y reactivar la cola persistida.
    await prototypes.get_prototype_run_service().recover_interrupted()

    # Reparar el índice derivado y dejar publicaciones interrumpidas en
    # conciliación; una entrega ambigua nunca se reenvía automáticamente.
    from src.adapters.data.publication_factory import get_publication_components
    publication_components = get_publication_components()
    publication_components.port.repair_index()
    await publication_components.service.reconcile_interrupted()

    # ── Wire the realtime event bus to its WebSocket broadcaster ──────────────
    # Always on (unlike the scheduler below) — every write path that publishes
    # a RealtimeEvent expects a subscriber to already be listening.
    from src.adapters.realtime.factory import wire_realtime
    wire_realtime()
    relay = None
    if settings.storage_profile_dir is not None:
        from src.adapters.realtime.shared_events import SharedEventRelay
        from src.core.realtime.event_bus import get_event_bus
        relay = SharedEventRelay(settings.data_dir, get_event_bus())
        relay.start()

    # A profile has one scheduler owner even if both APIs are running.
    from src.core.task_ownership import TaskLease
    scheduler_lease = TaskLease("runtime", "scheduler")
    async def scheduler_leader():
        global _scheduler
        while True:
            if settings.publisher_encryption_key and scheduler_lease.acquire():
                try:
                    from src.adapters.publishing.factory import get_publisher_facade
                    from src.adapters.publishing.scheduler import start_publishing_scheduler, start_token_refresh_scheduler
                    facade = get_publisher_facade()
                    loop = asyncio.get_running_loop()
                    _scheduler = (start_publishing_scheduler(facade, loop) if settings.enable_auto_publishing
                                  else start_token_refresh_scheduler(facade, loop))
                    await asyncio.Event().wait()
                except asyncio.CancelledError:
                    raise
                except Exception as exc:
                    logger.warning("publisher_scheduler_start_failed", error_type=type(exc).__name__)
                finally:
                    if _scheduler is not None:
                        _scheduler.shutdown(wait=False)
                        _scheduler = None
                    scheduler_lease.release()
            await asyncio.sleep(5)
    leader_task = asyncio.create_task(scheduler_leader())
    from src.core.explainer.batches import worker_loop
    preparation_producer = explainer.get_producer()
    preparation_worker = asyncio.create_task(worker_loop(preparation_producer))

    yield

    preparation_worker.cancel()
    try:
        await preparation_worker
    except asyncio.CancelledError:
        pass
    await preparation_producer.shutdown()
    leader_task.cancel()
    try:
        await leader_task
    except asyncio.CancelledError:
        pass
    if relay is not None:
        await relay.stop()
    logger.info("nexa_brief_shutdown")


openapi_tags = [
    {
        "name": "videos",
        "description": "Video generation pipeline jobs.",
    },
    {
        "name": "niches",
        "description": "Read-only listing of available video generation niches (niches.json).",
    },
    {
        "name": "youtube",
        "description": "YouTube OAuth integration, playlist management and authorization.",
    },
    {
        "name": "facebook",
        "description": "Facebook Page access token authorization and setup.",
    },
    {
        "name": "tiktok",
        "description": "TikTok OAuth integration and authorization setup.",
    },
    {
        "name": "publisher",
        "description": "General cross-platform publishing operations and video management CRUD.",
    },
    {
        "name": "library",
        "description": "Read-only listing of the local asset library (reusable images, music, and archived template configs).",
    },
    {
        "name": "templates",
        "description": "Template listing and live preview (renders config.json + index.html without recording).",
    },
    {
        "name": "history",
        "description": "Pipeline event timeline per video job (Historial).",
    },
    {
        "name": "notifications",
        "description": "Dashboard alerts: token expired, publish failed, video ready (Notificaciones).",
    },
    {
        "name": "schedule",
        "description": "Recurring publishing slots and the publish queue (Programación) — auto-fill + manual assignment + immediate publish.",
    },
    {
        "name": "image-posts",
        "description": "Planes, revisión y entregas FB/IG de publicaciones de imagen.",
    },
    {
        "name": "publications",
        "description": "Archivo y galería autenticada de publicaciones y métricas.",
    },
    {
        "name": "realtime",
        "description": "WebSocket push for channel/job/notification changes — replaces frontend polling.",
    },
]

app = FastAPI(
    title="Nexa Brief",
    description="Automated music video generator for YouTube and TikTok.",
    version="0.1.0",
    lifespan=lifespan,
    openapi_tags=openapi_tags,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allow_origins,
    allow_origin_regex=settings.cors_allow_origin_regex or None,
    allow_credentials=False,  # sin cookies de auth en este flujo (el login vive en el frontend)
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["*"],  # necesario por el boundary variable de multipart/form-data
    allow_private_network=True,
)
@app.get("/api/v1/storage/profile")
def current_storage_profile():
    # Only non-sensitive profile metadata is returned.
    return {"id": settings.storage_profile_id, "label": settings.storage_profile_label,
            "providers": {"records": settings.data_backend, "publications": settings.publication_backend,
                          "credentials": settings.credentials_backend, "media": settings.media_backend}}


app.include_router(videos.router, prefix="/api/v1")
app.include_router(niches.router, prefix="/api/v1")
# Publisher router is always registered; auth is managed via accounts.json
app.include_router(publisher.router, prefix="/api/v1")
app.include_router(library.router, prefix="/api/v1")
app.include_router(templates.router, prefix="/api/v1")
app.include_router(history.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(schedule.router, prefix="/api/v1")
app.include_router(realtime.router, prefix="/api/v1")
app.include_router(stats.router, prefix="/api/v1")
app.include_router(stock.router, prefix="/api/v1")
app.include_router(drafts.router, prefix="/api/v1")
app.include_router(media_plans.router, prefix="/api/v1")
app.include_router(explainer.router, prefix="/api/v1")
app.include_router(sandbox.router, prefix="/api/v1")
app.include_router(prototypes.router, prefix="/api/v1")
app.include_router(image_posts.router, prefix="/api/v1")
app.include_router(publications.router, prefix="/api/v1")
app.include_router(sound_design.router, prefix="/api/v1")
app.include_router(categories.router, prefix="/api/v1")
app.include_router(voice.router, prefix="/api/v1")
# YouTube OAuth 2.0 server-side flow
app.include_router(youtube_oauth.router)


@app.get("/health")
async def health() -> dict:
    return {
        "status": "ok",
        "version": "0.1.0",
        "auto_publishing": settings.enable_auto_publishing,
        "active_account": settings.active_account if settings.enable_auto_publishing else None,
    }


def main() -> None:
    import uvicorn
    uvicorn.run("src.presentation.main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()

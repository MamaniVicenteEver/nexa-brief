"""FastAPI application entrypoint."""

from contextlib import asynccontextmanager
import asyncio

import structlog
from fastapi import FastAPI

from src.config.logging_config import setup_logging
from src.config.settings import settings
from src.presentation.api.routers import library, niches, publisher, videos, youtube_oauth


logger = structlog.get_logger(__name__)

_scheduler = None  # Holds the APScheduler instance during the app lifetime


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging(settings.log_level)
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    (settings.output_dir / "logs").mkdir(exist_ok=True)
    logger.info("nexa_brief_started", output_dir=str(settings.output_dir))

    # ── Start token refresh scheduler (only when publisher is configured) ─────
    global _scheduler
    if settings.enable_auto_publishing and settings.publisher_encryption_key:
        try:
            from src.adapters.publishing.factory import get_publisher_facade
            from src.adapters.publishing.scheduler import start_token_refresh_scheduler
            facade = get_publisher_facade()
            loop = asyncio.get_event_loop()
            _scheduler = start_token_refresh_scheduler(facade, loop)
            logger.info("publisher_scheduler_active", active_account=settings.active_account)
        except Exception as exc:
            # Scheduler failure must NOT prevent the app from starting
            logger.warning("publisher_scheduler_start_failed", error=str(exc))
    else:
        logger.info(
            "publisher_scheduler_skipped",
            enable_auto_publishing=settings.enable_auto_publishing,
            has_encryption_key=bool(settings.publisher_encryption_key),
        )

    yield

    # ── Graceful shutdown ──────────────────────────────────────────────────────
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        logger.info("publisher_scheduler_stopped")
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
]

app = FastAPI(
    title="Nexa Brief",
    description="Automated music video generator for YouTube and TikTok.",
    version="0.1.0",
    lifespan=lifespan,
    openapi_tags=openapi_tags,
)

app.include_router(videos.router, prefix="/api/v1")
app.include_router(niches.router, prefix="/api/v1")
# Publisher router is always registered; auth is managed via accounts.json
app.include_router(publisher.router, prefix="/api/v1")
app.include_router(library.router, prefix="/api/v1")
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


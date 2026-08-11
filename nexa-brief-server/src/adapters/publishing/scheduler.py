"""Token Refresh Scheduler — runs proactive token maintenance every 15 minutes.

Uses APScheduler's BackgroundScheduler (runs in a daemon thread separate from
the asyncio event loop) with a bridge to asyncio.run_coroutine_threadsafe.

Why not asyncio-based APScheduler?
  The FastAPI event loop is not accessible from background threads without
  a reference.  We pass the loop explicitly at startup via lifespan.

Structured log events:
  scheduler_started        — APScheduler started and first job registered
  scheduler_refresh_tick   — scheduled refresh cycle begun
  scheduler_refresh_done   — cycle completed with summary of results
  scheduler_refresh_error  — exception during a refresh cycle (non-fatal)
  scheduler_stopped        — APScheduler shut down gracefully
"""

from __future__ import annotations

import asyncio
from typing import TYPE_CHECKING

import structlog
from apscheduler.schedulers.background import BackgroundScheduler

if TYPE_CHECKING:
    from src.adapters.publishing.publisher_facade import PublisherFacade

logger = structlog.get_logger(__name__)

_REFRESH_INTERVAL_MINUTES = 15


def start_token_refresh_scheduler(
    facade: "PublisherFacade",
    loop: asyncio.AbstractEventLoop,
) -> BackgroundScheduler:
    """Start a background scheduler that refreshes near-expiry tokens.

    Args:
        facade: The singleton PublisherFacade (must already be initialised).
        loop:   The asyncio event loop from FastAPI's lifespan context.
                Pass `asyncio.get_event_loop()` from within the lifespan.

    Returns:
        The started BackgroundScheduler instance (call .shutdown() on app exit).
    """
    scheduler = BackgroundScheduler(daemon=True)

    def _refresh_tick() -> None:
        """Run one refresh cycle: check all tokens and refresh expiring ones."""
        logger.info("scheduler_refresh_tick")
        try:
            future = asyncio.run_coroutine_threadsafe(
                facade.refresh_all_tokens(), loop
            )
            results = future.result(timeout=120)  # Wait up to 2 min for all refreshes
            logger.info(
                "scheduler_refresh_done",
                results=results,
                accounts_checked=len(results),
                errors=sum(1 for v in results.values() if v.startswith("error:")),
            )
        except Exception as exc:
            logger.error(
                "scheduler_refresh_error",
                error=str(exc),
                error_type=type(exc).__name__,
            )

    scheduler.add_job(
        _refresh_tick,
        trigger="interval",
        minutes=_REFRESH_INTERVAL_MINUTES,
        id="token_refresh",
        replace_existing=True,
    )
    scheduler.start()

    logger.info(
        "scheduler_started",
        interval_minutes=_REFRESH_INTERVAL_MINUTES,
        next_run=str(scheduler.get_job("token_refresh").next_run_time),
    )

    return scheduler

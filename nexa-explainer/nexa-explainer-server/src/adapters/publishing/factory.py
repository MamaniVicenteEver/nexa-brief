"""Factory — singleton pattern for PublisherFacade.

Creates and caches a single PublisherFacade instance per process lifetime.
Thread-safe via a module-level lock (asyncio.Lock used inside the facade's
token manager for concurrent refresh safety).

Usage::

    from src.adapters.publishing.factory import get_publisher_facade
    facade = get_publisher_facade()
    result = await facade.publish_video(...)
"""

from __future__ import annotations

import structlog
from src.adapters.publishing.publisher_facade import PublisherFacade

logger = structlog.get_logger(__name__)

_facade_instance: PublisherFacade | None = None


def get_publisher_facade() -> PublisherFacade:
    """Return the singleton PublisherFacade instance.

    Creates it on first call.  Subsequent calls return the cached instance.
    This is safe for use in FastAPI route handlers and the pipeline module.
    """
    global _facade_instance
    if _facade_instance is None:
        logger.info("publisher_facade_init_singleton")
        _facade_instance = PublisherFacade()
    return _facade_instance


def reset_publisher_facade() -> None:
    """Reset the singleton (for testing purposes only)."""
    global _facade_instance
    _facade_instance = None
    logger.debug("publisher_facade_singleton_reset")

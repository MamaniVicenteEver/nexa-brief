"""Event Bus — in-process pub/sub for `RealtimeEvent`s.

Pure domain utility: no FastAPI/WebSocket import here, so `core` code (e.g.
`notification_tracker.py`) can publish events without depending on
infrastructure. The one real subscriber (a WebSocket connection manager)
lives in `src/adapters/realtime/` and is wired up via
`src/adapters/realtime/factory.py::wire_realtime()`.

The storage profile may attach a shared event relay. Dispatching a relayed
event does not publish it again, preventing broadcast loops.
"""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

import structlog

from src.core.realtime.events import RealtimeEvent

logger = structlog.get_logger(__name__)

Subscriber = Callable[[RealtimeEvent], Awaitable[None]]


class EventBus:
    def __init__(self) -> None:
        self._subscribers: list[Subscriber] = []
        self.bridge: Subscriber | None = None

    def subscribe(self, callback: Subscriber) -> Callable[[], None]:
        """Register a callback; returns a function that unsubscribes it."""
        self._subscribers.append(callback)

        def unsubscribe() -> None:
            if callback in self._subscribers:
                self._subscribers.remove(callback)

        return unsubscribe

    async def publish(self, event: RealtimeEvent) -> None:
        if self.bridge is not None:
            try:
                await self.bridge(event)
            except Exception as exc:
                logger.warning("realtime_bridge_failed", error_type=type(exc).__name__)
        await self.dispatch(event)

    async def dispatch(self, event: RealtimeEvent) -> None:
        """Fan out `event` to every subscriber. Never raises — a broken
        subscriber must not break whatever business logic just published."""
        if not self._subscribers:
            return
        results = await asyncio.gather(
            *(callback(event) for callback in self._subscribers),
            return_exceptions=True,
        )
        for result in results:
            if isinstance(result, Exception):
                logger.error("realtime_event_subscriber_failed", event_type=event.type, error=str(result))


# Singleton getter lives here (core), not in adapters/realtime/factory.py:
# core code (notification_tracker.py) needs to publish events, and core must
# never import adapters — only the ConnectionManager subscriber (the actual
# infrastructure piece) belongs in adapters/.
_event_bus: EventBus | None = None


def get_event_bus() -> EventBus:
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus

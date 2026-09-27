"""Singleton access point for the WebSocket connection manager, plus the
one-time wiring that subscribes it to the (core-owned) event bus — same
singleton style as `src.adapters.publishing.factory`.

`get_event_bus()` itself lives in `src.core.realtime.event_bus`, not here:
core code needs to publish events and must never import adapters, so the
bus's singleton getter has to stay on the core side."""

from __future__ import annotations

from src.adapters.realtime.connection_manager import ConnectionManager
from src.core.realtime.event_bus import get_event_bus

_connection_manager: ConnectionManager | None = None


def get_connection_manager() -> ConnectionManager:
    global _connection_manager
    if _connection_manager is None:
        _connection_manager = ConnectionManager()
    return _connection_manager


def wire_realtime() -> None:
    """Subscribe the connection manager to the event bus. Called once from
    the app's `lifespan`, before any event can be published."""
    get_event_bus().subscribe(get_connection_manager().broadcast)

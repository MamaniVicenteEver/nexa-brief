"""Connection Manager — the one EventBus subscriber, fans out events to every
connected WebSocket client. This is the adapter that translates internal
`RealtimeEvent`s into wire messages; swapping the transport later (e.g. a
Redis-backed broadcaster for multi-worker deployments) only means writing a
new class with the same `broadcast()` shape and re-wiring `factory.py`.
"""

from __future__ import annotations

import structlog
from fastapi import WebSocket

from src.core.realtime.events import RealtimeEvent

logger = structlog.get_logger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: set[WebSocket] = set()

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections.add(websocket)
        logger.info("realtime_client_connected", total=len(self._connections))

    def disconnect(self, websocket: WebSocket) -> None:
        self._connections.discard(websocket)
        logger.info("realtime_client_disconnected", total=len(self._connections))

    async def broadcast(self, event: RealtimeEvent) -> None:
        """Send `event` to every connected client. A client whose socket has
        died gets evicted instead of raising — one dead connection must
        never stop the broadcast to the others."""
        if not self._connections:
            return
        payload = event.model_dump_json()
        dead: list[WebSocket] = []
        for connection in self._connections:
            try:
                await connection.send_text(payload)
            except Exception as exc:
                logger.warning("realtime_send_failed", error=str(exc))
                dead.append(connection)
        for connection in dead:
            self._connections.discard(connection)

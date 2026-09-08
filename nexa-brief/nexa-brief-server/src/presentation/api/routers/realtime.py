"""Realtime router — one WebSocket endpoint that pushes `RealtimeEvent`s to
every connected client.

  WS /ws/events

No auth: matches the rest of this API today (no endpoint anywhere has an
auth dependency yet). No request/response body to model — clients just keep
the connection open and read JSON frames shaped like
`{"type": str, "data": dict, "ts": float}`.
"""

from __future__ import annotations

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.adapters.realtime.factory import get_connection_manager

router = APIRouter(tags=["realtime"])
logger = structlog.get_logger(__name__)


@router.websocket("/ws/events")
async def events(websocket: WebSocket) -> None:
    manager = get_connection_manager()
    await manager.connect(websocket)
    try:
        while True:
            # Clients don't send anything meaningful today — this just blocks
            # until the socket closes, which is how we detect a disconnect.
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("realtime_connection_error", error=str(exc))
    finally:
        manager.disconnect(websocket)

"""Notificaciones router — CRUD de alertas del dashboard (token vencido,
video listo/fallido).

Endpoints:
  GET    /api/v1/notifications                 Listar (paginado, unread_only)
  POST   /api/v1/notifications/{id}/read        Marcar una como leída
  POST   /api/v1/notifications/read-all         Marcar todas como leídas
  DELETE /api/v1/notifications/{id}             Eliminar
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.core import notification_tracker
from src.presentation.api.schemas.notification_schema import (
    MarkAllReadResponse,
    NotificationDeleteResponse,
    NotificationListResponse,
    NotificationResponse,
)

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationListResponse)
async def list_notifications(
    unread_only: bool = False, limit: int = 20, offset: int = 0
) -> NotificationListResponse:
    limit = min(max(limit, 1), 100)
    offset = max(offset, 0)
    notifications, total, unread_count = notification_tracker.list_notifications(
        unread_only=unread_only, limit=limit, offset=offset,
    )
    return NotificationListResponse(
        total=total, limit=limit, offset=offset, unread_count=unread_count,
        notifications=[NotificationResponse.from_notification(n) for n in notifications],
    )


@router.post("/read-all", response_model=MarkAllReadResponse)
async def mark_all_read() -> MarkAllReadResponse:
    marked = await notification_tracker.mark_all_read()
    return MarkAllReadResponse(marked=marked)


@router.post("/{notification_id}/read", response_model=NotificationResponse)
async def mark_read(notification_id: str) -> NotificationResponse:
    notification = await notification_tracker.mark_read(notification_id)
    if notification is None:
        raise HTTPException(status_code=404, detail=f"Notification '{notification_id}' not found")
    return NotificationResponse.from_notification(notification)


@router.delete("/{notification_id}", response_model=NotificationDeleteResponse)
async def delete_notification(notification_id: str) -> NotificationDeleteResponse:
    deleted = await notification_tracker.delete(notification_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Notification '{notification_id}' not found")
    return NotificationDeleteResponse(notification_id=notification_id, deleted=True)

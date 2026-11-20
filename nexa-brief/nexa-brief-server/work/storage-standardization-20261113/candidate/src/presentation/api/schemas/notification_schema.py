"""Pydantic schemas for the Notificaciones endpoints."""

from __future__ import annotations

from pydantic import BaseModel

from src.core.notification import Notification


class NotificationResponse(BaseModel):
    notification_id: str
    type: str
    severity: str
    title: str
    message: str
    job_id: str | None = None
    account_alias: str | None = None
    created_at: str
    read_at: str | None = None
    is_read: bool

    @classmethod
    def from_notification(cls, notification: Notification) -> "NotificationResponse":
        return cls(
            notification_id=notification.notification_id,
            type=notification.type,
            severity=notification.severity,
            title=notification.title,
            message=notification.message,
            job_id=notification.job_id,
            account_alias=notification.account_alias,
            created_at=notification.created_at,
            read_at=notification.read_at,
            is_read=notification.read_at is not None,
        )


class NotificationListResponse(BaseModel):
    total: int
    limit: int
    offset: int
    unread_count: int
    notifications: list[NotificationResponse]


class MarkAllReadResponse(BaseModel):
    marked: int


class NotificationDeleteResponse(BaseModel):
    notification_id: str
    deleted: bool

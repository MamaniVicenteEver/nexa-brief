from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class Account(BaseModel):
    alias: str
    label: str = ''
    notes: str = ''
    identity: dict[str, Any] | None = None
    playwright_version: str = '1.64.1'
    chromium_revision: str = '1248'
    session_health: Literal['ok', 'expired', 'unknown'] = 'unknown'
    session_checked_at: str | None = None

    @field_validator('session_checked_at')
    @classmethod
    def valid_check_time(cls, value: str | None) -> str | None:
        if value is not None and datetime.fromisoformat(value).tzinfo is None:
            raise ValueError('El chequeo requiere fecha con zona horaria.')
        return value


class Video(BaseModel):
    id: str
    caption: str = ''
    url: str | None = None
    status: str | None = None


class Job(BaseModel):
    id: str
    alias: str
    kind: Literal['publish', 'comment', 'delete']
    state: Literal['queued', 'running', 'clicked', 'done', 'failed', 'needs_review'] = 'queued'
    idempotency_key: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    result: dict[str, Any] | None = None
    error: dict[str, str] | None = None
    steps: list[str] = Field(default_factory=list)

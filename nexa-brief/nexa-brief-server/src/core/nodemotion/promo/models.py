"""Contratos de entrada del chat de promociones."""

from typing import Literal
from pydantic import BaseModel, Field


class CreateSession(BaseModel):
    template_id: str
    message: str = Field(min_length=1, max_length=12000)
    provider: Literal["codex", "claude"] | None = None


class SendMessage(BaseModel):
    message: str = Field(min_length=1, max_length=12000)


class ApproveSession(BaseModel):
    revision: int = Field(ge=1)


class ReplacePromoMediaRequest(BaseModel):
    revision: int = Field(ge=1, strict=True)
    scene: int = Field(ge=1, le=200, strict=True)
    slot: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")
    asset_id: str = Field(min_length=1, max_length=128, pattern=r"^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$")

"""Request contracts for category management."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    display_name: str = Field(min_length=2, max_length=48)
    topic: str = Field(default="", max_length=180)
    language: Literal["en", "es-419"] = "es-419"

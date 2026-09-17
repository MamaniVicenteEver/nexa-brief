"""Response schema for GET /api/v1/niches."""

from __future__ import annotations

from pydantic import BaseModel


class NicheResponse(BaseModel):
    id: str
    display_name: str
    description: str
    pipeline_type: str
    active: bool
    recorder_engine: str
    # Motores que el frontend puede ofrecer como override para este niche sin
    # que el submit falle con 400 — "playwright" siempre (motor universal, no
    # requiere composición portada), "remotion"/"hyperframes" solo si
    # <engine>_adapter.supports_niche() da True (ver niches.py::_to_response()
    # y videos.py::_validate_recorder_engine_override, mismo cálculo).
    supported_engines: list[str]

"""Pydantic schemas for the "Plantillas" preview feature."""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel

from src.core import preview_tracker

# Unión de todos los nombres de archivo reales usados por required_output_assets
# en cualquier src/templates/*/manifest.json — whitelist estática de lo que el
# endpoint de servido puede devolver (ver GET /templates/preview/{id}/{filename}).
PREVIEW_ALLOWED_FILENAMES = frozenset({
    "index.html",
    "config.json",
    "lyrics.json",
    "bg.jpg",
    "bg.mp4",
    "subject.png",
    "song.mp3",
})


class TemplateResponse(BaseModel):
    template_id: str
    niche_id: str
    display_name: str
    native_orientation: str
    requires_image: bool
    requires_video: bool
    requires_lyrics: bool
    active: bool
    preview_image_url: str | None = None
    preview_video_url: str | None = None
    preview_audio_url: str | None = None
    showcase_url: str | None = None


class TemplatePreviewAcceptedResponse(BaseModel):
    """Respuesta inmediata de POST /templates/{template_id}/preview — fire-and-forget,
    el progreso real se consulta con GET /templates/preview/{preview_id}/status."""
    preview_id: str
    template_id: str
    category_name: str
    stage: str


class PreviewFileInfo(BaseModel):
    filename: str
    url: str | None = None


class PreviewStatusResponse(BaseModel):
    preview_id: str
    category: str
    stage: str
    is_terminal: bool
    is_success: bool
    errors: list[str] = []
    created_at: str
    updated_at: str
    files: list[PreviewFileInfo] = []

    @classmethod
    def from_record(cls, record: dict) -> "PreviewStatusResponse":
        preview_id = record["preview_id"]
        stage = record["stage"]
        output_dir = record.get("output_dir")

        files: list[PreviewFileInfo] = []
        if output_dir:
            out = Path(output_dir)
            for filename in sorted(PREVIEW_ALLOWED_FILENAMES):
                if (out / filename).exists():
                    files.append(
                        PreviewFileInfo(
                            filename=filename,
                            url=f"/api/v1/templates/preview/{preview_id}/{filename}",
                        )
                    )

        return cls(
            preview_id=preview_id,
            category=record["category"],
            stage=stage,
            is_terminal=preview_tracker.is_terminal(stage),
            is_success=preview_tracker.is_success(stage),
            errors=record.get("errors", []),
            created_at=record["created_at"],
            updated_at=record["updated_at"],
            files=files,
        )

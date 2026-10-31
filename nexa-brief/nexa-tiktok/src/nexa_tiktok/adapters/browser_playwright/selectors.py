"""Centralized TikTok Studio selectors with Spanish and English alternatives."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from playwright.async_api import Locator, Page


@dataclass(frozen=True)
class Candidate:
    """A locator recipe, kept here so interface changes stay easy to review."""

    kind: Literal["css", "text", "role"]
    value: str
    role: str | None = None
    exact: bool = False


UPLOAD_URL = "https://www.tiktok.com/tiktokstudio/upload"
CONTENT_URL = "https://www.tiktok.com/tiktokstudio/content"

FILE_INPUTS = (Candidate("css", 'input[type="file"]'),)
SELECT_VIDEO_BUTTONS = (
    Candidate("css", '[data-e2e="select_video_button"]'),
    Candidate("role", "Seleccionar vídeo", role="button"),
    Candidate("role", "Seleccionar video", role="button"),
    Candidate("role", "Select video", role="button"),
    Candidate("role", "Choose video", role="button"),
)
CAPTION_INPUTS = (
    Candidate("css", '[data-e2e="caption_container"] [contenteditable="true"]'),
    Candidate("css", '[data-e2e*="video-caption"]'),
    Candidate("css", '[contenteditable="true"][data-placeholder]'),
    Candidate("role", "Escribe una descripción", role="textbox"),
    Candidate("role", "Write a caption", role="textbox"),
    Candidate("role", "Añade una descripción", role="textbox"),
    Candidate("role", "Add a description", role="textbox"),
    Candidate("css", '[contenteditable="true"]'),
)
EDITOR_READY = (
    Candidate("css", '[data-e2e="caption_container"]'),
    Candidate("text", "Descripción"),
    Candidate("text", "Caption"),
    Candidate("css", '[data-e2e*="video-caption"]'),
    Candidate("css", '[contenteditable="true"]'),
)
UPLOAD_COMPLETE_TEXTS = (
    "Subido",
    "Carga completada",
    "Carga completa",
    "Uploaded",
    "Upload complete",
)
UPLOAD_PROGRESS_TEXTS = (
    "Subiendo",
    "Cargando",
    "Uploading",
    "Processing video",
    "Procesando video",
)

PRIVACY_CONTROLS = (
    Candidate("css", '[data-e2e="video_visibility_container"] button[role="combobox"]'),
    Candidate("text", "Quién puede ver esta publicación"),
    Candidate("role", "Quién puede ver este video", role="combobox"),
    Candidate("role", "Who can watch this video", role="combobox"),
    Candidate("text", "Quién puede ver este video"),
    Candidate("text", "Who can watch this video"),
    Candidate("text", "Visibilidad"),
    Candidate("text", "Visibility"),
)
MORE_SETTINGS_BUTTONS = (
    Candidate("role", "Mostrar más", role="button"),
    Candidate("role", "Show more", role="button"),
    Candidate("text", "Mostrar más", exact=True),
    Candidate("text", "Show more", exact=True),
)
PRIVACY_VALUES = {
    "public": ("Todos", "Todo el mundo", "Público", "Everyone", "Public"),
    "friends": ("Amigos", "Friends"),
    "private": ("Solo tú", "Solo yo", "Only you", "Private"),
}
COMMENT_TOGGLES = (
    Candidate("css", '[data-e2e="user_perm_container"] label:has-text("Comentario")'),
    Candidate("css", '[data-e2e="user_perm_container"] label:has-text("Comment")'),
    Candidate("role", "Permitir comentarios", role="switch"),
    Candidate("role", "Allow comments", role="switch"),
    Candidate("role", "Comentarios", role="switch"),
    Candidate("role", "Comments", role="switch"),
    Candidate("role", "Permitir comentarios", role="checkbox"),
    Candidate("role", "Allow comments", role="checkbox"),
    Candidate("css", '[data-e2e*="comment"] [role="switch"]'),
    Candidate("css", '[data-e2e*="comment"] input[type="checkbox"]'),
)
COMMENT_SETTING_LABELS = (
    "Permitir comentarios",
    "Allow comments",
    "Comentarios",
    "Comments",
)
UNSAVED_EDIT_MARKERS = (
    "Un video que estabas editando no se ha guardado",
    "Un vídeo que estabas editando no se ha guardado",
    "The video you were editing wasn't saved",
    "The video you were editing was not saved",
)

PUBLISH_BUTTONS = (
    Candidate("role", "Publicar", role="button", exact=True),
    Candidate("role", "Post", role="button", exact=True),
    Candidate("role", "Publish", role="button", exact=True),
)
CONTINUE_PUBLISH_BUTTONS = (
    Candidate("role", "Continuar publicando", role="button"),
    Candidate("role", "Continuar", role="button"),
    Candidate("role", "Continue posting", role="button"),
    Candidate("role", "Continue", role="button"),
)
PUBLISH_NOW_BUTTONS = (
    Candidate("role", "Publicar ahora", role="button"),
    Candidate("role", "Publicar", role="button"),
    Candidate("role", "Post now", role="button"),
    Candidate("role", "Publish now", role="button"),
)
CANCEL_BUTTONS = (
    Candidate("role", "Cancelar", role="button"),
    Candidate("role", "Cancel", role="button"),
)
DISCARD_BUTTONS = (
    Candidate("css", '[data-e2e="discard_post_button"]'),
    Candidate("role", "Descartar", role="button"),
    Candidate("role", "Descartar borrador", role="button"),
    Candidate("role", "Eliminar borrador", role="button"),
    Candidate("role", "Discard", role="button"),
    Candidate("role", "Discard draft", role="button"),
)
CONFIRM_DISCARD_BUTTONS = (
    Candidate("role", "Descartar", role="button", exact=True),
    Candidate("role", "Descartar cambios", role="button"),
    Candidate("role", "Discard", role="button", exact=True),
    Candidate("role", "Discard changes", role="button"),
)
DIALOGS = (Candidate("css", '[role="dialog"]'), Candidate("css", "dialog"))
KNOWN_MODAL_MARKERS = (
    "comprobación de contenido",
    "revisar el contenido",
    "copyright",
    "derechos de autor",
    "content check",
    "content review",
    "copyright check",
    "activar las revisiones automáticas de contenido",
    "automatic content checks",
)
UNKNOWN_MODAL_MARKERS = (
    "captcha",
    "verifica tu identidad",
    "verificación de identidad",
    "verify your identity",
    "identity verification",
    "robot",
    "unusual activity",
    "actividad inusual",
)

COMMENT_INPUTS = (
    Candidate("role", "Añade un comentario", role="textbox"),
    Candidate("role", "Añade un comentario...", role="textbox"),
    Candidate("role", "Add a comment", role="textbox"),
    Candidate("role", "Add comment", role="textbox"),
    Candidate("css", '[contenteditable="true"][data-e2e*="comment"]'),
    Candidate("css", '[data-e2e*="comment-input"]'),
)
COMMENT_SEND_BUTTONS = (
    Candidate("role", "Publicar", role="button"),
    Candidate("role", "Comentar", role="button"),
    Candidate("role", "Enviar", role="button"),
    Candidate("role", "Post", role="button"),
    Candidate("role", "Comment", role="button"),
    Candidate("role", "Send", role="button"),
)
PROCESSING_TEXTS = (
    "Procesando video",
    "El video se está procesando",
    "Tu video se está procesando",
    "Processing video",
    "Your video is processing",
    "Video is being processed",
)
STATUS_TEXTS = (
    "Publicado",
    "Publicada",
    "En revisión",
    "En revision",
    "Procesando",
    "Privado",
    "Error",
    "Published",
    "Posted",
    "Under review",
    "In review",
    "Processing",
    "Private",
    "Failed",
    "Error",
)


def locator_for(page: Page, candidate: Candidate) -> Locator:
    if candidate.kind == "css":
        return page.locator(candidate.value)
    if candidate.kind == "text":
        return page.get_by_text(candidate.value, exact=candidate.exact)
    return page.get_by_role(candidate.role or "button", name=candidate.value, exact=candidate.exact)


async def first_visible(page: Page, candidates: tuple[Candidate, ...], *, timeout_ms: int = 350) -> Locator | None:
    """Return the first visible candidate, tolerating absent selectors."""
    for candidate in candidates:
        matches = locator_for(page, candidate)
        try:
            count = min(await matches.count(), 8)
            for index in range(count):
                locator = matches.nth(index)
                if await locator.is_visible(timeout=timeout_ms):
                    return locator
        except Exception:
            continue
    return None


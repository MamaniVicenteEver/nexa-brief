"""`publish.json` versión 2: el paquete de publicación de un video explainer.

Guarda las piezas que se escriben (a mano o con IA): las miniaturas A/B/C (la elegida
también abre el video: opening.py), los 3 títulos de YouTube y los de Facebook/TikTok, los bloques de la
descripción, las fuentes, los créditos, los tags y el comentario fijado. Lo que
se puede calcular (la descripción armada, el agradecimiento, los campos planos
que leen el grabador y el publicador) lo genera `store.save_package`, así nunca
queda desincronizado. Formato: integracion-estrategias-explainer-2026-10.md §4.
"""

from __future__ import annotations

import math
import re
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

SCHEMA_VERSION = 2

OptionId = Literal["A", "B", "C"]
ImageSide = Literal["auto", "left", "right"]
ImageVerdict = Literal["elegida", "alternativa", "débil", "no pasa", "no disponible", "conseguir"]


def words_of(text: str) -> list[str]:
    """Palabras de un texto (sin signos), para contar y comparar."""
    return re.findall(r"[\wÀ-ÿ]+", text)


class _Piece(BaseModel):
    """Un campo desconocido es un error: un typo no debe perderse en silencio."""

    model_config = ConfigDict(extra="forbid")


class ImageReview(_Piece):
    image: str
    verdict: ImageVerdict
    reason: str


class ThumbnailTextOnly(_Piece):
    lines: list[str] = Field(min_length=1)
    highlight: str
    pair_title: OptionId

    @property
    def text(self) -> str:
        return " ".join(self.lines)

    @model_validator(mode="after")
    def _highlight_in_one_line(self) -> ThumbnailTextOnly:
        # Se resalta renglón por renglón (como se dibuja): no puede cruzar un salto.
        if self.highlight and not any(self.highlight in line for line in self.lines):
            raise ValueError(f"highlight «{self.highlight}» no está entero en ningún renglón de {self.lines}")
        return self


class ThumbnailWithImage(_Piece):
    text: str
    # Archivo en assets/media/ del video; None = la imagen todavía hay que conseguirla.
    image: str | None
    composition: str
    pair_title: OptionId
    # Lado de la foto en la intro 16:9 (<diseño>.introv2 → imageSide); "auto" alterna entre videos.
    image_side: ImageSide = "auto"
    image_review: list[ImageReview] = Field(default_factory=list)


class ThumbnailTabloid(_Piece):
    """Ajustes opcionales de la miniatura de alerta; vacíos = valores derivados de A y B."""

    text: str = ""
    image: str | None = None
    image_side: ImageSide = "auto"
    image_after: str | None = None
    accent: str = ""
    bullet: str = ""
    bullet_scale: float = Field(default=1, ge=0.5, le=1.5)
    image_review: list[ImageReview] = Field(default_factory=list)
    before_label: str = ""
    after_label: str = ""
    mode: Literal["impact", "split"] = "impact"
    palette: Literal["brand", "alert"] = "brand"
    strap: str = ""
    seal: str = ""
    tape_text: str = ""
    marker: bool = False
    target: tuple[float, float] = (0.72, 0.52)
    # Coordenadas normalizadas sobre el recorte visible de la foto, no sobre el original.
    focus: tuple[float, float, float] | None = None
    pair_title: OptionId = "C"

    @model_validator(mode="after")
    def _focus_in_visible_photo(self) -> ThumbnailTabloid:
        if self.focus is not None:
            x, y, r = self.focus
            if not all(math.isfinite(v) for v in self.focus) or not (0 <= x <= 1 and 0 <= y <= 1 and 0 < r <= .5):
                raise ValueError("focus debe ser [x, y, r] normalizado, con 0 < r <= 0.5")
        return self


class Thumbnail(_Piece):
    """Las miniaturas. La elegida (`chosen`) es también la apertura del video (opening.py)."""

    text_only: ThumbnailTextOnly
    with_image: ThumbnailWithImage
    tabloid: ThumbnailTabloid | None = None
    chosen: Literal["text_only", "with_image", "tabloid"] = "text_only"
    # Antetítulo de las dos (lugar · fecha), p. ej. "APOLO 11 · 20 JUL 1969".
    kicker: str = ""

    @property
    def chosen_text(self) -> str:
        if self.chosen == "with_image":
            return self.with_image.text
        if self.chosen == "tabloid" and self.tabloid and self.tabloid.text.strip():
            return self.tabloid.text
        return self.text_only.text


class TitleOption(_Piece):
    option: OptionId
    text: str
    strategy: int = Field(ge=1, description="Número de estrategia de gancho (1–10).")
    emotion: str


class FacebookCopy(_Piece):
    title: str
    first_line: str


class TiktokCopy(_Piece):
    caption: str


class Titles(_Piece):
    youtube: list[TitleOption] = Field(min_length=1)
    facebook: FacebookCopy
    tiktok: TiktokCopy
    chosen: OptionId = "A"

    @model_validator(mode="after")
    def _options_are_unique_and_chosen_exists(self) -> Titles:
        options = [t.option for t in self.youtube]
        if len(set(options)) != len(options):
            raise ValueError(f"títulos de YouTube con opciones repetidas: {options}")
        if self.chosen not in options:
            raise ValueError(f"el título elegido «{self.chosen}» no está entre las opciones {options}")
        return self

    def option(self, option: OptionId) -> TitleOption | None:
        return next((t for t in self.youtube if t.option == option), None)

    @property
    def youtube_chosen(self) -> TitleOption:
        chosen = self.option(self.chosen)
        assert chosen is not None  # garantizado por el validador
        return chosen


class Chapter(_Piece):
    at: str = Field(pattern=r"^\d{1,2}:[0-5]\d$", description="Inicio, m:ss.")
    title: str

    @property
    def seconds(self) -> int:
        minutes, seconds = self.at.split(":")
        return int(minutes) * 60 + int(seconds)


class Description(_Piece):
    """Bloques que escribe la IA; capítulos, agradecimiento, fuentes y hashtags los arma el código."""

    hook: str
    context: str
    chapters: list[Chapter]
    reflection: str
    question: str
    # Variante de agradecimiento (G1_identidad…); None = rotación determinística por video.
    gratitude: str | None = None
    # Reemplaza {tema} en las variantes que lo usan («la ingeniería»).
    gratitude_topic: str = ""


class Tags(_Piece):
    youtube: list[str]
    youtube_hashtags: list[str]
    tiktok: list[str]
    facebook: list[str]


class PublishPackage(_Piece):
    schema_version: Literal[2] = SCHEMA_VERSION
    category: str
    thumbnail: Thumbnail
    titles: Titles
    description: Description
    sources: list[str]
    credits: list[str]
    tags: Tags
    pinned_comment: str
    # Ids de las estrategias con que se validó y armó (los escribe save_package): permite medir.
    strategies_used: dict[str, str] = Field(default_factory=dict)

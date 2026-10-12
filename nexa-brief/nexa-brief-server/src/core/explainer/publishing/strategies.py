"""Estrategias del paquete de publicación de los explainers (src/skills/explainer/).

Misma forma que las de NodeMotion (src/skills/output/copy/): cada estrategia es
un JSON versionado (`…_v1`, `…_v2`) en `strategies/<pieza>/`, `active.json`
elige una por pieza (con `_default` y excepciones por categoría) y el perfil de
cada categoría vive en `categories/<id>.json`. Cambiar de estrategia es editar
un nombre en `active.json`: los archivos se releen cuando cambian en disco, sin
reiniciar el servidor (que corre con --reload y cortaría producciones en curso).
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Annotated, Any, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, RootModel, model_validator

from src.config.settings import settings

Piece = Literal["title", "thumbnail", "platforms", "description", "gratitude", "tags"]
PIECES: tuple[Piece, ...] = ("title", "thumbnail", "platforms", "description", "gratitude", "tags")


def explainer_skills_dir() -> Path:
    return settings.skills_dir / "explainer"


class StrategyError(ValueError):
    """Un archivo de estrategia falta, está mal formado o es inconsistente."""


def _check_range(value: tuple[int, int]) -> tuple[int, int]:
    low, high = value
    if low < 0 or low > high:
        raise ValueError(f"rango inválido {list(value)}: debe ser [mínimo, máximo] con 0 ≤ mínimo ≤ máximo")
    return value


# [mínimo, máximo], ambos inclusive.
Range = Annotated[tuple[int, int], AfterValidator(_check_range)]


class _Rules(BaseModel):
    """Un campo desconocido es un error (un typo no debe quedar ignorado en silencio)."""

    model_config = ConfigDict(extra="forbid")


class _Strategy(_Rules):
    id: str
    piece: Piece
    name: str
    description: str


class HookStrategy(_Rules):
    name: str
    emotion: str
    template: str


class TitleStrategy(_Strategy):
    options: int = Field(ge=1)
    max_chars: int = Field(gt=0)
    distinct_emotions: bool
    hook_strategies: dict[str, HookStrategy]
    # Guía para quien escribe (persona o IA); no se valida automáticamente.
    wow_filter: list[str]


class TextOnlyRules(_Rules):
    words: Range
    lines: Range
    max_chars_per_line: int = Field(gt=0)


class WithImageRules(_Rules):
    words: Range


class ThumbnailStrategy(_Strategy):
    text_only: TextOnlyRules
    with_image: WithImageRules
    # Palabras más cortas (de, la, el…) no cuentan como repetición con el título de pareja.
    min_shared_word_length: int = Field(ge=1)
    # Guía para elegir la imagen; no se valida automáticamente.
    image_criteria: list[str]


class PlatformsStrategy(_Strategy):
    facebook_first_line_max_chars: int = Field(gt=0)
    tiktok_caption_max_chars: int = Field(gt=0)
    screen_text_words: Range
    forbidden_hashtags: list[str]


class ChapterRules(_Rules):
    min_count: int = Field(ge=1)
    min_gap_seconds: int = Field(ge=1)


class DescriptionStrategy(_Strategy):
    headings: dict[Literal["chapters", "sources", "credits"], str]
    chapters: ChapterRules
    # Largo de la descripción armada (límite de YouTube: 5000).
    max_chars: int = Field(gt=0)


class GratitudeStrategy(_Strategy):
    variants: dict[str, str]

    @model_validator(mode="after")
    def _has_variants(self) -> GratitudeStrategy:
        if not self.variants:
            raise ValueError("gratitude: hace falta al menos una variante")
        return self


class TagsStrategy(_Strategy):
    youtube_tags: Range
    youtube_tags_max_chars: int = Field(gt=0)
    youtube_hashtags: Range
    tiktok_hashtags: Range
    facebook_hashtags: Range


class CategoryProfile(_Rules):
    id: str
    channel: str
    emotion: str
    anchors: list[str]
    preferred_title_strategies: list[int]
    avoid: list[str]
    required_hashtags: dict[Literal["youtube", "tiktok", "facebook"], list[str]] = Field(default_factory=dict)


STRATEGY_MODELS: dict[Piece, type[_Strategy]] = {
    "title": TitleStrategy,
    "thumbnail": ThumbnailStrategy,
    "platforms": PlatformsStrategy,
    "description": DescriptionStrategy,
    "gratitude": GratitudeStrategy,
    "tags": TagsStrategy,
}


# ── carga (caché por fecha de archivo) ────────────────────────────────────────

_cache: dict[Path, tuple[float, Any]] = {}


def _read_cached(path: Path, parse):
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError as exc:
        raise StrategyError(f"Falta el archivo de estrategia: {path}") from exc
    cached = _cache.get(path)
    if cached and cached[0] == mtime:
        return cached[1]
    value = parse(path.read_text(encoding="utf-8"))
    _cache[path] = (mtime, value)
    return value


def load_strategy(piece: Piece, strategy_id: str) -> _Strategy:
    path = explainer_skills_dir() / "strategies" / piece / f"{strategy_id}.json"
    model = STRATEGY_MODELS[piece]

    def parse(text: str) -> _Strategy:
        try:
            strategy = model.model_validate(json.loads(text))
        except Exception as exc:
            raise StrategyError(f"Estrategia inválida '{piece}/{strategy_id}': {exc}") from exc
        if strategy.id != strategy_id or strategy.piece != piece:
            raise StrategyError(
                f"'{piece}/{strategy_id}.json' declara id '{strategy.id}' y pieza '{strategy.piece}'"
            )
        return strategy

    return _read_cached(path, parse)


def load_category(category_id: str) -> CategoryProfile:
    path = explainer_skills_dir() / "categories" / f"{category_id}.json"

    def parse(text: str) -> CategoryProfile:
        try:
            profile = CategoryProfile.model_validate(json.loads(text))
        except Exception as exc:
            raise StrategyError(f"Perfil de categoría inválido '{category_id}': {exc}") from exc
        if profile.id != category_id:
            raise StrategyError(f"'categories/{category_id}.json' declara id '{profile.id}'")
        return profile

    return _read_cached(path, parse)


@dataclass(frozen=True)
class ActiveStrategies:
    """Las estrategias que usa una categoría, una por pieza."""

    category: CategoryProfile
    title: TitleStrategy
    thumbnail: ThumbnailStrategy
    platforms: PlatformsStrategy
    description: DescriptionStrategy
    gratitude: GratitudeStrategy
    tags: TagsStrategy

    def ids(self) -> dict[str, str]:
        return {piece: getattr(self, piece).id for piece in PIECES}


class ActiveConfig(RootModel[dict[str, dict[Piece, str]]]):
    """active.json: {"_default": {pieza: id}, "<categoría>": {pieza: id}}."""


def _parse_active(text: str) -> dict[str, dict[Piece, str]]:
    try:
        return ActiveConfig.model_validate_json(text).root
    except Exception as exc:
        raise StrategyError(f"active.json inválido: {exc}") from exc


def active_strategies(category_id: str, overrides: dict[str, str] | None = None) -> ActiveStrategies:
    """Estrategia por pieza para `category_id`: `_default` + excepciones de la categoría.

    `overrides` ({"title": "title_…_v2"}) gana sobre active.json: para probar una
    estrategia nueva sobre un video sin cambiar la configuración.
    """
    unknown = sorted(set(overrides or {}) - set(PIECES))
    if unknown:
        raise StrategyError(f"piezas desconocidas {unknown}; las piezas son {list(PIECES)}")
    active = _read_cached(explainer_skills_dir() / "active.json", _parse_active)
    selection = {**active.get("_default", {}), **active.get(category_id, {}), **(overrides or {})}
    missing = [piece for piece in PIECES if not selection.get(piece)]
    if missing:
        raise StrategyError(f"active.json no define estrategia para {missing} en '{category_id}'")
    loaded = {piece: load_strategy(piece, selection[piece]) for piece in PIECES}
    return ActiveStrategies(category=load_category(category_id), **loaded)  # type: ignore[arg-type]

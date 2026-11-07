"""Copy strategies: how the title/description/tags of each platform are written.

Each strategy is a JSON file in src/skills/output/copy/strategies/ that
declares (1) the pieces the AI must write, with instructions and good/bad
examples per language, (2) output templates that assemble those pieces into
the final text, with fallbacks when a piece or fact is missing, and (3) fixed
phrases that rotate between videos. `active.json` picks one strategy per
platform — switching strategy is editing one name there; old strategies stay
on disk, versioned (…_v1, …_v2), ready to switch back to. `active.json` →
`profiles.<perfil>` overrides that selection for a kind of video (e.g.
"commercial": promos get their own strategies and their own voice,
voice_commercial.md). See src/modules/copy_writer.copy_profile.

Files are re-read when they change on disk, so editing a strategy takes
effect on the next video without restarting the server.
"""

from __future__ import annotations

import json
import string
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from src.config.settings import settings

Platform = Literal["youtube", "tiktok", "facebook", "instagram"]
PLATFORMS: tuple[Platform, ...] = ("youtube", "tiktok", "facebook", "instagram")
LANGUAGES = ("es", "en")

# Always available to templates: song identity (asked once for all platforms)
# and the `hashtags` field rendered as "#A #B #C".
COMMON_PLACEHOLDERS = {"artist", "song", "hashtags"}


def copy_dir() -> Path:
    return settings.skills_dir / "output" / "copy"


class StrategyError(ValueError):
    """A strategy file is missing, malformed or inconsistent."""


class FieldSpec(BaseModel):
    type: Literal["text", "list"]
    instruction: str
    max_chars: int | None = None
    min_items: int | None = None
    max_items: int | None = None
    examples: dict[str, list[Any]] = Field(default_factory=dict)
    avoid: dict[str, list[str]] = Field(default_factory=dict)


class OutputSpec(BaseModel):
    max_chars: int
    templates: dict[str, list[str]] = Field(default_factory=dict)
    same_as: Literal["title"] | None = None
    # Titles are flattened to one line unless the platform uses the title as a caption (TikTok).
    multiline: bool = False


class TagsSpec(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_field: str = Field(alias="from")
    style: Literal["keyword", "hashtag"]


class StrategyOutput(BaseModel):
    title: OutputSpec
    description: OutputSpec
    tags: TagsSpec
    # Comentario fijado (YouTube): solo frases de `rotating`, así nunca se sale de lo aprobado.
    pinned_comment: OutputSpec | None = None


class CopyStrategy(BaseModel):
    id: str
    platform: Platform
    name: str
    description: str
    fields: dict[str, FieldSpec]
    rotating: dict[str, dict[str, list[str]]] = Field(default_factory=dict)
    output: StrategyOutput

    @model_validator(mode="after")
    def _check_consistency(self) -> CopyStrategy:
        known = set(self.fields) | set(self.rotating) | COMMON_PLACEHOLDERS
        outputs = [("title", self.output.title), ("description", self.output.description)]
        if self.output.pinned_comment is not None:
            outputs.append(("pinned_comment", self.output.pinned_comment))
        for name, spec in outputs:
            if spec.same_as:
                continue
            for lang in LANGUAGES:
                templates = spec.templates.get(lang)
                if not templates:
                    raise ValueError(f"output.{name} has no templates for language '{lang}'")
                for template in templates:
                    unknown = placeholders(template) - known
                    if unknown:
                        raise ValueError(f"output.{name} template uses unknown placeholders {sorted(unknown)}")
        tags_field = self.fields.get(self.output.tags.from_field)
        if tags_field is None or tags_field.type != "list":
            raise ValueError(f"output.tags.from must name a list field, got '{self.output.tags.from_field}'")
        for key, phrases in self.rotating.items():
            for lang in LANGUAGES:
                if not phrases.get(lang):
                    raise ValueError(f"rotating.{key} has no phrases for language '{lang}'")
        return self


def placeholders(template: str) -> set[str]:
    return {name for _, name, _, _ in string.Formatter().parse(template) if name}


# ── loading (cached by file mtime) ───────────────────────────────────────────

_cache: dict[Path, tuple[float, Any]] = {}


def _read_cached(path: Path, parse):
    try:
        mtime = path.stat().st_mtime
    except FileNotFoundError as exc:
        raise StrategyError(f"Missing copy file: {path}") from exc
    cached = _cache.get(path)
    if cached and cached[0] == mtime:
        return cached[1]
    value = parse(path.read_text(encoding="utf-8"))
    _cache[path] = (mtime, value)
    return value


def load_strategy(strategy_id: str) -> CopyStrategy:
    path = copy_dir() / "strategies" / f"{strategy_id}.json"

    def parse(text: str) -> CopyStrategy:
        try:
            strategy = CopyStrategy.model_validate(json.loads(text))
        except Exception as exc:
            raise StrategyError(f"Invalid copy strategy '{strategy_id}': {exc}") from exc
        if strategy.id != strategy_id:
            raise StrategyError(f"Strategy file '{strategy_id}.json' declares id '{strategy.id}'")
        return strategy

    return _read_cached(path, parse)


def list_strategies() -> list[CopyStrategy]:
    return [load_strategy(p.stem) for p in sorted((copy_dir() / "strategies").glob("*.json"))]


def active_strategies(
    overrides: dict[str, str] | None = None, profile: str | None = None
) -> dict[Platform, CopyStrategy]:
    """Strategy per platform from active.json, then `profiles[profile]` (kind of video, e.g.
    "commercial"), then `overrides` ({"youtube": "yt_…"}) for previews/tests."""
    active: dict[str, Any] = dict(_read_cached(copy_dir() / "active.json", json.loads))
    profiles = active.pop("profiles", {}) or {}
    if profile and profile not in profiles:
        raise StrategyError(f"Unknown copy profile '{profile}' (active.json → profiles)")
    selection: dict[str, str] = {k: v for k, v in active.items() if isinstance(v, str)}
    selection.update(profiles.get(profile, {}) if profile else {})
    selection.update(overrides or {})
    result: dict[Platform, CopyStrategy] = {}
    for platform in PLATFORMS:
        strategy_id = selection.get(platform)
        if not strategy_id:
            continue
        strategy = load_strategy(strategy_id)
        if strategy.platform != platform:
            raise StrategyError(f"Strategy '{strategy_id}' is for {strategy.platform}, not {platform}")
        result[platform] = strategy
    return result


def load_voice(profile: str | None = None) -> str:
    """voice.md, or voice_<profile>.md when that kind of video has its own voice."""
    path = copy_dir() / f"voice_{profile}.md" if profile else copy_dir() / "voice.md"
    if profile and not path.exists():
        path = copy_dir() / "voice.md"
    return _read_cached(path, str)

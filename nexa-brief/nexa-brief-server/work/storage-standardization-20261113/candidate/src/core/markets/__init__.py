"""Canonical edition markets; legacy metadata remains restricted to es/en."""
from dataclasses import dataclass
from functools import lru_cache
import json
from pathlib import Path


@dataclass(frozen=True)
class Market:
    locale: str
    aliases: tuple[str, ...]
    label: str
    name: str
    native_name: str
    whisper: str
    tts: str
    transcription_prompt: str


@lru_cache(maxsize=1)
def _registry():
    return json.loads(Path(__file__).with_name("markets.json").read_text(encoding="utf-8"))


def markets() -> tuple[Market, ...]:
    return tuple(Market(**{**v, "aliases": tuple(v["aliases"])}) for v in _registry()["markets"].values())


def normalize_locale(value: str | None = None) -> str:
    key = (value or _registry()["default_locale"]).strip().lower().replace("_", "-")
    for market in markets():
        if key in (market.locale.lower(), *market.aliases):
            return market.locale
    raise ValueError(f"Unsupported market: {value!r}")


def get_market(value: str | None = None) -> Market:
    locale = normalize_locale(value)
    return next(m for m in markets() if m.locale == locale)


def legacy_language(value: str) -> str | None:
    """Do not extend the es/en song-metadata contract when adding edition markets."""
    try:
        code = get_market(value).whisper
    except ValueError:
        return None
    return code if code in ("es", "en") else None

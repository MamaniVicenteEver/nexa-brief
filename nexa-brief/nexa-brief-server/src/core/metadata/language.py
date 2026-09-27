"""Content language for published metadata — only Spanish or English.

The title/description/tags are written in the language of the song so they
match what viewers of that song actually search for. Anything that isn't
clearly Spanish or English (instrumental tracks, other languages, low
confidence) falls back to `settings.metadata_default_language`.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Literal

ContentLanguage = Literal["es", "en"]
SUPPORTED_LANGUAGES: tuple[ContentLanguage, ...] = ("es", "en")

LanguageSource = Literal["user", "lyrics", "audio", "default"]

_ALIASES: dict[str, ContentLanguage] = {
    "es": "es", "spa": "es", "spanish": "es", "español": "es", "espanol": "es", "castellano": "es",
    "en": "en", "eng": "en", "english": "en", "inglés": "en", "ingles": "en",
}


@dataclass(frozen=True)
class ResolvedLanguage:
    code: ContentLanguage
    source: LanguageSource
    confidence: float | None = None


def normalize_language(value: str | None) -> ContentLanguage | None:
    """'es-ES', 'Spanish', 'español' → 'es'; unsupported or empty → None."""
    if not value:
        return None
    key = value.strip().lower().replace("_", "-")
    return _ALIASES.get(key) or _ALIASES.get(key.split("-")[0])


def language_from_lyrics(lyrics_json: dict[str, Any] | None, min_confidence: float) -> ResolvedLanguage | None:
    """Language Whisper detected while transcribing the lyrics, if it's es/en and confident enough."""
    meta = (lyrics_json or {}).get("metadata") or {}
    code = normalize_language(meta.get("language"))
    confidence = meta.get("language_probability")
    if code is None or (confidence is not None and confidence < min_confidence):
        return None
    return ResolvedLanguage(code, "lyrics", confidence)


def pick_from_probabilities(probabilities: dict[str, float], min_confidence: float) -> ResolvedLanguage | None:
    """Choose es/en from detector probabilities.

    `min_confidence` applies to es+en combined (is there Spanish/English
    singing at all?), then the larger of the two wins — so a bilingual track
    still resolves instead of failing both thresholds individually.
    """
    es, en = probabilities.get("es", 0.0), probabilities.get("en", 0.0)
    if es + en < min_confidence:
        return None
    code: ContentLanguage = "es" if es >= en else "en"
    return ResolvedLanguage(code, "audio", round(max(es, en) / (es + en), 3))

"""Modelo básico que redacta la ficha de una canción a partir de fuentes ya consultadas."""

from __future__ import annotations

import json
from typing import Any

from src.config.settings import BASE_DIR
from src.core.library.music_enrichment import MusicResearch

ROLE = "music_researcher"
_PROMPTS = BASE_DIR / "src" / "skills" / "library" / "enrich"


async def ask_music_researcher(facts: dict[str, Any]) -> MusicResearch:
    from src.adapters.models.hub import text_json_with_usage

    system = (_PROMPTS / "prompt.md").read_text(encoding="utf-8")
    schema = json.loads((_PROMPTS / "output.schema.json").read_text(encoding="utf-8"))
    value, _usage = await text_json_with_usage(
        ROLE, system, json.dumps(facts, ensure_ascii=False), structured=True, schema=schema
    )
    return MusicResearch.model_validate(value)

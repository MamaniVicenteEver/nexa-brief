"""JSON catalog adapter and deterministic plan seed."""

from __future__ import annotations

import json
from functools import lru_cache

from src.academy.models import AcademyCatalog, CategoryConfig, LevelConfig
from src.config.settings import BASE_DIR


CATALOG_PATH = BASE_DIR / "data" / "academy" / "catalog.json"


@lru_cache(maxsize=1)
def load_catalog() -> AcademyCatalog:
    return AcademyCatalog.model_validate_json(CATALOG_PATH.read_text(encoding="utf-8"))


def refresh_catalog_cache() -> None:
    load_catalog.cache_clear()


def list_categories() -> list[CategoryConfig]:
    return load_catalog().categories


def get_category(category_id: str) -> CategoryConfig:
    for category in list_categories():
        if category.id == category_id:
            return category
    raise KeyError(f"Unknown Academy category: {category_id}")


def get_level(category_id: str, level_id: str) -> LevelConfig:
    category = get_category(category_id)
    for level in category.levels:
        if level.id == level_id:
            return level
    raise KeyError(f"Unknown level '{level_id}' for category '{category_id}'")


def catalog_as_dict() -> dict:
    return json.loads(load_catalog().model_dump_json())

"""Estrategias narrativas como archivos JSON (adapter de NarrativeRepositoryPort).

    <root>/<narrative_id>.json   una estrategia (el id declarado tiene que coincidir con el nombre)
    <root>/_active.json          {"_default": "<id>", "<categoría>": "<id>"}

Los archivos se releen cuando cambian (caché por fecha), así que editar un JSON no pide reiniciar.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from src.core.explainer.narrative.errors import NarrativeInvalid, NarrativeNotFound
from src.core.explainer.narrative.models import NarrativeStrategy

ACTIVE_FILE = "_active.json"


class JsonNarrativeRepository:
    def __init__(self, root: Path) -> None:
        self.root = root
        self._cache: dict[Path, tuple[float, Any]] = {}

    def _read(self, path: Path, parse):
        mtime = path.stat().st_mtime
        cached = self._cache.get(path)
        if cached and cached[0] == mtime:
            return cached[1]
        value = parse(path.read_text(encoding="utf-8"))
        self._cache[path] = (mtime, value)
        return value

    def list_ids(self) -> list[str]:
        if not self.root.is_dir():
            return []
        return [p.stem for p in sorted(self.root.glob("*.json")) if not p.name.startswith("_")]

    def load(self, narrative_id: str) -> NarrativeStrategy:
        path = self.root / f"{narrative_id}.json"
        if not path.is_file():
            raise NarrativeNotFound(
                f"no existe; disponibles: {self.list_ids()}", narrative_id=narrative_id, path=path
            )

        def parse(text: str) -> NarrativeStrategy:
            try:
                strategy = NarrativeStrategy.model_validate(json.loads(text))
            except json.JSONDecodeError as exc:
                raise NarrativeInvalid(f"JSON mal formado: {exc}", narrative_id=narrative_id, path=path) from exc
            except ValidationError as exc:
                first = exc.errors()[0]
                field = ".".join(str(x) for x in first["loc"]) or None
                raise NarrativeInvalid(
                    f"{first['msg']} ({exc.error_count()} error/es)", narrative_id=narrative_id, path=path, field=field
                ) from exc
            if strategy.id != narrative_id:
                raise NarrativeInvalid(
                    f"declara id '{strategy.id}' distinto del nombre del archivo", narrative_id=narrative_id, path=path, field="id"
                )
            return strategy

        return self._read(path, parse)

    def default_id(self, category_id: str) -> str:
        path = self.root / ACTIVE_FILE
        if not path.is_file():
            raise NarrativeNotFound("falta el archivo de defaults", path=path)

        def parse(text: str) -> dict[str, str]:
            try:
                data = json.loads(text)
            except json.JSONDecodeError as exc:
                raise NarrativeInvalid(f"JSON mal formado: {exc}", path=path) from exc
            if not isinstance(data, dict) or not all(isinstance(v, str) for v in data.values()):
                raise NarrativeInvalid('debe ser {"_default": "<id>", "<categoría>": "<id>"}', path=path)
            return data

        active = self._read(path, parse)
        selected = active.get(category_id) or active.get("_default")
        if not selected:
            raise NarrativeInvalid(f"no define '_default' ni '{category_id}'", path=path, field="_default")
        return selected

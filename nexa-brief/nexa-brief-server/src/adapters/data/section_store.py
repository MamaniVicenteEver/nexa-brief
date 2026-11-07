"""Transactional JSON sections for profile layout v3.

Namespaces in one section share the same file lock and revision. Records and
keyed documents coexist without exposing physical paths to the domain ports.
"""
from __future__ import annotations

import copy
import json
import os
import tempfile
from pathlib import Path
from typing import Any, Callable

from src.adapters.data.file_locks import AsyncFileLock, file_lock
from src.adapters.data.runtime_paths import assert_profile_path, lock_path, temporary_dir
from src.adapters.data.section_names import COLLECTION_SECTIONS as COLLECTION_SECTIONS
from src.adapters.data.section_names import DOCUMENT_SECTIONS as DOCUMENT_SECTIONS
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings



def is_v3() -> bool:
    return layout_for_settings(settings).schema_version >= 3


class Section:
    def __init__(self, name: str, data_dir: Path | None = None):
        self.name = name
        self.data_dir = data_dir

    @property
    def path(self) -> Path:
        layout = layout_for_settings(settings)
        path = (self.data_dir or layout.data_dir) / "json" / f"{self.name}.json"
        assert_profile_path(path)
        return path

    @staticmethod
    def read_path(path: Path) -> dict[str, Any]:
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            return {"schema_version": 1, "revision": 0, "collections": {}, "documents": {}}
        except (json.JSONDecodeError, OSError) as exc:
            raise RuntimeError(f"Invalid JSON section: {path.name}") from exc
        if (not isinstance(data, dict) or data.get("schema_version") != 1
                or type(data.get("revision")) is not int or data["revision"] < 0
                or not isinstance(data.get("collections"), dict)
                or not isinstance(data.get("documents"), dict)):
            raise RuntimeError(f"Invalid JSON section: {path.name}")
        return data

    def read(self) -> dict[str, Any]:
        return self.read_path(self.path)

    @staticmethod
    def write_path(path: Path, data: dict[str, Any]) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(prefix=f".{path.name}.", dir=temporary_dir(path))
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as stream:
                json.dump(data, stream, ensure_ascii=False, indent=2)
                stream.flush()
                os.fsync(stream.fileno())
            os.replace(tmp, path)
            directory = os.open(path.parent, os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
        finally:
            if os.path.exists(tmp):
                os.unlink(tmp)

    def mutate(self, fn: Callable[[dict[str, Any]], Any]) -> Any:
        path = self.path
        with file_lock(lock_path(path)):
            data = self.read_path(path)
            before = copy.deepcopy(data)
            result = fn(data)
            if data != before:
                data["revision"] += 1
                self.write_path(path, data)
            return result

    async def mutate_async(self, fn: Callable[[dict[str, Any]], Any]) -> Any:
        path = self.path
        async with AsyncFileLock(lock_path(path)):
            data = self.read_path(path)
            before = copy.deepcopy(data)
            result = fn(data)
            if data != before:
                data["revision"] += 1
                self.write_path(path, data)
            return result

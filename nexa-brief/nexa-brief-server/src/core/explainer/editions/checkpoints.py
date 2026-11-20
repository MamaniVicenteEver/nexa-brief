"""Content-addressed checkpoints: reuse expensive steps only with matching inputs/files."""
from __future__ import annotations

import hashlib
import json

from .io import read, safe, write


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, ensure_ascii=False,
                                     separators=(",", ":")).encode()).hexdigest()


def file_hash(path):
    value = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            value.update(chunk)
    return value.hexdigest()


class Checkpoints:
    def __init__(self, stage, edition):
        self.stage = stage
        self.path = safe(stage, "checkpoints.json")
        self.edition_hash = digest(edition.model_dump(by_alias=True))
        self.data = read(self.path) if self.path.is_file() else {
            "schema_version": 1, "edition_hash": self.edition_hash, "steps": {}}
        if self.data.get("schema_version") != 1 or self.data.get("edition_hash") != self.edition_hash:
            raise ValueError("La edición no coincide con sus puntos de recuperación")

    def initialize(self):
        """Reserve recovery before the first provider, not only after its success."""
        if not self.path.exists():
            write(self.path, self.data)

    def valid(self, step, inputs):
        record = self.data["steps"].get(step)
        if not record or record["inputs"] != digest(inputs):
            return False
        for name, expected in record["files"].items():
            path = safe(self.stage, name)
            if not path.is_file() or file_hash(path) != expected:
                return False
        return True

    def save(self, step, inputs, names):
        files = {name: file_hash(safe(self.stage, name)) for name in names}
        self.data["steps"][step] = {"inputs": digest(inputs), "files": files}
        write(self.path, self.data)

    def verify(self):
        for step, record in self.data["steps"].items():
            for name, expected in record["files"].items():
                path = safe(self.stage, name)
                if not path.is_file() or file_hash(path) != expected:
                    raise ValueError(f"El artefacto guardado cambió: {step}/{name}")

"""Catálogo local de pistas verificadas, fuera de Git."""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass
from pathlib import Path

from src.config.settings import settings
from src.core.image_posts.models import MusicOption


@dataclass(frozen=True)
class LicensedTrack:
    path: Path
    data: dict


class LicensedReelMusic:
    def __init__(self, data_dir: Path | None = None) -> None:
        self.root = (data_dir or settings.data_dir) / "media-cache" / "reel_music"

    def list(self) -> list[dict]:
        path = self.root / "catalog.json"
        if not path.is_file():
            return []
        data = json.loads(path.read_text(encoding="utf-8"))
        if data.get("schema_version") != 1:
            raise ValueError("Catálogo musical con versión desconocida")
        return [row for row in data.get("tracks", []) if self._eligible(row)]

    @staticmethod
    def _eligible(row: dict) -> bool:
        if not row.get("commercial_sync") or not row.get("instrumental"):
            return False
        license_data = row.get("license") or {}
        name = str(license_data.get("spdx_or_name") or "").strip().casefold()
        if re.search(r"\b(?:nc|nd|sa)\b|non[ -]?commercial|no[ -]?derivatives", name):
            return False
        allowed = name in {"cc0", "cc0-1.0", "cc-0"} or bool(
            re.fullmatch(r"cc[ -]by[ -][1-9]\d*(?:\.\d+){1,2}", name)
        )
        return bool(
            allowed
            and all(license_data.get(field) for field in ("url", "author", "track_url", "proof_ref"))
            and re.fullmatch(r"[a-fA-F0-9]{64}", str(row.get("source_sha256") or ""))
        )

    def resolve(self, option: MusicOption) -> LicensedTrack:
        row = next((item for item in self.list() if item.get("music_asset_id") == option.music_asset_id), None)
        if row is None:
            raise ValueError("Pista sin licencia verificada en el catálogo")
        supplied_license = option.license.model_dump() if option.license else None
        if row.get("source_sha256") != option.source_sha256 or row.get("license") != supplied_license:
            raise ValueError("La licencia o el hash no coinciden con el catálogo")
        name = row.get("file", "")
        if not name or Path(name).name != name or not name.endswith(".mp3"):
            raise ValueError("Archivo musical inválido")
        path = self.root / name
        if not path.is_file() or path.is_symlink():
            raise ValueError("La pista no está disponible")
        if hashlib.sha256(path.read_bytes()).hexdigest() != row["source_sha256"]:
            raise ValueError("El archivo musical cambió desde la verificación")
        return LicensedTrack(path=path, data=row)

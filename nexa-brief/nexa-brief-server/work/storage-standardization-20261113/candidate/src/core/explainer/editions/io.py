from __future__ import annotations

import json
import os
import re
import tempfile
from pathlib import Path

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.config.storage_profile import load_profile


def read(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix=".edition-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name):
            os.unlink(name)


def safe(root: Path, *parts: str) -> Path:
    candidate = root.joinpath(*parts)
    resolved = candidate.resolve()
    if not resolved.is_relative_to(root.resolve()) or candidate.absolute() != resolved:
        raise ValueError("La edición no admite rutas externas ni enlaces simbólicos")
    return candidate


def profile_for(production: Path):
    layout = layout_for_settings(settings)
    if layout.schema_version < 2 or not settings.storage_profile_dir:
        raise ValueError("Las ediciones requieren un perfil v2/v3 explícito")
    manifest = load_profile(layout.root)
    if manifest["schema_version"] != layout.schema_version or layout.root.absolute() != layout.root.resolve():
        raise ValueError("El perfil efectivo y su manifiesto no coinciden")
    production = safe(layout.productions_dir, str(production.relative_to(layout.productions_dir)))
    if len(production.relative_to(layout.productions_dir).parts) != 2 or not production.is_dir():
        raise ValueError("Producción fuera del perfil autorizado")
    return layout


def active_config(production: Path) -> dict:
    value = read(safe(production, "assets/config.json"))
    if "configs" in value:
        return next((c for c in value["configs"] if c.get("id") == value.get("activeId")), value["configs"][0])
    return value


def active_revision(production: Path, locale: str) -> Path | None:
    from src.core.markets import normalize_locale
    locale = normalize_locale(locale)
    pointer = safe(production, "languages", locale, "active.json")
    if not pointer.is_file():
        return None
    revision = read(pointer).get("revision", "")
    if not re.fullmatch(r"rev-\d{3,}", revision):
        raise ValueError("Revisión activa inválida")
    folder = safe(production, "languages", locale, "revisions", revision)
    if not folder.is_dir():
        raise ValueError("Revisión activa inexistente")
    return folder

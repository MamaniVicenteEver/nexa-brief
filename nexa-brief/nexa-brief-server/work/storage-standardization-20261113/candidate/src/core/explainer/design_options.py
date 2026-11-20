"""Optional per-design presentation and YouTube publishing defaults.

Episode manifest values override <design>/options.json. Missing values preserve
the existing desktop presentation and omit a YouTube category on upload.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any

from src.config.settings import BASE_DIR

DESIGN_OPTIONS_DIR = BASE_DIR / "src/templates/_tools/design-definitions"


def resolve_design_options(design_id: str, manifest: dict[str, Any], *, root: Path | None = None) -> dict[str, str | None]:
    options: dict[str, Any] = {}
    if re.fullmatch(r"[a-z0-9][a-z0-9_-]*", design_id):
        path = (root or DESIGN_OPTIONS_DIR) / design_id / "options.json"
        if path.is_file():
            value = json.loads(path.read_text(encoding="utf-8"))
            if not isinstance(value, dict):
                raise ValueError(f"Opciones de diseño inválidas: {design_id}")
            options = value
    mode = manifest.get("preview_mode", options.get("preview_mode", "desktop"))
    if mode not in ("desktop", "mobile"):
        raise ValueError(f"preview_mode inválido: {mode!r}")
    category = manifest.get("youtube_category_id", options.get("youtube_category_id"))
    if category is not None:
        category = str(category).strip()
        if not re.fullmatch(r"[0-9]+", category):
            raise ValueError("youtube_category_id debe ser un ID numérico de YouTube o null")
    return {"preview_mode": mode, "youtube_category_id": category}

"""Selección común del caso activo de configuraciones de plantillas."""

from __future__ import annotations


def active_config(raw: dict) -> dict:
    """Selecciona activeId o el primer caso válido, como el runtime de plantillas."""
    if not isinstance(raw, dict):
        raise ValueError("configuración inválida")
    if "configs" not in raw:
        return raw
    cases = raw["configs"]
    if not isinstance(cases, list) or not cases or not all(isinstance(item, dict) for item in cases):
        raise ValueError("colección de config vacía o inválida")
    active_id = raw.get("activeId")
    return next((item for item in cases if item.get("id") == active_id), cases[0])

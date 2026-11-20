"""Interruptor de IA del perfil.

Con el interruptor apagado (archivo `.system/ai-switch.json` con {"enabled": false}) ningún agente
se llama: la vista previa no usa IA, Preparar deja los textos y las miniaturas pendientes (sin
error) y la grabación sigue. Sin el archivo, la IA está activa. No requiere reiniciar el servicio.
"""

from __future__ import annotations

import json
from contextvars import ContextVar
from pathlib import Path

import structlog

logger = structlog.get_logger(__name__)

# True mientras corre la vista previa de un borrador: ningún agente se llama durante la vista previa.
ai_preview: ContextVar[bool] = ContextVar("ai_preview", default=False)


class AIUnavailableError(RuntimeError):
    """La IA no está disponible: el dato queda pendiente, no es un fallo del servidor."""


def _switch_path() -> Path:
    from src.config.profile_layout import layout_for_settings
    from src.config.settings import settings

    return layout_for_settings(settings).system_dir / "ai-switch.json"


def ai_enabled() -> bool:
    if ai_preview.get():
        return False
    try:
        data = json.loads(_switch_path().read_text(encoding="utf-8"))
    except FileNotFoundError:
        return True
    except (OSError, ValueError):
        logger.warning("ai_switch_unreadable", path=str(_switch_path()))
        return True
    return bool(data.get("enabled", True)) if isinstance(data, dict) else True


def set_ai_enabled(enabled: bool) -> None:
    path = _switch_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps({"enabled": bool(enabled)}), encoding="utf-8")


def require_ai(what: str) -> None:
    if not ai_enabled():
        raise AIUnavailableError(f"IA no disponible ({what}): el dato queda pendiente.")

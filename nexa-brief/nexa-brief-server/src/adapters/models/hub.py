"""Model Hub — un solo lugar para pedir "el modelo que hace X".

Los roles (qué proveedor hace cada trabajo) viven en datos: src/skills/models/roles.json, que
también lee el kit (tools/delegate.py). Cambiar un proveedor ahí cambia a quién se le pide, sin
tocar código. Este módulo solo traduce rol → adaptador:

  agentes locales (CLI, con la suscripción de la máquina): codex, claude  → AgentRunnerPort
  modelos por API (texto/JSON):                             deepseek, gemini → AIPort

Guía para personas y agentes: src/templates/_tools/explainer-kit/guides/orquestacion.md
"""

from __future__ import annotations

import json
import time
from functools import lru_cache

from src.config.settings import BASE_DIR, settings
from src.core.ports.agent_port import AgentRunnerPort
from src.core.ports.ai_port import AIPort

ROLES_FILE = BASE_DIR / "src" / "skills" / "models" / "roles.json"
AGENT_PROVIDERS = ("codex", "claude")


@lru_cache(maxsize=1)
def roles_config() -> dict:
    return json.loads(ROLES_FILE.read_text(encoding="utf-8"))


def provider_for(role: str) -> str:
    try:
        return roles_config()["roles"][role]["provider"]
    except KeyError as exc:
        raise ValueError(f"model hub: rol desconocido {role!r}") from exc


def model_for(role: str) -> str:
    """Modelo concreto del rol ('' = el que use el proveedor por defecto)."""
    cfg = roles_config()
    spec = cfg["roles"][role]
    provider = spec["provider"]
    if spec.get("model"):
        alias = spec["model"]
        return (cfg["providers"].get(provider, {}).get("models") or {}).get(alias, alias)
    if provider == "codex":
        return settings.agent_codex_model
    return ""


def agent_for(role: str) -> AgentRunnerPort:
    """Agente local que cumple el rol (producer, research, script…)."""
    provider = provider_for(role)
    if provider not in AGENT_PROVIDERS:
        raise ValueError(f"el rol {role!r} lo hace {provider}, que no es un agente local")
    from src.adapters.agent.factory import get_agent

    return get_agent(provider)


def text_for(role: str) -> AIPort:
    """Modelo de texto/JSON que cumple el rol (planner, copy…)."""
    provider = provider_for(role)
    if provider == "gemini":
        from src.adapters.ai.factory import get_analysis_ai

        return get_analysis_ai()
    from src.adapters.ai.factory import get_text_ai

    return get_text_ai(provider)


async def text_json_with_usage(role: str, system: str, prompt: str) -> tuple[dict, dict]:
    """Obtiene JSON y uso real cuando el proveedor lo expone; desconocido queda nulo."""
    adapter = text_for(role)
    measured = getattr(adapter, "complete_json_with_usage", None)
    if measured is not None:
        result, usage = await measured(system, prompt)
    else:
        started = time.monotonic()
        result = await adapter.complete_json(system, prompt)
        usage = {"provider": provider_for(role), "model": model_for(role),
                 "seconds": round(time.monotonic() - started, 2)}
    return result, {**usage, "role": role}


def describe() -> list[dict]:
    """[{role, provider, model, billing, does}] para la web y los reportes."""
    cfg = roles_config()
    out = []
    for role, spec in cfg["roles"].items():
        provider = spec["provider"]
        out.append({
            "role": role,
            "provider": provider,
            "model": model_for(role),
            "billing": cfg["providers"].get(provider, {}).get("billing", ""),
            "does": spec.get("does", ""),
        })
    return out

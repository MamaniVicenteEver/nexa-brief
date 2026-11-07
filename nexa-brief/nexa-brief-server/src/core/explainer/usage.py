"""Registro de uso de modelos de un video (work/usage.jsonl → usage.json).

La fuente del formato es la herramienta del kit (explainer-kit/tools/usage.py), que también
usan la voz, la delegación a DeepSeek y cada comando del kit. El backend la carga tal cual para
anotar las corridas de los agentes locales (Codex / Claude) en el mismo archivo.
"""

from __future__ import annotations

import importlib.util
from functools import lru_cache
from pathlib import Path
from types import ModuleType

from src.core.explainer.designs import KIT_DIR
from src.core.ports.agent_port import AgentRunResult


@lru_cache(maxsize=1)
def _tool() -> ModuleType:
    spec = importlib.util.spec_from_file_location("explainer_kit_usage", KIT_DIR / "tools" / "usage.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def record_agent_run(video_dir: Path, agent: str, result: AgentRunResult, *, role: str = "producer", step: str = "") -> dict:
    """Una línea por corrida del agente (los tokens son la suma de todas sus vueltas)."""
    usage = result.usage or {}
    note = f"{usage.get('turns', 0)} vueltas del agente" if usage else "el CLI no informó tokens"
    if usage.get("cost_usd") is not None:
        note += f" · costo informado {usage['cost_usd']} USD"
    if result.timed_out:
        note += " · se cortó por tiempo"
    return _tool().record(
        video_dir, provider=agent, model=result.model, role=role, step=step, seconds=result.duration_seconds,
        ok=result.ok, note=note,
        input_tokens=usage.get("input_tokens"), cached_input_tokens=usage.get("cached_input_tokens"),
        output_tokens=usage.get("output_tokens"), reasoning_tokens=usage.get("reasoning_tokens"),
    )


def summarize(video_dir: Path) -> dict:
    return _tool().summarize(video_dir)

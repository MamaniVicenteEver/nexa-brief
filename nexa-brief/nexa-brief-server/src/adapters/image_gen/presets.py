"""Modelos del agente Codex; no son el modelo interno de imagen."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Preset:
    model: str
    effort: str


PRESETS = {
    "luna-xhigh": Preset("gpt-6-luna", "xhigh"),
    "sol-high": Preset("gpt-6-sol", "high"),
    "sol-xhigh": Preset("gpt-6-sol", "xhigh"),
}


def get_preset(name: str) -> Preset:
    try:
        return PRESETS[name]
    except KeyError as exc:
        raise ValueError(f"Preset desconocido: {name}. Opciones: {', '.join(PRESETS)}") from exc

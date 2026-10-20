#!/usr/bin/env python3
"""Rangos de un video según su duración objetivo (lengths.json, fuente única).

El guion declara `target_minutes` en assets/script.json (lo escribe `kit.py new --minutes`).
Sin ese campo el video es del formato corto anterior (3–4,5 min) y usa los rangos `legacy`.

    from lengths import targets
    t = targets(10, wpm=(115, 130))   # {'minutes': 10, 'words': [1092, 1404], 'segments': [30, 45], …}

Uso por consola (para mirar los rangos):
  .venv/bin/python src/templates/_tools/explainer-kit/tools/lengths.py 10 --design binary
"""
from __future__ import annotations

import argparse, json, math, pathlib

KIT = pathlib.Path(__file__).resolve().parents[1]
SPEC = json.loads((KIT / "lengths.json").read_text(encoding="utf-8"))
DEFAULT_WPM = (120, 130)


def design_wpm(design: str) -> tuple[int, int]:
    path = KIT / "designs" / design / "design.json"
    if path.exists():
        wpm = json.loads(path.read_text(encoding="utf-8")).get("voice", {}).get("target_wpm")
        if isinstance(wpm, list) and len(wpm) == 2:
            return int(wpm[0]), int(wpm[1])
    return DEFAULT_WPM


def clamp_minutes(minutes: float) -> float:
    return max(SPEC["min_minutes"], min(SPEC["max_minutes"], float(minutes)))


def domain_components(minutes: float) -> int:
    """Mínimo de componentes propios del tema (si el tema tiene objetos que el catálogo no dibuja)."""
    need = 0
    for step in SPEC["domain_components"]:
        if minutes >= step["from_minutes"]:
            need = step["min"]
    return need


def targets(minutes: float | None, wpm: tuple[int, int] = DEFAULT_WPM) -> dict:
    """Rangos [mín, máx] de palabras, segmentos, fotos, letras grandes, planos y capítulos."""
    if not minutes:
        legacy = {k: v for k, v in SPEC["legacy"].items() if not k.startswith("_")}
        return {"minutes": None, "legacy": True, **legacy}
    m = clamp_minutes(minutes)
    lo, hi = SPEC["words_margin"]
    out = {"minutes": m, "legacy": False, "words": [math.floor(m * wpm[0] * lo), math.ceil(m * wpm[1] * hi)]}
    for key, (a, b) in SPEC["per_minute"].items():
        out[key] = [max(1, math.floor(m * a)), max(1, math.ceil(m * b))]
    c_lo, c_hi = SPEC["chapter_seconds"]
    out["chapters"] = [max(2, math.floor(m * 60 / c_hi)), max(2, math.ceil(m * 60 / c_lo))]
    out["domain_components"] = domain_components(m)
    return out


def of_script(script: dict, design: str | None = None) -> dict:
    """Rangos del video a partir de su script.json (target_minutes + voz del diseño)."""
    return targets(script.get("target_minutes"), design_wpm(design or script.get("design", "binary")))


def agent_timeout_seconds(minutes: float | None) -> int:
    """Tiempo máximo del agente que produce el video (investigar, voz, Whisper en CPU, storyboard)."""
    a = SPEC["agent_minutes"]
    return int((a["base"] + a["per_video_minute"] * clamp_minutes(minutes or SPEC["min_minutes"])) * 60)


def voice_parts(words: int) -> int:
    """Pedidos de TTS para un guion de `words` palabras (un pedido muy largo falla o se corta)."""
    return max(1, math.ceil(words / SPEC["voice_words_per_request"]))


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("minutes", type=float)
    ap.add_argument("--design", default="binary")
    a = ap.parse_args()
    print(json.dumps(targets(a.minutes, design_wpm(a.design)), ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()

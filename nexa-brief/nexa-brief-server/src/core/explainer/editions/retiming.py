"""Meet main-scene reading minima with bounded, auditable cue displacement."""
from __future__ import annotations

import math

MAX_CUE_SHIFT_SECONDS = 1.5


def fit_main_scenes(beats, duration, minimums, layers, *, max_shift=MAX_CUE_SHIFT_SECONDS):
    rows = [(i, beat) for i, beat in enumerate(beats)
            if (beat.get("layer") or layers.get(beat["use"], "main")) == "main"]
    if not rows:
        return []
    targets = [float(beat.get("t", 0)) for _, beat in rows] + [duration]
    if targets[0] != 0 or any(not math.isfinite(t) or t < 0 or t >= duration for t in targets[:-1]):
        raise ValueError("Escena fuera del audio")
    if any(a > b for a, b in zip(targets, targets[1:])):
        raise ValueError("Orden de escenas inválido")
    mins = [float(beat.get("minDur", minimums.get(beat["use"], .2))) for _, beat in rows]
    if any(not math.isfinite(m) or m <= 0 for m in mins):
        raise ValueError("minDur inválido")
    if all(b - a + .001 >= m for a, b, m in zip(targets, targets[1:], mins)):
        return []
    lower = [0.] + [max(0., t - max_shift) for t in targets[1:-1]] + [duration]
    upper = [0.] + [min(duration, t + max_shift) for t in targets[1:-1]] + [duration]
    for i, minimum in enumerate(mins):
        lower[i + 1] = max(lower[i + 1], lower[i] + minimum)
    for i in range(len(mins) - 1, -1, -1):
        upper[i] = min(upper[i], upper[i + 1] - mins[i])
    if any(lo > hi + .0001 for lo, hi in zip(lower, upper)):
        short = [f"escena {index} ({beat['use']}): {targets[i + 1] - targets[i]:.2f}s disponibles, mínimo {mins[i]:.2f}s"
                 for i, (index, beat) in enumerate(rows)
                 if targets[i + 1] - targets[i] + .001 < mins[i]]
        detail = "; ".join(short[:5]) or "duraciones incompatibles entre escenas consecutivas"
        raise ValueError(f"No se cumple minDur dentro de ±{max_shift}s de las anclas; requiere edición del montaje: {detail}")
    fitted, warnings = [0.], []
    for i, (index, beat) in enumerate(rows[1:], 1):
        value = round(min(upper[i], max(targets[i], lower[i], fitted[-1] + mins[i - 1])), 3)
        fitted.append(value)
        if abs(value - targets[i]) > .001:
            beat["t"] = value
            warnings.append({"kind": "cue_shift_for_minimum", "scene": f"scene.{index}",
                             "semantic_time": targets[i], "render_time": value,
                             "shift_seconds": round(value - targets[i], 3), "max_shift_seconds": max_shift})
    return warnings

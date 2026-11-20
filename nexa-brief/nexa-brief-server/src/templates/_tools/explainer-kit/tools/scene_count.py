"""Momentos narrados de una campaña continua, además de los beats del storyboard."""
from __future__ import annotations

import re
import unicodedata


def _normal(text: str) -> str:
    text = unicodedata.normalize("NFD", text.casefold())
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return " ".join(re.findall(r"\w+", text))


def storyboard_moments(storyboard: dict, lyrics: dict) -> int:
    """Cuenta hitos con destino y ancla real; no cuenta cámaras ni apoyos decorativos."""
    beats = storyboard.get("beats", [])
    spoken = " " + _normal(" ".join(
        s.get("text", "") for s in lyrics.get("segments", [])
    )) + " "
    moments = len(beats)
    for beat in beats:
        if beat.get("use") != "imperio.campaign":
            continue
        anchors = set()
        for target in (beat.get("params") or {}).get("targets", []):
            if not isinstance(target, dict) or not target.get("at") or not target.get("label"):
                continue
            time = target.get("time")
            if not isinstance(time, str) or not time.startswith("@"):
                continue
            anchor = _normal(re.sub(r"[+-]\d+(?:\.\d+)?$", "", time[1:]))
            if anchor and f" {anchor} " in spoken:
                anchors.add(anchor)
        moments += max(0, len(anchors) - 1)
    return moments

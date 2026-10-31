#!/usr/bin/env python3
"""Monta una escena de pizarra desde un storyboard ya alineado e imágenes indexadas."""
import argparse
import json
from pathlib import Path


def icon(name, x, t, assets):
    base = {"type": "prop", "x": x, "y": 598, "s": 215, "at": round(t + .36, 2), "enter": "fade", "pop": .55}
    native = {"reloj": "clock", "burbuja": "bubble", "persona/red": "redApoyo", "flechas": "ruta", "planta": "plant", "cerebro": "brain", "tarjeta": "card", "mosaico": "puzzle", "lista": "paper", "puerta": "puerta"}
    if name in ("clínica", "calendario"):
        item = assets["clinica" if name == "clínica" else "calendario"]
        crop = item["crop"]
        base.update(name="imagen", src=item["archivo"], crop=crop, s=265,
                    height=round(265 * crop[3] * 1024 / (crop[2] * 1536)))
    else:
        base["name"] = native.get(name, "redApoyo")
        if name == "burbuja": base["text"] = "HABLEMOS"
        if name == "tarjeta": base["text"] = "APOYO"
        if name == "reloj": base["hour"] = 8
    return base


def build(data, manifest, duration):
    shots = []
    for i, entry in enumerate(data["shots"]):
        t = entry["t"]
        pose = entry["recurso_pose"]
        x0, y0, w, h = pose["pixeles"]
        height = 650 if entry["pose_juan"] == "cansado" else 735
        width = round(height * w / h)
        image = {"type": "prop", "name": "imagen", "id": "juan", "src": pose["archivo"],
                 "x": 365, "y": round(910-height/2), "s": width, "height": height,
                 "crop": pose["crop"], "at": t, "enter": "fade", "pop": .32}
        panel = {"type": "prop", "name": "panel", "x": 1260, "y": 510, "s": 1040,
                 "height": 620, "at": t, "enter": "none", "z": -2}
        kicker = {"type": "label", "x": 1260, "y": 310, "size": 25,
                  "text": "COMPRENDER · ACOMPAÑAR", "at": t}
        title = {"type": "type", "x": 1260, "y": 410, "size": 66, "weight": 800,
                 "text": entry["titulo"].upper(), "maxW": 910, "at": round(t+.15, 2), "step": .12,
                 "color": "#213d3a"}
        items = [panel, image, kicker, title]
        graphics = entry.get("graficos", [])[:2]
        for n, graph in enumerate(graphics):
            item = icon(graph, 1070 if len(graphics) == 2 and n == 0 else 1450 if len(graphics) == 2 else 1260, t, manifest["graficos"])
            item["at"] = round(t+.42+n*.28, 2)
            items.append(item)
        shots.append({"id": entry["id"], "t": t, "voice_anchor": entry["ancla"],
                      "confidence": entry["confianza"], "items": items})
    return {"version": 1, "background": "#ffffff", "end": duration, "shotsEnd": duration,
            "intro": {"style": "v1", "text": "POR QUÉ CUESTA\n^SALIR DE UNA ADICCIÓN^",
                      "kicker": "LA HISTORIA FICTICIA DE JUAN", "dur": 4.5},
            "outro": {"channel": "NEXA BRIEF", "handle": "COMPRENDER · ACOMPAÑAR", "dur": 6},
            "captions": {"enabled": True, "maxWords": 5, "size": 28, "weight": 600,
                         "font": "'DM Sans', sans-serif", "upper": False, "stroke": False,
                         "color": "#263330", "yLandscape": .955},
            "shots": shots}


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("alignment", type=Path); p.add_argument("manifest", type=Path)
    p.add_argument("output", type=Path); p.add_argument("--duration", type=float, required=True)
    args = p.parse_args()
    aligned = json.loads(args.alignment.read_text())
    if not aligned.get("shots") or any(b["t"] <= a["t"] for a, b in zip(aligned["shots"], aligned["shots"][1:])):
        raise SystemExit("Los planos deben estar alineados y ordenados antes de ensamblar")
    args.output.write_text(json.dumps(build(aligned, json.loads(args.manifest.read_text()), args.duration), ensure_ascii=False, indent=2) + "\n")

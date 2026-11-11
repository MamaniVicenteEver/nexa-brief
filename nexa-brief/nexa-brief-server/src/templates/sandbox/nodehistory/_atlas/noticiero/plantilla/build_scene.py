#!/usr/bin/env python3
"""work/build_scene.py · genera assets/scene.json de ESTE episodio. El video es solo datos: nada de HTML ni de motor.
Re-ejecutar tras cambiar cualquier ancla, cifra o pieza:      python3 work/build_scene.py
Después:  python3 <_atlas>/noticiero/tools/check.py .         (anclas, medios, ritmo por segmento)

Qué piezas existen y qué campos llevan: noticiero/MENU.md. Ejemplo grande y real (14 noticias): noticiero/plantilla/ejemplo-demo/.
Regla de oro: CADA segmento del guion lleva al menos una pieza no textual (resaltado, arco, hemiciclo, contador,
retrato, foto, chip, glow). Las anclas «@palabra» salen de assets/lyrics.json (palabras reales de la voz).

>>> Los bloques «EJEMPLO» de abajo son el patrón; sustitúyelos por las noticias de ESTE episodio. <<<
"""
import json, sys
from pathlib import Path
sys.path.insert(0, "__TOOLS__")
from escena_lib import Escena, Ventanas, A  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
lyr = json.load(open(ROOT / "assets" / "lyrics.json"))
FIN = lyr.get("metadata", {}).get("duration") or lyr["segments"][-1]["end"] + 2   # duración de song.mp3 (la voz)

E = Escena(ROOT, fin_voz=FIN, cierre=1)        # cierre=1 (globo girando) | 2 (cintillo + mensaje) | None
H, U, cam, arco = E.H, E.U, E.cam, E.arco

# ---------------------------------------------------------------- lugares (nombre -> [lon, lat])
E.lugares({
    "Washington": [-77.04, 38.9], "Kiev": [30.52, 50.45], "Moscu": [37.62, 55.75],
})
# regiones propias: varios países/estados en UNA capa; los ids son ISO2 («ES») o estados («US-TX», «UA-43»)
E.region_union("EstadosRojos", ["US-TX", "US-PA", "US-OH"])

# ---------------------------------------------------------------- ventanas: cada noticia = (nombre, ancla donde empieza)
V = Ventanas([("intro", 0.1), ("us", "@democratas"), ("ua", "@ucrania")], fin=FIN)
a, b = V.a, V.b

# ---------------------------------------------------------------- cámara: una pose por noticia (focus + span + pitch)
cam(0, center=[-32, 14], span=125, pitch=0, drift={"z": 0.01})                  # apertura: globo entero
cam("@democratas", focus=[-98, 39], span=62, pitch=52, dur=3.2)                   # EE. UU.
cam("@ucrania", focus=[33, 50], span=42, pitch=55, dur=3.2)                       # Ucrania

# ---------------------------------------------------------------- EJEMPLO · apertura: 3 retratos sobre el globo + título
for i, (nombre, lugar, color, dx, dy, foto) in enumerate([
        ("Donald Trump", "Washington", "red", -40, -30, "trump"),
        ("Zelenski", "Kiev", "yellow", 0, -40, "zelenski")]):
    U("portrait", .3 + i * .25, a("us"), at=lugar, dx=dx, dy=dy, src=f"media/{foto}.jpg", name=nombre, color=color, size=56)
H("US", "white", .4, a("us")); H("UA", "yellow", .65, a("us"))
U("lower-title", .5, a("us"), scalePortrait=1.3, scaleLandscape=1.5,
  lines=[{"text": "Resumen"}, {"text": "GEOPOLÍTICO", "weight": 700, "gradient": ["blue", "#7cc4ff"], "size": 52}], meta="06/11/2026")

# ---------------------------------------------------------------- EJEMPLO · noticia con cifras (escaños)
U("topic", "@democratas", b("us"), text="3 NOV · ELECCIONES EN EE. UU.", slot=0, dot="white")     # un slot = una franja; una noticia a la vez
U("hemicycle", "@democratas+0.4", b("us"), x=.27, y=.255, radius=160, seats=435, rows=11, title="Cámara", titleDy=48, statDy=100, statGap=130,
  steps=[{"t": "@democratas+0.4", "groups": []},
         {"t": "@250", "groups": [{"n": 252, "color": "blue"}], "stats": [{"value": 252, "color": "blue", "label": "Demócratas"}]},
         {"t": "@435", "groups": [{"n": 252, "color": "blue"}, {"n": 155, "color": "red"}],
          "stats": [{"value": 252, "color": "blue", "label": "Demócratas"}, {"value": 155, "color": "red", "label": "Republicanos"}], "note": "28 por decidir"}])
H("EstadosRojos", "red", "@arrebatado", b("us"), dur=.5)

# ---------------------------------------------------------------- EJEMPLO · noticia de ataque (contadores, destellos, arcos)
H("UA", "yellow", "@ucrania", b("ua")); H("RU", "red", "@ucrania+1.0", b("ua"))
U("topic", "@ucrania", b("ua"), text="2-3 NOV · ATAQUES A LA ENERGÍA", slot=0, dot="yellow")
U("city", "@ucrania+1.2", b("ua"), at="Kiev", text="Kiev", side="left", size=18)
U("counter", "@289", b("ua"), x=.27, y=.64, value=289, label="Drones", color="red", size=76, count=.9)
U("counter", "@76", b("ua"), x=.73, y=.64, value=76, label="Misiles", color="red", size=76, count=.7)
arco([37.6, 56.4], "Kiev", "@rusia", dur=1.4, out=b("ua"), color="#ff4d6d", width=5, lift=40, tail=.35, keep=False)

E.escribir(titulo_cierre=[{"text": "Resumen"}, {"text": "GEOPOLÍTICO", "size": 52, "gradient": ["blue", "#7cc4ff"]}], meta_cierre="NODEPOLITICS")

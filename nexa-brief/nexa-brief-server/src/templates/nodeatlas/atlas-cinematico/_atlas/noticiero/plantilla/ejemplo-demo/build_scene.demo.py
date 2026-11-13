#!/usr/bin/env python3
"""Genera assets/scene.json (video = solo datos). Re-ejecutar tras cambiar cualquier número.
Uso: python3 work/build_scene.py   (desde la carpeta del video)"""
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
eh = json.load(open('/tmp/eh_split.json')) if Path('/tmp/eh_split.json').exists() else json.load(open(ROOT/'work/eh_split.json'))
(ROOT/'work/eh_split.json').write_text(json.dumps(eh))

A = lambda w, off=0: f"@{w}" + (f"{off:+}" if off else "")
EU = "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split()
places = {"Washington": [-77.04, 38.9], "Kiev": [30.52, 50.45], "Moscu": [37.62, 55.75], "Madrid": [-3.7, 40.42],
  "Yaroslavl": [39.87, 57.63], "AbuDabi": [54.37, 24.45], "Asuncion": [-57.58, -25.28], "ElAaiun": [-13.2, 27.15],
  "Teheran": [51.39, 35.69], "Qeshm": [55.9, 26.95], "Bruselas": [4.35, 50.85], "Roma": [12.5, 41.9],
  "Jarkov": [36.23, 49.99], "Dnipro": [35.04, 48.46], "Odesa": [30.72, 46.48], "Leopolis": [24.03, 49.84], "Zaporiyia": [35.14, 47.84],
  "Sumy": [34.8, 50.9], "Ormuz": [56.4, 26.3], "Peña": [-58.5, -23.2], "NY": [-74, 40.7], "Capitolio": [-100, 47]}
regions = {"SaharaOcupado": {"geometry": eh["occ"], "label": [-14, 25]}, "SaharaLibre": {"geometry": eh["free"], "label": [-11.5, 24]}}

GEO = ROOT.parents[1] / 'nodehistory/_atlas/data/geo'
_feats = {}
for f in ('admin0', 'admin1'):
    for ft in json.load(open(GEO / f'{f}.geojson'))['features']:
        _feats[ft['properties']['id']] = ft['geometry']
def union_region(ids):
    """MultiPolygon con los polígonos de varios países/estados (una sola capa de resaltado = mucho más rápido)."""
    polys = []
    for i in ids:
        g = _feats[i]
        polys += g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    return {"geometry": {"type": "MultiPolygon", "coordinates": polys}}
regions["UE27"] = union_region(EU)
regions["EstadosRojos"] = union_region(["US-TX", "US-PA", "US-OH", "US-NC", "US-ME", "US-GA", "US-IA"])
regions["UAOcupada"] = union_region(["UA-43", "UA-40", "UA-14", "UA-09", "UA-65", "UA-23"])
hl, hud, arcs = [], [], []
def H(region, style, t, out=None, dur=.8, border=True):
    d = {"type": "highlight", "region": region, "style": style, "t": t, "dur": dur, "border": border}
    if out: d["out"] = out
    hl.append(d)
def U(type, t, out=None, **k):
    d = {"type": type, "t": t, **k}
    if out: d["out"] = out
    hud.append(d); return d

# ---- secciones (inicio = ancla de voz; el fin es el inicio de la siguiente)
S = dict(intro=0, us="@democratas", camara="@camara#2", presu="@presupuestos", arancel="@aranceles", veto="@vetar",
         ua="@ucrania", yaro="@refinerias", mad="@zelenski", abu="@abu", eu="@europa", py="@paraguay",
         dip="@diputados", sah="@titulares", ir="@ormuz", end="@nuevo")
Z = {  # ventanas: nombre -> (inicio, fin)
 "intro": (0.1, S["us"]), "us": (S["us"], S["presu"]), "presu": (S["presu"], S["arancel"]),
 "arancel": (S["arancel"], S["ua"]), "ua": (S["ua"], S["yaro"]), "yaro": (S["yaro"], S["mad"]), "mad": (S["mad"], S["abu"]),
 "abu": (S["abu"], S["eu"]), "eu": (S["eu"], S["py"]), "py": (S["py"], S["sah"]), "sah": (S["sah"], S["ir"]), "ir": (S["ir"], 156)}
a = lambda k: Z[k][0]; b = lambda k: Z[k][1]

# ---- cámara (globo)
camera = [
 {"t": 0, "center": [-32, 14], "span": 125, "pitch": 0, "drift": {"z": 0.01}},
 {"t": "@democratas", "focus": [-98, 39], "span": 62, "pitch": 52, "dur": 3.2},
 {"t": "@presupuestos", "focus": [-77, 38.5], "span": 14, "pitch": 55, "dur": 2.6},
 {"t": "@aranceles", "focus": [-62, 28], "span": 150, "pitch": 28, "dur": 2.8},
 {"t": "@ucrania", "focus": [33, 50], "span": 42, "pitch": 55, "dur": 3.2},
 {"t": "@kiev", "focus": [31, 49.5], "span": 22, "pitch": 58, "dur": 2.4},
 {"t": "@refinerias", "focus": [38, 53.5], "span": 34, "pitch": 55, "dur": 2.6},
 {"t": "@zelenski", "focus": [-3.7, 41], "span": 24, "pitch": 52, "dur": 3.0},
 {"t": "@abu", "focus": [38, 42], "span": 120, "pitch": 32, "dur": 3.2},
 {"t": "@moscu", "focus": [37, 50], "span": 58, "pitch": 45, "dur": 2.4},
 {"t": "@europa", "focus": [12, 49], "span": 48, "pitch": 50, "dur": 3.0},
 {"t": "@paraguay", "focus": [-58, -22], "span": 22, "pitch": 52, "dur": 3.4},
 {"t": "@diputados", "focus": [-58, -23], "span": 16, "pitch": 48, "dur": 2.0},
 {"t": "@titulares", "center": [-30, 15], "span": 200, "pitch": 15, "dur": 2.2},
 {"t": "@onu", "focus": [-12.3, 24.6], "span": 15, "pitch": 52, "dur": 3.0},
 {"t": "@ormuz", "focus": [53, 31], "span": 20, "pitch": 55, "dur": 3.6},
]

# ---- INTRO: tres retratos sobre el globo + título inferior
for nm, at, col, dx, dy, src, nmx in [("Donald Trump", "Washington", "red", -40, -30, "trump", 0), ("Zelenski", "Kiev", "yellow", 0, -40, "zelenski", 1), ("Santiago Peña", "Asuncion", "white", 0, -20, "pena", 2)]:
    U("portrait", 0.3 + nmx * .25, S["us"], at=at, dx=dx, dy=dy, src=f"media/{src}.jpg", name=nm if nmx != 1 else None, color=col, size=56)
H("US", "white", 0.4, S["us"], border=True); H("UA", "yellow", 0.65, S["us"]); H("PY", "white", 0.9, S["us"])
U("lower-title", 0.5, S["us"], scalePortrait=1.3, scaleLandscape=1.5, lines=[{"text": "Resumen"}, {"text": "GEOPOLÍTICO", "weight": 700, "gradient": ["blue", "#7cc4ff"], "size": 52}], meta="06/11/2026")

# ---- EE. UU.
U("topic", "@democratas", "@enero", text="3 NOV · ELECCIONES EN EE. UU.", slot=0, dot="white")
U("hemicycle", "@democratas+0.4", S["presu"], x=.27, y=.255, radius=160, seats=435, rows=11, title="Cámara", titleDy=48,
  steps=[{"t": "@democratas+0.4", "groups": []}, {"t": "@250", "groups": [{"n": 252, "color": "blue"}], "stats": [{"value": 252, "color": "blue", "label": "Demócratas"}]},
         {"t": "@435", "groups": [{"n": 252, "color": "blue"}, {"n": 155, "color": "red"}], "stats": [{"value": 252, "color": "blue", "label": "Demócratas"}, {"value": 155, "color": "red", "label": "Republicanos"}], "note": "28 por decidir", "noteColor": "dim"}], statDy=100, statGap=130)
U("hemicycle", "@democratas+0.6", S["presu"], x=.73, y=.255, radius=105, seats=100, rows=7, title="Senado", titleDy=40,
  steps=[{"t": "@democratas+0.6", "groups": []}, {"t": "@arrebatado", "groups": [{"n": 47, "color": "blue"}, {"n": 51, "color": "red"}], "stats": [{"value": 47, "color": "blue", "label": "Dem."}, {"value": 51, "color": "red", "label": "Rep."}]},
         {"t": "@7", "groups": [{"n": 54, "color": "blue"}, {"n": 44, "color": "red"}], "stats": [{"value": 54, "color": "blue", "label": "Dem."}, {"value": 44, "color": "red", "label": "Rep."}], "note": "+7 escaños", "noteColor": "red"}], statDy=95, statGap=110, dot=.9)
U("chip", "@democratas+1.4", S["presu"], x=.40, y=.40, glyph="D", color="blue", size=34)
U("chip", "@republicanos", S["presu"], x=.50, y=.40, glyph="R", color="red", size=26)
H("EstadosRojos", "red", "@arrebatado", S["presu"], dur=.5)

H("US", "blue", "@democratas", b("presu"), dur=1.0)
# ---- presupuestos / investigar / nombramientos
U("topic", "@enero", b("presu"), text="DESDE EL 3 DE ENERO DE 2027", slot=0, dot="blue")
U("photo-frame", "@presupuestos", b("presu"), x=.5, y=.36, w=420, aspect=1.5, src="media/capitolio.jpg", caption="Capitolio · Washington", color="blue")
for icon, lab, anc, x in [("db", "Presupuestos", "@presupuestos+0.6", .22), ("eye", "Investigar", "@investigar", .5), ("gavel", "Nombramientos", "@nombramientos", .78)]:
    U("chip", anc, b("presu"), x=x, y=.62, icon=icon, label=lab, color="blue", size=40)

# ---- aranceles y veto
U("topic", "@aranceles", b("arancel"), text="ARANCELES", slot=0, dot="orange")
U("portrait", "@aranceles+0.3", b("arancel"), at="Washington", dx=-120, dy=-90, src="media/trump.jpg", name="Donald Trump", color="red", size=64)
U("chip", "@vetar", b("arancel"), x=.62, y=.58, icon="doc", badge="red", label="Veto presidencial", color="white", size=44, labelColor="red")
U("topic", "@vetar", b("arancel"), text="VETO: SE SUPERA CON 2/3 EN AMBAS", slot=1, dot="red")
U("hemicycle", "@vetar+0.3", b("arancel"), x=.27, y=.25, radius=100, seats=435, rows=9, dot=.8, steps=[{"t": "@vetar+0.3", "groups": [{"n": 290, "color": "blue"}, {"n": 145, "color": "red"}]}])
U("hemicycle", "@vetar+0.5", b("arancel"), x=.73, y=.25, radius=80, seats=100, rows=6, dot=.8, steps=[{"t": "@vetar+0.5", "groups": [{"n": 67, "color": "blue"}, {"n": 33, "color": "red"}]}])
U("counter", "@tercios", b("arancel"), x=.27, y=.17, text="2/3", size=34, color="white", label="", count=.1)
U("counter", "@tercios+0.1", b("arancel"), x=.73, y=.17, text="2/3", size=34, color="white", label="", count=.1)

# ---- Ucrania
H("UA", "yellow", "@ucrania", b("yaro")); H("RU", "red", "@ucrania+1.0", b("yaro"))
H("UAOcupada", "hatch-red", "@ucrania+1.8", b("yaro"), dur=.8, border=False)
U("topic", "@ucrania", b("ua"), text="2-3 NOV · ATAQUES A LA ENERGÍA", slot=0, dot="yellow")
U("city", "@ucrania+1.2", b("ua"), at="Kiev", text="Kiev", side="left", size=18)
U("counter", "@289", S["yaro"], x=.27, y=.64, value=289, label="Drones", color="red", size=76, count=.9)
U("counter", "@76", S["yaro"], x=.73, y=.64, value=76, label="Misiles", color="red", size=76, count=.7)
U("glow", "@impactos", S["yaro"], points=["Kiev", "Jarkov", "Dnipro", "Odesa", "Leopolis", "Zaporiyia"], color="#ff9b2e", r=26)
for i, c in enumerate(["Kiev", "Jarkov", "Dnipro", "Odesa", "Leopolis", "Zaporiyia"]):
    arcs.append({"type": "arc", "from": [37.6 + i * 1.5, 56.4], "to": c, "t": f"@rusia+{0.2*i:.1f}", "dur": 1.4, "out": S["yaro"], "color": "#ff4d6d", "width": 5, "lift": 40, "tail": .35, "keep": False})
U("chip", "@energeticas", "@agua", at="Dnipro", dy=-80, dx=60, icon="bolt", badge="red", label="", color="yellow", size=34)
U("chip", "@agua", b("ua"), at="Kiev", dx=70, dy=-70, icon="drop", badge="red", color="white", size=36, label="Kiev sin agua", labelColor="white")

# ---- Yaroslavl
U("topic", "@refinerias", b("yaro"), text="3 NOV · REFINERÍA DE YAROSLAVL", slot=0, dot="orange")
U("city", "@refinerias+0.5", b("yaro"), at="Moscu", text="Moscú", side="right", size=17)
U("city", "@yaroslavl", b("yaro"), at="Yaroslavl", text="Yaroslavl", side="top", size=17, pulse=True, color="orange")
arcs.append({"type": "arc", "from": "Sumy", "to": "Yaroslavl", "t": "@yaroslavl", "dur": 1.6, "out": b("yaro"), "color": "#ffd21a", "width": 4, "lift": 30, "head": "dot", "keep": True})
U("chip", "@yaroslavl+0.8", b("yaro"), at="Yaroslavl", dx=-70, dy=-60, icon="drop", badge="red", color="white", size=34, label="")
U("chip", "@yaroslavl+0.8", b("yaro"), x=0.5, y=0.62, icon="drone", label="Drones ucranianos", color="yellow", size=36)

# ---- Madrid
H("ES", "white", "@zelenski", b("mad"))
U("topic", "@zelenski", b("mad"), text="4 NOV · CUMBRE IBEROAMERICANA", slot=0, dot="yellow")
U("city", "@zelenski", b("mad"), at="Madrid", text="Madrid", side="bottom", size=17)
U("portrait", "@zelenski+0.4", b("mad"), at="Madrid", dx=-120, dy=-60, src="media/zelenski.jpg", name="Volodímir Zelenski", color="yellow", size=56)
U("portrait", "@sanchez", b("mad"), at="Madrid", dx=140, dy=-190, src="media/sanchez.jpg", name="Pedro Sánchez", color="white", size=50)
U("chip", "@antiaerea", b("mad"), at="Madrid", dx=-120, dy=140, icon="shield", color="yellow", size=34)
U("chip", "@electrica", b("mad"), at="Madrid", dx=-40, dy=140, icon="bolt", color="yellow", size=34)
U("counter", "@437", b("mad"), x=.5, y=.205, text="437 M€", size=70, color="yellow", label="Paquete militar español")

# ---- Abu Dabi
H("UA", "yellow", "@abu+1.0", b("abu")); H("RU", "red", "@abu+1.0", b("abu"))
U("topic", "@abu", b("abu"), text="10-11 NOV · ABU DABI", slot=0, dot="white")
U("city", "@abu+0.6", b("abu"), at="AbuDabi", text="Abu Dabi", side="bottom", size=17, pulse=True)
arcs.append({"type": "arc", "from": "Kiev", "to": "AbuDabi", "t": "@abu+0.8", "dur": 2.0, "out": b("abu"), "color": "#ffd21a", "width": 4, "lift": 60, "head": "dot", "keep": True, "dashed": True})
arcs.append({"type": "arc", "from": "Moscu", "to": "AbuDabi", "t": "@abu+1.0", "dur": 2.0, "out": b("abu"), "color": "#ff4d6d", "width": 4, "lift": 60, "head": "dot", "keep": True, "dashed": True})
arcs.append({"type": "arc", "from": "Washington", "to": "AbuDabi", "t": "@abu+0.4", "dur": 2.2, "out": b("abu"), "color": "#5fb2ff", "width": 4, "lift": 90, "head": "dot", "keep": True, "dashed": True})
U("city", "@moscu", b("abu"), at="Moscu", text="Moscú", side="top", size=17)
U("portrait", "@moscu+0.2", b("abu"), at="Moscu", dx=60, dy=-90, src="media/medinski.jpg", name="Vladímir Medinski", role="Jefe de la delegación rusa", color="red", size=52)
U("topic", "@garantias", b("abu"), text="GARANTÍAS DE SEGURIDAD", slot=1, dot="blue")
U("topic", "@desescalada", b("abu"), text="DESESCALADA", slot=2, dot="blue")
U("topic", "@humanitaria", b("abu"), text="AYUDA HUMANITARIA", slot=3, dot="blue")

# ---- Europa
H("UE27", "blue", "@europa", b("eu"), dur=.9)
H("IT", "white", "@italia", b("eu"), dur=.6)
U("topic", "@europa", b("eu"), text="10-11 NOV · ABU DABI", slot=0, dot="white")
U("topic", "@italia", b("eu"), text="ITALIA PIDE UN REPRESENTANTE DE LA UE", slot=1, dot="blue")
U("city", "@europa+0.5", b("eu"), at="Bruselas", text="Bruselas", side="right", size=17)
U("chip", "@europa+0.5", b("eu"), at="Bruselas", dx=-70, dy=-50, glyph="UE", color="blue", size=30)
U("city", "@italia", b("eu"), at="Roma", text="Roma", side="left", size=17)
U("note", "@italia+0.4", b("eu"), at="Roma", dx=20, dy=70, text="Sin representación", dot="white")
U("note", "@europa+0.8", "@italia", x=.5, y=.62, text="Sin representación prevista", dot="orange")

# ---- Paraguay
H("PY", "white", "@paraguay", b("py"), dur=1.0)
U("topic", "@paraguay", "@diputados", text="5 NOV · PARAGUAY", slot=0, dot="green")
U("city", "@paraguay+0.6", b("py"), at="Asuncion", text="Asunción", side="bottom", size=17)
U("portrait", "@paraguay+0.4", b("py"), at="Peña", dx=-170, dy=-40, src="media/pena.jpg", name="Santiago Peña", role="Presidente de Paraguay", color="white", size=60)
U("counter", "@3", "@800", x=.5, y=.205, value=3, suffix=" millones", label="De clientes", color="green", size=60, count=.9)
U("counter", "@800", "@socio", x=.5, y=.205, value=800, suffix=" M$", label="De dinero público", color="green", size=60, count=1.0)
U("chip", "@intervino", "@socio", x=.78, y=.52, icon="lock", label="Ueno Bank intervenido", color="green", size=40)
U("chip", "@socio", b("py"), at="Peña", dx=95, dy=-80, icon="chart", color="green", size=34)
U("note", "@socio+0.3", "@diputados", at="Peña", dx=95, dy=-20, text="Socio hasta 2025", dot="green")
U("chip", "@banco#4", b("py"), at="Peña", dx=40, dy=60, icon="chart", color="white", size=34, label="Banco Central")
# diputados
U("topic", "@diputados", b("py"), text="CÁMARA DE DIPUTADOS", slot=0, dot="orange")
U("hemicycle", "@diputados", b("py"), x=.4, y=.21, radius=130, seats=80, rows=5, dot=1.2, dimColor="white", statDy=95, title="", 
  steps=[{"t": "@diputados", "groups": []}, {"t": "@abrirle", "groups": [{"n": 78, "color": "orange"}], "stats": [{"value": 78, "color": "orange", "label": "De 80 diputados a favor del juicio político"}]}])
U("chip", "@juicio", b("py"), x=.8, y=.265, icon="gavel", color="orange", size=34, badge="red")
U("topic", "@renuncia#2", b("py"), text="PEÑA PRESENTA SU RENUNCIA", slot=1, dot="red")
U("portrait", "@alliana", b("py"), at="Peña", dx=150, dy=-60, name="Pedro Alliana", role="Vicepresidente", color="white", size=50)
U("topic", "@2028", b("py"), text="HASTA AGOSTO DE 2028", slot=2, dot="white")

# ---- Sahara
U("topic", "@titulares", b("sah"), text="OTROS TITULARES", slot=0, dot="white")
H("SaharaOcupado", "hatch-orange", "@onu+0.8", b("sah"), dur=.9, border=True)
H("SaharaLibre", {"fill": "#36d41a", "opacity": .3, "line": "#6dff8a", "width": 2.4, "glow": .5, "glowWidth": 6, "glowBlur": 3}, "@onu+1.2", b("sah"), dur=.9, border=True)
U("topic", "@onu", b("sah"), text="MINURSO · 1991-2026", slot=1, dot="blue")
U("photo-frame", "@onu+0.3", "@vetaran", x=.5, y=.22, w=330, aspect=1.5, src="media/minurso.jpg", caption="Cascos azules de la ONU", color="blue")
U("city", "@onu+1.5", b("sah"), at="ElAaiun", text="El Aaiún", side="right", size=16)
U("note", "@sahara", b("sah"), at="ElAaiun", dx=-120, dy=140, text="Ocupado por Marruecos", dot="orange")
U("chip", "@vetaran", "@referendum", x=.35, y=.2, icon="ban", label="EE. UU.", color="blue", size=36)
U("chip", "@vetaran", "@referendum", x=.65, y=.2, icon="ban", label="Rusia", color="red", size=36)
U("note", "@vetaran+0.5", "@referendum", x=.5, y=.31, text="Consejo de Seguridad", dot="white")
U("note", "@referendum", b("sah"), at="ElAaiun", dx=110, dy=-110, text="Referéndum nunca celebrado", dot="green")
U("photo-frame", "@saharaui", b("sah"), x=.5, y=.22, w=330, aspect=1.5, src="media/saharaui.jpg", caption="Manifestación saharaui", color="green")

# ---- Ormuz
H("IR", "red", "@ormuz", dur=1.0)
U("topic", "@ormuz", b("ir"), text="2 NOV · ATAQUE EN QESHM", slot=0, dot="blue")
U("city", "@ormuz+0.8", b("ir"), at="Teheran", text="Teherán", side="left", size=17, pulse=True, color="red")
U("city", "@qeshm", b("ir"), at="Qeshm", text="Qeshm", side="top", size=17, pulse=True, color="red")
U("note", "@ormuz+0.4", b("ir"), at="Ormuz", dx=70, dy=100, text="Estrecho de Ormuz", dot="blue")
arcs.append({"type": "arc", "from": [48, 22], "to": "Qeshm", "t": "@sistema", "dur": 1.2, "out": b("ir"), "color": "#5fb2ff", "width": 4, "head": "arrow", "keep": True, "lift": 40})
U("glow", "@qeshm", b("ir"), points=["Qeshm"], color="#ff3b5c", r=34)

# Los cierres se aplican al final, sin alterar el contenido narrado.
outros = {c['name']: c['demo'] for c in json.loads((ROOT/'components.json').read_text())['components'] if c['name'].startswith('noticiero.outrov')}
for layer in hl:
    if layer.get('out') is None: layer['out'] = 156
for item in hud:
    if item.get('out') is None: item['out'] = 156
scene = {
 "format": "atlas-v1", "duration": 163, "lang": "es", "look": "noticiero-globo", "attribution": False,
 "places": places, "regions": regions, "camera": camera,
 "layers": hl + arcs,
 "hud": hud,
 "hudTheme": {"colors": {}}, "estilo": "original",
 "captions": {"enabled": True, "maxWords": 4, "size": 27, "y": 0.895, "yLandscape": 0.92, "color": "#ffffff", "upper": False, "weight": 700, "font": "Poppins, sans-serif"},
 "outro": False,
}
for variant in (1, 2):
    fragment = outros[f'noticiero.outrov{variant}']
    result = {**scene,
        'camera': camera + [{**key, 't': 156 + key['t']} for key in fragment['camera']],
        'hud': hud + [{**item, 't': 156 + item['t']} for item in fragment['hud']]}
    path = ROOT / 'assets' / ('scene.json' if variant == 1 else 'scene-outrov2.json')
    path.write_text(json.dumps(result, ensure_ascii=False, indent=1))
print(len(hl), 'resaltados', len(hud), 'hud', len(arcs), 'arcos')

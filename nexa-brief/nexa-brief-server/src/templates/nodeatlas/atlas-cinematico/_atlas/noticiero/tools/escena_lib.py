#!/usr/bin/env python3
"""escena_lib · biblioteca mínima para escribir `assets/scene.json` de un resumen noticiero (Atlas).

Un video noticiero es SOLO DATOS: este módulo no dibuja nada, solo arma el JSON que lee el motor
(`_atlas/atlas.js` + `_atlas/hud.js`). Se usa desde `work/build_scene.py` del episodio:

    import sys; sys.path.insert(0, "<ruta a _atlas/noticiero/tools>")     # nuevo.py ya lo deja puesto
    from escena_lib import Escena, A, Ventanas

    E = Escena(ROOT, fin_voz=155.86, cierre=1)            # fin_voz = duración de song.mp3
    E.lugares({"Washington": [-77.04, 38.9]})              # nombre -> [lon, lat]
    E.region_union("UE27", ["AT", "BE", ...])             # varios países/estados en UNA sola capa (rápido)
    E.cam(0, center=[-32, 14], span=125, pitch=0)         # cámara (focus/center, span, pitch, dur)
    E.H("US", "blue", "@democratas", out="@presupuestos")  # resaltado de región
    E.U("topic", "@democratas", out="@presupuestos", text="3 NOV · ELECCIONES", slot=0, dot="white")
    E.arco("Kiev", "AbuDabi", "@abu+0.8", out="@europa", color="#ffd21a", head="dot", dashed=True)
    E.escribir()                                           # → assets/scene.json

Anclas: "@palabra", "@palabra+0.4", "@palabra#2" (2.ª aparición), "@dos palabras", "@palabra:end".
Se resuelven en el navegador con `assets/lyrics.json`; `tools/check.py` las resuelve antes (mismo algoritmo).
Todo valor de tiempo puede ser un número (segundos) o un ancla. Lo no listado se pasa tal cual al motor.
"""
from __future__ import annotations
import json
from pathlib import Path

NOTICIERO = Path(__file__).resolve().parents[1]          # .../_atlas/noticiero
ATLAS = NOTICIERO.parent                                  # .../_atlas
GEO = ATLAS / "data" / "geo"

DURACION_CIERRE = 7.2            # el cierre (outrov1/outrov2) dura 7 s; song-outro.mp3 lleva 7.2 s de silencio extra
LOOK = "noticiero-globo"
CAPTIONS = {"enabled": True, "maxWords": 4, "size": 27, "y": 0.895, "yLandscape": 0.92, "color": "#ffffff",
            "upper": False, "weight": 700, "font": "Poppins, sans-serif"}


def A(palabra: str, off: float = 0) -> str:
    """ancla a una palabra de la voz: A("camara", .4) -> "@camara+0.4"."""
    return f"@{palabra}" + (f"{off:+g}" if off else "")


class Ventanas:
    """Ventanas de tiempo por sección: cada una empieza en un ancla y termina donde empieza la siguiente.

        V = Ventanas([("us", "@democratas"), ("ua", "@ucrania"), ("py", "@paraguay")], fin=155.86)
        V.a("us")  -> "@democratas"     V.b("us") -> "@ucrania"     V.b("py") -> 155.86
    """

    def __init__(self, secciones, fin):
        self.nombres = [n for n, _ in secciones]
        self.ini = dict(secciones)
        self.fin = fin

    def a(self, nombre):
        return self.ini[nombre]

    def b(self, nombre):
        i = self.nombres.index(nombre)
        return self.ini[self.nombres[i + 1]] if i + 1 < len(self.nombres) else self.fin


_geo_cache: dict = {}


def _feats():
    if not _geo_cache:
        for f in ("admin0", "admin1"):
            for ft in json.load(open(GEO / f"{f}.geojson"))["features"]:
                _geo_cache[ft["properties"]["id"]] = ft["geometry"]
    return _geo_cache


class Escena:
    def __init__(self, root, fin_voz: float, cierre: int | None = 1, estilo: str = "original",
                 captions: dict | None = None, hud_theme: dict | None = None, marca: str | None = None):
        """root = carpeta del episodio · fin_voz = duración de assets/song.mp3 · cierre = 1 | 2 | None."""
        self.root = Path(root)
        self.fin_voz = float(fin_voz)
        self.cierre = cierre
        self.estilo = estilo
        self.captions = {**CAPTIONS, **(captions or {})}
        self.hud_theme = hud_theme or {"colors": {}}
        self.places: dict = {}
        self.regions: dict = {}
        self.camera: list = []
        self.hl: list = []
        self.hud: list = []
        self.arcs: list = []
        self.cierre_cfg: dict = {}
        if marca:
            self.U("brand", 0.2, text=marca)

    # ---- datos del mapa
    def lugares(self, d: dict):
        self.places.update(d)

    def region(self, nombre: str, geometry: dict | None = None, label=None):
        """región propia por GeoJSON (polígono dibujado a mano; rotular como «aproximado»)."""
        r = {"geometry": geometry}
        if label:
            r["label"] = label
        self.regions[nombre] = r

    def region_union(self, nombre: str, ids: list[str]):
        """MultiPolygon con varios países (ISO2: 'ES') o estados ('US-TX', 'UA-43'): una sola capa = mucho más rápido."""
        feats, polys = _feats(), []
        for i in ids:
            if i not in feats:
                raise KeyError(f"región desconocida en el dataset: {i}")
            g = feats[i]
            polys += g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        self.regions[nombre] = {"geometry": {"type": "MultiPolygon", "coordinates": polys}}

    # ---- piezas
    def cam(self, t, **k):
        self.camera.append({"t": t, **k})

    def H(self, region, style, t, out=None, dur=.8, border=True):
        """resaltado: style = nombre del look (blue white red yellow orange green hatch-red hatch-orange) u objeto."""
        d = {"type": "highlight", "region": region, "style": style, "t": t, "dur": dur, "border": border}
        if out is not None:
            d["out"] = out
        self.hl.append(d)

    def U(self, tipo, t, out=None, **k):
        """pieza del HUD (brand topic lower-title hemicycle counter portrait photo-frame chip icon-grid flag-chip logo-chip city note glow bar-compare line-series delta ranking stacked-bar ticker range-ring pulse route-icon front-line geo-label quote-card timeline)."""
        d = {"type": tipo, "t": t, **k}
        if out is not None:
            d["out"] = out
        self.hud.append(d)
        return d

    def capa(self, tipo, t, out=None, **k):
        """Capa genérica del catálogo; choropleth usa values/scale/domain."""
        d = {"type": tipo, "t": t, **k}
        if out is not None:
            d["out"] = out
        self.hl.append(d)
        return d

    def arco(self, desde, hasta, t, out=None, **k):
        d = {"type": "arc", "from": desde, "to": hasta, "t": t, **k}
        if out is not None:
            d["out"] = out
        self.arcs.append(d)

    # ---- salida
    def _cierre(self):
        if not self.cierre:
            return None
        cierres = json.loads((NOTICIERO / "plantilla" / "cierres.json").read_text())
        frag = cierres[f"outrov{self.cierre}"]
        return {**frag, **self.cierre_cfg}

    def escribir(self, ruta: str = "assets/scene.json", titulo_cierre: list | None = None, meta_cierre: str | None = None):
        """aplica `out` por defecto (fin de la voz), añade el cierre y escribe la escena. Devuelve el dict."""
        fin = self.fin_voz
        for capa in self.hl:
            capa.setdefault("out", fin)
        for it in self.hud:
            it.setdefault("out", fin)
        camera, hud, dur = list(self.camera), list(self.hud), fin
        frag = self._cierre()
        if frag:
            camera += [{**k, "t": fin + k["t"]} for k in frag["camera"]]
            items = []
            for it in frag["hud"]:
                it = {**it, "t": fin + it["t"]}
                if it["type"] == "lower-title":
                    if titulo_cierre:
                        it["lines"] = titulo_cierre
                    if meta_cierre:
                        it["meta"] = meta_cierre
                items.append(it)
            hud += items
            dur = fin + frag["duration"] + .2
        escena = {
            "format": "atlas-v1", "duration": round(dur, 2), "lang": "es", "look": LOOK, "attribution": False,
            "estilo": self.estilo,
            "places": self.places, "regions": self.regions, "camera": camera,
            "layers": self.hl + self.arcs, "hud": hud, "hudTheme": self.hud_theme,
            "captions": self.captions, "outro": False,
        }
        out = self.root / ruta
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(escena, ensure_ascii=False, indent=1))
        print(f"{ruta}: {len(self.hl)} capas · {len(hud)} piezas HUD · {len(self.arcs)} arcos · {len(camera)} cámaras · {dur:.1f} s")
        return escena

#!/usr/bin/env python3
"""Genera work/tools/timeline.json de lyrics-hologram-worlds.
Tiempos medidos sobre la referencia (1 s de resolución); `at` y `to` son relativos al inicio de la escena.
Tamaños de texto por ANCHO: w = fracción del ancho del cuadro que ocupa el texto en la referencia (W()).
El texto en pantalla es el visible en la referencia (inglés + coreano legible); la letra Whisper del perfil no
se usa para el texto en pantalla."""
import json, sys, pathlib

CAP = {"c": 0.89, "w": 0.89, "ko": 0.9}
TL = []


def _fix(d):
    if "ins" in d:
        d["in"] = d.pop("ins")
    return d


def T(t, cap=0.1, x=0.5, y=0.5, f="c", fill="white", **k):
    d = {"k": "text", "t": t, "h": round(cap / CAP[f], 4), "x": x, "y": y, "f": f, "fill": fill}
    d.update(k)
    return _fix(d)


def W(t, w, x=0.5, y=0.5, fill="white", f="c", **k):
    """texto dimensionado por ancho: ocupa w del ancho del cuadro (la altura sale del tipo)"""
    d = {"k": "text", "t": t, "h": 1.0, "maxw": w, "x": x, "y": y, "f": f, "fill": fill}
    d.update(k)
    return _fix(d)


def S(t0, t1, bg, *els, trans="auto", **p):
    TL.append({"t0": t0, "t1": t1, "type": "compose", "bg": bg, "trans": trans, "p": {"els": list(els), **p}})


def shape(s, x, y, w, **k):
    d = {"k": "shape", "s": s, "x": x, "y": y, "w": w}
    d.update(k)
    return _fix(d)


def box(x, y, w, h, fill="white", **k):
    d = {"k": "box", "x": x, "y": y, "w": w, "h": h, "fill": fill}
    d.update(k)
    return _fix(d)


def media(i, x, y, w, h, look="sil", **k):
    d = {"k": "media", "id": i, "x": x, "y": y, "w": w, "h": h, "look": look}
    d.update(k)
    return _fix(d)


def lab(t, rows=(0.055, 0.945), xs=(0.06, 0.5, 0.94), **k):
    d = {"k": "lab", "t": t, "rows": list(rows), "xs": list(xs)}
    d.update(k)
    return _fix(d)


def orn(x, y, n=4, s=0.012, c="#9EEFF4", at=0.05):
    return {"k": "orn", "x": x, "y": y, "n": n, "s": s, "c": c, "at": at}


def rep(t, n, w, x=0.5, y=0.5, f="c", **k):
    d = {"k": "rep", "t": t, "n": n, "h": 1.0, "maxw": w, "x": x, "y": y, "f": f}
    d.update(k)
    return _fix(d)


def ghost(t, w=1.1, x=0.5, y=0.5, f="c", op=0.5, **k):
    k.setdefault("ins", "fade")
    return W(t, w, x, y, "dim", f, op=op, **k)


def ko_col(t, h, x, y, fill="holo", at=0.05):
    return {"k": "col", "t": t, "h": h, "x": x, "y": y, "fill": fill, "in": "slide", "at": at}


# ---------- composiciones que se repiten en el video ----------
SIL = "sil-solo"


def portraits(y=0.03, h=0.5, x0=0.12, w=0.82, ids=("sil-duo", "sil-solo", "sil-trio", "sil-duo"), at=0.0):
    out, n = [], len(ids)
    gw = w / n
    for i, mid in enumerate(ids):
        x = x0 + i * gw
        out.append(box(x, y, gw * 0.9, h, "holo", ins="wipeD", at=at + 0.04 * i))
        if mid in ("sil-duo", "sil-solo", "sil-trio"):
            out.append(media(mid, x, y, gw * 0.9, h, "ink", ins="wipeD", at=at + 0.04 * i + 0.08, op=0.9))
        else:
            out.append(IMG(mid, x + gw * 0.45, y + h * 0.58, h * 0.95, "#040407", ins="wipeD", at=at + 0.04 * i + 0.08))
    out.append(box(x0 - 0.03, y - 0.02, 0.018, h * 0.55, "holo", ins="wipeD", at=at))
    return out


def breaks_holo(at=0.0):
    return [W("BREAK", 0.7, 0.5, 0.5, "holo", "w", ins="stamp", at=at), orn(0.5, 0.14, 4, 0.012, at=at + 0.1), orn(0.5, 0.86, 4, 0.012, at=at + 0.15)]


def breaks_rules(at=0.0):
    return [W("BREAK", 0.7, 0.5, 0.5, "out", "w", op=0.8, ins="cut", at=at), W("RULES", 0.19, 0.5, 0.5, "white", ins="cut", at=at + 0.15),
            orn(0.5, 0.14, 4, 0.012, at=at + 0.1), orn(0.5, 0.86, 4, 0.012, at=at + 0.15)]


def card(cx, cy, w=0.36, at=0.0, fig=0.95):
    return [box(cx - w / 2, cy - 0.62, w, 1.2, "void", rot=-14, stroke="#6a35c9", ins="wipeD", at=at),
            media(SIL, cx - w * 0.45, cy - 0.45, w * 0.95, 1.0, "sil", ins="fade", at=at + 0.1, op=fig)]


def hearts_row(x, y, n=4, s=0.07, at=0.0):
    return [shape("heart", x + i * s * 0.62, y, s, fill="holo", ins="pop", at=at + 0.04 * i) for i in range(n)]


def in_twos(at=0.0):
    return hearts_row(0.065, 0.47, at=at) + [W("IN TWOS", 0.36, 0.08, 0.57, "white", ax=0, ins="slide", at=at + 0.05)] + card(0.74, 0.5, w=0.4, at=at)


def thats_a(at=0.0):
    return [W("THAT'S WHAT", 0.38, 0.1, 0.37, "white", ax=0, ins="slide", at=at), W("THE BADDEST DO", 0.38, 0.1, 0.5, "white", ax=0, ins="slide", at=at + 0.1),
            W("BADDEST DO", 0.22, 0.28, 0.7, "dim", rot=180, ins="fade", at=at + 0.2), lab("WE THE BADDEST", rows=(0.065, 0.935))]


def never(at=0.0, full=True):
    out = [ghost("GOING", 1.25, 0.5, 0.5, op=0.45)]
    out.append(ko_col("끝내주지", 0.1, 0.49, 0.5, "holo", at + 0.05))
    if full:
        out += [W("NEVER GOING BACK", 0.29, 0.245, 0.5, "white", ins="slide", at=at), W("NEVER GOING BACK", 0.29, 0.745, 0.5, "white", ins="slide", at=at + 0.05)]
    else:
        out += [W("NEVER", 0.1, 0.12, 0.5, "white", ins="cut", at=at)]
    return out


def sorry_tiny(ghost_txt, tiny="FOR THE BAD NEWS", at=0.0):
    return [W(ghost_txt, 0.85, 0.5, 0.5, "out", c="#6c6c84", op=0.55, ins="fade", at=at),
            W("SORRY", 0.13, 0.5, 0.5, "holo", ins="stamp", at=at),
            W(tiny, 0.2, 0.5, 0.55, "white", ls=0.06, ins="cut", at=at + 0.1),
            lab("SORRY", rows=(0.04, 0.96), xs=(0.06, 0.5, 0.94))]


def verse_silk(txt, ghost_txt=None, ko=False, w=0.4, at=0.0, gc="#ffffff"):
    els = []
    if ghost_txt:
        els.append(W(ghost_txt, 0.62 if not ko else 0.85, 0.5, 0.5, "dim", f="ko" if ko else "c", op=0.4, ins="fade", at=at, nocase=ko))
    els.append(W(txt, w, 0.5, 0.5, "ink", f="ko" if ko else "c", ls=0.2 if not ko else 0.02, nocase=ko, ins="cut", at=at))
    return els



# =============================== LÍNEA DE TIEMPO (v2) ===============================
# Tiempos de corte medidos a 30 fps sobre la referencia (diferencia entre fotogramas) y contenido
# revisado a 4 fps. Arte propio en assets/media/art (siluetas y emblemas originales).
DK = "#040407"          # silueta oscura sobre el negro azulado


def IMG(s, x, y, h, fill="raw", **k):
    d = {"k": "img", "s": s, "x": x, "y": y, "h": h, "fill": fill}
    d.update(k)
    return _fix(d)


def RING(x, y, r, **k):
    d = {"k": "ring", "x": x, "y": y, "r": r}
    d.update(k)
    return _fix(d)


def crests(s="emb-crest", h=0.3, fill="holo", at=0.0, ys=(0.12, 0.5, 0.88)):
    return [IMG(s, 0.5, y, h, fill, ins="pop", at=at + 0.06 * i, glow=0.01) for i, y in enumerate(ys)]


def stack_out(t, w, n=4, y0=0.32, dy=0.12, **k):
    return [W(t, w, 0.5, y0 + i * dy, "out", c="rgba(255,255,255,0.32)", sw=0.003, ins="cut", at=0.02 * i, **k) for i in range(n)]


def REUSE(a, b, d, first_t0=None):
    """repite las escenas con a <= t0 < b desplazadas d segundos (la referencia repite estribillo y verso)"""
    import copy
    src = [x for x in TL if a <= x["t0"] < b]
    for i, x in enumerate(src):
        y = copy.deepcopy(x)
        y["t0"] = round(x["t0"] + d, 3) if not (i == 0 and first_t0 is not None) else first_t0
        y.pop("t1", None)
        TL.append(y)


def kara(line, t0, times, w, x=0.5, y=0.5, fill="ink", f="c", ls=0.2, **k):
    """verso que se arma palabra por palabra: times = segundos absolutos de cada palabra"""
    return W(line, w, x, y, fill, f, ls=ls, ins="words", wt=[round(t - t0, 3) for t in times], nocase=(f == "ko"), **k)


# ---- 0 - 25,45 s: apertura (v3: movimiento medido a 15 fps) ----
def O(at, m="cut", d=0.25, **k):
    o = {"at": at, "m": m, "d": d}
    o.update(k)
    return o


def KF(*pairs):
    return [[t, p] for t, p in pairs]


def VCOL(t="THE BADDEST", x=0.5, v=-0.05, h=0.012, sp=0.045, n=14, **k):
    d = {"k": "vcol", "t": t, "x": x, "v": v, "h": h, "sp": sp, "n": n}
    d.update(k)
    return d


def SPARKS(n=16, seed=1, **k):
    d = {"k": "sparks", "n": n, "seed": seed}
    d.update(k)
    return d


def GRID(**k):
    d = {"k": "grid"}
    d.update(k)
    return d


EMBS = ["emb-blades", "emb-crest", "emb-star", "emb-crown"]

TL.append({"t0": 0.0, "t1": 1.667, "type": "intro", "bg": "void", "trans": "cut", "p": {}})
S(1.667, 2.033, "holo", IMG("emb-crest", 0.5, 0.02, 0.3, "white", op=0.35), IMG("emb-crest", 0.5, 0.98, 0.3, "white", op=0.35),
  T("·  ·  ·  ·  ·  ·  ·  ·  ·  ·", 0.012, 0.5, 0.5, "c", "#1a1a36", op=0.6), cam={"s": [1.0, 1.03]})
S(2.033, 2.25, "void", IMG("sil-ponytail", 0.5, 0.62, 1.3, DK, op=0.9, kf=KF((0, {"x": 0}), (0.22, {"x": 0.01}))),
  *[IMG("emb-crest", 0.5, y, 0.3, "holo", glow=0.01, kf=KF((0, {"y": 0}), (0.22, {"y": 0.04, "e": "lin"}))) for y in (0.08, 0.5, 0.92)])
S(2.25, 2.933, "void", IMG("sil-bun", 0.47, 0.62, 1.25, DK, op=0.9, kf=KF((0, {"x": 0.01}), (0.68, {"x": -0.015, "e": "lin"}))),
  W("BADDEST", 0.22, 0.5, 0.5, "white", ins="cut", echo={"n": 4, "dy": 0.11, "d": 0.22, "at": 0.0}), VCOL("BADDEST", 0.5, -0.02, op=0.6))
S(2.933, 4.5, "void", IMG("sil-spiky", 0.32, 0.62, 1.5, DK, op=0.95, ins="fade", at=0.9, d=0.45),
  W("DO", 0.085, 0.5, 0.5, "white", ins="stamp", out=O(1.27)), VCOL("끝내주지", 0.5, -0.015, h=0.011, sp=0.06, op=0.7), SPARKS(10, 2))
S(4.5, 4.967, "void", box(0.4, 0.27, 0.3, 0.42, "holo", kf=KF((0, {"s": 1.0, "x": 0}), (0.42, {"s": 3.3, "x": -0.08, "e": "io"}))),
  IMG("sil-spiky", 0.45, 0.66, 1.15, DK, kf=KF((0, {"s": 1.0}), (0.42, {"s": 1.25, "x": -0.06, "y": -0.04}))), VCOL("THE BADDEST", 0.5, -0.03, op=0.6))
S(4.967, 5.2, "holo", IMG("emb-blades", 0.5, 0.5, 0.6, "white", op=0.8, ins="pop", glow=0.01))
S(5.2, 5.45, "holo", IMG("emb-blades", 0.5, 0.5, 0.6, "white", op=0.5),
  W("THE BADDEST", 0.6, 0.5, 0.52, "out", c="rgba(20,20,50,0.6)", sw=0.003, ins="zoomdown", z=2.0, zls=0.4, d=0.25, kf=KF((0, {"x": -0.22}), (0.25, {"x": 0, "e": "out"}))))
S(5.45, 6.167, "holo", W("WE THE BADDEST", 0.43, 0.5, 0.5, "out", c="rgba(20,20,50,0.65)", sw=0.003, ins="cut",
                          fillseq={"at": 0.1, "d": 0.12, "f": "ink", "rand": True}, kf=KF((0, {"y": 0}), (0.7, {"y": 0.03})), out=O(0.62, "glitch", 0.1)),
  IMG("emb-crest", 0.5, 0.86, 0.22, "white", op=0.35, ins="fade", at=0.35))
S(6.167, 7.3, "void", IMG("sil-bun", 0.5, 0.6, 1.3, DK, op=0.9, kf=KF((0.7, {"x": 0}), (1.1, {"x": 0.06}))),
  *[IMG("emb-blades", 0.5, y, 0.34, "holo", glow=0.01, kf=KF((0, {"y": 0}), (0.7, {"y": 0.2, "e": "lin"})), out=O(0.7)) for y in (-0.12, 0.28, 0.68)])
S(7.3, 8.133, "void", IMG("emb-wings", 0.5, 0.52, 1.7, "holo", ins="pop", glow=0.01, kf=KF((0, {"s": 1.0}), (0.83, {"s": 1.08}))),
  W("BADDEST", 0.12, 0.5, 0.42, "white", ins="cut", at=0.17, echo={"n": 4, "dy": 0.06, "d": 0.18, "at": 0.17}, out=O(0.55, "fade", 0.1)),
  W("끝내", 0.055, 0.475, 0.5, "white", f="ko", nocase=True, kf=KF((0.62, {"x": 0, "y": 0}), (0.75, {"x": -0.06, "y": -0.07}))),
  W("주지", 0.055, 0.525, 0.5, "white", f="ko", nocase=True, kf=KF((0.62, {"x": 0, "y": 0}), (0.75, {"x": 0.06, "y": 0.07}))))
S(8.133, 8.533, "void", GRID(op=0.12), IMG("emb-crest", 0.5, 0.5, 0.36, "holo", ins="pop", glow=0.012), lab("THE BADDEST", rows=(0.055, 0.945), xs=(0.1, 0.5, 0.9)), trans="tiles")
S(8.533, 9.8, "void", box(0.33, 0.28, 0.34, 0.44, "holo", kf=KF((0, {"s": 0.8}), (0.3, {"s": 3.2, "e": "io"}))),
  W("THE BADDEST", 0.3, 0.5, 0.5, "ink", ins="zoomdown", z=3.0, zls=0.45, d=0.66), lab("THE BADDEST", rows=(0.945,), xs=(0.1, 0.5, 0.9)))
S(10.267, 12.367, "void", IMG("sil-lineup", 0.5, 0.62, 0.9, DK, op=0.95, ins="fade", at=0.45, d=0.3),
  IMG("sil-spiky", 0.42, 0.6, 1.3, DK, kf=KF((0, {"x": 0.1}), (0.55, {"x": -0.5, "e": "in"})), out=O(0.55)),
  box(0.2, 0.42, 0.1, 0.17, "white", ins="wipeL", d=0.15), T("THE", 0.026, 0.215, 0.455, "c", "ink", ax=0, ins="cut", at=0.08),
  W("BADDEST", 0.45, 0.555, 0.5, "holo", ins="slide"), lab("THE BADDEST", rows=(0.055, 0.945), xs=(0.1, 0.5, 0.9)), SPARKS(8, 4), trans="tiles")
S(12.367, 12.867, "void", IMG("sil-lineup", 0.5, 0.62, 0.9, DK, op=0.95), box(0.2, 0.42, 0.1, 0.17, "white", out=O(0.12)),
  W("BADDEST", 0.45, 0.555, 0.5, "holo", ins="cut", out=O(0.03, "breakup", 0.42, ls=0.55)),
  *[box(0.3 + 0.13 * i, 0.43, 0.09, 0.15, "holo", ins="wipeL", at=0.06 + 0.07 * i, d=0.08, out=O(0.3 + 0.03 * i)) for i in range(4)],
  IMG("sil-ponytail", 0.38, 0.6, 0.9, "violet", flick={"at": 0.3, "d": 0.2, "n": 4}, ins="cut", at=0.3), IMG("sil-bun", 0.62, 0.6, 0.9, "violet", flip=True, ins="cut", at=0.33, flick={"at": 0.33, "d": 0.17, "n": 4}))
S(12.867, 13.3, "void", *[VCOL("COMING AT YOU", x, -0.35 - 0.1 * i, h=0.026, sp=0.05, n=20, op=0.85) for i, x in enumerate((0.36, 0.52, 0.68))],
  box(0.0, 0.0, 1.0, 1.0, "#0a0b10", kf=KF((0, {"o": 1}), (0.25, {"o": 0})), op=1))
S(13.3, 13.533, "void", *[W("YOU YOU YOU YOU YOU YOU YOU YOU YOU YOU YOU", 1.4, 0.5, y, "white", marq=0.9 * (1 if i % 2 else -1)) for i, y in enumerate((0.05, 0.16, 0.84, 0.95))],
  W("L  I  V  E", 0.55, 0.5, 0.5, "out", c="rgba(255,255,255,0.6)", sw=0.003, ins="assemble", d=0.15, hold=0.05))
S(13.533, 14.067, "void", box(0.0, 0.0, 1.0, 1.0, "linear-gradient(180deg,#8d97c4 0%,#4a5274 100%)", kf=KF((0, {"o": 1}), (0.32, {"o": 0, "e": "out"}))),
  W("LIVE", 0.17, 0.5, 0.5, "white", ins="cut", out=O(0.45, "chars", 0.08)))
S(14.067, 14.6, "void", box(0.6, 0.24, 0.13, 0.33, "holo", kf=KF((0, {"x": 0, "s": 1}), (0.5, {"x": -0.2, "s": 1.25}))),
  W("REAL", 0.3, 0.48, 0.3, "out", c="rgba(255,255,255,0.55)", sw=0.003, ins="zoomdown", z=2.6, zls=0.35, d=0.45),
  W("WILD", 0.3, 0.48, 0.72, "out", c="rgba(255,255,255,0.55)", sw=0.003, ins="zoomdown", z=2.6, zls=0.35, d=0.45))
S(14.6, 15.867, "void", W("REAL", 0.3, 0.48, 0.3, "out", c="rgba(255,255,255,0.4)", sw=0.003, fillseq={"at": 0.0, "d": 0.3, "f": "holo"}, out=O(1.05, "chars", 0.2)),
  W("WILD", 0.3, 0.48, 0.72, "out", c="rgba(255,255,255,0.4)", sw=0.003, fillseq={"at": 0.05, "d": 0.35, "f": "holo"}, out=O(1.07, "chars", 0.2)),
  box(0.3, 0.29, 0.38, 0.016, "holo", ins="wipeR", at=0.4, d=0.12, kf=KF((0.62, {"x": 0}), (0.78, {"x": -0.7, "e": "in"})), out=O(0.8)),
  lab("REAL WILD", rows=(0.055, 0.945), xs=(0.1, 0.9)))
S(15.867, 16.133, "void", SPARKS(8, 6))
S(16.133, 17.45, "void", *[W("LIGHT IT UP", 0.22, 0.47, y, "out", c="rgba(255,255,255,0.4)", sw=0.0025, out=O(0.65, "fade", 0.2), kf=KF((0, {"y": 0}), (0.7, {"y": -0.08, "e": "lin"}))) for y in (0.1, 0.22, 0.34, 0.66, 0.78, 0.9)],
  *[box(-0.2 + 0.25 * i, 0.47, 0.18, 0.06, "holo", kf=KF((0, {"x": 0}), (0.25, {"x": 0.4, "e": "lin"})), out=O(0.25)) for i in range(5)],
  W("LIGHT IT", 0.24, 0.45, 0.5, "holo", ins="assemble", d=0.2, out=O(1.13, "up", 0.25)),
  T("U", 0.06, 0.6, 0.52, "c", "holo", ins="drop", at=0.3, d=0.35, out=O(1.17, "up", 0.25)),
  T("P", 0.06, 0.635, 0.52, "c", "holo", ins="drop", at=0.38, d=0.35, out=O(1.2, "up", 0.25)))
S(17.45, 18.067, "void", W("WORLD", 0.2, 0.42, 0.5, "out", c="rgba(255,255,255,0.75)", sw=0.003, ins="assemble", d=0.12),
  box(0.31, 0.44, 0.22, 0.12, "transparent", stroke="rgba(255,255,255,0.5)", r="6px", ins="wipeL", d=0.15, out=O(0.3)),
  W("ON", 0.07, 0.6, 0.5, "out", c="rgba(255,255,255,0.75)", ins="cut", at=0.25), box(0.56, 0.45, 0.12, 0.1, "white", ins="wipeL", at=0.35, d=0.1, out=O(0.55)))
S(18.067, 18.733, "void", W("WORLD ON", 0.26, 0.31, 0.53, "out", c="rgba(255,255,255,0.7)", sw=0.003),
  W("FIRE", 0.15, 0.62, 0.5, "holo", ins="zoomdown", z=2.3, zls=0.25, d=0.2, jit={"a": 0.006, "r": 0.8, "fps": 10, "from": 0.2, "to": 0.45}),
  lab("WORLD ON FIRE", rows=(0.055, 0.945), xs=(0.1, 0.5, 0.9)))
S(18.733, 19.0, "void", W("WORLD ON FIRE", 0.5, 0.42, 0.5, "out", c="rgba(255,255,255,0.45)", sw=0.003),
  *[box(0.32 + 0.12 * i, 0.08 * i, 0.68 - 0.12 * i, 1.0, "holo", kf=KF((0.04 * i, {"x": 0.8}), (0.04 * i + 0.14, {"x": 0, "e": "out"}))) for i in range(3)])
S(19.0, 19.467, "void", W("BREAK", 0.66, 0.5, 0.5, "out", "w", c="rgba(255,255,255,0.62)", sw=0.0032, ins="zoomdown", z=1.0, zls=0.55, d=0.4),
  RING(0.62, 0.5, 0.9, c="rgba(255,255,255,0.45)", s0=1.0, d=0.01, kf=KF((0, {"x": 0.2}), (0.45, {"x": -0.45, "e": "io"}))), trans="cut")
S(19.467, 19.867, "void", W("BREAK", 0.66, 0.5, 0.5, "out", "w", c="rgba(255,255,255,0.62)", sw=0.0032, fillseq={"at": 0.0, "d": 0.3, "f": "holo"}),
  orn(0.5, 0.1, 4, 0.01, "#ffffff"), orn(0.5, 0.9, 4, 0.01, "#ffffff"))
S(19.867, 20.467, "void", W("BREAK", 0.66, 0.5, 0.5, "holo", "w"), box(0.0, 0.47, 1.0, 0.004, "white", op=0.8, ins="wipeL", d=0.12), box(0.0, 0.55, 1.0, 0.004, "white", op=0.8, ins="wipeR", d=0.12),
  W("RULES", 0.1, 0.5, 0.51, "dim", ins="assemble", d=0.12), orn(0.5, 0.1, 4, 0.01, "#9EEFF4"), orn(0.5, 0.9, 4, 0.01, "#9EEFF4"))
S(20.467, 21.267, "void", W("BREAK", 0.66, 0.5, 0.5, "out", "w", c="rgba(255,255,255,0.45)", sw=0.0032, kf=KF((0.35, {"y": 0}), (0.75, {"y": -0.55, "e": "in"}))),
  box(0.22, 0.45, 0.56, 0.08, "white", kf=KF((0, {"sx": 0.4}), (0.08, {"sx": 1}), (0.18, {"sx": 0.2})), out=O(0.18)),
  W("RULES", 0.12, 0.5, 0.48, "white", ins="cut", kf=KF((0.3, {"y": 0}), (0.75, {"y": -0.5, "e": "in"}))),
  orn(0.5, 0.1, 4, 0.01, "#9EEFF4"), RING(0.5, 1.2, 0.75, c="rgba(255,255,255,0.7)", s0=1.0, d=0.01, at=0.55, kf=KF((0.55, {"y": 0.3}), (0.8, {"y": -0.55, "e": "lin"}))))
S(21.267, 21.4, "void")
S(21.4, 22.267, "void", box(0.43, 0.15, 0.4, 1.2, "#1b1a2a", rot=14, stroke="rgba(170,140,255,0.45)", kf=KF((0, {"y": 0.75, "r": -12}), (0.35, {"y": 0, "r": 0, "e": "out"}), (0.87, {"x": 0.12, "y": -0.08, "r": 4}))),
  IMG("sil-hair-flow", 0.66, 0.65, 0.95, "white", kf=KF((0, {"y": 0.75, "r": -12}), (0.35, {"y": 0, "r": 0, "e": "out"}), (0.87, {"x": 0.12, "y": -0.08, "r": 4}))),
  W("HEARTS", 0.2, 0.08, 0.6, "white", ax=0, ins="wipeU", at=0.2, d=0.15, kf=KF((0.3, {"y": 0.2}), (0.6, {"y": 0, "e": "out"}))),
  box(0.08, 0.68, 0.22, 0.09, "holo", ins="wipeL", at=0.3, d=0.2, kf=KF((0.45, {"sy": 1, "y": 0}), (0.65, {"sy": 0.15, "y": -0.04, "e": "out"}))), cam={"s": [1.0, 1.03], "y": [0.02, -0.02]})
S(22.267, 22.933, "void", box(0.0, 0.0, 1.0, 1.0, "#3a3946", kf=KF((0, {"o": 0.8}), (0.6, {"o": 0.25}))),
  box(0.55, -0.05, 0.42, 1.2, "#1b1a2a", rot=14, kf=KF((0, {"x": 0}), (0.66, {"x": 0.03}))), IMG("sil-hair-flow", 0.78, 0.52, 1.1, "white", kf=KF((0, {"x": 0}), (0.66, {"x": 0.03}))),
  *[shape("heart", 0.07 + i * 0.045, 0.35, 0.065, fill="holo", ins="pop", at=0.03 * i) for i in range(4)],
  W("IN", 0.1, 0.11, 0.58, "white", ins="slide"), W("TWOS", 0.15, 0.25, 0.6, "white", ins="slide", at=0.05))
S(22.933, 23.067, "void", *[box(-0.1, 0.3 + 0.12 * i, 1.2, 0.035, "holo", rot=-18, kf=KF((0, {"x": -0.6}), (0.13, {"x": 0.6, "e": "lin"}))) for i in range(3)])
S(23.067, 24.533, "void", *[x for i, (xx, yy, ww, hh, sid) in enumerate([(0.06, 0.02, 0.2, 0.5, "sil-profile"), (0.3, 0.04, 0.14, 0.44, "sil-spiky"), (0.46, 0.0, 0.2, 0.52, "sil-bun"), (0.7, 0.03, 0.18, 0.46, "sil-ponytail")])
                             for x in (box(xx, yy, ww, hh, "holo", ins="pop", at=0.12 + 0.18 * i), IMG(sid, xx + ww / 2, yy + hh * 0.6, hh * 1.0, "#040407", ins="pop", at=0.16 + 0.18 * i))],
  box(0.04, 0.01, 0.015, 0.3, "holo", ins="wipeD", d=0.15),
  W("THAT'S WHAT THE", 0.31, 0.11, 0.73, "white", ax=0, ins="assemble", d=0.45, at=0.15),
  W("BAD", 0.09, 0.25, 0.86, "white", ax=0, ins="cut", at=0.95, out=O(1.2)), W("BADDEST", 0.2, 0.25, 0.86, "white", ax=0, ins="cut", at=1.2))
S(24.533, 24.8, "void", box(0.06, 0.02, 0.2, 0.5, "holo"), IMG("sil-profile", 0.16, 0.32, 0.5, "#040407"), box(0.46, 0.0, 0.2, 0.52, "holo"), box(0.7, 0.03, 0.18, 0.46, "holo"),
  W("THAT'S WHAT THE", 0.31, 0.11, 0.73, "white", ax=0), W("BADDEST", 0.2, 0.25, 0.86, "white", ax=0), T("DO", 0.05, 0.5, 0.88, "c", "white", ax=0, ins="cut", at=0.18))
S(24.8, 25.45, "void", box(0.08, 0.0, 0.52, 0.72, "holo", ins="wipeD", d=0.12), IMG("sil-lineup", 0.34, 0.37, 0.7, DK, ins="cut", at=0.05),
  W("THAT'S WHAT THE", 0.31, 0.11, 0.73, "dim", ax=0, op=0.7),
  box(0.0, 0.8, 0.5, 0.075, "holo", kf=KF((0, {"x": -0.5}), (0.25, {"x": 0, "e": "out"}))),
  W("BADDEST DO", 0.3, 0.25, 0.86, "white", ax=0, ins="cut"), lab("THE BADDEST", rows=(0.055,), xs=(0.94,)))


# ---- 25,45 - 48 s: estribillo 1 (v3) ----
VIO = "#9a7cf4"


def ko_build(chars, x, y0, dy, h, fill=VIO, at=0.0, d=0.3, out=None):
    return [W(c, h, x, y0 + i * dy, fill, f="ko", nocase=True, ins="assemble", at=at, d=d * 0.6, seed=7 + i, out=out) for i, c in enumerate(chars)]


def break_seq(t0):
    """BREAK / RULES (19,0 - 21,27 s y su repetición): contorno espaciado que se comprime, relleno letra a letra,
    banda RULES, salida hacia arriba con un arco"""
    S(t0, t0 + 0.3, "void", W("BREAK", 0.66, 0.5, 0.5, "out", "w", c="rgba(255,255,255,0.62)", sw=0.0032, ins="zoomdown", z=1.0, zls=0.55, d=0.3),
      RING(0.62, 0.5, 0.9, c="rgba(255,255,255,0.45)", s0=1.0, d=0.01, kf=KF((0, {"x": 0.2}), (0.3, {"x": -0.45}))))
    S(t0 + 0.3, t0 + 0.7, "void", W("BREAK", 0.66, 0.5, 0.5, "out", "w", c="rgba(255,255,255,0.62)", sw=0.0032, fillseq={"at": 0.0, "d": 0.3, "f": "holo"}),
      orn(0.5, 0.1, 4, 0.01, "#ffffff"), orn(0.5, 0.9, 4, 0.01, "#ffffff"))
    S(t0 + 0.7, t0 + 1.3, "void", W("BREAK", 0.66, 0.5, 0.5, "holo", "w"), box(0.0, 0.47, 1.0, 0.004, "white", op=0.8, ins="wipeL", d=0.12),
      box(0.0, 0.55, 1.0, 0.004, "white", op=0.8, ins="wipeR", d=0.12), W("RULES", 0.1, 0.5, 0.51, "dim", ins="assemble", d=0.12),
      orn(0.5, 0.1, 4, 0.01, "#9EEFF4"), orn(0.5, 0.9, 4, 0.01, "#9EEFF4"))
    S(t0 + 1.3, t0 + 2.07, "void", W("BREAK", 0.66, 0.5, 0.5, "out", "w", c="rgba(255,255,255,0.45)", sw=0.0032, kf=KF((0.35, {"y": 0}), (0.72, {"y": -0.55, "e": "in"}))),
      box(0.22, 0.45, 0.56, 0.08, "white", kf=KF((0, {"sx": 0.4}), (0.08, {"sx": 1}), (0.18, {"sx": 0.2})), out=O(0.18)),
      W("RULES", 0.13, 0.5, 0.48, "white", ins="cut", kf=KF((0.3, {"y": 0}), (0.72, {"y": -0.5, "e": "in"}))),
      orn(0.5, 0.1, 4, 0.01, "#9EEFF4"), RING(0.5, 1.2, 0.75, c="rgba(255,255,255,0.7)", s0=1.0, d=0.01, at=0.5, kf=KF((0.5, {"y": 0.3}), (0.77, {"y": -0.55, "e": "lin"}))))


def hearts_seq(t0, t_twos, t_bars, t_end):
    S(t0, t_twos, "void", box(0.43, 0.15, 0.4, 1.2, "#1b1a2a", rot=14, stroke="rgba(170,140,255,0.45)", kf=KF((0, {"y": 0.75, "r": -12}), (0.32, {"y": 0, "r": 0, "e": "out"}), (t_twos - t0, {"x": 0.12, "y": -0.08, "r": 4}))),
      IMG("sil-hair-flow", 0.66, 0.65, 0.95, "white", kf=KF((0, {"y": 0.75, "r": -12}), (0.32, {"y": 0, "r": 0, "e": "out"}), (t_twos - t0, {"x": 0.12, "y": -0.08, "r": 4}))),
      W("HEARTS", 0.2, 0.08, 0.6, "white", ax=0, ins="wipeU", at=0.18, d=0.15, kf=KF((0.25, {"y": 0.2}), (0.5, {"y": 0, "e": "out"}))),
      box(0.08, 0.68, 0.22, 0.09, "holo", ins="wipeL", at=0.25, d=0.2, kf=KF((0.4, {"sy": 1, "y": 0}), (0.6, {"sy": 0.15, "y": -0.04, "e": "out"}))), cam={"s": [1.0, 1.03], "y": [0.02, -0.02]})
    S(t_twos, t_bars, "void", box(0.0, 0.0, 1.0, 1.0, "#3a3946", kf=KF((0, {"o": 0.8}), (t_bars - t_twos, {"o": 0.25}))),
      box(0.55, -0.05, 0.42, 1.2, "#1b1a2a", rot=14), IMG("sil-hair-flow", 0.78, 0.52, 1.1, "white", kf=KF((0, {"x": 0}), (t_bars - t_twos, {"x": 0.03}))),
      *[shape("heart", 0.07 + i * 0.045, 0.35, 0.065, fill="holo", ins="pop", at=0.03 * i) for i in range(4)],
      W("IN", 0.1, 0.11, 0.58, "white", ins="slide"), W("TWOS", 0.15, 0.25, 0.6, "white", ins="slide", at=0.05))
    S(t_bars, t_end, "void", *[box(-0.1, 0.3 + 0.12 * i, 1.2, 0.035, "holo", rot=-18, kf=KF((0, {"x": -0.6}), (t_end - t_bars, {"x": 0.6, "e": "lin"}))) for i in range(3)])


S(25.45, 27.333, "void", W("GOING", 1.3, 0.5, 0.5, "out", c="rgba(255,255,255,0.22)", sw=0.0025, kf=KF((0, {"x": 0.02}), (1.88, {"x": -0.04, "e": "lin"}))),
  {"k": "diag", "n": 5, "ang": 24, "op": 0.35},
  *ko_build("끝내주지", 0.49, 0.25, 0.17, 0.075, at=0.0, d=0.35),
  W("NEVER GOING BACK", 0.23, 0.2, 0.5, "white", ins="words", wt=[0.15, 0.45, 0.75]),
  W("NEVER GOING BACK", 0.23, 0.79, 0.5, "white", ins="words", wt=[0.25, 0.55, 0.85]), cam={"s": [1.05, 1.0]})
S(27.333, 27.6, "void", W("GOING", 1.3, 0.5, 0.5, "out", c="rgba(255,255,255,0.22)", sw=0.0025),
  *ko_build("끝내주지", 0.49, 0.25, 0.17, 0.075, at=0.0, d=0.01, out=O(0.05, "glitch", 0.2)),
  W("NAH", 0.1, 0.3, 0.53, "white", kf=KF((0, {"x": -0.3}), (0.2, {"x": 0, "e": "out"}))),
  W("NEVER GOING BACK", 0.23, 0.2, 0.5, "white", kf=KF((0, {"x": 0}), (0.2, {"x": -0.4, "e": "in"}))),
  W("NEVER GOING BACK", 0.23, 0.79, 0.5, "white", kf=KF((0, {"x": 0}), (0.2, {"x": 0.4, "e": "in"}))), cam=False)
S(27.6, 28.4, "void", W("GOING", 1.3, 0.5, 0.5, "out", c="rgba(255,255,255,0.22)", sw=0.0025, kf=KF((0, {"x": 0}), (0.8, {"x": -0.03}))),
  W("NAH", 0.1, 0.32, 0.53, "out", c="rgba(255,255,255,0.6)"), W("NOT", 0.14, 0.45, 0.53, "white", ins="assemble", d=0.1),
  W("THAT", 0.16, 0.62, 0.55, "white", ins="zoomdown", at=0.33, z=1.5, zls=0.2, d=0.12), VCOL("NAH NOT THAT", 0.96, -0.02, op=0.5))
S(28.4, 28.9, "void", W("GOING", 1.3, 0.5, 0.5, "out", c="rgba(255,255,255,0.22)", sw=0.0025, kf=KF((0, {"x": 0}), (0.5, {"x": -0.75, "e": "in"}))),
  W("NAH NOT THAT", 0.4, 0.46, 0.53, "white", out=O(0.0, "chars", 0.25)), cam=False)
S(28.9, 29.5, "void", W("DIAMONDS", 0.33, 0.5, 0.5, "out", c="rgba(255,255,255,0.6)", sw=0.003, ins="assemble", d=0.3, hold=0.25,
                          fillseq={"at": 0.52, "d": 0.06, "f": "white", "rand": True}),
  *[T("BLING BLING BLING", 0.012, 0.86, 0.6 + 0.03 * i, "c", "white", op=0.5, ins="cut", at=0.04 * i) for i in range(7)])
S(29.5, 29.9, "void", W("DIAMONDS", 0.3, 0.45, 0.47, "white", rot=-5, kf=KF((0, {"y": 0}), (0.4, {"y": 0.06, "x": 0.04}))),
  IMG("obj-diamond", 0.75, 0.6, 1.1, "raw", ins="cut", blend="screen", kf=KF((0, {"x": 0.12, "y": 0.25, "r": -35}), (0.4, {"x": -0.05, "y": -0.1, "r": -15, "e": "out"}))))
S(29.9, 30.433, "void", IMG("obj-diamond", 0.42, 0.45, 1.6, "raw", ins="cut", blend="screen", kf=KF((0, {"s": 1.0, "r": -8}), (0.53, {"s": 1.25, "r": 6}))),
  W("DIAMONDS", 0.27, 0.57, 0.62, "white", ins="cut", kf=KF((0, {"y": 0.08}), (0.4, {"y": 0}))),
  *[box(0.47 + 0.035 * i, 0.66, 0.01, 0.4, "white", ins="wipeD", at=0.28 + 0.03 * i, d=0.18) for i in range(5)])
S(30.433, 31.0, "void", W("PLASH", 1.3, 0.5, 0.5, "out", c="rgba(255,255,255,0.2)", sw=0.0025, rot=-8),
  W("SPLASH", 0.34, 0.5, 0.55, "out", c="rgba(255,255,255,0.45)", sw=0.003, ins="cut"),
  *[box(0.4 + 0.035 * i, 0.12, 0.012, 0.26, "#c9c4ff", kf=KF((0.3 + 0.03 * i, {"y": -0.3}), (0.45 + 0.03 * i, {"y": 0.05, "e": "in"})), out=O(0.55)) for i in range(4)],
  SPARKS(14, 9, c="#ffffff"))
S(31.0, 31.933, "void", W("PLASH", 1.3, 0.5, 0.5, "out", c="rgba(255,255,255,0.2)", sw=0.0025, rot=-8, kf=KF((0, {"x": 0}), (0.93, {"x": -0.03}))),
  rep("SPLASH", 5, 0.34, 0.5, 0.36, hero=0, sp=0.62, op=0.55, drift=0.02, ins="wipeD"), SPARKS(14, 9, c="#ffffff"))
break_seq(31.933)
S(34.0, 34.367, "void", SPARKS(6, 12))
hearts_seq(34.367, 35.033, 35.7, 36.0)
S(36.0, 36.733, "void", box(-0.2, 0.15, 1.4, 0.006, "#8c4dff", rot=-14, kf=KF((0, {"x": -0.5}), (0.12, {"x": 0.5, "e": "lin"})), out=O(0.12)),
  W("THAT'S", 0.2, 0.18, 0.62, "out", c="rgba(255,255,255,0.4)", rot=90, kf=KF((0, {"y": 0.1}), (0.4, {"y": -0.08}))),
  W("THAT'S", 0.24, 0.08, 0.55, "white", ax=0, ins="slide", kf=KF((0, {"y": 0.06}), (0.4, {"y": -0.04})), out=O(0.4)),
  W("THAT'S WHAT", 0.88, 0.5, 0.42, "white", ins="cut", at=0.4, out=O(0.73)), lab("WE THE BADDEST", rows=(0.065, 0.935)))
S(36.733, 38.467, "void", W("THAT'S WHAT", 0.3, 0.07, 0.4, "white", ax=0, ins="cut"),
  W("THE BADDEST", 0.3, 0.07, 0.55, "white", ax=0, ins="assemble", d=0.5, hold=0.2, bc="transparent"),
  T("DO", 0.08, 0.385, 0.55, "c", "white", ax=0, ins="assemble", at=0.95, d=0.05, bc="transparent"),
  W("BADDEST DO", 0.12, 0.3, 0.7, "out", c="rgba(255,255,255,0.3)", rot=180), lab("WE THE BADDEST", rows=(0.065, 0.935)))
S(38.467, 39.333, "ice", W("SPIT", 0.32, 0.5, 0.27, "ink", ins="assemble", d=0.3, hold=0.12, bc="#0e0c18"),
  W("HEAT", 0.62, 0.5, 0.75, "out", c="#1a1a30", sw=0.003, ins="assemble", at=0.15, d=0.3, hold=0.1, bc="transparent"),
  cam={"s": [1.7, 1.0], "e": "out", "y": [0.12, 0.0]})
S(39.333, 39.9, "ice", W("MELT", 0.3, 0.47, 0.32, "out", c="#1a1a30", sw=0.003, rot=-10, ins="cut"), IMG("emb-crest", 0.56, 0.29, 0.07, "ink", rot=-10),
  box(0.31, 0.52, 0.34, 0.15, "#0e0c18", rot=-6, ins="wipeL", d=0.12), W("YOUR", 0.28, 0.5, 0.6, "white", rot=-6, ins="slide", at=0.05),
  *[box(0.02 + 0.92 * (i % 2), 0.2 + 0.25 * i, 0.04, 0.16, "holo", kf=KF((0, {"y": 0.05}), (0.57, {"y": -0.05}))) for i in range(3)],
  lab("SPIT HEAT MELT YOUR FACE OFF", rows=(0.9,), xs=(0.3,)))
S(39.9, 40.467, "ice", box(0.0, 0.05, 0.22, 0.3, "holo", kf=KF((0, {"y": 0.05}), (0.57, {"y": -0.02}))),
  W("FACE", 0.26, 0.5, 0.32, "ink", ins="slide", kf=KF((0, {"x": 0.02}), (0.57, {"x": -0.03}))),
  W("OFF", 0.25, 0.52, 0.67, "out", "w", c="#1a1a30", sw=0.003, ins="cut", at=0.1, kf=KF((0, {"x": 0.02}), (0.57, {"x": -0.03}))))
S(40.467, 41.633, "ice", box(0.45, 0.05, 0.53, 0.9, "holo", kf=KF((0, {"x": 0.15}), (0.4, {"x": 0, "e": "out"}))), media("hair", 0.45, 0.05, 0.53, 0.9, "duo", op=0.6, kf=KF((0, {"x": 0.15}), (0.4, {"x": 0, "e": "out"}))),
  box(0.2, -0.3, 0.25, 1.6, "holo", rot=28, kf=KF((0, {"x": 0.7}), (0.45, {"x": -0.8, "e": "io"})), out=O(0.45)),
  W("사라져", 0.25, 0.3, 0.27, "ink", f="ko", nocase=True, ins="assemble", at=0.1, d=0.2, bc="#0e0c18"),
  W("사라져", 0.25, 0.3, 0.52, "out", c="#1a1a30", f="ko", nocase=True, sw=0.003, ins="cut", at=0.2))
S(41.633, 42.4, "holo", media("hair", 0.0, 0.0, 1.0, 1.0, "duo", op=0.5, kf=KF((0, {"s": 1.0}), (0.77, {"s": 1.1}))),
  W("CUT", 0.2, 0.52, 0.5, "ink", ins="stamp", out=O(0.7, "glitch", 0.07)),
  W("CUT", 0.2, 0.5, 0.25, "out", c="#1a1a30", sw=0.003, ins="cut", at=0.66), W("CUT", 0.2, 0.5, 0.78, "out", c="#1a1a30", sw=0.003, rot=180, ins="cut", at=0.66))
S(42.4, 43.3, "ice", IMG("sil-stand", 0.5, 0.55, 1.15, "holo", op=0.85, ins="fade", d=0.25, kf=KF((0, {"x": 0.02}), (0.9, {"x": -0.02}))),
  W("RAZOR", 0.39, 0.5, 0.5, "#2a2a34", sweep="#a2a2ae", sat=0.25, sd=0.5, ins="cut", echo={"n": 2, "dy": 0.16, "d": 0.18, "at": 0.0, "c": "rgba(30,30,50,0.5)"}))
S(43.3, 44.167, "void", W("MURDER", 1.3, 0.55, 0.16, "out", c="rgba(255,255,255,0.3)", rot=-12, kf=KF((0, {"x": 0.03}), (0.87, {"x": -0.05}))),
  W("MURDER", 1.3, 0.55, 0.84, "out", c="rgba(255,255,255,0.3)", rot=-12, kf=KF((0, {"x": -0.03}), (0.87, {"x": 0.05}))),
  IMG("sil-ponytail", 0.22, 0.6, 1.25, "holo", ins="cut", glow=0.01, kf=KF((0, {"x": 0.04, "s": 1.0}), (0.45, {"x": 0, "s": 1.0}), (0.75, {"x": -0.06, "s": 1.45, "e": "in"}))),
  W("MURDER", 0.62, 0.66, 0.5, "white", rot=-12, ins="slide", kf=KF((0, {"x": 0.02}), (0.87, {"x": -0.05}))))
S(44.167, 44.967, "void", W("BLAZER", 1.3, 0.55, 0.16, "out", c="rgba(255,255,255,0.3)", rot=-12, kf=KF((0, {"x": 0}), (0.7, {"x": -0.08}), (0.8, {"x": -0.6, "e": "in"}))),
  W("BLAZER", 1.3, 0.55, 0.84, "out", c="rgba(255,255,255,0.3)", rot=-12, kf=KF((0, {"x": 0}), (0.7, {"x": 0.05}), (0.8, {"x": -0.6, "e": "in"}))),
  IMG("sil-spiky", 0.25, 0.6, 1.3, "holo", ins="cut", glow=0.01, kf=KF((0, {"x": 0}), (0.45, {"x": -0.08})), out=O(0.45, "glitch", 0.1)),
  W("BLAZER", 0.62, 0.65, 0.5, "white", rot=-10, ins="cut", kf=KF((0, {"x": 0.03}), (0.7, {"x": -0.05}), (0.8, {"x": -0.7, "e": "in"}))))
S(44.967, 45.633, "void", IMG("sil-hood", 0.5, 0.62, 1.2, DK, op=0.9, kf=KF((0, {"s": 1.0}), (0.67, {"s": 1.03}))),
  W("BOYS ON ME", 0.25, 0.5, 0.53, "out", c="rgba(255,255,255,0.5)", ins="assemble", d=0.45, hold=0.15,
    fillseq={"at": 0.55, "d": 0.08, "f": "#8d8d98", "rand": True}),
  T("NODEMOTION · THE BADDEST · NODEMOTION", 0.011, 0.5, 0.58, "c", "rgba(255,255,255,0.5)", ins="scatter", d=0.4))
S(45.633, 46.633, "void", IMG("sil-hood", 0.5, 0.62, 1.2, DK, op=0.9, kf=KF((0, {"s": 1.03}), (1.0, {"s": 1.06}))),
  W("BOYS ON ME", 0.25, 0.5, 0.53, "white", ins="cut", out=O(0.93, "chars", 0.08)),
  T("NODEMOTION · THE BADDEST · NODEMOTION", 0.011, 0.5, 0.58, "c", "rgba(255,255,255,0.5)"),
  VCOL("WE THE BADDEST", 0.06, -0.06, op=0.6), VCOL("WE THE BADDEST", 0.94, 0.06, op=0.6))
S(46.633, 47.167, "void", IMG("sil-hood", 0.5, 0.62, 1.2, DK, op=0.9),
  W("LINES ON RING", 0.28, 0.5, 0.53, "out", c="rgba(255,255,255,0.5)", ins="assemble", d=0.35, hold=0.1,
    fillseq={"at": 0.45, "d": 0.06, "f": "#8d8d98", "rand": True}), VCOL("WE THE BADDEST", 0.06, -0.06, op=0.6), VCOL("WE THE BADDEST", 0.94, 0.06, op=0.6))
S(47.167, 48.0, "void", IMG("sil-hood", 0.5, 0.62, 1.2, DK, op=0.9),
  W("LINES ON RING", 0.28, 0.5, 0.53, "white", ins="cut", out=O(0.62, "chars", 0.15)),
  box(0.38, 0.46, 0.24, 0.1, "#08090c", stroke="rgba(255,255,255,0.4)", kf=KF((0.5, {"sx": 0.05}), (0.62, {"sx": 1, "e": "out"}))),
  box(0.44, 0.41, 0.12, 0.18, "transparent", stroke="rgba(255,255,255,0.8)", ins="cut", at=0.65, kf=KF((0.65, {"s": 0.6}), (0.83, {"s": 1.6, "e": "in"}))),
  VCOL("WE THE BADDEST", 0.06, -0.06, op=0.6), VCOL("WE THE BADDEST", 0.94, 0.06, op=0.6))


# ---- 48 - 77,23 s: rojo y morado (v3) ----
BLUE = "brightness(0.75) sepia(1) hue-rotate(185deg) saturate(2.2)"
S(48.0, 48.533, "void", media("glasses", 0.0, 0.0, 1.0, 1.0, "tint", c="#24315c", op=0.5, ct=1.5, kf=KF((0, {"s": 1.08}), (0.53, {"s": 1.0}))),
  box(0.4, 0.3, 0.2, 0.36, "transparent", stroke="rgba(190,200,255,0.8)", kf=KF((0, {"s": 0.5}), (0.5, {"s": 1.75, "e": "out"}))),
  VCOL("THE BADDEST", 0.04, -0.05, op=0.55), VCOL("THE BADDEST", 0.96, 0.05, op=0.55), trans="cut")
S(48.533, 49.3, "void", media("glasses", 0.0, 0.0, 1.0, 1.0, "tint", c="#24315c", op=0.6, ct=1.5, kf=KF((0, {"s": 1.0}), (0.77, {"s": 1.05}))),
  W("DEAD", 0.42, 0.5, 0.27, "out", "w", c="rgba(200,210,255,0.35)", ins="cut", at=0.2), W("DEAD", 0.42, 0.5, 0.73, "out", "w", c="rgba(200,210,255,0.35)", ins="cut", at=0.2),
  W("DEAD", 0.42, 0.5, 0.5, "holo", "w", ins="zoomdown", z=1.0, zls=1.2, d=0.28), lab("DEAD", rows=(0.06, 0.94), xs=(0.12, 0.5, 0.88)))
S(49.3, 49.433, "void", box(0.0, 0.0, 1.0, 1.0, "#2e3f78"), media("glasses", 0.0, 0.0, 1.0, 1.0, "tint", c="#9fb4ff", op=0.35, ct=2.2, br=1.4),
  W("DEAD", 0.42, 0.5, 0.5, "#0b1020", "w"), cam=False)
S(49.433, 50.0, "void", media("glasses", 0.0, 0.0, 1.0, 1.0, "tint", c="#2c3b6e", op=0.85, ct=1.6, kf=KF((0, {"s": 1.0}), (0.57, {"s": 1.08}))), lab("DEAD", rows=(0.06, 0.94), xs=(0.12, 0.88)))
S(50.0, 50.733, "void", media("glasses", 0.0, 0.0, 1.0, 1.0, "tint", c="#2c3b6e", op=0.5, ct=1.6, out=O(0.2, "fade", 0.2)),
  W("DEAD", 0.3, 0.55, 0.47, "holo", "w", out=O(0.0, "chars", 0.3)),
  media("glasses", 0.12, 0.33, 0.24, 0.28, "tint", c="#b8ccff", op=0.9, ct=1.6, br=1.2, kf=KF((0, {"x": -0.2}), (0.73, {"x": 0.45, "e": "lin"}))),
  W("ALL THE EYES ON ME", 0.42, 0.5, 0.5, "white", ls=0.25, ins="scatter", at=0.18, d=0.4),
  box(0.06, 0.22, 0.01, 0.56, "rgba(255,255,255,0.6)"), VCOL("THE BADDEST", 0.04, -0.05, op=0.45))
S(50.733, 51.6, "void", media("glam", 0.0, 0.0, 1.0, 1.0, "tint", c="#ff1030", op=0.95, ct=1.4, br=0.8, kf=KF((0, {"s": 1.0}), (0.87, {"s": 1.12}))),
  W("ALL THE EYES ON ME", 0.42, 0.5, 0.5, "#ff2a3d", ls=0.25, op=0.85, ins="cut", flick={"at": 0.2, "d": 0.6, "n": 8}))
S(51.6, 51.733, "redflat", RING(0.5, 0.5, 0.45, c="rgba(255,60,80,0.8)", s0=0.3, d=0.13, sw=0.05), cam=False)
S(51.733, 52.25, "redflat", RING(0.5, 0.5, 0.55, c="rgba(255,90,110,0.45)", s0=0.4, d=0.4, sw=0.12),
  IMG("emb-crest", 0.5, 0.5, 1.0, "holo", ins="pop", glow=0.015, kf=KF((0.25, {"s": 1, "o": 1}), (0.5, {"s": 0.35, "o": 0})), out=O(0.5)),
  W("걸어들어와", 0.3, 0.5, 0.52, "white", f="ko", nocase=True, ins="assemble", at=0.2, d=0.25, bc="transparent"))
S(52.25, 52.75, "redflat", W("걸어들어와", 0.2, 0.5, 0.52, "ink", f="ko", nocase=True), box(0.3, 0.66, 0.4, 0.02, "transparent", stroke="rgba(255,255,255,0.3)"),
  *[box(0.62 + 0.08 * i, 0.32, 0.05, 0.08, "transparent", stroke="rgba(255,255,255,0.35)") for i in range(3)])
S(52.75, 53.467, "redflat", W("걸", 0.24, 0.47, 0.42, "holo", f="ko", nocase=True, ins="assemble", d=0.3, bc="transparent", kf=KF((0, {"y": 0.08, "s": 0.9}), (0.7, {"y": -0.04, "s": 1.1}))),
  W("어", 0.2, 0.52, 0.62, "holo", f="ko", nocase=True, ins="assemble", at=0.2, d=0.3, bc="transparent", kf=KF((0.2, {"y": 0.08, "s": 0.9}), (0.7, {"y": -0.02, "s": 1.1}))),
  W("걸어들어와", 0.2, 0.5, 0.52, "ink", f="ko", nocase=True))
S(53.467, 53.733, "redflat", box(0.0, 0.0, 1.0, 1.0, "holo", kf=KF((0, {"y": 1.0}), (0.12, {"y": 0, "e": "out"}))), lab("BADDEST", rows=(0.3, 0.55, 0.78), xs=(0.93,), c="rgba(20,20,40,0.6)"))
S(53.733, 55.4, "redflat", box(0.0, 0.0, 0.12, 1.0, "holo", kf=KF((1.07, {"sx": 1}), (1.35, {"sx": 6.5, "e": "io"}))),
  W("유", 0.1, 0.12, 0.33, "holo", f="ko", nocase=True, ins="assemble", d=0.15, bc="transparent"), W("행", 0.1, 0.22, 0.33, "holo", f="ko", nocase=True, ins="assemble", at=0.18, d=0.15, bc="transparent"),
  W("선두자", 0.36, 0.75, 0.72, "out", f="ko", nocase=True, sw=0.002, c="rgba(255,255,255,0.55)", ins="slide", at=0.1, kf=KF((0, {"x": 0.02}), (1.0, {"x": -0.02}))),
  W("선두자", 0.3, 0.75, 0.65, "ink", f="ko", nocase=True, ins="cut", at=1.0), lab("BADDEST", rows=(0.06, 0.25, 0.5, 0.94), xs=(0.95,)))
S(55.4, 56.25, "holo", media("hair", 0.0, 0.0, 0.86, 1.0, "duo", op=0.65, kf=KF((0, {"s": 1.0}), (0.85, {"s": 1.08}))), box(0.86, 0.0, 0.14, 1.0, "red"),
  *[T("원하지만", 0.05, 0.82, 0.1 + 0.11 * i, "ko", "ink", nocase=True, ins="cut", at=0.04 * i, out=O(0.3)) for i in range(8)],
  VCOL("못하잖아", 0.93, -0.25, h=0.022, sp=0.03, n=34, c="#0e0c18", op=1))
S(56.25, 57.633, "redflat", box(0.15, 0.15, 0.7, 0.66, "holo", kf=KF((0, {"sx": 1.4, "sy": 1.4}), (0.25, {"sx": 1.0, "sy": 0.75, "e": "out"}), (1.05, {"sx": 1.0, "sy": 0.75}), (1.38, {"sx": 0.45, "sy": 0.25, "x": -0.15, "y": 0.2, "e": "step"})), out=O(1.38)),
  media("glam", 0.2, 0.25, 0.6, 0.45, "duo", op=0.8, kf=KF((0, {"x": 0}), (1.05, {"x": 0.03})), out=O(1.05, "collapse", 0.33)),
  W("애가 타잖아", 0.9, 0.55, 0.55, "out", f="ko", nocase=True, sw=0.002, c="rgba(255,255,255,0.4)", kf=KF((0, {"x": 0.05}), (1.05, {"x": -0.08})), out=O(1.05)),
  W("애가 타잖아", 0.22, 0.32, 0.62, "ink", f="ko", nocase=True, ins="assemble", d=0.35, hold=0.1, out=O(1.3, "chars", 0.08)))
S(57.633, 58.0, "redflat", *[box(0.05 + 0.3 * i, 0.38, 0.22, 0.24, "transparent", stroke="rgba(14,12,24,0.6)") for i in range(3)])
S(58.0, 58.5, "redflat", {"k": "diag", "n": 4, "ang": 25, "op": 0.45}, *[box(0.05 + 0.3 * i, 0.38, 0.22, 0.24, "transparent", stroke="rgba(14,12,24,0.6)", kf=KF((0, {"s": 1.4}), (0.4, {"s": 0.8}))) for i in range(3)],
  lab("WHOA", rows=(0.06, 0.94), xs=(0.08, 0.5, 0.92), c="#fff"))
S(58.5, 59.3, "redflat", {"k": "diag", "n": 4, "ang": 25, "op": 0.45}, W("WHOA", 0.22, 0.5, 0.33, "ink", ins="assemble", d=0.15, bc="transparent"),
  W("KALI", 0.18, 0.5, 0.52, "out", c="rgba(14,12,24,0.75)", sw=0.003, ins="assemble", at=0.1, d=0.3, bc="transparent", fillseq={"at": 0.63, "d": 0.04, "f": "ink"}),
  lab("WHOA", rows=(0.06, 0.94), xs=(0.08, 0.5, 0.92), c="#fff"))
S(59.3, 60.067, "redflat", {"k": "diag", "n": 4, "ang": 25, "op": 0.45},
  IMG("obj-trophy", 0.32, 0.25, 1.6, "raw", tone="gold", kf=KF((0, {"x": 0.45, "r": 20}), (0.25, {"x": 0, "r": -28, "e": "out"}), (0.77, {"r": -24}))),
  W("KALI", 0.12, 0.55, 0.5, "ink", kf=KF((0, {"s": 1.0}), (0.15, {"s": 0.6})), out=O(0.18)),
  W("GOAT", 0.08, 0.55, 0.5, "ink", ins="assemble", at=0.18, d=0.12, bc="#0e0c18"),
  W("GOAT", 0.08, 0.7, 0.5, "out", c="rgba(14,12,24,0.5)", ins="cut", at=0.4), lab("GOAT", rows=(0.06, 0.94), xs=(0.33, 0.7), c="#fff"))
S(60.067, 60.7, "redflat", *[W("난알지", 0.3, 0.22, 0.35 + 0.24 * i, "out", f="ko", nocase=True, c="rgba(255,255,255,0.45)", sw=0.003, ins="zoomdown", z=1.5, zls=0.1, d=0.15,
                                kf=KF((0, {"y": 0.05}), (0.63, {"y": -0.12, "e": "lin"}))) for i in range(-1, 3)],
  IMG("obj-trophy", 0.27, 0.45, 0.42, "raw", tone="gold", ins="pop"), lab("I KNOW", rows=(0.03, 0.97), xs=(0.33, 0.7), c="#fff"))
S(60.7, 61.3, "redflat", *[W("난알지", 0.28, 0.24, 0.3 + 0.25 * i, "ink", f="ko", nocase=True, ins="assemble", at=0.02 * i, d=0.08, bc="#0e0c18", out=O(0.5, "glitch", 0.1)) for i in range(3)],
  IMG("obj-ball", 0.9, 0.42, 0.2, "raw", kf=KF((0, {"x": 0.05, "r": 0}), (0.55, {"x": -0.55, "r": -220, "e": "lin"}))))
S(61.3, 61.95, "void", {"k": "diag", "n": 5, "ang": 20, "op": 0.7, "c": "rgba(255,255,255,0.8)"},
  W("크게", 1.1, 0.55, 0.45, "out", f="ko", nocase=True, c="rgba(255,255,255,0.75)", sw=0.003, kf=KF((0, {"x": 0.05, "y": 0.03}), (0.65, {"x": -0.12, "y": -0.04}))),
  IMG("obj-ball", 0.25, 0.3, 0.3, "raw", kf=KF((0, {"x": 0, "y": 0, "r": 0}), (0.35, {"x": 0.12, "y": 0.18, "r": 90}), (0.65, {"x": 0.25, "y": 0.6, "r": 160, "e": "in"}))))
S(61.95, 62.2, "void", W("크게", 1.1, 0.4, 0.45, "out", f="ko", nocase=True, c="rgba(255,255,255,0.75)", sw=0.003),
  IMG("obj-ball", 0.42, 0.62, 1.4, "raw", kf=KF((0, {"s": 0.7}), (0.25, {"s": 1.15, "e": "out"}))))
S(62.2, 62.6, "purple", *[box(x, y, 0.5, 0.45, "holo", r="50%", kf=KF((0, {"s": 2.2}), (0.4, {"s": 0.6, "x": dx, "y": dy, "e": "out"}))) for x, y, dx, dy in ((0.1, 0.0, -0.2, -0.15), (0.55, 0.05, 0.2, -0.15), (0.0, 0.6, -0.2, 0.2), (0.6, 0.6, 0.2, 0.2))],
  box(0.3, -0.3, 0.06, 1.6, "#120328", rot=20, kf=KF((0, {"x": -0.4}), (0.25, {"x": 0.5, "e": "lin"}))),
  W("I LIKE TO BALL", 0.3, 0.5, 0.5, "white", ins="wipeL", at=0.15, d=0.15))
S(62.6, 63.133, "purple", W("I LIKE TO BALL", 0.3, 0.5, 0.5, "holo"))
S(63.133, 64.0, "purple", W("멈추지 않아", 0.33, 0.5, 0.5, "out", f="ko", nocase=True, c="rgba(255,255,255,0.5)", ins="fly", d=0.3, fillseq={"at": 0.35, "d": 0.05, "f": "white", "rand": True}))
S(64.0, 64.633, "purple", IMG("emb-blades", 0.5, 0.55, 1.0, "holo", kf=KF((0, {"s": 0.9, "o": 0.25}), (0.4, {"s": 1.05, "o": 0.5}), (0.6, {"s": 1.7, "o": 1.0, "e": "in"}))),
  W("멈추지 않아", 0.33, 0.5, 0.5, "white", f="ko", nocase=True, kf=KF((0.4, {"s": 1}), (0.6, {"s": 1.6, "y": -0.15, "e": "in"}))))
S(64.633, 64.833, "redflat", *[box(0.03 + 0.09 * i, 0.0 if i % 2 else 0.2, 0.03 + 0.03 * (i % 3), 0.8, "#08090c") for i in range(11)], cam=False)
S(64.833, 65.467, "void", W("나는 LIT", 0.29, 0.5, 0.5, "white", f="ko", nocase=True, ins="assemble", d=0.12),
  W("나는 LIT", 0.6, 0.5, 0.13, "out", f="ko", nocase=True, c="rgba(255,255,255,0.3)", ins="scatter", d=0.3, kf=KF((0.3, {"y": 0}), (0.63, {"y": 0.05}))),
  W("나는 LIT", 0.6, 0.5, 0.87, "out", f="ko", nocase=True, c="rgba(255,255,255,0.3)", ins="scatter", d=0.3, kf=KF((0.3, {"y": 0}), (0.63, {"y": -0.05}))))
S(65.467, 66.0, "void", W("BIT", 0.07, 0.5, 0.5, "white", ins="cut"),
  W("크게 LIKE A", 1.0, 0.5, 0.5, "out", c="rgba(255,255,255,0.18)", sw=0.003, f="ko", nocase=True, kf=KF((0, {"x": 0.03}), (0.53, {"x": -0.03}))))
S(66.0, 66.633, "void", W("그거 말고", 0.17, 0.5, 0.5, "holo", f="ko", nocase=True, ins="assemble", d=0.08, kf=KF((0.2, {"x": 0}), (0.35, {"x": -0.33, "e": "out"}))),
  W("그거 말고", 0.17, 0.83, 0.5, "holo", f="ko", nocase=True, ins="assemble", at=0.2, d=0.08, kf=KF((0.2, {"x": 0}), (0.35, {"x": 0, "e": "out"}))),
  W("그거 말고", 0.17, 0.5, 0.5, "holo", f="ko", nocase=True, ins="assemble", at=0.35, d=0.08))
S(66.633, 67.0, "redflat", W("BYTE BYTE BYTE BYTE BYTE BYTE BYTE BYTE", 0.4, 0.5, 0.5, "#4a0010", ins="cut", out=O(0.08)),
  W("BYTE", 0.1, 0.5, 0.5, "white", ins="cut", at=0.08, kf=KF((0.08, {"s": 0.3}), (0.2, {"s": 1.0, "e": "out"}))))
S(67.0, 67.2, "redflat", *[W("BYTE    BYTE    BYTE    BYTE", 1.0, 0.5, y, "out", c="rgba(255,255,255,0.55)", sw=0.003, marq=0.6 * (1 if i % 2 else -1)) for i, y in enumerate((0.1, 0.3, 0.7, 0.9))],
  box(0.0, 0.46, 1.0, 0.08, "#08090c"), W("믿어봐 큰 만큼 크게", 0.5, 0.5, 0.5, "white", f="ko", nocase=True, ls=0.2, ins="scatter", d=0.15), cam=False)
S(67.2, 67.467, "void", box(0.0, 0.0, 1.0, 0.5, "red", kf=KF((0, {"y": 0}), (0.25, {"y": -0.35, "e": "out"}))), box(0.0, 0.5, 1.0, 0.5, "red", kf=KF((0, {"y": 0}), (0.25, {"y": 0.35, "e": "out"}))),
  IMG("sil-ponytail", 0.48, 0.5, 0.55, "holo", ins="cut", kf=KF((0, {"s": 1.25}), (0.27, {"s": 1.0}))), W("믿어봐 큰 만큼 크게", 0.5, 0.5, 0.5, "white", f="ko", nocase=True, ls=0.2), cam=False)
S(67.467, 69.0, "void", box(0.0, 0.995, 1.0, 0.005, "red"),
  {"k": "box", "x": 0.25, "y": -0.6, "w": 0.5, "h": 0.89, "fill": "holo", "r": "50%", "kf": KF((0.2, {"y": -0.35}), (0.6, {"y": 0, "e": "out"}))},
  RING(0.5, -0.1, 0.62, c="rgba(160,220,255,0.6)", s0=1.0, d=0.01, at=0.3, kf=KF((0.3, {"y": -0.3}), (0.7, {"y": 0, "e": "out"}))),
  IMG("sil-ponytail", 0.5, 0.66, 0.36, "holo", kf=KF((0, {"r": -2}), (1.53, {"r": 2}))), IMG("sil-ponytail", 0.5, 0.42, 0.5, DK, ins="fade", at=0.5, d=0.3),
  W("믿어봐 큰 만큼 크게", 0.35, 0.5, 0.5, "white", f="ko", nocase=True, ins="cut"))
S(69.0, 69.267, "void", W("믿어봐 큰 만큼 크게", 0.35, 0.5, 0.5, "white", f="ko", nocase=True, kf=KF((0, {"y": 0}), (0.25, {"y": -0.2, "e": "in"}))),
  W("어깨펴고", 0.9, 0.5, 0.52, "out", f="ko", nocase=True, c="rgba(255,255,255,0.6)", sw=0.003, kf=KF((0, {"x": 0.4}), (0.25, {"x": 0, "e": "out"}))))
S(69.267, 70.367, "void", {"k": "diag", "n": 4, "ang": 20, "op": 0.6},
  *[W("G", 0.32, x, 0.55, "out", "w", c="rgba(255,255,255,0.5)", sw=0.002, kf=KF((0, {"x": 0}), (1.1, {"x": -0.06}))) for x in (0.2, 0.62, 1.04)],
  W("어깨펴고", 0.2, 0.5, 0.5, "white", f="ko", nocase=True, ins="zoomdown", z=4.0, zls=0.1, d=0.3),
  box(0.42, 0.48, 0.16, 0.04, "holo", kf=KF((0, {"sx": 3}), (0.3, {"sx": 0.4, "e": "out"})), out=O(0.4)))
S(70.367, 71.2, "purple", *[W("백 퍼센트 덤비지 못해 죽여주잖아 백 퍼센트 덤비지 못해 죽여주잖아", 2.2, 0.5 - 0.15 * (i % 2), 0.25 + 0.25 * i, "holo", f="ko", nocase=True, marq=-0.35, ins="cut") for i in range(3)],
  cam={"s": [1.45, 1.0], "e": "out"})
S(71.2, 72.133, "purple", IMG("emb-blades", 0.35, 0.55, 1.6, "holo", op=0.25, rot=25),
  W("백 퍼센트 덤비지 못해 죽여주잖아", 0.5, 0.5, 0.5, "white", f="ko", nocase=True, ins="cut", echo={"n": 2, "dy": 0.07, "d": 0.2, "at": 0.0}),
  W("백 퍼센트 덤비지 못해 죽여주잖아", 0.5, 0.5, 0.43, "out", f="ko", nocase=True, c="rgba(255,255,255,0.25)"), W("백 퍼센트 덤비지 못해 죽여주잖아", 0.5, 0.5, 0.57, "out", f="ko", nocase=True, c="rgba(255,255,255,0.25)"))
S(72.133, 73.267, "purple", IMG("emb-blades", 0.42, 0.6, 2.4, "holo", glow=0.01, kf=KF((0, {"y": 0.35, "r": 12, "x": -0.05}), (0.5, {"y": 0.05, "r": 2, "x": 0.02}), (1.13, {"y": -0.1, "r": 28, "x": 0.08}))))
S(73.267, 73.833, "void", box(0.0, 0.0, 1.0, 0.45, "#2a0a58"), {"k": "diag", "n": 4, "ang": 25, "op": 0.6},
  IMG("emb-blades", 0.5, 0.55, 2.2, "holo", glow=0.01, kf=KF((0, {"r": 30, "y": -0.05}), (0.57, {"r": 40, "y": -0.2}))),
  W("나는", 1.0, 0.5, 0.55, "out", f="ko", nocase=True, c="rgba(255,255,255,0.5)", sw=0.003, ins="cut", at=0.2, kf=KF((0.2, {"s": 1.3}), (0.57, {"s": 1.0}))), cam=False)
S(73.833, 74.133, "redflat", W("나는", 0.72, 0.5, 0.5, "holo", f="ko", nocase=True, ins="cut", kf=KF((0, {"s": 1.08}), (0.3, {"s": 1.0}))))
S(74.133, 74.433, "redflat", W("나는", 0.72, 0.5, 0.5, "out", f="ko", nocase=True, c="rgba(255,255,255,0.45)", sw=0.0025),
  IMG("sil-stand", 0.62, 0.6, 1.4, "#7a0614", op=0.8, kf=KF((0, {"x": 0}), (0.3, {"x": 0.06}))),
  W("BOSS", 0.12, 0.5, 0.5, "white", "w", ins="zoomdown", z=1.0, zls=1.0, d=0.25))
S(74.433, 75.1, "redflat", W("간지", 0.55, 0.5, 0.5, "holo", f="ko", nocase=True, ins="assemble", d=0.12, bc="transparent", out=O(0.2, "fade", 0.1)),
  W("간지", 0.55, 0.5, 0.5, "out", f="ko", nocase=True, c="rgba(255,255,255,0.55)", sw=0.003, ins="cut", at=0.2),
  IMG("sil-stand", 0.3, 0.6, 1.4, "#0a0408", ins="cut", at=0.4, kf=KF((0.4, {"x": -0.2}), (0.67, {"x": 0.45, "e": "lin"}))),
  W("BOSS", 0.12, 0.5, 0.5, "white", "w", out=O(0.55, "chars", 0.1)))
S(75.1, 75.45, "redflat", W("SAUCE", 0.1, 0.5, 0.5, "white", ins="assemble", d=0.08), IMG("emb-crest", 0.15, 0.5, 0.12, "white", op=0.85), IMG("emb-crest", 0.85, 0.5, 0.12, "white", op=0.85))
S(75.45, 75.767, "void", IMG("sil-stand", 0.35, 0.6, 1.2, "holo", ins="cut", kf=KF((0, {"x": 0}), (0.3, {"x": 0.03}))),
  box(0.0, 0.0, 0.6, 0.45, "red", kf=KF((0, {"x": 0}), (0.12, {"x": -0.6, "e": "in"}))), box(0.6, 0.0, 0.4, 0.5, "red", kf=KF((0, {"y": 0}), (0.2, {"y": -0.5, "e": "in"}))),
  IMG("sil-stand", 0.7, 0.62, 0.95, "red", ins="cut", at=0.15, kf=KF((0.15, {"x": 0.2}), (0.3, {"x": 0, "e": "out"}))), IMG("emb-crest", 0.92, 0.25, 0.1, "white", op=0.8, out=O(0.2)))
S(75.767, 76.167, "void", IMG("sil-stand", 0.65, 0.62, 0.95, "red", out=O(0.2, "fade", 0.15)),
  W("원하면 줄게", 0.22, 0.25, 0.5, "white", f="ko", nocase=True, ins="assemble", d=0.25), T("IT", 0.03, 0.62, 0.5, "c", "white", ins="assemble", at=0.1, d=0.05))
S(76.167, 77.233, "void", W("원하면 줄게", 0.22, 0.2, 0.5, "white", f="ko", nocase=True),
  box(0.5, 0.22, 0.12, 0.55, "holo", kf=KF((0, {"x": 0.5}), (0.2, {"x": 0, "e": "out"}), (0.83, {"x": -0.1}))),
  box(0.66, 0.15, 0.2, 0.75, "holo", kf=KF((0.15, {"x": 0.5}), (0.35, {"x": 0, "e": "out"}), (0.83, {"x": -0.08}))),
  IMG("emb-star", 0.76, 0.6, 0.3, "white", op=0.6, ins="fade", at=0.35),
  box(0.0, 0.0, 1.0, 1.0, "holo", kf=KF((0.83, {"x": 1.0}), (1.03, {"x": 0, "e": "out"}))))

# ---- 77,23 - 88,9 s: verso sobre seda ----
def GH(t, w=0.62, ko=False, dur=1.0):
    """eco gigante en contorno que panea despacio y se apaga (verso sobre seda)"""
    return W(t, w, 0.5, 0.5, "dim", f="ko" if ko else "c", op=0.45, nocase=ko, ins="fade", d=0.3,
             kf=KF((0, {"x": 0.05}), (dur, {"x": -0.06, "e": "lin"})), out=O(max(0.2, dur - 0.35), "fade", 0.3))


S(77.233, 78.4, "holo", GH("DAMAGE", 0.75, dur=1.17), kara("I'M DOING DAMAGE", 77.233, [77.25, 77.5, 77.95], 0.25, out=O(0.95, "chars", 0.25)))
S(78.4, 80.0, "holo", GH("HOW I P", 0.85, dur=1.6), W("WENT JUST HOW I PLANNED IT", 0.5, 0.5, 0.5, "ink", ls=0.2, ins="scatter", d=0.35, out=O(1.38, "chars", 0.22)))
S(80.0, 83.0, "holo", GH("I WANT", 0.7, dur=3.0), kara("I DO WHAT I WANT WHEN I SAY", 80.0, [80.0, 80.1, 80.25, 80.4, 80.55, 80.75, 81.0, 81.15], 0.57, out=O(2.75, "chars", 0.25)))
S(83.0, 84.5, "holo", GH("끝내주", 0.85, ko=True, dur=1.5), W("모두 날 따라 해", 0.44, 0.5, 0.5, "ink", f="ko", nocase=True, ls=0.1, ins="scatter", d=0.6, out=O(1.28, "chars", 0.22)))
S(84.5, 86.0, "holo", GH("끝내주", 0.85, ko=True, dur=1.5), W("난 끝내주잖아", 0.42, 0.5, 0.5, "ink", f="ko", nocase=True, ls=0.1, ins="scatter", d=0.45, out=O(1.1, "chars", 0.3)),
  T("잖", 0.07, 0.5, 0.5, "ko", "ink", nocase=True, ins="cut", at=1.3, out=O(1.45)))
S(86.0, 86.5, "holo", lab("WE THE BADDEST", rows=(0.945,), xs=(0.1, 0.9)), SPARKS(6, 14, c="#ffffff"))
S(86.5, 88.9, "holo", GH("LIVE", 0.55, dur=2.4), kara("TO LIVE ON THE EDGE OF INSANE", 86.5, [86.5, 86.75, 87.0, 87.25, 87.5, 87.75, 88.2], 0.42, out=O(2.15, "chars", 0.25)))

# ---- 88 - 175 s (pendiente de la revisión v2) ----
# ---- 89 - 115 s: el segundo estribillo repite el primero (13 - 38,47 s) con 76,75 s de desfase (medido en los cortes) ----
REUSE(13.0, 38.467, 76.75, first_t0=89.333)
# ---- 115,2 - 161,2 s: puente, verso 2 y final (v3) ----
S(115.217, 115.6, "void", box(0.38, 0.27, 0.24, 0.24, "holo", kf=KF((0, {"s": 1.0}), (0.07, {"s": 4.5, "e": "step"}), (0.13, {"s": 2.3, "e": "step"}), (0.2, {"s": 1.4, "e": "step"}))),
  IMG("emb-blades", 0.5, 0.42, 0.14, "ink", shuf=["emb-crest", "emb-star", "emb-crown"], step=0.067, shufTo=0.38), cam=False)
S(115.6, 115.767, "void", SPARKS(5, 21))
S(115.767, 115.933, "ice", box(0.47, 0.25, 0.012, 0.5, "holo", rot=18, ins="wipeD", d=0.08), cam=False)
S(115.933, 116.267, "void", box(0.5, 0.3, 0.012, 0.4, "holo", rot=18, kf=KF((0, {"x": 0, "sy": 1}), (0.33, {"x": -0.45, "sy": 0.2, "e": "in"}))), cam=False)
S(116.267, 118.867, "void", W("SORRY", 0.52, 0.5, 0.55, "out", c="rgba(255,255,255,0.05)", fillseq={"at": 0.0, "d": 0.3, "f": "holo"}),
  W("FOR THE BAD NEWS SORRY I'M SO", 0.34, 0.5, 0.55, "white", ins="words", wt=[0.73, 0.87, 1.13, 1.4, 1.87, 2.27, 2.47]), cam={"s": [1.0, 1.04]})
S(118.867, 119.1, "ice", W("BAD", 0.17, 0.5, 0.5, "out", c="#2a2a3a", sw=0.0025, kf=KF((0, {"s": 1.2}), (0.23, {"s": 1.0}))), cam=False)
S(119.1, 121.367, "void", W("B", 0.14, 0.08, 0.5, "out", c="rgba(255,255,255,0.35)", sw=0.0025, kf=KF((0.15, {"s": 1.6}), (0.4, {"s": 1.0})), ins="cut", at=0.15),
  W("A", 0.12, 0.45, 0.45, "holo", ins="cut", at=0.25, out=O(0.6, "fade", 0.2)), W("A", 0.12, 0.45, 0.45, "out", c="rgba(255,255,255,0.35)", sw=0.0025, ins="cut", at=0.6),
  W("D", 0.1, 0.85, 0.82, "out", c="rgba(255,255,255,0.35)", sw=0.0025, ins="cut", at=0.3),
  box(-0.05, 0.47, 1.1, 0.05, "holo", rot=-1.5, ins="wipeL", d=0.35, kf=KF((0, {"y": 0}), (1.0, {"y": 0.02}), (2.0, {"y": -0.02})), out=O(2.05, "down", 0.2)),
  box(0.3, 0.488, 0.3, 0.014, "linear-gradient(90deg,#9fb4ff,#f4f6ff 70%,#cfd8ff)", kf=KF((0, {"x": -0.7}), (0.35, {"x": 0.42, "e": "out"}), (2.0, {"x": 0.5})), out=O(2.05, "down", 0.2)), box(0.26, 0.475, 0.04, 0.04, "transparent", stroke="#dfe6ff", r="50%", kf=KF((0, {"x": -0.7}), (0.35, {"x": 0.42, "e": "out"}), (2.0, {"x": 0.5})), out=O(2.05, "down", 0.2)),
  box(0.3, 0.0, 0.25, 1.0, "holo", kf=KF((0.95, {"x": 0.6}), (1.1, {"x": 0.0, "e": "out"}), (1.3, {"x": -0.4, "e": "in"})), out=O(1.3)),
  box(0.36, 0.33, 0.12, 0.12, "#08090c", kf=KF((0.95, {"x": 0.6}), (1.1, {"x": 0.0, "e": "out"}), (1.3, {"x": -0.4, "e": "in"})), out=O(1.3)),
  W("ONLY TOOK A MINUTE FOR ME", 0.3, 0.05, 0.5, "white", ax=0, ins="words", wt=[0.65, 1.1, 1.3, 1.4, 1.75, 1.85], kf=KF((1.9, {"y": 0}), (2.25, {"y": -0.38, "e": "out"}))), cam={"s": [1.0, 1.03]})
S(121.367, 122.0, "ice", IMG("sil-hair-flow", 0.55, 0.55, 1.2, "holo", ins="cut", kf=KF((0, {"x": 0.05}), (0.63, {"x": 0}))),
  W("ONLY TOOK A MINUTE FOR ME TO GET WHAT YOU HAD", 0.5, 0.06, 0.12, "ink", ax=0, ins="words", wt=[0, 0, 0, 0, 0, 0, 0.1, 0.3, 0.37, 0.52, 0.6]), cam=False)
S(122.0, 123.033, "void", *[W("WHAT YOU HAD WHAT YOU HAD WHAT YOU HAD", 1.6, 0.5, y, "out", c="rgba(255,255,255,0.3)", sw=0.0025, marq=0.25 * (1 if i % 2 else -1)) for i, y in enumerate((0.1, 0.3, 0.7, 0.9))],
  box(0.08, 0.3, 0.8, 0.32, "holo", ins="wipeL", d=0.1, kf=KF((0.47, {"x": 0, "y": 0}), (0.6, {"x": 0.05, "y": 0.08, "e": "step"}), (0.85, {"x": 0.1, "y": 0.12, "e": "step"}))),
  box(0.18, 0.4, 0.55, 0.22, "#08090c", kf=KF((0.47, {"x": 0}), (0.6, {"x": -0.04, "y": -0.06, "e": "step"}))),
  *[box(0.235 + 0.1 * i, 0.24, 0.012, 0.25, "linear-gradient(180deg,#f4f6ff,#9fb4ff)", kf=KF((0.07 + 0.06 * i, {"y": -0.6}), (0.22 + 0.06 * i, {"y": 0, "e": "out"}))) for i in range(5)],
  *[box(0.226 + 0.1 * i, 0.49, 0.03, 0.05, "transparent", stroke="#dfe6ff", r="50%", kf=KF((0.07 + 0.06 * i, {"y": -0.6}), (0.22 + 0.06 * i, {"y": 0, "e": "out"}))) for i in range(5)],
  W("ONLY TOOK A MINUTE FOR ME TO GET WHAT YOU HAD", 0.34, 0.47, 0.45, "white", out=O(0.4, "chars", 0.15)), cam=False)
S(123.033, 123.333, "void", box(0.06, 0.15, 0.88, 0.5, "holo", ins="cut"), cam=False)
GHO = [("FOR THE", 0.27, 0.5), ("BAD NEWS", 0.77, 0.5), ("KNOW IT", 1.27, 0.5), ("MAKES", 1.77, 0.3), ("YOU SAD", 2.07, 0.4)]
S(123.333, 125.8, "void", *[W(g, 0.9, 0.5, 0.5, "out", c="rgba(255,255,255,0.2)", sw=0.0025, ins="assemble", at=a, d=0.15, bc="transparent", out=O(a + dd - 0.05)) for g, a, dd in GHO],
  W("SORRY", 0.18, 0.5, 0.5, "holo", ins="cut", kf=KF((0, {"s": 1.9}), (0.25, {"s": 1.0, "e": "out"}))),
  W("FOR THE BAD NEWS KNOW IT MAKES YOU SAD", 0.16, 0.5, 0.5, "white", ins="words", wt=[0.0, 0.4, 0.75, 1.0, 1.4, 1.6, 1.8, 2.15, 2.3]),
  lab("SORRY", rows=(0.04,), xs=(0.06, 0.94)), lab("NOT SORRY", rows=(0.04, 0.96), xs=(0.5,), c="rgba(160,150,255,0.8)"))
S(125.8, 126.6, "void", *[W("I'LL", 0.08, x, y, "white", ins="assemble", at=0.03 * (i % 4), d=0.25, out=O(0.42 + 0.03 * ((i * 5) % 7))) for i, (x, y) in enumerate([(a, b) for b in (0.2, 0.5, 0.8) for a in (0.2, 0.5, 0.8)])],
  *[W("BE", 0.05, x, y, "white", ins="assemble", at=0.38 + 0.02 * (i % 4), d=0.1, out=O(0.6 + 0.02 * ((i * 3) % 7))) for i, (x, y) in enumerate([(a, b) for b in (0.2, 0.5, 0.8) for a in (0.2, 0.5, 0.8)])],
  W("HERE", 0.07, 0.5, 0.5, "white", ins="cut", at=0.66), VCOL("I'LL BE HERE", 0.5, -0.02, op=0.5))
S(126.6, 127.9, "void", W("FOR A MINUTE BABY", 0.33, 0.5, 0.5, "out", c="rgba(255,255,255,0.5)", sw=0.0025, out=O(0.13)),
  W("FOR A MINUTE BABY", 0.33, 0.5, 0.5, "out", "w", c="rgba(255,255,255,0.5)", sw=0.002, ins="cut", at=0.13),
  *[box(0.0, 0.0, 1.0, 1.0, "rgba(232,232,236,0.92)", ins="cut", at=a, to=a + 0.1) for a in (0.47, 0.67, 0.87)],
  lab("I'LL BE HERE", rows=(0.42, 0.58), xs=(0.25,)))
S(127.9, 128.25, "void", W("PACK YOUR BAGS    PACK YOUR BAGS    PACK YOUR BAGS    PACK YOUR BAGS", 1.4, 0.5, 0.42, "white", marq=0.5),
  W("PACK YOUR BAGS    PACK YOUR BAGS    PACK YOUR BAGS    PACK YOUR BAGS", 1.4, 0.5, 0.6, "white", marq=-0.5), cam=False)
S(128.25, 128.733, "void", W("PACK", 0.1, 0.38, 0.5, "holo", out=O(0.25, "chars", 0.1)), W("YOUR BAGS", 0.2, 0.55, 0.5, "holo"),
  box(0.3, 0.57, 0.24, 0.012, "holo", ins="wipeL", d=0.15))
S(128.733, 129.4, "void", W("BAGS", 0.1, 0.62, 0.5, "holo", kf=KF((0, {"x": 0}), (0.25, {"x": 0.3, "e": "in"})), out=O(0.25)),
  box(0.08, 0.56, 0.3, 0.06, "holo", kf=KF((0, {"x": 0}), (0.6, {"x": 0.1}))), box(0.2, 0.02, 0.06, 0.15, "holo", kf=KF((0.1, {"y": -0.2}), (0.3, {"y": 0}))),
  box(0.92, 0.25, 0.06, 0.55, "holo", kf=KF((0, {"x": 0.1}), (0.25, {"x": 0, "e": "out"}), (0.66, {"x": 0.05}))),
  W("BREAKING", 0.36, 0.6, 0.5, "out", c="rgba(255,255,255,0.05)", fillseq={"at": 0.25, "d": 0.3, "f": "pale"}), lab("BADDEST", rows=(0.055, 0.945), xs=(0.1, 0.9)))
S(129.4, 129.8, "void", W("BREAKING", 0.36, 0.5, 0.5, "pale", out=O(0.3, "breakup", 0.1, ls=0.25)), box(0.05, 0.5, 0.9, 0.006, "holo", ins="wipeL", d=0.1),
  lab("BADDEST", rows=(0.055, 0.945), xs=(0.1, 0.9)))
S(129.8, 131.2, "void", box(0.16, 0.3, 0.68, 0.46, "holo", kf=KF((0, {"sx": 0.6, "sy": 0.4}), (0.15, {"sx": 1, "sy": 1, "e": "out"}), (1.4, {"s": 1.03})), out=O(1.32, "glitch", 0.08)),
  IMG("emb-scales", 0.5, 0.55, 0.52, "white", op=0.55, kf=KF((0, {"s": 1.3}), (0.4, {"s": 1.0, "e": "out"}))),
  W("THE LAW", 0.15, 0.5, 0.54, "ink", ins="assemble", at=0.05, d=0.12, bc="#0e0c18"),
  W("IF I DON'T", 0.15, 0.5, 0.18, "white", ins="slide", at=0.45, kf=KF((0.45, {"y": -0.03}), (1.4, {"y": 0.0}))),
  W("GOT IT I TAKE", 0.17, 0.5, 0.86, "white", ins="slide", at=0.67), lab("BADDEST", rows=(0.065, 0.935), xs=(0.1, 0.9)))
S(131.2, 132.0, "holo", box(0.06, 0.12, 0.88, 0.76, "#0c0b14", kf=KF((0, {"s": 1.15}), (0.2, {"s": 1.0, "e": "out"}))),
  box(0.38, 0.27, 0.24, 0.43, "#3a2a7a", r="50%", kf=KF((0.35, {"s": 0.0}), (0.8, {"s": 2.4, "e": "in"}))),
  *[W("WHAT I", 0.07, x, 0.42, "out", c="rgba(255,255,255,0.4)", sw=0.002, fillseq={"at": 0.1 + 0.1 * i, "d": 0.05, "f": "white"}) for i, x in enumerate((0.29, 0.5, 0.71))],
  *[W("WANT", 0.1, x, 0.53, "out", c="rgba(255,255,255,0.5)", sw=0.0025, fillseq={"at": 0.2 + 0.08 * i, "d": 0.05, "f": "pale"}) for i, x in enumerate((0.29, 0.5, 0.71))],
  lab("BADDEST", rows=(0.06, 0.94), xs=(0.1, 0.9)))
S(132.0, 132.3, "void", *[RING(0.5, 0.5, r, c="rgba(190,220,255,0.9)", sw=0.06, s0=0.2, d=0.3, at=0.05 * i) for i, r in enumerate((0.25, 0.42, 0.6))], cam=False)
S(132.3, 133.533, "void", *[W("// CLAP / CLAP // CLAP / CLAP // CLAP / CLAP // CLAP / CLAP", 1.4, 0.5, 0.04 + 0.052 * i, "white" if i % 2 else "out", c="rgba(170,160,255,0.6)", sw=0.002, op=0.75, marq=0.12 * (1 if i % 2 else -1)) for i, _ in enumerate(range(19))],
  box(0.0, 0.08, 0.7, 0.82, "holo", ins="wipeR", at=0.15, d=0.12), media("hair", 0.0, 0.08, 0.7, 0.82, "duo", op=0.6, ins="cut", at=0.2, kf=KF((0.2, {"s": 1.0}), (1.23, {"s": 1.06}))),
  box(0.75, 0.38, 0.1, 0.06, "holo", ins="wipeL", at=0.4, d=0.1))
S(133.533, 134.233, "void", box(0.0, 0.08, 0.7, 0.82, "holo", out=O(0.0, "collapse", 0.1)),
  W("SOUND OF", 0.24, 0.5, 0.45, "holo", ins="assemble", at=0.1, d=0.45, hold=0.12, bc="#9fdcff"),
  *[box(0.1 + 0.25 * i, 0.43, 0.16, 0.06, "holo", kf=KF((0.05 * i, {"x": 0.3 if i % 2 else -0.3}), (0.2 + 0.05 * i, {"x": 0, "e": "out"})), out=O(0.45 + 0.03 * i)) for i in range(3)], cam=False)
S(134.233, 135.0, "void", W("SOUND OF", 0.24, 0.5, 0.25, "holo"),
  W("APPLAUSE", 0.56, 0.5, 0.48, "holo", ins="assemble", d=0.3, hold=0.12, bc="#b7a6ff", jit={"a": 0.018, "r": 3, "fps": 8, "from": 0.68, "to": 0.77}),
  lab("BADDEST", rows=(0.955,), xs=(0.1, 0.9)))
S(135.0, 135.467, "holo", *[W(t, 0.13, 0.5, 0.22 + 0.15 * i, "ink", ins="cut", at=0.07 * i) for i, t in enumerate(("YOU", "KNOW", "THAT", "I", "MEAN"))],
  VCOL("끝내주지", 0.04, -0.06, h=0.05, sp=0.08, n=12, c="rgba(20,20,40,0.5)"), box(0.72, 0.1, 0.2, 0.25, "transparent", stroke="rgba(20,20,40,0.35)"),
  lab("BADDEST", rows=(0.06, 0.94), xs=(0.9,)))
S(135.467, 136.2, "holo", W("EVERYTHING", 0.62, 0.5, 0.5, "ink", ins="assemble", d=0.2, hold=0.08, bc="#0e0c18", kf=KF((0, {"sx": 1.4}), (0.25, {"sx": 1.0, "e": "out"}))),
  W("THAT I", 0.16, 0.42, 0.7, "ink", ins="words", wt=[0.33, 0.52]), VCOL("끝내주지", 0.04, -0.06, h=0.05, sp=0.08, n=12, c="rgba(20,20,40,0.5)"))
S(136.2, 136.633, "void", W("SAY", 0.6, 0.5, 0.52, "holo", kf=KF((0, {"x": -0.08, "s": 1.25}), (0.2, {"x": 0, "s": 1.0, "e": "out"}))),
  W("EVERYTHING THAT I   EVERYTHING THAT I   EVERYTHING THAT I", 1.0, 0.5, 0.06, "white", op=0.5), W("EVERYTHING THAT I   EVERYTHING THAT I   EVERYTHING THAT I", 1.0, 0.5, 0.94, "white", op=0.5), cam=False)
S(136.633, 137.333, "void", W("SAY", 0.6, 0.5, 0.52, "holo", ins="cut", out=O(0.03, "breakup", 0.08, ls=0.4)),
  box(0.02, 0.12, 0.64, 0.68, "holo", ins="wipeR", at=0.05, d=0.1),
  *[VCOL("SEE ME", x, 0.3 * (1 if i % 2 else -1), h=0.03, sp=0.045, n=26, c="#ffffff", op=0.9) for i, x in enumerate((0.72, 0.8, 0.88, 0.96))],
  IMG("sil-spiky", 0.3, 0.5, 0.6, DK, flip=True, ins="cut", at=0.3, kf=KF((0.3, {"x": -0.3}), (0.7, {"x": 0.15, "e": "lin"}))), cam=False)
S(137.333, 138.4, "holo", *[W("OUT OF THE WAY", 0.36, 0.22, 0.04 + 0.098 * i, "ink" if i % 3 else "out", c="#1a1a30", sw=0.0025, ins="cut", at=0.02 * i) for i in range(11)],
  box(0.56, 0.08, 0.38, 0.84, "#0c0b14", ins="wipeU", d=0.12), IMG("sil-stand", 0.74, 0.52, 0.8, "white", ins="cut", at=0.1, kf=KF((0.1, {"s": 1.05}), (1.07, {"s": 1.0}))))
S(138.4, 139.867, "holo", IMG("emb-crown", 0.5, 0.48, 0.6, "holo", glow=0.01, kf=KF((0, {"s": 1.2, "r": -6}), (1.47, {"s": 1.0, "r": 4}))),
  W("SLAY", 0.18, 0.15, 0.6, "ink", ins="assemble", at=0.15, d=0.15, bc="#0e0c18", kf=KF((0.65, {"x": 0}), (0.95, {"x": 0.62, "e": "io"}))),
  W("SLAY", 0.18, 0.82, 0.6, "out", c="rgba(20,20,40,0.45)", sw=0.0025, kf=KF((0.65, {"x": 0}), (0.95, {"x": -0.62, "e": "io"}))),
  box(0.3, 0.52, 0.18, 0.12, "#0e0c18", ins="cut", at=0.6, to=0.7), lab("WE THE BADDEST", rows=(0.045, 0.94)))
S(139.867, 141.033, "void", *[W(g, 0.85, 0.5, 0.5, "out", c="rgba(255,255,255,0.18)", sw=0.0025, ins="assemble", at=a, d=0.15, bc="transparent", out=O(b)) for g, a, b in (("BACK", 0.0, 0.33), ("BETTER", 0.33, 0.6), ("READY", 0.6, 0.95))],
  kara("BACK AND I'M BETTER AND READY TO STAY", 139.867, [139.867, 139.95, 140.05, 140.2, 140.35, 140.47, 140.6, 140.9], 0.38, fill="pale", out=O(1.1, "fade", 0.06)),
  lab("WE THE BADDEST", rows=(0.945,), xs=(0.5,)))
S(141.033, 141.467, "void", W("STAY", 0.3, 0.5, 0.5, "holo", ins="stamp", jit={"a": 0.006, "r": 1, "fps": 10, "from": 0.1, "to": 0.4}))
# ---- 141,5 - 152,8 s: el segundo verso sobre seda repite el primero (77,23 - 88,9 s) con 64,23 s de desfase ----
REUSE(77.233, 88.9, 64.234)
S(152.833, 154.267, "void", W("끝", 1.0, 0.5, 0.5, "out", f="ko", nocase=True, c="rgba(255,255,255,0.25)", sw=0.003),
  box(0.2, 0.08, 0.62, 0.82, "holo", ins="wipeU", d=0.15, kf=KF((0.15, {"s": 1.0}), (1.43, {"s": 0.95}))),
  IMG("sil-stand", 0.5, 0.45, 0.85, "#040407", rot=180, ins="cut", kf=KF((0, {"y": 0}), (1.43, {"y": 0.03}))), lab("THE BADDEST", rows=(0.1,), xs=(0.3, 0.7)))
S(154.267, 154.5, "ice", W("SORRY", 0.62, 0.5, 0.5, "holo", ins="fade", d=0.15), cam=False)
S(154.5, 154.733, "holo", W("NOT", 0.22, 0.5, 0.5, "ink"), cam=False)
S(154.733, 155.967, "ice", W("SORRY", 0.62, 0.5, 0.5, "out", c="rgba(255,255,255,0.05)", fillseq={"at": 0.0, "d": 0.25, "f": "holo"}),
  W("NOT SORRY FOR BEING THE BEST", 0.2, 0.5, 0.54, "ink", ls=0.04, ins="words", wt=[0.0, 0.13, 0.27, 0.45, 0.7, 0.85]))
S(155.967, 156.867, "void", W("언제든지 내가 좀 해", 0.27, 0.5, 0.5, "pale", f="ko", nocase=True, ins="assemble", d=0.35, hold=0.05),
  W("언제든지 내가 좀 해", 0.27, 0.5, 0.58, "out", f="ko", nocase=True, c="rgba(255,255,255,0.3)", kf=KF((0, {"y": 0.04}), (0.35, {"y": -0.08, "e": "out"})), out=O(0.38)),
  lab("WE THE BADDEST", rows=(0.055, 0.945), xs=(0.1, 0.5, 0.9)), trans="blocks")
S(156.867, 158.133, "void", box(0.55, 0.0, 0.45, 1.0, "red", kf=KF((0, {"x": 0.3}), (0.12, {"x": 0, "e": "out"}), (0.9, {"x": 0.05}), (1.1, {"x": 0.35, "e": "in"}))),
  box(0.0, 0.08, 0.5, 0.42, "holo", kf=KF((0, {"x": -0.5}), (0.15, {"x": 0, "e": "out"}), (0.8, {"x": 0.25, "s": 1.6}))), media("glam", 0.0, 0.42, 0.45, 0.4, "duo", op=0.7, ins="cut", at=0.1),
  W("언제든지", 0.35, 0.65, 0.28, "ink", f="ko", nocase=True, ins="assemble", d=0.12, out=O(0.45, "fade", 0.1)), W("언제든지", 0.35, 0.65, 0.28, "holo", f="ko", nocase=True, ins="cut", at=0.45),
  shape("tag", 0.3, 0.65, 0.12, fill="gold", ins="pop", at=0.2), shape("tag", 0.35, 0.68, 0.12, fill="gold", ins="pop", at=0.26))
S(158.133, 159.133, "void", box(0.12, 0.08, 0.76, 0.8, "holo", ins="cut"), media("glam", 0.12, 0.08, 0.76, 0.8, "duo", op=0.7, kf=KF((0, {"s": 1.0}), (1.0, {"s": 1.04}))),
  box(0.22, 0.22, 0.56, 0.08, "white", ins="wipeL", d=0.1, at=0.05), W("THE GOLD ALL ON MY CHEST", 0.34, 0.5, 0.26, "ink", ins="assemble", at=0.1, d=0.2, bc="#0e0c18"),
  shape("tag", 0.45, 0.66, 0.16, fill="gold", ins="pop", at=0.1), shape("tag", 0.51, 0.69, 0.16, fill="gold", ins="pop", at=0.15), lab("WE THE BADDEST", rows=(0.055, 0.945), xs=(0.1, 0.5, 0.9)))
S(159.133, 159.933, "void", shape("chain", 0.5, 0.15, 1.2, asp=2.4, fill="gold", kf=KF((0, {"x": 0.04}), (0.8, {"x": -0.04}))), shape("chain", 0.5, 0.85, 1.2, asp=2.4, fill="gold", kf=KF((0, {"x": -0.04}), (0.8, {"x": 0.04}))),
  W("AT THE GOLD", 0.3, 0.5, 0.5, "white", ins="words", wt=[0.12, 0.4, 0.62]))
S(159.933, 160.133, "void", shape("chain", 0.5, 0.15, 1.2, asp=2.4, fill="gold"), shape("chain", 0.5, 0.85, 1.2, asp=2.4, fill="gold"), W("CALL", 0.3, 0.5, 0.5, "white", ins="cut"), cam=False)
S(160.133, 161.2, "void", W("FLEX", 0.86, 0.5, 0.5, "holo", ins="zoomdown", z=1.35, zls=0.05, d=0.2), *[W("끝내주지", 0.05, x, y, "white", f="ko", nocase=True, op=0.8) for x in (0.12, 0.5, 0.88) for y in (0.05, 0.95)])

TL.append({"t0": 161.2, "type": "outro", "bg": "void", "trans": "cut", "p": {}})

# ---------- transiciones automáticas por cambio de mundo ----------
CUTS = json.loads((pathlib.Path(__file__).parent / "cuts.json").read_text())
TL.sort(key=lambda x: x["t0"])
for x in TL:
    if 115.2 < x["t0"] < 161 and float(x["t0"]).is_integer():
        near = min(CUTS, key=lambda c: abs(c - x["t0"]))
        if abs(near - x["t0"]) <= 0.6: x["t0"] = near
TL.sort(key=lambda x: x["t0"])
for i, x in enumerate(TL):
    if i + 1 < len(TL): x["t1"] = TL[i + 1]["t0"]
    else: x.pop("t1", None)
for s in TL:
    if s["trans"] == "auto":
        s["trans"] = "cut"
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else pathlib.Path("timeline.json")
out.write_text(json.dumps(TL, ensure_ascii=False, indent=0))
print(len(TL), "escenas →", out)

#!/usr/bin/env python3
"""Genera timeline.json (escenas dirigidas, tiempos de la referencia). python timeline.py"""
import json, pathlib, random
OUT = pathlib.Path(__file__).with_name("timeline.json")
SC = []
def T(s, **k): return dict(k="text", s=s, **k)
def C(shape, **k): return dict(k="chalk", shape=shape, **k)
def R(**k): return dict(k="rect", **k)
def G(**k): return dict(k="glitch", **k)
def scene(name, t0, t1, bg, pieces, **k): SC.append(dict(name=name, t0=t0, t1=t1, bg=bg, pieces=pieces, **k))
def E(side, **k): return dict(side=side, **k)
D = 0.3  # oscurecido por defecto del metraje

# ---- 1 · Roll up / Deep ----
scene("s01", 0.0, 1.44, dict(clip="hoodie", off=1, dark=D, edges=[E("tr", d=.62, dy=.14, j=.5, at=.2), E("bottom", d=.065, j=.5, at=.2)]), [
  dict(k="rect", x=0, y=0, w=1, h=1, color="#cfcfcc", until=.22),
  T("Roll up 20,", id="l1", intro="artist", font="cd", color="red", w=.86, h=.2, y=.29, ls=.005, **{"in": "words"}, wt=[0, 0, 0, 0, 0, 0], gather=dict(dx=.05, dy=.11, at=0, d=.3), grow=dict(at=[.08, .2, .32, .44, .5, .55], d=.22, **{"from": .5}, ls0=.45), glow=True, ghost=dict(color="red", dx=-.03, op=.5, blur=2, delay=.5)),
  T("Deep", id="deep", intro="title", font="ar", color="white", w=.86, h=.38, y=.8, ls=0, **{"in": "spread"}, ls0=1.1, d=.3, at=.6, move=dict(at=.78, d=.22, to=dict(y=.63)), weight=dict(**{"from": 300}, to=900, delay=.35, d=.3), distress=False),
  C("crown", ref="deep", at=1.0, d=.25, sw=7, by=-.17, cx=.04),
  C("path", color="red", at=.95, d=.3, sw=10, paths=[[[.8, .49], [.8, .58]], [[.8, .49], [.9, .49]], [[.8, .49], [.97, .64]]])], type="intro")
scene("s02", 1.44, 3.08, dict(clip="breakdance", off=2, dark=D, edges=[E("tr", d=.2, dy=.15, until=1.15), E("bl", d=.3, dy=.28, color="black", at=1.15)]), [
  T("Low homie belt is", id="l2", font="cd", color="white", w=.84, h=.215, y=.235, ls=.01, **{"in": "words"}, wt=[.2] * 4, grow=dict(at=[.45, .65, .85, 1.05], d=.2, **{"from": .4}), at=.15),
  T("Snapped.", id="snap", font="ar", color="red", w=.67, h=.4, y=.72, ls=.04, **{"in": "fade"}, d=.15, at=1.05, until=1.45, weight=dict(**{"from": 200}, to=500, delay=.1, d=.3), distress=False, move=dict(at=1.45, d=.12, to=dict(y=.84))),
  C("ellipse", ref="snap", color="white", sw=14, at=1.2, d=.3, rx=.66, ry=.7, until=1.45),
  T("Snapped.", font="ar", color="red", w=.86, h=.42, y=.86, ls=.01, **{"in": "slam"}, from_=1.15, at=1.45, d=.12, distress=False)])
scene("s03", 3.08, 4.64, dict(clip="street", off=3, dark=D), [
  T("Like", id="like", font="ex", color="red", w=.62, h=.12, x=.55, y=.17, ls=.6, **{"in": "slam"}, at=.12, until=1.0, move=dict(at=.3, d=.25, to=dict(y=.5))),
  T("Whoa", id="brawl", font="ex", color="white", w=.4, h=.1, y=.76, ls=.4, **{"in": "spread"}, ls0=.9, d=.3, at=.18, until=1.0, move=dict(at=.3, d=.25, to=dict(y=.55))),
  C("arrowUp", box=dict(x=.045, y=.4, w=0, h=.5), at=.15, d=.3, sw=10, until=1.0), C("arrowDown", box=dict(x=.94, y=.05, w=0, h=.55), at=.2, d=.3, sw=10, until=1.0),
  C("arrowUp", box=dict(x=.88, y=.7, w=0, h=.2), at=.45, d=.25, sw=6, until=1.0), C("tri", box=dict(x=.5, y=.47), size=.12, at=.4, d=.25, sw=5, until=1.0),
  T("Put a hundred down", id="put", font="cd", color="red", w=.8, h=.2, y=.55, ls=.01, **{"in": "slam"}, at=1.07, glow=True),
  C("spiral", ref="put", color="white", sw=11, at=.95, d=.5, bw=.3, bx=.12, until=1.55)])

# ---- 2 · Put a hundred down / on the map ----
scene("s04", 4.64, 5.0, dict(clip="night", off=1, dark=D, edges=[E("top", d=.1, j=.5)]), [
  T("Put a hundred down", id="put", font="cd", color="red", w=.8, h=.2, y=.55, ls=.01, glow=True, ghost=dict(color="red", dx=.02, op=.4), out=dict(at=.28, fx="smear", d=.1)),
  C("spiral", ref="put", color="white", sw=11, at=-.1, d=.2, bw=.3, bx=.12, until=.3)])
scene("s05", 5.0, 5.4, dict(clip="tunnel", off=2, dark=D, edges=[E("tl", d=.45, dy=.2), E("br", d=.3, dy=.3)]), [
  T("Put a hundred down", id="put", font="cd", color="red", w=.62, h=.07, x=.5, y=.6, ls=.01, glow=True, distress=True),
  T("And", font="cd", color="white", w=.1, h=.07, x=.08, ax=0, y=.7, **{"in": "cut"}, at=.15)])
scene("s06", 5.4, 7.0, dict(light=True, edges=[E("top", d=.12, j=.6, color="black"), E("br", d=.5, dy=.5, at=.8, color="black")]), [
  T("Put a hundred down", id="put", font="ex", color="red", w=.86, h=.11, y=.46, ls=.08, glow=True),
  C("strike", ref="put", color="white", sw=8, at=.1, d=.2, bw=.25, bx=.23),
  T("And put us on the map.", id="map", font="cd", color="white", w=.72, h=.11, y=.6, ls=.01, **{"in": "words"}, step=.1, at=.2),
  C("underline", ref="map", color="white", sw=5, at=.95, d=.3, bw=.2, bx=.6), C("swoosh", ref="map", color="white", sw=5, at=1.05, d=.3),
  G(at=1.3, d=.25, y0=.3, y1=.7, n=6)])
scene("s07", 7.0, 7.8, dict(clip="hoodie", off=4, dark=D), [
  T("Like", id="like", font="cd", color="red", w=.4, h=.2, y=.5, ls=.01, **{"in": "slam"}, at=.0, move=dict(at=.45, d=.15, to=dict(y=.3)), scale=dict(**{"from": 1}, to=1.9, at=.45, d=.15)),
  C("brush", ref="like", color="white", sw=14, at=.05, d=.18, dy=.5, until=.55),
  T("Whoa!", id="wow", font="cd", color="white", w=.6, h=.45, y=.78, ls=.01, **{"in": "rise"}, dy=.5, at=.45, d=.2)])
# ---- 3 · Y'all ain't even know ----
scene("s08", 7.8, 11.4, dict(clip="night", off=0, dark=.15, fog=.8, edges=[E("top", d=.07, j=.6, at=1.6), E("bottom", d=.12, j=.6, at=2.4)]), [
  T("Y'all ain't even know", id="a", font="cd", color="white", w=.6, h=.1, y=.5, ls=.01, **{"in": "words"}, step=.17, at=.4, distress=True, move=dict(at=1.6, d=.2, to=dict(y=.3))),
  C("prev", box=dict(x=.08, y=.5), size=.05, at=.4, d=.25, sw=5, until=2.3), C("play", box=dict(x=.9, y=.5), size=.08, at=.45, d=.25, sw=5, until=2.3),
  C("bolt", color="red", box=dict(x=.62, y=.35, w=0, h=.2), at=1.2, d=.25, sw=11),
  T("The place I had", id="b", font="cd", color="red", w=.6, h=.09, y=.52, ls=.01, **{"in": "slam"}, at=1.4, ghost=dict(color="red", dx=.03, op=.5)),
  T("to go,", id="c", font="cd", color="white", w=.5, h=.16, y=.75, **{"in": "rise"}, at=2.3, d=.2),
  C("bolt", color="white", box=dict(x=.75, y=.55, w=0, h=.3), at=1.8, d=.25, sw=11),
  G(at=3.2, d=.35, y0=.1, y1=.8, n=9)])
# ---- 4 · In my cell ----
scene("s09", 11.4, 14.0, dict(clip="street", off=1, dark=.1, edges=[E("bottom", d=.07, j=.6, until=1.5), E("top", d=.3, j=.4, until=.5, color="paper")]), [
  T("In my cell lost a part of me but", id="a", font="cd", color="red", w=.9, h=.16, y=.2, ls=.005, **{"in": "words"}, step=.08, at=.25, glow=True, ghost=dict(color="red", dx=.02, op=.5)),
  C("line", color="white", sw=8, at=.5, d=.3, x0=.04, y0=.06, x1=.96, y1=.06, until=1.5),
  T("Now I won't lose control.", id="b", font="cd", color="white", w=.8, h=.13, x=.07, ax=0, y=.36, **{"in": "words"}, step=.2, at=1.1),
  C("frame", box=dict(x=.04, y=.08, w=.92, h=.38), pad=0, at=1.2, d=.7, sw=12)])
# ---- 5 · Foot on the gas ----
scene("s10", 14.0, 16.3, dict(clip="night", off=2, dark=.1, fog=1.2), [
  T("Like", font="ex", color="white", w=.9, h=.5, y=.5, ls=0, **{"in": "slam"}, at=.2, until=1.2, from_=1.4, move=dict(at=.8, d=.12, to=dict(y=.02))),
  T("Foot", font="ex", color="red", w=.62, h=.3, y=.5, ls=.12, **{"in": "slam"}, at=.8, until=1.6, move=dict(at=1.2, d=.12, to=dict(y=.08))),
  T("Is on the", font="ex", color="white", w=.92, h=.24, y=.5, ls=.08, **{"in": "spread"}, ls0=.5, d=.18, at=1.2, move=dict(at=1.6, d=.12, to=dict(y=.95)), ghost=dict(color="red", dx=.04, op=.6)),
  T("Gas,", id="gas", font="cd", color="red", w=.5, h=.6, y=.5, ls=.08, **{"in": "slam"}, at=1.6, ghost=dict(color="red", dx=.02, op=.5)),
  C("bolt", box=dict(x=.12, y=.5, w=0, h=.12), at=1.7, d=.2, sw=6), C("bolt", box=dict(x=.84, y=.5, w=0, h=.12), at=1.75, d=.2, sw=6),
  G(at=1.95, d=.3, n=7)])
scene("s11", 16.3, 17.0, dict(clip="night", off=3, dark=.1), [
  dict(k="stack", s="My whole crew", n=5, y=.5, dy=.12, font="ex", colors=["white", "white", "red", "white", "white"], w=.86, h=.1, ls=.04, step=.04, scales=[.9, .95, 1, .95, .9], at=.1, ghost=dict(color="red", dx=.02, op=.5))])
# ---- 6 · A hell risk ----
scene("s12", 17.0, 18.6, dict(clip="night", off=4, dark=.1), [
  T("A hell risk.", id="r", font="cd", color="red", w=.62, h=.12, y=.5, ls=.005, **{"in": "slam"}, at=.2, glow=True, ghost=dict(color="red", dx=-.02, op=.5)),
  C("cross", box=dict(x=.02, y=.6, w=.25, h=.25), color="white", sw=5, at=.5, d=.2, n=6),
  C("cross", box=dict(x=.75, y=.08, w=.22, h=.2), color="white", sw=5, at=.7, d=.2, n=6)])
# ---- 7 · I want money / cash / want it all ----
scene("s13", 18.6, 19.8, dict(clip="night", off=5, dark=.1), [
  T("I want money,", font="th", color="white", w=.72, h=.15, y=.5, ls=.04, **{"in": "words"}, step=.1, at=.05, out=dict(at=.75, fx="smear", d=.15), fw=500),
  T("Cash,", id="cash", font="cd", color="red", w=.3, h=.12, y=.43, **{"in": "slam"}, at=.95, glow=True),
  C("ellipse", ref="cash", color="white", sw=12, at=1.05, d=.3, rx=.7, ry=.85)])
scene("s14", 19.8, 20.9, dict(clip="night", off=6, dark=.1), [
  T("Want it all,", id="w", font="cd", color="white", w=.62, h=.36, x=.45, y=.32, ls=.01, **{"in": "words"}, step=.2, at=.2, out=dict(at=.9, fx="smear", d=.15)),
  C("ellipse", ref="w", color="white", sw=12, at=.0, d=.3, bw=.4, rx=.6, ry=.6, turns=.55, a0=-1.2, until=.6)])
scene("s15", 20.9, 22.3, dict(clip="hoodie", off=1, dark=.1), [
  T("Selfish.", id="s", font="cd", color="red", w=.86, h=.38, y=.65, ls=.01, **{"in": "slam"}, at=.1, glow=True, ghost=dict(color="red", dx=.03, op=.55)),
  C("underline", ref="s", color="white", sw=14, at=.7, d=.4, dy=1.05)])
# ---- 8 · Never gave ----
scene("s16", 22.3, 23.0, dict(clip="night", off=7, dark=.15), [
  T("Never gave", id="n", font="cd", color="white", w=.72, h=.5, y=.6, **{"in": "rise"}, at=.05, d=.2),
  C("arrowUp", box=dict(x=.07, y=.5, w=0, h=.2), at=.1, d=.2, sw=6), C("arrowUp", box=dict(x=.85, y=.58, w=0, h=.2), at=.2, d=.2, sw=6)])
scene("s17", 23.0, 23.9, dict(clip="night", off=2, dark=.65, fog=.3), [
  dict(k="grid", s="F×K", cols=2, rows=6, w=.5, h=.92, x0=.27, y0=.04, font="ex", colors=["white", "white"], fillW=.75, fillH=.42, ls=.2, step=.03, at=.15, stagger=dict(dir="row"))])
# ---- 9 · I'm better / cannot help this / caught up ----
scene("s18", 23.9, 26.5, dict(clip="tunnel", off=3, dark=1.2, vig=.9, fog=.15), [
  T("I'm", font="ex", color="white", w=.3, h=.16, x=.03, ax=0, y=.2, **{"in": "slam"}, at=.0),
  T("Better", font="th", color="red", w=.18, h=.12, x=.62, ax=0, y=.2, at=.3, fw=400),
  T("Cannot help this", id="h", font="ex", color="white", w=.66, h=.13, x=.3, ax=0, y=.4, ls=.06, **{"in": "slam"}, at=.6, ghost=dict(color="white", dx=.03, op=.35)),
  T("Caught up", font="cd", color="white", w=.3, h=.18, x=.02, ax=0, y=.62, **{"in": "slam"}, at=1.1, op=.75, ghost=dict(color="white", dx=.02, op=.4)),
  T("in my ways", font="th", color="red", w=.5, h=.18, x=.42, ax=0, y=.63, **{"in": "slam"}, at=1.3, fw=500, glow=True),
  G(at=2.3, d=.25, n=6, redP=.2)])
scene("s19", 26.5, 28.0, dict(clip="hoodie", off=0, dark=.1, edges=[E("tl", d=.5, dy=.7, j=.4), E("br", d=.45, dy=.35, j=.4)]), [
  T("Counting days till I'm fit", id="k", font="cd", color="white", w=.52, h=.07, y=.5, ls=.01, **{"in": "wipe"}, d=.5, at=.2),
  C("arrowR", ref="k", color="red", sw=7, at=.1, d=.3, len=.1),
  C("ellipse", ref="k", color="red", sw=8, at=.9, d=.3, bw=.25, bx=.6, rx=.65, ry=.7),
  G(at=1.3, d=.2, y0=.3, y1=.7, n=4)])
# ---- 10 · instrumental: garabatos ----
scene("s20", 28.0, 28.35, dict(clip="street", off=1, dark=.3, edges=[E("left", d=.18, j=.6, at=.12)]), [C("crown", box=dict(x=.35, y=.38, w=.1, h=.05), at=.0, d=.2, sw=6)])
scene("s21", 28.35, 28.75, dict(clip="night", off=1, dark=.55), [C("xmark", box=dict(x=.5, y=.42), size=.05, at=.0, d=.2, sw=9)])
scene("s22", 28.75, 29.2, dict(clip="night", off=2, dark=.55), [C("face", box=dict(x=.5, y=.55), size=.1, at=.0, d=.3, sw=5), C("line", x0=.5, y0=0, x1=.5, y1=.4, at=0, d=.25, sw=6)])
scene("s23", 29.2, 29.85, dict(clip="hoodie", off=3, dark=.1, edges=[E("top", d=.1, j=.6, at=.4)]), [C("eyes", box=dict(x=.5, y=.5), size=.06, at=.0, d=.2, sw=3)])
# ---- Segunda mitad: ecos ----
scene("s24", 29.85, 30.95, dict(clip="breakdance", off=0, dark=.2, edges=[E("bottom", d=.15, j=.6, at=.5)]), [
  T("Roll up 20,", id="a", font="ex", color="red", w=.5, h=.13, y=.5, ls=.1, **{"in": "slam"}, at=.15, out=dict(at=.4, fx="cut")),
  T("Deep low homie", font="cd", color="white", w=.55, h=.13, y=.5, **{"in": "words"}, step=.12, at=.4),
  T("Belt is snapped", font="cd", color="red", w=.4, h=.05, y=.6, **{"in": "fade"}, at=.7, d=.2, glow=True),
  C("tri", box=dict(x=.1, y=.15), size=.05, at=.3, sw=4), C("next", box=dict(x=.92, y=.53), size=.04, at=.4, sw=4), C("prev", box=dict(x=.13, y=.9), size=.03, at=.5, sw=4)])
scene("s25", 30.95, 32.0, dict(light=True), [
  dict(k="paper", x=.0, y=.28, w=1, h=.34, color="black", at=0, j=.05),
  T("Deep low homie", font="cd", color="white", w=.5, h=.11, y=.39, **{"in": "words"}, step=.08, at=.1),
  T("Belt is snapped", font="ex", color="red", w=.56, h=.07, y=.5, ls=.06, **{"in": "fade"}, d=.15, at=.2),
  T("Belt is", font="cd", color="red", w=.5, h=.14, y=.45, **{"in": "slam"}, at=.78, until=.78)])
scene("s26", 32.0, 33.1, dict(light=True), [
  dict(k="paper", x=0, y=.25, w=1, h=.4, color="black", j=.05),
  T("Belt is snapped", font="ex", color="white", w=.9, h=.25, y=.45, ls=.04, **{"in": "slam"}, at=.2, until=.6, ghost=dict(color="red", dx=.04, op=.6)),
  C("slash", box=dict(x=.5, y=.4, w=.1, h=.4), color="red", sw=26, at=.2, d=.15, until=.6, ang=-65),
  T("Like", font="cd", color="red", w=.14, h=.1, y=.45, **{"in": "cut"}, at=.62), C("slash", box=dict(x=.5, y=.45, w=.1, h=.4), color="white", sw=26, at=.62, d=.15, ang=-62)])
scene("s27", 33.1, 34.0, dict(clip="night", off=5, dark=.4), [
  T("Whoa", font="ex", color="red", w=.9, h=.55, y=.5, ls=0, **{"in": "slam"}, at=.15, scale=dict(**{"from": 1}, to=1.18, at=.5, d=.3), glow=True)])
scene("s28", 34.0, 34.8, dict(clip="street", off=2, dark=.5, edges=[E("left", d=.28, j=.5)]), [
  dict(k="stack", s="Put a hundred down", n=3, y=.5, dy=.22, x=.55, font="cd", colors=["white"], w=.56, h=.2, step=.15, at=.2, scales=[1, 1, 1])])
scene("s29", 34.8, 36.7, dict(light=True, edges=[E("top", d=.2, j=.5, color="black"), E("bottom", d=.1, j=.5, color="black")]), [
  T("And", font="ex", color="white", w=.42, h=.3, x=.3, y=.36, ls=0, **{"in": "slam"}, at=.5, from_=1.3),
  T("Put us on", font="ex", color="red", w=.78, h=.14, y=.56, ls=.05, **{"in": "slam"}, at=.9),
  T("The map", font="ex", color="white", w=.85, h=.09, y=.74, ls=.35, **{"in": "spread"}, ls0=.8, at=1.2, d=.3),
  G(at=1.65, d=.25, n=5)])
scene("s30", 36.7, 37.55, dict(clip="crowd", off=1, dark=.3), [
  T("Like", font="cd", color="red", w=.62, h=.95, x=.35, y=.5, **{"in": "slam"}, at=.1, glow=True),
  T("Whoa!", font="cd", color="white", w=.5, h=.9, x=.74, y=.5, **{"in": "slam"}, at=.5)])
scene("s31", 37.55, 38.45, dict(clip="street", off=3, dark=.4), [
  T("Y'all", font="cd", color="red", w=.2, h=.12, x=.02, ax=0, y=.5, **{"in": "slam"}, at=.0),
  T("Ain't even know", font="cd", color="white", w=.55, h=.1, x=.96, ax=1, y=.5, **{"in": "slam"}, at=.2),
  G(at=.65, d=.25, n=5)])
scene("s32", 38.45, 40.45, dict(clip="breakdance", off=4, dark=.35), [
  dict(k="stack", s="The", n=4, y=.5, dy=.2, x=.03, ax=0, font="ex", colors=["white"], w=.25, h=.17, step=.04, at=.1),
  dict(k="stack", s="Place I had to go", n=4, y=.5, dy=.2, x=.97, ax=1, font="th", fw=500, colors=["red"], w=.6, h=.17, step=.04, at=.1),
  G(at=1.0, d=.3, n=7), G(at=1.9, d=.1, n=5)])
scene("s33", 40.45, 41.2, dict(clip="tunnel", off=5, dark=.3), [
  T("Be my soul,", font="cd", color="red", w=.86, h=.45, y=.62, **{"in": "slam"}, at=.1, glow=True)])
scene("s34", 41.2, 42.1, dict(clip="street", off=5, dark=.2), [
  T("In my cell", font="cd", color="white", w=.95, h=.62, y=.55, **{"in": "slam"}, at=.0, until=.5), T("Lost", font="cd", color="red", w=.55, h=.7, y=.55, **{"in": "slam"}, at=.5, glow=True)])
scene("s35", 42.1, 42.8, dict(clip="tunnel", off=6, dark=.3), [
  T("A part of me but", font="cd", color="white", w=.98, h=.55, y=.45, **{"in": "slam"}, at=.0, until=.4), G(at=.4, d=.3, n=4)])
scene("s36", 42.8, 44.2, dict(clip="tunnel", off=7, dark=.3), [
  T("Now I won't lose", font="cd", color="red", w=.92, h=.1, y=.4, ls=.1, at=.0, op=.8, glow=True),
  T("Control", font="th", color="white", w=.66, h=.2, y=.58, ls=.2, **{"in": "slam"}, at=.1, ghost=dict(color="white", dx=.02, op=.3), fw=400)])
scene("s37", 44.2, 45.0, dict(clip="tunnel", off=8, dark=.3), [
  *[T(ch, font="cd", color="red", w=.06, h=.11, x=.5, y=.2 + i * .19, **{"in": "slam"}, at=.05 + i * .06, until=.45) for i, ch in enumerate("LIKE")],
  *[dict(k="grid", s=ch, cols=6, rows=1, w=.9, h=.21, x0=.05, y0=.08 + i * .21, font="cd", colors=["red", "red", "white"] if i % 2 else ["white", "red", "red"], fillW=.45, fillH=.8, step=.012, at=.45 + i * .03) for i, ch in enumerate("LIKE")]])
scene("s38", 45.0, 47.4, dict(clip="breakdance", off=6, dark=.15, edges=[E("bottom", d=.12, at=1.8)]), [
  T("Roll", font="ex", color="white", w=.96, h=.1, y=.55, ls=1.6, **{"in": "spread"}, ls0=2.2, d=.3, at=.0, until=.6),
  T("Roll up 20,", font="ex", color="red", w=.62, h=.2, x=.5, y=.36, **{"in": "slam"}, at=.75, glow=True),
  T("Deep low", font="cd", color="white", w=.5, h=.16, x=.52, y=.56, **{"in": "slam"}, at=1.0),
  T("Belt is snapped", font="cd", color="red", w=.48, h=.12, x=.52, y=.7, **{"in": "slam"}, at=1.4)])
scene("s39", 47.4, 48.3, dict(clip="crowd", off=2, dark=.6), [
  T("Like", font="ex", color="red", w=.32, h=.14, y=.55, **{"in": "slam"}, at=.15), G(at=.45, d=.3, n=8, redP=.9)])
scene("s40", 48.3, 49.0, dict(clip="night", off=4, dark=.6, edges=[E("bottom", d=.3, j=.5, at=.3)]), [
  dict(k="stack", s="Whoa", n=5, y=.5, dy=.15, font="ex", colors=["white"], w=.5, h=.12, ls=.5, step=.04, at=0, scales=[1, .9, .6, .9, 1], fitScale=True)])
scene("s41", 49.0, 49.6, dict(light=True), [T("Put a hundred", font="cd", color="red", w=.5, h=.14, y=.5, **{"in": "slam"}, at=.15, glow=True)])
scene("s42", 49.6, 51.4, dict(clip="crowd", off=3, dark=.55, edges=[E("bottom", d=.2, j=.5, at=1.4)]), [
  T("Put a hundred down", font="cd", color="red", w=.6, h=.08, y=.14, glow=True),
  T("And put us", font="cd", color="white", w=.86, h=.34, y=.45, **{"in": "slam"}, at=.2),
  T("on the map.", font="cd", color="red", w=.6, h=.08, y=.78, **{"in": "slam"}, at=.7), G(at=1.3, d=.3, n=6)])
scene("s43", 51.4, 52.6, dict(light=True), [
  T("Like", font="ex", color="red", w=.22, h=.14, x=.5, y=.3, **{"in": "slam"}, at=.5), T("Whoa!", font="cd", color="white", w=.2, h=.32, x=.5, y=.55, **{"in": "slam"}, at=.7),
  C("cross", box=dict(x=.5, y=.4, w=.4, h=.3), color="white", sw=3, at=.6, d=.2, n=9)])
scene("s44", 52.6, 54.0, dict(clip="crowd", off=5, dark=.35, edges=[E("top", d=.15, j=.5), E("bottom", d=.15, j=.5)]), [
  T("Y'all ain't", font="cd", color="red", w=.55, h=.25, y=.4, **{"in": "slam"}, at=.2), T("even", font="cd", color="white", w=.16, h=.22, x=.2, y=.65, **{"in": "slam"}, at=.5), T("know", font="cd", color="red", w=.26, h=.18, x=.55, y=.65, **{"in": "slam"}, at=.6)])
scene("s45", 54.0, 55.1, dict(clip="crowd", off=1, dark=.4), [
  dict(k="stack", s="The place I had", n=3, y=.5, dy=.36, font="cd", colors=["white", "red", "white"], w=.98, h=.46, step=.1, at=.0, scales=[1, 1.15, 1], fitScale=True)])
scene("s46", 55.1, 56.0, dict(clip="tunnel", off=9, dark=.2, edges=[E("tl", d=.35, dy=.4), E("br", d=.3, dy=.3)]), [
  T("To go,", font="ex", color="white", w=.6, h=.26, y=.32, **{"in": "slam"}, at=.15), T("Be my soul,", font="ex", color="red", w=.82, h=.26, y=.64, **{"in": "slam"}, at=.5, glow=True)])
scene("s47", 56.0, 56.6, dict(clip="street", off=6, dark=.2), [T("In my cell", font="ex", color="red", w=.9, h=.26, y=.5, **{"in": "slam"}, at=.0, glow=True), G(at=.35, d=.2, n=4)])
scene("s48", 56.6, 57.6, dict(clip="street", off=7, dark=.2), [
  dict(k="grid", s="Lost a part of", cols=3, rows=3, w=1.1, h=.84, x0=-.05, y0=.08, font="ar", colors=["red"], fillW=.95, fillH=.55, step=.05, at=.0, ls=.02, drift=-.04)])
scene("s49", 57.6, 59.4, dict(clip="street", off=8, dark=.3), [
  dict(k="grid", s="But now I won't lose", cols=3, rows=3, w=1.1, h=.86, x0=-.05, y0=.07, font="cd", colors=["white"], fillW=.96, fillH=.6, step=.05, at=.0, drift=.04), G(at=1.3, d=.4, n=8, redP=0)])
scene("s50", 59.4, 61.4, dict(clip="street", off=9, dark=.35, edges=[E("bottom", d=.1)]), [
  T("Control", font="ex", color="red", w=.8, h=.32, y=.45, **{"in": "slam"}, at=.0, glow=True, op=.92, ghost=dict(color="red", dx=.03, op=.45)), G(at=1.2, d=.3, n=5)])
# ---- recap + marca ----
rng = random.Random(5)
words = ["Roll up 20", "Deep low", "Belt is snapped", "Like", "Whoa!", "Put a hundred down", "Do not", "On the map", "Y'all ain't even know", "The place I had to go", "To go", "Be my soul", "In my cell", "Lost a part of me", "But now I won't lose control", "Foot is on the gas", "My whole crew", "A hell risk", "I want money", "Cash", "Want it all", "Selfish", "Never gave", "I'm better", "Cannot help this", "Caught up in my ways", "Counting days", "F×K", "Brawl"]
rc = []
for i, w in enumerate(words * 2):
    col = rng.choice(["white", "white", "red", "red"]); big = rng.random() < .15
    rc.append(T(w, font="cd", color=col, w=rng.uniform(.06, .16) * (2 if big else 1), h=.05 * (2 if big else 1), x=rng.uniform(.06, .94), y=rng.uniform(.06, .94), at=i * .02, out=dict(at=1.0 + rng.uniform(0, 1.4), fx="fade", d=.2), distress=False, ls=.02, op=.9))
for i in range(14):
    rc.append(C(rng.choice(["xmark", "plus", "ring", "tri", "star", "next"]), box=dict(x=rng.uniform(.05, .95), y=rng.uniform(.05, .95)), size=.025, at=.3 + i * .05, d=.2, sw=3, until=1.2 + rng.uniform(0, 1.2)))
scene("s51", 61.4, 64.0, dict(clip="street", off=10, dark=.25, fog=.8), rc)
scene("s52", 64.0, 68.2, dict(paper=True), [
  T("NodeMotion", id="logo", font="cd", color="red", w=.14, h=.06, y=.55, **{"in": "slam"}, at=.2, until=2.45, distress=False),
  C("crown", ref="logo", color="white", sw=4, at=.35, d=.3, up=.05, w=.04, h=.035, cx=.4), C("underline", ref="logo", color="white", sw=4, at=.55, d=.3, until=2.45)], type="outro")

# ---- cierres v1 / v2: textos de config.outro (title, sub, feats); cada uno parte de una toma real ----
# Como en la referencia, el cierre SE CIERRA: las piezas se van una a una (la tiza se borra trazo a
# trazo, la letra se corre y desaparece) y el último tramo queda solo el fondo. Tiempos negativos =
# segundos antes del final de la escena, así sirve para cualquier duración de cierre.
OUTROS = {
 # v1 «Marca gigante»: palabra roja enorme sobre metraje (toma de 59,4-61,4 s) que se desarma
 "v1": dict(name="outro-v1", bg=dict(clip="street", off=9, dark=.25, cuts=False, edges=[E("bottom", d=.1, j=.5)]), pieces=[
   T("Gracias", id="ot", outro="title", font="ex", color="red", w=.84, h=.32, y=.42, **{"in": "slam"}, from_=1.5, at=.1, d=.22, glow=True, op=.94,
     ghost=dict(color="red", dx=.03, op=.45, delay=.1), out=dict(at=-1.55, fx="smear", d=.16, dx=.08)),
   C("crown", ref="ot", color="white", sw=7, at=.75, d=.3, up=.06, w=.07, h=.06, cx=.08, erase=dict(at=-2.05, d=.22)),
   C("underline", ref="ot", color="white", sw=12, at=.85, d=.35, dy=1.02, erase=dict(at=-1.85, d=.25)),
   T("por ver", outro="sub", font="cd", color="white", w=.5, h=.1, y=.66, **{"in": "words"}, step=.12, at=.6, out=dict(at=-2.25, fx="smear", d=.14)),
   T("Suscríbete · NodeMotion", outro="feats", font="th", color="white", w=.5, h=.05, y=.8, ls=.2, **{"in": "spread"}, ls0=.6, d=.35, at=1.1, fw=400,
     out=dict(at=-2.45, fx="fade", d=.15)),
   G(at=1.7, d=.2, n=5, redP=.5), G(at=-1.62, d=.14, n=4, redP=.6)]),
 # v2 «Tarjeta de papel»: tarjeta final de la referencia (64-68 s): marca roja con corona y subrayado;
 # la corona y el subrayado se borran, la marca se va con un barrido y queda el papel vacío
 "v2": dict(name="outro-v2", bg=dict(paper=True), pieces=[
   T("Gracias", id="ot", outro="title", font="cd", color="red", w=.32, h=.12, y=.5, **{"in": "slam"}, at=.25, d=.2, distress=False, out=dict(at=-1.4, fx="smear", d=.12, dx=.03)),
   C("crown", ref="ot", color="white", sw=6, at=.45, d=.3, up=.07, w=.06, h=.05, cx=.45, erase=dict(at=-2.3, d=.3, step=.08)),
   C("underline", ref="ot", color="white", sw=8, at=.65, d=.3, erase=dict(at=-1.95, d=.28)),
   T("por ver", outro="sub", font="th", color="ink", w=.28, h=.06, y=.64, ls=.2, **{"in": "spread"}, ls0=.6, d=.35, at=.9, fw=500, distress=False, out=dict(at=-2.6, fx="fade", d=.15)),
   T("Suscríbete · NodeMotion", outro="feats", font="cd", color="ink", w=.32, h=.035, y=.72, ls=.12, **{"in": "fade"}, d=.3, at=1.2, op=.8, distress=False, out=dict(at=-2.8, fx="fade", d=.15)),
   G(at=-1.48, d=.1, n=3, redP=.3)])}
OUT.write_text(json.dumps(SC, ensure_ascii=False, indent=1).replace("\"from_\"", "\"from\""))
OUT.with_name("outros.json").write_text(json.dumps(OUTROS, ensure_ascii=False, indent=1).replace("\"from_\"", "\"from\""))
print(len(SC), "escenas")

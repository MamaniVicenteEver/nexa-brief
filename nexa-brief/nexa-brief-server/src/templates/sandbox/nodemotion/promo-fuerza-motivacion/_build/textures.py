"""Texturas grunge para los prototipos promo-fuerza-motivacion y lyrics-final-cut.

Genera máscaras en escala de grises (blanco = opaco) que la plantilla usa como
`mask-image` sobre un div de color plano: así un mismo pincel sirve en rojo, negro o crema
sin filtros en vivo. Determinista (semilla fija).

Uso: python3 textures.py <carpeta-salida> [fitness|grunge|all]
"""
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(sys.argv[1])
WHICH = sys.argv[2] if len(sys.argv) > 2 else "all"
OUT.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(7)
random.seed(7)


def noise1d(n, scale, octaves=3):
    """Ruido 1D suave (suma de senos con fases aleatorias) en [0,1]."""
    x = np.arange(n) / scale
    v = np.zeros(n)
    amp = 1.0
    for o in range(octaves):
        f = 2 ** o
        for _ in range(3):
            v += amp * np.sin(x * f * rng.uniform(0.6, 1.6) + rng.uniform(0, 6.28))
        amp *= 0.5
    v -= v.min()
    return v / (v.max() + 1e-9)


def noise2d(w, h, cell):
    """Ruido de valor 2D (bilineal) en [0,1]."""
    gw, gh = w // cell + 2, h // cell + 2
    g = rng.random((gh, gw)).astype(np.float32)
    im = Image.fromarray((g * 255).astype(np.uint8)).resize((gw * cell, gh * cell), Image.BICUBIC)
    return np.asarray(im, dtype=np.float32)[:h, :w] / 255.0


def save(arr, name):
    a = np.clip(arr, 0, 1)
    # blanco con alfa = máscara: CSS enmascara por el canal alfa, no por la luminancia
    al = Image.fromarray((a * 255).astype(np.uint8), "L")
    im = Image.new("RGBA", al.size, (255, 255, 255, 0)); im.putalpha(al)
    im.save(OUT / name, optimize=True)
    print("  ", name, a.shape[1], "x", a.shape[0])


def dry_brush(w, h, horizontal=True, density=0.93, ragged=0.08, streak=0.25):
    """Pincelada seca: filas de cerdas con extremos irregulares y huecos a lo largo."""
    if not horizontal:
        return dry_brush(h, w, True, density, ragged, streak).T
    a = np.zeros((h, w), np.float32)
    left = noise1d(h, 9) * w * ragged + rng.random(h) * w * ragged * 0.5
    right = w - (noise1d(h, 11) * w * ragged + rng.random(h) * w * ragged * 0.6)
    xs = np.arange(w)
    gaps = noise2d(w, h, 6)
    fib = noise2d(w, h, 2)
    for y in range(h):
        row = ((xs >= left[y]) & (xs <= right[y])).astype(np.float32)
        a[y] = row
    # rayado de cerdas: bandas horizontales finas con huecos
    band = noise1d(h, 1.3, 2)
    mask = (gaps * 0.6 + fib * 0.4) < (density - streak * (band[:, None] < 0.18))
    a *= mask
    # bordes superior/inferior deshilachados
    edge = np.minimum(np.arange(h), np.arange(h)[::-1])[:, None] / (h * 0.12)
    a *= (rng.random((h, w)) < np.clip(edge + 0.15, 0, 1))
    return a


def rough_rect(w, h, pad, amp, cell=5, holes=0.0):
    """Rectángulo con borde rugoso (papel/pincel), relleno sólido."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    d = np.minimum.reduce([xx - pad, (w - pad) - xx, yy - pad, (h - pad) - yy])
    n = noise2d(w, h, cell) * amp + noise2d(w, h, 1) * amp * 0.5
    a = (d + n > amp * 0.7).astype(np.float32)
    if holes:
        a *= (noise2d(w, h, 3) > holes)
    return a


def rough_frame(w, h, thick, amp):
    outer = rough_rect(w, h, 6, amp)
    inner = rough_rect(w, h, thick, amp * 1.4)
    a = outer * (1 - inner)
    # textura de crayón dentro del trazo
    a *= (noise2d(w, h, 2) > 0.18)
    return a


def scribble(w, h, loops, tight, thick, color_noise=0.25, seed=0):
    """Garabato en zigzag tipo crayón (relleno denso)."""
    r = random.Random(seed)
    im = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(im)
    pts = []
    for i in range(loops):
        x = w * (0.05 + 0.9 * i / loops) + r.uniform(-w * tight, w * tight)
        y = h * (0.12 if i % 2 == 0 else 0.88) + r.uniform(-h * 0.1, h * 0.1)
        pts.append((x, y))
    for k in range(3):
        jit = [(x + r.uniform(-8, 8), y + r.uniform(-8, 8)) for x, y in pts]
        dr.line(jit, fill=255, width=thick, joint="curve")
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(1)), np.float32) / 255
    a *= (noise2d(w, h, 2) > color_noise)
    return a


def loops_chalk(w, h, n, seed=1):
    """Óvalos de tiza encadenados (trazo fino, granulado)."""
    r = random.Random(seed)
    im = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(im)
    pts = []
    cx, cy = w * 0.5, h * 0.5
    for i in range(n * 40):
        t = i / 40 * 2 * math.pi
        x = cx + math.cos(t) * w * 0.42 * (0.85 + 0.15 * math.sin(t * 0.37)) + (i / (n * 40) - 0.5) * w * 0.15
        y = cy + math.sin(t) * h * 0.32 * (0.7 + 0.3 * math.cos(t * 0.23))
        pts.append((x + r.uniform(-2, 2), y + r.uniform(-2, 2)))
    dr.line(pts, fill=255, width=5, joint="curve")
    a = np.asarray(im, np.float32) / 255
    a *= (noise2d(w, h, 1) > 0.35)
    return a


def grunge_speckle(w, h):
    """Máscara para texto estampado: casi opaco con huecos y bordes comidos."""
    n = noise2d(w, h, 3) * 0.55 + noise2d(w, h, 1) * 0.45 + noise2d(w, h, 24) * 0.35
    return (n < 1.02).astype(np.float32) * (noise2d(w, h, 1) > 0.05)


def torn_rect(w, h, amp=26):
    """Rectángulo de papel roto: bordes con dientes grandes y fibras."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    ln = noise1d(h, 7, 4) * amp + rng.random(h) * 4
    rn = noise1d(h, 9, 4) * amp + rng.random(h) * 4
    tn = noise1d(w, 9, 4) * amp * 0.6 + rng.random(w) * 3
    bn = noise1d(w, 7, 4) * amp * 0.6 + rng.random(w) * 3
    a = ((xx > ln[:, None]) & (xx < w - rn[:, None]) & (yy > tn[None, :]) & (yy < h - bn[None, :]))
    return a.astype(np.float32)


def ink_blob(s):
    yy, xx = np.mgrid[0:s, 0:s].astype(np.float32)
    c = s / 2
    ang = np.arctan2(yy - c, xx - c)
    rr = np.hypot(xx - c, yy - c)
    k = np.zeros_like(ang)
    for f in (3, 5, 7, 11):
        k += np.sin(ang * f + rng.uniform(0, 6.28)) * rng.uniform(0.02, 0.06)
    a = (rr < s * 0.38 * (1 + k) + noise2d(s, s, 6) * s * 0.05).astype(np.float32)
    return np.asarray(Image.fromarray((a * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), np.float32) / 255


def paper_bg(w, h, base, var):
    """Fondo de papel/cartón oscuro con fibras, manchas y grano (RGB)."""
    n = noise2d(w, h, 90) * 0.5 + noise2d(w, h, 18) * 0.3 + noise2d(w, h, 2) * 0.2
    fib = noise2d(w, h, 1)
    v = base + (n - 0.5) * var + (fib - 0.5) * var * 0.35
    return np.clip(v, 0, 1)


def hatch(w, h):
    """Parche de tela/cartón tramado (para los recortes de textura de Final Cut)."""
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    t = (np.sin((xx + yy) * 0.9) * 0.5 + 0.5) * 0.5 + (np.sin((xx - yy) * 0.9) * 0.5 + 0.5) * 0.5
    return np.clip(0.22 + t * 0.12 + (noise2d(w, h, 1) - 0.5) * 0.18 + (noise2d(w, h, 40) - 0.5) * 0.1, 0, 1)


if WHICH in ("fitness", "all"):
    print("fitness")
    save(rough_rect(1000, 600, 30, 26, cell=7), "card.png")                 # tarjeta de video recortada
    save(np.maximum(dry_brush(1100, 420, True, 0.95, 0.07), rough_rect(1100, 420, 60, 30, 9) * 0.0), "brushbox.png")
    save(rough_frame(1100, 640, 120, 40), "frame.png")                       # marco de pincel negro
    save(dry_brush(1800, 300, True, 0.9, 0.12, 0.35), "stroke.png")          # pincelada horizontal larga
    save(scribble(1200, 420, 34, 0.012, 34, 0.22, 3), "scribble.png")        # garabato de crayón
    save(loops_chalk(1400, 300, 5, 2), "chalk.png")                          # óvalos de tiza
    save(grunge_speckle(1024, 512), "speckle.png")                           # máscara estampada para texto
    save(ink_blob(600), "blob.png")
if WHICH in ("grunge", "all"):
    print("grunge")
    save(torn_rect(900, 1200, 46), "torn.png")                               # recorte de papel roto
    save(dry_brush(260, 1400, False, 0.9, 0.05, 0.3), "vstroke.png")         # pincelada vertical blanca
    save(dry_brush(1600, 260, True, 0.82, 0.18, 0.45), "hstroke.png")        # barrido horizontal seco
    save(ink_blob(700), "blob.png")
    save(grunge_speckle(1024, 512), "speckle.png")
    bg = paper_bg(1280, 720, 0.17, 0.10)
    Image.fromarray((np.dstack([bg, bg, bg]) * 255).astype(np.uint8)).save(OUT / "paper.jpg", quality=86)
    print("   paper.jpg")
    hb = hatch(640, 360)
    Image.fromarray((np.dstack([hb, hb, hb]) * 255).astype(np.uint8)).save(OUT / "hatch.jpg", quality=84)
    print("   hatch.jpg")

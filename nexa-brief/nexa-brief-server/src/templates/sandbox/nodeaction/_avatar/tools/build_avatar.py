#!/usr/bin/env python3
"""Corta la imagen de un avatar en capas animables (sin redibujar nada) y verifica que en reposo
las capas recompongan EXACTAMENTE la imagen original.

Uso (desde cualquier carpeta):
  python3 sandbox/nodeaction/_avatar/tools/build_avatar.py <personaje>      # p. ej. chica
Lee  _avatar/characters/<id>/source.png + rig.json (bloque "cuts").
Deja _avatar/characters/<id>/parts/<capa>.png + parts.json (posición de cada recorte)
     y work/ (mapa de partes, recomposición y diferencia, para mirar).

Cómo corta:
  1. La tinta (líneas negras y el pelo) separa regiones de relleno. Cada región va a una parte
     (cabeza, cuerpo, brazo, mano) y cada píxel de tinta va a la parte de su relleno más cercano:
     así los cortes siguen las líneas del dibujo, no rectas a ojo.
  2. Lo que queda tapado se completa SOLO en la capa de atrás (no se ve en reposo):
     cuello debajo de la cabeza, muñeca debajo del puño, costado del torso debajo de cada brazo.
"""
import json, pathlib, sys
import numpy as np
from PIL import Image
from scipy import ndimage as nd

HERE = pathlib.Path(__file__).resolve().parent
CHARS = HERE.parent / "characters"
BODY, HEAD, ARM_L, ARM_R, HAND_L, HAND_R = range(6)
NAMES = {BODY: "body", HEAD: "head", ARM_L: "armL", ARM_R: "armR", HAND_L: "handL", HAND_R: "handR"}
ORDER = ["body", "head", "handL", "armL", "handR", "armR"]   # atrás → adelante (igual que rig.json)


def polyx(line, ys):
    """x de una polilínea (puntos [x, y] con y creciente) para cada y."""
    P = np.array(line, float)
    return np.interp(ys, P[:, 1], P[:, 0])


def build(cid):
    d = CHARS / cid
    rig = json.loads((d / "rig.json").read_text())
    C = rig["cuts"]
    src = np.array(Image.open(d / rig["source"]).convert("RGBA"))
    # ruido de alfa casi invisible (≤ 12/255) del recorte del fondo: se limpia
    src[src[..., 3] <= C.get("alphaNoise", 12)] = 0
    H, W = src.shape[:2]
    a = src[..., 3].astype(int)
    lum = src[..., :3].astype(float).mean(-1)
    solid = a > 0
    fill = (a > 100) & (lum >= 90)
    ink = solid & ~fill          # líneas, pelo y bordes suavizados
    lab, n = nd.label(fill)
    yy, xx = np.mgrid[0:H, 0:W]

    # ---- 1 · dueño de cada región de relleno
    owner = np.full((H, W), BODY, np.int8)
    reg_owner = np.full(n + 1, BODY, np.int8)
    cms = nd.center_of_mass(np.ones_like(lab), lab, range(1, n + 1))
    hL, hR = C["handL"], C["handR"]
    seedL = lab[hL["seed"][1], hL["seed"][0]]
    seedR = lab[hR["seed"][1], hR["seed"][0]]
    bbL = nd.find_objects(lab)[seedL - 1]
    bbR = nd.find_objects(lab)[seedR - 1]
    collar = {lab[y, x] for x, y in C["collarRegionsSeed"]}
    keep = {lab[y, x] for x, y in C.get("bodyRegionsSeed", [])}   # pantalón: nunca es brazo
    for i, (cy, cx) in enumerate(cms, start=1):
        if i == seedL or (bbL[0].start <= cy <= bbL[0].stop and bbL[1].start <= cx <= bbL[1].stop and cy > hL["wristTop"] + 8):
            reg_owner[i] = HAND_L
        elif i == seedR or (bbR[0].start <= cy <= bbR[0].stop and bbR[1].start <= cx <= bbR[1].stop and cy > hR["wristTop"] + 8):
            reg_owner[i] = HAND_R
    owner_fill = reg_owner[lab]
    owner[fill] = owner_fill[fill]

    # brazos: el relleno a un costado de la línea de corte (los dos brazos se tocan con el torso)
    for key, side, code in (("armL", -1, ARM_L), ("armR", 1, ARM_R)):
        A = C[key]
        lx = polyx(A["line"], yy)
        zone = (yy >= A["top"]) & (yy <= A["bottom"]) & ((xx - lx) * side > 0)
        m = fill & zone & (owner == BODY) & ~np.isin(lab, list(collar))
        # el pantalón no es brazo aunque quede del lado de afuera: solo regiones que tocan la manga
        big = nd.sum(np.ones_like(lab), lab, range(1, n + 1))
        for i in np.unique(lab[m]):
            if i == 0 or i in keep:
                continue
            part = m & (lab == i)
            # una región que casi toda queda del otro lado (torso, pantalón) se parte por la línea;
            # una región chica que cae casi entera afuera (puño, pliegues) va entera al brazo
            # región que cae casi entera afuera (manga, puño, pliegues) → entera al brazo;
            # la grande que comparte con el torso (suéter) se parte por la línea
            if part.sum() > 0.6 * big[i - 1] or big[i - 1] > 5000:
                owner[part] = code
    # ---- cabeza: todo lo que está por encima del cuello, menos el cuello y el cuello de la camisa
    N = C["neck"]
    head = solid & (yy < C["headBelowY"])
    # mandíbula: en las columnas del cuello, la cabeza termina donde termina la línea de la mandíbula
    jaw = np.full(W, C["headBelowY"], int)
    for x in range(N["x"][0], N["x"][1] + 1):
        y = 245
        while y < C["headBelowY"] and not ink[y, x]:
            y += 1
        while y < C["headBelowY"] and ink[y, x]:
            y += 1
        jaw[x] = y
        if any(l0 - 1 <= x <= l1 + 1 for l0, l1 in N["lines"]):
            jaw[x] = min(y, N.get("lineJaw", 287))   # la línea del cuello sale por debajo del pelo
    neck = np.zeros((H, W), bool)
    for x in range(N["x"][0], N["x"][1] + 1):
        neck[jaw[x]:C["headBelowY"], x] = True
    head &= ~neck & ~np.isin(lab, list(collar))

    # ---- 2 · la tinta va a la parte de su relleno más cercano
    _, (iy, ix) = nd.distance_transform_edt(~fill, return_indices=True)
    near = owner[iy, ix]
    owner = np.where(ink, near, owner)
    # tinta del cuello de la camisa (dentro de la franja de la cabeza) → cuerpo
    near_lab = lab[iy, ix]
    head &= ~(ink & np.isin(near_lab, list(collar)) & (yy >= C.get("collarTop", 292)))
    # tinta pegada al corte: su relleno más cercano puede quedar del otro lado de la línea; todo lo
    # que está del lado del brazo (hasta el ruedo; abajo está el pantalón) es del brazo
    for key, side, code in (("armL", -1, ARM_L), ("armR", 1, ARM_R)):
        A = C[key]
        lx = polyx(A["line"], yy)
        zone = (yy >= A["top"]) & (yy <= A.get("strictBelow", 652)) & ((xx - lx) * side > 0)
        owner[zone & ink & (owner == BODY) & ~np.isin(near_lab, list(keep))] = code
    owner[head] = HEAD
    owner[solid & ~head & (owner == HEAD)] = BODY
    owner[~solid] = -1
    # la línea del puño es de la manga: tinta de la mano pegada a un relleno del brazo
    for hand, arm in ((HAND_L, ARM_L), (HAND_R, ARM_R)):
        dist = nd.distance_transform_edt(~(fill & (owner == arm)))
        owner[ink & (owner == hand) & (dist <= 7)] = arm

    layers = {}
    for code, name in NAMES.items():
        L = np.zeros_like(src)
        m = owner == code
        L[m] = src[m]
        layers[name] = L
    ink_rgb = np.array([20, 17, 16], np.uint8)

    # ---- costado del torso debajo de cada brazo: el brazo se lleva una franja de la línea de corte
    #      (para que en reposo tape todo) y el cuerpo pinta ahí su propio contorno con tinta.
    body = layers["body"]
    for key, side, name in (("armL", -1, "armL"), ("armR", 1, "armR")):
        A = C[key]
        lx = polyx(A["line"], yy)
        band = (yy >= A["top"] + 18) & (yy <= 652) & ((xx - lx) * side <= 0) & ((xx - lx) * side > -A["band"]) & solid
        band &= (owner == BODY)
        arm = layers[name]
        arm[band] = src[band]
        # el cuerpo pierde lo que quedó en el brazo (ya está en owner); arriba, la franja empieza suave
        top = (yy >= A["top"]) & (yy < A["top"] + 18) & ((xx - lx) * side <= 0) & ((xx - lx) * side > -A["band"]) & solid & (owner == BODY)
        arm[top] = src[top]

    # ---- cuello debajo de la cabeza: piel + las dos líneas, estiradas hacia arriba hasta extendTo
    sx, sy = N["sample"]
    skin = src[sy, sx].copy()
    x0, x1 = N["lines"][0][0], N["lines"][1][1]
    for x in range(x0, x1 + 1):
        top = int(jaw[x]) if N["x"][0] <= x <= N["x"][1] else C["headBelowY"]
        for y in range(N["extendTo"], top):
            if body[y, x, 3] == 0 or owner[y, x] == HEAD:
                is_line = any(l0 <= x <= l1 for l0, l1 in N["lines"])
                body[y, x] = (*ink_rgb, 255) if is_line else skin

    # ---- muñeca debajo del puño: se repite hacia arriba la fila más alta completa de la mano
    for key, name in (("handL", "handL"), ("handR", "handR")):
        h = C[key]
        L = layers[name]
        ys = np.where(L[..., 3].max(1) > 0)[0]
        ytop = ys.min()
        ref = ytop + 6
        row = L[ref].copy()
        for y in range(ytop - h["extend"], ref):
            keep = L[y, :, 3] < row[:, 3]
            L[y, keep] = row[keep]

    # ---- las líneas dibujadas que comparten brazo y cuerpo quedan en LAS DOS capas: al separarse,
    #      cada una conserva su contorno completo (en reposo se superponen idénticas)
    near_body = nd.distance_transform_edt(~(fill & (owner == BODY))) <= C.get("shareInk", 7)
    for code in (ARM_L, ARM_R):
        m = near_body & ink & (owner == code) & (src[..., 3] == 255)
        body[m] = src[m]

    # ---- sin costuras: el cuerpo se extiende 3 px por debajo de cada brazo (al ampliar o deformar,
    #      dos bordes cortados en el mismo lugar dejan pasar el fondo como una línea punteada)
    under = nd.binary_dilation(body[..., 3] > 0, iterations=C.get("seam", 3))
    for code in (ARM_L, ARM_R):
        m = under & (owner == code) & (src[..., 3] == 255) & (body[..., 3] == 0)
        body[m] = src[m]

    # ---- un borde semitransparente no puede estar en dos capas (se sumaría el alfa)
    stack = [layers[k] for k in ORDER]
    for i in range(len(stack)):
        for j in range(i + 1, len(stack)):
            both = (stack[i][..., 3] > 0) & (stack[j][..., 3] > 0) & (stack[j][..., 3] < 250)
            both &= (stack[j][..., :3] == src[..., :3]).all(-1)
            stack[i][both] = 0

    # ---- salida: recortes + posición
    out = d / "parts"
    out.mkdir(exist_ok=True)
    meta = {"size": [W, H], "parts": {}}
    for k in ORDER:
        L = layers[k]
        ys, xs = np.where(L[..., 3] > 0)
        x0, y0, x1, y1 = int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1
        x0, y0 = max(0, x0 - 2), max(0, y0 - 2)
        x1, y1 = min(W, x1 + 2), min(H, y1 + 2)
        Image.fromarray(L[y0:y1, x0:x1]).save(out / f"{k}.png", optimize=True)
        meta["parts"][k] = {"file": f"parts/{k}.png", "x": x0, "y": y0, "w": x1 - x0, "h": y1 - y0}
    (d / "parts.json").write_text(json.dumps(meta, indent=2) + "\n")

    # ---- verificación: recomponer en reposo y comparar con el original
    comp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for k in ORDER:
        comp.alpha_composite(Image.fromarray(layers[k]))
    c = np.array(comp).astype(int)
    s = src.astype(int)
    # comparación premultiplicada (el color de un píxel invisible no importa)
    pc = c[..., :3] * c[..., 3:] / 255.0
    ps = s[..., :3] * s[..., 3:] / 255.0
    diff = np.abs(pc - ps).max(-1)
    diff = np.maximum(diff, np.abs(c[..., 3] - s[..., 3]))
    work = d / "work"
    work.mkdir(exist_ok=True)
    pal = np.array([[90, 110, 220], [80, 170, 90], [230, 90, 110], [240, 170, 60], [170, 80, 220], [60, 200, 200]], np.uint8)
    vis = np.zeros((H, W, 3), np.uint8)
    for code in NAMES:
        vis[owner == code] = pal[code]
    Image.fromarray(vis).save(work / "partmap.png")
    Image.fromarray(np.clip(diff * 4, 0, 255).astype(np.uint8)).save(work / "diff.png")
    bad = (diff > 2).sum()
    sizes = ", ".join("%s %d×%d" % (k, meta["parts"][k]["w"], meta["parts"][k]["h"]) for k in ORDER)
    print(f"[{cid}] capas: {sizes}")
    print(f"[{cid}] reposo vs original: diferencia máx {int(diff.max())}/255, píxeles con diferencia > 2: {bad}")
    return int(diff.max()) > C.get("maxDiff", 6)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    sys.exit(1 if build(sys.argv[1]) else 0)

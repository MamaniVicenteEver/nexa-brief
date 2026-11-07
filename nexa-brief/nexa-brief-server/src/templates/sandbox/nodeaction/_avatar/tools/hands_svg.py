#!/usr/bin/env python3
"""Genera las manos de gesto de un avatar (characters/<id>/hands/<forma>.svg) desde rig.json → "hands".

Uso:  python3 sandbox/nodeaction/_avatar/tools/hands_svg.py <personaje>

Cada mano es la mano IZQUIERDA de pantalla con la palma hacia la cámara, dedos hacia abajo (+y) y
el pulgar hacia afuera (x menor); la derecha es su espejo (lo hace avatar.js). La muñeca queda en
hands.wrist, que se pega al hueso de la mano (centro del borde del puño).

Estilo (igual que la imagen): silueta con trazo negro grueso, relleno de piel, líneas interiores
finas entre dedos y en los nudillos. Técnica de doble trazo: primero TODO en negro ancho, después
TODO en piel → un solo contorno limpio, sin líneas en las uniones.

Un dedo = [x, y, ancho, largo, ángulo]: base en (x, y), crece hacia abajo; ángulo en grados,
positivo = hacia el pulgar. "curl": true = dedo doblado (se ve el nudillo).
"""
import json, pathlib, sys

HERE = pathlib.Path(__file__).resolve().parent
CHARS = HERE.parent / "characters"


def capsule(x, y, w, L, a):
    return (f'<rect x="{x - w / 2:.2f}" y="{y:.2f}" width="{w:.2f}" height="{L:.2f}" rx="{w / 2:.2f}" '
            f'transform="rotate({a:.2f} {x:.2f} {y:.2f})"/>')


def svg(spec, H):
    W, Hh = H["box"]
    ink, skin, shade = H["ink"], H["skin"], H["shade"]
    lw = H["line"]
    palm = spec.get("palm", H["palm"])
    fingers = spec["fingers"]
    thumb = spec["thumb"]
    over = spec.get("thumbOver", False)      # pulgar por delante de los dedos doblados
    shapes = [f'<path d="{palm}"/>'] + [capsule(*f[:5]) for f in fingers]
    th = capsule(*thumb[:5])
    base = "".join(shapes) + ("" if over else th)
    top = th if over else ""
    # líneas finas: contorno de cada dedo (separa los dedos juntos) fuera de la palma
    thin = "".join(capsule(*f[:5]) for f in fingers)
    knuckles = "".join(
        f'<path d="M{f[0] - f[2] * 0.32:.1f} {f[1] + f[3] * 0.55:.1f} q{f[2] * 0.32:.1f} {f[2] * 0.22:.1f} {f[2] * 0.64:.1f} 0"/>'
        for f in fingers if len(f) > 5 and f[5] == "curl")
    crease = spec.get("crease", H.get("crease", ""))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {Hh}" width="{W}" height="{Hh}">
<!-- generado por tools/hands_svg.py desde rig.json → hands.{spec["id"]} (no editar a mano) -->
<defs>
  <linearGradient id="sk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="{shade}"/><stop offset="0.35" stop-color="{skin}"/></linearGradient>
  <g id="body">{base}</g>
  <g id="top">{top}</g>
  <mask id="nopalm" maskUnits="userSpaceOnUse" x="0" y="0" width="{W}" height="{Hh}"><rect width="{W}" height="{Hh}" fill="#fff"/><path d="{palm}" fill="#000"/></mask>
</defs>
<g stroke-linejoin="round" stroke-linecap="round">
  <use xlink:href="#body" fill="{ink}" stroke="{ink}" stroke-width="{lw * 2:.2f}"/>
  <use xlink:href="#body" fill="url(#sk)" stroke="none"/>
  <g fill="none" stroke="{ink}" stroke-width="{lw * 0.55:.2f}" mask="url(#nopalm)">{thin}</g>
  <g fill="none" stroke="{ink}" stroke-width="{lw * 0.5:.2f}">{knuckles}<path d="{crease}"/></g>
  <use xlink:href="#top" fill="{ink}" stroke="{ink}" stroke-width="{lw * 2:.2f}"/>
  <use xlink:href="#top" fill="{skin}" stroke="none"/>
</g>
</svg>
'''


def main(cid):
    d = CHARS / cid
    rig = json.loads((d / "rig.json").read_text())
    H = rig["hands"]
    out = d / "hands"
    out.mkdir(exist_ok=True)
    for sid in H["shapes"]:
        spec = dict(H["spec"][sid], id=sid)
        (out / f"{sid}.svg").write_text(svg(spec, H))
        print("→", out / f"{sid}.svg")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1])

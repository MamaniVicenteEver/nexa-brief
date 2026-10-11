#!/usr/bin/env python3
"""Pre-grada el material de las plantillas promo-* (commercial/).

Por qué: filtrar <video> en vivo en Chrome headless es carísimo (un solo
filtro CSS baja un video 1080p de ~45 fps a ~13 fps). Esta herramienta lee los
`grades` de un config.json de promo-* y genera con ffmpeg, para cada media
(video y su póster, o imagen), una variante ya gradada por cada grade; luego
anota `media[i].graded[<grade>] = { src, poster }` en el mismo config. La
plantilla usa esas variantes sin filtro; si un media no tiene su variante, la
plantilla aplica el filtro en vivo (funciona igual, solo que más lento).

La matemática replica exactamente los filtros de la plantilla:
  · duo  → luminancia (coef. de feColorMatrix saturate=0) → contraste
           (v-0.5)·c+0.5 → mapa lineal [dark → light] por canal.
  · css  → matriz saturate(s) de CSS → contrast(c) → brightness(b).

Uso:  python3 _tools/commercial/grade_media.py nodemotion/commercial/promo-trendy/assets/config.json [--force]
      (rutas de media relativas a la carpeta de la plantilla: nodemotion/commercial/promo-trendy/)
"""
import json, pathlib, subprocess, sys

def hex3(h):
    n = int(h.lstrip("#"), 16)
    return ((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255

def vf_for(g):
    if g.get("type") == "duo":
        c = float(g.get("contrast", 1.25)); i = (1 - c) / 2
        d, l = hex3(g["dark"]), hex3(g["light"])
        mix = "colorchannelmixer=" + ":".join(["0.2126:0.7152:0.0722:0"] * 3)
        ch = lambda a, b: f"'clip(({a:.4f}+({b - a:.4f})*clip(val/255*{c:.4f}+{i:.4f},0,1))*255,0,255)'"
        return f"{mix},lutrgb=r={ch(d[0], l[0])}:g={ch(d[1], l[1])}:b={ch(d[2], l[2])}"
    s = float(g.get("saturate", 1)); c = float(g.get("contrast", 1)); b = float(g.get("brightness", 1))
    m = [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
         0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
         0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s]
    mix = ("colorchannelmixer=rr={:.4f}:rg={:.4f}:rb={:.4f}:gr={:.4f}:gg={:.4f}:gb={:.4f}:br={:.4f}:bg={:.4f}:bb={:.4f}").format(*m)
    e = f"'clip(((val/255-0.5)*{c:.4f}+0.5)*{b:.4f}*255,0,255)'"
    return f"{mix},lutrgb=r={e}:g={e}:b={e}"

def run(cmd):
    subprocess.run(cmd, check=True, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)

def grade_config(cfg_path, force=False):
    cfg_path = pathlib.Path(cfg_path).resolve()
    root = cfg_path.parent.parent            # nodemotion/commercial/promo-*/
    db = json.loads(cfg_path.read_text())
    for case in db["configs"]:
        grades = case.get("grades") or {}
        for m in case.get("media", []):
            if not grades:
                m.pop("graded", None); continue
            out = {}
            for key, g in grades.items():
                vf = vf_for(g)
                entry = {}
                src = root / m["src"]
                stem = pathlib.Path(m["src"]).stem
                gdir = root / "assets/media/graded"; gdir.mkdir(parents=True, exist_ok=True)
                if m.get("type") == "video":
                    dst = gdir / f"{stem}.{key}.mp4"
                    if force or not dst.exists():
                        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-an", "-vf", vf, "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-pix_fmt", "yuv420p", "-movflags", "+faststart", str(dst)])
                    entry["src"] = str(dst.relative_to(root))
                    if m.get("poster"):
                        pdst = gdir / f"{pathlib.Path(m['poster']).stem}.{key}.jpg"
                        if force or not pdst.exists():
                            run(["ffmpeg", "-y", "-v", "error", "-i", str(root / m["poster"]), "-vf", vf, "-q:v", "3", str(pdst)])
                        entry["poster"] = str(pdst.relative_to(root))
                else:
                    dst = gdir / f"{stem}.{key}.jpg"
                    if force or not dst.exists():
                        run(["ffmpeg", "-y", "-v", "error", "-i", str(src), "-vf", vf, "-q:v", "3", str(dst)])
                    entry["src"] = str(dst.relative_to(root))
                out[key] = entry
            m["graded"] = out
    cfg_path.write_text(json.dumps(db, indent=2, ensure_ascii=False) + "\n")
    return db

if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for a in args:
        grade_config(a, force="--force" in sys.argv)
        print("graded", a)

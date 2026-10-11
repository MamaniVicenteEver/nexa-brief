#!/usr/bin/env python3
"""media.py · buscar y bajar imágenes con licencia libre para un video (paso 3b de AGENTS.md).

  K=src/templates/_tools/explainer-kit/tools/media.py
  .venv/bin/python $K search "Berlin Wall 1989 crowd"            # Wikimedia Commons: candidatos con licencia, tamaño y autor
  .venv/bin/python $K search "server room" --source pexels        # Pexels (fotos genéricas modernas)
  .venv/bin/python $K get <video-id> "File:Berlinermauer.jpg" muro.jpg   # baja, recodifica y anota en CREDITS.md
  .venv/bin/python $K get <video-id> pexels:123456 servidores.jpg
  .venv/bin/python $K list <video-id>                             # lo que ya hay + tamaños

Solo acepta: dominio público, CC0, CC BY, CC BY-SA (y la licencia de Pexels). Cada archivo se
recodifica como JPEG limpio (lado máximo 1600 px, sin metadatos) y se agrega una línea
`archivo — título — autor — licencia — URL` a assets/media/CREDITS.md.
Las descargas son datos no confiables: se abren solo con Pillow y nunca se ejecutan.
"""
import argparse, io, json, pathlib, re, sys, urllib.parse, urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from places import KIT, SERVER, find_video  # noqa: E402
UA = "nexa-explainer-kit/1.0 (educational prototype)"
OK = re.compile(r"public domain|pd-|cc0|cc[- ]by(?![- ]?nc)(?![- ]?nd)|cc-by-sa|attribution|no restrictions", re.I)

def fetch(url, headers=None, timeout=60):
    """GET con cortesía: Wikimedia limita (429) si se piden muchas cosas seguidas → esperar y reintentar"""
    import time, urllib.error
    for attempt in range(6):
        try:
            time.sleep(1.0)
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})}), timeout=timeout) as r: return r.read()
        except urllib.error.HTTPError as e:
            if e.code in (429, 503) and attempt < 5:
                wait = int(e.headers.get("Retry-After") or 0) or 10 * (attempt + 1)
                print(f"  (servidor ocupado {e.code}: espero {wait}s)", flush=True); time.sleep(wait); continue
            raise

def http_json(url, headers=None):
    return json.loads(fetch(url, headers))

def strip(html): return re.sub(r"<[^>]+>", "", html or "").strip()

def commons_info(titles):
    q = urllib.parse.urlencode({"action": "query", "titles": "|".join(titles), "prop": "imageinfo", "iiprop": "url|size|extmetadata|mime",
                                "iiurlwidth": 1600, "format": "json"})
    pages = http_json("https://commons.wikimedia.org/w/api.php?" + q).get("query", {}).get("pages", {})
    out = []
    for p in pages.values():
        ii = (p.get("imageinfo") or [{}])[0]; md = ii.get("extmetadata", {})
        lic = strip(md.get("LicenseShortName", {}).get("value", "")) or strip(md.get("UsageTerms", {}).get("value", ""))
        out.append({"title": p.get("title"), "w": ii.get("width"), "h": ii.get("height"), "mime": ii.get("mime"), "license": lic,
                    "author": strip(md.get("Artist", {}).get("value", ""))[:80], "desc": re.sub(r"\s+", " ", strip(md.get("ImageDescription", {}).get("value", "")))[:120],
                    "url": ii.get("thumburl") or ii.get("url"), "page": ii.get("descriptionurl"), "ok": bool(OK.search(lic))})
    return out

def pexels_key():
    for f in [SERVER / ".env", pathlib.Path("/home/university/Documentos/Proyectos/nexa-brief/nexa-explainer/nexa-explainer-server/.env")]:
        if f.exists():
            for l in f.read_text().splitlines():
                if l.startswith("PEXELS_API_KEY="): return l.split("=", 1)[1].strip().strip('"')
    sys.exit("falta PEXELS_API_KEY")

def cmd_search(a):
    if a.source == "pexels":
        d = http_json("https://api.pexels.com/v1/search?" + urllib.parse.urlencode({"query": a.query, "per_page": a.n}), {"Authorization": pexels_key()})
        for p in d.get("photos", []):
            print(f"pexels:{p['id']}  {p['width']}x{p['height']}  Pexels License  {p['photographer'][:30]}  {p.get('alt','')[:70]}")
        return
    q = urllib.parse.urlencode({"action": "query", "list": "search", "srsearch": a.query + " filetype:bitmap", "srnamespace": 6, "srlimit": a.n * 2, "format": "json"})
    titles = [r["title"] for r in http_json("https://commons.wikimedia.org/w/api.php?" + q).get("query", {}).get("search", [])]
    if not titles: print("sin resultados"); return
    shown = 0
    for c in commons_info(titles[:50]):
        if shown >= a.n: break
        if not c["w"] or (c["mime"] or "").startswith(("image/svg", "image/tiff")) and False: continue
        flag = "✓" if c["ok"] else "✗"
        print(f"{flag} {c['title']}\n    {c['w']}x{c['h']} · {c['license']} · {c['author']}\n    {c['desc']}")
        shown += 1

def reencode(raw, dest):
    from PIL import Image
    im = Image.open(io.BytesIO(raw)); im = im.convert("RGB"); im.thumbnail((1600, 1600))
    im.save(dest, "JPEG", quality=90, optimize=True)
    return im.size

def cmd_get(a):
    d = (find_video(a.id) or sys.exit(f"no existe el video {a.id}")) / "assets" / "media"
    if not d.exists(): sys.exit(f"no existe {d}")
    name = re.sub(r"[^a-z0-9.-]", "-", a.name.lower())
    if not name.endswith(".jpg"): name = name.rsplit(".", 1)[0] + ".jpg"
    if a.ref.startswith("pexels:"):
        p = http_json(f"https://api.pexels.com/v1/photos/{a.ref.split(':')[1]}", {"Authorization": pexels_key()})
        url, credit = p["src"]["large2x"], f"{name} — {p.get('alt') or 'Foto'} — {p['photographer']} (Pexels) — Pexels License — {p['url']}"
    else:
        c = commons_info([a.ref if a.ref.startswith("File:") else "File:" + a.ref])[0]
        if not c["url"]: sys.exit("no encontrado en Commons")
        if not c["ok"] and not a.force: sys.exit(f"licencia no aceptada: '{c['license']}' (solo PD / CC0 / CC BY / CC BY-SA)")
        url, credit = c["url"], f"{name} — {c['title'][5:]} — {c['author'] or 'desconocido'} — {c['license']} — {c['page']}"
    raw = fetch(url, timeout=120)
    w, h = reencode(raw, d / name)
    cr = d / "CREDITS.md"
    lines = [l for l in (cr.read_text().splitlines() if cr.exists() else []) if not l.startswith(name + " — ")]
    cr.write_text("\n".join(lines + [credit]) + "\n")
    print(f"✓ {name} {w}x{h} · crédito anotado")

def cmd_list(a):
    d = (find_video(a.id) or sys.exit(f"no existe el video {a.id}")) / "assets" / "media"
    from PIL import Image
    for p in sorted(d.glob("*")):
        if p.suffix.lower() in (".jpg", ".png", ".jpeg", ".webp"): print(f"{p.name:28} {Image.open(p).size}")
    print((d / "CREDITS.md").read_text() if (d / "CREDITS.md").exists() else "(sin CREDITS.md)")

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sp = ap.add_subparsers(dest="cmd", required=True)
    p = sp.add_parser("search"); p.add_argument("query"); p.add_argument("--n", type=int, default=8); p.add_argument("--source", default="commons", choices=["commons", "pexels"])
    p = sp.add_parser("get"); p.add_argument("id"); p.add_argument("ref"); p.add_argument("name"); p.add_argument("--force", action="store_true")
    p = sp.add_parser("list"); p.add_argument("id")
    a = ap.parse_args(); globals()["cmd_" + a.cmd](a)

if __name__ == "__main__":
    main()

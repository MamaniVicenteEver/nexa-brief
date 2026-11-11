#!/usr/bin/env python3
"""medios.py · imágenes con licencia libre para un video noticiero (retratos, lugares, objetos). Wikimedia Commons.

  # 1) buscar candidatos (no descarga nada): imprime título, tamaño, licencia (OK/NO), autor
  python3 <_atlas>/noticiero/tools/medios.py --buscar "Santiago Peña president portrait"  [--n 10]

  # 2) descargar lo que el plan pide: lee <episodio>/work/medios-necesarios.json
  python3 <_atlas>/noticiero/tools/medios.py <carpeta-del-episodio> [--solo trump.jpg,pena.jpg] [--ancho 1400]

work/medios-necesarios.json  (lista, o {"medios": [...]}):
  Banderas: {"file": "assets/media/flag-py.svg", "rol": "flag", "commons": "File:Flag of Paraguay.svg", "que": "Bandera de Paraguay"}  (SVG original)
  {"file": "assets/media/pena.jpg", "que": "Retrato de Santiago Peña, presidente de Paraguay",
   "rol": "portrait", "busqueda": "Santiago Peña president", "alternativas": ["Santiago Peña Paraguay 2024"],
   "commons": "File:President Santiago Peña.jpg"}      # «commons» opcional: título exacto si ya lo conoces

Escribe assets/media/<archivo> y assets/media/credits.json (autor, licencia, URL, fecha) y work/results/media-informe.md.
Solo acepta CC0, dominio público, CC BY, CC BY-SA y afines; rechaza NC/ND/fair use y lados menores de 500 px.
Funciona con la ruta del episodio (no necesita que el video esté registrado, a diferencia de explainer-kit/tools/media.py).
Revisa SIEMPRE las imágenes a ojo: la licencia es correcta, pero el pie de Commons a veces trae persona o fecha erróneas.
Derivado de nodeatlas/atlas-en-movimiento/tools/media-fetch.py.
"""
import json, os, re, sys, time, urllib.parse, urllib.request

API = "https://commons.wikimedia.org/w/api.php"
UA = "NodePoliticsNoticiero/1.0 (resumen noticiero educativo; verificacion de licencias)"
FREE = re.compile(r"^(cc0|cc[- ]by|cc[- ]by[- ]sa|public domain|pd|ogl|gfdl|attribution|copyrighted free use|no restrictions)", re.I)
BAD = re.compile(r"(nc|nd|fair use|all rights reserved)", re.I)
ancho = 1400


def get(url, binary=False):
    last = None
    for i in range(6):
        try:
            time.sleep(1.2)  # ritmo amable: Commons limita con 429
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": UA}), timeout=60) as r:
                d = r.read()
                return d if binary else json.loads(d)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(10 * (i + 1) if "429" in str(e) else 2 * (i + 1))
    raise last


def api(**p):
    return get(API + "?" + urllib.parse.urlencode({"format": "json", **p}))


def info(titles):
    j = api(action="query", titles="|".join(titles), prop="imageinfo", iiprop="url|size|mime|extmetadata", iiurlwidth=ancho)
    return list(j.get("query", {}).get("pages", {}).values())


def plain(s):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]*>", " ", s or "")).strip()


def evalua(pg, svg=False):
    """(ii, meta, licencia, motivo_rechazo|None). svg=True solo para banderas (rol «flag»): se baja el SVG original."""
    ii = (pg.get("imageinfo") or [{}])[0]
    meta = ii.get("extmetadata", {})
    lic = plain(meta.get("LicenseShortName", {}).get("value", ""))
    es_svg = "svg" in ii.get("mime", "")
    if not ii or ii.get("mime", "").split("/")[0] != "image" or (es_svg and not svg):
        return ii, meta, lic, "no es imagen raster"
    if not es_svg and min(ii.get("width", 0), ii.get("height", 0)) < 500:
        return ii, meta, lic, "menor de 500 px"
    if not lic or BAD.search(lic) or not FREE.search(lic):
        return ii, meta, lic, f"licencia no aceptada ({lic or 'sin licencia'})"
    return ii, meta, lic, None


def buscar(q, n=10):
    j = api(action="query", list="search", srnamespace=6, srlimit=n, srsearch=q)
    titles = [x["title"] for x in j.get("query", {}).get("search", [])]
    for i in range(0, len(titles), 6):
        for pg in info(titles[i:i + 6]):
            ii, meta, lic, why = evalua(pg)
            print(("OK " if not why else "NO ") + pg["title"], f"{ii.get('width', '?')}x{ii.get('height', '?')}", lic or "-",
                  "·", plain(meta.get("Artist", {}).get("value", ""))[:40], "" if not why else f"[{why}]")


def descargar(EP, solo):
    os.makedirs(EP + "/assets/media", exist_ok=True)
    cp = EP + "/assets/media/credits.json"
    creds = json.load(open(cp)) if os.path.exists(cp) else {}
    todo = json.load(open(EP + "/work/medios-necesarios.json"))
    todo = todo.get("medios", todo) if isinstance(todo, dict) else todo
    informe = ["# Informe de medios", ""]
    for m in todo:
        name = os.path.basename(m["file"])
        if solo and name not in solo:
            continue
        try:
            if os.path.exists(f"{EP}/{m['file']}") and name in creds:
                informe.append(f"- OK (ya estaba) {name}"); continue
            cand = []
            if m.get("commons"):
                cand = [m["commons"] if m["commons"].startswith("File:") else "File:" + m["commons"]]
            else:
                for q in [m.get("busqueda", "")] + m.get("alternativas", []):
                    if not q:
                        continue
                    j = api(action="query", list="search", srnamespace=6, srlimit=12, srsearch=q)
                    cand += [x["title"] for x in j.get("query", {}).get("search", [])]
                    if len(cand) >= 8:
                        break
            got = None
            bandera = m.get("rol") == "flag" or name.lower().endswith(".svg")
            for i in range(0, len(cand), 6):
                pages = {p["title"]: p for p in info(cand[i:i + 6])}
                for t in cand[i:i + 6]:
                    if t in pages:
                        ii, meta, lic, why = evalua(pages[t], svg=bandera)
                        if not why:
                            got = (t, ii, meta, lic); break
                if got:
                    break
            if not got:
                informe.append(f"- FALTA {name} ({m.get('que', '')}): sin candidato con licencia libre; otra búsqueda, fuente oficial o silueta")
                continue
            t, ii, meta, lic = got
            data = get(ii["url"] if name.lower().endswith(".svg") else (ii.get("thumburl") or ii["url"]), binary=True)
            open(f"{EP}/{m['file']}", "wb").write(data)
            creds[name] = {"file": m["file"], "title": t, "author": plain(meta.get("Artist", {}).get("value", "")) or "desconocido",
                           "license": lic, "license_url": plain(meta.get("LicenseUrl", {}).get("value", "")),
                           "source_url": ii.get("descriptionurl", ""), "description": plain(meta.get("ImageDescription", {}).get("value", ""))[:240],
                           "fetched": time.strftime("%Y-%m-%d"), "bytes": len(data), "que": m.get("que", "")}
            informe.append(f"- OK {name} <- {t} ({lic}; {creds[name]['author'][:50]})")
        except Exception as e:  # noqa: BLE001
            informe.append(f"- ERROR {name}: {type(e).__name__} {str(e)[:80]}")
        json.dump(creds, open(cp, "w"), ensure_ascii=False, indent=1)
    os.makedirs(EP + "/work/results", exist_ok=True)
    open(EP + "/work/results/media-informe.md", "w").write("\n".join(informe) + "\n")
    print("\n".join(informe))


if __name__ == "__main__":
    a = sys.argv[1:]
    if "--ancho" in a:
        ancho = int(a[a.index("--ancho") + 1])
    if a and a[0] == "--buscar":
        n = int(a[a.index("--n") + 1]) if "--n" in a else 10
        buscar(a[1], n)
    elif a:
        solo = set(a[a.index("--solo") + 1].split(",")) if "--solo" in a else None
        descargar(a[0].rstrip("/"), solo)
    else:
        print(__doc__)

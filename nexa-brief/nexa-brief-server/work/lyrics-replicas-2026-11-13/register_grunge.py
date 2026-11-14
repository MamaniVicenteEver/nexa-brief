"""Registro de lyrics-grunge-rojo (2026-11-14). Idempotente: no duplica entradas."""
import copy
import json
import shutil
from pathlib import Path

ROOT = Path.cwd()
PROFILE_NICHES = Path("/home/alfred/.local/share/nexa-brief/profiles/profesional/config/niches.json")
TEMPLATES = ROOT / "src/templates/templates.json"

TEXTS_COMMON = [
    {"key": "intro.title", "label": "Título en la intro", "max": 40, "default": ""},
    {"key": "intro.artist", "label": "Artista en la intro", "max": 40, "default": ""},
    {"key": "outro.title", "label": "Título del cierre", "max": 24, "default": "Gracias"},
    {"key": "outro.sub", "label": "Subtítulo del cierre", "max": 24, "default": "por ver"},
    {"key": "outro.feats", "label": "Línea final del cierre", "max": 40, "default": "Suscríbete · NodeMotion"},
]

ENTRIES = {
    "lyrics-grunge-rojo": {
        "display_name": "Grunge Rojo",
        "description": "Grunge de rap con metraje urbano en blanco y negro duro: papel gris rasgado, letra condensada blanca y roja que entra con estela, palabras gigantes con eco rojo, frases repetidas en filas, bloques anchos sobre papel, iconos de reproductor, tiza blanca y pincel rojo (círculos, tachones, flechas, coronas), glitch y destellos; en los silencios largos repasa frases ya cantadas — para rap, trap y drill.",
        "runtime_assets": ["player.js", "components", "assets/fonts", "assets/media"],
        "sort_order": 45,
        "tags": ["lyrics", "music-video", "grunge", "kinetic"],
        "media": [{"slot": "videos", "kind": "video", "min": 0, "max": 6, "target": "media", "label": "Videos (opcional)",
                   "hint": "Metraje urbano: calle, baile, multitud, retrato; mejor en blanco y negro o de alto contraste. Si no subes nada, se usan los de la plantilla."}],
        "texts": TEXTS_COMMON,
        "niche": ("lyrics_video_grunge_rojo", "Video de Letras — Grunge Rojo", "urban"),
    },
}


def catalog_entry(tid, e):
    base = f"nodemotion/lyrics/{tid}"
    return {
        "folder": base, "display_name": e["display_name"], "description": e["description"], "native_orientation": "any",
        "index_html": f"{base}/index.html", "config_json": f"{base}/assets/config.json", "vision_prompt": None, "config_prompt": None,
        "remotion_component": None, "runtime_assets": e["runtime_assets"], "category_id": "lyrics", "sort_order": e["sort_order"],
        "status": "ready", "tags": e["tags"], "requires_image": False, "requires_video": False, "requires_lyrics": True, "static_config": True,
        "inputs": {"audio": {"required": True, "lyrics": "auto"}, "media": e["media"], "texts": e["texts"], "brief": False},
    }


def register_catalog():
    text = TEMPLATES.read_text(encoding="utf-8")
    data = json.loads(text)["templates"]
    anchor = '    "lyrics-impact": {\n'
    assert anchor in text
    block = ""
    for tid, e in ENTRIES.items():
        if tid in data:
            continue
        body = json.dumps(catalog_entry(tid, e), ensure_ascii=False, indent=2)
        block += f'    "{tid}": ' + body.replace("\n", "\n    ") + ",\n"
    if block:
        text = text.replace(anchor, block + anchor, 1)
        json.loads(text)  # sigue siendo JSON válido
        TEMPLATES.write_text(text, encoding="utf-8")
    print("templates.json", "añadidas" if block else "ya estaban")


def register_niches(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    niches = data["niches"]
    caution = next(v for v in niches.values() if v.get("template", {}).get("template_id") == "lyrics-caution")
    letras = data["categories"]["node_motion"]["children"]["letras"]["niches"]
    for tid, e in ENTRIES.items():
        nid, name, genre = e["niche"]
        if nid not in niches:
            n = copy.deepcopy(caution)
            n.update(id=nid, display_name=name, description=e["description"])
            n["template"]["template_id"] = tid
            n["audio"]["genre"] = genre
            n["publishing"]["accounts"] = []
            niches[nid] = n
        if nid not in letras:
            letras.append(nid)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(path, "ok")


def register_tokens():
    p = ROOT / "src/templates/nodemotion/design-tokens.json"
    data = json.loads(p.read_text(encoding="utf-8"))
    t = data["templates"]
    t.setdefault("lyrics-grunge-rojo", {"display": "Anton", "displayB": "Anton", "weight": 400, "weightB": 400, "slant": "normal", "style": "grunge-rojo",
                                        "roles": {"background": "black", "foreground": "white", "accent": "red", "subtitle": "red"},
                                        "rolesB": {"foreground": "red"},
                                        "fallback": {"background": "#070707", "foreground": "#F1F1EF", "accent": "#E8292E"}})
    p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("design-tokens ok")


def register_fonts(src_dir):
    root = ROOT / "src/templates/nodemotion/assets/fonts"
    idx_path = root / "index.json"
    idx = json.loads(idx_path.read_text(encoding="utf-8"))
    sample = next(iter(idx.values()))
    print("formato índice:", sample)
    for ident, family, weight, file, lic in [
        ("permanent-marker-normal-400", "Permanent Marker", 400, "permanent-marker-normal-400.ttf", "permanentmarker-LICENSE.txt"),
        ("archivo-condensed-normal-800", "Archivo Condensed", 800, "archivo-condensed-normal-800.ttf", "archivocondensed-LICENSE.txt"),
    ]:
        if ident in idx:
            continue
        shutil.copy2(src_dir / file, root / file)
        shutil.copy2(src_dir / lic, root / lic)
        entry = {"family": family, "weight": weight, "style": "normal", "file": file}
        if family == "Permanent Marker":
            entry.update(source="https://fonts.googleapis.com/css2?family=Permanent+Marker", license="https://raw.githubusercontent.com/google/fonts/main/apache/permanentmarker/LICENSE.txt")
        else:
            # instancia estática wdth=68 wght=800 de Archivo variable (fontTools varLib.instancer), subconjunto latino
            entry.update(source="https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/Archivo%5Bwdth,wght%5D.ttf", license="https://raw.githubusercontent.com/google/fonts/main/ofl/archivo/OFL.txt")
        idx[ident] = entry
    idx_path.write_text(json.dumps(idx, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("fonts index ok")


if __name__ == "__main__":
    import sys
    register_catalog()
    register_niches(ROOT / "niches.json")
    register_niches(PROFILE_NICHES)
    register_tokens()

"""Alta de promo-mono (2026-11-14) en catálogo, nichos (repo y perfil) y tokens. Idempotente; solo añade."""
import copy, json
from pathlib import Path

ROOT = Path.cwd()
TEMPLATES = ROOT / "src/templates/templates.json"
PROFILE_NICHES = Path("/home/alfred/.local/share/nexa-brief/profiles/profesional/config/niches.json")
TID, NID = "promo-mono", "promo_video_mono"
DESC = ("Promo de marca o servicio con interfaz minimalista en blanco y negro: logotipo, botón de reproducir, "
        "abanico de tarjetas y metraje en semitono, palabra partida por ventanas de video, lluvias de píldoras de texto, "
        "línea que se vuelve garabato, píldora con pin, cifras que parpadean, patrón óptico, texto espaciado, móvil con "
        "chat, cupones, campo de código y contacto final; 15 escenas reutilizables y 2 cierres.")
ENTRY = {
    "folder": f"nodemotion/commercial/{TID}", "display_name": "Promo Mono", "description": DESC, "native_orientation": "any",
    "index_html": f"nodemotion/commercial/{TID}/index.html", "config_json": f"nodemotion/commercial/{TID}/assets/config.json",
    "vision_prompt": None, "config_prompt": None, "remotion_component": None, "runtime_assets": ["assets/media", "components"],
    "category_id": "commercial", "sort_order": 36, "status": "ready", "tags": ["commercial", "promo", "brand-video", "minimal", "ui"],
    "requires_image": False, "requires_video": False, "requires_lyrics": True, "static_config": True,
    "inputs": {
        "audio": {"required": False, "lyrics": "optional"},
        "media": [{"slot": "clips", "kind": "video", "min": 1, "max": 12, "target": "media", "label": "Videos",
                   "hint": "personas en movimiento o actividades del tema; se muestran en blanco y negro y en semitono"}],
        "texts": [
            {"key": "brand.name", "label": "Marca (logotipo)", "max": 24, "default": "Rutalia"},
            {"key": "brand.cta", "label": "Llamada en la píldora", "max": 30, "default": "Míralo y ve"},
            {"key": "brand.url", "label": "Dirección o usuario", "max": 40, "default": "@rutalia.demo"},
            {"key": "intro.title", "label": "Título de la intro", "max": 24, "default": "Rutalia"},
            {"key": "outro.title", "label": "Título del cierre", "max": 24, "default": "Rutalia"},
            {"key": "outro.cta", "label": "Llamada del cierre", "max": 30, "default": "Míralo y ve"},
        ],
        "brief": False,
    },
}

text = TEMPLATES.read_text(encoding="utf-8")
if TID not in json.loads(text)["templates"]:
    anchor = '    "promo-pulse": {\n'
    assert anchor in text
    body = json.dumps(ENTRY, ensure_ascii=False, indent=2).replace("\n", "\n    ")
    text = text.replace(anchor, f'    "{TID}": {body},\n' + anchor, 1)
    json.loads(text)
    TEMPLATES.write_text(text, encoding="utf-8")
    print("templates.json: añadida")

for path in (ROOT / "niches.json", PROFILE_NICHES):
    data = json.loads(path.read_text(encoding="utf-8"))
    niches = data["niches"]
    base = niches["promo_video_pulse"]
    if NID not in niches:
        n = copy.deepcopy(base)
        n.update(id=NID, display_name="Promo — Mono", description=DESC)
        n["template"]["template_id"] = TID
        n.setdefault("publishing", {})["accounts"] = []
        niches[NID] = n
    lst = data["categories"]["node_motion"]["children"]["promos"]["niches"]
    if NID not in lst:
        lst.append(NID)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(path, "ok")

p = ROOT / "src/templates/nodemotion/design-tokens.json"
data = json.loads(p.read_text(encoding="utf-8"))
data["templates"].setdefault(TID, {"display": "Inter Tight", "displayB": "Inter Tight", "weight": 800, "weightB": 800, "slant": "normal", "style": "promo-mono",
                                   "roles": {"background": "bg", "foreground": "fg", "accent": "fg", "subtitle": "muted"}})
p.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print("design-tokens ok")

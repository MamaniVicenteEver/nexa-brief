"""Apertura del video = la miniatura elegida (publish.json v2 → thumbnail).

La miniatura de YouTube y el primer plano del video son la MISMA imagen: la opción A
(`<diseño>.introv1`, solo texto), B (`<diseño>.introv2`, texto + foto) o C (`common.tabloid`). La que se elige
(`thumbnail.chosen`) abre el video y su captura es la miniatura (src/core/explainer/thumbnails.py).
En TikTok/Reels, donde no hay miniatura, ese primer cuadro hace de título.

Cambiar la opción reescribe el beat 0 del storyboard y borra los renders: tenían la otra apertura
y el grabador los reutilizaría.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal

from src.core.explainer.catalog import KIT_DIR, TEMPLATES_DIR
from src.core.explainer.publishing.package import PublishPackage
from src.core.explainer.narrative.video import recorded

Option = Literal["A", "B", "C"]
OPTIONS: tuple[Option, ...] = ("A", "B", "C")
COMPONENT: dict[str, str] = {"A": "introv1", "B": "introv2", "C": "common.tabloid"}
CHOSEN_TO_OPTION: dict[str, Option] = {"text_only": "A", "with_image": "B", "tabloid": "C"}
OPTION_TO_CHOSEN: dict[str, str] = {v: k for k, v in CHOSEN_TO_OPTION.items()}
# Componentes que pueden abrir un video (beat 0): el título clásico o una de las intros.
OPENING_SUFFIXES = ("title", "introv1", "introv2", "tabloid")


class OpeningError(ValueError):
    """La apertura no se puede aplicar a este video (diseño sin intros, storyboard inesperado)."""


@dataclass
class OpeningResult:
    changed: bool
    removed_renders: list[str] = field(default_factory=list)


def kit_catalog() -> dict[str, dict]:
    """Componentes del kit por nombre (params con tipo y doc): cada diseño hizo sus intros a su manera."""
    return {c["name"]: c for c in json.loads((KIT_DIR / "catalog.json").read_text(encoding="utf-8"))["comps"]}


def intro_params(component: dict, text: str, kicker: str, highlight: str = "",
                 image_src: str = "", image_side: str = "auto") -> dict:
    """Los params de la intro de UN diseño, según lo que esa intro acepta.

    binary/rough: `highlight`, `textPortrait`, foto al costado (`src` + `imageSide`).
    Los diseños del contrato common/hook.js (acuarela, carta, collage…): el resaltado va en el texto
    como `^palabra^` y la foto es el fondo (`bg: "image"` + `src`).
    """
    accepted = component["params"]
    params = {"text": text, "kicker": kicker}
    if "textPortrait" in accepted:
        params["textPortrait"] = text
    if highlight:
        if "highlight" in accepted:
            params["highlight"] = highlight
        elif "^x^" in accepted["text"].get("doc", "") and highlight in text:
            params["text"] = text.replace(highlight, f"^{highlight}^", 1)
    if image_src:
        params["src"] = image_src
        if "imageSide" in accepted:
            params["imageSide"] = image_side
        elif "bg" in accepted:
            params["bg"] = "image"
    return params


def design_of(video_dir: Path) -> str:
    raw = json.loads((video_dir / "assets" / "config.json").read_text(encoding="utf-8"))
    return (raw["configs"][0] if "configs" in raw else raw).get("design", "binary")


def media_src(video_dir: Path, image: str) -> str:
    """Ruta de una foto del video para el escenario y el motor (absoluta desde src/templates/)."""
    return "/" + (video_dir / "assets" / "media" / image).relative_to(TEMPLATES_DIR).as_posix()


def validate_tabloid_photo(package: PublishPackage, video_dir: Path) -> None:
    tabloid = package.thumbnail.tabloid
    if tabloid:
        for name in ("image", "image_after"):
            filename = getattr(tabloid, name)
            if filename and not (video_dir / "assets" / "media" / filename).is_file():
                raise OpeningError(f"{video_dir.name}: falta la foto {filename} de la miniatura C en assets/media/")


def opening_specs(package: PublishPackage, video_dir: Path, design: str) -> dict[str, dict]:
    """{opción: {component, params}} de las aperturas/miniaturas que este paquete puede tener."""
    catalog = kit_catalog()
    v1, v2 = catalog.get(f"{design}.introv1"), catalog.get(f"{design}.introv2")
    if v1 is None:
        return {}
    thumb = package.thumbnail
    specs = {"A": {"component": v1["name"],
                   "params": intro_params(v1, "\n".join(thumb.text_only.lines), thumb.kicker, thumb.text_only.highlight)}}
    image = thumb.with_image.image
    if image and (video_dir / "assets" / "media" / image).is_file() and v2 is not None:
        specs["B"] = {"component": v2["name"],
                      "params": intro_params(v2, thumb.with_image.text, thumb.kicker, image_src=media_src(video_dir, image),
                                             image_side=thumb.with_image.image_side)}
    tabloid = thumb.tabloid
    if tabloid is None and thumb.chosen != "tabloid" and recorded(video_dir).narrative_id != "narrative_amarillista_v1":
        return specs
    tabloid_image = tabloid.image if tabloid is not None else image
    try:
        validate_tabloid_photo(package, video_dir)
    except OpeningError:
        return specs
    tabloid_text = (tabloid.text.strip() if tabloid is not None else "") or thumb.text_only.text
    tabloid_params = {
        "text": tabloid_text,
        "mode": tabloid.mode if tabloid is not None else "impact",
        "accent": tabloid.accent if tabloid is not None else "",
        "bullet": tabloid.bullet if tabloid is not None else "",
        "bulletScale": tabloid.bullet_scale if tabloid is not None else 1,
        "beforeLabel": tabloid.before_label if tabloid is not None else "",
        "afterLabel": tabloid.after_label if tabloid is not None else "",
        "strap": tabloid.strap if tabloid is not None else thumb.kicker,
        "seal": tabloid.seal if tabloid is not None else "",
        "tapeText": tabloid.tape_text if tabloid is not None else "",
        "marker": tabloid.marker if tabloid is not None else False,
        "target": list(tabloid.target) if tabloid is not None else [0.72, 0.52],
        "focus": list(tabloid.focus) if tabloid is not None and tabloid.focus is not None else None,
    }
    if tabloid is not None and tabloid.palette != "brand":
        tabloid_params["palette"] = tabloid.palette
    if tabloid_image and (video_dir / "assets" / "media" / tabloid_image).is_file():
        tabloid_params["src"] = media_src(video_dir, tabloid_image)
        tabloid_params["imageSide"] = tabloid.image_side if tabloid is not None else thumb.with_image.image_side
    if tabloid and tabloid.image_after:
        tabloid_params["srcAfter"] = media_src(video_dir, tabloid.image_after)
    specs["C"] = {"component": "common.tabloid", "params": tabloid_params}
    return specs


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _write(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def apply_opening(video_dir: Path, package: PublishPackage) -> OpeningResult:
    """Pone la miniatura elegida como beat 0 (conserva su `until`/`at`) y como título del guion."""
    design = design_of(video_dir)
    option = CHOSEN_TO_OPTION[package.thumbnail.chosen]
    if option == "C":
        validate_tabloid_photo(package, video_dir)
    specs = opening_specs(package, video_dir, design)
    if option not in specs:
        raise OpeningError(f"{video_dir.name}: la miniatura {option} no está disponible (¿falta la foto de la opción B o el diseño no tiene intros?)")
    spec = specs[option]

    storyboard_path, script_path = video_dir / "assets" / "storyboard.json", video_dir / "assets" / "script.json"
    storyboard, script = _read(storyboard_path), _read(script_path)
    beats = storyboard.get("beats") or []
    if not beats or beats[0].get("t") != 0:
        raise OpeningError(f"{video_dir.name}: el storyboard no empieza con un beat en t=0")
    opening = beats[0]
    if opening.get("use", "").split(".")[-1] not in OPENING_SUFFIXES:
        raise OpeningError(f"{video_dir.name}: el beat 0 usa «{opening.get('use')}», no un cartel de apertura")
    params = spec["params"]
    if option == "C" and opening.get("use") == "common.tabloid":
        # La portada C viene del paquete; el clip y su entrada viven en el storyboard.
        video_keys = ("video", "poster", "start", "rate", "loop", "muted", "textIn", "stagger", "accentIn", "bulletIn", "inDuration")
        params = {**params, **{key: opening.get("params", {}).get(key) for key in video_keys if key in opening.get("params", {})}}
    new_opening = {**opening, "use": spec["component"], "params": params}
    lines = spec["params"]["text"].replace("\n", " ").replace("^", "")   # sin la marca de resaltado de los diseños
    new_script = {**script, "title": lines, "kicker": package.thumbnail.kicker, "subtitle": ""}
    changed = new_opening != opening or new_script != script
    if not changed:
        return OpeningResult(changed=False)

    beats[0] = new_opening
    _write(storyboard_path, storyboard)
    _write(script_path, new_script)
    render_dir = video_dir / "render"
    stale = sorted(render_dir.glob("*.mp4")) + sorted((render_dir / "preview").glob("*.mp4"))
    for path in stale:
        path.unlink()
    return OpeningResult(changed=True, removed_renders=[str(p.relative_to(video_dir)) for p in stale])

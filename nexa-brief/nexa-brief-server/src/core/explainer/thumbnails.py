"""Miniaturas de YouTube de los videos explainer = captura de la apertura del video.

Opción A = `<diseño>.introv1` (solo texto) y opción B = `<diseño>.introv2` (texto + foto).
En los paquetes v2 (NodeTech) la miniatura elegida es además la apertura del video
(publishing/opening.py): elegir otra reescribe el beat 0 y obliga a grabar de nuevo.
En publish.json v1 los textos salen de `thumbnail_text` + el kicker del guion y la opción B
usa `thumbnail_image` (archivo de assets/media/) y `thumbnail_image_side`; ahí la miniatura
no cambia la apertura del video.

La elegida se sube a YouTube al publicar (`thumbnail_file`). Las capturas quedan en
`render/thumbnail-A.jpg` / `render/thumbnail-B.jpg`.
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

from src.config.settings import BASE_DIR
from src.core.explainer.catalog import KIT_DIR, ExplainerVideo
from src.core.explainer.publishing import service
from src.core.explainer.publishing.opening import (
    CHOSEN_TO_OPTION,
    OPTION_TO_CHOSEN,
    OPTIONS,
    Option,
    intro_params,
    kit_catalog,
    media_src,
    opening_specs,
)
from src.core.explainer.publishing.store import PUBLISH_FILE, load_package, read_publish, save_package
from src.core.explainer.publishing.strategies import active_strategies

TOOL = KIT_DIR / "tools" / "thumbnail.py"


class ThumbnailError(ValueError):
    """La miniatura no se puede generar o elegir para este video."""


def thumbnail_file(video: ExplainerVideo, option: Option | None = None) -> Path:
    return video.path / "render" / f"thumbnail-{option or chosen_option(video)}.jpg"


def _kicker(video: ExplainerVideo) -> str:
    script_path = video.path / "assets" / "script.json"
    return json.loads(script_path.read_text(encoding="utf-8")).get("kicker", "") if script_path.exists() else ""


def intro_specs(video: ExplainerVideo) -> dict[str, dict]:
    """{opción: {component, params}} de las miniaturas que este video puede tener."""
    package = load_package(video.path)
    if package is not None:
        return opening_specs(package, video.path, video.design)
    catalog = kit_catalog()
    v1, v2 = catalog.get(f"{video.design}.introv1"), catalog.get(f"{video.design}.introv2")
    publish = read_publish(video.path)
    text = (publish.get("thumbnail_text") or video.title or "").strip()
    if v1 is None or not text:
        return {}
    specs = {"A": {"component": v1["name"], "params": intro_params(v1, text, _kicker(video))}}
    image = publish.get("thumbnail_image") or ""
    if image and (video.path / "assets" / "media" / image).is_file() and v2 is not None:
        specs["B"] = {"component": v2["name"],
                      "params": intro_params(v2, text, _kicker(video), image_src=media_src(video.path, image),
                                             image_side=publish.get("thumbnail_image_side") or "auto")}
    return specs


def chosen_option(video: ExplainerVideo) -> Option:
    package = load_package(video.path)
    if package is not None:
        return CHOSEN_TO_OPTION[package.thumbnail.chosen]  # type: ignore[return-value]
    return "B" if read_publish(video.path).get("thumbnail_option") == "B" else "A"


def choose(video: ExplainerVideo, option: Option) -> None:
    """Guarda la miniatura elegida en publish.json; en un paquete v2 además pasa a ser la apertura del video."""
    if option not in intro_specs(video):
        raise ThumbnailError(f"{video.video_id}: la miniatura {option} no está disponible (¿falta la foto de la opción B?)")
    package = load_package(video.path)
    if package is not None:
        if OPTION_TO_CHOSEN[option] == package.thumbnail.chosen:
            return
        updated = package.model_copy(update={"thumbnail": package.thumbnail.model_copy(update={"chosen": OPTION_TO_CHOSEN[option]})})
        save_package(video.path, updated, active_strategies(updated.category))
        service.build(video)   # la elegida abre el video: beat 0, guion, manifest, portada y renders viejos
        return
    data = read_publish(video.path)
    data["thumbnail_option"] = option
    (video.path / PUBLISH_FILE).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def render(video: ExplainerVideo, options: tuple[Option, ...] = OPTIONS) -> dict[str, Path]:
    """Captura las miniaturas pedidas (las que el video puede tener) → {opción: archivo}."""
    specs = intro_specs(video)
    done: dict[str, Path] = {}
    for option in options:
        spec = specs.get(option)
        if spec is None:
            continue
        out = thumbnail_file(video, option)
        proc = await asyncio.create_subprocess_exec(
            sys.executable, str(TOOL), str(out), "--design", video.design, "--component", spec["component"],
            "--params", json.dumps(spec["params"], ensure_ascii=False),
            cwd=str(BASE_DIR), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
        )
        log, _ = await proc.communicate()
        if proc.returncode or not out.exists():
            raise ThumbnailError(f"no se pudo capturar la miniatura {option}: {log.decode('utf-8', 'replace')[-400:]}")
        done[option] = out
    return done


async def ensure(video: ExplainerVideo, option: Option) -> Path:
    """La miniatura `option`, capturándola si todavía no existe."""
    path = thumbnail_file(video, option)
    if not path.exists():
        await render(video, (option,))
    if not path.exists():
        raise ThumbnailError(f"{video.video_id}: la miniatura {option} no está disponible")
    return path

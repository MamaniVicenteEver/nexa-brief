"""Miniaturas de YouTube de los videos explainer = captura de la apertura del video.

Opción A = `<diseño>.introv1` (solo texto), B = `<diseño>.introv2` (texto + foto) y C = `common.tabloid`.
En los paquetes v2 (NodeTech) la miniatura elegida es además la apertura del video
(publishing/opening.py): elegir otra reescribe el beat 0 y obliga a grabar de nuevo.
En publish.json v1 los textos salen de `thumbnail_text` + el kicker del guion y la opción B
usa `thumbnail_image` (archivo de assets/media/) y `thumbnail_image_side`; ahí la miniatura
no cambia la apertura del video.

La elegida se sube a YouTube al publicar (`thumbnail_file`). Las capturas quedan en
`render/thumbnail-A.jpg`, `render/thumbnail-B.jpg` y `render/thumbnail-C.jpg`.
"""

from __future__ import annotations

import asyncio
import os
import signal
import hashlib
import json
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from urllib.parse import unquote, urlsplit

from src.adapters.data.file_locks import AsyncFileLock
from src.config.settings import BASE_DIR
from src.config.content_paths import content_key, preview_directory, resolve_content_key
from src.core.explainer.catalog import KIT_DIR, TEMPLATES_DIR, ExplainerVideo
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
    validate_tabloid_photo,
    OpeningError,
)
from src.core.explainer.publishing.package import PublishPackage
from src.core.explainer.publishing.store import PUBLISH_FILE, load_package, read_publish, save_package
from src.core.explainer.publishing.strategies import strategies_for_review

TOOL = KIT_DIR / "tools" / "thumbnail.py"


class ThumbnailError(ValueError):
    """La miniatura no se puede generar o elegir para este video."""


def thumbnail_file(video: ExplainerVideo, option: Option | None = None, orientation: str = "16x9") -> Path:
    if orientation not in ("16x9", "9x16"):
        raise ThumbnailError(f"orientación inválida: {orientation}")
    suffix = "-9x16" if orientation == "9x16" else ""
    root = getattr(video, "edition_path", None) or preview_directory(video.path)
    from src.core.explainer.editions.io import safe
    return safe(root, f"thumbnail-{option or chosen_option(video)}{suffix}.jpg")


def _capture_digest(video: ExplainerVideo, spec: dict) -> str:
    """Invalidate captures when their text, local media or component changes."""
    digest = hashlib.sha256(json.dumps(spec, sort_keys=True, ensure_ascii=False).encode())
    render_design = _spec_design(video, spec)
    design_file = KIT_DIR / "designs" / render_design / "design.json"
    design = json.loads(design_file.read_text(encoding="utf-8"))
    paths = [KIT_DIR / "designs/common/tabloid.js", design_file, TOOL,
             KIT_DIR / "engine/kit.js", KIT_DIR / "showcase/stage.html"]
    paths.extend(KIT_DIR / script for script in design.get("scripts", []))
    for path in paths:
        if path.is_file() and path.resolve().is_relative_to(KIT_DIR.resolve()):
            digest.update(path.read_bytes())
    for key in ("src", "srcAfter", "poster"):
        source = spec.get("params", {}).get(key)
        if not isinstance(source, str) or not source:
            continue
        parsed = urlsplit(source)
        if parsed.scheme or parsed.netloc:
            continue
        relative = unquote(parsed.path)
        try:
            if relative.startswith("/"):
                from src.config.profile_layout import layout_for_settings
                from src.config.settings import settings
                path = (resolve_content_key(relative.lstrip("/")) if layout_for_settings(settings).schema_version >= 2
                        else TEMPLATES_DIR / relative.lstrip("/"))
            else:
                path = video.path / relative
        except ValueError:
            continue
        if (path.resolve().is_relative_to(TEMPLATES_DIR.resolve()) or path.resolve().is_relative_to(video.path.resolve())) and path.is_file():
            stat = path.stat()
            digest.update(f"{source}:{stat.st_mtime_ns}:{stat.st_size}".encode())
    return digest.hexdigest()


def capture_current(video: ExplainerVideo, option: Option, spec: dict) -> bool:
    path = thumbnail_file(video, option)
    if not path.is_file():
        return False
    stamp = path.with_suffix(".sha256")
    digest = _capture_digest(video, spec)
    return stamp.is_file() and stamp.read_text(encoding="utf-8").strip() == digest


def _kicker(video: ExplainerVideo) -> str:
    script_path = video.path / "assets" / "script.json"
    return json.loads(script_path.read_text(encoding="utf-8")).get("kicker", "") if script_path.exists() else ""


def _spec_design(video: ExplainerVideo, spec: dict) -> str:
    return str(spec.get("design") or video.design)


def _legacy_atlas_specs(video: ExplainerVideo, publish: dict) -> dict[str, dict]:
    """Renderiza variantes antiguas de Atlas como miniaturas sin cambiar la apertura."""
    if video.design not in {"atlas-en-movimiento", "mapas-satelitales"} and not video.design.startswith("sandbox-"):
        return {}
    variants = publish.get("thumbnail_variants")
    if not isinstance(variants, list):
        return {}

    poster = preview_directory(video.path) / "poster.jpg"
    poster_src = ""
    if poster.is_file():
        try:
            poster_src = "/" + content_key(poster)
        except ValueError:
            pass

    specs: dict[str, dict] = {}
    kicker = _kicker(video) or ("MAPAS SATELITALES" if video.design == "mapas-satelitales" else "ATLAS EN MOVIMIENTO")
    for variant in variants:
        if not isinstance(variant, dict):
            continue
        option = variant.get("option")
        if option not in OPTIONS:
            continue
        lines = variant.get("lines")
        lines = lines if isinstance(lines, list) else []
        text = str(variant.get("text") or "\n".join(line for line in lines if isinstance(line, str))).strip()
        if not text:
            continue
        params = {
            "text": text,
            "accent": str(variant.get("highlight") or ""),
            "strap": str(variant.get("strap", kicker)),
            "palette": "brand",
            "imageSide": "right",
            "textIn": "none",
            "accentIn": "none",
        }
        image = variant.get("image")
        image_path = video.path / "assets" / "media" / str(image) if image else None
        if image_path is not None and image_path.is_file():
            try:
                params["src"] = "/" + content_key(image_path)
            except ValueError:
                if poster_src:
                    params["src"] = poster_src
        elif poster_src:
            params["src"] = poster_src
        specs[option] = {"component": "common.tabloid", "design": "atlas", "params": params}
    return specs


def _atlas_package_specs(video: ExplainerVideo, package: PublishPackage) -> dict[str, dict]:
    """Adapta el paquete A/B/C al diseño Atlas legado sin tocar su apertura nativa."""
    if video.design not in {"atlas-en-movimiento", "mapas-satelitales"} and not video.design.startswith("sandbox-"):
        return {}
    thumb = package.thumbnail
    variants = [
        {
            "option": "A",
            "lines": thumb.text_only.lines,
            "highlight": thumb.text_only.highlight,
            "strap": "",
        },
        {
            "option": "B",
            "text": thumb.with_image.text,
            "image": thumb.with_image.image,
            "strap": "",
        },
    ]
    if thumb.tabloid is not None:
        variants.append({
            "option": "C",
            "text": thumb.tabloid.text,
            "highlight": thumb.tabloid.accent,
            "image": thumb.tabloid.image,
            "strap": "",
        })
    return _legacy_atlas_specs(video, {"thumbnail_variants": variants})


def intro_specs(video: ExplainerVideo) -> dict[str, dict]:
    """{opción: {component, params}} de las miniaturas que este video puede tener."""
    package = _package(video)
    if package is not None:
        atlas_specs = _atlas_package_specs(video, package)
        if atlas_specs:
            return atlas_specs
        return opening_specs(package, video.path, video.design)
    if getattr(video, "edition_path", None) is not None:
        return {}  # a missing native package must never borrow ES text
    catalog = kit_catalog()
    v1, v2 = catalog.get(f"{video.design}.introv1"), catalog.get(f"{video.design}.introv2")
    publish = read_publish(video.path)
    text = (publish.get("thumbnail_text") or video.title or "").strip()
    if v1 is None or not text:
        return _legacy_atlas_specs(video, publish)
    specs = {"A": {"component": v1["name"], "params": intro_params(v1, text, _kicker(video))}}
    image = publish.get("thumbnail_image") or ""
    if image and (video.path / "assets" / "media" / image).is_file() and v2 is not None:
        specs["B"] = {"component": v2["name"],
                      "params": intro_params(v2, text, _kicker(video), image_src=media_src(video.path, image),
                                             image_side=publish.get("thumbnail_image_side") or "auto")}
    return specs


def chosen_option(video: ExplainerVideo) -> Option:
    package = _package(video)
    if package is not None:
        return CHOSEN_TO_OPTION[package.thumbnail.chosen]  # type: ignore[return-value]
    chosen = read_publish(video.path).get("thumbnail_option") if getattr(video, "edition_path", None) is None else None
    if chosen in {"B", "C"} and (chosen == "B" or video.design in {"atlas-en-movimiento", "mapas-satelitales"} or video.design.startswith("sandbox-")):
        return chosen
    return "A"


def _validate_c(video: ExplainerVideo) -> None:
    package = _package(video)
    if package is not None:
        try:
            validate_tabloid_photo(package, video.path)
        except OpeningError as exc:
            raise ThumbnailError(str(exc)) from exc


def choose(video: ExplainerVideo, option: Option) -> None:
    """Guarda la miniatura elegida en publish.json; en un paquete v2 además pasa a ser la apertura del video."""
    if option == "C":
        _validate_c(video)
    if option not in intro_specs(video):
        raise ThumbnailError(f"{video.video_id}: la miniatura {option} no está disponible")
    package = _package(video)
    if package is not None:
        if OPTION_TO_CHOSEN[option] == package.thumbnail.chosen:
            return
        updated = package.model_copy(update={"thumbnail": package.thumbnail.model_copy(update={"chosen": OPTION_TO_CHOSEN[option]})})
        if getattr(video, "edition_path", None) is not None:
            from src.core.explainer.editions.packaging import apply_package
            apply_package(video, getattr(video, "edition_path", None), updated)
            return
        save_package(video.path, updated, strategies_for_review(video))
        service.build(video)   # la elegida abre el video: beat 0, guion, manifest, portada y renders viejos
        return
    data = read_publish(video.path)
    data["thumbnail_option"] = option
    (video.path / PUBLISH_FILE).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


async def render(
    video: ExplainerVideo, options: tuple[Option, ...] = OPTIONS, *, orientation: str = "16x9",
    only_missing: bool = False,
) -> dict[str, Path]:
    """Captura las miniaturas pedidas (las que el video puede tener) → {opción: archivo}."""
    async with AsyncFileLock((getattr(video, "edition_path", None) or preview_directory(video.path)) / ".thumbnails.lock"):
        if "C" in options:
            _validate_c(video)
        specs = intro_specs(video)
        done: dict[str, Path] = {}
        for option in options:
            spec = specs.get(option)
            if spec is None:
                continue
            out = thumbnail_file(video, option, orientation)
            digest = _capture_digest(video, spec)
            stamp = out.with_suffix(".sha256")
            if only_missing and out.is_file() and stamp.is_file() and stamp.read_text().strip() == digest:
                done[option] = out
                continue
            with TemporaryDirectory(prefix=".thumbnail-", dir=out.parent) as temporary:
                pending = Path(temporary) / out.name
                proc = await asyncio.create_subprocess_exec(
                    sys.executable, str(TOOL), str(pending), "--design", _spec_design(video, spec), "--component", spec["component"],
                    "--params", json.dumps(spec["params"], ensure_ascii=False),
                    "--orientation", orientation,
                    cwd=str(BASE_DIR), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT, start_new_session=True,
                )
                try:
                    log, _ = await asyncio.wait_for(proc.communicate(), timeout=180)
                except BaseException:
                    if proc.returncode is None:
                        try:
                            os.killpg(proc.pid, signal.SIGTERM)
                            await asyncio.wait_for(proc.wait(), timeout=10)
                        except asyncio.TimeoutError:
                            os.killpg(proc.pid, signal.SIGKILL)
                            await proc.wait()
                        except ProcessLookupError:
                            pass
                    raise
                if proc.returncode or not pending.is_file() or pending.stat().st_size == 0:
                    raise ThumbnailError(f"no se pudo capturar la miniatura {option}: {log.decode('utf-8', 'replace')[-400:]}")
                pending.replace(out)
                if pending.with_suffix(".webp").is_file():
                    pending.with_suffix(".webp").replace(out.with_suffix(".webp"))
                pending_stamp = Path(temporary) / stamp.name
                pending_stamp.write_text(digest, encoding="utf-8")
                pending_stamp.replace(stamp)
            done[option] = out
        return done


async def ensure(video: ExplainerVideo, option: Option) -> Path:
    """La miniatura `option`, capturándola si todavía no existe."""
    if option == "C":
        _validate_c(video)
    path = thumbnail_file(video, option)
    spec = intro_specs(video).get(option)
    if spec is None:
        raise ThumbnailError(f"{video.video_id}: la miniatura {option} no está disponible")
    if not capture_current(video, option, spec):
        await render(video, (option,))
    if not path.exists():
        raise ThumbnailError(f"{video.video_id}: la miniatura {option} no está disponible")
    return path


def _package(video):
    if getattr(video, "edition_path", None) is not None:
        from src.core.explainer.editions.packaging import load_native
        return load_native(getattr(video, "edition_path", None))
    return load_package(video.path)

"""Construye URLs para previsualizar componentes del explainer-kit aislados."""

from __future__ import annotations

import json
import re
from urllib.parse import quote, urlencode, urlparse

from src.core.explainer import sandbox, sandbox_info

from src.core.explainer.catalog import KIT_DIR, get_video

FILES_PREFIX = "/api/v1/explainer/files"
_COMPONENT_NAME = re.compile(r"^[a-z][a-z0-9_-]*\.[A-Za-z0-9]+$")
_DESIGN_ID = re.compile(r"^[a-z][a-z0-9_-]*$")


class ComponentPreviewError(ValueError):
    """Un video, diseño o componente no se puede previsualizar."""


def _registered_component(design_id: str, component: str) -> bool:
    if not _DESIGN_ID.fullmatch(design_id) or not _COMPONENT_NAME.fullmatch(component):
        return False
    if not component.startswith(f"{design_id}.") and not component.startswith("common."):
        return False

    design_path = (KIT_DIR / "designs" / design_id / "design.json").resolve()
    if not design_path.is_relative_to(KIT_DIR.resolve()) or not design_path.is_file():
        return False
    try:
        design = json.loads(design_path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return False

    needle = re.compile(r"\bname\s*:\s*['\"]" + re.escape(component) + r"['\"]")
    for script in design.get("scripts", []):
        script_path = (KIT_DIR / script).resolve()
        if not script_path.is_relative_to(KIT_DIR.resolve()) or not script_path.is_file():
            continue
        try:
            if needle.search(script_path.read_text(encoding="utf-8")):
                return True
        except OSError:
            continue
    return False


def _check_image_sources(params: dict) -> None:
    """El escenario acepta medios web o rutas del servidor, nunca esquemas ejecutables."""
    for key, value in params.items():
        if isinstance(value, dict):
            _check_image_sources(value)
        elif isinstance(value, list):
            for item in value:
                if isinstance(item, dict):
                    _check_image_sources(item)
                elif key.lower() in {"src", "image", "poster"} and isinstance(item, str):
                    _check_source(item)
        elif key.lower() in {"src", "image", "poster"} and isinstance(value, str):
            _check_source(value)


def _check_source(value: str) -> None:
    scheme = urlparse(value).scheme.lower()
    if scheme and scheme not in {"http", "https"}:
        raise ComponentPreviewError("Las imágenes de la vista previa deben usar HTTP(S) o una ruta local del servidor.")
    if value.startswith("//"):
        raise ComponentPreviewError("La vista previa no acepta imágenes con URL de protocolo relativo.")


def build_component_previews(previews: list) -> list[dict[str, str]]:
    """Resuelve varias definiciones en URLs del escenario aislado del kit."""
    output: list[dict[str, str]] = []
    for item in previews:
        if item.scope == "sandbox":
            output.append(_sandbox_preview(item))
            continue
        video = get_video(item.video_id)
        if video is None:
            raise ComponentPreviewError(f"No existe la plantilla «{item.video_id}».")
        if not _registered_component(video.design, item.component):
            raise ComponentPreviewError(
                f"El componente «{item.component}» no está registrado en el diseño «{video.design}»."
            )
        _check_image_sources(item.params)
        try:
            params = json.dumps(item.params, ensure_ascii=False, separators=(",", ":"))
        except (TypeError, ValueError) as exc:
            raise ComponentPreviewError(f"Parámetros no válidos para «{item.component}».") from exc
        if len(params) > 8_000:
            raise ComponentPreviewError("Los parámetros de cada vista previa deben ocupar menos de 8 KB.")

        query = urlencode(
            {
                "d": video.design,
                "c": item.component,
                "p": params,
                "t": str(item.time_seconds),
                "dur": str(item.duration_seconds),
                "solo": "1",
            }
        )
        output.append(
            {
                "key": item.key,
                "video_id": item.video_id,
                "design": video.design,
                "component": item.component,
                "preview_url": f"{FILES_PREFIX}/_tools/explainer-kit/showcase/stage.html?{query}",
            }
        )
    return output


def _sandbox_preview(item) -> dict[str, str]:
    from src.core.explainer.sandbox_components import list_components
    matches = [entry for entry in list_components(sandbox.get_sandbox_dir()) if entry["id"] == item.video_id]
    if not matches:
        raise ComponentPreviewError(f"No existe el prototipo «{item.video_id}» en el Sandbox.")
    if len(matches) > 1:
        raise ComponentPreviewError(f"El prototipo «{item.video_id}» es ambiguo: aparece en varias categorías del Sandbox.")
    entry = matches[0]
    info_path = sandbox.get_sandbox_dir().joinpath(*entry["path"].split("/")[1:]) / "info.json"
    declared = {component["name"]: component for component in sandbox_info.load_declared_components(info_path)}
    for name in [item.component, *(item.components or [])]:
        if name not in declared:
            raise ComponentPreviewError(f"El componente «{name}» no está declarado en «{item.video_id}».")
    spec = declared[item.component].get("params", {})
    for key, value in item.params.items():
        if key not in spec or not sandbox_info._value_valid(value, spec[key]):
            raise ComponentPreviewError(f"Parámetro «{key}» no válido para «{item.component}».")
    for key, param in spec.items():
        if param.get("required") and key not in item.params:
            raise ComponentPreviewError(f"Falta el parámetro obligatorio «{key}» para «{item.component}».")
    _check_image_sources(item.params)
    query = [("controls", "1"), ("c", item.component)]
    if item.components is not None:
        query.extend(("c", name) for name in dict.fromkeys(item.components) if name != item.component)
        query.append(("cx", "1"))
    if item.params:
        try:
            params = json.dumps({item.component: item.params}, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
        except (TypeError, ValueError) as exc:
            raise ComponentPreviewError(f"Parámetros no válidos para «{item.component}».") from exc
        if len(params.encode("utf-8")) > 8000:
            raise ComponentPreviewError("Los parámetros de cada vista previa deben ocupar menos de 8 KB.")
        query.append(("p", params))
    path = "/".join(quote(part, safe="") for part in entry["path"].split("/"))
    return {"key": item.key, "video_id": item.video_id, "design": "", "component": item.component,
            "preview_url": f"{FILES_PREFIX}/{path}/index.html?{urlencode(query)}"}

"""Vuelca lo que el usuario eligió (`job.input.template_inputs`) en el config
de la plantilla, justo antes de que html_generator lo escriba en el output.

- Textos: cada clave declarada en `inputs.texts` (notación con puntos, ej.
  "brand.tag") se escribe en esa ruta del config, recortada a su `max`. Las
  claves que la plantilla no declara se ignoran: el config no es un lugar para
  que el cliente escriba cualquier cosa.
- Medios con `target: "media"` (promos y escenas mixtas): los assets del slot
  reemplazan, en orden, las entradas de `config.media` de ese tipo. Se
  conservan `id` y el resto de cada entrada, así las `scenes` que referencian
  esos ids siguen intactas; si hay menos assets que entradas se reparten en
  ciclo (mezclar el material del usuario con el de demo se vería roto).
  Los archivos se COPIAN de la librería al output del job (el HTML los carga
  con rutas relativas y el grabador no debe depender de data/).
- Medios con `target: "source"` (fondos de letras, imagen/video principal) no
  se tocan acá: siguen entrando por image/video source del job.

Ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md §3.
"""

from __future__ import annotations

import asyncio
import copy
import shutil
from pathlib import Path
from typing import Any

import structlog

from src.config.template_manifest import get_template_inputs
from src.core.library import asset_library
from src.core.template_inputs import TemplateInputs

logger = structlog.get_logger(__name__)

# Carpeta dentro del output del job: separada de assets/media (material de la
# plantilla, copiado por runtime_assets) para no pisar nunca un archivo de demo.
INPUTS_DIR = "assets/inputs"


def _set_dotted(config: dict[str, Any], dotted_key: str, value: Any) -> None:
    node = config
    *parents, leaf = dotted_key.split(".")
    for part in parents:
        child = node.get(part)
        if not isinstance(child, dict):
            child = {}
            node[part] = child
        node = child
    node[leaf] = value


def _resolve_asset(kind: str, asset_id: str) -> tuple[str, Path]:
    """Devuelve (tipo real, ruta) del asset; "image|video" prueba ambos."""
    kinds = ("video", "image") if kind == "image|video" else (kind,)
    for candidate in kinds:
        try:
            resolver = asset_library.resolve_video_path if candidate == "video" else asset_library.resolve_image_path
            path = resolver(asset_id)
        except Exception:  # noqa: BLE001 - asset inexistente en esa colección
            continue
        if path.exists():
            return candidate, path
    raise FileNotFoundError(f"Asset '{asset_id}' ({kind}) no está en la librería")


async def _extract_poster(video: Path, poster: Path) -> bool:
    """Primer cuadro útil del video como póster (las plantillas lo usan cuando
    una escena muestra el clip como foto). q:v 2 = JPEG casi sin pérdida."""
    proc = await asyncio.create_subprocess_exec(
        "ffmpeg", "-y", "-v", "error", "-ss", "0.5", "-i", str(video),
        "-frames:v", "1", "-q:v", "2", str(poster),
        stdin=asyncio.subprocess.DEVNULL,
        stdout=asyncio.subprocess.DEVNULL,
        stderr=asyncio.subprocess.PIPE,
    )
    _, stderr = await proc.communicate()
    if proc.returncode != 0 or not poster.exists():
        logger.warning("template_inputs_poster_failed", video=str(video), error=stderr.decode(errors="ignore")[:300])
        return False
    return True


def _apply_texts(config: dict[str, Any], texts: dict[str, str], declared: list[dict]) -> list[str]:
    by_key = {field["key"]: field for field in declared}
    applied: list[str] = []
    for key, value in texts.items():
        field = by_key.get(key)
        if field is None:
            logger.warning("template_inputs_unknown_text_key", key=key)
            continue
        text = str(value)
        if field.get("max"):
            text = text[: field["max"]]
        _set_dotted(config, key, text)
        applied.append(key)
    return applied


async def _apply_media_slot(
    config: dict[str, Any],
    slot: dict,
    asset_ids: list[str],
    output_dir: Path,
) -> int:
    entries = config.get("media")
    if not isinstance(entries, list):
        logger.warning("template_inputs_no_media_list", slot=slot["slot"])
        return 0
    asset_ids = asset_ids[: slot["max"]]
    wanted = {"image", "video"} if slot["kind"] == "image|video" else {slot["kind"]}
    targets = [entry for entry in entries if isinstance(entry, dict) and entry.get("type") in wanted]
    if not targets or not asset_ids:
        return 0

    dest_dir = output_dir / INPUTS_DIR
    dest_dir.mkdir(parents=True, exist_ok=True)
    # Cada asset se copia una sola vez aunque se reparta en varias entradas.
    copied: dict[str, dict[str, str]] = {}
    for index, asset_id in enumerate(asset_ids):
        real_kind, source = _resolve_asset(slot["kind"], asset_id)
        relative = f"{INPUTS_DIR}/{slot['slot']}-{index + 1}{source.suffix.lower()}"
        shutil.copy2(source, output_dir / relative)
        spec = {"type": real_kind, "src": relative}
        if real_kind == "video":
            poster_rel = f"{INPUTS_DIR}/{slot['slot']}-{index + 1}-poster.jpg"
            if await _extract_poster(output_dir / relative, output_dir / poster_rel):
                spec["poster"] = poster_rel
        copied[asset_id] = spec

    for position, entry in enumerate(targets):
        spec = copied[asset_ids[position % len(asset_ids)]]
        entry["type"] = spec["type"]
        entry["src"] = spec["src"]
        if "poster" in spec:
            entry["poster"] = spec["poster"]
        else:
            entry.pop("poster", None)
        # Las variantes pre-gradadas eran del material de demo: sin ellas la
        # plantilla aplica el mismo grade en vivo (idéntico, solo más lento).
        entry.pop("graded", None)
    return len(targets)


async def apply_template_inputs(
    config: dict[str, Any],
    inputs: TemplateInputs | None,
    template_id: str,
    output_dir: Path,
) -> dict[str, Any]:
    """Devuelve una copia del config con textos y medios del usuario aplicados.

    Sin inputs (o plantilla sin requisitos) devuelve el config tal cual.
    """
    requirements = get_template_inputs(template_id)
    if inputs is None or requirements is None:
        return config
    result = copy.deepcopy(config)
    applied_texts = _apply_texts(result, inputs.texts, requirements["texts"])

    slots = {slot["slot"]: slot for slot in requirements["media"]}
    replaced: dict[str, int] = {}
    for slot_name, asset_ids in inputs.media.items():
        slot = slots.get(slot_name)
        if slot is None:
            logger.warning("template_inputs_unknown_slot", template_id=template_id, slot=slot_name)
            continue
        if slot["target"] != "media":
            continue  # entra por image/video source del job
        replaced[slot_name] = await _apply_media_slot(result, slot, list(asset_ids), output_dir)

    logger.info(
        "template_inputs_applied",
        template_id=template_id,
        texts=applied_texts,
        media_entries=replaced,
    )
    return result

"""Module 5 — HTML Generator.

Two completely different behaviors depending on niche_cfg.pipeline_type:

- "freeform_html" (default): DeepSeek genera un index.html completo desde
  cero a partir del prompt armado por prompt_architect. Comportamiento
  original, sin cambios.

- "config_driven_template": el index.html de la plantilla es ESTÁTICO y se
  copia tal cual (nunca se regenera). DeepSeek solo ejecuta el Prompt 2
  (Config Mapper) y devuelve el JSON que se escribe como config.json —
  ver la ruta declarada en src/templates/templates.json.
"""

from __future__ import annotations

import copy
import json
import time
from pathlib import Path

import orjson
import structlog
from PIL import Image

from src.config.exceptions import AIGenerationError
from src.config.niche_config import NicheConfig
from src.config.template_manifest import copy_template_runtime_assets, get_template_paths
from src.core.job import Job, JobStage
from src.core.library import asset_library
from src.core.ports.ai_port import AIPort
from src.modules.template_inputs_applier import apply_template_inputs

logger = structlog.get_logger(__name__)


def _restore_template_media(config_dict: dict, config_path: Path | None) -> None:
    if "media" in config_dict or config_path is None or not config_path.is_file():
        return
    raw = json.loads(config_path.read_text(encoding="utf-8"))
    if isinstance(raw, dict) and isinstance(raw.get("configs"), list):
        configs = [item for item in raw["configs"] if isinstance(item, dict)]
        active_id = raw.get("activeId")
        raw = next((item for item in configs if item.get("id") == active_id), configs[0] if configs else {})
    if isinstance(raw, dict) and isinstance(raw.get("media"), (dict, list)):
        config_dict["media"] = copy.deepcopy(raw["media"])

_SYSTEM = """\
Soy un director creativo y programador experto especializado en visualizadores musicales
para contenido de larga duración en YouTube y TikTok.
Genero código HTML autónomo, moderno y visualmente impresionante.
Respondo ÚNICAMENTE con el código HTML completo, sin ningún texto adicional.
"""

def _composition_html(html: str, job: Job) -> str:
    """Los recursos del nuevo layout se resuelven relativos a assets/."""
    if job.artifacts.assets_dir is None or job.artifacts.assets_dir == job.artifacts.output_dir:
        return html
    import re
    base = '<base href="assets/">'
    if re.search(r"<head\b[^>]*>", html, flags=re.IGNORECASE):
        return re.sub(r"(<head\b[^>]*>)", lambda match: match.group(1) + base, html, count=1, flags=re.IGNORECASE)
    return base + html


async def run(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    if niche_cfg.pipeline_type == "config_driven_template":
        return await _run_config_driven(job, ai, niche_cfg)

    t_start = time.monotonic()
    logger.info("html_generator_start", job_id=job.job_id)

    html_code = await ai.complete_text(_SYSTEM, job.artifacts.prompt_text)

    # Basic sanity check
    if "<!DOCTYPE" not in html_code and "<html" not in html_code:
        raise AIGenerationError("AI response does not appear to be valid HTML.")

    output_dir: Path = job.artifacts.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)
    html_path = output_dir / "index.html"
    html_path.write_text(_composition_html(html_code, job), encoding="utf-8")

    # Audit logs
    logs_dir = job.artifacts.log_dir or output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "04_html_generado.html").write_text(html_code, encoding="utf-8")
    (logs_dir / "04_html_log.json").write_bytes(
        orjson.dumps(
            {
                "html_length": len(html_code),
                "has_audio": "song.mp3" in html_code,
                "has_canvas": "<canvas" in html_code,
                "has_web_audio": "AudioContext" in html_code or "webkitAudioContext" in html_code,
                "uses_threejs": "three" in html_code.lower(),
                "uses_gsap": "gsap" in html_code.lower(),
            },
            option=orjson.OPT_INDENT_2,
        )
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info("html_generator_done", job_id=job.job_id, html_size=len(html_code), path=str(html_path), elapsed=elapsed)

    artifacts = job.artifacts.model_copy(update={"html_path": html_path})
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.HTML_GENERATED)


# ─────────────────────────────────────────────────────────────────────────────
# pipeline_type == "config_driven_template"
# ─────────────────────────────────────────────────────────────────────────────

def _apply_locked_keys(config_dict: dict, config_path: Path | None, keys: list[str]) -> None:
    """Pisa con el valor de la plantilla las claves que la plantilla decide (no la IA)."""
    if config_path is None or not config_path.exists():
        return
    raw = json.loads(config_path.read_text(encoding="utf-8"))
    template_config = raw["configs"][0] if isinstance(raw, dict) and isinstance(raw.get("configs"), list) and raw["configs"] else raw
    for key in keys:
        if isinstance(template_config, dict) and key in template_config:
            config_dict[key] = template_config[key]


async def _run_config_driven(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    t_start = time.monotonic()
    logger.info(
        "html_generator_config_driven_start",
        job_id=job.job_id,
        template=niche_cfg.template.template_id,
    )

    template_paths = get_template_paths(niche_cfg.template.template_id)
    if niche_cfg.template.static_config:
        config_path = template_paths["config_json"]
        if config_path is None or not config_path.exists():
            raise AIGenerationError(
                f"Plantilla estática sin config.json: {niche_cfg.template.template_id}"
            )
        raw_config = json.loads(config_path.read_text(encoding="utf-8"))
        if isinstance(raw_config, dict) and isinstance(raw_config.get("configs"), list):
            configs = raw_config["configs"]
            active_id = raw_config.get("activeId")
            config_dict = next(
                (candidate for candidate in configs if candidate.get("id") == active_id),
                configs[0] if configs else None,
            )
        else:
            config_dict = raw_config
    else:
        system_prompt_path = template_paths["config_prompt"]
        if system_prompt_path is None or not system_prompt_path.exists():
            raise AIGenerationError(
                f"Plantilla config-driven sin config_mapper: {niche_cfg.template.template_id}"
            )
        system_prompt = system_prompt_path.read_text(encoding="utf-8")
        config_dict = await ai.complete_json(system_prompt, job.artifacts.prompt_text)
        if isinstance(config_dict, dict) and niche_cfg.template.locked_config_keys:
            _apply_locked_keys(config_dict, template_paths["config_json"], niche_cfg.template.locked_config_keys)
        if isinstance(config_dict, dict):
            _restore_template_media(config_dict, template_paths["config_json"])

    if not isinstance(config_dict, dict):
        raise AIGenerationError(f"Config Mapper no devolvió un objeto JSON: {type(config_dict).__name__}")

    required_keys = niche_cfg.template.required_config_keys
    missing_keys = [k for k in required_keys if k not in config_dict]
    if missing_keys:
        raise AIGenerationError(f"config.json generado — faltan claves requeridas: {missing_keys}")

    media_key = niche_cfg.template.media_dimension_key
    if media_key is not None:
        # No confiar en que DeepSeek copie bien width_px/height_px del Vision JSON al
        # transcribirlas a config.json — forzarlas nosotros, en Python. IMPORTANTE:
        # la fuente de verdad es vision_analysis.image_dimensions, NO el archivo real
        # en disco (PIL) — todas las coordenadas de zones/subject/keepOut que Gemini
        # calculó están expresadas en ESE mismo sistema de referencia (el que Gemini
        # declaró como "el ancho/alto de la imagen" al analizarla), que puede diferir
        # ligeramente de los píxeles reales del archivo (los modelos de visión no
        # siempre leen la resolución exacta). Si w/h no coincide con el sistema de
        # coordenadas que usaron zones/subject/keepOut, el motor JS de la plantilla
        # calcula mal el factor de escala y desalinea todo el posicionamiento de texto
        # — aunque la imagen en sí se vea bien (el <img> escala por relación de
        # aspecto, que sí es correcta). Solo se usa el archivo real como último
        # recurso si el Vision JSON no trajera dimensiones válidas.
        vision_dims = (job.artifacts.vision_analysis or {}).get("image_dimensions") or {}
        width = vision_dims.get("width_px")
        height = vision_dims.get("height_px")
        if not (width and height):
            logger.warning("html_generator_config_driven_no_vision_dims_fallback_to_file", job_id=job.job_id)
            with Image.open(job.artifacts.image_path) as im:
                width, height = im.size

        config_dict.setdefault(media_key, {})
        config_dict[media_key]["src"] = niche_cfg.template.media_src_filename
        config_dict[media_key]["w"] = width
        config_dict[media_key]["h"] = height

    # Mismo criterio de "no confiar en que la IA copie bien un nombre de
    # archivo" — se fuerza acá, en Python, cuando la clave existe en el schema.
    if "audio" in config_dict and isinstance(config_dict["audio"], dict):
        config_dict["audio"]["src"] = "song.mp3"
    if niche_cfg.template.requires_lyrics:
        config_dict["lyricsUrl"] = "lyrics.json"
        # Las plantillas de letras usan "bg" (no "img", y sin forzado de w/h —
        # media_dimension_key=None para ellas, ver niche_config.py) para su
        # imagen de fondo opcional. Mismo criterio de no confiar en la IA.
        if (
            (niche_cfg.template.requires_image or niche_cfg.template.requires_video)
            and "bg" in config_dict
            and isinstance(config_dict["bg"], dict)
            and "src" in config_dict["bg"]
        ):
            config_dict["bg"]["src"] = niche_cfg.template.media_src_filename
            config_dict["bg"]["type"] = "video" if niche_cfg.template.requires_video else "image"

    # Algunas plantillas esperan una COLECCIÓN de casos, no un objeto top-level
    # — esa decisión la declara el niche y no depende de la carpeta física.
    if niche_cfg.template.wrap_as_case_collection:
        config_dict["id"] = "active"

    output_dir: Path = job.artifacts.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    from src.templates._tools.nodemotion.shared.assemble import registered
    is_project = registered(niche_cfg.template.template_id)
    # index.html es estático — se copia tal cual, nunca se regenera.
    index_html_src = template_paths["index_html"]
    if index_html_src is None or not index_html_src.exists():
        raise AIGenerationError(
            f"Plantilla config-driven sin index.html: {niche_cfg.template.template_id}"
        )
    html_path = output_dir / "index.html"
    assets_dir = job.artifacts.content_dir
    references = {} if is_project else None
    if is_project:
        copied_assets = []
    else:
        html_path.write_text(_composition_html(index_html_src.read_text(encoding="utf-8"), job), encoding="utf-8")
        copied_assets = copy_template_runtime_assets(niche_cfg.template.template_id, assets_dir)

    # Textos y medios que eligió el usuario (Estudio / Crear video) — después de
    # copiar los runtime_assets para que sus archivos queden al lado del HTML.
    if is_project:
        config_dict = await apply_template_inputs(
            config_dict, job.input.template_inputs, niche_cfg.template.template_id, assets_dir,
            references=references,
        )
    else:
        config_dict = await apply_template_inputs(
            config_dict, job.input.template_inputs, niche_cfg.template.template_id, assets_dir,
        )

    from src.core.nodemotion.lyrics.appearance import ensure_intro_title
    ensure_intro_title(config_dict, job, niche_cfg.template.template_id)

    # Plantillas de letras con guion explícito (adaptacion.json en su carpeta): la demo conserva su
    # guion; una canción nueva recibe una línea de tiempo generada desde su transcripción.
    # Las plantillas sin adaptacion.json no se tocan.
    song_report = None
    if job.input.timed_content is None:
        from src.core.nodemotion.lyrics.song_adapter import apply_song_lyrics
        song_report = apply_song_lyrics(niche_cfg.template.template_id, config_dict, job)
        if song_report is not None:
            logger.info(
                "song_adapter_applied",
                job_id=job.job_id,
                template=niche_cfg.template.template_id,
                estado=song_report.get("estado"),
                modo=song_report.get("modo"),
                cobertura=song_report.get("cobertura"),
                escenas=song_report.get("escenas"),
            )

    written_config = (
        {"activeId": "active", "configs": [config_dict]}
        if niche_cfg.template.wrap_as_case_collection
        else config_dict
    )
    config_path = assets_dir / "config.json"
    config_json_text = json.dumps(written_config, indent=2, ensure_ascii=False)
    config_path.write_text(config_json_text, encoding="utf-8")

    if is_project:
        from src.core.nodemotion.service import asset_ref
        from src.core.nodemotion.factory import get_project_strategy
        from src.core.nodemotion.shared.bundled import ensure_design_resources
        from src.modules.resource_fetcher import _outro_tail_seconds
        defaults = await ensure_design_resources(niche_cfg.template.template_id)
        references = {**defaults, **references}
        references["song.mp3"] = asset_ref("music", job.artifacts.music_asset_id,
                                           tail_seconds=_outro_tail_seconds(niche_cfg))
        if job.artifacts.image_asset_id:
            references[niche_cfg.template.media_src_filename] = asset_ref("image", job.artifacts.image_asset_id)
        if job.artifacts.video_asset_id:
            references[niche_cfg.template.media_src_filename] = asset_ref("video", job.artifacts.video_asset_id)
        prefix = assets_dir.relative_to(output_dir).as_posix()
        if prefix == ".":
            prefix = ""
        get_project_strategy(niche_cfg.template.template_id).create(
            output_dir, niche_cfg.template.template_id, references, job, prefix)

    logs_dir = job.artifacts.log_dir or output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "04_config_generado.json").write_text(config_json_text, encoding="utf-8")
    if song_report is not None:
        (logs_dir / "05_reporte_cancion.json").write_text(
            json.dumps(song_report, indent=2, ensure_ascii=False), encoding="utf-8")

    await asset_library.register_template_config(
        job.job_id,
        niche_cfg.template.template_id,
        niche_cfg.id,
        config_dict,
        image_asset_id=job.artifacts.image_asset_id,
        music_asset_id=job.artifacts.music_asset_id,
        video_asset_id=job.artifacts.video_asset_id,
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "html_generator_config_driven_done",
        job_id=job.job_id,
        config_path=str(config_path),
        runtime_assets=[str(path) for path in copied_assets],
        elapsed=elapsed,
    )

    artifacts = job.artifacts.model_copy(
        update={
            "html_path": html_path,
            "template_config": config_dict,
            "config_json_path": config_path,
            **({"lyrics_json": None} if is_project else {}),
        }
    )
    changes = {"artifacts": artifacts}
    if is_project and (job.input.promo_timeline is not None or job.input.timed_content is not None):
        changes["input"] = job.input.model_copy(update={"promo_timeline": None, "timed_content": None})
    return job.model_copy(update=changes).advance(JobStage.HTML_GENERATED)

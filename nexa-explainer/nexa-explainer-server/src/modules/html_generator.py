"""Module 5 — HTML Generator.

Two completely different behaviors depending on niche_cfg.pipeline_type:

- "freeform_html" (default): DeepSeek genera un index.html completo desde
  cero a partir del prompt armado por prompt_architect. Comportamiento
  original, sin cambios.

- "config_driven_template": el index.html de la plantilla es ESTÁTICO y se
  copia tal cual (nunca se regenera). DeepSeek solo ejecuta el Prompt 2
  (Config Mapper) y devuelve el JSON que se escribe como config.json —
  ver src/templates/01-image-bg/prompts/config_mapper.md.
"""

from __future__ import annotations

import json
import shutil
import time
from pathlib import Path

import orjson
import structlog
from PIL import Image

from src.config.exceptions import AIGenerationError
from src.config.niche_config import NicheConfig
from src.config.template_manifest import get_template_paths
from src.core.job import Job, JobStage
from src.core.library import asset_library
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)

_SYSTEM = """\
Soy un director creativo y programador experto especializado en visualizadores musicales
para contenido de larga duración en YouTube y TikTok.
Genero código HTML autónomo, moderno y visualmente impresionante.
Respondo ÚNICAMENTE con el código HTML completo, sin ningún texto adicional.
"""

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
    html_path.write_text(html_code, encoding="utf-8")

    # Audit logs
    logs_dir = output_dir / "logs"
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

async def _run_config_driven(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    t_start = time.monotonic()
    logger.info(
        "html_generator_config_driven_start",
        job_id=job.job_id,
        template=niche_cfg.template.template_id,
    )

    template_paths = get_template_paths(niche_cfg.template.template_id)
    system_prompt = template_paths["config_prompt"].read_text(encoding="utf-8")
    config_dict = await ai.complete_json(system_prompt, job.artifacts.prompt_text)

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

    # motion-backdrop: el motor espera una COLECCIÓN de casos, no un objeto
    # top-level — index.html está forkeado con ACTIVE_ID="active" fijo (ver
    # src/templates/motion-backdrop/index.html), así que "id" se fuerza igual.
    if niche_cfg.template.wrap_as_case_collection:
        config_dict["id"] = "active"

    output_dir: Path = job.artifacts.output_dir
    output_dir.mkdir(parents=True, exist_ok=True)

    # index.html es estático — se copia tal cual, nunca se regenera.
    index_html_src = template_paths["index_html"]
    html_path = output_dir / "index.html"
    shutil.copy2(index_html_src, html_path)

    written_config = (
        {"activeId": "active", "configs": [config_dict]}
        if niche_cfg.template.wrap_as_case_collection
        else config_dict
    )
    config_path = output_dir / "config.json"
    config_json_text = json.dumps(written_config, indent=2, ensure_ascii=False)
    config_path.write_text(config_json_text, encoding="utf-8")

    logs_dir = output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "04_config_generado.json").write_text(config_json_text, encoding="utf-8")

    await asset_library.register_template_config(
        job.job_id,
        niche_cfg.template.template_id,
        niche_cfg.id,
        config_dict,
        image_asset_id=job.artifacts.image_asset_id,
        video_asset_id=job.artifacts.video_asset_id,
    )

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "html_generator_config_driven_done",
        job_id=job.job_id,
        config_path=str(config_path),
        elapsed=elapsed,
    )

    artifacts = job.artifacts.model_copy(
        update={
            "html_path": html_path,
            "template_config": config_dict,
            "config_json_path": config_path,
        }
    )
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.HTML_GENERATED)

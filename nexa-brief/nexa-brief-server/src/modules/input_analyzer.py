"""Module 1 — Input Analyzer: enriches the raw job input via Gemini.

Stage 1a: analyzes category → genre, mood, description (existing behavior).
Stage 1b: if the niche has search_instructions, asks the AI to generate
          4 image queries + 4 music queries, each different to maximize
          variety across runs while maintaining the niche's visual style.
          Saved as logs/01b_search_queries.json.
"""

from __future__ import annotations

import time
from pathlib import Path

import orjson
import structlog

from src.config.exceptions import AIValidationError
from src.config.niche_config import NicheConfig
from src.core.job import AnalyzedInput, AssetSourceType, Job, JobStage, SearchQueries
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)

# ── Stage 1a: análisis del input ─────────────────────────────────────────────

_ANALYSIS_SYSTEM = """\
Soy un analista experto en contenido musical para plataformas digitales como YouTube y TikTok.
Mi trabajo es interpretar la intención creativa detrás de una categoría musical y enriquecerla
con contexto semántico que guíe el proceso de diseño visual y selección de recursos.
Siempre respondo en JSON válido, sin texto adicional.
"""

_ANALYSIS_USER = """\
Analiza esta categoría musical y devuelve un JSON con los siguientes campos:

- genre: género musical principal (lofi, jazz, ambient, classical, study)
- mood_tags: lista de 3-5 etiquetas de estado de ánimo en inglés
- image_query: consulta de búsqueda en inglés para encontrar una imagen de fondo apropiada
- description: descripción breve del estilo y ambiente del video (máximo 2 oraciones)
- duration_seconds: la duración ya viene dada, no la cambies
- category_name: el nombre tal como se proporcionó

Categoría: {category_name}
Duración (segundos): {duration_seconds}
{user_context_line}{song_info_block}
Responde ÚNICAMENTE con el JSON, sin texto adicional ni bloques de código.
"""

# Inyectado solo cuando job.input.song_info trae datos — son HECHOS dados por
# el usuario, la IA los usa como base y solo completa lo que falte, nunca los
# inventa ni los contradice.
_SONG_INFO_BLOCK = """\

El usuario YA proporcionó esta información sobre la canción — son HECHOS reales,
no los inventes ni los contradigas. Tu trabajo es COMPLETAR únicamente lo que
falte (mood_tags, image_query, y description si no fue dada) de forma coherente
con estos datos, no reemplazarlos:
{song_info_lines}
"""

# ── Stage 1b: generación de queries de búsqueda ───────────────────────────────

_QUERIES_SYSTEM = """\
Eres un experto en búsqueda de imágenes de stock (Unsplash, Pexels) y música libre de derechos (Jamendo, Pixabay).
Tu trabajo es generar queries de búsqueda específicos y variados basándote en instrucciones de estilo de un nicho.
Siempre respondes en JSON válido, sin texto adicional.
"""

_QUERIES_USER = """\
Basándote en estas instrucciones de estilo para un canal de video musical, genera queries de búsqueda:

=== INSTRUCCIONES DE IMAGEN ===
{image_instructions}

=== INSTRUCCIONES DE MÚSICA ===
{music_instructions}

Genera exactamente 4 queries de imagen y 4 de música con estas reglas:

IMAGEN (para Unsplash/Pexels):
- En inglés, muy descriptivos y específicos
- Incluir iluminación, composición, mood, tipo de fotografía
- Cada uno diferente del anterior para obtener imágenes variadas del mismo estilo
- Orientados a fotografía profesional de alta calidad

MÚSICA (para Jamendo/Pixabay):
- UNA SOLA PALABRA por query — NO se aceptan frases de múltiples palabras
- Deben ser tags de género que existen en Jamendo
- La música puede tener letra (vocals) si el estilo lo requiere
- Ejemplos válidos: epic, orchestral, dramatic, classical, cinematic, metal, choir, neoclassical, dark, powerful, ambient, opera
- Cada uno diferente para maximizar las opciones de búsqueda

Responde ÚNICAMENTE con este JSON:
{{
  "image_queries": ["query1", "query2", "query3", "query4"],
  "music_queries": ["term1", "term2", "term3", "term4"]
}}
"""


async def run(job: Job, ai: AIPort, niche_cfg: NicheConfig) -> Job:
    t_start = time.monotonic()
    logger.info("input_analyzer_start", job_id=job.job_id, category=job.input.category_name)

    logs_dir: Path = job.artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)

    # ── Recolección: lo que el usuario ya sabe sobre la canción ───────────────
    # Se registra tal cual, SIN pasar por IA — es la "recolección" pedida:
    # nombre de la canción, de qué trata, descripción, notas. input_analyzer no
    # decide/inventa esto, solo lo archiva como información valiosa/relevante.
    song_info = job.input.song_info
    if song_info is not None:
        (logs_dir / "01a_song_info_usuario.json").write_text(
            song_info.model_dump_json(indent=2), encoding="utf-8"
        )
        logger.info("input_analyzer_song_info_collected", job_id=job.job_id, has_song_name=bool(song_info.song_name))

    # ── 1a: análisis del input ────────────────────────────────────────────────
    user_context_line = (
        f"Dirección creativa del usuario: {job.input.user_context}\n"
        if job.input.user_context else ""
    )

    song_info_block = ""
    if song_info is not None:
        lines = []
        if song_info.song_name:
            lines.append(f"- Nombre de la canción: {song_info.song_name}")
        if song_info.artist:
            lines.append(f"- Artista: {song_info.artist}")
        if song_info.topic:
            lines.append(f"- De qué trata / tema: {song_info.topic}")
        if song_info.description:
            lines.append(f"- Descripción: {song_info.description}")
        if song_info.extra_notes:
            lines.append(f"- Notas adicionales: {song_info.extra_notes}")
        if lines:
            song_info_block = _SONG_INFO_BLOCK.format(song_info_lines="\n".join(lines))

    prompt = _ANALYSIS_USER.format(
        category_name=job.input.category_name,
        duration_seconds=job.input.duration_seconds,
        user_context_line=user_context_line,
        song_info_block=song_info_block,
    )
    raw = await ai.complete_json(_ANALYSIS_SYSTEM, prompt)

    raw["duration_seconds"] = job.input.duration_seconds
    raw["category_name"] = job.input.category_name

    try:
        analyzed = AnalyzedInput(**raw)
    except Exception as exc:
        raise AIValidationError(f"AnalyzedInput validation failed: {exc}\nRaw: {raw}") from exc

    (logs_dir / "01_input_completado.json").write_text(
        analyzed.model_dump_json(indent=2), encoding="utf-8"
    )

    elapsed_1a = round(time.monotonic() - t_start, 2)
    logger.info("input_analyzer_done", job_id=job.job_id, genre=analyzed.genre, elapsed=elapsed_1a)

    # ── 1b: queries de búsqueda (solo si el nicho tiene search_instructions) ──
    # Se saltea por recurso cuando el usuario ya proveyó ese recurso (URL o
    # librería local) — no tiene sentido pagar una llamada a IA para generar
    # queries de búsqueda de algo que no se va a buscar.
    search_queries: SearchQueries | None = None
    si = niche_cfg.search_instructions
    needs_image_queries = job.input.image_source.type == AssetSourceType.AUTO
    needs_music_queries = job.input.music_source.type == AssetSourceType.AUTO

    if si.image and si.music and (needs_image_queries or needs_music_queries):
        logger.info(
            "search_queries_start",
            job_id=job.job_id,
            niche=niche_cfg.id,
            needs_image_queries=needs_image_queries,
            needs_music_queries=needs_music_queries,
        )
        t_queries = time.monotonic()

        queries_raw = await ai.complete_json(
            _QUERIES_SYSTEM,
            _QUERIES_USER.format(
                image_instructions=si.image,
                music_instructions=si.music,
            ),
        )

        image_qs = queries_raw.get("image_queries", [])
        music_qs = queries_raw.get("music_queries", [])

        # Validar que sean listas de strings no vacías
        image_qs = [str(q) for q in image_qs if q][:4]
        music_qs = [str(q) for q in music_qs if q][:4]

        # Fallback si la IA no devolvió suficientes queries
        if not image_qs:
            image_qs = [analyzed.image_query]
        if not music_qs:
            music_qs = [niche_cfg.audio.genre]

        # El recurso ya provisto por el usuario no necesita queries — se deja vacío,
        # resource_fetcher no las va a usar de todos modos (AUTO es el único caso que las lee).
        if not needs_image_queries:
            image_qs = []
        if not needs_music_queries:
            music_qs = []

        search_queries = SearchQueries(image_queries=image_qs, music_queries=music_qs)

        queries_log = {
            "niche_id": niche_cfg.id,
            "image_queries": image_qs,
            "music_queries": music_qs,
            "image_instructions": si.image,
            "music_instructions": si.music,
        }
        (logs_dir / "01b_search_queries.json").write_bytes(
            orjson.dumps(queries_log, option=orjson.OPT_INDENT_2)
        )

        elapsed_queries = round(time.monotonic() - t_queries, 2)
        logger.info(
            "search_queries_done",
            job_id=job.job_id,
            image_queries=image_qs,
            music_queries=music_qs,
            elapsed=elapsed_queries,
        )

    artifacts = job.artifacts.model_copy(
        update={
            "analyzed_input": analyzed,
            "search_queries": search_queries,
        }
    )
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.INPUT_ANALYZED)

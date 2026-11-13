"""Image Validator — evalúa candidatos con Gemini y elige el mejor.

Escribe 05b_validacion_imagenes.json en logs_dir con el resultado completo.
"""

from __future__ import annotations

import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

import orjson
import structlog

from src.config.niche_config import ImageValidationConfig
from src.core.ports.ai_port import AIPort
from src.core.ports.image_port import ImageFetchResult

logger = structlog.get_logger(__name__)


async def pick_best_candidate(
    candidates: list[ImageFetchResult],
    config: ImageValidationConfig,
    ai: AIPort,
    logs_dir: Path,
) -> ImageFetchResult | None:
    """Analiza cada candidato con Gemini y devuelve el que tenga mejor score >= min_score.

    Escribe logs/05b_validacion_imagenes.json con el detalle de cada análisis.
    Retorna None si ninguno supera el umbral.
    """
    t_start = time.monotonic()
    now = datetime.now(timezone.utc).isoformat()
    analyses: list[dict] = []
    best: ImageFetchResult | None = None
    best_score = 0.0

    for candidate in candidates:
        try:
            result = await ai.analyze_image(candidate.path, config.criteria)
            score = float(result.get("score", 0.0))
            passes = bool(result.get("passes", False))
            entry = {
                "candidate": candidate.path.name,
                "provider": candidate.provider,
                "image_id": candidate.image_id,
                "score": score,
                "passes": passes,
                "reason": result.get("reason", ""),
                "criteria_met": result.get("criteria_met", []),
                "criteria_failed": result.get("criteria_failed", []),
            }
            analyses.append(entry)
            logger.info(
                "image_candidate_analyzed",
                candidate=candidate.path.name,
                score=score,
                passes=passes,
            )
            if score >= config.min_score and score > best_score:
                best_score = score
                best = candidate
        except Exception as exc:
            logger.warning(
                "image_candidate_analysis_failed",
                candidate=candidate.path.name,
                error=str(exc),
            )
            analyses.append({
                "candidate": candidate.path.name,
                "error": str(exc),
                "score": 0.0,
                "passes": False,
            })

    elapsed = round(time.monotonic() - t_start, 2)
    log = {
        "validated_at": now,
        "criteria": config.criteria,
        "min_score": config.min_score,
        "candidates_evaluated": len(candidates),
        "best_candidate": best.path.name if best else None,
        "best_score": round(best_score, 4),
        "validation_passed": best is not None,
        "analyses": analyses,
        "elapsed_seconds": elapsed,
    }
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "05b_validacion_imagenes.json").write_bytes(
        orjson.dumps(log, option=orjson.OPT_INDENT_2)
    )
    logger.info(
        "image_validation_done",
        best=best.path.name if best else None,
        best_score=best_score,
        elapsed=elapsed,
    )
    return best


def copy_to_bg(best: ImageFetchResult, output_dir: Path, filename: str = "bg.jpg") -> Path:
    """Copia el candidato elegido a `filename` (default bg.jpg) en output_dir."""
    dest = output_dir / filename
    shutil.copy2(best.path, dest)
    return dest

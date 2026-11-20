"""Publicación de un prototipo de NodeMotion al terminar de grabarse.

Usa el mismo camino que «Publicar ahora» de Biblioteca (`engine.publish_entry`): una entrada de cola
por cuenta, con SU formato (16:9 o 9:16). Así la card de Biblioteca muestra «Publicando… · canal»,
el resultado queda en la cola y cada red recibe el archivo que corresponde (antes la etapa de
publicación del pipeline mandaba siempre el 16:9, también a Instagram).
"""

from __future__ import annotations

import structlog

from src.core.drafts import DEFAULT_ACCOUNT_FORMAT, RECORD_OUTPUT_FORMAT, RecordFormat, RenderOptions, effective_record_formats
from src.core.schedule import engine, queue_repository
from src.core.schedule.models import QueueSource

logger = structlog.get_logger(__name__)

def format_for(selector: str, options: RenderOptions) -> RecordFormat:
    platform = selector.split(":", 1)[0]
    recorded = effective_record_formats(options)
    if options.outputs is not None:
        targets = publication_destinations(selector, options)
        return targets[0][1] if targets else (recorded[0] if recorded else "16x9")
    if platform == "youtube":
        return "16x9"
    chosen = options.account_formats.get(selector) or DEFAULT_ACCOUNT_FORMAT.get(platform, "16x9")
    return chosen if chosen in recorded else recorded[0]


def publication_destinations(selector: str, options: RenderOptions) -> list[tuple[str, RecordFormat]]:
    """Salidas asociadas explícitamente a una cuenta, sin inventar capacidad de otra red.

    YouTube normal y Shorts comparten el selector de cuenta YouTube pero se encolan
    como dos publicaciones con archivos y copias distintos. Otros destinos solo se
    publican en la cuenta de su propia plataforma.
    """
    platform = selector.split(":", 1)[0]
    if options.outputs is None:
        return [(platform, format_for(selector, options))]
    destinations: list[tuple[str, RecordFormat]] = []
    for output in dict.fromkeys(options.outputs):
        if output == platform or (platform == "youtube" and output == "youtube_shorts"):
            destinations.append((output, RECORD_OUTPUT_FORMAT[output]))
    return destinations


async def publish_rendered(job_id: str, options: RenderOptions) -> None:
    """Publica solo en cuentas elegidas y solo sus destinos compatibles."""
    if not options.publish_accounts:
        return
    from src.adapters.publishing.factory import get_publisher_facade

    facade = get_publisher_facade()
    for selector in options.publish_accounts:
        platform, _, alias = selector.partition(":")
        for _destination, video_format in publication_destinations(selector, options):
            try:
                entry = await queue_repository.create(
                    job_id=job_id, platform=platform, account_alias=alias,
                    scheduled_at=None, source=QueueSource.IMMEDIATE, format=video_format,
                )
                await engine.publish_entry(facade, entry)
            except Exception:
                logger.exception("draft_publish_failed", job_id=job_id, account=selector)

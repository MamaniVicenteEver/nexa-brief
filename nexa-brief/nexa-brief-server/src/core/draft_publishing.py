"""Publicación de un prototipo de NodeMotion al terminar de grabarse.

Usa el mismo camino que «Publicar ahora» de Biblioteca (`engine.publish_entry`): una entrada de cola
por cuenta, con SU formato (16:9 o 9:16). Así la card de Biblioteca muestra «Publicando… · canal»,
el resultado queda en la cola y cada red recibe el archivo que corresponde (antes la etapa de
publicación del pipeline mandaba siempre el 16:9, también a Instagram).
"""

from __future__ import annotations

import structlog

from src.core.drafts import DEFAULT_ACCOUNT_FORMAT, RecordFormat, RenderOptions, effective_record_formats
from src.core.schedule import engine, queue_repository
from src.core.schedule.models import QueueSource

logger = structlog.get_logger(__name__)

def format_for(selector: str, options: RenderOptions) -> RecordFormat:
    platform = selector.split(":", 1)[0]
    recorded = effective_record_formats(options)
    if platform == "youtube":
        return "16x9"
    chosen = options.account_formats.get(selector) or DEFAULT_ACCOUNT_FORMAT.get(platform, "16x9")
    return chosen if chosen in recorded else recorded[0]


async def publish_rendered(job_id: str, options: RenderOptions) -> None:
    """Publica en cada cuenta elegida, una tras otra. Nunca lanza: cada resultado queda en su entrada."""
    if not options.publish_accounts:
        return
    from src.adapters.publishing.factory import get_publisher_facade

    facade = get_publisher_facade()
    for selector in options.publish_accounts:
        platform, _, alias = selector.partition(":")
        try:
            entry = await queue_repository.create(
                job_id=job_id, platform=platform, account_alias=alias,
                scheduled_at=None, source=QueueSource.IMMEDIATE, format=format_for(selector, options),
            )
            await engine.publish_entry(facade, entry)
        except Exception:
            logger.exception("draft_publish_failed", job_id=job_id, account=selector)

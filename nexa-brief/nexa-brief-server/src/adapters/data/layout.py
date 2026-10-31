"""Catálogo de nombres lógicos → dónde vive cada cosa en el backend JSON.

Es el ÚNICO lugar que conoce la estructura de `data/`. Un backend de base de
datos mapearía estos mismos nombres lógicos a tablas/buckets (ej. "jobs" →
tabla `jobs`); los repositorios nunca cambian.

Para agregar una colección nueva: una línea acá + usar `collection("nombre")`.
"""

from __future__ import annotations

# name → (archivo relativo a data/, campo clave o None si no tiene PK)
COLLECTIONS: dict[str, tuple[str, str | None]] = {
    "jobs": ("jobs/jobs.json", "job_id"),
    "history_events": ("jobs/history_events.json", "event_id"),
    "notifications": ("notifications/notifications.json", "notification_id"),
    "schedule_slots": ("schedule/slots.json", "slot_id"),
    "queue_entries": ("schedule/queue.json", "entry_id"),
    "image_assets": ("library/images.json", "asset_id"),
    "music_assets": ("library/music.json", "asset_id"),
    "video_assets": ("library/videos.json", "asset_id"),
    "template_configs": ("library/template_configs.json", "job_id"),
    # Creación interactiva (ver docs/investigaciones/estudio-creacion-interactiva-2026-09.md)
    "drafts": ("studio/drafts.json", "draft_id"),
    "media_plans": ("studio/media_plans.json", "plan_id"),
    # Explainer (NodeTech/History/Politics/Economy): producciones con agente local
    "explainer_productions": ("explainer/productions.json", "production_id"),
    # Fábrica: ejecuciones del agente líder para prototipos del sandbox
    "prototype_runs": ("prototypes/runs.json", "run_id"),
    # Plan de contenido semanal (planificador con IA en Programación)
    "content_plan": ("schedule/content_plan.json", "item_id"),
    # canales/ ya tiene datos reales (cuentas conectadas): se conserva su ruta.
    "channels": ("canales/channels.json", None),
    "published_videos": ("canales/published_videos.json", None),
    # Archivo de publicaciones de imagen: esta lista es una proyección derivada.
    "publication_index": ("publicaciones/index.json", "publication_id"),
}

# name → carpeta relativa a data/ (un .json por clave)
DOCUMENTS: dict[str, str] = {
    "image_vision": "library/cache/image_vision",
    "video_vision": "library/cache/video_vision",
    "lyrics": "library/cache/lyrics",
    "template_config_files": "library/template_config_files",
    "progress": "progress",
    "draft_jobs": "studio/draft_jobs",          # Job serializado de cada draft (para retomarlo)
    "template_originals": "studio/template_originals",  # medios del «Video original» de cada plantilla
    "stock_search_cache": "library/cache/stock_search",
}

# name → carpeta relativa a data/ (archivos binarios, organizados por categoría)
FILES: dict[str, str] = {
    "images": "library/files/images",
    "music": "library/files/music",
    "videos": "library/files/videos",
    # Medios inmutables de publicaciones aprobadas.
    "publication_media": "publicaciones",
}

# Raíz del archivo de publicaciones. Los adapters de publicaciones son los
# únicos que resuelven rutas por debajo de este namespace.
PUBLICATIONS_ROOT = "publicaciones"

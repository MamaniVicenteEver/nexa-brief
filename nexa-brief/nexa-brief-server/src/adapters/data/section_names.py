"""Pure namespace-to-section mappings shared by runtime and offline import."""

COLLECTION_SECTIONS = {
    "content_videos": "videos", "explainer_runtime": "videos",
    "explainer_batches": "videos", "explainer_productions": "videos",
    "drafts": "videos", "media_plans": "videos",
    "content_resources": "resources", "image_assets": "resources",
    "music_assets": "resources", "sound_assets": "resources", "video_assets": "resources",
    "template_configs": "resources", "showcase_designs": "designs",
    "sandbox_showcase": "designs",
    "jobs": "jobs", "history_events": "jobs", "prototype_runs": "jobs",
    "execution_logs": "logs", "publication_index": "publicaciones",
    "channel_publications": "publicaciones", "published_videos": "publicaciones",
    "notifications": "notifications", "schedule_slots": "schedule", "queue_entries": "schedule",
    "content_plan": "schedule", "channels": "channels", "channel_categories": "channels",
}
DOCUMENT_SECTIONS = {
    "media_aliases": "resources",
    "legacy_path_aliases": "resources",
    "content_video_details": "videos", "content_catalog_snapshots": "designs",
    "image_vision": "resources", "video_vision": "resources", "lyrics": "resources",
    "template_config_files": "resources", "stock_search_cache": "resources",
    "progress": "jobs", "draft_jobs": "videos", "template_originals": "videos",
}


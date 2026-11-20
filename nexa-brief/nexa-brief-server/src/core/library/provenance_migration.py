"""Additive, resumable provenance migration using only the DataStore port."""
from collections import defaultdict
from src.core.data import collection, documents
from src.config.template_manifest import list_template_catalog
from src.core.library.resource_metadata import resource_metadata

KINDS = {"image": "image_assets", "video": "video_assets", "music": "music_assets", "sound": "sound_assets"}

def provenance_updates():
    references = defaultdict(set)
    def remember(template_id, inputs):
        if not template_id:
            return
        for key, kind in (("image_asset_id", "image"), ("video_asset_id", "video"), ("music_asset_id", "music")):
            if inputs.get(key):
                references[kind, inputs[key]].add(template_id)
        for ids in (inputs.get("template_inputs") or {}).get("media", {}).values():
            for ident in ids:
                references["media", ident].add(template_id)
    for ident, _ in list_template_catalog():
        remember(ident, documents("template_originals").get(ident) or {})
    for draft in collection("drafts").list():
        remember(draft.get("template_id"), draft.get("inputs") or {})
    configs = collection("template_configs").list()
    for config in configs:
        remember(config.get("template_id"), config)
    jobs = {config.get("job_id"): config.get("template_id") for config in configs}
    for kind, name in KINDS.items():
        for raw in collection(name).list():
            ident = raw["asset_id"]
            templates = set(references[kind, ident]) | references["media", ident]
            if jobs.get(raw.get("added_by_job_id")):
                templates.add(jobs[raw["added_by_job_id"]])
            if raw.get("template_id"):
                templates.add(raw["template_id"])
            origins = list(raw.get("resource_origins") or [])
            for template_id in sorted(templates):
                try:
                    context = resource_metadata(template_id=template_id)
                except ValueError:
                    continue
                origin = {k: context[k] for k in ("category_id", "category_name", "template_id", "template_name")}
                if origin not in origins:
                    origins.append(origin)
            if not origins:
                context = resource_metadata(raw.get("category", ""))
                origins = context.get("resource_origins", [])
            patch = {"media_type": kind, "category_id": raw.get("category_id", ""),
                     "category_name": raw.get("category_name", ""), "template_id": raw.get("template_id", ""),
                     "template_name": raw.get("template_name", ""), "resource_origins": origins}
            if origins and not patch["category_id"]:
                patch.update(origins[0])
            if any(raw.get(k) != v for k, v in patch.items()):
                yield name, ident, patch, raw.get("resource_origins")

async def migrate_provenance(apply=False):
    counts = {"updated": 0, "classified": 0, "unclassified": 0}
    for name, ident, patch, expected_origins in provenance_updates():
        counts["updated"] += 1
        counts["classified" if patch["category_id"] else "unclassified"] += 1
        if apply:
            updated = await collection(name).update(ident, patch, only_if={"resource_origins": expected_origins})
            if updated is None:
                raise RuntimeError("Resource metadata changed concurrently; rerun this resumable migration")
    return counts

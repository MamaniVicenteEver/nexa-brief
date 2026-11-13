"""Per-job background choice; never mutate the registered template/niche."""
from src.config.template_manifest import get_template_inputs
from src.core.job import AssetSourceType

def with_selected_background(niche, job):
    requirements = get_template_inputs(niche.template.template_id) or {}
    mixed_source = any(slot["kind"] == "image|video" and slot["target"] == "source"
                       for slot in requirements.get("media", []))
    if not mixed_source:
        return niche
    if job.input.video_source is not None:
        kind = "video"
    elif job.input.image_source.type != AssetSourceType.AUTO:
        kind = "image"
    else:
        return niche
    template = niche.template.model_copy(update={
        "requires_image": kind == "image", "requires_video": kind == "video",
        "media_src_filename": "bg.mp4" if kind == "video" else "bg.jpg",
    })
    return niche.model_copy(update={"template": template})

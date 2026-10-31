from __future__ import annotations

import copy
from dataclasses import replace
import hashlib

import pytest

from src.core.image_posts.plan import ImagePlan, ImagePlanError, MediaRef, plan_hash
from src.core.image_posts.render import reel_frame_manifest, render, render_reel
from src.adapters.data.local_image_post_resources import LocalImagePostResources
from src.core.image_posts.validate import validate_plan
import image_export

load_style = LocalImagePostResources().get_style


def make_plan(style=None) -> ImagePlan:
    style = style or load_style("node_tech")
    claim = {
        "id": "claim_bls",
        "source_id": "bls",
        "locator": "PLAN.md §3, afirmación 18",
        "url": "https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm",
    }
    return ImagePlan.from_dict(
        {
            "schema_version": 1,
            "plan_id": "plan_test_1",
            "category_id": style.category_id,
            "source_video_id": "video_test",
            "source_revision": "rev_1",
            "style_id": style.style_id,
            "style_version": style.version,
            "template_id": "daily_fact",
            "format": "4:5",
            "seed": 17,
            "renderer_version": image_export.RENDERER_VERSION,
            "slides": [
                {
                    "slide_id": "slide_01",
                    "order": 1,
                    "layout": "fact_with_source",
                    "elements": [{"type": "diagram", "value": "2025 → 2035"}],
                    "texts": [
                        {"role": "kicker", "value": "DATOS VERIFICADOS", "claim_refs": []},
                        {"role": "headline", "value": "Dos categorías", "claim_refs": ["claim_bls"]},
                        {"role": "stat", "value": "−7,3 %", "claim_refs": ["claim_bls"]},
                        {"role": "body", "value": "Una proyección del BLS.", "claim_refs": ["claim_bls"]},
                        {"role": "source", "value": "BLS · 2025–2035", "claim_refs": ["claim_bls"]},
                    ],
                    "media": [],
                    "claim_refs": [claim],
                }
            ],
        }
    )


def test_plan_rejects_unknown_fields() -> None:
    plan = make_plan()
    raw = plan.to_dict()
    raw["unplanned"] = True
    with pytest.raises(ImagePlanError, match="campos desconocidos"):
        ImagePlan.from_dict(raw)


def test_plan_hash_is_canonical_and_changes_with_style() -> None:
    plan = make_plan()
    style = load_style("node_tech")
    assert plan_hash(plan, style) == plan_hash(plan.to_dict(), style.to_dict())
    changed = copy.deepcopy(style.to_dict())
    changed["version"] = "1.0.1"
    assert plan_hash(plan, style) != plan_hash(plan, changed)


def test_plan_validates_category_style_claims_and_media_hash() -> None:
    style = load_style("node_tech")
    plan = make_plan(style)
    assert validate_plan(plan, style).passed

    slide = plan.slides[0]
    photo = replace(slide.elements[0], type="photo", asset_id="photo_1")
    media = {
        "asset_id": "photo_1",
        "sha256": "0" * 64,
        "license_id": "CC0",
        "author": "Archivo",
        "url": "https://example.org/photo.jpg",
    }
    modified_slide = replace(slide, elements=(photo,), media=(MediaRef.from_dict(media),))
    modified = replace(plan, slides=(modified_slide,))
    report = validate_plan(modified, style, media_bytes={"photo_1": b"wrong"})
    assert not report.passed
    assert any("hash incorrecto" in error for error in report.errors)


def test_five_slides_requires_exactly_five_assets() -> None:
    style = load_style("node_tech")
    plan = replace(make_plan(style), template_id="five_slides")
    report = validate_plan(plan, style)
    assert not report.passed
    assert any("requiere 5" in error for error in report.errors)


def test_render_manifest_has_technical_record_and_reproducible_bytes() -> None:
    style = load_style("node_tech")
    plan = make_plan(style)
    first = render(plan, style)
    second = render(plan, style)
    assert [asset.sha256 for asset in first.assets] == [asset.sha256 for asset in second.assets]
    assert first.assets[0].sha256 == hashlib.sha256(first.assets[0].content).hexdigest()
    assert (first.assets[0].width, first.assets[0].height) == (1080, 1350)
    assert first.assets[0].mime == "image/jpeg"
    assert first.assets[0].color_profile == "sRGB"
    record = first.to_record(plan)["technical"]
    assert record["composition_plan"]["plan_hash"] == first.plan_hash
    assert record["slides"][0]["bytes"] == len(first.assets[0].content)
    assert record["slides"][0]["sha256"] == first.assets[0].sha256
    assert "content" not in record["slides"][0]


def test_reel_frame_contract_is_9_by_16_at_30_fps() -> None:
    style = load_style("node_tech")
    frame_set = reel_frame_manifest(make_plan(style), style)
    assert (frame_set.width, frame_set.height) == (1080, 1920)
    assert frame_set.fps == 30
    assert frame_set.duration_seconds == 15
    assert frame_set.frame_count == 450


@pytest.mark.asyncio
async def test_reel_renderer_emits_a_hashed_png_frame() -> None:
    style = load_style("node_tech")
    frames = render_reel(make_plan(style), style)
    frame = await anext(frames)
    await frames.aclose()
    assert (frame.width, frame.height, frame.mime) == (1080, 1920, "image/png")
    assert frame.sha256 == hashlib.sha256(frame.content).hexdigest()

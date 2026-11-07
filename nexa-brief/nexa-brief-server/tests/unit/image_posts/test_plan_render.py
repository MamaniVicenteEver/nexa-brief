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


def test_new_plan_default_does_not_change_legacy_plan_format() -> None:
    from src.core.image_posts.plan import build_image_plan
    from src.core.image_posts.profiles import DEFAULT_IMAGE_FORMAT

    style = load_style("node_tech")
    legacy = replace(make_plan(style), format="9:16")
    fresh = build_image_plan(
        category_id=legacy.category_id,
        source_video_id=legacy.source_video_id,
        source_revision=legacy.source_revision,
        template_id=legacy.template_id,
        slides=[slide.to_dict() for slide in legacy.slides],
        style=style,
    )
    assert fresh.format == DEFAULT_IMAGE_FORMAT == "4:5"
    assert ImagePlan.from_dict(legacy.to_dict()).format == "9:16"
    assert plan_hash(legacy, style) != plan_hash(replace(legacy, format="4:5"), style)


@pytest.mark.parametrize("format,size", [("4:5", (1080, 1350)), ("3:5", (1080, 1800)), ("9:16", (1080, 1920))])
def test_image_exports_use_the_selected_profile(format, size) -> None:
    from src.core.image_posts.validate import validate_jpeg

    style = load_style("node_tech")
    plan = replace(make_plan(style), format=format)
    assert validate_plan(plan, style).passed
    manifest = render(plan, style)
    asset = manifest.assets[0]
    assert (asset.width, asset.height) == size
    assert asset.aspect_ratio == format
    assert validate_jpeg(asset.content, style, expected_size=size, qc=asset.qc).passed
    assert all(item["passed"] for item in manifest.to_record(plan)["technical"]["validations"])
    assert manifest.to_record(plan)["technical"]["validations"][0]["details"]["jpeg_quality"] == 95


def test_unknown_image_dimensions_are_rejected() -> None:
    from src.core.image_posts.profiles import get_image_profile

    with pytest.raises(ValueError, match="Formato de imagen no admitido"):
        get_image_profile("1:1")
    assert not validate_plan(replace(make_plan(), format="1:1"), load_style("node_tech")).passed


@pytest.mark.asyncio
async def test_live_preview_matches_export_stage_without_network_or_text_execution() -> None:
    import io
    from PIL import Image, ImageChops
    from playwright.async_api import async_playwright

    style = load_style("node_tech")
    plan = replace(make_plan(style), format="9:16")
    html = image_export.build_preview_html(plan, style, slide_id=plan.slides[0].slide_id)
    assert "http://127.0.0.1" not in html
    assert "Content-Security-Policy" in html
    outputs, _, _ = await image_export._render_pngs(plan, style, {}, size=(1080, 1920))
    requests = []
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=image_export.shoot.CHROMIUM)
        page = await browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        page.on("request", lambda request: requests.append(request.url))
        await page.set_content(html, wait_until="domcontentloaded")
        await page.wait_for_function("window.__imagePreviewReady === true")
        preview = await page.screenshot(type="png", animations="disabled")
        assert await page.locator(".has-editorial-grid").count() == 1
        assert requests == []
        difference = ImageChops.difference(Image.open(io.BytesIO(outputs[0][0])).convert("RGB"), Image.open(io.BytesIO(preview)).convert("RGB"))
        assert difference.getbbox() is None
        # The product uses an opaque sandboxed iframe rather than document access.
        from html import escape
        container = await browser.new_page()
        await container.set_content('<iframe sandbox="allow-scripts" style="width:540px;height:960px;border:0" srcdoc="' + escape(html, quote=True) + '"></iframe>')
        frame = container.frames[1]
        await frame.wait_for_function("window.__imagePreviewReady === true")
        bounds = await frame.locator(".ie-root").bounding_box()
        assert bounds["width"] == 540 and bounds["height"] == 960
        # Editorial text is payload data, never concatenated into executable HTML.
        malicious = "</script><script>window.previewInjected=1</script>"
        slide = plan.slides[0]
        text = replace(slide.texts[0], value=malicious)
        safe_plan = replace(plan, slides=(replace(slide, texts=(text, *slide.texts[1:])),))
        safe_html = image_export.build_preview_html(safe_plan, style, slide_id=slide.slide_id)
        assert malicious not in safe_html
        safe_page = await browser.new_page(viewport={"width": 1080, "height": 1920})
        await safe_page.set_content(safe_html, wait_until="domcontentloaded")
        await safe_page.wait_for_function("window.__imagePreviewReady === true")
        assert await safe_page.evaluate("typeof window.previewInjected") == "undefined"
        assert await safe_page.locator(".ie-kicker").text_content() == malicious
        await browser.close()


def test_preview_fonts_are_lossless_assets_with_safe_ttf_fallback(monkeypatch, tmp_path) -> None:
    import json
    style = load_style("node_tech")
    original = image_export._font_payload(style)
    compressed, formats = image_export._preview_font_payload(style)
    assert all(value == "woff2" for value in formats.values())
    assert all(value.startswith(b"wOF2") for value in compressed.values())
    assert sum(map(len, compressed.values())) < sum(map(len, original.values())) * .4
    monkeypatch.setattr(image_export, "PREVIEW_FONTS", tmp_path)
    fallback, fallback_formats = image_export._preview_font_payload(style)
    assert fallback == original
    assert all(value == "truetype" for value in fallback_formats.values())
    asset = style.font_assets[0]
    (tmp_path / "bad.woff2").write_bytes(b"corrupted")
    (tmp_path / "manifest.json").write_text(json.dumps({"schema_version": 1, "format": "woff2", "fonts": [{
        "source_sha256": asset.sha256, "preview_path": "bad.woff2", "sha256": "0"*64,
    }]}))
    with pytest.raises(image_export.ImageExportError, match="verificar la fuente"):
        image_export._preview_font_payload(style)


@pytest.mark.parametrize("category", ["node_tech", "node_history"])
@pytest.mark.asyncio
async def test_compressed_preview_preserves_all_four_font_families_pixel_for_pixel(category) -> None:
    import io
    import json
    from PIL import Image, ImageChops
    from playwright.async_api import async_playwright
    from src.core.image_posts.plan import Element

    style = load_style(category)
    original = make_plan(style)
    slide = replace(original.slides[0], layout="am_visual", elements=(Element(type="diagram", value=json.dumps({
        "kind": "timeline", "label": "DATOS", "items": [
            {"label": "1957", "detail": "Una fecha comprobada y su contexto."},
            {"label": "2026", "detail": "Otra fecha y una conclusión verificable."},
        ],
    })),))
    plan = replace(original, format="9:16", slides=(slide,))
    outputs, _, _ = await image_export._render_pngs(plan, style, {}, size=(1080, 1920))
    html = image_export.build_preview_html(plan, style, slide_id=slide.slide_id)
    assert len(html.encode()) < 650_000
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(executable_path=image_export.shoot.CHROMIUM)
        page = await browser.new_page(viewport={"width": 1080, "height": 1920}, device_scale_factor=1)
        await page.set_content(html, wait_until="domcontentloaded")
        await page.wait_for_function("window.__imagePreviewReady === true")
        preview = await page.screenshot(type="png", animations="disabled")
        difference = ImageChops.difference(Image.open(io.BytesIO(outputs[0][0])).convert("RGB"), Image.open(io.BytesIO(preview)).convert("RGB"))
        assert difference.getbbox() is None
        await browser.close()

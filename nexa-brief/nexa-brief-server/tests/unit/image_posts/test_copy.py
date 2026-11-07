from __future__ import annotations

from dataclasses import replace

import pytest

from src.core.image_posts.copy import CopyError, build_copy
from src.core.image_posts.plan import MediaRef
from src.core.image_posts.validate import validate_copy
from test_plan_render import make_plan


def publish_v2() -> dict:
    return {
        "schema_version": 2,
        "titles": {"facebook": {"title": "Dos categorías, dos proyecciones"}},
        "description": {
            "hook": "Una tabla proyecta cambios distintos.",
            "question": "¿Qué significa esta diferencia?",
        },
        "sources": ["BLS: https://www.bls.gov/emp/tables/occupational-projections-and-characteristics.htm"],
        "tags": {"facebook": ["#Tecnología", "#Programación"]},
        "pinned_comment": "¿Qué tarea revisarías siempre?",
    }


def test_copy_uses_verified_plan_and_adds_platform_alt_text() -> None:
    plan = make_plan()
    copy = build_copy(plan, publish_v2(), title_override="Dos categorías")
    assert copy.title == "Dos categorías"
    assert copy.facebook.first_comment is None
    assert len(copy.facebook.alt_texts) == len(plan.slides)
    assert "Fuentes:" not in copy.facebook.caption
    assert "https://" not in copy.instagram.caption
    assert "Desliza" not in copy.instagram.caption
    assert copy.instagram.caption == "Dos categorías\n\n¿Qué significa esta diferencia?\n\n#Tecnología #Programación"
    assert copy.instagram.caption.count("#") <= 5
    assert validate_copy(copy, plan).passed


def test_copy_keeps_public_caption_brief_without_generating_comments() -> None:
    plan = make_plan()
    photo = MediaRef(
        asset_id="photo-1", sha256="a" * 64, license_id="CC BY 2.0", author="Fotógrafa",
        url="https://commons.wikimedia.org/wiki/File:Photo.jpg",
        license_url="https://creativecommons.org/licenses/by/2.0/",
        changes="recortada y convertida a B/N",
    )
    slides = (replace(plan.slides[0], media=(photo,)), *plan.slides[1:])
    copy = build_copy(replace(plan, slides=slides), publish_v2())

    for network in (copy.facebook, copy.instagram):
        assert network.first_comment is None
        assert "https://" not in network.caption
        assert "Créditos visuales" not in network.caption
    assert slides[0].media[0] == photo


def test_copy_rejects_missing_claim_evidence() -> None:
    plan = make_plan()
    without_claims = replace(plan.slides[0], claim_refs=())
    plan = replace(plan, slides=(without_claims,))
    with pytest.raises(CopyError, match="afirmaciones"):
        build_copy(plan, publish_v2())


def test_copy_validates_caption_and_title_limits() -> None:
    plan = make_plan()
    copy = build_copy(plan, publish_v2())
    too_long = replace(copy, title="x" * 61, instagram=replace(copy.instagram, caption="x" * 2201))
    report = validate_copy(too_long, plan)
    assert not report.passed
    assert any("60 caracteres" in error for error in report.errors)
    assert any("2.200" in error for error in report.errors)


def test_copy_removes_urls_and_case_duplicate_hashtags():
    data = publish_v2()
    data["titles"]["facebook"]["title"] = "Dos categorías https://example.org/info"
    data["description"]["question"] = "¿Qué opinas? https://example.org"
    data["tags"]["facebook"] = ["#Programadores", "#programadores", "#IA"]
    result = build_copy(make_plan(), data)
    assert result.facebook.caption == "Dos categorías\n\n¿Qué opinas?\n\n#Programadores #IA"
    assert result.instagram.caption == result.facebook.caption

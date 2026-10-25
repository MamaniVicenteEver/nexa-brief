from __future__ import annotations

from dataclasses import replace

import pytest

from src.core.image_posts.copy import CopyError, build_copy
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
    assert copy.facebook.first_comment == "¿Qué tarea revisarías siempre?"
    assert len(copy.facebook.alt_texts) == len(plan.slides)
    assert "Fuentes:" in copy.facebook.caption
    assert "BLS" in copy.instagram.caption
    assert copy.instagram.caption.count("#") <= 5
    assert validate_copy(copy, plan).passed


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

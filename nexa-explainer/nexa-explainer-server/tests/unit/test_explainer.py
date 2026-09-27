from src.explainer.models import CompositionSpec, ExplainerTemplateId, SceneKind, SemanticScene, VisualTreatment
from src.explainer.editorial_recut import build_editorial_plan, build_editorial_recut_html
from src.explainer.service import _normalize_scenes
from src.explainer.templates import TEMPLATE_CATALOG, build_explainer_html, get_template_manifest


def _scene(index: int, start: float, end: float) -> dict:
    return {
        "id": f"scene-{index}",
        "kind": "concept",
        "start": start,
        "end": end,
        "title": "Una idea clara",
        "body": "Una explicación breve para la audiencia.",
        "highlight": "Mensaje clave",
        "icon": "layers",
        "priority": 1,
    }


def test_explainer_has_ten_closed_templates_and_full_manifests() -> None:
    assert {item["id"] for item in TEMPLATE_CATALOG} == {
        "editorial-split",
        "data-brief",
        "signal-minimal",
        "immersive-overlay",
        "centered-rails",
        "kinetic-voice",
        "field-notes",
        "product-signal",
        "systems-map",
        "spatial-orbit",
    }
    assert all("SVG" in item["icon_system"] or "Three.js" in item["icon_system"] for item in TEMPLATE_CATALOG)
    for item in TEMPLATE_CATALOG:
        manifest = get_template_manifest(item["id"])
        assert manifest["palette"]
        assert manifest["typography_system"]
        assert manifest["motion"]["transitions"]
        assert manifest["ai_contract"]["rule"]
        assert manifest["extensions"]["semantic_overlay"]["visual_treatments"]

    assert get_template_manifest("editorial-split")["layout"] != get_template_manifest("data-brief")["layout"]
    assert "cifra con fuente" in get_template_manifest("data-brief")["components"]
    assert "presentador centrado" in get_template_manifest("centered-rails")["components"]
    spatial = get_template_manifest("spatial-orbit")
    assert "Three.js 0.181.2" in spatial["tools"]
    assert "WebGL" in spatial["tools"]
    assert "escena Three.js" in spatial["components"]


def test_scene_normalization_sorts_and_clamps() -> None:
    scenes = _normalize_scenes(
        [_scene(2, 4, 8), _scene(1, -2, 4), {"kind": "unknown", "start": 8, "end": 12}],
        10,
    )
    assert len(scenes) == 2
    assert scenes[0].start == 0
    assert scenes[0].end <= scenes[1].start
    assert scenes[-1].end <= 10


def test_scene_normalization_rejects_an_unproven_statistic() -> None:
    scenes = _normalize_scenes(
        [{**_scene(1, 0, 4), "kind": "stat", "evidence": "sin cifra"}],
        10,
    )
    assert scenes[0].kind == SceneKind.CONCEPT


def test_template_html_is_self_contained_and_uses_inline_icons() -> None:
    composition = CompositionSpec(
        template_id=ExplainerTemplateId.DATA_BRIEF,
        scenes=[
            SemanticScene(
                id="scene-01",
                kind=SceneKind.HOOK,
                start=0,
                end=3,
                title="El mensaje principal",
                body="Una idea para revisar.",
                highlight="Dato clave",
                icon="chart",
                visual_treatment=VisualTreatment.DATA,
            )
        ],
    )
    html = build_explainer_html(composition)
    assert 'src="presenter.mp4"' in html
    assert "data-template=\"data-brief\"" in html
    assert "viewBox=\"0 0 120 120\"" in html
    assert "emoji" not in html.lower()
    assert "NEXA EXPLAINER" not in html
    assert "scene-count" not in html
    assert 'class="semantic-presenter"' in html


def test_every_template_keeps_its_identity_with_an_additive_semantic_layer() -> None:
    composition = CompositionSpec(
        template_id=ExplainerTemplateId.IMMERSIVE_OVERLAY,
        scenes=[
            SemanticScene(
                id="scene-01",
                kind=SceneKind.HOOK,
                start=0,
                end=3,
                title="La idea principal",
                body="Una idea para revisar.",
                highlight="Mensaje clave",
                icon="focus",
            )
        ],
    )
    html = build_explainer_html(composition)
    assert 'data-template="immersive-overlay"' in html
    assert 'class="semantic-stage"' in html
    assert 'class="semantic-side"' in html
    assert 'data-template="immersive-overlay"' in html
    assert "adaptive-footer" not in html


def test_centered_rails_keeps_its_original_rail_contract() -> None:
    composition = CompositionSpec(
        template_id=ExplainerTemplateId.CENTERED_RAILS,
        scenes=[
            SemanticScene(
                id="scene-01",
                kind=SceneKind.CONCEPT,
                start=0,
                end=3,
                title="La idea principal",
                body="Una explicación que acompaña al presentador.",
                highlight="Ejemplo visual",
                icon="layers",
            )
        ],
    )
    html = build_explainer_html(composition)
    manifest = get_template_manifest("centered-rails")
    assert 'data-template="centered-rails"' in html
    assert 'class="semantic-presenter"' in html
    assert 'class="semantic-visual is-hidden"' in html
    assert "subtitle" not in html
    assert "eje central" in manifest["layout"]["presenter"]
    assert "rail de idea" in manifest["components"]


def test_new_template_family_uses_a_single_semantic_visual() -> None:
    composition = CompositionSpec(
        template_id=ExplainerTemplateId.SYSTEMS_MAP,
        scenes=[
            SemanticScene(
                id="scene-01",
                kind=SceneKind.CONCEPT,
                start=0,
                end=3,
                title="Una relación",
                body="Explica un sistema sin convertir el video en una presentación.",
                highlight="Nodo activo",
                visual_treatment=VisualTreatment.PROCESS,
            )
        ],
    )
    html = build_explainer_html(composition)
    assert 'data-template="systems-map"' in html
    assert 'class="semantic-video"' in html
    assert 'data-treatment="process"' in html
    assert "process:'<svg" in html


def test_spatial_orbit_uses_seekable_three_renderer() -> None:
    composition = CompositionSpec(
        template_id=ExplainerTemplateId.SPATIAL_ORBIT,
        scenes=[
            SemanticScene(
                id="scene-01",
                kind=SceneKind.CONCEPT,
                start=0,
                end=3,
                title="La idea entra en el campo",
                body="Un nodo activa la relación explicada por la voz.",
                highlight="Nodo activo",
                icon="orbit",
                visual_treatment=VisualTreatment.PROCESS,
            )
        ],
    )
    html = build_explainer_html(composition)
    assert 'data-template="spatial-orbit"' in html
    assert 'three@0.181.2' in html
    assert "hf-seek" in html
    assert "requestAnimationFrame" not in html
    assert 'class="spatial-canvas"' in html


def test_editorial_recut_emits_a_complete_director_contract() -> None:
    plan = build_editorial_plan(
        182.413,
        source_label="Obama source",
        audio_provider="local",
    )
    assert plan.mode == "source_led_editorial_recut"
    assert plan.duration_seconds == 187.913
    assert plan.actions[0].type == "intro"
    assert any(action.type == "phase" for action in plan.actions)
    assert any(action.type == "cut" for action in plan.actions)
    assert plan.audio["source_voice_imitation"] is False
    assert plan.quality_gates
    html = build_editorial_recut_html(plan)
    assert "DOBLAJE SINTÉTICO EN ESPAÑOL" in html
    assert 'data-mode="source-led-editorial-recut"' in html
    assert "no imita la voz" in plan.audio["disclosure"]

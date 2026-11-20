"""Selected lyric backgrounds preserve visibility through saved config."""
from pathlib import Path

import pytest
from pydantic import ValidationError

from src.core.template_inputs import TemplateInputs
from src.modules import template_inputs_applier


@pytest.mark.parametrize("value", [-0.01, 1.01, float("inf"), float("nan")])
def test_opacity_rejects_values_outside_range(value):
    with pytest.raises(ValidationError):
        TemplateInputs(media_opacity={"background": value})


@pytest.mark.asyncio
@pytest.mark.parametrize("template_id", ["lyrics-impact", "lyrics-romantic", "lyrics-suave", "lyrics-triste"])
@pytest.mark.parametrize("opacity", [None, 0, 0.4, 1])
async def test_selected_background_is_visible_and_persisted(template_id, opacity, tmp_path, monkeypatch):
    monkeypatch.setattr(template_inputs_applier, "get_template_inputs", lambda _: {
        "texts": [], "media": [{"slot": "background", "target": "source"}],
    })
    original = {"bg": {"src": "bg.mp4", "type": "video", "filter": "brightness(0.2)"}}
    inputs = TemplateInputs(media={"background": ["selected"]}, media_opacity={} if opacity is None else {"background": opacity})
    result = await template_inputs_applier.apply_template_inputs(original, inputs, template_id, tmp_path)
    assert result["bg"]["opacity"] == (0.8 if opacity is None else opacity)
    assert result["bg"]["src"] == "bg.mp4"
    assert "opacity" not in original["bg"]


@pytest.mark.asyncio
@pytest.mark.parametrize("template_id,media", [
    ("lyrics-impact", {}), ("another-template", {"background": ["selected"]}),
])
async def test_demo_and_other_templates_keep_original_style(template_id, media, tmp_path, monkeypatch):
    monkeypatch.setattr(template_inputs_applier, "get_template_inputs", lambda _: {
        "texts": [], "media": [{"slot": "background", "target": "source"}],
    })
    config = {"bg": {"src": "demo.jpg", "filter": "brightness(0.2)"}}
    result = await template_inputs_applier.apply_template_inputs(
        config, TemplateInputs(media=media, media_opacity={"background": 0.4}), template_id, tmp_path,
    )
    assert result == config

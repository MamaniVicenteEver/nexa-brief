"""Un mapa continuo se valida por hitos narrados sin inventar cortes."""
import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location(
    "scene_count", Path(__file__).parents[2] / "src/templates/_tools/explainer-kit/tools/scene_count.py"
)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def test_regular_beats_keep_the_existing_count():
    assert module.storyboard_moments({"beats": [{"use": "imperio.map"}] * 15}, {}) == 15


def test_only_distinct_spoken_campaign_targets_count():
    targets = [
        {"at": "Taiwan", "label": "Taiwán", "time": "@Taiwán"},
        {"at": "Korea", "label": "Corea", "time": "@anexó Corea+0.45"},
        {"at": "Korea", "label": "Corea duplicada", "time": "@anexó Corea+0.8"},
        {"at": "France", "label": "Francia", "time": "@no se dice"},
        {"label": "sin destino", "time": "@Taiwán"},
    ]
    story = {"beats": [{"use": "imperio.title"}, {"use": "imperio.campaign", "params": {"targets": targets}}]}
    assert module.storyboard_moments(story, {"segments": [{"text": "Taiwán. Japón anexó Corea."}]}) == 3


def test_unrelated_components_cannot_inflate_the_count():
    story = {"beats": [{"use": "common.clip", "params": {"targets": [{"time": "@Corea"}] * 20}}]}
    assert module.storyboard_moments(story, {"segments": [{"text": "Corea"}]}) == 1

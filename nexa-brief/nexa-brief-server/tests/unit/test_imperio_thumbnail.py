"""Las miniaturas móviles de Imperio conservan su composición nativa A/B."""
import asyncio
import importlib.util
import sys
from pathlib import Path

import pytest
from PIL import Image

TOOLS = Path(__file__).resolve().parents[2] / 'src/templates/_tools/explainer-kit/tools'
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('imperio_thumbnail_tool', TOOLS / 'thumbnail.py')
thumbnail = importlib.util.module_from_spec(spec)
spec.loader.exec_module(thumbnail)


@pytest.mark.parametrize('component,params', [
    ('imperio.introv1', {'text': 'DOS DISPAROS\n^CINCO POTENCIAS^'}),
    ('imperio.introv2', {'text': 'DOS DISPAROS', 'src': '/_tools/explainer-kit/showcase/samples/mauerbau.jpg'}),
])
def test_mobile_capture_preserves_native_opening(tmp_path, monkeypatch, component, params):
    async def native_moment(page, at):
        assert not await page.evaluate('Boolean(window.__tabloidLayout)')
        names = await page.evaluate('window.__promo.beats.map(beat => beat.use)')
        assert component in names
        return at
    monkeypatch.setattr(thumbnail, 'stable_moment', native_moment)
    out = tmp_path / 'native.jpg'
    errors = asyncio.run(thumbnail.capture(out, 'imperio', component, params, 4.5, '9x16'))
    assert not errors
    assert Image.open(out).size == (1080, 1920)

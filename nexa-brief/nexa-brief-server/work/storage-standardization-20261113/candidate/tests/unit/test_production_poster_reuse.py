"""Route changes preserve existing component images and do not select other styles."""
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from PIL import Image

from scripts import generate_showcase_posters as generator
from src.adapters.showcase import posters


@pytest.mark.asyncio
@pytest.mark.parametrize('namespace', ['sandbox/nodepolitics', 'bundled/nodeatlas'])
async def test_only_missing_keeps_image_bytes_and_timestamp_despite_revision_and_route_change(tmp_path, monkeypatch, namespace):
    ident = 'sandbox-stable'
    target = f'/api/v1/explainer/files/{namespace}/demo/showcase.html?only=title&estilo=original'
    design = SimpleNamespace(id=ident, revision='new-revision', engine_id='nodehistory/_atlas')
    entry = SimpleNamespace(id='noticiero.title', preview_kind='iframe', preview_url=target)
    calls = []
    class Service:
        def list_designs(self):
            return SimpleNamespace(designs=[design])
        def catalog(self, design_id, style):
            calls.append(style)
            return SimpleNamespace(entries=[entry])
        def styles(self, *_):
            raise AssertionError('Unselected styles must not be enumerated')
    monkeypatch.setattr(generator, 'get_showcase_service', Service)
    monkeypatch.setattr(generator, 'layout_for_settings', lambda _: SimpleNamespace(cache_dir=tmp_path, sandbox_dir=tmp_path/'sandbox'))
    monkeypatch.setattr(generator, '_styled_target', lambda *args: target)
    monkeypatch.setattr(posters, 'source_revision', lambda *args: 'new-source-revision')
    capture = AsyncMock(side_effect=AssertionError('Existing image must never be captured again'))
    monkeypatch.setattr(generator, 'capture', capture)
    path = posters.poster_path(tmp_path, ident, 'old-revision', entry.id, '16x9', target, engine=design.engine_id)
    path.parent.mkdir(parents=True)
    Image.new('RGB', (32, 18), 'green').save(path, 'WEBP')
    before = path.read_bytes(), path.stat().st_mtime_ns
    args = SimpleNamespace(design=[ident], all=False, component=None, miniaturas=False, estilo=['original'],
        all_styles=False, force=False, only_missing=True, frame='middle', allow_last_visible=False, limit=0)
    assert await generator.generate(args) == 0
    assert (path.read_bytes(), path.stat().st_mtime_ns) == before
    assert calls == ['original']
    capture.assert_not_called()

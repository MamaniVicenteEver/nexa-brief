import json

from src.core.explainer import sandbox_components, sandbox
from src.presentation.api.routers.sandbox import get_sandbox_components


def test_catalog_reads_nested_and_survives_invalid_info(tmp_path, monkeypatch):
    root = tmp_path / 'sandbox'
    item = root / 'historia' / 'sub' / 'mapa'
    item.mkdir(parents=True)
    (item / 'index.html').write_text('')
    info = item / 'info.json'
    info.write_text(json.dumps({'title': 'Mapa', 'summary': 'Un mapa animado', 'components': [
        {'name': 'mapa.uno', 'label': 'Uno', 'summary': 'Uno', 'default': True},
        {'name': 'inválido'},
    ]}))
    broken = root / 'historia' / 'en-obra'
    broken.mkdir()
    (broken / 'index.html').write_text('')
    (broken / 'info.json').write_text('{')
    ref = root / 'referencias' / 'historia' / 'video'
    ref.mkdir(parents=True)
    (ref / 'info.json').write_text('{}')
    monkeypatch.setattr(sandbox, 'SANDBOX_DIR', root)
    import asyncio
    rows = asyncio.run(get_sandbox_components())
    assert {r['id'] for r in rows} == {'mapa', 'en-obra'}
    row = next(r for r in rows if r['id'] == 'mapa')
    assert row['subcategory'] == 'sub' and row['has_components']
    assert row['summary'] == 'Un mapa animado'
    from src.presentation.api.schemas.explainer_schema import SandboxComponentsResponse
    assert SandboxComponentsResponse(**row).summary == 'Un mapa animado'
    assert [c['name'] for c in row['components']] == ['mapa.uno']
    info.write_text('{"title": "Nuevo", "components": []}')
    assert next(r for r in sandbox_components.list_components(root) if r['id'] == 'mapa')['title'] == 'Nuevo'

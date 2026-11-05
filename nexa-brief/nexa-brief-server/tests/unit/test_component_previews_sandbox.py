import json
from types import SimpleNamespace
from urllib.parse import parse_qs, urlparse

import pytest
from pydantic import ValidationError

from src.core.explainer import component_preview, sandbox, sandbox_info
from src.presentation.api.schemas.component_preview_schema import ComponentPreviewItem
from src.presentation.api.schemas.explainer_schema import SandboxInfoResponse, SandboxItemResponse


@pytest.fixture
def prototype(tmp_path, monkeypatch):
    root = tmp_path / 'sandbox'
    item = root / 'nodehistory' / 'atlas-demo'
    item.mkdir(parents=True)
    (item / 'index.html').write_text('<script src="_proto/proto.js"></script>')
    components = [
        {'name': 'atlas.uno', 'label': 'Uno', 'summary': 'Primero', 'group': 'outro', 'default': True,
         'params': {'velocidad': {'type': 'number', 'default': 2, 'min': 1, 'max': 3},
                    'estilo': {'type': 'string', 'default': 'a', 'options': ['a', 'b']},
                    'image': {'type': 'string', 'default': ''}}},
        {'name': 'atlas.dos', 'label': 'Dos', 'summary': 'Segundo', 'group': 'outro'},
        {'name': 'atlas.fichas', 'label': 'Fichas', 'summary': 'Fotos', 'default': True},
    ]
    (item / 'info.json').write_text(json.dumps({'components': components}))
    monkeypatch.setattr(sandbox, 'SANDBOX_DIR', root)
    return root, item, components


def request(**kwargs):
    return ComponentPreviewItem(key='a', video_id='atlas-demo', component='atlas.uno', scope='sandbox', **kwargs)


def test_preview_selection_and_parameters(prototype):
    result = component_preview.build_component_previews([request(components=['atlas.fichas'], params={'velocidad': 3})])[0]
    assert result['design'] == ''
    url = urlparse(result['preview_url'])
    assert url.path == '/api/v1/explainer/files/sandbox/nodehistory/atlas-demo/index.html'
    assert parse_qs(url.query) == {'controls': ['1'], 'c': ['atlas.uno', 'atlas.fichas'], 'cx': ['1'],
                                   'p': ['{"atlas.uno":{"velocidad":3}}']}
    component_preview.build_component_previews([request(time_seconds=100, duration_seconds=100)])
    assert 'cx' not in parse_qs(urlparse(component_preview.build_component_previews([request()])[0]['preview_url']).query)
    assert parse_qs(urlparse(component_preview.build_component_previews([request(components=[])])[0]['preview_url']).query)['cx'] == ['1']


def test_undeclared_and_invalid_params(prototype):
    for item in [request(components=['atlas.ausente']), request(params={'otro': 1}),
                 request(params={'velocidad': True}), request(params={'velocidad': 4}),
                 request(params={'estilo': 'c'}), request(params={'image': 'javascript:alert(1)'}),
                 request(params={'image': 'á' * 5000})]:
        with pytest.raises(component_preview.ComponentPreviewError):
            component_preview.build_component_previews([item])


def test_ambiguous(prototype):
    root, _, _ = prototype
    other = root / 'nodeaction' / 'atlas-demo'
    other.mkdir(parents=True)
    (other / 'index.html').write_text('')
    with pytest.raises(component_preview.ComponentPreviewError, match='ambiguo'):
        component_preview.build_component_previews([request()])


def test_kit_and_mixed_batch(prototype, monkeypatch):
    monkeypatch.setattr(component_preview, 'get_video', lambda _: SimpleNamespace(design='atlas'))
    monkeypatch.setattr(component_preview, '_registered_component', lambda *_: True)
    kit = ComponentPreviewItem(key='kit', video_id='kit-demo', component='atlas.uno', params={'x': 1})
    results = component_preview.build_component_previews([kit, request()])
    assert results[0]['design'] == 'atlas'
    assert parse_qs(urlparse(results[0]['preview_url']).query)['solo'] == ['1']
    assert results[1]['design'] == ''
    with pytest.raises(ValidationError):
        ComponentPreviewItem(key='kit', video_id='kit-demo', component='atlas.uno', components=[])


def test_info_and_listing(prototype):
    root, item, components = prototype
    assert SandboxInfoResponse.model_validate(sandbox_info.get_sandbox_info(root, 'nodehistory', 'atlas-demo')).components == components
    listing = sandbox.list_sandbox(root)[0].items[0]
    assert SandboxItemResponse.model_validate(vars(listing)).has_components
    (item / 'info.json').write_text('{}')
    assert sandbox_info.get_sandbox_info(root, 'nodehistory', 'atlas-demo')['components'] == []
    assert not sandbox.list_sandbox(root)[0].items[0].has_components
    (item / 'info.json').write_text('{invalid')
    assert not sandbox.list_sandbox(root)[0].items[0].has_components


def test_invalid_declarations_are_omitted(prototype, caplog):
    _, item, components = prototype
    components[0]['default'] = False
    components.append({'name': 'atlas.mal', 'label': 'Mal', 'summary': 'Mal', 'params': {'x': {'type': []}}})
    (item / 'info.json').write_text(json.dumps({'components': components}))
    assert [c['name'] for c in sandbox_info.load_declared_components(item / 'info.json')] == ['atlas.fichas']
    assert caplog.records


async def test_http_preview_and_info(prototype, api_client):
    payload = {'previews': [{'key': 'a', 'video_id': 'atlas-demo', 'scope': 'sandbox',
                             'component': 'atlas.uno', 'components': ['atlas.fichas'],
                             'params': {'velocidad': 3}}]}
    response = await api_client.post('/api/v1/explainer/component-previews', json=payload)
    assert response.status_code == 200
    assert response.json()['previews'][0]['preview_url'].endswith(
        '?controls=1&c=atlas.uno&c=atlas.fichas&cx=1&p=%7B%22atlas.uno%22%3A%7B%22velocidad%22%3A3%7D%7D')
    payload['previews'][0]['component'] = 'atlas.ausente'
    assert (await api_client.post('/api/v1/explainer/component-previews', json=payload)).status_code == 422
    info = await api_client.get('/api/v1/explainer/sandbox/nodehistory/atlas-demo/info')
    assert info.status_code == 200
    assert len(info.json()['components']) == 3
    listing = await api_client.get('/api/v1/explainer/sandbox')
    assert listing.json()[0]['items'][0]['has_components'] is True

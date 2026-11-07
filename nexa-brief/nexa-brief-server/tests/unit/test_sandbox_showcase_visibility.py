"""Opt-in visibility never moves a project or changes an existing shared design."""
import hashlib
import json
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from src.adapters.data.json_store import JsonDataStore
from src.adapters.showcase.shared_definitions import SharedDefinitionsShowcaseAdapter
from src.config.settings import settings
from src.core.showcase.ports import ShowcaseConflict, ShowcaseInvalid, ShowcaseNotFound
from src.core.showcase.service import ShowcaseService
from src.presentation.api.routers import showcase

TEMPLATES = Path(__file__).resolve().parents[2] / 'src/templates'


def project(root, name='pizarra-demo', *, catalog=False):
    directory = root / 'sandbox/nodeaction' / name
    directory.mkdir(parents=True)
    (directory / 'index.html').write_text('<html>principal</html>')
    info = {'title': name, 'engine': 'nodeaction/_pizarra'}
    if catalog:
        info['catalog'] = {'components': 'components.json', 'gallery': 'gallery.html',
                           'tabs': [{'id': 'textos', 'label': 'Textos', 'families': ['text']}]}
        (directory / 'components.json').write_text(json.dumps([
            {'name': 'text.title', 'label': 'Título', 'summary': 'Un título', 'preview': {'bg': 'white'}},
            {'name': 'card.main', 'label': 'Tarjeta', 'kind': 'json', 'demo': {'text': 'fixture'}},
        ]))
        (directory / 'gallery.html').write_text('<html>componentes</html>')
    (directory / 'info.json').write_text(json.dumps(info))
    return directory


@pytest.fixture
def service(tmp_path, monkeypatch):
    root = tmp_path / 'profile'
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', root / 'data')
    adapter = SharedDefinitionsShowcaseAdapter(root, TEMPLATES, data_store=JsonDataStore())
    return ShowcaseService(adapter), root


def test_opt_in_persists_only_json_and_keeps_existing_designs(service):
    svc, root = service
    directory = project(root, catalog=True)
    before = {p.name: p.read_bytes() for p in directory.iterdir() if p.is_file()}
    existing = svc.list_designs().model_dump()
    assert len(existing['designs']) == 19
    assert {'atlas-cinematico', 'cara-a-cara', 'vida-en-escena'} <= {
        d['id'] for d in existing['designs'] if d['state'] == 'prueba'}
    state = svc.sandbox_visibility()[0]
    assert not state.visible and state.managed and state.component_count == 2
    assert svc.repository.get_design(state.design_id) is None
    enabled = svc.set_sandbox_visibility('nodeaction', 'pizarra-demo', True)
    assert enabled.visible
    assert svc.get_design(enabled.design_id).state == 'prueba'
    assert not svc.get_design(enabled.design_id).promotable
    assert svc.list_designs().model_dump()['designs'][:19] == existing['designs']
    assert {p.name: p.read_bytes() for p in directory.iterdir() if p.is_file()} == before
    assert (root / 'data/json/designs.json').is_file()
    assert not (root / 'designs').exists() and not (root / 'sandbox/designs').exists()
    reloaded = ShowcaseService(SharedDefinitionsShowcaseAdapter(root, TEMPLATES, data_store=JsonDataStore()))
    assert reloaded.sandbox_visibility()[0].visible
    assert svc.set_sandbox_visibility('nodeaction', 'pizarra-demo', True) == enabled
    svc.set_sandbox_visibility('nodeaction', 'pizarra-demo', False)
    assert svc.list_designs().model_dump() == existing
    with pytest.raises(ShowcaseNotFound):
        svc.catalog(enabled.design_id)


def test_empty_project_is_explicit_and_can_gain_components_later(service):
    svc, root = service
    directory = project(root)
    enabled = svc.set_sandbox_visibility('nodeaction', 'pizarra-demo', True)
    assert enabled.component_count == 0
    assert svc.catalog(enabled.design_id).entries == []
    info = json.loads((directory / 'info.json').read_text())
    info['components'] = [{'name': 'texto.titulo', 'label': 'Título', 'summary': 'Declaración'}]
    (directory / 'info.json').write_text(json.dumps(info))
    entries = svc.catalog(enabled.design_id).entries
    assert len(entries) == 1 and entries[0].preview_url is None


@pytest.mark.parametrize('ident', ['atlas-cinematico', 'cara-a-cara', 'vida-en-escena'])
def test_existing_three_cannot_be_hidden_or_reclassified(service, ident):
    svc, root = service
    category = 'nodehistory' if ident == 'atlas-cinematico' else 'nodeaction'
    directory = root / 'sandbox' / category / ident
    directory.mkdir(parents=True)
    (directory / 'index.html').write_text('<html>principal</html>')
    before = svc.get_design(ident)
    state = svc.sandbox_visibility()[0]
    assert state.visible and not state.managed and state.design_id == ident
    with pytest.raises(ShowcaseConflict):
        svc.set_sandbox_visibility(category, ident, False)
    assert svc.get_design(ident) == before


def test_profiles_and_paths_are_isolated(service, tmp_path, monkeypatch):
    svc, root = service
    project(root)
    enabled = svc.set_sandbox_visibility('nodeaction', 'pizarra-demo', True)
    other = tmp_path / 'other'
    project(other)
    with monkeypatch.context() as change:
        change.setattr(settings, 'storage_profile_dir', other)
        change.setattr(settings, 'data_dir', other / 'data')
        second = ShowcaseService(SharedDefinitionsShowcaseAdapter(other, TEMPLATES, data_store=JsonDataStore()))
        assert not second.sandbox_visibility()[0].visible
        assert len(second.list_designs().designs) == 19
        with pytest.raises(ShowcaseNotFound):
            second.get_design(enabled.design_id)
    link = root / 'sandbox/nodeaction/foreign'
    link.symlink_to(other / 'sandbox/nodeaction/pizarra-demo', target_is_directory=True)
    assert len(svc.sandbox_visibility()) == 1
    with pytest.raises(ShowcaseNotFound):
        svc.set_sandbox_visibility('nodeaction', 'foreign', True)
    with pytest.raises(ShowcaseInvalid):
        svc.set_sandbox_visibility('..', 'pizarra-demo', True)
    with pytest.raises(ShowcaseInvalid):
        svc.set_sandbox_visibility('nodeaction', 'pizarra-demo', 'false')


@pytest.mark.asyncio
async def test_api_requires_internal_auth_and_serves_native_catalog(service, monkeypatch):
    svc, root = service
    project(root, catalog=True)
    app = FastAPI()
    app.include_router(showcase.router, prefix='/api/v1')
    app.dependency_overrides[showcase.get_showcase_service] = lambda: svc
    monkeypatch.setattr(settings, 'app_env', 'production')
    monkeypatch.setattr(settings, 'nexa_internal_token', 'synthetic-fixture')
    async with AsyncClient(transport=ASGITransport(app=app), base_url='http://fixture') as client:
        endpoint = '/api/v1/showcase/designs/sandbox/projects'
        state = (await client.get(endpoint)).json()[0]
        target = endpoint + '/nodeaction/pizarra-demo'
        assert (await client.put(target, json={'visible': True})).status_code == 403
        headers = {'X-Nexa-Internal': 'synthetic-fixture'}
        assert (await client.put(target, json={'visible': 'false'}, headers=headers)).status_code == 422
        response = await client.put(target, json={'visible': True}, headers=headers)
        assert response.status_code == 200 and response.json()['visible']
        catalog_url = f"/api/v1/showcase/designs/{state['design_id']}/catalog"
        catalog = await client.get(catalog_url)
        assert catalog.status_code == 200
        assert catalog.json()['groups'][0]['label'] == 'Textos'
        entry = catalog.json()['entries'][0]
        redirect = await client.get(entry['preview_url'].split('?')[0],
                                    params={'entry': entry['id'], 'format': '16x9'})
        assert redirect.status_code == 307
        query = parse_qs(urlsplit(redirect.headers['location']).query)
        assert query['only'] == ['text.title'] and query['aspect'] == ['16x9']
        assert (await client.post(f"/api/v1/showcase/designs/{state['design_id']}/promote", headers=headers)).status_code == 409
        assert (await client.put(target, json={'visible': False}, headers=headers)).status_code == 200
        assert (await client.get(entry['preview_url'])).status_code == 404


def test_declared_catalog_cannot_read_symlinked_files(service, tmp_path):
    svc, root = service
    directory = project(root, catalog=True)
    outside = tmp_path / 'outside.json'
    outside.write_text('[{"name":"external"}]')
    (directory / 'components.json').unlink()
    (directory / 'components.json').symlink_to(outside)
    before = hashlib.sha256(outside.read_bytes()).hexdigest()
    enabled = svc.set_sandbox_visibility('nodeaction', 'pizarra-demo', True)
    assert svc.catalog(enabled.design_id).entries == []
    assert hashlib.sha256(outside.read_bytes()).hexdigest() == before

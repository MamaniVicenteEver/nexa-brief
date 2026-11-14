"""Existing principal demos are corrected atomically, with startup recovery."""
import copy
import json
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.adapters.showcase.engine_production import RegisteredEngineProduction
from src.core.explainer.engine_locations import plan_engine_move, apply_engine_move


class States:
    def __init__(self):
        self.rows, self.fail_once = {}, None

    def get(self, ident):
        return copy.deepcopy(self.rows.get(ident))

    async def upsert(self, row, match):
        if self.fail_once == row['id']:
            self.fail_once = None
            raise RuntimeError('injected state failure')
        self.rows[row['id']] = copy.deepcopy(row)

    async def delete(self, ident):
        self.rows.pop(ident, None)


class Store:
    def __init__(self):
        self.states = States()

    def collection(self, name):
        assert name == 'showcase_designs'
        return self.states

    @asynccontextmanager
    async def coordination(self, name):
        assert name == 'showcase'
        yield


@pytest.fixture
def migration(tmp_path):
    templates = tmp_path/'templates'
    source = templates/'sandbox/nodehistory/_atlas'
    source.mkdir(parents=True)
    (source/'atlas.js').write_text('export const v=1;')
    (source/'poster.webp').write_bytes(b'unchanged image')
    entries = [{'id': 'atlas.title', 'name': 'atlas.title', 'summary': 'Title',
                'preview_kind': 'iframe', 'preview_url': '/api/v1/explainer/files/sandbox/nodehistory/_atlas/showcase/index.html?only=atlas.title'}]
    (source/'components.json').write_text(json.dumps({'components': [{'name': 'atlas.title'}]}))
    store = Store()
    definitions = templates/'_tools/design-definitions'
    for ident, folder in [('atlas-cinematico', 'atlas-economias-demo'), ('news', 'resumen-demo')]:
        demo = templates/'nodeatlas'/folder
        demo.mkdir(parents=True)
        (demo/'manifest.json').write_text('{}')
        directory = definitions/ident
        directory.mkdir(parents=True)
        design = {'id':ident,'revision':'preserved','state':'prueba','engine_id':'nodehistory/_atlas',
                  'category_path':'node_atlas', 'production_template':{'demo':True,'folder':f'nodeatlas/{folder}'}}
        (directory/'design.json').write_text(json.dumps(design))
        (directory/'catalog.json').write_text(json.dumps({'entries':entries,'revision':'preserved'}))
    def contract(ident):
        directory=definitions/ident
        return json.loads((directory/'design.json').read_text()), json.loads((directory/'catalog.json').read_text())
    adapter=SimpleNamespace(templates=templates,store=store,_definition=contract)
    service=RegisteredEngineProduction(adapter,SimpleNamespace(runtime_dir=tmp_path/'profile/.system/runtime'))
    return service,source,contract


@pytest.mark.asyncio
async def test_review_is_read_only(migration):
    service,source,contract=migration
    before=contract('atlas-cinematico')
    result=await service.pass_to_production('atlas-cinematico')
    assert result['state']=='reviewed' and result['components']==1
    assert source.is_dir() and contract('atlas-cinematico')==before
    assert not service.journals.exists()


@pytest.mark.asyncio
async def test_move_updates_all_consumers_and_preserves_components_and_bytes(migration):
    service,source,contract=migration
    inode=(source/'poster.webp').stat().st_ino
    result=await service.pass_to_production('atlas-cinematico',apply=True)
    target=service.templates/'nodeatlas/atlas-cinematico/_atlas'
    assert result['state']=='production' and not source.exists()
    assert (target/'poster.webp').stat().st_ino==inode
    for ident in ('atlas-cinematico','news'):
        design,catalog=contract(ident)
        assert design['state']=='produccion'
        assert design['engine_root']=='nodeatlas/atlas-cinematico/_atlas'
        assert catalog['revision']=='preserved'
        assert catalog['entries'][0]['id']=='atlas.title'
        assert '/bundled/nodeatlas/atlas-cinematico/_atlas/' in catalog['entries'][0]['preview_url']
        assert service.store.states.get(ident)['state']=='produccion'
    assert (await service.pass_to_production('atlas-cinematico',apply=True))['state']=='already_production'


@pytest.mark.asyncio
async def test_failure_after_first_consumer_restores_engine_and_registries(migration):
    service,source,contract=migration
    before={key:contract(key) for key in ('atlas-cinematico','news')}
    service.store.states.fail_once='news'
    with pytest.raises(RuntimeError,match='injected'):
        await service.pass_to_production('atlas-cinematico',apply=True)
    assert (source/'poster.webp').read_bytes()==b'unchanged image'
    assert not (service.templates/'nodeatlas/atlas-cinematico/_atlas').exists()
    assert service.store.states.rows=={}
    assert {key:contract(key) for key in before}==before


@pytest.mark.asyncio
async def test_startup_recovers_interruption_after_physical_rename(migration):
    service,source,contract=migration
    files={}
    for ident in ('atlas-cinematico','news'):
        d,c=contract(ident)
        for name,data in [('design.json',d),('catalog.json',c)]:
            files[f'_tools/design-definitions/{ident}/{name}']=data
    plan=plan_engine_move(service.templates,'nodehistory/_atlas','nodeatlas','atlas-cinematico')
    service.journals.mkdir(parents=True)
    path=service.journals/'atlas-cinematico.json'
    path.write_text(json.dumps({'state':'moving','plan':plan,'files':files,
                               'states':{'atlas-cinematico':None,'news':None}}))
    apply_engine_move(service.templates,plan,{})
    await service.recover()
    assert source.is_dir() and json.loads(path.read_text())['state']=='recovered'
    await service.recover()


@pytest.mark.asyncio
async def test_incomplete_component_catalog_blocks_move(migration):
    service,source,_=migration
    (source/'components.json').write_text(json.dumps({'components':[{'name':'atlas.missing'}]}))
    with pytest.raises(ValueError,match='Showcase'):
        await service.pass_to_production('atlas-cinematico',apply=True)
    assert source.exists()


@pytest.mark.asyncio
async def test_unregistered_principal_demo_cannot_move_engine(migration):
    service,source,_=migration
    (service.templates/'nodeatlas/atlas-economias-demo/manifest.json').unlink()
    with pytest.raises(ValueError,match='demo principal'):
        await service.pass_to_production('atlas-cinematico',apply=True)
    assert source.exists()


@pytest.mark.asyncio
async def test_engine_already_outside_sandbox_repairs_stale_state(migration):
    service, source, contract = migration
    await service.pass_to_production('atlas-cinematico', apply=True)
    directory = service.templates/'_tools/design-definitions/atlas-cinematico'
    design, _ = contract('atlas-cinematico')
    design['state'] = 'prueba'
    (directory/'design.json').write_text(json.dumps(design))
    service.store.states.rows['atlas-cinematico']['state'] = 'prueba'
    result = await service.pass_to_production('atlas-cinematico', apply=True)
    assert result['state'] == 'production'
    assert contract('atlas-cinematico')[0]['state'] == 'produccion'
    assert service.store.states.get('atlas-cinematico')['state'] == 'produccion'
    assert not source.exists()


def test_showcase_button_uses_real_registered_demo_readiness(migration):
    service, source, contract = migration
    design, catalog = contract('atlas-cinematico')
    assert service.blocker(design, catalog) is None
    (source/'components.json').write_text('{"components":[]}')
    assert 'Showcase' in service.blocker(design, catalog)


def test_route_passes_selected_categories_to_service():
    from src.presentation.api.routers.showcase import PassToProductionRequest, promote
    calls = []
    class FakeService:
        def promote(self, *args):
            calls.append(args)
            return {'ok': True}
    body = PassToProductionRequest(category='node_atlas', shared_categories=['node_politics'])
    assert promote('demo', body, FakeService()) == {'ok': True}
    assert calls == [('demo', 'node_atlas', ['node_politics'])]


def test_showcase_adapter_completes_registered_engine_via_same_workflow(migration, monkeypatch):
    from src.adapters.showcase.shared_definitions import SharedDefinitionsShowcaseAdapter
    import src.config.profile_layout as layout_module
    service, source, contract = migration
    directory = service.templates/'_tools/design-definitions/news'
    design, catalog = contract('news')
    design['name'] = 'News'
    design['production_template'].update(project_id='resumen-demo')
    (directory/'design.json').write_text(json.dumps(design))
    adapter = object.__new__(SharedDefinitionsShowcaseAdapter)
    adapter.templates = service.templates
    adapter.sandbox = source.parent.parent.parent/'profile/sandbox'
    adapter._data_store = service.store
    adapter._definition = contract
    adapter._states = lambda: dict(service.store.states.rows)
    adapter.get_design = lambda ident: adapter._design(ident, relations={})
    monkeypatch.setattr(layout_module, 'layout_for_settings', lambda _: service.layout)
    assert adapter.get_design('news')['promotable'] is True
    moved = adapter.promote('news')
    assert moved['state'] == 'produccion'
    assert moved['promotable'] is False
    assert not source.exists()
    assert (service.templates/'nodeatlas/news/_atlas/atlas.js').is_file()


@pytest.mark.asyncio
async def test_legacy_composed_catalog_keeps_helper_and_preset_entries(migration):
    service, source, contract = migration
    (source/'components.json').write_text('{"comps":[{"name":"atlas.title"}]}')
    directory=service.templates/'_tools/design-definitions/atlas-cinematico'
    design, catalog=contract('atlas-cinematico')
    for name in ('proto.intro', 'map.transition.fade-in'):
        catalog['entries'].append({'id':name, 'name':name, 'summary':'Existing reusable piece', 'preview_kind':'json'})
    (directory/'catalog.json').write_text(json.dumps(catalog))
    result=await service.pass_to_production('atlas-cinematico', apply=True)
    assert result['components']==3
    assert [e['id'] for e in contract('atlas-cinematico')[1]['entries']]==['atlas.title','proto.intro','map.transition.fade-in']

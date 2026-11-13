"""An explicit main demo moves once; private episodes and engines never get copied."""
import json
from pathlib import Path

import pytest

from src.adapters.showcase.production import FilesystemDesignProduction, fingerprint, rewrite_references, design_id
from src.adapters.showcase.shared_definitions import SharedDefinitionsShowcaseAdapter
from src.adapters.data.json_store import JsonDataStore
from src.config.settings import settings
from src.core.design_production import ProductionConflict, ProductionError
from src.core.explainer.production_templates import registered_public_file, shared_demo


@pytest.fixture
def workflow(tmp_path, monkeypatch):
    profile = tmp_path / 'profile'
    templates = tmp_path / 'server/src/templates'
    source = profile / 'sandbox/nodepolitics/demo'
    source.mkdir(parents=True)
    (templates / '_tools/design-definitions').mkdir(parents=True)
    (templates / 'nodeatlas').mkdir()
    for relative in ('sandbox/_proto/proto.js', 'sandbox/nodehistory/_atlas/atlas.js', 'sandbox/nodehistory/_atlas/assets/flags/us.svg'):
        file = templates / relative
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text('// shared fixture')
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', profile / 'data')
    monkeypatch.setattr(settings, 'templates_dir', templates)
    config = profile / 'config/niches.json'
    config.parent.mkdir(parents=True)
    config.write_text(json.dumps({'niches': {}, 'categories': {
        'node_atlas': {'display_name': 'NodeAtlas', 'engine': 'explainer_kit', 'folder': 'nodeatlas'},
        'node_politics': {'display_name': 'NodePolitics', 'engine': 'explainer_kit', 'folder': 'nodepolitics'},
    }}))
    import src.core.categories as categories
    monkeypatch.setattr(categories, '_NICHES_PATH', config)
    load_categories = categories.load_categories
    monkeypatch.setattr(categories, 'load_categories', lambda: load_categories(config))
    monkeypatch.setattr(settings, 'niches_path', config)
    from src.core.explainer import catalog as video_catalog
    monkeypatch.setattr(video_catalog, 'TEMPLATES_DIR', templates)
    categories.reload_categories()
    info = {'title': 'Demo', 'summary': 'A design', 'is_new_design': True, 'engine': 'nodehistory/_atlas',
            'catalog': {'components': 'components.json', 'gallery': 'showcase.html'}}
    (source / 'info.json').write_text(json.dumps(info))
    (source / 'index.html').write_text('<script src="../../_proto/proto.js"></script><script type="module" src="../../nodehistory/_atlas/atlas.js"></script>')
    (source / 'showcase.html').write_text('<script src="./showcase.js"></script>')
    (source / 'showcase.js').write_text("import {runAtlas} from '../../nodehistory/_atlas/atlas.js';")
    (source / 'components.json').write_text(json.dumps([{'name': 'noticiero.title', 'summary': 'Isolated title', 'demo': {'text': 'Demo', 'src': '../../../nodehistory/_atlas/assets/flags/us.svg'}, 'preview': {}}]))
    (source / 'assets').mkdir()
    for name in ('scene.json','script.json','lyrics.json'):
        (source / 'assets' / name).write_text(json.dumps({'duration': 12}))
    (source / 'assets/song.mp3').write_bytes(b'audio')
    store = JsonDataStore()
    adapter = SharedDefinitionsShowcaseAdapter(profile, templates, data_store=store)
    async def capture(*args):
        pass
    repository = FilesystemDesignProduction(adapter, capture=capture)
    draft = {'title': 'Demo', 'description': 'A reusable news design', 'demo': True,
        'category': 'node_atlas', 'shared_categories': ['node_politics'],
        'publication': {**{k: 'Demo text' for k in ('youtube_title','youtube_description','facebook_title',
            'facebook_description','instagram_title','instagram_description','tiktok_caption')},
            'thumbnail_variants': [{'option': option, 'text': 'DEMO'} for option in ('A','B','C')]}}
    return repository, source, templates, draft


def test_relative_routes_preserve_internal_media_and_point_to_shared_engine():
    text = '"../../_proto/proto.js" "../../nodehistory/_atlas/atlas.js" "./assets/image.jpg"'
    changed = rewrite_references(text, 'nodepolitics', 'demo', 'nodeatlas')
    assert '"/api/v1/explainer/files/sandbox/_proto/proto.js"' in changed
    assert '"/api/v1/explainer/files/sandbox/nodehistory/_atlas/atlas.js"' in changed
    assert '"./assets/image.jpg"' in changed


@pytest.mark.asyncio
async def test_requires_explicit_review_and_detects_edits_after_validation(workflow):
    repository, source, _, draft = workflow
    await repository.save('nodepolitics','demo',draft)
    with pytest.raises(ProductionConflict):
        await repository.move('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    assert repository.inspect('nodepolitics','demo')['can_pass']
    (source / 'assets/scene.json').write_text('{"duration":13}')
    assert not repository.inspect('nodepolitics','demo')['can_pass']


@pytest.mark.asyncio
async def test_move_preserves_identity_media_and_references_and_is_idempotent(workflow):
    repository, source, templates, draft = workflow
    await repository.save('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    assert repository.inspect('nodepolitics','demo')['state'] == 'ready'
    result = await repository.move('nodepolitics','demo',draft)
    target = templates / 'nodeatlas/demo'
    assert result['state'] == 'production'
    assert result['design_id'] == design_id('nodepolitics','demo')
    assert not source.exists() and (target / 'assets/song.mp3').read_bytes() == b'audio'
    assert shared_demo(templates,'demo') == target
    from src.config.content_paths import content_key, resolve_content_key
    assert content_key(target) == 'bundled/nodeatlas/demo'
    assert resolve_content_key('bundled/nodeatlas/demo/index.html') == target / 'index.html'
    with pytest.raises(ValueError):
        content_key(templates / 'nodeatlas/unregistered')
    assert registered_public_file(templates,('nodeatlas','demo','assets','scene.json'))
    assert not registered_public_file(templates,('nodeatlas','other','assets','scene.json'))
    assert not registered_public_file(templates,('nodeatlas','demo','work','preparation.json'))
    manifest = json.loads((target / 'manifest.json').read_text())
    assert manifest['category'] == 'node_atlas' and manifest['shared_categories'] == ['node_politics']
    assert manifest['demo'] and manifest['status'] == 'en preparación'
    assert manifest['editorial_status'] == 'pending'
    contract = json.loads((templates / '_tools/design-definitions' / result['design_id'] / 'catalog.json').read_text())
    assert 'only=noticiero.title' in contract['entries'][0]['preview_url']
    assert '/bundled/nodeatlas/demo/' in contract['entries'][0]['preview_url']
    assert contract['entries'][0]['example']['src'] == '/api/v1/explainer/files/sandbox/nodehistory/_atlas/assets/flags/us.svg'
    assert (await repository.move('nodepolitics','demo',draft))['state'] == 'production'


@pytest.mark.asyncio
async def test_failed_move_restores_source_and_does_not_overwrite_destination(workflow, monkeypatch):
    repository, source, templates, draft = workflow
    await repository.save('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    target = templates / 'nodeatlas/demo'
    target.mkdir()
    with pytest.raises(ProductionConflict):
        await repository.move('nodepolitics','demo',draft)
    assert source.exists()


@pytest.mark.asyncio
async def test_category_selection_and_symlinks_are_rejected(workflow):
    repository, source, _, draft = workflow
    draft['shared_categories'] = ['node_atlas']
    with pytest.raises(ProductionError):
        await repository.save('nodepolitics','demo',draft)
    (source / 'assets/unsafe').symlink_to('/tmp')
    with pytest.raises(ProductionError):
        fingerprint(source)


@pytest.mark.asyncio
async def test_failure_after_rename_restores_source_files_and_registry(workflow, monkeypatch):
    repository, source, templates, draft = workflow
    await repository.save('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    original = (source / 'index.html').read_bytes()
    import src.core.content_registry as registry
    async def fail(*args, **kwargs):
        raise RuntimeError('simulated registry failure')
    monkeypatch.setattr(registry, 'upsert_video', fail)
    with pytest.raises(RuntimeError, match='simulated'):
        await repository.move('nodepolitics','demo',draft)
    assert source.is_dir() and (source / 'index.html').read_bytes() == original
    assert not (templates / 'nodeatlas/demo').exists()
    assert not (templates / '_tools/design-definitions' / design_id('nodepolitics','demo')).exists()
    assert repository.inspect('nodepolitics','demo')['can_pass']


@pytest.mark.asyncio
async def test_recovery_rolls_back_an_interrupted_relocation(workflow):
    repository, source, templates, draft = workflow
    await repository.save('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    original = (source / 'index.html').read_text()
    marker = source / 'work/production/transaction.json'
    marker.write_text('{"id":"interrupted"}')
    target = templates / 'nodeatlas/demo'
    source.rename(target)
    (target / 'index.html').write_text('partial rewrite')
    ident = design_id('nodepolitics','demo')
    journal = repository.layout.runtime_dir / 'design-production' / (ident + '.json')
    journal.parent.mkdir(parents=True)
    journal.write_text(json.dumps({'state':'moving','transaction':'interrupted', 'folder':'nodepolitics',
        'project':'demo','target_folder':'nodeatlas','originals':{'index.html':original},'protected':{},
        'record':repository._record(target),'old_showcase':None,'old_video':None,'old_categories':{}}))
    await repository.recover()
    assert source.is_dir() and not target.exists()
    assert (source / 'index.html').read_text() == original
    assert json.loads(journal.read_text())['state'] == 'recovered'


def test_category_crud_preserves_identity_and_blocks_referenced_category(workflow):
    repository, source, templates, draft = workflow
    from src.core.category_management import manage_category
    from src.core.category_creation import CategoryConflictError
    node = manage_category('node_atlas', {'display_name':'Atlas editado','topic':'Mapas'})
    assert node.display_name == 'Atlas editado' and node.folder == 'nodeatlas'
    (repository.layout.productions_dir / 'nodeatlas/video').mkdir(parents=True)
    with pytest.raises(CategoryConflictError):
        manage_category('node_atlas', None)
    from src.core.category_creation import create_category
    created = create_category('Empty Test')
    assert manage_category(created.category_id, None) is None


@pytest.mark.asyncio
async def test_sandbox_never_invokes_a_model(workflow):
    from src.core.prototypes.preparation import PreparationService
    def forbidden(*args):
        raise AssertionError('Sandbox must never call an agent')
    with pytest.raises(ValueError, match='sin IA'):
        await PreparationService(forbidden).submit('nodepolitics', 'demo')


def test_editorial_json_accepts_a_single_fenced_json_block_and_rejects_prose():
    from src.core.prototypes.preparation import _decode_proposal
    assert _decode_proposal('```json\n{"title":"Demo"}\n```') == {'title':'Demo'}
    with pytest.raises(ValueError):
        _decode_proposal('Here is the result: {"title":"Demo"}')

@pytest.mark.asyncio
async def test_preselects_only_default_style_and_rejects_unknown_style(workflow, monkeypatch):
    repository, source, _, draft = workflow
    monkeypatch.setattr(repository, '_styles', lambda _: {'default': 'original', 'styles': [
        {'id':'original','name':'Original'}, {'id':'dynamic-news','name':'Dynamic News'}]})
    result = await repository.save('nodepolitics', 'demo', draft)
    assert result['draft']['poster_styles'] == ['original']
    assert [row['id'] for row in result['styles']] == ['original', 'dynamic-news']
    with pytest.raises(ProductionError):
        await repository.save('nodepolitics', 'demo', {**draft, 'poster_styles':['unknown']})


def test_asset_relative_component_media_keep_shared_engine_and_reject_escapes():
    text = '"../../../nodehistory/_atlas/assets/flags/us.svg"'
    assert rewrite_references(text, 'nodepolitics', 'demo', 'nodeatlas') == '"/api/v1/explainer/files/sandbox/nodehistory/_atlas/assets/flags/us.svg"'
    with pytest.raises(ProductionError):
        rewrite_references('"../../../nodehistory/_atlas/../../private.json"', 'nodepolitics', 'demo', 'nodeatlas')

@pytest.mark.asyncio
async def test_technical_validation_needs_no_social_copy_audio_or_captures(workflow):
    repository, source, _, draft = workflow
    draft['publication'] = {}
    for name in ('script.json','lyrics.json','song.mp3'):
        (source/'assets'/name).unlink()
    async def forbidden(*args):
        raise AssertionError('Verification must never capture')
    repository.capture = forbidden
    await repository.save('nodepolitics','demo',draft)
    before = {str(p.relative_to(source)):p.read_bytes() for p in source.rglob('*') if p.is_file() and 'work' not in p.parts}
    await repository._validate('nodepolitics','demo')
    status = repository.inspect('nodepolitics','demo')
    assert status['can_pass'], status
    assert status['report']['resources_checked'] >= 3
    assert not (source/'publish.json').exists()
    assert before == {str(p.relative_to(source)):p.read_bytes() for p in source.rglob('*') if p.is_file() and 'work' not in p.parts}
    target = await repository.move('nodepolitics','demo',{'category':draft['category'],'shared_categories':draft['shared_categories']})
    assert target['state'] == 'production'

@pytest.mark.asyncio
async def test_route_error_and_changed_selection_block_move(workflow):
    repository, source, _, draft = workflow
    (source/'showcase.js').write_text("import './missing.js';")
    await repository.save('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    assert repository.inspect('nodepolitics','demo')['state'] == 'failed'
    (source/'showcase.js').write_text('// no dependencies')
    await repository._validate('nodepolitics','demo')
    assert repository.inspect('nodepolitics','demo')['can_pass']
    with pytest.raises(ProductionConflict, match='categoría cambió'):
        await repository.move('nodepolitics','demo',{'category':'node_politics','shared_categories':[]})

@pytest.mark.asyncio
async def test_existing_episode_moves_to_profile_only_after_technical_review(workflow):
    repository, source, templates, draft=workflow
    draft = {**draft, 'demo': False}
    info=json.loads((source/'info.json').read_text());info['is_new_design']=False
    (source/'info.json').write_text(json.dumps(info))
    (source/'manifest.json').write_text(json.dumps({'design':'atlas-en-movimiento','title':'Episode','status':'en progreso'}))
    await repository.save('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    assert repository.inspect('nodepolitics','demo')['can_pass'],repository.inspect('nodepolitics','demo')
    moved=await repository.move('nodepolitics','demo',{'category':'node_atlas','shared_categories':['node_politics']})
    assert moved['destination']=='productions/nodeatlas/demo'
    assert not source.exists() and not (templates/'nodeatlas/demo').exists()
    target=repository.layout.productions_dir/'nodeatlas/demo'
    assert (target/'assets/song.mp3').read_bytes()==b'audio'
    assert '/api/v1/explainer/files/sandbox/nodehistory/_atlas/atlas.js' in (target/'showcase.js').read_text()
    assert json.loads((target/'manifest.json').read_text())['editorial_status']=='pending'


def test_nested_local_routes_are_preserved_and_shared_routes_are_canonical():
    value = "import '../helper.js'; import '../../../nodehistory/_atlas/atlas.js';"
    rewritten = rewrite_references(value,'nodepolitics','demo','nodeatlas',relative_file='components/main.js')
    assert "import '../helper.js'" in rewritten
    assert '/api/v1/explainer/files/sandbox/nodehistory/_atlas/atlas.js' in rewritten


@pytest.mark.asyncio
async def test_missing_scene_media_is_reported_without_generating_anything(workflow):
    repository, source, _, draft = workflow
    (source/'assets/scene.json').write_text('{"layers":[{"src":"media/missing-photo.jpg"}]}')
    await repository.save('nodepolitics','demo',draft)
    await repository._validate('nodepolitics','demo')
    status=repository.inspect('nodepolitics','demo')
    assert status['state']=='failed'
    assert 'missing-photo.jpg' in status['error']
    assert not (source/'assets/media/missing-photo.jpg').exists()


def _legacy_maps_fixture(workflow, *, principal):
    repository, source, templates, draft = workflow
    draft = {**draft, 'demo': principal}
    destination = repository.layout.sandbox_dir / 'nodehistory' / ('map-demo' if principal else 'map-episode')
    destination.parent.mkdir(parents=True, exist_ok=True)
    source.rename(destination)
    source = destination
    info = {'title': 'Map example', 'summary': 'A map example', 'engine': 'nodehistory/_mapas',
            'is_new_design': principal, 'status': 'lista para revisar', 'notes':['Pendiente: revisar el pin vertical']}
    (source / 'info.json').write_text(json.dumps(info))
    (source / 'index.html').write_text('<script src="../../_proto/proto.js"></script><script src="../_mapas/mapas.js"></script>')
    (source / 'showcase.html').unlink()
    (source / 'showcase.js').unlink()
    (source / 'components.json').unlink()
    (source / 'assets/media').mkdir()
    (source / 'assets/media/photo.jpg').write_bytes(b'original photo')
    (source / 'assets/config.json').write_text('{"src":"assets/song.mp3"}')
    (source / 'assets/lyrics.json').write_text('{"metadata":{"duration":123.5},"segments":[]}')
    (source / 'assets/scene.json').write_text('{"layers":[{"src":"assets/media/photo.jpg"},{"src":"../_mapas/media/sat.jpg"}]}')
    for relative in ('sandbox/nodehistory/_mapas/mapas.js','sandbox/nodehistory/_mapas/media/sat.jpg'):
        path=templates/relative;path.parent.mkdir(parents=True,exist_ok=True);path.write_text('existing shared resource')
    definition=templates/'_tools/design-definitions/mapas-satelitales'
    definition.mkdir()
    revision='original-shared-revision'
    design={'schema_version':1,'id':'mapas-satelitales','name':'Mapas satelitales',
            'state':'prueba','revision':revision,'engine_id':'nodehistory/_mapas',
            'category':'nodehistory','family':'maps','preview_url':'/api/v1/explainer/files/sandbox/nodehistory/_mapas/showcase/index.html'}
    catalog={'schema_version':1,'design_id':'mapas-satelitales','revision':revision,
             'entries':[{'id':'map.layer.fill','name':'map.layer.fill','label':'Fill','summary':'A map',
                         'preview_kind':'iframe','preview_url':design['preview_url'],'data':{}}]}
    (definition/'design.json').write_text(json.dumps(design))
    (definition/'catalog.json').write_text(json.dumps(catalog))
    return repository, source, templates, draft, definition


@pytest.mark.asyncio
async def test_existing_maps_demo_preserves_shared_identity_catalog_and_poster_cache(workflow):
    repository, source, templates, draft, definition = _legacy_maps_fixture(workflow, principal=True)
    cache=repository.layout.cache_dir/'showcase-posters/mapas-satelitales/original.webp'
    cache.parent.mkdir(parents=True,exist_ok=True);cache.write_bytes(b'existing poster')
    catalog=(definition/'catalog.json').read_bytes()
    await repository.save('nodehistory','map-demo',draft)
    await repository._validate('nodehistory','map-demo')
    status=repository.inspect('nodehistory','map-demo')
    assert status['can_pass'],(status['error'],status['report'])
    assert status['design_id']=='mapas-satelitales'
    result=await repository.move('nodehistory','map-demo',draft)
    assert result['state']=='production' and result['design_id']=='mapas-satelitales'
    target=templates/'nodeatlas/map-demo'
    assert not source.exists() and target.is_dir()
    manifest=json.loads((target/'manifest.json').read_text())
    assert manifest['design']=='mapas-satelitales' and manifest['duration_seconds']==123.5
    assert '/api/v1/explainer/files/sandbox/nodehistory/_mapas/media/sat.jpg' in (target/'assets/scene.json').read_text()
    assert (target/'assets/media/photo.jpg').read_bytes()==b'original photo'
    assert (definition/'catalog.json').read_bytes()==catalog and cache.read_bytes()==b'existing poster'
    assert json.loads((definition/'design.json').read_text())['revision']=='original-shared-revision'
    from src.core.categories import get_category
    assert 'mapas-satelitales' in get_category('node_atlas').designs
    assert 'mapas-satelitales' in get_category('node_politics').shared_designs
    from src.core.explainer.catalog import get_video
    assert get_video('map-demo').path == target
    assert not (templates/'_tools/design-definitions'/design_id('nodehistory','map-demo')).exists()
    assert (await repository.move('nodehistory','map-demo',draft))['state']=='production'


@pytest.mark.asyncio
async def test_maps_episode_without_manifest_moves_to_profile_and_retains_media(workflow):
    repository, source, templates, draft, _ = _legacy_maps_fixture(workflow, principal=False)
    await repository.save('nodehistory','map-episode',draft)
    await repository._validate('nodehistory','map-episode')
    status=repository.inspect('nodehistory','map-episode')
    assert status['can_pass'],(status['error'],status['report'])
    await repository.move('nodehistory','map-episode',draft)
    target=repository.layout.productions_dir/'nodeatlas/map-episode'
    assert not source.exists() and not (templates/'nodeatlas/map-episode').exists()
    manifest=json.loads((target/'manifest.json').read_text())
    assert manifest['design']=='mapas-satelitales' and manifest['status']=='en preparación'
    assert manifest['duration_seconds']==123.5
    assert manifest['review_requirements']==['Pendiente: revisar el pin vertical']
    from src.core.explainer.catalog import get_video
    assert get_video('map-episode').path == target
    assert (target/'assets/media/photo.jpg').read_bytes()==b'original photo'
    assert '/api/v1/explainer/files/sandbox/nodehistory/_mapas/media/sat.jpg' in (target/'assets/scene.json').read_text()


@pytest.mark.asyncio
async def test_shared_maps_definition_is_restored_after_failed_move(workflow, monkeypatch):
    repository, source, _, draft, definition = _legacy_maps_fixture(workflow, principal=True)
    original=(definition/'design.json').read_bytes()
    await repository.save('nodehistory','map-demo',draft)
    await repository._validate('nodehistory','map-demo')
    import src.core.content_registry as registry
    async def fail(*args, **kwargs):
        raise RuntimeError('registry failed')
    monkeypatch.setattr(registry,'upsert_video',fail)
    with pytest.raises(RuntimeError,match='registry failed'):
        await repository.move('nodehistory','map-demo',draft)
    assert source.is_dir() and (definition/'design.json').read_bytes()==original
    assert (definition/'catalog.json').is_file()
    assert not (definition/'.production-transaction.json').exists()


def test_existing_showcase_design_cannot_bypass_demo_review(workflow):
    repository, _, _, _, _ = _legacy_maps_fixture(workflow, principal=True)
    from src.core.showcase.ports import ShowcaseConflict
    with pytest.raises(ShowcaseConflict, match='Valida la preparación'):
        repository.showcase.promote('mapas-satelitales','node_atlas',['node_politics'])


@pytest.mark.asyncio
async def test_recovery_preserves_existing_shared_maps_definition(workflow):
    repository, source, templates, draft, definition = _legacy_maps_fixture(workflow, principal=True)
    original_definition=(definition/'design.json').read_text()
    original_index=(source/'index.html').read_text()
    await repository.save('nodehistory','map-demo',draft)
    await repository._validate('nodehistory','map-demo')
    marker=source/'work/production/transaction.json'
    marker.write_text('{"id":"interrupted"}')
    target=templates/'nodeatlas/map-demo'
    source.rename(target)
    (target/'index.html').write_text('incomplete')
    (definition/'design.json').write_text('{"incomplete":true}')
    (definition/'.production-transaction.json').write_text('{"id":"interrupted"}')
    journal=repository.layout.runtime_dir/'design-production/maps-test.json'
    journal.parent.mkdir(parents=True,exist_ok=True)
    journal.write_text(json.dumps({'state':'moving','transaction':'interrupted','folder':'nodehistory',
        'project':'map-demo','target_folder':'nodeatlas','design_id':'mapas-satelitales',
        'old_definition':original_definition,'originals':{'index.html':original_index},'protected':{},
        'record':repository._record(target),'old_showcase':None,'old_video':None,'old_categories':{}}))
    await repository.recover()
    assert source.is_dir() and not target.exists()
    assert (source/'index.html').read_text()==original_index
    assert (definition/'design.json').read_text()==original_definition
    assert (definition/'catalog.json').is_file() and not (definition/'.production-transaction.json').exists()


@pytest.mark.asyncio
async def test_existing_poster_from_style_revision_is_inventoried_without_capture(workflow, monkeypatch):
    repository, _, _, draft, _ = _legacy_maps_fixture(workflow, principal=True)
    monkeypatch.setattr(repository, '_styles', lambda _: {'default':'dynamic','styles':[
        {'id':'dynamic','name':'Dynamic','revision':'old-style-revision'}]})
    from src.adapters.showcase.posters import legacy_style_poster_path
    url='/api/v1/explainer/files/sandbox/nodehistory/_mapas/showcase/index.html?only=map.layer.fill&estilo=dynamic&styleRevision=old-style-revision'
    image=legacy_style_poster_path(repository.layout.cache_dir,'mapas-satelitales','',
                                   'map.layer.fill','16x9',url,engine='nodehistory/_mapas')
    image.parent.mkdir(parents=True,exist_ok=True);image.write_bytes(b'original poster')
    async def forbidden(*args):
        raise AssertionError('Verification must not capture')
    repository.capture=forbidden
    await repository.save('nodehistory','map-demo',draft)
    await repository._validate('nodehistory','map-demo')
    report=repository.inspect('nodehistory','map-demo')['report']
    assert report['posters']==[{'entry':'map.layer.fill','style':'dynamic','exists':True}]
    assert image.read_bytes()==b'original poster'


def _cached_card_image(repository, folder, project):
    import io
    from PIL import Image
    stream=io.BytesIO();Image.new('RGB',(3,3),'red').save(stream,format='JPEG')
    path=repository.layout.cache_dir/'sandbox-thumbs'/folder/(project+'.jpg')
    path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(stream.getvalue())
    return stream.getvalue()


@pytest.mark.asyncio
async def test_demo_reuses_existing_sandbox_card_poster(workflow):
    repository, source, templates, draft, _ = _legacy_maps_fixture(workflow, principal=True)
    original=_cached_card_image(repository,'nodehistory','map-demo')
    await repository.save('nodehistory','map-demo',draft)
    await repository._validate('nodehistory','map-demo')
    await repository.move('nodehistory','map-demo',draft)
    assert (templates/'nodeatlas/map-demo/assets/thumbnails/poster.jpg').read_bytes()==original
    assert not source.exists()


@pytest.mark.asyncio
async def test_episode_activates_category_and_reuses_existing_card_poster(workflow):
    repository, source, _, draft, _ = _legacy_maps_fixture(workflow, principal=False)
    config=json.loads(settings.niches_path.read_text())
    config['categories']['node_atlas']['status']='empty'
    settings.niches_path.write_text(json.dumps(config))
    from src.core.categories import reload_categories, get_category
    reload_categories()
    original=_cached_card_image(repository,'nodehistory','map-episode')
    await repository.save('nodehistory','map-episode',draft)
    await repository._validate('nodehistory','map-episode')
    await repository.move('nodehistory','map-episode',draft)
    target=repository.layout.productions_dir/'nodeatlas/map-episode'
    assert (target/'assets/thumbnails/poster.jpg').read_bytes()==original
    assert get_category('node_atlas').status=='active'
    assert not source.exists()


@pytest.mark.asyncio
async def test_failed_episode_restores_category_and_removes_only_copied_poster(workflow, monkeypatch):
    repository, source, _, draft, _ = _legacy_maps_fixture(workflow, principal=False)
    config=json.loads(settings.niches_path.read_text())
    config['categories']['node_atlas']['status']='empty'
    settings.niches_path.write_text(json.dumps(config))
    from src.core.categories import reload_categories, get_category
    reload_categories()
    _cached_card_image(repository,'nodehistory','map-episode')
    await repository.save('nodehistory','map-episode',draft)
    await repository._validate('nodehistory','map-episode')
    import src.core.content_registry as registry
    async def fail(*args,**kwargs):raise RuntimeError('registry failed')
    monkeypatch.setattr(registry,'upsert_video',fail)
    with pytest.raises(RuntimeError,match='registry failed'):
        await repository.move('nodehistory','map-episode',draft)
    assert source.is_dir() and not (source/'assets/thumbnails/poster.jpg').exists()
    assert get_category('node_atlas').status=='empty'


@pytest.mark.asyncio
async def test_kit_design_demo_reuses_existing_catalog_and_posters(workflow):
    repository, source, templates, draft, definition = _legacy_maps_fixture(workflow, principal=True)
    info=json.loads((source/'info.json').read_text())
    info.update(engine='explainer-kit:memorias')
    (source/'info.json').write_text(json.dumps(info))
    new_definition=definition.parent/'memorias'
    definition.rename(new_definition)
    design=json.loads((new_definition/'design.json').read_text())
    design.update(id='memorias',engine_id='explainer-kit',family='memorias',state='produccion')
    catalog=json.loads((new_definition/'catalog.json').read_text())
    catalog['design_id']='memorias'
    (new_definition/'design.json').write_text(json.dumps(design))
    (new_definition/'catalog.json').write_text(json.dumps(catalog))
    original_catalog=(new_definition/'catalog.json').read_bytes()
    from src.adapters.showcase.posters import poster_path
    entry=catalog['entries'][0]
    poster=poster_path(repository.layout.cache_dir,'memorias','',entry['id'],'16x9',entry['preview_url'],engine='explainer-kit')
    poster.parent.mkdir(parents=True,exist_ok=True);poster.write_bytes(b'original')
    await repository.save('nodehistory','map-demo',draft)
    await repository._validate('nodehistory','map-demo')
    status=repository.inspect('nodehistory','map-demo')
    assert status['can_pass'],(status['error'],status['issues'])
    assert status['design_id']=='memorias' and status['report']['posters'][0]['exists']
    result=await repository.move('nodehistory','map-demo',draft)
    assert result['design_id']=='memorias' and result['state']=='production'
    assert (new_definition/'catalog.json').read_bytes()==original_catalog
    assert poster.read_bytes()==b'original'
    assert not (templates/'_tools/design-definitions'/design_id('nodehistory','map-demo')).exists()


@pytest.mark.asyncio
async def test_kit_engine_suffix_must_match_the_shared_design(workflow):
    repository, source, _, draft, definition = _legacy_maps_fixture(workflow, principal=True)
    info=json.loads((source/'info.json').read_text())
    info.update(engine='explainer-kit:another-design',design='mapas-satelitales')
    (source/'info.json').write_text(json.dumps(info))
    design=json.loads((definition/'design.json').read_text())
    design['engine_id']='explainer-kit'
    (definition/'design.json').write_text(json.dumps(design))
    status=repository.inspect('nodehistory','map-demo')
    assert 'Falta el catálogo de componentes aislados del diseño principal' in status['issues']

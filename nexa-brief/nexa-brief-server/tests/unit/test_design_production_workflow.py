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
    monkeypatch.setattr(settings, 'niches_path', config)
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

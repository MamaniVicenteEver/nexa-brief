"""Contract tests for strategy precedence, isolated AI and resumable preparation."""
from dataclasses import asdict
from pathlib import Path
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from src.config.settings import settings
from src.core.explainer.catalog import ExplainerVideo
from src.core.explainer.publishing.strategies import resolve_for_video, resolved_from_snapshot, StrategyError
from src.core.explainer.editorial_preparation import EditorialPreparationService

@pytest.fixture
def video(tmp_path, monkeypatch):
    from src.adapters.data.json_store import JsonDataStore
    from src.core import data
    profile = tmp_path/'profile';root=profile/'productions/nodeatlas/demo';root.mkdir(parents=True)
    templates=tmp_path/'templates';templates.mkdir()
    monkeypatch.setattr(settings,'storage_profile_dir',profile)
    monkeypatch.setattr(settings,'storage_layout_version',3)
    monkeypatch.setattr(settings,'data_dir',profile/'data')
    monkeypatch.setattr(settings,'templates_dir',templates)
    # Keep versioned strategy fixtures from the repository; never touch the profile config.
    config=profile/'config/niches.json';config.parent.mkdir(parents=True)
    config.write_text(json.dumps({'niches':{},'categories':{'node_atlas':{'display_name':'NodeAtlas','engine':'explainer_kit','folder':'nodeatlas'}}}))
    import src.core.categories as categories
    monkeypatch.setattr(settings,'niches_path',config)
    monkeypatch.setattr(categories,'_NICHES_PATH',config);categories.reload_categories()
    v=ExplainerVideo('demo',root,'sandbox-test','node_atlas','Demo','en preparación',30)
    (root/'assets').mkdir();(root/'assets/script.json').write_text('{"segments":[{"text":"Un guion completo y verificable"}]}')
    (root/'manifest.json').write_text('{"status":"en preparación","design":"sandbox-test","category":"node_atlas"}')
    import src.core.explainer.editorial_preparation as module
    monkeypatch.setattr(module,'_video',lambda _:v)
    return v

def test_design_overrides_category_and_default_per_piece_and_freezes_rules(video):
    path=settings.templates_dir/'_tools/design-definitions'/video.design/'design.json'
    path.parent.mkdir(parents=True)
    path.write_text(json.dumps({'editorial_strategies':{'thumbnail':'thumb_two_modes_v2'}}))
    result=resolve_for_video(video)
    assert result.rules.thumbnail.id=='thumb_two_modes_v2'
    assert result.origins['thumbnail']=='design' and result.origins['title']=='default'
    frozen=resolved_from_snapshot(result.snapshot())
    assert frozen.rules.ids()==result.rules.ids() and frozen.fingerprint==result.fingerprint
    path.write_text(json.dumps({'editorial_strategies':{'title':'does_not_exist'}}))
    with pytest.raises(StrategyError):resolve_for_video(video)

@pytest.mark.asyncio
async def test_model_receives_script_and_effective_rules_but_cannot_move_or_record(video, monkeypatch):
    import src.core.explainer.editorial_preparation as module
    tasks=[]
    monkeypatch.setattr(module,'start_owned_task',lambda kind,ident,fn:tasks.append(fn))
    generator=SimpleNamespace(generate=AsyncMock(return_value={'invalid':'not a package'}))
    service=EditorialPreparationService(generator, capture=AsyncMock())
    row=await service.submit('demo')
    assert row['state'] in {'queued','failed'} # no lease in this controlled test
    await tasks[0]()
    assert generator.generate.await_count==1
    context=generator.generate.call_args.args[0]
    assert 'guion completo' in context['files']['assets/script.json']
    assert context['strategies']['ids']['title']
    assert service.latest('demo')['state']=='failed'
    service.capture.assert_not_called()
    assert not (video.path/'publish.json').exists()
    assert json.loads((video.path/'manifest.json').read_text())['status']=='en preparación'

@pytest.mark.asyncio
async def test_duplicate_submit_shares_active_job(video,monkeypatch):
    import src.core.explainer.editorial_preparation as module
    monkeypatch.setattr(module,'start_owned_task',lambda *args:None)
    service=EditorialPreparationService(SimpleNamespace(generate=AsyncMock()))
    first=await service.submit('demo')
    monkeypatch.setattr(module,'task_is_owned',lambda *args:True)
    second=await service.submit('demo')
    assert first['run_id']==second['run_id']
    await service.recover() # owned job must remain active
    assert service.latest('demo')['state']=='queued'

@pytest.mark.asyncio
@pytest.mark.parametrize('design', ['sandbox-test', 'mapas-satelitales'])
async def test_complete_package_saves_three_platforms_and_six_images_without_recording(video,monkeypatch,design):
    import copy
    from PIL import Image
    from test_publishing_package import PACKAGE, SCRIPT_TEXT
    from src.core.explainer.publishing.package import PublishPackage
    from src.core.explainer.publishing.checks import check_package
    from src.core.explainer import thumbnails
    import src.core.explainer.editorial_preparation as module
    video.design=design
    (video.path/'manifest.json').write_text(json.dumps({'status':'en preparación','design':design,'category':'node_atlas'}))
    payload=copy.deepcopy(PACKAGE)
    payload['category']='node_atlas'
    payload['thumbnail']['tabloid']={'text':'LA ALARMA','image':'hamilton.jpg','pair_title':'C'}
    payload['tags']['youtube_hashtags'][-1]='#NodeAtlas'
    payload['tags']['tiktok'][-1]='#historia'
    payload['tags']['facebook'][-1]='#Historia'
    (video.path/'index.html').write_text('<html><body>Demo</body></html>')
    for name in ('scene.json','lyrics.json'):(video.path/'assets'/name).write_text('{}')
    (video.path/'assets/lyrics.json').write_text(json.dumps({'segments':[{'words':[{'word':'1202.'}]}]}))
    (video.path/'assets/song.mp3').write_bytes(b'original-voice')
    (video.path/'assets/script.json').write_text(json.dumps({'segments':[{'text':SCRIPT_TEXT}]}))
    media=video.path/'assets/media';media.mkdir()
    Image.new('RGB',(40,40),'green').save(media/'hamilton.jpg')
    (media/'CREDITS.md').write_text('hamilton.jpg — Margaret Hamilton — Draper — PD')
    video.duration_seconds=233
    errors=[asdict(i) for i in check_package(PublishPackage.model_validate(payload),resolve_for_video(video).rules,video.path,233) if i.level=='error']
    assert not errors,errors
    tasks=[]
    monkeypatch.setattr(module,'start_owned_task',lambda kind,ident,fn:tasks.append(fn))
    monkeypatch.setattr(module,'load_video',lambda _:video)
    async def capture(current,orientation):
        result={}
        for option,spec in thumbnails.intro_specs(current).items():
            file=thumbnails.thumbnail_file(current,option,orientation)
            file.parent.mkdir(parents=True,exist_ok=True)
            Image.new('RGB',(64,36),'green').save(file)
            file.with_suffix('.sha256').write_text(thumbnails._capture_digest(current,spec))
            result[option]=file
        return result
    generator=SimpleNamespace(generate=AsyncMock(return_value=payload))
    service=EditorialPreparationService(generator,capture)
    await service.submit('demo');await tasks.pop()()
    assert service.status('demo')['state']=='ready',service.status('demo')
    publish=json.loads((video.path/'publish.json').read_text())
    assert publish['youtube_title'] and publish['facebook_title'] and publish['tiktok_caption']
    assert len(list((video.path/'assets/thumbnails').glob('thumbnail-*.jpg')))==6
    assert (video.path/'assets/song.mp3').read_bytes()==b'original-voice'
    assert not list(video.path.rglob('*.mp4'))
    # An unchanged complete package is rechecked and reuses copy, not sent to AI again.
    await service.submit('demo');await tasks.pop()()
    assert generator.generate.await_count==1
    assert service.status('demo')['state']=='ready'


def test_selection_between_valid_alternatives_does_not_invalidate_readiness(video):
    from src.core.explainer.editorial_preparation import input_signature
    value={'schema_version':2,'thumbnail':{'chosen':'text_only'},'titles':{'chosen':'A'},'youtube_title':'A'}
    path=video.path/'publish.json';path.write_text(json.dumps(value))
    before=input_signature(video,readiness=True)
    value['thumbnail']['chosen']='with_image';value['titles']['chosen']='B';value['youtube_title']='B'
    path.write_text(json.dumps(value))
    assert input_signature(video,readiness=True)==before
    value['titles']['youtube']=[{'text':'A changed editorial title'}];path.write_text(json.dumps(value))
    assert input_signature(video,readiness=True)!=before

import json
import pytest

from src.config.settings import settings
from src.core.explainer.agent_context import ensure_private_workspace, prepare_design_context
from src.core.explainer.designs import available_design_ids
from src.core.explainer.producer import build_agent_prompt
from src.core.prototypes import ideas, runs


def profile(monkeypatch, tmp_path):
    root = tmp_path / 'profile'
    root.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    monkeypatch.setattr(settings, 'data_dir', root / 'data')
    return root


def test_context_has_selected_public_components_and_safe_references(tmp_path):
    video = tmp_path / 'video'
    video.mkdir()
    context = prepare_design_context(video, 'rough')
    index = json.loads((context / 'index.json').read_text())
    assert (context / 'QUICK.md').is_file()
    assert any(x['id'] == 'rough.title' for x in index['entries'])
    assert any(x['id'] == 'common.punch' for x in index['entries'])
    assert all(x['id'].startswith(('rough.', 'common.')) for x in index['entries'])
    title = json.loads((context / 'entries/rough.title.json').read_text())
    assert title['params'] and title['example']
    assert not list(context.rglob('*.env'))
    for design in available_design_ids():
        target = tmp_path / design
        target.mkdir(exist_ok=True)
        assert (prepare_design_context(target, design) / 'index.json').is_file()


def test_context_rejects_symlinks_without_overwriting_external_data(tmp_path):
    video = tmp_path / 'video'
    (video / 'work').mkdir(parents=True)
    outside = tmp_path / 'outside'
    outside.mkdir()
    (video / 'work/agent-context').symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError, match='simbólicos'):
        prepare_design_context(video, 'rough')
    assert list(outside.iterdir()) == []


def test_workspace_permissions_are_private_without_following_shared_files(tmp_path):
    import os
    root = tmp_path / 'workspace'
    root.mkdir(mode=0o775)
    root.chmod(0o775)
    child = root / 'child'
    child.mkdir(mode=0o775)
    child.chmod(0o775)
    executable = child / 'tool'
    executable.write_text('synthetic')
    executable.chmod(0o775)
    outside = tmp_path / 'outside'
    outside.write_text('synthetic')
    outside.chmod(0o664)
    os.link(outside, child / 'link')
    with pytest.raises(ValueError, match='compartidos'):
        ensure_private_workspace(root)
    assert outside.stat().st_mode & 0o777 == 0o664
    (child / 'link').unlink()
    ensure_private_workspace(root)
    assert root.stat().st_mode & 0o777 == 0o700
    assert child.stat().st_mode & 0o777 == 0o700
    assert executable.stat().st_mode & 0o777 == 0o700


def test_v3_prompt_is_file_only_and_preserves_phase_contract(tmp_path, monkeypatch):
    profile(monkeypatch, tmp_path)
    record = {'video_id': 'demo', 'design': 'rough', 'topic': 'Tema', 'category_path': 'node_tech',
              'target_minutes': 2}
    script = build_agent_prompt(record, tmp_path / 'video', phase='guion')
    story = build_agent_prompt(record, tmp_path / 'video', phase='storyboard', qc='sincronizar')
    assert 'FASE GUION' in script and 'script_ready' in script and 'work/agent-context/index.json' in script
    assert 'FASE STORYBOARD' in story and 'assets/lyrics.json' in story and 'sincronizar' in story
    assert 'kit.py' not in script and 'media.py' not in script and 'delegate' not in script
    assert 'host genera y valida' in script


def test_prototype_workspace_contains_only_requested_idea_and_scope(tmp_path, monkeypatch):
    root = profile(monkeypatch, tmp_path)
    idea = ideas.create_idea('nodehistory', 'Referencia', 'Notas propias', [('example.png', b'image')])
    other = ideas.create_idea('nodehistory', 'Otra', 'NO compartir', [])
    service = runs.PrototypeRunService(agent_getter=lambda _: None)
    rec = {'category': 'nodehistory', 'template_id': 'test-design', 'idea_id': idea.slug,
           'mode': 'full', 'model': 'fake', 'reasoning_effort': 'high'}
    cwd = service._prepare_isolated_workspace(rec)
    context = cwd / 'work/agent-context'
    assert cwd == root / 'sandbox/nodehistory/test-design'
    assert (context / 'references/example.png').read_bytes() == b'image'
    brief = (context / 'BRIEF.md').read_text()
    assert 'Notas propias' in brief and 'NO compartir' not in brief and other.slug not in brief
    scope = service._scope(rec)
    assert scope.writable_dir == str(cwd) == scope.os_sandbox_dir
    assert scope.commands == scope.extra_writable == () and scope.extra_env == {}
    prompt = service._prompt(rec)
    assert 'no puedes ejecutar comandos' in prompt.lower() and 'validacion-pendiente.md' in prompt
    assert service._isolated_artifact_failure(rec)
    (cwd / 'index.html').write_text('<html>synthetic</html>')
    (cwd / 'info.json').write_text(json.dumps({'reference': f'referencias/nodehistory/{idea.slug}'}))
    assert service._isolated_artifact_failure(rec) is None
    (cwd / 'info.json').write_text('{"reference":"referencias/nodehistory/other"}')
    assert service._isolated_artifact_failure(rec)


@pytest.mark.asyncio
@pytest.mark.parametrize('has_candidates', [True, False])
async def test_v3_producer_runs_agents_and_host_steps_in_order_with_video_scope(tmp_path, monkeypatch, has_candidates):
    from types import SimpleNamespace
    from src.core.explainer import host_media
    from src.core.explainer import producer as module

    root = profile(monkeypatch, tmp_path)
    video = root / 'productions/nodetech/demo'
    record = {'production_id': 'p1', 'video_id': 'demo', 'design': 'rough', 'topic': 'Tema',
              'category_path': 'node_tech', 'log_path': str(root / 'logs/video.log')}
    service = module.ExplainerProducer(agent_getter=lambda _: None)
    monkeypatch.setattr(service, 'get', lambda _: record)
    monkeypatch.setattr(service, '_root', lambda _: video.parent)
    monkeypatch.setattr(service, '_prepare_video', lambda *_: None)
    monkeypatch.setattr(module, '_validate_script', lambda *_: [])
    phases = []

    async def update(*args, **kwargs):
        pass

    async def kit(args):
        video.mkdir(parents=True)
        (video / 'assets').mkdir()
        return 0, 'synthetic'

    async def agent(rec, directory, log, scope, timeout, phase, **kwargs):
        assert directory == video
        assert scope.writable_dir == str(video) == scope.os_sandbox_dir
        assert scope.commands == scope.extra_writable == () and scope.extra_env == {}
        assert (video / 'work/agent-context/entries/rough.title.json').is_file()
        phases.append(phase)
        if phase == 'guion':
            (video / 'assets/script.json').write_text(json.dumps({'segments': [{'id': 's1', 'text': 'Uno', 'tone': 'normal'}]}))
            (video / 'work/phase.json').write_text('{"phase":"script_ready"}')
        elif phase == 'media_seleccion':
            (video / 'work/media-selection.json').write_text('{"version":1,"selections":[]}')
        else:
            (video / 'assets/storyboard.json').write_text('{"beats":[{"use":"rough.title"}]}')
        return SimpleNamespace(ok=True)

    async def host(rec, directory, log, phase):
        phases.append(phase)
        path = directory / ('assets/song.mp3' if phase == 'voice' else 'assets/lyrics.json')
        path.write_bytes(b'synthetic')

    async def finish(*args, **kwargs):
        phases.append('finish')

    async def prepare(*args):
        return {'request_count': int(has_candidates), 'candidates': [{'id': 'candidate'}] if has_candidates else [], 'applied': False}

    def apply(directory, production_id, state, **kwargs):
        if not (directory / 'work/media-selection.json').exists():
            raise host_media.MediaBrokerError('selection required')

    monkeypatch.setattr(host_media, 'prepare', prepare)
    monkeypatch.setattr(host_media, 'apply_selection', apply)

    monkeypatch.setattr(service, '_update', update)
    monkeypatch.setattr(service, '_kit', kit)
    monkeypatch.setattr(service, '_run_agent', agent)
    monkeypatch.setattr(service, '_host_step', host)
    monkeypatch.setattr(service, '_finish', finish)
    await service._run_locked('p1', resume=False)
    assert phases == (['guion', 'media_seleccion', 'voice', 'transcribe', 'storyboard', 'finish']
                      if has_candidates else ['guion', 'voice', 'transcribe', 'storyboard', 'finish'])


@pytest.mark.asyncio
async def test_resume_v3_legacy_script_ready_with_referenced_images_skips_media_search(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.core.explainer import host_media
    from src.core.explainer import producer as module

    root = profile(monkeypatch, tmp_path)
    video = root / 'productions/nodetech/legacy'
    (video / 'assets/media').mkdir(parents=True)
    (video / 'work').mkdir()
    (video / 'assets/media/existing.jpg').write_bytes(b'synthetic legacy image')
    (video / 'assets/script.json').write_text(json.dumps({'segments': [{'id': 's1', 'text': 'Narración existente', 'tone': 'normal'}]}))
    (video / 'assets/storyboard.json').write_text(json.dumps({'beats': [{'params': {'src': 'assets/media/existing.jpg'}}]}))
    (video / 'work/phase.json').write_text('{"phase":"script_ready"}')
    record = {'production_id': 'p1', 'video_id': 'legacy', 'design': 'rough', 'topic': 'Tema',
              'category_path': 'node_tech', 'log_path': str(root / 'logs/video.log'), 'media': []}
    service = module.ExplainerProducer(agent_getter=lambda _: None)
    monkeypatch.setattr(service, 'get', lambda _: record)
    monkeypatch.setattr(service, '_root', lambda _: video.parent)
    monkeypatch.setattr(module, '_validate_script', lambda *_: [])
    phases = []

    def no_providers():
        raise AssertionError('legacy media must not cause network search')

    async def update(*args, **kwargs):
        pass

    async def agent(rec, directory, log, scope, timeout, phase, **kwargs):
        phases.append(phase)
        return SimpleNamespace(ok=True)

    async def host(rec, directory, log, phase):
        phases.append(phase)
        (directory / ('assets/song.mp3' if phase == 'voice' else 'assets/lyrics.json')).write_bytes(b'synthetic')

    async def finish(*args, **kwargs):
        phases.append('finish')

    monkeypatch.setattr(host_media, 'get_stock_providers', no_providers)
    monkeypatch.setattr(service, '_update', update)
    monkeypatch.setattr(service, '_run_agent', agent)
    monkeypatch.setattr(service, '_host_step', host)
    monkeypatch.setattr(service, '_finish', finish)
    await service._run_locked('p1', resume=True)
    assert phases == ['voice', 'transcribe', 'storyboard', 'finish']
    assert json.loads((video / 'work/media-requests.json').read_text()) == {'version': 1, 'requests': []}
    assert (video / 'assets/media/existing.jpg').read_bytes() == b'synthetic legacy image'

from pathlib import Path

import pytest

from src.core.explainer.episode_runtime import ATLAS_ENGINE_URL, PROTO_URL, validate_atlas_episode_runtime, validate_atlas_episode_entry


def episode(tmp_path, extra=''):
    root = tmp_path / 'episode'
    (root / 'assets').mkdir(parents=True)
    (root / 'index.html').write_text(
        f'<div id="stage"></div><script src="{PROTO_URL}"></script>'
        f'<script type="module" src="{ATLAS_ENGINE_URL}"></script>{extra}'
    )
    return root


def test_data_episode_accepts_shared_engine_and_json(tmp_path):
    root = episode(tmp_path, '<script type="application/json">{"items":[]}</script>')
    (root / 'assets/scene.json').write_text('{"items":[]}')
    validate_atlas_episode_runtime(root)


@pytest.mark.parametrize('relative', ['engine', 'components', 'renderers', 'motor'])
def test_rejects_private_engine_even_when_entry_uses_shared_engine(tmp_path, relative):
    root = episode(tmp_path)
    (root / relative).mkdir()
    with pytest.raises(ValueError, match='carpeta de código propia'):
        validate_atlas_episode_runtime(root)


@pytest.mark.parametrize('extra', [
    '<script src="engine/plano/plano.js"></script>',
    '<script>document.querySelector("canvas").getContext("2d")</script>',
    '<img src="photo.png" onload="render()">',
    '<iframe src="private-renderer.html"></iframe>',
])
def test_rejects_local_or_inline_runtime(tmp_path, extra):
    with pytest.raises(ValueError, match='motor compartido'):
        validate_atlas_episode_runtime(episode(tmp_path, extra))


def test_rejects_renderer_hidden_in_assets(tmp_path):
    root = episode(tmp_path)
    (root / 'assets/render.js').write_text('draw()')
    with pytest.raises(ValueError, match='código de ejecución en medios'):
        validate_atlas_episode_runtime(root)


def test_rejects_copied_scene_builder(tmp_path):
    root = episode(tmp_path)
    (root / 'tools').mkdir()
    (root / 'tools/build_scene.py').write_text('')
    with pytest.raises(ValueError, match='generador copiado'):
        validate_atlas_episode_runtime(root)


def test_rejects_entry_missing_shared_engine(tmp_path):
    root = episode(tmp_path)
    (root / 'index.html').write_text('<div id="stage"></div>')
    with pytest.raises(ValueError, match='una sola instancia'):
        validate_atlas_episode_runtime(root)


def test_allows_diagnostic_code_only_in_work(tmp_path):
    root = episode(tmp_path)
    (root / 'work').mkdir()
    (root / 'work/check.py').write_text('print("QA")')
    validate_atlas_episode_runtime(root)


def test_atlas_scaffold_and_prepared_gate_use_single_runtime(tmp_path):
    from src.core.explainer.native_production import scaffold, validate_prepared
    root = tmp_path / 'new-episode'
    scaffold({'design':'atlas-en-movimiento','estilo':'v4-atlas','topic':'Tema',
              'style_revision':'revision','target_minutes':10}, root)
    validate_atlas_episode_runtime(root)
    assert not (root / 'engine').exists()
    (root / 'engine').mkdir()
    with pytest.raises(ValueError, match='carpeta de código propia'):
        validate_prepared({'design':'atlas-en-movimiento'}, root)


def test_recording_gate_rejects_alternative_runtime_before_creating_a_job(tmp_path):
    from types import SimpleNamespace
    from src.core.explainer.recorder import ExplainerRecorder
    root = episode(tmp_path, '<script src="private-renderer.js"></script>')
    video = SimpleNamespace(design='atlas-en-movimiento', path=root, ready=True)
    recorder = object.__new__(ExplainerRecorder)
    with pytest.raises(ValueError, match='script ajeno al motor central'):
        recorder.submit(video)


def test_legacy_archives_do_not_change_the_active_runtime(tmp_path):
    root = episode(tmp_path)
    (root / 'engine').mkdir()
    validate_atlas_episode_entry(root)
    with pytest.raises(ValueError, match='carpeta de código propia'):
        validate_atlas_episode_runtime(root)

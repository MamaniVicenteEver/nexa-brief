import json
import pytest
from pydantic import ValidationError
from src.core.drafts import RenderOptions
from src.core.job import Job, JobInput, JobArtifacts
from src.core.nodemotion.lyrics.appearance import ensure_intro_title, prepare_render_appearance


def make_job(tmp_path):
    html = tmp_path / 'index.html'
    html.write_text('<html><head></head><body><img id="bgMedia"></body></html>')
    config = tmp_path / 'config.json'
    config.write_text(json.dumps({'activeId': 'active', 'configs': [{'id': 'active', 'intro': {'title': ''}, 'bg': {'src': 'bg.mp4', 'type': 'video'}}]}))
    return Job(input=JobInput(category_name='node_motion'), artifacts=JobArtifacts(
        output_dir=tmp_path, html_path=html, config_json_path=config, music_meta={'track_name': 'Mi canción'}))


def test_intro_title_uses_song_metadata_and_respects_existing(tmp_path):
    job = make_job(tmp_path)
    config = {'intro': {'title': ''}}
    assert ensure_intro_title(config, job, 'lyrics-impact')
    assert config['intro']['title'] == 'Mi canción'
    config['intro']['title'] = 'Título elegido'
    assert not ensure_intro_title(config, job, 'lyrics-impact')
    assert config['intro']['title'] == 'Título elegido'
    assert not ensure_intro_title({'intro': {}}, job, 'another-template')


def test_render_persists_selected_opacity_and_title_in_wrapped_config(tmp_path):
    job = make_job(tmp_path)
    updated = prepare_render_appearance(job, 'lyrics-impact', 0.42)
    config = json.loads(job.artifacts.config_json_path.read_text())['configs'][0]
    assert config['bg']['opacity'] == 0.42
    assert config['intro']['title'] == 'Mi canción'
    assert updated.artifacts.template_config == config
    assert '#bgMedia{opacity:0.42!important' in job.artifacts.html_path.read_text()
    prepare_render_appearance(updated, 'lyrics-impact', 0.3)
    assert job.artifacts.html_path.read_text().count('id="nexa-render-visibility"') == 1
    assert '#bgMedia{opacity:0.3!important' in job.artifacts.html_path.read_text()


def test_render_does_not_touch_other_templates(tmp_path):
    job = make_job(tmp_path)
    before = job.artifacts.config_json_path.read_bytes()
    assert prepare_render_appearance(job, 'different', 0.5) is job
    assert job.artifacts.config_json_path.read_bytes() == before


@pytest.mark.parametrize('value', [-0.1, 1.1, float('nan'), float('inf')])
def test_render_opacity_range(value):
    with pytest.raises(ValidationError):
        RenderOptions(background_opacity=value)

@pytest.mark.asyncio
async def test_existing_preview_receives_title_without_writing_its_config(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from starlette.requests import Request
    from src.presentation.api.routers import drafts as router
    job = make_job(tmp_path)
    before = job.artifacts.config_json_path.read_bytes()
    async def draft(_):
        return SimpleNamespace(template_id='lyrics-impact')
    monkeypatch.setattr(router.drafts, 'get', draft)
    monkeypatch.setattr(router.drafts, 'load_job', lambda _: job)
    request = Request({'type': 'http', 'method': 'GET', 'path': '/', 'headers': [], 'query_string': b'', 'scheme': 'http', 'server': ('test', 80)})
    response = await router.get_draft_preview_file('one', 'config.json', request)
    result = json.loads(response.body)
    assert result['configs'][0]['intro']['title'] == 'Mi canción'
    assert job.artifacts.config_json_path.read_bytes() == before

@pytest.mark.asyncio
async def test_impact_intro_keeps_song_name_not_thumbnail_text(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.core import draft_details, draft_thumbnails, drafts
    job = make_job(tmp_path)
    details = draft_details.DraftDetails(song_name='Nombre de la canción')
    draft = SimpleNamespace(details=details, template_id='lyrics-impact')
    option = SimpleNamespace(text='Texto diferente de miniatura')
    manifest = SimpleNamespace(selected='A', options={'A': option}, model_dump=lambda **_: {'options': {}})
    async def get(_): return draft
    async def capture(*args, **kwargs):
        image = tmp_path / 'thumbnail.png'
        image.write_bytes(b'fixture')
        return image
    async def patch(*args, **kwargs): return None
    captured = []
    monkeypatch.setattr(drafts, 'get', get)
    monkeypatch.setattr(drafts, 'thumbnail_manifest', lambda *_: manifest)
    monkeypatch.setattr(draft_details, 'apply_to_intro', lambda _path, data: captured.append(data.song_name))
    monkeypatch.setattr(draft_thumbnails, 'capture_selected', capture)
    monkeypatch.setattr(drafts, '_save_job', lambda *_: None)
    monkeypatch.setattr(drafts, '_patch', patch)
    await drafts._capture_selected_thumbnail('one', job)
    assert captured == ['Nombre de la canción']

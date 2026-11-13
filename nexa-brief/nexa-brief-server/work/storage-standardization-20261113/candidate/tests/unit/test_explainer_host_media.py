import io
import json
from types import SimpleNamespace

import httpx
import pytest
from PIL import Image

from src.adapters.stock.safe_image_download import SafeImageError
from src.config.settings import settings
from src.core.explainer import host_media as broker
from src.core.ports.stock_media_port import StockItem


class Provider:
    def accepts_download_url(self, url):
        return url.startswith('https://images.example/')


def image_bytes():
    out = io.BytesIO()
    Image.new('RGB', (12, 10), 'blue').save(out, format='PNG')
    return out.getvalue()


@pytest.fixture
def video(tmp_path, monkeypatch):
    root = tmp_path / 'profile'
    root.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', 3)
    directory = root / 'productions/nodetech/video1'
    (directory / 'assets/media').mkdir(parents=True)
    (directory / 'work/agent-context').mkdir(parents=True)
    (directory / 'assets/script.json').write_text(json.dumps({'segments': [{'text': 'A rocket leaves the launch pad.'}]}))
    (directory / 'work/media-requests.json').write_text(json.dumps({'version': 1, 'requests': [
        {'id': 'rocket', 'anchor': 'rocket leaves', 'shows': 'rocket on launch pad', 'queries': ['rocket launch pad']}]}))
    return directory


@pytest.mark.asyncio
async def test_host_selects_only_listed_images_preserves_credits_and_resumes(video, monkeypatch):
    calls = []
    item = StockItem(provider='fake', provider_id='42', kind='image', title='Rocket', author='Synthetic Author',
                     license='CC BY 4.0', source_url='https://images.example/item?private=ignored',
                     preview_url='https://images.example/thumb', download_url='https://images.example/photo')

    async def search(query, kind, **kwargs):
        calls.append((query, kind))
        return SimpleNamespace(results=[item], provider_errors=[])

    async def download(provider, url):
        assert url == item.download_url
        return image_bytes()

    monkeypatch.setattr(broker, 'search_stock', search)
    monkeypatch.setattr(broker, 'get_stock_providers', lambda: {'fake': Provider()})
    monkeypatch.setattr(broker, '_download', download)
    state = await broker.prepare(video, 'p1')
    public = json.loads((video / 'work/agent-context/media-candidates.json').read_text())
    assert len(public['candidates']) == 1 and 'download_url' not in str(public)
    assert '?private=' not in str(public)
    candidate = public['candidates'][0]
    # Editing the agent-visible catalog cannot change the host's provenance.
    (video / 'work/agent-context/media-candidates.json').write_text('{"forged":true}')
    selection = {'version': 1, 'selections': [{'request_id': 'rocket', 'candidate_id': candidate['id'],
                                               'depiction': 'A blue rocket on a launch pad'}]}
    (video / 'work/media-selection.json').write_text(json.dumps(selection))
    broker.apply_selection(video, 'p1', state)
    credits = (video / 'assets/media/CREDITS.md').read_text()
    assert 'Synthetic Author' in credits and 'CC BY 4.0' in credits and '?private=' not in credits
    imported = json.loads((video / 'work/agent-context/media-imported.json').read_text())['imported']
    assert len(imported) == 1 and (video / imported[0]['file']).read_bytes().startswith(b'\xff\xd8')
    state2 = await broker.prepare(video, 'p1')
    assert state2['applied'] and len(calls) == 1
    broker.apply_selection(video, 'p1', state2)
    assert (video / 'assets/media/CREDITS.md').read_text() == credits
    (video / imported[0]['file']).write_bytes(b'modified')
    with pytest.raises(broker.MediaBrokerError, match='modificada'):
        broker.apply_selection(video, 'p1', state2)


@pytest.mark.asyncio
async def test_forged_selection_and_candidate_modification_are_rejected(video, monkeypatch):
    item = StockItem(provider='fake', provider_id='42', kind='image', title='Rocket', author='Author',
                     license='CC BY 4.0', source_url='https://images.example/item',
                     preview_url='https://images.example/thumb', download_url='https://images.example/photo')
    async def search(*args, **kwargs):
        return SimpleNamespace(results=[item], provider_errors=[])
    async def download(*args):
        return image_bytes()
    monkeypatch.setattr(broker, 'search_stock', search)
    monkeypatch.setattr(broker, 'get_stock_providers', lambda: {'fake': Provider()})
    monkeypatch.setattr(broker, '_download', download)
    state = await broker.prepare(video, 'p1')
    (video / 'work/media-selection.json').write_text(json.dumps({'version': 1, 'selections': [
        {'request_id': 'rocket', 'candidate_id': 'https://127.0.0.1/', 'depiction': 'synthetic description'}]}))
    with pytest.raises(broker.MediaBrokerError, match='Selección'):
        broker.apply_selection(video, 'p1', state)
    (video / 'work/media-selection.json').write_text('{"version":1,"selections":[]}')
    with pytest.raises(broker.MediaBrokerError, match='Selección'):
        broker.apply_selection(video, 'p1', state, require_nonempty=True)
    requests = video / 'work/media-requests.json'
    original = requests.read_text()
    request_data = json.loads(original)
    request_data['requests'][0]['shows'] = 'a different subject'
    requests.write_text(json.dumps(request_data))
    with pytest.raises(broker.MediaBrokerError, match='cambió'):
        broker.apply_selection(video, 'p1', state)
    requests.write_text(original)
    candidate = state['candidates'][0]['id']
    path = video / f'work/agent-context/media-candidates/{candidate}.jpg'
    path.write_bytes(b'changed')
    with pytest.raises(broker.MediaBrokerError, match='modificada'):
        await broker.prepare(video, 'p1')
    assert not (video / 'assets/media/CREDITS.md').exists()


@pytest.mark.asyncio
async def test_downloader_rechecks_redirect_hosts_and_bounds_size():
    calls = []
    def redirect(request):
        calls.append(str(request.url))
        return httpx.Response(302, headers={'location': 'http://127.0.0.1/private'})
    with pytest.raises(SafeImageError, match='autorizada'):
        await broker._download(Provider(), 'https://images.example/start', transport=httpx.MockTransport(redirect))
    assert calls == ['https://images.example/start']
    def oversized(request):
        return httpx.Response(200, headers={'content-length': str(broker.MAX_IMAGE + 1)})
    with pytest.raises(SafeImageError, match='grande'):
        await broker._download(Provider(), 'https://images.example/start', transport=httpx.MockTransport(oversized))


def test_requests_reject_arbitrary_urls_and_nonexistent_anchors(video):
    path = video / 'work/media-requests.json'
    data = json.loads(path.read_text())
    data['requests'][0]['queries'] = ['https://127.0.0.1/secret']
    path.write_text(json.dumps(data))
    with pytest.raises(broker.MediaBrokerError):
        broker._requests(video)
    data['requests'][0]['queries'] = ['rocket launch']
    data['requests'][0]['anchor'] = 'invented sentence'
    path.write_text(json.dumps(data))
    with pytest.raises(broker.MediaBrokerError):
        broker._requests(video)


def test_legacy_empty_request_requires_explicit_existing_uploaded_media(video):
    path = video / 'work/media-requests.json'
    path.unlink()
    broker.initialize_legacy_requests(video, [])
    assert not path.exists()
    with pytest.raises(broker.MediaBrokerError, match='no están disponibles'):
        broker.initialize_legacy_requests(video, ['missing.jpg'])
    image = video / 'assets/media/upload.jpg'
    image.write_bytes(image_bytes())
    broker.initialize_legacy_requests(video, ['upload.jpg'])
    assert json.loads(path.read_text()) == {'version': 1, 'requests': []}


@pytest.mark.asyncio
async def test_empty_requests_need_no_provider_or_network(video, monkeypatch):
    (video / 'work/media-requests.json').write_text('{"version":1,"requests":[]}')

    def unexpected():
        raise AssertionError('providers must not be initialized')

    monkeypatch.setattr(broker, 'get_stock_providers', unexpected)
    state = await broker.prepare(video, 'p1')
    assert state['request_count'] == 0 and state['candidates'] == []


def test_resume_recognizes_only_referenced_owned_legacy_media(video, tmp_path):
    request = video / 'work/media-requests.json'
    request.unlink()
    image = video / 'assets/media/legacy.jpg'
    image.write_bytes(image_bytes())
    storyboard = video / 'assets/storyboard.json'
    storyboard.write_text(json.dumps({'beats': [{'params': {'src': 'assets/media/legacy.jpg'}}]}))
    broker.initialize_legacy_requests(video, [], allow_existing_references=False)
    assert not request.exists()  # A new production must still make its request explicit.
    broker.initialize_legacy_requests(video, [], allow_existing_references=True)
    assert json.loads(request.read_text()) == {'version': 1, 'requests': []}
    request.unlink()
    storyboard.unlink()
    (video / 'manifest.json').write_text(json.dumps({'media_review': [{'source': 'assets/media/legacy.jpg'}]}))
    broker.initialize_legacy_requests(video, [], allow_existing_references=True)
    assert request.exists()
    request.unlink()
    (video / 'manifest.json').unlink()
    outside = tmp_path / 'other-profile.jpg'
    outside.write_bytes(image_bytes())
    image.unlink()
    image.symlink_to(outside)
    storyboard.write_text(json.dumps({'beats': [{'params': {'src': 'assets/media/legacy.jpg'}}]}))
    broker.initialize_legacy_requests(video, [], allow_existing_references=True)
    assert not request.exists()
    storyboard.write_text(json.dumps({'beats': [{'params': {'src': 'assets/media/../../other-profile.jpg'}}]}))
    broker.initialize_legacy_requests(video, [], allow_existing_references=True)
    assert not request.exists()
    storyboard.write_text(json.dumps({'beats': [{'params': {'src': 'https://example.com/legacy.jpg'}}]}))
    broker.initialize_legacy_requests(video, [], allow_existing_references=True)
    assert not request.exists()

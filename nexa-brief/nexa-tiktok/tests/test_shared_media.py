import hashlib
from pathlib import Path

from fastapi.testclient import TestClient

from nexa_tiktok.adapters.store_json.store import JsonStore
from nexa_tiktok.config import settings
from nexa_tiktok.main import create_app


def test_media_transfer_requires_auth_and_creates_no_publication(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'synthetic-key')
    store = JsonStore(tmp_path)
    client = TestClient(create_app(store=store, browser=object()))
    data = b'synthetic-video'
    checksum = hashlib.sha256(data).hexdigest()
    assert client.put(f'/v1/media/{checksum}', content=data).status_code == 401
    response = client.put(f'/v1/media/{checksum}?suffix=.mp4', content=data, headers={'X-Nexa-Tiktok-Key': 'synthetic-key'})
    assert response.status_code == 200
    path = Path(response.json()['path'])
    assert path.parent == tmp_path / 'uploads'
    assert path.read_bytes() == data
    assert path.stat().st_mode & 0o777 == 0o600
    assert store.list_jobs() == []
    assert client.put(f'/v1/media/{checksum}?suffix=.mp4', content=data, headers={'X-Nexa-Tiktok-Key': 'synthetic-key'}).status_code == 200
    assert len(list(path.parent.iterdir())) == 1


def test_invalid_checksum_and_suffix_do_not_leave_files(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, 'nexa_tiktok_key', 'synthetic-key')
    client = TestClient(create_app(store=JsonStore(tmp_path), browser=object()))
    headers = {'X-Nexa-Tiktok-Key': 'synthetic-key'}
    response = client.put('/v1/media/' + '0' * 64, content=b'incorrect-checksum', headers=headers)
    assert response.status_code == 422
    assert list((tmp_path / 'uploads').iterdir()) == []
    assert client.put('/v1/media/' + '0' * 64 + '?suffix=../../escape', content=b'x', headers=headers).status_code == 422

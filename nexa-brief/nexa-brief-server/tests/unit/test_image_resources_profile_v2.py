"""Use only generated profile fixtures to verify image resource isolation."""
import hashlib
import json

import pytest

from src.adapters.data.licensed_reel_music import LicensedReelMusic
from src.adapters.data.local_image_media_cache import LocalImageMediaCache
from src.adapters.data.local_image_post_resources import LocalImagePostResources
from src.config.profile_layout import resolve_profile_layout
from src.config.settings import settings
from src.core.image_posts.models import MusicOption


@pytest.fixture
def v2(tmp_path, monkeypatch):
    layout = resolve_profile_layout(tmp_path / 'profile', 2)
    monkeypatch.setattr(settings, 'storage_profile_dir', layout.root)
    monkeypatch.setattr(settings, 'storage_layout_version', 2)
    monkeypatch.setattr(settings, 'data_dir', layout.data_dir)
    return layout


def test_image_cache_writes_outside_data_and_reads_own_legacy(v2):
    content = b'synthetic-image'
    digest = hashlib.sha256(content).hexdigest()
    metadata = {'sha256': digest, 'extension': '.jpg'}
    legacy_root = v2.data_dir / 'media-cache/wikimedia'
    (legacy_root / '.index').mkdir(parents=True)
    (legacy_root / f'{digest}.jpg').write_bytes(content)
    (legacy_root / f'{digest}.json').write_text(json.dumps(metadata))
    old_index = hashlib.sha256(b'https://example.invalid/old').hexdigest()
    (legacy_root / '.index' / f'{old_index}.json').write_text(json.dumps(metadata))
    cache = LocalImageMediaCache(v2.data_dir)
    assert cache.get_by_url('https://example.invalid/old').content == content
    assert cache.get_by_sha256(digest) == content
    cache.put_by_url('https://example.invalid/new', content, metadata)
    assert (v2.cache_dir / 'media-cache/wikimedia' / f'{digest}.jpg').read_bytes() == content
    assert not list(v2.data_dir.rglob('*.tmp'))
    assert not list(v2.runtime_dir.rglob('*.tmp'))


def test_image_cache_rejects_traversal_in_untrusted_index(v2):
    cache = LocalImageMediaCache()
    url = 'https://example.invalid/example'
    index = cache.root / '.index' / f'{hashlib.sha256(url.encode()).hexdigest()}.json'
    index.parent.mkdir(parents=True)
    index.write_text(json.dumps({'sha256': '../' + 'a' * 61, 'extension': '.jpg'}))
    assert cache.get_by_url(url) is None


def test_missing_account_map_never_falls_back_outside_profile(v2, tmp_path):
    outside = tmp_path / 'server/data/image_posts/account_map.json'
    outside.parent.mkdir(parents=True)
    outside.write_text(json.dumps({'schema_version': 1, 'accounts': [
        {'category_id': 'cat', 'platform': 'test', 'account_alias': 'other'}]}))
    resources = LocalImagePostResources()
    resources.server_dir = tmp_path / 'server'
    assert resources.accounts_for_category('cat') == []
    with pytest.raises(LookupError, match='ACCOUNT_NOT_LINKED'):
        resources.resolve_account('cat', 'test', 'other')


def test_reel_music_uses_v2_resource_or_same_profile_legacy(v2):
    content = b'synthetic audio'
    digest = hashlib.sha256(content).hexdigest()
    license_data = {'spdx_or_name': 'CC0-1.0', 'url': 'https://example.invalid/license',
                    'author': 'Creator', 'track_url': 'https://example.invalid/audio',
                    'proof_ref': 'https://example.invalid/proof', 'attribution': 'Creator'}
    row = {'music_asset_id': 'song', 'file': 'track.mp3', 'source_sha256': digest,
           'license': license_data, 'commercial_sync': True, 'instrumental': True}
    legacy = v2.data_dir / 'media-cache/reel_music'
    legacy.mkdir(parents=True)
    (legacy / 'catalog.json').write_text(json.dumps({'schema_version': 1, 'tracks': [row]}))
    (legacy / 'track.mp3').write_bytes(content)
    option = MusicOption(mode='convert_to_reel', music_asset_id='song', source_sha256=digest, license=license_data)
    catalog = LicensedReelMusic(v2.data_dir)
    assert catalog.resolve(option).path == legacy / 'track.mp3'
    migrated = v2.resources_dir / 'reel_music/track.mp3'
    migrated.parent.mkdir(parents=True)
    migrated.write_bytes(content)
    assert catalog.resolve(option).path == migrated


def test_cache_and_runtime_reject_profile_symlinks(v2, tmp_path):
    outside = tmp_path / 'outside'
    outside.mkdir()
    v2.system_dir.mkdir(parents=True)
    v2.cache_dir.symlink_to(outside, target_is_directory=True)
    content = b'synthetic'
    digest = hashlib.sha256(content).hexdigest()
    cache = LocalImageMediaCache()
    with pytest.raises(ValueError, match='Symlinks'):
        cache.put_by_url('https://example.invalid', content, {'sha256': digest, 'extension': '.jpg'})
    assert not list(outside.iterdir())
    v2.cache_dir.unlink()
    v2.runtime_dir.symlink_to(outside, target_is_directory=True)
    with pytest.raises(ValueError, match='Symlinks'):
        cache.put_by_url('https://example.invalid', content, {'sha256': digest, 'extension': '.jpg'})
    assert not list(outside.iterdir())

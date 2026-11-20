"""Signed-media migration and profile isolation with synthetic files."""
import pytest

from src.adapters.publishing.instagram_media_url import create_signed_media_token, resolve_signed_media_token
from src.config.settings import settings


def test_v1_tokens_and_v2_media_are_resolved_within_selected_profile(tmp_path, monkeypatch):
    profile = tmp_path / 'profile'
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 1)
    monkeypatch.setattr(settings, 'storage_profile_id', 'one')
    monkeypatch.setattr(settings, 'data_dir', profile / 'data')
    monkeypatch.setattr(settings, 'output_dir', profile / 'output')
    monkeypatch.setattr(settings, 'publisher_encryption_key', 'synthetic-signing-key')
    key = 'cat/post/slide.jpg'
    old = profile / 'data/publicaciones' / key
    old.parent.mkdir(parents=True)
    old.write_bytes(b'\xff\xd8\xffold-image')
    old_video = profile / 'output/job/file.mp4'
    old_video.parent.mkdir(parents=True)
    old_video.write_bytes(b'0000ftypold-video')
    old_token = create_signed_media_token(key)
    old_video_token = create_signed_media_token(old_video)

    monkeypatch.setattr(settings, 'storage_layout_version', 2)
    monkeypatch.setattr(settings, 'output_dir', profile / 'renders')
    current = profile / 'productions/_publicaciones' / key
    current.parent.mkdir(parents=True)
    current.write_bytes(b'\xff\xd8\xffnew-image')
    token = create_signed_media_token(key)
    assert resolve_signed_media_token(token) == current
    assert resolve_signed_media_token(old_token) == old
    assert resolve_signed_media_token(old_video_token) == old_video

    other = tmp_path / 'other'
    other_current = other / 'productions/_publicaciones' / key
    other_current.parent.mkdir(parents=True)
    other_current.write_bytes(current.read_bytes())
    monkeypatch.setattr(settings, 'storage_profile_dir', other)
    monkeypatch.setattr(settings, 'storage_profile_id', 'two')
    monkeypatch.setattr(settings, 'data_dir', other / 'data')
    monkeypatch.setattr(settings, 'output_dir', other / 'renders')
    with pytest.raises(ValueError, match='profile'):
        resolve_signed_media_token(token)
    with pytest.raises(ValueError):
        resolve_signed_media_token(old_token)


def test_signed_token_rejects_symlink_even_when_target_is_inside_root(tmp_path, monkeypatch):
    profile = tmp_path / 'profile'
    monkeypatch.setattr(settings, 'storage_profile_dir', profile)
    monkeypatch.setattr(settings, 'storage_layout_version', 2)
    monkeypatch.setattr(settings, 'storage_profile_id', 'one')
    monkeypatch.setattr(settings, 'data_dir', profile / 'data')
    monkeypatch.setattr(settings, 'output_dir', profile / 'renders')
    monkeypatch.setattr(settings, 'publisher_encryption_key', 'synthetic-signing-key')
    root = profile / 'productions/_publicaciones/cat'
    root.mkdir(parents=True)
    media = root / 'one.jpg'
    media.write_bytes(b'\xff\xd8\xffsame')
    token = create_signed_media_token('cat/one.jpg')
    target = root / 'other.jpg'
    target.write_bytes(media.read_bytes())
    media.unlink()
    media.symlink_to(target)
    with pytest.raises(ValueError, match='Symlinks'):
        resolve_signed_media_token(token)

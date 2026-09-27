"""Contrato del DataStore JSON (src/adapters/data/) — cualquier backend nuevo
(Supabase, Postgres…) debería pasar estos mismos casos."""

from __future__ import annotations

from pathlib import Path

import pytest

from src.adapters.data.json_store import JsonDataStore
from src.adapters.data.local_file_storage import sanitize_filename
from src.core.library import asset_library


@pytest.fixture
def store() -> JsonDataStore:
    return JsonDataStore()


@pytest.mark.asyncio
async def test_collection_crud(store: JsonDataStore):
    jobs = store.collection("jobs")
    await jobs.insert({"job_id": "a", "stage": "pending"})
    await jobs.insert({"job_id": "b", "stage": "failed"})

    assert jobs.get("a") == {"job_id": "a", "stage": "pending"}
    assert [r["job_id"] for r in jobs.list({"stage": "failed"})] == ["b"]

    updated = await jobs.update("a", {"stage": "packaged"})
    assert updated == {"job_id": "a", "stage": "packaged"}
    assert await jobs.update("missing", {"stage": "x"}) is None

    removed = await jobs.delete("b")
    assert removed and removed["job_id"] == "b"
    assert jobs.get("b") is None


@pytest.mark.asyncio
async def test_conditional_update_only_if(store: JsonDataStore):
    queue = store.collection("queue_entries")
    await queue.insert({"entry_id": "e1", "status": "published"})
    assert await queue.update("e1", {"status": "cancelled"}, only_if={"status": "queued"}) is None
    assert queue.get("e1")["status"] == "published"


@pytest.mark.asyncio
async def test_upsert_increment_and_delete_where(store: JsonDataStore):
    channels = store.collection("channels")
    await channels.upsert({"platform": "youtube", "alias": "c1", "name": "A"}, match=("platform", "alias"))
    await channels.upsert({"platform": "youtube", "alias": "c1", "name": "B"}, match=("platform", "alias"))
    assert [c["name"] for c in channels.list()] == ["B"]
    assert len(await channels.delete_where({"alias": "c1"})) == 1

    music = store.collection("music_assets")
    await music.insert({"asset_id": "m1", "usage_count": 1})
    bumped = await music.increment("m1", "usage_count", patch={"last_used_at": "now"})
    assert bumped == {"asset_id": "m1", "usage_count": 2, "last_used_at": "now"}


def test_documents_roundtrip(store: JsonDataStore):
    lyrics = store.documents("lyrics")
    assert lyrics.get("x") is None
    lyrics.put("x", {"words": [1, 2]})
    assert lyrics.get("x") == {"words": [1, 2]}
    assert lyrics.delete("x") is True
    with pytest.raises(ValueError):
        lyrics.put("../escape", {})


def test_file_storage_keeps_original_name_and_avoids_collisions(store: JsonDataStore, tmp_path: Path):
    source = tmp_path / "upload.mp3"
    source.write_bytes(b"audio")
    music = store.files("music")

    first = music.save(source, folder="songs", filename="Mi Canción - Artista.mp3")
    second = music.save(source, folder="songs", filename="Mi Canción - Artista.mp3")

    assert first == "songs/Mi Canción - Artista.mp3"
    assert second == "songs/Mi Canción - Artista (2).mp3"
    assert music.local_path(first).read_bytes() == b"audio"
    assert set(music.list_keys("songs", suffix=".mp3")) == {first, second}
    with pytest.raises(ValueError):
        music.local_path("../../etc/passwd")


def test_sanitize_filename_only_strips_invalid_characters():
    # Solo se conserva el nombre base: un cliente no puede elegir la carpeta.
    assert sanitize_filename('carpeta/b\\c:d*e?"f<g>h|.JPG') == "bcdefgh.jpg"
    assert sanitize_filename("  Ñandú   feliz .png") == "Ñandú feliz.png"
    assert sanitize_filename("???.mp3") == "archivo.mp3"


@pytest.mark.asyncio
async def test_register_music_keeps_uploaded_filename(tmp_path: Path):
    source = tmp_path / "upload.mp3"
    source.write_bytes(b"song-bytes")

    entry = await asset_library.register_music(
        source, category="songs_with_lyrics", source="upload",
        track_name="Midnight Blade", filename="Midnight_Blade-DarkComposer.mp3",
    )

    assert entry.original_filename == "Midnight_Blade-DarkComposer.mp3"
    assert entry.relative_path == "songs_with_lyrics/Midnight_Blade-DarkComposer.mp3"
    assert asset_library.resolve_music_path(entry.asset_id).read_bytes() == b"song-bytes"
    assert asset_library.find_music_by_hash(entry.content_hash).asset_id == entry.asset_id

    await asset_library.touch_usage(entry.asset_id, "music")
    assert asset_library.get_music_entry(entry.asset_id).usage_count == 2

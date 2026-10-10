"""Transcripción compartida pipeline/librería (core/library/transcription.py).

Whisper se reemplaza por un transcriptor falso: lo que se prueba es el caché,
el lock por asset, los estados y los eventos — no la transcripción en sí.
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any

import pytest

from src.core.library import asset_library, transcription
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent

LYRICS = {"metadata": {"language": "es"}, "segments": [{"id": 0, "text": "hola", "words": []}]}


class FakeTranscriber:
    def __init__(self, *, fail: bool = False, delay: float = 0.0) -> None:
        self.calls: list[tuple[Path, str | None]] = []
        self.fail = fail
        self.delay = delay

    async def transcribe(self, audio_path: Path, language: str | None = None) -> dict[str, Any]:
        self.calls.append((audio_path, language))
        if self.delay:
            await asyncio.sleep(self.delay)
        if self.fail:
            raise RuntimeError("whisper explotó")
        return LYRICS

    async def detect_language(self, audio_path: Path, candidates):  # pragma: no cover - no se usa
        return {}


@pytest.fixture
def events():
    received: list[RealtimeEvent] = []

    async def collect(event: RealtimeEvent) -> None:
        received.append(event)

    unsubscribe = get_event_bus().subscribe(collect)
    yield received
    unsubscribe()


async def _register_song(tmp_path: Path, **meta: Any) -> asset_library.MusicLibraryEntry:
    audio = tmp_path / "cancion.mp3"
    audio.write_bytes(b"ID3 fake audio " + str(meta).encode())
    return await asset_library.register_music(
        audio, category="uploads", source="upload", provider="user_upload",
        filename="Canción.mp3", track_name="Canción", **meta,
    )


async def test_ensure_lyrics_transcribes_once_and_caches(tmp_path: Path, events):
    entry = await _register_song(tmp_path)
    fake = FakeTranscriber()

    lyrics, cache_hit = await transcription.ensure_lyrics(entry.asset_id, tmp_path / "cancion.mp3", lambda: fake)
    assert (lyrics, cache_hit) == (LYRICS, False)

    lyrics, cache_hit = await transcription.ensure_lyrics(entry.asset_id, tmp_path / "cancion.mp3", lambda: fake)
    assert cache_hit is True
    assert len(fake.calls) == 1

    stored = asset_library.get_music_entry(entry.asset_id)
    assert stored.transcription_status == "done"
    assert stored.has_lyrics_cache is True
    # Sin idioma indicado, se guarda el que detectó Whisper.
    assert stored.language == "es"
    assert [e.data["transcription_status"] for e in events] == ["running", "done"]
    assert all(e.type == "library_asset_changed" and e.data["kind"] == "music" for e in events)


async def test_concurrent_requests_share_one_transcription(tmp_path: Path):
    entry = await _register_song(tmp_path)
    fake = FakeTranscriber(delay=0.05)
    path = tmp_path / "cancion.mp3"

    results = await asyncio.gather(
        transcription.ensure_lyrics(entry.asset_id, path, lambda: fake),
        transcription.ensure_lyrics(entry.asset_id, path, lambda: fake),
    )
    assert len(fake.calls) == 1
    assert sorted(hit for _, hit in results) == [False, True]


async def test_failure_marks_failed_and_reraises(tmp_path: Path):
    entry = await _register_song(tmp_path)
    with pytest.raises(RuntimeError):
        await transcription.ensure_lyrics(
            entry.asset_id, tmp_path / "cancion.mp3", lambda: FakeTranscriber(fail=True)
        )
    stored = asset_library.get_music_entry(entry.asset_id)
    assert stored.transcription_status == "failed"
    assert "whisper explotó" in stored.transcription_error


async def test_enqueue_runs_in_background(tmp_path: Path):
    entry = await _register_song(tmp_path, language="en")
    fake = FakeTranscriber(delay=0.01)

    queued = await transcription.enqueue(entry.asset_id, lambda: fake)
    assert queued.transcription_status == "pending"
    assert transcription.is_queued(entry.asset_id)
    # Encolar de nuevo mientras corre no lanza otra.
    await transcription.enqueue(entry.asset_id, lambda: fake)

    for _ in range(100):
        if not transcription.is_queued(entry.asset_id):
            break
        await asyncio.sleep(0.01)

    stored = asset_library.get_music_entry(entry.asset_id)
    assert stored.transcription_status == "done"
    assert fake.calls == [(asset_library.resolve_music_path(entry.asset_id), "en")]
    # Idioma indicado por el usuario: no se pisa con el detectado.
    assert stored.language == "en"


async def test_enqueue_without_force_skips_cached_song(tmp_path: Path):
    entry = await _register_song(tmp_path)
    await asset_library.save_lyrics_cache(entry.asset_id, LYRICS)
    fake = FakeTranscriber()

    result = await transcription.enqueue(entry.asset_id, lambda: fake)
    assert result.transcription_status == "done"
    assert not transcription.is_queued(entry.asset_id)
    assert fake.calls == []


async def test_mark_interrupted_fixes_stale_states(tmp_path: Path):
    entry = await _register_song(tmp_path)
    await asset_library.set_transcription_status(entry.asset_id, "running")

    assert await transcription.mark_interrupted() == 1
    stored = asset_library.get_music_entry(entry.asset_id)
    assert stored.transcription_status == "failed"
    assert stored.transcription_error


def test_legacy_entry_with_cache_reads_as_done():
    # Registros previos a F1: tienen has_lyrics_cache pero no transcription_status.
    legacy = asset_library.MusicLibraryEntry(
        asset_id="abc", category="songs_with_lyrics", relative_path="x/y.mp3",
        source="upload", has_lyrics_cache=True,
    )
    assert legacy.transcription_status == "done"
    assert legacy.description == "" and legacy.tags == ""

"""Librería de recursos (F1): subir, buscar, editar, borrar, letra y transcripción.

Se monta solo el router de library en una app propia (sin el lifespan de
main.py, que arranca el scheduler de publicación) y dentro de `with
TestClient(...)`: así todas las requests comparten el mismo event loop y la
transcripción en segundo plano llega a correr entre una request y otra.
"""

from __future__ import annotations

import shutil
import subprocess
import time
from pathlib import Path
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.library import asset_library
from src.core.realtime.event_bus import get_event_bus
from src.core.realtime.events import RealtimeEvent
from src.presentation.api.routers import library as library_router

LYRICS = {"metadata": {"language": "es"}, "segments": [{"id": 0, "text": "hola mundo", "words": []}]}
HAS_FFMPEG = shutil.which("ffmpeg") is not None and shutil.which("ffprobe") is not None


class FakeTranscriber:
    def __init__(self) -> None:
        self.calls: list[tuple[Path, str | None]] = []

    async def transcribe(self, audio_path: Path, language: str | None = None) -> dict[str, Any]:
        self.calls.append((audio_path, language))
        return LYRICS

    async def detect_language(self, audio_path: Path, candidates):  # pragma: no cover
        return {}


@pytest.fixture
def fake_transcriber(monkeypatch: pytest.MonkeyPatch) -> FakeTranscriber:
    fake = FakeTranscriber()
    monkeypatch.setattr(library_router, "get_lyrics_transcriber", lambda: fake)
    return fake


@pytest.fixture
def client(fake_transcriber):
    app = FastAPI()
    app.include_router(library_router.router, prefix="/api/v1")
    with TestClient(app) as c:
        yield c


@pytest.fixture
def events():
    received: list[RealtimeEvent] = []

    async def collect(event: RealtimeEvent) -> None:
        received.append(event)

    unsubscribe = get_event_bus().subscribe(collect)
    yield received
    unsubscribe()


def _wait_status(client: TestClient, asset_id: str, status: str) -> dict[str, Any]:
    for _ in range(200):
        body = client.get(f"/api/v1/library/music/{asset_id}").json()
        if body["transcription_status"] == status:
            return body
        time.sleep(0.01)
    raise AssertionError(f"transcription_status nunca llegó a {status!r}: {body}")


def _upload_song(client: TestClient, content: bytes = b"ID3 fake song", **form: Any):
    return client.post(
        "/api/v1/library/music",
        files={"file": ("Mi Canción.mp3", content, "audio/mpeg")},
        data=form,
    )


def _ffmpeg(tmp_path: Path, name: str, *args: str) -> bytes:
    out = tmp_path / name
    subprocess.run(["ffmpeg", "-y", "-v", "error", *args, str(out)], check=True)
    return out.read_bytes()


# ── Música ───────────────────────────────────────────────────────────────────

def test_upload_music_transcribes_in_background(client: TestClient, fake_transcriber, events):
    r = _upload_song(client, artist="Bruses", tags="pop, Pop, balada", language="es")
    assert r.status_code == 201
    body = r.json()
    asset_id = body["asset_id"]
    assert body["original_filename"] == "Mi Canción.mp3"
    assert body["track_name"] == "Mi Canción"
    assert body["tags"] == "pop, balada"
    assert body["tag_list"] == ["pop", "balada"]
    assert body["file_url"] == f"/api/v1/library/music/{asset_id}/file"
    assert body["transcription_status"] in ("pending", "running", "done")

    done = _wait_status(client, asset_id, "done")
    assert done["has_lyrics_cache"] is True
    assert done["lyrics_url"] == f"/api/v1/library/music/{asset_id}/lyrics"
    assert len(fake_transcriber.calls) == 1
    assert fake_transcriber.calls[0][1] == "es"

    lyrics = client.get(done["lyrics_url"])
    assert lyrics.status_code == 200
    assert lyrics.json() == LYRICS

    # El archivo se sirve tal cual se subió.
    assert client.get(done["file_url"]).content == b"ID3 fake song"

    statuses = [e.data["transcription_status"] for e in events if e.data["asset_id"] == asset_id]
    assert statuses[0] == "none"  # action=created
    assert statuses[-1] == "done"
    assert all(e.type == "library_asset_changed" and e.data["kind"] == "music" for e in events)


def test_upload_same_song_twice_returns_existing(client: TestClient, fake_transcriber):
    first = _upload_song(client)
    _wait_status(client, first.json()["asset_id"], "done")

    second = client.post(
        "/api/v1/library/music",
        files={"file": ("otro-nombre.mp3", b"ID3 fake song", "audio/mpeg")},
    )
    assert second.status_code == 200
    assert second.json()["asset_id"] == first.json()["asset_id"]
    assert len(asset_library.list_music()) == 1
    assert len(fake_transcriber.calls) == 1


def test_upload_music_without_transcription(client: TestClient, fake_transcriber):
    r = _upload_song(client, transcribe="false")
    assert r.status_code == 201
    assert r.json()["transcription_status"] == "none"
    assert fake_transcriber.calls == []
    assert client.get(f"/api/v1/library/music/{r.json()['asset_id']}/lyrics").status_code == 404


def test_retranscribe_sets_language_and_requeues(client: TestClient, fake_transcriber):
    asset_id = _upload_song(client).json()["asset_id"]
    _wait_status(client, asset_id, "done")

    r = client.post(f"/api/v1/library/music/{asset_id}/transcribe", json={"language": "en"})
    assert r.status_code == 202
    assert r.json()["language"] == "en"
    # La letra anterior sigue disponible mientras se re-transcribe.
    assert r.json()["lyrics_url"] is not None
    _wait_status(client, asset_id, "done")
    assert len(fake_transcriber.calls) == 2
    assert fake_transcriber.calls[-1][1] == "en"

    assert client.post("/api/v1/library/music/nope/transcribe").status_code == 404


def test_rejects_wrong_media_type(client: TestClient):
    r = client.post(
        "/api/v1/library/music",
        files={"file": ("notas.txt", b"hola", "text/plain")},
    )
    assert r.status_code == 415
    assert asset_library.list_music() == []


# ── Búsqueda, edición y borrado ──────────────────────────────────────────────

def test_search_is_case_and_accent_insensitive(client: TestClient):
    a = _upload_song(client, b"song a", track_name="Corazón Roto", artist="Ana", transcribe="false")
    _upload_song(client, b"song b", track_name="Night Drive", description="synthwave", transcribe="false")
    assert a.status_code == 201

    def names(q: str) -> list[str]:
        return [m["track_name"] for m in client.get("/api/v1/library/music", params={"q": q}).json()]

    assert names("corazon") == ["Corazón Roto"]
    assert names("ANA roto") == ["Corazón Roto"]
    assert names("SYNTH") == ["Night Drive"]
    # El nombre de archivo original también entra en la búsqueda (ambos se
    # subieron como "Mi Canción.mp3").
    assert sorted(names("mi cancion")) == ["Corazón Roto", "Night Drive"]
    assert len(client.get("/api/v1/library/music").json()) == 2
    assert client.get("/api/v1/library/music", params={"category": "otra"}).json() == []


def test_patch_updates_editable_fields_only(client: TestClient, events):
    asset_id = _upload_song(client, transcribe="false").json()["asset_id"]

    r = client.patch(
        f"/api/v1/library/music/{asset_id}",
        json={"track_name": "Nuevo nombre", "artist": "Yo", "tags": ["rock", " indie "], "description": "demo"},
    )
    assert r.status_code == 200
    body = r.json()
    assert (body["track_name"], body["artist"], body["tags"], body["description"]) == (
        "Nuevo nombre", "Yo", "rock, indie", "demo",
    )
    assert any(e.data["action"] == "updated" for e in events)
    assert client.patch("/api/v1/library/music/nope", json={"artist": "x"}).status_code == 404
    assert client.patch(f"/api/v1/library/cosas/{asset_id}", json={}).status_code == 422


def test_patch_category_moves_the_file(client: TestClient):
    asset_id = _upload_song(client, transcribe="false").json()["asset_id"]
    r = client.patch(f"/api/v1/library/music/{asset_id}", json={"category": "favoritas"})
    assert r.status_code == 200
    entry = asset_library.get_music_entry(asset_id)
    assert entry.category == "favoritas"
    assert entry.relative_path.startswith("favoritas/")
    assert client.get(f"/api/v1/library/music/{asset_id}/file").content == b"ID3 fake song"


def test_delete_removes_file_record_and_lyrics(client: TestClient, events):
    asset_id = _upload_song(client).json()["asset_id"]
    _wait_status(client, asset_id, "done")
    path = asset_library.resolve_music_path(asset_id)
    assert path.exists()

    r = client.delete(f"/api/v1/library/music/{asset_id}")
    assert r.status_code == 200
    assert r.json() == {"kind": "music", "asset_id": asset_id, "deleted": True}
    assert not path.exists()
    assert asset_library.get_lyrics_cache(asset_id) is None
    assert client.get(f"/api/v1/library/music/{asset_id}").status_code == 404
    assert client.delete(f"/api/v1/library/music/{asset_id}").status_code == 404
    assert events[-1].data == {
        "kind": "music", "asset_id": asset_id, "action": "deleted", "transcription_status": None,
    }


# ── Imágenes y videos ────────────────────────────────────────────────────────

@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg/ffprobe no instalados")
def test_upload_image_reads_dimensions(client: TestClient, tmp_path: Path):
    png = _ffmpeg(tmp_path, "x.png", "-f", "lavfi", "-i", "color=c=red:s=64x32", "-frames:v", "1")
    r = client.post(
        "/api/v1/library/images",
        files={"file": ("Atardecer en la playa.png", png, "image/png")},
        data={"tags": "playa, sol", "description": "cielo naranja"},
    )
    assert r.status_code == 201
    body = r.json()
    assert (body["width"], body["height"], body["orientation"]) == (64, 32, "landscape")
    assert body["label"] == "Atardecer en la playa"
    assert body["category"] == "uploads"
    assert client.get(body["file_url"]).content == png
    found = client.get("/api/v1/library/images", params={"q": "naranja"}).json()
    assert [i["asset_id"] for i in found] == [body["asset_id"]]
    assert client.get("/api/v1/library/categories", params={"kind": "images"}).json() == ["uploads"]


@pytest.mark.skipif(not HAS_FFMPEG, reason="ffmpeg/ffprobe no instalados")
def test_upload_video_reads_duration_and_size(client: TestClient, tmp_path: Path):
    mp4 = _ffmpeg(
        tmp_path, "x.mp4",
        "-f", "lavfi", "-i", "color=c=blue:s=32x64:d=1", "-c:v", "libx264", "-pix_fmt", "yuv420p",
    )
    r = client.post(
        "/api/v1/library/videos",
        files={"file": ("fondo.mp4", mp4, "video/mp4")},
        data={"label": "Fondo azul"},
    )
    assert r.status_code == 201
    body = r.json()
    assert (body["width"], body["height"]) == (32, 64)
    assert body["duration_seconds"] == pytest.approx(1.0, abs=0.1)
    assert body["label"] == "Fondo azul"

    assert client.delete(f"/api/v1/library/videos/{body['asset_id']}").status_code == 200
    assert client.get("/api/v1/library/videos").json() == []


def test_existing_list_endpoints_still_work(client: TestClient):
    for kind in ("images", "music", "videos"):
        assert client.get(f"/api/v1/library/{kind}").json() == []
    assert client.get("/api/v1/library/categories", params={"kind": "nope"}).status_code == 400
    assert client.get("/api/v1/library/configs").json() == []
    assert client.get("/api/v1/library/images/nope").status_code == 404

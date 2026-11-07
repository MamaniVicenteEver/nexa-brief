"""Efectos separados de música: dedupe, aprobación y archivos reutilizables."""
import io
import wave
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.core.library import sound_library
from src.presentation.api.routers import library as library_router


def wav_bytes(sample_count=1600):
    data = io.BytesIO()
    with wave.open(data, "wb") as stream:
        stream.setnchannels(1)
        stream.setsampwidth(2)
        stream.setframerate(8000)
        stream.writeframes(b"\x00\x00" * sample_count)
    return data.getvalue()


@pytest.fixture
def sound_client(monkeypatch):
    def forbidden():
        raise AssertionError("Un efecto no debe iniciar transcripción")
    monkeypatch.setattr(library_router, "get_lyrics_transcriber", forbidden)
    app = FastAPI()
    app.include_router(library_router.router, prefix="/api/v1")
    with TestClient(app) as client:
        yield client


def test_sound_upload_search_patch_and_range(sound_client):
    content = wav_bytes()
    created = sound_client.post("/api/v1/library/sounds", files={"file": ("motor.wav", content, "audio/wav")}, data={"title": "Motor de avión", "description": "Hélice lejana", "tags": "avión, Avión, motor"})
    assert created.status_code == 201
    body = created.json()
    assert body["duration_seconds"] == pytest.approx(.2)
    assert body["approval_status"] == "pending"
    assert body["original_filename"] == "motor.wav"
    assert "transcription_status" not in body
    duplicate = sound_client.post("/api/v1/library/sounds", files={"file": ("otro.wav", content, "audio/wav")})
    assert duplicate.status_code == 200
    assert duplicate.json()["asset_id"] == body["asset_id"]
    patch = sound_client.patch(f'/api/v1/library/sounds/{body["asset_id"]}', json={"approval_status": "approved", "recommended_uses": ["Archivos de aviación"], "description": "Motor de hélice para ambiente"})
    assert patch.status_code == 200
    assert patch.json()["title"] == "Motor de avión"
    assert patch.json()["recommended_uses"] == ["Archivos de aviación"]
    found = sound_client.get("/api/v1/library/sounds?q=aviacion").json()
    assert len(found) == 1
    assert sound_client.get(body["file_url"]).content == content
    partial = sound_client.get(body["file_url"], headers={"Range": "bytes=0-15"})
    assert partial.status_code == 206
    assert partial.content == content[:16]
    assert sound_client.get("/api/v1/library/categories?kind=sounds").json() == ["sound_effects"]


@pytest.mark.asyncio
async def test_reuse_requires_approval_and_counts_usage(tmp_path: Path):
    source = tmp_path / "steps.wav"
    source.write_bytes(wav_bytes())
    entry = await sound_library.register_sound(source, title="Pasos", recommended_uses=["Tropas"], provider="sfxmint", provider_sound_id="steps")
    assert sound_library.search_sounds("tropas", approved_only=True) == []
    from src.core.library.asset_library import update_asset_metadata
    await update_asset_metadata("sound", entry.asset_id, {"approval_status": "approved"})
    reused = await sound_library.register_sound(source, title="Otro título", provider="other", provider_sound_id="duplicate")
    assert reused.asset_id == entry.asset_id
    assert sound_library.search_sounds("tropas", approved_only=True)[0].asset_id == entry.asset_id
    used = await sound_library.mark_sound_used(entry.asset_id)
    assert used.usage_count == 1
    assert used.last_used_at
    assert sound_library.resolve_sound_path(entry.asset_id).read_bytes() == wav_bytes()


def test_invalid_sound_does_not_register(sound_client):
    result = sound_client.post("/api/v1/library/sounds", files={"file": ("fake.wav", b"not audio", "audio/wav")})
    assert result.status_code == 422
    assert sound_client.get("/api/v1/library/sounds").json() == []


@pytest.mark.asyncio
async def test_same_filename_different_content_keeps_both(tmp_path: Path):
    first = tmp_path / "first" / "motor.wav"
    second = tmp_path / "second" / "motor.wav"
    first.parent.mkdir()
    second.parent.mkdir()
    first.write_bytes(wav_bytes(1600))
    second.write_bytes(wav_bytes(2400))
    a = await sound_library.register_sound(first, title="Motor corto")
    b = await sound_library.register_sound(second, title="Motor largo")
    assert a.asset_id != b.asset_id
    assert a.relative_path != b.relative_path
    assert a.original_filename == b.original_filename == "motor.wav"
    assert sound_library.resolve_sound_path(a.asset_id).read_bytes() == wav_bytes(1600)
    assert sound_library.resolve_sound_path(b.asset_id).read_bytes() == wav_bytes(2400)

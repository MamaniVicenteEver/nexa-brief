"""Licencias del catálogo y codificación real del Reel."""

from __future__ import annotations

import asyncio
import hashlib
import json
import math
import struct
import subprocess
import wave
from io import BytesIO

import pytest
from PIL import Image

from src.adapters.data.licensed_reel_music import LicensedReelMusic
from src.adapters.data.reel_encoder import FfmpegReelEncoder
from src.core.image_posts.models import MusicOption
from src.core.image_posts.render import ReelFrame


def test_catalog_rejects_unverified_and_changed_audio(tmp_path):
    root = tmp_path / "media-cache" / "reel_music"
    root.mkdir(parents=True)
    audio = b"ID3" + b"test audio" * 100
    (root / "track.mp3").write_bytes(audio)
    license_data = {
        "spdx_or_name": "CC0-1.0", "url": "https://creativecommons.org/publicdomain/zero/1.0/",
        "author": "Autor", "track_url": "https://example.org/track",
        "attribution": "Autor — Obra", "proof_ref": "https://example.org/track",
    }
    row = {
        "music_asset_id": "verified", "file": "track.mp3",
        "source_sha256": hashlib.sha256(audio).hexdigest(), "license": license_data,
        "commercial_sync": True, "instrumental": True,
    }
    (root / "catalog.json").write_text(json.dumps({"schema_version": 1, "tracks": [row]}))
    catalog = LicensedReelMusic(tmp_path)
    option = MusicOption(mode="convert_to_reel", music_asset_id="verified",
                         source_sha256=row["source_sha256"], license=license_data)
    assert catalog.resolve(option).path == root / "track.mp3"
    assert [track["music_asset_id"] for track in catalog.list()] == ["verified"]
    unsafe = {**row, "music_asset_id": "unsafe", "license": {
        **license_data, "spdx_or_name": "CC BY NC 4.0",
    }}
    (root / "catalog.json").write_text(json.dumps({"schema_version": 1, "tracks": [row, unsafe]}))
    assert [track["music_asset_id"] for track in catalog.list()] == ["verified"]
    with pytest.raises(ValueError, match="catálogo"):
        catalog.resolve(option.model_copy(update={"music_asset_id": "unsafe"}))
    with pytest.raises(ValueError, match="catálogo"):
        catalog.resolve(option.model_copy(update={"music_asset_id": "unknown"}))
    with pytest.raises(ValueError, match="licencia o el hash"):
        catalog.resolve(option.model_copy(update={"source_sha256": "0" * 64}))
    (root / "track.mp3").write_bytes(audio + b"changed")
    with pytest.raises(ValueError, match="cambió"):
        catalog.resolve(option)


@pytest.mark.asyncio
async def test_ffmpeg_encodes_vertical_h264_aac_with_audio(tmp_path):
    audio = tmp_path / "tone.wav"
    with wave.open(str(audio), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(48000)
        samples = (int(7000 * math.sin(2 * math.pi * 440 * index / 48000)) for index in range(48000))
        output.writeframes(b"".join(struct.pack("<h", value) for value in samples))
    image = BytesIO()
    Image.new("RGB", (1080, 1920), "#244466").save(image, format="PNG")
    content = image.getvalue()

    async def frames():
        for index in range(240):
            yield ReelFrame(index, 0, index / 30, hashlib.sha256(content).hexdigest(),
                            1080, 1920, "image/png", content)

    encoded = await asyncio.wait_for(FfmpegReelEncoder().encode(frames(), audio, duration=8), timeout=120)
    movie = tmp_path / "movie.mp4"
    movie.write_bytes(encoded)
    probe = subprocess.run(
        ["ffprobe", "-v", "error", "-show_streams", "-show_format", "-of", "json", str(movie)],
        capture_output=True, text=True, check=True,
    )
    details = json.loads(probe.stdout)
    streams = {item["codec_type"]: item for item in details["streams"]}
    assert streams["video"]["codec_name"] == "h264"
    assert (streams["video"]["width"], streams["video"]["height"]) == (1080, 1920)
    assert streams["audio"]["codec_name"] == "aac"
    assert 7.9 <= float(details["format"]["duration"]) <= 8.1

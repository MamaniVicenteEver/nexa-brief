import asyncio
import hashlib
import shutil
import subprocess
import wave
from pathlib import Path
from types import SimpleNamespace

import httpx
import numpy as np
import pytest
from pydantic import ValidationError

from src.adapters.sound_effects.ffmpeg_mixer import FFmpegSoundMixer
from src.adapters.sound_effects.sfxmint import SFXMintAdapter
from src.core.ports.sound_effects_port import (
    AudioFacts,
    CuratedSoundMetadata,
    ResolvedSoundCue,
    SoundCandidate,
    SoundDesignError,
)
from src.core.sound_design.models import SoundCue, SoundMixPlan
from src.core.sound_design.service import SoundDesignService


def candidate(**updates):
    data = dict(
        provider="sfxmint",
        provider_sound_id="tank-engine",
        title="Engine",
        description="Tracks",
        duration_seconds=2,
        tags=("engine",),
        source_url="https://sfxmint.com/sounds/tank-engine",
        download_url="https://sfxmint.com/dl/tank-engine.wav",
        license_note="CC0",
        license_url="https://creativecommons.org/publicdomain/zero/1.0/",
    )
    return SoundCandidate(**(data | updates))


class Library:
    def __init__(self):
        self.entries = []
        self.used = []

    def search(self, q):
        return [e for e in self.entries if e.approval_status == "approved"]

    def find_by_provider(self, p, i):
        return next((e for e in self.entries if e.provider == p and e.provider_sound_id == i), None)

    def get(self, i):
        return next(e for e in self.entries if e.asset_id == i)

    def path(self, i):
        return Path("effect.wav")

    async def register(self, path, c, m):
        e = SimpleNamespace(
            asset_id="sound-1",
            provider=c.provider,
            provider_sound_id=c.provider_sound_id,
            approval_status="pending",
            duration_seconds=2,
        )
        self.entries.append(e)
        return e

    async def mark_used(self, i):
        self.used.append(i)


class Provider:
    name = "sfxmint"

    def __init__(self):
        self.gets = 0
        self.downloads = 0
        self.searches = 0

    async def search(self, *args, **kwargs):
        self.searches += 1
        return [candidate()]

    async def get(self, i):
        self.gets += 1
        await asyncio.sleep(0)
        return candidate()

    async def download(self, c, p):
        self.downloads += 1
        p.write_bytes(b"audio")


class Curator:
    def __init__(self, fail=False):
        self.calls = 0
        self.fail = fail

    async def curate(self, c, **kwargs):
        self.calls += 1
        if self.fail:
            raise RuntimeError("agent_unavailable")
        return CuratedSoundMetadata(title="Motor", description="Orugas", recommended_uses=["Vehículos"])


class Mixer:
    def __init__(self):
        self.calls = 0

    async def inspect(self, p):
        return AudioFacts(10 if p.name == "voice.wav" else 2, "hash", 48000, 2)

    async def mix(self, *args, **kwargs):
        self.calls += 1


@pytest.mark.asyncio
async def test_local_reuse_never_calls_provider_or_agent():
    lib, p, c, m = Library(), Provider(), Curator(), Mixer()
    lib.entries.append(SimpleNamespace(asset_id="s", approval_status="approved", duration_seconds=2))
    result = await SoundDesignService(lib, p, c, m).search("motor")
    assert result["source"] == "library"
    assert p.searches == c.calls == 0


@pytest.mark.asyncio
async def test_concurrent_import_curates_only_one_new_pending_record():
    lib, p, c, m = Library(), Provider(), Curator(), Mixer()
    service = SoundDesignService(lib, p, c, m)
    results = await asyncio.gather(service.import_sound("tank-engine"), service.import_sound("tank-engine"))
    assert p.gets == p.downloads == c.calls == len(lib.entries) == 1
    assert [r[1] for r in results] == [False, True]
    assert lib.entries[0].approval_status == "pending"


@pytest.mark.asyncio
async def test_curator_failure_never_creates_a_library_record():
    lib = Library()
    with pytest.raises(RuntimeError, match="agent_unavailable"):
        await SoundDesignService(lib, Provider(), Curator(True), Mixer()).import_sound("tank-engine")
    assert lib.entries == []


@pytest.mark.asyncio
async def test_unapproved_and_out_of_range_cues_do_not_mix(tmp_path):
    lib, m = Library(), Mixer()
    entry = SimpleNamespace(asset_id="s", approval_status="pending")
    lib.entries.append(entry)
    service = SoundDesignService(lib, Provider(), Curator(), m)
    cue = dict(asset_id="s", start=1, duration=1)
    with pytest.raises(SoundDesignError, match="aprobación"):
        await service.mix(Path("voice.wav"), SoundMixPlan(cues=[cue]), tmp_path / "mix.wav")
    entry.approval_status = "approved"
    with pytest.raises(SoundDesignError, match="narración"):
        await service.mix(Path("voice.wav"), SoundMixPlan(cues=[cue | {"start": 9.5}]), tmp_path / "mix.wav")
    with pytest.raises(SoundDesignError, match="sonido"):
        await service.mix(Path("voice.wav"), SoundMixPlan(cues=[cue | {"source_in": 1.5}]), tmp_path / "mix.wav")
    assert m.calls == 0 and lib.used == []


def test_cues_reject_nonfinite_and_invalid_fades():
    for change in [{"start": float("nan")}, {"duration": float("inf")}, {"fade_in": 1, "fade_out": 1}]:
        with pytest.raises(ValidationError):
            SoundCue(**(dict(asset_id="s", start=0, duration=1) | change))


@pytest.mark.asyncio
async def test_sfxmint_ignores_near_matches_and_blocks_foreign_downloads(tmp_path):
    async def handler(request):
        return httpx.Response(200, json={"candidates": [], "near_matches": [{"slug": "wrong"}]})

    adapter = SFXMintAdapter(transport=httpx.MockTransport(handler))
    assert await adapter.search("tank") == []
    with pytest.raises(SoundDesignError, match="Origen"):
        await adapter.download(candidate(download_url="http://127.0.0.1/private"), tmp_path / "x.wav")
    with pytest.raises(SoundDesignError, match="Identificador"):
        await adapter.get("../../accounts")


@pytest.mark.asyncio
async def test_sfxmint_surfaces_quota_and_does_not_leave_partial_file(tmp_path):
    adapter = SFXMintAdapter(
        transport=httpx.MockTransport(lambda r: httpx.Response(429, json={"error": "download_limit"}))
    )
    with pytest.raises(httpx.HTTPStatusError):
        await adapter.download(candidate(), tmp_path / "x.wav")
    assert not (tmp_path / "x.wav").exists()


def write_audio(path, seconds, freq, amplitude):
    sr = 48000
    t = np.arange(round(sr * seconds)) / sr
    samples = (np.sin(2 * np.pi * freq * t) * amplitude * 32767).astype("<i2")
    with wave.open(str(path), "wb") as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(sr)
        f.writeframes(samples.tobytes())


def decode(path):
    return np.frombuffer(
        subprocess.check_output(
            ["ffmpeg", "-v", "error", "-i", str(path), "-ar", "48000", "-ac", "2", "-f", "f32le", "-"]
        ),
        dtype="<f4",
    ).reshape(-1, 2)


@pytest.mark.asyncio
@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no disponible")
async def test_limiter_preserves_effect_at_start_and_end(tmp_path):
    voice, fx, dest = tmp_path / "voice.wav", tmp_path / "fx.wav", tmp_path / "mix.wav"
    write_audio(voice, 1, 300, 0.1)
    write_audio(fx, 1, 70, 0.1)
    cue = ResolvedSoundCue("s", fx, 0, 0, 1, 0, 0.01, 0.01)
    await FFmpegSoundMixer().mix(voice, [cue], dest, ducking=False)
    source, stem = decode(fx), decode(tmp_path / "mix-effects.wav")
    assert source.shape == stem.shape
    assert np.max(np.abs(source[480:-480] - stem[480:-480])) < 0.00001
    assert np.max(np.abs(stem[1:480])) > 0.01
    assert np.max(np.abs(stem[-480:])) > 0.01


@pytest.mark.asyncio
@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no disponible")
async def test_mixer_preserves_continuous_voice_and_exports_identical_fx_layer(tmp_path):
    voice, fx, dest = tmp_path / "voice.wav", tmp_path / "fx.wav", tmp_path / "mix.wav"
    write_audio(voice, 3, 300, 0.5)
    write_audio(fx, 1, 70, 0.3)
    original_hash = hashlib.sha256(voice.read_bytes()).hexdigest()
    mixer = FFmpegSoundMixer()
    cue = ResolvedSoundCue("s", fx, 1, 0, 1, -14, 0.1, 0.1)
    await mixer.mix(voice, [cue], dest, ducking=True)
    original, mixed, stem = decode(voice), decode(dest), decode(tmp_path / "mix-effects.wav")
    assert original.shape == mixed.shape == stem.shape
    assert float(np.sqrt(np.mean(stem[53000:90000] ** 2))) > 0.00001
    assert np.max(np.abs(mixed - original - stem)) < 0.000001
    assert np.max(np.abs(mixed[:47000] - original[:47000])) < 0.000001
    assert np.max(np.abs(mixed)) < 1
    assert hashlib.sha256(voice.read_bytes()).hexdigest() == original_hash
    assert (await mixer.inspect(dest)).duration_seconds == 3


@pytest.mark.asyncio
async def test_mixer_cannot_overwrite_voice_via_effects_sidecar(tmp_path):
    service = SoundDesignService(Library(), Provider(), Curator(), Mixer())
    with pytest.raises(SoundDesignError, match="narración"):
        await service.mix(tmp_path / "mix-effects.wav", SoundMixPlan(), tmp_path / "mix.wav")


@pytest.mark.asyncio
@pytest.mark.skipif(not shutil.which("ffmpeg"), reason="ffmpeg no disponible")
async def test_late_cues_remain_audible_at_exact_times_in_two_minute_voice(tmp_path):
    voice, fx, dest = tmp_path / "voice.wav", tmp_path / "fx.wav", tmp_path / "mix.wav"
    write_audio(voice, 120.12, 300, 0.5)
    write_audio(fx, 7.2, 70, 0.3)
    cues = [
        ResolvedSoundCue("a", fx, 52.17, 0, 6.8, -18, 0.25, 0.5),
        ResolvedSoundCue("b", fx, 61.27, 0, 5.3, -18, 0.25, 0.5),
        ResolvedSoundCue("c", fx, 92.37, 0, 5.1, -18, 0.25, 0.5),
    ]
    await FFmpegSoundMixer().mix(voice, cues, dest, ducking=True)
    original, mixed, stem = decode(voice), decode(dest), decode(tmp_path / "mix-effects.wav")
    assert original.shape == mixed.shape == stem.shape
    for cue in cues:
        window = stem[round((cue.start + 0.3) * 48000) : round((cue.start + cue.duration - 0.6) * 48000)]
        assert float(np.sqrt(np.mean(window**2))) > 0.00001
        start = round(cue.start * 48000)
        assert float(np.abs(stem[start - 4800 : start - 10]).max()) < 0.000001
    assert float(np.abs(stem[: round(50 * 48000)]).max()) < 0.000001
    assert float(np.abs(mixed - original - stem).max()) < 0.000001
    assert (await FFmpegSoundMixer().inspect(dest)).duration_seconds == 120.12

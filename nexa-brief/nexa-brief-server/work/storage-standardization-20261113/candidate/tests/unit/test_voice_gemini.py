"""Adaptador de voz Gemini: rotación de claves y cadena de modelos (sin red real)."""

from __future__ import annotations

import base64
import json
import wave
from pathlib import Path

import httpx
import pytest

from src.adapters.voice.infrastructure.gemini_key_pool import GeminiKey, KeyPool, load_keys
from src.adapters.voice.infrastructure.gemini_tts_adapter import GeminiTTSAdapter
from src.core.ports.voice_port import VoiceQuotaExhausted, VoiceSynthesisError

PCM = b"\x00\x01" * 24_000  # 1 s de audio


def _ok() -> httpx.Response:
    data = base64.b64encode(PCM).decode()
    return httpx.Response(200, json={"candidates": [{"content": {"parts": [{"inlineData": {"data": data}}]}}]})


def _daily() -> httpx.Response:
    return httpx.Response(429, text='{"error": "Quota exceeded ... GenerateRequestsPerDayPerProjectPerModel per day"}')


class _Script:
    """Transport que responde según (modelo, clave) y registra los pedidos."""

    def __init__(self, answers: dict[tuple[str, str], httpx.Response]) -> None:
        self.answers = answers
        self.calls: list[tuple[str, str]] = []

    def __call__(self, request: httpx.Request) -> httpx.Response:
        model = request.url.path.split("/models/")[1].split(":")[0]
        key = request.headers["x-goog-api-key"]
        self.calls.append((model, key))
        return self.answers.get((model, key), httpx.Response(500, text="no configurado"))


def _keys(*values: str) -> list[GeminiKey]:
    return [GeminiKey(label=f"K{i}#x", value=v) for i, v in enumerate(values)]


def _adapter(tmp_path: Path, script: _Script, keys: list[GeminiKey], models=("m1", "m2")) -> GeminiTTSAdapter:
    pool = KeyPool(keys=keys, state_path=tmp_path / "quota.json")
    return GeminiTTSAdapter(pool=pool, models=list(models), transport=httpx.MockTransport(script))


async def test_first_key_works(tmp_path: Path):
    script = _Script({("m1", "a"): _ok()})
    result = await _adapter(tmp_path, script, _keys("a", "b")).synthesize("Hola", tmp_path / "out.mp3")
    assert result.path.suffix == ".wav" and result.model == "m1" and result.key_label == "K0#x"
    with wave.open(str(result.path)) as w:
        assert w.getframerate() == 24_000
    assert result.duration_seconds == pytest.approx(1.0)
    assert script.calls == [("m1", "a")]


async def test_daily_quota_marks_key_and_rotates(tmp_path: Path):
    script = _Script({("m1", "a"): _daily(), ("m1", "b"): _ok()})
    adapter = _adapter(tmp_path, script, _keys("a", "b"))
    result = await adapter.synthesize("Hola", tmp_path / "out")
    assert result.key_label == "K1#x"
    state = json.loads((tmp_path / "quota.json").read_text())
    assert "K0#x" in state["m1"]
    # la clave agotada ya no se vuelve a pedir para ese modelo
    script.calls.clear()
    await adapter.synthesize("Otra vez", tmp_path / "out2")
    assert script.calls == [("m1", "b")]


async def test_transient_error_tries_next_key_without_marking(tmp_path: Path):
    script = _Script({("m1", "a"): httpx.Response(503, text="overloaded"), ("m1", "b"): _ok()})
    adapter = _adapter(tmp_path, script, _keys("a", "b"))
    result = await adapter.synthesize("Hola", tmp_path / "out")
    assert result.key_label == "K1#x"
    assert not (tmp_path / "quota.json").exists()


async def test_falls_back_to_next_model_when_all_keys_exhausted(tmp_path: Path):
    script = _Script({("m1", "a"): _daily(), ("m1", "b"): _daily(), ("m2", "a"): _ok()})
    result = await _adapter(tmp_path, script, _keys("a", "b")).synthesize("Hola", tmp_path / "out")
    assert result.model == "m2"


async def test_everything_exhausted_raises_quota(tmp_path: Path):
    script = _Script({(m, k): _daily() for m in ("m1", "m2") for k in ("a", "b")})
    with pytest.raises(VoiceQuotaExhausted):
        await _adapter(tmp_path, script, _keys("a", "b")).synthesize("Hola", tmp_path / "out")


async def test_hard_errors_raise_synthesis_error(tmp_path: Path):
    script = _Script({})  # todo 500
    with pytest.raises(VoiceSynthesisError):
        await _adapter(tmp_path, script, _keys("a")).synthesize("Hola", tmp_path / "out")


async def test_probe_reports_each_key(tmp_path: Path):
    script = _Script({("m1", "a"): _ok(), ("m1", "b"): _daily()})
    probes = await _adapter(tmp_path, script, _keys("a", "b", "c")).probe_keys()
    assert [(p.label, p.ok) for p in probes] == [("K0#x", True), ("K1#x", False), ("K2#x", False)]
    assert probes[1].detail == "cuota diaria agotada"


def test_load_keys_orders_and_dedups(tmp_path: Path):
    env = tmp_path / ".env"
    env.write_text("GEMINI_API_KEY2=c\nGEMINI_API_KEY=a\nGEMINI_API_KEY1=b\nGEMINI_API_KEY10=a\nOTHER=x\n")
    keys = load_keys(env, environ={})
    assert [k.label.split("#")[0] for k in keys] == ["GEMINI_API_KEY", "GEMINI_API_KEY1", "GEMINI_API_KEY2"]
    assert all("a" != k.label for k in keys)  # la etiqueta nunca es la clave


def test_status_never_exposes_values(tmp_path: Path):
    pool = KeyPool(keys=_keys("secreto"), state_path=tmp_path / "q.json")
    assert "secreto" not in json.dumps(pool.status(["m1"]))


async def test_depleted_credits_402_marks_key(tmp_path: Path):
    script = _Script({("m1", "a"): httpx.Response(402, text='{"error": "prepayment credits are depleted"}'), ("m1", "b"): _ok()})
    adapter = _adapter(tmp_path, script, _keys("a", "b"))
    assert (await adapter.synthesize("Hola", tmp_path / "o")).key_label == "K1#x"
    assert "K0#x" in json.loads((tmp_path / "quota.json").read_text())["m1"]

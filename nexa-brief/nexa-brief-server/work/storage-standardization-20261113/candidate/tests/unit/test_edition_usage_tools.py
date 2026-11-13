"""No providers/audio: actual kit hooks with mocked HTTP and encoder calls."""
import importlib
import io
import json
from pathlib import Path
import sys
from types import SimpleNamespace
from urllib.error import HTTPError, URLError

import pytest

TOOLS = Path(__file__).parents[2] / "src/templates/_tools/explainer-kit/tools"


@pytest.fixture
def kit(tmp_path, monkeypatch):
    monkeypatch.syspath_prepend(str(TOOLS))
    modules = SimpleNamespace(**{name: importlib.import_module(name) for name in
                               ("edition_usage", "edition_context", "tts", "narrate", "outro")})
    monkeypatch.setattr(modules.narrate, "EDITION", None)
    monkeypatch.setattr(modules.narrate, "VIDEO_DIR", None)
    monkeypatch.setattr(modules.tts, "LAST_USAGE", {})
    monkeypatch.setattr(modules.tts.time, "sleep", lambda _: None)
    stage = tmp_path / "staging"
    stage.mkdir()
    production = tmp_path / "original"
    production.mkdir()
    monkeypatch.setenv("NEXA_PRODUCTION_DIR", str(production))
    value = {"schema": "nexa.edition/1", "locale": "pt-BR", "revision": "rev-002",
             "voice": {"voice": "Orus", "models": ["gemini-test-tts"]},
             "transcription": {"language": "pt"}, "outro_spoken": {"text": "Obrigado"}}
    (stage / "edition.json").write_text(json.dumps(value))
    (stage / "usage-context.json").write_text(json.dumps({"schema_version": 1, "locale": "pt-BR", "revision": "rev-002"}))
    ctx = modules.edition_context.EditionContext(stage / "edition.json")
    return modules, ctx, stage, production


def rows(stage):
    path = stage / "logs/usage.jsonl"
    return [json.loads(line) for line in path.read_text().splitlines()] if path.exists() else []


def response():
    return {"modelVersion": "gemini-actual-tts", "usageMetadata": {
        "promptTokenCount": 100, "cachedContentTokenCount": 25,
        "candidatesTokenCount": 30, "thoughtsTokenCount": 7, "totalTokenCount": 137}}


def install_http(monkeypatch, tts, outcomes):
    values = iter(outcomes)
    def call(*args, **kwargs):
        value = next(values)
        if isinstance(value, BaseException):
            raise value
        return io.StringIO(json.dumps(value))
    monkeypatch.setattr(tts.urllib.request, "urlopen", call)


def post(tts):
    return tts._post("https://example.invalid/tts", {}, {"x-goog-api-key": "never-log-this-key"})


def test_native_http_retries_are_distinct_and_cache_is_not_double_counted(kit, monkeypatch):
    m, ctx, stage, production = kit
    install_http(monkeypatch, m.tts, [URLError("network"), response()])
    with m.edition_usage.observe(ctx, m.tts, model="requested", role="voice", step="narration"):
        post(m.tts)
    actual = rows(stage)
    assert len(actual) == 2 and len({x["event_id"] for x in actual}) == 2
    failed, success = actual
    assert failed["ok"] is False and failed["input_tokens"] is None and failed["cost_usd"] is None
    assert success["model"] == "gemini-actual-tts" and success["input_tokens"] == 75
    assert success["cached_input_tokens"] == 25 and success["output_tokens"] == 30
    assert success["reasoning_tokens"] == 7 and success["total_tokens"] is None
    assert success["provider_usage"]["usage"]["promptTokenCount"] == 100
    assert success["locale"] == "pt-BR" and success["revision"] == "rev-002"
    assert list(production.iterdir()) == []
    assert "never-log-this-key" not in (stage / "logs/usage.jsonl").read_text()


def test_failed_audio_response_keeps_billable_usage(kit, monkeypatch):
    m, ctx, stage, _ = kit
    install_http(monkeypatch, m.tts, [response()])
    with pytest.raises(RuntimeError):
        with m.edition_usage.observe(ctx, m.tts, model="requested", role="voice", step="narration"):
            post(m.tts)
            raise RuntimeError("no audio: private response must not be copied")
    entry = rows(stage)[0]
    assert entry["ok"] is False and entry["error_type"] == "RuntimeError"
    assert entry["output_tokens"] == 30
    assert "private response" not in (stage / "logs/usage.jsonl").read_text()


def test_interactions_usage_and_unknown_fields_remain_honest(kit, monkeypatch):
    m, ctx, stage, _ = kit
    raw = {"id": "interaction-1", "usage": {"total_input_tokens": 50, "total_output_tokens": 8,
           "total_cached_tokens": 10, "audio": "BASE64-AUDIO", "api_key": "SECRET"}}
    install_http(monkeypatch, m.tts, [raw, {}])
    for _ in range(2):
        with m.edition_usage.observe(ctx, m.tts, model="requested", role="voice", step="outro"):
            post(m.tts)
    first, unknown = rows(stage)
    assert first["input_tokens"] == 40 and first["provider_result_id"] == "interaction-1"
    assert first["provider_usage"]["usage"]["total_input_tokens"] == 50
    assert unknown["input_tokens"] is None and unknown["output_tokens"] is None
    assert unknown["usage_known"] is False and unknown["cost_usd"] is None
    text = (stage / "logs/usage.jsonl").read_text()
    assert "BASE64-AUDIO" not in text and "SECRET" not in text


def test_context_mismatch_and_symlinks_fail_before_provider(kit):
    m, ctx, stage, production = kit
    marker = stage / "usage-context.json"
    marker.write_text(json.dumps({"schema_version": 1, "locale": "en-US", "revision": "rev-002"}))
    with pytest.raises(ValueError, match="context"):
        with m.edition_usage.observe(ctx, m.tts, model="requested", role="voice", step="narration"):
            pytest.fail("provider must not be called")
    marker.unlink()
    marker.write_text(json.dumps({"schema_version": 1, "locale": "pt-BR", "revision": "rev-002"}))
    (stage / "logs").symlink_to(production)
    with pytest.raises(ValueError, match="symlink"):
        m.edition_usage.record(ctx, model="requested", role="voice", step="narration", ok=True, seconds=1)
    assert list(production.iterdir()) == []


def test_narration_records_native_and_keeps_source_ledger_unchanged(kit, monkeypatch):
    m, ctx, stage, production = kit
    original_calls = []
    monkeypatch.setitem(sys.modules, "usage", SimpleNamespace(record=lambda *a, **kw: original_calls.append((a, kw))))
    monkeypatch.setattr(m.narrate, "VIDEO_DIR", production)
    monkeypatch.setattr(m.narrate, "EDITION", ctx)
    monkeypatch.setattr(m.tts, "with_key_rotation", lambda model, call: call("never-log-this-key"))
    monkeypatch.setattr(m.tts, "gemini_annotated", lambda *a, **kw: post(m.tts))
    install_http(monkeypatch, m.tts, [response(), response()])
    m.narrate.generate_group({}, [{"text": "Olá", "style": "natural"}], stage / "fake.wav", "Orus", "gemini-test-tts")
    assert len(rows(stage)) == 1 and original_calls == []
    monkeypatch.setattr(m.narrate, "EDITION", None)
    m.narrate.generate_group({}, [{"text": "Hola", "style": "natural"}], stage / "fake.wav", "Orus", "gemini-test-tts")
    assert len(rows(stage)) == 1 and len(original_calls) == 1
    assert original_calls[0][0] == (production,)


def test_outro_failed_model_and_success_have_actual_provenance(kit, monkeypatch):
    m, ctx, stage, _ = kit
    ctx.data["voice"]["models"] = ["failed-model", "success-model"]
    monkeypatch.setattr(m.tts, "with_key_rotation", lambda model, call: call("never-log-this-key"))
    monkeypatch.setattr(m.tts, "gemini_annotated", lambda *a, **kw: post(m.tts))
    monkeypatch.setattr(m.outro.subprocess, "run", lambda *a, **kw: None)
    failure = HTTPError("https://example.invalid/tts", 400, "bad", {}, io.BytesIO(b"private provider response"))
    install_http(monkeypatch, m.tts, [failure, response()])
    m.outro._synthesize(ctx, {"text": "Obrigado"}, stage / "fake.mp3")
    failed, success = rows(stage)
    assert failed["model"] == "failed-model" and failed["ok"] is False
    assert success["model"] == "gemini-actual-tts" and success["ok"] is True
    assert all(entry["step"] == "outro" for entry in rows(stage))
    assert "private provider response" not in (stage / "logs/usage.jsonl").read_text()


def test_cached_outro_records_no_new_call(kit, monkeypatch):
    m, ctx, stage, _ = kit
    dest = stage / "cached.mp3"
    dest.write_bytes(b"FAKE CACHED FILE")
    dest.with_suffix(".json").write_text("{}")
    monkeypatch.setattr(m.outro, "KIT", stage)
    monkeypatch.setattr(ctx, "outro_audio", lambda: dest)
    monkeypatch.setattr(m.outro, "_synthesize", lambda *a: pytest.fail("cache must not call TTS"))
    assert m.outro.make_voice(ctx) == dest and rows(stage) == []


def test_observer_restores_previous_context_after_failure(kit):
    m, ctx, _, _ = kit
    seen = []
    with m.tts.observe_usage(seen.append):
        with pytest.raises(RuntimeError):
            with m.edition_usage.observe(ctx, m.tts, model="m", role="voice", step="outro"):
                raise RuntimeError("no network call")
        m.tts._notify_usage(0, ok=True, data={})
    assert len(seen) == 1 and m.tts._USAGE_OBSERVER.get() is None


def test_missing_context_never_falls_back_to_original_ledger(kit):
    m, ctx, stage, production = kit
    (stage / "usage-context.json").unlink()
    with pytest.raises(ValueError, match="context"):
        with m.edition_usage.observe(ctx, m.tts, model="m", role="voice", step="narration"):
            pytest.fail("missing context must block before provider")
    assert rows(stage) == [] and list(production.iterdir()) == []


def test_legacy_context_explicitly_allows_only_new_attributable_calls(kit):
    m, ctx, stage, _ = kit
    marker = stage / "usage-context.json"
    value = json.loads(marker.read_text())
    marker.write_text(json.dumps({**value, "historical_usage_unattributed": True}))
    row = m.edition_usage.record(ctx, model="m", role="voice", step="narration", ok=False, seconds=2)
    assert row["locale"] == "pt-BR" and row["cost_usd"] is None

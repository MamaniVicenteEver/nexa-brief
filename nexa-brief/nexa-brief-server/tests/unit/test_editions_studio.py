from types import SimpleNamespace
import json
import uuid

import pytest

from src.core.explainer.editions.io import write
from src.core.explainer.editions.packaging import approve
from src.core.explainer.editions.studio import editorial_usage, studio_summary


def test_summary_uses_only_the_selected_revision(tmp_path, monkeypatch):
    monkeypatch.setattr("src.core.explainer.editions.studio.content_key", lambda path: "productions/nodetech/demo")
    video = SimpleNamespace(path=tmp_path / "production")
    folder = tmp_path / "rev-005"
    write(folder / "review.json", {"needs_review": True})
    write(folder / "config.json", {"locale": "en-US"})
    write(folder / "edition.json", {"locale": "en-US", "identity_status": "draft"})
    write(folder / "storyboard.json", {"beats": [{"t": 0, "use": "common.tabloid", "params": {
        "text": "YOUR CHATS", "src": "/productions/nodetech/demo/assets/photo.jpg"}}]})
    write(folder / "lyrics.json", {"metadata": {"duration": 661}})
    write(folder / "script.json", {})
    write(folder / "publish.json", {"youtube": {"title": "Native title"}})
    (folder / "song-with-outro.mp3").write_bytes(b"native audio")
    result = studio_summary(video, folder, stale=True)
    assert result["opening"]["text"] == "YOUR CHATS"
    assert "edition=en-US" in result["opening"]["preview_url"] and "rev-005" in result["opening"]["preview_url"]
    assert result["opening"]["image_url"].startswith("/api/v1/explainer/files/productions/")
    assert result["duration_seconds"] == 661 and {i["field"] for i in result["issues"]} == {"source", "review", "thumbnails"}
    assert result["capabilities"] == {"record": False, "publish": False}
    assert studio_summary(video, None) is None


def test_approved_revision_has_no_editorial_warning(tmp_path, monkeypatch):
    monkeypatch.setattr("src.core.explainer.editions.studio.content_key", lambda path: "productions/nodetech/demo")
    for name, value in {"review": {"needs_review": False, "editorial_approval": "approved"},
                        "edition": {"locale": "pt-BR", "identity_status": "approved"},
                        "config": {}, "storyboard": {"beats": []}, "lyrics": {}}.items():
        write(tmp_path / f"{name}.json", value)
    write(tmp_path / "script.json", {})
    write(tmp_path / "publish.json", {"youtube": {"title": "Native title"}})
    (tmp_path / "song-with-outro.mp3").write_bytes(b"native audio")
    monkeypatch.setattr("src.core.explainer.editions.packaging.load_native", lambda folder: object())
    approve(tmp_path, note="User reviewed this audio")
    result = studio_summary(SimpleNamespace(path=tmp_path), tmp_path)
    assert result["issues"] == [] and result["opening"] is None
    assert result["capabilities"] == {"record": True, "publish": True}


def test_usage_counts_failed_attempts_without_inventing_a_combined_token_total(tmp_path):
    stage = tmp_path / "attempt"
    write(stage / "agent/initial.usage.json", {"provider": "codex", "model": "model", "input_tokens": 100,
        "cached_input_tokens": 50, "output_tokens": 30, "reasoning_tokens": 20, "ok": False, "seconds": 2})
    write(stage / "agent/repair.usage.json", {"provider": "codex", "model": "model", "input_tokens": 10,
        "output_tokens": 5, "ok": True, "cost_usd": .1})
    result = editorial_usage([stage])
    row = result["totals_by_model"][0]
    assert row["calls"] == 2 and row["failed_calls"] == 1
    assert row["fresh_input_tokens"] == 110 and row["output_tokens"] == 35
    assert row["reasoning_tokens"] == 20 and row["unknown_cost_calls"] == 1
    assert result["total_tokens"] is None and result["voice_usage_unattributed"]


def test_usage_rejects_symlink_outside_the_attempt(tmp_path):
    stage = tmp_path / "attempt"
    stage.mkdir()
    (stage / "agent").symlink_to(tmp_path / "private")
    with pytest.raises(ValueError, match="simbólicos"):
        editorial_usage([stage])


def test_broken_usage_is_reported_as_unmeasured(tmp_path):
    (tmp_path / "agent").mkdir()
    (tmp_path / "agent/broken.usage.json").write_text("invalid JSON")
    result = editorial_usage([tmp_path])
    assert result["usage_status"] == "partial" and result["unmeasured_calls"] == 1


def native_ledger(stage, rows):
    write(stage / "usage-context.json", {"schema_version": 1, "locale": "pt-BR", "revision": "rev-002"})
    ledger = stage / "logs/usage.jsonl"
    ledger.parent.mkdir(exist_ok=True)
    defaults = {"schema_version": 1, "locale": "pt-BR", "revision": "rev-002", "provider": "gemini_tts",
                "model": "actual-tts", "role": "voice", "step": "narration", "ok": True}
    ledger.write_text("".join(json.dumps({**defaults, "event_id": uuid.uuid4().hex, **row}) + "\n" for row in rows))


def test_native_usage_combines_editorial_voice_retries_and_outro_once(tmp_path):
    event_id = uuid.uuid4().hex
    native_ledger(tmp_path, [
        {"event_id": event_id, "input_tokens": 75, "cached_input_tokens": 25, "output_tokens": 30,
         "reasoning_tokens": 7, "seconds": 2, "cost_usd": None},
        {"event_id": event_id, "input_tokens": 75, "cached_input_tokens": 25, "output_tokens": 30},
        {"ok": False, "input_tokens": None, "output_tokens": None, "seconds": 1},
        {"step": "outro", "input_tokens": 20, "output_tokens": 10, "reasoning_tokens": None}])
    write(tmp_path / "agent/failed.usage.json", {"provider": "codex", "model": "editor", "ok": False,
                                              "input_tokens": 100, "output_tokens": 12})
    result = editorial_usage([tmp_path, tmp_path])
    by_model = {row["model"]: row for row in result["totals_by_model"]}
    tts = by_model["actual-tts"]
    assert tts["calls"] == 3 and tts["failed_calls"] == 1
    assert tts["fresh_input_tokens"] == 95 and tts["cached_input_tokens"] == 25
    assert tts["output_tokens"] == 40 and tts["reasoning_tokens"] == 7
    assert tts["reported_cost_usd"] is None and tts["unknown_cost_calls"] == 3
    assert by_model["editor"]["failed_calls"] == 1
    assert result["total_tokens"] is None and not result["voice_usage_unattributed"]


def test_native_usage_rejects_other_locale_and_preserves_unknowns(tmp_path):
    native_ledger(tmp_path, [{"locale": "en-US", "input_tokens": 9000}, {"input_tokens": None, "output_tokens": None}])
    result = editorial_usage([tmp_path])
    row = result["totals_by_model"][0]
    assert result["unmeasured_calls"] == 1 and row["calls"] == 1
    assert row["fresh_input_tokens"] is None and row["output_tokens"] is None
    assert row["usage_known"] is False and row["reported_cost_usd"] is None


def test_native_usage_without_ledger_after_audio_is_not_claimed_complete(tmp_path):
    write(tmp_path / "usage-context.json", {"schema_version": 1, "locale": "pt-BR", "revision": "rev-002"})
    (tmp_path / "song.mp3").write_bytes(b"FAKE AUDIO")
    result = editorial_usage([tmp_path])
    assert result["voice_usage_unattributed"]


def test_native_ledger_symlink_and_oversized_files_are_bounded(tmp_path, monkeypatch):
    native_ledger(tmp_path, [{}])
    monkeypatch.setattr("src.core.explainer.editions.studio.MAX_LEDGER_BYTES", 2)
    result = editorial_usage([tmp_path])
    assert result["unmeasured_calls"] == 1 and result["totals_by_model"] == []
    ledger = tmp_path / "logs/usage.jsonl"
    ledger.unlink()
    private = tmp_path / "private.jsonl"
    private.write_text("{}")
    ledger.symlink_to(private)
    with pytest.raises(ValueError, match="simbólicos"):
        editorial_usage([tmp_path])


def test_native_ledger_needs_valid_identity_and_legacy_flag_remains_unknown(tmp_path):
    native_ledger(tmp_path, [{"input_tokens": 100}])
    marker = tmp_path / "usage-context.json"
    marker.unlink()
    result = editorial_usage([tmp_path])
    assert result["totals_by_model"] == [] and result["voice_usage_unattributed"]
    write(marker, {"schema_version": 1, "locale": "pt-BR", "revision": "rev-002", "historical_usage_unattributed": True})
    result = editorial_usage([tmp_path])
    assert result["totals_by_model"][0]["fresh_input_tokens"] == 100
    assert result["voice_usage_unattributed"]


def test_malformed_editorial_event_id_does_not_break_usage_api(tmp_path):
    write(tmp_path / "agent/invalid.usage.json", {"provider": "codex", "event_id": [], "input_tokens": 100})
    result = editorial_usage([tmp_path])
    assert result["unmeasured_calls"] == 1 and result["totals_by_model"] == []

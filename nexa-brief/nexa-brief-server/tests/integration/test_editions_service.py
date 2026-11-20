"""Full HTTP/host pipeline on a copy of the authorized demo; no external models."""
import asyncio
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import threading
import time

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from src.config.settings import settings
from src.core.explainer.editions.resolver import build_edition
from src.core.explainer.editions.alignment import align
from src.core.explainer.editions.extraction import extract
from src.core.explainer.editions.io import read, write
from src.core.explainer.editions.service import EditionService
from src.core.localization.output import EditionOutput
from src.core.ports.agent_port import AgentRunResult
from src.presentation.api.routers import explainer

SOURCE = Path(__file__).resolve().parents[2] / "src/templates/nodetech/lo-que-le-contas-a-la-ia-no-es-privado-tus-chats"
VIDEO = SOURCE.name
BASE = f"/api/v1/explainer/videos/{VIDEO}/localizations"


def hashes(root):
    return {p.relative_to(root).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob('*') if p.is_file()}


class FakeRunner:
    name = "codex"

    def __init__(self, output):
        self.output = output
        self.gate = threading.Event()
        self.calls = []

    async def run(self, prompt, *, cwd, log_path, timeout_seconds, scope):
        self.calls.append((prompt, cwd, scope, {p.name for p in cwd.iterdir()}))
        while not self.gate.is_set():
            await asyncio.sleep(.01)
        output = deepcopy(self.output)
        output["locale"] = read(cwd / "identity.json")["market"]["market"]
        write(cwd / "edition.output.json", output)
        return AgentRunResult(0, json.dumps(output), .01,
                              usage={"input_tokens": 12, "output_tokens": 5}, model=scope.model)


class FakeTools:
    def __init__(self, source_alignment):
        self.source_alignment = source_alignment
        self.calls = []
        self.fail = None

    async def run(self, command, production, stage, edition):
        self.calls.append(command)
        if command == self.fail:
            raise RuntimeError("test injected failure at " + command)
        if command == "voice":
            # Actual MP3 container containing silence; never calls TTS.
            subprocess.run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
                            "anullsrc=r=16000:cl=mono", "-t", "704", "-b:a", "8k",
                            str(stage / "song.mp3")], check=True)
        elif command == "transcribe":
            script = read(stage / "script.json")
            segments = []
            for s in script["segments"]:
                row = self.source_alignment["segments"][s["id"]]
                text = s["text"].split()
                step = (row["end"] - row["start"]) / len(text)
                words = [{"word": " " + word, "start": round(row["start"] + i * step, 6),
                          "end": round(row["start"] + (i + .95) * step, 6)}
                         for i, word in enumerate(text)]
                segments.append({"text": s["text"], "start": words[0]["start"],
                                 "end": words[-1]["end"], "words": words})
            raw = {"metadata": {"duration": 704, "language": edition.transcription["language"]},
                   "segments": segments}
            write(stage / "transcript-raw.json", raw)
            write(stage / "lyrics.json", raw)
        else:
            shutil.copyfile(stage / "song.mp3", stage / "song-with-outro.mp3")
            raw = read(stage / "config.json")
            raw["outro"] = {"start": 690, "dur": 14, "enabled": True, **edition.outro.model_dump()}
            write(stage / "config.json", raw)


def fake_output(extracted):
    """Fixed mechanical output; source text intentionally tests plumbing, not translation."""
    values = {k: v.metadata.get("fixed_target", v.text) for k, v in extracted.table.entries.items()}
    segments = [{"id": s["id"], "text": values[f"seg.{s['id']}"],
                 "delivery_note": "Clear and measured delivery."} for s in extracted.script["segments"]]
    cues = {}
    for key, cue in extracted.cues.items():
        segment = next(s for s in segments if s["id"] == cue["segment_id"])
        phrase = cue["source_phrase"]
        if not phrase or phrase not in segment["text"]:
            words = segment["text"].split()
            start = min(len(words) - 1, int(cue["fraction"] * len(words)))
            phrase = " ".join(words[start:start + 4])
        cues[key] = {"segment_id": segment["id"], "target_phrase": phrase}
    source = deepcopy(extracted.story["publish_source"])
    source["youtube"]["title"] = "Your chats and the court order"
    source["youtube"]["chapters"] = [{"segment_id": s["id"], "title": "Chapter " + s["id"]}
                                    for s in extracted.script["segments"] if s.get("chapter")]
    return EditionOutput(locale="en-US", segments=segments,
                         strings={k: v for k, v in values.items() if not k.startswith("seg.")},
                         cues=cues, publish=source, observations=[], packaging={
                             "titles": [{"option": option, "text": title, "strategy": 1, "emotion": "Curiosity"} for option, title in
                                        zip("ABC", [source["youtube"]["title"], "The court order behind deleted chats", "Who can read your ChatGPT chats?"])],
                             "chosen_title": "A", "text_only": {"lines": ["DELETED?", "STILL SAVED"], "highlight": "STILL SAVED", "pair_title": "A"},
                             "with_image": {"text": "STILL SAVED?", "pair_title": "B"},
                             "tabloid": {"text": "YOUR CHATS BEFORE A JUDGE", "accent": "JUDGE", "bullet": "20 MILLION", "pair_title": "C"},
                             "kicker": "CHATGPT · PRIVACY"}).model_dump()


@pytest.fixture
def environment(tmp_path, monkeypatch):
    assert str(tmp_path).startswith('/tmp/')
    profile = tmp_path / "profile"
    profile.mkdir()
    write(profile / "profile.json", {"schema_version": 3, "id": "edition-test"})
    production = profile / "productions/nodetech" / VIDEO
    shutil.copytree(SOURCE, production)
    # The repository demo uses a shorter relative path than a profile production.
    index = production / "index.html"
    index.write_text(index.read_text().replace('../../_tools/explainer-kit/', '../../../_tools/explainer-kit/'))
    monkeypatch.setattr(settings, "storage_profile_dir", profile)
    monkeypatch.setattr(settings, "storage_layout_version", 3)
    monkeypatch.setattr(settings, "data_dir", profile / "data")
    from unittest.mock import AsyncMock
    monkeypatch.setattr("src.core.explainer.thumbnails.render", AsyncMock(return_value={}))
    edition = build_edition(production, "en-US")
    extracted = extract(production, edition)
    alignment, _ = align(extracted.script, read(production / "assets/lyrics.json"))
    runner = FakeRunner(fake_output(extracted))
    tools = FakeTools(alignment)
    service = EditionService(tools=tools)
    monkeypatch.setattr("src.core.explainer.editions.agent.agent_for", lambda role: runner)
    monkeypatch.setattr(explainer, "get_edition_service", lambda: service)
    app = FastAPI()
    app.include_router(explainer.router, prefix="/api/v1")
    with TestClient(app) as client:
        yield client, service, runner, tools, profile, production
        client.portal.call(service.shutdown)
    shutil.rmtree(profile)


def wait_job(client, ident):
    for _ in range(500):
        row = client.get("/api/v1/explainer/localization-jobs/" + ident).json()
        if row["status"] not in {"queued", "running"}:
            return row
        time.sleep(.02)
    raise AssertionError("job timed out")


def test_preflight_is_read_only_and_same_guard_blocks_submission(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    before = hashes(production)
    result = client.get(BASE + "/pt-BR/preflight")
    assert result.status_code == 200, result.text
    assert result.json()["ready"] and result.json()["next_action"] == "create"
    assert result.json()["profile"] == {"id": "edition-test", "schema_version": 3}
    assert service.repository.jobs(VIDEO) == [] and runner.calls == [] and tools.calls == []
    assert hashes(production) == before
    monkeypatch.setattr(tools, "readiness", lambda edition: [
        {"level": "error", "field": "voice", "message": "No hay voz disponible"}], raising=False)
    blocked = client.get(BASE + "/pt-BR/preflight").json()
    assert not blocked["ready"] and blocked["issues"][0]["field"] == "voice"
    assert client.post(BASE, json={"locale": "pt-BR"}).status_code == 409
    assert service.repository.jobs(VIDEO) == [] and runner.calls == []


def test_preflight_adapter_failure_is_actionable_without_creating_job(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment

    def broken(edition):
        raise RuntimeError("internal resolver path must not escape")

    monkeypatch.setattr(tools, "readiness", broken, raising=False)
    response = client.get(BASE + "/pt-BR/preflight")
    assert response.status_code == 200
    assert not response.json()["ready"] and response.json()["issues"][0]["field"] == "tools"
    assert "internal resolver" not in response.text
    assert client.post(BASE, json={"locale": "pt-BR"}).status_code == 409
    assert service.repository.jobs(VIDEO) == [] and runner.calls == []


def test_first_agent_failure_can_resume_same_revision_without_losing_usage(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    respond = runner.run

    async def fail(*args, **kwargs):
        return AgentRunResult(1, "injected provider unavailable", .01,
                              usage={"input_tokens": 9}, model=kwargs["scope"].model)

    monkeypatch.setattr(runner, "run", fail)
    response = client.post(BASE, json={"locale": "en-US"})
    assert response.status_code == 202, response.text
    job = response.json()["job_id"]
    assert wait_job(client, job)["status"] == "failed"
    stage = profile / ".system/runtime/localization" / job
    assert read(stage / "usage-context.json") == {"schema_version": 1, "locale": "en-US", "revision": "rev-001"}
    first_usage = (stage / "agent/initial.usage.json").read_bytes()
    preflight = client.get(BASE + "/en-US/preflight").json()
    assert preflight["next_action"] == "resume" and preflight["job_id"] == job
    # A hard crash can leave the isolated directory behind, unlike normal finally.
    orphan = production / "work/localization" / job
    orphan.mkdir(mode=0o700)
    write(orphan / "edition.output.json", {"stale": "must not become the recovered answer"})
    write(orphan / "unexpected.json", {"stale": True})
    monkeypatch.setattr(runner, "run", respond)
    runner.gate.set()
    assert client.post(f"/api/v1/explainer/localization-jobs/{job}/resume").status_code == 202
    done = wait_job(client, job)
    assert done["status"] == "completed", done
    revision = production / "languages/en-US/revisions/rev-001"
    assert (revision / "agent/initial.usage.json").read_bytes() == first_usage
    assert read(revision / "agent/retry-001.initial.usage.json")["ok"]
    assert len(service.repository.jobs(VIDEO)) == 1
    assert tools.calls == ["voice", "transcribe", "outro"]
    assert not orphan.exists()
    assert all("unexpected.json" not in contents for _, _, _, contents in runner.calls)


def test_ready_content_can_be_reused_without_provider_but_new_version_is_guarded(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    runner.gate.set()
    response = client.post(BASE, json={"locale": "en-US"})
    assert wait_job(client, response.json()["job_id"])["status"] == "completed"

    def unavailable():
        raise RuntimeError("injected unavailable")

    monkeypatch.setattr(service.agent, "readiness", unavailable)
    result = client.get(BASE + "/en-US/preflight").json()
    assert result["ready"] and result["next_action"] == "review"
    assert result["provider"]["status"] == "not_needed"
    assert client.post(BASE, json={"locale": "en-US"}).status_code == 409
    assert len(service.repository.jobs(VIDEO)) == 1 and len(runner.calls) == 1


def test_resume_revalidates_archived_output_without_another_editorial_call(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    original = service.agent._errors
    respond = runner.run

    async def with_repair(prompt, *, cwd, log_path, timeout_seconds, scope):
        if (cwd / "identity.json").is_file():
            return await respond(prompt, cwd=cwd, log_path=log_path, timeout_seconds=timeout_seconds, scope=scope)
        runner.calls.append((prompt, cwd, scope, {p.name for p in cwd.iterdir()}))
        response = {"corrections": {"locale": "en-US"}}
        write(cwd / "edition.output.json", response)
        return AgentRunResult(0, json.dumps(response), .01, usage={"input_tokens": 1}, model=scope.model)

    monkeypatch.setattr(runner, "run", with_repair)
    monkeypatch.setattr(service.agent, "_errors", lambda *args: {"locale": ["injected host validation failure"]})
    runner.gate.set()
    response = client.post(BASE, json={"locale": "en-US"})
    job = response.json()["job_id"]
    assert wait_job(client, job)["status"] == "failed"
    calls = len(runner.calls)
    assert calls == 2  # Original attempt and its one bounded repair.
    stage = profile / ".system/runtime/localization" / job
    write(stage / "agent/retry-001.initial.output.json", {"cues": [{}], "segments": []})
    orphan = production / "work/localization" / job
    orphan.mkdir(mode=0o700)
    write(orphan / "edition.output.json", {"stale": True})
    monkeypatch.setattr(service.agent, "_errors", original)
    assert client.post(f"/api/v1/explainer/localization-jobs/{job}/resume").status_code == 202
    done = wait_job(client, job)
    assert done["status"] == "completed", done
    assert len(runner.calls) == calls
    saved = production / "languages/en-US/revisions/rev-001"
    assert read(saved / "agent/recovery.json")["provider_called"] is False
    assert (saved / "agent/initial.usage.json").is_file()
    assert (saved / "agent/repair.usage.json").is_file()
    assert not orphan.exists()


def test_end_to_end_http_activation_preview_and_failed_regeneration(environment):
    client, service, runner, tools, profile, production = environment
    before, source_before = hashes(production), hashes(SOURCE)
    original = client.get(BASE).json()
    runner.output["strings"].update({"scene.0.text": "YOUR CHATS BEFORE A JUDGE", "scene.0.accent": "JUDGE",
                                     "script.title": "YOUR CHATS BEFORE A JUDGE"})
    assert original["supported"] and original["locales"][1]["status"] == "missing"
    response = client.post(BASE, json={"locale": "en-US"})
    assert response.status_code == 202, response.text
    job = response.json()["job_id"]
    assert client.post(BASE, json={"locale": "en"}).status_code == 409
    progress = client.get("/api/v1/explainer/localization-jobs/" + job).json()
    assert progress["status"] in {"queued", "running"} and progress["percent"] < 100
    runner.gate.set()
    done = wait_job(client, job)
    assert done["status"] == "completed", done.get("error")
    assert done["percent"] == 100 and done["stage"] == "done"
    result = client.get(BASE).json()
    english = next(row for row in result["locales"] if row["locale"] == "en-US")
    # The demo has end anchors which cannot be kept in Spanish; their replacement
    # must be reviewed even when the fake transcription matches perfectly.
    assert english["status"] == "needs_review", english
    assert english["name"] == "English" and result["locales"][0]["name"] == "Español"
    assert english["revision"] == "rev-001" and "edition=en-US" in english["preview_url"]
    assert english["title"] == english["publish"]["youtube"]["title"] == "Your chats and the court order"
    assert set(english["publish"]) == {"youtube", "instagram", "facebook", "tiktok"}
    assert tools.calls == ["voice", "transcribe", "outro"]
    revision = production / "languages/en-US/revisions/rev-001"
    for name in ("edition.json", "strings.json", "script.json", "storyboard.json", "lyrics.json",
                 "transcript-raw.json", "alignment.json", "config.json", "publish.json", "song.mp3",
                 "song-with-outro.mp3", "review.json", "agent/initial.usage.json", "agent/prompt.md"):
        assert (revision / name).is_file(), name
    review = read(revision / "review.json")
    assert any(w["kind"] == "end_anchor_replaced" for w in review["warnings"])
    from src.core.explainer.editions.packaging import approve
    approve(revision, note="Test human approval")
    assert next(row for row in client.get(BASE).json()["locales"] if row["locale"] == "en-US")["status"] == "ready"
    (revision / "approval.json").unlink()
    assert client.get(english["preview_url"]).status_code == 200
    config_base = english["preview_url"].split('/index.html')[0]
    config_url = config_base + '/assets/config.json?edition=en-US'
    config_response = client.get(config_url)
    assert config_response.status_code == 200, config_response.text
    config = config_response.json()
    assert config["locale"] == "en-US" and config["audio"]["src"].endswith('/rev-001/song-with-outro.mp3')
    assert config["components"] == read(production / 'assets/config.json')["configs"][0]["components"]
    for key in ('lyricsUrl', 'storyboardUrl'):
        assert client.get(config_base + '/' + config[key]).status_code == 200
    assert client.get(config_base + '/' + config["audio"]["src"]).status_code == 200
    stored = read(revision / "storyboard.json")
    assert stored["beats"][0]["t"] == 0
    assert stored["beats"][0]["params"]["text"] == "YOUR CHATS BEFORE A JUDGE"
    original_src = read(production / 'assets/storyboard.json')["beats"][0]["params"]["src"]
    assert stored["beats"][0]["params"]["src"] == "/productions" + original_src
    assert read(revision / "script.json")["segments"][0]["act"] == read(production / 'assets/script.json')["segments"][0]["act"]
    assert client.get(config_base + '/languages/en-US/revisions/rev-001/agent/prompt.md').status_code == 404
    assert client.get(config_base + '/languages/en-US/revisions/rev-001/edition.json').status_code == 404
    prompt, workspace, scope, contents = runner.calls[0]
    assert contents == {"PROMPT.md", "strings.source.json", "story.json", "identity.json",
                        "strategies.json", "output.schema.json"}
    assert scope.model == "gpt-6.1-terra" and scope.reasoning_effort == "xhigh"
    assert str(profile) not in prompt and '"beats"' not in prompt
    assert '"models"' not in prompt and '"lexicon_ref"' not in prompt
    assert 'binary' not in prompt and 'imperio' not in prompt
    assert not workspace.exists()
    assert all(hashlib.sha256((production / path).read_bytes()).hexdigest() == digest
               for path, digest in before.items())
    assert hashes(SOURCE) == source_before
    assert client.get(BASE).json()["locales"][0] == original["locales"][0]
    assert client.get(config_url.replace('en-US', 'pt-BR')).status_code == 404
    tools.fail = "voice"
    second = client.post(BASE, json={"locale": "en-US"})
    assert second.status_code == 202
    failed = wait_job(client, second.json()["job_id"])
    assert failed["status"] == "failed" and "test injected failure" in failed["error"]
    assert read(production / 'languages/en-US/active.json') == {"revision": "rev-001"}
    assert client.get(config_url).json() == config
    assert (profile / '.system/runtime/localization' / failed['job_id']).is_dir()
    previous = next(row for row in client.get(BASE).json()["locales"] if row["locale"] == "en-US")
    assert previous["preview_url"] and previous["revision"] == "rev-001"
    assert previous["job_status"] == "failed" and previous["status"] == "needs_review"


def test_unsupported_design_and_locale_change_nothing(environment):
    client, service, runner, tools, profile, production = environment
    before = hashes(production)
    assert client.post(BASE, json={"locale": "de-DE"}).status_code == 422
    assert client.post(BASE, json={"locale": "es-419"}).status_code == 422
    video = service.video_getter(VIDEO)
    video.design = "binary"
    service.video_getter = lambda ident: video if ident == VIDEO else None
    result = client.get(BASE).json()
    assert result["supported"] is False and len(result["locales"]) == 1
    assert client.post(BASE, json={"locale": "en-US"}).status_code == 422
    assert client.get('/api/v1/explainer/localization-jobs/missing').status_code == 404
    assert client.post(BASE.replace(VIDEO, 'missing'), json={"locale": "en-US"}).status_code == 404
    assert hashes(production) == before
    assert runner.calls == [] and tools.calls == []


def test_one_bounded_repair_only_receives_failed_keys(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    good = deepcopy(runner.output)
    bad = deepcopy(good)
    bad["strings"]["scene.0.text"] = "x" * 400
    calls = []

    async def respond(prompt, *, cwd, log_path, timeout_seconds, scope):
        if not calls:
            calls.append(read(cwd / "strings.source.json"))
            response = bad
        else:
            requests = read(cwd / "strings.source.json")
            calls.append(requests)
            assert set(requests) == {"scene.0.text", "scene.0.accent"}
            assert not (cwd / "story.json").exists()
            response = {"corrections": {key: good["strings"][key] for key in requests}}
        write(cwd / "edition.output.json", response)
        return AgentRunResult(0, json.dumps(response), .01, model=scope.model)

    monkeypatch.setattr(runner, "run", respond)
    response = client.post(BASE, json={"locale": "en-US"})
    done = wait_job(client, response.json()["job_id"])
    assert done["status"] == "completed", done
    assert len(calls) == 2
    revision = production / "languages/en-US/revisions/rev-001"
    assert (revision / "agent/repair-prompt.md").is_file()
    assert (revision / "agent/repair.usage.json").is_file()


def test_repair_cannot_change_unrelated_keys(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    bad = deepcopy(runner.output)
    bad["locale"] = "pt-BR"
    calls = []

    async def respond(prompt, *, cwd, log_path, timeout_seconds, scope):
        calls.append(prompt)
        response = bad if len(calls) == 1 else {"corrections": {"locale": "en-US", "script.title": "Unrequested"}}
        write(cwd / "edition.output.json", response)
        return AgentRunResult(0, json.dumps(response), .01, model=scope.model)

    monkeypatch.setattr(runner, "run", respond)
    response = client.post(BASE, json={"locale": "en-US"})
    done = wait_job(client, response.json()["job_id"])
    assert done["status"] == "failed" and "fuera de su alcance" in done["error"]
    assert len(calls) == 2 and tools.calls == []
    assert not (production / "languages/en-US/active.json").exists()
    assert not list((production / "work/localization").iterdir())


def test_repair_can_replace_segments_when_an_id_is_wrong(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    good = deepcopy(runner.output)
    bad = deepcopy(good)
    bad["segments"][0]["id"] = "wrong"
    calls = []

    async def respond(prompt, *, cwd, log_path, timeout_seconds, scope):
        calls.append(prompt)
        if len(calls) == 1:
            response = bad
        else:
            requests = read(cwd / "strings.source.json")
            assert set(requests) == {"segments"}
            assert "seg.s01" in requests["segments"]["source"]
            response = {"corrections": {"segments": good["segments"]}}
        write(cwd / "edition.output.json", response)
        return AgentRunResult(0, json.dumps(response), .01, model=scope.model)

    monkeypatch.setattr(runner, "run", respond)
    response = client.post(BASE, json={"locale": "en-US"})
    done = wait_job(client, response.json()["job_id"])
    assert done["status"] == "completed", done.get("error")
    assert len(calls) == 2


def test_source_change_during_job_prevents_activation(environment):
    client, service, runner, tools, profile, production = environment
    response = client.post(BASE, json={"locale": "en-US"})
    script = read(production / "assets/script.json")
    script["title"] += " revised"
    write(production / "assets/script.json", script)
    runner.gate.set()
    done = wait_job(client, response.json()["job_id"])
    assert done["status"] == "failed" and "original cambió" in done["error"]
    assert not (production / "languages/en-US/active.json").exists()


def test_profile_path_and_symlink_are_rejected(environment, tmp_path):
    client, service, runner, tools, profile, production = environment
    actual = service.video_getter(VIDEO)
    actual.path = SOURCE
    service.video_getter = lambda ident: actual
    assert client.post(BASE, json={"locale": "en-US"}).status_code == 422
    actual.path = production
    (production / "languages").symlink_to(tmp_path / "outside", target_is_directory=True)
    response = client.post(BASE, json={"locale": "en-US"})
    assert response.status_code == 422
    assert tools.calls == []


def test_pipeline_job_listing_ignores_localization_records(environment):
    client, service, runner, tools, profile, production = environment
    from src.core import job_tracker
    from src.core.data import collection
    client.portal.call(collection("jobs").insert, {
        "job_id": "localized", "kind": "localization", "stage": "voice", "status": "running",
        "created_at": "2026-11-12T00:00:00Z",
    })
    assert job_tracker.list_jobs() == ([], 0)
    assert job_tracker.count_active() == 0


def process_snapshot():
    import os
    root = os.getpid()
    entries = {}
    for path in Path("/proc").glob("[0-9]*/stat"):
        try:
            text = path.read_text()
            fields = text[text.rfind(")") + 2:].split()
            entries[int(path.parent.name)] = (int(fields[1]), int(fields[11]) + int(fields[12]), int(fields[21]))
        except (OSError, ValueError, IndexError):
            pass
    owned = {root}
    while True:
        new = {pid for pid, (parent, _, _) in entries.items() if parent in owned}
        if new <= owned:
            break
        owned |= new
    available = next(line.split()[1] for line in Path("/proc/meminfo").read_text().splitlines() if line.startswith("MemAvailable:"))
    swap = {line.split()[0]: int(line.split()[1]) for line in Path("/proc/vmstat").read_text().splitlines() if line.startswith(("pswpin ", "pswpout "))}
    return {"rss_mib": round(sum(entries[p][2] for p in owned if p in entries) * os.sysconf("SC_PAGE_SIZE") / 2**20, 2),
            "cpu_seconds": sum(entries[p][1] for p in owned if p in entries) / os.sysconf("SC_CLK_TCK"),
            "children": len(owned) - 1, "available_mib": round(int(available) / 1024), **swap}


def measure_processes():
    start, stamp = process_snapshot(), time.monotonic()
    time.sleep(1)
    end = process_snapshot()
    end["cpu_percent"] = round(100 * (end["cpu_seconds"] - start["cpu_seconds"]) / (time.monotonic() - stamp), 1)
    return end


def test_real_browser_selects_edition_and_releases_resources(environment, tmp_path):
    from urllib.parse import urlsplit
    from playwright.sync_api import sync_playwright
    client, service, runner, tools, profile, production = environment
    runner.output["strings"].update({"scene.0.text": "YOUR CHATS BEFORE A JUDGE", "scene.0.accent": "JUDGE"})
    runner.gate.set()
    response = client.post(BASE, json={"locale": "en-US"})
    done = wait_job(client, response.json()["job_id"])
    assert done["status"] == "completed", done
    evidence = tmp_path / "preview-evidence"
    evidence.mkdir(exist_ok=True)
    measurements = {"idle": measure_processes()}
    errors = []

    def route_request(route):
        parsed = urlsplit(route.request.url)
        if parsed.netloc != "edition.test":
            route.fulfill(status=200, body="", content_type="text/css")
            return
        result = client.get(parsed.path + ("?" + parsed.query if parsed.query else ""),
                            headers={"accept-encoding": "identity"})
        route.fulfill(status=result.status_code, body=result.content,
                      content_type=result.headers.get("content-type", "application/octet-stream"))

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        context = browser.new_context()
        context.set_default_navigation_timeout(10000)
        context.route("**/*", route_request)
        def wait_for_kit(page):
            page.evaluate("Promise.race([window.KitReady, new Promise((_, reject) => setTimeout(() => reject(new Error('KitReady timeout')), 30000))])")
        for width, height, label in ((1280, 720, "16x9"), (540, 960, "9x16")):
            page = context.new_page()
            page.set_viewport_size({"width": width, "height": height})
            page.on("pageerror", lambda error: errors.append(str(error)))
            url = service.preview_url(service.video_getter(VIDEO), "en-US")
            page.goto("http://edition.test" + url + "&t=2", wait_until="load")
            wait_for_kit(page)
            page.evaluate("window.__tabloidFontReady")
            page.evaluate("window.__promo.seek(2)")
            assert page.evaluate("document.documentElement.lang") == "en-US"
            assert page.evaluate("window.__promo.beats[0].params.text") == "YOUR CHATS BEFORE A JUDGE"
            assert "languages/en-US/revisions/rev-001/" in page.locator("audio").get_attribute("src")
            page.screenshot(path=str(evidence / (label + ".png")))
            measurements[label] = measure_processes()
            page.close()
        # Repeated opens cover loader lifecycle without starting playback.
        for _ in range(4):
            page = context.new_page()
            page.goto("http://edition.test" + url + "&t=2", wait_until="load")
            wait_for_kit(page)
            page.close()
        page = context.new_page()
        original = service.preview_url(service.video_getter(VIDEO))
        page.goto("http://edition.test" + original + "?t=2", wait_until="load")
        wait_for_kit(page)
        assert "/languages/" not in page.locator("audio").get_attribute("src")
        measurements["original"] = measure_processes()
        page.close()
        context.close()
        browser.close()
    measurements["closed"] = measure_processes()
    write(evidence / "resources.json", measurements)
    assert errors == []
    assert measurements["closed"]["children"] == measurements["idle"]["children"]
    assert not service.tasks


def test_shutdown_marks_pending_job_failed_and_removes_workspace(environment):
    client, service, runner, tools, profile, production = environment
    response = client.post(BASE, json={"locale": "en-US"})
    ident = response.json()["job_id"]
    client.portal.call(service.shutdown)
    job = client.get("/api/v1/explainer/localization-jobs/" + ident).json()
    assert job["status"] == "failed" and "interrumpido" in job["error"]
    assert not service.tasks and not (production / "languages/en-US/active.json").exists()
    assert not list((production / "work/localization").iterdir())


def test_admission_is_shared_between_service_instances(environment):
    from src.core.explainer.editions.service import EditionError
    client, service, runner, tools, profile, production = environment
    assert client.post(BASE, json={"locale": "en-US"}).status_code == 202
    other = EditionService(tools=tools)
    with pytest.raises(EditionError) as failure:
        client.portal.call(other.submit, VIDEO, "en")
    assert failure.value.status == 409
    assert len(service.repository.jobs(VIDEO, "en-US")) == 1
    assert not other.tasks


def test_portuguese_alias_voice_and_transcript_language(environment):
    client, service, runner, tools, profile, production = environment
    runner.gate.set()
    response = client.post(BASE, json={"locale": "pt"})
    assert response.status_code == 202 and response.json()["locale"] == "pt-BR"
    done = wait_job(client, response.json()["job_id"])
    assert done["status"] == "completed", done
    revision = production / "languages/pt-BR/revisions/rev-001"
    assert read(revision / "script.json")["language"] == "pt-BR"
    assert read(revision / "script.json")["voice"] == "Orus"
    assert read(revision / "transcript-raw.json")["metadata"]["language"] == "pt"
    portuguese = next(row for row in client.get(BASE).json()["locales"] if row["locale"] == "pt-BR")
    assert portuguese["status"] == "needs_review" and "edition=pt-BR" in portuguese["preview_url"]


def test_dataport_failure_after_pointer_write_restores_previous_revision(environment, monkeypatch):
    client, service, runner, tools, profile, production = environment
    runner.gate.set()
    first = client.post(BASE, json={"locale": "en-US"}).json()["job_id"]
    assert wait_job(client, first)["status"] == "completed"
    update = service.repository.update

    async def fail_completion(ident, **patch):
        if patch.get("status") == "completed":
            raise RuntimeError("injected DataPort completion failure")
        return await update(ident, **patch)

    monkeypatch.setattr(service.repository, "update", fail_completion)
    second = client.post(BASE, json={"locale": "en-US"}).json()["job_id"]
    failed = wait_job(client, second)
    assert failed["status"] == "failed" and "DataPort" in failed["error"]
    assert read(production / "languages/en-US/active.json") == {"revision": "rev-001"}
    row = service.repository.collection("video_localizations").get(service.repository.key(VIDEO, "en-US"))
    assert row["revision"] == "rev-001"
    assert (production / "languages/en-US/revisions/rev-002/review.json").is_file()
    calls = len(runner.calls), list(tools.calls)
    monkeypatch.setattr(service.repository, "update", update)
    assert client.post(f"/api/v1/explainer/localization-jobs/{second}/resume").status_code == 202
    assert wait_job(client, second)["status"] == "completed"
    assert read(production / "languages/en-US/active.json") == {"revision": "rev-002"}
    assert (len(runner.calls), tools.calls) == calls


def test_resume_reuses_editorial_voice_and_transcription_after_orphaned_outro(environment):
    client, service, runner, tools, profile, production = environment
    runner.gate.set()
    tools.fail = "outro"
    job = client.post(BASE, json={"locale": "en-US"}).json()["job_id"]
    assert wait_job(client, job)["status"] == "failed"
    calls = len(runner.calls), list(tools.calls)
    # Simulate process death: durable status stayed running but no kernel lease.
    client.portal.call(lambda: service.repository.update(job, status="running", stage="outro"))
    orphan = client.get(f"/api/v1/explainer/localization-jobs/{job}").json()
    assert orphan["status"] == "failed" and orphan["resumable"]
    tools.fail = None
    assert client.post(f"/api/v1/explainer/localization-jobs/{job}/resume").status_code == 202
    assert wait_job(client, job)["status"] == "completed"
    assert len(runner.calls) == calls[0]
    assert tools.calls == calls[1] + ["outro"]
    review = read(production / "languages/en-US/revisions/rev-001/review.json")
    assert review["reused_steps"] == ["agent", "voice", "transcribe"]
    assert review["editorial_approval"] == "pending" and review["needs_review"]


def test_resume_rejects_changed_files_or_source_without_provider_calls(environment):
    client, service, runner, tools, profile, production = environment
    runner.gate.set()
    tools.fail = "outro"
    job = client.post(BASE, json={"locale": "en-US"}).json()["job_id"]
    assert wait_job(client, job)["status"] == "failed"
    calls = len(runner.calls), list(tools.calls)
    audio = profile / ".system/runtime/localization" / job / "song.mp3"
    contents = audio.read_bytes()
    audio.write_bytes(b"corrupt")
    assert client.post(f"/api/v1/explainer/localization-jobs/{job}/resume").status_code == 409
    audio.write_bytes(contents)
    plan = production / "PLAN.md"
    plan.write_text(plan.read_text() + "\nChanged editorial fact\n")
    assert client.post(f"/api/v1/explainer/localization-jobs/{job}/resume").status_code == 409
    english = next(row for row in client.get(BASE).json()["locales"] if row["locale"] == "en-US")
    assert not english["resumable"]
    assert (len(runner.calls), tools.calls) == calls


def test_original_change_marks_active_edition_stale_but_keeps_preview(environment):
    client, service, runner, tools, profile, production = environment
    runner.gate.set()
    job = client.post(BASE, json={"locale": "en-US"}).json()["job_id"]
    assert wait_job(client, job)["status"] == "completed"
    plan = production / "PLAN.md"
    plan.write_text(plan.read_text() + "\nChanged intent\n")
    english = next(row for row in client.get(BASE).json()["locales"] if row["locale"] == "en-US")
    assert english["stale"] and english["status"] == "needs_review" and english["preview_url"]
    # Recover a crash after active.json was written, even if the source changed later.
    client.portal.call(lambda: service.repository.update(job, status="running", stage="activate"))
    english = next(row for row in client.get(BASE).json()["locales"] if row["locale"] == "en-US")
    assert english["stale"] and english["job_status"] == "completed" and english["preview_url"]







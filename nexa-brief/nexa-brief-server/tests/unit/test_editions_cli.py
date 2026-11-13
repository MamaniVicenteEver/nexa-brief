"""Operator CLI reaches the real HTTP boundary without models or profile writes."""
from __future__ import annotations

import contextlib
import json
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from types import SimpleNamespace

import pytest

from src.core.explainer.editions import cli
from src.core.explainer.editions.client import APIClientError, EditionClient


@contextlib.contextmanager
def private_api(responses):
    calls = []
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass

        def handle_request(self):
            size = int(self.headers.get("Content-Length", "0"))
            body = json.loads(self.rfile.read(size)) if size else None
            calls.append((self.command, self.path, body))
            result = responses[(self.command, self.path)]
            if isinstance(result, list):
                result = result.pop(0)
            status, payload = result if isinstance(result, tuple) else (200, result)
            raw = payload.encode() if isinstance(payload, str) else json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        do_GET = handle_request
        do_POST = handle_request

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}/api/v1", calls
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        assert not thread.is_alive()


VIDEO = "/api/v1/explainer/videos/episode-one/localizations"
JOB = "/api/v1/explainer/localization-jobs/job-123"


def preflight(action="create", **extra):
    return {"video_id": "episode-one", "locale": "en-US", "ready": True,
            "next_action": action, "issues": [], "profile": {"id": "test-profile", "schema_version": 3}, **extra}


def test_cli_create_uses_same_preflight_post_and_status_endpoints_as_browser():
    responses = {("GET", VIDEO + "/en-US/preflight"): preflight(),
                 ("POST", VIDEO): (202, {"job_id": "job-123", "locale": "en-US", "status": "queued"}),
                 ("GET", JOB): {"job_id": "job-123", "status": "completed", "percent": 100}}
    events = []
    with private_api(responses) as (url, calls):
        result = cli.main(["--api-url", url, "create", "episode-one", "--locale", "en", "--wait"], output=events.append)
    assert result == 0
    assert calls == [("GET", VIDEO + "/en-US/preflight", None), ("POST", VIDEO, {"locale": "en-US"}), ("GET", JOB, None)]
    assert events[-1]["event"] == "completed" and events[-1]["next_action"] == "review"


@pytest.mark.parametrize("action", ["ready", "review"])
def test_existing_edition_is_reused_without_new_paid_job(action):
    events = []
    with private_api({("GET", VIDEO + "/en-US/preflight"): preflight(action, revision="rev-003")}) as (url, calls):
        result = cli.main(["--api-url", url, "create", "episode-one", "--locale", "en-US"], output=events.append)
    assert result == 0 and len(calls) == 1
    assert events[-1] == {"event": "reused", "video_id": "episode-one", "locale": "en-US", "revision": "rev-003", "next_action": action}


def test_new_version_requires_explicit_flag_but_keeps_browser_payload():
    events = []
    responses = {("GET", VIDEO + "/en-US/preflight"): preflight("ready"),
                 ("POST", VIDEO): (202, {"job_id": "job-123", "status": "queued"})}
    with private_api(responses) as (url, calls):
        assert cli.main(["--api-url", url, "create", "episode-one", "--locale", "en", "--new-version"], output=events.append) == 0
    assert calls[-1] == ("POST", VIDEO, {"locale": "en-US"})


def test_failed_compatible_job_requires_explicit_resume_without_duplicate_create():
    events = []
    responses = {("GET", VIDEO + "/en-US/preflight"): preflight("resume", job_id="job-123"),
                 ("POST", JOB + "/resume"): (202, {"job_id": "job-123", "status": "queued"})}
    with private_api(responses) as (url, calls):
        assert cli.main(["--api-url", url, "create", "episode-one", "--locale", "en"], output=events.append) == 3
        assert cli.main(["--api-url", url, "resume", "job-123"], output=events.append) == 0
    assert calls == [("GET", VIDEO + "/en-US/preflight", None), ("POST", JOB + "/resume", None)]
    assert events[1]["job_id"] == "job-123" and events[1]["next_action"] == "resume"


def test_active_job_is_followed_instead_of_recreated():
    responses = {("GET", VIDEO + "/en-US/preflight"): preflight("wait", job_id="job-123"),
                 ("GET", JOB): {"job_id": "job-123", "status": "completed"}}
    with private_api(responses) as (url, calls):
        assert cli.main(["--api-url", url, "create", "episode-one", "--locale", "en"], output=lambda _: None) == 0
    assert all(method == "GET" for method, _, _ in calls)


def test_preflight_missing_requirements_stops_creation():
    responses = {("GET", VIDEO + "/en-US/preflight"): preflight(ready=False, issues=[{"message": "Falta el medio original"}])}
    with private_api(responses) as (url, calls):
        assert cli.main(["--api-url", url, "create", "episode-one", "--locale", "en"], output=lambda _: None) == 3
    assert len(calls) == 1


@pytest.mark.parametrize("status,detail", [(422, {"detail": "token=private-value /home/alfred/private/file"}),
                                           (401, {"detail": "secret=private-value"}), (500, "not json")])
def test_http_failures_are_nonzero_sanitized_and_not_retried(status, detail):
    events = []
    with private_api({("GET", JOB): (status, detail)}) as (url, calls):
        assert cli.main(["--api-url", url, "status", "job-123"], output=events.append) == 1
    assert len(calls) == 1 and events[-1]["http_status"] == status
    encoded = json.dumps(events)
    assert "private-value" not in encoded and "/home/alfred" not in encoded


@pytest.mark.parametrize("bad", ["../escape", "episode/other", "id?token=secret", "a%2Fb", "" ])
def test_identifier_validation_precedes_network_access(bad):
    def no_client(*args, **kwargs):
        raise AssertionError("must not reach network")
    with pytest.raises(SystemExit) as exc:
        cli.main(["create", bad, "--locale", "en"], client_factory=no_client)
    assert exc.value.code == 2


def test_wait_timeout_preserves_job_without_cancel_or_duplicate_request():
    elapsed, sleeps, calls, events = [0], [], [], []
    def status(job_id, **kwargs):
        calls.append(job_id)
        return {"job_id": job_id, "status": "running", "stage": "voice", "resumable": True}
    def sleep(seconds):
        sleeps.append(seconds)
        elapsed[0] += seconds
    result = cli.wait_for_job(SimpleNamespace(status=status), "job-123", timeout=5, interval=2,
                              output=events.append, clock=lambda: elapsed[0], sleep=sleep)
    assert result == 124 and sleeps == [2, 2, 1] and len(calls) == 3
    assert events[-1]["event"] == "wait_timeout" and events[-1]["job"]["job_id"] == "job-123"
    assert events[-1]["job"]["resumable"] is True and events[-1]["continues_on_server"] is True


def test_failed_job_wait_returns_nonzero_with_sanitized_recovery_state():
    events = []
    client = SimpleNamespace(status=lambda _, **kwargs: {"job_id": "job-123", "status": "failed", "resumable": True,
                                               "error": "api_key=private-value /tmp/private/log"})
    assert cli.wait_for_job(client, "job-123", output=events.append) == 1
    assert events[-1]["next_action"] == "resume"
    assert "private-value" not in json.dumps(events) and "/tmp/private" not in json.dumps(events)


def test_ctrl_c_keeps_api_owned_job_id_and_does_not_cancel(monkeypatch):
    events = []
    client = SimpleNamespace(preflight=lambda *args: preflight(),
                             create=lambda *args: {"job_id": "job-123", "status": "queued"})
    def interrupt(*args, **kwargs):
        raise KeyboardInterrupt
    monkeypatch.setattr(cli, "wait_for_job", interrupt)
    assert cli.main(["create", "episode-one", "--locale", "en", "--wait"],
                    client_factory=lambda *args, **kwargs: client, output=events.append) == 130
    assert events[-1]["job_id"] == "job-123" and events[-1]["continues_on_server"] is True


def test_show_keeps_legacy_arguments_json_and_never_opens_http(monkeypatch, capsys):
    captured = {}
    def build(**values):
        captured.update(values)
        return SimpleNamespace(model_dump_json=lambda **kwargs: '{"schema": "nexa.edition/1"}')
    monkeypatch.setitem(sys.modules, "src.core.explainer.editions.resolver", SimpleNamespace(build_edition=build))
    assert cli.main(["show", "--production", "/tmp/legacy", "--locale", "en-US", "--revision", "rev-003", "--format", "16x9", "--duration-seconds", "45"],
                    client_factory=lambda *args, **kwargs: pytest.fail("HTTP is forbidden")) == 0
    assert json.loads(capsys.readouterr().out) == {"schema": "nexa.edition/1"}
    assert captured == {"production": "/tmp/legacy", "locale": "en-US", "revision": "rev-003", "format_id": "16x9", "duration_seconds": 45}


def test_network_failure_is_sanitized_and_does_not_retry():
    from urllib.error import URLError
    client = EditionClient()
    attempts = []
    def fail(*args, **kwargs):
        attempts.append(True)
        raise URLError("password=private-value")
    client.opener = SimpleNamespace(open=fail)
    with pytest.raises(APIClientError, match="No se pudo confirmar") as exc:
        client.create("episode-one", "en-US")
    assert len(attempts) == 1 and "private-value" not in str(exc.value)


def test_wait_request_timeout_is_bounded_by_remaining_local_deadline():
    elapsed, timeouts, events = [0], [], []
    def timeout(job_id, **kwargs):
        timeouts.append(kwargs["timeout"])
        elapsed[0] += kwargs["timeout"]
        raise APIClientError("No se confirmó la respuesta")
    client = SimpleNamespace(status=timeout, timeout=15)
    assert cli.wait_for_job(client, "job-123", timeout=2, clock=lambda: elapsed[0], output=events.append) == 124
    assert timeouts == [2] and events[-1]["job"]["job_id"] == "job-123"

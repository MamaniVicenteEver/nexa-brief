"""Orquestación de fases sin agentes, voz, Whisper ni render reales."""
import json
import os
import subprocess
import sys

import pytest

from src.core.explainer.producer import _read_phase, _script_hash, _validate_script, _write_phase
from tests.unit.test_explainer_production import _producer


@pytest.mark.parametrize("agent_name", ["codex", "claude"])
async def test_full_pipeline_and_usage(tmp_path, agent_name):
    producer, agent, kit, videos = _producer(tmp_path)
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Fases completas", agent=agent_name)
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "ready", final["error"]
    assert [c[0] for c in kit.calls] == ["new", "voice", "transcribe", "check", "manifest", "poster"]
    assert len(agent.runs) == 2
    assert "FASE GUION" in agent.runs[0]["prompt"] and "FASE STORYBOARD" in agent.runs[1]["prompt"]
    assert "NUNCA ejecutes voice" in agent.runs[1]["prompt"]
    scope = agent.runs[0]["scope"]
    assert scope.extra_env["NEXA_EXPLAINER_PIPELINE_AGENT"] == "1"
    assert not any(c.endswith((" voice", " transcribe", " preview", " outro")) for c in scope.commands)
    assert "kit.py preview " not in agent.runs[0]["prompt"]
    video = videos / rec["video_id"]
    assert _read_phase(video)["script_sha256"] == _script_hash(video)
    usage = json.loads((video / "usage.json").read_text())
    assert {row["step"] for row in usage["timeline"]} >= {"guion", "storyboard"}
    assert "host voice" in producer.log_tail(rec["production_id"])
    assert final["phase"] == "ready"


@pytest.mark.parametrize("failed_step,remaining", [("voice", ["voice", "transcribe"]), ("transcribe", ["transcribe"])])
async def test_resume_after_host_failure(tmp_path, failed_step, remaining):
    producer, agent, kit, videos = _producer(tmp_path)
    real_kit = producer._kit
    fail_once = True
    async def failing(args):
        nonlocal fail_once
        if args[0] == failed_step and fail_once:
            fail_once = False
            kit.calls.append(args)
            return 1, "simulated failure"
        return await real_kit(args)
    producer._kit = failing
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Interrupción de audio")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "failed" and failed_step in final["error"]
    assert len(agent.runs) == 1
    assert _read_phase(videos / rec["video_id"])["phase"] == ("voice_ready" if failed_step == "transcribe" else "script_ready")
    count = len(kit.calls)
    await producer.resume(rec["production_id"])
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "ready", final["error"]
    assert [c[0] for c in kit.calls[count:] if c[0] in ("voice", "transcribe")] == remaining
    assert len(agent.runs) == 2


async def test_empty_storyboard_gets_one_rescue(tmp_path):
    producer, agent, kit, videos = _producer(tmp_path)
    original = agent.run
    async def first_empty(prompt, **kwargs):
        if "FASE STORYBOARD" in prompt and "STORYBOARD DE RESCATE" not in prompt:
            agent.finish = False
        else:
            agent.finish = True
        return await original(prompt, **kwargs)
    agent.run = first_empty
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Rescate storyboard")
    assert (await producer.wait(rec["production_id"]))["state"] == "ready"
    assert sum("STORYBOARD DE RESCATE" in run["prompt"] for run in agent.runs) == 1
    assert json.loads((videos / rec["video_id"] / "assets/storyboard.json").read_text())["beats"]


async def test_invalid_script_stops_before_host(tmp_path):
    producer, agent, kit, _ = _producer(tmp_path)
    original = agent.run
    async def broken(prompt, **kwargs):
        result = await original(prompt, **kwargs)
        if "FASE GUION" in prompt:
            path = tmp_path / "videos" / kwargs["scope"].writable_dir.rsplit("/", 1)[-1] / "assets" / "script.json"
            path.write_text(json.dumps({"target_minutes": 10, "segments": [{"id": "s", "text": "texto", "tone": "alarma", "act": "golpe", "intensity": 1}]}))
        return result
    agent.run = broken
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Guion inválido")
    final = await producer.wait(rec["production_id"])
    manifest = json.loads((tmp_path / "videos" / rec["video_id"] / "manifest.json").read_text())
    assert final["state"] == "incomplete" and manifest["status"] == "en progreso"
    assert "guion inválido" in " ".join(manifest["quality_issues"])
    assert not any(c[0] in ("voice", "transcribe") for c in kit.calls)


async def test_script_change_requests_new_host_pass(tmp_path):
    producer, agent, kit, videos = _producer(tmp_path)
    original = agent.run
    changed = False
    async def revise(prompt, **kwargs):
        nonlocal changed
        result = await original(prompt, **kwargs)
        if "FASE STORYBOARD" in prompt and not changed:
            changed = True
            video = videos / kwargs["scope"].writable_dir.rsplit("/", 1)[-1]
            script_path = video / "assets" / "script.json"
            script = json.loads(script_path.read_text())
            script["segments"][1]["text"] += " Otro hecho."
            script_path.write_text(json.dumps(script))
            _write_phase(video, "script_ready")
        return result
    agent.run = revise
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Cambio de guion")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "ready", final["error"]
    assert [c[0] for c in kit.calls].count("voice") == 2
    assert [c[0] for c in kit.calls].count("transcribe") == 2
    assert len(agent.runs) == 3


def test_narrative_validation_checks_question_and_order(tmp_path):
    (tmp_path / "assets").mkdir()
    (tmp_path / "assets" / "config.json").write_text(json.dumps({"narrative_id": "narrative_amarillista_v1"}))
    (tmp_path / "assets" / "script.json").write_text(json.dumps({"segments": [{"id": "s", "act": "golpe", "tone": "alarma", "intensity": 1, "text": "Tu voz en tres segundos."}]}))
    errors = " ".join(_validate_script(tmp_path))
    assert "on_screen_question" in errors and "actos" in errors


async def test_qc_context_is_given_to_storyboard(tmp_path):
    producer, agent, kit, videos = _producer(tmp_path)
    real_kit = producer._kit
    async def with_qc(args):
        result = await real_kit(args)
        if args[0] == "voice":
            (videos / args[1] / "work" / "narration.qc.json").write_text(json.dumps({"faltan": ["palabra difícil"]}))
        return result
    producer._kit = with_qc
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Control de voz")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "ready", final["error"]
    assert "palabra difícil" in agent.runs[1]["prompt"]


async def test_failed_quality_check_gets_one_repair(tmp_path):
    producer, agent, kit, videos = _producer(tmp_path)
    real_kit = producer._kit
    async def bad_check(args):
        if args[0] == "check":
            kit.calls.append(args)
            return 1, "✗ quality error"
        return await real_kit(args)
    producer._kit = bad_check
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Control de calidad")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "incomplete"
    assert sum("REPARACIÓN ÚNICA" in run["prompt"] for run in agent.runs) == 1
    assert "quality error" in agent.runs[-1]["prompt"]
    manifest = json.loads((videos / rec["video_id"] / "manifest.json").read_text())
    assert manifest["status"] == "en progreso" and any("quality error" in issue for issue in manifest["quality_issues"])
    assert not any(call[0] == "poster" for call in kit.calls)


async def test_observations_reach_video_api(tmp_path, monkeypatch):
    from types import SimpleNamespace
    from src.core.explainer.catalog import load_video
    from src.presentation.api.routers import explainer
    producer, _, kit, videos = _producer(tmp_path)
    original = producer._kit
    async def check(args):
        if args[0] == "check":
            return 1, "  ✗ ancla fuera de orden"
        return await original(args)
    producer._kit = check
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Revisión web")
    await producer.wait(rec["production_id"])
    monkeypatch.setattr(explainer, "get_recorder", lambda: SimpleNamespace(latest_for_video=lambda _: None))
    monkeypatch.setattr(explainer, "TEMPLATES_DIR", videos)
    response = explainer._video_response(load_video(videos / rec["video_id"]))
    assert not response.ready and response.status == "en progreso"
    assert any("ancla fuera de orden" in issue for issue in response.quality_issues)




@pytest.mark.parametrize("command", ["voice", "transcribe", "outro", "preview"])
def test_pipeline_agent_kit_blocks_host_commands_before_finding_video(command):
    from src.core.explainer.producer import KIT_CLI
    result = subprocess.run([sys.executable, str(KIT_CLI), command, "no-existe"],
                            env={**os.environ, "NEXA_EXPLAINER_PIPELINE_AGENT": "1"},
                            capture_output=True, text=True)
    assert result.returncode != 0
    assert "corresponde al host" in result.stderr


@pytest.mark.parametrize("step,missing", [("voice", "song.mp3"), ("transcribe", "lyrics.json")])
async def test_host_success_without_required_output_does_not_advance(tmp_path, step, missing):
    producer, agent, kit, videos = _producer(tmp_path)
    real_kit = producer._kit
    async def no_output(args):
        if args[0] == step:
            kit.calls.append(args)
            return 0, "no artifact"
        return await real_kit(args)
    producer._kit = no_output
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Salida de host ausente")
    result = await producer.wait(rec["production_id"])
    assert result["state"] == "failed" and missing in result["error"]
    assert _read_phase(videos / rec["video_id"])["phase"] == ("script_ready" if step == "voice" else "voice_ready")
    assert len(agent.runs) == 1

async def test_host_writes_missing_script_marker(tmp_path):
    producer, agent, kit, videos = _producer(tmp_path)
    original = agent.run
    async def forget(prompt, **kwargs):
        result = await original(prompt, **kwargs)
        if "FASE GUION" in prompt:
            (videos / kwargs["scope"].writable_dir.rsplit("/", 1)[-1] / "work/phase.json").unlink()
        return result
    agent.run = forget
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Sin marcador")
    assert (await producer.wait(rec["production_id"]))["state"] == "ready"
    assert [c[0] for c in kit.calls][1:3] == ["voice", "transcribe"]


async def test_token_budget_closes_without_another_agent_run(tmp_path, monkeypatch):
    from src.core.explainer import producer as module
    producer, agent, _, videos = _producer(tmp_path)
    monkeypatch.setattr(module, "_policy", lambda: {"max_agent_runs_total": 4, "max_agent_runs_per_phase": 2, "max_tokens": 10})
    original = agent.run
    async def costly(*args, **kwargs):
        result = await original(*args, **kwargs)
        result.usage = {"input_tokens": 10, "output_tokens": 1}
        return result
    agent.run = costly
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Presupuesto")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "incomplete" and len(agent.runs) == 1
    assert any("presupuesto agotado" in i for i in json.loads((videos / rec["video_id"] / "manifest.json").read_text())["quality_issues"])


async def test_failed_agent_same_input_does_not_loop(tmp_path):
    from src.core.ports.agent_port import AgentRunResult
    producer, agent, _, videos = _producer(tmp_path)
    original = agent.run
    async def failed_storyboard(prompt, **kwargs):
        result = await original(prompt, **kwargs)
        if "FASE STORYBOARD" in prompt:
            result = AgentRunResult(exit_code=1, last_message="fallo fijo", duration_seconds=1)
        return result
    agent.run = failed_storyboard
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Sin bucle")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "ready"
    assert sum("FASE STORYBOARD" in r["prompt"] for r in agent.runs) == 1
    assert final["agent_failure"]["fingerprint"]


async def test_historical_ledger_budget_blocks_resume_without_new_agent(tmp_path):
    from src.core.explainer.usage import _tool
    producer, agent, kit, videos = _producer(tmp_path)
    original = agent.run
    async def old_expensive_run(prompt, **kwargs):
        result = await original(prompt, **kwargs)
        video = videos / kwargs["scope"].writable_dir.rsplit("/", 1)[-1]
        _tool().record(video, provider="codex", role="producer", step="legacy",
                       input_tokens=4_000_000)
        return result
    agent.run = old_expensive_run
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Consumo histórico")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "incomplete" and len(agent.runs) == 1
    issues = json.loads((videos / rec["video_id"] / "manifest.json").read_text())["quality_issues"]
    assert any("presupuesto agotado" in issue for issue in issues)


@pytest.mark.parametrize("historic_tokens", [45_000_000, 148_000_000])
async def test_old_failed_productions_do_not_spend_another_agent_run(tmp_path, historic_tokens):
    producer, agent, kit, videos = _producer(tmp_path)
    original = producer._kit
    async def fail_voice(args):
        if args[0] == "voice":
            return 1, "sin cuota"
        return await original(args)
    producer._kit = fail_voice
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Retoma histórica")
    assert (await producer.wait(rec["production_id"]))["state"] == "failed"
    await producer._update(rec["production_id"], usage_totals={"input_tokens": historic_tokens})
    producer._kit = original
    await producer.resume(rec["production_id"])
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "incomplete" and len(agent.runs) == 1
    issues = json.loads((videos / rec["video_id"] / "manifest.json").read_text())["quality_issues"]
    assert any("presupuesto agotado" in issue for issue in issues)


async def test_failed_storyboard_gets_different_rescue_once(tmp_path):
    from src.core.ports.agent_port import AgentRunResult
    producer, agent, kit, videos = _producer(tmp_path)
    original = agent.run
    async def fail_then_rescue(prompt, **kwargs):
        if "FASE STORYBOARD" in prompt and "STORYBOARD DE RESCATE" not in prompt:
            agent.finish = False
            await original(prompt, **kwargs)
            agent.finish = True
            return AgentRunResult(exit_code=1, last_message="componente falló", duration_seconds=1)
        return await original(prompt, **kwargs)
    agent.run = fail_then_rescue
    rec = await producer.submit(category_path="node_tech", design="rough", topic="Rescate tras fallo")
    final = await producer.wait(rec["production_id"])
    assert final["state"] == "ready"
    assert sum("STORYBOARD DE RESCATE" in run["prompt"] for run in agent.runs) == 1
    assert json.loads((videos / rec["video_id"] / "assets/storyboard.json").read_text())["beats"]

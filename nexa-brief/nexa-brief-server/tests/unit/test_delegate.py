"""Delegaciones del kit con un Codex falso: sin peticiones de modelo ni claves reales."""

from __future__ import annotations

import json
import stat
import sys
from pathlib import Path

import pytest

TOOLS = Path(__file__).parents[2] / "src" / "templates" / "_tools" / "explainer-kit" / "tools"
sys.path.insert(0, str(TOOLS))
import delegate  # noqa: E402
import kit as explainer_kit  # noqa: E402

from src.adapters.models import hub  # noqa: E402


FAKE_CODEX = r'''#!{python}
import json, os, sys
args = sys.argv[1:]
prompt = sys.stdin.read()
record = {{
    "args": args,
    "prompt": prompt,
    "cwd": os.getcwd(),
    "api_env": {{key: os.environ.get(key) for key in ("OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL")}},
}}
with open(os.environ["FAKE_CODEX_ARGS"], "w") as f:
    json.dump(record, f)
if "-o" in args and os.environ.get("FAKE_CODEX_NO_OUTPUT") != "1":
    with open(args[args.index("-o") + 1], "w") as f:
        f.write(os.environ.get("FAKE_CODEX_REPLY", "## Borrador\n\nTexto de prueba."))
print(json.dumps({{"type": "turn.completed", "usage": {{
    "input_tokens": 123, "cached_input_tokens": 23, "output_tokens": 45, "reasoning_output_tokens": 12
}}}}))
sys.exit(int(os.environ.get("FAKE_CODEX_EXIT", "0")))
'''


@pytest.fixture
def video(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    video_dir = tmp_path / "video"
    (video_dir / "work").mkdir(parents=True)
    (video_dir / "work" / "pedido.md").write_text("Escribe un borrador breve.", encoding="utf-8")
    (video_dir / "PLAN.md").write_text("Hecho de contexto: la misión ocurrió en 1969.", encoding="utf-8")
    binary = tmp_path / "fake-codex"
    binary.write_text(FAKE_CODEX.format(python=sys.executable), encoding="utf-8")
    binary.chmod(binary.stat().st_mode | stat.S_IXUSR)
    monkeypatch.setenv("AGENT_CODEX_BIN", str(binary))
    monkeypatch.setenv("FAKE_CODEX_ARGS", str(video_dir / "work" / "fake-cli-args.json"))
    monkeypatch.setenv("OPENAI_API_KEY", "never-record-this")
    monkeypatch.setenv("CODEX_API_KEY", "never-record-this-either")
    monkeypatch.setenv("OPENAI_BASE_URL", "https://invalid.example")
    monkeypatch.setattr(delegate, "codex_runner", lambda: __import__(
        "src.adapters.agent.infrastructure.cli_runner", fromlist=["CodexRunner"]
    ).CodexRunner(str(binary)))
    return video_dir


def _entry(video_dir: Path) -> dict:
    return json.loads((video_dir / "work" / "usage.jsonl").read_text(encoding="utf-8").splitlines()[-1])


def test_hub_reports_explicit_codex_role_model():
    assert hub.model_for("text_draft") == "gpt-6.1-terra"
    assert hub.model_for("dialogue_draft") == "gpt-6.1-terra"
    described = {item["role"]: item for item in hub.describe()}
    assert described["text_draft"]["model"] == "gpt-6.1-terra"
    assert hub.model_for("component_draft") == "deepseek-v4-flash"


def test_terra_delegate_passes_model_effort_scope_and_records_output(video: Path):
    result = delegate.run(video, "text_draft", "work/pedido.md", "work/borrador.md", ["PLAN.md"])

    args_data = json.loads((video / "work" / "fake-cli-args.json").read_text(encoding="utf-8"))
    args = args_data["args"]
    assert result == video / "work" / "borrador.md"
    assert result.read_text(encoding="utf-8") == "## Borrador\n\nTexto de prueba.\n"
    assert "Hecho de contexto: la misión ocurrió en 1969." in args_data["prompt"]
    assert args_data["cwd"] == str(video)
    assert args[args.index("-C") + 1] == str(video)
    assert args[args.index("-s") + 1] == "workspace-write"
    assert args[args.index("-m") + 1] == "gpt-6.1-terra"
    config_args = [args[index + 1] for index, item in enumerate(args[:-1]) if item == "-c"]
    assert 'model_reasoning_effort="medium"' in config_args
    assert 'forced_login_method="chatgpt"' in config_args
    assert not any(item in ("--dangerously-bypass-approvals-and-sandbox", "--add-dir") for item in args)
    assert args_data["api_env"] == {"OPENAI_API_KEY": None, "CODEX_API_KEY": None, "OPENAI_BASE_URL": None}

    entry = _entry(video)
    assert (entry["provider"], entry["model"], entry["role"], entry["ok"]) == (
        "codex", "gpt-6.1-terra", "text_draft", True
    )
    assert entry["billing"] == "suscripción"
    assert (entry["input_tokens"], entry["cached_input_tokens"], entry["output_tokens"], entry["reasoning_tokens"]) == (
        123, 23, 45, 12
    )
    log = video / "work" / "delegate" / "text_draft-borrador.md-1.md"
    assert "## Respuesta\n\n## Borrador" in log.read_text(encoding="utf-8")


def test_kit_delegate_command_dispatches_to_codex(video: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(explainer_kit, "find_video", lambda _video_id: video)
    # El worker del kit vuelve a entrar en main con este descriptor heredado;
    # el test prueba el despacho dentro de ese proceso, sin buscar un video real.
    monkeypatch.setenv("NEXA_KIT_JOB_FD", "1")
    monkeypatch.setattr(sys, "argv", [
        "kit.py", "delegate", "video-prueba", "text_draft", "--prompt-file", "work/pedido.md",
        "--context", "PLAN.md", "--out", "work/desde-kit.md",
    ])

    explainer_kit.main()

    args_data = json.loads((video / "work" / "fake-cli-args.json").read_text(encoding="utf-8"))
    assert args_data["args"][args_data["args"].index("-m") + 1] == "gpt-6.1-terra"
    assert (video / "work" / "desde-kit.md").exists()
    assert _entry(video)["role"] == "text_draft"


def test_codex_failure_records_error_and_never_writes_requested_result(video: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FAKE_CODEX_EXIT", "4")
    target = video / "work" / "failed.md"
    with pytest.raises(SystemExit, match="Codex terminó con código 4"):
        delegate.run(video, "dialogue_draft", "work/pedido.md", "work/failed.md")

    assert not target.exists()
    entry = _entry(video)
    assert entry["provider"] == "codex" and entry["model"] == "gpt-6.1-terra"
    assert entry["role"] == "dialogue_draft" and entry["ok"] is False
    assert "Codex terminó con código 4" in entry["note"]
    assert "(sin resultado)" in (video / "work" / "delegate" / "dialogue_draft-failed.md-1.md").read_text()


def test_success_without_final_message_is_not_reported_as_a_result(video: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setenv("FAKE_CODEX_NO_OUTPUT", "1")
    target = video / "work" / "empty.md"
    with pytest.raises(SystemExit, match="sin una respuesta final"):
        delegate.run(video, "text_draft", "work/pedido.md", "work/empty.md")

    assert not target.exists()
    entry = _entry(video)
    assert entry["ok"] is False and entry["output_tokens"] == 45
    assert entry["note"] == "Codex terminó sin una respuesta final; no se escribió resultado"


def test_output_write_failure_is_recorded_as_failure(video: Path):
    (video / "work" / "blocked-parent").write_text("not a directory", encoding="utf-8")
    with pytest.raises(SystemExit, match="no se pudo escribir --out"):
        delegate.run(video, "text_draft", "work/pedido.md", "work/blocked-parent/output.md")

    entry = _entry(video)
    assert entry["ok"] is False and "FileExistsError" in entry["note"]
    assert not (video / "work" / "blocked-parent" / "output.md").exists()


def test_deepseek_delegate_contract_and_fenced_extraction_continue(video: Path, monkeypatch: pytest.MonkeyPatch):
    def fake_deepseek(model: str, system: str, request: str):
        assert model == "deepseek-v4-flash"
        assert "Escribe un borrador breve." in request and system
        return {
            "choices": [{"message": {"content": '```json\n{"titulo": "Prueba"}\n```'}}],
            "usage": {"prompt_tokens": 32, "completion_tokens": 9},
        }, 0.25

    monkeypatch.setattr(delegate, "ask_deepseek", fake_deepseek)
    result = delegate.run(video, "copy_draft", "work/pedido.md", "work/copy.json")
    assert result.read_text(encoding="utf-8") == '{"titulo": "Prueba"}\n'
    entry = _entry(video)
    assert (entry["provider"], entry["model"], entry["ok"]) == ("deepseek", "deepseek-v4-flash", True)
    assert entry["input_tokens"] == 32 and entry["output_tokens"] == 9


def test_non_delegatable_role_and_output_escape_are_rejected_before_call(video: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(delegate, "codex_runner", lambda: pytest.fail("Codex debe quedar sin invocar"))
    with pytest.raises(SystemExit, match="no admite delegación"):
        delegate.run(video, "producer", "work/pedido.md", "work/no.md")
    with pytest.raises(SystemExit, match="tiene que estar dentro"):
        delegate.run(video, "text_draft", "work/pedido.md", "../../outside.md")


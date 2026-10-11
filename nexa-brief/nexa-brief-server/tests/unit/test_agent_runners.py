"""Agentes locales (Claude Code / Codex) con CLIs falsos: argumentos, permisos acotados,
salida, timeout y el AIPort que los usa para JSON. Nunca llama a un agente real."""

from __future__ import annotations

import json
import stat
import sys
from pathlib import Path

import pytest

from src.adapters.agent.infrastructure.binaries import find_binary
from src.adapters.agent.infrastructure.cli_runner import ClaudeCodeRunner, CodexRunner
from src.adapters.ai.infrastructure.local_agent_ai_adapter import LocalAgentAIAdapter, parse_json_reply
from src.config.exceptions import AIGenerationError, AIValidationError
from src.core.ports.agent_port import AgentRunResult, AgentScope, AgentUnavailableError

FAKE = """#!{py}
import json, os, sys, time
args = sys.argv[1:]
prompt = sys.stdin.read()
open(os.environ.get("FAKE_ARGS", "/dev/null"), "w").write(json.dumps({{"args": args, "prompt": prompt, "cwd": os.getcwd(), "claudecode": os.environ.get("CLAUDECODE")}}))
if "SLEEP" in prompt:
    time.sleep(30)
reply = os.environ.get("FAKE_REPLY", "hola")
if "stream-json" in args:
    print(json.dumps({{"type": "assistant", "message": "pensando"}}))
    print(json.dumps({{"type": "result", "result": reply}}))
elif "-o" in args:
    open(args[args.index("-o") + 1], "w").write(reply)
    print("log de codex")
else:
    print(reply)
sys.exit(int(os.environ.get("FAKE_EXIT", "0")))
"""


@pytest.fixture
def fake_cli(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    path = tmp_path / "fake-agent"
    path.write_text(FAKE.format(py=sys.executable))
    path.chmod(path.stat().st_mode | stat.S_IXUSR)
    args_file = tmp_path / "args.json"
    monkeypatch.setenv("FAKE_ARGS", str(args_file))
    return path, args_file


def _args(args_file: Path) -> dict:
    return json.loads(args_file.read_text())


async def test_claude_read_only_mode_disallows_writes(fake_cli, tmp_path: Path, monkeypatch):
    binary, args_file = fake_cli
    monkeypatch.setenv("FAKE_REPLY", '{"ok": true}')
    result = await ClaudeCodeRunner(str(binary)).run("dame json", cwd=tmp_path, log_path=tmp_path / "a.log", timeout_seconds=20)
    assert result.ok and result.last_message == '{"ok": true}'
    seen = _args(args_file)
    assert seen["prompt"] == "dame json"  # el prompt va por stdin
    assert "--disallowedTools" in seen["args"]
    assert "Bash" not in seen["args"][: seen["args"].index("--disallowedTools")]


async def test_claude_scoped_mode_only_allows_scoped_tools(fake_cli, tmp_path: Path, monkeypatch):
    binary, args_file = fake_cli
    monkeypatch.setenv("FAKE_REPLY", "terminé")
    scope = AgentScope(writable_dir="videos/x", commands=("/py /kit.py",))
    result = await ClaudeCodeRunner(str(binary)).run(
        "producí", cwd=tmp_path, log_path=tmp_path / "p.log", timeout_seconds=20, scope=scope
    )
    assert result.last_message == "terminé"
    args = _args(args_file)["args"]
    assert "Edit(videos/x/**)" in args and "Write(videos/x/**)" in args
    assert "Bash(/py /kit.py:*)" in args
    assert "Bash" not in args  # nunca Bash sin restricción
    assert "Read(**/.env)" in args[args.index("--disallowedTools"):]
    assert "--dangerously-skip-permissions" not in args and "acceptEdits" not in args
    assert '"type": "assistant"' in (tmp_path / "p.log").read_text()  # el log muestra el progreso


async def test_codex_scoped_runs_inside_sandbox_dir(fake_cli, tmp_path: Path, monkeypatch):
    binary, args_file = fake_cli
    monkeypatch.setenv("FAKE_REPLY", "listo")
    (tmp_path / "sandbox").mkdir()
    scope = AgentScope(writable_dir="sandbox/videos/x", os_sandbox_dir="sandbox")
    result = await CodexRunner(str(binary)).run("producí", cwd=tmp_path, log_path=tmp_path / "c.log", timeout_seconds=20, scope=scope)
    assert result.last_message == "listo"
    args = _args(args_file)["args"]
    assert args[args.index("-C") + 1] == str(tmp_path / "sandbox")
    assert args[args.index("-s") + 1] == "workspace-write"
    assert "--dangerously-bypass-approvals-and-sandbox" not in args


async def test_codex_read_only(fake_cli, tmp_path: Path):
    binary, args_file = fake_cli
    await CodexRunner(str(binary)).run("hola", cwd=tmp_path, log_path=tmp_path / "c.log", timeout_seconds=20)
    args = _args(args_file)["args"]
    assert args[args.index("-s") + 1] == "read-only"


async def test_timeout_kills_the_agent(fake_cli, tmp_path: Path):
    binary, _ = fake_cli
    result = await ClaudeCodeRunner(str(binary)).run("SLEEP", cwd=tmp_path, log_path=tmp_path / "t.log", timeout_seconds=1)
    assert result.timed_out and not result.ok


async def test_missing_binary_raises(tmp_path: Path):
    with pytest.raises(AgentUnavailableError):
        await ClaudeCodeRunner("").run("x", cwd=tmp_path, log_path=tmp_path / "x.log", timeout_seconds=1)


def test_find_binary_respects_configured_path(fake_cli, tmp_path: Path):
    binary, _ = fake_cli
    assert find_binary("claude", str(binary)) == str(binary)
    assert find_binary("claude", str(tmp_path / "nope")) is None


def test_parse_json_reply_variants():
    assert parse_json_reply('```json\n{"a": 1}\n```') == {"a": 1}
    assert parse_json_reply('Aquí está: {"a": 2} listo') == {"a": 2}
    with pytest.raises(AIValidationError):
        parse_json_reply("sin json")


class _StubAgent:
    name = "stub"

    def __init__(self, replies: list[str], exit_code: int = 0) -> None:
        self.replies = replies
        self.exit_code = exit_code
        self.prompts: list[str] = []

    def available(self) -> bool:
        return True

    async def run(self, prompt, *, cwd, log_path, timeout_seconds, scope=None):
        assert scope is None  # el AIPort siempre es solo lectura
        self.prompts.append(prompt)
        return AgentRunResult(exit_code=self.exit_code, last_message=self.replies.pop(0), duration_seconds=0.1)


async def test_local_agent_adapter_retries_invalid_json(tmp_path: Path):
    agent = _StubAgent(["no es json", '{"ok": 1}'])
    adapter = LocalAgentAIAdapter(agent, cwd=tmp_path)
    assert await adapter.complete_json("sys", "user") == {"ok": 1}
    assert len(agent.prompts) == 2 and "no era JSON válido" in agent.prompts[1]


async def test_local_agent_adapter_reports_failure(tmp_path: Path):
    adapter = LocalAgentAIAdapter(_StubAgent(["boom"], exit_code=2), cwd=tmp_path)
    with pytest.raises(AIGenerationError):
        await adapter.complete_text("sys", "user")


async def test_runner_strips_nested_session_env(fake_cli, tmp_path: Path, monkeypatch):
    """Si el servidor corre dentro de una sesión de Claude Code, el agente igual arranca."""
    binary, args_file = fake_cli
    monkeypatch.setenv("CLAUDECODE", "1")
    await ClaudeCodeRunner(str(binary)).run("x", cwd=tmp_path, log_path=tmp_path / "e.log", timeout_seconds=20)
    assert _args(args_file)["claudecode"] is None

"""Agentes por CLI local: Claude Code (`claude -p`) y Codex (`codex exec`).

Toda la salida (stdout+stderr) se escribe en `log_path` mientras corre, así
la web puede mostrar la cola del log. Al vencer el timeout se mata el grupo
de procesos completo (el agente puede haber lanzado subprocesos).
"""

from __future__ import annotations

import asyncio
import json
import os
import signal
import time
from pathlib import Path

import structlog

from src.adapters.agent.infrastructure.binaries import find_binary
from src.config.settings import settings
from src.core.ports.agent_port import (
    AgentRunnerPort,
    AgentRunResult,
    AgentScope,
    AgentUnavailableError,
)

logger = structlog.get_logger(__name__)

# Variables que hacen que `claude` se niegue a arrancar "dentro de otra sesión".
_STRIP_ENV = ("CLAUDECODE", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_SSE_PORT")
# Codex corre SOLO con la sesión de ChatGPT de la máquina (suscripción), nunca por API:
# sin estas variables y con forced_login_method=chatgpt no puede caer en una clave de API.
CODEX_API_ENV = ("OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL")

CLAUDE_READ_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]
# La voz y la transcripción (Whisper large-v3 en CPU) tardan varios minutos:
# el límite por defecto de la herramienta Bash de Claude Code (2 min) las cortaría.
# El agente nunca lee claves ni cuentas: el kit las lee solo cuando las necesita.
CLAUDE_SECRET_DENY = ["Read(**/.env)", "Read(**/.env.*)", "Read(**/accounts.json)", "Read(**/client_secret.json)"]
LONG_COMMAND_ENV = {"BASH_DEFAULT_TIMEOUT_MS": "1800000", "BASH_MAX_TIMEOUT_MS": "3600000"}


def claude_scoped_tools(
    writable_dir: str,
    commands: list[str],
    extra_writable: tuple[str, ...] = (),
) -> list[str]:
    """Permisos acotados para un agente sin supervisión (rutas relativas a `cwd`).

    Solo escribe dentro de `writable_dir` y solo corre los `commands` dados
    (prefijos). Todo lo demás se rechaza solo en modo -p, sin preguntar.
    En las reglas de Claude Code una ruta absoluta se escribe `//ruta`.
    """
    if writable_dir.startswith("/"):
        writable_dir = "//" + writable_dir.lstrip("/")
    extra_paths = [
        f"//{path.lstrip('/')}" if path.startswith("/") else path
        for path in extra_writable
    ]
    bash_rules = [
        f"Bash({command}{'*' if command.endswith('/') else ' *'})"
        for command in commands
    ]
    return [
        *CLAUDE_READ_TOOLS,
        f"Edit({writable_dir}/**)",
        f"Write({writable_dir}/**)",
        *(f"Edit({path}/**)" for path in extra_paths),
        *(f"Write({path}/**)" for path in extra_paths),
        *bash_rules,
    ]


def _tail(path: Path, chars: int = 4000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")[-chars:]
    except OSError:
        return ""


def codex_usage(log_path: Path) -> dict:
    """Suma el uso de los eventos `turn.completed` de un log `codex exec --json`."""
    total = {"input_tokens": 0, "cached_input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0, "turns": 0}
    try:
        lines = log_path.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return {}
    for line in lines:
        if '"turn.completed"' not in line:
            continue
        try:
            usage = json.loads(line).get("usage") or {}
        except ValueError:
            continue
        total["turns"] += 1
        total["input_tokens"] += int(usage.get("input_tokens") or 0)
        total["cached_input_tokens"] += int(usage.get("cached_input_tokens") or 0)
        total["output_tokens"] += int(usage.get("output_tokens") or 0)
        total["reasoning_tokens"] += int(usage.get("reasoning_output_tokens") or 0)
    return total if total["turns"] else {}


def claude_usage(log_path: Path) -> tuple[dict, str]:
    """(uso, modelo) del evento `result` de un log stream-json de Claude Code."""
    for line in reversed(_tail(log_path, 400_000).splitlines()):
        if '"type":"result"' not in line.replace(" ", ""):
            continue
        try:
            event = json.loads(line)
        except ValueError:
            continue
        usage = event.get("usage") or {}
        models = list((event.get("modelUsage") or {}).keys())
        return {
            "input_tokens": int(usage.get("input_tokens") or 0) + int(usage.get("cache_creation_input_tokens") or 0),
            "cached_input_tokens": int(usage.get("cache_read_input_tokens") or 0),
            "output_tokens": int(usage.get("output_tokens") or 0),
            "reasoning_tokens": 0,
            "turns": int(event.get("num_turns") or 0),
            "cost_usd": event.get("total_cost_usd"),
        }, ", ".join(models)
    return {}, ""


def _stream_json_result(log_path: Path) -> str:
    """Texto final de un log `--output-format stream-json` (evento type=result)."""
    for line in reversed(_tail(log_path, 200_000).splitlines()):
        if '"type":"result"' in line.replace(" ", ""):
            try:
                return str(json.loads(line).get("result") or "")
            except ValueError:
                continue
    return _tail(log_path, 4000)


async def run_cli(
    cmd: list[str],
    *,
    cwd: Path,
    log_path: Path,
    timeout_seconds: float,
    stdin_text: str | None = None,
    stdout_path: Path | None = None,
    extra_env: dict[str, str] | None = None,
    strip_env: tuple[str, ...] = (),
) -> tuple[int, bool, float]:
    """Corre `cmd` con la salida al log (o stdout aparte en `stdout_path`).

    Devuelve (exit_code, timed_out, segundos).
    """
    log_path.parent.mkdir(parents=True, exist_ok=True)
    env = {k: v for k, v in os.environ.items() if k not in _STRIP_ENV + strip_env} | (extra_env or {})
    started = time.monotonic()
    with log_path.open("ab") as log, (stdout_path.open("wb") if stdout_path else log) as out:
        log.write(f"$ {' '.join(cmd[:6])} …\n".encode())
        log.flush()
        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(cwd),
            stdin=asyncio.subprocess.PIPE if stdin_text is not None else asyncio.subprocess.DEVNULL,
            stdout=out,
            stderr=log,
            env=env,
            start_new_session=True,
        )
        try:
            if stdin_text is not None:
                proc.stdin.write(stdin_text.encode())
                await proc.stdin.drain()
                proc.stdin.close()
            await asyncio.wait_for(proc.wait(), timeout=timeout_seconds)
            timed_out = False
        except (asyncio.TimeoutError, asyncio.CancelledError) as exc:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            await proc.wait()
            if isinstance(exc, asyncio.CancelledError):
                raise
            timed_out = True
    return proc.returncode if proc.returncode is not None else -1, timed_out, time.monotonic() - started


class ClaudeCodeRunner(AgentRunnerPort):
    name = "claude"

    def __init__(self, binary: str | None = None) -> None:
        self._binary = binary if binary is not None else find_binary("claude", settings.agent_claude_bin)

    def available(self) -> bool:
        return bool(self._binary)

    async def run(
        self,
        prompt: str,
        *,
        cwd: Path,
        log_path: Path,
        timeout_seconds: float,
        scope: AgentScope | None = None,
    ) -> AgentRunResult:
        if not self._binary:
            raise AgentUnavailableError("No se encontró el CLI `claude` (definir AGENT_CLAUDE_BIN).")
        # El prompt va por stdin: los prompts largos no entran bien como argumento.
        if scope is not None:
            # stream-json: el log muestra cada paso del agente mientras trabaja.
            tools = claude_scoped_tools(scope.writable_dir, list(scope.commands), scope.extra_writable)
            cmd = [
                self._binary, "-p", "--output-format", "stream-json", "--verbose",
                "--allowedTools", *tools, "--disallowedTools", *CLAUDE_SECRET_DENY,
            ]
            if scope.model:
                cmd += ["--model", scope.model]
            if scope.reasoning_effort:
                cmd += ["--effort", scope.reasoning_effort]
            code, timed_out, secs = await run_cli(
                cmd,
                cwd=cwd,
                log_path=log_path,
                timeout_seconds=timeout_seconds,
                stdin_text=prompt,
                extra_env=LONG_COMMAND_ENV,
            )
            last = _stream_json_result(log_path)
            usage, model = claude_usage(log_path)
        else:
            usage, model = {}, ""
            out_path = log_path.with_suffix(".last.txt")
            cmd = [
                self._binary, "-p", "--output-format", "text",
                "--allowedTools", *CLAUDE_READ_TOOLS, "--disallowedTools", "Bash", "Write", "Edit", *CLAUDE_SECRET_DENY,
            ]
            code, timed_out, secs = await run_cli(
                cmd,
                cwd=cwd,
                log_path=log_path,
                timeout_seconds=timeout_seconds,
                stdin_text=prompt,
                stdout_path=out_path,
            )
            last = _tail(out_path, 20000)
            with log_path.open("a", encoding="utf-8") as log:
                log.write(last + "\n")
        return AgentRunResult(exit_code=code, last_message=last.strip(), duration_seconds=secs, timed_out=timed_out,
                              usage=usage, model=model)


class CodexRunner(AgentRunnerPort):
    name = "codex"

    def __init__(self, binary: str | None = None) -> None:
        self._binary = binary if binary is not None else find_binary("codex", settings.agent_codex_bin)

    def available(self) -> bool:
        return bool(self._binary)

    async def run(
        self,
        prompt: str,
        *,
        cwd: Path,
        log_path: Path,
        timeout_seconds: float,
        scope: AgentScope | None = None,
    ) -> AgentRunResult:
        if not self._binary:
            raise AgentUnavailableError("No se encontró el CLI `codex` (definir AGENT_CODEX_BIN).")
        last_path = log_path.with_suffix(".last.txt")
        last_path.unlink(missing_ok=True)
        if scope is not None:
            # Sandbox de Codex: solo escribe en scope.writable_dir. La red queda
            # habilitada porque el kit investiga y pide la voz a Gemini.
            # Codex escribe en su directorio de trabajo: se lo ubica en la carpeta
            # permitida (los comandos del prompt usan rutas absolutas).
            workdir = cwd / (scope.os_sandbox_dir or scope.writable_dir)
            # --json: el log trae cada paso y el uso de tokens de cada vuelta (turn.completed).
            cmd = [
                self._binary, "exec", "--json", "--skip-git-repo-check", "-C", str(workdir), "-o", str(last_path),
                "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true",
            ]
            if scope.extra_writable:
                roots = ", ".join(json.dumps(r) for r in scope.extra_writable)
                cmd += ["-c", f"sandbox_workspace_write.writable_roots=[{roots}]"]
        else:
            cmd = [self._binary, "exec", "--json", "--skip-git-repo-check", "-C", str(cwd), "-o", str(last_path), "-s", "read-only"]
        cmd += ["-c", 'forced_login_method="chatgpt"']
        model = (scope.model if scope is not None else None) or settings.agent_codex_model
        effort = (scope.reasoning_effort if scope is not None else None) or settings.agent_codex_reasoning_effort
        if model:
            cmd += ["-m", model]
        if effort:
            cmd += ["-c", f"model_reasoning_effort={json.dumps(effort)}"]
        cmd.append("-")  # prompt por stdin
        code, timed_out, secs = await run_cli(
            cmd, cwd=cwd, log_path=log_path, timeout_seconds=timeout_seconds, stdin_text=prompt,
            strip_env=CODEX_API_ENV,
        )
        last = _tail(last_path, 20000) or _tail(log_path, 4000)
        return AgentRunResult(exit_code=code, last_message=last.strip(), duration_seconds=secs, timed_out=timed_out,
                              usage=codex_usage(log_path), model=model or "codex (modelo por defecto)")

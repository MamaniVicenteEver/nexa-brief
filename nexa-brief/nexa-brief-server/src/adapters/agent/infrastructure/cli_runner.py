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

CLAUDE_READ_TOOLS = ["Read", "Glob", "Grep", "WebSearch", "WebFetch"]
# La voz y la transcripción (Whisper large-v3 en CPU) tardan varios minutos:
# el límite por defecto de la herramienta Bash de Claude Code (2 min) las cortaría.
# El agente nunca lee claves ni cuentas: el kit las lee solo cuando las necesita.
CLAUDE_SECRET_DENY = ["Read(**/.env)", "Read(**/.env.*)", "Read(**/accounts.json)", "Read(**/client_secret.json)"]
LONG_COMMAND_ENV = {"BASH_DEFAULT_TIMEOUT_MS": "1800000", "BASH_MAX_TIMEOUT_MS": "3600000"}


def claude_scoped_tools(writable_dir: str, commands: list[str]) -> list[str]:
    """Permisos acotados para un agente sin supervisión (rutas relativas a `cwd`).

    Solo escribe dentro de `writable_dir` y solo corre los `commands` dados
    (prefijos). Todo lo demás se rechaza solo en modo -p, sin preguntar.
    En las reglas de Claude Code una ruta absoluta se escribe `//ruta`.
    """
    if writable_dir.startswith("/"):
        writable_dir = "/" + writable_dir
    return [
        *CLAUDE_READ_TOOLS,
        f"Edit({writable_dir}/**)",
        f"Write({writable_dir}/**)",
        *(f"Bash({c}:*)" for c in commands),
    ]


def _tail(path: Path, chars: int = 4000) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="replace")[-chars:]
    except OSError:
        return ""


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
) -> tuple[int, bool, float]:
    """Corre `cmd` con la salida al log (o stdout aparte en `stdout_path`).

    Devuelve (exit_code, timed_out, segundos).
    """
    log_path.parent.mkdir(parents=True, exist_ok=True)
    env = {k: v for k, v in os.environ.items() if k not in _STRIP_ENV} | (extra_env or {})
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
            tools = claude_scoped_tools(scope.writable_dir, list(scope.commands))
            cmd = [
                self._binary, "-p", "--output-format", "stream-json", "--verbose",
                "--allowedTools", *tools, "--disallowedTools", *CLAUDE_SECRET_DENY,
            ]
            code, timed_out, secs = await run_cli(
                cmd,
                cwd=cwd,
                log_path=log_path,
                timeout_seconds=timeout_seconds,
                stdin_text=prompt,
                extra_env=LONG_COMMAND_ENV,
            )
            last = _stream_json_result(log_path)
        else:
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
        return AgentRunResult(exit_code=code, last_message=last.strip(), duration_seconds=secs, timed_out=timed_out)


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
            cmd = [
                self._binary, "exec", "--skip-git-repo-check", "-C", str(workdir), "-o", str(last_path),
                "-s", "workspace-write", "-c", "sandbox_workspace_write.network_access=true",
            ]
            if scope.extra_writable:
                roots = ", ".join(json.dumps(r) for r in scope.extra_writable)
                cmd += ["-c", f"sandbox_workspace_write.writable_roots=[{roots}]"]
        else:
            cmd = [self._binary, "exec", "--skip-git-repo-check", "-C", str(cwd), "-o", str(last_path), "-s", "read-only"]
        cmd.append("-")  # prompt por stdin
        code, timed_out, secs = await run_cli(
            cmd, cwd=cwd, log_path=log_path, timeout_seconds=timeout_seconds, stdin_text=prompt
        )
        last = _tail(last_path, 20000) or _tail(log_path, 4000)
        return AgentRunResult(exit_code=code, last_message=last.strip(), duration_seconds=secs, timed_out=timed_out)

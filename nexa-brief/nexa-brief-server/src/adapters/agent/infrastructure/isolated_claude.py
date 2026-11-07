"""File-only Claude runner. Bash, web, MCP, plugins and hooks are unavailable.

The workspace must be exclusively prepared for one run and contain no secrets,
symlinks, hardlinks, special files or other profile data. CLI and authentication
configuration are explicitly selected by the supervisor. Version/hash pinning
prevents a changed executable from silently inheriting this tested policy.
"""
from __future__ import annotations

import asyncio
from contextlib import suppress
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import stat
import tempfile
import time

from src.core.ports.agent_port import (
    AgentIsolationUnavailableError,
    AgentRunResult,
    AgentScope,
    IsolatedAgentRunnerPort,
)

_PRIVATE = re.compile(r'^(?:\.env(?:\..*)?|\.git|\.claude|\.system|\.ssh|\.aws|'
                      r'accounts(?:\..*)?|users(?:\..*)?|client_secret.*|'
                      r'sessions?|browser_profiles|connections|web-data|data|.*(?:secret|token|credential|password).*|.*\.(?:key|pem|p12|pfx))$', re.I)
_SHA = re.compile(r'^[a-f0-9]{64}$')


def candidate_settings() -> dict:
    return {
        'permissions': {'blockReadsOutsideWorkingDirectories': True,
                        'disableBypassPermissionsMode': 'disable'},
        # Defense in depth: should a code-running tool ever be introduced,
        # unavailable sandbox dependencies fail closed.
        'sandbox': {'enabled': True, 'autoAllowBashIfSandboxed': False,
                    'allowUnsandboxedCommands': False, 'failIfUnavailable': True,
                    'network': {'allowedDomains': []}},
        'disableClaudeAiConnectors': True,
    }


def candidate_argv(binary: Path, *, read_only: bool = False) -> list[str]:
    if not binary.is_absolute():
        raise ValueError('Claude binary must be an absolute path')
    names = ['Read', 'Glob', 'Grep']
    if not read_only:
        names += ['Write', 'Edit']
    tools = ','.join(names)
    return [str(binary), '-p', '--safe-mode', '--restricted', '--tools', tools,
            '--allowedTools', tools, '--permission-mode', 'dontAsk',
            '--permission-prompts', 'none', '--strict-mcp-config', '--no-chrome',
            '--no-session-persistence', '--disable-slash-commands',
            '--settings', json.dumps(candidate_settings(), separators=(',', ':')),
            '--output-format', 'stream-json', '--verbose']


def _safe_workspace(path: Path) -> Path:
    path = path.absolute()
    for part in (path, *path.parents):
        if _PRIVATE.fullmatch(part.name):
            raise AgentIsolationUnavailableError('Workspace dentro de una ruta privada')
        if part.is_symlink():
            raise AgentIsolationUnavailableError('Workspace con symlink')
    if not path.is_dir():
        raise AgentIsolationUnavailableError('Workspace inexistente')
    for current, dirs, names in os.walk(path, followlinks=False):
        directory = Path(current)
        info = directory.lstat()
        if info.st_uid != os.getuid() or info.st_mode & 0o022:
            raise AgentIsolationUnavailableError('Workspace compartido o escribible por terceros')
        for name in dirs + names:
            if _PRIVATE.fullmatch(name):
                raise AgentIsolationUnavailableError('Workspace contiene una ruta privada')
            item = directory / name
            info = item.lstat()
            if stat.S_ISLNK(info.st_mode) or not (stat.S_ISDIR(info.st_mode) or stat.S_ISREG(info.st_mode)):
                raise AgentIsolationUnavailableError('Workspace contiene symlink o archivo especial')
            if stat.S_ISREG(info.st_mode) and (info.st_nlink != 1 or info.st_uid != os.getuid() or info.st_mode & 0o022):
                raise AgentIsolationUnavailableError('Workspace contiene archivo compartido')
    return path


def _environment(home: str, config_dir: Path, socat_dir: Path) -> dict[str, str]:
    return {'HOME': home, 'CLAUDE_CONFIG_DIR': str(config_dir),
            'PATH': str(socat_dir) + ':/usr/bin:/bin', 'LANG': 'C.UTF-8',
            'DISABLE_TELEMETRY': '1', 'DISABLE_ERROR_REPORTING': '1',
            'DISABLE_NONESSENTIAL_MODEL_CALLS': '1', 'CLAUDE_CODE_SUBPROCESS_ENV_SCRUB': '1'}


def _binary_matches(binary: Path, expected: str) -> bool:
    if not _SHA.fullmatch(expected):
        return False
    try:
        if not binary.is_file() or not os.access(binary, os.X_OK):
            return False
        sha = hashlib.sha256()
        with binary.open('rb') as stream:
            for block in iter(lambda: stream.read(1024 * 1024), b''):
                sha.update(block)
        return sha.hexdigest() == expected
    except OSError:
        return False


def _read_schema(cwd: Path, schema_path: Path) -> str:
    """Read only the caller's bounded schema, without following links."""
    cwd = Path(cwd).absolute()
    expected = cwd / 'schema.json'
    if Path(os.path.abspath(schema_path)) != expected or any(part.is_symlink() for part in (cwd, *cwd.parents)):
        raise AgentIsolationUnavailableError('Esquema fuera de la consulta')
    try:
        fd = os.open(expected, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
        with os.fdopen(fd, 'rb') as stream:
            info = os.fstat(stream.fileno())
            if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_uid != os.getuid():
                raise ValueError('schema file is not private')
            # The schema is passed as one CLI argument, whose OS limit is lower
            # than the total command-line limit on common Linux systems.
            raw = stream.read(96 * 1024 + 1)
        if len(raw) > 96 * 1024:
            raise ValueError('schema too large')
        value = json.loads(raw)
        if not isinstance(value, dict):
            raise ValueError('schema must be an object')
        from jsonschema import Draft202012Validator
        Draft202012Validator.check_schema(value)
        return json.dumps(value, ensure_ascii=False, separators=(',', ':'))
    except (OSError, ValueError, TypeError, ImportError) as exc:
        raise AgentIsolationUnavailableError('Esquema de respuesta inválido') from exc
    except Exception as exc:
        from jsonschema.exceptions import SchemaError
        if isinstance(exc, SchemaError):
            raise AgentIsolationUnavailableError('Esquema de respuesta inválido') from exc
        raise


class ClaudeFileRunner(IsolatedAgentRunnerPort):
    """Launch only file tools in a vetted, exclusively owned workspace.

    The CLI configuration directory is deliberately not opened by the runner;
    it remains outside the workspace and is read only by Claude's own harness.
    The configured executable hash must be the one verified on this host.
    """
    name = 'claude'

    def __init__(self, *, binary: Path, config_dir: Path, expected_sha256: str,
                 socat_dir: Path):
        self.binary = Path(binary).absolute()
        self.config_dir = Path(config_dir).absolute()
        self.expected_sha256 = expected_sha256
        self.socat_dir = Path(socat_dir).absolute()

    def available(self) -> bool:
        # Existence checks do not open or inspect authentication configuration.
        return (_binary_matches(self.binary, self.expected_sha256)
                and self.config_dir.is_dir()
                and (self.socat_dir / 'socat').is_file()
                and os.access(self.socat_dir / 'socat', os.X_OK)
                and Path('/usr/bin/bwrap').is_file())

    async def run(self, prompt: str, *, cwd: Path, log_path: Path,
                  timeout_seconds: float, scope: AgentScope | None = None) -> AgentRunResult:
        if not self.available():
            raise AgentIsolationUnavailableError('Claude aislado o sus dependencias no están verificados')
        if timeout_seconds <= 0:
            raise ValueError('Timeout inválido')
        if scope is None:
            scope = AgentScope(writable_dir='.', read_only=True)
        if scope.extra_env:
            raise AgentIsolationUnavailableError('Las variables de entorno de scope no están autorizadas')
        if scope.commands or scope.extra_writable:
            raise AgentIsolationUnavailableError('Claude admite solo el workspace de archivos asignado')
        if scope.output_schema and not scope.read_only:
            raise AgentIsolationUnavailableError('El esquema solo se admite en consultas de lectura')
        schema = _read_schema(cwd, scope.output_schema) if scope.output_schema else None
        if scope.read_only:
            with tempfile.TemporaryDirectory(prefix='nexa-claude-query-') as directory:
                workspace = _safe_workspace(Path(directory))
                return await self._run_in_workspace(prompt, workspace, log_path, timeout_seconds, scope, schema)
        cwd = Path(cwd).absolute()
        requested = Path(scope.writable_dir)
        if '..' in requested.parts:
            raise AgentIsolationUnavailableError('Workspace fuera del directorio asignado')
        requested = requested if requested.is_absolute() else cwd / requested
        if not requested.absolute().is_relative_to(cwd):
            raise AgentIsolationUnavailableError('Workspace fuera del directorio asignado')
        workspace = _safe_workspace(requested)
        return await self._run_in_workspace(prompt, workspace, log_path, timeout_seconds, scope, schema)

    async def _run_in_workspace(self, prompt: str, workspace: Path, log_path: Path,
                                timeout_seconds: float, scope: AgentScope, schema: str | None) -> AgentRunResult:
        config_dir = self.config_dir.resolve()
        if config_dir.is_relative_to(workspace.resolve()) or workspace.resolve().is_relative_to(config_dir):
            raise AgentIsolationUnavailableError('La configuración no puede estar en el workspace')
        log_path = Path(log_path).absolute()
        if log_path.resolve().is_relative_to(workspace.resolve()):
            raise AgentIsolationUnavailableError('El log no puede estar en el workspace')
        if any(part.is_symlink() for part in (log_path, *log_path.parents)) or not log_path.parent.is_dir():
            raise AgentIsolationUnavailableError('Ruta de log inválida')
        argv = candidate_argv(self.binary, read_only=scope.read_only)
        if schema is not None:
            argv.extend(['--json-schema', schema])
        if scope and scope.model:
            argv.extend(['--model', scope.model])
        if scope and scope.reasoning_effort:
            argv.extend(['--effort', scope.reasoning_effort])
        started = time.monotonic()
        with tempfile.TemporaryDirectory(prefix='nexa-claude-home-') as home:
            env = _environment(home, config_dir, self.socat_dir)
            flags = os.O_WRONLY | os.O_CREAT | os.O_APPEND | os.O_NOFOLLOW
            fd = os.open(log_path, flags, 0o600)
            try:
                log_info = os.fstat(fd)
                if (not stat.S_ISREG(log_info.st_mode) or log_info.st_nlink != 1
                        or log_info.st_uid != os.getuid() or log_info.st_mode & 0o022):
                    raise AgentIsolationUnavailableError('El log no es privado')
                process = await asyncio.create_subprocess_exec(
                    *argv, cwd=workspace, env=env, stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
                    start_new_session=True, limit=4 * 1024 * 1024)
                final, usage, model, event_failed, seen_result, bytes_written = '', {}, '', False, False, 0
                async def transfer() -> None:
                    nonlocal final, usage, model, event_failed, seen_result, bytes_written
                    assert process.stdin is not None and process.stdout is not None
                    process.stdin.write(prompt.encode('utf-8'))
                    await process.stdin.drain()
                    process.stdin.close()
                    while line := await process.stdout.readline():
                        bytes_written += len(line)
                        if bytes_written > 16 * 1024 * 1024:
                            raise AgentIsolationUnavailableError('Salida del agente excede el límite')
                        remaining = memoryview(line)
                        while remaining:
                            remaining = remaining[os.write(fd, remaining):]
                        try:
                            event = json.loads(line)
                        except (UnicodeDecodeError, json.JSONDecodeError):
                            continue
                        if isinstance(event, dict) and event.get('type') == 'result':
                            seen_result = True
                            final = str(event.get('result') or '')
                            event_failed = bool(event.get('is_error'))
                            if schema is not None:
                                if 'structured_output' not in event:
                                    event_failed = True
                                else:
                                    final = json.dumps(event['structured_output'], ensure_ascii=False)
                            usage = event.get('usage') if isinstance(event.get('usage'), dict) else {}
                            by_model = event.get('modelUsage')
                            if isinstance(by_model, dict) and by_model:
                                model = next(iter(by_model))
                    await process.wait()
                timed_out = False
                try:
                    await asyncio.wait_for(transfer(), timeout=timeout_seconds)
                except asyncio.TimeoutError:
                    timed_out = True
                    if process.returncode is None:
                        with suppress(ProcessLookupError):
                            os.killpg(process.pid, signal.SIGKILL)
                    await process.wait()
                except BaseException:
                    if process.returncode is None:
                        with suppress(ProcessLookupError):
                            os.killpg(process.pid, signal.SIGKILL)
                    await process.wait()
                    raise
                return AgentRunResult(exit_code=process.returncode or (1 if event_failed or not seen_result else 0), last_message=final,
                                      duration_seconds=time.monotonic() - started,
                                      timed_out=timed_out, usage=usage, model=model)
            finally:
                os.close(fd)


# Previous import name remains available, with the same explicit constructor.
IsolatedClaudeRunner = ClaudeFileRunner

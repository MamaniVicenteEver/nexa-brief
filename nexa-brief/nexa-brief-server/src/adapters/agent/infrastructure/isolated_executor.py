"""Codex executor restricted to a reviewed host, CLI build and tool policy."""
from __future__ import annotations

import asyncio
from contextlib import ExitStack
from dataclasses import dataclass, replace
import hashlib
import inspect
import json
import os
from pathlib import Path
import platform
import signal
import stat
import tempfile
import time

from src.adapters.agent.infrastructure.binaries import find_binary
from src.adapters.agent.infrastructure.cli_runner import _tail, codex_usage
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.ports.agent_port import AgentIsolationUnavailableError, AgentRunResult, AgentRunnerPort, AgentScope

POLICY_VERSION = "codex-native-isolation-1"


@dataclass(frozen=True)
class CodexBuild:
    executable: Path
    executable_sha256: str
    native_binary: Path
    native_sha256: str
    kernel_release: str
    policy_sha256: str
    policy_version: str = POLICY_VERSION


# Synthetic native-CLI probes on alfred-server covered all four exposed tools,
# workspace writes, private paths, symlinks, environment and network denial.
# A different binary, kernel or policy fails closed until separately reviewed.
APPROVED_BUILDS: tuple[CodexBuild, ...] = (
    CodexBuild(
        executable=Path("/home/alfred/.local/lib/node_modules/@openai/codex/bin/codex.js"),
        executable_sha256="61b0194f3bb6534439c8d26a3ed57d0805f84b884588b761795323eeb92fcf70",
        native_binary=Path("/home/alfred/.local/lib/node_modules/@openai/codex/node_modules/@openai/codex-linux-x64/vendor/x86_64-unknown-linux-musl/bin/codex"),
        native_sha256="b93f6811d3f653f0fb83be4050d857fb9abbb111dfa2ce160563327daff7f306",
        kernel_release="7.0.0-38-generic",
        policy_sha256="89c0611fe78e62539279103580e19a39e21aa2d854fdeddc57518606e6d5c3ef",
    ),
)


def _digest(path: Path) -> str:
    with path.open("rb") as stream:
        digest = hashlib.sha256()
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
        return digest.hexdigest()


def _policy_digest() -> str:
    relevant = (_digest, _policy_digest, _verified_build, _workspace, _environment, _skills_config, _command,
                IsolatedCodexRunner.run)
    source = "\n".join(inspect.getsource(item) for item in relevant)
    return hashlib.sha256(source.encode()).hexdigest()


def _verified_build(binary: str | None) -> CodexBuild:
    if not binary or platform.system() != "Linux":
        raise AgentIsolationUnavailableError("Codex aislado no está disponible en este host.")
    try:
        executable = Path(binary).resolve(strict=True)
        for build in APPROVED_BUILDS:
            if (build.policy_version == POLICY_VERSION
                and build.kernel_release == platform.release()
                and build.policy_sha256 == _policy_digest()
                and executable == build.executable.resolve(strict=True)
                and _digest(executable) == build.executable_sha256
                and _digest(build.native_binary.resolve(strict=True)) == build.native_sha256):
                return build
    except (OSError, ValueError):
        pass
    raise AgentIsolationUnavailableError("La versión y política de Codex no están verificadas para este host.")


def _workspace(cwd: Path, scope: AgentScope | None, layout) -> Path:
    # These scopes need explicit brokers, not additional filesystem grants.
    if scope is None or scope.read_only:
        raise AgentIsolationUnavailableError("El alcance solicitado no está soportado por Codex aislado.")
    try:
        work = (cwd / (scope.os_sandbox_dir or scope.writable_dir)).resolve(strict=True)
        allowed = (layout.productions_dir.resolve(), layout.sandbox_dir.resolve())
        if not work.is_dir() or not any(work.is_relative_to(root) and len(work.relative_to(root).parts) >= 2 for root in allowed):
            raise ValueError("workspace outside profile production/sandbox")
        # Reject path aliases: no links can redirect an allowed tree to private data.
        candidate = cwd / (scope.os_sandbox_dir or scope.writable_dir)
        if Path(os.path.abspath(candidate)) != work:
            raise ValueError("workspace contains a symlink")
        for directory, subdirs, files in os.walk(work, followlinks=False, onerror=lambda exc: (_ for _ in ()).throw(exc)):
            for name in subdirs + files:
                mode = (Path(directory) / name).lstat()
                if stat.S_ISLNK(mode.st_mode) or (stat.S_ISREG(mode.st_mode) and mode.st_nlink != 1):
                    raise ValueError("workspace contains a link")
                if not (stat.S_ISDIR(mode.st_mode) or stat.S_ISREG(mode.st_mode)):
                    raise ValueError("workspace contains a special file")
        return work
    except (OSError, ValueError) as exc:
        raise AgentIsolationUnavailableError("El espacio del agente no es una producción o sandbox válido.") from exc


def _environment(work: Path, runtime: Path) -> dict[str, str]:
    # The harness needs its normal login location; tool processes get a distinct
    # environment below and the permissions deny the login files themselves.
    env = {key: os.environ[key] for key in ("HOME", "CODEX_HOME", "LANG", "LC_ALL") if key in os.environ}
    env.update(PATH="/usr/local/bin:/usr/bin:/bin", TMPDIR=str(runtime))
    return env


def _skills_config(work: Path, home: Path) -> str:
    """Disable discovered skills by exact manifest path, without reading them."""
    roots = {home / "skills", Path("/etc/codex/skills")}
    user_home = Path(os.environ.get("HOME") or str(Path.home()))
    roots.add(user_home / ".agents" / "skills")
    for parent in (work, *work.parents):
        roots.add(parent / ".agents" / "skills")
        roots.add(parent / ".codex" / "skills")
    # This CLI installs its builtin skills at startup even when they are absent.
    manifests = {home / "skills/.system/skill-creator/SKILL.md",
                 home / "skills/.system/skill-installer/SKILL.md"}
    try:
        for root in roots:
            if root.resolve() != Path(os.path.abspath(root)):
                raise ValueError("symlinked skill root")
            if not root.exists():
                continue
            if not root.is_dir():
                raise ValueError("invalid skill root")
            for directory, subdirs, files in os.walk(root, followlinks=False,
                    onerror=lambda exc: (_ for _ in ()).throw(exc)):
                for name in subdirs + files:
                    path = Path(directory) / name
                    if path.is_symlink():
                        raise ValueError("symlink in skill root")
                    if name == "SKILL.md" and path.is_file():
                        manifests.add(path)
                        if len(manifests) > 10000:
                            raise ValueError("too many skills")
    except (OSError, ValueError) as exc:
        raise AgentIsolationUnavailableError("No se pueden desactivar las skills de forma segura.") from exc
    entries = ",".join("{path=" + json.dumps(str(path)) + ",enabled=false}" for path in sorted(manifests))
    return "skills.config=[" + entries + "]"


def _command(build: CodexBuild, work: Path, runtime: Path, home: Path, last: Path, scope: AgentScope, extra_paths: tuple[Path, ...]) -> list[str]:
    helper = home / "tmp" / "arg0"
    if helper.resolve() != Path(os.path.abspath(helper)):
        raise AgentIsolationUnavailableError("Directorio de auxiliares de Codex no válido.")
    try:
        helper.mkdir(mode=0o700, parents=True, exist_ok=True)
    except OSError as exc:
        raise AgentIsolationUnavailableError("No se pudo crear el directorio auxiliar de Codex.") from exc
    if not helper.is_dir() or helper.resolve() != Path(os.path.abspath(helper)):
        raise AgentIsolationUnavailableError("Directorio de auxiliares de Codex no válido.")
    tools_dir = runtime / "bin"
    tools_dir.mkdir(mode=0o700)
    (tools_dir / "apply_patch").symlink_to(build.native_binary.resolve(strict=True))
    for name in (".agents", ".codex"):
        directory = work / name
        if directory.is_symlink() or (directory.exists() and (not directory.is_dir() or any(directory.iterdir()))):
            raise AgentIsolationUnavailableError("El espacio contiene configuración de agente no permitida.")
        directory.mkdir(exist_ok=True)
    policy = {":root": "deny", ":minimal": "read", ":slash_tmp": "deny", str(runtime): "write",
              str(helper): "read", str(build.native_binary.resolve()): "read", ":workspace_roots": {".": "write"}}
    policy[str(work / ".agents")] = "deny"
    policy[str(work / ".codex")] = "deny"
    for path in extra_paths:
        policy[str(path)] = "write"
    if scope.read_only:
        policy[":workspace_roots"] = {".": "read"}
    def inline(value):
        if isinstance(value, dict):
            return "{" + ",".join(f"{json.dumps(k)}={inline(v)}" for k, v in value.items()) + "}"
        return json.dumps(value)
    configs = [f"default_permissions={json.dumps('isolated')}", f"permissions.isolated.filesystem={inline(policy)}",
               _skills_config(work, home), "permissions.isolated.network.enabled=false", 'approval_policy="never"', 'web_search="disabled"',
               'forced_login_method="chatgpt"', 'shell_environment_policy.inherit="none"',
               f"shell_environment_policy.set.HOME={json.dumps(str(work))}",
               f"shell_environment_policy.set.TMPDIR={json.dumps(str(runtime))}",
               f'shell_environment_policy.set.PATH={json.dumps(str(tools_dir) + ":/usr/local/bin:/usr/bin:/bin")}']
    if scope.extra_env.get("NEXA_EXPLAINER_PIPELINE_AGENT") == "1":
        configs.append('shell_environment_policy.set.NEXA_EXPLAINER_PIPELINE_AGENT="1"')
    configs += [f"features.{name}=false" for name in
                ("hooks", "apps", "browser_use", "computer_use", "multi_agent", "code_mode_host",
                 "goals", "shell_snapshot", "plugins")]
    cmd = [str(build.executable), "exec", "--ignore-user-config", "--ignore-rules", "--ephemeral", "--json",
           "--skip-git-repo-check", "-C", str(work), "-o", str(last)]
    for config in configs:
        cmd += ["-c", config]
    model = scope.model or settings.agent_codex_model
    effort = scope.reasoning_effort or settings.agent_codex_reasoning_effort
    if model:
        cmd += ["-m", model]
    if effort:
        cmd += ["-c", f"model_reasoning_effort={json.dumps(effort)}"]
    if scope.output_schema:
        cmd += ["--output-schema", str(scope.output_schema)]
    return cmd + ["-"]


class IsolatedCodexRunner(AgentRunnerPort):
    name = "codex"

    def __init__(self, binary: str | None = None):
        self._binary = binary if binary is not None else find_binary("codex", settings.agent_codex_bin)

    def available(self) -> bool:
        try:
            _verified_build(self._binary)
            return True
        except AgentIsolationUnavailableError:
            return False

    async def run(self, prompt: str, *, cwd: Path, log_path: Path, timeout_seconds: float,
                  scope: AgentScope | None = None) -> AgentRunResult:
        build = _verified_build(self._binary)
        layout = layout_for_settings(settings)
        if layout.schema_version < 2:
            raise AgentIsolationUnavailableError("El ejecutor aislado requiere un perfil v2 o superior.")
        if scope is None:
            scope = AgentScope(writable_dir=".", read_only=True)
        if scope.extra_env not in ({}, {"NEXA_EXPLAINER_PIPELINE_AGENT": "1"}):
            raise AgentIsolationUnavailableError("Variables adicionales no verificadas.")
        if scope.read_only and (scope.extra_env or scope.extra_writable):
            raise AgentIsolationUnavailableError("La consulta de solo lectura no admite accesos adicionales.")
        work = None if scope.read_only else _workspace(cwd, scope, layout)
        extra_paths = []
        for raw in scope.extra_writable:
            if raw == "/tmp":
                continue  # TMPDIR is private; never grant the host's /tmp.
            path = Path(raw)
            allowed = layout.logs_dir / "videos" / work.name
            if not path.is_absolute() or Path(os.path.abspath(path)) != allowed or path.resolve() != allowed:
                raise AgentIsolationUnavailableError("Ruta adicional fuera del log de esta producción.")
            path.mkdir(parents=True, exist_ok=True)
            extra_paths.append(path)
        runtime_root = layout.runtime_dir / "agents"
        runtime_root.mkdir(parents=True, exist_ok=True, mode=0o700)
        home = Path(os.environ.get("CODEX_HOME") or (Path.home() / ".codex"))
        log_path.parent.mkdir(parents=True, exist_ok=True)
        last = log_path.with_suffix(".last.txt")
        last.unlink(missing_ok=True)
        started = time.monotonic()
        with ExitStack() as stack:
            runtime = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="codex-", dir=runtime_root)))
            if work is None:
                work = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="codex-query-", dir=runtime_root)))
            if scope.output_schema:
                expected = cwd.resolve() / "schema.json"
                schema = scope.output_schema
                if Path(os.path.abspath(schema)) != expected:
                    raise AgentIsolationUnavailableError("Esquema fuera del directorio de la consulta.")
                try:
                    fd = os.open(schema, os.O_RDONLY | os.O_NOFOLLOW)
                    with os.fdopen(fd, "rb") as source:
                        contents = source.read(1024 * 1024 + 1)
                    if len(contents) > 1024 * 1024:
                        raise ValueError("schema too large")
                    json.loads(contents)
                except (OSError, ValueError) as exc:
                    raise AgentIsolationUnavailableError("Esquema de respuesta inválido.") from exc
                schema_copy = runtime / "schema.json"
                schema_copy.write_bytes(contents)
                scope = replace(scope, output_schema=schema_copy)
            cmd = _command(build, work, runtime, home, last, scope, tuple(extra_paths))
            with log_path.open("ab") as log:
                process = await asyncio.create_subprocess_exec(
                    *cmd, cwd=work, stdin=asyncio.subprocess.PIPE, stdout=log, stderr=log,
                    env=_environment(work, runtime), start_new_session=True,
                )
                try:
                    await asyncio.wait_for(process.communicate(prompt.encode()), timeout_seconds)
                    timed_out = False
                except (asyncio.TimeoutError, asyncio.CancelledError) as exc:
                    try:
                        os.killpg(process.pid, signal.SIGTERM)
                    except ProcessLookupError:
                        pass
                    try:
                        await asyncio.wait_for(process.wait(), timeout=5)
                    except asyncio.TimeoutError:
                        try:
                            os.killpg(process.pid, signal.SIGKILL)
                        except ProcessLookupError:
                            pass
                        await process.wait()
                    if isinstance(exc, asyncio.CancelledError):
                        raise
                    timed_out = True
        code = process.returncode if process.returncode is not None else -1
        result = _tail(last, 20000)
        if code != 0 or timed_out:
            result = result or _tail(log_path, 4000)
        return AgentRunResult(code, result.strip(), time.monotonic() - started, timed_out,
                              codex_usage(log_path), scope.model or settings.agent_codex_model or "codex")

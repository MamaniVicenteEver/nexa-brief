"""Agent Factory — 'claude' (Claude Code) | 'codex' (Codex CLI).

Un agente por API (DeepSeek con herramientas, etc.) se agrega como otro
adaptador de `AgentRunnerPort` y una rama acá; quien llama no cambia.
"""

import os
from pathlib import Path

from src.adapters.agent.isolation_policy import require_legacy_agent_launch_allowed
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.ports.agent_port import AgentIsolationUnavailableError, AgentRunnerPort

AGENTS = ("claude", "codex")
# Claude Code 2.1.309, file-only policy tested with the native CLI.
_CLAUDE_FILE_SHA256 = "4d704a8aecbe038affa3000f498ae17c1b4f753add8facb8764120affc99b658"


def _isolated_claude():
    from src.adapters.agent.infrastructure.binaries import find_binary
    from src.adapters.agent.infrastructure.isolated_claude import ClaudeFileRunner

    binary = find_binary("claude", settings.agent_claude_bin)
    if not binary:
        raise AgentIsolationUnavailableError("Los agentes CLI están deshabilitados para perfiles v2/v3: Claude aislado no está instalado.")
    home = Path.home()
    config = Path(os.environ.get("CLAUDE_CONFIG_DIR") or home / ".claude")
    if not config.is_absolute():
        raise AgentIsolationUnavailableError("La configuración de Claude requiere una ruta absoluta.")
    socat = home / ".local/lib/nexa-brief/tools/socat-20261105/usr/bin"
    return ClaudeFileRunner(binary=Path(binary).absolute(), config_dir=config,
                            expected_sha256=_CLAUDE_FILE_SHA256, socat_dir=socat)



def get_agent(name: str | None = None) -> AgentRunnerPort:
    effective = name or settings.explainer_agent
    if effective == "claude" and layout_for_settings(settings).schema_version >= 2:
        runner = _isolated_claude()
        if not runner.available():
            raise AgentIsolationUnavailableError("Los agentes CLI están deshabilitados para perfiles v2/v3: Claude aislado no está verificado para este host.")
        return runner
    if effective == "codex" and layout_for_settings(settings).schema_version >= 2:
        from src.adapters.agent.infrastructure.isolated_executor import IsolatedCodexRunner

        runner = IsolatedCodexRunner()
        if not runner.available():
            raise AgentIsolationUnavailableError("Los agentes CLI están deshabilitados para perfiles v2/v3: Codex aislado no está verificado para este host.")
        return runner
    require_legacy_agent_launch_allowed()
    if effective == "claude":
        from src.adapters.agent.infrastructure.cli_runner import ClaudeCodeRunner

        return ClaudeCodeRunner()
    if effective == "codex":
        from src.adapters.agent.infrastructure.cli_runner import CodexRunner

        return CodexRunner()
    raise ValueError(f"get_agent: agente desconocido {effective!r} (usar {', '.join(AGENTS)}).")


def agents_status() -> list[dict]:
    """[{name, available}] para la web (qué agentes hay instalados)."""
    result = []
    for name in AGENTS:
        try:
            available = get_agent(name).available()
        except AgentIsolationUnavailableError:
            available = False
        result.append({"name": name, "available": available})
    return result

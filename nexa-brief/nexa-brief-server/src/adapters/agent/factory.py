"""Agent Factory — 'claude' (Claude Code) | 'codex' (Codex CLI).

Un agente por API (DeepSeek con herramientas, etc.) se agrega como otro
adaptador de `AgentRunnerPort` y una rama acá; quien llama no cambia.
"""

from src.config.settings import settings
from src.core.ports.agent_port import AgentRunnerPort

AGENTS = ("claude", "codex")


def get_agent(name: str | None = None) -> AgentRunnerPort:
    effective = name or settings.explainer_agent
    if effective == "claude":
        from src.adapters.agent.infrastructure.cli_runner import ClaudeCodeRunner

        return ClaudeCodeRunner()
    if effective == "codex":
        from src.adapters.agent.infrastructure.cli_runner import CodexRunner

        return CodexRunner()
    raise ValueError(f"get_agent: agente desconocido {effective!r} (usar {', '.join(AGENTS)}).")


def agents_status() -> list[dict]:
    """[{name, available}] para la web (qué agentes hay instalados)."""
    return [{"name": n, "available": get_agent(n).available()} for n in AGENTS]

"""AI Adapter Factory — resolves the correct AI adapter by role."""

import structlog

from src.core.ports.ai_port import AIPort


def get_analysis_ai() -> AIPort:
    """Return the AI adapter for analysis, visual design, and summaries (Gemini)."""
    from src.adapters.ai.infrastructure.gemini_flash_adapter import GeminiFlashAdapter
    return GeminiFlashAdapter()


def get_codegen_ai() -> AIPort:
    """Return the AI adapter for HTML code generation (DeepSeek, con fallback a
    Gemini si DeepSeek falla tras varios reintentos — ver
    DeepSeekGeminiFallbackAdapter)."""
    from src.adapters.ai.infrastructure.deepseek_gemini_fallback_adapter import (
        DeepSeekGeminiFallbackAdapter,
    )
    return DeepSeekGeminiFallbackAdapter()


_QUOTA_MARKERS = ("age limit", "usage limit", "hit your", "rate limit", "quota", "credits", "límite", "limite")


class _OffAI(AIPort):
    """Sin IA (interruptor apagado o vista previa): cada llamada deja el dato pendiente."""

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        from src.core.ai_switch import AIUnavailableError

        raise AIUnavailableError("IA no disponible (interruptor apagado).")

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        from src.core.ai_switch import AIUnavailableError

        raise AIUnavailableError("IA no disponible (interruptor apagado).")


class QuotaFallbackAI(AIPort):
    """Codex primero. Si falla por cuota o límite, la misma llamada pasa al respaldo (Claude, rol del texto)."""

    def __init__(self, primary: AIPort, fallback: AIPort) -> None:
        self._primary = primary
        self._fallback = fallback

    @property
    def name(self) -> str:
        return self._primary.name

    @staticmethod
    def _quota_error(exc: Exception) -> bool:
        message = str(exc).lower()
        return any(marker in message for marker in _QUOTA_MARKERS)

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        try:
            return await self._primary.complete_json(system_prompt, user_prompt)
        except Exception as exc:
            if not self._quota_error(exc):
                raise
            structlog.get_logger(__name__).warning("copy_ai_quota_fallback", error=str(exc)[:200])
            return await self._fallback.complete_json(system_prompt, user_prompt)

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        try:
            return await self._primary.complete_text(system_prompt, user_prompt)
        except Exception as exc:
            if not self._quota_error(exc):
                raise
            structlog.get_logger(__name__).warning("copy_ai_quota_fallback", error=str(exc)[:200])
            return await self._fallback.complete_text(system_prompt, user_prompt)


def get_copy_ai() -> AIPort:
    """Textos con Terra high por defecto; Claude solo si Codex no está disponible
    o si Codex agota la cuota durante una llamada (respaldo del rol)."""
    from src.core.ai_switch import ai_enabled

    if not ai_enabled():
        return _OffAI()
    from src.adapters.agent.factory import agents_status
    available = {row["name"]: row["available"] for row in agents_status()}
    if not available.get("codex"):
        return get_text_ai("claude")
    primary = get_text_ai("codex")
    if available.get("claude"):
        return QuotaFallbackAI(primary, get_text_ai("claude"))
    return primary



TEXT_PROVIDERS = ("codex", "claude", "deepseek")


def get_text_ai(provider: str) -> AIPort:
    """Textos/JSON por proveedor: 'claude' | 'codex' (CLI local, sin costo de API)
    o 'deepseek' (API). Lo usan el explainer (títulos) y el planificador semanal."""
    if provider in ("claude", "codex"):
        from src.adapters.agent.factory import get_agent
        from src.adapters.ai.infrastructure.local_agent_ai_adapter import LocalAgentAIAdapter

        return LocalAgentAIAdapter(get_agent(provider))
    if provider == "deepseek":
        from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter

        return DeepSeekAdapter()
    raise ValueError(f"get_text_ai: proveedor desconocido {provider!r} (usar {', '.join(TEXT_PROVIDERS)}).")

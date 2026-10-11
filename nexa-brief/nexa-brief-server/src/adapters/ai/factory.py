"""AI Adapter Factory — resolves the correct AI adapter by role."""

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


TEXT_PROVIDERS = ("claude", "codex", "deepseek")


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

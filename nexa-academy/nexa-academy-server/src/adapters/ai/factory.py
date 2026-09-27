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

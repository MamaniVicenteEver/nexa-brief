"""DeepSeek→Gemini fallback adapter — resiliencia para generación de código/config.

Motivo: html_generator (config_dict/HTML) es un paso caro de recuperar si
falla a mitad de un job (después de resource_fetcher + lyrics_transcriber,
que en niches de letras ya corrió Whisper, varios minutos) — un timeout
transitorio de DeepSeek no debería tirar el job entero.

Reintenta DeepSeek con backoff creciente (5s, 10s, 15s — pensado para
timeouts/errores transitorios de red, no para respuestas inválidas que un
reintento no arregla). Si TODOS los intentos a DeepSeek fallan, cae UNA vez
a Gemini (que ya tiene su propio reintento interno, ver GeminiFlashAdapter)
antes de rendirse. Si Gemini también falla, propaga AIGenerationError con
el detalle de ambos errores — sin reintentos infinitos ni fallback silencioso.
"""

from __future__ import annotations

import asyncio

import structlog

from src.config.exceptions import AIGenerationError
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)

_DEEPSEEK_RETRY_DELAYS_SECONDS: tuple[int, ...] = (5, 10, 15)


class DeepSeekGeminiFallbackAdapter(AIPort):
    """DeepSeek como motor principal de codegen; Gemini como respaldo si falla."""

    def __init__(self) -> None:
        from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
        from src.adapters.ai.infrastructure.gemini_flash_adapter import GeminiFlashAdapter

        # max_retries=1: este adapter maneja sus propios reintentos con su
        # propio backoff — no queremos anidar el loop de reintento interno
        # de DeepSeekAdapter dentro del nuestro.
        self._deepseek = DeepSeekAdapter(max_retries=1)
        self._gemini = GeminiFlashAdapter()

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        return await self._call_with_fallback(
            "complete_text",
            lambda: self._deepseek.complete_text(system_prompt, user_prompt),
            lambda: self._gemini.complete_text(system_prompt, user_prompt),
        )

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        return await self._call_with_fallback(
            "complete_json",
            lambda: self._deepseek.complete_json(system_prompt, user_prompt),
            lambda: self._gemini.complete_json(system_prompt, user_prompt),
        )

    async def _call_with_fallback(self, operation: str, primary, fallback):
        last_error: Exception | None = None
        for attempt, delay in enumerate((0, *_DEEPSEEK_RETRY_DELAYS_SECONDS), start=1):
            if delay:
                await asyncio.sleep(delay)
            try:
                return await primary()
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "deepseek_gemini_fallback_deepseek_attempt_failed",
                    operation=operation,
                    attempt=attempt,
                    error=str(exc),
                )

        logger.warning(
            "deepseek_gemini_fallback_switching_to_gemini",
            operation=operation,
            last_deepseek_error=str(last_error),
        )
        try:
            return await fallback()
        except Exception as exc:
            logger.error(
                "deepseek_gemini_fallback_all_failed",
                operation=operation,
                deepseek_error=str(last_error),
                gemini_error=str(exc),
            )
            raise AIGenerationError(
                f"{operation}: DeepSeek falló tras {1 + len(_DEEPSEEK_RETRY_DELAYS_SECONDS)} "
                f"intentos ({last_error}); fallback a Gemini también falló: {exc}"
            ) from exc

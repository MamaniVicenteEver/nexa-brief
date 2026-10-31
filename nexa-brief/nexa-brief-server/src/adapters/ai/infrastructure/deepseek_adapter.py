"""DeepSeek V3 adapter — used exclusively for HTML code generation."""

from __future__ import annotations

import asyncio
import json
import re
import time

import structlog
from openai import AsyncOpenAI

from src.config.exceptions import AIGenerationError, AIValidationError
from src.config.settings import settings
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]+?)\s*```", re.IGNORECASE)
_HTML_FENCE = re.compile(r"```(?:html)?\s*([\s\S]+?)\s*```", re.IGNORECASE)


class DeepSeekAdapter(AIPort):
    """Wraps the OpenAI-compatible Novita AI endpoint for DeepSeek V3."""

    def __init__(self, max_retries: int | None = None) -> None:
        if not settings.deepseek_api_key:
            raise AIGenerationError("DEEPSEEK_API_KEY is not set.")
        self._client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url=settings.deepseek_base_url,
        )
        self._model = settings.deepseek_model
        # Override opcional — usado por DeepSeekGeminiFallbackAdapter con
        # max_retries=1 para manejar sus propios reintentos con su propio
        # backoff, sin anidar dos loops de reintento.
        self._max_retries = settings.ai_max_retries if max_retries is None else max_retries

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Call DeepSeek and return a parsed JSON dict."""
        text = await self.complete_text(system_prompt, user_prompt)
        match = _JSON_FENCE.search(text)
        raw = match.group(1) if match else text.strip()
        try:
            return json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AIValidationError(f"DeepSeek JSON parse error: {exc}") from exc

    async def complete_json_with_usage(self, system_prompt: str, user_prompt: str) -> tuple[dict, dict]:
        """Devuelve el JSON y el consumo informado por la API para el redactor."""
        for attempt in range(1, self._max_retries + 1):
            started = time.monotonic()
            try:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[{"role": "system", "content": system_prompt},
                              {"role": "user", "content": user_prompt}],
                    max_tokens=settings.ai_max_output_tokens,
                    temperature=0.7,
                )
                content = response.choices[0].message.content or ""
                match = _JSON_FENCE.search(content)
                result = json.loads(match.group(1) if match else content.strip())
                usage = response.usage
                details = getattr(usage, "completion_tokens_details", None)
                return result, {
                    "provider": "deepseek", "model": response.model or self._model,
                    "input_tokens": getattr(usage, "prompt_tokens", None),
                    "cached_input_tokens": getattr(usage, "prompt_cache_hit_tokens", None),
                    "output_tokens": getattr(usage, "completion_tokens", None),
                    "total_tokens": getattr(usage, "total_tokens", None),
                    "reasoning_tokens": getattr(details, "reasoning_tokens", None),
                    "seconds": round(time.monotonic() - started, 2),
                }
            except (json.JSONDecodeError, IndexError) as exc:
                raise AIValidationError(f"DeepSeek JSON parse error: {exc}") from exc
            except Exception as exc:
                logger.warning("deepseek_retry", attempt=attempt, error=str(exc))
                if attempt == self._max_retries:
                    raise AIGenerationError(f"DeepSeek failed after {attempt} attempts: {exc}") from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise AIGenerationError("DeepSeek: unreachable")

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        """Call DeepSeek and return the raw text response."""
        for attempt in range(1, self._max_retries + 1):
            try:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                    ],
                    max_tokens=settings.ai_max_output_tokens,
                    temperature=0.7,
                )
                content = response.choices[0].message.content or ""
                # Strip HTML fences if model wraps the output
                match = _HTML_FENCE.search(content)
                return match.group(1) if match else content
            except Exception as exc:
                logger.warning("deepseek_retry", attempt=attempt, error=str(exc))
                if attempt == self._max_retries:
                    raise AIGenerationError(f"DeepSeek failed after {attempt} attempts: {exc}") from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise AIGenerationError("DeepSeek: unreachable")

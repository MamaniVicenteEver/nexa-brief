"""Gemini Flash Lite adapter — used for analysis, visual design, summaries, and image analysis."""

from __future__ import annotations

import asyncio
import json
import re
from pathlib import Path

import structlog
from google import genai
from google.genai import types

from src.config.exceptions import AIGenerationError, AIValidationError
from src.config.settings import settings
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]+?)\s*```", re.IGNORECASE)


def _extract_json(text: str) -> dict:
    """Extract JSON from a model response, stripping markdown fences if present.

    Handles Gemini's quirk of appending trailing ``` after valid JSON even when
    response_mime_type="application/json" is set.
    """
    match = _JSON_FENCE.search(text)
    raw = match.group(1) if match else text.strip()

    # Direct parse (most responses)
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass

    # Gemini sometimes appends ``` or whitespace after a valid JSON object —
    # find the outermost { } or [ ] and parse only that slice.
    for open_c, close_c in [('{', '}'), ('[', ']')]:
        start = raw.find(open_c)
        end = raw.rfind(close_c)
        if start >= 0 and end > start:
            try:
                return json.loads(raw[start:end + 1])
            except json.JSONDecodeError:
                continue

    raise AIValidationError(
        f"Could not parse JSON from Gemini response:\n{raw[:500]}"
    )


class GeminiFlashAdapter(AIPort):
    """Wraps the google-genai SDK for Gemini 2.0 Flash Lite."""

    def __init__(self) -> None:
        if not settings.gemini_api_key:
            raise AIGenerationError("GEMINI_API_KEY is not set.")
        self._client = genai.Client(api_key=settings.gemini_api_key)
        self._model = settings.gemini_model

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        """Call Gemini in JSON mode and return a parsed dict."""
        for attempt in range(1, settings.ai_max_retries + 1):
            try:
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        max_output_tokens=settings.ai_max_output_tokens,
                    ),
                )
                return _extract_json(response.text)
            except AIValidationError:
                raise
            except Exception as exc:
                logger.warning("gemini_retry", attempt=attempt, error=str(exc))
                if attempt == settings.ai_max_retries:
                    raise AIGenerationError(f"Gemini failed after {attempt} attempts: {exc}") from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise AIGenerationError("Gemini: unreachable")

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        """Call Gemini and return raw text."""
        for attempt in range(1, settings.ai_max_retries + 1):
            try:
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=user_prompt,
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        max_output_tokens=settings.ai_max_output_tokens,
                    ),
                )
                return response.text
            except Exception as exc:
                logger.warning("gemini_text_retry", attempt=attempt, error=str(exc))
                if attempt == settings.ai_max_retries:
                    raise AIGenerationError(f"Gemini failed after {attempt} attempts: {exc}") from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise AIGenerationError("Gemini: unreachable")

    async def analyze_image(self, image_path: Path, criteria: list[str]) -> dict:
        """Analyze an image against criteria using Gemini multimodal vision.

        Returns dict with: passes, score, reason, criteria_met, criteria_failed.
        """
        image_bytes = image_path.read_bytes()
        suffix = image_path.suffix.lower()
        mime_type = "image/png" if suffix == ".png" else "image/jpeg"

        criteria_text = "\n".join(f"- {c}" for c in criteria)
        user_prompt = (
            f"Analiza esta imagen contra los siguientes criterios de calidad:\n\n"
            f"{criteria_text}\n\n"
            "Evalúa cada criterio y devuelve un JSON con exactamente estos campos:\n"
            "- passes: true si la imagen cumple la mayoría de criterios (score >= 0.70)\n"
            "- score: float 0.0–1.0 indicando qué tan bien cumple TODOS los criterios\n"
            "- reason: breve explicación en español de los puntos más relevantes\n"
            "- criteria_met: lista de criterios que SÍ cumple\n"
            "- criteria_failed: lista de criterios que NO cumple\n\n"
            "Responde ÚNICAMENTE con JSON válido, sin bloques de código markdown."
        )

        for attempt in range(1, settings.ai_max_retries + 1):
            try:
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        user_prompt,
                    ],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        max_output_tokens=1024,
                    ),
                )
                return _extract_json(response.text)
            except AIValidationError:
                raise
            except Exception as exc:
                logger.warning("gemini_image_retry", attempt=attempt, error=str(exc))
                if attempt == settings.ai_max_retries:
                    raise AIGenerationError(
                        f"Gemini analyze_image failed after {attempt} attempts: {exc}"
                    ) from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise AIGenerationError("Gemini analyze_image: unreachable")

    async def analyze_image_full(
        self,
        image_path: Path,
        system_prompt: str,
        *,
        max_output_tokens: int | None = None,
    ) -> dict:
        """Run a full multimodal system prompt (e.g. the Vision Extractor) against
        ONE image and return the parsed JSON, with no fixed response schema.
        """
        image_bytes = image_path.read_bytes()
        suffix = image_path.suffix.lower()
        mime_type = "image/png" if suffix == ".png" else "image/jpeg"
        tokens = max_output_tokens or settings.ai_max_output_tokens

        for attempt in range(1, settings.ai_max_retries + 1):
            try:
                response = await self._client.aio.models.generate_content(
                    model=self._model,
                    contents=[
                        types.Part.from_bytes(data=image_bytes, mime_type=mime_type),
                        "Return the JSON now.",
                    ],
                    config=types.GenerateContentConfig(
                        system_instruction=system_prompt,
                        response_mime_type="application/json",
                        max_output_tokens=tokens,
                    ),
                )
                return _extract_json(response.text)
            except AIValidationError:
                raise
            except Exception as exc:
                logger.warning("gemini_image_full_retry", attempt=attempt, error=str(exc))
                if attempt == settings.ai_max_retries:
                    raise AIGenerationError(
                        f"Gemini analyze_image_full failed after {attempt} attempts: {exc}"
                    ) from exc
                await asyncio.sleep(settings.ai_retry_delay_seconds * attempt)
        raise AIGenerationError("Gemini analyze_image_full: unreachable")

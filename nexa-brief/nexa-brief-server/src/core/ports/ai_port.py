"""AI Port — abstract contract for language model interactions."""

from abc import ABC, abstractmethod
from pathlib import Path


class AIPort(ABC):
    """Shared interface for all AI adapters (Gemini, DeepSeek, etc.).

    - complete_json    → structured analysis/design tasks (returns dict)
    - complete_text    → open-ended code generation (returns str)
    - analyze_image    → multimodal image evaluation against criteria (returns dict)
                         Only multimodal adapters (Gemini) override this.
    """

    @abstractmethod
    async def complete_json(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> dict:
        """Call the model and return a validated JSON dict."""

    @abstractmethod
    async def complete_text(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        """Call the model and return raw text (e.g. HTML code)."""

    async def analyze_image(
        self,
        image_path: Path,
        criteria: list[str],
    ) -> dict:
        """Analyze an image against a list of criteria using multimodal vision.

        Returns a dict with:
            passes:          bool    — True si la imagen cumple los criterios
            score:           float   — Puntuación 0.0–1.0
            reason:          str     — Explicación breve en español
            criteria_met:    list[str]
            criteria_failed: list[str]

        Default raises NotImplementedError — only multimodal adapters override this.
        """
        raise NotImplementedError(f"{type(self).__name__} does not support analyze_image.")

    async def analyze_image_full(
        self,
        image_path: Path,
        system_prompt: str,
        *,
        max_output_tokens: int | None = None,
    ) -> dict:
        """Run a full multimodal system prompt against ONE image and return the parsed JSON.

        Unlike analyze_image() — which has a fixed {passes, score, reason, ...}
        contract driven by a short criteria list — this method makes no
        assumption about the response schema: the caller owns both the prompt
        and the resulting JSON shape (e.g. a large vision-extraction schema
    like src/templates/image/01-image-bg/prompts/vision_extractor.md).

        Default raises NotImplementedError — only multimodal adapters override this.
        """
        raise NotImplementedError(f"{type(self).__name__} does not support analyze_image_full.")

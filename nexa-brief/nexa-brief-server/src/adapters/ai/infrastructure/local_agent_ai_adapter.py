"""AIPort sobre un agente local (Claude Code / Codex) en modo solo lectura.

Sirve para textos y JSON (títulos, descripciones, plan semanal) usando las
suscripciones de la máquina en vez de una API paga. El agente puede leer
archivos e investigar en la web, pero no escribir ni correr comandos.
"""

from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

import structlog

from src.config.exceptions import AIGenerationError, AIValidationError
from src.config.settings import BASE_DIR, settings
from src.core.ports.agent_port import AgentRunnerPort
from src.core.ports.ai_port import AIPort

logger = structlog.get_logger(__name__)

_JSON_FENCE = re.compile(r"```(?:json)?\s*([\s\S]+?)\s*```", re.IGNORECASE)


def parse_json_reply(text: str) -> dict:
    """Primer objeto JSON de la respuesta (con o sin ```json)."""
    match = _JSON_FENCE.search(text)
    raw = match.group(1) if match else text.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        start, end = raw.find("{"), raw.rfind("}")
        if start != -1 and end > start:
            try:
                return json.loads(raw[start : end + 1])
            except json.JSONDecodeError:
                pass
    raise AIValidationError(f"la respuesta no es JSON válido: {text[:200]!r}")


class LocalAgentAIAdapter(AIPort):
    def __init__(self, agent: AgentRunnerPort, cwd: Path = BASE_DIR, timeout_seconds: float | None = None) -> None:
        self._agent = agent
        self._cwd = cwd
        self._timeout = timeout_seconds or settings.agent_text_timeout_seconds

    @property
    def name(self) -> str:
        return self._agent.name

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        if not self._agent.available():
            raise AIGenerationError(f"el agente local '{self._agent.name}' no está instalado")
        log = settings.data_dir / "agent_logs" / f"text-{self._agent.name}-{uuid.uuid4().hex[:8]}.log"
        prompt = f"{system_prompt}\n\n---\n\n{user_prompt}"
        result = await self._agent.run(prompt, cwd=self._cwd, log_path=log, timeout_seconds=self._timeout)
        if result.timed_out:
            raise AIGenerationError(f"{self._agent.name} no respondió en {self._timeout:.0f} s")
        if result.exit_code != 0 or not result.last_message:
            raise AIGenerationError(f"{self._agent.name} terminó con código {result.exit_code}: {result.last_message[-300:]}")
        return result.last_message

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        system = system_prompt + "\n\nResponde SOLO con un objeto JSON válido, sin texto antes ni después."
        text = await self.complete_text(system, user_prompt)
        try:
            return parse_json_reply(text)
        except AIValidationError:
            logger.warning("local_agent_json_retry", agent=self._agent.name)
            fix = (
                "Tu respuesta anterior no era JSON válido. Devuélvela otra vez como UN objeto JSON válido, "
                f"sin comentarios ni texto extra.\n\nRespuesta anterior:\n{text[:6000]}"
            )
            return parse_json_reply(await self.complete_text(system, fix))

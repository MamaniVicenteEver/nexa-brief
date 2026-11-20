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

from src.core.execution_logs import register_execution_log
from src.config.exceptions import AIGenerationError, AIValidationError
from src.config.settings import BASE_DIR, settings
from src.config.profile_layout import layout_for_settings
from src.core.ports.agent_port import AgentRunnerPort, AgentScope, AgentIsolationUnavailableError
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
        from src.adapters.models.hub import roles_config
        spec = roles_config()["roles"]["text_draft"]
        self._model_spec = spec if agent.name == spec["provider"] else spec.get("fallback", {})

    @property
    def name(self) -> str:
        return self._agent.name

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        text, _ = await self._complete_text_with_usage(system_prompt, user_prompt)
        return text

    @staticmethod
    def _usage_from_result(agent: AgentRunnerPort, result) -> dict:
        usage = result.usage or {}
        total = usage.get("total_tokens")
        if total is None and isinstance(usage.get("input_tokens"), int) and isinstance(usage.get("output_tokens"), int):
            total = usage["input_tokens"] + usage["output_tokens"]
            if agent.name == "claude":
                total += int(usage.get("cached_input_tokens") or 0)
        return {
            "provider": agent.name,
            "model": result.model or None,
            "input_tokens": usage.get("input_tokens"),
            "cached_input_tokens": usage.get("cached_input_tokens"),
            "output_tokens": usage.get("output_tokens"),
            "reasoning_tokens": usage.get("reasoning_tokens"),
            "total_tokens": total,
            "turns": usage.get("turns"),
            "cost_usd": usage.get("cost_usd"),
            "seconds": round(float(result.duration_seconds or 0), 3),
        }

    async def _complete_text_with_usage(self, system_prompt: str, user_prompt: str) -> tuple[str, dict]:
        if not self._agent.available():
            raise AIGenerationError(f"el agente local '{self._agent.name}' no está instalado")
        layout = layout_for_settings(settings)
        from src.core.video_usage import current_video_call
        call = current_video_call.get()
        log_dir = (layout.logs_dir / "agents" / self._agent.name if layout.schema_version >= 2
                   else settings.data_dir / "agent_logs")
        if call is not None:
            log_dir = layout.logs_dir / "jobs" / call.video_id / "agents" / self._agent.name
        if any(part.is_symlink() for part in (log_dir, *log_dir.parents)):
            raise AgentIsolationUnavailableError("Ruta de log con enlace simbólico")
        log_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
        log = log_dir / f"text-{self._agent.name}-{uuid.uuid4().hex[:8]}.log"
        registered = await register_execution_log(
            log.relative_to(layout.root), kind="agent",
            video_id=call.video_id if call else None,
            production_id=call.video_id if call else None,
            content_key=call.content_key if call else None,
        )
        log = registered.path
        prompt = f"{system_prompt}\n\n---\n\n{user_prompt}"
        result = await self._agent.run(prompt, cwd=self._cwd, log_path=log, timeout_seconds=self._timeout,
            scope=AgentScope(writable_dir=".", read_only=True, model=self._model_spec.get("model"),
                             reasoning_effort=self._model_spec.get("reasoning_effort")))
        usage = self._usage_from_result(self._agent, result)
        usage.update(requested_model=self._model_spec.get("model"), reasoning_effort=self._model_spec.get("reasoning_effort"))
        if result.timed_out:
            error = AIGenerationError(f"{self._agent.name} no respondió en {self._timeout:.0f} s")
            error.usage = usage
            error.usage_attempts = [{**usage, "status": "failed", "error_type": type(error).__name__}]
            raise error
        if result.exit_code != 0 or not result.last_message:
            error = AIGenerationError(f"{self._agent.name} terminó con código {result.exit_code}: {result.last_message[-300:]}")
            error.usage = usage
            error.usage_attempts = [{**usage, "status": "failed", "error_type": type(error).__name__}]
            raise error
        return result.last_message, usage

    async def complete_json_with_usage(self, system_prompt: str, user_prompt: str) -> tuple[dict, dict]:
        """Devuelve el JSON y una medición real por cada ejecución del agente."""
        attempts: list[dict] = []
        system = system_prompt + "\n\nResponde SOLO con un objeto JSON válido, sin texto antes ni después."

        try:
            text, usage = await self._complete_text_with_usage(system, user_prompt)
        except Exception as exc:
            if not hasattr(exc, "usage_attempts"):
                usage = getattr(exc, "usage", {}) or {}
                exc.usage_attempts = [{**usage, "status": "failed", "error_type": type(exc).__name__}]
            raise

        try:
            parsed = parse_json_reply(text)
        except AIValidationError as exc:
            attempts.append({**usage, "attempt": 1, "status": "failed", "error_type": type(exc).__name__})
            logger.warning("local_agent_json_retry", agent=self._agent.name)
            fix = (
                "Tu respuesta anterior no era JSON válido. Devuélvela otra vez como UN objeto JSON válido, "
                f"sin comentarios ni texto extra.\n\nRespuesta anterior:\n{text[:6000]}"
            )
            retry_usage = None
            try:
                text, retry_usage = await self._complete_text_with_usage(system, fix)
                parsed = parse_json_reply(text)
            except Exception as retry_error:
                retry_attempts = getattr(retry_error, "usage_attempts", None)
                if isinstance(retry_error, AIValidationError) and retry_usage is not None and not isinstance(retry_attempts, list):
                    measured = retry_usage
                    retry_attempts = [{**measured, "status": "failed", "error_type": type(retry_error).__name__}]
                elif not isinstance(retry_attempts, list):
                    measured = getattr(retry_error, "usage", {}) or {}
                    retry_attempts = [{**measured, "status": "failed", "error_type": type(retry_error).__name__}]
                else:
                    retry_attempts = [dict(item) for item in retry_attempts]
                retry_error.usage_attempts = [*attempts, *retry_attempts]
                if retry_attempts:
                    retry_error.usage = retry_attempts[-1]
                raise
            attempts.append({**retry_usage, "attempt": 2, "status": "ok"})
            return parsed, {**retry_usage, "attempts": attempts}

        attempts.append({**usage, "attempt": 1, "status": "ok"})
        return parsed, {**usage, "attempts": attempts}

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

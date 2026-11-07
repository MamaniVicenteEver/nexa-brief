"""Model Hub — un solo lugar para pedir "el modelo que hace X".

Los roles (qué proveedor hace cada trabajo) viven en datos: src/skills/models/roles.json, que
también lee el kit (tools/delegate.py). Cambiar un proveedor ahí cambia a quién se le pide, sin
tocar código. Este módulo solo traduce rol → adaptador:

  agentes locales (CLI, con la suscripción de la máquina): codex, claude  → AgentRunnerPort
  modelos por API (texto/JSON):                             deepseek, gemini → AIPort

Guía para personas y agentes: src/templates/_tools/explainer-kit/guides/orquestacion.md
"""

from __future__ import annotations

import json
import os
import asyncio
import logging
import time
import uuid
from contextvars import ContextVar
from functools import lru_cache
from pathlib import Path

from src.config.settings import BASE_DIR, settings
from src.config.profile_layout import layout_for_settings
from src.core.execution_logs import register_execution_log
from src.core.ports.agent_port import AgentRunnerPort
from src.core.ports.ai_port import AIPort

ROLES_FILE = BASE_DIR / "src" / "skills" / "models" / "roles.json"
AGENT_PROVIDERS = ("codex", "claude")
call_log_dir: ContextVar[Path | None] = ContextVar("model_call_log_dir", default=None)
log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def roles_config() -> dict:
    override = os.environ.get("NEXA_ROLES_FILE")
    return json.loads((Path(override) if override else ROLES_FILE).read_text(encoding="utf-8"))


def provider_for(role: str) -> str:
    try:
        return roles_config()["roles"][role]["provider"]
    except KeyError as exc:
        raise ValueError(f"model hub: rol desconocido {role!r}") from exc


def model_for(role: str) -> str:
    """Modelo concreto del rol ('' = el que use el proveedor por defecto)."""
    cfg = roles_config()
    spec = cfg["roles"][role]
    provider = spec["provider"]
    if spec.get("model"):
        alias = spec["model"]
        return (cfg["providers"].get(provider, {}).get("models") or {}).get(alias, alias)
    if provider == "codex":
        return settings.agent_codex_model
    return ""


def agent_for(role: str) -> AgentRunnerPort:
    """Agente local que cumple el rol (producer, research, script…)."""
    provider = provider_for(role)
    if provider not in AGENT_PROVIDERS:
        raise ValueError(f"el rol {role!r} lo hace {provider}, que no es un agente local")
    from src.adapters.agent.factory import get_agent

    return get_agent(provider)


def text_for(role: str) -> AIPort:
    """Modelo de texto/JSON que cumple el rol (planner, copy…)."""
    provider = provider_for(role)
    if provider == "gemini":
        from src.adapters.ai.factory import get_analysis_ai

        return get_analysis_ai()
    from src.adapters.ai.factory import get_text_ai

    return get_text_ai(provider)


async def text_json_with_usage(role: str, system: str, prompt: str, *, structured: bool = False,
                               schema: dict | None = None, usage_out: list | None = None) -> tuple[dict, dict]:
    """Obtiene JSON y uso real cuando el proveedor lo expone; desconocido queda nulo."""
    spec = roles_config()["roles"][role]
    # Optativo: los roles anteriores conservan su adaptador y sus reintentos.
    if spec.get("structured_agent"):
        return await _role_json(role, spec, system, prompt, schema=schema, usage_out=usage_out)
    from src.core.image_posts.trace import add_call, model_step, now
    started = time.monotonic()
    stamp = now()
    adapter = text_for(role)
    try:
        measured = getattr(adapter, "complete_json_with_usage", None)
        if measured is not None:
            options = {"structured": True} if structured and provider_for(role) == "deepseek" else {}
            result, usage = await measured(system, prompt, **options)
        else:
            result = await adapter.complete_json(system, prompt)
            usage = {"provider": provider_for(role), "model": getattr(adapter, "_model", None),
                     "input_tokens": None, "output_tokens": None, "seconds": time.monotonic()-started}
    except Exception as exc:
        add_call({"call_id": uuid.uuid4().hex, "used_at": stamp, "step": model_step.get() or role,
            "role": role, "provider": provider_for(role), "model": getattr(adapter, "_model", None),
            "attempt": 1, "status": "failed", "error": str(exc), "seconds": round(time.monotonic()-started, 3),
            **getattr(exc, "usage", {})})
        raise
    measured = {**usage, "role": role, "call_id": uuid.uuid4().hex, "used_at": stamp,
                "step": model_step.get() or role, "status": "ok", "attempt": 1, "fallback": False}
    add_call(measured)
    return result, measured


def _validate_json(value: object, schema: dict | None) -> dict:
    if not isinstance(value, dict):
        raise ValueError("La respuesta JSON debe ser un objeto")
    if schema is not None:
        from jsonschema import Draft202012Validator
        error = next(Draft202012Validator(schema).iter_errors(value), None)
        if error is not None:
            raise ValueError("JSON fuera de esquema: " + error.message[:400])
    return value


async def _role_json(role, spec, system, prompt, *, schema, usage_out):
    """JSON por el mismo AgentRunnerPort; respaldo solo por fallos operativos/JSON.

    Cada intento se archiva, incluidos errores sin tokens informados. Un rechazo
    editorial válido es una respuesta exitosa y nunca activa el respaldo.
    """
    from src.adapters.agent.factory import get_agent
    from src.adapters.ai.factory import get_text_ai
    from src.core.ports.agent_port import AgentScope
    from src.config.exceptions import AIValidationError

    layout = layout_for_settings(settings)
    root = call_log_dir.get() or (layout.logs_dir / "model-calls" if layout.schema_version >= 2
                                  else settings.data_dir / "model-calls")
    folder = root / (role + "-" + uuid.uuid4().hex[:12])
    folder.mkdir(parents=True, exist_ok=True)
    log_id = None
    try:
        usage_key = (folder / "usage.json").resolve().relative_to(layout.root.resolve())
    except ValueError:
        pass  # La traza explícita puede vivir fuera del perfil.
    else:
        log_id = (await register_execution_log(usage_key, kind="model")).log_id
    schema_path = folder / "schema.json"
    if schema is not None:
        schema_path.write_text(json.dumps(schema, ensure_ascii=False), encoding="utf-8")
    full_prompt = ("Responde solo el JSON solicitado con el contexto adjunto. No uses herramientas, "
                   "no leas archivos ni investigues, no ejecutes comandos.\n\n" + system + "\n\n" + prompt)
    (folder / "prompt.txt").write_text(full_prompt, encoding="utf-8")
    primary = spec["provider"]
    fallback = spec.get("fallback")
    if isinstance(fallback, str):
        fallback = {"provider": fallback}
    attempts, fallback_reason = [], None
    started = time.monotonic()
    for index, current in enumerate([spec] + ([fallback] if fallback else [])):
        provider = current["provider"]
        alias = current.get("model", "")
        model = (roles_config()["providers"].get(provider, {}).get("models") or {}).get(alias, alias)
        timeout = float(current.get("timeout_seconds", spec.get("timeout_seconds", 180)))
        retries = min(1, int(current.get("invalid_json_retries", spec.get("invalid_json_retries", 1))))
        retry_notice = ""
        for retry in range(retries + 1):
            from src.core.image_posts.trace import add_call, model_step, now
            record = {"call_id": uuid.uuid4().hex, "used_at": now(), "step": model_step.get() or role, "role": role, "provider": provider, "model": model,
                      "reasoning_effort": current.get("reasoning_effort"), "attempt": retry + 1,
                      "fallback": bool(index), "fallback_reason": fallback_reason,
                      "input_tokens": None, "cached_input_tokens": None, "output_tokens": None,
                      "total_tokens": None, "reasoning_tokens": None,
                      "log_dir": str(folder), "log_id": log_id}
            tick = time.monotonic()
            failure = None
            try:
                if provider in AGENT_PROVIDERS:
                    runner = get_agent(provider)
                    if not runner.available():
                        raise RuntimeError("agent_unavailable")
                    response = await runner.run(full_prompt + retry_notice,
                        cwd=folder, log_path=folder / f"{provider}-{retry+1}.jsonl", timeout_seconds=timeout,
                        scope=AgentScope(writable_dir=".", read_only=True, model=model or None,
                            reasoning_effort=current.get("reasoning_effort"),
                            output_schema=schema_path if schema is not None else None))
                    record.update(response.usage)
                    record["model"] = response.model or model
                    if not response.ok:
                        raise RuntimeError("agent_timeout" if response.timed_out else f"agent_exit_{response.exit_code}")
                    try:
                        value = _validate_json(json.loads(response.last_message), schema)
                    except (ValueError, TypeError) as exc:
                        failure = "invalid_json: " + str(exc)[:450]
                        raise ValueError(failure) from exc
                else:
                    # DeepSeekAdapter es directo: no usa la cadena que puede llamar Gemini.
                    adapter = get_text_ai(provider)
                    if model:
                        adapter._model = model
                    record["model"] = getattr(adapter, "_model", model)
                    if hasattr(adapter, "_max_retries"):
                        adapter._max_retries = 1
                    if hasattr(adapter, "_client") and hasattr(adapter._client, "with_options"):
                        adapter._client = adapter._client.with_options(max_retries=0)
                    value, measured = await asyncio.wait_for(
                        adapter.complete_json_with_usage(system + ("\nJSON Schema obligatorio: " + json.dumps(schema, ensure_ascii=False) if schema else ""),
                            prompt + retry_notice, structured=True), timeout=timeout)
                    record.update(measured)
                    (folder / f"{provider}-{retry+1}.last.json").write_text(json.dumps(value,ensure_ascii=False),encoding="utf-8")
                    try:
                        value = _validate_json(value, schema)
                    except ValueError as exc:
                        failure = "invalid_json: " + str(exc)[:450]
                        raise
                record["status"] = "ok"
            except Exception as exc:
                record.update(getattr(exc, "usage", {}))
                failure = failure or ("invalid_json: " + type(exc).__name__ if isinstance(exc, AIValidationError)
                    else "timeout" if isinstance(exc, asyncio.TimeoutError)
                    else str(exc) if isinstance(exc, RuntimeError) and str(exc).startswith("agent_")
                    else type(exc).__name__)
                record.update(status="failed", error=failure)
            record["seconds"] = round(time.monotonic() - tick, 3)
            if record.get("total_tokens") is None and record.get("input_tokens") is not None and record.get("output_tokens") is not None:
                record["total_tokens"] = record["input_tokens"] + record["output_tokens"]
            add_call(record)
            attempts.append(record)
            if usage_out is not None:
                usage_out.append(record)
            (folder / "usage.json").write_text(json.dumps(attempts, ensure_ascii=False, indent=2), encoding="utf-8")
            log.info("model_hub_call role=%s provider=%s status=%s fallback=%s reason=%s seconds=%s tokens=%s log=%s",
                     role, provider, record["status"], bool(index), fallback_reason or failure,
                     record["seconds"], record.get("total_tokens"), folder)
            if failure is None:
                return value, {**record, "seconds": round(time.monotonic()-started, 3), "attempts": attempts,
                               "requested_provider": primary}
            retry_notice = "\nEl intento anterior no respetó el JSON/esquema. Corrige este error concreto: " + failure
            if not failure.startswith("invalid_json:") or retry == retries:
                if index == 0:
                    fallback_reason = failure
                break
    raise RuntimeError(f"model hub: {role} agotó proveedores; ver {folder}/usage.json")


def describe() -> list[dict]:
    """[{role, provider, model, billing, does}] para la web y los reportes."""
    cfg = roles_config()
    out = []
    for role, spec in cfg["roles"].items():
        provider = spec["provider"]
        out.append({
            "role": role,
            "provider": provider,
            "model": model_for(role),
            "billing": cfg["providers"].get(provider, {}).get("billing", ""),
            "does": spec.get("does", ""),
        })
    return out

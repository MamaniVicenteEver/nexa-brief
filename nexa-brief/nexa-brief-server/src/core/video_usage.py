"""Measured AI calls associated with one profile-local video.

Detailed attempts use the existing usage traces in logs/. The content record
in data/ keeps the totals; retries and failed calls remain part of the bill.
"""
from __future__ import annotations

from contextvars import ContextVar
from dataclasses import dataclass
import json
from pathlib import Path
import re
import time
import uuid

from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.ports.ai_port import AIPort


@dataclass(frozen=True)
class VideoCall:
    video_id: str
    content_key: str
    operation: str


current_video_call: ContextVar[VideoCall | None] = ContextVar("video_ai_call", default=None)


def for_video(ai, job, operation: str):
    layout = layout_for_settings(settings)
    if ai is None or layout.schema_version < 2 or job.artifacts.output_dir is None:
        return ai
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", job.job_id):
        raise ValueError("Identificador de video inválido")
    output = job.artifacts.output_dir.resolve()
    root = layout.root.resolve()
    if not output.is_relative_to(layout.productions_dir.resolve()):
        raise ValueError("El video no pertenece a las producciones del perfil activo")
    return VideoAI(ai, VideoCall(job.job_id, output.relative_to(root).as_posix(), operation))


class VideoAI(AIPort):
    def __init__(self, ai, call: VideoCall):
        self.ai, self.call = ai, call

    async def _record(self, trace_id: str, measured: dict, error, started: float) -> None:
        from src.core.data import collection, coordination
        from src.core.content_registry import update_video_details
        from src.core.explainer.usage_traces import events_for_content, record_trace

        attempts = getattr(error, "usage_attempts", None) if error else None
        attempts = attempts or measured.get("attempts") or [measured]
        for index, usage in enumerate(attempts, 1):
            status = usage.get("status") or ("failed" if error else "ok")
            await record_trace({
                **usage, "trace_id": trace_id, "attempt": index,
                "provider": usage.get("provider") or getattr(self.ai, "name", type(self.ai).__name__),
                "model": usage.get("model") or getattr(self.ai, "_model", ""),
                "operation": self.call.operation, "source": "video_ai",
                "run_id": self.call.video_id, "status": status,
                "error_type": usage.get("error_type") or (type(error).__name__ if error else ""),
                "seconds": usage.get("seconds", round(time.monotonic() - started, 3)),
            }, content_key=self.call.content_key)
        logs = collection("execution_logs")
        ref = logs.first({"trace_id": trace_id, "kind": "usage_trace"})
        if ref:
            await logs.update(ref["log_id"], {"video_id": self.call.video_id, "production_id": self.call.video_id})
        async with coordination("content-video-usage-" + self.call.video_id):
            events = events_for_content(self.call.content_key)
            fields = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens", "total_tokens")
            def totals(rows):
                result = {field: sum(r[field] for r in rows if isinstance(r.get(field), int)) for field in fields}
                result.update(calls=len(rows), unmeasured_calls=sum(not r.get("usage_known") for r in rows))
                return result
            summary = {
                **totals(events),
                "by_step": {step: totals([r for r in events if r["step"] == step]) for step in sorted({r["step"] for r in events})},
                "trace_ids": sorted({r["trace_id"] for r in events}),
            }
            await update_video_details(self.call.video_id, {"usage": summary})
            layout = layout_for_settings(settings)
            target = layout.logs_dir / "jobs" / self.call.video_id / "usage.json"
            if any(p.is_symlink() for p in (target, *target.parents)):
                raise ValueError("El resumen de uso no puede atravesar enlaces simbólicos")
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
            key = target.relative_to(layout.root).as_posix()
            if not logs.first({"key": key}):
                from src.core.execution_logs import register_execution_log
                await register_execution_log(key, kind="usage_summary", video_id=self.call.video_id,
                                             production_id=self.call.video_id, content_key=self.call.content_key)

    async def _invoke(self, operation: str, *args, **kwargs):
        trace_id, started = uuid.uuid4().hex, time.monotonic()
        token = current_video_call.set(self.call)
        measured = {}
        try:
            method = getattr(self.ai, operation + "_with_usage", None)
            if callable(method):
                raw, measured = await method(*args, **kwargs)
            else:
                raw = await getattr(self.ai, operation)(*args, **kwargs)
        except Exception as exc:
            await self._record(trace_id, getattr(exc, "usage", {}) or {}, exc, started)
            raise
        else:
            await self._record(trace_id, measured, None, started)
            return raw
        finally:
            current_video_call.reset(token)

    async def complete_json(self, system_prompt: str, user_prompt: str) -> dict:
        return await self._invoke("complete_json", system_prompt, user_prompt)

    async def complete_text(self, system_prompt: str, user_prompt: str) -> str:
        return await self._invoke("complete_text", system_prompt, user_prompt)

    async def analyze_image(self, image_path: Path, criteria: list[str]) -> dict:
        return await self._invoke("analyze_image", image_path, criteria)

    async def analyze_image_full(self, image_path: Path, system_prompt: str, *, max_output_tokens: int | None = None) -> dict:
        return await self._invoke("analyze_image_full", image_path, system_prompt, max_output_tokens=max_output_tokens)

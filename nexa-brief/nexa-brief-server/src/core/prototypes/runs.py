"""Ejecución persistente y acotada del agente líder de prototipos."""

from __future__ import annotations

import asyncio
import json
import re
import shutil
import sys
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Callable

import structlog

from src.adapters.models.hub import roles_config
from src.config.settings import BASE_DIR, settings
from src.core.data import collection
from src.core.explainer.producer import readable_log
from src.core.prototypes import briefs, ideas
from src.core.ports.agent_port import AgentRunnerPort, AgentScope

logger = structlog.get_logger(__name__)

_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
ACTIVE_STATES = {"queued", "running"}
LEAD_COMMANDS = (
    ".venv/bin/python src/templates/_tools/sandbox/",
    "src/templates/_tools/sandbox/delegate.sh",
    "ffmpeg",
    "ffprobe",
    "rg",
    "ls",
    "cat",
    "head",
    "curl http://127.0.0.1:8000",
)


class PrototypeRunState(str, Enum):
    queued = "queued"
    running = "running"
    done = "done"
    failed = "failed"
    cancelled = "cancelled"


class RunConflictError(ValueError):
    """El identificador de plantilla ya está usado o reservado por otro run."""


AgentGetter = Callable[[str], AgentRunnerPort]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _leader_model(agent: str) -> tuple[str, str]:
    """Resuelve el proveedor pedido contra prototype_lead y su alternativa."""
    lead = roles_config()["roles"]["prototype_lead"]
    selected = lead if lead.get("provider") == agent else lead.get("fallback")
    if not selected or selected.get("provider") != agent:
        raise ValueError(f"prototype_lead no tiene una configuración para {agent}.")
    return str(selected.get("model") or ""), str(selected.get("reasoning_effort") or "")


def _number(usage: dict, name: str) -> int:
    try:
        return max(0, int(usage.get(name) or 0))
    except (TypeError, ValueError):
        return 0


class PrototypeRunService:
    """Cola global de un líder activo, con estado y logs persistidos."""

    def __init__(
        self,
        agent_getter: AgentGetter | None = None,
        *,
        timeout_seconds: float | None = None,
    ) -> None:
        if agent_getter is None:
            from src.adapters.agent.factory import get_agent

            agent_getter = get_agent
        self._agent_getter = agent_getter
        self._timeout_seconds = timeout_seconds or settings.agent_production_timeout_seconds
        self._tasks: dict[str, asyncio.Task] = {}
        self._active_run_id: str | None = None
        self._recovered = False

    @staticmethod
    def _col():
        return collection("prototype_runs")

    @property
    def sandbox_dir(self) -> Path:
        return settings.templates_dir / "sandbox"

    @property
    def log_dir(self) -> Path:
        return settings.data_dir / "prototypes" / "logs"

    async def recover_interrupted(self) -> int:
        """Marca como fallidos los líderes huérfanos y reactiva la cola guardada."""
        if self._recovered:
            return 0
        self._recovered = True
        fixed = 0
        for rec in self._col().list():
            if rec.get("state") == PrototypeRunState.running.value:
                await self._update(
                    rec["run_id"],
                    state=PrototypeRunState.failed.value,
                    error="interrumpido: el servidor se reinició mientras corría el agente",
                    finished_at=_now(),
                )
                fixed += 1
        self._start_next()
        return fixed

    def list(self, category: str, slug: str) -> list[dict]:
        rows = [
            row for row in self._col().list()
            if row.get("category") == category and row.get("idea_id") == slug
        ]
        return sorted(rows, key=lambda row: row.get("created_at", ""), reverse=True)

    def get(self, run_id: str) -> dict | None:
        return self._col().get(run_id)

    def log_tail(self, run_id: str, chars: int = 10000) -> str:
        rec = self.get(run_id)
        if not rec or not rec.get("log_path"):
            return ""
        try:
            raw = Path(rec["log_path"]).read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""
        return readable_log(raw)[-chars:]

    async def submit(
        self,
        *,
        category: str,
        slug: str,
        agent: str,
        template_id: str,
        mode: str,
    ) -> dict:
        await self.recover_interrupted()
        ideas.get_idea(category, slug)
        if agent not in {"claude", "codex"}:
            raise ValueError("agent debe ser claude o codex")
        if mode not in {"full", "smoke"}:
            raise ValueError("mode debe ser full o smoke")
        if not _SLUG.fullmatch(template_id):
            raise ValueError("template_id debe ser un identificador slug en minúsculas")

        # El protocolo smoke usa un nombre predecible y efímero, como indica PROTOTIPO.md.
        effective_template_id = f"zz-smoke-{slug}" if mode == "smoke" else template_id
        template_path = self.sandbox_dir / category / effective_template_id
        if template_path.exists():
            raise RunConflictError(f"Ya existe la plantilla sandbox/{category}/{effective_template_id}.")
        if any(
            row.get("category") == category
            and row.get("template_id") == effective_template_id
            and row.get("state") in ACTIVE_STATES
            for row in self._col().list()
        ):
            raise RunConflictError("Ya hay un run activo o en cola para ese template_id.")

        runner = self._agent_getter(agent)
        if not runner.available():
            raise ValueError(f"El agente local '{agent}' no está disponible en este servidor.")
        model, effort = _leader_model(agent)
        run_id = uuid.uuid4().hex[:12]
        log_path = self.log_dir / f"{run_id}.log"
        record = {
            "run_id": run_id,
            "category": category,
            "idea_id": slug,
            "template_id": effective_template_id,
            "agent": agent,
            "model": model,
            "reasoning_effort": effort,
            "mode": mode,
            "state": PrototypeRunState.queued.value,
            "error": None,
            "claude_usage": None,
            "codex_usage": None,
            "tokens": None,
            "usage_recorded": False,
            "log_path": str(log_path),
            "created_at": _now(),
            "started_at": None,
            "finished_at": None,
            "updated_at": _now(),
        }
        await self._col().insert(record)
        logger.info("prototype_run_queued", run_id=run_id, category=category, idea_id=slug, agent=agent)
        self._start_next()
        return record

    async def cancel(self, run_id: str) -> dict | None:
        rec = self.get(run_id)
        if rec is None:
            return None
        state = rec.get("state")
        if state not in ACTIVE_STATES:
            raise ValueError("el run ya terminó")
        if state == PrototypeRunState.queued.value:
            await self._update(
                run_id,
                state=PrototypeRunState.cancelled.value,
                finished_at=_now(),
                error="cancelado antes de iniciar",
            )
            return self.get(run_id)

        task = self._tasks.get(run_id)
        if task:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        return self.get(run_id)

    def _start_next(self) -> None:
        if self._active_run_id is not None:
            return
        queued = [row for row in self._col().list() if row.get("state") == PrototypeRunState.queued.value]
        if not queued:
            return
        queued.sort(key=lambda row: row.get("created_at", ""))
        run_id = queued[0]["run_id"]
        self._active_run_id = run_id
        task = asyncio.create_task(self._run(run_id))
        self._tasks[run_id] = task
        task.add_done_callback(lambda _task, key=run_id: self._tasks.pop(key, None))

    async def _update(self, run_id: str, **patch: Any) -> None:
        await self._col().update(run_id, {**patch, "updated_at": _now()})

    def _scope(self, rec: dict) -> AgentScope:
        # Claude Code recibe herramientas de escritura y comandos con prefijos
        # explícitos. No se habilitan Bash libre ni acceptEdits global.
        return AgentScope(
            writable_dir="src/templates/sandbox",
            commands=LEAD_COMMANDS,
            os_sandbox_dir="src/templates/sandbox",
            extra_writable=("/tmp",),
            model=rec.get("model") or None,
            reasoning_effort=rec.get("reasoning_effort") or None,
        )

    def _prompt(self, rec: dict) -> str:
        proto = (self.sandbox_dir / "PROTOTIPO.md").resolve()
        brief = (self.sandbox_dir / "referencias" / rec["category"] / rec["idea_id"] / "BRIEF.md").resolve()
        return (
            "Sos el agente líder. Tu cwd ya es la raíz de nexa-brief-server; no hagas cd. "
            "Para ejecutar scripts, usá exactamente los prefijos permitidos desde ese cwd: "
            ".venv/bin/python src/templates/_tools/sandbox/ y "
            "src/templates/_tools/sandbox/delegate.sh. El backend registra tus tokens reales; "
            "no registres manualmente el rol prototype_lead con info.py. "
            "Leé "
            f"{proto} y el brief {brief}.\n"
            f"template_id={rec['template_id']}\nmode={rec['mode']}"
        )

    def _smoke_failure(self, rec: dict) -> str | None:
        """Comprueba el artefacto smoke y que delegate.sh ejecutó a Codex."""
        root = self.sandbox_dir.resolve()
        template_dir = self.sandbox_dir / rec["category"] / rec["template_id"]
        expected_reference = f"referencias/{rec['category']}/{rec['idea_id']}"
        try:
            resolved = template_dir.resolve(strict=True)
            if template_dir.is_symlink() or not resolved.is_relative_to(root):
                return "smoke incompleto: la carpeta temporal no es una carpeta sandbox segura"
            info = json.loads((resolved / "info.json").read_text(encoding="utf-8"))
            if info.get("reference") != expected_reference:
                return "smoke incompleto: la plantilla no conserva la referencia de origen"
            result_path = resolved / "work" / "results" / "smoke.md"
            worker_log = resolved / "work" / "logs" / "smoke.log"
            if result_path.is_symlink() or not result_path.is_file():
                return "smoke incompleto: falta work/results/smoke.md"
            if worker_log.is_symlink() or not worker_log.is_file():
                return "smoke incompleto: delegate.sh no dejó el log del trabajador Codex"
            result_text = result_path.read_text(encoding="utf-8", errors="replace")
            worker_text = worker_log.read_text(encoding="utf-8", errors="replace")
            if "ok" not in result_text.lower():
                return "smoke incompleto: work/results/smoke.md no contiene OK"
            if "Trabajador Codex · modelo=" not in worker_text or "EXIT 0" not in worker_text:
                return "smoke incompleto: el trabajador Codex no terminó correctamente"
        except (OSError, json.JSONDecodeError):
            return "smoke incompleto: no se creó una plantilla temporal válida"
        return None

    async def _run(self, run_id: str) -> None:
        rec = self.get(run_id)
        if rec is None:
            self._active_run_id = None
            self._start_next()
            return
        log_path = Path(rec["log_path"])
        log_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            await self._update(run_id, state=PrototypeRunState.running.value, started_at=_now())
            # El brief siempre refleja el estado actual de las notas y adjuntos al momento de lanzar.
            briefs.compose_brief(rec["category"], rec["idea_id"])
            agent = self._agent_getter(rec["agent"])
            result = await agent.run(
                self._prompt(rec),
                cwd=BASE_DIR,
                log_path=log_path,
                timeout_seconds=self._timeout_seconds,
                scope=self._scope(rec),
            )
            state = PrototypeRunState.done.value if result.ok else PrototypeRunState.failed.value
            error = None if result.ok else (
                "el agente agotó el tiempo de ejecución" if result.timed_out
                else f"el agente terminó con código {result.exit_code}"
            )
            if state == PrototypeRunState.done.value and rec["mode"] == "smoke":
                smoke_error = self._smoke_failure(rec)
                if smoke_error:
                    state = PrototypeRunState.failed.value
                    error = smoke_error
            await self._finish(rec, state, result.usage, result.model or rec.get("model") or rec["agent"], error)
        except asyncio.CancelledError:
            usage, model = self._usage_from_log(rec, log_path)
            await self._finish(rec, PrototypeRunState.cancelled.value, usage, model, "run cancelado")
        except Exception as exc:  # noqa: BLE001 - el error queda persistido para la interfaz
            logger.exception("prototype_run_failed", run_id=run_id)
            usage, model = self._usage_from_log(rec, log_path)
            await self._finish(rec, PrototypeRunState.failed.value, usage, model, str(exc)[-1000:])
        finally:
            if self._active_run_id == run_id:
                self._active_run_id = None
            self._start_next()

    def _usage_from_log(self, rec: dict, log_path: Path) -> tuple[dict, str]:
        try:
            if rec["agent"] == "claude":
                from src.adapters.agent.infrastructure.cli_runner import claude_usage

                return claude_usage(log_path)
            from src.adapters.agent.infrastructure.cli_runner import codex_usage

            return codex_usage(log_path), rec.get("model") or "codex"
        except OSError:
            return {}, rec.get("model") or rec["agent"]

    async def _finish(
        self,
        rec: dict,
        state: str,
        usage: dict,
        model: str,
        error: str | None,
    ) -> None:
        input_tokens = _number(usage, "input_tokens")
        cached_tokens = _number(usage, "cached_input_tokens")
        output_tokens = _number(usage, "output_tokens")
        reasoning_tokens = _number(usage, "reasoning_tokens")
        tokens = {
            "input_tokens": input_tokens,
            "cached_input_tokens": cached_tokens,
            "output_tokens": output_tokens,
            "reasoning_tokens": reasoning_tokens,
            "total_tokens": input_tokens + output_tokens,
            "turns": _number(usage, "turns"),
            "cost_usd": usage.get("cost_usd"),
            "provider": rec["agent"],
            "model": model or rec.get("model") or rec["agent"],
        }
        usage_field = "claude_usage" if rec["agent"] == "claude" else "codex_usage"
        patch: dict[str, Any] = {
            "tokens": tokens,
            usage_field: usage,
            "usage_recorded": False,
        }
        await self._update(rec["run_id"], **patch)

        template_dir = self.sandbox_dir / rec["category"] / rec["template_id"]
        usage_recorded = False
        if (template_dir / "info.json").is_file():
            usage_recorded = await self._record_template_usage(rec, template_dir, tokens)
        if rec["mode"] == "smoke":
            self._cleanup_smoke(rec, template_dir)
        await self._update(
            rec["run_id"],
            state=state,
            error=error,
            finished_at=_now(),
            usage_recorded=usage_recorded,
        )

    async def _record_template_usage(self, rec: dict, template_dir: Path, tokens: dict) -> bool:
        info_script = settings.templates_dir / "_tools" / "sandbox" / "info.py"
        args = [
            sys.executable,
            str(info_script),
            "add-usage",
            f"{rec['category']}/{rec['template_id']}",
            "--provider", rec["agent"],
            "--model", tokens["model"],
            "--role", "prototype_lead",
            "--in", str(tokens["input_tokens"]),
            "--out", str(tokens["output_tokens"]),
            "--cached", str(tokens["cached_input_tokens"]),
            "--reasoning", str(tokens["reasoning_tokens"]),
        ]
        try:
            proc = await asyncio.create_subprocess_exec(
                *args,
                cwd=str(BASE_DIR),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            output, _ = await asyncio.wait_for(proc.communicate(), timeout=30)
            if proc.returncode == 0:
                return True
            logger.warning(
                "prototype_usage_record_failed",
                run_id=rec["run_id"],
                output=output.decode("utf-8", "replace")[-600:],
            )
        except (OSError, asyncio.TimeoutError) as exc:
            logger.warning("prototype_usage_record_failed", run_id=rec["run_id"], error=str(exc))
        return False

    def _cleanup_smoke(self, rec: dict, template_dir: Path) -> None:
        """Borra solo la carpeta smoke creada para esta idea y con su referencia intacta."""
        root = self.sandbox_dir.resolve()
        try:
            resolved = template_dir.resolve(strict=True)
            if (
                not resolved.is_relative_to(root)
                or template_dir.is_symlink()
                or not template_dir.name.startswith("zz-smoke-")
            ):
                return
            info = json.loads((resolved / "info.json").read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return
        expected_reference = f"referencias/{rec['category']}/{rec['idea_id']}"
        if info.get("reference") == expected_reference:
            shutil.rmtree(resolved)


"""Sesiones durables de propuesta y revisión de promociones."""

from __future__ import annotations
import asyncio
import copy
import json
import logging
import math
import re
import uuid
from pathlib import Path
from contextlib import AsyncExitStack
from datetime import datetime, timezone

from src.config.content_paths import sandbox_root
from src.config.settings import settings
from src.core.data import collection, coordination
from src.core.explainer.agent_context import _safe, ensure_private_workspace
from src.core.nodemotion.promo.prompts import TEMPLATES, reference
from src.core.task_ownership import start_owned_task, task_is_owned
from . import agents, usage

ACTIVE = {"queued", "running"}
logger = logging.getLogger(__name__)


def now():
    return datetime.now(timezone.utc).isoformat()


def draft_fingerprint(draft):
    """Huella de datos, job y archivos compartida con la guarda de grabación."""
    from .readiness import snapshot_fingerprint

    return snapshot_fingerprint(draft)


def merge_quality(current, previous):
    """Renueva controles estructurales y conserva la evidencia complementaria."""
    result = dict(current)
    previous = previous if isinstance(previous, dict) else {}
    checks = list(result.get("checks") or [])
    ids = {entry.get("id") for entry in checks if isinstance(entry, dict)}
    extra = [
        entry for entry in (previous.get("checks") or []) if isinstance(entry, dict) and entry.get("id") not in ids
    ]
    result["checks"] = checks + extra
    result["warnings"] = list(dict.fromkeys([*(result.get("warnings") or []), *(previous.get("warnings") or [])]))
    for key in ("visual_report", "evidence_report"):
        if key in previous:
            result[key] = previous[key]
    failed_extra = [
        entry.get("label") or entry.get("id") or "Comprobación complementaria"
        for entry in extra
        if entry.get("passed") is not True
    ]
    result["errors"] = list(dict.fromkeys([*(result.get("errors") or []), *failed_extra]))
    result["passed"] = result.get("passed") is True and not failed_extra
    return result


def message(role, content):
    return {"id": uuid.uuid4().hex, "role": role, "content": content, "created_at": now()}


def legacy_prompt_reference(draft):
    """Devuelve solo la referencia de la que existe evidencia verificable."""
    details = draft.get("details") or {}
    value = details.get("promo_prompt_reference") if isinstance(details, dict) else None
    if value is None:
        return None
    if not isinstance(value, dict) or not isinstance(value.get("version"), str) or value != reference(value["version"]):
        raise ValueError("La referencia de prompts del borrador es inválida o fue alterada")
    return value


def _default_getter(name):
    from src.adapters.agent.factory import get_agent

    return get_agent(name)


class PromoChatService:
    def __init__(self, agent_getter=None, prepare=None):
        self.agent_getter = agent_getter or _default_getter
        self.prepare = prepare
        self.tasks = set()

    def _rows(self):
        return collection("promo_chat_sessions")

    def agents(self):
        return agents.statuses(
            self.agent_getter, agents.inspect_login if self.agent_getter is _default_getter else None
        )

    def _view(self, row):
        if row.get("state") == "ready":
            draft = collection("drafts").get(row.get("draft_id"))
            try:
                matches = bool(draft and row.get("reviewed_fingerprint") == draft_fingerprint(draft))
            except (OSError, ValueError):
                matches = False
            if (
                not draft
                or draft.get("status") != "prepared"
                or row.get("approved_revision") != row.get("revision")
                or not matches
            ):
                return {**row, "state": "review", "stage": "review", "approved_revision": None}
        return row

    def get(self, session_id):
        row = self._rows().get(session_id)
        if not row or row.get("archived_at"):
            raise LookupError("Sesión no encontrada")
        return self._view(row)

    def list(self, template_id):
        if template_id not in TEMPLATES:
            raise ValueError("Plantilla de promo desconocida")
        return sorted(
            (self._view(row) for row in self._rows().list(where={"template_id": template_id}) if not row.get("archived_at")),
            key=lambda x: x["created_at"],
            reverse=True,
        )

    def archived_draft_ids(self, template_id):
        """Mantiene ocultas las revisiones de sesiones retiradas sin borrar sus datos."""
        if template_id not in TEMPLATES:
            raise ValueError("Plantilla de promo desconocida")
        return sorted({draft_id for row in self._rows().list(where={"template_id": template_id})
                       if row.get("archived_at")
                       for draft_id in [row.get("draft_id"), *(row.get("draft_history") or [])] if draft_id})

    async def archive(self, session_id):
        from src.core import drafts

        initial = self.get(session_id)
        initial_ids = {initial.get("draft_id"), *(initial.get("draft_history") or [])} - {None}
        async with AsyncExitStack() as stack:
            # Mismo orden que import_legacy: primero cada draft, luego la sesión.
            for draft_id in sorted(initial_ids):
                await stack.enter_async_context(coordination("promo-chat-import-" + draft_id))
            await stack.enter_async_context(coordination("promo-chat-" + session_id))
            row = self.get(session_id)
            draft_ids = {row.get("draft_id"), *(row.get("draft_history") or [])} - {None}
            if draft_ids != initial_ids:
                raise ValueError("El prototipo cambió; actualiza la lista antes de eliminarlo")
            if row.get("state") in ACTIVE or task_is_owned("promo-chat", session_id):
                raise ValueError("No se puede eliminar un prototipo durante su preparación")
            for other in self._rows().list(where={"template_id": row["template_id"]}):
                if other.get("session_id") != session_id and not other.get("archived_at") and draft_ids.intersection({other.get("draft_id"), *(other.get("draft_history") or [])}):
                    raise ValueError("Una revisión de este prototipo está vinculada a otra sesión activa")
            for draft_id in draft_ids:
                draft = collection("drafts").get(draft_id)
                if draft and draft.get("original"):
                    raise ValueError("La demo original no se puede eliminar")
                if drafts.is_running(draft_id) or (draft and draft.get("status") in {"preparing", "rendering", "previewing"}):
                    raise ValueError("Espera a que termine el trabajo del prototipo")
            await self._rows().update(session_id, {"archived_at": now(), "updated_at": now()})

    def _report(self, row):
        try:
            from .reports import write_report

            write_report(row, self._project(row["session_id"]))
        except (OSError, ValueError, TypeError, KeyError) as exc:
            logger.warning("No se pudo escribir el informe de la promo: %s", type(exc).__name__)

    def _project(self, session_id):
        if len(session_id) != 32 or any(c not in "0123456789abcdef" for c in session_id):
            raise ValueError("Identificador inválido")
        return _safe(sandbox_root(), "nodemotion", session_id)

    async def create(self, template_id, text, provider=None):
        availability = self.agents()
        provider = provider or availability["default_provider"]
        if (
            template_id not in TEMPLATES
            or provider not in agents.PROVIDERS
            or not isinstance(text, str)
            or not text.strip()
            or len(text) > 12000
        ):
            raise ValueError("Solicitud de sesión inválida")
        if not any(item["provider"] == provider and item["available"] for item in availability["agents"]):
            raise ValueError("El proveedor elegido no está disponible o autenticado; selecciona un ejecutor habilitado")
        sid = uuid.uuid4().hex
        row = {
            "session_id": sid,
            "template_id": template_id,
            "provider": provider,
            "state": "queued",
            "stage": "queued",
            "revision": 1,
            "draft_id": None,
            "messages": [message("user", text.strip())],
            "error": None,
            "usage": usage.summarize([]),
            "quality": {"passed": False, "checks": [], "errors": [], "warnings": []},
            "prompt_ref": reference(),
            "draft_history": [],
            "approved_revision": None,
            "reviewed_fingerprint": None,
            "review_fingerprint": None,
            "created_at": now(),
            "updated_at": now(),
        }
        async with coordination("promo-chat-" + sid):
            await self._rows().insert(row)
            self._start(sid)
        return row

    async def send(self, session_id, text):
        if not isinstance(text, str) or not text.strip() or len(text) > 12000:
            raise ValueError("Mensaje inválido")
        async with coordination("promo-chat-" + session_id):
            row = self.get(session_id)
            current_draft = collection("drafts").get(row.get("draft_id")) if row.get("draft_id") else None
            if current_draft and current_draft.get("status") == "rendering":
                raise ValueError("Espera a que termine la grabación antes de enviar correcciones")
            if row["state"] in ACTIVE or task_is_owned("promo-chat", session_id):
                raise ValueError("Ya hay una revisión en curso")
            provider = row.get("provider") or self.agents()["default_provider"]
            patch = {
                "provider": provider,
                "resume_host": False,
                "manual_media_slots": [],
                "revision": row["revision"] + 1,
                "messages": [*row["messages"], message("user", text.strip())],
                "state": "queued",
                "stage": "queued",
                "draft_id": None,
                "error": None,
                "failed_stage": None,
                "quality": {"passed": False, "checks": [], "errors": [], "warnings": []},
                "draft_history": list(
                    dict.fromkeys([*row.get("draft_history", []), *([row["draft_id"]] if row.get("draft_id") else [])])
                ),
                "approved_revision": None,
                "reviewed_fingerprint": None,
                "review_fingerprint": None,
                "updated_at": now(),
            }
            row = await self._rows().update(session_id, patch)
            self._report(row)
            self._start(session_id)
            return row

    async def replace_media(self, session_id, revision, scene, slot, asset_id):
        if not isinstance(session_id, str) or not re.fullmatch(r"[0-9a-f]{32}", session_id):
            raise ValueError("Identificador de sesión inválido")
        if type(revision) is not int or revision < 1:
            raise ValueError("La revisión debe ser un entero positivo")
        if type(scene) is not int or not 1 <= scene <= 200:
            raise ValueError("La escena no es válida")
        if not isinstance(slot, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", slot):
            raise ValueError("El lugar de medios no es válido")
        if not isinstance(asset_id, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", asset_id):
            raise ValueError("El identificador del recurso no es válido")

        from jsonschema import Draft202012Validator, FormatChecker, ValidationError
        from src.config.exceptions import AssetNotFoundError
        from src.config.profile_layout import layout_for_settings
        from src.core import drafts
        from src.core.library import asset_library
        from .reports import _json, _target
        from .workspace import timeline

        async with coordination("promo-chat-" + session_id):
            row = self.get(session_id)
            if row.get("revision") != revision:
                raise ValueError("La revisión cambió; actualiza la ficha antes de reemplazar medios")
            if row.get("state") not in {"review", "ready"}:
                raise ValueError("La revisión actual no permite reemplazar medios")
            if row.get("state") in ACTIVE or task_is_owned("promo-chat", session_id):
                raise ValueError("Ya hay una revisión en curso")
            draft_id = row.get("draft_id")
            draft = collection("drafts").get(draft_id) if draft_id else None
            if not draft or draft.get("status") != "prepared" or drafts.is_running(draft_id):
                raise ValueError("El borrador ya no está preparado para revisión")
            if row.get("review_fingerprint") != draft_fingerprint(draft):
                raise ValueError("El borrador cambió después de la revisión")

            project = self._project(session_id)
            target = _target(project, session_id, revision)
            record = _json(target, "draft.json") if target else None
            plan = _json(target, "media-plan.json") if target else None
            if not isinstance(record, dict) or record.get("draft_id") != draft_id:
                raise ValueError("La revisión ya no coincide con su borrador")
            items = plan.get("items") if isinstance(plan, dict) else None
            if not isinstance(items, list) or len(items) > 200:
                raise ValueError("El plan de medios de la revisión no está disponible")
            matching = [
                item for item in items
                if isinstance(item, dict) and type(item.get("scene")) is int
                and item.get("scene") == scene and item.get("slot") == slot
            ]
            if len(matching) != 1:
                raise ValueError("La escena o el lugar ya no coincide con la revisión actual")
            kind = matching[0].get("kind")
            if kind not in {"image", "video"}:
                raise ValueError("El lugar seleccionado no admite medios visuales")
            slot_items = [item for item in items if isinstance(item, dict) and item.get("slot") == slot]
            if not slot_items or any(item.get("kind") != kind for item in slot_items):
                raise ValueError("El lugar compartido tiene tipos de medio incompatibles")

            resource_root = layout_for_settings(settings).resources_dir
            folder = "images" if kind == "image" else "videos"
            resource = _json(resource_root, folder, asset_id, "resource.json")
            if (
                not isinstance(resource, dict)
                or resource.get("id") != asset_id
                or resource.get("type") != kind
                or resource.get("approved") is False
            ):
                raise ValueError("El recurso no tiene una ficha Promo verificada y aprobada; elige otro medio o sugiérelo en el chat")
            schema_path = (
                Path(__file__).resolve().parents[3]
                / "templates" / "_tools" / "nodemotion" / "promo" / "production" / "schemas" / "resource.json"
            )
            try:
                schema = json.loads(schema_path.read_text(encoding="utf-8"))
                Draft202012Validator(schema, format_checker=FormatChecker()).validate(resource)
                entry = asset_library.get_entry(kind, asset_id)
                library_file = asset_library.resolve_asset_path(kind, asset_id).resolve(strict=True)
                filename = resource.get("file")
                resource_file = _safe(resource_root, folder, asset_id, filename).resolve(strict=True)
                if (
                    entry is None
                    or getattr(entry, "asset_id", None) != asset_id
                    or not library_file.is_file()
                    or library_file != resource_file
                ):
                    raise ValueError("El recurso no coincide con su archivo de Biblioteca")
                if kind == "video":
                    ready_name = resource.get("ready_file")
                    ready_file = _safe(resource_root, folder, asset_id, ready_name).resolve(strict=True)
                    if not ready_file.is_file():
                        raise ValueError("Falta la versión preparada del video")
            except (AssetNotFoundError, OSError, TypeError, ValueError, ValidationError) as exc:
                raise ValueError("El recurso no tiene archivos y licencia compatibles con Promo") from exc

            orientations = {item.get("orientation", "landscape") for item in slot_items}
            if len(orientations) != 1 or resource.get("orientation") not in orientations:
                raise ValueError("El recurso no coincide con la orientación del lugar")
            if kind == "video":
                try:
                    segments = timeline(target).get("segments")
                    if not isinstance(segments, list):
                        raise ValueError("falta el ritmo de las escenas")
                    duration = resource.get("duration_seconds")
                    if isinstance(duration, bool) or not isinstance(duration, (int, float)) or not math.isfinite(duration):
                        raise ValueError("duración no válida")
                    for item in slot_items:
                        number = item.get("scene")
                        if type(number) is not int or not 1 <= number <= len(segments):
                            raise ValueError("escena fuera del ritmo")
                        segment = segments[number - 1]
                        required = float(segment["end"]) - float(segment["start"])
                        minimum = item.get("minimum_duration_seconds", 0)
                        if isinstance(minimum, bool) or not isinstance(minimum, (int, float)) or not math.isfinite(minimum):
                            raise ValueError("duración mínima no válida")
                        if duration + 1e-6 < max(required, minimum):
                            raise ValueError("el video es demasiado corto para una de sus escenas")
                except (OSError, KeyError, TypeError, ValueError) as exc:
                    raise ValueError("El video no dura lo suficiente para todas las escenas del lugar") from exc

            proposal = copy.deepcopy(row.get("proposal"))
            if not isinstance(proposal, dict):
                raise ValueError("La propuesta de la revisión ya no está disponible")
            next_items = []
            stored_manual_slots = row.get("manual_media_slots")
            manual_slots = {
                (item.get("scene"), item.get("slot"))
                for item in stored_manual_slots if isinstance(item, dict)
                and type(item.get("scene")) is int and isinstance(item.get("slot"), str)
            } if isinstance(stored_manual_slots, list) else set()
            for item in items:
                if not isinstance(item, dict):
                    raise ValueError("El plan de medios de la revisión no es válido")
                next_item = dict(item)
                if next_item.get("slot") == slot:
                    next_item["asset_id"] = asset_id
                    next_item.pop("provider", None)
                    next_item.pop("provider_id", None)
                    next_item.pop("sha256", None)
                    manual_slots.add((next_item.get("scene"), slot))
                next_items.append(next_item)
                if item.get("manual_selection") is True:
                    manual_slots.add((item.get("scene"), item.get("slot")))
            proposal["media_plan"] = {"items": next_items}
            manual_media_slots = [
                {"scene": number, "slot": name}
                for number, name in sorted(manual_slots, key=lambda value: (value[0], value[1]))
            ]
            previous = list(row.get("draft_history") or [])
            if draft_id not in previous:
                previous.append(draft_id)
            scenes = ", ".join(str(item.get("scene")) for item in slot_items)
            queued = await self._rows().update(
                session_id,
                {
                    "revision": revision + 1,
                    "state": "queued",
                    "stage": "queued",
                    "resume_host": True,
                    "manual_media_slots": manual_media_slots,
                    "proposal": proposal,
                    "messages": [*row.get("messages", []), message(
                        "user", f"Reemplazo directo del lugar {slot} en las escenas {scenes}; recurso {asset_id}."
                    )],
                    "draft_id": None,
                    "draft_history": previous,
                    "error": None,
                    "failed_stage": None,
                    "quality": {"passed": False, "checks": [], "errors": [], "warnings": []},
                    "approved_revision": None,
                    "reviewed_fingerprint": None,
                    "review_fingerprint": None,
                    "updated_at": now(),
                },
            )
            self._report(queued)
            self._start(session_id)
            return queued

    async def retry(self, session_id):
        """Reanuda el host con la propuesta persistida, sin volver a inferirla."""
        async with coordination("promo-chat-" + session_id):
            row = self._rows().get(session_id)
            if not row or row.get("archived_at"):
                raise LookupError("Sesión no encontrada")
            if row.get("state") not in {"failed", "review"} or task_is_owned("promo-chat", session_id):
                raise ValueError("La sesión no permite reintentar mientras está activa o aprobada")
            current_draft = collection("drafts").get(row.get("draft_id")) if row.get("draft_id") else None
            if current_draft and current_draft.get("status") == "rendering":
                raise ValueError("Espera a que termine la grabación antes de reintentar")
            proposal, context, prompt_ref = row.get("proposal"), row.get("source_context"), row.get("prompt_ref")
            try:
                agents.decode(json.dumps(proposal, ensure_ascii=False))
                if (
                    not isinstance(context, list)
                    or sum(
                        isinstance(item, dict) and bool(item.get("url")) and bool(item.get("text")) for item in context
                    )
                    < 2
                ):
                    raise ValueError("contexto ausente")
                if (
                    not isinstance(prompt_ref, dict)
                    or not prompt_ref.get("version")
                    or not isinstance(prompt_ref.get("hashes"), dict)
                ):
                    raise ValueError("referencia ausente")
            except (TypeError, ValueError):
                raise ValueError(
                    "Falta la propuesta, las fuentes o su referencia; envía una corrección para prepararla de nuevo"
                ) from None
            row = await self._rows().update(
                session_id,
                {
                    "state": "queued",
                    "stage": "queued",
                    "resume_host": True,
                    "error": None,
                    "failed_stage": None,
                    "quality": {"passed": False, "checks": [], "errors": [], "warnings": []},
                    "approved_revision": None,
                    "reviewed_fingerprint": None,
                    "review_fingerprint": None,
                    "updated_at": now(),
                },
            )
            self._report(row)
            self._start(session_id)
            return row

    async def approve(self, session_id, revision):
        async with coordination("promo-chat-" + session_id):
            row = self.get(session_id)
            if (
                row["state"] != "review"
                or row["revision"] != revision
                or not row.get("draft_id")
                or row.get("quality", {}).get("passed") is not True
            ):
                raise ValueError("La revisión actual no está lista para aprobación")
            draft = collection("drafts").get(row["draft_id"])
            if not draft or draft.get("status") != "prepared":
                raise ValueError("El borrador no está preparado")
            if row.get("review_fingerprint") != draft_fingerprint(draft):
                raise ValueError("El borrador cambió después de la revisión")
            from .pipeline import inspect_existing

            quality = await inspect_existing(row["draft_id"])
            if not isinstance(quality, dict):
                raise ValueError("No se pudo evaluar el borrador")
            quality = merge_quality(quality, row["quality"])
            if quality.get("passed") is not True:
                updated = await self._rows().update(session_id, {"quality": quality, "updated_at": now()})
                self._report(updated)
                raise ValueError("La calidad del borrador no permite aprobar")
            current = collection("drafts").get(row["draft_id"])
            if (
                not current
                or current.get("status") != "prepared"
                or draft_fingerprint(current) != row.get("review_fingerprint")
            ):
                raise ValueError("El borrador cambió después de la revisión")
            result = await self._rows().update(
                session_id,
                {
                    "state": "ready",
                    "stage": "ready",
                    "quality": quality,
                    "approved_revision": revision,
                    "reviewed_fingerprint": draft_fingerprint(current),
                    "updated_at": now(),
                },
            )
            self._report(result)
            return result

    async def import_legacy(self, draft_id):
        async with coordination("promo-chat-import-" + draft_id):
            draft = collection("drafts").get(draft_id)
            if not draft:
                raise LookupError("Borrador no encontrado")
            if draft.get("original"):
                raise ValueError("La demo original ya está disponible en Listos para grabar")
            template_id = draft.get("template_id")
            if template_id not in TEMPLATES or draft.get("status") != "prepared":
                raise ValueError("El borrador de promo debe estar preparado")
            source_ref = legacy_prompt_reference(draft)
            from .pipeline import inspect_existing

            for existing in self._rows().list():
                if existing.get("archived_at") and draft_id in [existing.get("draft_id"), *(existing.get("draft_history") or [])]:
                    raise ValueError("Este prototipo fue eliminado de la lista")
                if existing.get("draft_id") == draft_id and existing.get("state") in {"review", "ready"}:
                    async with coordination("promo-chat-" + existing["session_id"]):
                        current = self._rows().get(existing["session_id"])
                        current_draft = collection("drafts").get(draft_id)
                        if (
                            not current or current.get("archived_at")
                            or current.get("draft_id") != draft_id
                            or current.get("state") not in {"review", "ready"}
                        ):
                            raise ValueError("La sesión cambió durante la revisión")
                        if not current_draft or current_draft.get("status") != "prepared":
                            raise ValueError("El borrador de promo debe estar preparado")
                        fingerprint = draft_fingerprint(current_draft)
                        same = current.get("review_fingerprint") == fingerprint
                        quality = await inspect_existing(draft_id)
                        if not isinstance(quality, dict):
                            raise ValueError("No se pudo evaluar el borrador")
                        after = collection("drafts").get(draft_id)
                        if not after or after.get("status") != "prepared" or draft_fingerprint(after) != fingerprint:
                            raise ValueError("El borrador cambió durante la revisión")
                        if same:
                            quality = merge_quality(quality, current.get("quality"))
                            patch = {"quality": quality, "updated_at": now()}
                            if current.get("provider") is None:
                                patch["source_prompt_ref"] = source_ref
                                if source_ref is not None:
                                    patch["prompt_ref"] = source_ref
                            if current["state"] == "ready" and quality.get("passed") is not True:
                                patch.update(
                                    state="review", stage="review", approved_revision=None, reviewed_fingerprint=None
                                )
                            updated = await self._rows().update(current["session_id"], patch)
                            self._report(updated)
                            return self._view(updated)
                        updated = await self._rows().update(
                            current["session_id"],
                            {
                                "state": "review",
                                "stage": "review",
                                "revision": current["revision"] + 1,
                                "approved_revision": None,
                                "reviewed_fingerprint": None,
                                "review_fingerprint": fingerprint,
                                "quality": quality,
                                "source_prompt_ref": source_ref,
                                "prompt_ref": source_ref or current.get("prompt_ref") or reference(),
                                "updated_at": now(),
                            },
                        )
                        self._report(updated)
                        return updated
            quality = await inspect_existing(draft_id)
            if not isinstance(quality, dict):
                raise ValueError("No se pudo evaluar el borrador")
            sid = uuid.uuid4().hex
            row = {
                "session_id": sid,
                "template_id": template_id,
                "provider": None,
                "state": "review",
                "stage": "review",
                "revision": 1,
                "draft_id": draft_id,
                "draft_history": [],
                "approved_revision": None,
                "reviewed_fingerprint": None,
                "review_fingerprint": draft_fingerprint(draft),
                "messages": [message("user", "Revisar prototipo existente")],
                "error": None,
                "usage": usage.summarize([]),
                "quality": quality,
                "source_prompt_ref": source_ref,
                "prompt_ref": source_ref or reference(),
                "created_at": now(),
                "updated_at": now(),
            }
            await self._rows().insert(row)
            self._report(row)
            return row

    def _start(self, sid):
        task = start_owned_task("promo-chat", sid, lambda: self._run(sid))
        if task:
            self.tasks.add(task)
            task.add_done_callback(self.tasks.discard)
        return task

    async def recover(self):
        for row in self._rows().list():
            if row.get("archived_at"):
                continue
            sid = row["session_id"]
            async with coordination("promo-chat-" + sid):
                row = self._rows().get(sid)
                if not row or row.get("archived_at"):
                    continue
                if row["state"] == "running" and not task_is_owned("promo-chat", sid):
                    interrupted = await self._rows().update(
                        sid,
                        {
                            "state": "failed",
                            "stage": "interrupted",
                            "error": "Preparación interrumpida; envía una corrección para reintentar.",
                            "updated_at": now(),
                        },
                    )
                    self._report(interrupted)
                elif row["state"] == "queued":
                    self._start(sid)

    async def _run(self, sid):
        async with coordination("promo-chat-" + sid):
            row = self.get(sid)
            if row["state"] != "queued":
                return
            revision = row["revision"]
            row = await self._rows().update(sid, {"state": "running", "stage": "proposal", "updated_at": now()})
        recorded = False
        started = False
        try:
            project = self._project(sid)

            async def progress(stage, data=None):
                data = data or {}
                if isinstance(data.get("usage"), dict):
                    await self._record(sid, data["usage"])
                async with coordination("promo-chat-" + sid):
                    await self._rows().update(sid, {"stage": str(stage)[:100], "updated_at": now()})

            if row.get("resume_host"):
                proposal = row["proposal"]
                await progress("preparing")
            else:
                workspace = _safe(project, "work", "chat", str(revision))
                workspace.mkdir(parents=True, exist_ok=False)
                ensure_private_workspace(workspace)
                log = _safe(project, "logs", "chat", f"{revision}.log")
                log.parent.mkdir(parents=True, exist_ok=True)
                from .pipeline import source_context

                context = await source_context(row, project, progress)
                async with coordination("promo-chat-" + sid):
                    row = await self._rows().update(sid, {"source_context": context, "updated_at": now()})
                await progress("proposal")
                started = True
                result = await agents.run(
                    self.agent_getter, row, workspace, log, settings.agent_production_timeout_seconds
                )
                await self._record(
                    sid,
                    usage.step(
                        row["provider"],
                        result.model or agents.PROVIDERS[row["provider"]][0],
                        revision,
                        result.usage,
                        result.duration_seconds,
                        result.ok,
                    ),
                )
                recorded = True
                if not result.ok:
                    raise ValueError("El agente no pudo completar la propuesta")
                proposal = agents.decode(result.last_message)
                async with coordination("promo-chat-" + sid):
                    current = self.get(sid)
                    await self._rows().update(
                        sid,
                        {
                            "messages": [*current["messages"], message("assistant", proposal["reply"])],
                            "proposal": proposal,
                            "stage": "preparing",
                            "updated_at": now(),
                        },
                    )
            if self.prepare is None:
                from .pipeline import prepare_session

                prepare = prepare_session
            else:
                prepare = self.prepare
            result = await prepare(self.get(sid), project, proposal, progress)
            if (
                not isinstance(result, dict)
                or not result.get("draft_id")
                or not isinstance(result.get("quality"), dict)
            ):
                raise ValueError("El pipeline no devolvió un borrador y su evaluación")
            draft = collection("drafts").get(result["draft_id"])
            if not draft or draft.get("status") != "prepared":
                raise ValueError("El pipeline no preparó el borrador")
            final_proposal = result.get("proposal", proposal)
            if (
                not isinstance(final_proposal, dict)
                or not isinstance(final_proposal.get("reply"), str)
                or not final_proposal["reply"].strip()
            ):
                raise ValueError("El pipeline devolvió una propuesta final inválida")
            async with coordination("promo-chat-" + sid):
                current = self.get(sid)
                messages = current["messages"]
                if final_proposal["reply"] != proposal["reply"]:
                    messages = [*messages, message("assistant", final_proposal["reply"])]
                previous_draft = current.get("draft_id")
                history = list(current.get("draft_history") or [])
                if previous_draft and previous_draft != result["draft_id"] and previous_draft not in history:
                    history.append(previous_draft)
                reviewed = await self._rows().update(
                    sid,
                    {
                        "state": "review",
                        "stage": "review",
                        "resume_host": False,
                        "draft_id": result["draft_id"],
                        "draft_history": history,
                        "quality": result["quality"],
                        "proposal": final_proposal,
                        "messages": messages,
                        "review_fingerprint": draft_fingerprint(draft),
                        "error": None,
                        "updated_at": now(),
                    },
                )
                self._report(reviewed)
        except asyncio.CancelledError:
            # Cancelaciones ordenadas durante el cierre no esperan al siguiente
            # arranque para dejar de anunciar una ejecución activa.
            if started and not recorded:
                await self._record(sid, usage.step(row["provider"], agents.PROVIDERS[row["provider"]][0], revision))
            async with coordination("promo-chat-" + sid):
                current = self._rows().get(sid)
                if current and current.get("state") in ACTIVE:
                    interrupted = await self._rows().update(
                        sid,
                        {
                            "state": "failed",
                            "stage": "interrupted",
                            "error": "Preparación interrumpida; envía una corrección para reintentar.",
                            "updated_at": now(),
                        },
                    )
                    self._report(interrupted)
            raise
        except Exception as exc:
            if started and not recorded:
                await self._record(
                    sid,
                    usage.step(
                        row["provider"],
                        getattr(exc, "model", None) or agents.PROVIDERS[row["provider"]][0],
                        revision,
                        getattr(exc, "usage", None),
                        getattr(exc, "duration_seconds", None),
                    ),
                )
            async with coordination("promo-chat-" + sid):
                current = self._rows().get(sid) or {}
                failed = await self._rows().update(
                    sid,
                    {
                        "state": "failed",
                        "stage": "failed",
                        "failed_stage": current.get("stage"),
                        "error": (
                            str(exc).strip()
                            or f"{type(exc).__name__} en la etapa {current.get('stage') or 'preparación'}"
                        )[:500],
                        "updated_at": now(),
                    },
                )
                self._report(failed)

    async def _record(self, sid, entry):
        async with coordination("promo-chat-" + sid):
            row = self.get(sid)
            steps = [*row.get("usage", {}).get("steps", []), entry]
            summary = usage.summarize(steps)
            await self._rows().update(sid, {"usage": summary, "updated_at": now()})
            project = self._project(sid)
            target = _safe(project, "use_tokens", "usage.json")
            target.parent.mkdir(parents=True, exist_ok=True)
            temp = target.with_suffix(".tmp")
            temp.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
            temp.replace(target)

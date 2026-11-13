"""Native edition orchestration. Only the final activation changes active.json."""
from __future__ import annotations

import asyncio
from copy import deepcopy
import re
import shutil
import uuid
from urllib.parse import urlencode

from src.config.content_paths import content_key
from src.core.explainer.editions.resolver import build_edition, _source_revision
from src.core.editions.formats import DEFINITIONS_DIR, validate_storyboard
from src.core.editions.schemas import Edition
from src.core.explainer.catalog import KIT_DIR, get_video
from src.core.explainer.runtime import production_slot, named_lock
from src.core.heavy_work import heavy_work_slot
from src.core.markets import get_market, markets
from src.core.task_ownership import start_owned_task, task_can_recover, task_is_owned
from src.core.localization.output import EditionOutput
from .agent import EditionAgent
from .alignment import align
from .application import localized_script, normalize_media, storyboard, validate_output
from .extraction import extract
from .io import active_config, active_revision, profile_for, read, safe, write
from .media import validate_clips, probe_media
from .publishing import platform_publish, publication
from .repository import ACTIVE, EditionRepository, now
from .tools import EditionTools
from .checkpoints import Checkpoints, digest
from .studio import studio_summary, editorial_usage


class EditionError(ValueError):
    def __init__(self, message, status=422):
        super().__init__(message)
        self.status = status


class EditionService:
    def __init__(self, *, repository=None, agent=None, tools=None, video_getter=None):
        self.repository = repository or EditionRepository()
        self.agent = agent or EditionAgent()
        self.tools = tools or EditionTools()
        self.video_getter = video_getter or get_video
        self.tasks: dict[str, asyncio.Task] = {}

    def _video(self, video_id):
        video = self.video_getter(video_id)
        if video is None:
            raise EditionError(f"Video no encontrado: {video_id}", 404)
        return video

    @staticmethod
    def _supported(video, locale=None):
        if not re.fullmatch(r"[A-Za-z0-9_-]+", video.design):
            return False
        definition = DEFINITIONS_DIR / video.design
        if not (definition / "identity/persona.json").is_file():
            return False
        return locale is None or (definition / f"identity/markets/{locale}.json").is_file()

    def get_job(self, job_id):
        row = self.repository.job(job_id)
        if row is None:
            raise EditionError("Trabajo de idioma no encontrado", 404)
        return {k: row.get(k) for k in ("job_id", "video_id", "locale", "status", "stage", "percent", "error", "revision", "resumable")}

    @staticmethod
    def preview_url(video, locale=None, revision=None):
        base = f"/api/v1/explainer/files/{content_key(video.path)}/index.html"
        if not locale:
            return base
        query = {"edition": locale, "revision": revision or ""}
        folder = active_revision(video.path, locale)
        if folder:
            config = safe(folder, "config.publication.json")
            if config.is_file():
                query["publication"] = str(config.stat().st_mtime_ns)
        return base + "?" + urlencode(query)

    def list(self, video_id):
        video = self._video(video_id)
        supported = self._supported(video)
        source = platform_publish(read(video.path / "publish.json")) if (video.path / "publish.json").is_file() else {}
        if source and "youtube" in source:
            source["youtube"]["description"] = video.youtube_description
        original = get_market("es-419")
        source_revision = _source_revision(video.path) if supported else None
        rows = [{"locale": original.locale, "label": original.label, "name": original.name,
                 "status": "ready", "is_original": True, "preview_url": self.preview_url(video), "revision": None,
                 "job_id": None, "title": source.get("youtube", {}).get("title", video.title), "publish": source}]
        if supported:
            for market in markets():
                if market.locale == original.locale or not self._supported(video, market.locale):
                    continue
                folder = active_revision(video.path, market.locale)
                jobs = sorted(self.repository.jobs(video_id, market.locale), key=lambda j: j["updated_at"])
                job = jobs[-1] if jobs else None
                publish = read(folder / "publish.json") if folder else {}
                if folder:
                    from .attribution import publication_view
                    from .packaging import load_native
                    publish = publication_view(publish, load_native(folder), market.locale)
                status = "missing"
                if folder:
                    status = "ready"
                stale = bool(folder and read(folder / "edition.json")["source_revision"] != source_revision)
                resumable = False
                if job and job["status"] == "failed":
                    saved = self._stage(video, job)
                    if (saved / "checkpoints.json").is_file() and (saved / "edition.json").is_file():
                        resumable = read(saved / "edition.json").get("source_revision") == source_revision
                if job and job["status"] in ACTIVE and not folder:
                    status = "queued" if job["status"] == "queued" else "generating"
                elif job and job["status"] == "failed" and not folder:
                    status = "failed"
                studio = studio_summary(video, folder, stale=stale)
                if folder and studio["issues"]:
                    status = "needs_review"
                rows.append({"locale": market.locale, "label": market.label, "name": market.name,
                             "status": status, "is_original": False,
                             "preview_url": self.preview_url(video, market.locale, folder.name) if folder else None,
                             "revision": folder.name if folder else None, "job_id": job["job_id"] if job else None,
                             "job_status": job["status"] if job else None,
                             "resumable": resumable, "stale": stale,
                             "progress": {"stage": job["stage"], "percent": job["percent"]} if job else None,
                             "error": job.get("error") if job else None,
                             "title": publish.get("youtube", {}).get("title", ""), "publish": publish,
                             "studio": studio})
        return {"video_id": video_id, "supported": supported, "default_locale": original.locale, "locales": rows}

    def usage(self, video_id, locale):
        video = self._video(video_id)
        try:
            market = get_market(locale)
            if market.locale == "es-419" or not self._supported(video, market.locale):
                raise ValueError("Idioma no soportado por el diseño")
        except ValueError as exc:
            raise EditionError(str(exc)) from exc
        stages = {self._stage(video, row) for row in self.repository.jobs(video_id, market.locale)}
        return {"locale": market.locale, **editorial_usage(sorted(stages))}

    def _prepare(self, video_id, locale):
        video = self._video(video_id)
        try:
            market = get_market(locale)
            if market.locale == "es-419" or not self._supported(video, market.locale):
                raise ValueError("El diseño o idioma no admite esta edición")
            layout = profile_for(video.path)
            safe(video.path, "languages", market.locale, "revisions")
            safe(layout.runtime_dir, "localization")
            edition = build_edition(video.path, market.locale, preserve_source_format=True)
            from src.core.explainer.thumbnails import intro_specs
            if set(intro_specs(video)) != {"A", "B", "C"}:
                raise ValueError("Prepara primero las tres miniaturas A/B/C del original; la adaptación reutiliza sus imágenes")
            from .research_readiness import require_research
            require_research(video.path)
            source = extract(video.path, edition)
            errors = validate_storyboard(source.storyboard, edition.format_id, edition.design_id, localizable=edition.localizable)
            if errors:
                raise ValueError("El original no cumple el contrato de escenas: " + "; ".join(errors)[:1000])
            return video, market, layout, edition
        except (ValueError, OSError) as exc:
            raise EditionError(str(exc)) from exc

    async def preflight(self, video_id, locale, *, for_creation=False):
        """Same prerequisites for both clients, without reserving jobs or calling models."""
        from src.config.storage_profile import load_profile
        try:
            video, market, layout, edition = self._prepare(video_id, locale)
        except EditionError as exc:
            if exc.status == 404:
                raise
            return {"video_id": video_id, "locale": locale, "ready": False, "next_action": "create",
                    "issues": [{"level": "error", "field": "source", "message": str(exc)}]}
        profile = load_profile(layout.root)
        result = {"video_id": video_id, "locale": market.locale, "ready": True, "issues": [],
                  "profile": {"id": profile.get("id"), "schema_version": layout.schema_version},
                  "source_revision": edition.source_revision, "next_action": "create", "job_id": None, "revision": None,
                  "provider": {"status": "not_needed", "quota_verified": False}}
        # Existing content/jobs can be inspected even if a provider is currently
        # unavailable. Neither client should pay to recreate already-good output.
        row = next(item for item in self.list(video_id)["locales"] if item["locale"] == market.locale)
        result.update(job_id=row.get("job_id"), revision=row.get("revision"))
        if row.get("job_status") in ACTIVE:
            result["next_action"] = "wait"
            return result
        if not for_creation and row.get("preview_url") and not row.get("stale"):
            result["next_action"] = "review" if row["status"] == "needs_review" else "ready"
            return result
        if not for_creation and row.get("resumable"):
            result["next_action"] = "resume"
            return result  # resume verifies saved checkpoints; cached providers need not be available
        try:
            check = getattr(self.agent, "readiness", None)
            if check:
                result["provider"] = await asyncio.to_thread(check)
                if result["provider"].get("status") != "available":
                    raise RuntimeError("Editorial executor unavailable")
        except Exception:
            result["provider"] = {"status": "unavailable", "quota_verified": False}
            result["issues"].append({"level": "error", "field": "agent", "message": "El agente editorial aislado no está disponible en el servidor."})
        check = getattr(self.tools, "readiness", None)
        if check:
            try:
                result["issues"].extend(await asyncio.to_thread(check, edition))
            except Exception:
                result["issues"].append({"level": "error", "field": "tools",
                                         "message": "No se pudieron verificar los adaptadores del servidor."})
        result["ready"] = not any(i["level"] == "error" for i in result["issues"])
        return result

    def _stage(self, video, row):
        if not re.fullmatch(r"[a-f0-9]{32}", row["job_id"]) or not re.fullmatch(r"rev-\d{3,}", row["revision"]):
            raise EditionError("Identificador de recuperación inválido")
        layout = profile_for(video.path)
        stage = safe(layout.runtime_dir, "localization", row["job_id"])
        if not stage.is_dir():
            stage = safe(video.path, "languages", get_market(row["locale"]).locale, "revisions", row["revision"])
        return stage

    async def reconcile(self, video_id=None, job_id=None):
        """A lease, not an in-memory task list, determines ownership across API processes."""
        rows = [self.repository.job(job_id)] if job_id else self.repository.jobs(video_id)
        for old in rows:
            if not old or old["status"] not in ACTIVE:
                continue
            key = self.repository.key(old["video_id"], old["locale"])
            async with self.repository.store.coordination("localization-" + key):
                row = self.repository.job(old["job_id"])
                if not row or row["status"] not in ACTIVE or not task_can_recover(
                        "localization", row["job_id"], queued=row["status"] == "queued", updated_at=row["updated_at"]):
                    continue
                video = self._video(row["video_id"])
                stage = self._stage(video, row)
                resumable = (stage / "checkpoints.json").is_file()
                # A crash after the pointer write must finish the same activation,
                # never produce a new revision or invoke a model.
                if active_revision(video.path, row["locale"]) == stage and resumable:
                    edition = Edition.model_validate(read(stage / "edition.json"))
                    if Checkpoints(stage, edition).valid("activate", edition.source_revision):
                        await self._activate(video, stage, edition, row, already_active=True)
                        continue
                await self.repository.update(row["job_id"], status="failed", resumable=resumable,
                                             error="El ejecutor anterior se interrumpió; puede recuperarse el trabajo guardado")
                await self.repository.locale(row["video_id"], row["locale"], status="failed")

    async def resume(self, job_id):
        row = self.repository.job(job_id)
        if row is None:
            raise EditionError("Trabajo de idioma no encontrado", 404)
        await self.reconcile(job_id=job_id)
        key = self.repository.key(row["video_id"], row["locale"])
        async with self.repository.store.coordination("localization-" + key):
            row = self.repository.job(job_id)
            if (row["status"] != "failed" or task_is_owned("localization", job_id)
                    or any(j["status"] in ACTIVE for j in self.repository.jobs(row["video_id"], row["locale"]))):
                raise EditionError("El trabajo no puede reanudarse en su estado actual", 409)
            video = self._video(row["video_id"])
            stage = self._stage(video, row)
            if not (stage / "checkpoints.json").is_file():
                raise EditionError("El intento antiguo requiere verificar sus artefactos antes de reanudar", 409)
            edition = Edition.model_validate(read(safe(stage, "edition.json")))
            if (edition.production_id != video.path.name or edition.locale != row["locale"] or edition.revision != row["revision"]
                    or edition.source_revision != _source_revision(video.path)):
                raise EditionError("El original cambió o no coincide con el intento; genera una nueva versión", 409)
            checkpoints = Checkpoints(stage, edition)
            try:
                checkpoints.verify()
            except ValueError as exc:
                raise EditionError(str(exc), 409) from exc
            destination = safe(video.path, "languages", edition.locale, "revisions", edition.revision)
            final = stage == destination
            if final and not checkpoints.valid("activate", edition.source_revision):
                raise EditionError("Revisión final incompleta; no puede activarse", 409)
            if not (stage / "usage-context.json").exists():
                # Attribute future retries without pretending that legacy calls
                # had a ledger or moving usage out of the original video.
                write(safe(stage, "usage-context.json"), {"schema_version": 1, "locale": edition.locale,
                      "revision": edition.revision, "historical_usage_unattributed": True})
            await self.repository.update(job_id, status="queued", error=None, resumable=True)
            task = start_owned_task("localization", job_id, lambda: self._run(video, stage, edition, row, final=final))
            if task is None:
                raise EditionError("Ya hay un ejecutor para este intento", 409)
            self.tasks[job_id] = task
            task.add_done_callback(lambda finished: self.tasks.pop(job_id, None))
        return {"job_id": job_id, "locale": row["locale"], "status": "queued"}

    async def submit(self, video_id, locale):
        video, market, layout, edition = self._prepare(video_id, locale)
        requirements = await self.preflight(video_id, market.locale, for_creation=True)
        if not requirements["ready"]:
            raise EditionError(" ".join(issue["message"] for issue in requirements["issues"]), 409)
        key = self.repository.key(video_id, market.locale)
        async with self.repository.store.coordination("localization-" + key):
            jobs = self.repository.jobs(video_id, market.locale)
            for job in jobs:
                if job["status"] in ACTIVE and task_can_recover("localization", job["job_id"], queued=job["status"] == "queued", updated_at=job["updated_at"]):
                    await self.repository.update(job["job_id"], status="failed", error="El ejecutor anterior se interrumpió")
                    job["status"] = "failed"
            if any(row["status"] in ACTIVE for row in jobs):
                raise EditionError("Ya hay un trabajo activo para este video e idioma", 409)
            revisions = safe(video.path, "languages", market.locale, "revisions")
            taken = [int(p.name[4:]) for p in revisions.glob("rev-*") if re.fullmatch(r"rev-\d+", p.name)]
            taken += [int(j["revision"][4:]) for j in jobs]
            revision = f"rev-{max(taken, default=0) + 1:03d}"
            edition = edition.model_copy(update={"revision": revision, "paths": edition.paths.model_copy(update={
                name: value.replace("/rev-001/", f"/{revision}/") for name, value in edition.paths.model_dump().items()})})
            job_id = uuid.uuid4().hex
            row = {"job_id": job_id, "kind": "localization", "video_id": video_id, "locale": market.locale, "packaging_required": True,
                   "revision": revision, "status": "queued", "stage": "prepare", "percent": 0,
                   "error": None, "created_at": now(), "updated_at": now()}
            stage = safe(layout.runtime_dir, "localization", job_id)
            stage.mkdir(mode=0o700, parents=True)
            write(stage / "edition.json", edition.model_dump(by_alias=True))
            write(stage / "usage-context.json", {"schema_version": 1, "locale": edition.locale,
                                                 "revision": edition.revision})
            Checkpoints(stage, edition).initialize()
            await self.repository.collection("jobs").insert(row)
            await self.repository.locale(video_id, market.locale, job_id=job_id, status="queued", source_revision=edition.source_revision)
            task = start_owned_task("localization", job_id, lambda: self._run(video, stage, edition, row))
            if task is None:
                await self.repository.update(job_id, status="failed", error="No se pudo reservar el ejecutor")
                raise EditionError("No se pudo reservar el ejecutor", 409)
            self.tasks[job_id] = task
            task.add_done_callback(lambda finished: self.tasks.pop(job_id, None))
        return {"job_id": job_id, "locale": market.locale, "status": "queued"}

    async def _progress(self, row, stage, percent):
        await self.repository.update(row["job_id"], status="running", stage=stage, percent=percent)
        if stage == "extract":
            await self.repository.locale(row["video_id"], row["locale"], status="generating")

    async def _run(self, video, stage, edition, row, *, final=False):
        try:
            async with production_slot():
                if final:
                    await self._activate(video, stage, edition, row)
                    return
                checkpoints = Checkpoints(stage, edition)
                checkpoints.initialize()
                reused = []
                await self._progress(row, "extract", 8)
                source_identity = {"texts": {"outro": active_config(video.path).get("outro", {})}}
                extracted = extract(video.path, edition, source_identity=source_identity)
                extracted.story["packaging_required"] = bool(row.get("packaging_required"))
                format_errors = validate_storyboard(extracted.storyboard, edition.format_id, edition.design_id,
                                                    localizable=edition.localizable)
                if format_errors:
                    raise ValueError("Storyboard incompatible con el formato: " + "; ".join(format_errors))
                write(stage / "strings.source.json", {**extracted.table.model_dump(), "hash": extracted.table.content_hash})
                await self._progress(row, "agent", 18)
                agent_inputs = extracted.table.content_hash
                if checkpoints.valid("agent", agent_inputs):
                    output = EditionOutput.model_validate(read(stage / "agent/edition.output.json"))
                    reused.append("agent")
                else:
                    output = await self.agent.generate(video.path, stage, edition, extracted)
                errors = validate_output(extracted, output, edition)
                if errors:
                    raise ValueError("Salida editorial inválida: " + str(errors)[:1800])
                write(stage / "agent/edition.output.json", output.model_dump())
                checkpoints.save("agent", agent_inputs, ["agent/edition.output.json"])
                write(stage / "strings.json", {**output.strings, **{f"seg.{s.id}": s.text for s in output.segments}})
                script = localized_script(extracted, output, edition)
                write(stage / "script.json", script)
                # The kit's outro step needs a revision config and storyboard.
                write(stage / "storyboard.json", extracted.storyboard)
                write(stage / "config.json", self._config(video.path, edition))
                await self._progress(row, "voice", 38)
                voice_inputs = digest({"script": script, "voice": edition.voice.model_dump(), "lexicon": edition.lexicon})
                if checkpoints.valid("voice", voice_inputs):
                    reused.append("voice")
                else:
                    await self.tools.run("voice", video.path, stage, edition)
                if not (stage / "song.mp3").is_file():
                    raise ValueError("La voz no produjo song.mp3")
                checkpoints.save("voice", voice_inputs, ["song.mp3"])
                await self._progress(row, "transcribe", 54)
                async with heavy_work_slot("transcription", row["job_id"]):
                    transcript_inputs = {"voice": checkpoints.data["steps"]["voice"], "script": script,
                                         "transcription": edition.transcription}
                    if checkpoints.valid("transcribe", transcript_inputs):
                        write(stage / "lyrics.json", read(stage / "lyrics.narration.json"))
                        reused.append("transcribe")
                    else:
                        await self.tools.run("transcribe", video.path, stage, edition)
                        write(stage / "lyrics.narration.json", read(stage / "lyrics.json"))
                    checkpoints.save("transcribe", transcript_inputs, ["transcript-raw.json", "lyrics.narration.json"])
                    raw = read(stage / "transcript-raw.json")
                    alignment, discrepancies = align(script, read(stage / "lyrics.json"))
                    _, raw_discrepancies = align(script, raw)
                    await self._progress(row, "outro", 66)
                    async with named_lock(f"edition-outro:{edition.locale}:{edition.voice.voice}"):
                        await self.tools.run("outro", video.path, stage, edition)
                if not (stage / "song-with-outro.mp3").is_file():
                    raise ValueError("Falta el audio con cierre del idioma")
                write(stage / "alignment.json", alignment)
                await self._progress(row, "scenes", 78)
                lyrics = read(stage / "lyrics.json")
                duration = float(lyrics["metadata"]["duration"])
                actual_duration, streams = await probe_media(stage / "song-with-outro.mp3")
                if "audio" not in streams or abs(duration - actual_duration) > .5:
                    raise ValueError("La duración de la transcripción no coincide con el audio final")
                duration = min(duration, actual_duration)
                design = read(KIT_DIR / "designs" / edition.design_id / "design.json")
                audio_config = read(stage / "config.json")
                minimums = {**design.get("defaults", {}).get("minDur", {}), **audio_config.get("minDur", {})}
                scene_end = float(audio_config.get("outro", {}).get("start", duration))
                if not 0 < scene_end <= duration:
                    raise ValueError("El cierre está fuera del audio")
                layers = {item["name"]: item.get("layer", "main") for item in read(KIT_DIR / "catalog.json")["comps"]}
                final_story, warnings = storyboard(extracted, output, edition, alignment, lyrics, scene_end, minimums, layers)
                outro_meta = safe(KIT_DIR, edition.outro.audio).with_suffix(".json")
                if outro_meta.is_file():
                    warnings.extend(read(outro_meta).get("warnings", []))
                final_story = normalize_media(final_story, video.path)
                await validate_clips(video.path, final_story, scene_end, layers)
                write(stage / "storyboard.json", final_story)
                await self._progress(row, "publish", 88)
                cfg = self._config(video.path, edition)
                cfg["outro"] = read(stage / "config.json").get("outro", cfg.get("outro", {}))
                cfg["title"] = output.publish.youtube.title
                write(stage / "config.json", cfg)
                publish = publication(output.publish.model_dump(), alignment, chapters=edition.format.structure.chapters)
                write(stage / "publish.json", publish)
                if output.packaging:
                    from dataclasses import replace
                    from .packaging import prepare_package
                    from src.core.explainer.thumbnails import render
                    prepare_package(video, stage, output.packaging, publish)
                    await render(replace(video, locale=edition.locale, revision=edition.revision, edition_path=stage), only_missing=True)
                write(stage / "review.json", {"source_revision": edition.source_revision, "identity_status": edition.identity_status,
                      "needs_review": True, "editorial_approval": "pending", "reused_steps": reused,
                      "validation_limits": "Numeric checks do not verify attribution, units, intent or natural delivery; editorial review is required.",
                      "discrepancies": raw_discrepancies,
                      "alignment_discrepancies": discrepancies, "warnings": warnings, "observations": output.observations,
                      "thumbnails": "native A/B/C captured" if output.packaging else "historical edition without A/B/C package",
                      "recording": "shared recorder consumes selected edition; no recording requested"})
                await self._progress(row, "activate", 96)
                checkpoints.save("activate", edition.source_revision, ["edition.json", "storyboard.json", "config.json",
                    "lyrics.json", "publish.json", "review.json", "alignment.json", "song-with-outro.mp3"])
                await self._activate(video, stage, edition, row)
        except asyncio.CancelledError:
            await self.repository.update(row["job_id"], status="failed", resumable=(stage / "checkpoints.json").is_file(),
                                         error="Trabajo interrumpido al cerrar el servicio")
            await self.repository.locale(video.video_id, edition.locale, status="failed")
            raise
        except Exception as exc:
            saved_stage = self._stage(video, row)
            await self.repository.update(row["job_id"], status="failed", resumable=(saved_stage / "checkpoints.json").is_file(),
                                         error=f"{type(exc).__name__}: {exc}"[:2400])
            await self.repository.locale(video.video_id, edition.locale, status="failed")

    @staticmethod
    def _config(production, edition):
        config = normalize_media(deepcopy(active_config(production)), production)
        config.update(locale=edition.locale, lyricsUrl=edition.paths.lyrics, storyboardUrl=edition.paths.storyboard)
        config["audio"] = {**config.get("audio", {}), "src": edition.paths.audio_with_outro}
        return config

    async def _activate(self, video, stage, edition, row, *, already_active=False):
        if already_active and (active_revision(video.path, edition.locale) != stage
                               or not Checkpoints(stage, edition).valid("activate", edition.source_revision)):
            raise ValueError("La activación interrumpida no está verificada")
        if not already_active and _source_revision(video.path) != edition.source_revision:
            raise ValueError("El original cambió durante la edición; vuelve a generarla")
        destination = safe(video.path, "languages", edition.locale, "revisions", edition.revision)
        destination.parent.mkdir(parents=True, exist_ok=True)
        if destination.exists() and stage != destination:
            raise ValueError("La revisión ya existe")
        if stage != destination:
            shutil.move(str(stage), str(destination))
        pointer = safe(video.path, "languages", edition.locale, "active.json")
        previous = read(pointer) if pointer.is_file() else None
        activated = False
        try:
            await self.repository.collection("video_localization_revisions").upsert({
                "revision_id": f"{row['job_id']}:{edition.revision}", "localization_id": self.repository.key(video.video_id, edition.locale),
                "video_id": video.video_id, "locale": edition.locale, "revision": edition.revision,
                "source_revision": edition.source_revision, "job_id": row["job_id"], "created_at": row["created_at"]}, match=["revision_id"])
            await self.repository.locale(video.video_id, edition.locale, status="ready", revision=edition.revision)
            write(pointer, {"revision": edition.revision})
            activated = True
            await self.repository.update(row["job_id"], status="completed", stage="done", percent=100, error=None, resumable=False)
        except BaseException:
            if activated:
                if previous is not None:
                    write(pointer, previous)
                else:
                    pointer.unlink(missing_ok=True)
            await self.repository.locale(video.video_id, edition.locale, status="failed",
                                         revision=previous["revision"] if previous else None)
            raise

    async def shutdown(self):
        pending = list(self.tasks.items())
        tasks = [task for _, task in pending]
        for task in tasks:
            task.cancel()
        if tasks:
            await asyncio.gather(*tasks, return_exceptions=True)
        for ident, _ in pending:
            row = self.repository.job(ident)
            if row and row["status"] in ACTIVE:
                await self.repository.update(ident, status="failed", error="Trabajo interrumpido al cerrar el servicio")
                await self.repository.locale(row["video_id"], row["locale"], status="failed")

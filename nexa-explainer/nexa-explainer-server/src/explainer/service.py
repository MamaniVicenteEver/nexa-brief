"""Application service for Nexa Explainer: upload -> review -> approval -> render."""

from __future__ import annotations

import asyncio
import json
import math
import re
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from playwright.async_api import async_playwright
import structlog

from src.config.settings import settings
from src.explainer.media import analyze_first_frame, extract_assets, probe_video
from src.explainer.editorial_audio import (
    prepare_editorial_source,
    prepare_external_audio,
    synthesize_editorial_audio,
)
from src.explainer.editorial_recut import apply_emotional_grade, build_editorial_plan, build_editorial_recut_html
from src.explainer.editorial_emotion import analyze_editorial_emotion
from src.explainer.editorial_gemini_voice import synthesize_gemini_narration
from src.explainer.models import (
    CompositionSpec,
    EditorialPlan,
    EditorialScriptSegment,
    ExplainerProject,
    ExplainerStatus,
    ExplainerTemplateId,
    FeedbackRequest,
    SceneKind,
    SemanticScene,
    Transcript,
    TranscriptSegment,
    TranscriptWord,
    VisualTreatment,
)
from src.explainer.prompts import FEEDBACK_SYSTEM, SEMANTIC_PLAN_SYSTEM, SEMANTIC_PLAN_USER
from src.explainer.templates import build_explainer_html, get_template_manifest

logger = structlog.get_logger(__name__)
_background_tasks: set[asyncio.Task] = set()


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class ExplainerStore:
    """Small atomic JSON store suitable for a single API worker.

    The project contract is intentionally independent from the inherited
    job_tracker, so it can later be moved to Postgres without changing routes.
    """

    def __init__(self) -> None:
        self.root = settings.data_dir / "explainer_projects"
        self.index_path = self.root / "index.json"
        self.root.mkdir(parents=True, exist_ok=True)

    def _read(self) -> dict[str, dict]:
        if not self.index_path.exists():
            return {}
        try:
            return json.loads(self.index_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            return {}

    def _write(self, data: dict[str, dict]) -> None:
        temporary = self.index_path.with_suffix(".tmp")
        temporary.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        temporary.replace(self.index_path)

    def get(self, project_id: str) -> ExplainerProject | None:
        raw = self._read().get(project_id)
        return ExplainerProject.model_validate(raw) if raw else None

    def put(self, project: ExplainerProject) -> ExplainerProject:
        data = self._read()
        data[project.id] = project.model_dump(mode="json")
        self._write(data)
        return project

    def list(self) -> list[ExplainerProject]:
        return [
            ExplainerProject.model_validate(value)
            for value in self._read().values()
        ]


def project_dir(project_id: str) -> Path:
    return settings.output_dir / "explainer" / project_id


async def _render_file_url(html_path: Path, audio_path: Path, output_dir: Path, duration: int) -> Path:
    """Record the explainer without a local HTTP server.

    The explainer document only uses relative media URLs, so file:// is safe
    here and keeps the renderer usable in locked-down workers where opening a
    transient TCP listener is forbidden.
    """
    from src.adapters.recorder.infrastructure.playwright_ffmpeg_adapter import PlaywrightFFmpegAdapter

    output_dir.mkdir(parents=True, exist_ok=True)
    raw_path = output_dir / "_raw_explainer.webm"
    final_path = output_dir / "_explainer_encoded.mp4"
    adapter = PlaywrightFFmpegAdapter()
    async with async_playwright() as playwright:
        launch_options: dict[str, Any] = {
            "args": ["--autoplay-policy=no-user-gesture-required", "--disable-web-security", "--no-sandbox"]
        }
        if settings.playwright_chromium_executable_path:
            launch_options["executable_path"] = settings.playwright_chromium_executable_path
        browser = await playwright.chromium.launch(**launch_options)
        context = await browser.new_context(
            viewport={"width": settings.explainer_render_width, "height": settings.explainer_render_height},
            record_video_dir=str(output_dir),
            record_video_size={
                "width": settings.explainer_render_width,
                "height": settings.explainer_render_height,
            },
        )
        page = await context.new_page()
        page.on("pageerror", lambda exc: logger.warning("explainer_page_error", error=str(exc)))
        page.on("console", lambda msg: (
            logger.warning("explainer_console_error", text=msg.text) if msg.type == "error" else None
        ))
        await page.goto(html_path.as_uri())
        await page.wait_for_load_state("domcontentloaded")
        await asyncio.sleep(0.5)
        await asyncio.sleep(duration)
        await context.close()
        await browser.close()

    candidates = [
        path for path in output_dir.glob("*.webm")
        if path.name != raw_path.name and path.stat().st_size > 0
    ]
    if not candidates:
        raise RuntimeError("Playwright no produjo un archivo WebM.")
    candidates[-1].rename(raw_path)
    await adapter._encode(
        raw_path,
        audio_path,
        final_path,
        crf=18,
        preset="fast",
        duration_seconds=duration,
    )
    raw_path.unlink(missing_ok=True)
    return final_path


def _limit(value: str, length: int) -> str:
    clean = " ".join(value.split()).strip()
    return clean[:length].rstrip()


def _fallback_transcript(
    duration: float,
    language: str | None,
    has_audio: bool,
    reason: str | None = None,
) -> Transcript:
    warning = reason or (
        "No se encontró un modelo Faster-Whisper local; se creó una pista editorial provisional. "
        "Configura EXPLAINER_WHISPER_MODE=local para transcripción real."
    )
    if not has_audio:
        warning = "El video no contiene audio; se creó una pista silenciosa y una composición provisional."
    text = "Contenido hablado pendiente de transcripción."
    return Transcript(
        language=language or "es",
        provider="fallback-editorial",
        quality="fallback",
        text=text,
        segments=[TranscriptSegment(id=0, start=0, end=max(1.5, duration), text=text)],
        warnings=[warning],
    )


async def _transcribe(audio_path: Path, duration: float, language: str | None, has_audio: bool) -> Transcript:
    if settings.explainer_whisper_mode == "off" or not has_audio:
        return _fallback_transcript(duration, language, has_audio)
    if settings.explainer_whisper_mode == "auto":
        # Avoid a multi-GB download during an API request. A production worker
        # can opt in with EXPLAINER_WHISPER_MODE=local after warming the cache.
        if settings.whisper_device == "cpu" and settings.whisper_model == "large-v3":
            return _fallback_transcript(
                duration,
                language,
                has_audio,
                "Modo auto omitió large-v3 en CPU por coste de latencia; configura "
                "EXPLAINER_WHISPER_MODE=local con GPU o un modelo más ligero para transcripción real.",
            )
        cache_candidates = [
            Path.home() / ".cache" / "huggingface" / "hub" / f"models--Systran--faster-whisper-{settings.whisper_model}",
            settings.data_dir / "whisper" / settings.whisper_model,
        ]
        if not any(path.exists() for path in cache_candidates):
            return _fallback_transcript(duration, language, has_audio)
    try:
        from src.adapters.lyrics.infrastructure.faster_whisper_adapter import FasterWhisperAdapter

        payload = await FasterWhisperAdapter().transcribe(audio_path, language)
        segments: list[TranscriptSegment] = []
        for index, raw in enumerate(payload.get("segments", [])):
            words = [
                TranscriptWord(
                    text=str(word.get("word", "")).strip(),
                    start=float(word.get("start", 0)),
                    end=float(word.get("end", 0)),
                    confidence=word.get("probability"),
                )
                for word in raw.get("words", [])
                if str(word.get("word", "")).strip()
            ]
            segments.append(TranscriptSegment(
                id=index,
                start=float(raw.get("start", 0)),
                end=float(raw.get("end", duration)),
                text=str(raw.get("text", "")).strip(),
                words=words,
            ))
        if segments:
            metadata = payload.get("metadata", {})
            return Transcript(
                language=metadata.get("language") or language or "es",
                provider="faster-whisper",
                model=metadata.get("model"),
                quality="word-timestamps",
                text=" ".join(segment.text for segment in segments).strip(),
                segments=segments,
            )
    except Exception as exc:
        logger.warning("explainer_transcription_failed", error=str(exc))
    fallback = _fallback_transcript(duration, language, has_audio)
    fallback.warnings.insert(0, "La transcripción local falló; la revisión continúa con contenido provisional.")
    return fallback


def _fallback_scenes(transcript: Transcript, duration: float) -> list[SemanticScene]:
    usable = [segment for segment in transcript.segments if segment.text.strip()]
    if len(usable) == 1 and usable[0].text.startswith("Contenido hablado"):
        count = max(3, min(5, math.ceil(duration / 4)))
        step = duration / count
        labels = [
            ("hook", "La idea principal", "Enmarca el mensaje central antes de entrar en detalle.", "focus", VisualTreatment.TITLE),
            ("concept", "Cómo funciona", "Organiza la explicación en una secuencia fácil de seguir.", "layers", VisualTreatment.PROCESS),
            ("concept", "Lo que importa", "Destaca el criterio que debe recordar la audiencia.", "layers", VisualTreatment.CHANGE),
            ("cta", "Siguiente paso", "Cierra con una acción clara y una conclusión breve.", "arrow", VisualTreatment.ACTION),
        ]
        return [
            SemanticScene(
                id=f"scene-{index + 1:02d}",
                kind=SceneKind(labels[min(index, len(labels) - 1)][0]),
                start=round(index * step, 2),
                end=round(duration if index == count - 1 else (index + 1) * step, 2),
                title=labels[min(index, len(labels) - 1)][1],
                body=labels[min(index, len(labels) - 1)][2],
                highlight="Revisión editorial",
                icon=labels[min(index, len(labels) - 1)][3],
                priority=1,
                visual_treatment=labels[min(index, len(labels) - 1)][4],
            )
            for index in range(count)
        ]

    if not usable:
        return _fallback_scenes(_fallback_transcript(duration, "es", False), duration)

    # A long talking-head clip needs coverage across its full timeline. Group
    # timestamped segments into editorial beats instead of stopping at the
    # first eight transcript segments.
    scene_count = max(4, min(10, math.ceil(duration / 20)))
    bucket_size = duration / scene_count
    scene_kinds = [SceneKind.HOOK, SceneKind.CONCEPT, SceneKind.CONCEPT, SceneKind.CONCEPT, SceneKind.QUOTE, SceneKind.STEP, SceneKind.CONCEPT, SceneKind.CONCEPT, SceneKind.QUOTE, SceneKind.CTA]
    scene_icons = ["focus", "layers", "layers", "layers", "quote", "arrow", "layers", "layers", "quote", "check"]
    scenes: list[SemanticScene] = []
    for index in range(scene_count):
        bucket_start = round(index * bucket_size, 2)
        bucket_end = round(duration if index == scene_count - 1 else (index + 1) * bucket_size, 2)
        bucket_segments = [
            segment for segment in usable
            if segment.start < bucket_end and segment.end > bucket_start
        ]
        if not bucket_segments:
            continue
        bucket_text = " ".join(segment.text.strip() for segment in bucket_segments).strip()
        words = bucket_text.split()
        numeric_evidence = " ".join(re.findall(r"(?:\d+[\d.,]*\s?(?:%|x|años?|meses?|días?)?)", bucket_text))
        kind = SceneKind.STAT if numeric_evidence else scene_kinds[min(index, len(scene_kinds) - 1)]
        lowered_text = bucket_text.lower()
        if kind == SceneKind.STAT:
            treatment = VisualTreatment.MONEY if re.search(r"(?:\$|usd|d[oó]lar|euros?|bolivianos?)", lowered_text) else VisualTreatment.DATA
        elif kind == SceneKind.STEP or re.search(r"\b(?:hacer|crear|activar|enviar|usar|clic|click|paso)\b", lowered_text):
            treatment = VisualTreatment.ACTION
        elif re.search(r"\b(?:cambio|cambiar|mejorar|crecer|reducir|aumentar)\b", lowered_text):
            treatment = VisualTreatment.CHANGE
        elif kind == SceneKind.QUOTE:
            treatment = VisualTreatment.QUOTE
        elif index == 0:
            treatment = VisualTreatment.TITLE
        else:
            treatment = VisualTreatment.NONE
        scenes.append(SemanticScene(
            id=f"scene-{len(scenes) + 1:02d}",
            kind=kind,
            start=bucket_start,
            end=bucket_end,
            title=_limit(" ".join(words[:7]) or "Idea principal", 48),
            body=_limit(bucket_text, 115),
            highlight=_limit("Mensaje clave", 28),
            icon="chart" if kind == SceneKind.STAT else scene_icons[min(index, len(scene_icons) - 1)],
            priority=1,
            evidence=numeric_evidence,
            visual_treatment=treatment,
        ))
    return scenes or _fallback_scenes(_fallback_transcript(duration, "es", False), duration)


def _normalize_scenes(raw_scenes: Any, duration: float) -> list[SemanticScene]:
    normalized: list[SemanticScene] = []
    allowed_icons = {"layers", "quote", "chart", "check", "arrow", "focus"}
    for index, raw in enumerate(raw_scenes or []):
        try:
            start = max(0.0, min(duration, float(raw.get("start", 0))))
            end = max(start + 1.5, min(duration, float(raw.get("end", duration))))
            if end <= start:
                continue
            kind = SceneKind(str(raw.get("kind", "concept")).lower())
            evidence = _limit(str(raw.get("evidence", "")), 160)
            if kind == SceneKind.STAT and not re.search(r"\d", evidence):
                kind = SceneKind.CONCEPT
            try:
                treatment = VisualTreatment(str(raw.get("visual_treatment", "none")).lower())
            except ValueError:
                treatment = VisualTreatment.NONE
            if kind == SceneKind.STAT and treatment == VisualTreatment.NONE:
                treatment = VisualTreatment.DATA
            if kind != SceneKind.STAT and treatment == VisualTreatment.DATA:
                treatment = VisualTreatment.NONE
            normalized.append(SemanticScene(
                id=str(raw.get("id") or f"scene-{index + 1:02d}"),
                kind=kind,
                start=round(start, 2),
                end=round(end, 2),
                title=_limit(str(raw.get("title", "Idea principal")), 48),
                body=_limit(str(raw.get("body", "")), 115),
                highlight=_limit(str(raw.get("highlight", "")), 28),
                icon=str(raw.get("icon", "layers")) if str(raw.get("icon", "layers")) in allowed_icons else "layers",
                priority=max(1, min(3, int(raw.get("priority", 1)))),
                evidence=evidence,
                visual_treatment=treatment,
            ))
        except (TypeError, ValueError):
            continue
    normalized.sort(key=lambda scene: (scene.start, scene.end))
    for index, scene in enumerate(normalized):
        if index and scene.start < normalized[index - 1].end:
            scene.start = normalized[index - 1].end
        scene.end = max(scene.end, scene.start + 1.5)
        scene.end = min(scene.end, duration)
    return [scene for scene in normalized if scene.end > scene.start]


async def _plan_scenes(
    transcript: Transcript,
    frame_analysis: Any,
    duration: float,
    language: str | None,
    template_id: ExplainerTemplateId,
    *,
    allow_ai: bool,
) -> tuple[list[SemanticScene], list[str], bool]:
    if allow_ai and (settings.deepseek_api_key or settings.gemini_api_key):
        try:
            if settings.deepseek_api_key:
                from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
                adapter = DeepSeekAdapter()
            else:
                from src.adapters.ai.infrastructure.gemini_flash_adapter import GeminiFlashAdapter
                adapter = GeminiFlashAdapter()
            response = await adapter.complete_json(
                SEMANTIC_PLAN_SYSTEM,
                SEMANTIC_PLAN_USER.format(
                    duration=duration,
                    language=language or transcript.language,
                    frame_analysis=frame_analysis.model_dump_json(),
                    transcript=transcript.model_dump_json(),
                    template_manifest=json.dumps(get_template_manifest(template_id), ensure_ascii=False),
                ),
            )
            scenes = _normalize_scenes(response.get("scenes"), duration)
            if scenes:
                return scenes, list(response.get("design_notes") or []), True
        except Exception as exc:
            logger.warning("explainer_semantic_plan_failed", error=str(exc))
    return _fallback_scenes(transcript, duration), [
        "La composición usa las zonas seguras declaradas por la plantilla seleccionada.",
        "El texto está limitado a titulares cortos y una idea por escena.",
        "Las gráficas sólo se activan ante cifras trazables del transcript.",
        "Los iconos son SVG internos y no dependen de emojis ni de una CDN.",
    ], False


class ExplainerService:
    def __init__(self) -> None:
        self.store = ExplainerStore()

    def get(self, project_id: str) -> ExplainerProject | None:
        return self.store.get(project_id)

    def list(self) -> list[ExplainerProject]:
        return sorted(self.store.list(), key=lambda item: item.updated_at, reverse=True)

    async def create_upload(
        self,
        source_path: Path,
        original_filename: str,
        template_id: ExplainerTemplateId,
        language: str | None,
        allow_ai: bool,
    ) -> ExplainerProject:
        info = await probe_video(source_path)
        project_id = uuid.uuid4().hex
        target_dir = project_dir(project_id)
        target_dir.mkdir(parents=True, exist_ok=True)
        target_name = f"source{source_path.suffix.lower() or '.mp4'}"
        target_path = target_dir / target_name
        shutil.move(source_path, target_path)
        timestamp = _now()
        project = ExplainerProject(
            id=project_id,
            original_filename=original_filename,
            status=ExplainerStatus.UPLOADED,
            template_id=template_id,
            duration_seconds=round(info["duration_seconds"], 3),
            language=language,
            created_at=timestamp,
            updated_at=timestamp,
            paths={"source_video": target_name},
        )
        self.store.put(project)
        task = asyncio.create_task(self.process(project_id, allow_ai=allow_ai))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        return project

    async def process(self, project_id: str, *, allow_ai: bool = True) -> ExplainerProject:
        project = self._require(project_id)
        project.status = ExplainerStatus.PROCESSING
        project.updated_at = _now()
        self.store.put(project)
        try:
            directory = project_dir(project_id)
            source = directory / project.paths["source_video"]
            frame_path, audio_path, info = await extract_assets(source, directory)
            frame = await analyze_first_frame(frame_path, allow_ai=allow_ai)
            transcript = await _transcribe(
                audio_path, project.duration_seconds, project.language, bool(info.get("has_audio"))
            )
            scenes, design_notes, ai_semantics = await _plan_scenes(
                transcript, frame, project.duration_seconds, project.language, project.template_id, allow_ai=allow_ai
            )
            template_manifest = get_template_manifest(project.template_id)
            template_layout = template_manifest["layout"]
            composition_notes = list(design_notes)
            composition_notes.extend([
                f"Layout de plantilla: {template_layout['presenter']}.",
                f"Zona visual: {template_layout['visual_zone']}.",
                f"Orden de lectura: {template_layout['reading_order']}.",
                "La capacidad semantic_overlay se activa sólo cuando la evidencia verbal la justifica.",
            ])
            composition_width_ratio = {
                ExplainerTemplateId.SIGNAL_MINIMAL: 0.5,
                ExplainerTemplateId.KINETIC_VOICE: 0.5,
                ExplainerTemplateId.CENTERED_RAILS: 0.5,
                ExplainerTemplateId.SPATIAL_ORBIT: 0.42,
            }.get(project.template_id, 0.5)
            composition = CompositionSpec(
                template_id=project.template_id,
                width=settings.explainer_render_width,
                height=settings.explainer_render_height,
                presenter_width_ratio=composition_width_ratio,
                scenes=scenes,
                design_notes=composition_notes,
            )
            preview_dir = directory / "preview"
            preview_dir.mkdir(parents=True, exist_ok=True)
            presenter_path = directory / f"presenter{info['source_extension']}"
            shutil.copy2(presenter_path, preview_dir / presenter_path.name)
            (preview_dir / "composition.json").write_text(
                composition.model_dump_json(indent=2), encoding="utf-8"
            )
            (directory / "frame-analysis.json").write_text(frame.model_dump_json(indent=2), encoding="utf-8")
            (directory / "transcript.json").write_text(transcript.model_dump_json(indent=2), encoding="utf-8")
            html_path = preview_dir / "index.html"
            html_path.write_text(
                build_explainer_html(composition, video_src=presenter_path.name), encoding="utf-8"
            )
            project.frame_analysis = frame
            project.transcript = transcript
            project.composition = composition
            project.paths.update({
                "presenter_video": presenter_path.name,
                "first_frame": "first-frame.jpg",
                "audio": "audio.wav",
                "transcript": "transcript.json",
                "composition": "preview/composition.json",
                "preview_html": "preview/index.html",
            })
            project.warnings = list(dict.fromkeys(transcript.warnings))
            if not info.get("has_audio"):
                project.warnings.append("Audio ausente: se usará una pista silenciosa para mantener un MP4 válido.")
            project.ai_used = frame.provider == "gemini-vision" or ai_semantics
            project.status = ExplainerStatus.READY_FOR_REVIEW
            project.updated_at = _now()
            self.store.put(project)
            return project
        except Exception as exc:
            project.status = ExplainerStatus.FAILED
            project.error = str(exc)
            project.updated_at = _now()
            self.store.put(project)
            logger.exception("explainer_processing_failed", project_id=project_id, error=str(exc))
            return project

    async def update_feedback(self, project_id: str, request: FeedbackRequest) -> ExplainerProject:
        project = self._require(project_id)
        if not project.composition or not project.transcript or not project.frame_analysis:
            raise ValueError("El proyecto todavía no tiene una composición para editar.")
        if request.scenes:
            scenes = _normalize_scenes([scene.model_dump() for scene in request.scenes], project.duration_seconds)
            notes = list(project.composition.design_notes) + ["Escenas actualizadas manualmente."]
            ai_used = project.ai_used
        else:
            scenes, notes, ai_used = await self._apply_ai_feedback(project, request.feedback)
        project.template_id = request.template_id or project.template_id
        project.composition = project.composition.model_copy(update={
            "template_id": project.template_id, "scenes": scenes, "design_notes": notes
        })
        preview_dir = project_dir(project_id) / "preview"
        (preview_dir / "composition.json").write_text(
            project.composition.model_dump_json(indent=2), encoding="utf-8"
        )
        (preview_dir / "index.html").write_text(
            build_explainer_html(project.composition, video_src=project.paths["presenter_video"]),
            encoding="utf-8",
        )
        project.revision += 1
        project.ai_used = project.ai_used or ai_used
        project.status = ExplainerStatus.READY_FOR_REVIEW
        project.error = None
        project.updated_at = _now()
        return self.store.put(project)

    async def create_editorial_recut(
        self,
        project_id: str,
        *,
        provider: str = "local",
        voice: str | None = None,
        source_label: str = "Obama · discurso sobre Stonewall y la promesa de igualdad",
        script_segments: list[EditorialScriptSegment] | None = None,
        uploaded_audio: Path | None = None,
    ) -> ExplainerProject:
        """Create the source-led director plan and its timed Spanish audio."""
        project = self._require(project_id)
        directory = project_dir(project_id)
        # Re-running the editorial pass must always start from the preserved
        # original upload, never from the previously generated padded source.
        # Otherwise ffmpeg receives the same path as input and output.
        source_name = (
            project.paths.get("original_video")
            or project.paths.get("source_video")
            or project.paths.get("presenter_video")
        )
        if not source_name:
            raise ValueError("El proyecto no tiene video fuente.")
        source = directory / source_name
        if not source.exists():
            raise ValueError("El video fuente no existe en el proyecto.")
        source_info = await probe_video(source)
        source_duration = float(source_info["duration_seconds"])
        plan = build_editorial_plan(
            source_duration,
            source_label=source_label,
            script_segments=script_segments,
            audio_provider="uploaded" if uploaded_audio else provider,
        )
        # Playwright/FFmpeg render at an integer number of seconds in this
        # server. Round the director timeline once so the silent source,
        # narration and final capture have the same end frame.
        render_duration = float(math.ceil(plan.duration_seconds))
        plan = plan.model_copy(update={
            "duration_seconds": render_duration,
            "actions": [
                action.model_copy(update={"end": render_duration}) if action.type == "outro" else action
                for action in plan.actions
            ],
        })
        editorial_source = directory / "editorial-source.mp4"
        prepare_editorial_source(
            source,
            editorial_source,
            intro_seconds=3.0,
            outro_seconds=max(0.2, render_duration - 3.0 - source_duration),
            total_duration=render_duration,
        )
        if uploaded_audio:
            narration = directory / "editorial-narration.wav"
            audio_meta = await prepare_external_audio(
                uploaded_audio,
                narration,
                intro_seconds=3.0,
                duration_seconds=plan.duration_seconds,
            )
        else:
            if provider == "gemini":
                references = [
                    {
                        "id": segment.id,
                        "source_start": segment.source_start,
                        "source_end": segment.source_end,
                        "text": segment.narration,
                        "title": segment.title,
                        "emotion": segment.emotion,
                    }
                    for segment in plan.segments
                ]
                analysis = await analyze_editorial_emotion(
                    references,
                    source_label=plan.source_label,
                    duration=plan.source_duration_seconds,
                    source_transcript=(project.transcript.model_dump(mode="json") if project.transcript else {}),
                    audio_provider=f"gemini/{voice or 'Gacrux'}",
                )
                (directory / "editorial-emotion-analysis.json").write_text(
                    json.dumps(analysis, ensure_ascii=False, indent=2), encoding="utf-8"
                )
                plan = apply_emotional_grade(plan, analysis)
                narration, audio_meta = await synthesize_gemini_narration(
                    plan, directory, analysis, voice=voice or "Gacrux"
                )
                project.editorial_emotion_analysis = analysis
                project.paths["emotion_analysis"] = "editorial-emotion-analysis.json"
                project.paths["tts_prompts"] = "editorial-tts-prompts.json"
            else:
                narration, audio_meta = await synthesize_editorial_audio(
                    plan,
                    directory,
                    provider=provider,
                    voice=voice,
                )
        default_voice = str(audio_meta.get("voice") or voice or "Gacrux")
        default_key = re.sub(r"[^a-z0-9]+", "-", default_voice.lower()).strip("-")
        plan = plan.model_copy(update={"audio": {
            **plan.audio,
            **audio_meta,
            "variants": {
                default_key: {
                    "label": f"{default_voice} · narración editorial",
                    "filename": narration.name,
                    "voice": default_voice,
                    "provider": audio_meta.get("provider", provider),
                    "model": audio_meta.get("model"),
                },
            },
        }})
        (directory / "editorial-plan.json").write_text(
            plan.model_dump_json(indent=2), encoding="utf-8"
        )
        preview_dir = directory / "preview"
        preview_dir.mkdir(parents=True, exist_ok=True)
        (preview_dir / "editorial-plan.json").write_text(
            plan.model_dump_json(indent=2), encoding="utf-8"
        )
        (preview_dir / "index.html").write_text(
            # The preview is opened both through the API and as a file:// URL
            # by the recorder. From preview/index.html the source lives one
            # directory above; the API route rewrites this relative URL to its
            # asset endpoint for browser previews.
            build_editorial_recut_html(
                plan,
                video_src="../editorial-source.mp4",
                audio_src="../editorial-narration.wav",
            ),
            encoding="utf-8",
        )
        project.duration_seconds = plan.duration_seconds
        project.editorial_plan = plan
        project.paths.update({
            "original_video": project.paths.get("source_video", source_name),
            "presenter_video": "editorial-source.mp4",
            "editorial_source": "editorial-source.mp4",
            "audio": narration.name,
            "editorial_audio": narration.name,
            "director_plan": "editorial-plan.json",
            "preview_html": "preview/index.html",
        })
        project.warnings = list(dict.fromkeys([
            *project.warnings,
            *plan.warnings,
            "La composición usa una voz sintética genérica en español; no imita la voz del orador.",
        ]))
        project.status = ExplainerStatus.READY_FOR_REVIEW
        project.error = None
        project.revision += 1
        project.updated_at = _now()
        return self.store.put(project)

    async def create_editorial_voice_variant(
        self,
        project_id: str,
        *,
        voice: str,
    ) -> ExplainerProject:
        """Generate a second Gemini voice without changing the locked editorial timeline."""
        project = self._require(project_id)
        if not project.editorial_plan or not project.editorial_emotion_analysis:
            raise ValueError("Primero genera el plan editorial y su análisis emocional.")
        voice_key = re.sub(r"[^a-z0-9]+", "-", voice.lower()).strip("-")
        if not voice_key:
            raise ValueError("La voz indicada no es válida.")
        directory = project_dir(project_id)
        output_stem = f"editorial-narration-{voice_key}"
        narration, metadata = await synthesize_gemini_narration(
            project.editorial_plan,
            directory,
            project.editorial_emotion_analysis,
            voice=voice,
            output_stem=output_stem,
        )
        variants = dict(project.editorial_plan.audio.get("variants") or {})
        base_audio = project.paths.get("audio", "editorial-narration.wav")
        base_voice = str(project.editorial_plan.audio.get("voice") or "Gacrux")
        base_key = re.sub(r"[^a-z0-9]+", "-", base_voice.lower()).strip("-") or "gacrux"
        variants.setdefault(base_key, {
            "label": f"{base_voice} · narración editorial",
            "filename": base_audio,
            "voice": base_voice,
            "provider": project.editorial_plan.audio.get("provider", "gemini"),
            "model": project.editorial_plan.audio.get("model"),
        })
        variants[voice_key] = {
            "label": f"{voice} · narración masculina",
            "filename": narration.name,
            "voice": voice,
            "provider": metadata["provider"],
            "model": metadata["model"],
        }
        plan = project.editorial_plan.model_copy(update={
            "audio": {**project.editorial_plan.audio, "variants": variants},
        })
        preview_dir = directory / "preview"
        (directory / "editorial-plan.json").write_text(plan.model_dump_json(indent=2), encoding="utf-8")
        (preview_dir / "editorial-plan.json").write_text(plan.model_dump_json(indent=2), encoding="utf-8")
        (preview_dir / "index.html").write_text(
            build_editorial_recut_html(
                plan,
                video_src="../editorial-source.mp4",
                audio_src=f"../{base_audio}",
            ),
            encoding="utf-8",
        )
        project.editorial_plan = plan
        project.paths[f"audio_variant_{voice_key}"] = narration.name
        project.paths[f"tts_prompts_variant_{voice_key}"] = f"{output_stem}-tts-prompts.json"
        project.paths[f"audio_metadata_variant_{voice_key}"] = f"{output_stem}-audio.json"
        project.revision += 1
        project.updated_at = _now()
        return self.store.put(project)

    async def analyze_editorial_emotion(self, project_id: str) -> ExplainerProject:
        """Create timed voice-direction JSON without generating audio yet."""
        project = self._require(project_id)
        plan = project.editorial_plan
        if plan and plan.segments:
            references = [
                {
                    "id": segment.id,
                    "source_start": segment.source_start,
                    "source_end": segment.source_end,
                    "text": segment.narration,
                    "title": segment.title,
                    "emotion": segment.emotion,
                }
                for segment in plan.segments
            ]
            source_label = plan.source_label
            duration = plan.source_duration_seconds
        elif project.transcript and project.transcript.segments:
            references = [
                {
                    "id": f"transcript-{segment.id:03d}",
                    "source_start": segment.start,
                    "source_end": segment.end,
                    "text": segment.text,
                    "title": "",
                    "emotion": "serious",
                }
                for segment in project.transcript.segments
            ]
            source_label = project.original_filename
            duration = project.duration_seconds
        else:
            raise ValueError("El proyecto no tiene segmentos temporizados para analizar.")

        analysis = await analyze_editorial_emotion(
            references,
            source_label=source_label,
            duration=duration,
            source_transcript=(project.transcript.model_dump(mode="json") if project.transcript else {}),
        )
        directory = project_dir(project_id)
        analysis_path = directory / "editorial-emotion-analysis.json"
        analysis_path.write_text(json.dumps(analysis, indent=2, ensure_ascii=False), encoding="utf-8")
        project.editorial_emotion_analysis = analysis
        project.paths["emotion_analysis"] = analysis_path.name
        project.warnings = list(dict.fromkeys([
            *project.warnings,
            "La dirección emocional fue generada por DeepSeek V4.1-Flash y requiere revisión humana antes del TTS.",
        ]))
        project.ai_used = True
        project.status = ExplainerStatus.READY_FOR_REVIEW
        project.error = None
        project.revision += 1
        project.updated_at = _now()
        return self.store.put(project)

    async def _apply_ai_feedback(self, project: ExplainerProject, feedback: str) -> tuple[list[SemanticScene], list[str], bool]:
        if settings.deepseek_api_key or settings.gemini_api_key:
            try:
                if settings.deepseek_api_key:
                    from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
                    adapter = DeepSeekAdapter()
                else:
                    from src.adapters.ai.infrastructure.gemini_flash_adapter import GeminiFlashAdapter
                    adapter = GeminiFlashAdapter()
                response = await adapter.complete_json(
                    FEEDBACK_SYSTEM,
                    json.dumps({
                        "feedback": feedback,
                        "duration": project.duration_seconds,
                        "template_manifest": get_template_manifest(project.template_id),
                        "current_composition": project.composition.model_dump(mode="json"),
                    }, ensure_ascii=False),
                )
                scenes = _normalize_scenes(response.get("scenes"), project.duration_seconds)
                if scenes:
                    return scenes, list(response.get("design_notes") or []), True
            except Exception as exc:
                logger.warning("explainer_feedback_failed", error=str(exc))
        notes = list(project.composition.design_notes)
        notes.append(f"Feedback recibido para la siguiente iteración: {_limit(feedback, 180)}")
        return project.composition.scenes, notes, False

    async def approve(self, project_id: str) -> ExplainerProject:
        project = self._require(project_id)
        if project.status == ExplainerStatus.COMPLETED:
            return project
        if project.status != ExplainerStatus.READY_FOR_REVIEW:
            raise ValueError("Solo se puede aprobar un proyecto listo para revisión.")
        project.status = ExplainerStatus.APPROVED
        project.updated_at = _now()
        self.store.put(project)
        task = asyncio.create_task(self.render(project_id))
        _background_tasks.add(task)
        task.add_done_callback(_background_tasks.discard)
        return project

    async def render(self, project_id: str) -> ExplainerProject:
        project = self._require(project_id)
        project.status = ExplainerStatus.RENDERING
        project.updated_at = _now()
        self.store.put(project)
        try:
            if not settings.explainer_render_enabled:
                raise RuntimeError("El render está desactivado con EXPLAINER_RENDER_ENABLED=false.")
            directory = project_dir(project_id)
            preview_dir = directory / "preview"
            html_path = preview_dir / "index.html"
            audio_path = directory / project.paths["audio"]
            rendered_dir = directory / "rendered"
            rendered_dir.mkdir(exist_ok=True)
            encoded_path = await _render_file_url(
                html_path,
                audio_path,
                rendered_dir,
                max(1, round(project.duration_seconds)),
            )
            final_path = rendered_dir / "explainer.mp4"
            shutil.move(encoded_path, final_path)
            project.paths["final_video"] = "rendered/explainer.mp4"
            project.status = ExplainerStatus.COMPLETED
            project.error = None
            project.updated_at = _now()
            self.store.put(project)
            return project
        except Exception as exc:
            project.status = ExplainerStatus.FAILED
            project.error = f"Render fallido: {exc}"
            project.updated_at = _now()
            self.store.put(project)
            logger.exception("explainer_render_failed", project_id=project_id, error=str(exc))
            return project

    def _require(self, project_id: str) -> ExplainerProject:
        project = self.store.get(project_id)
        if not project:
            raise KeyError(f"Proyecto no encontrado: {project_id}")
        return project

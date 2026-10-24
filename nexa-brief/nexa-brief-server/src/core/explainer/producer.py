"""Producción de videos explicativos con un agente local (Claude Code / Codex).

Flujo de una producción (una a la vez, en segundo plano):
  1. creating   → `kit.py new <diseño> <id>`; se guardan en el video el brief
                  (BRIEF.md + brief.json), el tema, la categoría y los medios
                  que subió el usuario (assets/media/), con la duración objetivo
                  (`--minutes`, lengths.json).
  2. producing  → el agente sigue explainer-kit/AGENTS.md pasos 2–9: investiga,
                  escribe el guion, crea y revisa los componentes propios del tema
                  (paso 3c), pide la voz (Gemini con rotación de claves),
                  transcribe, arma el storyboard, valida y deja publish.json.
                  NO renderiza.
  3. finishing  → `kit.py manifest <id>`: si el estado es "listo", el video
                  aparece en Preparación con el botón de grabar.
  4. recording  → solo si auto_record: grabación completa (render) y registro
                  como job empaquetado, así los horarios de la categoría lo publican.

El agente trabaja con permisos acotados: escribe solo en la carpeta del video
y corre solo el CLI del kit (ver AgentScope). El kit, el agente y el grabador
se inyectan para poder probar sin correr nada real.
"""

from __future__ import annotations

import asyncio
import json
import shutil
import sys
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Awaitable, Callable

import structlog

from src.config.settings import BASE_DIR, settings
from src.core.categories import get_category, top_level_of
from src.core.data import collection
from src.core.explainer.briefs import ExplainerBrief, unique_video_id, write_publish_json
from src.core.explainer.catalog import READY_STATUSES, TEMPLATES_DIR, load_video
from src.core.explainer.designs import KIT_DIR, available_design_ids
from src.core.explainer.lengths import agent_timeout_seconds, clamp_minutes
from src.core.explainer.publishing.strategies import explainer_skills_dir
from src.core.ports.agent_port import AgentRunnerPort, AgentScope

# Punto de entrada de los agentes para producir con un diseño existente (no leen el kit entero).
PRODUCE_SKILL = BASE_DIR / "src" / "skills" / "explainer" / "produce" / "SKILL.md"

logger = structlog.get_logger(__name__)

KIT_CLI = KIT_DIR / "tools" / "kit.py"
MEDIA_CLI = KIT_DIR / "tools" / "media.py"
MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".webm"}


class ProductionState(str, Enum):
    queued = "queued"
    creating = "creating"
    producing = "producing"
    finishing = "finishing"
    ready = "ready"            # listo para grabar (Preparación)
    recording = "recording"
    done = "done"              # grabado (y programado) por auto_record
    incomplete = "incomplete"  # el agente terminó pero el video no quedó "listo"
    failed = "failed"


ACTIVE_STATES = {ProductionState.queued, ProductionState.creating, ProductionState.producing,
                 ProductionState.finishing, ProductionState.recording}

KitRunner = Callable[[list[str]], Awaitable[tuple[int, str]]]
AgentGetter = Callable[[str], AgentRunnerPort]


async def run_kit(args: list[str]) -> tuple[int, str]:
    """`python kit.py <args>` → (código, salida)."""
    proc = await asyncio.create_subprocess_exec(
        sys.executable, str(KIT_CLI), *args,
        cwd=str(BASE_DIR), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    out, _ = await proc.communicate()
    return proc.returncode or 0, out.decode("utf-8", "replace")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _rel(path: Path) -> str:
    """Ruta relativa al servidor si está dentro; absoluta si no (tests, otro disco)."""
    return str(path.relative_to(BASE_DIR)) if path.is_relative_to(BASE_DIR) else str(path)


def readable_log(raw: str) -> str:
    """Convierte el log stream-json de Claude Code en líneas legibles
    (texto del agente y comandos que corre). Las demás líneas quedan igual."""
    out: list[str] = []
    for line in raw.splitlines():
        if not line.startswith("{"):
            out.append(line)
            continue
        try:
            event = json.loads(line)
        except ValueError:
            out.append(line)
            continue
        kind = event.get("type")
        if kind in ("item.completed", "turn.completed", "turn.failed", "error"):
            out.extend(_codex_lines(event))
            continue
        if kind == "result":
            out.append(f"✓ terminado: {str(event.get('result') or '')[:600]}")
        elif kind == "assistant":
            for part in (event.get("message") or {}).get("content") or []:
                if part.get("type") == "text" and part.get("text", "").strip():
                    out.append(f"· {part['text'].strip()[:400]}")
                elif part.get("type") == "tool_use":
                    args = part.get("input") or {}
                    detail = args.get("command") or args.get("file_path") or args.get("query") or args.get("url") or ""
                    out.append(f"→ {part.get('name')}: {str(detail)[:240]}")
    return "\n".join(out)


def _codex_lines(event: dict) -> list[str]:
    """Eventos de `codex exec --json` → líneas del log legible."""
    kind = event.get("type")
    if kind == "turn.completed":
        u = event.get("usage") or {}
        return [f"✓ vuelta: {u.get('input_tokens', 0):,} tokens de entrada · {u.get('output_tokens', 0):,} de salida"]
    if kind in ("turn.failed", "error"):
        return [f"✗ {str(event.get('error') or event.get('message') or event)[:400]}"]
    item = event.get("item") or {}
    itype = item.get("type")
    if itype == "agent_message" and str(item.get("text", "")).strip():
        return [f"· {item['text'].strip()[:400]}"]
    if itype == "command_execution":
        return [f"→ comando: {str(item.get('command') or '')[:240]} (código {item.get('exit_code')})"]
    if itype == "file_change":
        return [f"→ archivos: {', '.join(c.get('path', '') for c in item.get('changes') or [])[:240]}"]
    if itype == "web_search":
        return [f"→ búsqueda: {str(item.get('query') or '')[:240]}"]
    return []


def package_categories() -> set[str]:
    """Categorías que publican con el paquete v2 (tienen perfil en src/skills/explainer/categories/)."""
    return {p.stem for p in (explainer_skills_dir() / "categories").glob("*.json")}


# Cómo lee archivos y mira imágenes cada agente (Codex no tiene herramienta de lectura: usa la terminal).
READING = {
    "claude": "Para leer archivos y MIRAR imágenes (las hojas PNG de revisión) usa la herramienta de lectura (Read), no cat/ls.",
    "codex": (
        "Para leer puedes usar comandos de solo lectura en cualquier ruta del proyecto (cat, sed -n, head, tail, rg, ls, wc);"
        " para MIRAR las hojas PNG de revisión usa tu herramienta para ver imágenes."
        " Nunca leas .env, accounts.json ni client_secret*.json."
    ),
}


def build_agent_prompt(record: dict, video_dir: Path, *, resume: bool = False) -> str:
    vid = record["video_id"]
    py = sys.executable
    category = get_category(record["category_path"])
    media = record.get("media") or []
    minutes = record.get("target_minutes")   # None = producción anterior a lengths.json (formato corto)
    lines = [
        "Eres el productor de un video del explainer-kit de Nexa Brief.",
        # Vía rápida: el diseño ya existe, así que basta la hoja QUICK.md del diseño (no el kit entero).
        f"Sigue {PRODUCE_SKILL} (vía rápida para un diseño existente; lee solo lo que indica): pasos 2 a 9."
        " NO hagas el paso 10 (render).",
        f"El paso 1 ya está hecho: video `{vid}`, diseño `{record['design']}`, carpeta {video_dir}.",
    ]
    if minutes:
        lines.append(
            f"Duración objetivo: {minutes:g} minutos (assets/script.json → target_minutes). Los rangos de palabras,"
            f" capítulos, fotos, planos y componentes propios los muestra `{py} {KIT_CLI} status {vid}`"
            " y están explicados en guides/storytelling.md §7."
        )
    lines += [
        f"Categoría: {category.display_name if category else record['category_path']} ({category.topic if category else ''}).",
        f"Tema pedido: {record['topic']}",
    ]
    if record.get("description"):
        lines.append(f"Descripción del pedido: {record['description']}")
    lines.append(
        f"Fecha de hoy: {datetime.now(timezone.utc):%Y-%m-%d}. Si el tema es de actualidad, cada cifra lleva la fecha de su"
        " fuente en PLAN §3, se prefieren datos de los últimos 12 meses y el guion dice de cuándo es cada dato."
    )
    lines.append(f"El brief (ángulo, gancho, esquema y textos de publicación) está en {video_dir / 'BRIEF.md'}: respétalo.")
    if media:
        lines.append(
            "El usuario subió estos medios, ya copiados en assets/media/ (úsalos primero; busca más solo si faltan): "
            + ", ".join(media)
        )
    else:
        lines.append("El usuario no subió medios: búscalos tú con media.py (licencias libres, con crédito).")
    lines += [
        "Paso 3c (componentes propios) con criterio ALTO: completa el inventario visual de PLAN §7a",
        "(guides/components.md §6). Todo objeto o mecanismo del tema que aparece en 2 o más planos o en el",
        "clímax y que el catálogo no dibuja de forma reconocible se CREA en assets/components/. Después de",
        f"cada cambio corre `{py} {KIT_CLI} components {vid}`, MIRA cada hoja work/components/<nombre>.png y",
        "completa la rúbrica de work/components/review.md. Máximo 3 rondas por componente: si no queda",
        "aprobado, usa el catálogo para esos planos y anótalo en PLAN §10.",
        *(
            [
                "Paso 9 en NodeTech: publish.json es el PAQUETE v2 (guides/publish-package.md, ejemplo",
                "src/templates/nodetech/apolo-1202/publish.json): intro, 3 títulos, miniaturas A/B con su foto,",
                "descripción por bloques con los capítulos de manifest.chapters, fuentes, créditos, tags y comentario",
                "fijado. Después `publishing build` y `publishing check` con 0 errores. Parte del brief que ya está en",
                "publish.json (v1): úsalo como punto de partida.",
            ]
            if record["category_path"].split("/", 1)[0] in package_categories()
            else ["publish.json ya tiene los textos de publicación; ajústalos solo si el guion final cambia el ángulo."]
        ),
        "El cierre con voz del canal lo pega `kit.py transcribe` (outro/): no lo escribas en el guion ni en el storyboard.",
        f"Orquestación: lee {KIT_DIR / 'guides' / 'orquestacion.md'}. Tú eres el productor; puedes DELEGAR trabajos acotados",
        "a DeepSeek con `kit.py delegate` (roles en src/skills/models/roles.json: component_draft, copy_draft, fact_check) y",
        "revisar lo que vuelve. Todo queda anotado solo en work/usage.jsonl; al final `kit.py usage` arma usage.json.",
        "Sin emojis en ningún texto de publish.json.",
        "",
        "Permisos: solo puedes escribir dentro de la carpeta del video. Para ejecutar algo, los únicos comandos",
        "son el CLI del kit y el de medios, escritos EXACTAMENTE así (rutas absolutas, sin variables ni `cd`):",
        f"  {py} {KIT_CLI} status {vid}",
        f"  {py} {KIT_CLI} voice {vid}",
        f"  {py} {KIT_CLI} transcribe {vid}",
        f"  {py} {KIT_CLI} preview {vid}",
        f"  {py} {KIT_CLI} components {vid}",
        f"  {py} {KIT_CLI} check {vid}",
        f"  {py} {KIT_CLI} sheet {vid} --orient both",
        f"  {py} {KIT_CLI} manifest {vid}",
        f"  {py} {KIT_CLI} outro {vid}",
        f"  {py} {KIT_CLI} delegate {vid} <rol> --prompt-file work/<pedido>.md [--out <ruta en el video>] [--context PLAN.md]",
        f"  {py} {KIT_CLI} usage {vid}",
        f"  {py} -m src.core.explainer.publishing build {vid}",
        f"  {py} -m src.core.explainer.publishing check {vid}",
        f"  {py} {MEDIA_CLI} search \"<consulta en inglés>\"",
        f"  {py} {MEDIA_CLI} get {vid} \"File:…\" nombre.jpg",
        READING.get(record.get("agent") or "", READING["claude"]),
        "voice, transcribe y sheet tardan varios minutos: no los cortes con un timeout corto ni los reemplaces por tiempos sintéticos.",
        f"Si `voice` falla de verdad (sin cuota en todas las claves y modelos), no te detengas: corre `{py} {KIT_CLI} preview {vid}`,",
        "arma y revisa el storyboard con esos tiempos provisorios y deja «voz pendiente» en el reporte; al retomar con voz",
        "real se transcribe y se vuelve a validar.",
        f"Termina corriendo `{py} {KIT_CLI} manifest {vid}` y `{py} {KIT_CLI} usage {vid}`, y escribe el reporte final de AGENTS.md §6",
        "(incluye qué delegaste, a qué modelo y cuántas vueltas necesitó cada cosa).",
    ]
    if resume:
        lines.insert(0, f"CONTINÚA una producción que quedó a medias. Corre primero `{py} {KIT_CLI} status {vid}` y sigue desde el primer paso pendiente.")
    return "\n".join(lines)


def brief_markdown(record: dict, brief: dict | None) -> str:
    out = [f"# Brief · {record['topic']}", "", f"- Categoría: `{record['category_path']}`", f"- Diseño: `{record['design']}`"]
    if record.get("description"):
        out += [f"- Descripción del pedido: {record['description']}"]
    if brief:
        out += [
            "", "## Ángulo", brief.get("angle", ""), "", "## Tesis", brief.get("thesis", ""),
            "", "## Gancho (primera frase)", brief.get("hook", ""), "", "## Esquema",
            *[f"{i}. {item}" for i, item in enumerate(brief.get("outline") or [], 1)],
            "", "## Textos de publicación", "Ver publish.json (YouTube, Facebook, TikTok).",
            "", "## Búsquedas de medios sugeridas", *[f"- {q}" for q in brief.get("media_suggestions") or []],
        ]
    return "\n".join(out) + "\n"


def _default_agent() -> str:
    """El agente del rol `producer` en src/skills/models/roles.json (model hub); si no, EXPLAINER_AGENT."""
    try:
        from src.adapters.models.hub import provider_for

        return provider_for("producer")
    except (ValueError, OSError):
        return settings.explainer_agent


class ExplainerProducer:
    def __init__(
        self,
        agent_getter: AgentGetter | None = None,
        kit_runner: KitRunner = run_kit,
        recorder_getter: Callable[[], Any] | None = None,
        videos_dir: Path | None = None,
        uploads_dir: Path | None = None,
    ) -> None:
        if agent_getter is None:
            from src.adapters.agent.factory import get_agent

            agent_getter = get_agent
        self._agent_getter = agent_getter
        self._kit = kit_runner
        self._recorder_getter = recorder_getter
        # None = cada video va a la carpeta de su categoría (src/templates/nodetech/…);
        # una ruta fija se usa en tests.
        self._videos_dir = videos_dir
        self._uploads_dir = uploads_dir
        self._lock = asyncio.Lock()
        self._tasks: dict[str, asyncio.Task] = {}
        self._recovered = False

    @property
    def uploads_dir(self) -> Path:
        return self._uploads_dir or settings.data_dir / "explainer" / "uploads"

    @staticmethod
    def _col():
        return collection("explainer_productions")

    # ── consultas ────────────────────────────────────────────────────────────
    async def recover_interrupted(self) -> int:
        """Producciones activas de un proceso anterior → failed (se pueden retomar)."""
        if self._recovered:
            return 0
        self._recovered = True
        fixed = 0
        for rec in self._col().list():
            if rec.get("state") in {s.value for s in ACTIVE_STATES} and rec["production_id"] not in self._tasks:
                await self._col().update(rec["production_id"], {"state": ProductionState.failed.value,
                                                                "error": "interrumpida (el servidor se reinició); usa Retomar", "updated_at": _now()})
                fixed += 1
        return fixed

    def list(self, category_path: str | None = None) -> list[dict]:
        rows = self._col().list()
        if category_path:
            rows = [r for r in rows if r["category_path"] == category_path or r["category_path"].startswith(category_path + "/")]
        return sorted(rows, key=lambda r: r.get("created_at", ""), reverse=True)

    def get(self, production_id: str) -> dict | None:
        return self._col().get(production_id)

    def log_tail(self, production_id: str, chars: int = 6000) -> str:
        rec = self.get(production_id)
        if not rec or not rec.get("log_path"):
            return ""
        try:
            raw = Path(rec["log_path"]).read_text(encoding="utf-8", errors="replace")
        except OSError:
            return ""
        return readable_log(raw)[-chars:]

    # ── alta ─────────────────────────────────────────────────────────────────
    async def submit(
        self,
        *,
        category_path: str,
        design: str,
        topic: str,
        description: str = "",
        agent: str | None = None,
        brief: ExplainerBrief | None = None,
        media_files: list[Path] | None = None,
        auto_record: bool = False,
        plan_item_id: str | None = None,
        minutes: float | None = None,
    ) -> dict:
        category = get_category(category_path)
        if category is None:
            raise ValueError(f"categoría desconocida: {category_path}")
        if category.engine != "explainer_kit":
            raise ValueError(f"{category.display_name} usa el pipeline de plantillas, no el motor explainer")
        # Cualquier diseño del kit sirve en cualquier categoría explainer (p. ej. una plantilla
        # de History en un video de Tech): el video pertenece a la categoría desde la que se crea.
        if design not in available_design_ids():
            raise ValueError(f"diseño desconocido: '{design}'")
        if not topic.strip():
            raise ValueError("el tema es obligatorio")
        agent_name = agent or _default_agent()
        if not self._agent_getter(agent_name).available():
            raise ValueError(f"el agente local '{agent_name}' no está instalado en esta máquina")

        production_id = uuid.uuid4().hex[:12]
        top = get_category(top_level_of(category_path))
        folder = (top.folder if top else None) or "nodehistory"
        video_id = unique_video_id(brief.video_id if brief else topic, self._videos_dir)
        staged: list[str] = []
        if media_files:
            stage = self.uploads_dir / production_id
            stage.mkdir(parents=True, exist_ok=True)
            for src in media_files:
                if src.suffix.lower() not in MEDIA_EXTENSIONS:
                    raise ValueError(f"formato no soportado: {src.name}")
                dst = stage / src.name
                shutil.copy2(src, dst)
                staged.append(dst.name)

        record = {
            "production_id": production_id,
            "video_id": video_id,
            "category_path": category_path,
            "design": design,
            "folder": folder,
            "topic": topic.strip(),
            "description": description.strip(),
            "target_minutes": clamp_minutes(minutes),
            "agent": agent_name,
            "auto_record": auto_record,
            "brief": brief.model_dump() if brief else None,
            "media": staged,
            "plan_item_id": plan_item_id,
            "state": ProductionState.queued.value,
            "error": None,
            "video_status": None,
            "record_job_id": None,
            "log_path": str(settings.data_dir / "explainer" / "logs" / f"{production_id}.log"),
            "created_at": _now(),
            "updated_at": _now(),
        }
        await self._col().insert(record)
        self._start(production_id)
        logger.info("explainer_production_submitted", production_id=production_id, video_id=video_id, agent=agent_name)
        return record

    async def resume(self, production_id: str) -> dict:
        rec = self.get(production_id)
        if rec is None:
            raise KeyError(production_id)
        if rec["state"] in {s.value for s in ACTIVE_STATES}:
            raise ValueError("la producción sigue en curso")
        if rec["state"] in (ProductionState.ready.value, ProductionState.done.value):
            raise ValueError("la producción ya terminó")
        await self._update(production_id, state=ProductionState.queued.value, error=None)
        self._start(production_id, resume=(self._root(rec) / rec["video_id"]).exists())
        return self.get(production_id)

    def _start(self, production_id: str, resume: bool = False) -> None:
        task = asyncio.create_task(self._run(production_id, resume))
        self._tasks[production_id] = task
        task.add_done_callback(lambda _t: self._tasks.pop(production_id, None))

    async def wait(self, production_id: str) -> dict:
        task = self._tasks.get(production_id)
        if task:
            await task
        return self.get(production_id)

    def _root(self, rec: dict) -> Path:
        """Carpeta donde vive el video de esta producción."""
        return self._videos_dir or TEMPLATES_DIR / (rec.get("folder") or "nodehistory")

    async def _update(self, production_id: str, **patch: Any) -> None:
        await self._col().update(production_id, {**patch, "updated_at": _now()})

    # ── ejecución ────────────────────────────────────────────────────────────
    async def _run(self, production_id: str, resume: bool) -> None:
        async with self._lock:
            try:
                await self._run_locked(production_id, resume)
            except Exception as exc:  # noqa: BLE001 - la producción guarda el error
                logger.error("explainer_production_failed", production_id=production_id, error=str(exc))
                await self._update(production_id, state=ProductionState.failed.value, error=str(exc)[-800:])

    async def _run_locked(self, production_id: str, resume: bool) -> None:
        rec = self.get(production_id)
        vid = rec["video_id"]
        video_dir = self._root(rec) / vid
        log_path = Path(rec["log_path"])
        log_path.parent.mkdir(parents=True, exist_ok=True)

        if not resume:
            await self._update(production_id, state=ProductionState.creating.value)
            title = (rec.get("brief") or {}).get("working_title") or rec["topic"]
            args = ["new", rec["design"], vid, "--title", title, "--folder", self._root(rec).name]
            if rec.get("target_minutes"):
                args += ["--minutes", f"{rec['target_minutes']:g}"]
            code, out = await self._kit(args)
            with log_path.open("a", encoding="utf-8") as log:
                log.write(out)
            if code != 0:
                raise RuntimeError(f"kit.py new falló: {out[-400:]}")
            self._prepare_video(rec, video_dir)

        await self._update(production_id, state=ProductionState.producing.value)
        agent = self._agent_getter(rec["agent"])
        scope = AgentScope(
            writable_dir=_rel(video_dir),
            commands=(f"{sys.executable} {KIT_CLI}", f"{sys.executable} {MEDIA_CLI}", f"{sys.executable} -m src.core.explainer.publishing"),
            os_sandbox_dir=_rel(video_dir.parent),
            # el kit guarda ahí qué clave de Gemini se agotó
            extra_writable=(str(KIT_DIR / ".state"),),
        )
        # un video largo tarda más (más investigación, voz en partes, Whisper en CPU): lengths.json
        timeout = max(settings.agent_production_timeout_seconds, agent_timeout_seconds(rec.get("target_minutes")))
        result = await agent.run(
            build_agent_prompt(rec, video_dir, resume=resume),
            cwd=BASE_DIR,
            log_path=log_path,
            timeout_seconds=timeout,
            scope=scope,
        )
        await self._update(production_id, agent_report=result.last_message[-4000:])
        try:
            from src.core.explainer.usage import record_agent_run, summarize

            record_agent_run(video_dir, rec["agent"], result, step="retomar" if resume else "")
            totals = summarize(video_dir)["totals"]
            await self._update(production_id, usage_totals=totals)
        except Exception as exc:  # noqa: BLE001 - el registro de uso nunca frena la producción
            logger.warning("explainer_usage_record_failed", production_id=production_id, error=str(exc))

        await self._update(production_id, state=ProductionState.finishing.value)
        await self._kit(["manifest", vid])
        await self._kit(["poster", vid])  # portada de la tarjeta en /plantillas
        video = load_video(video_dir)
        status = video.status if video else None
        await self._update(production_id, video_status=status)
        if result.timed_out:
            raise RuntimeError(f"el agente no terminó en {timeout} s (estado del video: {status})")
        if status not in READY_STATUSES:
            await self._update(
                production_id,
                state=ProductionState.incomplete.value,
                error=f"el agente terminó (código {result.exit_code}) pero el video quedó '{status}'; revisa el log y usa Retomar",
            )
            return

        if not rec.get("auto_record") or self._recorder_getter is None:
            await self._update(production_id, state=ProductionState.ready.value)
            return

        await self._update(production_id, state=ProductionState.recording.value)
        recorder = self._recorder_getter()
        job = recorder.submit(video, duration="full")
        await self._update(production_id, record_job_id=job.job_id)
        job = await recorder.wait(job.job_id)
        if job.state.value == "failed":
            raise RuntimeError(f"grabación fallida: {job.error}")
        await self._update(production_id, state=ProductionState.done.value)

    def _prepare_video(self, rec: dict, video_dir: Path) -> None:
        """Deja en el video lo que el agente necesita: brief, categoría, tema y medios."""
        manifest_path = video_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
        manifest.update({
            "category": rec["category_path"],
            "topic": rec["topic"],
            "description": rec.get("description") or "",
            "production_id": rec["production_id"],
        })
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

        brief = rec.get("brief")
        (video_dir / "BRIEF.md").write_text(brief_markdown(rec, brief), encoding="utf-8")
        if brief:
            (video_dir / "brief.json").write_text(json.dumps(brief, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            write_publish_json(video_dir, ExplainerBrief.model_validate(brief))

        media = rec.get("media") or []
        if media:
            dest = video_dir / "assets" / "media"
            dest.mkdir(parents=True, exist_ok=True)
            credits = dest / "CREDITS.md"
            lines = []
            for name in media:
                shutil.copy2(self.uploads_dir / rec["production_id"] / name, dest / name)
                lines.append(f"{name} — aportado por el usuario — Nexa Brief — uso propio — (subido desde la web)")
            with credits.open("a", encoding="utf-8") as fh:
                fh.write("\n".join(lines) + "\n")

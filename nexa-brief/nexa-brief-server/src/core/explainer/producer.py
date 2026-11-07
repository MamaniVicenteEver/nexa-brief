"""Producción de videos explicativos con un agente local (Claude Code / Codex).

Flujo de una producción (presupuesto global configurable de 1–5, por defecto 1):
  1. creating   → `kit.py new <diseño> <id>`; se guardan en el video el brief
                  (BRIEF.md + brief.json), el tema, la categoría y los medios
                  que subió el usuario (assets/media/), con la duración objetivo
                  (`--minutes`, lengths.json).
  2. producing  → agente de guion; el host genera voz y transcripción; agente de
                  storyboard. Cada etapa deja un punto de recuperación. NO renderiza.
  3. finishing  → `kit.py manifest <id>`: si el estado es "listo", el video
                  aparece en Preparación con el botón de grabar.
  4. recording  → solo si auto_record: grabación completa (render) y registro
                  como job empaquetado, así los horarios de la categoría lo publican.

El agente trabaja con permisos acotados: escribe solo en la carpeta del video
y corre solo el CLI del kit (ver AgentScope). El kit, el agente y el grabador
se inyectan para poder probar sin correr nada real.
"""

from __future__ import annotations

from src.core.task_ownership import start_owned_task, task_can_recover
from src.core.explainer import runtime

import asyncio
import hashlib
import importlib.util
import json
import os
import signal
import shutil
import sys
import time
import uuid
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Awaitable, Callable

import structlog

from src.config.settings import BASE_DIR, settings
from src.config.content_paths import production_root
from src.config.profile_layout import layout_for_settings
from src.core.execution_logs import register_execution_log
from src.core.categories import get_category, top_level_of
from src.core.data import collection
from src.core.explainer.briefs import ExplainerBrief, unique_video_id, write_publish_json
from src.core.explainer.catalog import load_video
from src.core.explainer.designs import KIT_DIR, available_design_ids
from src.core.explainer.lengths import agent_timeout_seconds, clamp_minutes, host_timeout_seconds
from src.core.explainer import narrative
from src.core.explainer.publishing.strategies import explainer_skills_dir
from src.core.ports.agent_port import AgentRunnerPort, AgentScope

# Punto de entrada de los agentes para producir con un diseño existente (no leen el kit entero).
PRODUCE_SKILL = BASE_DIR / "src" / "skills" / "explainer" / "produce" / "SKILL.md"

logger = structlog.get_logger(__name__)

KIT_CLI = KIT_DIR / "tools" / "kit.py"
MEDIA_CLI = KIT_DIR / "tools" / "media.py"
MEDIA_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".webm"}
POLICY_FILE = KIT_DIR / "production-policy.json"


class BudgetExhausted(Exception):
    pass


def _policy() -> dict:
    return json.loads(POLICY_FILE.read_text(encoding="utf-8"))


def _storyboard_empty(video_dir: Path) -> bool:
    try:
        return not json.loads((video_dir / "assets" / "storyboard.json").read_text(encoding="utf-8")).get("beats")
    except (OSError, ValueError, AttributeError):
        return True


def _phase_input_hash(video_dir: Path, phase: str) -> str:
    digest = hashlib.sha256(phase.encode())
    for name in ("assets/script.json", "assets/storyboard.json", "assets/lyrics.json"):
        try:
            digest.update((video_dir / name).read_bytes())
        except OSError:
            digest.update(b"<missing>")
    return digest.hexdigest()


def _check_errors(label: str, code: int, output: str) -> list[str]:
    if not code:
        return []
    lines = [line.strip().lstrip("✗ ").strip() for line in output.splitlines()
             if line.strip().startswith("✗") or line.strip().startswith("ERROR ·")]
    return [f"{label}: {line}" for line in (lines or [output.strip() or f"código {code}"])]


def _ledger_tokens(rows: list[dict]) -> dict:
    return {key: sum(int(row.get(key) or 0) for row in rows) for key in
            ("input_tokens", "output_tokens", "cached_input_tokens", "reasoning_tokens")}


def _merge_usage(previous: dict, latest: dict, before: dict) -> dict:
    """Nunca perder consumo histórico si el ledger está incompleto o fue rotado."""
    merged = dict(latest)
    for key in ("input_tokens", "output_tokens", "cached_input_tokens", "reasoning_tokens"):
        old, new = int(previous.get(key) or 0), int(latest.get(key) or 0)
        merged[key] = max(new, old + max(0, new - int(before.get(key) or 0)))
    return merged


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


async def run_publish_check(vid: str) -> tuple[int, str]:
    proc = await asyncio.create_subprocess_exec(
        sys.executable, "-m", "src.core.explainer.publishing", "check", vid,
        cwd=str(BASE_DIR), stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.STDOUT,
    )
    out, _ = await proc.communicate()
    return proc.returncode or 0, out.decode("utf-8", "replace")


async def _run_host_kit(args: list[str], log_path: Path, timeout: int) -> tuple[int, str]:
    """Proceso del host y su grupo: el timeout no deja Whisper huérfano."""
    with log_path.open("ab", buffering=0) as log:
        proc = await asyncio.create_subprocess_exec(sys.executable, str(KIT_CLI), *args, cwd=str(BASE_DIR),
                                                     stdout=log, stderr=asyncio.subprocess.STDOUT,
                                                     stdin=asyncio.subprocess.DEVNULL, start_new_session=True)
        try:
            await asyncio.wait_for(proc.wait(), timeout)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            try:
                os.killpg(proc.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(proc.wait(), 10)
            except asyncio.TimeoutError:
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                await proc.wait()
            raise
    return proc.returncode or 0, "ver log de producción"


def _read_phase(video_dir: Path) -> dict:
    try:
        value = json.loads((video_dir / "work" / "phase.json").read_text(encoding="utf-8"))
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def _write_phase(video_dir: Path, phase: str, digest: str = "") -> None:
    work = video_dir / "work"
    work.mkdir(parents=True, exist_ok=True)
    tmp = work / ".phase.tmp"
    tmp.write_text(json.dumps({"phase": phase, "script_sha256": digest}, ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(work / "phase.json")


def _script_hash(video_dir: Path) -> str:
    try:
        script = json.loads((video_dir / "assets" / "script.json").read_text())
        # These fields affect narrated content/delivery (including the legacy director).
        # Chapters, acts and visual subtitles must not cause paid TTS/Whisper repeats.
        payload = {k: script.get(k) for k in ("title", "design", "voice", "voice_direction", "language", "target_minutes")}
        payload["segments"] = [{k: segment.get(k) for k in
            ("id", "text", "tone", "intensity", "delivery_note")} for segment in script.get("segments", [])]
        raw = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        return "audio-v1:" + hashlib.sha256(raw.encode()).hexdigest()
    except (OSError, ValueError, TypeError, AttributeError):
        return ""


def _validate_script(video_dir: Path, expected_narrative: str | None = None, expected_minutes: float | None = None) -> list[str]:
    try:
        script = json.loads((video_dir / "assets" / "script.json").read_text(encoding="utf-8"))
        if expected_minutes and float(script.get("target_minutes") or 0) != float(expected_minutes):
            return [f"target_minutes debe ser {expected_minutes:g}"]
        config = json.loads((video_dir / "assets" / "config.json").read_text(encoding="utf-8"))
        config = config["configs"][0] if "configs" in config else config
        if expected_narrative and config.get("narrative_id") != expected_narrative:
            return [f"la narrativa del config no coincide con {expected_narrative}"]
        segments = script.get("segments")
        if not isinstance(segments, list) or not segments:
            return ["segments vacío o inválido"]
        ids = []
        for segment in segments:
            if not isinstance(segment, dict) or not all(isinstance(segment.get(k), str) and segment[k].strip() for k in ("id", "text", "tone")):
                return ["cada segmento necesita id, text y tone no vacíos"]
            ids.append(segment["id"])
        if len(ids) != len(set(ids)):
            return ["id de segmentos duplicados"]
        spec = importlib.util.spec_from_file_location("explainer_narrative_check", KIT_DIR / "tools" / "narrative_check.py")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        errors = []
        module.check(video_dir, config, script, {}, errors, script_only=True)
        lengths_spec = importlib.util.spec_from_file_location("explainer_kit_lengths", KIT_DIR / "tools" / "lengths.py")
        lengths = importlib.util.module_from_spec(lengths_spec)
        lengths_spec.loader.exec_module(lengths)
        targets = lengths.of_script(script, config.get("design"))
        words = sum(len(segment["text"].split()) for segment in segments)
        if len(segments) < targets["segments"][0] or words < targets["words"][0]:
            errors.append(f"guion incompleto: {len(segments)} segmentos y {words} palabras; mínimo {targets['segments'][0]} y {targets['words'][0]}")
        if any("…" in segment["text"] or "..." in segment["text"] for segment in segments):
            errors.append("el guion contiene texto provisional con puntos suspensivos")
        return errors
    except (OSError, ValueError, TypeError, KeyError, IndexError, AttributeError) as exc:
        return [f"no se pudo validar script/config: {exc}"]


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


def build_agent_prompt(record: dict, video_dir: Path, *, resume: bool = False, phase: str = "guion", qc: str = "") -> str:
    if layout_for_settings(settings).schema_version >= 3:
        return _isolated_agent_prompt(record, phase=phase, resume=resume, qc=qc)
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
    if record.get("short_test"):
        lines.append("PRUEBA CORTA autorizada de 1–2 minutos: conserva format=short_preparation en script.json. Usa los rangos de kit.py status; no extiendas a cinco minutos. Mantén investigación, medios, voz real y revisión visual.")
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
        " fuente en PLAN §3, se prefieren datos de los últimos 12 meses y el guion dice de cuándo es cada dato;"
        " si la narrativa excluye fechas del golpe, acláralas después, sin alterar el alcance del dato."
    )
    lines.append(f"El brief (ángulo, gancho, esquema y textos de publicación) está en {video_dir / 'BRIEF.md'}: respétalo.")
    if record.get("narrative_id"):
        # Elegida al crear: si su JSON ya no carga, la producción falla con el error claro del módulo.
        story = narrative.get_service().get(record["narrative_id"])
        lines += narrative.production_lines(story, record["category_path"].split("/", 1)[0], record.get("title_level"))
        lines.append("Cada segmento de script.json necesita act, también en la narrativa documental. Valores válidos: "
                     + ", ".join(act.id for act in story.spoken_acts) + ". Usa el acto correspondiente al contenido; no incluyas el outro en el guion.")
    if media:
        lines.append(
            "El usuario subió estos medios, ya copiados en assets/media/ (úsalos primero; busca más solo si faltan): "
            + ", ".join(media)
        )
    else:
        lines.append("El usuario no subió medios: búscalos tú con media.py (licencias libres, con crédito).")
    lines += [
        "Paso 3c: consulta `kit.py library` y completa el inventario visual de PLAN §7a (guides/components.md §6). Reusa componentes propios aprobados antes de crear otros. Para videos de",
        "8 min o más crea y usa al menos 4 componentes propios del tema: objetos o mecanismos que vuelven",
        "en 2 o más planos o en el clímax. rough.icon es relleno, no protagonista: el check bloquea el exceso,",
        "las rachas y, en la narrativa amarillista, los iconos en golpe/miedo. Usa fotos, clips y componentes propios. Después de",
        f"cada cambio corre `{py} {KIT_CLI} components {vid}`, MIRA cada hoja work/components/<nombre>.png y",
        "completa la rúbrica de work/components/review.md. Máximo 2 rondas por componente: si no queda",
        "aprobado, descártalo y usa el catálogo; anótalo en PLAN §10. Reemplaza fotos que no sirvan.",
        *(
            [
                "Paso 9 en NodeTech: publish.json es el PAQUETE v2 (guides/publish-package.md, ejemplo",
                "src/templates/nodetech/lo-que-le-contas-a-la-ia-no-es-privado-tus-chats/publish.json): intro, 3 títulos, miniaturas A/B/C con su foto,",
                "descripción por bloques con los capítulos de manifest.chapters, fuentes, créditos, tags y comentario",
                "fijado. Después `publishing build` si no hay renders MP4 (puede borrarlos) y `publishing check` con 0 errores. Parte del brief que ya está en",
                "publish.json (v1): úsalo como punto de partida.",
            ]
            if record["category_path"].split("/", 1)[0] in package_categories()
            else ["publish.json ya tiene los textos de publicación; ajústalos solo si el guion final cambia el ángulo."]
        ),
        "El cierre con voz del canal lo pega `kit.py transcribe` (outro/): no lo escribas en el guion ni en el storyboard.",
        "Ritmo objetivo: alrededor de 130 ppm, con pausas naturales entre oraciones; usa delivery_note por segmento si hace falta. El QC avisa por encima de 138 ppm.",
        "Apoyos visuales preferidos: reparte por todo el video y sin patrón fijo (1) rough.introv2/binary.introv2 con foto o video y texto grande, (2) common.clip layout full con caption grande y textColor ink|accent|mix, accentWords, textSide y textIn por JSON, (3) foto en cuadro. Cada apoyo acompaña la frase narrada. Imagen 5–10 s; video 8–16 s; cada archivo máximo dos usos. Cada tercio necesita una miniatura o un video completo. Si el archivo es corto, usa loop o rate menor a 1.",
        "Antes de crear un componente propio consulta `kit.py library`: lista componentes de todas las producciones, qué dibujan, parámetros y hoja PNG. Si uno sirve, cópialo al video y validalo con `kit.py components`; crea uno nuevo solo cuando sea necesario, con hoja PNG revisada, sin emojis, parámetros JSON y uso en el storyboard.",
        "Cada foto/clip debe mostrar el sujeto concreto de la frase narrada. Antes de buscar escribe en PLAN §8 la frase, `shows` (qué se verá) y `query` (consulta concreta); cópialos al beat visual junto a `at` en fase storyboard. Busca varias consultas con media.py search-concept en Pexels, Pixabay y los demás bancos configurados. Reusa solo si ayuda a visualizar esa frase. Si no hay clip pertinente, usa foto pertinente con movimiento lento; nunca clip genérico de relleno. Mira la hoja y completa `media_review` en cada beat con foto/clip: confirma por escrito qué muestra. El check guarda una línea por medio en manifest.media_review y el resultado en manifest.quality.media_relevance.",
        "Plano preferido: texto grande a un lado y foto grande al otro (rough.introv2 o binary.introv2 con text, src, highlight y focus); úsalo unas 3–5 veces en 10 min con imágenes distintas.",
        "El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta. Usa logo, logoName, logoPos y logoSize en el componente visual; common.logo está obsoleto.",
        "Narrativa amarillista: miniatura C obligatoria con bullet rojo/amarillo que cite un dato dicho en el guion, como «250 PUESTOS».",
        f"Orquestación: lee {KIT_DIR / 'guides' / 'orquestacion.md'}. Tú eres el productor; puedes DELEGAR trabajos acotados",
        "a DeepSeek o Codex con `kit.py delegate` (roles en src/skills/models/roles.json: component_draft, copy_draft, fact_check, text_draft, dialogue_draft) y",
        "revisar lo que vuelve. Para borradores de texto y diálogos, considera `text_draft` o `dialogue_draft` con Terra cuando ayude; son tareas optativas y no cambian tus modelos por defecto.",
        "Terra recibe las instrucciones y el contexto indicados, entrega Markdown y escribe solo dentro de la carpeta del video; todo queda anotado en work/usage.jsonl y `kit.py usage` arma usage.json.",
        "Sin emojis en ningún texto de publish.json.",
        "",
        "Permisos: solo puedes escribir dentro de la carpeta del video. Para ejecutar algo, los únicos comandos",
        "son los CLI del kit, medios y publicación, escritos EXACTAMENTE así (rutas absolutas, sin variables ni `cd`):",
        f"  {py} {KIT_CLI} status {vid}",
        f"  {py} {KIT_CLI} components {vid}",
        f"  {py} {KIT_CLI} check {vid}",
        f"  {py} {KIT_CLI} sheet {vid} --orient both",
        f"  {py} {KIT_CLI} manifest {vid}",
        f"  {py} {KIT_CLI} delegate {vid} <rol> --prompt-file work/<pedido>.md [--out <ruta en el video>] [--context PLAN.md]",
        f"  {py} {KIT_CLI} usage {vid}",
        f"  {py} -m src.core.explainer.publishing build {vid}",
        f"  {py} -m src.core.explainer.publishing check {vid}",
        f"  {py} {MEDIA_CLI} search \"<consulta en inglés>\"",
        f"  {py} {MEDIA_CLI} search-concept \"<sujeto concreto>\" --query \"<consulta inglesa 1>\" --query \"<consulta inglesa 2>\"",
        f"  {py} {MEDIA_CLI} get {vid} \"File:…\" nombre.jpg",
        READING.get(record.get("agent") or "", READING["claude"]),
        "NUNCA ejecutes voice, transcribe, outro ni preview en una producción del pipeline; el host genera voz, transcripción y cierre.",
        "No detengas la producción por un elemento o check: degrada con el catálogo y guarda lo hecho. Para y reporta solo ante infraestructura sin red, cuota o disco.",
    ]
    if record["category_path"].split("/", 1)[0] not in package_categories():
        lines.append("Esta categoría no tiene perfil de paquete v2: no busques categories/<categoría>.json ni ejecutes publishing build/check. Conserva publish.json legacy con youtube_title, youtube_description, youtube_tags y los textos por red; usa el tono del brief/categoría.")
    else:
        lines.append("El paquete v2 rechaza claves desconocidas. No agregues production_phase, pending, intro ni thumbnail.tabloid.composition: usa los campos exactos del ejemplo y el esquema; corrige lo que indique publishing check.")
    if phase == "guion":
        lines += [
            "FASE GUION: investiga y completa PLAN, script.json, medios, componentes y paquete preliminar. No hagas storyboard ni checks que dependan del audio.",
            'Al terminar escribe work/phase.json con {"phase":"script_ready"} y finaliza la corrida. El host validará el guion antes de generar voz.',
        ]
    else:
        lines += [
            "FASE STORYBOARD: continúa con el guion, audio y lyrics ya existentes. Completa storyboard, hojas, publish.json, manifest listo y usage; kit.py check y publishing check deben dar 0 errores.",
            'Si cambias texto, tono, intensidad o dirección de voz, cambia el guion, escribe work/phase.json con {"phase":"script_ready"} y termina inmediatamente para que el host regenere voz y transcripción.',
            f"Los cambios de capítulos, act o subtítulos visuales no requieren regenerar voz. QC de narración del host (ver work/narration.qc.json y verifica las palabras faltantes): {qc or 'sin datos de QC'}",
        ]
        if phase == "reparacion":
            lines.append("REPARACIÓN ÚNICA Y CORTA: corrige estos errores exactos sin cambiar el guion; conserva lo demás:\n" + qc)
        elif phase == "storyboard_rescate":
            lines.append("STORYBOARD DE RESCATE: está vacío. Crea uno completo con componentes del catálogo; descarta elementos defectuosos sin detenerte.")
    if resume:
        lines.insert(0, f"CONTINÚA una producción que quedó a medias. Corre primero `{py} {KIT_CLI} status {vid}` y sigue desde el primer paso pendiente.")
    return "\n".join(lines)


def _isolated_agent_prompt(record: dict, *, phase: str, resume: bool, qc: str) -> str:
    """A file-only agent works with its local copy of the public design contract."""
    if phase == 'media_seleccion':
        return (
            'FASE SELECCIÓN DE IMÁGENES: lee work/agent-context/media-candidates.json y observa cada '
            'imagen local candidata. Elige como máximo una por request_id solo si representa fielmente '
            'la frase y el sujeto; descarta las que no sean pertinentes. No inventes lo que muestran. '
            'Escribe work/media-selection.json con {"version":1,"selections":[{"request_id":"id",'
            '"candidate_id":"id opaco mostrado en el catálogo","depiction":"qué se ve"}]}. '
            'Usa una lista vacía si ninguna sirve. No edites otros archivos ni ejecutes comandos. '
            'El host copiará las seleccionadas y guardará sus créditos.'
        )
    lines = [
        f"Prepara el video {record['video_id']} con el diseño {record['design']}.",
        f"Tema: {record['topic']}. Categoría: {record['category_path']}.",
        "Trabaja exclusivamente en esta carpeta. Usa herramientas de lectura y escritura de archivos.",
        "Lee BRIEF.md, PLAN.md, assets/config.json y work/agent-context/QUICK.md. "
        "El catálogo está en work/agent-context/index.json; consulta entries/<id>.json para parámetros y ejemplos.",
        "La hoja QUICK es una referencia de componentes: ignora sus indicaciones de ejecutar comandos o delegar.",
        "No puedes ejecutar CLI, buscar o descargar medios, delegar, acceder a otras producciones ni renderizar. "
        "El host puede buscar imágenes según solicitudes declarativas; no inventes contenidos ni fuentes.",
        "Para afirmaciones factuales usa únicamente fuentes que ya estén en el brief o se hayan entregado; "
        "si faltan, anota la falta y no afirmes haber investigado ni inventes citas.",
        "El host genera y valida voz, transcripción, manifiesto, carteles y comprobaciones. "
        "No inventes resultados de esas operaciones ni cambies el audio o la transcripción.",
        "Conserva el esquema y los metadatos existentes; guarda JSON válido y usa anclas exactas de la voz.",
    ]
    if record.get('description'):
        lines.append(f"Descripción: {record['description']}")
    if record.get('target_minutes'):
        lines.append(f"Duración objetivo: {record['target_minutes']:g} minutos; conserva target_minutes y apunta a unas 130 palabras por minuto.")
    if record.get('narrative_id'):
        story = narrative.get_service().get(record['narrative_id'])
        lines.append(f"Narrativa: {story.label}. Cada segmento lleva act, en este orden: " + ', '.join(act.id for act in story.spoken_acts) + '.')
        for act in story.spoken_acts:
            tones = story.voice.allowed_tones.get(act.id, [])
            lines.append(f"Acto {act.id}: {act.function} {'; '.join(act.rules)}. "
                         + (f"Tonos permitidos: {', '.join(tones)}." if tones else ''))
    if resume:
        lines.append('Retoma los archivos existentes y conserva lo ya válido.')
    if phase == 'guion':
        lines.extend([
            'FASE GUION: completa PLAN.md y assets/script.json: cada segmento requiere id único, text y tone; usa act cuando corresponda. No escribas el cierre de voz.',
            'Solicita imágenes escribiendo work/media-requests.json con {"version":1,"requests":['
            '{"id":"identificador","anchor":"frase exacta de un segmento","shows":"sujeto concreto visible",'
            '"queries":["búsqueda concreta en inglés", "otra búsqueda"]}]}. Hasta 16 solicitudes y una imagen elegida por solicitud, '
            'sin URLs ni rutas. Si el material aportado es suficiente usa requests: [].',
            'Al terminar escribe work/phase.json con {"phase":"script_ready"}. El host validará el guion antes de generar la voz.',
        ])
    else:
        lines.extend([
            'FASE STORYBOARD: completa assets/storyboard.json usando el guion y assets/lyrics.json existentes. Cada beat usa un componente del catálogo, parámetros válidos y anclas exactas.',
            'Consulta work/agent-context/media-imported.json si existe: usa solo imágenes que hayas revisado y conserva sus créditos.',
            'Si cambias texto o dirección de voz en el guion, escribe work/phase.json con {"phase":"script_ready"} y termina para que el host regenere el audio.',
            'El host revisará el resultado; no marques comprobaciones como aprobadas sin haberlas realizado.',
        ])
        if qc:
            lines.append('Observaciones del host para atender:\n' + qc)
        if phase == 'reparacion':
            lines.append('Corrige únicamente las observaciones indicadas sin cambiar el guion cuando sea posible.')
        elif phase == 'storyboard_rescate':
            lines.append('El storyboard está vacío: crea uno completo con componentes existentes.')
    return '\n'.join(lines)


def brief_markdown(record: dict, brief: dict | None) -> str:
    out = [
        f"# Brief · {record['topic']}",
        "",
        f"- Categoría: `{record['category_path']}`",
        f"- Diseño: `{record['design']}`",
        f"- Estrategia narrativa: `{record.get('narrative_id') or 'documental (sin narrativa)'}`"
        + (f" · títulos nivel `{record['title_level']}`" if record.get("title_level") else ""),
    ]
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
        publish_checker: Callable[[str], Awaitable[tuple[int, str]]] = run_publish_check,
    ) -> None:
        if agent_getter is None:
            from src.adapters.agent.factory import get_agent

            agent_getter = get_agent
        self._agent_getter = agent_getter
        self._kit = kit_runner
        self._publish_check = publish_checker
        self._recorder_getter = recorder_getter
        # None = cada video va a la carpeta de su categoría (src/templates/nodetech/…);
        # una ruta fija se usa en tests.
        self._videos_dir = videos_dir
        self._uploads_dir = uploads_dir
        self._tasks: dict[str, asyncio.Task] = {}
        self._recovered = False

    @property
    def uploads_dir(self) -> Path:
        if self._uploads_dir:
            return self._uploads_dir
        layout = layout_for_settings(settings)
        return (layout.system_dir / "uploads" / "explainer" if layout.schema_version >= 2
                else settings.data_dir / "explainer" / "uploads")

    @staticmethod
    def _col():
        return collection("explainer_productions")

    # ── consultas ────────────────────────────────────────────────────────────
    async def dispatch_due(self, now: datetime | None = None) -> list[str]:
        now = now or datetime.now(timezone.utc)
        started = []
        for rec in sorted(self._col().list(), key=lambda row: row.get("created_at", "")):
            batch = collection("explainer_batches").get(rec["batch_id"]) if rec.get("batch_id") else None
            if batch and batch.get("state") in {"creating", "deleting"}:
                continue
            if rec.get("state") != "queued" or not rec.get("managed_queue"):
                continue
            if rec.get("not_before") and datetime.fromisoformat(rec["not_before"]) > now:
                continue
            if rec["production_id"] not in self._tasks:
                self._start(rec["production_id"], resume=bool(rec.get("resume_requested")))
                started.append(rec["production_id"])
        return started

    async def shutdown(self) -> None:
        tasks = list(self._tasks.values())
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    async def recover_interrupted(self) -> int:
        """Producciones activas de un proceso anterior → failed (se pueden retomar)."""
        if self._recovered:
            return 0
        self._recovered = True
        fixed = 0
        for rec in self._col().list():
            if rec.get("state") == "queued" and rec.get("managed_queue"):
                continue
            if rec.get("state") in {s.value for s in ACTIVE_STATES} and rec["production_id"] not in self._tasks and task_can_recover("explainer", rec["production_id"], queued=rec.get("state") == "queued", updated_at=rec.get("updated_at")):
                agent_log = Path(rec["agent_log_path"]) if rec.get("agent_log_path") else None
                if agent_log and agent_log.exists() and rec.get("log_path"):
                    with Path(rec["log_path"]).open("a", encoding="utf-8") as log:
                        log.write("\n[agente interrumpido]\n" + agent_log.read_text(encoding="utf-8", errors="replace"))
                    agent_log.unlink()
                await self._col().update(rec["production_id"], {"state": ProductionState.failed.value,
                                                                "agent_log_path": None, "error": "interrumpida (el servidor se reinició); usa Retomar", "updated_at": _now()})
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
            if rec.get("agent_log_path"):
                active = Path(rec["agent_log_path"])
                if active.exists():
                    raw += "\n" + active.read_text(encoding="utf-8", errors="replace")
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
        narrative_id: str | None = None,
        title_level: str | None = None,
        batch_id: str | None = None,
        batch_parallel: int = 1,
        not_before: str | None = None,
        short_test: bool = False,
    ) -> dict:
        async with runtime.named_lock("admission"):
            runtime.validate_parallel(batch_parallel)
            if not_before:
                stamp = datetime.fromisoformat(not_before)
                if stamp.tzinfo is None:
                    raise ValueError("not_before requiere zona horaria")
                not_before = stamp.astimezone(timezone.utc).isoformat()
            if short_test and (minutes is None or not 1 <= minutes <= 2):
                raise ValueError("short_test requiere entre 1 y 2 minutos")
            if sum(r.get("state") in {s.value for s in ACTIVE_STATES} for r in self._col().list()) >= settings.explainer_max_pending_productions:
                raise ValueError("cola de preparación llena; espera a que termine algún pedido")
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
            # La del pedido, o la del brief, o la default de la categoría (None si no carga ninguna).
            story = narrative.get_service().resolve(
                category_path.split("/", 1)[0], narrative_id or (brief.narrative_id if brief else None)
            )
            level = story.title_level(title_level or (brief.title_level if brief else None)) if story else None
            if brief is not None:
                brief.narrative_id, brief.title_level = (story.id if story else None), level
            agent_name = agent or _default_agent()
            if not self._agent_getter(agent_name).available():
                raise ValueError(f"el agente local '{agent_name}' no está instalado en esta máquina")

            production_id = uuid.uuid4().hex[:12]
            top = get_category(top_level_of(category_path))
            folder = (top.folder if top else None) or "nodehistory"
            video_id = unique_video_id(brief.video_id if brief else topic, self._videos_dir)
            layout = layout_for_settings(settings)
            if layout.schema_version >= 2 and self._videos_dir is None:
                video_id = uuid.uuid4().hex
            reserved = {r["video_id"] for r in self._col().list() if r.get("video_id")}
            base, suffix = video_id, 2
            while video_id in reserved:
                video_id = f"{base[:55]}-{suffix}"
                suffix += 1
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

            log_ref = None
            if layout.schema_version >= 2:
                log_ref = await register_execution_log(
                    f"logs/videos/{video_id}/{production_id}.log", kind="production",
                    production_id=production_id, video_id=video_id,
                )
            record = {
                "production_id": production_id,
                "video_id": video_id,
                "category_path": category_path,
                "design": design,
                "folder": folder,
                "topic": topic.strip(),
                "description": description.strip(),
                "target_minutes": float(minutes) if short_test else clamp_minutes(minutes),
                "short_test": short_test,
                "batch_id": batch_id,
                "batch_parallel": batch_parallel,
                "not_before": not_before,
                "managed_queue": True,
                "narrative_id": story.id if story else None,
                "title_level": level,
                "agent": agent_name,
                "auto_record": auto_record,
                "brief": brief.model_dump() if brief else None,
                "media": staged,
                "plan_item_id": plan_item_id,
                "state": ProductionState.queued.value,
                "phase": "guion",
                "error": None,
                "video_status": None,
                "record_job_id": None,
                "log_path": str(log_ref.path if log_ref else settings.data_dir / "explainer" / "logs" / f"{production_id}.log"),
                "log_id": log_ref.log_id if log_ref else None,
                "created_at": _now(),
                "updated_at": _now(),
            }
            await self._col().insert(record)
            if layout.schema_version >= 2:
                from src.core.content_registry import upsert_video
                await upsert_video(video_id, production_id, details={
                    "category_id": category_path, "design_id": design, "title": topic.strip(),
                    "folder_key": f"productions/{folder}/{video_id}", "status": "queued",
                })
            if not batch_id and (not not_before or datetime.fromisoformat(not_before) <= datetime.now(timezone.utc)):
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
        task = start_owned_task("explainer", production_id, lambda: self._run(production_id, resume))
        if task is None:
            return
        self._tasks[production_id] = task
        task.add_done_callback(lambda _t: self._tasks.pop(production_id, None))

    async def wait(self, production_id: str) -> dict:
        task = self._tasks.get(production_id)
        if task:
            await task
        return self.get(production_id)

    def _root(self, rec: dict) -> Path:
        """Carpeta donde vive el video de esta producción."""
        return self._videos_dir or production_root() / (rec.get("folder") or "nodehistory")

    async def _update(self, production_id: str, **patch: Any) -> None:
        rec = await self._col().update(production_id, {**patch, "updated_at": _now()})
        if rec and layout_for_settings(settings).schema_version >= 2 and ("state" in patch or "phase" in patch):
            from src.core.content_registry import update_video_details
            if collection("content_videos").get(rec["video_id"]) is not None:
                fields = {name: patch[name] for name in ("state", "phase") if name in patch}
                if "state" in fields:
                    fields["status"] = fields.pop("state")
                await update_video_details(rec["video_id"], fields)

    # ── ejecución ────────────────────────────────────────────────────────────
    async def _run(self, production_id: str, resume: bool) -> None:
        rec = self.get(production_id)
        async with runtime.production_slot(rec.get("batch_id"), rec.get("batch_parallel")):
            await self._update(production_id, started_at=_now())
            try:
                await self._run_locked(production_id, resume)
            except asyncio.CancelledError:
                await self._update(production_id, state=ProductionState.failed.value,
                                   error="interrumpida; usa Retomar", finished_at=_now())
                raise
            except Exception as exc:  # noqa: BLE001 - la producción guarda el error
                logger.error("explainer_production_failed", production_id=production_id, error=str(exc))
                await self._update(production_id, state=ProductionState.failed.value, error=str(exc)[-800:])
            finally:
                await self._update(production_id, finished_at=_now())

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

        kit_commands = ("status", "components", "check", "sheet", "manifest", "delegate", "usage")
        if layout_for_settings(settings).schema_version >= 3:
            from src.core.explainer.agent_context import ensure_private_workspace, prepare_design_context

            prepare_design_context(video_dir, rec['design'])
            ensure_private_workspace(video_dir)
            scope = AgentScope(writable_dir=str(video_dir.resolve()), os_sandbox_dir=str(video_dir.resolve()))
        else:
            scope = AgentScope(
            writable_dir=_rel(video_dir),
            commands=tuple(f"{sys.executable} {KIT_CLI} {cmd}" for cmd in kit_commands)
            + (f"{sys.executable} {MEDIA_CLI}", f"{sys.executable} -m src.core.explainer.publishing"),
            os_sandbox_dir=_rel(video_dir),
            extra_writable=((str(layout_for_settings(settings).logs_dir / "videos" / video_dir.name),)
                            if layout_for_settings(settings).schema_version >= 2 else
                            (str(KIT_DIR / ".state"), str(layout_for_settings(settings).runtime_dir / "runtime/task-leases"))),
            extra_env={"NEXA_EXPLAINER_PIPELINE_AGENT": "1"},
            )
        timeout = max(settings.agent_production_timeout_seconds, agent_timeout_seconds(rec.get("target_minutes")))
        marker = _read_phase(video_dir)
        # Un marcador sin huella es una petición del agente; nunca prueba que el audio sea vigente.
        phase = marker.get("phase")
        current_hash = _script_hash(video_dir)
        old_hash = marker.get("script_sha256") or ""
        if phase in ("voice_ready", "storyboard") and old_hash and not old_hash.startswith("audio-v1:"):
            # Upgrade an unchanged legacy marker without discarding its valid audio.
            raw_hash = hashlib.sha256((video_dir / "assets" / "script.json").read_bytes()).hexdigest()
            if old_hash == raw_hash:
                _write_phase(video_dir, phase, current_hash)
                marker["script_sha256"] = current_hash
        if phase in ("voice_ready", "storyboard") and (not current_hash or marker.get("script_sha256") != current_hash):
            phase = "script_ready"
        if phase in ("voice_ready", "storyboard") and not (video_dir / "assets" / "song.mp3").is_file():
            phase = "script_ready"
        if phase == "storyboard" and not (video_dir / "assets" / "lyrics.json").is_file():
            phase = "voice_ready"
        if phase not in ("script_ready", "voice_ready", "storyboard"):
            await self._update(production_id, state=ProductionState.producing.value, phase="guion")
            try:
                result = await self._run_agent(rec, video_dir, log_path, scope, timeout, "guion", resume=resume)
                if not result.ok:
                    raise BudgetExhausted(f"agente guion falló (código {result.exit_code}, timeout={result.timed_out}): {result.last_message}")
                errors = _validate_script(video_dir, rec.get("narrative_id"), rec.get("target_minutes"))
                if errors:
                    raise BudgetExhausted("guion inválido: " + "; ".join(errors))
                if _read_phase(video_dir).get("phase") != "script_ready":
                    _write_phase(video_dir, "script_ready")
                phase = "script_ready"
            except BudgetExhausted as exc:
                await self._finish(rec, video_dir, log_path, scope, timeout, [str(exc)], can_repair=False)
                return

        # El presupuesto acota también las pasadas que solicitan regenerar el guion.
        while True:
            # Host-mediated images use the same run budget and do not grant the agent network access.
            if layout_for_settings(settings).schema_version >= 3 and phase == 'script_ready':
                from src.core.explainer import host_media

                try:
                    host_media.initialize_legacy_requests(video_dir, rec.get('media') or [],
                                                          allow_existing_references=resume)
                    media_state = await asyncio.wait_for(host_media.prepare(video_dir, production_id), timeout=150)
                    if media_state['request_count'] and not media_state['candidates'] and not rec.get('media'):
                        raise host_media.MediaBrokerError('No hay imágenes candidatas; revisa la solicitud y retoma')
                    if media_state['candidates']:
                        if not media_state.get('applied'):
                            try:
                                host_media.apply_selection(video_dir, production_id, media_state,
                                                           require_nonempty=not bool(rec.get('media')))
                            except host_media.MediaBrokerError:
                                script_digest = _script_hash(video_dir)
                                result = await self._run_agent(rec, video_dir, log_path, scope, timeout, 'media_seleccion', resume=True)
                                if not result.ok:
                                    raise host_media.MediaBrokerError('La selección de imágenes falló; retoma la producción')
                                if _script_hash(video_dir) != script_digest:
                                    raise host_media.MediaBrokerError('El guion cambió durante la selección; revísalo y retoma')
                                host_media.apply_selection(video_dir, production_id, media_state,
                                                           require_nonempty=not bool(rec.get('media')))
                        else:
                            host_media.apply_selection(video_dir, production_id, media_state,
                                                       require_nonempty=not bool(rec.get('media')))
                except (host_media.MediaBrokerError, BudgetExhausted, asyncio.TimeoutError) as exc:
                    raise RuntimeError(f'Medios pendientes: {exc or "tiempo de búsqueda agotado"}; usa Retomar') from exc

            if phase in ("script_ready", "voice_ready"):
                errors = _validate_script(video_dir, rec.get("narrative_id"), rec.get("target_minutes"))
                if errors:
                    _write_phase(video_dir, "guion")
                    await self._finish(rec, video_dir, log_path, scope, timeout, ["guion inválido: " + "; ".join(errors)], can_repair=False)
                    return
                digest = _script_hash(video_dir)
                if phase == "script_ready":
                    await self._update(production_id, state=ProductionState.producing.value, phase="voice")
                    await self._host_step(rec, video_dir, log_path, "voice")
                    if not (video_dir / "assets" / "song.mp3").is_file():
                        raise RuntimeError("host voice terminó sin assets/song.mp3; usa Retomar")
                    if _script_hash(video_dir) != digest:
                        raise RuntimeError("el guion cambió durante la voz; usa Retomar")
                    _write_phase(video_dir, "voice_ready", digest)
                await self._update(production_id, state=ProductionState.producing.value, phase="transcribe")
                await self._host_step(rec, video_dir, log_path, "transcribe")
                if not (video_dir / "assets" / "lyrics.json").is_file():
                    raise RuntimeError("host transcribe terminó sin assets/lyrics.json; usa Retomar")
                if _script_hash(video_dir) != digest:
                    _write_phase(video_dir, "script_ready")
                    raise RuntimeError("el guion cambió durante la transcripción; usa Retomar")
                _write_phase(video_dir, "storyboard", digest)
            digest = _read_phase(video_dir).get("script_sha256")
            script_before = (video_dir / "assets" / "script.json").read_bytes()
            await self._update(production_id, state=ProductionState.producing.value, phase="storyboard")
            qc_path = video_dir / "work" / "narration.qc.json"
            qc = qc_path.read_text(encoding="utf-8") if qc_path.exists() else ""
            try:
                data = json.loads(qc)
                qc = json.dumps({key: data.get(key) for key in ("faltan", "sobran", "wer_aprox") if key in data}, ensure_ascii=False)
            except ValueError:
                qc = qc[:6000]
            try:
                result = await self._run_agent(rec, video_dir, log_path, scope, timeout, "storyboard", resume=True, qc=qc)
                if not result.ok:
                    raise BudgetExhausted(f"agente storyboard falló (código {result.exit_code}, timeout={result.timed_out}): {result.last_message}")
            except BudgetExhausted as exc:
                await self._finish(rec, video_dir, log_path, scope, timeout, [str(exc)])
                return
            marker = _read_phase(video_dir)
            if marker.get("phase") == "script_ready" or _script_hash(video_dir) != digest:
                _write_phase(video_dir, "script_ready")
                if _script_hash(video_dir) == digest:
                    if (video_dir / "assets" / "script.json").read_bytes() != script_before:
                        _write_phase(video_dir, "storyboard", digest)
                        break  # metadata-only edits: finish validation with the existing audio
                    await self._finish(rec, video_dir, log_path, scope, timeout, ["el agente pidió otra pasada sin cambiar el guion"])
                    return
                phase = "script_ready"
                continue
            break

        await self._finish(rec, video_dir, log_path, scope, timeout, [])

    async def _finish(self, rec, video_dir, log_path, scope, timeout, issues, *, can_repair=True):
        production_id, vid = rec["production_id"], rec["video_id"]
        await self._update(production_id, state=ProductionState.finishing.value, phase="finishing")
        # El rescate cuenta dentro del mismo presupuesto, incluso al retomar.
        if _storyboard_empty(video_dir):
            try:
                digest = _script_hash(video_dir)
                result = await self._run_agent(rec, video_dir, log_path, scope, min(timeout, 600), "storyboard_rescate", resume=True)
                if not result.ok:
                    issues.append(f"rescate de storyboard falló: {result.last_message}")
                if _script_hash(video_dir) != digest:
                    _write_phase(video_dir, "script_ready")
                    issues.append("el guion cambió durante el rescate; la voz y transcripción requieren regeneración")
            except BudgetExhausted as exc:
                issues.append(str(exc))
            if _storyboard_empty(video_dir):
                issues.append("storyboard vacío; requiere revisión")

        async def checks():
            found = []
            code, out = await self._kit(["check", vid])
            with log_path.open("a", encoding="utf-8") as log:
                log.write("\n[host check]\n" + out)
            found.extend(_check_errors("kit.py check", code, out))
            if rec["category_path"].split("/", 1)[0] in package_categories():
                code, out = await self._publish_check(vid)
                with log_path.open("a", encoding="utf-8") as log:
                    log.write("\n[host publishing check]\n" + out)
                found.extend(_check_errors("publishing check", code, out))
            return found

        errors = await checks()
        if errors and can_repair:
            try:
                digest = _script_hash(video_dir)
                result = await self._run_agent(rec, video_dir, log_path, scope, min(timeout, 600), "reparacion", resume=True, qc="\n".join(errors))
                if not result.ok:
                    issues.append(f"reparación falló: {result.last_message[-800:]}")
                if _script_hash(video_dir) != digest:
                    _write_phase(video_dir, "script_ready")
                    issues.append("el guion cambió durante la reparación; la voz y transcripción requieren regeneración")
                errors = await checks()
            except BudgetExhausted as exc:
                issues.append(str(exc))
        issues.extend(errors)
        if not _storyboard_empty(video_dir):
            issues = [issue for issue in issues if issue != "storyboard vacío; requiere revisión"]
        code, out = await self._kit(["manifest", vid])
        if code:
            issues.extend(_check_errors("manifest", code, out))
        manifest_path = video_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
        has_audio_and_lyrics = all((video_dir / "assets" / name).is_file() for name in ("song.mp3", "lyrics.json"))
        blocking = (bool(errors) or code != 0 or not has_audio_and_lyrics
                    or manifest.get("status") not in ("listo", "renderizado"))
        if blocking:
            manifest["status"] = "en progreso"
        manifest["quality_issues"] = list(dict.fromkeys(issues))
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        if layout_for_settings(settings).schema_version >= 2:
            from src.adapters.content.local_inventory import LocalContentInventory
            from src.core.content_registry import index_production_assets
            await index_production_assets(vid, video_dir, LocalContentInventory())
        if blocking:
            await self._update(production_id, video_status="en progreso", state=ProductionState.incomplete.value,
                               phase="review", error="; ".join(manifest["quality_issues"])[:800] or "manifest incompleto")
            return
        await self._kit(["poster", vid])
        video = load_video(video_dir)
        await self._update(production_id, video_status="listo", state=ProductionState.ready.value, phase="ready", error=None)
        if not rec.get("auto_record") or self._recorder_getter is None:
            return
        await self._update(production_id, state=ProductionState.recording.value)
        recorder = self._recorder_getter()
        job = recorder.submit(video, duration="full")
        await self._update(production_id, record_job_id=job.job_id)
        job = await recorder.wait(job.job_id)
        if job.state.value == "failed":
            raise RuntimeError(f"grabación fallida: {job.error}")
        await self._update(production_id, state=ProductionState.done.value)

    async def _run_agent(self, rec, video_dir, log_path, scope, timeout, phase, *, resume, qc=""):
        from src.core.explainer.usage import _tool, record_agent_run, summarize

        policy = _policy()
        current = self.get(rec["production_id"])
        runs = dict(current.get("agent_runs") or {})
        # Los registros anteriores a esta política también gastaron presupuesto.
        # El contador reservado persiste aunque una corrida se interrumpa antes de
        # escribir el ledger; usar el máximo evita contar dos veces esas corridas.
        ledger = _tool().entries(video_dir)
        before_tokens = _ledger_tokens(ledger)
        historical = {}
        for row in ledger:
            if row.get("role") != "producer" or row.get("provider") not in ("codex", "claude"):
                continue
            step = row.get("step") or "legacy"
            group_name = "storyboard" if step == "storyboard_rescate" else step
            historical[group_name] = historical.get(group_name, 0) + 1
        for name, count in historical.items():
            runs[name] = max(runs.get(name, 0), count)
        group = "storyboard" if phase == "storyboard_rescate" else phase
        prior = current.get("agent_failure") or {}
        if prior.get("phase") == phase and prior.get("input_hash") == _phase_input_hash(video_dir, phase):
            raise BudgetExhausted(f"no se repite {group}: misma huella de fallo {prior.get('fingerprint')}")
        totals = current.get("usage_totals") or {}
        ledger_tokens = sum(int(row.get("input_tokens") or 0) + int(row.get("output_tokens") or 0) for row in ledger)
        tokens = max(ledger_tokens, int(totals.get("input_tokens") or 0) + int(totals.get("output_tokens") or 0))
        special = dict(current.get("agent_special_runs") or {})
        if phase in ("storyboard_rescate", "reparacion") and (special.get(phase, 0) >= 1 or any(
            row.get("role") == "producer" and row.get("step") == phase for row in ledger
        )):
            raise BudgetExhausted(f"ya se ejecutó la única corrida de {phase}")
        if sum(runs.values()) >= policy["max_agent_runs_total"] or runs.get(group, 0) >= policy["max_agent_runs_per_phase"] or tokens >= policy["max_tokens"]:
            raise BudgetExhausted(f"presupuesto agotado antes de {phase} (corridas={sum(runs.values())}, tokens={tokens})")
        runs[group] = runs.get(group, 0) + 1
        # Se reserva antes de ejecutar: un reinicio tampoco devuelve la corrida.
        if phase in ("storyboard_rescate", "reparacion"):
            special[phase] = special.get(phase, 0) + 1
        await self._update(rec["production_id"], agent_runs=runs, agent_special_runs=special)
        # Un log por corrida evita contar otra vez los tokens de vueltas anteriores.
        agent_log = log_path.with_name(f"{log_path.stem}.{uuid.uuid4().hex}.agent.log")
        await self._update(rec["production_id"], agent_log_path=str(agent_log))
        try:
            if layout_for_settings(settings).schema_version >= 3:
                from src.core.explainer.agent_context import ensure_private_workspace

                ensure_private_workspace(video_dir)
            result = await self._agent_getter(rec["agent"]).run(
                build_agent_prompt(rec, video_dir, resume=resume, phase=phase, qc=qc),
                cwd=video_dir if layout_for_settings(settings).schema_version >= 3 else BASE_DIR,
                log_path=agent_log, timeout_seconds=timeout, scope=scope,
            )
        finally:
            if agent_log.exists():
                with log_path.open("a", encoding="utf-8") as log:
                    log.write(f"\n[agente {phase}]\n" + agent_log.read_text(encoding="utf-8", errors="replace"))
                agent_log.unlink()
            await self._update(rec["production_id"], agent_log_path=None)
        await self._update(rec["production_id"], agent_report=result.last_message[-4000:])
        if not result.ok:
            cause = f"{result.exit_code}:{result.timed_out}:{result.last_message.strip()}"
            await self._update(rec["production_id"], agent_failure={"phase": phase,
                "input_hash": _phase_input_hash(video_dir, phase),
                "fingerprint": hashlib.sha256(cause.encode()).hexdigest()[:16]})
        else:
            await self._update(rec["production_id"], agent_failure=None)
        try:
            record_agent_run(video_dir, rec["agent"], result, step=phase)
            if layout_for_settings(settings).schema_version >= 2:
                await _tool().register_reference(video_dir)
            latest = summarize(video_dir)["totals"]
            await self._update(rec["production_id"], usage_totals=_merge_usage(
                self.get(rec["production_id"]).get("usage_totals") or {}, latest, before_tokens))
        except Exception as exc:
            logger.warning("explainer_usage_record_failed", production_id=rec["production_id"], error=str(exc))
        return result

    async def _host_step(self, rec, video_dir, log_path, step):
        from src.core.explainer.usage import _tool, summarize
        before_tokens = _ledger_tokens(_tool().entries(video_dir))
        timeout = host_timeout_seconds(rec.get("target_minutes"))
        with log_path.open("a", encoding="utf-8") as log:
            log.write(f"\n[host {step}, timeout {timeout}s]\n")
        started = time.monotonic()
        ok = False
        try:
            if self._kit is run_kit:
                code, out = await _run_host_kit([step, rec["video_id"]], log_path, timeout)
            else:
                code, out = await asyncio.wait_for(self._kit([step, rec["video_id"]]), timeout)
                with log_path.open("a", encoding="utf-8") as log:
                    log.write(out)
            if code:
                raise RuntimeError(f"host {step} falló (código {code}): {out[-400:]}")
            ok = True
        except asyncio.TimeoutError as exc:
            raise RuntimeError(f"host {step} excedió {timeout} s") from exc
        finally:
            try:
                _tool().record(video_dir, provider="kit", role="host", step=step,
                               seconds=time.monotonic() - started, ok=ok)
                if layout_for_settings(settings).schema_version >= 2:
                    await _tool().register_reference(video_dir)
                latest = summarize(video_dir)["totals"]
                await self._update(rec["production_id"], usage_totals=_merge_usage(
                    self.get(rec["production_id"]).get("usage_totals") or {}, latest, before_tokens))
            except Exception as exc:
                logger.warning("explainer_usage_record_failed", production_id=rec["production_id"], error=str(exc))

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

        if rec.get("short_test"):
            script_path = video_dir / "assets" / "script.json"
            script = json.loads(script_path.read_text())
            script["format"] = "short_preparation"
            script_path.write_text(json.dumps(script, ensure_ascii=False, indent=2) + "\n")

        if rec.get("narrative_id"):
            story = narrative.get_service().get(rec["narrative_id"])
            narrative.record(video_dir, story, rec.get("title_level"), design=rec["design"])

        brief = rec.get("brief")
        (video_dir / "BRIEF.md").write_text(brief_markdown(rec, brief), encoding="utf-8")
        if brief:
            (video_dir / "brief.json").write_text(json.dumps(brief, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            write_publish_json(video_dir, ExplainerBrief.model_validate(brief))

        if rec.get("narrative_id"):
            narrative.stamp_publish_file(video_dir)

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

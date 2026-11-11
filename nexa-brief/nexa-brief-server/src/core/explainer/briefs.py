"""Brief de un video explicativo: ángulo, gancho, esquema y textos por plataforma.

Dos usos:
  · generate_brief(): desde un TEMA (y descripción opcional) → JSON con título
    para YouTube/Facebook/TikTok, descripción, tags, gancho y esquema. No graba
    ni crea nada: es lo que la web muestra en "Generar textos" antes de producir.
  · generate_publish_texts(): para un video YA producido (lee su guion) →
    escribe publish.json para que se pueda publicar.

La estrategia sale de la categoría (niches.json → categories.<id>.strategy):
cada rama (Tech, History, Politics, Economy) tiene su público, tono y
fórmulas de título. Quién escribe (Claude Code, Codex o DeepSeek) es un
parámetro: el puerto `AIPort` es el mismo.
"""

from __future__ import annotations

import inspect
import json
import logging
import re
import time
import unicodedata
import uuid
from pathlib import Path
from typing import Awaitable, Callable

from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator

from src.config.exceptions import AIValidationError
from src.core.categories import get_category, strategy_for
from src.core.explainer import narrative
from src.core.explainer.catalog import video_roots
from src.core.explainer.designs import KitDesign
from src.core.explainer.lengths import chapters_range, clamp_minutes
from src.core.explainer.publishing.store import PUBLISH_FILE, is_package, read_publish
from src.core.metadata.sanitize import strip_emojis
from src.core.ports.ai_port import AIPort

YOUTUBE_TITLE_MAX = 100
TAGS_TOTAL_MAX = 480


class YouTubeCopy(BaseModel):
    title: str
    title_alternatives: list[str] = Field(default_factory=list)
    description: str
    tags: list[str] = Field(default_factory=list)

    @field_validator("title")
    @classmethod
    def _title_len(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("título vacío")
        return v[:YOUTUBE_TITLE_MAX]

    @field_validator("tags")
    @classmethod
    def _tags_budget(cls, v: list[str]) -> list[str]:
        out, total = [], 0
        for tag in (t.strip().lstrip("#") for t in v):
            if tag and total + len(tag) <= TAGS_TOTAL_MAX:
                out.append(tag)
                total += len(tag)
        return out


class FacebookCopy(BaseModel):
    title: str
    description: str


class TikTokCopy(BaseModel):
    caption: str
    hashtags: list[str] = Field(default_factory=list)

    @field_validator("hashtags")
    @classmethod
    def _hash(cls, v: list[str]) -> list[str]:
        return ["#" + h.strip().lstrip("#") for h in v if h.strip().lstrip("#")]


class ExplainerBrief(BaseModel):
    video_id: str
    # Identifica el consumo asociado a esta generación. Se conserva al pasar
    # el brief a una producción, pero nunca se incluye en publish.json.
    usage_trace_id: str | None = None
    # Los completa el servidor (no el modelo): la narrativa y el nivel de título con que se escribió.
    narrative_id: str | None = None
    title_level: str | None = None
    working_title: str
    hook: str
    angle: str
    thesis: str
    outline: list[str] = Field(default_factory=list)
    youtube: YouTubeCopy
    facebook: FacebookCopy
    instagram: FacebookCopy | None = None
    tiktok: TikTokCopy
    thumbnail_text: str = ""
    media_suggestions: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def _no_emojis(self) -> ExplainerBrief:
        """Ningún texto de publicación lleva emojis (aunque el modelo los ponga)."""
        clean = strip_emojis
        self.working_title, self.hook, self.thumbnail_text = clean(self.working_title), clean(self.hook), clean(self.thumbnail_text)
        self.youtube.title = clean(self.youtube.title)
        self.youtube.title_alternatives = [clean(t) for t in self.youtube.title_alternatives]
        self.youtube.description = "\n".join(clean(line) for line in self.youtube.description.split("\n"))
        self.facebook.title = clean(self.facebook.title)
        self.facebook.description = "\n".join(clean(line) for line in self.facebook.description.split("\n"))
        if self.instagram is not None:
            self.instagram.title = clean(self.instagram.title)
            self.instagram.description = "\n".join(clean(line) for line in self.instagram.description.split("\n"))
        self.tiktok.caption = clean(self.tiktok.caption)
        self.tiktok.hashtags = [h for h in (clean(h) for h in self.tiktok.hashtags) if h.strip("#")]
        return self

    def to_publish_json(self) -> dict:
        """Formato de publish.json del explainer-kit (+ campos de Facebook)."""
        return {
            "youtube_title": self.youtube.title,
            "youtube_title_alternatives": self.youtube.title_alternatives,
            "youtube_description": self.youtube.description,
            "youtube_tags": self.youtube.tags,
            "instagram_title": (self.instagram or self.facebook).title,
            "instagram_description": (self.instagram or self.facebook).description,
            "facebook_title": self.facebook.title,
            "facebook_description": self.facebook.description,
            "tiktok_caption": self.tiktok.caption,
            "tiktok_hashtags": self.tiktok.hashtags,
            "thumbnail_text": self.thumbnail_text,
        }


def slugify(text: str, max_len: int = 48) -> str:
    norm = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    slug = re.sub(r"[^a-z0-9]+", "-", norm.lower()).strip("-")
    slug = slug[:max_len].rstrip("-")
    return slug if len(slug) >= 3 else f"video-{slug or 'nuevo'}"


def unique_video_id(base: str, videos_dir: Path | None = None) -> str:
    """Slug libre en todas las carpetas de categoría (o solo en `videos_dir`)."""
    roots = [videos_dir] if videos_dir is not None else video_roots()
    slug = slugify(base)
    candidate, n = slug, 2
    while any((r / candidate).exists() for r in roots):
        candidate, n = f"{slug}-{n}", n + 1
    return candidate


SYSTEM_PROMPT = """Eres el estratega editorial de una red de canales de documentales narrados
(de 5 a 30 minutos o más; la duración pedida viene en pedido.duracion_minutos; vertical 9:16 y
horizontal 16:9) en español latinoamericano.
Tu trabajo: convertir un TEMA en un ángulo que la gente quiera ver y en los textos
de publicación para YouTube, Facebook y TikTok.

Reglas de títulos (lo más importante):
- Provocadores y con curiosidad, estilo "Cómo la IA pasó de no resolver nada a quitarte el trabajo"
  o "Así se hizo tan potente la IA (y casi nadie lo vio venir)": contraste, tensión, una pregunta abierta.
- Nunca mentir: el título promete solo lo que el video cuenta.
- Lo importante en los primeros 40 caracteres; máximo 70 caracteres en YouTube.
- Sin MAYÚSCULAS sostenidas. Sin emojis en NINGÚN campo (títulos, descripciones, caption, hashtags).
- Un solo momento decisivo (el punto crítico), no una biografía ni una enciclopedia. En videos
  largos el punto crítico sigue siendo la columna: los capítulos son el camino hacia él y su consecuencia.

Devuelve SOLO este JSON:
{
  "video_id": "slug-corto-en-minusculas-con-guiones",
  "working_title": "título corto para la portada del video (máx 5 palabras, en mayúsculas)",
  "hook": "primera frase del video: abre una pregunta en menos de 25 palabras",
  "angle": "el punto crítico elegido (un momento, una decisión, un error)",
  "thesis": "la idea que el espectador se lleva, en una frase",
  "outline": ["un capítulo por elemento (cantidad: pedido.capitulos), en orden; cada uno con la pregunta que responde"],
  "youtube": {
    "title": "título principal",
    "title_alternatives": ["2 alternativas con otra fórmula"],
    "description": "Una o dos frases breves, máximo 400 caracteres. Gancho y contexto concreto; sin enlaces como sustituto ni relleno.",
    "tags": ["8 a 15 tags de búsqueda"]
  },
  "instagram": {"title": "título breve", "description": "Una o dos frases breves, máximo 280 caracteres."},
  "facebook": {"title": "variante pensada para compartir", "description": "Una o dos frases breves, máximo 280 caracteres."},
  "tiktok": {"caption": "Solo un título corto con gancho, máximo 100 caracteres", "hashtags": []},
  "thumbnail_text": "3 o 4 palabras que complementen el título, no que lo repitan",
  "media_suggestions": ["5 a 8 búsquedas en inglés de fotos de archivo con licencia libre"]
}"""

_logger = logging.getLogger(__name__)
_TOKEN_FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens", "total_tokens")
UsageHook = Callable[[dict], Awaitable[None]]


async def _emit_usage(hook: UsageHook | None, event: dict) -> None:
    """La traza es secundaria: un fallo de telemetría no debe repetir ni cancelar IA."""
    if hook is None:
        return
    try:
        result = hook(event)
        if inspect.isawaitable(result):
            await result
    except Exception:
        _logger.exception("explainer_usage_hook_failed", extra={"trace_id": event.get("trace_id")})


def _usage_event(
    usage: dict | None,
    *,
    ai: AIPort,
    trace_id: str,
    operation: str,
    attempt: int,
    started: float,
    status: str,
    error: BaseException | str | None = None,
    video_id: str | None = None,
) -> dict:
    measured = usage if isinstance(usage, dict) else {}
    event = {
        "trace_id": trace_id,
        "operation": operation,
        "attempt": attempt,
        "provider": measured.get("provider") or getattr(ai, "name", type(ai).__name__),
        "model": measured.get("model") or getattr(ai, "_model", None),
        **{key: measured.get(key) for key in _TOKEN_FIELDS},
        "turns": measured.get("turns"),
        "cost_usd": measured.get("cost_usd"),
        "seconds": measured.get("seconds", round(time.monotonic() - started, 3)),
        "usage_known": any(measured.get(key) is not None for key in _TOKEN_FIELDS),
        "status": status,
    }
    if video_id is not None:
        event["video_id"] = video_id
    if error is not None:
        event["error_type"] = error if isinstance(error, str) else type(error).__name__
    return event


def _attempt_usages(usage: dict | None, error: BaseException | None = None) -> list[dict]:
    """Algunos adapters exponen reintentos internos de parseo; no los agregamos."""
    from_error = getattr(error, "usage_attempts", None)
    if isinstance(from_error, list) and from_error and all(isinstance(item, dict) for item in from_error):
        return from_error
    measured = usage if isinstance(usage, dict) else {}
    attempts = measured.get("attempts")
    if isinstance(attempts, list) and attempts and all(isinstance(item, dict) for item in attempts):
        return attempts
    return [measured]


async def _call_json(
    ai: AIPort,
    system_prompt: str,
    user_prompt: str,
    *,
    trace_id: str,
    operation: str,
    on_usage: UsageHook | None,
    attempt_state: list[int],
    video_id: str | None = None,
) -> ExplainerBrief:
    """Llama a un adapter medido si lo ofrece y comunica cada intento sin inventar tokens."""
    started = time.monotonic()
    measured_call = getattr(ai, "complete_json_with_usage", None)
    usage: dict | None = None
    try:
        if callable(measured_call):
            result = await measured_call(system_prompt, user_prompt)
            raw, usage = result
        else:
            raw = await ai.complete_json(system_prompt, user_prompt)
        brief = ExplainerBrief.model_validate(raw)
    except Exception as exc:
        usage = getattr(exc, "usage", usage)
        attempts = _attempt_usages(usage, exc)
        last = len(attempts) - 1
        for offset, item in enumerate(attempts):
            status = item.get("status", "failed")
            if isinstance(exc, ValidationError) and offset == last:
                status = "failed"
            item_error = item.get("error_type")
            error = exc if isinstance(exc, ValidationError) and offset == last else (item_error or exc)
            await _emit_usage(on_usage, _usage_event(
                item, ai=ai, trace_id=trace_id, operation=operation,
                attempt=attempt_state[0], started=started, status=status,
                error=error if status == "failed" else None,
                video_id=video_id,
            ))
            attempt_state[0] += 1
        raise

    attempts = _attempt_usages(usage)
    for item in attempts:
        status = item.get("status", "ok")
        await _emit_usage(on_usage, _usage_event(
            item, ai=ai, trace_id=trace_id, operation=operation,
            attempt=attempt_state[0], started=started, status=status,
            error=item.get("error_type") if status == "failed" else None,
            video_id=video_id,
        ))
        attempt_state[0] += 1
    return brief


def _context(category_path: str, design: KitDesign | None) -> dict:
    node = get_category(category_path)
    strategy = strategy_for(category_path)
    ctx = {
        "categoria": {
            "ruta": category_path,
            "nombre": node.display_name if node else category_path,
            "tema": node.topic if node else "",
        },
        "estrategia": strategy.model_dump(),
    }
    if design:
        ctx["diseño"] = {"id": design.design_id, "canal": design.name, "estilo": design.tagline, "temas": design.topics}
    return ctx


async def _ask(
    ai: AIPort,
    user_payload: dict,
    *,
    trace_id: str,
    operation: str,
    on_usage: UsageHook | None = None,
    video_id: str | None = None,
) -> ExplainerBrief:
    user = json.dumps(user_payload, ensure_ascii=False, indent=1)
    attempt_state = [1]

    async def request(prompt: str) -> ExplainerBrief:
        return await _call_json(
            ai, SYSTEM_PROMPT, prompt, trace_id=trace_id, operation=operation,
            on_usage=on_usage, attempt_state=attempt_state, video_id=video_id,
        )

    try:
        return await request(user)
    except ValidationError as first:
        retry = user + "\n\nTu respuesta anterior no cumplía el esquema: " + str(first)[:600] + "\nCorrígela."
        try:
            return await request(retry)
        except ValidationError as exc:
            raise AIValidationError(f"el brief no cumple el esquema: {exc}") from exc


async def generate_brief(
    ai: AIPort,
    *,
    category_path: str,
    topic: str,
    description: str = "",
    design: KitDesign | None = None,
    media_names: list[str] | None = None,
    minutes: float | None = None,
    narrative_id: str | None = None,
    title_level: str | None = None,
    on_usage: UsageHook | None = None,
) -> ExplainerBrief:
    if not topic.strip():
        raise ValueError("el tema es obligatorio")
    category_id = category_path.split("/", 1)[0]
    story = narrative.get_service().resolve(category_id, narrative_id)   # NarrativeError (400) si no existe
    level = story.title_level(title_level) if story else None
    target = clamp_minutes(minutes)
    lo, hi = chapters_range(target)
    payload = {
        **_context(category_path, design),
        "pedido": {
            "tema": topic.strip(),
            "descripcion": description.strip() or None,
            "medios_del_usuario": media_names or [],
            "duracion_minutos": target,
            "capitulos": f"{lo} a {hi}",
        },
    }
    if (ctx := narrative.brief_context(story, category_id, level)) is not None:
        payload["narrativa"] = ctx
    trace_id = uuid.uuid4().hex
    brief = await _ask(ai, payload, trace_id=trace_id, operation="brief", on_usage=on_usage)
    brief.video_id = slugify(brief.video_id or topic)
    brief.usage_trace_id = trace_id
    brief.narrative_id = story.id if story else None
    brief.title_level = level
    return brief


async def generate_publish_texts(
    ai: AIPort,
    video_dir: Path,
    *,
    category_path: str,
    design: KitDesign | None,
    on_usage: UsageHook | None = None,
) -> ExplainerBrief:
    """Textos para un video ya producido: parte del guion real (script.json)."""
    script_path = video_dir / "assets" / "script.json"
    if script_path.exists():
        script = json.loads(script_path.read_text(encoding="utf-8"))
    else:  # demos de diseño: solo tienen la transcripción
        lyrics = json.loads((video_dir / "assets" / "lyrics.json").read_text(encoding="utf-8"))
        manifest_path = video_dir / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
        script = {"title": manifest.get("title"), "segments": lyrics.get("segments", [])}
    narration = " ".join(s.get("text", "").strip() for s in script.get("segments", []))
    payload = {
        **_context(category_path, design),
        "video_existente": {
            "titulo_en_pantalla": script.get("title"),
            "kicker": script.get("kicker"),
            "guion_completo": narration[:9000],
        },
        "instruccion": "El video ya está hecho: los textos deben describir ESTE guion, sin prometer nada que no diga.",
    }
    recorded = narrative.recorded(video_dir)
    story = None
    if recorded.narrative_id:
        try:
            story = narrative.get_service().get(recorded.narrative_id)
        except narrative.NarrativeError:
            story = None   # narrativa borrada: textos con las reglas generales
    category_id = category_path.split("/", 1)[0]
    if (ctx := narrative.brief_context(story, category_id, recorded.title_level)) is not None:
        payload["narrativa"] = ctx
    trace_id = uuid.uuid4().hex
    brief = await _ask(
        ai, payload, trace_id=trace_id, operation="publish_texts", on_usage=on_usage,
        video_id=video_dir.name,
    )
    brief.video_id = video_dir.name
    brief.usage_trace_id = trace_id
    brief.narrative_id = story.id if story else recorded.narrative_id
    brief.title_level = recorded.title_level
    return brief


def write_publish_json(video_dir: Path, brief: ExplainerBrief, *, overwrite: bool = False) -> bool:
    """Escribe publish.json (v1); no pisa títulos existentes salvo overwrite=True.

    Nunca pisa un paquete v2 (src/core/explainer/publishing): sus campos planos se
    derivan del paquete y mezclarle textos v1 lo dejaría inconsistente.
    """
    path = video_dir / PUBLISH_FILE
    current = read_publish(video_dir)
    if is_package(current) or (current.get("youtube_title") and not overwrite):
        return False
    path.write_text(json.dumps({**current, **brief.to_publish_json()}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return True

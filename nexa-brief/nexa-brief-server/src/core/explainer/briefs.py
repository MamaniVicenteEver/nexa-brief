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

import json
import re
import unicodedata
from pathlib import Path

from pydantic import BaseModel, Field, ValidationError, field_validator

from src.config.exceptions import AIValidationError
from src.core.categories import get_category, strategy_for
from src.core.explainer.catalog import video_roots
from src.core.explainer.designs import KitDesign
from src.core.explainer.publishing.store import PUBLISH_FILE, is_package, read_publish
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
    working_title: str
    hook: str
    angle: str
    thesis: str
    outline: list[str] = Field(default_factory=list)
    youtube: YouTubeCopy
    facebook: FacebookCopy
    tiktok: TikTokCopy
    thumbnail_text: str = ""
    media_suggestions: list[str] = Field(default_factory=list)

    def to_publish_json(self) -> dict:
        """Formato de publish.json del explainer-kit (+ campos de Facebook)."""
        return {
            "youtube_title": self.youtube.title,
            "youtube_title_alternatives": self.youtube.title_alternatives,
            "youtube_description": self.youtube.description,
            "youtube_tags": self.youtube.tags,
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


SYSTEM_PROMPT = """Eres el estratega editorial de una red de canales de documentales cortos narrados
(3 a 4,5 minutos, vertical 9:16 y horizontal 16:9) en español latinoamericano.
Tu trabajo: convertir un TEMA en un ángulo que la gente quiera ver y en los textos
de publicación para YouTube, Facebook y TikTok.

Reglas de títulos (lo más importante):
- Provocadores y con curiosidad, estilo "Cómo la IA pasó de no resolver nada a quitarte el trabajo"
  o "Así se hizo tan potente la IA (y casi nadie lo vio venir)": contraste, tensión, una pregunta abierta.
- Nunca mentir: el título promete solo lo que el video cuenta.
- Lo importante en los primeros 40 caracteres; máximo 70 caracteres en YouTube.
- Sin MAYÚSCULAS sostenidas ni emojis de relleno.
- Un solo momento decisivo (el punto crítico), no una biografía ni una enciclopedia.

Devuelve SOLO este JSON:
{
  "video_id": "slug-corto-en-minusculas-con-guiones",
  "working_title": "título corto para la portada del video (máx 5 palabras, en mayúsculas)",
  "hook": "primera frase del video: abre una pregunta en menos de 25 palabras",
  "angle": "el punto crítico elegido (un momento, una decisión, un error)",
  "thesis": "la idea que el espectador se lleva, en una frase",
  "outline": ["5 a 8 momentos del arco narrativo, en orden"],
  "youtube": {
    "title": "título principal",
    "title_alternatives": ["2 alternativas con otra fórmula"],
    "description": "3 a 5 párrafos: 2 primeras líneas con gancho y palabras clave; contexto; qué aprenderás; cierre con pregunta para comentar. Sin enlaces inventados.",
    "tags": ["8 a 15 tags de búsqueda"]
  },
  "facebook": {"title": "variante pensada para compartir", "description": "2 o 3 frases que inviten a comentar"},
  "tiktok": {"caption": "1 o 2 frases con gancho (máx 150 caracteres)", "hashtags": ["#4", "#a", "#6"]},
  "thumbnail_text": "3 o 4 palabras que complementen el título, no que lo repitan",
  "media_suggestions": ["5 a 8 búsquedas en inglés de fotos de archivo con licencia libre"]
}"""


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


async def _ask(ai: AIPort, user_payload: dict) -> ExplainerBrief:
    user = json.dumps(user_payload, ensure_ascii=False, indent=1)
    raw = await ai.complete_json(SYSTEM_PROMPT, user)
    try:
        return ExplainerBrief.model_validate(raw)
    except ValidationError as first:
        retry = user + "\n\nTu respuesta anterior no cumplía el esquema: " + str(first)[:600] + "\nCorrígela."
        raw = await ai.complete_json(SYSTEM_PROMPT, retry)
        try:
            return ExplainerBrief.model_validate(raw)
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
) -> ExplainerBrief:
    if not topic.strip():
        raise ValueError("el tema es obligatorio")
    payload = {
        **_context(category_path, design),
        "pedido": {
            "tema": topic.strip(),
            "descripcion": description.strip() or None,
            "medios_del_usuario": media_names or [],
        },
    }
    brief = await _ask(ai, payload)
    brief.video_id = slugify(brief.video_id or topic)
    return brief


async def generate_publish_texts(ai: AIPort, video_dir: Path, *, category_path: str, design: KitDesign | None) -> ExplainerBrief:
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
    brief = await _ask(ai, payload)
    brief.video_id = video_dir.name
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

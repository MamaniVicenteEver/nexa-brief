"""Modelos de cada sección de estadísticas.

Una sección = un modelo acá + una función en `sections/` + una línea en
`registry.py`. Las secciones públicas (landing) solo exponen agregados y
datos que el dueño aceptó mostrar (nombre, avatar y enlace público de cada
canal); nunca tokens, errores ni configuración interna.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel

Platform = Literal["youtube", "tiktok", "facebook", "instagram"]


# ── Videos ───────────────────────────────────────────────────────────────────

class VideoStats(BaseModel):
    total: int = 0
    ready: int = 0          # listos, todavía sin publicar
    published: int = 0
    processing: int = 0
    failed: int = 0
    video_seconds: float = 0.0   # duración sumada de los videos renderizados


# ── Publicaciones ────────────────────────────────────────────────────────────

class PlatformPublications(BaseModel):
    platform: Platform
    total: int = 0
    last_7_days: int = 0


class PublicationStats(BaseModel):
    total: int = 0
    last_30_days: int = 0
    by_platform: list[PlatformPublications] = []


# ── Canales ──────────────────────────────────────────────────────────────────

class PublicChannel(BaseModel):
    id: str
    platform: Platform
    name: str
    avatar: str | None = None
    public_url: str | None = None
    published_count: int = 0


class ChannelDetail(PublicChannel):
    alias: str
    label: str = ""
    status: str = "ok"                    # "ok" | "requires_reauth"
    expires_in_seconds: float | None = None
    has_refresh_token: bool = False
    last_published_at: float | None = None


class ChannelStats(BaseModel):
    total: int = 0
    platforms: list[Platform] = []


# ── Catálogo ─────────────────────────────────────────────────────────────────

class CatalogStats(BaseModel):
    templates: int = 0
    lyric_templates: int = 0
    visual_templates: int = 0
    active_niches: int = 0
    engines: list[str] = []
    platforms_supported: list[Platform] = ["youtube", "tiktok", "facebook", "instagram"]


# ── Rendimiento ──────────────────────────────────────────────────────────────

class StageTiming(BaseModel):
    stage: str
    avg_seconds: float


class PerformanceStats(BaseModel):
    avg_generation_seconds: float | None = None
    fastest_generation_seconds: float | None = None
    sample_size: int = 0
    stages: list[StageTiming] = []   # promedio por etapa, de más lenta a más rápida


# ── Publicación destacada (landing) ──────────────────────────────────────────

class ShowcasePublication(BaseModel):
    title: str
    platform: Platform
    url: str | None = None
    published_at: float | None = None
    video_url: str | None = None     # archivo propio para reproducir en la landing


# ── Operación (solo dashboard) ───────────────────────────────────────────────

class ActivityItem(BaseModel):
    kind: Literal["video_ready", "video_failed", "published"]
    at: str
    job_id: str | None = None
    title: str
    platform: Platform | None = None
    url: str | None = None


class UpcomingPublication(BaseModel):
    entry_id: str
    job_id: str
    title: str
    platform: Platform
    account_alias: str
    scheduled_at: str


class Alert(BaseModel):
    level: Literal["error", "warning"]
    kind: Literal["reauth", "token_expiring", "publish_failed", "job_failed", "job_stuck"]
    # Datos para que el frontend arme el mensaje traducido y el enlace.
    platform: Platform | None = None
    account_alias: str | None = None
    job_id: str | None = None
    title: str | None = None
    detail: str | None = None


# ── Respuestas ───────────────────────────────────────────────────────────────

class PublicStats(BaseModel):
    videos: VideoStats
    publications: PublicationStats
    channels: ChannelStats
    channel_list: list[PublicChannel]
    catalog: CatalogStats
    performance: PerformanceStats
    showcase: ShowcasePublication | None = None


class DashboardSummary(BaseModel):
    videos: VideoStats
    publications: PublicationStats
    channels: ChannelStats
    channel_list: list[ChannelDetail]
    catalog: CatalogStats
    performance: PerformanceStats
    alerts: list[Alert]
    upcoming: list[UpcomingPublication]
    activity: list[ActivityItem]

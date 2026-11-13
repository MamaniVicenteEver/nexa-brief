"""Secciones de estadísticas: funciones puras sobre un StatsContext.

Se sobreescriben las fuentes del contexto (cached_property) con datos falsos,
así cada sección se prueba sin DataStore ni publisher reales.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest

from src.core.schedule.models import QueueEntry
from src.core.stats.context import StatsContext
from src.core.stats.registry import DASHBOARD_SECTIONS, PUBLIC_SECTIONS
from src.core.stats.sections import alerts, channels, publications, upcoming, videos

NOW = datetime(2026, 9, 26, 12, 0, tzinfo=timezone.utc)


def iso(delta: timedelta) -> str:
    return (NOW + delta).isoformat()


def entry(**kw) -> QueueEntry:
    base = dict(
        entry_id="e", job_id="j1", platform="youtube", account_alias="canal_1",
        status="queued", source="immediate", created_at=iso(timedelta(hours=-1)),
        updated_at=iso(timedelta(hours=-1)),
    )
    return QueueEntry(**{**base, **kw})


def make_ctx(*, jobs=(), queue=(), pubs=(), accounts=()) -> StatsContext:
    ctx = StatsContext(accounts_loader=lambda: list(accounts), now=NOW)
    ctx.__dict__.update(
        jobs=list(jobs), queue_entries=list(queue), publications=list(pubs), history_events=[]
    )
    return ctx


def job(job_id: str, stage: str, **kw) -> dict:
    return {"job_id": job_id, "stage": stage, "title": job_id, "category": "c",
            "created_at": iso(timedelta(hours=-2)), "updated_at": iso(timedelta(hours=-1)), **kw}


def test_videos_classifies_by_stage_and_publication():
    ctx = make_ctx(
        jobs=[job("a", "packaged", duration_seconds=60), job("b", "packaged", duration_seconds=30),
              job("c", "failed"), job("d", "video_recorded")],
        pubs=[{"platform": "youtube", "alias": "x", "post_id": "1", "job_id": "b", "published_at": NOW.timestamp()}],
    )
    stats = videos.collect(ctx)
    assert (stats.total, stats.ready, stats.published, stats.failed, stats.processing) == (4, 1, 1, 1, 1)
    assert stats.video_seconds == 90


def test_publications_counts_windows_per_platform():
    old = (NOW - timedelta(days=40)).timestamp()
    ctx = make_ctx(pubs=[
        {"platform": "youtube", "published_at": NOW.timestamp()},
        {"platform": "youtube", "published_at": old},
        {"platform": "tiktok", "published_at": (NOW - timedelta(days=10)).timestamp()},
    ])
    stats = publications.collect(ctx)
    assert (stats.total, stats.last_30_days) == (3, 2)
    yt = next(p for p in stats.by_platform if p.platform == "youtube")
    tt = next(p for p in stats.by_platform if p.platform == "tiktok")
    assert (yt.total, yt.last_7_days, tt.last_7_days) == (2, 1, 0)


def test_public_channel_list_never_exposes_token_fields():
    ctx = make_ctx(accounts=[{"platform": "youtube", "alias": "canal_1", "name": "Mi Canal",
                              "target_id": "UC123", "status": "ok", "expires_in_seconds": 10.5,
                              "has_refresh_token": True, "access_token": "fake-access",
                              "refresh_token": "fake-refresh", "avatar": "https://example.com/private-avatar",
                              "label": "INTERNAL"}])
    public = channels.public_list(ctx)[0].model_dump()
    assert public == {"name": "Mi Canal", "public_url": "https://www.youtube.com/channel/UC123"}
    private = channels.details(ctx)[0].model_dump()
    assert private["alias"] == "canal_1"
    assert private["has_refresh_token"] is True
    assert private["avatar"] == "https://example.com/private-avatar"
    assert not {"alias", "status", "expires_in_seconds", "has_refresh_token"} & set(public)


def test_publish_failed_alert_ignored_when_an_earlier_attempt_succeeded():
    ctx = make_ctx(
        jobs=[job("j1", "packaged")],
        queue=[
            entry(entry_id="ok", status="published", created_at=iso(timedelta(hours=-3))),
            entry(entry_id="dup", status="failed", created_at=iso(timedelta(hours=-2)), error="net"),
            entry(entry_id="tt", platform="tiktok", account_alias="c1", status="failed", error="403"),
        ],
    )
    kinds = [(a.kind, a.platform) for a in alerts.collect(ctx)]
    assert kinds == [("publish_failed", "tiktok")]


def test_reauth_alerts_come_first():
    ctx = make_ctx(
        jobs=[job("s", "video_recorded", updated_at=iso(timedelta(hours=-3)))],
        accounts=[{"platform": "youtube", "alias": "c", "status": "requires_reauth"}],
    )
    result = alerts.collect(ctx)
    assert [a.kind for a in result] == ["reauth", "job_stuck"]


def test_upcoming_only_future_queued_sorted():
    ctx = make_ctx(jobs=[job("j1", "packaged")], queue=[
        entry(entry_id="late", scheduled_at=iso(timedelta(days=2))),
        entry(entry_id="soon", scheduled_at=iso(timedelta(hours=1))),
        entry(entry_id="past", scheduled_at=iso(timedelta(hours=-1))),
        entry(entry_id="done", status="published", scheduled_at=iso(timedelta(hours=3))),
    ])
    assert [u.entry_id for u in upcoming.collect(ctx)] == ["soon", "late"]


@pytest.mark.parametrize("sections", [PUBLIC_SECTIONS, DASHBOARD_SECTIONS])
def test_every_registered_section_runs_on_empty_data(sections):
    ctx = make_ctx()
    for name, collect in sections.items():
        collect(ctx)  # no debe lanzar con el sistema vacío (landing recién instalada)


def test_public_channel_without_name_does_not_fall_back_to_private_alias():
    ctx = make_ctx(accounts=[{"platform": "youtube", "alias": "private-internal-alias", "target_id": "UC123"}])
    assert channels.public_list(ctx)[0].name == "Canal"


def test_tiktok_public_url_uses_known_handle_and_never_oauth_id():
    assert channels.public_url("tiktok", "private-oauth-id", "@mi_canal") == "https://www.tiktok.com/@mi_canal"
    assert channels.public_url("tiktok", "private-oauth-id") is None


@pytest.mark.asyncio
async def test_public_stats_http_response_has_only_name_and_url_per_channel(api_client, monkeypatch):
    from src.core.stats.models import PublicStats
    from src.presentation.api.routers import stats as stats_router

    ctx = make_ctx(accounts=[{"platform": "youtube", "alias": "internal", "name": "Público",
                              "target_id": "UC123", "has_refresh_token": True,
                              "expires_in_seconds": 15, "status": "requires_reauth"}])
    result = PublicStats(**{name: collect(ctx) for name, collect in PUBLIC_SECTIONS.items()})
    monkeypatch.setattr(stats_router, "build_public_stats", lambda loader: result)
    response = await api_client.get("/api/v1/stats/public")
    assert response.status_code == 200
    assert response.json()["channel_list"] == [
        {"name": "Público", "public_url": "https://www.youtube.com/channel/UC123"}
    ]

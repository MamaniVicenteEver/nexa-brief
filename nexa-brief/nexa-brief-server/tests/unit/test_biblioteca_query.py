"""Behavioral contract for paginated library providers; all data is in memory."""
from types import SimpleNamespace
from copy import deepcopy

import pytest

from src.adapters.data.biblioteca_query import StoredLibraryQueries
from src.core.categories import CategoryNode
from src.core.library.biblioteca import BibliotecaService, LibraryPage, LibraryQuery


def job(index, **patch):
    return {"job_id": f"job-{index:04}", "category": "lyrics_neon", "title": f"Video {index:04}",
            "stage": "packaged", "created_at": "2026-11-01T00:00:00Z",
            "updated_at": "2026-11-01T00:00:00Z", "duration_seconds": index, **patch}


def image(index, **patch):
    return {"post_id": f"post-{index}", "publication_id": f"pub-{index}", "revision": 1,
            "created_at": "2026-11-01T00:00:00Z", "updated_at": "2026-11-01T00:00:00Z",
            "editorial": {"category_id": "node_tech", "title": f"Imagen {index}"},
            "technical": {"kind": "image", "composition_plan": {"format": "4:5"},
                          "slides": [{"asset_id": f"asset-{index}", "order": 1}]},
            "status": "ready_for_review", "deliveries": [], **patch}


def adapter(jobs=(), queue=(), images=(), recordings=(), visible=lambda r: True):
    rows = {"jobs": list(jobs), "queue_entries": list(queue), "history_events": []}
    store = SimpleNamespace(collection=lambda key: SimpleNamespace(list=lambda: deepcopy(rows[key])))
    categories = {"node_motion": CategoryNode(display_name="NodeMotion", children={
        "letras": CategoryNode(display_name="Letras", niches=["lyrics_neon", "caution"])}),
        "node_tech": CategoryNode(display_name="NodeTech", folder="nodetech", designs=["design-tech"])}
    return StoredLibraryQueries(store, categories, publication_records=lambda: deepcopy(list(images)),
                                image_visible=visible, recordings=lambda: deepcopy(list(recordings)))


def test_20_per_page_and_search_beyond_the_old_100_limit():
    port = adapter(jobs=[job(i) for i in range(125)])
    first = port.query(LibraryQuery())
    last = port.query(LibraryQuery(page=7))
    assert (len(first.items), first.total, first.page_size) == (20, 125, 20)
    assert len(last.items) == 5
    assert len({item.id for page in range(1, 8) for item in port.query(LibraryQuery(page=page)).items}) == 125
    result = port.query(LibraryQuery(q="Video 0124"))
    assert result.total == 1 and result.items[0].id == "job-0124"


def test_real_categories_aggregate_designs_and_facets_are_before_paging():
    port = adapter(jobs=[job(1), job(2, category="caution"), job(3, category="nodetech"),
                         job(4, category="node_tech/deep-branch"), job(5, category="unknown-design")])
    # Unknown legacy IDs stay visible but do not become invented categories.
    result = port.query(LibraryQuery(category="node_motion"))
    assert result.total == 2
    assert {c.id: c.count for c in result.categories} == {"node_motion": 2, "node_tech": 2, "uncategorized": 1}
    assert all(i.category_label == "NodeMotion" for i in result.items)


def test_publication_status_uses_all_queue_entries_not_a_200_record_window():
    entries = [{"job_id": "other", "status": "published"} for _ in range(220)]
    entries += [{"job_id": "job-0001", "status": "published", "url": "https://example.test/post"}]
    port = adapter(jobs=[job(1), job(2), job(3, stage="pending"), job(4, stage="failed")], queue=entries)
    published = port.query(LibraryQuery(status="published"))
    assert published.total == 1 and published.items[0].payload["published"][0]["url"]
    assert published.status_counts == {"all": 4, "pending": 1, "published": 1, "processing": 1, "failed": 1}
    assert published.has_active_jobs


def test_stable_sort_search_then_category_then_status_and_out_of_range_page():
    port = adapter(jobs=[job(i) for i in range(30)])
    assert port.query(LibraryQuery(sort="longest")).items[0].duration_seconds == 29
    assert port.query(LibraryQuery(q="002", page=99)).page == 1
    assert port.query(LibraryQuery(q="missing")).total == 0
    first = port.query(LibraryQuery(sort="newest"))
    assert [i.id for i in first.items] == [i.id for i in port.query(LibraryQuery(sort="newest")).items]


def test_images_only_latest_revision_and_authorized_counts_no_old_revision_fallback():
    old = image(1)
    hidden_latest = image(1, publication_id="private-revision", revision=2)
    port = adapter(images=[old, hidden_latest, image(2)], visible=lambda r: r["publication_id"] != "private-revision")
    result = port.query(LibraryQuery(media="images"))
    assert result.total == result.unfiltered_total == 1
    assert result.categories[0].count == 1
    assert result.items[0].payload["post_id"] == "post-2"
    assert "technical" not in result.items[0].payload


def test_images_are_paginated_and_filterable_without_browser_cursor_walk():
    port = adapter(images=[image(i) for i in range(43)])
    page = port.query(LibraryQuery(media="images", page=3))
    assert page.total == 43 and len(page.items) == 3
    assert port.query(LibraryQuery(media="images", q="Imagen 42")).total == 1


def test_recordings_and_jobs_share_pagination_and_localizations_are_excluded():
    recording = {"job_id": "record-1", "video_id": "video-1", "state": "rendering",
                 "category_path": "nodetech", "title": "Activa", "started_at": "2026-11-02T00:00:00Z"}
    port = adapter(jobs=[job(i) for i in range(20)] + [job(99, kind="localization")], recordings=[recording])
    result = port.query(LibraryQuery(status="processing"))
    assert result.total == 1 and result.items[0].kind == "recording"
    assert result.status_counts["all"] == 21


def test_service_accepts_an_alternative_query_provider_without_storage_knowledge():
    expected = LibraryPage(items=[], total=0, page=1, unfiltered_total=0, categories=[], status_counts={})
    calls = []
    class Provider:
        def query(self, query):
            calls.append(query)
            return expected
    query = LibraryQuery(q="test", category="node_tech")
    assert BibliotecaService(Provider()).list(query) is expected
    assert calls == [query]


@pytest.mark.parametrize("patch", [{"page": 0}, {"sort": "sql"}, {"media": "other"}, {"status": "bad"}, {"q": "x" * 201}])
def test_query_validation(patch):
    with pytest.raises(ValueError):
        LibraryQuery(**patch)


def test_legacy_times_use_one_history_read_for_the_requested_page_only():
    calls = []
    rows = {"jobs": [job(i) for i in range(45)], "queue_entries": [],
            "history_events": [{"job_id": "job-0020", "stage": "packaged", "created_at": "2026-11-01T00:00:07Z"}]}
    def collection(key):
        def read():
            calls.append(key)
            return rows[key]
        return SimpleNamespace(list=read)
    port = adapter()
    port.store = SimpleNamespace(collection=collection)
    result = port.query(LibraryQuery(page=2))
    assert calls.count("history_events") == 1
    assert result.items[0].payload["job"]["generation_seconds"] == 7


@pytest.mark.asyncio
async def test_api_requires_identity_and_validates_filters(monkeypatch):
    from fastapi import FastAPI
    from httpx import ASGITransport, AsyncClient
    from src.presentation.api.routers import biblioteca
    from src.config.settings import settings
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "nexa_internal_token", "")
    port = adapter(jobs=[job(i) for i in range(25)])
    monkeypatch.setattr(biblioteca, "build_biblioteca_service", lambda **kwargs: BibliotecaService(port))
    app = FastAPI()
    app.include_router(biblioteca.router, prefix="/api/v1")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/api/v1/biblioteca")).status_code == 401
        headers = {"X-Nexa-Session-User": "editor@example.test", "X-Nexa-Session-Role": "editor"}
        response = await client.get("/api/v1/biblioteca?page=2", headers=headers)
        assert response.status_code == 200
        body = response.json()
        assert body["page_size"] == 20 and len(body["items"]) == 5 and body["total"] == 25
        assert (await client.get("/api/v1/biblioteca?page=0", headers=headers)).status_code == 422
        assert (await client.get("/api/v1/biblioteca?sort=invalid", headers=headers)).status_code == 422
        assert (await client.post("/api/v1/biblioteca", headers=headers)).status_code == 405
        monkeypatch.setattr(settings, "nexa_internal_token", "test-internal-token")
        assert (await client.get("/api/v1/biblioteca", headers=headers)).status_code == 403


def test_shared_image_access_enforces_category_and_delivery_account(monkeypatch):
    from fastapi import HTTPException
    from src.presentation.api import image_post_access as access
    monkeypatch.setattr(access, "allowed_categories", lambda identity, data_dir=None: {"node_tech"})
    monkeypatch.setattr(access, "_user_grant", lambda identity, data_dir=None: {"accounts": {"node_tech": ["facebook:permitted"]}})
    identity = access.ImageSession("editor@example.test", "editor")
    record = SimpleNamespace(editorial=SimpleNamespace(category_id="node_tech"),
                             deliveries=[SimpleNamespace(platform="facebook", account_alias="private")])
    with pytest.raises(HTTPException) as denied:
        access.require_publication_access(identity, record)
    assert denied.value.status_code == 403
    record.deliveries[0].account_alias = "permitted"
    access.require_publication_access(identity, record)
    record.editorial.category_id = "node_motion"
    with pytest.raises(HTTPException):
        access.require_publication_access(identity, record)
    access.require_publication_access(access.ImageSession("admin@example.test", "admin"), record)

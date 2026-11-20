from __future__ import annotations
from unittest.mock import AsyncMock, MagicMock
from urllib.parse import urlencode
import httpx
import pytest
from src.core.meta_account_identity import assign_facebook_aliases
from src.adapters.publishing.facebook_adapter import FacebookAdapter, _facebook_post
from src.core.channel_publications import cached_publications, sync_publications
from src.core.data import collection
from src.core.ports.channel_catalog_port import RemoteVideo


def page(id, name="Page"):
    return {"id": id, "name": name, "access_token": "test-token"}


def test_page_aliases_follow_ids_when_meta_reorders_or_inserts_pages():
    existing = [{"alias": "pagina_3", "target_id": "tech"}, {"alias": "nodatech", "target_id": "economy"}]
    rows = assign_facebook_aliases([page("atlas"), page("economy"), page("tech")], existing, "pagina_3")
    assert [(alias, p["id"]) for alias, p in rows] == [
        ("pagina_1", "atlas"),
        ("nodatech", "economy"),
        ("pagina_3", "tech"),
    ]
    assert len({a for a, _ in rows}) == 3


def test_page_aliases_deduplicate_ids_and_ignore_incomplete_grants():
    assert [
        (a, p["id"])
        for a, p in assign_facebook_aliases([page("a"), page("a"), {"id": "missing-token"}, {}], [], "custom")
    ] == [("custom", "a")]


def test_page_aliases_remain_stable_across_repeated_connections():
    initial = assign_facebook_aliases([page("a"), page("b")], [], "pagina_8")
    saved = [{"alias": alias, "target_id": p["id"]} for alias, p in initial]
    assert dict(
        (p["id"], alias) for alias, p in assign_facebook_aliases([page("b"), page("a")], saved, "pagina_9")
    ) == {"a": "pagina_8", "b": "pagina_1"}


def test_photo_and_carousel_keep_the_parent_post_and_real_cover():
    photo = {
        "id": "page_post",
        "message": "La historia\nTexto",
        "created_time": "2026-10-25T13:55:46+0000",
        "attachments": {
            "data": [
                {
                    "media_type": "photo",
                    "target": {"id": "photo-child"},
                    "media": {"image": {"src": "https://img.example/cover.jpg"}},
                }
            ]
        },
    }
    p = _facebook_post(photo)
    assert p["post_id"] == "page_post" and p["kind"] == "photo" and p["image_count"] == 1
    assert p["title"] == "La historia" and p["published_at"] > 0
    assert p["thumbnail_url"] == "https://img.example/cover.jpg"
    photo["attachments"]["data"][0].update(
        media_type="album", subattachments={"data": [{"target": {"id": "child1"}}, {"target": {"id": "child2"}}]}
    )
    p = _facebook_post(photo)
    assert p["post_id"] == "page_post" and p["kind"] == "carousel" and p["image_count"] == 2


@pytest.mark.asyncio
async def test_post_catalog_paginates_and_deduplicates_video_edges():
    tm = MagicMock()
    tm.target_id.return_value = "page"
    adapter = FacebookAdapter(tm)
    adapter._catalog_get_json = AsyncMock(
        return_value={
            "data": [
                {"id": "page_photo", "attachments": {"data": [{"media_type": "photo"}]}},
                {
                    "id": "page_video",
                    "attachments": {"data": [{"media_type": "video", "target": {"id": "video-object"}}]},
                },
            ],
            "paging": {"next": "https://graph.facebook.com/posts?after=x"},
        }
    )
    adapter._catalog_get_next = AsyncMock(return_value={"data": [{"id": "page_text", "message": "Text post"}]})
    adapter.list_channel_videos = AsyncMock(
        return_value=[
            RemoteVideo(
                post_id="video-object",
                url="https://www.facebook.com/reel/video-object",
                title="Reel",
                published_at=2,
                kind="reel",
            )
        ]
    )
    rows = await adapter.list_channel_posts("alias")
    assert {p["post_id"] for p in rows} == {"page_photo", "video-object", "page_text"}
    assert len(rows) == 3 and rows[0]["kind"] == "reel"
    adapter._catalog_get_next.assert_awaited_once()


@pytest.mark.asyncio
async def test_post_cache_uses_page_identity_and_does_not_duplicate_or_keep_removed_posts():
    await collection("channels").insert({"platform": "facebook", "alias": "old", "target_id": "page"})
    fetch = AsyncMock(
        return_value=[
            {
                "post_id": "page_photo",
                "url": "https://www.facebook.com/page_photo",
                "title": "Image",
                "published_at": 10,
                "kind": "photo",
                "image_count": 1,
            }
        ]
    )
    await sync_publications("old", "page", fetch)
    await sync_publications("old", "page", fetch)
    assert len(cached_publications("page", "new-alias")) == 1
    assert cached_publications("page", "new-alias")[0]["alias"] == "new-alias"
    assert cached_publications("other-page", "old") == []
    assert collection("channels").first({"alias": "old"})["publication_count"] == 1
    fetch.return_value = []
    await sync_publications("old", "page", fetch)
    assert cached_publications("page", "old") == []
    assert collection("channel_publications").list()[0]["visible"] is False


@pytest.mark.asyncio
async def test_remote_failure_keeps_last_complete_cache():
    fetch = AsyncMock(
        return_value=[{"post_id": "p", "url": "https://www.facebook.com/p", "title": "Post", "published_at": 1}]
    )
    await sync_publications("alias", "page", fetch)
    fetch.side_effect = RuntimeError("offline")
    with pytest.raises(RuntimeError):
        await sync_publications("alias", "page", fetch)
    assert len(cached_publications("page", "alias")) == 1


@pytest.mark.asyncio
async def test_facebook_callback_reads_all_page_batches_and_preserves_existing_ids(monkeypatch, tmp_path):
    from cryptography.fernet import Fernet
    from starlette.requests import Request
    from src.presentation.api.routers import publisher as router
    from src.adapters.publishing.token_storage import TokenStorage

    key = Fernet.generate_key().decode()
    path = tmp_path / "test-credentials.json"
    for name, value in {
        "facebook_client_id": "test-app",
        "facebook_client_secret": "test-secret",
        "publisher_encryption_key": key,
        "accounts_json_path": path,
        "public_app_url": "https://app.example",
    }.items():
        monkeypatch.setattr(router.settings, name, value)
    store = TokenStorage(path=path, encryption_key=key)
    store.save_tokens("facebook", "pagina_3", access_token="old")
    store.update_channel_profile(
        "facebook",
        "pagina_3",
        name="Tech",
        target_id="tech",
        handle=None,
        description="",
        custom_url=None,
        avatar=None,
        profile_synced_at=1,
    )
    responses = [
        {"access_token": "short"},
        {"access_token": "long"},
        {
            "data": [page("atlas")],
            "paging": {
                "next": "https://graph.facebook.com/me/accounts?" + urlencode({"after": "cursor2"}),
                "cursors": {"after": "cursor2"},
            },
        },
        {"data": [page("tech")]},
    ]
    calls = []

    class FakeClient:
        def __init__(self, **kw):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return None

        async def get(self, url, **kw):
            calls.append((url, kw))
            return httpx.Response(200, json=responses.pop(0), request=httpx.Request("GET", url))

    monkeypatch.setattr(router.httpx, "AsyncClient", FakeClient)
    update = AsyncMock()
    monkeypatch.setattr(router, "_update_channels_json", update)
    request = Request(
        {"type": "http", "method": "GET", "path": "/api/v1/publish/auth/facebook/callback", "headers": []}
    )
    result = await router.facebook_oauth_callback(request, code="test-code", state="pagina_3")
    assert result.status_code == 200
    saved = {a["alias"]: a["target_id"] for a in store.list_accounts()}
    assert saved == {"pagina_3": "tech", "pagina_1": "atlas"}
    assert calls[-1][1]["params"]["after"] == "cursor2"
    assert calls[-1][1]["params"]["limit"] == 100
    assert update.await_count == 2


def test_local_image_receipts_appear_immediately_and_do_not_duplicate_photo_children():
    from src.core.channel_publications import merge_local_publications

    remote = [
        {
            "post_id": "page_parent",
            "remote_object_id": "photo_object",
            "published_at": 10,
            "thumbnail_url": "https://img.example/cover.jpg",
            "origin": "imported",
        }
    ]
    local = [
        {"post_id": "photo_object", "published_at": 10, "origin": "nexa", "title": "Own post"},
        {"post_id": "brand-new", "published_at": 990, "origin": "nexa"},
        {"post_id": "deleted-old", "published_at": 1, "origin": "nexa"},
    ]
    merged = merge_local_publications(remote, local, now=1000)
    assert {p["post_id"] for p in merged} == {"page_parent", "brand-new"}
    parent = next(p for p in merged if p["post_id"] == "page_parent")
    assert parent["origin"] == "nexa" and parent["thumbnail_url"] == "https://img.example/cover.jpg"


@pytest.mark.asyncio
async def test_sync_in_flight_does_not_overwrite_a_different_page_at_the_same_alias():
    await collection("channels").insert(
        {"platform": "facebook", "alias": "old", "target_id": "new-page", "publication_count": 50}
    )
    await sync_publications("old", "old-page", AsyncMock(return_value=[]))
    assert collection("channels").first({"alias": "old"})["publication_count"] == 50

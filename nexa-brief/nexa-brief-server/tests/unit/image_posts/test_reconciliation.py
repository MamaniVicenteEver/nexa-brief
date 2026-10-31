from __future__ import annotations

import asyncio
from datetime import datetime, timezone

import httpx
import pytest

from src.adapters.data.publication_factory import build_publication_components, set_publication_components
from src.adapters.publishing.image_publisher import ImagePublisher
from src.core.image_posts.models import Delivery, DeliveryStatus
from src.core.image_posts.service import ImagePostError
from src.presentation.api.image_post_access import ImageSession
from src.presentation.api.routers import image_posts
from src.presentation.api.schemas.image_posts_schema import ReconcileRequest
from test_repository_api import _record


class Tokens:
    async def get_valid_token(self, _platform: str, _alias: str) -> str:
        return "fake-page-token"

    def target_id(self, _platform: str, _alias: str) -> str:
        return "fake-target"


@pytest.mark.asyncio
@pytest.mark.parametrize("platform,remote,path,answer", [
    ("facebook", {"post_id": "fb-post"}, "/fb-post",
     {"id": "fb-post", "permalink_url": "https://facebook.test/post"}),
    ("instagram", {"parent_container_id": "ig-parent"}, "/ig-parent",
     {"id": "ig-parent", "status_code": "PUBLISHED", "media_id": "ig-media",
      "permalink": "https://instagram.test/post"}),
])
async def test_reconcile_with_graph_never_resends(tmp_path, platform, remote, path, answer):
    requests = []

    def graph(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path))
        assert request.method == "GET" and request.url.path.endswith(path)
        return httpx.Response(200, json=answer)

    publisher = ImagePublisher(
        Tokens(), object(),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(graph), **kwargs),
    )
    components = build_publication_components(data_dir=tmp_path, publisher=publisher)
    delivery = Delivery(
        delivery_id="uncertain", revision=1, platform=platform, account_alias="test",
        target_id="fake-target", placement="image", idempotency_key="idempotent",
        status=DeliveryStatus.OUTCOME_UNKNOWN, remote=remote,
        created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))
    set_publication_components(components)
    try:
        if platform == "facebook":
            result = await image_posts.reconcile_delivery(
                delivery.delivery_id, ReconcileRequest(),
                identity=ImageSession(email="admin@example.org", role="admin"),
            )
            status = result["status"]
        else:
            assert await components.service.reconcile_due_deliveries() == 1
            result = components.repository.get("pub_test").deliveries[0].model_dump(mode="json")
            status = result["status"]
        # These archived deliveries have no complete expected caption, date, or media proof.
        assert status == "outcome_unknown"
        assert requests and all(method == "GET" for method, _path in requests)
    finally:
        set_publication_components(None)


@pytest.mark.asyncio
async def test_unknown_without_remote_id_has_backoff_and_manual_retry(tmp_path):
    calls = []

    def graph(request: httpx.Request) -> httpx.Response:
        calls.append(request)
        raise AssertionError("Sin ID remoto no debe consultar ni publicar")

    publisher = ImagePublisher(
        Tokens(), object(),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(graph), **kwargs),
    )
    components = build_publication_components(data_dir=tmp_path, publisher=publisher)
    delivery = Delivery(
        delivery_id="uncertain", revision=1, platform="facebook", account_alias="test",
        target_id="fake-target", placement="image", idempotency_key="idempotent",
        status=DeliveryStatus.OUTCOME_UNKNOWN,
        created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))
    assert await components.service.reconcile_due_deliveries() == 1
    first = components.repository.get("pub_test").deliveries[0]
    assert first.status == DeliveryStatus.OUTCOME_UNKNOWN
    assert first.next_attempt_at > datetime.now(timezone.utc)
    assert await components.service.reconcile_due_deliveries() == 0
    assert (await components.service.reconcile_delivery("uncertain", manual=True)).attempt_count == 2
    assert calls == []
    with pytest.raises(ImagePostError, match="OUTCOME_UNKNOWN"):
        await components.service.publish_delivery("uncertain")


@pytest.mark.asyncio
async def test_manual_remote_id_is_verified_before_resolving(tmp_path):
    requests = []

    def graph(request: httpx.Request) -> httpx.Response:
        requests.append((request.method, request.url.path))
        if request.url.path.endswith("/wrong_id"):
            return httpx.Response(404, json={"error": {"code": 100, "error_subcode": 33}})
        return httpx.Response(200, json={"id": "real_id", "permalink_url": "https://facebook.test/real"})

    publisher = ImagePublisher(
        Tokens(), object(),
        client_factory=lambda **kwargs: httpx.AsyncClient(transport=httpx.MockTransport(graph), **kwargs),
    )
    components = build_publication_components(data_dir=tmp_path, publisher=publisher)
    delivery = Delivery(
        delivery_id="uncertain", revision=1, platform="facebook", account_alias="test",
        target_id="fake-target", placement="image", idempotency_key="same",
        status=DeliveryStatus.OUTCOME_UNKNOWN,
        created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))
    wrong = await components.service.reconcile_delivery("uncertain", manual=True, remote_post_id="wrong_id")
    assert wrong.status == DeliveryStatus.OUTCOME_UNKNOWN
    assert wrong.remote.post_id is None
    good = await components.service.reconcile_delivery("uncertain", manual=True, remote_post_id="real_id")
    assert good.status == DeliveryStatus.OUTCOME_UNKNOWN
    assert good.remote.post_id is None
    assert len(requests) == 2
    assert requests[0][0] == requests[1][0] == "GET"
    assert requests[0][1].endswith("/wrong_id")
    assert requests[1][1].endswith("/real_id")


@pytest.mark.asyncio
async def test_concurrent_claim_allows_only_one_meta_post(tmp_path):
    calls = 0

    class Publisher:
        async def publish_image_delivery(self, _spec):
            nonlocal calls
            calls += 1
            await asyncio.sleep(0)
            return {"post_id": "remote-one", "permalink": "https://facebook.test/one"}

    components = build_publication_components(data_dir=tmp_path, publisher=Publisher())
    delivery = Delivery(
        delivery_id="queued", revision=1, platform="facebook", account_alias="test",
        target_id="fake-target", placement="image", idempotency_key="same",
        status=DeliveryStatus.QUEUED,
        created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    await components.repository.create(_record().model_copy(update={"deliveries": [delivery]}))
    results = await asyncio.gather(
        components.service.publish_delivery("queued"),
        components.service.publish_delivery("queued"),
        return_exceptions=True,
    )
    assert calls == 1
    assert any(isinstance(result, ImagePostError) and result.code == "ALREADY_SENT" for result in results)
    assert components.repository.get("pub_test").deliveries[0].status == DeliveryStatus.PUBLISHED

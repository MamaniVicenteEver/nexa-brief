"""Contrato de borrado remoto sin pérdida del archivo local."""

from types import SimpleNamespace

import httpx
import pytest

from src.adapters.publishing.image_publisher import ImagePublisher


class Tokens:
    async def get_valid_token(self, platform: str, alias: str) -> str:
        assert alias in {"pagina_3", "instagram_2"}
        return f"token-{platform}"


def delivery(platform: str, status: str = "published") -> SimpleNamespace:
    return SimpleNamespace(
        platform=platform,
        account_alias="pagina_3" if platform == "facebook" else "instagram_2",
        status=status,
        target_id="123" if platform == "facebook" else "17899999999999999",
        remote=SimpleNamespace(post_id="123_456" if platform == "facebook" else "18387597508237716"),
    )


@pytest.mark.asyncio
async def test_facebook_delete_success() -> None:
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"success": True})

    publisher = ImagePublisher(Tokens(), None, client_factory=lambda **kw: httpx.AsyncClient(
        transport=httpx.MockTransport(handler), **kw
    ))
    result = await publisher.remove_remote_delivery(delivery("facebook"))
    assert result == {"status": "removed", "graph_response": {"delete": {"success": True}}}
    assert len(requests) == 1
    assert requests[0].method == "DELETE"
    assert requests[0].url.path.endswith("/123_456")


@pytest.mark.asyncio
async def test_instagram_delete_rejected_then_verified_gone() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if request.method == "DELETE":
            return httpx.Response(400, json={"error": {
                "message": "Unsupported delete request", "code": 100, "fbtrace_id": "trace-1"
            }})
        if request.url.path.endswith("/media"):
            return httpx.Response(200, json={"data": []})
        return httpx.Response(400, json={"error": {
            "message": "Object does not exist", "code": 100, "error_subcode": 33,
        }})

    publisher = ImagePublisher(Tokens(), None, client_factory=lambda **kw: httpx.AsyncClient(
        transport=httpx.MockTransport(handler), **kw
    ))
    rejected = await publisher.remove_remote_delivery(delivery("instagram"))
    assert rejected["status"] == "removal_pending_manual"
    assert "Instagram" in rejected["instruction"]
    assert rejected["graph_response"]["delete"]["message"] == "Unsupported delete request"
    verified = await publisher.remove_remote_delivery(delivery("instagram", "removal_pending_manual"))
    assert verified["status"] == "removed"
    assert calls == 3


@pytest.mark.asyncio
async def test_instagram_delete_success() -> None:
    publisher = ImagePublisher(Tokens(), None, client_factory=lambda **kw: httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(200, json={"success": True})),
        **kw
    ))
    assert (await publisher.remove_remote_delivery(delivery("instagram")))["status"] == "removed"

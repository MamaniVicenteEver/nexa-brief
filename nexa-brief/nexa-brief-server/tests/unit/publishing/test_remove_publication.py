"""Contrato de borrado remoto sin pérdida del archivo local."""

from types import SimpleNamespace

import httpx
import pytest
from cryptography.fernet import Fernet

from src.adapters.publishing.image_publisher import ImagePublisher
from src.adapters.publishing.token_storage import TokenStorage
from src.config.exceptions import TokenError


class Tokens:
    def __init__(self, deletion_token: str | None = "user-token") -> None:
        self.deletion_token = deletion_token

    async def get_valid_token(self, platform: str, alias: str) -> str:
        assert alias in {"pagina_3", "instagram_2"}
        return f"token-{platform}"

    def instagram_deletion_token(self, alias: str) -> str | None:
        assert alias == "instagram_2"
        return self.deletion_token


def test_instagram_user_token_is_separate_and_expires(tmp_path, monkeypatch) -> None:
    import src.adapters.publishing.token_storage as token_storage

    clock = 1_000_000.0
    monkeypatch.setattr(token_storage.time, "time", lambda: clock)
    storage = TokenStorage(tmp_path / "accounts.json", Fernet.generate_key().decode())
    storage.save_tokens("instagram", "instagram_2", access_token="page-token")
    storage.save_instagram_deletion_token("instagram_2", "user-token", 60)
    assert storage.get_instagram_deletion_token("instagram_2") == "user-token"
    assert storage.decrypt(storage.get_state("instagram", "instagram_2").encrypted_access_token) == "page-token"
    monkeypatch.setattr(token_storage.time, "time", lambda: clock + 61)
    assert storage.get_instagram_deletion_token("instagram_2") is None


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
async def test_instagram_needs_user_token_before_delete() -> None:
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"success": True})

    publisher = ImagePublisher(Tokens(None), None, client_factory=lambda **kw: httpx.AsyncClient(
        transport=httpx.MockTransport(handler), **kw
    ))
    result = await publisher.remove_remote_delivery(delivery("instagram"))
    assert result["status"] == "removal_pending_manual"
    assert result["graph_response"]["delete"]["code"] == "RECONNECT_REQUIRED"
    assert requests == []


@pytest.mark.asyncio
async def test_missing_account_token_preserves_pending_state() -> None:
    class MissingTokens(Tokens):
        async def get_valid_token(self, platform: str, alias: str) -> str:
            raise TokenError("expired secret")

    publisher = ImagePublisher(MissingTokens(), None)
    result = await publisher.remove_remote_delivery(delivery("instagram"))
    assert result["status"] == "removal_pending_manual"
    assert result["graph_response"]["delete"]["code"] == "ACCOUNT_RECONNECT_REQUIRED"


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
    requests = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(200, json={"success": True})

    publisher = ImagePublisher(Tokens(), None, client_factory=lambda **kw: httpx.AsyncClient(
        transport=httpx.MockTransport(handler),
        **kw
    ))
    assert (await publisher.remove_remote_delivery(delivery("instagram")))["status"] == "removed"
    assert requests[0].url.params["access_token"] == "user-token"


@pytest.mark.asyncio
async def test_verification_never_deletes_but_explicit_retry_does() -> None:
    methods = []

    def handler(request: httpx.Request) -> httpx.Response:
        methods.append(request.method)
        return httpx.Response(200, json={"id": "18387597508237716"} if request.method == "GET" else {"success": True})

    publisher = ImagePublisher(Tokens(), None, client_factory=lambda **kw: httpx.AsyncClient(
        transport=httpx.MockTransport(handler), **kw
    ))
    pending = delivery("instagram", "removal_pending_manual")
    checked = await publisher.remove_remote_delivery(pending)
    assert checked["status"] == "removal_pending_manual"
    assert methods == ["GET"]
    retried = await publisher.remove_remote_delivery(pending, retry_api=True)
    assert retried["status"] == "removed"
    assert methods == ["GET", "DELETE"]

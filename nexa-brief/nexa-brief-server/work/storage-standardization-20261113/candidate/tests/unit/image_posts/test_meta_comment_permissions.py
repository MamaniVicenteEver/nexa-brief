from types import SimpleNamespace
from unittest.mock import AsyncMock
import logging

import httpx
import pytest

from src.adapters.publishing.meta_comment_permissions import MetaCommentPermissionVerifier


@pytest.mark.asyncio
@pytest.mark.parametrize("platform,data,expected", [
    ("instagram", {"is_valid": True, "app_id": "app", "scopes": ["instagram_manage_comments"]}, True),
    ("facebook", {"is_valid": True, "app_id": "app", "scopes": ["pages_manage_engagement"]}, True),
    ("facebook", {"is_valid": True, "app_id": "app", "scopes": []}, False),
    ("instagram", {"is_valid": False, "app_id": "app", "scopes": ["instagram_manage_comments"]}, False),
    ("instagram", {"is_valid": True, "app_id": "another", "scopes": ["instagram_manage_comments"]}, False),
])
async def test_grants_are_checked_against_meta_not_local_flags(platform, data, expected, caplog):
    calls = []
    def handle(request):
        calls.append(request)
        return httpx.Response(200, json={"data": data})
    manager = SimpleNamespace(get_valid_token=AsyncMock(return_value="fixture-credential"))
    verifier = MetaCommentPermissionVerifier(manager, client_factory=lambda **kw: httpx.AsyncClient(transport=httpx.MockTransport(handle), **kw), app_id="app", app_secret="app-secret")
    with caplog.at_level(logging.INFO, logger="httpx"):
        assert await verifier.can_comment(platform, "channel") is expected
        assert await verifier.can_comment(platform, "channel") is expected
    assert len(calls) == 1
    assert "fixture-credential" not in caplog.text
    assert "app-secret" not in caplog.text


@pytest.mark.asyncio
async def test_unavailable_verification_does_not_invent_a_permission():
    verifier = MetaCommentPermissionVerifier(
        SimpleNamespace(get_valid_token=AsyncMock(return_value="fixture-credential")),
        client_factory=lambda **kw: httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(503)), **kw),
        app_id="app", app_secret="app-secret")
    assert await verifier.can_comment("facebook", "channel") is None

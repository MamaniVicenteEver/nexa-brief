from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient

from src.config.exceptions import UnsupportedOperationError, VideoNotFoundError
from src.presentation.main import app

client = TestClient(app)


def test_sync_endpoint_returns_404_when_account_is_missing():
    with patch("src.presentation.api.routers.publisher.get_publisher_facade") as get_facade:
        facade = MagicMock()
        facade.sync_channel = AsyncMock(side_effect=VideoNotFoundError("No account found."))
        get_facade.return_value = facade

        response = client.post("/api/v1/publish/accounts/facebook/missing/sync")

    assert response.status_code == 404


def test_sync_endpoint_returns_422_when_platform_has_no_catalog():
    with patch("src.presentation.api.routers.publisher.get_publisher_facade") as get_facade:
        facade = MagicMock()
        facade.sync_channel = AsyncMock(side_effect=UnsupportedOperationError("No catalog."))
        get_facade.return_value = facade

        response = client.post("/api/v1/publish/accounts/tiktok/cuenta_1/sync")

    assert response.status_code == 422

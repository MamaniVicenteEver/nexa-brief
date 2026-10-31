"""Aísla TODA la persistencia de los tests en un directorio temporal.

Toda la persistencia pasa por el DataStore, que resuelve sus rutas desde
`settings.data_dir` en cada operación — redirigirlo alcanza para que ningún
test toque el `data/` real (antes, test_publisher_router y
test_social_publisher_module escribían en data/canales/published_videos.json).
"""

from __future__ import annotations

from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient

from src.presentation.main import app
from src.config.settings import settings


@pytest.fixture(autouse=True)
def _isolated_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data_dir = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data_dir)
    # Internal API authentication is disabled by default in tests; security
    # tests opt into production mode and provide explicit tokens.
    monkeypatch.setattr(settings, "app_env", "test")
    monkeypatch.setattr(settings, "nexa_internal_token", "")
    return data_dir


@pytest.fixture
async def api_client():
    """Cliente ASGI asíncrono, compatible con la versión actual de httpx."""
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

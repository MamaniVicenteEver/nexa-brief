"""Aísla TODA la persistencia de los tests en un directorio temporal.

Toda la persistencia pasa por el DataStore, que resuelve sus rutas desde
`settings.data_dir` en cada operación — redirigirlo alcanza para que ningún
test toque el `data/` real (antes, test_publisher_router y
test_social_publisher_module escribían en data/canales/published_videos.json).
"""

from __future__ import annotations

from pathlib import Path

import pytest

from src.config.settings import settings


@pytest.fixture(autouse=True)
def _isolated_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    data_dir = tmp_path / "data"
    monkeypatch.setattr(settings, "data_dir", data_dir)
    return data_dir

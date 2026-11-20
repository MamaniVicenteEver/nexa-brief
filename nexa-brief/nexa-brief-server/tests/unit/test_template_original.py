"""«Video original»: qué fondo propio toma de cada plantilla para grabarla tal cual."""

from __future__ import annotations

import json
from pathlib import Path

from src.core.template_original import _config, background_file


def _assets(tmp_path: Path, config: dict, files: list[str]) -> Path:
    assets = tmp_path / "assets"
    assets.mkdir()
    (assets / "config.json").write_text(json.dumps({"configs": [config]}))
    for name in files:
        (assets / name).write_bytes(b"x")
    return assets


def test_image_named_in_config(tmp_path: Path):
    assets = _assets(tmp_path, {"bg": {"src": "assets/bg.jpg"}}, ["bg.jpg", "card-poster.webp", "song.mp3"])
    assert background_file(assets, _config(assets), "image") == (assets / "bg.jpg").resolve()


def test_video_named_but_image_needed_uses_its_twin(tmp_path: Path):
    # lyrics-neon: el config nombra remix.mp4, el nicho graba con imagen → remix.jpg
    assets = _assets(tmp_path, {"bg": {"src": "assets/remix.mp4"}}, ["remix.mp4", "remix.jpg", "card-poster.webp"])
    assert background_file(assets, _config(assets), "image") == (assets / "remix.jpg").resolve()
    assert background_file(assets, _config(assets), "video") == (assets / "remix.mp4").resolve()


def test_falls_back_to_first_file_and_skips_the_card_poster(tmp_path: Path):
    assets = _assets(tmp_path, {"audio": {"src": "assets/song.mp3"}}, ["card-poster.webp", "fondo.png"])
    assert background_file(assets, _config(assets), "image") == assets / "fondo.png"
    assert background_file(assets, _config(assets), "video") is None

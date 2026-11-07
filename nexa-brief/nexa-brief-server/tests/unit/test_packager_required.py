"""Archivos que exige el empaquetado: el fondo solo si la plantilla lo pide."""

from src.config.niche_config import get_niche_config
from src.modules.packager import _required_files


def test_background_required_only_when_template_uses_one():
    suave = _required_files(get_niche_config("lyrics_video_suave"))      # fondo: imagen
    calado = _required_files(get_niche_config("lyrics_video_calado"))    # fondo: video
    caution = _required_files(get_niche_config("lyrics_video_caution"))  # sin fondo propio
    assert "bg.jpg" in suave
    assert "bg.mp4" in calado
    assert "bg.jpg" not in caution and "bg.mp4" not in caution
    assert {"index.html", "song.mp3", "config.json", "lyrics.json"} <= set(caution)

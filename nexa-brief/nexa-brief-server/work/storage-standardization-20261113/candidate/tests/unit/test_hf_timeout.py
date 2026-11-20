"""El límite de un render de HyperFrames crece con la duración del video."""

from src.adapters.recorder.infrastructure.hyperframes_adapter import render_timeout_seconds
from src.config.settings import settings


def test_short_videos_keep_the_base_limit():
    assert render_timeout_seconds(None) == settings.hyperframes_render_timeout_seconds
    assert render_timeout_seconds(60) == settings.hyperframes_render_timeout_seconds


def test_long_songs_get_more_time():
    # Neón 4:16 se cortaba a los 30 min con ~80 % capturado
    assert render_timeout_seconds(256) == int(256 * settings.hyperframes_timeout_seconds_per_video_second)
    assert render_timeout_seconds(256) > 1800

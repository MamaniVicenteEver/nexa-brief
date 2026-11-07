"""La API y el servidor local deben rechazar enlaces a contenido privado."""
import importlib.util
from pathlib import Path

import pytest
from fastapi import HTTPException
from starlette.requests import Request

from src.config.settings import settings
from src.presentation.api.routers.explainer import get_explainer_file


@pytest.mark.asyncio
@pytest.mark.parametrize('layout_version', [2, 3])
async def test_symlink_cannot_expose_private_files_in_api_or_local_server(tmp_path, monkeypatch, layout_version):
    root = tmp_path / 'profile'
    templates = tmp_path / 'templates'
    root.mkdir()
    templates.mkdir()
    monkeypatch.setattr(settings, 'storage_profile_dir', root)
    monkeypatch.setattr(settings, 'storage_layout_version', layout_version)
    monkeypatch.setattr(settings, 'templates_dir', templates)
    video = root / 'productions/nodetech/video'
    (video / 'assets').mkdir(parents=True)
    (video / 'work').mkdir()
    (video / 'work/private.txt').write_text('synthetic private text')
    (video / 'assets/public.txt').symlink_to(video / 'work/private.txt')
    key = 'productions/nodetech/video/assets/public.txt'
    request = Request({'type': 'http', 'method': 'GET', 'path': '/', 'headers': []})
    with pytest.raises(HTTPException) as exc:
        await get_explainer_file(key, request)
    assert exc.value.status_code == 404
    source = Path(__file__).resolve().parents[2] / 'src/templates/_tools/http_media.py'
    spec = importlib.util.spec_from_file_location('http_media_for_security_test', source)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    handler = object.__new__(module.ProfileContentMixin)
    assert handler.translate_path('/' + key) == str(templates / '.not-found')

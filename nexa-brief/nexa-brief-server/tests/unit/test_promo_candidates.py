"""Consulta de candidatos simulada: sin red ni descargas."""
import asyncio
import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

BASE = Path(__file__).resolve().parents[2]
TOOLS = BASE / 'src/templates/_tools/nodemotion/promo/tools'
sys.path.insert(0, str(TOOLS))
spec = importlib.util.spec_from_file_location('promo_candidates_media_test', TOOLS / 'media.py')
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)
spec = importlib.util.spec_from_file_location('promo_candidates_cli_test', TOOLS / 'promo.py')
promo = importlib.util.module_from_spec(spec)
spec.loader.exec_module(promo)


def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value), encoding='utf-8')


def test_candidates_persist_metadata_and_log_without_download(tmp_path, monkeypatch):
    item = SimpleNamespace(provider_id='123', title='Puerto', description='Valparaíso',
        source_url='https://example.org/file', download_url='https://example.org/photo',
        author='Autor', license='CC BY 2.0', license_url='https://example.org/license',
        width=2000, height=1000, duration_seconds=None)
    class Provider:
        configured = True
        kinds = {'image'}
        async def search(self, query, kind, **kwargs):
            assert (query, kind, kwargs) == ('Puerto Valparaiso', 'image', {'orientation':'landscape','per_page':50})
            return [item]
    monkeypatch.setattr(media, 'build_providers', lambda: {'wikimedia': Provider()})
    async def forbidden(*args, **kwargs):
        raise AssertionError('no se debe descargar ni registrar')
    monkeypatch.setattr(media, 'download', forbidden)
    monkeypatch.setattr(media, 'register', forbidden)
    result = asyncio.run(media.candidates(tmp_path, tmp_path/'project', 'p', 'wikimedia',
        'Puerto Valparaiso', 'image', 'landscape', None, write))
    assert result['candidates'][0]['provider_id'] == '123'
    assert result['candidates'][0]['license'] == 'CC BY 2.0'
    files = list((tmp_path/'project/work/media/candidates').glob('*.json'))
    assert len(files) == 1 and json.loads(files[0].read_text()) == result
    logs = [json.loads(line) for line in (tmp_path/'project/logs/usage.jsonl').read_text().splitlines()]
    assert len(logs) == 1 and logs[0]['step'] == 'candidate-search' and logs[0]['ok']
    assert not (tmp_path/'resources').exists()


def test_failure_logged_once(tmp_path, monkeypatch):
    monkeypatch.setattr(media, 'build_providers', lambda: {})
    with pytest.raises(ValueError):
        asyncio.run(media.candidates(tmp_path, tmp_path/'project', 'p', 'missing',
            'x', 'image', 'landscape', None, write))
    logs = [json.loads(line) for line in (tmp_path/'project/logs/usage.jsonl').read_text().splitlines()]
    assert len(logs) == 1 and not logs[0]['ok']


def test_select_media_propagates_id_and_supports_old_args(tmp_path, monkeypatch):
    path = tmp_path/'media-plan.json'
    write(path, {'items':[{'scene':1, 'slot':'city', 'kind':'image', 'query':'old', 'asset_id':'old'},
                          {'scene':2, 'slot':'city', 'kind':'image', 'query':'old', 'asset_id':'old'}]})
    monkeypatch.setattr(promo, 'project', lambda _: tmp_path)
    monkeypatch.setattr(promo, 'validate_schema', lambda *_: None)
    promo.select_media(SimpleNamespace(id='p',slot='city',query='Puerto',provider='wikimedia',provider_id='123',require_term=['Valparaiso']))
    items = json.loads(path.read_text())['items']
    assert all(item['provider_id'] == '123' and item['provider'] == 'wikimedia' and 'asset_id' not in item for item in items)
    promo.select_media(SimpleNamespace(id='p',slot='city',query='Otra'))
    assert all('provider_id' not in item and item['query'] == 'Otra' for item in json.loads(path.read_text())['items'])


def test_slow_download_is_cancelled_and_failure_logged(tmp_path, monkeypatch):
    cancelled = []
    async def slow_download(url, path):
        try:
            await asyncio.sleep(10)
        finally:
            cancelled.append(True)
    monkeypatch.setattr(media.lib, 'download_url_to', slow_download)
    monkeypatch.setattr(media, 'DOWNLOAD_TIMEOUT_SECONDS', .01)
    with pytest.raises(asyncio.TimeoutError):
        asyncio.run(media.download(tmp_path, 'pexels', 'https://example.org/video', tmp_path/'video.mp4'))
    rows = [json.loads(line) for line in (tmp_path/'logs/usage.jsonl').read_text().splitlines()]
    assert cancelled == [True] and len(rows) == 1
    assert rows[0]['step'] == 'download' and rows[0]['ok'] is False
    assert rows[0]['input_tokens'] is None


def test_manual_media_selection_uses_exact_id_without_ai_terms(tmp_path, monkeypatch):
    target = tmp_path / "project"
    write(target / "media-plan.json", {"items": [
        {"scene": 1, "slot": "hero", "kind": "image", "query": "manual-selection-id",
         "asset_id": "selected-image", "orientation": "landscape", "manual_selection": True}
    ]})
    seen = []

    def find(root, kind, **kwargs):
        seen.append((root, kind, kwargs))
        return (target / "resource.json", {"id": kwargs["ident"], "used_by": [], "orientation": "landscape"})

    monkeypatch.setattr(media, "find", find)
    monkeypatch.setattr(media, "use", lambda found, project_id, write_json: found[1])
    monkeypatch.setattr(media, "timeline", lambda *_: {"segments": [{"id": 1, "start": 0, "end": 2}]})

    result = asyncio.run(media.fetch(
        tmp_path, target, "a" * 32 + "-r1",
        lambda path: json.loads(path.read_text(encoding="utf-8")), write,
        lambda *_: None,
    ))

    plan = json.loads((target / "media-plan.json").read_text(encoding="utf-8"))
    assert result == 0
    assert seen[0][1] == "image"
    assert seen[0][2]["ident"] == "selected-image" and seen[0][2]["required_terms"] is None
    assert plan["items"][0]["asset_id"] == "selected-image"


def test_manual_media_selection_fails_closed_when_selected_id_disappears(tmp_path, monkeypatch):
    target = tmp_path / "project"
    write(target / "media-plan.json", {"items": [
        {"scene": 1, "slot": "hero", "kind": "image", "query": "manual-selection-id",
         "asset_id": "selected-image", "orientation": "landscape", "manual_selection": True}
    ]})
    seen = []

    def find(root, kind, **kwargs):
        seen.append((kind, kwargs))
        return None

    def forbidden(*args, **kwargs):
        raise AssertionError("una selección directa no debe buscar medios alternativos")

    monkeypatch.setattr(media, "find", find)
    monkeypatch.setattr(media, "build_providers", forbidden)
    monkeypatch.setattr(media, "timeline", lambda *_: {"segments": [{"id": 1, "start": 0, "end": 2}]})

    result = asyncio.run(media.fetch(
        tmp_path, target, "a" * 32 + "-r1",
        lambda path: json.loads(path.read_text(encoding="utf-8")), write,
        lambda *_: None,
    ))

    plan = json.loads((target / "media-plan.json").read_text(encoding="utf-8"))
    assert result == 1
    assert seen == [("image", {"ident": "selected-image", "required_terms": None})]
    assert "asset_id" not in plan["items"][0]

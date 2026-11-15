import asyncio
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest

@pytest.fixture
def mod():
    path = Path(__file__).parents[3] / 'src/core/nodemotion/promo/evidence.py'
    spec = importlib.util.spec_from_file_location('promo_evidence_test', path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_dns_validates_all_addresses_and_pins(mod, monkeypatch):
    async def run():
        loop = asyncio.get_running_loop()
        async def lookup(host, port, **kwargs):
            return [(0, 0, 0, '', ('93.184.216.34', port)), (0, 0, 0, '', ('127.0.0.1', port))]
        monkeypatch.setattr(loop, 'getaddrinfo', lookup)
        with pytest.raises(mod.EvidenceError):
            await mod._resolve('https://example.org/a')
        async def safe_lookup(host, port, **kwargs):
            return [(0, 0, 0, '', ('93.184.216.34', port))]
        monkeypatch.setattr(loop, 'getaddrinfo', safe_lookup)
        assert await mod._resolve('https://example.org/a') == ('https://93.184.216.34/a', 'example.org')
        for value in ['http://127.0.0.1/', 'https://u:p@example.org/', 'https://example.org:444/', 'http://169.254.169.254/']:
            with pytest.raises(mod.EvidenceError):
                await mod._resolve(value)
    asyncio.run(run())


def test_html_extraction(mod):
    title, text = asyncio.run(mod._extract(b'<html><title>Title</title><p>Hi <b>reef</b></p><script>bad</script></html>', 'text/html'))
    assert title == 'Title' and text == 'Hi reef'


def test_pdf_extraction(mod):
    fitz = pytest.importorskip('fitz')
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), 'Coral reef evidence')
    payload = doc.tobytes()
    doc.close()
    _, text = asyncio.run(mod._extract(payload, 'application/pdf'))
    assert 'Coral reef evidence' in text


def test_redirect_validates_destination_and_stream_limit(mod, monkeypatch):
    requests = []
    class Response:
        def __init__(self, status, headers, body=b''):
            self.status_code, self.headers, self.body = status, headers, body
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def aiter_bytes(self): yield self.body
    class Client:
        def __init__(self, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        def stream(self, method, url, **kwargs):
            requests.append((url, kwargs))
            return Response(302, {'location': 'http://127.0.0.1/private'})
    async def resolve(url):
        if '127.0.0.1' in url: raise mod.EvidenceError('Destino no público')
        return 'https://93.184.216.34/', 'example.org'
    monkeypatch.setattr(mod.httpx, 'AsyncClient', Client)
    monkeypatch.setattr(mod, '_resolve', resolve)
    with pytest.raises(mod.EvidenceError, match='Destino no público'):
        asyncio.run(mod._fetch('https://example.org/'))
    assert requests[0][1]['extensions']['sni_hostname'] == 'example.org'
    assert requests[0][1]['headers']['Host'] == 'example.org'
    class Large(Client):
        def stream(self, *args, **kwargs): return Response(200, {'content-type': 'text/html'}, b'x' * (mod.MAX_BYTES + 1))
    monkeypatch.setattr(mod.httpx, 'AsyncClient', Large)
    with pytest.raises(mod.EvidenceError, match='tamaño'):
        asyncio.run(mod._fetch('https://example.org/'))


def test_gather_retains_sanitized_errors_and_metrics(mod, monkeypatch, tmp_path):
    active = 0
    maximum = 0
    async def fetch(url):
        nonlocal active, maximum
        active += 1
        maximum = max(active, maximum)
        await asyncio.sleep(0.01)
        active -= 1
        if 'bad' in url: raise RuntimeError('secret token')
        return {'url':url, 'title':'A', 'text':'B', 'accessed_at':'now', 'sha256':'a'}
    events = []
    async def progress(stage, data): events.append(data['usage'])
    monkeypatch.setattr(mod, '_fetch', fetch)
    docs = asyncio.run(mod.gather_evidence(['https://example.org/good', 'https://bad.example/a?token=secret', 'https://example.org/other'], tmp_path, progress))
    saved = json.loads((tmp_path / 'work/research/evidence.json').read_text())
    assert len(docs) == 2 and maximum == 2 and not saved['validated']
    assert saved['errors'] == [{'url':'https://bad.example/…', 'error':'No se pudo descargar el documento'}]
    assert len(events) == 3 and all(row['total_tokens'] is None for row in events)
    assert mod.public_urls_from_proposal({'sources': ['ver https://example.org/a.', {'url': 'https://example.org/b'}]}) == ['https://example.org/a', 'https://example.org/b']
    assert mod.public_urls_from_text('Lee https://example.org/wiki/Coral_(animal).') == ['https://example.org/wiki/Coral_(animal)']


def test_pdf_fallback_without_pdftotext(mod, monkeypatch):
    fitz = pytest.importorskip('fitz')
    pytest.importorskip('pypdf')
    pdf = fitz.open()
    page = pdf.new_page()
    page.insert_text((72, 72), 'Evidence from coral reef')
    body = pdf.tobytes()
    pdf.close()
    monkeypatch.setattr(mod.shutil, 'which', lambda _: None)
    title, text = asyncio.run(mod._extract(body, 'application/pdf'))
    assert title == '' and 'Evidence from coral reef' in text

import json
import threading
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
from urllib.error import HTTPError
from unittest.mock import patch

import pytest
from src.adapters.maps.cache import TileCache, lonlat_to_tile, tile_to_lonlat
from src.adapters.maps.licensing import LicenseBlocked
from src.adapters.maps.providers import load_providers
from src.adapters.maps.vector import extract, latest_build


def test_registry_and_tile_urls():
    providers = load_providers()
    assert len(providers) == 8
    assert providers['gibs-bluemarble'].tile_url(3, 2, 4).endswith('/3/4/2.jpeg')
    assert providers['terrain-aws'].tile_url(3, 2, 4).endswith('/3/2/4.png')
    assert all(p.attribution and p.license and not p.requires_key for p in providers.values())
    with pytest.raises(ValueError): providers['terrain-aws'].tile_url(3, 8, 0)
    with pytest.raises(ValueError): providers['protomaps-pmtiles'].tile_url(0, 0, 0)


def test_license_enforced_even_if_cached(tmp_path):
    p = load_providers()['esri-world-imagery']
    cache = TileCache(tmp_path)
    cache.put(p, 0, 0, 0, b'image')
    with pytest.raises(LicenseBlocked): cache.get_or_fetch(p, 0, 0, 0)
    assert cache.get_or_fetch(p, 0, 0, 0, allow_noncommercial=True) == b'image'


def test_atomic_write_and_missing(tmp_path, monkeypatch):
    p = load_providers()['terrain-aws']
    cache = TileCache(tmp_path)
    cache.put(p, 0, 0, 0, b'old')
    with patch('src.adapters.maps.cache.os.replace', side_effect=OSError('failure')):
        with pytest.raises(OSError): cache.put(p, 0, 0, 0, b'new')
    assert cache.get(p, 0, 0, 0) == b'old'
    assert not list(tmp_path.rglob('*.tmp'))
    def absent(*args, **kwargs): raise HTTPError('https://secret?key=secret',404,'missing',{},None)
    monkeypatch.setattr('src.adapters.maps.cache.urlopen', absent)
    assert cache.get_or_fetch(p,1,0,0) is None
    assert json.loads((tmp_path/'missing.json').read_text()) == ['terrain-aws/1/0/0']
    assert not cache.has(p,1,0,0)


def test_parallel_limit(tmp_path, monkeypatch):
    p = load_providers()['terrain-aws']
    cache = TileCache(tmp_path)
    active = maximum = 0
    lock = threading.Lock()
    import time
    class Response:
        def __enter__(self):
            nonlocal active, maximum
            with lock:
                active += 1
                maximum = max(maximum, active)
            time.sleep(.02)
            return self
        def __exit__(self, *args):
            nonlocal active
            with lock: active -= 1
        def read(self): return b'image'
    monkeypatch.setattr('src.adapters.maps.cache.urlopen', lambda *a, **k: Response())
    with ThreadPoolExecutor(max_workers=12) as pool:
        assert all(pool.map(lambda x: cache.get_or_fetch(p, 4, x, 0), range(12)))
    assert maximum <= 4


def test_mercator_conversions():
    assert lonlat_to_tile(0, 0, 2) == (2, 2)
    assert tile_to_lonlat(2, 2, 2) == (0, 0)
    for lon, lat in [(15,45),(-70,-30),(179,80)]:
        x, y = lonlat_to_tile(lon,lat,8)
        west,north = tile_to_lonlat(x,y,8)
        east,south = tile_to_lonlat(x+1,y+1,8)
        assert west <= lon <= east and south <= lat <= north


def test_latest_build_and_validation(monkeypatch, tmp_path):
    monkeypatch.setattr('src.adapters.maps.vector._json', lambda _: [{'key':'20250102.pmtiles'}, {'key':'20260101.pmtiles'}, {'key':'latest.pmtiles'}])
    assert latest_build() == '20260101.pmtiles'
    with pytest.raises(ValueError): extract((0,0,1,1),6,tmp_path/'x',build='../bad')


def test_vector_failure_preserves_existing_archive(monkeypatch, tmp_path):
    import subprocess
    out = tmp_path / 'world.pmtiles'
    out.write_bytes(b'existing')
    monkeypatch.setattr('src.adapters.maps.vector.pmtiles_binary', lambda: '/fake/pmtiles')
    def fail(*args, **kwargs): raise subprocess.CalledProcessError(1, 'pmtiles')
    monkeypatch.setattr('src.adapters.maps.vector.subprocess.run', fail)
    with pytest.raises(subprocess.CalledProcessError):
        extract((-180,-85,180,85),6,out,'20261102.pmtiles')
    assert out.read_bytes() == b'existing'
    assert list(tmp_path.iterdir()) == [out]

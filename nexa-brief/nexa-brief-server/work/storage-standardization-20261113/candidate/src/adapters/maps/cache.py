"""Caché segura y atómica; los errores no exponen URLs ni cabeceras."""
import json
import io
import math
import os
import tempfile
import threading
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from .licensing import check_license
from .providers import ATLAS, Provider

USER_AGENT = 'NexaBrief-Atlas/1.0 (contact: walkerperedo@eyrholistic.com)'
_locks_guard = threading.Lock()
_provider_locks = {}
_missing_lock = threading.Lock()

def lonlat_to_tile(lon, lat, z):
    if not math.isfinite(lon) or not math.isfinite(lat) or not isinstance(z, int) or z < 0:
        raise ValueError('Coordenadas inválidas')
    n = 2 ** z
    lat = max(-85.0511287798066, min(85.0511287798066, lat))
    x = min(n-1, max(0, int((lon + 180) / 360 * n)))
    y = min(n-1, max(0, int((1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n)))
    return x, y

def tile_to_lonlat(x, y, z):
    n = 2 ** z
    if z < 0 or not 0 <= x <= n or not 0 <= y <= n:
        raise ValueError('Coordenadas inválidas')
    return x/n*360-180, math.degrees(math.atan(math.sinh(math.pi*(1-2*y/n))))

def _atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, name = tempfile.mkstemp(prefix='.atlas-', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
    finally:
        if os.path.exists(name): os.unlink(name)

def terrain_land(data):
    """Clampa Terrarium bajo el nivel del mar, sin alterar píxeles terrestres."""
    from PIL import Image, ImageChops
    image = Image.open(io.BytesIO(data)).convert('RGBA')
    r, g, b, a = image.split()
    # R < 128 equivale exactamente a elevación negativa en Terrarium.
    mask = r.point(lambda v: 255 if v < 128 else 0)
    r = Image.composite(Image.new('L', image.size, 128), r, mask)
    g = Image.composite(Image.new('L', image.size, 0), g, mask)
    b = Image.composite(Image.new('L', image.size, 0), b, mask)
    out = io.BytesIO()
    Image.merge('RGBA', (r, g, b, a)).save(out, format='PNG')
    return out.getvalue()

class TileCache:
    def __init__(self, root=ATLAS / 'cache'):
        self.root = Path(root)

    def path_for(self, provider, z, x, y):
        provider.tile_url(z, x, y)
        if not provider.id or any(c not in 'abcdefghijklmnopqrstuvwxyz0123456789-' for c in provider.id) or provider.ext not in ('jpg', 'png', 'webp'):
            raise ValueError('Proveedor inválido')
        return self.root / provider.id / str(z) / str(x) / f'{y}.{provider.ext}'

    def has(self, provider, z, x, y): return self.path_for(provider,z,x,y).is_file()
    def get(self, provider, z, x, y):
        try: return self.path_for(provider,z,x,y).read_bytes()
        except FileNotFoundError: return None
    def put(self, provider, z, x, y, data):
        if not data: raise ValueError('No se guarda una tesela vacía')
        path = self.path_for(provider,z,x,y)
        _atomic(path, data)
        return path

    def _missing(self, provider, z, x, y):
        path = self.root / 'missing.json'
        key = f'{provider.id}/{z}/{x}/{y}'
        with _missing_lock:
            try: missing = json.loads(path.read_text(encoding='utf-8'))
            except FileNotFoundError: missing = []
            if key not in missing:
                missing.append(key)
                _atomic(path, json.dumps(missing, ensure_ascii=False, indent=2).encode())

    def _is_missing(self, provider, z, x, y):
        with _missing_lock:
            try: entries = json.loads((self.root / 'missing.json').read_text(encoding='utf-8'))
            except FileNotFoundError: return False
            return f'{provider.id}/{z}/{x}/{y}' in entries

    def get_or_fetch(self, provider: Provider, z, x, y, allow_noncommercial=False):
        check_license(provider, allow_noncommercial)
        if provider.id == 'terrain-land':
            data = self.get(provider, z, x, y)
            if data is not None: return data
            from .providers import load_providers
            raw = self.get_or_fetch(load_providers()['terrain-aws'], z, x, y, allow_noncommercial)
            if raw is None: return None
            data = terrain_land(raw)
            self.put(provider, z, x, y, data)
            return data
        url = provider.tile_url(z, x, y)
        data = self.get(provider,z,x,y)
        if data is not None: return data
        if self._is_missing(provider,z,x,y): return None
        with _locks_guard:
            semaphore = _provider_locks.setdefault(provider.id, threading.BoundedSemaphore(4))
        with semaphore:
            data = self.get(provider,z,x,y)
            if data is not None: return data
            if self._is_missing(provider,z,x,y): return None
            for attempt in range(3):
                try:
                    with urlopen(Request(url, headers={'User-Agent': USER_AGENT}), timeout=30) as response:
                        data = response.read()
                    self.put(provider,z,x,y,data)
                    return data
                except HTTPError as exc:
                    if exc.code == 404:
                        self._missing(provider,z,x,y)
                        return None
                    if exc.code < 500 and exc.code != 429: raise RuntimeError(f'{provider.id}: HTTP {exc.code}') from None
                except (URLError, TimeoutError, OSError):
                    pass
                if attempt < 2: time.sleep(0.5 * 2**attempt)
            raise RuntimeError(f'{provider.id}: descarga fallida tras 3 intentos') from None

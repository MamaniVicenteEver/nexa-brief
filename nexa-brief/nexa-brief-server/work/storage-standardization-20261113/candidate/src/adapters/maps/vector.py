"""Extracción de PMTiles con el binario oficial de go-pmtiles."""
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tarfile
import tempfile
from urllib.request import Request, urlopen
from .cache import USER_AGENT
from .providers import ATLAS

PREFERRED = Path.home() / '.local/bin/pmtiles'
FALLBACK = ATLAS / 'cache/bin/pmtiles'

def _json(url):
    with urlopen(Request(url, headers={'User-Agent': USER_AGENT}), timeout=60) as response:
        return json.load(response)

def pmtiles_binary(install=True):
    for candidate in (PREFERRED, FALLBACK):
        if candidate.is_file() and os.access(candidate, os.X_OK):
            subprocess.run([str(candidate), 'version'], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return candidate
    if not install: raise FileNotFoundError('pmtiles no está instalado')
    release = _json('https://api.github.com/repos/protomaps/go-pmtiles/releases/latest')
    assets = [a['browser_download_url'] for a in release['assets'] if re.fullmatch(r'go-pmtiles_.*_Linux_x86_64\.tar\.gz', a['name'])]
    if len(assets) != 1: raise RuntimeError('No se encontró la release Linux x86_64 oficial')
    target = FALLBACK
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='atlas-pmtiles-') as temp:
        archive = Path(temp) / 'release.tar.gz'
        with urlopen(Request(assets[0], headers={'User-Agent': USER_AGENT}), timeout=120) as response, archive.open('wb') as f:
            shutil.copyfileobj(response, f)
        with tarfile.open(archive, 'r:gz') as tar:
            members = [m for m in tar.getmembers() if m.name.lstrip('./') == 'pmtiles' and m.isfile()]
            if len(members) != 1: raise RuntimeError('Release sin binario pmtiles')
            with tar.extractfile(members[0]) as source, (Path(temp) / 'pmtiles').open('wb') as dest:
                shutil.copyfileobj(source, dest)
        binary = Path(temp) / 'pmtiles'
        binary.chmod(0o755)
        subprocess.run([str(binary), 'version'], check=True, stdout=subprocess.DEVNULL)
        with tempfile.NamedTemporaryFile(dir=target.parent, prefix='.pmtiles-', delete=False) as f:
            tmp = Path(f.name)
            with binary.open('rb') as source: shutil.copyfileobj(source, f)
        try:
            tmp.chmod(0o755)
            os.replace(tmp, target)
        finally:
            tmp.unlink(missing_ok=True)
    return target

def latest_build():
    builds = _json('https://build-metadata.protomaps.dev/builds.json')
    valid = [b for b in builds if re.fullmatch(r'\d{8}\.pmtiles', b.get('key', ''))]
    if not valid: raise RuntimeError('No se encontraron builds diarios')
    return max(valid, key=lambda b: b['key'])['key']

def extract(bbox, maxzoom, out, build=None):
    if len(bbox) != 4 or not (-180 <= bbox[0] < bbox[2] <= 180 and -90 <= bbox[1] < bbox[3] <= 90) or not 0 <= maxzoom <= 15:
        raise ValueError('bbox o maxzoom inválido')
    build = build or latest_build()
    if not re.fullmatch(r'\d{8}\.pmtiles', build): raise ValueError('Build inválido')
    out = Path(out)
    out.parent.mkdir(parents=True, exist_ok=True)
    binary = pmtiles_binary()
    fd, name = tempfile.mkstemp(prefix='.atlas-vector-', suffix='.pmtiles', dir=out.parent)
    os.close(fd)
    temporary = Path(name)
    try:
        subprocess.run([str(binary), 'extract', f'https://build.protomaps.com/{build}', str(temporary), '--bbox=' + ','.join(map(str,bbox)), f'--maxzoom={maxzoom}'], check=True)
        subprocess.run([str(binary), 'show', str(temporary), '--header-json'], check=True, stdout=subprocess.DEVNULL)
        os.replace(temporary, out)
    finally:
        temporary.unlink(missing_ok=True)
    return out

class VectorExtract:
    extract = staticmethod(extract)

#!/usr/bin/env python3
"""Descarga imágenes libres de Wikimedia Commons para un episodio (paso 5 del proceso, cualquier tema).

Uso:  python3 tools/media-fetch.py <episodio> [--solo id1,id2] [--ancho 1400]
Lee:  work/medios-necesarios.json  -> lista de {file, que, busqueda, rol, licencia_requerida, commons?}
        `commons`: título exacto de un archivo de Commons («File:...») si ya lo conoces; si no, se busca con `busqueda`.
Escribe: assets/media/<file> y assets/media/credits.json (autor, licencia, URL, fecha de descarga).
Solo acepta licencias libres (CC0, PD, CC BY, CC BY-SA, OGL...). Sin licencia clara no se descarga.
Genera work/results/media-informe.md con lo conseguido y lo que falta. Revisa SIEMPRE las imágenes a ojo (hoja de contactos).
"""
import json, os, re, subprocess, sys, time, urllib.parse, urllib.request

EP = sys.argv[1].rstrip('/')
solo = None; ancho = 1400
if '--solo' in sys.argv: solo = set(sys.argv[sys.argv.index('--solo') + 1].split(','))
if '--ancho' in sys.argv: ancho = int(sys.argv[sys.argv.index('--ancho') + 1])
API = 'https://commons.wikimedia.org/w/api.php'
UA = 'AtlasEnMovimiento/1.0 (documental educativo; verificacion de licencias)'
FREE = re.compile(r'^(cc0|cc[- ]by|cc[- ]by[- ]sa|public domain|pd|ogl|gfdl|attribution|copyrighted free use|no restrictions)', re.I)
BAD = re.compile(r'(nc|nd|fair use|all rights reserved)', re.I)


def get(url, binary=False):
    last = None
    for i in range(6):
        try:
            time.sleep(1.2)  # ritmo amable: Commons limita con 429
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                d = r.read()
                return d if binary else json.loads(d)
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(10 * (i + 1) if '429' in str(e) else 2 * (i + 1))
    raise last


def api(**p):
    return get(API + '?' + urllib.parse.urlencode({'format': 'json', **p}))


def info(titles):
    j = api(action='query', titles='|'.join(titles), prop='imageinfo', iiprop='url|size|mime|extmetadata', iiurlwidth=ancho)
    return list(j.get('query', {}).get('pages', {}).values())


def plain(s):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]*>', ' ', s or '')).strip()


def ok_page(pg):
    ii = (pg.get('imageinfo') or [{}])[0]
    meta = ii.get('extmetadata', {})
    lic = plain(meta.get('LicenseShortName', {}).get('value', ''))
    if not ii or ii.get('mime', '').split('/')[0] != 'image' or 'svg' in ii.get('mime', ''):
        return None
    if min(ii.get('width', 0), ii.get('height', 0)) < 500 or not lic or BAD.search(lic) or not FREE.search(lic):
        return None
    return ii, meta, lic


os.makedirs(EP + '/assets/media', exist_ok=True)
creds_path = EP + '/assets/media/credits.json'
creds = json.load(open(creds_path)) if os.path.exists(creds_path) else {}
todo = json.load(open(EP + '/work/medios-necesarios.json'))
todo = todo.get('medios', todo) if isinstance(todo, dict) else todo
informe = ['# Informe de medios', '']
def proceso(m):
    name = os.path.basename(m['file'])
    if solo and name not in solo and m.get('id') not in solo: return
    if os.path.exists(f"{EP}/{m['file']}") and name in creds:
        informe.append(f'- OK (ya estaba) {name}'); return
    cand = []
    if m.get('commons'):
        cand = [m['commons'] if m['commons'].startswith('File:') else 'File:' + m['commons']]
    else:
        for q in [m.get('busqueda', '')] + m.get('alternativas', []):
            if not q: return
            j = api(action='query', list='search', srnamespace=6, srlimit=12, srsearch=q)
            cand += [x['title'] for x in j.get('query', {}).get('search', [])]
            if len(cand) >= 8: break
    got = None
    for i in range(0, len(cand), 6):
        pages = {p['title']: p for p in info(cand[i:i + 6])}
        for t in cand[i:i + 6]:
            r = ok_page(pages.get(t, {})) if t in pages else None
            if r: got = (t, *r); break
        if got: break
    if not got:
        informe.append(f"- FALTA {name} ({m.get('que', '')}): sin candidato con licencia libre; probar otra búsqueda o fuente oficial"); return
    t, ii, meta, lic = got
    url = ii.get('thumburl') or ii['url']
    data = get(url, binary=True)
    open(f"{EP}/{m['file']}", 'wb').write(data)
    creds[name] = {'file': m['file'], 'title': t, 'author': plain(meta.get('Artist', {}).get('value', '')) or 'desconocido',
                   'license': lic, 'license_url': plain(meta.get('LicenseUrl', {}).get('value', '')),
                   'source_url': ii.get('descriptionurl', ''), 'description': plain(meta.get('ImageDescription', {}).get('value', ''))[:240],
                   'fetched': time.strftime('%Y-%m-%d'), 'bytes': len(data), 'que': m.get('que', '')}
    informe.append(f"- OK {name} <- {t} ({lic}; {creds[name]['author'][:50]})")
    time.sleep(.6)


for m in todo:
    try:
        proceso(m)
    except Exception as e:  # noqa: BLE001
        informe.append(f"- ERROR {os.path.basename(m['file'])}: {type(e).__name__} {str(e)[:80]}")
    json.dump(creds, open(creds_path, 'w'), ensure_ascii=False, indent=1)

json.dump(creds, open(creds_path, 'w'), ensure_ascii=False, indent=1)
os.makedirs(EP + '/work/results', exist_ok=True)
open(EP + '/work/results/media-informe.md', 'w').write('\n'.join(informe) + '\n')
print('\n'.join(informe))

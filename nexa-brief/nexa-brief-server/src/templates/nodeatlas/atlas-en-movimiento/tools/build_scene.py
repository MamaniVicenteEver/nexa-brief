#!/usr/bin/env python3
"""Generador UNIVERSAL de assets/scene.json para Atlas en Movimiento (cualquier tema).

Uso:  python3 tools/build_scene.py <carpeta-del-episodio>
Lee:  assets/script.json  (segmentos con `plan`, ver GUION.md §5 y AGENTE.md §6)
      assets/lyrics.json  (palabras con tiempos, de la voz real)
      assets/song.mp3     (duración)
Escribe: assets/scene.json y work/escena/cobertura-plan.json

No sabe nada del tema: todo lo visual sale del `plan` de cada segmento. Si un segmento no trae plan,
el generador se detiene (no inventa ni omite en silencio). Cada componente del plan se emite con su tipo
real, de modo que `tools/cobertura-audit.mjs` pueda comprobar que el guion se cumplió.
"""
import difflib, json, os, re, subprocess, sys, unicodedata
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))
from src.core.explainer.episode_runtime import validate_atlas_episode_entry

E = sys.argv[1].rstrip('/')
if Path(E).resolve() != Path(__file__).resolve().parent.parent:
    validate_atlas_episode_entry(E)
script = json.load(open(E + '/assets/script.json'))
lyr = json.load(open(E + '/assets/lyrics.json'))
words = [w for s in lyr['segments'] for w in s['words']]
cfg = script.get('escena', {})            # configuración global (ver AGENTE.md §6)


def nz(t):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFD', t.lower()).encode('ascii', 'ignore').decode())


stoks, owner = [], []
for seg in script['segments']:
    for t in re.findall(r'\S+', seg['text']):
        stoks.append(nz(t)); owner.append(seg['id'])
wt = [nz(w['word']) for w in words]
m = {}
for blk in difflib.SequenceMatcher(None, stoks, wt, autojunk=False).get_matching_blocks():
    for j in range(blk.size):
        m[blk.a + j] = blk.b + j


def widx(i, step):
    while 0 <= i < len(stoks) and i not in m:
        i += step
    return m[i] if i in m else (0 if step > 0 else len(words) - 1)


S, EN, pos = {}, {}, 0
for seg in script['segments']:
    n = len(re.findall(r'\S+', seg['text']))
    S[seg['id']] = words[widx(pos, 1)]['start']
    EN[seg['id']] = words[widx(pos + n - 1, -1)]['end']
    pos += n
mp3 = E + '/assets/song.mp3'
dur = float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).decode())
END = round(dur + 2.0, 2)

def anchor_time(sid, ancla):
    """Tiempo de una palabra dicha dentro del segmento. 'palabra', 'palabra#2' (segunda vez), 'palabra+1.5' (desplazada)."""
    m_ = re.fullmatch(r'(.+?)(?:#(\d+))?(?:([+-]\d+(?:\.\d+)?))?', ancla.strip())
    word, nth, shift = nz(m_.group(1)), int(m_.group(2) or 1), float(m_.group(3) or 0)
    lo, hi = S[sid] - .05, EN[sid] + .05
    hits = [w['start'] for w in words if lo <= w['start'] <= hi and nz(w['word']) == word]
    if len(hits) < nth:  # Whisper escribe las cifras con dígitos: «mil», «veinticuatro» -> primer número del segmento
        hits = [w['start'] for w in words if lo <= w['start'] <= hi and nz(w['word']).isdigit()]
    if len(hits) >= nth:
        return hits[nth - 1] + shift
    sys.stderr.write(f'AVISO: ancla "{ancla}" no está en {sid}; se usa el inicio del segmento\n')
    return S[sid] + shift

items, ID = [], [0]


def add(type, t, out, **kw):
    ID[0] += 1
    d = {'id': f'{type.replace(".", "-")}-{ID[0]}', 'type': type, 't': round(t, 2), 'dur': round(out - t, 2),
         'out': round(out, 2), 'fade': .3}
    d.update(kw)
    items.append(d)
    return d


def seg_start(i, off=0):
    return S[i] + off


def seg_end(i, pad=.4):
    return EN[i] + pad


# ---- portada, transcripción, cierre
intro = cfg.get('intro', {})
add('intro.title', 0, intro.get('dur', 5.2), title=intro.get('title', script.get('title', '')), subtitle=intro.get('subtitle', ''),
    kicker=intro.get('kicker', 'ATLAS EN MOVIMIENTO'), focus=intro.get('focus', cfg.get('center', [0, 0])), style='focus', fade=0)
add('caption.transcript', 0, END, fade=0, lyricsUrl='assets/lyrics.json')
outro = cfg.get('outro', {})
add('outro.channel', END - 8, END, channel=outro.get('channel', 'NODEHISTORY'), handle=outro.get('handle') or 'youtube.com/@nodehistory', fade=0, dim=.45)

# ---- territorios globales (plan de escena)
for t in cfg.get('territorios', []):
    a = seg_start(t['desde']) if t.get('desde') else 0
    b = seg_end(t['hasta']) if t.get('hasta') else END - 9
    kw = {k: v for k, v in t.items() if k not in ('desde', 'hasta', 'tipo')}
    add(t.get('tipo', 'territory.fill'), a, b, **kw)

# ---- zonas de control (territory.zone): polígonos fechados que se quedan marcados todo el video
for z in cfg.get('zonas', []):
    sets = z['conjuntos']
    if isinstance(sets, str):
        sets = json.load(open(E + '/' + sets)).get('conjuntos', {})
    a = (anchor_time(z['desde'], z['ancla']) if z.get('ancla') else seg_start(z['desde'])) if z.get('desde') else 0
    b = END - 9 if z.get('hasta') in (None, 'fin') else seg_end(z['hasta'])
    states = []
    for st in z.get('estados', []):
        t_at = (anchor_time(st['en'], st['ancla']) if st.get('ancla') else seg_start(st['en'])) + st.get('offset', 0.0)
        states.append({'at': round(t_at, 2), 'dur': st.get('dur', 3), 'state': st.get('estado', 'ocupado'), 'polygons': sets[st['conjunto']]})
    kw = {k: v for k, v in z.items() if k not in ('desde', 'hasta', 'ancla', 'conjuntos', 'estados', 'inicial', 'tipo')}
    add('territory.zone', a, b, polygons=sets[z['inicial']], states=states, **kw)

camera = [{'t': 0, **cfg.get('camara_inicial', {'center': cfg.get('center', [0, 0]), 'zoom': 5})}]
missing, used = [], []
for seg in script['segments']:
    sid = seg['id']
    plan = seg.get('plan')
    if not plan:
        missing.append(sid); continue
    a, b = seg_start(sid), seg_end(sid)
    tx = plan.get('texto', {})
    if tx.get('fecha') or tx.get('lugar'):
        add('header.date', a, b, fecha=tx.get('fecha', ''), lugar=tx.get('lugar', ''))
    if tx.get('year'):
        add('year.big', a, b, text=tx['year'])
    if tx.get('titular'):
        d = add('statement.title', a + .4, b, text=tx['titular'])
        if tx.get('year'):
            d['slot'] = 'nota'
    if tx.get('nota') and not tx.get('year'):
        add('statement.title', a + .4, b, text=tx['nota'], slot='nota')
    if tx.get('salto'):
        add('statement.jump', a, b, text=tx['salto'])
    cam = plan.get('camara')
    if cam:
        camera.append({'t': round(a + cam.get('offset', 0), 2), 'bearing': 0, 'pitch': 0, **{k: v for k, v in cam.items() if k != 'offset'}})
    for c in plan.get('componentes', []) + plan.get('medios', []):
        c = dict(c)
        typ = c.pop('tipo')
        off = c.pop('offset', 0.0)
        dd = c.pop('dur', None)
        hasta = c.pop('hasta', None)            # id de segmento o 'fin': la pieza dura hasta ahí
        anc = c.pop('ancla', None)               # palabra dicha en el segmento que dispara la pieza
        t0 = (anchor_time(sid, anc) if anc else a) + off
        if hasta:
            t1 = END - 9 if hasta == 'fin' else seg_end(hasta)
        else:
            t1 = min(t0 + dd, END - 1) if dd else b
        t1 = max(t1, t0 + .8)
        add(typ, t0, t1, segment=sid, **c)
        used.append(typ)

def short_author(a):
    a = re.sub(r'https?://(www\.)?', '', a).strip(' /')
    low = a.lower()
    if 'kremlin' in low or 'presidential press' in low:
        return 'Kremlin.ru'
    if 'president.gov.ua' in low:
        return 'president.gov.ua'
    return a[:34]


# créditos reales de los medios (assets/media/credits.json, lo escribe tools/media-fetch.py)
try:
    CRED = json.load(open(E + '/assets/media/credits.json'))
except OSError:
    CRED = {}
for it in items:
    src = it.get('src')
    if src:
        c = CRED.get(src.split('/')[-1])
        if c:
            it['credit'] = (short_author(c.get('author', '')) + ' · ' + c.get('license', '')).strip(' ·')
            it.setdefault('source', c.get('source_url', ''))
        elif it['type'].startswith(('image.', 'document.', 'portrait.')):
            sys.stderr.write(f'AVISO: {src} no tiene crédito en credits.json\n')

if missing:
    sys.exit('Segmentos sin `plan`: ' + ', '.join(missing) + '. El guion debe traer plan visual por segmento (GUION.md §5).')

camera = sorted({k['t']: k for k in camera}.values(), key=lambda k: k['t'])
scene = {'format': 'atlas-v1', 'title': script.get('title', ''), 'duration': END, 'end': END, 'width': 1080, 'height': 1920, 'fps': 30,
         'lang': 'es', 'lyricsUrl': 'lyrics.json', 'intro': False, 'outro': False, 'captions': {'enabled': False}, 'planoLook': 'tactico',
         'estilo': cfg.get('estilo', 'v4-atlas'), 'tiles': {'provider': 'gibs-bluemarble', 'manifest': 'assets/cache-inventory.json'},
         'motionBlur': {'samples': 4, 'fps': 30, 'shutter': .5, 'thresholdPx': 2, 'mode': 'affine'},
         'defs': {'fonts': {'label': 'AtlasDisplay, sans-serif', 'display': 'AtlasDisplay, sans-serif'}},
         'places': cfg.get('places', {}), 'camera': camera, 'layers': [], 'items': items,
         'sound': {'mix': 'assets/mix.mp3' if os.path.exists(E + '/assets/mix.mp3') else 'assets/song.mp3', 'cues': cfg.get('sonidos', [])}}
json.dump(scene, open(E + '/assets/scene.json', 'w'), ensure_ascii=False, indent=1)
print(f'escena {END} s · {len(items)} ítems · {len(set(i["type"] for i in items))} tipos · {len(camera)} cámaras')

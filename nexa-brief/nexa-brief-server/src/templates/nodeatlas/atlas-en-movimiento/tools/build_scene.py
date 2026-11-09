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
import difflib, json, re, subprocess, sys, unicodedata

E = sys.argv[1].rstrip('/')
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

items, ID = [], [0]


def add(type, t, out, **kw):
    ID[0] += 1
    d = {'id': f'{type.replace(".", "-")}-{ID[0]}', 'type': type, 't': round(t, 2), 'dur': round(out - t, 2),
         'out': round(out, 2), 'fade': .3, 'sfx': False}
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
add('outro.channel', END - 8, END, channel=outro.get('channel', 'NODEHISTORY'), handle=outro.get('handle', ''), fade=0, dim=.45)

# ---- territorios globales (plan de escena)
for t in cfg.get('territorios', []):
    a = seg_start(t['desde']) if t.get('desde') else 0
    b = seg_end(t['hasta']) if t.get('hasta') else END - 9
    kw = {k: v for k, v in t.items() if k not in ('desde', 'hasta', 'tipo')}
    add(t.get('tipo', 'territory.fill'), a, b, **kw)

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
        t0 = a + off
        t1 = min(t0 + dd, END - 1) if dd else b
        add(typ, t0, t1, segment=sid, **c)
        used.append(typ)

if missing:
    sys.exit('Segmentos sin `plan`: ' + ', '.join(missing) + '. El guion debe traer plan visual por segmento (GUION.md §5).')

camera = sorted({k['t']: k for k in camera}.values(), key=lambda k: k['t'])
scene = {'format': 'atlas-v1', 'title': script.get('title', ''), 'duration': END, 'end': END, 'width': 1080, 'height': 1920, 'fps': 30,
         'lang': 'es', 'lyricsUrl': 'lyrics.json', 'intro': False, 'outro': False, 'captions': {'enabled': False}, 'planoLook': 'tactico',
         'estilo': cfg.get('estilo', 'v4-atlas'), 'tiles': {'provider': 'gibs-bluemarble', 'manifest': 'assets/cache-inventory.json'},
         'motionBlur': {'samples': 4, 'fps': 30, 'shutter': .5, 'thresholdPx': 2, 'mode': 'affine'},
         'defs': {'fonts': {'label': 'AtlasDisplay, sans-serif', 'display': 'AtlasDisplay, sans-serif'}},
         'places': cfg.get('places', {}), 'camera': camera, 'layers': [], 'items': items,
         'sound': {'mix': 'assets/song.mp3', 'cues': cfg.get('sonidos', [])}}
json.dump(scene, open(E + '/assets/scene.json', 'w'), ensure_ascii=False, indent=1)
print(f'escena {END} s · {len(items)} ítems · {len(set(i["type"] for i in items))} tipos · {len(camera)} cámaras')

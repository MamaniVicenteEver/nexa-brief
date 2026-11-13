"""Validación de contratos geográficos/narrativos; solo datos, sin render."""
import math, re

def validar(scene, R, T, geo, icons):
    types={'range-ring','pulse','route-icon','front-line','geo-label','choropleth','quote-card','timeline'}
    def number(v):return isinstance(v,(int,float)) and not isinstance(v,bool) and math.isfinite(v)
    def coords(v):return isinstance(v,list) and len(v)==2 and all(number(x) for x in v) and -180<=v[0]<=180 and -90<=v[1]<=90
    def location(v):return coords(v) or isinstance(v,str) and (v in scene.get('places',{}) or v in geo)
    for target in ('hud','layers'):
        for i,l in enumerate(scene.get(target,[])):
            typ=l.get('type');path=f'{target}[{i}]'
            if typ not in types:continue
            if (typ=='choropleth') != (target=='layers'):R.e(f'{path}: {typ} va en scene.layers' if typ=='choropleth' else f'{path}: {typ} va en scene.hud')
            for k in ('dur','exit','size','width','r','period','scalePortrait','scaleLandscape','interval','dash','gap','glow','tracking'):
                if k in l and (not number(l[k]) or l[k] < 0 or k not in ('dur','exit','glow','tracking') and l[k]==0):R.e(f'{path}.{k} debe ser positivo finito (dur/exit admiten cero)')
            for k in ('opacity','fillOpacity','tail'):
                if k in l and (not number(l[k]) or not 0<=l[k]<=1):R.e(f'{path}.{k} debe estar entre 0 y 1')
            for k in ('angle','iconAngle','lift','dx','dy','x','y'):
                if k in l and not number(l[k]):R.e(f'{path}.{k} debe ser finito')
            if 'keep' in l and not isinstance(l['keep'],bool):R.e(f'{path}.keep debe ser booleano')
            if typ!='choropleth' and 'scale' in l and (not number(l['scale']) or l['scale']<=0):R.e(f'{path}.scale debe ser positivo finito')
            if typ in ('range-ring','pulse','geo-label') and not location(l.get('at')):R.e(f'{path}.at requiere un lugar o [lon,lat] válido')
            if typ=='range-ring':
                rings=l.get('rings',[l.get('radiusKm',1500)])
                if not isinstance(rings,list) or not 1<=len(rings)<=8 or not all(number(r) and 0<r<20000 for r in rings):R.e(f'{path}.rings/radiusKm requiere 1–8 radios positivos menores de 20.000 km')
            if typ=='route-icon':
                for key in ('from','to'):
                    if not location(l.get(key)):R.e(f'{path}.{key} requiere un lugar o [lon,lat] válido')
                via=l.get('via',[])
                if not isinstance(via,list) or len(via)>16 or not all(location(v) for v in via):R.e(f'{path}.via requiere hasta 16 lugares válidos')
                if not isinstance(l.get('icon','plane'),str) or l.get('icon','plane') not in icons:R.e(f'{path}.icon desconocido {l.get("icon")!r}')
                if l.get('path','great-circle') not in ('great-circle','straight','curve'):R.e(f'{path}.path inválido')
            if typ=='front-line':
                pts=l.get('points')
                if not isinstance(pts,list) or not 2<=len(pts)<=256 or not all(coords(p) for p in pts):R.e(f'{path}.points requiere 2–256 puntos [lon,lat]')
            if typ=='geo-label' and not isinstance(l.get('text'),str):R.e(f'{path}.text es obligatorio')
            if typ=='quote-card':
                if not isinstance(l.get('text'),str) or not l.get('text'):R.e(f'{path}.text es obligatorio')
                elif len(l['text'])>160:R.a(f'{path}: cita de más de 160 caracteres; el navegador recorta a 159 + …')
                if not isinstance(l.get('name'),str) or not l.get('name'):R.e(f'{path}.name es obligatorio')
            if typ=='timeline':
                events=l.get('events')
                if not isinstance(events,list) or not 3<=len(events)<=6 or not all(isinstance(e,dict) for e in events):R.e(f'{path}.events requiere 3–6 hitos');continue
                prev=-float('inf')
                for j,e in enumerate(events):
                    ep=f'{path}.events[{j}]'
                    if not all(isinstance(e.get(k),str) and e[k] for k in ('date','label')):R.e(f'{ep} requiere date y label')
                    if e.get('icon') is not None and (not isinstance(e['icon'],str) or e['icon'] not in icons):R.e(f'{ep}.icon desconocido {e["icon"]!r}')
                    at=T(e.get('t')) if 't' in e else (T(l.get('t',0)) or 0)+j*l.get('interval',1.5) if number(l.get('interval',1.5)) else None
                    if at is None:R.e(f'{ep}.t: ancla no encontrada')
                    elif at<prev:R.e(f'{ep}.t debe respetar el orden de los hitos')
                    else:prev=at
            if typ=='choropleth':
                vals=l.get('values')
                if not isinstance(vals,dict) or not vals or not all(isinstance(k,str) and number(v) for k,v in vals.items()):R.e(f'{path}.values requiere regiones y valores finitos');continue
                for k in vals:
                    if k not in geo and k not in scene.get('regions',{}):R.e(f'{path}.values: región desconocida {k!r}')
                scale=l.get('scale',['blue','yellow','red'])
                colors={'blue','red','yellow','green','orange','white','dim'}|set(scene.get('hudTheme',{}).get('colors',{}))
                if not isinstance(scale,list) or len(scale) not in (2,3) or not all(isinstance(c,str) and (c in colors or re.fullmatch(r'#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?',c)) for c in scale):R.e(f'{path}.scale requiere 2–3 colores por nombre o hex')
                domain=l.get('domain')
                if domain is not None and (not isinstance(domain,list) or len(domain) not in (2,3) or not all(number(v) for v in domain) or any(b<=a for a,b in zip(domain,domain[1:])) or len(domain)==3 and (not isinstance(scale,list) or len(scale)!=3)):R.e(f'{path}.domain requiere extremos crecientes o tres umbrales para tres colores')

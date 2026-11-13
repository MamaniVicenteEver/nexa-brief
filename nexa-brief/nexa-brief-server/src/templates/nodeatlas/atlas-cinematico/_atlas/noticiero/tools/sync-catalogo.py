#!/usr/bin/env python3
"""Sincroniza piezas gestionadas, conserva entradas históricas y regenera PIEZAS.md."""
import argparse, json
from collections import defaultdict
from pathlib import Path
N = Path(__file__).resolve().parents[1]
ORIGIN = "noticiero/componentes.json"

def validate(components):
 names=set()
 for c in components:
  for field in ('name','label','summary','family','target','tags','params','demo','uso','receta'):
   if field not in c: raise ValueError(f'{c.get("name")}: falta {field}')
  if c['name'] in names: raise ValueError(f'Nombre repetido: {c["name"]}')
  names.add(c['name'])
  if c['target'] not in ('hud','layers'): raise ValueError(f'{c["name"]}: target inválido')
  for k,v in c['params'].items():
   if not all(f in v for f in ('type','default','description')): raise ValueError(f'{c["name"]}.{k}: parámetro incompleto')
  for k in c['demo']:
   if k not in c['params']: raise ValueError(f'{c["name"]}: demo usa campo sin documentar: {k}')

def markdown(components):
 lines=['# Piezas del noticiero Original','', 'Generado por `tools/sync-catalogo.py` desde `componentes.json`. JSON en `scene.hud[]` o `scene.layers[]`; rutas de medios relativas a `assets/`. Tiempos: segundos o `"@palabra"`. Escala: `scale`, `scalePortrait`, `scaleLandscape`. Fuente y color: por pieza o `scene.hudTheme`.','']
 families=defaultdict(list)
 for c in components: families[c['family']].append(c)
 for family,items in families.items():
  lines += [f'## {family}','','| Pieza | Cuándo usarla | Campos clave | Demo |','|---|---|---|---|']
  for c in items:
   demo=json.dumps(c['demo'],ensure_ascii=False,separators=(',',':')).replace('|','&#124;')
   keys=[k for k in c['params'] if k not in ('type','t','out','dur','exit','font','weight','scale','scalePortrait','scaleLandscape','dx','dy','upper','tracking') or k == 'scale' and c['demo']['type'] == 'choropleth' or k == 'tracking' and c['demo']['type'] == 'geo-label']
   lines.append(f'| `{c["name"]}` | {c["uso"]} | {", ".join(keys)} | `{demo}` |')
  lines += ['','Combinaciones: '+ ' · '.join(f'`{c["name"].removeprefix("noticiero.")}`: {c["receta"]}' for c in items), '']
 icons=json.loads((N.parent/'assets/icons/noticiero-icons.json').read_text()); cats=defaultdict(list)
 legacy='db eye gavel doc shield bolt drop chart lock ban vote people star globe drone warn'.split()
 for name,d in icons.items():
  if name not in legacy: cats[d['categoria']].append(name)
 lines += ['## Iconos válidos','','Cada línea contiene solo nombres válidos, agrupados por categoría. Los 16 clásicos conservan su dibujo histórico; sus nombres tienen prioridad sobre Lucide. Un nombre desconocido dibuja `star` y avisa una vez por escena.','']
 for cat,names in cats.items(): lines.append(f'{cat}: '+ ' '.join(sorted(names)))
 lines += ['clasicos: '+' '.join(legacy),'','Banderas: ISO2 sin distinguir mayúsculas; lista exacta en `../assets/flags/codes.json`. `flag-chip` con `code` busca en el motor. Para `flag-fill` usa `src:"../../../nodehistory/_atlas/assets/flags/py.svg"` desde este demo (ver `../FLAG_FILL.md`).','', 'Documentación completa de campos y valores predeterminados: `componentes.json`. Licencias y revisiones: `../assets/{icons,flags}/SOURCE.md` y `LICENSE`.','']
 (N/'PIEZAS.md').write_text('\n'.join(lines))

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('episodio',type=Path);args=ap.parse_args()
 root=args.episodio.resolve(); dest=root/'components.json'
 src=json.loads((N/'componentes.json').read_text()); components=src['components']; validate(components)
 data=json.loads(dest.read_text()); index={c['name']:c for c in data['components']}; added=0
 for c in components:
  if c['name'] not in index:
   new=json.loads(json.dumps(c)); new['catalogo_origen']=ORIGIN
   data['components'].append(new);index[c['name']]=new; added+=1
  elif index[c['name']].get('catalogo_origen') == ORIGIN:
   # Solo refresca piezas creadas por este sincronizador.
   current=index[c['name']]; used=current.get('used_by',[])
   current.update(json.loads(json.dumps(c))); current['used_by']=used
  # Las entradas históricas mantienen demos, parámetros y etiquetas.
  used=index[c['name']].setdefault('used_by',[])
  if root.name not in used: used.append(root.name)
 for entry in data['components']:
  if entry.get('name','').startswith('noticiero.'):
   used=entry.setdefault('used_by',[])
   if root.name not in used: used.append(root.name)
 dest.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n'); markdown(components)
 print(f'{added} piezas nuevas; {len(data["components"])} entradas en Showcase; PIEZAS.md actualizado')
if __name__=='__main__':main()

#!/usr/bin/env python3
"""Normaliza la selección fijada de Lucide y las banderas 4:3 de flag-icons.
Uso: vendor-identidad.py <checkout-lucide> <checkout-flag-icons>
"""
import json, shutil, sys, xml.etree.ElementTree as ET
from pathlib import Path
A = Path(__file__).resolve().parents[2]
# Cada entrada conserva nombre inglés y traducción editorial explícita.
CATEGORIES = {
'conflicto': 'drone:dron|shield:escudo|bomb:bomba|crosshair:mira|target:objetivo|swords:espadas|sword:espada|shield-alert:escudo de alerta|shield-check:escudo verificado|shield-off:escudo desactivado|shield-plus:protección|shield-ban:bloqueo|radar:radar|scan-eye:vigilancia|binoculars:binoculares|explosion:explosión',
'politica': 'vote:urna electoral|landmark:parlamento|building-2:edificio institucional|handshake:apretón de manos|scroll-text:tratado|crown:corona|flag:bandera|flag-triangle-left:banderín|megaphone:megáfono|scale:balanza|gavel:mazo judicial|file-signature:firma de documento|notebook-pen:acta|stamp:sello|badge-check:acreditación|speech:discurso|podium:presentación|book-open:constitución|clipboard-check:escrutinio|circle-check:aprobación',
'economia': 'coins:monedas|banknote:billete|banknote-arrow-down:caída de ingresos|banknote-arrow-up:aumento de ingresos|landmark:banco|chart-no-axes-combined:mercados|chart-line:gráfico de línea|trending-up:inflación|trending-down:descenso|percent:porcentaje|dollar-sign:dólar|euro:euro|pound-sterling:libra esterlina|japanese-yen:yen|bitcoin:bitcóin|wallet:cartera|credit-card:tarjeta de crédito|receipt:recibo|shopping-cart:carrito|shopping-basket:cesta|package:mercancía|container:contenedor|barrel:barril|fuel:combustible|badge-dollar-sign:aranceles|briefcase-business:negocios|piggy-bank:ahorro|calculator:calculadora|chart-pie:reparto|store:comercio',
'energia': 'zap:rayo|plug:enchufe|plug-zap:conexión eléctrica|battery:carga|battery-charging:batería cargando|battery-low:batería baja|utility-pole:tendido eléctrico|wind:energía eólica|sun:energía solar|solar-panel:energía solar|radiation:radiación|atom:energía nuclear|factory:refinería|flame-kindling:gas|droplet:petróleo|power:encendido',
'transporte': 'plane:avión|plane-takeoff:despegue|plane-landing:aterrizaje|ship:barco|ship-cargo:buque de carga|anchor:ancla|sailboat:velero|car:coche|bus:autobús|train-front:tren|tram-front:tranvía|truck:camión|bike:bicicleta|motorbike:motocicleta|ambulance:ambulancia|traffic-cone:obras|route:ruta|navigation:navegación|map-pinned:mapa de rutas|milestone:distancias',
'tecnologia': 'cpu:chip|microchip:microchip|satellite:satélite|satellite-dish:antena parabólica|antenna:antena|radio-tower:torre de comunicaciones|wifi:red inalámbrica|wifi-off:sin conexión|lock-keyhole:candado|unlock-keyhole:acceso abierto|fingerprint:huella digital|scan-face:reconocimiento facial|bot:robot|brain-circuit:inteligencia artificial|circuit-board:circuito|server:servidor|database:base de datos|hard-drive:disco|cloud-computing:nube informática|smartphone:teléfono móvil|laptop:portátil|monitor:monitor|code:programación|usb:conexión USB|bluetooth:bluetooth',
'salud': 'hospital:hospital|heart-pulse:pulso|stethoscope:estetoscopio|syringe:jeringa|pill:medicamento|pills:medicamentos|test-tube:análisis|microscope:microscopio|dna:ADN|biohazard:riesgo biológico|bug:virus|thermometer:termómetro|bandage:vendaje|cross:cruz sanitaria|heart:corazón|accessibility:accesibilidad|person-standing:persona|hand-heart:cuidados',
'clima': 'flame:incendio|cloud:niebla|cloud-rain:lluvia|cloud-lightning:tormenta|cloud-snow:nieve|cloud-sun:nubosidad|tornado:tornado|waves:inundación|house-flood:inundación de viviendas|house-crack:terremoto|flame:incendio|flame-kindling:fuego forestal|snowflake:helada|sun-snow:cambio de temperatura|thermometer-sun:calor|thermometer-snow:frío|droplets:precipitaciones|umbrella:paraguas|cloud-hail:granizo|mountain-snow:nieve en montaña|trees:bosque',
'personas': 'user:persona|users:grupo|users-round:población|user-round:perfil|baby:infancia|person-standing:habitante|contact:contacto|hand:mano|hand-helping:ayuda|hand-coins:asistencia económica|hand-fist:protesta|heart-handshake:cooperación|graduation-cap:educación|backpack:estudiante|briefcase:trabajo|user-search:búsqueda de persona|user-check:identificación|user-minus:baja|user-plus:alta|circle-user-round:ciudadano',
'lugares': 'map:mapa|map-pin:ubicación|map-pin-house:domicilio|globe:planeta|earth:territorio|house:vivienda|building:edificio|castle:castillo|church:iglesia|school:escuela|university:universidad|warehouse:almacén|hotel:hotel|tent:campamento|mountain:montaña|tree-pine:bosque|palmtree:palmera|fence:frontera|signpost:cruce|land-plot:parcela',
'medios': 'newspaper:periódico|radio:radio|tv:televisión|camera:cámara|video:video|mic:micrófono|mic-vocal:rueda de prensa|headphones:auriculares|podcast:pódcast|rss:canal de noticias|send:enviar|share-2:compartir|message-square:mensaje|messages-square:conversación|mail:correo|at-sign:mención|image:imagen|clapperboard:filmación|film:película|audio-lines:audio',
'general': 'circle-alert:alerta|triangle-alert:advertencia|info:información|circle-help:ayuda|search:buscar|check:confirmar|x:cerrar|plus:añadir|minus:restar|arrow-up:arriba|arrow-down:abajo|arrow-left:izquierda|arrow-right:derecha|clock:hora|calendar:fecha|calendar-days:calendario|hourglass:plazo|timer:temporizador|link:enlace|external-link:abrir enlace|bookmark:marcador|bell:aviso|settings:ajustes|list:lista|filter:filtro|file-text:documento|folder:carpeta|download:descargar|upload:subir|refresh-cw:actualizar',
}
# Complementos originales del kit que faltan en Lucide, misma caja 24×24.
CUSTOM = {
 'house-flood':('inundación de viviendas',['M3 10l9-8 9 8M5 9v6M19 9v6M9 13v-3h6v3M2 17q2-2 4 0t4 0 4 0 4 0 4 0M2 21q2-2 4 0t4 0 4 0 4 0 4 0']),
 'house-crack':('terremoto',['M3 10l9-8 9 8M5 9v12h14V9M12 7l-2 5 4 2-3 7']),
 'virus':('virus',['M7 12a5 5 0 1 0 10 0a5 5 0 1 0-10 0','M12 2v5M10 2h4M12 17v5M10 22h4M2 12h5M2 10v4M17 12h5M22 10v4M4 4l4 4M3 5l2-2M16 16l4 4M19 21l2-2M4 20l4-4M3 19l2 2M16 8l4-4M19 3l2 2M10 11h.01M14 13h.01']),
 'tank':('tanque',['M2 15h17a3 3 0 0 1 0 6H5a3 3 0 0 1-3-6Z','M6 15l2-6h8l3 6M11 9V6h5l2 3M16 7h7','M6 18h.01M10 18h.01M14 18h.01M18 18h.01']),
 'missile':('misil',['M5 17 17 5l4-2-2 4L7 19Z','M10 12 5 11l-3 3 5 1M12 14l1 5-3 3-1-5M4 20l-2 2']),
 'fighter-jet':('avión de combate',['M12 2l2 8 7 5v2l-7-2v4l3 2H7l3-2v-4l-7 2v-2l7-5Z']),
 'warship':('barco de guerra',['M2 16h20l-4 5H7Z','M6 16v-5h11v5M10 11V7h5v4M12 7V3M15 12h7M2 23l4-1 4 1 4-1 4 1 4-1']),
 'soldier':('soldado',['M6 9a6 6 0 0 1 12 0ZM5 9h14M8 10v3a4 4 0 0 0 8 0v-3M4 22v-2a5 5 0 0 1 5-4M20 22v-2a5 5 0 0 0-5-4M9 17l3 4 3-4']),
 'explosion':('explosión',['m12 2 2 6 5-4-1 6 5 2-6 2 4 6-7-3-2 6-2-6-6 3 3-6-6-2 6-2-1-6 5 4Z'])
}
# Nombres migrados en Lucide: fijar la selección al nombre canónico disponible.
ALIASES={'shield-alert':'shield-exclamation-point','building-2':'building-complex','unlock-keyhole':'lock-keyhole-open','cloud-computing':'monitor-cloud','pills':'pill-bottle','waves':'waves-horizontal','house-flood':'house-waves','house-crack':'house-heart','thermometer-snow':'thermometer-snowflake','podcast':'radio-tower','circle-alert':'circle-exclamation-point','triangle-alert':'triangle-exclamation-point','file-signature':'file-pen-line','podium':'presentation','solar-panel':'sun-medium','fingerprint':'fingerprint-pattern','palmtree':'tree-palm','filter':'list-filter','circle-help':'circle-question-mark'}
def paths(svg):
 out=[]
 for el in ET.parse(svg).getroot():
  tag=el.tag.split('}')[-1]; a=el.attrib
  v=lambda k,d=0:float(a.get(k,d))
  if tag=='path': out.append(a['d'])
  elif tag in ('circle','ellipse'):
   x,y=v('cx'),v('cy'); rx,ry=(v('r'),v('r')) if tag=='circle' else (v('rx'),v('ry'))
   out.append(f'M{x-rx} {y}a{rx} {ry} 0 1 0 {2*rx} 0a{rx} {ry} 0 1 0 {-2*rx} 0')
  elif tag=='line': out.append(f'M{v("x1")} {v("y1")}L{v("x2")} {v("y2")}')
  elif tag in ('polyline','polygon'): out.append('M'+a['points']+('Z' if tag=='polygon' else ''))
  elif tag=='rect':
   x,y,w,h,r=v('x'),v('y'),v('width'),v('height'),v('rx')
   out.append(f'M{x+r} {y}h{w-2*r}a{r} {r} 0 0 1 {r} {r}v{h-2*r}a{r} {r} 0 0 1 {-r} {r}h{-w+2*r}a{r} {r} 0 0 1 {-r} {-r}v{-h+2*r}a{r} {r} 0 0 1 {r} {-r}Z' if r else f'M{x} {y}h{w}v{h}h{-w}Z')
  else: raise ValueError(f'Elemento no soportado: {tag}')
 return out

def main():
 lucide,flags=map(Path,sys.argv[1:]); dest=A/'assets'; (dest/'icons').mkdir(parents=True,exist_ok=True); (dest/'flags').mkdir(parents=True,exist_ok=True)
 icons={}
 for category,entries in CATEGORIES.items():
  for entry in entries.split('|'):
   name,es=entry.split(':'); name=ALIASES.get(name,name)
   if entry.split(':')[0] in CUSTOM or name in icons: continue
   src=lucide/'icons'/f'{name}.svg'
   if not src.is_file(): raise ValueError(f'Falta {name}')
   icons[name]={'paths':paths(src),'categoria':category,'es':es,'tags':[category,es,name],'source':'lucide'}
 for name,canonical,category,es in [('bank','landmark','economia','banco'),('oil','droplet','economia','petróleo')]:
  icons[name]={'paths':paths(lucide/'icons'/f'{canonical}.svg'),'categoria':category,'es':es,'tags':[category,es,name],'source':'lucide','canonical':canonical}
 for name,(es,ds) in CUSTOM.items(): icons[name]={'paths':ds,'categoria':('salud' if name=='virus' else 'clima' if name.startswith('house-') else 'conflicto'),'es':es,'tags':[('salud' if name=='virus' else 'clima' if name.startswith('house-') else 'conflicto'),es,name],'source':'noticiero-original'}
 (dest/'icons'/'noticiero-icons.json').write_text(json.dumps(icons,ensure_ascii=False,separators=(',',':'))+'\n')
 shutil.copyfile(lucide/'LICENSE',dest/'icons'/'LICENSE')
 with (dest/'icons'/'LICENSE').open('a') as f: f.write('\nAdditional original Noticiero pictograms: Copyright (c) 2026 Nexa Brief. Distributed under the ISC License above.\n')
 # Códigos de dos letras: 249 ISO2 y ocho extensiones del proveedor.
 for src in sorted((flags/'flags'/'4x3').glob('??.svg')): shutil.copyfile(src,dest/'flags'/src.name)
 shutil.copyfile(flags/'LICENSE',dest/'flags'/'LICENSE')
 codes=sorted(p.stem for p in (dest/'flags').glob('??.svg')); (dest/'flags'/'codes.json').write_text(json.dumps(codes)+'\n')
 for key,root,folder in [('Lucide',lucide,'icons'),('flag-icons',flags,'flags')]:
  (dest/folder/'SOURCE.md').write_text(f'# {key}\n\nOrigen: https://github.com/'+('lucide-icons/lucide' if key=='Lucide' else 'lipis/flag-icons')+f'\nRevisión: `{root.name.split("-")[-1]}`.\n'+('Los alias bank y oil reutilizan landmark y droplet de Lucide. Selección normalizada de 24×24 a Path2D mediante transform (-1,-1), escala 1/12. LICENSE incluye ISC y aviso MIT de Feather. Los nueve dibujos `tank missile fighter-jet warship soldier explosion house-flood house-crack virus` son originales del kit y se ofrecen bajo ISC, copyright 2026 Nexa Brief.\n' if key=='Lucide' else 'Banderas 4:3 originales, códigos en codes.json. Licencia MIT en LICENSE.\n'))
 iso={c['code'] for c in json.loads((flags/'country.json').read_text()) if c.get('iso')}
 with (dest/'flags'/'SOURCE.md').open('a') as f: f.write(f'\nIncluye {len(set(codes)&iso)} códigos ISO 3166-1 y extensiones del proveedor: '+', '.join(sorted(set(codes)-iso))+'.\n')
 print(f'{len(icons)} iconos; {len(codes)} banderas')
if __name__=='__main__': main()

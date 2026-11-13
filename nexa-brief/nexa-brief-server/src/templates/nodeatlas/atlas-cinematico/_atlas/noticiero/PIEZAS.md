# Piezas del noticiero Original

Generado por `tools/sync-catalogo.py` desde `componentes.json`. JSON en `scene.hud[]` o `scene.layers[]`; rutas de medios relativas a `assets/`. Tiempos: segundos o `"@palabra"`. Escala: `scale`, `scalePortrait`, `scaleLandscape`. Fuente y color: por pieza o `scene.hudTheme`.

## noticiero

| Pieza | Cuándo usarla | Campos clave | Demo |
|---|---|---|---|
| `noticiero.brand` | Identificar el canal. | x, y, at, color, text, size, opacity | `{"type":"brand","text":"NODEPOLITICS","opacity":0.7,"t":0.2}` |
| `noticiero.topic` | Presentar el titular de una noticia. | x, y, at, color, text, slot, dot, size, reveal | `{"type":"topic","text":"ÚLTIMOS ACONTECIMIENTOS","dot":"blue","t":0.2}` |
| `noticiero.lower-title` | Abrir el resumen con título y fecha. | x, y, at, color, lines, meta, gap, metaSize, align | `{"type":"lower-title","lines":[{"text":"Resumen"},{"text":"GEOPOLÍTICO","size":52,"gradient":["blue","#7cc4ff"]}],"meta":"EDICIÓN SEMANAL","t":0.2}` |
| `noticiero.hemicycle` | Mostrar mayorías y votaciones parlamentarias. | x, y, at, color, seats, rows, radius, inner, title, steps, dot, dimColor, sweep, titleDy, titleSize, statGap, statDy, statSize, statLabelSize, noteDy, noteSize | `{"type":"hemicycle","x":0.5,"y":0.35,"seats":100,"rows":7,"radius":160,"title":"Cámara","steps":[{"t":0.2,"groups":[{"n":54,"color":"blue"},{"n":40,"color":"red"}],"stats":[{"value":54,"label":"Grupo A","color":"blue"},{"value":40,"label":"Grupo B","color":"red"}]}],"t":0.2}` |
| `noticiero.counter` | Mostrar una cifra y su unidad. | x, y, at, color, value, from, text, prefix, suffix, decimals, count, size, label, labelSize | `{"type":"counter","value":289,"label":"DATOS","color":"blue","size":76,"t":0.2}` |
| `noticiero.portrait` | Identificar a una persona nombrada. | x, y, at, color, src, name, role, size, focus, gray, nameSize, roleSize | `{"type":"portrait","src":"media/pena.jpg","name":"Santiago Peña","role":"Presidente de Paraguay","size":110,"color":"white","t":0.2}` |
| `noticiero.photo-frame` | Mostrar un lugar u objeto de la noticia. | x, y, at, color, src, w, aspect, caption, captionSize, corner, focus | `{"type":"photo-frame","src":"media/capitolio.jpg","w":420,"aspect":1.5,"caption":"Capitolio · Washington","color":"blue","t":0.2}` |
| `noticiero.chip` | Representar el objeto o la medida del hecho. | x, y, at, color, icon, glyph, label, labelSize, labelColor, glyphColor, size, badge | `{"type":"chip","icon":"chart","label":"ECONOMÍA","color":"green","size":70,"t":0.2}` |
| `noticiero.city` | Ubicar una ciudad mencionada. | x, y, at, color, text, size, side, pulse, r | `{"type":"city","at":[-77.04,38.9],"text":"Washington","pulse":true,"color":"blue","t":0.2}` |
| `noticiero.note` | Añadir contexto breve sobre el mapa. | x, y, at, color, text, dot, size | `{"type":"note","text":"REGIÓN DE INTERÉS","dot":"blue","t":0.2}` |
| `noticiero.glow` | Marcar impactos en los lugares narrados. | x, y, at, color, points, r, speed, stagger | `{"type":"glow","points":[[-77.04,38.9]],"color":"#3ddc84","r":80,"t":0.2}` |

Combinaciones: `brand`: topic + highlight + brand · `topic`: topic + highlight + topic · `lower-title`: topic + highlight + lower-title · `hemicycle`: topic + highlight + hemicycle · `counter`: topic + highlight + counter · `portrait`: topic + highlight + portrait · `photo-frame`: topic + highlight + photo-frame · `chip`: topic + highlight + chip · `city`: topic + highlight + city · `note`: topic + highlight + note · `glow`: topic + highlight + glow

## mapa

| Pieza | Cuándo usarla | Campos clave | Demo |
|---|---|---|---|
| `noticiero.territorio` | Identificar el territorio de la noticia. | region, style, border | `{"type":"highlight","region":"US","style":"blue","t":0,"dur":1,"border":true}` |
| `noticiero.territorio-rayado` | Identificar el territorio de la noticia. | region, style, border | `{"type":"highlight","region":"US","style":"hatch-orange","t":0,"dur":1,"border":true}` |
| `noticiero.arco` | Narrar un traslado, ataque o negociación. | color, from, to, width, lift, head, keep, tail, dashed | `{"type":"arc","from":[-100,35],"to":[-60,-15],"t":0.2,"dur":2,"color":"blue","width":4,"lift":40,"head":"arrow","keep":true}` |
| `noticiero.flag-fill` | Presentar el país sobre su territorio en el globo. | region, src, fit, opacity, fadeOut, opacityKeys | `{"type":"flag-fill","region":"US","src":"../../../nodehistory/_atlas/assets/flags/us.svg","fit":"landmass","t":0,"dur":0.8,"opacity":0.94}` |

Combinaciones: `territorio`: topic + city · `territorio-rayado`: topic + city · `arco`: city + glow · `flag-fill`: flag-chip + topic

## identidad

| Pieza | Cuándo usarla | Campos clave | Demo |
|---|---|---|---|
| `noticiero.icon-grid` | Elegir pictogramas para el plan visual. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","names":["tank","missile","fighter-jet","warship","soldier","cpu","satellite","hospital","handshake","barrel"],"cols":5,"size":42,"y":0.46,"t":0.2}` |
| `noticiero.flag-chip` | Identificar un país junto a una cifra o portavoz. | x, y, at, color, code, src, label, size, shape, plate, labelSize | `{"type":"flag-chip","code":"PY","label":"Paraguay","size":210,"x":0.5,"y":0.46,"color":"white","t":0.2}` |
| `noticiero.logo-chip` | Identificar una empresa, institución u organización. | x, y, at, color, src, label, size, shape, plate, labelSize | `{"type":"logo-chip","src":"media/noticiero-logo-test.svg","label":"Nexa Brief","size":180,"shape":"rect","plate":true,"color":"blue","y":0.46,"t":0.2}` |

Combinaciones: `icon-grid`: chip con el nombre elegido · `flag-chip`: counter + portrait · `logo-chip`: topic + counter

## iconos

| Pieza | Cuándo usarla | Campos clave | Demo |
|---|---|---|---|
| `noticiero.icon-grid-conflicto` | Elegir iconos de conflicto para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"conflicto","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-politica` | Elegir iconos de politica para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"politica","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-economia` | Elegir iconos de economia para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"economia","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-energia` | Elegir iconos de energia para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"energia","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-transporte` | Elegir iconos de transporte para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"transporte","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-tecnologia` | Elegir iconos de tecnologia para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"tecnologia","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-salud` | Elegir iconos de salud para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"salud","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-clima` | Elegir iconos de clima para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"clima","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-personas` | Elegir iconos de personas para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"personas","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-lugares` | Elegir iconos de lugares para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"lugares","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-medios` | Elegir iconos de medios para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"medios","cols":5,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |
| `noticiero.icon-grid-general` | Elegir iconos de general para una noticia. | x, y, at, color, names, category, cols, size, width, labelSize | `{"type":"icon-grid","category":"general","cols":6,"size":30,"labelSize":20,"y":0.46,"t":0.2}` |

Combinaciones: `icon-grid-conflicto`: chip + topic · `icon-grid-politica`: chip + topic · `icon-grid-economia`: chip + topic · `icon-grid-energia`: chip + topic · `icon-grid-transporte`: chip + topic · `icon-grid-tecnologia`: chip + topic · `icon-grid-salud`: chip + topic · `icon-grid-clima`: chip + topic · `icon-grid-personas`: chip + topic · `icon-grid-lugares`: chip + topic · `icon-grid-medios`: chip + topic · `icon-grid-general`: chip + topic

## Datos y economía

| Pieza | Cuándo usarla | Campos clave | Demo |
|---|---|---|---|
| `noticiero.bar-compare` | Comparar magnitudes de dos a seis países, sectores o períodos. | x, y, at, color, width, size, locale, decimals, count, stagger, unit, bars, orientation, max, title, highlight, steps | `{"type":"bar-compare","t":0.2,"out":6.5,"title":"EXPORTACIONES · EJEMPLO","unit":"M€","decimals":1,"highlight":"Alemania","steps":[{"t":0.2,"bars":[{"label":"Alemania","value":1234.5,"color":"blue"},{"label":"Francia","value":986.2,"color":"yellow"},{"label":"Italia","value":754.8,"color":"green"}]}]}` |
| `noticiero.line-series` | Mostrar una evolución de una a tres series y señalar un momento del relato. | x, y, at, color, width, size, locale, decimals, count, stagger, unit, series, title, min, max, marker, steps | `{"type":"line-series","t":0.2,"out":6.5,"title":"INFLACIÓN · EJEMPLO","unit":"%","decimals":1,"steps":[{"t":0.2,"series":[{"label":"Zona euro","color":"blue","points":[{"label":"ENE","value":6.8},{"label":"FEB","value":6.2},{"label":"MAR","value":5.7},{"label":"ABR","value":5.9},{"label":"MAY","value":4.8}]},{"label":"Estados Unidos","color":"yellow","points":[{"label":"ENE","value":5.8},{"label":"FEB","value":5.4},{"label":"MAR","value":5.2},{"label":"ABR","value":4.6},{"label":"MAY","value":4.1}]}]}],"marker":{"t":1.6,"label":"MAR","text":"CAMBIO DE TENDENCIA"}}` |
| `noticiero.delta` | Destacar la subida o caída de un precio, indicador o porcentaje. | x, y, at, color, width, size, locale, decimals, count, stagger, unit, value, from, label, labelSize, period, good, steps, title | `{"type":"delta","t":0.2,"out":6.5,"label":"PETRÓLEO · EJEMPLO","unit":"%","period":"RESPECTO AL CIERRE ANTERIOR","steps":[{"t":0.2,"value":4.2}]}` |
| `noticiero.ranking` | Ordenar de tres a cinco países, empresas o sectores por magnitud. | x, y, at, color, width, size, locale, decimals, count, stagger, unit, items, title, steps | `{"type":"ranking","t":0.2,"out":6.5,"title":"PIB · DATOS ILUSTRATIVOS","unit":"M€","steps":[{"t":0.2,"items":[{"name":"Estados Unidos","flag":"US","value":27360,"color":"blue"},{"name":"China","flag":"CN","value":17795,"color":"yellow"},{"name":"Alemania","flag":"DE","value":4456,"color":"green"},{"name":"Japón","flag":"JP","value":4213,"color":"white"}]}]}` |
| `noticiero.stacked-bar` | Mostrar la composición porcentual de un resultado, presupuesto o bloque. | x, y, at, color, width, size, locale, decimals, count, stagger, unit, parts, title, total, steps | `{"type":"stacked-bar","t":0.2,"out":6.5,"title":"REPARTO DE ESCAÑOS · EJEMPLO","unit":"escaños","steps":[{"t":0.2,"parts":[{"label":"Bloque azul","value":180,"color":"blue"},{"label":"Bloque rojo","value":156,"color":"red"},{"label":"Coalición verde","value":11,"color":"green"},{"label":"Otros","value":3,"color":"dim"}]}]}` |
| `noticiero.ticker` | Resumir de dos a seis cotizaciones con sus variaciones en una franja fija. | x, y, at, color, width, size, locale, decimals, count, stagger, unit, items, title, good, steps | `{"type":"ticker","t":0.2,"out":6.5,"title":"MERCADOS · EJEMPLO","steps":[{"t":0.2,"items":[{"label":"Brent","value":83.4,"unit":"USD","change":4.2},{"label":"Oro","value":2345.6,"unit":"USD","change":-0.8},{"label":"EUR/USD","value":1.1,"change":0.4},{"label":"Gas natural","value":32.8,"unit":"EUR","change":-2.1}]}]}` |

Combinaciones: `bar-compare`: topic + highlight + bar-compare; delta para explicar la variación. · `line-series`: topic + line-series + delta; marcador t:"@palabra" cuando se menciona el hito. · `delta`: topic + delta + line-series; good:"down" para inflación o desempleo. · `ranking`: topic + ranking + flag-chip; counter o delta para el primer puesto. · `stacked-bar`: topic + stacked-bar + hemicycle para escaños; todas las etiquetas se conservan en una leyenda debajo. · `ticker`: topic + ticker en el centro inferior; line-series para ampliar una cotización.

## Mapa y geografía

| Pieza | Cuándo usarla | Campos clave | Demo |
|---|---|---|---|
| `noticiero.range-ring` | Mostrar un radio geográfico en kilómetros desde un lugar. | color, at, x, y, radiusKm, rings, label, size, width, fillOpacity | `{"type":"range-ring","t":0.2,"out":6.5,"at":[-77,38.9],"rings":[500,1000,1500],"dur":2,"color":"yellow"}` |
| `noticiero.pulse` | Marcar una señal, explosión o epicentro con ondas repetidas. | color, at, x, y, period, r, width | `{"type":"pulse","t":0.2,"out":6.5,"at":[-77,38.9],"color":"orange","r":150,"period":1.8}` |
| `noticiero.route-icon` | Mostrar un vehículo que recorre un trayecto con rumbo y estela. | color, from, to, via, icon, iconAngle, path, lift, size, width, tail, keep | `{"type":"route-icon","t":0.2,"out":6.5,"from":[-95,39],"via":[[-82,44]],"to":[-65,39],"icon":"plane","dur":5,"keep":true,"color":"yellow","size":34}` |
| `noticiero.route-icon-barco` | Mostrar un vehículo que recorre un trayecto con rumbo y estela. | color, from, to, via, icon, iconAngle, path, lift, size, width, tail, keep | `{"type":"route-icon","t":0.2,"out":6.5,"from":[-65,34],"to":[-95,37],"icon":"warship","dur":5,"keep":true,"color":"blue","size":34}` |
| `noticiero.route-icon-tanque` | Mostrar un vehículo que recorre un trayecto con rumbo y estela. | color, from, to, via, icon, iconAngle, path, lift, size, width, tail, keep | `{"type":"route-icon","t":0.2,"out":6.5,"from":[-85,34],"to":[-71,39],"icon":"tank","dur":5,"keep":true,"color":"green","size":34}` |
| `noticiero.front-line` | Dibujar una línea discontinua de frente o frontera en disputa. | color, points, label, width, dash, gap, glow, size | `{"type":"front-line","t":0.2,"out":6.5,"points":[[-87,31],[-83,35],[-81,39],[-75,43]],"color":"red","label":"FRENTE · ILUSTRATIVO","dur":3}` |
| `noticiero.geo-label` | Identificar mares, estrechos o regiones con texto discreto. | color, at, x, y, text, angle, tracking, opacity, size | `{"type":"geo-label","t":0.2,"out":6.5,"at":[-65,32],"text":"ATLÁNTICO NORTE","angle":-18,"color":"white","size":34,"opacity":0.65}` |
| `noticiero.choropleth` | Comparar valores de muchos países o estados con un solo relleno. | scale, color, at, x, y, values, domain, opacity, unit, width, size | `{"type":"choropleth","t":0.2,"out":6.5,"values":{"US":0.4,"CA":0.65,"MX":0.9,"GT":1.15,"HN":1.4,"NI":1.65,"CR":1.9,"PA":2.15,"CU":2.4,"HT":2.65,"DO":2.9,"JM":3.15,"CO":3.4,"VE":3.65,"EC":3.9,"PE":4.15,"BO":4.4,"BR":4.65,"PY":4.9,"UY":5.15,"AR":5.4,"CL":5.65,"GB":5.9,"FR":6.15,"ES":6.4,"PT":6.65,"DE":6.9,"IT":7.15,"NL":7.4,"BE":7.65,"NO":7.9,"SE":8.15,"FI":8.4,"JP":8.65,"AU":8.9},"scale":["#2467c9","#ffd21a","#ef445c"],"domain":[0,9],"unit":"%","y":0.72}` |

Combinaciones: `range-ring`: topic + city + range-ring + counter para alcance o área afectada. · `pulse`: topic + pulse + range-ring + counter para desastre o explosión. · `route-icon`: topic + city + route-icon; front-line para contexto de conflicto. · `route-icon-barco`: city + route-icon parametrizado; comparte geometría y dibujante. · `route-icon-tanque`: city + route-icon parametrizado; comparte geometría y dibujante. · `front-line`: topic + highlight + front-line + city; rotular aproximado si la geometría lo es. · `geo-label`: topic + geo-label + city; route-icon para explicar un corredor. · `choropleth`: topic + choropleth + delta o bar-compare para sanciones, aranceles o impactos.

## Narrativa

| Pieza | Cuándo usarla | Campos clave | Demo |
|---|---|---|---|
| `noticiero.quote-card` | Mostrar una declaración breve atribuida, con retrato opcional. | color, at, x, y, text, src, name, role, width, size | `{"type":"quote-card","t":0.2,"out":6.5,"text":"El acuerdo abre una nueva etapa de cooperación entre nuestros países.","name":"DECLARACIÓN DE EJEMPLO","role":"Cumbre internacional · ilustración","y":0.42,"color":"yellow"}` |
| `noticiero.timeline` | Ordenar de tres a seis hitos y marcar el actual con anclas de voz. | color, at, x, y, events, interval, width, size | `{"type":"timeline","t":0.2,"out":6.5,"events":[{"date":"08:00","label":"Alerta","icon":"radio","t":0.3},{"date":"10:30","label":"Reunión","icon":"people","t":1.4},{"date":"12:00","label":"Acuerdo","icon":"handshake","t":2.3},{"date":"14:00","label":"Firma","icon":"doc","t":4.2}],"color":"yellow"}` |

Combinaciones: `quote-card`: topic + quote-card + timeline para cumbre con acuerdo. · `timeline`: topic + timeline + quote-card para cumbre; pulse + timeline para emergencia.

## Iconos válidos

Cada línea contiene solo nombres válidos, agrupados por categoría. Los 16 clásicos conservan su dibujo histórico; sus nombres tienen prioridad sobre Lucide. Un nombre desconocido dibuja `star` y avisa una vez por escena.

conflicto: binoculars bomb crosshair explosion fighter-jet missile radar scan-eye shield-ban shield-check shield-exclamation-point shield-off shield-plus soldier sword swords tank target warship
clima: cloud cloud-hail cloud-lightning cloud-rain cloud-snow cloud-sun droplets flame house-crack house-flood mountain-snow snowflake sun-snow thermometer-snowflake thermometer-sun tornado trees umbrella waves-horizontal
politica: badge-check book-open building-complex circle-check clipboard-check crown file-pen-line flag flag-triangle-left handshake landmark megaphone notebook-pen presentation scale scroll-text speech stamp
economia: badge-dollar-sign bank banknote banknote-arrow-down banknote-arrow-up barrel bitcoin briefcase-business calculator chart-line chart-no-axes-combined chart-pie coins container credit-card dollar-sign euro fuel japanese-yen oil package percent piggy-bank pound-sterling receipt shopping-basket shopping-cart store trending-down trending-up wallet
energia: atom battery battery-charging battery-low droplet factory flame-kindling plug plug-zap power radiation sun sun-medium utility-pole wind zap
transporte: ambulance anchor bike bus car map-pinned milestone motorbike navigation plane plane-landing plane-takeoff route sailboat ship ship-cargo traffic-cone train-front tram-front truck
tecnologia: antenna bluetooth bot brain-circuit circuit-board code cpu database fingerprint-pattern hard-drive laptop lock-keyhole lock-keyhole-open microchip monitor monitor-cloud radio-tower satellite satellite-dish scan-face server smartphone usb wifi wifi-off
salud: accessibility bandage biohazard bug cross dna hand-heart heart heart-pulse hospital microscope person-standing pill pill-bottle stethoscope syringe test-tube thermometer virus
personas: baby backpack briefcase circle-user-round contact graduation-cap hand hand-coins hand-fist hand-helping heart-handshake user user-check user-minus user-plus user-round user-search users users-round
lugares: building castle church earth fence hotel house land-plot map map-pin map-pin-house mountain school signpost tent tree-palm tree-pine university warehouse
medios: at-sign audio-lines camera clapperboard film headphones image mail message-square messages-square mic mic-vocal newspaper radio rss send share-2 tv video
general: arrow-down arrow-left arrow-right arrow-up bell bookmark calendar calendar-days check circle-exclamation-point circle-question-mark clock download external-link file-text folder hourglass info link list list-filter minus plus refresh-cw search settings timer triangle-exclamation-point upload x
clasicos: db eye gavel doc shield bolt drop chart lock ban vote people star globe drone warn

Banderas: ISO2 sin distinguir mayúsculas; lista exacta en `../assets/flags/codes.json`. `flag-chip` con `code` busca en el motor. Para `flag-fill` usa `src:"../../../nodehistory/_atlas/assets/flags/py.svg"` desde este demo (ver `../FLAG_FILL.md`).

Documentación completa de campos y valores predeterminados: `componentes.json`. Licencias y revisiones: `../assets/{icons,flags}/SOURCE.md` y `LICENSE`.

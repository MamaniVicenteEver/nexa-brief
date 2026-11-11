# Atlas · pack HUD de noticiero (`scene.hud[]`)

Capa 2D que se dibuja encima del globo (después de `layers`). Código: `hud.js`. Producir un video con él: `noticiero/AGENTE.md` y `noticiero/MENU.md` (recetas por tipo de noticia). Demo: `sandbox/nodepolitics/resumen-geopolitico-demo`.
Todo es función de `t`; los tiempos aceptan segundos o anclas de voz (`"@palabra"`, `"@palabra+0.4"`, `"@palabra#2"`).

Campos comunes: `type`, `t` (entra), `out` (sale), `dur` (entrada, 0.5), `exit` (0.35), `scale`. `scalePortrait` y `scaleLandscape` multiplican la escala en vertical y horizontal; por defecto son 1.
Posición: `at` (lugar de `places` o `[lon,lat]`) + `dx`,`dy` en px de diseño, **o** `x`,`y` como fracción del cuadro.
Estilo editable por ítem: `font`, `size`, `weight`, `tracking`, `color`, `upper:false`. Globales en `scene.hudTheme`:
`{"fonts":{"ui":"…","title":"…","num":"…"},"colors":{"blue":"#2f8cff","red":"#ff3b5c","yellow":"#ffd21a","green":"#3ddc84","orange":"#ff8a1a","white":"#fff","dim":"#8d96a8","panel":"rgba(8,14,26,.62)"}}`.
Los colores se pueden dar por nombre o en hex.

| type | campos clave |
|---|---|
| `brand` | `text`, `x`,`y`, `size`, `opacity` (marca de agua) |
| `topic` | `text`, `slot` (0,1,2… apila hacia abajo), `dot`, `reveal` (s de decodificado) |
| `lower-title` | `lines:[{text,size,weight,color,gradient:[..],font}]`, `meta` (fecha), `x`,`y`,`gap` |
| `hemicycle` | `seats`,`rows`,`radius`,`inner`,`title`, `steps:[{t,groups:[{n,color}],stats:[{value,label,color}],note}]`, `dimColor`, `dot` |
| `counter` | `value`,`from`,`prefix`,`suffix`,`decimals` o `text` fijo, `label`, `count` (s), `size`, `color` |
| `portrait` | `src`, `name`, `role`, `nameSize`, `roleSize`, `color`, `size`, `focus`; sin `src` dibuja silueta |
| `photo-frame` | `src`, `w`, `aspect`, `caption`, `color`, `corner`, `focus` |
| `chip` | `icon` (db eye gavel doc shield bolt drop chart lock ban vote people star globe drone warn) o `glyph`, `label`, `badge`, `color`, `size` |
| `city` | `text`, `side` (top/bottom/left/right), `pulse`, `r`, `color` |
| `note` | `text`, `dot` (etiqueta pequeña sobre el mapa) |
| `glow` | `points:[lugares]`, `color`, `r`, `speed` |

Resaltados (`layers[].type:"highlight"`): estilos del look `noticiero-globo` (`blue white red yellow orange green hatch-red hatch-orange`).
Un estilo puede traer `hatch:"#color"` (rayado), `glow`, `glowWidth`, `glowBlur`. `scene.regions` admite `{"geometry": GeoJSON}`; para pintar
varios países/estados con una sola capa (mucho más rápido) usar un MultiPolygon (ver `union_region` en `work/build_scene.py`).
`scene.attribution:false` oculta el pie técnico. Look sin estrellas: `"stars": false`.
`atlas.persistentPortrait` registra `portrait` en `components.json` y Showcase. `size` controla el radio de la foto; `nameSize` (17) y `roleSize` (11) controlan sus textos por separado. La placa mide ambas cadenas y aumenta su alto y separación para conservar los textos dentro de ella. Las escalas de orientación multiplican foto, placa y textos; sin valores nuevos se conserva el diseño predeterminado. Una ampliación de foto del 30 % y letras del 20 % respecto a 100/24/11 se expresa así:

```json
{"type":"portrait","src":"media/retrato.jpg","name":"PERSONA DE EJEMPLO","role":"Presidente","x":0.2,"y":0.61,"size":130,"nameSize":28.8,"roleSize":13.2,"scaleLandscape":0.95,"scalePortrait":1,"t":2,"out":40}
```

Omitir `at` conserva el ancla de pantalla mientras se mueve el mapa. El encuadre de la foto sigue `focus`; las rutas son relativas a `assets/`. Los demás tipos HUD se pueden usar por JSON, aunque aún no todos tienen una entrada individual de Showcase.

## Identidad y biblioteca de iconos (Original)

`chip.icon` acepta los nombres del catálogo `noticiero/PIEZAS.md`; los 16 nombres históricos conservan exactamente sus trazos. Los demás se precargan desde `assets/icons/noticiero-icons.json` y se dibujan con Path2D. Un nombre desconocido usa `star` y emite un aviso una vez por escena.

- `icon-grid`: `names:[...]` o `category` (conflicto por defecto), `cols` (4 vertical, 6 horizontal), `size:32`, `labelSize:20`, `width:960`; centrada en `x,y` o `at`. Para galería legible usar una categoría por cuadro; los nombres saltan por guiones.
- `flag-chip`: `code:"PY"` (ISO2, mayúsculas indistintas) o `src` relativo a assets (prioritario), `label`, `size:112` (ancho), `shape:"rect"|"round"`, `color` (borde de 1.5), `labelSize:20`. Rectangular conserva 4:3; circular contiene la bandera completa dentro del círculo.
- `logo-chip`: `src` relativo a assets (PNG/JPG/SVG), `label`, `size:100` (lado), `shape:"rect"|"round"`, `plate:true` blanco, `false` transparente o color, `color`, `labelSize:20`. Imagen contenida con margen de 8% sin deformarla; ausente muestra iniciales y avisa.

Las tres piezas respetan `t,out,dur,exit`, anclas, tema, tipografía, coordenadas y escalas de orientación. La biblioteca y las imágenes se cargan una vez en `ready()`, sin imágenes, canvas ni Path2D nuevos por cuadro.

## Datos y economía (Original)

Implementación única: `hud-data.js`, conectada desde `hud.js`; catálogo y demos: `noticiero/PIEZAS.md`.

| type | datos |
|---|---|
| `bar-compare` | `bars:[{label,value,unit?,color?}]` (2–6), `orientation:"horizontal"|"vertical"`, `max`, `highlight` (label exacto), `title` |
| `line-series` | `series:[{label,color,points}]` (1–3), puntos `[x,y]` con x creciente o `{label,value}` por índice; `min,max,unit,title`; `marker:{t,x}` o `{t,label,text,color}` |
| `delta` | `value` con signo, `from`, `label`, `labelSize:30`, `period`, `unit`, `good:"up"|"down"`; flecha por signo, verde/rojo automático, cero dim; `color` explícito sustituye el automático; `size:76` de cifra |
| `ranking` | `items:[{name,value,unit?,color?,flag?,icon?}]` (3–5), orden del array = puesto; `flag:"US"` de la biblioteca compartida tiene prioridad sobre icon, `title` |
| `stacked-bar` | `parts:[{label,value,color,unit?}]` (1–12), valores no negativos de suma positiva; ancho normalizado al 100 %, `total` rotulado o suma por defecto, `title`; leyenda por fila también para partes pequeñas |
| `ticker` | `items:[{label,value,change,unit?}]` (2–6), variación en %, `good`, `title`; dos columnas en vertical y tres en horizontal, sin desplazamiento continuo |

Campos comunes: `width:900` (mínimo efectivo 360), `size:30` salvo delta, `font`, `weight:700`, `color`, `upper`; `locale:"es-ES"`, `decimals:0` (delta y ticker: 1), `unit`, `count:1.1`, `stagger:.12`. Separadores de miles también para cuatro dígitos. Números en `hudTheme.fonts.num`, etiquetas en `hudTheme.fonts.ui`; `font` sustituye ambas. Los colores aceptan nombres del tema y CSS/hex.

Cada pieza acepta `t,out,dur,exit`, `x,y` o `at,dx,dy`, `scale,scalePortrait,scaleLandscape`. Centro predeterminado `.5,.44` (ticker: `.5,.69`). El panel completo se ajusta al ancho disponible y queda por encima de y=.8, incluso con escalas o posiciones que lo desborden. Textos largos llevan `…` sin invadir otras columnas.

`steps:[{t:"@palabra",…datos}]` usa anclas absolutas como hemicycle. Cada paso hereda el estado anterior y sustituye los arrays que incluya; `t` y `count` controlan la animación del nuevo estado. Valores de barras/filas se interpolan por etiqueta/nombre desde el estado previo o cero para elementos nuevos; delta desde el valor anterior. `line-series` vuelve a dibujar el trazo del nuevo estado; el último valor se rotula en una leyenda separada para evitar solapes entre series. `marker.t` admite anclas de voz independientes. Geometría, fuentes, orientación, posición y escala se declaran en la pieza; los campos de datos permitidos en steps están enumerados en cada contrato de `componentes.json`.

No se crean canvas, imágenes, mapas, formatos Intl ni temporizadores durante el dibujo. Banderas e iconos de ranking se precargan, incluyendo todos sus steps; cachés acotadas a la escena. El validador revisa cantidades, valores finitos, decimales, estructura de puntos, iconos, banderas y anclas de marcadores.

## Mapa y narrativa Original (noticiero-comp-c)

`scene.hud[]`: `range-ring` (at, radiusKm o rings, dur, fillOpacity), `pulse` (at, period, r), `route-icon` (from, via, to, icon, iconAngle, lift, path, dur, keep, tail), `front-line` (points [lon,lat], label, dash, gap, glow), `geo-label` (at, text, angle, tracking, opacity), `quote-card` (text ≤160 caracteres, name, role, src opcional), `timeline` (events de 3–6 hitos con date, label, icon opcional y t absoluto/ancla). Campo `iconAngle`: ángulo intrínseco del dibujo desde la derecha; calibrados plane −45°, fighter-jet −90°, ship −90° (vista frontal), warship 0° y tank 0°. Los perfiles laterales warship/tank se reflejan horizontalmente al apuntar al oeste, manteniendo casco/orugas abajo.

`scene.layers[]`: `choropleth` (values por código de país/estado, scale 2–3 colores, domain opcional, opacity, unit). Una sola colección con propiedad value y una sola capa fill. Geometrías resueltas una vez; el cuadro solo modifica opacidad si cambia. Leyenda HUD automática con mínimo/máximo. Aquí `scale` es la escala de colores; `scalePortrait`, `scaleLandscape`, `width`, `size`, `font`, `weight`, `color` controlan la leyenda.

Anillos de alcance geodésicos con Tierra de radio 6371,0088 km, no círculos en píxeles; borde oculto tras el globo. Si el anillo cruza el horizonte se omite su relleno para evitar cerrar la silueta incorrectamente. Las rutas usan la misma función de círculo máximo/elevación que arc; la duración se reparte por distancia entre tramos via. La estela queda en la llegada con keep:true y desaparece al completar dur con keep:false.

Toda animación depende de t; t/out y cada events[].t aceptan anclas. La cita revela su panel y recorta a 159 caracteres + … con aviso único si supera 160. La cronología se coloca a un lado en vertical y debajo del centro en horizontal, siempre por encima de los subtítulos. Contratos, valores predeterminados, demos y combinaciones: `noticiero/componentes.json` y `noticiero/PIEZAS.md`.

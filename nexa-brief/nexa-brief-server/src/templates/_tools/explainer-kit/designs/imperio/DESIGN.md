# imperio · atlas de cine histórico

Diseño documental para política e historia. El recurso visual central es un atlas físico claro sobre océano azul grisáceo, con el país foco marcado por un sol carmesí. Los rayos y el archivo monocromo convierten el mapa en una escena, sin dejar de leerlo como geografía.

## 1. Referencia

Video de referencia: `sandbox/referencias/nodepolitics/cozy-workwear-outfits/From Klickpin.com- Try Cozy workwear outfit ideas that are packed with ideas people keep saving and clicking on lately for ideas worth saving righ.mp4` (27,708 s; 736×414; 24 fps). Se estudió el original y las hojas `scratchpad/ref/v3/sheet01.jpg` y `sheet02.jpg`; no se reutilizaron sus fotogramas ni texturas.

### Ritmo y composición

| Tiempo aprox. | Imagen y movimiento |
|---|---|
| 0–3,8 s | Mapa físico de Asia oriental. Japón queda rayado; un círculo carmesí late sobre el archipiélago. La cámara se aleja con una rotación leve. |
| 4–4,9 s | Se abren rayos rojos translúcidos hacia el sur, sobre el mar; aparecen barcos pequeños. |
| 5–9,8 s | Entra `南進論` en gris, carácter a carácter. Debajo se tipea `SOUTHERN EXPANSION DOCTRINE`; ambas líneas se borran de derecha a izquierda. |
| 10,1–12,7 s | El título blanco condensado `JAPANESE EMPIRE` sube en dos renglones y queda centrado sobre el abanico. |
| 12,7–13,5 s | El mapa pasa a gris y se funde una foto de archivo en blanco y negro con humo y viñeta. El título se conserva y empieza a achicarse. |
| 13,5–27,7 s | El archivo y el atlas permanecen fundidos; los rayos carmesí siguen encima, con una rosa de los vientos fina abajo a la derecha, grano y un alejamiento continuo. |

### Color observado

| Uso | Muestra aproximada |
|---|---|
| Océano | `#7D9AAA` (base del diseño `#7f9bab`) |
| Tierra iluminada | `#e7e9e5` |
| Relieve en gris | `#a7b5ba` |
| Sol | carmesí profundo `#6c001b` |
| Rayos | rojo oscuro con transparencia `#8a0f2a` |
| Archivo | escala de grises de negros densos a luces lavadas |

Las muestras describen el fotograma; los colores de `design.json` son los controles de color del diseño.

### Tipografía

- Título principal: Fjalla One, mayúsculas estrechas, blanco, tracking discreto; dos líneas y más ancho en 16:9.
- Título nativo: Noto Sans JP 700, gris pizarra. La traducción usa Montserrat 800, negra y pequeña.
- Rótulos de agua: Montserrat itálica, clara y de poco contraste, para no competir con el título.

## 2. Componentes y secuencia replicada

| Movimiento de la referencia | Componente / parámetros |
|---|---|
| Atlas físico con relieve y fronteras | `_imperio.js`: `d3-geo`, `topojson-client`, `KIT_WORLD_50m`; `imperio.map` y `imperio.title` |
| País con trama diagonal | `country` / `hatch` en `imperio.title`, `imperio.map`, `imperio.archive` y `imperio.expansion` |
| Círculo que late | `IM.sun`; `sunSize` controla su radio en grados del mapa |
| Abanico hacia el mar y barcos | `IM.rays` + `IM.ships`; `dir:180`, `spread:0.72`, `rayFloor:0.02`, `rayAlpha:0.56`, `rayLen:0.46`, `ships:2` |
| Kanji y traducción tipeada / borrada | `imperio.native` (como overlay o integrado en `imperio.title`): `nativeAt:5`, `nativeOut:9.2` |
| Título blanco de dos líneas | `imperio.word`; empieza en 10,1 s, separa los renglones 0,78 s, los revela en 0,45 s y se achica desde 2,8 s hasta `shrinkTo:0.18` |
| Archivo B/N fundido con el mapa | `imperio.archive`: `photoAt`, `photo`, `grayDur`, `smoke`, `photoFocus`, `compass`; los rayos se dibujan por encima de la foto |
| Acabado del tramo de archivo | Grano, polvo y viñeta aumentan junto con la intensidad de la foto; la foto se convierte a B/N con contraste local. |

El plano de apertura usa una cámara de `[150,36,95,0]` a `[145,35,125,3]`. Al empezar el archivo, se continúa de `[145,35,125,3]` a `[135,32,165,6]`. En 16:9 el título se centra en `y:0.68` y usa un máximo de `0.25H` para acercarse a la escala de la referencia. En el demo va en un overlay aparte desde 10,1 s para que sobreviva el cambio de plano y termine de achicarse durante el archivo.

## 3. Mapa y determinismo

El atlas se dibuja en canvas: la proyección y geometría vienen de D3-geo y TopoJSON con `KIT_WORLD_50m`, empaquetado en `vendor/geo/`. No consulta teselas ni datos de internet durante la reproducción. El relieve procedural usa ruido con semilla (`Kit.rng(seed)`), así el mismo mapa vuelve a dar el mismo resultado al buscar una posición del video.

El océano tiene una textura suave; la tierra combina iluminaciones, relieve grande y detalle de costa. Los contornos, la trama imperial, los rayos, los barcos, la rosa de los vientos, la foto y el humo se dibujan como capas sobre la misma cámara. Los medios de la demo usan rutas locales y el mismo pipeline de fotos B/N.

## 4. Ejemplos y variaciones

- `imperio.title`: apertura completa para un país, con el idioma nativo y su traducción.
- `imperio.native`: doctrina, nombre propio o cita en el idioma original sobre cualquier mapa.
- `imperio.word`: nombre condensado persistente que se puede achicar sobre varios planos.
- `imperio.archive`: retratos, barcos, documentos o lugares históricos en B/N fundidos con el atlas.
- `imperio.expansion`: rutas o zonas de influencia que irradian desde un país hacia destinos.
- `imperio.introv1` / `imperio.introv2`: dos ganchos autónomos, con fondos de atlas, archivo, papel o foto.
- `imperio.outro`: cierre de canal con el sol naciente y llamada a la acción.

Los nombres de país admiten los nombres de World Atlas y alias en español (`Japón`, `Alemania`, `Reino Unido`). El título nativo y su traducción son parámetros, igual que la cámara, el sol, los rayos, las etiquetas de mar y la foto.

## 5. Demo y validación

La demo `sandbox/nodepolitics/imperio-demo/` usa copias de la canción, transcripción, guion y medios de `nodehistory/turing-enigma/assets/`. El audio cuenta otra historia: el demo valida el diseño y el recorrido del kit, no es una pieza para publicar. Los primeros 27,7 s conservan la cronología visual de la referencia y usan `uboat.jpg` como material de archivo.

Validación del demo:

- `kit.py check imperio-demo`: 56 beats, 0 errores. Quedan dos avisos de planos largos: 12,7 s de apertura y 15 s de archivo, ambos fijados al ritmo de la referencia.
- `kit.py sheet imperio-demo --orient both`: 50 capturas por orientación en `work/sheet-9x16.png` y `work/sheet-16x9.png`; la palabra y su escala se comprobaron aparte en el tramo de 10–27 s.
- `kit.py render imperio-demo --formats 16x9 --seconds 20`: salida H.264 + AAC de 20 s, 1920×1080, 30 fps. Los cuadros de control confirman la entrada del abanico, la revelación del título y el fundido B/N completo alrededor de 13,5 s.
- El 404 de `config.json` es el primer intento de `engine/loader.js`; luego carga `assets/config.json`, según el fallback documentado.

Las capturas y verificaciones del trabajo también se guardan en el scratchpad indicado en `BRIEF-COMUN.md`.

## Banderas por país (2026-10-16)

El sol y los rayos toman los colores de la bandera del país foco (`flag: "auto"`, por defecto): misma forma,
solo cambia el color. Tabla `FLAGS` en `_imperio.js` (≈50 países, claves = `properties.name` de world-atlas,
alias en español): `h` franjas horizontales (Alemania), `v` verticales (Francia), `ring` aros concéntricos para
banderas complejas (Reino Unido, EE. UU.). Japón queda en el carmesí de la referencia (`classic`). Los rayos de
bandera van en modo normal translúcido (el dorado en multiplicar se volvía oliva sobre el azul); los casi blancos
no se usan para rayos. `flag: "none"` = carmesí; `flag: "#000,#d00,#fc0"` = colores propios. Intros y cierre
usan la misma bandera (`country`).

## Fluidez (2026-10-16)

- Síntoma: en vivo (navegador) el alejamiento se trababa cada ~0,9 s y los cortes daban un golpe de hasta 0,9 s.
  Causas: cada llave del mapa costaba 250–300 ms (halo de 5 trazos + relieve + océano sobre la tierra de TODO el
  mundo a 50m) y el canvas difiere el dibujo hasta el primer uso.
- Arreglo (no cambia ningún cuadro del render): tierra proyectada una vez por proyección y recortada al rectángulo
  de la llave (Sutherland–Hodgman), baldosa de océano horneada, almacén único de llaves (LRU 12) que en vivo se
  arman por franjas en los ratos libres forzando la rasterización (`getImageData` de 1 px), llave de respaldo
  mientras se arma, precalentado 3,5 s antes de cada plano (llaves, proyección, foto B/N por renglones),
  fundido entre llaves en el último 30 % del tramo (sin salto de detalle) y cámara `ease: "auto"` (lineal entre
  planos encadenados, sin frenar a cero).
- En el render cuadro a cuadro (`__promo.seek`) todo se dibuja entero y en el momento (determinista).
- Medido en Chromium sin GPU, 30 s: de 14–17 tirones > 100 ms (máx. 0,9 s) a 2 (máx. ~0,2 s, al empezar un plano de archivo).

## Fluidez de la reproducción (2026-11-01)

Dos síntomas en los movimientos de cámara (zoom, alejamiento, vuelos): **tirones** (la cámara avanza a ratos el doble y a ratos nada) y
**pausas** de 100–570 ms al empezar un plano o durante un vuelo. Se midieron en reproducción real con `tools/perf_check.py` y tenían estas causas
(todas corregidas en el motor, así que valen para todos los videos, no solo para uno):

| causa | dónde | arreglo |
|---|---|---|
| El motor usaba `audio.currentTime` tal cual como reloj. Ese valor avanza a escalones irregulares (15–60 ms según navegador y buffer de audio) mientras los cuadros llegan cada 16–33 ms: la velocidad de la cámara variaba ±50 % de un cuadro a otro. | `engine/kit.js` · `mediaClock()` | Con el audio sonando se interpola con el reloj de pared (rAF) y se engancha al audio con un filtro de ~0,4 s; si el audio salta (adelantar, retroceder, buffering, pestaña oculta) se resincroniza de golpe. En pausa y en capturas/seek se usa el valor exacto. Desviación de la velocidad: 0,40 → 0,01. |
| Las llaves del atlas se armaban "en ratos libres" con `requestIdleCallback`, pero mientras la animación corre a cada cuadro **ese callback no se ejecuta nunca** (medido: 0 llamadas en 6 s). La cola no avanzaba y cada llave se armaba de golpe al pedirla. | `_imperio.js` · `idle` | `requestIdleCallback(f, { timeout: 60 })`: si el navegador nunca está ocioso, igual se ejecuta una franja chica cada ~60 ms. Además `IM.sliceWork()` avanza franjas tras cada cuadro si sobra presupuesto (según el coste medio real de una franja). |
| El precalentado solo conocía las 2 primeras llaves del recorrido simple `from→to` y un solo gris. Un zoom largo usa ~12 llaves en 3 s. | `_imperio.js` · `lookAhead`, `lookBeats` | Se muestrea la cámara de los próximos ~3,5 s y se encolan las llaves en orden de uso. Las del arranque del plano siguiente son prioritarias. Máximo 4 pendientes (`WARM_MAX`): encolar de más llenaba el almacén y las llaves se desalojaban antes de usarse. |
| Cada banda nueva de 10° de longitud proyectaba todo el mundo de golpe (~50 ms). | `_imperio.js` · `projRings` | `A._ringsWork(ms)` lo hace polígono a polígono en ratos libres (`IM.warmAtlas`). El resultado es idéntico al de antes (se comprobó anillo por anillo). |

### Mapa corrido al cruzar una banda de longitud (corregido el 2026-11-01)

Síntoma: durante un vuelo de cámara el mapa se ve «en otra posición» respecto de lo que se dibuja encima (el sol, las banderas, el rayado), salta al
cambiar de llave y, en el fundido entre dos llaves, se ven dos copias. Causa: cada llave del atlas se dibuja en la proyección de **su** banda de longitud
(múltiplo de 10°, `IM.atlas(lon).key`) y la vista actual puede estar en otra banda; `mapCache.draw` componía `V.m × e.M` sin corregir la diferencia, que en
coordenadas de atlas es `(banda_llave − banda_vista)·UPD` en x. El mapa salía corrido exactamente 10° de longitud (85 px con span 150°, 128 px con 100°, 213 px con 60°
en un cuadro de 1280) mientras la cámara cruzaba una frontera (130°, 140°, 150°…). Afectaba al 2,9 % de los cuadros de `imperio-demo` y al 4,7 % de `japon-expansion-prueba`.
Arreglo: cada entrada guarda `bk` (banda de la llave) y el blit traslada `dl·UPD` con `dl = ((bk − V.A.key + 540) % 360) − 180`. Medido contra una referencia exacta
(cámara = llave): cuadros con >5 % de píxeles distintos 21 de 106 → 0. Los cuadros fuera de esos tramos no cambian un píxel.

### Para quien escriba componentes con mapa propio

- `mapLook(p)` puede devolver `grays: [0, 1]` si el plano pasa de color a gris (el motor precalienta ambos).
- `mapWarm(p, ctx, beat)` → `[{ cam, hatch? }]`: lista propia de cámaras para precalentar antes de que empiece el plano (reemplaza al recorrido simple).
  Un componente con varios vuelos (como `imperio.campaign`) debe además precalentar por tiempo desde su `render` con `IM.warmKey(ctx, cam, look)`.
- No dibujes video con `ctx.filter` a pantalla completa en cada cuadro: dibújalo a media resolución en un lienzo chico y mézclalo.
- Diagnóstico: `IM.keyStats()` devuelve el estado del almacén de llaves (franjas hechas de 8) y la cola.

### Cómo medir

```bash
.venv/bin/python src/templates/_tools/explainer-kit/tools/perf_check.py <url del index.html> --secs 60
# compara con el motor anterior: --orig DIR (con kit.js.orig y _imperio.js.orig)
```

Resultado en `sandbox/nodepolitics/imperio-demo` (50 s, servidor sin GPU): pausas de más de 60 ms 9 → 3, la peor 282 → 201 ms, irregularidad del tiempo 0,16 → 0,03.
Lo que queda es el primer uso de un lienzo de llave grande (~100 ms en render por software); en un equipo con GPU es mucho menor.


### Revisión integral de 120 s · 2026-11-01

La revisión completa de `japon-expansion-prueba`, incluida su reproducción en el modal real de la app,
detectó causas que no aparecían al medir solo los primeros 62 s. El detalle, las capturas, los comandos y
las cifras antes/después están en
[`work/results/corregir-cortes.md`](../../../../sandbox/nodepolitics/japon-expansion-prueba/work/results/corregir-cortes.md).

- **Reloj en la misma referencia temporal.** La marca que entrega rAF puede ser mucho más antigua que
  la ejecución del callback si el hilo comparte trabajo con la página padre o con rasterización. Leer
  `audio.currentTime` al ejecutar y compararlo con esa marca hacía que el filtro acelerara la cámara.
  `kit.js` toma `performance.now()` al entrar al callback, junto a la muestra del audio. Esto mantiene
  también los clips en esa referencia. `__kitTrace` registra ahora el inicio efectivo; el medidor guarda
  además la marca rAF original y los intervalos de entrega. El seek y la pausa siguen siendo exactos.
- **Primera pintura y fuentes.** La página suelta arranca el audio después de pintar el cuadro inicial,
  igual que la barrera de `ready` del modal. Las fuentes se esperan hasta 10 s. `setup` conserva su
  ejecución síncrona original; el hook `prepare` se espera solo en vivo (también hasta 10 s). Imperio
  espera los caracteres nativos concretos
  antes de crear los planos: una descarga CJK pendiente podía sustituir cuadrados por kanji en medio
  del plano. Una caída del CDN que supere esos límites sigue siendo un riesgo; la solución estable es
  alojar los mismos archivos de fuente como recursos locales compartidos.
- **Reservas del atlas.** En vivo, dibujar una reserva actualiza el LRU. Se conserva una llave completa por
  aspecto mientras la capacidad lo permite; no hay que expulsar el último gris antes de tener su
  reemplazo. La nueva entrada solicitada nunca es su propia víctima de desalojo. Se mantienen
  `CAP = 16`, `STRIPS = 8`, `KM` y `KR`: no se reducen calidad ni resolución. La captura mantiene
  la política original de desalojo y uso del LRU para conservar su secuencia exacta.
- **Prioridad y fondos de intros/cierres.** `lookAhead` admite `mapWarm` + `mapLook` sin `mapCam`:
  preparar un fondo no debe incorporarlo a la cadena de cámaras. Los presets de intros/cierres declaran
  las llaves que realmente usan y preparan la siguiente durante su recorrido. Como la cola urgente
  inserta por delante, el lote se agrega al revés para conservar el orden de necesidad. Esto elimina
  la construcción de un atlas frío al empezar el cierre de 115,12 s.
- **Búsqueda en pausa.** Con `controls=1` y audio pausado, el atlas usa la vía exacta, sin reservas.
  Antes el tiempo era correcto pero la imagen podía seguir siendo una reserva transformada. No se
  aplica esta regla al reloj sintético de previews de componentes.

- **Videos con búsqueda pendiente.** No volver a asignar `currentTime` si `video.seeking` es verdadero:
  cancelar repetidamente búsquedas lentas puede congelar la imagen. Bajo CPU ×4 se registraron 10
  cancelaciones en página suelta y 19 en la app; con el guard, cero en ambas. La rama exacta no cambia.
- **Final de reproducción.** Cuando el audio alcanza el total ya no hay un beat activo: repintar borraba
  el cierre y revelaba el atlas de fondo. En vivo se retiene la última pintura válida y se pausan clips;
  un resize recompone ese mismo segundo. El seek explícito al total conserva su resultado original.

La regresión final usa 86 pares de capturas, repartidos entre esta pieza e `imperio-demo`, en 16:9 y
9:16, con los mismos bytes de fuentes preparados. Verifica `work/engine-final-ours/` contra `pre-sol`,
con el storyboard original. Los checks de ambos videos dieron OK; los tests tienen únicamente las
dos fallas de categorías permitidas por el brief. El informe enlaza los resultados y sus límites.

**Un callback corto no certifica una reproducción sin cortes.** El servidor usa Chromium sin GPU:
el informe separa tiempo de dibujo, intervalos rAF y cambios de imagen. CPU ×4 sigue excediendo los
límites. Las variantes de `willReadFrequently`, readback forzado e `ImageBitmap` no mejoraron el coste
del archivo; más franjas mejoraban una ventana corta, pero empeoraban una reproducción completa y se
revirtieron. También se descartó activar más trabajo dentro del cuadro: no extrapolar una microprueba
al video entero. Los hooks de diagnóstico solo se usan cuando un medidor los pide.

**Coordinación de cambios geométricos.** Esta revisión detectó la discrepancia de proyecciones y dejó
`work/proposals/imperio-projection.patch` sin aplicar por la exigencia de píxeles idénticos. En paralelo,
otro proceso incorporó la corrección `bk` descrita arriba y cambió el inicio del primer vuelo de 0,3
a 0,6 s. Se conservaron esos cambios; su autor dejó `work/results/NOTA-bandas-de-longitud.md`. La
instantánea propia `work/engine-final-ours/` permite verificar por separado la igualdad de seek. El
estado activo combinado requiere una nueva referencia visual acordada. Tampoco se editaron los
cortes que ya vienen dentro de los clips ni el cambio de plano del cierre.

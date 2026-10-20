# imperio · atlas de cine histórico

Diseño documental para política e historia. El recurso visual central es un atlas físico claro sobre océano azul grisáceo, con el país foco marcado por un sol carmesí. Los rayos y el archivo monocromo convierten el mapa en una escena, sin dejar de leerlo como geografía.

## 1. Referencia

Video de referencia: `sandbox/nodepolitics/From Klickpin.com- Try Cozy workwear outfit ideas that are packed with ideas people keep saving and clicking on lately for ideas worth saving righ.mp4` (27,708 s; 736×414; 24 fps). Se estudió el original y las hojas `scratchpad/ref/v3/sheet01.jpg` y `sheet02.jpg`; no se reutilizaron sus fotogramas ni texturas.

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

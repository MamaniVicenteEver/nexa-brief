# pop · DUOTONO — diseño editorial menta / violeta

> Réplica de estilo de la referencia `otros/From Klickpin.com- Try these viral ways to style your wedding favors…mp4`
> (69,4 s, 1280×720, 29,97 fps): una promo de plantilla "moderna/editorial" que muestra **la misma
> secuencia de ~27 planos tres veces** con tres tratamientos de color: B/N (2–17,6 s), color (19–35,6 s)
> y **duotono menta/violeta** (44,9–56,9 s, más libro 3D y cierre 57–69 s). El diseño `pop` replica la
> versión duotono (y deja la B/N disponible cambiando solo la paleta).

## 1. Análisis de la referencia

### 1.1 Ritmo
- Corte duro cada **16 cuadros = 0,534 s** (≈112 BPM). Detección de escena (`select=gt(scene,0.2)`):
  …44.91, 45.44, 46.41(no), 47.55, 48.08, 48.65, 49.25, 49.85, 50.42, 50.98, 51.95, 52.52, 53.05, 53.59,
  54.12, 54.65, 55.26, 55.82, 56.36, 56.85, 57.39 (libro 57,4–60,1), 60.16 (logo), 60.6 (mosaico),
  61.2 (dominio), 63.5 (texto mínimo).
- Casi todas las transiciones son **cortes secos**; la "transición" es la ENTRADA del plano nuevo
  (2–6 cuadros de efecto): glitch de bloques sobre negro (49,25 · 54,9), parpadeo de paleta
  (49,35–49,55), cortina líquida (50,95), triángulo que crece (56,9), cortina de rayas (53,7).

### 1.2 Paleta (muestreada con PIL sobre cuadros a 1280 px)
| rol | hex | dónde |
|---|---|---|
| fondo menta | `#3ccaaa` (varía #35cca7–#44c4a4) | fondo de casi todos los planos |
| violeta tinta | `#2a0e70` (texto `#1d0f6c`) | textos, flechas, sombras del duotono |
| violeta medio | `#8a4075` | medios tonos del duotono |
| rosa | `#cd697c` | luces medias del duotono, letras que parpadean, "×" |
| gris arcos | `#80898a` (≈ gris al 55 % sobre menta) | arcos gruesos de "POSTERS" |
| fondo del libro | `#54baa0` | menta apagada del plano 3D |
| gris claro / negro | `#e8e8e8` / `#1d1d1d` | texto mínimo final y variante B/N |

**Duotono** = mapa de gradiente por luminancia: 0 → violeta `#2b0f70`, 0,35 → `#8a4075`,
0,6 → rosa `#cd697c`, 1 → menta `#3ccaaa` (entre rosa y menta pasa por un gris `#81a097`, como en
los cuadros 52,8 y 47,9). La variante B/N usa el mismo mapa con `#1d1d1d → #e8e8e8`.

### 1.3 Tipografía
- Titulares: **grotesca extendida muy gruesa** (tipo Druk Wide / Monument Extended), mayúsculas,
  interletra casi nula, interlineado ≈0,82. Google Font más parecida con ancho variable:
  **Archivo** `wdth 125` `wght 800–900` (`font-stretch: expanded`).
- Rótulos chicos (NEXT GENERATION, YOU'LL NEVER FORGET, SPORTS/FASHION…): la misma Archivo
  extendida 700–800 a 2,5–4 % del alto.
- Japonés diagonal: gótica CJK negra → **Noto Sans JP 900**.
- Texto mínimo final ("USE ANY MEDIA / PHOTOS OR VIDEO"): geométrica 600 muy espaciada (≈0,45 em)
  → **Montserrat 600**.

### 1.4 Catálogo de planos (segundos de la versión duotono; entre paréntesis la B/N)
| # | seg. | plano | movimiento medido |
|---|---|---|---|
| 1 | 44,93 (2,0) | marca + círculo fino | la marca escala 0→1 (4 cuadros); arco fino se dibuja antihorario desde arriba (0,05–0,5 s); la marca parpadea rosa 2 cuadros (0,37/0,43 s); a 0,5 s aparece un anillo exterior de trazos rotos que gira y se cierra en un círculo fino (r≈0,24 H) a 0,7 s; sale borrándose (1,6 s) |
| 2 | 46,4 (3,5) | "/DESIGN/BW" + objeto 3D | rótulo chico arriba-izq.; objeto (blob 3D) entra escalando con esquirlas, gira lento |
| 3 | 46,95 (4,0) | caleidoscopio hexagonal | hexágono central con el objeto, 6 copias vecinas, rótulos "/DESIGN" rotados, bordes sup/inf del hexágono gruesos violeta; a los 0,3 s aparece un marco violeta fino en todo el borde |
| 4 | 47,55 (4,5) | "BLACK" sobre foto | foto a sangre (duotono oscuro) con zoom lento; palabra gigante menta entra creciendo (escala 0,75→1) y deslizando a la izquierda en 5 cuadros; repetición chica glitcheada abajo-der., "=" abajo-izq. |
| 5 | 48,1 (5,0) | "STYLE" + dos círculos | palabra violeta aparece primero con letras faltantes; dos círculos con la MISMA foto crecen desde 0 (expoOut, 7 cuadros, el izquierdo primero); interletra que se abre; una letra parpadea rosa; barra menta debajo; "× × ×" uno por uno; escuadra arriba-der. |
| 6 | 48,65 (5,5) | caja con rayas | marco fino con foto lavada; rayas diagonales violeta GRUESAS que en 0,4 s se afinan hasta pelos; palabra + eco rosa desplazado abajo con letras que faltan; "|||" antes; flechas ↑↓ a la derecha; todo el grupo se desliza a la izquierda (≈0,2 W en 0,5 s, lineal) |
| 7 | 49,25 (6,3) | glitch de bloques | 3 cuadros: negro con rectángulos de la imagen desplazados en x, algunos rayados en rosa |
| 8 | 49,35 (6,5) | "FOREVER" | 6 cuadros de parpadeo de paleta (rosa plano / gris-menta / menta / rosa / violeta) con letras faltantes; queda palabra menta con letras rayadas (hatch) y "★★★"; tiras glitch de la palabra estiradas arriba |
| 9 | 49,85 (7,0) | japonés diagonal chico | texto rotado −28° (isométrico) en el centro sobre menta, deriva lenta; esquina sup-der.: 4 renglones chicos ("STD./TRA/NSM/AXX") escribiéndose |
| 10 | 50,4 (7,5) | japonés grande + triángulo | foto abajo-izq., triángulo menta arriba-der.; el texto cambia de color según la región (menta sobre foto, violeta sobre menta); deriva diagonal hacia arriba-der. |
| 11 | 50,98 (8,0) | "NEW WAY TO PROMOTE" | cortina líquida violeta (borde ondulado) que baja y destapa la foto en 0,25 s; renglones apilados aparecen uno cada 2 cuadros; cruz violeta grande + flecha-pentágono menta que crece; último cuadro con flash de paleta rosa |
| 12 | 51,45 (8,5) | ídem, re-encuadre | texto más grande, eco en contorno, tira de glitch de píxeles, círculo con cruz y chevrones rosas abajo |
| 13 | 51,95 (9,0) | "STRONG" tríptico | col. izq. 2 fotos chicas entre bandas rayadas; centro menta con "ST" gigante en contorno fino; "STRONG" con letras que rebotan en ola; foto grande a la derecha que se desliza a la izquierda; rótulo menta "SPORTS/FASHION/ADS. DESIGN" con cortes glitch |
| 14 | 52,52 (9,5) | "THE POWER" | foto muy desenfocada que se enfoca; marco paralelogramo menta GRUESO que rota (−35°→0), crece y se afina hasta ser un marco rectangular fino con esquinas en triángulo; título con ecos en contorno que se abren a los lados |
| 15 | 53,05 (10,0) | letras gigantes "OE" | dos letras de 0,62 H: la 1ª rellena de foto, la 2ª de ondas op-art que se deforman; deriva lenta; etiqueta paralelogramo violeta que entra con borde dentado (sierra) |
| 16 | 53,59 (10,5) | "2 COLOURS" | negro con texto menta → banda de rayas cae desde arriba → la foto se abre como banda (doble exposición desplazada) y el texto cambia rosa/gris/menta; rayas finas diagonales; línea negra horizontal |
| 17 | 54,12 (11,0) | flecha + "NEXT GENERATION" | flecha gruesa entra desde la izquierda (5 cuadros) parpadeando violeta→rosa→gris→rosa→violeta; el rótulo se decodifica con letras al azar |
| 18 | 54,65 (11,5) | glitch de esquirlas | 3 cuadros de bloques violeta/menta inclinados |
| 19 | 54,75 (12,0) | dos círculos-foto + flecha | círculos enormes en los bordes (crecen), flecha central, "×" rosa, flechitas, línea superior con texto mínimo |
| 20 | 55,26 (12,5) | columna "POSTERS" | columna-foto vertical entra barriendo desde la derecha (2 cuadros) y deriva a la derecha; arcos grises gruesos que giran; triángulo ◄ |
| 21 | 55,82 (13,0) | "NICE / POSTERS" | segunda columna: la cámara sigue paneando |
| 22 | 56,36 (13,5) | alejamiento | el par de columnas se achica al 35 % con regla y texto mínimo debajo |
| 23 | 56,85 (14,0) | triángulo-foto | el ◄ chico crece (4 cuadros) hasta un triángulo grande con foto a la izquierda |
| 24 | 57,4 (14,5) | libro 3D isométrico | fondo menta apagado; libro con foto y texto en la tapa que se desplaza; deriva/achica lenta; la tapa cambia a la marca |
| 25 | 60,16 (17,5) | marca sobre violeta | marca menta grande; se "deshace" en rayado y se apaga |
| 26 | 60,6 (18,0) | mosaico de marcas | grilla de cuadrados violeta con la marca, filas desfasadas, parpadeo de brillo |
| 27 | 61,2 (18,5) | dominio | texto chico centrado entra con glitch en itálica, se achica, parpadea a gris y se apaga |
| 28 | 63,5 | texto mínimo | "USE ANY MEDIA / PHOTOS OR VIDEO" muy espaciado sobre gris claro, fundido |
| — | 21 (B/N) | "YOU CAN SET ANY COLORS" | una línea chica, primeras palabras en rojo |

### 1.5 Texturas
Grano fino de película sobre todo (más visible en las fotos) y bordes suaves en las letras con foto.
Se genera proceduralmente (4 lienzos de ruido sembrados en `setup`, alternados por cuadro).

## 2. Identidad del diseño

- **Canal provisional:** DUOTONO (`@duotono`). Temas: cultura, historia reciente, diseño, música, moda,
  deporte, ciudades. Voz: la de `binary` (Charon).
- **Regla de color:** fondo menta; tinta violeta; el rosa solo para UNA cosa por plano (letra que
  parpadea, eco, "×", chevrones). Las fotos SIEMPRE en duotono (nunca a color ni B/N).
- **Regla de ritmo:** cortes secos. La transición vive en los primeros 2–9 cuadros del plano nuevo
  (`fx`). Nada de fundidos cruzados (`transition.overlap = 0`).
- **Variante B/N** de la referencia (2–17,6 s): mismo diseño cambiando en el config del video
  `palette` (`bg #e8e8e8`, `ink #1d1d1d`, `mid #555`, `accent #888`, `light #e8e8e8`) y
  `pop.duo` (`[[0,"#1d1d1d"],[1,"#e8e8e8"]]`).

## 3. Catálogo de movimientos replicados → componente

| ref. (s) | movimiento | componente / parámetro |
|---|---|---|
| 44,93 | marca escala 0→1 (4 cuadros), arco antihorario, parpadeo rosa, anillo roto que gira y se cierra, se borra desde abajo | `pop.logo` (también 1er tiempo de `pop.title` y `pop.outro`) |
| 46,4 / 46,95 | objeto 3D con esquirlas → caleidoscopio hexagonal + marco violeta | `pop.kaleido` (`split`) |
| 47,55 | palabra gigante escala 0,75→1 deslizando a la izq. en 5 cuadros, repetición chica glitcheada, "=" | `pop.word` |
| 48,1 | dos círculos que crecen (expoOut 7 cuadros, desfasados), interletra que se abre, letra rosa, barra, "×××", escuadra | `pop.circles` |
| 48,65 | caja con rayas gruesas que se afinan, eco rosa, "|||", ↑↓, paneo lineal a la izq. | `pop.stripes` |
| 49,25 | glitch de bloques sobre negro (3 cuadros) | `fx: "glitch"` / `pop.glitch` |
| 49,35 | parpadeo de paleta 6 cuadros + letras que faltan, letras rayadas, ★★★, tiras glitch arriba | `pop.hatch` (`fx: "flicker"`) |
| 49,85 / 50,4 | texto isométrico chico → grande sobre foto/triángulo, color partido por región, deriva diagonal, esquina que se escribe | `pop.kanji` (`split`) |
| 50,98 / 51,45 | cortina líquida, renglones que entran aplastados uno cada 2 cuadros, cruz + pentágono que crecen, flash rosa, re-encuadre con eco/glitch/círculo-cruz/chevrones | `pop.stack` (`fx:"liquid"`, `phase2`); modo LETRA con `text:""` |
| 51,95 | tríptico, contorno gigante que se dibuja, letras en ola que rebotan, foto que se desliza, rótulo glitch | `pop.split` |
| 52,52 | desenfoque→foco, paralelogramo grueso que rota/crece/afina, esquinas en triángulo, ecos en contorno | `pop.frame` |
| 53,05 | letras gigantes con foto / op-art animado, bordes suaves, etiqueta con borde dentado | `pop.letters` |
| 53,59 | negro → banda de rayas → foto en doble exposición que se abre, texto que cambia de color | `pop.band` |
| 54,12 | flecha que entra en 4 cuadros con parpadeo de color, rótulo que se decodifica | `pop.arrow` |
| 54,65 / 54,75 | esquirlas violeta/menta → círculos-foto en los bordes + flecha, ×, flechitas, regla | `pop.duo` (`fx:"shards"`) |
| 55,26–56,36 | columna que barre desde la derecha, 2ª columna + paneo, alejamiento al 35 %, arcos grises que giran, ◄ | `pop.posters` (`p2`, `p3`) |
| 56,85 | ◄ que crece en 4 cuadros a triángulo con foto | `pop.triangle` |
| 57,4 | libro isométrico, tapa con foto que se desplaza, sombra rosada, deriva/achica, cambio de tapa | `pop.book` (`swapAt`) |
| 60,16 / 60,6 | marca sobre violeta → mosaico de marcas con parpadeo | `pop.tiles` (y 2º tiempo de `pop.outro`) |
| 61,2 | texto chico: aparece, itálica + decodificación, se achica, parpadeo a gris | `pop.name` |
| 63,5 / 21 (B/N) | texto mínimo espaciado / línea chica con palabras en rojo | `pop.minimal` (`style`) |
| — | apertura completa (marca → objeto → título) | `pop.title` |
| — | cierre: marca → mosaico → canal + SUSCRÍBETE + @usuario → gracias/apoyo en texto mínimo | `pop.outro` |

## 4. Componentes

| componente | uso típico | params clave |
|---|---|---|
| `pop.title` | título de apertura (t = 0) | text, src, kicker, object, label, intro, objectDur, phase2 |
| `pop.logo` | apertura de marca / respiro | mark, kicker |
| `pop.kaleido` | objeto / documento como "pieza" | src, label, tag, split |
| `pop.kanji` | lugar, nombre propio, frase en otro idioma | big, sub, src, split, corner |
| `pop.word` | palabra o cifra de impacto sobre foto | text, small, src, tone |
| `pop.hatch` | año / palabra clímax con glitch | text, src, hatch, stars |
| `pop.stack` | título apilado o momento LETRA (`text:""`) | text, src, tone, shapes, phase2 |
| `pop.letters` | cifra/sigla de 2–3 caracteres | text, src, tag |
| `pop.band` | frase que irrumpe desde negro | text, src |
| `pop.arrow` | consecuencia, "entonces…" | text |
| `pop.minimal` | pausa, cita breve, dato aireado | text, kicker, style, accent, bg |
| `pop.circles` | persona/lugar + palabra | text, src |
| `pop.stripes` | documento / objeto en caja | text, src |
| `pop.split` | persona con rol (tríptico) | text, src, src2, tag, outline |
| `pop.frame` | lugar / nombre con subtítulo | text, sub, src |
| `pop.duo` | comparación, multitud, antes/después | src, src2, text, kicker |
| `pop.posters` | dos caras de algo, galería | src, text, src2, text2, caption, p2, p3 |
| `pop.triangle` | persona/lugar con revelado | src, src2, text, caption, tone |
| `pop.book` | documento, libro, "la historia cuenta" | src, title, note, swapAt, mark |
| `pop.tiles` | marca / transición de cierre | mark, solo |
| `pop.name` | fecha, nombre, dominio | text, sub, size |
| `pop.glitch` (overlay) | golpe de transición sobre cualquier plano | kind |
| `pop.outro` | cierre (lo agrega el motor) | thanks, channel, cta, support, handle, mark |

Todos los planos aceptan `fx` (`cut`, `glitch`, `flicker`, `shards`, `liquid`) y los de foto `focus`.

## 5. Qué quedó igual y qué difiere (y por qué)

**Igual:** paleta medida, duotono por mapa de gradiente, grotesca extendida pesada, cortes secos con
transiciones de entrada, y la coreografía cuadro a cuadro de cada plano de la tabla 3 (tiempos medidos
a 30 fps sobre la referencia).

**Difiere:**
- **Duración de los planos:** la referencia corta cada 0,53 s; la narración necesita 2–4 s por idea.
  Cada componente reproduce la entrada a la velocidad original y después mantiene una deriva lenta
  (Ken Burns, paneo, giro de arcos); varios tienen FASES internas (`split`, `phase2`, `p2/p3`) que
  agregan cortes dentro del beat para acercarse al ritmo. El storyboard de la demo parte los beats
  largos (59 beats, 3,7 s/plano promedio).
- **Objeto 3D y libro:** la referencia usa render 3D; acá son 2D procedurales (blob con la foto y
  sombreado esférico; libro con proyección afín medida sobre el cuadro 58,3 s). El libro no gira.
- **Logo de Envato / dominio / textos en inglés:** reemplazados por la marca propia (gota geométrica o
  monograma), el nombre del canal y textos del tema.
- **Subtítulos:** la referencia no tiene; se agregaron en una tira violeta paralelogramo con Archivo
  extendida menta (mismo lenguaje que la etiqueta "YOU'LL NEVER FORGET"); se ocultan en título,
  modo LETRA y cierre.
- **Contraste:** con fotos muy claras (papel, cielo) el duotono queda casi todo menta y el texto menta
  se pierde. Por eso `tone` (dark por defecto en planos con texto sobre foto) y un velo violeta suave
  dentro del marco de `pop.frame`. Elegir fotos con zonas oscuras para texto encima.
- **Grano** generado (4 lienzos de ruido sembrados, alternados por cuadro), no copiado.
- **Motor:** no se tocó. La "cámara" y las transiciones se resuelven dentro de cada componente
  (todo en `ctx.g.main`; los efectos de entrada copian `layers.main` en `ctx.g.top`).
  `check` exige que el primer beat sea `*.title` → existe `pop.title`.

## 6. Verificación (demo `explainer-videos/pop-demo`)
- `kit.py check pop-demo`: sin anclas faltantes ni huecos; solo "componente desconocido" (el diseño
  aún no está en `designs/index.json` / `catalog.json`) y avisos justificados: fotos repetidas (pedido
  del usuario: 7 fotos reutilizadas con otro encuadre/tono) y "0 common.lyric" (los momentos de letra
  grande son `pop.stack` con `text:""`: 4 en la demo).
- `kit.py sheet pop-demo --orient both` → `work/sheet-16x9.png`, `work/sheet-9x16.png`; consola sin
  warnings `[kit]` ni errores (solo el 404 del favicon que pide el navegador).
- Todo es función de `lt`/`t` (sin `Math.random`, `Date.now` ni animaciones CSS): `seek(t)` determinista.

## 7. Intros y cierre

Contrato común en `designs/common/hook.js` (mismos parámetros de fondo y tiempos en todos los
diseños). Código en `components/intros.js` (intros + fondos, expuestos en `Kit.pop.hook`) y
`components/outro.js`. Las dos intros: `layer: "main"`, `post: 0.6` (salida propia: las tiras se
deslizan a la izquierda y se apagan), ocultan subtítulos. Todo es función de `lt`.

### `pop.introv1` · gancho "golpe"
Titular GIGANTE apilado en **tiras violeta** (paralelogramo con barrido de sierra y sombra rayada).
Cada palabra entra **aplastada en rosa** (2 cuadros) → **rebanada en bloques glitch** (2 cuadros) →
se asienta en menta con rebote y sacudida. La `^palabra^` va en **caja menta con op-art animado
dentro de las letras** (con `bg:"image"`, la foto en duotono). En 9:16 los renglones largos se
reparten (≤ 9 letras) y se usa Archivo de ancho normal para que el titular sea más grande.
**Impacto** (`glitchAt`): 3 cuadros de bloques glitch + 6 de parpadeo de paleta sobre todo el cuadro,
sombra rosa que salta detrás de las tiras, anillos menta y triángulos ►◄ que apuntan al titular.

| param | default | |
|---|---|---|
| `text` | (requerido) | `\n` = renglón; `^x^` = palabra destacada; un signo pegado (`^MURO^?`) no se separa |
| `kicker` / `sub` | "" | rótulo que se decodifica arriba / placa menta abajo (+ `×××` rosas) |
| `wordAt` / `stagger` | 0.4 / 0.28 | primer golpe / segundos entre palabras |
| `glitchAt` | 2.3 | segundo del impacto (`-1` = sin impacto; acepta `@palabra`) |
| `bg` … `dim` | auto = `columns` | ver fondos |

### `pop.introv2` · gancho "pregunta + revelación"
Una **cortina líquida violeta** baja y queda como panel inclinado (izquierda en 16:9, arriba en 9:16).
La pregunta se **decodifica** letra por letra (letra al azar en rosa 3 cuadros → menta) con cursor rosa.
En `stampAt` la respuesta golpea como **CINTA menta inclinada** (barrido de sierra, escala, sombra rosa,
puntas rayadas) con glitch de bloques, flecha gruesa que entra parpadeando y anillos; la pregunta pierde
letras un instante. Params: `text`, `kicker`, `stamp`, `stampAt` (acepta `@palabra`), `typeAt`, `cps`,
fondo (auto = `opart`).

### Fondos propios (neutros, animados)
| preset | qué es |
|---|---|
| `columns` | columnas de mosaicos (rayado, op-art, círculo con punto rosa que orbita, medio sol, kanji, cruz, triángulo; la foto de `src` si hay) que entran barriendo y se deslizan en sentidos opuestos, arcos grises que giran |
| `opart` | ondas op-art del duotono que se deforman a pantalla completa + anillos punteados que giran, cruces en las esquinas |
| `shapes` | círculo violeta que crece y respira, triángulo rosa que gira, barrido de rayas cada 2,6 s, fila de flechas, cruces que parpadean |
| `kanji` | violeta con renglones de kanji (時代 記憶 世界 歴史 未来) en diagonal isométrica que derivan; triángulo menta que crece y cambia el color del texto |
| `tiles` | mosaico de marcas del canal con filas desfasadas y cuadros que parpadean en rosa (default del cierre) |

Más los modos del contrato: `image` (foto en `src`, en **duotono oscuro** + velo violeta), `component`
(`use`/`useParams`; si no trae foto recibe `src`) y `none`. Legibilidad: el texto SIEMPRE va sobre
placas propias (tiras violeta, cinta/placas menta), más un velo violeta detrás del titular y `dim`.

### `pop.outro` · cierre del canal (sin recuadro)
Orden fijo: **GRACIAS POR VER** (rótulo que se decodifica) → **canal** gigante en tira violeta, letras
que caen aplastadas en rosa y se asientan (una parpadea rosa) → **LIKE**: botón menta con sombra dura que
se **presiona** (se hunde, se invierte a violeta y estalla en rayos) → **flecha** gruesa que crece
parpadeando (si `arrow`) → **SUSCRÍBETE** en placa rosa que golpea con sacudida + **campana** en insignia
que suena → **apoyo** en tiras violeta con letras en cascada → **handle** en placa menta que se decodifica
con subrayado rosa. Layout propio en 16:9 (fila horizontal) y 9:16 (columna que ocupa toda la altura).
Params: `Kit.hook.outroParams` (`thanks`, `channel`, `cta`, `support`, `handle`, `arrow`, `likeAt`,
`subscribeAt`, `bellAt`, `supportAt`), fondos `tiles | columns | opart | shapes | kanji | image |
component | none`, `dim` 0.66. Tiempos con `Kit.hook.outroTimes`; fundido en los últimos 0,4 s.

### Ejemplos
```json
{ "t": 0, "use": "pop.introv1", "until": "Casi las 7",
  "params": { "text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 nov 1989",
              "sub": "la noche que nadie vio venir", "glitchAt": "@1989" } }

{ "t": 0, "use": "pop.introv1",
  "params": { "text": "EL PRECIO\nDE LA ^LIBERTAD^", "bg": "image", "src": "assets/media/muro-gente.jpg", "focus": [0.5, 0.4] } }

{ "t": 0, "use": "pop.introv2",
  "params": { "text": "¿QUIÉN MANDA\nEN EL MUNDO?", "stamp": "NADIE LO SABE", "stampAt": "@nadie",
              "bg": "component", "use": "pop.letters", "useParams": { "text": "89" }, "src": "assets/media/muro-gente.jpg" } }

{ "use": "pop.outro", "params": { "bg": "shapes", "likeAt": 5.16, "subscribeAt": 5.54, "bellAt": 7.84, "supportAt": 8.94 } }
```
En el demo (`pop-demo`) el gancho dura hasta "Casi las 7" y un `pop.hatch` "19:00" cubre hasta "Un
funcionario lee" (antes lo cubría `pop.title`); `_alt` guarda la variante `pop.introv2`.

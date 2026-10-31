# Diseño `memorias` · canal **MEMORIAS** (nombre provisional)

> Historia en acuarela: cada lugar nace como boceto a lápiz, se colorea por manchas de tinta y
> revienta una salpicadura de acuarela.

Réplica de la referencia `sandbox/referencias/nodehistory/minimalist-bedroom-decor/`
(105 s, 1280×720, 25 fps; plantilla de Envato "Historical Memories · Watercolor Ink Slideshow").
Recursos tomados de `acuarela` (TINTA: máscaras de tinta por umbral de ruido fractal) y `carta`
(revelado de fotos por manchas). El runtime es propio (`_memorias.js`): NO se carga el de acuarela.

## Análisis de la referencia (segundos)

| t (s) | escena |
|---|---|
| 0–3 | boceto a lápiz de un caballero a la derecha + "Baburka video / motion graphics" (manuscrita + sans) arriba a la izquierda → `memorias.title` layout `side` |
| 3–7 | humo/papel → boceto del piloto + "Only on Videohive / presents a new project" → `title side` |
| 7–14 | "Historical Memories" manuscrita grande + "Watercolor Ink Slideshow" (sans geométrica) al centro; boceto del Coliseo arriba a la derecha y ruinas abajo a la izquierda → `title center` |
| 14–15,5 | corte: destello frío azulado + humo gris que barre |
| 15–21 | Pisa: el baptisterio queda en boceto a la izquierda; la catedral se colorea por manchas; salpicadura azul en el cielo con gotas; titular serif fantasma "near up doubtful such this far." arriba; recorte de periódico; texto abajo-izq. "FIRST INFORMATION / SECOND INFORMATION" → `scene reveal=right pos=bl` |
| 21–27 | Erecteión: gran aguada azul a la izquierda, texto abajo-der. (manuscrita + 2 mayúsculas) → `scene pos=br splash=l` |
| 27–33 | ángel: color completo, manchas negras a la derecha, texto arriba-izq. alternado manuscrita/MAYÚS → `scene pos=tl kicker2` |
| 33–38 | velero, aguada azul detrás, texto arriba-der. |
| 38–44 | fuente/estatua (sepia) |
| 44–50 | molino, cielo pintado de azul (aguada grande) → `splashSize 0.5–0.7` |
| 50–58 | Big Ben, Taj Mahal (aguada azul enorme), texto arriba-der. de 4 renglones |
| 58–66 | jefe indio y caballero en B/N con manchas de tinta NEGRA opacas → `tone=bw` |
| 66–72 | piloto B/N con humo gris |
| 72–83 | Stonehenge, Coliseo (color) |
| 83–92 | vuelve la portada "Historical Memories" |
| 92–105 | mancha negra que traga el cuadro → tarjeta negra: "Historical Memories" (sans fina) / "Envato Market" (manuscrita blanca grande) / 2 renglones / © abajo; humo claro arriba a la derecha |

### Identidad
- Papel/yeso gris cálido `#d8d5cf` (centro `#ebe8e2`) con moteado, manchas de humedad y grietas finas; viñeta oscura en esquinas sobre TODO.
- Boceto = la misma foto en "esquisse" (gris ÷ gris invertido desenfocado, color-dodge), multiplicado sobre el papel.
- Color: foto saturada, revelada por manchas de borde granulado; zonas que quedan en boceto.
- Salpicadura azul `#2f5a9c`/`#1d3d72` en multiplicar (pinta el cielo), puntas finas y gotas; en B/N tinta negra opaca.
- Texto: manuscrita (≈ Mr Dafoe) + MAYÚSCULAS DIN bold (≈ Barlow 700) que se arman letra a letra con glifos al azar; subtítulos de portada en Quicksand 700; fantasmas en Old Standard TT.
- Movimiento: zoom lento (≈7 %) durante el plano; corte = humo gris que barre de izq. a der. + destello frío + arrastre horizontal del plano que sale.

## Cortes y tiempos (medidos cuadro a cuadro, diferencia media entre cuadros a 10 fps)

Cortes de la referencia en ≈15,0 · 20,3 · 25,2 · 31 · 37,3 · 42,2 · 47,4 · 53 · 59,2 · 64,3 · 69,2 · 75 · 81,3 · 86,3 · 93,7 s
(un plano cada ≈5–6 s). Hay DOS tipos de corte, y el diseño replica los dos:

| corte | referencia | implementación |
|---|---|---|
| **lavado** (`cut: "wash"`, la mayoría) | velero → fuente (37,3): el plano se borra con una mancha de papel blanco en ≈0,5 s mientras ya asoma el boceto del siguiente; destello frío suave | máscara `eraser` (fieldBlot desde una esquina de abajo) con `destination-out` sobre la capa del plano, de dur−0,15 a dur+0,5; humo claro + destello `palette.flash` en `post()` |
| **barrido** (`cut: "whip"`, ≈1 de cada 3) | piloto → Stonehenge (73,9–77), Big Ben → Taj (51,9–54,8): el plano sale disparado a la izquierda con estela (≈0,5 s), ≈1 s de papel con manchas de tinta gris estiradas, el siguiente entra desde la derecha con estela y frena (≈1 s) | `blit()` con 6 copias desplazadas (desenfoque de movimiento), `F.blots` estirados en `post()`; el plano entrante arranca 0,55 s tarde y llega ya coloreándose |

`cut: "auto"` = barrido cada 3 escenas (como la referencia); se puede forzar por plano.

Construcción del plano (s desde el corte): boceto visible al cortar (0–1,0) · color que florece por manchas
0,35 → 2,3 · salpicadura 1,6 (+gotas) · lavado de papel + texto 1,8 (manuscrita que se escribe, mayúsculas letra a
letra) · el texto se va 0,45 s ANTES del corte · zoom lento 7 % durante todo el plano. En planos cortos todo se
comprime con `k = clamp(dur/5, 0.55, 1)`.

Cada plano se dibuja en su propia capa (canvas del tamaño del cuadro): así el lavado y el barrido mueven el plano
ENTERO (boceto, periódico fantasma, foto, salpicadura y texto).

## Componentes

| componente | estado | params clave |
|---|---|---|
| `memorias.title` | ✓ 16:9 y 9:16 | title, sub, src, src2, layout (center/side), focus, focus2, titlePortrait |
| `memorias.scene` | ✓ 16:9 y 9:16 (color y bw), cortes wash/whip probados en la demo | src, kicker, text, kicker2, pos (bl/tl/tr/br), tone (color/bw), reveal (full/right/left/center/bottom/none), splash, splashSize, splashColor, focus, ghost, drift, cut (auto/wash/whip) |
| `memorias.introv1` | ✓ 16:9 y 9:16 | text (^marca^), kicker, sub, wordAt, stagger, dropAt + fondo común (bg sketch/smoke/image/component/none, src, focus, use, useParams, dim) |
| `memorias.introv2` | ✓ 16:9 y 9:16 | text, kicker, stamp, stampAt, typeAt, cps + fondo común |
| `memorias.outro` | ✓ 16:9 y 9:16 | outroParams + bg (ink/paper/image/component/none), dim |

Archivos: `components/_memorias.js` (papel, ruido, máscaras, boceto, `makeSplash`, `textBlock`, periódico
fantasma, cortes `cutType`, `post()` con humo/tinta de corte + viñeta + grano, `Kit.memorias.scene`),
`components/scenes.js`, `components/intros.js`, `components/outro.js`.

Registro hecho: `designs/index.json`, `showcase/designs.json`, `showcase/stage.html` (lista `ids`), `CATALOG.md`
(`kit.py catalog`), muestras `showcase/samples/brandenburgo.jpg` y `bernauer.jpg` (+ CREDITS).
Pendiente con OK del usuario: sumar `memorias` a `niches.json → categories.node_history.designs`.

## Demo `sandbox/nodehistory/memorias-demo/`

Mismo guion/voz del Muro (anclas de `nodehistory/acuarela-demo`), 6 fotos a color de Berlín (Commons, CC BY / BY-SA)
+ 7 fotos B/N del Muro. Orden de la referencia: `title side` → plano → `title center` → escenas alternando esquina del
texto, zona coloreada y aguadas grandes en fotos con cielo; B/N con tinta negra → `title center` final → cierre.
`kit.py check`: **0 errores**. Avisos "tres memorias.scene seguidos": esperables (la referencia es UN solo tipo
de plano repetido con variaciones). Hojas `work/sheet-16x9.png` y `sheet-9x16.png` revisadas.

## REGLA para cualquier agente (Codex incluido) que toque este diseño

**Tiene que quedar COMO EL VIDEO de referencia. No se inventa nada.** Antes de cambiar o agregar algo:
1. Mirar la referencia en ese segundo (`ffmpeg -ss <t> -t 3 -i <ref> -vf fps=10,scale=320:-1,tile=6x4 …`) y anotarlo acá.
2. Solo se replica lo que se ve: tipografía, color, tamaños, posiciones, tiempos y movimientos medidos. Nada de
   efectos, colores, iconos, marcos ni animaciones "propias" que la referencia no tenga.
3. Lo único permitido fuera de la referencia: subtítulos (la narración los necesita) y el contrato común de
   intros/cierre (designs/common/hook.js), siempre con el lenguaje visual de la referencia.
4. Comparar con capturas lado a lado antes de dar algo por terminado.

## Qué difiere de la referencia (y por qué)
- Las tintas de la referencia son videos de tinta filmada; acá son campos de ruido procedurales (sin copiar
  material de la plantilla de Envato).
- Tipografías: Mr Dafoe / Barlow / Quicksand / Old Standard TT son las Google Fonts más cercanas.
- La referencia no tiene subtítulos; acá quedan (Quicksand con halo de papel, palabra actual en azul).

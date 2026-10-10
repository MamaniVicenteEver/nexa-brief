# grunge · «CRUDO» — títulos de tinta raída, un color plano por palabra

Réplica del estilo del video de referencia
`sandbox/otros/From Klickpin.com- Steal these 31 Dreamy capsule wardrobe ideas … anyo.mp4`
(59,7 s · 960×540 · 30 fps · sin voz, solo música).

## Análisis de la referencia

### Estructura (medida cuadro a cuadro)

El video es **un solo bloque de 10 s repetido 6 veces**, una palabra por bloque, cada bloque
con su color plano: `RIPPED` (crema) 0–10 s · `DIRT` (mostaza) 10–20 · `MARGINAL` (menta) 20–30 ·
`PIRATE` (coral) 30–40 · `GRUNGE` (petróleo) 40–50 · `PUNK` (rosa) 50–60.
Cada bloque tiene tres fases, siempre con corte seco (no hay fundidos entre bloques ni entre fases):

| Fase | Tiempo dentro del bloque | Qué pasa |
|---|---|---|
| **A · primer plano** | 0,0 – 3,0 s | Las 2 primeras letras GIGANTES (alto de letra ≈ 98 % del cuadro, cortadas arriba/abajo, la 3ª asoma por la derecha). 0,0–0,25 fondo liso; 0,27–0,57 las letras **se materializan por salpicaduras** (motas cada vez más densas, 3–4 pasos stop-motion). Luego **cambios de textura stop-motion** cada 0,15–0,4 s: (a) letra oscura con motas claras sobre fondo oscuro, (b) negativo: fondo de color y letra en tono medio con motas oscuras (a veces ESPEJADO, p. ej. MARGINAL 21,07–21,30 s: `ИAM` sobre granate), (c) letra de color con rayones verticales tipo madera. 2,4–2,6 doble exposición hacia las letras siguientes (`PP`), 2,9 otra vez letras siguientes. |
| **B · palabra entera** | 3,0 – 5,3 s | La palabra completa a todo el ancho (≈ 102 %, los bordes se cortan), centrada, cada letra con una textura distinta (raída, rayada, oxidada). +0,13–0,6 s **negativo** (fondo de color, letras oscuras) que en RIPPED va **volteado vertical** y en DIRT tiene un **golpe de zoom 1,3×** a +0,33 s. Al volver al oscuro, la palabra queda **atenuada ≈ 55 %**. +0,8 un cuadro con una **franja de brochazo** clara sobre la mitad baja. +1,27–1,4 la palabra **se erosiona de izquierda a derecha en 4 cuadros** (manchas que se comen las letras) y solo queda la última letra, que tiembla y se apaga hasta el corte. |
| **C · brochazo** | 5,3 – 10,0 s | Corte a **fondo de color plano** con textura de suciedad fija (marco de película: línea de perforación punteada a x≈2,5 %, raya vertical gruesa a x≈3,5 %, esquina punteada arriba a la izquierda, rayas verticales a la derecha, una grieta diagonal fina, motas, anillos, una mancha clara redonda y una salpicadura a la derecha del centro). +0,13 aparece una **mancha de rodillo** horizontal (franja fina) a la altura de la palabra; +0,27 la palabra en tinta oscura aparece **rasgada en franjas horizontales**: la mitad inferior desplazada a la derecha ≈ 8 % del ancho, que se reacomoda en pasos stop-motion hasta +0,9; +0,45–0,6 **negativo** (fondo oscuro, palabra de color) 5 cuadros; +1,4 **brochazo ancho** (franja de 0,32H a 0,78H) pintado detrás de la palabra, borde superior con línea oscura ondulada; +2,3 otro negativo de 2 cuadros; +3,3 chorreones verticales 2 cuadros; +3,4 la textura del brochazo cambia; +3,9 **estallido de salpicaduras** (crece en 3 pasos) que queda hasta el corte. La palabra queda a la izquierda (x≈11 %), alto de letra ≈ 0,23H, centrada en 0,5H, las últimas letras más transparentes y con «fantasma» por debajo. |

Polaridad: los bloques alternan **oscuro-primero** (A y B sobre casi negro, C sobre color: RIPPED, DIRT,
PIRATE, GRUNGE) y **color-primero** (A y B sobre color, C sobre oscuro con la palabra de color:
MARGINAL, PUNK). Patrón D, D, L, D, D, L.

### Colores (muestreados con PIL)

| Uso | Hex |
|---|---|
| Casi negro cálido (fondo oscuro) | `#1a1211` (muestras `#181010`–`#1c1410`) |
| Granate (oscuro de la escena menta) | `#43201a` (muestra `#442018`) |
| Crema (RIPPED) | `#f0e8d8` · tinta azul pizarra `#5f7f8a` |
| Mostaza (DIRT) | `#f4a02c` |
| Menta (MARGINAL) | `#26a676` (muestras `#24a474`, `#20a070`) |
| Coral (PIRATE) | `#fb4b43` (muestras `#fc4c44`, `#f84840`) |
| Petróleo (GRUNGE) | `#18738f` (muestras `#187490`, `#187090`) |
| Rosa (PUNK) | `#ef7888` (muestras `#f07888`, `#e87888`) |

### Tipografía

Sans geométrica de palo seco, **peso Black**, mayúsculas, tracking normal/ajustado (R de pata recta,
P y D de panza redonda, G con espolón): la Google Font más parecida es **Montserrat 900**.
Tamaños relativos al alto del cuadro: primer plano alto de letra ≈ 0,98H; palabra entera = ancho
del cuadro (alto de letra ≈ 0,33H en palabras de 6 letras, ≈ 0,5H en DIRT); brochazo alto ≈ 0,23H.
No hay ningún otro texto en la referencia.

### Movimiento y ritmo

- No hay cámara que se mueva de forma continua: todo es **stop-motion**: texturas que «hierven»
  (la suciedad tiembla 1 px a ~12 fps), cambios de textura cada 0,15–0,4 s y cortes secos.
- Golpes: negativos de 2–5 cuadros (a veces espejados/volteados), un golpe de zoom 1,3× (DIRT).
- Entradas: materializar por salpicaduras (A), corte seco (B), rasgado horizontal que se
  reacomoda (C). Salidas: erosión de izquierda a derecha (B), corte seco (A y C).
- Grano fino y parpadeo de luminancia muy leve en todo el video.

## Identidad del diseño

**CRUDO** (nombre provisional en `design.json`): historias contadas a golpe de tinta. Cada plano es
UNA palabra clave del guion, en un color plano saturado, con cortes secos y texturas que hierven.
Sirve para temas de rebeldía, protestas, música, cultura urbana y momentos de quiebre.

- **Paleta** (en `Kit.grunge.COLORS`; el orden de rotación sale de `defaults.grunge.colors`):
  crema `#f0e8d8` · mostaza `#f4a02c` · menta `#26a676` · coral `#fb4b43` · petróleo `#18738f` ·
  rosa `#ef7888`; oscuros `#1a1211` (casi negro cálido), `#43201a` (granate, escena menta),
  `#18201a` (coral), `#1c1410` (rosa). Cada color trae su medio tono de tinta (`tone`).
- **Tipografía:** Montserrat 900 (palabras), 800 (rótulos chicos y subtítulos, mayúsculas con
  tracking 0,2 em). Alto de mayúscula = 0,70 em (lo usa todo el layout).
- **Subtítulos:** Montserrat 800 en mayúsculas sobre una tira casi negra de bordes irregulares;
  la palabra actual en el color de la escena (`--gr-accent`, lo actualiza el runtime).
- **Texturas** (todas generadas en `_grunge.js` con rng sembrado, a media resolución, blancas y
  teñidas con caché LRU): suciedad de película fija (perforación, raya gruesa, esquinas punteadas,
  grietas, motas, anillos), motas densas en 3 etapas (materializar), rayones verticales, agujeros
  (letras raídas), brochazo de rodillo (2 variantes, borde superior ondulado), grano (4 baldosas).
- **Runtime de familia** (`Kit.family("grunge")`): fondo de respaldo, golpes `grunge.flip`
  desde el storyboard, y en `post()`: negativos/espejos/zoom pedidos por los componentes
  (`GR.fx`), grano a 24 fps, parpadeo de luminancia, viñeta y color de acento de subtítulos.

## Catálogo de movimientos replicados (segundo de la referencia)

| Movimiento | Referencia | Dónde está |
|---|---|---|
| Fondo liso → letras que se materializan por salpicaduras (3 pasos) | 0,0–0,57 · 20,13–20,6 | fase A (`closeup`, variante `r`) |
| Cambios de textura stop-motion en el primer plano (a/b/c) con encuadre corrido | 0,57–3,0 · 11,2–13,0 | fase A, tabla `EV_A` |
| Negativo espejado del primer plano | 21,07–21,30 | fase A variante `b` (`GR.fx neg+flipX`) |
| Doble exposición hacia las letras siguientes | 2,4–2,6 | fase A variante `dx` |
| Corte a la palabra entera a todo el ancho, letras con texturas distintas | 3,0 · 13,0 | fase B |
| Negativo volteado (vertical/espejo) | 3,1–3,5 | fase B +0,13–0,33 |
| Golpe de zoom 1,3× en negativo | 13,33–13,6 | fase B +0,33–0,6 |
| Atenuado ≈ 55 % tras el negativo | 13,67 | fase B |
| Cuadro suelto con franja de brochazo clara | 3,7 · 13,8 | fase B +0,8 |
| Erosión izquierda→derecha en 4 cuadros, queda la última letra temblando | 4,3 · 14,27–14,4 | fase B (`GR.erosion`) |
| Corte a color plano con suciedad de película fija y salpicadura a la derecha | 5,3 · 15,4 | fase C |
| Mancha de rodillo fina antes de la palabra | 5,53 · 15,5 | fase C +0,13 |
| Palabra rasgada en franjas (mitad baja corrida) que se reacomoda en pasos | 5,6–6,2 · 15,57–16,0 | fase C (`GR.tear`) |
| Doble impresión/fantasma por debajo | 5,7–6,0 | fase C |
| Negativo de 5 cuadros al asentarse | 5,87–6,03 · 15,83–16,0 | fase C |
| Brochazo ancho pintado detrás (borde ondulado oscuro) | 6,7 · 17,2 | fase C `tBand` |
| Negativo corto a mitad del plano | 7,6 · 18,0 | fase C 0,49·L |
| Chorreones verticales (2 cuadros) | 8,6 | fase C 0,7·L |
| Cambio de textura del brochazo | 8,7 | fase C 0,72·L |
| Estallido de salpicaduras en 3 pasos, hasta el corte | 9,2–10 | fase C `tSpl` |
| Últimas letras más transparentes | todo C | `fadeRight` |
| Suciedad que tiembla 1 px, grano, parpadeo | todo | runtime |

Los tiempos internos son los medidos (bloque de 10 s: A 3 s, B 2,3 s, C 4,7 s) y se escalan con la
duración del beat; los golpes de 2–5 cuadros conservan su duración absoluta.

## Componentes

| Componente | Capa | Para qué |
|---|---|---|
| `grunge.title` | main | Apertura / frase final: escena completa (A→B→C) siempre, rótulo chico |
| `grunge.word` | main | LA escena del estilo, una palabra clave; reparte fases según la duración (≥4,2 s: A+B+C; ≥2,4 s: B+C; si no, C) |
| `grunge.closeup` | main | Solo fase A (primer plano gigante) |
| `grunge.slam` | main | Solo fase B (palabra a todo el ancho, negativo, zoom, erosión) |
| `grunge.brush` | main | Solo fase C (brochazo, rasgado, salpicaduras) |
| `grunge.photo` | main | Foto en duotono con el mismo lenguaje: primer plano 2,4× → foto entera → foto pintada en el brochazo con título rasgado |
| `grunge.stamp` | main | Frase narrada: cada palabra dicha = un corte a la palabra entera, fondo alterno; las clave con brochazo y negativo |
| `grunge.flip` | overlay | Golpe de negativo (opcional espejo/volteo/zoom) de 2–5 cuadros sobre lo que haya |
| `grunge.introv1` | main | Gancho "golpe": titular gigante palabra por palabra (ver «Intros y cierre») |
| `grunge.introv2` | main | Gancho "pregunta + brochazo-respuesta" (ver «Intros y cierre») |
| `grunge.outro` | main | Cierre del canal sin recuadro (ver «Intros y cierre») |

API para componentes nuevos: `Kit.grunge` (`scene`, `layout`, `ink`, `put`, `tear`, `grime`, `band`,
`splats`, `erosion`, `fx`, `tint`…) y `Kit.grunge.phase` (`closeup`, `slam`, `brush`, `sequence`).

## Qué quedó igual y qué difiere

**Igual:** estructura de 3 fases por palabra con cortes secos, tiempos internos medidos, colores
muestreados y su rotación, polaridad alterna D-D-L, tamaños/posiciones (primer plano 0,98H,
palabra entera al ancho, brochazo a x≈11 % con alto 0,23H), negativos volteados y golpe de zoom,
erosión que deja la última letra, rasgado que se reacomoda, brochazo con borde ondulado,
suciedad de película con perforación, salpicaduras al final, grano y temblor stop-motion.

**Difiere (y por qué):**
- Texturas **procedurales** (no se copian los escaneos de la referencia): las motas y los
  rayones son más regulares que las texturas fotográficas de tinta/óxido del original.
- La tipografía original es una geométrica Black comercial; Montserrat 900 es la Google Font
  más cercana (la R y la G difieren un poco).
- La referencia dura 10 s por palabra; con narración los planos duran 2–8 s, así que las fases
  se comprimen (y en beats cortos se omite el primer plano). El ritmo de cortes queda más rápido.
- Agregados que la referencia no tiene, necesarios para un explicativo: rótulo chico (`note`),
  fotos en duotono (`grunge.photo`), frases palabra-por-palabra (`grunge.stamp`), subtítulos y
  cierre de marca. Todos usan el mismo lenguaje (cortes, negativos, brochazo, salpicaduras).
- 9:16: primer plano limitado por el ancho (2 letras al 82 % del ancho), palabra entera con alto
  máx. 0,3H, brochazo a x 8 % y alto ≤ 0,13H; en fotos el título va arriba (0,2H) y la foto pintada
  debajo. Mismo estilo, apilado vertical.
- Limitación del motor: no hay capa de post-proceso global, así que el negativo/espejo se hace en
  `post()` de la familia releyendo `ctx.layers.main` (getImageData + LUT de 2 tintas): solo se
  paga en los cuadros de golpe.

## Verificación (2026-10-08)

- `kit.py check grunge-demo`: 0 errores de anclas/duraciones (solo «componente desconocido», porque el
  diseño aún no está en `catalog.json`). Avisos aceptados: fotos reutilizadas 2 veces (pedido del
  usuario: 7 fotos para todo el video), «tres grunge.word seguidos» (es el estilo: una palabra tras
  otra, cambiando de color en cada corte) y «0 common.lyric» (se usa `grunge.stamp`).
- Determinismo: los mismos instantes buscados en distinto orden dan capturas idénticas (md5).
- Consola: sin warnings del diseño; el único 404 es `config.json` (el motor prueba primero
  `config.json` y después `assets/config.json`, igual en todos los videos).
- Hojas: `explainer-videos/grunge-demo/work/sheet-16x9.png` y `sheet-9x16.png`. Página de prueba:
  `explainer-videos/grunge-demo/lab.html` (`?sb=lab2-storyboard.json` para foto/frase/cierre).

## Intros y cierre (contrato común `designs/common/hook.js`)

Archivos: `components/intros.js` (introv1, introv2, fondos propios y helpers en `Kit.grunge.hook`) y
`components/outro.js`. Los tres usan los parámetros de fondo comunes: `bg` (`auto` | preset | `image` |
`component` | `none`), `src`, `focus`, `use`, `useParams`, `dim`, más `color` (color plano de la escena:
`mustard` | `mint` | `coral` | `petrol` | `pink` | `cream` | `#hex`).

| componente | qué es | params propios | `bg` auto |
|---|---|---|---|
| `grunge.introv1` | gancho "golpe": titular GIGANTE (~80 % del ancho, limitado por alto; en 9:16 se re-corta solo si la letra crece ≥15 %). Cada palabra entra 2 cuadros en negativo sobre una placa de color (el color cambia en cada palabra), escala 1,3→1,1→1 y se reacomoda rasgada en franjas; `^x^` queda pintada a rodillo en el color de la escena. **Golpe de tinta** (`inkAt`): negativo con zoom 1,1×, salpicaduras grandes, subrayado de rodillo que chorrea y aparece `sub`. Sale rasgándose en franjas. | `text`, `kicker`, `sub`, `wordAt` (0,3), `stagger` (0,3), `inkAt` (2,3; -1 = sin golpe; acepta `@palabra`), `color` (mustard) | `roller` |
| `grunge.introv2` | gancho "pregunta + revelación": la pregunta se pulveriza letra a letra (motas que se densifican en 3 cuadros, cursor de color) sobre una franja negra de rodillo; la respuesta llega como **brochazo** del color de escena pintado en 3 cuadros, con la respuesta rasgada encima, negativo espejado 1 cuadro + zoom, salpicaduras y chorreones. | `text`, `kicker`, `stamp`, `stampAt` (2,4; acepta `@palabra`), `typeAt` (0,3), `cps` (18), `color` (coral) | `film` |
| `grunge.outro` | cierre SIN recuadro, orden fijo: GRACIAS POR VER → canal gigante (motas → negativo → rasgado → rodillo de color lo pinta detrás y la tinta pasa a negro) → placa LIKE (cae en 2 cuadros; al marcarse se vuelve menta, pulgar relleno, se hunde 2 cuadros, aro a pincel y salpicaduras) → flecha a pincel (`arrow`) → brochazo coral SUSCRÍBETE (negativo) + campana que suena con ondas a pincel → apoyo palabra por palabra → `handle` tipeado y subrayado. Franjas negras de rodillo detrás de cada bloque; fundido a negro en los últimos 0,4 s. 16:9 en fila; 9:16 en escalera (LIKE arriba, SUSCRÍBETE abajo) ocupando toda la altura. | `Kit.hook.outroParams` (`thanks`, `channel`, `cta`, `support`, `handle`, `arrow`, `likeAt`, `subscribeAt`, `bellAt`, `supportAt`), `color` (mustard), `dim` 0,66 | `posters` |

**Fondos propios** (todos animados en stop-motion y temáticamente neutros; los tres componentes aceptan los cuatro):

| preset | qué se ve |
|---|---|
| `roller` | pared pintada a rodillo: pasadas de mostaza/menta/coral/petróleo/rosa (y de negro que tapan) que se pintan en 4 cuadros cada 0,4 s |
| `posters` | cartelera: afiches de color plano (barras de titular, círculo, rayas, trama) gastados y arrancados, que se pegan uno encima de otro cada 0,3 s; paneo lento |
| `film` | película: luz de fuga del color de escena, contador de cola de película que barre, rayones y perforaciones que corren a 12 fps, suciedad que hierve |
| `splatter` | salpicaduras de colores que caen en 3 pasos y chorrean; cada tanto un rodillo negro limpia una franja |

`image`: la foto se pasa a **duotono** (casi negro → color de la escena) con niveles automáticos, encuadre
cover con zoom lento, `dim` y suciedad de película encima. `component`: cualquier componente registrado
(`use` + `useParams`; si usa foto, pasarla en `src` del gancho y no en `useParams`: `src` se precarga antes del primer cuadro y el componente la recibe, mientras que una foto dentro de `useParams` llega tarde para componentes que la leen al crearse, como `grunge.photo`). Legibilidad sobre cualquier fondo: franja
negra de rodillo + degradado oscuro detrás del texto.

```json
{ "t": 0, "use": "grunge.introv1", "params": { "text": "LA NOCHE QUE\nCAYÓ EL ^MURO^", "kicker": "Berlín · 9 nov 1989", "sub": "nadie lo vio venir", "inkAt": 2.6 } }
{ "t": 0, "use": "grunge.introv1", "params": { "text": "EL PRECIO\nDE LA ^LIBERTAD^", "bg": "image", "src": "assets/media/muro-gente.jpg", "focus": [0.5, 0.4], "color": "coral" } }
{ "t": 0, "use": "grunge.introv2", "params": { "text": "¿QUIÉN MANDA\nEN EL MUNDO?", "stamp": "NADIE LO SABE", "stampAt": "@nadie", "bg": "component", "use": "grunge.photo", "src": "assets/media/leipzig.jpg", "useParams": { "phases": "slam" }, "dim": 0.5 } }
{ "t": 0, "use": "grunge.introv2", "params": { "text": "¿QUIÉN INVENTÓ\nINTERNET?", "stamp": "NO FUE UNA PERSONA", "bg": "splatter", "color": "mint" } }
```
El cierre lo agrega el motor con `config.outro` (`use: "grunge.outro"`); `likeAt`/`subscribeAt`/`bellAt`/
`supportAt` se sincronizan con la despedida narrada. Escribir `handle` sin `@` inicial. El fondo se cambia con
`"bg": "roller"` (u otro preset), `"bg": "image", "src": …` o `"bg": "component", "use": …`.
`common/outro-v1.js` sigue en `scripts` (desbloquea el audio con el primer clic).

Notas: el motor dibuja el beat siguiente encima durante la salida (`post: 0.6`); como los planos grunge pintan
toda la pantalla, en el video la salida se ve como corte seco (el estilo) y el rasgado solo se ve en la galería.


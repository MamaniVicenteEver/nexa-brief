# collage · HEMEROTECA

Documental conmemorativo hecho con **recortes de archivo**: una mesa infinita de papel de
diario donde se apilan fotos con borde blanco viradas (B/N, verde azulado, rosa, sepia),
recortes de periódico, sellos, monedas y años en serif bordó. La cámara nunca se queda
quieta: se desliza sobre el collage con paralaje y una rotación leve, y entre plano y plano
pasan hojas de libro, ráfagas de luz, barridos con desenfoque, zambullidas en titulares,
humo y cortinas de luz cálida. Todo con lente "de película": bordes desenfocados,
grade rosado con sombras verde azuladas, fugas de luz, viñeta y grano.

- id / familia: `collage` · canal provisional: **HEMEROTECA** (`youtube.com/@hemeroteca`)
- para: historia, aniversarios, conmemoraciones, países, instituciones, biografías.
- referencia replicada: `sandbox/nodehistory/_referencias/otros/great_arab_revolt__the_story (1080p).mp4`
  (120 s, 1920×1080, 25 fps; video conmemorativo del centenario de la Gran Revuelta Árabe).

## Análisis de la referencia

Medido con `ffmpeg` (corte de escena 0,2 → **un solo corte duro** en 9,12 s: todo el video es un
plano secuencia virtual sobre el collage, los "cortes" son transiciones), hojas a 1 fps y
secuencias densas a 5–10 fps alrededor de cada transición; colores muestreados con PIL.

### Estructura y ritmo
| s | qué pasa |
|---|---|
| 0–0,8 | negro |
| 0,8–2,0 | aparece un cielo nublado verde azulado oscuro (#1e2428 / #1a4150), polvo flotando |
| 1,2–1,8 | número dorado itálico pequeño ("100", ~7 % del alto) con palabras a los lados y "YEARS AGO" en versalitas debajo; entra desenfocado → nítido |
| 2,4–4,0 | bokeh rojo abajo; luz de atardecer (naranja → blanco) entra desde la derecha con estelas de nubes |
| 3,8–4,8 | **pase de hojas**: hojas de libro con texto, muy cerca de cámara y desenfocadas, barren de izquierda a derecha (~0,6 s cada una, 3 seguidas); detrás aparece el primer collage |
| 4,8–13,6 | collages sobre mapa antiguo: retrato grande, mapa con rutas rojas, lupa de bronce, jinete recortado encima (paralaje) |
| 13,6–14,3 | **ráfaga hacia adelante**: la cámara se precipita sobre el mapa con desenfoque radial y estelas, destello blanco cálido; el nuevo collage sale del destello |
| 14–17 | collage con retrato, tren, explosión; años "1916 / 1917" |
| 17,2–17,9 | **pase de hojas** otra vez |
| 17,5–21 | collage "1919 / 1920" (año grande bordó con año chico arriba), fotos viradas rosa y verde azulado |
| 21,5–22,5 | **barrido lateral**: el collage se va con desenfoque de movimiento horizontal, un avión recortado cruza muy cerca de cámara, fuga de luz rosa/magenta |
| 25,8–27,0 | **cortina de luz** rosa-magenta que inunda desde la izquierda y funde al collage siguiente; las fotos nuevas caen sobre la mesa |
| 27,4–28,2 | foto que **cambia dentro de su marco** (fundido) |
| 33,0–33,6 | **pase de hojas** |
| 36,5–38 | **banda oscura** translúcida (#2e2232 ~88 %) con titular romano en mayúsculas crema ("GLUBB PASHA FLIES HOME"), retrato chico al final de la banda; cámara en diagonal |
| 39–41,3 | página de diario: foto grande con filete, bajada, regla y titular grande; **zambullida**: la cámara entra en las letras del titular, gotas rojo oscuro desenfocadas pasan frente a cámara, aparece el siguiente |
| 50,5–51,6 | **humo**: el collage se disuelve en manchas con virado verde azulado, después luz amarilla/rosa |
| 67,0–68,2 | **mancha roja**: zona roja oscura desenfocada cruza el cuadro mientras la cámara avanza |
| 67,5–70 | homenaje: foto en óvalo que se funde con el papel, fecha y titular sobre regla, **pétalos rojos** cayendo |
| 79,5–84 | años que **cuentan** (2010 → 2011 → 2012) con fecha chica debajo |
| 85–87 | **paneles de color** apagado (violeta, verde azulado, mostaza, oliva) con titular y foto que **caen** desde cerca de cámara de a uno sobre un mapa |
| 101–108 | **cinta bordó con volutas** entre dos fotos centradas, laterales desenfocadas, estelas de fuegos artificiales |
| 108–111 | página de libro con **retratos en óvalo** (medallón), la cámara se aleja y el libro se cierra |
| 111–113 | **emblema 3D**: número "100" dorado/cobrizo que entra girando, cinta en arco con texto, libro abierto de línea |
| 113–117 | el fondo pasa a blanco, el emblema se desenfoca y desaparece, queda la **URL** (sans, óxido #831f06) |

Promedio: un collage nuevo cada 3–5 s; la cámara se mueve siempre ~4–6 % del alto por segundo.

### Paleta (muestreada; valores base antes del grade global)
| uso | hex |
|---|---|
| papel / mesa (tras grade) | #c7a095 · #cbb4af |
| papel base generado | #dccabf · claro #eee5dc |
| año (serif bordó) | #7c2b37 (muestreado #8a464e tras grade) |
| titular de diario | #5e1a22 |
| banda | rgba(46,34,50,.88) · texto #f6e8e2 |
| cinta / acento | #9e2f4f · #b13a5c · filete #ffd7e1 |
| dorado (apertura / emblema) | #8f6b2c → #f3e2ad → #d1a95a |
| cielo apertura | #0b1418 · #183844 · #2f5f6c |
| URL final | #9a4a26 |
| fugas de luz | rojo #ff5c48, naranja #ffaa6e, magenta #dc5ac8, rosa #ff78be |
| virados de foto | bw #2b2427→#efe6de · teal #17323d/#6c8d93/#e7eee8 · rose #4a1b27/#ad767b/#f6dfd8 · sepia · color desvaído · red |

### Tipografía (Google Fonts más parecidas)
- **Años**: Cormorant Garamond 600 (cifras de estilo antiguo como "1920" de la referencia), ~6,6 % del alto; año chico arriba al 46 %.
- **Banda / cinta / títulos en versalitas**: Cinzel 700 (romana tipo Trajan como "GLUBB PASHA FLIES HOME").
- **Titulares de diario**: Playfair Display 800.
- **Texto de columnas**: Old Standard TT (texto real en español tomado de la narración).
- **Número dorado de apertura**: Cormorant Garamond itálica 500.
- **URL final**: Open Sans 400.
- **Subtítulos**: Cormorant Garamond 600 crema con sombra bordó (la referencia no tiene; quedan discretos).

## Catálogo de movimientos y transiciones replicados

| nombre (`tin`) | referencia | cómo se hizo |
|---|---|---|
| `flip` pase de hojas | 3,8 · 17,2 · 33,0 · 109,8 s | 3 hojas de libro (textura generada y desenfocada) dibujadas en 22 franjas con altura creciente hacia el borde de ataque (perspectiva), sombreado por franja y sombra proyectada; el plano nuevo se revela a la izquierda de la 1.ª hoja |
| `burst` ráfaga | 13,6 s | salida: zoom ×3,4 acelerado + 4 copias radiales; entrada: destello blanco cálido + 46 estelas radiales, el plano nuevo sale con zoom 1,45→1 y desenfoque radial |
| `whip` barrido | 21,5 s | salida: cámara acelera en x (cuadrático) con 4 copias de desenfoque horizontal; entrada desde la derecha frenando; una foto recortada y desenfocada cruza muy cerca de cámara; fuga rosa |
| `leak` cortina de luz | 25,8 s | fundido con fugas magenta/rosa en modo pantalla que crecen y se van |
| `dive` zambullida | 40,4 s | salida: la cámara va al titular del plano (`focus`) con zoom ×8 y desenfoque; entrada: gotas/rombos rojo oscuro desenfocados se abren hacia cámara + destello; el plano nuevo aparece con zoom 1,15→1 |
| `smoke` humo | 50,5 s | máscara de ruido fBm (192×108) con umbral que avanza, virado verde azulado que se va, salida desenfocándose; luz amarilla/rosa al final |
| `flare` mancha roja | 67,0 s | elipse rojo oscuro desenfocada que cruza el cuadro + fuga roja, la cámara del plano saliente avanza y gira |
| `cut` | — | sin transición |

Movimientos de cámara (`move`): `left`, `right`, `up`, `down`, `in`, `out`, `diag`, `drift`, `none`
(velocidad `speed` ≈ 0,05 alto/s como la referencia; rotación de mesa ±2° + deriva ±0,6°).
Paralaje: cada elemento tiene profundidad `z` (los recortes de relleno van atrás, monedas y
fotos recortadas adelante: se mueven más y más grandes). Entradas de elementos: `slide`
(14–17 s), `drop` (paneles que caen, 85 s), `fade`, `pop` (cinta). Foto que cambia en su marco
(`swap`, 27,4 s). Año que cuenta (`yearFrom`, 79,5 s).

Lente global (post de la familia, cada cuadro): desenfoque de bordes por copia reducida +
máscara elíptica (profundidad de campo de la referencia), grade (soft-light rosa, pantalla
verde azulado oscuro que levanta sombras, multiplicar rosado), 3 fugas de luz que respiran
(roja abajo-izquierda, naranja arriba-derecha, magenta) + refuerzos de cada transición, viñeta
y grano de 4 texturas que cambian cada 1/25 s. Las fotos se viran con trama de semitono a 45°
y aberración cromática (rojo/azul desplazados) como el semitono visible en la referencia.

## Componentes

| componente | escena de la referencia | uso |
|---|---|---|
| `collage.intro` (`collage.title` es alias) | apertura | masthead NODETECH, fecha, año y titular sobre papel de archivo con reglas bordó |
| `collage.board` | el collage tipo (14–35 s, 45–60 s…) | layouts `hero`, `duo`, `trio`, `quad`, `scatter`, `strip`; año + fecha chica (+ cuenta), recorte con titular, moneda, foto que cambia |
| `collage.date` | años grandes / contador 79,5 s | cifra o fecha protagonista (cuenta desde `from`) |
| `collage.banner` | "GLUBB PASHA FLIES HOME" 36,5 s | banda oscura con titular romano |
| `collage.headline` | página de diario 39–41 s | foto + bajada + titular grande; ideal antes de `tin:"dive"` |
| `collage.map` | mapa con rutas y lupa 9–13 s | lugares, rutas rojas que se trazan, foto recortada, lupa |
| `collage.panels` | paneles de color 85–87 s | listas / comparaciones (2–4) |
| `collage.tribute` | homenaje con pétalos 67,5–70 s | víctimas, memoria |
| `collage.ribbon` | cinta con volutas 101–108 s | celebración / momento solemne |
| `collage.portraits` | retratos en medallón 108–111 s | protagonistas |
| `collage.emblem` | emblema 3D 111–113 s | cifra final / aniversario |
| `collage.leak` (overlay) | fugas de luz | golpe / énfasis |
| `collage.introv1` / `collage.introv2` | gancho de apertura | ver "Intros y cierre" |
| `collage.outro` | cierre automático | sin recuadro: canal en dorado 3D, LIKE marcado con tinta, cinta SUSCRÍBETE, campana; ver "Intros y cierre" |

Parámetros comunes de los planos-collage: `tin`, `move`, `speed`, `tilt`. Fotos: `photo`…`photo5`
(tipo image: el motor las precarga); si faltan, se repiten las anteriores con otro encuadre/zoom.
En 9:16 la composición del collage se **traspone** (gira 90°: lo que iba a lo ancho va a lo alto)
y los textos (banda, titulares, cinta, fecha) tienen posiciones propias para vertical.

## Intros y cierre

Contrato común en `designs/common/hook.js` (`bg`, `src`, `focus`, `use`, `useParams`, `dim`).
Código en `components/intros.js` (exporta los fondos y utilidades en `Kit.collage.hook`) y
`components/outro.js`. `collage.intro` (la apertura vieja, `collage.title`) sigue existiendo.

**Fondos propios (presets, temáticamente neutros):**

| preset | qué es |
|---|---|
| `table` | mesa de archivo en plano secuencia: papel de diario, recortes con titulares de la narración, fotos de borde blanco viradas, monedas neutras; paralaje por profundidad; 7 recortes/fotos **caen y se apilan** durante el plano; bokeh y fuga cálida |
| `sky` | cielo de apertura de la referencia: nubes verde azuladas que derivan, luz de atardecer que entra desde la derecha, polvo flotando, bokeh rojo |
| `map` | mapa antiguo genérico (costas, retícula, ríos, fronteras punteadas, rosa de los vientos) con rutas rojas que se trazan, alfileres con onda y lupa de bronce que lo recorre |
| `press` | pila de primeras planas: **pase de hojas** al arrancar, dos diarios que se deslizan encima, cámara que se acerca |

Más los modos del contrato: `image` (foto en `src`, virada con `photoTone`: bw, teal, rose,
sepia, color, red, con semitono), `component` (`use`/`useParams`) y `none`. Legibilidad: cada
preset trae oscurecido y viñeta; v1 pone el titular sobre la **banda oscura** del diseño,
v2 lo imprime sobre una hoja de diario clara; foto/componente usan `dim`.

### `collage.introv1` — gancho "golpe"
`text` (requerido; `\n` corta renglón; `^x^` = palabra en **dorado 3D** con brillo; un signo
pegado `^MURO^?` no se separa), `kicker` (versalitas doradas con filetes y rombos), `sub`
(itálica), `wordAt` (0,45), `stagger` (0,3), `flashAt` (2,3; -1 = sin), `photoTone` (teal),
`bg` (auto = `table`).
Movimiento: la banda oscura se desliza desde la izquierda; cada palabra en Cinzel cae desde la
cámara como un recorte (escala 2,1→1, desenfoque, giro que se asienta) con sacudida y chispas
doradas al aterrizar. **Momento de impacto `flashAt`**: ráfaga de luz cálida con estelas, fuga
que cruza de derecha a izquierda, la cámara se adelanta y el dorado destella. En 9:16 los
renglones largos se parten solos para que el titular sea más grande. Salida: zoom + desenfoque
en el solape (`post: 0.6`).

### `collage.introv2` — gancho "pregunta + revelación"
`text`, `kicker` (bajada en itálica), `masthead` ("EDICIÓN ESPECIAL"), `stamp` (respuesta; `\n`
= 2 renglones), `stampAt` (acepta `@palabra`), `typeAt` (0,5), `cps` (18), `photoTone` (sepia),
`bg` (auto = `map`).
Una hoja de diario cae sobre el fondo; la pregunta se **imprime** letra a letra en Playfair
negra bordó con cursor, aparece la regla; en `stampAt` una **cinta bordó con volutas** golpea
encima con destello, chispas y sacudida.

### `collage.outro` — cierre del canal
`...outroParams` (`thanks`, `channel`, `cta`, `support`, `handle`, `arrow`, `likeAt`,
`subscribeAt`, `bellAt`, `supportAt`), `bg` (auto = `table`, con oscurecido extra), `dim` 0,66,
`photoTone` (bw). Orden fijo: GRACIAS POR VER → nombre del canal en dorado 3D que entra girando
letra por letra (como el emblema) y destella, filete con rombo → recorte LIKE que cae, se
**presiona** (el pulgar se llena de bordó) y queda **marcado con un círculo de tinta roja** →
ruta punteada roja (como las del mapa) → cinta SUSCRÍBETE que cae + campana dorada que suena →
apoyo en itálica palabra por palabra → `youtube.com/@…` que se revela con subrayado. 16:9 en
fila; 9:16 en columna (LIKE, ruta, cinta, campana debajo). Fundido final de 0,4 s.

### Ejemplos

```json
{ "t": 0, "use": "collage.introv1",
  "params": { "text": "EL PRECIO\nDE LA ^LIBERTAD^", "kicker": "1848 · Europa",
              "bg": "image", "src": "assets/media/foto.jpg", "photoTone": "rose", "dim": 0.4 } }
{ "t": 0, "use": "collage.introv2",
  "params": { "text": "¿QUIÉN MANDA\nEN EL MUNDO?", "stamp": "NADIE LO SABE", "stampAt": "@nadie",
              "bg": "component", "use": "collage.board",
              "useParams": { "photo": "assets/media/foto.jpg", "layout": "scatter", "tin": "cut" } } }
{ "use": "collage.outro", "params": { "bg": "sky" } }
```

## Qué quedó igual y qué difiere (y por qué)

Igual o muy cercano: plano secuencia sin cortes duros, cámara siempre en movimiento con
paralaje, densidad del collage (relleno procedural de recortes, fotos, sellos y monedas),
virados rosa/verde azulado/B/N con semitono y aberración, años en serif bordó con año chico,
banda oscura con romana, página de diario con titular, mapa con rutas rojas y lupa, paneles
de color que caen, cinta con volutas, pétalos, medallones, emblema dorado que gira, fondo que
pasa a blanco y URL final; las 7 transiciones y su ritmo (0,6–1 s), lente con bordes
desenfocados, fugas de luz y grano.

Diferencias:
- **Sin 3D real**: el motor es canvas 2D; la perspectiva de la mesa y de las hojas se simula
  (franjas con altura variable, paralaje por profundidad, rotación). La referencia (After
  Effects) tiene inclinación 3D verdadera de la mesa y del libro que se cierra.
- **Objetos 3D de la referencia** (mano que coloca un puñal, explosión, libro que se cierra en
  el emblema, anillos 3D del "100"): no se replican; el emblema usa extrusión 2D y giro por
  escala horizontal. La salida del libro se resuelve con `flip`.
- **Sin video dentro de las fotos** (la referencia anima soldados/banderas): solo fotos fijas.
- **Mancha de sangre** (28,6 s) omitida a propósito (tema sensible; el kit pide respeto).
- **Año contador**: en la referencia es chico; `collage.date` lo usa más grande para los
  momentos de "fecha grande" del guion.
- **Subtítulos**: la referencia no tiene; se agregan discretos (la narración los necesita).
- Todo el material gráfico (papel, cielo, hojas, sellos, monedas, mapas, recortes) se genera
  por código con semilla fija: no se copia nada de la referencia.

## Rendimiento / determinismo
Cada plano compone su placa en un canvas propio (2 a la vez durante una transición). Las
texturas se generan una vez en `setup` (≈1 s) y las fotos viradas se cachean al crear el plano.
Todo es función de `t` (rng con semilla, grano por cuadro de 25 fps): `seek(t)` reproduce el
mismo cuadro. Limitación conocida del motor: las transiciones necesitan que el plano saliente
siga vivo 1 s (`post: 1.0` en cada componente).

## Verificación (demo `nodehistory/collage-demo`)
- `kit.py check collage-demo`: sin errores de anclas ni de duración; solo "componente desconocido"
  (el diseño todavía no está en `catalog.json`, lo registra el coordinador) y el aviso
  "0 letras grandes (common.lyric)": a propósito, la referencia no tiene letra gigante; ese papel
  lo cumplen `collage.headline` y `collage.banner`.
- Consola: sin avisos `[kit]`; solo el 404 de `config.json` que el motor prueba antes de `assets/config.json` (común a todos los videos).
- Determinismo: el mismo `seek(t)` repetido en otro orden da cuadros idénticos (hash de captura).
- Hojas: `work/sheet-16x9.png`, `work/sheet-9x16.png`.

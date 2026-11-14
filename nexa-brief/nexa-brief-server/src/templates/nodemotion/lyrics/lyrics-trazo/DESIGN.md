# lyrics-trazo · Trazo

Video de letras con **rotulación a mano palabra por palabra** en blanco y negro.
Cada palabra cantada es un cartón nuevo dibujado en otro estilo (marcador, burbuja,
tiza, pincel, firma, garabato, trama...), con temblor de línea, inversiones a papel
blanco, garabatos, ráfagas letra a letra en las palabras sostenidas e interludios de
impactos, grietas y ovillos en los silencios.

Complementa la [guía común de NodeMotion](../../DESIGN.md). Creada el 2026-11-13
directamente en producción por instrucción expresa del usuario.

## 1. Qué reproduce y referencia

Referencia: video de Klickpin «Cultural city postcard vibes…» (pin 927811960715111799,
720×1280, 25 fps, 41,9 s), entregado por el usuario en
`src/templates/sandbox/referencias/nodemotion/LETRAS/` de su máquina. Solo se usó como
referencia visual: no se copian su audio, su ilustración de tigre ni sus dibujos.

Lo que se midió y se reproduce:

| Rasgo de la referencia | Cómo se reproduce |
|---|---|
| Un corte por palabra (0,2–0,5 s) sincronizado con la voz | `player.js` agrupa por palabra (`timing`); corte duro por defecto |
| Cada palabra en un rotulado distinto | Mazo `styles` (18 estilos sobre 16 fuentes libres) sin repetir los 2 últimos |
| Palabras partidas en sílabas apiladas («Gr/ou/p», «JUN/GLE»), letras en columna («U/P») | Disposiciones `stack`, `vertical`, `stair` |
| Temblor de dibujo animado a ~8 fps | `motion.boilFps` + filtro de desplazamiento SVG + máscara de grano |
| Golpes de escala (zoom de entrada, rebote) | Movimientos `punch`, `pop`, `drift`, `recede`, `shake` |
| Cuadros invertidos a papel blanco | `invert` + transición `flash` |
| Fondo rayado a mano detrás de la palabra («witnesses») | `hatch` (componente `trazo.trama`) |
| Rayos alrededor de la palabra, destello en una letra, flecha | `doodles`: `rays`, `star`, `underline`, `circle`, `arrow` |
| Círculo diminuto que crece con rayos, impactos de bala, grieta, ovillo | Interludios `sun`, `holes`, `crack`, `scribble`, `spark` |
| Tramo final con letras gigantes que alternan estilo y fondo cada 2 cuadros | Ráfaga `burst` para palabras sostenidas |

No reproducido: la ilustración del tigre y los dibujos figurativos (son arte a mano de la
referencia; no hay forma honesta de generarlos con tipografía y trazos procedurales).

## 2. Estructura y orquestador

```text
lyrics-trazo/
├── index.html              cascarón: <audio>, capas #stage/#ink, carga de componentes
├── player.js               orquestador (config, validación, letra, línea de tiempo, reloj)
├── components/
│   ├── trazo.css           estilos compartidos por el video y la galería
│   ├── core.js             azar determinista, medida de texto, trazos a mano, grano
│   ├── escenas.js          escenas word (palabra) y burst (ráfaga)
│   ├── transiciones.js     movimientos y transiciones de entrada
│   ├── garabatos.js        adornos (doodles) e interludios
│   ├── intro.js            intro (+ NexaTemplateIntro, @nexa thumbnail-at)
│   ├── outro-v1.js         Outro v1 «Burbuja»
│   └── outro-v2.js         Outro v2 «Grieta»
├── assets/config.json      configuración demo (colección {activeId, configs})
├── assets/song.mp3, lyrics.json, card-poster.webp
├── assets/fonts/           16 fuentes woff2 (subconjunto latino) + licencias
├── showcase/               galería de componentes aislados + components.json
├── info.json               componentes elegibles y catálogo
├── thumbnail-style.json    tratamientos de miniaturas A/B
└── DESIGN.md
```

`player.js`: carga `config.json` → `assets/config.json` → `DEFAULTS`; valida cada campo
(fuera de rango → valor por defecto + `console.warn("[lyrics-trazo] …")`); aplica la
selección `?c=`; registra las fuentes con `FontFace`; lee la letra Whisper; arma la
línea de tiempo (intro → palabras / ráfagas / interludios → outro) y en cada
`requestAnimationFrame` dibuja el estado del segundo `audio.currentTime`.
Depuración: `?t=12.3` congela el cuadro, `?debug=1` muestra el HUD,
`window.__trazo.seek(t)` / `.scenes()` / `.config`.

## 3. Componentes

| Nombre (info.json) | Archivo | Qué muestra | Parámetros (JSON) |
|---|---|---|---|
| `trazo.intro` | `components/intro.js` | Círculo que crece con rayos, título escrito a mano de izquierda a derecha, artista tecleado, doble subrayado | `intro.title`, `intro.artist`, `intro.titleFont`, `intro.artistFont`, `intro.minSec` |
| `trazo.palabra` (siempre activo) | `components/escenas.js` → `word` | Palabra a pantalla grande | `styles`, `layouts`, `motion`, `transitions`, `size`, `overrides` |
| `trazo.rafaga` | `escenas.js` → `burst` | Palabra sostenida: la palabra y sus letras gigantes alternan estilo y fondo cada `stepSec` | `burst.*` |
| `trazo.interludios` | `components/garabatos.js` | Silencios: `sun`, `holes`, `crack`, `scribble`, `spark` | `interludes.*` |
| `trazo.garabatos` | `garabatos.js` | Adornos sobre palabras | `doodles.*` |
| `trazo.inversion` | `transiciones.js` + `player.js` | Cuadros con papel blanco y tinta negra | `invert.*`, `colors.*Inverted` |
| `trazo.trama` | `escenas.js` | Fondo rayado a mano con halo para leer la palabra | `hatch.chance` |
| `trazo.outrov1` | `components/outro-v1.js` | Negro, título en burbuja con rebote, `sub` escrito en firma, subrayado, `feats` tecleado | `outro.*` |
| `trazo.outrov2` | `components/outro-v2.js` | Papel blanco, grieta que se abre, letras del título cada una en otro estilo, impactos | `outro.*` |

Grupo `outro`: exactamente uno activo (por defecto `trazo.outrov1`). Los demás son
interruptores (`components.<clave>: true|false`).

### Intro
Duración = desde 0 hasta la primera palabra; solo aparece si ese hueco ≥ `intro.minSec`
(si no, el hueco se llena con el interludio `sun`). Tiempos internos proporcionales:
sol 0–25 %, escritura del título hasta 72 %, artista hasta 90 %. En 9:16 el título de
varias palabras se apila. `// @nexa thumbnail-at: 2.4` marca el segundo con el cartel
completo (canción demo).

### Outro v1 y Outro v2
Empiezan en `max(última palabra + outro.leadSec, final − outro.maxSec)` y duran al
menos `outro.minSec`; si la canción termina antes, se adelantan sin pasar de la última
palabra + 0,1 s. Tiempos internos proporcionales a su duración; al final quedan quietos.

### Miniaturas A y B
Integradas en el sistema real de miniaturas (no en una imagen suelta):
- `src/templates/nodemotion/design-tokens.json` → `templates.lyrics-trazo`: fuente
  **Permanent Marker 400** en A y B, papel `paper` de fondo, tinta `ink` de texto y
  «LETRAS».
- `thumbnail-style.json`: A = `solid, outline` (título en marcador sólido, segunda fila
  en contorno); B = `outline, solid, outline, solid` (alterna, como el cambio de estilo
  palabra a palabra).
- `src/templates/nodemotion/assets/fonts/permanent-marker-normal-400.ttf` + entrada en
  `index.json` (necesaria para que el renderer de miniaturas la incruste).
- Fondo: fotograma del video (`background.kind = frame`) con la capa negra común del
  renderer; el usuario puede cambiar fotograma, imagen, texto y encuadre en el editor de
  la app y guardarlo como cualquier otra plantilla, porque el renderer es el compartido
  (`src/core/draft_thumbnails.py` + `draft_thumbnail_renderer.js`).
- Pendiente de verificar en la app: abrir un borrador real de esta plantilla, generar A/B,
  editar y guardar (requiere el backend reiniciado, ver §9).

## 4. Animaciones, movimientos y transiciones disponibles

- **Movimientos** (`motion.deck`): `none`, `punch` (entra `1+punch` y se asienta en
  0,22 s), `pop` (de 0,8 a 1 con rebote), `drift` (acercamiento `drift` durante la
  palabra), `recede` (empieza cerca y retrocede), `shake` (sacudida `shake` a la cadencia
  del dibujo).
- **Transiciones de entrada** (`transitions.deck`): `cut`, `flash` (fondo invertido
  `flashSec`), `zoom` (entra 1,35× en `zoomSec`), `shift` (entra corrida), `blink`
  (pantalla vacía un instante).
- **Temblor**: `motion.boilFps` (pasos por segundo), `motion.boil` (amplitud por fila),
  `motion.wobble` (escala del desplazamiento SVG; 0 lo desactiva), `motion.grain`
  (huecos de tinta seca; 0 lo desactiva).
- **Disposiciones** (`layouts.deck`): `line`, `stack`, `vertical` (≤ `verticalMaxLetters`
  letras), `stair`. En 9:16 se multiplica `stack` por `portraitStackBoost`; en 16:9 se
  favorece `line`.
- **Tratamientos** de estilo: `solid`, `outline`, `hatch` (relleno rayado + contorno),
  `shadow` (sombra en contorno desplazada).
- **Adornos**: `rays`, `star`, `underline`, `circle`, `arrow`.
- **Interludios**: `sun`, `holes` (papel blanco), `crack` (papel blanco), `scribble`,
  `spark`.

## 5. Formato del JSON

`assets/config.json` (y el `config.json` del job) es `{ "activeId", "configs": [CASO] }`.
Claves de `CASO` y valores por defecto (todos opcionales; los no válidos se ignoran con aviso):

| Clave | Defecto | Opciones / rango |
|---|---|---|
| `audio.src` | `assets/song.mp3` | el pipeline lo fuerza a `song.mp3` |
| `lyricsUrl` | `assets/lyrics.json` | el pipeline lo fuerza a `lyrics.json` |
| `lyricsFilter.dropPatterns` | subtítulos/amara/thanks for watching | regex; prefijo `(?i)` = sin mayúsculas |
| `lyricsFilter.maxWordSec` | 3.5 | 0,2–30 |
| `seed` | 11 | entero; cambia todas las elecciones al azar |
| `colors.ink / paper / inkInverted / paperInverted` | `#FFFFFF / #050505 / #0B0B0B / #F6F6F3` | `#hex` |
| `fonts.<clave>` | 16 fuentes locales | `{family, src, lineHeight 0,5–2, scale 0,3–3}` |
| `styles.<id>` | 18 estilos | `{font, treatment, case: upper/lower/title/asis, weight 0–100, tracking, dim, scale}` |
| `components` | `{intro, interludes, burst, invert, hatch, doodles: true, outro: "trazo.outrov1"}` | booleanos; `outro`: `trazo.outrov1`/`trazo.outrov2` |
| `intro` | `{title:"", artist:"", titleFont:"caveat", artistFont:"tall", minSec:1.6}` | fuentes = claves de `fonts` |
| `outro` | `{title:"Gracias", sub:"por ver", feats:"Suscríbete · NodeMotion", titleFont:"bubble", subFont:"signature", featsFont:"tall", leadSec:0.35, minSec:2.6, maxSec:6}` | |
| `timing` | `{leadSec:0.05, minWordSec:0.16, maxMergeChars:12, gapSec:0.85, holdSec:0.4}` | palabras más cortas que `minWordSec` se juntan con la siguiente; huecos > `gapSec` → interludio |
| `size` | `{fill:0.8, fillH:0.6}` | fracción de pantalla para la palabra |
| `layouts` | `{deck:{line:3, stack:2, vertical:0.8, stair:0.7}, stackMinLetters:5, verticalMaxLetters:5, portraitStackBoost:2.2}` | |
| `motion` | `{boilFps:8, boil:0.35, wobble:2.2, grain:0.5, punch:0.1, drift:0.05, shake:0.5, deck:{punch:3, drift:2, pop:1.5, recede:1, shake:0.6, none:1}}` | |
| `transitions` | `{flashSec:0.08, zoomSec:0.12, deck:{cut:6, flash:1.2, zoom:1, shift:0.6, blink:0.6}}` | |
| `invert` | `{chance:0.12, minGap:4}` | prob. por palabra y palabras mínimas entre inversiones |
| `hatch` | `{chance:0.06}` | |
| `doodles` | `{chance:0.2, deck:{rays:2, star:2, underline:1, circle:1, arrow:0.5}}` | |
| `interludes` | `{minSec:0.45, maxSec:3, deck:{sun:3, holes:2, crack:2, scribble:2, spark:1}}` | |
| `burst` | `{minSec:0.85, minLetters:3, stepSec:0.1, invertChance:0.5, hatchChance:0.2, words:[]}` | `words`: palabras que siempre van en ráfaga |
| `overrides` | `[]` | `{match:"palabra" \| at:segundo, style, layout, motion, transition, inverted, hatch, doodle, burst}` |
| `debug.enabled` | false | HUD |

Ejemplo (fragmento coherente con la implementación):

```json
{
  "activeId": "default",
  "configs": [{
    "id": "default",
    "seed": 11,
    "intro": { "title": "Let Out The Beast", "artist": "Ombré ft. KTHLN" },
    "components": { "intro": true, "outro": "trazo.outrov2", "burst": true, "invert": true, "hatch": true, "doodles": true, "interludes": true },
    "styles": {
      "marker-caps": { "font": "marker", "treatment": "solid", "case": "upper", "weight": 3 },
      "bubble": { "font": "bubble", "treatment": "solid", "case": "lower", "weight": 2 },
      "block-hatch": { "font": "block", "treatment": "hatch", "case": "upper", "weight": 1.5 }
    },
    "motion": { "boilFps": 8, "punch": 0.12, "deck": { "punch": 3, "pop": 1, "none": 1 } },
    "transitions": { "deck": { "cut": 6, "flash": 2 } },
    "overrides": [
      { "match": "jungle", "style": "bubble", "layout": "stack", "doodle": "star", "inverted": true },
      { "match": "beast", "burst": true }
    ],
    "outro": { "title": "Gracias", "sub": "por ver", "feats": "Suscríbete · NodeMotion" }
  }]
}
```

## 6. Cambiar canción, letra, textos, medios y aspecto (solo JSON)

- **Canción y letra**: en un job llegan como `song.mp3` + `lyrics.json` (Whisper). Para la
  demo: reemplazar `assets/song.mp3` y `assets/lyrics.json`. Se toleran palabras con
  espacio inicial, segmentos sin `words` (se reparten por igual) y alucinaciones
  (`lyricsFilter`).
- **Textos**: `intro.title`, `intro.artist`, `outro.title/sub/feats` (también editables
  desde el formulario de la app: `inputs.texts` en `templates.json`).
- **Aspecto**: `colors` (por ejemplo tinta amarilla sobre azul noche), `styles` (quitar,
  añadir o reponderar), `fonts` (añadir una fuente local: copiar el archivo en
  `assets/fonts/` y declararla), decks de movimiento, transición, disposición, adornos e
  interludios, `seed`.
- **Medios**: el diseño no usa fotos ni video (como la referencia).
- **Componentes**: `components` en el JSON, o en la vista previa
  `index.html?c=trazo.outrov2` (grupo) / `?c=trazo.rafaga&cx=1` (selección explícita:
  los interruptores no listados quedan apagados) / `&p={"trazo.outrov2":{"title":"Adiós"}}`.

## 7. Qué requiere cambiar código

Un tipo de escena, movimiento, transición, adorno o interludio **nuevo** (se registra en
`window.Trazo.registry` desde un archivo de `components/` y se carga en `index.html`);
otra forma de partir palabras; dibujos figurativos; fondos de foto o video; otra
composición de intro u outro. Todo lo listado en §5 es dato.

## 8. Integración con NodeMotion y HyperFrames

- `templates.json` → `lyrics-trazo` (`category_id: lyrics`, `static_config: true`,
  `runtime_assets: player.js, components, assets/fonts`, textos editables).
- `niches.json` del repositorio **y** `config/niches.json` del perfil activo
  (`profesional`, v3) → nicho `lyrics_video_trazo`, listado en
  `categories.node_motion.children.letras`.
- Contrato de grabación: un solo `<audio>` (el primero), reloj = `audio.currentTime`,
  arranque sin clic, estado = f(semilla, segundo), recursos locales y relativos, sin red
  en el render, sin `crossorigin`, sin `window.__timelines`. Temporizadores: solo las
  esperas de carga, vía `__nbSetTimeout`. El bloque `<script data-nb-hf-clock>` lo
  insertó `_tools/hyperframes/optimize.py` (`--check` ✓).
- **No** está en `HF_VALIDATED_LYRICS_TEMPLATE_IDS`: falta la validación de §10.4 de
  `src/templates/AGENTS.md` (render real).

## 9. Revisar en 16:9 y 9:16

- Navegador: servir la carpeta por HTTP y abrir `index.html` en una ventana 16:9 y otra
  9:16 (p. ej. 960×540 y 540×960); `?t=` para congelar instantes, `?debug=1`.
- Galería: `showcase/index.html?only=trazo.outrov2&aspect=9:16` (también `16:9`, `&t=`,
  `&p=`, `&bg=`, `&loop=0`).
- En la app: /plantillas → Videos de letras → Trazo (tras reiniciar el backend: el
  catálogo se cachea en memoria al arrancar).

## 10. Recursos, fuentes y permisos

- Fuentes (Google Fonts, SIL OFL 1.1 o Apache 2.0, subconjunto latino woff2): Permanent
  Marker y Rock Salt (Apache 2.0), Rubik Bubbles, Rubik Scribble, Rubik Marker Hatch,
  Rubik Doodle Shadow, Cabin Sketch, Fredericka the Great, Amatic SC, Knewave, Caveat
  Brush, Londrina Sketch, Londrina Solid, Mrs Saint Delafield, Sedgwick Ave Display,
  Mansalva (OFL). Licencias junto a cada archivo en `assets/fonts/`.
- Canción demo: la misma de `lyrics-caution` («Let Out The Beast», Ombré ft. KTHLN) con
  3,2 s de silencio añadidos al final para el cierre (256 kb/s). Su licencia es la misma
  que ya tenía la demo de Caution: **no verificada** para distribución.
- Sin fotos ni videos de stock.

## 11. Pruebas realizadas

- Navegador (Chromium/Playwright, local y copia de producción por túnel): 9:16 (405×720,
  540×960) y 16:9 (800×450, 960×540), hojas de contacto cada 1,15 s de los 92 s; sin
  errores de consola (solo el 404 esperado de `config.json` fuera de un job).
- Reproducción real con audio: el reloj avanza con `audio.currentTime`; ~53 fps en vivo
  a 540×960 con temblor activo.
- Determinismo: el DOM del escenario es idéntico al volver al mismo segundo (7 instantes).
- Selección real de componentes: `?c=trazo.outrov2` cambia el cierre en la línea de
  tiempo y en pantalla.
- Galería: los 9 componentes aislados en 9:16 y 16:9.
- `optimize.py --check lyrics-trazo` ✓; suite de tests (ver informe de entrega).

## 12. Limitaciones y pendientes

- **Render HyperFrames** (`render_demo.py --seconds 30 lyrics-trazo`) no ejecutado: es
  la validación que exige el proyecto antes de habilitarla para HyperFrames.
- La app no muestra la plantilla hasta reiniciar el backend (catálogo en `lru_cache`).
- Miniaturas A/B: integradas en tokens/estilo/fuentes, pero no probadas con un borrador
  real en el editor.
- Sin port Remotion. Sin `publish.json` (depende de la canción de cada video).
- El filtro de temblor (SVG) es el efecto más costoso por cuadro: si un render resulta
  lento, `motion.wobble: 0` lo quita conservando el resto del diseño.

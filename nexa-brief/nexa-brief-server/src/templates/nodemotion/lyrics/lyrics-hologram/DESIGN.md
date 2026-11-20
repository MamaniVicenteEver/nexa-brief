# lyrics-hologram · diseño reproducible

Plantilla de **letras** NodeMotion «Holograma». ID estable `lyrics-hologram`, familia `lyrics`.
Motor compartido en `src/templates/_tools/nodemotion/lyrics/designs/lyrics-hologram/`; esta carpeta
(`src/templates/nodemotion/lyrics/lyrics-hologram/`) es la demo: datos, entrada mínima y documentación.
Cualquier canción con su transcripción produce un video completo: la duración la marca el audio.

## 1. Referencia y análisis

Referencia del usuario: lyric video de un tema pop/k-pop de 2:55 (16:9, 30 fps), en
`sandbox/referencias/nodemotion/LETRAS/`. Rasgos replicados, medidos sobre su hoja de contacto (1 fps):

- Fondos casi negros con viñeta, y secciones de color: rojo intenso, violeta con cintas de luz y gris claro.
- Relleno **holográfico iridiscente** (lila, cian, rosa, azul) dentro de letras condensadas altas.
- Palabra gigante en contorno detrás (a veces itálica extendida) con la frase en una banda blanca.
- Ecos de la palabra apilados en contorno; la frase repetida en columna con una sola línea sólida.
- Barras holográficas y blancas que tapan partes de la palabra y se retiran (cortes tipo glitch).
- Letras repartidas que se ensamblan; palabra en columna con la frase repetida a los lados.
- «Seda holográfica» fluida a pantalla completa en los versos, con texto pequeño espaciado y la
  palabra fuerte enorme y tenue detrás.
- Siluetas con relleno holográfico, ventanas de imagen con marco iridiscente.
- Rótulos diminutos repetidos en los bordes, filas de rombos sobre y bajo la palabra.
- Cortes secos mayoritarios, glitch, destellos, persianas y una franja iridiscente que barre.

No se usa nada de la referencia: ni su canción, ni sus personajes, ni sus logotipos o marcas.
El emblema de la intro es un polígono propio.

## 2. Identidad visual

| Rol | Clave `palette` | Valor |
|---|---|---|
| Fondo casi negro | `void` | `#09090F` |
| Centro de viñeta | `night` | `#17162A` |
| Texto claro | `white` | `#F4F2FB` |
| Texto sobre claro | `ink` | `#100E1C` |
| Sección roja | `red` | `#E3122E` |
| Sección violeta | `violet` | `#4A1DB5` |
| Sección clara | `pale` | `#E2E1E8` |
| Holografía | `h1`…`h5` | `#C9B6FF` `#9EEFF4` `#F4C2EF` `#7F8CFF` `#EAFBFF` |

Tipografía: `fonts.condensed` (Bebas Neue, clase `.fc`) para casi todo; `fonts.wide` (Archivo 900
itálica extendida 125 %, clase `.fw`) para palabras de silueta, contornos gigantes y el Outro v1.
Ambas tienen Noto Sans KR como respaldo para hangul. Cambiar familias: `fonts.googleUrl` +
`fonts.condensed` / `fonts.wide`.

**Holografía.** Un único contexto WebGL compartido dibuja un shader de seda iridiscente (deformación
de dominio sobre una rampa cíclica de `h1`…`h5`). Los fondos `holo` lo redibujan con el reloj de la
escena (determinista al hacer seek). Una textura fija generada una vez por paleta rellena las
letras (`background-clip: text`) y los paneles. Sobre fondos claros, las letras usan una variante
**profunda** de la paleta (violeta, azul y cian oscuros) para mantener el contraste. Sin WebGL hay
un respaldo 2D con manchas desenfocadas.

## 3. Arquitectura y archivos

```text
_tools/nodemotion/lyrics/designs/lyrics-hologram/     motor compartido (fuente única)
  manifest.json · document.html · scripts/ · styles/ · contract.json · QUICK.md · catalog.json · contracts/
  runtime/player.js                 orquestador (validación de config, mazo, intro/outro, transiciones)
  runtime/components/kit.js         fondos, holografía, rótulos, rombos, barras, medios, entradas de texto
  runtime/components/scenes.js      14 escenas del mazo
  runtime/components/intro.js       intro
  runtime/components/outro-v1.js    Outro v1 (predeterminado)
  runtime/components/outro-v2.js    Outro v2
  runtime/components/transitions.js holoWipe · glitch · flashWhite · shutter
  runtime/gallery.html              galería (?only=<nombre>, aspect=16:9|9:16)
_tools/nodemotion/lyrics/compiler/hologram/build/lyrics-hologram.spec.json   config por defecto + CSS + fuentes
nodemotion/lyrics/lyrics-hologram/  demo: index.html (entrada mínima), assets/config.json,
                                    assets/lyrics.json, showcase/components.json, DESIGN.md, MINIATURAS.md, CREDITS.md
```

El documento se arma con el núcleo común (`promo/compiler/build/core.js`: reloj por audio, pistas
deterministas, `lyricTimeline`) más `runtime/player.js`. El jugador carga los componentes en tiempo
de ejecución desde `components/`, alias de `runtime/components/`. Para recompilar después de un
cambio de motor autorizado:
`.venv/bin/python src/templates/_tools/nodemotion/promo/compiler/build/build.py lyrics-hologram`.
Como el diseño está registrado, la herramienta publica con `update_engine` y archiva la revisión anterior.

## 4. Escenas del mazo

El motor parte la letra en frases (`phrases`) y elige un tipo por frase con `layouts` (peso, fondos,
clips, transición y parámetros), solo entre los tipos cuya condición de texto se cumple. No repite
un tipo dentro de `timing.cooldown` escenas. Fondos: `void`, `holo`, `red`, `violet`, `pale`, `media`.

| Tipo | Momento de la referencia | Condición | Parámetros (default) |
|---|---|---|---|
| `holoWord` | «THE BADDEST» | siempre (reserva) | `textIn` stamp · `echoes` 0–3 (1) · `holo` true |
| `outlineBack` | «BREAK / RULES» | palabra ≤ 9 | `textIn` cut · `fill` outline/holo · `band` true |
| `slice` | «BAD DES T», «LIVE» | ≤ 5 palabras | `textIn` glitch · `bars` 1–6 (4) · `keep` 0–1 (0.15) |
| `assemble` | «R A / W D → REAL WILD» | ≤ 2 palabras, ≤ 11 letras | `spread` 1–3 (1.9) · `holo` true |
| `repeatStack` | «LIGHT IT UP», «SPLASH» | ≤ 16 caracteres | `textIn` slide · `rows` 3–11 (7) · `drift` 0–2 (1) |
| `verse` | versos sobre seda | siempre | `textIn` cut · `ghost` true · `size` 0.6–1.6 (1) |
| `band` | «THAT'S WHAT THE», «BREAKING» | ≥ 2 palabras | `textIn` slide · `strike` false · `align` left/center |
| `panel` | ventanas con imágenes | ≤ 6 palabras | `textIn` slide · `windows` 1–3 (2) |
| `silhouette` | «MURDER», «BLAZE» | palabra ≤ 10 | `textIn` stamp · `rows` 0–5 (3) |
| `trio` | «WANT WANT WANT» | palabra ≤ 8 | `textIn` cut · `box` true |
| `chrome` | «FLEX», «SAY», «SORRY» | palabra ≤ 8 | `textIn` slide · `caption` true |
| `vertical` | columna con laterales | palabra ≤ 7 | `textIn` cut · `holo` true · `ghost` true |
| `giantOutline` | «NAH NOT» sobre «GOING» | ≤ 18 caracteres | `textIn` stamp · `drift` 0–2 (1) |
| `rows` | «CLAP // CLAP» | palabra ≤ 10 | `textIn` stamp · `rows` 4–16 (10) · `figure` true |

`textIn`: slide · stamp · glitch · spread · fade · cut. La «palabra» es la palabra fuerte de la
frase (la más larga que no sea artículo, pronombre ni preposición).

## 5. Intro, outros y transiciones

- **Intro** (antes de la primera frase, si hay tiempo): emblema `crest` | `diamond` | `none` con
  relleno holo, silueta holográfica opcional (`media`), `intro.title` y `intro.artist`.
- **Outro v1** (por defecto): tarjeta casi negra, emblema pequeño, `outro.title` itálico holográfico
  con barra, `outro.sub`, `outro.feats`, fundido `fadeSec`.
- **Outro v2**: seda holográfica, filas tenues del título (`rows`), título en tinta con ecos,
  subtítulo, créditos y fundido. Se elige con `outro.version` (o `?outro=v2` en la vista).
- **Transiciones** (`transition.weights`): `holoWipe`, `glitch`, `flashWhite` y `shutter`, más `cut`
  y las del motor (`fade`, `slice`, `flash`, `zoomIn`…). `transition.overlapSec` mantiene la escena
  anterior debajo.

## 6. Medios

`config.media` admite videos o imágenes. Hay dos tratamientos:

- `"look": "silhouette"`: figura clara sobre fondo negro (por ejemplo, bailarines en silueta). La
  figura se llena de holografía y el negro desaparece. Sobre fondos claros sale como forma oscura.
- Sin `look`: duotono `grades.holo` pregradado más iridiscencia `look.mediaHolo`.

`layouts.<tipo>.media` fija qué clips prefiere cada escena. En la demo, `silhouette` y `rows`
usan las siluetas, y `panel` usa los retratos. La intro busca la primera silueta de `config.media`.

## 7. JSON configurable

Todo está en `assets/config.json`; el jugador valida cada valor y lo corrige con aviso en
`window.__promoInfo.warnings`:

- `palette.*` solo admite `#RRGGBB`.
- `layouts.<tipo>`: `weight` 0–10, `bgs` (solo fondos existentes), `media` (solo IDs existentes),
  `trans` (solo transiciones existentes) y los parámetros de la tabla del §4.
- `look`:
  - `holoSpeed` 0–3
  - `labels` 0–1 y `labelText` (texto de los rótulos; vacío usa `intro.title`)
  - `ornaments` 0–1
  - `frame` 0–1
  - `glitch` 0–2
  - `mediaHolo` 0–1
  - `glow` 0–1
- `anim`: `textIn`, `speed` 0.5–2.
- `intro` (`enabled`, `title`, `artist`) y `outro` (`enabled`, `version` v1/v2, `sec`, `title`, `sub`, `feats`).
- `timing` y `phrases` (§8), `transition`, `seed`.

## 8. Ritmo y sincronía

Cada palabra entra a su tiempo de Whisper (`timing.leadSec` de anticipación). Las frases se cortan
con `phrases.maxWords` (4) y `phrases.maxSec` (2.4 s). Los silencios mayores que `timing.gapSec`
se llenan:

- con ecos de palabras fuertes, de `timing.echoSec` cada uno;
- o, si el silencio es largo, repitiendo frases ya cantadas.

El cierre ocupa los últimos `outro.sec` segundos. `lyricsFilter` descarta alucinaciones típicas de
Whisper. Si una línea repetida llega en un solo segmento («give it up, give it up…»), conviene
partirla por sus comas en `lyrics.json`; la demo ya lo hace.

## 9. Formatos

16:9 y 9:16 con el mismo motor: en vertical las frases se reparten en más renglones, las ventanas
se apilan, las siluetas se amplían y los rótulos usan dos columnas. Verificado escena a escena en
ambos formatos (80 escenas de la demo).

## 10. Miniaturas A/B

Renderer real `renderHologramSvg` (`src/core/draft_thumbnail_renderer.js`, `style: lyrics-hologram`).
Ver `MINIATURAS.md`.

## 11. Integración

- Catálogo `templates.json` (`lyrics-hologram`, categoría `lyrics`).
- Nicho `lyrics_video_hologram` en `niches.json` del repositorio y del perfil efectivo.
- `design-tokens.json`, tema y paleta de miniaturas (`draft_thumbnails.py`).
- Bebas Neue local para miniaturas.
- Recursos de demo por hash.
- Descubrimiento (`showcase/components.json` → `contracts/`).

Usa el reloj HyperFrames del proyecto (`optimize.py --check` ✓) y los clips están recodificados
con GOP 5. No está en la lista HyperFrames validada hasta tener un render de prueba revisado.

## 12. Licencias, límites y pendientes

- **Licencias:** canción de la demo CC BY 3.0, con atribución obligatoria al publicar. Clips
  Pixabay. Fuentes OFL. Detalle en `CREDITS.md`.
- **Límites:**
  - Las letras holográficas usan una textura fija animada por desplazamiento; solo los fondos
    `holo` redibujan el shader cada cuadro.
  - Los medios `silhouette` necesitan figura clara sobre negro: un clip cualquiera con ese look
    se verá «quemado».
  - `assemble` admite como máximo 11 letras.
- **Pendientes (requieren autorización):**
  - Render de validación HyperFrames y alta en la lista validada.
  - Prueba de miniaturas A/B en un borrador real.

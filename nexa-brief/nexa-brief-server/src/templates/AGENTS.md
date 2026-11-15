Start with the [content index](../skills/README.md).

## Crear diseños NodeMotion
La entrada específica es [crear e integrar plantillas](../../docs/nodemotion-template-authoring.md).
Estas reglas de fuente compartida, datos y recursos prevalecen para NodeMotion sobre las recetas generales de HTML autocontenido o copiado por job que siguen en este archivo.
Un prototipo aislado respeta su carpeta y entrega pendientes al integrador. Verificar alta, contratos, catálogos, recursos, preview y renderer, además de la apariencia.

## NodeMotion shared-engine contract

For registered NodeMotion lyrics and promos, follow [the current architecture](../../docs/nodemotion-architecture.md).
Their implementation lives only in `_tools/nodemotion/{lyrics,promo}/designs/`.
Demos keep their content and a thin entry; new projects keep JSON and registered-resource references.
Use the shared assembler/resolver for source, assets, preview, recording, and packaging.
The inline/copy-per-job instructions below describe legacy and image/video contracts; do not use them to duplicate NodeMotion engines.
Use English filenames. Preserve stable IDs, legacy URLs, colors, fonts, transitions, movement, timing, and composition.

Para crear cualquier contenido empieza por el [índice](../skills/README.md),
[CALIDAD.md](../skills/CALIDAD.md) (estándar obligatorio) y
[ORQUESTACION.md](../skills/ORQUESTACION.md) (roles, delegación, terminado e informe).

# AGENTS.md — Reglas para crear o modificar plantillas de video

> **Ubicación obligatoria (v2/v3):** las demos principales validadas viven en
> `src/templates/<categoría>/<id>/` del repositorio; los episodios viven en
> `$NEXA_PROFILE_DIR/productions/<categoría>/<id>/`. Todos los proyectos de
> prueba, prototipos y referencias viven en `$NEXA_PROFILE_DIR/sandbox/`.
> El `sandbox/` del repositorio solo contiene motores compartidos experimentales,
> herramientas y documentación, sin proyectos históricos. Verifica el perfil activo.
> Norma: [ubicación de demos, pruebas y episodios](../../docs/ubicacion-demos-pruebas-episodios.md).

> Este archivo es para cualquier agente de IA (Codex, Claude, Cursor, Copilot, Gemini…)
> o persona que vaya a **crear una plantilla nueva** o **modificar una existente** dentro de
> `src/templates/`. Leelo entero antes de tocar nada. Aplica a todo lo que hay debajo
> de esta carpeta.
>
> Las palabras **DEBE / NO DEBE / PUEDE** son obligatorias en el sentido estricto.

---

## 1. Qué es una plantilla

Una plantilla es un `index.html` **autocontenido** que dibuja un video animado a partir de:
- un `config.json` (paleta, textos, medios, escenas…),
- una canción `song.mp3` y su letra `lyrics.json` (en las plantillas de letras),
- medios opcionales (imagen o video de fondo, clips, fotos).

El sistema la copia a la carpeta de cada job y la **graba con uno de tres motores**:

| Motor | Cómo graba | Qué exige a la plantilla |
|---|---|---|
| **Playwright** (`browser`) | Abre la página en Chrome y la graba en tiempo real | Que se vea bien en un navegador normal |
| **Remotion** | Port aparte en `nexa-brief-remotion/` (`remotion_component` en `templates.json`) | Si cambiás la plantilla, el port Remotion **no** se actualiza solo |
| **HyperFrames** (`nexa-brief-hyperframes`) | Captura cuadro a cuadro con tiempo virtual | El reloj `nb-hf-clock` + las reglas de la sección 6 |

La misma plantilla también se muestra **en vivo** en la app (tarjetas de /plantillas,
modal, landing y Estudio). Por eso tiene que funcionar en los cuatro contextos.

---

## 2. Reglas de oro (no negociables)

1. **NO DEBE cambiar el diseño de una plantilla existente** (colores, tipografías,
   tamaños, posiciones, animaciones, tiempos, transiciones, textos, medios) salvo que
   el usuario lo pida **explícitamente** para esa plantilla. "Optimizar" nunca autoriza
   cambios visuales.
2. **NO DEBE bajar la calidad**: ni resolución, ni fps, ni bitrate, ni efectos, ni
   cantidad de partículas, para ganar velocidad.
3. **NO DEBE editar a mano un `index.html` que sale de un generador** (sección 8). Se
   edita el generador y se regenera.
4. **NO DEBE borrar ni editar el bloque `<script data-nb-hf-clock="…">`** que hay al
   principio de los `index.html`. Lo maneja `_tools/hyperframes/optimize.py`.
5. **Después de cualquier cambio** en el `index.html` DEBE correr el checklist de la
   sección 10.
6. **NO DEBE tocar** `data/canales/` (cuentas reales) ni publicar en redes durante pruebas.
7. **NO DEBE borrar** `_tools/hyperframes/media_originals/` (originales de stock).
8. **Plantillas en la categoría «En desarrollo»** (`category_id: "in_progress"` en
   `templates.json`): son las que el usuario está puliendo. Solo se modifican si el
   usuario lo pide para esa plantilla. No se procesan con herramientas en lote.
9. Ante cualquier duda que no resuelva este archivo: **parar y preguntar**.

---

## 3. Estructura obligatoria de una plantilla

```text
src/templates/                         ← código compartido y demos principales validadas
├── AGENTS.md                          ← este archivo
├── README.md                          ← resumen del catálogo
├── templates.json                     ← catálogo: fuente de verdad (sección 4)
├── nodemotion/                        ← categoría NodeMotion (música): las plantillas de este archivo
│   ├── lyrics/<template-id>/          ← plantillas de letras
│   ├── commercial/<template-id>/      ← promos
│   ├── image/<template-id>/           ← basadas en una imagen
│   └── video/<template-id>/           ← basadas en un video
├── nodetech/<demo-id>/                ← demos principales validadas, sin fecha en carpeta
├── nodehistory/<demo-id>/             ← demos; nodeatlas/, nodeeconomy/, … según catálogo
├── _tools/                            ← motores, generadores y herramientas (sección 8)
│   └── explainer-kit/                 ← motor de videos explicativos (Tech, History, Politics, Economy)
└── sandbox/                           ← motores experimentales/herramientas/docs; sin proyectos
```

> **Las carpetas `node*/` de videos y `_tools/explainer-kit/`** no son plantillas de este catálogo:
> no se registran en `templates.json` ni tienen nicho. Las rige **`_tools/explainer-kit/AGENTS.md`**
> (cómo producir un video) y el backend las lista por categoría (`niches.json` → `categories`,
> campos `folder` y `designs`). Cada video es solo datos; el motor no se edita.

> **`sandbox/AGENTS.md`** contiene las instrucciones compartidas de pruebas.
> Los prototipos de música, ideas de videos y referencias se crean físicamente en
> `$NEXA_PROFILE_DIR/sandbox/`, nunca junto a esos documentos del repositorio.
> Para trasladarlos usa **Preparar para producción → Pasar a producción**; las
> demos validadas van al repositorio y los episodios al perfil. No copies motores.

Cada plantilla:

```text
nodemotion/<tipo>/<template-id>/        ← tipo: lyrics | commercial | image | video
├── index.html                ← OBLIGATORIO. Todo el HTML/CSS/JS inline.
├── assets/
│   ├── config.json           ← OBLIGATORIO. Config por defecto (la que se ve en /plantillas).
│   ├── song.mp3              ← letras/promos: canción por defecto.
│   ├── lyrics.json           ← letras/promos: letra por defecto, formato Whisper.
│   ├── bg.jpg | bg.mp4 | …   ← fondo por defecto, si la plantilla usa uno.
│   └── media/                ← clips/fotos de stock (promos y plantillas con escenas).
└── prompts/
    ├── config_mapper.md      ← si NO es static_config: prompt que genera config.json con IA.
    └── vision_extractor.md   ← solo plantillas de imagen que analizan la foto.
```

- El `template-id` es estable: **nunca se renombra** (lo usan el frontend, `niches.json`,
  `data/` y Remotion). Si hace falta mover la carpeta, se cambia `folder` en `templates.json`.
- Nombres de carpeta en minúscula con guiones: `lyrics-mi-plantilla`, `promo-algo`.
- Créditos de medios de stock: en el `CREDITS.md` de la familia (p. ej. `nodemotion/commercial/CREDITS.md`).

---

## 4. Registro en `templates.json` y `niches.json`

Una plantilla **no existe para la app** hasta que está registrada en los dos.

### 4.1 `templates.json` (catálogo)

```jsonc
"lyrics-mi-plantilla": {
  "folder": "nodemotion/lyrics/lyrics-mi-plantilla",
  "display_name": "Mi Plantilla",               // nombre visible
  "description": "Qué hace, en una o dos frases.",
  "native_orientation": "any",                   // "any" | "16:9" | "9:16"
  "index_html": "nodemotion/lyrics/lyrics-mi-plantilla/index.html",
  "config_json": "nodemotion/lyrics/lyrics-mi-plantilla/assets/config.json",
  "vision_prompt": null,
  "config_prompt": "nodemotion/lyrics/lyrics-mi-plantilla/prompts/config_mapper.md", // null si static_config
  "remotion_component": null,                    // ruta informativa del port Remotion, o null
  "runtime_assets": ["assets/media"],            // archivos que el HTML necesita en el job (sección 5)
  "category_id": "lyrics",                       // ver "categories" al principio del archivo
  "sort_order": 40,
  "status": "ready",
  "tags": ["lyrics", "music-video"],
  "requires_image": false,
  "requires_video": false,
  "requires_lyrics": true,
  "static_config": false,                        // true = usa assets/config.json tal cual, sin IA
  "inputs": { /* qué pide al usuario: ver "//inputs" en templates.json */ }
}
```

- `category_id` es **solo la agrupación visual** en la app. El **tipo** de plantilla
  (letras, promo, imagen, video) lo decide su carpeta (`nodemotion/lyrics/…`, `nodemotion/commercial/…`).
- `inputs` declara canción, medios por slot (`kind`, `min`/`max`/`count`, `target`) y
  textos editables (`key` = ruta dentro de config, `default`, `max`). El formulario del
  Estudio y de Crear video se arma solo con esto: **no hay que tocar el frontend**.

### 4.2 `niches.json` (comportamiento)

Cada plantilla necesita **un nicho** con `template.template_id` igual al id del catálogo.
La forma más segura es **clonar el nicho de una plantilla parecida** y cambiar `id`,
`display_name` y `template.template_id`. Campos de `template` que importan:

| Campo | Para qué |
|---|---|
| `requires_lyrics` | Si la plantilla se sincroniza con la letra (activa la transcripción). |
| `requires_image` / `requires_video` | Si el job necesita un fondo subido por el usuario. |
| `media_src_filename` | Nombre con que el fondo del usuario llega al job (`bg.jpg`, `bg.mp4`). |
| `media_dimension_key` | Solo plantillas de imagen (`"img"`); las de letras usan `null`. |
| `required_config_keys` | Claves que el `config.json` generado DEBE tener. |
| `static_config` | Igual que en el catálogo. |
| `wrap_as_case_collection` | Si el config se escribe como `{"activeId","configs":[…]}`. |

Y `video.formats` declara los formatos de salida (16:9 YouTube, 9:16 Reels/TikTok…).

---

## 5. Contrato de ejecución (qué recibe el `index.html` en un job)

`src/modules/html_generator.py` arma la carpeta del job así, **todo plano al lado del HTML**:

```text
output/<job>/
├── index.html        ← copia exacta de la plantilla (nunca se regenera)
├── config.json       ← config final: el por defecto o el de la IA + textos/medios del usuario
├── song.mp3          ← audio del job (siempre se llama así)
├── lyrics.json       ← letra transcripta (si requires_lyrics)
├── bg.jpg | bg.mp4   ← fondo del usuario, con el nombre de media_src_filename
└── <runtime_assets>  ← lo declarado en runtime_assets (p. ej. media/)
```

Por eso la plantilla DEBE:

1. **Cargar el config en este orden:** `fetch("config.json")` → `fetch("assets/config.json")`
   → un `DEFAULT_CONFIG` embebido. El primero sirve en el job, el segundo en
   /plantillas, y el tercero si se abre el archivo suelto.
2. **Usar rutas relativas** (`song.mp3`, `lyrics.json`, `media/clip1.mp4`). Nunca rutas
   absolutas ni URLs a la carpeta fuente.
3. **Leer la letra de `config.lyricsUrl`.** El pipeline lo fuerza a `"lyrics.json"` y
   `config.audio.src` a `"song.mp3"`: no dependas de otros nombres.
4. **Declarar en `runtime_assets` todo archivo propio** que el HTML necesite y que no
   sea config/canción/letra/fondo (fuentes locales, clips, texturas, figuras…).
5. **Tener un solo `<audio>` principal**, el primero del documento. La vista previa de la
   app lo usa para play/pausa/seek/volumen.
6. **Medir el tiempo de la canción con `audio.currentTime`**, no con el reloj de pared.
   Todo lo que tenga que coincidir con la letra se calcula desde ese valor.
7. Funcionar **sin interacción** (sin clic para arrancar). Si una plantilla vieja usa
   `#screen` o `pointerdown`, la vista previa lo simula, pero en plantillas nuevas no.
8. Ser **responsive**: el mismo HTML se graba a 1920×1080 y a 1080×1920. En 9:16 se
   compone en un viewport de celular (540×960 CSS px a densidad 2x). Usá unidades
   relativas (`vw`, `vh`, `vmin`, `%`, `clamp()`) para que la letra no se corte.

### 5.1 Formato de `lyrics.json` (Whisper)

```json
{ "metadata": {…},
  "segments": [
    { "start": 2.98, "end": 8.22, "text": " Esa nena…",
      "words": [ { "word": " Esa", "start": 2.98, "end": 3.2 }, … ] }
  ] }
```

- La plantilla DEBE tolerar palabras con espacio inicial, segmentos sin `words` y
  alucinaciones de Whisper. Para eso hay un `lyricsFilter` en el config de las
  plantillas generadas.
- La plantilla NO DEBE traer la letra escrita en el HTML: siempre sale de `lyricsUrl`.

---

## 6. Reglas para que se pueda grabar con HyperFrames

HyperFrames **no** reproduce la página en tiempo real: la congela y la avanza cuadro a
cuadro. El reloj `nb-hf-clock` (inyectado por `optimize.py`) hace que la plantilla "crea"
que corre normal. Para que funcione, la plantilla DEBE respetar esto:

### 6.1 Fuentes de tiempo permitidas

El reloj controla todas estas, así que **se pueden usar libremente**:
- `audio.currentTime`, `video.currentTime`, `play()`, `pause()`, `ended`;
- `requestAnimationFrame` (corre a 60 Hz virtuales);
- `performance.now()`, `Date.now()`;
- `setTimeout` / `setInterval`, **solo después de pasar `optimize.py`** (los reescribe a
  `__nbSetTimeout` / `__nbSetInterval`);
- animaciones CSS (`@keyframes`, `transition`) y `element.animate()` (WAAPI);
- canvas 2D, WebGL, `OffscreenCanvas`;
- `AudioContext` + `AnalyserNode` (el espectro se calcula del audio real);
- `Math.random()` (en el render está sembrado: sale igual en todos los cuadros).

### 6.2 Prohibido (rompe la sincronización o el render)

| No usar | Por qué | Alternativa |
|---|---|---|
| `requestVideoFrameCallback`, Web Workers con timers propios | El reloj no los controla | `requestAnimationFrame` en el hilo principal |
| Contar tiempo con un contador de frames (`frame++`) | Depende de cuántos rAF hubo | Calcular desde `audio.currentTime` |
| Timers creados con `eval`, strings o alias raros (`const st = setTimeout`) | `optimize.py` no los encuentra y quedan en reloj de pared | Llamar `setTimeout(…)` directo |
| `fetch` de datos a internet en tiempo de render (APIs, JSON remotos) | El render depende de la red y no es determinístico | Archivo local en `assets/` + `runtime_assets` |
| `<video>` con sonido | Los videos se usan mudos; el audio sale de `song.mp3` | `muted = true` siempre |
| Videos de stock sin recodificar | Pocos keyframes: el render se vuelve lentísimo o se cuelga | `reencode_media.py` (sección 8) |
| Atributo `crossorigin` en `<video>`/`<audio>` de letras o promos | HyperFrames lo marca como error de composición | Archivos locales, sin `crossorigin` |
| Esperar un clic o hover para arrancar | En el render nadie hace clic | Arrancar solo al cargar |
| Escribir `window.__timelines`, `data-composition-id`, `data-start` en el HTML | Los pone el adapter; si la plantilla los trae, choca | Dejarlo al adapter |

### 6.3 Buenas prácticas de rendimiento (sin bajar calidad)

- **Crear y destruir escenas a tiempo.** Un `<video>` que ya no se ve: `pause()` y
  sacarlo del DOM (o `display:none`). El reloj solo sincroniza los videos visibles, así
  que los ocultos no cuestan nada.
- **No tener decenas de videos decodificando a la vez.** Reutilizá elementos `<video>`
  entre escenas en vez de crear uno nuevo por escena.
- **Precargar imágenes** antes de mostrarlas (`img.decode()`), no en el cuadro en que aparecen.
- **Canvas a resolución del viewport**, ni más ni menos: el adapter ya aplica densidad 2x en 9:16.
- Cada efecto nuevo pesado (blur grande, `backdrop-filter`, sombras animadas, partículas)
  suma tiempo por cuadro: medí el render antes y después (sección 10).
- **Fuentes:** casi todas las plantillas cargan Google Fonts por URL. Funciona, porque
  el reloj espera a que carguen las fuentes, pero el render necesita red. En plantillas
  **nuevas** preferí `@font-face` a un archivo local declarado en `runtime_assets`.
  **No cambies las fuentes de las existentes.**

---

## 7. Buenas prácticas generales

- **Determinismo:** dado el mismo `config.json`, la misma canción y el mismo segundo, la
  plantilla DEBE mostrar exactamente la misma imagen. Nada que dependa de la hora, del
  tamaño de la ventana durante la animación ni de entradas del usuario.
- **Todo configurable va en `config.json`**, no hardcodeado: colores, textos de marca y
  medios. Si un texto lo puede editar el usuario, declaralo en `inputs.texts` con su `key`.
- **Escalar el config, no el código:** para una variante de color o de escena, agregá
  datos al config (por ejemplo, otro caso en `configs[]`), no un `if` por plantilla.
- **Fallbacks seguros:** si falta la letra, una imagen o un video, la plantilla sigue
  mostrando algo prolijo y registra un `console.warn`. Nunca debe dejar la pantalla en blanco.
- **Sin UI de grabación propia:** el botón `#rec-btn` se eliminó de todas las plantillas;
  la grabación vive en la app. No lo vuelvas a agregar.
- **Comentarios en español, breves**, explicando el *por qué* de lo que no es obvio.
- **Peso:** los videos recodificados pesan más; es aceptado. No los comprimas con pérdida.

---

## 8. Herramientas de `_tools/` (usalas, no reinventes)

Todos los comandos se corren desde `nexa-brief-server/`.

| Herramienta | Para qué | Comando |
|---|---|---|
| `_tools/hyperframes/optimize.py` | Inserta o actualiza el reloj HyperFrames y reescribe los timers. Idempotente y reversible. | `.venv/bin/python src/templates/_tools/hyperframes/optimize.py <id>` · `--check <id>` · `--revert <id>` |
| `_tools/hyperframes/reencode_media.py` | Recodifica los videos con keyframe cada 5 cuadros (CRF 12, sin pérdida visible) y guarda los originales en `media_originals/`. | `.venv/bin/python src/templates/_tools/hyperframes/reencode_media.py <id>` · `--revert <id>` |
| `_tools/hyperframes/render_demo.py` | Graba N segundos con HyperFrames en todos los formatos del nicho y genera cuadros de control. | `PYTHONPATH=. .venv/bin/python src/templates/_tools/hyperframes/render_demo.py --seconds 30 <id>` |
| `_tools/nodemotion/promo/compiler/build/build.py` | Compila las promos por escenas desde `core.js`, un archivo de escenas y un `*.spec.json`; los diseños registrados actualizan el motor compartido. | `python3 src/templates/_tools/nodemotion/promo/compiler/build/build.py <id> …` |
| `_tools/nodemotion/promo/compiler/grade_media.py` | Pre-grada (color) el metraje de stock de las promos. | ver el docstring del script |
| `_tools/nodemotion/promo/compiler/render_promo.py` | Render cuadro a cuadro de plantillas pesadas, fuera de la app. | ver el docstring del script |

### Plantillas generadas: no editar el `index.html` a mano

| Plantillas | Generador (editar acá) |
|---|---|
| `promo-dynamic`, `promo-editorial`, `promo-kinetic`, `promo-sports`, `promo-trendy`, `promo-urban` | `_tools/nodemotion/promo/compiler/build/` (`<nombre>.js` + `promo-<nombre>.spec.json`) |
| `promo-breaking`, `promo-pulse` | `_tools/nodemotion/promo/compiler/build/promo-<nombre>.spec.json` + `runtime/player.js` y `runtime/components/` en `_tools/nodemotion/promo/designs/promo-<nombre>/` |
| `lyrics-rasgado` | `_tools/nodemotion/lyrics/compiler/torn/build/lyrics-rasgado.spec.json` + `runtime/player.js` y `runtime/components/` en `_tools/nodemotion/lyrics/designs/lyrics-rasgado/` |
| `lyrics-grunge`, `lyrics-mixtas` | `_tools/nodemotion/lyrics/compiler/grunge/build/`, `_tools/nodemotion/lyrics/compiler/mixed/build/` (se arman con el mismo `build.py`) |
| `lyrics-lluvia-gris`, `lyrics-memoria`, `lyrics-ceniza`, `lyrics-vacio` | `_tools/nodemotion/lyrics/compiler/sad/build/` (`sad-common.js` + `<nombre>.js`; ver `_tools/nodemotion/lyrics/compiler/sad/README.md`) |

Todas se arman con `_tools/nodemotion/promo/compiler/build/build.py`, que ya inserta el reloj HyperFrames
al generar. Igual, después de regenerar SIEMPRE corré `optimize.py --check <id>`
(sección 10.1). Si cambiaste un archivo de escenas compartido (`core.js`, `sad-common.js`),
**se ven afectadas todas las plantillas que lo usan**: regenerá y validá cada una.

---

## 9. Crear una plantilla nueva (paso a paso)

1. **Copiá la plantilla más parecida** como base (misma familia y mismo tipo de fondo),
   en vez de empezar de cero: así heredás el contrato de las secciones 5 y 6.
2. Prototipala primero en `$NEXA_PROFILE_DIR/sandbox/nodemotion/<id>/` (ver `sandbox/nodemotion/AGENTS.md`) y después
   creá la carpeta `nodemotion/<tipo>/<nuevo-id>/` con la estructura de la sección 3.
3. Poné en `assets/` una canción, una letra (`lyrics.json` real, formato Whisper) y los
   medios por defecto. Registrá los créditos de stock en el `CREDITS.md` de la familia.
4. Registrala en `templates.json` (4.1) y en `niches.json` (4.2), clonando la entrada de
   la plantilla base.
5. Si es `static_config: false`, escribí `prompts/config_mapper.md`: describe el JSON que
   la IA tiene que devolver, con todas las claves de `required_config_keys`.
6. Si usa videos: `reencode_media.py <nuevo-id>`.
7. `optimize.py <nuevo-id>` y después `optimize.py --check <nuevo-id>`.
8. Validá con el checklist de la sección 10.
9. **No la habilites para HyperFrames sin validar:** las plantillas de letras solo ofrecen
   HyperFrames si su id está en `HF_VALIDATED_LYRICS_TEMPLATE_IDS`
   (`src/adapters/recorder/infrastructure/hyperframes_adapter.py`). Agregala solo
   después de que pase la validación de la sección 10.4.
10. Si la plantilla todavía no está terminada, ponela en `category_id: "in_progress"`
    (aparece como «En desarrollo» en la app).

---

## 10. Checklist obligatorio después de crear o modificar una plantilla

### 10.1 Reloj y timers
```bash
.venv/bin/python src/templates/_tools/hyperframes/optimize.py <id>          # pone el reloj al día y reescribe timers nuevos
.venv/bin/python src/templates/_tools/hyperframes/optimize.py --check <id>  # DEBE dar ✓
```

### 10.2 Videos
```bash
.venv/bin/python src/templates/_tools/hyperframes/reencode_media.py <id>    # solo si agregaste o cambiaste videos
```
Si recodificó algo nuevo, verificá la calidad: SSIM ≥ 0,99 contra el original de
`media_originals/<id>/` (comando en `docs/investigaciones/hyperframes-optimizacion-2026-10.md`, paso 2).

### 10.3 Navegador y app
- Abrí la plantilla en /plantillas (tarjeta y modal): arranca sola, play/pausa/seek
  funcionan y no hay errores en la consola.
- Probala en 16:9 y en 9:16: la letra no se corta ni se sale de la pantalla.

### 10.4 Render HyperFrames
```bash
PYTHONPATH=. .venv/bin/python src/templates/_tools/hyperframes/render_demo.py --seconds 30 <id>
```
- `output/hf-demo-<id>/result.json`: los dos formatos con la resolución correcta, audio y 30 s.
- `check-16x9.png` y `check-9x16.png`: en cada cuadro está la palabra que se canta en ese
  segundo según `lyrics.json` (se acepta una anticipación de hasta ~0,15 s).
- El fondo se mueve; no hay cuadros negros ni congelados.
- **`render_demo.py` siempre graba desde el segundo 0.** Si cambiaste una parte
  posterior (por ejemplo el final), usá `--seconds` hasta cubrirla.
- Compará el tiempo de render con el anterior (`output/hf-demo-prev/`): si subió mucho,
  revisá la sección 6.3.
- El procedimiento completo, los criterios y los problemas ya resueltos están en
  **`docs/investigaciones/hyperframes-optimizacion-2026-10.md`**.

### 10.5 Tests
```bash
.venv/bin/python -m pytest tests -q
```
Tienen que pasar todos.

### 10.6 Remotion
Si la plantilla tiene `remotion_component`, el port **no** recibe tus cambios. Avisale al
usuario que hay que actualizarlo.

---

## 11. Antes de terminar: qué reportar

- Qué cambiaste y en qué archivos (generador o `index.html`).
- El resultado de `optimize.py --check`, de los tests y del render de validación, con
  los tiempos de 16:9 y 9:16.
- Cualquier cosa que no pudiste verificar, dicha explícitamente.
- No hagas `git commit` ni `git push` salvo que el usuario lo pida.


## Promos: instrucciones compartidas, sin copias por video

Para Editorial, Sports, Dynamic, Kinetic, Trendy y Urban, usa [el flujo único de promos](_tools/nodemotion/promo/production/OPERATE.md). Los prompts versionados viven en `src/templates/_tools/nodemotion/promo/production/prompts/` del servidor y se resuelven con `promo.py prompt --id ID --stage ETAPA`; nunca crees `work/instrucciones/prompts/`, copias de esos Markdown, otro productor ni scripts de campaña para repetir el flujo. Cada proyecto conserva solo la referencia de versión y hashes, sus datos y evidencias. Las reglas específicas del diseño proceden de `_tools/nodemotion/promo/production/templates/<template-id>.json` y `DESIGN.md`; no se copian al proyecto. `CLAUDE.md` incorpora este archivo mediante `@AGENTS.md`. Las recetas de crear o bifurcar una plantilla nueva no aplican a videos basados en una promo existente.

# AGENTS.md — NodeMotion: prototipos de plantillas de música

> Para cualquier agente de IA o persona que vaya a **prototipar una plantilla nueva de música**
> (video de letras, promo comercial, fondo de imagen o de video) en `sandbox/nodemotion/<id>/`
> y, cuando el usuario lo pida, **promoverla a producción**.
>
> Acá está todo lo que ya aprendimos (2026-08 → 2026-10): qué funcionó, qué no, recetas y
> checklists. **No hace falta investigar de nuevo**: si algo no está acá, mirá la fuente que se cita.
>
> - Dentro de `sandbox/nodemotion/` rigen las reglas de prototipo de este archivo.
> - Al **promover**, rige `src/templates/AGENTS.md` completo (reglas estrictas de producción).
> - Todos los comandos se corren desde `nexa-brief-server/`.

---

## 1. Qué es NodeMotion y cómo se divide

NodeMotion es la categoría **música** de Nexa Brief (`niches.json` → `categories.node_motion`).
Cada plantilla es un `index.html` autocontenido + `config.json` + canción + letra, y pasa por el
pipeline de plantillas (no por el explainer-kit, que es de NodeTech/NodeHistory/etc.).

| Subcategoría (`children`) | Carpeta de producción | Qué es | Ejemplos para copiar |
|---|---|---|---|
| `letras` | `nodemotion/lyrics/<id>/` | Video de letra sincronizado palabra a palabra con la canción | `lyrics-mixtas`, `lyrics-ceniza`, `lyrics-stylish-kinetic`, `lyrics-caution` |
| `promos` | `nodemotion/commercial/<id>/` | Promo de marca/evento/deporte: escenas con media + guion (formato Whisper) | `promo-trendy`, `promo-editorial`, `promo-kinetic` |
| `fondos` | `nodemotion/image/<id>/`, `nodemotion/video/<id>/` | Composición sobre una imagen o video del usuario (con análisis de visión) | `01-image-bg`, `subject-spotlight`, `motion-backdrop` |
| `instrumental` | — | Nichos `ambient_music` y `animated_study`: hoy **inactivos y sin plantilla** | — |

### Mapa de carpetas

```text
src/templates/
├── AGENTS.md / README.md        ← reglas estrictas de producción / resumen del catálogo
├── templates.json               ← catálogo (folder = "nodemotion/<tipo>/<id>")
├── nodemotion/                  ← PRODUCCIÓN (no se toca desde el sandbox)
│   ├── lyrics/<id>/  commercial/<id>/  image/<id>/  video/<id>/
│   └── commercial/CREDITS.md, commercial/_source/ (videos de referencia de Klickpin)
├── _tools/                      ← generadores y herramientas (producción)
│   ├── commercial/build/        ← core.js + build.py + escenas *.js + specs *.spec.json
│   ├── commercial/grade_media.py, render_promo.py
│   ├── lyrics-mixtas/build/  lyrics-grunge/build/  lyrics-sad/build/   ← specs + escenas
│   └── hyperframes/             ← optimize.py, reencode_media.py, render_demo.py, runtime/nb-hf-clock.js
└── sandbox/nodemotion/<id>/     ← ACÁ prototipás vos
```

Comportamiento (`niches.json`, raíz `nexa-brief-server/`) y catálogo (`templates.json`) están
desacoplados: una plantilla no existe para la app hasta estar en los dos (sección 2.3).

---

## 2. Flujo: idea → prototipo → validación → producción

### 2.1 Idea
1. Mirá si ya existe algo parecido (tabla de la sección 5.1). **Copiá la plantilla más parecida**
   en vez de empezar de cero: heredás el contrato y el rendimiento ya resuelto.
2. Si la idea sale de un video de referencia (Klickpin, After Effects…), dejá el mp4 en
   `sandbox/nodemotion/<id>/assets/_ref/` (no se sube a git) y anotá el link en `NOTAS.md`.
3. Si va a tener escenas con media + texto por frase, **usá el generador** (`core.js`, sección 4.2):
   es el camino más probado (13 plantillas lo usan).

### 2.2 Prototipo en `sandbox/nodemotion/<id>/`

```text
sandbox/nodemotion/<id>/        ← minúsculas y guiones: neon-tiza, collage-papel
├── index.html                  ← OBLIGATORIO
├── NOTAS.md                    ← idea, estado, qué funciona y qué no
└── assets/
    ├── config.json             ← OBLIGATORIO: todo lo configurable
    ├── song.mp3                ← OBLIGATORIO si hay música (siempre ese nombre)
    ├── lyrics.json             ← OBLIGATORIO si hay letra (formato Whisper)
    └── media/                  ← clips/fotos, nombres cortos sin espacios ni acentos
```

**Qué podés hacer acá (libertad):** diseño libre, rehacer todas las veces que haga falta, librerías
por CDN (GSAP, Three.js…; al promover se pasan a locales), Google Fonts por URL, recursos de prueba
de cualquier peso. **No hace falta** registrar, optimizar, recodificar, renderizar ni correr tests.

**Qué NO podés hacer (límites):**
- No tocar nada fuera de `sandbox/nodemotion/`: ni `templates.json`, ni `niches.json`, ni
  plantillas de `nodemotion/`, ni `_tools/`, ni backend o web. (Si el prototipo usa el generador,
  ver 4.2: se trabaja con una **copia** del spec/escenas dentro del sandbox.)
- No borrar ni pisar el prototipo de otro sin que el usuario lo pida.
- No usar `data/canales/` ni publicar en redes.
- No hacer `git commit` ni `git push` salvo pedido explícito. Los binarios grandes no se suben.

**Probar en el navegador:** servilo por HTTP (por `file://` el `fetch` del config se bloquea):
`python3 -m http.server 8800 -d src/templates/sandbox/nodemotion/<id>`. Ese servidor **no soporta
Range**: un `<video>` no puede hacer seek → precargá los videos como blob (lo hace `core.js`,
`preloadMedia()`). Los puertos 8765/8791 suelen estar ocupados por otras sesiones: verificá el
`<title>` de la página que abriste antes de sacar conclusiones.

### 2.3 Promoción a producción (solo cuando el usuario diga "promové `<id>`")

Desde acá rige `src/templates/AGENTS.md`. Orden exacto (el orden importa: `optimize.py` decide si
pone el reloj según la carpeta **registrada**; sobre una ruta sin registrar no lo pone):

| # | Paso | Cómo |
|---|---|---|
| 1 | Id definitivo | `lyrics-<nombre>` o `promo-<nombre>`. Estable para siempre (no se renombra). |
| 2 | Mover | `sandbox/nodemotion/<id>/` → `src/templates/nodemotion/{lyrics,commercial,image,video}/<id>/`. Si es generada: el spec va a `_tools/<familia>/build/<id>.spec.json` con `"out": "nodemotion/lyrics/<id>"` y se arma con `python3 src/templates/_tools/commercial/build/build.py <id>`. |
| 3 | Contrato de job | Config: `fetch("config.json")` → `fetch("assets/config.json")` → `DEFAULT_CONFIG` embebido. Un solo `<audio>`, el primero del documento. Sin botón de grabar. |
| 4 | CDN → local | Librerías a `assets/` y declaradas en `runtime_assets`. Fuentes: en plantillas nuevas preferí `@font-face` local declarado en `runtime_assets`. |
| 5 | `templates.json` | Clonar la entrada de la plantilla base; `folder`, `index_html`, `config_json`, `config_prompt` con prefijo `nodemotion/<tipo>/<id>`; `category_id: "in_progress"`; `sort_order` siguiente libre (hoy el máximo es 42); `runtime_assets` (p. ej. `["assets/media"]`, se copia con la misma ruta relativa al job); `inputs` (ver `"//inputs"` en el mismo archivo). |
| 6 | `niches.json` | Clonar el nicho de la base (`lyrics_video_mixtas` o `promo_video_trendy` son buenos moldes), cambiar `id`, `display_name`, `description`, `template.template_id`, `audio.genre`. **Agregar el id del nicho** a `categories.node_motion.children.<letras|promos|fondos>.niches` (lo exige `tests/unit/test_categories.py`: cada nicho asignado exactamente una vez). |
| 7 | Prompt IA | Si no es `static_config`: `prompts/config_mapper.md` (molde: `nodemotion/lyrics/lyrics-mixtas/prompts/config_mapper.md`; el LLM devuelve UN caso, el pipeline fuerza `audio.src`, `lyricsUrl`, `id`). |
| 8 | Créditos | Media de stock en el `CREDITS.md` de la familia (`nodemotion/commercial/CREDITS.md` como molde). |
| 9 | Videos | `.venv/bin/python src/templates/_tools/hyperframes/reencode_media.py <id>` + control SSIM (sección 6). |
| 10 | Reloj | `.venv/bin/python src/templates/_tools/hyperframes/optimize.py <id>` y después `--check <id>` (DEBE dar ✓). **Siempre**, incluso si salió de `build.py` (ver sección 9, contradicción conocida). |
| 11 | Navegador | `/plantillas` (tarjeta + modal): arranca sola, play/pausa/seek, sin errores de consola, 16:9 y 9:16 sin cortes. |
| 12 | Render HF | `PYTHONPATH=. .venv/bin/python src/templates/_tools/hyperframes/render_demo.py --seconds 30 <id>` (con el id explícito; sin args saltea `in_progress`). Validar con la sección 6. |
| 13 | Habilitar HF | Solo si pasó 12: agregar el id a `HF_VALIDATED_LYRICS_TEMPLATE_IDS` en `src/adapters/recorder/infrastructure/hyperframes_adapter.py` (promos debajo del comentario `# commercial/ …`). Aplica a todo nicho con `requires_lyrics` (las promos también lo tienen). |
| 14 | Tests | `.venv/bin/python -m pytest tests -q` (incluye `test_validated_templates_are_optimized_on_disk`). |
| 15 | Sandbox | Borrar el prototipo o dejar `NOTAS.md` apuntando a la plantilla, según diga el usuario. |
| 16 | Reportar | Archivos tocados, `--check`, tests, tiempos de render 16:9/9:16, lo no verificado. |

Sacar la plantilla de «En desarrollo» (`in_progress` → `lyrics`/`commercial`) **lo decide el usuario**.

---

## 3. Las 6 reglas mínimas + contrato de ejecución

Baratas ahora, carísimas después: sin ellas el prototipo no se graba con HyperFrames sin reescribirlo.

1. **El único reloj es `audio.currentTime`.** Nada de `frame++` ni hora real para avanzar.
   Con GSAP: timeline `paused: true` + `tl.seek(audio.currentTime)` en cada `requestAnimationFrame`.
2. **Timers directos:** `setTimeout(…)`/`setInterval(…)` llamados así (`const st = setTimeout` ❌):
   `optimize.py` los reescribe a `__nbSetTimeout`.
3. **Config primero:** todo (colores, fuentes, textos, medios, tiempos) sale de `config.json`.
4. **Rutas relativas** (`assets/song.mp3`, `assets/media/x.mp4`). Sin rutas absolutas ni `fetch`
   de datos remotos (CDN de librerías sí, solo en sandbox).
5. **Videos mudos** (`muted`), sin `crossorigin`, y **no más de 2–3 visibles a la vez**.
6. **Medidas relativas** (`vw`, `vh`, `vmin`, `%`, `clamp()`): el mismo HTML en 1920×1080 y en
   9:16 (se compone a 540×960 CSS px con densidad 2x).

Además: arranca solo (sin clic), sin botón de grabar propio, determinista (mismo config + canción +
segundo = misma imagen; aleatorio solo con PRNG sembrado, `mulberry32(C.seed)`).

**Qué recibe el HTML en un job** (`src/modules/html_generator.py`): todo plano al lado del HTML →
`index.html`, `config.json` (con `audio.src = "song.mp3"` y `lyricsUrl = "lyrics.json"` forzados),
`song.mp3`, `lyrics.json`, el fondo del usuario con el nombre de `media_src_filename` (`bg.jpg`/`bg.mp4`)
y lo de `runtime_assets` con su ruta relativa (`assets/media/…`). Si el nicho tiene
`wrap_as_case_collection`, el config llega como `{"activeId","configs":[caso]}`: leé
`raw.configs ? raw.configs[0] : raw`.

**Esqueleto mínimo:**

```html
<audio id="audio" preload="auto"></audio>
<script>
async function loadJSON(...urls) {
  for (const u of urls) { try { const r = await fetch(u); if (r.ok) return r.json(); } catch (e) {} }
  return null;
}
(async () => {
  const raw = await loadJSON("config.json", "assets/config.json");   // job → sandbox/plantillas
  const C = raw && raw.configs ? raw.configs[0] : raw;                // (+ DEFAULT_CONFIG al promover)
  const audio = document.getElementById("audio");
  audio.src = C.audio.src;
  const lyrics = C.lyricsUrl ? await loadJSON(C.lyricsUrl) : null;
  const words = (lyrics?.segments || []).flatMap(s => s.words || []);
  function frame() {
    const t = audio.currentTime;            // ← ÚNICO reloj
    // estado del segundo t: palabra actual = words.find(w => w.start <= t && t < w.end)
    requestAnimationFrame(frame);
  }
  audio.play().catch(() => {});
  requestAnimationFrame(frame);
})();
</script>
```

**`lyrics.json` (Whisper):** `{ "segments": [ { "start", "end", "text", "avg_logprob"?, "words": [ { "word": " Esa", "start", "end" } ] } ] }`.
Tolerá palabras con espacio inicial (`trim()`), segmentos sin `words` (repartí `text` en el
segmento) y alucinaciones (sección 4.1). Para una canción real: pedile al usuario que la suba en
**Recursos → Canciones** (se transcribe sola) o copiá `song.mp3` + `lyrics.json` de una plantilla.

**Ganchos de depuración recomendados** (los usan las plantillas buenas y facilitan validar):
`?t=SEG` congela un cuadro, `?debug=1` muestra un HUD con t/escena/frase, y un
`window.__<nombre>.seek(t)` que devuelve una promesa cuando los videos llegaron al cuadro.
No definas `window.__hf`, `window.__player`, `window.__timelines`, `data-composition-id` ni
`data-start`: los pone el reloj/adapter.

---

## 4. Recetas por tipo

### 4.1 Letras

**Sincronía (lo que hace `_tools/commercial/build/core.js`, copiá de ahí):**
- **Filtro de alucinaciones de Whisper** en el config (Whisper inventa texto en tramos instrumentales:
  en Grunge salió "Oriel-chan" / "Audio Jungle"):
  ```json
  "lyricsFilter": { "minLogprob": -0.6,
    "drop": ["gracias por ver", "subt[ií]tulos", "amara\\.org", "audio ?jungle", "suscr[ií]bete"] }
  ```
  Un segmento con `avg_logprob < minLogprob` o que matchea un regex se descarta. Toda canción nueva lo necesita.
- **Frases:** `lyricPhrases()` agrupa palabras en frases (`config.phrases = { maxWords: 8, maxSec: 5.5, minWords: 3 }`).
- **Línea de tiempo:** `lyricTimeline()` → una escena por frase; en huecos instrumentales largos
  repite palabras fuertes (ecos) en vez de dejar la pantalla muerta; intro con título/artista
  solo si hay ≥ ~1,2 s instrumentales; outro por el **final real del audio**, no por la letra.
  Tiempos en `config.timing = { leadSec: 0.12–0.15, holdSec, gapSec, echoSec, echoPhraseSec, cooldown }`.
  `leadSec` adelanta la palabra ~0,15 s: se acepta en la validación, más no.
- **Palabra héroe:** `heroIdx()` elige la palabra no-stopword más larga de la frase → es la que va
  gigante / en color (Caution muestra **solo** la palabra acentuada de cada frase).
- **Mazo de escenas ponderado:** `config.layouts = { <tipo>: { weight, media: [ids], trans } }`;
  `weight: 0` la banea. Variedad = que 3+ minutos no se repitan (Stylish Kinetic mezcla recetas
  pop/pinwheel/bounce/split/card después de su firma de 18 s por eso mismo).

**Motor de animación (en orden de preferencia):**

| Motor | Dónde está | Por qué |
|---|---|---|
| **Track propio** (interpola números, escribe `style` solo si cambió) | `core.js` (`class Track`), `lyrics-stylish-kinetic` | Nada se promueve a capa de compositor → ~50 fps headless 1080p. Recomendado. |
| WAAPI pausado + seek | `lyrics-caution` | Funciona y es seekable, pero cientos de animaciones pausadas = cientos de capas → ~28 fps. |
| GSAP `paused` + `tl.seek(t)` | prototipos con CDN | Válido si respetás la regla 1; al promover, GSAP local. |

Reglas del Track: los keyframes de una pista deben compartir **plantilla de string** (mismas
funciones y cantidad de números: `scale(1) translate(0%,0%)` → `scale(1.2) translate(3%,1%)`),
si no salta de golpe. **No pongas dos Tracks sobre el mismo elemento y propiedad**: anidá
(`lineNested` en `sad-common.js`: revelado sobre palabras, destrucción sobre letras, `leave()` sobre `t.box`).

**Tipografía cinética que funcionó (copiá de):**
- Cortes duros por palabra acentuada, 16 layouts, tarjetas de intro y mosaico 4×4 en el último
  hueco instrumental; rojo `#C80202`/blanco/negro, Archivo wdth 125 + Anton + Oswald → `lyrics-caution`.
- Arco/slide/type/tilt sobre colores planos, Lilita One con "i" punteada + Sniglet, loops de
  pincel SVG, motion blur direccional SVG → `lyrics-stylish-kinetic`.
- Ecos apilados, palabras gigantes con etiqueta, tickers, filas en outline, un solo acento → `lyrics-mixtas`.
- Revelados (blur, typeErase) y destrucción por letra (`drip`, `crumble`, `smokeOut`, `burnChars`) → `_tools/lyrics-sad/build/sad-common.js`.
- Acumulación con sentido (cada palabra queda en el muro, cámara con zoom/ángulo holandés/látigo) → `lyrics-expediente`.
- Clímax físico: grietas que se acumulan y el vidrio estalla revelando otro "mundo" → `lyrics-cristal` (en desarrollo, pesado).
- Separación RGB en el impacto, vaho escrito con el dedo, vidrio esmerilado → `lyrics-cristal`.

**Transiciones reales entre escenas** (`core.js`, `enterFx` + `pickTrans`):
`config.transition = { overlapSec: 0.5–0.7, weights: { burn: 3, blur: 1.5, fade: 1.2, ink: 1.2, flash: 0.8 }, flashColor, burnColor }`.
Con `overlapSec > 0` la escena anterior sigue viva debajo → disolvencias de verdad (las tristes).
Tipos: `fade · blur · iris · irisOut · wipeL/R/Up/Down · bars · rain · burn · ink · flash · zoomIn · zoomOut · slice · cut`.
Tipo fijo por escena: `layouts.<tipo>.trans`.

### 4.2 Promos (y letras por escenas) — generador `core.js`

- **Archivos:** `_tools/commercial/build/core.js` (núcleo común) + `<nombre>.js` (escenas,
  funciones `B[tipo](sc, X)`) + `<id>.spec.json`. Familias: `_tools/lyrics-mixtas/build/`,
  `_tools/lyrics-grunge/build/`, `_tools/lyrics-sad/build/` (`"js": ["sad-common.js", "ceniza.js"]` se concatenan).
- **Spec** (ver `_tools/lyrics-sad/build/lyrics-ceniza.spec.json`): `title`, `out`
  (`nodemotion/lyrics/<id>` o `nodemotion/commercial/<id>`), `js`, `about`, `fontLoads`, `css`,
  `config` (el caso: `audio`, `lyricsUrl`, `lyricsFilter`, `fonts.googleUrl`, `palette` → variables CSS,
  `grades`, `render.kbVideo`, `media[]`, `phrases`, `timing`, `transition`, `layouts`, `intro`,
  `outro`, `texture.grain`, `seed`) y, para promos, `script[]` (`lines`, `words_at`, `start`, `end`,
  `sub`) + `duration`. Sin `script` se conserva el `lyrics.json` existente (transcripción real).
- **Guion de promo:** formato Whisper, **un segmento = una escena**; `lines` parte renglones;
  en promo-urban `^palabra` = color de acento y `~palabra` = contorno.
- `build.py` escribe `index.html`, `assets/config.json` (colección) y `assets/lyrics.json`, y llama a
  `grade_media.py`. **Los `index.html` generados no se editan a mano**; si tocás `core.js` o
  `sad-common.js` afectás a todas las que lo usan: regenerá y validá cada una.
- **En el sandbox:** copiá spec + escenas a `sandbox/nodemotion/<id>/_build/` y generá con
  `"out": "sandbox/nodemotion/<id>"` (el `out` es relativo a `src/templates/`). No guardes specs nuevos
  en `_tools/` hasta promover.
- **Media de Pexels:** clave en `nexa-brief-server/.env` (`PEXELS_API_KEY`). Normalizá
  (las promos: 1280×720, 25 fps, sin audio, primeros 10 s; póster `-1.jpg`/`-2.jpg` = fotogramas
  del clip) y acreditá en `CREDITS.md`. ~6 clips por plantilla alcanzan.
- **Grading pre-horneado:** nunca filtres un `<video>` en vivo (un solo `filter` CSS: 45 → 13 fps).
  Definí `config.grades` (`{type:"duo", dark, light, contrast}` o `{type:"css", saturate, contrast, brightness}`)
  y corré `python3 src/templates/_tools/commercial/grade_media.py <ruta>/assets/config.json`
  (lo hace `build.py` solo): genera variantes y anota `media[].graded[<grade>]`. Si falta la variante,
  la plantilla aplica el filtro en vivo (anda, pero lento).
- **Ken Burns:** en fotos siempre; en video solo con `config.render.kbVideo` (escalar un `<video>`
  por cuadro: 45 → 26 fps). Alternativa barata: mover el contenedor (`footage()` en `sad-common.js`).
- **Render cuadro a cuadro fuera de la app** (para revisar una pesada):
  `python3 src/templates/_tools/commercial/render_promo.py nodemotion/commercial/<id>/index.html out.mp4 --workers 4`
  (ruta relativa a `src/templates/`; usa `window.__promo.seek`).

### 4.3 Fondos (imagen / video)

- `nodemotion/image/*` (`01-image-bg`, `subject-spotlight`, `living-landscape`) y
  `nodemotion/video/motion-backdrop`: `requires_image`/`requires_video`, `vision_prompt`
  (`prompts/vision_extractor.md`) + `config_mapper.md`; el pipeline fuerza `img.src`/`w`/`h` con las
  dimensiones de la visión (`media_dimension_key: "img"`). Sus nichos graban con **Remotion** y
  cada una tiene port en `nexa-brief-remotion/` (`remotion_component`): si cambiás el HTML, el port no se actualiza.
- `optimize.py` **no** les pone el reloj (solo `lyrics` y `commercial`). La única con HyperFrames
  real es `01-image-bg`, como composición portada aparte (`nexa-brief-hyperframes/src/image-bg-portrait`).
- Un ecualizador con `AnalyserNode` en vivo no es portable a render determinista sin el reloj: en
  la composición HF se precalcularon las magnitudes por cuadro (`hyperframes_audio.py`). En
  plantillas de letras con reloj, `AnalyserNode` sí funciona (el reloj calcula el espectro del audio real).
- Para fondos de letras: preferí **video real** a un fondo fijo con "respiración" (Neón casi no se
  mueve y cansa); `bg.jpg`/`bg.mp4` del usuario puede intercalarse como un "mundo" más (Cristal).

---

## 5. Lo que funcionó y lo que NO

### 5.1 Funcionó (copiá de acá)

| Qué | Plantilla de referencia |
|---|---|
| Generador común + spec + escenas, un mazo ponderado por frase | `lyrics-mixtas`, `lyrics-grunge`, todas las `promo-*` |
| Transiciones con solapamiento real | `lyrics-ceniza`, `lyrics-lluvia-gris`, `lyrics-memoria`, `lyrics-vacio` |
| Footage real de Pexels (pre-gradado) en vez de ilustración | `lyrics-mirada` (sepia, loops ida+vuelta), promos |
| Figura recortada sobre video: **WebM VP9 con alfa** (mix-blend-mode sobre `<video>` no mezcla en Chromium) | `lyrics-mirada` (`palomas.webm`) |
| Motor Track propio, ~50 fps headless | `lyrics-stylish-kinetic`, `core.js` |
| Grano **horneado por escena** en vez de capa full-screen con blend | `lyrics-caution`, `core.js` (`texture.grain`) |
| Narrativa por acumulación (el muro final = la canción) | `lyrics-expediente` |
| Clímax visual periódico (estallido cada ~8 s) | `lyrics-cristal` |
| Paleta: una familia análoga desaturada, texto marfil (no blanco puro), acento de letra tomado del fondo activo, un solo contrapunto frío | `lyrics-cristal` (`index1.html`, estudio de color) |
| Reutilizar canciones/letras ya transcriptas entre plantillas | tristes (copiadas de `lyrics-triste`, `lyrics-calado`, `lyrics-mixtas`) |
| Merge profundo del config de IA contra el default embebido (robusto a claves faltantes) | `core.js` (`deepMerge`), `lyrics-cristal` |

### 5.2 NO funcionó / no repetir

| No hagas | Por qué | En su lugar |
|---|---|---|
| Figuras SVG dibujadas a mano (ojos, manos, palomas) | Al usuario **no le gustaron** (Mirada Celeste v1) | Footage real de stock |
| `text-shadow` glow grande en muchas capas | Neón: ~2 fps headless sin GPU | Glow horneado, menos capas, o canvas |
| Capa de grano full-screen con `mix-blend-mode` | Caution bajó a 10 fps | Grano dentro de cada escena |
| `filter` CSS sobre `<video>` en vivo | 45 → 13 fps | `grade_media.py` |
| Escalar `<video>` por cuadro (Ken Burns de video) | 45 → 26 fps | Mover el contenedor o `kbVideo` solo si hace falta |
| Cientos de animaciones WAAPI pausadas | Capas de compositor → ~28 fps | Track propio |
| Dos animaciones sobre el mismo elemento y propiedad | Se pisan / saltan | Anidar elementos |
| Videos de stock sin recodificar | 2–3 keyframes cada 10 s: cada seek decodifica ~100 cuadros, render que no termina | `reencode_media.py` (GOP 5) |
| Decenas de `<video>` vivos/visibles | Cada visible se sincroniza por cuadro | Crear/destruir escenas a tiempo, `pause()` + quitar `src` (`dispose()` de `core.js`) |
| Letra escrita en el HTML / confiar en Whisper sin filtro | Alucinaciones en instrumentales | `lyricsUrl` + `lyricsFilter` |
| Fondo fijo y una sola "voz" tipográfica por 3 min | Monótono (Neón) | Varias voces + mazo de escenas + fondo en movimiento |
| Claves de config que el HTML principal no lee | Confunde a la IA y a quien edita (Collage) | Config = exactamente lo que el motor usa |
| Editar a mano un `index.html` generado | Se pierde al regenerar | Editar el generador |
| Guardar evidencia de render en `/tmp` | Se borró al reiniciar | `output/hf-demo-<id>/` |

---

## 6. Rendimiento y HyperFrames

- **Cómo graba HF:** congela la página y avanza cuadro a cuadro. El reloj `nb-hf-clock.js`
  (inyectado por `optimize.py`, inerte fuera del render) reproduce la plantilla **desde t=0 a 60 Hz
  fijos** hasta cada cuadro y virtualiza `performance.now`/`Date.now`, timers reescritos, `<audio>`/`<video>`,
  CSS/WAAPI y `AnalyserNode`. Todo costo por cuadro de JS se paga; mantenelo barato.
- **Rompe la sincronía o el render:** `requestVideoFrameCallback`, Web Workers con timers, contadores
  de frames, timers con alias/`eval`, `fetch` remoto en render, `<video>` con sonido o `crossorigin`,
  esperar clic/hover, escribir `window.__timelines`/`data-*` del compositor.
- **Videos:** `reencode_media.py <id>` → x264 CRF 12 slow, GOP 5, sin audio, originales en
  `_tools/hyperframes/media_originals/<id>/` (**no borrar**). Pesan ~4× más: aceptado. Control:
  `ffmpeg -i <nuevo.mp4> -i src/templates/_tools/hyperframes/media_originals/<id>/<ruta>.mp4 -lavfi "[0:v][1:v]ssim;[0:v][1:v]psnr" -f null - 2>&1 | grep -E "SSIM|PSNR"`
  → SSIM ≥ 0,99 y PSNR ≥ 45 dB. El reloj solo sincroniza videos **visibles** (y los usados en `drawImage`/`texImage2D`).
- **Costos de referencia** (30 s, segundos de render 16:9 / 9:16, 2026-10-05): Stylish Kinetic 74/80,
  Manifiesto 96/125, Collage 118/161, Neón 183/278, Mixtas 241/224, Ceniza 287/298, Promo Trendy 329/306,
  Lluvia Gris 357/345, Mirada 370/334, Promo Sports 371/361, Grunge 414/385. El 9:16 suele tardar
  más (densidad 2x): es correcto. Sin GOP corto, Grunge no terminaba en 30 min.
- **Validar (`output/hf-demo-<id>/`):** `result.json` con 1920×1080 y 1080×1920, audio y 30.000000 s;
  `check-16x9.png`/`check-9x16.png` muestran la palabra cantada en cada `checks[i].t` (hasta ~0,15 s
  antes vale; un retraso solo vale si es diseño y se ve igual en el navegador); fondo en movimiento
  (PSNR entre cuadros a 0,5 s < 60 dB); sin cuadros negros/congelados; 9:16 igual de nítido.
  Procedimiento completo y problemas resueltos: `docs/investigaciones/hyperframes-optimizacion-2026-10.md`.
- **Operación:** un render a la vez; antes, `pgrep -x chrome-headless | wc -l` debe dar 0
  (huérfanos → "Target closed"). Nunca `pkill -f` con patrones largos (se mata el propio shell).
  En zsh, `$IDS` no se separa: escribí los ids literales o `${=IDS}`. Para diagnosticar:
  `--seconds 6` y `HYPERFRAMES_RENDER_TIMEOUT_SECONDS=3600` delante del comando (no tocar `.env`/`settings.py`).
- **Nunca "arregles" el render** bajando calidad, quitando efectos o moviendo tiempos de `lyrics.json`.
  Si falla, reportá `t`, palabra esperada y vista.

---

## 7. Títulos, descripciones y primer frame (música)

Resumen de `docs/investigaciones/estrategia-cro-titulos-descripciones-2026-09.md` y de
`niches.json` → `categories.node_motion.strategy`:

- **Público:** quien busca la letra de una canción o un video para escucharla. Tono emocional, según
  el ánimo de la canción. Idioma `es-419`, cadencia diaria.
- **Fórmulas de título:** `{Artista} - {Canción} (Letra)` · `{Canción} - {Artista} | Letra en español`.
  Lo importante en los **primeros 40 caracteres**; sin MAYÚSCULAS sostenidas ni emojis de relleno
  (máx. 1 en TikTok). Provocador sí, falso no. Hashtags base: `#letras #lyrics #musica`.
- **Por plataforma:** YouTube → estrategia A (búsqueda exacta) y miniatura legible a ~210 px, 2–3
  elementos, 3–4 palabras que complementen el título. TikTok/Facebook → estrategia B (verso gancho /
  dedicatoria), 3–4 hashtags concretos (sin `#fyp`).
- **Primer frame = el título en TikTok/Reels.** Implicancias para la plantilla:
  - letra grande y legible **desde el segundo 0** (más del 80 % mira sin sonido);
  - si la canción arranca con intro instrumental, la plantilla debe mostrar algo fuerte (título/artista,
    un eco del verso) en vez de pantalla vacía;
  - cuadro legible en celular (9:16) y con alto contraste;
  - final que invite a repetir; outro corto ("Gracias / Por ver / Suscríbete · NEXA BRIEF" es el estándar del generador).
- **Riesgo de "contenido no auténtico"** (YouTube 2025–26, Meta): la misma plantilla 50 veces seguida
  es el perfil que se castiga. Cada plantilla nueva tiene que **verse distinta** de las existentes, y
  la variación interna (mazo de escenas, `seed`, media) es valor, no capricho.
- La `description` del config es metadata para marketing/SEO (2–3 frases en español: estilo, paleta,
  canción); la plantilla no la usa.

---

## 8. Checklist final antes de promover

**En el sandbox (antes de pedir la promoción):**
- [ ] Estructura de 2.2 completa; `NOTAS.md` dice qué es, qué funciona, qué falta.
- [ ] Las 6 reglas de la sección 3 se cumplen (o `NOTAS.md` explica por qué no).
- [ ] `config.json` tiene todo lo configurable, incluido `lyricsFilter`, `seed` y `description`.
- [ ] Arranca solo; play/pausa/seek no rompen; `?t=SEG` congela un cuadro correcto.
- [ ] Probado en 16:9 y 9:16 (DevTools a 540×960): la letra no se corta.
- [ ] Letra sincronizada con una canción **real** de Whisper; sin texto inventado en instrumentales.
- [ ] Una canción de 3+ min no se vuelve repetitiva (variedad de escenas/transiciones).
- [ ] Videos mudos, ≤ 2–3 visibles a la vez, sin filtros CSS en vivo sobre `<video>`.
- [ ] Se ve distinta de las plantillas existentes (sección 5.1).
- [ ] Media con créditos anotados (autor + URL de Pexels).

**Al promover (sección 2.3):**
- [ ] Carpeta `nodemotion/<tipo>/<id>/` + `templates.json` (`in_progress`) + `niches.json` + `node_motion.children`.
- [ ] CDN y fuentes resueltas; `runtime_assets` completo.
- [ ] `reencode_media.py` + SSIM; `optimize.py` + `--check` ✓.
- [ ] `/plantillas` OK; `render_demo.py --seconds 30` validado; whitelist HF; `pytest` verde.
- [ ] Reporte final con tiempos y lo no verificado. Sin commit.

**Al cerrar cualquier sesión:** sumá lo aprendido a este archivo (sección 5) para no repetir la investigación.

---

## 9. Inconsistencias conocidas (2026-10-10, verificá antes de confiar)

- `src/templates/README.md` todavía muestra el árbol viejo (`lyrics/<id>/`, `commercial/<id>/`).
  Las rutas reales son `nodemotion/<tipo>/<id>/` (como en `src/templates/AGENTS.md`).
- `src/templates/AGENTS.md` §8 dice que `build.py` "ya inserta el reloj al generar", pero `build.py`
  decide con `out.relative_to(TPL).parts[0] in HF_CATEGORIES`; con `out = "nodemotion/..."` eso da
  `nodemotion` → **no lo pone**. Por eso el paso 10 es obligatorio después de `build.py`.
  (`optimize.py` sí resuelve bien el tipo con `template_kind()`.)
- Docstrings con rutas viejas: `render_promo.py`, `grade_media.py`, `_tools/lyrics-sad/README.md`
  (`lyrics/<id>`, `commercial/<id>` → anteponé `nodemotion/`).
- `lyrics-mixtas`: en `templates.json` no es `static_config` (tiene `config_prompt`) pero su nicho dice
  `static_config: true`. Al clonar, alineá los dos.
- `tests/unit/test_drafts.py::test_create_draft_rejects_unsupported_engine_400` busca una plantilla de
  letras **fuera** de la whitelist; con todas habilitadas falla con `StopIteration`. No es bug de tu
  plantilla: avisá al usuario, no saques ids de la whitelist.

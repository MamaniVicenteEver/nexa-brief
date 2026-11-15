# promo-breaking · diseño reproducible

Promo de noticiero «Última hora»: fotos y clips en blanco y negro con tinte rojo
desde una esquina, letras gigantes claras detrás, titular Poppins extra negrita con
un tramo de letras en contorno, subrayado rojo, subtítulo muy espaciado,
decoraciones finas (cruces, rombos, líneas) y transiciones de franjas y bloque rojo.
Duración del ejemplo: **100 s (1:40), 44 escenas**.

Guía común de la familia: [../../DESIGN.md](../../DESIGN.md). Miniaturas A/B:
[MINIATURAS.md](MINIATURAS.md).

## 1. Referencia

Video de Klickpin «Email Marketing Ideas…» (pin 973340538191248321, 12 s, 960×540),
guardado en `src/templates/sandbox/referencias/nodemotion/PROMO/`. Es un opener de
noticias («BREAKING / WORLD NEWS», «ECO-NO-MIC CRISIS», filas «URGENT NEWS»,
«WORLD», «LOCKDOWN», «MEDICINE», «ECONOMY», «SPORT»). Se replicó su lenguaje
visual; **no** se copiaron sus textos, su metraje ni su música. Los momentos
equivalentes están en la tabla de la sección 12.

## 2. Archivos y orquestador

```text
promo-breaking/
├── index.html            ← GENERADO por _tools/commercial/build/build.py (no editar)
├── player.js             ← orquestador (se inserta en index.html al generar)
├── components/           ← componentes, se cargan en tiempo de ejecución
│   ├── kit.js            piezas de dibujo compartidas + parámetros globales de look
│   ├── transiciones.js   stripes · redBlock · panels · squash · zoomCut
│   ├── intro.js          intro (titular tecleado)
│   ├── escenas.js        word · stacked · repeat · flash · ticker · stat · split
│   ├── outro-v1.js       Outro v1 (por defecto)
│   └── outro-v2.js       Outro v2
├── assets/
│   ├── config.json       GENERADO desde el spec (colección {activeId, configs})
│   ├── lyrics.json       guion de 44 segmentos alineado a la música (formato Whisper)
│   ├── song.mp3          «Volatile Reaction», Kevin MacLeod (CC BY 4.0), 100 s
│   ├── media/            15 clips 1280×720 25 fps + pósteres y variantes gradadas
│   └── ejemplos/         configuraciones de ejemplo (otra campaña)
├── galeria.html          vista aislada de cada componente en el motor real
├── DESIGN.md · MINIATURAS.md
```

Fuentes editables: `_tools/commercial/build/promo-breaking.spec.json` (config por
defecto, CSS y fuentes) + `player.js` + `components/`. Regenerar:

```bash
python3 src/templates/_tools/nodemotion/promo/compiler/build/build.py promo-breaking
.venv/bin/python src/templates/_tools/hyperframes/optimize.py --check promo-breaking
```

`index.html` = núcleo común de promos (`core.js`: reloj del audio, Tracks
deterministas, medios, `?t=` para congelar) + `player.js`. El orquestador:

1. carga `components/*.js` (si no están junto al HTML, usa la copia canónica
   `/api/v1/templates/promo-breaking/showcase/components/`);
2. **valida el config** (tipos, rangos, enumeraciones, colores `#RRGGBB`, medios
   existentes); un valor inválido se corrige al valor por defecto y queda en
   `console.warn` y en `window.__promoInfo.warnings`;
3. arma una escena por segmento del guion (`config.scenes[i % n]`), fuerza la
   **intro** en la primera y el **outro** elegido en la última (si el último
   segmento dura menos que `outro.minSec`, absorbe los anteriores);
4. aplica la transición de entrada de cada escena (salvo la primera).

## 3. Componentes

Cada escena usa los renglones de su segmento (`lines`): renglón 1 = titular,
renglón 2 = complemento. `~` dentro del texto marca el tramo en contorno
(`BR~EA~KING`); sin marcas se usa `outline`.

Parámetros comunes de escena: `type`, `media` (ids de `config.media`, en orden de
uso), `trans` (transición de entrada; `auto` = sorteo con `transition.weights`).

| type | archivo | muestra | parámetros propios (defecto) |
|---|---|---|---|
| `intro` | intro.js | negro → foto B/N con tinte, letras gigantes que entran, titular tecleado, subrayado, subtítulo espaciado | `grade` mono, `tint` tl, `outline` auto, `textIn` type, `giant` true, `motion` zoom, `blackSec` 0.35 (0–2), `scale` 1 (0.5–1.5) |
| `word` | escenas.js | titular con tramo en contorno + subrayado + subtítulo sobre foto | `outline` auto, `grade` mono, `tint` auto, `giant` true, `align` center\|left, `x` 0.5 (0.15–0.85), `y` 0.5 (0.2–0.8), `scale` 1, `motion` drift, `textIn` rise, `decor` true |
| `stacked` | escenas.js | renglón 1 en sílabas apiladas (`ECO-NO-MÍA`, guiones opcionales) arriba a la izquierda + renglón 2 grande abajo | `outline`, `grade`, `tint` tl, `arrows` true (‹ ›››), `motion`, `textIn`, `scale` |
| `repeat` | escenas.js | renglones 1+2 repetidos en filas espaciadas que se deslizan, foto en rojo | `rows` 5 (3–7), `grade` red, `speed` 1 (0–2), `outline` rand, `motion` |
| `flash` | escenas.js | palabra a casi todo el ancho, corte seco con golpe de zoom | `outline`, `grade` red, `zoom` 0.1 (0–0.3), `motion`, `textIn` cut |
| `ticker` | escenas.js | titular a la izquierda + franja inferior: caja roja con punto que parpadea y barra blanca con el renglón 2 corriendo | `grade`, `tint`, `label` (≤16, defecto `brand.live`), `speed` 1 (0.3–3), `outline`, `motion`, `textIn` |
| `stat` | escenas.js | cifra del renglón 1 que cuenta (admite prefijo/sufijo y miles «4.720») + rótulo + barras | `grade`, `tint`, `countSec` 1.1 (0.3–3), `bars` true, `motion`, `outline`, `textIn` — sin cifra se dibuja como `word` |
| `split` | escenas.js | 2–4 columnas de clips que entran alternadas con separadores rojos + titular | `panels` 3 (2–4), `grade`, `tint`, `outline`, `motion`, `textIn` (usa `media[0..n-1]`) |
| `outroV1` | outro-v1.js | marca tecleada + subrayado + dirección espaciada + caja roja `brand.cta` + fundido a negro | `grade`, `tint` br, `outline`, `textIn` type, `fadeSec` 0.9 (0–3), `motion` |
| `outroV2` | outro-v2.js | pantalla roja con filas de la marca que corren + placa blanca con marca y dirección + `brand.cta` | `rows` 7 (3–9), `speed` 1, `fadeSec` 0.7, `textIn` rise |

Valores: `grade` mono\|red\|none · `tint` auto\|tl\|tr\|bl\|br\|none ·
`outline` auto\|none\|all\|alt\|rand · `motion` drift\|zoom\|still ·
`textIn` type\|rise\|squash\|pop\|fade\|cut.

Kit compartido (`kit.js`, para componentes nuevos): `marks`, `word`, `textIn`,
`underline`, `spaced`, `photo`, `giant`, `tint`, `vignette`, `decor`, `backdrop`,
`chunk`, `fitFs`, `maxW`.

## 4. Intro, escenas, outros y miniaturas

- **Intro**: siempre la primera escena (`intro.enabled: false` la convierte en `word`).
  Texto: `intro.title` / `intro.sub`, o renglones 1 y 2 del primer segmento, o `brand.name` / `brand.tag`.
- **Outro v1 / v2**: siempre la última escena (`outro.enabled: false` la convierte en
  `word`). Elección: `outro.version` (`v1` por defecto) o `?outro=v2` en la URL de
  vista previa. Texto: `outro.title` → renglón 1 del último segmento → `brand.name`;
  `outro.cta` → renglón 2 → `brand.url`; caja = `brand.cta`.
- **Miniaturas A/B**: ver [MINIATURAS.md](MINIATURAS.md).

## 5. Animaciones y transiciones

Entradas de texto (`anim.textIn` global o `textIn` por escena): `type` (letra a letra),
`rise` (letras suben desde una máscara), `squash` (se abre en vertical), `pop`
(golpe de escala), `fade`, `cut` (sin animación). `anim.speed` (0.5–2) acelera o
frena todas; `anim.intensity` (0–2) escala desplazamientos, zoom y deriva.

Movimientos: deriva lenta de las letras gigantes, Ken Burns en fotos (`motion`; en
clips solo si `render.kbVideo: true`, más costoso), filas que se deslizan en
sentidos alternos, crawl del ticker, conteo de cifras, barras que crecen,
decoraciones que parpadean y líneas que barren (`look.decor` = cantidad).

Transiciones (`trans` por escena o sorteo `transition.weights`; duración
`transition.duration`, limitada por `transition.overlapSec`, durante la cual la
escena anterior sigue visible debajo):

| nombre | efecto |
|---|---|
| `stripes` | franjas verticales blancas/rojas/negras que tapan y destapan |
| `redBlock` | bloque blanco y bloque rojo que bajan tapando y siguen de largo |
| `panels` | la escena entra en 5 columnas alternadas con separadores rojos |
| `squash` | la escena se abre desde una línea horizontal con destello |
| `zoomCut` | corte con golpe de zoom y destello |
| `cut` | corte seco |
| del motor | `fade`, `blur`, `flash`, `slice`, `wipeL`, `wipeR`, `wipeUp`, `wipeDown`, `zoomIn`, `zoomOut`, `bars`, `iris` |

## 6. Formato del JSON

`assets/config.json` = `{ "activeId": "default", "configs": [ CASO ] }`. Claves del caso:

| clave | tipo / opciones | defecto |
|---|---|---|
| `palette.red` · `deep` · `ink` · `white` | `#RRGGBB` | `#F2070F` · `#6E0006` · `#0A0A0A` · `#FFFFFF` |
| `fonts.googleUrl` · `display` · `label` | URL de Google Fonts y familias | Poppins 600–800 |
| `brand.name` · `tag` · `cta` · `url` · `live` | texto | NEXA BRIEF · NOTICIAS DEL MUNDO · SUSCRÍBETE · @NEXABRIEF · EN VIVO |
| `media[]` | `{id, type:"video"\|"image", src, poster}` | 15 clips |
| `grades.mono` · `grades.red` | `{type:"duo", dark, light, contrast}` | duotonos B/N y rojo |
| `look.tint` · `giantOpacity` · `decor` · `vignette` | 0–1 · 0–1 · 0–2 · 0–1 | 0.85 · 0.6 · 1 · 0.55 |
| `anim.textIn` · `speed` · `intensity` | enum · 0.5–2 · 0–2 | rise · 1 · 1 |
| `intro.enabled` · `title` · `sub` | bool · texto · texto | true · "" · "" |
| `outro.enabled` · `version` · `minSec` · `title` · `cta` | bool · v1\|v2 · 1.5–12 · texto | true · v1 · 3.5 |
| `transition.overlapSec` · `duration` · `weights` | 0–1 · 0.1–1 · {nombre: peso ≥ 0} | 0.5 · 0.45 · stripes 2, redBlock 2, panels 1, squash 1, zoomCut 1, cut 2 |
| `scenes[]` | objetos de la sección 3 | 44 escenas |
| `texture.grain` · `render.kbVideo` · `seed` | 0–1 · bool · número | 0.05 · false · 19 |
| `audio.src` · `lyricsUrl` | rutas relativas | el pipeline las fija en `song.mp3` / `lyrics.json` |

Ejemplo de campaña (completo en `assets/ejemplos/campana-ejemplo.json`):

```json
{
  "activeId": "festival",
  "configs": [{
    "id": "festival",
    "palette": { "red": "#FF5A00", "deep": "#5A1A00", "ink": "#0B0B0B", "white": "#FFF8F0" },
    "brand": { "name": "FESTIVAL SUR", "tag": "EDICIÓN 2027", "cta": "ENTRADAS YA", "url": "@festivalsur", "live": "HOY" },
    "anim": { "textIn": "type", "speed": 1.2, "intensity": 0.8 },
    "outro": { "version": "v2", "title": "FESTIVAL SUR", "cta": "@festivalsur · Edición 2027" },
    "transition": { "weights": { "stripes": 1, "panels": 2, "cut": 1 } },
    "scenes": [
      { "type": "intro", "media": ["towers"] },
      { "type": "stacked", "media": ["crowd"], "trans": "stripes", "arrows": false },
      { "type": "repeat", "media": ["steps"], "rows": 4, "speed": 1.5 },
      { "type": "stat", "media": ["market"], "countSec": 1.6 },
      { "type": "outro", "media": ["skyline"] }
    ]
  }]
}
```

El caso se fusiona sobre el por defecto (objetos se combinan; listas como
`scenes` y `media` se reemplazan enteras).

## 7. Cambiar contenido sin tocar código

- **Textos**: el guion (`lyrics.json`, un segmento por escena, `lines`) y `brand.*`.
  En la app: campos «Marca», «Subtítulo», «Llamada», «Dirección», «Rótulo de directo».
- **Medios**: `media[]` + `scenes[i].media`. En la app/pipeline, slot `clips` (videos,
  1–15) en el orden de `media_slot_order` del contrato.
- **Aspecto**: `palette`, `fonts`, `grades`, `look`, `anim`, `transition`.
- **Selección y orden**: `scenes[]` (cualquier orden y cantidad; se repite en ciclo),
  `intro.enabled`, `outro.enabled`, `outro.version`.
- **Variación**: `seed` (sorteos de esquina del tinte, decoraciones, transiciones `auto`).

## 8. Qué requiere código

Un tipo de escena, transición o modo de entrada que no esté en las tablas
anteriores; otra forma de tinte o de letra gigante; más de dos renglones por escena;
cambiar la fuente del núcleo (`core.js`). Se agrega como componente nuevo en
`components/` (registrar en `R.scenes`/`R.transitions` con sus `params`) sin tocar
los existentes; el validador lo incorpora solo.

## 9. Integración

- **Catálogo**: `templates.json` → `promo-breaking` (categoría `commercial`,
  `runtime_assets`: `assets/media`, `components`). **Nicho**: `promo_video_breaking`
  en `niches.json` del repo y del perfil activo (`node_motion → promos`).
- **Flujo compartido de promos**: `src/core/nodemotion/promo/prompts.py` (`TEMPLATES`),
  contrato `src/templates/_tools/nodemotion/promo/production/templates/promo-breaking.json`, esquema
  `schemas/build-breaking.json`, enum de `schemas/brief.json`. Mismos prompts
  versionados y misma CLI (`promo.py build`, `scene-overrides.json`), sin productor
  propio. El ciclo son 44 escenas: un guion de 44 segmentos de 1,4–2,4 s (62–106 s).
- **Web**: `PROMO_IDS` en `nexa-brief-web/src/features/studio/api/promo-service.ts`.
- **HyperFrames**: reloj `data-nb-hf-clock` insertado por `build.py`
  (`optimize.py --check` ✓); todo el estado sale del reloj del audio (`?t=` congela
  un instante idéntico); videos mudos, locales y recodificados con GOP 5;
  `Math.random` no se usa (semilla `mulberry32`). **No** está en la lista de
  diseños validados para HyperFrames: falta el render de validación (sección 12).

## 10. Revisar en 16:9 y 9:16

Servir la carpeta por HTTP y abrir `index.html` (`?t=12.4` congela,
`?debug=1` muestra escena y tiempo, `?outro=v2` fuerza el Outro v2). En la app:
Plantillas → Comerciales y promociones → **Promo Breaking** (vista previa en
ambos formatos). `galeria.html` muestra cada componente aislado.

## 11. Recursos y permisos

- Clips: Pixabay (Pixabay Content License, uso comercial sin atribución
  obligatoria; se acredita igual) y `stadium.mp4` de Pexels (ya acreditado en
  promo-editorial). Lista completa en `../CREDITS.md`.
- Música: «Volatile Reaction», Kevin MacLeod (incompetech.com), CC BY 4.0 —
  atribución obligatoria al publicar.
- Fuente: Poppins (SIL OFL 1.1), Google Fonts en el video y archivo local
  `nodemotion/assets/fonts/poppins-normal-800.ttf` para las miniaturas.
- Ninguna marca de la referencia se usa. Las marcas de ejemplo («NEXA BRIEF») son propias.

## 12. Pruebas y pendientes

Ver el informe al final de [MINIATURAS.md](MINIATURAS.md) y la sección «Estado».

### Estado

- Capturas deterministas en 16:9 y 9:16 de todas las escenas, transiciones a mitad
  de efecto, intro y outros v1/v2: sin errores de página.
- Validación de config comprobada con valores inválidos (avisos y valores por defecto).
- `optimize.py --check` ✓ · videos recodificados GOP 5 · tests de contrato,
  miniaturas, catálogo y CLI de promos pasan.
- **Pendiente**: render HyperFrames de validación (`render_demo.py`) y alta en la
  lista de diseños validados; prueba de un draft real en la app (crear, editar y
  guardar miniaturas A/B); redeploy de la web para `PROMO_IDS`.

Momentos equivalentes con la referencia: intro «BREAKING / WORLD NEWS» ↔ escena 1
«ÚLTIMA HORA / NOTICIAS DEL MUNDO» (0–2 s); franjas blancas/rojas ↔ entrada de la
escena 2; «ECO-NO-MIC CRISIS» ↔ `stacked` «ECO-NO-MÍA / CRISIS»; filas «URGENT NEWS»
↔ `repeat` «NOTICIAS URGENTES»; «WORLD» ↔ `word` «MUNDO»; «LOCKDOWN» (aplastado) ↔
`squash` «CIUDAD»; «MEDICINE / ECONOMY» ↔ `flash`; «SPORT» en rojo ↔ `word`
«DEPORTE» con `grade: red`; cierre con fundido ↔ Outro v1.

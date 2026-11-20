# lyrics-decadas · Décadas

Video de letras **editorial**: grotesca condensada gigante, azul eléctrico sobre negro
cálido y celeste pálido, letras enormes una a una rellenas con fotos en semitono, firmas
que se trazan, etiquetas azules que parpadean, barridos azules, textos que ruedan como un
contador, créditos tecleados y cierre con firma manuscrita.

Complementa la [guía común de NodeMotion](../../DESIGN.md). Creada el 2026-11-13
directamente en producción por instrucción expresa del usuario.

## 1. Qué reproduce y referencia

Referencia: video de Klickpin «Practical tiny lifestyle changes…» (pin
703898616798190776, 640×640, 30 fps, 9,7 s) con el título «DECADES». Solo referencia
visual: no se usan su audio, sus fotos ni su marca («Whynow»).

Colores medidos en la referencia: negro cálido `#190F06`, celeste `#E4EDF7`, azul
`#0080FD`. Momentos y su equivalente:

| Referencia | Componente |
|---|---|
| 0–1,3 s: D, E, C, A gigantes una a una (unas con foto en semitono, otras blancas), firma blanca trazada, rótulo azul vertical | intro y escena `letras` |
| 1,3–2,5 s: «DEC» → «DECADES» tecleado; etiquetas azules «DEC-97», «NOV-86» parpadeando; rejilla de puntos; marca azul pequeña | intro y escena `titulo` |
| 2,5–3 s: celeste, barra azul que nace al final de la palabra y barre la pantalla | escena `barrido`, transición `blueWipe` |
| 3–3,8 s: «CA» negras gigantes recortadas sobre foto en semitono, «1997–» azul tecleado, firma | escena `gigante` |
| 3,8–5 s: «1980 – 1997» azul rodando, «DECADES» negro vertical arriba y abajo, fragmentos con foto | escena `contador` |
| 5–7 s: «1980 – / 1990» blanco a la izquierda, «TRACEY EMIN» tecleado, rayas finas, destello de foto, «DE / ES» azules que cruzan | escena `credito`, transición `photoFlash`, fragmentos |
| destellos de foto completa | escena `foto`, transición `photoFlash` |
| letra gigante que cruza | transición `letterSlam` |
| 7–9,7 s: «PRODUCTIONS 201…» tecleado con raya, firma azul escrita que crece | Outro v1 «Firma» |

Adaptación a letras: cada **fragmento** de 1–4 palabras (`timing`) es una escena; sus
caracteres aparecen en el instante en que se canta su palabra. El «contador» de años se
traduce en un rodillo (`motion.rollGlyphs`) por el que pasa cada carácter antes de
asentarse.

## 2. Estructura y orquestador

```text
lyrics-decadas/
├── index.html              cascarón: <audio>, #stage, carga de componentes
├── player.js               orquestador (config, validación, fotos, letra, fragmentos, reloj)
├── components/
│   ├── decadas.css         estilos compartidos por el video y la galería
│   ├── core.js             azar, medida con eje de anchura, semitono por canvas, firma
│   ├── escenas.js          7 escenas + piezas (tecleo, rodillo, etiquetas, rótulos…)
│   ├── transiciones.js     cut, photoFlash, blueWipe, letterSlam
│   ├── intro.js            intro (+ NexaTemplateIntro, @nexa thumbnail-at)
│   ├── outro-v1.js         Outro v1 «Firma»
│   └── outro-v2.js         Outro v2 «Contador»
├── assets/config.json, song.mp3, lyrics.json, card-poster.webp
├── assets/fonts/           Archivo (variable), Caveat Brush, Mrs Saint Delafield + licencias
├── assets/media/           8 fotos B/N (Pixabay) + CREDITS.md
├── showcase/               galería de componentes + components.json
├── info.json, thumbnail-style.json, DESIGN.md
```

`player.js` carga y valida la config (avisos `[lyrics-decadas]`), aplica `?c=`, registra
fuentes (Archivo con ejes `wght 100–900` y `wdth 62–125 %`), convierte `media` a
semitono una sola vez al cargar (canvas, determinista), agrupa la letra en fragmentos,
asigna a cada uno escena y transición del mazo y dibuja el segundo `audio.currentTime`.
Depuración: `?t=`, `?debug=1`, `window.__decadas.seek(t)` / `.scenes()` / `.config`.

## 3. Componentes

| Nombre | Archivo | Qué muestra | JSON |
|---|---|---|---|
| `decadas.intro` | `components/intro.js` | Primeras 4 letras del título gigantes (foto/blanco alternadas), firma, rótulo azul con el artista; título tecleado con etiquetas; artista | `intro.*` |
| `decadas.escena` (siempre) | `components/escenas.js` | `letras`, `titulo`, `barrido`, `gigante`, `contador`, `credito`, `foto` | `scenes.*`, `overrides` |
| `decadas.transiciones` (siempre) | `components/transiciones.js` | `cut`, `photoFlash`, `blueWipe`, `letterSlam` | `transitions.*` |
| `decadas.fotos` | `core.js` + `player.js` | Fotos de `media` en semitono (escenas `foto`, `gigante`, rellenos de letras, destellos) | `media`, `halftone.*` |
| `decadas.etiquetas` | `escenas.js` | Rótulos azules que parpadean sobre el título | `texts.tags` |
| `decadas.firma` | `escenas.js` | Firmas trazadas sobre letras gigantes y marca azul | — |
| `decadas.fragmentos` | `escenas.js` | Trozos gigantes de `texts.label` con foto que cruzan | `motion.fragmentSpeed` |
| `decadas.outrov1` | `components/outro-v1.js` | Línea `outro.line` tecleada con raya; `outro.brand` escrita a mano en azul que crece; «title sub» debajo | `outro.*` |
| `decadas.outrov2` | `components/outro-v2.js` | Celeste: `outro.title` azul rodante, `outro.sub` en rótulos verticales, fragmentos, barra azul con `outro.feats` | `outro.*` |

Grupo `outro` (uno activo, por defecto v1); el resto son interruptores en `components`.
Sin `photos`, las escenas `foto`/`gigante` y la transición `photoFlash` salen del mazo.

### Intro
Desde 0 hasta la primera palabra, si el hueco ≥ `intro.minSec` (si no, escenas de relleno
con `texts.label`). Letras hasta `min(1,4 s, 40 %)`, tecleo hasta 75 %, artista después.
`// @nexa thumbnail-at: 3.0`.

### Outro v1 / v2
Mismo cálculo de inicio que el resto de NodeMotion: `max(última palabra + leadSec,
final − maxSec)`, mínimo `minSec`; tiempos internos proporcionales; quedan quietos al final.

### Miniaturas A y B
- `design-tokens.json` → `templates.lyrics-decadas`: **Archivo Condensed 800** en A y B
  (instancia estática `wdth 68` de la misma Archivo del video, añadida a
  `nodemotion/assets/fonts/` + `index.json` para el renderer), fondo `dark`, texto
  `white`, «LETRAS» en `blue`; en B el título va en azul (`rolesB.foreground = blue`).
- `thumbnail-style.json`: A = `solid, solid`; B = `solid, outline, solid, outline`.
- Fondo: fotograma del video con la capa común; edición y guardado por el editor real de
  la app (renderer compartido). Pendiente: probarlo con un borrador real (ver §12).

## 4. Animaciones, movimientos y transiciones

- Tecleo por carácter sincronizado con cada palabra (todas las escenas).
- Rodillo: `motion.rollSec` (s por carácter), `motion.rollGlyphs` (glifos por los que pasa).
- Deriva de escala del título: `motion.drift`. Fragmentos: `motion.fragmentSpeed`.
- Barrido azul de la escena `barrido` (último 40 % de la escena).
- Letras gigantes una a una (escena `letras`) durante la palabra más larga del fragmento.
- Transiciones de entrada: `cut`, `photoFlash` (`flashSec`), `blueWipe` y `letterSlam`
  (`wipeSec`).
- En 9:16 los fragmentos de más de `timing.splitChars` caracteres se parten en dos líneas.

## 5. Formato del JSON

`{ "activeId", "configs": [CASO] }`. Claves de `CASO` (opcionales; inválidas → defecto + aviso):

| Clave | Defecto | Opciones / rango |
|---|---|---|
| `audio.src`, `lyricsUrl`, `lyricsFilter` | como Trazo | el pipeline fuerza `song.mp3` / `lyrics.json` |
| `seed` | 23 | entero |
| `colors` | `{dark:#190F06, pale:#E4EDF7, blue:#0080FD, white:#F4F4F2, black:#050505}` | `#hex` |
| `fonts.display/brand/signature` | Archivo 72 % 800 / Caveat Brush / Mrs Saint Delafield | `{family, src, variable, stretch 50–200, weight, tracking}` |
| `media` | 8 fotos `assets/media/foto-0N.jpg` | `[{type:"image", src}]`; la app reemplaza en orden (slot «fotos») |
| `halftone` | `{enabled:true, cell:7, contrast:1.15, size:900}` | `enabled:false` usa la foto tal cual |
| `texts` | `{label:"", tags:["DIC-97","NOV-86","ENE-MAR","LADO A"], credit:""}` | `label` (rótulo vertical; vacío = título de la intro), `credit` (vacío = artista) |
| `components` | `{intro, photos, tags, signature, fragments: true, outro:"decadas.outrov1"}` | |
| `intro` | `{title:"", artist:"", minSec:1.8}` | |
| `outro` | `{title:"Gracias", sub:"por ver", feats:"Suscríbete · NodeMotion", brand:"NodeMotion", line:"NodeMotion producciones", leadSec:0.4, minSec:3, maxSec:6}` | |
| `timing` | `{leadSec:0.06, maxWords:4, maxChars:18, wordGapSec:0.45, gapSec:1.3, holdSec:0.5, splitChars:9}` | |
| `scenes` | `{deck:{letras:1.2, titulo:2.4, barrido:1.2, gigante:1.4, contador:1.6, credito:1.6, foto:0.6}, cooldown:2, letrasMaxLetters:8}` | |
| `transitions` | `{flashSec:0.1, wipeSec:0.22, deck:{cut:5, photoFlash:1.4, blueWipe:1, letterSlam:0.8}}` | |
| `motion` | `{rollSec:0.35, rollGlyphs:"0123456789", drift:0.03, fragmentSpeed:1}` | |
| `interludes` | `{minSec:0.8, maxSec:3, deck:{letras:1, foto:1, titulo:1}}` | rellenos de silencios con `texts.label` |
| `overrides` | `[]` | `{match:"palabra" \| at:segundo, scene, transition}` |

Ejemplo:

```json
{
  "activeId": "default",
  "configs": [{
    "id": "default",
    "intro": { "title": "Dueles tan bien", "artist": "Bruses" },
    "texts": { "label": "Dueles", "credit": "Bruses", "tags": ["DIC-97", "NOV-86", "LADO A"] },
    "colors": { "blue": "#0080FD" },
    "components": { "outro": "decadas.outrov2", "fragments": true },
    "scenes": { "deck": { "titulo": 3, "contador": 2, "gigante": 1.5, "credito": 1.5, "letras": 1 } },
    "transitions": { "deck": { "cut": 4, "photoFlash": 2 } },
    "overrides": [ { "match": "cuidado", "scene": "gigante", "transition": "photoFlash" } ],
    "outro": { "title": "Gracias", "sub": "por ver", "brand": "NodeMotion" }
  }]
}
```

## 6. Cambiar canción, letra, textos, medios y aspecto

Canción/letra: `song.mp3` + `lyrics.json` del job (o `assets/` en la demo). Textos:
`intro.*`, `outro.*`, `texts.*` (también desde el formulario: `inputs.texts`). Fotos:
`media` o el slot «fotos» de la app (hasta 8 imágenes; se pasan a semitono). Aspecto:
`colors`, `fonts`, decks, `halftone`, `seed`. Componentes: `components` o
`?c=decadas.outrov2`, `?c=decadas.fotos&cx=1`, `&p={"decadas.outrov1":{"brand":"Otra"}}`.

## 7. Qué requiere código

Una escena o transición nueva (registrar en `window.Decadas.registry`), video de fondo
(hoy solo imágenes), otra forma de agrupar la letra, otra composición de intro u outro.

## 8. Integración

`templates.json` → `lyrics-decadas` (`runtime_assets: player.js, components, assets/fonts,
assets/media`; slot de medios `fotos` con `target: media`; textos editables);
nicho `lyrics_video_decadas` en `niches.json` del repo y en `config/niches.json` del
perfil `profesional`, listado en NodeMotion → letras. Contrato HyperFrames igual que
Trazo (§8 de su DESIGN): `<script data-nb-hf-clock>` insertado por `optimize.py`
(`--check` ✓); **no** habilitada en `HF_VALIDATED_LYRICS_TEMPLATE_IDS`.

## 9. Revisar en 16:9 y 9:16

`index.html` servido por HTTP en ventanas 960×540 y 540×960 (`?t=`, `?debug=1`);
galería `showcase/index.html?only=decadas.escena&p={"scene":"gigante"}&aspect=16:9`.
En la app tras reiniciar el backend: /plantillas → Videos de letras → Décadas.

## 10. Recursos y permisos

- Fuentes: Archivo, Caveat Brush, Mrs Saint Delafield (SIL OFL 1.1), subconjunto latino
  woff2; licencias en `assets/fonts/`.
- Fotos: 8 imágenes de Pixabay (licencia de contenido de Pixabay: uso gratuito, sin
  atribución obligatoria; se acredita igual) en `assets/media/CREDITS.md`, convertidas a
  escala de grises y a 1280 px.
- Canción demo: «Dueles tan bien» (Bruses), la misma de `lyrics-latido`; recorte 0–107,5 s
  con fundido final, 2,6 s de silencio al inicio para mostrar la intro; letra de Latido
  con los tiempos desplazados +2,6 s. Licencia: **no verificada** para distribución
  (registrada como «unknown» en la biblioteca del perfil).

## 11. Pruebas realizadas

Iguales a Trazo: hojas de contacto 9:16 y 16:9 de los 110 s, reproducción con audio real
(~50 fps a 540×960), determinismo del escenario visible en 7 instantes, selección real de
`decadas.outrov2` por URL, galería de los 9 componentes en ambos formatos, sin errores de
consola, `optimize.py --check` ✓.

## 12. Limitaciones y pendientes

- Render HyperFrames (`render_demo.py`) no ejecutado → sin habilitar para HyperFrames.
- Backend sin reiniciar: la app aún no lista la plantilla.
- Miniaturas A/B sin probar con un borrador real en el editor.
- El semitono se calcula en el navegador al cargar (≈8 fotos × 900 px): retrasa el
  arranque unos cientos de ms. Falta comprobar en un render real que el reloj HyperFrames
  no captura cuadros antes de que termine esa preparación.
- La marca de la referencia («Whynow») se sustituye por `outro.brand`.

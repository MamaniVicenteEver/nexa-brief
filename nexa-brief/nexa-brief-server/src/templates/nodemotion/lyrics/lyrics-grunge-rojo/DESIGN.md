# lyrics-grunge-rojo · Grunge Rojo

Video de letras **grunge**: metraje urbano en blanco y negro duro, papel gris rasgado,
letra condensada blanca y roja que entra con estela, palabras gigantes con eco rojo,
filas repetidas, bloques anchos sobre papel, tiza blanca, pincel rojo, glitch y destellos.

Complementa la [guía común de NodeMotion](../../DESIGN.md). Creada el 2026-11-14
directamente en producción por instrucción expresa del usuario. **No modifica**
`lyrics-grunge`: es un diseño nuevo, más fiel a la referencia, que reutiliza copias de su
canción, su transcripción y su metraje.

## 1. Referencia y qué reproduce

Referencia: video de Klickpin «Viral Natural Makeup Looks for a Cozy Vibe» (pin
862017184941081840, 256×144, 25 fps, 68 s). Es la vista previa de una plantilla grunge
con **la misma canción** que `lyrics-grunge` (comprobado: correlación de envolvente
0,99999, desfase 0). La letra real solo dura ~28 s; en la segunda mitad la referencia
repite frases ya cantadas y cierra con un collage de todos sus elementos y la marca de
su distribuidor (no se usa).

| Momento de la referencia | Componente |
|---|---|
| Frase roja condensada con estela sobre metraje, papel rasgado abajo («BOWL FULL OF PLENTY») | escena `linea`, tiras `papel` |
| Palabra grande + resto en finas muy espaciadas («THE  H O L E  W E  B U I L D») | `espaciada` |
| Palabra gigante cortada con eco rojo + palabra espaciada («LIKE / B R A W L») | `gigante` |
| Círculo de tiza, tachón rojo, flecha bajo «MAP» | garabatos `circle`, `strike`, `arrow` |
| Iconos de reproductor alrededor de la frase («⏭ YOU'RE DON'T EVEN KNOW ◁ ▷») | `hud` |
| Tres líneas apiladas blanco/rojo («…KNOW / THE PLACE I HAD TO GO / BE MY SOUL») | `pila` |
| Frase roja dentro de un marco de tiza («MONSTER PART OF ME BUT») | `marco` |
| Frase repetida en filas anchas con mancha roja («MY WHOLE COOL») | `eco` |
| Bloque ancho en filas de tamaños distintos sobre papel («DO NOT / PUT IS ON / THE MAP») | `ancho` |
| Palabra blanca + palabra roja al lado, resto apilado en gris («COMPETIC KEEN / HELP THIS») | `dupla` |
| Flecha roja que apunta a una frase blanca («→ KELVIN RAISE TILL OFF») | `flecha` |
| Frase roja con estela fuerte y cruces de tiza («I HAVE THREESOME») | `rojo` |
| Ojos dibujados sobre un rostro, niebla, destellos | interludio `metraje` |
| Franjas rojas con texto, rejilla de frase repetida | interludios `franjas`, `rejilla` |
| Repetición de frases en la segunda mitad | `repaso` (solo frases ya cantadas) |
| Collage final | Outro v2 |

## 2. Estructura y orquestador

```text
lyrics-grunge-rojo/
├── index.html            cascarón: <audio>, #stage, #grain, carga de componentes
├── player.js             orquestador: config, validación, fuentes, texturas, videos, letra, reloj
├── components/
│   ├── grunge.css        estilos compartidos por el video y la galería
│   ├── core.js           azar, medida, texturas (desgaste, grano, papel sin costura), formas
│   ├── fondo.js          fondo de metraje / papel / oscuro, tiras rasgadas, niebla, destello
│   ├── garabatos.js      11 garabatos de tiza y pincel
│   ├── escenas.js        11 escenas de letra + entrada con estela por palabra
│   ├── transiciones.js   6 transiciones + 3 interludios
│   ├── intro.js          intro (+ NexaTemplateIntro, @nexa thumbnail-at)
│   ├── outro-v1.js       Outro v1 «Rasgado»
│   └── outro-v2.js       Outro v2 «Collage»
├── assets/config.json, song.mp3, lyrics.json, card-poster.webp
├── assets/fonts/         Anton, Oswald (variable), Archivo (variable) + licencias
├── assets/media/         6 clips B/N (Pexels) + pósters + CREDITS.md
├── showcase/             galería ?only= + components.json
├── info.json, thumbnail-style.json, CREDITS.md, DESIGN.md
```

`player.js` carga `config.json` → `assets/config.json` → `DEFAULTS`, valida (avisos
`[lyrics-grunge-rojo]`), aplica `?c=`, registra fuentes, genera texturas una vez, crea **un
`<video>` mudo por medio** y los reutiliza: al montar una escena mete su video en el
hueco del fondo y en cada cuadro lo sincroniza (`clipOff + (t − t0) × videoRate`, módulo
la duración; en pausa/congelado busca el cuadro exacto, en reproducción corrige desvíos
> 0,35 s y nunca vuelve a buscar mientras el video aún está buscando). Hasta tener
fotograma se ve el póster. Agrupa la letra en fragmentos (`timing`), elige escena,
variante y transición y dibuja `audio.currentTime`. Depuración: `?t=`, `?debug=1`,
`window.__grungeRojo.seek(t)` / `.scenes()` / `.config`.

## 3. Componentes

| Nombre | Archivo | Qué hace | JSON |
|---|---|---|---|
| `grunge.intro` | `components/intro.js` | Metraje, papel arriba/abajo, título rojo con estela, artista espaciado, corona de tiza, destello final | `intro.*` |
| `grunge.escena` (siempre) | `components/escenas.js` | Las 11 escenas | `scenes.deck`, `variants.*`, `overrides` |
| `grunge.transiciones` (siempre) | `components/transiciones.js` | `cut`, `tear`, `glitch`, `flash`, `redflash`, `blur` | `transitions.*` |
| `grunge.interludios` | `transiciones.js` | `metraje`, `franjas`, `rejilla` en silencios | `interludes.*` |
| `grunge.repaso` | `player.js` | En silencios ≥ `recap.minGapSec` vuelve a mostrar fragmentos ya cantados, uno cada `stepSec`, alternando con interludios | `recap.*` |
| `grunge.garabatos` | `components/garabatos.js` | `circle`, `arrow`, `underline`, `box`, `crown`, `bolt`, `xmarks`, `eyes` (tiza) y `strike`, `slash`, `smear` (pincel rojo) | `variants.doodles`, `variants.doodleChance` |
| `grunge.papel` | `components/fondo.js` | Tiras de papel rasgado arriba o abajo | `variants.stripChance` |
| `grunge.niebla`, `grunge.grano`, `grunge.desgaste` | `fondo.js`, `player.js`, `core.js` | Niebla sobre el metraje, grano de película, tinta gastada en las letras | `motion.grain`, `motion.distress` |
| `grunge.outrov1` | `components/outro-v1.js` | Hoja rasgada que cruza, título gigante con eco rojo, sub espaciado en rojo, subrayado, feats | `outro.*` |
| `grunge.outrov2` | `components/outro-v2.js` | Collage de frases cantadas y marcas de tiza sobre papel; franja roja con título + sub; feats | `outro.*` |

Grupo `outro`: uno activo (v1 por defecto). Los demás son interruptores en `components`.

### Intro y outros
Intro: de 0 a la primera palabra si el hueco ≥ `intro.minSec` (si no, se llena con
interludios). Outros: empiezan en `max(última palabra + leadSec, final − maxSec)`, duran
al menos `minSec` y quedan quietos al final. `// @nexa thumbnail-at: 1.8`.

### Miniaturas A y B
- `design-tokens.json` → `templates.lyrics-grunge-rojo`: **Anton 400** en A y B; fondo
  `black`, texto `white`, «LETRAS» en `red`; en B el título va en rojo (`rolesB`).
- `thumbnail-style.json`: A = `solid, outline`; B = `solid, solid, outline, solid`.
- Fondo: fotograma del video con la capa común; edición y guardado en el editor real.
  El fotograma por defecto del sistema es el segundo 12: conviene elegir uno sin texto.

## 4. Animaciones, movimientos y transiciones

- Entrada por palabra (`motion.enterSec`): `smear` (desplazamiento + estela desenfocada de
  longitud `motion.smear`) o `slam` (escala) en `gigante`/`ancho`.
- Eco rojo con temblor cada 0,07 s (`gigante`, Outro v1); deriva de escala en `pila`;
  vaivén en `rojo`; cámara lenta sobre el metraje (zoom 1,06→1,11).
- Garabatos dibujados en `motion.doodleSec`; tiras de papel que entran deslizándose;
  niebla que respira; destello que cruza.
- Transiciones de entrada (`transitions.sec`): `tear` (banda de papel rasgado que cae),
  `glitch` (franjas rojas/blancas y sacudida), `flash`, `redflash`, `blur`, `cut`.

## 5. Formato del JSON

`{ "activeId", "configs": [CASO] }`. Claves de `CASO` (opcionales):

| Clave | Defecto | Opciones / rango |
|---|---|---|
| `audio.src`, `lyricsUrl` | `assets/song.mp3`, `assets/lyrics.json` | el pipeline fuerza `song.mp3` / `lyrics.json` |
| `lyricsFilter` | `{dropPatterns: ["(?i)audio ?jungle","(?i)envato","(?i)oriel",…], maxWordSec: 3}` | regex; `(?i)` = sin mayúsculas |
| `seed` | 29 | entero |
| `colors` | `{red:#E8292E, white:#F1F1EF, black:#070707, paper:#BDBDBA, paperLight:#D6D6D2, chalk:#F5F5F2}` | `#hex` |
| `fonts.condensed/thin/wide` | Anton / Oswald 300 / Archivo 900 al 125 % | `{family, src, variable: ""\|"wght"\|"wdth", weight, stretch, tracking}` |
| `media` | 6 clips `assets/media/*.bw.mp4` con póster | `[{type:"video"\|"image", src, poster?, start?}]`; la app reemplaza en orden (slot «videos») |
| `components` | `{intro, paper, doodles, fog, grain, distress, recap: true, outro:"grunge.outrov1"}` | |
| `intro` | `{title:"", artist:"", minSec:1.6}` | |
| `outro` | `{title:"Gracias", sub:"por ver", feats:"Suscríbete · NodeMotion", leadSec:0.4, minSec:3, maxSec:6}` | |
| `timing` | `{leadSec:0.05, maxWords:4, maxChars:22, wordGapSec:0.5, gapSec:1.2, holdSec:0.5}` | |
| `scenes` | `{deck:{linea:3, espaciada:1.2, gigante:1.4, hud:0.8, pila:1, marco:0.8, eco:0.9, ancho:1, dupla:1, flecha:0.8, rojo:1}, cooldown:2}` | |
| `variants` | `{redChance:0.55, doodleChance:0.35, stripChance:0.35, footageChance:0.9, doodles:{circle:2, strike:1.2, underline:1, arrow:1, crown:0.6, bolt:0.6, slash:0.8}}` | |
| `transitions` | `{sec:0.18, deck:{cut:4, tear:1, glitch:1.4, flash:1, redflash:0.6, blur:1}}` | |
| `motion` | `{enterSec:0.14, smear:0.9, doodleSec:0.3, videoRate:1, grain:0.6, distress:0.5}` | |
| `interludes` | `{minSec:0.8, maxSec:3, deck:{metraje:1.4, franjas:1, rejilla:1}}` | |
| `recap` | `{minGapSec:4, stepSec:1.7, interludeEvery:3}` | `interludeEvery: 0` = solo repaso |
| `overrides` | `[]` | `{match:"palabra" \| at:segundo, scene, transition, doodle, color}` |

Ejemplo:

```json
{
  "activeId": "default",
  "configs": [{
    "id": "default",
    "intro": { "title": "Roll Up 20", "artist": "Pista de demostración" },
    "components": { "outro": "grunge.outrov2", "recap": true, "fog": false },
    "colors": { "red": "#E8292E" },
    "scenes": { "deck": { "linea": 3, "gigante": 2, "eco": 1, "ancho": 1 } },
    "variants": { "redChance": 0.6, "doodles": { "circle": 2, "strike": 2 } },
    "transitions": { "deck": { "cut": 3, "glitch": 2, "tear": 1 } },
    "overrides": [ { "match": "snapped", "scene": "gigante" }, { "match": "map", "scene": "ancho" } ]
  }]
}
```

## 6. Cambiar canción, letra, textos, medios y aspecto

Canción/letra: `song.mp3` + `lyrics.json` del job (o `assets/` en la demo). Textos:
`intro.*`, `outro.*` (formulario: `inputs.texts`). Medios: `media` o el slot «videos» de
la app (hasta 6; se usan como fondo; conviene metraje ya en B/N o de alto contraste, el
CSS añade contraste). Aspecto: `colors`, `fonts`, decks, `variants`, `motion`, `seed`.
Componentes: `components` o `?c=grunge.outrov2`, `?c=grunge.papel&cx=1`,
`&p={"grunge.outrov1":{"title":"Fin"}}`.

## 7. Qué requiere código

Una escena, garabato, transición o interludio nuevo (registrar en
`window.GrungeRojo.registry`), otra forma de agrupar la letra, gradación de color en vivo
del metraje (hoy se usa metraje ya graduado + contraste CSS).

## 8. Integración

`templates.json` → `lyrics-grunge-rojo` (`runtime_assets: player.js, components,
assets/fonts, assets/media`; slot de medios «videos», `target: media`; textos editables);
nicho `lyrics_video_grunge_rojo` en `niches.json` del repo y en `config/niches.json` del
perfil `profesional`, listado en NodeMotion → letras. Reloj HyperFrames insertado por
`optimize.py` (`--check` ✓). Videos ya recodificados con fotograma clave cada 5 cuadros
(los mismos de `lyrics-grunge`). **No** habilitada en `HF_VALIDATED_LYRICS_TEMPLATE_IDS`.

## 9. Revisar en 16:9 y 9:16

Servir por HTTP **con soporte de Range** (necesario para buscar dentro de los MP4; la API
de la app lo tiene, `python -m http.server` no) y abrir en 960×540 y 540×960; `?t=`,
`?debug=1`. Galería: `showcase/index.html?only=grunge.escena&p={"scene":"pila"}&aspect=9:16`.

## 10. Recursos y permisos

- Fuentes (SIL OFL 1.1): Anton, Oswald, Archivo; subconjunto latino woff2, licencias en `assets/fonts/`.
- Metraje: 6 clips de Pexels (licencia Pexels), ver `assets/media/CREDITS.md`.
- Canción y transcripción: las de `lyrics-grunge` (pista de stock con marca de agua de
  vista previa: no apta para publicar). Demo con 2,4 s de silencio inicial para la intro
  y tiempos desplazados +2,4 s. No se transcribió de nuevo.

## 11. Pruebas realizadas

Hojas de contacto de los 70 s en 9:16 (405×720) y 16:9 (800×450); reproducción real con
audio y video (57–60 fps a 540×960 y 960×540; video sincronizado dentro de 0,35 s);
galería de los 9 componentes en ambos formatos; sin errores de consola; `optimize.py
--check` ✓ (ver informe de entrega para la copia de producción).

## 12. Limitaciones y pendientes

- Render HyperFrames (`render_demo.py`) no ejecutado → sin habilitar para HyperFrames.
- La transcripción de la canción solo tiene letra real hasta ~28 s; el resto se cubre con
  repaso e interludios (no se inventa letra). Una transcripción mejor la completaría sola.
- Backend sin reiniciar: la app no la lista hasta reiniciar (catálogo en caché).
- Miniaturas A/B sin probar con un borrador real.

# lyrics-rasgado · diseño reproducible

Lyric video de tipografía cinética sobre **hojas de papel rasgado** (gris claro,
verde lima y carbón) que se arrancan unas sobre otras. Hay tres voces tipográficas:
una condensada alta (Anton), una extendida muy negra (Archivo 125 %/900) y una fina
(Archivo 112 %/300) o en contorno. Cada palabra entra en el instante en que se canta
(Whisper). Además: garabatos de marcador que se dibujan solos (X, triángulos,
círculos, palotes, rayas, flechas, tramados), pincelada lima detrás de la palabra
fuerte y un hueco de medio (video/imagen) en blanco y negro con acento lima.
Funciona con cualquier canción: dura lo que dure el audio.

Miniaturas A/B: [MINIATURAS.md](MINIATURAS.md). Guía de familia: [../../DESIGN.md](../../DESIGN.md).

## 1. Referencia

`lol_msi_'21_+_lyric_video (1080p).mp4` (24,5 s, 1920×1080), en
`src/templates/sandbox/referencias/nodemotion/PROMO/`. Es el lyric video de un
himno de esports. Se replicó su lenguaje visual. **No** se usan su canción, su
letra, su ilustración de personaje ni su marca. La demo usa «Like A Rapper» de
donnieozone (ccMixter, **CC BY 3.0**) y clips de Pixabay.

Momentos equivalentes: «PUSH UP AND STEP ON» ↔ `build`; «ENEMIES / ENEMIES» ↔
`stack2`; «ENERGY ×3» ↔ `echo3`; «AINT NO REGRETS» ↔ `warp`; «IT'S HIM (OR) ME»
sobre la ilustración ↔ `circle` con fondo `media`; «S H M A / BLAST THEM AWAY» ↔
`spaced`; «AWAY» con pincelada ↔ `brush`; «IT AINT REALLY NO COMEBACK» ↔ `rise`;
«THAT» / «IT'S MY AWARD» ↔ `giant`; «THE SQUAD / THE ANGELIC / SLUM RATS» ↔
`wide`; «CASH» ↔ `marquee`; «CAME WITH THE SWAG» tachado ↔ `strike`; «WARN YOU»
partido ↔ `tear`; hojas que se arrancan ↔ transiciones `tear`/`rip`.

## 2. Archivos y orquestador

```text
lyrics-rasgado/
├── index.html          GENERADO (_tools/commercial/build/build.py lyrics-rasgado) — no editar
├── player.js           orquestador (modo letras), se inserta en index.html al generar
├── components/
│   ├── kit.js          papel, bordes rasgados, voces tipográficas, entradas, garabatos, pincelada, medio
│   ├── transiciones.js tear · rip · slam
│   ├── intro.js        intro (medio + jirones + título)
│   ├── escenas.js      13 tipos del mazo
│   ├── outro-v1.js     Outro v1 (por defecto)
│   └── outro-v2.js     Outro v2
├── assets/config.json  GENERADO desde _tools/lyrics-rasgado/build/lyrics-rasgado.spec.json
├── assets/lyrics.json  transcripción Whisper (large-v3, palabras con tiempo) de la demo
├── assets/song.mp3     demo «Like A Rapper» (CC BY 3.0)
├── assets/media/       6 clips 1280×720 + pósteres + variante B/N
├── assets/ejemplos/    configuración de ejemplo
├── galeria.html · DESIGN.md · MINIATURAS.md
```

Regenerar: `python3 src/templates/_tools/commercial/build/build.py lyrics-rasgado`
y luego `optimize.py --check lyrics-rasgado`.

`player.js` es el mismo orquestador que el de promo-breaking y promo-pulse, en
**modo letras** (`REG.meta.mode = "lyrics"`):

1. carga `components/` (o la copia canónica `/api/v1/templates/lyrics-rasgado/showcase/components/`);
2. valida el config: paleta, tiempos, frases, mazo (`layouts`), transiciones,
   intro y outro. Los errores van a `console.warn` y `window.__promoInfo.warnings`;
3. usa `core.lyricTimeline`: parte la letra en frases (`phrases`), elige un tipo
   por frase con el mazo ponderado (`layouts.<tipo>.weight`) entre los que cumplen
   su condición (`fits`), sin repetir en `timing.cooldown` frases, sortea el fondo
   (`layouts.<tipo>.bgs`) y rellena los instrumentales largos con **ecos** de lo ya
   cantado. Antes de la primera frase va la **intro** y al final el **outro**;
4. cada escena recibe sus palabras con su tiempo (`K.words`) y las hace entrar al
   compás de la voz.

## 3. Componentes

Fondos (`bgs`): `paper` (gris), `lime`, `ink` (carbón), `media` (clip en B/N con
acento lima). En cualquier fondo puede aparecer una franja rasgada de otro color
(`look.tornEdges`).

| tipo | condición (`fits`) | muestra | parámetros (defecto) |
|---|---|---|---|
| `build` | ≤ 7 palabras | palabras condensadas que se suman con tamaños distintos e inclinación | `textIn` mask, `sizeJitter` 0.25 (0–0.5), `tiltDeg` −4 (−12–12) |
| `stack2` | 2–8 palabras | renglón extendido negro + renglón condensado | `textIn`, `swap` false |
| `echo3` | palabra fuerte ≤ 10 letras | palabra ×3: contorno / sólida / contorno + resto fino | `textIn` stamp |
| `warp` | 2–4 palabras | 1.ª palabra enorme en perspectiva + resto alternando fina/negra | `textIn` stamp, `angle` −12 (−25–25) |
| `circle` | 2–6 palabras con una ≤ 4 letras | frase condensada con la palabra corta rodeada a mano en lima | `textIn` |
| `spaced` | palabra fuerte ≤ 8 letras | letras repartidas a lo ancho que se juntan en la frase extendida | `collapseAt` 0.55 (0.3–0.9) |
| `brush` | palabra fuerte ≤ 10 letras | palabra extendida con pincelada lima detrás | `textIn` |
| `rise` | ≥ 2 palabras | frase lima que sube palabra a palabra sobre carbón + palabra en contorno | `textIn`, `outlineHero` true |
| `giant` | palabra fuerte ≤ 9 letras | palabra enorme recortada por el cuadro + rótulo | `textIn` stamp, `color` auto\|lime\|ink\|paper |
| `wide` | ≥ 3 palabras | renglones extendidos escalonados | `textIn`, `rows` 3 (2–4) |
| `marquee` | palabra fuerte ≤ 7 letras | filas enormes que corren: negra, lima y contorno | `rows` 4 (3–6), `speed` 1 (0–2) |
| `strike` | ≥ 3 palabras | frase con copia en contorno tachada encima + resto en contorno lima | `textIn` |
| `tear` | ≤ 4 palabras | frase grande partida por una franja de papel rasgado | `textIn` |
| `intro` | — | medio + jirones lima/carbón + título en tira de papel + artista | `media` true, `tiltDeg` −6 |
| `outroV1` | — | papel con título enorme, subtítulo con pincelada, créditos, garabatos, fundido | `sheet` paper\|lime\|ink, `fadeSec` 0.6 |
| `outroV2` | — | capas rasgadas lima/papel, filas del título que corren, tira de papel | `rows` 5, `speed` 1, `fadeSec` 0.6 |

`textIn`: `mask` (la palabra sube dentro de su caja), `stamp` (golpe de escala),
`type`, `fade`, `cut`. **La entrada de cada palabra no se adelanta ni se atrasa**:
sigue el tiempo de la voz (`timing.leadSec` la anticipa como mucho 0–0,6 s).

Kit (`kit.js`): `bg`, `media`, `tornBand`, `tearPath`, `line`, `enter`, `fit`,
`tilt`, `doodle` (x, tri, circle, underline, tally, hatch, cross, scribble, arrow),
`scatter`, `brush`, `later`, `hero`, `colorOn`, `accentOn`.

## 4. Intro, outros y transiciones

- **Intro**: aparece si la primera frase empieza después de ~1,2 s y hay
  `intro.title` o `intro.artist`. Con `intro.enabled: false` no aparece.
- **Outro v1 / v2**: ocupa los últimos `outro.sec` s si la letra deja una cola
  final; `outro.version` (`v1` por defecto) o `?outro=v2`. Textos: `outro.title`,
  `outro.sub` y `outro.feats`.
- **Transiciones** (`transition.weights`; también `layouts.<tipo>.trans`):
  `tear` (la hoja nueva entra rasgada con reborde de fibra), `rip` (rasgadura
  diagonal), `slam` (golpe de escala), `cut`. También sirven las del motor
  (`fade`, `slice`, `flash`…). La duración es `transition.duration`, limitada por
  `transition.overlapSec`.

## 5. JSON

| clave | opciones | defecto |
|---|---|---|
| `palette.lime` · `ink` · `paper` | `#RRGGBB` | `#90DE66` · `#262626` · `#DEDEE4` |
| `fonts.googleUrl` · `condensed` · `wide` · `thin` | URL + familias | Anton · Archivo · Archivo |
| `media[]` | `{id, type, src, poster}` | 6 clips |
| `grades.mono` | duotono del medio | `#141414` → `#EDEDED` |
| `layouts.<tipo>` | `{weight 0–10, bgs[], media[], trans, …parámetros}` | ver la tabla anterior |
| `phrases.maxWords` · `maxSec` · `minWords` | 1–12 · 0.8–8 · 1–6 | 5 · 2.4 · 2 |
| `timing.leadSec` · `holdSec` · `gapSec` · `echoSec` · `cooldown` | 0–0.6 · 0.2–3 · 0.8–8 · 0.4–4 · 0–8 | 0.1 · 0.8 · 2.2 · 1.0 · 4 |
| `look.doodles` · `tornEdges` · `tilt` · `paperGrain` · `mediaLime` | 0–2 · 0–1 · 0–2 · 0–1 · 0–1 | 1 · 0.7 · 1 · 0.5 · 0.55 |
| `anim.textIn` · `speed` · `intensity` | enum · 0.5–2 · 0–2 | mask · 1 · 1 |
| `intro.enabled` · `title` · `artist` | bool · texto · texto | true · «Like A Rapper» · «donnieozone» |
| `outro.enabled` · `version` · `sec` · `title` · `sub` · `feats` | bool · v1\|v2 · 1.5–12 · texto | true · v1 · 3.6 · Gracias · por escuchar · Suscríbete · NodeMotion |
| `transition.overlapSec` · `duration` · `weights` | 0–1 · 0.1–1 · pesos | 0.35 · 0.32 · tear 3, cut 2, rip 1, slam 1 |
| `lyricsFilter.minLogprob` · `drop[]` | número · regex | −1.0 · créditos de subtítulos |
| `seed` · `texture.grain` | número · 0–1 | 31 · 0.04 |

`audio.src` y `lyricsUrl` los fija el pipeline (`song.mp3`, `lyrics.json`). Ejemplo
completo en `assets/ejemplos/campana-ejemplo.json`:

```json
{
  "activeId": "neon",
  "configs": [{
    "id": "neon",
    "palette": { "lime": "#FF4FA3", "ink": "#16121F", "paper": "#F1ECE4" },
    "layouts": { "giant": { "weight": 3, "bgs": ["lime"] }, "marquee": { "weight": 2 }, "circle": { "weight": 1, "bgs": ["media"] }, "build": { "weight": 1 } },
    "look": { "doodles": 1.6, "tilt": 0.5 },
    "anim": { "textIn": "stamp" },
    "intro": { "title": "Mi canción", "artist": "Artista" },
    "outro": { "version": "v2", "title": "Gracias", "sub": "Sígueme", "feats": "@artista" }
  }]
}
```

## 6. Cambiar sin código / con código

Sin código: canción y letra (pipeline), textos de intro/outro, colores, familias,
medios, qué tipos salen y con qué frecuencia (pesos), fondos por tipo, parámetros
de cada tipo, entradas, transiciones, densidad de garabatos y rasgaduras, semilla.
Con código: un tipo de escena, garabato o transición nuevos (se registran en
`components/` con su `params` y `fits`; el validador los incorpora solo), o
cambiar el corte en frases del núcleo.

## 7. Integración

- Catálogo: `templates.json` → `lyrics-rasgado` (categoría `lyrics`,
  `requires_lyrics`, audio requerido, letra automática, slot `clips` para el
  fondo `media`, `runtime_assets`: `assets/media`, `components`). Nicho:
  `lyrics_video_rasgado` en el repo y en el perfil activo (`node_motion → letras`).
- Miniaturas A/B: sistema real (`draft_thumbnails.py`, renderer, `design-tokens.json`).
- HyperFrames: reloj ✓ (`optimize.py --check`); estado calculado desde el reloj
  del audio; videos locales, mudos y con GOP 5; semilla fija. **No** está en
  `HF_VALIDATED_LYRICS_TEMPLATE_IDS`: falta el render de validación.

## 8. Revisión, recursos y pendientes

Revisión: `index.html?t=SEG` (instante congelado), `?debug=1`, `?outro=v2`,
`galeria.html`; en la app, Plantillas → Videos de letras → **Rasgado**.
Recursos: canción CC BY 3.0 (atribución obligatoria: «Like A Rapper» by
donnieozone, ccmixter.org, CC BY 3.0); clips de Pixabay (ver `CREDITS.md`); Anton y Archivo (OFL).
Pendiente: render HyperFrames (`render_demo.py --seconds 30 lyrics-rasgado`) y
alta en la lista validada; prueba de un draft real con miniaturas A/B.

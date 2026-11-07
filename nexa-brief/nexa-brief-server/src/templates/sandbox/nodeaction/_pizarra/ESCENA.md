# Motor de pizarra · formato de `assets/scene.json`

Un video = **solo datos**. El `index.html` no se edita (cópialo de `../pizarra-demo/index.html` y sumá los
`characters/<id>.js` que uses). Motor: `rig.js` (esqueleto, poses, caras) · `characters/*.js` (dibujo del
personaje, ver `PERSONAJES.md`) · `props.js` (dibujos) · `pizarra.js` · núcleo `../../_proto/proto.js`
(reproductor, anclas, intro y cierre). Lienzo de diseño **1920×1080** (16:9, como la referencia).

## Tiempos
Número (s) o ancla a la voz: `"@palabra"`, `"@dos palabras"`, `"@palabra#2"`, `"@palabra:end"`, `"@palabra+0.3"`.
Sin tildes; números en cifras como Whisper (`"@1885"`). Siempre anclas.

## Estructura
```jsonc
{
  "character": "palito",                 // personaje de todo el video (PERSONAJES.md)
  "cast": { "m": { "character": "profe" } },
  "intro": { "style": "v1", "text": "POR QUÉ ^OLVIDAS^\nLO QUE ESTUDIAS", "kicker": "…", "dur": 4.5 },
  "outro": { "channel": "…", "handle": "youtube.com/@…", "dur": 6 },
  "shots": [ { "t": "@palabra", "items": [ … ] }, … ]
}
```
- **Plano (`shot`)** = corte seco; dura hasta el siguiente. Antes del primero la pizarra está vacía (la intro
  va encima): el primer plano empieza cuando termina la intro.
- Ritmo de la referencia: un plano cada 4–10 s; dentro del plano las cosas aparecen ancladas a la voz.

## Items
Todos: `type`, `x`, `y` (px en 1920×1080), `at` (aparece; por defecto al empezar el plano), `out` (se va),
`z` (orden), `move: { to: [x, y], at, dur }`, `enter` (`pop` · `fade` · `none`), `rot`, `wiggle`.

| type | campos | qué es |
|---|---|---|
| `man` | `id`, `x`, `y` (= suelo, ~1010), `h` (alto: 560–820), `character`, `look`, `poses: [{ at, pose, face }]`, `lookX` | el personaje |
| `prop` | `name`, `s` (tamaño), parámetros propios, `hold: "m:R"` (lo sostiene la mano der. de `m`), `dx`, `dy` | dibujo de línea |
| `type` | `text` o `words: [{text, at, color}]`, `size` (52), `weight`, `step` (0.16 s por palabra), `maxW`, `align`, `serif` | texto tipeado palabra por palabra |
| `arc` | `text`, `size`, `radius` (≈ 700–900), `dur` (lo que tarda en escribirse) | título en arco ("THE 5-MINUTE HABIT") |
| `script` | `text`, `size`, `tilt`, `color` (#127a3d) | rótulo verde manuscrito ("Last Step") |
| `label` | `text`, `size` (26) | rótulo chico |
| `rule` | `w`, `lw` | rayita bajo un dato |
| `vs` | `h` | divisor vertical con "VS" |

**Poses**: `stand` · `wave` · `think` · `point` · `pointL` · `shrug` · `shock` · `hold` · `write` · `talk` · `cheer`.
**Caras**: `smile` · `grin` · `worried` · `shock` · `think` · `talk`.
**Dibujos** (`props.js`): `clock` (`hour`, `spin`) · `bulb` · `enigma` · `letter` (`text`, `color`) · `rotor` ·
`papers` (`from`, `to`, `grow`) · `paper` · `lock` · `x` · `check` · `arrow` (`len`, `curly`, `bow`, `color`, `draw`) ·
`universe` · `envelope` · `question` · `sub` (+ los que se agreguen: ver la lista en `props.js`).

- Paquete props/estudio.js: exam (q) · book (open, title) · card (text, back, flipAt) · brain (glow) · eye · hourglass (dur) · curve (points, draw, flat, labels) · calendar (days, marks, markAt) · bubble (text, kind, tail) · magnifier · plant · puzzle (pieces, joinAt) · star · bed · moon · syllables (items) · percent (text, strike) · scientist · columns (left, right) · pile (n, split, splitAt).

## Reglas de la referencia
- Un personaje grande (h 700–820) a un costado + 1–3 dibujos + ≤ 6 palabras en pantalla. Mucho aire.
- Texto negro DM Sans; un solo acento de color por plano (verde `script`, rojo flecha, amarillo/azul cifras).
- Títulos de sección en arco ("PASO 1 — …") al empezar cada capítulo.
- Nada de fotos ni colores de fondo: la pizarra es siempre gris claro.

## Revisar
`?t=42` congela · clic/espacio = pausa · ←/→ = 5 s. `window.__promo.missingAnchors()` = anclas no encontradas.

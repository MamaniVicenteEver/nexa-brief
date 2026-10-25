# fronteras-demo · prototipo de mapas satelitales (NodeHistory)

Réplica del estilo de los 3 videos de `sandbox/referencias/nodehistory/mapas-con-banderas/` (Bolivia y sus territorios, guerra en
Ucrania, "países que podrían nacer"). Prototipo, 2026-10-22. No es un video para publicar.

## Material reutilizado (sin gastar voz)

- Voz, letra y fotos: `nodehistory/muro-de-berlin`, recortado a 0–58 s (hasta "…libertad para viajar").
  `assets/song.mp3` con fundido final; `assets/lyrics.json` filtrado a las palabras de ese tramo.
- Fotos: `schabowski`, `mauerbau`, `muro-gente`, `leipzig` (créditos en `assets/media/CREDITS.md`).
- Satélite: NASA Blue Marble Next Generation, julio 2004 con batimetría (dominio público),
  convertido a Mercator y graduado con `scratchpad/tools/sat.py` → `sat-world.jpg` (15 px/°),
  `sat-europa.jpg` (100 px/°), `sat-berlin.jpg` (240 px/°).

## Lo estándar (motor `../_mapas/mapas.js`, igual en todos los videos)

| elemento | cómo se ve |
|---|---|
| fondo | satélite oscurecido + viñeta; el océano azul marino |
| país marcado (`fill`) | color saturado que deja ver el relieve, destello al aparecer, borde claro con halo neón adentro y afuera |
| zona en disputa | `hatch` (rayado diagonal que se desliza) |
| frontera / muro / ruta (`line`) | línea brillante que se dibuja; `arrow: true` = flecha de recorrido |
| rótulos (`label`) | caja negra con letra blanca · `big` = cursiva blanca gigante · `sea` = océano azul brillante |
| banderas (`flag`) | medallón con aro blanco o `pole` (mástil al viento) |
| `year` | año en pastilla roja brillante · `big` = cifra central con mapa oscurecido |
| `photo` | retrato en círculo con aro blanco y rótulo · `dot` punto que late · `crowd` multitud de puntos |
| subtítulos | MAYÚSCULAS amarillas con borde negro, 4 palabras, desde `lyrics.json` |
| cámara | viaja y hace zoom (escala logarítmica, `hop` = se aleja en medio del viaje), deriva constante |

## Lo que cambia por video (solo `assets/scene.json`)

Textos, colores de cada país, regiones (`regions`: unión de países, país recortado por un polígono,
polígono propio), qué se marca y cuándo (`"@palabra"`), keys de cámara y fotos.

## Aproximaciones de este prototipo

- La frontera interalemana y Berlín Oeste/Este son polígonos aproximados a mano (sirven para el prototipo,
  no como cartografía exacta). Checoslovaquia = Czechia + Slovakia actuales.
- En el zoom a Berlín la textura satelital es blanda (500 m/píxel); la referencia también se ablanda.

## Ver / grabar

`python3 -m http.server -d src/templates 8800` → `http://127.0.0.1:8800/sandbox/nodehistory/fronteras-demo/`
(`?t=27` congela). Render: `render_promo.py sandbox/nodehistory/fronteras-demo/index.html … --size 1080x1920`.

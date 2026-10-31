# Motor de mapas · formato de `assets/scene.json`

Un video = **solo datos**. El `index.html` no se edita (cópialo de `../fronteras-demo/index.html`).
Motor: `geo.js` (lugares, regiones, encuadres) · `camera.js` (vuelo fluido) · `layers.js` (capas) ·
`flags.js` (banderas) · `places.json` (lugares con nombre) · `mapas.js` · núcleo `../../_proto/proto.js`
(reproductor, anclas, subtítulos, intro y cierre).

## Tiempos
Número (s) o ancla a la voz: `"@palabra"`, `"@dos palabras"`, `"@palabra#2"` (2.ª vez), `"@palabra:end"`,
`"@palabra+0.4"`. Sin tildes ni signos; números como los escribe Whisper (en cifras: `"@1879"`).
**Siempre anclas**, nunca segundos a ojo. Una palabra repetida → `#n` o una frase de 2–3 palabras.

## Lugares y regiones (no repetir coordenadas)
- Lugar: `"Antofagasta"` (de `places.json` o `scene.places`), `"Bolivia"` (centro del país) o `[lon, lat]`.
- Los `poly` se recortan SOLOS contra la tierra firme (no cruzan el mar; `"land": false` lo apaga) y, con
  `"within": "Chile"` (o una lista), contra esos países: el polígono puede ser un cuadro grueso y el borde sale real.
- Región: país en inglés de Natural Earth (`"Bolivia"`, `"Chile"`) o alias en español de `places.json`,
  o definida en `scene.regions`:
  ```jsonc
  "regions": {
    "LitoralBoliviano": { "poly": ["Cobija", [-70.2, -21.5], [-67.5, -21.5], [-67.5, -24.5], "Antofagasta"], "within": "Chile" },
    "Checoslovaquia":   { "union": ["Czechia", "Slovakia"] },
    "RDA":              { "of": "Germany", "cut": [[10.9, 54.4], …] }   // país recortado por un polígono
  },
  "places": { "Hito Cajón": [-67.0, -22.9] }                             // lugares propios del video
  ```

## Cámara (`camera[]`) — fluida, sin cortes
Cada key es un destino; vuela desde donde esté (aleja y acerca sola en saltos largos) y nunca queda quieta.
```jsonc
{ "t": "@Antofagasta", "focus": ["Antofagasta", "Calama"], "pad": 0.3 }   // encuadre automático
{ "t": "@1879", "focus": "Bolivia", "dur": 2.4 }                           // un país entero
{ "t": "@mar", "c": "Antofagasta", "span": 3 }                             // centro + grados visibles
```
Campos: `focus` (lugares/regiones) + `pad` (0.18) + `minSpan` (1.2°) · o `c` + `span` · `zoom` (×) ·
`offset` [dx, dy] · `dur` (auto 1,2–4,2 s según distancia) · `ease` (`inOut` | `out` | `smooth`) ·
`drift` (0.012 zoom lento) · `pan` [dx, dy] · `portrait` / `landscape` {…} (pisa solo en ese formato).
Ritmo: una key cada 3–8 s; no más de 2 por frase.

Al empezar una key, la cámara conserva la velocidad que traía, incluso si interrumpe otro vuelo o
la deriva. La corrección dura como máximo 0,45 s y nunca supera el 30 % de la duración del vuelo;
depende solo de `t`, así que los seeks adelante, atrás y fuera de orden reproducen la misma pose.

## Capas (`layers[]`)
Todas: `type`, `t` (aparece), `out` (se va), `fade` (0.35), `fadeOut` (0.35).

| type | campos | qué es |
|---|---|---|
| `fill` | `region`, `color`, `hatch` (true o color), `border` (color o false), `strength`, `flicker` (ancla) | país/región pintado con borde neón (rojo `#e3122a`, azul `#1d4fff`, verde `#36d41a`, violeta `#8a1cff`, naranja `#ff7a12`, celeste `#18c3e6`, amarillo `#ffd21a`) |
| `line` | `pts` [lugares] o `from`/`to`, `color`, `w`, `draw` (s que tarda), `closed`, `smooth`, `bow`, `dash`, `arrow` | frontera, muro, ruta, río |
| `arrow` | igual que `line` (`bow` 0.18 por defecto) | avance, invasión, migración |
| `label` | `text`, `at`, `size` (30), `style` (`tag` · `big` · `sea`), `rot`, `dx`, `dy`, `mapScale` (crece con el zoom), `color` | rótulos |
| `pin` | `at`, `text`, `side` (`right` · `left` · `top` · `bottom`), `size` | ciudad o puerto |
| `icon` | `at`, `icon` (`battle` · `anchor` · `mine` · `star`), `text`, `color`, `size` | batalla, puerto, mina |
| `flag` | `flag` (id de flags.js), `at`, `style` (`badge` · `pole`), `size` | bandera |
| `photo` | `src` (assets/media/…), `at`, `size`, `name`, `focus` [x,y], `gray` | retrato/foto en círculo |
| `year` | `text`, `y` (0.70), `size`, `color` | año en pastilla roja |
| `big` | `text`, `sub`, `size`, `color` | cifra grande con el mapa oscurecido |
| `dot` | `at`, `color`, `r` | punto que late |
| `crowd` | `at`, `n`, `radius`, `spread`, `color` | multitud / tropas como puntos |

Orden: los `fill` se dibujan primero; el resto en el orden de la lista.

## Subtítulos (`captions`)

La escena puede sobrescribir los subtítulos del tema dentro de `assets/scene.json`; el motor combina
estos valores con su tema, así que otras plantillas mantienen sus valores hasta que los configuren.

```jsonc
"captions": {
  "maxWords": 4,
  "size": 30.6,
  "y": 0.890208,
  "yLandscape": 0.924259,
  "color": "#ffd21a"
}
```

`size` está en píxeles de diseño para un lado corto de 1080 px y escala con el lienzo; el motor de
mapas aplica además un factor de 1,1 en horizontal. `y` (vertical) y `yLandscape` (horizontal) son
fracciones de la altura del lienzo y sitúan el centro del texto. Para bajarlo 10 px de diseño en los
cuadros estándar 1080×1920 y 1920×1080, se suma respectivamente `10/1920` a `y` y `10/1080` a
`yLandscape`. El tema de mapas usa `enabled: true`, `maxWords: 4`, `gap: 0.45`, `size: 36`,
`y: 0.885`, `yLandscape: 0.915`, `color: "#ffd21a"`, `upper: true`, `weight: 800`,
`font: "Montserrat, sans-serif"`, `stroke: true` y `strokeColor: "#000"`. La escena sobrescribe
solo los campos que incluye. `maxWords` limita palabras por grupo, `gap` es la pausa máxima entre
palabras en segundos y `enabled: false` desactiva los subtítulos; `upper`, `weight`, `font`, `stroke`
y `strokeColor` ajustan mayúsculas, grosor, familia y contorno.

## Intro, cierre, satélite
```jsonc
"intro": { "style": "v1", "text": "CÓMO BOLIVIA\nPERDIÓ EL ^MAR^", "kicker": "Guerra del Pacífico · 1879", "sub": "…", "dur": 5 },
//        o { "style": "v2", "question": "¿…?", "answer": "…", "revealAt": 3, "dur": 5 }
"outro": { "channel": "NODEHISTORY", "handle": "youtube.com/@nodehistory", "dur": 6 },
"sat": [{ "src": "../_mapas/media/sat-sudamerica.jpg", "bounds": [lonO, lonE, latS, latN] }],
"dim": 0.3
```
- La intro va encima de lo que haga la cámara en esos segundos (convención: vuelo del mundo a la región
  mientras se pintan los países de la historia, como `atlas.introv1`). `'^x^'` = palabra en amarillo.
- El cierre se agrega solo: ocupa los últimos `outro.dur` s (la voz deja ~6 s de cola).
- Satélite: el mundo (`sat-world.jpg`) va siempre; agregá recortes de detalle del motor
  (`../_mapas/media/sat-*.jpg`) o del video (`assets/media/`).

## Ventana de medio (`assets/overlays.json`)

El archivo es opcional (si no existe, no se dibujan ventanas). También se puede elegir otra ruta con
`configs[0].overlaysUrl` o para una prueba con `?overlays=work/overlays-test.json`.

```jsonc
{
  "defaults": { "opacity": 0.88, "w": 34, "margin": 4 },
  "items": [
    {
      "id": "abaroa", "at": "@eduardo abaroa", "dur": 7, "kind": "photo",
      "src": "assets/media/abaroa.jpg", "aspect": "4:5",
      "caption": "Eduardo Abaroa (1838–1879)",
      "credit": "Autor desconocido · Dominio público · Wikimedia Commons",
      "context": false, "corner": "auto", "x": null, "y": null,
      "w": null, "h": null, "focus": [0.5, 0.35], "kenburns": 1.06
    },
    {
      "id": "tren", "at": "@construir un ferrocarril", "dur": 12, "kind": "video",
      "src": "assets/media/tren.mp4", "start": 3, "aspect": "16:9",
      "caption": "Ferrocarril", "credit": "Crédito del video"
    }
  ]
}
```

`at` acepta las anclas de voz documentadas arriba o segundos; `dur` y `start` están en segundos.
`opacity` va de `0` (transparente) a `1` (opaco) y puede ir en `defaults` o en cada elemento; el
valor inicial es `0.88`. `w` es el ancho como porcentaje del ancho del cuadro (inicial `34`), y
`margin` es el margen como porcentaje del lado menor (inicial `4`). Los campos `x` y `y` posicionan
la esquina superior izquierda como porcentajes del ancho y alto del cuadro; `w` y `h` son porcentajes
de esos mismos ejes. Si `x` o `y` se omiten o son `null`, `corner` y `margin` eligen la posición; si
`h` se omite, se calcula desde `aspect`. La altura máxima es 46 % del cuadro. `corner` acepta `auto`,
`tl`, `tr`, `bl` o `br`; `auto` elige la esquina con menos puntos del mapa y conserva la elección
hasta un resize.
Las ventanas se ocultan durante el cierre. Las fotos admiten `focus` y `kenburns`; `context: true`
agrega el rótulo «IMAGEN DE CONTEXTO».

Usá solo medios con licencia de Dominio Público, CC0, CC BY, CC BY-SA, Pexels o Pixabay. Cada foto o
video requiere `credit` con autor/fuente y licencia; la atribución aparece debajo de la ventana.

## Revisar
`?t=42` congela · clic/espacio = pausa · ←/→ = 5 s. Hoja de cuadros: Playwright con
`window.__promo.seek(t)`. `window.__promo.missingAnchors()` lista las anclas que no encontró.

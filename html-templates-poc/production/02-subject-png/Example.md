# 02 — Imagen sin fondo / PNG (caso #2) — AURA, config.json externo

Caso: un PNG **sin fondo** (solo el sujeto — persona, criatura, auto — con
alfa real). No hay nada que medir de un fondo porque no existe: la IA
**diseña** el fondo (colores fuertes, puros, profesionales), centra el
sujeto, y pone UNA palabra gigante detrás — máximo 1-2 palabras, nunca una
frase — con levitación suave, glow de piso y partículas.

`index.html` es la plantilla ESTÁTICA (motor CSS+JS, nunca se regenera).
Carga su configuración en runtime con `fetch("config.json")` — igual patrón
que `../01-image-bg/`. El Prompt 2 ya no devuelve HTML: devuelve SOLO el
JSON que va a `config.json`.

**Por ahora el motor solo tiene UN layout: sujeto y palabra centrados** —
la variante "side-split" (sujeto a un costado + columna de palabras cayendo)
se probó y se dejó de lado por ahora; ver "Por qué se sacó side-split" más
abajo. Si se retoma en el futuro, que sea agregando un segundo modo al
mismo `config.json` (como `bgMode` en el caso 01), nunca un segundo HTML.

- `example/` — 3 piezas de referencia hechas a mano (standalone, no usan el
  motor) que son la vara de calidad a igualar — literalmente el estilo que
  `index.html` copia: `example1-baki.html` y `example2-goku.html` son el
  molde exacto (radial de un solo color puro + `<h1>` gigante centrado en
  Montserrat 900 + personaje en escala de grises con `mix-blend-mode:
  luminosity` + glow de piso + HUD de marca arriba a la derecha).
  `example3-boombap.html` es una referencia de paleta/HUD distinta, no de
  layout.
- `img/` — PNGs de sujeto con alfa real (`5.png`, `6.png`).
- `pruebas-ia/` — verificación real con Playwright headless (16:9 y 9:16),
  confirmando que la palabra gigante NUNCA desborda el ancho de pantalla.
  Ver `pruebas-ia/README.md`.

## Flujo de armado

PNG sin fondo → **Prompt 1** (visión + dirección de arte) → JSON →
**Prompt 2** → `config.json` → colocar `config.json` + `img/subject.png`
(+ `song.mp3` opcional) junto a `index.html` → listo.

## Nota sobre la tipografía (Montserrat, requiere internet)

`index.html` carga Montserrat 900 vía Google Fonts (`@import`), igual que
`example1-baki.html`/`example2-goku.html` — es la tipografía que define el
look de este caso, no Arial Black. El stack de fallback
(`'Montserrat','Arial Black','Helvetica Neue',sans-serif`) cubre el caso sin
internet (se ve en negrita igual, solo cambia la fuente exacta), pero esto
sigue siendo la misma dependencia de red ya señalada como pendiente en el
roadmap general (`../README.md`, mejora #5 "empaquetar fuentes de Google en
local"). Si el recorder de producción corre sin internet, hay que instalar
Montserrat como fuente local (`fc-list` para confirmar) antes de grabar en
serio — no bloquea las pruebas de hoy porque este entorno sí tiene salida a
internet.

---

## PROMPT 1 — VISION EXTRACTOR & ART DIRECTOR (P4 — AURA, layout único centrado)

```text
SYSTEM PROMPT: Subject-Only Vision Extractor & Art Director (P4 — AURA, Centered/Bottom Smart Alignment)

You are an expert Subject Analyst and Poster Art Director. You will receive ONE image of an ISOLATED SUBJECT on a transparent background (a person, car, creature, product...). There is NO background to measure — instead, YOU DESIGN the background, the composition, and the physical alignment rules. The engine has ONE dynamic layout: subject centered or bottom-anchored, one giant word behind it. Precision and taste are both mandatory.

COORDINATE SYSTEM

Detect the TRUE native resolution in px (including transparent area).

All coordinates are absolute px, top-left = (0,0).

WHAT YOU MUST EXTRACT & DECIDE (5 LAYERS)

LAYER 1 — SUBJECT IDENTITY & CROP STATE

label: what it is, in 3-6 words.

known_name: if it is a RECOGNIZABLE character/car/celebrity, its name (e.g. "TOJI", "GOKU", "BAKI"); empty string if not recognizable.

attitude: the emotional read (menacing / heroic / serene / feral...).

crop_state: Analyze the visual crop of the image to determine physical alignment.

Choose "full_body" if the subject is fully visible from head to toes.

Choose "waist_cut" if cropped at thighs or waist.

Choose "chest_cut" if only chest and head are visible.

alignment:

If crop_state is "full_body", set alignment to "center".

If crop_state is "waist_cut" or "chest_cut", set alignment to "bottom" (this anchors the cut-off edge perfectly to the bottom of the screen so it doesn't levitate).

scale: Relative viewport height scale (0.65 to 0.88).

Use 0.70 for full body "center" alignment.

Use 0.82 to 0.88 for cropped "bottom" alignment (to maximize visual impact and cleanly hide the cut edge).

grayscale: Grayscale intensity of the subject's filter (value between 0.0 and 1.0).

Use 1.0 for a stark, classical grayscale look (ideal for B/W ink styles or menacing themes).

Use 0.0 to preserve the original rich, colorful artwork of the subject completely.

Use 0.5 for a hybrid desaturated blend.

LAYER 2 — SUBJECT ZONES (measure on the ALPHA channel, not by eye)

Split the visible (non-transparent) subject into 3 vertical zones and report [y0, y1, x0, x1] for each: head zone, mid zone, low zone, each roughly a third of the subject's total visible height. This feeds the ground-glow sizing.

LAYER 3 — BACKGROUND DESIGN (YOU decide — there is no background)

Choose STRONG, PURE, PROFESSIONAL poster colors that serve the subject.

Build around signature colors.

AVOID MUDDY MID-TONES: a gradient of 3 stops (center → mid → edge) must read as ONE clear, saturated hue family getting darker toward the edge.

Output 3 HEX stops (center → mid → edge) for a radial gradient.

Decide blend: "luminosity" (grayscale subject tints with the background) or "none" (grayscale is 0.0, artwork keeps its own color).

LAYER 4 — THE GIANT WORD & METADATA

giant_word: ONE word (rarely two) in caps — the known_name if recognizable, otherwise a power word matching the attitude (AURA, POWER, RELENTLESS, CURSED).

giant_color: High contrast HEX or RGBA (e.g., #FFFFFF, #38a0ff, etc.).

opacity: Translucency level of the giant word (between 0.0 and 1.0).

Use 1.0 for absolute nítidez/solid/readable letters (no opacity/no transparency).

Use 0.20 to 0.35 for a translucent plomo/ghost letter look that blends with the background.

ink: high-contrast text color for the brand header (must remain clearly visible over the background gradient edge, e.g. #FFFFFF).

LAYER 5 — ATMOSPHERE & AUDIO SOUNDSCAPE

particles:

type: always "stones" (polygonal floating stones) unless a highly active fire theme requests "embers" (soft circular sparks).

color: Accent color HEX.

dark: Near-black fill color (e.g. rgba(15, 2, 2, 0.9)).

count: 18-32.

minSize: Minimum particle size (default 3, adjustable).

maxSize: Maximum particle size (default 10, adjustable).

glow: { color: accent HEX, intensity: 0.3-0.9 }.

effect: "sparks" (lightning relámpagos) | "arcs" (flaming energy rising) | "none".

track: Dynamic track name. IMPORTANT: If giant_word is "TOJI", do NOT repeat "TOJI" on the track; use a themed title like "CURSE URBAN".

audio: { "src": "song.mp3", "simulatedBpm": 96 }.

intro: Cinematic intro metadata { artist, title, sub, feats } (e.g. artist: "DALEX feat. CHENCHO", title: "HOLA REMIX", sub: "Cursed", feats: "Lenny Tavárez").

outro: Cinematic outro metadata { leadSec: 6-8, songTitle, title: "Gracias", sub: "Por ver", feats: "Suscribete" }.

OUTPUT RULES

Return EXCLUSIVELY a raw JSON object. No markdown, no commentary.

EXACT SCHEMA

{
"subject": {
"width_px": 0, "height_px": 0, "label": "", "known_name": "", "attitude": "",
"crop_state": "full_body", "alignment": "center", "scale": 0.70, "grayscale": 1.0,
"zones": { "head": [0,0,0,0], "mid": [0,0,0,0], "low": [0,0,0,0] }
},
"background": { "colors": ["#000000", "#000000", "#000000"], "blend": "none", "why": "" },
"word": { "giant_word": "", "giant_color": "#FFFFFF", "opacity": 1.0, "ink": "#FFFFFF" },
"atmosphere": {
"particles": { "type": "stones", "color": "#000000", "dark": "rgba(15, 2, 2, 0.9)", "count": 24, "minSize": 3, "maxSize": 10 },
"glow": { "color": "#000000", "intensity": 0.5 },
"effect": "sparks"
},
"brand": { "name": "RIOX", "sub": "RECORDS" },
"track": "CURSE URBAN",
"audio": { "src": "song.mp3", "simulatedBpm": 96 },
"intro": { "artist": "", "title": "", "sub": "", "feats": "" },
"outro": { "leadSec": 6, "songTitle": "", "title": "", "sub": "", "feats": "" }
}
```

---

## PROMPT 2 — CONFIG-ONLY OUTPUT (P4 — AURA, config.json)

```text
SYSTEM PROMPT: AURA Config Builder (P4 — config.json-only output)

index.html is a PROVEN, TESTED, STATIC HTML template — subject centered or bottom aligned, one giant word centered behind it, AI-designed strong-color radial background, luminosity tinting, levitation, ground glow, rising stones particles (with adjustable size), film grain-free vignette, brand header, intro/outro metadata. It loads its configuration at runtime from an external config.json file. Your ONLY output is that config.json.

STEP 0 — PLACE THE ASSET

Save the transparent subject PNG as img/subject.png next to index.html (or reuse whatever filename you're given — just make subject.src match it).

YOUR ONLY TASK

Map the VISION JSON below into this EXACT config.json schema. Output nothing else — no HTML, no explanation, no markdown fences.

Mapping (VISION JSON -> config.json):

subject.width_px/height_px -> subject.w / subject.h (subject.src = the PNG path)

subject.label/known_name -> subject.label / subject.knownName

subject.crop_state -> subject.cropState

subject.alignment -> subject.alignment

subject.scale -> subject.scale

subject.grayscale -> subject.grayscale

subject.zones -> subject.zones (same [y0,y1,x0,x1] arrays per head/mid/low)

background.colors -> bg.colors

background.blend -> blend

word.giant_word -> giantWord

word.giant_color -> giantColor

word.opacity -> giantOpacity

word.ink -> ink

atmosphere.particles -> particles (ensure minSize and maxSize are mapped correctly)

atmosphere.glow -> glow

atmosphere.effect -> effect

brand: always { "name": "NEXA", "sub": "BRIEF" } unless specified otherwise.

audio: always map the provided object { "src": "song.mp3", "simulatedBpm": 96 } or custom audio src.

intro: map exactly to root intro.

outro: map exactly to root outro.

seed: 11 (default).

VISION JSON

[INJECT_VISION_JSON_HERE]

OUTPUT

Return EXCLUSIVELY the raw config.json object. No markdown, no code fences, no commentary. Start with { and end with }.

EXACT config.json SCHEMA

{
"subject": {
"src": "img/subject.png", "w": 0, "h": 0, "label": "", "knownName": "",
"cropState": "full_body", "alignment": "center", "scale": 0.70, "grayscale": 1.0,
"zones": { "head": [0,0,0,0], "mid": [0,0,0,0], "low": [0,0,0,0] }
},
"bg": { "colors": ["#000000", "#000000", "#000000"], "style": "radial" },
"blend": "none",
"giantWord": "",
"giantColor": "",
"giantOpacity": 1.0,
"particles": { "type": "stones", "color": "#000000", "dark": "rgba(15, 2, 2, 0.9)", "count": 24, "minSize": 3, "maxSize": 10 },
"glow": { "color": "#000000", "intensity": 0.5 },
"effect": "sparks",
"ink": "#FFFFFF",
"brand": { "name": "NEXA", "sub": "BRIEF" },
"track": "CURSE URBAN",
"audio": { "src": "song.mp3", "simulatedBpm": 96 },
"intro": { "artist": "", "title": "", "sub": "", "feats": "" },
"outro": { "leadSec": 6, "songTitle": "", "title": "", "sub": "", "feats": "" },
"seed": 11
}
```

---

## Por qué se sacó side-split (por ahora)

Una versión anterior de este caso tenía 2 layouts (`center-back` y
`side-split`, sujeto a un costado + columna de palabras cayendo) controlados
por un campo `layout` en `config.json`. Se sacó a pedido explícito: el look
que hay que igualar es el de `example/example1-baki.html` y
`example2-goku.html`, que son SIEMPRE centrados — sujeto y palabra gigante en
el medio, sin variante lateral. Si se retoma side-split más adelante, el
patrón correcto sigue siendo agregar un campo a `config.json` (nunca un
segundo HTML), y habrá que resolver de nuevo el ajuste de ancho de las
palabras que caen en columna (ver el bug ya documentado y corregido una vez
en el historial de `pruebas-ia/` — el fontSize de una columna angosta debe
medirse contra el ancho real disponible, no solo contra el alto de viewport).

## Cómo se garantiza que la palabra gigante NUNCA desborda

`index.html` (`fitGiantTitle()`) no usa una fórmula de "largo de palabra ×
constante" — MIDE el `scrollWidth` real ya renderizado y reduce el
`font-size` con búsqueda binaria hasta que entra en el 92% del ancho de
pantalla. Esto es válido para cualquier palabra, cualquier fuente (incluso
si Montserrat no llega a cargar y cae al fallback), y cualquier relación de
aspecto — no depende de adivinar cuántos px ocupa cada letra. Verificado con
capturas reales en `pruebas-ia/` con 2 palabras de largo bien distinto
("CURSED" y "POWER") en 16:9 y 9:16: 0 desbordes en las 4 combinaciones.

## Cómo probarlo

1. Pegar el **Prompt 1** en un modelo con visión, adjuntando el PNG real
   (con canal alfa).
2. Pegar el **Prompt 2** junto con el JSON del paso 1. Guardar la salida como
   `config.json`, junto con el PNG (`img/subject.png` o el nombre que uses) y
   `song.mp3` (opcional).
3. Servir con `python3 -m http.server 8000` y abrir
   `http://localhost:8000/index.html` — **nunca doble clic** (`fetch()` se
   rompe por CORS en `file://`).
4. Este caso ya trae 2 configs de muestra: `config.json` (`img/6.png`,
   paleta roja, "CURSED", fill translúcido tipo Baki) y `config2.json`
   (`img/5.png`, paleta dorada, "POWER", fill sólido tipo Goku) — copiar
   `config2.json` sobre `config.json` para ver la segunda.
5. Revisar visualmente contra `example/example1-baki.html` y
   `example2-goku.html` — colores puros y saturados, la palabra gigante
   SIEMPRE dentro del ancho de pantalla, en AMBOS formatos (16:9 y 9:16).

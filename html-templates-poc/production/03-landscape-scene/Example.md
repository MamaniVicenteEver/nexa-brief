# 03 — Paisaje completo / Escena Viva (caso #3) — P2, esquema alineado con el motor real

Caso: UNA imagen de paisaje pintado completo (acuarela/tinta/gouache, castillos,
templos, montañas, escenas de Japón o China, melancolía/misterio) que ocupa
TODA la pantalla en desktop y en móvil. No hay sujeto recortado ni fondo que
diseñar — el paisaje ENTERO es la pieza. La IA hace de Analista de Escena:
mide el punto focal, extrae paleta para pétalos/niebla/luciérnagas/estrellas,
elige el bioma (sakura/autumn/nieve/...) y su energía física, encuentra la
zona calma para el texto (y si ese texto debe ir vertical u horizontal), y el
corredor de aves.

`index.html` es la plantilla ESTÁTICA (motor CSS+JS). Hoy carga su
configuración desde un objeto `fallbackConfig` embebido directamente en el
`<script>` (no desde `fetch("config.json")` — ver "Estado real del motor"
más abajo, es importante). El **Prompt 2** de este documento devuelve el JSON
que va a `config.json` como referencia/entrada de datos: pegarlo dentro de
`fallbackConfig` en `index.html` es, por ahora, el paso final manual.

## Estructura de esta carpeta

- `index.html` — motor (cover de pantalla completa + deriva de cámara suave,
  un canvas con pétalos en 3 capas de profundidad/niebla/nubes/grullas/
  luciérnagas opcionales/estrellas fugaces reactivos al audio, letra vertical
  u horizontal con ciclo de color, viñeta, marca de esquina). Config embebida
  como `fallbackConfig` (y una segunda `fallbackConfig1` de ejemplo/comparación,
  intercambiables cambiando una sola línea `const CONFIG = ...`).
- `config.json` — configuración de muestra en el ESQUEMA NUEVO (alineado
  campo-por-campo con lo que `index.html` lee de verdad), para la misma imagen
  y dirección de arte que `fallbackConfig` (autumn/embers, haiku "花は散り／
  名を覚えている／風ばかり").
- `img/` — paisaje de muestra (`jav2.png`, 1672×941 nativo).
- `example/` — pieza de referencia hecha a mano (`index.html` standalone, no
  usa el motor) con la MISMA imagen — es la vara de calidad. También contiene
  `index1.html`, una variante experimental con mejoras visuales (grano,
  gradiente de horizonte, ráfagas de viento, estrellas fijas, silueta de
  primer plano, ícono de sonido, ondas de tinta al click) que todavía no se
  portaron al motor principal.
- `pruebas-ia/` — verificación real con Playwright headless en 16:9 y 9:16.
  Ver `pruebas-ia/README.md`.

## Flujo de armado

paisaje → **Prompt 1** (visión: inventario de escena, focal, paleta completa,
energía física del bioma, zona calma + orientación de texto, corredor de
aves, ritmo tipográfico) → JSON → **Prompt 2** → `config.json` → pegar sus
campos dentro de `fallbackConfig` en `index.html` (o, si en el futuro se
conecta `fetch("config.json")`, colocar el archivo junto a `img/bg.jpg` +
`song.mp3` opcionales) → listo.

## Qué cambió respecto al prompt original (`../../docs/prospects/P1-PROMPTS.md`)

1. **Prompt 2 devuelve solo `config.json`**, nunca el HTML completo (el doc
   original pegaba la plantilla entera y pedía el HTML de vuelta — eso era de
   antes de que este caso separara el motor del config, como ya se había hecho
   en `01-image-bg`/`02-subject-png`).
2. **Nueva regla explícita en el Prompt 1: revisar las 4 ESQUINAS por
   caligrafía/sello incrustado antes de elegir `calm_zone`.** Motivo real: al
   armar el `config.json` de muestra con `jav2.png`, la esquina superior
   derecha parecía a simple vista un buen lugar para el texto (cielo abierto,
   sin elementos del inventario) — pero al recortar y mirar esa región en
   detalle (`PIL.Image.crop`, no "a ojo" sobre la miniatura) tenía tanto
   caracteres chinos pintados por el artista como una segunda estructura de
   pagoda. Ambas esquinas superiores de este tipo de arte casi siempre tienen
   inscripción/sello del "pintor" — hay que asumir que están ocupadas hasta
   verificar lo contrario, recortando esa región puntual en vez de mirar la
   imagen completa reducida.
3. **Nueva regla: verificar `width_px`/`height_px` contra el archivo real**,
   no asumir una resolución común. El propio `fallbackConfig` de `index.html`
   tenía `w: 736, h: 1104` (un placeholder de una versión anterior) mientras
   que la imagen real (`jav2.png`) mide 1672×941 — se corrigió directamente en
   `index.html` al escribir esta revisión, con `PIL.Image.open(...).size`, no
   a ojo.

## Qué cambió en esta revisión (P2 — esquema alineado con el motor real)

Se auditó `index.html` línea por línea (`grep -n "CONFIG\."`) para confirmar
EXACTAMENTE qué campos de config lee el motor en tiempo real, antes de tocar
los prompts. Dos hallazgos concretos motivaron esta revisión:

1. **Bug de ruta de imagen, ya corregido:** `fallbackConfig.img.src` decía
   `"jav2.png"` pero el archivo real vive en `img/jav2.png` — el fondo
   completo del paisaje literalmente no cargaba al abrir `index.html`
   (quedaba fondo negro con solo las partículas encima). Corregido a
   `"img/jav2.png"` en ambos `fallbackConfig`/`fallbackConfig1`.
2. **Campos "fantasma" que el motor nunca lee:** `img.w`, `img.h`, `img.focal`,
   `intro.*` y `outro.*` están en `fallbackConfig` pero ninguna línea de
   `index.html` los consume (confirmado por grep, cero resultados). Es decir,
   cambiar esos valores hoy NO cambia nada en pantalla. Se documentan como
   metadata reservada (ver notas en el Prompt 2) en vez de fingir que ya
   hacen algo — el objetivo de este documento es que cada campo del JSON que
   la IA produce tenga un efecto visual verificable, no relleno.

El **Prompt 1** anterior (versión previa de este documento) ya cubría bien
inventario/focal/paleta básica/bioma/zona calma/corredor de aves, pero le
faltaban campos que el motor SÍ usa hoy: color de luciérnagas (`palette.
firefly`), color de estrellas (`palette.star`), si las luciérnagas encajan en
la escena (`physics.fireflyEnabled`), dirección del viento (`physics.
direction`), y todo el bloque de tipografía nuevo (`text.orientation`,
`letterSpacing`, `lineHeight`, `lineGap`). El **Prompt 2** anterior mapeaba a
un esquema de `config.json` completamente distinto al que `index.html` usa
hoy (`scene.biome`, `motion.kenburns/driftX/driftY`, `physics.wind` como un
solo número, `birds.edge/bandPct` — ninguno de estos existe en el
`fallbackConfig` real). Ambos se reescribieron desde cero contra el esquema
real, campo por campo.

---

## PROMPT 1 — VISION EXTRACTOR P2 (alineado con el motor real)

```text
# SYSTEM PROMPT: Living Landscape Vision Extractor (P2 — Full-Screen Scene, engine-aligned)

You are an expert Scene Analyst, Color Calibration Specialist, and Atmosphere
Designer. You will receive ONE painted-style landscape image (watercolor, ink
wash, pencil, gouache, digital painting — often melancholic, often Japanese/
Chinese scenery, but not exclusively). Your output feeds an automated "living
scene" HTML engine that makes the image fill the ENTIRE screen (desktop 16:9
AND mobile 9:16) and come alive with drifting petals/leaves, fog, clouds,
birds, optional fireflies, rare shooting stars, and falling vertical or
horizontal text. Precision is mandatory — every field you output maps to a
SPECIFIC visual effect in the engine, never decoration.

## COORDINATE SYSTEM
- Detect the TRUE native resolution in px by reading the actual file (never
  assume a common resolution — measure it). All coordinates are absolute
  image px, top-left = (0,0). Percentages are relative to the full image.

## WHAT YOU MUST EXTRACT (7 LAYERS)

### LAYER 1 — SCENE INVENTORY (what the image is about)
List every meaningful element and WHERE it is: castles, pagodas, mountains,
trees, rivers, moon, sun, bridges, figures, boats, clouds, waterfalls. For
each: { name, region_pct: {x0,y0,x1,y1 as % of image}, prominence: 0-1 }.
Also give: style (ink-wash / watercolor / pencil / gouache / digital-painting
/ monochrome...), mood (melancholic / serene / ominous / nostalgic...),
era/place feel, and a 2-sentence story the image seems to tell.

**Check all 4 corners specifically for artist-embedded text/seals** (painted
calligraphy, signature stamps). Report them as inventory elements too
(name: "artist inscription" / "seal", prominence >= 0.6) so LAYER 5 knows to
avoid them — never treat a corner as empty just because it reads that way in
a shrunk thumbnail; if unsure, mentally zoom into that specific corner before
deciding.

### LAYER 2 — FOCAL POINT
Report focal_point_px = the single point that must stay visible and
near-center if the engine ever crops the image (the castle, the pagoda, the
figure — the story's anchor). If two anchors exist, pick the one with more
visual weight/detail and mention the other in notes.
NOTE: as of this revision, `index.html` does NOT yet crop the background
around this point at runtime — it just does a simple cover-fill. Report this
layer anyway, faithfully measured; it costs nothing and is ready for the day
focal-aware cropping gets wired in.

### LAYER 3 — COLOR CALIBRATION (zero tolerance, channel-level reasoning)
Sample multiple points, reason in R,G,B channels first, NEVER snap to pure
named colors, preserve subtle tints. Extract:
- petal_palette: exactly 5 entries, each `{ hex, role }`, sampled FROM the
  image (flowers, autumn foliage, embers, snow, sand — the particle system
  uses ONLY these). `role` is your best read of how each hex reads visually:
  "fill" (a bright/central tone), "stroke" (a darker edge/shadow tone of the
  same hue family), or "vein" (a thin pale highlight accent). Aim for at
  least 2 "fill" and 2 "stroke" entries so Prompt 2 can pair them into
  gradients.
- fog_tint_rgb: "R,G,B" of the atmospheric haze/mist.
- bird_silhouette: the darkest ink tone present (birds/cranes are drawn with
  it).
- firefly_tint: a warm or cool glow HEX for ambient fireflies, harmonizing
  with the palette (gold/amber for warm scenes, pale blue-green/lavender for
  cold or moonlit scenes). Report it even if you expect fireflies won't fit
  this scene (LAYER 4 decides that separately).
- star_tint: a near-white HEX with a subtle warm or cool cast for
  shooting/twinkling stars, consistent with the sky's actual color.
- text_cycle: TWO HEX colors for the falling text — colorA = a deep tone
  readable over the calm zone, colorB = a poetic/bright accent from the
  palette (the text alternates between them).
- brand_color: a muted tone for the corner mark.

### LAYER 4 — BIOME & PARTICLE ENERGY (drives the physics engine)
- biome: ONE of "sakura" (petals) | "autumn" (leaves) | "snow" | "embers" |
  "dust" | "rain" | "none". Decide from season/mood/content, not taste.
- density (0.0-1.0): how visually rich/busy the painting already is — a busy
  dramatic scene (waterfall, temple complex, dense foliage) supports higher
  density (0.6-0.85) than a sparse minimal scene (0.15-0.35).
- wind_energy (0.0-1.0): how energetic the air feels. Calm still mist is low
  (0.1-0.35); an actively windy/dynamic scene is high (0.6-0.9). Look for
  cues: leaning trees/grass, blowing hair/fabric, waterfall spray, fast
  clouds.
- fall_weight (0.0-1.0): how heavy the falling particles should feel. Light
  floating sakura petals are low (0.15-0.35); heavy wet autumn leaves or
  embers are higher (0.5-0.7).
- drift_direction: "left" | "right" — the direction particles travel across
  the screen. Prefer whatever the scene's own wind cues suggest (leaning
  vegetation, mist drift, waterfall spray angle); with no clear physical cue,
  default to the direction that carries particles FROM the busiest/most
  detailed part of the composition TOWARD the open/calm side.
- fog_density (0.0-1.0) and cloud_density (0.0-1.0): how much atmospheric
  haze and how many drifting cloud shapes suit the scene. Default to
  ~0.4-0.5 (moderate) unless the painting is clearly very clear or very
  misty — most real scenes should NOT sit at the extremes.
- ambient_fireflies: true | false — do fireflies genuinely fit this scene?
  true for forest/night/water/warm misty scenes; false for stark daylight,
  snow/winter, desert, or scenes where a floating glow would look out of
  place. When true, also give firefly_density (0.0-1.0).
- why: 1-2 sentences justifying biome + the energy numbers together.

### LAYER 5 — CALM ZONE, TEXT ORIENTATION & BIRD CORRIDOR
- calm_zone: the best area for the falling text — open sky, mist, or a
  genuinely low-detail gap, NOT covering the focal point, NOT covering any
  inventory element with prominence > 0.5, and NOT covering any artist
  inscription/seal from LAYER 1. Report { x_pct, y_pct, max_width_pct,
  max_height_pct } — top-left anchor plus how much open space it has in BOTH
  directions (this decides orientation next). If the obvious edge/corner
  spots are all occupied, look for a narrow gap BETWEEN two prominent
  elements — crop and inspect that specific gap before trusting it.
- orientation_hint: "vertical" | "horizontal" — recommend "vertical" when
  calm_zone is genuinely tall and narrow (max_height_pct clearly bigger than
  max_width_pct) AND/OR the text language is CJK (read vertically by
  convention); recommend "horizontal" when the zone is wide and short, or the
  text is Latin-script. When the two signals conflict, the calm_zone's
  actual measured SHAPE wins over the language convention — a cramped tall
  gap cannot fit wide horizontal lines, and vice versa.
- bird_corridor: where birds should fly from — { edge: "left"|"right"|"both",
  band_pct: [y0, y1], notes }. An open-sky band free of obstacles; a band
  crossing in front of a moon or between peaks reads as more atmospheric
  than a plain empty band — prefer it when available. If truly no open band
  exists anywhere, report your best-effort narrowest gap and say so in
  "notes" — never invent an obstruction-free band that isn't there.

### LAYER 6 — TEXT CONTENT & TYPOGRAPHIC RHYTHM
- lines: 2-3 SHORT poetic lines (3-7 characters each if Japanese, 2-4 words
  if Spanish/English) matching the mood and story — in Japanese for Japanese
  scenery, otherwise in the language that fits the aesthetic. Never repeat
  text already painted in the image.
- letter_rhythm: "tight" | "normal" | "airy" — how close together characters
  within a line should sit. Default "normal" unless the mood clearly calls
  for an extreme (a very sparse meditative scene can justify "airy"; a dense
  urgent mood can justify "tight").
- line_rhythm: "tight" | "normal" | "airy" — the gap BETWEEN lines/columns
  and the internal vertical rhythm within one line. Default "normal".

### LAYER 7 — SOUNDSCAPE & CREDITS METADATA
- mood_tag: one or two words describing the emotional tone for a hypothetical
  soundtrack (e.g. "melancholic ambient", "dark cinematic", "serene lo-fi").
- intro: cinematic intro metadata matching the mood — { artist, title, sub,
  feats } (invent plausible values in the spirit of the scene — these are
  decorative credits, not real attributions).
- outro: { leadSec: 6-8, songTitle (repeat intro.title), title: "Gracias",
  sub: "Por ver", feats: "Suscribete" }.

## OUTPUT RULES
Return EXCLUSIVELY a raw JSON object. No markdown, no commentary.

## EXACT SCHEMA
{
  "image": { "width_px": 0, "height_px": 0, "focal_point_px": [0, 0] },
  "scene": {
    "style": "", "mood": "", "story": "",
    "inventory": [ { "name": "", "region_pct": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 }, "prominence": 0 } ]
  },
  "palette": {
    "petal_palette": [
      { "hex": "#000000", "role": "fill" },
      { "hex": "#000000", "role": "fill" },
      { "hex": "#000000", "role": "stroke" },
      { "hex": "#000000", "role": "stroke" },
      { "hex": "#000000", "role": "vein" }
    ],
    "fog_tint_rgb": "0,0,0",
    "bird_silhouette": "#000000",
    "firefly_tint": "#000000",
    "star_tint": "#000000",
    "text_cycle": ["#000000", "#000000"],
    "brand_color": "#000000",
    "palette_notes": ""
  },
  "biome": {
    "type": "autumn", "density": 0.4, "wind_energy": 0.4, "fall_weight": 0.4,
    "drift_direction": "left", "fog_density": 0.45, "cloud_density": 0.45,
    "ambient_fireflies": false, "firefly_density": 0.3, "why": ""
  },
  "calm_zone": { "x_pct": 0, "y_pct": 0, "max_width_pct": 0, "max_height_pct": 0, "orientation_hint": "vertical" },
  "bird_corridor": { "edge": "left", "band_pct": [0, 0], "notes": "" },
  "text": { "lines": ["", ""], "language": "", "letter_rhythm": "normal", "line_rhythm": "normal" },
  "soundscape": {
    "mood_tag": "",
    "intro": { "artist": "", "title": "", "sub": "", "feats": "" },
    "outro": { "leadSec": 7, "songTitle": "", "title": "Gracias", "sub": "Por ver", "feats": "Suscribete" }
  }
}

## VALIDATION CHECKLIST
1. width/height match the file measured directly (not assumed); focal point
   inside bounds.
2. The 5 petal colors are sampled FROM the painting (channel-level reasoning,
   no snapping), harmonize with each other, and each carries a role Prompt 2
   can use to build a fill/stroke/vein gradient (at least 2 "fill", 2
   "stroke").
3. calm_zone does NOT overlap the focal point, any inventory element with
   prominence > 0.5, OR any artist inscription/seal — verified by inspecting
   that specific corner/region, not the whole image at a glance.
4. orientation_hint follows calm_zone's actual measured SHAPE first,
   language convention second — never the reverse.
5. bird_corridor is genuinely open sky in the band reported, or the
   constraint is explicitly noted in "notes" when it isn't.
6. Text lines are original (not text painted in the image) and match the
   mood; letter_rhythm/line_rhythm default to "normal" unless there's a real
   reason for an extreme.
7. Every biome field (density, wind_energy, fall_weight, drift_direction,
   fog_density, cloud_density, ambient_fireflies) reflects something actually
   seen in the image — none left at a lazy 0.5-across-the-board default.
8. Output is pure, parseable JSON, nothing else.
```

---

## PROMPT 2 — CONFIG-ONLY OUTPUT (P2 — config.json, engine-aligned)

```text
# SYSTEM PROMPT: Living Scene Config Builder (P2 — config.json, engine-aligned)

`index.html` is a PROVEN HTML/JS engine — full-screen cover background with
smooth camera drift, a canvas particle system (3-layer depth-of-field petals,
fog, drifting clouds, cranes, optional fireflies with organic flicker, rare
shooting stars), audio-reactive bass with a simulated-pulse fallback, falling
text (vertical or horizontal) with color cycling, a corner brand mark. It is
NEVER regenerated, NEVER redesigned. Your ONLY output is a config.json object
matching the EXACT schema below — every field must be one this engine
actually reads; nothing decorative.

## STEP 0 — PLACE THE ASSETS
- Save the landscape image at `img/bg.jpg` next to `index.html` (or reuse
  whatever filename you're given — just make `img.src` match it, keeping the
  `img/` folder prefix; a missing prefix is a real bug that has happened
  before in this exact engine — double-check it).
- If a track was supplied, save it as `song.mp3` next to `index.html` and set
  `audio.src` to `"song.mp3"`. If no track was supplied, still use
  `"song.mp3"` as a placeholder filename (never a remote URL) — whoever
  assembles the scene drops in the real file afterward.

## YOUR ONLY TASK
Map the VISION JSON below into this EXACT config.json schema. Output nothing
else — no HTML, no explanation, no markdown fences.

**Mapping (VISION JSON -> config.json):**
* image.width_px/height_px/focal_point_px -> img.w / img.h / img.focal
  (metadata only today — see the schema note below; populate it faithfully
  regardless).
* palette.petal_palette -> palette.petals: group the 5 entries into exactly 5
  `{ fill, stroke, vein }` objects. Use each entry's reported "role" as a
  hint: pair "fill"-role hexes with a naturally darker "stroke"-role hex of
  the same hue family (from the set, or a darkened shade of the same hue if
  none was tagged "stroke"), and use a light near-white/pale tint of the hue
  for "vein" as `"rgba(r,g,b,0.6-0.9)"`. All 5 final objects must read as one
  coherent palette family.
* palette.fog_tint_rgb -> palette.fog (keep as the "R,G,B" string, unchanged)
* palette.bird_silhouette -> palette.bird
* palette.firefly_tint -> palette.firefly, converted to `"rgba(r,g,b,X)"`
  with X between 0.5 and 0.65
* palette.star_tint -> palette.star, converted to `"rgba(r,g,b,X)"` with X
  between 0.8 and 0.9
* palette.text_cycle -> palette.textCycle ; palette.brand_color -> palette.brand
* text.lines -> text.lines
* calm_zone.orientation_hint -> text.orientation
* calm_zone.x_pct/y_pct -> text.xPct / text.yPct
* text.letter_rhythm -> text.letterSpacing: "tight" -> 0.12, "normal" -> 0.28,
  "airy" -> 0.45 (em)
* text.line_rhythm -> text.lineHeight AND text.lineGap together:
  "tight" -> lineHeight 1.7, lineGap 1.4 ; "normal" -> lineHeight 2.2,
  lineGap 2.4 ; "airy" -> lineHeight 2.8, lineGap 3.6
* text.fontMin/fontMax -> ALWAYS 32/55 unless calm_zone is unusually cramped
  (max_width_pct or max_height_pct very small) — then scale both down
  together, keeping roughly the same 1.7x ratio between them.
* biome.density -> physics.petalCount = round(60 + density * 140)
* biome.fall_weight -> physics.gravity = round(0.12 + fall_weight * 0.10, 3)
* biome.wind_energy -> physics.turbulence = round(0.30 + wind_energy * 0.375, 3);
  physics.minWind = round(0.5 + wind_energy * 1.25, 2);
  physics.maxWind = round(2.0 + wind_energy * 4.0, 2)
* biome.drift_direction -> physics.direction: "left" -> -1, "right" -> 1
* biome.fog_density -> physics.fogCount = round(4 + fog_density * 8)
* biome.cloud_density -> physics.cloudCount = round(2 + cloud_density * 6)
* biome.ambient_fireflies -> physics.fireflyEnabled (boolean, passthrough)
* biome.firefly_density -> physics.fireflyCount = round(15 + firefly_density * 40)
  ONLY when ambient_fireflies is true; otherwise leave fireflyCount at 35 (it
  has zero visible effect while fireflyEnabled is false, so it isn't worth
  computing).
* biome.type -> informational only in this schema (no direct `scene.biome`
  field exists) — it only guides your choices above, do not invent a field
  for it.
* Keep these at FIXED engine defaults, always, regardless of the vision
  JSON — this engine's two real reference scenes share these exact values,
  confirming they're tuned constants, not per-image decisions:
  `physics.minSize: 12`, `physics.maxSize: 34`, `physics.emitterY: 0.18`,
  `physics.emitterSpread: 0.80`, `physics.rotationSpeed: 0.014`,
  `physics.tumbleStrength: 0.55`, `physics.staticTilt: 12`,
  `physics.repulsionRadius: 140`, `physics.repulsionStrength: 2.2`,
  `birds.max: 5`, `birds.chance: 0.007`. Only deviate from `birds.chance` if
  `bird_corridor.notes` reports there is truly no viable open-sky band
  anywhere — use `0.002` instead of `0.007` so new cranes rarely spawn into a
  cluttered sky (the engine always spawns 3 initial cranes regardless; this
  field only throttles ADDITIONAL ones over time).
* brand -> ALWAYS `{ "nexa": "NEXA", "brief": "BRIEF" }` unless a different
  brand name was explicitly requested outside this prompt.
* soundscape.intro -> intro (passthrough) ; soundscape.outro -> outro
  (passthrough) — metadata only today, see the schema note below.
* audio.src -> always `"song.mp3"` per STEP 0.

## VISION JSON
[INJECT_VISION_JSON_HERE]

## OUTPUT
Return EXCLUSIVELY the raw config.json object. No markdown, no code fences,
no commentary. Start with { and end with }.

## EXACT config.json SCHEMA
{
  "img": { "src": "img/bg.jpg", "w": 0, "h": 0, "focal": [0, 0] },
  "palette": {
    "petals": [
      { "fill": "#000000", "stroke": "#000000", "vein": "rgba(0,0,0,0.8)" },
      { "fill": "#000000", "stroke": "#000000", "vein": "rgba(0,0,0,0.8)" },
      { "fill": "#000000", "stroke": "#000000", "vein": "rgba(0,0,0,0.8)" },
      { "fill": "#000000", "stroke": "#000000", "vein": "rgba(0,0,0,0.8)" },
      { "fill": "#000000", "stroke": "#000000", "vein": "rgba(0,0,0,0.8)" }
    ],
    "fog": "0,0,0",
    "bird": "#000000",
    "textCycle": ["#000000", "#000000"],
    "brand": "#000000",
    "firefly": "rgba(0,0,0,0.6)",
    "star": "rgba(0,0,0,0.85)"
  },
  "text": {
    "lines": ["", ""],
    "orientation": "vertical",
    "xPct": 10.0,
    "yPct": 10.0,
    "letterSpacing": 0.28,
    "lineHeight": 2.2,
    "lineGap": 2.4,
    "fontMin": 32,
    "fontMax": 55
  },
  "brand": { "nexa": "NEXA", "brief": "BRIEF" },
  "birds": { "max": 5, "chance": 0.007 },
  "physics": {
    "direction": -1,
    "petalCount": 120,
    "fogCount": 8,
    "cloudCount": 5,
    "gravity": 0.16,
    "turbulence": 0.45,
    "minWind": 1.2,
    "maxWind": 4.0,
    "minSize": 12,
    "maxSize": 34,
    "emitterY": 0.18,
    "emitterSpread": 0.80,
    "rotationSpeed": 0.014,
    "tumbleStrength": 0.55,
    "staticTilt": 12,
    "fireflyCount": 35,
    "fireflyEnabled": false,
    "repulsionRadius": 140,
    "repulsionStrength": 2.2
  },
  "audio": { "src": "song.mp3" },
  "intro": { "artist": "", "title": "", "sub": "", "feats": "" },
  "outro": { "leadSec": 7, "songTitle": "", "title": "Gracias", "sub": "Por ver", "feats": "Suscribete" }
}

Note: "img.w"/"img.h"/"img.focal" and "intro"/"outro" are metadata that
`index.html` does NOT currently read at runtime — verified directly against
the engine's source (only `img.src`, every `palette.*`, every `text.*`,
`brand.*`, `birds.*`, every `physics.*`, and `audio.src` actually drive
something visible). Keep populating them faithfully anyway — they cost
nothing to fill in correctly and are ready for the day focal-point cropping
or an intro/outro sequence gets wired into this engine — but changing them
today changes nothing on screen.

Note: "text.orientation" must be "vertical" or "horizontal" — passthrough
from calm_zone.orientation_hint.

Note: "physics.fireflyEnabled" is the master switch for the firefly effect —
when false, "physics.fireflyCount" is simply ignored by the engine.

Note: this config.json describes ONE scene/mood. To produce a second
palette/mood variant of the SAME image for side-by-side comparison (like
this engine's own `fallbackConfig`/`fallbackConfig1` pair), run this prompt
again with the same VISION JSON but a different creative brief — the schema
is identical either way, only the values change.
```

---

## Estado real del motor (verificado por `grep -n "CONFIG\."` en `index.html`)

- **Carga de config:** `index.html` NO hace `fetch("config.json")` — usa un
  objeto `fallbackConfig` (y `fallbackConfig1`) escrito directamente en el
  `<script>`, con un único punto de cambio `const CONFIG = fallbackConfig;`
  para elegir cuál está activo. `config.json` en esta carpeta es hoy un
  archivo de referencia/salida del Prompt 2, no algo que el motor cargue
  solo. Si en el futuro se conecta un `fetch()` real (como en `01-image-bg`/
  `02-subject-png`), el esquema ya coincide 1:1 — solo faltaría el `await
  fetch(...)` y quitar el objeto embebido.
- **Foco/recorte (`img.focal`):** el motor hace un `background-size: cover`
  simple con una deriva de cámara (`translate3d` con seno/coseno) — NO
  recorta ni centra alrededor de `img.focal`. La sección de la versión
  anterior de este documento que describía un `layout()` con `k = max(vw/
  img.w, vh/img.h)` describe un motor DISTINTO (el de `01-image-bg`), no
  este. Se corrige aquí para no documentar una capacidad que no existe.
- **Campos vivos, confirmados por uso real en el código:** `img.src`,
  `palette.petals/fog/bird/textCycle/brand/firefly/star`, `text.lines/
  orientation/xPct/yPct/letterSpacing/lineHeight/lineGap/fontMin/fontMax`,
  `brand.nexa/brief`, `birds.max/chance`, todo `physics.*`, `audio.src`.
- **Campos muertos, confirmados por AUSENCIA de uso:** `img.w`, `img.h`,
  `img.focal`, `intro.*`, `outro.*` — cero apariciones de `CONFIG.img.w`,
  `CONFIG.img.h`, `CONFIG.img.focal`, `CONFIG.intro`, `CONFIG.outro` en todo
  el archivo. Se mantienen en el esquema como metadata reservada (Prompt 2 ya
  lo aclara) en vez de borrarlos, porque no cuesta nada llenarlos bien y
  quedan listos para cuando se conecten a algo real.

## Cómo probarlo

1. Pegar el **Prompt 1** en un modelo con visión, adjuntando la imagen real.
2. Pegar el **Prompt 2** junto con el JSON del paso 1. Revisar que el
   resultado sea JSON puro con exactamente las claves del esquema (ni de más
   ni de menos).
3. Pegar los valores del JSON dentro de `fallbackConfig` en `index.html`
   (reemplazando cada bloque: `img`, `palette`, `text`, `brand`, `birds`,
   `physics`, `audio` — dejar `intro`/`outro` si se quiere, no tienen efecto
   visual hoy). Colocar la imagen en `img/` con el nombre indicado en
   `img.src`.
4. Servir con `python3 -m http.server 8000` desde esta carpeta y abrir
   `http://localhost:8000/index.html` (abrir por HTTP, no con doble clic —
   aunque hoy no hay `fetch()` bloqueado por CORS, es el hábito correcto para
   cuando se conecte `config.json` de verdad).
5. Revisar visualmente contra `example/example1-carmine-haiku.html` (misma
   imagen, hecho a mano): punto focal visible, letra en una zona calma real
   (sin sello/caligrafía del pintor debajo), pétalos con la paleta de la
   imagen, aves cruzando el corredor de cielo abierto.
6. Casos a probar específicamente para esta revisión:
   - **`text.orientation: "horizontal"`**: el texto debe leerse de izquierda
     a derecha, con los renglones apilados hacia abajo separados por
     `lineGap` — no como columnas verticales apiladas de derecha a izquierda.
   - **`physics.fireflyEnabled: false`**: no debe aparecer ninguna luciérnaga
     en pantalla (ni crearse, ni dibujarse) — confirmar que apagar el campo
     realmente las quita, no solo las oscurece.
   - **`physics.direction: 1` vs `-1`**: los pétalos deben derivar hacia la
     derecha o hacia la izquierda de la pantalla respectivamente — cambio
     visible de inmediato.
   - **Ruta de imagen**: confirmar que `img.src` incluye el prefijo de
     carpeta real (`img/...`) — este bug ya ocurrió una vez en este mismo
     motor y dejó el fondo completamente negro sin ningún aviso de error
     visible en pantalla.

# ESTUDIO COMPLETO — PIPELINE DE VIDEO (v8)
### Video en loop con ilusión "seamless" · fondos 1/2/4 colores · fondos degradados · texto incrustado
**Fecha:** Julio 2026 · **Estado:** Probado en Chromium headless (split desktop/móvil + modo blur) con video real de 720×1280 @30fps en loop

---

## 1. OBJETIVO Y DIFERENCIAS CON EL PIPELINE DE IMAGEN

Mismo resultado que el pipeline de imágenes (ESTUDIO-COMPLETO.md y
ESTUDIO-FONDOS-COMPLEJOS.md) pero con **video en loop**: el video se reproduce en
bucle, su fondo se funde con el fondo de la página, la tipografía envuelve al sujeto
y el ecualizador reacciona al audio. Todo se ve como **una sola pieza** — no se
distingue dónde termina el video y empieza la página.

El video se muestra con `<video autoplay muted loop playsinline>` (muted es
obligatorio para que el navegador permita el autoplay; la música sigue saliendo de
`song.mp3` como siempre). El motor de layout, las regiones, el edge fade, la tinta
por región y el ecualizador multicolor son **idénticos** a la v7 de imágenes — un
`<video>` se posiciona y se enmascara igual que un `<img>`.

Solo hay 3 diferencias reales, y las 3 están en la **extracción**:

| # | Diferencia | Solución |
|---|---|---|
| 1 | No se puede "enviar un video" a la IA de visión | Extraer fotogramas con ffmpeg y enviarlos juntos (§2) |
| 2 | El sujeto SE MUEVE — las zonas de un solo fotograma quedan obsoletas al siguiente | Envolvente de movimiento: unión de zonas sobre todos los fotogramas (§3) |
| 3 | Algunos videos traen texto incrustado (título, logo, marca de agua) | LAYER D: detectarlo en el JSON y esquivarlo con keepOut (§4) |

---

## 2. CÓMO EXTRAER EL JSON DE UN VIDEO

**Respuesta directa a la pregunta:** sí — se le sacan capturas al video y se envían
a la IA multimodal con el Prompt 1-VIDEO. Pero **nunca una sola captura**: como el
sujeto se mueve, un solo fotograma da zonas que el sujeto invadirá medio segundo
después. Se envían varios fotogramas del loop en un solo mensaje.

### 2.1 Paso 0 — extraer los fotogramas (ffmpeg, comandos exactos)

```bash
# duración del loop en segundos
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 video.mp4)

# 6 fotogramas repartidos uniformemente a lo largo del loop
ffmpeg -y -i video.mp4 -vf "fps=6/$D" -q:v 2 frame_%02d.jpg
```

Salida: `frame_01.jpg` … `frame_06.jpg`. Se adjuntan **los 6 al mismo mensaje** con
el Prompt 1-VIDEO (§7).

Reglas prácticas:

- **¿Por qué 6?** El fondo es estático (mismo color en todos los fotogramas); lo
  único que cambia es la posición del sujeto. 6 muestras uniformes cubren bien un
  loop corto. Si el movimiento es rápido o amplio, subir a 10–12 (`fps=12/$D`).
- **Opción B — la IA solo acepta 1 imagen:** enviar `frame_01.jpg` solo. El Prompt
  1-VIDEO detecta que recibió un único fotograma y aplica automáticamente un margen
  de seguridad del 12% a las zonas del sujeto (lo declara en `motion_analysis`).
- **NO usar mosaico/contact-sheet** (`tile=3x2`) para la extracción: pegar los
  fotogramas en una sola imagen cambia el sistema de coordenadas y todos los px
  salen corridos. El mosaico sirve solo para inspección humana.

### 2.2 Flujo completo

```
[video.mp4]
     │
     ▼
PASO 0 — ffmpeg extrae 6 fotogramas del loop
     │
     ▼
PASO 1 — PROMPT 1-VIDEO + los 6 fotogramas (IA multimodal)
     │   extrae: dimensiones, colores/regiones del fondo (estático),
     │   ENVOLVENTE de movimiento del sujeto, texto incrustado,
     │   zonas seguras, palabras sugeridas
     ▼
[JSON espacial de video]
     │
     ▼
PASO 2 — PROMPT 2-VIDEO (IA de texto, o script determinista)
     │   rellena SOLO el CONFIG de la plantilla v8
     ▼
[index.html] + video.mp4 + song.mp3
     │
     ▼
Reproducción en bucle / grabación headless
```

---

## 3. LA ENVOLVENTE DE MOVIMIENTO (MOTION ENVELOPE)

Concepto central del pipeline de video. Las zonas del sujeto no describen un
fotograma: describen la **unión de todos** — el área total que el sujeto barre
durante el loop completo.

```
Para cada zona (top / middle / bottom):
  left_edge_x_px  = el MÍNIMO borde izquierdo del sujeto en TODOS los fotogramas
  right_edge_x_px = el MÁXIMO borde derecho   del sujeto en TODOS los fotogramas
  (igual con y_start / y_end si el movimiento es vertical)
```

Ejemplo real del test verificado: el sujeto oscila ±60px alrededor del centro. Su
torso en reposo ocupa x [250, 470]; la envolvente reportada es x [190, 530]. El
texto se coloca fuera de [190, 530] → **nunca choca con el sujeto en ningún
momento del loop**, sin necesidad de recalcular nada en runtime.

Por eso el HTML final es idéntico en filosofía al de imagen: el layout se calcula
una sola vez (más resize) y el video se mueve "por dentro" de su envolvente.

---

## 4. TEXTO INCRUSTADO (LAYER D) — NUEVO

Algunos videos (pocos, pero pasa — igual que el póster de Mihawk con "MIHAWK"
pintado en el fondo) traen texto ya renderizado dentro del cuadro: un título, un
logo, una marca de agua. Si nuestra tipografía cae encima, se arruina la pieza.

### 4.1 En el JSON (extracción)

El Prompt 1-VIDEO devuelve un array `embedded_text` — vacío si no hay texto:

```json
"embedded_text": [
  {
    "content": "LIVE",
    "rect_px": { "x0": 460, "y0": 40, "x1": 710, "y1": 160 },
    "role": "title",
    "on_color": "#EFEAE1"
  }
]
```

- `content`: el texto leído (OCR) — sirve para decidir las palabras nuevas (no
  repetir lo que ya dice el video).
- `rect_px`: la caja del texto **con un margen de respiración ya incluido** (~5%).
- `role`: `title | logo | caption | watermark | other`.
- `on_color`: color del fondo bajo ese texto.

### 4.2 En la plantilla (esquiva automática)

El Prompt 2 mapea cada `rect_px` a `CONFIG.keepOut`. La plantilla recorta esas
cajas de los rectángulos candidatos de texto con un **corte guillotina**: cada
candidato que pisa un keepOut se parte en hasta 4 franjas (izquierda / derecha /
arriba / abajo del keepOut) y el motor elige entre los pedazos restantes.

**Verificado:** en el test, el video traía "LIVE" incrustado arriba a la derecha;
la palabra MOTION se colocó automáticamente debajo, sin tocarlo.

### 4.3 Drop-in para el pipeline de IMAGEN

Este bloque también aplica a imágenes (el usuario puede tener un póster con texto
pintado). Para activarlo en el pipeline v7 de imagen: añadir la LAYER D del Prompt
1-VIDEO (§7) al Prompt 1 v7, el campo `embedded_text` a su schema, el mapeo
`embedded_text → keepOut` al Prompt 2 v7, y la plantilla v8 (§8) ya trae el carve
(sirve para ambos pipelines cambiando `video:` por `img:`).

---

## 5. SECCIÓN A — FONDOS DE 1, 2 O 4 COLORES (solid / split / grid)

El caso principal. El fondo del video es estático y plano: un color, dos mitades o
cuatro cuadrantes. Funciona EXACTAMENTE igual que en imágenes (modelo de regiones
del ESTUDIO-FONDOS-COMPLEJOS.md):

- La IA clasifica `background_layout.type`: `solid`, `split-vertical`,
  `split-horizontal` o `grid-2x2`, y devuelve las regiones con color + tinta +
  rect. Como el fondo no cambia entre fotogramas, la medición es tan fiable como
  en imagen (la IA promedia sobre los 6 fotogramas — más robusto aún contra ruido
  de compresión de video).
- La plantilla pinta las regiones detrás del video con la regla de extensión
  (lados que tocan el borde del cuadro se estiran al viewport) → el divisor
  continúa alineado y el loop "flota" en la página.
- Edge fade, tinta por región, recorte por región y ecualizador multicolor:
  idénticos a v7.

**Resultado verificado** (video real 720×1280, split oscuro/crema, sujeto
oscilando, texto "LIVE" incrustado):

| Viewport | Resultado |
|---|---|
| 1440×900 | Divisor continúa sin costura; PULSE crema sobre oscuro, MOTION oscuro sobre crema y **debajo de LIVE**; barras del eq cambian de color al cruzar el divisor; el sujeto se mueve sin tocar ningún texto. |
| 390×844 | Pilas verticales flanqueando la envolvente, tintas correctas, LIVE intacto, piernas fundidas abajo por el fade. |

## 6. SECCIÓN B — FONDOS DEGRADADOS / MULTICOLOR (blur)

Cuando el fondo del video tiene 3+ tonos mezclados o degradados (pero "fácil de
replicar" = sigue siendo estático), la IA clasifica `complex` y la plantilla entra
en modo `blur`:

- Un **segundo `<video>`** con el mismo src se coloca detrás de todo
  (`z-index: 0`), con `object-fit: cover` (llena el viewport), `blur(50px)
  saturate(1.15)` y `scale(1.15)`. El video principal se funde con su propia
  versión difuminada mediante un fade ×2 (hasta 160px). Costura imposible por
  construcción, y **la precisión del color deja de importar** para el relleno.
- Los dos videos no necesitan estar sincronizados al fotograma: el de atrás está
  tan difuminado que el desfase es invisible.
- **Nota de rendimiento**: son 2 decodificaciones del mismo video. En equipos
  justos, sustituir el video de atrás por un fotograma estático exportado
  (`ffmpeg -i video.mp4 -frames:v 1 bgframe.jpg` y usar un `<img id="bgblur">`):
  como el fondo es estático, el resultado es idéntico y cuesta la mitad.
- **Cuándo NO usar blur** (verificado en las pruebas): en un fondo split de campos
  planos, el sujeto difuminado del underlay crea una mancha oscura en el lado
  claro y la tinta única pierde contraste. Para campos planos, `regions` siempre;
  `blur` es exclusivo de degradados/multicolor. La clasificación del Prompt 1
  decide esto solo.

---

## 7. PROMPT 1-VIDEO — VISION EXTRACTOR v8 (enviar con los fotogramas)

```
# SYSTEM PROMPT: Pixel-Perfect VIDEO Vision Extractor & Layout Data Engine (v8)

You are an expert Computer Vision Engine, Color Calibration Specialist, and Spatial
Layout Architect. You will receive SEVERAL FRAMES sampled uniformly from ONE
looping video. They share the same static background; only the central subject
moves. Your output feeds an automated HTML/CSS composition engine that must hold
for EVERY moment of the loop, so precision is mandatory.

## INPUT MODEL (CRITICAL)
- All frames have the same resolution = the video's native resolution in px.
- The background (colors, dividers, embedded text/logos) is STATIC across frames.
- The subject MOVES between frames. Anything that changes position across frames
  is subject; anything static outside the subject is background.
- If you receive ONLY ONE frame: apply a +12% safety margin (of the subject's
  width/height) to every subject zone edge, and set
  motion_analysis.single_frame_margin_applied = true.

## COORDINATE SYSTEM (CRITICAL)
- Detect the TRUE native resolution of the frames in pixels. Never assume a
  default canvas size.
- All coordinates are absolute pixels (px). Top-left corner = { "x": 0, "y": 0 }.
- Every coordinate MUST be inside the frame bounds.

## WHAT YOU MUST EXTRACT (5 CORE LAYERS)

### LAYER A — BACKGROUND COLOR CALIBRATION (HIGHEST PRIORITY — 40% OF TASK VALUE)
The background colors are the most important values in your entire output.
An imprecise background HEX invalidates the whole result. Zero tolerance for error.
Sample across ALL frames (the background is identical in each — averaging across
frames cancels video-compression noise).

Follow this MANDATORY sampling protocol before writing any HEX value:

1. VIRTUAL MULTI-POINT SAMPLING: Mentally sample the background in at least 5
   separate points per background area, FAR from the subject in EVERY frame —
   corners plus the largest open areas. Ignore any pixel within ~5% of the
   subject's edge in ANY frame (contact shadows, glow, anti-aliasing halo, color
   bleed contaminate those pixels).
2. CHANNEL-LEVEL REASONING: Estimate each background color as explicit R, G, B
   channel values FIRST, then convert to HEX. State channels internally before
   committing. This prevents perceptual shortcuts.
3. NO COLOR SNAPPING — CRITICAL FOR SOFT / PASTEL / DESATURATED BACKGROUNDS:
   NEVER round toward a pure or "named" color (#FFFFFF, #000000, #FF0000, #F5F5F5,
   #FFC0CB...). Real backgrounds are almost never pure. A background that "looks
   white" is usually #FAF7F2, #F4F1EC, #F7F3EE — warm or cool tinted. A background
   that "looks gray" usually carries a hue bias (#E8E6E1 warm, #E4E7EA cool).
   Pastels are LIGHT but still SATURATED: a pastel pink is #F6DDE0-like, not white
   and not #FFC0CB. Detect and preserve these subtle tints:
   - Is it truly neutral (R≈G≈B), or is one channel 3–15 points higher?
   - Warm bias → R slightly > B. Cool bias → B slightly > R. Greenish → G highest.
   - Report the REAL measured tint, however subtle.
4. LIGHTNESS FIDELITY: Do not brighten light backgrounds to #FFFFFF or darken deep
   ones to #000000 unless they are truly pure. #0D0D0F is not #000000. #FBFAF8 is
   not #FFFFFF.
5. SELF-VERIFICATION PASS: For each color, re-check your HEX against the frames:
   "If I filled a canvas with this exact HEX and placed it beside that background
   area, would the seam be invisible?" If not, correct it. Iterate until yes.

In "palette_notes", briefly justify each background HEX: perceived hue family,
tint bias (warm/cool/neutral), approximate channel relationships.

### LAYER A2 — BACKGROUND TOPOLOGY (STRUCTURE OF THE BACKGROUND)
Classify how the static background is STRUCTURED and describe it as rectangular
regions that tile the ENTIRE frame with no gaps and no overlaps.

Types:
- "solid": one flat (or near-flat) color everywhere → exactly 1 region covering
  the full canvas.
- "split-vertical": two color fields side by side, ONE straight vertical divider →
  exactly 2 regions. Measure the divider x in px precisely.
- "split-horizontal": two color fields stacked, ONE straight horizontal divider →
  exactly 2 regions. Measure the divider y in px precisely.
- "grid-2x2": four color quadrants sharing a center point → exactly 4 regions.
  Measure divider x AND divider y in px.
- "complex": gradients with multiple hues, photographic scenes, heavy texture —
  the background cannot be represented by flat rectangles → regions = [] and set
  background_is_flat = false.

Rules for regions:
- rect_px MUST tile the full frame: outer edges at 0 and width/height, inner edges
  exactly at the measured divider(s). No gaps, no overlaps.
- If the divider is hidden behind the subject in some frames, use the frames where
  the subject has moved away, or extrapolate the straight line.
- Apply the FULL Layer A sampling protocol to EACH region independently.
- For EACH region also compute "ink": a high-contrast text color (HEX) readable ON
  that region's color, consistent with the artwork palette.
- Mild texture/noise inside a field (smoke, grain, subtle vignette, video
  compression artifacts) does NOT make it complex — report the field's average
  color. Only use "complex" when there are 3+ distinct hues blending or
  photographic content.

### LAYER B — MAIN SUBJECT: MOTION ENVELOPE (person, car, product, any moving object)
Report the UNION of the subject across ALL frames — the total area the subject
sweeps during the loop. Text will be placed outside this envelope, so it must hold
for EVERY moment:

- absolute_bounding_box: topmost/bottommost/leftmost/rightmost the subject reaches
  in ANY frame.
- Split the envelope into 3 vertical contour zones: top_zone (head/roof),
  middle_zone (torso/body), bottom_zone (legs/wheels/base).
- For EACH zone: left_edge_x_px = the MINIMUM left edge over all frames;
  right_edge_x_px = the MAXIMUM right edge over all frames.
- If the subject is cropped by the frame edge, extend the zone to the border and
  set is_cropped_by_frame accordingly.
- Describe the movement in motion_analysis.movement_description (e.g. "sways
  horizontally ±8% around center, no vertical travel").

### LAYER C — DESCRIPTION & TYPOGRAPHY STRATEGY
- 1-2 sentence description of composition, style, motion and mood.
- Suggest ONE impactful word (or 2-word phrase) for the LEFT text block and ONE
  for the RIGHT text block, matching the mood (uppercase, poster-style). Do NOT
  repeat words already embedded in the video (see LAYER D).
- Calculate SAFE typography zones in the negative space (never overlapping the
  motion envelope NOR any embedded text), using ALL available space from the
  envelope edge to the frame border.
- Identify ONE free horizontal strip for an audio-equalizer canvas (bottom or
  top); flag overlaps_subject if unavoidable.

### LAYER D — EMBEDDED TEXT (baked-in titles, logos, captions, watermarks)
Detect any text ALREADY RENDERED inside the video frames (static across frames).
Most videos have none — then return an empty array. For EACH text element found:

- content: the text read (OCR). If unreadable, describe it ("logo mark").
- rect_px: its bounding box in px, EXPANDED by ~5% breathing margin on all sides.
- role: "title" | "logo" | "caption" | "watermark" | "other".
- on_color: the background color HEX directly under that text.

These boxes become forbidden zones for new typography. Do NOT include text worn
ON the subject (t-shirt prints) unless it extends into the background.

## OUTPUT RULES
Return EXCLUSIVELY a raw JSON object. No markdown, no code fences, no commentary.
Start with { and end with }.

## EXACT SCHEMA
{
  "scene_overview": { "short_description": "", "style": "", "background_analysis": "" },
  "video_dimensions": { "width_px": 0, "height_px": 0, "aspect_ratio": "" },
  "motion_analysis": {
    "frames_analyzed": 0,
    "movement_description": "",
    "single_frame_margin_applied": false
  },
  "color_calibration": {
    "dominant_background_color": "#000000",
    "secondary_background_color": null,
    "background_is_flat": true,
    "high_contrast_text_color": "#000000",
    "palette_notes": ""
  },
  "background_layout": {
    "type": "solid",
    "regions": [
      { "color": "#000000", "ink": "#FFFFFF",
        "rect_px": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 } }
    ],
    "notes": ""
  },
  "embedded_text": [
    { "content": "", "rect_px": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 },
      "role": "title", "on_color": "#000000" }
  ],
  "main_subject": {
    "label": "",
    "is_cropped_by_frame": false,
    "absolute_bounding_box": { "top_y_px": 0, "bottom_y_px": 0, "left_x_px": 0,
      "right_x_px": 0, "total_width_px": 0, "total_height_px": 0 },
    "contour_zones": {
      "top_zone":    { "description": "", "y_start_px": 0, "y_end_px": 0,
                       "left_edge_x_px": 0, "right_edge_x_px": 0 },
      "middle_zone": { "description": "", "y_start_px": 0, "y_end_px": 0,
                       "left_edge_x_px": 0, "right_edge_x_px": 0 },
      "bottom_zone": { "description": "", "y_start_px": 0, "y_end_px": 0,
                       "left_edge_x_px": 0, "right_edge_x_px": 0 }
    }
  },
  "safe_typography_zones": {
    "strategy_description": "",
    "left_text_block":  { "suggested_text": "", "anchor_edge": "subject_left_edge",
      "placement": { "top_y_px": 0, "left_x_px": 0, "max_width_px": 0, "max_height_px": 0 } },
    "right_text_block": { "suggested_text": "", "anchor_edge": "subject_right_edge",
      "placement": { "top_y_px": 0, "left_x_px": 0, "max_width_px": 0, "max_height_px": 0 } }
  },
  "equalizer_canvas_zone": { "position": "bottom", "y_start_px": 0, "y_end_px": 0,
    "overlaps_subject": false, "notes": "" }
}

## VALIDATION CHECKLIST (verify before answering)
1. width_px / height_px match the real frame resolution.
2. Subject zones are the UNION over ALL frames (or single-frame + 12% margin,
   with the flag set). The subject never leaves the reported envelope.
3. No typography zone intersects the motion envelope NOR any embedded_text box.
4. HEX colors are 6-digit with strong contrast.
5. Every background color passed the full LAYER A protocol: multi-point sampling
   away from the subject, channel-level reasoning, tint preserved (NOT snapped to
   a pure/named color), lightness faithful, seam-test passed.
6. background_layout.regions tile the ENTIRE frame: no gaps, no overlaps, outer
   edges at 0/width/height, region count matches type (solid=1, split=2, grid=4,
   complex=0).
7. Each region's "ink" strongly contrasts with that region's "color".
8. embedded_text lists ALL baked-in background text with expanded rect_px — or is
   an empty array [].
9. dominant_background_color equals the color of the LARGEST region (or the
   overall average if type is "complex").
10. Output is pure, parseable JSON, nothing else.
```

---

## 8. PROMPT 2-VIDEO — TEMPLATE FILL v8 (pegar el JSON del paso anterior)

```
# SYSTEM PROMPT: Spatial Composition Builder (v8 — VIDEO Template Fill)

You are a precise code assembler. Below is a PROVEN, TESTED HTML template with a
built-in adaptive layout engine (looping video, responsive for desktop and mobile,
audio-reactive equalizer, multi-region background fill, per-region text ink,
embedded-text avoidance, and edge-fade seam blending included). It already works.
Do NOT redesign it, do NOT refactor it, do NOT add features.

## YOUR ONLY TASK
Replace the values inside the `const CONFIG = {...}` object using the VISION JSON
provided below. Nothing else in the template may change.

**Mapping (VISION JSON -> CONFIG):**
* video_dimensions.width_px / height_px -> video.w / video.h (src is always "video.mp4")
* color_calibration.dominant_background_color -> colors.bg
* color_calibration.high_contrast_text_color -> colors.ink
* background_layout.type -> bgMode:
    - "solid"                                   -> bgMode: "solid",   bgRegions: []
    - "split-vertical" | "split-horizontal"
      | "grid-2x2"                              -> bgMode: "regions", and map every
      background_layout.regions entry to bgRegions as
      { color, ink, rect: [x0, y0, x1, y1] } (from rect_px)
    - "complex"                                 -> bgMode: "blur",    bgRegions: []
* contour_zones (top, middle, bottom) -> zones as
  [y_start_px, y_end_px, left_edge_x_px, right_edge_x_px]   (motion envelope)
* absolute_bounding_box -> subject { top, bottom, left, right }
* embedded_text -> keepOut: one [x0, y0, x1, y1] entry per element (from rect_px);
  empty array [] if embedded_text is empty
* Texts: TEXT_LEFT / TEXT_RIGHT if provided; otherwise the suggested_text values
* equalizer_canvas_zone.position -> eqPosition
* edgeFade: ALWAYS keep 0.07 (do not map it from the JSON, do not remove it)

## VISION JSON
[INJECT_VISION_JSON_HERE]

## TEXT CONTENT (optional override)
* TEXT_LEFT: "[TEXT_LEFT]"
* TEXT_RIGHT: "[TEXT_RIGHT]"

## OUTPUT
Return ONLY the complete HTML (the template with CONFIG filled). Start with
<!DOCTYPE html>, end with </html>. No explanations.

## TEMPLATE (copy verbatim, fill only CONFIG)
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Spatial Composition — Video</title>
<style>
  :root { --bg: #FFFFFF; --ink: #111111; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 100vw; height: 100vh; overflow: hidden; background: var(--bg); cursor: none; }
  #stage { position: fixed; inset: 0; }
  #bgblur {
    position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: cover;
    z-index: 0; filter: blur(50px) saturate(1.15); transform: scale(1.15);
    display: none;
  }
  #bgfill { position: fixed; inset: 0; z-index: 0; }
  #bgfill div { position: absolute; }
  #bg {
    position: fixed; object-fit: contain; z-index: 1;
    --fx: 0px; --fy: 0px;
    -webkit-mask-image:
      linear-gradient(to right, transparent 0, #000 var(--fx), #000 calc(100% - var(--fx)), transparent 100%),
      linear-gradient(to bottom, transparent 0, #000 var(--fy), #000 calc(100% - var(--fy)), transparent 100%);
    -webkit-mask-composite: source-in;
    mask-image:
      linear-gradient(to right, transparent 0, #000 var(--fx), #000 calc(100% - var(--fx)), transparent 100%),
      linear-gradient(to bottom, transparent 0, #000 var(--fy), #000 calc(100% - var(--fy)), transparent 100%);
    mask-composite: intersect;
  }
  .txt {
    position: fixed; z-index: 3;
    font-family: "Arial Black", "Helvetica Neue", Impact, sans-serif;
    font-weight: 900; text-transform: uppercase;
    letter-spacing: -0.02em; line-height: 0.85;
    color: var(--ink); white-space: pre-line;
    user-select: none; pointer-events: none;
  }
  #eq { position: fixed; left: 0; bottom: 0; width: 100vw; z-index: 4; }
</style>
</head>
<body>
<div id="stage">
  <video id="bgblur" muted loop playsinline aria-hidden="true"></video>
  <div id="bgfill"></div>
  <video id="bg" src="video.mp4" autoplay muted loop playsinline></video>
  <div class="txt" id="txtL"></div>
  <div class="txt" id="txtR"></div>
  <canvas id="eq"></canvas>
  <audio id="audio" src="song.mp3" loop preload="auto"></audio>
</div>
<script type="module">
/* ============ CONFIG — the ONLY block the AI fills from the vision JSON ============ */
const CONFIG = {
  video:  { w: 720, h: 1280, src: "video.mp4" },
  colors: { bg: "#FFFFFF", ink: "#111111" },
  /* background mode: "solid" (one flat color) | "regions" (split / grid) | "blur" (complex) */
  bgMode: "solid",
  /* regions mode only: rect [x0,y0,x1,y1] in video px; regions must tile the full frame */
  bgRegions: [
    /* { color: "#0A0A0C", ink: "#F5F2EC", rect: [0, 0, 360, 1280] } */
  ],
  /* MOTION ENVELOPE: union of the subject across the WHOLE loop, in video px */
  zones: [
    [10, 175, 195, 400],    /* top: head sweep  */
    [175, 560, 145, 690],   /* middle: torso sweep */
    [560, 1280, 100, 700]   /* bottom: legs sweep */
  ],
  subject: { top: 10, bottom: 1280, left: 75, right: 690 },
  /* baked-in text areas to keep clear, [x0,y0,x1,y1] in video px (from embedded_text) */
  keepOut: [],
  texts:  { left: "STRIKE", right: "FORCE" },
  eqPosition: "bottom",
  /* edge fade: fraction of the smaller rendered dimension (0 disables it) */
  edgeFade: 0.07
};
/* ==================================================================================== */

const GUT = 20, GAP = 14, doc = document;
const $ = id => doc.getElementById(id);
const bgEl = $("bg"), tL = $("txtL"), tR = $("txtR"), eq = $("eq");
doc.documentElement.style.setProperty("--bg", CONFIG.colors.bg);
doc.documentElement.style.setProperty("--ink", CONFIG.colors.ink);
bgEl.src = CONFIG.video.src;

/* ---- text measurement (linear scaling: measure once at 100px) ---- */
const mctx = doc.createElement("canvas").getContext("2d");
const FONT = s => `900 ${s}px "Arial Black","Helvetica Neue",Impact,sans-serif`;
function measure(str) { mctx.font = FONT(100); return mctx.measureText(str).width; }

/* ---- fit helpers: each returns {fs, w, h, content} or null ---- */
function fitH(text, rw, rh) {                     /* horizontal, 1 line */
  const w100 = measure(text);
  const fs = Math.min(100 * rw / w100, rh / 0.85);
  return fs > 4 ? { fs, w: w100 * fs / 100, h: fs * 0.85, content: text } : null;
}
function fitW(text, rw, rh) {                     /* horizontal, wrap by words */
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return null;
  const maxW100 = Math.max(...words.map(measure));
  const fs = Math.min(100 * rw / maxW100, rh / (words.length * 0.85));
  return fs > 4 ? { fs, w: maxW100 * fs / 100, h: words.length * fs * 0.85, content: words.join("\n") } : null;
}
function fitV(text, rw, rh) {                     /* vertical letter stack */
  const chars = text.replace(/\s+/g, "").split("");
  const maxC100 = Math.max(...chars.map(measure));
  const fs = Math.min(100 * rw / maxC100, rh / (chars.length * 0.85));
  return fs > 4 ? { fs, w: maxC100 * fs / 100, h: chars.length * fs * 0.85, content: chars.join("\n") } : null;
}

/* ---- pick best fit for a set of candidate rects, horizontal preferred ---- */
function bestFit(text, rects, minFS) {
  let bH = null, bV = null, rH = null, rV = null;
  for (const r of rects) {
    if (r.w < 30 || r.h < 30) continue;
    for (const f of [fitH(text, r.w, r.h), fitW(text, r.w, r.h)])
      if (f && (!bH || f.fs > bH.fs)) { bH = f; rH = r; }
    const v = fitV(text, r.w, r.h);
    if (v && (!bV || v.fs > bV.fs)) { bV = v; rV = r; }
  }
  if (bH && bH.fs >= minFS) return { ...bH, rect: rH };          /* 1: horizontal fits well */
  if (bV && bV.fs >= minFS) return { ...bV, rect: rV };          /* 2: vertical fits well  */
  const s = (bH && bV) ? (bH.fs >= bV.fs ? { f: bH, r: rH } : { f: bV, r: rV })
          : bH ? { f: bH, r: rH } : bV ? { f: bV, r: rV } : null; /* 3: shrink, keep larger */
  return s ? { ...s.f, rect: s.r } : null;
}

/* ---- apply a fit to a DOM node, clamped fully inside the viewport ---- */
function place(el, fit, align) {
  if (!fit) { el.textContent = ""; return null; }
  const vw = innerWidth, vh = innerHeight, r = fit.rect;
  el.style.fontSize = fit.fs + "px";
  el.textContent = fit.content;
  let x = align === "right" ? r.x + r.w - fit.w
        : align === "band"  ? r.x + (r.w - fit.w) / 2
        : r.x;
  let y = r.y + (r.h - fit.h) / 2;
  x = Math.max(GUT, Math.min(x, vw - fit.w - GUT));
  y = Math.max(GUT, Math.min(y, vh - fit.h - GUT));
  el.style.left = x + "px";
  el.style.top = y + "px";
  el.style.textAlign = align === "band" ? "center" : align;
  return { x, y, w: fit.w, h: fit.h };
}

/* ---- per-frame ink lookup for the equalizer, rebuilt by layout() ---- */
let eqInk = null;

/* ---- layout engine: runs on load + resize only ---- */
function layout() {
  tL.style.textShadow = ""; tR.style.textShadow = "";
  const vw = innerWidth, vh = innerHeight;
  const C = CONFIG, iw = C.video.w, ih = C.video.h;
  const dw = Math.min(vw, vh * iw / ih), dh = Math.min(vh, vw * ih / iw);
  const ix = (vw - dw) / 2, iy = (vh - dh) / 2, k = dw / iw;
  bgEl.style.cssText += `left:${ix}px;top:${iy}px;width:${dw}px;height:${dh}px;`;
  const X = px => ix + px * k, Y = px => iy + px * k;

  /* edge fade: only on axes where the video doesn't reach the viewport edge;
     blur mode blends into the blurred underlay, so it takes a wider fade */
  const fadeK = (C.edgeFade || 0) * (C.bgMode === "blur" ? 2 : 1);
  const fade = Math.max(24, Math.min(C.bgMode === "blur" ? 160 : 90, Math.min(dw, dh) * fadeK));
  bgEl.style.setProperty("--fx", (C.edgeFade && dw < vw - 1 ? fade : 0) + "px");
  bgEl.style.setProperty("--fy", (C.edgeFade && dh < vh - 1 ? fade : 0) + "px");

  const eqH = Math.min(90, Math.max(44, vh * 0.06));
  eq.style.height = eqH + "px";
  const minFS = Math.max(26, vh * 0.05);

  /* ---- page fill behind the video: solid, regions, or blurred underlay ---- */
  const blurEl = $("bgblur"), fillEl = $("bgfill");
  const regions = C.bgMode === "regions" ? (C.bgRegions || []) : [];
  blurEl.style.display = C.bgMode === "blur" ? "block" : "none";
  if (C.bgMode === "blur" && !blurEl.getAttribute("src")) {
    blurEl.src = C.video.src;
    blurEl.play().catch(() => {});
  }
  /* project a region rect to viewport px; sides on the frame border extend to the viewport border */
  const proj = rg => {
    const [x0, y0, x1, y1] = rg.rect;
    return { x0: x0 <= 0 ? 0 : X(x0), x1: x1 >= iw ? vw : X(x1),
             y0: y0 <= 0 ? 0 : Y(y0), y1: y1 >= ih ? vh : Y(y1) };
  };
  fillEl.innerHTML = "";
  for (const rg of regions) {
    const p = proj(rg), d = doc.createElement("div");
    d.style.cssText = `left:${p.x0}px;top:${p.y0}px;width:${p.x1 - p.x0}px;height:${p.y1 - p.y0}px;background:${rg.color};`;
    fillEl.appendChild(d);
  }
  /* ink of the region under a viewport point (default ink when none matches) */
  const inkAt = (px, py) => {
    for (const rg of regions) {
      const p = proj(rg);
      if (px >= p.x0 && px < p.x1 && py >= p.y0 && py < p.y1) return rg.ink || C.colors.ink;
    }
    return C.colors.ink;
  };
  eqInk = regions.length ? (x => inkAt(x, vh - eqH / 2)) : null;
  const tint = (el, p) => { if (p) el.style.color = inkAt(p.x + p.w / 2, p.y + p.h / 2); };
  /* cut candidate rects by region boundaries so text never straddles two colors */
  const cut = rects => {
    if (!regions.length) return rects;
    const out = [];
    for (const r of rects) for (const rg of regions) {
      const p = proj(rg);
      const x0 = Math.max(r.x, p.x0), y0 = Math.max(r.y, p.y0);
      const x1 = Math.min(r.x + r.w, p.x1), y1 = Math.min(r.y + r.h, p.y1);
      if (x1 - x0 >= 30 && y1 - y0 >= 30) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
    return out.length ? out : rects;
  };
  /* carve baked-in text areas (keepOut) out of the candidates — guillotine split */
  const carve = rects => {
    let list = rects;
    for (const ko of (C.keepOut || [])) {
      const kx0 = X(ko[0]), ky0 = Y(ko[1]), kx1 = X(ko[2]), ky1 = Y(ko[3]);
      const next = [];
      for (const r of list) {
        const ox0 = Math.max(r.x, kx0), oy0 = Math.max(r.y, ky0);
        const ox1 = Math.min(r.x + r.w, kx1), oy1 = Math.min(r.y + r.h, ky1);
        if (ox0 >= ox1 || oy0 >= oy1) { next.push(r); continue; }   /* no overlap */
        if (ox0 - r.x >= 30)         next.push({ x: r.x, y: r.y, w: ox0 - r.x, h: r.h });
        if (r.x + r.w - ox1 >= 30)   next.push({ x: ox1, y: r.y, w: r.x + r.w - ox1, h: r.h });
        if (oy0 - r.y >= 30)         next.push({ x: r.x, y: r.y, w: r.w, h: oy0 - r.y });
        if (r.y + r.h - oy1 >= 30)   next.push({ x: r.x, y: oy1, w: r.w, h: r.y + r.h - oy1 });
      }
      list = next;
    }
    return list;
  };
  const usable = rects => carve(cut(rects));

  /* side rects: one candidate per contour zone, per side */
  const rectsL = [], rectsR = [];
  for (const [y0, y1, xl, xr] of C.zones) {
    const ry = Math.max(GUT, Y(y0)), ry1 = Math.min(vh - GUT, Y(y1));
    rectsL.push({ x: GUT, y: ry, w: X(xl) - GAP - GUT, h: ry1 - ry });
    rectsR.push({ x: X(xr) + GAP, y: ry, w: vw - GUT - X(xr) - GAP, h: ry1 - ry });
  }
  /* try flanking first; if EITHER side can't reach a readable size → band mode */
  const fL = bestFit(C.texts.left, usable(rectsL), minFS), fR = bestFit(C.texts.right, usable(rectsR), minFS);
  const flankOK = fL && fR && fL.fs >= minFS && fR.fs >= minFS;

  if (flankOK) {                                   /* DESKTOP: flank the subject */
    tint(tL, place(tL, fL, "right"));
    tint(tR, place(tR, fR, "left"));
  } else {                                         /* MOBILE: top & bottom bands */
    const bandW = vw - 2 * GUT;
    const topEnd = Math.max(iy, Y(C.subject.top)) - GAP;
    const botStart = Math.max(Y(C.subject.bottom), iy + dh) + GAP;
    const botEnd = vh - eqH - GAP;
    const topOK = topEnd - GUT >= 46, botOK = botEnd - botStart >= 46;
    let txtT = C.texts.left, txtB = C.texts.right, bT, bB;
    if (topOK && botOK) {
      bT = { x: GUT, y: GUT, w: bandW, h: topEnd - GUT };
      bB = { x: GUT, y: botStart, w: bandW, h: botEnd - botStart };
    } else if (topOK) {            /* no room below → stack both words on top */
      txtT = C.texts.left + " " + C.texts.right; txtB = "";
      bT = { x: GUT, y: GUT, w: bandW, h: topEnd - GUT };
    } else if (botOK) {            /* no room above → stack both words below */
      txtB = C.texts.left + " " + C.texts.right; txtT = "";
      bB = { x: GUT, y: botStart, w: bandW, h: botEnd - botStart };
    } else {                       /* video fills viewport → overlay top strip */
      txtT = C.texts.left + " " + C.texts.right; txtB = "";
      bT = { x: GUT, y: GUT, w: bandW, h: vh * 0.16 };
      tL.style.textShadow = "0 0 10px var(--bg), 0 0 22px var(--bg), 0 0 34px var(--bg)";
    }
    tint(tL, place(tL, txtT && bT ? bestFit(txtT, usable([bT]), 18) : null, "band"));
    tint(tR, place(tR, txtB && bB ? bestFit(txtB, usable([bB]), 18) : null, "band"));
  }

  /* canvas backing store, DPR-sharp */
  const dpr = devicePixelRatio || 1;
  eq.width = vw * dpr; eq.height = eqH * dpr;
  const c = eq.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let rq = false;
function queueLayout() { if (!rq) { rq = true; requestAnimationFrame(() => { rq = false; layout(); }); } }
addEventListener("resize", queueLayout);
addEventListener("load", queueLayout);
if (bgEl.readyState >= 1) layout(); else bgEl.addEventListener("loadedmetadata", queueLayout);
layout();

/* ---- audio + equalizer (never blocks rendering if song.mp3 is missing) ---- */
const audio = $("audio");
let analyser = null, freq = null;
async function initAudio() {
  try {
    bgEl.play().catch(() => {});               /* keep the video loop running */
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const src = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256; analyser.smoothingTimeConstant = 0.82;
    src.connect(analyser); analyser.connect(ctx.destination);
    freq = new Uint8Array(analyser.frequencyBinCount);
    if (ctx.state === "suspended") await ctx.resume();
    await audio.play();
  } catch (e) { /* headless autoplay ok; browser needs a gesture */ }
}
addEventListener("DOMContentLoaded", initAudio);
addEventListener("pointerdown", () => { initAudio(); }, { once: true });

const ec = eq.getContext("2d");
const BARS = 64;
function draw() {
  const w = eq.width / (devicePixelRatio || 1), h = eq.height / (devicePixelRatio || 1);
  ec.clearRect(0, 0, w, h);
  const bw = w / BARS, mid = h / 2;
  if (analyser && freq) analyser.getByteFrequencyData(freq);
  for (let i = 0; i < BARS; i++) {
    const v = freq ? freq[Math.floor(i * freq.length / BARS)] / 255 : 0;
    const bh = Math.max(2, v * (h - 6));
    ec.fillStyle = eqInk ? eqInk(i * bw + bw / 2) : CONFIG.colors.ink;
    ec.fillRect(i * bw + bw * 0.18, mid - bh / 2, bw * 0.64, bh);
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);
</script>
</body>
</html>
```

---

## 9. JSONs DE PRUEBA (para probar el Prompt 2 sin pasar por el Prompt 1)

Pegar cualquiera de estos en `[INJECT_VISION_JSON_HERE]` del Prompt 2-VIDEO y
verificar el HTML resultante contra el checklist (§11).

### 9.1 SECCIÓN A — Split vertical 2 colores + texto incrustado (replica el test verificado)

```json
{
  "scene_overview": {
    "short_description": "A dark humanoid figure sways gently at the center of a hard black/cream split background.",
    "style": "minimal poster, high contrast",
    "background_analysis": "Static two-field background: near-black left half, warm off-white right half, hard vertical divider at x=360."
  },
  "video_dimensions": { "width_px": 720, "height_px": 1280, "aspect_ratio": "9:16" },
  "motion_analysis": {
    "frames_analyzed": 6,
    "movement_description": "Subject sways horizontally ±60px around center; no vertical travel.",
    "single_frame_margin_applied": false
  },
  "color_calibration": {
    "dominant_background_color": "#12121A",
    "secondary_background_color": "#EFEAE1",
    "background_is_flat": true,
    "high_contrast_text_color": "#F5F2EA",
    "palette_notes": "Left: very dark cool navy-black, B>R by ~6 points, not pure black. Right: warm off-white, R>B by ~14 points, not pure white."
  },
  "background_layout": {
    "type": "split-vertical",
    "regions": [
      { "color": "#12121A", "ink": "#F5F2EA", "rect_px": { "x0": 0,   "y0": 0, "x1": 360, "y1": 1280 } },
      { "color": "#EFEAE1", "ink": "#14141A", "rect_px": { "x0": 360, "y0": 0, "x1": 720, "y1": 1280 } }
    ],
    "notes": "Hard straight divider at x=360, extrapolated behind the subject."
  },
  "embedded_text": [
    { "content": "LIVE", "rect_px": { "x0": 460, "y0": 40, "x1": 710, "y1": 160 },
      "role": "title", "on_color": "#EFEAE1" }
  ],
  "main_subject": {
    "label": "swaying humanoid silhouette",
    "is_cropped_by_frame": true,
    "absolute_bounding_box": { "top_y_px": 300, "bottom_y_px": 1280, "left_x_px": 190,
      "right_x_px": 530, "total_width_px": 340, "total_height_px": 980 },
    "contour_zones": {
      "top_zone":    { "description": "head sweep",  "y_start_px": 300, "y_end_px": 440,
                       "left_edge_x_px": 240, "right_edge_x_px": 480 },
      "middle_zone": { "description": "torso sweep", "y_start_px": 440, "y_end_px": 900,
                       "left_edge_x_px": 190, "right_edge_x_px": 530 },
      "bottom_zone": { "description": "legs sweep",  "y_start_px": 900, "y_end_px": 1280,
                       "left_edge_x_px": 210, "right_edge_x_px": 530 }
    }
  },
  "safe_typography_zones": {
    "strategy_description": "Left block on the dark half beside the torso; right block on the cream half below the embedded LIVE title.",
    "left_text_block":  { "suggested_text": "PULSE", "anchor_edge": "subject_left_edge",
      "placement": { "top_y_px": 440, "left_x_px": 20, "max_width_px": 170, "max_height_px": 460 } },
    "right_text_block": { "suggested_text": "MOTION", "anchor_edge": "subject_right_edge",
      "placement": { "top_y_px": 440, "left_x_px": 540, "max_width_px": 180, "max_height_px": 460 } }
  },
  "equalizer_canvas_zone": { "position": "bottom", "y_start_px": 1200, "y_end_px": 1280,
    "overlaps_subject": true, "notes": "Subject legs reach the bottom edge; bars overlap slightly." }
}
```

### 9.2 SECCIÓN A — Grid 2×2 (4 colores)

```json
{
  "scene_overview": {
    "short_description": "A centered figure rotates slowly over a four-quadrant color-block background.",
    "style": "color-block poster",
    "background_analysis": "Static 2x2 grid: navy / cream on top, wine red / forest green below, dividers at x=360 and y=640."
  },
  "video_dimensions": { "width_px": 720, "height_px": 1280, "aspect_ratio": "9:16" },
  "motion_analysis": {
    "frames_analyzed": 6,
    "movement_description": "Subject rotates in place; envelope widens torso zone by ~40px per side.",
    "single_frame_margin_applied": false
  },
  "color_calibration": {
    "dominant_background_color": "#171A2B",
    "secondary_background_color": "#EFE7D8",
    "background_is_flat": true,
    "high_contrast_text_color": "#EDEDF2",
    "palette_notes": "Navy: cool, B>R by ~16. Cream: warm, R>B by ~23. Wine: muted red, R dominant. Green: desaturated forest, G>R by ~26."
  },
  "background_layout": {
    "type": "grid-2x2",
    "regions": [
      { "color": "#171A2B", "ink": "#EDEDF2", "rect_px": { "x0": 0,   "y0": 0,   "x1": 360, "y1": 640  } },
      { "color": "#EFE7D8", "ink": "#1A1710", "rect_px": { "x0": 360, "y0": 0,   "x1": 720, "y1": 640  } },
      { "color": "#7E2A33", "ink": "#F7E9EA", "rect_px": { "x0": 0,   "y0": 640, "x1": 360, "y1": 1280 } },
      { "color": "#24463A", "ink": "#E8F2ED", "rect_px": { "x0": 360, "y0": 640, "x1": 720, "y1": 1280 } }
    ],
    "notes": "Dividers at x=360 and y=640, hard edges."
  },
  "embedded_text": [],
  "main_subject": {
    "label": "rotating figure",
    "is_cropped_by_frame": true,
    "absolute_bounding_box": { "top_y_px": 300, "bottom_y_px": 1280, "left_x_px": 210,
      "right_x_px": 510, "total_width_px": 300, "total_height_px": 980 },
    "contour_zones": {
      "top_zone":    { "description": "head sweep",  "y_start_px": 300, "y_end_px": 440,
                       "left_edge_x_px": 260, "right_edge_x_px": 460 },
      "middle_zone": { "description": "torso sweep", "y_start_px": 440, "y_end_px": 900,
                       "left_edge_x_px": 210, "right_edge_x_px": 510 },
      "bottom_zone": { "description": "legs sweep",  "y_start_px": 900, "y_end_px": 1280,
                       "left_edge_x_px": 230, "right_edge_x_px": 510 }
    }
  },
  "safe_typography_zones": {
    "strategy_description": "One word per lower quadrant, flanking the torso envelope.",
    "left_text_block":  { "suggested_text": "CUATRO", "anchor_edge": "subject_left_edge",
      "placement": { "top_y_px": 660, "left_x_px": 20, "max_width_px": 180, "max_height_px": 500 } },
    "right_text_block": { "suggested_text": "CAMPOS", "anchor_edge": "subject_right_edge",
      "placement": { "top_y_px": 660, "left_x_px": 520, "max_width_px": 180, "max_height_px": 500 } }
  },
  "equalizer_canvas_zone": { "position": "bottom", "y_start_px": 1200, "y_end_px": 1280,
    "overlaps_subject": true, "notes": "" }
}
```

### 9.3 SECCIÓN B — Fondo degradado multicolor (complex → blur)

```json
{
  "scene_overview": {
    "short_description": "A dark figure drifts over a diagonal teal-to-purple-to-orange gradient.",
    "style": "neon gradient, atmospheric",
    "background_analysis": "Static diagonal multi-hue gradient (teal upper-left, purple center, orange lower-right); cannot be tiled with flat rectangles."
  },
  "video_dimensions": { "width_px": 720, "height_px": 1280, "aspect_ratio": "9:16" },
  "motion_analysis": {
    "frames_analyzed": 6,
    "movement_description": "Subject drifts ±40px horizontally, ±20px vertically.",
    "single_frame_margin_applied": false
  },
  "color_calibration": {
    "dominant_background_color": "#5A328C",
    "secondary_background_color": null,
    "background_is_flat": false,
    "high_contrast_text_color": "#FFFFFF",
    "palette_notes": "Mid-field average is a saturated violet; gradient spans teal (#1E7882) to orange (#E68C3C). No flat field exists."
  },
  "background_layout": {
    "type": "complex",
    "regions": [],
    "notes": "3+ hues blending diagonally — blur mode required."
  },
  "embedded_text": [],
  "main_subject": {
    "label": "drifting figure",
    "is_cropped_by_frame": true,
    "absolute_bounding_box": { "top_y_px": 280, "bottom_y_px": 1280, "left_x_px": 210,
      "right_x_px": 510, "total_width_px": 300, "total_height_px": 1000 },
    "contour_zones": {
      "top_zone":    { "description": "head sweep",  "y_start_px": 280, "y_end_px": 450,
                       "left_edge_x_px": 260, "right_edge_x_px": 460 },
      "middle_zone": { "description": "torso sweep", "y_start_px": 450, "y_end_px": 920,
                       "left_edge_x_px": 210, "right_edge_x_px": 510 },
      "bottom_zone": { "description": "legs sweep",  "y_start_px": 920, "y_end_px": 1280,
                       "left_edge_x_px": 230, "right_edge_x_px": 510 }
    }
  },
  "safe_typography_zones": {
    "strategy_description": "White ink flanking the envelope; blurred underlay keeps contrast acceptable on both sides.",
    "left_text_block":  { "suggested_text": "NEON", "anchor_edge": "subject_left_edge",
      "placement": { "top_y_px": 450, "left_x_px": 20, "max_width_px": 180, "max_height_px": 470 } },
    "right_text_block": { "suggested_text": "DRIFT", "anchor_edge": "subject_right_edge",
      "placement": { "top_y_px": 450, "left_x_px": 520, "max_width_px": 180, "max_height_px": 470 } }
  },
  "equalizer_canvas_zone": { "position": "bottom", "y_start_px": 1200, "y_end_px": 1280,
    "overlaps_subject": true, "notes": "" }
}
```

---

## 10. RESULTADOS VERIFICADOS

Video de control generado con ffmpeg (720×1280, 30fps, loop de 2s, H.264): fondo
split oscuro/crema estático, sujeto oscilando ±60px, texto "LIVE" incrustado
arriba a la derecha.

| Escenario | Viewport | Resultado |
|---|---|---|
| Split + regiones + keepOut | 1440×900 | Divisor continuo sin costura; tintas por lado correctas; MOTION esquivó el "LIVE" incrustado (carve); envolvente respetada. |
| Split + regiones + keepOut | 390×844 | Pilas verticales flanqueando la envolvente; tintas correctas; LIVE intacto; fade vertical en las piernas. |
| Mismo video en modo blur | 1440×900 | Underlay difuminado sin costuras — y demostró que blur NO es para splits (mancha del sujeto difuminado en el lado claro): confirma la regla de decisión del Prompt 1. |

Notas de reproducción:
- `autoplay muted loop playsinline` arranca el loop sin gesto del usuario.
- Para captura/grabación headless: añadir
  `--autoplay-policy=no-user-gesture-required` a Chromium.
- El primer gesto del usuario (pointerdown) inicia `song.mp3` + ecualizador, igual
  que en el pipeline de imagen.

## 11. CHECKLIST DE VERIFICACIÓN DEL RESULTADO

1. **Sin costuras**: ninguna línea visible donde termina el video, en ningún lado,
   durante TODO el loop.
2. **Divisores alineados** (regions): la frontera del relleno continúa exactamente
   la del video, también tras redimensionar.
3. **El sujeto nunca toca el texto**: mirar el loop COMPLETO — si en algún momento
   el sujeto pisa una palabra, la envolvente del JSON quedó corta (re-extraer con
   más fotogramas).
4. **Texto incrustado intacto**: ninguna palabra nueva pisa el texto que trae el
   video (keepOut).
5. **Tinta correcta por región**; ninguna palabra a caballo entre dos colores.
6. **Ecualizador**: barras visibles, cambian de color al cruzar divisores.
7. **El video está en loop** y arranca solo (muted + autoplay).

## 12. AJUSTES RÁPIDOS

| Quiero… | Cambiar |
|---|---|
| Movimiento amplio/rápido mal cubierto | Re-extraer con `fps=12/$D` (12 fotogramas) |
| Fade más ancho | `edgeFade: 0.10` – `0.12` |
| Sin fade | `edgeFade: 0` |
| Ahorrar CPU en modo blur | Sustituir el `<video id="bgblur">` por `<img id="bgblur" src="bgframe.jpg">` (fotograma exportado: `ffmpeg -i video.mp4 -frames:v 1 bgframe.jpg`) |
| Más margen alrededor del texto incrustado | Ampliar el rect en `keepOut` (±20px) |
| Forzar blur | `bgMode: "blur"` (solo para fondos degradados) |

## 13. ARCHIVOS DE ESTE ESTUDIO

| Archivo | Contenido |
|---|---|
| `ESTUDIO-VIDEO.md` | Este estudio (prompts v8 completos + JSONs de prueba) |
| `in-video.html` + `video-split.mp4` | Test verificado: split + envolvente + keepOut |
| `in-video-blur.html` | Test del modo blur con video (2º video difuminado) |
| `ESTUDIO-FONDOS-COMPLEJOS.md` | Estudio v7 de imagen (base del modelo de regiones) |
| `ESTUDIO-COMPLETO.md` | Estudio base del pipeline de imagen (v5/v6) |

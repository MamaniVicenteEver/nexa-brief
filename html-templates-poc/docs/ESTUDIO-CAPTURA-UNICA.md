# ESTUDIO COMPLETO — CAPTURA ÚNICA (v9)
### Un solo fotograma → JSON → HTML adaptativo · orientación y formato automáticos · texto incrustado protegido
**Fecha:** Julio 2026 · **Estado:** Probado en Chromium headless con los VIDEOS REALES del usuario (test2.mp4, test3.mp4 + prueba de rotación sintética)

---

## 1. OBJETIVO Y DECISIÓN DE DISEÑO

El estudio v8 proponía extraer 6+ fotogramas por video. Con videos de 10–20 segundos
eso significa muchas imágenes por análisis → **demasiado costoso** para operar a
escala. Decisión de esta versión:

> **Se envía UNA sola captura (el primer fotograma) a la IA de visión.**
> El movimiento se cubre con un margen de seguridad automático, no con más fotogramas.

Trade-off aceptado y explícito: si el sujeto se mueve MÁS que el margen, puede haber
un solapamiento puntual entre el sujeto y las letras. Los videos de este flujo tienen
movimiento limitado, así que el riesgo es bajo y asumible. El flujo es manual por
ahora (el usuario captura y pega en la IA); la automatización llega después (§11).

Todo lo demás del sistema se conserva: precisión de color de fondo, regiones
(split/grid), modo blur, tinta por región, ecualizador multicolor, edge fade.

**Novedades de la v9** (las métricas nuevas):

| # | Novedad | Qué resuelve |
|---|---|---|
| 1 | Captura única + margen de movimiento (+12%) | Costo de análisis mínimo |
| 2 | `canvas_analysis`: rotación + content box + orientación | Videos 9:16, 16:9, verticales que en realidad son horizontales, contenido con franjas |
| 3 | keepOut reforzado (verificado con marca de agua real) | Nuestras letras JAMÁS tapan las letras que ya trae el video/imagen |

---

## 2. EL FLUJO DE CAPTURA ÚNICA

```
[video.mp4]  (o una imagen — el prompt es el mismo)
     │
     ▼
PASO 0 — capturar el PRIMER fotograma
     │     ffmpeg -y -i video.mp4 -frames:v 1 -q:v 2 captura.jpg
     │     (o captura de pantalla manual del video en pausa, fotograma 1)
     ▼
PASO 1 — PROMPT 1-CAPTURA v9 + captura.jpg (IA multimodal)
     │     extrae: canvas/orientación/content box, colores/regiones,
     │     sujeto con margen de movimiento, texto incrustado, palabras
     ▼
[JSON espacial v9]
     │
     ▼
PASO 2 — PROMPT 2 v9 (IA de texto o script)
     │     rellena SOLO el CONFIG de la plantilla v9
     ▼
[index.html] + video.mp4 + song.mp3   →  loop reproduciéndose como una sola pieza
```

### El margen de movimiento

Como solo hay un fotograma, el prompt ordena a la IA **inflar cada zona del sujeto
un 12%** de su tamaño hacia cada lado (y declararlo en `motion_estimate`). Si se
sabe que un video se mueve más (péndulos amplios, cámara viva), se le puede decir a
la IA en el mismo mensaje: "usa margen 20%". Regla práctica:

| Movimiento del video | Margen |
|---|---|
| Respiración, partículas, glow (default) | 12% |
| Balanceo visible del cuerpo | 18–20% |
| Desplazamientos amplios | usar el flujo multi-fotograma del ESTUDIO-VIDEO.md (v8) |

---

## 3. LA MÉTRICA NUEVA: CANVAS vs CONTENIDO (orientación y formato)

El problema real detectado en los archivos de test del usuario: **el tamaño del
archivo no dice la verdad sobre la composición**. Tres casos distintos:

### 3.1 Formato del archivo variable (9:16, 16:9, 1:1…)

El HTML ya se adapta a cualquier proporción — el motor calcula todo desde `w/h`.
Ningún cambio necesario, pero ahora el JSON lo reporta explícitamente.

### 3.2 Contenido ROTADO (archivo vertical, composición horizontal — o viceversa)

Caso real: `test1.png` — lienzo vertical 736×1281, pero el personaje está
ACOSTADO: la composición real es horizontal girada 90°. Mostrarla vertical es un
error. La IA lo detecta (sujeto/caras/texto de lado → "para ver esto derecho hay
que girarlo") y reporta `rotation_to_upright_deg: 90 o -90`. La plantilla aplica
la rotación con CSS (`transform: rotate(…)`) y compone TODO en el sistema de
coordenadas ya enderezado.

**Verificado:** se generó un video girado 90° (archivo 1280×720 con el contenido
de lado) y con `rotation: -90` el resultado renderiza IDÉNTICO al original
vertical — misma tipografía, mismo fade, mismo keepOut.

### 3.3 Contenido con FRANJAS (letterbox) — "es 9:16 pero realmente es horizontal"

Caso real: `test3.mp4` — archivo 720×1280 pero el contenido real (los ojos) vive
en una banda horizontal central; arriba y abajo solo hay negro de relleno. La IA
reporta el `content_box_px` (la caja donde vive el contenido real) y la plantilla
**recorta y compone sobre el contenido, no sobre el archivo**: el resultado es una
composición genuinamente horizontal.

**Verificado:** test3.mp4 con `content: [0, 280, 720, 880]` produce en desktop una
pieza horizontal a pantalla con GAZE/STORM en el espacio negativo — el archivo
"vertical" se convirtió en horizontal automáticamente.

### 3.4 Regla de oro del sistema de coordenadas

> **TODAS las coordenadas del JSON (regiones, zonas, sujeto, texto incrustado) se
> expresan en píxeles del lienzo ENDEREZADO (upright)** — lo que se ve cuando la
> imagen está bien orientada. La plantilla se encarga del resto (rotar el archivo,
> recortar al content box, proyectar al viewport).

---

## 4. TEXTO INCRUSTADO — NUESTRAS LETRAS NUNCA TAPAN LAS SUYAS

Igual que la v8 (LAYER D + keepOut + corte guillotina), ahora **verificado con un
archivo real**: `test2.mp4` trae la marca de agua "mylivewallpapers.com" abajo al
centro. Con `keepOut: [[140, 1210, 580, 1280]]`:

- Desktop: RISE/SILENT flanquean al sujeto; nada pisa la marca de agua.
- Móvil: el motor eligió apilar las palabras ARRIBA (el carve eliminó la banda
  inferior porque la marca de agua no dejaba altura útil) — exactamente el
  comportamiento deseado sin programar nada específico.

Aplica igual a imágenes (test5.png con "MONKEY D. LUFFY…" es el mismo caso: cada
bloque de texto del póster se reporta en `embedded_text` y se convierte en keepOut).

---

## 5. CLASIFICACIÓN DE LOS ARCHIVOS DE TEST (ground truth)

Tabla de referencia: qué DEBERÍA devolver la IA de visión para cada archivo de
test del usuario. Sirve para validar manualmente los JSON durante las pruebas.

| Archivo | Canvas | Rotación | Content box | Fondo (`background_layout.type`) | Texto incrustado |
|---|---|---|---|---|---|
| test1.png | 736×1281 | **90°** (composición horizontal acostada) | completo | complex (blanco cálido con tinta/salpicaduras → blur) o solid #E8E4DE con fade fuerte | sello japonés + logo "SHONEN SKETCHER" + ícono de perfil abajo-izq |
| test2.png / test4.png | 736×1307 | 0 | completo | según imagen | según imagen |
| test3.png | 1152×2048 | 0 | completo | complex (degradado púrpura/rosa → blur) | ninguno |
| test5.png | 941×1672 | 0 | completo | solid crema cálido (~#F1EAD8) | MUCHO: "ONE PIECE", "MONKEY", "D·LUFFY", "Gear 5", "FREEDOM IS MY NATURE", firma, "TO BE CONTINUED" → varios keepOut |
| test1.mp4 | 720×1290, 12s | 0 | completo | solid casi-negro con aura enorme (envolvente generosa) | ninguno |
| test2.mp4 | 720×1280, 13s | 0 | completo | complex (niebla gris monocroma → blur) | watermark "mylivewallpapers.com" abajo → keepOut |
| test3.mp4 | 720×1280, 16s | 0 | **[0, 280, 720, 880]** → composición HORIZONTAL | solid #030303 (negro de video, no #000000 puro) | ninguno |
| test4.mp4 | 720×1280, 19s | 0 | completo | solid negro (divisor irregular con la cara = sujeto, no región) | ninguno |

---

## 6. PROMPT 1-CAPTURA v9 (enviar con UNA captura del primer fotograma — vale para video e imagen)

```
# SYSTEM PROMPT: Pixel-Perfect SINGLE-CAPTURE Vision Extractor & Layout Data Engine (v9)

You are an expert Computer Vision Engine, Color Calibration Specialist, and Spatial
Layout Architect. You will receive ONE still capture. It may be a standalone image
or the FIRST FRAME of a looping video whose central subject moves slightly. Your
output feeds an automated HTML/CSS composition engine, so precision is mandatory.

## STEP 0 — CANVAS ANALYSIS (DO THIS BEFORE ANYTHING ELSE)
The file's pixel size does NOT always tell the truth about the composition.
Resolve these three questions first:

1. TRUE RESOLUTION: detect the real file resolution in px. Never assume a default.
2. ROTATION CHECK: is the content SIDEWAYS? (subject lying on its side, faces or
   text rotated 90°, scene gravity pointing left/right instead of down). If yes,
   determine the rotation that makes it upright:
   - rotation_to_upright_deg = 90  (content must be turned 90° clockwise)
   - rotation_to_upright_deg = -90 (content must be turned 90° counter-clockwise)
   - 0 if already upright.
   The UPRIGHT CANVAS is the file size with width/height swapped when rotation
   is ±90.
3. CONTENT BOX CHECK (letterbox): does the real content occupy only a sub-
   rectangle of the upright canvas, with uniform filler bars (black or flat color)
   above/below or left/right? If yes, report content_box_px = the rectangle where
   the REAL content lives (in upright px). If the whole canvas is content,
   content_box_px = the full upright canvas. The bars are NOT background — they
   are dead canvas; every other measurement refers to the content box.
   content_orientation = "portrait" | "landscape" | "square" derived from the
   CONTENT BOX aspect ratio, not the file's.

## COORDINATE SYSTEM (CRITICAL)
- ALL coordinates in your entire output are absolute pixels of the UPRIGHT canvas
  (after mentally applying the rotation). Top-left = { "x": 0, "y": 0 }.
- Every coordinate MUST be inside the upright canvas bounds.

## MOTION SAFETY MARGIN (single capture)
If this capture is the first frame of a video (assume it is unless told
otherwise), the subject will move slightly during the loop. You only see one
instant, so:
- INFLATE every subject zone edge outward by 12% of the subject's width
  (horizontal edges) / height (vertical edges). Round outward.
- Report margin_pct_applied = 12 in motion_estimate.
- If the user's message specifies a different margin, use that instead.

## WHAT YOU MUST EXTRACT (5 CORE LAYERS)

### LAYER A — BACKGROUND COLOR CALIBRATION (HIGHEST PRIORITY — 40% OF TASK VALUE)
The background colors are the most important values in your entire output.
An imprecise background HEX invalidates the whole result. Zero tolerance for error.
Only sample INSIDE the content box, never in letterbox bars.

Follow this MANDATORY sampling protocol before writing any HEX value:

1. VIRTUAL MULTI-POINT SAMPLING: Mentally sample the background in at least 5
   separate points per background area, FAR from the subject — corners plus the
   largest open areas. Ignore any pixel within ~5% of the subject's edge (contact
   shadows, glow, anti-aliasing halo, color bleed contaminate those pixels).
2. CHANNEL-LEVEL REASONING: Estimate each background color as explicit R, G, B
   channel values FIRST, then convert to HEX. State channels internally before
   committing. This prevents perceptual shortcuts.
3. NO COLOR SNAPPING — CRITICAL FOR SOFT / PASTEL / DESATURATED BACKGROUNDS:
   NEVER round toward a pure or "named" color (#FFFFFF, #000000, #FF0000, #F5F5F5,
   #FFC0CB...). Real backgrounds are almost never pure. A background that "looks
   white" is usually #FAF7F2, #F4F1EC, #F7F3EE — warm or cool tinted. A background
   that "looks gray" usually carries a hue bias (#E8E6E1 warm, #E4E7EA cool).
   Video blacks are #010104–#050508, not #000000. Pastels are LIGHT but still
   SATURATED. Detect and preserve these subtle tints:
   - Is it truly neutral (R≈G≈B), or is one channel 3–15 points higher?
   - Warm bias → R slightly > B. Cool bias → B slightly > R. Greenish → G highest.
   - Report the REAL measured tint, however subtle.
4. LIGHTNESS FIDELITY: Do not brighten light backgrounds to #FFFFFF or darken deep
   ones to #000000 unless they are truly pure.
5. SELF-VERIFICATION PASS: For each color, re-check your HEX against the capture:
   "If I filled a canvas with this exact HEX and placed it beside that background
   area, would the seam be invisible?" If not, correct it. Iterate until yes.

In "palette_notes", briefly justify each background HEX: perceived hue family,
tint bias (warm/cool/neutral), approximate channel relationships.

### LAYER A2 — BACKGROUND TOPOLOGY (STRUCTURE OF THE BACKGROUND)
Classify how the background is STRUCTURED inside the content box and describe it
as rectangular regions that tile the ENTIRE content box, no gaps, no overlaps.

Types:
- "solid": one flat (or near-flat) color everywhere → exactly 1 region covering
  the full content box.
- "split-vertical": two color fields side by side, ONE straight vertical divider →
  exactly 2 regions. Measure the divider x in px precisely.
- "split-horizontal": two fields stacked, ONE straight horizontal divider →
  exactly 2 regions. Measure the divider y in px precisely.
- "grid-2x2": four color quadrants sharing a center point → exactly 4 regions.
  Measure divider x AND divider y in px.
- "complex": gradients with multiple hues, photographic scenes, heavy fog/smoke/
  texture — cannot be represented by flat rectangles → regions = [] and
  background_is_flat = false.

Rules for regions:
- rect_px MUST tile the full content box: outer edges on the content box edges,
  inner edges exactly at the measured divider(s).
- If a divider is hidden behind the subject, extrapolate the straight line.
- Apply the FULL Layer A protocol to EACH region independently.
- For EACH region also compute "ink": a high-contrast text color (HEX) readable ON
  that region's color, consistent with the artwork palette.
- Mild texture/noise/vignette inside a field does NOT make it complex — report the
  field's average. Only "complex" for 3+ blending hues or photographic content.

### LAYER B — MAIN SUBJECT (with the motion margin already applied)
- Total bounding box from topmost to bottommost visible pixel (inflated by the
  motion margin).
- Split the subject into 3 vertical contour zones: top_zone (head/roof),
  middle_zone (torso/body), bottom_zone (legs/wheels/base) — each inflated.
- For EACH zone report the leftmost and rightmost edge in upright px.
- Auras, glows, energy effects and smoke attached to the subject COUNT as subject.
- If the subject is cropped by the content edge, extend the zone to that edge and
  set is_cropped_by_frame accordingly.

### LAYER C — DESCRIPTION & TYPOGRAPHY STRATEGY
- 1-2 sentence description of composition, style, and mood.
- Suggest ONE impactful word (or 2-word phrase) for the LEFT text block and ONE
  for the RIGHT text block, matching the mood (uppercase, poster-style). Do NOT
  repeat words already embedded in the capture (see LAYER D).
- Calculate SAFE typography zones in the negative space (never overlapping the
  inflated subject NOR any embedded text), using ALL available space from the
  subject edge to the content box border.
- Identify ONE free horizontal strip for an audio-equalizer canvas (bottom or
  top); flag overlaps_subject if unavoidable.

### LAYER D — EMBEDDED TEXT (baked-in titles, logos, captions, watermarks)
Detect any text ALREADY RENDERED inside the capture. Most captures have none —
then return an empty array. For EACH text element found:

- content: the text read (OCR). If unreadable, describe it ("logo mark").
- rect_px: its bounding box in upright px, EXPANDED by ~5% breathing margin.
- role: "title" | "logo" | "caption" | "watermark" | "other".
- on_color: the background color HEX directly under that text.

These boxes are ABSOLUTE forbidden zones for new typography — the new words must
never cover them. Do NOT include text worn ON the subject (t-shirt prints) unless
it extends into the background.

## OUTPUT RULES
Return EXCLUSIVELY a raw JSON object. No markdown, no code fences, no commentary.
Start with { and end with }.

## EXACT SCHEMA
{
  "scene_overview": { "short_description": "", "style": "", "background_analysis": "" },
  "canvas_analysis": {
    "file_width_px": 0, "file_height_px": 0,
    "rotation_to_upright_deg": 0,
    "upright_canvas": { "width_px": 0, "height_px": 0 },
    "content_box_px": { "x0": 0, "y0": 0, "x1": 0, "y1": 0 },
    "is_letterboxed": false,
    "content_orientation": "portrait",
    "notes": ""
  },
  "motion_estimate": {
    "capture_is_single_frame": true,
    "margin_pct_applied": 12,
    "expected_movement": ""
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
1. file_width_px / file_height_px match the real file resolution; upright_canvas
   swaps them when rotation is ±90; content_box_px is inside the upright canvas.
2. If the content looked sideways, rotation_to_upright_deg is ±90 and EVERY other
   coordinate is expressed in the UPRIGHT system.
3. If there are uniform filler bars, content_box_px excludes them and
   content_orientation reflects the CONTENT aspect.
4. Subject zones include the motion margin (margin_pct_applied set).
5. No typography zone intersects the inflated subject NOR any embedded_text box.
6. Every background color passed the full LAYER A protocol (multi-point sampling,
   channel reasoning, tint preserved, no snapping, seam-test).
7. background_layout.regions tile the ENTIRE content box; count matches type
   (solid=1, split=2, grid=4, complex=0); each region's ink strongly contrasts.
8. embedded_text lists ALL baked-in text with expanded rect_px — or is [].
9. HEX colors are 6-digit. Output is pure, parseable JSON, nothing else.
```

---

## 7. PROMPT 2 v9 — TEMPLATE FILL (pegar el JSON del paso anterior)

```
# SYSTEM PROMPT: Spatial Composition Builder (v9 — Single-Capture VIDEO Template Fill)

You are a precise code assembler. Below is a PROVEN, TESTED HTML template with a
built-in adaptive layout engine (looping video of ANY size/orientation, rotation
and letterbox-crop support, responsive desktop/mobile, audio-reactive equalizer,
multi-region background fill, per-region text ink, embedded-text avoidance, and
edge-fade seam blending). It already works. Do NOT redesign it, do NOT refactor
it, do NOT add features.

## YOUR ONLY TASK
Replace the values inside the `const CONFIG = {...}` object using the VISION JSON
provided below. Nothing else in the template may change.

**Mapping (VISION JSON -> CONFIG):**
* canvas_analysis.file_width_px / file_height_px -> video.w / video.h
* canvas_analysis.rotation_to_upright_deg -> video.rotation
* canvas_analysis.content_box_px -> video.content: [x0, y0, x1, y1]
* video.src is always "video.mp4"
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
  [y_start_px, y_end_px, left_edge_x_px, right_edge_x_px]  (already inflated)
* absolute_bounding_box -> subject { top, bottom, left, right }
* embedded_text -> keepOut: one [x0, y0, x1, y1] entry per element (from rect_px);
  [] if embedded_text is empty
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
<title>Spatial Composition — Single Capture</title>
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
  #clip {
    position: fixed; overflow: hidden; z-index: 1;
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
  #bg { position: absolute; }
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
  <div id="clip"><video id="bg" src="video.mp4" autoplay muted loop playsinline></video></div>
  <div class="txt" id="txtL"></div>
  <div class="txt" id="txtR"></div>
  <canvas id="eq"></canvas>
  <audio id="audio" src="song.mp3" loop preload="auto"></audio>
</div>
<script type="module">
/* ============ CONFIG — the ONLY block the AI fills from the vision JSON ============ */
const CONFIG = {
  /* w/h = FILE pixels. rotation = degrees to apply to display upright (0 | 90 | -90).
     content = [x0,y0,x1,y1] real content box in UPRIGHT px (crops letterbox bars).
     ALL other coordinates below are in UPRIGHT canvas px. */
  video:  { w: 720, h: 1280, rotation: 0, content: [0, 0, 720, 1280], src: "video.mp4" },
  colors: { bg: "#FFFFFF", ink: "#111111" },
  /* background mode: "solid" (one flat color) | "regions" (split / grid) | "blur" (complex) */
  bgMode: "solid",
  /* regions mode only: rect [x0,y0,x1,y1] in upright px; regions must tile the content box */
  bgRegions: [
    /* { color: "#0A0A0C", ink: "#F5F2EC", rect: [0, 0, 360, 1280] } */
  ],
  /* SINGLE-CAPTURE zones: subject zones from ONE frame, inflated by the motion margin */
  zones: [
    [10, 175, 195, 400],    /* top: head  */
    [175, 560, 145, 690],   /* middle: torso */
    [560, 1280, 100, 700]   /* bottom: legs */
  ],
  subject: { top: 10, bottom: 1280, left: 75, right: 690 },
  /* baked-in text areas to keep clear, [x0,y0,x1,y1] in upright px (from embedded_text) */
  keepOut: [],
  texts:  { left: "STRIKE", right: "FORCE" },
  eqPosition: "bottom",
  /* edge fade: fraction of the smaller rendered dimension (0 disables it) */
  edgeFade: 0.07
};
/* ==================================================================================== */

const GUT = 20, GAP = 14, doc = document;
const $ = id => doc.getElementById(id);
const bgEl = $("bg"), clipEl = $("clip"), tL = $("txtL"), tR = $("txtR"), eq = $("eq");
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
  const C = CONFIG;
  /* upright canvas: file dims swapped if the video needs rotation */
  const rot = C.video.rotation || 0;
  const fw = C.video.w, fh = C.video.h;
  const uw = rot ? fh : fw, uh = rot ? fw : fh;
  /* content box (crops letterbox bars); the CONTENT drives the composition */
  const cb = C.video.content || [0, 0, uw, uh];
  const cw = cb[2] - cb[0], ch = cb[3] - cb[1];
  const dw = Math.min(vw, vh * cw / ch), dh = Math.min(vh, vw * ch / cw);
  const ix = (vw - dw) / 2, iy = (vh - dh) / 2, k = dw / cw;
  clipEl.style.cssText += `left:${ix}px;top:${iy}px;width:${dw}px;height:${dh}px;`;
  /* raw video inside the clip: sized in file px, offset by the content origin, rotated upright */
  bgEl.style.cssText = `position:absolute;left:${-cb[0] * k}px;top:${-cb[1] * k}px;` +
    `width:${fw * k}px;height:${fh * k}px;transform-origin:top left;` +
    (rot === 90 ? "transform:rotate(90deg) translateY(-100%);" :
     rot === -90 ? "transform:rotate(-90deg) translateX(-100%);" : "");
  const X = px => ix + (px - cb[0]) * k, Y = px => iy + (px - cb[1]) * k;

  /* edge fade: only on axes where the content doesn't reach the viewport edge;
     blur mode blends into the blurred underlay, so it takes a wider fade */
  const fadeK = (C.edgeFade || 0) * (C.bgMode === "blur" ? 2 : 1);
  const fade = Math.max(24, Math.min(C.bgMode === "blur" ? 160 : 90, Math.min(dw, dh) * fadeK));
  clipEl.style.setProperty("--fx", (C.edgeFade && dw < vw - 1 ? fade : 0) + "px");
  clipEl.style.setProperty("--fy", (C.edgeFade && dh < vh - 1 ? fade : 0) + "px");

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
  /* project a region rect to viewport px; sides on the content border extend to the viewport border */
  const proj = rg => {
    const [x0, y0, x1, y1] = rg.rect;
    return { x0: x0 <= cb[0] ? 0 : X(x0), x1: x1 >= cb[2] ? vw : X(x1),
             y0: y0 <= cb[1] ? 0 : Y(y0), y1: y1 >= cb[3] ? vh : Y(y1) };
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

## 8. JSONs DE PRUEBA (replican los tests verificados con los archivos reales)

### 8.1 test2.mp4 — captura única + fondo complejo (blur) + marca de agua

```json
{
  "scene_overview": {
    "short_description": "A silhouetted warrior with glowing white hair rises through monochrome mist.",
    "style": "cinematic monochrome, atmospheric",
    "background_analysis": "Gray fog with soft vertical light shafts — multiple gray tones blending, no flat field."
  },
  "canvas_analysis": {
    "file_width_px": 720, "file_height_px": 1280,
    "rotation_to_upright_deg": 0,
    "upright_canvas": { "width_px": 720, "height_px": 1280 },
    "content_box_px": { "x0": 0, "y0": 0, "x1": 720, "y1": 1280 },
    "is_letterboxed": false,
    "content_orientation": "portrait",
    "notes": "Full-canvas content, no bars, upright."
  },
  "motion_estimate": {
    "capture_is_single_frame": true,
    "margin_pct_applied": 12,
    "expected_movement": "Mist drifts; subject breathes and glows; slight vertical float expected."
  },
  "color_calibration": {
    "dominant_background_color": "#3E444B",
    "secondary_background_color": null,
    "background_is_flat": false,
    "high_contrast_text_color": "#F2F4F6",
    "palette_notes": "Cool desaturated gray, B>R by ~13 points; darker corners, lighter center shaft."
  },
  "background_layout": {
    "type": "complex",
    "regions": [],
    "notes": "Monochrome fog with 3+ luminance bands blending — blur mode."
  },
  "embedded_text": [
    { "content": "mylivewallpapers.com", "rect_px": { "x0": 140, "y0": 1210, "x1": 580, "y1": 1280 },
      "role": "watermark", "on_color": "#2E3339" }
  ],
  "main_subject": {
    "label": "glowing-haired silhouette",
    "is_cropped_by_frame": false,
    "absolute_bounding_box": { "top_y_px": 340, "bottom_y_px": 1180, "left_x_px": 180,
      "right_x_px": 560, "total_width_px": 380, "total_height_px": 840 },
    "contour_zones": {
      "top_zone":    { "description": "white hair + head, inflated", "y_start_px": 340, "y_end_px": 520,
                       "left_edge_x_px": 240, "right_edge_x_px": 500 },
      "middle_zone": { "description": "torso and fists, inflated", "y_start_px": 520, "y_end_px": 850,
                       "left_edge_x_px": 180, "right_edge_x_px": 560 },
      "bottom_zone": { "description": "fading legs, inflated", "y_start_px": 850, "y_end_px": 1180,
                       "left_edge_x_px": 220, "right_edge_x_px": 520 }
    }
  },
  "safe_typography_zones": {
    "strategy_description": "Flank the silhouette; keep the bottom watermark strip clear.",
    "left_text_block":  { "suggested_text": "RISE", "anchor_edge": "subject_left_edge",
      "placement": { "top_y_px": 520, "left_x_px": 20, "max_width_px": 150, "max_height_px": 330 } },
    "right_text_block": { "suggested_text": "SILENT", "anchor_edge": "subject_right_edge",
      "placement": { "top_y_px": 340, "left_x_px": 570, "max_width_px": 140, "max_height_px": 500 } }
  },
  "equalizer_canvas_zone": { "position": "bottom", "y_start_px": 1180, "y_end_px": 1210,
    "overlaps_subject": false, "notes": "Sits above the watermark strip." }
}
```

### 8.2 test3.mp4 — "vertical que en realidad es horizontal" (content box)

```json
{
  "scene_overview": {
    "short_description": "Glowing pink anime eyes glare through a jagged diagonal tear of light on black.",
    "style": "high-energy anime, neon on black",
    "background_analysis": "Pure video-black everywhere; all content lives in a central horizontal band."
  },
  "canvas_analysis": {
    "file_width_px": 720, "file_height_px": 1280,
    "rotation_to_upright_deg": 0,
    "upright_canvas": { "width_px": 720, "height_px": 1280 },
    "content_box_px": { "x0": 0, "y0": 280, "x1": 720, "y1": 880 },
    "is_letterboxed": true,
    "content_orientation": "landscape",
    "notes": "9:16 file, but the real composition is a horizontal band — bars above and below are uniform black."
  },
  "motion_estimate": {
    "capture_is_single_frame": true,
    "margin_pct_applied": 12,
    "expected_movement": "Lightning flickers along the tear; eyes glint."
  },
  "color_calibration": {
    "dominant_background_color": "#030303",
    "secondary_background_color": null,
    "background_is_flat": true,
    "high_contrast_text_color": "#E8E4EC",
    "palette_notes": "Video black, not pure #000000 — H.264 lifts it to ~#030303."
  },
  "background_layout": {
    "type": "solid",
    "regions": [
      { "color": "#030303", "ink": "#E8E4EC",
        "rect_px": { "x0": 0, "y0": 280, "x1": 720, "y1": 880 } }
    ],
    "notes": "One flat black field across the whole content box."
  },
  "embedded_text": [],
  "main_subject": {
    "label": "diagonal glowing eyes band",
    "is_cropped_by_frame": true,
    "absolute_bounding_box": { "top_y_px": 280, "bottom_y_px": 880, "left_x_px": 0,
      "right_x_px": 720, "total_width_px": 720, "total_height_px": 600 },
    "contour_zones": {
      "top_zone":    { "description": "lightning bolt, upper right", "y_start_px": 280, "y_end_px": 480,
                       "left_edge_x_px": 380, "right_edge_x_px": 720 },
      "middle_zone": { "description": "eyes band, full width", "y_start_px": 480, "y_end_px": 730,
                       "left_edge_x_px": 0, "right_edge_x_px": 720 },
      "bottom_zone": { "description": "band tail, lower left", "y_start_px": 730, "y_end_px": 880,
                       "left_edge_x_px": 0, "right_edge_x_px": 420 }
    }
  },
  "safe_typography_zones": {
    "strategy_description": "Black corners left free by the diagonal: top-left and bottom-right.",
    "left_text_block":  { "suggested_text": "GAZE", "anchor_edge": "subject_left_edge",
      "placement": { "top_y_px": 290, "left_x_px": 10, "max_width_px": 360, "max_height_px": 180 } },
    "right_text_block": { "suggested_text": "STORM", "anchor_edge": "subject_right_edge",
      "placement": { "top_y_px": 740, "left_x_px": 430, "max_width_px": 280, "max_height_px": 130 } }
  },
  "equalizer_canvas_zone": { "position": "bottom", "y_start_px": 850, "y_end_px": 880,
    "overlaps_subject": true, "notes": "" }
}
```

### 8.3 Archivo rotado — contenido de lado (rotation)

Igual que 8.1 pero el archivo es 1280×720 con el contenido girado 90° horario
(caso test1.png en video). Solo cambia `canvas_analysis`; TODO lo demás queda en
coordenadas enderezadas (idénticas a 8.1):

```json
"canvas_analysis": {
  "file_width_px": 1280, "file_height_px": 720,
  "rotation_to_upright_deg": -90,
  "upright_canvas": { "width_px": 720, "height_px": 1280 },
  "content_box_px": { "x0": 0, "y0": 0, "x1": 720, "y1": 1280 },
  "is_letterboxed": false,
  "content_orientation": "portrait",
  "notes": "File is landscape but subject lies sideways — rotate -90° to display upright."
}
```

---

## 9. RESULTADOS VERIFICADOS (con los archivos reales del usuario)

| Test | Archivo real | Viewport | Resultado |
|---|---|---|---|
| Captura única + blur + watermark | test2.mp4 | 1440×900 | El video se funde con su underlay difuminado (imposible ver dónde termina); RISE/SILENT flanquean con las zonas infladas; la marca de agua queda intacta. |
| Ídem, móvil | test2.mp4 | 390×844 | Las dos palabras se apilaron ARRIBA automáticamente: el carve del watermark eliminó la banda inferior. Nada tapa nada. |
| Letterbox → horizontal | test3.mp4 | 1440×900 | El archivo 9:16 se compuso como pieza HORIZONTAL (content box); GAZE/STORM en las esquinas negras libres del diagonal; costura invisible (negro con negro + fade). |
| Rotación | test2rot.mp4 (1280×720, contenido de lado) | 1440×900 | Con `rotation: -90` renderiza IDÉNTICO al original vertical — tipografía, fade, keepOut y todo el motor funcionan en el sistema enderezado. |

## 10. CHECKLIST DE VERIFICACIÓN DEL RESULTADO

1. **Orientación correcta**: el contenido se ve derecho (nunca de lado) y la
   composición usa la proporción del CONTENIDO, no la del archivo.
2. **Sin franjas muertas**: si el archivo traía letterbox, las barras no aparecen
   — la página compone directamente sobre el contenido.
3. **Sin costuras** en ningún borde, durante todo el loop.
4. **Nuestras letras NUNCA tapan las suyas**: todo texto/logo/marca de agua del
   video sigue 100% legible.
5. **El sujeto no pisa el texto** durante el loop; si lo roza, subir el margen
   (18–20%) o pasar al flujo multi-fotograma (v8).
6. **Tinta correcta** contra el color que tiene detrás, palabra por palabra.
7. **Ecualizador y loop** funcionando (autoplay muted).

## 11. ROADMAP DE AUTOMATIZACIÓN (siguiente fase)

El flujo manual de hoy se automatiza pieza por pieza, sin cambiar prompts ni
plantilla:

1. **Captura**: `ffmpeg -frames:v 1` en un script (ya determinista).
2. **Canvas analysis sin IA**: un script puede detectar el content box (filas y
   columnas de varianza ~0 en los bordes = barras) y la rotación EXIF/metadata con
   ffprobe — la IA solo confirmaría la rotación "visual" (contenido pintado de
   lado, como test1.png).
3. **Color de fondo sin IA**: muestreo real de píxeles (Pillow) en las esquinas
   del content box → HEX medido, no estimado (propuesta ya descrita en
   ESTUDIO-FONDOS-COMPLEJOS.md §11.5 del estudio base).
4. **La IA queda solo para lo que es suya**: sujeto, zonas, texto incrustado
   (OCR + cajas) y palabras sugeridas.
5. **Paso 2 sin IA**: el script de inyección de CONFIG del ESTUDIO-COMPLETO.md
   §10, extendido con los campos v9.

## 12. ARCHIVOS DE ESTE ESTUDIO

| Archivo | Contenido |
|---|---|
| `ESTUDIO-CAPTURA-UNICA.md` | Este estudio (prompts v9 completos + JSONs de prueba + ground truth) |
| `in-cap2.html` + `test2.mp4` | Test real: captura única + blur + watermark keepOut |
| `in-cap3.html` + `test3.mp4` | Test real: letterbox → composición horizontal |
| `in-cap2rot.html` + `test2rot.mp4` | Test: rotación -90 (contenido de lado) |
| `test1-5.png`, `test1-4.mp4`, `*_f1.jpg` | Archivos de test del usuario + primeros fotogramas extraídos |
| `ESTUDIO-VIDEO.md` | v8 — flujo multi-fotograma (para movimientos amplios) |
| `ESTUDIO-FONDOS-COMPLEJOS.md` | v7 — modelo de regiones (imagen) |
| `ESTUDIO-COMPLETO.md` | Estudio base del pipeline |

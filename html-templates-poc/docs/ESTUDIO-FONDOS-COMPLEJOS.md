# ESTUDIO COMPLETO — FONDOS COMPLEJOS (v7)
### Split 2 colores · Cuadrícula 2×2 · Fondo multicolor
**Fecha:** Julio 2026 · **Estado:** Probado en Chromium headless — 6 escenarios verificados (split/grid/blur × desktop/móvil)

---

## 1. LOS 3 CASOS Y EL LÍMITE DE LA v6

La v6 asume **un solo color plano** que rellena toda la página (`--bg`). Eso cubre el
caso Mihawk-simple pero se rompe en cuanto el fondo tiene estructura:

| Caso | Descripción | Qué pasa con la v6 |
|---|---|---|
| **1 — Split** (prioridad) | Imagen dividida en 2 mitades, cada una de un color (vertical u horizontal). Sujeto en el medio. | El relleno plano solo coincide con UNA mitad; la otra muestra un corte brutal donde termina la imagen. |
| **2 — Grid 2×2** | Fondo en 4 cuadrantes, cada uno de un color. Sujeto en el medio. | Igual: 3 de los 4 cuadrantes chocan contra el color plano de página. |
| **3 — Multicolor / complejo** (aparte, §6) | Degradados de varios colores, fondos fotográficos, texturas. | Ningún color plano funciona, ni con fade. |

Además hay un segundo problema que el color no resuelve: **la tinta del texto**. En un
split blanco/negro (como el póster de Mihawk), el texto de la izquierda necesita tinta
clara y el de la derecha tinta oscura. Un solo `ink` global ya no alcanza.

---

## 2. LA SOLUCIÓN: MODELO UNIFICADO DE REGIONES

Un solo mecanismo cubre los casos 1 y 2 (y de regalo el caso sólido): el fondo de la
imagen se describe como **N regiones rectangulares que tejan el lienzo completo**, en
píxeles de imagen. La plantilla las proyecta al viewport y pinta cada una como un div
de color detrás de la imagen.

```
bgRegions: [
  { color: "#12121A", ink: "#F5F2EA", rect: [0, 0, 360, 1280]   },   ← mitad izquierda
  { color: "#EFEAE1", ink: "#14141A", rect: [360, 0, 720, 1280] }    ← mitad derecha
]
```

- `rect: [x0, y0, x1, y1]` en píxeles de la imagen.
- `color`: el color plano de esa región (protocolo de precisión de la v6, aplicado
  **a cada región por separado**).
- `ink`: la tinta de alto contraste para texto **sobre esa región**.

### 2.1 Proyección y regla de extensión

En cada `layout()` la plantilla proyecta cada rect al viewport con la misma
transformación de la imagen (`X(px) = ix + px·k`). La clave es la **regla de
extensión**: todo lado del rect que coincide con un borde de la imagen se extiende
hasta el borde del viewport.

```
x0 = 0        →  0            (borde izquierdo de página)
x1 = imgW     →  vw           (borde derecho de página)
y0 = 0        →  0            (borde superior)
y1 = imgH     →  vh           (borde inferior)
cualquier otro valor  →  X(px) / Y(px)   (queda anclado al divisor de la imagen)
```

Resultado: el divisor del split de la imagen **continúa exactamente alineado** en el
relleno de página, arriba y abajo de la imagen, en cualquier viewport. El edge fade
de la v6 sigue actuando encima y funde la textura de cada mitad con su región.

### 2.2 Tinta por región (texto)

Después de colocar cada bloque de texto, la plantilla busca qué región cae bajo el
**centro** del bloque y le asigna la `ink` de esa región. DUEL sale crema sobre la
mitad oscura, BLADE sale oscuro sobre la mitad crema — automático.

### 2.3 Recorte de candidatos por región (contraste garantizado)

Problema detectado en pruebas: en el grid 2×2, una palabra podía quedar *a caballo*
entre dos regiones (mitad sobre crema, mitad sobre verde) — la tinta elegida solo
contrastaba con una de las dos. Regla añadida: cuando hay regiones, cada rectángulo
candidato de texto se **recorta por los límites de las regiones proyectadas**, y el
motor elige entre esos recortes. El texto siempre aterriza dentro de UNA región.
Se prioriza contraste sobre tamaño de fuente.

### 2.4 Ecualizador multicolor

Las barras del ecualizador cruzan todo el ancho, es decir, cruzan regiones. Cada
barra consulta qué región tiene debajo y se pinta con la `ink` de esa región: barras
claras sobre la mitad oscura, barras oscuras sobre la mitad clara, en el mismo canvas.

### 2.5 Fix del motor: re-layout por requestAnimationFrame

Durante las pruebas apareció un bug real de la v5/v6: el `resize` usaba un debounce
de 100 ms (`setTimeout`), y una captura (o un primer frame de grabación) tomada antes
de ese timeout salía con la geometría vieja — los rellenos quedaban cortos y
desalineados. La v7 reemplaza el debounce por coalescencia con
`requestAnimationFrame`: el layout corre como máximo una vez por frame y siempre
antes del siguiente pintado. Esto también hace el redimensionado en vivo más fluido.

---

## 3. RESULTADOS VERIFICADOS (CASOS 1 Y 2)

Probado con imágenes sintéticas de control (720×1280, sujeto centrado sobre el divisor):

| Escenario | Viewport | Resultado |
|---|---|---|
| Split vertical 2 colores | 1440×900 | Divisor continúa sin costura de arriba a abajo; DUEL tinta clara sobre oscuro, BLADE tinta oscura sobre claro; barras del eq cambian de color al cruzar el divisor. |
| Split vertical 2 colores | 390×844 | Modo flanqueo con pila vertical; tintas correctas por lado; piernas del sujeto se funden abajo con el fade. |
| Grid 2×2 (4 colores) | 1440×900 | Los 4 cuadrantes continúan alineados; CUATRO dentro del cuadrante rojo, CAMPOS dentro del crema (recorte por región evita el bajo contraste). |
| Grid 2×2 (4 colores) | 390×844 | Modo banda confinado al cuadrante superior-izquierdo con su tinta. |
| Multicolor (caso 3, §6) | 1440×900 y 390×844 | Fondo continúa vía underlay borroso; sin costuras; texto blanco legible. |

Archivos de prueba: `in-split.html` + `bgsplit.png`, `in-grid.html` + `bggrid.png`,
`in-blur.html` + `bgcomplex.png`.

---

## 4. PROMPT 1 — VISION EXTRACTOR v7 (enviar junto con la imagen)

Novedad respecto a v6: **LAYER A2 — BACKGROUND TOPOLOGY**. La IA clasifica la
estructura del fondo (solid / split / grid / complex) y devuelve las regiones con su
color, su tinta y su rectángulo exacto. El protocolo de precisión de color se aplica
a cada región.

```
# SYSTEM PROMPT: Pixel-Perfect Vision Extractor & Layout Data Engine (v7)

You are an expert Computer Vision Engine, Color Calibration Specialist, and Spatial
Layout Architect. Your output feeds an automated HTML/CSS composition engine, so
precision is mandatory.

## COORDINATE SYSTEM (CRITICAL)
- Detect the TRUE native resolution of the image in pixels. Never assume a default
  canvas size.
- All coordinates are absolute pixels (px). Top-left corner = { "x": 0, "y": 0 }.
- Every coordinate MUST be inside the image bounds.

## WHAT YOU MUST EXTRACT (4 CORE LAYERS)

### LAYER A — BACKGROUND COLOR CALIBRATION (HIGHEST PRIORITY — 40% OF TASK VALUE)
The background colors are the most important values in your entire output.
An imprecise background HEX invalidates the whole result. Zero tolerance for error.

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
   Pastels are LIGHT but still SATURATED: a pastel pink is #F6DDE0-like, not white
   and not #FFC0CB. Detect and preserve these subtle tints:
   - Is it truly neutral (R≈G≈B), or is one channel 3–15 points higher?
   - Warm bias → R slightly > B. Cool bias → B slightly > R. Greenish → G highest.
   - Report the REAL measured tint, however subtle.
4. LIGHTNESS FIDELITY: Do not brighten light backgrounds to #FFFFFF or darken deep
   ones to #000000 unless they are truly pure. #0D0D0F is not #000000. #FBFAF8 is
   not #FFFFFF.
5. SELF-VERIFICATION PASS: For each color, re-check your HEX against the image:
   "If I filled a canvas with this exact HEX and placed it beside that background
   area, would the seam be invisible?" If not, correct it. Iterate until yes.

In "palette_notes", briefly justify each background HEX: perceived hue family, tint
bias (warm/cool/neutral), approximate channel relationships.

### LAYER A2 — BACKGROUND TOPOLOGY (STRUCTURE OF THE BACKGROUND)
Classify how the background is STRUCTURED and describe it as rectangular regions
that tile the ENTIRE image with no gaps and no overlaps.

Types:
- "solid": one flat (or near-flat) color everywhere → exactly 1 region covering the
  full canvas.
- "split-vertical": two color fields side by side, separated by ONE straight
  vertical divider → exactly 2 regions. Measure the divider x in px precisely.
- "split-horizontal": two color fields stacked, ONE straight horizontal divider →
  exactly 2 regions. Measure the divider y in px precisely.
- "grid-2x2": four color quadrants sharing a center point → exactly 4 regions.
  Measure divider x AND divider y in px.
- "complex": gradients with multiple hues, photographic scenes, heavy texture — the
  background cannot be represented by flat rectangles → regions = [] and set
  background_is_flat = false.

Rules for regions:
- rect_px MUST tile the full image: outer edges at 0 and width/height, inner edges
  exactly at the measured divider(s). No gaps, no overlaps.
- If the divider is hidden behind the subject, extrapolate the straight line from
  the visible parts above/below (or left/right) of the subject.
- Apply the FULL Layer A sampling protocol to EACH region independently.
- For EACH region also compute "ink": a high-contrast text color (HEX) readable ON
  that region's color, consistent with the artwork palette.
- Mild texture/noise inside a field (smoke, paper grain, subtle vignette) does NOT
  make it complex — report the field's average color. Only use "complex" when there
  are 3+ distinct hues blending or photographic content.

### LAYER B — MAIN SUBJECT (person, car, product, any central object)
- Total bounding box from topmost to bottommost visible pixel.
- Split the subject into 3 vertical contour zones: top_zone (head/roof),
  middle_zone (torso/body), bottom_zone (legs/wheels/base).
- For EACH zone report the leftmost and rightmost edge in px.
- If the subject is cropped by the image edge, extend the zone to the border and
  set is_cropped_by_frame accordingly.

### LAYER C — DESCRIPTION & TYPOGRAPHY STRATEGY
- 1-2 sentence description of composition, style, and mood.
- Suggest ONE impactful word (or 2-word phrase) for the LEFT text block and ONE for
  the RIGHT text block, matching the mood (uppercase, poster-style).
- Calculate SAFE typography zones in the negative space (never overlapping the
  subject), using ALL available space from the subject edge to the image border.
- Identify ONE free horizontal strip for an audio-equalizer canvas (bottom or top);
  flag overlaps_subject if unavoidable.

## OUTPUT RULES
Return EXCLUSIVELY a raw JSON object. No markdown, no code fences, no commentary.
Start with { and end with }.

## EXACT SCHEMA
{
  "scene_overview": { "short_description": "", "style": "", "background_analysis": "" },
  "image_dimensions": { "width_px": 0, "height_px": 0, "aspect_ratio": "" },
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
1. width_px / height_px match the real image resolution.
2. No typography zone intersects any contour zone.
3. HEX colors are 6-digit with strong contrast.
4. Every background color passed the full LAYER A protocol: multi-point sampling
   away from the subject, channel-level reasoning, tint preserved (NOT snapped to a
   pure/named color), lightness faithful, seam-test passed.
5. background_layout.regions tile the ENTIRE image: no gaps, no overlaps, outer
   edges at 0/width/height, region count matches type (solid=1, split=2, grid=4,
   complex=0).
6. Each region's "ink" strongly contrasts with that region's "color".
7. dominant_background_color equals the color of the LARGEST region (or the
   overall average if type is "complex").
8. palette_notes justifies each background HEX with hue family and channel bias.
9. Output is pure, parseable JSON, nothing else.
```

---

## 5. PROMPT 2 — TEMPLATE FILL v7 (pegar el JSON del paso anterior)

La plantilla trae los 3 modos de fondo (`solid` / `regions` / `blur`), tinta por
región, recorte de texto por región, ecualizador multicolor, edge fade adaptativo y
el re-layout por rAF. La IA solo rellena CONFIG.

```
# SYSTEM PROMPT: Spatial Composition Builder (v7 — Template Fill + Multi-Region Background)

You are a precise code assembler. Below is a PROVEN, TESTED HTML template with a
built-in adaptive layout engine (responsive for desktop and mobile, audio-reactive
equalizer, multi-region background fill, per-region text ink, and edge-fade seam
blending included). It already works. Do NOT redesign it, do NOT refactor it, do
NOT add features.

## YOUR ONLY TASK
Replace the values inside the `const CONFIG = {...}` object using the VISION JSON
provided below. Nothing else in the template may change.

**Mapping (VISION JSON -> CONFIG):**
* image_dimensions.width_px / height_px -> img.w / img.h (src is always "bg.jpg")
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
  [y_start_px, y_end_px, left_edge_x_px, right_edge_x_px]
* absolute_bounding_box -> subject { top, bottom, left, right }
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
<title>Spatial Composition</title>
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
  <img id="bgblur" src="" alt="" aria-hidden="true">
  <div id="bgfill"></div>
  <img id="bg" src="bg.jpg" alt="">
  <div class="txt" id="txtL"></div>
  <div class="txt" id="txtR"></div>
  <canvas id="eq"></canvas>
  <audio id="audio" src="song.mp3" loop preload="auto"></audio>
</div>
<script type="module">
/* ============ CONFIG — the ONLY block the AI fills from the vision JSON ============ */
const CONFIG = {
  img:    { w: 735, h: 1105, src: "bg.jpg" },
  colors: { bg: "#FFFFFF", ink: "#111111" },
  /* background mode: "solid" (one flat color) | "regions" (split / grid) | "blur" (complex) */
  bgMode: "solid",
  /* regions mode only: rect [x0,y0,x1,y1] in image px; regions must tile the full image */
  bgRegions: [
    /* { color: "#0A0A0C", ink: "#F5F2EC", rect: [0, 0, 368, 1105] } */
  ],
  /* subject zones: [yStart, yEnd, leftEdge, rightEdge] in image pixels */
  zones: [
    [10, 175, 195, 400],    /* top: head  */
    [175, 560, 145, 690],   /* middle: torso */
    [560, 1105, 100, 700]   /* bottom: legs */
  ],
  subject: { top: 10, bottom: 1105, left: 75, right: 690 },
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
bgEl.src = CONFIG.img.src;

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
  const C = CONFIG, iw = C.img.w, ih = C.img.h;
  const dw = Math.min(vw, vh * iw / ih), dh = Math.min(vh, vw * ih / iw);
  const ix = (vw - dw) / 2, iy = (vh - dh) / 2, k = dw / iw;
  bgEl.style.cssText += `left:${ix}px;top:${iy}px;width:${dw}px;height:${dh}px;`;
  const X = px => ix + px * k, Y = px => iy + px * k;

  /* edge fade: only on axes where the image doesn't reach the viewport edge;
     blur mode blends into the blurred underlay, so it takes a wider fade */
  const fadeK = (C.edgeFade || 0) * (C.bgMode === "blur" ? 2 : 1);
  const fade = Math.max(24, Math.min(C.bgMode === "blur" ? 160 : 90, Math.min(dw, dh) * fadeK));
  bgEl.style.setProperty("--fx", (C.edgeFade && dw < vw - 1 ? fade : 0) + "px");
  bgEl.style.setProperty("--fy", (C.edgeFade && dh < vh - 1 ? fade : 0) + "px");

  const eqH = Math.min(90, Math.max(44, vh * 0.06));
  eq.style.height = eqH + "px";
  const minFS = Math.max(26, vh * 0.05);

  /* ---- page fill behind the image: solid, regions, or blurred underlay ---- */
  const blurEl = $("bgblur"), fillEl = $("bgfill");
  const regions = C.bgMode === "regions" ? (C.bgRegions || []) : [];
  blurEl.style.display = C.bgMode === "blur" ? "block" : "none";
  if (C.bgMode === "blur" && !blurEl.getAttribute("src")) blurEl.src = C.img.src;
  /* project a region rect to viewport px; sides on the image border extend to the viewport border */
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

  /* side rects: one candidate per contour zone, per side */
  const rectsL = [], rectsR = [];
  for (const [y0, y1, xl, xr] of C.zones) {
    const ry = Math.max(GUT, Y(y0)), ry1 = Math.min(vh - GUT, Y(y1));
    rectsL.push({ x: GUT, y: ry, w: X(xl) - GAP - GUT, h: ry1 - ry });
    rectsR.push({ x: X(xr) + GAP, y: ry, w: vw - GUT - X(xr) - GAP, h: ry1 - ry });
  }
  /* try flanking first; if EITHER side can't reach a readable size → band mode */
  const fL = bestFit(C.texts.left, cut(rectsL), minFS), fR = bestFit(C.texts.right, cut(rectsR), minFS);
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
    } else {                       /* image fills viewport → overlay top strip */
      txtT = C.texts.left + " " + C.texts.right; txtB = "";
      bT = { x: GUT, y: GUT, w: bandW, h: vh * 0.16 };
      tL.style.textShadow = "0 0 10px var(--bg), 0 0 22px var(--bg), 0 0 34px var(--bg)";
    }
    tint(tL, place(tL, txtT && bT ? bestFit(txtT, cut([bT]), 18) : null, "band"));
    tint(tR, place(tR, txtB && bB ? bestFit(txtB, cut([bB]), 18) : null, "band"));
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
if (bgEl.complete) layout(); else bgEl.onload = layout;
layout();

/* ---- audio + equalizer (never blocks rendering if song.mp3 is missing) ---- */
const audio = $("audio");
let analyser = null, freq = null;
async function initAudio() {
  try {
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

## 6. CASO 3 (APARTE) — FONDO MULTICOLOR / COMPLEJO

### 6.1 Por qué es otra categoría

En los casos 1 y 2 el fondo son **campos planos con fronteras rectas** — se puede
reconstruir con rectángulos de color exactos. En el caso 3 (degradados de varios
tonos, escenas fotográficas, texturas fuertes) **no existe ningún conjunto de
rectángulos planos que coincida**: cualquier relleno sólido produce costura en
alguna parte. La estrategia cambia de "reconstruir el fondo" a "hacer que el fondo
se genere a sí mismo".

### 6.2 La solución: underlay borroso (efecto ambilight)

La plantilla v7 incluye el modo `bgMode: "blur"`:

- Se duplica la MISMA imagen detrás de todo (`z-index: 0`) con `object-fit: cover`
  (llena el viewport completo), `filter: blur(50px) saturate(1.15)` y
  `transform: scale(1.15)` (el scale oculta los bordes transparentes que genera el
  blur).
- La imagen principal se muestra encima con un edge fade **más ancho** (×2, hasta
  160px), fundiéndose con su propia versión difuminada.
- La costura es **imposible por construcción**: a ambos lados del borde hay los
  mismos colores, uno nítido y otro difuso.

En este modo no se necesita NINGÚN color extraído para el relleno — la precisión del
HEX deja de ser un problema. `colors.bg` y `colors.ink` solo se usan para la tinta
del texto y el ecualizador (la IA de visión elige una tinta que contraste con el
promedio del fondo difuminado).

### 6.3 Resultado verificado y carácter del efecto

Probado con un degradado diagonal teal → púrpura → naranja (1440×900 y 390×844):
el fondo continúa hacia los lados sin ninguna línea; el texto blanco es legible.
Nota honesta: el sujeto oscuro también aparece difuminado en el underlay, creando
sombras suaves verticales cerca de sus bordes — se lee como profundidad/atmósfera
(estético), pero si se quisiera eliminar habría que rellenar el hueco del sujeto
antes de difuminar (inpainting), fuera del alcance de una plantilla estática.

### 6.4 Cuándo usar cada modo (decisión del Prompt 1)

```
¿El fondo es UN color plano (o casi)?            → solid   (relleno de 1 color + fade)
¿Son 2 o 4 campos planos con fronteras rectas?   → regions (split / grid)
¿3+ tonos mezclados, foto, textura dominante?    → blur    (underlay borroso)
```

La clasificación la hace la IA de visión en `background_layout.type`, y el Prompt 2
la traduce mecánicamente a `bgMode`. En caso de duda entre regions y blur: si las
fronteras no son rectas o los campos no son planos, blur siempre es seguro (nunca
produce costura); regions produce un resultado más "de diseño" cuando aplica.

---

## 7. CHECKLIST DE VERIFICACIÓN DEL RESULTADO

1. **Sin costuras**: ninguna línea visible donde termina la imagen, en ningún lado.
2. **Divisores alineados** (regions): la frontera entre colores del relleno de
   página continúa EXACTAMENTE la frontera dentro de la imagen — sin escalón ni
   desplazamiento, también tras redimensionar la ventana.
3. **Tinta correcta por región**: cada palabra contrasta con el color que tiene
   detrás; ninguna palabra queda a caballo entre dos regiones.
4. **Ecualizador**: las barras cambian de color al cruzar un divisor.
5. **Modo blur**: el fondo difuminado llena todo el viewport, sin bordes duros.
6. **Responsive**: en móvil el texto pasa a bandas/pilas y sigue las reglas 2–4.

## 8. AJUSTES RÁPIDOS

| Quiero… | Cambiar |
|---|---|
| Fade más ancho (fondos con viñeta o blur) | `edgeFade: 0.10` – `0.12` |
| Fade más sutil | `edgeFade: 0.04` |
| Sin fade | `edgeFade: 0` |
| Blur más difuso / más atmosférico | en CSS `#bgblur`: `blur(70px)` |
| Forzar blur aunque el fondo sea split | `bgMode: "blur"` (siempre es seguro) |

## 9. ARCHIVOS DE ESTE ESTUDIO

| Archivo | Contenido |
|---|---|
| `ESTUDIO-FONDOS-COMPLEJOS.md` | Este estudio (prompts v7 completos) |
| `in-split.html` + `bgsplit.png` | Caso 1 probado — split vertical 2 colores |
| `in-grid.html` + `bggrid.png` | Caso 2 probado — cuadrícula 2×2, 4 colores |
| `in-blur.html` + `bgcomplex.png` | Caso 3 probado — degradado multicolor, modo blur |
| `ALTERNATIVA-PROMPTS-V6.md` | Versión anterior (v6: solo fondo sólido + fade) |
| `ESTUDIO-COMPLETO.md` | Estudio base del pipeline (v5/v6) |

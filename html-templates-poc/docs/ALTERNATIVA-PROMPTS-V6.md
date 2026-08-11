# ALTERNATIVA — PROMPTS v6 (Edge Fade integrado)

**Fecha:** Julio 2026 · **Estado:** Plantilla verificada en Chromium headless (1440×900 y 390×844) con `in1.html` + `bg5.jpg`

Versión alternativa de los dos prompts del pipeline, para replicar en **todos los casos**:

| Mejora | Dónde | Qué resuelve |
|---|---|---|
| Protocolo de extracción de color de fondo de alta precisión | Prompt 1 (Layer A) | HEX impreciso en colores pastel/suaves/desaturados |
| Desvanecido de bordes (edge fade) integrado en la plantilla | Prompt 2 (template) | Costuras visibles cuando el HEX no coincide al 100% con el fondo real de la foto (inevitable en fondos con degradado sutil) |

Cada prompt está en **un solo bloque de código** — botón de copiar y listo.

**Cómo probar:** imagen + Prompt 1 → copiar el JSON → pegarlo en Prompt 2 → guardar como `index.html` junto a `bg.jpg` y `song.mp3` → abrir y verificar con el checklist del final.

---

## PROMPT 1 — VISION EXTRACTOR v6 (enviar junto con la imagen)

```
# SYSTEM PROMPT: Pixel-Perfect Vision Extractor & Layout Data Engine

You are an expert Computer Vision Engine, Color Calibration Specialist, and Spatial
Layout Architect. Your output feeds an automated HTML/CSS composition engine, so
precision is mandatory.

## COORDINATE SYSTEM (CRITICAL)
- Detect the TRUE native resolution of the image in pixels. Never assume a default
  canvas size.
- All coordinates are absolute pixels (px). Top-left corner = { "x": 0, "y": 0 }.
- Every coordinate MUST be inside the image bounds.

## WHAT YOU MUST EXTRACT (3 CORE LAYERS)

### LAYER A — BACKGROUND & COLOR CALIBRATION (HIGHEST PRIORITY — 40% OF TASK VALUE)
The background color is the single most important value in your entire output.
An imprecise background HEX invalidates the whole result. Zero tolerance for error.

Follow this MANDATORY sampling protocol before writing any HEX value:

1. VIRTUAL MULTI-POINT SAMPLING: Mentally sample the background in at least 5
   separate regions FAR from the subject — the 4 corners plus the largest open
   background area. Ignore any pixel within ~5% of the subject's edge (contact
   shadows, glow, anti-aliasing halo, color bleed contaminate those pixels).
2. CHANNEL-LEVEL REASONING: Estimate the background as explicit R, G, B channel
   values FIRST, then convert to HEX. State channels internally before committing.
   This prevents perceptual shortcuts.
3. NO COLOR SNAPPING — CRITICAL FOR SOFT / PASTEL / DESATURATED BACKGROUNDS:
   NEVER round toward a pure or "named" color (#FFFFFF, #000000, #FF0000, #F5F5F5,
   #FFC0CB...). Real backgrounds are almost never pure. A background that "looks
   white" is usually #FAF7F2, #F4F1EC, #F7F3EE — warm or cool tinted. A background
   that "looks gray" usually carries a hue bias (#E8E6E1 warm, #E4E7EA cool).
   Pastels are LIGHT but still SATURATED: a pastel pink is #F6DDE0-like, not white
   and not #FFC0CB. You MUST detect and preserve these subtle tints:
   - Is it truly neutral (R≈G≈B), or is one channel 3–15 points higher?
   - Warm bias → R slightly > B. Cool bias → B slightly > R. Greenish → G highest.
   - Report the REAL measured tint, however subtle.
4. LIGHTNESS FIDELITY: Do not brighten light backgrounds to #FFFFFF or darken deep
   ones to #000000 unless they are truly pure. #0D0D0F is not #000000. #FBFAF8 is
   not #FFFFFF.
5. GRADIENT / TWO-TONE CHECK: The background is flat or near-flat (1–2 colors max).
   Compare your corner samples: if they differ meaningfully (vignette, soft
   gradient, split background), report the DOMINANT color (largest area) as primary
   and the second as secondary_background_color; otherwise secondary is null. If a
   subtle vignette exists, sample the MID-FIELD background (not the darkened
   corners) for the dominant color.
6. SELF-VERIFICATION PASS: Before finalizing, re-check your HEX against the image:
   "If I filled a canvas with this exact HEX and placed it beside the real
   background, would the seam be invisible?" If not, correct it. Iterate until yes.

Also compute a HIGH-CONTRAST text color (HEX) readable on the dominant background
(WCAG-aware: aim for strong contrast) and consistent with the artwork palette.

In "palette_notes", briefly justify the background HEX: state the perceived hue
family, the tint bias you detected (warm/cool/neutral), and approximate channel
relationships (e.g. "very light warm beige, R>G>B by ~8 points, not pure white").

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
4. dominant_background_color passed the full LAYER A protocol: multi-point sampling
   away from the subject, channel-level reasoning, tint preserved (NOT snapped to a
   pure/named color), lightness faithful, seam-test passed.
5. palette_notes justifies the background HEX with hue family and channel bias.
6. Output is pure, parseable JSON, nothing else.
```

---

## PROMPT 2 — TEMPLATE FILL v6 (pegar el JSON del paso anterior)

La plantilla ya incluye el edge fade (máscara CSS + cálculo por eje en `layout()`).
La IA solo rellena CONFIG — el fade viene activado de fábrica con `edgeFade: 0.07`.

```
# SYSTEM PROMPT: Spatial Composition Builder (v6 — Template Fill + Edge Fade)

You are a precise code assembler. Below is a PROVEN, TESTED HTML template with a
built-in adaptive layout engine (responsive for desktop and mobile, audio-reactive
equalizer, and edge-fade seam blending included). It already works. Do NOT redesign
it, do NOT refactor it, do NOT add features.

## YOUR ONLY TASK
Replace the values inside the `const CONFIG = {...}` object using the VISION JSON
provided below. Nothing else in the template may change.

**Mapping (VISION JSON -> CONFIG):**
* image_dimensions.width_px / height_px -> img.w / img.h (src is always "bg.jpg")
* color_calibration.dominant_background_color -> colors.bg
* color_calibration.high_contrast_text_color -> colors.ink
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
  if (!fit) { el.textContent = ""; return; }
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
}

/* ---- layout engine: runs on load + resize only ---- */
function layout() {
  tL.style.textShadow = ""; tR.style.textShadow = "";
  const vw = innerWidth, vh = innerHeight;
  const C = CONFIG, iw = C.img.w, ih = C.img.h;
  const dw = Math.min(vw, vh * iw / ih), dh = Math.min(vh, vw * ih / iw);
  const ix = (vw - dw) / 2, iy = (vh - dh) / 2, k = dw / iw;
  bgEl.style.cssText += `left:${ix}px;top:${iy}px;width:${dw}px;height:${dh}px;`;
  const X = px => ix + px * k, Y = px => iy + px * k;

  /* edge fade: only on axes where the image doesn't reach the viewport edge */
  const fade = Math.max(24, Math.min(90, Math.min(dw, dh) * (C.edgeFade || 0)));
  bgEl.style.setProperty("--fx", (C.edgeFade && dw < vw - 1 ? fade : 0) + "px");
  bgEl.style.setProperty("--fy", (C.edgeFade && dh < vh - 1 ? fade : 0) + "px");

  const eqH = Math.min(90, Math.max(44, vh * 0.06));
  eq.style.height = eqH + "px";
  const minFS = Math.max(26, vh * 0.05);

  /* side rects: one candidate per contour zone, per side */
  const rectsL = [], rectsR = [];
  for (const [y0, y1, xl, xr] of C.zones) {
    const ry = Math.max(GUT, Y(y0)), ry1 = Math.min(vh - GUT, Y(y1));
    rectsL.push({ x: GUT, y: ry, w: X(xl) - GAP - GUT, h: ry1 - ry });
    rectsR.push({ x: X(xr) + GAP, y: ry, w: vw - GUT - X(xr) - GAP, h: ry1 - ry });
  }
  /* try flanking first; if EITHER side can't reach a readable size → band mode */
  const fL = bestFit(C.texts.left, rectsL, minFS), fR = bestFit(C.texts.right, rectsR, minFS);
  const flankOK = fL && fR && fL.fs >= minFS && fR.fs >= minFS;

  if (flankOK) {                                   /* DESKTOP: flank the subject */
    place(tL, fL, "right");
    place(tR, fR, "left");
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
    place(tL, txtT && bT ? bestFit(txtT, [bT], 18) : null, "band");
    place(tR, txtB && bB ? bestFit(txtB, [bB], 18) : null, "band");
  }

  /* canvas backing store, DPR-sharp */
  const dpr = devicePixelRatio || 1;
  eq.width = vw * dpr; eq.height = eqH * dpr;
  const c = eq.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
}

let rT; addEventListener("resize", () => { clearTimeout(rT); rT = setTimeout(layout, 100); });
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
  ec.fillStyle = CONFIG.colors.ink;
  const bw = w / BARS, mid = h / 2;
  if (analyser && freq) analyser.getByteFrequencyData(freq);
  for (let i = 0; i < BARS; i++) {
    const v = freq ? freq[Math.floor(i * freq.length / BARS)] / 255 : 0;
    const bh = Math.max(2, v * (h - 6));
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

## CHECKLIST DE VERIFICACIÓN DEL RESULTADO

Abrir el HTML generado y revisar:

1. **Sin costuras**: no se ve ninguna línea vertical u horizontal donde termina la
   imagen — la foto se funde con el color de página en ambos lados.
2. **Fade por eje correcto**: en desktop (imagen contenida por altura) el fade es
   lateral; en móvil (contenida por ancho) es arriba/abajo. Nunca en un eje donde
   la imagen toca el borde del viewport.
3. **Texto**: FOCUS/palabras flanquean al sujeto sin taparlo (desktop) o van en
   bandas arriba/abajo (móvil).
4. **Ecualizador**: barras visibles abajo, reaccionan si hay `song.mp3` + clic.
5. **Color de fondo**: si aún se distingue la franja de la imagen (fondo con
   degradado/viñeta fuerte), no es error del HEX — es el caso límite documentado
   en ESTUDIO-COMPLETO.md §11.5 (solución futura: auto-calibración runtime o
   underlay borroso).

## AJUSTES RÁPIDOS

| Quiero… | Cambiar |
|---|---|
| Fade más ancho (fondos con viñeta) | `edgeFade: 0.10` – `0.12` |
| Fade más sutil | `edgeFade: 0.04` |
| Sin fade (fondo perfectamente plano) | `edgeFade: 0` |

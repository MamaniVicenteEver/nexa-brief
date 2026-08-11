# ESTUDIO COMPLETO — Pipeline Automatizado "Seamless Cutout Illusion"
### Composición espacial: imagen + tipografía envolvente + ecualizador de audio (HTML/CSS/JS)
**Fecha:** Julio 2026 · **Estado:** Probado y funcionando en desktop, tablet y móvil

---

## 1. OBJETIVO DEL PROYECTO

Automatizar por completo la creación de composiciones visuales tipo póster: una imagen con fondo plano se funde con el fondo de la página, y un texto de gran tamaño (estilo editorial) envuelve al sujeto sin taparlo, con una barra de ecualizador reactiva al audio, todo listo para grabación headless a 60 FPS.

El flujo objetivo del usuario: **elegir una imagen → subirla → usar siempre el mismo prompt → obtener siempre un resultado correcto**, responsivo en móvil y desktop, sin ajustes manuales.

Toda imagen de entrada tiene 3 componentes extraíbles:
1. **Fondo** — color plano (1 o máximo 2 colores).
2. **Sujeto central** — persona, auto o cualquier objeto, dividido en 3 zonas verticales (cabeza/arriba, torso/medio, piernas/base) para saber dónde puede ir el texto.
3. **Descripción** — para generar las palabras del póster automáticamente.

---

## 2. ARQUITECTURA FINAL DEL PIPELINE

```
[imagen.jpg]
     │
     ▼
PASO 1 — PROMPT DE VISIÓN (IA multimodal)
     │  extrae: dimensiones, colores, zonas del sujeto,
     │  zonas seguras de texto, palabras sugeridas
     ▼
[JSON espacial]
     │
     ▼
PASO 2 — PROMPT v5 "TEMPLATE FILL" (IA de texto, o un script)
     │  rellena SOLO el objeto CONFIG dentro de una
     │  plantilla HTML ya probada — no programa nada
     ▼
[index.html] + bg.jpg + song.mp3
     │
     ▼
Grabación headless (Playwright) a 60 FPS
```

**Decisión de diseño clave:** la inteligencia del layout NO vive en el prompt sino en un **motor JavaScript embebido en la plantilla**, escrito y probado una sola vez. La IA solo transporta datos. Esto elimina la variabilidad entre generaciones.

---

## 3. EVOLUCIÓN Y ERRORES ENCONTRADOS (v1 → v5)

### v1 — Prompt original (CSS estático con anclaje inverso)
Problemas detectados:
- **El prompt de visión no extraía colores**, pero el prompt HTML pedía `DOMINANT_BACKGROUND_COLOR` y `HIGH_CONTRAST_TEXT_COLOR` → hueco manual en el pipeline.
- **`object-fit: cover` recortaba la imagen** → todo el mapa de coordenadas píxel-perfecto quedaba desincronizado. Un bug silencioso y grave. La regla correcta es `object-fit: contain` (cero recorte).
- **Filtro `contrast(1.15) saturate(1.2)` y viñeta aplicados siempre**: sobre un fondo plano (blanco puro) cambian el tono de los bordes de la imagen y **rompen la ilusión seamless**, que es todo el punto del proyecto. Deben ser condicionales a `background_is_flat`.
- El texto estaba confinado al contenedor de la imagen: en un monitor 16:9 con imagen vertical 2:3, las franjas laterales de pantalla (letterbox) quedaban desaprovechadas.

### v2 — Matemática de letterbox (texto a ancho completo)
Solución aportada: dentro del wrapper, `100%` = ancho de la imagen, y la franja lateral de pantalla en un lado es `(100vw - 100%) / 2`. Por lo tanto:

```css
max-width: calc(((left_x_px / var(--img-w)) * 100%) + ((100vw - 100%) / 2) - 24px);
```

Esto suma el espacio vacío dentro de la imagen + todo el letterbox exterior. Funcionó en concepto pero seguía siendo CSS estático.

### v3 — Pruebas reales revelan los límites del CSS puro
Los screenshots de prueba mostraron dos fallos:
- **Desktop (1440px):** el JSON de visión devolvió `max_width_px: 70` (zona demasiado conservadora) → columna angostísima → cada letra caía en su propia línea, y como `clamp(...35vh)` no sabe cuántas líneas hay, "STRIKE" (6 letras × tamaño gigante) **se salía por debajo de la pantalla** con letras cortadas.
- **Móvil (320px):** en pantallas angostas **no existe espacio lateral** — la imagen ocupa todo el ancho, el texto caía encima del sujeto y se cortaba en el borde.

**Conclusión técnica:** CSS no puede expresar "prueba horizontal → si no entra prueba vertical → si no entra reduce el tamaño". Eso requiere medir el texto y decidir: un motor de layout en JavaScript.

### v4 — Motor JS especificado en prosa (demasiadas reglas)
Se especificó el motor completo como instrucciones (modos A/B/C/D, invariantes, modo banda, checklist). Resultado: **la IA generadora "se tontea"** — con 40+ reglas simultáneas intenta cumplirlas todas a la vez y falla en las importantes. Hallazgo central de prompt engineering:

> **Más reglas ≠ mejor resultado.** La fiabilidad de un LLM cae cuando debe balancear muchas instrucciones interdependientes. Para automatización repetible, hay que minimizar lo que la IA "crea".

### v5 — Template Fill (solución final, probada)
La plantilla HTML completa —con el motor de layout ya escrito, depurado y verificado en navegador real— va **embebida dentro del prompt**. La única tarea de la IA es rellenar el objeto `CONFIG` (7 valores mapeados 1:1 desde el JSON de visión). Cero creatividad = cero variación = mismo resultado siempre.

---

## 4. EL MOTOR DE LAYOUT ADAPTATIVO (cómo funciona)

Corre solo en `load` y `resize` (con debounce de 100ms), **nunca** dentro de `requestAnimationFrame`, para no comprometer los 60 FPS.

**4.1 Conversión de coordenadas.** Calcula el rectángulo en pantalla de la imagen (`object-fit: contain` centrado) y las funciones `X(px)` / `Y(px)` que convierten píxeles de imagen → píxeles de pantalla con el factor `k = anchoEnPantalla / anchoImagen`.

**4.2 Rectángulos candidatos.** Por cada zona del contorno (cabeza, torso, piernas) genera un rectángulo lateral izquierdo y uno derecho: desde el borde de pantalla (gutter 20px) hasta el borde del sujeto en esa zona (gap 14px). El rectángulo incluye automáticamente el espacio vacío dentro de la imagen **y** el letterbox exterior.

**4.3 Medición lineal (sin búsqueda binaria).** El ancho del texto escala linealmente con el tamaño de fuente, así que basta medir una vez a 100px con `canvas.measureText` y escalar: `fs = 100 × anchoDisponible / anchoMedido`. Exacto y en O(1).

**4.4 Ajuste con prioridad estricta:**
1. **Horizontal 1 línea** — el modo preferido.
2. **Horizontal multi-línea** — solo para frases de 2+ palabras (envuelve por palabras).
3. **Vertical (letra por letra)** — solo si horizontal no alcanza el tamaño mínimo legible (`minFS = max(26px, 5% del alto de pantalla)`). Restricción dura: `letras × fs × 0.85 ≤ alto disponible`.
4. **Reducción (shrink)** — último recurso, elige el modo (H o V) que dé la fuente más grande.

El motor evalúa los 3 rectángulos de zona por lado y se queda con el mejor resultado global.

**4.5 Invariante anti-recorte.** Tras el ajuste, la posición se limita (clamp) para que el bloque quede **100% dentro del viewport**. Ningún glifo puede quedar cortado jamás.

**4.6 Modo banda (móvil) por CALIDAD, no por ancho.** Primer intento fue "si la pantalla es angosta → bandas"; falló en 320px (un lado tenía 112px técnicamente usables pero el resultado era ilegible). El criterio final:

> Si el mejor tamaño logrado en **cualquiera** de los dos flancos queda por debajo del mínimo legible → abandonar los flancos y pasar a **bandas horizontales**: palabra 1 arriba del sujeto, palabra 2 abajo (reservando primero la franja del ecualizador).

**4.7 Reglas de respaldo en modo banda:**
- Banda inferior sin espacio (sujeto llega al borde) → **ambas palabras se apilan en la banda superior**.
- Banda superior sin espacio → ambas abajo.
- Imagen llena todo el viewport → overlay en la franja superior con halo del color de fondo (`text-shadow`) para legibilidad.

**4.8 Ecualizador.** Canvas fijo abajo (44–90px según viewport), escalado por `devicePixelRatio` para nitidez en grabación, `AnalyserNode` con `fftSize 256` y `smoothing 0.82`, arrays pre-asignados fuera del loop. Si `song.mp3` no existe, no rompe nada (try/catch + línea idle).

---

## 5. RESULTADOS DE LAS PRUEBAS (navegador real, Chromium headless)

Imagen de prueba: ilustración manga B/N, 735 × 1105 px, fondo blanco plano, sujeto recortado por el borde inferior.

| Viewport | Modo elegido por el motor | Resultado |
|---|---|---|
| 1920×1080 (FHD) | Flancos horizontales | Texto gigante a ambos lados de la cabeza, ancho completo de pantalla ✓ |
| 1440×983 (desktop) | Flancos horizontales | STRIKE / FORCE horizontales, pegados al sujeto sin taparlo ✓ |
| 768×1024 (tablet) | Flancos horizontales | Ambos legibles, tamaños adaptados al espacio de cada lado ✓ |
| 390×844 (móvil) | Bandas | STRIKE arriba, FORCE abajo, nada tapa al sujeto ✓ |
| 320×700 (móvil chico) | Bandas + apilado | Sujeto toca el borde inferior → ambas palabras apiladas arriba ✓ |

En los 5 tamaños: **cero letras cortadas, cero solapamiento con el sujeto, cero intervención manual.**

---

## 6. LECCIONES CLAVE DE LA INVESTIGACIÓN

1. **`object-fit: contain`, nunca `cover`** cuando el layout depende de coordenadas de píxel de la imagen.
2. **Filtros y viñetas rompen fondos planos** — deben ser condicionales a `background_is_flat`.
3. **CSS estático no puede hacer fitting condicional** (probar orientaciones / reducir tamaño); se necesita medir con JS.
4. **La decisión responsive correcta es por calidad del resultado** (¿alcanza el tamaño mínimo legible?), no por ancho de pantalla.
5. **Sobre-especificar un prompt degrada el resultado.** El patrón ganador para automatización es **Template Fill**: código probado embebido en el prompt + la IA solo inyecta datos.
6. **El JSON de visión puede venir tacaño** (`max_width_px: 70`): el motor debe recalcular el espacio real en pantalla y no confiar ciegamente en las zonas sugeridas.
7. **Nada de hacks anti-FOUC (`opacity: 0`)** en páginas para grabación headless: Playwright graba de inmediato y captura un video en blanco.
8. **Con plantilla fija, el Paso 2 ni siquiera necesita IA** — un script de pocas líneas puede inyectar el CONFIG (automatización 100% determinista).

---

## 7. PROMPT 1 — EXTRACTOR DE VISIÓN (versión final)

Se envía junto con la imagen a una IA multimodal. Devuelve el JSON espacial.

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

### LAYER A — BACKGROUND & COLOR CALIBRATION
- The background is always flat or near-flat (1 or 2 colors maximum).
- Extract the DOMINANT background color as an exact HEX value.
- If a second background color exists, extract it too; otherwise return null.
- Compute a HIGH-CONTRAST text color (HEX) readable on the dominant background and
  consistent with the artwork palette.

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
4. Output is pure, parseable JSON, nothing else.
```

---

## 8. PROMPT 2 — TEMPLATE FILL v5 (versión final)

```
# SYSTEM PROMPT: Spatial Composition Builder (v5 — Template Fill)

You are a precise code assembler. Below is a PROVEN, TESTED HTML template with a
built-in adaptive layout engine (responsive for desktop and mobile, audio-reactive
equalizer included). It already works. Do NOT redesign it, do NOT refactor it, do
NOT add features.

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

## VISION JSON
[INJECT_VISION_JSON_HERE]

## TEXT CONTENT (optional override)
* TEXT_LEFT: "[TEXT_LEFT]"
* TEXT_RIGHT: "[TEXT_RIGHT]"

## OUTPUT
Return ONLY the complete HTML (the template with CONFIG filled). Start with
<!DOCTYPE html>, end with </html>. No explanations.

## TEMPLATE (copy verbatim, fill only CONFIG)
(la plantilla completa de la sección 9 va aquí)
```

---

## 9. LA PLANTILLA PROBADA (código completo)

Este es el corazón del sistema. Ya verificada en Chromium headless en 5 viewports.

```html
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
  #bg { position: fixed; object-fit: contain; z-index: 1; }
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
  eqPosition: "bottom"
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

## 10. FLUJO DE TRABAJO FINAL Y AUTOMATIZACIÓN TOTAL

**Con IA en ambos pasos:**
1. Subir imagen + Prompt 1 → copiar el JSON.
2. Pegar el JSON en Prompt 2 → guardar la respuesta como `index.html`.
3. Colocar `bg.jpg` y `song.mp3` en la misma carpeta → grabar.

**Sin IA en el paso 2 (100% determinista):** como la plantilla es fija, un script
puede inyectar el CONFIG directamente:

```python
import json, re

vision = json.load(open("vision.json"))
z = vision["main_subject"]["contour_zones"]
bb = vision["main_subject"]["absolute_bounding_box"]

config = {
  "img": { "w": vision["image_dimensions"]["width_px"],
           "h": vision["image_dimensions"]["height_px"], "src": "bg.jpg" },
  "colors": { "bg": vision["color_calibration"]["dominant_background_color"],
              "ink": vision["color_calibration"]["high_contrast_text_color"] },
  "zones": [[z[k]["y_start_px"], z[k]["y_end_px"],
             z[k]["left_edge_x_px"], z[k]["right_edge_x_px"]]
            for k in ("top_zone", "middle_zone", "bottom_zone")],
  "subject": { "top": bb["top_y_px"], "bottom": bb["bottom_y_px"],
               "left": bb["left_x_px"], "right": bb["right_x_px"] },
  "texts": { "left":  vision["safe_typography_zones"]["left_text_block"]["suggested_text"],
             "right": vision["safe_typography_zones"]["right_text_block"]["suggested_text"] },
  "eqPosition": vision["equalizer_canvas_zone"]["position"]
}

html = open("plantilla-spatial.html").read()
html = re.sub(r"const CONFIG = \{.*?\};\n/\* =+ \*/",
              "const CONFIG = " + json.dumps(config, indent=2) + ";\n/* ==== */",
              html, flags=re.S)
open("index.html", "w").write(html)
```

---

## 11. DESVANECIDO DE BORDES (EDGE FADE) — solución a las costuras visibles

**Estado:** Probado y verificado en Chromium headless (1440×900 y 390×844) con `in1.html` + `bg5.jpg`.

### 11.1 El problema

La plantilla muestra la imagen con `object-fit: contain` centrada, y el color plano
`--bg` (extraído por la IA de visión) rellena el resto del viewport. Si el HEX
extraído no coincide **exactamente** con el fondo real de la foto, se ven líneas
verticales (u horizontales) donde termina la imagen.

Y hay un caso donde **ninguna precisión de extracción puede resolverlo**: fondos
que no son 100% planos. Medición real de `bg5.jpg` (muestreo de píxeles con Pillow):

| Zona del borde | Color real |
|---|---|
| Abajo | `rgb(240, 37, 41)` |
| Centro | `rgb(255, 64, 46)` |
| Arriba | `rgb(245, 43, 43)` |

El fondo tiene un degradado vertical sutil (+15 puntos en el canal R entre abajo y
centro). Un solo HEX plano (`#FF3527` en el CONFIG) jamás coincidirá en toda la
altura → la costura es inevitable **por más preciso que sea el Prompt 1**.

### 11.2 La solución: máscara CSS con degradado alfa

Se desvanece la opacidad de la imagen en sus bordes con `mask-image`, de modo que
la transición imagen → color plano sea gradual y el ojo no pueda localizar la
costura. Claves del diseño:

- **Por eje e inteligente**: el fade solo se activa en el eje donde existe costura.
  Si la imagen toca los bordes del viewport en un eje (no hay franja de color), ese
  eje no se desvanece. Se decide en `layout()` comparando `dw` vs `vw` y `dh` vs `vh`.
- **Proporcional**: el ancho del fade es una fracción del lado menor renderizado
  (`edgeFade: 0.07` → 7%), con límites [24px, 90px]. Escala bien en cualquier viewport.
- **Desactivable**: `edgeFade: 0` en CONFIG lo apaga por completo.
- **GPU, sin JS por frame**: es CSS puro; el JS solo actualiza dos variables CSS en
  load/resize. No afecta al ecualizador ni a la tipografía (la máscara va solo en `#bg`).

### 11.3 Los 3 cambios exactos (replicar en cualquier HTML generado)

**Cambio 1 — CSS del `#bg`** (reemplaza la línea `#bg { position: fixed; ... }`):

```css
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
```

Cómo funciona: dos degradados lineales (uno horizontal, uno vertical) definen la
opacidad de la imagen; `mask-composite: intersect` los combina, de modo que las 4
esquinas también quedan suavizadas. `--fx` / `--fy` son el ancho del fade por eje
(0px = sin fade en ese eje).

**Cambio 2 — nueva clave en CONFIG** (después de `eqPosition`):

```js
  eqPosition: "bottom",
  /* edge fade: fraction of the smaller rendered dimension (0 disables it) */
  edgeFade: 0.07
```

**Cambio 3 — en `layout()`**, inmediatamente después de la línea que posiciona la
imagen (`bgEl.style.cssText += ...`) y de definir `X`/`Y`:

```js
  /* edge fade: only on axes where the image doesn't reach the viewport edge */
  const fade = Math.max(24, Math.min(90, Math.min(dw, dh) * (C.edgeFade || 0)));
  bgEl.style.setProperty("--fx", (C.edgeFade && dw < vw - 1 ? fade : 0) + "px");
  bgEl.style.setProperty("--fy", (C.edgeFade && dh < vh - 1 ? fade : 0) + "px");
```

### 11.4 Resultado verificado

- **Desktop 1440×900** (imagen contenida por altura → costuras laterales): las
  líneas verticales desaparecen; los flancos se funden con el rojo de página.
- **Móvil 390×844** (imagen contenida por ancho → costuras arriba/abajo): el fade
  se activa solo en vertical; el borde inferior del sujeto se funde con el fondo
  con un efecto de "fade out" que se ve intencional.

### 11.5 Casos límite y propuestas para endurecer la plantilla (v6)

| Caso | Síntoma residual | Propuesta |
|---|---|---|
| Fondo con degradado/viñeta (como bg5) | La franja de la imagen sigue siendo levemente distinguible porque su centro es más brillante | **Auto-calibración runtime**: dibujar la imagen en un canvas offscreen, muestrear el promedio de las columnas de borde y asignar ese color medido a `--bg`, ignorando el HEX de la IA. Elimina la dependencia del Prompt 1 para fondos planos. |
| Fondo con degradado fuerte | Ningún color plano funciona | **Underlay borroso (efecto ambilight)**: duplicar la imagen detrás (`z-index: 0`) con `object-fit: cover` + `filter: blur(60px) + scale(1.2)`. El "fondo" de página pasa a ser la propia imagen difuminada → costura imposible por construcción. |
| Sujeto tocando el borde de la imagen (bg5: `subject.right = 720` ≈ ancho total) | El fade come unos px del sujeto | Aceptable visualmente (se ve como fade artístico). Si molesta: reducir `edgeFade` o hacer el fade asimétrico (solo en el lado libre, usando `zones` para saber qué lado toca). |
| Navegadores sin `mask-composite` | Sin fade (degradación silenciosa) | Alternativa 100% compatible: overlay de 4 franjas `linear-gradient(var(--bg) → transparente)` en `z-index: 2` sobre los bordes de la imagen. Mismo resultado visual porque detrás está exactamente `var(--bg)`. |

**Prioridad recomendada para la v6:** auto-calibración runtime del color de fondo
(propuesta 1). Resuelve de raíz el problema de precisión del HEX — la IA de visión
quedaría a cargo solo de zonas/sujeto/textos, y el color saldría medido de los
píxeles reales, no estimado.

---

## 12. ARCHIVOS DEL PROYECTO

| Archivo | Contenido |
|---|---|
| `prompt-vision-extractor.md` | Prompt 1 (visión) + ejemplo de salida |
| `prompt-v5-template-fill.md` | Prompt 2 final con plantilla embebida |
| `plantilla-spatial.html` | Plantilla probada, lista para usar |
| `preview-desktop.png` | Resultado verificado 1440×983 |
| `preview-movil.png` | Resultado verificado 390×844 (bandas) |
| `preview-movil-pequeno.png` | Resultado verificado 320×700 (apilado) |
| `prompt-html-architect-v2/v4.md` | Versiones intermedias (histórico) |
| `in1.html` | Prueba con bg5.jpg — incluye el edge fade de la sección 11 |
| `ALTERNATIVA-PROMPTS-V6.md` | Prompts 1 y 2 v6 listos para copiar (color de fondo de alta precisión + edge fade integrado en la plantilla) |
| `ESTUDIO-FONDOS-COMPLEJOS.md` | Estudio v7: fondos split 2 colores, grid 2×2 y multicolor (regiones + modo blur), con prompts v7 completos |
| `ESTUDIO-VIDEO.md` | Estudio v8: pipeline de VIDEO en loop (extracción por fotogramas, envolvente de movimiento, texto incrustado/keepOut), con prompts v8 y JSONs de prueba |
| `ESTUDIO-CAPTURA-UNICA.md` | Estudio v9: captura única (1 fotograma + margen de movimiento), rotación y content box (9:16/16:9/vertical-que-es-horizontal), probado con los videos test reales |

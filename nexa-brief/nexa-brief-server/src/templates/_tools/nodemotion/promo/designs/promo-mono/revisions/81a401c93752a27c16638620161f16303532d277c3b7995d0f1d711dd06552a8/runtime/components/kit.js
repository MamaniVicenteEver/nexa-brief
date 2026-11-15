/* Promo Mono · kit visual compartido por intro, escenas, transiciones y outros.
   Lenguaje: fondo negro, interfaz blanca minimalista (píldoras, burbujas de chat,
   botón de reproducir, pin de ubicación, móvil punteado, cupón), metraje en
   semitono dibujado en canvas y tipografía sans limpia con tecleo.
   Todas las funciones reciben (X, K, ...): X = escena (core), K = herramientas. */
const R = window.NexaPromo_promo_mono;
const k = R.kit, S = R.S;
const NS = "http://www.w3.org/2000/svg";

R.meta = {
  fallback: "headline",
  textIn: "type",
  hud: false,
  look: {
    dotScale: S.num(0.4, 2.5, 1),      /* tamaño de celda del semitono (1 = 9 px a 720p) */
    dotContrast: S.num(0.5, 2.5, 1.25), /* contraste del semitono */
    chipScale: S.num(0.6, 1.6, 1),     /* tamaño de las píldoras de texto */
    stroke: S.num(0.5, 3, 1),          /* grosor de líneas y contornos */
  },
};

k.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };
let uid = 0;   /* ids de <pattern> deterministas */
k.bg = (X, K, color) => K.div(X.L, "lay", { background: color || K.P.bg });
k.layer = (X, K, z = 1) => K.div(X.L, "lay", { zIndex: z });
k.sw = (X, K) => Math.max(1.5, 2.4 * X.u * (K.C.look.stroke || 1));

/* --------------------------------- SVG --------------------------------- */
k.svg = (parent, W, H, z) => {
  const s = document.createElementNS(NS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  Object.assign(s.style, { position: "absolute", left: 0, top: 0, overflow: "visible", pointerEvents: "none", zIndex: z ?? 2 });
  parent.appendChild(s);
  return s;
};
k.path = (s, d, o = {}) => {
  const p = document.createElementNS(NS, "path");
  p.setAttribute("d", d); p.setAttribute("fill", o.fill || "none");
  if (o.stroke) { p.setAttribute("stroke", o.stroke); p.setAttribute("stroke-width", o.sw || 2); p.setAttribute("stroke-linecap", o.cap || "round"); p.setAttribute("stroke-linejoin", "round"); }
  if (o.dash) p.setAttribute("stroke-dasharray", o.dash);
  s.appendChild(p);
  return p;
};
/* trazo que se dibuja de 0 a 1 entre t0 y t0+d (pathLength=1) */
k.draw = (X, K, p, t0, d, ease) => {
  p.setAttribute("pathLength", "1"); p.style.strokeDasharray = "1 1";
  X.T(p, "strokeDashoffset", "1").to(t0, d, "0", ease || K.EASE_IO);
};
k.erase = (X, K, p, t0, d) => X.T(p, "strokeDashoffset", "0").to(t0, d, "-1", K.EASE_IO);
/* garabato horizontal (onda irregular) que atraviesa un ancho */
k.squiggle = (x0, y0, w, h, seed = 1) => {
  const r = Math.sin(seed * 12.9898) * 43758.5453, rnd = i => ((Math.sin(r + i * 78.233) * 43758.5453) % 1 + 1) % 1;
  let d = `M${x0},${y0}`;
  const n = 5;
  for (let i = 1; i <= n; i++) {
    const x = x0 + w * i / n, y = y0 + (i % 2 ? -1 : 1) * h * (0.4 + rnd(i) * 0.6);
    d += ` Q${(x0 + w * (i - 0.5) / n).toFixed(1)},${(y + (rnd(i + 9) - 0.5) * h).toFixed(1)} ${x.toFixed(1)},${y.toFixed(1)}`;
  }
  return d;
};

/* -------------------------------- iconos -------------------------------- */
/* play · pause · pin · bars (sonido) · heart · smile · plus · close */
k.icon = (parent, kind, size, color, o = {}) => {
  const s = document.createElementNS(NS, "svg"), c = color, sw = o.sw ?? size * 0.08;
  s.setAttribute("width", size); s.setAttribute("height", size); s.setAttribute("viewBox", "0 0 100 100");
  s.style.display = "block";
  const add = (tag, attrs) => { const e = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v); s.appendChild(e); return e; };
  const st = { fill: "none", stroke: c, "stroke-width": sw / size * 100, "stroke-linecap": "round", "stroke-linejoin": "round" };
  if (kind === "play") { add("circle", { cx: 50, cy: 50, r: 48, fill: c }); add("path", { d: "M41 32 L68 50 L41 68 Z", fill: o.inner || "#000" }); }
  else if (kind === "pause") { add("circle", { cx: 50, cy: 50, r: 46, ...st }); add("rect", { x: 38, y: 33, width: 8, height: 34, rx: 2, fill: c }); add("rect", { x: 54, y: 33, width: 8, height: 34, rx: 2, fill: c }); }
  else if (kind === "pin") { add("path", { d: "M50 8 C30 8 18 23 18 40 C18 62 50 92 50 92 C50 92 82 62 82 40 C82 23 70 8 50 8 Z", ...st }); add("circle", { cx: 50, cy: 40, r: 12, ...st }); }
  else if (kind === "bars") { [[20, 30], [38, 18], [56, 30], [74, 22]].forEach(([x, h]) => add("rect", { x, y: 50 - h, width: 9, height: h * 2, rx: 3, fill: c })); }
  else if (kind === "heart") add("path", { d: "M50 84 C20 62 10 46 10 32 C10 20 20 12 31 12 C40 12 46 17 50 24 C54 17 60 12 69 12 C80 12 90 20 90 32 C90 46 80 62 50 84 Z", fill: c });
  else if (kind === "smile") { add("circle", { cx: 50, cy: 50, r: 44, ...st }); add("circle", { cx: 36, cy: 40, r: 5, fill: c }); add("circle", { cx: 64, cy: 40, r: 5, fill: c }); add("path", { d: "M32 60 Q50 76 68 60", ...st }); }
  else if (kind === "plus") { add("path", { d: "M50 22 V78 M22 50 H78", ...st }); }
  else if (kind === "close") { add("path", { d: "M28 28 L72 72 M72 28 L28 72", ...st }); }
  if (parent) parent.appendChild(s);
  return s;
};

/* ------------------------------ texto ------------------------------ */
/* entrada del texto: type (tecleo) · rise · pop · fade · wipe · cut */
k.textIn = (X, K, w, mode, t0, o = {}) => {
  const sp = 1 / (K.C.anim.speed || 1);
  if (mode === "cut") { K.hide(X, w.box, t0); return; }
  if (mode === "type" && w.chars.length) {
    const step = Math.min(0.06, (o.within ?? 0.7) / Math.max(1, w.chars.length)) * sp;
    w.chars.forEach((c, i) => X.T(c, "visibility", "hidden", true).set(t0 + i * step, "visible"));
    return;
  }
  X.T(w.el, "opacity", "0").to(t0, 0.3 * sp, "1", K.EASE_OUT);
  if (mode === "rise") X.T(w.el, "transform", `translateY(${(0.35 * (o.fs || 60)).toFixed(1)}px)`).to(t0, 0.45 * sp, "translateY(0px)", K.EASE_OUT);
  else if (mode === "pop") X.T(w.el, "transform", "scale(0.7)").to(t0, 0.35 * sp, "scale(1)", K.EASE_BACK);
  else if (mode === "wipe") X.T(w.el, "clipPath", "inset(0% 100% 0% 0%)").to(t0, 0.45 * sp, "inset(0% 0% 0% 0%)", K.EASE_IO);
};
/* texto con su entrada; devuelve también el ancho medido */
k.text = (X, K, parent, text, o) => {
  const w = K.tx(parent, text, { cls: o.cls || "ui", fs: o.fs, x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, color: o.color || K.P.fg, ls: o.ls || 0, split: o.mode === "type" || !o.mode ? "chars" : undefined });
  k.textIn(X, K, w, o.mode || "type", o.t0 ?? 0, o);
  w.width = K.textW(text, o.cls || "ui", o.ls || 0, o.fs);
  return w;
};
k.fitFs = (K, text, cls, maxW, maxH, ls = 0) => K.fit(text || " ", cls, ls, maxW, maxH);

/* ------------------------------ píldoras ------------------------------ */
/* píldora: fill = blanca con texto negro (chip de chat) · outline = contorno blanco */
k.pill = (X, K, parent, text, o) => {
  const fs = o.fs, padX = fs * 0.75, padY = fs * 0.42, sw = o.outline ? Math.max(1.5, fs * 0.08) : 0;
  const box = K.div(parent, "pill", {
    position: "absolute", left: o.x + "px", top: o.y + "px", transform: `translate(${-(o.ax ?? 0.5) * 100}%, ${-(o.ay ?? 0.5) * 100}%) rotate(${o.rot || 0}deg)`,
    display: "flex", alignItems: "center", gap: (fs * 0.4) + "px", whiteSpace: "nowrap",
    padding: `${padY}px ${padX}px`, borderRadius: (fs * 2) + "px", fontSize: fs + "px", lineHeight: 1,
    background: o.outline ? "transparent" : (o.fill || K.P.chip), color: o.outline ? (o.color || K.P.fg) : (o.color || K.P.chipText),
    border: o.outline ? `${sw}px solid ${o.color || K.P.fg}` : "none", zIndex: o.z ?? 3,
  });
  box.className = "pill " + (o.cls || "ui");
  if (o.icon) k.icon(box, o.icon, fs * 1.25, o.outline ? (o.color || K.P.fg) : (o.color || K.P.chipText), { sw: fs * 0.12 });
  const label = document.createElement("span"); label.textContent = text; box.appendChild(label);
  /* tail: «cola» de burbuja de chat en una esquina */
  if (o.tail) K.div(box, "", { position: "absolute", width: fs * 0.5 + "px", height: fs * 0.5 + "px", background: box.style.background, [o.tail === "r" ? "right" : "left"]: fs * 0.3 + "px", bottom: -fs * 0.18 + "px", transform: "rotate(45deg)", borderRadius: "2px" });
  return { box, label };
};

/* ------------------------------ semitono ------------------------------ */
/* Dibuja un medio (video o imagen) como semitono en un canvas encima de él.
   o: { cell (px), cellFrom (px, anima de cellFrom → cell en o.cellSec), shape: dot|square,
        contrast, invert, ink (color del punto), paper (fondo) }.
   El video sigue en el DOM debajo (visible para el reloj de HyperFrames); el
   canvas se redibuja con el reloj de la escena y al terminar cada búsqueda. */
k.halftone = (X, K, parent, kref, css, o = {}) => {
  /* el filtro en vivo no afecta a drawImage: solo se usa la variante pregradada si existe */
  const spec = typeof kref === "object" ? kref : K.mediaSpec(X.sc, kref);
  const m = K.mbox(X, parent, spec || kref, css, { filter: o.grade && spec?.graded?.[o.grade] ? o.grade : null, off: o.off });
  const box = m.box, src = m.el;
  const W = parseFloat(css.width) || X.W, H = parseFloat(css.height) || X.H;
  const cv = document.createElement("canvas"); cv.className = "media"; cv.width = Math.round(W); cv.height = Math.round(H);
  box.appendChild(cv);
  const g = cv.getContext("2d");
  const smp = document.createElement("canvas"), sg = smp.getContext("2d", { willReadFrequently: true });
  const base = (o.cell ?? 9) * X.u * (K.C.look.dotScale || 1), contrast = o.contrast ?? K.C.look.dotContrast ?? 1.25;
  const ink = o.ink || K.P.fg, paper = o.paper || K.P.bg, shape = o.shape || "dot";
  let lastT = 0, last = null, img = null, buf = null;
  /* colores empaquetados (little-endian: ABGR en Uint32) y mezcla para el borde suave */
  const rgb = h => { const n = parseInt(String(h).slice(1, 7), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const pack = ([r, gg, b]) => ((255 << 24) | (b << 16) | (gg << 8) | r) >>> 0;
  const IN = rgb(ink), PA = rgb(paper), inkRGBA = pack(IN), paperRGBA = pack(PA);
  /* 64 niveles precalculados para el borde suave (sin crear objetos por píxel) */
  const LUT = new Uint32Array(64).map((_, q) => pack([0, 1, 2].map(j => Math.round(PA[j] + (IN[j] - PA[j]) * q / 63))));
  function cellAt(t) { if (!o.cellFrom) return base; const p = K.clamp(t / (o.cellSec || 0.6), 0, 1); const e = 1 - Math.pow(1 - p, 3); return o.cellFrom * X.u + (base - o.cellFrom * X.u) * e; }
  function draw(t) {
    lastT = t;
    const cell = Math.max(3, cellAt(t)), cols = Math.max(2, Math.ceil(W / cell)), rows = Math.max(2, Math.ceil(H / cell));
    const iw = src.videoWidth || src.naturalWidth, ih = src.videoHeight || src.naturalHeight;
    if (!iw || !ih) { g.fillStyle = paper; g.fillRect(0, 0, cv.width, cv.height); return; }
    /* recorte tipo object-fit: cover */
    const ar = W / H, iar = iw / ih;
    let sw = iw, sh = ih, sx = 0, sy = 0;
    if (iar > ar) { sw = ih * ar; sx = (iw - sw) / 2; } else { sh = iw / ar; sy = (ih - sh) / 2; }
    /* leer un video que está buscando bloquea el hilo hasta decodificar; el retraso
       provoca otra búsqueda y el bucle hunde los fps. Mientras busca se reutiliza
       el último muestreo; al terminar la búsqueda («seeked») se redibuja. */
    let d;
    const busy = src.tagName === "VIDEO" && (src.seeking || src.readyState < 2);
    if (busy && last && last.cols === cols && last.rows === rows) d = last.d;
    else {
      if (smp.width !== cols || smp.height !== rows) { smp.width = cols; smp.height = rows; }
      try { sg.drawImage(src, sx, sy, sw, sh, 0, 0, cols, rows); } catch (e) { return; }
      try { d = sg.getImageData(0, 0, cols, rows).data; } catch (e) { return; }
      last = { cols, rows, d };
    }
    /* raster propio en un búfer de píxeles: ~19 000 círculos como trazado se
       rasterizan diferidos en la GPU por software del navegador headless y
       bloquean la siguiente lectura del video (≈150 ms/cuadro); escribir los
       píxeles en JS cuesta ≈5 ms y es determinista */
    const CW = cv.width, CH = cv.height;
    if (!img || img.width !== CW || img.height !== CH) { img = g.createImageData(CW, CH); buf = new Uint32Array(img.data.buffer); }
    buf.fill(paperRGBA);
    const half = cell / 2;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      let l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      l = K.clamp((l - 0.5) * contrast + 0.5, 0, 1);
      if (o.invert) l = 1 - l;
      const r = half * Math.sqrt(l) * 1.12;
      if (r < 0.35) continue;
      const cx = x * cell + half, cy = y * cell + half;
      const x0 = Math.max(0, Math.floor(cx - r - 1)), x1 = Math.min(CW - 1, Math.ceil(cx + r + 1));
      const y0 = Math.max(0, Math.floor(cy - r - 1)), y1 = Math.min(CH - 1, Math.ceil(cy + r + 1));
      for (let py = y0; py <= y1; py++) {
        const row = py * CW, dy = py + 0.5 - cy;
        for (let px = x0; px <= x1; px++) {
          const dx = px + 0.5 - cx;
          let a;
          if (shape === "square") a = Math.min(r - Math.abs(dx), r - Math.abs(dy)) + 0.5;
          else a = r - Math.sqrt(dx * dx + dy * dy) + 0.5;
          if (a <= 0) continue;
          buf[row + px] = a >= 1 ? inkRGBA : LUT[(a * 63) | 0];
        }
      }
    }
    g.putImageData(img, 0, 0);
  }
  /* imagen fija sin animación de celda: se dibuja una vez al cargar.
     Video (o celda animada): una pista escribe el tiempo local en cada cuadro */
  const still = (src.tagName === "IMG" || o.still) && !o.cellFrom;
  if (!still) {
    const drv = { set p(v) { draw(parseFloat(v) || 0); } };
    X.T(drv, "@p", "0").to(0, X.dur + 1.5, (X.dur + 1.5).toFixed(3));
  } else if (src.complete) draw(0);
  const redraw = () => draw(lastT);
  src.addEventListener?.("seeked", redraw); src.addEventListener?.("loadeddata", redraw); src.addEventListener?.("load", redraw);
  return { ...m, canvas: cv, draw };
};

/* ------------------------------ móvil ------------------------------ */
/* contorno de teléfono (punteado o sólido) centrado en (x, y) con altura h;
   devuelve la pantalla (div) para colocar contenido dentro */
k.phone = (X, K, parent, o) => {
  const h = o.h, w = h * 0.49, x = o.x - w / 2, y = o.y - h / 2, rad = w * 0.16;
  const wrap = K.div(parent, "", { position: "absolute", left: x + "px", top: y + "px", width: w + "px", height: h + "px", zIndex: o.z ?? 2 });
  const s = k.svg(wrap, w, h, 1);
  const sw = Math.max(2, h * 0.008);
  const notch = `M${w * 0.34},${sw} L${w * 0.66},${sw} Q${w * 0.64},${h * 0.035} ${w * 0.6},${h * 0.035} L${w * 0.4},${h * 0.035} Q${w * 0.36},${h * 0.035} ${w * 0.34},${sw}`;
  const body = `M${rad},${sw} H${w - rad} Q${w - sw},${sw} ${w - sw},${rad} V${h - rad} Q${w - sw},${h - sw} ${w - rad},${h - sw} H${rad} Q${sw},${h - sw} ${sw},${h - rad} V${rad} Q${sw},${sw} ${rad},${sw} Z`;
  const dotted = o.dotted !== false;
  const frame = k.path(s, body, { stroke: K.P.fg, sw: dotted ? sw * 1.4 : sw, dash: dotted ? `0 ${sw * 2.4}` : null, fill: o.screen || "none" });
  k.path(s, notch, { stroke: K.P.fg, sw: sw * 0.9, dash: dotted ? `0 ${sw * 2.2}` : null });
  const screen = K.div(wrap, "", { position: "absolute", left: w * 0.06 + "px", top: h * 0.06 + "px", width: w * 0.88 + "px", height: h * 0.88 + "px", overflow: "hidden", zIndex: 2 });
  return { wrap, screen, frame, w, h, x, y };
};
/* burbuja de chat (rectángulo blanco con punto de estado) */
k.bubble = (X, K, parent, text, o) => {
  const fs = o.fs;
  const b = K.div(parent, "ui", {
    position: "absolute", left: o.x + "px", top: o.y + "px", maxWidth: o.maxW + "px", padding: `${fs * 0.55}px ${fs * 0.7}px`,
    background: K.P.chip, color: K.P.chipText, fontSize: fs + "px", lineHeight: 1.25, borderRadius: fs * 0.35 + "px", whiteSpace: "normal",
    transform: `translateX(${o.side === "r" ? "-100%" : "0"})`, zIndex: 3,
  });
  b.textContent = text;
  K.div(b, "", { position: "absolute", width: fs * 0.55 + "px", height: fs * 0.55 + "px", borderRadius: "50%", background: K.P.chip,
    [o.side === "r" ? "right" : "left"]: -fs * 0.85 + "px", top: -fs * 0.2 + "px" });
  return b;
};
/* cupón / ticket con muescas laterales, relleno en semitono */
k.ticket = (X, K, parent, o) => {
  const w = o.w, h = w * 0.5, s = k.svg(parent, w, h, o.z ?? 2);
  s.style.left = (o.x - w / 2) + "px"; s.style.top = (o.y - h / 2) + "px";
  const n = h * 0.18, d = `M0,0 H${w} V${h / 2 - n} A${n},${n} 0 0 0 ${w},${h / 2 + n} V${h} H0 V${h / 2 + n} A${n},${n} 0 0 0 0,${h / 2 - n} Z`;
  const id = "tk" + (++uid);
  const defs = document.createElementNS(NS, "defs");
  defs.innerHTML = `<pattern id="${id}" width="${w * 0.035}" height="${w * 0.035}" patternUnits="userSpaceOnUse"><circle cx="${w * 0.0175}" cy="${w * 0.0175}" r="${w * 0.011}" fill="${k.rgba(K.P.fg, 0.55)}"/></pattern>`;
  s.appendChild(defs);
  k.path(s, d, { fill: `url(#${id})`, stroke: k.rgba(K.P.fg, 0.8), sw: Math.max(1.5, w * 0.008) });
  k.path(s, `M${w * 0.72},${h * 0.12} V${h * 0.88}`, { stroke: k.rgba(K.P.fg, 0.8), sw: Math.max(1.5, w * 0.008), dash: `${w * 0.02} ${w * 0.02}` });
  s.style.transformOrigin = "50% 50%";
  return s;
};
/* lista de chips: de la escena (renglones 2+), del config (chips) o por defecto */
k.chipPool = (K, X) => {
  const ls = K.lines(X).slice(1).map(l => l.text).filter(Boolean);
  const pool = ls.length >= 4 ? ls : (Array.isArray(K.C.chips) && K.C.chips.length ? K.C.chips : ["Vamos", "Vamos ya", "Vamos juntos"]);
  return pool.map(String);
};

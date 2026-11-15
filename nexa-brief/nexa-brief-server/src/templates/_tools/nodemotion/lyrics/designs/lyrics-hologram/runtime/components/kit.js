/* Lyrics Hologram · kit visual compartido por intro, escenas, transiciones y outros.
   Lenguaje: fondos casi negros, condensada alta + extendida itálica muy negra,
   relleno holográfico iridiscente (lila, cian, rosa, azul) dentro de las letras,
   contornos gigantes con ecos, barras que cortan la palabra, secciones roja,
   violeta y gris claro, un campo de "seda holográfica" fluida (WebGL, con
   respaldo 2D), rótulos diminutos en los bordes y filas de rombos.
   Medios: look "silhouette" (siluetas claras sobre negro → relleno holográfico)
   o duotono holográfico. X = escena (W, H, u, r, T, dur, p, sc), K = herramientas. */
const R = window.NexaPromo_lyrics_hologram;
const k = R.kit, S = R.S;

R.meta = {
  mode: "lyrics",
  fallback: "holoWord",
  textIn: "slide",
  hud: false,
  bgs: ["void", "holo", "red", "violet", "pale", "media"],
  look: {
    holoSpeed: S.num(0, 3, 1),        /* velocidad del campo y del brillo holográfico */
    labels: S.num(0, 1, 0.75),        /* probabilidad de rótulos diminutos en los bordes */
    labelText: S.str(40, ""),         /* texto de los rótulos (vacío = intro.title) */
    ornaments: S.num(0, 1, 0.6),      /* probabilidad de filas de rombos junto a la palabra */
    frame: S.num(0, 1, 0.5),          /* líneas finas de encuadre en fondos oscuros */
    glitch: S.num(0, 2, 1),           /* intensidad de cortes y desplazamientos */
    mediaHolo: S.num(0, 1, 0.65),     /* iridiscencia sobre medios en duotono */
    glow: S.num(0, 1, 0.5),           /* halo de las letras holográficas */
  },
};

for (const [key, v] of [["condensed", "--fC"], ["wide", "--fW"]])
  if (R.C?.fonts?.[key]) document.documentElement.style.setProperty(v, `"${String(R.C.fonts[key]).replace(/["\\]/g, "")}"`);

const U = s => String(s).toUpperCase();
k.U = U;
k.J = ws => ws.map(w => w.text).join(" ");
k.port = X => X.W < X.H;
k.hero = ws => { let b = 0, bs = -1; ws.forEach((w, i) => { const s = (/^(a|an|the|and|or|but|of|to|in|on|at|i|i'm|me|my|you|it|is|we|el|la|los|las|un|una|y|o|de|en|que|mi|tu|yo|es|lo|se|no)$/i.test(w.text) ? 0 : 10) + w.text.length; if (s > bs) { bs = s; b = i; } }); return b; };
k.heroLen = sc => sc.words.length ? sc.words[k.hero(sc.words)].text.length : 0;
k.rows = (ws, n) => {
  if (n <= 1 || ws.length <= 1) return [ws];
  const total = k.J(ws).length, out = [[]]; let acc = 0;
  for (const w of ws) {
    if (out[out.length - 1].length && acc >= total * out.length / n && out.length < n) out.push([]);
    out[out.length - 1].push(w); acc += w.text.length + 1;
  }
  return out.filter(r => r.length);
};
const DARK = { void: true, red: true, violet: true, media: true, holo: false, pale: false };
k.dark = bg => DARK[bg] !== false;
k.fg = (K, bg) => (k.dark(bg) ? K.P.white : K.P.ink);

/* ---------------- holografía: shader compartido (un solo contexto WebGL) ---------------- */
const rgb = h => { const n = parseInt(String(h).slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };
const HOLO = K => ["h1", "h2", "h3", "h4", "h5"].map(c => K.P[c] || "#C7B5FF");
const FRAG = `precision highp float;
uniform vec2 res; uniform float t; uniform float seed; uniform vec3 c1; uniform vec3 c2; uniform vec3 c3; uniform vec3 c4; uniform vec3 c5;
vec3 ramp(float s){ s = fract(s) * 5.0;
  if (s < 1.0) return mix(c1, c2, smoothstep(0.0, 1.0, s));
  if (s < 2.0) return mix(c2, c3, smoothstep(0.0, 1.0, s - 1.0));
  if (s < 3.0) return mix(c3, c4, smoothstep(0.0, 1.0, s - 2.0));
  if (s < 4.0) return mix(c4, c5, smoothstep(0.0, 1.0, s - 3.0));
  return mix(c5, c1, smoothstep(0.0, 1.0, s - 4.0)); }
void main(){
  vec2 uv = gl_FragCoord.xy / res;
  vec2 p = (uv - 0.5) * vec2(res.x / res.y, 1.0) * 1.6;
  float tt = t + seed;
  vec2 q = p;
  for (int i = 0; i < 5; i++) { float fi = float(i);
    q += vec2(sin(q.y * 1.35 + tt * 0.9 + fi * 1.7), cos(q.x * 1.25 - tt * 0.7 + fi * 2.3)) * 0.38; }
  float f = q.x * 0.55 + q.y * 0.35;
  vec3 col = ramp(f * 0.6 + tt * 0.05);
  float fold = sin(f * 3.2 + tt * 0.6);
  col *= 0.84 + 0.16 * fold;
  float sheen = pow(max(0.0, sin(f * 2.4 - tt * 0.8 + 1.3)), 10.0);
  col = mix(col, vec3(1.0), sheen * 0.6 + 0.06);
  gl_FragColor = vec4(col, 1.0);
}`;
let GL = null;
function glInit() {
  if (GL !== null) return GL;
  try {
    const cv = document.createElement("canvas"); cv.width = 640; cv.height = 360;
    const gl = cv.getContext("webgl", { preserveDrawingBuffer: true, antialias: false, alpha: false, premultipliedAlpha: false });
    if (!gl) return (GL = false);
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, "attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }"));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const a = gl.getAttribLocation(pr, "a"); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    const u = {}; for (const n of ["res", "t", "seed", "c1", "c2", "c3", "c4", "c5"]) u[n] = gl.getUniformLocation(pr, n);
    return (GL = { cv, gl, u });
  } catch (e) { console.warn("[lyrics-hologram] WebGL no disponible, respaldo 2D", e); return (GL = false); }
}
function holoGL(w, h, t, seed, cols) {
  const g = glInit(); if (!g) return null;
  const { gl, u, cv } = g;
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  gl.viewport(0, 0, w, h);
  gl.uniform2f(u.res, w, h); gl.uniform1f(u.t, t); gl.uniform1f(u.seed, seed);
  cols.forEach((c, i) => gl.uniform3fv(u["c" + (i + 1)], rgb(c)));
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  return cv;
}
/* respaldo sin WebGL: manchas de color desenfocadas que se mueven con t (determinista) */
function holo2D(cx, w, h, t, seed, cols) {
  cx.filter = "none"; cx.fillStyle = cols[0]; cx.fillRect(0, 0, w, h);
  cx.filter = `blur(${Math.round(Math.min(w, h) * 0.08)}px)`;
  for (let i = 0; i < 7; i++) {
    const a = seed * 1.7 + i * 2.1 + t * (0.25 + i * 0.04);
    const x = w * (0.5 + 0.42 * Math.sin(a)), y = h * (0.5 + 0.42 * Math.cos(a * 0.8 + i)), r = Math.min(w, h) * (0.35 + 0.1 * Math.sin(a * 1.3));
    const g = cx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, cols[(i + 1) % cols.length]); g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g; cx.fillRect(0, 0, w, h);
  }
  cx.filter = "none";
}
/* textura fija (para letras y paneles): se genera una vez por paleta */
const TEX = new Map();
k.tex = (K, deep = false) => {
  const H5 = HOLO(K), cols = deep ? [K.P.violet, shade(H5[3], 0.78), shade(H5[1], 0.5), shade(H5[2], 0.55), shade(H5[0], 0.5)] : H5, key = cols.join();
  if (TEX.has(key)) return TEX.get(key);
  const w = 1024, h = 512, cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  const cx = cv.getContext("2d"), src = holoGL(w, h, 3.1, 1.7, cols);
  if (src) cx.drawImage(src, 0, 0); else holo2D(cx, w, h, 3.1, 1.7, cols);
  const url = `url(${cv.toDataURL("image/jpeg", 0.9)})`;
  TEX.set(key, url);
  return url;
};
/* campo holográfico animado: lienzo a media resolución que se redibuja con el reloj */
k.field = (X, K, parent, o = {}) => {
  const cols = HOLO(K), sc = o.scale ?? 0.5;
  const sw = Math.max(64, Math.round(X.W * sc)), sh = Math.max(64, Math.round(X.H * sc));
  const cv = document.createElement("canvas"); cv.width = sw; cv.height = sh;
  cv.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;display:block";
  if (o.opacity != null) cv.style.opacity = String(o.opacity);
  parent.appendChild(cv);
  const cx = cv.getContext("2d"), seed = o.seed ?? X.r() * 40, spd = 0.35 * K.C.look.holoSpeed;
  const draw = t => { const src = holoGL(sw, sh, t * spd, seed, cols); if (src) cx.drawImage(src, 0, 0); else holo2D(cx, sw, sh, t * spd, seed, cols); };
  draw(0);
  const drv = { set t(v) { draw(+v); } };
  X.T(drv, "@t", "0").to(0, X.dur + 1, String((X.dur + 1).toFixed(3)));
  return cv;
};
/* relleno holográfico de un texto o un bloque */
k.holoFill = (X, K, el, o = {}) => {
  const a = X.r() * 60, b = X.r() * 60, s = K.C.look.holoSpeed;
  const deep = o.text !== false && (o.deep ?? X.light === true);   /* letras sobre fondo claro: holografía profunda */
  Object.assign(el.style, { backgroundImage: k.tex(K, deep), backgroundSize: o.size || "260% 320%", backgroundRepeat: "repeat" });
  if (o.text !== false) Object.assign(el.style, { webkitBackgroundClip: "text", backgroundClip: "text", color: "transparent", webkitTextFillColor: "transparent" });
  if (o.text !== false && !deep && K.C.look.glow > 0) el.style.filter = `drop-shadow(0 0 ${(0.012 * Math.min(X.W, X.H) * K.C.look.glow).toFixed(1)}px rgba(214,200,255,${(0.35 * K.C.look.glow).toFixed(2)}))`;
  X.T(el, "backgroundPosition", `${a.toFixed(1)}% ${b.toFixed(1)}%`).to(0, X.dur + 0.5, `${(a + 35 * s).toFixed(1)}% ${(b + 22 * s).toFixed(1)}%`);
};
/* bloque rectangular holográfico (paneles, barras) */
k.holoBox = (X, K, parent, css) => { const d = K.div(parent, "patch", css); k.holoFill(X, K, d, { text: false, size: "180% 220%" }); return d; };

/* ---------------- fondos ---------------- */
/* slot.bg: void (casi negro) · holo (seda holográfica) · red · violet · pale (gris claro) · media */
k.bg = (X, K, o = {}) => {
  const L = X.L, bg = o.bg || X.sc.slot.bg || "void", P = K.P, { W, H } = X;
  if (bg === "holo") { L.style.background = P.h1; k.field(X, K, L); K.div(L, "lay", { background: "radial-gradient(ellipse 90% 80% at 50% 50%, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 60%, rgba(40,20,90,0.18) 100%)" }); }
  else if (bg === "red") { L.style.background = `radial-gradient(ellipse 85% 85% at 55% 45%, ${P.red} 0%, ${P.red} 45%, ${shade(P.red, 0.62)} 100%)`; }
  else if (bg === "violet") {
    L.style.background = `radial-gradient(ellipse 90% 90% at 50% 40%, ${P.violet} 0%, ${shade(P.violet, 0.45)} 100%)`;
    const rib = K.div(L, "lay", { opacity: "0.55", mixBlendMode: "screen" });
    for (let i = 0; i < 2; i++) {
      const y = (0.15 + X.r() * 0.7) * H, rot = (X.r() - 0.5) * 40;
      const b = k.holoBox(X, K, rib, { left: (-0.1 * W) + "px", top: y + "px", width: (1.2 * W) + "px", height: (0.03 + X.r() * 0.05) * H + "px", transform: `rotate(${rot.toFixed(1)}deg)`, filter: `blur(${(4 * X.u).toFixed(1)}px)`, borderRadius: "50%" });
      X.T(b, "transform", `rotate(${rot.toFixed(1)}deg) translateX(-4%)`).to(0, X.dur, `rotate(${rot.toFixed(1)}deg) translateX(4%)`);
    }
  }
  else if (bg === "pale") { L.style.background = `radial-gradient(ellipse 90% 90% at 50% 45%, ${P.pale} 0%, ${shade(P.pale, 0.9)} 100%)`; }
  else if (bg === "media") { L.style.background = P.void; k.media(X, K, L, 0); }
  else { L.style.background = `radial-gradient(ellipse 95% 95% at 50% 42%, ${P.night} 0%, ${P.void} 75%)`; }
  X.light = !k.dark(bg);
  if (k.dark(bg) && bg !== "media" && X.r() < K.C.look.frame) k.frame(X, K, L);
  if (o.labels !== false) k.labels(X, K, L, bg);
  return { L, bg, fg: k.fg(K, bg) };
};
function shade(hex, f) { const [r, g, b] = rgb(hex); return "#" + [r, g, b].map(v => Math.round(Math.max(0, Math.min(1, v * f)) * 255).toString(16).padStart(2, "0")).join(""); }
k.shade = shade;
/* líneas finas de encuadre (rectángulo interior y marcas) */
k.frame = (X, K, L) => {
  const { W, H, u } = X, c = "rgba(255,255,255,0.09)", lw = Math.max(1, 0.9 * u);
  const f = K.div(L, "patch", { left: 0.07 * W + "px", top: 0.12 * H + "px", width: 0.86 * W + "px", height: 0.76 * H + "px", border: `${lw}px solid ${c}` });
  X.T(f, "clipPath", "inset(0 100% 0 0)").to(0.02, 0.5, "inset(0 0% 0 0)", K.EASE_OUT);
  for (let i = 0; i < 3; i++) K.div(L, "patch", { left: (0.04 + X.r() * 0.92) * W + "px", top: (0.04 + X.r() * 0.92) * H + "px", width: 14 * u + "px", height: lw + "px", background: "rgba(255,255,255,0.22)", transform: `rotate(${X.r() < 0.5 ? -60 : 0}deg)` });
};
/* rótulos diminutos repetidos arriba y abajo (texto de look.labelText o intro.title) */
k.labels = (X, K, L, bg) => {
  if (X.r() >= K.C.look.labels) return;
  const txt = U(K.C.look.labelText || K.C.intro?.title || K.BR.name || "").trim();
  if (!txt) return;
  const { W, H } = X, fs = Math.max(7, 0.0135 * Math.min(W, H) * (k.port(X) ? 1.5 : 1));
  const col = k.dark(bg) ? "rgba(255,255,255,0.7)" : (bg === "holo" ? "rgba(20,14,40,0.55)" : "rgba(20,20,26,0.6)");
  const g = K.div(L, "lay");
  const xs = k.port(X) ? [[0.08, 0], [0.92, 1]] : [[0.06, 0], [0.5, 0.5], [0.94, 1]];
  for (const y of [0.055, 0.945]) for (const [x, ax] of xs) K.tx(g, txt, { cls: "fc", fs, x: x * W, y: y * H, ax, ay: 0.5, color: col, ls: 0.14 });
  X.T(g, "opacity", "0").to(0.05, 0.25, "1");
};
/* fila de rombos (ornamento) centrada en (cx, cy) */
const SVGNS = "http://www.w3.org/2000/svg";
k.ornaments = (X, K, parent, cx, cy, n, size, color, t0 = 0.05) => {
  if (X.r() >= K.C.look.ornaments) return null;
  const s = document.createElementNS(SVGNS, "svg"), gap = size * 1.9, w = gap * n;
  s.setAttribute("width", w); s.setAttribute("height", size * 2); s.setAttribute("viewBox", `0 0 ${w} ${size * 2}`);
  s.style.cssText = `position:absolute;left:${cx - w / 2}px;top:${cy - size}px;overflow:visible;pointer-events:none`;
  let html = "";
  for (let i = 0; i < n; i++) {
    const x = gap * (i + 0.5), y = size, a = size * 0.62;
    html += `<path d="M${x} ${y - size} L${x + a} ${y - size * 0.2} L${x} ${y + size * 0.55} L${x - a} ${y - size * 0.2} Z M${x} ${y - size * 0.45} L${x + a * 0.45} ${y - size * 0.12} L${x} ${y + size * 0.18} L${x - a * 0.45} ${y - size * 0.12} Z" fill="${color}" fill-rule="evenodd" opacity="0.92"/>`;
  }
  s.innerHTML = html;
  parent.appendChild(s);
  [...s.children].forEach((p, i) => K.hide(X, p, t0 + i * 0.05));
  return s;
};

/* ---------------- medios ---------------- */
/* look "silhouette": figura clara sobre negro → la figura se llena de holografía y
   el negro desaparece (screen sobre el fondo). Si no, duotono "holo" + iridiscencia. */
k.spec = (X, K, slot) => (typeof slot === "object" ? slot : K.mediaSpec(X.sc, slot));
k.isSil = (X, K, slot) => { const s = k.spec(X, K, slot); return !!(s && s.look === "silhouette"); };
/* elige el hueco 0/1 que cumple el look pedido ("silhouette" o "duo"); si no hay, el 0 */
k.pick = (X, K, want) => { for (const i of [0, 1]) if (k.isSil(X, K, i) === (want === "silhouette")) return i; return 0; };
/* hueco con silueta: el de la escena si lo es; si no, la primera silueta de config.media (o null) */
k.silSlot = (X, K) => { const i = k.pick(X, K, "silhouette"); return k.isSil(X, K, i) ? i : (K.C.media || []).find(m => m.look === "silhouette") || null; };
k.media = (X, K, parent, slot, rect, o = {}) => {
  const R0 = rect || { x: 0, y: 0, w: X.W, h: X.H };
  const css = { left: R0.x + "px", top: R0.y + "px", width: R0.w + "px", height: R0.h + "px" };
  const sil = k.isSil(X, K, slot);
  const m = K.mbox(X, parent, slot, css, sil ? {} : { filter: "holo" });
  K.kenBurns(X, m, "scale(1.04)", "scale(1.12)");
  if (sil && o.ink) {   /* fondo claro: silueta oscura (video invertido multiplicado) */
    m.box.style.background = "#fff"; m.el.style.filter = "invert(1) grayscale(1) contrast(1.3)"; m.box.style.mixBlendMode = "multiply";
  } else if (sil) {
    m.box.style.background = "#000";
    const ov = K.div(m.box, "lay", { mixBlendMode: "multiply" });
    k.holoFill(X, K, ov, { text: false, size: "160% 200%" });
    if (o.screen !== false) m.box.style.mixBlendMode = "screen";
  } else {
    const a = K.C.look.mediaHolo;
    if (a > 0) { const ov = K.div(m.box, "lay", { mixBlendMode: "soft-light", opacity: String(a) }); k.holoFill(X, K, ov, { text: false, size: "200% 240%" }); }
    K.div(m.box, "lay", { background: "linear-gradient(180deg, rgba(10,10,16,0.25) 0%, rgba(10,10,16,0) 35%, rgba(10,10,16,0.55) 100%)" });
  }
  m.sil = sil;
  return m;
};

/* ---------------- texto ---------------- */
/* entrada: slide (sube dentro de su caja) · stamp (golpe) · glitch (cortes) · spread (se junta) · type · fade · cut */
k.enter = (X, K, el, mode, t) => {
  const u = X.u, g = K.C.look.glitch;
  if (mode === "cut" || mode === "type") { K.hide(X, el, t); return; }
  if (mode === "slide") { el.style.clipPath = "inset(-8% -6% -4% -6%)"; X.T(el, "transform", "translateY(110%)").to(t, 0.2, "translateY(0%)", K.EASE_OUT); K.hide(X, el, t); return; }
  if (mode === "stamp") { X.T(el, "transform", "scale(1.3)").to(t, 0.14, "scale(1)", K.EASE_OUT); K.hide(X, el, t); return; }
  if (mode === "spread") { X.T(el, "letterSpacing", "0.5em").to(t, 0.32, "0em", K.EASE_OUT); X.T(el, "opacity", "0").to(t, 0.15, "1"); return; }
  if (mode === "glitch") {
    K.hide(X, el, t);
    if (g <= 0) return;
    const j = v => (v * u * g).toFixed(1) + "px";
    X.T(el, "transform", "translateX(0px)", true).set(t, `translateX(${j(-9)})`).set(t + 0.04, `translateX(${j(6)})`).set(t + 0.08, `translateX(${j(-2)})`).set(t + 0.12, "translateX(0px)");
    X.T(el, "clipPath", "inset(-10% -10% -10% -10%)", true).set(t, "inset(-10% -10% 52% -10%)").set(t + 0.04, "inset(38% -10% -10% -10%)").set(t + 0.08, "inset(-10% -10% 18% -10%)").set(t + 0.12, "inset(-10% -10% -10% -10%)");
    return;
  }
  X.T(el, "opacity", "0").to(t, 0.18, "1");
};
/* renglón con palabras que entran a su tiempo.
   o = {cls, fs, x, y, ax, ay, color, ls, mode, holo, stroke, strokeColor, sizes[], strokeIdx[], holoIdx[]} */
k.line = (X, K, parent, ws, o) => {
  const text = U(k.J(ws));
  const t = K.tx(parent, text, { cls: o.cls || "fc", fs: o.fs, x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, color: o.color, ls: o.ls, split: "words" });
  const mode = o.mode || X.p.textIn || K.C.anim.textIn;
  t.words.forEach((s, i) => {
    if (o.sizes && o.sizes[i]) s.style.fontSize = (o.sizes[i] * 100).toFixed(1) + "%";
    const stroke = o.stroke || (o.strokeIdx && o.strokeIdx.includes(i));
    if (stroke) { s.style.color = "transparent"; s.style.webkitTextStroke = `${Math.max(1, o.fs * (o.sw || 0.012))}px ${o.strokeColor || o.color}`; }
    else if (o.holo || (o.holoIdx && o.holoIdx.includes(i))) k.holoFill(X, K, s);
    k.enter(X, K, s, mode, Math.max(0.02, ws[i]?.rt ?? 0.05));
  });
  t.width = K.textW(text, o.cls || "fc", o.ls || 0, o.fs);
  return t;
};
k.fit = (K, text, cls, maxW, maxH, ls = 0) => K.fit(U(text) || "A", cls, ls, maxW, maxH);
k.boxOf = (X, el) => { const r = el.getBoundingClientRect(), R0 = X.root.getBoundingClientRect(); return { x: r.left - R0.left, y: r.top - R0.top, w: r.width, h: r.height }; };
k.later = (X, el, fn) => X.pend.push(() => fn(k.boxOf(X, el)));
/* barras que tapan partes de la palabra y se retiran (o se quedan como tiras finas) */
k.bars = (X, K, parent, el, t0, o = {}) => k.later(X, el, b => {
  const n = o.n ?? 3 + Math.floor(X.r() * 3), g = K.C.look.glitch;
  for (let i = 0; i < n; i++) {
    const w = b.w * (0.08 + X.r() * 0.22), x = b.x + X.r() * (b.w - w), hh = b.h * (0.35 + X.r() * 0.55), y = b.y + X.r() * (b.h - hh);
    const kind = o.kinds ? o.kinds[i % o.kinds.length] : (X.r() < 0.55 ? "holo" : "solid");
    const css = { left: x + "px", top: y + "px", width: w + "px", height: hh + "px", transformOrigin: X.r() < 0.5 ? "0% 50%" : "100% 50%" };
    const d = kind === "holo" ? k.holoBox(X, K, parent, css) : K.div(parent, "patch", { ...css, background: o.solid || K.P.white });
    const ts = t0 + i * 0.05 * Math.max(0.3, g), keep = X.r() < (o.keep ?? 0.15);
    K.hide(X, d, Math.max(0, ts - 0.12));
    X.T(d, "transform", "scaleX(1)").to(ts + 0.12, 0.22, keep ? "scaleX(0.08)" : "scaleX(0)", K.EASE_IO);
  }
});
/* palabra con sus copias apiladas (contorno) arriba y abajo */
k.echoes = (X, K, parent, word, cls, fs, x, y, n, color, t0, dir = 1) => {
  for (let i = 1; i <= n; i++) for (const s of [-1, 1]) {
    const tt = K.tx(parent, U(word), { cls, fs, x, y: y + s * i * fs * 0.92, ax: 0.5, color, stroke: true, sw: 0.01 });
    tt.box.style.opacity = String(Math.max(0.12, 0.55 - i * 0.16));
    K.hide(X, tt.box, t0 + i * 0.06);
    X.T(tt.el, "transform", `translateY(${(-s * 0.3 * fs * dir).toFixed(1)}px)`).to(t0 + i * 0.06, 0.4, "translateY(0px)", K.EASE_OUT);
  }
};

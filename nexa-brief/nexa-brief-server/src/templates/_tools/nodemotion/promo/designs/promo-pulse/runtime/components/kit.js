/* Promo Pulse · kit visual compartido por intro, escenas y outros.
   Lenguaje de la referencia: fondo negro, metraje cinematográfico
   desaturado, palabra condensada en itálica color crema (Anton), palabra
   gigante en contorno verde neón detrás, video enmarcado, texto calado con
   el video dentro, medidor verde segmentado, frases cortas en itálica y
   rótulos fijos (esquina superior derecha y pie).
   Todas las funciones reciben (X, K, ...): X = escena, K = herramientas. */
const R = window.NexaPromo_promo_pulse;
const k = R.kit, S = R.S;

R.meta = {
  fallback: "full",
  textIn: "slam",
  hud: true,
  look: {
    giantOpacity: S.num(0, 1, 0.9),    /* opacidad de la palabra gigante en contorno */
    vignette: S.num(0, 1, 0.6),        /* oscurecido de bordes */
    accents: S.num(0, 2, 1),           /* cantidad de acentos verdes (0 = sin acentos) */
    frameShadow: S.num(0, 1, 0.6),     /* sombra del video enmarcado */
  },
};

k.rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

/* entrada del titular: slam (golpe de escala con desenfoque) · rise · wipe · type · fade · cut */
k.textIn = (X, K, w, mode, t0) => {
  const sp = 1 / (K.C.anim.speed || 1), I = K.C.anim.intensity ?? 1;
  if (mode === "cut") return;
  if (mode === "slam") {
    X.T(w.el, "transform", `scale(${(1 + 0.45 * I).toFixed(3)})`).to(t0, 0.3 * sp, "scale(1)", K.EASE_OUT);
    X.T(w.el, "filter", "blur(12px)").to(t0, 0.25 * sp, "blur(0px)", K.EASE_OUT);
    X.T(w.el, "opacity", "0").to(t0, 0.1, "1");
  } else if (mode === "rise") {
    w.el.style.clipPath = "inset(-10% -10% -10% -10%)";
    X.T(w.el, "transform", `translateY(${(0.9 * Math.max(0.3, I)).toFixed(2)}em)`).to(t0, 0.36 * sp, "translateY(0em)", K.EASE_OUT);
    X.T(w.el, "opacity", "0").to(t0, 0.15, "1");
  } else if (mode === "wipe") X.T(w.el, "clipPath", "inset(0% 100% 0% 0%)").to(t0, 0.35 * sp, "inset(0% 0% 0% 0%)", K.EASE_OUT);
  else if (mode === "type") (w.chars.length ? w.chars : [w.el]).forEach((c, i) => K.hide(X, c, t0 + i * 0.05 * sp));
  else X.T(w.el, "opacity", "0").to(t0, 0.35 * sp, "1", K.EASE_OUT);
};
/* titular crema condensado en itálica. o = {x, y, ax, ay, fs, color, t0, textIn, cls} */
k.title = (X, K, parent, text, o = {}) => {
  const t = String(text || "");
  const mode = o.textIn || X.p.textIn || K.C.anim.textIn;
  const w = K.tx(parent, t, { x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, fs: o.fs, cls: o.cls || "dp", color: o.color || K.P.cream, ls: o.ls, split: mode === "type" ? "chars" : undefined });
  if (o.stroke) { w.el.style.color = "transparent"; w.el.style.webkitTextStroke = `${Math.max(1.2, o.fs * 0.012)}px ${o.color || K.P.green}`; }
  k.textIn(X, K, w, mode, o.t0 ?? 0.1);
  w.width = K.textW(t, o.cls || "dp", o.ls || 0, o.fs);
  w.left = o.x - (o.ax ?? 0.5) * w.width;
  return w;
};
k.fitFs = (K, text, cls, maxW, maxH) => K.fit(String(text || "A"), cls, 0, maxW, maxH);
/* frase corta en itálica (Montserrat), aparece letra a letra */
k.tagline = (X, K, parent, text, o) => {
  if (!text) return null;
  const w = K.tx(parent, text, { x: o.x, y: o.y, ax: o.ax ?? 0, ay: 0.5, fs: o.fs, cls: "tg", color: K.P.cream, split: "chars" });
  w.chars.forEach((c, i) => { X.T(c, "opacity", "0").to((o.t0 ?? 0.3) + i * 0.025, 0.12, "1"); });
  return w;
};
/* medio a pantalla completa con grade (cine · dim · none) y movimiento (zoom · drift · still) */
k.media = (X, K, parent, slot, rect, o = {}) => {
  const g = o.grade ?? X.p.grade ?? "cine";
  const m = K.mbox(X, parent, slot, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" }, { filter: g === "none" ? null : g, off: o.off });
  const I = K.C.anim.intensity ?? 1, mo = o.motion || X.p.motion || "zoom";
  if (mo === "zoom") K.kenBurns(X, m, "scale(1.03)", `scale(${(1.03 + 0.1 * I).toFixed(3)})`);
  else if (mo === "drift") K.kenBurns(X, m, "scale(1.12) translateX(-2%)", "scale(1.12) translateX(2%)");
  else m.el.style.transform = "scale(1.02)";
  return m;
};
k.full = (X, K, parent, slot = 0, o = {}) => k.media(X, K, parent, slot, { x: 0, y: 0, w: X.W, h: X.H }, o);
k.vignette = (X, K, parent, extra = 0) => {
  const v = Math.min(1, K.C.look.vignette + extra);
  if (v > 0) K.div(parent, "lay", { background: `radial-gradient(ellipse 80% 75% at 50% 50%, transparent 35%, rgba(0,0,0,${v}) 100%)` });
};
/* palabra gigante en contorno verde que se desplaza detrás */
k.giant = (X, K, parent, text, o = {}) => {
  const t = String(text || "").toUpperCase();
  if (!t) return null;
  const fs = (o.size ?? 0.98) * X.H;
  const g = K.tx(parent, t, { canvas: true, cls: "dp", fs, x: X.W * (o.x ?? 0.5), y: X.H * (o.y ?? 0.5), ax: 0.5, ay: 0.5, color: K.P.green, stroke: true, swPx: Math.max(2, 2.6 * X.u) });
  g.box.style.opacity = String(o.opacity ?? K.C.look.giantOpacity);
  const sp = (o.speed ?? 0.05) * X.W * (K.C.anim.intensity ?? 1), dir = o.dir ?? 1;
  X.T(g.el, "transform", `translateX(${(dir * sp * X.dur / 2).toFixed(1)}px)`).to(0, X.dur + 0.6, `translateX(${(-dir * sp * X.dur / 2).toFixed(1)}px)`);
  return g;
};
/* rectángulo del video enmarcado según formato; scale = tamaño relativo, side = center|left|right */
k.frameRect = (X, scale = 1, side = "center") => {
  const port = X.W < X.H;
  const w = (port ? 0.88 : 0.62) * X.W * scale, h = Math.min((port ? 0.4 : 0.62) * X.H * scale, w * 9 / 16 * (port ? 1.25 : 1));
  const x = side === "left" ? 0.06 * X.W : side === "right" ? 0.94 * X.W - w : (X.W - w) / 2;
  return { x, y: (X.H - h) / 2, w, h };
};
/* video enmarcado con sombra; entra escalando desde 1.08 */
k.frame = (X, K, parent, slot, rect, o = {}) => {
  const box = K.div(parent, "patch", { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px", overflow: "hidden",
    boxShadow: `0 ${18 * X.u}px ${60 * X.u}px rgba(0,0,0,${K.C.look.frameShadow})`, transformOrigin: "50% 50%" });
  const m = k.media(X, K, box, slot, { x: 0, y: 0, w: rect.w, h: rect.h }, o);
  X.T(box, "transform", `scale(${o.from ?? 1.1})`).to(o.t0 ?? 0, 0.45, "scale(1)", K.EASE_OUT);
  X.T(box, "opacity", "0").to(o.t0 ?? 0, 0.15, "1");
  if (K.C.look.accents > 0 && o.square !== false) {
    const s = 14 * X.u, q = K.div(box, "patch", { left: 12 * X.u + "px", top: 12 * X.u + "px", width: s * 1.4 + "px", height: s + "px", background: K.P.green });
    X.T(q, "opacity", "0").to((o.t0 ?? 0) + 0.3, 0.1, "1");
  }
  return { box, m };
};
/* medidor verde segmentado (horizontal o vertical) que se llena */
k.meter = (X, K, parent, x, y, o = {}) => {
  if (K.C.look.accents <= 0) return;
  const n = o.n ?? 10, vert = !!o.vertical, u = X.u, len = (o.len ?? 120) * u, th = (o.th ?? 5) * u, gap = 2 * u;
  const seg = (len - gap * (n - 1)) / n;
  for (let i = 0; i < n; i++) {
    const css = vert ? { left: x + "px", top: y - (i + 1) * (seg + gap) + "px", width: th + "px", height: seg + "px" } : { left: x + i * (seg + gap) + "px", top: y + "px", width: seg + "px", height: th + "px" };
    const s = K.div(parent, "patch", { ...css, background: K.P.green, opacity: 0.25 });
    X.T(s, "opacity", "0.25").to((o.t0 ?? 0.2) + i * 0.05, 0.08, "1");
  }
};
/* esquinas verdes en L alrededor de un rectángulo */
k.brackets = (X, K, parent, r, t0 = 0.2) => {
  if (K.C.look.accents <= 0) return;
  const L = 34 * X.u, th = Math.max(2, 3 * X.u), g = K.div(parent, "lay");
  for (const [cx, cy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const x = r.x + cx * r.w, y = r.y + cy * r.h;
    K.div(g, "patch", { left: (cx ? x - L : x) + "px", top: (cy ? y - th : y) + "px", width: L + "px", height: th + "px", background: K.P.green });
    K.div(g, "patch", { left: (cx ? x - th : x) + "px", top: (cy ? y - L : y) + "px", width: th + "px", height: L + "px", background: K.P.green });
  }
  X.T(g, "opacity", "0").to(t0, 0.1, "1").to(t0 + 0.15, 0.05, "0.3").to(t0 + 0.22, 0.05, "1");
  X.T(g, "transform", "scale(1.06)").to(t0, 0.4, "scale(1)", K.EASE_OUT);
};
/* texto calado: el medio se ve solo dentro de las letras (máscara del texto rasterizado) */
k.knock = (X, K, parent, text, slot, o = {}) => {
  const t = String(text || "").toUpperCase();
  const fs = o.fs, cv = K.canvasText(t, { cls: "dp", fs, color: "#fff" });
  const w = parseFloat(cv.style.width), h = parseFloat(cv.style.height);
  const box = K.div(parent, "patch", { left: (o.x ?? X.W / 2) - w / 2 + "px", top: (o.y ?? X.H / 2) - h / 2 + "px", width: w + "px", height: h + "px", overflow: "hidden",
    webkitMaskImage: `url(${cv.toDataURL()})`, maskImage: `url(${cv.toDataURL()})`, webkitMaskSize: "100% 100%", maskSize: "100% 100%", transformOrigin: "50% 50%" });
  k.media(X, K, box, slot, { x: -((X.W - w) / 2), y: -((X.H - h) / 2), w: X.W, h: X.H }, { grade: o.grade ?? "none", motion: o.motion });
  return { box, w, h };
};
/* fondo estándar negro (+ palabra gigante) */
k.black = (X, K) => { X.L.style.background = K.P.ink; return X.L; };

/* rótulos fijos: esquina superior derecha (brand.corner) y pie (brand.footer) */
R.hud = (X, K) => {
  const { W, H, u } = X, BR = K.BR;
  const lay = K.div(X.root, "lay", { zIndex: 50, pointerEvents: "none" });
  const fs = Math.max(8, 9 * u);
  if (BR.corner) K.tx(lay, BR.corner.toUpperCase(), { x: W - 22 * u, y: 24 * u, ax: 1, fs, cls: "lb", ls: 0.08, color: K.P.cream });
  if (BR.footer) K.tx(lay, BR.footer, { x: W / 2, y: H - 22 * u, ax: 0.5, fs: fs * 0.95, cls: "lb", ls: 0.14, color: K.P.cream });
};

/* respaldo: dibuja otra escena con SUS valores por defecto (los del slot actual que coincidan se conservan) */
k.fallback = (type, sc, X, K) => {
  const d = {};
  for (const [key, s] of Object.entries(R.scenes[type].params || {})) d[key] = s.def;
  for (const key of Object.keys(d)) if (key in (sc.slot || {})) d[key] = X.p[key];
  X.p = d;
  return R.scenes[type].render(sc, X, K);
};

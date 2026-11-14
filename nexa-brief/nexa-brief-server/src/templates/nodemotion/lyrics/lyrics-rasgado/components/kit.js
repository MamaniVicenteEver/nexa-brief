/* Lyrics Rasgado · kit visual compartido por intro, escenas y outros.
   Lenguaje de la referencia: hojas de papel (gris claro, lima, carbón) que se
   rasgan unas sobre otras, tres voces tipográficas (condensada alta, extendida
   muy negra, fina/contorno), cada palabra entra al tiempo en que se canta,
   garabatos de marcador (X, triángulos, círculos, rayas, palotes) y pincelada
   lima detrás de la palabra fuerte. Un hueco de medio (video/imagen) en B/N
   con acento lima para las escenas con fondo "media".
   Funciones (X, K, ...): X = escena (W, H, u, r, T, dur, p, sc), K = herramientas. */
const R = window.NexaPromo_lyrics_rasgado;
const k = R.kit, S = R.S;

R.meta = {
  mode: "lyrics",
  fallback: "build",
  textIn: "mask",
  hud: false,
  bgs: ["paper", "lime", "ink", "media"],
  look: {
    doodles: S.num(0, 2, 1),       /* cantidad de garabatos (0 = sin garabatos) */
    tornEdges: S.num(0, 1, 0.7),   /* probabilidad de franja rasgada de otro color en el borde */
    tilt: S.num(0, 2, 1),          /* inclinación/perspectiva de los bloques de texto */
    paperGrain: S.num(0, 1, 0.5),  /* textura del papel */
    mediaLime: S.num(0, 1, 0.55),  /* acento lima sobre el medio en B/N */
  },
};

/* familias configurables: fonts.condensed / fonts.wide / fonts.thin (deben venir en fonts.googleUrl) */
for (const [key, v] of [["condensed", "--fC"], ["wide", "--fW"], ["thin", "--fT"]])
  if (R.C?.fonts?.[key]) document.documentElement.style.setProperty(v, `"${String(R.C.fonts[key]).replace(/["\\]/g, "")}"`);
const U = s => String(s).toUpperCase();
k.U = U;
k.J = ws => ws.map(w => w.text).join(" ");
k.hero = ws => { let b = 0, bs = -1; ws.forEach((w, i) => { const s = (/^(a|an|the|and|or|of|to|in|on|i|me|my|you|it|is|el|la|los|las|un|una|y|o|de|en|que|mi|tu|yo|es|lo|se)$/i.test(w.text) ? 0 : 10) + w.text.length; if (s > bs) { bs = s; b = i; } }); return b; };
k.colorOn = (K, bg) => ({ paper: K.P.ink, lime: K.P.ink, ink: K.P.paper, media: K.P.paper }[bg] || K.P.ink);
k.accentOn = (K, bg) => ({ paper: K.P.lime, lime: K.P.ink, ink: K.P.lime, media: K.P.lime }[bg] || K.P.lime);

/* ---------------- papel ---------------- */
let FIBER = null;
function fiberTile(K) {
  if (FIBER) return FIBER;
  const rnd = K.mulberry32(911), cv = document.createElement("canvas"); cv.width = cv.height = 256;
  const cx = cv.getContext("2d");
  for (let i = 0; i < 2600; i++) { const v = rnd() < 0.5 ? 0 : 255; cx.fillStyle = `rgba(${v},${v},${v},${0.03 + rnd() * 0.06})`; cx.fillRect(rnd() * 256, rnd() * 256, 1 + rnd() * 1.5, 1 + rnd() * 1.5); }
  for (let i = 0; i < 60; i++) { cx.strokeStyle = `rgba(255,255,255,${0.05 + rnd() * 0.08})`; cx.lineWidth = 0.6; cx.beginPath(); const x = rnd() * 256, y = rnd() * 256; cx.moveTo(x, y); cx.quadraticCurveTo(x + (rnd() - 0.5) * 30, y + (rnd() - 0.5) * 30, x + (rnd() - 0.5) * 50, y + (rnd() - 0.5) * 50); cx.stroke(); }
  return (FIBER = `url(${cv.toDataURL()})`);
}
/* borde rasgado: polígono irregular (amp = profundidad) + reborde blanco de fibra */
k.tearPath = (w, amp, r, n = 0) => {
  const pts = [], steps = Math.max(12, Math.ceil(w / 18) + n);
  for (let i = 0; i <= steps; i++) pts.push([i / steps * w, amp * (0.25 + r() * 0.75) + (r() < 0.12 ? amp * 0.6 : 0)]);
  return pts;
};
/* franja rasgada horizontal: side "top" (cuelga desde arriba) o "bottom" (sube desde abajo) */
k.tornBand = (X, K, parent, side, color, h, o = {}) => {
  const { W, u, r } = X, amp = (o.amp ?? 0.35) * h, pts = k.tearPath(W, amp, r);
  const poly = (off) => side === "top"
    ? `polygon(0px 0px, ${W}px 0px, ${pts.slice().reverse().map(([x, y]) => `${x.toFixed(1)}px ${(h - y + off).toFixed(1)}px`).join(", ")})`
    : `polygon(${pts.map(([x, y]) => `${x.toFixed(1)}px ${(y - off).toFixed(1)}px`).join(", ")}, ${W}px ${h}px, 0px ${h}px)`;
  const top = side === "top" ? 0 : X.H - h;
  const g = K.div(parent, "patch", { left: "0px", top: top + "px", width: W + "px", height: h + "px" });
  if (o.rim !== false) K.div(g, "lay", { background: "#F4F2EC", clipPath: poly(3 * u), opacity: 0.92 });
  K.div(g, "lay", { background: color, clipPath: poly(0), backgroundImage: fiberTile(K) });
  return g;
};
/* fondo de la escena según slot.bg (paper | lime | ink | media) */
k.bg = (X, K, o = {}) => {
  const L = X.L, bg = o.bg || X.sc.slot.bg || "paper";
  const base = { paper: K.P.paper, lime: K.P.lime, ink: K.P.ink, media: K.P.ink }[bg] || K.P.paper;
  L.style.background = base;
  if (bg === "media") k.media(X, K, L, 0);
  const tex = K.div(L, "lay", { backgroundImage: fiberTile(K), opacity: String(K.C.look.paperGrain * (bg === "media" ? 0.4 : 1)) });
  tex.style.mixBlendMode = bg === "ink" || bg === "media" ? "screen" : "multiply";
  K.div(L, "lay", { background: "radial-gradient(ellipse 80% 80% at 50% 50%, transparent 55%, rgba(0,0,0,0.18) 100%)" });
  /* restos de la hoja anterior: franja rasgada arriba o abajo con otro color */
  if (o.bands !== false && X.r() < K.C.look.tornEdges) {
    const others = ["paper", "lime", "ink"].filter(b => b !== bg), c = others[Math.floor(X.r() * others.length)];
    const col = { paper: K.P.paper, lime: K.P.lime, ink: K.P.ink }[c];
    k.tornBand(X, K, L, X.r() < 0.5 ? "top" : "bottom", col, (0.08 + X.r() * 0.1) * X.H);
  }
  return { L, bg };
};
/* medio en B/N con acento lima (grade "mono" pregradado + capa de color) */
k.media = (X, K, parent, slot, rect) => {
  const R0 = rect || { x: 0, y: 0, w: X.W, h: X.H };
  const m = K.mbox(X, parent, slot, { left: R0.x + "px", top: R0.y + "px", width: R0.w + "px", height: R0.h + "px" }, { filter: "mono" });
  K.kenBurns(X, m, "scale(1.06)", "scale(1.14)");
  const a = K.C.look.mediaLime;
  if (a > 0) {
    const cx = 20 + X.r() * 60, cy = 20 + X.r() * 60;
    K.div(m.box, "lay", { background: `radial-gradient(ellipse 60% 70% at ${cx}% ${cy}%, ${K.P.lime} 0%, transparent 70%)`, mixBlendMode: "color", opacity: String(a) });
  }
  K.div(m.box, "lay", { background: "rgba(0,0,0,0.35)" });
  return m;
};

/* ---------------- texto ---------------- */
/* entrada de una palabra: mask (sube dentro de su caja) · stamp (golpe) · type · fade · cut */
k.enter = (X, K, el, mode, t) => {
  if (mode === "cut") { K.hide(X, el, t); return; }
  if (mode === "mask") { el.style.clipPath = "inset(-6% -4% -2% -4%)"; X.T(el, "transform", "translateY(105%)").to(t, 0.22, "translateY(0%)", K.EASE_OUT); K.hide(X, el, t); return; }
  if (mode === "stamp") { X.T(el, "transform", "scale(1.35)").to(t, 0.16, "scale(1)", K.EASE_OUT); K.hide(X, el, t); return; }
  if (mode === "type") { K.hide(X, el, t); return; }
  X.T(el, "opacity", "0").to(t, 0.18, "1");
};
/* renglón con palabras que entran a su tiempo. o = {cls, fs, x, y, ax, color, stroke, ls, mode, sizes[]} */
k.line = (X, K, parent, ws, o) => {
  const t = K.tx(parent, U(k.J(ws)), { cls: o.cls || "fc", fs: o.fs, x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, color: o.color, ls: o.ls, split: "words" });
  const mode = o.mode || X.p.textIn || K.C.anim.textIn;
  t.words.forEach((s, i) => {
    if (o.sizes && o.sizes[i]) s.style.fontSize = (o.sizes[i] * 100).toFixed(1) + "%";
    if (o.stroke || (o.strokeIdx && o.strokeIdx.includes(i))) { s.style.color = "transparent"; s.style.webkitTextStroke = `${Math.max(1.2, o.fs * 0.016)}px ${o.strokeColor || o.color}`; }
    if (o.wordCls && o.wordCls[i]) s.className = "wd " + o.wordCls[i];
    k.enter(X, K, s, mode, Math.max(0.02, ws[i]?.rt ?? 0.05));
  });
  t.width = K.textW(U(k.J(ws)), o.cls || "fc", o.ls || 0, o.fs);
  return t;
};
k.fit = (K, text, cls, maxW, maxH, ls = 0) => K.fit(U(text) || "A", cls, ls, maxW, maxH);
/* inclinación del bloque (perspectiva de la referencia) */
k.tilt = (X, K, el, deg) => {
  const a = (deg ?? (X.r() - 0.5) * 8) * K.C.look.tilt;
  el.style.transform = `${el.style.transform || ""} rotate(${a.toFixed(2)}deg) skewX(${(-a * 0.6).toFixed(2)}deg)`;
};
/* caja real de un elemento (para garabatos y pinceladas): se mide al montar */
k.boxOf = (X, el) => { const r = el.getBoundingClientRect(), R0 = X.root.getBoundingClientRect(); return { x: r.left - R0.left, y: r.top - R0.top, w: r.width, h: r.height }; };
k.later = (X, el, fn) => X.pend.push(() => fn(k.boxOf(X, el)));

/* ---------------- marcador: garabatos y pincelada ---------------- */
const SVGNS = "http://www.w3.org/2000/svg";
if (!document.getElementById("rasgado-marker")) {
  const s = document.createElementNS(SVGNS, "svg"); s.setAttribute("width", "0"); s.setAttribute("height", "0"); s.style.position = "absolute";
  s.innerHTML = `<defs><filter id="rasgado-marker"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.5"/></filter>
    <filter id="rasgado-brush" x="-5%" y="-30%" width="110%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.04 0.9" numOctaves="2" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="16"/></filter></defs>`;
  document.body.appendChild(s);
}
/* kinds: x · tri · circle (alrededor de b) · underline · tally · hatch · cross · scribble · arrow */
k.doodle = (X, K, parent, kind, b, t0, color, d = 0.32) => {
  const { W, H, u, r } = X, j = a => (r() - 0.5) * a;
  const s = document.createElementNS(SVGNS, "svg");
  s.setAttribute("width", W); s.setAttribute("height", H); s.setAttribute("viewBox", `0 0 ${W} ${H}`);
  s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;pointer-events:none";
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, sz = (b.s || 22) * u, P = [];
  if (kind === "x") P.push(`M${cx - sz} ${cy - sz + j(6 * u)} L${cx + sz} ${cy + sz}`, `M${cx + sz + j(6 * u)} ${cy - sz} L${cx - sz} ${cy + sz + j(6 * u)}`);
  else if (kind === "tri") P.push(`M${cx - sz} ${cy + sz * 0.7} L${cx + j(6 * u)} ${cy - sz} L${cx + sz} ${cy + sz * 0.6} Z`);
  else if (kind === "circle") { const pts = []; for (let i = 0; i <= 44; i++) { const a = -0.5 + i / 44 * Math.PI * 2.18; pts.push(`${(cx + Math.cos(a) * (b.w * 0.6 + j(6 * u))).toFixed(1)} ${(cy + Math.sin(a) * (b.h * 0.72 + j(5 * u))).toFixed(1)}`); } P.push("M" + pts.join(" L")); }
  else if (kind === "underline") P.push(`M${b.x - 8 * u} ${b.y + b.h * 1.04} Q${cx} ${b.y + b.h * 1.16 + j(8 * u)} ${b.x + b.w + 10 * u} ${b.y + b.h * 0.98}`);
  else if (kind === "tally") for (let i = 0; i < 5; i++) { const x = cx - sz * 1.4 + i * sz * 0.55; P.push(i < 4 ? `M${x} ${cy - sz} L${x + j(5 * u)} ${cy + sz}` : `M${cx - sz * 1.8} ${cy + sz * 0.5} L${cx + sz * 1.2} ${cy - sz * 0.6}`); }
  else if (kind === "hatch") { P.push(`M${cx - sz} ${cy - sz} L${cx + sz} ${cy - sz} L${cx + sz} ${cy + sz} L${cx - sz} ${cy + sz} Z`); for (let i = 1; i < 4; i++) P.push(`M${cx - sz + i * sz * 0.5} ${cy + sz} L${cx - sz} ${cy + sz - i * sz * 0.5}`, `M${cx + sz} ${cy - sz + i * sz * 0.5} L${cx - sz + i * sz * 0.5} ${cy - sz}`); }
  else if (kind === "cross") P.push(`M${cx - sz} ${cy + j(4 * u)} L${cx + sz} ${cy}`, `M${cx} ${cy - sz} L${cx + j(4 * u)} ${cy + sz}`);
  else if (kind === "scribble") { let p = `M${b.x} ${cy}`; for (let i = 1; i <= 8; i++) p += ` L${b.x + b.w * i / 8 + j(10 * u)} ${cy + (i % 2 ? -1 : 1) * b.h * 0.3 + j(6 * u)}`; P.push(p); }
  else if (kind === "arrow") P.push(`M${cx - sz * 1.4} ${cy + sz} L${cx + sz} ${cy - sz}`, `M${cx} ${cy - sz} L${cx + sz} ${cy - sz} L${cx + sz} ${cy}`);
  const sw = Math.max(2.4, 5.5 * u);
  s.innerHTML = P.map(p => `<path d="${p}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1 1" stroke-dashoffset="1"/>`).join("");
  s.style.filter = "url(#rasgado-marker)";
  parent.appendChild(s);
  [...s.querySelectorAll("path")].forEach((p, i) => X.T(p, "strokeDashoffset", "1").to(t0 + i * 0.05, d, "0", K.EASE_OUT));
  return s;
};
/* garabatos sueltos en zonas libres (look.doodles = cantidad) */
k.scatter = (X, K, parent, n, color, avoid) => {
  const N = Math.round(n * K.C.look.doodles), kinds = ["x", "tri", "cross", "tally", "hatch", "x", "tri", "arrow"];
  for (let i = 0; i < N; i++) {
    let x, y, tries = 0;
    do { x = X.W * (0.05 + X.r() * 0.9); y = X.H * (0.06 + X.r() * 0.88); tries++; }
    while (avoid && tries < 12 && x > avoid.x - 30 * X.u && x < avoid.x + avoid.w + 30 * X.u && y > avoid.y - 30 * X.u && y < avoid.y + avoid.h + 30 * X.u);
    k.doodle(X, K, parent, kinds[Math.floor(X.r() * kinds.length)], { x, y, w: 0, h: 0, s: 14 + X.r() * 16 }, 0.1 + X.r() * 0.6, color);
  }
};
/* pincelada lima detrás de un elemento (se mide al montar) */
k.brush = (X, K, parent, el, t0, color) => {
  const g = K.div(parent, "lay");
  const bx = el.closest ? el.closest(".bx") : null;
  if (bx && bx.parentNode === parent) parent.insertBefore(g, bx);   /* detrás del texto */
  k.later(X, el, b => {
    const pad = b.h * 0.18, s = document.createElementNS(SVGNS, "svg");
    s.setAttribute("width", X.W); s.setAttribute("height", X.H);
    s.style.cssText = "position:absolute;left:0;top:0;overflow:visible;filter:url(#rasgado-brush)";
    s.innerHTML = `<rect x="${b.x - pad * 1.6}" y="${b.y + b.h * 0.18}" width="${b.w + pad * 3.2}" height="${b.h * 0.7}" fill="${color}"/>`;
    g.appendChild(s);
  });
  X.T(g, "clipPath", "inset(0% 100% 0% 0%)").to(t0, 0.28, "inset(0% 0% 0% 0%)", K.EASE_OUT);
  return g;
};

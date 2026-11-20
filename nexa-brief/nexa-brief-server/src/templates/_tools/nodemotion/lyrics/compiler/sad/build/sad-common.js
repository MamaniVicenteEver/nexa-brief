/* =================== UTILIDADES COMUNES · plantillas tristes ===================
   Compartidas por lyrics-lluvia-gris, lyrics-memoria, lyrics-ceniza y
   lyrics-vacio (se concatenan antes del archivo de escenas de cada una).
   Todo es determinista (Tracks + mulberry32): se busca por tiempo igual que el
   resto de plantillas del generador. Convenciones:
   · sc.words = [{ text, rt }]  (rt = segundo relativo a la escena)
   · la escena dura X.dur; con transition.overlapSec > 0 la escena sigue viva
     hasta X.dur + overlap DEBAJO de la siguiente → "leave*" anima esa cola. */
const P = C.palette;
const U = s => String(s).toUpperCase();
const J = ws => ws.map(w => w.text).join(" ");
const OV = () => Math.max(0.01, C.transition?.overlapSec ?? 0.5);
const show = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };
function rows(ws, n) {
  if (n <= 1 || ws.length <= 1) return [ws];
  const total = J(ws).length, out = [[]]; let acc = 0;
  for (const w of ws) {
    if (out[out.length - 1].length && acc >= total * out.length / n && out.length < n) out.push([]);
    out[out.length - 1].push(w); acc += w.text.length + 1;
  }
  return out.filter(r => r.length);
}
const tcase = (s, cls) => /\b(ser|it|hw|tw)\b/.test(cls) ? String(s) : U(s);

/* ---------------- fondos ---------------- */
/* metraje con movimiento lento (zoom + deriva) y grado; sin config.render.kbVideo
   el video queda fijo y solo se mueve el contenedor (más barato en vivo) */
function footage(X, L, k, grade, o = {}) {
  const { W, H, r } = X;
  const box = div(L, "lay");
  const m = mbox(X, box, k, { left: 0, top: 0, width: W + "px", height: H + "px" }, { filter: grade, off: o.off ?? r() * 3 });
  const z0 = o.from ?? 1.06, z1 = o.to ?? 1.16, dx = (r() - 0.5) * 3, dy = (r() - 0.5) * 2;
  X.T(box, "transform", `scale(${z0}) translate(0%, 0%)`).to(0, X.dur + OV(), `scale(${z1}) translate(${dx.toFixed(2)}%, ${dy.toFixed(2)}%)`);
  if (o.opacity != null) box.style.opacity = o.opacity;
  return { box, m };
}
function vignette(L, a = 0.75, inner = 40) {
  return div(L, "lay", { background: `radial-gradient(ellipse at 50% 50%, transparent ${inner}%, rgba(0,0,0,${a}) 100%)`, pointerEvents: "none" });
}
function tint(L, color, op = 0.3, blend = "multiply") {
  return div(L, "lay", { background: color, opacity: op, mixBlendMode: blend, pointerEvents: "none" });
}
/* niebla: manchas suaves que derivan lento */
function fog(X, L, n = 3, a = 0.18, color = "220,225,230") {
  const { W, r } = X;
  for (let i = 0; i < n; i++) {
    const f = div(L, "lay", { background: `radial-gradient(ellipse ${40 + r() * 30}% ${30 + r() * 25}% at ${20 + r() * 60}% ${25 + r() * 50}%, rgba(${color},${(a * (0.6 + r() * 0.6)).toFixed(3)}) 0%, transparent 70%)` });
    X.T(f, "transform", "translateX(0px)").to(0, X.dur + OV(), `translateX(${((r() - 0.5) * 0.18 * W).toFixed(1)}px)`);
  }
}
function letterbox(X, L, h = 0.1) {
  for (const top of [true, false]) div(L, "patch", { left: 0, [top ? "top" : "bottom"]: 0, width: X.W + "px", height: h * X.H + "px", background: "#000", zIndex: 30 });
}

/* ---------------- partículas (deterministas) ---------------- */
/* lluvia: trazos finos que caen en bucle; dur de caída corto → se repiten */
function rainFx(X, L, n = 60, o = {}) {
  const { W, H, u, r } = X, T = X.dur + OV(), g = div(L, "lay", { pointerEvents: "none", transform: `rotate(${o.angle ?? 8}deg) scale(1.2)` });
  for (let i = 0; i < n; i++) {
    const len = (18 + r() * 50) * u, sp = (0.45 + r() * 0.5) * (o.speed ?? 1), x = r() * W;
    const d = div(g, "patch", { left: x + "px", top: -len + "px", width: Math.max(1, (0.8 + r() * 0.9) * u) + "px", height: len + "px",
      background: `linear-gradient(transparent, rgba(${o.color || "220,230,240"},${(0.25 + r() * 0.4).toFixed(2)}))` });
    const per = (H + len) / (H * 1.6) * sp, ph = r() * per, tr = X.T(d, "transform", "translateY(0px)");
    for (let t = -ph; t < T; t += per) { tr.set(Math.max(0, t), "translateY(0px)"); tr.to(Math.max(0, t), per * 0.999, `translateY(${H + 2 * len}px)`); }
  }
  return g;
}
/* partículas genéricas que flotan: dir -1 = suben (brasas), +1 = caen (ceniza, nieve) */
function motes(X, L, n, o = {}) {
  const { W, H, u, r } = X, T = X.dur + OV(), dir = o.dir ?? 1, g = div(L, "lay", { pointerEvents: "none" });
  for (let i = 0; i < n; i++) {
    const s = (o.size ?? 3) * (0.5 + r()) * u, x = r() * W, y = r() * H, sway = (r() - 0.5) * (o.sway ?? 60) * u;
    const c = Array.isArray(o.color) ? o.color[Math.floor(r() * o.color.length)] : (o.color || "rgba(220,220,220,0.7)");
    const d = div(g, "patch", { left: x + "px", top: y + "px", width: s + "px", height: s * (o.stretch ?? 1) + "px", borderRadius: o.square ? "0" : "50%", background: c,
      boxShadow: o.glow ? `0 0 ${(s * 3).toFixed(1)}px ${c}` : "none" });
    const dist = dir * (o.dist ?? 0.6) * H * (0.5 + r());
    X.T(d, "transform", "translate(0px, 0px)").to(0, T, `translate(${sway.toFixed(1)}px, ${dist.toFixed(1)}px)`);
    if (o.flicker) { const tr = X.T(d, "opacity", "1"); for (let t = r(); t < T; t += 0.3 + r() * 0.8) tr.to(t, 0.2, (0.2 + r() * 0.8).toFixed(2)); }
  }
  return g;
}

/* ---------------- texto ---------------- */
function word(X, L, s, o) {
  return tx(L, tcase(s, o.cls || ""), { cls: o.cls, fs: o.fs, x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, color: o.color, ls: o.ls, split: o.split, stroke: o.stroke, sw: o.sw, rot: o.rot });
}
/* renglón con palabras en su tiempo (cada palabra entra con el estilo `mode`) */
function line(X, L, ws, o, mode = "blur") {
  const t = word(X, L, J(ws), { ...o, split: "words" });
  t.words.forEach((s, i) => reveal(X, s, Math.max(0.02, ws[i]?.rt ?? 0), mode, o.revealSec));
  return t;
}
/* renglón ANIDADO: span por palabra (para el revelado) que contiene span por letra
   (para destruir: derretir, arder, desmoronar…) → nunca dos pistas pelean por la
   misma propiedad del mismo elemento */
function lineNested(X, L, ws, o, mode = "blur") {
  const t = tx(L, "", { cls: o.cls, fs: o.fs, x: o.x, y: o.y, ax: o.ax ?? 0.5, ay: o.ay ?? 0.5, color: o.color, ls: o.ls });
  const words = [], chars = [];
  ws.forEach((w, i) => {
    if (i) t.el.appendChild(doc.createTextNode(" "));
    const sw = doc.createElement("span"); sw.className = "wd"; t.el.appendChild(sw); words.push(sw);
    for (const c of tcase(w.text, o.cls || "")) { const ch = doc.createElement("span"); ch.className = "ch"; ch.textContent = c; ch.wi = i; sw.appendChild(ch); chars.push(ch); }
    reveal(X, sw, Math.max(0.02, w.rt ?? 0), mode, o.revealSec);
  });
  return { ...t, words, chars };
}
/* estilos de entrada de una palabra / letra */
function reveal(X, el, at, mode = "blur", d) {
  if (mode === "blur") {
    d = d ?? 0.7;
    X.T(el, "opacity", "0").to(at, d, "1", EASE_OUT);
    X.T(el, "filter", "blur(10px)").to(at, d, "blur(0px)", EASE_OUT);
    X.T(el, "transform", "translateY(18%)").to(at, d, "translateY(0%)", EASE_OUT);
  } else if (mode === "fade") {
    X.T(el, "opacity", "0").to(at, d ?? 0.6, "1", EASE_OUT);
  } else if (mode === "rise") {
    X.T(el, "opacity", "0").to(at, d ?? 0.5, "1", EASE_OUT);
    X.T(el, "transform", "translateY(60%)").to(at, d ?? 0.5, "translateY(0%)", EASE_OUT);
  } else if (mode === "drop") {      /* cae como una gota y se asienta */
    X.T(el, "opacity", "0").to(at, 0.12, "1");
    X.T(el, "transform", "translateY(-140%) scaleY(1.6)").to(at, d ?? 0.38, "translateY(0%) scaleY(1)", "cubic-bezier(.5,0,.85,.6)");
  } else if (mode === "type") {
    show(X, el, at);
  } else if (mode === "flicker") {   /* se enciende titilando (vela, proyector) */
    X.T(el, "opacity", "0", true).set(at, "0.6").set(at + 0.05, "0.1").set(at + 0.1, "0.9").set(at + 0.16, "0.3").set(at + 0.22, "1");
  } else if (mode === "ember") {     /* aparece al rojo y se enfría a su color */
    X.T(el, "opacity", "0").to(at, 0.35, "1", EASE_OUT);
    X.T(el, "textShadow", `0 0 18px rgba(255,120,40,0.95)`).to(at, 1.4, `0 0 0px rgba(255,120,40,0)`, EASE_OUT);
  }
}
/* letras que se derriten hacia abajo (gotean) desde t0, escalonadas */
function drip(X, chars, t0, span = 1.2) {
  chars.forEach((c, i) => {
    if (c.textContent === " ") return;
    const at = t0 + X.r() * span, d = 0.9 + X.r() * 1.1;
    c.style.transformOrigin = "50% 0%";
    X.T(c, "transform", "translateY(0%) scaleY(1)").to(at, d, `translateY(${(60 + X.r() * 140).toFixed(0)}%) scaleY(${(1.8 + X.r() * 1.6).toFixed(2)})`, EASE_IN);
    X.T(c, "opacity", "1").to(at + d * 0.4, d * 0.6, "0");
    X.T(c, "filter", "blur(0px)").to(at, d, "blur(3px)");
  });
}
/* letras que se desmoronan con gravedad y giro */
function crumble(X, chars, t0, span = 0.9) {
  chars.forEach(c => {
    if (c.textContent === " ") return;
    const at = t0 + X.r() * span, rot = (X.r() - 0.5) * 140, dx = (X.r() - 0.5) * 60;
    X.T(c, "transform", "translate(0%, 0%) rotate(0deg)").to(at, 1.1, `translate(${dx.toFixed(0)}%, ${(260 + X.r() * 200).toFixed(0)}%) rotate(${rot.toFixed(0)}deg)`, "cubic-bezier(.55,0,.9,.45)");
    X.T(c, "opacity", "1").to(at + 0.6, 0.5, "0");
  });
}
/* letras que se vuelven humo: suben, se agrandan, se desenfocan */
function smokeOut(X, chars, t0, span = 0.8) {
  chars.forEach(c => {
    if (c.textContent === " ") return;
    const at = t0 + X.r() * span, d = 1.2 + X.r() * 0.8;
    X.T(c, "transform", "translate(0%, 0%) scale(1)").to(at, d, `translate(${((X.r() - 0.5) * 80).toFixed(0)}%, ${(-90 - X.r() * 120).toFixed(0)}%) scale(${(1.3 + X.r() * 0.8).toFixed(2)})`, EASE_OUT);
    X.T(c, "filter", "blur(0px)").to(at, d, `blur(${(8 + X.r() * 10).toFixed(0)}px)`, EASE_OUT);
    X.T(c, "opacity", "1").to(at, d, "0", EASE_IN);
  });
}
/* letras que arden: se ponen al rojo y estallan en ceniza (fragmentos que suben) */
function burnChars(X, L, t, t0, span = 0.9, o = {}) {
  const host = L.getBoundingClientRect ? L : null;
  t.chars.forEach(c => {
    if (c.textContent === " ") return;
    const at = t0 + X.r() * span;
    X.T(c, "color", o.color || P.bone, true).set(at, o.hot || "#FFB070").set(at + 0.18, o.ember || "#E2683A");
    X.T(c, "textShadow", "0 0 0px rgba(255,110,30,0)").to(at, 0.25, "0 0 22px rgba(255,110,30,0.95)").to(at + 0.3, 0.5, "0 0 4px rgba(255,80,20,0.4)");
    X.T(c, "opacity", "1").to(at + 0.35, 0.45, "0");
    X.T(c, "filter", "blur(0px)").to(at + 0.3, 0.5, "blur(4px)");
  });
  /* fragmentos: puntos cálidos que nacen sobre la línea y suben */
  later(X, t, b => {
    const n = Math.min(70, Math.round(b.w / (6 * X.u)));
    for (let i = 0; i < n; i++) {
      const x = b.x + X.r() * b.w, y = b.y + X.r() * b.h, s = (1.5 + X.r() * 3) * X.u, at = t0 + X.r() * span + 0.25;
      const d = div(X.root, "patch", { left: x + "px", top: y + "px", width: s + "px", height: s + "px", background: X.r() < 0.5 ? "#F2A15C" : "#9A948E", zIndex: 20, borderRadius: X.r() < 0.5 ? "50%" : "0", visibility: "hidden" });
      show(X, d, at);
      X.T(d, "transform", "translate(0px, 0px) rotate(0deg)").to(at, 1.6 + X.r(), `translate(${((X.r() - 0.5) * 120 * X.u).toFixed(0)}px, ${(-(80 + X.r() * 220) * X.u).toFixed(0)}px) rotate(${(X.r() * 360).toFixed(0)}deg)`, EASE_OUT);
      X.T(d, "opacity", "1").to(at + 0.4, 1.2, "0");
    }
  });
}
/* tecleado y borrado (con cursor): los recuerdos que se borran */
function typeErase(X, t, at, eraseAt, o = {}) {
  const ch = t.chars, n = ch.length, step = o.step ?? Math.min(0.06, 1.2 / Math.max(1, n));
  ch.forEach((c, i) => {
    const vt = X.T(c, "visibility", "hidden", true).set(at + i * step, "visible");
    if (eraseAt != null) vt.set(eraseAt + (n - 1 - i) * (step * 0.6), "hidden");
  });
  if (o.cursor !== false) {
    const cur = doc.createElement("span"); cur.className = "ch"; cur.textContent = o.cursorChar || "▌"; cur.style.color = o.cursorColor || "inherit";
    t.el.appendChild(cur);
    const bl = X.T(cur, "opacity", "1", true);
    for (let k = 0; k < (X.dur + OV()) / 0.5; k++) bl.set(k * 0.5, k % 2 ? "0" : "1");
  }
}
/* medir caja de un texto ya maquetado (core.js monta la escena oculta un instante) */
const box = (X, t) => { const r = t.el.getBoundingClientRect(), R = X.root.getBoundingClientRect(); return { x: r.left - R.left, y: r.top - R.top, w: r.width, h: r.height }; };
function later(X, t, fn) { X.pend.push(() => fn(box(X, t))); }

/* salida en la cola de la escena (debajo de la siguiente durante el solapamiento).
   Se aplica a la CAJA (t.box): solo toca filter / opacity, nunca su transform. */
function leave(X, el, kind = "blur") {
  const a = Math.max(0.05, X.dur - 0.2), d = OV() + 0.2;
  if (kind === "blur") { X.T(el, "filter", "blur(0px)").to(a, d, "blur(14px)", EASE_IN); X.T(el, "opacity", "1").to(a, d, "0", EASE_IN); }
  else if (kind === "fade") X.T(el, "opacity", "1").to(a, d, "0", EASE_IN);
}
/* pulso de latido: el bloque late suave (sad heartbeat) */
function heartbeat(X, el, every = 1.6, amp = 0.025) {
  const tr = X.T(el, "transform", "scale(1)");
  for (let t = 0.3; t < X.dur; t += every) { tr.to(t, 0.12, `scale(${1 + amp})`, EASE_OUT); tr.to(t + 0.12, 0.18, "scale(1)", EASE_IN); tr.to(t + 0.32, 0.12, `scale(${1 + amp * 0.6})`, EASE_OUT); tr.to(t + 0.44, 0.3, "scale(1)", EASE_IN); }
}

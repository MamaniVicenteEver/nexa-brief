/* Lyrics Hologram Worlds · escena «compose».
   Una escena se describe por datos: fondo (mundo) + lista de elementos con posición
   normalizada (x, y, w, h = fracciones del cuadro), relleno, entrada y tiempo (at, en
   segundos desde el inicio de la escena). Nada de un video concreto queda escrito aquí:
   todo llega en timeline[].p.els. Elementos (k):
     text   {t, f:"c"|"w"|"ko", h, maxw, x, y, ax, ay, fill, c, ls, sw, op, rot, at, to, in, mv:[dx,dy]}
     rep    {t, n, h, x, y, sp, fill, hero, herofill, op, drift, at, to}   filas repetidas
     col    {t, h, x, y, fill, at, to}                                      columna vertical
     box    {x, y, w, h, fill, stroke, op, rot, at, to, in}                 caja o barra
     media  {id, x, y, w, h, look:"sil"|"ink"|"duo", op, at, to, in}
     shape  {s, x, y, w, asp, fill, rot, op, at, to, in}                    forma propia
     orn    {x, y, n, s, c, at}                                             fila de rombos
     lab    {t, rows, xs, op, c, at}                                        rótulos diminutos
     diag   {n, c, ang, op}   ·  dots {c, op, size}  ·  flash {at, d}
   fill: white | ink | holo | out | dim | red | violet | void | gold | <css>
   in:   cut | slide | stamp | glitch | spread | fade | wipeL | wipeR | wipeU | wipeD | pop | rise
   Fondos (bg de la escena): void | holo | red | violet | pale | ice | split | media */
const R = window.NexaPromo_lyrics_hologram_worlds, k = R.kit, S = R.S;

const GOLD = "linear-gradient(135deg,#fff2b0 0%,#f4c534 34%,#b8801c 68%,#ffe07a 100%)";
const FAM = { c: "fc", w: "fw", ko: "fk" };
/* formas propias (polígonos en unidades 0..1); varias subformas → un solo path con evenodd */
const SHAPES = {
  heart: [[[0.5, 1], [0.08, 0.5], [0.04, 0.18], [0.2, 0.0], [0.38, 0.06], [0.5, 0.24], [0.62, 0.06], [0.8, 0.0], [0.96, 0.18], [0.92, 0.5]],
          [[0.5, 0.78], [0.3, 0.46], [0.5, 0.38], [0.7, 0.46]]],
  crest: [[[0.5, 0], [0.67, 0.19], [0.91, 0.07], [0.83, 0.4], [0.96, 0.59], [0.67, 0.65], [0.5, 1], [0.33, 0.65], [0.04, 0.59], [0.17, 0.4], [0.09, 0.07], [0.33, 0.19]]],
  gem: [[[0.25, 0.14], [0.75, 0.14], [0.94, 0.38], [0.5, 1], [0.06, 0.38]]],
  dagger: [[[0.5, 0], [0.62, 0.18], [0.58, 0.72], [0.5, 0.78], [0.42, 0.72], [0.38, 0.18]],
           [[0.5, 0.8], [0.58, 0.86], [0.5, 0.94], [0.42, 0.86]]],
  scales: [[[0.47, 0.02], [0.53, 0.02], [0.53, 0.14], [0.9, 0.2], [0.9, 0.24], [0.53, 0.2], [0.53, 0.92], [0.7, 0.96], [0.3, 0.96], [0.47, 0.92], [0.47, 0.2], [0.1, 0.24], [0.1, 0.2], [0.47, 0.14]],
           [[0.02, 0.62], [0.2, 0.62], [0.22, 0.7], [0.0, 0.7]], [[0.78, 0.62], [0.98, 0.62], [1.0, 0.7], [0.8, 0.7]]],
  trophy: [[[0.26, 0.04], [0.74, 0.04], [0.72, 0.4], [0.6, 0.58], [0.56, 0.7], [0.66, 0.78], [0.66, 0.9], [0.34, 0.9], [0.34, 0.78], [0.44, 0.7], [0.4, 0.58], [0.28, 0.4]],
           [[0.26, 0.12], [0.1, 0.12], [0.1, 0.3], [0.26, 0.4], [0.26, 0.34], [0.16, 0.28], [0.16, 0.18], [0.26, 0.18]],
           [[0.74, 0.12], [0.9, 0.12], [0.9, 0.3], [0.74, 0.4], [0.74, 0.34], [0.84, 0.28], [0.84, 0.18], [0.74, 0.18]],
           [[0.3, 0.92], [0.7, 0.92], [0.7, 1], [0.3, 1]]],
  tag: [[[0.18, 0.02], [0.82, 0.02], [0.96, 0.18], [0.96, 0.98], [0.04, 0.98], [0.04, 0.18]],
        [[0.5, 0.1], [0.58, 0.1], [0.58, 0.18], [0.5, 0.18]]],
  wings: [[[0.5, 0.36], [0.34, 0.14], [0.02, 0.0], [0.2, 0.22], [0.0, 0.34], [0.24, 0.4], [0.06, 0.58], [0.34, 0.54], [0.24, 0.8], [0.5, 0.66]],
          [[0.5, 0.36], [0.66, 0.14], [0.98, 0.0], [0.8, 0.22], [1.0, 0.34], [0.76, 0.4], [0.94, 0.58], [0.66, 0.54], [0.76, 0.8], [0.5, 0.66]]],
};
const pathOf = (poly, w, h) => poly.map(sub => "M" + sub.map(([x, y]) => `${(x * w).toFixed(1)} ${(y * h).toFixed(1)}`).join(" L") + " Z").join(" ");

function worldBg(X, K, name, p) {
  const base = ["ice", "split", "purple", "redflat"].includes(name) ? "void" : name;
  const { L } = k.bg(X, K, { bg: base, labels: false });
  if (name === "ice") {
    L.style.background = "radial-gradient(ellipse 95% 95% at 50% 45%, #F3F3F6 0%, #DCDCE4 100%)";
    X.light = true;
  } else if (name === "purple") {
    L.style.background = "linear-gradient(180deg, #10011E 0%, #2B0457 55%, #460B89 100%)";
  } else if (name === "redflat") {
    L.style.background = "radial-gradient(ellipse 110% 110% at 50% 50%, #EE0A2B 0%, #EA0420 100%)";
  } else if (name === "split") {
    const cut = (p.cut ?? 0.5) * X.W;
    const r = K.div(L, "patch", { left: cut + "px", top: "0px", width: X.W - cut + "px", height: X.H + "px", background: `radial-gradient(ellipse 90% 90% at 40% 45%, ${K.P.red} 0%, ${k.shade(K.P.red, 0.7)} 100%)` });
    X.T(r, "transform", "scaleX(0)").to(0.0, 0.18, "scaleX(1)", K.EASE_OUT);
    r.style.transformOrigin = "100% 50%";
  }
  return L;
}
const fillColor = (K, f) => ({ white: K.P.white, ink: K.P.ink, red: K.P.red, violet: K.P.violet, void: K.P.void, pale: K.P.pale, dark: "#0a0a10" }[f] || f);

/* entrada de un elemento con su caja `box` y el nodo interior `el` */
function enter(X, K, box, el, mode, at, dur = 0.22) {
  const W = X.W, H = X.H;
  if (mode === "wipeL" || mode === "wipeR" || mode === "wipeU" || mode === "wipeD") {
    const from = { wipeL: "inset(0 100% 0 0)", wipeR: "inset(0 0 0 100%)", wipeU: "inset(100% 0 0 0)", wipeD: "inset(0 0 100% 0)" }[mode];
    X.T(el, "clipPath", from).to(at, dur, "inset(-2% -2% -2% -2%)", K.EASE_OUT);
    K.hide(X, box, at); return;
  }
  if (mode === "pop") { X.T(box, "opacity", "0").to(at, 0.12, "1"); X.T(el, "transform", "scale(0.6)").to(at, 0.3, "scale(1)", K.EASE_BACK); return; }
  if (mode === "rise") { X.T(el, "transform", `translateY(${(0.06 * H).toFixed(0)}px)`).to(at, 0.35, "translateY(0px)", K.EASE_OUT); X.T(box, "opacity", "0").to(at, 0.25, "1"); return; }
  k.enter(X, K, el, mode || "cut", at);
}
/* salida: display none desde `to`. No usa visibility porque los hijos con visibility: visible
   explícito (los pone la entrada) seguirían viéndose, y porque dos pistas de visibility se pisan. */
const leave = (X, box, to) => { if (to != null) X.T(box, "display", "", true).set(to, "none"); };
/* movimiento continuo durante la escena: mv = [dx, dy] (fracciones del cuadro), zm = [s0, s1] (escala),
   rv = [r0, r1] (grados). Se aplica a una capa envolvente para no pisar la transformación de entrada. */
const move = (X, K, box, e, at) => {
  if (!e.mv && !e.zm && !e.rv) return;
  const t1 = (e.to ?? X.dur), d = Math.max(0.05, t1 - at);
  const dx = e.mv ? e.mv[0] * X.W : 0, dy = e.mv ? e.mv[1] * X.H : 0;
  const [s0, s1] = e.zm || [1, 1], [r0, r1] = e.rv || [0, 0];
  const base = box.style.transform || "";
  const tf = (x, y, s, r) => `${base} translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) scale(${s.toFixed(4)}) rotate(${r.toFixed(2)}deg)`.trim();
  X.T(box, "transform", tf(0, 0, s0, r0)).to(at, d, tf(dx, dy, s1, r1), e.ease === "out" ? K.EASE_OUT : e.ease === "io" ? K.EASE_IO : undefined);
};
/* tamaño natural de las imágenes propias (lo escribe timeline.py en p.art) */
const ART = {};

/* ======================= movimiento (v3) =======================
   Todo determinista con el reloj del motor. Se usan las propiedades CSS individuales
   translate / scale / rotate (no pisan `transform`, que usan la posición y las entradas).
   kf  [[t, {x, y, s, sx, sy, r, o, e}], ...]  keyframes de la caja (x, y en fracciones del cuadro)
   out {at, m, d}  salida: cut | fade | chars | up | down | left | right | zoom | collapse | glitch | breakup
   jit {a, r, fps, from, to}   temblor escalonado del contenido
   flick {at, d, n}            parpadeo
   marq v                       marquesina horizontal (fracciones del ancho por segundo) */
const rnd = (i, s = 1) => { const v = Math.sin(i * 12.9898 + s * 78.233) * 43758.5453; return v - Math.floor(v); };
const EASES = K => ({ io: K.EASE_IO, out: K.EASE_OUT, in: K.EASE_IN, back: K.EASE_BACK, lin: undefined });
function kfTracks(X, K, box, keys) {
  if (!keys || !keys.length) return;
  keys = keys.slice().sort((a, b) => a[0] - b[0]);
  const st = [], cur = { x: 0, y: 0, sx: 1, sy: 1, r: 0, o: 1 };
  for (const [t, p] of keys) {
    if (p.s != null) { cur.sx = p.s; cur.sy = p.s; }
    for (const k2 of ["x", "y", "sx", "sy", "r", "o"]) if (p[k2] != null) cur[k2] = p[k2];
    st.push([t, { ...cur }, p.e || "io"]);
  }
  const E = EASES(K);
  const used = { tr: st.some(s => s[1].x || s[1].y), sc: st.some(s => s[1].sx !== 1 || s[1].sy !== 1), ro: st.some(s => s[1].r), op: st.some(s => s[1].o !== 1) };
  const fmt = { tr: v => `${(v.x * X.W).toFixed(1)}px ${(v.y * X.H).toFixed(1)}px`, sc: v => `${v.sx.toFixed(4)} ${v.sy.toFixed(4)}`, ro: v => `${v.r.toFixed(2)}deg`, op: v => v.o.toFixed(3) };
  const prop = { tr: "translate", sc: "scale", ro: "rotate", op: "opacity" };
  for (const key of Object.keys(used)) {
    if (!used[key]) continue;
    const tr = X.T(box, prop[key], fmt[key](st[0][1]));
    for (let i = 1; i < st.length; i++) {
      const [t0] = st[i - 1], [t1, v, e] = st[i];
      if (e === "step") tr.set(t1, fmt[key](v)); else tr.to(t0, Math.max(0.001, t1 - t0), fmt[key](v), E[e]);
    }
  }
}
/* aplica kf, marquesina, salida direccional, temblor y parpadeo a un nodo dibujado */
function motion(X, K, node, e) {
  if (!node) return;
  const box = node.box || node, el = node.el || node.inner || box, at = e.at ?? 0, dur = X.dur || 0;
  let keys = e.kf ? e.kf.map(k2 => [k2[0], { ...k2[1] }]) : null;
  if (e.marq && !keys) keys = [[0, { x: 0 }], [dur + 1, { x: e.marq * (dur + 1), e: "lin" }]];
  const o = e.out;
  if (o) {
    const t0 = o.at, d = o.d ?? 0.25, D = { up: { y: -1.1 }, down: { y: 1.1 }, left: { x: -1.2 }, right: { x: 1.2 }, zoom: { s: 2.4, o: 0 }, fade: { o: 0 }, collapse: { sy: 0.02 } }[o.m];
    if (D) {
      keys = keys || [[0, {}]];
      if (!keys.some(k2 => k2[0] >= t0)) keys.push([t0, {}]);
      keys.push([t0 + d, { ...D, e: o.m === "collapse" ? "step" : (o.e || "in") }]);
    }
    if (o.m === "chars" || o.m === "breakup") {
      const cs = node.chars || node.words || [];
      cs.forEach((c, i) => X.T(c, "opacity", "1", true).set(t0 + d * rnd(i, (e.seed ?? 3) + 1), "0"));
      if (o.m === "breakup") X.T(el, "letterSpacing", `${(e.ls ?? 0).toFixed(3)}em`).to(t0, d, `${(o.ls ?? 0.6).toFixed(3)}em`, K.EASE_OUT);
    }
    if (o.m === "glitch") {
      const tc = X.T(el, "clipPath", "inset(-10% -10% -10% -10%)", true), tt = X.T(el, "translate", "0px 0px", true);
      for (let i = 0; i < 4; i++) { const a = Math.floor(rnd(i, 7) * 60); tc.set(t0 + i * d / 4, `inset(${a}% -10% ${Math.max(0, 80 - a)}% -10%)`); tt.set(t0 + i * d / 4, `${((rnd(i, 9) - 0.5) * 0.08 * X.W).toFixed(1)}px 0px`); }
    }
    X.T(box, "display", "", true).set(t0 + (o.m === "cut" ? 0 : d), "none");
  }
  kfTracks(X, K, box, keys);
  if (e.jit) {   /* temblor escalonado (como animación a pocos cuadros por segundo) */
    const j = e.jit, fps = j.fps ?? 12, a = (j.a ?? 0.004) * X.H, r = j.r ?? 0.6, t1 = j.to ?? dur, t0 = j.from ?? 0;
    const tt = X.T(el, "translate", "0px 0px", true), tr = X.T(el, "rotate", "0deg", true);
    for (let i = 0, t = t0; t < t1; i++, t += 1 / fps) {
      tt.set(t, `${((rnd(i, 11) - 0.5) * 2 * a).toFixed(1)}px ${((rnd(i, 13) - 0.5) * 2 * a).toFixed(1)}px`);
      tr.set(t, `${((rnd(i, 17) - 0.5) * 2 * r).toFixed(2)}deg`);
    }
  }
  if (e.flick) {
    const f = e.flick, n = f.n ?? 6, tr = X.T(el, "opacity", "1", true);
    for (let i = 0; i < n; i++) tr.set(f.at + i * (f.d ?? 0.3) / n, rnd(i, 21) < 0.45 ? "0.15" : "1");
    tr.set(f.at + (f.d ?? 0.3), "1");
  }
}
const node2push = (t, t2) => { (t.extra = t.extra || []).push(t2); };
/* entradas por letra: assemble (bloque → letra), fly (desde los lados), drop (caen con rebote) */
function charEntry(X, K, t, e, light) {
  const cs = t.chars || [], at = e.at ?? 0, d = e.d ?? 0.35, n = Math.max(1, cs.length);
  cs.forEach((c, i) => {
    if (!c.textContent.trim()) return;
    if (e.in === "assemble") {
      const t1 = at + d * rnd(i, e.seed ?? 5), t2 = t1 + (e.hold ?? 0.08) + 0.06 * rnd(i, 31);
      K.hide(X, c, t1);
      const bc = e.bc || (light ? "#0e0c18" : "#0b0b12"), bd = light ? "1px solid #0e0c18" : "1px solid rgba(255,255,255,0.55)";
      X.T(c, "background", bc, true).set(t2, "transparent");
      X.T(c, "outline", bd, true).set(t2, "none");
      X.T(c, "color", "transparent", true).set(t2, "");
      if (e.fill === "holo") X.T(c, "webkitTextFillColor", "transparent", true);
    } else if (e.in === "fly") {
      const side = (i < n / 2 ? -1 : 1), t1 = at + (Math.abs(i - (n - 1) / 2) / n) * d * 0.4;
      K.hide(X, c, t1);
      X.T(c, "translate", `${(side * (0.25 + 0.3 * rnd(i, 41)) * X.W).toFixed(1)}px 0px`).to(t1, d, "0px 0px", K.EASE_OUT);
    } else if (e.in === "drop") {
      const t1 = at + i * (d * 0.5 / n);
      K.hide(X, c, t1);
      X.T(c, "translate", `0px ${(-0.35 * X.H).toFixed(1)}px`).to(t1, d * 0.8, "0px 0px", K.EASE_BACK);
    }
  });
}

const DRAW = {
  text(X, K, L, e) {
    const { W, H } = X, fam = FAM[e.f || "c"], at = e.at ?? 0, txt = e.nocase ? e.t : k.U(e.t);
    let fs = e.h * H;
    if (e.maxw) fs = Math.min(fs, k.fit(K, txt, fam, e.maxw * W, e.h * H * 1.15, e.ls || 0));
    const fill = e.fill || "white";
    const col = (fill === "out" || fill === "dim") ? (e.c || (fill === "dim" ? "rgba(255,255,255,0.32)" : K.P.white)) : fillColor(K, fill === "holo" ? "white" : fill);
    const t = K.tx(L, txt, { cls: fam, fs, x: (e.x ?? 0.5) * W, y: (e.y ?? 0.5) * H, ax: e.ax ?? 0.5, ay: e.ay ?? 0.5, color: col, ls: e.ls, stroke: fill === "out" || fill === "dim", sw: (e.sw ?? (fill === "dim" ? 0.004 : 0.003)) * (fill === "out" ? 1.45 : 1), rot: e.rot, split: (e.hl || ["scatter", "assemble", "fly", "drop"].includes(e.in) || (e.out && ["chars", "breakup"].includes(e.out.m) && e.in !== "words")) ? "chars" : e.in === "words" ? "words" : undefined });
    if (fam === "fw") { t.el.style.paddingRight = "0.32em"; t.box.style.transform += " scaleY(1.5)"; }
    if (fill === "holo") k.holoFill(X, K, t.el);
    if (e.hl) t.chars.forEach((c, i) => { if (e.hl.includes(i)) { c.style.webkitTextStroke = "0"; k.holoFill(X, K, c); } });
    if (e.op != null) t.box.style.opacity = String(e.op);
    if (e.in === "scatter") {   /* letras que aparecen salteadas (orden pseudoaleatorio estable) */
      const cs = t.chars || [], span = e.d ?? 0.3;
      cs.forEach((c, i) => K.hide(X, c, at + span * ((Math.sin(i * 12.9898 + (e.seed ?? 1) * 78.233) * 43758.5453) % 1 + 1) % 1));
    } else if (e.in === "words") {   /* palabra por palabra: e.wt = tiempos relativos de cada palabra */
      (t.words || []).forEach((w, i) => K.hide(X, w, e.wt && e.wt[i] != null ? e.wt[i] : at + i * (e.d ?? 0.18)));
    } else if (["assemble", "fly", "drop"].includes(e.in)) {
      charEntry(X, K, t, e, X.light === true);
    } else if (e.in === "zoomdown") {   /* entra gigante y espaciado y se reduce a su tamaño */
      const z = e.z ?? 3, d = e.d ?? 0.5;
      K.hide(X, t.box, at);
      X.T(t.el, "scale", `${z}`).to(at, d, "1", K.EASE_OUT);
      X.T(t.el, "letterSpacing", `${(e.zls ?? 0.6).toFixed(3)}em`).to(at, d, `${(e.ls ?? 0).toFixed(3)}em`, K.EASE_OUT);
    } else enter(X, K, t.box, t.el, e.in, at, e.d);
    if (e.echo) {   /* copias en contorno que convergen y se funden en la palabra */
      const ec = e.echo, n = ec.n ?? 4, dy = (ec.dy ?? 0.11) * H, ed = ec.d ?? 0.25, ea = ec.at ?? at;
      for (let i = 0; i < n; i++) {
        const k2 = (i < n / 2 ? -(n / 2 - i) : i - n / 2 + 1);
        const c = K.tx(L, txt, { cls: fam, fs, x: (e.x ?? 0.5) * W, y: (e.y ?? 0.5) * H, ax: e.ax ?? 0.5, ay: e.ay ?? 0.5, color: ec.c || (X.light ? "rgba(20,20,40,0.6)" : "rgba(255,255,255,0.62)"), ls: e.ls, stroke: true, sw: 0.0038, rot: e.rot });
        if (fam === "fw") { c.el.style.paddingRight = "0.32em"; c.box.style.transform += " scaleY(1.5)"; }
        K.hide(X, c.box, ea);
        X.T(c.el, "translate", `0px ${(k2 * dy).toFixed(1)}px`).to(ea, ed, "0px 0px", K.EASE_IN);
        X.T(c.box, "display", "", true).set(ea + ed, "none");
      }
      K.hide(X, t.box, ea + ed * 0.9);
    }
    if (e.fillseq) {   /* el relleno entra letra a letra (izquierda → derecha o al azar) sobre el contorno */
      const fq = e.fillseq, f2 = fq.f || "holo", fa = fq.at ?? at + 0.1, fd = fq.d ?? 0.35;
      const t2 = K.tx(L, txt, { cls: fam, fs, x: (e.x ?? 0.5) * W, y: (e.y ?? 0.5) * H, ax: e.ax ?? 0.5, ay: e.ay ?? 0.5, color: fillColor(K, f2 === "holo" ? "white" : f2), ls: e.ls, rot: e.rot, split: "chars" });
      if (fam === "fw") { t2.el.style.paddingRight = "0.32em"; t2.box.style.transform += " scaleY(1.5)"; }
      if (f2 === "holo") k.holoFill(X, K, t2.el);
      const n = Math.max(1, t2.chars.length);
      t2.chars.forEach((c, i) => K.hide(X, c, fa + fd * (fq.rand ? rnd(i, 51) : i / n)));
      if (fq.back != null) t2.chars.forEach((c, i) => X.T(c, "opacity", "1", true).set(fq.back + fd * (i / n), "0"));
      if (e.to != null) X.T(t2.box, "display", "", true).set(e.to, "none");
      node2push(t, t2);
    }
    if (e.sweep) {   /* contorno que se rellena con un barrido de izquierda a derecha */
      const f2 = e.sweep === true ? "holo" : e.sweep, s0 = e.sat ?? at + 0.08, sd = e.sd ?? 0.3;
      const t2 = K.tx(L, txt, { cls: fam, fs, x: (e.x ?? 0.5) * W, y: (e.y ?? 0.5) * H, ax: e.ax ?? 0.5, ay: e.ay ?? 0.5, color: fillColor(K, f2 === "holo" ? "white" : f2), ls: e.ls, rot: e.rot });
      if (fam === "fw") { t2.el.style.paddingRight = "0.32em"; t2.box.style.transform += " scaleY(1.5)"; }
      if (f2 === "holo") k.holoFill(X, K, t2.el);
      X.T(t2.el, "clipPath", "inset(-5% 100% -5% -5%)").to(s0, sd, "inset(-5% -5% -5% -5%)", K.EASE_IO);
      if (e.sback) X.T(t2.el, "clipPath", "inset(-5% -5% -5% -5%)").to(e.sback, sd, "inset(-5% -5% -5% 100%)", K.EASE_IO);
      leave(X, t2.box, e.to, at); move(X, K, t2.box, e, at);
      node2push(t, t2);
    }
    leave(X, t.box, e.to, at); move(X, K, t.box, e, at);
    return t;
  },
  /* imagen propia (assets/media/art/*.png): fill holo|white|ink|<css> la usa como máscara; raw la muestra tal cual */
  img(X, K, L, e) {
    const { W, H } = X, at = e.at ?? 0, src = `assets/media/art/${e.s}.png`, asp = e.asp ?? (K.C.art || {})[e.s] ?? ART[e.s] ?? 1;
    const h = (e.h ?? 0.5) * H, w = h * asp, cx = (e.x ?? 0.5) * W, cy = (e.y ?? 0.5) * H;
    const box = K.div(L, "patch", { left: cx - w / 2 + "px", top: cy - h / 2 + "px", width: w + "px", height: h + "px" });
    const inner = K.div(box, "lay");
    const fill = e.fill || "raw";
    if (fill === "raw") Object.assign(inner.style, { backgroundImage: `url(${src})`, backgroundSize: "100% 100%" });
    else {
      Object.assign(inner.style, { webkitMaskImage: `url(${src})`, maskImage: `url(${src})`, webkitMaskSize: "100% 100%", maskSize: "100% 100%", webkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" });
      if (fill === "holo") k.holoFill(X, K, inner, { text: false, size: e.size || "160% 200%" });
      else inner.style.background = fill === "gold" ? GOLD : fillColor(K, fill);
    }
    if (e.blend) box.style.mixBlendMode = e.blend;
    if (e.glow) box.style.filter = `drop-shadow(0 0 ${(e.glow * H).toFixed(1)}px rgba(214,200,255,0.55))`;
    if (e.tone === "gold") inner.style.filter = "sepia(1) saturate(3.2) hue-rotate(-8deg) brightness(1.08) contrast(1.05)";
    else if (e.filter) inner.style.filter = e.filter;
    if (e.flip) inner.style.transform = "scaleX(-1)";
    if (e.rot) box.style.transform = `rotate(${e.rot}deg)`;
    if (e.op != null) box.style.opacity = String(e.op);
    if (e.in === "pop") { X.T(inner, "transform", (e.flip ? "scaleX(-1) " : "") + "scale(0.4)").to(at, 0.32, (e.flip ? "scaleX(-1) " : "") + "scale(1)", K.EASE_BACK); X.T(box, "opacity", "0").to(at, 0.12, String(e.op ?? 1)); }
    else if (e.in === "fade") X.T(box, "opacity", "0").to(at, e.d ?? 0.3, String(e.op ?? 1));
    else if (e.in === "rise") { X.T(inner, "transform", (e.flip ? "scaleX(-1) " : "") + `translateY(${(0.12 * H).toFixed(0)}px)`).to(at, e.d ?? 0.4, (e.flip ? "scaleX(-1) " : "") + "translateY(0px)", K.EASE_OUT); X.T(box, "opacity", "0").to(at, 0.2, String(e.op ?? 1)); }
    else if (e.in && e.in.startsWith("wipe")) enter(X, K, box, inner, e.in, at, e.d);
    else if (e.in === "glitch") k.enter(X, K, inner, "glitch", at);
    else K.hide(X, box, at);
    if (e.shuf && fill !== "raw") {   /* el emblema cambia de forma cada pocos cuadros */
      const list = [e.s, ...e.shuf], step = e.step ?? 0.067, t1 = e.shufTo ?? (at + 0.5);
      const u = n2 => `url(assets/media/art/${n2}.png)`;
      const a1 = X.T(inner, "maskImage", u(list[0]), true), a2 = X.T(inner, "webkitMaskImage", u(list[0]), true);
      for (let i = 1, t = at + step; t < t1; i++, t += step) { a1.set(t, u(list[i % list.length])); a2.set(t, u(list[i % list.length])); }
      a1.set(t1, u(e.s)); a2.set(t1, u(e.s));
    }
    leave(X, box, e.to, at); move(X, K, box, e, at);
    return { box, el: inner };
  },
  /* columna de rótulos diminutos que corre en vertical */
  vcol(X, K, L, e) {
    const { W, H } = X, n = e.n ?? 14, fs = (e.h ?? 0.012) * H, sp = (e.sp ?? 0.045) * H, g = K.div(L, "lay");
    const col = e.c || (X.light ? "rgba(20,20,30,0.55)" : "rgba(170,160,255,0.75)");
    for (let i = 0; i < n * 2; i++) K.tx(g, k.U(e.t || "THE BADDEST"), { cls: "fc", fs, x: (e.x ?? 0.5) * W, y: i * sp, ax: 0.5, ay: 0, color: col, ls: 0.12 });
    const v = (e.v ?? -0.05) * H, D = (X.dur || 3) + 1;
    X.T(g, "translate", `0px ${(v > 0 ? -n * sp : 0).toFixed(1)}px`).to(0, D, `0px ${(v > 0 ? -n * sp + v * D : v * D).toFixed(1)}px`);
    if (e.op != null) g.style.opacity = String(e.op);
    return { box: g, el: g };
  },
  /* partículas que titilan */
  sparks(X, K, L, e) {
    const { W, H } = X, n = e.n ?? 18, g = K.div(L, "lay"), s = e.seed ?? 1;
    for (let i = 0; i < n; i++) {
      const z = (1 + 2 * rnd(i, s + 3)) * X.u * 1.4;
      const d = K.div(g, "patch", { left: rnd(i, s) * W + "px", top: rnd(i, s + 1) * H + "px", width: z + "px", height: z + "px", borderRadius: "50%", background: e.c || "#dfe6ff", boxShadow: `0 0 ${(z * 3).toFixed(1)}px ${e.c || "#cfd8ff"}` });
      const tr = X.T(d, "opacity", "0", true);
      for (let j = 0; j < 8; j++) tr.set(j * 0.37 + rnd(i * 9 + j, s + 2) * 0.3, rnd(i * 7 + j, s + 5) < 0.5 ? String(0.25 + 0.6 * rnd(i, s + 6)) : "0");
      X.T(d, "translate", "0px 0px").to(0, (X.dur || 3) + 1, `${((rnd(i, s + 8) - 0.5) * 0.03 * W).toFixed(1)}px ${(-0.02 * H).toFixed(1)}px`);
    }
    if (e.op != null) g.style.opacity = String(e.op);
    return { box: g, el: g };
  },
  /* rejilla de líneas finas */
  grid(X, K, L, e) {
    const { W, H } = X, g = K.div(L, "lay", { opacity: String(e.op ?? 0.18) }), c = e.c || "rgba(255,255,255,0.6)";
    for (let i = 1; i < (e.nx ?? 12); i++) K.div(g, "patch", { left: i * W / (e.nx ?? 12) + "px", top: "0px", width: "1px", height: H + "px", background: c });
    for (let i = 1; i < (e.ny ?? 7); i++) K.div(g, "patch", { left: "0px", top: i * H / (e.ny ?? 7) + "px", width: W + "px", height: "1px", background: c });
    return { box: g, el: g };
  },
  /* anillo o arco fino que crece */
  ring(X, K, L, e) {
    const { W, H } = X, at = e.at ?? 0, r = (e.r ?? 0.5) * H, cx = (e.x ?? 0.5) * W, cy = (e.y ?? 0.5) * H;
    const b = K.div(L, "patch", { left: cx - r + "px", top: cy - r + "px", width: 2 * r + "px", height: 2 * r + "px", borderRadius: "50%", border: `${Math.max(1, (e.sw ?? 0.0025) * H).toFixed(1)}px solid ${e.c || "rgba(255,255,255,0.75)"}` });
    if (e.op != null) b.style.opacity = String(e.op);
    X.T(b, "transform", `scale(${e.s0 ?? 0.7})`).to(at, e.d ?? 0.5, "scale(1)", K.EASE_OUT);
    K.hide(X, b, at); leave(X, b, e.to, at);
    return b;
  },
  rep(X, K, L, e) {
    const { W, H } = X, fam = FAM[e.f || "c"], n = e.n | 1, c = e.hero ?? Math.floor(n / 2), at = e.at ?? 0, txt = k.U(e.t);
    let fs = e.h * H; if (e.maxw) fs = Math.min(fs, k.fit(K, txt, fam, e.maxw * W, e.h * H * 1.15, e.ls || 0));
    const lh = fs * (e.sp ?? 0.88), g = K.div(L, "lay");
    for (let i = 0; i < n; i++) {
      if (i === c) continue;
      const t = K.tx(g, txt, { cls: fam, fs, x: (e.x ?? 0.5) * W, y: (e.y ?? 0.5) * H + (i - c) * lh, ax: e.ax ?? 0.5, color: e.c || K.P.white, stroke: true, sw: 0.01, ls: e.ls });
      t.box.style.opacity = String(Math.max(0.12, (e.op ?? 0.6) - Math.abs(i - c) * 0.1));
      K.hide(X, t.box, at + Math.abs(i - c) * 0.04);
    }
    const dy = (e.drift ?? 0.05) * H;
    X.T(g, "transform", `translateY(${dy.toFixed(1)}px)`).to(0, X.dur, `translateY(${(-dy).toFixed(1)}px)`);
    const t = K.tx(L, txt, { cls: fam, fs, x: (e.x ?? 0.5) * W, y: (e.y ?? 0.5) * H, ax: e.ax ?? 0.5, color: fillColor(K, e.herofill === "holo" ? "white" : (e.herofill || "white")), ls: e.ls });
    if ((e.herofill || "holo") === "holo") k.holoFill(X, K, t.el);
    enter(X, K, t.box, t.el, e.in || "slide", at);
    leave(X, L, null);
  },
  col(X, K, L, e) {
    const { W, H } = X, cs = [...e.t], fs = e.h * H, at = e.at ?? 0;
    cs.forEach((ch, i) => {
      const t = K.tx(L, ch, { cls: FAM[e.f || "ko"], fs, x: (e.x ?? 0.5) * W, y: (e.y ?? 0.5) * H + (i - (cs.length - 1) / 2) * fs * (e.sp ?? 0.98), ax: 0.5, color: fillColor(K, e.fill === "holo" ? "white" : (e.fill || "white")) });
      if (e.fill === "holo") k.holoFill(X, K, t.el);
      enter(X, K, t.box, t.el, e.in || "slide", at + i * 0.05);
      leave(X, t.box, e.to, at);
    });
  },
  box(X, K, L, e) {
    const { W, H } = X, at = e.at ?? 0;
    const css = { left: e.x * W + "px", top: e.y * H + "px", width: e.w * W + "px", height: e.h * H + "px" };
    if (e.rot) css.transform = `rotate(${e.rot}deg)`;
    const b = e.fill === "holo" ? k.holoBox(X, K, L, css) : K.div(L, "patch", { ...css, background: e.fill === "gold" ? GOLD : fillColor(K, e.fill || "white") });
    if (e.r) b.style.borderRadius = e.r;
    if (e.stroke) b.style.border = `${Math.max(1, 0.002 * H)}px solid ${e.stroke}`;
    if (e.op != null) b.style.opacity = String(e.op);
    b.style.transformOrigin = e.in === "wipeR" ? "100% 50%" : "0% 50%";
    if (e.in === "wipeL" || e.in === "wipeR") { const base = e.rot ? `rotate(${e.rot}deg) ` : ""; X.T(b, "transform", base + "scaleX(0)").to(at, e.d ?? 0.2, base + "scaleX(1)", K.EASE_OUT); K.hide(X, b, Math.max(0, at - 0.01)); }
    else if (e.in === "wipeU" || e.in === "wipeD") { b.style.transformOrigin = e.in === "wipeU" ? "50% 100%" : "50% 0%"; const base = e.rot ? `rotate(${e.rot}deg) ` : ""; X.T(b, "transform", base + "scaleY(0)").to(at, e.d ?? 0.2, base + "scaleY(1)", K.EASE_OUT); K.hide(X, b, Math.max(0, at - 0.01)); }
    else if (e.in === "pop") { X.T(b, "opacity", "0").to(at, 0.1, String(e.op ?? 1)); }
    else if (e.in === "fade") { X.T(b, "opacity", "0").to(at, 0.25, String(e.op ?? 1)); }
    else K.hide(X, b, at);
    leave(X, b, e.to, at); move(X, K, b, e, at);
    return b;
  },
  media(X, K, L, e) {
    const { W, H } = X, at = e.at ?? 0;
    const spec = (K.C.media || []).find(m => m.id === e.id) || K.C.media?.[0];
    const rect = { x: (e.x ?? 0) * W, y: (e.y ?? 0) * H, w: (e.w ?? 1) * W, h: (e.h ?? 1) * H };
    const look = e.look || "sil";
    let m;
    if (look === "tint") {   /* medio original teñido: escala de grises multiplicada por un color (rojo, azul...) */
      m = K.mbox(X, L, spec, { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px" }, {});
      m.el.style.filter = `grayscale(1) contrast(${e.ct ?? 1.3}) brightness(${e.br ?? 1})`;
      K.div(m.box, "lay", { background: e.c || K.P.red, mixBlendMode: "multiply" });
    } else m = k.media(X, K, L, spec, rect, look === "ink" ? { ink: true } : { screen: e.screen !== false });
    if (e.op != null) m.box.style.opacity = String(e.op);
    if (e.in === "wipeL" || e.in === "wipeR" || e.in === "wipeU" || e.in === "wipeD") enter(X, K, m.box, m.box, e.in, at, e.d);
    else if (e.in === "fade") X.T(m.box, "opacity", "0").to(at, 0.3, String(e.op ?? 1));
    else K.hide(X, m.box, at);
    leave(X, m.box, e.to, at); move(X, K, m.box, e, at);
    return m;
  },
  shape(X, K, L, e) {
    const { W, H } = X, at = e.at ?? 0, sz = e.w * H, asp = e.asp ?? 1;
    const w = sz * asp, h = sz, cx = (e.x ?? 0.5) * W, cy = (e.y ?? 0.5) * H;
    const css = { left: cx - w / 2 + "px", top: cy - h / 2 + "px", width: w + "px", height: h + "px" };
    const fill = e.fill || "holo", box = K.div(L, "patch", css);
    const poly = SHAPES[e.s];
    if (e.s === "ball") {
      box.style.borderRadius = "50%"; box.style.background = "radial-gradient(circle at 36% 32%, #fff 0%, #e9ecf6 55%, #aab0c8 100%)";
      box.innerHTML = `<svg viewBox="0 0 100 100" style="position:absolute;inset:0;width:100%;height:100%"><g fill="none" stroke="#141420" stroke-width="2.4"><circle cx="50" cy="50" r="48"/><path d="M50 2 V98 M2 50 H98 M14 14 C38 38 38 62 14 86 M86 14 C62 38 62 62 86 86"/></g></svg>`;
    } else if (e.s === "chain") {
      const wave = (y0, ph) => { let d = "M0 " + y0; for (let i = 1; i <= 40; i++) d += ` L${(i * 2.5).toFixed(1)} ${(y0 + 14 * Math.sin(i * 0.5 + ph)).toFixed(1)}`; return d; };
      box.innerHTML = `<svg viewBox="0 0 100 50" preserveAspectRatio="none" style="position:absolute;inset:0;width:100%;height:100%;overflow:visible"><defs><linearGradient id="gch" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff2b0"/><stop offset=".4" stop-color="#f4c534"/><stop offset=".75" stop-color="#b8801c"/><stop offset="1" stop-color="#ffe07a"/></linearGradient></defs><path d="${wave(14, 0)}" fill="none" stroke="url(#gch)" stroke-width="1.5" stroke-dasharray="1.6 0.7"/><path d="${wave(26, 2.2)}" fill="none" stroke="url(#gch)" stroke-width="1.5" stroke-dasharray="1.6 0.7"/></svg>`;
    } else if (poly) {
      const inner = K.div(box, "lay");
      inner.style.clipPath = `path(evenodd, '${pathOf(poly, w, h)}')`;
      if (fill === "holo") k.holoFill(X, K, inner, { text: false, size: "180% 220%" });
      else inner.style.background = fill === "gold" ? GOLD : fillColor(K, fill);
      if (fill === "holo" || fill === "white") box.style.filter = `drop-shadow(0 0 ${(0.012 * H).toFixed(1)}px rgba(214,200,255,0.45))`;
    }
    if (e.rot) box.style.transform = `rotate(${e.rot}deg)`;
    if (e.op != null) box.style.opacity = String(e.op);
    if (e.in === "pop") { const base = e.rot ? `rotate(${e.rot}deg) ` : ""; X.T(box, "transform", base + "scale(0.3)").to(at, 0.4, base + "scale(1)", K.EASE_BACK); X.T(box, "opacity", "0").to(at, 0.15, String(e.op ?? 1)); }
    else if (e.in === "rise") { X.T(box, "opacity", "0").to(at, 0.3, String(e.op ?? 1)); }
    else K.hide(X, box, at);
    leave(X, box, e.to, at); move(X, K, box, e, at);
    return box;
  },
  orn(X, K, L, e) { k.ornaments(X, K, L, (e.x ?? 0.5) * X.W, (e.y ?? 0.5) * X.H, e.n ?? 4, (e.s ?? 0.012) * Math.min(X.W, X.H) * 1.4, e.c || K.P.h2, e.at ?? 0.05); },
  lab(X, K, L, e) {
    const { W, H } = X, txt = k.U(e.t), fs = Math.max(7, 0.0135 * Math.min(W, H) * (k.port(X) ? 1.5 : 1));
    const col = e.c || (X.light ? "rgba(20,20,26,0.6)" : "rgba(255,255,255,0.7)"), g = K.div(L, "lay");
    for (const y of e.rows || [0.055, 0.945]) for (const [i, x] of (e.xs || [0.06, 0.5, 0.94]).entries()) K.tx(g, txt, { cls: "fc", fs, x: x * W, y: y * H, ax: x < 0.3 ? 0 : x > 0.7 ? 1 : 0.5, ay: 0.5, color: col, ls: 0.14 });
    if (e.op != null) g.style.opacity = String(e.op);
    X.T(g, "opacity", "0").to(e.at ?? 0.05, 0.25, String(e.op ?? 1));
  },
  diag(X, K, L, e) {
    const { W, H } = X, n = e.n ?? 5, g = K.div(L, "lay", { opacity: String(e.op ?? 0.5), overflow: "hidden" });
    for (let i = 0; i < n; i++) K.div(g, "patch", { left: (i + 0.5) / n * 1.3 * W - 0.15 * W + "px", top: "-20%", width: Math.max(1, 0.0012 * W) + "px", height: "140%", background: e.c || "rgba(255,255,255,0.55)", transform: `rotate(${e.ang ?? 35}deg)` });
  },
  dots(X, K, L, e) {
    const sz = (e.size ?? 7) * X.u;
    K.div(L, "lay", { opacity: String(e.op ?? 0.22), backgroundImage: `radial-gradient(circle, ${e.c || "rgba(0,0,0,0.55)"} ${(0.16 * sz).toFixed(1)}px, transparent ${(0.24 * sz).toFixed(1)}px)`, backgroundSize: `${sz}px ${sz}px` });
  },
  flash(X, K, L, e) {
    const f = K.div(X.root, "patch", { left: "0px", top: "0px", width: X.W + "px", height: X.H + "px", background: e.c || "#fff", zIndex: 45 });
    X.T(f, "opacity", "0", true).set(e.at ?? 0, "1"); X.T(f, "opacity", "1").to(e.at ?? 0, e.d ?? 0.2, "0");
    X.T(f, "visibility", "hidden", true).set(e.at ?? 0, "visible").set((e.at ?? 0) + (e.d ?? 0.2), "hidden");
  },
};

R.scenes.compose = {
  label: "Escena compuesta por datos (mundo + elementos)",
  fits: () => false,
  params: { els: S.str(100000, ""), cut: S.num(0, 1, 0.5) },
  render(sc, X, K) {
    const p = X.p, L = worldBg(X, K, sc.slot.bg || "void", p);
    if (p.art && typeof p.art === "object") Object.assign(ART, p.art);
    /* cámara: empuje lento continuo (la referencia casi nunca está quieta) */
    if (p.cam !== false) {
      const c = p.cam || {}, D = Math.max(0.3, X.dur || sc.dur || 1);
      const s0 = c.s ? c.s[0] : 1, s1 = c.s ? c.s[1] : 1.035;
      X.T(L, "scale", `${s0}`).to(0, D, `${s1}`, c.e === "out" ? K.EASE_OUT : undefined);
      if (c.x || c.y) X.T(L, "translate", `${((c.x?.[0] ?? 0) * X.W).toFixed(1)}px ${((c.y?.[0] ?? 0) * X.H).toFixed(1)}px`).to(0, D, `${((c.x?.[1] ?? 0) * X.W).toFixed(1)}px ${((c.y?.[1] ?? 0) * X.H).toFixed(1)}px`, c.e === "out" ? K.EASE_OUT : undefined);
      if (c.r) X.T(L, "rotate", `${c.r[0]}deg`).to(0, D, `${c.r[1]}deg`);
    }
    const els = Array.isArray(p.els) ? p.els : [];
    for (const e of els) {
      const f = DRAW[e.k];
      if (!f) { K.warn(`compose: elemento desconocido "${e.k}"`); continue; }
      try {
        const node = f(X, K, L, e);
        if (node && (e.kf || e.out || e.jit || e.flick || e.marq)) {
          motion(X, K, node, e);
          for (const x2 of node.extra || []) motion(X, K, x2, { ...e, jit: null, flick: null, out: e.out && ["chars", "breakup"].includes(e.out.m) ? { ...e.out, m: "fade" } : e.out });
        }
      } catch (err) { console.warn("[lyrics-hologram-worlds] elemento falló", e.k, err); }
    }
  },
};
/* intro y cierres (intro.js, outro-v1.js, outro-v2.js) dibujan con las mismas piezas */
R.worlds = { DRAW, worldBg, SHAPES, motion };

/* ====================== ESCENAS · promo-editorial ======================
   Réplica del promo editorial de "final" deportiva: blanco y negro puro sobre
   papel arrugado, grotesca extendida pesada (títulos, nombres de equipos),
   bloques negros que barren y tapan la pantalla, reglas finas, palabras
   gigantes en contorno detrás, letras que se "cortan" con barras, recortes de
   jugadores con placa de nombre y un cierre de fecha / versus en negro.
   config.scenes[i] = { type, media, … } y el guion en lyrics.json. */
const P = C.palette;
const BR = C.brand || {};
const U = s => String(s).toUpperCase();
const show = (X, el, t) => { if (t > 0.001) X.T(el, "visibility", "hidden", true).set(t, "visible"); };
const rt = (X, i = 0) => Math.max(0.04, X.lines[i]?.rt ?? 0.1);
const L0 = X => U(X.lines[0]?.text || X.sc.seg.text || "");
const L1 = X => U(X.lines[1]?.text || "");

/* ---- papel arrugado: gradientes + motas, generado una vez ---- */
const PAPER = (() => {
  const cv = doc.createElement("canvas"); cv.width = 640; cv.height = 360;
  const cx = cv.getContext("2d");
  cx.fillStyle = "#ECECEA"; cx.fillRect(0, 0, 640, 360);
  for (let i = 0; i < 70; i++) {
    const x = texRng() * 640, y = texRng() * 360, a = texRng() * Math.PI, l = 60 + texRng() * 260;
    const g = cx.createLinearGradient(x, y, x + Math.cos(a + 1.57) * 40, y + Math.sin(a + 1.57) * 40);
    g.addColorStop(0, "rgba(255,255,255,0)"); g.addColorStop(0.5, `rgba(${texRng() < 0.5 ? "255,255,255" : "150,150,150"},${0.12 + texRng() * 0.2})`); g.addColorStop(1, "rgba(255,255,255,0)");
    cx.save(); cx.translate(x, y); cx.rotate(a); cx.fillStyle = g; cx.fillRect(-l / 2, -20, l, 40); cx.restore();
  }
  for (let i = 0; i < 180; i++) { cx.strokeStyle = `rgba(120,120,120,${0.05 + texRng() * 0.12})`; cx.lineWidth = 0.6; cx.beginPath(); const x = texRng() * 640, y = texRng() * 360; cx.moveTo(x, y); cx.lineTo(x + (texRng() - 0.5) * 120, y + (texRng() - 0.5) * 120); cx.stroke(); }
  return `url(${cv.toDataURL("image/jpeg", 0.85)})`;
})();
function base(X, bg) {
  const L = div(X.root, "lay", { background: bg === "black" ? P.black : P.paper });
  if (bg !== "black") div(L, "lay", { backgroundImage: PAPER, backgroundSize: "cover" });
  return L;
}
/* bloque negro que barre (entra / sale) */
function wipe(X, L, rect, t0, d, dir = "left", color = P.black) {
  const b = div(L, "patch", { left: rect.x + "px", top: rect.y + "px", width: rect.w + "px", height: rect.h + "px", background: color });
  const o = { left: "0% 50%", right: "100% 50%", up: "50% 0%", down: "50% 100%" }[dir];
  b.style.transformOrigin = o;
  const ax = dir === "left" || dir === "right" ? "scaleX" : "scaleY";
  X.T(b, "transform", `${ax}(0)`).to(t0, d * 0.45, `${ax}(1)`, EASE_OUT);
  return b;
}
function rule(X, L, x, y, w, h, t0, color = P.black) {
  const b = div(L, "patch", { left: x + "px", top: y + "px", width: w + "px", height: Math.max(1, h) + "px", background: color, transformOrigin: "0% 50%" });
  X.T(b, "transform", "scaleX(0)").to(t0, 0.3, "scaleX(1)", EASE_OUT);
  return b;
}
/* palabra gigante en contorno, cortada por el borde */
function outline(X, L, s, x, y, fs, t0 = 0, color = P.black) {
  const o = tx(L, U(s), { cls: "gx", fs, x, y, ax: 0, color: "transparent", stroke: true });
  o.el.style.webkitTextStroke = `${Math.max(1, 1.4 * X.u)}px ${color}`;
  X.T(o.el, "transform", "translateX(0px)").to(0, X.dur, `translateX(${-0.06 * X.W}px)`);
  show(X, o.box, t0);
  return o;
}
/* título que entra "cortado": las letras aparecen por franjas horizontales */
function sliceIn(X, L, s, x, y, fs, color, t0, o = {}) {
  const t = tx(L, U(s), { cls: o.cls || "gx", fs, x, y, ax: o.ax ?? 0.5, color, ls: o.ls ?? -0.01 });
  X.T(t.el, "clipPath", "inset(0% 0% 100% 0%)").set(t0, "inset(0% 0% 55% 0%)").set(t0 + 0.05, "inset(0% 0% 0% 0%)");
  X.T(t.el, "transform", "translateY(18%)").to(t0, 0.22, "translateY(0%)", EASE_OUT);
  return t;
}
function mediaFull(X, L, k, o = {}) {
  const m = mbox(X, L, k, { left: (o.x ?? 0) + "px", top: (o.y ?? 0) + "px", width: (o.w ?? X.W) + "px", height: (o.h ?? X.H) + "px" }, { filter: "bw" });
  kenBurns(X, m, "scale(1.05)", "scale(1.12)");
  return m;
}
function plate(X, L, top, bottom, x, y, u, t0) {
  const a = tx(L, U(top), { cls: "gx", fs: 12 * u, x, y, ax: 0, color: P.black, ls: 0.5 }); show(X, a.box, t0);
  if (!bottom) return;
  const b = div(L, "patch", { left: x + "px", top: y + 11 * u + "px", background: P.black, padding: `${3 * u}px ${7 * u}px` });
  const t = tx(b, U(bottom), { cls: "gx", fs: 12 * u, x: 0, y: 0, ax: 0, ay: 0, color: P.paper, ls: 0.06 }); t.box.style.position = "relative";
  X.T(b, "clipPath", "inset(0% 100% 0% 0%)").to(t0 + 0.1, 0.25, "inset(0% 0% 0% 0%)", EASE_OUT);
}

const B = {};

/* 1. título en dos renglones con franja negra que sube desde abajo */
B.title = (sc, X) => {
  const { W, H } = X, L = base(X), a = L0(X), b = L1(X);
  const fa = fit(a, "gx", -0.01, 0.4 * W, 0.1 * H), fb = fit(b || a, "gx", -0.01, 0.92 * W, 0.24 * H);
  const band = wipe(X, L, { x: 0, y: 0.52 * H, w: W, h: 0.48 * H }, 0, 0.6, "down");
  const ta = sliceIn(X, L, a, W / 2, 0.44 * H, fa, P.black, rt(X));
  if (b) {
    const tb = sliceIn(X, L, b, W / 2, 0.44 * H + fa * 0.55 + fb * 0.42, fb, P.black, rt(X, 1));
    /* la mitad inferior del título sobre la franja negra se ve blanca */
    const tw = tx(L, b, { cls: "gx", fs: fb, x: W / 2, y: 0.44 * H + fa * 0.55 + fb * 0.42, color: P.paper, ls: -0.01 });
    tw.box.style.clipPath = `inset(${0.52 * H - (0.44 * H + fa * 0.55)}px 0px 0px 0px)`;
    show(X, tw.box, rt(X, 1));
  }
  const tl = X.lines[2];
  if (tl) { const t = sliceIn(X, L, tl.text, W / 2, 0.44 * H + fa * 0.55 + fb, fb, P.paper, Math.max(0.05, tl.rt)); }
};

/* 2. palabra sobre media en duotono con tapa negra que se abre */
B.mediaWord = (sc, X) => {
  const { W, H } = X, L = base(X), s = L0(X);
  mediaFull(X, L, 0);
  const fs = fit(s, "gx", -0.01, 0.46 * W, 0.16 * H);
  const t = sliceIn(X, L, s, W / 2, 0.5 * H, fs, sc.slot.dark ? P.black : P.paper, rt(X));
  if (sc.slot.cover !== false) {
    const c = div(L, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: P.paper });
    X.T(c, "clipPath", "inset(0% 0% 0% 0%)").to(0.05, 0.35, `inset(${sc.slot.coverFrom === "top" ? "100% 0% 0% 0%" : "0% 0% 0% 100%"})`, EASE_IO);
  }
  if (X.dur > 1.2) wipe(X, L, { x: 0.7 * W, y: 0.62 * H, w: 0.3 * W, h: 0.38 * H }, X.dur - 0.5, 0.5, "right");
};

/* 3. dos renglones con bloques negros que entran por lados opuestos */
B.blocks = (sc, X) => {
  const { W, H } = X, L = base(X), a = L0(X), b = L1(X);
  const fs = Math.min(fit(a, "gx", -0.01, 0.55 * W, 0.14 * H), b ? fit(b, "gx", -0.01, 0.55 * W, 0.14 * H) : 1e9);
  wipe(X, L, { x: 0, y: 0, w: 0.28 * W, h: 0.72 * H }, 0.05, 0.5, "down");
  wipe(X, L, { x: 0.72 * W, y: 0.28 * H, w: 0.28 * W, h: 0.72 * H }, 0.12, 0.5, "up");
  for (const y of [0.36, 0.48, 0.6, 0.72]) rule(X, L, 0, y * H, W, 1.3 * X.u, 0.1 + y * 0.2);
  const ta = sliceIn(X, L, a, 0.5 * W, 0.42 * H, fs, P.black, rt(X));
  if (b) sliceIn(X, L, b, 0.5 * W, 0.42 * H + fs * 0.92, fs, P.black, rt(X, 1));
  /* la parte que cae sobre los bloques se ve blanca */
  for (const [txt, y, i] of [[a, 0.42 * H, 0], [b, 0.42 * H + fs * 0.92, 1]]) {
    if (!txt) continue;
    const w = tx(L, txt, { cls: "gx", fs, x: 0.5 * W, y, color: P.paper, ls: -0.01 });
    w.box.style.clipPath = `inset(0px ${W - 0.28 * W}px 0px 0px)`;
    show(X, w.box, rt(X, i));
  }
  const bar = rule(X, L, 0.5 * W - 0.05 * W, 0.08 * H, 0.004 * W, 0.08 * H, 0.2);
  bar.style.width = Math.max(2, 4 * X.u) + "px";
};

/* 4. nombre grande cortado por el borde + nombre chico centrado con reglas */
B.nameCut = (sc, X) => {
  const { W, H, u } = X, dark = sc.slot.bg === "black", L = base(X, sc.slot.bg), s = L0(X);
  const big = tx(L, s, { cls: "gx", fs: 0.62 * H, x: -0.08 * W, y: 0.5 * H, ax: 0, color: dark ? P.paper : P.black });
  X.T(big.el, "transform", "translateX(0px)").to(0, 0.5, `translateX(${-0.12 * W}px)`, EASE_OUT);
  X.T(big.box, "visibility", "visible", true).set(0.5, "hidden");
  outline(X, L, s, -0.02 * W, 0.5 * H, 0.86 * H, 0.5, dark ? P.paper : P.black);
  const fs = fit(s, "gx", 0, 0.28 * W, 0.08 * H);
  const t = sliceIn(X, L, s, W / 2, 0.5 * H, fs, dark ? P.paper : P.black, 0.55);
  rule(X, L, 0.24 * W, 0.3 * H, 0.14 * W, 0.022 * H, 0.6);
  wipe(X, L, { x: 0.58 * W, y: 0.24 * H, w: 0.18 * W, h: 0.05 * H }, 0.65, 0.4, "left");
  wipe(X, L, { x: 0.6 * W, y: 0.78 * H, w: 0.4 * W, h: 0.06 * H }, 0.7, 0.4, "right");
  for (let i = 0; i < 7; i++) { const o = tx(L, "BEST", { cls: "gx", fs: 7 * u, x: 0.95 * W, y: (0.1 + i * 0.13) * H, ax: 1, color: dark ? P.paper : P.black }); show(X, o.box, 0.6 + i * 0.03); }
  tx(L, "×", { cls: "gx", fs: 14 * u, x: 0.38 * W, y: 0.7 * H, color: dark ? P.paper : P.black });
};

/* 5. contorno gigante detrás + nombre al centro + reglas y marcas */
B.outlineName = (sc, X) => {
  const { W, H, u } = X, L = base(X, sc.slot.bg), s = L0(X), dark = sc.slot.bg === "black";
  outline(X, L, s, 0.02 * W, 0.5 * H, 1.1 * H, 0, dark ? P.paper : P.black);
  const fs = fit(s, "gx", 0, 0.24 * W, 0.08 * H);
  sliceIn(X, L, s, 0.5 * W, 0.5 * H, fs, dark ? P.paper : P.black, rt(X));
  wipe(X, L, { x: 0.52 * W, y: 0.24 * H, w: 0.48 * W, h: 0.035 * H }, 0.1, 0.4, "left", dark ? P.paper : P.black);
  rule(X, L, 0.48 * W, 0.72 * H, 0.3 * W, 1.5 * u, 0.25, dark ? P.paper : P.black);
  tx(L, "← ×", { cls: "gx", fs: 11 * u, x: 0.6 * W, y: 0.22 * H, color: dark ? P.paper : P.black });
  const bar = div(L, "patch", { left: 0.35 * W + "px", top: 0.08 * H + "px", width: 6 * u + "px", height: 0.1 * H + "px", background: dark ? P.paper : P.black });
  X.T(bar, "transform", "scaleY(0)").to(0.2, 0.25, "scaleY(1)", EASE_OUT);
};

/* 6. recorte de jugador (foto) + contorno detrás + placa de nombre */
B.player = (sc, X) => {
  const { W, H, u } = X, L = base(X), s = L0(X), side = sc.slot.side || "left";
  outline(X, L, (s.split(" ")[0] || s), -0.02 * W, 0.5 * H, 1.0 * H, 0);
  const pw = 0.46 * W, px = side === "left" ? 0 : W - pw;
  const m = mbox(X, L, 0, { left: px + "px", top: 0, width: pw + "px", height: H + "px" }, { filter: "bw" });
  m.box.style.webkitMaskImage = `linear-gradient(${side === "left" ? "90deg" : "270deg"}, #000 70%, transparent 100%)`;
  X.T(m.box, "transform", `translateX(${(side === "left" ? -1 : 1) * 0.1 * W}px)`).to(0, 0.4, "translateX(0px)", EASE_OUT);
  const bar = div(L, "patch", { left: (side === "left" ? pw + 0.02 * W : px - 0.04 * W) + "px", top: 0.05 * H + "px", width: 0.022 * W + "px", height: 0.9 * H + "px", background: P.black });
  X.T(bar, "transform", "scaleY(0)").to(0.1, 0.3, "scaleY(1)", EASE_OUT);
  plate(X, L, s.split("·")[0], L1(X), side === "left" ? 0.56 * W : 0.08 * W, 0.46 * H, u, rt(X));
  wipe(X, L, { x: 0, y: 0.3 * H, w: 0.18 * W, h: 0.045 * H }, 0.3, 0.4, "left");
};

/* 7. palabra que se arma letra a letra con huecos + barras verticales */
B.assemble = (sc, X) => {
  const { W, H, u } = X, L = base(X), s = L0(X);
  const fs = fit(s, "gx", 0, 0.5 * W, 0.1 * H);
  const t = tx(L, s, { cls: "gx", fs, x: W / 2, y: 0.5 * H, color: P.black, split: "chars" });
  const ord = t.chars.map((_, i) => i).sort(() => X.r() - 0.5);
  ord.forEach((ci, k) => show(X, t.chars[ci], rt(X) + k * (Math.min(0.9, X.dur * 0.5) / ord.length)));
  for (let i = 0; i < 4; i++) {
    const x = (0.2 + X.r() * 0.6) * W, h = (0.1 + X.r() * 0.2) * H, y = X.r() * (H - h);
    const b = div(L, "patch", { left: x + "px", top: y + "px", width: Math.max(2, 5 * u) + "px", height: h + "px", background: P.black });
    X.T(b, "transform", "scaleY(0)").to(0.1 + i * 0.12, 0.2, "scaleY(1)", EASE_OUT).to(0.7 + i * 0.1, 0.2, "scaleY(0)", EASE_IN);
  }
  rule(X, L, 0.02 * W, 0.72 * H, 0.26 * W, 2 * u, 0.2);
  const sq = div(L, "patch", { left: 0.52 * W + "px", top: 0.74 * H + "px", width: 10 * u + "px", height: 10 * u + "px", background: P.black }); show(X, sq, 0.4);
  if (X.dur > 1.4) {
    /* al final, la palabra queda con los rivales chicos en contorno a los lados */
    const tf = X.dur * 0.72, [l, r] = [BR.left, BR.right];
    for (const [txt, x, ax] of [[l, 0.3 * W, 1], [r, 0.7 * W, 0]]) {
      if (!txt) continue;
      const o = tx(L, U(txt), { cls: "gx", fs: fs * 0.6, x, y: 0.5 * H, ax, color: "transparent", stroke: true });
      o.el.style.webkitTextStroke = `${Math.max(1, u)}px ${P.black}`; show(X, o.box, tf);
    }
  }
};

/* 8. versus: dos fotos (técnicos / capitanes) + caja negra con los nombres */
B.versus = (sc, X) => {
  const { W, H, u } = X, L = base(X), [a, b] = [BR.left || "A", BR.right || "B"];
  const bx = { x: 0.06 * W, y: 0.08 * H, w: 0.88 * W, h: 0.78 * H };
  const box = div(L, "patch", { left: bx.x + "px", top: bx.y + "px", width: bx.w + "px", height: bx.h + "px", background: P.black });
  X.T(box, "transform", "scaleX(0.02)").to(0, 0.3, "scaleX(1)", EASE_OUT);
  X.T(box, "clipPath", "inset(0% 0% 0% 0%)").to(X.dur * 0.55, 0.3, "inset(38% 0% 44% 0%)", EASE_IO);
  const fs = Math.min(fit(U(a), "gx", 0, 0.26 * W, 0.16 * H), fit(U(b), "gx", 0, 0.26 * W, 0.16 * H));
  const names = div(L, "lay", { zIndex: 3 });
  for (const [txt, x, ax] of [[a, 0.33 * W, 0.5], [b, 0.67 * W, 0.5]]) {
    const t = tx(names, U(txt), { cls: "gx", fs, x, y: 0.47 * H, ax, color: P.paper, split: "chars" });
    t.chars.forEach((c, i) => { show(X, c, 0.25 + i * 0.05); X.T(c, "transform", `translateY(${(i % 2 ? 1 : -1) * 40}%)`).to(0.25 + i * 0.05, 0.25, "translateY(0%)", EASE_OUT); });
  }
  const vs = tx(names, "VS", { cls: "gx", fs: fs * 0.55, x: W / 2, y: 0.47 * H, color: P.paper }); show(X, vs.box, X.dur * 0.55);
  for (const [k, x, side] of [[0, 0.0, 1], [1, 0.62 * W, -1]]) {
    const m = mbox(X, L, k, { left: x + "px", top: 0.18 * H + "px", width: 0.38 * W + "px", height: 0.82 * H + "px", zIndex: 2 }, { filter: "bw" });
    m.box.style.webkitMaskImage = `linear-gradient(${side > 0 ? "90deg" : "270deg"}, #000 60%, transparent 100%)`;
    X.T(m.box, "transform", `translateY(${0.3 * H}px)`).to(0.4, 0.4, "translateY(0px)", EASE_OUT);
    show(X, m.box, 0.4);
  }
  const top = tx(L, U(BR.round || ""), { cls: "gx", fs: 7 * u, x: W / 2, y: 0.03 * H, color: P.black, ls: 0.1 }); show(X, top.box, 0.2);
  rule(X, L, 0.12 * W, 0.045 * H, 0.76 * W, 5 * u, 0.1);
};

/* 9. números gigantes sobre blanco */
B.bigNumber = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.white }), ls = X.lines;
  const fs = Math.min(...ls.map(l => fit(U(l.text), "gx", -0.02, 0.36 * W, 0.4 * H)));
  ls.forEach((l, i) => sliceIn(X, L, l.text, 0.66 * W, 0.5 * H + (i - (ls.length - 1) / 2) * fs * 0.86, fs, P.black, Math.max(0.03, l.rt) + i * 0.06));
};

/* 10. pila de texto blanco sobre negro que se reordena (fecha / datos) */
B.stack = (sc, X) => {
  const { W, H } = X, L = div(X.root, "lay", { background: P.black }), ls = X.lines;
  const fs = Math.min(0.08 * H, ...ls.map(l => fit(U(l.text), "gx", -0.01, 0.34 * W, 1e9)));
  const align = sc.slot.align || "left", x = align === "right" ? 0.62 * W : align === "center" ? 0.5 * W : 0.3 * W, ax = align === "right" ? 1 : align === "center" ? 0.5 : 0;
  const y0 = (sc.slot.y ?? 0.5) * H - (ls.length - 1) * fs * 0.48;
  ls.forEach((l, i) => {
    const small = sc.slot.small && sc.slot.small.includes(i), f = small ? fs * 0.5 : fs;
    const t = tx(L, U(l.text), { cls: "gx", fs: f, x, y: y0 + i * fs * 0.96, ax, color: P.paper, ls: -0.01 });
    const at = Math.max(0.03, l.rt);
    show(X, t.box, at);
    X.T(t.el, "transform", `translateY(${(i % 2 ? -1 : 1) * 60}%)`).to(at, 0.22, "translateY(0%)", EASE_OUT);
  });
};

/* 11. logo final (imagen o texto) con destello */
B.logo = (sc, X) => {
  const { W, H, u } = X, L = div(X.root, "lay", { background: P.black });
  if (BR.logo) {
    const img = doc.createElement("img"); img.src = BR.logo; img.className = "media";
    Object.assign(img.style, { position: "absolute", left: W / 2 - 0.05 * W + "px", top: H / 2 - 0.08 * H + "px", width: 0.1 * W + "px", height: "auto", objectFit: "contain", inset: "auto" });
    L.appendChild(img); X.T(img, "opacity", "0").to(0.1, 0.4, "1", EASE_OUT);
  }
  const t = tx(L, U(X.lines[0]?.text || BR.name || ""), { cls: "gx", fs: BR.logo ? 16 * u : 44 * u, x: W / 2, y: BR.logo ? 0.6 * H : 0.47 * H, color: P.paper, ls: 0.05 });
  X.T(t.el, "opacity", "0").to(rt(X), 0.4, "1", EASE_OUT);
  if (X.lines[1]) { const s = tx(L, U(X.lines[1].text), { cls: "gx", fs: BR.logo ? 10 * u : 16 * u, x: W / 2, y: (BR.logo ? 0.6 * H + 22 * u : 0.47 * H + 48 * u), color: P.paper, ls: 0.3 }); X.T(s.el, "opacity", "0").to(Math.max(0.3, X.lines[1].rt), 0.4, "0.85", EASE_OUT); }
};

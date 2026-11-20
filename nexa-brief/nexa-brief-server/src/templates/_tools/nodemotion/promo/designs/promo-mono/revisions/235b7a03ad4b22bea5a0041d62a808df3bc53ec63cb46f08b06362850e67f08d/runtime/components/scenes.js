/* Promo Mono · escenas reutilizables. Cada escena lee sus renglones del guion
   (timeline: un segmento = una escena; «lines» = renglones) y sus parámetros
   del slot config.scenes[i]. Ninguna escena trae textos, marca ni medios fijos.
   headline  titular centrado (reserva)            playline  botón play + línea
   cardfan   abanico de tarjetas en semitono       wordgrid  palabra partida con ventanas de video
   chips     lluvia de píldoras de texto           linetext  línea + texto que se vuelve garabato
   pin       píldora con pin que se escribe        footage   metraje en semitono + subtítulo
   numbers   rejilla de cifras → porcentajes       pattern   patrón óptico + botón
   spaced    texto muy espaciado + eco             phonechat móvil con burbujas de chat
   coupon    cupones que vuelan + rótulo           codeinput móvil con campo de código
   contact   móvil con número o contacto grande */
const R = window.NexaPromo_promo_mono, k = R.kit, S = R.S;
const TEXT_IN = S.enum(["type", "rise", "pop", "fade", "wipe", "cut"], "type");
const port = X => X.W < X.H;

/* ------------------------------------------------------------------ headline */
R.scenes.headline = {
  label: "Titular centrado (+ renglón 2 pequeño)",
  params: { textIn: TEXT_IN, size: S.num(0.5, 1.6, 1), underline: S.bool(false) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const main = ls[0]?.text || "", fs = Math.min(k.fitFs(K, main, "hd", 0.84 * W * p.size, 0.16 * H * p.size), 84 * u * p.size);
    const w = k.text(X, K, L, main, { cls: "hd", fs, x: W / 2, y: H / 2, mode: p.textIn, t0: ls[0]?.rt ?? 0.1 });
    if (ls[1]?.text) k.text(X, K, L, ls[1].text, { cls: "ui", fs: fs * 0.32, x: W / 2, y: H / 2 + fs * 0.85, color: K.P.muted, mode: "fade", t0: ls[1].rt });
    if (p.underline) { const s = k.svg(L, W, H), y = H / 2 + fs * 0.62; k.draw(X, K, k.path(s, `M${W / 2 - w.width / 2},${y} H${W / 2 + w.width / 2}`, { stroke: K.P.fg, sw: k.sw(X, K) }), (ls[0]?.rt ?? 0) + 0.4, 0.4); }
  },
};

/* ------------------------------------------------------------------ playline */
R.scenes.playline = {
  label: "Botón de reproducir y línea que crece (+ texto opcional)",
  params: { lineLen: S.num(0.05, 0.6, 0.18), icon: S.enum(["play", "pause", "pin"], "play"), size: S.num(0.5, 2, 1) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const sz = 54 * u * p.size, len = p.lineLen * (port(X) ? H * 0.6 : W), x0 = W / 2 - (sz + len) / 2;
    const ic = K.div(L, "", { position: "absolute", left: x0 + "px", top: (H / 2 - sz / 2) + "px", width: sz + "px", height: sz + "px" });
    k.icon(ic, p.icon, sz, K.P.fg, { inner: K.P.bg, sw: sz * 0.07 });
    X.T(ic, "scale", "0").to(0.05, 0.35, "1", K.EASE_BACK);
    const s = k.svg(L, W, H), y = H / 2;
    k.draw(X, K, k.path(s, `M${x0 + sz * 1.35},${y} H${x0 + sz * 1.35 + len}`, { stroke: K.P.fg, sw: k.sw(X, K) }), 0.35, 0.6);
    if (ls[0]?.text) k.text(X, K, L, ls[0].text, { cls: "ui", fs: sz * 0.62, x: x0 + sz * 1.6 + len, y, ax: 0, t0: Math.max(0.9, ls[0].rt) });
  },
};

/* ------------------------------------------------------------------ cardfan */
R.scenes.cardfan = {
  label: "Abanico de tarjetas con fotos en semitono (+ palabra detrás)",
  params: { count: S.num(3, 10, 7), spread: S.num(4, 20, 11), cell: S.num(3, 14, 5) },
  render(sc, X, K) {
    const { W, H, u, r } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    if (ls[0]?.text) {
      const fs = Math.min(k.fitFs(K, ls[0].text, "hd", 1.1 * W, 0.2 * H), 110 * u);
      const back = K.tx(L, ls[0].text, { cls: "hd", fs, x: W / 2, y: H * 0.5, color: K.P.fg });
      X.T(back.el, "opacity", "0").to(ls[0].rt, 0.4, "1");
    }
    const ch = (port(X) ? 0.42 : 0.66) * H, cw = ch * 0.72;
    for (let i = 0; i < p.count; i++) {
      const spec = K.asStill(K.mediaSpec(sc, i));
      const card = K.div(L, "", { position: "absolute", left: (W / 2 - cw / 2) + "px", top: (H / 2 - ch / 2) + "px", width: cw + "px", height: ch + "px",
        transformOrigin: "50% 120%", zIndex: 3 + i, boxShadow: "0 0 0 1px rgba(255,255,255,0.35)" });
      k.halftone(X, K, card, spec, { left: 0, top: 0, width: cw + "px", height: ch + "px" }, { cell: p.cell, still: true });
      const a = (i - (p.count - 1) / 2) * p.spread + (r() - 0.5) * 3, dx = (i - (p.count - 1) / 2) * cw * 0.12;
      const t0 = 0.05 + i * 0.05;
      X.T(card, "transform", "translate(0px, 40px) rotate(0deg)").to(t0, 0.55, `translate(${dx.toFixed(0)}px, 0px) rotate(${a.toFixed(1)}deg)`, K.EASE_OUT)
        .to(Math.max(t0 + 0.6, X.dur - 0.5), 0.5, `translate(${(dx * 1.8).toFixed(0)}px, -${(H * 0.05).toFixed(0)}px) rotate(${(a * 1.6).toFixed(1)}deg)`, K.EASE_IN);
      X.T(card, "opacity", "0").to(t0, 0.15, "1");
    }
  },
};

/* ------------------------------------------------------------------ wordgrid */
R.scenes.wordgrid = {
  label: "Palabra repetida en filas, partida por ventanas de video",
  params: { rows: S.num(3, 7, 5), grade: S.enum(["mono", "none"], "mono"), split: S.enum(["auto", "hyphen", "middle"], "auto") },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), word = ls[0]?.text || "";
    k.bg(X, K); const L = k.layer(X, K);
    let a = word, b = "", joiner = " ";
    const hy = word.indexOf("-");
    if (p.split !== "middle" && hy > 0) { a = word.slice(0, hy); b = word.slice(hy + 1); joiner = "-"; }
    else { const m = Math.ceil(word.length / 2); a = word.slice(0, m); b = word.slice(m); joiner = ""; }
    const n = p.rows, rowH = Math.min((port(X) ? 0.6 : 0.84) * H / n, 120 * u);
    let fs = Math.min(rowH * 0.92, k.fitFs(K, a + joiner + b + "  ", "hd", (port(X) ? 0.9 : 0.8) * W, rowH));
    let gapW = Math.min(W * 0.28, fs * 2.4);
    /* las filas centrales llevan la ventana en medio: si no caben, se reduce el cuerpo */
    const span = K.textW(a, "hd", 0, fs) + K.textW(b, "hd", 0, fs) + gapW + fs * 0.3;
    if (span > 0.94 * W) { fs *= 0.94 * W / span; gapW = Math.min(W * 0.28, fs * 2.4); }
    const top = H / 2 - (n - 1) * rowH / 2;
    for (let i = 0; i < n; i++) {
      const y = top + i * rowH, edge = i === 0 || i === n - 1, t0 = 0.05 + i * 0.09;
      if (edge) {
        const w = K.tx(L, a + joiner + b, { cls: "hd", fs, x: W / 2, y, color: K.P.fg });
        X.T(w.el, "opacity", "0").to(t0, 0.25, "1");
        continue;
      }
      const wa = K.tx(L, a, { cls: "hd", fs, x: W / 2 - gapW / 2 - fs * 0.15, y, ax: 1, color: K.P.fg });
      const wb = K.tx(L, b, { cls: "hd", fs, x: W / 2 + gapW / 2 + fs * 0.15, y, ax: 0, color: K.P.fg });
      X.T(wa.el, "opacity", "0").to(t0, 0.25, "1"); X.T(wb.el, "opacity", "0").to(t0, 0.25, "1");
      const m = K.mbox(X, L, i, { left: (W / 2 - gapW / 2) + "px", top: (y - rowH * 0.48) + "px", width: gapW + "px", height: rowH * 0.96 + "px" }, { filter: p.grade === "none" ? null : "mono", off: i * 0.7 });
      X.T(m.box, "clipPath", "inset(0% 50% 0% 50%)").to(t0 + 0.15, 0.4, "inset(0% 0% 0% 0%)", K.EASE_IO);
    }
  },
};

/* ------------------------------------------------------------------ chips */
R.scenes.chips = {
  label: "Lluvia de píldoras de texto alrededor de un titular (float) o apiladas (pile)",
  params: { mode: S.enum(["float", "pile"], "float"), count: S.num(4, 90, 26), emoticons: S.bool(true), headline: S.bool(true) },
  render(sc, X, K) {
    const { W, H, u, r } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const pool = k.chipPool(K, X), emo = [":)", "<3", ":O", "=)", ":D", ";)"];
    const fs = 20 * u * (K.C.look.chipScale || 1) * (port(X) ? 1.15 : 1);
    const head = p.headline && p.mode === "float" ? ls[0]?.text : "";
    let hb = null;
    if (head) {
      const hfs = Math.min(k.fitFs(K, head, "hd", 0.6 * W, 0.16 * H), 78 * u);
      k.text(X, K, L, head, { cls: "hd", fs: hfs, x: W / 2, y: H / 2, t0: ls[0].rt, mode: "type" });
      hb = { x0: W / 2 - K.textW(head, "hd", 0, hfs) / 2 - 20 * u, x1: W / 2 + K.textW(head, "hd", 0, hfs) / 2 + 20 * u, y0: H / 2 - hfs * 0.8, y1: H / 2 + hfs * 0.8 };
    }
    const span = Math.max(0.6, X.dur * 0.75);
    for (let i = 0; i < p.count; i++) {
      const isEmo = p.emoticons && i % 5 === 4;
      const txt = isEmo ? emo[i % emo.length] : pool[i % pool.length];
      const t0 = 0.15 + span * i / p.count;
      if (p.mode === "float") {
        let x, y, tries = 0;
        do { x = W * (0.06 + r() * 0.88); y = H * (0.08 + r() * 0.84); tries++; }
        while (hb && tries < 30 && x > hb.x0 - 60 * u && x < hb.x1 + 60 * u && y > hb.y0 - 14 * u && y < hb.y1 + 14 * u);
        const c = k.pill(X, K, L, txt, { fs: isEmo ? fs * 1.1 : fs, x, y, tail: r() < 0.5 ? "l" : "r" });
        X.T(c.box, "scale", "0").to(t0, 0.25, "1", K.EASE_BACK);
      } else {
        /* montón: caen desde arriba y se apilan desde el fondo */
        const rowH = fs * 1.9, perRow = Math.max(3, Math.round(W / (fs * 9))), row = Math.floor(i / perRow);
        const x = W * ((i % perRow) + 0.5 + (r() - 0.5) * 0.8) / perRow, y = H - rowH * (row + 0.6) + (r() - 0.5) * rowH * 0.4;
        const rot = (r() - 0.5) * 70;
        const c = k.pill(X, K, L, txt, { fs, x, y, rot: 0, z: 3 + i });
        X.T(c.box, "translate", `0px ${(-y - 60 * u).toFixed(0)}px`).to(t0 * 0.8, 0.45, "0px 0px", K.EASE_IN);
        X.T(c.box, "rotate", `${(rot * 0.3).toFixed(1)}deg`).to(t0 * 0.8, 0.5, `${rot.toFixed(1)}deg`, K.EASE_OUT);
      }
    }
  },
};

/* ------------------------------------------------------------------ linetext */
R.scenes.linetext = {
  label: "Línea que entra desde el borde + texto; opcional garabato que la reemplaza",
  params: { squiggle: S.bool(true), lineLen: S.num(0.1, 0.6, 0.32) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), txt = ls[0]?.text || "";
    k.bg(X, K); const L = k.layer(X, K);
    const s = k.svg(L, W, H), y = H / 2, fs = Math.min(k.fitFs(K, txt, "hd", 0.45 * W, 0.1 * H), 56 * u);
    const len = p.lineLen * W, x0 = W / 2 - (len + K.textW(txt, "hd", 0, fs) + fs * 0.6) / 2;
    const line = k.path(s, `M${x0 - W * 0.1},${y} H${x0 + len}`, { stroke: K.P.fg, sw: k.sw(X, K) });
    k.draw(X, K, line, 0.05, 0.45);
    const w = k.text(X, K, L, txt, { cls: "hd", fs, x: x0 + len + fs * 0.6, y, ax: 0, t0: Math.max(0.4, ls[0]?.rt ?? 0.4) });
    if (p.squiggle && X.dur > 1.4) {
      const t1 = X.dur * 0.55;
      X.T(w.box, "opacity", "1").to(t1, 0.2, "0");
      k.erase(X, K, line, t1, 0.35);
      const sq = k.path(s, k.squiggle(W * 0.38, H * 0.62, W * 0.24, H * 0.12, X.sc.idx + 1), { stroke: K.P.fg, sw: k.sw(X, K) });
      k.draw(X, K, sq, t1 + 0.15, 0.5);
    }
  },
};

/* ------------------------------------------------------------------ pin */
R.scenes.pin = {
  label: "Píldora con pin de ubicación que crece mientras se escribe",
  params: { size: S.num(0.5, 2, 1), outline: S.bool(true) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X), txt = ls[0]?.text || "";
    k.bg(X, K); const L = k.layer(X, K);
    const fs = Math.min(k.fitFs(K, txt, "ui", 0.6 * W, 0.1 * H), 52 * u) * p.size;
    const pl = k.pill(X, K, L, txt, { fs, x: W / 2, y: H / 2, outline: p.outline, icon: "pin" });
    const t0 = ls[0]?.rt ?? 0.1, n = [...txt].length, dt = Math.min(0.06, 0.8 / Math.max(1, n));
    X.T(pl.box, "scale", "0.5").to(t0, 0.3, "1", K.EASE_BACK);
    const chars = [...txt]; pl.label.textContent = "";
    chars.forEach((c, i) => { const sp = document.createElement("span"); sp.textContent = c; sp.style.whiteSpace = "pre"; pl.label.appendChild(sp); X.T(sp, "display", "none", true).set(t0 + 0.15 + i * dt, "inline"); });
  },
};

/* ------------------------------------------------------------------ footage */
R.scenes.footage = {
  label: "Metraje a pantalla completa en semitono (o gris) + subtítulo + icono",
  params: { style: S.enum(["dots", "squares", "gray"], "dots"), cell: S.num(3, 20, 7), dotsIn: S.bool(false), icon: S.enum(["none", "bars", "pause", "play"], "none"),
    subtitle: S.enum(["dash", "plain", "none"], "dash"), zoom: S.bool(true) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const css = { left: 0, top: 0, width: W + "px", height: H + "px" };
    let m;
    if (p.style === "gray") m = K.mbox(X, L, 0, css, { filter: "mono" });
    else m = k.halftone(X, K, L, 0, css, { grade: "mono", cell: p.cell, shape: p.style === "squares" ? "square" : "dot", cellFrom: p.dotsIn ? 60 : 0, cellSec: 0.7 });
    if (p.zoom) X.T(m.box, "scale", "1").to(0, X.dur, "1.08");
    const txt = ls[0]?.text;
    if (txt && p.subtitle !== "none") {
      const t = (p.subtitle === "dash" ? "– " : "") + txt;
      const fs = Math.min(k.fitFs(K, t, "ui", 0.86 * W, 0.1 * H), 54 * u);
      const w = K.tx(L, t, { cls: "ui", fs, x: W / 2, y: H * (port(X) ? 0.78 : 0.82), color: "#FFFFFF" });
      /* blanco con sombra: legible sobre puntos claros y oscuros (mix-blend-mode
         sobre un canvas que cambia cada cuadro baja de 60 a 6 fps en headless) */
      w.el.style.textShadow = "0 0 8px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.9)"; w.box.style.zIndex = 5;
      X.T(w.el, "opacity", "0").to(ls[0].rt, 0.2, "1");
    }
    if (p.icon !== "none") {
      const sz = 46 * u, ic = K.div(L, "", { position: "absolute", left: (W / 2 - sz / 2) + "px", top: (H / 2 - sz / 2) + "px", width: sz + "px", height: sz + "px", zIndex: 6, filter: "drop-shadow(0 0 6px rgba(0,0,0,0.8))" });
      k.icon(ic, p.icon, sz, "#FFFFFF", { inner: "#000000" });
      X.T(ic, "opacity", "0").to(0.3, 0.15, "1").to(Math.max(0.6, X.dur - 0.4), 0.2, "0");
    }
  },
};

/* ------------------------------------------------------------------ numbers */
R.scenes.numbers = {
  label: "Rejilla de cifras que parpadean y dejan sólo las cifras del guion",
  params: { flicker: S.num(0.05, 0.4, 0.12), collapse: S.num(0.2, 0.9, 0.45) },
  render(sc, X, K) {
    const { W, H, u, r } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const cols = port(X) ? 9 : 16, rows = port(X) ? 14 : 8, cw = W / cols, rh = H / rows, fs = Math.min(cw, rh) * 0.42;
    const tc = X.dur * p.collapse, steps = Math.max(1, Math.floor(tc / p.flicker));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const cx = (x + 0.5) * cw, cy = (y + 0.5) * rh;
      const w = K.tx(L, String(Math.floor(r() * 10)), { cls: "ui num", fs, x: cx, y: cy, color: K.P.fg });
      const tr = X.T(w.el, "@textContent", w.el.textContent, true);
      for (let s = 1; s <= steps; s++) tr.set(s * p.flicker, String(Math.floor(r() * 10)));
      const dist = Math.hypot(cx - W / 2, cy - H / 2) / Math.hypot(W / 2, H / 2);
      X.T(w.el, "opacity", "0").to(0.02 + dist * 0.25, 0.1, "1").to(tc + (1 - dist) * 0.35, 0.15, "0");
    }
    const stats = ls.map(l => l.text).filter(Boolean);
    const pos = [[-0.04, -0.07], [-0.12, 0.03], [0.09, 0.0], [0.02, 0.1], [0.14, -0.08]];
    stats.forEach((t, i) => {
      const [dx, dy] = pos[i % pos.length], sfs = 48 * u * (i === 1 ? 1.1 : 1);
      const w = K.tx(L, t, { cls: "ui num", fs: sfs, x: W / 2 + dx * W, y: H / 2 + dy * H, color: K.P.fg });
      X.T(w.el, "opacity", "0").to(tc + 0.1 + i * 0.08, 0.2, "1");
      X.T(w.el, "transform", "scale(0.6)").to(tc + 0.1 + i * 0.08, 0.35, "scale(1)", K.EASE_BACK);
    });
  },
};

/* ------------------------------------------------------------------ pattern */
R.scenes.pattern = {
  label: "Patrón óptico de puntos en onda + botón central (pausa o play)",
  params: { icon: S.enum(["pause", "play", "none"], "pause"), cell: S.num(20, 120, 56), speed: S.num(0.2, 4, 1.4) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p;
    k.bg(X, K); const L = k.layer(X, K);
    const cv = document.createElement("canvas"); cv.width = Math.round(W); cv.height = Math.round(H); cv.className = "media";
    Object.assign(cv.style, { position: "absolute", left: 0, top: 0 }); L.appendChild(cv);
    const g = cv.getContext("2d"), cell = p.cell * u, cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
    const drv = { set p(v) {
      const t = parseFloat(v) || 0;
      g.fillStyle = K.P.bg; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = K.P.fg; g.beginPath();
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const cx = (x + 0.5) * cell, cy = (y + 0.5) * cell, d = Math.hypot(cx - W / 2, cy - H / 2) / cell;
        const rr = cell * 0.5 * (0.45 + 0.4 * Math.sin(d * 0.9 - t * p.speed * 3));
        g.moveTo(cx + rr, cy); g.arc(cx, cy, Math.max(0.5, rr), 0, Math.PI * 2);
      }
      g.fill();
    } };
    X.T(drv, "@p", "0").to(0, X.dur + 1, (X.dur + 1).toFixed(3));
    if (p.icon !== "none") {
      const sz = 52 * u, ic = K.div(L, "", { position: "absolute", left: (W / 2 - sz / 2) + "px", top: (H / 2 - sz / 2) + "px", width: sz + "px", height: sz + "px", background: K.P.bg, borderRadius: "50%", zIndex: 3 });
      k.icon(ic, p.icon, sz, K.P.fg, { inner: K.P.bg });
      X.T(ic, "scale", "0.4").to(0.1, 0.35, "1", K.EASE_BACK);
    }
  },
};

/* ------------------------------------------------------------------ spaced */
R.scenes.spaced = {
  label: "Texto en mayúsculas muy espaciado, palabra a palabra; eco apilado del último renglón",
  params: { tracking: S.num(0.1, 1.2, 0.7), echo: S.num(0, 8, 0) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const n = ls.length, fs = Math.min(...ls.map(l => k.fitFs(K, l.text.toUpperCase(), "sp", 0.9 * W, 0.08 * H, p.tracking)), 34 * u);
    const lineEls = [];
    ls.forEach((l, i) => {
      lineEls[i] = [];
      const y = n === 1 ? H / 2 : H * (0.3 + 0.4 * i / (n - 1));
      const words = l.text.toUpperCase().split(/\s+/);
      const total = K.textW(words.join(" "), "sp", p.tracking, fs);
      let x = W / 2 - total / 2;
      words.forEach((wd, j) => {
        const w = K.tx(L, wd, { cls: "sp", fs, x, y, ax: 0, color: K.P.fg, ls: p.tracking });
        X.T(w.el, "opacity", "0").to(l.rt + j * 0.18, 0.15, "1");
        lineEls[i].push(w.box);
        x += K.textW(wd + " ", "sp", p.tracking, fs);
      });
    });
    if (p.echo > 0 && n) {
      const last = ls[n - 1].text.toUpperCase(), gap = fs * 1.6, t0 = Math.max(ls[n - 1].rt + 0.5, X.dur * 0.55);
      const y0 = n === 1 ? H / 2 : H * 0.7;
      /* el eco ocupa la pantalla: los renglones anteriores se apagan antes */
      lineEls.slice(0, -1).flat().forEach(el => X.T(el, "opacity", "1").to(t0 - 0.15, 0.15, "0"));
      for (let e = 1; e <= p.echo; e++) for (const sgn of [-1, 1]) {
        const w = K.tx(L, last, { cls: "sp", fs, x: W / 2, y: y0 + sgn * e * gap, color: K.P.fg, ls: p.tracking });
        X.T(w.el, "opacity", "0").to(t0 + e * 0.06, 0.15, String(Math.max(0.15, 1 - e * 0.16)));
      }
    }
  },
};

/* ------------------------------------------------------------------ phonechat */
R.scenes.phonechat = {
  label: "Móvil (punteado) con burbujas de chat que llegan; garabato opcional",
  params: { dotted: S.bool(true), squiggle: S.bool(false), size: S.num(0.5, 1.2, 0.86) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const ph = k.phone(X, K, L, { x: W / 2, y: H / 2 + H * 0.05, h: H * p.size, dotted: p.dotted });
    X.T(ph.wrap, "translate", `0px ${(H * 0.3).toFixed(0)}px`).to(0, 0.5, "0px 0px", K.EASE_OUT);
    const sw = ph.w * 0.88, fs = Math.max(11, ph.h * 0.034);
    let y = ph.h * 0.12;
    ls.forEach((l, i) => {
      if (!l.text) return;
      const side = i % 2 ? "l" : "r";
      const maxW = sw * 0.7;
      const b = k.bubble(X, K, ph.screen, l.text, { fs, x: side === "r" ? sw * 0.92 : sw * 0.1, y, side, maxW, cw: sw });
      X.T(b, "opacity", "0").to(Math.max(0.4, l.rt), 0.2, "1");
      X.T(b, "translate", `0px ${(fs * 1.5).toFixed(0)}px`).to(Math.max(0.4, l.rt), 0.3, "0px 0px", K.EASE_OUT);
      /* alto estimado: renglones según el ancho útil (≈0,5 em por carácter) + relleno */
      const perLine = Math.max(6, Math.floor((maxW - fs * 1.4) / (fs * 0.52)));
      y += fs * (1.25 * Math.ceil(l.text.length / perLine) + 1.1) + fs * 0.9;
    });
    if (p.squiggle) {
      const s = k.svg(ph.screen, sw, ph.h * 0.88);
      const d = `M${sw * 0.5},${ph.h * 0.82} C${sw * 0.3},${ph.h * 0.7} ${sw * 0.7},${ph.h * 0.62} ${sw * 0.45},${ph.h * 0.5}`;
      k.draw(X, K, k.path(s, d, { stroke: K.P.fg, sw: k.sw(X, K) }), Math.max(0.6, X.dur * 0.5), 0.6);
    }
  },
};

/* ------------------------------------------------------------------ coupon */
R.scenes.coupon = {
  label: "Cupones que entran girando desde los bordes + rótulo central",
  params: { count: S.num(2, 8, 4) },
  render(sc, X, K) {
    const { W, H, u, r } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    if (ls[0]?.text) k.text(X, K, L, ls[0].text, { cls: "hd", fs: Math.min(k.fitFs(K, ls[0].text, "hd", 0.5 * W, 0.1 * H), 44 * u), x: W / 2, y: H / 2, t0: ls[0].rt, mode: "type" });
    for (let i = 0; i < p.count; i++) {
      const tw = (port(X) ? 0.38 : 0.2) * W * (0.8 + r() * 0.5);
      const a = (i / p.count) * Math.PI * 2 + r() * 0.6, rx = W * 0.36, ry = H * 0.36;
      const x = W / 2 + Math.cos(a) * rx, y = H / 2 + Math.sin(a) * ry;
      const t = k.ticket(X, K, L, { w: tw, x, y });
      const rot = (r() - 0.5) * 80, t0 = 0.05 + i * 0.12;
      X.T(t, "transform", `translate(${(Math.cos(a) * W * 0.5).toFixed(0)}px, ${(Math.sin(a) * H * 0.5).toFixed(0)}px) rotate(${(rot * 2).toFixed(0)}deg)`)
        .to(t0, 0.6, `translate(0px, 0px) rotate(${rot.toFixed(0)}deg)`, K.EASE_OUT)
        .to(Math.max(t0 + 0.7, X.dur - 0.45), 0.45, `translate(${(Math.cos(a) * W * 0.6).toFixed(0)}px, ${(Math.sin(a) * H * 0.6).toFixed(0)}px) rotate(${(rot * 3).toFixed(0)}deg)`, K.EASE_IN);
    }
  },
};

/* ------------------------------------------------------------------ codeinput */
R.scenes.codeinput = {
  label: "Móvil con campo donde se escribe un código y dos botones (renglón 1 = código, 2 y 3 = botones)",
  params: { ticket: S.bool(true), size: S.num(0.5, 1.2, 0.8) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const ph = k.phone(X, K, L, { x: W / 2, y: H / 2, h: H * p.size, dotted: false, screen: K.P.chip });
    const sw = ph.w * 0.88, fs = Math.max(11, ph.h * 0.028), y = ph.h * 0.36;
    const field = K.div(ph.screen, "ui", { position: "absolute", left: sw * 0.08 + "px", top: y + "px", width: sw * 0.84 + "px", height: fs * 2.2 + "px",
      border: `${Math.max(1.5, fs * 0.09)}px solid ${K.P.chipText}`, borderRadius: fs * 0.3 + "px", color: K.P.chipText, fontSize: fs + "px",
      display: "flex", alignItems: "center", paddingLeft: fs * 0.6 + "px", letterSpacing: "0.04em" });
    const code = ls[0]?.text || "";
    [...code].forEach((c, i) => { const s = document.createElement("span"); s.textContent = c; s.style.whiteSpace = "pre"; field.appendChild(s); X.T(s, "display", "none", true).set((ls[0]?.rt ?? 0.4) + 0.3 + i * 0.05, "inline"); });
    const btn = (label, i, fill) => {
      const b = K.div(ph.screen, "ub", { position: "absolute", left: (sw * 0.08 + i * sw * 0.44) + "px", top: (y + fs * 3) + "px", width: sw * 0.4 + "px", height: fs * 2 + "px",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: fs * 0.9 + "px", borderRadius: fs * 0.3 + "px",
        background: fill ? K.P.chipText : "transparent", color: fill ? K.P.chip : K.P.chipText, border: `${Math.max(1.5, fs * 0.08)}px solid ${K.P.chipText}` });
      b.textContent = label;
      X.T(b, "opacity", "0").to(0.35 + i * 0.1, 0.25, "1");
      return b;
    };
    btn(ls[1]?.text || "Cancelar", 0, false);
    const ok = btn(ls[2]?.text || "Aplicar", 1, true);
    X.T(ok, "scale", "1").to(Math.max(1, X.dur * 0.75), 0.12, "0.92").to(Math.max(1.12, X.dur * 0.75 + 0.12), 0.15, "1", K.EASE_BACK);
    X.T(ph.wrap, "scale", "0.85").to(0, 0.5, "1", K.EASE_OUT);
    if (p.ticket) {
      const t = k.ticket(X, K, L, { w: ph.w * 0.7, x: W / 2 - ph.w * 0.7, y: H * 0.62, z: 4 });
      X.T(t, "transform", "translate(-120px, 40px) rotate(-30deg)").to(0.05, 0.6, "translate(0px, 0px) rotate(-12deg)", K.EASE_OUT)
        .to(0.9, 0.5, `translate(${(ph.w * 0.55).toFixed(0)}px, -${(H * 0.05).toFixed(0)}px) rotate(0deg) scale(0.4)`, K.EASE_IN);
      X.T(t, "opacity", "1").to(1.3, 0.2, "0");
    }
  },
};

/* ------------------------------------------------------------------ contact */
R.scenes.contact = {
  label: "Móvil grande punteado con encabezado y un número o contacto enorme (renglón 1 = encabezado, 2+ = número)",
  params: { size: S.num(0.6, 1.3, 1.05), brand: S.bool(true) },
  render(sc, X, K) {
    const { W, H, u } = X, p = X.p, ls = K.lines(X);
    k.bg(X, K); const L = k.layer(X, K);
    const ph = k.phone(X, K, L, { x: W / 2, y: H * 0.56, h: H * p.size, dotted: true });
    X.T(ph.wrap, "translate", `0px ${(H * 0.4).toFixed(0)}px`).to(0, 0.6, "0px 0px", K.EASE_OUT);
    const sw = ph.w * 0.88, cx = sw / 2;
    let y = ph.h * 0.1;
    if (p.brand && K.BR.name) { const b = K.tx(ph.screen, K.BR.name, { cls: "ub", fs: ph.h * 0.022, x: cx, y, color: K.P.fg }); X.T(b.el, "opacity", "0").to(0.4, 0.3, "1"); y += ph.h * 0.05; }
    if (ls[0]?.text) {
      const hf = Math.min(k.fitFs(K, ls[0].text, "ub", sw * 0.86, ph.h * 0.06), ph.h * 0.045);
      const h = K.tx(ph.screen, ls[0].text, { cls: "ub", fs: hf, x: cx, y: y + hf, color: K.P.fg });
      X.T(h.el, "opacity", "0").to(Math.max(0.5, ls[0].rt), 0.3, "1");
      y += hf * 2.6;
    }
    ls.slice(1).forEach((l, i) => {
      const big = i === 0 && l.text.length <= 5 ? 0.6 : 1;
      const fs = Math.min(k.fitFs(K, l.text, "hd", sw * 0.9, ph.h * 0.12), ph.h * 0.11) * big;
      const w = K.tx(ph.screen, l.text, { cls: "hd num", fs, x: cx, y: y + fs * 0.6, color: K.P.fg });
      X.T(w.el, "opacity", "0").to(Math.max(0.7, l.rt), 0.25, "1");
      X.T(w.el, "transform", "translateY(20px)").to(Math.max(0.7, l.rt), 0.4, "translateY(0px)", K.EASE_OUT);
      y += fs * 1.1;
    });
  },
};

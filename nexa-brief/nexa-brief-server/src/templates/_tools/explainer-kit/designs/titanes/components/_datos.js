/* Composición de datos. Los escenarios, figuras, grano y transiciones vienen de _titanes. */
(function () {
  "use strict";
  const K = window.Kit, T = K.titanes;
  const D = T.data = {};
  D.finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  D.format = (value, decimals = 0, compact = false) => {
    const n = D.finite(value), digits = K.clamp(Math.round(decimals), 0, 6);
    const scale = compact && Math.abs(n) >= 1e6 ? 1e6 : compact && Math.abs(n) >= 1e3 ? 1e3 : 1;
    const parts = (Math.abs(n) / scale).toFixed(digits).split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return (n < 0 ? "−" : "") + parts.join(",") + (scale === 1e6 ? " M" : scale === 1e3 ? " mil" : "");
  };
  D.box = st => ({ x: st.W * .09, right: st.W * (st.portrait ? .83 : .91), w: st.W * (st.portrait ? .74 : .82), top: st.H * .14, bottom: st.H * (st.portrait ? .72 : .84) });
  D.line = (g, points, color, width) => {
    g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.lineWidth = width; g.strokeStyle = color; g.stroke();
  };
  D.fit = (g, text, width, maximum, font = "Inter", weight = 900) => {
    g.save(); g.font = `${weight} 100px ${font}`;
    const size = Math.min(maximum, width / Math.max(1, g.measureText(String(text)).width) * 100);
    g.restore(); return size;
  };
  D.label = (g, text, x, y, width, size, color, options = {}) => {
    const fitted = D.fit(g, text, width, size, options.font || "Inter", options.weight ?? 900);
    T.text(g, String(text ?? ""), x, y, fitted, color, { weight: 900, ...options });
  };
  D.numberParts = (g, text, size) => {
    g.save(); g.font = `900 ${size}px Inter`;
    const cell = Math.max(...Array.from("0123456789", n => g.measureText(n).width));
    const match = String(text).match(/^([−+\-]?)([\d.,]+)(.*)$/);
    const [, sign, digits, suffix] = match || ["", "", "", String(text)];
    const signWidth = sign ? g.measureText(sign).width + cell * .12 : 0;
    const digitWidth = [...digits].reduce((sum, ch) => sum + cell * (/[0-9]/.test(ch) ? 1 : .5), 0);
    const suffixWidth = suffix ? g.measureText(suffix).width + cell * .1 : 0;
    g.restore(); return { sign, digits, suffix, signWidth, digitWidth, width: signWidth + digitWidth + suffixWidth };
  };
  D.numberWidth = (g, text, size) => D.numberParts(g, text, size).width;
  D.drawNumber = (g, text, x, y, size, color) => {
    const parts = D.numberParts(g, text, size);
    T.text(g, parts.sign, x, y, size, color, { weight: 900 });
    T.number(g, parts.digits, x + parts.signWidth, y, size, color);
    T.text(g, parts.suffix, x + parts.signWidth + parts.digitWidth, y, size, color, { weight: 900 });
  };
  D.number = (g, text, x, y, width, maxSize, color) => {
    const size = Math.min(maxSize, width / Math.max(1, D.numberWidth(g, text, 100)) * 100);
    D.drawNumber(g, text, x, y, size, color); return size;
  };
  D.heading = (g, st, text, P) => {
    const box = D.box(st);
    D.label(g, String(text || "").toUpperCase(), box.x, box.top + st.u * 3, box.w, st.u * (st.portrait ? 6 : 6.3), P.ink, { font: "Anton", weight: 400 });
  };
  D.source = (g, st, text, P) => {
    if (!text) return;
    const box = D.box(st);
    D.label(g, text, box.x, box.bottom, box.w, st.u * 2.1, P.muted, { weight: 400 });
  };
  D.panel = (g, x, y, w, h, P, color = P.rim) => {
    g.save(); g.shadowColor = T.color(P.black, .8); g.shadowBlur = h * .10; g.shadowOffsetY = h * .035;
    const fill = g.createLinearGradient(x, y, x + w, y + h);
    fill.addColorStop(0, T.color(P.graphite, .96)); fill.addColorStop(1, T.color(P.tinta, .92));
    g.fillStyle = fill; g.fillRect(x, y, w, h); g.shadowBlur = 0; g.shadowOffsetY = 0;
    D.line(g, [[x, y + h], [x, y], [x + w, y]], T.color(color, .5), 1);
    T.glow(g, x + w * .7, y + h * .12, w * .7, h * .5, color, .12); g.restore();
  };
  D.params = {
    ...T.params, ...T.transitionParams,
    titulo: { type: "string", default: "", doc: "Título breve. Vacío lo apaga." },
    fuente: { type: "string", default: "", doc: "Fuente opcional y breve, en zona segura." },
  };
  D.scene = (ctx, p, preset, draw, dispose = () => {}) => {
    ctx.beat.hideCaptions = true;
    const bg = T.background(ctx, p, preset), g = ctx.g.main;
    return {
      render(t, beat) {
        g.save(); bg.render(t, beat, t + beat.t0); T.scrim(g, ctx.stage, T.palette(ctx, p));
        draw(t, beat); g.restore(); T.edges(ctx, p, t, beat);
      },
      dispose() { bg.dispose(); dispose(); },
    };
  };
  D.prepareImages = async paths => {
    for (const src of new Set(paths.filter(Boolean))) {
      const image = await K.image(src);
      if (image) K.loaded.set(src, image);
    }
  };
  // El orden visual depende del tiempo absoluto, también después de un seek inverso.
  D.active = (items, t, duration) => {
    let index = 0;
    for (let i = 1; i < items.length; i++) if (t >= D.finite(items[i].at, i * duration / items.length)) index = i;
    return { item: items[index], index, at: D.finite(items[index].at, index * duration / items.length) };
  };
})();

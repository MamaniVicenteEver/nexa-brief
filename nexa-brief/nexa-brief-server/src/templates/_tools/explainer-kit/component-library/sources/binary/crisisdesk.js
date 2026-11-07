(function () {
  const K = Kit, B = Kit.binary, { clamp, prog } = K;
  K.register({
    name: "binary.crisisdesk",
    tags: ["sala de crisis", "guardia", "contingencia", "Y2K"],
    layer: "main",
    summary: "Una mesa de operaciones con tres terminales y una persona de guardia; los indicadores recorren reporte, respaldo y recuperación.",
    example: { label: "CENTRO DE OPERACIONES", states: ["REPORTE", "RESPALDO", "RECUPERACIÓN"] },
    params: {
      label: { type: "string", default: "CENTRO DE OPERACIONES", doc: "Nombre corto del centro." },
      states: { type: "array", default: ["REPORTE", "RESPALDO", "RECUPERACIÓN"], doc: "Tres etapas de la guardia." },
      morph: { type: "number", default: 1.2, min: 0.3, max: 3, doc: "Tiempo para formar la sala." },
    },
    points(ctx, p) {
      const portrait = !!ctx.stage.portrait;
      const box = B.boxIn(ctx, portrait ? 0.82 : 0.76, portrait ? 0.46 : 1.5);
      const pts = B.sampleShape((g, w, h) => {
        g.fillStyle = ctx.C.palette.ink;
        const monitorW = w * (portrait ? 0.36 : 0.22);
        const monitorH = h * (portrait ? 0.14 : 0.29);
        const centers = portrait
          ? [[w * 0.30, h * 0.18], [w * 0.70, h * 0.18], [w * 0.50, h * 0.38]]
          : [[w * 0.19, h * 0.28], [w * 0.5, h * 0.28], [w * 0.81, h * 0.28]];
        for (const [x, y] of centers) {
          g.fillRect(x - monitorW / 2, y - monitorH / 2, monitorW, monitorH);
          g.globalCompositeOperation = "destination-out";
          g.fillRect(x - monitorW * 0.42, y - monitorH * 0.36, monitorW * 0.84, monitorH * 0.68);
          g.globalCompositeOperation = "source-over";
          g.fillRect(x - w * 0.012, y + monitorH * 0.5, w * 0.024, h * 0.11);
          g.fillRect(x - w * 0.07, y + monitorH * 0.5 + h * 0.105, w * 0.14, h * 0.018);
        }
        const deskY = h * (portrait ? 0.57 : 0.53);
        g.fillRect(w * 0.08, deskY, w * 0.84, Math.max(2, h * 0.025));
        const headX = w * 0.5, headY = h * (portrait ? 0.73 : 0.72), headR = Math.min(w, h) * 0.075;
        g.beginPath(); g.arc(headX, headY, headR, 0, Math.PI * 2); g.fill();
        g.fillRect(headX - headR * 0.65, headY + headR * 0.72, headR * 1.3, h * 0.13);
        // Consola frontal: la persona está trabajando en sistemas, no mirando una alarma abstracta.
        const consoleY = h * (portrait ? 0.93 : 0.91);
        g.fillRect(w * 0.31, consoleY, w * 0.38, h * 0.035);
        const alertX = w * 0.84, alertY = h * (portrait ? 0.75 : 0.72), alertR = Math.min(w, h) * 0.055;
        g.beginPath(); g.arc(alertX, alertY, alertR, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = "destination-out";
        g.beginPath(); g.arc(alertX, alertY, alertR * 0.55, 0, Math.PI * 2); g.fill();
        g.globalCompositeOperation = "source-over";
        g.fillRect(alertX - alertR * 0.045, alertY - alertR * 0.28, alertR * 0.09, alertR * 0.34);
        g.beginPath(); g.arc(alertX, alertY + alertR * 0.28, Math.max(2, alertR * 0.07), 0, Math.PI * 2); g.fill();
      }, box, { cell: B.cellOf(ctx, 0.9), edge: true, jitter: 0.22, seed: 931 });
      return B.pack(pts, ctx.family.binary.N);
    },
    motion: lt => ({ s: 1 + lt * 0.004 }),
    reveal: (lt, b, p) => clamp(lt / Math.max(0.4, p.morph ?? 1)),
    create(ctx, p) {
      const G = ctx.g.top, P = ctx.C.palette, { u, cx, content: c, portrait } = ctx.stage;
      const states = Array.isArray(p.states) ? p.states.slice(0, 3) : ["REPORTE", "RESPALDO", "RECUPERACIÓN"];
      const points = portrait
        ? [[cx, c.y + c.h * 0.24], [cx, c.y + c.h * 0.5], [cx, c.y + c.h * 0.76]]
        : [[c.x + c.w * 0.22, c.y + c.h * 0.84], [cx, c.y + c.h * 0.84], [c.x + c.w * 0.78, c.y + c.h * 0.84]];
      return {
        render(lt, b) {
          const a = B.fadeIO(lt, b.dur, 0.5, 0.45, (p.morph ?? 1) * 0.35);
          const step = Math.max(1, b.dur - 1) / 3;
          const active = Math.min(2, Math.floor(Math.max(0, lt - 1) / step));
          const pulse = 0.7 + Math.sin(lt * 3.2) * 0.18;
          G.save();
          G.globalAlpha = a;
          if (p.label) B.tag(G, p.label, cx, c.y + u * 3.1, { u, size: 1.6, alpha: a, bg: P.ink, color: P.bg });
          points.forEach(([x, y], i) => {
            const done = i < active;
            G.globalAlpha = a * (i === active ? pulse : done ? 0.85 : 0.35);
            G.fillStyle = i === active ? P.accent : P.ink;
            G.beginPath(); G.arc(x, y, u * (i === active ? 0.68 : 0.48), 0, Math.PI * 2); G.fill();
            const tx = portrait ? x + u * 11 : x;
            const ty = portrait ? y + u * 0.55 : y + u * 3.2;
            B.mono(G, String(states[i] ?? ""), tx, ty, { u, size: 1.6, weight: i === active ? 800 : 500, color: i === active ? P.accent : P.ink, alpha: a * (i === active ? 1 : 0.7), align: portrait ? "left" : "center", spacing: u * 0.1 });
          });
          G.restore();
        },
        dispose() {},
      };
    },
  });
})();

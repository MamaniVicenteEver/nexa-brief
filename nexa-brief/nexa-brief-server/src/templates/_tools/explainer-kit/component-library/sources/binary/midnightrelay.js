(function () {
  const K = Kit, B = Kit.binary, { clamp, prog, lerp } = K;
  K.register({
    name: "binary.midnightrelay",
    tags: ["husos horarios", "Kiribati", "Nueva Zelanda", "medianoche", "Y2K"],
    layer: "main",
    summary: "Una ruta de tres relojes enlaza Kiritimati, Chatham y Auckland mientras el cambio de fecha avanza por el Pacífico.",
    example: { label: "EL CAMBIO VIAJA", first: "MILLENNIUM", second: "CHATHAM", third: "AUCKLAND" },
    params: {
      label: { type: "string", default: "EL CAMBIO VIAJA", doc: "Título corto de la ruta." },
      first: { type: "string", default: "MILLENNIUM", doc: "Primera isla reportada en entrar al año nuevo." },
      second: { type: "string", default: "CHATHAM", doc: "Zona de Nueva Zelanda que entra quince minutos después." },
      third: { type: "string", default: "AUCKLAND", doc: "Siguiente referencia horaria." },
    },
    points(ctx, p) {
      const box = B.boxIn(ctx, 0.72, ctx.stage.portrait ? 0.72 : 1.45);
      const vertical = !!ctx.stage.portrait;
      const pts = B.sampleShape((g, w, h) => {
        g.fillStyle = ctx.C.palette.ink;
        const pos = vertical
          ? [[w * 0.22, h * 0.18], [w * 0.78, h * 0.5], [w * 0.22, h * 0.82]]
          : [[w * 0.18, h * 0.5], [w * 0.5, h * 0.5], [w * 0.82, h * 0.5]];
        const r = vertical ? w * 0.17 : Math.min(w, h) * 0.13;
        g.lineWidth = Math.max(2, Math.min(w, h) * 0.018);
        g.strokeStyle = ctx.C.palette.ink;
        g.beginPath(); g.moveTo(pos[0][0], pos[0][1]); g.lineTo(pos[2][0], pos[2][1]); g.stroke();
        for (const [x, y] of pos) {
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          g.globalCompositeOperation = "destination-out";
          g.beginPath(); g.arc(x, y, r * 0.7, 0, Math.PI * 2); g.fill();
          g.globalCompositeOperation = "source-over";
          g.fillRect(x - r * 0.04, y - r * 0.56, r * 0.08, r * 0.45);
          g.fillRect(x - r * 0.04, y - r * 0.04, r * 0.46, r * 0.08);
        }
      }, box, { cell: B.cellOf(ctx, 0.9), edge: true, jitter: 0.18, seed: 7402 });
      return B.pack(pts, ctx.family.binary.N);
    },
    motion: lt => ({ s: 1 + lt * 0.004 }),
    reveal: (lt, b) => clamp(lt / Math.max(1, Math.min(2, b.dur * 0.22))),
    create(ctx, p) {
      const G = ctx.g.top, P = ctx.C.palette, { u, cx, cy, content: c, portrait } = ctx.stage;
      const nodes = portrait
        ? [[c.x + c.w * 0.22, c.y + c.h * 0.18], [c.x + c.w * 0.78, c.y + c.h * 0.5], [c.x + c.w * 0.22, c.y + c.h * 0.82]]
        : [[c.x + c.w * 0.18, cy], [cx, cy], [c.x + c.w * 0.82, cy]];
      const names = [p.first, p.second, p.third];
      return {
        render(lt, b) {
          const a = B.fadeIO(lt, b.dur, 0.45, 0.45, 0.1);
          const q = prog(lt, 1.2, Math.max(2.8, b.dur - 1.2), "inOut");
          const seg = Math.min(1, Math.floor(q * 2));
          const f = q >= 1 ? 1 : (q * 2) % 1;
          const dot = [lerp(nodes[seg][0], nodes[seg + 1][0], f), lerp(nodes[seg][1], nodes[seg + 1][1], f)];
          G.save();
          G.globalAlpha = a * 0.95;
          G.fillStyle = P.accent;
          G.beginPath(); G.arc(dot[0], dot[1], u * 0.9, 0, Math.PI * 2); G.fill();
          names.forEach((name, i) => {
            const active = q >= i / 2;
            const [x, y] = nodes[i];
            const side = portrait ? (i === 1 ? -1 : 1) : 0;
            const tx = portrait ? x + side * u * 14 : x;
            const ty = portrait ? y + u * 0.55 : y + u * 13;
            B.mono(G, name, tx, ty, { u, size: 1.6, weight: active ? 800 : 500, color: active ? P.ink : P.muted, alpha: a, align: portrait ? (side < 0 ? "right" : "left") : "center", spacing: u * 0.12 });
          });
          if (p.label) B.tag(G, p.label, cx, c.y + u * 3.1, { u, size: 1.6, alpha: a, bg: P.ink, color: P.bg });
          G.restore();
        },
        dispose() {},
      };
    },
  });
})();

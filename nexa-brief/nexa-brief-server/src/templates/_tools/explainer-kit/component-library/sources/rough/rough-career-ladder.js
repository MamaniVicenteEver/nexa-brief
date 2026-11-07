(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;

  K.register({
    name: "rough.careerLadder",
    tags: ["carrera", "escalera", "empleo", "jóvenes", "primer trabajo"],
    layer: "main",
    summary: "La escalera de una carrera dibujada a mano, con un rótulo por peldaño. Al pie, una persona espera. En `dropAt` el primer peldaño se pinta de lima, se tacha y cae: queda el hueco y el segundo escalón lejos. Con `dropAt: -1` la escalera queda entera (la escalera sigue ahí).",
    example: { rungs: ["PRIMER EMPLEO", "SEMI-SENIOR", "SENIOR", "LÍDER"], dropAt: 1.8, title: "LA CARRERA", who: "22–25 AÑOS", note: "" },
    params: {
      rungs: { type: "array", default: ["PRIMER EMPLEO", "SEMI-SENIOR", "SENIOR", "LÍDER"], doc: "Rótulos de los peldaños, de abajo hacia arriba (3–5)." },
      dropAt: { type: "number", default: 1.8, doc: "Segundo del beat en que cae el primer peldaño; -1 = no cae." },
      title: { type: "string", default: "", doc: "Rótulo arriba (mono); vacío = nada." },
      who: { type: "string", default: "", doc: "Rótulo manuscrito junto a la persona del pie; vacío = sin rótulo." },
      note: { type: "string", default: "", doc: "Nota manuscrita al pie; vacío = nada." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, portrait, content: c, cx } = ctx.stage;
      const rungs = (Array.isArray(p.rungs) && p.rungs.length ? p.rungs : ["PRIMER EMPLEO", "SENIOR"]).slice(0, 5).map(String);
      const n = rungs.length;
      const drops = p.dropAt >= 0;

      // ---- zonas: cabecera · escalera · pie ----
      const headY = c.y + c.h * 0.06;
      const footY = c.y + c.h * 0.95;
      const bodyY = c.y + c.h * 0.12, bodyH = c.h * 0.74;
      const ground = bodyY + bodyH;

      // ---- escalera: rieles y peldaños; rótulos a la derecha ----
      const lw = portrait ? c.w * 0.3 : Math.min(c.w * 0.2, bodyH * 0.42);
      const lx = portrait ? c.x + c.w * 0.17 : cx - lw * 1.3;
      const ltop = bodyY + u * 1;
      const step = (ground - ltop) / (n + 0.6);
      const railEls = R.shape(ctx, g, (G, o) => [
        G.line(lx, ground, lx + lw * 0.06, ltop, o),
        G.line(lx + lw, ground, lx + lw * 0.94, ltop, o),
        G.line(c.x + c.w * 0.04, ground, c.x + c.w * 0.96, ground, o),
      ], { color: P.ink, width: 2, seed: 4101 });

      // rótulos tan grandes como permite el ancho que queda a la derecha de la escalera
      const longest = Math.max(6, ...rungs.map(s => s.length));
      const room = c.x + c.w - (lx + lw + u * 2.5) - u;
      const labelSize = clamp(room / u / (longest * 0.64), 2, portrait ? 4.2 : 3.6);
      const rungRows = rungs.map((label, i) => {
        const y = ground - step * (i + 1);
        const rg = R.svg("g", {}, g);
        const first = i === 0 && drops;
        const els = R.shape(ctx, rg, (G, o) => [G.line(lx + u * 0.4, y, lx + lw - u * 0.4, y, o)], { color: P.ink, width: 2.4, seed: 4200 + i });
        const lime = first ? R.shape(ctx, rg, (G, o) => [G.line(lx + u * 0.4, y, lx + lw - u * 0.4, y, o)], { color: P.accent, width: 3.2, seed: 4300 }) : [];
        const tx = R.mono(ctx, rg, label.toUpperCase(), { x: lx + lw + u * 2.5, y: y + labelSize * u * 0.35, size: labelSize, weight: 700, color: P.ink, anchor: "start" });
        const cross = first ? R.shape(ctx, rg, (G, o) => [G.line(lx + lw + u * 2, y, lx + lw + u * 3 + label.length * labelSize * u * 0.62, y - u * 0.3, o)], { color: P.accent, width: 2.4, seed: 4301 }) : [];
        return { y, rg, els, lime, tx, cross, first };
      });

      // ---- persona al pie (palito), mirando hacia arriba ----
      const ph = Math.min(step * 1.3, bodyH * 0.22);
      const px = lx - ph * 0.55, hr = ph * 0.13;
      const personEls = R.shape(ctx, g, (G, o) => [
        G.circle(px, ground - ph + hr, hr * 2, o),
        G.line(px, ground - ph + hr * 2, px, ground - ph * 0.42, o),
        G.line(px, ground - ph * 0.42, px - ph * 0.16, ground, o),
        G.line(px, ground - ph * 0.42, px + ph * 0.16, ground, o),
        G.line(px, ground - ph * 0.72, px + ph * 0.3, ground - ph * 0.95, o),
        G.line(px, ground - ph * 0.72, px - ph * 0.22, ground - ph * 0.55, o),
      ], { color: P.ink, width: 1.8, seed: 4401 });
      const whoEl = p.who ? R.hand(ctx, g, p.who, { x: portrait ? c.x + c.w * 0.04 : px, y: ground + u * 3.2, size: 2.6, color: P.ink, anchor: portrait ? "start" : "middle" }) : null;

      const titleEl = p.title ? R.mono(ctx, g, p.title.toUpperCase(), { x: cx, y: headY, size: 2.4, weight: 700, color: P.ink, anchor: "middle" }) : null;
      const noteEl = p.note ? R.hand(ctx, g, p.note, { x: cx, y: footY, size: 3, color: P.ink, anchor: "middle" }) : null;

      return {
        render(lt, b, t) {
          R.draw(railEls, lt, { start: 0, dur: 0.45, ease: "out", t });
          rungRows.forEach((r, i) => {
            R.draw(r.els, lt, { start: 0.25 + i * 0.12, dur: 0.2, ease: "out", t });
            r.tx.setAttribute("opacity", prog(lt, 0.35 + i * 0.12, 0.25));
          });
          R.draw(personEls, lt, { start: 0.5, dur: 0.5, ease: "out", t });
          if (whoEl) whoEl.setAttribute("opacity", prog(lt, 0.9, 0.3));
          if (titleEl) titleEl.setAttribute("opacity", prog(lt, 0.05, 0.3));
          if (noteEl) noteEl.setAttribute("opacity", prog(lt, drops ? p.dropAt + 0.9 : 1.3, 0.4));

          // el primer peldaño: se marca en lima, se tacha el rótulo y cae girando
          const r0 = rungRows[0];
          if (r0.first) {
            R.draw(r0.lime, lt, { start: p.dropAt - 0.5, dur: 0.3, ease: "out", t });
            R.draw(r0.cross, lt, { start: p.dropAt - 0.3, dur: 0.3, ease: "out", t });
            const f = prog(lt, p.dropAt, 0.7, "in");
            const dy = f * (ground - r0.y + u * 4), rot = f * 24;
            const mx = lx + lw / 2;
            r0.rg.setAttribute("transform", `translate(0 ${dy.toFixed(2)}) rotate(${rot.toFixed(2)} ${mx.toFixed(2)} ${r0.y.toFixed(2)})`);
            r0.rg.setAttribute("opacity", (1 - prog(lt, p.dropAt + 0.45, 0.35)).toFixed(3));
          }

          // la persona respira (sube y baja apenas)
          const bob = Math.sin(lt * 2) * u * 0.15;
          personEls.forEach(el => el.setAttribute("transform", `translate(0 ${bob.toFixed(2)})`));

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

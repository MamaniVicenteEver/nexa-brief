/* generado por deepseek-flash · prompt prompts/component-author.md · v4 — revisar antes de usar */
(function () {
  const K = Kit, R = Kit.rough, { clamp, lerp, prog } = K;
  K.register({
    name: "rough.appclose",
    tags: ["teléfono", "apps", "memoria", "cierre"],
    layer: "main",
    summary: "Un teléfono dibujado a mano con tarjetas de apps apiladas: en closeAt la de abajo se tacha en lima y se desliza fuera mientras las demás suben y el teléfono late. Sirve para mostrar que el sistema cierra apps para no congelarse.",
    example: { apps: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], closeAt: 2, caption: "sigue funcionando" },
    params: {
      apps: { type: "array", default: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], doc: "Nombres cortos de las apps apiladas (2 a 5)." },
      closeAt: { type: "number", default: 2, doc: "Segundo local en que se cierra la app de abajo." },
      caption: { type: "string", default: "sigue funcionando", doc: "Nota manuscrita lima debajo del teléfono." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, cy } = ctx.stage, c = ctx.stage.content;
      const apps = (p.apps && p.apps.length ? p.apps : ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"]).slice(0, 5);

      // ---- layout: teléfono centrado, cuerpo 76% de content ----
      const headH = c.h * 0.12, footH = c.h * 0.12;
      const bodyY = c.y + headH, bodyH = c.h - headH - footH;
      const phoneW = Math.min(c.w * 0.62, bodyH * 0.52);
      const phoneH = Math.min(bodyH * 0.94, phoneW * 1.95);
      const px = cx - phoneW / 2, py = bodyY + (bodyH - phoneH) / 2;

      // marco del teléfono (dibujado a mano para conocer coords exactas)
      const frameEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(px, py, phoneW, phoneH, o),
      ], { color: P.ink, width: 1.6, seed: 700 });

      // pantalla interior
      const pad = u * 1.6;
      const sx = px + pad, sy = py + pad * 1.6;
      const sw = phoneW - pad * 2, sh = phoneH - pad * 3.2;
      const screenEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(sx, sy, sw, sh, o),
      ], { color: P.muted, width: 1.0, seed: 710 });

      // parlante
      const speakerEls = R.shape(ctx, g, (G, o) => [
        G.line(cx - u * 2.2, py + pad * 0.7, cx + u * 2.2, py + pad * 0.7, o),
      ], { color: P.muted, width: 1.2, seed: 720 });

      // ---- tarjetas de apps ----
      const n = apps.length;
      const cardGap = u * 0.9;
      const cardH = (sh - cardGap * (n + 1)) / n;
      const cardW = sw - u * 2.4;
      const cardX = sx + u * 1.2;
      const cardTop = sy + cardGap;

      const cards = apps.map((name, i) => {
        const y0 = cardTop + i * (cardH + cardGap);
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(cardX, y0, cardW, cardH, o),
        ], { color: P.ink, width: 1.1, seed: 730 + i });
        const txt = R.mono(ctx, g, name.toUpperCase(), {
          x: cardX + u * 1.2, y: y0 + cardH * 0.5 + u * 0.6,
          size: Math.min(2.0, (cardH / u) * 0.42), color: P.ink, anchor: "start",
        });
        // línea de tachado (solo para la que se cierra)
        const strike = R.shape(ctx, g, (G, o) => [
          G.line(cardX + u * 0.6, y0 + cardH * 0.5, cardX + cardW - u * 0.6, y0 + cardH * 0.5, o),
        ], { color: P.accent, width: 2.0, seed: 760 + i });
        return { els, txt, strike, y0, i };
      });

      // ---- pulso: arcos que se expanden desde el teléfono ----
      const pulseArcs = [0, 1, 2].map((k) =>
        R.shape(ctx, g, (G, o) => [
          G.arc(cx, cy, phoneW * 0.9, phoneH * 0.9, -Math.PI * 0.75, -Math.PI * 0.25, false, o),
        ], { color: P.accent, width: 1.4, seed: 800 + k })
      );

      // ---- caption manuscrita ----
      const capY = c.y + c.h - footH * 0.35;
      const cap = p.caption ? R.hand(ctx, g, p.caption, {
        x: cx, y: capY, size: 2.6, color: P.accent, anchor: "middle",
      }) : null;

      const closeAt = Math.max(0.4, p.closeAt);
      const slideDur = 0.7;
      const upDur = 0.55;

      return {
        render(lt, b, t) {
          // dibujo base
          R.draw(frameEls, lt, { start: 0, total: 0.5, dur: 0.5, t });
          R.draw(screenEls, lt, { start: 0.15, total: 0.4, dur: 0.4, t });
          R.draw(speakerEls, lt, { start: 0.3, total: 0.25, dur: 0.25, t });

          // tarjetas: entran escalonadas
          cards.forEach((cd, i) => {
            const s = 0.45 + i * 0.12;
            R.draw(cd.els, lt, { start: s, total: 0.3, dur: 0.3, t });
            if (cd.txt) cd.txt.setAttribute("opacity", prog(lt, s + 0.15, 0.25));
          });

          // la de abajo se cierra
          const closing = cards[cards.length - 1];
          const q = prog(lt, closeAt, slideDur, "inOut");
          // tachado lima
          R.draw(closing.strike, lt, { start: closeAt, total: 0.25, dur: 0.25, t });
          // deslizar fuera hacia la derecha
          const slideX = q * (phoneW * 0.9);
          const slideY = q * u * 1.5;
          const fade = 1 - clamp((q - 0.6) / 0.4);
          closing.els.forEach(el => {
            el.setAttribute("transform", `translate(${slideX.toFixed(2)} ${slideY.toFixed(2)})`);
            el.setAttribute("opacity", fade.toFixed(3));
          });
          if (closing.txt) {
            closing.txt.setAttribute("transform", `translate(${slideX.toFixed(2)} ${slideY.toFixed(2)})`);
            closing.txt.setAttribute("opacity", (fade * prog(lt, 0.6, 0.25)).toFixed(3));
          }
          closing.strike.forEach(el => {
            el.setAttribute("transform", `translate(${slideX.toFixed(2)} ${slideY.toFixed(2)})`);
            el.setAttribute("opacity", fade.toFixed(3));
          });

          // las demás suben a ocupar el lugar
          const upQ = prog(lt, closeAt + 0.15, upDur, "inOut");
          const shift = (cardH + cardGap) * upQ;
          cards.forEach((cd, i) => {
            if (i === cards.length - 1) return;
            const dy = -shift;
            cd.els.forEach(el => el.setAttribute("transform", `translate(0 ${dy.toFixed(2)})`));
            if (cd.txt) cd.txt.setAttribute("transform", `translate(0 ${dy.toFixed(2)})`);
          });

          // pulso suave después del cierre
          const pulseStart = closeAt + 0.35;
          pulseArcs.forEach((arc, k) => {
            const pk = pulseStart + k * 0.35;
            const pq = prog(lt, pk, 1.1, "out");
            const grow = 1 + pq * 0.35;
            const op = pq > 0 && pq < 1 ? (1 - pq) * 0.7 : 0;
            arc.forEach(el => {
              el.setAttribute("transform", `translate(${cx} ${cy}) scale(${grow.toFixed(3)}) translate(${-cx} ${-cy})`);
              el.setAttribute("opacity", op.toFixed(3));
            });
          });

          // caption
          if (cap) cap.setAttribute("opacity", prog(lt, closeAt + 0.6, 0.5));

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

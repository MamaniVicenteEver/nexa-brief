# rough.appclose · v1

modelo: deepseek-flash · 7.7 s · tokens in 4214 / out 2090

## Pedido

Creá `rough.appclose`: un teléfono dibujado a mano (usar el boceto 'phone' o dibujarlo con R.shape) con 3-4 tarjetas de apps apiladas dentro (rectángulos con nombre). En closeAt la tarjeta de abajo (la menos importante) se tacha con una línea lima y se desliza fuera del teléfono mientras las demás suben a ocupar su lugar y el teléfono emite un pulso suave (arcos que se expanden) para mostrar que sigue vivo. Params: apps (array de nombres cortos, por defecto ['MAPAS','MÚSICA','CÁMARA','JUEGO']), closeAt (segundo local, por defecto 2), caption (nota manuscrita lima debajo, por defecto 'sigue funcionando'). Momento narrativo: 'Cada vez que tu teléfono cierra una aplicación para no congelarse'.

## Respuesta

```js
(function () {
  const K = Kit, R = Kit.rough, { clamp, lerp, prog, ease } = K;
  K.register({
    name: "rough.appclose",
    tags: ["teléfono", "apps", "memoria", "cierre"],
    layer: "main",
    summary: "Un teléfono dibujado a mano con tarjetas de apps apiladas: en closeAt la última se tacha en lima y se desliza fuera mientras las demás suben y el teléfono late. Sirve para el momento en que el sistema mata una app para no congelarse.",
    example: { apps: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], closeAt: 2, caption: "sigue funcionando" },
    params: {
      apps: { type: "array", default: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], doc: "Nombres cortos de las apps apiladas (2 a 5)." },
      closeAt: { type: "number", default: 2, min: 0.5, max: 8, doc: "Segundo local en que se cierra la última app." },
      caption: { type: "string", default: "sigue funcionando", doc: "Nota manuscrita lima debajo del teléfono." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, cy } = ctx.stage, c = ctx.stage.content;
      const names = (Array.isArray(p.apps) && p.apps.length ? p.apps : ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"]).slice(0, 5);

      // --- geometría del teléfono ---
      const phH = Math.min(c.h * 0.72, u * 62);
      const phW = phH * 0.5;
      const phX = cx - phW / 2, phY = cy - phH / 2 - u * 2;

      // --- teléfono (boceto) ---
      const phoneEls = R.sketch(ctx, g, "phone", { x: phX, y: phY, w: phW, h: phH }, { color: P.ink, width: 1.6, seed: 900 });

      // --- pantalla interior ---
      const pad = u * 2.2;
      const scrX = phX + pad, scrY = phY + pad * 1.6;
      const scrW = phW - pad * 2, scrH = phH - pad * 3.2;

      // --- tarjetas de apps ---
      const n = names.length;
      const cardH = Math.min(scrH / (n + 0.6), u * 9);
      const gap = (scrH - cardH * n) / (n + 1);
      const cardW = scrW * 0.86;
      const cardX = scrX + (scrW - cardW) / 2;

      const cards = names.map((name, i) => {
        const y0 = scrY + gap + i * (cardH + gap);
        const grp = R.svg("g", null, g);
        const rect = R.shape(ctx, grp, (G, o) => [
          G.rectangle(cardX, y0, cardW, cardH, o),
        ], { color: P.ink, width: 1.3, seed: 920 + i });
        const txt = R.mono(ctx, grp, name, {
          x: cardX + u * 1.6, y: y0 + cardH * 0.62,
          size: Math.max(1.6, cardH / u * 0.42), color: P.ink, anchor: "start",
        });
        return { grp, rect, txt, y0, i };
      });

      // --- línea de tachado (lima) sobre la última tarjeta ---
      const last = cards[n - 1];
      const strike = R.shape(ctx, g, (G, o) => [
        G.line(cardX + u * 0.8, last.y0 + cardH * 0.5, cardX + cardW - u * 0.8, last.y0 + cardH * 0.5, o),
      ], { color: P.accent, width: 2.2, seed: 980 });

      // --- arcos de pulso (lima) alrededor del teléfono ---
      const pulseArcs = [0, 1, 2].map((k) =>
        R.shape(ctx, g, (G, o) => [
          G.arc(cx, cy - u * 2, phW * 1.15, phH * 0.62, -Math.PI * 0.85, -Math.PI * 0.15, false, o),
        ], { color: P.accent, width: 1.6, seed: 990 + k })
      );

      // --- caption manuscrita ---
      const cap = p.caption ? R.hand(ctx, g, p.caption, {
        x: cx, y: phY + phH + u * 5.5, size: 3.2, color: P.accent, anchor: "middle",
      }) : null;

      const closeAt = p.closeAt;
      const slideDur = 0.7;
      const strikeDur = 0.35;

      return {
        render(lt, b, t) {
          // teléfono se dibuja
          R.draw(phoneEls, lt, { start: 0, total: 0.55, dur: 0.55, t });

          // tarjetas aparecen escalonadas
          cards.forEach((cd, i) => {
            const s = 0.35 + i * 0.12;
            const q = prog(lt, s, 0.3, "out");
            cd.grp.setAttribute("opacity", q.toFixed(3));
          });

          // progreso del cierre
          const qc = clamp((lt - closeAt) / slideDur);
          const qs = clamp((lt - closeAt) / strikeDur);

          // tachado lima de la última
          R.draw(strike, lt, { start: closeAt, dur: strikeDur, ease: "out", t });
          strike.forEach((el) => el.setAttribute("opacity", qs > 0 ? 1 : 0));

          // la última se desliza fuera (hacia abajo-derecha) y se desvanece
          const lastCd = cards[n - 1];
          const slideY = ease(qc, "in") * (phH * 0.55);
          const slideX = ease(qc, "in") * (phW * 0.35);
          const lastOp = 1 - clamp((qc - 0.35) / 0.65);
          lastCd.grp.setAttribute("transform", `translate(${slideX.toFixed(2)} ${slideY.toFixed(2)})`);
          lastCd.grp.setAttribute("opacity", lastOp.toFixed(3));

          // las demás suben a ocupar el lugar
          const shift = cardH + gap;
          cards.forEach((cd, i) => {
            if (i === n - 1) return;
            const target = i * shift;
            const cur = lerp(0, target, ease(qc, "inOut"));
            cd.grp.setAttribute("transform", `translate(0 ${(-cur).toFixed(2)})`);
          });

          // pulso del teléfono: arcos que se expanden y desvanecen
          pulseArcs.forEach((arc, k) => {
            const start = closeAt + 0.15 + k * 0.28;
            const q = clamp((lt - start) / 0.9);
            const op = q > 0 && q < 1 ? Math.sin(q * Math.PI) * 0.7 : 0;
            const sc = 1 + q * 0.35;
            arc.forEach((el) => {
              el.setAttribute("opacity", op.toFixed(3));
              el.setAttribute("transform", `scale(${sc.toFixed(3)})`);
              el.setAttribute("transform-origin", `${cx} ${cy - u * 2}`);
            });
          });

          // caption
          if (cap) {
            const q = prog(lt, closeAt + 0.5, 0.5, "out");
            cap.setAttribute("opacity", q.toFixed(3));
          }

          // respiración lenta del teléfono
          const br = 1 + Math.sin(lt * 1.1) * 0.004;
          g.setAttribute("transform", `translate(${cx} ${cy - u * 2}) scale(${br.toFixed(4)}) translate(${-cx} ${-(cy - u * 2)})`);

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
```

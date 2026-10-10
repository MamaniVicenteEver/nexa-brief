# rough.appclose · v3

modelo: deepseek-flash · 8.5 s · tokens in 5349 / out 2310

## Pedido

Creá `rough.appclose`: un teléfono dibujado a mano (usar el boceto 'phone' o dibujarlo con R.shape) con 3-4 tarjetas de apps apiladas dentro (rectángulos con nombre). En closeAt la tarjeta de abajo (la menos importante) se tacha con una línea lima y se desliza fuera del teléfono mientras las demás suben a ocupar su lugar y el teléfono emite un pulso suave (arcos que se expanden) para mostrar que sigue vivo. Params: apps (array de nombres cortos, por defecto ['MAPAS','MÚSICA','CÁMARA','JUEGO']), closeAt (segundo local, por defecto 2), caption (nota manuscrita lima debajo, por defecto 'sigue funcionando'). Momento narrativo: 'Cada vez que tu teléfono cierra una aplicación para no congelarse'.

## Respuesta

```js
(function () {
  const K = Kit, R = Kit.rough, { clamp, lerp, prog } = K;
  K.register({
    name: "rough.appclose",
    tags: ["teléfono", "apps", "memoria", "cierre"],
    layer: "main",
    summary: "Un teléfono dibujado a mano con apps apiladas: en closeAt la de abajo se tacha y sale, las demás suben y el teléfono late para mostrar que sigue vivo.",
    example: { apps: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], closeAt: 2, caption: "sigue funcionando" },
    params: {
      apps: { type: "array", default: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], doc: "Nombres cortos de las apps apiladas (de arriba a abajo)." },
      closeAt: { type: "number", default: 2, doc: "Segundo local en que se cierra la app de abajo." },
      caption: { type: "string", default: "sigue funcionando", doc: "Nota manuscrita lima debajo del teléfono." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, cx, cy, content: c } = ctx.stage;

      // ---- layout: cabecera 12% / cuerpo 76% / pie 12% ----
      // cabecera: y = c.y .. c.y + c.h*0.12   (sin texto, solo aire)
      // cuerpo:   y = c.y + c.h*0.12 .. c.y + c.h*0.88
      // pie:      y = c.y + c.h*0.88 .. c.y + c.h
      const bodyTop = c.y + c.h * 0.12;
      const bodyBot = c.y + c.h * 0.88;
      const bodyH = bodyBot - bodyTop;

      // teléfono: ocupa ~62% del ancho de content en 9:16, ~40% del alto en 16:9
      const phoneW = Math.min(c.w * 0.62, bodyH * 0.62);
      const phoneH = Math.min(bodyH * 0.94, phoneW * 1.95);
      const px = cx - phoneW / 2;
      const py = bodyTop + (bodyH - phoneH) / 2;

      // marco del teléfono (dibujado por nosotros para conocer coords exactas)
      const frameEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(px, py, phoneW, phoneH, o),
      ], { color: P.ink, width: 2.2, seed: 700 });

      // pantalla interior con margen
      const m = u * 1.6;
      const sx = px + m, sy = py + m * 1.4;
      const sw = phoneW - m * 2, sh = phoneH - m * 2.8;

      // apps: tarjetas apiladas dentro de la pantalla
      const names = (Array.isArray(p.apps) && p.apps.length ? p.apps : ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"]).slice(0, 5);
      const n = names.length;
      const gap = u * 1.2;
      const cardH = (sh - gap * (n - 1)) / n;
      const cardW = sw;

      // cada tarjeta: rectángulo + texto
      const cards = names.map((name, i) => {
        const y0 = sy + i * (cardH + gap);
        const rectEls = R.shape(ctx, g, (G, o) => [
          G.rectangle(sx, y0, cardW, cardH, o),
        ], { color: P.ink, width: 1.6, seed: 720 + i });
        const label = R.mono(ctx, g, String(name).toUpperCase(), {
          x: sx + u * 1.4, y: y0 + cardH / 2 + u * 0.7,
          size: Math.max(1.6, cardH * 0.32), color: P.ink, anchor: "start",
        });
        return { y0, rectEls, label, name: String(name).toUpperCase() };
      });

      // la tarjeta que se cierra = la de abajo (última)
      const closing = cards[n - 1];
      const closingY = closing.y0;

      // línea lima que tacha la tarjeta que se cierra
      const strikeEls = R.shape(ctx, g, (G, o) => [
        G.line(sx + u * 0.6, closingY + cardH * 0.5, sx + cardW - u * 0.6, closingY + cardH * 0.5, o),
      ], { color: P.accent, width: 2.4, seed: 760 });

      // pulso: arcos que se expanden desde el teléfono
      const pulseCx = cx, pulseCy = py + phoneH * 0.5;
      const pulseEls = R.shape(ctx, g, (G, o) => [
        G.arc(pulseCx, pulseCy, phoneW * 1.15, phoneW * 1.15, -0.6, 0.6, false, o),
        G.arc(pulseCx, pulseCy, phoneW * 1.35, phoneW * 1.35, -0.5, 0.5, false, { ...o, seed: 781 }),
      ], { color: P.accent, width: 1.8, seed: 780 });

      // nota manuscrita lima en el pie
      const capEl = p.caption ? R.hand(ctx, g, p.caption, {
        x: cx, y: c.y + c.h * 0.955, size: Math.max(2.2, u * 2.6), color: P.accent, anchor: "middle",
      }) : null;

      // duración de la animación de cierre
      const closeDur = 0.9;

      return {
        render(lt, b, t) {
          // dibujar marco y tarjetas
          R.draw(frameEls, lt, { start: 0, dur: 0.5, t });
          cards.forEach((cd, i) => {
            R.draw(cd.rectEls, lt, { start: 0.15 + i * 0.12, dur: 0.35, t });
          });

          // aparición de textos de apps
          cards.forEach((cd, i) => {
            const q = prog(lt, 0.35 + i * 0.12, 0.3);
            cd.label.setAttribute("opacity", q.toFixed(3));
          });

          // progreso del cierre
          const qc = clamp((lt - p.closeAt) / closeDur);
          const qcE = K.ease.inOut(qc);

          // tachado de la tarjeta que se cierra
          R.draw(strikeEls, lt, { start: p.closeAt, dur: 0.35, t });
          // la tarjeta que se cierra se desvanece y sale hacia abajo
          const fadeOut = clamp((lt - p.closeAt - 0.25) / 0.5);
          closing.rectEls.forEach(el => el.setAttribute("opacity", (1 - fadeOut).toFixed(3)));
          closing.label.setAttribute("opacity", ((1 - fadeOut) * (lt >= 0.35 + (n - 1) * 0.12 ? 1 : 0)).toFixed(3));
          const slide = qcE * (cardH + gap) * 1.4;
          closing.rectEls.forEach(el => {
            const tr = el.getAttribute("transform") || "";
            el.setAttribute("transform", `translate(0 ${slide.toFixed(2)})`);
          });
          closing.label.setAttribute("transform", `translate(0 ${slide.toFixed(2)})`);

          // las demás suben a ocupar el lugar
          cards.slice(0, n - 1).forEach((cd, i) => {
            const targetY = sy + i * (cardH + gap);
            const dy = qcE * (cardH + gap);
            cd.rectEls.forEach(el => {
              el.setAttribute("transform", `translate(0 ${dy.toFixed(2)})`);
            });
            cd.label.setAttribute("transform", `translate(0 ${dy.toFixed(2)})`);
          });

          // pulso del teléfono: arcos que se expanden
          const pulseStart = p.closeAt + 0.3;
          const pulseQ = clamp((lt - pulseStart) / 1.2);
          if (pulseQ > 0 && pulseQ < 1) {
            R.draw(pulseEls, lt, { start: pulseStart, dur: 1.0, t });
            const op = (1 - pulseQ) * 0.9;
            pulseEls.forEach(el => el.setAttribute("opacity", op.toFixed(3)));
          } else {
            pulseEls.forEach(el => el.setAttribute("opacity", "0"));
          }

          // respiración suave del teléfono
          const breathe = 1 + Math.sin(lt * 1.2) * 0.004;
          g.setAttribute("transform", `translate(${cx} ${cy}) scale(${breathe.toFixed(4)}) translate(${-cx} ${-cy})`);

          // nota manuscrita
          if (capEl) capEl.setAttribute("opacity", prog(lt, 0.6, 0.5).toFixed(3));

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
```

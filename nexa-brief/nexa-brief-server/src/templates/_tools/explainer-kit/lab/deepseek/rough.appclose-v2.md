# rough.appclose · v2

modelo: deepseek-flash · 8.2 s · tokens in 4918 / out 2138

## Pedido

Creá `rough.appclose`: un teléfono dibujado a mano (usar el boceto 'phone' o dibujarlo con R.shape) con 3-4 tarjetas de apps apiladas dentro (rectángulos con nombre). En closeAt la tarjeta de abajo (la menos importante) se tacha con una línea lima y se desliza fuera del teléfono mientras las demás suben a ocupar su lugar y el teléfono emite un pulso suave (arcos que se expanden) para mostrar que sigue vivo. Params: apps (array de nombres cortos, por defecto ['MAPAS','MÚSICA','CÁMARA','JUEGO']), closeAt (segundo local, por defecto 2), caption (nota manuscrita lima debajo, por defecto 'sigue funcionando'). Momento narrativo: 'Cada vez que tu teléfono cierra una aplicación para no congelarse'.

## Respuesta

```js
(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;
  K.register({
    name: "rough.appclose",
    tags: ["teléfono", "apps", "memoria", "cierre"],
    layer: "main",
    summary: "Un teléfono dibujado a mano con apps apiladas: en closeAt la última se tacha y se desliza fuera mientras las demás suben y el teléfono late. Sirve para explicar que el sistema cierra apps para no congelarse.",
    example: { apps: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], closeAt: 2, caption: "sigue funcionando" },
    params: {
      apps: { type: "array", default: ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"], doc: "Nombres cortos de las apps, de arriba hacia abajo." },
      closeAt: { type: "number", default: 2, min: 0.5, doc: "Segundo en que se cierra la última app." },
      caption: { type: "string", default: "sigue funcionando", doc: "Nota manuscrita lima debajo." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, cy } = ctx.stage, c = ctx.stage.content;
      const apps = (p.apps && p.apps.length ? p.apps : ["MAPAS", "MÚSICA", "CÁMARA", "JUEGO"]).slice(0, 5);

      // --- geometría del teléfono (dibujado a mano para conocer su interior) ---
      const phW = Math.min(c.w * 0.42, c.h * 0.52);
      const phH = Math.min(c.h * 0.72, phW * 1.9);
      const phX = cx - phW / 2;
      const phY = cy - phH / 2 - u * 2;
      const pad = u * 2.2;
      const scrX = phX + pad, scrY = phY + pad * 1.6;
      const scrW = phW - pad * 2, scrH = phH - pad * 3.2;

      // marco del teléfono
      const phoneEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(phX, phY, phW, phH, o),
        G.line(phX + phW * 0.35, phY + pad * 0.7, phX + phW * 0.65, phY + pad * 0.7, o),
      ], { color: P.ink, width: 1.6, seed: 900 });

      // --- tarjetas de apps ---
      const n = apps.length;
      const gap = u * 1.2;
      const cardH = (scrH - gap * (n - 1)) / n;
      const cardW = scrW;
      const cardX = scrX;

      const cards = apps.map((name, i) => {
        const y0 = scrY + i * (cardH + gap);
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(cardX, y0, cardW, cardH, o),
        ], { color: P.ink, width: 1.3, seed: 910 + i });
        const txt = R.mono(ctx, g, name, {
          x: cardX + u * 1.4, y: y0 + cardH / 2 + u * 0.6,
          size: Math.max(1.7, cardH / (u * 3.2)), color: P.ink, anchor: "start", weight: 600,
        });
        return { els, txt, y0, i };
      });

      // tachadura lima sobre la última tarjeta
      const last = cards[n - 1];
      const strikeY = last.y0 + cardH / 2;
      const strikeEls = R.shape(ctx, g, (G, o) => [
        G.line(cardX + u * 0.8, strikeY, cardX + cardW - u * 0.8, strikeY, o),
      ], { color: P.accent, width: 2.2, seed: 950 });

      // pulso: arcos que se expanden desde el teléfono
      const pulseArcs = [0, 1, 2].map((k) =>
        R.shape(ctx, g, (G, o) => [
          G.arc(cx, cy, phW * 1.05, phH * 1.05, -Math.PI * 0.85, -Math.PI * 0.15, false, o),
        ], { color: P.accent, width: 1.6, seed: 960 + k })
      );

      // nota manuscrita lima
      const note = p.caption ? R.hand(ctx, g, p.caption, {
        x: cx, y: phY + phH + u * 4.5, size: 3.4, color: P.accent, anchor: "middle",
      }) : null;

      const closeT = p.closeAt;
      const slideDur = 0.7;
      const riseDur = 0.6;

      return {
        render(lt, b, t) {
          // dibujo del teléfono
          R.draw(phoneEls, lt, { start: 0, total: 0.5, dur: 0.5, t });

          // tarjetas: entrada escalonada
          cards.forEach((cd, i) => {
            R.draw(cd.els, lt, { start: 0.35 + i * 0.12, dur: 0.3, ease: "out", t });
            const q = prog(lt, 0.35 + i * 0.12, 0.3, "out");
            cd.txt.setAttribute("opacity", q.toFixed(3));
          });

          // tachadura
          R.draw(strikeEls, lt, { start: closeT, dur: 0.35, ease: "out", t });

          // deslizamiento de la última tarjeta + subida de las demás
          const slideQ = prog(lt, closeT + 0.2, slideDur, "inOut");
          const riseQ = prog(lt, closeT + 0.35, riseDur, "inOut");

          cards.forEach((cd, i) => {
            let dy = 0;
            if (i === n - 1) {
              // la última se va hacia abajo y afuera
              dy = slideQ * (cardH + gap) * 1.6;
              const op = 1 - slideQ;
              cd.els.forEach(el => el.setAttribute("opacity", op.toFixed(3)));
              cd.txt.setAttribute("opacity", (op * (1 - slideQ)).toFixed(3));
            } else {
              // las de arriba suben un lugar
              dy = -riseQ * (cardH + gap);
            }
            const tr = `translate(0 ${dy.toFixed(2)})`;
            cd.els.forEach(el => el.setAttribute("transform", tr));
            cd.txt.setAttribute("transform", tr);
          });

          // la tachadura acompaña a la tarjeta que se va
          strikeEls.forEach(el => el.setAttribute("transform", `translate(0 ${(slideQ * (cardH + gap) * 1.6).toFixed(2)})`));
          strikeEls.forEach(el => el.setAttribute("opacity", (1 - slideQ).toFixed(3)));

          // pulso: arcos que se expanden una vez, suave
          const pulseStart = closeT + 0.25;
          pulseArcs.forEach((arc, k) => {
            const s = pulseStart + k * 0.22;
            const q = prog(lt, s, 1.1, "out");
            const scale = 1 + q * 0.35;
            arc.forEach(el => {
              el.setAttribute("transform", `translate(${cx} ${cy}) scale(${scale.toFixed(3)}) translate(${-cx} ${-cy})`);
              el.setAttribute("opacity", (q > 0 && q < 1 ? (1 - q) * 0.7 : 0).toFixed(3));
            });
            R.draw(arc, lt, { start: s, dur: 0.5, ease: "out", t });
          });

          // nota manuscrita
          if (note) note.setAttribute("opacity", prog(lt, closeT + 0.6, 0.4, "out").toFixed(3));

          // respiración lenta del teléfono
          const breathe = 1 + Math.sin(lt * 1.1) * 0.004;
          g.setAttribute("transform", `translate(${cx} ${cy}) scale(${breathe.toFixed(4)}) translate(${-cx} ${-cy})`);

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
```

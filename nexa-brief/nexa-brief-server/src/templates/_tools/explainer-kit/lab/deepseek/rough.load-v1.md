# rough.load · v1

modelo: deepseek-flash · 10.2 s · tokens in 4243 / out 2634

## Pedido

Creá `rough.load`: la capacidad de una computadora dibujada a mano como un recipiente (una caja vertical alta con divisiones) que se va llenando con bloques de tareas, de abajo hacia arriba; cada bloque lleva un rótulo mono corto. Params: tasks (array de strings, las tareas que entran en orden), capacity (cuántas ranuras tiene el recipiente, por defecto 5), stepSec (segundos entre bloque y bloque), overflowAt (segundo local en que llegan tareas extra que NO caben; -1 = nunca), extra (array de rótulos de las tareas que no caben, p. ej. ['RADAR','RADAR']), overflowLabel (por defecto '1202'). Cuando desborda: los bloques extra quedan arriba del recipiente, fuera, temblando; el borde del recipiente se raya en lima y aparece overflowLabel GRANDE en lima al costado. Momento narrativo: 'La máquina, que ya trabajaba al límite, se llenó'.

## Respuesta

```js
(function () {
  const K = Kit, R = Kit.rough, { clamp, prog, hash } = K;
  K.register({
    name: "rough.load",
    tags: ["computadora", "límite", "capacidad", "desborde"],
    layer: "main",
    summary: "Un recipiente vertical dibujado a mano se llena de bloques de tareas de abajo hacia arriba; cuando llegan tareas extra que no caben, quedan fuera temblando y el borde se raya en lima con una etiqueta grande. Sirve para el momento en que la máquina, que ya trabajaba al límite, se llenó.",
    example: { tasks: ["LOGIN", "PAGO", "MAIL", "SYNC", "REPORT"], capacity: 5, stepSec: 0.42, overflowAt: 2.6, extra: ["RADAR", "RADAR"], overflowLabel: "1202" },
    params: {
      tasks: { type: "array", default: ["LOGIN", "PAGO", "MAIL", "SYNC", "REPORT"], doc: "Rótulos de las tareas que entran en orden." },
      capacity: { type: "number", default: 5, min: 1, max: 12, doc: "Cuántas ranuras tiene el recipiente." },
      stepSec: { type: "number", default: 0.42, min: 0.1, max: 2, doc: "Segundos entre bloque y bloque." },
      overflowAt: { type: "number", default: -1, doc: "Segundo local en que llegan las tareas extra; -1 = nunca." },
      extra: { type: "array", default: ["RADAR", "RADAR"], doc: "Rótulos de las tareas que no caben." },
      overflowLabel: { type: "string", default: "1202", doc: "Etiqueta grande en lima al costado cuando desborda." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, cx, cy } = ctx.stage, c = ctx.stage.content;

      const cap = Math.max(1, Math.round(p.capacity));
      const tasks = (p.tasks || []).slice(0, cap);
      const extras = (p.extra || []).slice(0, 6);

      // Geometría del recipiente: caja vertical alta, centrada en content.
      const boxH = Math.min(c.h * 0.72, u * 46);
      const boxW = Math.min(c.w * 0.42, u * 22);
      const bx = cx - boxW / 2;
      const by = cy - boxH / 2 + u * 1.5;
      const pad = u * 1.4;
      const slotH = (boxH - pad * 2) / cap;
      const slotW = boxW - pad * 2;

      // Recipiente (contorno a mano) + divisiones internas.
      const shell = R.shape(ctx, g, (G, o) => [
        G.rectangle(bx, by, boxW, boxH, o),
      ], { color: P.ink, width: 1.8, seed: 900 });

      const dividers = [];
      for (let i = 1; i < cap; i++) {
        const y = by + pad + i * slotH;
        dividers.push(R.shape(ctx, g, (G, o) => [
          G.line(bx + pad * 0.6, y, bx + boxW - pad * 0.6, y, o),
        ], { color: P.muted, width: 1.1, seed: 910 + i }));
      }

      // Borde "rayado" en lima que aparece al desbordar (trazo encima del contorno).
      const hotEdge = R.shape(ctx, g, (G, o) => [
        G.rectangle(bx - u * 0.5, by - u * 0.5, boxW + u, boxH + u, o),
      ], { color: P.accent, width: 2.6, seed: 950 });
      hotEdge.forEach(el => el.setAttribute("opacity", "0"));

      // Bloques de tareas dentro del recipiente (de abajo hacia arriba).
      const blocks = tasks.map((label, i) => {
        const slot = cap - 1 - i; // 0 = arriba
        const y = by + pad + slot * slotH;
        const x = bx + pad;
        const w = slotW;
        const h = slotH * 0.78;
        const grp = R.svg("g", null, g);
        const rect = R.shape(ctx, grp, (G, o) => [
          G.rectangle(x, y + (slotH - h) / 2, w, h, o),
        ], { color: P.ink, fillColor: P.accent, fill: "F", fillStyle: "hachure", hachureGap: u * 0.9, width: 1.4, seed: 1000 + i });
        const txt = R.mono(ctx, grp, String(label).toUpperCase(), {
          x: x + w / 2, y: y + slotH / 2, size: Math.max(1.6, Math.min(2.4, slotH / u * 0.34)),
          color: P.accentInk, anchor: "middle", weight: 700,
        });
        grp.setAttribute("opacity", "0");
        return { grp, rect, txt, i };
      });

      // Bloques extra: aparecen ARRIBA del recipiente, fuera, temblando.
      const extraBlocks = extras.map((label, i) => {
        const w = slotW * 0.86;
        const h = slotH * 0.72;
        const x = bx + pad + (slotW - w) / 2 + (i % 2 === 0 ? -u * 0.6 : u * 0.6);
        const y = by - u * 2.2 - i * (h + u * 0.7);
        const grp = R.svg("g", null, g);
        const rect = R.shape(ctx, grp, (G, o) => [
          G.rectangle(x, y, w, h, o),
        ], { color: P.accent, width: 1.6, seed: 1200 + i });
        const txt = R.mono(ctx, grp, String(label).toUpperCase(), {
          x: x + w / 2, y: y + h / 2, size: Math.max(1.6, Math.min(2.2, h / u * 0.34)),
          color: P.accent, anchor: "middle", weight: 700,
        });
        grp.setAttribute("opacity", "0");
        return { grp, i, baseX: x, baseY: y };
      });

      // Etiqueta grande en lima al costado (aparece al desbordar).
      const bigLabel = R.text(ctx, g, String(p.overflowLabel || ""), {
        x: bx + boxW + u * 3, y: by + boxH * 0.5,
        size: 7, weight: 800, color: P.accent, anchor: "start",
      });
      bigLabel.setAttribute("opacity", "0");

      // Nota manuscrita corta arriba.
      const note = R.hand(ctx, g, "al límite", {
        x: cx, y: by - u * 1.2, size: 3.2, color: P.accent, anchor: "middle",
      });
      note.setAttribute("opacity", "0");

      const overflowActive = p.overflowAt >= 0 && extras.length > 0;

      return {
        render(lt, b, t) {
          // Recipiente y divisiones se dibujan al inicio.
          R.draw(shell, lt, { start: 0, dur: 0.55, ease: "out", t });
          dividers.forEach((d, i) => R.draw(d, lt, { start: 0.25 + i * 0.06, dur: 0.3, ease: "out", t }));

          // Bloques de tareas: entran escalonados de abajo hacia arriba.
          blocks.forEach((blk, i) => {
            const s = 0.7 + i * p.stepSec;
            const q = prog(lt, s, 0.32, "out");
            blk.grp.setAttribute("opacity", q.toFixed(3));
            const sc = 0.85 + 0.15 * q;
            const bb = blk.rect[0].getBBox ? null : null; // no-op para mantener pureza
            blk.grp.setAttribute("transform", `translate(${(1 - q) * u * 1.2} 0) scale(${sc})`);
            // El transform con scale necesita origen: usamos translate compensado.
            const cxg = bx + boxW / 2, cyg = by + boxH / 2;
            blk.grp.setAttribute("transform",
              `translate(${cxg} ${cyg}) scale(${sc}) translate(${-cxg} ${-cyg}) translate(${(1 - q) * u * 1.2} 0)`);
          });

          // Desborde.
          if (overflowActive) {
            const oq = prog(lt, p.overflowAt, 0.4, "out");
            const since = lt - p.overflowAt;
            const shakeAmp = since > 0 && since < 1.2 ? (1 - since / 1.2) * u * 0.35 : 0;

            extraBlocks.forEach((eb, i) => {
              const s = p.overflowAt + i * 0.18;
              const q = prog(lt, s, 0.3, "out");
              eb.grp.setAttribute("opacity", q.toFixed(3));
              const dx = Math.sin((lt * 22) + i * 1.7) * shakeAmp;
              const dy = Math.cos((lt * 19) + i * 2.3) * shakeAmp * 0.5;
              eb.grp.setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
            });

            hotEdge.forEach(el => el.setAttribute("opacity", (oq * 0.9).toFixed(3)));
            bigLabel.setAttribute("opacity", prog(lt, p.overflowAt + 0.15, 0.4, "out").toFixed(3));
            note.setAttribute("opacity", prog(lt, p.overflowAt + 0.05, 0.35, "out").toFixed(3));
          } else {
            note.setAttribute("opacity", prog(lt, 0.4, 0.4, "out").toFixed(3));
          }

          // Respiración lenta del recipiente.
          const breathe = 1 + Math.sin(lt * 0.6) * 0.003;
          g.setAttribute("transform", `translate(${cx} ${cy}) scale(${breathe.toFixed(4)}) translate(${-cx} ${-cy})`);

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
```

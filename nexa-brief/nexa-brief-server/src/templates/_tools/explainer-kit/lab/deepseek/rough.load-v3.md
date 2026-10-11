# rough.load · v3

modelo: deepseek-flash · 15.3 s · tokens in 5378 / out 2751

## Pedido

Creá `rough.load`: la capacidad de una computadora dibujada a mano como un recipiente (una caja vertical alta con divisiones) que se va llenando con bloques de tareas, de abajo hacia arriba; cada bloque lleva un rótulo mono corto. Params: tasks (array de strings, las tareas que entran en orden), capacity (cuántas ranuras tiene el recipiente, por defecto 5), stepSec (segundos entre bloque y bloque), overflowAt (segundo local en que llegan tareas extra que NO caben; -1 = nunca), extra (array de rótulos de las tareas que no caben, p. ej. ['RADAR','RADAR']), overflowLabel (por defecto '1202'). Cuando desborda: los bloques extra quedan arriba del recipiente, fuera, temblando; el borde del recipiente se raya en lima y aparece overflowLabel GRANDE en lima al costado. Momento narrativo: 'La máquina, que ya trabajaba al límite, se llenó'.

## Respuesta

```js
(function () {
  const K = Kit, R = Kit.rough, { clamp, prog, lerp } = K;
  K.register({
    name: "rough.load",
    tags: ["capacidad", "límite", "computadora", "desborde"],
    layer: "main",
    summary: "Un recipiente vertical dibujado a mano se llena de bloques de tareas de abajo hacia arriba; cuando llegan tareas que no caben, quedan fuera temblando y el borde se raya en lima con un rótulo grande. Sirve para el momento en que 'la máquina, que ya trabajaba al límite, se llenó'.",
    example: {
      tasks: ["SCAN", "PARSE", "INDEX", "SORT", "MATCH"],
      capacity: 5,
      stepSec: 0.55,
      overflowAt: 3.4,
      extra: ["RADAR", "RADAR"],
      overflowLabel: "1202",
    },
    params: {
      tasks: { type: "array", default: ["SCAN", "PARSE", "INDEX", "SORT", "MATCH"], doc: "Rótulos de las tareas que entran en orden." },
      capacity: { type: "number", default: 5, min: 1, max: 10, doc: "Cuántas ranuras tiene el recipiente." },
      stepSec: { type: "number", default: 0.55, doc: "Segundos entre bloque y bloque." },
      overflowAt: { type: "number", default: -1, doc: "Segundo local en que llegan las tareas extra; -1 = nunca." },
      extra: { type: "array", default: ["RADAR", "RADAR"], doc: "Rótulos de las tareas que no caben." },
      overflowLabel: { type: "string", default: "1202", doc: "Rótulo grande en lima cuando desborda." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, cy, content: c } = ctx.stage;

      // ---- Layout ----
      // Cabecera (12%): etiqueta "CARGA" arriba.
      // Cuerpo (76%): recipiente vertical centrado, con ranuras.
      // Pie (12%): nota manuscrita.
      const headY = c.y + u * 2.2;
      const footY = c.y + c.h - u * 2.2;

      // Recipiente: caja vertical alta. En 9:16 ocupa ~62% del ancho de content.
      const boxW = Math.min(c.w * 0.62, c.h * 0.42);
      const boxH = Math.min(c.h * 0.62, boxW * 2.6);
      const boxX = cx - boxW / 2;
      const boxY = c.y + c.h * 0.5 - boxH / 2 + u * 1.5;

      // Ranuras internas
      const pad = u * 1.6;
      const innerX = boxX + pad;
      const innerW = boxW - pad * 2;
      const innerY = boxY + pad;
      const innerH = boxH - pad * 2;
      const slotH = innerH / p.capacity;
      const slotGap = u * 0.35;

      // ---- Recipiente (trazo a mano) ----
      const boxEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(boxX, boxY, boxW, boxH, o),
      ], { color: P.ink, width: 2.0, seed: 700 });

      // Divisiones internas (líneas horizontales)
      const divEls = [];
      for (let i = 1; i < p.capacity; i++) {
        const y = innerY + i * slotH;
        divEls.push(R.shape(ctx, g, (G, o) => [
          G.line(innerX, y, innerX + innerW, y, o),
        ], { color: P.muted, width: 1.2, seed: 710 + i }));
      }

      // Borde lima (rayado) que aparece al desbordar
      const rimEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(boxX - u * 0.5, boxY - u * 0.5, boxW + u, boxH + u, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.9 }),
      ], { color: P.accent, fillColor: P.accent, width: 2.4, seed: 720 });
      rimEls.forEach(el => el.setAttribute("opacity", "0"));

      // ---- Bloques de tareas ----
      const blocks = [];
      const n = Math.min(p.tasks.length, p.capacity);
      for (let i = 0; i < n; i++) {
        const slot = i; // 0 = abajo
        const y = innerY + innerH - (slot + 1) * slotH + slotGap / 2;
        const h = slotH - slotGap;
        const bw = innerW - u * 0.6;
        const bx = innerX + u * 0.3;
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(bx, y, bw, h, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.9 }),
        ], { color: P.accent, fillColor: P.accent, width: 1.6, seed: 730 + i });
        const label = R.mono(ctx, g, String(p.tasks[i] || "").toUpperCase(), {
          x: bx + bw / 2, y: y + h / 2 + u * 0.7, size: 1.9, color: P.accentInk, anchor: "middle", opacity: 0,
        });
        blocks.push({ els, label, start: 0.35 + i * p.stepSec });
      }

      // ---- Bloques extra (fuera, arriba) ----
      const extras = [];
      const ex = Array.isArray(p.extra) ? p.extra : [];
      const extraW = boxW * 0.72;
      const extraH = u * 4.2;
      const extraGap = u * 0.8;
      const extraBaseY = boxY - u * 1.2;
      for (let i = 0; i < ex.length; i++) {
        const y = extraBaseY - (i + 1) * (extraH + extraGap);
        const x = cx - extraW / 2 + (i % 2 === 0 ? -u * 0.6 : u * 0.6);
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(x, y, extraW, extraH, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.9 }),
        ], { color: P.accent, fillColor: P.accent, width: 1.6, seed: 760 + i });
        const label = R.mono(ctx, g, String(ex[i] || "").toUpperCase(), {
          x: x + extraW / 2, y: y + extraH / 2 + u * 0.7, size: 1.9, color: P.accentInk, anchor: "middle", opacity: 0,
        });
        extras.push({ els, label, x, y, w: extraW, h: extraH });
      }

      // ---- Rótulo grande de desborde (al costado) ----
      const bigLabel = p.overflowLabel ? R.text(ctx, g, String(p.overflowLabel), {
        x: boxX + boxW + u * 2.5, y: boxY + boxH * 0.5, size: 5.2, weight: 800, color: P.accent, anchor: "start", opacity: 0,
      }) : null;

      // ---- Etiqueta cabecera ----
      const headLabel = R.label(ctx, g, "CARGA", { x: cx, y: headY, size: 2.0 });
      headLabel.setAttribute("opacity", "0");

      // ---- Nota manuscrita pie ----
      const footNote = R.hand(ctx, g, "no entra más", {
        x: cx, y: footY, size: 2.6, color: P.accent, anchor: "middle", opacity: 0,
      });

      return {
        render(lt, b, t) {
          // Recipiente y divisiones se dibujan primero
          R.draw(boxEls, lt, { start: 0, total: 0.5, dur: 0.5, t });
          divEls.forEach((d, i) => R.draw(d, lt, { start: 0.15 + i * 0.08, dur: 0.3, ease: "out", t }));

          // Cabecera
          headLabel.setAttribute("opacity", String(prog(lt, 0, 0.3)));

          // Bloques: entran uno por uno desde abajo
          blocks.forEach((blk) => {
            const q = prog(lt, blk.start, 0.35, "out");
            R.draw(blk.els, lt, { start: blk.start, dur: 0.35, ease: "out", t });
            blk.label.setAttribute("opacity", String(q));
          });

          // Desborde
          const ov = p.overflowAt;
          const hasOverflow = ov >= 0 && lt >= ov;
          const oq = hasOverflow ? prog(lt, ov, 0.4, "out") : 0;

          // Borde lima
          rimEls.forEach(el => el.setAttribute("opacity", String(oq * 0.9)));

          // Extras: aparecen y tiemblan
          extras.forEach((ex, i) => {
            const s = ov + 0.15 + i * 0.25;
            const q = prog(lt, s, 0.35, "out");
            R.draw(ex.els, lt, { start: s, dur: 0.35, ease: "out", t });
            ex.label.setAttribute("opacity", String(q));
            // Temblor: función pura de lt
            const since = lt - s;
            const shake = (since > 0 && since < 2.5) ? Math.sin(since * 42 + i * 1.7) * (1 - since / 2.5) * u * 0.35 : 0;
            const grp = ex.els[0].parentNode;
            if (grp && grp.setAttribute) {
              grp.setAttribute("transform", `translate(${shake.toFixed(2)} 0)`);
            }
          });

          // Rótulo grande
          if (bigLabel) {
            const q = prog(lt, ov + 0.5, 0.5, "out");
            bigLabel.setAttribute("opacity", String(q));
          }

          // Nota pie
          footNote.setAttribute("opacity", String(hasOverflow ? prog(lt, ov + 0.8, 0.4, "out") : 0));

          // Respiración lenta del recipiente
          const breathe = 1 + Math.sin(lt * 0.6) * 0.004;
          g.setAttribute("transform", `translate(${cx} ${cy}) scale(${breathe.toFixed(4)}) translate(${-cx} ${-cy})`);

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
```

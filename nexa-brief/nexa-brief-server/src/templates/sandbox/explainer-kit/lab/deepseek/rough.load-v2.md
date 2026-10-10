# rough.load · v2

modelo: deepseek-flash · 9.5 s · tokens in 4947 / out 2237

## Pedido

Creá `rough.load`: la capacidad de una computadora dibujada a mano como un recipiente (una caja vertical alta con divisiones) que se va llenando con bloques de tareas, de abajo hacia arriba; cada bloque lleva un rótulo mono corto. Params: tasks (array de strings, las tareas que entran en orden), capacity (cuántas ranuras tiene el recipiente, por defecto 5), stepSec (segundos entre bloque y bloque), overflowAt (segundo local en que llegan tareas extra que NO caben; -1 = nunca), extra (array de rótulos de las tareas que no caben, p. ej. ['RADAR','RADAR']), overflowLabel (por defecto '1202'). Cuando desborda: los bloques extra quedan arriba del recipiente, fuera, temblando; el borde del recipiente se raya en lima y aparece overflowLabel GRANDE en lima al costado. Momento narrativo: 'La máquina, que ya trabajaba al límite, se llenó'.

## Respuesta

```js
(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;
  K.register({
    name: "rough.load",
    tags: ["capacidad", "límite", "computadora", "desborde"],
    layer: "main",
    summary: "Una computadora-recipiente dibujada a mano que se llena de bloques de tareas de abajo hacia arriba; cuando llegan tareas extra que no caben, quedan temblando afuera y el borde se raya en lima con un rótulo grande. Sirve para el momento en que la máquina, ya al límite, se satura.",
    example: {
      tasks: ["TAREA A", "TAREA B", "TAREA C", "TAREA D", "TAREA E"],
      capacity: 5,
      stepSec: 0.55,
      overflowAt: 3.4,
      extra: ["RADAR", "RADAR"],
      overflowLabel: "1202",
    },
    params: {
      tasks: { type: "array", default: ["TAREA A", "TAREA B", "TAREA C", "TAREA D", "TAREA E"], doc: "Rótulos de las tareas que entran, en orden." },
      capacity: { type: "number", default: 5, min: 1, max: 10, doc: "Ranuras del recipiente." },
      stepSec: { type: "number", default: 0.55, doc: "Segundos entre bloque y bloque." },
      overflowAt: { type: "number", default: -1, doc: "Segundo local en que llegan las tareas extra. -1 = nunca." },
      extra: { type: "array", default: ["RADAR", "RADAR"], doc: "Rótulos de las tareas que no caben." },
      overflowLabel: { type: "string", default: "1202", doc: "Rótulo grande en lima al desbordar." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, cy } = ctx.stage, c = ctx.stage.content;

      // ---- geometría del recipiente (caja vertical alta) ----
      const cap = Math.max(1, Math.round(p.capacity));
      const boxH = Math.min(c.h * 0.78, u * 46);
      const boxW = Math.min(c.w * 0.42, boxH * 0.62);
      const bx = cx - boxW / 2;
      const by = cy - boxH / 2 + u * 1.5;
      const pad = u * 1.6;
      const innerX = bx + pad, innerW = boxW - pad * 2;
      const innerY = by + pad, innerH = boxH - pad * 2;
      const slotH = innerH / cap;

      // ---- recipiente ----
      const boxEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(bx, by, boxW, boxH, o),
      ], { color: P.ink, width: 1.8, seed: 700 });

      // divisiones internas (líneas finas)
      const divEls = [];
      for (let i = 1; i < cap; i++) {
        const y = innerY + slotH * i;
        divEls.push(R.shape(ctx, g, (G, o) => [
          G.line(innerX, y, innerX + innerW, y, o),
        ], { color: P.muted, width: 0.9, seed: 710 + i }));
      }

      // ---- bloques de tareas ----
      const nTasks = Math.min(p.tasks.length, cap);
      const blocks = [];
      for (let i = 0; i < nTasks; i++) {
        const slot = i; // 0 = abajo
        const y = innerY + innerH - slotH * (slot + 1) + slotH * 0.12;
        const h = slotH * 0.76;
        const x = innerX + innerW * 0.06;
        const w = innerW * 0.88;
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(x, y, w, h, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.9 }),
        ], { color: P.ink, fillColor: P.accent, width: 1.4, seed: 730 + i });
        const label = R.mono(ctx, g, String(p.tasks[i]).toUpperCase(), {
          x: x + w / 2, y: y + h / 2 + u * 0.9, size: 1.7, color: P.ink, anchor: "middle", opacity: 0,
        });
        blocks.push({ els, label, start: 0.35 + i * p.stepSec });
      }

      // ---- tareas extra (fuera, arriba) ----
      const extras = [];
      const nExtra = p.extra ? p.extra.length : 0;
      const extraH = slotH * 0.7;
      const extraW = innerW * 0.8;
      const extraX = cx - extraW / 2;
      for (let i = 0; i < nExtra; i++) {
        const y = by - pad - extraH * (i + 1) - u * 0.6 * i;
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(extraX, y, extraW, extraH, o),
        ], { color: P.accent, width: 1.6, seed: 760 + i });
        const label = R.mono(ctx, g, String(p.extra[i]).toUpperCase(), {
          x: extraX + extraW / 2, y: y + extraH / 2 + u * 0.85, size: 1.6, color: P.accent, anchor: "middle", opacity: 0,
        });
        extras.push({ els, label, y, start: p.overflowAt >= 0 ? p.overflowAt + i * 0.22 : 999 });
      }

      // ---- rótulo grande de desborde ----
      const ovLabel = p.overflowLabel ? R.text(ctx, g, String(p.overflowLabel), {
        x: bx + boxW + u * 3.5, y: cy + u * 1.2, size: 5.2, weight: 800, color: P.accent, anchor: "start", opacity: 0,
      }) : null;

      // ---- etiqueta superior ----
      const topLabel = R.label(ctx, g, "CARGA", { x: cx, y: c.y + u * 1.5 });
      topLabel.setAttribute("opacity", 0);

      return {
        render(lt, b, t) {
          // recipiente
          R.draw(boxEls, lt, { start: 0, dur: 0.5, t });
          divEls.forEach((d, i) => R.draw(d, lt, { start: 0.15 + i * 0.05, dur: 0.25, t }));

          // etiqueta
          topLabel.setAttribute("opacity", prog(lt, 0.1, 0.3));

          // bloques
          blocks.forEach((bl) => {
            const q = prog(lt, bl.start, 0.3, "out");
            R.draw(bl.els, lt, { start: bl.start, dur: 0.3, t });
            bl.label.setAttribute("opacity", q);
          });

          // extras
          const ovOn = p.overflowAt >= 0 && lt >= p.overflowAt;
          extras.forEach((ex) => {
            const q = prog(lt, ex.start, 0.3, "out");
            R.draw(ex.els, lt, { start: ex.start, dur: 0.3, t });
            ex.label.setAttribute("opacity", q);
            // temblor
            const since = lt - ex.start;
            const shake = (ovOn && since > 0 && since < 2.5)
              ? Math.sin(since * 42) * (1 - since / 2.5) * u * 0.5
              : 0;
            ex.els.forEach((el) => {
              if (el && el.setAttribute) el.setAttribute("transform", `translate(${shake.toFixed(2)} 0)`);
            });
            if (ex.label) ex.label.setAttribute("transform", `translate(${shake.toFixed(2)} 0)`);
          });

          // borde lima al desbordar: redibujar contorno en lima
          if (ovOn) {
            const q = prog(lt, p.overflowAt, 0.4, "out");
            if (!this._ovBorder) {
              this._ovBorder = R.shape(ctx, g, (G, o) => [
                G.rectangle(bx - u * 0.4, by - u * 0.4, boxW + u * 0.8, boxH + u * 0.8, o),
              ], { color: P.accent, width: 2.4, seed: 790 });
            }
            R.draw(this._ovBorder, lt, { start: p.overflowAt, dur: 0.4, t });
            if (ovLabel) ovLabel.setAttribute("opacity", q);
          }

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();
```

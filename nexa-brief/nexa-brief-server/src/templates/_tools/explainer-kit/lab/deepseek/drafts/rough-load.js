/* generado por deepseek-flash · prompt prompts/component-author.md · v4 — revisar antes de usar */
(function () {
  const K = Kit, R = Kit.rough, { clamp, prog } = K;
  K.register({
    name: "rough.load",
    tags: ["capacidad", "límite", "desborde", "computadora"],
    layer: "main",
    summary: "Un recipiente vertical (la máquina) se llena de bloques de tareas de abajo hacia arriba; cuando llegan tareas extra que no caben, quedan fuera temblando y el borde se raya en lima con un rótulo grande de desborde.",
    example: {
      tasks: ["BOOT", "SCAN", "INDEX", "QUERY", "WRITE"],
      capacity: 5,
      stepSec: 0.55,
      overflowAt: 3.6,
      extra: ["RADAR", "RADAR"],
      overflowLabel: "1202",
    },
    params: {
      tasks: { type: "array", default: ["BOOT", "SCAN", "INDEX", "QUERY", "WRITE"], doc: "Tareas que entran en orden." },
      capacity: { type: "number", default: 5, min: 1, max: 12, doc: "Ranuras del recipiente." },
      stepSec: { type: "number", default: 0.55, doc: "Segundos entre bloque y bloque." },
      overflowAt: { type: "number", default: -1, doc: "Segundo local en que llegan las tareas extra (-1 = nunca)." },
      extra: { type: "array", default: [], doc: "Rótulos de tareas que no caben." },
      overflowLabel: { type: "string", default: "1202", doc: "Rótulo grande de desborde." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, cx, cy } = ctx.stage, c = ctx.stage.content;

      // --- layout ---
      // cabecera: y = c.y .. c.y + 0.12*c.h
      // cuerpo:   y = c.y + 0.12*c.h .. c.y + 0.88*c.h
      // pie:      y = c.y + 0.88*c.h .. c.y + c.h
      const bodyTop = c.y + c.h * 0.12;
      const bodyBot = c.y + c.h * 0.88;
      const bodyH = bodyBot - bodyTop;

      // recipiente: caja vertical alta, ocupa ~55% del ancho de content en 9:16
      const boxW = Math.min(c.w * 0.55, bodyH * 0.55);
      const boxH = Math.min(bodyH * 0.92, boxW * 2.2);
      const boxX = cx - boxW * 0.5;
      const boxY = bodyTop + (bodyH - boxH) * 0.5;

      // ranuras: capacity divisiones horizontales dentro de la caja
      const slotH = boxH / p.capacity;
      const pad = u * 0.6;

      // rótulo de cabecera
      const header = R.mono(ctx, g, "LOAD", { x: cx, y: c.y + u * 2.2, size: 2.0, color: P.muted, anchor: "middle" });

      // contenedor del recipiente (dibujado a mano)
      const boxEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(boxX, boxY, boxW, boxH, o),
      ], { color: P.ink, width: 1.6, seed: 700 });

      // divisiones internas (capacity - 1 líneas)
      const divEls = [];
      for (let i = 1; i < p.capacity; i++) {
        const y = boxY + slotH * i;
        divEls.push(R.shape(ctx, g, (G, o) => [
          G.line(boxX + pad, y, boxX + boxW - pad, y, o),
        ], { color: P.muted, width: 1.0, seed: 710 + i }));
      }

      // bloques de tareas: uno por ranura, de abajo hacia arriba
      const nTasks = Math.min(p.tasks.length, p.capacity);
      const blocks = [];
      for (let i = 0; i < nTasks; i++) {
        const slot = p.capacity - 1 - i; // 0 = abajo
        const by = boxY + slotH * slot + pad * 0.5;
        const bh = slotH - pad;
        const bx = boxX + pad;
        const bw = boxW - pad * 2;
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(bx, by, bw, bh, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.8 }),
        ], { color: P.ink, fillColor: P.accent, width: 1.3, seed: 720 + i });
        const label = R.mono(ctx, g, String(p.tasks[i]).toUpperCase(), {
          x: bx + bw * 0.5, y: by + bh * 0.5 + u * 0.7, size: Math.min(2.0, bh / u * 0.35), color: P.accentInk, anchor: "middle",
        });
        blocks.push({ els, label, slot });
      }

      // bloques extra (fuera, arriba del recipiente)
      const extras = [];
      const nExtra = p.extra.length;
      for (let i = 0; i < nExtra; i++) {
        const ew = boxW * 0.7;
        const eh = Math.min(slotH * 0.85, u * 5);
        const ex = cx - ew * 0.5 + (i - (nExtra - 1) / 2) * (ew * 0.15);
        const ey = boxY - eh - u * 0.8 - i * (eh + u * 0.5);
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(ex, ey, ew, eh, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.8 }),
        ], { color: P.accent, fillColor: P.accent, width: 1.4, seed: 740 + i });
        const label = R.mono(ctx, g, String(p.extra[i]).toUpperCase(), {
          x: ex + ew * 0.5, y: ey + eh * 0.5 + u * 0.7, size: Math.min(1.8, eh / u * 0.35), color: P.accentInk, anchor: "middle",
        });
        extras.push({ els, label, ex, ey, ew, eh });
      }

      // borde rayado en lima (aparece al desbordar)
      const overflowBorder = R.shape(ctx, g, (G, o) => [
        G.rectangle(boxX - u * 0.4, boxY - u * 0.4, boxW + u * 0.8, boxH + u * 0.8, o),
      ], { color: P.accent, width: 2.2, seed: 760 });

      // rótulo grande de desborde, al costado derecho del recipiente
      const labelX = boxX + boxW + u * 2.5;
      const labelY = boxY + boxH * 0.5;
      const overflowText = R.mono(ctx, g, String(p.overflowLabel).toUpperCase(), {
        x: labelX, y: labelY, size: 5.5, color: P.accent, anchor: "start", weight: 700,
      });

      return {
        render(lt, b, t) {
          // cabecera
          header.setAttribute("opacity", prog(lt, 0, 0.3));

          // recipiente
          R.draw(boxEls, lt, { start: 0.05, dur: 0.5, total: 0.55, t });
          divEls.forEach((d, i) => R.draw(d, lt, { start: 0.35 + i * 0.06, dur: 0.25, total: 0.6, t }));

          // bloques de tareas
          blocks.forEach((bl, i) => {
            const s = 0.7 + i * p.stepSec;
            R.draw(bl.els, lt, { start: s, dur: 0.35, total: 0.4, t });
            const q = prog(lt, s, 0.35, "out");
            bl.label.setAttribute("opacity", q);
          });

          // desborde
          const hasOverflow = p.overflowAt >= 0 && p.extra.length > 0;
          const ovStart = hasOverflow ? p.overflowAt : 1e9;
          const ovQ = prog(lt, ovStart, 0.5, "out");

          // borde rayado
          R.draw(overflowBorder, lt, { start: ovStart, dur: 0.4, total: 0.5, t });
          overflowBorder.forEach(el => el.setAttribute("opacity", ovQ));

          // rótulo grande
          overflowText.setAttribute("opacity", prog(lt, ovStart + 0.15, 0.4, "out"));

          // extras: aparecen y tiemblan
          extras.forEach((ex, i) => {
            const s = ovStart + 0.1 + i * 0.18;
            R.draw(ex.els, lt, { start: s, dur: 0.3, total: 0.35, t });
            const q = prog(lt, s, 0.3, "out");
            ex.label.setAttribute("opacity", q);
            // temblor determinista
            const since = lt - s;
            const shake = since > 0 && since < 1.2
              ? Math.sin(since * 55 + i * 1.7) * (1 - since / 1.2) * u * 0.5
              : (since >= 1.2 ? Math.sin(lt * 40 + i * 1.7) * u * 0.15 : 0);
            ex.els.forEach(el => el.setAttribute("transform", `translate(${shake.toFixed(2)} 0)`));
            ex.label.setAttribute("transform", `translate(${shake.toFixed(2)} 0)`);
          });

          // respiración lenta del recipiente
          const breathe = 1 + Math.sin(lt * 0.6) * 0.004;
          g.setAttribute("transform", `translate(${cx} ${cy}) scale(${breathe.toFixed(4)}) translate(${-cx} ${-cy})`);

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;
  K.register({
    name: "rough.entryGate",
    tags: ["trabajo", "automatización", "puerta", "carriles"],
    layer: "main",
    summary: "Dos carriles dibujados a mano: el de tareas de entrada se estrecha como una puerta que se cierra, mientras el de revisión y diseño gana espacio. Sirve para el momento en que la narración dice que el primer peldaño se angosta.",
    example: {
      juniorLabel: "PRIMER PELDAÑO",
      entryTasks: "tareas de entrada",
      reviewLabel: "REVISIÓN Y DISEÑO",
      reviewTasks: "criterio · diseño · responsabilidad",
      note: "se angosta",
    },
    params: {
      juniorLabel: { type: "string", default: "PRIMER PELDAÑO", doc: "Rótulo del carril que se estrecha." },
      entryTasks: { type: "string", default: "tareas de entrada", doc: "Texto corto del carril de entrada." },
      reviewLabel: { type: "string", default: "REVISIÓN Y DISEÑO", doc: "Rótulo del carril que gana peso." },
      reviewTasks: { type: "string", default: "criterio · diseño · responsabilidad", doc: "Texto corto del carril de revisión." },
      note: { type: "string", default: "se angosta", doc: "Nota manuscrita en lima (opcional)." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content;

      // ---- zonas fijas dentro de content ----
      // cabecera: 12% arriba (rótulos de carril)
      // cuerpo: 76% (los dos carriles / puerta)
      // pie: 12% (nota manuscrita)
      const headH = c.h * 0.12;
      const footH = c.h * 0.12;
      const bodyY = c.y + headH;
      const bodyH = c.h - headH - footH;

      // ---- layout de carriles ----
      // 9:16 → apilados verticalmente; 16:9 → dos columnas
      let entryBox, reviewBox;
      if (portrait) {
        const gap = u * 3;
        const half = (bodyH - gap) / 2;
        entryBox = { x: c.x + c.w * 0.06, y: bodyY, w: c.w * 0.88, h: half };
        reviewBox = { x: c.x + c.w * 0.06, y: bodyY + half + gap, w: c.w * 0.88, h: half };
      } else {
        const gap = u * 4;
        const halfW = (c.w - gap) / 2;
        entryBox = { x: c.x + c.w * 0.02, y: bodyY, w: halfW * 0.98, h: bodyH };
        reviewBox = { x: c.x + c.w * 0.02 + halfW + gap, y: bodyY, w: halfW * 0.98, h: bodyH };
      }

      // ---- carril de entrada: marco que se estrecha ----
      // El marco arranca ancho y se angosta hacia la derecha (o hacia abajo en portrait).
      // En portrait: la puerta es un rectángulo que se achica en ancho.
      // En landscape: la puerta se achica en ancho también (columna izquierda).
      const entryPad = u * 2;
      const entryInner = {
        x: entryBox.x + entryPad,
        y: entryBox.y + entryPad,
        w: entryBox.w - entryPad * 2,
        h: entryBox.h - entryPad * 2,
      };

      // El "marco" es un rectángulo que se achica: ancho final = 38% del inicial
      const gateW0 = entryInner.w;
      const gateW1 = entryInner.w * 0.38;
      const gateH = entryInner.h * 0.72;
      const gateY = entryInner.y + (entryInner.h - gateH) / 2;

      // marco exterior (fijo, delimita el carril)
      const laneFrameEntry = R.shape(ctx, g, (G, o) => [
        G.rectangle(entryBox.x, entryBox.y, entryBox.w, entryBox.h, o),
      ], { color: P.muted, width: 1.1, seed: 810 });

      // marco de la puerta (se estrecha)
      const gateEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(entryInner.x, gateY, gateW0, gateH, o),
      ], { color: P.ink, width: 1.6, seed: 811 });

      // tareas de entrada: pequeños cuadraditos que se agrupan ante el umbral
      const taskCount = 5;
      const tasks = [];
      for (let k = 0; k < taskCount; k++) {
        const s = u * 2.2;
        tasks.push({
          s,
          els: R.shape(ctx, g, (G, o) => [
            G.rectangle(0, 0, s, s, o),
          ], { color: P.ink, width: 1.2, seed: 820 + k }),
        });
      }

      // ---- carril de revisión: marco que se ensancha ----
      const reviewPad = u * 2;
      const reviewInner = {
        x: reviewBox.x + reviewPad,
        y: reviewBox.y + reviewPad,
        w: reviewBox.w - reviewPad * 2,
        h: reviewBox.h - reviewPad * 2,
      };
      const laneFrameReview = R.shape(ctx, g, (G, o) => [
        G.rectangle(reviewBox.x, reviewBox.y, reviewBox.w, reviewBox.h, o),
      ], { color: P.muted, width: 1.1, seed: 830 });

      // bloques de revisión: tres rectángulos que se ensanchan
      const reviewBlocks = [];
      const rCount = 3;
      for (let k = 0; k < rCount; k++) {
        reviewBlocks.push(R.shape(ctx, g, (G, o) => [
          G.rectangle(0, 0, 10, 10, o),
        ], { color: P.accent, width: 1.4, seed: 840 + k }));
      }

      // ---- rótulos ----
      const labelEntry = R.label(ctx, g, p.juniorLabel, {
        x: entryBox.x + entryBox.w / 2,
        y: entryBox.y - u * 0.4,
        size: 1.7,
      });
      const labelReview = R.label(ctx, g, p.reviewLabel, {
        x: reviewBox.x + reviewBox.w / 2,
        y: reviewBox.y - u * 0.4,
        size: 1.7,
      });

      // textos de tareas (mono, muted)
      const textEntry = R.mono(ctx, g, p.entryTasks, {
        x: entryBox.x + entryBox.w / 2,
        y: entryBox.y + entryBox.h - u * 1.2,
        size: 1.7, color: P.muted, anchor: "middle",
      });
      const textReview = R.mono(ctx, g, p.reviewTasks, {
        x: reviewBox.x + reviewBox.w / 2,
        y: reviewBox.y + reviewBox.h - u * 1.2,
        size: 1.7, color: P.muted, anchor: "middle",
      });

      // nota manuscrita en lima (pie)
      const noteEl = p.note ? R.hand(ctx, g, p.note, {
        x: entryBox.x + entryBox.w * 0.5,
        y: c.y + c.h - footH * 0.35,
        size: 2.4, color: P.accent, anchor: "middle",
      }) : null;

      // flecha lima que señala la puerta que se cierra
      const arrowEls = R.shape(ctx, g, (G, o) => {
        const ax = entryInner.x + gateW1 + u * 1.5;
        const ay = gateY + gateH / 2;
        return [
          G.line(ax - u * 2.5, ay, ax, ay, o),
          G.line(ax, ay, ax - u * 1.2, ay - u * 1.2, o),
          G.line(ax, ay, ax - u * 1.2, ay + u * 1.2, o),
        ];
      }, { color: P.accent, width: 1.8, seed: 860 });

      return {
        render(lt, b, t) {
          // entrada: 0.0–0.5 dibujo de marcos
          R.draw(laneFrameEntry, lt, { start: 0.0, dur: 0.4, t });
          R.draw(laneFrameReview, lt, { start: 0.1, dur: 0.4, t });
          R.draw(gateEls, lt, { start: 0.2, dur: 0.5, t });

          // rótulos: aparecen a los 0.3s
          labelEntry.setAttribute("opacity", prog(lt, 0.3, 0.3));
          labelReview.setAttribute("opacity", prog(lt, 0.4, 0.3));
          textEntry.setAttribute("opacity", prog(lt, 0.5, 0.3));
          textReview.setAttribute("opacity", prog(lt, 0.6, 0.3));

          // ---- puerta que se estrecha: 1.0 → 2.6s ----
          const shrink = prog(lt, 1.0, 1.6, "inOut");
          const curW = lerp(gateW0, gateW1, shrink);
          // redibujar el rectángulo de la puerta: reemplazamos el path
          // (rough no permite cambiar geometría; usamos transform scaleX)
          const sx = curW / gateW0;
          gateEls.forEach(el => {
            el.setAttribute("transform", `translate(${entryInner.x} 0) scale(${sx.toFixed(4)} 1) translate(${-entryInner.x} 0)`);
          });

          // tareas de entrada: se agrupan ante el umbral
          // posición inicial: repartidas a lo ancho del carril
          // posición final: apiladas junto a la puerta angosta
          const groupP = prog(lt, 1.2, 1.4, "inOut");
          const targetX = entryInner.x + gateW1 + u * 1.2;
          const targetY0 = gateY + gateH * 0.15;
          const stepY = gateH * 0.22;
          tasks.forEach((tk, k) => {
            const startX = entryInner.x + u * 2 + k * (entryInner.w - u * 4) / (taskCount - 1);
            const startY = gateY + gateH * 0.5 - tk.s / 2;
            const endX = targetX;
            const endY = targetY0 + k * stepY;
            const x = lerp(startX, endX, groupP);
            const y = lerp(startY, endY, groupP);
            const appear = prog(lt, 0.6 + k * 0.08, 0.25);
            tk.els.forEach(el => {
              el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
              el.setAttribute("opacity", appear);
            });
            R.draw(tk.els, lt, { start: 0.6 + k * 0.08, dur: 0.25, t });
          });

          // revisión: bloques que se ensanchan
          const grow = prog(lt, 1.0, 1.6, "inOut");
          const blockH = reviewInner.h * 0.16;
          const blockGap = reviewInner.h * 0.06;
          const totalH = rCount * blockH + (rCount - 1) * blockGap;
          const startY = reviewInner.y + (reviewInner.h - totalH) / 2;
          reviewBlocks.forEach((bl, k) => {
            const w0 = reviewInner.w * 0.35;
            const w1 = reviewInner.w * 0.92;
            const w = lerp(w0, w1, grow);
            const x = reviewInner.x + (reviewInner.w - w) / 2;
            const y = startY + k * (blockH + blockGap);
            const appear = prog(lt, 0.8 + k * 0.1, 0.3);
            bl.forEach(el => {
              el.setAttribute("transform", `translate(${x.toFixed(2)} ${y.toFixed(2)}) scale(${(w / 10).toFixed(4)} ${(blockH / 10).toFixed(4)})`);
              el.setAttribute("opacity", appear);
            });
            R.draw(bl, lt, { start: 0.8 + k * 0.1, dur: 0.3, t });
          });

          // flecha lima: aparece cuando la puerta ya se estrechó
          R.draw(arrowEls, lt, { start: 2.2, dur: 0.4, t });
          arrowEls.forEach(el => el.setAttribute("opacity", prog(lt, 2.2, 0.3)));

          // nota manuscrita
          if (noteEl) noteEl.setAttribute("opacity", prog(lt, 2.4, 0.4));

          // respiración lenta: zoom 0.5%/s sobre todo el grupo
          const breathe = 1 + lt * 0.005;
          g.setAttribute("transform", `translate(${cx} ${cy}) scale(${breathe.toFixed(4)}) translate(${-cx} ${-cy})`);

          // salida
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

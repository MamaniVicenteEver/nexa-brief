(function () {
  const K = Kit, R = Kit.rough, { clamp, lerp, prog, ease } = K;
  K.register({
    name: "rough.abstractionLadder",
    tags: ["abstracción", "generaciones", "escalera", "capas", "programación"],
    layer: "main",
    summary: "Escalera de capas que sube el nivel de abstracción: de instrucciones de máquina a un agente que produce código. Sirve para narrar la evolución de las herramientas de programación sin sugerir pérdida de trabajo.",
    example: { labels: ["MÁQUINA", "LENGUAJE", "VISUAL", "AGENTE"], active: 3, header: "NIVELES DE ABSTRACCIÓN", activeTag: "ACTIVA", note: "cada capa esconde la de abajo" },
    params: {
      labels: { type: "array", default: ["MÁQUINA", "LENGUAJE", "VISUAL", "AGENTE"], doc: "Rótulos cortos de cada capa (3 a 5)." },
      active: { type: "number", default: 3, min: 0, max: 4, doc: "Índice de la capa activa (destacada en lima)." },
      header: { type: "string", default: "NIVELES DE ABSTRACCIÓN", doc: "Título superior; puede ser vacío." },
      activeTag: { type: "string", default: "ACTIVA", doc: "Rótulo de la capa resaltada." },
      note: { type: "string", default: "", doc: "Nota manuscrita opcional al pie." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, cx, cy, portrait } = ctx.stage;
      const c = ctx.stage.content;

      // Normalizar labels a 3..5
      let labels = Array.isArray(p.labels) ? p.labels.slice(0, 5) : [];
      if (labels.length < 3) labels = ["MÁQUINA", "LENGUAJE", "VISUAL", "AGENTE"].slice(0, Math.max(3, labels.length));
      const N = labels.length;
      const active = clamp(Math.round(p.active ?? N - 1), 0, N - 1);

      // Zonas: cabecera 12%, cuerpo 76%, pie 12%
      const headY = c.y + c.h * 0.06;
      const bodyTop = c.y + c.h * 0.14;
      const bodyBot = c.y + c.h * 0.86;
      const bodyH = bodyBot - bodyTop;
      const footY = c.y + c.h * 0.93;

      // Layout de tarjetas
      const cards = []; // {x,y,w,h,label,idx}
      if (portrait) {
        // Apilado vertical: cada tarjeta ocupa ~85% del ancho de content, alto repartido
        const cw = c.w * 0.86;
        const gap = bodyH * 0.045;
        const ch = (bodyH - gap * (N - 1)) / N;
        const x0 = c.x + (c.w - cw) / 2;
        for (let i = 0; i < N; i++) {
          // La capa activa se dibuja más arriba (más abstracción = más arriba)
          const y = bodyTop + i * (ch + gap);
          cards.push({ x: x0, y, w: cw, h: ch, label: labels[i], idx: i });
        }
      } else {
        // Escalera horizontal: cada tarjeta sube un escalón
        const cw = (c.w * 0.9) / N;
        const ch = bodyH * 0.42;
        const x0 = c.x + c.w * 0.05;
        const stepY = bodyH * 0.16;
        for (let i = 0; i < N; i++) {
          const x = x0 + i * cw;
          // sube hacia la derecha: la capa más abstracta (última) más arriba
          const y = bodyBot - ch - (N - 1 - i) * stepY * 0.55;
          cards.push({ x: x + cw * 0.06, y, w: cw * 0.88, h: ch, label: labels[i], idx: i });
        }
      }

      // Elementos por tarjeta: contenedor + rótulo + icono chico
      const icons = ["terminal", "code", "browser", "bot", "chip"];
      const cardEls = cards.map((cd, i) => {
        const els = R.shape(ctx, g, (G, o) => [
          G.rectangle(cd.x, cd.y, cd.w, cd.h, o),
        ], { color: P.ink, width: 1.6, seed: 700 + i * 13 });
        return els;
      });

      // Rótulos de cada tarjeta (mono, mayúsculas)
      const labelEls = cards.map((cd, i) => {
        const size = Math.min(3.0, (cd.h / u) * 0.32);
        return R.mono(ctx, g, cd.label, {
          x: cd.x + cd.w / 2,
          y: cd.y + cd.h * 0.62,
          size: Math.max(1.8, size),
          color: P.ink,
          anchor: "middle",
          weight: 700,
        });
      });

      // Icono chico arriba del rótulo en cada tarjeta
      const iconEls = cards.map((cd, i) => {
        const s = Math.min(cd.w, cd.h) * 0.42;
        const ix = cd.x + cd.w / 2 - s / 2;
        const iy = cd.y + cd.h * 0.12;
        return R.sketch(ctx, g, icons[i % icons.length], { x: ix, y: iy, w: s, h: s }, {
          color: P.ink, width: 1.3, seed: 800 + i * 17,
        });
      });

      // Conectores entre tarjetas (líneas que suben)
      const connectors = [];
      for (let i = 0; i < N - 1; i++) {
        const a = cards[i], b = cards[i + 1];
        let x1, y1, x2, y2;
        if (portrait) {
          x1 = a.x + a.w / 2; y1 = a.y + a.h;
          x2 = b.x + b.w / 2; y2 = b.y;
        } else {
          x1 = a.x + a.w; y1 = a.y + a.h * 0.5;
          x2 = b.x; y2 = b.y + b.h * 0.5;
        }
        connectors.push(R.shape(ctx, g, (G, o) => [
          G.line(x1, y1, x2, y2, o),
        ], { color: P.muted, width: 1.2, seed: 900 + i * 11 }));
      }

      // Resaltado lima de la capa activa: rectángulo rayado detrás
      const act = cards[active];
      const highlight = R.shape(ctx, g, (G, o) => [
        G.rectangle(act.x - u * 0.6, act.y - u * 0.6, act.w + u * 1.2, act.h + u * 1.2, {
          ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.9,
        }),
      ], { color: P.accent, fillColor: P.accent, width: 1.8, seed: 1001 });

      // Etiqueta lima con el nombre de la capa activa (arriba de la tarjeta activa)
      const activeLabel = R.label(ctx, g, p.activeTag || "", {
        x: act.x + act.w / 2,
        y: act.y - u * 2.2,
        size: 1.8,
      });

      // Nota manuscrita al pie
      const noteEl = p.note ? R.hand(ctx, g, p.note, {
        x: cx, y: footY, size: 2.6, color: P.accent, anchor: "middle",
      }) : null;

      // Título de cabecera
      const titleEl = R.text(ctx, g, p.header || "", {
        x: cx, y: headY, size: 2.4, color: P.muted, anchor: "middle", weight: 600,
      });

      return {
        render(lt, b, t) {
          // Título entra primero
          titleEl.setAttribute("opacity", prog(lt, 0, 0.3));

          // Tarjetas se dibujan escalonadas (arriba→abajo / izq→der)
          cards.forEach((cd, i) => {
            const s = 0.15 + i * 0.12;
            R.draw(cardEls[i], lt, { start: s, dur: 0.35, t });
            R.draw(iconEls[i], lt, { start: s + 0.15, dur: 0.3, t });
            const lp = prog(lt, s + 0.3, 0.25);
            labelEls[i].setAttribute("opacity", lp);
            // El rótulo de la capa activa permanece en tinta sobre el rayado.
            if (i === active) labelEls[i].setAttribute("fill", P.ink);
          });

          // Conectores
          connectors.forEach((el, i) => {
            R.draw(el, lt, { start: 0.5 + i * 0.1, dur: 0.25, t });
          });

          // Resaltado lima de la capa activa: aparece después de que la tarjeta se dibuja
          const hs = 0.15 + active * 0.12 + 0.3;
          R.draw(highlight, lt, { start: hs, dur: 0.4, t });
          // Pulso suave del resaltado
          const pulse = 0.85 + 0.15 * Math.sin(lt * 2.2);
          highlight.forEach(el => {
            if (el && el.style) el.style.opacity = String(clamp(prog(lt, hs, 0.3)) * pulse);
          });

          // Etiqueta "CAPA ACTIVA"
          activeLabel.setAttribute("opacity", prog(lt, hs + 0.2, 0.3));

          // Nota al pie
          if (noteEl) noteEl.setAttribute("opacity", prog(lt, 1.0, 0.4));

          // Respiración lenta del grupo entero (zoom 0.5%/s)
          const breathe = 1 + 0.005 * Math.sin(lt * 0.8);
          g.setAttribute("transform", `translate(${cx} ${cy}) scale(${breathe.toFixed(4)}) translate(${-cx} ${-cy})`);

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

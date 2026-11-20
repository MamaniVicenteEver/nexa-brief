(function () {
  "use strict";
  const K = window.Kit, T = K.titanes, D = T.data;
  function neon(g, points, baseline, color, u) {
    if (points.length < 2) return;
    const top = Math.min(...points.map(v => v[1]));
    const fill = g.createLinearGradient(0, top, 0, Math.max(top + 1, baseline));
    fill.addColorStop(0, T.color(color, .32)); fill.addColorStop(1, T.color(color, 0));
    g.beginPath(); points.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y));
    g.lineTo(points.at(-1)[0], baseline); g.lineTo(points[0][0], baseline); g.closePath(); g.fillStyle = fill; g.fill();
    g.save(); g.lineJoin = "round"; g.lineCap = "round"; g.shadowColor = color; g.shadowBlur = u * 2.2;
    D.line(g, points, T.color(color, .30), u * 1.6);
    D.line(g, points, color, u * .52); g.shadowBlur = 0;
    D.line(g, points, T.color(color, .9), u * .13); g.restore();
  }
  K.register({
    name: "titanes.bolsa", layer: "main", opaque: true, post: 0, tags: ["datos", "bolsa", "caída", "barras", "electrocardiograma"],
    summary: "Serie de neón con años, valores y eventos. Quiebre rojo con impacto, pulso que se aplana o barras con cero real.",
    example: { titulo: "LA CAÍDA", modo: "caida", serie: [{ ano: "1987", valor: 175.88 }, { ano: "1993", valor: 40.63 }], caidaIndice: 0, decimales: 2, unidad: "US$", eventos: [{ indice: 0, texto: "CUMBRE" }], bg: "mercado" },
    params: {
      ...D.params,
      titulo: { type: "string", default: "COTIZACIÓN", doc: "Titular de la serie." },
      serie: { type: "array", default: [{ ano: "A", valor: 100 }, { ano: "B", valor: 35 }], doc: "Objetos {ano,valor}. Años numéricos usan distancia temporal. Barras conservan el orden de entrada." },
      modo: { type: "enum", default: "linea", options: ["linea", "caida", "electrocardiograma", "barras"], doc: "Tratamiento de la serie. Electrocardiograma es una metáfora visual." },
      eventos: { type: "array", default: [], doc: "Marcas {indice,texto}. Se muestra el último evento alcanzado." },
      unidad: { type: "string", default: "", doc: "US$, M, %, etc." },
      decimales: { type: "number", default: 0, min: 0, max: 6, doc: "Decimales del valor destacado." },
      dibujarEn: { type: "number", default: 2.8, min: .5, doc: "Segundos del trazado antes de respirar." },
      caidaIndice: { type: "number", default: 0, min: 0, doc: "Punto donde se quiebra la línea y empieza la sangre." },
      caidaEn: { type: "number", default: 2.4, min: .2, doc: "Segundo local del quiebre o del aplanamiento. Admite @palabra." },
      pulso: { type: "string", default: "PULSO", doc: "Etiqueta del estado vivo del electrocardiograma." },
      plano: { type: "string", default: "SIN PULSO", doc: "Etiqueta del estado plano del electrocardiograma." },
    },
    create(ctx, p) {
      const st = ctx.stage, { H, u, portrait } = st, g = ctx.g.main, P = T.palette(ctx, p), box = D.box(st);
      const data = (Array.isArray(p.serie) ? p.serie : []).filter(v => v && Number.isFinite(Number(v.valor))).map(v => ({ ...v, valor: +v.valor }));
      const values = data.map(v => v.valor), min = Math.min(0, ...values), max = Math.max(1, ...values), span = Math.max(1, max - min);
      const index = K.clamp(Math.round(p.caidaIndice), 0, Math.max(0, data.length - 2));
      const x = box.x + u * 2, width = box.w - u * 4, top = H * (portrait ? .43 : .48), bottom = H * (portrait ? .64 : .74), height = bottom - top;
      const yearStart = Number(data[0]?.ano), yearSpan = Number(data.at(-1)?.ano) - yearStart;
      const chronological = yearSpan > 0 && data.every((v, i) => Number.isFinite(Number(v.ano)) && (!i || +v.ano > +data[i - 1].ano));
      const points = data.map((v, i) => [x + width * (chronological ? (+v.ano - yearStart) / yearSpan : i / Math.max(1, data.length - 1)), bottom - (v.valor - min) / span * height]);
      return D.scene(ctx, p, "mercado", t => {
        g.fillStyle = T.color(P.black, .28); g.fillRect(0, 0, st.W, H);
        D.heading(g, st, p.titulo, P);
        const crisis = p.modo === "caida" || p.modo === "electrocardiograma", elapsed = t - p.caidaEn;
        const hit = crisis && elapsed >= 0 ? Math.sin(elapsed * 66) * 8 * (1 - K.prog(elapsed, 0, .45)) : 0;
        const color = crisis && elapsed >= 0 ? P.blood : P.rim;
        T.glow(g, box.right, top, box.w, height * 2, color, .22);
        g.save(); g.translate(hit, hit * .35);
        D.panel(g, box.x - u, top - u * 3, box.w + u * 2, height + u * 9, P, color);
        const baseline = bottom - (0 - min) / span * height;
        D.line(g, [[x, top], [x, bottom], [x + width, bottom]], T.color(P.ink, .24), u * .12);
        if (min < 0) D.line(g, [[x, baseline], [x + width, baseline]], T.color(P.ink, .42), u * .15);
        if (p.modo === "electrocardiograma") {
          const flat = K.prog(t, p.caidaEn, .5, "in"), wave = [];
          for (let i = 0; i <= 180; i++) {
            const phase = ((i / 180 * 4 - t * .55) % 1 + 1) % 1;
            const pulse = Math.exp(-Math.pow((phase - .5) / .035, 2)) - .36 * Math.exp(-Math.pow((phase - .56) / .04, 2));
            wave.push([x + width * i / 180, top + height * .5 - pulse * height * .56 * (1 - flat)]);
          }
          neon(g, wave, bottom, color, u);
          D.label(g, flat >= 1 ? p.plano : p.pulso, box.x, H * .34, box.w, u * 11, color, { font: "Anton", weight: 400 });
        } else if (p.modo === "barras") {
          const step = width / Math.max(1, data.length), grow = K.prog(t, .15, p.dibujarEn);
          data.forEach((v, i) => {
            const target = bottom - (v.valor - min) / span * height, barY = baseline + (target - baseline) * K.prog(grow, i / Math.max(1, data.length) * .45, .55);
            const barColor = v.valor < 0 ? P.blood : P.rim, left = x + i * step, barW = step * .68;
            const grad = g.createLinearGradient(0, Math.min(barY, baseline), 0, Math.max(barY, baseline) + 1);
            grad.addColorStop(0, barColor); grad.addColorStop(1, T.color(barColor, .25));
            g.fillStyle = grad; g.fillRect(left, Math.min(barY, baseline), barW, Math.max(u * .1, Math.abs(baseline - barY)));
            D.line(g, [[left, barY], [left + barW, barY]], P.ink, u * .12);
          });
          D.number(g, String(data.length), box.x, H * .35, box.w * .5, u * 18, data.some(v => v.valor < 0) ? P.blood : P.rim);
          D.label(g, p.unidad, box.right, H * .35, box.w * .5, u * 4.5, P.ink, { align: "right" });
        } else if (points.length) {
          const before = K.prog(t, .15, Math.max(.1, p.caidaEn - .15), "inOut") * index;
          const after = index + K.prog(t, p.caidaEn, .5, "in") * (points.length - 1 - index);
          const progress = p.modo === "caida" ? (elapsed < 0 ? before : after) : K.prog(t, .15, p.dibujarEn, "inOut") * (points.length - 1);
          const reached = Math.floor(progress), fraction = progress - reached;
          const head = points[Math.min(reached, points.length - 1)], next = points[Math.min(reached + 1, points.length - 1)];
          const last = [K.lerp(head[0], next[0], fraction), K.lerp(head[1], next[1], fraction)];
          const visible = [...points.slice(0, reached + 1), last];
          if (p.modo === "caida" && elapsed >= 0) {
            neon(g, visible.slice(0, index + 1), bottom, P.rim, u);
            const broken = visible.slice(index);
            if (broken.length > 1) broken[0] = [broken[0][0] + u, broken[0][1] + u];
            neon(g, broken, bottom, P.blood, u);
          } else neon(g, visible, bottom, P.rim, u);
          T.glow(g, last[0], last[1], u * 4, u * 4, color, .8);
          g.fillStyle = P.ink; g.beginPath(); g.arc(last[0], last[1], u * .55, 0, Math.PI * 2); g.fill();
          const value = K.lerp(data[reached].valor, data[Math.min(reached + 1, data.length - 1)].valor, fraction);
          D.number(g, D.format(value, p.decimales), box.x, H * .35, box.w * .80, u * 17, color);
          D.label(g, p.unidad, box.right, H * .35, box.w * .19, u * 4, P.ink, { align: "right" });
          const event = p.eventos.filter(e => e.indice >= 0 && e.indice <= reached && e.indice < points.length).at(-1);
          if (event) {
            const pos = points[event.indice];
            D.line(g, [[pos[0], top - u * 2], [pos[0], pos[1]]], T.color(color, .6), u * .15);
            D.label(g, event.texto, box.x, top - u * 6, box.w, u * 3.4, P.ink);
          }
        }
        if (p.modo !== "electrocardiograma" && data.length) {
          const labels = [...new Set([0, data.length - 1])];
          for (const i of labels) {
            const align = i === 0 ? "left" : "right", xx = i === 0 ? x : x + width;
            D.label(g, `${data[i].ano} · ${D.format(data[i].valor, p.decimales)}`, xx, bottom + u * 5, width * .48, u * 3.3, P.ink, { align });
          }
        }
        g.restore(); D.source(g, st, p.fuente, P);
      });
    },
  });
})();

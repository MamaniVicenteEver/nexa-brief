/* =============================================================================
   rough · extra — componentes escritos por DeepSeek V4.1 Flash (prompt v4/v5) y
   retocados a mano después de revisarlos en la galería (ver prompts/NOTAS-deepseek.md).
   Retoques: rótulos legibles (rayado al 32% detrás del texto, texto en ink/accent),
   etiqueta opcional `title`, número de desborde en Inter 900.
   ========================================================================== */
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
      title: { type: "string", default: "", doc: "Etiqueta lima arriba (vacío = sin etiqueta)." },
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
      const header = p.title ? R.label(ctx, g, p.title, { x: cx, y: Math.max(u * 3, c.y - u * 4) }) : R.svg("g", null, g);

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
          x: bx + bw * 0.5, y: by + bh * 0.5, size: Math.min(2.4, bh / u * 0.4), color: P.ink, anchor: "middle", weight: 700,
        });
        els.forEach(e => e._fill && e.setAttribute("stroke-opacity", 0.32));
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
          x: ex + ew * 0.5, y: ey + eh * 0.5, size: Math.min(2.2, eh / u * 0.4), color: P.accent, anchor: "middle", weight: 700,
        });
        els.forEach(e => e._fill && e.setAttribute("stroke-opacity", 0.32));
        extras.push({ els, label, ex, ey, ew, eh });
      }

      // borde rayado en lima (aparece al desbordar)
      const overflowBorder = R.shape(ctx, g, (G, o) => [
        G.rectangle(boxX - u * 0.4, boxY - u * 0.4, boxW + u * 0.8, boxH + u * 0.8, o),
      ], { color: P.accent, width: 2.2, seed: 760 });

      // rótulo grande de desborde, al costado derecho del recipiente
      const labelX = boxX + boxW + u * 2.5;
      const labelY = boxY + boxH * 0.5;
      /* el rótulo cabe en lo que queda a la derecha del recipiente (antes se salía con textos largos) */
      const room = ctx.stage.W - labelX - u * 3, ovl = String(p.overflowLabel).toUpperCase();
      const ovSize = Math.min(9, room / u / Math.max(1, R.measure(ovl, "900 100px Inter") / 100));
      const overflowText = R.text(ctx, g, ovl, {
        x: labelX, y: labelY, size: ovSize, color: P.accent, anchor: "start", weight: 900,
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

/* =============================================================================
   rough · extra (videos) — note, network, browser, counter + bocetos de "Vago, pero emocionante"
   ========================================================================== */
(function () {
  const K = Kit, R = Kit.rough, { clamp, lerp, prog, ease, hash } = K;
  const P_ = Math.PI;
  Object.assign(R.SKETCHES, {
    paper: { viewBox: "0 0 100 100", shapes: (g, o) => [g.path("M20 6 L64 6 L82 24 L82 94 L20 94 Z", o), g.path("M64 6 L64 24 L82 24", o)] },
    cursor: { viewBox: "0 0 100 100", shapes: (g, o) => [g.path("M30 10 L30 78 L46 64 L58 90 L68 86 L56 60 L76 60 Z", o)] },
    coin: { viewBox: "0 0 100 100", shapes: (g, o) => [g.circle(50, 50, 80, o), g.circle(50, 50, 60, { ...o, seed: 4 }), g.path("M60 36 C56 30 40 30 40 40 C40 50 60 48 60 60 C60 70 44 70 40 64", o), g.line(50, 24, 50 , 76, o)] },
    gift: { viewBox: "0 0 100 100", shapes: (g, o) => [g.rectangle(14, 40, 72, 50, o), g.rectangle(10, 28, 80, 14, { ...o, seed: 3 }), g.line(50, 28, 50, 90, o), g.curve([[50, 28], [36, 10], [26, 22], [50, 28]], o), g.curve([[50, 28], [64, 10], [74, 22], [50, 28]], { ...o, seed: 7 })] },
    nextcube: { viewBox: "0 0 120 100", shapes: (g, o) => [g.rectangle(10, 8, 58, 46, o), g.rectangle(16, 14, 46, 34, { ...o, seed: 3 }), g.line(39, 54, 39, 62, o), g.rectangle(22, 62, 34, 6, o), g.rectangle(78, 20, 34, 70, { ...o, seed: 5 }), g.rectangle(84, 28, 18, 14, { ...o, seed: 6 }), g.rectangle(10, 76, 58, 14, { ...o, seed: 8 })] },
  });

  /* ------------------------------------------------------------------ nota en papel */
  K.register({
    name: "rough.note", tags: ["documento", "propuesta", "nota", "manuscrito"], layer: "main",
    summary: "Hoja de papel dibujada a mano con un título mecanografiado y renglones de texto garabateado; en `noteAt` aparece una nota manuscrita en lima en el margen (un comentario, una firma, 'vago, pero emocionante').",
    example: { title: "INFORMATION MANAGEMENT: A PROPOSAL", note: "vague but exciting…", noteAt: 2 },
    params: {
      title: { type: "string", default: "", doc: "Título del documento (mono, se escribe letra a letra)." },
      note: { type: "string", default: "", doc: "Nota manuscrita en lima (Caveat)." },
      noteAt: { type: "number", default: 2, doc: "Segundo (local) en que aparece la nota (admite \"@palabra\")." },
      lines: { type: "number", default: 9, min: 3, max: 16, doc: "Renglones de texto garabateado." },
      caption: { type: "string", default: "", doc: "Rótulo mono debajo del papel (fecha, autor)." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, portrait } = ctx.stage, bx = R.boxIn(ctx, portrait ? 0.86 : 0.8, 0.74);
      const paper = R.shape(ctx, g, (G, o) => [G.path(`M${bx.x} ${bx.y} L${bx.x + bx.w * 0.82} ${bx.y} L${bx.x + bx.w} ${bx.y + bx.w * 0.18} L${bx.x + bx.w} ${bx.y + bx.h} L${bx.x} ${bx.y + bx.h} Z`, o),
        G.path(`M${bx.x + bx.w * 0.82} ${bx.y} L${bx.x + bx.w * 0.82} ${bx.y + bx.w * 0.18} L${bx.x + bx.w} ${bx.y + bx.w * 0.18}`, o)], { width: 1.4, seed: 1001 });
      const fs = Math.min(2.6, bx.w / u / Math.max(14, p.title.length) * 1.55);
      const title = p.title ? R.mono(ctx, g, "", { x: bx.x + bx.w * 0.08, y: bx.y + bx.h * 0.13, size: fs, anchor: "start", color: P.ink, spacing: 0.05 }) : null;
      const rows = Array.from({ length: p.lines }, (_, k) => {
        const y = bx.y + bx.h * (0.26 + k * 0.62 / p.lines), w = bx.w * (k % 4 === 3 ? 0.5 : 0.8) * (0.85 + 0.15 * ((hash(k) % 10) / 10));
        return R.shape(ctx, g, (G, o) => [G.curve(Array.from({ length: 7 }, (_, i) => [bx.x + bx.w * 0.08 + w * i / 6, y + Math.sin(i * 1.7 + k) * u * 0.35]), { ...o, roughness: 1.4 })], { color: P.muted, width: 0.9, seed: 1010 + k });
      });
      const ny = bx.y + bx.h * 0.1, nx = bx.x + bx.w * (portrait ? 0.1 : 0.42);
      const note = p.note ? R.hand(ctx, g, "", { x: nx, y: ny - u * 5.5, size: portrait ? 5.4 : 5, color: P.accent, anchor: "start" }) : null;
      if (note) note.setAttribute("transform", `rotate(-4 ${nx} ${ny})`);
      const circ = p.note ? R.shape(ctx, g, (G, o) => [G.ellipse(nx + bx.w * 0.3, ny - u * 5.5, bx.w * 0.72, u * 10, o)], { color: P.accent, width: 1.3, seed: 1030 }) : [];
      const cap = p.caption ? R.mono(ctx, g, p.caption, { x: cx, y: bx.y + bx.h + u * 4, size: 1.6, color: P.muted, opacity: 0 }) : null;
      return {
        render(lt, b, t) {
          R.draw(paper, lt, { start: 0, dur: 0.7, t });
          if (title) R.type(title, p.title, prog(lt, 0.4, Math.min(1.4, p.title.length * 0.04), "linear"));
          rows.forEach((r, k) => R.draw(r, lt, { start: 0.6 + k * 0.08, dur: 0.35, t }));
          if (note) R.type(note, p.note, prog(lt, p.noteAt, 0.9, "linear"));
          R.draw(circ, lt, { start: p.noteAt + 0.9, dur: 0.5, t });
          if (cap) cap.setAttribute("opacity", prog(lt, 1, 0.4));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ red de enlaces */
  K.register({
    name: "rough.network", tags: ["red", "enlaces", "web", "conexiones", "crecimiento"], layer: "main",
    summary: "Red que crece: un nodo central y nodos que aparecen en anillos, unidos por enlaces a mano (documentos que se enlazan, la web, una comunidad). Los primeros nodos pueden llevar rótulo; el central va en lima.",
    example: { center: "WWW", labels: ["DOC", "FOTO", "VIDEO", "MAPA"], count: 28, growSec: 3 },
    params: {
      center: { type: "string", default: "", doc: "Rótulo del nodo central (lima)." },
      labels: { type: "array", default: [], doc: "Rótulos de los primeros nodos del anillo." },
      count: { type: "number", default: 24, min: 4, max: 70, doc: "Cantidad de nodos." },
      growSec: { type: "number", default: 3, doc: "Segundos hasta mostrar todos los nodos." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, cy } = ctx.stage, c = ctx.stage.content, r = K.rng(1990);
      const Rm = Math.min(c.w, c.h) * 0.46, nodes = [{ x: cx, y: cy, r: u * 4.5, ring: 0 }];
      for (let k = 1; k < p.count; k++) {
        const ring = k < 7 ? 1 : k < 19 ? 2 : 3, rr = Rm * [0, 0.38, 0.7, 0.98][ring] * (0.9 + 0.2 * r()), th = r() * P_ * 2;
        nodes.push({ x: cx + Math.cos(th) * rr * (c.w > c.h ? 1.25 : 1), y: cy + Math.sin(th) * rr * (c.w > c.h ? 0.82 : 1), r: u * (ring === 1 ? 2.6 : 1.7), ring });
      }
      const edges = nodes.slice(1).map((n, k) => {
        let best = 0, bd = 1e9;   // se engancha al nodo más cercano de un anillo interior
        nodes.forEach((m, j) => { if (m.ring < n.ring) { const d = Math.hypot(m.x - n.x, m.y - n.y); if (d < bd) { bd = d; best = j; } } });
        return { a: best, b: k + 1 };
      });
      for (let k = 0; k < p.count / 3; k++) { const a = 1 + Math.floor(r() * (p.count - 1)), b = 1 + Math.floor(r() * (p.count - 1)); if (a !== b && Math.abs(nodes[a].ring - nodes[b].ring) <= 1) edges.push({ a, b, extra: true }); }
      const eEls = edges.map((e, k) => R.shape(ctx, g, (G, o) => [G.line(nodes[e.a].x, nodes[e.a].y, nodes[e.b].x, nodes[e.b].y, { ...o, roughness: 0.9 })], { color: e.extra ? P.muted : P.ink, width: e.extra ? 0.7 : 1, seed: 1100 + k }));
      const nEls = nodes.map((n, k) => R.shape(ctx, g, (G, o) => [G.circle(n.x, n.y, n.r * 2, k === 0 ? { ...o, fill: "F", fillStyle: "solid" } : o)], { color: k === 0 ? P.accent : P.ink, fillColor: P.accent, width: k === 0 ? 1.4 : 1, seed: 1200 + k }));
      const tEls = nodes.map((n, k) => {
        const lab = k === 0 ? p.center : p.labels[k - 1];
        return lab ? R.mono(ctx, g, lab, { x: n.x, y: k === 0 ? n.y + n.r + u * 3.2 : n.y - n.r - u * 2.4, size: k === 0 ? 2.2 : 1.6, color: k === 0 ? P.accent : P.ink, opacity: 0 }) : null;
      });
      const order = nodes.map((n, k) => k).sort((a, b) => nodes[a].ring - nodes[b].ring || a - b);
      const when = new Map(order.map((k, i) => [k, 0.2 + i / order.length * p.growSec]));
      return {
        render(lt, b, t) {
          nodes.forEach((n, k) => { R.draw(nEls[k], lt, { start: when.get(k), dur: 0.3, t }); if (tEls[k]) tEls[k].setAttribute("opacity", prog(lt, when.get(k) + 0.2, 0.3)); });
          edges.forEach((e, k) => R.draw(eEls[k], lt, { start: Math.max(when.get(e.a), when.get(e.b)) - 0.1, dur: 0.35, t }));
          const z = 1 + lt * 0.008; g.setAttribute("transform", `translate(${cx} ${cy}) scale(${z}) translate(${-cx} ${-cy})`);
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ navegador */
  K.register({
    name: "rough.browser", tags: ["web", "navegador", "página", "internet", "sitio"], layer: "main",
    summary: "Ventana de navegador dibujada a mano: la dirección se escribe letra a letra en la barra, aparece la página (título + renglones) y un cursor hace clic en un enlace lima en `clickAt`.",
    example: { url: "info.cern.ch", title: "World Wide Web", link: "¿qué es esto?", clickAt: 3 },
    params: {
      url: { type: "string", default: "info.cern.ch", doc: "Dirección (mono)." },
      title: { type: "string", default: "", doc: "Título grande de la página." },
      link: { type: "string", default: "", doc: "Texto del enlace (lima, subrayado)." },
      clickAt: { type: "number", default: -1, doc: "Segundo (local) del clic en el enlace (-1 = sin clic; admite \"@palabra\")." },
      caption: { type: "string", default: "", doc: "Nota manuscrita debajo." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { u, cx, portrait } = ctx.stage, bx = R.boxIn(ctx, 0.92, portrait ? 0.8 : 1.45);
      const top = bx.y + u * 7;
      const frame = R.shape(ctx, g, (G, o) => [G.rectangle(bx.x, bx.y, bx.w, bx.h, o), G.line(bx.x, top, bx.x + bx.w, top, { ...o, seed: 3 }),
        ...[0, 1, 2].map(k => G.circle(bx.x + u * (3 + k * 3.2), bx.y + u * 3.5, u * 1.8, { ...o, seed: 5 + k })),
        G.rectangle(bx.x + u * 13, bx.y + u * 1.6, bx.w - u * 16, u * 4, { ...o, seed: 9 })], { width: 1.3, seed: 1300 });
      const url = R.mono(ctx, g, "", { x: bx.x + u * 15, y: bx.y + u * 3.6, size: 1.8, anchor: "start", color: P.ink });
      const tt = p.title ? R.text(ctx, g, p.title, { x: bx.x + u * 5, y: top + u * 9, size: Math.min(4.6, bx.w / u / Math.max(8, p.title.length) * 1.7), weight: 900, anchor: "start", opacity: 0 }) : null;
      const rows = Array.from({ length: 5 }, (_, k) => R.shape(ctx, g, (G, o) => [G.line(bx.x + u * 5, top + u * (16 + k * 5), bx.x + u * 5 + (bx.w - u * 10) * (k === 4 ? 0.55 : 0.9), top + u * (16 + k * 5), { ...o, roughness: 1.3 })], { color: P.muted, width: 0.9, seed: 1320 + k }));
      const ly = top + u * 44;
      const link = p.link ? R.text(ctx, g, p.link, { x: bx.x + u * 5, y: ly, size: 2.6, weight: 700, anchor: "start", color: P.accent, opacity: 0 }) : null;
      const lw = p.link ? R.measure(p.link, `700 ${u * 2.6}px Inter`) : 0;
      const under = p.link ? R.shape(ctx, g, (G, o) => [G.line(bx.x + u * 5, ly + u * 2, bx.x + u * 5 + lw, ly + u * 2, o)], { color: P.accent, width: 1.2, seed: 1340 }) : [];
      const cur = R.svg("g", null, g), curEls = R.sketch(ctx, cur, "cursor", { x: -u * 3, y: -u * 1, w: u * 8, h: u * 8 }, { width: 1.2, seed: 1350 });
      const cap = p.caption ? R.hand(ctx, g, "", { x: cx, y: bx.y + bx.h + u * 5, size: 4.4, color: P.accent }) : null;
      return {
        render(lt, b, t) {
          R.draw(frame, lt, { start: 0, dur: 0.7, t });
          R.type(url, p.url, prog(lt, 0.6, Math.min(1.2, p.url.length * 0.07), "linear"));
          const shown = 0.8 + Math.min(1.2, p.url.length * 0.07);
          if (tt) tt.setAttribute("opacity", prog(lt, shown, 0.4));
          rows.forEach((r, k) => R.draw(r, lt, { start: shown + 0.2 + k * 0.1, dur: 0.3, t }));
          if (link) { link.setAttribute("opacity", prog(lt, shown + 0.6, 0.3)); R.draw(under, lt, { start: shown + 0.8, dur: 0.3, t }); }
          const ck = p.clickAt > 0 ? p.clickAt : shown + 1.6, q = prog(lt, ck - 1, 1, "inOut");
          const x = lerp(bx.x + bx.w * 0.8, bx.x + u * 5 + lw * 0.6, q), y = lerp(bx.y + bx.h * 0.9, ly + u * 1, q), press = lt > ck && lt < ck + 0.25 ? 0.85 : 1;
          cur.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${press})`);
          R.draw(curEls, lt, { start: shown + 0.4, dur: 0.3, t });
          if (link && lt > ck) link.setAttribute("opacity", Math.floor((lt - ck) * 6) % 2 === 0 && lt - ck < 0.6 ? 0.4 : 1);
          if (cap) R.type(cap, p.caption, prog(lt, ck + 0.3, 0.6, "linear"));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ contador grande */
  K.register({
    name: "rough.counter", tags: ["número", "cifra", "escala", "crecimiento", "impacto"], layer: "main",
    summary: "Cifra GIGANTE que cuenta de `from` a `to` (con separador de miles) y queda subrayada a mano; etiqueta lima arriba y unidad manuscrita abajo. Para cifras de escala: usuarios, sitios, años, dinero.",
    example: { from: 0, to: 6000000000, label: "PERSONAS EN INTERNET", unit: "y contando…", dur: 2.5 },
    params: {
      from: { type: "number", default: 0, doc: "Valor inicial." },
      to: { type: "number", default: 100, doc: "Valor final." },
      dur: { type: "number", default: 2.2, doc: "Segundos de conteo (admite \"@palabra\")." },
      label: { type: "string", default: "", doc: "Etiqueta lima arriba." },
      unit: { type: "string", default: "", doc: "Unidad / comentario manuscrito abajo." },
      prefix: { type: "string", default: "", doc: "Prefijo (p. ej. '$')." },
      suffix: { type: "string", default: "", doc: "Sufijo (p. ej. '%')." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx), { W, u, cx, cy, portrait } = ctx.stage;
      const fmt = v => p.prefix + Math.round(v).toLocaleString("es-ES").replace(/ |,/g, ".") + p.suffix;
      const final = fmt(p.to), fs = Math.min(W * 0.86 / Math.max(3, R.measure(final, "900 100px Inter") / 100), ctx.stage.H * (portrait ? 0.12 : 0.24));
      const num = R.text(ctx, g, fmt(p.from), { x: cx, y: cy, size: fs / u, weight: 900, color: P.ink });
      const w = R.measure(final, `900 ${fs}px Inter`);
      const under = R.shape(ctx, g, (G, o) => [G.curve([[cx - w / 2, cy + fs * 0.62], [cx, cy + fs * 0.55], [cx + w / 2, cy + fs * 0.66]], o)], { color: P.accent, width: 1.8, seed: 1400 });
      const lab = p.label ? R.label(ctx, g, p.label, { x: cx, y: cy - fs * 0.85 - u * 3 }) : null;
      const un = p.unit ? R.hand(ctx, g, "", { x: cx, y: cy + fs * 0.62 + u * 6.5, size: portrait ? 5 : 4.4, color: P.accent }) : null;
      return {
        render(lt, b, t) {
          const q = prog(lt, 0.3, p.dur, "out"), v = lerp(p.from, p.to, q);
          const s = fmt(v); if (num.textContent !== s) num.textContent = s;
          num.setAttribute("fill", q >= 1 ? P.ink : P.muted);
          R.draw(under, lt, { start: 0.3 + p.dur, dur: 0.5, t });
          if (lab) lab.setAttribute("opacity", prog(lt, 0, 0.3));
          if (un) R.type(un, p.unit, prog(lt, 0.5 + p.dur, 0.6, "linear"));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

/* =============================================================================
   binary · extra — binary.banknote escrito por DeepSeek V4.1 Flash (prompt v5, sin
   retoques de código) y revisado en la galería: 16:9 billete apaisado; 9:16 apilado.
   ========================================================================== */
/* generado por deepseek-flash · prompt prompts/component-author.md · v5-fix2 — revisar antes de usar */
(function () {
  const K = Kit, B = Kit.binary, { clamp, prog } = K;
  K.register({
    name: "binary.banknote",
    tags: ["billete", "dinero", "retrato", "historia"],
    layer: "main",
    summary: "Un billete hecho de glifos 0/1: marco doble, medallón ovalado con un retrato muestreado y el valor grande a la izquierda. Sirve para el momento en que un personaje 'termina en un billete'.",
    example: { src: "assets/media/turing.jpg", value: "50", currency: "£", caption: "BILLETE DE 50 LIBRAS · 2021", morph: 1.0 },
    params: {
      src: { type: "image", default: "", doc: "Retrato que va dentro del medallón ovalado." },
      value: { type: "string", default: "50", doc: "Valor grande, hecho de glifos." },
      currency: { type: "string", default: "£", doc: "Símbolo de la moneda, texto nítido junto al valor." },
      caption: { type: "string", default: "", doc: "Línea mono debajo del billete." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado de la forma." },
    },

    // En 9:16 el billete apaisado se vería como una tirita. Preferimos mantenerlo
    // APILADO: valor arriba, medallón abajo, con el marco apaisado pero más alto
    // (proporción ~1.15 en vez de ~2.2). Así el retrato queda grande y legible
    // sin girar nada. En 16:9 va apaisado clásico (proporción ~2.1).
    points(ctx, p) {
      const portrait = ctx.stage.portrait;
      const ar = portrait ? 1.15 : 2.1;
      const bx = B.boxIn(ctx, portrait ? 0.86 : 0.78, ar);
      const cell = B.cellOf(ctx, portrait ? 0.85 : 0.9);
      const parts = [];

      // --- marco doble (rectángulo exterior + interior) ---
      const frame = B.sampleShape((g, w, h) => {
        g.fillStyle = "#fff";
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = "destination-out";
        const t = Math.max(2, h * 0.035);
        g.fillRect(t, t, w - 2 * t, h - 2 * t);
        const t2 = Math.max(1, h * 0.018);
        g.fillRect(t * 2.2, t * 2.2, w - 4.4 * t, h - 4.4 * t);
        g.fillRect(t * 2.2 + t2, t * 2.2 + t2, w - 4.4 * t - 2 * t2, h - 4.4 * t - 2 * t2);
      }, bx, { cell, edge: true, seed: 11 });
      parts.push(...frame);

      // --- medallón ovalado (a la derecha en 16:9, abajo en 9:16) ---
      const medW = portrait ? bx.w * 0.62 : bx.w * 0.34;
      const medH = portrait ? bx.h * 0.46 : bx.h * 0.72;
      const medX = portrait ? bx.x + (bx.w - medW) / 2 : bx.x + bx.w - medW - bx.w * 0.06;
      const medY = portrait ? bx.y + bx.h - medH - bx.h * 0.10 : bx.y + (bx.h - medH) / 2;
      const medBox = { x: medX, y: medY, w: medW, h: medH };

      // anillo del medallón (silueta de un óvalo hueco)
      const ring = B.sampleShape((g, w, h) => {
        g.fillStyle = "#fff";
        g.beginPath();
        g.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        g.fill();
        g.globalCompositeOperation = "destination-out";
        const t = Math.max(2, h * 0.05);
        g.beginPath();
        g.ellipse(w / 2, h / 2, w / 2 - t, h / 2 - t, 0, 0, Math.PI * 2);
        g.fill();
      }, medBox, { cell, edge: true, seed: 22 });
      parts.push(...ring);

      // --- retrato dentro del medallón ---
      const img = p.src ? ctx.img(p.src) : null;
      if (img) {
        const inner = {
          x: medBox.x + medBox.w * 0.10,
          y: medBox.y + medBox.h * 0.10,
          w: medBox.w * 0.80,
          h: medBox.h * 0.80,
        };
        const face = B.sampleImage(img, inner, {
          cell: B.cellOf(ctx, portrait ? 0.75 : 0.8),
          contrast: 1.3,
          threshold: 0.08,
        });
        // recortar a la elipse del medallón
        const ecx = medBox.x + medBox.w / 2, ecy = medBox.y + medBox.h / 2;
        const rx = medBox.w * 0.40, ry = medBox.h * 0.40;
        for (const q of face) {
          const dx = (q.x - ecx) / rx, dy = (q.y - ecy) / ry;
          if (dx * dx + dy * dy <= 1) parts.push(q);
        }
      }

      // --- valor grande a la izquierda (o arriba en 9:16) ---
      const valBox = portrait
        ? { x: bx.x + bx.w * 0.10, y: bx.y + bx.h * 0.10, w: bx.w * 0.80, h: bx.h * 0.34 }
        : { x: bx.x + bx.w * 0.08, y: bx.y + bx.h * 0.18, w: bx.w * 0.46, h: bx.h * 0.64 };
      const val = B.sampleText(String(p.value), valBox, {
        font: "900 100px 'Inter', sans-serif",
        cell: B.cellOf(ctx, portrait ? 0.9 : 1.0),
        fit: "lines",
      });
      parts.push(...val);

      return B.pack(parts, ctx.family.binary.N);
    },

    motion: lt => ({ s: 1 + lt * 0.006 }),

    reveal: (lt, b, p) => clamp(lt / Math.max(0.4, p.morph ?? 1)),

    create(ctx, p) {
      const P = ctx.C.palette;
      const G = ctx.g.top;
      const { u, portrait } = ctx.stage;
      const c = ctx.stage.content;

      // caja del billete (misma fórmula que en points)
      const ar = portrait ? 1.15 : 2.1;
      const bx = B.boxIn(ctx, portrait ? 0.86 : 0.78, ar);

      // posición del símbolo de moneda: junto al valor, arriba-izq del billete
      const curX = bx.x + bx.w * (portrait ? 0.10 : 0.08);
      const curY = bx.y + bx.h * (portrait ? 0.10 : 0.20);

      // caption debajo del billete
      const capY = Math.min(bx.y + bx.h + u * 4, c.y + c.h - u * 2);

      return {
        render(lt, b, t) {
          const a = B.fadeIO(lt, b.dur, 0.5, 0.4, (p.morph ?? 1) * 0.5);

          // símbolo de moneda nítido, chico, junto al valor
          if (p.currency) {
            B.mono(G, String(p.currency), curX, curY, {
              u, size: portrait ? 3.2 : 3.6, weight: 700,
              color: P.ink, alpha: a, align: "left",
            });
          }

          // caption mono debajo
          if (p.caption) {
            B.mono(G, String(p.caption), c.x + c.w / 2, capY, {
              u, size: 1.6, color: P.muted, alpha: a * 0.9, align: "center",
            });
          }
        },
        dispose() {},
      };
    },
  });
})();

/* =============================================================================
   binary · extra (videos) — binary.wall + iconos de "La noche que cayó el Muro"
   ========================================================================== */
(function () {
  const K = Kit, B = Kit.binary, { clamp, lerp, prog, ease } = K;
  Object.assign(B.ICONS, {
    microphone: "M50 6c8 0 13 5 13 13v26c0 8-5 13-13 13s-13-5-13-13V19c0-8 5-13 13-13Z M26 42h6c0 11 8 19 18 19s18-8 18-19h6c0 13-9 23-21 25v14h14v6H33v-6h14V67C35 65 26 55 26 42Z",
    document: "M22 6h40l18 18v70H22Z M62 8v16h16Z M30 34h40v4H30Z M30 46h40v4H30Z M30 58h40v4H30Z M30 70h28v4H30Z",
    tv: "M8 24h84v58H8Z M16 32v42h68V32Z M30 86h40v6H30Z M34 6h6l10 14 10-14h6L54 24h-8Z",
    barrier: "M10 36h12v58H10Z M22 42h72v12H22Z M36 42h8v12h-8Z M56 42h8v12h-8Z M76 42h8v12h-8Z",
    hammer: "M14 14h44v20H14Z M58 18h14v12H58Z M30 34h12v60H30Z",
    /* agua / mar (OJO: "waves" es de ondas de RADIO, no de agua) */
    water: "M4 40c8-8 16-8 24 0s16 8 24 0 16-8 24 0 16 8 20 4v12c-4 4-12 4-20-4s-16-8-24 0-16 8-24 0-16-8-24 0Z M4 64c8-8 16-8 24 0s16 8 24 0 16-8 24 0 16 8 20 4v12c-4 4-12 4-20-4s-16-8-24 0-16 8-24 0-16-8-24 0Z",
  });

  B.ICONS.radio = B.ICONS.waves;          /* alias con nombre claro: antena con ondas de radio */

  /** ladrillos dentro de la caja: [{x,y,w,h,row,col}] (filas desde abajo) */
  function bricks(bx, rows) {
    const out = [], bh = bx.h / rows, bw = bh * 2.1, gap = Math.max(1.5, bh * 0.12);
    for (let r = 0; r < rows; r++) {
      const y = bx.y + bx.h - (r + 1) * bh, off = r % 2 ? bw / 2 : 0;
      for (let x = bx.x - off, c = 0; x < bx.x + bx.w; x += bw, c++) {
        const x0 = Math.max(bx.x, x), x1 = Math.min(bx.x + bx.w, x + bw);
        if (x1 - x0 > bw * 0.25) out.push({ x: x0 + gap / 2, y: y + gap / 2, w: x1 - x0 - gap, h: bh - gap, row: r, col: c });
      }
    }
    return out;
  }
  const wallBox = ctx => { const c = ctx.stage.content, h = c.h * (ctx.stage.portrait ? 0.5 : 0.52); return { x: c.x, y: ctx.stage.cy - h / 2 + c.h * 0.04, w: c.w, h }; };
  /* la brecha: un hueco irregular en el centro (el muro "cae" por ahí) */
  const inBreach = (bx, b) => { const cxr = (b.x + b.w / 2 - bx.x) / bx.w, top = (bx.y + bx.h - b.y - b.h / 2) / bx.h; return Math.abs(cxr - 0.5) < 0.17 + 0.1 * top; };

  K.register({
    name: "binary.wall", tags: ["muro", "frontera", "división", "caída", "construcción"], layer: "main",
    summary: "Muro de ladrillos hechos de glifos con alambre arriba. mode=build lo levanta fila por fila; stand lo muestra quieto (división, encierro); break abre una brecha en el centro en `breakAt` y los fragmentos caen.",
    example: { mode: "break", label: "28 AÑOS", breakAt: 2.2 },
    params: {
      mode: { type: "enum", options: ["build", "stand", "break"], default: "stand", doc: "build = se levanta, stand = quieto, break = se rompe en el centro." },
      rows: { type: "number", default: 7, min: 4, max: 14, doc: "Filas de ladrillos." },
      buildSec: { type: "number", default: 2.4, doc: "Segundos para levantarlo (mode=build)." },
      breakAt: { type: "number", default: 2, doc: "Segundo (local) en que se rompe (mode=break; admite \"@palabra\")." },
      label: { type: "string", default: "", doc: "Etiqueta blanca arriba." },
      sub: { type: "string", default: "", doc: "Línea mono debajo." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const bx = wallBox(ctx), cell = B.cellOf(ctx, 0.62), out = [], r = K.rng(1961);
      for (const b of bricks(bx, p.rows)) {
        const br = p.mode === "break" && inBreach(bx, b);
        for (let y = b.y + cell * 0.5; y < b.y + b.h; y += cell) for (let x = b.x + cell * 0.31; x < b.x + b.w; x += cell * 0.62) {
          const edge = y - b.y < cell || b.y + b.h - y < cell || x - b.x < cell * 0.6 || b.x + b.w - x < cell * 0.6;
          out.push({ x, y, a: edge ? 0.95 : 0.35 + 0.25 * r(), s: edge ? 1 : 0, g: r() < .5 ? 0 : 1, o: b.row / p.rows, grp: br ? 1 : 0 });
        }
      }
      /* alambre de púas: una línea de "·" con cruces */
      for (let x = bx.x; x <= bx.x + bx.w; x += cell * 0.6) {
        const y = bx.y - cell * 1.6 + Math.sin(x * 0.05) * cell * 0.3;
        out.push({ x, y, a: 0.7, s: 0, g: 2, o: 1, grp: p.mode === "break" && Math.abs((x - bx.x) / bx.w - 0.5) < 0.27 ? 1 : 0 });
        if (Math.round(x / cell) % 6 === 0) out.push({ x, y: y - cell * 0.5, a: 0.8, s: 0, g: 1, o: 1, grp: 0 });
      }
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: (lt, b, p) => (p && p.mode === "build" ? clamp(lt / (p.buildSec || 2.4)) + 1e-6 : 2),
    groupAlpha: (lt, b, p) => (p && p.mode === "break" ? [1, 1 - prog(lt, p.breakAt, 0.35)] : null),
    motion: lt => ({ s: 1 + lt * 0.006 }),
    create(ctx, p) {
      const C = ctx.C.palette, bx = wallBox(ctx), cell = B.cellOf(ctx, 0.62), r = K.rng(1989);
      /* fragmentos que caen al romperse: puntos de la brecha con velocidad propia */
      const frags = [];
      if (p.mode === "break") for (const b of bricks(bx, p.rows)) if (inBreach(bx, b))
        for (let k = 0; k < 6; k++) frags.push({ x: b.x + r() * b.w, y: b.y + r() * b.h, vx: (r() - 0.5) * ctx.stage.u * 30, vy: -r() * ctx.stage.u * 18, g: r() < .5 ? 0 : 1, s: r() < 0.3 ? 1 : 0 });
      return { render(lt, b) {
        const { u, cx, H } = ctx.stage, G = ctx.g.top, a = B.fadeIO(lt, b.dur, 0.6, 0.45, (p.morph ?? 1) * 0.5);
        if (p.label) B.tag(G, p.label, cx, bx.y - u * 7, { u, size: 1.7, alpha: a, bg: C.ink, color: C.bg });
        if (p.sub) B.mono(G, p.sub, cx, bx.y + bx.h + u * 4, { u, size: 1.5, alpha: a * 0.85, color: C.ink, spacing: u * 0.25 });
        if (p.mode === "break" && lt > p.breakAt) {
          const dt = lt - p.breakAt, g = u * 160, list = [];
          for (const f of frags) { const y = f.y + f.vy * dt + 0.5 * g * dt * dt; if (y < H + u * 5) list.push({ x: f.x + f.vx * dt, y, a: clamp(1 - dt / 1.6), g: f.g, s: f.s }); }
          B.drawPts(G, list, 0, 0, { alpha: a }, ctx);
        }
      } };
    },
  });
})();

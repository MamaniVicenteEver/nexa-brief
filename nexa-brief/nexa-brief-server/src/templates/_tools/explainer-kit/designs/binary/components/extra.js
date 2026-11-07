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
/* =============================================================================
   binary · ajedrez — tablero de partida, pieza protagonista y árbol de búsqueda.
   Dibujos conceptuales en blanco/negro; las jugadas se expresan en coordenadas UCI.
   ========================================================================== */
(function () {
  const K = Kit, B = Kit.binary, { clamp, lerp, prog } = K;
  const MONO = "'JetBrains Mono', monospace";
  const STANDARD = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function squareIndex(s) { return [8 - Number(s[1]), s.charCodeAt(0) - 97]; }
  function parseFen(fen) {
    const [placement, turn = "w"] = String(fen || STANDARD).split(/\s+/), rows = placement.split("/");
    const board = rows.flatMap(row => [...row].flatMap(ch => /[1-8]/.test(ch) ? Array(+ch).fill("") : [ch]));
    return { board: board.length === 64 ? board : parseFen(STANDARD).board.slice(), turn };
  }
  function applyMove(board, uci) {
    const m = String(uci || "").toLowerCase().match(/^([a-h][1-8])([a-h][1-8])([nbrq])?$/);
    if (!m) return board.slice();
    const [r1, c1] = squareIndex(m[1]), [r2, c2] = squareIndex(m[2]), next = board.slice(), from = r1 * 8 + c1, to = r2 * 8 + c2, piece = next[from];
    if (!piece) return next;
    next[from] = "";
    if (piece.toLowerCase() === "p" && c1 !== c2 && !next[to]) next[r1 * 8 + c2] = "";
    next[to] = m[3] ? (piece === piece.toUpperCase() ? m[3].toUpperCase() : m[3]) : piece;
    if (piece.toLowerCase() === "k" && Math.abs(c2 - c1) === 2) {
      const rf = c2 > c1 ? r1 * 8 + 7 : r1 * 8, rt = c2 > c1 ? r1 * 8 + 5 : r1 * 8 + 3;
      next[rt] = next[rf]; next[rf] = "";
    }
    return next;
  }
  function piecePath(G, kind) {
    G.beginPath();
    if (kind === "pawn") {
      G.moveTo(.22,.86); G.lineTo(.78,.86); G.lineTo(.72,.78); G.lineTo(.61,.75); G.lineTo(.58,.64); G.lineTo(.66,.53); G.lineTo(.62,.43); G.lineTo(.55,.37); G.lineTo(.56,.31); G.bezierCurveTo(.56,.21,.44,.21,.44,.31); G.lineTo(.45,.37); G.lineTo(.38,.43); G.lineTo(.34,.53); G.lineTo(.42,.64); G.lineTo(.39,.75); G.lineTo(.28,.78); G.closePath();
    } else if (kind === "knight") {
      // Caballo de perfil mirando a la izquierda: orejas, hocico, crin y pedestal Staunton.
      G.moveTo(.05,.94); G.lineTo(.95,.94); G.lineTo(.95,.89);
      G.quadraticCurveTo(.94,.86,.87,.84); G.lineTo(.69,.82); G.lineTo(.68,.79);
      G.quadraticCurveTo(.76,.76,.78,.69); G.quadraticCurveTo(.82,.61,.79,.52);
      G.quadraticCurveTo(.77,.42,.70,.34);
      // Crin escalonada que recorre la nuca y cae sobre el cuello.
      G.lineTo(.77,.32); G.lineTo(.68,.28); G.lineTo(.75,.27); G.lineTo(.67,.22);
      G.lineTo(.74,.20); G.lineTo(.64,.15); G.lineTo(.60,.18); G.lineTo(.59,.08);
      G.lineTo(.54,.04); G.lineTo(.50,.15); G.quadraticCurveTo(.48,.10,.44,.06);
      G.lineTo(.40,.12); G.lineTo(.39,.21);
      // Frente, perfil largo, belfo y mandíbula del caballo.
      G.quadraticCurveTo(.32,.25,.27,.33); G.lineTo(.09,.48);
      G.quadraticCurveTo(.04,.52,.08,.57); G.lineTo(.12,.60);
      G.quadraticCurveTo(.15,.63,.21,.60); G.lineTo(.31,.54);
      G.quadraticCurveTo(.37,.52,.42,.53); G.quadraticCurveTo(.46,.55,.44,.60);
      // Garganta y pecho se unen al cuello de la pieza.
      G.quadraticCurveTo(.41,.66,.36,.71); G.quadraticCurveTo(.31,.76,.33,.80);
      G.lineTo(.20,.82); G.quadraticCurveTo(.12,.84,.07,.87); G.lineTo(.05,.90); G.closePath();
    } else if (kind === "rook") {
      G.moveTo(.18,.86); G.lineTo(.82,.86); G.lineTo(.77,.77); G.lineTo(.67,.74); G.lineTo(.67,.38); G.lineTo(.75,.34); G.lineTo(.75,.20); G.lineTo(.63,.20); G.lineTo(.63,.29); G.lineTo(.55,.29); G.lineTo(.55,.18); G.lineTo(.45,.18); G.lineTo(.45,.29); G.lineTo(.37,.29); G.lineTo(.37,.20); G.lineTo(.25,.20); G.lineTo(.25,.34); G.lineTo(.33,.38); G.lineTo(.33,.74); G.lineTo(.23,.77); G.closePath();
    } else if (kind === "bishop") {
      G.moveTo(.18,.86); G.lineTo(.82,.86); G.lineTo(.76,.77); G.lineTo(.62,.73); G.lineTo(.59,.62); G.lineTo(.66,.50); G.lineTo(.60,.39); G.lineTo(.56,.31); G.lineTo(.60,.24); G.lineTo(.50,.14); G.lineTo(.40,.24); G.lineTo(.44,.31); G.lineTo(.40,.39); G.lineTo(.34,.50); G.lineTo(.41,.62); G.lineTo(.38,.73); G.lineTo(.24,.77); G.closePath();
    } else if (kind === "queen") {
      G.moveTo(.16,.86); G.lineTo(.84,.86); G.lineTo(.78,.77); G.lineTo(.65,.74); G.lineTo(.61,.48); G.lineTo(.73,.30); G.lineTo(.61,.38); G.lineTo(.50,.20); G.lineTo(.39,.38); G.lineTo(.27,.30); G.lineTo(.39,.48); G.lineTo(.35,.74); G.lineTo(.22,.77); G.closePath();
    } else {
      G.moveTo(.17,.86); G.lineTo(.83,.86); G.lineTo(.77,.77); G.lineTo(.64,.74); G.lineTo(.61,.48); G.lineTo(.56,.40); G.lineTo(.56,.27); G.lineTo(.68,.27); G.lineTo(.68,.20); G.lineTo(.56,.20); G.lineTo(.56,.09); G.lineTo(.44,.09); G.lineTo(.44,.20); G.lineTo(.32,.20); G.lineTo(.32,.27); G.lineTo(.44,.27); G.lineTo(.44,.40); G.lineTo(.39,.48); G.lineTo(.36,.74); G.lineTo(.23,.77); G.closePath();
    }
  }
  function drawPiece(G, kind, side, x, y, s, P, alpha = 1, wide = 1) {
    G.save(); G.translate(x - s * wide / 2, y - s / 2); G.scale(s * wide, s); G.globalAlpha *= alpha;
    piecePath(G, kind); G.fillStyle = side === "white" ? P.ink : P.bg; G.strokeStyle = P.ink; G.lineWidth = .024; G.lineJoin = "round";
    G.fill(); G.stroke();
    if (kind === "knight") {
      const cut = side === "white" ? P.bg : P.ink;
      // Ojo grande, ceja y curva de la mejilla para conservar el perfil equino.
      G.beginPath(); G.ellipse(.397,.292,.031,.019,-.24,0,Math.PI*2); G.fillStyle = cut; G.fill();
      G.beginPath(); G.arc(.402,.292,.009,0,Math.PI*2); G.fillStyle = side === "white" ? P.ink : P.bg; G.fill();
      G.lineWidth = .009; G.beginPath(); G.moveTo(.363,.270); G.quadraticCurveTo(.399,.245,.431,.266); G.strokeStyle = cut; G.stroke();
      G.lineWidth = .013; G.beginPath(); G.moveTo(.425,.315); G.quadraticCurveTo(.465,.375,.443,.429); G.quadraticCurveTo(.425,.464,.389,.484); G.stroke();
      // Pliegues interiores de las dos orejas.
      G.lineWidth = .009; G.beginPath(); G.moveTo(.425,.105); G.lineTo(.447,.158); G.moveTo(.555,.087); G.lineTo(.548,.151); G.stroke();
      // Brida: testera, muserola, carrillera y anilla del bocado.
      G.strokeStyle = cut; G.lineCap = "round"; G.lineJoin = "round";
      G.lineWidth = .012; G.beginPath(); G.moveTo(.43,.255); G.quadraticCurveTo(.38,.355,.28,.438); G.lineTo(.12,.535); G.stroke();
      G.beginPath(); G.moveTo(.31,.405); G.quadraticCurveTo(.25,.475,.20,.535); G.quadraticCurveTo(.16,.56,.10,.548); G.stroke();
      G.beginPath(); G.moveTo(.29,.455); G.quadraticCurveTo(.25,.50,.22,.575); G.stroke();
      G.beginPath(); G.arc(.105,.548,.026,0,Math.PI*2); G.lineWidth = .009; G.stroke();
      // Orificio nasal y pequeño corte de la boca.
      G.beginPath(); G.ellipse(.155,.505,.016,.009,-.48,0,Math.PI*2); G.fillStyle = cut; G.fill();
      G.beginPath(); G.moveTo(.085,.578); G.quadraticCurveTo(.14,.592,.185,.581); G.lineWidth = .008; G.stroke();
      // Mechones claros en la crin y línea interior del cuello.
      G.beginPath(); G.moveTo(.635,.205); G.quadraticCurveTo(.715,.30,.745,.405); G.lineTo(.70,.39);
      G.moveTo(.68,.245); G.quadraticCurveTo(.755,.36,.765,.48); G.lineTo(.72,.45);
      G.moveTo(.70,.315); G.quadraticCurveTo(.78,.44,.775,.56); G.lineTo(.735,.535);
      G.moveTo(.72,.585); G.quadraticCurveTo(.69,.66,.64,.718); G.stroke();
      G.lineWidth = .009; G.beginPath(); G.moveTo(.48,.625); G.quadraticCurveTo(.47,.70,.53,.765); G.stroke();
      // Pedestal ancho y filetes dobles, como la referencia.
      G.lineWidth = .012; G.beginPath(); G.moveTo(.075,.895); G.quadraticCurveTo(.50,.908,.925,.895); G.stroke();
      G.beginPath(); G.moveTo(.13,.858); G.quadraticCurveTo(.50,.872,.87,.858); G.stroke();
      G.beginPath(); G.moveTo(.20,.825); G.quadraticCurveTo(.49,.838,.69,.824); G.stroke();
    } else if (kind === "bishop") {
      G.beginPath(); G.moveTo(.45,.30); G.lineTo(.55,.24); G.strokeStyle = side === "white" ? P.bg : P.ink; G.lineWidth = .022; G.stroke();
    }
    G.restore();
  }
  function kindOf(ch) { return ({ p:"pawn", n:"knight", b:"bishop", r:"rook", q:"queen", k:"king" })[String(ch).toLowerCase()] || "pawn"; }
  function boardLayout(ctx) {
    const { content:c, cx, u, portrait } = ctx.stage;
    const s = Math.min(c.w * (portrait ? .84 : .76), c.h * (portrait ? .70 : .78));
    const top = u * 4, foot = u * 8, y = c.y + (c.h - s - top - foot) / 2 + top;
    return { x:cx-s/2, y, s, sq:s/8, u, cx, content:c };
  }
  function boardPoints(ctx) {
    const L = boardLayout(ctx);
    return B.sampleShape((g,w,h) => {
      g.fillStyle="#fff";
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) if ((r+c)%2===0) g.fillRect(c*w/8,r*h/8,w/8,h/8);
      g.lineWidth=Math.max(2,w*.004); g.strokeRect(0,0,w,h);
      for (let i=1;i<8;i++) { g.beginPath(); g.moveTo(i*w/8,0); g.lineTo(i*w/8,h); g.moveTo(0,i*h/8); g.lineTo(w,i*h/8); g.stroke(); }
    }, {x:L.x,y:L.y,w:L.s,h:L.s}, {cell:B.cellOf(ctx,.9),edge:true,seed:907});
  }
  function moveSchedule(ctx,p) {
    const raw = Array.isArray(p.moves) ? p.moves : String(p.moves || "").split(/[ ,]+/).filter(Boolean), labels = Array.isArray(p.notation) ? p.notation : [];
    let board = parseFen(p.fen).board, active = null, shown = -1;
    const gap = Math.max(.35, +p.moveSec || 1.15), anim = Math.min(gap, Math.max(.3, +p.animSec || .78)), delay = Math.max(0, +p.delay || 0);
    for (let i=0;i<raw.length;i++) {
      const start=delay+i*gap, end=start+anim;
      if (p._lt < start) break;
      if (p._lt < end) { active={i,uci:raw[i],q:prog(p._lt,start,anim,"inOut"),before:board.slice()}; shown=i; break; }
      board=applyMove(board,raw[i]); shown=i;
    }
    return {board,active,shown,labels};
  }
  function drawBoard(G, ctx, p, lt, b) {
    const P=ctx.C.palette,L=boardLayout(ctx),a=B.fadeIO(lt,b.dur,.35,.45,.15), sq=L.sq;
    G.save(); G.globalAlpha=a;
    for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
      const x=L.x+c*sq,y=L.y+r*sq, light=(r+c)%2===0;
      G.fillStyle=light?P.muted:P.ink; G.globalAlpha=a*(light?.16:.07); G.fillRect(x,y,sq,sq);
      G.strokeStyle=P.muted; G.globalAlpha=a*.44; G.lineWidth=Math.max(1,L.u*.09); G.strokeRect(x,y,sq,sq);
    }
    G.globalAlpha=a; G.strokeStyle=P.ink; G.lineWidth=Math.max(2,L.u*.18); G.strokeRect(L.x,L.y,L.s,L.s);
    G.font=`700 ${Math.max(11,L.u*1.6)}px ${MONO}`; G.textAlign="left"; G.textBaseline="top"; G.fillStyle=P.ink;
    for(let r=0;r<8;r++){G.globalAlpha=a*.55;G.fillText(String(8-r),L.x+L.u*.38,L.y+r*sq+L.u*.35);}
    G.textAlign="right"; G.textBaseline="bottom";
    for(let c=0;c<8;c++){G.globalAlpha=a*.55;G.fillText("abcdefgh"[c],L.x+(c+1)*sq-L.u*.38,L.y+L.s-L.u*.3);}
    const focus=String(p.focus||"").toLowerCase();
    if(/^[a-h][1-8]$/.test(focus)){const [r,c]=squareIndex(focus);G.globalAlpha=a*.28;G.fillStyle=P.accent;G.fillRect(L.x+c*sq,L.y+r*sq,sq,sq);G.globalAlpha=a*.9;G.strokeStyle=P.accent;G.lineWidth=Math.max(2,L.u*.2);G.strokeRect(L.x+c*sq+L.u*.18,L.y+r*sq+L.u*.18,sq-L.u*.36,sq-L.u*.36);}
    const S=moveSchedule(ctx,{...p,_lt:lt}), st=S.board, m=S.active; let moving=null;
    if(m){G.globalAlpha=a;const mm=String(m.uci).slice(0,4);if(/^[a-h][1-8][a-h][1-8]$/.test(mm)){const [r1,c1]=squareIndex(mm.slice(0,2)),[r2,c2]=squareIndex(mm.slice(2,4)),x1=L.x+(c1+.5)*sq,y1=L.y+(r1+.5)*sq,x2=L.x+(c2+.5)*sq,y2=L.y+(r2+.5)*sq,old=m.before[r1*8+c1],lift=Math.sin(Math.PI*m.q)*sq*.42;G.globalAlpha=a*.4;G.strokeStyle=P.accent;G.lineWidth=Math.max(2,L.u*.18);G.setLineDash([L.u*.48,L.u*.34]);G.beginPath();G.moveTo(x1,y1);G.lineTo(x2,y2);G.stroke();G.setLineDash([]);G.globalAlpha=a*.25;G.fillStyle=P.accent;G.fillRect(L.x+c2*sq,L.y+r2*sq,sq,sq);st[r1*8+c1]="";if(old)moving={kind:kindOf(old),side:old===old.toUpperCase()?"white":"black",x:lerp(x1,x2,m.q),y:lerp(y1,y2,m.q)-lift};}}
    for(let i=0;i<64;i++){const pc=st[i];if(!pc)continue;const r=Math.floor(i/8),c=i%8;G.globalAlpha=a;drawPiece(G,kindOf(pc),pc===pc.toUpperCase()?"white":"black",L.x+(c+.5)*sq,L.y+(r+.5)*sq,sq*.82,P,1);}
    if(moving){G.globalAlpha=a;drawPiece(G,moving.kind,moving.side,moving.x,moving.y,sq*.80,P,1);}
    if(p.label)B.tag(G,p.label,L.cx,L.y-L.u*2.1,{u:L.u,size:1.6,alpha:a,bg:P.ink,color:P.bg});
    const noteY=L.y+L.s+L.u*6.6;
    const tag=(m?S.labels[m.i]:null) || (S.shown>=0?S.labels[S.shown]:null);
    if(tag)B.tag(G,tag,L.cx,L.y+L.s+L.u*2.4,{u:L.u,size:1.6,alpha:a,bg:P.ink,color:P.bg});
    if(p.note)B.mono(G,p.note,L.cx,noteY,{u:L.u,size:1.6,weight:700,color:P.ink,alpha:a*.8,spacing:L.u*.2});
    G.restore();
  }
  K.register({
    name:"binary.chessboard",tags:["ajedrez","tablero","partida","movimientos"],layer:"main",
    summary:"Diagrama de ajedrez con piezas vectoriales y jugadas UCI animadas; muestra aperturas y momentos concretos de una partida.",
    example:{fen:STANDARD,moves:["e2e4","c7c6","d2d4","d7d5"],notation:["1. e4","1... c6","2. d4","2... d5"],moveSec:1.1,label:"DEFENSA CARO-KANN",note:"DIAGRAMA DE APERTURA"},
    params:{fen:{type:"string",default:STANDARD,doc:"FEN inicial del tablero."},moves:{type:"array",default:[],doc:"Lista de jugadas UCI, como e2e4 o g5e6."},notation:{type:"array",default:[],doc:"Rótulo opcional por jugada, por ejemplo 8. Nxe6."},moveSec:{type:"number",default:1.15,min:.35,max:4,doc:"Intervalo entre comienzos de jugadas."},animSec:{type:"number",default:.78,min:.3,max:3,doc:"Duración del desplazamiento de cada pieza."},delay:{type:"number",default:.4,min:0,max:5,doc:"Espera antes de la primera jugada."},focus:{type:"string",default:"",doc:"Casilla para enmarcar, por ejemplo b5."},label:{type:"string",default:"",doc:"Etiqueta sobre el tablero."},note:{type:"string",default:"",doc:"Nota debajo del tablero."},morph:{type:"number",default:1,doc:"Segundos para armar la trama binaria."}},
    points(ctx,p){return B.pack(boardPoints(ctx),ctx.family.binary.N);},
    reveal:(lt,b,p)=>clamp(lt/Math.max(.4,p.morph||1))+1e-6,
    create(ctx,p){const G=ctx.g.top;return{render(lt,b){drawBoard(G,ctx,p,lt,b);}};}
  });

  function horseImage(ctx,p) {
    const key = p.art === "referencia" ? "srcReference" : "srcVariable";
    return p.piece === "knight" && p[key] ? ctx.img(p[key]) : null;
  }
  function horseMetrics(ctx,img) {
    const {content:c,cx,cy,u,portrait}=ctx.stage, ar=img ? img.width/img.height : 1.3;
    const h=Math.min(c.h*(portrait?.70:.78),c.w*(portrait?.88:.92)/ar), w=h*ar;
    return {ar,h,w,x:cx-w/2,y:cy+u*2-h/2};
  }
  /* Renderiza los SVG fuente a una máscara y dibuja los dígitos desde Canvas.
     El SVG conserva la geometría; el 0/1 se genera aquí en código y se recorta
     por la luminosidad de la silueta, incluidas las caladuras y los bordes. */
  function binaryHorseTexture(img,w,h,color,dpr=1) {
    if(!img || !w || !h) return null;
    const ratio=Math.max(1,Math.min(2,+dpr||1)), W=Math.max(1,Math.round(w*ratio)), H=Math.max(1,Math.round(h*ratio));
    const mask=document.createElement("canvas"); mask.width=W; mask.height=H;
    const mg=mask.getContext("2d",{willReadFrequently:true}); mg.setTransform(ratio,0,0,ratio,0,0); mg.drawImage(img,0,0,w,h);
    const px=mg.getImageData(0,0,W,H), d=px.data;
    for(let i=0;i<d.length;i+=4){const lum=d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722, dark=clamp((240-lum)/230);d[i]=d[i+1]=d[i+2]=255;d[i+3]=Math.round(d[i+3]*dark);}
    mg.putImageData(px,0,0);
    const cv=document.createElement("canvas"); cv.width=W; cv.height=H;
    const g=cv.getContext("2d"); g.setTransform(ratio,0,0,ratio,0,0);
    const step=Math.max(6,Math.min(w,h)/29), fontSize=step*1.18;
    g.font=`700 ${fontSize}px ${MONO}`;g.textAlign="center";g.textBaseline="middle";g.fillStyle=color;
    let seed=0x4b41534;
    for(let row=0,y=step*.52;y<h+step;y+=step,row++){
      const offset=row%2?step*.42:0;
      for(let col=0,x=offset+step*.5;x<w+step;x+=step,col++){
        seed=(Math.imul(seed,1664525)+1013904223)>>>0;
        g.fillText((seed>>>31)?"1":"0",x,y);
      }
    }
    g.globalCompositeOperation="destination-in";g.drawImage(mask,0,0,w,h);g.globalCompositeOperation="source-over";
    return cv;
  }
  K.register({
    name:"binary.chesspiece",tags:["ajedrez","caballo","torre","pieza"],layer:"main",
    summary:"Pieza de ajedrez con siluetas SVG trazadas en dígitos 0/1 generados por Canvas; permite elegir entre los dos caballos de referencia.",
    example:{piece:"knight",side:"white",action:"threatened",art:"variable",label:"CABALLO BLANCO",note:"EL PEÓN h6 AMENAZA g5"},
    params:{piece:{type:"enum",options:["pawn","knight","bishop","rook","queen","king"],default:"knight",doc:"Tipo de pieza."},side:{type:"enum",options:["white","black"],default:"white",doc:"Color de la pieza."},action:{type:"enum",options:["idle","advance","threatened","sacrifice"],default:"idle",doc:"Tratamiento visual."},art:{type:"enum",options:["variable","referencia"],default:"variable",doc:"Silueta SVG fuente del caballo: versión detallada o trazado de referencia."},srcVariable:{type:"image",default:"",doc:"SVG del caballo detallado de 360 × 360."},srcReference:{type:"image",default:"",doc:"SVG del caballo de referencia de 687 × 1024."},label:{type:"string",default:"",doc:"Etiqueta superior."},note:{type:"string",default:"",doc:"Nota inferior."},morph:{type:"number",default:1,doc:"Segundos para armar la trama binaria."}},
    points(ctx,p){const c=ctx.stage.content,u=ctx.stage.u,img=horseImage(ctx,p);if(p.piece==="knight"&&img){const L=horseMetrics(ctx,img),box={x:ctx.stage.cx-L.w/2,y:ctx.stage.cy+u*2-L.h/2,w:L.w,h:L.h},pts=B.sampleImage(img,box,{cell:B.cellOf(ctx,.72),invert:true,autoLevels:false,keyBackground:false,vignette:false,threshold:.06,gamma:.9,seed:911});return B.pack(pts,ctx.family.binary.N);}const wide=p.piece==="knight"?1.3:1,h=Math.min(c.h*.72,c.w*.92/wide),box={x:ctx.stage.cx-h*wide/2,y:ctx.stage.cy+u*2-h/2,w:h*wide,h};return B.pack(B.sampleShape((g)=>{g.fillStyle="#fff";piecePath(g,p.piece);g.fill();},box,{cell:B.cellOf(ctx,.72),edge:true,seed:911}),ctx.family.binary.N);},
    reveal:(lt,b,p)=>clamp(lt/Math.max(.4,p.morph||1))+1e-6,
    create(ctx,p){const G=ctx.g.top,P=ctx.C.palette,img=horseImage(ctx,p),L=horseMetrics(ctx,img),binary=img?binaryHorseTexture(img,L.w,L.h,P.ink,ctx.dpr):null;return{render(lt,b){const {u,cx,cy,content:c}=ctx.stage,a=B.fadeIO(lt,b.dur,.35,.45,.15),wide=L.ar,S=L.h,bob=p.action==="advance"?Math.sin(lt*2.2)*u*.22:0,x=cx,y=cy+u*2+bob;G.save();if(!(p.piece==="knight"&&binary)){G.globalAlpha=a*.45;G.strokeStyle=P.muted;G.lineWidth=Math.max(1,u*.12);G.beginPath();G.ellipse(cx,y+S*.38,S*.3,S*.055,0,0,Math.PI*2);G.stroke();G.globalAlpha=a;G.strokeStyle=P.muted;G.lineWidth=Math.max(2,u*.18);G.beginPath();G.moveTo(cx-S*wide*.38,y+S*.4);G.lineTo(cx+S*wide*.38,y+S*.4);G.stroke();}G.globalAlpha=a;if(p.piece==="knight"&&binary)G.drawImage(binary,cx-L.w/2,y-S/2,L.w,S);else drawPiece(G,p.piece,p.side,cx,y,S,P,1,wide);if(p.action==="threatened"){const q=.62+.12*Math.sin(lt*3);G.globalAlpha=a*.65;G.strokeStyle=P.ink;G.lineWidth=Math.max(2,u*.2);G.setLineDash([u*.7,u*.42]);G.beginPath();G.moveTo(cx+S*wide*.36,y-S*.28);G.quadraticCurveTo(cx+S*wide*.48,y-S*.02,cx+S*wide*.27,y+S*.02);G.stroke();G.setLineDash([]);G.globalAlpha=a*q;G.beginPath();G.arc(cx,y,S*.48,0,Math.PI*2);G.stroke();G.globalAlpha=a*.9;drawPiece(G,"pawn","black",cx+S*wide*.46,y-S*.31,S*.26,P,1);}else if(p.action==="sacrifice"){G.globalAlpha=a*.65;G.strokeStyle=P.muted;G.lineWidth=Math.max(2,u*.16);G.setLineDash([u*.35,u*.4]);G.beginPath();G.arc(cx,y,S*.47,Math.PI*.1,Math.PI*1.8);G.stroke();G.setLineDash([]);}if(p.label)B.tag(G,p.label,cx,c.y+u*3,{u,size:1.6,alpha:a,bg:P.ink,color:P.bg});if(p.note)B.mono(G,p.note,cx,c.y+c.h-u*2.2,{u,size:1.65,weight:700,color:P.ink,alpha:a*.82,spacing:u*.2});G.restore();}};}
  });

  function treeLayout(ctx,p){const c=ctx.stage.content,u=ctx.stage.u,depth=Math.max(2,Math.min(4,+p.depth||4)),branch=Math.max(2,Math.min(3,+p.branching||2)),box={x:c.x+u*2,y:c.y+u*8,w:c.w-u*4,h:c.h-u*17},levels=[];for(let l=0;l<=depth;l++){const n=branch**l,arr=[];for(let i=0;i<n;i++)arr.push({level:l,index:i,x:box.x+box.w*(i+.5)/n,y:box.y+box.h*l/depth});levels.push(arr);}return{depth,branch,box,levels};}
  function focusedEdges(p,L){const path=Array.isArray(p.focusPath)?p.focusPath:[];let parent=0,out=[];for(let l=0;l<L.depth;l++){const child=((+path[l]||0)%L.branch+L.branch)%L.branch;out.push([l,parent, parent*L.branch+child]);parent=parent*L.branch+child;}return out;}
  K.register({
    name:"binary.searchtree",tags:["búsqueda","opciones","ramas","cálculo"],layer:"main",
    summary:"Árbol esquemático de jugadas posibles con una ruta destacada; sirve para explicar búsqueda y evaluación sin afirmar que sea un registro literal del cálculo.",
    example:{depth:4,branching:2,focusPath:[1,0,1,0],label:"HARDWARE + BÚSQUEDA",note:"ESQUEMA DE OPCIONES"},
    params:{depth:{type:"number",default:4,min:2,max:4,doc:"Cantidad de niveles de decisión."},branching:{type:"number",default:2,min:2,max:3,doc:"Ramas por posición."},focusPath:{type:"array",default:[1,0,1,0],doc:"Índice de la rama destacada en cada nivel."},label:{type:"string",default:"",doc:"Etiqueta superior."},note:{type:"string",default:"",doc:"Nota inferior; usar ESQUEMA para aclarar el dibujo."},morph:{type:"number",default:1,doc:"Segundos para armar la trama binaria."}},
    points(ctx,p){const L=treeLayout(ctx,p),edges=focusedEdges(p,L);return B.pack(B.sampleShape((g,w,h)=>{g.strokeStyle="#fff";g.lineWidth=Math.max(2,w*.003);for(let l=0;l<L.depth;l++){const a=L.levels[l],z=L.levels[l+1];for(const n of a)for(let k=0;k<L.branch;k++){const j=n.index*L.branch+k,d=z[j];g.beginPath();g.moveTo((n.x-L.box.x)/L.box.w*w,(n.y-L.box.y)/L.box.h*h);g.lineTo((d.x-L.box.x)/L.box.w*w,(d.y-L.box.y)/L.box.h*h);g.stroke();}}},L.box,{cell:B.cellOf(ctx,.95),edge:true,seed:919}),ctx.family.binary.N);},
    reveal:(lt,b,p)=>clamp(lt/Math.max(.4,p.morph||1))+1e-6,
    create(ctx,p){return{render(lt,b){const G=ctx.g.top,P=ctx.C.palette,u=ctx.stage.u,L=treeLayout(ctx,p),edges=focusedEdges(p,L),a=B.fadeIO(lt,b.dur,.4,.45,.15);G.save();for(let l=0;l<L.depth;l++){const q=prog(lt,.35+l*.42,.48,"out");for(const n of L.levels[l])for(let k=0;k<L.branch;k++){const j=n.index*L.branch+k,d=L.levels[l+1][j],hi=edges.some(e=>e[0]===l&&e[1]===n.index&&e[2]===j);G.globalAlpha=a*q*(hi?.92:.23);G.strokeStyle=hi?P.ink:P.muted;G.lineWidth=hi?Math.max(2,u*.2):Math.max(1,u*.1);G.beginPath();G.moveTo(n.x,n.y);G.lineTo(d.x,d.y);G.stroke();}}for(let l=0;l<=L.depth;l++)for(const n of L.levels[l]){const hi=edges.some(e=>e[0]===l&&e[1]===n.index);G.globalAlpha=a*(hi?.95:.44);G.beginPath();G.arc(n.x,n.y,Math.max(2,u*(hi?.72:.46)),0,Math.PI*2);G.fillStyle=hi?P.ink:P.bg;G.fill();G.strokeStyle=hi?P.ink:P.muted;G.lineWidth=Math.max(1,u*.12);G.stroke();}const travel=clamp((lt-.45)/(L.depth*.42+1)),edge=Math.min(L.depth-1,Math.floor(travel*L.depth)),q=(travel*L.depth)%1;if(edge>=0){const e=edges[edge],from=L.levels[e[0]][e[1]],to=L.levels[e[0]+1][e[2]];G.globalAlpha=a*.9;G.fillStyle=P.ink;G.beginPath();G.arc(lerp(from.x,to.x,q),lerp(from.y,to.y,q),Math.max(2,u*.36),0,Math.PI*2);G.fill();}if(p.label)B.tag(G,p.label,ctx.stage.cx,ctx.stage.content.y+u*2.5,{u,size:1.6,alpha:a,bg:P.ink,color:P.bg});if(p.note)B.mono(G,p.note,ctx.stage.cx,ctx.stage.content.y+ctx.stage.content.h-u*2.4,{u,size:1.6,weight:700,color:P.ink,alpha:a*.76,spacing:u*.2});G.restore();}};}
  });
})();

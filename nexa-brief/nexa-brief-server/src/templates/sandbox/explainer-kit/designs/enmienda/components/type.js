/* =============================================================================
   enmienda · escenas tipográficas
   word (golpe de texto gastado), slats (numeral de listones), plaque (tablero de
   letras con cinta), cards (cartulinas con cinta, stop-motion), letter (aviso de
   diario + nota manuscrita), document (texto que aparece palabra a palabra con
   resaltado), wordcloud (nube de palabras en profundidad), finale (letras gigantes
   que barren).
   ========================================================================== */
(function () {
  const K = Kit, E = Kit.enm, { clamp, lerp, prog, ease } = K;
  const INK = "#d6d0c5", DARK = "#141210";
  const deg = d => d * Math.PI / 180;
  const lines = s => String(s ?? "").split("\n").map(x => x.trim()).filter(Boolean);
  const colorOf = f => f === "wide" ? "#efece6" : f === "stencil" ? "#cfcac2" : f === "serif" ? "#cdc6b9" : INK;

  /* ---------------------------------------------------------- fantasma de fondo */
  /** capa de texto tenue (documentos superpuestos detrás de los títulos) */
  function ghostLayer(ctx, text, seed) {
    const { W, H } = ctx.stage, T = E.mk(W, H, 1), g = T.g, r = K.rng(seed), words = String(text).split(/[\n|]/).filter(Boolean);
    g.filter = "blur(1.2px)";
    for (let k = 0; k < 14; k++) {
      const s = words[k % words.length], kind = ["grot", "doc", "cond", "serif"][k % 4], px = H * (0.03 + r() * 0.07);
      g.globalAlpha = 0.05 + r() * 0.09; g.fillStyle = "#cfc9be"; g.font = E.font(kind, px, kind === "doc" ? 400 : 700);
      g.fillText(s, r() * W * 0.9 - W * 0.1, r() * H);
    }
    g.filter = "none";
    return T.c;
  }

  /* ---------------------------------------------------------- fragmentos (palomas) */
  function fragments(lineCanvases, seed) {
    const r = K.rng(seed), out = [];
    lineCanvases.forEach(L => {
      const cs = L.h * 0.55, nx = Math.max(2, Math.round(L.w / cs)), ny = 2;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const pts = []; const n = 5 + (r() * 3 | 0);
        for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + r() * 0.5; pts.push([0.5 + Math.cos(a) * (0.55 + r() * 0.25), 0.5 + Math.sin(a) * (0.5 + r() * 0.3)]); }
        out.push({ L, sx: i / nx, sy: j / ny, sw: 1 / nx, sh: 1 / ny, pts, vx: 0.3 + r() * 0.8, vy: -(0.1 + r() * 0.6), rot: (r() - 0.5) * 6, grow: 0.5 + r() * 2.2, delay: (1 - i / nx) * 0.35 + r() * 0.15 });
      }
    });
    return out;
  }

  /* ================================================================= word */
  K.register({
    name: "enmienda.word", tags: ["título", "golpe", "texto", "impacto"], layer: "main", post: 0.7,
    summary: "Golpe de texto del documental: palabra/frase en condensada MUY gruesa con textura de tipo móvil gastado sobre negro. Entradas: erosión (polvo por vetas), desenfoque, barrido, volteo con destello, golpe seco. Salidas: erosión, desenfoque, 'palomas' (se rompe en recortes que vuelan) o corte. Marcas a pincel (cruz, círculo, garabato, subrayado) o mira telescópica.",
    example: { text: "ALGO SE\nROMPE", font: "grot", in: "erode", mark: "x", markAt: 0.7 },
    params: {
      text: { type: "string", required: true, doc: "Texto ('\\n' parte renglones). Mayúsculas recomendadas." },
      font: { type: "enum", options: ["grot", "heavy", "stencil", "serif", "wide"], default: "grot", doc: "grot = condensada gruesa (Oswald), heavy = Anton, stencil = esténcil con serifa, serif = titular victoriano condensado, wide = extendida (Archivo)." },
      size: { type: "number", default: 0.6, min: 0.15, max: 0.98, doc: "Fracción del ancho que ocupa el renglón más largo (en 9:16 se agranda solo)." },
      in: { type: "enum", options: ["erode", "blur", "swipe", "tumble", "slam", "cut"], default: "erode", doc: "Entrada." },
      out: { type: "enum", options: ["erode", "blur", "birds", "cut"], default: "erode", doc: "Salida (durante el solape con el beat siguiente)." },
      mark: { type: "enum", options: ["none", "x", "circle", "scribble", "underline", "crosshair"], default: "none", doc: "Marca a pincel o mira sobre el texto." },
      markAt: { type: "number", default: 0.7, doc: "Segundos desde el inicio del beat en que se dibuja la marca (acepta '@palabra')." },
      ghost: { type: "string", default: "", doc: "Texto tenue de documentos detrás ('|' separa piezas). Vacío = nada." },
      y: { type: "number", default: 0.47, doc: "Centro vertical (fracción del alto)." },
      tilt: { type: "number", default: 0, doc: "Inclinación final en grados." },
      captions: { type: "bool", default: true, doc: "false = oculta los subtítulos mientras está en pantalla." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, Ls = lines(p.text), kind = p.font, col = colorOf(kind);
      if (!p.captions) ctx.beat.hideCaptions = true;
      const size = portrait ? Math.min(0.92, p.size * 1.45) : p.size;
      const longest = Ls.reduce((a, s) => Math.max(a, E.measure(s, kind, 100)), 1);
      let fs = Math.min(100 * W * size / longest, H * (portrait ? 0.15 : 0.26), H * 0.66 / (Ls.length * 0.95));
      const lh = fs * (kind === "serif" ? 1.02 : kind === "wide" ? 0.98 : 0.94);
      const LC = Ls.map((s, i) => E.inkText(s, { kind, px: fs, color: col, wear: kind === "wide" ? 0.35 : 0.9, seed: 7 + i * 3, spacing: kind === "wide" ? -0.01 : 0 }));
      const D = LC.map((L, i) => E.dissolver(ctx.rng() * 1e6 | 0, 150, Math.max(14, Math.round(150 * L.h / L.w)), { streak: true, cell: 5 }));
      const ghost = p.ghost ? ghostLayer(ctx, p.ghost, 31) : null;
      const frags = p.out === "birds" ? fragments(LC, 77) : null;
      const totalH = lh * Ls.length, top = p.y * H - totalH / 2;
      const boxW = Math.max(...LC.map(L => L.w));
      const marks = p.mark !== "none" && p.mark !== "crosshair" ? E.scribble(p.mark, W / 2, p.y * H, boxW * (p.mark === "circle" ? 1.15 : 1.25), totalH * (p.mark === "underline" ? 0 : 1.05), 41) : null;
      if (p.mark === "underline" && marks) marks.forEach(m => m.forEach(pt => pt[1] += totalH * 0.55));
      return {
        render(lt, b, t) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.7);
          if (p.out === "cut" && lt > b.dur) return;
          G.save(); E.camera(G, ctx.stage, lt, { push: 0.014, drift: 0.25, seed: 3 });
          if (ghost) { G.save(); G.globalAlpha = clamp(lt / 0.6) * (1 - oq); G.translate(-lt * W * 0.006, 0); G.drawImage(ghost, 0, 0, W, H); G.restore(); }
          G.translate(W / 2, p.y * H); G.rotate(deg(p.tilt)); G.translate(-W / 2, -p.y * H);
          /* entrada */
          let a = 1, sc = 1, rot = 0, dx = 0, blur = 0, sm = 0;
          if (p.in === "blur") { const q = prog(lt, 0, 0.75, "out"); a = q; sc = 1 + (1 - q) * 0.07; blur = (1 - q) * 14; sm = (1 - q) * W * 0.06; }
          else if (p.in === "swipe") { const q = prog(lt, 0, 0.5, "expoOut"); dx = -(1 - q) * W * 0.7; sm = (1 - q) * W * 0.22; a = clamp(q * 4); }
          else if (p.in === "tumble") { const q = prog(lt, 0, 0.6, "expoOut"); rot = deg(lerp(-16, 0, q)); sc = lerp(1.8, 1, q); blur = (1 - q) * 9; a = clamp(q * 3); }
          else if (p.in === "slam" && lt < 0.09) { sc = 1.45; rot = deg(-8); }
          /* salida */
          if (p.out === "blur" && oq > 0) { a *= 1 - oq; blur += oq * 16; sc *= 1 + oq * 0.06; sm += oq * W * 0.05; }
          G.translate(W / 2 + dx, p.y * H); G.rotate(rot); G.scale(sc, sc); G.translate(-W / 2, -p.y * H);
          if (blur > 0.4) G.filter = `blur(${blur.toFixed(1)}px)`;
          LC.forEach((L, i) => {
            const x = W / 2 - L.w / 2, y = top + i * lh + lh / 2 - L.base + fs * 0.36;
            let pin = 1, pout = 1;
            if (p.in === "erode") pin = prog(lt, 0.04 + i * 0.13, 0.55, "linear");
            if (p.out === "erode") pout = 1 - prog(lt - b.dur, i * 0.08, 0.5, "linear");
            if (p.out === "birds" && oq > 0 && frags) return;
            G.save(); G.globalAlpha *= a;
            const pv = Math.min(pin, pout);
            const draw = off => { if (pv >= 0.999) G.drawImage(L.c, x + off, y, L.w, L.h); else if (pv > 0.001) E.masked(G, L.c, D[i].at(pv), x + off, y, L.w, L.h); };
            if (sm > 1) E.smear(G, sm, 5, draw); else draw(0);
            G.restore();
          });
          G.filter = "none";
          /* palomas: la palabra se rompe en recortes de papel que vuelan */
          if (p.out === "birds" && oq > 0 && frags) {
            frags.forEach(f => {
              const L = f.L, li = LC.indexOf(L), x0 = W / 2 - L.w / 2, y0 = top + li * lh + lh / 2 - L.base + fs * 0.36;
              const q = clamp((oq - f.delay) / 0.55), cx = x0 + (f.sx + f.sw / 2) * L.w, cy = y0 + (f.sy + f.sh / 2) * L.h, w = f.sw * L.w, h = f.sh * L.h;
              G.save(); G.translate(cx + f.vx * W * q * q * 1.4, cy + f.vy * H * q * q * 1.2); G.rotate(f.rot * q); const s = 1 + f.grow * q; G.scale(s, s);
              G.globalAlpha = 1 - clamp(q * 1.3 - 0.4);
              if (q > 0) { G.beginPath(); f.pts.forEach((pt, k) => (k ? G.lineTo : G.moveTo).call(G, (pt[0] - 0.5) * w * 1.2, (pt[1] - 0.5) * h * 1.2)); G.closePath(); G.clip(); }
              if (q > 0) { G.fillStyle = "#cdc7bc"; G.fillRect(-w, -h, w * 2, h * 2); }
              G.drawImage(L.c, f.sx * L.c.width, f.sy * L.c.height, f.sw * L.c.width, f.sh * L.c.height, -w / 2, -h / 2, w, h);
              G.restore();
            });
          }
          /* marcas */
          const mq = prog(lt, p.markAt, p.mark === "crosshair" ? 0.55 : 0.45, "out");
          if (p.mark === "crosshair") E.crosshair(G, W / 2, p.y * H, Math.max(boxW, totalH) * 0.6, mq, Math.max(1.2, fs * 0.022));
          else if (marks) marks.forEach((m, k) => E.brush(G, m, prog(lt, p.markAt + k * 0.16, 0.28, "out") * (oq > 0 ? 1 : 1), { width: fs * 0.12, seed: 50 + k, color: "#cfc9be", alpha: 0.8 * (1 - oq) }));
          G.restore();
        },
      };
    },
  });

  /* ================================================================= slats */
  K.register({
    name: "enmienda.slats", tags: ["numeral", "título", "fecha", "apertura"], layer: "main", post: 0.5,
    summary: "Numeral gigante (romano o cifra) armado con listones de papel que entran deslizándose en vertical sobre un documento manuscrito tenue con marcas de conteo (||||/); al final la cámara gira y se zambulle en los listones (empalma con enmienda.plaque in:'dive').",
    example: { text: "XXVIII", sub: "AÑOS" },
    params: {
      text: { type: "string", default: "XXVIII", doc: "Numeral o palabra corta." },
      sub: { type: "string", default: "", doc: "Rótulo chico debajo (condensada con tracking)." },
      tally: { type: "bool", default: true, doc: "Marcas de conteo arriba a la derecha." },
      doc: { type: "string", default: "Congreso · sesión del día · acta", doc: "Texto manuscrito tenue de fondo." },
      out: { type: "enum", options: ["dive", "erode", "cut"], default: "dive", doc: "dive = gira y entra en los listones (últimos 0,5 s del beat)." },
      buildSec: { type: "number", default: 1.4, doc: "Segundos que tarda en armarse." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng;
      const fs = E.fit(p.text, "heavy", W * (portrait ? 0.86 : 0.5), H * (portrait ? 0.3 : 0.42), 400);
      const L = E.inkText(p.text, { kind: "heavy", px: fs, color: "#d9d3c8", wear: 0.75, seed: 21 });
      /* cortes por letra (y mitades de las letras anchas) */
      const cuts = [0]; let acc = fs * 0.15;
      for (const ch of p.text) { const w = E.measure(ch, "heavy", fs, 400); if (w > fs * 0.42) cuts.push((acc + w / 2) / L.w); acc += w; cuts.push(acc / L.w); }
      cuts.push(1);
      const sl = []; for (let i = 0; i < cuts.length - 1; i++) if (cuts[i + 1] - cuts[i] > 0.005) sl.push({ a: cuts[i], b: cuts[i + 1], dir: r() < 0.5 ? -1 : 1, d: r() * 0.55, len: 0.5 + r() * 0.5 });
      const D = E.dissolver(91, 150, 60, { streak: true });
      const tallies = [];
      for (let k = 0; k < 4; k++) for (let j = 0; j < 5; j++) tallies.push([k, j]);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (p.out === "cut" && lt > b.dur) return;
          G.save();
          /* zambullida final: giro + zoom hacia los listones */
          const dq = p.out === "dive" ? prog(lt, b.dur - 0.5, 0.5, "in") : 0;
          E.camera(G, ctx.stage, lt, { push: 0.01, drift: 0.2, rot: deg(-34) * dq, zoom: 1 + dq * 5.5, cx: W * 0.56, cy: H * 0.5 });
          /* documento tenue */
          G.save(); G.globalAlpha = 0.16 * clamp(lt / 0.5); G.fillStyle = "#cfc9be";
          G.font = E.font("sign", H * 0.05); G.fillText(p.doc, W * 0.06, H * 0.2); G.font = E.font("doc", H * 0.022);
          for (let k = 0; k < 3; k++) G.fillText("— " + p.doc + " —", W * (0.08 + k * 0.05), H * (0.27 + k * 0.035));
          G.fillText(p.doc, W * 0.3, H * 0.86); G.restore();
          if (p.tally) {
            G.save(); G.globalAlpha = 0.55 * clamp(lt / 0.4);
            tallies.forEach(([k, j], i) => {
              const x0 = W * (portrait ? 0.56 : 0.72) + k * W * 0.045, y0 = H * 0.13, s = H * 0.055, q = prog(lt, 0.1 + i * 0.03, 0.12);
              const pts = j < 4 ? [[x0 + j * s * 0.16, y0], [x0 + j * s * 0.16 + s * 0.04, y0 + s]] : [[x0 - s * 0.1, y0 + s * 0.75], [x0 + s * 0.68, y0 + s * 0.2]];
              if (q > 0) { G.strokeStyle = "#d9d3c8"; G.lineWidth = Math.max(1.2, s * 0.05); G.lineCap = "round"; G.beginPath(); G.moveTo(pts[0][0], pts[0][1]); G.lineTo(lerp(pts[0][0], pts[1][0], q), lerp(pts[0][1], pts[1][1], q)); G.stroke(); }
            });
            G.restore();
          }
          /* listones */
          const x0 = W / 2 - L.w / 2, y0 = H * 0.48 - L.h / 2;
          const eo = p.out === "erode" ? 1 - prog(lt - b.dur, 0, 0.45, "linear") : 1;
          sl.forEach(s => {
            const q = prog(lt, s.d * p.buildSec * 0.6, p.buildSec * 0.55, "inOut"), dy = s.dir * (1 - q) * H * (0.55 + s.len * 0.4);
            if (q <= 0) return;
            const sx = s.a * L.c.width, sw = (s.b - s.a) * L.c.width, dx = x0 + s.a * L.w, dw = (s.b - s.a) * L.w;
            G.save(); G.globalAlpha = clamp(q * 2.5);
            if (eo < 1) E.masked(G, L.c, D.at(eo), dx, y0 + dy, dw, L.h, 1, sx, 0, sw, L.c.height);
            else G.drawImage(L.c, sx, 0, sw, L.c.height, dx, y0 + dy, dw, L.h);
            G.restore();
          });
          if (p.sub) {
            const sf = Math.min(H * 0.034, W * 0.045), sp = portrait ? 0.15 : 0.35;
            G.save(); G.globalAlpha = prog(lt, p.buildSec, 0.4) * (1 - dq); G.fillStyle = "#bdb7ad"; G.font = E.font("cond", sf, 600);
            G.letterSpacing = (sf * sp) + "px"; G.textAlign = "center"; G.fillText(p.sub.toUpperCase(), W / 2, y0 + L.h + H * 0.07); G.restore();
          }
          /* el papel llena el cuadro al zambullirse */
          if (dq > 0.6) { G.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0); G.globalAlpha = (dq - 0.6) / 0.4 * 0.6; G.fillStyle = "#cfc9be"; G.fillRect(0, 0, W, H); }
          G.restore();
        },
      };
    },
  });

  /* ================================================================= plaque */
  K.register({
    name: "enmienda.plaque", tags: ["título", "cartel", "tachar", "cinta"], layer: "main", post: 0.45,
    summary: "Tablero de listones blancos con letras negras de esténcil gastado (tipo 'ABOLITION OF SLAVERY'), iluminado al centro. Entra girando desde muy cerca (empalme con slats) y se aleja despacio; puede tachar renglones con cinta negra que se pega en stop-motion.",
    example: { lines: ["LA NOCHE", "QUE CAYÓ", "EL MURO"], in: "dive" },
    params: {
      lines: { type: "array", default: ["LA NOCHE", "QUE CAYÓ", "EL MURO"], doc: "Renglones (uno por listón). Las palabras cortas quedan en listones más bajos." },
      in: { type: "enum", options: ["dive", "cut", "fade"], default: "cut", doc: "dive = llega girando desde muy cerca." },
      strike: { type: "array", default: [], doc: "Índices de renglones a tachar con cinta." },
      strikeAt: { type: "number", default: 1.2, doc: "Segundo (o '@palabra') en que se pega la primera cinta." },
      out: { type: "enum", options: ["smear", "cut"], default: "smear", doc: "smear = barrido desenfocado horizontal en el solape." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, Ls = p.lines.map(s => String(s).toUpperCase());
      const BW = portrait ? W * 0.94 : W * 0.66, maxFs = Math.min(BW * 0.2, H * (portrait ? 0.12 : 0.24) * (3 / Math.max(3, Ls.length)));
      const rows = Ls.map(s => { const f = E.fit(s, "grot", BW * 0.88, maxFs * (s.length <= 3 ? 0.62 : 1)); return { s, fs: f, h: f * 1.22 }; });
      const gap = BW * 0.012, totalH = rows.reduce((a, r) => a + r.h + gap, -gap);
      const T = rows.map((r, i) => E.inkText(r.s, { kind: "grot", px: r.fs, color: DARK, ink: "dark", wear: 0.95, seed: 60 + i }));
      const r = ctx.rng, tapes = Ls.map(() => ({ rot: (r() - 0.5) * 0.05, seed: r() * 1e5 | 0 }));
      return {
        render(lt, b) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.45);
          if (p.out === "cut" && lt > b.dur) return;
          G.save();
          G.fillStyle = "#050505"; G.fillRect(0, 0, W, H);
          let rot = 0, zoom = 1.1 - Math.min(lt, 6) * 0.02, a = 1;
          if (p.in === "dive") { const q = prog(lt, 0, 1.1, "inOut"); rot = deg(-30) * (1 - q); zoom = lerp(2.7, 1.12, q) - Math.max(0, lt - 1.1) * 0.02; }
          if (p.in === "fade") a = prog(lt, 0, 0.5);
          let sm = 0; if (p.out === "smear" && oq > 0) { sm = oq * W * 0.3; a *= 1 - oq; }
          E.camera(G, ctx.stage, lt, { push: 0, zoom, rot, drift: 0.2 });
          G.globalAlpha = a;
          if (sm > 0) G.filter = `blur(${(oq * 10).toFixed(1)}px)`;
          const draw = off => {
            let y = H / 2 - totalH / 2;
            rows.forEach((row, i) => {
              const x = W / 2 - BW / 2 + off;
              G.save(); G.fillStyle = "#c9c5be"; G.fillRect(x, y, BW, row.h); G.globalAlpha *= 0.45; E.pattern(G, E.fibers(14 + i), x, y, BW, row.h); G.restore();
              G.fillStyle = "rgba(0,0,0,.35)"; G.fillRect(x, y + row.h - row.h * 0.04, BW, row.h * 0.04);
              const L = T[i]; G.drawImage(L.c, W / 2 - L.w / 2 + off, y + row.h / 2 - L.base + row.fs * 0.37, L.w, L.h);
              /* cinta que tacha (stop-motion: 1er cuadro torcida, después asentada) */
              const k = p.strike.indexOf(i);
              if (k >= 0) {
                const tt = lt - (p.strikeAt + k * 0.18);
                if (tt >= 0) {
                  const tw = Math.min(BW * 0.98, L.w * 1.06), first = tt < 1 / 12;
                  E.tape(G, W / 2 + off + (first ? row.fs * 0.2 : 0), y + row.h * 0.5, tw, row.fs * 0.42, tapes[i].rot + (first ? 0.05 : 0), tapes[i].seed);
                }
              }
              y += row.h + gap;
            });
          };
          if (sm > 0) E.smear(G, sm, 6, draw); else draw(0);
          G.filter = "none";
          G.restore();
          /* luz central y viñeta fuerte (tablero iluminado por un foco) */
          G.save(); G.globalAlpha = a; E.vignette(G, W, H, 0.85, 0.2); G.restore();
        },
      };
    },
  });

  /* ================================================================= cards */
  K.register({
    name: "enmienda.cards", tags: ["cartel", "palabras", "stop-motion", "papel", "tachar"], layer: "main", post: 0.3,
    summary: "Cartulinas blancas con palabras en tinta negra de rodillo, pegadas con cinta negra sobre papel gris arrugado; aparecen una por una en stop-motion (como 'KEEP THESE PRISONS FILLED'). Puede tachar con cinta o, en modo 'pile', llover hojas que se apilan.",
    example: { words: ["ABRAN", "LA", "PUERTA"] },
    params: {
      words: { type: "array", required: true, doc: "Una palabra (o dos cortas) por cartulina." },
      at: { type: "array", default: [], doc: "Segundos de aparición de cada cartulina (vacío = repartidas en el primer 60 % del beat)." },
      strike: { type: "array", default: [], doc: "Índices de cartulinas a tachar con cinta." },
      strikeAt: { type: "number", default: 1.5, doc: "Segundo (o '@palabra') de la primera cinta que tacha." },
      mode: { type: "enum", options: ["words", "pile"], default: "words", doc: "pile = hojas que caen y se apilan (palabras como membretes)." },
      count: { type: "number", default: 16, doc: "Hojas en modo pile." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng, n = p.words.length;
      const items = [];
      if (p.mode === "pile") {
        for (let i = 0; i < p.count; i++) {
          const w = W * (portrait ? 0.5 : 0.26) * (0.8 + r() * 0.4), h = w * 1.28;
          items.push({ x: W / 2 + (r() - 0.5) * W * (i < p.count - 3 ? 0.75 : 0.12), y: H / 2 + (r() - 0.5) * H * (i < p.count - 3 ? 0.7 : 0.1), w, h, rot: (r() - 0.5) * 0.9, word: String(p.words[i % n]).toUpperCase(), kind: ["serif", "wide", "stencil", "grot"][i % 4], t: 0.1 + i * Math.min(0.22, 2.4 / p.count) });
        }
      } else {
        const fs = portrait ? W * 0.15 : H * 0.17, maxW = portrait ? W * 0.9 : W * 0.84;
        const cards = p.words.map((s, i) => { const t = String(s).toUpperCase(), tw = E.measure(t, "grot", fs, 700); return { t, w: tw + fs * 0.55, h: fs * 1.42, L: E.inkText(t, { kind: "grot", px: fs, color: DARK, ink: "dark", wear: 1, seed: 80 + i }) }; });
        const rowsA = [[]]; let rw = 0;
        cards.forEach(c => { if (rowsA[rowsA.length - 1].length && rw + c.w > maxW) { rowsA.push([]); rw = 0; } rowsA[rowsA.length - 1].push(c); rw += c.w; });
        const rowH = fs * 1.42 * 0.94, y0 = H * 0.47 - (rowsA.length * rowH) / 2 + rowH / 2;
        let k = 0;
        rowsA.forEach((row, ri) => {
          const tot = row.reduce((a, c) => a + c.w, 0) - (row.length - 1) * fs * 0.06; let x = W / 2 - tot / 2 + (ri % 2 ? fs * 0.25 : -fs * 0.2);
          row.forEach(c => { items.push({ ...c, x: x + c.w / 2, y: y0 + ri * rowH + (r() - 0.5) * fs * 0.1, rot: (r() - 0.5) * 0.035, tapeSeed: r() * 1e5 | 0, tapeX: (r() - 0.5) * 0.4, t: p.at[k] ?? (0.12 + k * Math.min(0.55, b0dur(ctx) * 0.6 / n)) }); x += c.w - fs * 0.06; k++; });
        });
      }
      const bg = E.paper(5, 1024, 640, 192);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          G.save();
          G.drawImage(bg, 0, 0, W, H);
          E.spot(G, W / 2, H * 0.45, W * 0.6, H * 0.55, 0.14);
          E.camera(G, ctx.stage, lt, { push: p.mode === "pile" ? -0.03 : 0.01, zoom: p.mode === "pile" ? 1.08 : 1, drift: 0.15 });
          const st = E.stop(lt, 12);
          items.forEach((c, i) => {
            if (st < c.t) return;
            const [jx, jy, jr] = E.boil(i + 1, lt, ctx.stage.u * 0.12, 6), fresh = st - c.t < 1 / 12;
            const s = fresh ? 1.03 : 1;
            G.save(); G.translate(c.x + jx + (fresh ? ctx.stage.u * 0.6 : 0), c.y + jy); G.rotate(c.rot + jr + (fresh ? 0.02 : 0)); G.scale(s, s);
            E.card(G, 0, 0, c.w, c.h, 0);
            if (p.mode === "pile") {
              const f = c.h * 0.11; G.fillStyle = "#1a1917"; G.font = E.font(c.kind, f); G.textAlign = "center"; G.fillText(c.word, 0, -c.h * 0.08);
              G.fillStyle = "rgba(20,20,20,.25)"; for (let l = 0; l < 6; l++) G.fillRect(-c.w * 0.36, c.h * (0.08 + l * 0.05), c.w * (0.5 + ((l * 7) % 5) * 0.05), c.h * 0.012);
            } else {
              G.drawImage(c.L.c, -c.L.w / 2, -c.L.base + c.h * 0.19, c.L.w, c.L.h);
              E.tape(G, c.tapeX * c.w * 0.5, -c.h / 2, c.w * 0.55, c.h * 0.17, (c.tapeX) * 0.06, c.tapeSeed);
              const k = p.strike.indexOf(i);
              if (k >= 0 && lt >= p.strikeAt + k * 0.2) E.tape(G, 0, c.h * 0.06, c.L.w * 1.02, c.h * 0.24, -0.02, c.tapeSeed + 9);
            }
            G.restore();
          });
          G.restore();
          E.vignette(G, W, H, 0.55, 0.3);
        },
      };
    },
  });
  /* duración del beat en create (resuelta por el motor) */
  function b0dur(ctx) { return ctx.beat?.dur || 3; }

  /* ================================================================= letter */
  K.register({
    name: "enmienda.letter", tags: ["documento", "diario", "firma", "nota"], layer: "main", post: 0.3,
    summary: "Aviso de diario en papel blanco con viñeta: titular en serif condensada negra; barrido rápido (latigazo con desenfoque) hasta el cuerpo del texto y una nota manuscrita que se escribe sobre la línea de firma.",
    example: { headline: "ESPERAR\nHASTA LA\nMAÑANA.", body: "La regla se anunciaría al día siguiente,\ncon calma, con trámites y con orden.", hand: "no antes del 10/11", sign: "Oficina de prensa · 9 nov 1989" },
    params: {
      headline: { type: "string", required: true, doc: "Titular ('\\n' renglones)." },
      body: { type: "string", default: "", doc: "Cuerpo chico (serif)." },
      hand: { type: "string", default: "", doc: "Nota manuscrita que se escribe sobre la línea." },
      sign: { type: "string", default: "", doc: "Rótulo bajo la línea de firma." },
      whipAt: { type: "number", default: 0, doc: "Segundo del latigazo al cuerpo (0 = 50 % del beat)." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, hl = lines(p.headline).map(s => s.toUpperCase()), bd = lines(p.body);
      const longest = hl.reduce((a, s) => Math.max(a, E.measure(s, "serif", 100, 900)), 1);
      const fs = Math.min(100 * W * (portrait ? 0.9 : 0.62) / (longest * 0.8), H * 0.2);
      const bg = E.paper(9, 1024, 640, 214);
      return {
        render(lt, b) {
          const G = ctx.g.main;
          if (lt > b.dur + 0.04) return;
          const wa = p.whipAt || b.dur * 0.5, wq = prog(lt, wa - 0.12, 0.3, "inOut");
          G.save(); G.drawImage(bg, 0, 0, W, H);
          E.camera(G, ctx.stage, lt, { push: 0.012, drift: 0.2 });
          const sm = Math.sin(wq * Math.PI) * W * 0.35;
          if (sm > 2) G.filter = `blur(${(sm / W * 30).toFixed(1)}px)`;
          const draw = off => {
            /* titular (se va a la izquierda en el latigazo) */
            if (wq < 1) {
              G.save(); G.translate(-wq * W * 1.1 + off, 0); G.fillStyle = "#121110"; G.textAlign = "center";
              hl.forEach((s, i) => { G.save(); G.translate(W / 2, H * 0.5 + (i - (hl.length - 1) / 2) * fs * 0.98 + fs * 0.35); G.scale(0.8, 1); G.font = E.font("serif", fs, 900); G.fillText(s, 0, 0); G.restore(); });
              G.save(); G.translate(W / 2, H * 0.5 + (hl.length / 2 + 0.55) * fs * 0.98 + fs * 0.35); G.scale(0.8, 1); G.font = E.font("serif", fs, 900); G.fillText(hl[0], 0, 0); G.restore();
              G.restore();
            }
            /* cuerpo + nota manuscrita */
            if (wq > 0) {
              G.save(); G.translate((1 - wq) * W * 1.1 + off, 0);
              const bx = portrait ? W * 0.1 : W * 0.25, by = H * (portrait ? 0.3 : 0.18), bf = H * (portrait ? 0.022 : 0.034);
              G.fillStyle = "#1c1b19"; G.font = E.font("doc", bf, 400);
              bd.forEach((s, i) => G.fillText(s, bx, by + i * bf * 1.25));
              const hy = by + bd.length * bf * 1.25 + H * 0.17, hq = prog(lt, wa + 0.25, 0.9, "linear");
              if (p.hand) {
                G.save(); G.font = E.font("sign", H * 0.11); const hw = G.measureText(p.hand).width;
                G.beginPath(); G.rect(W / 2 - hw / 2 - 10, hy - H * 0.12, (hw + 20) * hq, H * 0.2); G.clip();
                G.fillStyle = "#0e0d0c"; G.textAlign = "center"; G.fillText(p.hand, W / 2, hy); G.restore();
              }
              G.fillStyle = "#2a2826"; G.fillRect(W / 2 - W * 0.22, hy + H * 0.035, W * 0.44, Math.max(1, H * 0.002));
              if (p.sign) { G.font = E.font("doc", bf * 0.95, 400); G.textAlign = "center"; G.fillText(p.sign, W / 2, hy + H * 0.035 + bf * 1.5); }
              G.restore();
            }
          };
          if (sm > 2) E.smear(G, sm * 0.4, 5, draw); else draw(0);
          G.filter = "none"; G.restore();
          E.vignette(G, W, H, 0.9, 0.18);
        },
      };
    },
  });

  /* ================================================================= document */
  K.register({
    name: "enmienda.document", tags: ["documento", "ley", "cita", "resaltado"], layer: "main", post: 0.6,
    summary: "Documento oscuro: párrafo en condensada gris cuyas palabras aparecen en desorden (parpadeando) sobre una imagen fantasma; después una frase se resalta con caja blanca y texto negro (como 'EXCEPT AS A PUNISHMENT FOR CRIME').",
    example: { text: "Un muro de hormigón y alambre en medio de la ciudad", highlight: "hormigón y alambre", highlightAt: 1.6 },
    params: {
      text: { type: "string", required: true, doc: "Párrafo (se pasa a mayúsculas)." },
      highlight: { type: "string", default: "", doc: "Fragmento exacto del texto a resaltar." },
      highlightAt: { type: "number", default: 1.6, doc: "Segundo (o '@palabra') del resaltado." },
      label: { type: "string", default: "", doc: "Rótulo chico arriba (p. ej. 'SECCIÓN 1')." },
      src: { type: "image", default: "", doc: "Imagen fantasma de fondo (muy tenue, opcional)." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng;
      const words = String(p.text).toUpperCase().split(/\s+/).filter(Boolean);
      const hl = String(p.highlight || "").toUpperCase().split(/\s+/).filter(Boolean).map(K.norm);
      const fs = portrait ? W * 0.055 : H * 0.042, maxW = portrait ? W * 0.84 : W * 0.6, sp = fs * 0.55;
      const lay = []; let x = 0, y = 0;
      words.forEach(w => { const ww = E.measure(w, "cond", fs, 600, 0.03); if (x && x + ww > maxW) { x = 0; y += fs * 1.22; } lay.push({ w, ww, x, y, t: 0.1 + r() * 1.1 }); x += ww + sp; });
      const nLines = y / (fs * 1.22) + 1;
      /* índices resaltados: primera coincidencia de la secuencia */
      let hiFrom = -1;
      if (hl.length) for (let i = 0; i + hl.length <= words.length && hiFrom < 0; i++) if (hl.every((h, k) => K.norm(words[i + k]) === h)) hiFrom = i;
      const img = p.src ? E.photo(ctx.img(p.src), "soft") : null;
      /* imagen fantasma con bordes fundidos (elipse) */
      let ghost = null;
      if (img) { const T = E.mk(W, H, 1); T.g.filter = "blur(2px)"; E.cover(T.g, img, W * 0.1, H * 0.12, W * 0.8, H * 0.76, [0.5, 0.5], 1.1); T.g.filter = "none"; T.g.globalCompositeOperation = "destination-in";
        const gr = T.g.createRadialGradient(0, 0, 0, 0, 0, 0.5); gr.addColorStop(0, "#000"); gr.addColorStop(0.5, "rgba(0,0,0,.8)"); gr.addColorStop(1, "rgba(0,0,0,0)");
        T.g.translate(W / 2, H / 2); T.g.scale(W * 0.8, H * 0.76); T.g.fillStyle = gr; T.g.fillRect(-0.5, -0.5, 1, 1); ghost = T.c; }
      return {
        render(lt, b) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.6);
          G.save(); G.globalAlpha = 1 - oq;
          E.camera(G, ctx.stage, lt, { push: 0.012, drift: 0.2 });
          if (ghost) { G.save(); G.globalAlpha *= 0.1; G.drawImage(ghost, 0, 0, W, H); G.restore(); }
          E.spot(G, W / 2, H / 2, W * 0.45, H * 0.32, 0.05);
          const ox = W / 2 - maxW / 2, oy = H * 0.5 - nLines * fs * 1.22 / 2 + fs;
          if (p.label) { G.save(); G.globalAlpha *= prog(lt, 0.2, 0.3); G.fillStyle = "#7a766f"; G.font = E.font("cond", fs * 0.5, 600); G.letterSpacing = fs * 0.1 + "px"; G.textAlign = "center"; G.fillText(p.label.toUpperCase(), W / 2, oy - fs * 1.3); G.restore(); }
          const hq = prog(lt, p.highlightAt, 0.3, "out");
          G.font = E.font("cond", fs, 600); G.letterSpacing = (fs * 0.03) + "px";
          lay.forEach((it, i) => {
            const on = lt >= it.t, fl = lt - it.t < 0.09 ? 0.45 : 1;
            if (!on) return;
            const isH = hiFrom >= 0 && i >= hiFrom && i < hiFrom + hl.length;
            if (isH && hq > 0) {
              const k = i - hiFrom, wq = clamp(hq * hl.length - k);
              G.fillStyle = "#e9e6e0"; G.fillRect(ox + it.x - fs * 0.12, oy + it.y - fs * 0.86, (it.ww + (k < hl.length - 1 ? sp : 0) + fs * 0.24) * wq, fs * 1.08);
              G.fillStyle = wq > 0.5 ? "#0d0d0c" : "#d0ccc5";
            } else G.fillStyle = `rgba(160,155,148,${0.85 * fl})`;
            G.fillText(it.w, ox + it.x, oy + it.y);
          });
          G.restore();
        },
      };
    },
  });

  /* ================================================================= wordcloud */
  K.register({
    name: "enmienda.wordcloud", tags: ["lista", "derechos", "nube", "palabras"], layer: "main", post: 0.4,
    summary: "Nube de palabras condensadas en profundidad: decenas de términos de distintos tamaños sobre un plano inclinado que la cámara atraviesa; las lejanas desenfocadas y tenues, las cercanas nítidas; garabatos a pincel encima.",
    example: { words: ["HUNGRÍA", "CHECOSLOVAQUIA", "ESCAPAR", "FRONTERA", "VIAJAR", "LIBERTAD"] },
    params: {
      words: { type: "array", required: true, doc: "Términos (se repiten para llenar la nube)." },
      count: { type: "number", default: 18, doc: "Cantidad de instancias." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, r = ctx.rng, base = portrait ? W * 0.085 : H * 0.15;
      const items = [];
      for (let i = 0; i < p.count; i++) {
        const w = String(p.words[i % p.words.length]).toUpperCase(), z = r(), two = w.includes(" ") && w.length > 9;
        const s = two ? w.replace(" ", "\n") : w;
        items.push({ z, x: (r() - 0.5) * (portrait ? 1.3 : 1.6), y: (r() - 0.5) * 1.5, k: 0.55 + r() * 0.9, L: lines(s).map((ln, j) => E.inkText(ln, { kind: "grot", px: base, weight: 600, color: "#cdc7bc", wear: 0.7, seed: 100 + i + j })) });
      }
      items.sort((a, b) => b.z - a.z);
      const scr = [0, 1, 2].map(k => { const pts = []; const x0 = W * (0.15 + k * 0.3), y0 = H * (0.3 + (k % 2) * 0.35); for (let j = 0; j < 9; j++) pts.push([x0 + j * W * 0.022, y0 + Math.sin(j * 1.9 + k) * H * 0.05 + (r() - 0.5) * H * 0.03]); return pts; });
      return {
        render(lt, b) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.4), cam = lerp(0.55, 0, prog(lt, 0, b.dur + 0.4, "out"));
          G.save(); G.globalAlpha = (1 - oq) * clamp(lt / 0.25);
          const tilt = deg(lerp(-22, -3, prog(lt, 0, 1.4, "out")));
          G.translate(W / 2, H / 2); G.rotate(tilt * 0.5); G.translate(-W / 2, -H / 2);
          items.forEach(it => {
            const depth = 0.62 + it.z * 1.1 + cam, s = it.k * 0.82 / depth, bl = Math.abs(it.z - 0.15) * 6;
            if (s < 0.08) return;
            const x = W / 2 + it.x * W * 0.5 / depth - lt * W * 0.01 / depth, y = H / 2 + it.y * H * 0.5 / depth * Math.cos(tilt);
            G.save(); G.globalAlpha *= clamp(0.25 + 0.75 * (1 - it.z)); if (bl > 0.6) G.filter = `blur(${bl.toFixed(1)}px)`;
            it.L.forEach((L, j) => G.drawImage(L.c, x - L.w * s / 2, y - L.h * s / 2 + j * L.h * s * 0.88, L.w * s, L.h * s));
            G.restore();
          });
          G.filter = "none";
          scr.forEach((pts, k) => E.brush(G, pts, prog(lt, 0.4 + k * 0.5, 0.5), { width: H * 0.03, hairs: 6, seed: k, color: "#d4cec3", alpha: 0.45 }));
          G.restore();
        },
      };
    },
  });

  /* ================================================================= finale */
  K.register({
    name: "enmienda.finale", tags: ["cierre", "título", "numeral"], layer: "main", post: 0.2,
    summary: "Título de cierre: letras gigantes (numeral romano) que desbordan el cuadro y barren lento de derecha a izquierda bajo una franja de luz; un rótulo chico impreso en tinta oscura sobre la primera letra. Entra con una cuña oscura que barre la escena anterior y termina fundiendo a negro.",
    example: { text: "MCMLXXXIX", label: "9 NOV\n1989" },
    params: {
      text: { type: "string", default: "MCMLXXXIX", doc: "Letras gigantes." },
      label: { type: "string", default: "", doc: "Rótulo impreso sobre una letra ('\\n' renglones)." },
      labelOn: { type: "number", default: 0, doc: "Índice de la letra que lleva el rótulo." },
      speed: { type: "number", default: 1, doc: "Velocidad del barrido (1 ≈ 6,5 % del ancho por segundo)." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, fs = H * (portrait ? 0.95 : 1.42);
      const L = E.inkText(p.text, { kind: "heavy", px: fs, color: "#bdb8b0", wear: 0.55, seed: 140, spacing: 0.05 });
      const idx = clamp(p.labelOn, 0, p.text.length - 1), lx = fs * 0.15 + E.measure(p.text.slice(0, idx), "heavy", fs, 400, 0.05) + E.measure(p.text[idx] || "X", "heavy", fs, 400, 0.05) / 2;
      return {
        render(lt, b) {
          const G = ctx.g.main, end = clamp((lt - (b.dur - 1.3)) / 1.2);
          G.save();
          const wipe = prog(lt, 0, 0.7, "inOut");
          G.beginPath(); G.moveTo(W * (1.25 - wipe * 1.6), 0); G.lineTo(W * 2, 0); G.lineTo(W * 2, H); G.lineTo(W * (1.05 - wipe * 1.6), H); G.closePath(); G.clip();
          G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
          const x = W * 0.5 - lx + W * 0.3 - W * 0.065 * p.speed * lt;
          const y = H / 2 - L.base + fs * 0.36;
          G.drawImage(L.c, x, y, L.w, L.h);
          /* franja de luz horizontal */
          const gr = G.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(0,0,0,.92)"); gr.addColorStop(0.3, "rgba(0,0,0,.25)"); gr.addColorStop(0.5, "rgba(0,0,0,0)"); gr.addColorStop(0.7, "rgba(0,0,0,.25)"); gr.addColorStop(1, "rgba(0,0,0,.92)");
          G.fillStyle = gr; G.fillRect(0, 0, W, H);
          if (p.label) {
            const lf = Math.min(H * 0.055, W * 0.07); G.fillStyle = "rgba(18,17,16,.92)"; G.font = E.font("grot", lf, 700); G.textAlign = "center";
            lines(p.label).forEach((s, i, A) => G.fillText(s.toUpperCase(), x + lx, H / 2 + (i - (A.length - 1) / 2) * lf * 1.05 + lf * 0.35));
          }
          G.fillStyle = `rgba(0,0,0,${end})`; G.fillRect(0, 0, W, H);
          G.restore();
        },
      };
    },
  });
})();

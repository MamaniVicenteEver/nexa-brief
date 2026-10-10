/* =============================================================================
   pop · planos de apertura: marca + círculo, objeto/caleidoscopio, japonés diagonal
   ========================================================================== */
(function () {
  const K = Kit, P0 = Kit.pop, { clamp, lerp, prog, ease } = K;
  const TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ logo */
  K.register({
    name: "pop.logo", tags: ["intro", "marca", "transición"], layer: "main",
    summary: "Apertura de marca (ref. 44,9 s): la marca del canal escala desde 0, un arco fino se dibuja antihorario, la marca parpadea en rosa, un anillo de trazos rotos gira y se cierra en un círculo fino; al final el círculo se borra. Kicker chico opcional debajo.",
    example: { mark: "", kicker: "BERLÍN · 9 NOV 1989" },
    params: {
      mark: { type: "string", default: "", doc: "Monograma (1–2 letras). Vacío = gota geométrica del canal." },
      kicker: { type: "string", default: "", doc: "Rótulo chico (Archivo extendida) debajo del círculo; vacío = nada." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      const P = ctx.C.palette;
      return {
        render(lt, b) {
          const { W, H } = ctx.stage, G = ctx.g.main, cx = W / 2, cy = H / 2, S = Math.min(H, W * 0.95);
          const f = P0.frameOf(lt), lw = Math.max(1, S * 0.0018);
          const out = clamp((lt - (b.dur - 0.3)) / 0.3);
          /* arco interior: se dibuja antihorario desde arriba (0,05–0,5 s) */
          if (lt < 0.68) {
            const sw = 2.6 * prog(lt, 0.03, 0.5, "out");
            G.save(); G.strokeStyle = P.ink; G.lineWidth = lw; G.beginPath(); G.arc(cx, cy, S * 0.28, -1.35, -1.35 - sw, true); G.stroke(); G.restore();
          }
          /* anillo exterior: trazos rotos que giran (0,5–0,7 s) y se cierran en un círculo fino */
          if (lt >= 0.48) {
            const q = prog(lt, 0.48, 0.25, "out"), R = S * 0.47 * (0.92 + 0.08 * q);
            G.save(); G.strokeStyle = P.ink; G.lineWidth = lw * (q < 1 ? 1.4 : 1);
            if (q < 1) { const seg = 0.05 + q * 0.9; G.setLineDash([R * seg, R * (1 - q) * 0.45 + 0.001]); G.lineDashOffset = -lt * R * 3; }
            const e0 = out * Math.PI, e1 = TAU - out * Math.PI;   /* salida: se borra desde abajo */
            G.beginPath(); G.arc(cx, cy, R, Math.PI / 2 + e0, Math.PI / 2 + e1); if (e1 > e0) G.stroke(); G.restore();
            /* rastro de un segundo anillo roto apenas mayor durante el giro */
            if (q < 1) { G.save(); G.strokeStyle = P.ink; G.globalAlpha = 1 - q; G.lineWidth = lw; G.setLineDash([R * 0.08, R * 0.3]); G.lineDashOffset = lt * R * 5; G.beginPath(); G.arc(cx, cy, R * 1.04, 0, TAU); G.stroke(); G.restore(); }
          }
          /* marca: escala 0→1 (4 cuadros), parpadeos rosa y cortes de glitch */
          const s = S * 0.045 * ease.back(clamp(lt / 0.16));
          const pink = [11, 13, 18].includes(f), glitchC = [15, 21].includes(f), half = [19].includes(f);
          if (glitchC) { G.save(); G.strokeStyle = P.ink; G.lineWidth = lw * 1.6; G.beginPath(); G.arc(cx, cy, S * 0.04, -1.2, 4.6); G.stroke(); G.restore(); }
          else if (s > 0.5) {
            G.save(); if (half) { G.beginPath(); G.rect(cx - s * 2, cy, s * 4, s * 2); G.clip(); }
            P0.mark(G, cx, cy, s, pink ? P.accent : P.ink, p.mark); G.restore();
          }
          if (p.kicker) {
            const k = clamp((lt - 0.7) / 0.3), n = Math.round(k * p.kicker.length);
            P0.text(G, p.kicker.slice(0, n), cx, cy + S * 0.47 + S * 0.09, { font: P0.font(S * 0.026, 800), color: P.ink, align: "center", sp: S * 0.004, alpha: 1 - out });
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ blob + caleidoscopio */
  /** contorno de "objeto 3D" orgánico (blob) con radio R; ph = fase (gira con el tiempo) */
  function blobPath(G, cx, cy, R, ph, seed) {
    const r = K.rng(seed), a1 = r() * 6, a2 = r() * 6, a3 = r() * 6;
    G.beginPath();
    for (let k = 0; k <= 72; k++) {
      const th = k / 72 * TAU, rr = R * (1 + 0.16 * Math.sin(3 * th + a1 + ph) + 0.09 * Math.sin(5 * th + a2 - ph * 1.3) + 0.05 * Math.sin(11 * th + a3 + ph * 0.7));
      const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr * 0.92;
      k ? G.lineTo(x, y) : G.moveTo(x, y);
    }
    G.closePath();
  }
  /** blob relleno de foto en duotono + sombreado esférico + esquirlas alrededor */
  function blob(ctx, G, cv, cx, cy, R, lt, seed, P) {
    G.save(); blobPath(G, cx, cy, R, lt * 0.9, seed); G.clip();
    if (cv) P0.cover(G, cv, cx - R * 1.3, cy - R * 1.3, R * 2.6, R * 2.6, { zoom: 1.1 + 0.05 * Math.sin(lt) });
    else { G.fillStyle = P.mid; G.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4); }
    const gr = G.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R * 1.25);
    gr.addColorStop(0, P0.rgba(P.accent, 0.35)); gr.addColorStop(0.55, P0.rgba(P.ink, 0.05)); gr.addColorStop(1, P0.rgba(P.ink, 0.85));
    G.fillStyle = gr; G.fillRect(cx - R * 2, cy - R * 2, R * 4, R * 4);
    G.restore();
    /* esquirlas (fragmentos) que orbitan */
    const r = K.rng(seed + 5);
    G.save(); G.fillStyle = P.ink;
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU + lt * (0.3 + r() * 0.5), d = R * (1.05 + r() * 0.5), s = R * (0.03 + r() * 0.07);
      G.beginPath(); G.ellipse(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.9 + R * 0.15, s, s * 0.7, a, 0, TAU); G.fill();
    }
    G.restore();
  }
  K.register({
    name: "pop.kaleido", tags: ["intro", "objeto", "foto", "caleidoscopio"], layer: "main",
    summary: "Objeto 3D orgánico (blob relleno con la foto en duotono, sombreado, con esquirlas) con rótulo '/RUTA/TIPO' (ref. 46,4 s); en `split` se parte en un CALEIDOSCOPIO hexagonal con 6 copias, rótulos rotados y bordes violeta gruesos, y aparece un marco violeta (ref. 46,95 s).",
    example: { src: "assets/media/mauerspecht.jpg", label: "/BERLÍN/1989", tag: "/MURO" },
    params: {
      src: { type: "image", default: "", doc: "Foto que rellena el objeto (vacío = violeta sombreado)." },
      label: { type: "string", default: "/DESIGN/BW", doc: "Rótulo chico arriba a la izquierda del objeto." },
      tag: { type: "string", default: "", doc: "Rótulo que se repite rotado en el caleidoscopio (vacío = primera parte de label)." },
      split: { type: "number", default: 0.55, doc: "Segundos hasta partir en caleidoscopio (<0 = nunca)." },
      ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = p.src ? P0.duo(ctx, p.src, "dark") : null, tag = p.tag || ("/" + (p.label.split("/").filter(Boolean)[0] || "POP"));
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, cx = W / 2, cy = H / 2, S = Math.min(H, W);
          const hexOn = p.split >= 0 && lt >= p.split, kl = lt - p.split;
          const R = S * 0.17 * (hexOn ? 0.92 : ease.back(clamp(lt / 0.28)));
          if (!hexOn) {
            if (R > 1) blob(ctx, G, cv, cx, cy, R, lt, 11, P);
            P0.text(G, p.label, cx - S * (portrait ? 0.4 : 0.42), cy - S * 0.31, { font: P0.font(S * 0.022, 800), color: P.ink, sp: -S * 0.001 });
          } else {
            const HR = S * (portrait ? 0.46 : 0.5), hh = HR * 0.866;
            const hex = [[cx - HR, cy], [cx - HR / 2, cy - hh], [cx + HR / 2, cy - hh], [cx + HR, cy], [cx + HR / 2, cy + hh], [cx - HR / 2, cy + hh]];
            /* afuera: 6 copias del objeto (vecinas del panal) y rótulos rotados */
            const nb = [[1.5, 0.5], [1.5, -0.5], [-1.5, 0.5], [-1.5, -0.5], [0, 1], [0, -1]];
            nb.forEach(([a, c], i) => blob(ctx, G, cv, cx + a * HR, cy + c * hh * 2, R * 1.05, lt + i * 0.7, 11 + (i % 2), P));
            const r = K.rng(77);
            for (let i = 0; i < 18; i++) {
              const x = r() * W, y = r() * H; G.save(); G.translate(x, y); G.rotate((r() - 0.5) * 1.4);
              P0.text(G, tag, 0, 0, { font: P0.font(S * 0.017, 800), color: P.ink, align: "center" }); G.restore();
            }
            /* hexágono central: fondo menta, objeto, bandas violeta gruesas arriba y abajo */
            G.save(); P0.clipPoly(G, hex); G.fillStyle = P.bg; G.fillRect(0, 0, W, H);
            blob(ctx, G, cv, cx, cy, R, lt, 11, P);
            const bt = hh * 0.17 * prog(kl, 0, 0.12, "out");
            G.fillStyle = P.ink; G.fillRect(0, cy - hh, W, bt); G.fillRect(0, cy + hh - bt, W, bt);
            G.restore();
            G.save(); G.strokeStyle = P0.rgba(P.ink, 0.6); G.lineWidth = Math.max(1, S * 0.0015); P0.poly(G, hex); G.stroke();
            G.beginPath(); G.moveTo(0, cy); G.lineTo(cx - HR, cy); G.moveTo(cx + HR, cy); G.lineTo(W, cy); G.stroke(); G.restore();
            /* marco violeta en todo el borde (a los 0,3 s del caleidoscopio) */
            if (kl > 0.3) { const fw = S * 0.016; G.save(); G.fillStyle = P.ink; G.fillRect(0, 0, W, fw); G.fillRect(0, H - fw, W, fw); G.fillRect(0, 0, fw, H); G.fillRect(W - fw, 0, fw, H); G.restore(); }
          }
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ japonés diagonal */
  K.register({
    name: "pop.kanji", tags: ["texto", "diagonal", "foto", "japonés", "título"], layer: "main",
    summary: "Texto diagonal isométrico (ref. 49,85 s): renglón grande (japonés u otro) + subrenglón chico, rotado −28°, chico en el centro sobre menta; en `split` pasa a GRANDE sobre una foto cortada por un triángulo menta, con el texto que cambia de color según la región (menta sobre foto, violeta sobre menta) y deriva en diagonal (ref. 50,4 s). Esquina superior derecha: 4 renglones chicos que se escriben.",
    example: { big: "ベルリンの壁", sub: "BERLIN WALL · 1961", src: "assets/media/bornholmer.jpg", corner: ["9 NOV", "19", "89", "DDR"] },
    params: {
      big: { type: "string", default: "時者埼", doc: "Renglón grande (japonés/chino en Noto Sans JP; latín en Archivo extendida)." },
      sub: { type: "string", default: "RANDOM PHRASE", doc: "Subrenglón chico debajo." },
      src: { type: "image", default: "", doc: "Foto de la fase grande (vacío = siempre fase chica)." },
      split: { type: "number", default: 0.55, doc: "Segundos hasta la fase grande sobre la foto (0 = empieza grande)." },
      corner: { type: "array", default: ["STD.", "TRA", "NSM", "AXX"], doc: "Renglones chicos de la esquina superior derecha (el 1º en violeta)." },
      ...P0.FOCUS, ...P0.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = p.src ? P0.duo(ctx, p.src) : null;
      const cjk = /[　-鿿＀-￯]/.test(p.big);
      /* ancho del renglón grande por px de fuente (para que textos largos no se salgan) */
      const wr = Math.max(0.5, P0.measure(p.big, cjk ? P0.JP(100) : P0.font(100, 900)) / 100);
      return {
        render(lt, b) {
          const { W, H, portrait } = ctx.stage, G = ctx.g.main, S = Math.min(H, W * 0.95);
          const bigOn = cv && lt >= p.split, kl = bigOn ? lt - p.split : lt;
          const drawText = (size, cx, cy, colBig, colSub) => {
            G.save(); G.translate(cx, cy);
            G.transform(0.883, -0.469, 0.26, 0.966, 0, 0);       /* rotación −28° + inclinación: look isométrico */
            const fb = cjk ? P0.JP(size) : P0.font(size, 900), w = P0.measure(p.big, fb, cjk ? -size * 0.04 : -size * 0.02);
            P0.text(G, p.big, -w / 2, size * 0.35, { font: fb, color: colBig, sp: cjk ? -size * 0.04 : -size * 0.02 });
            P0.text(G, p.sub, -w / 2 + Math.min(size * (cjk ? 1.25 : 0.4), w * 0.3), size * 0.35 + size * 0.42, { font: P0.font(size * 0.2, 800), color: colSub, sp: size * 0.01 });
            G.restore();
          };
          if (!bigOn) {
            const size = Math.min(S * (portrait ? 0.075 : 0.085), W * (portrait ? 0.5 : 0.3) / wr), dx = kl * S * 0.02;
            drawText(size, W * 0.5 + dx, H * 0.53 - dx * 0.3, P.ink, P.ink);
          } else {
            const photo = portrait ? [[0, 0], [W * 0.02, 0], [W, H * 0.78], [W, H], [0, H]] : [[0, 0], [W * 0.04, 0], [W * 0.84, H], [0, H]];
            const mint = portrait ? [[W * 0.02, 0], [W, 0], [W, H * 0.78]] : [[W * 0.04, 0], [W, 0], [W, H], [W * 0.84, H]];
            const fo = p.focus || [0.5, 0.5];
            G.save(); P0.clipPoly(G, photo); P0.cover(G, cv, 0, 0, W, H, { zoom: 1.08 + kl * 0.02, fx: fo[0], fy: fo[1] }); G.restore();
            const size = Math.min(S * (portrait ? 0.15 : 0.19), W * (portrait ? 0.72 : 0.52) / wr), d = kl * S * 0.05;
            const cx = W * (portrait ? 0.5 : 0.46) + d, cy = H * (portrait ? 0.46 : 0.47) - d * 0.55;
            G.save(); P0.clipPoly(G, photo); drawText(size, cx, cy, P.light, P.light); G.restore();
            G.save(); P0.clipPoly(G, mint); drawText(size, cx, cy, P.ink, P.ink); G.restore();
          }
          /* esquina: renglones chicos que se escriben letra a letra */
          const cs = S * 0.021, n = Math.floor(clamp((lt - 0.05) / 0.5) * 14);
          let used = 0;
          (p.corner || []).forEach((ln, i) => {
            const k = Math.max(0, Math.min(ln.length, n - used)); used += ln.length;
            P0.text(G, ln.slice(0, k), W - S * 0.07, H * 0.1 + S * 0.015 + i * cs * 1.25, { font: P0.font(cs, 800, "normal"), color: i ? P0.rgba(P.mid, 0.55) : P.ink, align: "right" });
          });
          P0.enter(ctx, p.fx, lt, b.i);
        },
      };
    },
  });
})();

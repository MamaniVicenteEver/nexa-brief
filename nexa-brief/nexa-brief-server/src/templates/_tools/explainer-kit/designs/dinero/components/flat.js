/* =============================================================================
   dinero · planos planos: bloque gigante "MONEY TALKS" sobre salvia con barra y
   billete (ref. 8,5–9,4 s), palabra 3D con ojo → cabeza de perfil con tarjeta
   (ref. 9,5–10,5 s) y texto mínimo sobre blanco / negro (ref. 10,6 s y 16,0 s).
   ========================================================================== */
(function () {
  const K = Kit, D = Kit.dinero, { clamp, lerp, prog, ease } = K, TAU = Math.PI * 2;

  /* ------------------------------------------------------------------ bloque gigante */
  K.register({
    name: "dinero.block", tags: ["texto", "impacto", "bloque", "gigante"], layer: "main",
    summary: "Frase en BLOQUE gigante Open Sans 800 verde oscuro sobre salvia (ref. 8,5 s 'MONEY TALKS'): las letras aparecen mientras la cámara panea, una barra verde sube con un billete arriba y garabatos que saltan, el 2º renglón sube con desenfoque y la cámara se aleja hasta llenar el cuadro de borde a borde. Para la frase-tesis o el dato que lo cambia todo.",
    example: { text: "EL DINERO\nMANDA" },
    params: {
      text: { type: "string", required: true, doc: "1–2 renglones cortos con '\\n' (en 9:16 se reparten ≤ 7 letras)." },
      pole: { type: "bool", default: true, doc: "Barra verde con billete arriba que sube entre las letras." },
      ...D.FX("pixel"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage;
      const lines = String(p.text).toUpperCase().split("\n").flatMap(l => portrait ? D.wrap(l, 7) : [l.trim()]).filter(Boolean);
      const nL = lines.length, widest = Math.max(...lines.map(l => D.measure(l, D.SANS(100, 800), -2) / 100));
      const fs = Math.min(W * (portrait ? 0.94 : 0.97) / widest, H * (portrait ? 0.62 : 0.9) / (nL * 0.8));
      const lh = fs * 0.8, cy = H * (portrait ? 0.43 : 0.5), top = cy - (nL * lh) / 2;
      const L = lines.map((s, i) => { const gl = D.glyphs(s, D.SANS(fs, 800), -fs * 0.02); return { s, gl, x0: (W - gl.width) / 2, y: top + (i + 1) * lh - fs * 0.07 }; });
      const n1 = L[0].gl.list.length, step = Math.min(0.06, 0.32 / n1), t2 = 0.06 + n1 * step + 0.08;
      const pi = Math.min(n1 - 1, Math.max(0, Math.floor(n1 / 2))), pg = L[0].gl.list[pi];
      const poleX = L[0].x0 + pg.x + pg.w * 0.5, poleTop = L[0].y - fs * 0.38, pw = fs * 0.11;
      function cam(lt) {
        const q = prog(lt, t2, 0.28, "out"), first = L[0], fx = first.x0 + first.gl.width * clamp(0.15 + lt / (t2 + 0.1) * 0.75);
        return { x: lerp(fx, W / 2, q) - u * 0.6 * Math.max(0, lt - t2), y: lerp(first.y - fs * 0.35, cy, q), z: lerp(1.3, 1, q) + 0.006 * lt, q };
      }
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b), c = cam(lt), dpr = ctx.dpr;
          T.begin(G);
          D.sageBg(G, W, H, P);
          G.save(); G.translate(W / 2, H / 2); G.scale(c.z, c.z); G.translate(-c.x, -c.y);
          G.shadowColor = D.rgba(P.black, 0.28); G.shadowBlur = fs * 0.05 * dpr * c.z; G.shadowOffsetX = fs * 0.03 * dpr * c.z; G.shadowOffsetY = fs * 0.03 * dpr * c.z;
          L.forEach((l, li) => {
            if (li === 0) l.gl.list.forEach((g, i) => {
              const q = prog(lt, 0.06 + i * step, 0.07, "out"); if (q <= 0) return;
              G.save(); G.globalAlpha = q; const gx = l.x0 + g.x + g.w / 2; G.translate(gx, l.y); G.scale(1 + 0.2 * (1 - q), 1 + 0.2 * (1 - q));
              D.text(G, g.c, -g.w / 2, 0, { font: D.SANS(fs, 800), color: P.deep }); G.restore();
            });
            else {
              const q = prog(lt, t2 + (li - 1) * 0.08, 0.16, "out"); if (q <= 0) return;
              const dy = (1 - q) * H * 0.45, n = q < 0.95 ? 3 : 1;
              for (let s = n - 1; s >= 0; s--) D.text(G, l.s, l.x0, l.y + dy + s * (1 - q) * fs * 0.25, { font: D.SANS(fs, 800), color: P.deep, sp: -fs * 0.02, alpha: s ? 0.3 : 1 });
            }
          });
          G.shadowColor = "transparent";
          if (p.pole) {
            const rq = prog(lt, 0, 0.4, "out"), yTop = lerp(H * 1.1, poleTop, rq), x = poleX - pw / 2;
            const gr = G.createLinearGradient(x, 0, x + pw, 0);
            gr.addColorStop(0, D.mix(P.green, P.white, 0.15)); gr.addColorStop(0.35, D.mix(P.green, P.sageLight, 0.35)); gr.addColorStop(1, P.green);
            G.fillStyle = D.rgba(P.black, 0.18); G.fillRect(x + pw * 0.3, yTop + pw * 0.2, pw, H * 2);
            G.fillStyle = gr; G.fillRect(x, yTop, pw, H * 2);
            G.fillStyle = D.mix(P.green, P.white, 0.25); G.beginPath(); G.ellipse(poleX, yTop, pw / 2, pw * 0.16, 0, 0, TAU); G.fill();
            G.save(); G.translate(poleX, yTop - pw * 0.25); G.rotate(-0.06); D.bill(G, -pw * 0.9, -pw * 0.35, pw * 1.8, pw * 0.7, P); G.restore();
            /* garabatos que saltan del tope de la barra */
            const dq = prog(lt, 0.02, 0.6, "out");
            if (dq < 1) {
              G.save(); G.globalAlpha = 1 - prog(lt, 0.35, 0.3); G.strokeStyle = P.black; G.lineCap = "round";
              G.lineWidth = Math.max(1, fs * 0.022);
              const up = dq * fs * 0.35;
              G.beginPath(); G.moveTo(poleX - fs * 0.4, yTop - fs * 0.55 - up); G.lineTo(poleX - fs * 0.33, yTop - fs * 0.38 - up);
              G.moveTo(poleX + fs * 0.42, yTop - fs * 0.6 - up); G.lineTo(poleX + fs * 0.34, yTop - fs * 0.42 - up); G.stroke();
              G.lineWidth = Math.max(1, fs * 0.01);
              for (const [ox, oy, r] of [[-0.5, -0.12, 0.035], [-0.05, -0.2, 0.03], [0.35, -0.15, 0.028]]) { G.beginPath(); G.arc(poleX + ox * fs, yTop + oy * fs - up * 1.4, r * fs, 0, TAU); G.stroke(); }
              G.restore();
            }
          }
          G.restore();
          if (c.q > 0.02 && c.q < 0.6) D.smear(ctx, 0, -u * 2, 3, 0.15);
          T.end(G);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ palabra 3D con ojo → cabeza con tarjeta */
  /** perfil de cabeza mirando a la izquierda (coordenadas 0..1 del alto) */
  const HEAD = [[0.48, 0], [0.3, 0.02], [0.18, 0.1], [0.12, 0.22], [0.1, 0.3], [0.02, 0.4], [0.07, 0.44], [0.08, 0.5], [0.04, 0.54], [0.09, 0.6], [0.1, 0.68], [0.2, 0.72], [0.24, 0.84], [0.18, 1.0], [0.7, 1.0], [0.62, 0.82], [0.66, 0.6], [0.72, 0.42], [0.7, 0.2], [0.62, 0.06]];
  function almond(G, x, y, w, h) { G.beginPath(); G.moveTo(x - w / 2, y); G.quadraticCurveTo(x, y - h, x + w / 2, y - h * 0.1); G.quadraticCurveTo(x, y + h * 0.8, x - w / 2, y); G.closePath(); }
  K.register({
    name: "dinero.head", tags: ["idea", "persona", "mente", "tarjeta", "plano"], layer: "main",
    summary: "Ilustración plana sobre verde salvia (ref. 9,5–10,5 s): primero una palabra 3D chica con ojo de dibujo animado, sonrisa y rayitas; después una CABEZA negra de perfil con un ojo blanco que mira una TARJETA con degradé, marcador, ojo con destello, barra oscura con el lema y fila de rótulos chicos; todo se desliza lento. Para una idea, un plan, una decisión o la mente de alguien.",
    example: { word: "IDEA", text: "INTENTA HASTA LOGRARLO", sub: "LA APUESTA DE DARTMOUTH", chips: ["1956", "10", "2 MESES", "IA"] },
    params: {
      word: { type: "string", default: "", doc: "Palabra 3D del primer tiempo (vacío = sin primer tiempo)." },
      text: { type: "string", required: true, doc: "Lema de la tarjeta (≤ 24 caracteres)." },
      sub: { type: "string", default: "", doc: "Rótulo chico debajo del lema." },
      chips: { type: "array", default: [], doc: "Hasta 4 rótulos mínimos en fila (cifras, palabras)." },
      split: { type: "number", default: 0.55, doc: "Segundo del corte a la cabeza (si hay word)." },
      ...D.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, split = p.word ? p.split : 0;
      const wfs = u * (portrait ? 12 : 10), lema = String(p.text).toUpperCase();
      const card = portrait ? { x: W * 0.06, y: H * 0.2, w: W * 0.86, h: H * 0.2 } : { x: W * 0.05, y: H * 0.27, w: W * 0.52, h: H * 0.3 };
      const hd = portrait ? { x: W * 0.28, y: H * 0.5, h: H * 0.62 } : { x: W * 0.6, y: H * 0.1, h: H * 1.05 };
      const lfs = Math.min(D.fit(lema, card.w * 0.74, 1e9, s => D.SANS(s, 800)), card.h * 0.17);
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G); D.solid(G, W, H, P.flat);
          if (lt < split) {
            const x = W * 0.42 - u * 2 * lt, y = H * 0.48 + u * lt, wd = D.measure(p.word.toUpperCase(), D.SANS(wfs, 800));
            for (let i = 7; i >= 1; i--) D.text(G, p.word.toUpperCase(), x - wd / 2 + i * wfs * 0.012, y + i * wfs * 0.015, { font: D.SANS(wfs, 800), color: D.mix(P.deep, P.black, 0.5) });
            const gr = G.createLinearGradient(0, y - wfs * 0.7, 0, y); gr.addColorStop(0, D.mix(P.deep, P.sageLight, 0.35)); gr.addColorStop(1, P.deep);
            D.text(G, p.word.toUpperCase(), x - wd / 2, y, { font: D.SANS(wfs, 800), color: gr });
            const lk = Math.sin(lt * 5) * 0.5;
            D.googly(G, x + wd / 2 + wfs * 0.55, y - wfs * 0.25, wfs * 0.32, lk, 0.2, P);
            G.save(); G.strokeStyle = P.black; G.lineWidth = Math.max(1.5, u * 0.3); G.lineCap = "round";
            G.beginPath(); G.arc(x - wd / 2 - wfs * 0.05, y + wfs * 0.18, wfs * 0.15, 0.2, Math.PI - 0.2); G.stroke();
            G.fillStyle = P.black; for (const dx of [-0.15, 0.05]) { G.beginPath(); G.arc(x - wd / 2 + dx * wfs - wfs * 0.05, y + wfs * 0.12, u * 0.45, 0, TAU); G.fill(); }
            G.restore();
            const sq = prog(lt, 0.03, 0.25, "out");
            D.sparks(G, x - wd / 2 - wfs * 0.1, y - wfs * 0.75, wfs * (0.15 + sq * 0.2), wfs * (0.35 + sq * 0.3), 5, -2.6, D.rgba(P.white, 1 - prog(lt, 0.25, 0.25)), Math.max(1.5, u * 0.35));
            G.save(); G.translate(W * 0.12, H * 0.8); G.rotate(lt * 2); G.fillStyle = P.black; G.fillRect(-u * 1.6, -u * 1.6, u * 3.2, u * 3.2); G.fillStyle = P.deep; G.fillRect(-u * 1.6, -u * 1.6, u * 1.2, u * 3.2); G.restore();
          } else {
            const l2 = lt - split, sl = -u * 1.2 * l2;
            G.save(); G.translate(sl, 0);
            /* cabeza */
            const s = hd.h, hx = hd.x + u * 3 * (1 - prog(l2, 0, 0.18, "out")), hy = hd.y;
            G.fillStyle = D.mix(P.black, P.feltDark, 0.3); G.beginPath(); HEAD.forEach(([a, c], i) => (i ? G.lineTo(hx + a * s, hy + c * s) : G.moveTo(hx + a * s, hy + c * s))); G.closePath(); G.fill();
            const ex = hx + 0.3 * s, ey = hy + 0.2 * s;
            G.fillStyle = P.white; almond(G, ex, ey, s * 0.2, s * 0.11); G.fill();
            G.fillStyle = P.leaf; G.beginPath(); G.arc(ex - s * 0.02 + Math.sin(l2 * 1.5) * s * 0.01, ey - s * 0.012, s * 0.028, 0, TAU); G.fill();
            /* tarjeta */
            const cq = prog(l2, 0.02, 0.2, "out"), c = card;
            G.save(); G.globalAlpha = cq; G.translate(-(1 - cq) * u * 4, 0);
            G.fillStyle = P.black; G.fillRect(c.x + c.w * 0.1, c.y - c.h * 0.08, c.w * 0.75, Math.max(1, u * 0.2));
            const g2 = G.createLinearGradient(c.x, 0, c.x + c.w, 0); g2.addColorStop(0, P.sageLight); g2.addColorStop(1, P.white);
            G.fillStyle = g2; G.fillRect(c.x, c.y, c.w, c.h * 0.55);
            G.fillStyle = P.deep; G.beginPath(); G.moveTo(c.x + c.w * 0.07, c.y); G.lineTo(c.x + c.w * 0.1, c.y); G.lineTo(c.x + c.w * 0.1, c.y + c.h * 0.28); G.lineTo(c.x + c.w * 0.085, c.y + c.h * 0.22); G.lineTo(c.x + c.w * 0.07, c.y + c.h * 0.28); G.closePath(); G.fill();
            G.strokeStyle = P.black; G.lineWidth = Math.max(1, u * 0.2); G.beginPath();
            for (let i = 0; i < 4; i++) G.lineTo(c.x + c.w * 0.95 + (i % 2 ? u * 0.8 : 0), c.y + c.h * (0.15 + i * 0.08)); G.stroke();
            G.fillStyle = P.black; G.fillRect(c.x + c.w * 0.12, c.y + c.h * 0.58, c.w * 0.85, c.h * 0.24);
            D.text(G, lema, c.x + c.w * 0.14, c.y + c.h * 0.58 + c.h * 0.12 + lfs * 0.36, { font: D.SANS(lfs, 800), color: D.mix(P.sage, P.white, 0.25) });
            /* ojo con destello a la izquierda de la barra */
            const ox = c.x + c.w * 0.06, oy = c.y + c.h * 0.7, orr = c.h * 0.11;
            D.sparks(G, ox, oy, orr * 1.2, orr * 2.1, 8, l2 * 0.6, P.black, Math.max(1, u * 0.18));
            G.fillStyle = P.black; G.beginPath(); G.arc(ox, oy, orr, 0, TAU); G.fill();
            G.fillStyle = P.sageLight; G.beginPath(); G.arc(ox, oy, orr * 0.62, 0, TAU); G.fill();
            G.fillStyle = P.black; G.beginPath(); G.arc(ox, oy, orr * 0.28, 0, TAU); G.fill();
            if (p.sub) D.text(G, String(p.sub).toUpperCase(), c.x + c.w * 0.12, c.y + c.h * 0.93, { font: D.SANS(Math.max(u * 1.8, c.h * 0.075), 800), color: P.black });
            (p.chips || []).slice(0, 4).forEach((s2, i) => {
              const q = prog(l2, 0.15 + i * 0.06, 0.1); if (q <= 0) return;
              D.text(G, String(s2).toUpperCase(), c.x + c.w * (0.42 + i * 0.13), c.y + c.h * 1.1, { font: D.SANS(Math.max(u * 1.8, c.h * 0.07), 800), color: P.white, alpha: q, align: "center" });
            });
            G.fillStyle = P.black; G.fillRect(c.x + c.w * 0.92, c.y + c.h * 0.98, u * 2.4, u * 1.6); G.fillStyle = P.white; G.fillRect(c.x + c.w * 0.92 + u * 0.4, c.y + c.h * 0.98 + u * 0.6, u * 1.6, u * 0.3);
            G.restore();
            G.restore();
          }
          T.end(G);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ texto mínimo */
  K.register({
    name: "dinero.note", tags: ["texto", "mínimo", "pausa", "respiro"], layer: "main",
    summary: "Texto MÍNIMO en Open Sans 800 sobre blanco, negro o salvia (ref. 10,6 s 'MONEY / TALKS!' y 16,0 s 'HUH!'): los renglones se tipean escalonados hacia la derecha y el grupo salta a la izquierda y vuelve (en blanco) o queda quieto (en negro). Para una pausa, una reacción corta o un dato aireado.",
    example: { text: "¿Y AHORA?", bg: "black" },
    params: {
      text: { type: "string", required: true, doc: "1–3 renglones muy cortos con '\\n' (cada uno se corre a la derecha)." },
      bg: { type: "enum", options: ["white", "black", "sage"], default: "white", doc: "Fondo: white = tarjeta blanca (texto verde oscuro), black = negro verdoso (texto blanco), salvia." },
      size: { type: "number", default: 1, min: 0.5, max: 2.5, doc: "Escala del texto (1 = legible en celular; la referencia es más chica)." },
      ...D.FX("cut"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, lines = String(p.text).toUpperCase().split("\n").filter(Boolean);
      const fs = u * (portrait ? 7 : 5.5) * p.size, bg = { white: P.white, black: P.black, sage: P.flat }[p.bg], col = { white: P.deep, black: P.white, sage: P.black }[p.bg];
      const wd = Math.max(...lines.map((l, i) => D.measure(l, D.SANS(fs, 800)) + i * fs * 0.9));
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G); D.solid(G, W, H, bg);
          let dx = 0;
          if (p.bg === "white") dx = -W * 0.2 * (prog(lt, 0.35, 0.08, "out") - prog(lt, 0.5, 0.06, "out")) - W * 0.18 * prog(lt, 0.9, 0.12, "out") - u * 0.5 * lt;
          const x0 = W / 2 - wd / 2 + dx, y0 = H * (portrait ? 0.42 : 0.5) - (lines.length - 1) * fs * 0.5;
          lines.forEach((l, i) => {
            const t0 = i ? 0.5 + (i - 1) * 0.25 : 0, n = Math.floor(clamp((lt - t0) / Math.max(0.05, l.length * 0.04)) * l.length + (lt >= t0 ? 1 : 0));
            if (lt < t0) return;
            D.text(G, l.slice(0, n), x0 + i * fs * 0.9, y0 + i * fs * 1.0 + fs * 0.36, { font: D.SANS(fs, 800), color: col });
          });
          T.end(G);
        },
      };
    },
  });
})();

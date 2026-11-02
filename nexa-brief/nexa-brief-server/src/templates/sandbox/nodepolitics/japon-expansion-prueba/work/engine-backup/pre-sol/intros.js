/* =============================================================================
   imperio · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = "golpe": el SOL carmesí cae sobre el país foco (de 3× a su tamaño, con
             sacudida), los rayos estallan en 360° y el titular condensado blanco entra
             palabra por palabra con estela; '^x^' va sobre una franja carmesí. Impacto
             (burstAt): los rayos se abren hasta los bordes, destello claro y sacudida.
   introv2 = "pregunta + revelación": la pregunta se escribe carácter a carácter como el
             título en idioma original de la referencia (escala + fantasma); en stampAt
             la pregunta sube y se achica, el sol SALE desde abajo detrás del centro con su
             abanico de rayos y la respuesta SUBE con el degradé del título condensado.
   Fondos propios (neutros, sirven para cualquier tema):
     atlas   el atlas en color sobre `country` (o el mundo), zoom lento
     archivo el atlas en gris con humo oscuro desde arriba
     papel   océano liso del atlas con relieve tenue, sin tierra (lo más limpio)
   + image (foto en B/N fundida) / component / none del contrato común (designs/common/hook.js).
   Utilidades compartidas con outro.js en Kit.imperio.hook. Todo es función pura de lt.
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, IM = Kit.imperio, { clamp, lerp, prog, ease } = K;
  const WHITE = "#f6f6f8", CRIMSON = "#a3122f", INK = "#0f1a24";

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ ^JAPÓN^\nMIRÓ AL SUR?" → renglones de palabras {w, acc} */
  function words(text) {
    return String(text ?? "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const out = []; let acc = false;
      for (const part of line.split("^")) { for (const w of part.split(/\s+/).filter(Boolean)) out.push({ w: w.toUpperCase(), acc }); acc = !acc; }
      return out;
    });
  }
  /** maqueta del titular: tamaño para que el renglón más ancho ocupe `width` */
  function layout(lines, width, maxFs) {
    const sp = 0.22, m = l => l.reduce((a, x, i) => a + IM.measure(x.w, IM.wordFont(100), 1) / 100 + (i ? sp : 0), 0);
    const em = Math.max(1, ...lines.map(m)), fs = Math.min(maxFs, width / em), lh = fs * 1.04;
    return { fs, lh, lines: lines.map(l => { let x = 0; const ws = l.map((it, i) => { if (i) x += sp * fs; const w = IM.measure(it.w, IM.wordFont(fs), fs * 0.01); const o = { s: it.w, acc: it.acc, x, w }; x += w; return o; }); return { ws, w: x }; }) };
  }
  /** kicker: barra carmesí + mayúsculas espaciadas */
  function kicker(G, txt, x, y, fs, a, align = "center", color = WHITE) {
    if (!txt || a <= 0.01) return;
    const s = String(txt).toUpperCase();
    G.save(); G.globalAlpha = a; G.font = `800 ${fs}px Montserrat`; G.letterSpacing = fs * 0.22 + "px"; G.textBaseline = "middle";
    const w = IM.measure(s, G.font, fs * 0.22), bw = fs * 1.6, gap = fs * 0.7, total = w + (bw + gap) * 2;
    const x0 = align === "center" ? x - total / 2 : x;
    G.fillStyle = CRIMSON; G.fillRect(x0, y - fs * 0.09, bw, fs * 0.18); G.fillRect(x0 + bw + gap * 2 + w, y - fs * 0.09, bw, fs * 0.18);
    G.shadowColor = "rgba(8,10,12,.75)"; G.shadowBlur = fs * 0.6; G.fillStyle = color; G.textAlign = "left"; G.fillText(s, x0 + bw + gap, y);
    G.restore();
  }
  /** sacudida amortiguada después de cada golpe (función de lt) */
  function shake(lt, hits, amp) {
    let x = 0, y = 0;
    for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.45) { const e = Math.exp(-d * 9) * amp; x += Math.sin(d * 71) * e; y += Math.cos(d * 53) * e * 0.7; } }
    return [x, y];
  }

  /* ------------------------------------------------------------ fondos propios */
  function presets(ctx, p) {
    const MC = IM.mapCache(ctx), st = ctx.stage;
    const base = p.country ? IM.countryCam(p.country, 3.2, 0) : { lon: 30, lat: 32, span: 110, rot: 0 };
    const atlas = (gray, smoke) => (G, s, lt, b) => {
      const q = clamp(lt / Math.max(3, b.dur)), cam = IM.zoomCam(base, 1 + 0.18 * q, 2 * q), n = Math.floor(q * 3);
      MC.draw(G, cam, IM.zoomCam(base, 1 + 0.18 * (n + 0.5) / 3, 2 * (n + 0.5) / 3), `${gray}:${n}`, { hatch: p.country ? [p.country] : [], gray });
      if (smoke) { IM.smoke(G, s, lt + b.t0, 0.9, s.portrait ? 0.45 : 0.6); IM.fx.grain = Math.max(IM.fx.grain, 0.2); IM.fx.vignette = Math.max(IM.fx.vignette, 0.85); }
    };
    return {
      atlas: atlas(0, false),
      archivo: atlas(1, true),
      papel: (G, s, lt) => {
        const T = IM.tex(); G.fillStyle = IM.COL.ocean; G.fillRect(0, 0, s.W, s.H);
        G.save(); const pat = G.createPattern(T.ocean, "repeat"); pat.setTransform(new DOMMatrix().translate(-lt * s.u * 0.6, 0).scale(Math.max(s.W, s.H) / 512 * 1.3));
        G.globalCompositeOperation = "soft-light"; G.fillStyle = pat; G.fillRect(0, 0, s.W, s.H); G.restore();
      },
      __free: () => MC.free(),
    };
  }
  /** oscurecido del centro para leer el texto blanco */
  function scrim(G, st, a) {
    if (a <= 0.01) return;
    const { W, H } = st, g = G.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.1, W / 2, H * 0.48, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, `rgba(10,12,14,${0.42 * a})`); g.addColorStop(1, `rgba(10,12,14,${0.12 * a})`);
    G.save(); G.fillStyle = g; G.fillRect(0, 0, W, H); G.restore();
  }
  const PRESETS = ["atlas", "archivo", "papel"];
  function background(ctx, p) {
    const pr = presets(ctx, p), free = pr.__free; delete pr.__free;
    const BG = K.hook.bg(ctx, p, { auto: "atlas", presets: pr, tone: () => IM.bw(ctx, p.src) });
    return { ...BG, mode: BG.mode, render: BG.render, dispose() { BG.dispose(); free(); } };
  }
  IM.hook = { words, layout, kicker, shake, presets, scrim, background, PRESETS, COL: { WHITE, CRIMSON, INK } };

  /* ============================================================ introv1 · golpe */
  K.register({
    name: "imperio.introv1", tags: ["intro", "gancho", "apertura", "título", "impacto", "sol"], layer: "main", post: 0.6, opaque: true,
    summary: "GANCHO de apertura: sobre el atlas el SOL carmesí CAE (de 3× a su tamaño, con sacudida) y sus rayos estallan en 360°; el titular condensado blanco entra palabra por palabra con estela ('^palabra^' sobre franja carmesí); en burstAt los rayos se abren hasta los bordes con destello y sacudida. Fondo adaptable (bg: atlas | archivo | papel | image con src | component con use/useParams | none).",
    example: { text: "EL IMPERIO QUE\nMIRÓ AL ^SUR^", kicker: "Tokio · 1940", sub: "la doctrina que llevó a la guerra del Pacífico", country: "Japan" },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho (2–7 palabras). '\\n' = renglón; '^x^' = palabras sobre franja carmesí." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea chica en itálica debajo del titular." },
      country: { type: "string", default: "", doc: "País foco del fondo atlas/archivo (rayado, el sol cae sobre él). Vacío = mundo y sol al centro." },
      sunAt: { type: "number", default: 0.15, doc: "Segundo en que cae el sol." },
      wordAt: { type: "number", default: 0.7, doc: "Segundo de la primera palabra." },
      stagger: { type: "number", default: 0.2, min: 0.06, doc: "Segundos entre palabras." },
      burstAt: { type: "number", default: 2.6, doc: "Impacto: los rayos llegan a los bordes (acepta '@palabra'; −1 = sin impacto)." },
      ...K.hook.bgParams(PRESETS),
      dim: { type: "number", default: 0.35, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente." },
    },
    create(ctx, p) {
      const st = ctx.stage, { W, H, u, portrait } = st, BG = background(ctx, p);
      const L = layout(words(p.text), W * (portrait ? 0.86 : 0.7), portrait ? H * 0.085 : H * 0.17);
      const blockH = L.lh * L.lines.length, cy = H * (portrait ? 0.56 : 0.58), top = cy - blockH / 2;
      const sp = p.country ? IM.point(p.country) : null;
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main;
          BG.render(lt, b, t);
          /* sol: posición en el atlas si hay país, si no arriba al centro */
          let sx = W / 2, sy = H * (portrait ? 0.3 : 0.3);
          if (sp && (BG.mode === "atlas" || BG.mode === "archivo")) {
            const base = IM.countryCam(p.country, 3.2, 0), q = clamp(lt / Math.max(3, b.dur)), V = IM.view(st, IM.zoomCam(base, 1 + 0.18 * q, 2 * q));
            [sx, sy] = V.pt(sp[0], sp[1]);
          }
          scrim(G, st, 1);
          const sq = prog(lt, p.sunAt, 0.42, "expoOut"), R = u * (portrait ? 7 : 6.5), burst = p.burstAt >= 0 ? prog(lt, p.burstAt, 0.7, "out") : 0;
          const [hx, hy] = shake(lt, [p.sunAt + 0.38, ...(p.burstAt >= 0 ? [p.burstAt] : [])], u * 1.2);
          G.save(); G.translate(hx, hy);
          if (sq > 0) {
            IM.rays(G, sx, sy, { n: 32, rot: lt * 0.05, dir: Math.PI / 2, focus: 0.15, len: Math.max(W, H) * (0.28 + 0.75 * burst), r0: R * 1.02, grow: prog(lt, p.sunAt + 0.3, 0.8, "out"), t: lt, alpha: 0.8, colors: IM.flagFor(p.country)?.rays });
            IM.sun(G, sx, sy, R * (1 + 2 * (1 - sq)), t, { alpha: clamp(sq * 3), flag: IM.flagFor(p.country) });
          }
          /* titular palabra por palabra */
          let k = 0;
          G.font = IM.wordFont(L.fs); G.letterSpacing = L.fs * 0.01 + "px"; G.textBaseline = "alphabetic"; G.textAlign = "left";
          L.lines.forEach((ln, li) => {
            const x0 = W / 2 - ln.w / 2, yb = top + L.lh * (li + 0.86);
            ln.ws.forEach(w => {
              const q = prog(lt, p.wordAt + k * p.stagger, 0.32, "linear"); k++;
              if (q <= 0) return;
              const e = ease.expoOut(q), s = 1 + 0.45 * (1 - e), cx = x0 + w.x + w.w / 2;
              G.save(); G.translate(cx, yb - L.fs * 0.4); G.scale(s, s); G.translate(-cx, -(yb - L.fs * 0.4));
              if (w.acc) { const pad = L.fs * 0.12; G.globalAlpha = clamp(q * 4); G.fillStyle = CRIMSON; G.fillRect(x0 + w.x - pad, yb - L.fs * 0.86, (w.w + pad * 2) * clamp(q * 2), L.fs * 0.98); }
              G.shadowColor = "rgba(10,12,14,.55)"; G.shadowBlur = L.fs * 0.1;
              for (let g = 2; g >= 0; g--) { G.globalAlpha = g ? 0.25 * (1 - e) / g : clamp(q * 4); G.fillStyle = WHITE; G.fillText(w.s, x0 + w.x, yb + g * L.fs * 0.09 * (1 - e)); }
              G.restore();
            });
          });
          G.restore();
          /* kicker y sub */
          kicker(G, p.kicker, W / 2, top - u * (portrait ? 4.5 : 4), u * (portrait ? 2.4 : 1.8), prog(lt, p.wordAt - 0.25, 0.4));
          if (p.sub) {
            const fs = u * (portrait ? 2.8 : 2.1), a = prog(lt, p.wordAt + k * p.stagger + 0.1, 0.5);
            G.save(); G.globalAlpha = a; G.font = `italic 500 ${fs}px Montserrat`; G.letterSpacing = fs * 0.08 + "px"; G.textAlign = "center"; G.textBaseline = "top";
            G.shadowColor = "rgba(8,10,12,.85)"; G.shadowBlur = fs * 0.6; G.fillStyle = "rgba(246,246,248,.92)"; G.fillText(p.sub, W / 2, top + blockH + u * 2, W * 0.9); G.restore();
          }
          /* destello claro del impacto */
          if (burst > 0 && burst < 1) { const a = Math.sin(Math.PI * Math.min(1, burst * 1.6)) * 0.4; ctx.g.top.save(); ctx.g.top.fillStyle = `rgba(255,248,240,${a})`; ctx.g.top.fillRect(0, 0, W, H); ctx.g.top.restore(); }
        },
      };
    },
  });
  /* ============================================================ introv2 · pregunta + revelación */
  K.register({
    name: "imperio.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "revelación", "sol naciente"], layer: "main", post: 0.6, opaque: true,
    summary: "GANCHO pregunta + revelación: la pregunta se escribe carácter a carácter como el título en idioma original de la referencia (cada letra entra con escala y fantasma); en stampAt la pregunta sube y se achica, el SOL carmesí sale desde abajo detrás del centro con su abanico de rayos y la RESPUESTA sube en condensada blanca con degradé. Fondo adaptable (bg: atlas | archivo | papel | image con src | component con use/useParams | none).",
    example: { text: "¿POR QUÉ UN IMPERIO\nMIRÓ HACIA EL SUR?", kicker: "Pacífico · 1940", stamp: "PETRÓLEO", stampAt: 2.6, country: "Japan", bg: "archivo" },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      stamp: { type: "string", default: "", doc: "Respuesta (1–3 palabras) que sube con el sol (vacío = sin revelación)." },
      stampAt: { type: "number", default: 2.6, doc: "Segundo de la revelación (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.35, doc: "Segundo en que empieza a escribirse la pregunta." },
      cps: { type: "number", default: 18, min: 4, doc: "Caracteres por segundo." },
      country: { type: "string", default: "", doc: "País foco del fondo atlas/archivo." },
      ...K.hook.bgParams(PRESETS),
      dim: { type: "number", default: 0.35, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente." },
    },
    create(ctx, p) {
      const st = ctx.stage, { W, H, u, portrait } = st, BG = background(ctx, p);
      const Q = IM.wordLayout(p.text, W * (portrait ? 0.86 : 0.66), portrait ? H * 0.07 : H * 0.13);
      const A = p.stamp ? IM.wordLayout(p.stamp, W * (portrait ? 0.8 : 0.5), portrait ? H * 0.11 : H * 0.22) : null;
      /* posiciones de cada carácter de la pregunta (se miden una vez) */
      const font = IM.wordFont(Q.fs), qTop = H * (portrait ? 0.44 : 0.5) - Q.h / 2, chars = [];
      Q.lines.forEach((ln, li) => {
        const lw = IM.measure(ln, font, Q.fs * 0.01), arr = Array.from(ln); let x = W / 2 - lw / 2;
        arr.forEach(c => { const cw = IM.measure(c, font, Q.fs * 0.01); chars.push({ c, x, y: qTop + Q.lh * (li + 0.86), w: cw }); x += cw; });
      });
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main;
          BG.render(lt, b, t); scrim(G, st, 1);
          const rq = A ? prog(lt, p.stampAt, 0.7, "inOut") : 0, ty = -H * (portrait ? 0.2 : 0.27) * rq, sc = 1 - 0.42 * rq, ox = W / 2, oy = H * 0.45;
          const [hx, hy] = shake(lt, A ? [p.stampAt + 0.55] : [], u * 1);
          kicker(G, p.kicker, W / 2, qTop + ty - u * (portrait ? 5 : 4.5) * sc, u * (portrait ? 2.4 : 1.8), prog(lt, 0.05, 0.4));
          /* pregunta carácter a carácter (a 24 cuadros/s) */
          const nf = (Math.floor(lt * 24) / 24 - p.typeAt) * p.cps;
          G.save(); G.translate(ox, oy + ty); G.scale(sc, sc); G.translate(-ox, -oy);
          G.font = font; G.letterSpacing = Q.fs * 0.01 + "px"; G.textBaseline = "alphabetic"; G.textAlign = "left";
          G.shadowColor = "rgba(8,10,12,.6)"; G.shadowBlur = Q.fs * 0.1;
          chars.forEach((ch, i) => {
            const q = clamp((nf - i) / 3); if (q <= 0) return;
            const e = ease.out(q), s = 1 + 0.3 * (1 - e);
            G.save(); G.translate(ch.x + ch.w / 2, ch.y - Q.fs * 0.4); G.scale(s, s); G.translate(-(ch.x + ch.w / 2), -(ch.y - Q.fs * 0.4));
            if (q < 1) { G.globalAlpha = 0.25 * (1 - e); G.fillStyle = WHITE; G.fillText(ch.c, ch.x, ch.y + Q.fs * 0.08); }
            G.globalAlpha = e * (1 - 0.25 * rq); G.fillStyle = WHITE; G.fillText(ch.c, ch.x, ch.y); G.restore();
          });
          G.restore();
          /* revelación: el sol sale desde abajo con su abanico y la respuesta sube */
          if (A && lt >= p.stampAt) {
            const cy = H * (portrait ? 0.56 : 0.6), sq = prog(lt, p.stampAt, 0.9, "out"), R = u * (portrait ? 9 : 8.5);
            const sy = lerp(H + R * 2, cy - A.h * 0.12, sq);
            G.save(); G.translate(hx, hy);
            IM.rays(G, W / 2, sy, { n: 30, rot: lt * 0.04, dir: Math.PI / 2, focus: 0.1, len: Math.max(W, H) * 0.75, r0: R, grow: prog(lt, p.stampAt + 0.4, 0.9, "out"), t: lt, alpha: 0.78, colors: IM.flagFor(p.country)?.rays });
            IM.sun(G, W / 2, sy, R, t, { flag: IM.flagFor(p.country) });
            IM.word(G, st, { layout: A, x: W / 2, y: cy + A.h * 0.12, at: p.stampAt + 0.45 }, lt);
            G.restore();
          }
        },
      };
    },
  });
})();

/* =============================================================================
   binary · cierre v1 para NODETECH
   ----------------------------------------------------------------------------
   Secuencia: gracias → canal en glifos → LIKE plano activo → suscripción.
   El LIKE conserva su lectura limpia; la notificación usa un icono directo
   de trazo para que la silueta se lea de inmediato.
   ========================================================================== */
(function () {
  const K = Kit, B = Kit.binary, { clamp, prog } = K;
  const NS = "http://www.w3.org/2000/svg";

  /* Los navegadores pueden bloquear el audio iniciado por el cargador asíncrono.
     El primer gesto del usuario lo desbloquea; el reloj sigue siendo audio.currentTime. */
  if (!window.__kitAudioUnlockInstalled && !document.querySelector("script[data-noboot]")) {
    const audio = document.getElementById("audio");
    if (audio) {
      window.__kitAudioUnlockInstalled = true;
      const unlock = () => {
        if (!audio.src) return;
        if (!audio.paused) { document.removeEventListener("pointerdown", unlock, true); return; }
        audio.play().then(() => document.removeEventListener("pointerdown", unlock, true)).catch(() => {});
      };
      document.addEventListener("pointerdown", unlock, true);
    }
  }

  const svg = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };

  function wrap(text, max) {
    const lines = [""];
    for (const word of String(text).split(/\s+/)) {
      const cur = lines[lines.length - 1];
      if (cur && (cur + " " + word).length > max) lines.push(word);
      else lines[lines.length - 1] = cur ? cur + " " + word : word;
    }
    return lines;
  }

  function cleanLike(parent, cx, by, u, P) {
    const g = svg("g", { opacity: 0 }, parent);
    const bw = u * 32, bh = u * 9, x = cx - bw / 2, y = by - bh / 2;
    const bg = svg("rect", { x, y, width: bw, height: bh, rx: u * 1.4, fill: P.bg2, stroke: P.ink, "stroke-width": Math.max(1, u * 0.18) }, g);
    const icon = svg("path", {
      d: "M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z",
      transform: `translate(${x + u * 3.2} ${y + u * 1.05}) scale(${u * 0.27})`,
      fill: P.ink,
    }, g);
    const label = svg("text", { x: cx + u * 3.1, y: by + u * 0.55, fill: P.ink, "font-family": "Inter, sans-serif", "font-size": u * 2.7, "font-weight": 900, "text-anchor": "middle" }, g);
    label.textContent = "LIKE";
    const check = svg("text", { x: cx + bw * 0.34, y: by + u * 0.65, fill: P.bg, "font-family": "Inter, sans-serif", "font-size": u * 2.4, "font-weight": 900, "text-anchor": "middle", opacity: 0 }, g);
    check.textContent = "✓";
    const ripple = svg("circle", { cx, cy: by, r: u * 4, fill: "none", stroke: P.ink, "stroke-width": u * 0.35, opacity: 0 }, parent);
    return { g, bg, icon, label, check, ripple };
  }

  /* Icono directo compacto: otra silueta, más pequeña y con un punto de alerta
     para que se lea como notificación incluso en un encuadre amplio. */
  function directNotification(parent, cx, cy, u, C) {
    const g = svg("g", { opacity: 0, "data-component": "binary-outro-notification" }, parent);
    const s = u * 0.58, stroke = { fill: "none", stroke: C.ink, "stroke-width": s * 0.72, "stroke-linecap": "round", "stroke-linejoin": "round" };
    const body = svg("path", { d: `M${cx} ${cy - s * 5}C${cx - s * 3.1} ${cy - s * 5} ${cx - s * 4.7} ${cy - s * 2.7} ${cx - s * 4.7} ${cy - s * 0.1}V${cy + s * 2.5}L${cx - s * 5.8} ${cy + s * 4.1}H${cx + s * 5.8}L${cx + s * 4.7} ${cy + s * 2.5}V${cy - s * 0.1}C${cx + s * 4.7} ${cy - s * 2.7} ${cx + s * 3.1} ${cy - s * 5} ${cx} ${cy - s * 5}Z`, fill: C.ink }, g);
    const cutout = svg("path", { d: `M${cx} ${cy - s * 3.7}C${cx - s * 2.1} ${cy - s * 3.7} ${cx - s * 3.2} ${cy - s * 1.8} ${cx - s * 3.2} ${cy + s * 0.1}V${cy + s * 2.8}H${cx + s * 3.2}V${cy + s * 0.1}C${cx + s * 3.2} ${cy - s * 1.8} ${cx + s * 2.1} ${cy - s * 3.7} ${cx} ${cy - s * 3.7}Z`, fill: C.bg }, g);
    const clapper = svg("path", { d: `M${cx - s * 1.3} ${cy + s * 4.7}Q${cx} ${cy + s * 6.2} ${cx + s * 1.3} ${cy + s * 4.7}`, fill: "none", stroke: C.ink, "stroke-width": s * 0.72, "stroke-linecap": "round" }, g);
    const leftWave = svg("path", { d: `M${cx - s * 6.8} ${cy - s * 2.6}Q${cx - s * 8.4} ${cy - s * 0.8} ${cx - s * 7.4} ${cy + s * 1.1}`, ...stroke }, g);
    const rightWave = svg("path", { d: `M${cx + s * 6.8} ${cy - s * 2.6}Q${cx + s * 8.4} ${cy - s * 0.8} ${cx + s * 7.4} ${cy + s * 1.1}`, ...stroke }, g);
    const dot = svg("circle", { cx: cx + s * 3.25, cy: cy - s * 3.35, r: s * 0.78, fill: C.ink }, g);
    return { g, body, cutout, clapper, leftWave, rightWave, dot, cx, cy };
  }

  function drawDirectNotification(mark, q, alpha, lt) {
    const reveal = clamp(q);
    mark.g.setAttribute("opacity", (alpha * reveal).toFixed(3));
    const pulse = reveal >= 1 ? 1 + Math.sin(lt * 6) * 0.02 : 0.86 + reveal * 0.14;
    mark.g.setAttribute("transform", `translate(${mark.cx} ${mark.cy}) scale(${pulse.toFixed(3)}) translate(${-mark.cx} ${-mark.cy})`);
    const waves = reveal >= 1 ? 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(lt * 7)) : reveal;
    mark.body.setAttribute("opacity", reveal.toFixed(3));
    mark.cutout.setAttribute("opacity", reveal.toFixed(3));
    mark.clapper.setAttribute("opacity", clamp((reveal - 0.18) / 0.55).toFixed(3));
    mark.leftWave.setAttribute("opacity", (waves * 0.95).toFixed(3));
    mark.rightWave.setAttribute("opacity", (waves * 0.95).toFixed(3));
    mark.dot.setAttribute("opacity", (reveal * waves).toFixed(3));
  }

  K.register({
    name: "binary.outrov1", tags: ["cierre", "canal", "like", "suscribirse"], layer: "main",
    summary: "Cierre v1 para NODETECH: canal en glifos, LIKE plano que se activa y desaparece, suscripción y notificación directa.",
    example: {
      thanks: "GRACIAS POR VER",
      channel: "NODETECH",
      cta: "SUSCRÍBETE",
      support: "Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado.",
    },
    params: {
      thanks: { type: "string", default: "GRACIAS POR VER", doc: "Línea superior." },
      channel: { type: "string", default: "NODETECH", doc: "Nombre del canal, dibujado con glifos." },
      cta: { type: "string", default: "SUSCRÍBETE", doc: "Texto del botón." },
      support: { type: "string", default: "Tu apoyo hace posible que sigamos trayendo nuevas historias y miradas sobre el pasado.", doc: "Texto de apoyo inferior." },
      handle: { type: "string", default: "youtube.com/@nodetech", doc: "Usuario del canal." },
      morph: { type: "number", default: 1.2, doc: "Segundos de armado del nombre." },
      likeAt: { type: "number", default: 1, doc: "Segundo de la voz en que aparece el like." },
      subscribeAt: { type: "number", default: 2.5, doc: "Segundo de la voz en que aparece suscríbete." },
      bellAt: { type: "number", default: 3.25, doc: "Segundo de la voz en que aparece la campana." },
      supportAt: { type: "number", default: 3.65, doc: "Segundo de la voz en que aparece el mensaje de apoyo." },
    },
    points(ctx, p) {
      const { W, H, portrait } = ctx.stage, w = W * 0.82, h = portrait ? H * 0.2 : H * 0.26;
      const yName = (portrait ? H * 0.36 : H * 0.31) + (portrait ? 0 : 20);
      return B.pack(B.sampleText(p.channel, { x: (W - w) / 2, y: yName - h / 2, w, h }, { fit: "lines", cell: B.cellOf(ctx, 0.8), jitter: 0.2, alpha: 0.95, edge: true }), ctx.family.binary.N);
    },
    motion: lt => ({ s: 1 + lt * 0.004 }),
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const C = ctx.C.palette, { W, H, u, portrait } = ctx.stage;
      const root = svg("g", {}, ctx.layers.svg);
      const yName = (portrait ? H * 0.36 : H * 0.31) + (portrait ? 0 : 20), hName = portrait ? H * 0.2 : H * 0.26;
      const by = yName + hName / 2 + u * (portrait ? 11 : 9);
      const like = cleanLike(root, W / 2, by, u, C);
      /* En escritorio el bloque final baja 20 px para respirar mejor del nombre. */
      const subY = by + (portrait ? 0 : 20);
      const tagText = p.cta, tagFs = 2.4 * u * B.textScale;
      const measure = ctx.g.top; measure.save(); measure.font = `600 ${tagFs}px 'JetBrains Mono', monospace`;
      const subW = measure.measureText(tagText).width + tagFs * 1.2; measure.restore();
      const bell = directNotification(root, W / 2 + subW / 2 + u * 8, subY, u, C);
      /* La campana queda cerca del borde derecho, con aire suficiente para no tocar el botón. */
      const supportSize = portrait ? 1.3 : 1.25 + 4 / (u * B.textScale);
      const supportColor = C.ink;
      const supportLines = wrap(p.support, portrait ? 31 : 74);
      return {
        render(lt, b, t) {
          const G = ctx.g.top, a = B.fadeIO(lt, b.dur + 1, 0.6, 0.4, 0.3), cx = W / 2;
          const scale = Math.min(1, Math.max(.3, (b.dur - .35) / 4.65));
          const likeAt = p.likeAt * scale, subscribeAt = p.subscribeAt * scale;
          const ctaDur = Math.min(.6, b.dur * .12), bellDur = Math.min(.72, b.dur * .16);
          const bellAt = Math.max(p.bellAt * scale, subscribeAt + ctaDur + .04);
          const supportAt = Math.max(p.supportAt * scale, bellAt + bellDur + .04);
          const supportGap = b.dur < 4 ? .04 : .05, supportDur = b.dur < 4 ? .16 : .24;
          B.mono(G, p.thanks, cx, yName - hName / 2 - u * 5, { u, size: 1.8, weight: 700, color: C.ink, alpha: a, spacing: u * 0.5 });

          const likeIn = prog(lt, likeAt, Math.min(.35,b.dur*.1)), likeOut = 1 - prog(lt, subscribeAt, Math.min(.35,b.dur*.1));
          like.g.setAttribute("opacity", (likeIn * likeOut).toFixed(3));
          const likeScale = 0.94 + 0.06 * likeIn, likeDy = Math.sin((lt - likeAt) * 3) * u * 0.12;
          like.g.setAttribute("transform", `translate(${cx} ${by + likeDy}) scale(${likeScale.toFixed(3)}) translate(${-cx} ${-by})`);
          const active = prog(lt, likeAt + Math.min(.28,b.dur*.08), Math.min(.22,b.dur*.07)) >= 1;
          like.bg.setAttribute("fill", active ? C.ink : C.bg2);
          like.icon.setAttribute("fill", active ? C.bg : C.ink);
          like.label.setAttribute("fill", active ? C.bg : C.ink);
          like.check.setAttribute("opacity", prog(lt, likeAt + Math.min(.43,b.dur*.12), Math.min(.2,b.dur*.06)));
          const rippleQ = prog(lt, likeAt + Math.min(.35,b.dur*.1), Math.min(.35,b.dur*.1)) * (1 - prog(lt, subscribeAt - 0.08, Math.min(.25,b.dur*.08)));
          like.ripple.setAttribute("opacity", (0.7 * rippleQ).toFixed(3));
          like.ripple.setAttribute("r", (u * (4 + 6 * prog(lt, likeAt + Math.min(.35,b.dur*.1), Math.min(.35,b.dur*.1)))).toFixed(2));

          const subQ = prog(lt, subscribeAt, ctaDur), bellQ = prog(lt, bellAt, bellDur);
          G.save(); G.globalAlpha = a * subQ;
          B.tag(G, p.cta, cx, subY, { u, size: 2.4, bg: C.ink, color: C.bg, alpha: a * subQ }); G.restore();
          drawDirectNotification(bell, bellQ, a, lt);
          supportLines.forEach((line, i) => B.mono(G, line, cx, subY + u * (portrait ? 13 + i * 3.1 : 11 + i * 2.7), { u, size: supportSize, color: supportColor, alpha: a * 0.82 * prog(lt, supportAt + i * supportGap, supportDur), spacing: u * 0.1 }));
          /* el usuario del canal va un poco separado del mensaje de apoyo (+1 u ≈ 10 px en 1080) */
          if (p.handle) B.mono(G, p.handle, cx, subY + u * (portrait ? 14 + supportLines.length * 3.1 : 12 + supportLines.length * 2.7), { u, size: 1.4, color: C.ink, alpha: a * prog(lt, supportAt + supportLines.length * supportGap, supportDur) });
        },
        dispose() { root.remove(); like.ripple.remove(); },
      };
    },
  });
})();

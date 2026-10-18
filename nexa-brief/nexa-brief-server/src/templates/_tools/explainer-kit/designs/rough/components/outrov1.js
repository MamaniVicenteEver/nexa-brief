/* =============================================================================
   rough · cierre v1 para NODETECH
   ----------------------------------------------------------------------------
   Secuencia: gracias → nombre → LIKE limpio y activo → suscripción dibujada.
   El LIKE usa SVG plano, sin rough.js, para que contraste con el botón pintado.
   ========================================================================== */
(function () {
  const K = Kit, R = Kit.rough, { clamp, prog } = K;

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


  const flatText = (parent, text, attrs) => {
    const e = R.svg("text", attrs, parent);
    e.textContent = text;
    return e;
  };

  function cleanLike(ctx, parent, cx, by, u, P) {
    const g = R.svg("g", { opacity: 0 }, parent);
    const bw = u * 32, bh = u * 9, x = cx - bw / 2, y = by - bh / 2;
    const bg = R.svg("rect", { x, y, width: bw, height: bh, rx: u * 1.4, fill: P.bg2, stroke: P.ink, "stroke-width": Math.max(1, u * 0.18) }, g);
    const icon = R.svg("path", {
      d: "M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z",
      transform: `translate(${x + u * 3.2} ${y + u * 1.05}) scale(${u * 0.27})`,
      fill: P.accent,
    }, g);
    const label = flatText(g, "LIKE", {
      x: cx + u * 3.1, y: by + u * 0.55, fill: P.ink, "font-family": "Inter, sans-serif",
      "font-size": u * 2.7, "font-weight": 900, "text-anchor": "middle",
    });
    const check = flatText(g, "✓", {
      x: cx + bw * 0.34, y: by + u * 0.65, fill: P.accentInk,
      "font-family": "Inter, sans-serif", "font-size": u * 2.4, "font-weight": 900,
      "text-anchor": "middle", opacity: 0,
    });
    const ripple = R.svg("circle", { cx, cy: by, r: u * 4, fill: "none", stroke: P.accent, "stroke-width": u * 0.35, opacity: 0 }, parent);
    return { g, bg, icon, label, check, ripple, bw, bh };
  }

  K.register({
    name: "rough.outrov1", tags: ["cierre", "canal", "like", "suscribirse"], layer: "main",
    summary: "Cierre v1 para NODETECH: gracias, marca, LIKE plano que se activa y desaparece, y suscripción rough con campana y flecha corregida.",
    example: {
      thanks: "GRACIAS POR VER",
      channel: "NODETECH",
      cta: "SUSCRÍBETE",
      support: "Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades.",
    },
    params: {
      thanks: { type: "string", default: "GRACIAS POR VER", doc: "Línea superior." },
      channel: { type: "string", default: "NODETECH", doc: "Nombre del canal." },
      cta: { type: "string", default: "SUSCRÍBETE", doc: "Texto del botón pintado." },
      support: { type: "string", default: "Tu apoyo hace posible que sigamos trayendo nuevas tecnologías, ideas y curiosidades.", doc: "Texto de apoyo inferior." },
      handle: { type: "string", default: "youtube.com/@nodetech", doc: "Usuario del canal." },
      likeAt: { type: "number", default: 1, doc: "Segundo de la voz en que aparece el like." },
      subscribeAt: { type: "number", default: 2.5, doc: "Segundo de la voz en que empieza a dibujarse suscríbete." },
      bellAt: { type: "number", default: 3.25, doc: "Segundo de la voz en que aparece la campana." },
      supportAt: { type: "number", default: 3.65, doc: "Segundo de la voz en que aparece el mensaje de apoyo." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const P = ctx.C.palette, g = R.root(ctx), { W, H, u, cx, portrait } = ctx.stage;
      const yName = portrait ? H * 0.33 : H * 0.35;
      const baseFs = Math.min(W * 0.8 / Math.max(4, R.measure(p.channel, "900 100px Inter") / 100), H * 0.13);
      /* Ajustes de lectura desktop: NODETECH +10 px y la línea superior -12 px. */
      const fs = baseFs + (portrait ? 0 : 26);

      const thanks = R.hand(ctx, g, "", { x: cx, y: yName - fs * 0.95, size: portrait ? 5.8 : Math.max(0, 5 - 16 / u), color: P.accent });
      const name = R.text(ctx, g, p.channel, { x: cx, y: yName, size: fs / u, weight: 900, color: P.ink, opacity: 0 });
      const wName = Math.min(W * 0.85, R.measure(p.channel, `900 ${fs}px Inter`));
      const under = R.shape(ctx, g, (G, o) => [G.curve([[cx - wName / 2, yName + fs * 0.62], [cx, yName + fs * 0.55], [cx + wName / 2, yName + fs * 0.66]], o)], { color: P.accent, width: 1.8, seed: 1900 });

      const by = yName + fs * 0.7 + u * (portrait ? 12 : 10);
      const like = cleanLike(ctx, g, cx, by, u, P);

      /* En desktop la llamada a la acción y sus iconos bajan a un tamaño 20% menor. */
      const ctaScale = portrait ? 1 : 0.8;
      const fullBh = u * 9, bw = u * (portrait ? 40 : 30 * ctaScale), bh = fullBh * ctaScale;
      const subBy = by + fullBh / 2 + (portrait ? u * 13 : u * 5 - 44);
      const sub = R.shape(ctx, g, (G, o) => [G.rectangle(cx - bw / 2, subBy - bh / 2, bw, bh, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 1.2 })], { color: P.accent, fillColor: P.accent, width: 1.6, seed: 1901 });
      sub.forEach(e => e._fill && e.setAttribute("stroke-opacity", 0.35));
      const cta = R.text(ctx, g, p.cta, { x: cx, y: subBy, size: 3.2 * ctaScale, weight: 900, color: P.ink, opacity: 0 });

      /* La flecha queda fuera del botón y apunta exactamente a su borde izquierdo. */
      const tipX = cx - bw / 2 - u * 1.2, tipY = subBy, as = ctaScale;
      const arrow = R.shape(ctx, g, (G, o) => [
        G.curve([[tipX - u * 16 * as, tipY - u * 8 * as], [tipX - u * 11 * as, tipY - u * 6 * as], [tipX - u * 6 * as, tipY - u * 2 * as], [tipX, tipY]], o),
        G.linearPath([[tipX - u * 4.5 * as, tipY - u * 3.5 * as], [tipX, tipY], [tipX - u * 4.5 * as, tipY + u * 3.5 * as]], { ...o, seed: 1902 }),
      ], { color: P.accent, width: 1.4 * as, seed: 1903 });
      const bell = R.sketch(ctx, g, "alarm", { x: cx + bw / 2 + u * 4 * as, y: subBy - u * 5 * as, w: u * 8 * as, h: u * 8 * as }, { color: P.ink, width: 1.2 * as, seed: 1904 });
      const supportSize = portrait ? 1.35 : 1.45 + 4 / u;
      const supportHalf = portrait ? bh / 2 : fullBh / 2;
      const supLines = R.wrap(p.support, portrait ? 27 : 62).map((line, i) => R.mono(ctx, g, line, { x: cx, y: subBy + supportHalf + u * (portrait ? 8 + i * 3.1 : 7 + i * 2.7), size: supportSize, color: P.muted, opacity: 0 }));
      /* el usuario del canal va un poco separado del mensaje de apoyo (+1 u ≈ 10 px en 1080) */
      const hd = p.handle ? R.mono(ctx, g, p.handle, { x: cx, y: subBy + supportHalf + u * (portrait ? 9 + supLines.length * 3.1 : 8 + supLines.length * 2.7), size: 1.5, color: P.ink, opacity: 0 }) : null;

      return {
        render(lt, b, t) {
          const scale = Math.min(1, Math.max(.3, (b.dur - .35) / 4.65));
          const likeAt = p.likeAt * scale, subscribeAt = p.subscribeAt * scale;
          const ctaDur = Math.min(.6, b.dur * .12), arrowDur = Math.min(.28, b.dur * .08), bellDur = Math.min(.45, b.dur * .1);
          const bellAt = Math.max(p.bellAt * scale, subscribeAt + ctaDur + arrowDur + .04);
          const supportAt = Math.max(p.supportAt * scale, bellAt + bellDur + .04);
          const supportGap = b.dur < 4 ? .04 : .05, supportDur = b.dur < 4 ? .16 : .24;
          R.type(thanks, p.thanks, prog(lt, 0, 0.55, "linear"));
          name.setAttribute("opacity", prog(lt, 0.25, 0.45));
          R.draw(under, lt, { start: 0.65, dur: 0.55, t });

          /* LIKE limpio: entra, recibe el estado activo y luego desaparece. */
          const likeIn = prog(lt, likeAt, Math.min(.35,b.dur*.1)), likeOut = 1 - prog(lt, subscribeAt, Math.min(.35,b.dur*.1));
          like.g.setAttribute("opacity", (likeIn * likeOut).toFixed(3));
          const likeScale = 0.94 + 0.06 * likeIn, likeDy = Math.sin((lt - likeAt) * 3) * u * 0.12;
          like.g.setAttribute("transform", `translate(${cx} ${by + likeDy}) scale(${likeScale.toFixed(3)}) translate(${-cx} ${-by})`);
          const likeActive = prog(lt, likeAt + Math.min(.28,b.dur*.08), Math.min(.22,b.dur*.07)) >= 1;
          like.bg.setAttribute("fill", likeActive ? P.accent : P.bg2);
          like.icon.setAttribute("fill", likeActive ? P.accentInk : P.accent);
          like.label.setAttribute("fill", likeActive ? P.accentInk : P.ink);
          like.check.setAttribute("opacity", prog(lt, likeAt + Math.min(.43,b.dur*.12), Math.min(.2,b.dur*.06)));
          const rippleQ = prog(lt, likeAt + Math.min(.35,b.dur*.1), Math.min(.35,b.dur*.1)) * (1 - prog(lt, subscribeAt - 0.08, Math.min(.25,b.dur*.08)));
          like.ripple.setAttribute("opacity", (0.7 * rippleQ).toFixed(3));
          like.ripple.setAttribute("r", (u * (4 + 6 * prog(lt, likeAt + Math.min(.35,b.dur*.1), Math.min(.35,b.dur*.1)))).toFixed(2));

          /* Primero se puntea el cuadro, luego el texto, la flecha y la campana. */
          R.draw(sub, lt, { start: subscribeAt, dur: ctaDur, t });
          cta.setAttribute("opacity", prog(lt, subscribeAt + ctaDur * .62, Math.min(.25,b.dur*.07)));
          R.draw(arrow, lt, { start: subscribeAt + ctaDur, dur: arrowDur, t });
          R.draw(bell, lt, { start: bellAt, total: bellDur, dur: bellDur, t });
          supLines.forEach((s, i) => s.setAttribute("opacity", prog(lt, supportAt + i * supportGap, supportDur)));
          if (hd) hd.setAttribute("opacity", prog(lt, supportAt + supLines.length * supportGap, supportDur));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); like.ripple.remove(); },
      };
    },
  });
})();

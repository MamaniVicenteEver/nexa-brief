(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;
  K.register({
    name: "rough.paymentRequest",
    tags: ["pago", "urgencia", "transferencia", "estafa"],
    layer: "main",
    summary: "Una orden de transferencia ilustrada: tarjeta grande con importe, botón ENVIAR tachado y flecha de urgencia. Sirve para el momento en que la narración muestra la exigencia de dinero.",
    example: {
      amount: "$5.400",
      title: "TRANSFERENCIA URGENTE",
      subtitle: "SOLICITUD DE PAGO",
      cta: "ENVIAR",
      note: "",
      urgency: "AHORA",
    },
    params: {
      amount:   { type: "string", default: "$5.400", doc: "Importe grande en la tarjeta." },
      title:    { type: "string", default: "TRANSFERENCIA URGENTE", doc: "Título de la tarjeta." },
      subtitle: { type: "string", default: "SOLICITUD DE PAGO", doc: "Rótulo superior." },
      cta:      { type: "string", default: "ENVIAR", doc: "Texto del botón (se dibuja tachado)." },
      note:     { type: "string", default: "", doc: "Nota manuscrita al pie." },
      urgency:  { type: "string", default: "AHORA", doc: "Rótulo de la flecha de urgencia." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, cx, cy, portrait } = ctx.stage;
      const c = ctx.stage.content;

      // ---- Layout: tarjeta + flecha de urgencia ----
      // En vertical: tarjeta ocupa ~78% ancho, ~62% alto; flecha arriba a la derecha.
      // En horizontal: tarjeta a la izquierda, flecha a la derecha.
      let card, arrowBox;
      if (portrait) {
        const cw = c.w * 0.82;
        const ch = c.h * 0.88;
        card = { x: c.x + (c.w - cw) / 2, y: c.y + c.h * 0.08, w: cw, h: ch };
        arrowBox = { x: c.x + c.w * 0.62, y: c.y + c.h * 0.02, w: c.w * 0.34, h: c.h * 0.14 };
      } else {
        const cw = c.w * 0.56;
        const ch = c.h * 0.70;
        card = { x: c.x + c.w * 0.04, y: c.y + (c.h - ch) / 2, w: cw, h: ch };
        arrowBox = { x: c.x + c.w * 0.66, y: c.y + c.h * 0.10, w: c.w * 0.30, h: c.h * 0.34 };
      }

      // ---- Tarjeta ----
      const cardEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(card.x, card.y, card.w, card.h, o),
      ], { color: P.ink, width: 1.6, seed: 101 });

      // Franja superior (línea divisoria)
      const topLineY = card.y + card.h * 0.16;
      const topLine = R.shape(ctx, g, (G, o) => [
        G.line(card.x + u * 1.5, topLineY, card.x + card.w - u * 1.5, topLineY, o),
      ], { color: P.muted, width: 1.1, seed: 102 });

      // Rótulo superior (subtitle) — dentro de la franja, alineado a la izquierda
      const subSize = Math.min(2.6, (card.h * 0.10) / u);
      const subY = card.y + card.h * 0.08;
      const subEl = R.mono(ctx, g, (p.subtitle || "").toUpperCase(), {
        x: card.x + u * 2.2, y: subY, size: subSize, color: P.muted, anchor: "start",
      });

      // Título (title) — debajo de la franja
      const titleSize = Math.min(5, (card.h * 0.16) / u);
      const titleY = card.y + card.h * 0.30;
      const titleEl = R.text(ctx, g, (p.title || "").toUpperCase(), {
        x: card.x + card.w / 2, y: titleY, size: titleSize, weight: 800, color: P.ink, anchor: "middle",
      });

      // Importe grande — centro de la tarjeta, en accent
      const amtSize = Math.min(11, (card.h * 0.28) / u);
      const amtY = card.y + card.h * 0.55;
      const amtEl = R.text(ctx, g, p.amount || "", {
        x: card.x + card.w / 2, y: amtY, size: amtSize, weight: 900, color: P.accent, anchor: "middle",
      });

      // Botón ENVIAR (rectángulo) — abajo de la tarjeta
      const btnW = card.w * 0.62;
      const btnH = card.h * 0.16;
      const btnX = card.x + (card.w - btnW) / 2;
      const btnY = card.y + card.h * 0.72;
      const btnEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(btnX, btnY, btnW, btnH, o),
      ], { color: P.ink, width: 1.5, seed: 103 });

      const ctaSize = Math.min(3.4, (btnH * 0.55) / u);
      const ctaEl = R.text(ctx, g, (p.cta || "").toUpperCase(), {
        x: btnX + btnW / 2, y: btnY + btnH / 2 + ctaSize * u * 0.35,
        size: ctaSize, weight: 800, color: P.ink, anchor: "middle",
      });

      // Tachado del botón (dos líneas cruzadas, en accent)
      const strikeEls = R.shape(ctx, g, (G, o) => [
        G.line(btnX - u * 0.6, btnY + btnH * 0.5, btnX + btnW + u * 0.6, btnY + btnH * 0.5, o),
        G.line(btnX - u * 0.3, btnY + btnH * 0.15, btnX + btnW + u * 0.3, btnY + btnH * 0.85, o),
      ], { color: P.accent, width: 2.2, seed: 104 });

      // Nota manuscrita al pie de la tarjeta (en accent, dentro de la tarjeta)
      const noteSize = Math.min(2.4, (card.h * 0.075) / u);
      const noteY = card.y + card.h * 0.95;
      const noteEl = p.note ? R.hand(ctx, g, p.note, {
        x: card.x + card.w / 2, y: noteY, size: noteSize, color: P.accent, anchor: "middle",
      }) : null;

      // ---- Flecha de urgencia (arriba-derecha en vertical; derecha en horizontal) ----
      const arrowEls = R.shape(ctx, g, (G, o) => {
        const ax = arrowBox.x + arrowBox.w * 0.15;
        const ay = arrowBox.y + arrowBox.h * 0.85;
        const bx = arrowBox.x + arrowBox.w * 0.85;
        const by = arrowBox.y + arrowBox.h * 0.15;
        const mx = (ax + bx) / 2, my = (ay + by) / 2;
        // Cuerpo de la flecha (curva)
        const body = G.curve([[ax, ay], [mx - arrowBox.w * 0.05, my + arrowBox.h * 0.05], [bx, by]], o);
        // Cabeza
        const head1 = G.line(bx, by, bx - arrowBox.w * 0.22, by + arrowBox.h * 0.05, o);
        const head2 = G.line(bx, by, bx - arrowBox.w * 0.05, by + arrowBox.h * 0.30, o);
        return [body, head1, head2];
      }, { color: P.accent, width: 2.4, seed: 105 });

      // Rótulo de urgencia junto a la flecha
      const urgSize = Math.min(3.0, (arrowBox.h * 0.30) / u);
      const urgEl = R.label(ctx, g, (p.urgency || "").toUpperCase(), {
        x: arrowBox.x + arrowBox.w * 0.5,
        y: arrowBox.y + arrowBox.h * 0.95,
        size: urgSize,
      });

      // ---- Render ----
      return {
        render(lt, b, t) {
          // Aparición escalonada, todo visible a 1.5 s
          R.draw(cardEls, lt, { start: 0.0, dur: 0.35, ease: "out", t });
          R.draw(topLine, lt, { start: 0.15, dur: 0.25, ease: "out", t });
          R.draw(btnEls, lt, { start: 0.35, dur: 0.30, ease: "out", t });
          R.draw(strikeEls, lt, { start: 0.85, dur: 0.30, ease: "out", t });
          R.draw(arrowEls, lt, { start: 0.55, dur: 0.45, ease: "out", t });

          // Textos: fade-in escalonado
          const fade = (el, s, d) => { if (el) el.setAttribute("opacity", prog(lt, s, d, "out")); };
          fade(subEl, 0.20, 0.25);
          fade(titleEl, 0.30, 0.30);
          fade(amtEl, 0.45, 0.35);
          fade(ctaEl, 0.55, 0.25);
          fade(noteEl, 1.00, 0.30);
          if (urgEl) urgEl.setAttribute("opacity", prog(lt, 0.70, 0.30, "out"));

          // Respiración lenta del importe (zoom 0.5%/s) — determinista
          const breathe = 1 + 0.005 * Math.sin(lt * 1.2);
          amtEl.setAttribute("transform",
            `translate(${card.x + card.w / 2} ${amtY}) scale(${breathe.toFixed(4)}) translate(${-(card.x + card.w / 2)} ${-amtY})`);

          // Pulso de la flecha de urgencia
          const pulse = 1 + 0.03 * Math.sin(lt * 4.0);
          const acx = arrowBox.x + arrowBox.w * 0.5;
          const acy = arrowBox.y + arrowBox.h * 0.5;
          const arrowG = arrowEls[0] && arrowEls[0].parentNode;
          if (arrowG) arrowG.setAttribute("transform",
            `translate(${acx} ${acy}) scale(${pulse.toFixed(4)}) translate(${-acx} ${-acy})`);

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

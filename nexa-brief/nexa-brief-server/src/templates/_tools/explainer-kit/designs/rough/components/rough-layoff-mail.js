(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;

  // parte un texto en renglones de hasta `max` caracteres (por palabras)
  function wrap(s, max) {
    const out = []; let cur = "";
    String(s || "").split(/\s+/).forEach(w => {
      if (!w) return;
      if (cur && (cur + " " + w).length > max) { out.push(cur); cur = w; }
      else cur = cur ? cur + " " + w : w;
    });
    if (cur) out.push(cur);
    return out.slice(0, 3);
  }

  K.register({
    name: "rough.layoffMail",
    tags: ["despido", "correo", "teléfono", "notificación", "trabajo"],
    layer: "main",
    summary: "Un teléfono dibujado a mano se enciende de madrugada: llega una notificación con remitente y asunto, el teléfono vibra y en `stampAt` cae un sello lima (PUESTO ELIMINADO). Para el momento en que alguien se entera de un despido por correo o mensaje.",
    example: { time: "6:04", from: "RECURSOS HUMANOS", subject: "Tu puesto ha sido eliminado", stamp: "PUESTO ELIMINADO", stampAt: 2.0, label: "MIÉRCOLES 28 OCT", badge: "×250" },
    params: {
      time: { type: "string", default: "6:04", doc: "Hora grande en la pantalla bloqueada." },
      from: { type: "string", default: "RECURSOS HUMANOS", doc: "Remitente de la notificación (mono)." },
      subject: { type: "string", default: "Tu puesto ha sido eliminado", doc: "Asunto del correo (hasta 3 renglones)." },
      stamp: { type: "string", default: "PUESTO ELIMINADO", doc: "Texto del sello lima; vacío = sin sello." },
      stampAt: { type: "number", default: 2.0, doc: "Segundo del beat en que cae el sello." },
      label: { type: "string", default: "", doc: "Etiqueta de contexto arriba (fecha, empresa)." },
      badge: { type: "string", default: "", doc: "Cifra manuscrita al costado del teléfono (p. ej. ×250); vacío = nada." },
      note: { type: "string", default: "", doc: "Nota manuscrita al pie; vacío = nada." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, portrait, content: c, cx } = ctx.stage;

      // ---- zonas: cabecera 12 % · cuerpo 76 % · pie 12 % ----
      const headY = c.y + c.h * 0.06;
      const footY = c.y + c.h * 0.94;
      const bodyY = c.y + c.h * 0.13, bodyH = c.h * 0.74;

      // ---- teléfono (lo más grande de la escena) ----
      let ph;
      if (portrait) {
        // en vertical el teléfono usa toda la altura y es más ancho (≥ 60 % del contenido)
        const h = bodyH;
        const w = Math.min(c.w * 0.66, h * 0.62);
        ph = { x: cx - w / 2, y: bodyY + (bodyH - h) / 2, w, h };
      } else {
        const h = bodyH;
        const w = h * 0.5;
        ph = { x: cx - w / 2, y: bodyY, w, h };
      }
      const r = ph.w * 0.12;
      const scr = { x: ph.x + ph.w * 0.07, y: ph.y + ph.h * 0.06, w: ph.w * 0.86, h: ph.h * 0.88 };

      const phoneG = R.svg("g", {}, g);
      const bodyEls = R.shape(ctx, phoneG, (G, o) => [
        G.path(`M${ph.x + r},${ph.y} L${ph.x + ph.w - r},${ph.y} Q${ph.x + ph.w},${ph.y} ${ph.x + ph.w},${ph.y + r} L${ph.x + ph.w},${ph.y + ph.h - r} Q${ph.x + ph.w},${ph.y + ph.h} ${ph.x + ph.w - r},${ph.y + ph.h} L${ph.x + r},${ph.y + ph.h} Q${ph.x},${ph.y + ph.h} ${ph.x},${ph.y + ph.h - r} L${ph.x},${ph.y + r} Q${ph.x},${ph.y} ${ph.x + r},${ph.y} Z`, o),
      ], { color: P.ink, width: 1.8, seed: 2101 });
      const detailEls = R.shape(ctx, phoneG, (G, o) => [
        G.line(cx - ph.w * 0.12, ph.y + ph.h * 0.03, cx + ph.w * 0.12, ph.y + ph.h * 0.03, o),
        G.line(cx - ph.w * 0.16, ph.y + ph.h * 0.97, cx + ph.w * 0.16, ph.y + ph.h * 0.97, o),
      ], { color: P.muted, width: 1.2, seed: 2102 });

      // hora grande (pantalla bloqueada)
      const timeSize = Math.min(9, scr.w / u * 0.26);
      const timeEl = R.text(ctx, phoneG, p.time || "", { x: cx, y: scr.y + scr.h * 0.2, size: timeSize, weight: 300, color: P.ink, anchor: "middle" });

      // ---- notificación (tarjeta) ----
      const card = { x: scr.x + u * 0.8, y: scr.y + scr.h * 0.32, w: scr.w - u * 1.6 };
      // remitente: cabe en la tarjeta (al lado del sobre)
      const fromSize = clamp((card.w - u * 7) / u / (Math.max(8, (p.from || "").length) * 0.68), 1.6, 2.2);
      const subjSize = Math.max(2.4, Math.min(3.6, card.w / u * 0.1));
      const maxChars = Math.max(10, Math.floor(card.w / (subjSize * u * 0.56)));
      const lines = wrap(p.subject, maxChars);
      const lh = subjSize * u * 1.25;
      card.h = u * 2.2 + fromSize * u * 1.6 + lines.length * lh + u * 1.4;

      const cardG = R.svg("g", {}, phoneG);
      const cardEls = R.shape(ctx, cardG, (G, o) => [
        G.rectangle(card.x, card.y, card.w, card.h, o),
      ], { color: P.ink, width: 1.4, seed: 2201 });
      const mailEls = R.shape(ctx, cardG, (G, o) => {
        const ix = card.x + u * 1.4, iy = card.y + u * 1.3, iw = u * 3.2, ih = u * 2.2;
        return [G.rectangle(ix, iy, iw, ih, o), G.linearPath([[ix, iy], [ix + iw / 2, iy + ih * 0.6], [ix + iw, iy]], o)];
      }, { color: P.ink, width: 1.1, seed: 2202 });
      const fromEl = R.mono(ctx, cardG, (p.from || "").toUpperCase(), { x: card.x + u * 5.6, y: card.y + u * 2.9, size: fromSize, weight: 700, color: P.muted, anchor: "start" });
      const subjEls = lines.map((ln, i) => R.text(ctx, cardG, "", { x: card.x + u * 1.4, y: card.y + u * 2.2 + fromSize * u * 1.6 + lh * (i + 0.8), size: subjSize, weight: 700, color: P.ink, anchor: "start" }));

      // ---- sello lima (lo único en acento) ----
      // sello dibujado: caja a mano girada + texto mono, todo en lima
      const stampG = p.stamp ? R.svg("g", {}, g) : null;
      const stampY = card.y + card.h + (scr.y + scr.h - card.y - card.h) * 0.42;
      if (stampG) {
        const st = p.stamp.toUpperCase();
        const ss = clamp((ph.w * 0.78) / u / (st.length * 0.66), 1.8, 3.6);
        const sw = st.length * ss * u * 0.64 + u * 2.4, sh = ss * u * 2.2;
        const inner = R.svg("g", { transform: `rotate(-8 ${cx} ${stampY})` }, stampG);
        R.shape(ctx, inner, (G, o) => [G.rectangle(cx - sw / 2, stampY - sh / 2, sw, sh, o)], { color: P.accent, width: 2.4, seed: 2301 });
        R.mono(ctx, inner, st, { x: cx, y: stampY + ss * u * 0.36, size: ss, weight: 700, color: P.accent, anchor: "middle" });
      }

      // ---- textos de zonas ----
      const labelEl = p.label ? R.mono(ctx, g, p.label.toUpperCase(), { x: cx, y: headY, size: 2.2, weight: 700, color: P.ink, anchor: "middle" }) : null;
      const badgeEl = p.badge ? R.hand(ctx, g, p.badge, {
        x: portrait ? Math.min(c.x + c.w - u * 2, ph.x + ph.w + u * 1) : ph.x + ph.w + u * 4,
        y: ph.y + ph.h * 0.18, size: portrait ? 5 : 7, color: P.ink, anchor: portrait ? "end" : "start",
      }) : null;
      const noteEl = p.note ? R.hand(ctx, g, p.note, { x: cx, y: footY, size: 2.8, color: P.ink, anchor: "middle" }) : null;

      const cardAt = 0.55;
      return {
        render(lt, b, t) {
          R.draw(bodyEls, lt, { start: 0, dur: 0.4, ease: "out", t });
          R.draw(detailEls, lt, { start: 0.2, dur: 0.2, ease: "out", t });
          timeEl.setAttribute("opacity", prog(lt, 0.15, 0.3));

          // la tarjeta baja desde arriba de la pantalla
          const qa = prog(lt, cardAt, 0.35, "back");
          cardG.setAttribute("transform", `translate(0 ${((1 - qa) * -u * 5).toFixed(2)})`);
          cardG.setAttribute("opacity", prog(lt, cardAt, 0.2).toFixed(3));
          R.draw(cardEls, lt, { start: cardAt, dur: 0.3, ease: "out", t });
          R.draw(mailEls, lt, { start: cardAt + 0.15, dur: 0.25, ease: "out", t });
          fromEl.setAttribute("opacity", prog(lt, cardAt + 0.2, 0.25));
          const full = lines.join(" ").length || 1;
          let acc = 0;
          const qt = prog(lt, cardAt + 0.35, 0.7, "linear");
          lines.forEach((ln, i) => {
            const a0 = acc / full, a1 = (acc + ln.length) / full; acc += ln.length + 1;
            R.type(subjEls[i], ln, clamp((qt - a0) / Math.max(0.001, a1 - a0)));
          });

          // vibración al llegar (función de lt) + respiración lenta
          const since = lt - cardAt;
          const buzz = since > 0 && since < 0.5 ? Math.sin(since * 70) * (1 - since / 0.5) * u * 0.5 : 0;
          const s = 1 + Math.min(lt, 12) * 0.004;
          phoneG.setAttribute("transform", `translate(${buzz.toFixed(2)} 0) translate(${cx} ${ph.y + ph.h / 2}) scale(${s.toFixed(4)}) translate(${-cx} ${-(ph.y + ph.h / 2)})`);

          if (stampG) {
            const qs = prog(lt, p.stampAt, 0.25, "back");
            const sc = lerp(1.6, 1, qs);
            stampG.setAttribute("opacity", prog(lt, p.stampAt, 0.12).toFixed(3));
            stampG.setAttribute("transform", `translate(${cx} ${stampY}) scale(${sc.toFixed(3)}) translate(${-cx} ${-stampY})`);
          }
          if (labelEl) labelEl.setAttribute("opacity", prog(lt, 0, 0.3));
          if (badgeEl) badgeEl.setAttribute("opacity", prog(lt, cardAt + 0.9, 0.3));
          if (noteEl) noteEl.setAttribute("opacity", prog(lt, 1.2, 0.4));

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

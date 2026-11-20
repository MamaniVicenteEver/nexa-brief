(function () {
  const K = Kit, R = Kit.rough, { prog, clamp } = K;
  K.register({
    name: "rough.incomingCall",
    tags: ["teléfono", "llamada", "estafa", "emergencia"],
    layer: "main",
    summary: "Un teléfono dibujado a mano con pantalla de llamada entrante: nombre aparente, botón de responder y de rechazar. Sirve para mostrar el momento en que suena una llamada de un supuesto familiar.",
    example: {
      callerName: "MAMÁ",
      subtitle: "LLAMADA ENTRANTE",
      acceptLabel: "",
      declineLabel: "",
      note: "",
    },
    params: {
      callerName: { type: "string", default: "MAMÁ", doc: "Nombre que aparece en la pantalla." },
      subtitle: { type: "string", default: "LLAMADA ENTRANTE", doc: "Texto chico arriba del nombre." },
      acceptLabel: { type: "string", default: "", doc: "Rótulo del botón verde (accent)." },
      declineLabel: { type: "string", default: "", doc: "Rótulo del botón de colgar." },
      note: { type: "string", default: "", doc: "Nota al pie." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, cx, cy, content: c, portrait } = ctx.stage;

      // ---- Layout: teléfono centrado, ocupa ~62% del ancho en 9:16 y ~46% del alto en 16:9
      const phoneW = portrait ? c.w * 0.70 : Math.min(c.w * 0.34, c.h * 0.48);
      const phoneH = phoneW * 1.85;
      const px = cx - phoneW / 2;
      const py = cy - phoneH / 2;
      const r = phoneW * 0.14;

      // Pantalla interior (con margen)
      const m = phoneW * 0.07;
      const sx = px + m, sy = py + m;
      const sw = phoneW - m * 2, sh = phoneH - m * 2;

      // ---- Cuerpo del teléfono (rect redondeado a mano)
      const bodyEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(px, py, phoneW, phoneH, o),
      ], { color: P.ink, width: 2.2, seed: 101 });

      // Pantalla (rect interior)
      const screenEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(sx, sy, sw, sh, o),
      ], { color: P.ink, width: 1.6, seed: 102 });

      // Parlante arriba (pequeña línea)
      const speakerEls = R.shape(ctx, g, (G, o) => [
        G.line(cx - phoneW * 0.10, py + m * 0.45, cx + phoneW * 0.10, py + m * 0.45, o),
      ], { color: P.muted, width: 1.4, seed: 103 });

      // ---- Contenido de la pantalla
      // Zona cabecera de pantalla (12% arriba): subtítulo
      const headY = sy + sh * 0.10;
      // Zona cuerpo: avatar + nombre
      const avatarR = Math.min(sw, sh) * 0.16;
      const avatarCx = cx;
      const avatarCy = sy + sh * 0.30;

      const avatarEls = R.shape(ctx, g, (G, o) => [
        G.circle(avatarCx, avatarCy, avatarR * 2, o),
      ], { color: P.ink, width: 1.8, seed: 104 });

      // Silueta de persona dentro del avatar (cabeza + hombros)
      const personEls = R.shape(ctx, g, (G, o) => [
        G.circle(avatarCx, avatarCy - avatarR * 0.25, avatarR * 0.55, o),
        G.arc(avatarCx, avatarCy + avatarR * 0.55, avatarR * 1.4, avatarR * 1.0, Math.PI, Math.PI * 2, false, o),
      ], { color: P.muted, width: 1.4, seed: 105 });

      // Nombre (grande) debajo del avatar
      const nameY = avatarCy + avatarR + u * 4.5;
      const nameSize = Math.min(6.5, (sw / u) * 0.14);
      const nameEl = R.text(ctx, g, p.callerName, {
        x: cx, y: nameY, size: nameSize, weight: 800, color: P.ink, anchor: "middle",
      });

      // Subtítulo arriba
      const subSize = Math.min(2.4, (sw / u) * 0.09);
      const subEl = R.text(ctx, g, p.subtitle, {
        x: cx, y: headY, size: subSize, weight: 600, color: P.ink, anchor: "middle",
      });

      // ---- Botones abajo (dentro de la pantalla)
      const btnY = sy + sh * 0.82;
      const btnR = Math.min(sw, sh) * 0.10;
      const gap = btnR * 2.6;
      const acceptCx = cx + gap / 2;
      const declineCx = cx - gap / 2;

      // Botón responder (accent, relleno lima rayado)
      const acceptEls = R.shape(ctx, g, (G, o) => [
        G.circle(acceptCx, btnY, btnR * 2, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.7 }),
      ], { color: P.accent, fillColor: P.accent, width: 1.8, seed: 106 });

      // Ícono de teléfono dentro del botón (trazo oscuro sobre lima)
      const acceptIconEls = R.shape(ctx, g, (G, o) => {
        const s = btnR * 0.55;
        return [
          G.path(`M ${acceptCx - s} ${btnY - s * 0.6} Q ${acceptCx - s * 0.3} ${btnY - s * 1.1} ${acceptCx} ${btnY - s * 0.4} Q ${acceptCx + s * 0.3} ${btnY - s * 1.1} ${acceptCx + s} ${btnY - s * 0.6}`, o),
        ];
      }, { color: P.accentInk, width: 1.6, seed: 107 });

      // Botón rechazar (solo contorno)
      const declineEls = R.shape(ctx, g, (G, o) => [
        G.circle(declineCx, btnY, btnR * 2, o),
      ], { color: P.muted, width: 1.6, seed: 108 });

      // Ícono X dentro del botón rechazar
      const declineIconEls = R.shape(ctx, g, (G, o) => {
        const s = btnR * 0.45;
        return [
          G.line(declineCx - s, btnY - s, declineCx + s, btnY + s, o),
          G.line(declineCx + s, btnY - s, declineCx - s, btnY + s, o),
        ];
      }, { color: P.muted, width: 1.6, seed: 109 });

      // Rótulos bajo los botones
      const labelY = btnY + btnR + u * 2.6;
      const labelSize = Math.min(2.0, (sw / u) * 0.045);
      const acceptLabelEl = R.text(ctx, g, p.acceptLabel, {
        x: acceptCx, y: labelY, size: labelSize, weight: 700, color: P.accent, anchor: "middle",
      });
      const declineLabelEl = R.text(ctx, g, p.declineLabel, {
        x: declineCx, y: labelY, size: labelSize, weight: 700, color: P.muted, anchor: "middle",
      });

      // Nota al pie (fuera del teléfono, en zona pie)
      const noteY = Math.min(c.y + c.h - u * 1.5, py + phoneH + u * 5);
      const noteSize = Math.min(1.8, (c.w / u) * 0.028);
      const noteEl = p.note ? R.text(ctx, g, p.note, {
        x: cx, y: noteY, size: noteSize, weight: 500, color: P.muted, anchor: "middle",
      }) : null;

      // ---- Animación: tiempos
      const T = {
        body: 0.0,
        screen: 0.15,
        speaker: 0.25,
        sub: 0.30,
        avatar: 0.35,
        person: 0.45,
        name: 0.55,
        decline: 0.70,
        accept: 0.80,
        labels: 0.95,
        note: 1.10,
      };

      return {
        render(lt, b, t) {
          // Dibujado de trazos
          R.draw(bodyEls, lt, { start: T.body, dur: 0.45, t });
          R.draw(screenEls, lt, { start: T.screen, dur: 0.35, t });
          R.draw(speakerEls, lt, { start: T.speaker, dur: 0.20, t });
          R.draw(avatarEls, lt, { start: T.avatar, dur: 0.30, t });
          R.draw(personEls, lt, { start: T.person, dur: 0.30, t });
          R.draw(declineEls, lt, { start: T.decline, dur: 0.30, t });
          R.draw(declineIconEls, lt, { start: T.decline + 0.10, dur: 0.20, t });
          R.draw(acceptEls, lt, { start: T.accept, dur: 0.30, t });
          R.draw(acceptIconEls, lt, { start: T.accept + 0.10, dur: 0.20, t });

          // Textos con fade
          subEl.setAttribute("opacity", prog(lt, T.sub, 0.30));
          nameEl.setAttribute("opacity", prog(lt, T.name, 0.35));
          acceptLabelEl.setAttribute("opacity", prog(lt, T.labels, 0.30));
          declineLabelEl.setAttribute("opacity", prog(lt, T.labels + 0.05, 0.30));
          if (noteEl) noteEl.setAttribute("opacity", prog(lt, T.note, 0.35));

          // Pulso suave del botón de responder (respiración)
          const pulse = 1 + Math.sin(lt * 3.2) * 0.02;
          acceptEls.forEach(el => {
            el.setAttribute("transform", `translate(${acceptCx} ${btnY}) scale(${pulse.toFixed(3)}) translate(${-acceptCx} ${-btnY})`);
          });

          // Temblor sutil del teléfono (vibración de llamada)
          const vib = Math.sin(lt * 22) * (lt < 1.2 ? 1.5 : 0.6);
          g.setAttribute("transform", `translate(${vib.toFixed(2)} 0)`);

          // Salida
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

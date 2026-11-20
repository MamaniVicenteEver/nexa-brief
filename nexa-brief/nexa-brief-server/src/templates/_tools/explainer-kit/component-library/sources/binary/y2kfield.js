(function () {
  const K = Kit, B = Kit.binary, { clamp, prog } = K;
  K.register({
    name: "binary.y2kfield",
    tags: ["fecha", "año", "dos dígitos", "y2k", "calendario"],
    layer: "main",
    summary: "Calendario digital hecho de dígitos binarios: muestra el campo de año de dos dígitos y el paso de 99 a 00, con la ambigüedad de leer 00 como 1900. Sirve para explicar por qué se usaban dos dígitos y qué podía pasar al cambiar de siglo.",
    example: { morph: 1.0, showHint: true, label: "CAMPO DE AÑO" },
    params: {
      morph: { type: "number", default: 1.0, min: 0.2, max: 3, doc: "Segundos de armado de la forma." },
      showHint: { type: "bool", default: true, doc: "Mostrar rótulos 99 / 00 / 1900." },
      label: { type: "string", default: "CAMPO DE AÑO", doc: "Etiqueta superior." },
    },

    points(ctx, p) {
      const c = ctx.stage.content;
      // Marco del calendario: caja grande, ~72% del ancho de content en 9:16.
      const box = B.boxIn(ctx, 0.72, ctx.stage.portrait ? 0.55 : 1.35);
      const cell = B.cellOf(ctx, 1);

      // Silueta: marco rectangular con dos "ventanas" de dígitos y una franja superior.
      const pts = B.sampleShape((g, w, h) => {
        g.fillStyle = ctx.C.palette.ink;
        // Marco exterior (relleno) — se recorta el interior para dejar el borde.
        const pad = Math.max(2, Math.round(w * 0.03));
        g.fillRect(0, 0, w, h);
        // Recorte interior: deja un marco de grosor pad.
        g.globalCompositeOperation = "destination-out";
        g.fillRect(pad, pad, w - pad * 2, h - pad * 2);
        // Franja superior (cabecera del calendario) — sólida.
        g.globalCompositeOperation = "source-over";
        const headH = Math.round(h * 0.18);
        g.fillRect(pad, pad, w - pad * 2, headH);
        // Dos ventanas vacías: dejan contraste limpio para los dígitos del canvas.
        const winY = pad + headH + Math.round(h * 0.06);
        const winH = Math.round(h * 0.52);
        const gap = Math.round(w * 0.06);
        const winW = Math.round((w - pad * 2 - gap * 3) / 2);
        const x1 = pad + gap;
        const x2 = x1 + winW + gap;
        // Base: línea de "soporte" del calendario.
        const baseY = winY + winH + Math.round(h * 0.06);
        g.fillRect(pad + gap, baseY, w - pad * 2 - gap * 2, Math.max(2, Math.round(h * 0.04)));
      }, box, { cell, edge: true, jitter: 0.35, seed: 4242 });

      return B.pack(pts, ctx.family.binary.N);
    },

    motion: lt => ({ s: 1 + lt * 0.006 }),

    reveal: (lt, b, p) => clamp(lt / Math.max(0.2, p.morph)),

    create(ctx, p) {
      const c = ctx.stage.content;
      const u = ctx.stage.u;
      const G = ctx.g.top;
      const P = ctx.C.palette;

      // Caja del calendario (misma que points) para ubicar rótulos.
      const box = B.boxIn(ctx, 0.72, ctx.stage.portrait ? 0.55 : 1.35);
      const pad = Math.max(2, Math.round(box.w * 0.03));
      const headH = Math.round(box.h * 0.18);
      const winY = box.y + pad + headH + Math.round(box.h * 0.06);
      const winH = Math.round(box.h * 0.52);
      const gap = Math.round(box.w * 0.06);
      const winW = Math.round((box.w - pad * 2 - gap * 3) / 2);
      const x1 = box.x + pad + gap;
      const x2 = x1 + winW + gap;

      // Etiqueta superior (cabecera del calendario).
      const headY = box.y + pad + headH * 0.5;

      // Texto de los dígitos: se dibuja en canvas, grande, dentro de cada ventana.
      // El "99" y el "00" son los protagonistas; el "1900" aparece como interpretación.
      const digitSize = Math.min(winW / u * 0.9, winH / u * 0.85);

      return {
        render(lt, b, t) {
          const a = B.fadeIO(lt, b.dur, 0.5, 0.5, (p.morph ?? 1) * 0.4);
          if (a <= 0.001) return;

          G.save();
          G.globalAlpha = a;

          // Cabecera: etiqueta blanca con texto negro.
          if (p.label) {
            B.tag(G, p.label, box.x + box.w * 0.5, headY, {
              u, size: Math.min(2.0, headH / u * 0.55), alpha: a,
            });
          }

          // Dígitos grandes dentro de las ventanas.
          // Se dibujan con tipografía mono, en blanco, sobre el hueco del marco.
          const cx1 = x1 + winW * 0.5;
          const cx2 = x2 + winW * 0.5;
          const cyWin = winY + winH * 0.5;

          G.textAlign = "center";
          G.textBaseline = "middle";
          G.fillStyle = P.ink;
          G.font = `900 ${Math.round(digitSize * u)}px 'JetBrains Mono', monospace`;
          G.fillText("99", cx1, cyWin);
          G.fillText("00", cx2, cyWin);

          // Rótulo "AÑO" chico debajo de cada ventana (funcional, no decorativo).
          const subY = winY + winH + Math.round(box.h * 0.03);
          B.mono(G, "AÑO", cx1, subY, {
            u, size: Math.min(1.8, (box.h * 0.05) / u), color: P.ink, alpha: a * 0.85, align: "center",
          });
          B.mono(G, "AÑO", cx2, subY, {
            u, size: Math.min(1.8, (box.h * 0.05) / u), color: P.ink, alpha: a * 0.85, align: "center",
          });

          // Interpretación ambigua: "1900" aparece debajo del 00, con fade tardío.
          if (p.showHint) {
            const hintA = B.fadeIO(lt, b.dur, 1.2, 0.6, (p.morph ?? 1) * 0.6 + 0.4);
            if (hintA > 0.001) {
              G.globalAlpha = a * hintA;
              const hintY = box.y + box.h + u * 2.2;
              B.mono(G, "¿1900?", cx2, hintY, {
                u, size: 2.0, color: P.ink, alpha: a * hintA, align: "center",
              });
            }
          }

          G.restore();
        },
        dispose() { /* nada que borrar: solo canvas */ },
      };
    },
  });
})();

(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;
  K.register({
    name: "rough.reviewLens",
    tags: ["revisión", "código", "aprobación", "lente"],
    layer: "main",
    summary: "Una hoja de código bajo la lupa de una revisión humana: el lente recorre las líneas y la marca de aprobación queda pendiente (o se completa). Sirve para el momento en que algo generado espera el visto bueno de alguien.",
    example: { header: "REVISAR", status: "ANTES DE APROBAR", approved: false, note: "" },
    params: {
      header: { type: "string", default: "REVISAR", doc: "Rótulo superior (mono, mayúsculas)." },
      status: { type: "string", default: "ANTES DE APROBAR", doc: "Rótulo inferior de estado." },
      approved: { type: "bool", default: false, doc: "Si es true, la marca de aprobación se completa en lima." },
      note: { type: "string", default: "", doc: "Nota manuscrita opcional (puede ir vacía)." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, g = R.root(ctx);
      const { u, portrait, content: c, cx, cy } = ctx.stage;

      // ---- zonas fijas ----
      const headY = c.y + u * 2.4;          // cabecera
      const footY = c.y + c.h - u * 2.4;    // pie
      const bodyY = c.y + c.h * 0.14;
      const bodyH = c.h * 0.72;

      // ---- layout hoja + lente ----
      let sheet, lens;
      if (portrait) {
        const sw = Math.min(c.w * 0.78, u * 62);
        const sh = Math.min(bodyH * 0.48, sw * 0.72);
        sheet = { x: cx - sw / 2, y: bodyY + bodyH * 0.02, w: sw, h: sh };
        const lr = Math.min(c.w * 0.34, bodyH * 0.24);
        lens = { cx: cx, cy: sheet.y + sheet.h + lr + u * 2, r: lr };
      } else {
        const sw = Math.min(c.w * 0.42, u * 70);
        const sh = Math.min(bodyH * 0.86, sw * 0.72);
        sheet = { x: c.x + c.w * 0.06, y: bodyY + (bodyH - sh) / 2, w: sw, h: sh };
        const lr = Math.min(c.w * 0.16, bodyH * 0.34);
        lens = { cx: sheet.x + sheet.w + c.w * 0.16, cy: sheet.y + sheet.h * 0.42, r: lr };
      }

      // ---- hoja de código ----
      const sheetEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(sheet.x, sheet.y, sheet.w, sheet.h, o),
      ], { color: P.ink, width: 1.6, seed: 1101 });

      // barra de título de la hoja (línea horizontal)
      const barY = sheet.y + sheet.h * 0.16;
      const barEls = R.shape(ctx, g, (G, o) => [
        G.line(sheet.x + u * 1.5, barY, sheet.x + sheet.w - u * 1.5, barY, o),
      ], { color: P.muted, width: 1.1, seed: 1110 });

      // tres "puntos" de ventana
      const dots = [];
      for (let k = 0; k < 3; k++) {
        const dx = sheet.x + u * 3 + k * u * 2.2;
        const dy = sheet.y + sheet.h * 0.08;
        dots.push(R.shape(ctx, g, (G, o) => [G.circle(dx, dy, u * 0.9, o)], { color: P.muted, width: 1.0, seed: 1120 + k }));
      }

      // líneas de código (patrón, sin texto)
      const codeLines = [];
      const lineTop = barY + u * 2.2;
      const lineGap = (sheet.h - (lineTop - sheet.y) - u * 2) / 7;
      const rows = 7;
      for (let r = 0; r < rows; r++) {
        const y = lineTop + r * lineGap;
        const indent = (r % 3 === 0) ? u * 2 : (r % 3 === 1 ? u * 4 : u * 1.5);
        const wFrac = [0.72, 0.55, 0.82, 0.48, 0.66, 0.58, 0.40][r];
        const x1 = sheet.x + u * 2 + indent;
        const x2 = x1 + (sheet.w - u * 4 - indent) * wFrac;
        codeLines.push(R.shape(ctx, g, (G, o) => [
          G.line(x1, y, x2, y, o),
        ], { color: P.ink, width: 1.2, seed: 1200 + r }));
      }

      // ---- lente ----
      const lensGroup = R.svg("g", {}, g);
      const lensEls = R.shape(ctx, lensGroup, (G, o) => [
        G.circle(lens.cx, lens.cy, lens.r * 2, o),
      ], { color: P.accent, width: 2.0, seed: 1301 });

      // mango del lente
      const ang = Math.PI * 0.78;
      const hx1 = lens.cx + Math.cos(ang) * lens.r;
      const hy1 = lens.cy + Math.sin(ang) * lens.r;
      const hx2 = lens.cx + Math.cos(ang) * (lens.r + u * 6);
      const hy2 = lens.cy + Math.sin(ang) * (lens.r + u * 6);
      const handleEls = R.shape(ctx, lensGroup, (G, o) => [
        G.line(hx1, hy1, hx2, hy2, o),
      ], { color: P.accent, width: 2.4, seed: 1302 });

      // brillo interno del lente (arco)
      const shineEls = R.shape(ctx, lensGroup, (G, o) => [
        G.arc(lens.cx - lens.r * 0.25, lens.cy - lens.r * 0.25, lens.r * 0.9, lens.r * 0.9, Math.PI * 0.9, Math.PI * 1.35, false, o),
      ], { color: P.muted, width: 1.2, seed: 1303 });

      // ---- marca de aprobación (check) ----
      const chkX = portrait ? (sheet.x + sheet.w - u * 4) : (sheet.x + sheet.w - u * 4);
      const chkY = sheet.y + sheet.h - u * 4;
      const chkS = u * 5;
      const checkEls = R.shape(ctx, g, (G, o) => [
        G.linearPath([
          [chkX - chkS * 0.5, chkY],
          [chkX - chkS * 0.1, chkY + chkS * 0.4],
          [chkX + chkS * 0.6, chkY - chkS * 0.5],
        ], o),
      ], { color: P.accent, width: 2.2, seed: 1401 });

      // ---- textos (fuera del dibujo) ----
      const headEl = p.header ? R.mono(ctx, g, p.header.toUpperCase(), { x: cx, y: headY, size: 2.4, weight: 700, color: P.ink, anchor: "middle" }) : null;
      const statusEl = p.status ? R.mono(ctx, g, p.status.toUpperCase(), { x: cx, y: footY, size: 1.9, weight: 600, color: P.ink, anchor: "middle" }) : null;
      const noteEl = p.note ? R.hand(ctx, g, p.note, { x: cx, y: footY - u * 3.2, size: 2.6, color: P.accent, anchor: "middle" }) : null;

      return {
        render(lt, b, t) {
          // aparición rápida (0.3s idea clara)
          R.draw(sheetEls, lt, { start: 0, dur: 0.35, ease: "out", t });
          R.draw(barEls, lt, { start: 0.1, dur: 0.25, ease: "out", t });
          dots.forEach((d, k) => R.draw(d, lt, { start: 0.15 + k * 0.05, dur: 0.15, ease: "out", t }));
          codeLines.forEach((ln, r) => R.draw(ln, lt, { start: 0.3 + r * 0.08, dur: 0.22, ease: "out", t }));

          // lente entra y recorre
          R.draw(lensEls, lt, { start: 0.5, dur: 0.4, ease: "out", t });
          R.draw(handleEls, lt, { start: 0.6, dur: 0.3, ease: "out", t });
          R.draw(shineEls, lt, { start: 0.7, dur: 0.3, ease: "out", t });

          // recorrido lento del lente sobre la hoja
          const scanP = prog(lt, 0.9, Math.max(1.2, b.dur - 1.2), "inOut");
          const scanX = lerp(sheet.x + sheet.w * 0.25, sheet.x + sheet.w * 0.75, scanP);
          const scanY = lerp(sheet.y + sheet.h * 0.35, sheet.y + sheet.h * 0.7, scanP);
          const dx = scanX - lens.cx, dy = scanY - lens.cy;
          const breathe = 1 + Math.sin(lt * 1.2) * 0.008;
          lensGroup.setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)}) scale(${breathe.toFixed(4)}) translate(${(-dx).toFixed(2)} ${(-dy).toFixed(2)})`);

          // check: pendiente (trazo tenue) o completado (lima)
          if (p.approved) {
            R.draw(checkEls, lt, { start: 1.4, dur: 0.5, ease: "out", t });
          } else {
            // trazo tenue, sin completar
            const q = prog(lt, 1.4, 0.4, "out");
            checkEls.forEach(el => {
              el.setAttribute("stroke", P.muted);
              el.setAttribute("opacity", (0.35 * q).toFixed(3));
            });
          }

          // textos
          if (headEl) headEl.setAttribute("opacity", prog(lt, 0.05, 0.3));
          if (statusEl) statusEl.setAttribute("opacity", prog(lt, 0.9, 0.4));
          if (noteEl) noteEl.setAttribute("opacity", prog(lt, 1.2, 0.4));

          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

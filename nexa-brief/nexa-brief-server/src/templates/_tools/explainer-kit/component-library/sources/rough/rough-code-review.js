(function () {
  const K = Kit, R = Kit.rough, { prog, clamp, lerp } = K;

  K.register({
    name: "rough.codeReview",
    tags: ["código", "editor", "ia", "revisión", "programador"],
    layer: "main",
    summary: "Un editor de código dibujado a mano: las líneas se escriben solas, rápido, en gris (las escribe la máquina). En modo `review` una persona revisa: en `reviewAt` tacha en lima la línea mala y firma con un ✓ lima. En modo `ai` solo escribe la máquina, con cursor y rótulo de quién teclea.",
    example: { mode: "review", header: "pedido.js", who: "IA ESCRIBIENDO…", bad: 2, reviewAt: 2.2, note: "revisado por una persona" },
    params: {
      mode: { type: "string", default: "review", doc: "ai = solo escribe la máquina · review = además una persona tacha y aprueba." },
      header: { type: "string", default: "pedido.js", doc: "Nombre del archivo en la barra del editor (mono)." },
      lines: { type: "array", default: ["function cobrar(pedido) {", "  const total = sumar(pedido)", "  if (total < 0) borrar()", "  return enviar(total)", "}"], doc: "Líneas de código (hasta 6, ~26 caracteres)." },
      who: { type: "string", default: "IA ESCRIBIENDO…", doc: "Rótulo arriba del editor (quién escribe); vacío = nada." },
      bad: { type: "number", default: 2, doc: "Índice de la línea que la persona tacha en modo review; -1 = ninguna." },
      reviewAt: { type: "number", default: 2.2, doc: "Segundo del beat en que llegan las marcas humanas (modo review)." },
      note: { type: "string", default: "", doc: "Nota manuscrita al pie (modo review sale en lima junto al ✓); vacío = nada." },
    },
    create(ctx, p) {
      const P = ctx.C.palette, root = R.root(ctx);
      const g = R.svg("g", {}, root); // grupo interno: la respiración no pisa la salida de root
      const { u, portrait, content: c, cx } = ctx.stage;
      const review = p.mode !== "ai";
      const lines = (Array.isArray(p.lines) && p.lines.length ? p.lines : ["// …"]).slice(0, 6).map(String);

      // ---- zonas: cabecera · editor · pie ----
      const headY = c.y + c.h * 0.06;
      const footY = c.y + c.h * 0.94;
      const bodyY = c.y + c.h * 0.13, bodyH = c.h * 0.72;

      // ---- ventana del editor ----
      const ew = portrait ? c.w * 0.94 : Math.min(c.w * 0.72, bodyH * 1.55);
      const eh = portrait ? Math.min(bodyH, ew * 1.25) : bodyH;
      const ed = { x: cx - ew / 2, y: bodyY + (bodyH - eh) / 2, w: ew, h: eh };
      const barH = Math.max(u * 3.6, eh * 0.11);

      const frameEls = R.shape(ctx, g, (G, o) => [
        G.rectangle(ed.x, ed.y, ed.w, ed.h, o),
      ], { color: P.ink, width: 1.8, seed: 3101 });
      const barEls = R.shape(ctx, g, (G, o) => [
        G.line(ed.x, ed.y + barH, ed.x + ed.w, ed.y + barH, o),
        G.circle(ed.x + u * 2.2, ed.y + barH / 2, u * 1.1, o),
        G.circle(ed.x + u * 4.6, ed.y + barH / 2, u * 1.1, o),
        G.circle(ed.x + u * 7.0, ed.y + barH / 2, u * 1.1, o),
      ], { color: P.muted, width: 1.1, seed: 3102 });
      const fileEl = R.mono(ctx, g, p.header || "", { x: ed.x + u * 9.5, y: ed.y + barH * 0.66, size: 1.8, weight: 600, color: P.ink, anchor: "start" });

      // ---- líneas de código: tamaño según el ancho, numeradas ----
      const maxLen = Math.max(12, ...lines.map(s => s.length));
      const gutter = u * 4.2;
      const textW = ed.w - gutter - u * 3;
      const fs = clamp(textW / u / (maxLen * 0.62), 1.6, portrait ? 3.6 : 3.2);
      const top = ed.y + barH + u * 2;
      const avail = ed.y + ed.h - top - (review ? u * 9 : u * 3);
      const lh = Math.min(fs * u * 2.1, avail / lines.length);
      const rows = lines.map((s, i) => {
        const y = top + lh * (i + 0.75);
        const num = R.mono(ctx, g, String(i + 1), { x: ed.x + gutter - u * 1.2, y, size: Math.max(1.6, fs * 0.7), weight: 400, color: P.muted, anchor: "end" });
        const el = R.mono(ctx, g, "", { x: ed.x + gutter, y, size: fs, weight: 600, color: P.muted, anchor: "start" });
        return { s, y, num, el };
      });
      const gutLine = R.shape(ctx, g, (G, o) => [
        G.line(ed.x + gutter - u * 0.4, ed.y + barH + u, ed.x + gutter - u * 0.4, ed.y + ed.h - u, o),
      ], { color: P.muted, width: 0.9, seed: 3103 });

      // cursor de la máquina (barra que sigue a la escritura)
      const cursor = R.svg("rect", { width: (fs * u * 0.55).toFixed(2), height: (fs * u * 1.1).toFixed(2), fill: P.ink }, g);

      // ---- marcas humanas (lo único en lima) ----
      const charW = fs * u * 0.6;
      const bad = review && p.bad >= 0 && p.bad < rows.length ? rows[p.bad] : null;
      const crossEls = bad ? R.shape(ctx, g, (G, o) => [
        G.line(ed.x + gutter - u * 0.5, bad.y - fs * u * 0.35, ed.x + gutter + bad.s.length * charW + u * 0.5, bad.y - fs * u * 0.3, o),
      ], { color: P.accent, width: 2.6, seed: 3201 }) : [];
      const chkS = Math.min(u * 6, ed.w * 0.14);
      const chkX = ed.x + ed.w - chkS * 1.2, chkY = ed.y + ed.h - chkS * 0.9;
      const checkEls = review ? R.shape(ctx, g, (G, o) => [
        G.linearPath([[chkX - chkS * 0.5, chkY - chkS * 0.05], [chkX - chkS * 0.1, chkY + chkS * 0.35], [chkX + chkS * 0.6, chkY - chkS * 0.55]], o),
      ], { color: P.accent, width: 3, seed: 3202 }) : [];

      // ---- textos de zonas ----
      const whoEl = p.who ? R.mono(ctx, g, p.who.toUpperCase(), { x: cx, y: headY, size: 2.2, weight: 700, color: P.ink, anchor: "middle" }) : null;
      const noteEl = p.note ? R.hand(ctx, g, p.note, { x: cx, y: footY, size: 3, color: review ? P.accent : P.ink, anchor: "middle" }) : null;

      // la máquina escribe rápido: todas las líneas en ~1,4 s
      const typeAt = 0.35;
      const total = rows.reduce((a, r) => a + r.s.length, 0) || 1;
      return {
        render(lt, b, t) {
          // en modo ai la escritura llena casi todo el plano; en review, rápido para dejar lugar a la persona
          const typeDur = review ? 1.4 : clamp((b.dur || 3) * 0.6, 1.4, 3.2);
          R.draw(frameEls, lt, { start: 0, dur: 0.35, ease: "out", t });
          R.draw(barEls, lt, { start: 0.1, dur: 0.3, ease: "out", t });
          R.draw(gutLine, lt, { start: 0.2, dur: 0.3, ease: "out", t });
          fileEl.setAttribute("opacity", prog(lt, 0.15, 0.25));
          if (whoEl) whoEl.setAttribute("opacity", prog(lt, 0.05, 0.3));

          const q = prog(lt, typeAt, typeDur, "linear");
          let acc = 0, curRow = rows[0], curLen = 0;
          rows.forEach((r) => {
            const a0 = acc / total, a1 = (acc + r.s.length) / total; acc += r.s.length;
            const f = clamp((q - a0) / Math.max(0.001, a1 - a0));
            R.type(r.el, r.s, f);
            r.num.setAttribute("opacity", q >= a0 ? 1 : 0);
            if (q >= a0) { curRow = r; curLen = Math.round(r.s.length * f); }
          });
          // cursor: parpadea al terminar; en review desaparece cuando llega la persona
          const blink = q >= 1 ? (Math.floor(lt * 2.2) % 2 === 0 ? 1 : 0) : 1;
          const gone = review && lt > p.reviewAt ? 0 : 1;
          cursor.setAttribute("x", (ed.x + gutter + curLen * charW + u * 0.2).toFixed(2));
          cursor.setAttribute("y", (curRow.y - fs * u * 0.85).toFixed(2));
          cursor.setAttribute("opacity", (prog(lt, typeAt, 0.1) * blink * gone).toFixed(2));

          if (review) {
            R.draw(crossEls, lt, { start: p.reviewAt, dur: 0.35, ease: "out", t });
            if (bad) bad.el.setAttribute("opacity", lt > p.reviewAt + 0.3 ? 0.45 : 1);
            R.draw(checkEls, lt, { start: p.reviewAt + 0.55, dur: 0.4, ease: "out", t });
            if (noteEl) noteEl.setAttribute("opacity", prog(lt, p.reviewAt + 0.8, 0.4));
          } else if (noteEl) noteEl.setAttribute("opacity", prog(lt, typeAt + typeDur * 0.6, 0.4));

          // respiración lenta del editor
          const s = 1 + Math.min(lt, 12) * 0.003;
          g.setAttribute("transform", `translate(${cx} ${ed.y + ed.h / 2}) scale(${s.toFixed(4)}) translate(${-cx} ${-(ed.y + ed.h / 2)})`);

          if (lt > b.dur) R.exitFx(root, ctx, lt, b);
        },
        dispose() { root.remove(); },
      };
    },
  });
})();

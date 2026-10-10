/* HEMEROTECA abre como una primera plana limpia, en papel de archivo y bordó. */
(function () {
  "use strict";
  const K = window.Kit;
  const NS = "http://www.w3.org/2000/svg";
  const svg = (tag, attrs, parent) => {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v != null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  };
  const text = (parent, value, attrs) => {
    const e = svg("text", attrs, parent); e.textContent = value; return e;
  };
  const wrap = (value, max) => {
    const out = [""];
    for (const word of String(value || "").split(/\s+/).filter(Boolean)) {
      const i = out.length - 1, next = out[i] ? `${out[i]} ${word}` : word;
      if (out[i] && next.length > max) out.push(word); else out[i] = next;
    }
    return out.filter(Boolean);
  };
  K.register({
    name: "collage.intro", tags: ["apertura", "archivo", "título"], layer: "main", post: 0,
    summary: "Apertura de HEMEROTECA: masthead NODETECH, fecha de archivo, año grande y titular sobre papel claro con reglas bordó.",
    example: { number: "1989", before: "9 nov", after: "Berlín", line: "LA NOCHE QUE CAYÓ EL MURO" },
    params: {
      number: { type: "string", default: "1989", doc: "Año o cifra principal." },
      before: { type: "string", default: "", doc: "Fecha o contexto breve." },
      after: { type: "string", default: "", doc: "Lugar o segundo dato." },
      line: { type: "string", default: "", doc: "Titular de apertura." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const C = ctx.C.palette, { W, H, u, portrait } = ctx.stage;
      const root = svg("g", { "data-component": "collage.intro" }, ctx.layers.svg);
      const panel = { x: W * (portrait ? .065 : .11), y: H * .1, w: W * (portrait ? .87 : .78), h: H * .8 };
      svg("rect", { width: W, height: H, fill: C.bg }, root);
      svg("rect", { x: panel.x, y: panel.y, width: panel.w, height: panel.h, fill: C.bg2, stroke: C.accent, "stroke-width": Math.max(1, u * .22) }, root);
      svg("rect", { x: panel.x, y: panel.y, width: panel.w, height: u * 1.2, fill: C.accent }, root);
      const inset = u * (portrait ? 4 : 5), left = panel.x + inset, right = panel.x + panel.w - inset;
      const masthead = text(root, "NODETECH", { x: W/2, y: panel.y + panel.h * .19, fill: C.headline || C.ink, "font-family": "'Cinzel', serif", "font-size": u * 2.25, "font-weight": 700, "letter-spacing": u * .45, "text-anchor": "middle", opacity: 0 });
      const mastRule = svg("path", { d: `M${left} ${panel.y + panel.h*.22}H${right}`, stroke: C.accent, "stroke-width": Math.max(1,u*.18), "stroke-dasharray": panel.w, "stroke-dashoffset": panel.w }, root);
      const context = [p.before, p.after].filter(Boolean).join(" · ").toUpperCase();
      const meta = text(root, context, { x: W/2, y: panel.y + panel.h*.34, fill: C.muted, "font-family": "'Open Sans', sans-serif", "font-size": u*1.8, "font-weight": 600, "letter-spacing": u*.14, "text-anchor": "middle", opacity: 0 });
      const number = String(p.number || "");
      const numSize = Math.min(u * (portrait ? 19 : 22), H * .24, panel.w * .78 / Math.max(2, number.length * .6));
      const year = text(root, number, { x: W/2, y: panel.y + panel.h*.59, fill: C.year || C.accent, "font-family": "'Cormorant Garamond', serif", "font-size": numSize, "font-weight": 700, "text-anchor": "middle", opacity: 0 });
      year.setAttribute("textLength", Math.min(panel.w*.76, Math.max(numSize*2, number.length*numSize*.58)));
      year.setAttribute("lengthAdjust", "spacingAndGlyphs");
      svg("path", { d: `M${left} ${panel.y + panel.h*.66}H${right}`, stroke: C.accent, "stroke-width": Math.max(1,u*.12), opacity: .75 }, root);
      const titleLines = wrap(p.line, portrait ? 22 : 42), titleSize = u * (portrait ? 3.1 : 3.8), titleStart = panel.y + panel.h*.76;
      const titleEls = titleLines.map((line,i) => {
        const el = text(root, line, { x: W/2, y: titleStart + i*titleSize*1.2, fill: C.headline || C.ink, "font-family": "'Playfair Display', serif", "font-size": titleSize, "font-weight": 800, "text-anchor": "middle", opacity: 0 });
        el.setAttribute("textLength", Math.min(panel.w*.8, Math.max(titleSize*3, line.length*titleSize*.54)));
        el.setAttribute("lengthAdjust", "spacingAndGlyphs");
        return el;
      });
      return {
        render(lt, b) {
          const q = K.prog(lt, .05, .85, "out"), shift = (1-q)*u*2.2;
          root.setAttribute("opacity", (1-K.prog(lt,b.dur-.28,.28,"in")).toFixed(3));
          for (const el of [masthead,meta,year,...titleEls]) {
            el.setAttribute("opacity", q.toFixed(3));
            el.setAttribute("transform", `translate(0 ${shift.toFixed(2)})`);
          }
          mastRule.setAttribute("stroke-dashoffset", (panel.w*(1-K.prog(lt,.45,.55,"out"))).toFixed(1));
        },
        dispose() { root.remove(); },
      };
    },
  });
  const intro = K.registry.get("collage.intro");
  K.register({ ...intro, name: "collage.title", summary: "Alias compatible de collage.intro; usa la nueva apertura de archivo." });
})();

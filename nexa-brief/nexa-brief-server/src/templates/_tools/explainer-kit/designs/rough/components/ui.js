/* =============================================================================
   rough · diagramas y dispositivos (proceso, comparación, prioridades, panel,
   memoria tejida, indicador, descenso, conteo, decisión, línea de tiempo)
   -----------------------------------------------------------------------------
   Mismas convenciones que shapes.js. Cada componente usa ctx.stage.content
   para su caja y elige layout horizontal (16:9) o vertical (9:16).
   ========================================================================== */
(function () {
  const K = Kit, R = Kit.rough, { clamp, lerp, prog, ease, hash } = K;
  const pal = ctx => ctx.C.palette;
  const HEAD = (G, o, x0, y0, x1, y1, s) => {          /* punta de flecha a mano */
    const a = Math.atan2(y1 - y0, x1 - x0), L = s;
    return G.linearPath([[x1 - Math.cos(a - 0.5) * L, y1 - Math.sin(a - 0.5) * L], [x1, y1], [x1 - Math.cos(a + 0.5) * L, y1 - Math.sin(a + 0.5) * L]], o);
  };

  /* ------------------------------------------------------------------ flujo */
  K.register({
    name: "rough.flow", tags: ["proceso", "causa", "pasos", "sistema"], layer: "main",
    summary: "Cadena de 2-5 pasos (boceto + rótulo) unidos por flechas a mano que aparecen en orden: causa → efecto, un proceso, un sistema. `active` resalta un paso en lima.",
    example: { nodes: [{ icon: "radar", label: "RADAR" }, { icon: "chip", label: "COMPUTADORA" }, { icon: "alarm", label: "1202" }], active: 2 },
    params: {
      nodes: { type: "array", required: true, doc: "[{icon, label}] de 2 a 5." },
      active: { type: "number", default: -1, doc: "Índice resaltado (-1 = ninguno)." },
      stepSec: { type: "number", default: 0.8, doc: "Segundos entre paso y paso." },
      title: { type: "string", default: "", doc: "Etiqueta lima arriba." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, portrait } = ctx.stage, c = ctx.stage.content, n = p.nodes.length;
      const vert = portrait && n > 2;
      const s = vert ? Math.min(c.h / (n * 1.38), c.w * 0.4) : Math.min(c.w / (n * 1.6), c.h * 0.42);
      const pos = p.nodes.map((_, k) => vert ? { x: cx - s * 0.55, y: c.y + c.h / 2 + (k - (n - 1) / 2) * s * 1.5 } : { x: c.x + c.w / 2 + (k - (n - 1) / 2) * s * 1.6, y: ctx.stage.cy - u * 2 });
      const items = p.nodes.map((nd, k) => {
        const act = k === p.active, bx = { x: pos[k].x - s / 2, y: pos[k].y - s / 2, w: s, h: s };
        const els = R.sketch(ctx, g, nd.icon, bx, { color: act ? P.accent : P.ink, fill: act, width: 1.4, seed: 40 + k });
        const lab = vert ? R.text(ctx, g, nd.label, { x: pos[k].x + s * 0.7, y: pos[k].y, anchor: "start", size: 3.4, weight: 900, color: act ? P.accent : P.ink, opacity: 0 })
                         : R.text(ctx, g, nd.label, { x: pos[k].x, y: pos[k].y + s / 2 + u * 3.8, size: 2.6, weight: 900, color: act ? P.accent : P.ink, opacity: 0 });
        return { els, lab };
      });
      const arrows = [];
      for (let k = 0; k < n - 1; k++) {
        const a = pos[k], b = pos[k + 1], gap = s * 0.62;
        const [x0, y0, x1, y1] = vert ? [a.x, a.y + gap, b.x, b.y - gap] : [a.x + gap, a.y, b.x - gap, b.y];
        arrows.push(R.shape(ctx, g, (G, o) => [G.curve([[x0, y0], [(x0 + x1) / 2 + (vert ? u : 0), (y0 + y1) / 2 - (vert ? 0 : u * 1.2)], [x1, y1]], o), HEAD(G, o, x0, y0, x1, y1, u * 2)], { width: 1.3, seed: 60 + k }));
      }
      const title = p.title ? R.label(ctx, g, p.title, { x: cx, y: c.y + u * 2.5, size: 1.9 }) : null;
      return {
        render(lt, b, t) {
          items.forEach((it, k) => { R.draw(it.els, lt, { start: 0.1 + k * p.stepSec, total: 0.6, dur: 0.6, t }); it.lab.setAttribute("opacity", prog(lt, 0.4 + k * p.stepSec, 0.35)); });
          arrows.forEach((ar, k) => R.draw(ar, lt, { start: 0.55 + k * p.stepSec, dur: 0.4, t }));
          if (title) title.setAttribute("opacity", prog(lt, 0, 0.3));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ comparación de escala */
  K.register({
    name: "rough.compare", tags: ["escala", "comparación", "datos", "tamaño"], layer: "main",
    summary: "Comparación de escala por ÁREA: un cuadrado diminuto (lo chico, en lima) dentro de uno enorme (lo grande). Para 'millones de veces más': el chico queda casi un punto. Con valores y flecha manuscrita.",
    example: { small: { label: "APOLO 11", value: "4 KB" }, big: { label: "TU TELÉFONO", value: "MILLONES DE VECES MÁS" }, ratio: 1000000 },
    params: {
      small: { type: "object", required: true, doc: "{label, value} — lo pequeño (va en lima)." },
      big: { type: "object", required: true, doc: "{label, value} — lo grande." },
      ratio: { type: "number", default: 100, doc: "Cuántas veces más grande (área). Mínimo visible: un punto." },
      bigFirst: { type: "bool", default: false, doc: "true = primero el grande y después aparece el chico." },
      bigAt: { type: "number", default: 1.3, doc: "Segundo (local) en que se dibuja el grande (admite \"@palabra\")." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content;
      const S = Math.min(c.w, c.h) * (portrait ? 0.78 : 0.72), sx = cx - S / 2, sy = cy - S / 2 + u * 2;
      const sm = Math.max(u * 1.2, S / Math.sqrt(Math.max(1, p.ratio)));
      const big = R.shape(ctx, g, (G, o) => [G.rectangle(sx, sy, S, S, o)], { width: 1.4, seed: 71 });
      const small = R.shape(ctx, g, (G, o) => [G.rectangle(sx + u * 3, sy + S - u * 3 - sm, sm, sm, { ...o, fill: "F", fillStyle: sm > u * 4 ? "hachure" : "solid", hachureGap: u * 0.8 })], { color: P.accent, width: 1.6, seed: 72 });
      const ax = sx + u * 3 + sm / 2, ay = sy + S - u * 3 - sm - u * 1.5;
      const arrow = R.shape(ctx, g, (G, o) => [G.curve([[ax + S * 0.32, ay - S * 0.22], [ax + S * 0.12, ay - S * 0.16], [ax + u * 0.6, ay]], o), HEAD(G, o, ax + S * 0.1, ay - S * 0.1, ax + u * 0.6, ay, u * 2)], { color: P.accent, width: 1.4, seed: 73 });
      const tSmall = R.hand(ctx, g, "", { x: ax + S * 0.34, y: ay - S * 0.28, size: portrait ? 4.6 : 4, color: P.accent, anchor: "start" });
      const vSmall = R.mono(ctx, g, p.small.value || "", { x: ax + S * 0.34, y: ay - S * 0.28 + u * 4.6, size: 2.2, anchor: "start", color: P.accent, opacity: 0 });
      const tBig = R.text(ctx, g, p.big.label || "", { x: sx + u * 3, y: sy + u * 5, size: portrait ? 4 : 3.6, weight: 900, anchor: "start", opacity: 0 });
      const vBig = R.mono(ctx, g, p.big.value || "", { x: sx + u * 3, y: sy + u * 10, size: 2, anchor: "start", color: P.ink, opacity: 0 });
      const T = p.bigFirst ? { big: 0, small: 1.4 } : { small: 0, big: p.bigAt };
      return {
        render(lt, b, t) {
          R.draw(small, lt, { start: T.small + 0.1, dur: 0.5, t });
          R.draw(arrow, lt, { start: T.small + 0.4, dur: 0.5, t });
          R.type(tSmall, p.small.label || "", prog(lt, T.small + 0.6, 0.5, "linear")); vSmall.setAttribute("opacity", prog(lt, T.small + 0.9, 0.4));
          R.draw(big, lt, { start: T.big, dur: 1.1, ease: "inOut", t });
          tBig.setAttribute("opacity", prog(lt, T.big + 0.8, 0.4)); vBig.setAttribute("opacity", prog(lt, T.big + 1.0, 0.4));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ pila de prioridades */
  K.register({
    name: "rough.stack", tags: ["prioridades", "lista", "sistema", "descartar"], layer: "main",
    summary: "Pila de tareas en cajas a mano; en `dropAt` las que no se conservan se tachan y caen, y las importantes suben y se pintan de lima. Para prioridades, triage, 'soltar lo secundario'.",
    example: { title: "PRIORIDADES", items: [{ label: "ATERRIZAR", keep: true }, { label: "NAVEGAR", keep: true }, { label: "PANTALLA" }, { label: "RADAR" }], dropAt: 2.4 },
    params: {
      items: { type: "array", required: true, doc: "[{label, keep}] de arriba (más importante) hacia abajo, 2-6." },
      dropAt: { type: "number", default: -1, doc: "Segundo (local) en que se descarta lo secundario (-1 = nunca)." },
      title: { type: "string", default: "", doc: "Etiqueta lima arriba." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, portrait } = ctx.stage, c = ctx.stage.content, n = p.items.length;
      const w = Math.min(c.w * (portrait ? 0.86 : 0.5), u * 70), h = Math.min(c.h * 0.8 / n, u * 11), gap = h * 0.28, H = n * h + (n - 1) * gap, y0 = ctx.stage.cy - H / 2;
      const rows = p.items.map((it, k) => {
        const gg = R.svg("g", null, g), y = y0 + k * (h + gap);
        const box = R.shape(ctx, gg, (G, o) => [G.rectangle(cx - w / 2, y, w, h, o)], { width: 1.3, seed: 80 + k });
        const fill = it.keep ? R.shape(ctx, gg, (G, o) => [G.rectangle(cx - w / 2, y, w, h, { ...o, stroke: "none", fill: "F", fillStyle: "hachure", hachureGap: u * 1.6 })], { color: P.accent, fillColor: P.accent, width: 0.7, seed: 90 + k }) : [];
        fill.forEach(e => e.setAttribute("stroke-opacity", 0.35));
        const num = R.mono(ctx, gg, String(k + 1).padStart(2, "0"), { x: cx - w / 2 + u * 3, y: y + h / 2, size: 1.8, anchor: "start", color: P.muted, opacity: 0 });
        const lab = R.text(ctx, gg, it.label, { x: cx - w / 2 + u * 9, y: y + h / 2, size: Math.min(3.6, h / u * 0.36), weight: 900, anchor: "start", opacity: 0 });
        const cross = it.keep ? [] : R.shape(ctx, gg, (G, o) => [G.line(cx - w / 2 - u * 2, y + h * 0.55, cx + w / 2 + u * 2, y + h * 0.45, o)], { color: P.accent, width: 2, seed: 100 + k });
        return { gg, box, fill, num, lab, cross, keep: !!it.keep, y, k };
      });
      const keepIdx = rows.filter(r => r.keep).map(r => r.k);
      const title = p.title ? R.label(ctx, g, p.title, { x: cx, y: y0 - u * 5, size: 1.9 }) : null;
      return {
        render(lt, b, t) {
          rows.forEach(r => {
            R.draw(r.box, lt, { start: 0.1 + r.k * 0.18, dur: 0.6, t });
            r.num.setAttribute("opacity", prog(lt, 0.4 + r.k * 0.18, 0.3)); r.lab.setAttribute("opacity", prog(lt, 0.45 + r.k * 0.18, 0.3));
            if (p.dropAt < 0) return;
            const d = prog(lt, p.dropAt, 0.9, "in");
            if (r.keep) {
              R.draw(r.fill, lt, { start: p.dropAt + 0.5, dur: 0.5, t });
              const ny = y0 + keepIdx.indexOf(r.k) * (h + gap), dy = (ny - r.y) * prog(lt, p.dropAt + 0.6, 0.6, "inOut");
              r.gg.setAttribute("transform", `translate(0 ${dy.toFixed(1)})`);
              const on = prog(lt, p.dropAt + 0.5, 0.1) > 0.5;
              r.box.forEach(e => e.setAttribute("stroke", on ? P.accent : P.ink));
              r.num.setAttribute("fill", on ? P.accent : P.muted);
            } else {
              R.draw(r.cross, lt, { start: p.dropAt - 0.35 + r.k * 0.05, dur: 0.3, t });
              r.gg.setAttribute("transform", `translate(${(r.k % 2 ? 1 : -1) * d * u * 6} ${d * u * 40}) rotate(${(r.k % 2 ? 1 : -1) * d * 9} ${cx} ${r.y + h / 2})`);
              r.gg.setAttribute("opacity", (1 - d).toFixed(3));
            }
          });
          if (title) title.setAttribute("opacity", prog(lt, 0, 0.3));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ DSKY */
  K.register({
    name: "rough.dsky", tags: ["computadora", "pantalla", "alarma", "apolo"], layer: "main",
    summary: "Panel de la computadora del Apolo (DSKY) dibujado a mano: luces de aviso, pantalla PROG/VERB/NOUN y teclado. El código (p. ej. 1202) aparece en lima y parpadea con la luz PROG encendida.",
    example: { code: "1202", alarm: true },
    params: {
      code: { type: "string", default: "1202", doc: "Código que aparece en la pantalla (4-5 dígitos)." },
      alarm: { type: "bool", default: true, doc: "Luz PROG encendida y código parpadeando." },
      verb: { type: "string", default: "05", doc: "Valor VERB." },
      noun: { type: "string", default: "09", doc: "Valor NOUN." },
      size: { type: "number", default: 0.86, min: 0.3, max: 1, doc: "Fracción del contenido." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u } = ctx.stage, bx = R.boxIn(ctx, p.size, 0.86);
      const X = f => bx.x + f * bx.w, Y = f => bx.y + f * bx.h, s = bx.w / 100;
      const panel = R.shape(ctx, g, (G, o) => [G.rectangle(bx.x, bx.y, bx.w, bx.h, o), G.line(X(0.5), Y(0.03), X(0.5), Y(0.55), { ...o, seed: 3 }), G.line(X(0.03), Y(0.58), X(0.97), Y(0.58), { ...o, seed: 4 })], { width: 1.4, seed: 111 });
      const LIGHTS = ["UPLINK", "TEMP", "NO ATT", "GIMBAL", "STBY", "PROG", "KEY REL", "RESTART", "OPR ERR", "TRACKER"];
      const lights = LIGHTS.map((lab, k) => {
        const col = k % 2, row = Math.floor(k / 2), x = X(0.06 + col * 0.21), y = Y(0.06 + row * 0.095), w = bx.w * 0.18, h = bx.h * 0.07;
        const on = p.alarm && (lab === "PROG" || lab === "RESTART");
        const box = R.shape(ctx, g, (G, o) => [G.rectangle(x, y, w, h, on ? { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.5 } : o)], { color: on ? P.accent : P.muted, fillColor: P.accent, width: 1, seed: 120 + k });
        const t = R.mono(ctx, g, lab, { x: x + w / 2, y: y + h / 2, size: Math.min(1.25, w / u / 7), color: on ? P.ink : P.muted, opacity: 0, spacing: 0.05 });
        return { box, t, on };
      });
      const disp = [["PROG", "63"], ["VERB", p.verb], ["NOUN", p.noun]].map(([lab, val], k) => {
        const x = X(0.56 + (k === 0 ? 0.22 : (k - 1) * 0.22)), y = Y(k === 0 ? 0.08 : 0.22);
        return { lab: R.mono(ctx, g, lab, { x, y, size: 1.2, color: P.muted, opacity: 0 }), val: R.text(ctx, g, val, { x, y: y + s * 6, size: s * 7 / u, weight: 800, font: "'JetBrains Mono', monospace", color: P.accent, opacity: 0 }) };
      });
      /* registro: líneas arriba y abajo del código (nunca encima: tapaban los dígitos) */
      const rows = [0.345, 0.535].map((f, k) => R.shape(ctx, g, (G, o) => [G.line(X(0.56), Y(f), X(0.94), Y(f), o)], { color: P.muted, width: 0.8, seed: 140 + k }));
      const code = R.text(ctx, g, "", { x: X(0.75), y: Y(0.44), size: s * 13 / u, weight: 800, font: "'JetBrains Mono', monospace", color: P.accent });
      code.setAttribute("filter", "drop-shadow(0 0 6px rgba(200,255,46,.55))");
      const KEYS = ["VERB", "+", "7", "8", "9", "CLR", "NOUN", "-", "4", "5", "6", "PRO", "", "0", "1", "2", "3", "KEY", "", "", "ENTR", "RSET", "", ""];
      const keys = [];
      KEYS.forEach((lab, k) => {
        if (!lab) return;
        const col = k % 6, row = Math.floor(k / 6), x = X(0.06 + col * 0.148), y = Y(0.63 + row * 0.088), w = bx.w * 0.12, h = bx.h * 0.07;
        keys.push({ box: R.shape(ctx, g, (G, o) => [G.rectangle(x, y, w, h, o)], { width: 0.9, seed: 160 + k }), t: R.mono(ctx, g, lab, { x: x + w / 2, y: y + h / 2, size: Math.min(1.5, w / u / 4), color: P.ink, opacity: 0, spacing: 0.02 }) });
      });
      return {
        render(lt, b, t) {
          R.draw(panel, lt, { start: 0, dur: 0.8, t });
          lights.forEach((L, k) => { R.draw(L.box, lt, { start: 0.25 + k * 0.04, dur: 0.4, t }); L.t.setAttribute("opacity", prog(lt, 0.5 + k * 0.04, 0.3)); });
          keys.forEach((K2, k) => { R.draw(K2.box, lt, { start: 0.45 + k * 0.025, dur: 0.35, t }); K2.t.setAttribute("opacity", prog(lt, 0.7 + k * 0.025, 0.3)); });
          disp.forEach((d, k) => { d.lab.setAttribute("opacity", prog(lt, 0.6 + k * 0.1, 0.3)); d.val.setAttribute("opacity", prog(lt, 0.8 + k * 0.1, 0.2)); });
          rows.forEach((r, k) => R.draw(r, lt, { start: 0.7 + k * 0.08, dur: 0.4, t }));
          /* el código entra "tecleado" con dígitos al azar y después parpadea si hay alarma */
          const q = prog(lt, 1.2, 0.5, "linear"), n = Math.round(q * p.code.length);
          code.textContent = p.code.slice(0, n) + (q < 1 ? String(hash(Math.floor(lt * 20)) % 10) : "");
          /* parpadeo: 70% encendido / 30% casi apagado, ~1.6 Hz (se lee siempre) */
          const blink = p.alarm && lt > 1.8 ? (((lt - 1.8) * 1.6) % 1 < 0.7 ? 1 : 0.22) : 1;
          code.setAttribute("opacity", blink);
          lights.forEach(L => { if (L.on && lt > 1.8) L.box.forEach(e => e.setAttribute("opacity", blink)); });
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ memoria tejida */
  K.register({
    name: "rough.rope", tags: ["memoria", "datos", "unos y ceros", "tejido"], layer: "main",
    summary: "Memoria de cuerda (core rope): anillos magnéticos en fila y un alambre que se teje: si ATRAVIESA el anillo es 1, si lo RODEA es 0. Los bits aparecen debajo a medida que pasa el alambre.",
    example: { bits: "101101", caption: "tejido a mano" },
    params: {
      bits: { type: "string", default: "1011", doc: "Bits (3-8 caracteres '0'/'1')." },
      caption: { type: "string", default: "", doc: "Nota manuscrita." },
      drawSec: { type: "number", default: 2.6, doc: "Segundos que tarda el alambre en tejerse." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content, bits = [...p.bits.replace(/[^01]/g, "")], n = bits.length;
      const step = Math.min(c.w / (n + 0.6), u * 22), r = step * 0.3, x0 = cx - step * (n - 1) / 2, y0 = cy - u * (portrait ? 4 : 2);
      const rings = bits.map((_, k) => R.shape(ctx, g, (G, o) => [G.circle(x0 + k * step, y0, r * 2, o), G.circle(x0 + k * step, y0, r * 1.1, { ...o, seed: o.seed + 5 })], { width: 1.5, seed: 200 + k }));
      const pts = [[x0 - step * 0.8, y0 + r * 0.1]];
      bits.forEach((bt, k) => { const x = x0 + k * step; if (bt === "1") pts.push([x - r * 1.2, y0], [x, y0], [x + r * 1.2, y0]); else pts.push([x - r * 1.35, y0 - r * 0.3], [x, y0 - r * 1.6], [x + r * 1.35, y0 - r * 0.3]); });
      pts.push([x0 + (n - 1) * step + step * 0.8, y0]);
      const wire = R.shape(ctx, g, (G, o) => [G.curve(pts, { ...o, roughness: 0.6 })], { color: P.accent, width: 1.7, seed: 230 });
      const labels = bits.map((bt, k) => R.text(ctx, g, bt, { x: x0 + k * step, y: y0 + r + u * 6, size: portrait ? 6 : 5, weight: 900, font: "'JetBrains Mono', monospace", color: bt === "1" ? P.accent : P.ink, opacity: 0 }));
      const legend = [R.mono(ctx, g, "ATRAVIESA = 1", { x: cx, y: y0 - r - u * 9, size: 1.7, color: P.accent, opacity: 0 }), R.mono(ctx, g, "RODEA = 0", { x: cx, y: y0 - r - u * 5.5, size: 1.7, color: P.ink, opacity: 0 })];
      const cap = p.caption ? R.hand(ctx, g, "", { x: cx, y: y0 + r + u * 15, size: 4.4, color: P.accent }) : null;
      return {
        render(lt, b, t) {
          rings.forEach((rg, k) => R.draw(rg, lt, { start: 0.05 + k * 0.08, dur: 0.5, t }));
          const q = prog(lt, 0.7, p.drawSec, "linear");
          wire.forEach(e => e.setAttribute("stroke-dashoffset", (1 - q).toFixed(4)));
          labels.forEach((l, k) => l.setAttribute("opacity", prog(q, (k + 0.7) / (n + 1), 0.08)));
          legend.forEach((l, k) => l.setAttribute("opacity", prog(lt, 0.4 + k * 0.2, 0.4)));
          if (cap) R.type(cap, p.caption, prog(lt, 0.7 + p.drawSec, 0.6, "linear"));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ indicador / cuenta regresiva */
  K.register({
    name: "rough.gauge", tags: ["combustible", "cuenta regresiva", "nivel", "urgencia"], layer: "main",
    summary: "Indicador semicircular a mano con aguja y número grande que baja (o sube) de `from` a `to`: combustible, tiempo que queda, presión. La zona crítica final parpadea en lima.",
    example: { from: 60, to: 30, unit: "SEGUNDOS", label: "COMBUSTIBLE" },
    params: {
      from: { type: "number", default: 60, doc: "Valor inicial." },
      to: { type: "number", default: 30, doc: "Valor final." },
      max: { type: "number", default: 0, doc: "Escala máxima del dial (0 = max(from,to))." },
      dur: { type: "number", default: 3, doc: "Segundos que tarda en llegar a `to`." },
      unit: { type: "string", default: "", doc: "Unidad bajo el número." },
      label: { type: "string", default: "", doc: "Etiqueta lima arriba." },
      critical: { type: "number", default: 0.25, doc: "Fracción del dial considerada crítica (zona rayada)." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content;
      const Rr = Math.min(c.w * 0.42, c.h * 0.42), oy = cy + Rr * 0.3, M = p.max || Math.max(p.from, p.to);
      const ang = v => Math.PI + clamp(v / M) * Math.PI;      /* 0 → izquierda, M → derecha */
      const dial = R.shape(ctx, g, (G, o) => {
        const out = [G.arc(cx, oy, Rr * 2, Rr * 2, Math.PI, Math.PI * 2, false, o)];
        for (let k = 0; k <= 10; k++) { const a = Math.PI + k / 10 * Math.PI, r0 = Rr * (k % 5 ? 0.9 : 0.84); out.push(G.line(cx + Math.cos(a) * r0, oy + Math.sin(a) * r0, cx + Math.cos(a) * Rr * 0.98, oy + Math.sin(a) * Rr * 0.98, { ...o, seed: o.seed + k })); }
        return out;
      }, { width: 1.5, seed: 300 });
      const crit = R.shape(ctx, g, (G, o) => [G.arc(cx, oy, Rr * 1.7, Rr * 1.7, Math.PI, Math.PI * (1 + p.critical), true, { ...o, fill: "F", fillStyle: "hachure", hachureGap: u * 0.8 })], { color: P.accent, fillColor: P.accent, width: 1, seed: 301 });
      const needle = R.svg("g", null, g);
      const nd = R.shape(ctx, needle, (G, o) => [G.line(cx, oy, cx + Rr * 0.78, oy, { ...o, roughness: 0.5 }), G.circle(cx, oy, u * 3, o)], { width: 2, seed: 302 });
      const num = R.text(ctx, g, "", { x: cx, y: oy - Rr * 0.32, size: Rr / u * 0.45, weight: 900, color: P.ink });
      const unit = p.unit ? R.mono(ctx, g, p.unit, { x: cx, y: oy + u * 5, size: 1.8, color: P.muted, opacity: 0 }) : null;
      const label = p.label ? R.label(ctx, g, p.label, { x: cx, y: oy - Rr - u * 5, size: 1.9 }) : null;
      return {
        render(lt, b, t) {
          R.draw(dial, lt, { start: 0, dur: 0.8, t }); R.draw(crit, lt, { start: 0.5, dur: 0.5, t }); R.draw(nd, lt, { start: 0.6, dur: 0.3, t });
          const q = prog(lt, 0.8, p.dur, "linear"), v = lerp(p.from, p.to, q), a = ang(v);
          needle.setAttribute("transform", `rotate(${(a * 180 / Math.PI).toFixed(2)} ${cx} ${oy})`);
          num.textContent = String(Math.round(v));
          const critical = v / M <= p.critical, bl = critical && Math.floor(lt * 3) % 2 === 0;
          num.setAttribute("fill", critical ? P.accent : P.ink); num.setAttribute("opacity", prog(lt, 0.5, 0.3) * (bl ? 0.35 : 1));
          if (unit) unit.setAttribute("opacity", prog(lt, 0.7, 0.3));
          if (label) label.setAttribute("opacity", prog(lt, 0, 0.3));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ descenso */
  K.register({
    name: "rough.descent", tags: ["trayectoria", "aterrizaje", "maniobra", "luna"], layer: "main",
    summary: "Vista lateral de un descenso: suelo lunar a mano con cráter y rocas, el módulo lunar bajando por su trayectoria. mode=auto va directo al cráter; mode=manual se desvía en el último tramo hasta una zona plana marcada con X.",
    example: { mode: "manual", hazard: "CRÁTER CON ROCAS", target: "zona plana" },
    params: {
      mode: { type: "enum", options: ["auto", "manual"], default: "manual", doc: "Trayectoria." },
      dur: { type: "number", default: 4.5, doc: "Segundos del descenso completo." },
      hazard: { type: "string", default: "", doc: "Rótulo del cráter." },
      target: { type: "string", default: "", doc: "Nota manuscrita del punto de aterrizaje." },
      altFrom: { type: "number", default: 150, doc: "Altitud inicial mostrada (m)." },
      divertAt: { type: "number", default: -1, doc: "Segundo (local) en que empieza el desvío manual (admite \"@palabra\"; -1 = al 60%)." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, portrait } = ctx.stage, c = ctx.stage.content;
      const gy = c.y + c.h * 0.82, hz = { x: c.x + c.w * 0.5, w: c.w * (portrait ? 0.42 : 0.3) }, tx = c.x + c.w * (portrait ? 0.84 : 0.86);
      const ground = R.shape(ctx, g, (G, o) => [G.curve([[c.x - u * 4, gy], [c.x + c.w * 0.2, gy - u], [hz.x - hz.w * 0.6, gy + u * 0.5], [c.x + c.w * 0.75, gy - u * 0.4], [c.x + c.w + u * 4, gy]], o)], { width: 1.4, seed: 400 });
      const crater = R.sketch(ctx, g, "crater", { x: hz.x - hz.w / 2, y: gy - hz.w * 0.18, w: hz.w, h: hz.w * 0.4 }, { width: 1.2, seed: 401 });
      const rocks = R.sketch(ctx, g, "rocks", { x: hz.x - hz.w * 0.3, y: gy - hz.w * 0.16, w: hz.w * 0.6, h: hz.w * 0.18 }, { width: 1.1, seed: 402 });
      const xMark = R.shape(ctx, g, (G, o) => [G.line(tx - u * 2.4, gy - u * 2.4, tx + u * 2.4, gy + u * 0.6, o), G.line(tx + u * 2.4, gy - u * 2.4, tx - u * 2.4, gy + u * 0.6, { ...o, seed: 7 })], { color: P.accent, width: 2, seed: 403 });
      /* trayectoria: de arriba a la izquierda hacia el cráter; en manual, desvío horizontal al final */
      const A = [c.x + c.w * 0.08, c.y + c.h * 0.08], Bc = [hz.x, gy - u * 4], Bt = [tx, gy - u * 4];
      const split = p.divertAt > 0.8 ? clamp((p.divertAt - 0.8) / p.dur, 0.2, 0.9) : 0.6;
      const pos = q => {
        if (p.mode === "auto") { const e = ease.inOut(q); return [lerp(A[0], Bc[0], e), lerp(A[1], Bc[1], ease.out(q))]; }
        if (q < split) { const e = q / split; return [lerp(A[0], hz.x - hz.w * 0.1, ease.out(e)), lerp(A[1], gy - c.h * 0.22, ease.inOut(e))]; }
        const e = (q - split) / (1 - split); return [lerp(hz.x - hz.w * 0.1, Bt[0], ease.inOut(e)), lerp(gy - c.h * 0.22, Bt[1], ease.in(e))];
      };
      const N = 40, trail = R.shape(ctx, g, (G, o) => [G.curve(Array.from({ length: N + 1 }, (_, k) => pos(k / N)), { ...o, roughness: 0.4 })], { color: P.muted, width: 0.9, seed: 404 });
      const lm = R.svg("g", null, g), S = u * (portrait ? 13 : 10);
      const lmEls = R.sketch(ctx, lm, "lm", { x: -S / 2, y: -S * 0.92, w: S, h: S * 0.92 }, { width: 1.3, seed: 405, fill: true });
      const hzT = p.hazard ? R.mono(ctx, g, p.hazard, { x: hz.x, y: gy + u * 5, size: 1.6, color: P.ink, opacity: 0 }) : null;
      const tgT = p.target ? R.hand(ctx, g, "", { x: tx, y: gy + u * 6, size: 4, color: P.accent }) : null;
      const alt = R.mono(ctx, g, "", { x: c.x + c.w, y: c.y + u * 2, size: 2, anchor: "end", color: P.ink });
      return {
        render(lt, b, t) {
          R.draw(ground, lt, { start: 0, dur: 0.8, t }); R.draw(crater, lt, { start: 0.3, total: 0.4, dur: 0.5, t }); R.draw(rocks, lt, { start: 0.5, total: 0.3, dur: 0.4, t });
          const q = prog(lt, 0.8, p.dur, "linear"), [x, y] = pos(q);
          trail.forEach(e => e.setAttribute("stroke-dashoffset", (1 - q).toFixed(4)));
          R.draw(lmEls, lt, { start: 0.3, total: 0.5, dur: 0.5, t });
          lm.setAttribute("transform", `translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${(p.mode === "manual" && q > split - 0.05 && q < 0.95 ? -8 * Math.sin((q - split + 0.05) / (1 - split) * Math.PI) : 0).toFixed(2)})`);
          if (hzT) hzT.setAttribute("opacity", prog(lt, 0.7, 0.4));
          if (p.mode === "manual") { R.draw(xMark, lt, { start: 0.8 + p.dur * (split + 0.02), dur: 0.4, t }); if (tgT) R.type(tgT, p.target, prog(lt, 0.8 + p.dur * (split + 0.1), 0.5, "linear")); }
          alt.textContent = `ALT ${Math.max(0, Math.round(p.altFrom * (1 - q)))} m`;
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ conteo / repetición */
  K.register({
    name: "rough.tally", tags: ["repetición", "conteo", "alarma", "veces"], layer: "main",
    summary: "Algo que se repite N veces: boceto que se sacude en cada repetición, palotes a mano (|||| tachados de a 5) y contador grande '×N'.",
    example: { icon: "alarm", count: 5, interval: 0.55, label: "ALARMA 1202" },
    params: {
      icon: { type: "icon", default: "alarm", doc: "Boceto que se sacude." },
      count: { type: "number", default: 5, min: 1, max: 15, doc: "Cantidad de repeticiones." },
      interval: { type: "number", default: 0.6, doc: "Segundos entre repeticiones." },
      label: { type: "string", default: "", doc: "Etiqueta lima arriba." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content;
      const S = Math.min(c.w, c.h) * 0.36, ic = R.svg("g", null, g), icY = portrait ? cy - S * 0.7 : cy - u * 2, icX = portrait ? cx : cx - c.w * 0.22;
      const iEls = R.sketch(ctx, ic, p.icon, { x: icX - S / 2, y: icY - S / 2, w: S, h: S }, { width: 1.5, color: P.accent, seed: 500 });
      const tx = portrait ? cx - u * 16 : cx + c.w * 0.02, ty = portrait ? cy + S * 0.55 : cy - u * 4, mk = u * 3.2;
      const marks = Array.from({ length: p.count }, (_, k) => {
        const grp = Math.floor(k / 5), i = k % 5, x0 = tx + grp * mk * 6 + i * mk;
        return R.shape(ctx, g, (G, o) => [i === 4 ? G.line(x0 - mk * 4.4, ty + u * 6, x0 + mk * 0.2, ty - u * 1, o) : G.line(x0, ty - u * 1.5, x0 + u * 0.4, ty + u * 7, o)], { width: 1.8, seed: 520 + k });
      });
      const num = R.text(ctx, g, "", { x: portrait ? cx : tx + mk * 2.5, y: ty + u * (portrait ? 18 : 17), size: portrait ? 11 : 9, weight: 900, color: P.ink, anchor: portrait ? "middle" : "start" });
      const label = p.label ? R.label(ctx, g, p.label, { x: cx, y: c.y + u * 1, size: 1.9 }) : null;
      return {
        render(lt, b, t) {
          R.draw(iEls, lt, { start: 0, total: 0.5, dur: 0.5, t });
          let n = 0;
          marks.forEach((m, k) => { const s = 0.6 + k * p.interval; R.draw(m, lt, { start: s, dur: 0.18, ease: "out", t }); if (lt >= s) n = k + 1; });
          const since = n ? lt - (0.6 + (n - 1) * p.interval) : 9, sh = since < 0.35 ? Math.sin(since * 60) * (1 - since / 0.35) * 9 : 0;
          ic.setAttribute("transform", `rotate(${sh.toFixed(2)} ${icX} ${icY - S * 0.4})`);
          num.textContent = n ? "×" + n : ""; num.setAttribute("fill", since < 0.2 ? P.accent : P.ink);
          if (label) label.setAttribute("opacity", prog(lt, 0, 0.3));
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ decisión */
  K.register({
    name: "rough.choice", tags: ["decisión", "opciones", "dilema", "elección"], layer: "main",
    summary: "Dos (o tres) opciones en cajas a mano; en `pickAt` la elegida se pinta de lima con un ✓ y las otras se tachan. Para decisiones bajo presión (ABORTAR / SEGUIR).",
    example: { options: ["ABORTAR", "SEGUIR"], pick: 1, pickAt: 2.2, question: "¿y ahora?" },
    params: {
      options: { type: "array", required: true, doc: "2-3 textos cortos." },
      pick: { type: "number", default: -1, doc: "Índice elegido (-1 = sin decidir)." },
      pickAt: { type: "number", default: 2, doc: "Segundo (local) de la decisión." },
      question: { type: "string", default: "", doc: "Pregunta manuscrita arriba." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content, n = p.options.length;
      const w = portrait ? c.w * 0.78 : Math.min(c.w / n * 0.8, u * 60), h = portrait ? Math.min(c.h / (n + 1), u * 18) : u * 22;
      const boxes = p.options.map((txt, k) => {
        const x = portrait ? cx - w / 2 : cx + (k - (n - 1) / 2) * w * 1.18 - w / 2, y = portrait ? cy + (k - (n - 1) / 2) * h * 1.35 - h / 2 + u * 3 : cy - h / 2 + u * 3;
        const pick = k === p.pick;
        return {
          x, y, pick,
          box: R.shape(ctx, g, (G, o) => [G.rectangle(x, y, w, h, o)], { width: 1.5, seed: 600 + k }),
          fill: pick ? R.shape(ctx, g, (G, o) => [G.rectangle(x, y, w, h, { ...o, stroke: "none", fill: "F", fillStyle: "hachure", hachureGap: u * 1.5 })], { color: P.accent, fillColor: P.accent, width: 0.8, seed: 610 + k }) : [],
          mark: pick ? R.sketch(ctx, g, "check", { x: x + w - h * 0.55, y: y - h * 0.35, w: h * 0.7, h: h * 0.7 }, { color: P.accent, width: 2.4, seed: 620 }) : R.shape(ctx, g, (G, o) => [G.line(x - u * 2, y + h * 0.6, x + w + u * 2, y + h * 0.4, o)], { color: P.accent, width: 2.2, seed: 630 + k }),
          t: R.text(ctx, g, txt, { x: x + w / 2, y: y + h / 2, size: Math.min(h / u * 0.42, w / u / Math.max(4, txt.length) * 1.5), weight: 900, opacity: 0 }),
        };
      });
      const q = p.question ? R.hand(ctx, g, "", { x: cx, y: (portrait ? boxes[0].y : boxes[0].y) - u * 8, size: portrait ? 5.4 : 4.6, color: P.ink }) : null;
      return {
        render(lt, b, t) {
          if (q) R.type(q, p.question, prog(lt, 0, 0.5, "linear"));
          boxes.forEach((B, k) => {
            R.draw(B.box, lt, { start: 0.3 + k * 0.2, dur: 0.6, t }); B.t.setAttribute("opacity", prog(lt, 0.6 + k * 0.2, 0.3));
            if (p.pick < 0) return;
            const d = prog(lt, p.pickAt, 0.4);
            R.draw(B.fill, lt, { start: p.pickAt, dur: 0.5, t }); R.draw(B.mark, lt, { start: p.pickAt + 0.15, dur: 0.35, ease: "out", t });
            B.fill.forEach(e => e.setAttribute("stroke-opacity", 0.4));
            if (B.pick) { B.t.setAttribute("fill", d > 0.5 ? P.accent : P.ink); B.box.forEach(e => e.setAttribute("stroke", d > 0.5 ? P.accent : P.ink)); }
            if (!B.pick) { B.t.setAttribute("opacity", (prog(lt, 0.6 + k * 0.2, 0.3) * (1 - 0.6 * d)).toFixed(3)); B.box.forEach(e => e.setAttribute("opacity", 1 - 0.6 * d)); }
          });
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });

  /* ------------------------------------------------------------------ línea de tiempo */
  K.register({
    name: "rough.timeline", tags: ["tiempo", "fechas", "historia", "cronología"], layer: "main",
    summary: "Línea de tiempo a mano (vertical en 9:16, horizontal en 16:9) con hitos que se marcan al pasar el trazo; el hito `active` va en lima con círculo a mano.",
    example: { items: [{ year: "1961", label: "Kennedy: la Luna" }, { year: "1965", label: "Hamilton entra al MIT" }, { year: "1969", label: "Apolo 11" }], active: 2 },
    params: {
      items: { type: "array", required: true, doc: "[{year, label}] 2-6." },
      active: { type: "number", default: -1, doc: "Índice resaltado." },
      drawSec: { type: "number", default: 1.8, doc: "Segundos del trazo completo." },
    },
    create(ctx, p) {
      const P = pal(ctx), g = R.root(ctx), { u, cx, cy, portrait } = ctx.stage, c = ctx.stage.content, n = p.items.length;
      const [x0, y0, x1, y1] = portrait ? [cx - c.w * 0.18, c.y + c.h * 0.05, cx - c.w * 0.18, c.y + c.h * 0.95] : [c.x + c.w * 0.04, cy, c.x + c.w * 0.96, cy];
      const axis = R.shape(ctx, g, (G, o) => [G.line(x0, y0, x1, y1, { ...o, roughness: 0.8 })], { width: 1.4, seed: 700 });
      const pts = p.items.map((it, k) => {
        const f = n === 1 ? 0.5 : 0.08 + k / (n - 1) * 0.84, x = lerp(x0, x1, f), y = lerp(y0, y1, f), act = k === p.active;
        const dot = R.shape(ctx, g, (G, o) => [G.circle(x, y, u * (act ? 3 : 2), { ...o, fill: "F", fillStyle: "solid" })], { color: act ? P.accent : P.ink, fillColor: act ? P.accent : P.ink, width: 1, seed: 710 + k });
        const ring = act ? R.shape(ctx, g, (G, o) => [G.ellipse(portrait ? x + c.w * 0.22 : x, portrait ? y - u * 0.5 : y - u * 7, portrait ? c.w * 0.5 : u * 22, portrait ? u * 14 : u * 10, o)], { color: P.accent, width: 1.4, seed: 720 }) : [];
        const side = portrait ? 1 : (k % 2 ? 1 : -1);
        const yr = R.text(ctx, g, it.year, { x: portrait ? x + u * 5 : x, y: portrait ? y - u * 2.2 : y + side * u * 6.5, size: portrait ? 5 : 4, weight: 900, anchor: portrait ? "start" : "middle", color: act ? P.accent : P.ink, opacity: 0 });
        const lb = R.hand(ctx, g, it.label || "", { x: portrait ? x + u * 5 : x, y: portrait ? y + u * 3 : y + side * u * 11, size: portrait ? 4 : 3.4, anchor: portrait ? "start" : "middle", color: P.ink, opacity: 0 });
        return { f, dot, ring, yr, lb };
      });
      return {
        render(lt, b, t) {
          R.draw(axis, lt, { start: 0.1, dur: p.drawSec, ease: "linear", t });
          pts.forEach(pt => {
            const s = 0.1 + pt.f * p.drawSec;
            R.draw(pt.dot, lt, { start: s, dur: 0.25, t }); pt.yr.setAttribute("opacity", prog(lt, s, 0.3)); pt.lb.setAttribute("opacity", prog(lt, s + 0.15, 0.3));
            R.draw(pt.ring, lt, { start: 0.3 + p.drawSec, dur: 0.6, t });
          });
          if (lt > b.dur) R.exitFx(g, ctx, lt, b);
        },
        dispose() { g.remove(); },
      };
    },
  });
})();

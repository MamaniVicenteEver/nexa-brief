/* lyrics-trazo · escenas de letra.
   - word  : una palabra (o dos muy cortas) rotulada a mano a pantalla grande.
   - burst : ráfaga para palabras sostenidas: la palabra y sus letras gigantes
             alternan estilo y fondo cada pocos cuadros.
   Cada estilo = fuente + tratamiento (config.styles). Cada disposición reparte
   el texto en filas: line, stack, vertical, stair. */
(function (root) {
  "use strict";
  const T = root.Trazo, K = T.core, R = T.registry;

  const LAYOUTS = ["line", "stack", "vertical", "stair"];
  const TREATMENTS = ["solid", "outline", "hatch", "shadow"];

  function applyCase(text, mode) {
    if (mode === "upper") return text.toLocaleUpperCase("es");
    if (mode === "lower") return text.toLocaleLowerCase("es");
    if (mode === "title") return text.charAt(0).toLocaleUpperCase("es") + text.slice(1).toLocaleLowerCase("es");
    return text;
  }

  /* reparte el texto en filas según la disposición */
  function splitRows(text, layout, r, opts) {
    const words = text.split(/\s+/).filter(Boolean);
    const letters = [...text.replace(/\s+/g, "")];
    if (layout === "vertical" && words.length === 1 && letters.length <= opts.verticalMaxLetters) return letters;
    if (layout === "line") return [text];
    if (words.length > 1) {
      if (words.length <= 3) return words;
      const half = Math.ceil(words.length / 2);
      return [words.slice(0, half).join(" "), words.slice(half).join(" ")];
    }
    /* stack / stair de una sola palabra: trozos de 2–3 letras, como «Gr / ou / p» */
    const n = letters.length;
    if (n < opts.stackMinLetters) return [text];
    const parts = n >= 8 ? 3 : 2;
    const rows = []; let pos = 0;
    for (let i = 0; i < parts; i++) {
      const left = n - pos, slots = parts - i;
      let take = i === parts - 1 ? left : Math.max(1, Math.round(left / slots) + (r() < 0.5 ? 0 : r.sign()));
      take = Math.min(take, left - (slots - 1));
      rows.push(letters.slice(pos, pos + take).join(""));
      pos += take;
    }
    return rows.filter(Boolean);
  }

  /* construye el bloque de letras dentro de un rectángulo (fracción de pantalla) */
  function lettering(parent, text, style, layout, ctx, r, fill) {
    const { W, H, fonts } = ctx;
    const font = fonts[style.font] || fonts[Object.keys(fonts)[0]];
    const family = font.family;
    const lh = font.lineHeight || 0.92;
    const shown = applyCase(text, style.case || "asis");
    const rows = splitRows(shown, layout, r, ctx.C.layouts);
    const tracking = style.tracking || 0;
    const vertical = layout === "vertical" && rows.length > 1 && rows.every(x => [...x].length === 1);
    const boxW = W * (fill?.w ?? ctx.C.size.fill) * (style.scale || 1);
    const boxH = H * (fill?.h ?? ctx.C.size.fillH) * (style.scale || 1);
    const widest = Math.max(...rows.map(x => K.measure(x, family, 100, tracking))) || 1;
    let size = Math.min(boxW * 100 / widest, boxH / (rows.length * lh));
    if (vertical) size = Math.min(size, boxH / (rows.length * lh * 0.98));
    size = Math.max(10, size * (font.scale || 1));

    const block = K.el("div", "tz-block tz-t-" + (TREATMENTS.includes(style.treatment) ? style.treatment : "solid"), parent);
    block.style.fontFamily = `"${family}"`;
    block.style.fontSize = size.toFixed(1) + "px";
    block.style.lineHeight = lh;
    if (tracking) block.style.letterSpacing = tracking + "em";
    if (style.dim) block.style.opacity = String(style.dim);
    const rowEls = rows.map((txt, i) => {
      const row = K.el("div", "tz-row", block);
      row.textContent = txt;
      if (style.treatment === "shadow") row.setAttribute("data-text", txt);
      /* colocación “a mano”: desplazamientos y giros pequeños por fila */
      let dx = 0, rot = 0;
      if (layout === "stack" && rows.length > 1) { dx = r.range(-0.07, 0.07) * boxW * 0.5; rot = r.range(-4, 4); }
      if (layout === "stair") { dx = (i - (rows.length - 1) / 2) * size * 0.32; rot = r.range(-3, 3); }
      if (vertical) { dx = r.range(-0.08, 0.08) * size; rot = r.range(-5, 5); }
      row.dataset.dx = dx; row.dataset.rot = rot;
      row.style.transform = `translateX(${dx.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
      return row;
    });
    const bw = Math.min(W, widest * size / 100 * (layout === "stair" ? 1.3 : 1.08));
    const bh = rows.length * lh * size;
    return { block, rows: rowEls, size, bw, bh, family };
  }

  /* temblor de línea (“boil”): cada paso del dibujo redibuja ligeramente las filas */
  function boilRows(rows, step, seed, amount) {
    rows.forEach((row, i) => {
      const r = K.rng(seed + step * 131 + i * 17);
      const dx = +row.dataset.dx + r.range(-1, 1) * amount;
      const dy = r.range(-1, 1) * amount;
      const rot = +row.dataset.rot + r.range(-0.9, 0.9) * amount * 0.35;
      row.style.transform = `translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px) rotate(${rot.toFixed(2)}deg)`;
    });
  }

  function hatchLayer(parent, ctx, seed, opacity) {
    const layer = K.svgLayer(parent, ctx.W, ctx.H);
    layer.classList.add("tz-hatch");
    K.svg("path", { d: K.hatch(ctx.W, ctx.H, K.rng(seed), 1.15), style: "stroke:var(--ink)", "stroke-width": Math.max(1.4, ctx.W / 520), "stroke-linecap": "round", fill: "none", opacity }, layer);
    return layer;
  }

  /* ------------------------------ word ------------------------------ */
  R.scenes.word = function buildWord(sc, ctx) {
    const r = K.rng(sc.seed);
    const root = K.el("div", "tz-scene");
    if (sc.hatch) hatchLayer(root, ctx, sc.seed + 7, 0.62);
    const holder = K.el("div", "tz-holder", root);
    const L = lettering(holder, sc.text, sc.style, sc.layout, ctx, r);
    if (sc.hatch) L.block.classList.add("tz-sep");
    const doodle = sc.doodle && R.doodles[sc.doodle] ? R.doodles[sc.doodle](root, L, ctx, K.rng(sc.seed + 3)) : null;
    const motion = R.motions[sc.motion] || R.motions.none;
    const trans = R.transitions[sc.transition] || R.transitions.cut;
    const dur = sc.t1 - sc.t0;
    let lastStep = -1;
    return {
      root,
      update(lt, frame) {
        const st = { scale: 1, dx: 0, dy: 0, rot: 0, inv: !!sc.inverted, hide: false };
        motion(lt, dur, ctx.C.motion, st, frame.boilStep, sc.seed);
        trans(lt, dur, st, ctx.C.transitions);
        holder.style.transform = `translate(${st.dx.toFixed(1)}px,${st.dy.toFixed(1)}px) rotate(${st.rot.toFixed(2)}deg) scale(${st.scale.toFixed(4)})`;
        holder.style.visibility = st.hide ? "hidden" : "visible";
        if (frame.boilStep !== lastStep) { boilRows(L.rows, frame.boilStep, sc.seed, ctx.C.motion.boil * ctx.u); lastStep = frame.boilStep; }
        if (doodle) doodle.update(lt, dur);
        return st;
      }
    };
  };

  /* ------------------------------ burst ----------------------------- */
  R.scenes.burst = function buildBurst(sc, ctx) {
    const root = K.el("div", "tz-scene");
    const steps = sc.steps;
    const cache = new Map();
    let shown = null, lastStep = -1, lastBoil = -1;
    function stepNode(i) {
      if (cache.has(i)) return cache.get(i);
      const s = steps[i], r = K.rng(sc.seed + i * 97);
      const node = K.el("div", "tz-scene");
      if (s.hatch) hatchLayer(node, ctx, sc.seed + i * 13, 0.7);
      const holder = K.el("div", "tz-holder", node);
      const L = s.letter
        ? lettering(holder, s.text, s.style, "line", ctx, r, { w: 0.98, h: 0.86 })
        : lettering(holder, s.text, s.style, s.layout, ctx, r, { w: 0.9, h: 0.7 });
      if (s.hatch) L.block.classList.add("tz-sep");
      const item = { node, holder, L, s };
      cache.set(i, item);
      return item;
    }
    return {
      root,
      update(lt, frame) {
        const i = Math.min(steps.length - 1, Math.max(0, Math.floor(lt / sc.stepSec)));
        if (i !== lastStep) {
          if (shown) shown.node.remove();
          shown = stepNode(i);
          root.appendChild(shown.node);
          lastStep = i; lastBoil = -1;
        }
        const local = lt - i * sc.stepSec;
        const k = 1 + ctx.C.motion.punch * 0.6 * (1 - K.ease.out(K.prog(local, 0, sc.stepSec)));
        shown.holder.style.transform = `scale(${k.toFixed(4)})`;
        if (frame.boilStep !== lastBoil) { boilRows(shown.L.rows, frame.boilStep, sc.seed + i, ctx.C.motion.boil * ctx.u); lastBoil = frame.boilStep; }
        return { inv: !!shown.s.inverted };
      }
    };
  };

  T.lettering = lettering;
  T.boilRows = boilRows;
  T.hatchLayer = hatchLayer;
  T.LAYOUTS = LAYOUTS;
  T.TREATMENTS = TREATMENTS;
})(typeof window !== "undefined" ? window : globalThis);

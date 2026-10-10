/* =============================================================================
   rough · runtime de la familia "dibujado a mano" (verde / blanco / negro)
   -----------------------------------------------------------------------------
   Todo se dibuja en la capa SVG con rough.js (CDN en sandbox). Reglas:
   · los trazos se generan UNA vez en create() con semillas fijas (determinista);
   · el dibujo es stroke-dashoffset con pathLength=1 → progreso puro del tiempo;
   · "hervor" (boil): cada trazo tiene 3 variantes precalculadas y se alterna a
     ~6 fps, como animación cuadro a cuadro en papel. Sigue siendo función de t;
   · colores SOLO de config.palette: ink (blanco hueso), accent (lima), muted,
     bg. Regla de color: el acento marca UNA cosa por escena (lo que importa).
   Utilidades en Kit.rough: sketch, shape, draw, life, text, hand, label, box…
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease, hash } = K;
  const NS = "http://www.w3.org/2000/svg";
  for (const f of ["900 40px Inter", "800 40px Inter", "600 20px Inter", "500 20px 'JetBrains Mono'", "700 20px 'JetBrains Mono'", "700 30px Caveat", "500 30px Caveat"]) K.fonts.add(f);

  let GEN = null;
  const gen = () => (GEN ||= window.rough ? rough.generator() : null);
  const VARIANTS = 3;
  let BOIL_FPS = 6, STROKE = 0.32;

  /* --------------------------------------------------------------- fondo */
  K.family("rough", {
    setup(ctx) {
      BOIL_FPS = ctx.C.rough?.boil === false ? 0 : (ctx.C.rough?.boilFps ?? 6);
      STROKE = ctx.C.rough?.stroke ?? 0.32;
      if (!gen()) console.warn("[rough] falta rough.js (CDN)");
      return {};
    },
    frame(t, ctx) {
      const { stage, g, C } = ctx, G = g.bg, u = stage.u, P = C.palette;
      G.fillStyle = P.bg; G.fillRect(0, 0, stage.W, stage.H);
      /* papel cuadriculado de puntos (muy tenue) + viñeta: da textura sin competir */
      const sp = u * 3.4; G.fillStyle = P.ink; G.globalAlpha = 0.07;
      for (let y = sp / 2; y < stage.H; y += sp) for (let x = sp / 2; x < stage.W; x += sp) G.fillRect(x, y, Math.max(1, u * 0.14), Math.max(1, u * 0.14));
      G.globalAlpha = 1;
      const vg = G.createRadialGradient(stage.W / 2, stage.H / 2, Math.min(stage.W, stage.H) * 0.35, stage.W / 2, stage.H / 2, Math.max(stage.W, stage.H) * 0.75);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)");
      G.fillStyle = vg; G.fillRect(0, 0, stage.W, stage.H);
    },
  });

  /* --------------------------------------------------------------- SVG */
  function svg(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
    if (parent) parent.appendChild(e);
    return e;
  }
  /** grupo raíz de un beat (se borra en dispose) */
  const root = ctx => svg("g", { class: "r-beat" }, ctx.layers.svg);

  /** opciones rough comunes (el trazo se fija en px de pantalla) */
  const opts = (ctx, seed, extra) => ({ roughness: 1.15, bowing: 1.1, strokeWidth: 1, seed: (seed % 2147483646) + 1, disableMultiStroke: false, ...extra });

  /**
   * Convierte drawables de rough en elementos <path> animables.
   * build(g, o) → drawable[]  (se llama con 3 semillas para el hervor)
   */
  function paths(parent, build, o) {
    const G = gen(); if (!G) return [];
    const variants = [];
    for (let v = 0; v < (BOIL_FPS ? VARIANTS : 1); v++) {
      /* marcadores: "S" = contorno, "F" = relleno (rough devuelve el relleno hachure como trazo
         con stroke = fill, y el sólido como path con fill); el color real se pone después */
      const ds = []; const base = { stroke: "S", ...o.rough, seed: ((o.seed ?? 1) * 31 + v * 977) % 2147483646 + 1 };
      for (const d of [].concat(build(G, base))) for (const p of G.toPaths(d)) ds.push({ d: p.d, isFill: p.stroke === "F", solid: p.fill === "F" && (!p.stroke || p.stroke === "none") });
      variants.push(ds);
    }
    const color = o.color, w = o.width;
    return variants[0].map((p, i) => {
      const el = p.solid
        ? svg("path", { d: p.d, fill: o.fillColor || color, stroke: "none", opacity: 0 }, parent)
        : svg("path", { d: p.d, fill: "none", stroke: p.isFill ? (o.fillColor || color) : color, "stroke-width": p.isFill ? w * 0.55 : w,
            "stroke-linecap": "round", "stroke-linejoin": "round", pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1, "vector-effect": "non-scaling-stroke" }, parent);
      el._v = variants.map(vs => (vs[i] || p).d);
      el._fill = p.isFill || p.solid; el._solid = p.solid;
      return el;
    });
  }
  /** caja (x,y,w,h) → <g> con viewBox "vx vy vw vh" encajado (contain, centrado) */
  function fit(parent, box, vb, stretch) {
    const [vx, vy, vw, vh] = vb;
    const sx = box.w / vw, sy = box.h / vh, s = Math.min(sx, sy);
    const tx = stretch ? box.x - vx * sx : box.x + (box.w - vw * s) / 2 - vx * s, ty = stretch ? box.y - vy * sy : box.y + (box.h - vh * s) / 2 - vy * s;
    return svg("g", { transform: stretch ? `translate(${tx} ${ty}) scale(${sx} ${sy})` : `translate(${tx} ${ty}) scale(${s})` }, parent);
  }
  /** icono del diccionario (sketches.js) dentro de `box` */
  function sketch(ctx, parent, name, box, o = {}) {
    const S = K.rough.SKETCHES[name];
    if (!S) { console.warn("[rough] boceto desconocido", name); return []; }
    const g = fit(parent, box, S.viewBox.split(" ").map(Number), S.stretch);
    return paths(g, (G, base) => S.shapes(G, { ...base, ...(o.fill ? { fill: "F", fillStyle: o.fillStyle || "hachure", hachureGap: o.hachureGap ?? 5, hachureAngle: -41, fillWeight: 1 } : {}) }), {
      seed: o.seed ?? hash(name), color: o.color || ctx.C.palette.ink, fillColor: o.fillColor || ctx.C.palette.accent, width: (o.width ?? 1) * ctx.stage.u * STROKE,
      rough: o.rough });
  }
  /** forma libre en coordenadas del escenario: build(g, o) → drawable[] */
  function shape(ctx, parent, build, o = {}) {
    return paths(parent, build, { seed: o.seed ?? 7, color: o.color || ctx.C.palette.ink, fillColor: o.fillColor || ctx.C.palette.accent, width: (o.width ?? 1) * ctx.stage.u * STROKE, rough: o.rough });
  }

  /**
   * Dibuja trazos en el tiempo: cada trazo i empieza en start + i·stagger y dura dur.
   * Los rellenos (hachure) entran después de los contornos. Devuelve el progreso total.
   */
  function draw(els, lt, o = {}) {
    const start = o.start ?? 0, dur = o.dur ?? 0.9, n = els.length;
    const stagger = o.stagger ?? Math.min(0.12, (o.total ?? 1.4) / Math.max(1, n));
    const fr = BOIL_FPS ? Math.floor((o.t ?? lt) * BOIL_FPS) % VARIANTS : 0;
    let all = 1, k = 0;
    els.forEach((el, i) => {
      const s0 = start + (el._fill ? (o.fillDelay ?? 0.35) + k++ * 0.02 : i * stagger);
      const q = prog(lt, s0, el._fill ? 0.4 : dur, o.ease || "inOut");
      if (el._solid) el.setAttribute("opacity", q.toFixed(3)); else el.setAttribute("stroke-dashoffset", (1 - q).toFixed(4));
      if (BOIL_FPS && q >= 1 && el._v[fr] && el._cur !== fr) { el.setAttribute("d", el._v[fr]); el._cur = fr; }
      all = Math.min(all, q);
    });
    return all;
  }
  /** borra en reversa (salida "a mano") */
  function undraw(els, q) { els.forEach(el => el._solid ? el.setAttribute("opacity", (1 - q).toFixed(3)) : el.setAttribute("stroke-dashoffset", Math.min(1, q * 1.1).toFixed(4))); }

  /** vida de un beat: entrada 0..1, salida 0..1 (durante el solape posterior) */
  function life(lt, b, post = 0.5) {
    return { in: clamp(lt / 0.4), out: clamp((lt - b.dur) / post) };
  }

  /* --------------------------------------------------------------- texto */
  /** texto SVG: o = { x, y, size(u), font, weight, color, anchor, spacing, opacity } */
  function text(ctx, parent, str, o = {}) {
    const u = ctx.stage.u;
    const el = svg("text", { x: o.x, y: o.y, fill: o.color || ctx.C.palette.ink, "font-family": o.font || "Inter, sans-serif", "font-weight": o.weight || 600,
      "font-size": (o.size ?? 2) * u, "text-anchor": o.anchor || "middle", "dominant-baseline": o.baseline || "central",
      "letter-spacing": o.spacing != null ? o.spacing * u : null, opacity: o.opacity ?? 1, "font-style": o.italic ? "italic" : null }, parent);
    el.textContent = str;
    return el;
  }
  const hand = (ctx, parent, str, o = {}) => text(ctx, parent, str, { font: "Caveat, cursive", weight: 700, ...o });
  const mono = (ctx, parent, str, o = {}) => text(ctx, parent, str, { font: "'JetBrains Mono', monospace", weight: 600, spacing: 0.25, ...o });
  /** escribe el texto letra a letra (máquina de escribir) */
  function type(el, full, q) { const n = Math.round(clamp(q) * full.length); if (el._n !== n) { el.textContent = full.slice(0, n); el._n = n; } }
  /** rótulo en caja lima con texto oscuro (el "tag" de esta familia) */
  function label(ctx, parent, str, o = {}) {
    const u = ctx.stage.u, P = ctx.C.palette, fs = (o.size ?? 2.1) * u;
    const g = svg("g", { opacity: 0 }, parent);
    const w = str.length * fs * 0.66 + fs * 1.3, h = fs * 1.9;
    const x = o.anchor === "start" ? o.x : o.anchor === "end" ? o.x - w : o.x - w / 2;
    const bg = svg("rect", { x, y: o.y - h / 2, width: w, height: h, fill: o.bg || P.accent, rx: u * 0.25 }, g);
    text(ctx, g, str, { x: x + w / 2, y: o.y + fs * 0.04, size: o.size ?? 2.1, font: "'JetBrains Mono', monospace", weight: 700, color: o.color || P.accentInk || P.bg, spacing: 0.12 });
    g._w = w; g._bg = bg;
    return g;
  }

  /** caja de contenido con fracción f y proporción ar */
  const boxIn = (ctx, f = 0.8, ar = 1, dy = 0) => {
    const c = ctx.stage.content; let w = c.w * f, h = w / ar;
    if (h > c.h * f) { h = c.h * f; w = h * ar; }
    return { x: c.x + (c.w - w) / 2, y: c.y + (c.h - h) / 2 + dy, w, h };
  };
  /** salida estándar del grupo: se desvanece y se encoge apenas */
  function exitFx(g, ctx, lt, b, post = 0.45) {
    const out = clamp((lt - b.dur) / post), { cx, cy } = ctx.stage;
    g.setAttribute("opacity", (1 - out).toFixed(3));
    if (out > 0) g.setAttribute("transform", `translate(${cx} ${cy}) scale(${1 - out * 0.04}) translate(${-cx} ${-cy})`);
    return out;
  }

  K.rough = { svg, root, opts, paths, fit, sketch, shape, draw, undraw, life, text, hand, mono, type, label, boxIn, exitFx, SKETCHES: {},
              get stroke() { return STROKE; } };
})();

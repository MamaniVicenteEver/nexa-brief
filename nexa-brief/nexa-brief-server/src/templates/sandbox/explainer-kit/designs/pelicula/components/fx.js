/* =============================================================================
   pelicula · transiciones sueltas (capa overlay): destellos y glitch de cuadro
   Se colocan en el storyboard con "at" + "offset" negativo para que el pico del
   destello quede justo sobre el corte (como en la referencia).
   ========================================================================== */
(function () {
  const K = Kit, P = Kit.pelicula, { clamp } = K;

  K.register({
    name: "pelicula.leak", tags: ["transición", "luz", "destello", "corte"], layer: "overlay", post: 0,
    summary: "Destello de película (light leak) que tapa un corte: burn (naranja→ámbar→blanco desde un costado, ref 13.1/24.3/31.8/45.9/55.7 s), prism (banda rojo-blanco-verde que cruza, ref 3.1/15.2/37.4/49.3 s), flash (golpe blanco cálido, ref 20.6/27.1 s) o bar (barra de luz, ref 4.3 s). Dura lo que dure el beat ('dur').",
    example: { kind: "burn", dir: "ltr" },
    params: {
      kind: { type: "enum", options: ["burn", "prism", "flash", "bar"], default: "burn", doc: "Tipo de destello." },
      dir: { type: "enum", options: ["ltr", "rtl"], default: "ltr", doc: "Desde qué costado entra." },
      strength: { type: "number", default: 1, min: 0, max: 1.3, doc: "Intensidad." },
    },
    create(ctx, p) {
      return { render(lt, b) { P.leak(ctx.g.top, ctx.stage, p.kind, lt / Math.max(0.15, b.dur), { dir: p.dir, strength: p.strength }); } };
    },
  });

  K.register({
    name: "pelicula.glitch", tags: ["transición", "glitch", "golpe"], layer: "overlay", post: 0,
    summary: "Glitch de franjas de TODO el cuadro (foto + texto): bandas horizontales desplazadas y duplicadas que cambian cada cuadro (ref 32.7–33.2, 45.3, 50.6, 55.0 s). Duración = 'dur' del beat (0.2–0.5 s).",
    example: { strength: 1 },
    params: {
      strength: { type: "number", default: 1, min: 0, max: 2, doc: "Desplazamiento de las franjas." },
      flicker: { type: "number", default: 0.75, min: 0, max: 1, doc: "Fracción de cuadros con glitch (el resto, limpio)." },
    },
    create(ctx, p) {
      return { render(lt, b, t) {
        if (lt > b.dur) return;
        const f = P.fi(t), r = K.rng(f * 31 + 9);
        if (r() > p.flicker) return;
        const { W, H } = ctx.stage, G = ctx.g.top;
        G.save(); P.slices(G, ctx.layers.main, 0, 0, W, H, f, 0.07 * p.strength * (1 - 0.5 * lt / b.dur), 21); G.restore();
      } };
    },
  });
})();

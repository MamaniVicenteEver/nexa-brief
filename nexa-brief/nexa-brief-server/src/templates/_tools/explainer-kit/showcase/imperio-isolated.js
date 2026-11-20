/* Vista aislada del showcase: los componentes y sus entradas geográficas siguen siendo los de Imperio. */
(function () {
  "use strict";
  const K = window.Kit, IM = K?.imperio;
  if (!IM) throw new Error("La vista aislada requiere Imperio.");
  const stats = { mode: "isolated-overlays", rasterMaps: 0, projections: 0, coordinateSystem: "longitude-latitude", videoUsesMap: true };
  window.__imperioShowcase = stats;
  // Se conserva IM.view: sol, pines, haces y barcos usan la misma proyección/cámara.
  IM.mapCache = ctx => ({
    draw(G, cam, _key, _id, look = {}) {
      const V = IM.view(ctx.stage, cam); stats.projections++;
      // Los rellenos/rayados de países pertenecen al mapa; aquí solo se ven sus animaciones superpuestas.
      IM.drawLabels(G, ctx.stage, V, look.labels, look.labelQ ?? 1, look.gray || 0);
      return V;
    },
    free() {},
  });
  // No se hornean ni precalientan las llaves del atlas físico en la galería.
  IM.warmAtlas = IM.warmKey = IM.sliceWork = () => {};
  IM.drawMap = (_G, st, cam) => IM.view(st, cam);
  K.family("imperio", {
    setup() { IM.world(); return {}; },
    prepare(ctx) {
      const text = new Set((ctx.beats || []).flatMap(b => [b.params?.native, b.params?.text, b.params?.nativeText]).filter(s => typeof s === "string" && /[^\u0000-ɏ]/.test(s)));
      return Promise.all([...text].map(s => document.fonts.load(IM.nativeFont(40), s).catch(() => {})));
    },
    frame() { IM.fx = { grain: 0, vignette: 0, dust: 0, fade: 0, noCapBand: true }; },
    resize() { IM.clearKeys(); },
  });
})();

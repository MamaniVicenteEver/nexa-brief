// Plantilla: barras que crecen desde la base con stagger (scaleY, nunca
// height/width — transform-only, seek-safe). La altura final de cada barra
// se define en CSS; GSAP solo revela scaleY 0→1.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.growthBars = function growthBars(gsap, tl, opts) {
  const {
    barsSelector,
    labelsSelector,
    valuesSelector,
    at,
    duration = 0.7,
    stagger = 0.12,
  } = opts;

  gsap.set(barsSelector, { scaleY: 0, transformOrigin: "bottom center" });
  gsap.set([labelsSelector, valuesSelector], { opacity: 0, y: 14 });

  tl.to(barsSelector, { scaleY: 1, duration, ease: "power3.out", stagger }, at);
  tl.to([labelsSelector, valuesSelector], { opacity: 1, y: 0, duration: 0.4, stagger, ease: "power2.out" }, at + 0.15);
};

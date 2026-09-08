// NEXA BRIEF — punto de entrada de la composición desktop 16:9.
// Arma el timeline GSAP combinando las plantillas de src/components/ con la
// configuración de src/core/config.js.

window.NexaBrief = window.NexaBrief || {};

window.NexaBrief.buildTimeline = function buildTimeline(gsap) {
  const tl = gsap.timeline({ paused: true });
  const c = window.NexaBrief.components;

  /* ---------- Escena A (0s - ~6.9s) ---------- */
  c.brandMark(gsap, tl, { selector: "#brand-mark", at: 0 });

  c.kineticText(gsap, tl, { selector: "#headline", enterAt: 0.3, enterY: 70, enterDuration: 0.8 });
  c.kineticText(gsap, tl, { selector: "#subtitle", enterAt: 0.9, enterY: 40, enterScale: 1, enterDuration: 0.6 });

  c.counterStat(gsap, tl, {
    counterSelector: "#counter",
    suffixSelector: "#counter-suffix",
    labelSelector: "#stat-label",
    targetValue: 3,
    countAt: 0.6,
    countDuration: 1.6,
    labelAt: 1.0,
  });

  /* ---------- Transición (6.2s - ~6.85s) ---------- */
  c.elasticPush(gsap, tl, { outSelector: "#scene-a", inSelector: "#scene-b", at: 6.2 });

  /* ---------- Escena B (6.2s - 15s) ---------- */
  c.growthBars(gsap, tl, {
    barsSelector: "#scene-b .bar",
    labelsSelector: "#scene-b .bar-label",
    valuesSelector: "#scene-b .bar-value",
    at: 7.0,
    stagger: 0.15,
  });

  c.ctaPulse(gsap, tl, {
    selector: "#cta",
    enterAt: 9.2,
    pulseStartAt: 10.2,
    pulseCount: 5,
  });

  /* ---------- Cierre ---------- */
  c.flashOutro(gsap, tl, {
    flashSelector: "#flash-overlay",
    blackSelector: "#black-overlay",
    at: 14.2,
  });

  return tl;
};

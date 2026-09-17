// Plantilla: ícono circular que entra con "back.out" y luego pulsa en loop.
// Usada por icon-live e icon-check en index.js con distintos parámetros —
// así se ve cómo reutilizar la misma plantilla para dos escenas diferentes.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.pulsingIcon = function pulsingIcon(gsap, tl, opts) {
  const {
    wrapSelector,
    circleSelector,
    enterAt,
    pulseStartAt,
    pulseScale = 1.12,
    pulseDuration = 0.6,
    pulseCount = 4,
  } = opts;

  gsap.set(wrapSelector, { opacity: 0, scale: 0.6 });
  tl.to(wrapSelector, { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" }, enterAt);
  tl.to(
    circleSelector,
    { scale: pulseScale, duration: pulseDuration, repeat: pulseCount, yoyo: true, ease: "sine.inOut" },
    pulseStartAt
  );
};

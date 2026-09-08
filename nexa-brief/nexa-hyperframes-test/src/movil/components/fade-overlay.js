// Plantilla: overlay de fade simple (usada para el cierre a negro).

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.fadeOverlay = function fadeOverlay(gsap, tl, opts) {
  const { selector, at, duration = 0.8, ease = "power2.in", toOpacity = 1 } = opts;

  gsap.set(selector, { opacity: 0 });
  tl.to(selector, { opacity: toOpacity, duration, ease }, at);
};

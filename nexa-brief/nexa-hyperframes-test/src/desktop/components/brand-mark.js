// Plantilla: marca (punto + texto) que entra deslizándose desde arriba.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.brandMark = function brandMark(gsap, tl, opts) {
  const { selector, at = 0, duration = 0.6, ease = "back.out(1.6)" } = opts;

  gsap.set(selector, { opacity: 0, y: -50 });
  tl.to(selector, { opacity: 1, y: 0, duration, ease }, at);
};

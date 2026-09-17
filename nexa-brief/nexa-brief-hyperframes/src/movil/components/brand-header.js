// Plantilla: header de marca (punto + texto) con fade + slide down.
// Reutilizable para cualquier composición que necesite un encabezado fijo.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.brandHeader = function brandHeader(gsap, tl, opts) {
  const { selector = "#brand", at = 0.3, duration = 0.6, ease = "power2.out" } = opts;

  gsap.set(selector, { opacity: 0, y: -30 });
  tl.to(selector, { opacity: 1, y: 0, duration, ease }, at);
};

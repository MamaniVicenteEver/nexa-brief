// Plantilla: barra de progreso que crece linealmente durante todo el clip.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.progressBar = function progressBar(gsap, tl, opts) {
  const { selector = "#progress-fill", duration = 15, at = 0 } = opts;

  gsap.set(selector, { width: "0%" });
  tl.to(selector, { width: "100%", duration, ease: "none" }, at);
};

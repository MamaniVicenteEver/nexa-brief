// Plantilla: texto que entra deslizándose hacia arriba + escala (más dinámico
// que un fade plano), con salida opcional. Reutilizable para titular,
// subtítulo y CTA con distintos parámetros.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.kineticText = function kineticText(gsap, tl, opts) {
  const {
    selector,
    enterAt,
    enterY = 60,
    enterScale = 0.9,
    enterDuration = 0.7,
    enterEase = "power3.out",
    exitAt = null,
    exitY = -40,
    exitDuration = 0.4,
    exitEase = "power2.in",
  } = opts;

  gsap.set(selector, { opacity: 0, y: enterY, scale: enterScale, transformOrigin: "left center" });
  tl.to(
    selector,
    { opacity: 1, y: 0, scale: 1, duration: enterDuration, ease: enterEase },
    enterAt
  );

  if (exitAt != null) {
    tl.to(selector, { opacity: 0, y: exitY, duration: exitDuration, ease: exitEase }, exitAt);
  }
};

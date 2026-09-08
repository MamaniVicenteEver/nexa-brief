// Plantilla: bloque de texto con entrada, salida opcional y pulso opcional.
// Cubre headline, subtitle, bullet y cta con la misma función — cada llamada
// en index.js solo cambia los parámetros de timing/estilo.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.textBlock = function textBlock(gsap, tl, opts) {
  const {
    selector,
    enterAt,
    enterY = 50,
    enterScale = 1, // 1 = sin animación de escala
    enterDuration = 0.8,
    enterEase = "power3.out",
    exitAt = null,
    exitY = -40,
    exitDuration = 0.5,
    exitEase = "power2.in",
    pulse = null, // { startAt, opacity, duration, repeat }
  } = opts;

  const hasScale = enterScale !== 1;

  gsap.set(selector, { opacity: 0, y: enterY, ...(hasScale ? { scale: enterScale } : {}) });
  tl.to(
    selector,
    { opacity: 1, y: 0, ...(hasScale ? { scale: 1 } : {}), duration: enterDuration, ease: enterEase },
    enterAt
  );

  if (exitAt != null) {
    tl.to(selector, { opacity: 0, y: exitY, duration: exitDuration, ease: exitEase }, exitAt);
  }

  if (pulse) {
    tl.to(
      selector,
      { opacity: pulse.opacity, duration: pulse.duration, repeat: pulse.repeat, yoyo: true, ease: "sine.inOut" },
      pulse.startAt
    );
  }
};

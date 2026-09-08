// Plantilla: CTA que entra desde abajo con rebote y luego pulsa en loop
// (transform scale, no opacity puro) para dar sensación de urgencia/vida.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.ctaPulse = function ctaPulse(gsap, tl, opts) {
  const {
    selector,
    enterAt,
    enterDuration = 0.6,
    pulseStartAt,
    pulseScale = 1.05,
    pulseDuration = 0.5,
    pulseCount = 4,
  } = opts;

  gsap.set(selector, { opacity: 0, y: 50, scale: 0.9, transformOrigin: "center center" });
  tl.to(selector, { opacity: 1, y: 0, scale: 1, duration: enterDuration, ease: "back.out(1.8)" }, enterAt);
  tl.to(
    selector,
    { scale: pulseScale, duration: pulseDuration, repeat: pulseCount, yoyo: true, ease: "sine.inOut" },
    pulseStartAt
  );
};

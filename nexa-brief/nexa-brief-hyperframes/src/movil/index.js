// NEXA BRIEF — punto de entrada de la composición.
// Arma el timeline GSAP combinando las plantillas de src/components/ con la
// configuración de src/core/config.js. HyperFrames espera el resultado
// (un timeline PAUSADO) registrado en window.__timelines[compositionId] —
// eso lo hace el <script> inline al final de index.html, que llama a
// window.NexaBrief.buildTimeline(gsap) definido aquí.

window.NexaBrief = window.NexaBrief || {};

window.NexaBrief.buildTimeline = function buildTimeline(gsap) {
  const tl = gsap.timeline({ paused: true });
  const c = window.NexaBrief.components;
  const { duration } = window.NexaBrief.config;

  /* ---------- Persistente durante todo el clip ---------- */
  c.brandHeader(gsap, tl, { at: 0.6 });
  c.progressBar(gsap, tl, { duration });

  /* ---------- Escena A (0s - 15s) ---------- */
  c.pulsingIcon(gsap, tl, {
    wrapSelector: "#icon-live",
    circleSelector: "#icon-live .icon-circle",
    enterAt: 1.2,
    pulseStartAt: 2.2,
    pulseScale: 1.12,
    pulseCount: 4,
  });

  c.textBlock(gsap, tl, {
    selector: "#headline",
    enterAt: 2,
    enterScale: 0.92,
    exitAt: 12.6,
  });

  c.textBlock(gsap, tl, {
    selector: "#subtitle",
    enterAt: 5,
    enterDuration: 0.6,
    enterEase: "power2.out",
    exitAt: 12.8,
    exitY: -30,
    exitDuration: 0.4,
  });

  /* ---------- Transición (≈12.8s - 15.2s) ---------- */
  c.transitionWipe(gsap, tl, { selector: "#sweep", at: 12.8 });
  c.sceneCrossfade(gsap, tl, { fromSelector: "#bg-a", toSelector: "#bg-b", at: 13 });

  /* ---------- Escena B (15s - 30s) ---------- */
  c.pulsingIcon(gsap, tl, {
    wrapSelector: "#icon-check",
    circleSelector: "#icon-check .icon-circle",
    enterAt: 15.2,
    pulseStartAt: 16.2,
    pulseScale: 1.1,
    pulseCount: 5,
  });

  c.textBlock(gsap, tl, {
    selector: "#bullet",
    enterAt: 15.6,
    enterScale: 0.92,
    exitAt: 21.2,
    exitY: -30,
    exitDuration: 0.4,
  });

  c.textBlock(gsap, tl, {
    selector: "#cta",
    enterAt: 22,
    enterDuration: 0.6,
    enterEase: "power2.out",
    pulse: { startAt: 23.6, opacity: 0.55, duration: 0.5, repeat: 3 },
  });

  /* ---------- Cierre ---------- */
  c.fadeOverlay(gsap, tl, { selector: "#outro", at: 28.4 });

  return tl;
};

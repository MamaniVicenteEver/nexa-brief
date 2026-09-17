// Plantilla: crossfade entre dos fondos de escena.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.sceneCrossfade = function sceneCrossfade(gsap, tl, opts) {
  const { fromSelector, toSelector, at, duration = 1, ease = "power1.inOut" } = opts;

  gsap.set(fromSelector, { opacity: 1 });
  gsap.set(toSelector, { opacity: 0 });
  tl.to(toSelector, { opacity: 1, duration, ease }, at);
  tl.to(fromSelector, { opacity: 0, duration, ease }, at);
};

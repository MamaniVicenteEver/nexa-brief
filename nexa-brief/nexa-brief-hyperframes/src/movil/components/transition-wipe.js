// Plantilla: wipe de color que cubre y descubre la escena (transición entre bloques).

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.transitionWipe = function transitionWipe(gsap, tl, opts) {
  const { selector, at, coverDuration = 0.4, revealDuration = 0.4, ease = "power2.inOut" } = opts;
  const revealAt = at + coverDuration;

  gsap.set(selector, { opacity: 1, scaleX: 0, transformOrigin: "left center" });
  tl.set(selector, { transformOrigin: "left center", scaleX: 0 }, at);
  tl.to(selector, { scaleX: 1, duration: coverDuration, ease }, at);
  tl.set(selector, { transformOrigin: "right center" }, revealAt);
  tl.to(selector, { scaleX: 0, duration: revealDuration, ease }, revealAt);
};

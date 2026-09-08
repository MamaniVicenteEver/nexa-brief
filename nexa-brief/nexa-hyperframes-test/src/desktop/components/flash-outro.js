// Plantilla: destello breve (brightness) + fundido a negro de cierre — un
// cierre más dinámico que un simple fade lineal.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.flashOutro = function flashOutro(gsap, tl, opts) {
  const { flashSelector, blackSelector, at } = opts;

  gsap.set(flashSelector, { opacity: 0 });
  gsap.set(blackSelector, { opacity: 0 });

  tl.to(flashSelector, { opacity: 0.85, duration: 0.12, ease: "power1.in" }, at);
  tl.to(flashSelector, { opacity: 0, duration: 0.25, ease: "power1.out" }, at + 0.12);
  tl.to(blackSelector, { opacity: 1, duration: 0.35, ease: "power2.in" }, at + 0.15);
};

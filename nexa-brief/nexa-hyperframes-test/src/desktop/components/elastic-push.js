// Plantilla de transición: la escena saliente se empuja fuera de cuadro y la
// entrante llega desde el lado opuesto con un pequeño rebote elástico —
// más dinámica que un crossfade o wipe estático.

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.elasticPush = function elasticPush(gsap, tl, opts) {
  const { outSelector, inSelector, at, width = 1920 } = opts;

  gsap.set(outSelector, { x: 0 });
  gsap.set(inSelector, { x: width, opacity: 1 });

  tl.to(outSelector, { x: -width, duration: 0.5, ease: "power3.in" }, at);
  tl.fromTo(inSelector, { x: width }, { x: 30, duration: 0.4, ease: "power4.out" }, at + 0.1);
  tl.to(inSelector, { x: -15, duration: 0.15, ease: "sine.inOut" }, at + 0.5);
  tl.to(inSelector, { x: 0, duration: 0.1, ease: "sine.out" }, at + 0.65);
};

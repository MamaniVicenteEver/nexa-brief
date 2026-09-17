// Plantilla: contador numérico que cuenta hacia arriba mientras crece en escala
// (peso visual creciente), con sufijo que entra con rebote después del conteo
// y una etiqueta que aparece temprano. Patrón "counting-dynamic-scale".

window.NexaBrief = window.NexaBrief || {};
window.NexaBrief.components = window.NexaBrief.components || {};

window.NexaBrief.components.counterStat = function counterStat(gsap, tl, opts) {
  const {
    counterSelector,
    suffixSelector,
    labelSelector,
    targetValue,
    startScale = 0.5,
    countAt = 0,
    countDuration = 1.6,
    countEase = "power3.out",
    suffixDuration = 0.4,
    labelAt,
    labelDuration = 0.5,
  } = opts;

  const counterEl = document.querySelector(counterSelector);
  const state = { value: 0 };

  gsap.set(counterSelector, { scale: startScale, transformOrigin: "center center" });
  gsap.set(suffixSelector, { opacity: 0, y: 20 });
  gsap.set(labelSelector, { opacity: 0, y: 12 });

  tl.to(
    state,
    {
      value: targetValue,
      duration: countDuration,
      ease: countEase,
      onUpdate: () => {
        counterEl.textContent = Math.round(state.value);
      },
    },
    countAt
  );

  tl.fromTo(
    counterSelector,
    { scale: startScale },
    { scale: 1, duration: countDuration, ease: countEase },
    countAt
  );

  tl.to(
    suffixSelector,
    { opacity: 1, y: 0, duration: suffixDuration, ease: "back.out(1.7)" },
    countAt + countDuration
  );

  tl.to(labelSelector, { opacity: 1, y: 0, duration: labelDuration, ease: "power2.out" }, labelAt);
};

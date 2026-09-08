(() => {
  const ad = document.querySelector(".ad");
  const toggle = document.querySelector("[data-toggle]");
  const restart = document.querySelector("[data-restart]");

  function replay() {
    if (!ad) return;
    ad.classList.remove("is-paused");
    ad.classList.add("is-replaying");
    void ad.offsetWidth;
    ad.classList.remove("is-replaying");
    if (toggle) toggle.textContent = "Pausar";
  }

  toggle?.addEventListener("click", () => {
    const paused = ad?.classList.toggle("is-paused");
    toggle.textContent = paused ? "Reanudar" : "Pausar";
  });
  restart?.addEventListener("click", replay);
})();

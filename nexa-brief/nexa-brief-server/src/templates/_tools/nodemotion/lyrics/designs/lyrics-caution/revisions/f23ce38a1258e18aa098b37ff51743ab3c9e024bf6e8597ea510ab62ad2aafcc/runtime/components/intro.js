// @nexa thumbnail-at: 0.45 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Introducción de Caution: una sola tarjeta con el nombre de la canción. */
window.NexaTemplateIntro = {
  cards(config) {
    const title = String(config?.title || "Caution").trim();
    return title ? [{ text: title, label: "", scale: 1.05 }] : [];
  }
};

/* nexa-prepared-song */
(() => {
  const intro = window.NexaTemplateIntro;
  if (typeof intro?.apply !== "function") return;
  const apply = intro.apply;
  intro.apply = function(config, ...args) {
    const result = apply.call(this, config, ...args);
    return {...result, title: config?.title || result.title, artist: config?.artist ?? result.artist};
  };
})();

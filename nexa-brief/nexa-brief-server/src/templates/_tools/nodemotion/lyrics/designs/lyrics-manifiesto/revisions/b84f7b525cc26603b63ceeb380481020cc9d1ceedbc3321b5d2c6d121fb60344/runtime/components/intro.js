// @nexa thumbnail-at: 1.5 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro propio de esta plantilla: solo presenta el título de la canción. */
window.NexaTemplateIntro = {
  apply(config) { return { ...config, artist: "", title: "Colapso", sub: "", feats: "" }; }
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

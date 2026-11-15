// @nexa thumbnail-at: 0.3 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro propio: una sola línea con el título de la canción. */
window.NexaTemplateIntro = {
  title(config) { return String(config?.title || "It’s OK If You Forget Me").trim(); },
  words(title, start, leadSec) {
    const text = String(title || "It’s OK If You Forget Me").trim();
    return text ? [{ text, t: start + 0.25 + leadSec }] : [];
  }
};

// @nexa thumbnail-at: 1.5 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro propio: una sola línea con el título de la canción. */
window.NexaTemplateIntro = {
  words(title, start, leadSec) {
    const text = String(title || "Colapso").trim();
    return text ? [{ text, t: start + 0.25 + leadSec }] : [];
  }
};

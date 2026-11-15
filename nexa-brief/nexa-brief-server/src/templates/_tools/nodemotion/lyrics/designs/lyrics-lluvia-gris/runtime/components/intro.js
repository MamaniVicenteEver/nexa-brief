// @nexa thumbnail-at: 0.45 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro de Lluvia Gris: adelanta solo el título antes de la primera palabra cantada. */
window.NexaTemplateIntro = {
  title(config) { return String(config?.title || "Dueles Tan Bien").trim(); },
  minDuration() { return 0.45; },
  words(title, start, leadSec) {
    const text = String(title || this.title({})).trim();
    return text ? [{ text, t: start + 0.05 + leadSec }] : [];
  }
};

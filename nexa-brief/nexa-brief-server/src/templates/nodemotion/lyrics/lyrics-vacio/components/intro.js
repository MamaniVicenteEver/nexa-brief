// @nexa thumbnail-at: 1.5 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro propio de Vacío: presenta solo el nombre de la canción. */
window.NexaTemplateIntro = {
  words(title, start, leadSec) {
    const text = String(title || '').trim();
    return text ? [{ text, t: start + 0.02 + leadSec }] : [];
  }
};

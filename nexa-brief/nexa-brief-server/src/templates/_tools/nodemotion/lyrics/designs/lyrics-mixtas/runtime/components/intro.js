// @nexa thumbnail-at: 0.45 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro propio de esta plantilla: un único rótulo, sincronizado con la primera voz. */
window.NexaTemplateIntro = {
  words(title, start, leadSec) { return title ? [{ text: title, t: start + 0.25 + leadSec }] : []; }
};

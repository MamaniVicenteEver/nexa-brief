// @nexa thumbnail-at: 0.6 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro propio de esta plantilla: el título ocupa la primera línea de su tarjeta cinética. */
window.NexaTemplateIntro = {
  words(title, start, leadSec) { return title ? [{ text: title, t: start + 0.2 + leadSec }] : []; }
};

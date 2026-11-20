// @nexa thumbnail-at: 1.5 — segundo del video en que el cartel de esta intro está completo:
// de ahí sale la miniatura (src/modules/thumbnail_maker.py). Medir al cambiar la intro.
/* Intro de Viaje Nocturno: conserva el túnel visual y muestra solo el nombre. */
window.NexaTemplateIntro = {
  apply(config, song) {
    const screen = document.getElementById("intro");
    if (screen) {
      screen.style.backdropFilter = "blur(4px) brightness(.82)";
      screen.style.background = "radial-gradient(ellipse 70% 50% at 50% 52%, rgba(60,22,6,.28), rgba(4,2,1,.58) 75%)";
    }
    return { ...config, artist: "", title: "Hola Remix", sub: "", feats: "", titleScale: 1.25 };
  }
};

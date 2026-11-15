// @nexa thumbnail-at: 3.0 — segundo en que el título de la intro está completo con
// etiquetas (con la canción demo). De ahí sale el fotograma de miniatura.
/* lyrics-decadas · intro (apertura de la referencia).
   1) Las primeras letras del título aparecen gigantes, una a una, rellenas con
      foto en semitono, con una firma blanca que se traza y un rótulo azul vertical.
   2) El título completo se teclea en blanco con etiquetas azules que parpadean.
   3) El artista se teclea pequeño debajo. Textos: config.intro.title / artist. */
(function (root) {
  "use strict";
  const DC = root.Decadas = root.Decadas || {};
  root.NexaTemplateIntro = {
    cards(config) {
      const title = String(config?.title || "").trim();
      return title ? [{ text: title, label: String(config?.artist || ""), scale: 1 }] : [];
    }
  };
  if (!DC.core) return;
  const K = DC.core, R = DC.registry;

  R.intro = function buildIntro(sc, ctx) {
    const P = DC.parts, I = ctx.C.intro, col = ctx.C.colors;
    const D = sc.t1 - sc.t0;
    const title = P.up(I.title || ctx.label);
    const first = (title.split(/\s+/)[0] || title).replace(/[^\p{L}\p{N}]/gu, "");
    const letters = [...first].slice(0, 4);
    const rootEl = K.el("div", "dc-scene"); rootEl.style.background = col.dark;
    const big = P.photoText(rootEl, ctx, "", ctx.H * 0.62, sc.seed, col.white); big.classList.add("dc-giant-center");
    const sig = ctx.C.components.signature ? P.signature(rootEl, ctx, sc.seed, ctx.W * 0.12, ctx.H * 0.5, ctx.W * 0.55, ctx.H * 0.06, col.white) : null;
    const lab = P.vlabel(rootEl, ctx, I.artist || ctx.label, col.blue, ctx.W * 0.66, ctx.H * 0.6, ctx.u * 5.5, -1);
    P.dots(rootEl, ctx, col.blue);
    const T = P.centered(rootEl, ctx, title, ctx.fonts.display, ctx.W * 0.84, ctx.H * 0.26);
    const tw = Math.min(ctx.W * 0.84, K.measure(title, ctx.fonts.display, T.size));
    const tg = ctx.C.components.tags ? P.tags(rootEl, ctx, sc.seed + 1, 3, { x: ctx.W / 2 - tw * 0.45, y: ctx.H / 2 - T.size * 0.75, w: tw * 0.8, h: T.size * 0.9 }) : null;
    const artist = K.el("div", "dc-intro-artist", rootEl);
    K.useFont(artist, ctx.fonts.display, ctx.u * 4.2);
    artist.style.color = col.white;
    artist.style.top = (ctx.H / 2 + T.size * 0.7).toFixed(0) + "px";
    const artistText = P.up(I.artist);
    const a = Math.min(1.4, D * 0.4), b = Math.min(a + 0.9, D * 0.75);
    const n = T.spans.length;
    const times = T.spans.map((_, i) => a + (b - a) * 0.8 * i / Math.max(1, n));
    return { root: rootEl, update(lt) {
      const building = lt < a && letters.length;
      big.style.display = building ? "block" : "none";
      if (!building) { big.textContent = ""; big.classList.remove("dc-clip"); big.style.backgroundImage = "none"; big.style.color = ""; }
      lab.e.style.display = building ? "block" : "none";
      if (building) {
        const i = Math.min(letters.length - 1, Math.floor(lt / (a / letters.length)));
        big.textContent = letters[i];
        const withPhoto = ctx.photos.length && i % 2 === 0;
        big.classList.toggle("dc-clip", !!withPhoto);
        big.style.backgroundImage = withPhoto ? `url(${ctx.photos[(sc.seed + i) % ctx.photos.length]})` : "none";
        big.style.color = withPhoto ? "transparent" : col.white;
        lab.update(lt);
      }
      if (sig) sig.update(building ? K.prog(lt, 0, a * 0.7) : 0);
      P.typeUpdate(T.spans, times, lt);
      if (tg) { tg.update(lt); rootEl.querySelectorAll(".dc-tag").forEach(e => { if (lt < b) e.style.visibility = "hidden"; }); }
      artist.textContent = artistText.slice(0, Math.round(artistText.length * K.prog(lt, b, b + 0.6)));
    } };
  };
})(typeof window !== "undefined" ? window : globalThis);

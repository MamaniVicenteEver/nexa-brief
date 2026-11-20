// @nexa thumbnail-at: 2.4 — segundo en que el título de la intro ya está escrito
// completo (con la canción demo). De ahí sale el fotograma de miniatura.
/* lyrics-trazo · intro.
   Un círculo diminuto crece con rayos (motivo de apertura de la referencia),
   el título se escribe a mano de izquierda a derecha, el artista se teclea
   letra por letra debajo y un subrayado doble cierra el cartel.
   Textos: config.intro.title / config.intro.artist. Fuentes: intro.titleFont / intro.artistFont. */
(function (root) {
  "use strict";
  const T = root.Trazo = root.Trazo || {};
  /* contrato común de NodeMotion: tarjetas de la intro (miniaturas / vistas) */
  root.NexaTemplateIntro = {
    cards(config) {
      const title = String(config?.title || "").trim();
      return title ? [{ text: title, label: String(config?.artist || ""), scale: 1 }] : [];
    }
  };
  if (!T.core) return;
  const K = T.core, R = T.registry;

  R.intro = function buildIntro(sc, ctx) {
    const I = ctx.C.intro, r = K.rng(sc.seed);
    const D = sc.t1 - sc.t0;
    const rootEl = K.el("div", "tz-scene");
    const s = K.svgLayer(rootEl, ctx.W, ctx.H); s.classList.add("tz-doodle");
    const cx = ctx.W / 2, cy = ctx.H * 0.47;
    /* tiempos relativos, comprimidos si la intro es corta */
    const a = Math.min(0.7, D * 0.25), b = Math.min(a + 1.2, D * 0.72), c = Math.min(b + 0.55, D * 0.9);

    const sunG = K.svg("g", {}, s);
    const ring = K.strokePaths(sunG, [K.wobblyEllipse(0, 0, 10, 12, r, 1.6, 0.08)], { width: 1.6 });
    const rayPaths = K.strokePaths(s, K.rays(cx, cy, ctx.u * 30, ctx.u * 40, 12, r), { width: Math.max(2, ctx.u * 0.45) });

    const holder = K.el("div", "tz-holder", rootEl, { top: "-6%" });
    const titleStyle = { font: I.titleFont, treatment: "solid", case: "asis" };
    const L = T.lettering(holder, I.title || "", titleStyle, ctx.W / ctx.H < 0.85 && String(I.title || "").trim().includes(" ") ? "stack" : "line", ctx, r, { w: 0.86, h: 0.34 });
    L.block.style.transform = "rotate(-4deg)";
    const artist = K.el("div", "tz-intro-artist", rootEl);
    const af = ctx.fonts[I.artistFont] || {};
    artist.style.fontFamily = `"${af.family || "sans-serif"}"`;
    artist.style.fontSize = (Math.min(ctx.W, ctx.H) * 0.105).toFixed(1) + "px";
    const yc = ctx.H * 0.44;  /* centro real del título (holder desplazado −6%) */
    artist.style.top = (yc + L.bh * 0.62 + ctx.u * 3).toFixed(0) + "px";
    const artistText = String(I.artist || "").toLocaleUpperCase("es");
    const under = K.strokePaths(s, [
      K.wobblyLine(cx - L.bw * 0.42, yc + L.bh * 0.55, cx + L.bw * 0.4, yc + L.bh * 0.52, r, 0.03, 6),
      K.wobblyLine(cx - L.bw * 0.3, yc + L.bh * 0.6, cx + L.bw * 0.44, yc + L.bh * 0.58, r, 0.04, 6)
    ], { width: Math.max(2, ctx.u * 0.5) });
    let lastBoil = -1;
    return {
      root: rootEl,
      update(lt, frame) {
        const k = ctx.u * (0.2 + 1.1 * K.ease.out(K.prog(lt, 0, a)));
        sunG.setAttribute("transform", `translate(${cx},${cy}) scale(${k.toFixed(3)})`);
        sunG.style.opacity = String(1 - K.prog(lt, a, a + 0.25));
        ring.forEach(p => { K.setDraw(p, K.prog(lt, 0, a * 0.8)); p.setAttribute("stroke-width", (Math.max(2, ctx.u * 0.4) / Math.max(0.01, k)).toFixed(3)); });
        rayPaths.forEach((p, i) => { K.setDraw(p, K.prog(lt, a * 0.6 + i * 0.02, a + i * 0.02)); p.style.opacity = String(1 - K.prog(lt, a + 0.2, b)); });
        /* escritura: recorte de izquierda a derecha con borde irregular */
        const w = K.prog(lt, a, b);
        L.block.style.clipPath = `inset(-20% ${((1 - K.ease.inOut(w)) * 100).toFixed(1)}% -20% -5%)`;
        under.forEach((p, i) => K.setDraw(p, K.prog(lt, b + i * 0.12, b + 0.3 + i * 0.12)));
        const n = Math.round(artistText.length * K.prog(lt, b - 0.15, c));
        artist.textContent = artistText.slice(0, n);
        if (frame.boilStep !== lastBoil) { T.boilRows(L.rows, frame.boilStep, sc.seed, ctx.C.motion.boil * ctx.u); lastBoil = frame.boilStep; }
        return { inv: false };
      }
    };
  };
})(typeof window !== "undefined" ? window : globalThis);

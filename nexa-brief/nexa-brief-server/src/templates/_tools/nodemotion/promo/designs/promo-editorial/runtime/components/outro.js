(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoEditorialOutro = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const defaults = Object.freeze({
    enabled: true, sec: 3.5, type: "outro", title: "Gracias", sub: "Por ver",
    cta: "Suscríbete", channel: "NodeMotion",
    support: "Tu apoyo hace posible que sigamos trayendo más contenido.",
    url: "youtube.com/@nodemotion"
  });
  const EASE_OUT = "cubic-bezier(.16,.84,.24,1)";
  const EASE_IO = "cubic-bezier(.65,0,.3,1)";

  function options(config) {
    const out = { ...defaults, ...(config || {}) };
    const sec = Number(out.sec);
    out.sec = Number.isFinite(sec) && sec > 0 ? sec : defaults.sec;
    return out;
  }

  function timeline(scenes, duration, config, builders) {
    const out = options(config);
    if (!out.enabled || !Number.isFinite(duration) || duration <= 0) return scenes;
    // Reserva el final dentro de la música: no alarga ni desincroniza el video.
    const start = Math.max(0, duration - out.sec);
    const list = scenes.filter(scene => scene.t0 < start).map(scene => {
      const t1 = Math.min(scene.t1, start);
      return { ...scene, t1, dur: t1 - scene.t0 };
    });
    const type = builders && Object.hasOwn(builders, out.type) ? out.type : "outro";
    list.push({ idx: list.length, kind: "outro", type, t0: start, t1: duration,
      dur: duration - start, seg: { text: out.title, lines: [out.title, out.sub] },
      slot: { type }, words: [] });
    return list;
  }

  /* Retícula por formato. Todo se expresa en fracciones del cuadro para que
     el cierre escale igual en 16:9 y 9:16 sin medidas sueltas. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W,
      headY: 0.064 * H, headRule: 0.092 * H,
      ghostY: 0.272 * H, ghostFs: 0.46 * H, ghostX: -0.06 * W,
      titleW: 0.85 * W, titleH: 0.11 * H, titleY: 0.474 * H,
      subY: 0.585 * H, subFs: 0.032 * H,
      footRule: 0.655 * H,
      ctaY: 0.71 * H, ctaFs: 0.034 * H,
      supY: 0.768 * H, supX: 0.075 * W, supW: 0.72 * W, supFs: 0.0175 * H,
      urlY: 0.9 * H, urlX: 0.075 * W, urlAx: 0, urlFs: 0.0125 * H, urlW: 0.85 * W
    };
    return {
      portrait: false, m: 0.07 * W,
      headY: 0.092 * H, headRule: 0.142 * H,
      ghostY: 0.43 * H, ghostFs: 1.18 * H, ghostX: 0.47 * W,
      titleW: 0.86 * W, titleH: 0.27 * H, titleY: 0.5 * H,
      subY: 0.705 * H, subFs: 0.04 * H,
      footRule: 0.79 * H,
      ctaY: 0.875 * H, ctaFs: 0.036 * H,
      supY: 0.848 * H, supX: 0.39 * W, supW: 0.3 * W, supFs: 0.0205 * H,
      urlY: 0.875 * H, urlX: 0.93 * W, urlAx: 1, urlFs: 0.0145 * H, urlW: 0.2 * W
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, base, rule, wipe, sliceIn, show } = tools;
    const out = options(config), P = palette, G = grid(W, H), m = G.m;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    // Si el cierre se acorta por config, la entrada se comprime con él.
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;
    const hair = Math.max(1, 1.2 * u), thick = Math.max(2, 2.4 * u);
    // sliceIn interpola su recorte desde 0 s: se oculta hasta su entrada exacta.
    // Su clipPath recorta a la caja de línea: más alto de línea para que tildes
    // y eñes en mayúscula (Í, Ó, Ñ) no se corten. El centro óptico no cambia.
    const enter = (t, t0) => { show(X, t.box, t0); t.el.style.lineHeight = "1.32"; return t; };

    const L = base(X);
    L.dataset.component = "promo-editorial.outro";

    /* ---- Corte papel / tinta ----
       La escena anterior termina en negro: el cierre nace negro y el bloque se
       retrae hasta la franja inferior, como el título de apertura en espejo.
       Franja y capas recortadas comparten los mismos keyframes: el corte de
       color del título queda exacto en cualquier fotograma (seek determinista). */
    // Título largo: dos renglones si así gana cuerpo (como la apertura del video).
    // El primero queda entero sobre papel; el último, partido en el corte.
    const fitT = (s, h = G.titleH) => fit(s, "gx", -0.03, G.titleW, h);
    let rows = title ? [title] : [], titleFs = title ? fitT(title) : 0;
    const gaps = [...title.matchAll(/ /g)].map(x => x.index);
    if (gaps.length) {
      const mid = gaps.reduce((a, b) => Math.abs(b - title.length / 2) < Math.abs(a - title.length / 2) ? b : a);
      const two = [title.slice(0, mid), title.slice(mid + 1)];
      // Cuerpo limitado: los dos renglones nunca alcanzan el filete de cabecera.
      const fs2 = Math.min(...two.map(r => fitT(r, 0.75 * G.titleH)));
      if (fs2 > 1.25 * titleFs) { rows = two; titleFs = fs2; }
    }
    const cut = Math.round(title ? G.titleY + 0.2 * titleFs : G.titleY);
    const cutIn = (el, from, to) => X.T(el, "clipPath", from).to(0, at(0.62), to, EASE_IO);
    const band = div(L, "patch", { left: 0, top: 0, width: W + "px", height: H + "px", background: P.black });
    cutIn(band, "inset(0px 0px 0px 0px)", `inset(${cut}px 0px 0px 0px)`);
    const onPaper = div(L, "lay");
    cutIn(onPaper, `inset(0px 0px ${H}px 0px)`, `inset(0px 0px ${H - cut}px 0px)`);
    const onInk = div(L, "lay");
    cutIn(onInk, "inset(0px 0px 0px 0px)", `inset(${cut}px 0px 0px 0px)`);

    /* Contorno gigante: las dos primeras letras del título (motivo de la
       miniatura B), cortado por el borde y con deriva lenta durante el cierre. */
    const ghost = [...title.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("");
    if (ghost) {
      // Sobre la franja el contorno se desvanece antes del colofón: el pie queda limpio.
      const fade = `linear-gradient(to bottom, #000 ${cut + 0.05 * H}px, transparent ${G.footRule - 0.03 * H}px)`;
      const inkGhost = div(onInk, "lay", { webkitMaskImage: fade, maskImage: fade });
      for (const [layer, color, alpha] of [[onPaper, P.black, 0.32], [inkGhost, P.paper, 0.2]]) {
        const g = tx(layer, ghost, { cls: "gx", fs: G.ghostFs, x: G.ghostX, y: G.ghostY, ax: 0, color, stroke: true, ls: -0.04 });
        g.el.style.webkitTextStroke = `${Math.max(1, 1.3 * u)}px ${color}`;
        X.T(g.el, "opacity", "0").to(at(0.12), at(0.7), String(alpha), EASE_OUT);
        X.T(g.el, "transform", "translateX(0px)").to(at(0.12), Math.max(0.5, X.dur - at(0.12)), `translateX(${-0.035 * W}px)`);
      }
    }

    /* ---- Cabecera: nombre del canal espaciado + filete + marca de registro ---- */
    if (channel) {
      const fs = fit(channel, "gx", 0.34, 0.5 * W, (G.portrait ? 0.0135 : 0.0175) * H);
      const lab = tx(onPaper, channel, { cls: "gx", fs, x: m, y: G.headY, ax: 0, color: P.black, ls: 0.34 });
      show(X, lab.box, at(0.3));
    }
    rule(X, onPaper, m, G.headRule, W - 2 * m, hair, at(0.34));
    const mark = Math.min(0.022 * W, 0.022 * H) * (G.portrait ? 1.6 : 1);
    const mx = W - m - mark, my = G.headY - mark / 2;
    rule(X, onPaper, mx, my + mark / 2 - thick / 2, mark, thick, at(0.42));
    const tick = div(onPaper, "patch", { left: mx + mark / 2 - thick / 2 + "px", top: my + "px",
      width: thick + "px", height: mark + "px", background: P.black, transformOrigin: "50% 0%" });
    X.T(tick, "transform", "scaleY(0)").to(at(0.46), 0.3, "scaleY(1)", EASE_OUT);

    /* ---- Título partido: tinta sobre papel, papel sobre la franja ---- */
    if (title) {
      const tIn = at(0.4);
      rows.forEach((row, i) => {
        // Interlineado con aire para tildes y eñes en el renglón inferior.
        const y = G.titleY - (rows.length - 1 - i) * 1.02 * titleFs, t0 = tIn + i * 0.08;
        for (const [layer, color] of [[onPaper, P.black], [onInk, P.paper]])
          enter(sliceIn(X, layer, row, m, y, titleFs, color, t0, { ax: 0, ls: -0.03 }), t0);
      });
    }

    /* ---- Subtítulo espaciado + filete guía hasta el margen derecho ---- */
    if (sub) {
      const fs = fit(sub, "gx", 0.3, 0.6 * W, G.subFs);
      enter(sliceIn(X, onInk, sub, m, G.subY, fs, P.paper, at(0.62), { ax: 0, ls: 0.3 }), at(0.62));
      const end = m + textW(sub, "gx", 0.3, fs) + 0.025 * W;
      if (W - m - end > 0.08 * W) {
        const lead = rule(X, onInk, end, G.subY - hair / 2, W - m - end, hair, at(0.7), P.paper);
        lead.style.opacity = "0.55";
      }
    }

    /* ---- Colofón: filete, llamada en placa, apoyo y dirección ---- */
    const foot = rule(X, onInk, m, G.footRule, W - 2 * m, hair, at(0.78), P.paper);
    foot.style.opacity = "0.4";
    if (cta) {
      // Placa invertida (papel con tinta), la misma pieza que las placas de nombre.
      const fs = fit(cta, "gx", 0.06, (G.portrait ? 0.7 : 0.28) * W, G.ctaFs);
      const padX = 0.62 * fs, padY = 0.36 * fs;
      const plate = div(onInk, "patch", { left: m + "px", top: G.ctaY + "px", transform: "translateY(-50%)",
        background: P.paper, padding: `${padY}px ${padX}px` });
      const t = tx(plate, cta, { cls: "gx", fs, x: 0, y: 0, ax: 0, ay: 0, color: P.black, ls: 0.06 });
      t.box.style.position = "relative";
      t.el.style.lineHeight = "1.12"; // deja aire a la tilde de «Í»
      X.T(plate, "clipPath", "inset(0% 100% 0% 0%)").to(at(0.86), 0.32, "inset(0% 0% 0% 0%)", EASE_OUT);
      X.T(t.el, "transform", "translateX(-14%)").to(at(0.9), 0.36, "translateX(0%)", EASE_OUT);
    }
    if (supportText) {
      const sup = div(onInk, "patch", { left: G.supX + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: '"Archivo", sans-serif', fontWeight: "400", fontStretch: "100%", fontSize: G.supFs + "px",
        lineHeight: "1.42", letterSpacing: "0.005em", color: P.paper, opacity: "0.86", whiteSpace: "normal",
        textWrap: "pretty" });
      sup.textContent = supportText;
      X.T(sup, "transform", `translateY(${0.4 * G.supFs}px)`).to(at(1.0), 0.4, "translateY(0px)", EASE_OUT);
      show(X, sup, at(1.0));
    }
    if (url) {
      const fs = fit(url.toUpperCase(), "gx", 0.14, G.urlW, G.urlFs);
      const link = tx(onInk, url, { cls: "gx", fs, x: G.urlX, y: G.urlY, ax: G.urlAx, color: P.paper, ls: 0.14 });
      show(X, link.box, at(1.12));
      const uw = textW(url.toUpperCase(), "gx", 0.14, fs);
      const ux = G.urlAx ? G.urlX - uw : G.urlX;
      const under = rule(X, onInk, ux, G.urlY + 0.95 * fs, uw * 0.999, Math.max(1, hair), at(1.18), P.paper);
      under.style.opacity = "0.5";
    }
  }

  return { defaults, options, timeline, render };
});

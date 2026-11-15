(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoTrendyOutroV2 = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createApi() {
  "use strict";
  const defaults = Object.freeze({
    enabled: true, sec: 3.5, type: "outro", title: "Gracias", sub: "Por ver",
    cta: "Suscríbete", channel: "NodeMotion",
    support: "Tu apoyo hace posible que sigamos trayendo más contenido.",
    url: "youtube.com/@nodemotion"
  });
  const EASE_OUT = "cubic-bezier(.16,.84,.24,1)";

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

  /* V2 · versión clara en papel: titular azul noche subrayado por franjas
     de marcador lima y rosa (las barras de «ENTRENA» / «RÁPIDO»). */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W, headY: 0.06 * H,
      titleW: 0.86 * W, titleH: 0.1 * H, titleY: 0.36 * H, subY: 0.46 * H, subFs: 0.02 * H,
      ring: { x: 0.92 * W, y: 0.24 * H, r: 0.14 * H },
      footRule: 0.6 * H, ctaY: 0.665 * H, ctaFs: 0.03 * H, supX: 0.075 * W, supY: 0.715 * H, supW: 0.8 * W, supFs: 0.0175 * H,
      urlX: 0.075 * W, urlY: 0.86 * H, urlAx: 0, urlFs: 0.0135 * H, urlW: 0.85 * W
    };
    return {
      portrait: false, m: 0.07 * W, headY: 0.085 * H,
      titleW: 0.7 * W, titleH: 0.24 * H, titleY: 0.4 * H, subY: 0.6 * H, subFs: 0.032 * H,
      ring: { x: 0.9 * W, y: 0.36 * H, r: 0.3 * H },
      footRule: 0.75 * H, ctaY: 0.855 * H, ctaFs: 0.034 * H, supX: 0.37 * W, supY: 0.855 * H, supW: 0.3 * W, supFs: 0.02 * H,
      urlX: 0.93 * W, urlY: 0.855 * H, urlAx: 1, urlFs: 0.0145 * H, urlW: 0.22 * W
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, mark, dots, ring, leak, streak, glitchIn, slideIn } = tools;
    const P = palette, lime = P.lime || "#A6EB35", paper = P.paper || "#F2EFE6", navy = P.navy2 || "#0B0B24";
    const pink = "#E7A2A0";
    const out = options(config), G = grid(W, H), m = G.m;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;

    const L = div(X.root, "lay", { background: paper });
    L.dataset.component = "promo-trendy.outroV2";
    leak(L, G.portrait ? "100% 0%" : "100% 0%", 0.16);
    const rg = ring(L, G.ring.x, G.ring.y, G.ring.r, "rgba(11,11,36,0.28)", 1.4 * u);
    X.T(rg, "transform", "scale(0.2)").to(at(0.3), 0.45, "scale(1)", EASE_OUT).to(at(0.75), Math.max(0.4, X.dur - at(0.75)), "scale(1.05)");
    dots(L, W - m - (G.portrait ? 0.2 : 0.08) * W, G.headY - 0.02 * H, (G.portrait ? 0.2 : 0.08) * W, 0.06 * H, navy, 6 * u);

    const bar = (x, y, w, h, color, t0, origin = "0% 50%") => {
      const b = div(L, "patch", { left: x + "px", top: y + "px", width: w + "px", height: h + "px", background: color, transformOrigin: origin });
      X.T(b, "transform", "scaleX(0)").to(t0, 0.3, "scaleX(1)", EASE_OUT);
      return b;
    };

    if (channel) {
      const fs = fit(channel, "mi", 0.36, 0.5 * W, (G.portrait ? 0.013 : 0.016) * H);
      const c = tx(L, channel, { cls: "mi", fs, x: m, y: G.headY, ax: 0, color: navy, ls: 0.36 });
      show(X, c.box, at(0.4));
    }

    /* ---- Titular con franjas de marcador ---- */
    if (title) {
      const fs = fit(title, "mi", 0.02, G.titleW, G.titleH), tw = textW(title, "mi", 0.02, fs);
      // Franja lima a sangre por la mitad baja del titular; rosa fina por encima.
      bar(0, G.titleY + 0.02 * fs, m + tw + 0.04 * W, 0.36 * fs, lime, at(0.3));
      bar(m + 0.3 * tw, G.titleY - 0.52 * fs, tw * 0.75, Math.max(4, 0.06 * fs), pink, at(0.4));
      const t = tx(L, title, { cls: "mi", fs, x: m, y: G.titleY, ax: 0, color: navy, ls: 0.02 });
      t.el.style.lineHeight = "1.15";
      glitchIn(X, t, at(0.42));
    }
    if (sub) {
      const fs = fit(sub, "mi", 0.42, 0.5 * W, G.subFs), bw = 0.06 * W;
      bar(m, G.subY - 0.1 * fs, bw, Math.max(3, 0.22 * fs), navy, at(0.66));
      const s = tx(L, sub, { cls: "mi", fs, x: m + bw + 0.02 * W, y: G.subY, ax: 0, color: navy, ls: 0.42 });
      slideIn(X, s.el, at(0.7), 0.12 * W, 0.28);
    }
    mark(X, L, "+", G.portrait ? 0.86 * W : 0.78 * W, G.portrait ? 0.53 * H : 0.62 * H, 30 * u, navy, at(0.78));
    mark(X, L, "×", G.portrait ? 0.84 * W : 0.62 * W, G.portrait ? 0.14 * H : 0.16 * H, 15 * u, navy, at(0.82));

    /* ---- Colofón ---- */
    const rule = div(L, "patch", { left: m + "px", top: G.footRule + "px", width: W - 2 * m + "px",
      height: Math.max(1, 1.2 * u) + "px", background: "rgba(11,11,36,0.35)", transformOrigin: "0% 50%" });
    X.T(rule, "transform", "scaleX(0)").to(at(0.8), 0.35, "scaleX(1)", EASE_OUT);
    if (cta) {
      const fs = fit(cta, "mi", 0.06, (G.portrait ? 0.7 : 0.24) * W, G.ctaFs);
      const padX = 0.6 * fs, w = textW(cta, "mi", 0.06, fs) + 2 * padX, h = fs * 1.55;
      const plate = div(L, "patch", { left: m + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: navy, transformOrigin: "0% 50%" });
      X.T(plate, "transform", "scaleX(0)").to(at(0.88), 0.26, "scaleX(1)", EASE_OUT);
      const t = tx(L, cta, { cls: "mi", fs, x: m + padX, y: G.ctaY, ax: 0, color: lime, ls: 0.06 });
      t.el.style.lineHeight = "1.2";
      slideIn(X, t.el, at(0.96), 0.04 * W, 0.24);
    }
    if (supportText) {
      const sup = div(L, "patch", { left: G.supX + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: "var(--fMain), sans-serif", fontWeight: "800", fontStyle: "italic", fontSize: G.supFs + "px",
        lineHeight: "1.38", color: navy, whiteSpace: "normal", textWrap: "pretty" });
      sup.textContent = supportText;
      const dy = G.portrait ? "0px" : "-50%";
      X.T(sup, "transform", `translate(0px, calc(${dy} + 10px))`).to(at(1.04), 0.3, `translate(0px, calc(${dy} + 0px))`, EASE_OUT);
      show(X, sup, at(1.04));
    }
    if (url) {
      const U = url.toUpperCase(), fs = fit(U, "mi", 0.12, G.urlW, G.urlFs);
      const t = tx(L, U, { cls: "mi", fs, x: G.urlX, y: G.urlY, ax: G.urlAx, color: navy, ls: 0.12 });
      show(X, t.box, at(1.12));
      const uw = textW(U, "mi", 0.12, fs), ux = G.urlAx ? G.urlX - uw : G.urlX;
      bar(ux, G.urlY + 0.9 * fs, uw, Math.max(2, 2 * u), lime, at(1.16));
    }

    // Arranca en azul noche (como la escena anterior); el corte a papel ocurre bajo el barrido.
    const cover = div(L, "lay", { background: `radial-gradient(ellipse at 40% 45%, ${P.navy2 || "#0B0B24"} 0%, ${P.navy || "#000012"} 72%)` });
    X.T(cover, "visibility", "visible", true).set(at(0.2), "hidden");
    // Barrido de franjas diagonales que tapa el paso desde la escena anterior.
    streak(X, L, 0, at(0.42), G.portrait ? -22 : -32);
  }

  return { defaults, options, timeline, render };
});

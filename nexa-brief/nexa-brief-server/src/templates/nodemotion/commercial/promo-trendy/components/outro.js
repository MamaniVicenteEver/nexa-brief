(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoTrendyOutro = api;
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

  /* Pantalla partida: emoción sobre azul noche, acción sobre el panel lima.
     En horizontal el panel va a la derecha; en vertical, abajo. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, panel: { x: 0, y: 0.6 * H, w: W, h: 0.4 * H }, m: 0.075 * W,
      titleX: 0.075 * W, titleW: 0.85 * W, titleH: 0.085 * H, stackY: 0.35 * H,
      subY: 0.5 * H, subFs: 0.02 * H, ring: { x: 0.78 * W, y: 0.6 * H, r: 0.16 * H },
      chanY: 0.645 * H, ctaY: 0.715 * H, ctaFs: 0.032 * H, ctaW: 0.7 * W,
      supY: 0.765 * H, supW: 0.8 * W, supFs: 0.0175 * H, urlY: 0.905 * H, urlFs: 0.0135 * H, urlW: 0.85 * W
    };
    const px = 0.64 * W, pm = px + 0.05 * W;
    return {
      portrait: false, panel: { x: px, y: 0, w: W - px, h: H }, m: 0.07 * W, pm,
      titleX: 0.07 * W, titleW: 0.5 * W, titleH: 0.15 * H, stackY: 0.43 * H,
      subY: 0.7 * H, subFs: 0.032 * H, ring: { x: px, y: 0.5 * H, r: 0.34 * H },
      chanY: 0.22 * H, ctaY: 0.42 * H, ctaFs: 0.036 * H, ctaW: 0.26 * W,
      supY: 0.49 * H, supW: 0.26 * W, supFs: 0.021 * H, urlY: 0.7 * H, urlFs: 0.0145 * H, urlW: 0.26 * W
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, mark, dots, ring, leak, vignette, streak, slideIn } = tools;
    const P = palette, lime = P.lime || "#A6EB35", paper = P.paper || "#F2EFE6";
    const navy = P.navy || "#000012", navy2 = P.navy2 || "#0B0B24";
    const out = options(config), G = grid(W, H), m = G.m, PN = G.panel;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;
    const ix = G.portrait ? m : G.pm; // margen izquierdo del bloque de acción

    // Azul noche con fuga cálida: el fondo de las tarjetas de la promo.
    const L = div(X.root, "lay", { background: `radial-gradient(ellipse at 40% 45%, ${navy2} 0%, ${navy} 72%)` });
    L.dataset.component = "promo-trendy.outro";
    const glow = leak(L, G.portrait ? "0% 55%" : "8% 100%", 0.5);
    X.T(glow, "transform", "scale(1)").to(0, X.dur, "scale(1.15)");

    /* ---- Panel lima que entra tras el barrido ---- */
    const panel = div(L, "patch", { left: PN.x + "px", top: PN.y + "px", width: PN.w + "px", height: PN.h + "px",
      background: lime, transformOrigin: G.portrait ? "50% 100%" : "100% 50%" });
    X.T(panel, "transform", G.portrait ? "scaleY(0)" : "scaleX(0)").to(at(0.22), at(0.36), G.portrait ? "scaleY(1)" : "scaleX(1)", EASE_IO);
    dots(L, PN.x + PN.w - (G.portrait ? 0.24 : 0.1) * W, PN.y + (G.portrait ? 0.03 : 0.05) * H, (G.portrait ? 0.18 : 0.07) * W,
      (G.portrait ? 0.05 : 0.08) * H, navy, 6 * u);
    // Aro fino que cruza el corte entre azul y lima.
    const rg = ring(L, G.ring.x, G.ring.y, G.ring.r, "rgba(242,239,230,0.5)", 1.4 * u);
    X.T(rg, "transform", "scale(0.15)").to(at(0.3), 0.45, "scale(1)", EASE_OUT).to(at(0.75), Math.max(0.4, X.dur - at(0.75)), "scale(1.05)");

    /* ---- Pila del título: fantasma en contorno, sólido lima, fantasma ---- */
    if (title) {
      const ls = 0.04, fs = fit(title, "mi", ls, G.titleW, G.titleH), lh = fs * 0.98;
      [-1, 0, 1].forEach((d, i) => {
        const ghost = d !== 0;
        const o = tx(L, title, { cls: "mi", fs, x: G.titleX, y: G.stackY + d * lh, ax: 0, ls,
          // Fantasmas en relleno translúcido: el contorno de Montserrat variable deja ver solapes internos.
          color: ghost ? "rgba(242,239,230,0.14)" : lime });
        o.el.style.lineHeight = "1.12";
        slideIn(X, o.el, at(0.4) + i * at(0.07), (ghost ? 0.3 : 0.45) * W);
      });
    }
    if (sub) {
      const fs = fit(sub, "mi", 0.4, 0.5 * W, G.subFs), barW = 0.06 * W;
      const bar = div(L, "patch", { left: G.titleX + "px", top: G.subY - 0.12 * fs + "px", width: barW + "px",
        height: Math.max(3, 0.24 * fs) + "px", background: paper, transformOrigin: "0% 50%" });
      X.T(bar, "transform", "scaleX(0)").to(at(0.72), 0.3, "scaleX(1)", EASE_OUT);
      const s = tx(L, sub, { cls: "mi", fs, x: G.titleX + barW + 0.02 * W, y: G.subY, ax: 0, color: paper, ls: 0.4 });
      slideIn(X, s.el, at(0.76), 0.12 * W, 0.28);
    }
    mark(X, L, "+", G.portrait ? 0.88 * W : 0.56 * W, G.portrait ? 0.08 * H : 0.84 * H, 34 * u, paper, at(0.8));
    mark(X, L, "×", G.portrait ? 0.1 * W : 0.08 * W, G.portrait ? 0.08 * H : 0.12 * H, 16 * u, paper, at(0.85));

    /* ---- Bloque de acción sobre el panel lima ---- */
    if (channel) {
      const fs = fit(channel, "mi", 0.36, (G.portrait ? 0.6 : 0.24) * W, (G.portrait ? 0.013 : 0.016) * H);
      const c = tx(L, channel, { cls: "mi", fs, x: ix, y: G.chanY, ax: 0, color: navy, ls: 0.36 });
      show(X, c.box, at(0.7));
      const ln = div(L, "patch", { left: ix + "px", top: G.chanY + 1.1 * fs + "px", width: 0.05 * W + "px",
        height: Math.max(2, 0.18 * fs) + "px", background: navy, transformOrigin: "0% 50%" });
      X.T(ln, "transform", "scaleX(0)").to(at(0.74), 0.3, "scaleX(1)", EASE_OUT);
    }
    if (cta) {
      // Placa azul noche con texto lima: la etiqueta legible de las escenas.
      const fs = fit(cta, "mi", 0.06, G.ctaW, G.ctaFs);
      const padX = 0.6 * fs, w = textW(cta, "mi", 0.06, fs) + 2 * padX, h = fs * 1.55;
      const plate = div(L, "patch", { left: ix + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: navy, transformOrigin: "0% 50%" });
      X.T(plate, "transform", "scaleX(0)").to(at(0.84), 0.28, "scaleX(1)", EASE_OUT);
      const t = tx(L, cta, { cls: "mi", fs, x: ix + padX, y: G.ctaY, ax: 0, color: lime, ls: 0.06 });
      t.el.style.lineHeight = "1.2";
      slideIn(X, t.el, at(0.94), 0.05 * W, 0.26);
    }
    if (supportText) {
      const sup = div(L, "patch", { left: ix + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: "var(--fMain), sans-serif", fontWeight: "800", fontStyle: "italic", fontSize: G.supFs + "px",
        lineHeight: "1.38", color: navy, whiteSpace: "normal", textWrap: "pretty" });
      sup.textContent = supportText;
      show(X, sup, at(1.04));
      X.T(sup, "transform", "translateY(10px)").to(at(1.04), 0.3, "translateY(0px)", EASE_OUT);
    }
    if (url) {
      const U = url.toUpperCase(), fs = fit(U, "mi", 0.12, G.urlW, G.urlFs);
      const t = tx(L, U, { cls: "mi", fs, x: ix, y: G.urlY, ax: 0, color: navy, ls: 0.12 });
      show(X, t.box, at(1.14));
      const uw = textW(U, "mi", 0.12, fs);
      const under = div(L, "patch", { left: ix + "px", top: G.urlY + 0.9 * fs + "px", width: uw + "px",
        height: Math.max(1, 1.4 * u) + "px", background: navy, transformOrigin: "0% 50%" });
      X.T(under, "transform", "scaleX(0)").to(at(1.18), 0.3, "scaleX(1)", EASE_OUT);
    }

    vignette(L);
    // Barrido de franjas diagonales lima/papel/rosa que abre el cierre (encima de todo).
    streak(X, L, 0, at(0.42), G.portrait ? -22 : -32);
  }

  return { defaults, options, timeline, render };
});

(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoSportsOutroV2 = api;
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

  /* V2 · cierre en espejo de la apertura «DEPORTE»: titular gigante de
     piedra moteada, subtítulo en amarillo y una franja ticker al pie. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W, chanY: 0.06 * H,
      giantW: 0.94 * W, giantH: 0.2 * H, giantY: 0.37 * H, subY: 0.475 * H, subFs: 0.022 * H,
      ctaY: 0.62 * H, ctaFs: 0.03 * H, supY: 0.67 * H, supW: 0.8 * W, supFs: 0.0175 * H,
      bandY: 0.885 * H, bandH: 0.075 * H
    };
    return {
      portrait: false, m: 0.06 * W, chanY: 0.085 * H,
      giantW: 0.92 * W, giantH: 0.42 * H, giantY: 0.41 * H, subY: 0.64 * H, subFs: 0.034 * H,
      ctaY: 0.745 * H, ctaFs: 0.032 * H, supY: 0.792 * H, supW: 0.5 * W, supFs: 0.0195 * H,
      bandY: 0.885 * H, bandH: 0.09 * H
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, base, dust, word, scramble } = tools;
    const P = palette, yellow = P.yellow || "#EBE609", white = P.white || "#F3F3F1", ink = P.ink || "#0B0B0B";
    const out = options(config), G = grid(W, H), m = G.m, cx = W / 2;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;

    const L = base(X);
    L.dataset.component = "promo-sports.outroV2";
    div(L, "lay", { background: "radial-gradient(ellipse at 50% 42%, rgba(46,52,60,0.7) 0%, rgba(0,0,0,0) 60%)" });

    /* ---- Titular gigante de piedra (la textura de la apertura) ---- */
    if (title) {
      const fs = fit(title, "sp", -0.02, G.giantW, G.giantH);
      // El canvas deja 0.06·fs de margen a la izquierda y 0.22·fs a la derecha: se compensa el centro.
      const g = tx(L, title, { cls: "sp", fs, x: cx + 0.08 * fs, y: G.giantY, color: "#DEDBD3", ls: -0.02, canvas: true, texture: true });
      X.T(g.el, "opacity", "0").to(at(0.05), at(0.3), "0.94", EASE_OUT);
      X.T(g.el, "transform", "scale(1.18) translateX(1.5%)").to(at(0.05), Math.max(0.6, X.dur - at(0.05)), "scale(1) translateX(0%)", "cubic-bezier(.12,.7,.2,1)");
    }
    dust(X, L, 12);

    if (channel) {
      const fs = fit(channel, "sp", 0.42, 0.5 * W, (G.portrait ? 0.012 : 0.016) * H);
      const c = word(X, L, channel, m, G.chanY, fs, { ax: 0, ls: 0.42, color: yellow });
      show(X, c.box, at(0.4));
      const ln = div(L, "patch", { left: W - m - 0.05 * W + "px", top: G.chanY + "px", width: 0.05 * W + "px",
        height: Math.max(2, 2.5 * u) + "px", background: yellow, transformOrigin: "100% 50%" });
      X.T(ln, "transform", "scaleX(0)").to(at(0.42), 0.3, "scaleX(1)", EASE_OUT);
    }
    if (sub) {
      const fs = fit(sub, "sp", 0.42, 0.7 * W, G.subFs);
      const s = word(X, L, sub, cx + 0.21 * fs, G.subY, fs, { ls: 0.42, color: yellow, split: "chars" });
      s.el.style.lineHeight = "1.2";
      scramble(X, s, at(0.5), 0.4);
    }

    /* ---- Llamada y apoyo ---- */
    if (cta) {
      const fs = fit(cta, "sp", 0.1, (G.portrait ? 0.66 : 0.3) * W, G.ctaFs);
      const padX = 0.7 * fs, w = textW(cta, "sp", 0.1, fs) + 2 * padX, h = fs * 1.6;
      const plate = div(L, "patch", { left: cx - w / 2 + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        border: `${Math.max(2, 2.2 * u)}px solid ${yellow}`, boxSizing: "border-box" });
      show(X, plate, at(0.72));
      X.T(plate, "transform", "scale(1.25)").to(at(0.72), 0.3, "scale(1)", EASE_OUT);
      const t = word(X, L, cta, cx + 0.05 * fs, G.ctaY, fs, { ls: 0.1, color: white, split: "chars" });
      t.el.style.lineHeight = "1.2";
      scramble(X, t, at(0.8), 0.35);
    }
    if (supportText) {
      const sup = div(L, "patch", { left: cx - G.supW / 2 + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: "var(--fS), sans-serif", fontWeight: "900", fontStyle: "italic", fontSize: G.supFs + "px",
        lineHeight: "1.4", letterSpacing: "0.02em", color: "rgba(243,243,241,0.78)", textAlign: "center",
        whiteSpace: "normal", textWrap: "balance" });
      sup.textContent = supportText;
      show(X, sup, at(0.95));
    }

    /* ---- Franja ticker al pie (la escena «A TOPE»): dirección y llamada en bucle ---- */
    const band = div(L, "patch", { left: 0, top: G.bandY + "px", width: W + "px", height: G.bandH + "px",
      background: yellow, transformOrigin: "50% 100%", overflow: "hidden" });
    X.T(band, "transform", "scaleY(0)").to(at(0.6), 0.22, "scaleY(1)", EASE_OUT);
    const parts = [url.toUpperCase(), cta].filter(Boolean);
    if (parts.length) {
      const unit = parts.join("   •   ") + "   •   ", fs = 0.42 * G.bandH;
      const uw = textW(unit, "sp", 0.08, fs), reps = Math.ceil((W * 2) / uw) + 2;
      const line = tx(band, unit.repeat(reps), { cls: "sp", fs, x: 0, y: G.bandH / 2, ax: 0, ay: 0.5, color: ink, ls: 0.08 });
      line.el.style.whiteSpace = "pre";
      X.T(line.el, "transform", "translateX(0px)").to(0, Math.max(0.5, X.dur), `translateX(${-uw}px)`);
      show(X, line.box, at(0.75));
    }
  }

  return { defaults, options, timeline, render };
});

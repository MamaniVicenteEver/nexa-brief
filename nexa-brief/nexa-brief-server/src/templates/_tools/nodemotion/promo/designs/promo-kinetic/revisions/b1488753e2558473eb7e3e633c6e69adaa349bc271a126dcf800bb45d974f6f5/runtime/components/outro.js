(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoKineticOutro = api;
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
  const GRAD_FALLBACK = ["#F2C81E", "#F08A1A", "#E3401E", "#C02B8E", "#5A3FD6", "#2F5FE0", "#B8B7B0"];

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

  /* Retícula por formato, en fracciones del cuadro. Composición centrada,
     como todas las escenas de la promo. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, rowW: 0.84 * W, titleW: 0.86 * W, titleH: 0.09 * H,
      chanY: 0.27 * H, titleY: 0.355 * H, specY: 0.41 * H, subY: 0.455 * H, subFs: 0.022 * H,
      ctaY: 0.58 * H, ctaFs: 0.034 * H, supY: 0.655 * H, supW: 0.8 * W, supFs: 0.017 * H,
      urlY: 0.75 * H, urlFs: 0.015 * H
    };
    return {
      portrait: false, rowW: 0.46 * W, titleW: 0.66 * W, titleH: 0.22 * H,
      chanY: 0.17 * H, titleY: 0.36 * H, specY: 0.485 * H, subY: 0.555 * H, subFs: 0.036 * H,
      ctaY: 0.69 * H, ctaFs: 0.042 * H, supY: 0.775 * H, supW: 0.6 * W, supFs: 0.02 * H,
      urlY: 0.85 * H, urlFs: 0.018 * H
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, base, show } = tools;
    const P = palette, GRAD = tools.GRAD || GRAD_FALLBACK;
    const bone = P.white || "#BDBDB8", red = P.red || "#9B1F1F", yellow = P.yellow || "#D9C21A";
    const out = options(config), G = grid(W, H);
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;
    const cx = W / 2;

    // Fondo de la promo: carbón, «pelos», luz central y HUD de película.
    const L = base(X);
    L.dataset.component = "promo-kinetic.outro";
    const mono = (s, x, y, fs, color, ls = 0.05, ax = 0.5) => {
      const o = tx(L, s, { cls: "mono", fs, x, y, ax, color });
      o.el.style.letterSpacing = ls + "em";
      return o;
    };

    /* ---- Filas en degradado que se condensan en el titular ----
       Siete filas con la paleta GRAD (la escena «DEGRADADO»); las exteriores
       se pliegan hacia la central, que vira a hueso y crece hasta su lugar. */
    if (title) {
      const n = 7, c = 3;
      const rowFs = Math.min(fit(title, "ki", 0, G.rowW, 1e9), (0.9 * H / n) / 0.92);
      const lh = rowFs * 0.92, y0 = H / 2 - c * lh;
      const finalFs = fit(title, "ki", 0, G.titleW, G.titleH);
      const scale = finalFs / rowFs, tCollapse = at(0.78), dCollapse = at(0.42);
      const grp = div(L, "lay", { transformOrigin: `${cx}px ${H / 2}px` });
      for (let i = 0; i < n; i++) {
        const t = tx(grp, title, { cls: "ki", fs: rowFs, x: cx, y: y0 + i * lh, color: GRAD[i % GRAD.length] });
        const t0 = at(0.04) + Math.abs(i - c) * at(0.05);
        show(X, t.box, t0);
        X.T(t.el, "transform", "scaleY(0.2)").to(t0, 0.22, "scaleY(1)", EASE_OUT);
        if (i === c) {
          X.T(t.el, "color", GRAD[i % GRAD.length], true).set(tCollapse + dCollapse * 0.3, bone);
        } else {
          X.T(t.box, "transform", "translate(-50%, -50%) translateY(0px)")
            .to(tCollapse, dCollapse, `translate(-50%, -50%) translateY(${(c - i) * lh}px)`, EASE_IO);
          X.T(t.el, "opacity", "1").to(tCollapse + dCollapse * 0.4, dCollapse * 0.5, "0");
        }
      }
      X.T(grp, "transform", "translateY(0px) scale(1)")
        .to(tCollapse, dCollapse + at(0.08), `translateY(${G.titleY - H / 2}px) scale(${scale.toFixed(4)})`, EASE_IO);

      // El degradado queda resumido en un filete espectral bajo el titular.
      const tw = textW(title, "ki", 0, finalFs), segW = tw / GRAD.length, segH = Math.max(3, (G.portrait ? 0.006 : 0.011) * H);
      GRAD.forEach((g, i) => {
        const seg = div(L, "patch", { left: cx - tw / 2 + i * segW + "px", top: G.specY - segH / 2 + "px",
          width: segW + 0.5 + "px", height: segH + "px", background: g, transformOrigin: "0% 50%" });
        X.T(seg, "transform", "scaleX(0)").to(at(1.08) + i * 0.03, 0.22, "scaleX(1)", EASE_OUT);
      });
    }

    // Canal: mono espaciado entre dos filetes cortos, como un rótulo de HUD.
    if (channel) {
      const fs = (G.portrait ? 0.012 : 0.015) * H;
      const lab = mono(channel, cx, G.chanY, fs, "rgba(230,230,230,0.72)", 0.42);
      show(X, lab.box, at(1.05));
      const half = textW(channel, "mono", 0.42, fs) / 2 + 0.02 * W, len = (G.portrait ? 0.06 : 0.04) * W;
      for (const s of [-1, 1]) {
        const ln = div(L, "patch", { left: (s < 0 ? cx - half - len : cx + half) + "px", top: G.chanY + "px",
          width: len + "px", height: Math.max(1, u) + "px", background: "rgba(230,230,230,0.45)",
          transformOrigin: s < 0 ? "100% 50%" : "0% 50%" });
        X.T(ln, "transform", "scaleX(0)").to(at(1.08), 0.3, "scaleX(1)", EASE_OUT);
      }
    }

    if (sub) {
      const fs = fit(sub, "ki", 0.34, 0.7 * W, G.subFs);
      const s = tx(L, sub, { cls: "ki", fs, x: cx, y: G.subY, color: yellow, ls: 0.34 });
      show(X, s.box, at(1.2));
      X.T(s.el, "transform", "scaleY(0.2)").to(at(1.2), 0.22, "scaleY(1)", EASE_OUT);
    }

    /* ---- Llamada con bloque de marcador (la escena «MARCADOR») ---- */
    if (cta) {
      const fs = fit(cta, "ki", 0.04, (G.portrait ? 0.7 : 0.4) * W, G.ctaFs);
      const w = textW(cta, "ki", 0.04, fs) + fs * 1.1, h = fs * 1.42;
      const b = div(L, "patch", { left: cx - w / 2 + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: red, transformOrigin: "0% 50%" });
      X.T(b, "transform", "scaleX(0)").to(at(1.3), 0.25, "scaleX(1)", EASE_OUT);
      const t = tx(L, cta, { cls: "ki", fs, x: cx, y: G.ctaY, color: bone, ls: 0.04 });
      t.el.style.lineHeight = "1.12";
      show(X, t.box, at(1.42));
    }
    if (supportText) {
      const sup = div(L, "patch", { left: cx - G.supW / 2 + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: "var(--fM), monospace", fontWeight: "500", fontSize: G.supFs + "px", lineHeight: "1.5",
        letterSpacing: "0.01em", color: "rgba(230,230,230,0.82)", textAlign: "center", whiteSpace: "normal", textWrap: "balance" });
      sup.textContent = supportText;
      show(X, sup, at(1.5));
    }
    if (url) {
      const fs = Math.min(G.urlFs, fit(url, "mono", 0.06, 0.8 * W, G.urlFs));
      const link = mono(url, cx, G.urlY, fs, yellow, 0.06);
      show(X, link.box, at(1.6));
      const uw = textW(url, "mono", 0.06, fs);
      const under = div(L, "patch", { left: cx - uw / 2 + "px", top: G.urlY + 0.85 * fs + "px", width: uw + "px",
        height: Math.max(1, 1.2 * u) + "px", background: yellow, transformOrigin: "0% 50%", opacity: "0.7" });
      X.T(under, "transform", "scaleX(0)").to(at(1.64), 0.3, "scaleX(1)", EASE_OUT);
    }
  }

  return { defaults, options, timeline, render };
});

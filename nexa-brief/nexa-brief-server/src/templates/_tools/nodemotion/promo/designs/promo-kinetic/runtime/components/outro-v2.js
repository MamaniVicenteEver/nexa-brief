(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoKineticOutroV2 = api;
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

  /* V2 · el bloque gigante de color (escenas «PRONTO» / «SAMURÁI») con las
     filas del título cruzándose dentro; la información vive a su lado. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, block: { x: 0.05 * W, y: 0.06 * H, w: 0.9 * W, h: 0.46 * H }, rows: 5,
      rowW: 0.8 * W, ix: 0.08 * W, infoW: 0.84 * W,
      chanY: 0.57 * H, subY: 0.625 * H, subFs: 0.034 * H, ctaY: 0.705 * H, ctaFs: 0.03 * H,
      supY: 0.75 * H, supFs: 0.0165 * H, urlY: 0.86 * H, urlFs: 0.0145 * H
    };
    return {
      portrait: false, block: { x: 0.06 * W, y: 0.04 * H, w: 0.46 * W, h: 0.92 * H }, rows: 5,
      rowW: 0.4 * W, ix: 0.585 * W, infoW: 0.34 * W,
      chanY: 0.2 * H, subY: 0.33 * H, subFs: 0.075 * H, ctaY: 0.49 * H, ctaFs: 0.04 * H,
      supY: 0.57 * H, supFs: 0.02 * H, urlY: 0.75 * H, urlFs: 0.018 * H
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, base, show } = tools;
    const P = palette, bone = P.white || "#BDBDB8", red = P.red || "#9B1F1F", yellow = P.yellow || "#D9C21A";
    const bg = P.bg || "#1C1C1D";
    const out = options(config), G = grid(W, H), BK = G.block, ix = G.ix;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;

    const L = base(X);
    L.dataset.component = "promo-kinetic.outroV2";
    const mono = (s, x, y, fs, color, ls = 0.05, ax = 0) => {
      const o = tx(L, s, { cls: "mono", fs, x, y, ax, color });
      o.el.style.letterSpacing = ls + "em";
      return o;
    };

    /* ---- Bloque de color que se abre de arriba abajo ---- */
    const block = div(L, "patch", { left: BK.x + "px", top: BK.y + "px", width: BK.w + "px", height: BK.h + "px",
      background: red, transformOrigin: "50% 0%" });
    X.T(block, "transform", "scaleY(0)").to(at(0.04), at(0.3), "scaleY(1)", EASE_OUT);

    // Filas del título que entran cruzadas y quedan recortadas por el bloque.
    if (title) {
      const n = G.rows, fs = Math.min(fit(title, "ki", 0, G.rowW, 1e9), (0.92 * BK.h / n) / 0.9), lh = fs * 0.9;
      const cx = BK.x + BK.w / 2, cy = BK.y + BK.h / 2, y0 = cy - (n - 1) * lh / 2;
      const clip = div(L, "lay", { clipPath: `inset(${BK.y}px ${W - BK.x - BK.w}px ${H - BK.y - BK.h}px ${BK.x}px)` });
      for (let i = 0; i < n; i++) {
        const t = tx(clip, title, { cls: "ki", fs, x: cx, y: y0 + i * lh, color: bone });
        t.el.style.lineHeight = "1.12";
        const t0 = at(0.2) + i * at(0.06);
        show(X, t.box, t0);
        X.T(t.el, "transform", `translateX(${(i % 2 ? 1 : -1) * 45}%)`).to(t0, 0.42, `translateX(${(i % 2 ? -1 : 1) * 4}%)`, EASE_OUT);
      }
    }

    /* ---- Información al lado (o debajo en vertical) ---- */
    if (channel) {
      const fs = (G.portrait ? 0.012 : 0.015) * H;
      const ln = div(L, "patch", { left: ix + "px", top: G.chanY + "px", width: 0.035 * W + "px", height: Math.max(1, u) + "px",
        background: "rgba(230,230,230,0.5)", transformOrigin: "0% 50%" });
      X.T(ln, "transform", "scaleX(0)").to(at(0.6), 0.3, "scaleX(1)", EASE_OUT);
      show(X, mono(channel, ix + 0.05 * W, G.chanY, fs, "rgba(230,230,230,0.75)", 0.42).box, at(0.64));
    }
    if (sub) {
      const fs = fit(sub, "ki", 0.02, G.infoW, G.subFs);
      const s = tx(L, sub, { cls: "ki", fs, x: ix, y: G.subY, ax: 0, color: yellow, ls: 0.02 });
      s.el.style.lineHeight = "1.12";
      show(X, s.box, at(0.72));
      X.T(s.el, "transform", "scaleY(0.2)").to(at(0.72), 0.24, "scaleY(1)", EASE_OUT);
    }
    if (cta) {
      // Marcador hueso detrás de la llamada, texto en carbón.
      const fs = fit(cta, "ki", 0.04, G.infoW * 0.8, G.ctaFs);
      const w = textW(cta, "ki", 0.04, fs) + fs * 1.1, h = fs * 1.42;
      const b = div(L, "patch", { left: ix + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: bone, transformOrigin: "0% 50%" });
      X.T(b, "transform", "scaleX(0)").to(at(0.84), 0.25, "scaleX(1)", EASE_OUT);
      const t = tx(L, cta, { cls: "ki", fs, x: ix + fs * 0.55, y: G.ctaY, ax: 0, color: bg, ls: 0.04 });
      t.el.style.lineHeight = "1.12";
      show(X, t.box, at(0.95));
    }
    if (supportText) {
      const sup = div(L, "patch", { left: ix + "px", top: G.supY + "px", width: G.infoW + "px",
        fontFamily: "var(--fM), monospace", fontWeight: "500", fontSize: G.supFs + "px", lineHeight: "1.55",
        letterSpacing: "0.01em", color: "rgba(230,230,230,0.82)", whiteSpace: "normal", textWrap: "pretty" });
      sup.textContent = supportText;
      show(X, sup, at(1.04));
    }
    if (url) {
      const fs = Math.min(G.urlFs, fit(url, "mono", 0.06, G.infoW, G.urlFs));
      show(X, mono(url, ix, G.urlY, fs, yellow, 0.06).box, at(1.14));
      const uw = textW(url, "mono", 0.06, fs);
      const under = div(L, "patch", { left: ix + "px", top: G.urlY + 0.85 * fs + "px", width: uw + "px",
        height: Math.max(1, 1.2 * u) + "px", background: yellow, opacity: "0.7", transformOrigin: "0% 50%" });
      X.T(under, "transform", "scaleX(0)").to(at(1.18), 0.3, "scaleX(1)", EASE_OUT);
    }
  }

  return { defaults, options, timeline, render };
});

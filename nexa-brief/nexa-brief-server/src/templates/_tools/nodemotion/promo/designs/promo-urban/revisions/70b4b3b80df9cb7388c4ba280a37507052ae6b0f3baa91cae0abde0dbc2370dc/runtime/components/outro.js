(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoUrbanOutro = api;
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

  /* Retícula por formato (fracciones del cuadro). */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W,
      block: { x: 0.5 * W, y: 0.17 * H, w: 0.4 * W, h: 0.3 * H },
      chanY: 0.25 * H, titleW: 0.84 * W, titleH: 0.1 * H, titleY: 0.335 * H, step: 0.1 * W,
      subFs: 0.034 * H, footRule: 0.6 * H,
      ctaY: 0.665 * H, ctaFs: 0.03 * H, supX: 0.075 * W, supY: 0.715 * H, supW: 0.8 * W, supFs: 0.0165 * H,
      urlX: 0.075 * W, urlY: 0.86 * H, urlAx: 0, urlFs: 0.0145 * H, urlW: 0.85 * W,
      ring: { x: 0.9 * W, y: 0.62 * H, r: 0.16 * H }, year: { x: 0.04 * W, y: 0.5 * H, h: 0.13 * H }
    };
    return {
      portrait: false, m: 0.07 * W,
      block: { x: 0.43 * W, y: 0.15 * H, w: 0.3 * W, h: 0.5 * H },
      chanY: 0.24 * H, titleW: 0.66 * W, titleH: 0.22 * H, titleY: 0.38 * H, step: 0.07 * W,
      subFs: 0.07 * H, footRule: 0.76 * H,
      ctaY: 0.85 * H, ctaFs: 0.034 * H, supX: 0.38 * W, supY: 0.85 * H, supW: 0.27 * W, supFs: 0.0175 * H,
      urlX: 0.93 * W, urlY: 0.85 * H, urlAx: 1, urlFs: 0.0155 * H, urlW: 0.2 * W,
      ring: { x: 0.08 * W, y: 0.66 * H, r: 0.28 * H }, year: { x: 0.64 * W, y: 0.62 * H, h: 0.3 * H }
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, base, typeLine, hatch, arrow, ringR, bigYear } = tools;
    const P = palette, orange = P.orange || "#F2681A", white = P.white || "#F4F4F2", black = P.black || "#050505";
    const out = options(config), G = grid(W, H), m = G.m, BK = G.block;
    const str = v => String(v ?? "").trim();
    const title = str(out.title), sub = str(out.sub);
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;

    // Fondo negro de la promo; done() añade el HUD y los bloques naranjas de entrada.
    const { L, done } = base(X);
    L.dataset.component = "promo-urban.outro";
    ringR(X, L, G.ring.x, G.ring.y, G.ring.r, 0.08);
    bigYear(X, L, G.year.x, G.year.y, G.year.h, 0.07);

    /* ---- Bloque naranja que corta el título ---- */
    const block = div(L, "patch", { left: BK.x + "px", top: BK.y + "px", width: BK.w + "px", height: BK.h + "px",
      background: orange, transformOrigin: "50% 0%" });
    X.T(block, "transform", "scaleY(0)").to(at(0.18), 0.3, "scaleY(1)", EASE_OUT);
    hatch(L, BK.x + BK.w - 0.1 * W, BK.y + BK.h + 0.025 * H, 0.1 * W, 0.04 * H, white, u);

    if (channel) {
      const fs = fit(channel, "sm", 0.4, 0.4 * W, (G.portrait ? 0.012 : 0.0155) * H);
      const dash = div(L, "patch", { left: m + "px", top: G.chanY + "px", width: 0.03 * W + "px",
        height: Math.max(2, 2 * u) + "px", background: orange, transformOrigin: "0% 50%" });
      X.T(dash, "transform", "scaleX(0)").to(at(0.3), 0.25, "scaleX(1)", EASE_OUT);
      const c = tx(L, channel, { cls: "sm", fs, x: m + 0.045 * W, y: G.chanY, ax: 0, color: white, ls: 0.4 });
      show(X, c.box, at(0.34));
    }

    /* ---- Escalera tecleada: título (blanco, negro sobre el bloque) + sub naranja ---- */
    let subEnd = m;
    if (title) {
      const fs = fit(title.replace(/^[\^~]/, "").toUpperCase(), "ub", -0.02, G.titleW, G.titleH);
      typeLine(X, L, title, m, G.titleY, fs, { t0: at(0.32), step: at(0.045) });
      // Copia en negro recortada al bloque: el titular cambia de color al cruzarlo.
      const clip = div(L, "lay", { clipPath: `inset(${BK.y}px ${W - BK.x - BK.w}px ${H - BK.y - BK.h}px ${BK.x}px)` });
      typeLine(X, clip, title, m, G.titleY, fs, { t0: at(0.32), step: at(0.045), color: black });
      if (sub) {
        const sfs = Math.min(fs * 0.62, fit(sub.replace(/^[\^~]/, "").toUpperCase(), "ub", -0.02, 0.5 * W, G.subFs * 1.0));
        const sx = m + G.step, sy = G.titleY + fs * 0.5 + sfs * 0.62;
        const sl = typeLine(X, L, sub, sx, sy, sfs, { t0: at(0.62), step: at(0.04), color: /^[\^~]/.test(sub) ? undefined : orange });
        subEnd = sx + sl.width;
        const as = sfs * 0.8, ar = arrow(L, subEnd + 0.02 * W, sy - as / 2, as, orange, "se", u);
        show(X, ar, at(0.9));
      }
    }

    /* ---- Colofón: filete, placa blanca, apoyo y dirección ---- */
    const rule = div(L, "patch", { left: m + "px", top: G.footRule + "px", width: W - 2 * m + "px",
      height: Math.max(1, u) + "px", background: "rgba(244,244,242,0.28)", transformOrigin: "0% 50%" });
    X.T(rule, "transform", "scaleX(0)").to(at(0.85), 0.35, "scaleX(1)", EASE_OUT);
    if (cta) {
      const fs = fit(cta, "ub", -0.02, (G.portrait ? 0.7 : 0.24) * W, G.ctaFs);
      // typeLine compone con el espaciado de la clase .ub (-0.02em).
      const padX = 0.55 * fs, w = textW(cta, "ub", -0.02, fs) + 2 * padX, h = fs * 1.5;
      const plate = div(L, "patch", { left: m + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: white });
      X.T(plate, "clipPath", "inset(0% 100% 0% 0%)").to(at(0.95), 0.28, "inset(0% 0% 0% 0%)", EASE_OUT);
      const t = typeLine(X, L, cta, m + padX, G.ctaY, fs, { t0: at(1.02), step: at(0.025), color: black });
      t.el.style.lineHeight = "1.15";
      tx(L, "®", { cls: "sm", fs: fs * 0.45, x: m + w + 0.006 * W, y: G.ctaY - h / 2 + fs * 0.2, ax: 0, color: orange });
    }
    if (supportText) {
      const sup = div(L, "patch", { left: G.supX + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: "var(--fU), sans-serif", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.04em",
        fontSize: G.supFs + "px", lineHeight: "1.5", color: "rgba(244,244,242,0.78)", whiteSpace: "normal", textWrap: "pretty" });
      sup.textContent = supportText;
      if (!G.portrait) sup.style.transform = "translateY(-50%)";
      show(X, sup, at(1.12));
    }
    if (url) {
      const U = url.toUpperCase(), fs = fit(U, "sm", 0.1, G.urlW, G.urlFs);
      const t = tx(L, U, { cls: "sm", fs, x: G.urlX, y: G.urlY, ax: G.urlAx, color: white, ls: 0.1 });
      show(X, t.box, at(1.2));
      const uw = textW(U, "sm", 0.1, fs), ux = G.urlAx ? G.urlX - uw : G.urlX;
      const under = div(L, "patch", { left: ux + "px", top: G.urlY + 0.95 * fs + "px", width: uw + "px",
        height: Math.max(2, 2 * u) + "px", background: orange, transformOrigin: "0% 50%" });
      X.T(under, "transform", "scaleX(0)").to(at(1.26), 0.3, "scaleX(1)", EASE_OUT);
    }
    done();
  }

  return { defaults, options, timeline, render };
});

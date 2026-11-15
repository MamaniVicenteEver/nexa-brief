(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoUrbanOutroV2 = api;
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

  /* V2 · naranja a sangre con tipografía negra (la escena «SIN EXCUSAS»
     en positivo): escalera tecleada, aro «R» y corredor en blanco. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W, chanY: 0.24 * H,
      titleW: 0.84 * W, titleH: 0.1 * H, titleY: 0.32 * H, step: 0.1 * W, subFs: 0.04 * H,
      ring: { x: 0.78 * W, y: 0.13 * H, r: 0.08 * H },
      footRule: 0.6 * H, ctaY: 0.665 * H, ctaFs: 0.03 * H, supX: 0.075 * W, supY: 0.715 * H, supW: 0.8 * W, supFs: 0.0165 * H,
      urlX: 0.075 * W, urlY: 0.86 * H, urlAx: 0, urlFs: 0.0145 * H, urlW: 0.85 * W
    };
    return {
      portrait: false, m: 0.07 * W, chanY: 0.2 * H,
      titleW: 0.6 * W, titleH: 0.22 * H, titleY: 0.34 * H, step: 0.07 * W, subFs: 0.09 * H,
      ring: { x: 0.8 * W, y: 0.4 * H, r: 0.25 * H },
      footRule: 0.76 * H, ctaY: 0.85 * H, ctaFs: 0.034 * H, supX: 0.38 * W, supY: 0.85 * H, supW: 0.27 * W, supFs: 0.0175 * H,
      urlX: 0.93 * W, urlY: 0.85 * H, urlAx: 1, urlFs: 0.0155 * H, urlW: 0.2 * W
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, base, typeLine, hatch, arrow, runner } = tools;
    const P = palette, orange = P.orange || "#F2681A", white = P.white || "#F4F4F2", black = P.black || "#050505";
    const out = options(config), G = grid(W, H), m = G.m;
    const str = v => String(v ?? "").trim();
    const title = str(out.title), sub = str(out.sub);
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;

    // Fondo naranja de la promo; done() pinta el HUD (los bloques naranjas no se ven aquí).
    const { L, done } = base(X, orange);
    L.dataset.component = "promo-urban.outroV2";

    // Aro con «R» y corredor en contorno blanco, como la escena del logo.
    const R = G.ring, rw = Math.max(2, 3 * u);
    const ringEl = div(L, "patch", { left: R.x - R.r + "px", top: R.y - R.r + "px", width: 2 * R.r + "px", height: 2 * R.r + "px",
      borderRadius: "50%", border: `${rw}px solid rgba(244,244,242,0.55)` });
    X.T(ringEl, "transform", "scale(0.3)").to(at(0.25), 0.4, "scale(1)", EASE_OUT);
    // Emblema: el corredor en contorno dentro del aro.
    const rs = 1.15 * R.r;
    const rn = runner(L, R.x - rs * 0.5, R.y - rs * 0.52, rs, white, false);
    rn.style.opacity = "0.9";
    show(X, rn, at(0.5));
    X.T(rn, "transform", "translateX(-24px)").to(at(0.5), 0.4, "translateX(0px)", EASE_OUT);
    hatch(L, G.portrait ? 0.62 * W : 0.62 * W, G.portrait ? 0.53 * H : 0.62 * H, 0.12 * W, 0.04 * H, black, u);

    if (channel) {
      const fs = fit(channel, "sm", 0.4, 0.4 * W, (G.portrait ? 0.012 : 0.0155) * H);
      const dash = div(L, "patch", { left: m + "px", top: G.chanY + "px", width: 0.03 * W + "px",
        height: Math.max(2, 2 * u) + "px", background: black, transformOrigin: "0% 50%" });
      X.T(dash, "transform", "scaleX(0)").to(at(0.3), 0.25, "scaleX(1)", EASE_OUT);
      show(X, tx(L, channel, { cls: "sm", fs, x: m + 0.045 * W, y: G.chanY, ax: 0, color: black, ls: 0.4 }).box, at(0.34));
    }

    /* ---- Escalera tecleada en negro, sub en blanco con flecha ---- */
    if (title) {
      const fs = fit(title.replace(/^[\^~]/, "").toUpperCase(), "ub", -0.02, G.titleW, G.titleH);
      typeLine(X, L, title, m, G.titleY, fs, { t0: at(0.3), step: at(0.045), color: /^\^/.test(title) ? white : black });
      if (sub) {
        const sfs = Math.min(fs * 0.62, fit(sub.replace(/^[\^~]/, "").toUpperCase(), "ub", -0.02, 0.5 * W, G.subFs));
        const sx = m + G.step, sy = G.titleY + fs * 0.5 + sfs * 0.62;
        const sl = typeLine(X, L, sub, sx, sy, sfs, { t0: at(0.6), step: at(0.04), color: /^[\^~]/.test(sub) ? undefined : white });
        const as = sfs * 0.8, ar = arrow(L, sx + sl.width + 0.02 * W, sy - as / 2, as, black, "se", u);
        show(X, ar, at(0.9));
      }
    }

    /* ---- Colofón ---- */
    const rule = div(L, "patch", { left: m + "px", top: G.footRule + "px", width: W - 2 * m + "px",
      height: Math.max(1, 1.2 * u) + "px", background: "rgba(5,5,5,0.4)", transformOrigin: "0% 50%" });
    X.T(rule, "transform", "scaleX(0)").to(at(0.85), 0.35, "scaleX(1)", EASE_OUT);
    if (cta) {
      const fs = fit(cta, "ub", -0.02, (G.portrait ? 0.7 : 0.24) * W, G.ctaFs);
      const padX = 0.55 * fs, w = textW(cta, "ub", -0.02, fs) + 2 * padX, h = fs * 1.5;
      const plate = div(L, "patch", { left: m + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px", background: black });
      X.T(plate, "clipPath", "inset(0% 100% 0% 0%)").to(at(0.95), 0.28, "inset(0% 0% 0% 0%)", EASE_OUT);
      const t = typeLine(X, L, cta, m + padX, G.ctaY, fs, { t0: at(1.02), step: at(0.025), color: white });
      t.el.style.lineHeight = "1.15";
      tx(L, "®", { cls: "sm", fs: fs * 0.45, x: m + w + 0.006 * W, y: G.ctaY - h / 2 + fs * 0.2, ax: 0, color: black });
    }
    if (supportText) {
      const sup = div(L, "patch", { left: G.supX + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: "var(--fU), sans-serif", fontWeight: "500", textTransform: "uppercase", letterSpacing: "0.04em",
        fontSize: G.supFs + "px", lineHeight: "1.5", color: black, whiteSpace: "normal", textWrap: "pretty" });
      sup.textContent = supportText;
      if (!G.portrait) sup.style.transform = "translateY(-50%)";
      show(X, sup, at(1.12));
    }
    if (url) {
      const U = url.toUpperCase(), fs = fit(U, "sm", 0.1, G.urlW, G.urlFs);
      show(X, tx(L, U, { cls: "sm", fs, x: G.urlX, y: G.urlY, ax: G.urlAx, color: black, ls: 0.1 }).box, at(1.2));
      const uw = textW(U, "sm", 0.1, fs), ux = G.urlAx ? G.urlX - uw : G.urlX;
      const under = div(L, "patch", { left: ux + "px", top: G.urlY + 0.95 * fs + "px", width: uw + "px",
        height: Math.max(2, 2 * u) + "px", background: black, transformOrigin: "0% 50%" });
      X.T(under, "transform", "scaleX(0)").to(at(1.26), 0.3, "scaleX(1)", EASE_OUT);
    }
    done();

    /* Entrada: el negro de la escena anterior se destapa en bloques (los
       bloques de transición de la promo, en negativo) dejando el naranja. */
    for (let i = 0; i < 10; i++) {
      const cols = 5, rows = 2, cw = W / cols, ch = H / rows;
      const b = div(L, "patch", { left: (i % cols) * cw - 1 + "px", top: Math.floor(i / cols) * ch - 1 + "px",
        width: cw + 2 + "px", height: ch + 2 + "px", background: black });
      X.T(b, "visibility", "visible", true).set(at(0.04 + X.r() * 0.2), "hidden");
    }
  }

  return { defaults, options, timeline, render };
});

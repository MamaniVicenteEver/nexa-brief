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

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, base, rule, wipe, sliceIn, show } = tools;
    const out = options(config), P = palette;
    const portrait = H > W, margin = 0.07 * W;
    const L = base(X);
    L.dataset.component = "promo-editorial.outro";
    // La misma retícula, papel, tinta y Archivo del resto de la promo.
    const railX = (portrait ? 0.9 : 0.86) * W;
    wipe(X, L, { x: railX, y: 0, w: W - railX, h: 0.76 * H }, 0, 0.85, "down");
    rule(X, L, margin, 0.145 * H, railX - margin - 0.04 * W, 1.2 * u, 0.08);
    rule(X, L, margin, 0.67 * H, railX - margin - 0.04 * W, 1.2 * u, 0.2);

    const channel = String(out.channel ?? "").toUpperCase();
    const label = tx(L, channel, { cls: "gx", fs: fit(channel, "gx", 0.22, 0.62 * W, 0.018 * H),
      x: margin, y: 0.09 * H, ax: 0, color: P.black, ls: 0.22 });
    show(X, label.box, 0.12);

    const title = String(out.title ?? "").toUpperCase();
    const titleFs = fit(title, "gx", -0.035, (portrait ? 0.77 : 0.74) * W, 0.2 * H);
    const heading = sliceIn(X, L, title, margin, 0.385 * H, titleFs, P.black, 0.16, { ax: 0, ls: -0.035 });

    const sub = String(out.sub ?? "").toUpperCase();
    const subFs = fit(sub, "gx", 0.12, 0.61 * W, 0.044 * H);
    const subW = Math.min(0.73 * W, tools.textW(sub, "gx", 0.12, subFs) + 0.04 * W);
    wipe(X, L, { x: margin, y: 0.51 * H, w: subW, h: 0.093 * H }, 0.23, 0.7);
    sliceIn(X, L, sub, margin + 0.02 * W, 0.558 * H, subFs, P.paper, 0.52, { ax: 0, ls: 0.12 });

    // Marca de registro tipográfica; no requiere imágenes ni medios nuevos.
    const cx = (railX + W) / 2, cy = 0.39 * H;
    const arm = Math.min(0.048 * W, 0.052 * H), line = Math.max(2, 2.5 * u);
    rule(X, L, cx - arm / 2, cy, arm, line, 0.45, P.paper);
    const tick = div(L, "patch", { left: cx - line / 2 + "px", top: cy - arm / 2 + "px",
      width: line + "px", height: arm + "px", background: P.paper, transformOrigin: "50% 0%" });
    X.T(tick, "transform", "scaleY(0)").to(0.45, 0.3, "scaleY(1)", "cubic-bezier(.16,.84,.24,1)");

    wipe(X, L, { x: 0, y: 0.76 * H, w: W, h: 0.24 * H }, 0.25, 0.85);
    const cta = String(out.cta ?? "").toUpperCase();
    sliceIn(X, L, cta, margin, 0.822 * H, fit(cta, "gx", 0.02, 0.84 * W, 0.043 * H), P.paper, 0.65, { ax: 0, ls: 0.02 });
    const support = div(L, "patch", { left: margin + "px", top: 0.868 * H + "px", width: 0.84 * W + "px",
      fontFamily: '"Archivo", sans-serif', fontWeight: "400", fontSize: (portrait ? 0.026 * W : 0.018 * H) + "px",
      lineHeight: "1.45", color: P.paper, whiteSpace: "normal" });
    support.textContent = String(out.support ?? "");
    show(X, support, 0.78);
    const url = String(out.url ?? "");
    const link = tx(L, url, { cls: "gx", fs: fit(url, "gx", 0.06, 0.84 * W, 0.013 * H),
      x: margin, y: 0.955 * H, ax: 0, color: P.paper, ls: 0.06 });
    show(X, link.box, 0.9);
  }

  return { defaults, options, timeline, render };
});

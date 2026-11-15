(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoSportsOutro = api;
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

  /* Retícula por formato (fracciones del cuadro): franjas tipo letterbox
     arriba y abajo, como la escena de barras, y el marco en el centro. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W, topH: 0.055 * H, botH: 0.25 * H,
      frame: { x: 0.07 * W, y: 0.275 * H, w: 0.86 * W, h: 0.27 * H }, supCenter: false,
      titleW: 0.74 * W, titleH: 0.085 * H, titleY: 0.39 * H, subY: 0.48 * H, subFs: 0.02 * H,
      ctaY: 0.8 * H, ctaFs: 0.03 * H, supX: 0.075 * W, supY: 0.845 * H, supW: 0.85 * W, supFs: 0.0175 * H,
      urlX: 0.075 * W, urlY: 0.95 * H, urlAx: 0, urlFs: 0.0135 * H, urlW: 0.85 * W
    };
    return {
      portrait: false, m: 0.06 * W, topH: 0.075 * H, botH: 0.17 * H,
      frame: { x: 0.2 * W, y: 0.2 * H, w: 0.6 * W, h: 0.5 * H }, supCenter: true,
      titleW: 0.5 * W, titleH: 0.17 * H, titleY: 0.42 * H, subY: 0.585 * H, subFs: 0.034 * H,
      ctaY: 0.915 * H, ctaFs: 0.034 * H, supX: 0.37 * W, supY: 0.915 * H, supW: 0.3 * W, supFs: 0.019 * H,
      urlX: 0.94 * W, urlY: 0.915 * H, urlAx: 1, urlFs: 0.016 * H, urlW: 0.22 * W
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, base, dust, outlineBig, word, scramble } = tools;
    const P = palette, yellow = P.yellow || "#EBE609", white = P.white || "#F3F3F1", ink = P.ink || "#0B0B0B";
    const out = options(config), G = grid(W, H), m = G.m, F = G.frame;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;

    // Fondo de la promo: negro azulado, luz baja, contorno gigante, polvo y viñeta.
    const L = base(X);
    L.dataset.component = "promo-sports.outro";
    div(L, "lay", { background: "radial-gradient(ellipse at 50% 48%, rgba(40,46,54,0.6) 0%, rgba(0,0,0,0) 62%)" });
    if (title) outlineBig(X, L, title, { fs: (G.portrait ? 0.42 : 1.0) * H, y: (G.portrait ? 0.43 : 0.47) * H,
      color: "rgba(235,230,9,0.28)", from: 0.04 * W, drift: 0.06 });
    dust(X, L, 10);

    /* ---- Destello amarillo que se contrae hasta el marco ----
       Las tarjetas «flash» del video llenan la pantalla de amarillo; aquí el
       destello se cierra sobre el rectángulo del marco y queda como contorno. */
    const flash = div(L, "lay", { background: yellow });
    const inset = `inset(${F.y}px ${W - F.x - F.w}px ${H - F.y - F.h}px ${F.x}px)`;
    X.T(flash, "clipPath", "inset(0px 0px 0px 0px)").set(at(0.1), "inset(0px 0px 0px 0px)").to(at(0.1), at(0.28), inset, EASE_IO);
    X.T(flash, "visibility", "visible", true).set(at(0.4), "hidden");
    const bw = Math.max(4, (G.portrait ? 0.012 : 0.024) * H);
    const frame = div(L, "patch", { left: F.x + "px", top: F.y + "px", width: F.w + "px", height: F.h + "px",
      border: `${bw}px solid ${yellow}`, boxSizing: "border-box" });
    show(X, frame, at(0.4));
    X.T(frame, "transform", "scale(1.06)").to(at(0.4), 0.3, "scale(1)", EASE_OUT);
    // Segundo filete fino por fuera, como en las escenas de marco.
    const gap = (G.portrait ? 0.022 : 0.03) * Math.min(W, H);
    const outer = div(L, "patch", { left: F.x - gap + "px", top: F.y - gap + "px", width: F.w + 2 * gap + "px", height: F.h + 2 * gap + "px",
      border: `${Math.max(1, 1.5 * u)}px solid ${yellow}`, boxSizing: "border-box", opacity: "0.7" });
    show(X, outer, at(0.55));
    X.T(outer, "transform", "scale(0.97)").to(at(0.55), 0.35, "scale(1)", EASE_OUT);

    if (title) {
      const fs = fit(title, "sp", 0.06, G.titleW, G.titleH);
      const t = word(X, L, title, W / 2, G.titleY, fs, { ls: 0.06, split: "chars" });
      t.el.style.lineHeight = "1.18"; // tildes en mayúscula sin recorte
      scramble(X, t, at(0.46), at(0.5));
    }
    if (sub) {
      const fs = fit(sub, "sp", 0.34, 0.6 * W, G.subFs);
      const s = word(X, L, sub, W / 2 + 0.17 * fs, G.subY, fs, { ls: 0.34, color: yellow });
      show(X, s.box, at(0.85));
      X.T(s.el, "transform", "translateX(-6%)").to(at(0.85), 0.3, "translateX(0%)", EASE_OUT);
    }

    /* ---- Franjas tipo letterbox ---- */
    const bar = (y, h, origin, t0) => {
      const b = div(L, "patch", { left: 0, top: y + "px", width: W + "px", height: h + "px", background: yellow, transformOrigin: origin });
      X.T(b, "transform", "scaleY(0)").to(t0, 0.22, "scaleY(1)", EASE_OUT);
      return b;
    };
    bar(0, G.topH, "top", at(0.62));
    bar(H - G.botH, G.botH, "bottom", at(0.68));
    if (channel) {
      const fs = fit(channel, "sp", 0.4, 0.5 * W, 0.34 * G.topH);
      const c = word(X, L, channel, m, G.topH / 2, fs, { ax: 0, ls: 0.4, color: ink });
      show(X, c.box, at(0.8));
      const r = word(X, L, "■ ■ ■", W - m, G.topH / 2, fs * 0.8, { ax: 1, ls: 0.3, color: ink });
      show(X, r.box, at(0.84));
    }
    if (cta) {
      // Placa negra con texto amarillo dentro de la franja: el punto más fuerte del pie.
      const fs = fit(cta, "sp", 0.08, (G.portrait ? 0.7 : 0.24) * W, G.ctaFs);
      const padX = 0.6 * fs, w = textW(cta, "sp", 0.08, fs) + 2 * padX, h = fs * 1.55;
      const plate = div(L, "patch", { left: m + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: ink, transformOrigin: "0% 50%" });
      X.T(plate, "transform", "scaleX(0)").to(at(0.9), 0.26, "scaleX(1)", EASE_OUT);
      const t = word(X, L, cta, m + padX, G.ctaY, fs, { ax: 0, ls: 0.08, color: yellow, split: "chars" });
      t.el.style.lineHeight = "1.2";
      scramble(X, t, at(1.0), 0.32);
    }
    if (supportText) {
      const sup = div(L, "patch", { left: G.supX + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: "var(--fS), sans-serif", fontWeight: "900", fontStyle: "italic", fontSize: G.supFs + "px",
        lineHeight: "1.35", letterSpacing: "0.02em", color: ink, whiteSpace: "normal", textWrap: "pretty" });
      sup.textContent = supportText;
      show(X, sup, at(1.1));
      // En horizontal se centra en la misma línea que la placa y la dirección.
      const dy = G.supCenter ? "-50%" : "0px";
      X.T(sup, "transform", `translate(-12px, ${dy})`).to(at(1.1), 0.3, `translate(0px, ${dy})`, EASE_OUT);
    }
    if (url) {
      const U = url.toUpperCase(), fs = fit(U, "sp", 0.14, G.urlW, G.urlFs);
      const t = word(X, L, U, G.urlX, G.urlY, fs, { ax: G.urlAx, ls: 0.14, color: ink });
      show(X, t.box, at(1.2));
    }
  }

  return { defaults, options, timeline, render };
});

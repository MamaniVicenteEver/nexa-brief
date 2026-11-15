(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoDynamicOutro = api;
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

  /* Retícula por formato, en fracciones del cuadro. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W, headY: 0.06 * H,
      titleW: 0.85 * W, titleH: 0.075 * H, bandY: 0.47 * H, echoes: 3, step: 0,
      subY: 0.565 * H, subFs: 0.026 * H, subRight: false,
      footRule: 0.64 * H, ctaY: 0.7 * H, ctaFs: 0.03 * H,
      supY: 0.755 * H, supX: 0.075 * W, supW: 0.75 * W, supFs: 0.018 * H,
      urlY: 0.885 * H, urlX: 0.075 * W, urlAx: 0, urlFs: 0.0125 * H, urlW: 0.85 * W
    };
    return {
      portrait: false, m: 0.06 * W, headY: 0.085 * H,
      titleW: 0.6 * W, titleH: 0.15 * H, bandY: 0.54 * H, echoes: 2, step: 0.075 * W,
      subY: 0.54 * H, subFs: 0.05 * H, subRight: true,
      footRule: 0.76 * H, ctaY: 0.86 * H, ctaFs: 0.036 * H,
      supY: 0.83 * H, supX: 0.39 * W, supW: 0.3 * W, supFs: 0.021 * H,
      urlY: 0.86 * H, urlX: 0.94 * W, urlAx: 1, urlFs: 0.0145 * H, urlW: 0.22 * W
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, jag, flyer, mainWord } = tools;
    const P = palette, neon = P.neon || "#C9FF1F", ink = P.ink || "#1E1E1E";
    const out = options(config), G = grid(W, H), m = G.m;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;
    const hair = Math.max(1, 1.2 * u);

    /* ---- Fondo neón con HUD propio en posiciones fijas ----
       Mismo lenguaje que hudDecor (retícula de puntos, rayados, cuadritos),
       pero colocado a mano para que nada caiga sobre los textos. */
    const L = div(X.root, "lay", { background: neon });
    L.dataset.component = "promo-dynamic.outro";
    div(L, "lay", { backgroundImage: `radial-gradient(${ink} 0.9px, transparent 1.3px)`,
      backgroundSize: `${22 * u}px ${22 * u}px`, opacity: 0.22 });
    const hatch = (x, y, w, h, ang, t0) => {
      const el = div(L, "patch", { left: x + "px", top: y + "px", width: w + "px", height: h + "px",
        backgroundImage: `repeating-linear-gradient(${ang}deg, ${ink} 0 ${1.4 * u}px, transparent ${1.4 * u}px ${7 * u}px)`,
        opacity: 0.8, transformOrigin: "0% 50%" });
      X.T(el, "transform", "scaleX(0)").to(t0, 0.3, "scaleX(1)", EASE_OUT);
    };
    const square = (x, y, t0) => show(X, div(L, "patch", { left: x + "px", top: y + "px",
      width: 7 * u + "px", height: 7 * u + "px", background: ink }), t0);
    const lb = (s, x, y, fs, o = {}) => tx(L, s, { cls: "lb", fs, x, y, ax: o.ax ?? 0, color: o.color || ink, ls: o.ls ?? 0.02, rot: o.rot });

    // Cabecera: canal espaciado + rayados a ambos lados.
    if (channel) {
      const fs = fit(channel, "lb", 0.32, 0.5 * W, (G.portrait ? 0.013 : 0.017) * H);
      show(X, lb(channel, m, G.headY, fs, { ls: 0.32 }).box, at(0.35));
    }
    hatch(W - m - 64 * u, G.headY - 7 * u, 64 * u, 14 * u, 120, at(0.4));
    square(W - m - 64 * u - 18 * u, G.headY - 3.5 * u, at(0.45));

    /* ---- Barrido inicial: el título cruza gigante con desenfoque (flyer) ---- */
    const ghost = [...title.replace(/[^\p{L}\p{N}]/gu, "")].slice(0, 2).join("");
    if (ghost) flyer(X, L, ghost, 0, at(0.42), G.bandY / H);

    /* ---- La última «pila»: copias en contorno + título sólido en la banda ---- */
    if (title) {
      const fs = fit(title, "ex", 0, G.titleW, G.titleH), lh = fs * 0.98;
      const bandH = fs * 1.34, bandTop = G.bandY - bandH / 2;
      // Banda de tinta con borde escalonado tipo píxel (el borde de las fotos).
      const wrap = div(L, "lay");
      X.T(wrap, "clipPath", "inset(0% 100% 0% 0%)").to(at(0.22), at(0.34), "inset(0% 0% 0% 0%)", EASE_OUT);
      const bw = W + 24 * u;
      div(wrap, "patch", { left: -12 * u + "px", top: bandTop + "px", width: bw + "px", height: bandH + "px",
        background: ink, clipPath: jag(bw, bandH, X.r, 5 * u) });
      for (let i = G.echoes; i >= 1; i--) {
        // En horizontal la pila escala en diagonal hacia el hueco superior derecho.
        const e = mainWord(X, L, title, m + i * G.step, G.bandY - i * lh - (bandH - fs) * 0.35, fs,
          { ax: 0, t0: at(0.42 + (G.echoes - i) * 0.07), stroke: true });
        e.el.style.opacity = String(Math.max(0.35, 1 - (i - 1) * 0.3));
        X.T(e.el, "transform", "translateX(0px)").to(at(0.4), Math.max(0.5, X.dur - at(0.4)), `translateX(${(i % 2 ? -1 : 1) * 0.012 * W}px)`);
      }
      mainWord(X, L, title, m, G.bandY, fs, { ax: 0, t0: at(0.34), color: neon });
      if (sub) {
        const sfs = fit(sub, "ex", 0.06, (G.portrait ? 0.6 : 0.26) * W, G.subFs);
        if (G.subRight) mainWord(X, L, sub, W - m, G.subY, sfs, { ax: 1, t0: at(0.6), color: neon });
        else mainWord(X, L, sub, m, G.subY, sfs, { ax: 0, t0: at(0.6), color: ink });
      }
    } else if (sub) {
      mainWord(X, L, sub, m, G.bandY, fit(sub, "ex", 0, G.titleW, G.titleH), { ax: 0, t0: at(0.34), color: ink });
    }

    /* ---- Colofón: filete, llamada en placa de tinta, apoyo y dirección ---- */
    const foot = div(L, "patch", { left: m + "px", top: G.footRule + "px", width: W - 2 * m + "px",
      height: hair + "px", background: ink, transformOrigin: "0% 50%" });
    X.T(foot, "transform", "scaleX(0)").to(at(0.72), 0.35, "scaleX(1)", EASE_OUT);
    square(W - m - 7 * u, G.footRule - 18 * u, at(0.8));
    if (cta) {
      const fs = fit(cta, "ex", 0.02, (G.portrait ? 0.7 : 0.26) * W, G.ctaFs);
      const padX = 0.55 * fs, padY = 0.42 * fs;
      const w = textW(cta, "ex", 0.02, fs) + 2 * padX, h = fs * 1.12 + 2 * padY;
      const plate = div(L, "patch", { left: m + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: ink });
      X.T(plate, "transform", "scaleX(0)").to(at(0.82), 0.3, "scaleX(1)", EASE_OUT);
      plate.style.transformOrigin = "0% 50%";
      const t = tx(L, cta, { cls: "ex", fs, x: m + padX, y: G.ctaY, ax: 0, color: neon, ls: 0.02 });
      t.el.style.lineHeight = "1.12";
      show(X, t.box, at(0.92));
    }
    if (supportText) {
      const sup = div(L, "patch", { left: G.supX + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: '"Archivo", sans-serif', fontWeight: "600", fontStretch: "100%", fontSize: G.supFs + "px",
        lineHeight: "1.38", color: ink, whiteSpace: "normal", textWrap: "pretty" });
      sup.textContent = supportText;
      X.T(sup, "transform", `translateY(${0.4 * G.supFs}px)`).to(at(1.0), 0.35, "translateY(0px)", EASE_OUT);
      show(X, sup, at(1.0));
    }
    if (url) {
      const U = url.toUpperCase(), fs = fit(U, "lb", 0.16, G.urlW, G.urlFs);
      const link = lb(url, G.urlX, G.urlY, fs, { ax: G.urlAx, ls: 0.16 });
      show(X, link.box, at(1.1));
      const uw = textW(U, "lb", 0.16, fs), ux = G.urlAx ? G.urlX - uw : G.urlX;
      const under = div(L, "patch", { left: ux + "px", top: G.urlY + 0.9 * fs + "px", width: uw + "px",
        height: Math.max(1, 1.4 * u) + "px", background: ink, transformOrigin: "0% 50%" });
      X.T(under, "transform", "scaleX(0)").to(at(1.16), 0.3, "scaleX(1)", EASE_OUT);
    }
    // Pie técnico: índice y filete corto, como el HUD de cada escena.
    const tiny = lb("FIN", m, (G.portrait ? 0.955 : 0.94) * H, 8.5 * u * (G.portrait ? 1.3 : 1));
    show(X, tiny.box, at(1.2));
    hatch(m + 34 * u, (G.portrait ? 0.955 : 0.94) * H - 5 * u, 58 * u, 10 * u, 70, at(1.2));
  }

  return { defaults, options, timeline, render };
});

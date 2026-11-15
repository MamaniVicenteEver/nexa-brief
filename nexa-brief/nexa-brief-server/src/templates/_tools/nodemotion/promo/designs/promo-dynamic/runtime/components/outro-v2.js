(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoDynamicOutroV2 = api;
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

  /* V2 · versión nocturna: la tinta se abre desde el centro con borde
     escalonado y el cierre vive en neón sobre negro, centrado. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true, m: 0.075 * W, headY: 0.055 * H,
      ghostFs: 0.3 * H, ghostY: 0.4 * H, titleW: 0.84 * W, titleH: 0.085 * H, titleY: 0.4 * H,
      subY: 0.475 * H, subFs: 0.03 * H, ctaY: 0.64 * H, ctaFs: 0.03 * H,
      supY: 0.69 * H, supW: 0.8 * W, supFs: 0.0175 * H, urlY: 0.82 * H, urlFs: 0.0125 * H, footY: 0.945 * H
    };
    return {
      portrait: false, m: 0.06 * W, headY: 0.08 * H,
      ghostFs: 0.62 * H, ghostY: 0.43 * H, titleW: 0.68 * W, titleH: 0.2 * H, titleY: 0.41 * H,
      subY: 0.565 * H, subFs: 0.05 * H, ctaY: 0.72 * H, ctaFs: 0.034 * H,
      supY: 0.775 * H, supW: 0.46 * W, supFs: 0.02 * H, urlY: 0.875 * H, urlFs: 0.0145 * H, footY: 0.935 * H
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, show, jag, mainWord } = tools;
    const P = palette, neon = P.neon || "#C9FF1F", ink = P.ink || "#1E1E1E";
    const out = options(config), G = grid(W, H), m = G.m;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;
    const cx = W / 2;

    // Arranca en neón (continuidad con la escena anterior) ...
    const L = div(X.root, "lay", { background: neon });
    L.dataset.component = "promo-dynamic.outroV2";
    // ... y la tinta se abre desde el centro con el borde escalonado de las fotos.
    const pw = 1.25 * W, ph = 1.25 * H;
    const night = div(L, "patch", { left: cx - pw / 2 + "px", top: H / 2 - ph / 2 + "px", width: pw + "px", height: ph + "px",
      background: ink, clipPath: jag(pw, ph, X.r, 9 * u) });
    X.T(night, "transform", "scale(0.04, 0.02)").to(at(0.04), at(0.38), "scale(1, 1)", EASE_IO);
    const N = div(L, "lay"); // capa de contenido sobre la tinta
    div(N, "lay", { backgroundImage: `radial-gradient(${neon} 0.9px, transparent 1.3px)`,
      backgroundSize: `${22 * u}px ${22 * u}px`, opacity: 0.14 });

    const lb = (s, x, y, fs, o = {}) => tx(N, s, { cls: "lb", fs, x, y, ax: o.ax ?? 0, color: o.color || neon, ls: o.ls ?? 0.02 });
    const hatch = (x, y, w, h, ang, t0) => {
      const el = div(N, "patch", { left: x + "px", top: y + "px", width: w + "px", height: h + "px",
        backgroundImage: `repeating-linear-gradient(${ang}deg, ${neon} 0 ${1.4 * u}px, transparent ${1.4 * u}px ${7 * u}px)`,
        opacity: 0.85, transformOrigin: "0% 50%" });
      X.T(el, "transform", "scaleX(0)").to(t0, 0.3, "scaleX(1)", EASE_OUT);
    };

    /* ---- Contorno gigante en neón a la deriva (bgWord en negativo) ---- */
    if (title) {
      const g = tx(N, title, { cls: "ex", fs: G.ghostFs, x: 0, y: G.ghostY, ax: 0, color: "transparent" });
      g.el.style.webkitTextStroke = `${Math.max(1, 1.3 * u)}px ${neon}`;
      g.el.style.opacity = "0.32";
      X.T(g.el, "transform", `translateX(${0.12 * W}px)`).to(at(0.3), Math.max(0.5, X.dur - at(0.3)), `translateX(${-0.1 * W}px)`);
      show(X, g.box, at(0.3));
    }

    // HUD en neón: canal, rayado y cuadrito en posiciones fijas.
    if (channel) {
      const fs = fit(channel, "lb", 0.32, 0.5 * W, (G.portrait ? 0.013 : 0.017) * H);
      show(X, lb(channel, m, G.headY, fs, { ls: 0.32 }).box, at(0.42));
    }
    hatch(W - m - 64 * u, G.headY - 7 * u, 64 * u, 14 * u, 120, at(0.46));

    /* ---- Titular tecleado en neón sobre placa de tinta ---- */
    if (title) {
      const fs = fit(title, "ex", 0, G.titleW, G.titleH);
      const pwid = Math.min(0.94 * W, textW(title, "ex", 0, fs) + fs * 0.5);
      div(N, "patch", { left: cx - pwid / 2 + "px", top: G.titleY - fs * 0.66 + "px", width: pwid + "px", height: fs * 1.32 + "px", background: ink });
      mainWord(X, N, title, cx, G.titleY, fs, { ax: 0.5, t0: at(0.44), color: neon });
    }
    if (sub) {
      const fs = fit(sub, "ex", 0.04, 0.6 * W, G.subFs);
      mainWord(X, N, sub, cx, G.subY, fs, { ax: 0.5, t0: at(0.66), color: neon });
    }

    /* ---- Llamada en placa neón escalonada + apoyo + dirección ---- */
    if (cta) {
      const fs = fit(cta, "ex", 0.02, (G.portrait ? 0.66 : 0.3) * W, G.ctaFs);
      const padX = 0.62 * fs, w = textW(cta, "ex", 0.02, fs) + 2 * padX, h = fs * 1.7;
      const plate = div(N, "patch", { left: cx - w / 2 + "px", top: G.ctaY - h / 2 + "px", width: w + "px", height: h + "px",
        background: neon, transformOrigin: "50% 50%" });
      X.T(plate, "transform", "scaleX(0)").to(at(0.84), 0.28, "scaleX(1)", EASE_OUT);
      const t = tx(N, cta, { cls: "ex", fs, x: cx, y: G.ctaY, color: ink, ls: 0.02 });
      t.el.style.lineHeight = "1.12";
      show(X, t.box, at(0.96));
    }
    if (supportText) {
      const sup = div(N, "patch", { left: cx - G.supW / 2 + "px", top: G.supY + "px", width: G.supW + "px",
        fontFamily: '"Archivo", sans-serif', fontWeight: "600", fontStretch: "100%", fontSize: G.supFs + "px",
        lineHeight: "1.4", color: neon, opacity: "0.9", textAlign: "center", whiteSpace: "normal", textWrap: "balance" });
      sup.textContent = supportText;
      show(X, sup, at(1.04));
      X.T(sup, "transform", `translateY(${0.4 * G.supFs}px)`).to(at(1.04), 0.35, "translateY(0px)", EASE_OUT);
    }
    if (url) {
      const U = url.toUpperCase(), fs = fit(U, "lb", 0.16, 0.8 * W, G.urlFs);
      show(X, lb(url, cx, G.urlY, fs, { ax: 0.5, ls: 0.16 }).box, at(1.12));
      const uw = textW(U, "lb", 0.16, fs);
      const under = div(N, "patch", { left: cx - uw / 2 + "px", top: G.urlY + 0.9 * fs + "px", width: uw + "px",
        height: Math.max(1, 1.4 * u) + "px", background: neon, transformOrigin: "50% 50%" });
      X.T(under, "transform", "scaleX(0)").to(at(1.16), 0.3, "scaleX(1)", EASE_OUT);
    }
    // Pie técnico.
    const fz = 8.5 * u * (G.portrait ? 1.3 : 1);
    show(X, lb("FIN", m, G.footY, fz).box, at(1.2));
    hatch(m + 34 * u, G.footY - 5 * u, 58 * u, 10 * u, 70, at(1.2));
    const sq = div(N, "patch", { left: W - m - 7 * u + "px", top: G.footY - 3.5 * u + "px", width: 7 * u + "px", height: 7 * u + "px", background: neon });
    show(X, sq, at(1.24));
    show(X, N, at(0.3)); // el contenido nace cuando la tinta ya cubre el cuadro
  }

  return { defaults, options, timeline, render };
});

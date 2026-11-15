(function attach(root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.NexaPromoEditorialOutroV2 = api;
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

  /* V2 · composición centrada con los dos bloques negros enfrentados de la
     escena «FINAL ROUND»: uno baja desde arriba a la izquierda y otro sube
     desde abajo a la derecha; el titular cruza ambos y cambia de color. */
  function grid(W, H) {
    if (H > W) return {
      portrait: true,
      A: { x: 0, y: 0, w: 0.3 * W, h: 0.6 * H }, B: { x: 0.7 * W, y: 0.4 * H, w: 0.3 * W, h: 0.6 * H },
      rules: [0.42, 0.58], titleW: 0.9 * W, titleH: 0.075 * H, titleY: 0.5 * H,
      chanY: 0.35 * H, subY: 0.64 * H, subFs: 0.02 * H,
      footX: 0.07 * W, footAx: 0, footW: 0.58 * W, ctaY: 0.73 * H, ctaFs: 0.026 * H,
      supY: 0.775 * H, supFs: 0.0165 * H, urlY: 0.93 * H, urlFs: 0.0125 * H
    };
    return {
      portrait: false,
      A: { x: 0, y: 0, w: 0.28 * W, h: 0.72 * H }, B: { x: 0.72 * W, y: 0.28 * H, w: 0.28 * W, h: 0.72 * H },
      rules: [0.36, 0.6], titleW: 0.84 * W, titleH: 0.19 * H, titleY: 0.48 * H,
      chanY: 0.29 * H, subY: 0.68 * H, subFs: 0.03 * H,
      footX: 0.5 * W, footAx: 0.5, footW: 0.4 * W, ctaY: 0.78 * H, ctaFs: 0.03 * H,
      supY: 0.825 * H, supFs: 0.0185 * H, urlY: 0.935 * H, urlFs: 0.0135 * H
    };
  }

  function render(sc, X, palette, config, tools) {
    const { W, H, u } = X;
    const { div, tx, fit, textW, base, rule, wipe, sliceIn, show } = tools;
    const out = options(config), P = palette, G = grid(W, H), A = G.A, B = G.B;
    const str = v => String(v ?? "").trim();
    const title = str(out.title).toUpperCase(), sub = str(out.sub).toUpperCase();
    const cta = str(out.cta).toUpperCase(), channel = str(out.channel).toUpperCase();
    const supportText = str(out.support), url = str(out.url);
    const k = Math.max(0.45, Math.min(1, (X.dur || out.sec) / 3.5));
    const at = t => t * k;
    const hair = Math.max(1, 1.2 * u);
    const enter = (t, t0) => { show(X, t.box, t0); t.el.style.lineHeight = "1.32"; return t; };

    const L = base(X);
    L.dataset.component = "promo-editorial.outroV2";

    // Bloques enfrentados y filetes a todo el ancho.
    wipe(X, L, A, at(0.04), 0.75, "down");
    wipe(X, L, B, at(0.12), 0.75, "up");
    G.rules.forEach((y, i) => rule(X, L, 0, y * H, W, hair, at(0.18 + i * 0.08)));

    /* ---- Titular centrado: tinta sobre papel, papel sobre los bloques ---- */
    if (title) {
      const fs = fit(title, "gx", -0.03, G.titleW, G.titleH), t0 = at(0.34);
      enter(sliceIn(X, L, title, W / 2, G.titleY, fs, P.black, t0, { ls: -0.03 }), t0);
      for (const R of [A, B]) {
        const clip = div(L, "lay", { clipPath: `inset(${R.y}px ${W - R.x - R.w}px ${H - R.y - R.h}px ${R.x}px)` });
        enter(sliceIn(X, clip, title, W / 2, G.titleY, fs, P.paper, t0, { ls: -0.03 }), t0);
      }
    }

    // Canal entre dos marcas verticales, como el rótulo de la escena de bloques.
    if (channel) {
      const fs = fit(channel, "gx", 0.36, 0.36 * W, (G.portrait ? 0.012 : 0.016) * H);
      const lab = tx(L, channel, { cls: "gx", fs, x: W / 2, y: G.chanY, color: P.black, ls: 0.36 });
      show(X, lab.box, at(0.42));
      const half = textW(channel, "gx", 0.36, fs) / 2 + 0.025 * W, bh = fs * 1.6, bw = Math.max(2, 3 * u);
      for (const x of [W / 2 - half, W / 2 + half - bw]) {
        const b = div(L, "patch", { left: x + "px", top: G.chanY - bh / 2 + "px", width: bw + "px", height: bh + "px",
          background: P.black, transformOrigin: "50% 0%" });
        X.T(b, "transform", "scaleY(0)").to(at(0.46), 0.25, "scaleY(1)", "cubic-bezier(.16,.84,.24,1)");
      }
    }

    // Subtítulo en placa negra centrada.
    if (sub) {
      const fs = fit(sub, "gx", 0.3, 0.5 * W, G.subFs);
      const w = textW(sub, "gx", 0.3, fs) + fs * 1.6, h = fs * 2.1;
      wipe(X, L, { x: W / 2 - w / 2, y: G.subY - h / 2, w, h }, at(0.55), 0.6);
      enter(sliceIn(X, L, sub, W / 2 + 0.15 * fs, G.subY, fs, P.paper, at(0.66), { ls: 0.3 }), at(0.66));
    }

    /* ---- Colofón ---- */
    const fx = G.footX, ax = G.footAx;
    if (cta) {
      const fs = fit(cta, "gx", 0.08, G.footW, G.ctaFs);
      enter(sliceIn(X, L, cta, fx, G.ctaY, fs, P.black, at(0.82), { ax, ls: 0.08 }), at(0.82));
      const cw = textW(cta, "gx", 0.08, fs);
      rule(X, L, fx - ax * cw, G.ctaY + 0.75 * fs, cw, Math.max(2, 2.4 * u), at(0.9));
    }
    if (supportText) {
      const sup = div(L, "patch", { left: fx - ax * G.footW + "px", top: G.supY + "px", width: G.footW + "px",
        fontFamily: '"Archivo", sans-serif', fontWeight: "400", fontStretch: "100%", fontSize: G.supFs + "px",
        lineHeight: "1.45", color: P.black, opacity: "0.82", textAlign: ax ? "center" : "left", whiteSpace: "normal", textWrap: "balance" });
      sup.textContent = supportText;
      show(X, sup, at(1.0));
    }
    if (url) {
      const fs = fit(url.toUpperCase(), "gx", 0.18, G.footW, G.urlFs);
      const link = tx(L, url, { cls: "gx", fs, x: fx, y: G.urlY, ax, color: P.black, ls: 0.18 });
      show(X, link.box, at(1.1));
    }

    // Marca de registro en papel dentro del bloque inferior.
    const arm = Math.min(0.045 * W, 0.045 * H), line = Math.max(2, 2.4 * u);
    const cx = B.x + B.w / 2, cy = B.y + B.h * (G.portrait ? 0.82 : 0.78);
    rule(X, L, cx - arm / 2, cy, arm, line, at(0.6), P.paper);
    const tick = div(L, "patch", { left: cx - line / 2 + "px", top: cy - arm / 2 + "px", width: line + "px", height: arm + "px",
      background: P.paper, transformOrigin: "50% 0%" });
    X.T(tick, "transform", "scaleY(0)").to(at(0.64), 0.3, "scaleY(1)", "cubic-bezier(.16,.84,.24,1)");
  }

  return { defaults, options, timeline, render };
});

/* stage.js · motor de VIDEO del avatar (escena = datos) sobre el núcleo común ../../_proto/proto.js.
 *
 * El index.html de una escena carga: proto.js → avatar.js → gestures.js → stage.js. La escena vive en
 * assets/scene.json (formato en AVATAR.md): personaje, fondo, planos de cámara y timeline de gestos
 * anclados a la voz ("@palabra"). La voz (song.mp3 + lyrics.json) mueve los labios sola.
 * Lienzo responsive: el mismo HTML se graba en 16:9 y 9:16 (los planos tienen medidas por orientación).
 */
(() => {
  "use strict";
  const { clamp, lerp, ease } = Proto.U;

  // planos: alto del personaje (× alto de pantalla) y dónde queda la cabeza (0 = arriba)
  const SHOTS = {
    landscape: { full: { h: 0.92, head: 0.13 }, medium: { h: 1.7, head: 0.22 }, close: { h: 2.4, head: 0.3 } },
    portrait: { full: { h: 0.8, head: 0.16 }, medium: { h: 1.35, head: 0.2 }, close: { h: 1.95, head: 0.26 } },
  };
  let CH = null, R = null, S = null, BG = null, CAM = [];

  function camAt(t, port, ctx) {
    const scene = ctx.scene, A = scene.avatar || {};
    const tab = { ...SHOTS[port ? "portrait" : "landscape"], ...((scene.shots || {})[port ? "portrait" : "landscape"] || {}) };
    const val = k => {
      const sh = tab[k.shot || "full"] || tab.full;
      const o = (port && k.portrait) || {};
      return { h: o.h ?? k.h ?? sh.h, head: o.head ?? k.head ?? sh.head, x: o.x ?? k.x ?? (port ? A.portraitX : null) ?? A.x ?? 0.5 };
    };
    let cur = val({ shot: A.shot || "full" });
    for (const k of CAM) {
      if (t < k.t) break;
      const nxt = val(k), u = k.cut ? 1 : ease((t - k.t) / (k.smooth ?? 0.9));
      cur = { h: lerp(cur.h, nxt.h, u), head: lerp(cur.head, nxt.head, u), x: lerp(cur.x, nxt.x, u) };
    }
    return cur;
  }

  Proto.run({
    name: "avatar",
    fonts: ["800 20px 'DM Sans'", "700 20px 'DM Sans'"],
    theme: { outro: { enabled: false }, captions: { maxWords: 4 }, ui: "DM Sans", heavy: "800 $px 'DM Sans'" },
    async setup(ctx) {
      const A = ctx.scene.avatar || {};
      const url = A.url || `../_avatar/characters/${A.character || "chica"}/`;
      CH = await Avatar.load(url);
      R = Avatar.renderer();
      S = AvatarGestures.compile(ctx.scene, { ...ctx, ch: CH });
      CAM = (ctx.scene.camera || []).map(k => ({ ...k, t: ctx.T(k.t, 0) })).sort((a, b) => a.t - b.t);
      const B = ctx.scene.background || {};
      if (B.type === "image" && B.src) BG = await ctx.loadImg(B.src);
      window.__action = window.__avatar = { ch: CH, S, poseAt: t => AvatarGestures.poseAt(S, t) };
    },
    render(ctx, t) {
      const { g, st, scene } = ctx, { W, H } = st, port = H > W;
      const B = scene.background || {};
      g.fillStyle = B.color || "#f3f1ee"; g.fillRect(0, 0, W, H);
      if (BG) { const s = Math.max(W / BG.width, H / BG.height); g.drawImage(BG, (W - BG.width * s) / 2, (H - BG.height * s) / 2, BG.width * s, BG.height * s); }
      if (B.dim) { g.fillStyle = `rgba(0,0,0,${B.dim})`; g.fillRect(0, 0, W, H); }

      const c = camAt(t, port, ctx), rig = CH.rig;
      const h = c.h * H, headAbove = (rig.feet[1] - rig.face.center[1]) / rig.height;   // pies → cara
      const place = { x: c.x * W, y: c.head * H + headAbove * h, h, flip: !!(scene.avatar || {}).flip };
      // sombra suave en el piso (solo si se ven los pies)
      if (B.shadow !== false && place.y < H * 1.02) {
        g.save(); g.fillStyle = "rgba(40,30,25,0.10)"; g.beginPath();
        g.ellipse(place.x, place.y - h * 0.004, h * 0.16, h * 0.018, 0, 0, Math.PI * 2); g.fill(); g.restore();
      }
      const P = AvatarGestures.poseAt(S, t);
      R.size(W, H); R.clear(); R.draw(CH, P, place);
      g.drawImage(R.canvas, 0, 0);

      if (scene.labels) {   // demo: qué gesto se está viendo
        const on = S.acts.filter(a => t >= a.t0 && t <= a.t1).map(a => a.do + (a.side && a.g.apply.length > 3 ? " · " + a.side : ""));
        if (on.length) {
          const u = st.U; g.font = `800 ${26 * u}px 'DM Sans', sans-serif`; g.textBaseline = "top";
          const txt = on.join("  +  "), w = g.measureText(txt).width;
          g.fillStyle = "rgba(26,24,22,0.86)"; g.beginPath(); g.roundRect(28 * u, 28 * u, w + 36 * u, 48 * u, 10 * u); g.fill();
          g.fillStyle = "#fff"; g.fillText(txt, 46 * u, 39 * u);
        }
      }
    },
    shots: () => [0, ...CAM.filter(k => k.cut).map(k => k.t)],
  });
})();

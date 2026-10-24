/* mapas.js · motor de mapas satelitales (réplica de los videos de ejemplo2: Bolivia, Ucrania, "nuevos países").
 *
 * LO FIJO (el estándar): mapa satelital oscuro, países con color saturado que deja ver el relieve y borde
 * neón, rayado, líneas/flechas brillantes, banderas, años, subtítulos, cámara que vuela; intro y cierre
 * del estándar de producción (núcleo compartido ../../_proto/proto.js).
 * LO QUE CAMBIA por video: solo assets/scene.json (ver ../_mapas/ESCENA.md).
 *
 * Módulos: geo.js (lugares, regiones, encuadres) · camera.js (vuelo fluido) · layers.js (capas) ·
 *          flags.js (banderas) · places.json (lugares con nombre) · este archivo (los une).
 */
(() => {
  "use strict";
  const BASE = document.currentScript.src.replace(/mapas\.js.*$/, "");
  const SAT_DEFAULT = [
    { src: "sat-world.jpg", bounds: [-180, 180, -80, 82] },
  ];

  Proto.run({
    name: "mapas",
    fonts: ["800 40px Montserrat", "900 40px Montserrat", "italic 900 40px Montserrat", "italic 800 40px Montserrat"],
    theme: {
      heavy: "900 $px Montserrat",
      accent: "#ffd21a",
      introDim: 0.35,
      captions: { color: "#ffd21a", maxWords: 4, size: 36, y: 0.885, yLandscape: 0.915 },
      outro: { channel: "NODEHISTORY", handle: "youtube.com/@nodehistory" },
      // palabra con el estilo de la referencia: blanca, borde negro y sombra
      word(g, s, x, y, size, col, center) {
        g.save(); g.textAlign = center ? "center" : "left"; g.textBaseline = "middle";
        g.shadowColor = "rgba(0,0,0,.75)"; g.shadowBlur = size * 0.25; g.lineJoin = "round"; g.lineWidth = size * 0.12; g.strokeStyle = "#000";
        g.strokeText(s, x, y); g.shadowBlur = 0; g.fillStyle = col; g.fillText(s, x, y); g.restore();
      },
    },
    async setup(c) {
      const { scene, T, loadImg } = c;
      const placesBase = await fetch(BASE + "places.json").then(r => r.ok ? r.json() : {}).catch(() => ({}));
      c.geo = Mapas.geo.create(scene, placesBase);
      // satélite: el del motor (mundo) + los recortes de detalle del video
      c.sat = [...(scene.satDefault === false ? [] : SAT_DEFAULT.map(s => ({ ...s, src: BASE + "media/" + s.src }))), ...(scene.sat || [])];
      c.sat.forEach(s => loadImg(s.src));
      c.layers = (scene.layers || []).map((Ly, i) => ({ ...Ly, _i: i, _t: T(Ly.t, 0), _out: Ly.out != null ? T(Ly.out) : Infinity, _flicker: Ly.flicker != null ? T(Ly.flicker) : null }));
      c.layers.filter(Ly => Ly.src).forEach(Ly => loadImg(Ly.src));
      c.camera = Mapas.camera.create(scene.camera || [{ t: 0, c: [0, 20], span: 120 }], c.geo, T);
    },
    shots: c => c.camera.keys.map(k => k._t),
    render(c, t) {
      const { g, st, scene } = c, { W, H } = st;
      g.fillStyle = "#0b1622"; g.fillRect(0, 0, W, H);
      const cam = c.camera.at(t, W, H), P = c.camera.projection(cam, W, H);
      for (const s of c.sat) { // satélite, de menos a más detalle
        const im = c.img(s.src); if (!im) continue;
        const [lo0, lo1, la0, la1] = s.bounds, a = P([lo0, la1]), b = P([lo1, la0]);
        if (b[0] < 0 || a[0] > W || b[1] < 0 || a[1] > H) continue;
        g.drawImage(im, a[0], a[1], b[0] - a[0], b[1] - a[1]);
      }
      g.fillStyle = `rgba(4,10,20,${scene.dim ?? 0.3})`; g.fillRect(0, 0, W, H);
      const ctx = { g, st, P, cam, geo: c.geo, img: c.img };
      // al empezar el cierre de canal se retira todo lo que no tiene `out` (el cierre queda limpio)
      const outOf = Ly => Math.min(Ly._out, c.outroAt ?? Infinity);
      const vis = Ly => t >= Ly._t && t < outOf(Ly) + (Ly.fadeOut ?? 0.35);
      const alpha = Ly => clamp01((t - Ly._t) / (Ly.fade ?? 0.35)) * (t > outOf(Ly) ? 1 - clamp01((t - outOf(Ly)) / (Ly.fadeOut ?? 0.35)) : 1);
      for (const pass of [0, 1]) for (const Ly of c.layers) {
        if ((Ly.type === "fill") !== (pass === 0) || !vis(Ly)) continue;
        const fn = Mapas.layers[Ly.type]; if (!fn) { warnOnce("tipo de capa desconocido: " + Ly.type); continue; }
        g.save(); fn(ctx, Ly, t, alpha(Ly)); g.restore();
      }
      const vg = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    },
  }).catch(e => console.error(e));

  const clamp01 = v => Math.max(0, Math.min(1, v));
  const seen = new Set();
  function warnOnce(m) { if (!seen.has(m)) { seen.add(m); console.warn("[mapas]", m); } }
})();

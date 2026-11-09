/* camera.js · cámara fluida del motor de mapas.
 *
 * Cada key de scene.camera es un DESTINO; la cámara vuela de donde está (aunque esté a mitad de otro
 * vuelo) hasta ahí con el vuelo "zoom + paneo" de van Wijk y Nuij (se aleja y se acerca sola cuando el
 * salto es largo, como Google Earth), con aceleración suave. Los relevos conservan la velocidad
 * entrante. Entre vuelos nunca queda quieta: deriva
 * con un zoom lento (drift) y, si se pide, un paneo (pan).
 *
 * Key: { t, dur?, ease? ("inOut"|"out"|"linear"),
 *        focus: "Bolivia" | ["Bolivia","Chile","Antofagasta"] | [[lon,lat],…]   ← encuadre automático
 *        pad? (margen, 0.18), minSpan? (grados mínimos visibles, 1.2), offset? [dx,dy] (fracción de pantalla)
 *        o bien c: lugar | [lon,lat] + span (grados visibles en el lado corto),
 *        zoom? (multiplica el acercamiento), drift? (0.012/s), pan? [dx,dy] por segundo (fracción),
 *        portrait?/landscape?: {…} (pisa campos solo en ese formato) }
 * Pose = { x, y, w } en unidades Mercator (w = ancho visible).
 */
(() => {
  "use strict";
  const RAD = Math.PI / 180, SQRT2 = Math.SQRT2;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const EASE = {
    inOut: k => (k = clamp(k), k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2),
    out: k => 1 - Math.pow(1 - clamp(k), 3),
    linear: k => clamp(k),
    smooth: k => (k = clamp(k), k * k * k * (k * (6 * k - 15) + 10)),
  };

  /** vuelo de van Wijk & Nuij (el mismo que d3.interpolateZoom) entre [x,y,w] */
  function flight(p0, p1, rho = 1.25) {
    const [ux0, uy0, w0] = p0, [ux1, uy1, w1] = p1, dx = ux1 - ux0, dy = uy1 - uy0, d2 = dx * dx + dy * dy, r2 = rho * rho, r4 = r2 * r2;
    let S, at;
    if (d2 < 1e-14) { S = Math.log(w1 / w0) / rho; at = s => [ux0 + s * dx, uy0 + s * dy, w0 * Math.exp(rho * s * S)]; }
    else {
      const d1 = Math.sqrt(d2), b0 = (w1 * w1 - w0 * w0 + r4 * d2) / (2 * w0 * r2 * d1), b1 = (w1 * w1 - w0 * w0 - r4 * d2) / (2 * w1 * r2 * d1);
      const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0), r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
      S = (r1 - r0) / rho;
      at = s => { const q = s * S, c0 = Math.cosh(r0), u = (w0 / (r2 * d1)) * (c0 * Math.tanh(rho * q + r0) - Math.sinh(r0)); return [ux0 + u * dx, uy0 + u * dy, (w0 * c0) / Math.cosh(rho * q + r0)]; };
    }
    at.len = Math.abs(S) * rho / SQRT2;           // "distancia" del vuelo → duración automática
    return at;
  }

  function create(keys, geo, T) {
    const K = keys.map(k => ({ ...k, _t: T(k.t, 0) })).sort((a, b) => a._t - b._t);
    let cacheFor = "", plan = [];
    const VELOCITY_EPS = 0.001;

    function velocity(a, b, dt) {
      return [(b.x - a.x) / dt, (b.y - a.y) / dt, (Math.log(b.w) - Math.log(a.w)) / dt];
    }
    function segmentPose(s, lt, correctVelocity = true) {
      let x, y, w;
      if (!s.fly || lt >= s.dur) { x = s.tg.x; y = s.tg.y; w = s.tg.w; }
      else {
        [x, y, w] = s.fly((EASE[s.k.ease] || EASE.inOut)(lt / s.dur));
        if (correctVelocity && s.kick && lt < s.blend) {
          const u = clamp(lt / s.blend), shape = u * (1 - u) * (1 - u);
          x += s.kick[0] * s.blend * shape;
          y += s.kick[1] * s.blend * shape;
          w *= Math.exp(s.kick[2] * s.blend * shape);
        }
      }
      // La deriva empieza tarde en el vuelo y continúa suavemente entre claves.
      const drift = s.k.drift ?? 0.012, dlt = Math.max(0, lt - (s.fly ? s.dur * 0.6 : 0));
      const dk = dlt * dlt / (dlt + 1.2);
      w *= Math.exp(-drift * dk);
      if (s.k.pan) { x += s.k.pan[0] * w * dk; y += s.k.pan[1] * w * dk; }
      return { x, y, w };
    }

    function target(k, W, H) {
      const port = H > W, o = { ...k, ...((port ? k.portrait : k.landscape) || {}) };
      let x, y, w;
      if (o.focus != null) {
        const b = geo.bounds(o.focus), pad = o.pad ?? 0.18;
        const bw = b[1][0] - b[0][0], bh = b[1][1] - b[0][1];
        x = (b[0][0] + b[1][0]) / 2; y = (b[0][1] + b[1][1]) / 2;
        w = Math.max(bw, (bh * W) / H) * (1 + 2 * pad);
        w = Math.max(w, (o.minSpan ?? 1.2) * RAD * (W / Math.min(W, H)));
      } else {
        [x, y] = geo.merc(geo.place(o.c ?? [0, 20]));
        w = (o.span ?? 60) * RAD * (W / Math.min(W, H));
      }
      w /= o.zoom || 1;
      if (o.offset) { x -= o.offset[0] * w; y -= (o.offset[1] * w * H) / W; }
      return { x, y, w, k: o };
    }
    function build(W, H) {
      plan = [];
      for (let i = 0; i < K.length; i++) {
        const tg = target(K[i], W, H);
        const seg = { t0: K[i]._t, tg, k: tg.k };
        if (i === 0) { seg.from = [tg.x, tg.y, tg.w]; seg.fly = null; seg.dur = 0; }
        else {
          const p = poseIn(plan, seg.t0);               // de donde está AHORA (aunque esté volando)
          seg.from = [p.x, p.y, p.w];
          seg.fly = flight(seg.from, [tg.x, tg.y, tg.w]);
          seg.dur = tg.k.dur ?? clamp(0.9 + seg.fly.len * 0.55, 1.2, 4.2);
          if (seg.dur > 0) {
            const before = poseIn(plan, seg.t0 - VELOCITY_EPS), atKey = poseIn(plan, seg.t0);
            const raw0 = segmentPose(seg, 0, false), raw1 = segmentPose(seg, VELOCITY_EPS, false);
            const incoming = velocity(before, atKey, VELOCITY_EPS), initial = velocity(raw0, raw1, VELOCITY_EPS);
            seg.kick = incoming.map((v, d) => v - initial[d]);
            seg.blend = Math.min(0.45, seg.dur * 0.3);
          }
        }
        plan.push(seg);
      }
    }
    function poseIn(P, t) {
      let i = 0; while (i + 1 < P.length && P[i + 1].t0 <= t) i++;
      const s = P[i]; if (!s) return { x: 0, y: 0, w: 1 };
      const lt = Math.max(0, t - s.t0);
      return segmentPose(s, lt);
    }
    function at(t, W, H) {
      const key = W + "x" + H; if (key !== cacheFor) { cacheFor = key; build(W, H); }
      const p = poseIn(plan, t), k = W / p.w;
      return { ...p, k, span: (p.w / RAD) * (Math.min(W, H) / W) };
    }
    function projection(cam, W, H) {
      return d3.geoMercator().scale(cam.k).translate([W / 2 - cam.x * cam.k, H / 2 - cam.y * cam.k]).precision(0.4).clipExtent([[-60, -60], [W + 60, H + 60]]);
    }
    return { at, projection, keys: K };
  }

  window.Mapas = window.Mapas || {};
  window.Mapas.camera = { create, flight };
})();

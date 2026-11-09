/* camera.js · cámara cinematográfica de Atlas. FUNCIÓN PURA de t (sin estado): seek adelante/atrás/fuera de orden = misma pose.
 *
 * Una key es { t, center:[lon,lat], zoom, pitch, bearing, lift, dur?, ease?, drift?, settle?, arc?, through? }.
 *  - t        : instante en que SALE hacia esta pose; llega a t+dur y luego «reposa».
 *  - dur      : s de vuelo (auto según distancia: 1.2–4.2).
 *  - ease     : "inOut" (def.) | "out" (arranca rápido, frena suave).
 *  - drift    : velocidad residual al llegar { zoom, pitch, bearing, x, y } (unidades/s; x,y = grados Mercator). Decae con `settle` (s, def. 4)
 *               → la cámara nunca queda congelada y la deriva está acotada.
 *  - through  : true = llega a velocidad de crucero (para encadenar vuelos sin frenar).
 *  - arc      : s/n; hundimiento de zoom en saltos largos (def. auto). 0 lo apaga.
 * Continuidad C1: cada vuelo arranca con la posición Y la velocidad que traía la cámara (incluso si interrumpe otro vuelo).
 * Canal por componente: centro en Mercator (x=lon desenrollada, y=mercY(lat), ambos en «grados»), zoom, pitch, rumbo (camino corto), lift.
 */
const D2R = Math.PI / 180, R2D = 180 / Math.PI;
export const mercY = lat => Math.log(Math.tan(Math.PI / 4 + Math.max(-85.05, Math.min(85.05, lat)) * D2R / 2)) * R2D;
export const invMercY = y => (2 * Math.atan(Math.exp(y * D2R)) - Math.PI / 2) * R2D;
/** zoom de MapLibre (512 px) para que el ancho W cubra `spanDeg` grados de longitud */
export const spanToZoom = (spanDeg, W = 1920) => Math.log2(W * 360 / (512 * Math.max(1e-6, spanDeg)));
export const zoomToSpan = (zoom, W = 1920) => W * 360 / (512 * 2 ** zoom);

const wrap = d => ((d + 180) % 360 + 360) % 360 - 180;           // → [-180,180)
const CH = ["x", "y", "z", "p", "b", "lift"];
const hermite = (p0, m0, p1, m1, s) => {                            // posición y derivada d/ds
  const s2 = s * s, s3 = s2 * s;
  return [
    (2 * s3 - 3 * s2 + 1) * p0 + (s3 - 2 * s2 + s) * m0 + (-2 * s3 + 3 * s2) * p1 + (s3 - s2) * m1,
    (6 * s2 - 6 * s) * p0 + (3 * s2 - 4 * s + 1) * m0 + (-6 * s2 + 6 * s) * p1 + (3 * s2 - 2 * s) * m1,
  ];
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function toState(k) {
  return { x: k.center[0], y: mercY(k.center[1]), z: k.zoom, p: k.pitch ?? 0, b: k.bearing ?? 0, lift: clamp(k.lift ?? 0, 0, 0.9) };
}

export function createCamera(keysIn) {
  const keys = [...keysIn].sort((a, b) => a.t - b.t);
  if (!keys.length) throw new Error("camera: sin keys");
  const s0 = toState(keys[0]);
  // segmentos: { t0, t1, dur, from:{ch:[p0]}, to, v0, vEnd, tau, arc, ease }
  const segs = [];
  const base = { t0: -Infinity, t1: keys[0].t, rest: true, x1: s0, vEnd: { x: 0, y: 0, z: 0, p: 0, b: 0, lift: 0 }, tau: 4 };
  segs.push(base);

  // estado (valor, derivada) de todos los canales en t según los segmentos ya construidos
  function stateAt(t) {
    const out = { v: {}, d: {} };
    for (let i = segs.length - 1; i >= 0; i--) {
      const sg = segs[i];
      if (t < sg.t0 && i > 0) continue;
      if (sg.rest || t >= sg.t1) {                                    // reposo con deriva decreciente
        const tt = sg.rest ? Math.max(0, t - sg.t1) : t - sg.t1;
        for (const c of CH) {
          const a = sg.x1[c], ve = sg.vEnd[c], tau = sg.tau;
          out.v[c] = a + ve * tau * (1 - Math.exp(-tt / tau));
          out.d[c] = ve * Math.exp(-tt / tau);
        }
        out.rest = true; out.seg = sg; return out;
      }
      const s = (t - sg.t0) / sg.dur;
      for (const c of CH) {
        const [v, dv] = hermite(sg.x0[c], sg.m0[c], sg.x1[c], sg.m1[c], s);
        out.v[c] = v; out.d[c] = dv / sg.dur;
      }
      if (sg.arcAmt) {                                                // hundimiento de zoom: sin²(πs), C1 en los extremos
        const sn = Math.sin(Math.PI * s);
        out.v.z -= sg.arcAmt * sn * sn;
        out.d.z -= sg.arcAmt * 2 * sn * Math.cos(Math.PI * s) * Math.PI / sg.dur;
      }
      out.seg = sg; return out;
    }
    return out;
  }

  for (let i = 1; i < keys.length; i++) {
    const k = keys[i], tgt = toState(k), t0 = k.t, st = stateAt(t0);
    const x0 = { ...st.v }, v0 = { ...st.d };
    // camino corto en longitud y rumbo
    const x1 = { ...tgt };
    x1.x = x0.x + wrap(tgt.x - x0.x);
    x1.b = x0.b + wrap(tgt.b - x0.b);
    const dist = Math.hypot(x1.x - x0.x, x1.y - x0.y);
    const dur = k.dur ?? clamp(1.2 + dist / 55, 1.2, 4.2);
    const drift = k.drift || {}, through = !!k.through;
    const vEnd = {}, m0 = {}, m1 = {};
    for (const c of CH) {
      const D = x1[c] - x0[c];
      vEnd[c] = c === "lift" ? (through ? D / dur : 0) : drift[c] ?? (through ? D / dur : 0);
      let a = v0[c] * dur, b = vEnd[c] * dur;
      if (k.ease === "out" && Math.abs(D) > 1e-9) a = Math.sign(D) * Math.max(Math.abs(a), 2 * Math.abs(D));
      if (Math.abs(D) > 1e-9) {                                         // sin rebote: |m|/|D| acotado (Fritsch–Carlson)
        let al = a / D, be = b / D;
        if (al > 0 && be > 0) { const r = Math.hypot(al, be); if (r > 3) { al *= 3 / r; be *= 3 / r; } }
        else { al = clamp(al, -1.5, 3); be = clamp(be, -1.5, 3); }
        a = al * D; b = be * D;
      }
      m0[c] = a; m1[c] = b;
    }
    const arc = k.arc ?? clamp(0.55 * Math.log2(1 + dist / 25), 0, 2);
    const prev = segs[segs.length - 1];
    if (!prev.rest && prev.t1 > t0) prev.t1 = prev.t1;                  // el nuevo vuelo interrumpe: stateAt ya devolvió su pose/velocidad
    segs.push({ t0, t1: t0 + dur, dur, x0, x1, m0, m1, vEnd, tau: k.settle ?? 4, arcAmt: arc });
    // al interrumpir, el segmento previo deja de valer desde t0 (el orden de búsqueda lo resuelve: se busca de atrás hacia delante)
  }

  const ends = segs.slice(1).map(s => s.t1);
  function pose(t) {
    const st = stateAt(t);
    return { lon: wrap(st.v.x), lat: invMercY(st.v.y), zoom: Math.max(0, st.v.z), pitch: clamp(st.v.p, 0, 85), bearing: wrap(st.v.b), lift: clamp(st.v.lift, 0, 0.9) };
  }
  return {
    keys, segs,
    at: pose,
    /** derivadas por segundo (x,y en grados Mercator) — para pruebas y para el motor de cuerpo de movimiento */
    velocity(t) { const st = stateAt(t); return { ...st.d }; },
    raw(t) { return stateAt(t).v; },
    end: ends.length ? Math.max(...ends) : keys[0].t,
    /** instantes de muestreo para precarga: cada `dt` s */
    samples(t0, t1, dt = 0.25) { const o = []; for (let t = t0; t <= t1 + 1e-9; t += dt) o.push(+t.toFixed(4)); return o; },
  };
}

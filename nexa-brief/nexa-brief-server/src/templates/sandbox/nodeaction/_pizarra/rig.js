/* rig.js · esqueleto del personaje de la pizarra: poses (objetivos + IK de dos huesos), articulaciones,
 * caras y los trazos de base. El DIBUJO del personaje vive en characters/<id>.js (intercambiable).
 *
 * Contrato de un personaje (Pizarra.characters[id]):
 *   { name, scale?: { head, tube, height }, draw(g, J, o) }
 *   J = articulaciones en px: hip, neck, sh (hombros), armR/armL = [codo, mano], legR/legL = [rodilla, pie],
 *       head = { x, y, r, tilt }, h (altura total), face (dirección de la cara −1..1)
 *   o = { lw, tube, ink, bg, face (expresión), t, P (pose mezclada), look (scene: colores/accesorios), R (este módulo) }
 * Helpers para no repetir: R.tubes(g, J, o) (silueta de doble trazo de brazos, piernas y torso),
 *   R.hands(g, J, o), R.feet(g, J, o), R.headCircle(g, J, o), R.face(g, cx, cy, r, kind, t, lw), R.waveLines(g, J, o).
 */
(() => {
  "use strict";
  const { clamp, lerp, ease, back } = Proto.U;
  const INK = "#151515", BG = "#efefef";
  const FONT = "'DM Sans', 'Inter', sans-serif", SERIF = "'Fraunces', Georgia, serif";

  /* ---------- trazo ---------- */
  function line(g, pts, w, col = INK) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round"; g.lineJoin = "round";
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.stroke();
  }
  function curve(g, a, c, b, w, col = INK) {
    g.strokeStyle = col; g.lineWidth = w; g.lineCap = "round";
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(c[0], c[1], b[0], b[1]); g.stroke();
  }
  function circle(g, x, y, r, w, fill) {
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (w) { g.strokeStyle = INK; g.lineWidth = w; g.stroke(); }
  }

  /* ---------- monigote (doble trazo, IK de dos huesos) ---------- */
  // Objetivos en unidades de altura (h). Manos: desde el hombro. Pies: desde la cadera. y hacia abajo.
  // b* = lado hacia el que se dobla el codo/rodilla (1 / -1).
  const POSES = {
    stand:  { hR: [0.075, 0.325], hL: [-0.075, 0.325], bR: -1, bL: 1, fR: [0.045, 0.47], fL: [-0.045, 0.47], open: 0 },
    wave:   { hR: [0.2, -0.2], hL: [-0.07, 0.325], bR: 1, bL: 1, fR: [0.045, 0.47], fL: [-0.045, 0.47], wave: 1 },
    think:  { hR: [0.025, -0.055], hL: [-0.07, 0.325], bR: -1, bL: 1, fR: [0.045, 0.47], fL: [-0.045, 0.47], head: -4 },
    point:  { hR: [0.325, -0.02], hL: [-0.07, 0.325], bR: 1, bL: 1, fR: [0.06, 0.465], fL: [-0.045, 0.47] },
    pointL: { hR: [0.07, 0.325], hL: [-0.325, -0.02], bR: -1, bL: -1, fR: [0.045, 0.47], fL: [-0.06, 0.465] },
    shrug:  { hR: [0.24, 0.06], hL: [-0.24, 0.06], bR: -1, bL: 1, fR: [0.05, 0.47], fL: [-0.05, 0.47], open: 1, head: 5 },
    shock:  { hR: [0.075, -0.15], hL: [-0.075, -0.15], bR: 1, bL: -1, fR: [0.07, 0.465], fL: [-0.07, 0.465] },
    hold:   { hR: [0.17, 0.14], hL: [-0.01, 0.16], bR: -1, bL: 1, fR: [0.045, 0.47], fL: [-0.045, 0.47] },
    write:  { hR: [0.15, 0.1], hL: [0.0, 0.17], bR: -1, bL: 1, fR: [0.045, 0.47], fL: [-0.045, 0.47], head: 8 },
    talk:   { hR: [0.19, 0.16], hL: [-0.075, 0.325], bR: -1, bL: 1, fR: [0.045, 0.47], fL: [-0.045, 0.47], open: 1 },
    cheer:  { hR: [0.15, -0.27], hL: [-0.15, -0.27], bR: 1, bL: -1, fR: [0.08, 0.46], fL: [-0.08, 0.46] },
  };
  const ARM = [0.17, 0.165], LEG = [0.245, 0.235];

  function ik(sx, sy, tx, ty, a, b, bend) {
    const dx = tx - sx, dy = ty - sy, d = clamp(Math.hypot(dx, dy), 1e-4, a + b - 1e-4);
    const th = Math.atan2(dy, dx), al = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
    const ex = sx + a * Math.cos(th + bend * al), ey = sy + a * Math.sin(th + bend * al);
    const k = Math.min(1, (a + b) / Math.hypot(dx, dy));
    return [[ex, ey], [sx + dx * Math.max(k, d / Math.hypot(dx, dy) || 1), sy + dy * Math.max(k, d / Math.hypot(dx, dy) || 1)]];
  }
  function mixPose(A, B, k) {
    const o = {};
    for (const key of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = A[key] ?? 0, b = B[key] ?? 0;
      o[key] = Array.isArray(a) ? [lerp(a[0], b[0], k), lerp(a[1], b[1], k)] : (key[0] === "b" ? (k < 0.5 ? a : b) : lerp(a, b, k));
    }
    return o;
  }

  function face(g, cx, cy, r, kind, t, lw) {
    const ex = r * 0.34, ey = -r * 0.12;
    const eye = (x, big) => {
      g.beginPath(); g.ellipse(cx + x, cy + ey, r * (big ? 0.16 : 0.11), r * (big ? 0.2 : 0.15), 0, 0, Math.PI * 2);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.8; g.stroke();
      const look = kind === "think" ? [-0.02, -0.08] : [0.02, 0.02];
      circle(g, cx + x + r * look[0] * 2, cy + ey + r * look[1] * 2, r * (big ? 0.07 : 0.06), 0, INK);
    };
    if (kind === "grin") {
      eye(-ex, 1); eye(ex, 1);
      g.beginPath(); g.moveTo(cx - r * 0.62, cy + r * 0.12);
      g.quadraticCurveTo(cx, cy + r * 0.32, cx + r * 0.62, cy + r * 0.12);
      g.quadraticCurveTo(cx + r * 0.5, cy + r * 0.78, cx, cy + r * 0.8);
      g.quadraticCurveTo(cx - r * 0.5, cy + r * 0.78, cx - r * 0.62, cy + r * 0.12);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      g.save(); g.clip(); g.lineWidth = lw * 0.6;
      line(g, [[cx - r * 0.6, cy + r * 0.47], [cx + r * 0.6, cy + r * 0.47]], lw * 0.6);
      for (let i = -2; i <= 2; i++) line(g, [[cx + i * r * 0.2, cy + r * 0.1], [cx + i * r * 0.2, cy + r * 0.85]], lw * 0.6);
      g.restore();
    } else if (kind === "shock") {
      eye(-ex, 1); eye(ex, 1);
      g.beginPath(); g.ellipse(cx, cy + r * 0.45, r * 0.16, r * 0.22, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
      curve(g, [cx - ex - r * 0.15, cy - r * 0.42], [cx - ex, cy - r * 0.55], [cx - ex + r * 0.15, cy - r * 0.45], lw * 0.8);
      curve(g, [cx + ex - r * 0.15, cy - r * 0.45], [cx + ex, cy - r * 0.55], [cx + ex + r * 0.15, cy - r * 0.42], lw * 0.8);
    } else if (kind === "worried") {
      eye(-ex, 0); eye(ex, 0);
      line(g, [[cx - ex - r * 0.16, cy - r * 0.36], [cx - ex + r * 0.14, cy - r * 0.46]], lw * 0.8);
      line(g, [[cx + ex - r * 0.14, cy - r * 0.46], [cx + ex + r * 0.16, cy - r * 0.36]], lw * 0.8);
      g.beginPath(); g.moveTo(cx - r * 0.3, cy + r * 0.48);
      g.bezierCurveTo(cx - r * 0.15, cy + r * 0.36, cx + r * 0.05, cy + r * 0.6, cx + r * 0.3, cy + r * 0.44);
      g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
    } else if (kind === "think") {
      eye(-ex, 0); eye(ex, 0);
      line(g, [[cx - r * 0.12, cy + r * 0.45], [cx + r * 0.3, cy + r * 0.4]], lw);
      line(g, [[cx + ex - r * 0.16, cy - r * 0.42], [cx + ex + r * 0.16, cy - r * 0.38]], lw * 0.8);
    } else if (kind === "talk") {
      eye(-ex, 0); eye(ex, 0);
      const o = 0.12 + 0.1 * Math.abs(Math.sin(t * 11));
      g.beginPath(); g.ellipse(cx, cy + r * 0.42, r * 0.22, r * o, 0, 0, Math.PI * 2); g.fillStyle = INK; g.fill();
    } else { // smile
      eye(-ex, 0); eye(ex, 0);
      curve(g, [cx - r * 0.34, cy + r * 0.32], [cx, cy + r * 0.62], [cx + r * 0.34, cy + r * 0.32], lw);
    }
  }


  /** articulaciones del personaje para una pose (sc = proporciones del personaje) */
  function joints(x, y, h, P, t, sc = {}) {
    const hipY = y - h * 0.47, neckY = y - h * 0.81;
    const sway = Math.sin(t * 1.7 + x) * h * 0.003;
    const hip = [x + sway * 0.3, hipY], neck = [x + sway, neckY];
    const sh = [neck[0], neck[1] + h * 0.035];
    const wv = P.wave ? Math.sin(t * 10) * 0.035 * P.wave : 0;
    const hand = o => [sh[0] + o[0] * h, sh[1] + o[1] * h];
    const foot = o => [hip[0] + o[0] * h, hip[1] + o[1] * h];
    const armR = ik(sh[0], sh[1], hand([P.hR[0] + wv, 0])[0], hand(P.hR)[1] - Math.abs(wv) * 0.4 * h, ARM[0] * h, ARM[1] * h, P.bR);
    const armL = ik(sh[0], sh[1], hand(P.hL)[0], hand(P.hL)[1], ARM[0] * h, ARM[1] * h, P.bL);
    const legR = ik(hip[0], hip[1], foot(P.fR)[0], foot(P.fR)[1], LEG[0] * h, LEG[1] * h, -1);
    const legL = ik(hip[0], hip[1], foot(P.fL)[0], foot(P.fL)[1], LEG[0] * h, LEG[1] * h, 1);
    const r = h * 0.092 * (sc.head || 1), tilt = ((P.head || 0) * Math.PI) / 180;
    const head = { x: neck[0] + Math.sin(tilt) * r, y: neck[1] - r * 0.95, r, tilt };
    return { hip, neck, sh, armR, armL, legR, legL, head, h };
  }

  /* ---------- helpers de dibujo (los usan todos los personajes) ---------- */
  /** silueta de doble trazo: primero todos los bordes, después el relleno → uniones limpias.
   *  parts = qué miembros ("legs", "torso", "arms"); para vestir: tubes(legs+torso) → ropa → tubes(arms) → hands */
  function tubes(g, J, o, extra = [], parts = ["legs", "torso", "arms"]) {
    const { hip, neck, sh, armR, armL, legR, legL, h } = J, has = k => parts.includes(k);
    const limbs = [
      ...(has("legs") ? [[hip, ...legR], [hip, ...legL]] : []),
      ...(has("torso") ? [[hip, [lerp(hip[0], neck[0], 0.5) + h * 0.004, lerp(hip[1], neck[1], 0.5)], neck]] : []),
      ...(has("arms") ? [[sh, ...armR], [sh, ...armL]] : []),
      ...extra,
    ];
    for (const L of limbs) line(g, L, o.tube + o.lw * 2, o.ink);
    for (const L of limbs) line(g, L, o.tube, o.fill || o.bg);
  }
  function feet(g, J, o) {
    for (const [L, s] of [[J.legR, 1], [J.legL, -1]]) {
      const f = L[1];
      g.beginPath(); g.ellipse(f[0] + s * J.h * 0.022, f[1] + J.h * 0.004, J.h * 0.03, J.h * 0.011, 0, 0, Math.PI * 2);
      g.fillStyle = o.shoe || o.bg; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.stroke();
    }
  }
  function hands(g, J, o) {
    for (const L of [J.armR, J.armL]) {
      const p = L[1];
      g.beginPath(); g.ellipse(p[0], p[1], J.h * 0.017, J.h * 0.022, Math.atan2(p[1] - L[0][1], p[0] - L[0][0]) - Math.PI / 2, 0, Math.PI * 2);
      g.fillStyle = o.skin || o.bg; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.stroke();
    }
  }
  function waveLines(g, J, o) {
    if (!(o.P.wave > 0.5)) return;
    const p = J.armR[1];
    for (const k of [1, 2]) { g.beginPath(); g.arc(p[0] - J.h * 0.02, p[1], J.h * (0.03 + k * 0.022), Math.PI * 0.95, Math.PI * 1.35); g.strokeStyle = o.ink; g.lineWidth = o.lw * 0.8; g.stroke(); }
  }
  /** cabeza redonda en su marco (rotada) + callback para pelo/accesorios/cara */
  function headCircle(g, J, o, inside) {
    const { x, y, r, tilt } = J.head;
    g.save(); g.translate(x, y); g.rotate(tilt);
    circle(g, 0, 0, r, o.lw * 1.1, o.skin || o.bg);
    if (inside) inside(g, r);
    g.restore();
  }

  window.Pizarra = window.Pizarra || {};
  window.Pizarra.characters = window.Pizarra.characters || {};
  window.Pizarra.rig = { POSES, ARM, LEG, ik, mixPose, joints, face, line, curve, circle, tubes, feet, hands, waveLines, headCircle, INK, BG };
})();

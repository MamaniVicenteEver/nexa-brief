/* props.js · dibujos de línea de la pizarra (registro Pizarra.props.<nombre>).
 * Cada uno: (g, s, p, t, k) dibujado centrado en (0,0); s = tamaño (alto aprox); p = parámetros del item;
 * k = el item compilado (k._t0 = cuándo apareció). Para uno nuevo: Pizarra.props.miDibujo = (g, s, p, t, k) => {…}.
 */
(() => {
  "use strict";
  const { clamp, lerp, ease, back } = Proto.U;
  const INK = "#151515", BG = "#efefef";
  const FONT = "'DM Sans', 'Inter', sans-serif", SERIF = "'Fraunces', Georgia, serif";
  const { line, curve, circle } = window.Pizarra.rig;

  /* ---------- dibujos de línea (props) · centrados en (0,0), tamaño s = alto aprox ---------- */
  const PROPS = window.Pizarra.props = Object.assign(window.Pizarra.props || {}, {
    clock(g, s, p, t, k) {
      const r = s / 2, lw = s * 0.028;
      circle(g, 0, 0, r, lw, "#fff"); circle(g, 0, 0, r * 0.86, lw * 0.6);
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; line(g, [[Math.sin(a) * r * 0.72, -Math.cos(a) * r * 0.72], [Math.sin(a) * r * 0.8, -Math.cos(a) * r * 0.8]], lw * 0.7); }
      const spin = p.spin ? (t - k._t0) * p.spin : 0;
      const hm = (p.hour ?? 11.75) + spin;
      const am = (hm % 1) * Math.PI * 2, ah = (hm / 12) * Math.PI * 2;
      line(g, [[0, 0], [Math.sin(ah) * r * 0.45, -Math.cos(ah) * r * 0.45]], lw * 1.1);
      line(g, [[0, 0], [Math.sin(am) * r * 0.66, -Math.cos(am) * r * 0.66]], lw * 0.8);
      circle(g, 0, 0, lw, 0, INK);
    },
    bulb(g, s, p, t) {
      const r = s * 0.3, lw = s * 0.026;
      g.beginPath(); g.arc(0, -s * 0.08, r, Math.PI * 0.8, Math.PI * 2.2); g.lineTo(r * 0.45, s * 0.2); g.lineTo(-r * 0.45, s * 0.2); g.closePath();
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      for (let i = 0; i < 3; i++) line(g, [[-r * 0.42, s * (0.24 + i * 0.05)], [r * 0.42, s * (0.24 + i * 0.05)]], lw);
      curve(g, [-r * 0.3, s * 0.18], [0, -s * 0.2], [r * 0.3, s * 0.18], lw * 0.6);
      const pulse = 1 + 0.08 * Math.sin(t * 8);
      for (let i = 0; i < 7; i++) {
        const a = Math.PI * (0.95 + i * 0.185), r0 = r * 1.25, r1 = r * 1.6 * pulse;
        line(g, [[Math.cos(a) * r0, -s * 0.08 + Math.sin(a) * r0], [Math.cos(a) * r1, -s * 0.08 + Math.sin(a) * r1]], lw * 0.8);
      }
    },
    enigma(g, s, p, t) { // caja de madera abierta: tablero de lámparas, teclado y 3 rotores
      const w = s * 1.25, h = s * 0.62, lw = s * 0.016, top = -h * 0.2;
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = lw * 1.4;
      g.beginPath(); g.moveTo(-w / 2, top); g.lineTo(w / 2, top); g.lineTo(w / 2 + s * 0.06, h * 0.75); g.lineTo(-w / 2 - s * 0.06, h * 0.75); g.closePath(); g.fill(); g.stroke();
      line(g, [[-w / 2 - s * 0.06, h * 0.62], [w / 2 + s * 0.06, h * 0.62]], lw);
      // tapa trasera y rotores
      g.beginPath(); g.rect(-w * 0.42, top - s * 0.36, w * 0.84, s * 0.36); g.fill(); g.stroke();
      for (let i = -1; i <= 1; i++) {
        const cx = i * w * 0.14, cy = top - s * 0.18, rr = s * 0.13, rot = t * (p.spin || 0) * (i + 2);
        g.beginPath(); g.ellipse(cx, cy, rr * 0.45, rr, 0, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.stroke();
        for (let j = 0; j < 6; j++) { const yy = cy + Math.sin(rot + j) * rr * 0.85; line(g, [[cx - rr * 0.4, yy], [cx + rr * 0.4, yy]], lw * 0.6); }
        g.font = `700 ${s * 0.07}px ${FONT}`; g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle";
        g.fillText("ABCDEFGHIJKLMNOPQRSTUVWXYZ"[(Math.floor(rot * 2) + i * 7 + 26 * 9) % 26], cx + rr * 0.8, cy);
      }
      // lámparas y teclas
      const lit = p.lit ? Math.floor(t * 4) % 26 : -1;
      for (let row = 0; row < 3; row++) {
        const n = [9, 8, 9][row];
        for (let i = 0; i < n; i++) {
          const cx = (i - (n - 1) / 2) * w * 0.095, cy = top + h * 0.13 + row * h * 0.11;
          circle(g, cx, cy, s * 0.024, lw * 0.7, row * 9 + i === lit ? "#ffd84a" : "#fff");
          circle(g, cx, cy + h * 0.38, s * 0.026, lw * 0.7, "#fff");
        }
      }
    },
    letter(g, s, p) {
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = s * 0.05;
      g.beginPath(); g.roundRect(-s / 2, -s / 2, s, s, s * 0.12); g.fill(); g.stroke();
      g.font = `800 ${s * 0.62}px ${FONT}`; g.fillStyle = p.color || INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(p.text || "A", 0, s * 0.04);
    },
    rotor(g, s, p, t) {
      const lw = s * 0.03, rot = t * (p.spin || 2);
      g.beginPath(); g.ellipse(0, 0, s * 0.22, s * 0.5, 0, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      for (let j = 0; j < 8; j++) { const yy = Math.sin(rot + j * 0.8) * s * 0.44; if (Math.cos(rot + j * 0.8) > 0) line(g, [[-s * 0.2, yy], [s * 0.2, yy]], lw * 0.7); }
      g.beginPath(); g.ellipse(s * 0.2, 0, s * 0.1, s * 0.5, 0, -Math.PI / 2, Math.PI / 2); g.stroke();
    },
    papers(g, s, p, t, k) { // pila que crece
      const n = Math.round(lerp(p.from ?? 2, p.to ?? 14, ease((t - k._t0) / (p.grow || 3))));
      for (let i = 0; i < n; i++) {
        const y = s * 0.45 - i * s * 0.045, dx = Math.sin(i * 2.3) * s * 0.05, rot = Math.sin(i * 1.7) * 0.06;
        g.save(); g.translate(dx, y); g.rotate(rot);
        g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = s * 0.012;
        g.beginPath(); g.rect(-s * 0.32, -s * 0.03, s * 0.64, s * 0.05); g.fill(); g.stroke();
        g.restore();
      }
    },
    paper(g, s, p) {
      const w = s * 0.72, lw = s * 0.022;
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = lw;
      g.beginPath(); g.rect(-w / 2, -s / 2, w, s); g.fill(); g.stroke();
      for (let i = 0; i < 6; i++) line(g, [[-w * 0.36, -s * 0.34 + i * s * 0.13], [w * (0.36 - (i % 3) * 0.12), -s * 0.34 + i * s * 0.13]], lw * 0.8);
    },
    lock(g, s) {
      const lw = s * 0.05;
      g.beginPath(); g.arc(0, -s * 0.1, s * 0.25, Math.PI, 0); g.strokeStyle = INK; g.lineWidth = lw * 1.4; g.stroke();
      g.beginPath(); g.roundRect(-s * 0.38, -s * 0.1, s * 0.76, s * 0.58, s * 0.06); g.fillStyle = "#fff"; g.fill(); g.lineWidth = lw; g.stroke();
      circle(g, 0, s * 0.13, s * 0.07, 0, INK); line(g, [[0, s * 0.15], [0, s * 0.3]], lw);
    },
    x(g, s) {
      g.font = `800 ${s}px ${FONT}`; g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("X", 0, s * 0.05);
    },
    check(g, s) { line(g, [[-s * 0.4, 0], [-s * 0.1, s * 0.32], [s * 0.45, -s * 0.38]], s * 0.14, "#1f9d47"); },
    arrow(g, s, p, t, k) { // dos ondas y un tramo recto que entra al centro de la punta
      const L = p.len || s * 2, lw = p.w || s * 0.06, col = p.color || INK;
      const prog = ease((t - k._t0) / (p.draw || 0.5));
      const tip = [L / 2, 0], start = [-L / 2, 0];
      const samples = 64;
      const pts = [];
      if (p.curly) {
        const span = tip[0] - start[0];
        const valley = [start[0] + span * 0.29, s * 0.15];
        const crest = [start[0] + span * 0.55, -s * 0.27];
        tip[1] = crest[1];
        const finalDx = tip[0] - crest[0], finalDy = tip[1] - crest[1];
        const segments = [
          [start, [start[0] + span * 0.1, 0], [valley[0] - span * 0.12, valley[1] + s * 0.045], valley],
          [valley, [valley[0] + span * 0.13, valley[1]], [crest[0] - finalDx * 0.22, crest[1] - finalDy * 0.22], crest],
        ];
        const curveSamples = 48;
        for (let i = 0; i <= curveSamples; i++) {
          const phase = (i / curveSamples) * segments.length;
          const seg = Math.min(segments.length - 1, Math.floor(phase));
          const u = phase - seg, v = 1 - u;
          const [a, b, c, d] = segments[seg];
          pts.push([
            v ** 3 * a[0] + 3 * v ** 2 * u * b[0] + 3 * v * u ** 2 * c[0] + u ** 3 * d[0],
            v ** 3 * a[1] + 3 * v ** 2 * u * b[1] + 3 * v * u ** 2 * c[1] + u ** 3 * d[1],
          ]);
        }
        for (let i = 1; i <= samples - curveSamples; i++) {
          const u = i / (samples - curveSamples);
          pts.push([crest[0] + finalDx * u, crest[1] + finalDy * u]);
        }
      } else {
        for (let i = 0; i <= samples; i++) {
          const u = i / samples;
          pts.push([
            start[0] + u * (tip[0] - start[0]),
            -Math.sin(u * Math.PI) * (p.bow || 0) * s,
          ]);
        }
      }
      const visible = pts.slice(0, Math.floor(pts.length * prog) + 1);
      if (visible.length > 1) line(g, visible, lw, col);
      if (prog >= 1) {
        const previous = pts[pts.length - 2];
        const angle = Math.atan2(tip[1] - previous[1], tip[0] - previous[0]);
        const headLen = s * 0.28;
        const wing = a => [tip[0] - Math.cos(angle + a) * headLen, tip[1] - Math.sin(angle + a) * headLen];
        line(g, [wing(-0.5), tip, wing(0.5)], lw, col);
      }
    },
    universe(g, s, p, t) {
      const lw = s * 0.022;
      circle(g, 0, 0, s * 0.28, lw * 1.2, "#fff");
      curve(g, [-s * 0.2, -s * 0.05], [0, s * 0.05], [s * 0.22, -s * 0.12], lw * 0.7);
      g.beginPath(); g.ellipse(0, 0, s * 0.5, s * 0.12, -0.3, Math.PI * 0.05, Math.PI * 0.95); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      for (let i = 0; i < 7; i++) {
        const a = i * 2.4, rr = s * (0.55 + (i % 3) * 0.08), x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.8, z = s * (0.035 + 0.015 * Math.sin(t * 4 + i));
        line(g, [[x - z, y], [x + z, y]], lw * 0.8); line(g, [[x, y - z], [x, y + z]], lw * 0.8);
      }
    },
    envelope(g, s) {
      const w = s * 1.3, lw = s * 0.04;
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = lw;
      g.beginPath(); g.rect(-w / 2, -s / 2, w, s); g.fill(); g.stroke();
      line(g, [[-w / 2, -s / 2], [0, s * 0.08], [w / 2, -s / 2]], lw);
    },
    question(g, s) { g.font = `800 ${s}px ${FONT}`; g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("?", 0, 0); },
    sub(g, s) { // submarino de línea (sin insignias)
      const lw = s * 0.03;
      g.fillStyle = "#fff"; g.strokeStyle = INK; g.lineWidth = lw;
      g.beginPath(); g.ellipse(0, 0, s * 0.9, s * 0.16, 0, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.rect(-s * 0.12, -s * 0.36, s * 0.3, s * 0.22); g.fill(); g.stroke();
      line(g, [[0, -s * 0.36], [0, -s * 0.52], [s * 0.1, -s * 0.52]], lw);
      line(g, [[-s * 1.2, s * 0.24], [s * 1.2, s * 0.24]], lw * 0.6);
    },
  });
})();

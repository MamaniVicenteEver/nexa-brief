/* props/estudio.js · paquete de dibujos de estudio para la pizarra.
 * Cada uno: (g, s, p, t, k) dibujado centrado en (0,0); s = tamaño (alto aprox);
 * k._t0 = cuándo apareció el item. Las animaciones salen solo de t.
 */
(() => {
  "use strict";
  const { clamp, lerp, ease, back } = Proto.U;
  const INK = "#151515", BG = "#efefef";
  const FONT = "'DM Sans', 'Inter', sans-serif";
  const { line, curve, circle } = window.Pizarra.rig;

  function writeText(g, value, x, y, size, maxW, options = {}) {
    const words = String(value || "").trim().split(/\s+/).filter(Boolean);
    if (!words.length) return;
    g.save();
    g.font = (options.weight || 700) + " " + size + "px " + (options.font || FONT);
    g.fillStyle = options.color || INK;
    g.textAlign = options.align || "center";
    g.textBaseline = "middle";
    const rows = [];
    let row = "";
    for (const word of words) {
      const next = row ? row + " " + word : word;
      if (row && g.measureText(next).width > maxW) { rows.push(row); row = word; }
      else row = next;
    }
    if (row) rows.push(row);
    const maxRows = options.maxRows || 3;
    if (rows.length > maxRows) {
      rows.length = maxRows;
      rows[maxRows - 1] = rows[maxRows - 1].replace(/[.,;:]?$/, "…");
    }
    const lineH = size * (options.lineHeight || 1.18);
    rows.forEach((lineText, i) => {
      const width = g.measureText(lineText).width;
      const scale = width > maxW ? maxW / width : 1;
      g.save();
      g.translate(x, y + (i - (rows.length - 1) / 2) * lineH);
      g.scale(scale, 1);
      g.fillText(lineText, 0, 0);
      g.restore();
    });
    g.restore();
  }

  function paper(g, x, y, w, h, lw, fill = "#fff") {
    g.beginPath(); g.rect(x - w / 2, y - h / 2, w, h);
    g.fillStyle = fill; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
  }

  function localTime(t, k) { return Math.max(0, t - (k && isFinite(k._t0) ? k._t0 : 0)); }

  Object.assign(window.Pizarra.props, {
    exam(g, s, p) {
      const lw = s * 0.024, w = s * 0.76, h = s * 0.96, x = -w / 2, y = -h / 2;
      g.beginPath();
      g.moveTo(x, y); g.lineTo(w / 2 - s * 0.1, y); g.lineTo(w / 2, y + s * 0.1);
      g.lineTo(w / 2, h / 2); g.lineTo(x, h / 2); g.closePath();
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      line(g, [[w / 2 - s * 0.1, y], [w / 2 - s * 0.1, y + s * 0.1], [w / 2, y + s * 0.1]], lw * 0.72);
      writeText(g, "EXAMEN", 0, y + s * 0.16, s * 0.105, w * 0.76, { weight: 800 });
      line(g, [[x + s * 0.1, y + s * 0.26], [w / 2 - s * 0.1, y + s * 0.26]], lw * 0.7);
      writeText(g, p.q || "¿Qué recuerdas?", 0, y + s * 0.4, s * 0.095, w * 0.76, { maxRows: 2 });
      for (let i = 0; i < 2; i++) line(g, [[x + s * 0.1, y + s * (0.57 + i * 0.13)], [w / 2 - s * 0.1, y + s * (0.57 + i * 0.13)]], lw * 0.55);
      g.beginPath(); g.rect(x + s * 0.1, y + s * 0.78, s * 0.105, s * 0.105);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.8; g.stroke();
      writeText(g, "RESPUESTA", x + s * 0.39, y + s * 0.83, s * 0.065, s * 0.4, { align: "left", weight: 700 });
    },

    book(g, s, p) {
      const lw = s * 0.026, w = s * 0.92, h = s * 0.7;
      if (p.open) {
        const top = -h * 0.48, bottom = h * 0.5;
        g.beginPath(); g.moveTo(0, top + s * 0.06); g.quadraticCurveTo(-w * 0.32, top - s * 0.02, -w / 2, top + s * 0.08);
        g.lineTo(-w / 2, bottom); g.quadraticCurveTo(-w * 0.22, bottom - s * 0.08, 0, bottom);
        g.quadraticCurveTo(w * 0.22, bottom - s * 0.08, w / 2, bottom); g.lineTo(w / 2, top + s * 0.08);
        g.quadraticCurveTo(w * 0.32, top - s * 0.02, 0, top + s * 0.06); g.closePath();
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
        curve(g, [0, top + s * 0.06], [s * 0.035, 0], [0, bottom], lw * 0.8);
        writeText(g, p.title || "IDEAS", -w * 0.25, top + s * 0.19, s * 0.09, w * 0.36, { weight: 800, maxRows: 1 });
        for (let side of [-1, 1]) for (let i = 0; i < 3; i++) {
          const yy = top + s * (0.29 + i * 0.115), inset = s * (0.1 + (i % 2) * 0.04);
          line(g, [[side < 0 ? -w / 2 + inset : s * 0.08, yy], [side < 0 ? -s * 0.08 : w / 2 - inset, yy]], lw * 0.56);
        }
      } else {
        g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, s * 0.045);
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 1.25; g.stroke();
        g.beginPath(); g.rect(-w / 2, -h / 2, s * 0.14, h);
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.75; g.stroke();
        line(g, [[-w / 2 + s * 0.18, -h / 2 + s * 0.1], [w / 2 - s * 0.08, -h / 2 + s * 0.1]], lw * 0.5);
        writeText(g, p.title || "ESTUDIO", s * 0.08, 0, s * 0.105, w * 0.62, { weight: 800, maxRows: 2 });
      }
    },

    card(g, s, p, t, k) {
      const a = localTime(t, k), flipAt = p.flipAt == null ? null : Math.max(0, +p.flipAt);
      const phase = flipAt == null ? 0 : clamp((a - (flipAt - 0.3)) / 0.6);
      const showBack = flipAt != null && phase >= 0.5;
      const squash = flipAt == null ? 1 : Math.max(0.035, Math.abs(Math.cos(Math.PI * phase)));
      g.save(); g.scale(squash, 1);
      const w = s * 1.24, h = s * 0.78, lw = s * 0.025;
      g.beginPath(); g.roundRect(-w / 2, -h / 2, w, h, s * 0.065);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      line(g, [[-w * 0.36, -h * 0.21], [w * 0.36, -h * 0.21]], lw * 0.55);
      writeText(g, showBack ? (p.back || "REVERSO") : (p.text || "¿Lo recuerdas?"), 0, s * 0.08, s * 0.115, w * 0.76, { weight: 700, maxRows: 2 });
      g.restore();
    },

    brain(g, s, p, t) {
      const lw = s * 0.026, glow = !!p.glow;
      if (glow) {
        const pulse = 0.72 + 0.28 * Math.sin(t * 5);
        for (let i = 0; i < 8; i++) {
          const a = i * Math.PI / 4, r0 = s * 0.37, r1 = s * (0.48 + 0.06 * pulse);
          line(g, [[Math.cos(a) * r0, Math.sin(a) * r0], [Math.cos(a) * r1, Math.sin(a) * r1]], lw * 0.72);
        }
      }
      g.beginPath();
      g.moveTo(0, s * 0.29); g.bezierCurveTo(-s * 0.13, s * 0.37, -s * 0.25, s * 0.27, -s * 0.25, s * 0.13);
      g.bezierCurveTo(-s * 0.39, s * 0.04, -s * 0.32, -s * 0.11, -s * 0.23, -s * 0.15);
      g.bezierCurveTo(-s * 0.27, -s * 0.32, -s * 0.09, -s * 0.37, 0, -s * 0.25);
      g.bezierCurveTo(s * 0.11, -s * 0.39, s * 0.3, -s * 0.27, s * 0.26, -s * 0.13);
      g.bezierCurveTo(s * 0.4, -s * 0.05, s * 0.32, s * 0.12, s * 0.23, s * 0.16);
      g.bezierCurveTo(s * 0.25, s * 0.32, s * 0.08, s * 0.36, 0, s * 0.29);
      g.closePath(); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      line(g, [[0, -s * 0.25], [0, s * 0.29]], lw * 0.7);
      curve(g, [-s * 0.18, -s * 0.17], [-s * 0.06, -s * 0.24], [-s * 0.13, -s * 0.06], lw * 0.68);
      curve(g, [-s * 0.13, -s * 0.06], [-s * 0.04, s * 0.01], [-s * 0.19, s * 0.08], lw * 0.68);
      curve(g, [-s * 0.18, s * 0.08], [-s * 0.08, s * 0.14], [-s * 0.11, s * 0.25], lw * 0.68);
      curve(g, [s * 0.16, -s * 0.18], [s * 0.06, -s * 0.1], [s * 0.2, -s * 0.04], lw * 0.68);
      curve(g, [s * 0.2, -s * 0.04], [s * 0.08, s * 0.04], [s * 0.17, s * 0.11], lw * 0.68);
      curve(g, [s * 0.17, s * 0.11], [s * 0.05, s * 0.17], [s * 0.11, s * 0.25], lw * 0.68);
    },

    eye(g, s, p, t, k) {
      const a = localTime(t, k), cycle = a % 3.1;
      const blink = cycle < 0.08 ? cycle / 0.08 : cycle < 0.17 ? (0.17 - cycle) / 0.09 : 0;
      const lw = s * 0.027, rx = s * 0.39, ry = s * 0.25;
      g.save(); g.scale(1, Math.max(0.06, 1 - blink * 0.94));
      g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      circle(g, s * 0.055, 0, s * 0.112, lw * 0.55, "#fff");
      circle(g, s * 0.075, 0, s * 0.052, 0, INK);
      g.restore();
      for (let i = 0; i < 5; i++) {
        const x = -s * 0.28 + i * s * 0.14, y = -ry + Math.abs(x) * 0.2;
        line(g, [[x, y], [x - s * 0.045, y - s * (0.08 + (i % 2) * 0.02)]], lw * 0.72);
      }
      if (blink > 0.72) curve(g, [-rx, 0], [0, s * 0.04], [rx, 0], lw * 0.95);
    },

    hourglass(g, s, p, t, k) {
      const a = localTime(t, k), dur = Math.max(0.2, p.dur || 5), flow = clamp(a / dur);
      const top = -s * 0.4, neck = s * 0.03, bottom = s * 0.4, half = s * 0.3, lw = s * 0.026;
      g.beginPath(); g.moveTo(-half, top); g.lineTo(half, top); g.bezierCurveTo(half * 0.86, -s * 0.21, s * 0.06, -s * 0.09, 0, neck);
      g.bezierCurveTo(-s * 0.06, s * 0.16, half * 0.86, s * 0.22, half, bottom); g.lineTo(-half, bottom);
      g.bezierCurveTo(-half * 0.86, s * 0.22, -s * 0.06, s * 0.16, 0, neck);
      g.bezierCurveTo(s * 0.06, -s * 0.09, -half * 0.86, -s * 0.21, -half, top); g.closePath();
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      line(g, [[-half - s * 0.045, top], [half + s * 0.045, top]], lw * 1.25);
      line(g, [[-half - s * 0.045, bottom], [half + s * 0.045, bottom]], lw * 1.25);
      const remaining = 1 - flow, sandTop = -s * 0.31 + flow * s * 0.25;
      if (remaining > 0.02) {
        const sw = s * 0.23 * remaining;
        g.beginPath(); g.moveTo(-sw, sandTop); g.lineTo(sw, sandTop); g.lineTo(s * 0.025, neck); g.lineTo(-s * 0.025, neck); g.closePath();
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.45; g.stroke();
      }
      if (flow < 0.98) line(g, [[0, neck], [0, neck + s * 0.18]], lw * 0.8);
      const pile = flow * s * 0.29;
      if (pile > s * 0.012) {
        g.beginPath(); g.moveTo(-pile, bottom - s * 0.025); g.lineTo(pile, bottom - s * 0.025); g.lineTo(0, bottom - s * 0.025 - pile * 0.55); g.closePath();
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.45; g.stroke();
      }
    },

    curve(g, s, p, t, k) {
      const a = localTime(t, k), duration = Math.max(0.2, p.draw || 1.5), progress = clamp(a / duration);
      const flat = clamp(p.flat == null ? 0.6 : p.flat), n = Math.max(0, Math.floor(p.points == null ? 4 : p.points));
      const lw = s * 0.025, left = -s * 0.42, right = s * 0.42, top = -s * 0.4, bottom = s * 0.39;
      line(g, [[left, bottom], [right, bottom]], lw);
      line(g, [[left, bottom], [left, top]], lw);
      line(g, [[right - s * 0.08, bottom - s * 0.035], [right, bottom], [right - s * 0.08, bottom + s * 0.035]], lw * 0.8);
      line(g, [[left - s * 0.035, top + s * 0.08], [left, top], [left + s * 0.035, top + s * 0.08]], lw * 0.8);
      const shape = u => {
        const rate = 2.4 + flat * 8.5, v = (1 - Math.exp(-rate * u)) / (1 - Math.exp(-rate));
        return [left + (right - left) * u, top + s * 0.06 + (bottom - top - s * 0.12) * v];
      };
      const pts = [];
      const count = 48, visible = Math.floor(progress * count);
      for (let i = 0; i <= visible; i++) pts.push(shape(i / count));
      if (pts.length > 1) line(g, pts, lw * 1.15);
      for (let i = 0; i < n; i++) {
        if (a < duration + i * 0.18) continue;
        const pt = shape((i + 1) / (n + 1));
        circle(g, pt[0], pt[1], s * 0.034, lw * 0.45, "#fff");
      }
      if (p.labels) {
        writeText(g, "tiempo", right, bottom + s * 0.1, s * 0.075, s * 0.5, { align: "right", maxRows: 1 });
        g.save(); g.translate(left - s * 0.11, 0); g.rotate(-Math.PI / 2);
        writeText(g, "recuerdo", 0, 0, s * 0.075, s * 0.54, { maxRows: 1 }); g.restore();
      }
    },

    calendar(g, s, p, t, k) {
      const a = localTime(t, k), days = Math.max(1, Math.min(7, Math.round(p.days || 7)));
      const marks = Array.isArray(p.marks) ? p.marks.map(Number).sort((x, y) => x - y) : [];
      const markAt = Math.max(0.05, p.markAt || 0.3), w = s * 0.86, h = s * 0.74, x = -w / 2, y = -h / 2, lw = s * 0.023;
      paper(g, 0, 0, w, h, lw);
      g.beginPath(); g.rect(x, y, w, s * 0.17); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      writeText(g, "SEMANA", 0, y + s * 0.085, s * 0.09, w * 0.7, { weight: 800, maxRows: 1 });
      const cellW = w / 7, cellH = (h - s * 0.2) / 2, daysTxt = ["L", "M", "X", "J", "V", "S", "D"];
      for (let i = 0; i < 7; i++) {
        const cx = x + cellW * (i + 0.5), cy = y + s * 0.17 + cellH * 0.5;
        writeText(g, daysTxt[i], cx, cy, s * 0.07, cellW * 0.8, { maxRows: 1 });
        g.beginPath(); g.rect(x + i * cellW, y + s * 0.17, cellW, cellH); g.strokeStyle = INK; g.lineWidth = lw * 0.45; g.stroke();
        const cy2 = cy + cellH;
        g.beginPath(); g.rect(x + i * cellW, y + s * 0.17 + cellH, cellW, cellH); g.stroke();
        if (i < days) writeText(g, String(i + 1), cx, cy2, s * 0.075, cellW * 0.8, { maxRows: 1 });
        const mIndex = marks.indexOf(i);
        if (mIndex >= 0 && a >= mIndex * markAt) {
          const r = Math.min(cellW, cellH) * 0.32;
          g.beginPath(); g.arc(cx, cy2, r, -0.45, Math.PI * 1.55); g.strokeStyle = INK; g.lineWidth = lw * 0.9; g.stroke();
        }
      }
    },

    bubble(g, s, p) {
      const w = s * 1.34, h = s * 0.78, r = s * 0.12, lw = s * 0.026;
      const isThought = p.kind === "thought", tailSide = p.tail === "right" ? 1 : -1, tx = tailSide * w * 0.28;
      g.beginPath(); g.moveTo(-w / 2 + r, -h / 2); g.lineTo(w / 2 - r, -h / 2);
      g.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r); g.lineTo(w / 2, h / 2 - r);
      g.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
      if (!isThought) { g.lineTo(tx + s * 0.1, h / 2); g.lineTo(tx + tailSide * s * 0.16, h * 0.79); g.lineTo(tx - s * 0.1, h / 2); }
      g.lineTo(-w / 2 + r, h / 2); g.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
      g.lineTo(-w / 2, -h / 2 + r); g.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2); g.closePath();
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      if (isThought) {
        const bx = tailSide * w * 0.25;
        circle(g, bx, h * 0.62, s * 0.052, lw * 0.7, "#fff");
        circle(g, bx + tailSide * s * 0.12, h * 0.78, s * 0.03, lw * 0.65, "#fff");
      }
      writeText(g, p.text || "Lo recuerdo", 0, 0, s * 0.115, w * 0.77, { weight: 700, maxRows: 2 });
    },

    magnifier(g, s, p, t, k) {
      const a = localTime(t, k), angle = Math.sin(a * 2.1) * 0.08, lw = s * 0.03;
      g.save(); g.rotate(angle);
      const cx = -s * 0.1, cy = -s * 0.1, r = s * 0.29;
      line(g, [[cx + r * 0.67, cy + r * 0.67], [s * 0.39, s * 0.39]], s * 0.11, INK);
      line(g, [[cx + r * 0.67, cy + r * 0.67], [s * 0.39, s * 0.39]], s * 0.055, "#fff");
      circle(g, cx, cy, r, lw, "#fff");
      curve(g, [cx - s * 0.13, cy - s * 0.12], [cx - s * 0.06, cy - s * 0.25], [cx + s * 0.08, cy - s * 0.2], lw * 0.55);
      g.restore();
    },

    plant(g, s, p) {
      const lw = s * 0.025;
      // Sol y rayos de luz.
      circle(g, s * 0.33, -s * 0.31, s * 0.105, lw * 0.7, "#fff");
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4, x = s * 0.33, y = -s * 0.31;
        line(g, [[x + Math.cos(a) * s * 0.15, y + Math.sin(a) * s * 0.15], [x + Math.cos(a) * s * 0.21, y + Math.sin(a) * s * 0.21]], lw * 0.7);
      }
      // Tallo y hojas.
      line(g, [[0, s * 0.21], [0, -s * 0.25]], lw * 1.1);
      const leaf = (x, y, rot) => {
        g.save(); g.translate(x, y); g.rotate(rot);
        g.beginPath(); g.ellipse(0, 0, s * 0.18, s * 0.085, 0, 0, Math.PI * 2);
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.78; g.stroke();
        line(g, [[-s * 0.12, 0], [s * 0.13, 0]], lw * 0.48); g.restore();
      };
      leaf(-s * 0.14, -s * 0.11, -0.48); leaf(s * 0.14, -s * 0.23, 0.48); leaf(-s * 0.13, s * 0.04, -0.48);
      g.beginPath(); g.moveTo(-s * 0.29, s * 0.2); g.lineTo(s * 0.29, s * 0.2); g.lineTo(s * 0.21, s * 0.49);
      g.lineTo(-s * 0.21, s * 0.49); g.closePath(); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      line(g, [[-s * 0.31, s * 0.2], [s * 0.31, s * 0.2]], lw * 1.2);
      line(g, [[s * 0.4, -s * 0.12], [s * 0.52, -s * 0.12]], lw * 0.7);
      line(g, [[s * 0.49, -s * 0.16], [s * 0.53, -s * 0.12], [s * 0.49, -s * 0.08]], lw * 0.7);
      line(g, [[-s * 0.52, -s * 0.24], [-s * 0.4, -s * 0.24]], lw * 0.7);
      line(g, [[-s * 0.44, -s * 0.28], [-s * 0.4, -s * 0.24], [-s * 0.44, -s * 0.2]], lw * 0.7);
    },

    puzzle(g, s, p, t, k) {
      const a = localTime(t, k), joinAt = Math.max(0, p.joinAt || 1.4), phase = ease(a / joinAt);
      const w = s * 0.48, h = s * 0.42, gap = s * 0.68, lw = s * 0.025;
      const piece = (cx, leftTab, rightTab) => {
        g.save(); g.translate(cx, 0); g.beginPath(); g.moveTo(-w / 2, -h / 2); g.lineTo(w / 2, -h / 2); g.lineTo(w / 2, -h * 0.17);
        if (rightTab) g.bezierCurveTo(w / 2 + h * 0.24, -h * 0.17, w / 2 + h * 0.24, h * 0.17, w / 2, h * 0.17);
        else g.lineTo(w / 2, h * 0.17);
        g.lineTo(w / 2, h / 2); g.lineTo(-w / 2, h / 2); g.lineTo(-w / 2, h * 0.17);
        if (leftTab) g.bezierCurveTo(-w / 2 + h * 0.24, h * 0.17, -w / 2 + h * 0.24, -h * 0.17, -w / 2, -h * 0.17);
        else g.lineTo(-w / 2, -h * 0.17);
        g.closePath(); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); g.restore();
      };
      const shift = gap * (1 - phase);
      piece(-gap + shift, false, true);
      piece(0, true, true);
      piece(gap - shift, true, false);
      if (p.pieces === 2) return;
    },

    star(g, s, p, t, k) {
      const a = localTime(t, k), pop = 1 + 0.12 * Math.sin(Math.min(1, a / 0.45) * Math.PI);
      g.save(); g.scale(pop, pop);
      const outer = s * 0.42, inner = s * 0.19;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const a0 = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? inner : outer;
        const x = Math.cos(a0) * r, y = Math.sin(a0) * r;
        if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.closePath(); g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = s * 0.03; g.stroke();
      if (a < 0.65) for (let i = 0; i < 6; i++) {
        const a0 = i * Math.PI / 3, r0 = outer * 1.18, r1 = outer * (1.4 + (1 - a / 0.65) * 0.2);
        line(g, [[Math.cos(a0) * r0, Math.sin(a0) * r0], [Math.cos(a0) * r1, Math.sin(a0) * r1]], s * 0.021);
      }
      g.restore();
    },

    bed(g, s, p, t, k) {
      const a = localTime(t, k), lw = s * 0.026, x0 = -s * 0.45, x1 = s * 0.45, y = s * 0.2;
      // Cabecera, colchón, almohada, patas y manta.
      line(g, [[x0, -s * 0.1], [x0, s * 0.36], [x1, s * 0.36], [x1, s * 0.02]], lw * 1.2);
      g.beginPath(); g.moveTo(x0, s * 0.04); g.lineTo(x1, s * 0.04); g.lineTo(x1, y); g.lineTo(x0, y); g.closePath();
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      g.beginPath(); g.roundRect(-s * 0.34, -s * 0.015, s * 0.21, s * 0.18, s * 0.04);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.8; g.stroke();
      curve(g, [-s * 0.1, s * 0.04], [s * 0.02, -s * 0.04], [s * 0.23, s * 0.04], lw * 0.7);
      line(g, [[-s * 0.35, y], [-s * 0.35, s * 0.39]], lw);
      line(g, [[s * 0.35, y], [s * 0.35, s * 0.39]], lw);
      for (let i = 0; i < 3; i++) {
        const rise = (a * 24 + i * s * 0.29) % (s * 0.86), alpha = clamp(1 - rise / (s * 0.86));
        g.save(); g.globalAlpha *= alpha;
        writeText(g, i === 0 ? "z" : "Z", s * (0.08 + i * 0.11), -s * 0.16 - rise, s * (i === 0 ? 0.12 : 0.16), s * 0.24, { maxRows: 1 });
        g.restore();
      }
    },

    moon(g, s, p, t) {
      const lw = s * 0.026;
      g.beginPath(); g.arc(-s * 0.03, 0, s * 0.34, -Math.PI * 0.65, Math.PI * 0.65, false);
      g.quadraticCurveTo(s * 0.2, s * 0.1, s * 0.16, -s * 0.3);
      g.quadraticCurveTo(s * 0.02, -s * 0.38, -s * 0.03, -s * 0.34);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      const stars = [[s * 0.38, -s * 0.28], [s * 0.42, s * 0.12], [-s * 0.34, s * 0.34]];
      stars.forEach((v, i) => {
        const r = s * (0.04 + 0.012 * Math.sin(t * 3 + i));
        line(g, [[v[0] - r, v[1]], [v[0] + r, v[1]]], lw * 0.7);
        line(g, [[v[0], v[1] - r], [v[0], v[1] + r]], lw * 0.7);
      });
    },

    syllables(g, s, p) {
      const items = Array.isArray(p.items) && p.items.length ? p.items : ["DAX", "BUP", "ZOL"];
      const n = items.length, gap = s * 0.055, h = s * 0.48, w = Math.min(s * 0.58, (s * 1.45 - gap * (n - 1)) / n);
      const total = n * w + (n - 1) * gap, lw = s * 0.024;
      items.forEach((word, i) => {
        const x = -total / 2 + i * (w + gap);
        g.beginPath(); g.roundRect(x, -h / 2, w, h, s * 0.035);
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
        writeText(g, word, x + w / 2, 0, Math.min(s * 0.16, w * 0.35), w * 0.82, { weight: 800, maxRows: 1 });
      });
    },

    percent(g, s, p, t, k) {
      const a = localTime(t, k), strikeAt = p.strike == null ? Infinity : Math.max(0, +p.strike);
      g.font = "800 " + (s * 0.72) + "px " + FONT; g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "middle";
      const value = p.text || "%";
      g.fillText(value, 0, s * 0.03);
      if (a >= strikeAt) {
        const progress = clamp((a - strikeAt) / 0.28), w = s * 0.83 * progress, y = -s * 0.06;
        line(g, [[-w / 2, y + s * 0.25], [w / 2, y - s * 0.25]], s * 0.045, "#d2453a");
      }
    },

    scientist(g, s, p) {
      const lw = s * 0.025;
      // Busto, cuello y chaqueta.
      g.beginPath(); g.moveTo(-s * 0.38, s * 0.42); g.quadraticCurveTo(-s * 0.31, s * 0.12, -s * 0.08, s * 0.1);
      g.lineTo(s * 0.12, s * 0.1); g.quadraticCurveTo(s * 0.39, s * 0.2, s * 0.42, s * 0.42); g.closePath();
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      line(g, [[-s * 0.1, s * 0.12], [0, s * 0.3], [s * 0.1, s * 0.12]], lw * 0.7);
      line(g, [[-s * 0.22, s * 0.19], [-s * 0.09, s * 0.42]], lw * 0.65);
      line(g, [[s * 0.22, s * 0.19], [s * 0.09, s * 0.42]], lw * 0.65);
      // Perfil mirando a la derecha: frente, nariz y barba.
      g.beginPath(); g.moveTo(-s * 0.13, s * 0.12); g.lineTo(-s * 0.18, -s * 0.03);
      g.quadraticCurveTo(-s * 0.25, -s * 0.28, -s * 0.03, -s * 0.39);
      g.quadraticCurveTo(s * 0.2, -s * 0.43, s * 0.24, -s * 0.22);
      g.lineTo(s * 0.29, -s * 0.12); g.lineTo(s * 0.39, -s * 0.07);
      g.lineTo(s * 0.29, -s * 0.01); g.quadraticCurveTo(s * 0.3, s * 0.12, s * 0.12, s * 0.2);
      g.lineTo(-s * 0.13, s * 0.12); g.closePath();
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke();
      // Cabello y patilla.
      curve(g, [-s * 0.18, -s * 0.1], [-s * 0.29, -s * 0.29], [-s * 0.08, -s * 0.4], lw * 1.1);
      curve(g, [-s * 0.08, -s * 0.4], [s * 0.12, -s * 0.49], [s * 0.22, -s * 0.26], lw * 1.1);
      line(g, [[-s * 0.15, -s * 0.12], [-s * 0.12, s * 0.03]], lw * 0.9);
      // Anteojo de perfil.
      g.beginPath(); g.ellipse(s * 0.12, -s * 0.13, s * 0.1, s * 0.075, 0, 0, Math.PI * 2);
      g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw * 0.78; g.stroke();
      line(g, [[s * 0.22, -s * 0.13], [s * 0.3, -s * 0.12]], lw * 0.75);
      line(g, [[s * 0.02, -s * 0.13], [-s * 0.1, -s * 0.14]], lw * 0.75);
      // Barba y bigote.
      curve(g, [-s * 0.11, s * 0.03], [-s * 0.11, s * 0.23], [s * 0.1, s * 0.3], lw * 1.15);
      curve(g, [s * 0.1, s * 0.3], [s * 0.29, s * 0.22], [s * 0.29, s * 0.06], lw * 1.15);
      curve(g, [s * 0.1, -s * 0.015], [s * 0.19, s * 0.02], [s * 0.28, -s * 0.01], lw * 0.9);
      line(g, [[s * 0.09, s * 0.29], [s * 0.06, s * 0.18]], lw * 0.48);
      line(g, [[s * 0.17, s * 0.27], [s * 0.16, s * 0.16]], lw * 0.48);
      line(g, [[s * 0.24, s * 0.22], [s * 0.24, s * 0.13]], lw * 0.48);
    },

    columns(g, s, p) {
      const w = s * 1.55, h = s * 0.78, lw = s * 0.025;
      line(g, [[0, -h / 2], [0, h / 2]], lw * 0.9);
      line(g, [[-w / 2, -h * 0.25], [w / 2, -h * 0.25]], lw * 0.65);
      for (const side of [-1, 1]) {
        const cx = side * w * 0.25;
        writeText(g, side < 0 ? (p.left || "ANTES") : (p.right || "DESPUÉS"), cx, -h * 0.37, s * 0.1, w * 0.43, { weight: 800, maxRows: 1 });
        for (let i = 0; i < 3; i++) {
          const len = s * (0.42 - (i % 2) * 0.07), yy = -h * 0.04 + i * s * 0.17;
          line(g, [[cx - len / 2, yy], [cx + len / 2, yy]], lw * 0.62);
        }
      }
      line(g, [[-w / 2, h / 2], [w / 2, h / 2]], lw * 0.6);
    },

    pile(g, s, p, t, k) {
      const a = localTime(t, k), n = Math.max(3, Math.min(30, Math.round(p.n || 12)));
      const target = clamp(p.split == null ? 0 : p.split), splitAt = p.splitAt;
      const split = splitAt == null ? target : target * ease((a - Math.max(0, +splitAt)) / 0.8);
      const w = s * 0.54, gap = s * 0.08, step = s * 0.026, lw = s * 0.012;
      for (let i = n - 1; i >= 0; i--) {
        const group = i % 3, level = Math.floor(i / 3);
        const finalX = (group - 1) * (w + gap), x = lerp(0, finalX, split);
        const y = s * 0.31 - (level + (1 - split) * (n - 1 - i)) * step;
        g.save(); g.translate(x, y); g.rotate(Math.sin(i * 1.7) * 0.018);
        g.beginPath(); g.rect(-w / 2, -step * 0.38, w, step * 0.76);
        g.fillStyle = "#fff"; g.fill(); g.strokeStyle = INK; g.lineWidth = lw; g.stroke(); g.restore();
      }
    },
  });
})();

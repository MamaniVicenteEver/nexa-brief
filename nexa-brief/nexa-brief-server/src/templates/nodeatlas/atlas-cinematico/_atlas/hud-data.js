/* Datos del noticiero Original. Preparación por escena; dibujo puro desde t. */
export const DATA_TYPES = new Set(['bar-compare', 'line-series', 'delta', 'ranking', 'stacked-bar', 'ticker']);
const clamp = x => Math.max(0, Math.min(1, x));
const ease = x => 1 - (1 - clamp(x)) ** 3;
const mix = (a, b, p) => a + (b - a) * p;
const rowsOf = l => l.bars || l.items || l.parts || [];

export function prepareData(items, { T, flagSource }) {
  const prepared = new Map(), sources = new Set();
  let needsLibrary = false;
  for (const l of items.filter(l => DATA_TYPES.has(l.type))) {
    const start = T(l.t, 0), states = [{ ...l, at: start }];
    for (const step of [...(l.steps || [])].sort((a, b) => T(a.t, start) - T(b.t, start)))
      states.push({ ...states.at(-1), ...step, at: T(step.t, start) });
    for (const state of states) {
      const decimals = state.decimals ?? (l.type === 'delta' || l.type === 'ticker' ? 1 : 0);
      const options = { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: 'always' };
      try {
        state.fmt = new Intl.NumberFormat(state.locale || 'es-ES', options);
        state.signed = new Intl.NumberFormat(state.locale || 'es-ES', { ...options, signDisplay: 'exceptZero' });
      } catch {
        state.fmt = new Intl.NumberFormat('es-ES', { ...options, minimumFractionDigits: 0, maximumFractionDigits: 1 });
        state.signed = new Intl.NumberFormat('es-ES', { signDisplay: 'exceptZero', maximumFractionDigits: 1 });
      }
      if (l.type === 'ranking') for (const row of rowsOf(state)) {
        if (row.flag) sources.add(flagSource({ code: row.flag }));
        if (row.icon) needsLibrary = true;
      }
      if (l.type === 'line-series') state.lines = (state.series || []).map(s => ({ ...s, points: (s.points || []).map((p, i) =>
        Array.isArray(p) ? { x: p[0], y: p[1], label: state.fmt.format(p[0]) } : { x: i, y: p.value, label: p.label }) }));
    }
    prepared.set(l, states);
  }

  function draw(l, tm, { g, t, view, u, S, text, measure, up, anchor, rrect, col, theme, fontOf, image, drawIcon }) {
    const states = prepared.get(l);
    let index = 0;
    for (let i = 1; i < states.length; i++) if (states[i].at <= t) index = i;
    const s = states[index], prev = index ? states[index - 1] : null;
    const elapsed = t - s.at, count = Math.max(.001, s.count ?? 1.1), stagger = s.stagger ?? .12;
    const progress = i => ease((elapsed - i * stagger) / count);
    const rows = rowsOf(s), n = rows.length, w = Math.max(360, l.width ?? 900), pad = 30, inner = w - pad * 2;
    const titleH = s.title ? 54 : 0, size = l.type === 'delta' ? (l.labelSize ?? 30) : (l.size ?? 30);
    const heights = { 'bar-compare': l.orientation === 'vertical' ? 430 : 46 + n * 80,
      'line-series': 490, delta: 208, ranking: 34 + n * 86, 'stacked-bar': 170 + n * 40,
      ticker: 38 + Math.ceil(n / (view.W < view.H ? 2 : 3)) * 124 };
    const h = heights[l.type] + titleH, margin = Math.min(view.W, view.H) * .035;
    const fit = Math.min(1, (view.W - margin * 2) / S(w), (view.H * .8 - margin * 2) / S(h));
    const a = anchor({ ...l, y: l.y ?? (l.type === 'ticker' ? .69 : .44) }, view, u);
    if (!a) return;
    // El panel completo queda dentro del cuadro y por encima de los subtítulos.
    const halfW = S(w) * fit / 2, halfH = S(h) * fit / 2;
    const cx = Math.max(margin + halfW, Math.min(view.W - margin - halfW, a.x));
    const cy = Math.max(margin + halfH, Math.min(view.H * .8 - margin - halfH, a.y));
    const reveal = ease(tm.el / tm.dur);
    g.translate(cx, cy); g.scale(fit, fit); g.globalAlpha *= reveal;
    const box = (x, y, width, height, fill, radius = 6) => { rrect(g, S(x), S(y), S(width), S(height), S(radius)); g.fillStyle = col(fill); g.fill(); };
    box(-w / 2, -h / 2, w, h, theme.colors.panel);
    rrect(g, -S(w / 2), -S(h / 2), S(w), S(h), S(6));
    g.strokeStyle = col(l.color || 'blue'); g.lineWidth = S(1.2); g.stroke();
    const left = -w / 2 + pad, top = -h / 2 + pad;
    const fitText = (str, width, fs, o) => {
      str = String(str ?? '');
      if (measure(str, fs, o) <= S(width)) return str;
      let lo = 0, hi = str.length;
      while (lo < hi) { const mid = Math.ceil((lo + hi) / 2); if (measure(str.slice(0, mid) + '…', fs, o) <= S(width)) lo = mid; else hi = mid - 1; }
      return lo || measure('…', fs, o) <= S(width) ? str.slice(0, lo) + '…' : '';
    };
    const label = (str, x, y, width, fs = size, opts = {}) => {
      const o = { color: col(l.color || 'white'), shadow: false, ...opts };
      text(fitText(str, width, fs, o), S(x), S(y), fs, o);
    };
    const number = (v, x, y, width, opts = {}) => label(v, x, y, width, size + 4, { font: fontOf(l, 'num'), ...opts });
    const fmt = v => s.fmt.format(Math.abs(v) < .0000001 ? 0 : v);
    const value = (row, v) => fmt(v) + ((row.unit ?? s.unit) ? ' ' + (row.unit ?? s.unit) : '');
    const oldValue = (row, field = 'value') => rowsOf(prev || {}).find(r => (r.label ?? r.name) === (row.label ?? row.name))?.[field] ?? 0;
    const signColor = v => col(v === 0 ? 'dim' : ((v > 0) === (s.good !== 'down') ? 'green' : 'red'));
    const rule = (x1, y1, x2, y2, color = 'dim') => { g.beginPath(); g.moveTo(S(x1), S(y1)); g.lineTo(S(x2), S(y2)); g.strokeStyle = col(color); g.lineWidth = S(1.4); g.stroke(); };
    if (s.title) label(up(s.title), left, top + 8, inner, size, { color: col('white') });
    const y0 = top + titleH;

    if (l.type === 'bar-compare') {
      const max = s.max ?? (Math.max(0, ...rows.map(r => r.value), ...rowsOf(prev || {}).map(r => r.value)) || 1);
      const vertical = l.orientation === 'vertical';
      rows.forEach((r, i) => {
        const p = progress(i), v = mix(oldValue(r), r.value, p), highlighted = !s.highlight || s.highlight === r.label;
        const c = col(r.color || l.color || 'blue');
        g.save(); g.globalAlpha *= p * (highlighted ? 1 : .38);
        if (vertical) {
          const cell = inner / Math.max(1, n), bw = cell * .56, x = left + cell * (i + .5), base = y0 + 290, bh = 220 * clamp(v / max);
          box(x - bw / 2, base - 220, bw, 220, 'rgba(255,255,255,.06)');
          if (bh > 0) box(x - bw / 2, base - bh, bw, bh, c);
          number(value(r, v), x, base - bh - 24, cell - 12, { align: 'center', color: c });
          label(up(r.label), x, base + 36, cell - 12, size, { align: 'center', color: col('white') });
        } else {
          const y = y0 + i * 80 + 10;
          label(up(r.label), left, y, inner * .60, size, { color: col('white') });
          number(value(r, v), left + inner, y, inner * .38, { align: 'right', color: c });
          box(left, y + 26, inner, 18, 'rgba(255,255,255,.06)');
          const length = inner * clamp(v / max);
          if (length > 0) box(left, y + 26, length, 18, c);
        }
        g.restore();
      });
    } else if (l.type === 'delta') {
      const v = mix(prev?.value ?? s.from ?? 0, s.value ?? 0, progress(0)), c = l.color ? col(l.color) : signColor(s.value);
      const dir = s.value < 0 ? 1 : -1, x = left + 24, y = y0 + 76;
      rule(x, y - dir * 24, x, y + dir * 24, c);
      rule(x - 14, y + dir * 8, x, y + dir * 24, c); rule(x + 14, y + dir * 8, x, y + dir * 24, c);
      label(up(s.label || ''), left, y0 + 4, inner, l.labelSize ?? 30, { color: col('white') });
      label(s.signed.format(v) + (s.unit ? ' ' + s.unit : ''), left + 76, y, inner - 76, l.size ?? 76, { font: fontOf(l, 'num'), color: c });
      if (s.period) label(up(s.period), left, y0 + 142, inner, (l.labelSize ?? 30) - 4, { color: col('dim') });
    } else if (l.type === 'ranking') {
      rows.forEach((r, i) => {
        const p = progress(i), y = y0 + i * 86 + 18 + (1 - p) * 24, c = col(r.color || l.color || 'white');
        g.save(); g.globalAlpha *= p;
        number(String(i + 1).padStart(2, '0'), left, y, 52, { color: col('dim') });
        let nameX = left + 70;
        if (r.flag || r.icon) {
          const im = r.flag ? image(flagSource({ code: r.flag })) : null;
          if (im) g.drawImage(im, S(nameX), S(y - 18), S(48), S(36));
          else if (r.icon) { g.save(); g.translate(S(nameX + 24), S(y)); g.scale(S(20), S(20)); g.strokeStyle = c; g.fillStyle = c; g.lineWidth = .14; drawIcon(g, r.icon); g.restore(); }
          nameX += 66;
        }
        const valWidth = inner * .30;
        label(up(r.name ?? r.label), nameX, y, left + inner - valWidth - nameX - 18, size, { color: c });
        number(value(r, mix(oldValue(r), r.value, p)), left + inner, y, valWidth, { align: 'right', color: c });
        rule(left, y + 36, left + inner, y + 36, 'rgba(255,255,255,.12)');
        g.restore();
      });
    } else if (l.type === 'stacked-bar') {
      const vals = rows.map((r, i) => mix(oldValue(r), r.value, progress(i)));
      const sum = Math.max(rows.reduce((a, b) => a + b.value, 0), vals.reduce((a, b) => a + b, 0));
      const total = s.total ?? rows.reduce((a, b) => a + b.value, 0);
      number('TOTAL ' + value({}, total), left + inner, y0 + 4, inner, { align: 'right', color: col('white') });
      let x = left;
      rows.forEach((r, i) => {
        const width = sum ? inner * vals[i] / sum : 0, c = col(r.color || l.color || 'blue');
        if (width > 0) box(x, y0 + 38, width, 54, c, 0);
        const inside = value(r, vals[i]);
        if (width > 16 && measure(inside, size, { font: fontOf(l, 'num') }) < S(width - 16))
          label(inside, x + width / 2, y0 + 65, width - 16, size, { align: 'center', color: '#fff', font: fontOf(l, 'num') });
        x += width;
        // Leyenda en filas: las partes pequeñas nunca compiten por espacio.
        box(left, y0 + 121 + i * 40, 12, 12, c, 2);
        label(up(r.label), left + 26, y0 + 127 + i * 40, inner * .65 - 26, size - 3, { color: col('white') });
        number(value(r, vals[i]), left + inner, y0 + 127 + i * 40, inner * .32, { align: 'right', color: c });
      });
    } else if (l.type === 'ticker') {
      const cols = view.W < view.H ? 2 : 3, cell = inner / cols;
      rows.forEach((r, i) => {
        const p = progress(i), x = left + (i % cols) * cell, y = y0 + Math.floor(i / cols) * 124 + (1 - p) * 16;
        g.save(); g.globalAlpha *= p;
        label(up(r.label), x, y + 4, cell - 24, size - 4, { color: col('dim') });
        number(value(r, mix(oldValue(r), r.value, p)), x, y + 43, cell - 24, { color: col('white') });
        number(s.signed.format(mix(oldValue(r, 'change'), r.change ?? 0, p)) + ' %', x, y + 81, cell - 24, { color: signColor(r.change ?? 0) });
        g.restore();
      });
    } else if (l.type === 'line-series') {
      const lines = s.lines || [], all = lines.flatMap(s => s.points), xs = all.map(p => p.x), ys = all.map(p => p.y);
      if (!all.length) return;
      const xmin = Math.min(...xs), xmax = Math.max(...xs) === xmin ? xmin + 1 : Math.max(...xs);
      const ymin = s.min ?? Math.min(...ys), ymax = (s.max ?? Math.max(...ys)) === ymin ? ymin + 1 : (s.max ?? Math.max(...ys));
      const plotX = left + 110, plotW = inner - 140, plotY = y0 + 52, plotH = 202;
      const X = x => plotX + (x - xmin) / (xmax - xmin) * plotW, Y = y => plotY + plotH * (1 - (y - ymin) / (ymax - ymin));
      rule(plotX, plotY, plotX, plotY + plotH); rule(plotX, plotY + plotH, plotX + plotW, plotY + plotH);
      number(fmt(ymax), plotX - 16, plotY, 94, { align: 'right', color: col('dim') });
      number(fmt(ymin), plotX - 16, plotY + plotH, 94, { align: 'right', color: col('dim') });
      label(all[0].label, plotX, plotY + plotH + 28, plotW * .45, size - 6, { color: col('dim') });
      label(lines[0].points.at(-1).label, plotX + plotW, plotY + plotH + 28, plotW * .45, size - 6, { align: 'right', color: col('dim') });
      lines.forEach((line, i) => {
        const p = progress(i), points = line.points, c = col(line.color || ['blue', 'yellow', 'green'][i]);
        if (!points.length) return;
        const edge = xmin + (xmax - xmin) * p;
        g.beginPath(); g.moveTo(S(X(points[0].x)), S(Y(points[0].y)));
        for (let j = 1; j < points.length; j++) {
          const a = points[j - 1], b = points[j];
          if (edge < a.x) break;
          const k = clamp((edge - a.x) / Math.max(.000001, b.x - a.x));
          g.lineTo(S(X(mix(a.x, b.x, k))), S(Y(mix(a.y, b.y, k))));
          if (k < 1) break;
        }
        g.strokeStyle = c; g.lineWidth = S(4); g.stroke();
        // Últimos valores en filas separadas incluso cuando las series coinciden.
        const y = y0 + 330 + i * 34, final = points.at(-1);
        label(up(line.label || 'SERIE ' + (i + 1)), left, y, inner * .57, size - 4, { color: c });
        number(p === 1 ? value({}, final.y) : '…', left + inner, y, inner * .4, { align: 'right', color: c });
        if (p === 1) { g.beginPath(); g.arc(S(X(final.x)), S(Y(final.y)), S(5), 0, Math.PI * 2); g.fillStyle = c; g.fill(); }
      });
      const m = s.marker;
      if (m && t >= T(m.t, s.at)) {
        const point = all.find(p => p.label === m.label), x = X(m.x ?? point?.x ?? xmin);
        if (x >= plotX && x <= plotX + plotW) {
          g.setLineDash([S(5), S(5)]); rule(x, plotY, x, plotY + plotH, m.color || 'white'); g.setLineDash([]);
          label(up(m.text ?? m.label ?? ''), Math.max(plotX, Math.min(plotX + plotW - 200, x + 8)), plotY - 26, Math.min(200, plotW), size - 6, { color: col(m.color || 'white') });
        }
      }
    }
  }
  return { sources: [...sources], needsLibrary, draw };
}

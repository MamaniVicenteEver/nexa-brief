/* layers.js · todo lo que se dibuja SOBRE el mapa (registro de tipos: Mapas.layers.<tipo>).
 *
 * Cada capa de scene.layers: { type, t (aparece), out? (se va), fade?, fadeOut?, …propios }.
 * Posiciones (at, pts) aceptan lugares por nombre (geo.place). Regiones (region) por nombre (geo.region).
 * Para agregar un tipo nuevo: Mapas.layers.miTipo = (c, L, t, a) => { … } — c = { g, st, P, cam, geo, img, U }.
 *
 * Tipos: fill · line (arrow) · label (tag | big | sea) · flag (badge | pole) · photo · year · big ·
 *        dot · crowd · pin · icon (battle | anchor | mine | star)
 */
(() => {
  "use strict";
  const { clamp, lerp, back, rgba, mixW, ease } = Proto.U;
  const FONT = "Montserrat, 'Arial Black', sans-serif";
  const L = {};
  const pathCaches = new WeakMap();

  function cachePath(c, kind, key, make) {
    let frame = pathCaches.get(c.P);
    if (!frame) { frame = { region: new WeakMap(), geo: new WeakMap(), poly: new WeakMap() }; pathCaches.set(c.P, frame); }
    const cache = frame[kind];
    if (!cache.has(key)) cache.set(key, make());
    return cache.get(key);
  }
  function geoPath2d(c, key, features) {
    return cachePath(c, "geo", key, () => {
      const path = new Path2D();
      const ctx = new Proxy(path, { get(target, prop) {
        if (prop === "beginPath") return () => {};
        const value = Reflect.get(target, prop, target);
        return typeof value === "function" ? value.bind(target) : value;
      } });
      const gp = d3.geoPath(c.P, ctx);
      for (const f of [].concat(features)) gp(f);
      return path;
    });
  }
  function makePolyPath(pts) {
    const path = new Path2D();
    pts.forEach((p, i) => (i ? path.lineTo(p[0], p[1]) : path.moveTo(p[0], p[1])));
    path.closePath();
    return path;
  }
  function clipPoly(c, key, pts) { return cachePath(c, "poly", key, () => makePolyPath(pts)); }

  /* ---------- trazado de regiones ---------- */
  function pathRegion(c, R) {
    return cachePath(c, "region", R, () => R.poly ? makePolyPath(R.poly.map(c.P)) : geoPath2d(c, R.feats, R.feats));
  }
  /** recorte "dentro de": los países de `within` o, si no hay, toda la tierra firme */
  function clipLand(c, R) { const source = R && R.within ? R.within : c.geo.land; c.g.clip(geoPath2d(c, source, source)); }
  function strokeLand(c, R) { const source = R.within || c.geo.coast; c.g.stroke(geoPath2d(c, source, source)); }
  function clipRegion(c, R) {
    if (R.land) clipLand(c, R);
    c.g.clip(pathRegion(c, R));
    for (const cut of R.clips) c.g.clip(clipPoly(c, cut, cut.map(c.P)));
  }
  /** contorno = borde del país dentro del recorte + línea de recorte dentro del país */
  function strokeRegion(c, R) {
    const g = c.g;
    if (R.land) { // borde = lados del polígono sobre tierra + la costa dentro del polígono
      g.save(); clipLand(c, R); g.stroke(pathRegion(c, R)); g.restore();
      g.save(); g.clip(pathRegion(c, R)); strokeLand(c, R); g.restore();
      return;
    }
    g.save(); for (const cut of R.clips) g.clip(clipPoly(c, cut, cut.map(c.P))); g.stroke(pathRegion(c, R)); g.restore();
    for (const cut of R.clips) { g.save(); g.clip(pathRegion(c, R)); g.stroke(clipPoly(c, cut, cut.map(c.P))); g.restore(); }
  }
  function hatch(c, col, t, a, angle = 1) {
    const { g, st } = c, U = st.U;
    g.save(); g.globalAlpha *= a; g.strokeStyle = col; g.lineWidth = 7 * U;
    const step = 22 * U, off = (t * 18 * U) % step, H = st.H, W = st.W;
    g.beginPath(); for (let x = -H + off; x < W + H; x += step) { g.moveTo(x, 0); g.lineTo(x + H * 0.8 * angle, H); } g.stroke(); g.restore();
  }

  /* ---------- país / región marcada ---------- */
  L.fill = (c, Ly, t, a) => {
    const { g, st, geo } = c, U = st.U, R = geo.region(Ly.region);
    const col = Ly.color || "#e3122a", light = Ly.border || mixW(col, 0.6);
    let flick = 1;
    if (Ly._flicker != null && t > Ly._flicker && t < Ly._flicker + 0.9) flick = 0.35 + 0.65 * (Math.sin((t - Ly._flicker) * 47) > 0 ? 1 : 0.2);
    const flash = 1 + 0.9 * Math.max(0, 1 - (t - Ly._t) / 0.5);           // destello al marcarse
    const strength = Ly.strength ?? 1;
    g.save(); clipRegion(c, R);
    g.globalAlpha = a * flick * strength;
    g.globalCompositeOperation = "multiply"; g.fillStyle = mixW(col, 0.25); g.fillRect(0, 0, st.W, st.H);
    g.globalCompositeOperation = "screen"; g.fillStyle = rgba(col, 0.5 * Math.min(1.6, flash)); g.fillRect(0, 0, st.W, st.H);
    g.globalCompositeOperation = "overlay"; g.fillStyle = rgba(col, 0.35); g.fillRect(0, 0, st.W, st.H);
    g.globalCompositeOperation = "source-over";
    if (Ly.hatch) hatch(c, Ly.hatch === true ? "#ffffff" : Ly.hatch, t, 0.55);
    if (Ly.border !== false) { // resplandor interior del borde
      g.strokeStyle = light; g.lineWidth = 4 * U; g.shadowColor = light; g.shadowBlur = 26 * U; g.globalAlpha = a * 0.85 * flick;
      strokeRegion(c, R); strokeRegion(c, R);
    }
    g.restore();
    if (Ly.border === false) return;
    g.save(); g.globalAlpha = a * flick; g.strokeStyle = light; g.lineJoin = "round";
    g.shadowColor = col; g.shadowBlur = 18 * U; g.lineWidth = 3.2 * U; strokeRegion(c, R);
    g.shadowBlur = 0; g.strokeStyle = mixW(col, 0.85); g.lineWidth = 1.3 * U; strokeRegion(c, R);
    g.restore();
  };

  /* ---------- líneas, fronteras, rutas y flechas ---------- */
  function smoothPts(pts, n = 16) {
    if (pts.length < 3) return pts;
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      for (let j = 0; j < n; j++) { const u = j / n, u2 = u * u, u3 = u2 * u;
        out.push([0, 1].map(d => 0.5 * (2 * p1[d] + (-p0[d] + p2[d]) * u + (2 * p0[d] - 5 * p1[d] + 4 * p2[d] - p3[d]) * u2 + (-p0[d] + 3 * p1[d] - 3 * p2[d] + p3[d]) * u3))); }
    }
    out.push(pts[pts.length - 1]); return out;
  }
  function partial(pts, k) {
    if (k >= 1) return pts;
    let tot = 0; for (let i = 1; i < pts.length; i++) tot += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let left = tot * k; const out = [pts[0]];
    for (let i = 1; i < pts.length && left > 0; i++) {
      const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (d <= left) { out.push(pts[i]); left -= d; } else { const u = left / d; out.push([lerp(pts[i - 1][0], pts[i][0], u), lerp(pts[i - 1][1], pts[i][1], u)]); left = 0; }
    }
    return out;
  }
  /** curva entre dos lugares que se arquea (bow = cuánto, en fracción de la distancia) */
  function bowPts(a, b, bow) {
    const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = b[0] - a[0], dy = b[1] - a[1];
    const cx = mx - dy * bow, cy = my + dx * bow, out = [];
    for (let i = 0; i <= 24; i++) { const u = i / 24; out.push([(1 - u) * (1 - u) * a[0] + 2 * u * (1 - u) * cx + u * u * b[0], (1 - u) * (1 - u) * a[1] + 2 * u * (1 - u) * cy + u * u * b[1]]); }
    return out;
  }
  L.line = (c, Ly, t, a) => {
    const { g, st, P, geo } = c, U = st.U, col = Ly.color || "#ffe14a";
    const k = ease((t - Ly._t) / (Ly.draw ?? 1.2));
    let pts = (Ly.pts || [Ly.from, Ly.to]).map(q => P(geo.place(q)));
    if (Ly.closed) pts.push(pts[0]);
    if (Ly.bow && pts.length === 2) pts = bowPts(pts[0], pts[1], Ly.bow);
    else if (Ly.smooth !== false) pts = smoothPts(pts);
    pts = partial(pts, k);
    if (pts.length < 2) return;
    const w = (Ly.w || 3.2) * U;
    g.save(); g.globalAlpha = a; g.lineCap = "round"; g.lineJoin = "round";
    if (Ly.dash) g.setLineDash([w * 3, w * 2.4]);
    g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])));
    g.strokeStyle = col; g.shadowColor = col; g.shadowBlur = 20 * U; g.lineWidth = w * 1.6; g.stroke();
    g.shadowBlur = 0; g.strokeStyle = mixW(col, 0.75); g.lineWidth = w * 0.55; g.stroke();
    g.setLineDash([]);
    if (Ly.arrow && k > 0.04) {
      const b = pts[pts.length - 1], a2 = pts[Math.max(0, pts.length - 4)], ang = Math.atan2(b[1] - a2[1], b[0] - a2[0]), hl = (Ly.head || 26) * U;
      g.beginPath(); g.moveTo(b[0] + Math.cos(ang) * hl * 0.5, b[1] + Math.sin(ang) * hl * 0.5);
      g.lineTo(b[0] + Math.cos(ang + 2.5) * hl, b[1] + Math.sin(ang + 2.5) * hl); g.lineTo(b[0] + Math.cos(ang - 2.5) * hl, b[1] + Math.sin(ang - 2.5) * hl); g.closePath();
      g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 16 * U; g.fill();
    }
    g.restore();
  };
  L.arrow = (c, Ly, t, a) => L.line(c, { ...Ly, arrow: true, bow: Ly.bow ?? 0.18 }, t, a);

  /* ---------- rótulos ---------- */
  function tag(c, text, x, y, size, rot, a, style, col) {
    const g = c.g;
    g.save(); g.translate(x, y); g.rotate(((rot || 0) * Math.PI) / 180); g.globalAlpha = a;
    g.textAlign = "center"; g.textBaseline = "middle";
    if (style === "big") { // nombre grande blanco en cursiva pesada
      g.font = `italic 900 ${size}px ${FONT}`;
      g.shadowColor = "rgba(0,0,0,.7)"; g.shadowBlur = size * 0.25; g.shadowOffsetY = size * 0.06;
      g.lineWidth = size * 0.08; g.strokeStyle = "rgba(0,0,0,.55)";
      String(text).split("\n").forEach((ln, i, A) => { const yy = (i - (A.length - 1) / 2) * size; g.strokeText(ln, 0, yy); g.fillStyle = col || "#fff"; g.fillText(ln, 0, yy); });
    } else if (style === "sea") { // océanos: cursiva azul con brillo
      g.font = `italic 800 ${size}px ${FONT}`; g.shadowColor = "#3aa0ff"; g.shadowBlur = size * 0.7; g.fillStyle = col || "#8fd0ff";
      String(text).split("\n").forEach((ln, i, A) => g.fillText(ln, 0, (i - (A.length - 1) / 2) * size * 1.05));
    } else { // rótulo negro con letra blanca (el de la referencia)
      g.font = `800 ${size}px ${FONT}`;
      const w = g.measureText(text).width + size * 0.7, h = size * 1.45;
      g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = size * 0.5; g.fillStyle = "rgba(8,8,10,.92)"; g.fillRect(-w / 2, -h / 2, w, h);
      g.shadowBlur = 0; g.fillStyle = col || "#fff"; g.fillText(text, 0, size * 0.04);
    }
    g.restore();
  }
  const pop = (Ly, t) => lerp(0.3, 1, back((t - Ly._t) / 0.45));
  const zscale = (c, Ly) => (Ly.mapScale ? clamp(Ly.mapScale / c.cam.span, 0.4, 3.2) : 1);
  const xy = (c, Ly) => (Ly.at != null ? c.P(c.geo.place(Ly.at)) : [c.st.W / 2, c.st.H / 2]);
  L.label = (c, Ly, t, a) => { const [x, y] = xy(c, Ly); tag(c, Ly.text, x + (Ly.dx || 0) * c.st.U, y + (Ly.dy || 0) * c.st.U, (Ly.size || 30) * c.st.U * zscale(c, Ly) * pop(Ly, t), Ly.rot, a, Ly.style, Ly.color); };

  /* ---------- puntos, multitudes, alfileres, íconos ---------- */
  L.dot = (c, Ly, t, a) => {
    const { g, st } = c, U = st.U, [x, y] = xy(c, Ly), col = Ly.color || "#7dff6a", r = (Ly.r || 9) * U, p = 1 + 0.25 * Math.sin((t - Ly._t) * 6);
    g.save(); g.globalAlpha = a; g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 30 * U;
    g.beginPath(); g.arc(x, y, r * p, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0; g.fillStyle = "#fff"; g.beginPath(); g.arc(x, y, r * 0.45, 0, Math.PI * 2); g.fill();
    const rk = ((t - Ly._t) % 1.4) / 1.4; g.strokeStyle = col; g.lineWidth = 2.5 * U; g.globalAlpha = a * (1 - rk);
    g.beginPath(); g.arc(x, y, r * (1 + rk * 3.5), 0, Math.PI * 2); g.stroke(); g.restore();
  };
  L.pin = (c, Ly, t, a) => { // ciudad o puerto: punto blanco con halo + nombre al costado
    const { g, st } = c, U = st.U, [x, y] = xy(c, Ly), s = pop(Ly, t), col = Ly.color || "#ffffff";
    g.save(); g.globalAlpha = a; g.fillStyle = col; g.shadowColor = Ly.glow || "#5fd0ff"; g.shadowBlur = 18 * U;
    g.beginPath(); g.arc(x, y, 7 * U * s, 0, Math.PI * 2); g.fill(); g.lineWidth = 2.5 * U; g.strokeStyle = "#000"; g.shadowBlur = 0; g.stroke(); g.restore();
    if (Ly.text !== "") {
      const side = Ly.side || "right", size = (Ly.size || 24) * U * zscale(c, Ly), off = 14 * U + size * 0.2;
      c.g.save(); c.g.font = `800 ${size}px ${FONT}`; const w = c.g.measureText(Ly.text || Ly.at).width + size * 0.7; c.g.restore();
      const dx = side === "left" ? -(off + w / 2) : side === "right" ? off + w / 2 : 0, dy = side === "top" ? -size * 1.4 : side === "bottom" ? size * 1.4 : 0;
      tag(c, Ly.text || String(Ly.at).toUpperCase(), x + dx, y + dy, size * s, 0, a, "tag");
    }
  };
  L.crowd = (c, Ly, t, a) => {
    const { g, st } = c, U = st.U, [x, y] = xy(c, Ly), n = Ly.n || 40, col = Ly.color || "#ffd84a";
    g.save(); g.fillStyle = col; g.shadowColor = col; g.shadowBlur = 8 * U;
    for (let i = 0; i < n; i++) {
      const ti = Ly._t + (i / n) * (Ly.spread ?? 1.2); if (t < ti) continue;
      const ang = i * 2.399, rr = Math.sqrt((i + 0.5) / n) * (Ly.radius || 60) * U, jx = Math.sin(t * 2 + i) * 2 * U;
      g.globalAlpha = a * clamp((t - ti) / 0.2);
      g.beginPath(); g.arc(x + Math.cos(ang) * rr + jx, y + Math.sin(ang) * rr * 0.8, (Ly.dotR || 4.2) * U, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  };
  const ICONS = {
    battle(g, s) { // dos sables cruzados
      for (const sg of [1, -1]) { g.save(); g.rotate(sg * 0.78); g.fillRect(-s * 0.05, -s * 0.5, s * 0.1, s * 0.78); g.fillRect(-s * 0.2, s * 0.24, s * 0.4, s * 0.08); g.fillRect(-s * 0.05, s * 0.3, s * 0.1, s * 0.2); g.restore(); }
    },
    anchor(g, s) {
      g.lineWidth = s * 0.1; g.lineCap = "round"; g.beginPath(); g.arc(0, -s * 0.36, s * 0.1, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(0, -s * 0.26); g.lineTo(0, s * 0.42); g.moveTo(-s * 0.22, -s * 0.1); g.lineTo(s * 0.22, -s * 0.1); g.stroke();
      g.beginPath(); g.arc(0, s * 0.05, s * 0.38, Math.PI * 0.15, Math.PI * 0.85); g.stroke();
    },
    mine(g, s) { // pico de minero (salitre, plata)
      g.lineWidth = s * 0.1; g.lineCap = "round"; g.beginPath(); g.moveTo(-s * 0.3, s * 0.42); g.lineTo(s * 0.18, -s * 0.2); g.stroke();
      g.beginPath(); g.moveTo(-s * 0.2, -s * 0.38); g.quadraticCurveTo(s * 0.2, -s * 0.4, s * 0.42, -s * 0.02); g.stroke();
    },
    star(g, s) { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.22 : s * 0.5, an = -Math.PI / 2 + (i * Math.PI) / 5; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.closePath(); g.fill(); },
  };
  L.icon = (c, Ly, t, a) => { // ícono en un medallón oscuro con brillo
    const { g, st } = c, U = st.U, [x, y] = xy(c, Ly), s = (Ly.size || 54) * U * pop(Ly, t), col = Ly.color || "#ffd21a";
    g.save(); g.globalAlpha = a; g.translate(x, y);
    g.shadowColor = col; g.shadowBlur = 22 * U; g.fillStyle = "rgba(10,10,14,.9)"; g.beginPath(); g.arc(0, 0, s * 0.62, 0, Math.PI * 2); g.fill();
    g.shadowBlur = 0; g.strokeStyle = col; g.lineWidth = 3 * U; g.stroke();
    g.fillStyle = col; g.strokeStyle = col; (ICONS[Ly.icon] || ICONS.star)(g, s * 0.8);
    g.restore();
    if (Ly.text) tag(c, Ly.text, x, y + s * 0.95, 20 * U, 0, a);
  };

  /* ---------- banderas, fotos, año, cifra ---------- */
  L.flag = (c, Ly, t, a) => {
    const { g, st } = c, U = st.U, [x, y] = xy(c, Ly), s = pop(Ly, t), F = Mapas.flags;
    g.save(); g.globalAlpha = a;
    if (Ly.style === "pole") {
      const fw = (Ly.size || 90) * U * s, fh = fw * 0.62;
      g.fillStyle = "rgba(0,0,0,.45)"; g.beginPath(); g.ellipse(x + fw * 0.35, y + 3 * U, fw * 0.45, fh * 0.12, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "#d8d8d8"; g.fillRect(x - 2 * U, y - fw * 1.25, 4 * U, fw * 1.25);
      g.shadowColor = "rgba(0,0,0,.5)"; g.shadowBlur = 12 * U; F.draw(g, Ly.flag, x + 2 * U, y - fw * 1.25, fw, fh, 1, t);
    } else F.badge(g, Ly.flag, x, y, (Ly.size || 34) * U * s);
    g.restore();
  };
  L.photo = (c, Ly, t, a) => {
    const { g, st } = c, U = st.U, [x, y] = xy(c, Ly), im = c.img(Ly.src), r = (Ly.size || 70) * U * pop(Ly, t);
    g.save(); g.globalAlpha = a; g.shadowColor = "rgba(0,0,0,.6)"; g.shadowBlur = r * 0.4;
    g.beginPath(); g.arc(x, y, r * 1.08, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.shadowBlur = 0;
    if (im) { g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip(); g.filter = Ly.gray === false ? "none" : "grayscale(.2) contrast(1.1)";
      const sc = Math.max((2 * r) / im.width, (2 * r) / im.height), f = Ly.focus || [0.5, 0.4];
      g.drawImage(im, x - im.width * sc * f[0], y - im.height * sc * f[1], im.width * sc, im.height * sc); g.restore(); }
    g.restore();
    if (Ly.name) tag(c, Ly.name, x, y + r * 1.3, 20 * U, 0, a);
  };
  L.year = (c, Ly, t, a) => { // pastilla del año (abajo, como "1903")
    const { g, st } = c, U = st.U, s = pop(Ly, t), size = (Ly.size || 58) * U * s, y = st.H * (Ly.y ?? (st.H > st.W ? 0.7 : 0.72));
    g.save(); g.globalAlpha = a; g.font = `900 ${size}px ${FONT}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.shadowColor = Ly.color || "#ff1f3d"; g.shadowBlur = size * 0.5; g.lineWidth = size * 0.14; g.strokeStyle = Ly.color || "#c4001d";
    g.strokeText(Ly.text, st.W / 2, y); g.shadowBlur = 0; g.fillStyle = "#fff"; g.fillText(Ly.text, st.W / 2, y); g.restore();
  };
  L.big = (c, Ly, t, a) => { // cifra grande en el centro, con el mapa oscurecido
    const { g, st } = c, U = st.U;
    g.save(); g.globalAlpha = a * 0.55; g.fillStyle = "#000"; g.fillRect(0, 0, st.W, st.H); g.restore();
    const size = (Ly.size || 230) * U * pop(Ly, t);
    tag(c, Ly.text, st.W / 2, st.H * 0.44, size, 0, a, "big", Ly.color);
    const nl = String(Ly.text).split("\n").length;                   // título de varios renglones: baja el subtítulo
    if (Ly.sub) tag(c, Ly.sub, st.W / 2, st.H * 0.44 + size * (nl / 2 + 0.3), 30 * U, 0, a);
  };

  window.Mapas = window.Mapas || {};
  window.Mapas.layers = L;
  window.Mapas.draw = { tag, hatch, strokeRegion, clipRegion, pathRegion, ICONS };
})();

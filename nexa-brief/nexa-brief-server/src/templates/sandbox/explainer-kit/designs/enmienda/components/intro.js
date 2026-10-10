/* =============================================================================
   enmienda · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = el Muro de noche (losas, torre, reflectores, gente bloqueando) +
             titular gigante que golpea palabra por palabra; el muro se raja.
   introv2 = expediente: mapa del país con cuadrícula, mira que se fija en la
             ciudad, la pregunta se tipea y un sello golpea encima.
   Escenarios compartidos en Kit.enm.scene (wall, crowd, country, world) para
   que el cierre (outro.js) use el mismo lenguaje.
   Todo es función pura de lt (render cuadro a cuadro con seek).
   ========================================================================== */
(function () {
  const K = Kit, E = Kit.enm, { clamp, lerp, prog, ease } = K;
  const INK = "#ebe6dc", DARK = "#141210";

  /* ------------------------------------------------------------ geografía */
  function ne(lon, lat) {                         /* Natural Earth I */
    const l = lat * Math.PI / 180, l2 = l * l, l4 = l2 * l2;
    return [lon * Math.PI / 180 * (0.8707 - 0.131979 * l2 + l4 * (-0.013791 + l4 * (0.003971 * l2 - 0.001529 * l4))), -l * (1.007226 + l2 * (0.015085 + l4 * (-0.044475 + 0.028874 * l2 - 0.005916 * l4)))];
  }
  function bbox(rings, P) { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; rings.forEach(r => { for (let i = 0; i < r.length; i += 2) { const [x, y] = P(r[i], r[i + 1]); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }); return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 }; }
  function fitP(P, bb, box, mode = "contain") {
    const s = (mode === "cover" ? Math.max : Math.min)(box.w / bb.w, box.h / bb.h), ox = box.x + (box.w - bb.w * s) / 2 - bb.x0 * s, oy = box.y + (box.h - bb.h * s) / 2 - bb.y0 * s;
    const f = (lo, la) => { const [x, y] = P(lo, la); return [ox + x * s, oy + y * s]; }; f.s = s; return f;
  }
  function pathOf(rings, P) {
    const p = new Path2D();
    rings.forEach(r => {
      let off = 0, prev = r[0];
      for (let i = 0; i < r.length; i += 2) {
        if (i) { const d = r[i] - prev; if (d < -180) off += 360; else if (d > 180) off -= 360; }
        prev = r[i]; const [x, y] = P(r[i] + off, r[i + 1]); i ? p.lineTo(x, y) : p.moveTo(x, y);
      }
      p.closePath();
    });
    return p;
  }

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → [[{w, acc}]] (renglones de palabras; ^x^ = palabra en cartulina) */
  function words(text) {
    return String(text ?? "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const out = []; let acc = false, buf = "", spaced = true;
      /* glue = va pegada a la anterior sin espacio ("^MURO^?" → el "?" no se separa) */
      const flush = () => { if (buf) { out.push({ w: buf.toUpperCase(), acc, glue: !spaced && out.length > 0 }); buf = ""; spaced = false; } };
      for (const ch of line) {
        if (ch === "^") { flush(); acc = !acc; }
        else if (/\s/.test(ch)) { flush(); spaced = true; }
        else buf += ch;
      }
      flush();
      return out;
    });
  }
  /** sacudida de cámara: suma de golpes que decaen (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.32) a += Math.pow(1 - d / 0.32, 2); }
    return [Math.sin(lt * 93) * amp * a, Math.cos(lt * 71) * amp * a * 0.8];
  }
  /** rótulo chico extendido con dos filetes (aparece parpadeando) */
  function kicker(G, str, cx, y, size, a, align = "center") {
    if (!str || a <= 0) return;
    G.save(); G.globalAlpha = a; G.font = E.font("wide", size, 800); G.letterSpacing = (size * 0.32) + "px";
    G.fillStyle = "#e9e6e0"; G.textAlign = align; G.textBaseline = "middle";
    const s = String(str).toUpperCase(), w = G.measureText(s).width;
    G.fillText(s, cx, y);
    G.fillStyle = "rgba(233,230,224,.55)";
    const rw = size * 3, gap = size * 1.1, lx = align === "left" ? cx : cx - w / 2;
    if (align === "center") G.fillRect(lx - gap - rw, y - 0.5, rw, Math.max(1, size * 0.08));
    G.fillRect(lx + w + gap - size * 0.3, y - 0.5, rw, Math.max(1, size * 0.08));
    G.restore();
  }
  /** encendido con parpadeo (luz de reflector que arranca) */
  const ignite = (lt, at, dur) => { const q = prog(lt, at, dur, "linear"); return q >= 1 ? 1 : q * (0.55 + 0.45 * K.rng(Math.floor(lt * 24) + 3)()); };

  /* ================================================================ escenarios */
  /** capa fija del Muro (losas con tubo, manchas, grafiti, suelo) cacheada por tamaño */
  function wallLayer(W, H, portrait, seed) {
    return E.memo(`enm-wall:${W | 0}:${H | 0}:${seed}`, () => {
      const T = E.mk(W, H, 1.25), g = T.g, r = K.rng(seed);
      const yT = H * (portrait ? 0.43 : 0.33), yB = H * (portrait ? 0.79 : 0.86), hw = yB - yT;
      const sw = Math.min(hw * 0.36, W * (portrait ? 0.24 : 0.12)), ph = sw * 0.3, off = r() * sw;
      /* suelo (franja de la muerte) */
      const gg = g.createLinearGradient(0, yB, 0, H); gg.addColorStop(0, "#2a2826"); gg.addColorStop(1, "#070707");
      g.fillStyle = gg; g.fillRect(0, yB, W, H - yB);
      const paperT = E.paper(seed + 3, 1024, 640, 170), grT = E.grunge(seed + 5);
      for (let x = -off, i = 0; x < W + sw; x += sw, i++) {
        const tone = 128 + r() * 22;
        const lg = g.createLinearGradient(0, yT, 0, yB);
        lg.addColorStop(0, `rgb(${tone + 14},${tone + 12},${tone + 8})`); lg.addColorStop(1, `rgb(${tone - 30},${tone - 31},${tone - 33})`);
        g.save(); g.beginPath(); g.rect(x, yT, sw, hw); g.clip();
        g.fillStyle = lg; g.fillRect(x, yT, sw, hw);
        g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.65; g.drawImage(paperT, r() * 400, r() * 200, sw * 1.2, hw * 0.9, x, yT, sw, hw);
        g.globalCompositeOperation = "source-over"; g.globalAlpha = 0.42; E.pattern(g, grT, x, yT, sw, hw, 0.6 + r() * 0.5);
        /* chorreados de lluvia */
        g.globalAlpha = 1;
        for (let k = 0; k < 7; k++) { const dx = x + r() * sw, l = hw * (0.15 + r() * 0.55); const sg = g.createLinearGradient(0, yT, 0, yT + l); sg.addColorStop(0, "rgba(0,0,0,.28)"); sg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = sg; g.fillRect(dx, yT, sw * (0.01 + r() * 0.03), l); }
        g.restore();
        /* junta entre losas */
        g.fillStyle = "rgba(0,0,0,.65)"; g.fillRect(x - sw * 0.012, yT, sw * 0.024, hw);
        g.fillStyle = "rgba(255,255,255,.08)"; g.fillRect(x + sw * 0.012, yT, sw * 0.01, hw);
        /* grafiti (trazos secos) */
        if (r() < 0.55) {
          const n = 2 + (r() * 3 | 0), cy = yT + hw * (0.35 + r() * 0.4), pts = [];
          for (let k = 0; k <= n * 3; k++) pts.push([x + sw * 0.1 + (k / (n * 3)) * sw * 0.8, cy + (r() - 0.5) * hw * 0.22]);
          E.brush(g, pts, 1, { width: sw * 0.05, color: r() < 0.5 ? "#1a1918" : "#d9d3c7", alpha: 0.32, seed: seed + i, hairs: 6 });
        }
      }
      /* tubo redondeado arriba (Mauer 75) */
      const pg = g.createLinearGradient(0, yT - ph, 0, yT);
      pg.addColorStop(0, "#4c4a47"); pg.addColorStop(0.35, "#b7b2aa"); pg.addColorStop(0.7, "#8a8680"); pg.addColorStop(1, "#3c3a38");
      g.fillStyle = pg; g.beginPath(); g.roundRect ? g.roundRect(-10, yT - ph, W + 20, ph * 1.05, ph / 2) : g.rect(-10, yT - ph, W + 20, ph); g.fill();
      g.globalAlpha = 0.35; E.pattern(g, grT, 0, yT - ph, W, ph, 0.5); g.globalAlpha = 1;
      for (let x = -off; x < W + sw; x += sw * 1.5) { g.fillStyle = "rgba(0,0,0,.45)"; g.fillRect(x, yT - ph, Math.max(1, sw * 0.012), ph); }
      /* sombra de contacto */
      const cg = g.createLinearGradient(0, yB - hw * 0.12, 0, yB); cg.addColorStop(0, "rgba(0,0,0,0)"); cg.addColorStop(1, "rgba(0,0,0,.55)");
      g.fillStyle = cg; g.fillRect(0, yB - hw * 0.12, W, hw * 0.12);
      return { c: T.c, yT, yB, hw, sw, ph };
    });
  }
  /** grieta precalculada (x en función de y) */
  function crackPts(W, L, seed, portrait) {
    /* en 16:9 el titular tapa el centro: la grieta va a la derecha */
    const r = K.rng(seed), pts = [], n = 16, x0 = W * ((portrait ? 0.47 : 0.71) + r() * 0.06);
    for (let i = 0; i <= n; i++) pts.push([x0 + (r() - 0.5) * L.sw * 0.45 + (i % 2 ? 1 : -1) * L.sw * 0.08, L.yT - L.ph + (i / n) * (L.hw + L.ph)]);
    return pts;
  }

  /**
   * Muro de noche. o = { lt, seed, on (s de encendido), sweep, tower, crackAt, crowd, push }
   * Devuelve {L, hits} para que el componente sume sacudidas.
   */
  function wallScene(G, st, o) {
    const { W, H, u, portrait } = st, lt = o.lt, L = wallLayer(W, H, portrait, o.seed ?? 41);
    const on = ignite(lt, o.on ?? 0, 0.55);
    /* cielo: negro con bruma */
    G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
    const fog = G.createLinearGradient(0, 0, 0, L.yT); fog.addColorStop(0, "rgba(40,39,37,0)"); fog.addColorStop(1, `rgba(60,58,55,${0.35 * on})`);
    G.fillStyle = fog; G.fillRect(0, 0, W, L.yT);
    /* torre de vigilancia y reflectores */
    const tx = W * (portrait ? 0.82 : 0.86), tw = Math.max(u * 3.2, W * 0.03), tTop = L.yT - H * (portrait ? 0.16 : 0.24);
    if (o.tower !== false) {
      G.fillStyle = "#0e0e0e"; G.fillRect(tx - tw * 0.32, tTop + tw * 0.9, tw * 0.64, L.yT - tTop);
      G.fillRect(tx - tw * 0.6, tTop, tw * 1.2, tw * 0.95); G.fillRect(tx - tw * 0.7, tTop - tw * 0.12, tw * 1.4, tw * 0.16);
      G.fillStyle = `rgba(232,226,210,${0.75 * on})`; G.fillRect(tx - tw * 0.42, tTop + tw * 0.3, tw * 0.84, tw * 0.28);
    }
    const beams = o.sweep === false ? [] : [[tx, tTop + tw * 0.44, 0.0], [W * 0.08, L.yT - L.ph * 0.6, 2.1]];
    G.save(); G.globalCompositeOperation = "lighter";
    beams.forEach(([bx, by, ph], i) => {
      const a = (i ? -0.55 : -2.55) + Math.sin(lt * 0.55 + ph) * 0.42, len = Math.hypot(W, H) * 1.1, spread = 0.07;
      const bg = G.createLinearGradient(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len);
      bg.addColorStop(0, `rgba(235,230,215,${0.26 * on})`); bg.addColorStop(0.6, `rgba(235,230,215,${0.06 * on})`); bg.addColorStop(1, "rgba(235,230,215,0)");
      G.fillStyle = bg; G.beginPath(); G.moveTo(bx, by);
      G.lineTo(bx + Math.cos(a - spread) * len, by + Math.sin(a - spread) * len); G.lineTo(bx + Math.cos(a + spread) * len, by + Math.sin(a + spread) * len); G.closePath(); G.fill();
    });
    G.restore();

    /* muro (se parte en dos si hay grieta) */
    const cq = o.crackAt >= 0 ? prog(lt, o.crackAt, 0.32, "out") : 0, oq = o.crackAt >= 0 ? prog(lt, o.crackAt + 0.3, 0.8, "out") : 0;
    const gap = oq * u * (portrait ? 3.4 : 3.0);
    G.save(); G.globalAlpha *= on;
    if (oq <= 0) G.drawImage(L.c, 0, 0, W, H);
    else {
      const pts = crackPts(W, L, (o.seed ?? 41) + 7, portrait);
      const left = new Path2D(); left.moveTo(0, 0); pts.forEach(([x, y]) => left.lineTo(x, y)); left.lineTo(pts[pts.length - 1][0], H); left.lineTo(0, H); left.closePath();
      const right = new Path2D(); right.moveTo(W, 0); right.lineTo(pts[0][0], 0); pts.forEach(([x, y]) => right.lineTo(x, y)); right.lineTo(pts[pts.length - 1][0], H); right.lineTo(W, H); right.closePath();
      G.save(); G.translate(-gap / 2, 0); G.clip(left); G.drawImage(L.c, 0, 0, W, H); G.restore();
      G.save(); G.translate(gap / 2, 0); G.clip(right); G.drawImage(L.c, 0, 0, W, H); G.restore();
      /* luz que entra por la grieta */
      G.save(); G.globalCompositeOperation = "lighter"; G.strokeStyle = "rgba(255,250,236,.95)"; G.lineJoin = "round";
      G.shadowColor = "rgba(255,248,230,.9)"; G.shadowBlur = u * (2 + 5 * oq);
      G.lineWidth = Math.max(1, gap * 0.9); G.beginPath(); pts.forEach(([x, y], i) => i ? G.lineTo(x, y) : G.moveTo(x, y)); G.stroke();
      const cx = pts[8][0], cy = (L.yT + L.yB) / 2;
      E.spot(G, cx, cy, u * 34 * oq, L.hw * 0.9, 0.38 * oq, "255,246,225");
      G.restore();
    }
    G.restore();
    /* línea de grieta creciendo (antes de abrirse) */
    if (cq > 0 && oq < 1) {
      const pts = crackPts(W, L, (o.seed ?? 41) + 7, portrait), n = Math.max(1, Math.round(cq * (pts.length - 1)));
      G.save(); G.strokeStyle = `rgba(250,244,230,${0.9 * (1 - oq)})`; G.lineWidth = Math.max(1, u * 0.22); G.shadowColor = "#fff"; G.shadowBlur = u * 1.5;
      G.beginPath(); for (let i = 0; i <= n; i++) i ? G.lineTo(pts[i][0], pts[i][1]) : G.moveTo(pts[i][0], pts[i][1]); G.stroke(); G.restore();
    }
    /* polvo que salta de la grieta */
    if (o.crackAt >= 0 && lt > o.crackAt) {
      const d = lt - o.crackAt, r = K.rng((o.seed ?? 41) + 99), pts = crackPts(W, L, (o.seed ?? 41) + 7, portrait);
      G.save(); G.fillStyle = "#e8e2d6";
      for (let k = 0; k < 70; k++) {
        const p = pts[(r() * pts.length) | 0], vx = (r() - 0.5) * u * 30, vy = -u * (4 + r() * 18), life = 0.8 + r() * 1.2;
        if (d > life) { r(); continue; }
        const x = p[0] + vx * d, y = p[1] + vy * d + u * 22 * d * d, s = u * (0.08 + r() * 0.28);
        G.globalAlpha = 0.85 * (1 - d / life); G.fillRect(x, y, s, s);
      }
      G.restore();
    }
    /* luz del reflector sobre el muro: todo oscuro salvo una elipse que barre */
    const lx = W * (0.5 + 0.28 * Math.sin(lt * 0.5 + 0.6)), ly = (L.yT + L.yB) * 0.5, R = Math.max(W, H) * 0.62;
    const dk = G.createRadialGradient(lx, ly, L.hw * 0.25, lx, ly, R);
    dk.addColorStop(0, "rgba(0,0,0,0.02)"); dk.addColorStop(0.55, "rgba(0,0,0,0.42)"); dk.addColorStop(1, "rgba(0,0,0,0.82)");
    G.fillStyle = dk; G.fillRect(0, 0, W, H);
    if (o.crowd !== false) crowd(G, st, lt, { seed: (o.seed ?? 41) + 2, base: H * 1.01, on: prog(lt, (o.on ?? 0) + 0.15, 0.6, "out") });
    return { L, hits: o.crackAt >= 0 ? [o.crackAt] : [] };
  }

  /** fila de gente en silueta (algunos con brazos en alto) que bloquea el primer plano */
  function crowd(G, st, lt, o = {}) {
    const { W, H, u, portrait } = st;
    const P = E.memo(`enm-crowd:${W | 0}:${H | 0}:${o.seed ?? 3}`, () => {
      const r = K.rng(o.seed ?? 3), out = [], hh = H * (portrait ? 0.2 : 0.3);
      for (let x = -W * 0.04; x < W * 1.04;) {
        const h = hh * (0.78 + r() * 0.38), w = h * 0.42, arms = r() < 0.3 ? (r() < 0.5 ? 1 : 2) : 0;
        out.push({ x, h, w, arms, ph: r() * 6.28, back: r() < 0.45 });
        x += w * (0.48 + r() * 0.35);
      }
      out.sort((a, b) => (b.back - a.back));
      return out.map(p => ({ ...p, path: E.person(p.w, p.h) }));
    });
    const base = o.base ?? H, rise = (1 - (o.on ?? 1)) * H * 0.12;
    G.save();
    for (const p of P) {
      const sx = Math.sin(lt * 1.3 + p.ph) * u * 0.18, y = base - p.h * (p.back ? 0.86 : 0.74) + rise + (p.back ? -u * 1.2 : 0);
      G.save(); G.translate(p.x + sx, y);
      const fill = p.back ? "#0b0b0b" : "#020202";
      /* brazos en alto (protesta) */
      if (p.arms) {
        G.strokeStyle = fill; G.lineCap = "round"; G.lineWidth = p.w * 0.13;
        const wave = Math.sin(lt * 2.2 + p.ph) * p.w * 0.06;
        G.beginPath(); G.moveTo(p.w * 0.16, p.h * 0.22); G.lineTo(p.w * 0.02 + wave, -p.h * 0.12);
        if (p.arms === 2) { G.moveTo(p.w * 0.84, p.h * 0.22); G.lineTo(p.w * 0.98 - wave, -p.h * 0.12); }
        G.stroke();
      }
      /* luz de contorno (el reflector los recorta contra el muro) */
      G.strokeStyle = p.back ? "rgba(190,184,172,.10)" : "rgba(205,198,186,.2)"; G.lineWidth = Math.max(1, u * 0.22); G.stroke(p.path);
      G.fillStyle = fill; G.fill(p.path);
      G.restore();
    }
    G.restore();
  }

  /** mapa del país (cuadrícula, vecinos, textura) cacheado; devuelve proyección y ciudad */
  function countryLayer(W, H, portrait, country, cityKey) {
    return E.memo(`enm-country:${W | 0}:${H | 0}:${country}:${cityKey}`, () => {
      const GEO = window.ENM_GEO, T = E.mk(W, H, 1.25), g = T.g, lat0 = 51;
      const eq = (lo, la) => [lo * Math.cos(lat0 * Math.PI / 180), -la];
      const box = portrait ? { x: W * 0.06, y: H * 0.37, w: W * 0.88, h: H * 0.42 } : { x: W * 0.5, y: H * 0.08, w: W * 0.44, h: H * 0.8 };
      const P = fitP(eq, bbox(GEO[country], eq), box);
      /* cuadrícula de longitudes/latitudes */
      g.strokeStyle = "rgba(225,219,208,.09)"; g.lineWidth = 1;
      for (let lo = -20; lo <= 40; lo += 1) { g.beginPath(); const [x0, y0] = P(lo, 70), [x1, y1] = P(lo, 30); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
      for (let la = 30; la <= 70; la += 1) { g.beginPath(); const [x0, y0] = P(-20, la), [x1, y1] = P(40, la); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); }
      /* vecinos oscuros */
      for (const rings of Object.values(GEO.near || {})) { const pp = pathOf(rings, P); g.fillStyle = "#1d1c1a"; g.fill(pp); g.strokeStyle = "rgba(200,194,182,.16)"; g.stroke(pp); }
      const cp = pathOf(GEO[country], P);
      g.save(); g.clip(cp); g.fillStyle = "#6d6964"; g.fillRect(0, 0, W, H); g.globalAlpha = 0.6; g.drawImage(E.paper(29, 1024, 640, 160), 0, 0, W, H);
      g.globalAlpha = 0.35; E.pattern(g, E.grunge(17), 0, 0, W, H, 0.8); g.restore();
      g.strokeStyle = "rgba(235,230,220,.55)"; g.lineWidth = 1.2; g.stroke(cp);
      const c = (GEO.cities || {})[cityKey];
      return { c: T.c, P, city: c ? P(c[0], c[1]) : [box.x + box.w / 2, box.y + box.h / 2], box };
    });
  }

  /** planisferio de tinta (más ancho que el cuadro para desplazarlo) con alfileres */
  const PINS = [[13.4, 52.5], [-77, 38.9], [37.6, 55.7], [31.2, 30], [-58.4, -34.6], [139.7, 35.7], [-99.1, 19.4], [28, -26.2], [116.4, 39.9], [-77, -12], [2.35, 48.85], [77.2, 28.6]];
  function worldLayer(W, H, portrait) {
    return E.memo(`enm-world:${W | 0}:${H | 0}`, () => {
      const GEO = window.ENM_GEO, MW = portrait ? H * 1.05 : W * 1.3, MH = portrait ? H : H * 1.15;
      const T = E.mk(MW, MH, 1), g = T.g;
      const P = fitP(ne, bbox(GEO.world, ne), { x: 0, y: 0, w: MW, h: MH }, portrait ? "contain" : "cover");
      g.strokeStyle = "rgba(225,219,208,.07)"; g.lineWidth = 1;
      for (let lo = -180; lo <= 180; lo += 15) { g.beginPath(); for (let la = -85; la <= 85; la += 5) { const [x, y] = P(lo, la); la === -85 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
      for (let la = -75; la <= 75; la += 15) { g.beginPath(); for (let lo = -180; lo <= 180; lo += 5) { const [x, y] = P(lo, la); lo === -180 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
      const wp = pathOf(GEO.world, P);
      g.save(); g.clip(wp); g.fillStyle = "#3d3a37"; g.fillRect(0, 0, MW, MH); g.globalAlpha = 0.55; g.drawImage(E.paper(21, 1024, 640, 150), 0, 0, MW, MH);
      g.globalAlpha = 0.3; E.pattern(g, E.grunge(23), 0, 0, MW, MH, 0.9); g.restore();
      g.strokeStyle = "rgba(225,219,208,.18)"; g.lineWidth = 1; g.stroke(wp);
      return { c: T.c, MW, MH, pins: PINS.map(([lo, la]) => P(lo, la)) };
    });
  }
  /** mapamundi que se desplaza, alfileres que se encienden y rutas que los unen */
  function worldScene(G, st, lt, o = {}) {
    const { W, H, u, portrait } = st, M = worldLayer(W, H, portrait), span = o.span ?? 8;
    const p = clamp(lt / span), ox = -(M.MW - W) * (0.15 + 0.7 * ease.sine(p)), oy = -(M.MH - H) / 2;
    G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
    G.save(); G.globalAlpha *= ignite(lt, o.on ?? 0, 0.6); G.translate(ox, oy); G.drawImage(M.c, 0, 0, M.MW, M.MH);
    /* rutas de hilo entre alfileres (se dibujan en orden) */
    G.strokeStyle = "rgba(232,226,214,.28)"; G.lineWidth = Math.max(1, u * 0.12); G.setLineDash([u * 0.6, u * 0.5]);
    M.pins.forEach((pt, i) => {
      if (!i) return; const q = prog(lt, 0.4 + i * 0.32, 0.6, "inOut"); if (q <= 0) return;
      const [x0, y0] = M.pins[i - 1], [x1, y1] = pt, mx = (x0 + x1) / 2, my = Math.min(y0, y1) - Math.abs(x1 - x0) * 0.18;
      G.beginPath(); G.moveTo(x0, y0);
      for (let k = 1; k <= 24 * q; k++) { const s = k / 24, a = 1 - s; G.lineTo(a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1); }
      G.stroke();
    });
    G.setLineDash([]);
    M.pins.forEach(([x, y], i) => {
      const t0 = 0.3 + i * 0.32, q = prog(lt, t0, 0.25, "out"); if (q <= 0) return;
      G.fillStyle = INK; G.globalAlpha = q; G.beginPath(); G.arc(x, y, u * 0.42, 0, 7); G.fill();
      const ring = ((lt - t0) % 1.6) / 1.6; G.strokeStyle = `rgba(235,230,220,${0.5 * (1 - ring)})`; G.lineWidth = Math.max(1, u * 0.12);
      G.beginPath(); G.arc(x, y, u * (0.6 + ring * 3.2), 0, 7); G.stroke();
    });
    G.restore();
    const dk = G.createRadialGradient(W / 2, H * 0.42, Math.min(W, H) * 0.12, W / 2, H * 0.45, Math.max(W, H) * 0.7);
    dk.addColorStop(0, "rgba(0,0,0,.55)"); dk.addColorStop(1, "rgba(0,0,0,.82)");
    G.fillStyle = dk; G.fillRect(0, 0, W, H);
  }

  E.scene = { wall: wallScene, crowd, world: worldScene, countryLayer, words, shake, kicker, ignite };

  /* ================================================================ introv1 */
  K.register({
    name: "enmienda.introv1", tags: ["intro", "gancho", "apertura", "título", "muro", "impacto"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: wall | map | world | dark | image con src | component con use/useParams); por defecto el Muro de noche — losas de hormigón con tubo, torre de vigilancia, reflectores que barren y una fila de gente en silueta bloqueando adelante — y un titular GIGANTE desgastado que golpea palabra por palabra con sacudida de cámara ('^palabra^' va en cartulina blanca). El muro se raja y entra luz por la grieta. Sale borrándose con barrido.",
    example: { text: "¿POR QUÉ CAYÓ\nEL ^MURO^?", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", crackAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra en cartulina blanca." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del titular." },
      ...K.hook.bgParams(["wall", "map", "world", "dark"]),
      crowd: { type: "bool", default: true, doc: "Fila de gente en silueta bloqueando en primer plano (sobre cualquier fondo)." },
      crackAt: { type: "number", default: 2.3, doc: "Segundo en que el muro se raja (-1 = no se raja)." },
      wordAt: { type: "number", default: 0.45, doc: "Segundo del primer golpe de palabra." },
      stagger: { type: "number", default: 0.3, min: 0.08, doc: "Segundos entre palabra y palabra." },
      country: { type: "enum", options: ["DE"], default: "DE", doc: "País (bg=map)." },
      city: { type: "string", default: "BERLÍN", doc: "Ciudad marcada (bg=map)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, Ls = words(p.text), flat = Ls.flat();
      const longest = Ls.map(l => l.map(w => w.w).join(" ")).reduce((a, s) => s.length > a.length ? s : a, "");
      const fs = Math.min(E.fit(longest, "heavy", W * (portrait ? 0.9 : 0.8), 1e9, 400), H * (portrait ? 0.135 : 0.25) * (Ls.length > 2 ? 0.8 : 1));
      const lh = fs * 1.0, cy = H * (portrait ? 0.25 : 0.43), sp = E.measure(" ", "heavy", fs, 400);
      /* posiciones de cada palabra */
      let idx = 0; const placed = [];
      Ls.forEach((line, li) => {
        const ws = line.map(w => E.measure(w.w, "heavy", fs, 400)), tot = ws.reduce((a, b) => a + b, 0) + sp * (line.length - 1);
        const tot2 = tot - sp * line.filter(w => w.glue).length;
        let x = W / 2 - tot2 / 2; const yb = cy + (li - (Ls.length - 1) / 2) * lh + fs * 0.36;
        line.forEach((w, k) => { if (w.glue) x -= sp - fs * 0.04; placed.push({ ...w, x, yb, ww: ws[k], i: w.glue ? idx - 1 : idx++, seed: 31 + idx * 7 }); x += ws[k] + sp; });
      });
      const hits = placed.map(w => p.wordAt + w.i * p.stagger + 0.16);
      const lastHit = hits[hits.length - 1] ?? p.wordAt;
      const withCrowd = (G, st, lt) => { if (p.crowd) crowd(G, st, lt, { seed: 43, on: prog(lt, 0.2, 0.6, "out") }); };
      const BG = K.hook.bg(ctx, p, {
        auto: "wall", tone: img => E.photo(img, "bw"),
        presets: {
          wall: (G, st, lt) => wallScene(G, st, { lt, seed: 41, on: 0, crackAt: p.crackAt, crowd: p.crowd }),
          map: (G, st, lt) => {
            const M = countryLayer(W, H, portrait, p.country, p.city), a = G.globalAlpha;
            G.fillStyle = "#000"; G.fillRect(0, 0, W, H); G.globalAlpha = a * ignite(lt, 0, 0.6); G.drawImage(M.c, 0, 0, W, H); G.globalAlpha = a;
            E.crosshair(G, M.city[0], M.city[1], u * 7, prog(lt, 0.3, 1.1), Math.max(1, u * 0.18));
            const dk = G.createRadialGradient(W / 2, cy, fs * 0.5, W / 2, cy, W * 0.8); dk.addColorStop(0, "rgba(0,0,0,.55)"); dk.addColorStop(1, "rgba(0,0,0,.85)"); G.fillStyle = dk; G.fillRect(0, 0, W, H);
            withCrowd(G, st, lt);
          },
          world: (G, st, lt, b) => { worldScene(G, st, lt, { span: Math.max(6, b.dur) }); withCrowd(G, st, lt); },
          dark: (G, st, lt) => { G.fillStyle = "#000"; G.fillRect(0, 0, W, H); E.spot(G, W / 2, cy, W * 0.45, H * 0.35, 0.08); withCrowd(G, st, lt); },
        },
      });
      const cracks = BG.mode === "wall" && p.crackAt >= 0;
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.6), cam = 1.04 + 0.05 * clamp(lt / Math.max(4, b.dur));
          const all = hits.concat(cracks ? [p.crackAt + 0.05] : []);
          const [sx, sy] = shake(lt, all, u * 0.9);
          G.save(); G.globalAlpha = 1 - oq;
          G.translate(W / 2 + sx, H / 2 + sy); G.scale(cam, cam); G.translate(-W / 2, -H / 2);
          /* fondo (preset del diseño, foto o componente) */
          BG.render(lt, b);
          if (BG.mode === "image" || BG.mode === "component") withCrowd(G, ctx.stage, lt);
          G.restore();
          /* banda oscura detrás del titular (se lee sobre el muro) */
          G.save(); G.globalAlpha = (1 - oq) * prog(lt, p.wordAt - 0.2, 0.4, "linear");
          const band = G.createLinearGradient(0, cy - lh * Ls.length * 0.9, 0, cy + lh * Ls.length * 0.9);
          band.addColorStop(0, "rgba(0,0,0,0)"); band.addColorStop(0.5, "rgba(0,0,0,.55)"); band.addColorStop(1, "rgba(0,0,0,0)");
          G.fillStyle = band; G.fillRect(0, cy - lh * Ls.length, W, lh * Ls.length * 2); G.restore();
          /* titular: cada palabra golpea (escala + desenfoque) y queda temblando apenas */
          G.save(); G.translate(sx * 0.6, sy * 0.6);
          const smearX = oq * W * 0.18;
          for (const w of placed) {
            const t0 = p.wordAt + w.i * p.stagger, q = prog(lt, t0, 0.2, "linear");
            if (q <= 0) continue;
            const e = ease.expoOut(q), s = 1 + 0.85 * (1 - e), bl = (1 - e) * fs * 0.07, [jx, jy] = E.boil(w.seed, lt, u * 0.12, 12);
            const ccx = w.x + w.ww / 2, ccy = w.yb - fs * 0.36;
            G.save(); G.globalAlpha = clamp(q * 3) * (1 - oq);
            G.translate(ccx + jx + smearX * (w.i % 2 ? 1 : -1) * 0.4, ccy + jy); G.scale(s, s); G.translate(-ccx, -ccy);
            if (bl > 0.4) G.filter = `blur(${bl.toFixed(1)}px)`;
            if (w.acc) {
              E.card(G, ccx, ccy, w.ww + fs * 0.32, fs * 0.98, -0.022 + (w.seed % 5) * 0.004);
              const T = E.inkText(w.w, { kind: "heavy", px: fs, weight: 400, color: DARK, ink: "dark", wear: 0.7, seed: w.seed });
              G.drawImage(T.c, w.x - fs * 0.15, w.yb - T.base, T.w, T.h);
            } else {
              const T = E.inkText(w.w, { kind: "heavy", px: fs, weight: 400, color: INK, wear: 0.8, seed: w.seed });
              G.shadowColor = "rgba(0,0,0,.75)"; G.shadowBlur = fs * 0.12;
              G.drawImage(T.c, w.x - fs * 0.15, w.yb - T.base, T.w, T.h);
            }
            G.restore();
          }
          G.restore();
          /* rótulos */
          const top = cy - lh * Ls.length / 2 - fs * 0.38 - u * 3.2, bot = cy + lh * Ls.length / 2 + u * 3.6;
          kicker(G, p.kicker, W / 2, top, u * (portrait ? 2.1 : 1.55), ignite(lt, 0.15, 0.5) * (1 - oq));
          if (p.sub) {
            const a = prog(lt, lastHit + 0.25, 0.5, "linear") * (1 - oq);
            G.save(); G.globalAlpha = a; G.font = E.font("cond", u * (portrait ? 3.4 : 2.9), 600); G.letterSpacing = u * 0.18 + "px";
            G.textAlign = "center"; G.fillStyle = "rgba(226,220,210,.85)"; G.shadowColor = "#000"; G.shadowBlur = u * 1.2;
            G.fillText(String(p.sub).toUpperCase(), W / 2, bot); G.restore();
          }
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "enmienda.introv2", tags: ["intro", "gancho", "apertura", "mapa", "pregunta", "sello"], layer: "main", post: 0.6,
    summary: "GANCHO tipo expediente. Fondo adaptable al tema (bg: map | wall | world | dark | image con src | component con use/useParams); por defecto el mapa del país con cuadrícula y vecinos, una mira que se fija sobre la ciudad con ondas de radar y barrido de vigilancia, gente en silueta al pie. La pregunta gigante se tipea letra a letra y un SELLO de tinta golpea encima con sacudida (p. ej. 'NADIE DIO LA ORDEN').",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Expediente · Berlín 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.4 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      stamp: { type: "string", default: "", doc: "Texto del sello que golpea (vacío = sin sello)." },
      stampAt: { type: "number", default: 2.4, doc: "Segundo del sello (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.35, doc: "Segundo en que empieza a tipearse la pregunta." },
      cps: { type: "number", default: 20, min: 4, doc: "Letras por segundo del tipeo." },
      country: { type: "enum", options: ["DE"], default: "DE", doc: "País del mapa." },
      city: { type: "string", default: "BERLÍN", doc: "Ciudad donde se fija la mira (clave de ENM_GEO.cities)." },
      crowd: { type: "bool", default: true, doc: "Gente en silueta al pie." },
      ...K.hook.bgParams(["map", "wall", "world", "dark"]),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, Ls = String(p.text).toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      const longest = Ls.reduce((a, s) => s.length > a.length ? s : a, "");
      const fs = Math.min(E.fit(longest, "heavy", W * (portrait ? 0.88 : 0.47), 1e9, 400), H * (portrait ? 0.105 : 0.19));
      const x0 = portrait ? W / 2 : W * 0.07, y0 = portrait ? H * 0.13 : H * 0.3, lh = fs * 0.98;
      const total = Ls.reduce((a, s) => a + s.length, 0);
      /* mapa del país con mira (el fondo propio); los demás fondos vienen del contrato común */
      const mapScene = (G, st, lt, b) => {
        const M = countryLayer(W, H, portrait, p.country, p.city), z = 1 + 0.14 * ease.inOut(clamp(lt / Math.max(4, b.dur))), a = G.globalAlpha;
        G.fillStyle = "#000"; G.fillRect(0, 0, W, H);
        G.save(); G.translate(M.city[0], M.city[1]); G.scale(z, z); G.translate(-M.city[0], -M.city[1]);
        G.globalAlpha = a * ignite(lt, 0, 0.6); G.drawImage(M.c, 0, 0, W, H); G.globalAlpha = a;
        const sy2 = M.box.y + ((lt * 0.35) % 1) * M.box.h, sg = G.createLinearGradient(0, sy2 - u * 6, 0, sy2);
        sg.addColorStop(0, "rgba(235,230,220,0)"); sg.addColorStop(1, "rgba(235,230,220,.12)"); G.fillStyle = sg; G.fillRect(M.box.x, sy2 - u * 6, M.box.w, u * 6);
        const [cx, cy] = M.city;
        for (let k = 0; k < 3; k++) { const ring = ((lt * 0.7 + k / 3) % 1); G.strokeStyle = `rgba(235,230,220,${0.45 * (1 - ring) * prog(lt, 0.6, 0.4)})`; G.lineWidth = Math.max(1, u * 0.14); G.beginPath(); G.arc(cx, cy, u * (1 + ring * 12), 0, 7); G.stroke(); }
        G.fillStyle = INK; G.beginPath(); G.arc(cx, cy, u * 0.55, 0, 7); G.fill();
        E.crosshair(G, cx, cy, u * 8, prog(lt, 0.5, 1.1), Math.max(1, u * 0.18));
        const lq = prog(lt, 1.4, 0.45, "linear");
        if (lq > 0 && p.city) {
          const fs2 = u * (portrait ? 2.2 : 1.8), txt = p.city.slice(0, Math.ceil(p.city.length * lq)); G.font = E.font("wide", fs2, 800);
          const tw = G.measureText(txt).width, bx = cx + u * 2.4, by = cy - u * 6;
          G.strokeStyle = "#ddd8ce"; G.lineWidth = Math.max(1, u * 0.12); G.beginPath(); G.moveTo(cx, cy); G.lineTo(bx, by + fs2 * 0.6); G.stroke();
          G.fillStyle = "#efece6"; G.fillRect(bx, by - fs2 * 0.4, tw + fs2 * 0.8, fs2 * 1.45); G.fillStyle = DARK; G.fillText(txt, bx + fs2 * 0.4, by + fs2 * 0.72);
        }
        G.restore();
      };
      const BG = K.hook.bg(ctx, p, {
        auto: "map", tone: img => E.photo(img, "bw"),
        presets: {
          map: mapScene,
          wall: (G, st, lt) => wallScene(G, st, { lt, seed: 41, on: 0, crackAt: -1, crowd: false }),
          world: (G, st, lt, b) => worldScene(G, st, lt, { span: Math.max(6, b.dur) }),
          dark: G => { G.fillStyle = "#000"; G.fillRect(0, 0, W, H); },
        },
      });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = E.outQ(lt, b, 0.6);
          const hits = [p.stamp ? p.stampAt + 0.12 : -9], [sx, sy] = shake(lt, hits, u * 1.1);
          G.save(); G.globalAlpha = 1 - oq; G.translate(sx, sy);
          BG.render(lt, b);
          /* oscurecer la zona del texto */
          const dk = portrait ? G.createLinearGradient(0, 0, 0, H * 0.5) : G.createLinearGradient(0, 0, W * 0.62, 0);
          dk.addColorStop(0, "rgba(0,0,0,.88)"); dk.addColorStop(0.75, "rgba(0,0,0,.55)"); dk.addColorStop(1, "rgba(0,0,0,0)");
          G.fillStyle = dk; G.fillRect(0, 0, W, H);
          if (p.crowd) crowd(G, ctx.stage, lt, { seed: 45, on: prog(lt, 0.1, 0.7, "out") });
          G.restore();

          /* pregunta tipeada (stop-motion a 12 fps) */
          const n = Math.floor(clamp((E.stop(lt, 12) - p.typeAt) * p.cps, 0, total));
          let left = n;
          G.save(); G.globalAlpha = 1 - oq; G.translate(sx * 0.7 - oq * W * 0.12, sy * 0.7);
          Ls.forEach((s, i) => {
            const k = Math.min(s.length, left); left -= k; if (k <= 0) return;
            const T = E.inkText(s.slice(0, k), { kind: "heavy", px: fs, weight: 400, color: INK, wear: 0.8, seed: 51 + i });
            const yb = y0 + i * lh + fs * 0.75, x = portrait ? x0 - E.measure(s, "heavy", fs, 400) / 2 : x0;
            G.shadowColor = "rgba(0,0,0,.7)"; G.shadowBlur = fs * 0.1;
            G.drawImage(T.c, x - fs * 0.15, yb - T.base, T.w, T.h);
          });
          G.restore();
          kicker(G, p.kicker, portrait ? W / 2 : x0, y0 - u * (portrait ? 2.6 : 5.4), u * (portrait ? 2 : 1.5), ignite(lt, 0.1, 0.5) * (1 - oq), portrait ? "center" : "left");
          /* sello de tinta que golpea */
          if (p.stamp && lt >= p.stampAt) {
            const q = prog(lt, p.stampAt, 0.16, "linear"), e = ease.expoOut(q), s = 1 + 1.3 * (1 - e);
            const sfs = Math.min(E.fit(p.stamp, "stencil", W * (portrait ? 0.7 : 0.36), fs * 0.5, 700), fs * 0.5);
            const sw = E.measure(p.stamp.toUpperCase(), "stencil", sfs, 700) + sfs * 1.2, sh = sfs * 1.75;
            const scx = portrait ? W / 2 : x0 + sw / 2 + u * 0.5, scy = y0 + Ls.length * lh + sh * 0.6 + u * 2.5, rot = -0.07;
            G.save(); G.globalAlpha = clamp(q * 4) * (1 - oq); G.translate(scx, scy); G.rotate(rot); G.scale(s, s);
            G.fillStyle = "rgba(232,227,218,.94)"; G.fillRect(-sw / 2, -sh / 2, sw, sh);
            G.globalAlpha *= 0.45; E.pattern(G, E.fibers(12), -sw / 2, -sh / 2, sw, sh, 1); G.globalAlpha = clamp(q * 4) * (1 - oq);
            G.strokeStyle = DARK; G.lineWidth = sfs * 0.09; G.strokeRect(-sw / 2 + sfs * 0.18, -sh / 2 + sfs * 0.18, sw - sfs * 0.36, sh - sfs * 0.36);
            G.lineWidth = sfs * 0.035; G.strokeRect(-sw / 2 + sfs * 0.34, -sh / 2 + sfs * 0.34, sw - sfs * 0.68, sh - sfs * 0.68);
            const T = E.inkText(p.stamp.toUpperCase(), { kind: "stencil", px: sfs, weight: 700, color: DARK, ink: "dark", wear: 0.9, seed: 77 });
            G.drawImage(T.c, -T.w / 2 + sfs * 0.07, -T.h / 2 + sfs * 0.04, T.w, T.h);
            G.restore();
          }
        },
      };
    },
  });
})();

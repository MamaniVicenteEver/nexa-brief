/* =============================================================================
   pelicula · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = cuenta regresiva de líder de película (3-2-1) → titular GIGANTE que
             entra palabra por palabra con barrido y estela (motion blur), cae con
             sacudida y glitch de franjas; '^x^' va en naranja con barra roja.
             Impacto (burnAt): la película se traba en la ventanilla (salto de
             cuadro con la línea de cuadro a la vista) y se QUEMA (agujero con
             borde incandescente) → destello naranja→blanco. Sale con barrido.
   introv2 = intertítulo de cine mudo: se abre el iris, la pregunta se expone letra
             por letra (cada letra destella al aparecer) entre filetes dobles, y la
             respuesta llega en una TIRA DE PELÍCULA que cruza con barrido y queda
             atravesada. Sale cerrando el iris.
   Fondos propios (neutros, sirven para cualquier tema): strips (tiras en capas con
   cuadros expuestos), projector (sala oscura, haz del proyector con polvo, rollos
   girando), reel (rollos verticales en paralaje), leader (líder de película con
   la aguja que barre). Más los modos del contrato: image, component, none.
   Escenarios compartidos en Kit.pelicula.hook para que outro.js use lo mismo.
   Todo es función pura de lt (sin Math.random, sin Date, sin CSS animado).
   ========================================================================== */
(function () {
  const K = Kit, P = Kit.pelicula, { clamp, lerp, prog, ease } = K;
  const CREAM = "#f3eadb", ORANGE = "#d9581f", ORANGE_HI = "#e8642a", RED = "#c4352a", DARK = "#17130c";

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → [[{w, acc, glue}]] (renglones de palabras; ^x^ = destacada) */
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
  /** en 9:16 rearma los renglones (si alguno es largo) en tandas de ~10 letras: titular más grande y
      mejor repartido; los signos pegados ('^MURO^?') no se separan de su palabra */
  function splitPortrait(Ls, max = 10) {
    const len = l => l.reduce((a, w) => a + w.w.length + (w.glue ? 0 : 1), -1);
    if (!Ls.some(l => len(l) > max)) return Ls;
    const units = []; Ls.flat().forEach(w => { if (w.glue && units.length) units[units.length - 1].push(w); else units.push([w]); });
    const out = [[]];
    for (const un of units) {
      const cur = out[out.length - 1], n = un.reduce((a, w) => a + w.w.length, 0);
      if (cur.length && len(cur) + 1 + n > max) out.push([]);
      out[out.length - 1].push(...un.map((w, i) => i === 0 ? { ...w, glue: false } : w));
    }
    return out;
  }
  const FONT = (px, w = 800) => `${w} ${px}px Montserrat`;
  const LS = px => px * 0.01;
  /** ancho de un texto en Montserrat (peso w) a px */
  const meas = (txt, px, w = 800) => P.measure(txt, FONT(px, w), LS(px));
  /** cuerpo que hace entrar `txt` en maxW */
  const fit = (txt, maxW, w = 800) => maxW / Math.max(1e-3, meas(txt, 100, w) / 100);

  /** texto erosionado (motas que dejan ver el fondo, como la tinta gastada del diseño), cacheado */
  const inkCache = new Map();
  function ink(txt, px, color, seed = 1, R = 2, w = 800) {
    const key = `${txt}|${px.toFixed(1)}|${color}|${seed}|${R}|${w}`;
    if (inkCache.has(key)) return inkCache.get(key);
    const pad = px * 0.06, tw = meas(txt, px, w), cw = tw + pad * 2, ch = px * 1.3, base = px * 1.0;
    const c = P.canvas(cw * R, ch * R), g = c.getContext("2d");
    g.scale(R, R); g.font = FONT(px, w); g.letterSpacing = LS(px) + "px"; g.textBaseline = "alphabetic"; g.fillStyle = color;
    g.fillText(txt, pad, base);
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = "destination-out";
    const pat = g.createPattern(P.tex().speck, "repeat"), s = Math.max(1, R * px / 160);
    pat.setTransform(new DOMMatrix().scale(s, s).translate((seed * 37) % 500, (seed * 71) % 500));
    g.globalAlpha = 0.55; g.fillStyle = pat; g.fillRect(0, 0, c.width, c.height);
    const out = { c, w: cw, h: ch, base, pad, tw };
    if (inkCache.size > 300) inkCache.clear();
    inkCache.set(key, out);
    return out;
  }
  /** dibuja un ink con la línea base en (x,y) (x = comienzo del texto) */
  const drawInk = (G, T, x, y) => G.drawImage(T.c, x - T.pad, y - T.base, T.w, T.h);

  /** sacudida de cámara: suma de golpes que decaen (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.3) a += Math.pow(1 - d / 0.3, 2); }
    return [Math.sin(lt * 93) * amp * a, Math.cos(lt * 71) * amp * a * 0.8];
  }
  /** vaivén de ventanilla del proyector (gate weave), cambia a 24 cuadros/s */
  function weave(lt, u) { const r = K.rng(Math.floor(lt * 24) * 613 + 5); return [(r() - 0.5) * u * 0.12, (r() - 0.5) * u * 0.22]; }
  /** encendido con parpadeo de exposición */
  const flick = (lt, at, dur) => { const q = prog(lt, at, dur, "linear"); return q >= 1 ? 1 : q * (0.5 + 0.5 * K.rng(Math.floor(lt * 24) + 11)()); };

  /** rótulo chico espaciado con barra roja delante y filete detrás */
  function kicker(G, str, x, y, size, a, align = "center") {
    if (!str || a <= 0) return;
    G.save(); G.globalAlpha *= a; G.font = FONT(size, 600); G.letterSpacing = size * 0.3 + "px";
    const s = String(str).toUpperCase(), w = G.measureText(s).width, bw = size * 2.2, gap = size * 0.9;
    const tot = bw + gap + w, x0 = align === "center" ? x - tot / 2 : x;
    G.fillStyle = RED; G.fillRect(x0, y - size * 0.14, bw, Math.max(2, size * 0.28));
    G.fillStyle = CREAM; G.textAlign = "left"; G.textBaseline = "middle"; G.shadowColor = "rgba(10,7,3,.9)"; G.shadowBlur = size * 0.8;
    G.fillText(s, x0 + bw + gap, y);
    G.shadowBlur = 0; G.fillStyle = "rgba(243,234,219,.5)";
    if (align === "center") G.fillRect(x0 + tot + gap * 0.6, y - 0.5, bw, Math.max(1, size * 0.07));
    G.restore();
  }
  /** subtítulo con barra roja delante (el estilo del bloque del diseño) */
  function subLine(G, str, cx, y, size, a, align = "center", upper = true, maxW = 1e9) {
    if (!str || a <= 0) return;
    const s = upper ? String(str).toUpperCase() : String(str);
    G.save(); G.globalAlpha *= a; G.font = FONT(size, 600); G.letterSpacing = size * 0.08 + "px";
    const w0 = G.measureText(s).width + size * 3.3;
    if (w0 > maxW) { size *= maxW / w0; G.font = FONT(size, 600); G.letterSpacing = size * 0.08 + "px"; }
    const w = G.measureText(s).width, bw = size * 2.6, gap = size * 0.7;
    const x0 = align === "center" ? cx - (bw + gap + w) / 2 : cx;
    G.fillStyle = RED; G.fillRect(x0, y - size * 0.22, bw * clamp(a * 1.4), size * 0.36);
    G.fillStyle = CREAM; G.textBaseline = "middle"; G.shadowColor = "rgba(10,7,3,.95)"; G.shadowBlur = size;
    G.fillText(s, x0 + bw + gap, y + size * 0.04);
    G.restore();
  }

  /* ------------------------------------------------------------ cuadros "expuestos" (sin fotos) */
  /** 8 cuadros de archivo genéricos (horizonte, ciudad, retrato, multitud, documento, engranajes, ruta, líder) */
  let TILES = null;
  function tiles() {
    if (TILES) return TILES;
    const r = K.rng(4417), out = [], TW = 360, TH = 250;
    const sky = (g, a, b) => { const lg = g.createLinearGradient(0, 0, 0, TH); lg.addColorStop(0, a); lg.addColorStop(1, b); g.fillStyle = lg; g.fillRect(0, 0, TW, TH); };
    for (let k = 0; k < 8; k++) {
      const c = P.canvas(TW, TH), g = c.getContext("2d");
      switch (k) {
        case 0: { /* ciudad */
          sky(g, "#d9caa2", "#9a8b68"); g.fillStyle = "#2a2216";
          for (let x = -10; x < TW;) { const w = 18 + r() * 40, h = 40 + r() * 120; g.fillRect(x, TH * 0.82 - h, w, h + TH); x += w + r() * 6; }
          g.fillStyle = "rgba(230,215,170,.35)"; for (let i = 0; i < 70; i++) g.fillRect(r() * TW, TH * 0.45 + r() * TH * 0.35, 3, 4);
          break; }
        case 1: { /* retrato en silueta */
          const rg = g.createRadialGradient(TW * 0.5, TH * 0.4, 10, TW * 0.5, TH * 0.4, TW * 0.6); rg.addColorStop(0, "#cdbd95"); rg.addColorStop(1, "#5d5240"); g.fillStyle = rg; g.fillRect(0, 0, TW, TH);
          g.fillStyle = "#231c11"; g.beginPath(); g.ellipse(TW * 0.5, TH * 0.42, 38, 48, 0, 0, 7); g.fill();
          g.beginPath(); g.moveTo(TW * 0.2, TH); g.bezierCurveTo(TW * 0.24, TH * 0.66, TW * 0.4, TH * 0.62, TW * 0.5, TH * 0.62); g.bezierCurveTo(TW * 0.6, TH * 0.62, TW * 0.76, TH * 0.66, TW * 0.8, TH); g.fill();
          break; }
        case 2: { /* multitud */
          sky(g, "#e2d4ad", "#8f8162"); g.fillStyle = "#1f1910";
          for (let row = 0; row < 3; row++) for (let x = -10; x < TW; x += 14 + r() * 10) { const y = TH * (0.62 + row * 0.13) + r() * 8, s = 9 + row * 3 + r() * 3; g.beginPath(); g.arc(x, y, s, 0, 7); g.fill(); g.fillRect(x - s * 1.3, y + s * 0.8, s * 2.6, TH); }
          break; }
        case 3: { /* horizonte con sol */
          sky(g, "#a89a76", "#e7d9b3"); g.fillStyle = "rgba(255,246,220,.9)"; g.beginPath(); g.arc(TW * 0.62, TH * 0.5, 30, 0, 7); g.fill();
          g.fillStyle = "#3b3122"; g.fillRect(0, TH * 0.6, TW, TH);
          g.strokeStyle = "rgba(230,214,170,.35)"; for (let i = 0; i < 14; i++) { g.lineWidth = 1 + r() * 2; const y = TH * 0.63 + i * 7; g.beginPath(); g.moveTo(TW * 0.62 - 50 + r() * 20, y); g.lineTo(TW * 0.62 + 50 - r() * 20, y); g.stroke(); }
          break; }
        case 4: { /* documento */
          g.fillStyle = "#e6d8b2"; g.fillRect(0, 0, TW, TH); g.fillStyle = "#3a2f1e";
          for (let i = 0; i < 11; i++) { const y = 30 + i * 19; g.globalAlpha = 0.55 + r() * 0.3; g.fillRect(40, y, 220 + r() * 60, 6); }
          g.globalAlpha = 0.7; g.strokeStyle = "#5a2a1a"; g.lineWidth = 4; g.beginPath(); g.arc(TW * 0.76, TH * 0.72, 30, 0, 7); g.stroke(); g.globalAlpha = 1;
          break; }
        case 5: { /* engranajes / máquina */
          sky(g, "#7d6f53", "#3c3324"); g.fillStyle = "#cdbd95";
          [[TW * 0.36, TH * 0.5, 62, 0], [TW * 0.7, TH * 0.38, 40, 0.3]].forEach(([x, y, R, a0]) => {
            g.beginPath(); for (let i = 0; i < 36; i++) { const a = a0 + i / 36 * Math.PI * 2, rr = i % 3 === 0 ? R : R * 0.84; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill();
            g.fillStyle = "#3c3324"; g.beginPath(); g.arc(x, y, R * 0.3, 0, 7); g.fill(); g.fillStyle = "#cdbd95"; });
          break; }
        case 6: { /* ruta en perspectiva */
          sky(g, "#dccdA6", "#b3a47f"); g.fillStyle = "#4a3f2c"; g.beginPath(); g.moveTo(0, TH); g.lineTo(TW * 0.47, TH * 0.48); g.lineTo(TW * 0.53, TH * 0.48); g.lineTo(TW, TH); g.fill();
          g.fillStyle = "#e9dcb6"; for (let i = 0; i < 6; i++) { const q = i / 6, y = TH * (0.5 + q * q * 0.5); g.fillRect(TW / 2 - 1 - q * 4, y, 2 + q * 8, 4 + q * 14); }
          g.fillStyle = "#2a2216"; for (let i = 0; i < 9; i++) { const x = i < 5 ? i * 30 : TW - (i - 4) * 30; g.fillRect(x, TH * 0.3 - (i % 3) * 8, 4, TH * 0.22); }
          break; }
        default: { /* líder */
          g.fillStyle = "#a99c7c"; g.fillRect(0, 0, TW, TH); g.strokeStyle = "#2a2013"; g.lineWidth = 3;
          g.beginPath(); g.arc(TW / 2, TH / 2, 90, 0, 7); g.stroke(); g.beginPath(); g.moveTo(0, TH / 2); g.lineTo(TW, TH / 2); g.moveTo(TW / 2, 0); g.lineTo(TW / 2, TH); g.stroke();
          g.fillStyle = "#1d170e"; g.font = "800 120px Montserrat"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(String(4 + (r() * 5 | 0)), TW / 2, TH / 2 + 6);
        }
      }
      /* grano propio + viñeta, todo pasado a sepia */
      const vg = g.createRadialGradient(TW / 2, TH / 2, TH * 0.3, TW / 2, TH / 2, TW * 0.7); vg.addColorStop(0, "rgba(30,20,8,0)"); vg.addColorStop(1, "rgba(30,20,8,.55)");
      g.globalAlpha = 1; g.fillStyle = vg; g.fillRect(0, 0, TW, TH);
      g.globalCompositeOperation = "overlay"; g.globalAlpha = 0.35; g.drawImage(P.tex().grain[k % 4], 0, 0, TW, TH); g.globalCompositeOperation = "source-over"; g.globalAlpha = 1;
      out.push(c);
    }
    return (TILES = out);
  }
  const rot = (a, n) => a.slice(n % a.length).concat(a.slice(0, n % a.length));

  /* ------------------------------------------------------------ escenarios (fondos propios) */
  const vignette = (G, st, a0, a1, cy = 0.5) => {
    const { W, H } = st, g = G.createRadialGradient(W / 2, H * cy, Math.min(W, H) * 0.15, W / 2, H * cy, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, `rgba(12,9,4,${a0})`); g.addColorStop(1, `rgba(12,9,4,${a1})`); G.fillStyle = g; G.fillRect(0, 0, W, H);
  };
  const LINES = new Map();
  const linesFor = (st, seed) => { const k = `${st.W | 0}:${st.H | 0}:${seed}`; if (!LINES.has(k)) LINES.set(k, P.makeLines(K.rng(seed), st, 2)); return LINES.get(k); };

  /** tiras de película en capas (cuadros expuestos) que cruzan en sentidos opuestos */
  function stripsScene(G, st, lt, o = {}) {
    const { W, H, portrait } = st, T = (o.imgs || []).filter(Boolean).concat(tiles()), v = W * 0.035;
    const bg = G.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, "#3b3322"); bg.addColorStop(1, "#16110a"); G.fillStyle = bg; G.fillRect(0, 0, W, H);
    const on = clamp(lt / 0.5), sl = W * 0.6 * (1 - ease.expoOut(clamp(lt / 0.9)));
    G.save(); G.translate(W / 2, H / 2); G.rotate(o.rot ?? -0.07); G.scale(1.2, 1.2); G.translate(-W / 2, -H / 2);
    if (portrait) {
      P.filmStrip(G, st, { axis: "x", a0: H * 0.33, a1: H * 0.6, imgs: rot(T, 3), ar: 1.4, scroll: lt * v * 0.5 - W * 0.3 + sl * 0.5, k: 1.5, alpha: 0.3 * on });
      P.filmStrip(G, st, { axis: "x", a0: H * 0.06, a1: H * 0.25, imgs: T, ar: 1.45, scroll: -lt * v - W * 0.2 - sl, alpha: 0.95 * on });
      P.filmStrip(G, st, { axis: "x", a0: H * 0.7, a1: H * 0.89, imgs: rot(T, 5), ar: 1.45, scroll: lt * v * 0.8 + sl, alpha: 0.95 * on });
    } else {
      P.filmStrip(G, st, { axis: "x", a0: H * 0.28, a1: H * 0.74, imgs: rot(T, 3), ar: 1.4, scroll: lt * v * 0.5 - W * 0.3 + sl * 0.5, k: 1.7, alpha: 0.3 * on });
      P.filmStrip(G, st, { axis: "x", a0: -H * 0.02, a1: H * 0.3, imgs: T, ar: 1.45, scroll: -lt * v - W * 0.2 - sl, alpha: 0.95 * on });
      P.filmStrip(G, st, { axis: "x", a0: H * 0.72, a1: H * 1.04, imgs: rot(T, 5), ar: 1.45, scroll: lt * v * 0.8 + sl, alpha: 0.95 * on });
    }
    G.restore();
    P.lines(G, st, linesFor(st, 71), lt, 0.8 * on);
    P.paper(G, st, 77, 0.55);
    vignette(G, st, 0.15, 0.6);
  }

  /** sala oscura: haz del proyector con polvo flotando, rollos girando, parpadeo */
  function projectorScene(G, st, lt, o = {}) {
    const { W, H, u, portrait } = st, f = Math.floor(lt * 24), fl = 0.86 + 0.14 * K.rng(f * 31 + 7)(), on = flick(lt, 0, 0.5);
    const bg = G.createRadialGradient(W * 0.45, H * 0.55, 0, W * 0.45, H * 0.55, Math.hypot(W, H) * 0.7);
    bg.addColorStop(0, "#2a2216"); bg.addColorStop(1, "#070503"); G.fillStyle = bg; G.fillRect(0, 0, W, H);
    /* pantalla donde pega el haz (abajo-izquierda), con la imagen borrosa de una tira */
    const sx = portrait ? W * 0.78 : W * 0.86, sy = portrait ? H * 0.1 : H * 0.14;
    const ang = portrait ? 1.95 : 2.62, spread = portrait ? 0.32 : 0.26, L = Math.hypot(W, H) * 1.2;
    G.save(); G.globalCompositeOperation = "screen"; G.globalAlpha = on;
    for (const [sp, a] of [[spread, 0.3], [spread * 0.55, 0.32], [spread * 0.2, 0.35]]) {
      const lg = G.createLinearGradient(sx, sy, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L);
      lg.addColorStop(0, `rgba(255,232,180,${a * fl})`); lg.addColorStop(0.45, `rgba(240,200,140,${a * 0.35 * fl})`); lg.addColorStop(1, "rgba(240,200,140,0)");
      G.fillStyle = lg; G.beginPath(); G.moveTo(sx, sy);
      G.lineTo(sx + Math.cos(ang - sp) * L, sy + Math.sin(ang - sp) * L); G.lineTo(sx + Math.cos(ang + sp) * L, sy + Math.sin(ang + sp) * L); G.closePath(); G.fill();
    }
    /* polvo en el haz: brilla más cerca del eje */
    const r = K.rng(5521);
    for (let i = 0; i < 140; i++) {
      const bx = r(), by = r(), vx = (r() - 0.5) * 0.02, vy = -0.006 - r() * 0.012, s = u * (0.08 + Math.pow(r(), 3) * 0.35), ph = r() * 6.28;
      const x = (((bx + vx * lt + Math.sin(lt * 0.7 + ph) * 0.01) % 1) + 1) % 1 * W, y = (((by + vy * lt) % 1) + 1) % 1 * H;
      const a = Math.atan2(y - sy, x - sx), d = Math.abs(Math.atan2(Math.sin(a - ang), Math.cos(a - ang)));
      if (d > spread) continue;
      const k = (1 - d / spread) * (0.6 + 0.4 * Math.sin(lt * 3 + ph));
      G.globalAlpha = on * 0.9 * k; G.fillStyle = "#fff1d2"; G.beginPath(); G.arc(x, y, s, 0, 7); G.fill();
    }
    /* destello de la lente */
    G.globalAlpha = on; const lr = G.createRadialGradient(sx, sy, 0, sx, sy, u * 12); lr.addColorStop(0, `rgba(255,250,236,${0.95 * fl})`); lr.addColorStop(0.25, "rgba(255,210,140,.45)"); lr.addColorStop(1, "rgba(255,190,120,0)");
    G.fillStyle = lr; G.fillRect(sx - u * 12, sy - u * 12, u * 24, u * 24);
    G.restore();
    /* el proyector en silueta: cuerpo y dos rollos con rayos que giran */
    const R = u * (portrait ? 7 : 6.5), px = sx + R * 0.6, py = sy - R * 0.2;
    G.save(); G.fillStyle = "#0b0805"; G.strokeStyle = "rgba(255,226,170,.22)"; G.lineWidth = Math.max(1, u * 0.15);
    G.beginPath(); G.roundRect(px - R * 0.9, py - R * 0.1, R * 2.6, R * 1.3, R * 0.15); G.fill(); G.stroke();
    for (const [cx, cy, rr, dir] of [[px - R * 0.3, py - R * 1.1, R, 1], [px + R * 1.6, py - R * 0.95, R * 0.85, -1]]) {
      G.save(); G.translate(cx, cy); G.rotate(lt * 2.4 * dir);
      G.beginPath(); G.arc(0, 0, rr, 0, 7); for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; G.moveTo(Math.cos(a) * rr * 0.62 + rr * 0.24, Math.sin(a) * rr * 0.62); G.arc(Math.cos(a) * rr * 0.62, Math.sin(a) * rr * 0.62, rr * 0.24, 0, 7, true); }
      G.fill("evenodd"); G.stroke();
      G.fillStyle = "rgba(255,226,170,.25)"; G.beginPath(); G.arc(0, 0, rr * 0.12, 0, 7); G.fill(); G.fillStyle = "#0b0805";
      G.restore();
    }
    G.restore();
    /* fila de perforaciones al pie, como una tira que pasa por delante */
    P.perfRow(G, st, { at: H * (portrait ? 0.95 : 0.93), k: 1, scroll: -lt * W * 0.05, alpha: 0.85 * on, band: 0.6 });
    P.lines(G, st, linesFor(st, 73), lt, 0.6 * on);
    vignette(G, st, 0.05, 0.55);
  }

  /** rollos verticales en paralaje con cuadros que pasan */
  function reelScene(G, st, lt, o = {}) {
    const { W, H, portrait } = st, T = (o.imgs || []).filter(Boolean).concat(tiles()), v = H * 0.07, on = clamp(lt / 0.4);
    G.fillStyle = "#1c160d"; G.fillRect(0, 0, W, H);
    const sl = H * 0.5 * (1 - ease.expoOut(clamp(lt / 0.9)));
    const cols = portrait
      ? [[W * 0.18, W * 0.82, 0.25, 1.6, 0.4, 2], [-W * 0.08, W * 0.4, 0.95, 1, -1, 0], [W * 0.6, W * 1.08, 0.95, 1, 1, 4]]
      : [[W * 0.3, W * 0.7, 0.25, 1.6, 0.4, 2], [W * 0.03, W * 0.27, 0.95, 1, -1, 0], [W * 0.73, W * 0.97, 0.95, 1, 1, 4]];
    for (const [a0, a1, al, k, dir, sh] of cols)
      P.filmStrip(G, st, { axis: "y", a0, a1, imgs: rot(T, sh), ar: 1.35, scroll: dir * (lt * v + sl) - H * 0.2 * sh, k, alpha: al * on, zoom: 1.08 });
    P.lines(G, st, linesFor(st, 79), lt, 0.6 * on);
    P.paper(G, st, 83, 0.5);
    vignette(G, st, 0.2, 0.62);
  }

  /** cuadro de líder de película: círculos, cruz, aguja que barre y número */
  function leaderFrame(G, st, n, sweep, o = {}) {
    const { W, H, u } = st, cx = W / 2, cy = H / 2, R = Math.min(W, H) * 0.36, L = Math.hypot(W, H);
    G.fillStyle = "#b3a581"; G.fillRect(0, 0, W, H);
    G.fillStyle = "#857957"; G.beginPath(); G.moveTo(cx, cy); G.arc(cx, cy, L, -Math.PI / 2, -Math.PI / 2 + sweep * Math.PI * 2); G.closePath(); G.fill();
    G.strokeStyle = "#2a2013"; G.lineWidth = Math.max(1, u * 0.3);
    G.beginPath(); G.moveTo(0, cy); G.lineTo(W, cy); G.moveTo(cx, 0); G.lineTo(cx, H); G.stroke();
    G.strokeStyle = "#f0e6cc"; G.lineWidth = u * 0.9; G.beginPath(); G.arc(cx, cy, R, 0, 7); G.stroke();
    G.lineWidth = u * 0.5; G.beginPath(); G.arc(cx, cy, R * 0.8, 0, 7); G.stroke();
    G.strokeStyle = "#2a2013"; G.lineWidth = Math.max(1, u * 0.2); G.beginPath(); G.arc(cx, cy, R * 1.06, 0, 7); G.arc(cx, cy, R * 0.74, 0, 7); G.stroke();
    /* marcas de cuadro (esquinas) */
    G.strokeStyle = "rgba(42,32,19,.7)"; G.lineWidth = Math.max(1, u * 0.25); const m = u * 4, l = u * 6;
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) { G.beginPath(); G.moveTo(x, y + sy * l); G.lineTo(x, y); G.lineTo(x + sx * l, y); G.stroke(); }
    G.fillStyle = "#1d170e"; G.font = FONT(R * 1.15, 800); G.textAlign = "center"; G.textBaseline = "middle";
    G.fillText(String(n), cx + R * 0.02, cy + R * 0.06);
    if (o.label) { G.font = FONT(u * 1.6, 700); G.letterSpacing = u * 0.5 + "px"; G.fillStyle = "rgba(29,23,14,.7)"; G.fillText(o.label, cx, H - u * 5); G.letterSpacing = "0px"; }
  }
  /** fondo: líder en bucle (8→3), atenuado para que se lea el texto */
  function leaderScene(G, st, lt) {
    const n = 8 - (Math.floor(lt) % 6), sw = lt % 1;
    leaderFrame(G, st, n, sw);
    P.paper(G, st, 91, 0.7);
    G.fillStyle = "rgba(20,14,6,.45)"; G.fillRect(0, 0, st.W, st.H);
    vignette(G, st, 0.1, 0.65);
  }

  /** agujero de película quemada: centro blanco, borde naranja incandescente, carbón alrededor */
  function burnHole(G, st, x, y, R, lt, seed) {
    if (R <= 0.5) return;
    const r = K.rng(seed), o = [r() * 6, r() * 6, r() * 6, r() * 6];
    const path = k => { const p = new Path2D(); for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2;
      const rr = R * k * (1 + 0.2 * Math.sin(a * 3 + o[0] + lt * 1.5) + 0.12 * Math.sin(a * 5 + o[1] - lt * 2.3) + 0.07 * Math.sin(a * 11 + o[2] + lt * 4) + 0.05 * Math.sin(a * 17 + o[3]));
      const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr; i ? p.lineTo(px, py) : p.moveTo(px, py); } p.closePath(); return p; };
    G.save();
    const cg = G.createRadialGradient(x, y, R * 0.8, x, y, R * 1.7); cg.addColorStop(0, "rgba(40,20,6,.9)"); cg.addColorStop(1, "rgba(40,20,6,0)");
    G.fillStyle = cg; G.fill(path(1.6));
    G.globalCompositeOperation = "lighter"; G.shadowColor = "rgba(255,120,30,1)"; G.shadowBlur = R * 0.35;
    G.fillStyle = "#e05a14"; G.fill(path(1.16));
    G.fillStyle = "#ffae4a"; G.fill(path(1.07));
    G.globalCompositeOperation = "source-over"; G.shadowBlur = R * 0.2; G.shadowColor = "#fff2d0";
    G.fillStyle = "#fffaf0"; G.fill(path(1));
    G.restore();
  }

  P.hook = { words, ink, drawInk, meas, fit, shake, weave, flick, kicker, subLine, tiles, burnHole, leaderFrame, vignette,
    scene: { strips: stripsScene, projector: projectorScene, reel: reelScene, leader: leaderScene },
    COL: { CREAM, ORANGE, ORANGE_HI, RED, DARK } };

  /** presets de fondo (comparten firma con Kit.hook.bg) + perforaciones sobre foto/componente */
  function presets(ctx, p) {
    const imgs = () => [P.grade(ctx, p.src)];
    return {
      strips: (G, st, lt) => stripsScene(G, st, lt, { imgs: p.src ? imgs() : [] }),
      projector: (G, st, lt) => projectorScene(G, st, lt),
      reel: (G, st, lt) => reelScene(G, st, lt, { imgs: p.src ? imgs() : [] }),
      leader: (G, st, lt) => leaderScene(G, st, lt),
    };
  }
  /** encuadre de película encima de una foto o componente de fondo */
  function filmFrame(G, st, lt) {
    const { W, H, portrait } = st, v = W * 0.025;
    P.perfRow(G, st, { at: H * (portrait ? 0.04 : 0.06), k: 1, scroll: -lt * v, alpha: 0.95, band: 0.55 });
    P.perfRow(G, st, { at: H * (portrait ? 0.96 : 0.94), k: 1, scroll: lt * v * 0.8, alpha: 0.95, band: 0.55 });
  }
  P.hook.presets = presets; P.hook.filmFrame = filmFrame;
  const PRESETS = ["strips", "projector", "reel", "leader"];

  /** contexto con la capa main redirigida a un lienzo propio (para sacudir/trabar el cuadro entero) */
  const onSurface = (ctx, S) => Object.assign({}, ctx, { g: Object.assign({}, ctx.g, { main: S.g }) });
  /** pega el lienzo S en main con desplazamiento, sobre-escaneo y estela opcional */
  function blit(G, S, st, dx, dy, o = {}) {
    const { W, H } = st, z = o.zoom ?? 1.03, w = W * z, h = H * z, x = (W - w) / 2 + dx, y = (H - h) / 2 + dy;
    if (o.smearX) { const N = 10; for (let k = N - 1; k >= 0; k--) { G.globalAlpha = (o.alpha ?? 1) * (k === 0 ? 1 : 0.55 / (k + 1)); G.drawImage(S.c, x + o.smearX * k / (N - 1), y, w, h); } }
    else { G.globalAlpha = o.alpha ?? 1; G.drawImage(S.c, x, y, w, h); }
  }

  /* ================================================================ introv1 */
  K.register({
    name: "pelicula.introv1", tags: ["intro", "gancho", "apertura", "título", "impacto", "cuenta regresiva"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Arranca con la cuenta regresiva del líder de película (3-2-1, aguja que barre) y un destello; después un titular GIGANTE que entra palabra por palabra con barrido y estela (motion blur), golpea con sacudida y glitch de franjas ('^palabra^' en naranja con barra roja). Impacto (burnAt): la película se traba en la ventanilla y se QUEMA (agujero incandescente) → destello naranja→blanco. Fondo adaptable (bg: strips | projector | reel | leader | image con src | component con use/useParams | none). Sale con barrido.",
    example: { text: "¿POR QUÉ CAYÓ\nEL ^MURO^?", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", burnAt: 2.9 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra en naranja con barra roja (un signo pegado no se separa: '^MURO^?')." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha), con barra roja." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del titular, con barra roja." },
      countdown: { type: "number", default: 0.9, min: 0, max: 3, doc: "Segundos de la cuenta regresiva 3-2-1 del líder al empezar (0 = sin cuenta)." },
      wordAt: { type: "number", default: 1.0, doc: "Segundo del primer golpe de palabra." },
      stagger: { type: "number", default: 0.28, min: 0.08, doc: "Segundos entre palabra y palabra." },
      burnAt: { type: "number", default: 2.9, doc: "Impacto: segundo en que la película se traba y se quema (acepta '@palabra'; −1 = sin quemado)." },
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const st = ctx.stage, { W, H, u, portrait } = st, R = Math.min(3, ctx.dpr * 1.35);
      const S = P.surface(ctx), sctx = onSurface(ctx, S);
      const Ls = portrait ? splitPortrait(words(p.text)) : words(p.text);
      const longest = Ls.map(l => l.map(w => w.w).join(" ")).reduce((a, s) => s.length > a.length ? s : a, "") || "A";
      const fs = Math.min(fit(longest, W * (portrait ? 0.9 : 0.8)), H * (portrait ? 0.13 : 0.24) * (Ls.length > 2 ? (portrait ? 0.85 : 0.8) : 1));
      const lh = fs * 1.04, cy = H * (portrait ? 0.42 : 0.47), sp = meas(" ", fs);
      /* posiciones de cada palabra */
      let idx = 0; const placed = [];
      Ls.forEach((line, li) => {
        const ws = line.map(w => meas(w.w, fs)), tot = ws.reduce((a, b) => a + b, 0) + sp * (line.length - 1) - sp * line.filter(w => w.glue).length;
        let x = W / 2 - tot / 2; const yb = cy + (li - (Ls.length - 1) / 2) * lh + fs * 0.36;
        line.forEach((w, k) => {
          if (w.glue) x -= sp;
          const i = w.glue ? idx - 1 : idx++;
          placed.push({ ...w, x, yb, ww: ws[k], i, T: ink(w.w, fs, w.acc ? ORANGE_HI : CREAM, 31 + placed.length * 7, R) });
          x += ws[k] + sp;
        });
      });
      const hits = [...new Set(placed.map(w => w.i))].map(i => p.wordAt + i * p.stagger + 0.2);
      const lastHit = hits[hits.length - 1] ?? p.wordAt;
      const burn = p.burnAt != null && p.burnAt >= 0 ? p.burnAt : null;
      /* agujeros de quemado: en una esquina, lejos del centro del titular */
      const holes = portrait ? [[W * 0.84, H * 0.78, Math.min(W, H) * 0.34, 0.06], [W * 0.12, H * 0.16, Math.min(W, H) * 0.16, 0.22]]
                             : [[W * 0.9, H * 0.84, Math.min(W, H) * 0.3, 0.06], [W * 0.07, H * 0.14, Math.min(W, H) * 0.14, 0.22]];
      const BG = K.hook.bg(sctx, p, { auto: "strips", tone: () => P.grade(ctx, p.src), presets: presets(ctx, p) });
      return {
        dispose() { BG.dispose(); S.free(); },
        render(lt, b) {
          const G0 = S.begin(), oq = clamp((lt - b.dur) / 0.6), cd = p.countdown;
          /* ---------- cuenta regresiva del líder (opaca) */
          if (cd > 0 && lt < cd) {
            const per = cd / 3, k = Math.min(2, Math.floor(lt / per));
            leaderFrame(G0, st, 3 - k, (lt - k * per) / per, { label: "ARCHIVO · PICTURE START" });
            P.paper(G0, st, 93, 0.6);
            vignette(G0, st, 0, 0.45);
          } else {
            /* ---------- fondo (preset, foto o componente) */
            BG.render(lt, b);
            if (BG.mode === "image" || BG.mode === "component") filmFrame(G0, st, lt);
            /* banda oscura detrás del titular */
            const ba = prog(lt, p.wordAt - 0.25, 0.4, "linear"), bh = lh * Ls.length * 0.95 + fs * 0.6;
            if (ba > 0) {
              G0.save(); G0.globalAlpha = ba;
              const band = G0.createLinearGradient(0, cy - bh, 0, cy + bh);
              band.addColorStop(0, "rgba(14,10,5,0)"); band.addColorStop(0.5, "rgba(14,10,5,.66)"); band.addColorStop(1, "rgba(14,10,5,0)");
              G0.fillStyle = band; G0.fillRect(0, cy - bh, W, bh * 2); G0.restore();
            }
            /* ---------- titular: barrido con estela → golpe → glitch de aterrizaje */
            const f = Math.floor((b.t0 + lt) * 24);
            for (const w of placed) {
              const t0 = p.wordAt + w.i * p.stagger, q = prog(lt, t0, 0.22, "linear");
              if (q <= 0) continue;
              const e = ease.expoOut(q), dir = w.i % 2 ? 1 : -1, off = dir * W * 0.42 * (1 - e), sc = 1 + 0.32 * (1 - e);
              const ccx = w.x + w.ww / 2, ccy = w.yb - fs * 0.36;
              G0.save(); G0.translate(ccx + off, ccy); G0.scale(sc, sc); G0.translate(-ccx, -ccy);
              G0.shadowColor = "rgba(10,7,3,.85)"; G0.shadowBlur = fs * 0.12;
              const land = lt - (t0 + 0.2);
              if (land >= 0 && land < 0.14 && K.rng(f * 13 + w.i)() < 0.85) {
                G0.shadowBlur = 0; P.slices(G0, w.T.c, w.x - w.T.pad, w.yb - w.T.base, w.T.w, w.T.h, f, 0.09, 5 + w.i);
              } else if (q < 1) {
                const N = 9, L = -dir * Math.min(W * 0.3, W * 0.42 * 10 * Math.pow(2, -10 * q) * 0.22);
                for (let k = N - 1; k >= 0; k--) { G0.globalAlpha = k === 0 ? clamp(q * 5) : 0.5 / (k + 1); drawInk(G0, w.T, w.x + L * k / (N - 1), w.yb); }
              } else drawInk(G0, w.T, w.x, w.yb);
              G0.restore();
              /* barra roja bajo la palabra destacada */
              if (w.acc) {
                const bq = prog(lt, t0 + 0.24, 0.3, "out");
                if (bq > 0) { G0.fillStyle = RED; G0.fillRect(w.x + fs * 0.02, w.yb + fs * 0.1, w.ww * 0.96 * bq, Math.max(3, fs * 0.075)); }
              }
            }
            /* rótulos */
            const top = cy - lh * Ls.length / 2 - fs * 0.32 - u * (portrait ? 3.6 : 3.2), bot = cy + lh * Ls.length / 2 + u * (portrait ? 5 : 4.4);
            kicker(G0, p.kicker, W / 2, top, u * (portrait ? 2.6 : 2.0), flick(lt, Math.max(0, p.wordAt - 0.3), 0.5));
            subLine(G0, p.sub, W / 2, bot, u * (portrait ? 2.9 : 2.4), prog(lt, lastHit + 0.2, 0.45, "linear"), "center", true, W * 0.9);
            /* ---------- quemado (impacto) */
            if (burn != null && lt >= burn + 0.08 && lt < burn + 0.95) {
              const bq = ease.out(clamp((lt - burn - 0.08) / 0.6));
              for (const [hx, hy, hr, dl] of holes) burnHole(G0, st, hx, hy, hr * clamp(bq * 1.15 - dl), lt, Math.round(hx));
            }
            if (burn != null && lt > burn + 0.95) P.flush(G0, st, 0.35 * (1 - clamp((lt - burn - 0.95) / 1.2)));
          }
          /* ---------- al cuadro principal: sacudida, vaivén de ventanilla, salto de cuadro, salida */
          const G = ctx.g.main, all = hits.concat(burn != null ? [burn + 0.05] : []);
          const [sx, sy] = shake(lt, all, u * 0.9), [wx, wy] = weave(lt, u);
          G.save();
          const slip = burn != null ? prog(lt, burn, 0.32, "linear") : 0;
          if (slip > 0 && slip < 1) {
            /* la película se sale de la ventanilla: dos cuadros con la línea de cuadro entre medio */
            const off = H * 0.22 * Math.sin(Math.PI * slip), gap = H * 0.035;
            blit(G, S, st, sx, sy - off);
            blit(G, S, st, sx, sy - off + H + gap);
            G.globalAlpha = 1; G.fillStyle = "#0a0704"; G.fillRect(0, H - off + sy, W, gap);
            P.perfRow(G, st, { at: H - off + sy + gap / 2, k: 0.6, alpha: 0.8, band: 0 });
          } else {
            const ex = oq > 0 ? -W * 0.5 * ease.in(oq) : 0;
            blit(G, S, st, sx + wx + ex, sy + wy, { alpha: 1 - oq * oq, smearX: oq > 0 ? W * 0.3 * oq : 0 });
          }
          G.restore();
          /* destellos en la capa de arriba: fin de la cuenta y quemado */
          if (cd > 0) P.leak(ctx.g.top, st, "flash", (lt - cd + 0.06) / 0.4, { strength: 0.9 });
          if (burn != null) P.leak(ctx.g.top, st, "burn", (lt - burn - 0.42) / 0.95, { dir: "rtl" });
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "pelicula.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "intertítulo", "cine mudo"], layer: "main", post: 0.6,
    summary: "GANCHO tipo intertítulo de cine mudo. Se abre el iris; la pregunta gigante se EXPONE letra por letra (cada letra destella al aparecer) entre filetes dobles con rombo, y la respuesta llega en una TIRA DE PELÍCULA que cruza con barrido y estela, golpea con sacudida y destello, y queda atravesada (p. ej. 'NADIE DIO LA ORDEN'). Fondo adaptable (bg: projector | strips | reel | leader | image con src | component con use/useParams | none). Sale cerrando el iris.",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Archivo · Berlín 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.5 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba, con barra roja." },
      stamp: { type: "string", default: "", doc: "Respuesta que llega en la tira de película (vacío = sin tira)." },
      stampAt: { type: "number", default: 2.5, doc: "Segundo en que entra la tira (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.45, doc: "Segundo en que empieza a exponerse la pregunta." },
      cps: { type: "number", default: 18, min: 4, doc: "Letras por segundo." },
      ...K.hook.bgParams(PRESETS, "auto"),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const st = ctx.stage, { W, H, u, portrait } = st, R = Math.min(3, ctx.dpr * 1.2);
      const S = P.surface(ctx), sctx = onSurface(ctx, S);
      const Ls = (portrait ? splitPortrait(words(p.text)) : words(p.text)).map(l => l.map((w, i) => (i && !w.glue ? " " : "") + w.w).join(""));
      const longest = Ls.reduce((a, s) => meas(s, 100) > meas(a, 100) ? s : a, "") || "A";
      const fs = Math.min(fit(longest, W * (portrait ? 0.88 : 0.62)), H * (portrait ? 0.11 : 0.17));
      const lh = fs * 1.06, x0 = portrait ? W / 2 : W * 0.08, y0 = portrait ? H * 0.38 - (Ls.length * lh) / 2 : H * 0.24;
      const lines = Ls.map((s, i) => ({ s, T: ink(s, fs, CREAM, 51 + i, R), w: meas(s, fs), yb: y0 + i * lh + fs * 0.74 }));
      const blockW = Math.max(...lines.map(l => l.w)), bx = portrait ? W / 2 - blockW / 2 : x0;
      const total = Ls.reduce((a, s) => a + s.length, 0);
      const ruleTop = y0 - fs * 0.22, ruleBot = y0 + Ls.length * lh + fs * 0.12;
      /* la tira de la respuesta: lienzo hecho una vez */
      const stamp = String(p.stamp || "").toUpperCase();
      let strip = null;
      if (stamp) {
        const SH = portrait ? H * 0.11 : H * 0.17, SW = W * 1.3, pf = P.perf(st, SH / (u * 55));
        const sfs = Math.min(fit(stamp, W * (portrait ? 0.82 : 0.7)), SH * 0.42);
        const c = P.canvas(SW * R, SH * R), g = c.getContext("2d"); g.scale(R, R);
        g.fillStyle = "#17110a"; g.fillRect(0, 0, SW, SH);
        const band = pf.h * 1.6, inner = g.createLinearGradient(0, band, 0, SH - band); inner.addColorStop(0, "#2f2516"); inner.addColorStop(0.5, "#3b2f1c"); inner.addColorStop(1, "#2f2516");
        g.fillStyle = inner; g.fillRect(0, band, SW, SH - band * 2);
        g.fillStyle = "rgba(243,234,219,.12)"; for (let x = SW * 0.05; x < SW; x += (SH - band * 2) * 1.5) g.fillRect(x, band, Math.max(1, u * 0.12), SH - band * 2);
        g.fillStyle = "#efe4c6"; g.shadowColor = "rgba(255,240,205,.6)"; g.shadowBlur = pf.r * 1.5;
        for (const yy of [band / 2, SH - band / 2]) { g.beginPath(); for (let x = pf.pitch * 0.3; x < SW; x += pf.pitch) g.roundRect(x, yy - pf.h * 0.32, pf.w * 0.8, pf.h * 0.64, pf.r * 0.8); g.fill(); }
        g.shadowBlur = 0;
        const T = ink(stamp, sfs, ORANGE_HI, 77, R), tw = meas(stamp, sfs), bw = sfs * 0.9, tx = SW / 2 - (tw + bw + sfs * 0.4) / 2;
        g.fillStyle = RED; g.fillRect(tx, SH / 2 - sfs * 0.12, bw, sfs * 0.24);
        drawInk(g, T, tx + bw + sfs * 0.4, SH / 2 + sfs * 0.36);
        g.globalCompositeOperation = "multiply"; g.globalAlpha = 0.5; g.drawImage(P.tex().paper, 0, 0, SW, SH);
        const scy = portrait ? ruleBot + SH * 1.1 : Math.min(H * 0.8, ruleBot + SH * 0.95);
        strip = { c, SW, SH, cy: scy };
      }
      const BG = K.hook.bg(sctx, p, { auto: "projector", tone: () => P.grade(ctx, p.src), presets: presets(ctx, p) });
      return {
        dispose() { BG.dispose(); S.free(); },
        render(lt, b) {
          const G0 = S.begin(), f = Math.floor((b.t0 + lt) * 24), oq = clamp((lt - b.dur) / 0.6);
          BG.render(lt, b);
          if (BG.mode === "image" || BG.mode === "component") filmFrame(G0, st, lt);
          /* oscurecer la zona del texto */
          const dk = portrait ? G0.createLinearGradient(0, 0, 0, H * 0.75) : G0.createLinearGradient(0, 0, W * 0.8, 0);
          dk.addColorStop(0, "rgba(12,9,4,.86)"); dk.addColorStop(0.6, "rgba(12,9,4,.62)"); dk.addColorStop(1, "rgba(12,9,4,0)");
          G0.fillStyle = dk; G0.fillRect(0, 0, W, H);
          /* filetes dobles con rombo (intertítulo) */
          const rq = prog(lt, p.typeAt - 0.15, 0.55, "out");
          if (rq > 0) for (const [y, flip] of [[ruleTop, 1], [ruleBot, -1]]) {
            const cx = bx + blockW / 2, half = (blockW / 2 + fs * 0.25) * rq;
            G0.save(); G0.fillStyle = "rgba(243,234,219,.85)"; G0.shadowColor = "rgba(10,7,3,.9)"; G0.shadowBlur = u;
            G0.fillRect(cx - half, y, half * 2, Math.max(1.5, u * 0.28)); G0.fillRect(cx - half * 0.94, y + flip * u * 0.75, half * 1.88, Math.max(1, u * 0.12));
            G0.translate(cx, y + u * 0.1); G0.rotate(Math.PI / 4); const d = u * 0.9 * rq; G0.fillStyle = RED; G0.fillRect(-d / 2, -d / 2, d, d);
            G0.restore();
          }
          /* pregunta expuesta letra por letra (24 cuadros/s), la letra nueva destella */
          const tq = Math.floor(lt * 24) / 24, nf = clamp((tq - p.typeAt) * p.cps, 0, total), n = Math.floor(nf);
          let left = n, base = 0;
          const flk = 0.9 + 0.1 * K.rng(f * 7 + 3)();
          lines.forEach((l, i) => {
            const k = Math.min(l.s.length, left); left -= k;
            if (k > 0) {
              const x = portrait ? W / 2 - l.w / 2 : x0, pw = k >= l.s.length ? l.w + fs : meas(l.s.slice(0, k), fs);
              G0.save(); G0.globalAlpha = flk; G0.beginPath(); G0.rect(x - fs * 0.2, l.yb - fs * 1.2, pw + fs * 0.2, fs * 1.6); G0.clip();
              G0.shadowColor = "rgba(10,7,3,.8)"; G0.shadowBlur = fs * 0.1; drawInk(G0, l.T, x, l.yb); G0.restore();
              /* destello de la letra recién expuesta */
              const gi = n - base - 1;
              if (gi >= 0 && gi < l.s.length && k === gi + 1 && n < total) {
                const ga = 1 - (nf - n);
                G0.save(); G0.globalCompositeOperation = "lighter"; G0.font = FONT(fs); G0.letterSpacing = LS(fs) + "px"; G0.textBaseline = "alphabetic";
                G0.fillStyle = `rgba(255,236,190,${0.75 * ga})`; G0.shadowColor = "rgba(255,170,80,.9)"; G0.shadowBlur = fs * 0.35;
                G0.fillText(l.s[gi], x + meas(l.s.slice(0, gi), fs), l.yb); G0.restore();
              }
            }
            base += l.s.length;
          });
          kicker(G0, p.kicker, portrait ? W / 2 : bx, ruleTop - u * (portrait ? 3.2 : 3.4), u * (portrait ? 2.5 : 1.9), flick(lt, 0.1, 0.5), portrait ? "center" : "left");
          /* la tira con la respuesta: barrido desde la derecha con estela, golpe, glitch y deriva */
          let hit = -9;
          if (strip && lt >= p.stampAt) {
            const q = prog(lt, p.stampAt, 0.34, "linear"), e = ease.expoOut(q), land = p.stampAt + 0.3; hit = land;
            const drift = -u * 0.9 * Math.max(0, lt - land), x = (W - strip.SW) / 2 + W * 1.15 * (1 - e) + drift;
            G0.save(); G0.translate(W / 2, strip.cy); G0.rotate(-0.045); G0.translate(-W / 2, -strip.cy);
            G0.shadowColor = "rgba(0,0,0,.7)"; G0.shadowBlur = u * 2; G0.shadowOffsetY = u * 0.6;
            const y = strip.cy - strip.SH / 2;
            if (q < 1) {
              const N = 10, L = Math.min(W * 0.45, W * 1.15 * 10 * Math.pow(2, -10 * q) * 0.2);
              for (let k = N - 1; k >= 0; k--) { G0.globalAlpha = k === 0 ? clamp(q * 6) : 0.5 / (k + 1); G0.drawImage(strip.c, x + L * k / (N - 1), y, strip.SW, strip.SH); }
            } else if (lt - land < 0.16 && K.rng(f * 29 + 1)() < 0.8) { G0.shadowBlur = 0; P.slices(G0, strip.c, x, y, strip.SW, strip.SH, f, 0.05, 9); }
            else G0.drawImage(strip.c, x, y, strip.SW, strip.SH);
            G0.restore();
          }
          /* al cuadro principal + iris (abre al entrar, cierra al salir) */
          const G = ctx.g.main, [sx, sy] = shake(lt, [hit], u * 1.1), [wx, wy] = weave(lt, u);
          G.save(); blit(G, S, st, sx + wx, sy + wy); G.restore();
          const iq = Math.min(ease.out(clamp(lt / 0.5)), 1 - ease.in(oq)), RR = Math.hypot(W, H) * 0.55;
          if (iq < 1) {
            const r0 = RR * iq, icx = portrait ? W / 2 : W * 0.42, icy = H * 0.45;
            G.save(); G.globalAlpha = 1;
            const ig = G.createRadialGradient(icx, icy, Math.max(0, r0 * 0.94), icx, icy, r0 + 1);
            ig.addColorStop(0, "rgba(5,4,3,0)"); ig.addColorStop(1, "rgba(5,4,3,1)");
            G.fillStyle = ig; G.beginPath(); G.rect(0, 0, W, H); G.arc(icx, icy, r0 + 0.5, 0, 7, true); G.fill();
            G.beginPath(); G.arc(icx, icy, r0 + 1, 0, 7); G.fill(); G.restore();
          }
          if (strip) P.leak(ctx.g.top, st, "flash", (lt - hit + 0.04) / 0.35, { strength: 0.55 });
        },
      };
    },
  });
})();

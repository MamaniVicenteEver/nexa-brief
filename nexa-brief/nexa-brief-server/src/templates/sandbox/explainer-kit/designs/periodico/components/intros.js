/* =============================================================================
   periodico · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = ROTATIVA: el papel pasa a toda velocidad entre los rodillos con
             desenfoque de movimiento y un titular GIGANTE a máquina golpea palabra
             por palabra (scramble + estela + sacudida). En extraAt la rotativa
             frena en seco y golpea el sello «EXTRA».
   introv2 = PORTADA QUE GIRA: una portada de diario gira hacia la cámara y se
             detiene (rack focus), la pregunta se tipea a máquina y la respuesta
             llega como RECORTE de diario que golpea encima, con sello EXTRA.
   Escenarios compartidos en Kit.periodico.hook (press, spin, desk, stand,
   finish…) para que el cierre (outro.js) hable el mismo idioma.

   Rendimiento: estas piezas dibujan en ctx.g.main con su propia cámara barata
   (mosaico de papel + máscara de foco a media resolución, portadas horneadas
   UNA vez por tamaño). Mientras cubren el cuadro mandan F.hint({cover:true}) y
   el post() de la familia (la parte cara: 0,3–1,8 s/cuadro) se saltea.
   Todo es función pura de lt.
   ========================================================================== */
(function () {
  const K = Kit, P = Kit.periodico, { clamp, lerp, prog, ease } = K;
  const INK = "#141113", BAR = "#161315", BARINK = "#efecef", MAG = "#8e4f72";
  const FT = P.FT, FN = P.FN, FB = P.FB;
  const Fam = ctx => ctx.family.periodico;

  /* ------------------------------------------------------------ caché */
  const memoMap = new Map();
  function memo(key, fn) {
    if (memoMap.has(key)) return memoMap.get(key);
    const v = fn(); memoMap.set(key, v);
    while (memoMap.size > 28) memoMap.delete(memoMap.keys().next().value);
    return v;
  }
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  const hr = P.hr;

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → [[{w, acc, glue}]] ('^x^' = palabra en barra negra) */
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
  /** 9:16: parte los renglones para que el titular pueda ser grande (los signos pegados no se separan) */
  function rewrap(Ls, fs, maxW) {
    const out = [];
    for (const line of Ls) {
      let cur = [];
      const width = ws => ws.reduce((a, w, i) => a + P.measure(w.w, tfont(fs)) + (w.acc ? fs * 0.5 : 0) + (i && !w.glue ? P.measure(" ", tfont(fs)) : 0), 0);
      for (const w of line) {
        if (cur.length && !w.glue && width([...cur, w]) > maxW) { out.push(cur); cur = [{ ...w, glue: false }]; }
        else cur.push(w);
      }
      if (cur.length) out.push(cur);
    }
    return out;
  }
  /** sacudida de cámara: suma de golpes que decaen (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.34) a += Math.pow(1 - d / 0.34, 2); }
    return [Math.sin(lt * 93) * amp * a, Math.cos(lt * 71) * amp * a * 0.8];
  }
  const tfont = fs => `400 ${fs}px ${FT}`;
  /** ancho de letra máximo que entra en w (Cutive) */
  const fitFs = (str, w, font = FT, weight = 400) => w * 100 / Math.max(1, P.measure(str, `${weight} 100px ${font}`));

  /** corchetes [ ] finos alrededor de una caja (escuadras del diseño) */
  function brackets(G, x0, y0, x1, y1, lw, arm, q = 1) {
    if (q <= 0) return;
    const a = arm * q;
    G.fillStyle = INK;
    G.fillRect(x0, y0, lw, y1 - y0); G.fillRect(x0, y0, a, lw); G.fillRect(x0, y1 - lw, a, lw);
    G.fillRect(x1 - lw, y0, lw, y1 - y0); G.fillRect(x1 - a, y0, a, lw); G.fillRect(x1 - a, y1 - lw, a, lw);
  }
  /** rótulo chico entre corchetes con ⊠ (scramble al aparecer) */
  function label(G, str, x, y, fs, lt, t0, seed, align = "center", color = INK) {
    if (!str || lt < t0) return;
    const s = String(str).toUpperCase(), w = P.measure(s, tfont(fs));
    G.save(); G.letterSpacing = fs * 0.18 + "px";
    const ww = w + fs * 0.18 * s.length;
    const cx = align === "center" ? x : x + fs * 1.9 + ww / 2;
    const q = ease.out(clamp((lt - t0) / 0.4));
    P.tw(G, P.scramble(s, lt, t0 + 0.05, 0.9, seed), cx, y, fs, { align: "center", weight: 0.03, color });
    G.letterSpacing = "0px";
    brackets(G, cx - ww / 2 - fs * 0.7, y - fs * 1.05, cx + ww / 2 + fs * 0.55, y + fs * 0.45, Math.max(1, fs * 0.09), fs * 0.5, q);
    P.icon(G, cx - ww / 2 - fs * 1.65, y - fs * 0.3, fs * 0.8, { color });
    G.restore();
  }
  /** barra negra con texto blanco (la "lower third" del diseño) que se despliega desde la izquierda */
  function blackBar(G, str, cx, y, fs, q, lt, t0, seed, o = {}) {
    if (!str || q <= 0) return null;
    const s = o.upper === false ? String(str) : String(str).toUpperCase();
    const w = P.measure(s, tfont(fs)) + fs * 1.4, h = fs * 1.55, x = (o.align === "left" ? cx : cx - w / 2), bw = w * ease.out(q);
    G.fillStyle = BAR; G.fillRect(x, y - h / 2, bw, h);
    G.save(); G.beginPath(); G.rect(x, y - h / 2, bw, h); G.clip();
    P.tw(G, P.scramble(s, lt, t0 + 0.12, 0.7, seed), x + fs * 0.7, y + fs * 0.36, fs, { color: BARINK, weight: 0.012 });
    G.restore();
    return { x, w, h };
  }
  /** lavado de papel claro detrás del texto: legible sobre cualquier fondo (spot de luz del diseño) */
  function wash(G, W, cy, half, a) {
    if (a <= 0) return;
    const g = G.createLinearGradient(0, cy - half, 0, cy + half);
    g.addColorStop(0, "rgba(232,229,233,0)"); g.addColorStop(0.22, `rgba(232,229,233,${(a * 0.82).toFixed(3)})`);
    g.addColorStop(0.78, `rgba(232,229,233,${(a * 0.82).toFixed(3)})`); g.addColorStop(1, "rgba(232,229,233,0)");
    G.fillStyle = g; G.fillRect(0, cy - half, W, half * 2);
  }
  /** sello de goma magenta (doble filete, girado) que golpea */
  function stamp(G, str, x, y, fs, rot, q, o = {}) {
    if (!str || q <= 0) return;
    const s = String(str).toUpperCase(), e = ease.expoOut(q), sc = 1 + 1.4 * (1 - e);
    G.save(); G.globalAlpha *= clamp(q * 4) * (o.alpha ?? 1); G.translate(x, y); G.rotate(rot); G.scale(sc, sc);
    G.font = `700 ${fs}px ${FN}`; G.letterSpacing = fs * 0.12 + "px";
    const w = G.measureText(s).width + fs * 1.1, h = fs * 1.55;
    const col = o.color || MAG;
    G.globalCompositeOperation = o.mode || "multiply";
    G.strokeStyle = col; G.lineWidth = fs * 0.09; G.strokeRect(-w / 2, -h / 2, w, h);
    G.lineWidth = fs * 0.035; G.strokeRect(-w / 2 + fs * 0.16, -h / 2 + fs * 0.16, w - fs * 0.32, h - fs * 0.32);
    G.fillStyle = col; G.textAlign = "center"; G.textBaseline = "middle"; G.fillText(s, fs * 0.06, fs * 0.05);
    /* tinta gastada: motas que borran (deterministas) */
    G.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 46; i++) { const px = (hr(71, i) - 0.5) * w, py = (hr(72, i) - 0.5) * h, r = fs * (0.02 + hr(73, i) * 0.07); G.beginPath(); G.arc(px, py, r, 0, 7); G.fill(); }
    G.restore();
  }

  /* ================================================================ escenarios */
  /** mosaico de papel con origen de mundo en (ox,oy) de pantalla */
  function tiles(g, img, T, ox, oy, W, H, zoom) {
    const Ts = T * zoom, x0 = ((ox % Ts) + Ts) % Ts - Ts, y0 = ((oy % Ts) + Ts) % Ts - Ts;
    for (let x = x0; x < W; x += Ts) for (let y = y0; y < H; y += Ts) g.drawImage(img, x, y, Ts + 0.6, Ts + 0.6);
  }
  /**
   * El periódico infinito visto por una cámara barata:
   * o = { x, y (centro en px de mundo), zoom, vx, vy (barrido en px de pantalla), fx, fy, focusR, dof }
   */
  function paperView(G, ctx, o) {
    const F = Fam(ctx), { W, H } = ctx.stage, PP = F.paper, zoom = o.zoom || 1;
    const ox = W / 2 - o.x * zoom, oy = H / 2 - o.y * zoom;
    const a0 = G.globalAlpha;
    G.fillStyle = "#cfcbd0"; G.fillRect(0, 0, W, H);
    let vx = o.vx || 0, vy = o.vy || 0; const len = Math.hypot(vx, vy), maxL = Math.max(W, H) * 0.3;
    if (len > maxL) { vx *= maxL / len; vy *= maxL / len; }
    const n = len > 2 ? Math.min(16, Math.ceil(Math.min(len, maxL) / 6)) : 1;
    const src = PP.c;
    if (n === 1) tiles(G, src, PP.T, ox, oy, W, H, zoom);
    else {
      /* barrido: el papel se compone UNA vez a media resolución (con margen) y se promedian copias desplazadas */
      const dpr = ctx.dpr, k = dpr / 2, mg = Math.ceil(maxL / 2) + 4;
      const Vc = memo(`per-smear:${W | 0}:${H | 0}:${dpr}`, () => mk((W + 2 * mg) * k, (H + 2 * mg) * k)), vg = Vc.getContext("2d");
      vg.setTransform(k, 0, 0, k, 0, 0); vg.fillStyle = "#cfcbd0"; vg.fillRect(0, 0, W + 2 * mg, H + 2 * mg);
      tiles(vg, src, PP.T, ox + mg, oy + mg, W + 2 * mg, H + 2 * mg, zoom);
      for (let i = 0; i < n; i++) {
        const f = i / (n - 1) - 0.5;
        G.globalAlpha = a0 / (i + 1);
        G.drawImage(Vc, -mg + f * vx, -mg + f * vy, W + 2 * mg, H + 2 * mg);
      }
    }
    G.globalAlpha = a0;
    /* profundidad de campo: papel desenfocado (media resolución) con un agujero elíptico en el foco */
    if (o.dof !== false && n === 1) {
      const dpr = ctx.dpr, k = dpr / 2;
      const Mk = memo(`per-mask:${W | 0}:${H | 0}:${dpr}`, () => mk(W * k, H * k));
      const mg = Mk.getContext("2d");
      mg.setTransform(k, 0, 0, k, 0, 0); mg.globalCompositeOperation = "source-over"; mg.clearRect(0, 0, W, H);
      tiles(mg, F.paperBlur, PP.T, ox, oy, W, H, zoom);
      const fr = o.focusR ?? 1;
      if (fr > 0.01) {
        mg.globalCompositeOperation = "destination-out";
        mg.setTransform(W * 0.5 * fr * k, 0, 0, H * 0.55 * fr * k, (o.fx ?? 0.5) * W * k, (o.fy ?? 0.5) * H * k);
        const rg = mg.createRadialGradient(0, 0, 0, 0, 0, 1);
        rg.addColorStop(0, "rgba(0,0,0,1)"); rg.addColorStop(0.42, "rgba(0,0,0,1)"); rg.addColorStop(1, "rgba(0,0,0,0)");
        mg.fillStyle = rg; mg.fillRect(-2, -2, 4, 4);
        mg.setTransform(1, 0, 0, 1, 0, 0); mg.globalCompositeOperation = "source-over";
      }
      G.drawImage(Mk, 0, 0, W, H);
    }
  }
  /** acabado del diseño: spot de luz, virado magenta que deriva, viñeta y grano */
  function finish(G, ctx, lt, o = {}) {
    const F = Fam(ctx), { W, H } = ctx.stage, D = Math.hypot(W, H);
    G.save();
    G.globalCompositeOperation = "screen";
    const fx = (o.fx ?? 0.5) * W, fy = (o.fy ?? 0.5) * H;
    let gr = G.createRadialGradient(fx, fy * 0.95, 0, fx, fy, D * 0.38);
    gr.addColorStop(0, `rgba(255,250,255,${(0.42 * (o.light ?? 1)).toFixed(3)})`); gr.addColorStop(1, "rgba(255,255,255,0)");
    G.fillStyle = gr; G.fillRect(0, 0, W, H);
    G.globalCompositeOperation = "color";
    [[0.13, 0.0, 0.34], [0.09, 2.1, 0.22], [0.05, 4.2, 0.28]].forEach(([sp, ph, a], bi) => {
      const bx = W * (0.5 + 0.62 * Math.sin(lt * sp + ph + (o.seed || 0))), by = H * (0.5 + 0.55 * Math.cos(lt * sp * 1.3 + ph * 0.7));
      const al = clamp(a * (0.75 + 0.25 * Math.sin(lt * 0.4 + bi)) + (o.tint || 0));
      const g2 = G.createRadialGradient(bx, by, 0, bx, by, D * 0.46);
      g2.addColorStop(0, `rgba(150,62,108,${al.toFixed(3)})`); g2.addColorStop(1, "rgba(150,62,108,0)");
      G.fillStyle = g2; G.fillRect(0, 0, W, H);
    });
    G.globalCompositeOperation = "multiply";
    gr = G.createRadialGradient(W / 2, H / 2, D * 0.22, W / 2, H / 2, D * 0.62);
    gr.addColorStop(0, "rgb(255,255,255)"); gr.addColorStop(1, o.vig || "rgb(70,64,70)");
    G.fillStyle = gr; G.fillRect(0, 0, W, H);
    if (F.noise) {
      G.globalCompositeOperation = "overlay"; G.globalAlpha = 0.2;
      G.fillStyle = G.createPattern(F.noise[Math.floor(lt * 24) % F.noise.length], "repeat"); G.fillRect(0, 0, W, H);
    }
    G.restore();
  }

  /* ---------------------------------------------------- portada horneada */
  const HEADS = ["LA NOCHE QUE\nTODO CAMBIÓ", "NADIE LO\nESPERABA", "EDICIÓN\nEXTRA", "LO QUE NO\nSE DIJO", "EL DÍA\nSIGUIENTE"];
  /**
   * Portada de diario (cabecera, filetes, titular, foto en semitono, columnas recortadas del papel).
   * Se hornea UNA vez por tamaño/variante con su sombra y una versión desenfocada.
   * Devuelve { c, b (desenfocada), pw, ph, pad } en px CSS.
   */
  function frontPage(ctx, v = 0, ph = 500, name = "TITULARES") {
    const F = Fam(ctx), dpr = ctx.dpr;
    return memo(`per-front:${v}:${ph | 0}:${dpr}:${name}:${F.size}`, () => {
      const pw = ph * 0.7, pad = ph * 0.08, k = Math.min(dpr, 1600 / (ph + 2 * pad));
      const c = mk((pw + 2 * pad) * k, (ph + 2 * pad) * k), g = c.getContext("2d");
      g.scale(k, k); g.translate(pad, pad);
      /* sombra (una sola vez) */
      g.save(); g.shadowColor = "rgba(10,6,9,.55)"; g.shadowBlur = ph * 0.05 * k; g.shadowOffsetY = ph * 0.018 * k;
      g.fillStyle = "#dcd9dd"; g.fillRect(0, 0, pw, ph); g.restore();
      g.save(); g.beginPath(); g.rect(0, 0, pw, ph); g.clip();
      const r = K.rng(311 + v * 17);
      for (let i = 0; i < 14; i++) { const x = r() * pw, y = r() * ph, rad = ph * (0.05 + r() * 0.2), gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, r() < 0.5 ? "rgba(60,50,58,.08)" : "rgba(255,255,255,.12)"); gr.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2); }
      const m = pw * 0.055, iw = pw - 2 * m;
      g.fillStyle = INK; g.textBaseline = "alphabetic";
      /* cabecera */
      let fs = Math.min(ph * 0.1, fitFs(name, iw * 0.92, FB, 700));
      let y = m + fs * 0.92;
      g.font = `700 ${fs}px ${FB}`; g.textAlign = "center"; g.fillText(name, pw / 2, y);
      y += fs * 0.3;
      g.fillRect(m, y, iw, ph * 0.006); g.fillRect(m, y + ph * 0.011, iw, ph * 0.0018);
      const dfs = ph * 0.0145; g.font = `400 ${dfs}px ${FN}`;
      g.textAlign = "left"; g.fillText("AÑO XLII · N.º 15.204", m, y + ph * 0.032);
      g.textAlign = "center"; g.fillText("EDICIÓN EXTRAORDINARIA", pw / 2, y + ph * 0.032);
      g.textAlign = "right"; g.fillText("PRECIO 50 CTS.", pw - m, y + ph * 0.032);
      y += ph * 0.043; g.fillRect(m, y, iw, ph * 0.0018);
      /* titular */
      const hl = HEADS[v % HEADS.length].split("\n");
      const hfs = Math.min(ph * 0.085, ...hl.map(l => fitFs(l, iw, FB, 700)));
      g.font = `700 ${hfs}px ${FB}`; g.textAlign = "center";
      hl.forEach((l, i) => g.fillText(l, pw / 2, y + hfs * (1.08 + i * 1.02)));
      y += hfs * (0.3 + hl.length * 1.02) + ph * 0.012;
      g.fillRect(pw * 0.3, y, pw * 0.4, ph * 0.0018); y += ph * 0.016;
      /* foto en semitono (abstracta: sirve para cualquier tema) */
      const fw = iw * 0.6, fh = fw * 0.72, fx = v % 2 ? m + iw - fw : m;
      g.fillStyle = "#c9c5ca"; g.fillRect(fx, y, fw, fh);
      const cell = fw / 46; g.fillStyle = "#1a1618";
      for (let cy = 0; cy < fh / cell; cy++) for (let cx = 0; cx < 46; cx++) {
        const u = cx / 46, w2 = cy * cell / fh;
        let lum = 0.62 + 0.25 * Math.sin(u * 3.1 + v) * Math.cos(w2 * 2.3) - 0.45 * clamp(1 - Math.hypot(u - 0.55 - 0.1 * Math.sin(v), (w2 - 0.62) * 1.4) * 2.6) - 0.35 * (w2 > 0.78 ? 1 : 0);
        const rr = (1 - clamp(lum)) * cell * 0.62;
        if (rr > 0.15) { g.beginPath(); g.arc(fx + (cx + 0.5) * cell, y + (cy + 0.5) * cell, rr, 0, 7); g.fill(); }
      }
      g.strokeStyle = INK; g.lineWidth = ph * 0.003; g.strokeRect(fx, y, fw, fh);
      g.font = `italic 400 ${dfs}px ${FN}`; g.textAlign = v % 2 ? "right" : "left"; g.fillStyle = INK;
      g.fillText("Fotografía de nuestro enviado especial.", v % 2 ? fx + fw : fx, y + fh + dfs * 1.4);
      /* columnas: recortes del papel de fondo (texto real del mosaico) */
      const PP = F.paper, sk = PP.c.width / PP.T, colX = v % 2 ? m : fx + fw + m * 0.6, colW = iw - fw - m * 0.6;
      const crop = (dx, dy, dw, dh, sx, sy) => { if (dw <= 2 || dh <= 2) return; const sw = dw * 1.9 * sk * (S0 / ph), sh = dh * 1.9 * sk * (S0 / ph); g.drawImage(PP.c, sx * PP.c.width, sy * PP.c.height, Math.min(sw, PP.c.width * (1 - sx)), Math.min(sh, PP.c.height * (1 - sy)), dx, dy, dw, dh); };
      const S0 = Math.min(ctx.stage.W, ctx.stage.H) * 0.55;
      crop(colX, y, colW, fh + dfs * 2, 0.02 + (v % 3) * 0.05, 0.25 + (v % 4) * 0.1);
      const y2 = y + fh + dfs * 2.6, cw = (iw - m) / 3;
      for (let i = 0; i < 3; i++) {
        crop(m + i * (cw + m / 2), y2, cw, ph - m - y2, (i * 0.17 + v * 0.07) % 0.6, (0.1 + i * 0.13 + v * 0.05) % 0.5);
        if (i) { g.fillStyle = "rgba(22,18,21,.6)"; g.fillRect(m + i * (cw + m / 2) - m * 0.25, y2, Math.max(0.5, ph * 0.0012), ph - m - y2); }
      }
      g.restore();
      g.strokeStyle = "rgba(20,17,19,.5)"; g.lineWidth = ph * 0.002; g.strokeRect(0, 0, pw, ph);
      const b = mk(c.width, c.height), bg = b.getContext("2d"); bg.filter = `blur(${(ph * 0.012 * k).toFixed(1)}px)`; bg.drawImage(c, 0, 0);
      return { c, b, pw, ph, pad };
    });
  }
  function drawPage(G, Pg, x, y, sc, rot, blur = 0, a = 1) {
    G.save(); G.translate(x, y); G.rotate(rot); G.scale(sc, sc);
    const w = Pg.pw + 2 * Pg.pad, h = Pg.ph + 2 * Pg.pad;
    G.globalAlpha *= a;
    if (blur < 1) G.drawImage(Pg.c, -w / 2, -h / 2, w, h);
    if (blur > 0) { G.globalAlpha *= blur; G.drawImage(Pg.b, -w / 2, -h / 2, w, h); }
    G.restore();
  }

  /* ------------------------------------------------------------ fondos propios */
  /** ROTATIVA: el papel corre entre dos rodillos a toda velocidad y frena en seco en stopAt */
  function pressScene(G, ctx, lt, o = {}) {
    const { W, H, u, portrait } = ctx.stage, stopAt = Math.max(0.4, o.stopAt ?? 1.4), D = H * 9;
    const posAt = t => { const q = clamp(t / stopAt); return D * (1 - Math.pow(1 - q, 2.2)) + Math.max(0, t - stopAt) * H * 0.012; };
    const y = posAt(lt), vy = (y - posAt(lt - 1 / 30)) * 1.0;
    const jolt = lt >= stopAt && lt < stopAt + 0.3 ? Math.sin((lt - stopAt) * 40) * Math.exp(-(lt - stopAt) * 12) * u * 1.2 : 0;
    paperView(G, ctx, { x: W * 0.3, y: y + jolt, zoom: 1.12, vy: -vy, fy: 0.5, focusR: 1.1 });
    /* rodillos de la rotativa arriba y abajo (giran con el papel) */
    const rh = H * (portrait ? 0.06 : 0.1);
    for (const [ry, dir] of [[0, 1], [H - rh, -1]]) {
      const gr = G.createLinearGradient(0, ry, 0, ry + rh);
      gr.addColorStop(0, "#0d0b0c"); gr.addColorStop(0.35, "#4a4549"); gr.addColorStop(0.5, "#8d878b"); gr.addColorStop(0.62, "#3a3639"); gr.addColorStop(1, "#0b0a0b");
      G.fillStyle = gr; G.fillRect(0, ry, W, rh);
      /* marcas del cilindro: se desplazan con la velocidad (barridas cuando corre) */
      const sp = clamp(vy / (H * 0.08)), ph = (y * 0.9) % (rh * 1.6);
      G.save(); G.beginPath(); G.rect(0, ry, W, rh); G.clip();
      G.fillStyle = `rgba(230,225,232,${(0.18 - 0.14 * sp).toFixed(3)})`;
      for (let k = -1; k < 3; k++) { const yy = ry + ((ph * dir + k * rh * 0.8) % (rh * 1.6) + rh * 1.6) % (rh * 1.6) - rh * 0.3; G.fillRect(0, yy, W, Math.max(1, rh * (0.04 + sp * 0.5))); }
      G.restore();
      /* sombra del rodillo sobre el papel */
      const sg = G.createLinearGradient(0, dir > 0 ? rh : H - rh, 0, dir > 0 ? rh + H * 0.06 : H - rh - H * 0.06);
      sg.addColorStop(0, "rgba(0,0,0,.45)"); sg.addColorStop(1, "rgba(0,0,0,0)"); G.fillStyle = sg;
      G.fillRect(0, dir > 0 ? rh : H - rh - H * 0.06, W, H * 0.06);
    }
    finish(G, ctx, lt, { tint: 0.25 * clamp(vy / (H * 0.12)) });
    return { stopAt, speed: vy };
  }
  /** PORTADA QUE GIRA: una portada viene girando hacia la cámara, se detiene y se desenfoca (rack focus) */
  function spinScene(G, ctx, lt, o = {}) {
    const { W, H, portrait } = ctx.stage, land = o.land ?? 1.15, F = Fam(ctx);
    /* mesa: papel totalmente fuera de foco y en sombra */
    G.fillStyle = "#8f8a8e"; G.fillRect(0, 0, W, H);
    tiles(G, F.paperBlur, F.paper.T, W / 2 - lt * W * 0.01, H / 2, W, H, 0.8);
    G.fillStyle = "rgba(24,18,22,.5)"; G.fillRect(0, 0, W, H);
    const ph = Math.min(H * 0.98, W * (portrait ? 0.92 : 0.6) / 0.7), Pg = frontPage(ctx, o.variant ?? 0, ph, o.name);
    const q = clamp(lt / land), e = 1 - Math.pow(1 - q, 3);
    const rotOf = ee => (1 - ee) * Math.PI * 5 - 0.045;
    const sc0 = 0.04 + 0.96 * e, push = 1 + 0.035 * Math.max(0, lt - land);
    const blur = o.defocus === false ? 0 : prog(lt, land + 0.25, 0.7, "inOut") * (o.blurTo ?? 0.85);
    /* estela del giro (copias atrasadas) */
    if (q < 1) for (let i = 3; i >= 1; i--) { const ee = 1 - Math.pow(1 - clamp((lt - i * 0.035) / land), 3); drawPage(G, Pg, W / 2, H / 2, (0.04 + 0.96 * ee), rotOf(ee), 0.6, 0.22); }
    drawPage(G, Pg, W / 2, H / 2, sc0 * push, rotOf(e), q < 1 ? 0.35 * (1 - e) : blur);
    /* golpe de aterrizaje: flash suave */
    const fl = lt > land ? Math.exp(-(lt - land) * 7) : 0;
    if (fl > 0.02) { G.fillStyle = `rgba(255,252,255,${(0.35 * fl).toFixed(3)})`; G.fillRect(0, 0, W, H); }
    finish(G, ctx, lt, { light: 0.7, tint: 0.08 });
    return { land };
  }
  /** MESA: la cámara deriva sobre el periódico con profundidad de campo (rack focus al empezar) y recortes en primer plano */
  function deskScene(G, ctx, lt, o = {}) {
    const { W, H, portrait } = ctx.stage, F = Fam(ctx), S = Math.min(W, H);
    const rq = ease.inOut(clamp(lt / 1.2));
    paperView(G, ctx, { x: W * (0.8 + 0.012 * lt), y: H * (0.4 + 0.009 * lt), zoom: lerp(1.5, 1.05, rq) * (1 + 0.01 * lt), focusR: lerp(0.15, 1, rq), fy: 0.48 });
    /* recortes desenfocados en primer plano (paralaje) */
    const cards = [[-0.05, portrait ? 0.9 : 0.88, 0.42, 0.26, 3], [portrait ? 0.92 : 0.95, portrait ? 0.08 : 0.1, 0.36, 0.3, 7]];
    cards.forEach(([cx, cy, w, h, sd], i) => {
      const ww = w * Math.max(W, H) * (portrait ? 1.1 : 1), hh = ww * h / w, dx = -lt * W * 0.03 * (i ? 1.3 : 1);
      G.save(); G.translate(cx * W + dx, cy * H - lt * H * 0.012); G.rotate(i ? 0.06 : -0.04);
      P.clipping(F, G, -ww / 2, -hh / 2, ww, hh, { S, blur: S * 0.012, sx: 0.1 + sd * 0.05, sy: 0.1 + sd * 0.04 });
      G.restore();
    });
    finish(G, ctx, lt, { tint: 0.04 });
  }
  /** KIOSCO: pared de portadas que se desliza de costado (llega con latigazo) */
  function standScene(G, ctx, lt, o = {}) {
    const { W, H, portrait } = ctx.stage;
    G.fillStyle = "#4a4448"; G.fillRect(0, 0, W, H);
    const ph = H * (portrait ? 0.3 : 0.56), pw = ph * 0.7, gap = pw * 0.12, step = pw + gap;
    const whip = o.whip === false ? 0 : (1 - Math.pow(1 - clamp(lt / 0.85), 4));
    const off = -lt * W * 0.025 - (1 - whip) * W * 1.4 * (o.whip === false ? 0 : 1);
    const vx = o.whip === false ? 0 : (1 - Math.pow(1 - clamp(lt / 0.85), 4)) - (1 - Math.pow(1 - clamp((lt - 1 / 30) / 0.85), 4));
    const rows = portrait ? [0.17, 0.5, 0.83] : [0.22, 0.8];
    const pages = [0, 1, 2, 3, 4].map(v => frontPage(ctx, v, ph));
    const smear = vx * W * 1.4;
    const n = Math.abs(smear) > 4 ? Math.min(6, Math.ceil(Math.abs(smear) / 14)) : 1;
    for (let s = 0; s < n; s++) {
      const f = n > 1 ? s / (n - 1) - 0.5 : 0;
      G.save(); G.globalAlpha = 1 / (s + 1);
      rows.forEach((ry, ri) => {
        const rowOff = ri % 2 ? step * 0.5 : 0, x0 = (((off + rowOff + f * smear) % step) + step) % step - step;
        for (let x = x0, k = 0; x < W + step; x += step, k++) {
          const idx = Math.floor((x - off - rowOff) / step + 1000) + ri * 3;
          drawPage(G, pages[((idx % 5) + 5) % 5], x + pw / 2, H * ry, 1, (hr(idx, ri) - 0.5) * 0.06, n > 1 ? 0.9 : (o.blur ?? 0.7));
        }
      });
      G.restore();
    }
    finish(G, ctx, lt, { light: 0.8, tint: 0.06 });
  }
  /** tono de foto del diseño: B/N de alto contraste con virado magenta suave */
  const toned = new WeakMap();
  function tone(img) {
    if (toned.has(img)) return toned.get(img);
    const sc = Math.min(1, 1600 / Math.max(img.width, img.height)), c = mk(img.width * sc, img.height * sc), g = c.getContext("2d");
    g.filter = "grayscale(1) contrast(1.3) brightness(0.97)"; g.drawImage(img, 0, 0, c.width, c.height); g.filter = "none";
    g.globalCompositeOperation = "multiply"; g.fillStyle = "rgb(232,214,226)"; g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = "screen"; g.fillStyle = "rgb(34,20,28)"; g.fillRect(0, 0, c.width, c.height);
    toned.set(img, c); return c;
  }
  /** presets comunes para Kit.hook.bg */
  function presets(ctx, o = {}) {
    return {
      press: (G, st, lt) => pressScene(G, ctx, lt, { stopAt: o.stopAt }),
      spin: (G, st, lt) => spinScene(G, ctx, lt, { land: o.land, variant: o.variant, blurTo: o.blurTo }),
      desk: (G, st, lt) => deskScene(G, ctx, lt),
      stand: (G, st, lt) => standScene(G, ctx, lt, { whip: o.whip, blur: o.standBlur }),
    };
  }
  /** contrato de fondo con el acabado del diseño; component = escena periodico.* (se dibuja en la capa del periódico) */
  function makeBG(ctx, p, o) {
    const BG = K.hook.bg(ctx, p, { auto: o.auto, tone, presets: presets(ctx, o) });
    const F = Fam(ctx);
    return {
      mode: BG.mode,
      /** dibuja el fondo; cover = este cuadro tapa todo (el post() caro de la familia se saltea) */
      render(lt, b, cover = true) {
        const G = ctx.g.main;
        if (BG.mode !== "component" && cover && F && F.hint) F.hint({ cover: true });
        BG.render(lt, b);
        if (BG.mode === "image" || BG.mode === "none") finish(G, ctx, lt, { light: BG.mode === "none" ? 0.25 : 0.6, tint: 0.05 });
      },
      dispose() { BG.dispose(); },
    };
  }
  /** desvanece TODO lo dibujado en la capa (deja ver la capa del periódico debajo) */
  function erase(G, ctx, a) {
    if (a <= 0) return;
    const { W, H } = ctx.stage;
    G.save(); G.globalCompositeOperation = "destination-out"; G.fillStyle = `rgba(0,0,0,${clamp(a).toFixed(3)})`; G.fillRect(-2, -2, W + 4, H + 4); G.restore();
  }

  P.hook = { words, shake, brackets, label, blackBar, wash, stamp, paperView, finish, frontPage, drawPage, pressScene, spinScene, deskScene, standScene, tone, presets, makeBG, erase, memo, fitFs };

  /* ================================================================ introv1 */
  K.register({
    name: "periodico.introv1", tags: ["intro", "gancho", "apertura", "título", "portada", "impacto"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura (lo primero que se ve). Fondo adaptable al tema (bg: press | spin | desk | stand | image con src | component con use/useParams | none); por defecto la ROTATIVA: el papel del diario corre entre dos rodillos con desenfoque de movimiento y frena en seco. Un titular GIGANTE a máquina golpea palabra por palabra (letras que se aleatorizan, estela y sacudida; '^palabra^' va en blanco sobre barra negra). En extraAt golpea un sello magenta «EXTRA». Sale con latigazo hacia el primer plano del periódico.",
    example: { text: "¿POR QUÉ CAYÓ\nEL ^MURO^?", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", extraAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra en blanco sobre barra negra." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba entre corchetes (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del titular (barra negra con texto blanco)." },
      extra: { type: "string", default: "EXTRA", doc: "Texto del sello de impacto (vacío = sin sello)." },
      extraAt: { type: "number", default: 2.3, doc: "Momento de impacto: la rotativa frena en seco y golpea el sello (-1 = sin impacto; acepta '@palabra')." },
      wordAt: { type: "number", default: 0.45, doc: "Segundo del primer golpe de palabra." },
      stagger: { type: "number", default: 0.3, min: 0.08, doc: "Segundos entre palabra y palabra." },
      ...K.hook.bgParams(["press", "spin", "desk", "stand"]),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, S = Math.min(W, H), Ls = portrait ? rewrap(words(p.text), H * 0.075, W * 0.88) : words(p.text);
      const longest = Ls.map(l => l.map(w => w.w).join(" ")).reduce((a, s) => P.measure(s, tfont(100)) > P.measure(a, tfont(100)) ? s : a, "");
      const fs = Math.min(fitFs(longest + " ", W * (portrait ? 0.88 : 0.8)), (portrait ? H * 0.1 : H * 0.31 * (Ls.length > 2 ? 0.7 : 1)));
      const lh = fs * 1.12, cy = H * (portrait ? 0.39 : 0.47), sp = P.measure(" ", tfont(fs));
      let idx = 0; const placed = [];
      Ls.forEach((line, li) => {
        const ws = line.map(w => P.measure(w.w, tfont(fs)) + (w.acc ? fs * 0.5 : 0));
        const tot = ws.reduce((a, b) => a + b, 0) + sp * (line.length - 1) - sp * line.filter(w => w.glue).length;
        let x = W / 2 - tot / 2; const yb = cy + (li - (Ls.length - 1) / 2) * lh + fs * 0.36;
        line.forEach((w, k) => { if (w.glue) x -= sp; placed.push({ ...w, x, yb, ww: ws[k], i: w.glue ? idx - 1 : idx++, seed: 31 + idx * 7 + li }); x += ws[k] + sp; });
      });
      const hits = placed.map(w => p.wordAt + w.i * p.stagger + 0.12);
      const lastHit = hits[hits.length - 1] ?? p.wordAt;
      const xMin = Math.min(...placed.map(w => w.x)), xMax = Math.max(...placed.map(w => w.x + w.ww));
      const top = cy - lh * Ls.length / 2, bot = cy + lh * Ls.length / 2;
      const extraOn = p.extra && p.extraAt >= 0;
      const BG = makeBG(ctx, p, { auto: "press", stopAt: extraOn ? p.extraAt : lastHit + 0.2, land: Math.max(0.9, p.wordAt + 0.5) });
      const stampFs = Math.min(fs * 0.5, S * (portrait ? 0.08 : 0.1));
      const stampXY = portrait ? [W * 0.62, bot + u * 9 + (p.sub ? u * 6 : 0)] : [Math.min(W - stampFs * 3.2, xMax - stampFs * 0.6), top - stampFs * 0.9];
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), oe = ease.in(oq);
          const all = hits.concat(extraOn ? [p.extraAt] : []);
          const [sx, sy] = shake(lt, all, u * 0.8);
          G.save(); G.translate(sx * 0.5, sy * 0.5 - oe * H * 0.25);
          BG.render(lt, b, oq <= 0);
          G.restore();
          /* lavado de papel detrás del titular (legible sobre cualquier fondo) */
          const strong = BG.mode === "image" || BG.mode === "component" || BG.mode === "none";
          G.save(); G.translate(0, -oe * H * 0.25);
          const wa = prog(lt, p.wordAt - 0.25, 0.4, "linear");
          wash(G, W, cy, lh * Ls.length * 0.5 + fs * (strong ? 1.6 : 1.1), wa * (strong ? 1 : 0.38));
          P.glow(G, W / 2, cy, (xMax - xMin) * 0.6 + S * 0.08, lh * Ls.length * 0.8 + S * 0.05, 0.8 * wa);
          /* titular: cada palabra golpea (escala + estela + scramble) y queda temblando apenas */
          G.translate(sx, sy);
          for (const w of placed) {
            const t0 = p.wordAt + w.i * p.stagger, q = prog(lt, t0, 0.22, "linear");
            if (q <= 0) continue;
            const e = ease.expoOut(q), s = 1 + 0.9 * (1 - e), trail = (1 - e) * fs * 0.6 + oe * fs * 0.3;
            const jx = Math.sin(lt * 11 + w.seed) * u * 0.06, jy = Math.cos(lt * 13 + w.seed) * u * 0.06;
            const ccx = w.x + w.ww / 2, ccy = w.yb - fs * 0.36;
            G.save(); G.globalAlpha = clamp(q * 3);
            G.translate(ccx + jx, ccy + jy); G.scale(s, s); G.translate(-ccx, -ccy);
            const T = P.scramble(w.w, lt, t0, 0.4, w.seed, 22);
            if (w.acc) {
              const bq = prog(lt, t0 + 0.04, 0.2, "out");
              G.fillStyle = BAR; G.fillRect(w.x, ccy - fs * 0.62, w.ww * bq, fs * 1.18);
              G.save(); G.beginPath(); G.rect(w.x, ccy - fs * 0.7, w.ww * bq, fs * 1.4); G.clip();
              P.soft(G, T, w.x + fs * 0.25, w.yb, fs, 0, trail, { color: BARINK, weight: 0.03 });
              G.restore();
            } else P.soft(G, T, w.x, w.yb, fs, 0, trail);
            G.restore();
          }
          /* rótulos */
          label(G, p.kicker, portrait ? W / 2 : xMin + u * 3, top - fs * 0.35 - u * 2.6, u * (portrait ? 2.6 : 2.2), lt, 0.15, 13, portrait ? "center" : "left");
          if (p.sub) blackBar(G, p.sub, W / 2, bot + u * (portrait ? 4 : 3.6), u * (portrait ? 3.1 : 2.8), prog(lt, lastHit + 0.2, 0.45, "linear"), lt, lastHit + 0.2, 17);
          /* impacto: sello EXTRA magenta + flash */
          if (extraOn && lt >= p.extraAt) {
            const q = prog(lt, p.extraAt, 0.16, "linear");
            stamp(G, p.extra, stampXY[0], stampXY[1], stampFs, -0.14, q);
            const fl = Math.exp(-(lt - p.extraAt) * 9);
            if (fl > 0.03) { G.fillStyle = `rgba(255,250,253,${(0.4 * fl).toFixed(3)})`; G.fillRect(0, -H, W, H * 3); }
          }
          G.restore();
          erase(G, ctx, oe);
        },
      };
    },
  });

  /* ================================================================ introv2 */
  /** recorte de diario (fondo horneado) para la respuesta */
  function clipCard(ctx, w, h, seed) {
    const F = Fam(ctx), dpr = ctx.dpr;
    return memo(`per-clip:${w | 0}:${h | 0}:${seed}:${dpr}:${F.size}`, () => {
      const pad = h * 0.3, k = dpr, c = mk((w + 2 * pad) * k, (h + 2 * pad) * k), g = c.getContext("2d");
      g.scale(k, k); g.translate(pad, pad);
      g.save(); g.shadowColor = "rgba(10,6,9,.55)"; g.shadowBlur = h * 0.16 * k; g.shadowOffsetY = h * 0.05 * k;
      g.fillStyle = "#e3e0e4"; P.raggedRect(g, 0, 0, w, h, h * 0.06, seed); g.fill(); g.restore();
      g.save(); P.raggedRect(g, 0, 0, w, h, h * 0.06, seed); g.clip();
      /* texto del diario muy tenue de fondo */
      const PP = F.paper; g.globalAlpha = 0.16; g.drawImage(PP.c, PP.c.width * 0.2, PP.c.height * 0.3, PP.c.width * 0.25, PP.c.width * 0.25 * h / w, 0, 0, w, h); g.globalAlpha = 1;
      /* cinta superior: rótulo de sección */
      const m = h * 0.09, tfs = h * 0.085;
      g.fillStyle = INK; g.fillRect(m, m * 1.9 + tfs, w - 2 * m, h * 0.012); g.fillRect(m, m * 1.9 + tfs + h * 0.022, w - 2 * m, h * 0.004);
      g.font = `700 ${tfs}px ${FN}`; g.textAlign = "left"; g.fillText("ÚLTIMA HORA", m, m * 1.5 + tfs * 0.6);
      g.textAlign = "right"; g.font = `italic 400 ${tfs}px ${FN}`; g.fillText("edición extraordinaria", w - m, m * 1.5 + tfs * 0.6);
      g.fillRect(m, h - m * 1.2, w - 2 * m, h * 0.004);
      g.restore();
      g.strokeStyle = "rgba(18,15,17,.75)"; g.lineWidth = h * 0.008; P.raggedRect(g, 0, 0, w, h, h * 0.06, seed); g.stroke();
      return { c, pad, w, h };
    });
  }

  K.register({
    name: "periodico.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "portada", "recorte"], layer: "main", post: 0.6,
    summary: "GANCHO pregunta + revelación. Fondo adaptable al tema (bg: spin | press | desk | stand | image con src | component con use/useParams | none); por defecto una PORTADA DE DIARIO que viene girando hacia la cámara, se detiene y se desenfoca (rack focus). La pregunta gigante se TIPEA a máquina letra a letra (golpe de tipo, tinta irregular, carro) y la respuesta llega como RECORTE de diario con titular a toda página que golpea encima, más un sello magenta EXTRA.",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Berlín · 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.6 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba entre corchetes." },
      stamp: { type: "string", default: "", doc: "Respuesta: titular del recorte que golpea (vacío = sin recorte)." },
      stampAt: { type: "number", default: 2.6, doc: "Segundo del recorte (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.6, doc: "Segundo en que empieza a tipearse la pregunta." },
      cps: { type: "number", default: 18, min: 4, doc: "Letras por segundo del tipeo." },
      extra: { type: "string", default: "EXTRA", doc: "Sello magenta sobre el recorte (vacío = sin sello)." },
      ...K.hook.bgParams(["spin", "press", "desk", "stand"]),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, S = Math.min(W, H);
      let Ls = String(p.text).toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      if (portrait) Ls = rewrap(Ls.map(l => l.split(/\s+/).map(w => ({ w }))), H * 0.065, W * 0.88).map(l => l.map(w => w.w).join(" "));
      const longest = Ls.reduce((a, s) => P.measure(s, tfont(100)) > P.measure(a, tfont(100)) ? s : a, "");
      const fs = Math.min(fitFs(longest + "  ", W * (portrait ? 0.88 : 0.66)), H * (portrait ? 0.085 : 0.17));
      const lh = fs * 1.1, x0 = portrait ? W / 2 : W * 0.08, y0 = portrait ? H * 0.37 - Ls.length * lh / 2 : H * 0.24;
      /* posiciones de cada letra (precalculadas) con un leve desvío de tipo de máquina */
      const chars = []; Ls.forEach((s, li) => {
        const lw = P.measure(s, tfont(fs)), lx = portrait ? x0 - lw / 2 : x0, yb = y0 + li * lh + fs * 0.8;
        [...s].forEach((ch, ci) => { const pre = P.measure(s.slice(0, ci), tfont(fs)); chars.push({ ch, x: lx + pre, yb, li, dy: (hr(5, chars.length) - 0.5) * fs * 0.05, a: 0.78 + 0.22 * hr(6, chars.length), w: P.measure(ch, tfont(fs)) }); });
      });
      const total = chars.length;
      const blockW = Math.max(...Ls.map(s => P.measure(s, tfont(fs))));
      const stampOn = !!p.stamp;
      /* recorte de la respuesta */
      const cw = portrait ? W * 0.9 : Math.min(W * 0.56, Math.max(W * 0.42, blockW * 0.9));
      const ans = String(p.stamp || "").toUpperCase();
      const afs = Math.min(fitFs(ans, cw * 0.86, FB, 700), S * (portrait ? 0.08 : 0.1));
      const ch = afs * 2.9, card = stampOn ? clipCard(ctx, cw, ch, 9) : null;
      const textBot = y0 + Ls.length * lh;
      const ccx = portrait ? W / 2 : Math.min(W - cw / 2 - W * 0.05, x0 + blockW * 0.45 + cw * 0.3), ccy = portrait ? Math.max(textBot + ch * 0.9, H * 0.64) : Math.max(textBot + ch * 0.62, H * 0.72);
      const BG = makeBG(ctx, p, { auto: "spin", land: 1.1, stopAt: 1.2, variant: 2 });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, oq = clamp((lt - b.dur) / 0.6), oe = ease.in(oq);
          const [sx, sy] = shake(lt, stampOn ? [p.stampAt + 0.1, p.stampAt + 0.42] : [], u * 0.9);
          G.save(); G.translate(sx * 0.6, sy * 0.6 - oe * H * 0.25);
          BG.render(lt, b, oq <= 0);
          G.restore();
          G.save(); G.translate(sx, sy - oe * H * 0.25);
          const strong = BG.mode === "image" || BG.mode === "component" || BG.mode === "none";
          /* luz/papel detrás de la pregunta */
          const wa = prog(lt, p.typeAt - 0.3, 0.4, "linear");
          if (portrait) wash(G, W, y0 + Ls.length * lh / 2, Ls.length * lh / 2 + fs * (strong ? 1.5 : 1), wa * (strong ? 1 : 0.7));
          else {
            P.glow(G, x0 + blockW * 0.45, y0 + Ls.length * lh / 2, blockW * 0.85 + S * 0.1, Ls.length * lh + fs * 1.4, (strong ? 0.95 : 0.7) * wa);
          }
          P.glow(G, portrait ? W / 2 : x0 + blockW / 2, y0 + Ls.length * lh / 2, blockW * 0.62 + S * 0.06, Ls.length * lh * 0.8 + S * 0.04, 0.75 * wa);
          /* tipeo a máquina: cada letra cae con un golpe (tinta irregular), el carro avanza */
          const typed = (lt - p.typeAt) * p.cps, n = Math.floor(clamp(typed, 0, total));
          G.save(); G.font = tfont(fs); G.textAlign = "left"; G.textBaseline = "alphabetic"; G.lineJoin = "round";
          for (let i = 0; i < n; i++) {
            const c = chars[i], age = (typed - i) / p.cps, hit = clamp(age / 0.06);
            G.globalAlpha = c.a * (0.4 + 0.6 * hit);
            const yy = c.yb + c.dy - (1 - hit) * fs * 0.08;
            G.fillStyle = INK; G.fillText(c.ch, c.x, yy);
            G.lineWidth = fs * 0.045; G.strokeStyle = INK; G.strokeText(c.ch, c.x, yy);
          }
          G.restore();
          /* carro: barra negra fina que marca la próxima letra (parpadea al terminar) */
          if (lt >= p.typeAt) {
            const done = n >= total, c = chars[Math.min(n, total - 1)];
            const cx = done ? c.x + c.w + fs * 0.06 : c.x, blink = done ? (Math.floor(lt * 2.4) % 2 ? 0 : 1) : 1;
            if (c && blink && !(stampOn && lt > p.stampAt)) { G.fillStyle = BAR; G.fillRect(cx, c.yb + fs * 0.1, fs * 0.5, fs * 0.09); }
          }
          label(G, p.kicker, portrait ? W / 2 : x0, y0 - fs * 0.25 - u * 2.8, u * (portrait ? 2.5 : 2.1), lt, 0.15, 23, portrait ? "center" : "left");
          /* revelación: el RECORTE de diario golpea encima con su titular */
          if (stampOn && lt >= p.stampAt) {
            const q = prog(lt, p.stampAt, 0.2, "linear"), e = ease.expoOut(q), sc = 1 + 0.7 * (1 - e), rot = -0.035 + 0.05 * (1 - e);
            G.save(); G.globalAlpha *= clamp(q * 3); G.translate(ccx, ccy); G.rotate(rot); G.scale(sc, sc);
            if (q < 1) { G.globalAlpha *= 0.35; G.drawImage(card.c, -cw / 2 - card.pad, -ch / 2 - card.pad - (1 - e) * ch * 0.4, cw + 2 * card.pad, ch + 2 * card.pad); G.globalAlpha = clamp(q * 3); }
            G.drawImage(card.c, -cw / 2 - card.pad, -ch / 2 - card.pad, cw + 2 * card.pad, ch + 2 * card.pad);
            G.font = `700 ${afs}px ${FB}`; G.fillStyle = INK; G.textAlign = "center"; G.textBaseline = "alphabetic";
            G.fillText(P.scramble(ans, lt, p.stampAt + 0.05, 0.55, 41, 22), 0, ch * 0.5 - ch * 0.1 - afs * 0.12);
            P.icon(G, cw / 2 - ch * 0.12, -ch / 2 + ch * 0.135, ch * 0.08);
            G.restore();
            if (p.extra) stamp(G, p.extra, ccx - cw * 0.38, ccy - ch * 0.62, Math.min(afs * 0.75, S * 0.065), -0.18, prog(lt, p.stampAt + 0.32, 0.16, "linear"));
          }
          G.restore();
          erase(G, ctx, oe);
        },
      };
    },
  });
})();

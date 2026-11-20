/* =============================================================================
   dinero · runtime de la familia "NODECONOMY" (verde dinero / gris niebla / negro verdoso)
   -----------------------------------------------------------------------------
   Réplica de estilo de una promo de tipografía cinética "MONEY" (ver designs/dinero/DESIGN.md).
   Reglas del runtime:
   · TODO se dibuja en canvas (ctx.g.main / ctx.g.top); cada cuadro es función pura de lt/t;
   · las fotos se tratan UNA vez (mapa de gradiente con colores de la paleta: plata verdosa,
     teal frío o verde dinero) y se cachean como lienzos (Kit.dinero.tint);
   · transiciones = ENTRADA del plano nuevo (param `fx`): whip, blob, leak, pixel, scan, zoom,
     flash. `blob` y `pixel` destapan el plano nuevo SOBRE el saliente, que sigue vivo gracias
     a transition.overlap; el resto de los planos se cortan en seco (Kit.dinero.keep);
   · tipografía: Oranienbaum (didona condensada), Montserrat 200 (fina con brillo),
     Open Sans 600–800 (palabras 3D, bloques, rótulos).
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  for (const f of ["400 40px Oranienbaum", "200 40px Montserrat", "300 40px Montserrat", "600 40px 'Open Sans'", "700 40px 'Open Sans'", "800 40px 'Open Sans'"]) K.fonts.add(f);

  const FPS = 30, TAU = Math.PI * 2;
  let STATE = null;

  /* ------------------------------------------------------------- color */
  const hex = h => { h = String(h).replace("#", ""); if (h.length === 3) h = h.split("").map(c => c + c).join(""); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (h, a = 1) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
  const mix = (a, b, p) => { const A = hex(a), B = hex(b); return "#" + A.map((v, i) => Math.round(lerp(v, B[i], p)).toString(16).padStart(2, "0")).join(""); };

  /* ------------------------------------------------------------- tipografía */
  const SERIF = s => `400 ${s}px Oranienbaum, 'Bodoni Moda', serif`;
  const THIN = (s, w = 200) => `${w} ${s}px Montserrat, sans-serif`;
  const SANS = (s, w = 700) => `${w} ${s}px 'Open Sans', sans-serif`;
  let MC = null;
  function measure(s, f, sp = 0) {
    MC ||= document.createElement("canvas").getContext("2d");
    MC.font = f; MC.letterSpacing = sp ? sp + "px" : "0px";
    return MC.measureText(String(s)).width;
  }
  /** texto en canvas: o = { font, color, align, base, sp, alpha, stroke, lw } */
  function text(G, s, x, y, o = {}) {
    G.save();
    G.font = o.font || SANS(40); G.fillStyle = o.color || "#000"; G.textAlign = o.align || "left"; G.textBaseline = o.base || "alphabetic";
    G.letterSpacing = (o.sp || 0) + "px";
    if (o.alpha != null) G.globalAlpha *= o.alpha;
    if (o.stroke) { G.strokeStyle = o.stroke; G.lineWidth = o.lw || 1; G.lineJoin = "round"; G.strokeText(String(s), x, y); }
    else G.fillText(String(s), x, y);
    G.restore();
  }
  /** tamaño de fuente para que `s` ocupe `w` px (con tope `max`); fam(size) → font */
  function fit(s, w, max, fam = SANS, sp = 0) {
    const m = measure(s, fam(100), sp * 100) / 100;
    return Math.min(max ?? 1e9, w / Math.max(1e-3, m));
  }
  /** caracteres con su x relativa */
  function glyphs(s, f, sp = 0) {
    const out = []; let x = 0;
    for (const c of String(s)) { const w = measure(c, f); out.push({ c, x, w }); x += w + sp; }
    return { list: out, width: Math.max(0, x - sp) };
  }
  /** "Dirty ^Cash^ I want" → [{w, acc}] (^x^ = palabra en verde) */
  function marks(s) {
    const out = []; let acc = false, buf = "";
    const flush = () => { if (buf) out.push({ w: buf, acc }); buf = ""; };
    for (const ch of String(s ?? "")) { if (ch === "^") { flush(); acc = !acc; } else if (/\s/.test(ch)) flush(); else buf += ch; }
    flush(); return out;
  }
  /** parte un texto en renglones de ≤ max caracteres (respeta '\n') */
  function wrap(s, max) {
    const out = [];
    for (const para of String(s ?? "").split("\n")) {
      let cur = "";
      for (const w of para.split(/\s+/).filter(Boolean)) { const nx = cur ? cur + " " + w : w; if (cur && nx.length > max) { out.push(cur); cur = w; } else cur = nx; }
      if (cur) out.push(cur);
    }
    return out;
  }

  /* ------------------------------------------------------------- fotos */
  /** LUT de 256 colores desde paradas [[pos,"#hex"],…] */
  function lut(stops) {
    const out = new Uint8ClampedArray(256 * 3);
    for (let i = 0; i < 256; i++) {
      const v = i / 255; let k = 0;
      while (k < stops.length - 2 && v > stops[k + 1][0]) k++;
      const [p0, c0] = stops[k], [p1, c1] = stops[k + 1], q = clamp((v - p0) / (p1 - p0 || 1));
      const A = hex(c0), B = hex(c1);
      for (let j = 0; j < 3; j++) out[i * 3 + j] = lerp(A[j], B[j], q);
    }
    return out;
  }
  /** tratamientos de la referencia (paradas = colores de la paleta) */
  function grades(P) {
    return {
      silver: { stops: [[0, P.black], [0.45, P.fogDark], [0.78, P.fog], [1, mix(P.white, P.fog, 0.25)]], keep: 0.12, gam: 1.0 },
      /* ref 3,4 s: tono partido — sombras cálidas (#753f1e) y luces menta (#b1d6c6), mediana #798e85 */
      cash: { stops: [[0, "#2a1408"], [0.12, "#753f1e"], [0.26, "#6f6a52"], [0.45, "#798e85"], [0.72, "#a4b89f"], [1, "#d2efe2"]], keep: 0.04, gam: 0.9 },
      green: { stops: [[0, P.feltDark], [0.5, P.felt], [1, P.sageLight]], keep: 0, gam: 1.0 },
      dark: { stops: [[0, P.black], [0.55, P.feltDark], [1, P.leaf]], keep: 0.06, gam: 1.3 },
      mono: { stops: [[0, P.black], [1, P.white]], keep: 0, gam: 1.0 },
    };
  }
  /** foto → lienzo tratado (cacheado). mode: silver | cash | green | dark | mono */
  function tint(ctx, src, mode = "silver", max = 1300) {
    const key = `${src}|${mode}|${max}`, S = STATE;
    if (S.tint.has(key)) return S.tint.get(key);
    const im = ctx.img(src);
    if (!im) { S.tint.set(key, null); return null; }
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const w = Math.max(1, Math.round(im.naturalWidth * k)), h = Math.max(1, Math.round(im.naturalHeight * k));
    const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
    const g = cv.getContext("2d", { willReadFrequently: true }); g.drawImage(im, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h), a = d.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < a.length; i += 4) hist[(a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114) | 0]++;
    const n = a.length / 4; let acc = 0, lo = 0, hi = 255;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc < n * 0.015) lo = i; if (acc < n * 0.985) hi = i; }
    const G0 = grades(ctx.C.palette)[mode] || grades(ctx.C.palette).silver, L = lut(G0.stops);
    for (let i = 0; i < a.length; i += 4) {
      const y0 = a[i] * 0.299 + a[i + 1] * 0.587 + a[i + 2] * 0.114;
      const v = Math.pow(clamp((y0 - lo) / Math.max(1, hi - lo)), G0.gam), j = Math.round(v * 255) * 3;
      for (let c = 0; c < 3; c++) {
        const o = clamp(a[i + c] + (v * 255 - y0), 0, 255);     // original con los niveles estirados
        a[i + c] = lerp(L[j + c], o, G0.keep);
      }
    }
    g.putImageData(d, 0, 0);
    S.tint.set(key, cv);
    return cv;
  }
  /** dibuja `cv` cubriendo la caja; o = { zoom, fx, fy, dx, dy, alpha, blur, rot } */
  function cover(G, cv, x, y, w, h, o = {}) {
    if (!cv) { G.save(); G.fillStyle = "#24302a"; G.fillRect(x, y, w, h); G.restore(); return; }
    const z = o.zoom ?? 1, s = Math.max(w / cv.width, h / cv.height) * z;
    const dw = cv.width * s, dh = cv.height * s, fx = o.fx ?? 0.5, fy = o.fy ?? 0.5;
    let dx = x + w / 2 - fx * dw, dy = y + h / 2 - fy * dh;
    dx = Math.min(x, Math.max(x + w - dw, dx)) + (o.dx || 0); dy = Math.min(y, Math.max(y + h - dh, dy)) + (o.dy || 0);
    G.save();
    if (!o.noclip) { G.beginPath(); G.rect(x, y, w, h); G.clip(); }
    if (o.alpha != null) G.globalAlpha *= o.alpha;
    if (o.blur > 0.3) G.filter = `blur(${o.blur.toFixed(1)}px)`;
    if (o.rot) { G.translate(x + w / 2, y + h / 2); G.rotate(o.rot); G.translate(-(x + w / 2), -(y + h / 2)); }
    G.drawImage(cv, dx, dy, dw, dh);
    G.restore();
  }

  /* ------------------------------------------------------------- fondos */
  /** viñeta oscura (la referencia la tiene en casi todos los planos) */
  function vignette(G, W, H, a = 0.55, color = "#000", inner = 0.35) {
    const r = Math.hypot(W, H) / 2, v = G.createRadialGradient(W / 2, H / 2, r * inner, W / 2, H / 2, r * 1.02);
    v.addColorStop(0, rgba(color, 0)); v.addColorStop(1, rgba(color, a));
    G.save(); G.fillStyle = v; G.fillRect(0, 0, W, H); G.restore();
  }
  /** gris niebla (plano 1): pared clara arriba-izquierda, piso más oscuro */
  function fogBg(G, W, H, P) {
    const g = G.createLinearGradient(0, 0, W * 0.3, H);
    g.addColorStop(0, mix(P.fog, P.white, 0.12)); g.addColorStop(0.55, P.fog); g.addColorStop(1, P.fogDark);
    G.fillStyle = g; G.fillRect(0, 0, W, H);
    vignette(G, W, H, 0.35, P.black, 0.45);
  }
  /** fieltro verde (plano 3): degradé radial + textura de fibra generada */
  function feltBg(G, W, H, P, lt = 0) {
    const g = G.createRadialGradient(W * 0.4, H * 0.35, 0, W * 0.5, H * 0.5, Math.hypot(W, H) * 0.62);
    g.addColorStop(0, mix(P.felt, P.leaf, 0.35)); g.addColorStop(0.55, P.felt); g.addColorStop(1, P.feltDark);
    G.fillStyle = g; G.fillRect(0, 0, W, H);
    if (STATE?.felt) { G.save(); G.globalAlpha = 0.16; G.globalCompositeOperation = "overlay"; G.fillStyle = G.createPattern(STATE.felt, "repeat"); G.fillRect(0, 0, W, H); G.restore(); }
  }
  /** gris claro con viñeta (plano 5, palabras 3D y monedas) */
  function paperBg(G, W, H, P) {
    const r = Math.hypot(W, H) / 2, g = G.createRadialGradient(W * 0.5, H * 0.45, 0, W / 2, H / 2, r);
    g.addColorStop(0, mix(P.paper, P.white, 0.22)); g.addColorStop(0.55, P.paper); g.addColorStop(1, P.paperEdge);
    G.fillStyle = g; G.fillRect(0, 0, W, H);
  }
  /** salvia (plano 6): luz arriba a la derecha */
  function sageBg(G, W, H, P) {
    const g = G.createLinearGradient(W, 0, 0, H);
    g.addColorStop(0, P.sageLight); g.addColorStop(0.6, P.sage); g.addColorStop(1, mix(P.sage, P.deep, 0.18));
    G.fillStyle = g; G.fillRect(0, 0, W, H);
  }
  function solid(G, W, H, c) { G.fillStyle = c; G.fillRect(0, 0, W, H); }

  /* ------------------------------------------------------------- formas */
  /** moneda dorada vista de canto/frente (spin = coseno del giro) */
  function coin(G, x, y, r, spin, P, blur = 0, alpha = 1) {
    const w = Math.max(r * 0.12, r * Math.abs(spin));
    G.save(); G.globalAlpha *= alpha; if (blur > 0.4) G.filter = `blur(${blur.toFixed(1)}px)`;
    G.fillStyle = P.goldDark; G.beginPath(); G.ellipse(x + r * 0.08, y + r * 0.06, w, r, 0, 0, TAU); G.fill();
    const g = G.createRadialGradient(x - w * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, mix(P.gold, P.white, 0.35)); g.addColorStop(0.6, P.gold); g.addColorStop(1, P.goldDark);
    G.fillStyle = g; G.beginPath(); G.ellipse(x, y, w, r, 0, 0, TAU); G.fill();
    if (w > r * 0.35) { G.strokeStyle = rgba(P.goldDark, 0.55); G.lineWidth = r * 0.09; G.beginPath(); G.ellipse(x, y, w * 0.72, r * 0.72, 0, 0, TAU); G.stroke(); }
    G.restore();
  }
  /** billete chico (el que corona la barra del plano 6) */
  function bill(G, x, y, w, h, P) {
    G.save(); G.fillStyle = P.green; G.fillRect(x, y, w, h);
    G.fillStyle = mix(P.green, P.white, 0.55); G.fillRect(x + w * 0.08, y + h * 0.15, w * 0.84, h * 0.7);
    G.fillStyle = P.green; G.beginPath(); G.ellipse(x + w / 2, y + h / 2, h * 0.28, h * 0.3, 0, 0, TAU); G.fill();
    G.fillStyle = mix(P.green, P.white, 0.3); G.fillRect(x + w * 0.12, y + h * 0.25, w * 0.12, h * 0.5); G.fillRect(x + w * 0.76, y + h * 0.25, w * 0.12, h * 0.5);
    G.restore();
  }
  /** ojo de dibujo animado (esfera blanca + pupila que mira a (lx,ly) -1..1) */
  function googly(G, x, y, r, lx, ly, P) {
    G.save();
    const g = G.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, P.white); g.addColorStop(0.7, mix(P.white, P.paper, 0.4)); g.addColorStop(1, mix(P.paper, P.fogDark, 0.4));
    G.fillStyle = g; G.beginPath(); G.arc(x, y, r, 0, TAU); G.fill();
    const px = x + lx * r * 0.42, py = y + ly * r * 0.42;
    G.fillStyle = P.black; G.beginPath(); G.arc(px, py, r * 0.42, 0, TAU); G.fill();
    G.fillStyle = P.white; G.beginPath(); G.arc(px + r * 0.12, py - r * 0.14, r * 0.11, 0, TAU); G.fill();
    G.restore();
  }
  /** rectángulo redondeado (lente) */
  function rrect(G, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); G.beginPath(); G.moveTo(x + r, y); G.arcTo(x + w, y, x + w, y + h, r); G.arcTo(x + w, y + h, x, y + h, r); G.arcTo(x, y + h, x, y, r); G.arcTo(x, y, x + w, y, r); G.closePath(); }
  /** chispa: líneas radiales cortas */
  function sparks(G, x, y, r0, r1, n, rot, color, lw) {
    G.save(); G.strokeStyle = color; G.lineWidth = lw; G.lineCap = "round"; G.beginPath();
    for (let i = 0; i < n; i++) { const a = rot + i / n * TAU; G.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); G.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); }
    G.stroke(); G.restore();
  }

  /* ------------------------------------------------------------- lente ojo de pez */
  /** lienzo del tamaño del escenario para dibujar una escena y deformarla */
  function scratch(ctx, k = 0) {
    const { W, H } = ctx.stage, dpr = ctx.dpr, S = STATE;
    let c = S.scratch[k];
    if (!c || c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c = document.createElement("canvas"); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); S.scratch[k] = c; }
    const g = c.getContext("2d"); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    return [c, g];
  }
  /**
   * Abombado tipo ojo de pez: copia `src` (lienzo del escenario) a G con malla de celdas;
   * el centro se agranda (k 0..0.6) y todo queda dentro de un rectángulo redondeado (box).
   */
  function fisheye(ctx, G, src, k, box, rad) {
    const { W, H } = ctx.stage, dpr = ctx.dpr, nx = 26, ny = Math.round(26 * H / W) || 14;
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2, R = Math.hypot(box.w, box.h) / 2;
    const map = (x, y) => { const dx = (x - cx) / R, dy = (y - cy) / R, r2 = dx * dx + dy * dy, f = (1 - k) + k * r2 * 1.15; return [cx + dx * f * R * (W / box.w), cy + dy * f * R * (H / box.h)]; };
    G.save(); rrect(G, box.x, box.y, box.w, box.h, rad); G.clip();
    const cw = box.w / nx, ch = box.h / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x0 = box.x + i * cw, y0 = box.y + j * ch;
      const a = map(x0, y0), b = map(x0 + cw, y0 + ch);
      const sx = Math.min(a[0], b[0]), sy = Math.min(a[1], b[1]), sw = Math.abs(b[0] - a[0]), sh = Math.abs(b[1] - a[1]);
      if (sw < 0.5 || sh < 0.5) continue;
      try { G.drawImage(src, sx * dpr, sy * dpr, sw * dpr, sh * dpr, x0 - 0.4, y0 - 0.4, cw + 0.8, ch + 0.8); } catch (e) {}
    }
    G.restore();
  }

  /* ------------------------------------------------------------- transiciones (entrada) */
  /**
   * Entrada del plano (la "transición" de la referencia). Uso en render:
   *   const T = D.enter(ctx, p.fx, lt, b); T.begin(G); …dibujar…; T.end(G);
   *  whip   · barrido con desenfoque de movimiento horizontal (0,2 s) — ref. 1,0 / 2,7 s
   *  blob   · manchas verdes orgánicas que crecen y destapan el plano sobre el saliente,
   *           destello blanco y un cuadro de líneas de barrido — ref. 1,95–2,3 s
   *  leak   · fuga de luz roja/naranja que se apaga — ref. 3,7 s
   *  pixel  · disolución en píxeles desde abajo sobre el plano saliente — ref. 8,4 s
   *  scan   · 2 cuadros oscuros con líneas de barrido — ref. 1,6 s
   *  zoom   · el plano entra de 1,45× a 1× (alejamiento brusco) — ref. 0,5 / 14,8 s
   *  flash  · destello blanco de 2 cuadros
   *  cut    · corte seco
   */
  function enter(ctx, kind, lt, b) {
    const { W, H, u } = ctx.stage, P = ctx.C.palette, f = Math.floor(lt * FPS + 1e-6), seed = (b?.i ?? 1) * 7 + 3;
    const nop = { begin() {}, end() {} };
    if (!kind || kind === "cut" || lt > 0.6) return nop;
    if (kind === "blob") {
      const q = prog(lt, 0, 0.32, "in");
      const r = K.rng(seed), petals = Array.from({ length: 6 }, (_, i) => ({ a: -0.2 - i * 0.28 + r() * 0.2, d: 0.15 + r() * 0.5, s: 0.45 + r() * 0.45, e: 0.35 + r() * 0.3, o: i * 0.05 }));
      const path = () => {
        const p = new Path2D(), D0 = Math.hypot(W, H);
        for (const k of petals) {
          const s = clamp((q - k.o) / (1 - k.o)) * k.s * D0 * 1.25;
          if (s <= 0) continue;
          const x = W * 0.05 + Math.cos(k.a) * k.d * D0 * q, y = H * 1.0 + Math.sin(k.a) * k.d * D0 * q;
          p.ellipse(x, y, s * 0.5, s * k.e * 0.5, k.a + 0.6, 0, TAU);
        }
        return p;
      };
      let pth = null;
      return {
        begin(G) { if (q >= 1) return; pth = path(); G.save(); G.clip(pth); },
        end(G) {
          if (q < 1 && pth) { G.restore(); G.save(); G.strokeStyle = rgba(P.feltDark, 0.85); G.lineWidth = u * 0.7; G.stroke(pth); G.restore(); }
          const T = ctx.g.top;
          if (f === 6) { T.save(); T.fillStyle = rgba(P.white, 0.85); T.fillRect(0, 0, W, H); T.restore(); }
          if (f === 8) scanFrame(T, W, H, u, P, seed);
        },
      };
    }
    if (kind === "pixel") {
      const q = prog(lt, 0, 0.36, "linear");
      const cs = u * 2.2, nx = Math.ceil(W / cs), ny = Math.ceil(H / cs);
      return {
        begin(G) {
          if (q >= 1) return;
          const p = new Path2D(), r = K.rng(seed);
          for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
            const x = i * cs, y = j * cs, d = Math.hypot((x - W / 2) / W, (H - y) / H * 0.9) * 0.9 + r() * 0.28;
            if (d < q * 1.25) p.rect(x, y, cs + 0.5, cs + 0.5);
          }
          G.save(); G.clip(p);
        },
        end(G) { if (q < 1) G.restore(); },
      };
    }
    if (kind === "zoom") {
      const q = prog(lt, 0, 0.22, "expoOut"), s = lerp(1.45, 1, q);
      return {
        begin(G) { if (q >= 1) return; G.save(); G.translate(W / 2, H / 2); G.scale(s, s); G.translate(-W / 2, -H / 2); },
        end(G) { if (q < 1) { G.restore(); if (f < 3) smear(ctx, 0, (1 - q) * u * 3, 4, 0.2); } },
      };
    }
    return {
      begin() {},
      end(G) {
        const T = ctx.g.top;
        if (kind === "whip" && f < 6) smear(ctx, (1 - f / 6) * W * 0.06, 0, 6, 0.16);
        if (kind === "scan" && f < 2) scanFrame(T, W, H, u, P, seed + f);
        if (kind === "flash" && f < 2) { T.save(); T.fillStyle = rgba(P.white, f ? 0.5 : 0.9); T.fillRect(0, 0, W, H); T.restore(); }
        if (kind === "leak") {
          const a = 1 - prog(lt, 0.04, 0.3, "out");
          if (a > 0) {
            T.save(); T.globalCompositeOperation = "screen"; T.globalAlpha = a;
            const g = T.createRadialGradient(W * 0.2, H * 0.9, 0, W * 0.25, H * 0.85, Math.max(W, H) * 0.75);
            g.addColorStop(0, rgba(P.leak, 0.95)); g.addColorStop(0.45, rgba(P.gold, 0.55)); g.addColorStop(1, rgba(P.leak, 0));
            T.fillStyle = g; T.fillRect(0, 0, W, H); T.restore();
          }
        }
      },
    };
  }
  /** cuadro oscuro con líneas de barrido (glitch de video de la referencia) */
  function scanFrame(T, W, H, u, P, seed) {
    T.save(); T.fillStyle = rgba(P.black, 0.82); T.fillRect(0, 0, W, H);
    const r = K.rng(seed * 13 + 5);
    T.fillStyle = rgba(P.fog, 0.18);
    for (let y = 0; y < H; y += u * 0.45) if (r() < 0.6) T.fillRect(0, y, W, u * 0.16);
    T.restore();
  }
  /** desenfoque de movimiento del cuadro ya dibujado (copia de layers.main en top) */
  function smear(ctx, dx, dy, n = 5, a = 0.18) {
    const T = ctx.g.top, { W, H } = ctx.stage, src = ctx.layers.main;
    T.save();
    for (let i = 1; i <= n; i++) { T.globalAlpha = a; const k = i / n - 0.5; try { T.drawImage(src, k * dx * 2, k * dy * 2, W, H); } catch (e) {} }
    T.restore();
  }
  /**
   * ¿sigue dibujándose el plano después de su fin? Solo si el siguiente plano lo necesita
   * debajo (entra con blob o pixel); si no, corte seco (como la referencia).
   */
  function keep(ctx, b, lt) {
    if (lt <= b.dur) return true;
    let nx = null;
    for (const x of ctx.beats) if (x.layer === "main" && x.i !== b.i && x.t0 > b.t0 && x.t0 <= b.t1 + 0.05 && (!nx || x.t0 < nx.t0)) nx = x;
    if (!nx) return false;
    const def = K.registry.get(nx.use);
    const fx = nx.params?.fx ?? def?.params?.fx?.default;
    return (fx === "blob" || fx === "pixel") && lt < b.dur + 0.42;
  }
  const FX = (def = "cut") => ({ fx: { type: "enum", options: ["cut", "whip", "blob", "leak", "pixel", "scan", "zoom", "flash"], default: def, doc: "Entrada del plano (transición de la referencia): cut = corte seco · whip = barrido con desenfoque · blob = manchas verdes que destapan sobre el plano anterior · leak = fuga de luz roja · pixel = disolución en píxeles desde abajo · scan = líneas de barrido · zoom = alejamiento brusco · flash = destello." } });
  const FOCUS = { focus: { type: "array", default: [0.5, 0.5], doc: "Punto de la foto que queda al centro del recorte [x,y] (0..1)." } };
  /** palabras de la narración dentro del beat */
  const words = (ctx, b) => ctx.words.filter(w => w.start >= b.t0 - 0.05 && w.start < b.t1 - 0.05);
  const frameOf = lt => Math.floor(lt * FPS + 1e-6);
  const SCR = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  /** decodificación: letras al azar que se resuelven de izquierda a derecha */
  function decode(s, lt, cps = 14, seed = 1) {
    const f = frameOf(lt), n = Math.floor(Math.max(0, lt) * cps);
    return [...String(s)].map((c, i) => {
      if (c === " " || i < n - 2) return c;
      if (i > n + 4) return " ";
      const r = K.rng(seed * 991 + Math.floor(f / 2) * 37 + i)();
      return SCR[Math.floor(r * SCR.length)];
    }).join("");
  }

  /* ------------------------------------------------------------- familia */
  K.family("dinero", {
    setup(ctx) {
      STATE = { tint: new Map(), grain: [], scratch: [] };
      const r = K.rng(5150);
      for (let k = 0; k < 4; k++) {
        const c = document.createElement("canvas"); c.width = c.height = 256;
        const g = c.getContext("2d"), d = g.createImageData(256, 256);
        for (let i = 0; i < d.data.length; i += 4) { const v = r() < 0.5 ? 0 : 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = Math.floor(r() * 255); }
        g.putImageData(d, 0, 0); STATE.grain.push(c);
      }
      /* fibra del fieltro verde: trazos cortos sembrados */
      const fc = document.createElement("canvas"); fc.width = fc.height = 320; const fg = fc.getContext("2d");
      fg.fillStyle = "#808080"; fg.fillRect(0, 0, 320, 320);
      for (let i = 0; i < 2600; i++) { const x = r() * 320, y = r() * 320, a = r() * TAU, l = 2 + r() * 7; fg.strokeStyle = r() < 0.5 ? "rgba(255,255,255,.5)" : "rgba(0,0,0,.5)"; fg.lineWidth = 0.6; fg.beginPath(); fg.moveTo(x, y); fg.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); fg.stroke(); }
      STATE.felt = fc;
      /* subtítulos: tira negro verdoso con filo verde, Open Sans; palabra actual en verde billete */
      const P = ctx.C.palette;
      if (!document.getElementById("dinero-css")) {
        const st = document.createElement("style"); st.id = "dinero-css";
        st.textContent = `
[data-family="dinero"] .k-cap { font-family: 'Open Sans', sans-serif; font-weight: 700; color: ${rgba(P.white, 0.74)};
  font-size: clamp(14px, 3.1vmin, 42px); line-height: 1.16; letter-spacing: -.005em; text-shadow: none; }
[data-family="dinero"] .k-cap-line { background: ${rgba(P.black, 0.88)}; padding: .2em .6em .26em .5em; max-width: 88% !important;
  border-left: .3em solid ${P.accent}; border-radius: .12em; }
[data-family="dinero"] .k-w-cur { color: ${mix(P.accent, P.white, 0.15)}; font-weight: 800; }`;
        document.head.appendChild(st);
      }
      return STATE;
    },
    frame(t, ctx) {
      const { stage, g, C } = ctx;
      g.bg.fillStyle = C.palette.bg; g.bg.fillRect(0, 0, stage.W, stage.H);
    },
    post(t, ctx) {
      const a = ctx.C.dinero?.grain ?? 0.035; if (!a || !STATE) return;
      const G = ctx.g.top, { W, H } = ctx.stage, c = STATE.grain[Math.floor(t * FPS) % 4];
      G.save(); G.globalAlpha = a; G.fillStyle = G.createPattern(c, "repeat"); G.fillRect(0, 0, W, H); G.restore();
    },
    resize() { if (STATE) STATE.scratch = []; },
  });

  K.dinero = { FPS, TAU, SERIF, THIN, SANS, measure, text, fit, glyphs, marks, wrap, hex, rgba, mix, lut, tint, cover,
               vignette, fogBg, feltBg, paperBg, sageBg, solid, coin, bill, googly, rrect, sparks, scratch, fisheye,
               enter, smear, scanFrame, keep, FX, FOCUS, words, frameOf, decode };
})();

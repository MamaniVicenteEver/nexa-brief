/* =============================================================================
   cronica · runtime de la familia "crónica histórica en capas 3D"
   -----------------------------------------------------------------------------
   Réplica del estilo de un slideshow histórico oscuro: fotos B/N con bordes de
   pincel rasgados, rótulos grises pincelados con el año, párrafos serif blancos,
   capas tenues (fotos fantasma, letras gigantes, bloquecitos de texto con barra,
   líneas finas con nodos) flotando en un espacio 3D, y una CÁMARA que mira todo
   en perspectiva oblicua con PROFUNDIDAD DE CAMPO real (lo cercano y lo lejano
   se desenfocan), corta en seco a un plano nuevo y hace "rack focus".

   Cómo funciona (sin tocar el motor):
   · cada beat arma su propio mundo DOM con CSS 3D (`perspective` + `preserve-3d`)
     dentro de ctx.layers.dom; la cámara es el transform del contenedor `world`,
     calculado en JS desde `lt` (función pura del tiempo → seek determinista);
   · el desenfoque por profundidad se calcula aquí: se proyecta cada esquina de
     cada elemento con la misma matriz que usa CSS y se pone `filter: blur()`.
     En los planos grandes (fotos) se superpone una copia más desenfocada con una
     máscara en gradiente orientada hacia donde el plano se aleja → el plano pasa
     de nítido a borroso de un lado a otro, como un tilt-shift / lente real;
   · texturas (pincel, rasgado, grano, polvo) generadas con rng sembrado una vez
     y cacheadas (no se copia nada de la referencia);
   · polvo que cae, bokeh, grano y viñeta: capa `top` (canvas) en post().
   Utilidades en Kit.cronica.
   ========================================================================== */
(function () {
  const K = window.Kit, { clamp, lerp, prog, ease } = K;
  const SERIF = "'EB Garamond', Garamond, 'Times New Roman', serif";
  for (const f of ["400 40px 'EB Garamond'", "500 40px 'EB Garamond'", "600 40px 'EB Garamond'", "700 40px 'EB Garamond'",
    "italic 500 40px 'EB Garamond'", "italic 600 40px 'EB Garamond'"]) K.fonts.add(f);

  /* ---------------------------------------------------------------- estilo */
  const css = document.createElement("style");
  css.textContent = `
  [data-family="cronica"] .k-cap { font-family: ${SERIF}; font-style: italic; font-weight: 500; color: rgba(232,232,230,.62);
     font-size: clamp(15px, 3.3vmin, 44px); letter-spacing: .005em; text-shadow: 0 2px 14px rgba(0,0,0,.95), 0 0 2px rgba(0,0,0,.8); }
  [data-family="cronica"] .k-w-cur { color: #fff; font-weight: 600; }
  .cr-view { position: absolute; left: 0; top: 0; overflow: hidden; }
  .cr-world { position: absolute; width: 0; height: 0; transform-style: preserve-3d; }
  .cr-it { position: absolute; left: 0; top: 0; transform-origin: 0 0; backface-visibility: hidden; }
  .cr-txt { font-family: ${SERIF}; color: #f1f1ef; white-space: nowrap; text-shadow: 0 0 .5em rgba(0,0,0,.45); }
  `;
  document.head.appendChild(css);

  /* ---------------------------------------------------------------- ruido / texturas */
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };
  /** ruido 1D suave (suma de senos con fases sembradas) */
  function noise1(r) {
    const f = [r() * 0.02 + 0.006, r() * 0.06 + 0.03, r() * 0.2 + 0.1], ph = [r() * 9, r() * 9, r() * 9];
    return x => 0.5 + 0.28 * Math.sin(x * f[0] + ph[0]) + 0.14 * Math.sin(x * f[1] + ph[1]) + 0.08 * Math.sin(x * f[2] + ph[2]);
  }
  const TEX = new Map();
  /**
   * Rectángulo pintado a pincel (máscara blanca sobre transparente): bordes rasgados,
   * trazos horizontales secos que se escapan por los lados, puntas fibrosas arriba/abajo.
   * o = { m: margen (fracción), dry: 0..1 sequedad, fade: "right"|"" }
   */
  function brush(w, h, seed, o = {}) {
    const key = `b${w}x${h}:${seed}:${o.m}:${o.dry}:${o.fade}`;
    if (TEX.has(key)) return TEX.get(key);
    const c = mk(w, h), g = c.getContext("2d"), r = K.rng(seed);
    const m = Math.min(w, h) * (o.m ?? 0.08), dry = o.dry ?? 0.5;
    const nl = noise1(r), nr = noise1(r), nt = noise1(r), nb = noise1(r);
    g.fillStyle = "#fff";
    /* cuerpo: pinceladas horizontales con extremos irregulares */
    for (let y = 0; y < h; y += 1.5) {
      /* extremos: borde ondulado + alguna fibra suelta; el interior queda opaco (sin bandas) */
      const x0 = m * (0.25 + 1.5 * nl(y)) + (r() < 0.04 ? -r() * m * 0.7 : (r() - 0.5) * m * 0.25);
      const x1 = w - m * (0.25 + 1.5 * nr(y)) - (r() < 0.04 ? -r() * m * 0.7 : (r() - 0.5) * m * 0.25);
      const ew = m * 1.4;
      g.globalAlpha = 1; g.fillRect(x0 + ew, y, Math.max(0, x1 - x0 - 2 * ew), 1.9);
      g.globalAlpha = 0.86 + r() * 0.14; g.fillRect(x0, y, ew, 1.9); g.fillRect(x1 - ew, y, ew, 1.9);
    }
    g.globalAlpha = 1;
    /* bordes superior e inferior: ondulados con fibras */
    g.globalCompositeOperation = "destination-out";
    for (let x = 0; x < w; x += 1) {
      const tb = m * (0.35 + 1.25 * nt(x)) + (r() < 0.07 ? r() * m * 1.3 : 0) - (r() < 0.05 ? r() * m * 0.4 : 0);
      const bb = m * (0.35 + 1.25 * nb(x)) + (r() < 0.07 ? r() * m * 1.3 : 0) - (r() < 0.05 ? r() * m * 0.4 : 0);
      g.fillRect(x, 0, 1, Math.max(0, tb)); g.fillRect(x, h - Math.max(0, bb), 1, Math.max(0, bb));
    }
    /* pincel seco: rayitas horizontales vacías cerca de los bordes (y algunas adentro) */
    const nDry = Math.round((w * h) / 900 * dry);
    for (let i = 0; i < nDry; i++) {
      const edge = r() < 0.8, side = r() < 0.5;
      const x = edge ? (side ? r() * m * 3.2 : w - r() * m * 3.2) : r() * w, y = edge && r() < 0.5 ? (r() < 0.5 ? r() * m * 2.5 : h - r() * m * 2.5) : r() * h;
      g.globalAlpha = (edge ? 0.5 : 0.12) + r() * 0.5;
      g.fillRect(x - r() * 14, y, 4 + r() * (edge ? 22 : 50), 0.7 + r() * 1.2);
    }
    g.globalAlpha = 1;
    if (o.fade === "right") {         /* rótulo que se esfuma a la derecha (mancha de pincel) */
      const gr = g.createLinearGradient(0, 0, w, 0);
      gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(0.62, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,.92)");
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    g.globalCompositeOperation = "source-over";
    TEX.set(key, c);
    return c;
  }
  /** brush teñido de un color → dataURL (para background-image de planos) */
  function brushURL(w, h, seed, color, o = {}) {
    const key = `u${w}x${h}:${seed}:${color}:${o.m}:${o.dry}:${o.fade}`;
    if (TEX.has(key)) return TEX.get(key);
    const src = brush(w, h, seed, o), c = mk(w, h), g = c.getContext("2d");
    g.drawImage(src, 0, 0); g.globalCompositeOperation = "source-in"; g.fillStyle = color; g.fillRect(0, 0, w, h);
    const url = c.toDataURL("image/png");
    TEX.set(key, url);
    return url;
  }
  /** pincelada larga (para revelar fotos a trazos) */
  function stroke(seed) {
    const key = "s" + seed;
    if (TEX.has(key)) return TEX.get(key);
    const w = 512, h = 96, c = mk(w, h), g = c.getContext("2d"), r = K.rng(seed);
    const nt = noise1(r), nb = noise1(r);
    g.fillStyle = "#fff";
    for (let x = 0; x < w; x++) {
      const tip = Math.min(1, x / 40, (w - x) / 30);
      const t = h * (0.05 + 0.25 * nt(x)) + (1 - tip) * h * 0.3, b = h * (0.05 + 0.25 * nb(x)) + (1 - tip) * h * 0.3;
      g.globalAlpha = 0.85 + r() * 0.15; g.fillRect(x, t, 1, Math.max(0, h - t - b));
    }
    g.globalCompositeOperation = "destination-out";
    for (let i = 0; i < 110; i++) { g.globalAlpha = 0.3 + r() * 0.6; g.fillRect(r() * w, r() * h, 10 + r() * 60, 0.8 + r() * 1.4); }
    TEX.set(key, c);
    return c;
  }
  /** foto graduada: B/N contrastado (como el archivo de la referencia), cacheada */
  function graded(src, dim = 1) {
    const key = "g" + src + ":" + dim;
    if (TEX.has(key)) return TEX.get(key);
    const im = K.loaded.get(src);
    if (!im) return null;
    const s = Math.min(1, 1600 / Math.max(im.width, im.height));
    const c = mk(im.width * s, im.height * s), g = c.getContext("2d");
    g.filter = `grayscale(1) contrast(${dim < 1 ? 1.05 : 1.22}) brightness(${(dim < 1 ? 0.9 : 1.04) * dim})`;
    g.drawImage(im, 0, 0, c.width, c.height);
    g.filter = "none";
    TEX.set(key, c);
    return c;
  }
  /** dibuja `img` cubriendo (x,y,w,h) con punto de interés `focus` y zoom */
  function cover(g, img, x, y, w, h, focus = [0.5, 0.5], zoom = 1) {
    const s = Math.max(w / img.width, h / img.height) * zoom, iw = img.width * s, ih = img.height * s;
    const ox = clamp((w - iw) * focus[0], w - iw, 0), oy = clamp((h - ih) * focus[1], h - ih, 0);
    g.drawImage(img, x + ox, y + oy, iw, ih);
  }

  /* ---------------------------------------------------------------- escena 3D */
  const D2R = Math.PI / 180;
  /**
   * Mundo 3D de un beat. La cámara mira el punto (tx,ty,tz) desde la distancia d·P
   * con rotaciones rx (inclinación), ry (giro), rz (alabeo). P = distancia de la
   * perspectiva CSS. Todas las medidas en px del escenario (usar u).
   */
  function Scene(ctx, o = {}) {
    const { W, H, u } = ctx.stage, CC = ctx.C.cronica || {};
    const P = 0.78 * Math.hypot(W, H);
    const view = K.el("div", "cr-view", { width: W + "px", height: H + "px", perspective: P + "px", perspectiveOrigin: "50% 50%" }, ctx.layers.dom);
    const world = K.el("div", "cr-world", { left: W / 2 + "px", top: H / 2 + "px" }, view);
    const items = [];
    const S = { ctx, P, u, W, H, view, world, items, A: o.aperture ?? CC.aperture ?? 9, maxB: (o.maxBlur ?? CC.maxBlur ?? 5.5) * u };

    /** agrega un plano: spec = {x,y,z,w,h,rz,dof:"center"|"grad"|"none",opacity} → item (it.a = contenido) */
    S.add = spec => {
      const it = { x: 0, y: 0, z: 0, rz: 0, w: 10, h: 10, dof: "center", opacity: 1, blur: 0, ...spec };
      const el = K.el("div", "cr-it", { width: it.w + "px", height: it.h + "px",
        transform: `translate3d(${it.x.toFixed(2)}px,${it.y.toFixed(2)}px,${it.z.toFixed(2)}px) rotate(${it.rz}deg) translate(${(-it.w / 2).toFixed(2)}px,${(-it.h / 2).toFixed(2)}px)` }, world);
      it.el = el;
      if (it.dof === "grad") {
        it.a = K.el("div", null, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }, el);
        it.b = K.el("div", null, { position: "absolute", left: "0", top: "0", width: "100%", height: "100%" }, el);
      } else it.a = el;
      const c = Math.cos(it.rz * D2R), s = Math.sin(it.rz * D2R);
      it.corners = [[0, 0], [it.w, 0], [it.w, it.h], [0, it.h]].map(([lx, ly]) => {
        const dx = lx - it.w / 2, dy = ly - it.h / 2; return [it.x + c * dx - s * dy, it.y + s * dx + c * dy, it.z];
      });
      items.push(it);
      return it;
    };
    /** plano con imagen de fondo (dataURL o canvas → se dibuja en ambas capas si es grad) */
    S.image = (spec, url) => {
      const it = S.add(spec);
      for (const e of it.b ? [it.a, it.b] : [it.a]) Object.assign(e.style, { backgroundImage: `url(${url})`, backgroundSize: "100% 100%" });
      return it;
    };
    /** plano con canvas propio (fotos): it.cv / it.cv2 (copia para el gradiente de foco) */
    S.canvas = (spec, res) => {
      const it = S.add(spec);
      const cw = Math.round(Math.min(1800, it.w * res)), ch = Math.round(cw * it.h / it.w);
      it.cv = mk(cw, ch); Object.assign(it.cv.style, { width: "100%", height: "100%", display: "block" }); it.a.appendChild(it.cv);
      if (it.b) { it.cv2 = mk(cw, ch); Object.assign(it.cv2.style, { width: "100%", height: "100%", display: "block" }); it.b.appendChild(it.cv2); }
      it.sync = () => { if (it.cv2) { const g = it.cv2.getContext("2d"); g.clearRect(0, 0, cw, ch); g.drawImage(it.cv, 0, 0); } };
      return it;
    };

    const setBlur = (e, key, it, px) => {
      const v = px < 0.25 ? 0 : Math.round(px * 4) / 4;
      if (it[key] === v) return;
      it[key] = v; e.style.filter = v ? `blur(${v}px)` : "none";
    };
    /** pinta un cuadro: cam = {tx,ty,tz,d,rx,ry,rz,focus,rack} */
    S.render = cam => {
      const d = cam.d * P, tx = cam.tx || 0, ty = cam.ty || 0, tz = cam.tz || 0;
      world.style.transform = `translateZ(${(P - d).toFixed(2)}px) rotateZ(${cam.rz.toFixed(3)}deg) rotateX(${cam.rx.toFixed(3)}deg) rotateY(${cam.ry.toFixed(3)}deg) translate3d(${(-tx).toFixed(2)}px,${(-ty).toFixed(2)}px,${(-tz).toFixed(2)}px)`;
      const cx = Math.cos(cam.rx * D2R), sx = Math.sin(cam.rx * D2R), cy = Math.cos(cam.ry * D2R), sy = Math.sin(cam.ry * D2R);
      /* distancia al ojo de un punto del mundo (misma matriz que el CSS de arriba) */
      const dist = p => { const x1 = p[0] - tx, y1 = p[1] - ty, z1 = p[2] - tz; const z2 = -sy * x1 + cy * z1; return d - (sx * y1 + cx * z2); };
      /* plano de foco: el punto `fp` (p. ej. el texto) o el objetivo de la cámara */
      const fd = (cam.fp ? dist(cam.fp) : d) * (cam.focus ?? 1), rack = cam.rack || 0;
      const coc = s => Math.min(S.maxB, S.A * u * Math.abs(s) / fd + rack);
      for (const it of items) {
        const op = clamp(it.opacity);
        if (op <= 0.004) { if (it._vis !== 0) { it.el.style.display = "none"; it._vis = 0; } continue; }
        if (it._vis !== 1) { it.el.style.display = ""; it._vis = 1; }
        const o3 = Math.round(op * 1000) / 1000;
        if (it._op !== o3) { it._op = o3; it.el.style.opacity = o3; }
        if (it.dof === "none") { setBlur(it.a, "_fa", it, it.blur); continue; }
        const ds = it.corners.map(dist), dc = Math.max(1, (ds[0] + ds[2]) / 2), k = dc / P;   /* blur local = blur en pantalla · dist/P */
        if (it.dof !== "grad") { setBlur(it.a, "_fa", it, (coc(dc - fd) + it.blur) * k); continue; }
        const s = ds.map(v => v - fd), smin = Math.min(...s), smax = Math.max(...s);
        const bt = t => coc(smin + t * (smax - smin));
        const bmin = smin < 0 && smax > 0 ? coc(0) : Math.min(bt(0), bt(1)), bmax = Math.max(bt(0), bt(1));
        setBlur(it.a, "_fa", it, (bmin + it.blur) * k);
        if (bmax - bmin < 0.6) { if (it._bv !== 0) { it.b.style.display = "none"; it.a.style.webkitMaskImage = it.a.style.maskImage = "none"; it._bv = 0; it._mk = ""; } continue; }
        if (it._bv !== 1) { it.b.style.display = ""; it._bv = 1; }
        setBlur(it.b, "_fb", it, (bmax + it.blur) * k);
        /* dirección del gradiente: hacia donde crece la distancia (local) */
        const gx = (s[1] - s[0]) / it.w, gy = (s[3] - s[0]) / it.h;
        const ang = Math.round(Math.atan2(gx, -gy) / D2R);
        const stA = [], stB = [];
        for (let i = 0; i <= 6; i++) {
          const t = i / 6, m = clamp((bt(t) - bmin) / (bmax - bmin));
          stB.push(`rgba(0,0,0,${m.toFixed(2)}) ${Math.round(t * 100)}%`);
          stA.push(`rgba(0,0,0,${clamp(2 - 2 * m).toFixed(2)}) ${Math.round(t * 100)}%`);
        }
        const mb = `linear-gradient(${ang}deg, ${stB.join(",")})`;
        if (it._mk !== mb) {
          it._mk = mb;
          it.b.style.webkitMaskImage = it.b.style.maskImage = mb;
          it.a.style.webkitMaskImage = it.a.style.maskImage = `linear-gradient(${ang}deg, ${stA.join(",")})`;
        }
      }
    };
    S.dispose = () => view.remove();
    return S;
  }

  /* ---------------------------------------------------------------- texto */
  const MC = mk(4, 4).getContext("2d");
  const fontStr = (size, weight = 600, italic = false) => `${italic ? "italic " : ""}${weight} ${size}px ${SERIF}`;
  function measure(str, size, weight, italic, spacing = 0) {
    MC.font = fontStr(size, weight, italic);
    return MC.measureText(str).width + spacing * size * Math.max(0, [...str].length - 1);
  }
  function wrap(text, size, weight, italic, maxW) {
    const out = [];
    for (const para of String(text).split("\n")) {
      let cur = "";
      for (const w of para.split(/\s+/).filter(Boolean)) {
        const t = cur ? cur + " " + w : w;
        if (cur && measure(t, size, weight, italic) > maxW) { out.push(cur); cur = w; } else cur = t;
      }
      if (cur) out.push(cur);
    }
    return out;
  }
  /**
   * Párrafo serif como planos por renglón (para revelarlos uno a uno y desenfocarlos
   * cada uno según su profundidad). o = {x0, y0, w, size, lh, weight, italic, align, z, color}
   * align: left | center | justify (justifica todos menos el último, como la referencia)
   */
  function para(S, text, o) {
    const size = o.size, lh = o.lh ?? 1.18, lines = wrap(text, size, o.weight ?? 600, o.italic, o.w);
    return lines.map((ln, i) => {
      const it = S.add({ x: o.x0 + o.w / 2, y: o.y0 + (i + 0.5) * size * lh, z: o.z ?? 0, w: o.w, h: size * lh * 1.1, rz: o.rz || 0 });
      const just = o.align === "justify" && i < lines.length - 1 && lines.length > 1;
      Object.assign(it.a.style, { fontFamily: SERIF, fontSize: size + "px", fontWeight: o.weight ?? 600, fontStyle: o.italic ? "italic" : "normal",
        lineHeight: size * lh * 1.1 + "px", color: o.color || "#f1f1ef", textAlign: just ? "justify" : (o.align === "center" ? "center" : o.align === "right" ? "right" : "left"),
        textAlignLast: just ? "justify" : "auto", whiteSpace: "nowrap", textShadow: "0 0 .45em rgba(0,0,0,.5)" });
      if (just) it.a.style.whiteSpace = "normal";
      it.a.textContent = ln;
      it.line = ln;
      return it;
    });
  }

  /* ---------------------------------------------------------------- piezas */
  /** foto con borde rasgado + revelado a pinceladas; it.draw(q 0..1) */
  function photo(S, src, o) {
    const it = S.canvas({ x: o.x, y: o.y, z: o.z ?? 0, w: o.w, h: o.h, rz: o.rz || 0, dof: o.dof || "grad", opacity: o.opacity ?? 1 }, o.res ?? (3 * S.ctx.dpr / 2));
    const cw = it.cv.width, ch = it.cv.height, seed = o.seed ?? 7;
    const torn = brush(512, Math.round(512 * o.h / o.w), seed, { m: o.margin ?? 0.075, dry: o.dry ?? 0.35 });
    const img = graded(src, o.dim ?? 1);
    const r = K.rng(seed * 13 + 5), N = 6;
    const strokes = Array.from({ length: N }, (_, i) => ({ y: (i / N) * ch - ch * 0.06 + r() * ch * 0.05, h: ch / N * 1.9, d0: r() * 0.35 + i * 0.07, flip: r() < 0.3, tex: stroke(seed * 7 + i) }));
    const g = it.cv.getContext("2d");
    let last = -1;
    it.draw = q => {
      q = Math.round(clamp(q) * 60) / 60;
      if (q === last) return;
      last = q;
      g.globalCompositeOperation = "source-over"; g.clearRect(0, 0, cw, ch);
      if (q <= 0) { it.sync(); return; }
      if (q < 1) {
        for (const s of strokes) {
          const p = ease.out(clamp((q - s.d0 * 0.6) / 0.55));
          if (p <= 0) continue;
          const sw = cw * 1.25 * p, sx = s.flip ? cw * 1.1 - sw : -cw * 0.1;
          g.drawImage(s.tex, s.flip ? s.tex.width * (1 - p) : 0, 0, s.tex.width * p, s.tex.height, sx, s.y, sw, s.h);
        }
        g.globalCompositeOperation = "destination-in";
      }
      g.drawImage(torn, 0, 0, cw, ch);
      g.globalCompositeOperation = "source-in";
      if (img) cover(g, img, 0, 0, cw, ch, o.focus || [0.5, 0.5], o.zoom || 1);
      else { g.fillStyle = "#777"; g.fillRect(0, 0, cw, ch); }
      /* bordes quemados: oscurece el contorno dentro del rasgado */
      g.globalCompositeOperation = "source-atop";
      const vg = g.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.35, cw / 2, ch / 2, Math.hypot(cw, ch) * 0.55);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, `rgba(0,0,0,${o.burn ?? 0.42})`);
      g.fillStyle = vg; g.fillRect(0, 0, cw, ch);
      g.globalCompositeOperation = "source-over";
      it.sync();
    };
    it.draw(o.revealed ? 1 : 0);
    return it;
  }
  /** rótulo gris pincelado con el año (o dato corto) encima */
  function yearTag(S, text, o) {
    const u = S.u, size = o.size, wTxt = measure(text, size, 700, o.italic, 0.01);
    const w = wTxt + size * (o.pad ?? 1.35), h = size * 1.42;
    const x = o.align === "center" ? o.x : o.x + w / 2;
    const sw = S.image({ x: x + size * 0.08, y: o.y, z: (o.z ?? 0) - 0.15 * u, w: w * 1.08, h, dof: "center" },
      brushURL(320, Math.round(320 * h / (w * 1.08)), o.seed ?? 3, o.color || "#5c5c5c", { m: 0.1, dry: 0.9, fade: o.fade ? "right" : "" }));
    const tx = S.add({ x, y: o.y + size * 0.03, z: (o.z ?? 0) + 0.1 * u, w, h, dof: "center" });
    Object.assign(tx.a.style, { fontFamily: SERIF, fontWeight: 700, fontStyle: o.italic ? "italic" : "normal", fontSize: size + "px", lineHeight: h + "px",
      textAlign: "center", color: "#f6f6f4", whiteSpace: "nowrap", letterSpacing: ".01em", textShadow: "0 0 .35em rgba(0,0,0,.35)" });
    tx.a.textContent = text;
    return { sw, tx, w, h, x };
  }
  /** bloquecito decorativo: barra vertical blanca + 2-3 renglones diminutos */
  function block(S, text, o) {
    const u = S.u, size = o.size ?? 1.12 * u, w = o.w ?? 24 * u, lines = wrap(text, size, 500, false, w - size * 1.2).slice(0, o.lines ?? 3);
    const h = lines.length * size * 1.22 + size * 0.3;
    const it = S.add({ x: o.x, y: o.y, z: o.z ?? 0, w, h, dof: "center", opacity: 0 });
    Object.assign(it.a.style, { borderLeft: `${Math.max(1, size * 0.22)}px solid rgba(255,255,255,.92)`, paddingLeft: size * 0.75 + "px", boxSizing: "border-box",
      fontFamily: SERIF, fontWeight: 500, fontSize: size + "px", lineHeight: size * 1.22 + "px", color: "rgba(235,235,232,.82)", whiteSpace: "nowrap", overflow: "hidden" });
    it.a.innerHTML = lines.map(l => `<div>${l.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</div>`).join("");
    return it;
  }
  /** red de líneas finas con nodos (constelación) en un plano SVG */
  function network(S, box, n, r, o = {}) {
    const u = S.u, NS = "http://www.w3.org/2000/svg";
    const it = S.add({ x: box.x + box.w / 2, y: box.y + box.h / 2, z: o.z ?? 0.3 * u, w: box.w, h: box.h, dof: "center", opacity: 0 });
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("width", box.w); svg.setAttribute("height", box.h); svg.setAttribute("viewBox", `0 0 ${box.w} ${box.h}`); svg.style.overflow = "visible";
    it.a.appendChild(svg);
    const pts = Array.from({ length: n }, () => [r() * box.w, r() * box.h]);
    /* marco rectangular fino (como las guías de la referencia) + cruces a nodos cercanos */
    const fr = { x0: box.w * (0.08 + r() * 0.1), y0: box.h * (0.08 + r() * 0.1), x1: box.w * (0.82 + r() * 0.1), y1: box.h * (0.8 + r() * 0.1) };
    const segs = [[[fr.x0, fr.y0], [fr.x1, fr.y0]], [[fr.x1, fr.y0], [fr.x1, fr.y1]], [[fr.x1, fr.y1], [fr.x0, fr.y1]], [[fr.x0, fr.y1], [fr.x0, fr.y0]]];
    pts.forEach((p, i) => { const q = pts[(i + 1 + Math.floor(r() * (n - 1))) % n]; segs.push([p, q]); });
    const lines = segs.map(([a, b]) => {
      const l = document.createElementNS(NS, "line");
      for (const [k, v] of Object.entries({ x1: a[0], y1: a[1], x2: b[0], y2: b[1], stroke: "rgba(255,255,255,.34)", "stroke-width": Math.max(0.6, 0.13 * u), pathLength: 1, "stroke-dasharray": "1 1", "stroke-dashoffset": 1 })) l.setAttribute(k, v);
      svg.appendChild(l); return l;
    });
    const dots = [...pts, [fr.x0, fr.y0], [fr.x1, fr.y0], [fr.x1, fr.y1], [fr.x0, fr.y1]].map(p => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", Math.max(1, 0.28 * u)); c.setAttribute("fill", "rgba(255,255,255,.85)"); c.setAttribute("opacity", 0);
      svg.appendChild(c); return c;
    });
    /* rayitas blancas sobre las líneas del marco */
    const ticks = Array.from({ length: 4 }, (_, i) => {
      const t = document.createElementNS(NS, "rect"), vert = r() < 0.5, along = 0.2 + r() * 0.6;
      const [a, b] = segs[i]; const px = lerp(a[0], b[0], along), py = lerp(a[1], b[1], along), L = 1.5 * u, T = 0.32 * u;
      const horiz = Math.abs(a[1] - b[1]) < 1;
      t.setAttribute("x", px - (horiz ? L : T) / 2); t.setAttribute("y", py - (horiz ? T : L) / 2); t.setAttribute("width", horiz ? L : T); t.setAttribute("height", horiz ? T : L);
      t.setAttribute("fill", "rgba(255,255,255,.95)"); t.setAttribute("opacity", 0); svg.appendChild(t); return t;
    });
    it.drawIn = q => {
      lines.forEach((l, i) => l.setAttribute("stroke-dashoffset", (1 - ease.inOut(clamp(q * 1.6 - i * 0.05))).toFixed(3)));
      dots.forEach((c, i) => c.setAttribute("opacity", clamp(q * 2 - 0.4 - i * 0.04).toFixed(2)));
      ticks.forEach((t, i) => t.setAttribute("opacity", clamp(q * 2.4 - 1 - i * 0.1).toFixed(2)));
    };
    it.drawIn(0);
    return it;
  }
  /** rayita blanca suelta (– o |) */
  function dash(S, x, y, z, vert) {
    const u = S.u, it = S.add({ x, y, z, w: vert ? 0.32 * u : 1.6 * u, h: vert ? 1.6 * u : 0.32 * u, dof: "center", opacity: 0 });
    it.a.style.background = "rgba(255,255,255,.92)";
    return it;
  }
  /** letra gigante casi invisible del fondo */
  function giant(S, ch, o) {
    const it = S.add({ x: o.x, y: o.y, z: o.z, w: o.size * 0.9, h: o.size, dof: "center", opacity: o.opacity ?? 0.06 });
    Object.assign(it.a.style, { fontFamily: SERIF, fontWeight: 400, fontSize: o.size + "px", lineHeight: o.size + "px", color: "#fff", textAlign: "center" });
    it.a.textContent = ch;
    return it;
  }

  /** trozos de la narración (para llenar los bloquecitos con texto "de archivo") */
  function snippets(ctx, r, n, len = 16) {
    const ws = ctx.words;
    if (!ws.length) return Array.from({ length: n }, () => "Archivo · documento · memoria · registro");
    return Array.from({ length: n }, () => {
      const i = Math.floor(r() * Math.max(1, ws.length - len));
      const s = ws.slice(i, i + len).map(w => w.text).join(" ");
      return s.charAt(0).toUpperCase() + s.slice(1);
    });
  }
  /** fotos disponibles (todas las del storyboard, ya cargadas) para fondos fantasma */
  function pool(ctx, not) {
    const all = [...new Set(ctx.beats.flatMap(b => Object.values(b.params || {}).filter(v => typeof v === "string" && K.loaded.has(v))))];
    const rest = all.filter(s => s !== not);
    return rest.length ? rest : all;
  }

  /**
   * Decorado común de cada plano (lo que hace que la referencia parezca "en capas"):
   * paneles oscuros pincelados, 1-2 fotos fantasma, letra gigante, bloquecitos con
   * barra, red de líneas con nodos y rayitas. box = caja del contenido en el mundo.
   */
  function decor(S, ctx, r, box, o = {}) {
    const u = S.u, P = ctx.C.palette, out = { all: [], blocks: [], dashes: [], ghosts: [], panels: [] };
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2;
    /* panel oscuro grande detrás de todo + uno medio */
    const pw = box.w * 1.35, ph = box.h * 1.3;
    out.panels.push(S.image({ x: cx + (r() - 0.5) * 8 * u, y: cy + (r() - 0.5) * 6 * u, z: -3 * u, w: pw, h: ph, dof: "center" }, brushURL(400, Math.round(400 * ph / pw), Math.floor(r() * 1e6), P.panel || "#2a2a2a", { m: 0.05, dry: 0.4 })));
    /* fotos fantasma (tenues, grandes, más atrás) */
    const ph1 = pool(ctx, o.main), ng = o.ghosts ?? 2;
    for (let i = 0; i < ng && ph1.length; i++) {
      const src = ph1[Math.floor(r() * ph1.length)], side = i % 2 ? 1 : -1, gw = box.w * (0.7 + r() * 0.3);
      const gh = gw * (0.62 + r() * 0.2);
      const g = photo(S, src, { x: cx + side * box.w * (0.55 + r() * 0.15), y: cy + (r() - 0.5) * box.h * 0.9, z: -(9 + r() * 8) * u, w: gw, h: gh,
        dof: "center", seed: Math.floor(r() * 1e5), revealed: true, dim: 0.75, opacity: 0, focus: [r(), r()], res: 1, burn: 0.6 });
      g.base = 0.22 + r() * 0.14;
      out.ghosts.push(g);
    }
    /* letra gigante */
    if (o.letter !== false) {
      const L = o.letter || "WMCAETUR"[Math.floor(r() * 8)];
      out.giant = giant(S, L, { x: cx + (r() < 0.5 ? -1 : 1) * box.w * 0.38, y: cy - box.h * 0.05, z: -6 * u, size: box.h * 0.95, opacity: 0.055 });
    }
    /* red de líneas */
    out.net = network(S, { x: box.x - box.w * 0.18, y: box.y - box.h * 0.2, w: box.w * 1.36, h: box.h * 1.4 }, 6, r, { z: 0.4 * u });
    /* bloquecitos con barra alrededor */
    const txt = snippets(ctx, r, 5);
    const slots = o.blockSlots || [[-0.62, -0.62], [0.58, -0.6], [0.6, 0.62], [-0.58, 0.6], [0.66, 0.05]];
    slots.slice(0, o.blocks ?? 4).forEach(([fx, fy], i) => {
      const b = block(S, txt[i], { x: cx + fx * box.w, y: cy + fy * box.h, z: (r() * 8 - 2) * u, w: (20 + r() * 8) * u, lines: 2 + (r() < 0.6 ? 1 : 0) });
      out.blocks.push(b);
    });
    /* rayitas sueltas */
    for (let i = 0; i < (o.dashes ?? 6); i++) out.dashes.push(dash(S, cx + (r() - 0.5) * box.w * 1.4, cy + (r() - 0.5) * box.h * 1.4, (r() * 10 - 3) * u, r() < 0.35));
    out.all = [...out.panels, ...out.ghosts, out.giant, out.net, ...out.blocks, ...out.dashes].filter(Boolean);
    /* revelado del decorado (entrada del plano) */
    out.reveal = (lt, on = true) => {
      const q = on ? 1 : 0;
      /* el decorado ya está cuando corta la cámara (sólo se desenfoca); lo que se arma es el contenido */
      out.panels.forEach(p => p.opacity = 1);
      out.ghosts.forEach(g => g.opacity = g.base);
      if (out.giant) out.giant.opacity = 0.055;
      out.net.opacity = 1; out.net.drawIn(on ? clamp(0.35 + lt / 1.2) : 1);
      out.blocks.forEach((b, i) => { const p = on ? prog(lt, 0.3 + i * 0.14, 0.45) : 1; b.opacity = p; b.blur = (1 - p) * 3 * u; });
      out.dashes.forEach((d, i) => d.opacity = on ? prog(lt, 0.4 + i * 0.07, 0.2) : 1);
      return q;
    };
    return out;
  }

  /* ---------------------------------------------------------------- cámara */
  const CAMK = ["tx", "ty", "tz", "d", "rx", "ry", "rz"];
  const camAdd = (a, b, k = 1) => { const o = { ...a }; for (const n of CAMK) o[n] = (a[n] || 0) + (b?.[n] || 0) * k; return o; };
  /**
   * Cámara de un beat con 1 o 2 planos (como la referencia: cada diapositiva se ve
   * desde un ángulo amplio y, a mitad, CORTE SECO a un ángulo cercano).
   * shots = { A:{…cam, drift:{…}}, B?:{…}, inOff:{…}, reOff:{…} }, tr = segundo del corte (0 = sin corte)
   * En cada corte: la cámara llega frenando desde un desplazamiento (expo-out) y el
   * foco "tira" desde muy cerca hasta el sujeto (rack focus, 0,15 → 1,15 s).
   */
  function camera(lt, dur, shots, tr) {
    const inB = tr > 0 && lt >= tr && shots.B;
    const sh = inB ? shots.B : shots.A, t0 = inB ? tr : 0, t1 = inB ? dur : (tr > 0 && shots.B ? tr : dur);
    const q = clamp((lt - t0) / Math.max(0.5, t1 - t0)), lt2 = lt - t0;
    let c = camAdd(sh, sh.drift, ease.sine(q) * 0.6 + q * 0.4);
    const off = inB ? shots.reOff : shots.inOff, ed = inB ? 1.5 : 2.0;
    c = camAdd(c, off, 1 - ease.expoOut(clamp(lt2 / ed)));
    /* corte a ángulo cercano: todo muy borroso ~0,15 s y enfoca en ~0,95 s (ref. 10,0 s);
       entrada de diapositiva nueva: el texto se lee antes (ref. 14,1 s), enfoque más corto */
    const fq = inB ? prog(lt2, 0.12, 0.95, "inOut") : prog(lt2, 0.04, 0.85, "inOut");
    c.focus = lerp(inB ? 0.42 : 0.56, 1, fq);
    c.fp = sh.fp || shots.fp || null;
    c.rack = (1 - prog(lt2, 0, 0.5, "out")) * 0.6 * (shots.u || 0);
    return { cam: c, inB, lt2 };
  }

  /* ---------------------------------------------------------------- familia */
  let DUST = [], BOKEH = [], GRAIN = [];
  K.family("cronica", {
    setup(ctx) {
      const CC = ctx.C.cronica || {}, r = K.rng(4242);
      DUST = Array.from({ length: CC.dust ?? 46 }, () => ({ x: r(), y: r(), s: 0.5 + r() * 1.6, v: 0.02 + r() * 0.05, a: 0.35 + r() * 0.6, ph: r() * 6.28, w: r() * 0.6 }));
      BOKEH = Array.from({ length: CC.bokeh ?? 9 }, () => ({ x: r(), y: r(), s: 2.5 + r() * 5, v: 0.006 + r() * 0.018, a: 0.05 + r() * 0.09, ph: r() * 6.28 }));
      GRAIN = Array.from({ length: 6 }, (_, k) => {
        const c = mk(192, 192), g = c.getContext("2d"), d = g.createImageData(192, 192), rr = K.rng(77 + k);
        for (let i = 0; i < d.data.length; i += 4) { const v = rr() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
        g.putImageData(d, 0, 0); return c;
      });
      return { grain: CC.grain ?? 0.07 };
    },
    frame(t, ctx) {
      const { stage, g, C } = ctx, G = g.bg;
      G.fillStyle = C.palette.bg; G.fillRect(0, 0, stage.W, stage.H);
    },
    post(t, ctx, st) {
      const { stage, g } = ctx, G = g.top, { W, H, u } = stage, fr = Math.floor(t * 24);
      /* bokeh: discos blandos que flotan */
      for (const b of BOKEH) {
        const x = ((b.x + Math.sin(t * 0.2 + b.ph) * 0.02) % 1) * W, y = (((b.y + t * b.v) % 1 + 1) % 1) * H, rad = b.s * u;
        const gr = G.createRadialGradient(x, y, 0, x, y, rad);
        gr.addColorStop(0, `rgba(255,255,255,${b.a})`); gr.addColorStop(0.7, `rgba(255,255,255,${b.a * 0.7})`); gr.addColorStop(1, "rgba(255,255,255,0)");
        G.fillStyle = gr; G.beginPath(); G.arc(x, y, rad, 0, 6.283); G.fill();
      }
      /* polvo que cae (motas finas, algunas alargadas como rayas de película) */
      G.fillStyle = "#fff";
      for (const d of DUST) {
        const x = (d.x + Math.sin(t * 0.7 + d.ph) * 0.006 * (1 + d.w)) * W, y = (((d.y + t * d.v) % 1) + 1) % 1 * H;
        G.globalAlpha = d.a * (0.65 + 0.35 * Math.sin(t * 3 + d.ph));
        const s = d.s * u * 0.18;
        G.fillRect(x, y, Math.max(1, s), Math.max(1, s * (d.w > 0.5 ? 2.6 : 1)));
      }
      /* grano de película */
      G.globalAlpha = st.grain; G.globalCompositeOperation = "overlay";
      const pat = G.createPattern(GRAIN[fr % GRAIN.length], "repeat");
      G.save(); G.translate((fr * 37) % 192, (fr * 61) % 192); G.fillStyle = pat; G.fillRect(-192, -192, W + 384, H + 384); G.restore();
      G.globalCompositeOperation = "source-over"; G.globalAlpha = 1;
      /* viñeta */
      const vg = G.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) * 0.62);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.62)");
      G.fillStyle = vg; G.fillRect(0, 0, W, H);
    },
  });

  K.cronica = { SERIF, brush, brushURL, stroke, graded, cover, Scene, para, wrap, measure, photo, yearTag, block, network, dash, giant, decor, snippets, pool, camera, camAdd };
})();

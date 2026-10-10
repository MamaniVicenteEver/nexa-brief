/* =============================================================================
   grunge · foto con el mismo lenguaje de cortes de la palabra
   La referencia casi no usa fotos: aquí la foto se trata como si fuera una letra
   más — duotono (negro cálido → color plano de la escena), texturas de tinta,
   negativos de 2–5 cuadros, golpe de zoom, erosión y, al final, la foto "pintada"
   dentro del brochazo con el título rasgado arriba.
   ========================================================================== */
(function () {
  const K = Kit, GR = Kit.grunge, { clamp, lerp } = K;
  const up = s => String(s || "").toUpperCase();
  const mk = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; };

  /** recorte → canvas en duotono c0 (sombras) → c1 (luces) con niveles automáticos y curva en S */
  function duo(im, r, w, h, c0, c1) {
    const cv = mk(w, h), g = cv.getContext("2d", { willReadFrequently: true });
    g.drawImage(im, r.sx, r.sy, r.sw, r.sh, 0, 0, cv.width, cv.height);
    const id = g.getImageData(0, 0, cv.width, cv.height), d = id.data, hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) hist[(d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8]++;
    const n = d.length / 4; let acc = 0, lo = 0, hi = 255;
    for (let l = 0; l < 256; l++) { acc += hist[l]; if (acc < n * 0.02) lo = l; if (acc < n * 0.98) hi = l; }
    const A = GR.hexRgb(c0), B = GR.hexRgb(c1), lut = new Uint8ClampedArray(768);
    for (let l = 0; l < 256; l++) { let q = clamp((l - lo) / Math.max(8, hi - lo)); q = q * q * (3 - 2 * q); for (let k = 0; k < 3; k++) lut[l * 3 + k] = lerp(A[k], B[k], q); }
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; d[i] = lut[l * 3]; d[i + 1] = lut[l * 3 + 1]; d[i + 2] = lut[l * 3 + 2]; d[i + 3] = 255; }
    g.putImageData(id, 0, 0);
    return cv;
  }
  /** recorte 'cover' de la imagen para un cuadro W×H, apuntando a focus, con zoom z */
  function cover(im, W, H, focus, z = 1) {
    const iw = im.naturalWidth || im.width, ih = im.naturalHeight || im.height, ar = W / H;
    let sw = iw, sh = iw / ar; if (sh > ih) { sh = ih; sw = ih * ar; }
    sw /= z; sh /= z;
    const sx = clamp(focus[0] * iw - sw / 2, 0, iw - sw), sy = clamp(focus[1] * ih - sh / 2, 0, ih - sh);
    return { sx, sy, sw, sh };
  }

  K.register({
    name: "grunge.photo", tags: ["foto", "lugar", "persona", "documento"], layer: "main",
    summary: "Foto real en duotono (negro cálido → color plano de la escena) con el mismo lenguaje de cortes de la palabra: primer plano 2,4× que se materializa por salpicaduras y cambia de textura en stop-motion → foto a pantalla completa con negativo volteado, golpe de zoom y erosión → la foto pintada dentro de un brochazo ancho con el título rasgado arriba y salpicaduras.",
    example: { src: "assets/media/mauerbau.jpg", title: "AGOSTO 1961", focus: [0.5, 0.45] },
    params: {
      src: { type: "image", required: true, doc: "Foto (jpg/png local)." },
      title: { type: "string", default: "", doc: "Título corto en mayúsculas (1–3 palabras) para la fase de brochazo." },
      note: { type: "string", default: "", doc: "Rótulo chico bajo el título (lugar · fecha)." },
      focus: { type: "array", default: [0.5, 0.45], doc: "Punto [x,y] 0..1 del primer plano y del recorte." },
      zoom: { type: "number", default: 2.4, min: 1.2, max: 4, doc: "Aumento del primer plano." },
      phases: { type: "enum", options: ["auto", "full", "slam+brush", "closeup+slam", "closeup+brush", "brush", "slam", "closeup"], default: "auto", doc: "Qué fases mostrar (como grunge.word)." },
      color: { type: "string", default: "auto", doc: "Color plano (auto | cream | mustard | mint | coral | petrol | pink | #hex)." },
      polarity: { type: "enum", options: ["auto", "dark", "light"], default: "auto", doc: "Fondo del brochazo: dark = color plano, light = casi negro." },
      flip: { type: "enum", options: ["auto", "none", "x", "y"], default: "auto", doc: "Espejo/volteo del negativo." },
    },
    create(ctx, p) {
      const { W, H, u, portrait } = ctx.stage, sc = GR.scene(ctx, p), im = ctx.img(p.src), d = Math.min(ctx.dpr, 1920 / W);
      const focus = Array.isArray(p.focus) ? p.focus : [0.5, 0.45];
      const blank = mk(4, 4);
      const full = im ? duo(im, cover(im, W, H, focus, 1), W * d, H * d, sc.D, sc.S) : blank;
      const close = im ? duo(im, cover(im, W, H, focus, p.zoom), W * d, H * d, sc.D, sc.S) : blank;
      if (!im) console.warn("[grunge] grunge.photo sin imagen", p.src);
      const title = up(p.title), lines = title ? title.split("\n").map(s => s.trim()).filter(Boolean) : [];

      /* ---------- A · primer plano */
      const EV = [[0, "blank"], [0.25, "r", 0], [0.37, "r", 1], [0.47, "r", 2], [0.57, "a", 0], [0.9, "b", 0], [1.17, "a", 0], [1.67, "c", 1], [1.87, "b", 0], [2.13, "a", 0], [2.4, "dx", 2], [2.67, "c", 0], [2.87, "b", 2]];
      const A = () => ({
        render(lt, len, t) {
          const f = clamp(len / 3, 0.3, 2); let ev = EV[0]; for (const e of EV) if (e[0] * f <= lt) ev = e;
          const [, v, k] = ev, g = ctx.g.main, z = 1 + 0.03 * clamp(lt / len);
          GR.fill(ctx, sc.D);
          if (v === "blank") return;
          const draw = (cv, zz, ox, a = 1) => { g.save(); g.globalAlpha = a; g.translate(W / 2 + ox, H / 2); g.scale(zz, zz); g.drawImage(cv, -W / 2, -H / 2, W, H); g.restore(); };
          if (v === "r") {           /* la foto aparece a través de motas cada vez más densas */
            const g1 = GR.S.tmp1.getContext("2d"); GR.prep(g1, ctx);
            g1.drawImage(close, 0, 0, W, H); g1.globalCompositeOperation = "destination-in"; GR.drawTex(g1, GR.S.tex.speck[k], ctx, -W * 0.2, 0, 1.3); g1.globalCompositeOperation = "source-over";
            GR.put(ctx); return;
          }
          if (v === "dx") { draw(full, z, 0); draw(close, z, 0, 0.45); }
          else if (v === "c") draw(close, z * 1.08, -W * 0.04);
          else draw(close, z, 0);
          g.save(); g.globalAlpha = v === "c" ? 0.5 : 0.4; GR.drawTex(g, GR.tint(v === "c" ? GR.S.tex.scratch : GR.S.tex.speck[2], sc.D), ctx, -W * 0.1, 0, 1.3); g.restore();
          if (v === "b") GR.fx(ctx, { neg: true, flipX: sc.light || sc.flip === "x" });
        },
      });

      /* ---------- B · foto entera */
      const fakeL = { glyphs: [], lines: [{ x: 0, w: W }], left: 0, right: W * 0.72, top: 0, bottom: H, ch: H * 0.5, fs: H };
      const B = (_c, _p, _s, _l, rnd) => {
        const eat = GR.erosion(fakeL, rnd, false);
        return {
          render(lt, len, t) {
            const f = clamp(len / 2.3, 0.35, 2), e0 = Math.max(0.62, 1.27 * f), q = clamp((lt - e0) / 0.14), tail = clamp((lt - e0 - 0.14) / Math.max(0.2, len - e0 - 0.14));
            GR.fill(ctx, sc.D);
            const g1 = GR.S.tmp1.getContext("2d"); GR.prep(g1, ctx);
            const z = 1.02 + 0.03 * clamp(lt / len);
            g1.save(); g1.translate(W / 2, H / 2); g1.scale(z, z); g1.drawImage(full, -W / 2, -H / 2, W, H); g1.restore();
            g1.globalAlpha = 0.35; GR.drawTex(g1, GR.tint(GR.S.tex.speck[1], sc.D), ctx); g1.globalAlpha = 1;
            if (q > 0) GR.sub(ctx, g1, { erode: g => eat(g, q) });
            const fr = K.rng(GR.boilFrame(t) * 17 + 3)();
            GR.put(ctx, { alpha: lt < 0.6 ? 1 : q < 1 ? 0.7 : 0.6 * (1 - tail * 0.5) * (0.8 + fr * 0.35) });
            if (lt >= 0.8 * Math.min(1, f) && lt < 0.8 * Math.min(1, f) + 0.067 && len > 1.2) GR.band(ctx, { y0: H * 0.52, y1: H * 0.8, color: sc.S, alpha: 0.8 });
            if (lt >= 0.13 && lt < 0.33 && len > 0.7) GR.fx(ctx, { neg: true, flipX: sc.flip === "x", flipY: sc.flip === "y" });
            else if (lt >= 0.33 && lt < 0.6 && len > 1.4) GR.fx(ctx, { neg: true, zoom: 1.3, zx: focus[0], zy: focus[1] });
          },
        };
      };

      /* ---------- C · la foto pintada en el brochazo + título rasgado */
      const C = (_c, _p, _s, _l, rnd) => {
        const { S, T, D, light } = sc, ink = light ? S : D, bg = light ? D : S;
        const bandC = light ? GR.mix(S, D, 0.38) : GR.mix(T, D, 0.12);
        let L = null, tb0 = 0, tb1 = 0;
        if (lines.length) {
          const maxW = W * (portrait ? 0.84 : 0.7), n = lines.length;
          let fs = Math.min(H * (portrait ? 0.075 : 0.14) / GR.CAP, GR.fitFs(lines, maxW));
          const hMax = H * (portrait ? 0.15 : 0.24); if (fs * GR.CAP * (n + 0.28 * (n - 1)) > hMax) fs = hMax / (GR.CAP * (n + 0.28 * (n - 1)));
          L = GR.layout({ lines, fs, align: "left", x: W * (portrait ? 0.08 : 0.11), cy: H * (portrait ? 0.2 : 0.2) });
          tb0 = L.top - L.ch * 0.4; tb1 = L.bottom + L.ch * 0.55;
        }
        const py0 = L ? Math.max(tb1 - H * 0.01, H * 0.28) : H * (portrait ? 0.2 : 0.12), py1 = H * (portrait ? 0.76 : 0.84);
        const spl = GR.splatSet(ctx, K.rng(Math.floor(rnd() * 1e9)), 0), sp0 = [{ x: W * 0.63, y: H * 0.56, r: u * 1.6, seed: Math.floor(rnd() * 1e9), at: 0 }];
        const look = light ? { fill: S, tex: [{ tex: GR.S.tex.scratch, color: D, alpha: 0.35 }] } : { fill: D, tex: [{ tex: GR.S.tex.scratch, color: T, alpha: 0.3 }] };
        const nfs = u * (portrait ? 2.4 : 2.1);
        return {
          render(lt, len, t) {
            const f = clamp(len / 4.7, 0.3, 1), tPh = 0.13 * f, tWord = 0.45 * f + 0.1, tSettle = tWord + 0.6 * Math.max(f, 0.6);
            const tSpl = len > 1.6 ? len - Math.min(0.75, 0.2 * len) : 1e9;
            GR.fill(ctx, bg); GR.grime(ctx, ink, light ? 0.72 : 0.9, t); GR.splats(ctx, sp0, lt, ink);
            /* brochazo-foto: la textura del brochazo hace de máscara de la foto (se pinta de izquierda a derecha) */
            if (lt >= tPh) {
              const g1 = GR.S.tmp1.getContext("2d"); GR.prep(g1, ctx);
              const wipe = clamp((lt - tPh) / 0.2 + 0.3);
              GR.band(ctx, { dest: g1, y0: py0, y1: py1, color: "#ffffff", alpha: 1, wipe, v: 0 });
              GR.band(ctx, { dest: g1, y0: py0 + (py1 - py0) * 0.1, y1: py1 - (py1 - py0) * 0.1, color: "#ffffff", alpha: 1, wipe, v: 1 });
              g1.globalCompositeOperation = "source-in";
              const z = 1.04 + 0.02 * clamp(lt / len); g1.save(); g1.translate(W / 2, (py0 + py1) / 2); g1.scale(z, z); g1.drawImage(full, -W / 2, -(py0 + py1) / 2, W, H); g1.restore();
              g1.globalCompositeOperation = "source-over";
              GR.put(ctx);
            }
            if (L && lt >= tWord - 0.1) GR.band(ctx, { y0: tb0, y1: tb1, color: bandC, alpha: 1, wipe: clamp((lt - tWord + 0.1) / 0.1 + 0.3), v: 1 });
            if (L && lt >= tWord) {
              const steps = Math.floor((lt - tWord) / 0.067), qn = clamp(steps / Math.max(1, Math.round((tSettle - tWord) / 0.067))), amt = W * 0.07 * Math.pow(1 - qn, 1.4);
              GR.ink(ctx, { L, ...look, holes: { alpha: 0.8, ox: -W * 0.1 }, fadeRight: [0.65, 0.45] });
              const r = K.rng(GR.boilFrame(t) * 31 + 7), jx = (r() - 0.5) * u * 0.18, jy = (r() - 0.5) * u * 0.18;
              GR.put(ctx, { alpha: qn < 1 ? 0.35 : 0.12, dx: jx + amt * 0.6, dy: jy + L.ch * (qn < 1 ? 0.45 * (1 - qn) + 0.1 : 0.08), slices: GR.tear(L, amt * 0.5) });
              GR.put(ctx, { dx: jx, dy: jy, slices: GR.tear(L, amt, W * 0.006) });
              if (p.note && lt >= tSettle) { const g = ctx.g.main; g.save(); g.font = `800 ${nfs}px ${GR.FONT}`; g.fillStyle = ink; g.textBaseline = "bottom"; if ("letterSpacing" in g) g.letterSpacing = nfs * 0.22 + "px"; g.fillText(up(p.note), L.left + u * 0.3, tb0 - u * 0.8); g.restore(); }
            }
            if (lt >= tSpl) GR.splats(ctx, spl.map(s => ({ ...s, at: s.at + tSpl })), lt, ink);
            if (len > 1.3 && lt >= tPh + 0.3 && lt < tPh + 0.47) GR.fx(ctx, { neg: true });
            if (len > 2.6 && lt >= 0.49 * len && lt < 0.49 * len + 0.067) GR.fx(ctx, { neg: true });
          },
        };
      };
      const seq = GR.phase.sequence(ctx, p, sc, lines, ctx.rng, { A, B, C });
      return { render: seq.render, dispose() { full.width = close.width = 0; } };
    },
  });
})();

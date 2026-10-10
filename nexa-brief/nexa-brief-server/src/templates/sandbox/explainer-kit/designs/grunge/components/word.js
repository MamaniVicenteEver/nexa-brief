/* =============================================================================
   grunge · la escena de la referencia: UNA palabra en tres fases con cortes secos
     A · primer plano  (letras gigantes, texturas que cambian en stop-motion)
     B · palabra entera (a todo el ancho, negativo volteado, golpe de zoom, erosión)
     C · brochazo       (fondo de color, palabra rasgada que se reacomoda, brochazo,
                         negativos de 2–5 cuadros, chorreones y salpicaduras)
   Los tiempos internos son los medidos en la referencia (bloque de 10 s: A 3 s,
   B 2,3 s, C 4,7 s) y se escalan a la duración del beat.
   ========================================================================== */
(function () {
  const K = Kit, GR = Kit.grunge, { clamp, lerp, prog } = K;
  const up = s => String(s || "").toUpperCase();
  const linesOf = (ctx, p) => up(ctx.stage.portrait && p.textPortrait ? p.textPortrait : p.text).split("\n").map(s => s.trim()).filter(Boolean);
  const jit = (ctx, t, amp = 0.09) => { const r = K.rng(GR.boilFrame(t) * 31 + 7), u = ctx.stage.u; return [(r() - 0.5) * u * amp * 2, (r() - 0.5) * u * amp * 2]; };

  /* ------------------------------------------------------------ A · primer plano */
  /* [segundo en la referencia, variante, encuadre]; r1..r3 = materializar por salpicaduras */
  const EV_A = [[0, "blank"], [0.25, "r", 0], [0.37, "r", 1], [0.47, "r", 2], [0.57, "a", 0], [0.9, "b", 0], [1.17, "a", 0], [1.67, "c", 1], [1.87, "b", 0], [2.13, "a", 0], [2.4, "dx", 2], [2.67, "c", 0], [2.87, "b", 2]];
  function closeup(ctx, p, sc, lines) {
    const { W, H, portrait } = ctx.stage, line = lines[0].replace(/\s+/g, " ");
    const head = line.replace(/\s/g, "").slice(0, 2) || line;
    const fs0 = Math.min(H * 1.4, W * 0.82 * 100 / Math.max(1, GR.measure(head, 100)));
    const x0 = W * 0.012;
    const L0 = GR.layout({ lines: [line], fs: fs0, align: "left", x: x0, cy: H / 2 });
    const k2 = Math.min(2, Math.max(0, L0.glyphs.length - 2));
    const shift2 = L0.glyphs[k2] ? L0.glyphs[k2].x - L0.glyphs[0].x : 0;
    const crop = (c, z) => GR.layout({ lines: [line], fs: fs0 * (c === 1 ? 1.07 : 1) * z, align: "left", x: c === 2 ? x0 - shift2 * z : c === 1 ? x0 - W * 0.05 : x0, cy: H / 2 + (c === 1 ? H * 0.02 : 0) });
    const { S, T, D, light } = sc, tsc = 1.3;
    const looks = light ? {
      bg: S, rc: D,
      a: { fill: GR.mix(S, "#ffffff", 0.07), tex: [{ tex: GR.S.tex.speck[2], color: D, alpha: 0.92, sc: tsc, ox: -W * 0.3 }] },
      c: { fill: GR.mix(S, D, 0.5), tex: [{ tex: GR.S.tex.scratch, color: S, alpha: 0.7, sc: 1.6 }] },
    } : {
      bg: D, rc: S,
      a: { fill: GR.mix(T, D, 0.4), tex: [{ tex: GR.S.tex.speck[2], color: S, alpha: 0.95, sc: tsc, ox: -W * 0.3 }] },
      c: { fill: S, tex: [{ tex: GR.S.tex.scratch, color: D, alpha: 0.82, sc: 1.6, ox: -W * 0.2 }] },
    };
    return {
      render(lt, len, t) {
        const f = clamp(len / 3, 0.3, 2);
        let ev = EV_A[0]; for (const e of EV_A) if (e[0] * f <= lt) ev = e;
        const [, v, c] = ev, z = 1 + 0.025 * clamp(lt / len);
        GR.fill(ctx, looks.bg);
        if (v === "blank") return;
        const holes = { alpha: 0.9, sc: 2, ox: -W * 0.4 };
        if (v === "r") { GR.ink(ctx, { L: crop(0, z), fill: { tex: GR.S.tex.speck[c], color: looks.rc, sc: tsc, ox: -W * 0.3 } }); GR.put(ctx); return; }
        if (v === "dx") {
          GR.ink(ctx, { L: crop(2, z), ...looks.a, holes }); GR.put(ctx);
          GR.ink(ctx, { L: crop(0, z), ...looks.a, holes }); GR.put(ctx, { alpha: 0.42 });
          return;
        }
        const look = v === "c" ? looks.c : looks.a;
        GR.ink(ctx, { L: crop(c, z), ...look, holes: v === "c" ? { alpha: 0.7, sc: 1.6 } : holes }); GR.put(ctx);
        /* "b" = el negativo de "a" (en las palabras de color primero, además espejado) */
        if (v === "b") GR.fx(ctx, { neg: true, flipX: light || sc.flip === "x" });
      },
    };
  }

  /* ------------------------------------------------------------ B · palabra entera */
  function slam(ctx, p, sc, lines, rnd) {
    const { W, H, portrait } = ctx.stage, { S, T, D, light } = sc;
    const capMax = portrait ? 0.3 : 0.5;
    let fs = Math.min(GR.fitFs(lines, W * 1.03), H * capMax / GR.CAP);
    const n = lines.length; if (fs * GR.CAP * (n + 0.12 * (n - 1)) > H * 0.82) fs = H * 0.82 / (GR.CAP * (n + 0.12 * (n - 1)));
    const L = GR.layout({ lines, fs, align: "center", x: W / 2, cy: H / 2, gap: 0.12 });
    const sp = GR.S.tex.speck[2], scr = GR.S.tex.scratch;
    const letters = light ? [
      { fill: GR.mix(S, D, 0.5), tex: [{ tex: scr, color: D, alpha: 0.6 }] },
      { fill: GR.mix(S, D, 0.36), tex: [{ tex: sp, color: D, alpha: 0.7, sc: 1.3 }] },
      { fill: GR.mix(T, D, 0.2), tex: [{ tex: scr, color: S, alpha: 0.5, ox: -W * 0.1 }] },
    ] : [
      { fill: S, tex: [{ tex: scr, color: D, alpha: 0.85 }] },
      { fill: GR.mix(T, S, 0.35), tex: [{ tex: sp, color: D, alpha: 0.75, sc: 1.4 }] },
      { fill: GR.mix(S, D, 0.2), tex: [{ tex: scr, color: D, alpha: 0.6, ox: -W * 0.15 }, { tex: sp, color: S, alpha: 0.35 }] },
      { fill: GR.mix(T, D, 0.05), tex: [{ tex: scr, color: S, alpha: 0.55, ox: -W * 0.3 }] },
    ];
    /* rotar el orden de los estilos según la palabra (no todas iguales) */
    const off = Math.floor(rnd() * letters.length), lk = letters.map((_, i) => letters[(i + off) % letters.length]);
    const eat = GR.erosion(L, rnd, true);
    return {
      L,
      render(lt, len, t) {
        const f = clamp(len / 2.3, 0.35, 2), e0 = Math.max(0.62, 1.27 * f), q = clamp((lt - e0) / 0.14);
        GR.fill(ctx, light ? S : D);
        const tail = clamp((lt - e0 - 0.14) / Math.max(0.2, len - e0 - 0.14));
        const fr = K.rng(GR.boilFrame(t) * 17 + 3)();
        GR.ink(ctx, { L, letters: lk, holes: { alpha: 0.85 }, erode: q > 0 ? g => eat(g, q) : null });
        const [jx, jy] = jit(ctx, t);
        const dim = lt < 0.6 ? 1 : q < 1 ? 0.6 : 0.55 * (1 - tail * 0.55) * (0.8 + fr * 0.35);
        GR.put(ctx, { alpha: dim, dx: jx, dy: jy });
        /* cuadro suelto con brochazo claro sobre la mitad baja (ref +0,8 s) */
        if (lt >= 0.8 * Math.min(1, f) + 0.0 && lt < 0.8 * Math.min(1, f) + 0.067 && len > 1.2)
          GR.band(ctx, { y0: L.top + L.ch * 0.55, y1: L.bottom + L.ch * 0.25, color: light ? D : S, alpha: 0.85 });
        /* negativo volteado y golpe de zoom (ref +0,13–0,6 s) */
        if (lt >= 0.13 && lt < 0.33 && len > 0.7) GR.fx(ctx, { neg: true, flipX: sc.flip === "x", flipY: sc.flip === "y" });
        else if (lt >= 0.33 && lt < 0.6 && len > 1.4) GR.fx(ctx, { neg: true, zoom: 1.3, zx: 0.42, zy: 0.45 });
      },
    };
  }

  /* ------------------------------------------------------------ C · brochazo */
  function brush(ctx, p, sc, lines, rnd) {
    const { W, H, u, portrait } = ctx.stage, { S, T, D, light } = sc, size = p.size ?? 1;
    const maxW = W * (portrait ? 0.84 : 0.76), n = lines.length;
    let fs = Math.min(H * (portrait ? 0.13 : 0.23) * size / GR.CAP, GR.fitFs(lines, maxW));
    const hMax = H * (portrait ? 0.3 : 0.42); if (fs * GR.CAP * (n + 0.28 * (n - 1)) > hMax) fs = hMax / (GR.CAP * (n + 0.28 * (n - 1)));
    const x = W * (portrait ? 0.08 : 0.11), cy = H * (portrait ? 0.46 : 0.5);
    const L = GR.layout({ lines, fs, align: "left", x, cy });
    const ch = L.ch, by0 = L.top - ch * 0.32, by1 = L.bottom + ch * 0.8;
    const ink = light ? S : D, bg = light ? D : S, bandC = light ? GR.mix(S, D, 0.38) : GR.mix(T, D, 0.12);
    const look = light ? { fill: S, tex: [{ tex: GR.S.tex.scratch, color: D, alpha: 0.35 }] } : { fill: D, tex: [{ tex: GR.S.tex.scratch, color: T, alpha: 0.3 }] };
    const sp0 = [{ x: W * 0.63, y: H * (portrait ? 0.6 : 0.56), r: u * 1.6, seed: Math.floor(rnd() * 1e9), at: 0 }];
    const drips = Array.from({ length: 7 }, () => ({ x: W * (0.12 + rnd() * 0.5), y: H * rnd() * 0.15, w: u * (0.25 + rnd() * 0.6), h: H * (0.08 + rnd() * 0.25) }));
    const spl = GR.splatSet(ctx, K.rng(Math.floor(rnd() * 1e9)), 0);
    let note = p.note ? up(p.note) : "";
    const nfs = u * (portrait ? 2.6 : 2.3);
    return {
      L,
      render(lt, len, t) {
        const f = clamp(len / 4.7, 0.3, 1);
        const tWord = 0.2 * f, tSettle = tWord + 0.63 * Math.max(f, 0.6);
        const tBand = len > 2.2 ? Math.min(1.4, 0.3 * len) : Math.max(tSettle, 0.5 * len);
        const tSpl = len > 1.6 ? len - Math.min(0.75, 0.2 * len) : 1e9;
        GR.fill(ctx, bg);
        GR.grime(ctx, ink, light ? 0.72 : 0.9, t);
        GR.splats(ctx, sp0, lt, ink);
        /* mancha de rodillo antes de la palabra; después, el brochazo ancho */
        if (lt >= 0.13 * f && lt < tBand) GR.band(ctx, { y0: L.top + ch * 0.5, y1: L.top + ch * 1.05, color: bandC, alpha: 0.85, wipe: lt < tWord ? 0.66 : 1, v: 1 });
        if (lt >= tBand) GR.band(ctx, { y0: by0, y1: by1, color: bandC, alpha: 1, wipe: clamp((lt - tBand) / 0.1 + 0.34), v: lt > 0.72 * len && len > 3 ? 1 : 0 });
        if (lt >= tWord) {
          const steps = Math.floor((lt - tWord) / 0.067), qn = clamp(steps / Math.max(1, Math.round((tSettle - tWord) / 0.067)));
          const amt = W * 0.085 * Math.pow(1 - qn, 1.4);
          GR.ink(ctx, { L, ...look, holes: { alpha: 0.85, ox: -W * 0.1 }, fadeRight: [0.6, 0.55] });
          const [jx, jy] = jit(ctx, t);
          /* fantasma: la misma palabra por debajo (doble impresión), fuerte al entrar y tenue después */
          GR.put(ctx, { alpha: qn < 1 ? 0.38 : 0.13, dx: jx + amt * 0.6 + ch * 0.03, dy: jy + ch * (qn < 1 ? 0.5 * (1 - qn) + 0.1 : 0.08), slices: GR.tear(L, amt * 0.5) });
          GR.put(ctx, { alpha: 1, dx: jx, dy: jy, slices: GR.tear(L, amt, W * 0.008) });
        }
        if (note && lt >= tBand) {
          const g = ctx.g.main, fl = lt < tBand + 0.13 && Math.floor((lt - tBand) / 0.033) % 2 === 0;
          if (!fl) { g.save(); g.font = `800 ${nfs}px ${GR.FONT}`; g.fillStyle = ink; g.textBaseline = "top"; if ("letterSpacing" in g) g.letterSpacing = nfs * 0.22 + "px"; g.fillText(note, L.left + u * 0.3, by1 + u * 2.2); g.restore(); }
        }
        /* chorreones verticales (2 cuadros) */
        if (len > 3 && lt >= 0.7 * len && lt < 0.7 * len + 0.067) { const g = ctx.g.main; g.fillStyle = ink; for (const d of drips) g.fillRect(d.x, d.y, d.w, d.h); }
        if (lt >= tSpl) GR.splats(ctx, spl.map(s => ({ ...s, at: s.at + tSpl })), lt, ink);
        /* negativos: el largo al asentarse la palabra (5 cuadros) y uno corto a mitad */
        if (len > 1.3 && lt >= tWord + 0.18 && lt < tWord + 0.35) GR.fx(ctx, { neg: true });
        if (len > 2.6 && lt >= 0.49 * len && lt < 0.49 * len + 0.067) GR.fx(ctx, { neg: true });
      },
    };
  }

  /* ------------------------------------------------------------ reparto de fases */
  function plan(mode, D) {
    if (mode === "auto") mode = D >= 4.2 ? "full" : D >= 2.4 ? "slam+brush" : "brush";
    const m = { full: ["A", "B", "C"], "slam+brush": ["B", "C"], "closeup+slam": ["A", "B"], "closeup+brush": ["A", "C"], brush: ["C"], slam: ["B"], closeup: ["A"] }[mode] || ["C"];
    /* proporción de la referencia (3 : 2,3 : 4,7) en planos de ≥10 s; en planos narrados más cortos
       el brochazo (donde se lee la palabra y el rótulo) se queda con más tiempo */
    const k = clamp((D - 4.2) / 5.8);
    const want = { A: clamp(lerp(0.22, 0.3, k) * D, 0.9, 3), B: clamp(lerp(0.2, 0.23, k) * D, 0.8, 2.3) };
    if (m.length === 2 && !m.includes("C")) { want.A = D * 0.55; want.B = D * 0.45; }
    if (m.length === 2 && m[0] === "B") want.B = clamp(0.35 * D, 0.8, 1.6);
    if (m.length === 2 && m[0] === "A" && m[1] === "C") want.A = clamp(0.35 * D, 0.8, 2);
    const out = []; let t = 0;
    m.forEach((ph, i) => { const d = i === m.length - 1 ? Math.max(0.3, D - t) : Math.min(want[ph], D * 0.6); out.push({ ph, t0: t, d }); t += d; });
    return out;
  }
  /** escena completa (la usan word, photo y outro) */
  function sequence(ctx, p, sc, lines, rnd, builders) {
    const parts = { A: null, B: null, C: null };
    /* semillas fijadas al crear: el resultado no depende del orden en que se busquen los cuadros */
    const seeds = { A: Math.floor(rnd() * 1e9), B: Math.floor(rnd() * 1e9), C: Math.floor(rnd() * 1e9) };
    return {
      render(lt, b, t) {
        const D = b.dur, ph = plan(p.phases || "auto", D);
        let cur = ph[0]; for (const x of ph) if (lt >= x.t0) cur = x;
        GR.current(ctx, sc);
        const mkr = builders[cur.ph];
        parts[cur.ph] ||= mkr(ctx, p, sc, lines, K.rng(seeds[cur.ph]));
        parts[cur.ph].render(Math.min(lt - cur.t0, cur.d + 0.5), cur.d, t);
      },
    };
  }
  GR.phase = { closeup, slam, brush, plan, sequence, linesOf };

  const COMMON = {
    color: { type: "string", default: "auto", doc: "Color plano de la escena: auto (rota crema→mostaza→menta→coral→petróleo→rosa como la referencia) | cream | mustard | mint | coral | petrol | pink | #hex." },
    polarity: { type: "enum", options: ["auto", "dark", "light"], default: "auto", doc: "dark = primer plano y palabra sobre casi negro, brochazo sobre color; light = al revés. auto alterna D, D, L." },
    flip: { type: "enum", options: ["auto", "none", "x", "y"], default: "auto", doc: "Espejo (x) o volteo (y) del negativo de la palabra entera." },
  };

  K.register({
    name: "grunge.word", tags: ["título", "palabra", "impacto", "concepto", "fecha", "número"], layer: "main",
    summary: "LA escena del estilo: una palabra en tres cortes — primer plano gigante de sus primeras letras con texturas stop-motion → la palabra a todo el ancho (negativo volteado, golpe de zoom, se erosiona de izquierda a derecha) → fondo de color plano con suciedad de película, la palabra entra rasgada y se reacomoda, brochazo detrás, negativos y salpicaduras. Las fases se reparten solas según la duración del beat.",
    example: { text: "MURO", note: "BERLÍN · 1961" },
    params: {
      text: { type: "string", required: true, doc: "Palabra o palabras cortas en mayúsculas ('\\n' parte renglones; ideal 1 palabra de 3–9 letras)." },
      textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16." },
      note: { type: "string", default: "", doc: "Rótulo chico (Montserrat 800, espaciado) bajo el brochazo: lugar · fecha · dato. La referencia no lo tiene: dejar vacío para el look puro." },
      phases: { type: "enum", options: ["auto", "full", "slam+brush", "closeup+slam", "closeup+brush", "brush", "slam", "closeup"], default: "auto", doc: "Qué fases mostrar. auto: ≥4,2 s las tres; ≥2,4 s palabra+brochazo; si no, solo brochazo." },
      size: { type: "number", default: 1, min: 0.5, max: 1.3, doc: "Escala de la palabra en el brochazo." },
      ...COMMON,
    },
    create(ctx, p) {
      const sc = GR.scene(ctx, p), lines = linesOf(ctx, p);
      return sequence(ctx, p, sc, lines, ctx.rng, { A: closeup, B: slam, C: brush });
    },
  });

  /* título de apertura / cierre: la misma escena completa, con las tres fases siempre */
  K.register({
    name: "grunge.title", tags: ["intro", "gancho", "título", "cierre"], layer: "main",
    summary: "Título de apertura (o frase final): la escena completa de la referencia con sus tres fases siempre — primer plano gigante, palabra a todo el ancho con negativo y erosión, brochazo con rótulo chico. Admite 2–4 renglones cortos.",
    example: { text: "9 NOV\n1989", note: "LA NOCHE QUE CAYÓ EL MURO" },
    params: {
      text: { type: "string", required: true, doc: "Título ('\\n' parte renglones)." },
      textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16." },
      note: { type: "string", default: "", doc: "Rótulo chico bajo el brochazo (antetítulo / fecha)." },
      phases: { type: "enum", options: ["full", "slam+brush", "closeup+brush"], default: "full", doc: "Fases (por defecto las tres)." },
      size: { type: "number", default: 1, min: 0.5, max: 1.3, doc: "Escala de la palabra en el brochazo." },
      ...COMMON,
    },
    create(ctx, p) {
      const sc = GR.scene(ctx, p), lines = linesOf(ctx, p);
      return sequence(ctx, p, sc, lines, ctx.rng, { A: closeup, B: slam, C: brush });
    },
  });

  /* fases sueltas, para armar ritmos propios en el storyboard */
  const single = (name, ph, summary, tags) => K.register({
    name, tags, layer: "main", summary,
    example: { text: "HORMIGÓN" },
    params: { text: { type: "string", required: true, doc: "Texto ('\\n' parte renglones)." }, textPortrait: { type: "string", default: "", doc: "Cortes alternativos para 9:16." },
      ...(ph === "C" ? { note: { type: "string", default: "", doc: "Rótulo chico bajo el brochazo." }, size: { type: "number", default: 1, min: 0.5, max: 1.3, doc: "Escala de la palabra." } } : {}), ...COMMON },
    create(ctx, p) {
      const sc = GR.scene(ctx, p), lines = linesOf(ctx, p), mkr = { A: closeup, B: slam, C: brush }[ph];
      let part = null;
      return { render(lt, b, t) { GR.current(ctx, sc); part ||= mkr(ctx, p, sc, lines, ctx.rng); part.render(lt, b.dur, t); } };
    },
  });
  single("grunge.closeup", "A", "Solo la fase A: primer plano GIGANTE de las primeras letras, que se materializan por salpicaduras y cambian de textura en stop-motion (negativo, rayado, doble exposición hacia las letras siguientes).", ["intro", "tensión", "palabra"]);
  single("grunge.slam", "B", "Solo la fase B: la palabra a todo el ancho sobre fondo plano, negativo volteado, golpe de zoom 1,3× y erosión de izquierda a derecha que deja la última letra.", ["impacto", "palabra", "golpe"]);
  single("grunge.brush", "C", "Solo la fase C: fondo de color con suciedad de película; la palabra entra rasgada en franjas que se reacomodan, brochazo ancho detrás, negativos cortos y salpicaduras al final.", ["palabra", "concepto", "dato"]);

  /* golpe de negativo sobre lo que haya en pantalla */
  K.register({
    name: "grunge.flip", tags: ["transición", "golpe", "negativo"], layer: "overlay", post: 0,
    summary: "Golpe de negativo de 2–5 cuadros sobre el plano actual (fondo ↔ tinta), opcionalmente espejado/volteado o con zoom 1,3× — el 'flash' de esta familia. Usar con 'dur' 0.1–0.45.",
    example: { mode: "negy", zoom: 1 },
    params: {
      mode: { type: "enum", options: ["neg", "negx", "negy", "zoom"], default: "neg", doc: "neg = negativo; negx = negativo espejado; negy = negativo volteado; zoom = solo golpe de zoom." },
      zoom: { type: "number", default: 1, min: 1, max: 1.6, doc: "Golpe de zoom durante el negativo." },
    },
    create() { return { render() {} }; },
  });
})();

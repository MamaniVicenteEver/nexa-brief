/* =============================================================================
   cronica · escenas: título, diapositiva con año, cita en itálica, frase narrada
   (todas arman su mundo 3D con Kit.cronica.Scene y cortan en seco: post = 0)
   ========================================================================== */
(function () {
  const K = Kit, CR = Kit.cronica, { clamp, lerp, prog, ease } = K;
  const imgAR = (ctx, src, def = 1.45) => { const im = K.loaded.get(src); return im ? clamp(im.width / im.height, 0.62, 1.9) : def; };
  const autoTr = (ctx, b, p) => {
    const lim = ctx.C.cronica?.autoReframe ?? 6.2;
    if (p.reframe < 0) return 0;
    if (p.reframe > 0) return p.reframe < b.dur - 0.8 ? p.reframe : 0;
    return b.dur >= lim ? b.dur * 0.5 : 0;
  };
  const mir = (c, m) => m ? { ...c, ry: -(c.ry || 0), rz: -(c.rz || 0), tx: c.tx, drift: c.drift ? { ...c.drift, ry: -(c.drift.ry || 0), rz: -(c.drift.rz || 0) } : null } : c;

  /* ================================================================ slide */
  K.register({
    name: "cronica.slide", tags: ["foto", "fecha", "año", "dato", "historia", "lugar", "persona"], layer: "main", post: 0,
    summary: "Diapositiva de archivo en 3D (la escena principal de la referencia): foto B/N con borde de pincel rasgado que se pinta a trazos, año o dato corto en un rótulo gris pincelado y párrafo serif blanco, rodeados de capas tenues (fotos fantasma, letra gigante, bloquecitos con barra, líneas con nodos). La cámara la mira en perspectiva oblicua con profundidad de campo; si el beat es largo, CORTA a un ángulo cercano a mitad (rack focus).",
    example: { src: "assets/media/leipzig.jpg", year: "1989", text: "Cada lunes, cientos de miles marchaban por las calles pidiendo libertad para viajar.", layout: "right" },
    params: {
      src: { type: "image", required: true, doc: "Foto (jpg/png local). Se muestra B/N contrastada. Se puede repetir en varios beats cambiando focus/zoom/layout." },
      year: { type: "string", default: "", doc: "Año, fecha o dato corto del rótulo gris ('1961', '9 NOV', '28 AÑOS'). Vacío = sin rótulo." },
      text: { type: "string", default: "", doc: "Párrafo serif (1-4 renglones; ~10-30 palabras)." },
      layout: { type: "enum", options: ["right", "left", "top", "center", "split"], default: "right", doc: "right = foto izq/texto der · left = texto izq/foto der · top = foto arriba/texto abajo · center = foto al centro con texto abajo a la izquierda encima · split = foto grande tapada a la derecha por un panel oscuro con el texto. En 9:16 siempre apila (foto arriba)." },
      italic: { type: "bool", default: false, doc: "Año y párrafo en itálica." },
      align: { type: "enum", options: ["left", "justify"], default: "left", doc: "Alineación del párrafo." },
      focus: { type: "array", default: [0.5, 0.45], doc: "Punto [x,y] 0..1 de la foto que queda dentro del recorte." },
      zoom: { type: "number", default: 1, min: 1, max: 3, doc: "Zoom del recorte (para reutilizar una foto con otro encuadre)." },
      mirror: { type: "bool", default: false, doc: "Espeja los ángulos de cámara (variedad entre beats seguidos)." },
      reframe: { type: "number", default: 0, doc: "Segundo del corte a plano cercano (0 = automático si el beat dura ≥ cronica.autoReframe; -1 = nunca; '@palabra' = cuando la voz la dice)." },
      letter: { type: "string", default: "", doc: "Letra gigante tenue del fondo (vacío = una al azar)." },
    },
    create(ctx, p) {
      const st = ctx.stage, { u, portrait } = st, r = ctx.rng, S = CR.Scene(ctx), b0 = ctx.beat;
      const ar = imgAR(ctx, p.src), lay = portrait ? "stack" : p.layout;
      const ys = portrait ? 6.8 * u : 6.2 * u, ts = portrait ? 4.2 * u : 3.6 * u;
      let ph, tx0, tw, yy, align = p.align;
      /* ------------- maquetación (en u, centro del plano = 0,0) */
      if (lay === "right" || lay === "left") {
        const s = lay === "right" ? 1 : -1, w = 78 * u, h = clamp(78 / ar, 42, 56) * u;
        ph = { x: -s * 30 * u, y: 0, w, h };
        tw = 50 * u; tx0 = s > 0 ? 12 * u : -62 * u;
      } else if (lay === "top") {
        const w = 84 * u, h = clamp(84 / ar, 36, 48) * u;
        ph = { x: 0, y: -14 * u - (h - 42 * u) / 2, w, h };
        tw = 70 * u; tx0 = -40 * u;
      } else if (lay === "center") {
        const w = 92 * u, h = clamp(92 / ar, 44, 52) * u;
        ph = { x: 6 * u, y: -15 * u, w, h };
        tw = 64 * u; tx0 = -46 * u;
      } else if (lay === "split") {
        const w = 112 * u, h = clamp(112 / ar, 60, 72) * u;
        ph = { x: -20 * u, y: 0, w, h };
        tw = 44 * u; tx0 = 12 * u;
      } else {                          /* stack 9:16 */
        const w = 84 * u, h = clamp(84 / ar, 50, 64) * u;
        ph = { x: 0, y: -24 * u - (h - 58 * u) / 2, w, h };
        tw = 72 * u; tx0 = -36 * u;
      }
      const lines = p.text ? CR.wrap(p.text, ts, 600, p.italic, tw) : [];
      const paraH = lines.length * ts * 1.18, tagH = p.year ? ys * 1.42 + 1.6 * u : 0;
      if (lay === "right" || lay === "left" || lay === "split") yy = -(tagH + paraH) / 2;
      else if (lay === "top") yy = ph.y + ph.h / 2 + 3.5 * u;
      else if (lay === "center") yy = ph.y + ph.h / 2 - 5 * u;
      else yy = ph.y + ph.h / 2 + 5 * u;
      const box = { x: Math.min(ph.x - ph.w / 2, tx0), y: Math.min(ph.y - ph.h / 2, yy), w: 0, h: 0 };
      box.w = Math.max(ph.x + ph.w / 2, tx0 + tw) - box.x; box.h = Math.max(ph.y + ph.h / 2, yy + tagH + paraH) - box.y;

      /* ------------- capas */
      const dec = CR.decor(S, ctx, r, box, { main: p.src, letter: p.letter || undefined, ghosts: 2 });
      const photo = CR.photo(S, p.src, { ...ph, z: 0, seed: Math.floor(r() * 1e5), focus: p.focus, zoom: p.zoom });
      let back = null;
      if (lay === "split") {           /* panel oscuro que tapa la mitad derecha de la foto */
        const pw = 64 * u, phh = ph.h * 1.12;
        back = S.image({ x: tx0 + tw / 2, y: 0, z: 0.6 * u, w: pw, h: phh, dof: "grad", opacity: 0 }, CR.brushURL(360, Math.round(360 * phh / pw), Math.floor(r() * 1e5), "rgba(22,22,22,.88)", { m: 0.04, dry: 0.6 }));
      } else if (p.text || p.year) {   /* rótulo grande gris detrás del texto */
        const pw = tw + 12 * u, phh = tagH + paraH + 9 * u;
        const col = lay === "center" || lay === "stack" ? "rgba(26,26,26,.78)" : "rgba(64,64,64,.62)";
        back = S.image({ x: tx0 + tw / 2 + (lay === "right" ? 2 * u : 0), y: yy + (tagH + paraH) / 2, z: -0.8 * u, w: pw, h: phh, dof: "center", opacity: 0 }, CR.brushURL(360, Math.round(360 * phh / pw), Math.floor(r() * 1e5), col, { m: 0.06, dry: 0.7 }));
      }
      const zt = lay === "split" ? 1.2 * u : 0.6 * u;
      const tag = p.year ? CR.yearTag(S, p.year, { x: lay === "center" || lay === "stack" || lay === "top" ? tx0 : tx0 - 0.8 * u, y: yy + ys * 0.71, z: zt, size: ys, italic: p.italic, fade: lay === "right", seed: Math.floor(r() * 1e5) }) : null;
      const txt = lines.length ? CR.para(S, p.text, { x0: tx0, y0: yy + tagH, w: tw, size: ts, italic: p.italic, align, z: zt }) : [];

      /* ------------- cámara */
      const T0 = { x: tx0 + tw / 2, y: yy + (tagH + paraH) / 2 }, mid = (ph.x + T0.x) / 2;
      const sg = p.mirror ? -1 : 1;
      const SH = {
        right: { A: { tx: lerp(ph.x, T0.x, 0.45), ty: 0, d: 0.86, rx: 40, ry: -12, rz: -10, drift: { d: -0.06, ry: 3, rz: 1.5, tx: 2 * u } },
                 B: { tx: T0.x - 4 * u, ty: T0.y - 2 * u, d: 0.54, rx: 14, ry: 26, rz: -8, drift: { d: -0.05, ry: -3, tx: -2 * u } } },
        left: { A: { tx: mid, ty: 0, d: 0.86, rx: 30, ry: 20, rz: -9, drift: { d: -0.06, ry: -3, rz: 1 } },
                B: { tx: T0.x + 2 * u, ty: T0.y, d: 0.55, rx: 10, ry: -24, rz: -6, drift: { d: -0.05, ry: 3 } } },
        top: { A: { tx: 0, ty: -2 * u, d: 0.88, rx: 26, ry: 16, rz: 10, drift: { d: -0.06, rz: -1.5, ry: -2 } },
               B: { tx: -8 * u, ty: T0.y - 8 * u, d: 0.66, rx: 30, ry: -14, rz: 9, drift: { d: -0.05, ry: 2 } } },
        center: { A: { tx: 0, ty: 3 * u, d: 0.88, rx: 12, ry: -10, rz: -5, drift: { d: -0.08, ry: 2 } },
                  B: { tx: tx0 + 18 * u, ty: T0.y - 4 * u, d: 0.54, rx: 18, ry: 18, rz: -4, drift: { d: -0.04, ry: -2 } } },
        split: { A: { tx: 8 * u, ty: 0, d: 0.84, rx: 8, ry: -20, rz: -3, drift: { d: -0.06, tx: 4 * u } },
                 B: { tx: T0.x, ty: T0.y - 3 * u, d: 0.55, rx: 8, ry: -24, rz: -4, drift: { d: -0.04, ry: 2 } } },
        stack: { A: { tx: 0, ty: -4 * u, d: 0.96, rx: 24, ry: -7, rz: -5, drift: { d: -0.06, ry: 2 } },
                 B: { tx: 0, ty: T0.y - 2 * u, d: 0.72, rx: 18, ry: 10, rz: 4, drift: { d: -0.05, ry: -2 } } },
      }[lay];
      const shots = { A: mir(SH.A, p.mirror), B: mir(SH.B, p.mirror), u, fp: [T0.x, T0.y, 0.6 * u],
        inOff: { tx: (portrait ? 8 : 16) * u * sg, ty: 6 * u, d: 0.28, rz: -5 * sg, ry: (portrait ? 5 : 8) * sg }, reOff: { d: 0.08, tx: 3 * u * sg, ry: 2 * sg } };
      const tr = autoTr(ctx, b0, p);

      return {
        render(lt, b) {
          const { cam } = CR.camera(lt, b.dur, shots, tr);
          const L = lt;                                       /* el armado sólo ocurre en la entrada */
          dec.reveal(L);
          if (back) back.opacity = prog(L, 0.2, 0.5);
          photo.draw(prog(L, 0.7, 0.95, "linear"));
          if (tag) {
            const q = prog(L, 0.55, 0.45, "inOut");
            tag.sw.opacity = q > 0 ? 1 : 0; tag.sw.a.style.clipPath = `inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)`;
            const qt = prog(L, 0.78, 0.5); tag.tx.opacity = qt; tag.tx.blur = (1 - qt) * 3 * u;
          }
          txt.forEach((it, i) => { const q = prog(L, 0.15 + i * 0.09, 0.5); it.opacity = q; it.blur = (1 - q) * 3 * u; });
          S.render(cam);
        },
        dispose() { S.dispose(); },
      };
    },
  });

  /* ================================================================ quote */
  K.register({
    name: "cronica.quote", tags: ["cita", "frase", "persona", "testimonio", "fecha"], layer: "main", post: 0,
    summary: "Cita en itálica (la escena '1942' de la referencia): año en itálica en su rótulo, párrafo itálico justificado al centro, un retrato grande y tenue a la izquierda (más cerca de cámara, desenfocado) y otra foto rasgada a la derecha. Cámara oblicua con corte a plano cercano si es largo.",
    example: { side: "assets/media/schabowski.jpg", src: "assets/media/bornholmer.jpg", year: "1989", text: "Nadie le advirtió que debía esperar hasta la mañana." },
    params: {
      src: { type: "image", required: true, doc: "Foto de la derecha (rasgada)." },
      side: { type: "image", default: "", doc: "Retrato grande y tenue de la izquierda (vacío = la misma foto con otro encuadre)." },
      year: { type: "string", default: "", doc: "Año / dato del rótulo (en itálica)." },
      text: { type: "string", required: true, doc: "La cita (10-35 palabras)." },
      focus: { type: "array", default: [0.5, 0.45], doc: "Encuadre de la foto derecha." },
      sideFocus: { type: "array", default: [0.35, 0.3], doc: "Encuadre del retrato izquierdo." },
      mirror: { type: "bool", default: false, doc: "Espeja los ángulos de cámara." },
      reframe: { type: "number", default: 0, doc: "Segundo del corte a plano cercano (0 = auto, -1 = nunca)." },
    },
    create(ctx, p) {
      const { u, portrait } = ctx.stage, r = ctx.rng, S = CR.Scene(ctx), b0 = ctx.beat;
      const ys = portrait ? 6.8 * u : 6 * u, ts = portrait ? 4.3 * u : 3.8 * u, tw = portrait ? 78 * u : 62 * u, tx0 = -tw / 2;
      const lines = CR.wrap(p.text, ts, 600, true, tw), paraH = lines.length * ts * 1.2, tagH = p.year ? ys * 1.42 + 1.8 * u : 0;
      const y0 = -(tagH + paraH) / 2 - (portrait ? 0 : 2 * u);
      const sideSrc = p.side || p.src;
      const L = portrait
        ? { side: { x: -16 * u, y: -46 * u, w: 80 * u, h: 62 * u }, right: { x: 14 * u, y: 46 * u, w: 78 * u, h: 56 * u } }
        : { side: { x: -60 * u, y: -6 * u, w: 66 * u, h: 82 * u }, right: { x: 60 * u, y: 8 * u, w: 58 * u, h: 72 * u } };
      const box = portrait ? { x: -50 * u, y: -78 * u, w: 100 * u, h: 156 * u } : { x: -88 * u, y: -48 * u, w: 176 * u, h: 96 * u };
      const dec = CR.decor(S, ctx, r, box, { main: p.src, ghosts: 1, blocks: 3, blockSlots: [[-0.32, 0.42], [0.3, -0.44], [-0.36, -0.46]] });
      const side = CR.photo(S, sideSrc, { ...L.side, z: -2 * u, seed: Math.floor(r() * 1e5), focus: p.sideFocus, zoom: p.side ? 1 : 1.5, dim: 0.85, revealed: true, opacity: 0, burn: 0.65 });
      const right = CR.photo(S, p.src, { ...L.right, z: -1 * u, seed: Math.floor(r() * 1e5), focus: p.focus });
      const back = S.image({ x: 0, y: y0 + (tagH + paraH) / 2, z: -0.6 * u, w: tw + 14 * u, h: tagH + paraH + 10 * u, dof: "center", opacity: 0 },
        CR.brushURL(360, Math.round(360 * (tagH + paraH + 10 * u) / (tw + 14 * u)), Math.floor(r() * 1e5), "rgba(18,18,18,.7)", { m: 0.06 }));
      const tag = p.year ? CR.yearTag(S, p.year, { x: 0, y: y0 + ys * 0.71, z: 0.6 * u, size: ys, italic: true, align: "center", seed: Math.floor(r() * 1e5), pad: 2.6 }) : null;
      const cur = p.year ? CR.dash(S, (tag.w / 2) * 0.62 + 1 * u, y0 + ys * 1.05, 0.7 * u, false) : null;   /* la rayita "_" junto al año */
      const txt = CR.para(S, p.text, { x0: tx0, y0: y0 + tagH, w: tw, size: ts, italic: true, align: "justify", z: 0.6 * u, lh: 1.2 });
      const sg = p.mirror ? -1 : 1;
      const A = portrait ? { tx: 0, ty: -4 * u, d: 1.0, rx: 16, ry: -12, rz: -5, drift: { d: -0.06, ry: 3 } } : { tx: 2 * u, ty: -2 * u, d: 0.96, rx: 14, ry: -18, rz: -5, drift: { d: -0.06, ry: 3, tx: 2 * u } };
      const B = portrait ? { tx: 0, ty: y0 + tagH, d: 0.68, rx: 12, ry: 14, rz: -4, drift: { d: -0.05 } } : { tx: 0, ty: y0 + tagH, d: 0.7, rx: 10, ry: -16, rz: -4, drift: { d: -0.05, ry: 2 } };
      const shots = { A: mir(A, p.mirror), B: mir(B, p.mirror), u, fp: [0, y0 + (tagH + paraH) / 2, 0.6 * u], inOff: { tx: -14 * u * sg, ty: 4 * u, d: 0.25, ry: -6 * sg, rz: 3 * sg }, reOff: { d: 0.08, tx: 3 * u, ry: 2 } };
      const tr = autoTr(ctx, b0, p);
      return {
        render(lt, b) {
          const { cam } = CR.camera(lt, b.dur, shots, tr);
          dec.reveal(lt);
          side.opacity = 0.62 * prog(lt, 0.0, 0.7);
          back.opacity = prog(lt, 0.15, 0.5);
          right.draw(prog(lt, 0.75, 0.95, "linear"));
          if (tag) {
            const q = prog(lt, 0.5, 0.45, "inOut");
            tag.sw.opacity = q > 0 ? 1 : 0; tag.sw.a.style.clipPath = `inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)`;
            const qt = prog(lt, 0.72, 0.5); tag.tx.opacity = qt; tag.tx.blur = (1 - qt) * 3 * u;
            cur.opacity = prog(lt, 1.0, 0.2) * (Math.floor(lt * 2.2) % 2 ? 0.35 : 1);
          }
          txt.forEach((it, i) => { const q = prog(lt, 0.3 + i * 0.12, 0.55); it.opacity = q; it.blur = (1 - q) * 4 * u; });
          S.render(cam);
        },
        dispose() { S.dispose(); },
      };
    },
  });

  /* ================================================================ verse */
  K.register({
    name: "cronica.verse", tags: ["frase", "impacto", "letra", "clímax", "narración"], layer: "main", post: 0,
    summary: "Frase narrada en grande con la tipografía de los párrafos de la referencia: cada palabra se enfoca (desenfoque → nítido) en el instante en que la voz la dice, sobre el decorado en capas (fotos fantasma, letra gigante, líneas). Rótulo gris opcional arriba. Cámara oblicua con rack focus.",
    example: { kicker: "LA PREGUNTA", accent: ["vigor"] },
    params: {
      kicker: { type: "string", default: "", doc: "Texto corto del rótulo gris de arriba (vacío = sin rótulo)." },
      accent: { type: "array", default: [], doc: "Palabras que van en itálica (énfasis)." },
      src: { type: "image", default: "", doc: "Foto de fondo tenue opcional (si no, usa fotos del video)." },
      size: { type: "number", default: 1, min: 0.6, max: 1.5, doc: "Escala del texto." },
      mirror: { type: "bool", default: false, doc: "Espeja los ángulos de cámara." },
    },
    create(ctx, p) {
      const { u, portrait } = ctx.stage, r = ctx.rng, S = CR.Scene(ctx), b0 = ctx.beat;
      ctx.beat.hideCaptions = true;
      const ws = ctx.words.filter(w => w.start >= b0.t0 - 0.05 && w.start < b0.t1 - 0.05);
      const ts = (portrait ? 5.8 : 5.2) * u * p.size, tw = portrait ? 84 * u : 96 * u, ys = (portrait ? 5.6 : 4.4) * u;
      /* renglones con las palabras reales de la transcripción */
      const lines = [[]];
      for (const w of ws) {
        const cur = lines[lines.length - 1], t = [...cur.map(x => x.text), w.text].join(" ");
        if (cur.length && CR.measure(t, ts, 600, false) > tw) lines.push([]);
        lines[lines.length - 1].push(w);
      }
      const lh = ts * 1.2, tagH = p.kicker ? ys * 1.42 + 2 * u : 0, H0 = lines.length * lh + tagH, y0 = -H0 / 2;
      const box = portrait ? { x: -46 * u, y: -60 * u, w: 92 * u, h: 120 * u } : { x: -70 * u, y: -36 * u, w: 140 * u, h: 72 * u };
      const dec = CR.decor(S, ctx, r, box, { main: p.src, ghosts: 2 });
      let bg = null;
      if (p.src && K.loaded.has(p.src)) bg = CR.photo(S, p.src, { x: (portrait ? 0 : 30) * u, y: (portrait ? -30 : 0) * u, z: -5 * u, w: (portrait ? 90 : 96) * u, h: (portrait ? 70 : 66) * u, seed: Math.floor(r() * 1e5), revealed: true, dim: 0.8, opacity: 0, dof: "center", res: 1.2 });
      const back = S.image({ x: 0, y: 0, z: -0.6 * u, w: tw + 14 * u, h: H0 + 10 * u, dof: "center", opacity: 0 },
        CR.brushURL(360, Math.round(360 * (H0 + 10 * u) / (tw + 14 * u)), Math.floor(r() * 1e5), "rgba(20,20,20,.62)", { m: 0.06 }));
      const tag = p.kicker ? CR.yearTag(S, p.kicker, { x: -tw / 2, y: y0 + ys * 0.71, z: 0.5 * u, size: ys, seed: Math.floor(r() * 1e5) }) : null;
      const acc = new Set((p.accent || []).map(K.norm));
      const spans = [];
      lines.forEach((l, i) => {
        const it = S.add({ x: 0, y: y0 + tagH + (i + 0.5) * lh, z: 0.5 * u, w: tw, h: lh * 1.1 });
        Object.assign(it.a.style, { fontFamily: CR.SERIF, fontSize: ts + "px", fontWeight: 600, lineHeight: lh * 1.1 + "px", color: "#f1f1ef", whiteSpace: "nowrap", textAlign: "left", textShadow: "0 0 .45em rgba(0,0,0,.5)" });
        l.forEach((w, k) => {
          const s = K.el("span", null, { display: "inline-block", whiteSpace: "pre" }, it.a);
          s.textContent = w.text + (k < l.length - 1 ? " " : "");
          if (acc.has(K.norm(w.text))) s.style.fontStyle = "italic";
          s._w = w; spans.push(s);
        });
      });
      const sg = p.mirror ? -1 : 1;
      const A = portrait ? { tx: 0, ty: 0, d: 0.96, rx: 18, ry: -14, rz: -5, drift: { d: -0.08, ry: 4 } } : { tx: -6 * u, ty: 0, d: 0.84, rx: 20, ry: 20, rz: -6, drift: { d: -0.08, ry: -4, tx: 6 * u } };
      const shots = { A: mir(A, p.mirror), u, fp: [0, 0, 0.5 * u], inOff: { tx: 12 * u * sg, d: 0.22, ry: 6 * sg, rz: -3 * sg }, reOff: {} };
      return {
        render(lt, b, t) {
          const { cam } = CR.camera(lt, b.dur, shots, 0);
          dec.reveal(lt);
          if (bg) bg.opacity = 0.3 * prog(lt, 0, 0.6);
          back.opacity = prog(lt, 0.1, 0.5);
          if (tag) {
            const q = prog(lt, 0.3, 0.45, "inOut");
            tag.sw.opacity = q > 0 ? 1 : 0; tag.sw.a.style.clipPath = `inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)`;
            const qt = prog(lt, 0.5, 0.5); tag.tx.opacity = qt; tag.tx.blur = (1 - qt) * 3 * u;
          }
          spans.forEach(s => {
            const q = prog(t, s._w.start - 0.08, 0.38, "out");
            const v = (q).toFixed(3);
            if (s._o !== v) { s._o = v; s.style.opacity = v; s.style.filter = q < 0.98 ? `blur(${((1 - q) * 0.9 * u).toFixed(1)}px)` : "none"; }
          });
          S.render(cam);
        },
        dispose() { S.dispose(); },
      };
    },
  });

  /* ================================================================ title */
  /** composición de las tarjetas de apertura/cierre (ENVATO PRESENTS / THANK YOU de la referencia) */
  function card(ctx, o) {
    const { u, portrait } = ctx.stage, r = ctx.rng, S = CR.Scene(ctx);
    const pl = CR.pool(ctx);
    const pick = (s, i) => s && K.loaded.has(s) ? s : pl[(Math.floor(r() * pl.length) + i) % Math.max(1, pl.length)];
    const s1 = pick(o.src, 0), s2 = pick(o.src2, 1);
    const L = portrait
      ? { a: { x: -18 * u, y: -44 * u, w: 86 * u, h: 66 * u, z: -6 * u }, b: { x: 20 * u, y: 40 * u, w: 84 * u, h: 64 * u, z: -2 * u } }
      : { a: { x: -50 * u, y: -8 * u, w: 88 * u, h: 66 * u, z: -6 * u }, b: { x: 48 * u, y: 16 * u, w: 80 * u, h: 58 * u, z: -2 * u } };
    const items = [];
    if (s1) items.push(CR.photo(S, s1, { ...L.a, seed: Math.floor(r() * 1e5), revealed: true, dim: 0.85, opacity: 0, focus: [0.35, 0.35], zoom: 1.15, burn: 0.7 }));
    if (s2) items.push(CR.photo(S, s2, { ...L.b, seed: Math.floor(r() * 1e5), revealed: true, dim: 0.95, opacity: 0, focus: [0.6, 0.5], burn: 0.5 }));
    const box = portrait ? { x: -44 * u, y: -60 * u, w: 88 * u, h: 120 * u } : { x: -80 * u, y: -40 * u, w: 160 * u, h: 80 * u };
    const dec = CR.decor(S, ctx, r, box, { ghosts: 0, letter: false, blocks: o.blocks ?? 3, blockSlots: portrait ? [[0.12, -0.42], [-0.2, 0.36], [0.16, 0.46]] : [[0.36, -0.42], [-0.3, 0.42], [0.26, 0.48]] });
    /* título: letras sueltas para revelarlas una a una */
    /* se mide en MAYÚSCULAS con el espaciado (.045em) para que ningún renglón se salga del cuadro */
    const size = o.size, lines = CR.wrap(String(o.text).toUpperCase(), size * 1.05, 600, false, (portrait ? 74 : 118) * u);
    const lh = size * 1.22, y0 = (o.y ?? -2 * u) - (lines.length * lh) / 2;
    const chars = [];
    lines.forEach((ln, i) => {
      const it = S.add({ x: 0, y: y0 + (i + 0.5) * lh, z: 3 * u, w: (portrait ? 96 : 150) * u, h: lh * 1.1 });
      Object.assign(it.a.style, { fontFamily: CR.SERIF, fontWeight: 600, fontSize: size + "px", lineHeight: lh * 1.1 + "px", letterSpacing: ".045em", color: "#f4f4f2", textAlign: "center", whiteSpace: "nowrap", textShadow: "0 0 .4em rgba(0,0,0,.45)" });
      for (const c of ln) { const s = K.el("span", null, { display: "inline-block", whiteSpace: "pre" }, it.a); s.textContent = c; chars.push(s); }
    });
    const yEnd = y0 + lines.length * lh;
    return { S, dec, items, chars, yEnd, size };
  }
  const revealChars = (chars, lt, start, step) => chars.forEach((s, i) => {
    const q = prog(lt, start + i * step, 0.55, "out"), v = q.toFixed(3);
    if (s._o !== v) { s._o = v; s.style.opacity = v; s.style.filter = q < 0.98 ? `blur(${((1 - q) * 7).toFixed(1)}px)` : "none"; }
  });

  K.register({
    name: "cronica.title", tags: ["apertura", "título", "portada", "capítulo"], layer: "main", post: 0,
    summary: "Tarjeta de título (como 'ENVATO PRESENTS' de la referencia): mayúsculas serif espaciadas al centro, que aparecen letra a letra desde el desenfoque mientras la cámara hace rack focus; detrás, dos fotos tenues rasgadas a distinta profundidad, líneas finas con nodos y bloquecitos de texto. También sirve como portada de capítulo.",
    example: { text: "La noche que cayó el muro", kicker: "Berlín · 9 de noviembre de 1989" },
    params: {
      text: { type: "string", required: true, doc: "Título (se muestra en MAYÚSCULAS espaciadas)." },
      kicker: { type: "string", default: "", doc: "Línea chica en itálica debajo (lugar · fecha)." },
      src: { type: "image", default: "", doc: "Foto tenue de la izquierda (vacío = una del video)." },
      src2: { type: "image", default: "", doc: "Foto rasgada de la derecha (vacío = otra del video)." },
      hideCaptions: { type: "bool", default: false, doc: "Ocultar subtítulos mientras está en pantalla." },
    },
    create(ctx, p) {
      const { u, portrait } = ctx.stage;
      if (p.hideCaptions) ctx.beat.hideCaptions = true;
      const c = card(ctx, { text: p.text, size: (portrait ? 7.2 : 6.2) * u, src: p.src, src2: p.src2 });
      const S = c.S;
      let kick = null;
      if (p.kicker) {
        kick = S.add({ x: 0, y: c.yEnd + 3.6 * u, z: 3 * u, w: 120 * u, h: 3.4 * u, opacity: 0 });
        Object.assign(kick.a.style, { fontFamily: CR.SERIF, fontStyle: "italic", fontWeight: 500, fontSize: (portrait ? 2.8 : 2.5) * u + "px", lineHeight: 3.4 * u + "px", letterSpacing: ".08em", color: "rgba(236,236,232,.8)", textAlign: "center", whiteSpace: "nowrap" });
        kick.a.textContent = p.kicker;
      }
      const A = portrait ? { tx: 0, ty: 0, d: 0.94, rx: 8, ry: -10, rz: 4, drift: { d: -0.07, ry: 4, rz: -1 } } : { tx: 0, ty: 0, d: 0.92, rx: 10, ry: -16, rz: 5, drift: { d: -0.07, ry: 5, rz: -1 } };
      const shots = { A, u, inOff: { d: 0.12, ry: -6, tx: -4 * u }, reOff: {} };
      return {
        render(lt, b) {
          const { cam } = CR.camera(lt, b.dur, shots, 0);
          c.dec.reveal(lt);
          c.items.forEach((it, i) => it.opacity = (i ? 0.6 : 0.42) * prog(lt, 0, 0.5));
          revealChars(c.chars, lt, 0.55, 0.035);
          if (kick) { const q = prog(lt, 1.3, 0.6); kick.opacity = q; kick.blur = (1 - q) * 3 * u; }
          S.render(cam);
        },
        dispose() { S.dispose(); },
      };
    },
  });

  CR.card = card; CR.revealChars = revealChars;
})();

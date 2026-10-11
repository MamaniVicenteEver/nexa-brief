/* =============================================================================
   carta · paneles (cada TIPO de panel de la referencia "Historical Photography")
   -----------------------------------------------------------------------------
   Un panel = lista de piezas en coordenadas de la referencia (0..1 del cuadro 16:9,
   `size` en % del alto). El motor de paneles:
     · las encaja en 16:9 (escala 0,86 para dejar libre la franja de subtítulos) o las
       apila en 9:16 (foto arriba, columna de textos abajo, todo ajustado al alto libre);
     · las prerenderiza una vez (texto con desgaste, cajas, sello, firma, foto sepia);
     · en cada cuadro las ubica según la cámara de la familia (paneo + deriva + paralaje),
       las hace volar desde el lente (enter=fly/ink) y revela la foto con tinta.
   ========================================================================== */
(function () {
  const K = window.Kit, C = K.carta, { clamp, lerp, prog } = K;
  const S = 0.86, OX = 0.07, OY = 0.012;              /* encaje 16:9 (zona de subtítulos libre) */
  const POST = 2.1;                                    /* vida extra: dura todo el paneo de salida */

  /* orden de vuelo y paralaje por rol (medido en la referencia: la caja de texto pasa primero,
     luego rótulos/años/subtítulo y el título al final; los textos se mueven un poco más que la foto) */
  const FLY = { body: 0.15, gtext: 0.2, label: 0.32, years: 0.45, sub: 0.5, kicker: 0.6, figure: 0.45, title: 0.62, title2: 0.7, rule: 0.78, frame: 0.85, stamp: 0.9, sign: 0.95, hand: 0.3 };
  const PAR = { photo: 1, ghost: 0.78, gtext: 0.85, body: 1.08, stamp: 1.16, sign: 1.12, rule: 1.06, frame: 1.04 };
  const HEAVY = { title: 0.05, title2: 0.048, sub: 0.045, label: 0.045, kicker: 0.04, figure: 0.02, years: 0.012 };

  /* ---------------------------------------------------------------- geometría */
  function mirror(e) {
    const m = { ...e };
    if ("w" in e) m.x = 1 - e.x - e.w;
    else if ("x0" in e) { m.x0 = 1 - e.x1; m.x1 = 1 - e.x0; }
    else if ("x" in e) m.x = 1 - e.x;
    if (e.al === "left") m.al = "right"; else if (e.al === "right") m.al = "left";
    else if (e.t === "body") m.al = "right";            /* la caja queda anclada por su borde derecho */
    return m;
  }
  function land(e) {
    const m = { ...e };
    for (const k of ["x", "x0", "x1"]) if (k in e) m[k] = OX + e[k] * S;
    if ("y" in e) m.y = OY + e.y * S;
    for (const k of ["w", "h", "size", "r"]) if (k in e) m[k] = e[k] * S;
    if (e.maxW) m.maxW = e.maxW * S;
    return m;
  }
  /** 9:16: foto arriba y textos apilados debajo, en el orden vertical de la referencia */
  function portrait(els, ctx) {
    const { W, H, u } = ctx.stage, out = [];
    const ph = els.find(e => e.t === "photo");
    const top = 0.03, phH = ph ? 0.4 : 0, colTop = ph ? top + phH + 0.035 : 0.2, colBot = 0.765;
    for (const e of els) {
      if (e.t === "photo") out.push({ ...e, x: 0.05, y: top, w: 0.9, h: phH });
      else if (e.t === "ghost") out.push({ ...e, x: -0.15, y: colTop - 0.06, w: 1.3, h: 0.5 });
      else if (e.t === "gtext") out.push({ ...e, x: 0.08, y: colBot - 0.02, size: e.size * 0.8 });
    }
    const col = els.filter(e => !["photo", "ghost", "gtext", "stamp", "sign", "frame"].includes(e.t))
      .sort((a, b) => (a.y ?? a.y0 ?? 0) - (b.y ?? b.y0 ?? 0));
    const hOf = e => e.t === "body" ? (C.wrapText(e.str, 34).length * 1.08 + 1.6) * e.size : e.t === "rule" ? 1.4 : e.t === "label" ? e.size * 1.95 : e.size * 1.22;
    const gap = 1.1, need = col.reduce((a, e) => a + hOf(e) + gap, 0) * u, avail = (colBot - colTop) * H;
    const f = Math.min(1.05, avail / Math.max(1, need));
    let y = colTop * H;
    for (const e of col) {
      const hh = hOf(e) * f * u, m = { ...e };
      if ("size" in e) m.size = e.size * f;
      const ax = e.al === "right" ? 0.94 : e.al === "center" ? 0.5 : 0.06;
      if (e.t === "rule") { m.x0 = e.al === "right" ? 0.4 : 0.06; m.x1 = m.x0 + 0.54; m.y = (y + hh * 0.45) / H; }
      else if (e.t === "body") { m.x = 0.06; m.al = "left"; m.y = y / H; m.chars = 34; m.maxW = 0.88; }
      else if (e.t === "label") { m.x = ax; m.y = (y + hh / 2) / H; }
      else { m.x = ax; m.y = (y + m.size * u * 1.0) / H; m.maxW = 0.88; }
      out.push(m); y += hh + gap * f * u;
    }
    const st = els.find(e => e.t === "stamp"); if (st) out.push({ ...st, x: 0.83, y: top + phH - 0.02, r: st.r * 0.9 });
    const sg = els.find(e => e.t === "sign"); if (sg) out.push({ ...sg, x: 0.08, y: top + phH + 0.01 });
    const fr = els.find(e => e.t === "frame"); if (fr) out.push(fr);
    return out;
  }

  /* ---------------------------------------------------------------- prerender de cada pieza */
  function build(ctx, e, p) {
    const { W, H, u } = ctx.stage, dpr = ctx.dpr, P = ctx.C.palette;
    const up = s => String(s ?? "").toUpperCase();
    const piece = (c, x, y, w, h) => ({ ...e, c, x, y, w, h, k: e.k ?? PAR[e.t] ?? 1.12, delay: e.delay ?? FLY[e.role || e.t] ?? 0.5 });
    if (e.t === "text") {
      const str = up(e.str), fs = C.fitSize(str, e.size * u, e.maxW ? e.maxW * W : 0);
      const T = C.typeText(ctx, str, fs, { heavy: HEAVY[e.role] ?? 0.045, color: e.role === "years" ? C.INK2 : C.INK });
      const left = e.al === "right" ? e.x * W - T.tw - T.pad : e.al === "center" ? e.x * W - T.tw / 2 - T.pad : e.x * W - T.pad;
      return piece(T.c, left, e.y * H - T.base, T.w, T.h);
    }
    if (e.t === "hand") {
      const fs = C.fitSize(e.str, e.size * u, 0.86 * W, C.HAND);
      const T = C.typeText(ctx, e.str, fs, { font: C.HAND, heavy: 0, color: C.INK2, wear: 0 });
      const left = e.al === "center" ? e.x * W - T.tw / 2 - T.pad : e.x * W - T.pad;
      return piece(T.c, left, e.y * H - T.base, T.w, T.h);
    }
    if (e.t === "gtext") {
      const T = C.typeText(ctx, up(e.str), e.size * u, { heavy: 0.03, color: "#e9e2d0", wear: 10 });
      return { ...piece(T.c, e.x * W - T.pad, e.y * H - T.base, T.w, T.h), alpha: 0.4 };
    }
    if (e.t === "label") {
      const str = up(e.str), fs = C.fitSize(str, e.size * u, e.maxW ? e.maxW * W : 0.8 * W);
      const T = C.typeText(ctx, str, fs, { heavy: 0.045 });
      const px = fs * 0.55, bw = T.tw + px * 2, bh = fs * 1.55, m = u * 0.6;
      const c = C.canvas((bw + m * 2) * dpr, (bh + m * 2) * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      g.fillStyle = "rgba(224,216,196,.3)"; g.fillRect(m, m, bw, bh);
      g.strokeStyle = "rgba(216,208,188,.95)"; g.lineWidth = Math.max(1.5, u * 0.62); g.strokeRect(m, m, bw, bh);
      g.strokeStyle = "rgba(110,100,82,.55)"; g.lineWidth = Math.max(0.6, u * 0.12); const i = u * 0.4; g.strokeRect(m + i, m + i, bw - i * 2, bh - i * 2);
      g.drawImage(T.c, m + px - T.pad, m + bh / 2 - (T.base - fs * 0.36), T.w, T.h);
      const left = e.al === "right" ? e.x * W - bw - m : e.al === "center" ? e.x * W - bw / 2 - m : e.x * W - m;
      return piece(c, left, e.y * H - bh / 2 - m, bw + m * 2, bh + m * 2);
    }
    if (e.t === "body") {
      const fs = e.size * u, lines = C.wrapText(up(e.str), e.chars || 29), lh = fs * 1.08;
      const Ts = lines.map(l => C.typeText(ctx, l, fs, { heavy: 0.03, wear: 18 }));
      let tw = Math.max(...Ts.map(T => T.tw));
      const maxW = (e.maxW || 0.5) * W, sc = tw > maxW ? maxW / tw : 1;
      const pad = fs * 0.75, bw = tw * sc + pad * 2, bh = lines.length * lh * sc + pad * 1.5, m = u * 0.5;
      const c = C.canvas((bw + m * 2) * dpr, (bh + m * 2) * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      if (e.boxed !== false) {
        g.strokeStyle = "rgba(34,26,14,.92)"; g.lineWidth = Math.max(1.4, u * 0.42); g.strokeRect(m, m, bw, bh);
        g.lineWidth = Math.max(0.6, u * 0.12); const i = u * 0.62; g.strokeRect(m + i, m + i, bw - i * 2, bh - i * 2);
      }
      Ts.forEach((T, k) => g.drawImage(T.c, m + pad - T.pad * sc, m + pad * 0.8 + k * lh * sc + fs * 0.95 * sc - T.base * sc, T.w * sc, T.h * sc));
      const left = e.al === "right" ? e.x * W - bw - m : e.x * W - m;
      return piece(c, left, e.y * H - m, bw + m * 2, bh + m * 2);
    }
    if (e.t === "rule") {
      const w = (e.x1 - e.x0) * W, h = Math.max(2, u * 0.6), c = C.canvas(w * dpr, h * dpr), g = c.getContext("2d"), r = K.rng(K.hash(`${e.x0}${e.y}`));
      g.scale(dpr, dpr); g.strokeStyle = "rgba(30,22,12,.9)"; g.lineWidth = Math.max(1, u * 0.2); g.lineCap = "round";
      g.beginPath(); g.moveTo(0, h / 2); for (let x = 0; x <= w; x += w / 12) g.lineTo(x, h / 2 + (r() - 0.5) * u * 0.06); g.stroke();
      return piece(c, e.x0 * W, e.y * H - h / 2, w, h);
    }
    if (e.t === "frame") {
      const w = e.w * W, h = e.h * H, m = u, c = C.canvas((w + m * 2) * dpr, (h + m * 2) * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      g.fillStyle = "rgba(226,219,200,.22)"; g.fillRect(m, m, w, h);
      g.strokeStyle = "rgba(224,216,196,.8)"; g.lineWidth = u * 0.95; g.strokeRect(m, m, w, h);
      return piece(c, e.x * W - m, e.y * H - m, w + m * 2, h + m * 2);
    }
    if (e.t === "stamp") return stamp(ctx, e, piece);
    if (e.t === "sign") {
      const fs = e.size * u, T = C.typeText(ctx, e.str, fs, { font: C.SIGN, color: C.INK2, wear: 0 });
      const c = C.canvas(T.w * dpr, (T.h + fs * 0.4) * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
      g.drawImage(T.c, 0, 0, T.w, T.h);
      g.strokeStyle = "rgba(42,33,22,.8)"; g.lineWidth = Math.max(0.8, fs * 0.035); g.beginPath();
      g.moveTo(T.pad, T.base + fs * 0.25); g.bezierCurveTo(T.w * 0.4, T.base + fs * 0.05, T.w * 0.7, T.base + fs * 0.55, T.w - T.pad, T.base + fs * 0.2); g.stroke();
      return piece(c, e.x * W - T.pad, e.y * H - T.base, T.w, T.h + fs * 0.4);
    }
    if (e.t === "photo" || e.t === "ghost") {
      const img = ctx.img(p.src);
      if (!img && e.t === "ghost") return null;
      const w = e.w * W, h = e.h * H;
      const ph = C.inkPhoto(ctx, img, w, h, { focus: p.focus, zoom: p.zoom, style: e.style, seed: K.hash(`${p.src}|${ctx.beat.i}|${e.t}`) });
      const out = piece(null, e.x * W, e.y * H, w, h);
      if (e.t === "ghost") { out.c = ph.ghost(); out.alpha = 0.24; } else out.ph = ph;
      return out;
    }
    return null;
  }
  /** sello circular de correo (texto en el anillo + palabra central en barra) */
  function stamp(ctx, e, piece) {
    const { u } = ctx.stage, dpr = ctx.dpr, R = e.r * u, sz = R * 2.4, c = C.canvas(sz * dpr, sz * dpr), g = c.getContext("2d");
    g.scale(dpr, dpr); g.translate(sz / 2, sz / 2); g.rotate(-0.2);
    g.strokeStyle = g.fillStyle = "rgba(34,26,16,.86)";
    g.lineWidth = R * 0.07; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
    g.lineWidth = R * 0.035; g.beginPath(); g.arc(0, 0, R * 0.74, 0, 7); g.stroke();
    const ring = (txt, a0, dir) => {
      g.font = `400 ${R * 0.2}px ${C.TYPE}`; g.textAlign = "center"; g.textBaseline = "middle";
      const step = 0.245, n = txt.length;
      [...txt].forEach((ch, i) => { const a = a0 + dir * (i - (n - 1) / 2) * step; g.save(); g.rotate(a); g.translate(0, -dir * R * 0.87); if (dir < 0) g.rotate(Math.PI); g.fillText(ch, 0, 0); g.restore(); });
    };
    const [top, mid, bot] = String(e.str || "ARCHIVO|1989|BERLÍN").toUpperCase().split("|");
    ring(top || "", 0, 1); ring(bot || "", 0, -1);
    g.fillRect(-R * 0.86, -R * 0.2, R * 1.72, R * 0.4);
    g.globalCompositeOperation = "destination-out"; g.font = `400 ${R * 0.3}px ${C.TYPE}`; g.textAlign = "center"; g.textBaseline = "middle";
    g.lineWidth = R * 0.02; g.fillText(mid || "", 0, R * 0.02); g.strokeText(mid || "", 0, R * 0.02);
    const r = K.rng(K.hash(e.str || "stamp"));
    for (let i = 0; i < 160; i++) { g.globalAlpha = 0.3 + r() * 0.7; g.beginPath(); g.arc((r() - 0.5) * R * 2.2, (r() - 0.5) * R * 2.2, R * (0.01 + r() * 0.045), 0, 7); g.fill(); }
    return piece(c, e.x * ctx.stage.W - sz / 2, e.y * ctx.stage.H - sz / 2, sz, sz);
  }

  /* ---------------------------------------------------------------- montaje + cuadro a cuadro */
  const ZORDER = { ghost: 0, gtext: 1, photo: 2, frame: 3, rule: 4, body: 5, label: 6, text: 7, hand: 7, stamp: 8, sign: 9 };
  function mount(ctx, p, spec, opt = {}) {
    let els = spec.filter(e => e && (e.str === undefined || (e.str !== "" && e.str != null)));
    if (p.mirror) els = els.map(mirror);
    els = ctx.stage.portrait ? portrait(els, ctx) : els.map(land);
    let pieces = els.map(e => build(ctx, e, p)).filter(Boolean);
    if (opt.after) pieces = opt.after(pieces, ctx) || pieces;
    pieces.sort((a, b) => (ZORDER[a.t] ?? 7) - (ZORDER[b.t] ?? 7));
    if (opt.hideCaptions) ctx.beat.hideCaptions = true;
    const fam = () => ctx.family.carta;
    return {
      render(lt, b) {
        const { W, H } = ctx.stage, G = ctx.g.main, st = fam();
        /* fuera del storyboard de paneles (p. ej. fondo de una intro): panel quieto que llega volando */
        const I = st.info.get(b.i) || { P: { ...st.cam }, fly: true, enter: "fly", next: null };
        const cx = W / 2, cy = H / 2;
        const offx = (I.P.x - st.cam.x) * W, offy = (I.P.y - st.cam.y) * H;
        const fly = I.fly, ink = I.enter === "ink";
        /* salida: si el que sigue vuela/entra con tinta, este se borra; si es paneo, sale con la cámara */
        const nx = I.next, qx = !nx ? clamp((lt - b.dur) / 0.6) : nx.fly ? prog(lt, b.dur + 0.3, 1.0, "inOut") : 0;
        const z = fly ? 1 + 0.055 * (1 - prog(lt, 0.3, 6, "out")) : 1;
        /* revelado de la foto (tinta/pincel) y "des-revelado" si el siguiente vuela */
        let pr = prog(lt, fly ? 0.25 : 0.12, fly ? 2.0 : 1.9, "sine");
        const px = nx && nx.fly ? prog(lt, b.dur + 0.1, 1.25, "inOut") : 0;
        pr *= 1 - px;
        const band = px > 0 ? 0.26 : ink ? lerp(0.34, 0.075, prog(lt, 0.25, 2.4, "linear")) : fly ? lerp(0.2, 0.075, pr) : lerp(0.12, 0.075, pr);
        const inkA = ink || px > 0 ? 0.95 : 0.82;
        for (const e of pieces) {
          let s = z, a = (e.alpha ?? 1) * (1 - qx), blur = qx * 3;
          if (fly && e.t !== "photo" && e.t !== "ghost") {
            const q = prog(lt, e.delay, 1.0, "out");
            s *= 1 + 6.5 * (1 - q) * (1 - q);
            a *= clamp((lt - e.delay) / 0.1);
            blur += (s / z - 1) * 2.2;
          } else if (fly && e.t === "ghost") a *= prog(lt, 0.4, 1.2);
          if (e.t === "photo") { a = 0.95; if (pr <= 0.001) continue; }
          if (a <= 0.004) continue;
          const ex = e.x + offx * e.k, ey = e.y + offy * e.k;
          const X = cx + (ex - cx) * s, Y = cy + (ey - cy) * s, w = e.w * s, h = e.h * s;
          if (X > W || Y > H || X + w < 0 || Y + h < 0) continue;
          const c = e.t === "photo" ? e.ph.reveal(pr, band, inkA) : e.c;
          G.save(); G.globalAlpha = a;
          if (blur > 0.35) G.filter = `blur(${Math.min(14, blur).toFixed(1)}px)`;
          G.drawImage(c, X, Y, w, h);
          G.restore();
        }
      },
      dispose() {},
    };
  }

  /* ---------------------------------------------------------------- registro */
  const COMMON = {
    enter: { type: "enum", options: C.ENTERS, default: "left", doc: "Cómo llega el panel: paneo de cámara (left = el panel nuevo entra desde la derecha y todo se corre a la izquierda; right, up, down, upleft, upright, downleft, downright) · fly = los elementos llegan desde delante del lente desenfocados · ink = fly con la foto entrando en manchas de tinta." },
    mirror: { type: "bool", default: false, doc: "Espeja el diagramado (foto del otro lado)." },
    focus: { type: "array", default: [0.5, 0.42], doc: "Punto [x,y] (0..1) de la foto que queda en el centro del recorte." },
    zoom: { type: "number", default: 1, min: 1, max: 3, doc: "Zoom del recorte de la foto." },
  };
  const F = {
    src: { type: "image", required: true, doc: "Foto (se vira a sepia y se revela con tinta)." },
    label: { type: "string", default: "", doc: "Rótulo corto de máquina de escribir (p. ej. 'LOS MEJORES DESEOS')." },
    label2: { type: "string", default: "", doc: "Segundo rótulo." },
    title: { type: "string", default: "", doc: "Título grande (máquina de escribir gruesa)." },
    title2: { type: "string", default: "", doc: "Segundo título, abajo." },
    sub: { type: "string", default: "", doc: "Subtítulo." },
    years: { type: "string", default: "", doc: "Fechas finas, p. ej. '1961 - 1989'." },
    body: { type: "string", default: "", doc: "Párrafo tipeado (6–9 renglones de ~29 caracteres)." },
    sign: { type: "string", default: "", doc: "Firma manuscrita." },
    stamp: { type: "string", default: "", doc: "Sello circular 'ARRIBA|CENTRO|ABAJO' (vacío = sin sello)." },
    figure: { type: "string", default: "", doc: "Cifra destacada (p. ej. '28 AÑOS')." },
  };
  const pick = (...ks) => Object.fromEntries(ks.map(k => [k, F[k]]));
  function panel(name, o) {
    K.register({
      name: "carta." + name, panel: true, post: POST, layer: "main", tags: o.tags, summary: o.summary, example: o.example,
      params: { ...pick(...o.fields), ...COMMON, ...(o.params || {}) },
      create(ctx, p) { return mount(ctx, p, o.layout(p), o.opt || {}); },
    });
  }
  const T = (role, str, x, y, al, size, maxW) => ({ t: "text", role, str, x, y, al, size, maxW });
  const ex = (o) => ({ src: "assets/media/mauerbau.jpg", ...o });

  panel("retrato", {
    tags: ["foto", "persona", "retrato", "presentación"],
    summary: "Retrato con borde de pincel a la izquierda; a la derecha rótulo en caja crema, sello de correo, fechas, título enorme con regla y subtítulo; la foto se repite fantasma detrás de los textos (panel 'THE BEST WISHES / HISTORICAL').",
    example: ex({ label: "VOCERO DEL PARTIDO", stamp: "ARCHIVO|1989|BERLÍN", years: "9 - 11 - 1989", title: "SCHABOWSKI", sub: "GÜNTER" }),
    fields: ["src", "label", "stamp", "years", "title", "sub"],
    layout: p => [
      { t: "ghost", x: 0.44, y: -0.12, w: 0.62, h: 1.2 },
      { t: "photo", x: 0.02, y: 0.02, w: 0.47, h: 0.93 },
      { t: "label", role: "label", str: p.label, x: 0.908, y: 0.224, al: "right", size: 6.2, maxW: 0.45 },
      p.stamp ? { t: "stamp", str: p.stamp, x: 0.826, y: 0.444, r: 8.8 } : null,
      T("years", p.years, 0.905, 0.655, "right", 6.8),
      T("title", p.title, 0.927, 0.81, "right", 15.5, 0.56),
      { t: "rule", x0: 0.276, x1: 0.604, y: 0.843 },
      T("sub", p.sub, 0.925, 0.893, "right", 7.4, 0.5),
    ],
  });
  panel("sello", {
    tags: ["foto", "persona", "documento"],
    summary: "Variante del retrato: foto a la izquierda, rótulo en caja, sello, título grande al centro-derecha, fechas, regla y subtítulo grueso debajo (panel 'PHOTOGRAPHY 1945-1948 HISTORICAL').",
    example: ex({ label: "LA NOTA", stamp: "ARCHIVO|1989|BERLÍN", title: "INMEDIATO", years: "9 - 11 - 1989", sub: "SIN DEMORA" }),
    fields: ["src", "label", "stamp", "title", "years", "sub"],
    layout: p => [
      { t: "ghost", x: 0.4, y: -0.1, w: 0.6, h: 1.15 },
      { t: "photo", x: 0.0, y: 0.03, w: 0.42, h: 0.92 },
      { t: "label", role: "label", str: p.label, x: 0.66, y: 0.26, al: "center", size: 6.2, maxW: 0.42 },
      p.stamp ? { t: "stamp", str: p.stamp, x: 0.78, y: 0.45, r: 8 } : null,
      T("title", p.title, 0.65, 0.65, "center", 14, 0.54),
      T("years", p.years, 0.7, 0.745, "center", 6.8),
      { t: "rule", x0: 0.48, x1: 0.78, y: 0.78 },
      T("sub", p.sub, 0.7, 0.86, "center", 6.8, 0.45),
    ],
  });
  panel("postal", {
    tags: ["foto", "lugar", "ciudad", "contexto"],
    summary: "Postal de un lugar: rótulo y fechas arriba a la izquierda, caja de texto tipeado con doble borde, foto ancha a la derecha, título gigante abajo con segundo renglón corrido y regla (panel 'VENEZIA / ITALY').",
    example: ex({ label: "AGOSTO DE 1961", years: "1961 - 1989", body: "De un día para otro el gobierno del Este levantó un muro de hormigón y alambre en medio de la ciudad.", title: "BERLÍN", sub: "ALEMANIA" }),
    fields: ["src", "label", "years", "body", "title", "sub"],
    layout: p => [
      { t: "photo", x: 0.37, y: 0.1, w: 0.62, h: 0.66 },
      T("label", p.label, 0.11, 0.14, "left", 7, 0.5),
      T("years", p.years, 0.15, 0.265, "left", 7.2),
      { t: "body", str: p.body, x: 0.018, y: 0.31, size: 3.6, chars: 29, maxW: 0.4 },
      T("title", p.title, 0.16, 0.79, "left", 15.5, 0.46),
      T("sub", p.sub, 0.4, 0.885, "left", 8.5, 0.4),
      { t: "rule", x0: 0.1, x1: 0.455, y: 0.915 },
    ],
  });
  panel("familia", {
    tags: ["foto", "personas", "grupo", "familia"],
    summary: "Foto de grupo abajo a la izquierda; arriba rótulo, firma manuscrita y caja de texto; a la derecha fechas y título de dos renglones alineado a la derecha (panel 'MY FAMILY / LOVELY').",
    example: ex({ label: "FAMILIAS SEPARADAS", sign: "Elsa", body: "Una calle bastaba para no volver a verse.", years: "1961 - 1989", title: "VECINOS", sub: "SEPARADOS" }),
    fields: ["src", "label", "sign", "body", "years", "title", "sub"],
    layout: p => [
      { t: "photo", x: 0.0, y: 0.13, w: 0.6, h: 0.8 },
      T("label", p.label, 0.128, 0.11, "left", 7, 0.5),
      p.sign ? { t: "sign", str: p.sign, x: 0.62, y: 0.09, size: 5.5 } : null,
      { t: "body", str: p.body, x: 0.67, y: 0.17, size: 3.4, chars: 29, maxW: 0.4 },
      T("years", p.years, 0.92, 0.55, "right", 7.2),
      T("title", p.title, 0.905, 0.765, "right", 10, 0.5),
      T("title", p.sub, 0.9, 0.895, "right", 12, 0.5),
    ],
  });
  panel("memoria", {
    tags: ["foto", "personas", "recuerdo", "memoria"],
    summary: "Foto a la izquierda; rótulo en caja crema a la derecha, fechas, título grande que pisa la foto y subtítulo corto con firma (panel 'OUR HISTORY / DO NOT FORGET / ABOUT IT').",
    example: ex({ label: "AL MENOS 140", years: "1961 - 1989", title: "NO OLVIDAR", sub: "A LOS QUE CAYERON", sign: "Berlín" }),
    fields: ["src", "label", "years", "title", "sub", "sign"],
    layout: p => [
      { t: "photo", x: 0.0, y: 0.02, w: 0.43, h: 0.92 },
      { t: "label", role: "label", str: p.label, x: 0.69, y: 0.34, al: "center", size: 6.4, maxW: 0.44 },
      T("years", p.years, 0.835, 0.64, "right", 7),
      T("title", p.title, 0.86, 0.78, "right", 11, 0.58),
      T("sub", p.sub, 0.36, 0.875, "left", 6, 0.4),
      p.sign ? { t: "sign", str: p.sign, x: 0.64, y: 0.9, size: 4.5 } : null,
    ],
  });
  panel("recuerdo", {
    tags: ["foto", "personas", "época"],
    summary: "Dos rótulos grandes apilados a la izquierda entre reglas, fechas, foto a la derecha y título grueso abajo a la derecha (panel 'OUR HISTORY / FAST RENDERING / ABOUT IT').",
    example: ex({ label: "OTOÑO", label2: "DE 1989", years: "1989", title: "ALGO SE ROMPE" }),
    fields: ["src", "label", "label2", "years", "title"],
    layout: p => [
      { t: "photo", x: 0.45, y: 0.12, w: 0.55, h: 0.82 },
      { t: "rule", x0: 0.24, x1: 0.52, y: 0.23 },
      T("label", p.label, 0.05, 0.36, "left", 8.5, 0.46),
      T("label", p.label2, 0.01, 0.51, "left", 8.5, 0.5),
      T("years", p.years, 0.12, 0.74, "left", 8.5),
      { t: "rule", x0: 0.07, x1: 0.36, y: 0.84 },
      T("title", p.title, 0.86, 0.9, "right", 11.5, 0.6),
    ],
  });
  panel("album", {
    tags: ["foto", "personas", "grupo", "multitud"],
    summary: "Foto grande a la izquierda; arriba a la derecha fechas, caja de texto tipeado y título de dos tamaños abajo a la derecha (panel '1950-1968 / MY LIFE / MY FAMILY').",
    example: ex({ years: "1989", body: "Cada lunes, cientos de miles marchaban por las calles pidiendo libertad para viajar.", title: "LEIPZIG", sub: "LOS LUNES" }),
    fields: ["src", "years", "body", "title", "sub"],
    layout: p => [
      { t: "photo", x: 0.03, y: 0.04, w: 0.62, h: 0.86 },
      T("years", p.years, 0.914, 0.25, "right", 8),
      { t: "body", str: p.body, x: 0.644, y: 0.32, size: 3.4, chars: 29, maxW: 0.4 },
      T("title", p.title, 0.953, 0.755, "right", 12, 0.5),
      T("sub", p.sub, 0.91, 0.855, "right", 7.5, 0.45),
    ],
  });
  panel("nota", {
    tags: ["foto", "documento", "dato"],
    summary: "Rótulo en caja arriba a la izquierda, caja de texto debajo, título grande con regla, fechas y foto vertical a la derecha (panel 'EASY TO EDIT / HISTORICAL / 1945-1948').",
    example: ex({ label: "NUEVA REGLA", body: "Los ciudadanos podrían pedir permiso para viajar al Oeste.", title: "PERMISO", years: "10 - 11 - 1989" }),
    fields: ["src", "label", "body", "title", "years"],
    layout: p => [
      { t: "photo", x: 0.58, y: 0.05, w: 0.39, h: 0.88 },
      { t: "label", role: "label", str: p.label, x: 0.04, y: 0.18, al: "left", size: 7, maxW: 0.5 },
      { t: "body", str: p.body, x: 0.055, y: 0.28, size: 3.4, chars: 29, maxW: 0.4 },
      T("title", p.title, 0.04, 0.73, "left", 11, 0.52),
      { t: "rule", x0: 0.14, x1: 0.5, y: 0.765 },
      T("years", p.years, 0.47, 0.86, "right", 7.2),
    ],
  });
  panel("ficha", {
    tags: ["foto", "persona", "ficha", "biografía"],
    summary: "Ficha de persona: retrato a la izquierda; a la derecha título, subtítulo y fechas apilados a la derecha, caja de texto y regla (panel 'HISTORICAL / MAYR KETMAN / 1945-1948').",
    example: ex({ title: "HARALD JÄGER", sub: "OFICIAL DE FRONTERA", years: "9 - 11 - 1989", body: "Tenía una multitud frente a él y ninguna orden." }),
    fields: ["src", "title", "sub", "years", "body"],
    layout: p => [
      { t: "photo", x: 0.03, y: 0.04, w: 0.4, h: 0.92 },
      T("title", p.title, 0.895, 0.22, "right", 11, 0.5),
      T("sub", p.sub, 0.89, 0.33, "right", 7.5, 0.48),
      T("years", p.years, 0.88, 0.445, "right", 7.5),
      { t: "body", str: p.body, x: 0.51, y: 0.54, size: 3.4, chars: 29, maxW: 0.4 },
      { t: "rule", x0: 0.58, x1: 0.98, y: 0.87 },
    ],
  });
  panel("ciudad", {
    tags: ["foto", "lugar", "paisaje", "ciudad"],
    summary: "Título enorme con regla, subtítulo y fechas a la izquierda; paisaje ancho a la derecha revelado con salpicaduras de tinta alrededor (panel 'OUR CITY / HAPPY DAYS').",
    example: ex({ title: "BERLÍN", sub: "UNA CIUDAD PARTIDA", years: "1961 - 1989" }),
    fields: ["src", "title", "sub", "years"],
    layout: p => [
      { t: "photo", x: 0.38, y: 0.08, w: 0.62, h: 0.8, style: "splatter" },
      T("title", p.title, 0.02, 0.33, "left", 14, 0.42),
      { t: "rule", x0: 0.02, x1: 0.35, y: 0.37 },
      T("sub", p.sub, 0.03, 0.47, "left", 7.5, 0.4),
      T("years", p.years, 0.07, 0.625, "left", 7.5),
    ],
  });
  panel("proyecto", {
    tags: ["foto", "persona", "dato", "texto"],
    summary: "Foto vertical a la izquierda; título enorme arriba, subtítulo, caja de texto tipeado y fechas abajo (panel 'CS 5 PROJECT / HAPPY DAYS').",
    example: ex({ title: "LA PREGUNTA", sub: "¿CUÁNDO ENTRA EN VIGOR?", body: "Schabowski revolvió sus papeles. Buscó la respuesta. No la encontró.", years: "18:53" }),
    fields: ["src", "title", "sub", "body", "years"],
    layout: p => [
      { t: "photo", x: 0.0, y: 0.06, w: 0.34, h: 0.86 },
      T("title", p.title, 0.34, 0.27, "left", 13, 0.62),
      T("sub", p.sub, 0.42, 0.405, "left", 7.5, 0.54),
      { t: "body", str: p.body, x: 0.405, y: 0.46, size: 3.4, chars: 29, maxW: 0.4 },
      T("years", p.years, 0.425, 0.86, "left", 8),
    ],
  });
  panel("dato", {
    tags: ["foto", "dato", "número", "cifra"],
    summary: "Dato: título con regla, cifra destacada, texto tipeado suelto, fechas entre reglas y foto a la derecha (panel 'HIGH RESOLUTION / 1920X1080').",
    example: ex({ title: "DURANTE", figure: "28 AÑOS", body: "Berlín estuvo partida en dos.", years: "1961 - 1989" }),
    fields: ["src", "title", "figure", "body", "years"],
    layout: p => [
      { t: "photo", x: 0.43, y: 0.05, w: 0.56, h: 0.74 },
      T("title", p.title, 0.04, 0.195, "left", 8.5, 0.48),
      { t: "rule", x0: 0.21, x1: 0.5, y: 0.235 },
      T("figure", p.figure, 0.3, 0.39, "center", 9, 0.44),
      { t: "body", str: p.body, x: 0.04, y: 0.43, size: 3.4, chars: 29, maxW: 0.4, boxed: false },
      T("years", p.years, 0.12, 0.79, "left", 8),
      { t: "rule", x0: 0.01, x1: 0.31, y: 0.825 },
    ],
  });
  panel("perfil", {
    tags: ["foto", "persona", "biografía"],
    summary: "Perfil: retrato a la izquierda, nombre, ciudad y fechas escalonados, texto tipeado suelto y un segundo título abajo con regla (panel 'JESICA VRUBLER / PARIS / BIG FAMILY').",
    example: ex({ title: "GÜNTER SCHABOWSKI", sub: "BERLÍN ESTE", years: "1989", body: "El encargado de contarlo a la prensa.", title2: "EL VOCERO" }),
    fields: ["src", "title", "sub", "years", "body", "title2"],
    layout: p => [
      { t: "photo", x: 0.06, y: 0.08, w: 0.34, h: 0.86 },
      T("title", p.title, 0.42, 0.255, "left", 8.5, 0.55),
      T("sub", p.sub, 0.51, 0.39, "left", 7, 0.45),
      T("years", p.years, 0.615, 0.47, "left", 7),
      { t: "body", str: p.body, x: 0.485, y: 0.5, size: 3.4, chars: 29, maxW: 0.4, boxed: false },
      T("title2", p.title2, 0.59, 0.85, "left", 8.5, 0.4),
      { t: "rule", x0: 0.3, x1: 0.8, y: 0.885 },
    ],
  });
  panel("frente", {
    tags: ["foto", "lugar", "frontera", "conflicto"],
    summary: "Título con regla arriba a la izquierda, subtítulo, fechas tenues, caja de texto, segundo título abajo y foto ancha a la derecha (panel 'EASY TO EDIT / GERMANY / WORLD WAR').",
    example: ex({ title: "LA FRONTERA", sub: "BORNHOLMER", years: "23:30", body: "Abrió la barrera. Y la gente cruzó.", title2: "LA DECISIÓN" }),
    fields: ["src", "title", "sub", "years", "body", "title2"],
    layout: p => [
      { t: "photo", x: 0.45, y: 0.1, w: 0.55, h: 0.8 },
      T("title", p.title, 0.03, 0.18, "left", 9, 0.46),
      { t: "rule", x0: 0.16, x1: 0.47, y: 0.23 },
      T("sub", p.sub, 0.46, 0.31, "right", 7.5, 0.4),
      { ...T("years", p.years, 0.03, 0.4, "left", 7.5), alpha: 0.6 },
      { t: "body", str: p.body, x: 0.09, y: 0.43, size: 3.4, chars: 29, maxW: 0.4 },
      T("title2", p.title2, 0.12, 0.805, "left", 8.5, 0.36),
      { t: "rule", x0: 0.12, x1: 0.42, y: 0.845 },
    ],
  });

  /* ---------------------------------------------------------------- título (apertura / cierre) */
  /** caja crema que abraza título + subtítulo; el subtítulo se alinea al borde derecho del título */
  function titleAfter(pieces, ctx) {
    const { W, H, u } = ctx.stage;
    const t = pieces.find(e => e.role === "title"), s = pieces.find(e => e.role === "sub"), k = pieces.find(e => e.role === "kicker"), fr = pieces.find(e => e.t === "frame");
    if (!t) return pieces;
    const right = t.x + t.w * 0.97;
    if (s) { s.x = Math.min(W - s.w, right - s.w * 0.97 + u * 1.5); }
    const x0 = Math.min(t.x, s ? s.x : t.x) - u * 4, x1 = Math.max(t.x + t.w, s ? s.x + s.w : 0) + u * 4;
    const y0 = t.y - u * 1.2, y1 = (s ? s.y + s.h : t.y + t.h) + u * 0.8;
    if (fr) Object.assign(fr, rebuildFrame(ctx, x0, y0, x1 - x0, y1 - y0));
    if (k) { k.x = Math.max(0, Math.min(W - k.w, x1 - k.w + u * 2.5)); k.y = y1 + u * 0.6; }
    return pieces;
  }
  function rebuildFrame(ctx, x, y, w, h) {
    const { u } = ctx.stage, dpr = ctx.dpr, m = u, c = C.canvas((w + m * 2) * dpr, (h + m * 2) * dpr), g = c.getContext("2d"); g.scale(dpr, dpr);
    g.fillStyle = "rgba(226,219,200,.22)"; g.fillRect(m, m, w, h);
    g.strokeStyle = "rgba(224,216,196,.82)"; g.lineWidth = u * 0.95; g.strokeRect(m, m, w, h);
    return { c, x: x - m, y: y - m, w: w + m * 2, h: h + m * 2 };
  }
  const titleSpec = (title, sub, kicker, ghost) => [
    ghost ? { t: "gtext", str: ghost, x: 0.6, y: 1.0, size: 30 } : null,
    { t: "frame", x: 0.2, y: 0.33, w: 0.6, h: 0.31 },
    { ...T("title", title, 0.5, 0.5, "center", 15.5, 0.66), delay: 0.25 },
    { ...T("sub", sub, 0.74, 0.585, "right", 7.4, 0.62), delay: 0.42 },
    { ...T("kicker", kicker, 0.8, 0.695, "right", 3.6, 0.5), delay: 0.62 },
  ];
  K.register({
    name: "carta.title", panel: true, post: POST, layer: "main", tags: ["apertura", "título", "cierre"],
    summary: "Portada: título de máquina de escribir enorme + subtítulo alineado a su derecha dentro de una caja crema, bajada pequeña, y letras fantasma gigantes al fondo. Por defecto entra volando desde el lente (apertura y cierre de la referencia).",
    example: { title: "EL MURO", sub: "LA NOCHE QUE CAYÓ", kicker: "BERLÍN · 9 NOV 1989" },
    params: {
      title: { type: "string", required: true, doc: "Palabra/frase grande (corta: 1–2 palabras)." },
      sub: { type: "string", default: "", doc: "Segundo renglón, más chico, alineado a la derecha del título." },
      kicker: { type: "string", default: "", doc: "Bajada pequeña bajo la caja." },
      ghost: { type: "string", default: "", doc: "Letras fantasma gigantes del fondo (vacío = 3 primeras letras del título)." },
      ...COMMON, enter: { ...COMMON.enter, default: "fly" },
    },
    create(ctx, p) {
      return mount(ctx, p, titleSpec(p.title, p.sub, p.kicker, p.ghost || String(p.title).split(/\s+/).sort((a, b) => b.length - a.length)[0].slice(0, 3)), { after: titleAfter });
    },
  });

  K.cartaPanel = { mount, titleSpec, titleAfter, T, COMMON, POST };
})();

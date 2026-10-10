/* =============================================================================
   common · componentes de texto compartidos por todas las familias
   (los colores salen de config.palette: ink, accent, bg)
   ========================================================================== */
(function () {
  const K = Kit, { clamp, prog, ease } = K;
  const fade = (lt, dur, a = 0.35, b = 0.35) => clamp(lt / a) * clamp((dur - lt) / b);

  /** parte "texto con ^acento^" en spans; cada carácter queda en .ch para animarlo */
  function richLines(parent, text, accentClass = "acc") {
    const chars = [];
    String(text).split("\n").forEach(line => {
      const ln = K.el("span", "ln", null, parent);
      let acc = false;
      for (const part of line.split("^")) {
        for (const c of part) { const s = K.el("span", "ch" + (acc ? " " + accentClass : ""), null, ln); s.textContent = c; chars.push(s); }
        acc = !acc;
      }
    });
    return chars;
  }

  /* --------------------------------------------------------------- punch */
  K.register({
    name: "common.punch", tags: ["impacto", "texto", "énfasis"], layer: "main",
    summary: "Palabra o frase GIGANTE a pantalla (momento de alto impacto, como las plantillas de música): letras que caen con desenfoque y se asientan; '^palabra^' va en color de acento.",
    example: { text: "MILLONES\nDE ^VIDAS^", size: 0.9 },
    params: {
      text: { type: "string", required: true, doc: "Texto; '\\n' parte renglones; '^x^' = acento." },
      size: { type: "number", default: 0.86, min: 0.2, max: 1, doc: "Fracción del ancho del cuadro que ocupa el renglón más largo." },
      style: { type: "enum", options: ["solid", "outline", "glitch"], default: "solid", doc: "solid = relleno, outline = contorno, glitch = entra cortado." },
      stagger: { type: "number", default: 0.035, doc: "Segundos entre letra y letra." },
      y: { type: "number", default: 0.45, doc: "Centro vertical (fracción del alto)." },
      hideCaptions: { type: "bool", default: true, doc: "Oculta los subtítulos mientras está en pantalla." },
    },
    create(ctx, p) {
      const { W, H, u } = ctx.stage, C = ctx.C;
      const box = K.el("div", "k-punch", { top: "0", height: H + "px", color: C.palette.ink }, ctx.layers.dom);
      box.style.setProperty("--accent", C.palette.accent || C.palette.ink);
      const chars = richLines(box, p.text);
      /* tamaño: el renglón más largo ocupa `size` del ancho */
      const longest = Math.max(...String(p.text).replace(/\^/g, "").split("\n").map(l => l.length));
      const fs = Math.min(W * p.size / (longest * 0.6), H * 0.26);
      box.style.fontSize = fs + "px";
      box.style.top = (p.y * H - H / 2) + "px";
      if (p.style === "outline") { box.style.color = "transparent"; box.style.webkitTextStroke = `${Math.max(1, fs * 0.018)}px ${C.palette.ink}`; }
      if (p.hideCaptions) ctx.beat.hideCaptions = true;
      return {
        render(lt, b) {
          const out = clamp((b.dur - lt) / 0.3);
          chars.forEach((c, i) => {
            const q = prog(lt, i * p.stagger, 0.45, "expoOut");
            const blur = (1 - q) * 14, dy = (1 - q) * -0.5 * fs;
            c.style.opacity = (q * out).toFixed(3);
            c.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : "none";
            c.style.transform = p.style === "glitch" && q < 1 ? `translate(${((i % 3) - 1) * (1 - q) * 30}px, ${dy}px)` : `translateY(${dy}px) scale(${1 + (1 - out) * 0.08})`;
          });
        },
        dispose() { box.remove(); },
      };
    },
  });

  /* --------------------------------------------------------------- tag */
  K.register({
    name: "common.tag", tags: ["contexto", "lugar", "fecha"], layer: "overlay",
    summary: "Rótulo de contexto (lugar · fecha · dato) en mono mayúsculas, arriba o abajo del cuadro; entra escribiéndose.",
    example: { text: "BLETCHLEY PARK · 1940", pos: "top" },
    params: {
      text: { type: "string", required: true, doc: "Texto del rótulo." },
      pos: { type: "enum", options: ["top", "bottom", "center"], default: "top", doc: "Posición." },
      boxed: { type: "bool", default: true, doc: "Con caja de color (true) o solo texto. Duración: usar 'dur' del beat." },
    },
    create(ctx, p) {
      const { H, u, content } = ctx.stage, C = ctx.C;
      const y = p.pos === "top" ? Math.max(u * 4, content.y - u * 3.5) : p.pos === "bottom" ? content.y + content.h + u * 3 : H / 2;
      const el = K.el("div", "k-tag", { top: y + "px", left: "50%", transform: "translate(-50%,-50%)", fontSize: u * 1.7 + "px", padding: `${u * 0.55}px ${u * 1.1}px`,
        background: p.boxed ? (C.palette.tagBg || C.palette.ink) : "transparent", color: p.boxed ? (C.palette.tagInk || C.palette.bg) : C.palette.ink }, ctx.layers.dom);
      return {
        render(lt, b) {
          const n = Math.round(clamp(lt / 0.5) * p.text.length);
          el.textContent = p.text.slice(0, n) + (n < p.text.length ? "▌" : "");
          el.style.opacity = fade(lt, b.dur, 0.05, 0.3);
        },
        dispose() { el.remove(); },
      };
    },
  });

  /* --------------------------------------------------------------- flash */
  K.register({
    name: "common.flash", tags: ["transición", "golpe"], layer: "overlay",
    summary: "Destello de un instante (blanco o color de acento) para marcar un corte o un golpe de sonido.",
    example: { color: "palette.ink", dur: 0.5 },
    params: {
      color: { type: "color", default: "palette.ink", doc: "Color del destello." },
      strength: { type: "number", default: 0.85, min: 0, max: 1, doc: "Opacidad máxima." },
    },
    post: 0,
    create(ctx, p) {
      return { render(lt, b) {
        const G = ctx.g.top, a = p.strength * (1 - ease.out(clamp(lt / Math.max(0.15, b.dur))));
        if (a <= 0.01) return;
        G.save(); G.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0); G.globalAlpha = a; G.fillStyle = p.color; G.fillRect(0, 0, ctx.stage.W, ctx.stage.H); G.restore();
      } };
    },
  });

  /* --------------------------------------------------------------- endcard */
  K.register({
    name: "common.endcard", tags: ["cierre", "marca"], layer: "main",
    summary: "Tarjeta final sobria: frase de cierre grande, línea y firma de marca (canal / suscribirse).",
    example: { line: "SEGUIMOS\nPREGUNTANDO", brand: "NEXA BRIEF", cta: "SUSCRÍBETE" },
    params: {
      line: { type: "string", default: "", doc: "Frase de cierre ('\\n' para renglones, '^x^' acento)." },
      brand: { type: "string", default: "", doc: "Marca / canal." },
      cta: { type: "string", default: "", doc: "Llamado a la acción (mono)." },
    },
    create(ctx, p) {
      const { W, H, u } = ctx.stage, C = ctx.C;
      const wrap = K.el("div", "k-punch", { top: "0", height: H + "px", color: C.palette.ink, gap: u * 3 + "px" }, ctx.layers.dom);
      wrap.style.setProperty("--accent", C.palette.accent || C.palette.ink);
      const big = K.el("div", null, { fontSize: Math.min(W * 0.8 / Math.max(6, Math.max(...p.line.replace(/\^/g, "").split("\n").map(l => l.length)) * 0.6), H * 0.15) + "px" }, wrap);
      const chars = richLines(big, p.line);
      const rule = K.el("div", null, { width: "0px", height: Math.max(1, u * 0.15) + "px", background: C.palette.accent || C.palette.ink }, wrap);
      const brand = K.el("div", "k-tag", { position: "static", fontSize: u * 2 + "px", color: C.palette.ink }, wrap); brand.textContent = p.brand;
      const cta = K.el("div", "k-tag", { position: "static", fontSize: u * 1.5 + "px", color: C.palette.muted || C.palette.ink }, wrap); cta.textContent = p.cta;
      ctx.beat.hideCaptions = true;
      return {
        render(lt, b) {
          chars.forEach((c, i) => { const q = prog(lt, i * 0.03, 0.5, "expoOut"); c.style.opacity = q; c.style.filter = q < 1 ? `blur(${(1 - q) * 10}px)` : "none"; });
          rule.style.width = W * 0.3 * prog(lt, 0.6, 0.8, "inOut") + "px";
          brand.style.opacity = prog(lt, 1.0, 0.6); cta.style.opacity = prog(lt, 1.4, 0.6) * (0.6 + 0.4 * Math.abs(Math.sin(lt * 2)));
          wrap.style.opacity = clamp((b.dur - lt) / 0.6 + 0.0001);
        },
        dispose() { wrap.remove(); },
      };
    },
  });

  /* --------------------------------------------------------------- lyric */
  K.register({
    name: "common.lyric", tags: ["impacto", "letra", "frase", "clímax"], layer: "main",
    summary: "Frase narrada en GRANDE como en las plantillas de música: las palabras dichas dentro del beat aparecen exactamente cuando la voz las dice (tiempos de la transcripción); la actual a pleno, las anteriores atenuadas; `accent` pinta palabras clave.",
    example: { accent: ["vidas"], size: 0.9 },
    params: {
      accent: { type: "array", default: [], doc: "Palabras (sin tildes ni mayúsculas importa) que van en color de acento." },
      size: { type: "number", default: 0.82, min: 0.3, max: 1, doc: "Fracción del ancho que ocupa el renglón más largo." },
      maxChars: { type: "number", default: 0, doc: "Caracteres por renglón (0 = automático: 11 en 9:16, 18 en 16:9)." },
      dimPast: { type: "bool", default: true, doc: "Atenuar las palabras ya dichas (efecto karaoke)." },
      y: { type: "number", default: 0.46, doc: "Centro vertical (fracción del alto)." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, C = ctx.C, b0 = ctx.beat;
      ctx.beat.hideCaptions = ctx.beat.hideCaptions ?? true;
      const ws = ctx.words.filter(w => w.start >= b0.t0 - 0.05 && w.start < b0.t1 - 0.05);
      const max = p.maxChars || (portrait ? 11 : 18), lines = [[]];
      for (const w of ws) { const cur = lines[lines.length - 1], len = cur.reduce((a, x) => a + x.text.length + 1, 0); if (cur.length && len + w.text.length > max) lines.push([]); lines[lines.length - 1].push(w); }
      /* ancho real de cada renglón con la fuente del componente (estimar por caracteres desbordaba) */
      const mc = document.createElement("canvas").getContext("2d"); mc.font = "900 100px Inter";
      const widest = Math.max(1, ...lines.map(l => mc.measureText(l.map(w => w.text.replace(/[.,;:]+$/, "")).join(" ").toUpperCase()).width * (1 - 0.045)));
      const fs = Math.min(100 * W * p.size / widest, H * (portrait ? 0.11 : 0.16), (H * 0.62) / (lines.length * 0.95));
      const box = K.el("div", "k-punch", { top: (p.y * H - H / 2) + "px", height: H + "px", fontSize: fs + "px", color: C.palette.ink, gap: "0" }, ctx.layers.dom);
      const acc = new Set(p.accent.map(K.norm));
      const spans = [];
      lines.forEach(l => { const ln = K.el("span", "ln", null, box); l.forEach((w, i) => { const s = K.el("span", "ch", null, ln); s.textContent = w.text.replace(/[.,;:]+$/, "") + (i < l.length - 1 ? " " : ""); s._w = w; s._acc = acc.has(K.norm(w.text)); if (s._acc) s.style.color = C.palette.accent; spans.push(s); }); });
      return {
        render(lt, b, t) {
          const out = clamp((lt - b.dur) / 0.35);
          spans.forEach((s, i) => {
            const w = s._w, q = prog(t, w.start - 0.06, 0.28, "expoOut"), next = spans[i + 1]?._w;
            const past = p.dimPast && next && t >= next.start;
            s.style.opacity = (q * (past && !s._acc ? 0.42 : 1) * (1 - out)).toFixed(3);
            s.style.transform = `translateY(${((1 - q) * 0.25 * fs).toFixed(1)}px) scale(${(1 + (1 - q) * (s._acc ? 0.35 : 0.12)).toFixed(3)})`;
            s.style.filter = q < 0.98 ? `blur(${((1 - q) * 10).toFixed(1)}px)` : "none";
          });
        },
        dispose() { box.remove(); },
      };
    },
  });

  K.common = { richLines };
})();

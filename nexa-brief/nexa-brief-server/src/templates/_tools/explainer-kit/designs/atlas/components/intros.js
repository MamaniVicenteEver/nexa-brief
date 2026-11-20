/* =============================================================================
   atlas · intros (gancho), contrato designs/common/hook.js
   atlas.introv1  GOLPE: la cámara se lanza del mundo a la región mientras los
                  países se encienden en blanco en ráfaga (como el final de la
                  referencia) y el titular golpea palabra por palabra.
   atlas.introv2  PREGUNTA + REVELACIÓN: la pregunta se tipea sobre el mundo
                  apagado; en revealAt el mapa se enciende, la cámara cae sobre
                  el país, parpadea en blanco y el alfiler trae la respuesta.
   Fondo: bg auto/world = el mapa del runtime; dark; image (src); component; none.
   ========================================================================== */
(function () {
  const K = Kit, A = Kit.atlas, { clamp, lerp, prog, ease } = K;
  const lst = v => (Array.isArray(v) ? v : v ? [v] : []);
  /** el mapa vive en el runtime: con bg world/auto el componente no dibuja fondo */
  const presets = st => ({ world: () => {}, dark: G => { G.fillStyle = "#0b0b0a"; G.fillRect(0, 0, st.W, st.H); } });
  const tone = img => A.memo("tone:" + img.src, () => { const T = A.mk(img.width, img.height); T.g.filter = "grayscale(1) contrast(1.25) brightness(.9)"; T.g.drawImage(img, 0, 0); return T.c; });
  const mapBg = p => !p.bg || p.bg === "auto" || p.bg === "world";

  /** palabras con acento '^x^' por renglón → [{w, acc, line}] */
  function words(text) {
    const out = [];
    String(text || "").split("\n").forEach((l, li) => { l.split("^").forEach((seg, k) => seg.split(/(\s+)/).forEach(w => { if (!w) return; if (/^\s+$/.test(w)) { out.sp = true; return; } const glue = out.length && out[out.length - 1].line === li && !out.sp && !/^\s/.test(seg) && (/^[?!.,:;…»)]+/.test(w) || k > 0); out.push({ w: w.toUpperCase(), acc: k % 2 === 1, line: li, glue: !!glue }); out.sp = false; })); out.sp = true; });
    return out;
  }
  /** sacudida de cámara amortiguada después de cada golpe */
  function shake(lt, hits, amp) {
    let x = 0, y = 0;
    for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.35) { const k = (1 - d / 0.35) * amp; x += Math.sin(d * 71) * k; y += Math.cos(d * 53) * k * 0.7; } }
    return [x, y];
  }

  /* ================================================================ introv1 */
  K.register({
    name: "atlas.introv1", tags: ["intro", "gancho", "apertura", "golpe", "mapa"], layer: "main", post: 0.5,
    mapDim: (p, b, lt) => (mapBg(p) ? lerp(0.25, 0.55, clamp((lt - 0.3) / 0.6)) : 0.6),
    summary: "GANCHO de apertura tipo golpe: la cámara se lanza del mundo entero hacia la región mientras los países de la historia se encienden en BLANCO en ráfaga (parpadeo de 8 cuadros cada uno, con alfileres chicos) y el titular condensado GIGANTE golpea palabra por palabra con sacudida ('^x^' en cian). Fondo adaptable: world (mapa), dark, image (src), component.",
    example: { text: "¿POR QUÉ CAYÓ\nEL ^MURO^?", kicker: "Berlín · 9 nov 1989", sub: "la noche que nadie vio venir", countries: ["Germany", "Poland", "Czechia", "Hungary", "Austria"], region: "europe" },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho (2–6 palabras). '\\n' = renglón; '^x^' = palabra en cian." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea chica debajo del titular." },
      countries: { type: "array", default: [], doc: "Países que se encienden en ráfaga (inglés)." },
      region: { type: "enum", options: Object.keys(A.REGIONS), default: "world", doc: "Hacia dónde se lanza la cámara (si no hay countries)." },
      wordAt: { type: "number", default: 0.45, doc: "Segundo del primer golpe." },
      stagger: { type: "number", default: 0.3, min: 0.08, doc: "Segundos entre palabras." },
      ...K.hook.bgParams(["world", "dark"]),
    },
    world(p) {
      const cs = lst(p.countries).map(A.country).filter(Boolean), ev = [];
      ev.push({ at: 0, cam: { pose: A.camFor(cs.length ? { countries: cs.map(c => c.name), pad: 1.4, minSpan: 30 } : { region: p.region }), fromPose: st => { const w = A.fitPose(st, A.regionBounds("world"), 1.02); return { ...w, s: w.s * 0.85 }; }, dur: 1.1, push: 0.02 } });
      cs.forEach((c, i) => { const at = 0.55 + i * Math.min(0.16, 1.4 / Math.max(1, cs.length)); ev.push({ at, paint: { c, m: 1 } }); ev.push({ at: at + 0.02, pin: { xy: c.xy, quiet: true } }); });
      return ev;
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette, c = ctx.stage.content;
      const ws = words(p.text), nL = Math.max(1, ...ws.map(w => w.line + 1));
      const lines = Array.from({ length: nL }, (_, i) => ws.filter(w => w.line === i));
      const longest = lines.map(l => l.map(w => w.w).join(" ")).reduce((a, s) => (s.length > a.length ? s : a), "");
      const fs = Math.min(A.fit(longest, "cond", W * (portrait ? 0.88 : 0.74), 1e9, 700), H * (portrait ? 0.14 : 0.24), c.h * 0.8 / (nL * 0.95));
      const lh = fs * 0.95, cy = c.y + c.h * 0.5, sp = A.measure(" ", "cond", fs, 700);
      const placed = [];
      let idx = 0;
      lines.forEach((l, li) => {
        const wd = l.map(w => A.measure(w.w, "cond", fs, 700)), tot = wd.reduce((a, b) => a + b, 0) + sp * (l.length - 1 - l.filter(w => w.glue).length);
        let x = W / 2 - tot / 2; const yb = cy + (li - (nL - 1) / 2) * lh + fs * 0.34;
        l.forEach((w, k) => { if (w.glue) x -= sp; placed.push({ ...w, x, yb, ww: wd[k], i: w.glue ? idx - 1 : idx++ }); x += wd[k] + sp; });
      });
      const hits = placed.map(w => p.wordAt + w.i * p.stagger + 0.1);
      const BG = K.hook.bg(ctx, p, { auto: "world", presets: presets(ctx.stage), tone });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, out = A.outA(lt, b, 0.5), [sx, sy] = shake(lt, hits, u * 1.0);
          G.save(); G.globalAlpha *= out; BG.render(lt, b); G.restore();
          /* titular: cada palabra cae escalando con desenfoque y queda; salida con desenfoque */
          G.save(); G.translate(sx, sy); G.textBaseline = "alphabetic"; G.font = A.font("cond", fs, 700);
          for (const w of placed) {
            const q = prog(lt, p.wordAt + w.i * p.stagger, 0.18, "linear"); if (q <= 0) continue;
            const e = ease.expoOut(q), s = 1 + 0.9 * (1 - e), bl = (1 - e) * fs * 0.06 + (1 - out) * u;
            const ccx = w.x + w.ww / 2, ccy = w.yb - fs * 0.34;
            G.save(); G.globalAlpha *= clamp(q * 3) * out; G.translate(ccx, ccy); G.scale(s, s); G.translate(-ccx, -ccy);
            if (bl > 0.4) G.filter = `blur(${bl.toFixed(1)}px)`;
            G.shadowColor = "rgba(0,0,0,.75)"; G.shadowBlur = fs * 0.16; G.fillStyle = w.acc ? P.accent : "#efefec"; G.fillText(w.w, w.x, w.yb);
            G.restore();
          }
          G.restore();
          const top = cy - nL * lh / 2 - u * 3.4, bot = cy + nL * lh / 2 + u * 4.4;
          if (p.kicker) A.kicker(ctx, p.kicker, prog(lt, 0.15, 0.35, "linear") * out, { y: top });
          if (p.sub) {
            const px = u * (portrait ? 3.1 : 2.5), a = prog(lt, hits[hits.length - 1] + 0.2, 0.45, "linear") * out;
            G.save(); G.globalAlpha *= a; G.font = A.font("cond", px, 400); G.letterSpacing = px * 0.06 + "px"; G.textAlign = "center";
            G.shadowColor = "#000"; G.shadowBlur = px * 0.7; G.fillStyle = "rgba(232,232,228,.9)"; G.fillText(String(p.sub).toUpperCase(), W / 2, bot); G.restore();
          }
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "atlas.introv2", tags: ["intro", "gancho", "pregunta", "revelación", "país"], layer: "main", post: 0.5,
    mapDim: (p, b, lt) => (mapBg(p) ? lerp(0.78, 0.12, prog(lt, p.revealAt - 0.15, 0.45, "inOut")) : 0.6),
    summary: "GANCHO pregunta + revelación: la pregunta se tipea letra a letra en condensada blanca sobre el mundo apagado; en revealAt el mapa se enciende, la pregunta sube y se achica, la cámara cae sobre el país, que parpadea en blanco, y cae el alfiler con la RESPUESTA como etiqueta. Fondo adaptable (world, dark, image, component).",
    example: { text: "¿DÓNDE CAYÓ\nEL MURO?", answer: "Berlín", country: "Germany", pin: [13.4, 52.52], kicker: "9 nov 1989", revealAt: 2.2 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta ('\\n' = renglón, '^x^' = cian)." },
      answer: { type: "string", default: "", doc: "Respuesta: etiqueta del alfiler (vacío = nombre del país)." },
      country: { type: "string", required: true, doc: "País de la revelación (inglés)." },
      pin: { type: "array", default: [], doc: "[lon,lat] del alfiler (ciudad)." },
      pinSrc: { type: "image", default: "", doc: "Foto dentro del sello del alfiler." },
      span: { type: "number", default: 0, min: 0, doc: "Ancho visible en grados al revelar (0 = automático)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      revealAt: { type: "number", default: 2.4, doc: "Segundo de la revelación (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.3, doc: "Segundo en que empieza el tipeo." },
      cps: { type: "number", default: 22, min: 4, doc: "Letras por segundo." },
      ...K.hook.bgParams(["world", "dark"]),
    },
    world(p) {
      const c = A.country(p.country), ev = [];
      ev.push({ at: 0, cam: { pose: st => { const w = A.fitPose(st, A.regionBounds("world"), 1.02); return { ...w, s: w.s * 0.9 }; }, dur: 0.1, push: 0.02 } });
      if (!c) return ev;
      const at = p.revealAt;
      ev.push({ at: at - 0.05, cam: { pose: A.camFor({ country: p.country, pin: p.pin?.length === 2 ? p.pin : null, span: p.span || null, shift: 0.2 }), dur: 1.0, push: 0.012 } });
      ev.push({ at: at + 0.86, paint: { c, m: 1 } });
      ev.push({ at: at + 0.9, pin: { xy: p.pin?.length === 2 ? A.toBase(p.pin) : c.xy, label: p.answer || c.es, src: p.pinSrc || null, labelSize: 4.8 } });
      return ev;
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette, c = ctx.stage.content;
      const Ls = String(p.text).split("\n").map(s => s.trim()).filter(Boolean), plain = Ls.map(s => s.replace(/\^/g, "").toUpperCase());
      const longest = plain.reduce((a, s) => (s.length > a.length ? s : a), "");
      const fs = Math.min(A.fit(longest, "cond", W * (portrait ? 0.86 : 0.66), 1e9, 700), H * (portrait ? 0.12 : 0.2));
      const total = plain.reduce((a, s) => a + s.length, 0), lh = fs * 0.95;
      const accSet = Ls.map(s => { const m = []; let acc = false, k = 0; for (const ch of s) { if (ch === "^") { acc = !acc; continue; } m[k++] = acc; } return m; });
      const BG = K.hook.bg(ctx, p, { auto: "world", presets: presets(ctx.stage), tone });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, out = A.outA(lt, b, 0.5);
          G.save(); G.globalAlpha *= out * (mapBg(p) ? 1 : 1 - 0.85 * prog(lt, p.revealAt, 0.5, "inOut")); BG.render(lt, b); G.restore();
          /* la pregunta: centro → sube y se achica al revelar */
          const rq = prog(lt, p.revealAt - 0.1, 0.55, "inOut");
          const s = lerp(1, 0.5, rq), cy0 = c.y + c.h * 0.48, cy1 = c.y + (portrait ? u * 4 : u * 3) + Ls.length * lh * 0.5 * 0.5;
          const cy = lerp(cy0, cy1, rq);
          let n = Math.floor(clamp((Math.floor(lt * 25) / 25 - p.typeAt) * p.cps, 0, total));
          G.save(); G.globalAlpha *= out; G.translate(W / 2, cy); G.scale(s, s);
          G.font = A.font("cond", fs, 700); G.textBaseline = "alphabetic"; G.textAlign = "left"; G.shadowColor = "rgba(0,0,0,.8)"; G.shadowBlur = fs * 0.18;
          plain.forEach((line, i) => {
            const k = Math.min(line.length, n); n -= k; if (k <= 0) return;
            const full = G.measureText(line).width, y = (i - (Ls.length - 1) / 2) * lh + fs * 0.34;
            let x = -full / 2;
            for (let j = 0; j < k; j++) { const ch = line[j], w = G.measureText(ch).width; G.fillStyle = accSet[i][j] ? P.accent : "#efefec"; G.fillText(ch, x, y); x += w; }
            if (k < line.length && Math.floor(lt * 4) % 2 === 0) { G.fillStyle = P.accent; G.fillRect(x + fs * 0.03, y - fs * 0.72, fs * 0.06, fs * 0.8); }
          });
          G.restore();
          if (p.kicker) A.kicker(ctx, p.kicker, prog(lt, 0.1, 0.35, "linear") * out * (1 - rq), { y: cy0 - Ls.length * lh / 2 - u * 3.4 });
        },
      };
    },
  });
})();

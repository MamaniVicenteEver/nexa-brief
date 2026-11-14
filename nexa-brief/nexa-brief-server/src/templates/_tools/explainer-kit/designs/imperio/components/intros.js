/* Imperio: A = titular sobre el mundo completo; B = titular y fotografía.
   El carmesí es editorial. Las banderas se reservan para las piezas geográficas.
   Mapa vectorial cacheado por instancia, sin teselas ni temporizadores propios. */
(function () {
  "use strict";
  const K = Kit, IM = Kit.imperio, { clamp, lerp, prog, ease } = K;
  const WHITE = "#f6f6f8", CRIMSON = "#a3122f", INK = "#0f1a24";

  /* ------------------------------------------------------------ texto */
  /** "¿POR QUÉ ^JAPÓN^\nMIRÓ AL SUR?" → renglones de palabras {w, acc} */
  function words(text) {
    return String(text ?? "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const out = []; let acc = false;
      for (const part of line.split("^")) { for (const w of part.split(/\s+/).filter(Boolean)) out.push({ w: w.toUpperCase(), acc }); acc = !acc; }
      return out;
    });
  }
  /** maqueta del titular: tamaño para que el renglón más ancho ocupe `width` */
  function layout(lines, width, maxFs) {
    const sp = 0.22, m = l => l.reduce((a, x, i) => a + IM.measure(x.w, IM.wordFont(100), 1) / 100 + (i ? sp : 0), 0);
    const em = Math.max(1, ...lines.map(m)), fs = Math.min(maxFs, width / em), lh = fs * 1.04;
    return { fs, lh, lines: lines.map(l => { let x = 0; const ws = l.map((it, i) => { if (i) x += sp * fs; const w = IM.measure(it.w, IM.wordFont(fs), fs * 0.01); const o = { s: it.w, acc: it.acc, x, w }; x += w; return o; }); return { ws, w: x }; }) };
  }
  /** kicker: barra carmesí + mayúsculas espaciadas */
  function kicker(G, txt, x, y, fs, a, align = "center", color = WHITE) {
    if (!txt || a <= 0.01) return;
    const s = String(txt).toUpperCase();
    G.save(); G.globalAlpha = a; G.font = `800 ${fs}px Montserrat`; G.letterSpacing = fs * 0.22 + "px"; G.textBaseline = "middle";
    const w = IM.measure(s, G.font, fs * 0.22), bw = fs * 1.6, gap = fs * 0.7, total = w + (bw + gap) * 2;
    const x0 = align === "center" ? x - total / 2 : x;
    G.fillStyle = CRIMSON; G.fillRect(x0, y - fs * 0.09, bw, fs * 0.18); G.fillRect(x0 + bw + gap * 2 + w, y - fs * 0.09, bw, fs * 0.18);
    G.shadowColor = "rgba(8,10,12,.75)"; G.shadowBlur = fs * 0.6; G.fillStyle = color; G.textAlign = "left"; G.fillText(s, x0 + bw + gap, y);
    G.restore();
  }
  /** sacudida amortiguada después de cada golpe (función de lt) */
  function shake(lt, hits, amp) {
    let x = 0, y = 0;
    for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.45) { const e = Math.exp(-d * 9) * amp; x += Math.sin(d * 71) * e; y += Math.cos(d * 53) * e * 0.7; } }
    return [x, y];
  }

  /* Mundo completo sin hornear el atlas: una imagen vectorial cacheada por tamaño.
     Usa la misma geografía y paleta de Imperio, también en la vista ligera del showcase. */
  function worldBackground(ctx) {
    const { W, H, portrait } = ctx.stage, world = IM.world(), image = document.createElement("canvas");
    image.width = Math.max(1, Math.round(W)); image.height = Math.max(1, Math.round(H));
    const g = image.getContext("2d");
    g.fillStyle = IM.COL.ocean; g.fillRect(0, 0, W, H);
    if (world.ok) {
      const y0 = H * (portrait ? 0.28 : 0.08), y1 = H * (portrait ? 0.66 : 0.92);
      const projection = d3.geoNaturalEarth1().fitExtent([[W * 0.025, y0], [W * 0.975, y1]], { type: "Sphere" });
      const path = d3.geoPath(projection, g);
      g.beginPath(); path(world.land); g.fillStyle = IM.COL.land; g.fill();
      g.beginPath(); path(world.fc); g.strokeStyle = IM.COL.coast; g.lineWidth = Math.max(0.65, W / 1500); g.stroke();
    }
    return {
      render(lt, beat) {
        const G = ctx.g.main, zoom = lerp(1.14, 1, prog(lt, 0, Math.min(2.2, beat.dur * 0.5), "out"));
        G.save(); G.translate(W / 2, H / 2); G.scale(zoom, zoom); G.drawImage(image, -W / 2, -H / 2, W, H); G.restore();
        // El mapa se atenúa al finalizar la despedida, sin ocultar los textos.
        const dim = 0.04 + 0.16 * prog(lt, beat.dur * 0.48, beat.dur * 0.36, "inOut");
        G.save(); G.fillStyle = `rgba(10,12,14,${dim})`; G.fillRect(0, 0, W, H); G.restore();
      },
      dispose() { image.width = image.height = 1; },
    };
  }


  /* ------------------------------------------------------------ fondos propios */
  const atlasBase = p => p.country ? IM.countryCam(p.country, 3.2, 0) : { lon: 30, lat: 32, span: 110, rot: 0 };
  const atlasKey = (base, n) => IM.zoomCam(base, 1 + 0.18 * (n + 0.5) / 3, 2 * (n + 0.5) / 3);
  const mapLook = p => ({ hatch: p.country ? [p.country] : [], gray: p.bg === "archivo" ? 1 : 0 });
  function mapWarm(p) {
    if (p.bg && !["auto", "atlas", "archivo"].includes(p.bg)) return [];
    const base = atlasBase(p);
    return [0, 1].map(n => ({ cam: atlasKey(base, n) }));
  }
  function presets(ctx, p) {
    const MC = IM.mapCache(ctx), st = ctx.stage;
    const base = atlasBase(p);
    const atlas = (gray, smoke) => (G, s, lt, b) => {
      const q = clamp(lt / Math.max(3, b.dur)), cam = IM.zoomCam(base, 1 + 0.18 * q, 2 * q), n = Math.floor(q * 3);
      const look = { hatch: p.country ? [p.country] : [], gray };
      /* Los fondos de intros y cierres también necesitan su próxima llave antes de usarla. */
      if (n < 3) IM.warmKey(ctx, atlasKey(base, n + 1), look);
      MC.draw(G, cam, atlasKey(base, n), `${gray}:${n}`, look);
      if (smoke) { IM.smoke(G, s, lt + b.t0, 0.9, s.portrait ? 0.45 : 0.6); IM.fx.grain = Math.max(IM.fx.grain, 0.2); IM.fx.vignette = Math.max(IM.fx.vignette, 0.85); }
    };
    return {
      atlas: atlas(0, false),
      archivo: atlas(1, true),
      papel: (G, s, lt) => {
        const T = IM.tex(); G.fillStyle = IM.COL.ocean; G.fillRect(0, 0, s.W, s.H);
        G.save(); const pat = G.createPattern(T.ocean, "repeat"); pat.setTransform(new DOMMatrix().translate(-lt * s.u * 0.6, 0).scale(Math.max(s.W, s.H) / 512 * 1.3));
        G.globalCompositeOperation = "soft-light"; G.fillStyle = pat; G.fillRect(0, 0, s.W, s.H); G.restore();
      },
      __free: () => MC.free(),
    };
  }
  /** oscurecido del centro para leer el texto blanco */
  function scrim(G, st, a) {
    if (a <= 0.01) return;
    const { W, H } = st, g = G.createRadialGradient(W / 2, H * 0.48, Math.min(W, H) * 0.1, W / 2, H * 0.48, Math.hypot(W, H) * 0.55);
    g.addColorStop(0, `rgba(10,12,14,${0.42 * a})`); g.addColorStop(1, `rgba(10,12,14,${0.12 * a})`);
    G.save(); G.fillStyle = g; G.fillRect(0, 0, W, H); G.restore();
  }
  const PRESETS = ["atlas", "archivo", "papel"];
  function background(ctx, p) {
    const pr = presets(ctx, p), free = pr.__free; delete pr.__free;
    const BG = K.hook.bg(ctx, p, { auto: "atlas", presets: pr, tone: () => IM.bw(ctx, p.src) });
    return { ...BG, mode: BG.mode, render: BG.render, dispose() { BG.dispose(); free(); } };
  }
  IM.hook = { words, layout, kicker, shake, presets, scrim, background, worldBackground, PRESETS, mapLook, mapWarm, COL: { WHITE, CRIMSON, INK } };

  /* ============================================================ introv1 · golpe */
  K.register({
    name: "imperio.introv1", tags: ["intro", "gancho", "apertura", "título", "mapa mundial"], layer: "main", post: 0.6, opaque: true,
    summary: "Apertura A de solo texto sobre el mapa del mundo completo, como el cierre v1, sin sol, rayos ni bandera. Titular blanco y palabra clave sobre carmesí; entrada por palabras. Foto/componente opcionales mediante bg explícito.",
    example: { text: "EL IMPERIO QUE\nMIRÓ AL ^SUR^", kicker: "Tokio · 1940", sub: "la doctrina que llevó a la guerra del Pacífico", country: "Japan" },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho (2–7 palabras). '\\n' = renglón; '^x^' = palabras sobre franja carmesí." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea chica en itálica debajo del titular." },
      country: { type: "string", default: "", doc: "Contexto del episodio; la apertura A mantiene el mundo completo sin bandera ni rayado." },
      sunAt: { type: "number", default: 0.15, doc: "Tiempo heredado de entrada; conservado por compatibilidad. La apertura A no dibuja un sol." },
      wordAt: { type: "number", default: 0.7, doc: "Segundo de la primera palabra." },
      stagger: { type: "number", default: 0.2, min: 0.06, doc: "Segundos entre palabras." },
      burstAt: { type: "number", default: 2.6, doc: "Impacto tipográfico suave (acepta '@palabra'; −1 = sin impacto), sin rayos ni bandera." },
      ...K.hook.bgParams(PRESETS),
      dim: { type: "number", default: 0.35, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente." },
    },
    mapLook: () => ({ hatch: [] }),
    mapWarm: p => !p.bg || ["auto", "atlas"].includes(p.bg) ? [] : mapWarm(p),
    create(ctx, p) {
      const st = ctx.stage, { W, H, u, portrait } = st, BG = !p.bg || ["auto", "atlas"].includes(p.bg) ? worldBackground(ctx) : background(ctx, p);
      const L = layout(words(p.text), W * (portrait ? 0.86 : 0.7), portrait ? H * 0.085 : H * 0.17);
      const blockH = L.lh * L.lines.length, cy = H * (portrait ? 0.56 : 0.58), top = cy - blockH / 2;
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main;
          BG.render(lt, b, t);
          scrim(G, st, 0.8);
          const [hx, hy] = shake(lt, p.burstAt >= 0 ? [p.burstAt] : [], u * 0.25);
          G.save(); G.translate(hx, hy);
          /* titular palabra por palabra */
          let k = 0;
          G.font = IM.wordFont(L.fs); G.letterSpacing = L.fs * 0.01 + "px"; G.textBaseline = "alphabetic"; G.textAlign = "left";
          L.lines.forEach((ln, li) => {
            const x0 = W / 2 - ln.w / 2, yb = top + L.lh * (li + 0.86);
            ln.ws.forEach(w => {
              const q = prog(lt, p.wordAt + k * p.stagger, 0.32, "linear"); k++;
              if (q <= 0) return;
              const e = ease.expoOut(q), s = 1 + 0.45 * (1 - e), cx = x0 + w.x + w.w / 2;
              G.save(); G.translate(cx, yb - L.fs * 0.4); G.scale(s, s); G.translate(-cx, -(yb - L.fs * 0.4));
              if (w.acc) { const pad = L.fs * 0.12; G.globalAlpha = clamp(q * 4); G.fillStyle = CRIMSON; G.fillRect(x0 + w.x - pad, yb - L.fs * 0.86, (w.w + pad * 2) * clamp(q * 2), L.fs * 0.98); }
              G.shadowColor = "rgba(10,12,14,.55)"; G.shadowBlur = L.fs * 0.1;
              for (let g = 2; g >= 0; g--) { G.globalAlpha = g ? 0.25 * (1 - e) / g : clamp(q * 4); G.fillStyle = WHITE; G.fillText(w.s, x0 + w.x, yb + g * L.fs * 0.09 * (1 - e)); }
              G.restore();
            });
          });
          G.restore();
          /* kicker y sub */
          kicker(G, p.kicker, W / 2, top - u * (portrait ? 4.5 : 4), u * (portrait ? 2.4 : 1.8), prog(lt, p.wordAt - 0.25, 0.4));
          if (p.sub) {
            const fs = u * (portrait ? 2.8 : 2.1), a = prog(lt, p.wordAt + k * p.stagger + 0.1, 0.5);
            G.save(); G.globalAlpha = a; G.font = `italic 500 ${fs}px Montserrat`; G.letterSpacing = fs * 0.08 + "px"; G.textAlign = "center"; G.textBaseline = "top";
            G.shadowColor = "rgba(8,10,12,.85)"; G.shadowBlur = fs * 0.6; G.fillStyle = "rgba(246,246,248,.92)"; G.fillText(p.sub, W / 2, top + blockH + u * 2, W * 0.9); G.restore();
          }

        },
      };
    },
  });
  /* ============================================================ introv2 · texto + foto */
  function photoWords(text, highlight) {
    let lines = words(text);
    if (!lines.some(line => line.some(word => word.acc))) {
      const all = lines.flat(), phrase = String(highlight || "").toUpperCase().trim().split(/\s+/).filter(Boolean);
      const start = phrase.length ? all.findIndex((word, i) => phrase.every((part, j) => all[i + j]?.w === part)) : -1;
      if (start >= 0) phrase.forEach((_, j) => { all[start + j].acc = true; });
      else {
        const chosen = [...all].reverse().find(word => word.w.length >= 4) || all[all.length - 1];
        if (chosen) chosen.acc = true;
      }
    }
    if (lines.length === 1 && lines[0].length > 2) {
      const all = lines[0], rows = Math.min(3, Math.ceil(all.length / 2.6)), widths = all.map(word => IM.measure(word.w, IM.wordFont(100), 1));
      // Pocas palabras: balancear por la anchura real de las letras, nunca estirarlas.
      const memo = new Map();
      const split = (from, count) => {
        const key = `${from}:${count}`;
        if (memo.has(key)) return memo.get(key);
        if (count === 1) return { score: widths.slice(from).reduce((a, b) => a + b + 22, 0) ** 2, lines: [all.slice(from)] };
        let best;
        for (let end = from + 1; end <= all.length - count + 1; end++) {
          // Una frase marcada se conserva junta si cabe en una sola fila.
          if (all[end - 1]?.acc && all[end]?.acc) continue;
          const next = split(end, count - 1), width = widths.slice(from, end).reduce((a, b) => a + b + 22, 0), score = width ** 2 + next.score;
          if (!best || score < best.score) best = { score, lines: [all.slice(from, end), ...next.lines] };
        }
        const result = best || { score: Infinity, lines: [all.slice(from)] };
        memo.set(key, result); return result;
      };
      lines = split(0, rows).lines;
    }
    return lines;
  }
  K.register({
    name: "imperio.introv2", tags: ["intro", "gancho", "apertura", "foto", "titular"], layer: "main", post: 0.6, opaque: true,
    summary: "Apertura B de texto e imagen: fotografía grande, titular blanco en campo oscuro y palabra clave sobre carmesí. En móvil la foto ocupa arriba y el titular abajo; en escritorio se distribuyen a ambos lados. Sin bandera ni rayos; foco y lado configurables.",
    example: { text: "LA NOCHE QUE\n^PARTIÓ BERLÍN^", kicker: "Berlín · 1961", src: "mauerbau.jpg", country: "Germany", imageSide: "right" },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho; '\\n' separa renglones y '^x^' destaca la palabra clave en carmesí." },
      highlight: { type: "string", default: "", doc: "Palabra o frase del titular que se destaca; si falta se conserva el marcado ^x^ o la última palabra sustantiva." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      stamp: { type: "string", default: "", doc: "Revelación secundaria opcional, dentro del campo de texto." },
      stampAt: { type: "number", default: 2.6, doc: "Segundo de la revelación (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.35, doc: "Segundo de entrada del titular." },
      cps: { type: "number", default: 18, min: 4, doc: "Velocidad de entrada del titular, conservada del contrato anterior." },
      country: { type: "string", default: "", doc: "País del episodio; no altera los colores de esta apertura editorial." },
      ...K.hook.bgParams(PRESETS),
      src: { type: "image", required: true, default: "", doc: "Fotografía documental real del tema. Obligatoria en la apertura B; evitar documentos llenos de texto o fotos de sujetos ajenos." },
      imageSide: { type: "enum", options: ["auto", "left", "right"], default: "right", doc: "Lado de la fotografía en escritorio; en móvil aparece siempre arriba." },
      dim: { type: "number", default: 0.2, min: 0, max: 1, doc: "Oscurecido suave de la fotografía sin perder al sujeto." },
    },
    mapLook: () => ({ hatch: [] }), mapWarm: () => [],
    create(ctx, p) {
      const st = ctx.stage, { W, H, u, portrait } = st, photoLeft = !portrait && p.imageSide === "left";
      const BG = p.src ? null : worldBackground(ctx);
      const frame = portrait ? { x: 0, y: 0, w: W, h: H * 0.60 } : { x: photoLeft ? 0 : W * 0.43, y: 0, w: W * 0.57, h: H };
      const cx = portrait ? W / 2 : W * (photoLeft ? 0.74 : 0.26), cy = H * (portrait ? 0.73 : 0.52);
      const L = layout(photoWords(p.text, p.highlight), W * (portrait ? 0.88 : 0.45), H * (portrait ? 0.077 : 0.16));
      const top = cy - L.lh * L.lines.length / 2;
      return {
        dispose() { BG?.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main;
          G.save(); G.fillStyle = INK; G.fillRect(0, 0, W, H); G.restore();
          const img = ctx.img(p.src);
          if (img) {
            G.save(); G.globalAlpha = prog(lt, 0, 0.38); G.filter = "saturate(.78) contrast(1.08)";
            K.hook.cover(G, img, frame.x, frame.y, frame.w, frame.h, p.focus || [0.5, 0.5], 1.015 + 0.045 * clamp(lt / Math.max(3, b.dur)));
            G.restore();
            const fade = portrait ? G.createLinearGradient(0, H * .35, 0, H * .61) : photoLeft ? G.createLinearGradient(W * .27, 0, W * .57, 0) : G.createLinearGradient(W * .43, 0, W * .73, 0);
            fade.addColorStop(0, photoLeft ? "rgba(15,26,36,0)" : portrait ? "rgba(15,26,36,0)" : INK);
            fade.addColorStop(1, photoLeft || portrait ? INK : "rgba(15,26,36,0)");
            G.save(); G.fillStyle = fade; G.fillRect(frame.x, frame.y, frame.w, frame.h); G.fillStyle = `rgba(10,12,14,${clamp(p.dim) * .6})`; G.fillRect(frame.x, frame.y, frame.w, frame.h); G.restore();
          } else if (BG) { BG.render(lt, b, t); scrim(G, st, 1); }
          kicker(G, p.kicker, cx, top - u * (portrait ? 5 : 4), u * (portrait ? 2.2 : 1.6), prog(lt, 0.05, .35));
          G.save(); G.font = IM.wordFont(L.fs); G.letterSpacing = L.fs * .01 + "px"; G.textBaseline = "alphabetic"; G.textAlign = "left";
          let k = 0;
          L.lines.forEach((line, li) => {
            const x = cx - line.w / 2, y = top + L.lh * (li + .86);
            line.ws.forEach(word => {
              const q = prog(lt, p.typeAt + k++ * Math.min(.13, 2 / p.cps), .38, "out");
              if (q <= 0) return;
              G.save(); G.globalAlpha = q; G.translate(0, (1 - q) * L.fs * .16);
              if (word.acc) { const pad = L.fs * .10; G.fillStyle = CRIMSON; G.fillRect(x + word.x - pad, y - L.fs * .86, word.w + pad * 2, L.fs * 1.0); }
              G.shadowColor = "rgba(8,10,12,.4)"; G.shadowBlur = u * .6; G.fillStyle = WHITE; G.fillText(word.s, x + word.x, y); G.restore();
            });
          });
          G.restore();
          if (p.stamp) {
            const fs = u * (portrait ? 3.0 : 2.3), y = Math.min(H * .94, top + L.lines.length * L.lh + u * 3);
            G.save(); G.globalAlpha = prog(lt, p.stampAt, .45); G.font = `800 ${fs}px Montserrat`; G.fillStyle = WHITE; G.textAlign = "center"; G.textBaseline = "top"; G.fillText(String(p.stamp).toUpperCase(), cx, y, W * (portrait ? .86 : .45)); G.restore();
          }
        },
      };
    },
  });
})();

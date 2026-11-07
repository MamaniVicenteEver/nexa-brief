/* =============================================================================
   atlas · título, cifra, comparación y foto sobre el mapa
   atlas.title    título de apertura sobre el mundo oscurecido (con alfileres que caen)
   atlas.stat     "82 COUNTRIES LISTENING": cifra + texto condensado sobre el mapa apagado
   atlas.compare  dos países encendidos con su cifra debajo (A vs B)
   atlas.photo    foto dentro de un alfiler gigante (o tarjeta clavada) en el lugar
   ========================================================================== */
(function () {
  const K = Kit, A = Kit.atlas, { clamp, lerp, prog, ease } = K;
  const lst = v => (Array.isArray(v) ? v : v ? [v] : []);

  /** renglones con acento '^x^' → [{ text, acc }] por renglón */
  function rich(text) {
    return String(text || "").split("\n").map(l => { const out = []; l.split("^").forEach((s, i) => { if (s) out.push({ text: s.toUpperCase(), acc: i % 2 === 1 }); }); return out; }).filter(l => l.length);
  }
  /** texto condensado grande centrado (PT Sans Narrow 700) con acento cian; q = 0..1 entrada */
  function bigText(ctx, lines, cx, cy, fs, o = {}) {
    const G = ctx.g.main, P = ctx.C.palette, lh = fs * (o.lh ?? 0.95), sp = (o.spacing ?? 0) * fs;
    G.save(); G.globalAlpha *= o.alpha ?? 1; G.textBaseline = "alphabetic"; G.font = A.font("cond", fs, 700); G.letterSpacing = sp + "px";
    if (o.blur > 0.3) G.filter = `blur(${o.blur.toFixed(1)}px)`;
    lines.forEach((l, i) => {
      const ws = l.map(s => G.measureText(s.text).width), tot = ws.reduce((a, b) => a + b, 0);
      let x = cx - tot / 2; const y = cy + (i - (lines.length - 1) / 2) * lh + fs * 0.34;
      l.forEach((s, k) => {
        G.shadowColor = "rgba(0,0,0,.7)"; G.shadowBlur = fs * 0.18;
        G.fillStyle = s.acc ? P.accent : (o.color || "#e6e6e3"); G.fillText(s.text, x, y); x += ws[k];
      });
    });
    G.restore();
  }
  const widest = (lines, fs, sp = 0) => Math.max(1, ...lines.map(l => A.measure(l.map(s => s.text).join(""), "cond", fs, 700, sp)));

  /* ================================================================ title */
  K.register({
    name: "atlas.title", tags: ["título", "apertura", "portada", "mundo"], layer: "main", post: 0.45,
    mapDim: p => p.dim,
    summary: "Título de apertura: el mapamundi 2.5D con la costa cian se acerca lento mientras caen alfileres chicos en los países de la historia; el titular condensado blanco GRANDE ('^x^' en cian) se asienta cerrando la interletra. Primer beat del video (t=0).",
    example: { text: "LA NOCHE QUE\nCAYÓ EL ^MURO^", textPortrait: "LA NOCHE\nQUE CAYÓ\nEL ^MURO^", kicker: "Berlín · 9 nov 1989", region: "europe", pins: ["Germany", "Hungary", "Czechia", "Poland"] },
    params: {
      text: { type: "string", required: true, doc: "Título ('\\n' = renglón, '^x^' = palabra en cian)." },
      textPortrait: { type: "string", default: "", doc: "Versión 9:16 (renglones más cortos)." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea chica debajo." },
      region: { type: "enum", options: Object.keys(A.REGIONS), default: "world", doc: "Hacia dónde se acerca la cámara." },
      pins: { type: "array", default: [], doc: "Países donde caen alfileres chicos (sin etiqueta)." },
      dim: { type: "number", default: 0.42, min: 0, max: 1, doc: "Oscurecido del mapa detrás del título." },
    },
    world(p, b) {
      const ev = [{ at: 0, cam: { pose: A.camFor({ region: p.region }), fromPose: st => { const w = A.fitPose(st, A.regionBounds("world"), 1.02); return { ...w, s: w.s * 0.92 }; }, dur: Math.max(2.5, b.dur * 0.95), push: 0.01 } }];
      lst(p.pins).forEach((n, i) => { const c = A.country(n); if (c) ev.push({ at: 0.6 + i * 0.22, pin: { xy: c.xy, quiet: true } }); });
      return ev;
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, c = ctx.stage.content;
      const lines = rich(portrait && p.textPortrait ? p.textPortrait : p.text);
      const fs = Math.min(100 * (portrait ? W * 0.86 : W * 0.66) / widest(lines, 100, 0.01), H * (portrait ? 0.12 : 0.2), (c.h * 0.8) / (lines.length * 0.95));
      const cy = portrait ? c.y + c.h * 0.48 : c.y + c.h * 0.5;
      return {
        render(lt, b) {
          const G = ctx.g.main, out = A.outA(lt, b, 0.4), q = prog(lt, 0, 0.7, "out");
          bigText(ctx, lines, W / 2, cy, fs * (1.04 - 0.04 * q), { alpha: (0.7 + 0.3 * q) * out, spacing: 0.06 * (1 - q), blur: (1 - out) * u * 1.2 });
          const top = cy - lines.length * fs * 0.95 / 2 - u * 3.2, bot = cy + lines.length * fs * 0.95 / 2 + u * 4.2;
          if (p.kicker) {
            const px = u * (portrait ? 2.6 : 2), s = String(p.kicker).toUpperCase();
            G.save(); G.globalAlpha *= prog(lt, 0.25, 0.4, "linear") * out; G.font = A.font("ui", px, 800); G.letterSpacing = px * 0.18 + "px";
            G.textAlign = "center"; G.textBaseline = "middle"; G.shadowColor = "#000"; G.shadowBlur = px; G.fillStyle = "#f2f2f0"; G.fillText(s, W / 2, top);
            const tw = G.measureText(s).width; G.shadowColor = "transparent"; G.fillStyle = ctx.C.palette.accent;
            G.fillRect(W / 2 - tw / 2 - px * 1.4, top - px * 0.08, px * 0.8, px * 0.16); G.fillRect(W / 2 + tw / 2 + px * 0.6, top - px * 0.08, px * 0.8, px * 0.16);
            G.restore();
          }
          if (p.sub) {
            const px = u * (portrait ? 3 : 2.4);
            G.save(); G.globalAlpha *= prog(lt, 0.6, 0.5, "linear") * out; G.font = A.font("cond", px, 400); G.letterSpacing = px * 0.06 + "px";
            G.textAlign = "center"; G.textBaseline = "middle"; G.shadowColor = "#000"; G.shadowBlur = px * 0.6; G.fillStyle = "rgba(230,230,226,.86)";
            G.fillText(String(p.sub).toUpperCase(), W / 2, bot); G.restore();
          }
        },
      };
    },
  });

  /* ================================================================ stat */
  K.register({
    name: "atlas.stat", tags: ["cifra", "dato", "número", "conteo", "impacto"], layer: "main", post: 0.6,
    mapDim: 0.92,
    summary: "Cierre de la referencia ('82 COUNTRIES LISTENING'): el mapa se apaga y desenfoca, y aparece una cifra con su texto en condensada blanca (la cifra cuenta hacia arriba si es número). Para el dato duro de la historia: víctimas, votos, años, países.",
    example: { value: "140", text: "muertos en el muro", kicker: "Berlín · 1961–1989" },
    params: {
      value: { type: "string", required: true, doc: "Cifra (si es número entero cuenta desde countFrom)." },
      text: { type: "string", default: "", doc: "Texto que acompaña ('países escuchando', 'muertos en el muro')." },
      kicker: { type: "string", default: "", doc: "Rótulo chico arriba." },
      layout: { type: "enum", options: ["auto", "inline", "stack"], default: "auto", doc: "inline = una línea como la referencia; stack = cifra gigante arriba y texto abajo." },
      countFrom: { type: "number", default: 0, doc: "Desde dónde cuenta." },
      countSec: { type: "number", default: 1.1, min: 0, doc: "Segundos del conteo (0 = sin conteo)." },
      accent: { type: "bool", default: false, doc: "Cifra en cian (si es EL dato del video)." },
      region: { type: "enum", options: ["", ...Object.keys(A.REGIONS)], default: "", doc: "Mover la cámara detrás (vacío = se queda donde estaba)." },
    },
    world(p) { return p.region ? [{ at: 0, cam: { pose: A.camFor({ region: p.region }), dur: 1.4, push: 0.01 } }] : []; },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, c = ctx.stage.content, P = ctx.C.palette;
      const val = String(p.value), num = /^\d+$/.test(val.replace(/[.,\s]/g, "")) ? +val.replace(/[.,\s]/g, "") : null;
      const text = String(p.text || "").toUpperCase();
      const inline = p.layout === "inline" || (p.layout === "auto" && !portrait && (val.length + text.length) <= 26);
      const fmt = n => { const s = String(Math.round(n)); return val.includes(".") || val.includes(",") || n >= 10000 ? s.replace(/\B(?=(\d{3})+(?!\d))/g, ".") : s; };
      let fsV, fsT;
      if (inline) { fsV = fsT = Math.min(100 * W * 0.6 / Math.max(1, A.measure(val + " " + text, "cond", 100, 700)), H * 0.12); }
      else {
        fsV = Math.min(100 * W * (portrait ? 0.62 : 0.4) / Math.max(1, A.measure(val, "cond", 100, 700)), H * (portrait ? 0.2 : 0.34));
        const lines = text.split("\n");
        fsT = Math.min(100 * W * (portrait ? 0.84 : 0.6) / Math.max(1, ...lines.map(l => A.measure(l, "cond", 100, 700))), fsV * 0.34);
      }
      const cy = c.y + c.h * 0.48;
      return {
        render(lt, b) {
          const G = ctx.g.main, out = A.outA(lt, b, 0.6), a = prog(lt, 0.15, 0.55, "linear") * out;
          if (a <= 0) return;
          const n = num != null && p.countSec > 0 ? lerp(p.countFrom, num, prog(lt, 0.2, p.countSec, "out")) : null, vs = n != null ? fmt(n) : val;
          G.save(); G.globalAlpha *= a; G.textBaseline = "alphabetic"; G.shadowColor = "rgba(0,0,0,.8)"; G.shadowBlur = u * 1.5;
          if (inline) {
            G.font = A.font("cond", fsV, 700); const full = G.measureText(val + " " + text).width, vw = G.measureText(val).width;
            const x0 = W / 2 - full / 2;
            G.textAlign = "right"; G.fillStyle = p.accent ? P.accent : "#d6d6d2"; G.fillText(vs, x0 + vw, cy + fsV * 0.34);
            G.textAlign = "left"; G.fillStyle = "#d6d6d2"; G.fillText(" " + text, x0 + vw, cy + fsV * 0.34);
          } else {
            G.textAlign = "center"; G.font = A.font("cond", fsV, 700); G.fillStyle = p.accent ? P.accent : "#e2e2de";
            const lines = text ? text.split("\n") : [], hT = lines.length * fsT * 1.0, yV = cy - hT / 2 + fsV * 0.32;
            G.fillText(vs, W / 2, yV);
            G.font = A.font("cond", fsT, 700); G.fillStyle = "#d6d6d2"; G.letterSpacing = fsT * 0.02 + "px";
            lines.forEach((l, i) => G.fillText(l, W / 2, yV + fsV * 0.12 + fsT * (1.0 + i)));
          }
          G.restore();
          if (p.kicker) A.kicker(ctx, p.kicker, a, { y: portrait ? c.y + u * 2 : c.y + u * 1.5 });
        },
      };
    },
  });

  /* ================================================================ compare */
  K.register({
    name: "atlas.compare", tags: ["comparación", "versus", "dos países", "dato"], layer: "main", post: 0.6,
    mapDim: 0.22,
    summary: "Dos países encendidos a la vez en el mapa, cada uno con su alfiler y su etiqueta, y abajo su cifra GRANDE en condensada blanca con un 'VS' cian en el medio. Para comparar dos países (población, votos, gasto, muertos, años).",
    example: { left: { country: "Germany", value: "83 M", sub: "habitantes" }, right: { country: "France", value: "68 M", sub: "habitantes" }, kicker: "Población · 2024" },
    params: {
      left: { type: "object", required: true, doc: "{ country, label?, value, sub?, pin?:[lon,lat] }" },
      right: { type: "object", required: true, doc: "{ country, label?, value, sub?, pin?:[lon,lat] }" },
      vs: { type: "string", default: "VS", doc: "Texto del medio." },
      kicker: { type: "string", default: "", doc: "Rótulo chico de cabecera." },
      zoom: { type: "number", default: 1, min: 0.2, max: 6, doc: "Multiplica el zoom." },
    },
    world(p) {
      const L = A.country(p.left?.country), R = A.country(p.right?.country), ev = [];
      if (!L || !R) return ev;
      ev.push({ at: 0, cam: { pose: A.camFor({ countries: [p.left.country, p.right.country], pad: 1.6, zoom: p.zoom, offset: [0, 0] }), dur: "auto", push: 0.01 } });
      [[L, p.left, 0.65], [R, p.right, 1.0]].forEach(([c, s, at]) => {
        ev.push({ at: at - 0.04, paint: { c, m: 1 } });
        ev.push({ at, pin: { xy: s.pin?.length === 2 ? A.toBase(s.pin) : c.xy, label: s.label === "-" ? "" : s.label || c.es, labelSize: 3.4, keepLabel: true } });
      });
      return ev;
    },
    create(ctx, p) {
      const { W, H, u, portrait } = ctx.stage, c = ctx.stage.content, P = ctx.C.palette;
      const sides = [p.left || {}, p.right || {}], y = c.y + c.h * (portrait ? 0.93 : 0.9);
      const fs = Math.min(u * (portrait ? 11 : 12), ...sides.map(s => 100 * W * 0.34 / Math.max(1, A.measure(String(s.value || ""), "cond", 100, 700))));
      return {
        render(lt, b) {
          const G = ctx.g.main, out = A.outA(lt, b, 0.5);
          sides.forEach((s, i) => {
            const a = prog(lt, 1.15 + i * 0.3, 0.35, "out") * out; if (a <= 0 || !s.value) return;
            const x = W * (i ? 0.73 : 0.27), dy = (1 - a) * u * 2;
            G.save(); G.globalAlpha *= a; G.textAlign = "center"; G.textBaseline = "alphabetic"; G.shadowColor = "rgba(0,0,0,.85)"; G.shadowBlur = u * 1.6;
            G.font = A.font("cond", fs, 700); G.fillStyle = "#f0f0ee"; G.fillText(String(s.value).toUpperCase(), x, y + dy);
            if (s.sub) { const sp = u * (portrait ? 2.4 : 1.9); G.font = A.font("ui", sp, 800); G.letterSpacing = sp * 0.12 + "px"; G.fillStyle = "rgba(230,230,226,.82)"; G.fillText(String(s.sub).toUpperCase(), x, y + dy + sp * 1.6); }
            G.restore();
          });
          const va = prog(lt, 1.5, 0.3, "out") * out;
          if (va > 0 && p.vs) {
            const px = fs * 0.42; G.save(); G.globalAlpha *= va; G.textAlign = "center"; G.font = A.font("label", px); G.fillStyle = P.accent;
            G.shadowColor = "rgba(0,0,0,.8)"; G.shadowBlur = u; G.fillText(p.vs, W / 2, y - fs * 0.3); G.restore();
          }
          A.kicker(ctx, p.kicker, prog(lt, 0.2, 0.4, "linear") * out);
        },
      };
    },
  });

  /* ================================================================ photo */
  K.register({
    name: "atlas.photo", tags: ["foto", "persona", "lugar", "retrato", "alfiler"], layer: "main", post: 0.6,
    mapDim: 0.3,
    summary: "Foto clavada en el mapa: un alfiler GIGANTE cae con rebote sobre el lugar con la foto dentro de su cabeza (B/N contrastado, como el sello de la referencia) o una tarjeta con borde blanco y puntero; nombre y rol al lado. Al salir se achica y queda un alfiler chico con la foto en el mapa. Para personas, lugares, documentos.",
    example: { src: "turing.jpg", country: "United Kingdom", pin: [-0.74, 52.0], name: "Alan Turing", role: "Bletchley Park · 1940" },
    params: {
      src: { type: "image", required: true, doc: "Foto." },
      focus: { type: "array", default: [0.5, 0.42], doc: "Punto de interés [x,y] (0..1) para el recorte." },
      country: { type: "string", default: "", doc: "País donde se clava (se enciende en blanco)." },
      pin: { type: "array", default: [], doc: "[lon,lat] exacto (ciudad); vacío = centro del país." },
      name: { type: "string", default: "", doc: "Nombre (grande)." },
      role: { type: "string", default: "", doc: "Rol / lugar / fecha (chico)." },
      frame: { type: "enum", options: ["pin", "card"], default: "pin", doc: "pin = foto dentro del alfiler gigante; card = tarjeta rectangular con puntero." },
      span: { type: "number", default: 26, min: 1, doc: "Ancho visible en grados detrás." },
      keep: { type: "bool", default: true, doc: "Deja un alfiler chico con la foto al salir." },
    },
    world(p, b) {
      const c = A.country(p.country), ev = [];
      const ll = p.pin?.length === 2 ? p.pin : c ? null : [0, 20];
      const xy = ll ? A.toBase(ll) : c.xy;
      ev.push({ at: 0, cam: { pose: st => { const ps = A.spanPose(st, xy, p.span); const fb = A.frameBox(st); ps.y -= (fb.h * (st.portrait ? 0.34 : 0.36)) / ps.s; return ps; }, dur: 0.8, push: 0.01 } });
      if (c) ev.push({ at: 0.5, paint: { c, m: 1 } });
      if (p.keep) ev.push({ at: b.dur + 0.35, pin: { xy, quiet: true, src: p.src, focus: p.focus } });
      return ev;
    },
    create(ctx, p) {
      const { W, H, u, portrait } = ctx.stage, c = ctx.stage.content, P = ctx.C.palette;
      const c0 = A.country(p.country), xy = p.pin?.length === 2 ? A.toBase(p.pin) : c0 ? c0.xy : A.toBase([0, 20]);
      const R = Math.min(portrait ? c.w * 0.3 : c.h * 0.27, c.h * 0.3);
      return {
        render(lt, b) {
          const G = ctx.g.main, img = ctx.img(p.src);
          const [tx, ty] = A.screen(ctx, xy);
          const ap = lt - 0.55; if (ap < 0) return;
          /* salida: se achica hacia el lugar (queda el alfiler chico del runtime) */
          const oq = clamp((lt - b.dur) / 0.5), so = lerp(1, 0.18, ease.inOut(oq)), ao = 1 - clamp((oq - 0.6) / 0.4);
          const qd = clamp(ap / 0.18), dy = -(1 - ease.out(qd)) * R * 1.4;
          const sc = (ap < 0.18 ? lerp(0.75, 1.08, qd) : 1 + 0.08 * Math.exp(-(ap - 0.18) * 10) * Math.cos((ap - 0.18) * 22)) * so;
          if (p.frame === "card") {
            const w = R * 2.5, h = R * 1.9, bx = tx - w / 2 * sc, by = ty + dy - (h + R * 0.55) * sc;
            G.save(); G.globalAlpha *= clamp(qd * 1.6) * ao;
            G.shadowColor = "rgba(0,0,0,.5)"; G.shadowBlur = u * 2; G.fillStyle = P.ink;
            G.beginPath(); G.rect(bx, by, w * sc, h * sc); G.moveTo(tx - R * 0.25 * sc, by + h * sc); G.lineTo(tx, ty + dy); G.lineTo(tx + R * 0.25 * sc, by + h * sc); G.fill();
            G.shadowColor = "transparent"; G.fillStyle = P.accentInk; G.fillRect(bx + u * 0.9 * sc, by + u * 0.9 * sc, (w - u * 1.8) * sc, (h - u * 1.8) * sc);
            const im = A.seal(img); if (im) { G.save(); G.beginPath(); G.rect(bx + u * 0.9 * sc, by + u * 0.9 * sc, (w - u * 1.8) * sc, (h - u * 1.8) * sc); G.clip(); Kit.hook.cover(G, im, bx + u * 0.9 * sc, by + u * 0.9 * sc, (w - u * 1.8) * sc, (h - u * 1.8) * sc, p.focus, 1 + lt * 0.01); G.restore(); }
            G.restore();
          } else {
            if (qd < 1) for (let k = 3; k >= 1; k--) A.pin(G, tx, ty + dy - k * R * 0.3 * (1 - qd), R * sc, { P, src: img, focus: p.focus, alpha: 0.15 * qd * ao });
            A.pin(G, tx, ty + dy, R * sc, { P, src: img, focus: p.focus, alpha: clamp(qd * 1.6) * ao });
          }
          /* nombre y rol: a la derecha de la cabeza (16:9) o arriba (9:16), blanco sobre el mapa atenuado */
          const la = prog(lt, 0.95, 0.3, "out") * (1 - clamp(oq * 2.5));
          if (la > 0 && (p.name || p.role)) {
            const hx = tx, hy = ty - R * 1.5 - (p.frame === "card" ? R * 0.4 : 0);
            const npx = u * (portrait ? 4.6 : 4.4), rpx = npx * 0.5;
            G.save(); G.globalAlpha *= la; G.textBaseline = "alphabetic"; G.shadowColor = "rgba(0,0,0,.85)"; G.shadowBlur = npx * 0.4;
            let x, y, align;
            if (portrait) { x = W / 2; y = Math.max(c.y + npx, hy - R * (p.frame === "card" ? 1.45 : 1.25) - rpx * 2.2); align = "center"; }
            else { x = hx + R * (p.frame === "card" ? 1.45 : 1.2) + (1 - la) * u * 3; y = hy; align = "left"; }
            const nfs = Math.min(npx, 100 * (portrait ? W * 0.86 : W - x - u * 4) / Math.max(1, A.measure(String(p.name), "label", 100)));
            G.textAlign = align; G.font = A.font("label", nfs); G.fillStyle = P.ink; G.fillText(String(p.name), x, y);
            if (p.role) { G.font = A.font("ui", rpx, 800); G.letterSpacing = rpx * 0.14 + "px"; G.fillStyle = "rgba(225,225,222,.85)"; G.fillText(String(p.role).toUpperCase(), x, y + rpx * 2.1); }
            G.shadowColor = "transparent"; G.fillStyle = P.accent;
            if (align === "left") G.fillRect(x, y + rpx * (p.role ? 3.0 : 0.9), u * 6 * la, Math.max(2, u * 0.35));
            G.restore();
          }
        },
      };
    },
  });
})();

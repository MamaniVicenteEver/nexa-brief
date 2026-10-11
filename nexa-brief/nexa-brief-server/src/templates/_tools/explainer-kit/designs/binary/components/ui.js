/* =============================================================================
   binary · componentes de INTERFAZ / DIAGRAMA
   -----------------------------------------------------------------------------
   Igual que shapes.js: points() da la estructura (hecha de glifos, entra con la
   transición del campo) y render() dibuja encima lo que tiene que leerse nítido
   (números, letras, rótulos) o lo que se mueve por su cuenta (barcos, rotores).
   Colores: siempre desde config.palette (ink, muted, accent, bg).
   ========================================================================== */
(function () {
  const K = Kit, B = Kit.binary, { clamp, lerp, prog, ease, hash } = K;
  const { cellOf, fadeIO, boxIn } = B;
  const MONO = "'JetBrains Mono', monospace", SERIF = "'Playfair Display', serif";
  const pal = ctx => ctx.C.palette;
  /** dígito/letra pseudoaleatorio estable para el instante k (el "giro" de una ranura) */
  const spinChar = (set, i, k) => set[hash(i * 7919 + k) % set.length];
  const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

  /* iconos extra que usan estos componentes (mismo formato que icons.js) */
  const drums = (() => { let d = "M8 16h84v68H8Z"; for (const y of [33, 50, 67]) for (const x of [24, 42, 60, 78]) d += ` M${x} ${y - 7}a7 7 0 1 0 .01 0Z M${x} ${y - 2.5}a2.5 2.5 0 1 0 .01 0Z`; return d; })();
  Object.assign(B.ICONS, {
    banknote: "M4 24h92v52H4Z M10 30v40h80V30Z M50 36a14 14 0 1 0 .01 0Z M16 36h12v5H16Z M72 59h12v5H72Z",
    flask: "M36 6h28v7h-5v25l26 45c3 6-1 11-8 11H23c-7 0-11-5-8-11l26-45V13h-5Z M46 13v27L33 62h34L54 40V13Z",
    crown: "M10 76 6 28l22 20L50 16l22 32 22-20-4 48Z M10 82h80v9H10Z",
    bombe: drums,
    soldier: "M50 8c-12 0-20 7-22 16h44C70 15 62 8 50 8Z M26 27h48v5H26Z M36 34h28c0 9-6 16-14 16s-14-7-14-16Z M22 94c0-20 12-34 28-34s28 14 28 34Z",
    wheat: "M49 96V40h2v56Z M50 10c5 6 5 14 0 20-5-6-5-14 0-20Z M50 30c8-2 14 2 16 9-8 2-14-2-16-9Z M50 30c-8-2-14 2-16 9 8 2 14-2 16-9Z M50 46c8-2 14 2 16 9-8 2-14-2-16-9Z M50 46c-8-2-14 2-16 9 8 2 14-2 16-9Z M50 62c8-2 14 2 16 9-8 2-14-2-16-9Z M50 62c-8-2-14 2-16 9 8 2 14-2 16-9Z",
    fuel: "M18 14h40v74H18Z M24 20v24h28V20Z M58 30h8l8 8v38c0 4 3 6 6 6s6-2 6-6V40h-5V30h-4v-4h9l4 6v44c0 8-5 12-10 12s-10-4-10-12V40l-6-5h-6Z",
  });

  /* ------------------------------------------------------------------ contador */
  K.register({
    name: "binary.counter", tags: ["número", "dato", "escala", "impacto"], layer: "main",
    summary: "Número que se arma dígito a dígito como una tragamonedas (slot) o que cuenta hasta su valor (count), entre dos reglas de glifos: cifras enormes, años, cantidades.",
    example: { value: "159.000.000.000.000.000.000", label: "COMBINACIONES", note: "21 CIFRAS", mode: "slot" },
    params: {
      value: { type: "string", required: true, doc: "Valor final tal como se lee ('159.000.000…', '2048', '1940')." },
      mode: { type: "enum", options: ["slot", "count"], default: "slot", doc: "slot = cada dígito gira y se fija de izquierda a derecha; count = cuenta numérica desde `from`." },
      from: { type: "number", default: 0, doc: "Valor inicial (solo mode=count)." },
      dur: { type: "number", default: 2.2, doc: "Segundos hasta fijar el último dígito." },
      label: { type: "string", default: "", doc: "Etiqueta blanca arriba." },
      note: { type: "string", default: "", doc: "Línea mono debajo (aparece al terminar)." },
      size: { type: "number", default: 0.92, min: 0.3, max: 1, doc: "Fracción del ancho del contenido." },
      morph: { type: "number", default: 0.8, doc: "Segundos de armado de las reglas." },
    },
    points(ctx, p) {
      const { u, cx, cy, content } = ctx.stage, w = content.w * p.size, h = numH(ctx, p) * (0.6 + 0.575 * numLines(ctx, p).length) / 1.175, out = [], r = K.rng(61), step = u * 0.7;
      for (const yy of [cy - h * 0.95, cy + h * 0.95]) for (let x = cx - w / 2; x <= cx + w / 2; x += step)
        for (let k = 0; k < 2; k++) out.push({ x: x + (r() - 0.5) * u * 0.3, y: yy + k * u * 0.7 * (yy < cy ? -1 : 1), a: k ? 0.3 : 0.8, s: 0, g: r() < .5 ? 0 : 1, o: Math.abs(x - cx) / w * 2 * 0.99 });
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: lt => clamp(lt / 0.7) + 1e-6,
    create(ctx, p) {
      const C = pal(ctx), str = String(p.value), digits = [...str].map((c, i) => ({ c, i, d: /\d/.test(c) }));
      const nd = digits.filter(x => x.d).length, target = +str.replace(/[^\d.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "") || 0;
      const sep = (str.match(/\d([.,\s])\d{3}/) || [])[1] || "";
      const fmt = v => { const s = String(Math.round(v)); return sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : s; };
      return { render(lt, b) {
        const { u, cx, cy } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.4, 0.45, p.morph * 0.5), h = numH(ctx, p);
        G.save(); G.font = `700 ${h}px ${MONO}`; G.textAlign = "center"; G.textBaseline = "middle";
        if (p.mode === "count") {
          const q = prog(lt, 0.2, p.dur, "out"); G.globalAlpha = a; G.fillStyle = q < 1 ? C.muted : C.ink;
          G.fillText(fmt(lerp(p.from, target, q)), cx, cy); if (q >= 1) { G.fillStyle = C.ink; G.fillText(fmt(target), cx, cy); }
        } else {
          /* slot: cada carácter con su propio x para que no "baile" al cambiar */
          const cw = G.measureText("0").width, lines = numLines(ctx, p), lh = h * 1.15;
          let k = 0, gi = 0;
          lines.forEach((ln, li) => {
            const x0 = cx - cw * ln.length / 2 + cw / 2, y = cy + (li - (lines.length - 1) / 2) * lh;
            [...ln].forEach((c, j) => {
              const ch = digits[gi++];
              const lockAt = 0.25 + (ch.d ? (k++ / Math.max(1, nd - 1)) * p.dur : 0), locked = lt >= lockAt || !ch.d;
              const txt = locked ? c : spinChar("0123456789", ch.i, Math.floor(lt / 0.055));
              G.globalAlpha = a * (locked ? 1 : 0.42); G.fillStyle = locked ? C.ink : C.muted;
              const pop = locked && ch.d ? 1 + 0.18 * (1 - prog(lt, lockAt, 0.25)) : 1;
              G.save(); G.translate(x0 + j * cw, y); G.scale(pop, pop); G.fillText(txt, 0, 0); G.restore();
            });
          });
        }
        G.restore();
        const done = prog(lt, 0.25 + p.dur, 0.5), hb = h * (0.6 + 0.575 * numLines(ctx, p).length) / 1.175;
        if (p.label) B.tag(G, p.label, cx, cy - hb * 0.95 - u * 3.4, { u, size: 1.6, alpha: a, bg: C.ink, color: C.bg });
        if (p.note) B.mono(G, p.note, cx, cy + hb * 0.95 + u * 3.6, { u, size: 1.6, weight: 700, color: C.ink, alpha: a * done, spacing: u * 0.3 });
      } };
    },
  });
  /** renglones del contador: en 9:16 un número largo se parte en el separador del medio */
  function numLines(ctx, p) {
    const str = String(p.value);
    if (!ctx.stage.portrait || str.length <= 13) return [str];
    const seps = [...str].map((c, i) => (/[.,\s]/.test(c) ? i : -1)).filter(i => i > 0);
    if (!seps.length) return [str];
    const mid = seps.reduce((a, b) => (Math.abs(b - str.length / 2) < Math.abs(a - str.length / 2) ? b : a));
    return [str.slice(0, mid + 1), str.slice(mid + 1)];
  }
  function numH(ctx, p) {
    const { content, u } = ctx.stage, lines = numLines(ctx, p), n = Math.max(...lines.map(l => l.length));
    return Math.min(content.w * p.size / (n * 0.6), content.h * 0.16 / lines.length * 1.4, u * 22);
  }

  /* ------------------------------------------------------------------ cifrado */
  K.register({
    name: "binary.cipher", tags: ["código", "cifrado", "letras", "criptografía"], layer: "main",
    summary: "Mensaje que se cifra letra por letra: texto claro arriba, columna de glifos que 'pasa por la máquina' y letra cifrada abajo en caja. Con mode='crib' muestra una frase conocida alineada bajo el cifrado (la llave).",
    example: { plain: "NADA QUE INFORMAR", label: "TEXTO CLARO → CIFRADO" },
    params: {
      plain: { type: "string", required: true, doc: "Texto en claro (mayúsculas, sin acentos mejor)." },
      cipher: { type: "string", default: "", doc: "Texto cifrado; vacío = sustitución sembrada que nunca cifra una letra como sí misma (como Enigma)." },
      mode: { type: "enum", options: ["encrypt", "crib"], default: "encrypt", doc: "encrypt = claro→cifrado; crib = cifrado arriba y la frase conocida abajo, resaltada." },
      stepSec: { type: "number", default: 0.14, doc: "Segundos entre letra y letra." },
      label: { type: "string", default: "", doc: "Etiqueta arriba." },
      morph: { type: "number", default: 0.7, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const L = cipherLayout(ctx, p), out = [], r = K.rng(71), n = L.cells.length;
      L.cells.forEach((c, k) => {
        if (c.space) return;
        for (let j = 0; j < 7; j++) { const f = (j + 0.5) / 7; out.push({ x: c.x + (r() - 0.5) * L.cw * 0.25, y: lerp(c.y0 + L.fs * 0.75, c.y1 - L.fs * 0.8, f), a: 0.35 + 0.5 * Math.sin(Math.PI * f), s: 0, g: r() < .5 ? 0 : 1, o: k / n }); }
      });
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: (lt, b, p) => clamp((lt - 0.3) / Math.max(0.3, (p.plain.length) * (p.stepSec || 0.14))) + 1e-6,
    create(ctx, p) {
      const C = pal(ctx);
      return { render(lt, b) {
        const { u, cx } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.4, 0.45, 0.2), L = cipherLayout(ctx, p);
        if (p.label) B.tag(G, p.label, cx, L.top - L.fs * 0.9 - u * 4.5, { u, size: 1.5, alpha: a, bg: C.ink, color: C.bg });
        G.save(); G.textAlign = "center"; G.textBaseline = "middle";
        L.cells.forEach((c, k) => {
          if (c.space) return;
          const t0 = 0.3 + k * p.stepSec, qa = prog(lt, t0, 0.15), qb = prog(lt, t0 + 0.35, 0.12);
          const topCh = p.mode === "crib" ? c.ci : c.pl, botCh = p.mode === "crib" ? c.pl : c.ci;
          G.font = `700 ${L.fs}px ${MONO}`; G.globalAlpha = a * qa; G.fillStyle = C.ink; G.fillText(topCh, c.x, c.y0);
          /* abajo: gira entre letras y se fija; en caja invertida */
          const fixed = lt >= t0 + 0.35, ch = fixed ? botCh : spinChar(ABC, k, Math.floor(lt / 0.05));
          const bw = L.cw * 0.86, bh = L.fs * 1.3;
          G.globalAlpha = a * (fixed ? 1 : 0.5 * prog(lt, t0, 0.1));
          if (p.mode === "crib") { G.strokeStyle = C.ink; G.lineWidth = Math.max(1, u * 0.12); G.strokeRect(c.x - bw / 2, c.y1 - bh / 2, bw, bh); G.fillStyle = C.ink; }
          else { G.fillStyle = C.ink; G.fillRect(c.x - bw / 2, c.y1 - bh / 2, bw, bh); G.fillStyle = C.bg; }
          G.fillText(ch, c.x, c.y1 + L.fs * 0.04);
          void qb;
        });
        G.restore();
      } };
    },
  });
  /** reparte las letras en renglones (sin cortar palabras) dentro del contenido */
  function cipherLayout(ctx, p) {
    const { content, portrait, u } = ctx.stage, maxCols = portrait ? 9 : 17;
    const plain = p.plain.toUpperCase(), cipher = (p.cipher || enigmaLike(plain, hash(plain))).toUpperCase();
    /* cada celda guarda su índice en el texto original: al partir renglones se pierde
       el espacio del corte y sin esto el cifrado quedaba corrido una letra */
    const rows = [[]]; let pos = 0;
    for (const word of plain.split(" ")) {
      const cur = rows[rows.length - 1], need = (cur.length ? cur.length + 1 : 0) + word.length;
      if (need > maxCols && cur.length) rows.push([]);
      const row = rows[rows.length - 1];
      if (row.length) row.push({ ch: " ", k: -1 });
      [...word].forEach((ch, j) => row.push({ ch, k: pos + j }));
      pos += word.length + 1;
    }
    const cols = Math.max(...rows.map(r => r.length)), cw = Math.min(content.w / cols, u * 10), fs = Math.min(cw * 0.78, u * 6.5);
    const rowH = fs * 4.6, total = rowH * rows.length, top = ctx.stage.cy - total / 2 + fs;
    const cells = [];
    rows.forEach((r, ri) => {
      const x0 = ctx.stage.cx - cw * r.length / 2 + cw / 2;
      r.forEach(({ ch, k }, ci) => { const space = ch === " "; cells.push({ x: x0 + ci * cw, y0: top + ri * rowH, y1: top + ri * rowH + fs * 3, pl: ch, ci: space ? " " : cipher[k] || "X", space }); });
    });
    return { cells, cw, fs, top };
  }
  /** sustitución determinista donde ninguna letra se cifra como sí misma (el defecto de Enigma) */
  function enigmaLike(s, seed) {
    const r = K.rng(seed); let i = 0;
    return [...s].map(ch => { if (!/[A-Z]/.test(ch)) return ch; let c; do { c = ABC[Math.floor(r() * 26)]; } while (c === ch); i++; return c; }).join("");
  }

  /* ------------------------------------------------------------------ rotores */
  K.register({
    name: "binary.rotors", tags: ["máquina", "engranaje", "mecanismo", "combinaciones"], layer: "main",
    summary: "Rotores/tambores de glifos que giran a distinto ritmo: con pocos (1-5) muestran el abecedario y la letra activa en una ventana (Enigma); con muchos (6-120) forman una batería de tambores girando a la vez (la Bomba).",
    example: { count: 3, tags: ["I", "II", "III"], label: "ROTORES" },
    params: {
      count: { type: "number", default: 3, min: 1, max: 120, doc: "Cantidad de rotores." },
      speed: { type: "number", default: 4, doc: "Pasos por segundo del rotor más rápido." },
      tags: { type: "array", default: [], doc: "Rótulo bajo cada rotor (solo con pocos rotores)." },
      label: { type: "string", default: "", doc: "Etiqueta arriba." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const L = rotorLayout(ctx, p), out = [], r = K.rng(81), u = ctx.stage.u;
      const per = Math.max(10, Math.floor((ctx.family.binary.N * 0.85) / L.items.length));
      L.items.forEach(({ x, y }, k) => {
        const rings = L.big ? [[1, 0.9], [0.78, 0.35], [0.3, 0.7]] : [[1, 0.85], [0.45, 0.5]];
        const circ = rings.reduce((s, [f]) => s + f, 0);
        for (const [f, al] of rings) {
          const n = Math.max(8, Math.min(Math.floor(per * f / circ), Math.floor(2 * Math.PI * L.R * f / (u * 0.55))));
          for (let i = 0; i < n; i++) { const th = i / n * Math.PI * 2; out.push({ x: x + Math.cos(th) * L.R * f, y: y + Math.sin(th) * L.R * f, a: al * (0.7 + 0.3 * r()), s: f === 1 ? 1 : 0, g: r() < .5 ? 0 : 1, o: k / L.items.length }); }
        }
      });
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: (lt, b, p) => clamp(lt / (p.count > 5 ? 1.6 : 0.4)) + 1e-6,
    create(ctx, p) {
      const C = pal(ctx);
      return { render(lt, b) {
        const { u, cx } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.6, 0.45, p.morph * 0.4), L = rotorLayout(ctx, p);
        if (p.label) B.tag(G, p.label, cx, L.top - u * 4, { u, size: 1.5, alpha: a, bg: C.ink, color: C.bg });
        L.items.forEach(({ x, y }, k) => {
          /* rotor k avanza a pasos (mecánico): rápido el de la derecha, más lento hacia la izquierda */
          const rate = L.big ? p.speed / Math.pow(2.2, L.items.length - 1 - k) : p.speed * (0.35 + 0.65 * ((hash(k) % 100) / 100));
          const s = Math.max(0, lt - 0.5) * rate, step = Math.floor(s) + ease.out(clamp((s % 1) / 0.35));
          const rot = -step * Math.PI * 2 / 26, rev = clamp((lt - (L.big ? 0.1 : k / L.items.length * 1.4)) / 0.4);
          G.save(); G.globalAlpha = a * rev; G.textAlign = "center"; G.textBaseline = "middle";
          if (L.big) {
            G.font = `600 ${L.R * 0.13}px ${MONO}`;
            for (let i = 0; i < 26; i++) {
              const th = -Math.PI / 2 + i * Math.PI * 2 / 26 + rot, near = Math.cos(th + Math.PI / 2);
              G.fillStyle = C.ink; G.globalAlpha = a * rev * (0.25 + 0.75 * Math.max(0, near) ** 3);
              G.fillText(ABC[i], x + Math.cos(th) * L.R * 0.89, y + Math.sin(th) * L.R * 0.89);
            }
            /* ventana: la letra que está arriba */
            const cur = ABC[((Math.round(step) % 26) + 26) % 26], bw = L.R * 0.34;
            G.globalAlpha = a * rev; G.fillStyle = C.ink; G.fillRect(x - bw / 2, y - L.R * 1.32 - bw / 2, bw, bw);
            G.fillStyle = C.bg; G.font = `800 ${bw * 0.62}px ${MONO}`; G.fillText(cur, x, y - L.R * 1.32 + bw * 0.03);
            G.strokeStyle = C.ink; G.lineWidth = Math.max(1, u * 0.15); G.beginPath(); G.moveTo(x, y - L.R * 1.32 + bw / 2); G.lineTo(x, y - L.R * 1.04); G.stroke();
            if (p.tags[k]) B.mono(G, p.tags[k], x, y + L.R * 1.3, { u, size: 1.8, weight: 700, color: C.ink, alpha: a * rev, spacing: u * 0.3 });
          } else {
            /* tambor chico: marca radial que gira + letra actual en el centro */
            const th = -Math.PI / 2 - rot; G.strokeStyle = C.ink; G.lineWidth = Math.max(1, L.R * 0.09); G.lineCap = "round";
            G.beginPath(); G.moveTo(x + Math.cos(th) * L.R * 0.5, y + Math.sin(th) * L.R * 0.5); G.lineTo(x + Math.cos(th) * L.R * 0.95, y + Math.sin(th) * L.R * 0.95); G.stroke();
            if (L.R > u * 2.2) { G.fillStyle = C.ink; G.font = `700 ${L.R * 0.5}px ${MONO}`; G.fillText(ABC[((Math.round(step) % 26) + 26) % 26], x, y + L.R * 0.03); }
          }
          G.restore();
        });
      } };
    },
  });
  function rotorLayout(ctx, p) {
    const c = ctx.stage.content, n = Math.round(p.count), big = n <= 5;
    let cols, rows;
    if (big) { cols = ctx.stage.portrait && n > 3 ? Math.ceil(n / 2) : n; rows = Math.ceil(n / cols); }
    else { cols = Math.max(1, Math.round(Math.sqrt(n * c.w / c.h))); rows = Math.ceil(n / cols); }
    const cw = c.w / cols, ch = (c.h * (big ? 0.7 : 0.86)) / rows, R = Math.min(cw, ch) * (big ? 0.36 : 0.42);
    const top = ctx.stage.cy - ch * rows / 2, items = [];
    for (let k = 0; k < n; k++) { const col = k % cols, row = Math.floor(k / cols), inRow = Math.min(cols, n - row * cols); items.push({ x: ctx.stage.cx + (col - (inRow - 1) / 2) * cw, y: top + (row + 0.5) * ch + (big ? R * 0.25 : 0) }); }
    return { items, R, big, top: top - (big ? R * 0.2 : 0) };
  }

  /* ------------------------------------------------------------------ línea de tiempo */
  K.register({
    name: "binary.timeline", tags: ["tiempo", "fechas", "historia", "cronología"], layer: "main",
    summary: "Línea de tiempo de glifos (vertical en 9:16, horizontal en 16:9) con hitos que aparecen al pasar el trazo; el hito `active` queda resaltado con caja y pulso.",
    example: { items: [{ year: "1936", label: "MÁQUINA UNIVERSAL" }, { year: "1940", label: "LA BOMBA" }, { year: "1950", label: "¿PUEDEN PENSAR?" }, { year: "1954", label: "MUERE" }], active: 2 },
    params: {
      items: { type: "array", required: true, doc: "[{year, label}] de 2 a 7 hitos, en orden." },
      active: { type: "number", default: -1, doc: "Índice resaltado (-1 = ninguno)." },
      drawSec: { type: "number", default: 1.8, doc: "Segundos que tarda en recorrerse la línea." },
      label: { type: "string", default: "", doc: "Etiqueta arriba." },
      morph: { type: "number", default: 0.8, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const L = tlLayout(ctx, p), out = [], r = K.rng(91), u = ctx.stage.u, len = Math.hypot(L.x1 - L.x0, L.y1 - L.y0), n = Math.floor(len / (u * 0.5));
      for (let i = 0; i < n; i++) { const f = i / n, j = (r() - 0.5) * u * 0.5; out.push({ x: lerp(L.x0, L.x1, f) + (L.vertical ? j : 0), y: lerp(L.y0, L.y1, f) + (L.vertical ? 0 : j), a: 0.55 + 0.3 * r(), s: 0, g: r() < .5 ? 0 : 1, o: f }); }
      L.pts.forEach(({ x, y, f }, k) => {
        const R = k === p.active ? u * 2.6 : u * 1.5;
        for (let i = 0; i < 70; i++) { const rr = Math.sqrt(r()) * R, th = r() * 7; out.push({ x: x + Math.cos(th) * rr, y: y + Math.sin(th) * rr, a: 0.6 + 0.4 * r(), s: k === p.active ? 1 : 0, g: r() < .5 ? 0 : 1, o: f, grp: k === p.active ? 1 : 0 }); }
      });
      out.sort((a, b) => a.o - b.o);
      return B.pack(out, ctx.family.binary.N);
    },
    reveal: (lt, b, p) => clamp((lt - 0.2) / (p.drawSec || 1.8)) + 1e-6,
    groupAlpha: (lt, b, p) => (p && p.active >= 0 ? [1 - 0.45 * prog(lt, 0.2 + (p.drawSec || 1.8), 0.6), 1] : null),
    create(ctx, p) {
      const C = pal(ctx);
      return { render(lt, b) {
        const { u, cx } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.4), L = tlLayout(ctx, p), head = clamp((lt - 0.2) / p.drawSec);
        if (p.label) B.tag(G, p.label, cx, L.top - u * 4.5, { u, size: 1.5, alpha: a, bg: C.ink, color: C.bg });
        L.pts.forEach(({ x, y, f, side }, k) => {
          const q = prog(lt, 0.2 + f * p.drawSec, 0.45), act = k === p.active;
          if (q <= 0) return;
          /* 9:16: eje al centro y rótulos alternados a izquierda/derecha; 16:9: arriba/abajo */
          const tx = L.vertical ? x + side * u * 5 : x, ty = L.vertical ? y : y + side * u * 6.5, al = L.vertical ? (side > 0 ? "left" : "right") : "center", zs = L.vertical ? 1.5 : 1;
          G.save(); G.globalAlpha = a * q * (p.active >= 0 && !act ? 0.55 : 1); G.fillStyle = C.ink; G.textAlign = al; G.textBaseline = "middle";
          G.font = `${act ? 700 : 400} ${u * (act ? 4.4 : 3.4) * zs}px ${SERIF}`; G.fillText(item(p, k).year, tx, ty - (L.vertical ? u * 2.4 : side * u * 1.2));
          G.restore();
          const lab = item(p, k).label;
          if (lab) {
            if (act) B.tag(G, lab, tx, ty + (L.vertical ? u * 3.6 : side * u * 2.4), { u, size: 1.35 * zs, align: al, alpha: a * q, bg: C.ink, color: C.bg });
            else B.mono(G, lab, tx, ty + (L.vertical ? u * 3.6 : side * u * 2.4), { u, size: 1.25 * zs, align: al, alpha: a * q * 0.75, color: C.ink, spacing: u * 0.15 });
          }
          if (act && q >= 1) { const ph = ((lt - 0.2 - f * p.drawSec) % 1.4) / 1.4; B.ring(G, x, y, u * (2.8 + ph * 5), { color: C.ink, width: Math.max(1, u * 0.12), alpha: a * (1 - ph) * 0.8 }); }
        });
        /* cabeza del trazo */
        if (head > 0 && head < 1) { const x = lerp(L.x0, L.x1, head), y = lerp(L.y0, L.y1, head); G.save(); G.globalAlpha = a; G.fillStyle = C.ink; G.shadowColor = C.ink; G.shadowBlur = u * 2; G.beginPath(); G.arc(x, y, u * 0.7, 0, 7); G.fill(); G.restore(); }
      } };
    },
  });
  const item = (p, k) => (typeof p.items[k] === "string" ? { year: p.items[k], label: "" } : p.items[k]);
  function tlLayout(ctx, p) {
    const c = ctx.stage.content, n = p.items.length, vertical = ctx.stage.portrait;
    const x0 = vertical ? ctx.stage.cx : c.x + c.w * 0.04, x1 = vertical ? x0 : c.x + c.w * 0.96;
    const y0 = vertical ? c.y + c.h * 0.06 : ctx.stage.cy, y1 = vertical ? c.y + c.h * 0.94 : y0;
    const pts = p.items.map((_, k) => { const f = n === 1 ? 0.5 : 0.06 + k / (n - 1) * 0.88; return { x: lerp(x0, x1, f), y: lerp(y0, y1, f), f, side: k % 2 ? 1 : -1 }; });
    return { x0, y0, x1, y1, pts, vertical, top: vertical ? y0 : y0 - ctx.stage.u * 10 };
  }

  /* ------------------------------------------------------------------ versus */
  K.register({
    name: "binary.versus", tags: ["comparación", "dilema", "pregunta", "elección"], layer: "main",
    summary: "Dos formas enfrentadas (persona ↔ máquina, prisión ↔ tratamiento) con un símbolo en el medio ('?', 'VS', '='); lado a lado en 16:9, una sobre otra en 9:16. `pick` resalta la elegida.",
    example: { left: { icon: "person", label: "PERSONA" }, right: { icon: "chip", label: "MÁQUINA" }, mid: "?" },
    params: {
      left: { type: "object", required: true, doc: "{icon, label} — primera opción." },
      right: { type: "object", required: true, doc: "{icon, label} — segunda opción." },
      mid: { type: "string", default: "?", doc: "Símbolo central (1-3 caracteres)." },
      pick: { type: "enum", options: ["none", "left", "right"], default: "none", doc: "Resalta una opción (la otra se apaga) a los `pickAt` s." },
      pickAt: { type: "number", default: 1.8, doc: "Segundo (local) en que se resalta la elegida." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const L = vsLayout(ctx), out = [];
      [p.left, p.right].forEach((side, k) => {
        for (const q of B.sampleShape((g, w, h) => B.drawIcon(g, side.icon, w, h), L.boxes[k], { cell: cellOf(ctx, 0.9), edge: true, seed: k + 1 })) { q.grp = k; out.push(q); }
      });
      return B.pack(out, ctx.family.binary.N);
    },
    /* la opción no elegida se apaga dentro del propio campo (sin velos encima) */
    groupAlpha(lt, b, p) {
      if (!p || p.pick === "none") return null;
      const k = 1 - 0.8 * prog(lt, p.pickAt, 0.6);
      return p.pick === "left" ? [1, k] : [k, 1];
    },
    create(ctx, p) {
      const C = pal(ctx), L = vsLayout(ctx);
      return { render(lt, b) {
        const { u } = ctx.stage, G = ctx.g.top, a = fadeIO(lt, b.dur, 0.6, 0.45, p.morph * 0.5);
        const pk = p.pick === "none" ? 0 : prog(lt, p.pickAt, 0.5);
        [p.left, p.right].forEach((side, k) => {
          const bx = L.boxes[k], chosen = (p.pick === "left" && k === 0) || (p.pick === "right" && k === 1);
          const dim = p.pick === "none" || chosen ? 1 : 1 - pk * 0.75;
          const lx = bx.x + bx.w / 2, ly = bx.y + bx.h + u * 3.2;
          if (!side.label) return;
          if (chosen && pk > 0) B.tag(G, side.label, lx, ly, { u, size: 1.6, alpha: a, bg: C.ink, color: C.bg });
          else B.mono(G, side.label, lx, ly, { u, size: 1.6, weight: 700, color: C.ink, alpha: a * dim, spacing: u * 0.3 });
        });
        G.save(); G.globalAlpha = a * (1 - pk * 0.6); G.fillStyle = C.ink; G.textAlign = "center"; G.textBaseline = "middle";
        G.font = `400 ${u * (p.mid.length > 1 ? 6 : 10)}px ${SERIF}`; G.fillText(p.mid, L.mx, L.my); G.restore();
      } };
    },
  });
  function vsLayout(ctx) {
    const c = ctx.stage.content, port = ctx.stage.portrait, u = ctx.stage.u;
    if (port) { const s = Math.min(c.w * 0.6, c.h * 0.36); return { boxes: [{ x: ctx.stage.cx - s / 2, y: c.y + u * 1, w: s, h: s }, { x: ctx.stage.cx - s / 2, y: c.y + c.h - s - u * 4, w: s, h: s }], mx: ctx.stage.cx, my: c.y + c.h / 2 - u * 1 }; }
    const s = Math.min(c.w * 0.34, c.h * 0.7); return { boxes: [{ x: c.x + c.w * 0.04, y: ctx.stage.cy - s / 2 - u * 2, w: s, h: s }, { x: c.x + c.w * 0.96 - s, y: ctx.stage.cy - s / 2 - u * 2, w: s, h: s }], mx: ctx.stage.cx, my: ctx.stage.cy - u * 2 };
  }

  /* ------------------------------------------------------------------ convoy */
  K.register({
    name: "binary.convoy", tags: ["guerra", "mar", "barcos", "rutas", "amenaza"], layer: "main",
    summary: "Mar de glifos visto desde arriba con un convoy de barcos que cruza y submarinos al acecho. mode: attack (un barco se hunde), reroute (el convoy cambia de rumbo a tiempo), hunt (los submarinos quedan marcados y desaparecen).",
    example: { mode: "reroute", ships: 5, subs: 3, label: "ATLÁNTICO NORTE" },
    params: {
      mode: { type: "enum", options: ["attack", "reroute", "hunt"], default: "attack", doc: "Qué pasa en la escena." },
      ships: { type: "number", default: 5, min: 1, max: 9, doc: "Barcos del convoy." },
      subs: { type: "number", default: 3, min: 0, max: 6, doc: "Submarinos." },
      label: { type: "string", default: "", doc: "Etiqueta arriba (lugar)." },
      tag: { type: "string", default: "", doc: "Rótulo del desenlace (aparece a los 2.4 s): 'HUNDIDO', 'RUTA NUEVA', 'CAZADOS'." },
      morph: { type: "number", default: 1.0, doc: "Segundos de armado." },
    },
    points(ctx, p) {
      const c = ctx.stage.content, u = ctx.stage.u, out = [], r = K.rng(101), rowH = u * 2.6, step = u * 1.35;
      for (let y = c.y; y <= c.y + c.h; y += rowH) for (let x = c.x; x <= c.x + c.w; x += step) {
        const w = Math.sin(x * 0.012 + y * 0.03) * 0.5 + 0.5; if (r() < 0.3) continue;
        const edge = Math.min(1, (x - c.x) / (c.w * 0.12), (c.x + c.w - x) / (c.w * 0.12), (y - c.y) / (c.h * 0.1), (c.y + c.h - y) / (c.h * 0.1));
        out.push({ x: x + (r() - 0.5) * u * 0.4, y: y + Math.sin(x * 0.02) * u * 0.6, a: (0.12 + 0.3 * w) * clamp(edge), s: 0, g: w > 0.82 ? (r() < .5 ? 0 : 1) : 2 });
      }
      return B.pack(out, ctx.family.binary.N);
    },
    motion: lt => ({ x: 0, y: 0, s: 1 + lt * 0.004 }),
    create(ctx, p) {
      const C = pal(ctx), u = ctx.stage.u, c = ctx.stage.content, port = ctx.stage.portrait;
      const S = Math.min(c.w, c.h) * (port ? 0.15 : 0.11), sample = icon => B.sampleShape((g, w, h) => B.drawIcon(g, icon, w, h), { x: -S / 2, y: -S / 2, w: S, h: S }, { cell: u * 0.62, edge: true, jitter: 0.3, res: 140 });
      const shipPts = sample("ship"), subPts = sample("submarine").map(q => ({ ...q, a: q.a * 0.8 }));
      const laneY = c.y + c.h * (port ? 0.42 : 0.45), r = K.rng(hash(p.mode) + 3);
      const ships = Array.from({ length: p.ships }, (_, k) => ({ dx: -k * S * 1.15 - (k % 2) * S * 0.3, dy: ((k % 3) - 1) * S * 0.75 }));
      const subs = Array.from({ length: p.subs }, (_, k) => ({ x: c.x + c.w * (0.45 + 0.4 * r()), y: laneY + (k % 2 ? 1 : -1) * c.h * (0.2 + 0.15 * r()) }));
      return { render(lt, b) {
        const G = ctx.g.top, a = fadeIO(lt, b.dur, 0.8), head = c.x + c.w * 0.1 + lt * c.w * 0.1;
        const bend = p.mode === "reroute" ? ease.inOut(clamp((lt - 1.4) / 1.6)) : 0;
        if (p.label) B.tag(G, p.label, ctx.stage.cx, c.y + u * 2, { u, size: 1.4, alpha: a, bg: C.ink, color: C.bg });
        /* ruta: la original punteada; en reroute, la nueva se curva lejos de los submarinos */
        G.save(); G.globalAlpha = a * 0.35; G.strokeStyle = C.ink; G.lineWidth = Math.max(1, u * 0.12); G.setLineDash([u * 0.5, u * 0.8]);
        G.beginPath(); G.moveTo(c.x, laneY); G.lineTo(c.x + c.w, laneY); G.stroke();
        if (bend > 0) { G.globalAlpha = a * 0.9 * bend; G.setLineDash([]); G.beginPath(); G.moveTo(head, laneY); G.bezierCurveTo(head + c.w * 0.2, laneY, head + c.w * 0.25, laneY - c.h * 0.32, c.x + c.w, laneY - c.h * 0.36); G.stroke(); }
        G.restore();
        subs.forEach((s, k) => {
          const hunted = p.mode === "hunt" ? prog(lt, 1.2 + k * 0.5, 0.6) : 0;
          const approach = p.mode === "attack" ? clamp(lt / 2.2) : 0, sx = lerp(s.x, head + S, approach * 0.6), sy = lerp(s.y, laneY, approach * 0.5);
          B.drawPts(G, subPts, sx, sy, { alpha: a * (1 - hunted * 0.9) }, ctx);
          if (p.mode === "hunt" && hunted > 0) { B.ring(G, sx, sy, S * (0.9 - 0.3 * hunted), { color: C.ink, width: Math.max(1, u * 0.18), alpha: a }); G.save(); G.globalAlpha = a; G.strokeStyle = C.ink; G.lineWidth = Math.max(1, u * 0.15); G.beginPath(); G.moveTo(sx - S, sy); G.lineTo(sx + S, sy); G.moveTo(sx, sy - S); G.lineTo(sx, sy + S); G.stroke(); G.restore(); }
        });
        ships.forEach((sh, k) => {
          let x = head + sh.dx, y = laneY + sh.dy;
          if (bend > 0 && x > head - S * 6) { const f = clamp((x - head + S * 6) / (c.w * 0.6)); y -= bend * c.h * 0.32 * ease.inOut(f); }
          let al = a;
          if (p.mode === "attack" && k === 1) { const hit = prog(lt, 2.4, 1.2); al *= 1 - hit; y += hit * S * 0.4; if (hit > 0) B.ring(G, x, y, S * (0.3 + hit * 1.2), { color: C.ink, width: Math.max(1, u * 0.2), alpha: a * (1 - hit) }); }
          if (x < c.x - S || x > c.x + c.w + S) return;
          B.drawPts(G, shipPts, x, y, { alpha: al, scale: 0.8 }, ctx);
        });
        if (p.tag) { const q = prog(lt, 2.4, 0.4); if (q > 0) B.tag(G, p.tag, ctx.stage.cx, c.y + c.h + u * 1.5, { u, size: 1.6, alpha: a * q, bg: C.ink, color: C.bg }); }
      } };
    },
  });
})();

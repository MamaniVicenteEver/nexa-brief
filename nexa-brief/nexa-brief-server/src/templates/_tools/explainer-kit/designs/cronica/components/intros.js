/* =============================================================================
   cronica · intros (el gancho: lo primero que se ve en YouTube)
   introv1 = titular GIGANTE en planos 3D: cada palabra cae desde muy cerca de la
             cámara (enorme y desenfocada) hasta su lugar y entra en foco con una
             sacudida seca; '^x^' va sobre el rótulo gris pincelado del diseño.
             Momento de impacto (cutAt): CORTE SECO a otro ángulo con rack focus,
             las letras gigantes del fondo se alinean y se barre la pincelada gris.
   introv2 = la pregunta se revela letra a letra desde el desenfoque (con la
             rayita "_" que avanza); a stampAt corte seco y la respuesta llega en
             un rótulo pincelado, más cerca de cámara: el foco salta a ella.
   Fondos propios (DOM 3D o canvas, temáticamente neutros):
     archivo   papeles rasgados, fotos fantasma del video, bloquecitos, red de líneas
     linea     línea de tiempo con rótulos de años que se pierde en profundidad
     letras    letras gigantes tenues a distinta profundidad con rack focus
     proyector haz de proyector con polvo, cuadro de película y perforaciones
   + image (foto en B/N contrastado) / component / none del contrato común.
   Orden de capas: canvas main (fondo del contrato) < DOM del fondo < sombra <
   DOM del texto < polvo/grano (capa top). Todo es función pura de lt.
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, CR = Kit.cronica, { clamp, lerp, prog, ease } = K;
  const D2R = Math.PI / 180;
  const INK = "#f4f4f2", GRAY = "#5c5c5c";

  /* ---------------------------------------------------------------- texto */
  /** "¿POR QUÉ CAYÓ\nEL ^MURO^?" → renglones de grupos {w, acc, tail} (el signo pegado va en tail) */
  function words(text) {
    return String(text ?? "").split("\n").map(s => s.trim()).filter(Boolean).map(line => {
      const out = []; let acc = false, buf = "", spaced = true;
      const flush = () => {
        if (!buf) return;
        const w = buf.toUpperCase();
        if (!spaced && out.length) out[out.length - 1].tail.push({ w, acc });
        else out.push({ w, acc, tail: [] });
        buf = ""; spaced = false;
      };
      for (const ch of line) {
        if (ch === "^") { flush(); acc = !acc; }
        else if (/\s/.test(ch)) { flush(); spaced = true; }
        else buf += ch;
      }
      flush();
      return out;
    });
  }
  const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");

  /** plano de texto serif (it.tw = ancho del texto) */
  function label(S, str, o) {
    const size = o.size, sp = o.spacing || 0, wt = o.weight || 600, padX = o.padX ?? 0.5;
    const tw = CR.measure(str, size, wt, o.italic, sp), w = tw + size * padX, h = size * (o.lh ?? 1.3);
    const it = S.add({ x: o.x || 0, y: o.y || 0, z: o.z || 0, w, h, rz: o.rz || 0, dof: o.dof || "center", opacity: o.opacity ?? 0 });
    Object.assign(it.a.style, { fontFamily: CR.SERIF, fontSize: size + "px", fontWeight: wt, fontStyle: o.italic ? "italic" : "normal", lineHeight: h + "px",
      letterSpacing: sp + "em", paddingLeft: sp + "em", boxSizing: "border-box", textAlign: "center", whiteSpace: "nowrap", color: o.color || INK,
      textShadow: o.shadow ?? "0 0 .4em rgba(0,0,0,.65), 0 0 .08em rgba(0,0,0,.5)" });
    it.a.textContent = str; it.tw = tw;
    return it;
  }
  /** mueve un plano (y recalcula sus esquinas para la profundidad de campo) */
  function move(it, x, y, z, rz = 0, s = 1) {
    const key = `${x.toFixed(1)},${y.toFixed(1)},${z.toFixed(1)},${rz.toFixed(2)},${s.toFixed(3)}`;
    if (it._mv === key) return; it._mv = key;
    it.x = x; it.y = y; it.z = z; it.rz = rz;
    it.el.style.transform = `translate3d(${x.toFixed(2)}px,${y.toFixed(2)}px,${z.toFixed(2)}px) rotate(${rz.toFixed(2)}deg) scale(${s.toFixed(3)}) translate(${(-it.w / 2).toFixed(2)}px,${(-it.h / 2).toFixed(2)}px)`;
    const c = Math.cos(rz * D2R), sn = Math.sin(rz * D2R);
    it.corners = [[0, 0], [it.w, 0], [it.w, it.h], [0, it.h]].map(([lx, ly]) => { const dx = (lx - it.w / 2) * s, dy = (ly - it.h / 2) * s; return [x + c * dx - sn * dy, y + sn * dx + c * dy, z]; });
  }
  /** barrido del rótulo de izquierda a derecha (como el año de la referencia) */
  function sweep(it, q) {
    it.opacity = q > 0 ? (it.base ?? 1) : 0;
    const v = `inset(0 ${((1 - q) * 100).toFixed(1)}% 0 0)`;
    if (it._cl !== v) { it._cl = v; it.a.style.clipPath = v; if (it.b) it.b.style.clipPath = v; }
  }
  /** opacidad + desenfoque de un span (letra o palabra que entra en foco) */
  function focusIn(s, q, maxBlur) {
    const v = q.toFixed(3);
    if (s._o === v) return; s._o = v;
    s.style.opacity = v; s.style.filter = q < 0.98 ? `blur(${((1 - q) * maxBlur).toFixed(1)}px)` : "none";
  }
  /** sacudida seca de cámara: golpes que decaen en 0,28 s (determinista) */
  function shake(lt, hits, amp) {
    let a = 0; for (const h of hits) { const d = lt - h; if (d >= 0 && d < 0.28) a += Math.pow(1 - d / 0.28, 2); }
    return [Math.sin(lt * 97) * amp * a, Math.cos(lt * 73) * amp * a * 0.8];
  }
  /** cuadro completo (div) en la capa DOM: sombra de legibilidad, oscurecido… */
  const sheet = (ctx, css) => K.el("div", null, { position: "absolute", left: "0", top: "0", width: ctx.stage.W + "px", height: ctx.stage.H + "px", pointerEvents: "none", ...css }, ctx.layers.dom);
  const setOp = (e, a) => { const v = clamp(a).toFixed(3); if (e._a !== v) { e._a = v; e.style.opacity = v; } };

  /* ---------------------------------------------------------------- tono de foto */
  const TONE = new WeakMap();
  /** foto de fondo en B/N contrastado con bordes quemados (el archivo de la referencia) */
  function tone(img) {
    if (TONE.has(img)) return TONE.get(img);
    const s = Math.min(1, 1600 / Math.max(img.width, img.height)), c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    const g = c.getContext("2d");
    g.filter = "grayscale(1) contrast(1.2) brightness(.86)"; g.drawImage(img, 0, 0, c.width, c.height); g.filter = "none";
    const vg = g.createRadialGradient(c.width / 2, c.height / 2, Math.min(c.width, c.height) * 0.3, c.width / 2, c.height / 2, Math.hypot(c.width, c.height) * 0.56);
    vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,.55)"); g.fillStyle = vg; g.fillRect(0, 0, c.width, c.height);
    TONE.set(img, c);
    return c;
  }

  /* ================================================================ fondos propios */
  const LETTERS = "ABCDEFGHIJKLMNOPRSTUVWXYZ";
  /** fondos DOM 3D: (ctx, p, o) → { view, render(lt, b), dispose() } */
  const DOMP = {
    /** archivo: papeles rasgados flotando, fotos fantasma del video, bloquecitos, red de líneas */
    archivo(ctx, p, o) {
      const { u, portrait } = ctx.stage, S = CR.Scene(ctx, { aperture: 11 }), r = K.rng(o.seed ?? 911);
      const box = portrait ? { x: -46 * u, y: -72 * u, w: 92 * u, h: 144 * u } : { x: -82 * u, y: -42 * u, w: 164 * u, h: 84 * u };
      const sheets = [];
      const cols = ["#2b2b2b", "#333", "#3b3b3b", "#262626", "#424242"];
      for (let i = 0; i < 9; i++) {
        const w = (portrait ? 34 + r() * 30 : 34 + r() * 36) * u, h = w * (0.6 + r() * 0.5);
        const x = box.x + r() * box.w, y = box.y + r() * box.h, z = -(4 + r() * 30) * u;
        const it = S.image({ x, y, z, w, h, rz: (r() - 0.5) * 14, dof: "center", opacity: 0 }, CR.brushURL(256, Math.round(256 * h / w), 700 + i * 13, cols[i % cols.length], { m: 0.07, dry: 0.7 }));
        it.base = 0.55 + r() * 0.35; it.d0 = r() * 0.6; sheets.push(it);
      }
      const dec = CR.decor(S, ctx, r, box, { ghosts: 2, letter: o.letter || LETTERS[Math.floor(r() * LETTERS.length)], blocks: portrait ? 4 : 5,
        blockSlots: portrait ? [[-0.25, -0.44], [0.2, -0.3], [0.24, 0.36], [-0.22, 0.46]] : undefined });
      const A = portrait ? { tx: 0, ty: 0, d: 1.02, rx: 20, ry: -10, rz: -5, drift: { d: -0.1, ry: 6, rz: 2, ty: 6 * u } }
        : { tx: 0, ty: 0, d: 0.98, rx: 22, ry: -14, rz: -6, drift: { d: -0.1, ry: 7, rz: 2, tx: 10 * u } };
      const shots = { A, u, fp: [0, 0, -4 * u], inOff: { d: 0.18, ry: -6, tx: -10 * u }, reOff: {} };
      return {
        view: S.view,
        render(lt, b) {
          const { cam } = CR.camera(lt, Math.max(5, b.dur), shots, 0);
          dec.reveal(lt);
          dec.ghosts.forEach(g => g.opacity = g.base * 0.8);
          sheets.forEach(s => s.opacity = s.base * prog(lt, s.d0, 0.5));
          S.render(cam);
        },
        dispose() { S.dispose(); },
      };
    },
    /** línea de tiempo: rótulos grises con años a lo largo de un eje que se pierde en profundidad */
    linea(ctx, p, o) {
      const { u, portrait } = ctx.stage, S = CR.Scene(ctx, { aperture: 14 }), r = K.rng(o.seed ?? 517);
      const [y0, y1, step] = Array.isArray(p.era) && p.era.length >= 2 ? [p.era[0], p.era[1], p.era[2] || 10] : [1900, 2020, 10];
      const years = []; for (let y = y0; y <= y1 && years.length < 24; y += step) years.push(y);
      const gap = 30 * u, L = (years.length - 1) * gap, ys = (portrait ? 6.6 : 5.6) * u;
      const axis = S.add({ x: 0, y: 0, z: 0, w: L + 80 * u, h: Math.max(1, 0.2 * u), dof: "grad", opacity: 1 });
      axis.a.style.background = "linear-gradient(90deg, rgba(255,255,255,0), rgba(255,255,255,.55) 8%, rgba(255,255,255,.55) 92%, rgba(255,255,255,0))";
      if (axis.b) axis.b.style.background = axis.a.style.background;
      const marks = years.map((y, i) => {
        const x = -L / 2 + i * gap, up = i % 2 === 0;
        const tag = CR.yearTag(S, String(y), { x, y: (up ? -1 : 1) * (ys * 1.15), z: 0, size: ys, seed: 900 + i, fade: true, align: "center" });
        const tick = CR.dash(S, x, 0, 0, true);
        const blk = r() < 0.55 ? CR.block(S, CR.snippets(ctx, r, 1, 9)[0], { x: x + 12 * u, y: (up ? 1 : -1) * 9 * u, z: 0, w: 22 * u, lines: 2 }) : null;
        return { tag, tick, blk, d0: 0.15 + i * 0.07 };
      });
      const dec = CR.decor(S, ctx, r, { x: -70 * u, y: -40 * u, w: 140 * u, h: 80 * u }, { ghosts: 1, blocks: 0, dashes: 8, letter: false });
      const A = portrait ? { tx: -L * 0.3, ty: 0, d: 0.9, rx: 26, ry: -40, rz: -12, drift: { tx: L * 0.5, ry: 4 } }
        : { tx: -L * 0.32, ty: 0, d: 0.86, rx: 30, ry: -36, rz: -9, drift: { tx: L * 0.55, ry: 5, rz: 1.5 } };
      const shots = { A, u, inOff: { d: 0.16, tx: -12 * u, ry: -5 }, reOff: {} };
      return {
        view: S.view,
        render(lt, b) {
          const span = Math.max(6, b.dur + 0.6), { cam } = CR.camera(lt, span, shots, 0);
          cam.fp = [cam.tx, 0, 0];
          dec.reveal(lt);
          marks.forEach(m => {
            const q = prog(lt, m.d0, 0.45, "inOut");
            sweep(m.tag.sw, q); const qt = prog(lt, m.d0 + 0.2, 0.4); m.tag.tx.opacity = qt; m.tag.tx.blur = (1 - qt) * 3 * u;
            m.tick.opacity = prog(lt, m.d0, 0.2);
            if (m.blk) { const qb = prog(lt, m.d0 + 0.3, 0.4); m.blk.opacity = qb * 0.8; }
          });
          S.render(cam);
        },
        dispose() { S.dispose(); },
      };
    },
    /** letras gigantes tenues a distinta profundidad; el foco las recorre (rack focus lento) */
    letras(ctx, p, o) {
      const { u, portrait } = ctx.stage, S = CR.Scene(ctx, { aperture: 16, maxBlur: 7 }), r = K.rng(o.seed ?? 233);
      const pool = (String(o.text || "").toUpperCase().replace(/[^A-ZÁÉÍÓÚÑ]/g, "") || LETTERS);
      const box = portrait ? { w: 110, h: 180 } : { w: 190, h: 110 };
      const gl = Array.from({ length: 16 }, (_, i) => {
        const ch = pool[Math.floor(r() * pool.length)], size = (34 + r() * 56) * u, z = -(r() * 90 - 25) * u;
        const it = S.add({ x: (r() - 0.5) * box.w * u, y: (r() - 0.5) * box.h * u, z, w: size * 0.95, h: size * 1.05, rz: (r() - 0.5) * 22, dof: "center", opacity: 0 });
        Object.assign(it.a.style, { fontFamily: CR.SERIF, fontSize: size + "px", lineHeight: size * 1.05 + "px", fontWeight: r() < 0.5 ? 400 : 600, fontStyle: r() < 0.3 ? "italic" : "normal", color: "#fff", textAlign: "center" });
        it.a.textContent = ch; it.base = 0.05 + r() * 0.09; it.d0 = r() * 0.8;
        return it;
      });
      const net = CR.network(S, { x: -box.w * 0.4 * u, y: -box.h * 0.35 * u, w: box.w * 0.8 * u, h: box.h * 0.7 * u }, 7, r, { z: -6 * u });
      net.opacity = 0.7;
      const pan = S.image({ x: 0, y: 0, z: -40 * u, w: box.w * 1.1 * u, h: box.h * 0.9 * u, dof: "center", opacity: 0.8 }, CR.brushURL(400, Math.round(400 * box.h * 0.9 / (box.w * 1.1)), 4441, "#202020", { m: 0.05, dry: 0.5 }));
      const A = { tx: 0, ty: 0, d: 1, rx: portrait ? 10 : 12, ry: -12, rz: -4, drift: { d: -0.12, ry: 8, rz: 2 } };
      const shots = { A, u, fp: [0, 0, 0], inOff: { d: 0.2, ry: -6 }, reOff: {} };
      return {
        view: S.view,
        render(lt, b) {
          const { cam } = CR.camera(lt, Math.max(5, b.dur), shots, 0);
          cam.focus *= 1 + 0.38 * Math.sin(lt * 0.9 - 0.6);            /* el foco recorre las capas */
          gl.forEach(g => g.opacity = g.base * prog(lt, g.d0, 0.7));
          net.drawIn(clamp(0.2 + lt / 1.6));
          void pan;
          S.render(cam);
        },
        dispose() { S.dispose(); },
      };
    },
  };

  /** fondos canvas: (G, st, lt, b) */
  const CANVAS = {
    /** proyector: haz de luz con polvo, cuadro de película que parpadea y perforaciones que corren */
    proyector(G, st, lt) {
      const { W, H, u, portrait } = st, fl = 0.86 + 0.14 * K.rng(Math.floor(lt * 18) + 7)();
      G.fillStyle = "#0f0f0f"; G.fillRect(0, 0, W, H);
      /* cuadro proyectado (pantalla tenue) */
      const fw = portrait ? W * 0.84 : W * 0.66, fh = portrait ? H * 0.5 : H * 0.66, fx = (W - fw) / 2, fy = (H - fh) / 2 - H * 0.02;
      const sg = G.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(fw, fh) * 0.7);
      sg.addColorStop(0, `rgba(120,120,118,${0.32 * fl})`); sg.addColorStop(0.7, `rgba(70,70,68,${0.22 * fl})`); sg.addColorStop(1, `rgba(40,40,40,${0.12 * fl})`);
      G.save(); G.beginPath(); G.roundRect ? G.roundRect(fx, fy, fw, fh, u * 2.2) : G.rect(fx, fy, fw, fh); G.fillStyle = sg; G.fill();
      G.clip();
      /* rayas de película (cambian a 12 fps) */
      const r = K.rng(Math.floor(lt * 12) + 101);
      for (let k = 0; k < 4; k++) { if (r() < 0.45) continue; G.fillStyle = `rgba(230,230,228,${0.08 + r() * 0.12})`; G.fillRect(fx + r() * fw, fy, Math.max(1, u * 0.12), fh); }
      G.restore();
      G.strokeStyle = "rgba(200,200,198,.12)"; G.lineWidth = Math.max(1, u * 0.15);
      G.beginPath(); G.roundRect ? G.roundRect(fx, fy, fw, fh, u * 2.2) : G.rect(fx, fy, fw, fh); G.stroke();
      /* haz desde arriba a la derecha */
      const sx = W * (portrait ? 0.78 : 0.9), sy = -H * 0.06;
      G.save(); G.globalCompositeOperation = "lighter";
      const bg = G.createLinearGradient(sx, sy, W / 2, H / 2);
      bg.addColorStop(0, `rgba(255,255,250,${0.2 * fl})`); bg.addColorStop(1, "rgba(255,255,250,0.015)");
      G.fillStyle = bg; G.beginPath(); G.moveTo(sx - u, sy); G.lineTo(fx, fy + fh); G.lineTo(fx + fw, fy); G.closePath(); G.fill();
      /* polvo iluminado dentro del haz */
      const pr = K.rng(5150);
      for (let k = 0; k < 90; k++) {
        const a = pr(), bpos = pr(), sp = 0.015 + pr() * 0.03, ph = pr() * 6.28;
        const t = (a + lt * sp) % 1, ex = lerp(fx, fx + fw, bpos), ey = lerp(fy + fh, fy, bpos);
        const x = lerp(sx, ex, t) + Math.sin(lt * 0.8 + ph) * u * 1.2, y = lerp(sy, ey, t) + Math.cos(lt * 0.6 + ph) * u;
        G.fillStyle = `rgba(255,255,250,${(0.25 + 0.5 * pr()) * Math.sin(t * Math.PI) * fl})`;
        const s = u * (0.1 + pr() * 0.25); G.fillRect(x, y, s, s);
      }
      G.restore();
      /* perforaciones de película que corren por los bordes */
      const hw = u * (portrait ? 3.4 : 2.6), hh = hw * 0.72, gap = hh * 2.2, off = (lt * u * 9) % gap;
      for (const ex of [u * 2.2, W - u * 2.2 - hw]) {
        G.fillStyle = "rgba(0,0,0,.55)"; G.fillRect(ex - hw * 0.35, 0, hw * 1.7, H);
        G.fillStyle = "rgba(170,170,168,.16)";
        for (let y = -gap + off; y < H + gap; y += gap) { G.beginPath(); G.roundRect ? G.roundRect(ex, y, hw, hh, hh * 0.25) : G.rect(ex, y, hw, hh); G.fill(); }
      }
      const dk = G.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.2, W / 2, H / 2, Math.hypot(W, H) * 0.6);
      dk.addColorStop(0, "rgba(0,0,0,.25)"); dk.addColorStop(1, "rgba(0,0,0,.75)"); G.fillStyle = dk; G.fillRect(0, 0, W, H);
    },
  };
  const PRESETS = ["archivo", "linea", "letras", "proyector"];

  /**
   * Fondo intercambiable con el lenguaje del diseño: envuelve Kit.hook.bg (canvas main)
   * y agrega los fondos DOM 3D propios. Si el componente de fondo dibuja en DOM, el
   * oscurecido `dim` se pone también en DOM (el del contrato queda debajo, en canvas).
   * Llamarlo ANTES de armar el texto: así todo lo suyo queda debajo en la capa DOM.
   */
  function background(ctx, p, names, o = {}) {
    const st = ctx.stage, root = ctx.layers.dom;
    let dom = null;
    const presets = {};
    for (const n of names) presets[n] = (G, s, lt, b) => {
      if (CANVAS[n]) CANVAS[n](G, s, lt, b); else { G.fillStyle = "#141414"; G.fillRect(0, 0, s.W, s.H); }
      if (dom) dom.render(lt, b);
    };
    const before = new Set(root.children);
    const BG = K.hook.bg(ctx, p, { auto: o.auto || names[0], presets, tone });
    const added = [...root.children].filter(e => !before.has(e));
    if (DOMP[BG.mode]) dom = DOMP[BG.mode](ctx, p, o);
    const nodes = [...added]; if (dom) nodes.push(dom.view);
    let dimEl = null;
    if (BG.mode === "component" && added.length) { dimEl = sheet(ctx, { background: `rgba(10,10,10,${clamp(p.dim ?? 0.45)})` }); nodes.push(dimEl); }
    return {
      mode: BG.mode,
      render(lt, b, t, alpha = 1) {
        const G = ctx.g.main; G.save(); G.globalAlpha = alpha; BG.render(lt, b, t); G.restore();
        for (const e of nodes) setOp(e, alpha);
      },
      dispose() { BG.dispose(); dom && dom.dispose(); dimEl && dimEl.remove(); },
    };
  }

  CR.hook = { words, label, move, sweep, focusIn, shake, sheet, setOp, tone, background, PRESETS, DOMP, CANVAS };

  const eraParam = { type: "array", default: [1900, 2020, 10], doc: "Años del fondo 'linea' [desde, hasta, paso]." };

  /* ================================================================ introv1 */
  K.register({
    name: "cronica.introv1", tags: ["intro", "gancho", "apertura", "título", "impacto", "3d"], layer: "main", post: 0.6,
    summary: "GANCHO de apertura en el espacio 3D de la crónica. Fondo adaptable (bg: archivo | linea | letras | proyector | image con src | component con use/useParams | none); por defecto papeles rasgados, fotos fantasma, bloquecitos y red de líneas flotando con profundidad de campo. Titular GIGANTE en serif: cada palabra cae desde muy cerca de la cámara (enorme y desenfocada) y entra en foco con una sacudida seca; '^palabra^' va en itálica sobre el rótulo gris pincelado. En cutAt: CORTE SECO a otro ángulo con rack focus, las letras gigantes del fondo se alinean y se barre una pincelada gris bajo el titular.",
    example: { text: "LA NOCHE QUE\nCAYÓ EL ^MURO^", kicker: "Berlín · 9 de noviembre de 1989", sub: "y nadie dio la orden", cutAt: 2.3 },
    params: {
      text: { type: "string", required: true, doc: "Titular gancho, corto (2–6 palabras). '\\n' = renglón; '^x^' = palabra en itálica sobre el rótulo gris. Un signo pegado (^MURO^?) no se separa." },
      kicker: { type: "string", default: "", doc: "Rótulo gris pincelado chico arriba (lugar · fecha)." },
      sub: { type: "string", default: "", doc: "Línea en itálica debajo del titular." },
      wordAt: { type: "number", default: 0.35, doc: "Segundo en que cae la primera palabra." },
      stagger: { type: "number", default: 0.28, min: 0.08, doc: "Segundos entre palabra y palabra." },
      cutAt: { type: "number", default: 2.3, doc: "Momento de impacto: corte seco a otro ángulo + rack focus + letras gigantes que se alinean (-1 = sin corte; acepta '@palabra')." },
      letters: { type: "string", default: "", doc: "Letras gigantes del fondo que se alinean en el corte (vacío = la palabra destacada o la más larga)." },
      era: eraParam,
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage;
      const BG = background(ctx, p, PRESETS, { auto: "archivo", seed: 311, text: p.text });
      const shade = sheet(ctx, { opacity: 0, background: portrait
        ? "radial-gradient(ellipse 96% 34% at 50% 45%, rgba(8,8,8,.82), rgba(8,8,8,.4) 66%, rgba(8,8,8,0))"
        : "radial-gradient(ellipse 66% 50% at 50% 49%, rgba(8,8,8,.8), rgba(8,8,8,.36) 66%, rgba(8,8,8,0))" });
      const S = CR.Scene(ctx, { aperture: 5 }), r = K.rng(4711);
      const Ls = words(p.text), SPC = 0.02;
      /* tamaño: el renglón más largo ocupa ~80 % del ancho, limitado por alto */
      const gw = (g, s) => CR.measure(g.w, s, 600, g.acc, SPC) + g.tail.reduce((a, t) => a + CR.measure(t.w, s, 600, t.acc, SPC), 0);
      const lineW = (l, s) => l.reduce((a, g) => a + gw(g, s), 0) + CR.measure(" ", s, 600) * (l.length - 1);
      const maxW = W * (portrait ? 0.9 : 0.8);
      let fs = Math.min(...Ls.map(l => maxW / Math.max(1, lineW(l, 100)) * 100));
      fs = Math.min(fs, H * (portrait ? 0.12 : 0.235) * (Ls.length > 2 ? 0.78 : 1));
      const lh = fs * 1.0, cy = portrait ? -9 * u : -3 * u, n = Ls.length, top = cy - n * lh / 2, bot = cy + n * lh / 2;
      const blockW = Math.max(...Ls.map(l => lineW(l, fs)));
      /* panel oscuro pincelado detrás + red de líneas (capas de la crónica) */
      const back = S.image({ x: 0, y: cy, z: -44 * u, w: blockW * 1.5 + 30 * u, h: n * lh + 40 * u, dof: "center", opacity: 0 },
        CR.brushURL(400, Math.round(400 * (n * lh + 40 * u) / (blockW * 1.5 + 30 * u)), 3301, "rgba(16,16,16,.78)", { m: 0.05, dry: 0.5 }));
      const net = CR.network(S, { x: -blockW * 0.62, y: top - 8 * u, w: blockW * 1.24, h: n * lh + 18 * u }, 5, r, { z: -1 * u });
      /* letras gigantes que se alinean en el corte */
      const accW = Ls.flat().find(g => g.acc), longest = Ls.flat().reduce((a, g) => g.w.length > a.length ? g.w : a, "");
      const gtxt = (p.letters || (accW ? accW.w : longest)).toUpperCase().replace(/[^A-ZÁÉÍÓÚÑÜ0-9]/g, "").slice(0, 8);
      const gs = Math.min(fs * 2.6, (portrait ? 95 : 150) * u / Math.max(1, gtxt.length * 0.72));
      const gW = CR.measure(gtxt, gs, 400, false, 0.02);
      let gx = -gW / 2;
      const giants = [...gtxt].map((ch, i) => {
        const cw = CR.measure(ch, gs, 400, false, 0.02), x = gx + cw / 2; gx += cw;
        const it = S.add({ x, y: cy, z: -16 * u, w: cw * 1.1, h: gs * 1.1, dof: "center", opacity: 0 });
        Object.assign(it.a.style, { fontFamily: CR.SERIF, fontSize: gs + "px", lineHeight: gs * 1.1 + "px", fontWeight: 400, color: "#fff", textAlign: "center" });
        it.a.textContent = ch;
        it.home = [x, cy, -16 * u]; it.from = [x + (r() - 0.5) * 70 * u, cy + (r() - 0.5) * 50 * u, -16 * u - (r() * 40 - 10) * u, (r() - 0.5) * 50];
        return it;
      });
      /* palabras: un plano por grupo (palabra + signo pegado) */
      const sp = CR.measure(" ", fs, 600);
      const groups = [];
      let gi = 0;
      Ls.forEach((l, li) => {
        let x = -lineW(l, fs) / 2; const y = cy + (li - (n - 1) / 2) * lh;
        l.forEach(g => {
          const w = gw(g, fs), mw = CR.measure(g.w, fs, 600, g.acc, SPC);
          const it = S.add({ x: x + w / 2, y, z: 0, w: w + fs * 0.3, h: fs * 1.25, dof: "center", opacity: 0 });
          Object.assign(it.a.style, { fontFamily: CR.SERIF, fontSize: fs + "px", lineHeight: fs * 1.25 + "px", fontWeight: 600, letterSpacing: SPC + "em",
            whiteSpace: "nowrap", textAlign: "center", color: INK, textShadow: "0 0 .25em rgba(0,0,0,.6), 0 .04em .02em rgba(0,0,0,.4)" });
          it.a.innerHTML = `<span style="font-style:${g.acc ? "italic" : "normal"}">${esc(g.w)}</span>` + g.tail.map(t => `<span style="font-style:${t.acc ? "italic" : "normal"}">${esc(t.w)}</span>`).join("");
          let sw = null;
          if (g.acc) {
            const swW = mw + fs * 0.5, swH = fs * 1.02;
            sw = S.image({ x: x + mw / 2, y, z: -0.4 * u, w: swW, h: swH, dof: "center", opacity: 0 }, CR.brushURL(320, Math.round(320 * swH / swW), 3400 + gi, GRAY, { m: 0.1, dry: 0.9 }));
            sw.dx = (x + mw / 2) - (x + w / 2);
          }
          groups.push({ it, sw, x: x + w / 2, y, i: gi++ });
          x += w + sp;
        });
      });
      const T0 = i => p.wordAt + i * p.stagger;
      const hits = groups.map(g => T0(g.i) + 0.12);
      const lastHit = hits[hits.length - 1] ?? p.wordAt;
      /* pincelada gris bajo el titular (se barre en el corte) */
      const ulW = Math.min(blockW * 0.92, W * 0.78), ulH = fs * 0.2;
      const ul = S.image({ x: 0, y: bot + fs * 0.08, z: -1.2 * u, w: ulW, h: ulH, dof: "center", opacity: 0 }, CR.brushURL(512, Math.max(8, Math.round(512 * ulH / ulW)), 3501, "#4a4a4a", { m: 0.18, dry: 1 }));
      /* rótulos */
      const ks = (portrait ? 4.6 : 3.8) * u;
      const kick = p.kicker ? CR.yearTag(S, p.kicker, { x: 0, y: top - ks * 1.25 - 1.5 * u, z: 0.5 * u, size: ks, align: "center", seed: 3601, pad: 2 }) : null;
      const sub = p.sub ? label(S, p.sub, { x: 0, y: bot + fs * 0.08 + (portrait ? 6 : 5.2) * u, z: 0.5 * u, size: (portrait ? 4.6 : 3.7) * u, weight: 500, italic: true, spacing: 0.03, color: "rgba(238,238,234,.9)" }) : null;
      const dashes = [CR.dash(S, -blockW * 0.56, top - 3 * u, 1 * u, false), CR.dash(S, blockW * 0.55, bot + 2 * u, 1 * u, true), CR.dash(S, blockW * 0.6, top + 2 * u, -2 * u, false)];

      const cut = p.cutAt > 0.3 ? p.cutAt : 0;
      const A = portrait ? { tx: 0, ty: cy, d: 1.05, rx: 7, ry: -7, rz: -2.5, drift: { d: -0.04, ry: 4, rz: 1 } }
        : { tx: 0, ty: cy, d: 1.04, rx: 8, ry: -10, rz: -2.5, drift: { d: -0.04, ry: 5, rz: 1.2 } };
      const B = portrait ? { tx: 0, ty: cy + lh * 0.15, d: 1.02, rx: -5, ry: 6, rz: 2.2, drift: { d: -0.03, ry: -2 } }
        : { tx: 0, ty: cy + lh * 0.15, d: 0.99, rx: -6, ry: 10, rz: 2.4, drift: { d: -0.03, ry: -3 } };
      const shots = { A, B, u, fp: [0, cy, 0], inOff: { d: 0.16, tx: -6 * u, ry: -5, rz: -2 }, reOff: { d: 0.07, tx: 4 * u, ry: 2 } };
      return {
        dispose() { BG.dispose(); S.dispose(); shade.remove(); },
        render(lt, b, t) {
          const oq = prog(lt, b.dur - 0.05, 0.6, "in"), tr = cut && cut < b.dur - 0.3 ? cut : 0;
          BG.render(lt, b, t, 1 - oq);
          setOp(shade, prog(lt, p.wordAt - 0.25, 0.5, "linear") * (1 - oq));
          setOp(S.view, 1 - oq);
          const { cam } = CR.camera(lt, b.dur, shots, tr);
          const [sx, sy] = shake(lt, tr ? hits.concat([tr]) : hits, u * 0.7);
          cam.tx += sx; cam.ty += sy;
          cam.focus *= 1 - 0.45 * oq;                                /* salida: se desenfoca */
          back.opacity = prog(lt, p.wordAt - 0.2, 0.4);
          net.opacity = 0.8; net.drawIn(clamp(lt / 1.4));
          dashes.forEach((d, i) => d.opacity = prog(lt, 0.3 + i * 0.12, 0.2));
          if (kick) { const q = prog(lt, 0.1, 0.45, "inOut"); sweep(kick.sw, q); const qt = prog(lt, 0.3, 0.45); kick.tx.opacity = qt; kick.tx.blur = (1 - qt) * 3 * u; }
          /* cada palabra cae desde cerca de cámara y entra en foco */
          for (const g of groups) {
            const t0 = T0(g.i), q = clamp((lt - t0) / 0.5), e = ease.expoOut(q), k = 1 - e, dir = g.i % 2 ? 1 : -1;
            const z = 0.42 * S.P * k, x = g.x * (1 + 0.3 * k), y = g.y + dir * fs * 0.35 * k, rz = dir * 6 * k;
            move(g.it, x, y, z, rz); g.it.opacity = clamp(q * 4); g.it.blur = k * 3.2 * u;
            if (g.sw) {
              move(g.sw, x + g.sw.dx, y, z - 0.4 * u, rz);
              sweep(g.sw, prog(lt, t0 + 0.14, 0.4, "inOut"));
            }
          }
          /* impacto: las letras gigantes se alinean; la pincelada se barre */
          const aq = tr ? ease.expoOut(clamp((lt - tr) / 0.7)) : prog(lt, lastHit, 1.2, "out");
          giants.forEach((g, i) => {
            const f = g.from, h = g.home, k = 1 - aq;
            move(g, lerp(h[0], f[0], k), lerp(h[1], f[1], k), lerp(h[2], f[2], k), f[3] * k);
            g.opacity = (0.08 + 0.08 * aq) * prog(lt, 0.1 + i * 0.05, 0.5);
          });
          sweep(ul, prog(lt, tr ? tr + 0.05 : lastHit + 0.2, 0.45, "inOut"));
          if (sub) { const q = prog(lt, Math.max(lastHit + 0.3, tr ? tr + 0.25 : 0), 0.6); sub.opacity = q; sub.blur = (1 - q) * 3 * u; }
          S.render(cam);
        },
      };
    },
  });

  /* ================================================================ introv2 */
  K.register({
    name: "cronica.introv2", tags: ["intro", "gancho", "apertura", "pregunta", "revelación", "3d"], layer: "main", post: 0.6,
    summary: "GANCHO pregunta + revelación. Fondo adaptable (bg: linea | archivo | letras | proyector | image con src | component con use/useParams | none); por defecto una línea de tiempo con rótulos de años que se pierde en profundidad. La pregunta (mayúsculas serif espaciadas) se revela letra a letra desde el desenfoque con una rayita '_' que avanza; en stampAt CORTE SECO a otro ángulo y la respuesta llega en un gran rótulo gris pincelado que se barre, más cerca de cámara: el foco salta de la pregunta a la respuesta (rack focus).",
    example: { text: "¿QUIÉN ABRIÓ\nEL MURO?", kicker: "Berlín · 1989", stamp: "NADIE DIO LA ORDEN", stampAt: 2.6 },
    params: {
      text: { type: "string", required: true, doc: "Pregunta gancho ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Bloquecito con barra arriba (lugar · fecha)." },
      stamp: { type: "string", default: "", doc: "Respuesta que llega en el rótulo pincelado (vacío = sin respuesta)." },
      stampAt: { type: "number", default: 2.6, doc: "Segundo de la respuesta y del corte seco (acepta '@palabra')." },
      typeAt: { type: "number", default: 0.35, doc: "Segundo en que empieza a revelarse la pregunta." },
      cps: { type: "number", default: 16, min: 4, doc: "Letras por segundo del revelado." },
      era: eraParam,
      ...K.hook.bgParams(PRESETS),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage;
      const BG = background(ctx, p, PRESETS, { auto: "linea", seed: 523, text: p.text });
      const shade = sheet(ctx, { opacity: 0, background: portrait
        ? "linear-gradient(180deg, rgba(8,8,8,0) 18%, rgba(8,8,8,.78) 34%, rgba(8,8,8,.78) 64%, rgba(8,8,8,0) 82%)"
        : "radial-gradient(ellipse 70% 58% at 50% 50%, rgba(8,8,8,.82), rgba(8,8,8,.42) 66%, rgba(8,8,8,0))" });
      const S = CR.Scene(ctx, { aperture: 7, maxBlur: 5 }), r = K.rng(5221);
      const SPC = 0.045, lines = String(p.text).toUpperCase().split("\n").map(s => s.trim()).filter(Boolean);
      const maxW = W * (portrait ? 0.84 : 0.72);
      let fs = Math.min(...lines.map(l => maxW / Math.max(1, CR.measure(l, 100, 600, false, SPC)) * 100));
      fs = Math.min(fs, H * (portrait ? 0.095 : 0.15));
      const lh = fs * 1.12, n = lines.length;
      const stp = String(p.stamp || "").toUpperCase();
      let ss = stp ? Math.min(fs * 0.95, W * (portrait ? 0.74 : 0.56) / Math.max(1, CR.measure(stp, 100, 700, true, 0.01) + 120) * 100) : 0;
      const stH = ss * 1.42;
      const total = n * lh + (stp ? stH + 4 * u : 0), y0 = (portrait ? -6 * u : -1 * u) - total / 2;
      /* pregunta: letras sueltas para revelarlas una a una */
      const chars = [], linesInfo = [];
      lines.forEach((l, i) => {
        const y = y0 + (i + 0.5) * lh, w = CR.measure(l, fs, 600, false, SPC);
        const it = S.add({ x: 0, y, z: 0, w: w + fs, h: lh * 1.1 });
        Object.assign(it.a.style, { fontFamily: CR.SERIF, fontWeight: 600, fontSize: fs + "px", lineHeight: lh * 1.1 + "px", letterSpacing: SPC + "em", paddingLeft: SPC + "em", boxSizing: "border-box",
          color: INK, textAlign: "center", whiteSpace: "nowrap", textShadow: "0 0 .35em rgba(0,0,0,.6)" });
        for (const c of l) { const s = K.el("span", null, { display: "inline-block", whiteSpace: "pre", opacity: 0 }, it.a); s.textContent = c; chars.push(s); }
        linesInfo.push({ y, w, l });
      });
      const nCh = chars.length, CH0 = i => p.typeAt + i / p.cps, typedEnd = CH0(nCh);
      /* la rayita "_" que avanza detrás de la última letra */
      const cur = CR.dash(S, 0, 0, 0.4 * u, false);
      const curPos = k => {
        let left = k;
        for (const L of linesInfo) {
          if (left <= L.l.length) return [-L.w / 2 + CR.measure(L.l.slice(0, left), fs, 600, false, SPC) + fs * 0.35, L.y + fs * 0.36];
          left -= L.l.length;
        }
        const L = linesInfo[linesInfo.length - 1]; return [L.w / 2 + fs * 0.35, L.y + fs * 0.36];
      };
      /* bloquecito con barra (kicker) */
      const kick = p.kicker ? CR.block(S, p.kicker, { x: portrait ? 0 : -linesInfo[0].w / 2 + 12 * u, y: y0 - 4.5 * u, z: 0.5 * u, size: (portrait ? 2.5 : 2) * u, w: (portrait ? 60 : 46) * u, lines: 1 }) : null;
      if (kick) Object.assign(kick.a.style, { fontStyle: "italic", letterSpacing: ".06em", color: "rgba(240,240,236,.92)" });
      /* respuesta: rótulo gris pincelado grande, más cerca de cámara */
      let tag = null, sy = 0;
      if (stp) {
        sy = y0 + n * lh + 4 * u + stH / 2;
        tag = CR.yearTag(S, stp, { x: 0, y: sy, z: 7 * u, size: ss, italic: true, align: "center", seed: 5301, pad: 1.2 });
        [tag.sw, tag.tx].forEach(it => move(it, it.x, it.y, it.z, -2.2));
      }
      const bkW = Math.max(linesInfo.reduce((a, L) => Math.max(a, L.w), 0), stp ? CR.measure(stp, ss, 700, true) : 0) + 22 * u, bkH = total + 14 * u;
      const back = S.image({ x: 0, y: y0 + total / 2, z: -3 * u, w: bkW, h: bkH, dof: "center", opacity: 0 },
        CR.brushURL(400, Math.round(400 * bkH / bkW), 5401, "rgba(16,16,16,.74)", { m: 0.05, dry: 0.5 }));
      const qy = y0 + n * lh / 2;
      const A = portrait ? { tx: 0, ty: qy, d: 1.08, rx: 12, ry: 8, rz: 2.5, drift: { d: -0.05, ry: -4 } }
        : { tx: 0, ty: qy, d: 1.04, rx: 12, ry: 12, rz: 3, drift: { d: -0.05, ry: -5, rz: -1 } };
      const B = portrait ? { tx: 0, ty: (qy + sy) / 2, d: 1.02, rx: -4, ry: -7, rz: -2, drift: { d: -0.03, ry: 2 } }
        : { tx: 0, ty: (qy + sy) / 2, d: 0.98, rx: -5, ry: -11, rz: -2.5, drift: { d: -0.03, ry: 3 } };
      const shotsA = { A, u, fp: [0, qy, 0], inOff: { d: 0.14, tx: 8 * u, ry: 5, rz: 2 }, reOff: {} };
      const shotsB = { A, B, u, fp: [0, sy, 7 * u], inOff: shotsA.inOff, reOff: { d: 0.07, tx: -4 * u, ry: -2 } };
      return {
        dispose() { BG.dispose(); S.dispose(); shade.remove(); },
        render(lt, b, t) {
          const oq = prog(lt, b.dur - 0.05, 0.6, "in"), tr = stp && p.stampAt > 0.3 && p.stampAt < b.dur - 0.2 ? p.stampAt : 0;
          BG.render(lt, b, t, 1 - oq);
          setOp(shade, prog(lt, 0.05, 0.5, "linear") * (1 - oq));
          setOp(S.view, 1 - oq);
          const { cam } = CR.camera(lt, b.dur, tr ? shotsB : shotsA, tr);
          cam.fp = tr && lt >= tr ? shotsB.fp : shotsA.fp;
          if (tr && lt >= tr) cam.focus = lerp(0.72, 1, prog(lt - tr, 0.04, 0.5, "inOut"));   /* la respuesta se lee enseguida */                    /* el foco salta a la respuesta */
          const [jx, jy] = shake(lt, tr ? [tr + 0.05] : [], u * 0.8); cam.tx += jx; cam.ty += jy;
          cam.focus *= 1 - 0.45 * oq;
          back.opacity = prog(lt, 0.05, 0.5);
          chars.forEach((s, i) => focusIn(s, prog(lt, CH0(i), 0.45, "out"), fs * 0.16));
          const k = clamp(Math.floor((lt - p.typeAt) * p.cps), 0, nCh);
          const [cx, cyy] = curPos(k); move(cur, cx, cyy, 0.4 * u);
          cur.opacity = lt < p.typeAt - 0.1 || (tr && lt > tr) ? 0 : (Math.floor(lt * 2.4) % 2 && lt > typedEnd ? 0.25 : 0.95);
          if (kick) { const q = prog(lt, 0.15, 0.5); kick.opacity = q; kick.blur = (1 - q) * 3 * u; }
          if (tag) {
            const q = prog(lt, tr || p.stampAt, 0.35, "inOut");
            sweep(tag.sw, q);
            const qt = prog(lt, (tr || p.stampAt) + 0.12, 0.3); tag.tx.opacity = qt; tag.tx.blur = (1 - qt) * 4 * u;
          }
          S.render(cam);
        },
      };
    },
  });
})();

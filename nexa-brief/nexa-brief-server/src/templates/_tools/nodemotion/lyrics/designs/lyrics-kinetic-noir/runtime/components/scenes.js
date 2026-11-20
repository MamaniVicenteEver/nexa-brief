/* lyrics-kinetic-noir · escenas de frase.
   Cada escena recibe sc = {words:[{text,start,end}] (s de la escena), t0, t1, seed, glitch, credit?, split?}
   y devuelve {root, update(lt)}. update dibuja el estado exacto del segundo lt (sin estado acumulado).
   Composiciones tomadas del lenguaje de la referencia, con texto propio de la canción:
   bar · stack · quote · ghost · subtitle · frame · box · highlight (+ pausa). */
(function (root) {
  "use strict";
  const N = root.Noir, K = N.core, R = N.registry;
  const { clamp, ease, prog, el } = K;
  const LEAD = 0.04;
  const appear = w => Math.max(0, w.start - LEAD);
  const wordDur = (w, lo, hi) => clamp(w.end - w.start, lo, hi);

  /* corte en bandas al entrar cada palabra (0,07 s) y en el cierre de la escena (sc.glitch s) */
  function finish(rw, lt, d, sc, base, opacity) {
    const step = Math.floor(lt * 30);
    let clip = "", dx = 0;
    const a = appear(rw.w);
    if (sc.glitch > 0 && lt > d - sc.glitch) { const s = K.sliceOf(sc.seed, rw.idx, step, 1); clip = s.clip; dx = s.dx; }
    else if (sc.glitch > 0 && lt >= a && lt < a + 0.07) { const s = K.sliceOf(sc.seed, rw.idx + 50, step, 0.6); clip = s.clip; dx = s.dx; }
    K.paint(rw, (dx ? `translateX(${dx.toFixed(3)}em) ` : "") + (base || ""), clip, opacity);
  }
  function placeY(B, cy) { B.el.style.top = cy.toFixed(1) + "px"; }
  const portrait = ctx => ctx.H > ctx.W * 1.05;

  /* 1 · barra blanca que se abre y cruza la línea (texto en diferencia sobre la barra) */
  R.scenes.bar = (sc, ctx) => {
    const P = portrait(ctx), f = ctx.fonts.condensed, root = el("div", "nz-scene");
    const lines = K.wrap(sc.words, P ? 11 : 22, 1, P ? 3 : 2);
    const px = K.fitSize(lines, f, ctx.W * (P ? 0.84 : 0.66), ctx.H * (P ? 0.36 : 0.4));
    const bar = el("div", "nz-bar", root);
    const B = K.block(root, lines, f, px, { cls: "nz-diff" });
    const lh = (f.lineHeight || 0.9) * px, bw = B.widthPx * 1.12, bh = Math.max(3, px * 0.26);
    Object.assign(bar.style, { left: (ctx.W / 2 - bw / 2) + "px", width: bw + "px", height: bh + "px",
      top: (ctx.H / 2 - B.heightPx / 2 + lh * 0.52 - bh / 2) + "px" });
    return { root, update(lt) {
      const d = sc.t1 - sc.t0;
      const g = ease.expo(prog(lt, 0, 0.3)), s = ease.in(prog(lt, d - 0.3, 0.26));
      bar.style.transformOrigin = s > 0 ? "right center" : "left center";
      bar.style.transform = `scaleX(${(s > 0 ? 1 - s : g).toFixed(4)})`;
      for (const rw of B.words) {
        const a = Math.max(0.1, appear(rw.w)), p = prog(lt, a, 0.22);
        if (lt < a) { K.showWord(rw, false); continue; }
        K.showWord(rw, true);
        const e = ease.out(p);
        finish(rw, lt, d, sc, `translateY(${((1 - e) * 0.55).toFixed(3)}em)`, e.toFixed(3));
      }
    } };
  };

  /* 2 · pila: palabras en renglones cortos con sangrías alternas, tecleo con mezcla de caracteres */
  R.scenes.stack = (sc, ctx) => {
    const P = portrait(ctx), f = ctx.fonts.expanded, root = el("div", "nz-scene");
    const lines = K.wrap(sc.words, P ? 8 : 11, Math.min(sc.words.length, P ? 3 : 2), P ? 6 : 5);
    const px = K.fitSize(lines, f, ctx.W * (P ? 0.8 : 0.56), ctx.H * (P ? 0.56 : 0.66), 1.12);
    const B = K.block(root, lines, f, px, { align: "left" });
    const IND = [0, 0.9, 0.35, 0.6, 0.15, 0.75];
    B.lines.forEach((L, i) => { L.el.style.paddingLeft = (IND[i % IND.length] * px * 0.5).toFixed(1) + "px"; });
    return { root, update(lt) {
      const d = sc.t1 - sc.t0;
      for (const rw of B.words) {
        const a = appear(rw.w);
        if (lt < a) { K.showWord(rw, false); continue; }
        K.typeWord(rw, lt, a, wordDur(rw.w, 0.12, 0.32), sc.seed, true);
        const e = ease.expo(prog(lt, a, 0.25));
        finish(rw, lt, d, sc, `translateX(${(-(1 - e) * 0.35).toFixed(3)}em)`);
      }
    } };
  };

  /* 3 · cita: condensada centrada, palabras que entran en gris y se encienden; crédito manuscrito arriba */
  R.scenes.quote = (sc, ctx) => {
    const P = portrait(ctx), f = ctx.fonts.condensed, root = el("div", "nz-scene");
    const lines = K.wrap(sc.words, P ? 13 : 24, 1, P ? 4 : 2);
    const px = K.fitSize(lines, f, ctx.W * (P ? 0.84 : 0.68), ctx.H * 0.36);
    const B = K.block(root, lines, f, px);
    let credit = null;
    if (sc.credit) {
      const cf = ctx.fonts.script, cpx = Math.max(12, px * 0.34);
      credit = el("div", "nz-credit", root, sc.credit);
      K.applyFont(credit, cf, cpx);
      credit.style.top = (ctx.H / 2 - B.heightPx / 2 - cpx * 1.15) + "px";
    }
    return { root, update(lt) {
      const d = sc.t1 - sc.t0;
      if (credit) {
        const p = ease.out(prog(lt, 0, 0.6)), q = prog(lt, d - 0.25, 0.2);
        credit.style.clipPath = `inset(0 ${((1 - p) * 100).toFixed(1)}% 0 0)`;
        credit.style.opacity = String(1 - q);
      }
      for (const rw of B.words) {
        const a = appear(rw.w);
        if (lt < a) { K.showWord(rw, false); continue; }
        K.showWord(rw, true);
        const p = prog(lt, a, 0.3), lit = p >= 0.55;
        if (rw.lit !== lit) { rw.el.style.color = lit ? "" : "var(--dim)"; rw.lit = lit; }
        finish(rw, lt, d, sc, `scaleX(${(1 + 0.18 * (1 - ease.out(p))).toFixed(4)})`);
      }
    } };
  };

  /* 4 · eco: palabra slab enorme que entra inclinada, con dos copias tenues desplazadas debajo */
  R.scenes.ghost = (sc, ctx) => {
    const P = portrait(ctx), f = ctx.fonts.slab, root = el("div", "nz-scene");
    const lines = K.wrap(sc.words, P ? 9 : 16, 1, 2);
    const px = K.fitSize(lines, f, ctx.W * (P ? 0.86 : 0.66), ctx.H * (P ? 0.26 : 0.3));
    const G2 = K.block(root, lines, f, px, { cls: "nz-ghost nz-g2" });
    const G1 = K.block(root, lines, f, px, { cls: "nz-ghost" });
    const B = K.block(root, lines, f, px);
    return { root, update(lt) {
      const d = sc.t1 - sc.t0, drift = Math.sin(lt * 2.6) * 0.03;
      G1.el.style.transform = `translate(-50%,-50%) translateY(${((0.16 + drift) * px).toFixed(1)}px)`;
      G2.el.style.transform = `translate(-50%,-50%) translateY(${((0.32 - drift) * px).toFixed(1)}px)`;
      B.words.forEach((rw, i) => {
        const a = appear(rw.w), dur = wordDur(rw.w, 0.18, 0.4);
        [[G2.words[i], 0.12], [G1.words[i], 0.06]].forEach(([gw, lag]) => {
          if (lt < a + lag) K.showWord(gw, false);
          else { K.typeWord(gw, lt, a + lag, dur, sc.seed, false); finish(gw, lt, d, sc, ""); }
        });
        if (lt < a) { K.showWord(rw, false); return; }
        K.typeWord(rw, lt, a, dur, sc.seed, false);
        const e = ease.expo(prog(lt, a, 0.28));
        finish(rw, lt, d, sc, `skewX(${(-22 * (1 - e)).toFixed(2)}deg) translateX(${(-(1 - e) * 0.3).toFixed(3)}em)`);
      });
    } };
  };

  /* 5 · subtítulo: línea slab tecleada con cursor rojo y el resto pequeño, espaciado, debajo */
  R.scenes.subtitle = (sc, ctx) => {
    const P = portrait(ctx), n = sc.words.length;
    const k = sc.split != null ? clamp(sc.split, 1, n) : (n <= 2 ? n : n <= 4 ? 2 : Math.min(3, Math.ceil(n / 2)));
    const main = sc.words.slice(0, k), rest = sc.words.slice(k);
    const f = ctx.fonts.slab, fs = ctx.fonts.sans, root = el("div", "nz-scene");
    const ml = K.wrap(main, P ? 10 : 18, 1, 2);
    const px = K.fitSize(ml, f, ctx.W * (P ? 0.84 : 0.62), ctx.H * (P ? 0.24 : 0.26));
    const B = K.block(root, ml, f, px);
    let S = null;
    if (rest.length) {
      const sl = K.wrap(rest, P ? 22 : 44, 1, 2);
      const spx = Math.min(Math.max(11, px * 0.2), K.fitSize(sl, fs, ctx.W * 0.8, ctx.H * 0.12));
      S = K.block(root, sl, fs, spx, { cls: "nz-sub" });
      placeY(S, ctx.H / 2 + B.heightPx / 2 + spx * 0.7 + S.heightPx / 2);
    }
    const cur = el("div", "nz-cursor", root);
    Object.assign(cur.style, { width: Math.max(2, px * 0.06) + "px", height: (px * 0.72) + "px" });
    const mainEnd = Math.max(...main.map(w => w.end));
    return { root, sub: S, update(lt) {
      const d = sc.t1 - sc.t0;
      let last = null;
      for (const rw of B.words) {
        const a = appear(rw.w);
        if (lt < a) { K.showWord(rw, false); continue; }
        K.typeWord(rw, lt, a, wordDur(rw.w, 0.2, 0.45), sc.seed, false);
        const vis = rw.chars.filter(c => c.vis);
        if (vis.length) last = vis[vis.length - 1].el;
        finish(rw, lt, d, sc, "");
      }
      if (S) for (const rw of S.words) {
        const a = appear(rw.w);
        if (lt < a) { K.showWord(rw, false); continue; }
        K.typeWord(rw, lt, a, wordDur(rw.w, 0.15, 0.35), sc.seed + 7, true);
        finish(rw, lt, d, sc, "");
      }
      const blink = lt < mainEnd + 0.1 || Math.floor(lt * 3.2) % 2 === 0;
      const show = last && blink && lt < d - (sc.glitch || 0.15);
      if (show) {
        const r = last.getBoundingClientRect();
        cur.style.transform = `translate(${(r.right + px * 0.05).toFixed(1)}px, ${(r.top + r.height * 0.14).toFixed(1)}px)`;
      }
      cur.style.visibility = show ? "visible" : "hidden";
    } };
  };

  /* 6 · marco: grotesca extendida, recuadro que se traza alrededor, subtítulo encima del borde inferior;
         al salir las letras se van de derecha a izquierda */
  R.scenes.frame = (sc, ctx) => {
    const P = portrait(ctx), n = sc.words.length;
    let k = sc.split != null ? clamp(sc.split, 1, n) : 1;
    if (sc.split == null && n >= 2 && [...sc.words[0].text].length <= 3) k = 2;
    const main = sc.words.slice(0, k), rest = sc.words.slice(k);
    const f = ctx.fonts.expanded, fs = ctx.fonts.sans, root = el("div", "nz-scene");
    const ml = K.wrap(main, P ? 8 : 14, 1, 2);
    const px = K.fitSize(ml, f, ctx.W * (P ? 0.82 : 0.68), ctx.H * (P ? 0.24 : 0.3));
    const B = K.block(root, ml, f, px);
    const frame = el("div", "nz-frame", root);
    const pad = px * 0.16, fw = B.widthPx + pad * 2.6, fh = B.heightPx + pad * 1.4;
    Object.assign(frame.style, { left: (ctx.W / 2 - fw / 2) + "px", top: (ctx.H / 2 - fh / 2) + "px", width: fw + "px", height: fh + "px",
      borderWidth: Math.max(1.5, ctx.u * 0.22) + "px" });
    let S = null;
    if (rest.length) {
      const sl = K.wrap(rest, P ? 24 : 48, 1, 2);
      const spx = Math.min(Math.max(10, px * 0.13), K.fitSize(sl, fs, fw * 0.92, fh * 0.3));
      S = K.block(root, sl, fs, spx, { cls: "nz-sub nz-onframe" });
      placeY(S, ctx.H / 2 + fh / 2 - spx * 0.2);
    }
    const allChars = B.words.flatMap(rw => rw.chars.map(ch => ({ rw, ch })));
    const fa = Math.max(...main.map(w => w.end)) - 0.05;
    return { root, update(lt) {
      const d = sc.t1 - sc.t0, E = Math.min(0.55, d * 0.3), exitP = prog(lt, d - E, E * 0.8);
      for (const rw of B.words) {
        const a = appear(rw.w);
        if (lt < a) { K.showWord(rw, false); continue; }
        K.typeWord(rw, lt, a, 0.3, sc.seed, true);
        finish(rw, lt, d, sc, "");
      }
      if (exitP > 0) {
        const keep = Math.max(1, Math.ceil(allChars.length * (1 - exitP)));
        allChars.forEach((o, i) => { if (i >= keep) K.setChar(o.ch, o.ch.c, false); });
      }
      const fx = ease.expo(prog(lt, fa, 0.25)) * (1 - ease.in(exitP)), fy = ease.expo(prog(lt, fa + 0.12, 0.25)) * (1 - ease.in(exitP));
      frame.style.clipPath = `inset(${((1 - fy) * 50).toFixed(2)}% ${((1 - fx) * 50).toFixed(2)}%)`;
      if (S) for (const rw of S.words) {
        const a = Math.max(appear(rw.w), fa + 0.1);
        if (lt < a || exitP > 0.4) { K.showWord(rw, false); continue; }
        K.typeWord(rw, lt, a, wordDur(rw.w, 0.15, 0.35), sc.seed + 3, true);
        finish(rw, lt, d, sc, "");
      }
    } };
  };

  /* 7 · caja: primer renglón en caja blanca (texto negro) que se abre; el resto debajo con mezcla de caracteres */
  R.scenes.box = (sc, ctx) => {
    const P = portrait(ctx), f = ctx.fonts.expanded, root = el("div", "nz-scene");
    const lines = K.wrap(sc.words, P ? 11 : 19, 2, P ? 5 : 3);
    const px = K.fitSize(lines, f, ctx.W * (P ? 0.78 : 0.56), ctx.H * (P ? 0.44 : 0.48), 1.1);
    const B1 = K.block(root, [lines[0]], f, px, { cls: "nz-boxed" });
    const B2 = lines.length > 1 ? K.block(root, lines.slice(1), f, px * 0.72) : null;
    const gap = px * 0.18, total = B1.heightPx * 1.1 + (B2 ? gap + B2.heightPx : 0);
    placeY(B1, ctx.H / 2 - total / 2 + B1.heightPx * 0.55);
    if (B2) placeY(B2, ctx.H / 2 - total / 2 + B1.heightPx * 1.1 + gap + B2.heightPx / 2);
    const words = B1.words.concat(B2 ? B2.words : []);
    return { root, update(lt) {
      const d = sc.t1 - sc.t0;
      const o = ease.expo(prog(lt, 0, 0.22)), c = ease.in(prog(lt, d - 0.22, 0.2));
      B1.el.style.clipPath = c > 0 ? `inset(0 0 0 ${(c * 100).toFixed(1)}%)` : `inset(0 ${((1 - o) * 100).toFixed(1)}% 0 0)`;
      for (const rw of words) {
        const a = Math.max(rw.line === 0 && B1.words.includes(rw) ? 0.12 : 0, appear(rw.w));
        if (lt < a) { K.showWord(rw, false); continue; }
        K.typeWord(rw, lt, a, wordDur(rw.w, 0.12, 0.3), sc.seed, true);
        finish(rw, lt, d, sc, "");
      }
    } };
  };

  /* 8 · resaltado: condensada alineada a la izquierda; la palabra cantada va en bloque blanco */
  R.scenes.highlight = (sc, ctx) => {
    const P = portrait(ctx), f = ctx.fonts.condensed, root = el("div", "nz-scene");
    const lines = K.wrap(sc.words, P ? 12 : 22, 2, P ? 5 : 3);
    const px = K.fitSize(lines, f, ctx.W * (P ? 0.84 : 0.6), ctx.H * 0.46, 1.08);
    const B = K.block(root, lines, f, px, { align: "left" });
    return { root, update(lt) {
      const d = sc.t1 - sc.t0;
      for (const rw of B.words) {
        const a = appear(rw.w);
        if (lt < a) { K.showWord(rw, false); continue; }
        K.showWord(rw, true);
        const hl = lt < rw.w.end + 0.06 && lt < d - 0.2;
        if (rw.hl !== hl) { rw.el.classList.toggle("nz-hl", hl); rw.hl = hl; }
        const e = ease.out(prog(lt, a, 0.14));
        finish(rw, lt, d, sc, `translateY(${((1 - e) * 0.3).toFixed(3)}em)`);
      }
    } };
  };

  /* pausa sin letra: línea que barre el centro y un recuadro vacío que parpadea */
  R.pause = (sc, ctx) => {
    const root = el("div", "nz-scene");
    const line = el("div", "nz-sweep", root);
    Object.assign(line.style, { left: (ctx.W * 0.15) + "px", top: (ctx.H / 2) + "px", width: (ctx.W * 0.7) + "px", height: Math.max(1.5, ctx.u * 0.18) + "px" });
    const box = el("div", "nz-frame", root);
    const s = ctx.u * 7;
    Object.assign(box.style, { left: (ctx.W / 2 - s * 0.4) + "px", top: (ctx.H / 2 - s * 0.5 - ctx.u * 4) + "px", width: (s * 0.8) + "px", height: s + "px",
      borderWidth: Math.max(1.5, ctx.u * 0.22) + "px" });
    return { root, update(lt) {
      const d = sc.t1 - sc.t0;
      const g = ease.expo(prog(lt, 0, Math.min(0.5, d * 0.4))), out = ease.in(prog(lt, d - 0.25, 0.22));
      line.style.transformOrigin = out > 0 ? "right center" : "left center";
      line.style.transform = `scaleX(${(out > 0 ? 1 - out : g).toFixed(4)})`;
      box.style.visibility = d > 1.2 && lt > 0.35 && lt < d - 0.3 && Math.floor(lt * 4) % 2 === 0 ? "visible" : "hidden";
    } };
  };

  /* palabras sintéticas para intro/outro y vistas previas */
  N.synthWords = (text, start, step, dur = 0.3) => String(text || "").toLocaleUpperCase("es").split(/\s+/).filter(Boolean)
    .map((t, i) => ({ text: t, start: start + i * step, end: start + i * step + dur }));
})(typeof window !== "undefined" ? window : globalThis);

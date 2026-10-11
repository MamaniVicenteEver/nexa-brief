/* =============================================================================
   grunge · frase narrada palabra por palabra, al ritmo de la voz
   Cada palabra dicha dentro del beat es un CORTE SECO a la "palabra entera" de la
   referencia (fase B): a todo el ancho, letras con texturas distintas, fondo que
   alterna oscuro / color. Las palabras clave llevan brochazo y golpe de negativo.
   ========================================================================== */
(function () {
  const K = Kit, GR = Kit.grunge, { clamp } = K;
  const clean = s => String(s).replace(/[¿?¡!.,;:«»"“”()…]+/g, "").toUpperCase();

  K.register({
    name: "grunge.stamp", tags: ["frase", "cita", "clímax", "letra"], layer: "main",
    summary: "Frase narrada en cortes secos: cada palabra que dice la voz dentro del beat aparece SOLA a todo el ancho (como la palabra entera de la referencia), con texturas de tinta y fondo que alterna casi negro / color plano; las palabras de `accent` llevan brochazo detrás y golpe de negativo; la última se erosiona al salir.",
    example: { accent: ["inmediato"] },
    params: {
      accent: { type: "array", default: [], doc: "Palabras clave (sin tildes/mayúsculas importa): brochazo detrás + negativo de 3 cuadros." },
      skip: { type: "array", default: [], doc: "Palabras que NO se muestran (artículos, muletillas): la anterior se queda en pantalla." },
      color: { type: "string", default: "auto", doc: "Color plano (auto | cream | mustard | mint | coral | petrol | pink | #hex)." },
      polarity: { type: "enum", options: ["auto", "dark", "light"], default: "auto", doc: "Fondo de la primera palabra; después alterna." },
      flip: { type: "enum", options: ["auto", "none", "x", "y"], default: "auto", doc: "Espejo/volteo del negativo de las palabras clave." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, sc = GR.scene(ctx, p), b0 = ctx.beat, rnd = ctx.rng;
      ctx.beat.hideCaptions = true;
      const acc = new Set((p.accent || []).map(K.norm)), skip = new Set((p.skip || []).map(K.norm));
      const ws = ctx.words.filter(w => w.start >= b0.t0 - 0.05 && w.start < b0.t1 - 0.05 && clean(w.text) && !skip.has(w.n));
      const { S, T, D } = sc, sp = GR.S.tex.speck[2], scr = GR.S.tex.scratch;
      const looks = [
        { fill: S, tex: [{ tex: scr, color: D, alpha: 0.85 }] },
        { fill: GR.mix(T, S, 0.35), tex: [{ tex: sp, color: D, alpha: 0.75, sc: 1.4 }] },
        { fill: GR.mix(S, D, 0.2), tex: [{ tex: scr, color: D, alpha: 0.6, ox: -W * 0.15 }, { tex: sp, color: S, alpha: 0.35 }] },
      ];
      const looksL = [
        { fill: GR.mix(S, D, 0.82), tex: [{ tex: scr, color: S, alpha: 0.35 }] },
        { fill: D, tex: [{ tex: sp, color: GR.mix(S, D, 0.5), alpha: 0.6, sc: 1.4 }] },
      ];
      const cache = new Map();
      const lay = i => {
        if (!cache.has(i)) {
          const word = clean(ws[i].text), capMax = portrait ? 0.2 : 0.42;
          const fs = Math.min(GR.fitFs([word], W * (portrait ? 0.92 : 0.94)), H * capMax / GR.CAP);
          const L = GR.layout({ lines: [word], fs, align: "center", x: W / 2, cy: H / 2 });
          cache.set(i, { L, eat: GR.erosion(L, K.rng(Math.floor(i * 7919 + 13)), false), off: Math.floor(rnd() * 3) });
        }
        return cache.get(i);
      };
      for (let i = 0; i < ws.length; i++) lay(i);
      const base = sc.light ? 1 : 0;
      return {
        render(lt, b, t) {
          GR.current(ctx, sc);
          let i = -1; for (let k = 0; k < ws.length; k++) if (t >= ws[k].start - 0.04) i = k;
          const lightBg = ((Math.max(0, i) + base) % 2) === 1;
          GR.fill(ctx, lightBg ? S : D);
          GR.grime(ctx, lightBg ? D : S, lightBg ? 0.35 : 0.18, t);
          if (i < 0) return;
          const w = ws[i], { L, eat, off } = lay(i), isAcc = acc.has(w.n), wl = t - (w.start - 0.04);
          if (isAcc) GR.band(ctx, { y0: L.top - L.ch * 0.3, y1: L.bottom + L.ch * 0.45, color: lightBg ? GR.mix(T, D, 0.1) : GR.mix(S, D, 0.35), alpha: 1, wipe: clamp(wl / 0.1 + 0.3) });
          const q = clamp((lt - (b.dur - 0.35)) / 0.25);
          const set = lightBg ? looksL : looks;
          GR.ink(ctx, { L, letters: set.map((_, k) => set[(k + off) % set.length]), holes: { alpha: 0.85, ox: -W * (i % 3) * 0.1 }, erode: i === ws.length - 1 && q > 0 ? g => eat(g, q) : null });
          const r = K.rng(GR.boilFrame(t) * 31 + 7), u = ctx.stage.u;
          const amt = wl < 0.13 ? W * 0.05 * (1 - wl / 0.13) : 0;
          GR.put(ctx, { dx: (r() - 0.5) * u * 0.2, dy: (r() - 0.5) * u * 0.2, slices: amt ? GR.tear(L, amt) : null });
          if (isAcc && wl >= 0.067 && wl < 0.167) GR.fx(ctx, { neg: true, flipX: sc.flip === "x", flipY: sc.flip === "y" });
        },
      };
    },
  });
})();

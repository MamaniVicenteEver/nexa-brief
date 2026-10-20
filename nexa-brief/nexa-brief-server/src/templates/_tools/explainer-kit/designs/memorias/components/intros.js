/* =============================================================================
   memorias · intros (gancho de apertura) con el contrato común de designs/common/hook.js
   -----------------------------------------------------------------------------
   introv1 "golpe": titular MANUSCRITO gigante que se escribe palabra a palabra
           sobre el papel; en dropAt revienta una salpicadura de acuarela detrás
           del titular (gotas + sacudida) y la palabra ^marcada^ se tiñe de azul.
   introv2 "pregunta + revelación": la pregunta en MAYÚSCULAS se arma letra a
           letra (glifos que parpadean, como "FIRST INFORMATION"); en stampAt la
           respuesta se escribe en manuscrita sobre una salpicadura azul.
   Fondo (bg): sketch (por defecto: la foto de src como boceto que se colorea, o
   humo si no hay foto) | smoke (papel con humo gris y periódico fantasma) |
   image | component | none. dim = velo de PAPEL sobre el fondo (paleta clara).
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, M = K.memorias, { clamp, lerp, prog } = K;

  /** fondo de las intros: un plano memorias (boceto→color) o el contrato común */
  function backdrop(ctx, p) {
    const mode = p.bg === "auto" ? (p.src ? "sketch" : "smoke") : p.bg;
    if (mode === "sketch" || (mode === "image" && p.src)) {
      const sc = M.scene(ctx, { src: p.src, focus: p.focus, reveal: mode === "image" ? "full" : "right", splash: "none", ghost: true, smokes: 2 });
      return { render: (lt, b, t) => { sc.render(lt, b, t); veil(ctx, p.dim ?? 0.45); }, dispose() {} };
    }
    if (mode === "smoke" || mode === "sketch") {
      const sc = M.scene(ctx, { reveal: "none", splash: "none", ghost: true, smokes: 3 });
      return { render: (lt, b, t) => sc.render(lt, b, t), dispose() {} };
    }
    const hb = K.hook.bg(ctx, { ...p, dim: 0 });
    return { render: (lt, b, t) => { hb.render(lt, b, t); if (hb.mode !== "none") veil(ctx, p.dim ?? 0.45); }, dispose: () => hb.dispose() };
  }
  /** velo de papel (no oscurece: lava hacia el papel claro, como la referencia) */
  function veil(ctx, a) {
    if (a <= 0) return;
    const { W, H } = ctx.stage, G = ctx.g.main, P = ctx.C.palette;
    G.save(); G.globalAlpha = a; G.fillStyle = P.paperHi; G.fillRect(0, 0, W, H); G.restore();
  }
  /** "TEXTO con ^marca^" → [{ text, hot }] por palabra */
  function words(line) {
    const out = []; let hot = false;
    for (const part of String(line).split("^")) { for (const w of part.split(/\s+/).filter(Boolean)) out.push({ text: w, hot }); hot = !hot; }
    return out;
  }
  const shakeAt = (lt, t0, amp) => { const d = lt - t0; if (d < 0 || d > 0.45) return [0, 0]; const e = Math.exp(-d * 9) * amp; return [Math.sin(d * 83) * e, Math.cos(d * 71) * e * 0.7]; };

  const BG = K.hook.bgParams(["sketch", "smoke"]);
  BG.dim.default = 0.45; BG.dim.doc = "Velo de papel sobre el fondo (0 = nada; paleta clara: lava hacia el papel).";

  /* ------------------------------------------------------------ introv1 */
  K.register({
    name: "memorias.introv1", tags: ["intro", "gancho", "apertura", "titular", "acuarela"], layer: "main",
    summary: "Gancho 'golpe': titular MANUSCRITO gigante (Mr Dafoe) que se escribe palabra a palabra sobre el papel, con rótulo en MAYÚSCULAS que se arma letra a letra arriba y subtítulo en Quicksand abajo; en dropAt revienta una salpicadura de acuarela azul detrás del titular con gotas y una sacudida, y la palabra ^marcada^ se tiñe de azul. Fondo: sketch (foto en boceto que se colorea) | smoke | image | component | none.",
    example: { text: "La noche que\ncayó el ^Muro^", kicker: "Berlín · 1989", sub: "nadie dio la orden", src: "assets/media/brandenburgo.jpg" },
    params: {
      text: { type: "string", required: true, doc: "Titular manuscrito ('\\n' = renglón; '^x^' = palabra que se tiñe de azul en el golpe)." },
      kicker: { type: "string", default: "", doc: "Rótulo en MAYÚSCULAS arriba (se arma letra a letra)." },
      sub: { type: "string", default: "", doc: "Línea chica abajo (Quicksand)." },
      wordAt: { type: "number", default: 0.45, min: 0, doc: "Segundo en que empieza a escribirse la primera palabra." },
      stagger: { type: "number", default: 0.3, min: 0.05, doc: "Segundos entre palabra y palabra." },
      dropAt: { type: "number", default: 2.3, min: -1, doc: "Segundo del golpe (salpicadura + sacudida); −1 = sin golpe; acepta '@palabra'." },
      ...BG,
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, P = ctx.C.palette, bg = backdrop(ctx, p);
      const lines = String(p.text).split("\n").map(words);
      const ref = 100, font = s => `400 ${s}px 'Mr Dafoe'`, space = M.measure(" ", font(ref));
      const wMax = Math.max(...lines.map(l => l.reduce((a, w) => a + M.measure(w.text, font(ref)), 0) + space * (l.length - 1)));
      const fs = Math.min(ref * W * (portrait ? 0.88 : 0.74) / wMax, H * (portrait ? 0.11 : 0.24) / Math.max(1, lines.length * 0.62));
      const lh = fs * 0.95, kFs = fs * (portrait ? 0.24 : 0.2), sFs = fs * 0.24;
      const blockH = lh * lines.length, cy = H * (portrait ? 0.42 : 0.5), y0 = cy - blockH / 2;
      /* posiciones por palabra (centradas por renglón) */
      const items = []; let n = 0;
      lines.forEach((l, li) => {
        const ws = l.map(w => M.measure(w.text, font(fs))), tot = ws.reduce((a, b) => a + b, 0) + M.measure(" ", font(fs)) * (l.length - 1);
        let x = W / 2 - tot / 2;
        l.forEach((w, i) => { items.push({ ...w, x, y: y0 + lh * (li + 0.8), w: ws[i], at: p.wordAt + n * p.stagger }); x += ws[i] + M.measure(" ", font(fs)); n++; });
      });
      const drop = p.dropAt != null && p.dropAt >= 0 ? p.dropAt : null;
      const spl = drop != null ? M.makeSplash(ctx, W * 0.5, cy, Math.min(W, H) * (portrait ? 0.36 : 0.3), { seed: 911, side: portrait ? 0.3 : 1.6 }) : null;
      const kick = p.kicker ? M.textBlock(ctx, [{ kind: "caps", text: p.kicker }], { x: W / 2, y: y0 - kFs * 1.9, align: "center", at: 0.2, caps: kFs, seed: 5 }) : null;
      return {
        render(lt, b, t) {
          bg.render(lt, b, t);
          const G = ctx.g.main, out = 1 - prog(lt, b.dur - 0.25, 0.6, "sine");
          if (out <= 0.002) return;
          const [sx, sy] = drop != null ? shakeAt(lt, drop, Math.min(W, H) * 0.012) : [0, 0];
          G.save(); G.translate(sx, sy);
          if (spl) spl.draw(G, lt, drop, out);
          G.textBaseline = "alphabetic"; G.textAlign = "left"; G.font = font(fs);
          G.shadowColor = M.rgba(P.paperHi, 0.75); G.shadowBlur = fs * 0.1;
          for (const it of items) {
            const q = M.ease4((lt - it.at) / 0.55);
            if (q <= 0) continue;
            G.save(); G.beginPath(); G.rect(it.x - fs * 0.5, it.y - fs * 1.2, (it.w + fs * 0.9) * q, fs * 1.8); G.clip();
            const hot = it.hot && drop != null ? prog(lt, drop + 0.05, 0.35, "out") : 0;
            G.globalAlpha = out; G.fillStyle = hot > 0.5 ? P.splashDeep : P.script;
            /* al teñirse, el trazo azul queda arriba y "sangra" un poco */
            if (hot > 0) { G.save(); G.globalAlpha = out * hot * 0.35; G.filter = `blur(${(fs * 0.03).toFixed(1)}px)`; G.fillStyle = P.splash; G.fillText(it.text, it.x, it.y); G.restore(); }
            G.fillText(it.text, it.x, it.y);
            G.restore();
          }
          G.restore();
          if (kick) kick.draw(G, lt, out);
          if (p.sub) {
            const t0 = (items.at(-1)?.at ?? 0) + 0.5, q = M.ease4((lt - t0) / 0.7), y = y0 + blockH + sFs * 1.3, w = M.measure(p.sub, `700 ${sFs}px Quicksand`);
            if (q > 0) { G.save(); G.beginPath(); G.rect(W / 2 - w / 2 - sFs, y - sFs * 1.3, (w + sFs * 2) * q, sFs * 2); G.clip(); G.globalAlpha = out; G.fillStyle = P.ink; G.font = `700 ${sFs}px Quicksand`; G.textAlign = "center"; G.shadowColor = M.rgba(P.paperHi, 0.8); G.shadowBlur = sFs * 0.5; G.fillText(p.sub, W / 2, y); G.restore(); }
          }
        },
        dispose() { bg.dispose(); },
      };
    },
  });

  /* ------------------------------------------------------------ introv2 */
  K.register({
    name: "memorias.introv2", tags: ["intro", "gancho", "pregunta", "revelación", "acuarela"], layer: "main",
    summary: "Gancho 'pregunta + revelación': la pregunta en MAYÚSCULAS (Barlow 700) se arma letra a letra con glifos que parpadean; en stampAt la respuesta se escribe en manuscrita grande sobre una salpicadura de acuarela azul que revienta con gotas. Fondo: sketch | smoke | image | component | none.",
    example: { text: "¿Quién abrió\nel muro?", kicker: "Berlín, 1989", stamp: "Nadie dio la orden", src: "assets/media/bernauer.jpg" },
    params: {
      text: { type: "string", required: true, doc: "La pregunta ('\\n' = renglón)." },
      kicker: { type: "string", default: "", doc: "Renglón manuscrito chico arriba de la pregunta." },
      stamp: { type: "string", default: "", doc: "La respuesta (manuscrita grande sobre la salpicadura)." },
      stampAt: { type: "number", default: 2.4, min: 0, doc: "Segundo de la respuesta; acepta '@palabra'." },
      typeAt: { type: "number", default: 0.35, min: 0, doc: "Segundo en que empieza a armarse la pregunta." },
      cps: { type: "number", default: 22, min: 4, doc: "Letras por segundo de la pregunta." },
      ...BG,
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, P = ctx.C.palette, bg = backdrop(ctx, p);
      const q = String(p.text).toUpperCase().split("\n"), ref = 100;
      const wq = Math.max(...q.map(l => M.measure(l, `700 ${ref}px Barlow`)));
      const fs = Math.min(ref * W * (portrait ? 0.84 : 0.52) / wq, H * (portrait ? 0.07 : 0.11));
      const x = portrait ? W * 0.08 : W * 0.1, y0 = portrait ? H * 0.2 : H * 0.3;
      const kFs = fs * 0.62, lh = fs * 1.08;
      const sFs = Math.min(ref * W * (portrait ? 0.8 : 0.5) / Math.max(1, M.measure(p.stamp || " ", `400 ${ref}px 'Mr Dafoe'`)), H * (portrait ? 0.08 : 0.16));
      const sy = y0 + (p.kicker ? kFs * 1.2 : 0) + lh * q.length + sFs * (portrait ? 1.4 : 1.25);
      const sw = M.measure(p.stamp || "", `400 ${sFs}px 'Mr Dafoe'`);
      const spl = p.stamp ? M.makeSplash(ctx, x + sw * 0.5, sy - sFs * 0.3, Math.max(sw * 0.62, sFs * 1.3), { seed: 377, side: 1.2, mode: "normal" }) : null;
      const lines = [...(p.kicker ? [{ kind: "script", text: p.kicker }] : []), ...q.map(t => ({ kind: "caps", text: t }))];
      const tb = M.textBlock(ctx, lines, { x, y: y0, align: "left", at: p.typeAt, step: 0.12 + q.join("").length / q.length / p.cps, caps: fs, script: kFs, seed: 17 });
      return {
        render(lt, b, t) {
          bg.render(lt, b, t);
          const G = ctx.g.main, out = 1 - prog(lt, b.dur - 0.25, 0.6, "sine");
          if (out <= 0.002) return;
          const [dx, dy] = p.stamp ? shakeAt(lt, p.stampAt, Math.min(W, H) * 0.008) : [0, 0];
          G.save(); G.translate(dx, dy);
          if (spl) spl.draw(G, lt, p.stampAt, out);
          tb.draw(G, lt, out);
          if (p.stamp) {
            const qq = M.ease4((lt - p.stampAt - 0.12) / 0.8);
            if (qq > 0) {
              G.save(); G.beginPath(); G.rect(x - sFs * 0.5, sy - sFs * 1.3, (sw + sFs) * qq, sFs * 1.9); G.clip();
              G.globalAlpha = out; G.font = `400 ${sFs}px 'Mr Dafoe'`; G.fillStyle = P.paperHi; G.textBaseline = "alphabetic";
              G.shadowColor = "rgba(10,20,40,.6)"; G.shadowBlur = sFs * 0.12; G.fillText(p.stamp, x, sy); G.restore();
            }
          }
          G.restore();
        },
        dispose() { bg.dispose(); },
      };
    },
  });
})();

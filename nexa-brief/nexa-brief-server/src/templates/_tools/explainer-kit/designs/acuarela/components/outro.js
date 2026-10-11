/* =============================================================================
   acuarela · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: papel con una aguada sepia que barre y pinceladas que chorrean
   (o manchas, línea de tiempo, página manuscrita, foto o componente).
   Secuencia sincronizada con la despedida narrada:
   GRACIAS POR VER (con rayas) → CANAL gigante en Oswald ladrillo, comido por
   tinta sobre una aguada que florece, subrayado a pincel y FIRMA manuscrita →
   LIKE (pulgar a tinta que se llena de acuarela ladrillo al marcarse y un
   círculo a pincel) → flecha a pincel → PINCELADA "SUSCRÍBETE" + campana a
   tinta que suena → mensaje de apoyo por manchas → youtube.com/@canal.
   Los tiempos (likeAt, subscribeAt, bellAt, supportAt) son los del contrato
   común (Kit.hook.outroTimes), así el storyboard que ya los sincroniza con la
   voz sigue sirviendo. El fundido a negro final lo pone además el runtime.
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, A = K.acuarela, Hk = K.acuarela.hook, { clamp, lerp, prog, ease } = K;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  /** campana a tinta (x,y = centro), s = escala */
  function bell(G, x, y, s, rot, rays, color) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    G.fillStyle = color; G.strokeStyle = color; G.lineJoin = "round";
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, 7); G.fill();
    G.restore();
    if (rays > 0) {
      G.save(); G.strokeStyle = color; G.globalAlpha *= rays; G.lineWidth = s * 0.5; G.lineCap = "round";
      for (const d of [-1, 1]) for (const k of [0, 1]) { const R = s * (6 + k * 2.2 + (1 - rays) * 1.5); G.beginPath(); G.arc(x, y - s * 0.6, R, d < 0 ? Math.PI * 0.82 : -Math.PI * 0.18, d < 0 ? Math.PI * 1.18 : Math.PI * 0.18); G.stroke(); }
      G.restore();
    }
  }
  /** círculo a pincel (vuelta y algo más, levemente irregular) */
  function ring(cx, cy, rx, ry, seed) {
    const r = K.rng(seed), a0 = -2.2 + r() * 0.4, pts = [];
    for (let k = 0; k <= 70; k++) { const s = k / 70, a = a0 + s * Math.PI * 2.15, g = 1 + 0.05 * Math.sin(a * 3 + seed) + s * 0.06; pts.push([cx + Math.cos(a) * rx * g, cy + Math.sin(a) * ry * g]); }
    return pts;
  }

  K.register({
    name: "acuarela.outro", tags: ["cierre", "canal", "like", "suscribirse", "tinta"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro (bg: wash | blots | timeline | manuscript | image con src | component con use/useParams): por defecto papel con una aguada sepia que barre y pinceladas que chorrean. GRACIAS POR VER con rayas → nombre del canal GIGANTE en Oswald ladrillo que la tinta 'come' sobre una aguada que florece, subrayado a pincel y firma manuscrita → pulgar a tinta que se llena de acuarela ladrillo al marcar LIKE + círculo a pincel → flecha a pincel → pincelada SUSCRÍBETE con el texto calado + campana a tinta que suena → mensaje de apoyo por manchas → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "NODETECH", cta: "SUSCRÍBETE", support: "Tu apoyo nos ayuda a seguir creando y traer más historias.", handle: "youtube.com/@nodetech" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte la historia." }),
      ...K.hook.bgParams(["wash", "blots", "timeline", "manuscript"]),
      dim: { type: "number", default: 0.65, min: 0, max: 1, doc: "Velo de papel sobre el fondo foto/componente (el cierre tiene mucho texto; paleta clara: se lava hacia el papel)." },
      blot: Hk.BLOT,
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, P = ctx.C.palette, cx = W / 2;
      const name = String(p.channel || "").toUpperCase(), cta = String(p.cta || "").toUpperCase();
      /* nombre del canal: ~62 % del ancho en 16:9, 86 % en 9:16 */
      const fs = Math.min(100 * W * (portrait ? 0.88 : 0.6) / Math.max(1, Hk.measure(name, Hk.font("title", 100, 500))), H * (portrait ? 0.11 : 0.2));
      const Y = portrait
        ? { thanks: 0.22, name: 0.315, like: 0.475, sub: 0.61, sup: 0.72, handle: 0.81 }
        : { thanks: 0.13, name: 0.3, like: 0.6, sub: 0.6, sup: 0.77, handle: 0.87 };
      const thanks = Hk.label(ctx, p.thanks, { fam: "cond", weight: 600, size: u * (portrait ? 3.4 : 2.4), color: P.ink, upper: true, spacing: u * 0.7, from: "center", seed: 301 });
      const nameL = Hk.label(ctx, name, { fam: "title", weight: 500, size: fs, color: P.date, from: "center", rough: 0.42, seed: 303 });
      const nameY = H * Y.name, nameW = nameL.w;
      const wash = Hk.blob(ctx, nameW * 1.25 + fs, fs * 2.2, { color: P.sepia, seed: 305, n: 6, a0: 0.45, a1: 0.55, rim: 0.4 });
      const ul = Hk.curve(cx - nameW * 0.46, nameY + fs * 0.62, cx, nameY + fs * 0.7, cx + nameW * 0.46, nameY + fs * 0.58, 40);
      const sigTxt = String(p.channel || "").toLowerCase().replace(/^./, c => c.toUpperCase());
      const sig = Hk.label(ctx, sigTxt, { fam: "hand", weight: 400, size: fs * (portrait ? 0.62 : 0.5), color: P.hand, from: "left", rough: 0.22, seed: 307 });
      const sigX = cx + nameW * 0.5 - sig.w * 0.35, sigY = nameY + fs * (portrait ? 0.8 : 0.92);
      /* LIKE: pulgar a tinta + palabra */
      const likeFs = u * (portrait ? 10 : 6), iconS = likeFs * 1.15;
      const likeL = Hk.label(ctx, "LIKE", { fam: "title", weight: 600, size: likeFs, color: P.ink, spacing: likeFs * 0.04, from: "left", seed: 311 });
      const likeW = iconS + likeFs * 0.35 + likeL.w;
      /* pincelada SUSCRÍBETE */
      const BD = Hk.band(ctx, cta, u * (portrait ? 16 : 11), { seed: 321 });
      const bellS = u * (portrait ? 1.2 : 0.9);
      const LK = portrait ? { x: cx, y: H * Y.like } : { x: cx - W * 0.21, y: H * Y.like };
      const SB = portrait ? { x: cx - bellS * 4, y: H * Y.sub } : { x: cx + W * 0.11, y: H * Y.sub };
      const bellX = SB.x + BD.w / 2 + bellS * 7.5, bellY = SB.y + bellS * 0.3;
      const likeDab = Hk.blob(ctx, iconS * 2.1, iconS * 2.1, { color: P.accent, seed: 313, n: 4, a0: 0.6, a1: 0.4 });
      const ringPts = ring(LK.x, LK.y, likeW * 0.68 + u * 1.5, likeFs * 1.05, 315);
      const arrowPts = portrait
        ? Hk.curve(LK.x - likeW * 0.62, LK.y + likeFs * 0.9, LK.x - likeW * 1.0, (LK.y + SB.y) / 2 + u * 2, SB.x - BD.w * 0.5 - u * 2.5, SB.y - BD.h * 0.1, 40)
        : Hk.curve(LK.x + likeW * 0.68 + u * 2.5, LK.y - likeFs * 0.3, (LK.x + likeW / 2 + SB.x - BD.w / 2) / 2, LK.y - likeFs * 2.6, SB.x - BD.w * 0.5 - u * 2, SB.y - BD.h * 0.25, 40);
      /* apoyo + dirección */
      const supL = Hk.label(ctx, p.support, { fam: "cond", weight: 500, size: u * (portrait ? 4.8 : 3.4), color: P.ink, maxW: W * (portrait ? 0.82 : 0.6), lh: 1.22, patch: true, seed: 331 });
      const handle = String(p.handle || "");
      const hL = handle ? Hk.label(ctx, handle, { fam: "title", weight: 500, size: u * (portrait ? 4 : 3), color: P.date, spacing: u * 0.25, from: "center", seed: 333 }) : null;
      const supY = H * Y.sup, handleY = Math.max(H * Y.handle, supY + supL.h / 2 + u * (portrait ? 5 : 3.5));
      const BG = Hk.backdrop(ctx, p, { auto: "wash" });
      const rule = (G, x0, x1, y, q) => { if (q <= 0) return; const rw = u * (portrait ? 6 : 7) * q, gap = u * 2; G.save(); G.strokeStyle = P.rule; G.lineWidth = Math.max(1, u * 0.15); G.beginPath(); G.moveTo(x0 - gap, y); G.lineTo(x0 - gap - rw, y); G.moveTo(x1 + gap, y); G.lineTo(x1 + gap + rw, y); G.stroke(); G.restore(); };
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main;
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          const [sx, sy] = Hk.shake(lt, [subAt + 0.12], u * 0.6);
          G.save(); G.globalAlpha = exit;
          BG.render(lt, b, t);
          /* halo de papel detrás del bloque de texto */
          Hk.halo(G, P, cx, H * (portrait ? 0.52 : 0.5), W * (portrait ? 0.62 : 0.5), H * (portrait ? 0.42 : 0.5), BG.ext ? 0.85 : 0.55);
          /* GRACIAS POR VER */
          const ty = H * Y.thanks;
          thanks.draw(G, cx, ty, prog(lt, 0.05, 0.6, "linear"));
          rule(G, cx - thanks.w / 2, cx + thanks.w / 2, ty, prog(lt, 0.35, 0.5, "out"));
          /* canal: aguada que florece + tinta que come las letras + pincel + firma */
          wash.draw(G, cx - wash.w / 2, nameY - wash.h / 2, Hk.bloomTh(lt, 0.2, 1.1, 0.36, 0.06), 0.5, "multiply");
          const nq = prog(lt, 0.3, 0.9, "linear"), ns = 1 + 0.06 * (1 - A.ease4(nq));
          G.save(); G.translate(cx, nameY); G.scale(ns, ns); G.translate(-cx, -nameY);
          G.filter = `blur(${(fs * 0.03).toFixed(1)}px)`; nameL.draw(G, cx, nameY, nq, 0.3); G.filter = "none";
          nameL.draw(G, cx, nameY, nq); G.restore();
          Hk.brush(G, ul, prog(lt, 1.0, 0.45, "inOut"), { width: fs * 0.07, color: P.accent, alpha: 0.85, seed: 309, hairs: 11 });
          G.save(); G.translate(sigX, sigY); G.rotate(-0.07); G.translate(-sigX, -sigY);
          G.globalCompositeOperation = "multiply"; sig.draw(G, sigX, sigY, prog(lt, 1.25, 1.0, "linear"), 0.85); G.restore();
          /* LIKE: entra comido por tinta; al marcarse el pulgar se llena de acuarela */
          const lq = prog(lt, likeAt, 0.3, "linear");
          if (lq > 0) {
            const e = ease.expoOut(lq), s = 1 + 0.25 * (1 - e), pressAt = likeAt + 0.28, pq = prog(lt, pressAt, 0.35, "out");
            const pulse = 1 + 0.18 * Math.sin(Math.PI * clamp((lt - pressAt) / 0.3)) * (lt > pressAt ? 1 : 0);
            const ix = LK.x - likeW / 2 + iconS / 2, lx = LK.x - likeW / 2 + iconS + likeFs * 0.35 + likeL.w / 2;
            G.save(); G.translate(LK.x, LK.y); G.scale(s, s); G.translate(-LK.x, -LK.y);
            if (pq > 0) likeDab.draw(G, ix - likeDab.w / 2, LK.y - likeDab.h / 2, Hk.bloomTh(lt, pressAt, 0.5, 0.42, 0.04), 0.5, "multiply");
            G.save(); G.globalAlpha *= clamp(lq * 3); G.translate(ix, LK.y); G.scale(pulse, pulse); G.scale(iconS / 24, iconS / 24); G.translate(-12, -12.5);
            G.lineWidth = 1.3; G.strokeStyle = P.ink; G.lineJoin = "round"; G.stroke(THUMB);
            if (pq > 0) { G.globalAlpha *= pq; G.fillStyle = P.accent; G.fill(THUMB); }
            G.restore();
            likeL.draw(G, lx, LK.y + likeFs * 0.02, A.ease4(lq * 1.2));
            G.restore();
            Hk.splat(G, ix, LK.y, iconS * 1.6, prog(lt, pressAt, 0.45, "linear"), { seed: 317, n: 14, color: P.accent, alpha: 0.7, size: iconS * 0.05 });
            Hk.brush(G, ringPts, prog(lt, likeAt + 0.3, 0.45, "out"), { width: u * (portrait ? 0.9 : 0.7), color: P.ink, alpha: 0.75, seed: 319, hairs: 7 });
          }
          /* flecha a pincel */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.2, subAt - 0.15), ad = Math.max(0.3, subAt + 0.15 - a0), aq = prog(lt, a0, ad, "inOut");
            if (aq > 0) {
              Hk.brush(G, arrowPts, aq, { width: u * 0.65, color: P.ink, alpha: 0.75, seed: 323, hairs: 6 });
              const hq = prog(lt, a0 + ad * 0.85, 0.15);
              if (hq > 0) {
                const [x1, y1] = arrowPts[arrowPts.length - 1], [x0, y0] = arrowPts[arrowPts.length - 4], ang = Math.atan2(y1 - y0, x1 - x0), hl = u * 2.4;
                for (const d of [-0.55, 0.55]) Hk.brush(G, Hk.curve(x1, y1, x1 - Math.cos(ang + d) * hl * 0.5, y1 - Math.sin(ang + d) * hl * 0.5, x1 - Math.cos(ang + d) * hl, y1 - Math.sin(ang + d) * hl, 8), hq, { width: u * 0.55, color: P.ink, alpha: 0.75, seed: 325 + (d > 0), hairs: 5 });
              }
            }
          }
          /* pincelada SUSCRÍBETE (barre y golpea) */
          const sq = prog(lt, subAt, 0.36, "linear");
          if (sq > 0) {
            const e = A.ease4(sq), s = 1 + 0.08 * (1 - e);
            G.save(); G.translate(SB.x + sx, SB.y + sy); G.rotate(-0.02); G.scale(s, s);
            G.filter = `blur(${(BD.h * 0.05).toFixed(1)}px)`; BD.draw(G, 0, BD.h * 0.04, e, 0.25); G.filter = "none";
            BD.draw(G, 0, 0, e, 1); G.restore();
            Hk.splat(G, SB.x + BD.w * 0.48, SB.y, BD.h * 1.1, prog(lt, subAt + 0.28, 0.5, "linear"), { seed: 327, n: 18, color: P.accent, alpha: 0.8, size: BD.h * 0.045, dir: -0.15, spread: 1.8 });
          }
          /* campana a tinta: aparece y suena (oscilación amortiguada) */
          const bq = prog(lt, bellAt, 0.2, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.45;
            G.save(); G.globalAlpha *= bq; bell(G, bellX, bellY, bellS * (0.7 + 0.3 * bq), rot, clamp(1 - d / 1.4) * 0.8, P.ink); G.restore();
          }
          /* apoyo por manchas + dirección del canal con rayas */
          supL.draw(G, cx, supY, prog(lt, supAt, 0.9, "linear"));
          if (hL) {
            const hq = prog(lt, supAt + 0.35, 0.6, "linear");
            hL.draw(G, cx, handleY, hq);
            rule(G, cx - hL.w / 2, cx + hL.w / 2, handleY, prog(lt, supAt + 0.7, 0.5, "out"));
          }
          G.restore();
        },
      };
    },
  });
})();

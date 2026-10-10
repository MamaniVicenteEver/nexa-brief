/* =============================================================================
   carta · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: la gran hoja de papel viejo (la cámara sigue viajando, fotos con
   borde de pincel, carta que se escribe) o el sobre que se abre. Secuencia:
   "gracias por ver" manuscrito con pluma → NOMBRE DEL CANAL que llega volando
   desde el lente, entre dos reglas y con rúbrica → ESTAMPILLA "LIKE" que recibe
   el matasellos (queda marcada y el pulgar se entinta) → flecha a pluma → SELLO
   de goma SUSCRÍBETE + campana de tinta que suena → mensaje de apoyo tipeado →
   youtube.com/@canal tipeado abajo. Fundido final 0,4 s.
   Tiempos (likeAt, subscribeAt, bellAt, supportAt) = contrato común del cierre.
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, C = K.carta, Hk = C.hook, { clamp, prog, ease } = K;
  const INK = C.INK, ACC = "#120903";
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  /** campana dibujada a pluma (contorno + relleno de tinta), x,y = centro */
  function bell(G, x, y, s, rot, rays) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    const p = new Path2D();
    p.moveTo(0, -s * 4.5);
    p.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); p.lineTo(-s * 3.5, s * 2.4); p.lineTo(-s * 4.7, s * 3.7);
    p.lineTo(s * 4.7, s * 3.7); p.lineTo(s * 3.5, s * 2.4); p.lineTo(s * 3.5, -s * 0.2);
    p.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); p.closePath();
    G.fillStyle = "rgba(31,24,13,.92)"; G.fill(p);
    G.strokeStyle = "rgba(226,218,199,.55)"; G.lineWidth = s * 0.3; G.beginPath(); G.moveTo(-s * 2.2, -s * 1.8); G.quadraticCurveTo(-s * 2.4, s * 0.6, -s * 2.3, s * 2); G.stroke();
    G.fillStyle = "rgba(31,24,13,.92)"; G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, 7); G.fill();
    G.restore();
    if (rays > 0) {
      G.save(); G.strokeStyle = `rgba(31,24,13,${rays})`; G.lineWidth = s * 0.5; G.lineCap = "round";
      for (const d of [-1, 1]) for (const k of [0, 1]) { const R = s * (6.4 + k * 2 + (1 - rays) * 1.5); G.beginPath(); G.arc(x, y - s * 0.6, R, d < 0 ? Math.PI * 0.82 : -Math.PI * 0.18, d < 0 ? Math.PI * 1.18 : Math.PI * 0.18); G.stroke(); }
      G.restore();
    }
  }

  K.register({
    name: "carta.outro", tags: ["cierre", "canal", "like", "suscribirse", "carta"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro sobre la gran hoja de papel viejo (bg: hoja | sobre | image con src | component con use/useParams). 'gracias por ver' manuscrito con pluma → nombre del canal que llega volando desde el lente entre dos reglas y con rúbrica → estampilla LIKE que recibe un matasellos (queda marcada y el pulgar se entinta) → flecha a pluma → sello de goma SUSCRÍBETE + campana de tinta que suena → mensaje de apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "gracias por ver", channel: "NODETECH", cta: "SUSCRÍBETE", support: "Tu apoyo nos ayuda a seguir creando y traer más historias.", handle: "youtube.com/@nodetech" },
    params: {
      ...K.hook.outroParams({ thanks: "gracias por ver", support: "Apoya el canal y comparte esta historia." }),
      ...K.hook.bgParams(["hoja", "sobre"]),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Lavado de papel sobre el fondo foto/componente (el cierre tiene mucho texto)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, cx = W / 2;
      /* GRACIAS POR VER: manuscrito */
      const thFs = u * (portrait ? 9 : 7.2), thT = C.typeText(ctx, String(p.thanks), C.fitSize(String(p.thanks), thFs, W * 0.8, C.HAND), { font: C.HAND, heavy: 0, color: "rgba(32,22,10,.95)", wear: 0 });
      /* canal */
      const name = String(p.channel).toUpperCase();
      const fs = Math.min(C.fitSize(name, 400, W * (portrait ? 0.86 : 0.64)), H * (portrait ? 0.095 : 0.19));
      const nameT = C.typeText(ctx, name, fs, { heavy: 0.06, color: ACC, wear: 22 });
      const thanksY = H * (portrait ? 0.215 : 0.16), nameBase = H * (portrait ? 0.335 : 0.39);
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, en cascada en 9:16) */
      const Lw = portrait ? W * 0.3 : u * 24, Lh = Lw * 1.2;
      const L = portrait ? { x: W * 0.32, y: H * 0.485 } : { x: cx - u * (p.arrow ? 38 : 30), y: H * 0.655 };
      const cta = String(p.cta).toUpperCase();
      const ctaFs = portrait ? Math.min(u * 11, W * 0.76 / (Hk.meas(cta, 1) + 1.7)) : Math.min(u * 8.5, u * 62 / (Hk.meas(cta, 1) + 1.7));
      const RB = Hk.rubber(ctx, cta, ctaFs, "31,24,13", true);
      const B = portrait ? { x: W * 0.43, y: H * 0.665 } : { x: cx + u * 19, y: H * 0.665 };
      const bellX = B.x + RB.w / 2 + u * (portrait ? 7 : 6), bellS = u * (portrait ? 1.3 : 1.0);
      const stampC = Hk.postage(ctx, Lw, Lh, 515, (g, x, y, w, h) => {
        g.fillStyle = "#e9e1cb"; g.fillRect(x, y, w, h);
        g.drawImage(Hk.vintage(w * 2, h * 1.2, 404), x, y, w, h * 0.6); g.fillStyle = "rgba(233,225,203,.55)"; g.fillRect(x, y, w, h * 0.6);
        g.fillStyle = INK; g.textAlign = "center"; g.textBaseline = "alphabetic"; g.font = `400 ${h * 0.17}px ${C.TYPE}`;
        g.lineWidth = h * 0.008; g.strokeStyle = INK; g.strokeText("LIKE", x + w / 2, y + h * 0.9); g.fillText("LIKE", x + w / 2, y + h * 0.9);
        g.textAlign = "left"; g.font = `400 ${h * 0.09}px ${C.TYPE}`; g.fillText("CORREO", x + w * 0.06, y + h * 0.1);
      });
      const PM = Hk.postmark(ctx, Lw * 0.3, "GRACIAS|♥|CORREO", false);
      const arrowPts = (() => {
        const [x0, y0, x1, y1, mx, my] = portrait
          ? [L.x + Lw * 0.6, L.y + Lh * 0.05, B.x + RB.w * 0.3, B.y - RB.h * 0.62, W * 0.86, L.y + Lh * 0.35]
          : [L.x + Lw * 0.55, L.y - Lh * 0.25, B.x - RB.w / 2 - u * 2, B.y - RB.h * 0.2, (L.x + B.x) / 2, L.y - Lh * 0.85];
        return Hk.bez(x0, y0, mx, my, x1, y1, 30);
      })();
      const sup = wrap(p.support, portrait ? 28 : 56), supFs = u * (portrait ? 4.4 : 3.0);
      const supTs = sup.map(s => C.typeText(ctx, s, supFs, { heavy: 0.02, wear: 10, color: "rgba(31,24,13,.95)" }));
      const supY = portrait ? H * 0.77 : H * 0.835, handleY = supY + sup.length * supFs * 1.3 + u * (portrait ? 3.2 : 2.2);
      const hs = u * (portrait ? 3.1 : 2.3), handleT = p.handle ? C.typeText(ctx, String(p.handle), hs, { heavy: 0.05, wear: 8, color: ACC }) : null;
      const BG = Hk.makeBG(ctx, p, { auto: "hoja", seed: 9, photos: 1 });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main;
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          const hits = [0.62, likeAt + 0.42, subAt + 0.12], [sx, sy] = Hk.shake(lt, hits, u * 0.6);
          const cam = Hk.lensCam(lt, b.dur);
          G.save(); G.globalAlpha = exit;
          G.save(); G.translate(W / 2 + sx, H / 2 + sy); G.scale(cam.z, cam.z); G.translate(-W / 2, -H / 2);
          if (cam.blur > 0.4) G.filter = `blur(${cam.blur.toFixed(1)}px)`;
          BG.render(lt, b);
          G.restore();
          /* lavado de papel: el fondo queda atrás, el texto adelante */
          if (BG.paperish) { G.fillStyle = "rgba(222,214,194,.55)"; G.fillRect(0, 0, W, H); }
          else {                                          /* foto/componente: viñeta clara detrás del bloque de texto */
            const rg = G.createRadialGradient(cx, H * 0.55, Math.min(W, H) * 0.15, cx, H * 0.55, Math.max(W, H) * 0.62);
            rg.addColorStop(0, "rgba(226,218,199,.72)"); rg.addColorStop(0.7, "rgba(226,218,199,.45)"); rg.addColorStop(1, "rgba(226,218,199,.1)");
            G.fillStyle = rg; G.fillRect(0, 0, W, H);
          }
          /* gracias por ver (pluma) */
          Hk.reveal(G, thT, cx - thT.tw / 2 - thT.pad, thanksY - thT.base, prog(lt, 0.05, 0.9, "linear"), true);
          /* canal: llega volando desde el lente, entre dos reglas, con rúbrica */
          const f = Hk.flyQ(lt, 0.3, 0.38, 6);
          if (f.q > 0) {
            G.save(); G.globalAlpha *= f.a; G.translate(cx + sx * 0.5, nameBase - fs * 0.36 + sy * 0.5); G.scale(f.s, f.s); G.translate(-cx, -(nameBase - fs * 0.36));
            if (f.blur > 0.4) G.filter = `blur(${f.blur.toFixed(1)}px)`;
            G.shadowColor = "rgba(226,218,199,.9)"; G.shadowBlur = fs * 0.12;
            G.drawImage(nameT.c, cx - nameT.tw / 2 - nameT.pad, nameBase - nameT.base, nameT.w, nameT.h); G.restore();
            const rq = prog(lt, 0.75, 0.55, "out"), half = Math.min(nameT.tw * 0.55, W * 0.46) * rq;
            G.save(); G.strokeStyle = "rgba(30,22,12,.85)"; G.lineWidth = Math.max(1, u * 0.22);
            for (const yy of [nameBase - fs * 1.02, nameBase + fs * 0.3]) { G.beginPath(); G.moveTo(cx - half, yy); G.lineTo(cx + half, yy); G.stroke(); }
            G.lineWidth = Math.max(0.6, u * 0.08);
            for (const yy of [nameBase - fs * 1.02 - u * 0.7, nameBase + fs * 0.3 + u * 0.7]) { G.beginPath(); G.moveTo(cx - half * 0.8, yy); G.lineTo(cx + half * 0.8, yy); G.stroke(); }
            G.restore();
            const x0 = cx + nameT.tw * 0.12, x1 = cx + nameT.tw * 0.5, yy = nameBase + fs * 0.52;
            Hk.inkStroke(G, Hk.bez(x0, yy + u, (x0 + x1) / 2, yy - u * 2.2, x1 + u * 3, yy + u * 0.4, 24), prog(lt, 1.0, 0.5, "out"), u * 0.55, 0.85);
          }
          /* estampilla LIKE que llega, y el matasellos que la marca */
          const lf = Hk.flyQ(lt, likeAt, 0.3, 3);
          if (lf.q > 0) {
            const pressed = lt >= likeAt + 0.42;
            G.save(); G.globalAlpha *= lf.a; G.translate(L.x, L.y); G.rotate(-0.06); G.scale(lf.s, lf.s);
            if (lf.blur > 0.4) G.filter = `blur(${lf.blur.toFixed(1)}px)`;
            G.shadowColor = "rgba(30,20,8,.45)"; G.shadowBlur = u * 1.6; G.shadowOffsetY = u * 0.5;
            G.drawImage(stampC, -Lw / 2, -Lh / 2, Lw, Lh);
            G.shadowColor = "transparent";
            const isz = Lh * 0.42; G.translate(-isz / 2, -Lh / 2 + Lh * 0.1); G.scale(isz / 24, isz / 24);
            G.lineWidth = 1.3; G.strokeStyle = INK; G.lineJoin = "round"; G.stroke(THUMB);
            if (pressed) { G.fillStyle = INK; G.globalAlpha *= clamp((lt - likeAt - 0.42) / 0.08); G.fill(THUMB); }
            G.restore();
            const mq = prog(lt, likeAt + 0.3, 0.13, "linear");
            if (mq > 0) {
              const s = 1 + 1.3 * (1 - ease.out(mq));
              G.save(); G.globalAlpha *= clamp(mq * 4) * 0.88; G.translate(L.x + Lw * 0.5, L.y - Lh * 0.44); G.rotate(-0.3); G.scale(s, s);
              if (mq < 1) G.filter = `blur(${((1 - mq) * 5).toFixed(1)}px)`;
              G.globalCompositeOperation = "multiply"; G.drawImage(PM.c, -PM.cx, -PM.cy, PM.w, PM.h); G.restore();
              Hk.splat(G, L.x + Lw * 0.5, L.y - Lh * 0.44, Lw * 0.42, prog(lt, likeAt + 0.4, 0.12, "out"), 515, 0.6);
            }
          }
          /* flecha a pluma */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.25, subAt - 0.15), ad = Math.max(0.3, subAt + 0.1 - a0), aq = prog(lt, a0, ad, "inOut");
            if (aq > 0) {
              Hk.inkStroke(G, arrowPts, aq, u * 0.5, 0.88);
              const hq = prog(lt, a0 + ad * 0.85, 0.15);
              if (hq > 0) {
                const [x1, y1] = arrowPts[arrowPts.length - 1], [x0, y0] = arrowPts[arrowPts.length - 3], ang = Math.atan2(y1 - y0, x1 - x0), hl = u * 2.4;
                for (const d of [-0.5, 0.5]) Hk.inkStroke(G, [[x1, y1], [x1 - Math.cos(ang + d) * hl * 0.5, y1 - Math.sin(ang + d) * hl * 0.5], [x1 - Math.cos(ang + d) * hl, y1 - Math.sin(ang + d) * hl]], hq, u * 0.45, 0.88);
              }
            }
          }
          /* sello de goma SUSCRÍBETE (tinta llena, letras caladas) */
          const sq = prog(lt, subAt, 0.15, "linear");
          if (sq > 0) {
            const s = 1 + 1.5 * (1 - ease.expoOut(sq));
            G.save(); G.globalAlpha *= clamp(sq * 4); G.translate(B.x, B.y); G.rotate(0.03); G.scale(s, s);
            if (sq < 1) G.filter = `blur(${((1 - sq) * 6).toFixed(1)}px)`;
            G.drawImage(RB.c, -RB.w / 2, -RB.h / 2, RB.w, RB.h); G.restore();
            Hk.splat(G, B.x, B.y, RB.w * 0.45, prog(lt, subAt + 0.1, 0.12, "out"), 616, 0.5);
          }
          /* campana: aparece y suena (oscilación amortiguada + ondas de tinta) */
          const bq = prog(lt, bellAt, 0.2, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.4) * 0.45;
            G.save(); G.globalAlpha *= bq; bell(G, bellX, B.y + bellS * 0.5, bellS * (0.7 + 0.3 * bq), rot, clamp(1 - d / 1.4) * 0.8); G.restore();
          }
          /* apoyo tipeado tecla a tecla + dirección del canal */
          if (lt > supAt) {
            let n = Math.floor((Math.floor(lt * 24) / 24 - supAt) * 38);
            supTs.forEach((T, i) => {
              const s = sup[i], k = Math.min(s.length, Math.max(0, n)); n -= k; if (k <= 0) return;
              const w = T.pad + Hk.meas(s.slice(0, k), supFs) + supFs * 0.04, x = cx - T.tw / 2 - T.pad;
              G.drawImage(T.c, 0, 0, w / T.w * T.c.width, T.c.height, x, supY + i * supFs * 1.3 - T.base, w, T.h);
            });
            if (handleT) {
              const hq = prog(lt, supAt + 0.45, 0.5, "linear"), nch = String(p.handle).length, q = Math.floor(hq * nch) / nch;
              Hk.reveal(G, handleT, cx - handleT.tw / 2 - handleT.pad, handleY - handleT.base, q, false);
              const rq = prog(lt, supAt + 0.9, 0.5, "out");
              if (rq > 0) { G.fillStyle = "rgba(30,22,12,.7)"; G.fillRect(cx - handleT.tw / 2, handleY + hs * 0.45, handleT.tw * rq, Math.max(1, u * 0.16)); }
            }
          }
          G.restore();
        },
      };
    },
  });
})();

/* =============================================================================
   memorias · cierre del canal (lo agrega el motor al final del audio)
   Réplica de la tarjeta final de la referencia (92–105 s): una mancha de tinta
   NEGRA crece desde abajo a la izquierda y traga el cuadro; queda la tarjeta
   negra con humo claro arriba a la derecha:
   gracias por ver (sans fina) → CANAL en manuscrita blanca grande que se
   escribe → LIKE (pulgar a trazo que se rellena + gotas azules) → flecha fina →
   SUSCRÍBETE armado letra a letra + campana que suena → apoyo → dirección en
   mayúsculas chiquitas (como la línea "© ALL RIGHTS RESERVED").
   Tiempos del contrato común (Kit.hook.outroTimes).
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, M = K.memorias, { clamp, lerp, prog } = K;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  function bell(G, x, y, s, rot, rays, color) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    G.strokeStyle = color; G.fillStyle = color; G.lineWidth = s * 0.55; G.lineJoin = "round";
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.closePath(); G.stroke();
    G.beginPath(); G.arc(0, s * 4.6, s * 1.05, 0, Math.PI); G.fill();
    G.restore();
    if (rays > 0) {
      G.save(); G.strokeStyle = color; G.globalAlpha *= rays; G.lineWidth = s * 0.45; G.lineCap = "round";
      for (const d of [-1, 1]) for (const k of [0, 1]) { const R = s * (6 + k * 2.2 + (1 - rays) * 1.5); G.beginPath(); G.arc(x, y - s * 0.6, R, d < 0 ? Math.PI * 0.82 : -Math.PI * 0.18, d < 0 ? Math.PI * 1.18 : Math.PI * 0.18); G.stroke(); }
      G.restore();
    }
  }

  K.register({
    name: "memorias.outro", tags: ["cierre", "canal", "like", "suscribirse", "tinta"], layer: "main", post: 0,
    summary: "Cierre del canal como la tarjeta final de la referencia: una mancha de tinta NEGRA crece desde abajo a la izquierda y traga el cuadro (bg ink; paper = sobre el papel con texto oscuro; image/component/none = contrato común) → 'gracias por ver' en sans fina → nombre del canal en manuscrita grande que se escribe → pulgar LIKE a trazo que se rellena con gotas azules → flecha fina → SUSCRÍBETE armado letra a letra + campana que suena → mensaje de apoyo → dirección en mayúsculas chiquitas. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "gracias por ver", channel: "Memorias", cta: "Suscríbete", support: "Apoya el canal y comparte la historia", handle: "youtube.com/@nodehistory" },
    params: {
      ...K.hook.outroParams({ thanks: "gracias por ver", channel: "Memorias", cta: "Suscríbete", support: "Apoya el canal y comparte la historia", handle: "youtube.com/@nodehistory" }),
      ...K.hook.bgParams(["ink", "paper"]),
      dim: { type: "number", default: 0.7, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene texto blanco)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, portrait } = ctx.stage, P = ctx.C.palette, dpr = ctx.dpr, dur = ctx.beat.dur;
      const mode = p.bg === "auto" ? "ink" : p.bg, dark = mode !== "paper";
      const fg = dark ? P.nightInk : P.ink, accent = P.splash;
      const T = K.hook.outroTimes(p, dur);
      const hb = mode === "ink" || mode === "paper" ? null : K.hook.bg(ctx, { ...p, dim: p.dim });
      /* mancha negra que traga el cuadro (solo ink) */
      let ink = null;
      if (mode === "ink") {
        const mw = Math.ceil(W / 4), mh = Math.ceil(H / 4), src = M.mkCanvas(W * dpr, H * dpr), g = src.getContext("2d");
        g.fillStyle = P.night; g.fillRect(0, 0, src.width, src.height);
        const lobes = [{ x: 0.05, y: 1.0, rx: 0.9, ry: 1.2 }, { x: 0.35, y: 0.85, rx: 0.5, ry: 0.6 }, { x: 0.0, y: 0.5, rx: 0.4, ry: 0.6 }];
        ink = M.Reveal(src, M.Mask(M.fieldBlot(4242, mw, mh, lobes, 0.42, 4), mw, mh, { soft: 0.05 }));
      }
      const smoke = M.makeSmoke(777, dark ? "#c9c6c1" : P.smoke);
      /* medidas */
      const cx = W / 2, chFs = Math.min(100 * W * (portrait ? 0.8 : 0.48) / Math.max(1, M.measure(p.channel, "400 100px 'Mr Dafoe'")), H * (portrait ? 0.11 : 0.17));
      const thFs = chFs * (portrait ? 0.36 : 0.3), rowFs = portrait ? W * 0.05 : H * 0.042, supFs = rowFs * 0.78, hdFs = rowFs * 0.5;
      const y = portrait
        ? { th: H * 0.27, ch: H * 0.36, row: H * 0.5, sup: H * 0.6, hd: H * 0.86 }
        : { th: H * 0.33, ch: H * 0.48, row: H * 0.63, sup: H * 0.72, hd: H * 0.87 };
      const cta = String(p.cta || "").toUpperCase();
      const likeW = rowFs * 1.3 + M.measure("LIKE", `700 ${rowFs}px Barlow`) + rowFs * 0.4;
      const ctaW = M.measure(cta, `700 ${rowFs}px Barlow`, rowFs * 0.06) + rowFs * 1.4;
      const gap = rowFs * (p.arrow ? 3.2 : 1.4), rowW = likeW + gap + ctaW + rowFs * 1.6, x0 = cx - rowW / 2;
      const drops = M.makeDrops(55, x0 + rowFs * 0.6, y.row - rowFs * 0.35, rowFs * 0.9, 14, 1.6);
      return {
        render(lt, b, t) {
          const G = ctx.g.main, end = 1 - prog(lt, b.dur - 0.4, 0.4, "sine");
          /* fondo */
          if (mode === "ink") ink.draw(G, 0, 0, W, H, lerp(1.0, -0.2, prog(lt, 0, 0.9, "in")), 1);
          else if (hb) hb.render(lt, b, t);
          const ready = mode === "ink" ? prog(lt, 0.6, 0.4, "sine") : clamp(lt / 0.5);
          if (ready <= 0) return;
          G.save(); G.globalAlpha = ready * end;
          /* humo claro arriba a la derecha que deriva */
          const sz = Math.max(W, H) * 0.6; G.save(); G.globalAlpha *= dark ? 0.55 : 0.45; G.drawImage(smoke, W - sz * 0.62 + lt * W * 0.006, -sz * 0.42, sz, sz * 0.8); G.restore();
          G.textAlign = "center"; G.textBaseline = "alphabetic"; G.fillStyle = fg;
          /* gracias por ver */
          const a1 = prog(lt, 0.75, 0.5, "sine");
          if (a1 > 0) { G.save(); G.globalAlpha *= a1; G.font = `500 ${thFs}px Quicksand`; G.fillText(p.thanks, cx, y.th + (1 - a1) * thFs * 0.4); G.restore(); }
          /* canal manuscrito que se escribe */
          const q = M.ease4((lt - 1.0) / 1.1);
          if (q > 0) {
            const w = M.measure(p.channel, `400 ${chFs}px 'Mr Dafoe'`);
            G.save(); G.beginPath(); G.rect(cx - w / 2 - chFs * 0.5, y.ch - chFs * 1.2, (w + chFs) * q, chFs * 1.8); G.clip();
            G.font = `400 ${chFs}px 'Mr Dafoe'`; G.fillText(p.channel, cx, y.ch); G.restore();
          }
          /* fila: LIKE → flecha → SUSCRÍBETE + campana */
          const la = prog(lt, T.likeAt, 0.35, "out");
          if (la > 0) {
            const s = rowFs / 14, px = x0, py = y.row - rowFs * 1.05, fill = prog(lt, T.likeAt + 0.15, 0.25, "out");
            const pop = 1 + 0.25 * Math.sin(clamp((lt - T.likeAt - 0.15) / 0.3) * Math.PI);
            G.save(); G.globalAlpha *= la; G.translate(px + 12 * s, py + 12 * s); G.scale(s * pop, s * pop); G.translate(-12, -12);
            G.lineWidth = 1.3; G.strokeStyle = fg; G.stroke(THUMB); if (fill > 0) { G.globalAlpha *= fill; G.fillStyle = accent; G.fill(THUMB); }
            G.restore();
            M.drawDrops(G, drops, lt, T.likeAt + 0.15, accent, la * 0.9);
            G.save(); G.globalAlpha *= la; G.textAlign = "left"; G.font = `700 ${rowFs}px Barlow`; G.fillText("LIKE", x0 + rowFs * 1.7, y.row); G.restore();
          }
          if (p.arrow) {
            const ar = prog(lt, T.likeAt + 0.3, Math.max(0.2, T.subAt - T.likeAt - 0.2), "inOut");
            if (ar > 0) {
              const ax0 = x0 + likeW + rowFs * 0.5, ax1 = ax0 + (gap - rowFs) * ar, ay = y.row - rowFs * 0.35;
              G.save(); G.strokeStyle = fg; G.lineWidth = Math.max(1, rowFs * 0.06); G.lineCap = "round";
              G.beginPath(); G.moveTo(ax0, ay); G.lineTo(ax1, ay); if (ar > 0.95) { G.moveTo(ax1 - rowFs * 0.3, ay - rowFs * 0.22); G.lineTo(ax1, ay); G.lineTo(ax1 - rowFs * 0.3, ay + rowFs * 0.22); } G.stroke(); G.restore();
            }
          }
          if (lt >= T.subAt) {
            const sx = x0 + likeW + gap, sp = clamp((lt - T.subAt) / 0.55), box = prog(lt, T.subAt, 0.45, "out");
            G.save(); G.strokeStyle = fg; G.lineWidth = Math.max(1, rowFs * 0.05);
            G.strokeRect(sx, y.row - rowFs * 1.05, ctaW * box, rowFs * 1.45); G.restore();
            G.save(); G.textAlign = "left"; G.font = `700 ${rowFs}px Barlow`; G.letterSpacing = rowFs * 0.06 + "px";
            G.fillText(M.scramble(cta, sp, lt, 99), sx + rowFs * 0.7, y.row); G.restore();
            const bl = prog(lt, T.bellAt, 0.2, "out");
            if (bl > 0) { const d = lt - T.bellAt, rot = Math.sin(d * 26) * 0.4 * Math.exp(-d * 3.5); G.save(); G.globalAlpha *= bl; bell(G, sx + ctaW + rowFs * 0.95, y.row - rowFs * 0.38, rowFs / 11, rot, clamp(1 - Math.abs(d - 0.5) * 1.5), fg); G.restore(); }
          }
          /* apoyo + dirección */
          const sa = prog(lt, T.supAt, 0.6, "sine");
          if (sa > 0) {
            G.save(); G.globalAlpha *= sa; G.font = `500 ${supFs}px Quicksand`; G.fillText(p.support, cx, y.sup);
            G.font = `500 ${hdFs}px Quicksand`; G.letterSpacing = hdFs * 0.12 + "px"; G.fillText("©  " + String(p.handle).toUpperCase(), cx, y.hd); G.restore();
          }
          G.restore();
        },
        dispose() { hb && hb.dispose(); },
      };
    },
  });
})();

/* =============================================================================
   periodico · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: la cámara llega con un latigazo a una pared de PORTADAS (kiosco)
   que se desliza de costado (o la mesa, la rotativa, la portada que gira, una foto
   o un componente). Secuencia sincronizada con la despedida narrada:
   [ GRACIAS POR VER ] → el canal como CABECERA DE DIARIO gigante (letras que se
   aleatorizan y se asientan, filetes dobles que se trazan, línea de fecha) →
   LIKE (casilla ⊠ que se tacha y barra negra que se llena = presionado) → flecha
   de tinta → barra negra SUSCRÍBETE que golpea + campana que suena → mensaje de
   apoyo tipeado → [ youtube.com/@canal ].
   Usa los escenarios y helpers de intros.js (Kit.periodico.hook).
   ========================================================================== */
(function () {
  const K = Kit, P = Kit.periodico, HK = Kit.periodico.hook, { clamp, prog, ease, lerp } = K;
  const INK = "#141113", BAR = "#161315", BARINK = "#efecef";
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");
  const tfont = fs => `400 ${fs}px ${P.FT}`;

  /** campana grabada en tinta (x,y = centro), s = escala */
  function bell(G, x, y, s, rot, rays) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    G.fillStyle = INK;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    /* rayado de grabado (luz) */
    G.strokeStyle = "rgba(230,226,232,.55)"; G.lineWidth = s * 0.22;
    for (let k = 0; k < 4; k++) { G.beginPath(); G.moveTo(-s * (2.6 - k * 0.15), -s * (2.6 - k * 1.3)); G.lineTo(-s * (1.9 - k * 0.1), -s * (2.6 - k * 1.3)); G.stroke(); }
    G.fillStyle = INK; G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, 7); G.fill();
    G.restore();
    if (rays > 0) {
      G.save(); G.strokeStyle = `rgba(20,17,19,${rays.toFixed(3)})`; G.lineWidth = s * 0.5; G.lineCap = "butt";
      for (const d of [-1, 1]) for (const r of [6.2, 8.2]) { G.beginPath(); G.arc(x, y - s * 0.6, s * (r + (1 - rays) * 1.5), d < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, d < 0 ? Math.PI * 1.2 : Math.PI * 0.2); G.stroke(); }
      G.restore();
    }
  }
  function wrapW(str, font, w) { return P.wrap(str, font, w); }

  K.register({
    name: "periodico.outro", tags: ["cierre", "canal", "like", "suscribirse", "portada"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro (bg: stand | desk | press | spin | image con src | component con use/useParams | none): por defecto la cámara llega con un latigazo a una pared de PORTADAS de diario que se desliza. [GRACIAS POR VER] entre corchetes → nombre del canal como CABECERA de diario gigante (letras que se aleatorizan y asientan, filetes dobles que se trazan) → LIKE con casilla ⊠ que se tacha y barra negra que se llena → flecha de tinta → barra negra SUSCRÍBETE que golpea + campana grabada que suena → mensaje de apoyo tipeado → [youtube.com/@canal]. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "NODETECH", cta: "SUSCRÍBETE", support: "Tu apoyo nos ayuda a seguir creando y traer más contenido.", handle: "youtube.com/@nodetech" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte el video." }),
      ...K.hook.bgParams(["stand", "desk", "press", "spin"]),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene mucho texto)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, S = Math.min(W, H), cx = W / 2;
      const name = String(p.channel).toUpperCase();
      const fs = Math.min(HK.fitFs(name, W * (portrait ? 0.88 : 0.66), P.FB, 700), H * (portrait ? 0.11 : 0.21));
      const nameW = P.measure(name, `700 ${fs}px ${P.FB}`);
      const thanksY = H * (portrait ? 0.235 : 0.15), nameBase = portrait ? H * 0.32 + fs * 0.4 : H * 0.37;
      const ruleTop = nameBase - fs * 0.98, ruleBot = nameBase + fs * 0.24, ruleW = Math.min(W * 0.92, Math.max(nameW * 1.12, W * (portrait ? 0.8 : 0.6)));
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, vertical en 9:16) */
      const lfs = u * (portrait ? 7.4 : 4.6), sfs = u * (portrait ? 7.6 : 5.6);
      const cta = String(p.cta).toUpperCase();
      const Lw = P.measure("LIKE", tfont(lfs)) + lfs * 3.4, Lh = lfs * 1.7;
      const Bw = P.measure(cta, tfont(sfs)) + sfs * 1.6, Bh = sfs * 1.7;
      const L = portrait ? { x: cx + u * 4, y: H * 0.465 } : { x: cx - u * (p.arrow ? 46 : 34), y: H * 0.615 };
      const B = portrait ? { x: cx - u * 6, y: H * 0.6 } : { x: cx + u * 13, y: H * 0.615 };
      const bellX = B.x + Bw / 2 + u * (portrait ? 8 : 6), bellS = u * (portrait ? 1.3 : 0.85);
      const arrowPts = (() => {
        const pts = [];
        const [x0, y0, x1, y1, mx, my] = portrait
          ? [L.x - Lw * 0.3, L.y + Lh / 2 + u * 1.5, B.x - Bw / 2 - u * 1.5, B.y - Bh * 0.1, L.x - Lw * 0.62, (L.y + B.y) / 2 + u * 2]
          : [L.x + Lw / 2 + u * 1.5, L.y - Lh * 0.1, B.x - Bw / 2 - u * 2, B.y - Bh * 0.1, (L.x + Lw / 2 + B.x - Bw / 2) / 2, L.y - Lh * 1.3];
        for (let k = 0; k <= 24; k++) { const s = k / 24, a = 1 - s; pts.push([a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]); }
        return pts;
      })();
      const supFs = u * (portrait ? 4.8 : 3.1), supFont = `italic 400 ${supFs}px ${P.FN}`;
      const sup = wrapW(p.support, supFont, W * (portrait ? 0.8 : 0.62));
      const supY = portrait ? H * 0.72 : H * 0.79, handleY = supY + sup.length * supFs * 1.3 + u * (portrait ? 3.4 : 2.6);
      const BG = HK.makeBG(ctx, p, { auto: "stand", stopAt: 0.9, land: 0.9, variant: 3, blurTo: 1 });
      const strong = BG.mode === "image" || BG.mode === "component" || BG.mode === "none";
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main;
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const [sx, sy] = HK.shake(lt, [subAt + 0.1], u * 0.6);
          /* fondo */
          G.save(); G.translate(sx * 0.4, sy * 0.4); BG.render(lt, b); G.restore();
          /* luz de papel detrás de toda la columna de texto (legible sobre cualquier fondo, sin recuadro) */
          const wa = prog(lt, 0, 0.6, "linear");
          G.save();
          const D = Math.max(W, H), gr = G.createRadialGradient(cx, H * 0.5, 0, cx, H * 0.5, D * (portrait ? 0.62 : 0.55));
          const a1 = (strong ? 0.92 : 0.8) * wa;
          gr.addColorStop(0, `rgba(234,231,235,${a1.toFixed(3)})`); gr.addColorStop(0.55, `rgba(234,231,235,${(a1 * 0.8).toFixed(3)})`); gr.addColorStop(1, `rgba(234,231,235,${(a1 * (strong ? 0.25 : 0.05)).toFixed(3)})`);
          G.fillStyle = gr; G.fillRect(0, 0, W, H);
          G.restore();
          G.save(); G.translate(sx, sy);
          /* [ GRACIAS POR VER ] */
          HK.label(G, p.thanks, cx, thanksY, u * (portrait ? 3 : 2.1), lt, 0.1, 51);
          /* CABECERA: filetes dobles que se trazan desde el centro + nombre que se asienta letra a letra */
          const rq = prog(lt, 0.3, 0.7, "out"), rw = ruleW * rq;
          if (rq > 0) {
            G.fillStyle = INK;
            G.fillRect(cx - rw / 2, ruleTop, rw, Math.max(1.5, u * 0.5)); G.fillRect(cx - rw / 2, ruleTop + u * 0.85, rw, Math.max(1, u * 0.14));
            G.fillRect(cx - rw / 2, ruleBot, rw, Math.max(1, u * 0.14)); G.fillRect(cx - rw / 2, ruleBot + u * 0.5, rw, Math.max(1.5, u * 0.5));
          }
          const nq = prog(lt, 0.35, 0.5, "linear");
          if (nq > 0) {
            const e = ease.expoOut(nq), sc = 1 + 0.12 * (1 - e);
            G.save(); G.globalAlpha *= clamp(nq * 2.5); G.translate(cx, nameBase - fs * 0.35); G.scale(sc, sc); G.translate(-cx, -(nameBase - fs * 0.35));
            G.font = `700 ${fs}px ${P.FB}`; G.textAlign = "center"; G.textBaseline = "alphabetic"; G.fillStyle = INK;
            const T = P.scramble(name, lt, 0.4, 1.0, 61, 20);
            if (nq < 1) { G.globalAlpha *= 0.3; for (const d of [-1, 1]) G.fillText(T, cx + d * fs * 0.04 * (1 - e), nameBase); G.globalAlpha = clamp(nq * 2.5); }
            G.fillText(T, cx, nameBase);
            G.restore();
          }
          /* línea de fecha bajo la cabecera, con ⊠ a los lados */
          const dq = prog(lt, 0.9, 0.5, "linear");
          if (dq > 0) {
            const dfs = u * (portrait ? 2.3 : 1.55), dy = ruleBot + u * 0.5 + dfs * 1.9, txt = "EDICIÓN DE CIERRE · GRACIAS POR LEERNOS";
            G.save(); G.globalAlpha *= dq; G.letterSpacing = dfs * 0.2 + "px";
            P.tw(G, P.scramble(txt, lt, 0.9, 0.8, 63), cx, dy, dfs, { align: "center", weight: 0.02 });
            G.letterSpacing = "0px";
            const tw = P.measure(txt, tfont(dfs)) + dfs * 0.2 * txt.length;
            P.icon(G, cx - tw / 2 - dfs * 1.4, dy - dfs * 0.32, dfs * 0.9); P.icon(G, cx + tw / 2 + dfs * 1.2, dy - dfs * 0.32, dfs * 0.9);
            G.restore();
          }
          /* LIKE: casilla ⊠ que se tacha y la barra negra se llena (presionado) */
          const lk = prog(lt, likeAt, 0.2, "linear");
          if (lk > 0) {
            const e = ease.expoOut(lk), press = prog(lt, likeAt + 0.3, 0.18, "out"), dip = 1 + 0.3 * (1 - e) - 0.06 * Math.sin(Math.PI * press);
            G.save(); G.globalAlpha *= clamp(lk * 3); G.translate(L.x, L.y); G.scale(dip, dip); G.rotate(-0.02);
            const x0 = -Lw / 2, y0 = -Lh / 2;
            /* contorno fino → barra negra que se llena de izquierda a derecha */
            G.strokeStyle = INK; G.lineWidth = Math.max(1, u * 0.25); G.strokeRect(x0, y0, Lw, Lh);
            G.fillStyle = BAR; G.fillRect(x0, y0, Lw * press, Lh);
            const col = press > 0.5 ? BARINK : INK, bs = Lh * 0.46, bx = x0 + Lh * 0.5;
            G.strokeStyle = col; G.lineWidth = bs * 0.13; G.strokeRect(bx - bs / 2, -bs / 2, bs, bs);
            const xq = prog(lt, likeAt + 0.36, 0.2, "out");
            if (xq > 0) { G.beginPath(); G.moveTo(bx - bs / 2, -bs / 2); G.lineTo(bx - bs / 2 + bs * xq, -bs / 2 + bs * xq); if (xq > 0.5) { const q2 = (xq - 0.5) * 2; G.moveTo(bx + bs / 2, -bs / 2); G.lineTo(bx + bs / 2 - bs * q2, -bs / 2 + bs * q2); } G.stroke(); }
            const isz = Lh * 0.62;
            G.save(); G.translate(bx + bs * 0.75, -isz / 2 - isz * 0.04); G.scale(isz / 24, isz / 24); G.fillStyle = col; G.fill(THUMB); G.restore();
            P.tw(G, "LIKE", bx + bs * 0.75 + isz * 0.95, lfs * 0.36, lfs, { color: col, weight: press > 0.5 ? 0.02 : 0.045 });
            G.restore();
          }
          /* flecha de tinta (trazo de pluma con punta) */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.2, subAt - 0.15), dur = Math.max(0.3, subAt + 0.15 - a0), aq = prog(lt, a0, dur, "inOut");
            if (aq > 0) {
              const nn = Math.max(1, Math.round(aq * (arrowPts.length - 1)));
              G.save(); G.strokeStyle = INK; G.lineCap = "round"; G.lineJoin = "round"; G.lineWidth = Math.max(1.2, u * 0.32);
              G.setLineDash([u * 1.1, u * 0.7]);
              G.beginPath(); for (let i = 0; i <= nn; i++) i ? G.lineTo(arrowPts[i][0], arrowPts[i][1]) : G.moveTo(arrowPts[0][0], arrowPts[0][1]); G.stroke();
              G.setLineDash([]);
              if (aq > 0.9) {
                const [x1, y1] = arrowPts[arrowPts.length - 1], [xa, ya] = arrowPts[arrowPts.length - 3], ang = Math.atan2(y1 - ya, x1 - xa), hl = u * 2.2;
                G.fillStyle = INK; G.beginPath(); G.moveTo(x1, y1); G.lineTo(x1 - Math.cos(ang - 0.42) * hl, y1 - Math.sin(ang - 0.42) * hl); G.lineTo(x1 - Math.cos(ang + 0.42) * hl, y1 - Math.sin(ang + 0.42) * hl); G.closePath(); G.fill();
              }
              G.restore();
            }
          }
          /* SUSCRÍBETE: barra negra que golpea con texto blanco que se asienta */
          const sb = prog(lt, subAt, 0.18, "linear");
          if (sb > 0) {
            const e = ease.expoOut(sb), sc = 1 + 0.55 * (1 - e);
            G.save(); G.globalAlpha *= clamp(sb * 4); G.translate(B.x, B.y); G.scale(sc, sc); G.rotate(0.012);
            G.fillStyle = "rgba(10,6,9,.28)"; G.fillRect(-Bw / 2 + u * 0.5, -Bh / 2 + u * 0.8, Bw, Bh);
            G.fillStyle = BAR; G.fillRect(-Bw / 2, -Bh / 2, Bw, Bh);
            P.tw(G, P.scramble(cta, lt, subAt + 0.05, 0.45, 67, 22), 0, sfs * 0.36, sfs, { color: BARINK, align: "center", weight: 0.02 });
            G.restore();
            /* corchetes que encuadran la barra */
            const cq = prog(lt, subAt + 0.15, 0.3, "out");
            HK.brackets(G, B.x - Bw / 2 - u * 1.4, B.y - Bh / 2 - u * 1.2, B.x + Bw / 2 + u * 1.4, B.y + Bh / 2 + u * 1.2, Math.max(1, u * 0.22), u * 2, cq);
          }
          /* campana: aparece y suena (oscilación amortiguada) */
          const bq = prog(lt, bellAt, 0.2, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.45;
            G.save(); G.globalAlpha *= bq; bell(G, bellX, B.y + bellS * 0.3, bellS * (0.7 + 0.3 * bq), rot, clamp(1 - d / 1.4) * 0.85); G.restore();
          }
          /* apoyo tipeado + dirección del canal entre corchetes */
          if (lt > supAt) {
            let n = Math.floor((lt - supAt) * 45);
            G.save(); G.font = supFont; G.textAlign = "center"; G.textBaseline = "alphabetic"; G.fillStyle = INK;
            sup.forEach((s, i) => { const k = Math.min(s.length, n); n -= k; if (k > 0) G.fillText(s.slice(0, k), cx, supY + i * supFs * 1.3); });
            G.restore();
            const hq = prog(lt, supAt + 0.35, 0.4, "linear");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 3.7 : 2.4), txt = String(p.handle), w = P.measure(txt, tfont(hs));
              P.tw(G, txt.slice(0, Math.ceil(txt.length * hq)), cx - w / 2, handleY, hs, { weight: 0.03 });
              HK.brackets(G, cx - w / 2 - hs * 0.8, handleY - hs * 1.15, cx + w / 2 + hs * 0.8, handleY + hs * 0.5, Math.max(1, hs * 0.08), hs * 0.6, prog(lt, supAt + 0.35, 0.3, "out"));
            }
          }
          G.restore();
          /* fundido a negro en los últimos 0,4 s */
          const fo = prog(lt, b.dur - 0.4, 0.4, "in");
          if (fo > 0) { G.fillStyle = `rgba(12,10,11,${fo.toFixed(3)})`; G.fillRect(-4, -4, W + 8, H + 8); }
        },
      };
    },
  });
})();

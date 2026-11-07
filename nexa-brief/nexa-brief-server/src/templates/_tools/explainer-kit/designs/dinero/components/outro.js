/* =============================================================================
   dinero · cierre del canal (lo agrega el motor al final del audio). SIN recuadro.
   Orden fijo: GRACIAS POR VER (fina, se decodifica) → CANAL gigante (contorno
   fantasma + relleno blanco que se tipea, como "dirty" de la referencia) → LIKE
   (píldora verde que se presiona y suelta chispas, mirada por ojos de dibujo
   animado) → flecha (trazo fino con punta brillante) → SUSCRÍBETE (billete verde
   que golpea) + campana que suena → apoyo → youtube.com/@canal.
   ========================================================================== */
(function () {
  const K = Kit, D = Kit.dinero, HK = Kit.dinero.hook, { clamp, lerp, prog, ease } = K, TAU = Math.PI * 2;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");
  function bell(G, x, y, s, rot, color) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5); G.fillStyle = color;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, TAU); G.fill();
    G.restore();
  }
  K.register({
    name: "dinero.outro", tags: ["cierre", "canal", "like", "suscribirse"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro en lenguaje NODECONOMY (bg: black | paper | felt | sage | fog | image con src | component con use/useParams; por defecto negro verdoso con rayos verdes): GRACIAS POR VER fina que se decodifica → nombre del canal GIGANTE con contorno fantasma detrás y relleno blanco que se tipea → botón LIKE verde que se presiona y suelta chispas (dos ojos lo miran) → flecha fina con punta brillante → SUSCRÍBETE en billete verde que golpea + campana que suena → apoyo → youtube.com/@canal. Tiempos sincronizables (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "NODECONOMY", cta: "SUSCRÍBETE", support: "Apoya el canal y comparte el video.", handle: "youtube.com/@nodeconomy" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte el video.", channel: "NODECONOMY", handle: "youtube.com/@nodeconomy" }),
      ...K.hook.bgParams(HK.PRESETS, "black"),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, cx = W / 2, dpr = ctx.dpr;
      const name = String(p.channel).toUpperCase(), fs = Math.min(D.fit(name, W * (portrait ? 0.86 : 0.66), 1e9, s => D.SANS(s, 800)), H * (portrait ? 0.08 : 0.16));
      const BG = HK.hookBg(ctx, p, "black");
      const thanksY = H * (portrait ? 0.2 : 0.13), nameY = H * (portrait ? 0.3 : 0.33);
      const L = portrait ? { x: cx, y: H * 0.43, w: u * 40, h: u * 13 } : { x: cx - u * 34, y: H * 0.56, w: u * 26, h: u * 10 };
      const B = portrait ? { x: cx - u * 6, y: H * 0.585, w: u * 66, h: u * 17 } : { x: cx + u * 16, y: H * 0.56, w: u * 40, h: u * 12 };
      const bellX = B.x + B.w / 2 + u * (portrait ? 10 : 7.5), bellS = u * (portrait ? 1.4 : 1.0);
      const cta = String(p.cta).toUpperCase(), cfs = Math.min(D.fit(cta, B.w * 0.76, 1e9, s => D.SANS(s, 800)), B.h * 0.48);
      const sup = D.wrap(p.support, portrait ? 26 : 56), supFs = u * (portrait ? 3.6 : 2.4), supY = H * (portrait ? 0.7 : 0.75);
      const handleY = supY + sup.length * supFs * 1.35 + u * (portrait ? 3.4 : 2.6);
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur), exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          G.save(); G.globalAlpha = exit;
          BG.render(lt, b, t);
          const ink = BG.light ? P.black : P.white;
          /* GRACIAS POR VER */
          D.text(G, D.decode(String(p.thanks).toUpperCase(), lt - 0.05, 24, 4), cx, thanksY, { font: D.THIN(u * (portrait ? 3.4 : 2.6), 300), color: ink, align: "center", sp: u * 0.9 });
          /* canal: contorno fantasma gigante + relleno que se tipea */
          const nq = clamp((lt - 0.25) / 0.5), shown = name.slice(0, Math.ceil(nq * name.length));
          if (nq > 0) {
            D.text(G, shown, cx - fs * 0.35, nameY + fs * 0.55, { font: D.SANS(fs * 1.5, 700), stroke: D.rgba(P.muted, 0.85), lw: Math.max(1, u * 0.14), align: "center" });
            D.text(G, shown, cx, nameY + fs * 0.36, { font: D.SANS(fs, 800), color: ink, align: "center" });
          }
          /* LIKE: píldora verde que se presiona */
          const lq = prog(lt, likeAt, 0.25, "back");
          if (lq > 0) {
            const pr = prog(lt, likeAt + 0.35, 0.12, "out") * (1 - prog(lt, likeAt + 0.55, 0.15, "out")), s = lq * (1 - 0.08 * pr);
            G.save(); G.translate(L.x, L.y); G.scale(s, s);
            G.fillStyle = D.rgba(P.black, 0.35); D.rrect(G, -L.w / 2 + u * 0.6, -L.h / 2 + u * 0.8, L.w, L.h, L.h / 2); G.fill();
            G.fillStyle = pr > 0.5 ? P.white : P.green; D.rrect(G, -L.w / 2, -L.h / 2, L.w, L.h, L.h / 2); G.fill();
            const fg = pr > 0.5 ? P.green : P.white, isz = L.h * 0.62;
            G.save(); G.translate(-L.w / 2 + L.h * 0.3, -isz / 2); G.scale(isz / 24, isz / 24); G.fillStyle = fg; G.fill(THUMB); G.restore();
            D.text(G, "LIKE", L.h * 0.35, L.h * 0.17, { font: D.SANS(L.h * 0.46, 800), color: fg, align: "center" });
            G.restore();
            const sq = prog(lt, likeAt + 0.4, 0.4, "out");
            if (sq > 0 && sq < 1) D.sparks(G, L.x, L.y, L.w * 0.55 + sq * u * 4, L.w * 0.55 + u * 2 + sq * u * 7, 9, 0.3, D.rgba(P.accent, 1 - sq), Math.max(1.5, u * 0.35));
            /* dos ojos que miran el botón */
            for (const [ox, oy, r] of portrait ? [[-0.36, -0.08, 3.4], [0.36, -0.1, 2.4]] : [[-0.2, -0.13, 3.2], [-0.05, -0.16, 2.0]]) {
              const ex = cx + ox * W, ey = L.y + oy * H, a = Math.atan2(L.y - ey, L.x - ex), eq = prog(lt, likeAt + 0.1, 0.25, "back");
              if (eq > 0) { G.save(); G.translate(ex, ey); G.scale(eq, eq); D.googly(G, 0, 0, r * u, Math.cos(a) * 0.9, Math.sin(a) * 0.9, P); G.restore(); }
            }
          }
          /* flecha fina con punta brillante */
          if (p.arrow) {
            const aq = prog(lt, likeAt + 0.6, Math.max(0.2, subAt - likeAt - 0.6), "inOut");
            if (aq > 0) {
              const ax = portrait ? L.x + L.w * 0.42 : L.x + L.w / 2 + u * 2, ay = portrait ? L.y + L.h * 0.6 : L.y, bx = portrait ? B.x - B.w * 0.3 : B.x - B.w / 2 - u * 2, by = portrait ? B.y - B.h * 0.65 : B.y;
              const pt = q => [lerp(ax, bx, q), lerp(ay, by, q) - Math.sin(q * Math.PI) * u * (portrait ? 3 : 5)];
              G.save(); G.strokeStyle = ink; G.lineWidth = Math.max(1.5, u * 0.3); G.lineCap = "round"; G.beginPath();
              let tx = ax, ty = ay; for (let q = 0; q <= aq + 1e-6; q += 0.05) { [tx, ty] = pt(Math.min(q, aq)); q ? G.lineTo(tx, ty) : G.moveTo(tx, ty); }
              G.stroke();
              if (aq >= 1) { const [px, py] = pt(0.9), an = Math.atan2(ty - py, tx - px); G.beginPath(); G.moveTo(tx - Math.cos(an - 0.6) * u * 2, ty - Math.sin(an - 0.6) * u * 2); G.lineTo(tx, ty); G.lineTo(tx - Math.cos(an + 0.6) * u * 2, ty - Math.sin(an + 0.6) * u * 2); G.stroke(); }
              else { G.fillStyle = P.white; G.shadowColor = P.white; G.shadowBlur = u * 3 * dpr; G.beginPath(); G.arc(tx, ty, u * 0.6, 0, TAU); G.fill(); }
              G.restore();
            }
          }
          /* SUSCRÍBETE: billete verde que golpea */
          const bq = prog(lt, subAt, 0.2, "linear");
          if (bq > 0) {
            const s = 1 + 0.4 * (1 - ease.expoOut(bq)), sh = lt - subAt < 0.35 ? Math.sin((lt - subAt) * 60) * (1 - (lt - subAt) / 0.35) * u * 0.6 : 0;
            G.save(); G.translate(B.x + sh, B.y); G.scale(s, s); G.rotate(-0.02); G.globalAlpha *= clamp(bq * 3);
            G.fillStyle = D.rgba(P.black, 0.4); G.fillRect(-B.w / 2 + u, -B.h / 2 + u, B.w, B.h);
            G.fillStyle = P.green; G.fillRect(-B.w / 2, -B.h / 2, B.w, B.h);
            G.strokeStyle = D.mix(P.green, P.white, 0.45); G.lineWidth = Math.max(1, u * 0.25); G.strokeRect(-B.w / 2 + u * 1.1, -B.h / 2 + u * 1.1, B.w - u * 2.2, B.h - u * 2.2);
            D.text(G, cta, 0, cfs * 0.36, { font: D.SANS(cfs, 800), color: P.white, align: "center" });
            G.restore();
            const bl = prog(lt, bellAt, 0.12, "out");
            if (bl > 0) {
              const ring = lt - bellAt, rot = ring < 0.9 ? Math.sin(ring * 22) * 0.45 * (1 - ring / 0.9) : 0;
              G.save(); G.globalAlpha *= bl; G.fillStyle = P.green; G.beginPath(); G.arc(bellX, B.y, bellS * 7, 0, TAU); G.fill(); G.restore();
              G.save(); G.globalAlpha *= bl; bell(G, bellX, B.y + bellS * 0.3, bellS, rot, P.white); G.restore();
            }
          }
          /* apoyo + handle */
          sup.forEach((l, i) => {
            const n = Math.floor(clamp((lt - supAt - i * 0.15) / 0.5) * l.length); if (n <= 0) return;
            D.text(G, l.slice(0, n), cx, supY + i * supFs * 1.35, { font: D.SANS(supFs, 600), color: ink, align: "center" });
          });
          if (lt > supAt + 0.3) D.text(G, D.decode(String(p.handle), lt - supAt - 0.3, 26, 9), cx, handleY, { font: D.THIN(supFs * 1.05, 300), color: BG.light ? P.deep : P.accent, align: "center", sp: u * 0.3 });
          G.restore();
        },
      };
    },
  });
})();

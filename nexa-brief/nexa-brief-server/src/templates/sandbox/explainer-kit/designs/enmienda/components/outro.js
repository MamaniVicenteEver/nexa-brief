/* =============================================================================
   enmienda · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: mapamundi de tinta que se desplaza con alfileres y rutas (o el
   Muro de noche). Secuencia sincronizada con la despedida narrada:
   GRACIAS POR VER → CANAL gigante (se revela por erosión) → tarjeta LIKE (se
   marca con un círculo a pincel) → flecha a pincel → placa SUSCRÍBETE → campana
   que suena → mensaje de apoyo tipeado → youtube.com/@canal.
   Los tiempos (likeAt, subscribeAt, bellAt, supportAt) son los mismos del cierre
   anterior, así el storyboard que ya los sincroniza con la voz sigue sirviendo.
   ========================================================================== */
(function () {
  const K = Kit, E = Kit.enm, S = Kit.enm.scene, { clamp, prog, ease } = K;
  const INK = "#ebe6dc", DARK = "#141210";
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  /** campana dibujada en tinta clara (x,y = centro), s = escala */
  function bell(G, x, y, s, rot, rays) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    G.fillStyle = INK;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, 7); G.fill();
    G.restore();
    if (rays > 0) {
      G.save(); G.strokeStyle = `rgba(235,230,220,${rays})`; G.lineWidth = s * 0.55; G.lineCap = "round";
      for (const d of [-1, 1]) { G.beginPath(); G.arc(x, y - s * 0.6, s * (6.2 + (1 - rays) * 1.5), d < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, d < 0 ? Math.PI * 1.2 : Math.PI * 0.2); G.stroke(); }
      G.restore();
    }
  }
  /** golpe de entrada: escala que cae + opacidad */
  const slam = (lt, at, d = 0.2) => { const q = prog(lt, at, d, "linear"); return { q, s: 1 + 0.6 * (1 - ease.expoOut(q)), a: clamp(q * 4) }; };

  K.register({
    name: "enmienda.outro", tags: ["cierre", "canal", "like", "suscribirse", "mapa"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro (bg: map | wall | image con src | component con use/useParams): por defecto mapamundi de tinta que se desplaza con alfileres y rutas de hilo (o el Muro de noche). GRACIAS POR VER → nombre del canal GIGANTE desgastado que se revela por erosión → tarjeta LIKE marcada con un círculo a pincel → flecha a pincel → placa blanca SUSCRÍBETE + campana que suena → mensaje de apoyo tipeado → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "NODETECH", cta: "SUSCRÍBETE", support: "Tu apoyo nos ayuda a seguir creando y traer más contenido.", handle: "youtube.com/@nodetech" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte el expediente." }),
      ...K.hook.bgParams(["map", "wall"]),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene mucho texto)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, cx = W / 2;
      const name = String(p.channel).toUpperCase();
      const fs = Math.min(E.fit(name, "heavy", W * (portrait ? 0.86 : 0.62), 1e9, 400), H * (portrait ? 0.1 : 0.2));
      const nameT = E.inkText(name, { kind: "heavy", px: fs, weight: 400, color: INK, wear: 0.75, seed: 61 });
      const D = E.dissolver(613, 180, 60, { streak: true, soft: 0.14 });
      const thanksY = H * (portrait ? 0.24 : 0.2), nameCY = H * (portrait ? 0.32 : 0.35), nameBase = nameCY + fs * 0.36;
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, vertical en 9:16) */
      const L = portrait ? { x: cx, y: H * 0.46, w: u * 50, h: u * 15 } : { x: cx - u * (p.arrow ? 31 : 25), y: H * 0.585, w: u * 24, h: u * 9 };
      const B = portrait ? { x: cx - u * 6, y: H * 0.605, w: u * 64, h: u * 15 } : { x: cx + u * 12, y: H * 0.585, w: u * 34, h: u * 10 };
      const bellX = B.x + B.w / 2 + u * (portrait ? 8 : 5.5), bellS = u * (portrait ? 0.95 : 0.62);
      const arrowPts = (() => {
        const pts = [];
        const [x0, y0, x1, y1, mx, my] = portrait
          ? [L.x + L.w * 0.28, L.y + L.h / 2 + u * 1.5, B.x + u * 4, B.y - B.h / 2 - u * 2, L.x + L.w * 0.5, (L.y + B.y) / 2]
          : [L.x + L.w / 2 + u * 1.5, L.y - L.h * 0.25, B.x - B.w / 2 - u * 2, B.y - B.h * 0.15, (L.x + B.x) / 2, L.y - L.h * 1.1];
        for (let k = 0; k <= 20; k++) { const s = k / 20, a = 1 - s; pts.push([a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]); }
        return pts;
      })();
      const ctaFs = Math.min(E.fit(String(p.cta).toUpperCase(), "heavy", B.w * 0.8, 1e9, 400), B.h * 0.62);
      const ctaT = E.inkText(String(p.cta).toUpperCase(), { kind: "heavy", px: ctaFs, weight: 400, color: DARK, ink: "dark", wear: 0.55, seed: 67 });
      const sup = wrap(p.support, portrait ? 30 : 60), supFs = u * (portrait ? 3.9 : 2.85);
      const supY = portrait ? H * 0.71 : H * 0.77, handleY = supY + sup.length * supFs * 1.25 + u * (portrait ? 2.6 : 1.8);
      const BG = K.hook.bg(ctx, p, {
        auto: "map", tone: img => E.photo(img, "bw"),
        presets: {
          map: (G, st, lt, b) => S.world(G, st, lt, { span: Math.max(6, b.dur) }),
          wall: (G, st, lt) => { S.wall(G, st, { lt, seed: 41, crowd: true, crackAt: -1 }); G.fillStyle = "rgba(0,0,0,.45)"; G.fillRect(0, 0, st.W, st.H); },
        },
      });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main;
          /* si el cierre es corto, comprime los tiempos (igual que el cierre anterior) */
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          G.save(); G.globalAlpha = exit;
          /* fondo */
          BG.render(lt, b);
          /* GRACIAS POR VER */
          S.kicker(G, p.thanks, cx, thanksY, u * (portrait ? 2.3 : 1.7), S.ignite(lt, 0.1, 0.45));
          /* canal: se revela por erosión de vetas y queda con un leve temblor */
          const nq = prog(lt, 0.3, 0.85, "linear");
          if (nq > 0) {
            const [jx, jy] = E.boil(61, lt, u * 0.1, 12), x = cx - nameT.w / 2 + fs * 0.07, y = nameBase - nameT.base;
            G.save(); G.shadowColor = "rgba(0,0,0,.8)"; G.shadowBlur = fs * 0.15;
            E.masked(G, nameT.c, D.at(nq), x + jx, y + jy, nameT.w, nameT.h);
            G.restore();
            const uq = prog(lt, 0.95, 0.5, "out"), half = Math.min(nameT.w * 0.42, W * 0.4);
            E.brush(G, [[cx - half, nameBase + fs * 0.16], [cx, nameBase + fs * 0.2], [cx + half, nameBase + fs * 0.14]], uq, { width: u * 0.9, color: INK, alpha: 0.8, seed: 62, hairs: 7 });
          }
          /* tarjeta LIKE */
          const lk = slam(lt, likeAt);
          if (lk.q > 0) {
            G.save(); G.globalAlpha *= lk.a; G.translate(L.x, L.y); G.scale(lk.s, lk.s); G.rotate(-0.03);
            E.card(G, 0, 0, L.w, L.h, 0);
            const isz = L.h * 0.64, pressed = prog(lt, likeAt + 0.3, 0.12) >= 1;
            G.save(); G.translate(-L.w / 2 + L.h * 0.22, -isz / 2); G.scale(isz / 24, isz / 24);
            G.fillStyle = DARK; G.fill(THUMB); if (!pressed) { G.fillStyle = "#e4e3df"; G.scale(0.82, 0.82); G.translate(2.6, 2.6); G.fill(THUMB); }
            G.restore();
            G.font = E.font("grot", L.h * 0.48, 700); G.letterSpacing = L.h * 0.04 + "px"; G.fillStyle = DARK; G.textBaseline = "middle"; G.textAlign = "center";
            G.fillText("LIKE", L.h * 0.38, L.h * 0.04);
            G.restore();
            /* círculo a pincel que lo marca */
            const cq = prog(lt, likeAt + 0.28, 0.4, "out");
            if (cq > 0) for (const pts of E.scribble("circle", L.x, L.y, L.w * 1.22, L.h * 1.6, 71)) E.brush(G, pts, cq, { width: u * 0.75, color: INK, alpha: 0.85, seed: 72, hairs: 7 });
          }
          /* flecha a pincel */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.2, subAt - 0.15), aq = prog(lt, a0, Math.max(0.3, subAt + 0.15 - a0), "inOut");
            if (aq > 0) {
              E.brush(G, arrowPts, aq, { width: u * 0.7, color: INK, alpha: 0.85, seed: 73, hairs: 6 });
              const hq = prog(lt, a0 + Math.max(0.3, subAt + 0.15 - a0) * 0.85, 0.15);
              if (hq > 0) {
                const [x1, y1] = arrowPts[arrowPts.length - 1], [x0, y0] = arrowPts[arrowPts.length - 3], ang = Math.atan2(y1 - y0, x1 - x0), hl = u * 2.6;
                for (const d of [-0.55, 0.55]) E.brush(G, [[x1, y1], [x1 - Math.cos(ang + d) * hl, y1 - Math.sin(ang + d) * hl]], hq, { width: u * 0.6, color: INK, alpha: 0.85, seed: 74, hairs: 5 });
              }
            }
          }
          /* placa SUSCRÍBETE (cartel de letras blanco) */
          const sb = slam(lt, subAt, 0.18);
          if (sb.q > 0) {
            const [sx, sy] = S.shake(lt, [subAt + 0.15], u * 0.5);
            G.save(); G.globalAlpha *= sb.a; G.translate(B.x + sx, B.y + sy); G.scale(sb.s, sb.s); G.rotate(0.012);
            E.card(G, 0, 0, B.w, B.h, 0);
            G.fillStyle = "rgba(20,18,16,.1)"; for (let k = 1; k < 4; k++) G.fillRect(-B.w / 2, -B.h / 2 + k * B.h / 4, B.w, Math.max(1, u * 0.08));
            G.drawImage(ctaT.c, -ctaT.w / 2 + ctaFs * 0.07, -ctaT.h / 2 + ctaFs * 0.05, ctaT.w, ctaT.h);
            G.restore();
          }
          /* campana: aparece y suena (oscilación amortiguada) */
          const bq = prog(lt, bellAt, 0.2, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.45;
            G.save(); G.globalAlpha *= bq; bell(G, bellX, B.y, bellS * (0.7 + 0.3 * bq), rot, clamp(1 - d / 1.4) * 0.8); G.restore();
          }
          /* apoyo tipeado + dirección del canal */
          if (lt > supAt) {
            let n = Math.floor((lt - supAt) * 45);
            G.save(); G.textAlign = "center"; G.textBaseline = "alphabetic"; G.shadowColor = "#000"; G.shadowBlur = u;
            G.font = E.font("cond", supFs, 600); G.letterSpacing = supFs * 0.04 + "px"; G.fillStyle = "rgba(220,214,204,.86)";
            sup.forEach((s, i) => { const k = Math.min(s.length, n); n -= k; if (k > 0) G.fillText(s.slice(0, k), cx, supY + i * supFs * 1.25); });
            const hq = prog(lt, supAt + 0.35, 0.4, "linear");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 2.8 : 1.95), txt = String(p.handle);
              G.font = E.font("wide", hs, 700); G.letterSpacing = hs * 0.12 + "px"; G.fillStyle = INK;
              G.fillText(txt.slice(0, Math.ceil(txt.length * hq)), cx, handleY);
              const w = G.measureText(txt).width; G.fillStyle = "rgba(235,230,220,.45)"; G.fillRect(cx - w / 2, handleY + hs * 0.55, w * hq, Math.max(1, u * 0.1));
            }
            G.restore();
          }
          G.restore();
        },
      };
    },
  });
})();

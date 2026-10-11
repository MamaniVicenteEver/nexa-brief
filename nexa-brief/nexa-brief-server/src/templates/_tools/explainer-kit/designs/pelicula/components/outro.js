/* =============================================================================
   pelicula · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: sala oscura con el haz del proyector y polvo (o tiras / rollos /
   foto / componente). Secuencia sincronizada con la despedida narrada:
   GRACIAS POR VER (parpadeo de exposición) → CANAL gigante naranja que CAE con
   estela, hace glitch de franjas y se asienta sobre la barra roja (quemado de luz
   al entrar) → cuadro de película LIKE que se "expone" (se llena de naranja) y
   se marca con lápiz graso rojo de montajista → flecha a lápiz graso → tira roja
   SUSCRÍBETE que entra con barrido → campana que suena → mensaje de apoyo
   expuesto letra a letra → youtube.com/@canal con barra roja. Fundido a negro
   (también tapa grano y rayas, vía Kit.pelicula.fade).
   ========================================================================== */
(function () {
  const K = Kit, P = Kit.pelicula, HK = Kit.pelicula.hook, { clamp, prog, ease } = K;
  const { CREAM, ORANGE_HI, RED } = HK.COL;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");
  const PENCIL = "#d8342a";

  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  /** trazo de lápiz graso (dos pasadas temblorosas) a lo largo de pts, dibujado hasta q */
  function grease(G, pts, q, lw, seed) {
    if (q <= 0) return;
    const n = Math.max(2, Math.round(pts.length * clamp(q)));
    G.save(); G.lineCap = "round"; G.lineJoin = "round"; G.strokeStyle = PENCIL;
    for (let pass = 0; pass < 2; pass++) {
      const r = K.rng(seed + pass * 17);
      G.globalAlpha = pass ? 0.55 : 0.92; G.lineWidth = lw * (pass ? 0.55 : 1);
      G.beginPath();
      for (let i = 0; i < n; i++) { const [x, y] = pts[i], j = lw * 0.35; i ? G.lineTo(x + (r() - 0.5) * j + pass * lw * 0.3, y + (r() - 0.5) * j) : G.moveTo(x, y); }
      G.stroke();
    }
    G.restore();
  }
  const ellipsePts = (cx, cy, rx, ry, seed) => { const r = K.rng(seed), out = [], a0 = -2.2; for (let i = 0; i <= 70; i++) { const a = a0 + i / 70 * Math.PI * 2.18, k = 1 + (r() - 0.5) * 0.04 + i / 70 * 0.06; out.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); } return out; };
  /** campana crema (x,y = centro), s = escala */
  function bell(G, x, y, s, rot, rays) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    G.fillStyle = CREAM; G.shadowColor = "rgba(10,7,3,.9)"; G.shadowBlur = s * 2;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, 7); G.fill();
    G.restore();
    if (rays > 0) {
      G.save(); G.strokeStyle = `rgba(232,100,42,${rays})`; G.lineWidth = s * 0.6; G.lineCap = "round";
      for (const d of [-1, 1]) { G.beginPath(); G.arc(x, y - s * 0.6, s * (6.2 + (1 - rays) * 1.5), d < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, d < 0 ? Math.PI * 1.2 : Math.PI * 0.2); G.stroke(); }
      G.restore();
    }
  }
  /** pedazo de película (cuerpo + bandas con perforaciones arriba y abajo), centrado en 0,0 */
  function filmPiece(G, w, h, body, band, holes, u) {
    const bh = h * 0.2, ph = bh * 0.5, pw = ph * 0.75, pitch = pw * 2;
    G.fillStyle = band; G.fillRect(-w / 2, -h / 2, w, h);
    G.fillStyle = body; G.fillRect(-w / 2, -h / 2 + bh, w, h - bh * 2);
    G.fillStyle = holes;
    G.beginPath();
    for (const y of [-h / 2 + bh / 2, h / 2 - bh / 2]) for (let x = -w / 2 + pitch * 0.35; x < w / 2 - pw * 0.5; x += pitch) G.roundRect(x, y - ph / 2, pw, ph, ph * 0.18);
    G.fill();
  }

  K.register({
    name: "pelicula.outro", tags: ["cierre", "canal", "like", "suscribirse", "proyector"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro (bg: projector | strips | reel | leader | image con src | component con use/useParams). Por defecto sala oscura con el haz del proyector, polvo flotando y rollos girando. GRACIAS POR VER → nombre del canal GIGANTE naranja que cae con estela, hace glitch y se asienta sobre la barra roja (con quemado de luz) → cuadro de película LIKE que se expone en naranja y se marca con lápiz graso rojo → flecha a lápiz graso → tira roja SUSCRÍBETE que entra con barrido + campana que suena → mensaje de apoyo expuesto letra a letra → youtube.com/@canal. Fundido a negro al final. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "ARCHIVO 35", cta: "SUSCRÍBETE", support: "Tu apoyo nos ayuda a seguir rescatando historias.", handle: "youtube.com/@archivo35" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte la historia." }),
      ...K.hook.bgParams(["projector", "strips", "reel", "leader"]),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene mucho texto)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const st = ctx.stage, { W, H, u, portrait } = st, cx = W / 2, R = Math.min(3, ctx.dpr * 1.25);
      const name = String(p.channel).toUpperCase();
      const fs = Math.min(HK.fit(name, W * (portrait ? 0.88 : 0.66), 600), H * (portrait ? 0.115 : 0.19));
      const nameT = HK.ink(name, fs, ORANGE_HI, 61, R, 600), nameW = HK.meas(name, fs, 600);
      const thanksY = H * (portrait ? 0.24 : 0.15), nameBase = H * (portrait ? 0.355 : 0.4);
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, en diagonal en 9:16) */
      const L = portrait ? { x: cx + u * 10, y: H * 0.47, w: u * 54, h: u * 20 } : { x: cx - u * (p.arrow ? 32 : 25), y: H * 0.62, w: u * 25, h: u * 11 };
      const B = portrait ? { x: cx - u * 7, y: H * 0.605, w: u * 76, h: u * 20 } : { x: cx + u * 13, y: H * 0.62, w: u * 38, h: u * 12 };
      const bellX = B.x + B.w / 2 + u * (portrait ? 7.5 : 5.5), bellS = u * (portrait ? 0.95 : 0.65);
      const arrowPts = (() => {
        const pts = [];
        const [x0, y0, x1, y1, mx, my] = portrait
          ? [L.x - L.w * 0.62, L.y + L.h * 0.1, B.x - B.w * 0.3, B.y - B.h * 0.85, L.x - L.w * 0.95, (L.y + B.y) / 2]
          : [L.x + L.w * 0.35, L.y - L.h * 0.8, B.x - B.w / 2 - u * 2.5, B.y - B.h * 0.3, (L.x + B.x) / 2, L.y - L.h * 1.9];
        for (let k = 0; k <= 30; k++) { const s = k / 30, a = 1 - s; pts.push([a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]); }
        return pts;
      })();
      const circlePts = ellipsePts(L.x, L.y, L.w * 0.66, L.h * 0.86, 71);
      const cta = String(p.cta).toUpperCase(), ctaFs = Math.min(HK.fit(cta, B.w * 0.78), B.h * 0.38), ctaT = HK.ink(cta, ctaFs, CREAM, 67, R);
      const likeFs = L.h * 0.34;
      const sup = wrap(p.support, portrait ? 30 : 58), supFs = u * (portrait ? 4.2 : 2.9);
      const supY = portrait ? H * 0.72 : H * 0.79, handleY = supY + sup.length * supFs * 1.3 + u * (portrait ? 3 : 2.2);
      const BG = K.hook.bg(ctx, p, {
        auto: "projector", tone: () => P.grade(ctx, p.src),
        presets: Object.fromEntries(Object.entries(HK.presets(ctx, p)).map(([k, fn]) => [k, (G, s, lt, b) => { fn(G, s, lt, b); G.fillStyle = "rgba(10,7,3,.35)"; G.fillRect(0, 0, s.W, s.H); }])),
      });
      const slam = (lt, at, d = 0.22) => { const q = prog(lt, at, d, "linear"); return { q, e: ease.expoOut(q), a: clamp(q * 5) }; };
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, f = Math.floor((b.t0 + lt) * 24);
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const fade = prog(lt, b.dur - 0.4, 0.4, "linear");
          P.fade = Math.max(P.fade || 0, fade);
          const [sx, sy] = HK.shake(lt, [0.72, subAt + 0.2], u * 0.7);
          G.save(); G.globalAlpha = 1 - fade;
          /* fondo */
          BG.render(lt, b);
          if (BG.mode === "image" || BG.mode === "component") HK.filmFrame(G, st, lt);
          /* oscurecer el centro para el texto */
          const dk = G.createRadialGradient(cx, H * 0.5, Math.min(W, H) * 0.1, cx, H * 0.5, Math.hypot(W, H) * 0.6);
          dk.addColorStop(0, "rgba(10,7,3,.5)"); dk.addColorStop(1, "rgba(10,7,3,.15)"); G.fillStyle = dk; G.fillRect(0, 0, W, H);
          G.translate(sx, sy);
          /* GRACIAS POR VER */
          HK.kicker(G, p.thanks, cx, thanksY, u * (portrait ? 3.2 : 2.1), HK.flick(lt, 0.08, 0.45));
          /* canal: cae con estela, glitch al aterrizar, deriva y barra roja */
          const nq = prog(lt, 0.3, 0.42, "linear");
          if (nq > 0) {
            const e = ease.expoOut(nq), off = -H * 0.5 * (1 - e), x = cx - nameW / 2, y = nameBase + off;
            G.save(); G.shadowColor = "rgba(10,7,3,.85)"; G.shadowBlur = fs * 0.12;
            if (nq < 1) {
              const N = 9, Ls = H * 0.5 * 10 * Math.pow(2, -10 * nq) * 0.1;
              for (let k = N - 1; k >= 0; k--) { G.globalAlpha = (1 - fade) * (k === 0 ? clamp(nq * 6) : 0.5 / (k + 1)); HK.drawInk(G, nameT, x, y - Ls * k / (N - 1)); }
            } else if (lt > 0.78 && lt < 0.98 && K.rng(f * 7 + 1)() < 0.8) { G.shadowBlur = 0; P.slices(G, nameT.c, x - nameT.pad, y - nameT.base, nameT.w, nameT.h, f, 0.08, 61); }
            else HK.drawInk(G, nameT, x, y);
            G.restore();
            const bq = prog(lt, 0.85, 0.45, "out");
            if (bq > 0) { const bw = Math.min(nameW * 0.34, W * 0.3); G.fillStyle = RED; G.fillRect(cx - bw / 2, nameBase + fs * 0.12, bw * bq, Math.max(3, fs * 0.07)); }
          }
          /* LIKE: cuadro de película que se expone y se marca con lápiz graso */
          const lk = slam(lt, likeAt);
          if (lk.q > 0) {
            const pressed = prog(lt, likeAt + 0.3, 0.14, "out"), bump = 1 + 0.1 * Math.sin(Math.PI * clamp((lt - likeAt - 0.3) / 0.25));
            G.save(); G.globalAlpha *= lk.a; G.translate(L.x, L.y + H * 0.12 * (1 - lk.e)); G.scale(bump, bump); G.rotate(-0.025);
            G.shadowColor = "rgba(0,0,0,.6)"; G.shadowBlur = u * 2;
            filmPiece(G, L.w, L.h, "#2b2215", "#120d07", "#efe4c6", u); G.shadowBlur = 0;
            const ih = L.h * 0.6, iw = L.w - L.h * 0.14;
            if (pressed > 0) { G.fillStyle = `rgba(217,88,31,${0.95 * pressed})`; G.fillRect(-iw / 2, -ih / 2, iw, ih); }
            const isz = ih * 0.7;
            G.save(); G.translate(-iw / 2 + ih * 0.25, -isz / 2 - isz * 0.04); G.scale(isz / 24, isz / 24);
            G.fillStyle = CREAM; G.fill(THUMB);
            if (pressed < 0.5) { G.fillStyle = "#2b2215"; G.translate(2.4, 2.6); G.scale(0.8, 0.8); G.fill(THUMB); }
            G.restore();
            G.font = `800 ${likeFs}px Montserrat`; G.letterSpacing = likeFs * 0.08 + "px"; G.fillStyle = CREAM; G.textBaseline = "middle"; G.textAlign = "center";
            G.fillText("LIKE", ih * 0.42, likeFs * 0.05);
            G.restore();
            grease(G, circlePts, prog(lt, likeAt + 0.32, 0.42, "out"), u * (portrait ? 0.9 : 0.7), 72);
          }
          /* flecha a lápiz graso */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.25, subAt - 0.15), ad = Math.max(0.3, subAt + 0.15 - a0), aq = prog(lt, a0, ad, "inOut");
            if (aq > 0) {
              grease(G, arrowPts, aq, u * 0.6, 73);
              const hq = prog(lt, a0 + ad * 0.85, 0.15);
              if (hq > 0) {
                const [x1, y1] = arrowPts[arrowPts.length - 1], [x0, y0] = arrowPts[arrowPts.length - 4], ang = Math.atan2(y1 - y0, x1 - x0), hl = u * 2.6;
                for (const d of [-0.55, 0.55]) grease(G, [[x1, y1], [x1 - Math.cos(ang + d) * hl * 0.5, y1 - Math.sin(ang + d) * hl * 0.5], [x1 - Math.cos(ang + d) * hl, y1 - Math.sin(ang + d) * hl]], hq, u * 0.6, 74);
              }
            }
          }
          /* SUSCRÍBETE: tira roja que entra con barrido y estela */
          const sb = slam(lt, subAt, 0.26);
          if (sb.q > 0) {
            const off = W * 0.7 * (1 - sb.e), N = sb.q < 1 ? 8 : 1, Ls = W * 0.7 * 10 * Math.pow(2, -10 * sb.q) * 0.08;
            for (let k = N - 1; k >= 0; k--) {
              G.save(); G.globalAlpha *= k === 0 ? sb.a : 0.45 / (k + 1); G.translate(B.x + off + Ls * k / Math.max(1, N - 1), B.y); G.rotate(0.015);
              if (k === 0) { G.shadowColor = "rgba(0,0,0,.6)"; G.shadowBlur = u * 2; }
              filmPiece(G, B.w, B.h, RED, "#7d1e16", "#f3d9c4", u); G.shadowBlur = 0;
              HK.drawInk(G, ctaT, -HK.meas(cta, ctaFs) / 2, ctaFs * 0.36);
              G.restore();
            }
          }
          /* campana: aparece y suena (oscilación amortiguada) */
          const bq = prog(lt, bellAt, 0.2, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.45;
            G.save(); G.globalAlpha *= bq; bell(G, bellX, B.y, bellS * (0.7 + 0.3 * bq), rot, clamp(1 - d / 1.4) * 0.9); G.restore();
          }
          /* apoyo expuesto letra a letra + dirección con barra roja */
          if (lt > supAt) {
            let n = Math.floor((Math.floor(lt * 24) / 24 - supAt) * 45);
            G.save(); G.textAlign = "center"; G.textBaseline = "alphabetic"; G.shadowColor = "rgba(10,7,3,.95)"; G.shadowBlur = u;
            G.font = `600 ${supFs}px Montserrat`; G.letterSpacing = supFs * 0.03 + "px"; G.fillStyle = "rgba(243,234,219,.9)";
            sup.forEach((s, i) => { const k = Math.min(s.length, n); n -= k; if (k > 0) { const full = G.measureText(s).width; G.textAlign = "left"; G.fillText(s.slice(0, k), cx - full / 2, supY + i * supFs * 1.3); } });
            const hq = prog(lt, supAt + 0.35, 0.45, "linear");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 3.4 : 2.1), txt = String(p.handle);
              HK.subLine(G, txt.slice(0, Math.ceil(txt.length * hq)) + " ".repeat(txt.length - Math.ceil(txt.length * hq)), cx, handleY, hs, 1, "center", false, W * 0.92);
            }
            G.restore();
          }
          G.restore();
          /* quemado de luz cuando cae el nombre */
          P.leak(ctx.g.top, st, "burn", (lt - 0.12) / 0.95, { strength: 0.6 });
        },
      };
    },
  });
})();

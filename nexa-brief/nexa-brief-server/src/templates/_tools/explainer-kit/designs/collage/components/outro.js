/* =============================================================================
   collage · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: la mesa de archivo sigue en plano secuencia (o cielo, mapa, pila
   de diarios, foto o componente) con un oscurecido fuerte para leer.
   GRACIAS POR VER (versalitas doradas) → NOMBRE DEL CANAL en dorado 3D que entra
   girando letra por letra (como el emblema de la referencia) y destella →
   recorte LIKE que se presiona y queda marcado con un círculo de tinta roja →
   ruta punteada roja (como las del mapa) → cinta bordó SUSCRÍBETE que cae +
   campana dorada que suena → mensaje de apoyo palabra por palabra → dirección.
   Tiempos compatibles con el cierre anterior (likeAt, subscribeAt, bellAt,
   supportAt) vía Kit.hook.outroTimes.
   ========================================================================== */
(function () {
  "use strict";
  const K = window.Kit, CL = K.collage, HK = CL.hook, { clamp, lerp, prog, ease } = K;
  const INKC = "#2a2226", WINE = "#9e2f4f";
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  /** campana dorada (x,y = centro de la boca), s = escala, rot = vaivén */
  function bell(G, x, y, s, rot, rays) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    const gr = G.createLinearGradient(-s * 4, -s * 4, s * 4, s * 4); gr.addColorStop(0, "#fff0c4"); gr.addColorStop(0.45, "#e2b25a"); gr.addColorStop(1, "#8f6024");
    G.shadowColor = "rgba(10,4,8,.6)"; G.shadowBlur = s * 1.5; G.shadowOffsetY = s * 0.4;
    G.fillStyle = gr; G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.shadowColor = "transparent";
    G.strokeStyle = "rgba(90,58,20,.6)"; G.lineWidth = s * 0.25; G.beginPath(); G.moveTo(-s * 3.5, s * 1.6); G.lineTo(s * 3.5, s * 1.6); G.stroke();
    G.fillStyle = "#b8873a"; G.beginPath(); G.arc(0, s * 4.4, s * 1.1, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, 7); G.fill();
    G.restore();
    if (rays > 0) {
      G.save(); G.strokeStyle = `rgba(236,208,142,${rays})`; G.lineWidth = s * 0.5; G.lineCap = "round";
      for (const d of [-1, 1]) for (const k of [0, 1]) { const R = s * (6 + k * 2 + (1 - rays) * 1.5); G.beginPath(); G.arc(x, y - s * 0.6, R, d < 0 ? Math.PI * 0.82 : -Math.PI * 0.18, d < 0 ? Math.PI * 1.18 : Math.PI * 0.18); G.stroke(); }
      G.restore();
    }
  }
  /** golpe de entrada: escala que cae + opacidad */
  const slam = (lt, at, d = 0.22) => { const q = prog(lt, at, d, "linear"); return { q, s: 1 + 0.9 * (1 - ease.expoOut(q)), a: clamp(q * 4) }; };
  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }

  K.register({
    name: "collage.outro", tags: ["cierre", "canal", "like", "suscribirse", "archivo"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro (bg: table | sky | map | press | image con src | component con use/useParams): por defecto la mesa de archivo en plano secuencia, oscurecida. GRACIAS POR VER en versalitas doradas → nombre del canal en DORADO 3D que entra girando letra por letra y destella → recorte LIKE que se presiona y queda marcado con un círculo de tinta roja → ruta punteada roja → cinta bordó SUSCRÍBETE que cae + campana dorada que suena → apoyo en itálica palabra por palabra → youtube.com/@canal. Tiempos sincronizables con la despedida narrada.",
    example: { thanks: "GRACIAS POR VER", channel: "HEMEROTECA", cta: "SUSCRÍBETE", support: "Tu apoyo permite seguir contando historias de archivo.", handle: "youtube.com/@hemeroteca" },
    params: {
      ...K.hook.outroParams({ support: "Tu apoyo permite seguir contando historias de archivo." }),
      ...K.hook.bgParams(HK.PRESETS),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene mucho texto)." },
      photoTone: HK.photoTone("bw"),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const F = ctx.family.collage, { W, H, u, portrait } = ctx.stage, cx = W / 2, dpr = ctx.dpr;
      const name = String(p.channel).toUpperCase(), chars = [...name];
      const fs = Math.min(HK.fitPx(name, W * (portrait ? 0.88 : 0.66), "Cinzel", 700), H * (portrait ? 0.1 : 0.19));
      const thanksY = H * (portrait ? 0.235 : 0.14), nameBase = H * (portrait ? 0.335 : 0.37);
      const nameW = HK.wOf(name, fs, "Cinzel", 700), nx0 = cx - nameW / 2;
      const charX = chars.map((c, i) => nx0 + HK.wOf(chars.slice(0, i).join(""), fs, "Cinzel", 700));
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, vertical en 9:16) */
      const L = portrait ? { x: cx, y: H * 0.46, w: u * 58, h: u * 18 } : { x: cx - u * (p.arrow ? 45 : 33), y: H * 0.6, w: u * 30, h: u * 12 };
      const B = portrait ? { x: cx, y: H * 0.6, w: W * 0.72, h: u * 18 } : { x: cx + u * 16, y: H * 0.6, w: u * 46, h: u * 13.5 };
      const bellX = portrait ? cx : B.x + B.w / 2 + u * 13, bellY = portrait ? H * 0.69 : B.y + u * 2.4, bellS = u * (portrait ? 1.35 : 1.0);
      const ctaLines = [String(p.cta).toUpperCase()], ctaFs = Math.min(HK.fitPx(ctaLines[0], B.w * 0.68, "Cinzel", 700), B.h * 0.44);
      const arrowPts = (() => {
        const pts = [];
        const [x0, y0, x1, y1, mx, my] = portrait
          ? [L.x + L.w * 0.3, L.y + L.h * 0.75, B.x - B.w * 0.25, B.y - B.h * 0.85, L.x + L.w * 0.55, (L.y + B.y) / 2 + u * 2]
          : [L.x + L.w / 2 + u * 2.5, L.y - L.h * 0.35, B.x - B.w / 2 - u * 5, B.y - B.h * 0.25, (L.x + B.x) / 2 - u * 4, L.y - L.h * 1.5];
        for (let k = 0; k <= 30; k++) { const s = k / 30, a = 1 - s; pts.push([a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]); }
        return pts;
      })();
      const supFs = u * (portrait ? 4.4 : 3.4), sup = wrap(p.support, portrait ? 26 : 56);
      const supY = portrait ? H * 0.765 : H * 0.8, handleY = supY + (sup.length - 1) * supFs * 1.2 + u * (portrait ? 5.2 : 3.6);
      const supWords = []; sup.forEach((line, li) => { const ws = line.split(" "), tw = HK.wOf(line, supFs, "Cormorant Garamond", 600, "italic"); let x = cx - tw / 2; ws.forEach(w => { supWords.push({ w, x, y: supY + li * supFs * 1.2 }); x += HK.wOf(w + " ", supFs, "Cormorant Garamond", 600, "italic"); }); });
      const BG = K.hook.bg(ctx, p, { auto: "table", tone: HK.toneFn(ctx, p), presets: HK.presets(ctx, 0.3) });
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main;
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          const [sx, sy] = HK.shake(lt, [subAt + 0.15], u * 0.5);
          G.save(); G.globalAlpha = exit;
          G.save(); G.translate(sx, sy); BG.render(lt, b); G.restore();
          F.dof = 0.3;
          /* GRACIAS POR VER */
          HK.kicker(G, p.thanks, cx, thanksY, u * (portrait ? 3.0 : 2.4), prog(lt, 0.1, 0.6, "out"));
          /* canal: letras doradas que entran girando y quedan; brillo que lo recorre */
          chars.forEach((ch, i) => {
            if (ch === " ") return;
            const q = prog(lt, 0.3 + i * 0.07, 0.9, "out"); if (q <= 0) return;
            const sp = HK.gold(F, ch, fs, dpr), cw = HK.wOf(ch, fs, "Cinzel", 700), ang = (1 - q) * Math.PI * 2, sxs = Math.cos(ang), sc = 1 + 1.6 * Math.pow(1 - q, 2);
            G.save(); G.globalAlpha *= clamp(q * 3); G.translate(charX[i] + cw / 2, nameBase - (1 - q) * u * 8);
            G.scale(sc * (Math.abs(sxs) < 0.05 ? 0.05 : sxs), sc);
            if (sxs < 0) G.filter = "brightness(0.55)";
            G.shadowColor = "rgba(10,4,8,.65)"; G.shadowBlur = fs * 0.14; G.shadowOffsetY = fs * 0.05;
            HK.drawGold(G, sp, -cw / 2, 0); G.shadowColor = "transparent"; G.filter = "none";
            const tt = lt - 1.5 - i * 0.045; if (tt > 0) HK.sheen(G, sp, -cw / 2, 0, (tt % 3.6) / 0.8);
            G.restore();
          });
          /* filete dorado con rombo bajo el nombre */
          const rq = prog(lt, 1.1, 0.7, "out");
          if (rq > 0) {
            const ry = nameBase + fs * 0.32, half = Math.min(nameW * 0.45, W * 0.4) * rq;
            G.save(); G.fillStyle = "rgba(236,208,142,.8)"; G.fillRect(cx - half, ry - Math.max(1, u * 0.08), half * 2, Math.max(1, u * 0.16));
            G.beginPath(); G.moveTo(cx, ry - u * 0.9); G.lineTo(cx + u * 0.65, ry); G.lineTo(cx, ry + u * 0.9); G.lineTo(cx - u * 0.65, ry); G.closePath(); G.fill(); G.restore();
          }
          /* recorte LIKE: cae, se presiona y queda marcado con tinta roja */
          const lk = slam(lt, likeAt);
          if (lk.q > 0) {
            const pr = likeAt + 0.32, dip = 1 - 0.09 * Math.sin(Math.PI * clamp((lt - pr) / 0.22)), pressed = lt >= pr + 0.08;
            G.save(); G.globalAlpha *= lk.a; G.translate(L.x, L.y); G.scale(lk.s * dip, lk.s * dip); G.rotate(-0.035);
            G.save(); G.shadowColor = "rgba(10,4,8,.6)"; G.shadowBlur = u * 2; G.shadowOffsetY = u * (pressed ? 0.3 : 0.9); G.fillStyle = "#ece2d8"; G.fillRect(-L.w / 2, -L.h / 2, L.w, L.h); G.restore();
            G.globalAlpha *= 0.55; G.drawImage(F.paperLight, 0, 0, 300, 300 * L.h / L.w, -L.w / 2, -L.h / 2, L.w, L.h); G.globalAlpha = lk.a * exit;
            G.strokeStyle = "rgba(42,34,38,.55)"; G.lineWidth = Math.max(1, u * 0.12); G.strokeRect(-L.w / 2 + L.h * 0.08, -L.h / 2 + L.h * 0.08, L.w - L.h * 0.16, L.h - L.h * 0.16);
            const isz = L.h * 0.62;
            G.save(); G.translate(-L.w / 2 + L.h * 0.25, -isz / 2 - L.h * 0.02); G.scale(isz / 24, isz / 24);
            if (pressed) { G.fillStyle = WINE; G.fill(THUMB); } else { G.strokeStyle = INKC; G.lineWidth = 1.4; G.lineJoin = "round"; G.stroke(THUMB); }
            G.restore();
            G.font = HK.fontOf(L.h * 0.5, "Playfair Display", 900); G.letterSpacing = L.h * 0.04 + "px"; G.fillStyle = pressed ? WINE : INKC; G.textBaseline = "middle"; G.textAlign = "center";
            G.fillText("LIKE", L.h * 0.42, L.h * 0.04);
            G.restore();
            /* círculo de tinta roja (marcador) */
            const cq = prog(lt, pr + 0.05, 0.45, "out");
            if (cq > 0) {
              G.save(); G.strokeStyle = "rgba(214,58,78,.92)"; G.lineWidth = u * (portrait ? 0.75 : 0.55); G.lineCap = "round"; G.shadowColor = "rgba(255,90,100,.4)"; G.shadowBlur = u;
              G.beginPath(); const n = 60, a0 = -2.5, turn = Math.PI * 2 * 1.12;
              for (let k = 0; k <= n * cq; k++) { const a = a0 + turn * k / n, wob = 1 + 0.035 * Math.sin(a * 3 + 1) + 0.04 * k / n; const x = L.x + Math.cos(a) * L.w * 0.66 * wob, y = L.y + Math.sin(a) * L.h * 0.95 * wob; k ? G.lineTo(x, y) : G.moveTo(x, y); }
              G.stroke(); G.restore();
            }
          }
          /* ruta punteada roja hasta SUSCRÍBETE */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.25, subAt - 0.15), dur = Math.max(0.3, subAt + 0.1 - a0), aq = prog(lt, a0, dur, "inOut");
            if (aq > 0) {
              const n = Math.max(1, Math.round(aq * (arrowPts.length - 1)));
              G.save(); G.strokeStyle = "#e0596c"; G.lineWidth = u * (portrait ? 0.55 : 0.4); G.lineCap = "round"; G.setLineDash([u * 1.1, u * 0.8]); G.lineDashOffset = -lt * u * 3;
              G.shadowColor = "rgba(10,4,8,.7)"; G.shadowBlur = u * 0.8;
              G.beginPath(); for (let i = 0; i <= n; i++) i ? G.lineTo(arrowPts[i][0], arrowPts[i][1]) : G.moveTo(arrowPts[i][0], arrowPts[i][1]); G.stroke();
              G.setLineDash([]);
              if (aq >= 0.98) {
                const [x1, y1] = arrowPts[arrowPts.length - 1], [x0, y0] = arrowPts[arrowPts.length - 3], an = Math.atan2(y1 - y0, x1 - x0), hl = u * (portrait ? 2.6 : 2);
                G.fillStyle = "#e0596c"; G.beginPath(); G.moveTo(x1 + Math.cos(an) * hl * 0.3, y1 + Math.sin(an) * hl * 0.3); G.lineTo(x1 - Math.cos(an - 0.5) * hl, y1 - Math.sin(an - 0.5) * hl); G.lineTo(x1 - Math.cos(an + 0.5) * hl, y1 - Math.sin(an + 0.5) * hl); G.closePath(); G.fill();
              }
              G.restore();
            }
          }
          /* cinta bordó SUSCRÍBETE que cae */
          const sb = slam(lt, subAt, 0.2);
          if (sb.q > 0) {
            G.save(); G.globalAlpha *= sb.a; G.translate(B.x + sx, B.y + sy); G.rotate(-0.02 + (1 - ease.expoOut(sb.q)) * 0.08); G.scale(sb.s, sb.s);
            HK.ribbon(G, B.w, B.h, ctaLines, ctaFs); G.restore();
            HK.sparks(G, B.x, B.y - B.h * 0.3, B.w * 0.9, lt - subAt - 0.12, 61, u);
            F.boost.push({ col: [255, 150, 170], a: 0.5 * K.collage.bell(lt, subAt + 0.2, 0.25), x: B.x / W, y: B.y / H, r: 0.5 });
          }
          /* campana: aparece y suena (oscilación amortiguada) */
          const bq = prog(lt, bellAt, 0.22, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.4) * 0.5;
            G.save(); G.globalAlpha *= bq; bell(G, bellX, bellY, bellS * (0.6 + 0.4 * ease.back(bq)), rot, clamp(1 - d / 1.5) * 0.85); G.restore();
          }
          /* apoyo (itálica, palabra por palabra) + dirección del canal */
          if (lt > supAt) {
            G.save(); G.textAlign = "left"; G.textBaseline = "alphabetic"; G.font = HK.fontOf(supFs, "Cormorant Garamond", 600, "italic");
            G.fillStyle = "rgba(246,232,226,.95)"; G.shadowColor = "rgba(10,4,8,.9)"; G.shadowBlur = u * 1.2;
            supWords.forEach((w, i) => { const a = prog(lt, supAt + i * 0.06, 0.35, "out"); if (a <= 0) return; G.globalAlpha = exit * a; G.fillText(w.w, w.x, w.y + (1 - a) * u * 1.2); });
            const hq = prog(lt, supAt + 0.25 + supWords.length * 0.06, 0.6, "out");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 3.1 : 2.3), txt = String(p.handle);
              G.globalAlpha = exit; G.font = `600 ${hs}px 'Open Sans', sans-serif`; G.letterSpacing = hs * 0.1 + "px"; G.textAlign = "center"; G.fillStyle = "#ecd08e";
              const w = G.measureText(txt).width;
              G.save(); G.beginPath(); G.rect(cx - w / 2 - hs, handleY - hs * 1.5, (w + hs * 2) * hq, hs * 2.5); G.clip(); G.fillText(txt, cx, handleY); G.restore();
              G.shadowBlur = 0; G.fillStyle = "rgba(236,208,142,.55)"; G.fillRect(cx - w / 2, handleY + hs * 0.55, w * hq, Math.max(1, u * 0.1));
            }
            G.restore();
          }
          G.restore();
        },
      };
    },
  });
})();

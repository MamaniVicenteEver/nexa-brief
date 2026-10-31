/* =============================================================================
   imperio · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro. Sobre el atlas apagado (o archivo / papel / foto / componente):
   GRACIAS POR VER (rótulo con barras carmesí) → nombre del canal en condensada
   blanca que SUBE con degradé delante del SOL que sale desde abajo con su abanico
   de rayos girando lento → LIKE (pulgar en un óvalo de línea fina que se rellena de
   carmesí) → flecha de línea fina que se dibuja → SUSCRÍBETE en franja carmesí que
   entra con barrido + campana que suena → mensaje de apoyo tipeado → dirección del
   canal con barra carmesí. Fundido a negro al final (tapa grano y viñeta).
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, IM = Kit.imperio, HK = Kit.imperio.hook, { clamp, prog, ease, lerp } = K;
  const { WHITE, CRIMSON } = HK.COL;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  function bell(G, x, y, s, rot) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5);
    G.fillStyle = WHITE; G.shadowColor = "rgba(8,10,12,.8)"; G.shadowBlur = s * 1.5;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.restore();
  }

  K.register({
    name: "imperio.outro", tags: ["cierre", "canal", "like", "suscribirse", "sol"], layer: "main", post: 0, opaque: true,
    summary: "Cierre del canal SIN recuadro (bg: atlas | archivo | papel | image con src | component con use/useParams). GRACIAS POR VER → nombre del canal en condensada blanca que sube delante del SOL carmesí que sale desde abajo con sus rayos girando → LIKE (óvalo fino que se llena de carmesí) → flecha de línea fina → SUSCRÍBETE en franja carmesí + campana que suena → mensaje de apoyo tipeado → youtube.com/@canal. Fundido a negro. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "NODEPOLITICS", cta: "SUSCRÍBETE", support: "Apoya el canal y comparte el video.", handle: "youtube.com/@nodepolitics" },
    params: {
      ...K.hook.outroParams({ channel: "NODEPOLITICS", handle: "youtube.com/@nodepolitics", support: "Apoya el canal y comparte el video." }),
      country: { type: "string", default: "", doc: "País foco del fondo atlas (vacío = mundo)." },
      ...K.hook.bgParams(HK.PRESETS),
      dim: { type: "number", default: 0.5, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const st = ctx.stage, { W, H, u, portrait } = st, cx = W / 2, BG = HK.background(ctx, p);
      const name = IM.wordLayout(p.channel, W * (portrait ? 0.84 : 0.6), portrait ? H * 0.09 : H * 0.17);
      const thanksY = H * (portrait ? 0.17 : 0.12), nameY = H * (portrait ? 0.29 : 0.33);
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, apilada en 9:16) */
      const L = portrait ? { x: cx - u * 22, y: H * 0.48, w: u * 34, h: u * 13 } : { x: cx - u * 34, y: H * 0.6, w: u * 22, h: u * 9 };
      const B = portrait ? { x: cx + u * 4, y: H * 0.6, w: u * 64, h: u * 14 } : { x: cx + u * 14, y: H * 0.6, w: u * 40, h: u * 10 };
      const bellX = B.x + B.w / 2 + u * (portrait ? 7 : 5.5), bellS = u * (portrait ? 0.95 : 0.7);
      const [ax0, ay0, ax1, ay1, amx, amy] = portrait
        ? [L.x + L.w * 0.55, L.y + L.h * 0.1, B.x - B.w * 0.32, B.y - B.h * 0.6, L.x + L.w * 0.9, B.y - B.h * 0.2]
        : [L.x + L.w * 0.58, L.y, B.x - B.w / 2 - u * 2.2, B.y, (L.x + B.x) / 2 - u * 2, L.y - L.h * 1.1];
      const qpt = s => { const a = 1 - s; return [a * a * ax0 + 2 * a * s * amx + s * s * ax1, a * a * ay0 + 2 * a * s * amy + s * s * ay1]; };
      const cta = String(p.cta).toUpperCase(), ctaFs = Math.min(B.h * 0.56, B.w * 0.7 / Math.max(1, IM.measure(cta, IM.wordFont(100), 1) / 100));
      const sup = wrap(p.support, portrait ? 30 : 56), supFs = u * (portrait ? 3.3 : 2.4);
      const supY = portrait ? H * 0.71 : H * 0.77, handleY = supY + sup.length * supFs * 1.35 + u * (portrait ? 2.5 : 1.6);
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main, { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const fade = prog(lt, b.dur - 0.45, 0.45, "linear"); IM.fx.fade = Math.max(IM.fx.fade, fade); IM.fx.noCapBand = true;
          BG.render(lt, b, t);
          G.save(); G.fillStyle = "rgba(10,12,14,.38)"; G.fillRect(0, 0, W, H); G.restore();
          HK.scrim(G, st, 0.8);
          /* sol que sale detrás del nombre */
          const sq = prog(lt, 0.15, 1.1, "out"), R = u * (portrait ? 8 : 7.5), sy = lerp(H + R * 2, nameY - name.h * 0.15, sq);
          IM.rays(G, cx, sy, { n: 30, rot: lt * 0.06, dir: Math.PI / 2, focus: 0.1, len: Math.max(W, H) * 0.62, r0: R, grow: prog(lt, 0.45, 1, "out"), t: lt, alpha: 0.55, colors: IM.flagFor(p.country)?.rays });
          IM.sun(G, cx, sy, R, t, { alpha: clamp(sq * 2), flag: IM.flagFor(p.country) });
          HK.kicker(G, p.thanks, cx, thanksY, u * (portrait ? 2.5 : 1.9), prog(lt, 0.05, 0.35));
          IM.word(G, st, { layout: name, x: cx, y: nameY, at: 0.35 }, lt);
          /* LIKE: óvalo fino que se llena de carmesí al "presionarse" */
          const lq = prog(lt, likeAt, 0.35, "back");
          if (lq > 0) {
            const pressed = prog(lt, likeAt + 0.3, 0.16, "out"), bump = 1 + 0.08 * Math.sin(Math.PI * clamp((lt - likeAt - 0.3) / 0.25));
            G.save(); G.translate(L.x, L.y); G.scale(lq * bump, lq * bump); G.globalAlpha = clamp(lq * 2);
            G.beginPath(); G.roundRect(-L.w / 2, -L.h / 2, L.w, L.h, L.h / 2);
            G.fillStyle = `rgba(163,18,47,${0.95 * pressed})`; G.fill(); G.strokeStyle = WHITE; G.lineWidth = u * 0.28; G.stroke();
            const isz = L.h * 0.62; G.save(); G.translate(-L.w / 2 + L.h * 0.28, -isz / 2); G.scale(isz / 24, isz / 24); G.fillStyle = WHITE; G.fill(THUMB); G.restore();
            const fs = L.h * 0.42; G.font = `800 ${fs}px Montserrat`; G.letterSpacing = fs * 0.12 + "px"; G.fillStyle = WHITE; G.textAlign = "center"; G.textBaseline = "middle";
            G.fillText("LIKE", L.h * 0.38, fs * 0.04);
            G.restore();
          }
          /* flecha de línea fina que se dibuja */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.3, subAt - 0.2), aq = prog(lt, a0, Math.max(0.3, subAt + 0.1 - a0), "inOut");
            if (aq > 0) {
              G.save(); G.strokeStyle = WHITE; G.lineWidth = u * 0.3; G.lineCap = "round"; G.shadowColor = "rgba(8,10,12,.7)"; G.shadowBlur = u;
              G.setLineDash([u * 1.1, u * 0.9]); G.beginPath(); for (let i = 0; i <= 40 * aq; i++) { const [x, y] = qpt(i / 40); i ? G.lineTo(x, y) : G.moveTo(x, y); } G.stroke(); G.setLineDash([]);
              if (aq > 0.95) { const [x1, y1] = qpt(1), [x0, y0] = qpt(0.93), ang = Math.atan2(y1 - y0, x1 - x0), hl = u * 2.2;
                G.beginPath(); G.moveTo(x1 - Math.cos(ang - 0.5) * hl, y1 - Math.sin(ang - 0.5) * hl); G.lineTo(x1, y1); G.lineTo(x1 - Math.cos(ang + 0.5) * hl, y1 - Math.sin(ang + 0.5) * hl); G.stroke(); }
              G.restore();
            }
          }
          /* SUSCRÍBETE: franja carmesí con barrido */
          const sb = prog(lt, subAt, 0.32, "linear");
          if (sb > 0) {
            const e = ease.expoOut(sb), off = W * 0.6 * (1 - e);
            for (let k = sb < 1 ? 3 : 0; k >= 0; k--) {
              G.save(); G.globalAlpha = k ? 0.3 * (1 - e) / k : clamp(sb * 5); G.translate(B.x + off + k * u * 3 * (1 - e), B.y);
              G.fillStyle = CRIMSON; G.shadowColor = "rgba(0,0,0,.45)"; G.shadowBlur = u * 1.5; G.fillRect(-B.w / 2, -B.h / 2, B.w, B.h); G.shadowBlur = 0;
              G.fillStyle = "rgba(255,255,255,.85)"; G.fillRect(-B.w / 2, -B.h / 2, B.w, u * 0.25); G.fillRect(-B.w / 2, B.h / 2 - u * 0.25, B.w, u * 0.25);
              G.font = IM.wordFont(ctaFs); G.letterSpacing = ctaFs * 0.04 + "px"; G.fillStyle = WHITE; G.textAlign = "center"; G.textBaseline = "alphabetic";
              G.fillText(cta, 0, ctaFs * 0.36); G.restore();
            }
          }
          const bq = prog(lt, bellAt, 0.2, "out");
          if (bq > 0) { const d = lt - bellAt; G.save(); G.globalAlpha = bq; bell(G, bellX, B.y, bellS * (0.7 + 0.3 * bq), Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.45); G.restore(); }
          /* apoyo tipeado + dirección con barra carmesí */
          if (lt > supAt) {
            let n = Math.floor((Math.floor(lt * 24) / 24 - supAt) * 48);
            G.save(); G.font = `600 ${supFs}px Montserrat`; G.letterSpacing = supFs * 0.02 + "px"; G.fillStyle = "rgba(246,246,248,.92)"; G.textBaseline = "alphabetic"; G.textAlign = "left";
            G.shadowColor = "rgba(8,10,12,.9)"; G.shadowBlur = u;
            sup.forEach((s, i) => { const k = Math.min(s.length, n); n -= k; if (k > 0) { const full = IM.measure(s, G.font, supFs * 0.02); G.fillText(s.slice(0, k), cx - full / 2, supY + i * supFs * 1.35); } });
            const hq = prog(lt, supAt + 0.35, 0.5, "out");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 2.9 : 2), txt = String(p.handle); G.font = `800 ${hs}px Montserrat`; G.letterSpacing = hs * 0.08 + "px";
              const tw = IM.measure(txt, G.font, hs * 0.08), bw = hs * 1.4, x0 = cx - (tw + bw + hs * 0.6) / 2;
              G.globalAlpha = hq; G.fillStyle = CRIMSON; G.fillRect(x0, handleY - hs * 0.42, bw * hq, hs * 0.2);
              G.fillStyle = WHITE; G.fillText(txt.slice(0, Math.ceil(txt.length * hq)), x0 + bw + hs * 0.6, handleY);
            }
            G.restore();
          }
        },
      };
    },
  });
})();

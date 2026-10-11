/* =============================================================================
   pop · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: mosaico de marcas del canal que se desliza (o columnas, op-art,
   formas, kanji, foto en duotono o componente). Secuencia fija, sincronizable con
   la despedida narrada:
   GRACIAS POR VER (rótulo que se decodifica) → CANAL gigante: tira violeta con
   sierra y letras que caen APLASTADAS en rosa y se asientan en menta → botón LIKE
   menta con sombra dura que se PRESIONA (se hunde, se invierte, estalla en cruces)
   → flecha gruesa que crece parpadeando → SUSCRÍBETE en placa rosa que golpea +
   campana que suena → mensaje de apoyo en tira violeta → youtube.com/@canal.
   ========================================================================== */
(function () {
  const K = Kit, P0 = Kit.pop, HK = Kit.pop.hook, { clamp, lerp, prog, ease } = K;
  const TAU = Math.PI * 2;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");

  function wrap(s, max) {
    const out = [""];
    for (const w of String(s || "").split(/\s+/).filter(Boolean)) { const i = out.length - 1, nx = out[i] ? out[i] + " " + w : w; if (out[i] && nx.length > max) out.push(w); else out[i] = nx; }
    return out.filter(Boolean);
  }
  /** campana (x,y = centro) en tinta, s = escala */
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
  /** golpe de entrada: escala que cae + barrido */
  const slam = (lt, at, d = 0.18) => { const q = prog(lt, at, d, "linear"); return { q, s: 1 + 0.45 * (1 - ease.expoOut(q)) }; };

  K.register({
    name: "pop.outro", tags: ["cierre", "canal", "like", "suscribirse", "mosaico"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro, en lenguaje DUOTONO (bg: tiles | columns | opart | shapes | kanji | image con src | component con use/useParams; por defecto mosaico de marcas del canal que se desliza). GRACIAS POR VER que se decodifica → nombre del canal GIGANTE en tira violeta con letras que caen aplastadas en rosa y se asientan en menta → botón LIKE menta que se PRESIONA (se hunde en su sombra, se invierte y estalla en cruces) → flecha gruesa que crece parpadeando → placa rosa SUSCRÍBETE que golpea + campana que suena → apoyo en tira violeta → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "DUOTONO", cta: "SUSCRÍBETE", support: "Tu apoyo nos ayuda a seguir creando y traer más contenido.", handle: "youtube.com/@duotono" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte el video." }),
      ...K.hook.bgParams(["tiles", "columns", "opart", "shapes", "kanji"]),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene mucho texto)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage, S = Math.min(W, H), cx = W / 2, dpr = ctx.dpr;
      const name = String(p.channel).toUpperCase();
      const NST = portrait ? "normal" : "expanded", fs = Math.min(P0.fit(name, W * (portrait ? 0.84 : 0.7), 1e9, 900, NST, -0.03), H * (portrait ? 0.1 : 0.19));
      const fnt = P0.font(fs, 900, NST), gl = P0.glyphs(name, fnt, -fs * 0.03);
      const thanksY = H * (portrait ? 0.235 : 0.13), nameCY = H * (portrait ? 0.32 : 0.31);
      const nx0 = cx - gl.width / 2, nsh = fs * 1.12, nsk = fs * 0.16;
      /* letras pre-renderizadas (menta y rosa) */
      const letters = gl.list.map(g => ({ g, m: HK.wordCanvas(g.c, fs, P.light, dpr, NST), k: HK.wordCanvas(g.c, fs, P.accent, dpr, NST) }));
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, vertical en 9:16) */
      const L = portrait ? { x: cx, y: H * 0.46, w: u * 56, h: u * 16 } : { x: cx - u * (p.arrow ? 34 : 27), y: H * 0.585, w: u * 27, h: u * 10.5 };
      const B = portrait ? { x: cx - u * 7, y: H * 0.6, w: u * 72, h: u * 18 } : { x: cx + u * 16, y: H * 0.585, w: u * 42, h: u * 12 };
      const bellX = B.x + B.w / 2 + u * (portrait ? 9.5 : 7.5), bellR = u * (portrait ? 7 : 4.8);
      const cta = String(p.cta).toUpperCase(), ctaFs = Math.min(P0.fit(cta, B.w * 0.78, 1e9, 900, "expanded", -0.02), B.h * 0.5);
      const sup = wrap(p.support, portrait ? 26 : 54), supFs = u * (portrait ? 3.3 : 2.0);
      const supY = portrait ? H * 0.72 : H * 0.765, handleY = supY + sup.length * supFs * 1.9 + u * (portrait ? 3.6 : 2.6);
      const BG = HK.hookBg(ctx, p, "tiles");
      const press = (lt, at) => prog(lt, at, 0.1, "out");
      return {
        dispose() { BG.dispose(); },
        render(lt, b, t) {
          const G = ctx.g.main;
          const { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = 1 - prog(lt, b.dur - 0.4, 0.4, "in");
          G.save(); G.globalAlpha = exit;
          /* fondo + velo violeta central para que respire el texto */
          BG.render(lt, b, t);
          if (BG.mode !== "image" && BG.mode !== "component" && BG.mode !== "none") {
            const vg = G.createRadialGradient(cx, H * 0.5, S * 0.1, cx, H * 0.5, Math.max(W, H) * 0.75);
            vg.addColorStop(0, P0.rgba(P.ink, 0.55)); vg.addColorStop(1, P0.rgba(P.ink, 0.25));
            G.fillStyle = vg; G.fillRect(0, 0, W, H);
          }
          /* GRACIAS POR VER */
          HK.tag(G, HK.decode(String(p.thanks).toUpperCase(), lt - 0.12, 24, 4), cx, thanksY, u * (portrait ? 2.6 : 1.6), P.light, P.ink, prog(lt, 0.08, 0.14, "linear"));
          /* canal: tira violeta con sierra, sombra rayada y letras que caen aplastadas */
          const sq = prog(lt, 0.28, 0.16, "linear");
          if (sq > 0) {
            const sx0 = nx0 - fs * 0.45, sw = gl.width + fs * 0.9, sy0 = nameCY - nsh / 2;
            G.save(); HK.wipeClip(G, sx0 - nsk * 2, sy0, sw + nsk * 4, nsh, sq, fs * 0.08);
            HK.hatchShadow(G, sx0, sy0, sw, nsh, nsk, fs * 0.12, P.ink);
            G.fillStyle = P.ink; HK.para(G, sx0, sy0, sw, nsh, nsk); G.fill(); G.restore();
          }
          letters.forEach(({ g, m, k }, i) => {
            const t0 = 0.36 + i * 0.045, d = lt - t0; if (d < 0) return;
            const f = HK.fr(d), lcx = nx0 + g.x + g.w / 2, x = nx0 + g.x - m.pad, y = nameCY + fs * 0.36 - m.base;
            G.save();
            if (f < 2) { G.translate(lcx, nameCY - fs * 0.3); G.scale(1.3, 0.35); G.translate(-lcx, -nameCY); G.drawImage(k.c, x, y, m.cw, m.ch); }
            else {
              const s = 1 + 0.08 * Math.exp(-(d - 0.07) * 14), flick = [11, 12].includes(HK.fr(lt - 1.2)) && i === Math.floor(letters.length / 2);
              G.translate(lcx, nameCY); G.scale(s, s); G.translate(-lcx, -nameCY); G.drawImage((flick ? k : m).c, x, y, m.cw, m.ch);
            }
            G.restore();
          });
          /* LIKE: botón menta con sombra dura que se presiona */
          const lk = slam(lt, likeAt);
          if (lk.q > 0) {
            const pr = press(lt, likeAt + 0.3), off = u * 0.9 * (1 - pr), sh = u * 0.9;
            G.save(); G.translate(L.x, L.y); G.scale(lk.s, lk.s); G.rotate(-0.025);
            HK.wipeClip(G, -L.w / 2 - u * 2, -L.h, L.w + u * 4, L.h * 2.2, lk.q, u * 0.6);
            G.fillStyle = P.ink; HK.para(G, -L.w / 2 + sh, -L.h / 2 + sh, L.w, L.h, L.h * 0.14); G.fill();
            G.translate(sh - off, sh - off);
            G.fillStyle = pr > 0.5 ? P.ink : P.light; HK.para(G, -L.w / 2, -L.h / 2, L.w, L.h, L.h * 0.14); G.fill();
            G.strokeStyle = pr > 0.5 ? P.light : P.ink; G.lineWidth = Math.max(1.5, u * 0.35); G.stroke();
            const isz = L.h * 0.62, fg = pr > 0.5 ? P.light : P.ink;
            G.save(); G.translate(-L.w / 2 + L.h * 0.28, -isz / 2 - isz * 0.04); G.scale(isz / 24, isz / 24); G.fillStyle = fg; G.fill(THUMB);
            if (pr <= 0.5) { G.fillStyle = P.light; G.translate(2.6, 2.6); G.scale(0.78, 0.78); G.translate(0.6, 0.6); G.fill(THUMB); }
            G.restore();
            P0.text(G, "LIKE", L.h * 0.42, L.h * 0.2, { font: P0.font(L.h * 0.46, 900), color: fg, align: "center", sp: L.h * 0.01 });
            G.restore();
            /* estallido de cruces y rayos al presionar */
            const bq = prog(lt, likeAt + 0.3, 0.45, "out");
            if (bq > 0 && bq < 1) {
              G.save(); G.globalAlpha *= 1 - bq;
              for (let i = 0; i < 8; i++) {
                const a = i / 8 * TAU + 0.3, r0 = L.w * 0.55 + bq * u * 6, r1 = r0 + u * 2.5;
                G.strokeStyle = i % 2 ? P.accent : P.light; G.lineWidth = u * 0.6;
                G.beginPath(); G.moveTo(L.x + Math.cos(a) * r0, L.y + Math.sin(a) * r0 * 0.6); G.lineTo(L.x + Math.cos(a) * r1, L.y + Math.sin(a) * r1 * 0.6); G.stroke();
              }
              G.restore();
            }
          }
          /* flecha gruesa que crece parpadeando de LIKE a SUSCRÍBETE */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.25, subAt - 0.2), aq = prog(lt, a0, Math.max(0.25, subAt - a0), "out");
            if (aq > 0) {
              const kf = HK.fr(lt - a0), seq = [P.ink, P.accent, null, P.muted, P.accent], col = kf < seq.length ? seq[kf] : P.light;
              if (col) {
                G.save();
                if (portrait) {
                  const y0 = L.y + L.h / 2 + u * 2.5, y1 = B.y - B.h / 2 - u * 2.2, ah = u * 7;
                  G.translate(cx - u * 2, y0); G.rotate(Math.PI / 2); G.beginPath(); G.rect(0, -ah, (y1 - y0) * aq, ah * 2); G.clip();
                  P0.arrow(G, 0, -ah / 2, y1 - y0, ah, col, 0.3);
                } else {
                  const x0 = L.x + L.w / 2 + u * 2.6, x1 = B.x - B.w / 2 - u * 1.6, ah = u * 5;
                  G.beginPath(); G.rect(x0, L.y - ah, (x1 - x0) * aq, ah * 2); G.clip();
                  P0.arrow(G, x0, L.y - ah / 2, x1 - x0, ah, col, 0.3);
                }
                G.restore();
              }
            }
          }
          /* SUSCRÍBETE: placa rosa que golpea con sacudida */
          const sb = slam(lt, subAt);
          if (sb.q > 0) {
            const [jx, jy] = HK.shake(lt, [subAt + 0.12], u * 0.6), kf = HK.fr(lt - subAt), sh = u * 1.1;
            const fill = kf < 2 ? P.light : kf < 3 ? P.ink : P.accent;
            G.save(); G.translate(B.x + jx, B.y + jy); G.scale(sb.s, sb.s); G.rotate(0.015);
            HK.wipeClip(G, -B.w / 2 - u * 2, -B.h, B.w + u * 4, B.h * 2.2, sb.q, u * 0.7);
            G.fillStyle = P.ink; HK.para(G, -B.w / 2 + sh, -B.h / 2 + sh, B.w, B.h, B.h * 0.14); G.fill();
            G.fillStyle = fill; HK.para(G, -B.w / 2, -B.h / 2, B.w, B.h, B.h * 0.14); G.fill();
            G.save(); HK.para(G, -B.w / 2, -B.h / 2, B.w, B.h, B.h * 0.14); G.clip();
            P0.hatch(G, B.w / 2 - B.h * 0.55, -B.h / 2, B.h * 0.7, B.h, { gap: B.h * 0.16, bw: B.h * 0.06, ang: -45, color: P.ink }); G.restore();
            P0.text(G, cta, -B.h * 0.18, ctaFs * 0.36, { font: P0.font(ctaFs, 900), color: P.ink, align: "center", sp: -ctaFs * 0.02 });
            G.restore();
          }
          /* campana en insignia menta: aparece y suena */
          const bq = prog(lt, bellAt, 0.18, "out");
          if (bq > 0) {
            const d = lt - bellAt, rot = Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.5, r = bellR * (0.6 + 0.4 * ease.back(clamp(d / 0.2)));
            G.save(); G.globalAlpha *= bq;
            G.fillStyle = P.ink; G.beginPath(); G.arc(bellX + u * 0.6, B.y + u * 0.6, r, 0, TAU); G.fill();
            G.fillStyle = P.light; G.beginPath(); G.arc(bellX, B.y, r, 0, TAU); G.fill();
            G.strokeStyle = P.ink; G.lineWidth = Math.max(1.5, u * 0.3); G.stroke();
            bell(G, bellX, B.y + r * 0.05, r * 0.11, rot, P.ink);
            const ra = clamp(1 - d / 1.4);
            if (ra > 0) {
              G.strokeStyle = P0.rgba(P.light, ra); G.lineWidth = u * 0.5; G.lineCap = "butt";
              for (const s of [-1, 1]) for (const k of [1.25, 1.55]) { G.beginPath(); G.arc(bellX, B.y, r * k, s < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, s < 0 ? Math.PI * 1.2 : Math.PI * 0.2); G.stroke(); }
            }
            G.restore();
          }
          /* apoyo: tira violeta con letras que aparecen en cascada */
          if (lt > supAt) {
            const f = P0.MONT(supFs, 600), sp = supFs * 0.14;
            sup.forEach((s, i) => {
              const y = supY + i * supFs * 1.9, gl2 = P0.glyphs(s, f, sp), pw = gl2.width + supFs * 2.2, q = prog(lt, supAt + i * 0.08, 0.14, "linear");
              if (q <= 0) return;
              G.save(); HK.wipeClip(G, cx - pw / 2 - supFs, y - supFs, pw + supFs * 2, supFs * 2, q, supFs * 0.3);
              G.fillStyle = P.ink; HK.para(G, cx - pw / 2, y - supFs * 0.92, pw, supFs * 1.84, supFs * 0.3); G.fill(); G.restore();
              const x0 = cx - gl2.width / 2;
              gl2.list.forEach((g, j) => { const a = prog(lt, supAt + 0.1 + i * 0.25 + j * 0.012, 0.18, "linear"); if (a > 0) P0.text(G, g.c, x0 + g.x, y + supFs * 0.36, { font: f, color: P.light, alpha: a }); });
            });
            /* dirección del canal: placa menta que se decodifica + subrayado rosa */
            const hq = prog(lt, supAt + 0.35, 0.14, "linear");
            if (p.handle && hq > 0) {
              const hs = u * (portrait ? 2.5 : 1.6), w = HK.tag(G, HK.decode(String(p.handle), lt - supAt - 0.4, 40, 6), cx, handleY, hs, P.light, P.ink, hq);
              G.fillStyle = P.accent; G.fillRect(cx - w / 2 + hs * 0.6, handleY + hs * 1.35, (w - hs * 1.2) * prog(lt, supAt + 0.6, 0.4, "out"), Math.max(2, hs * 0.18));
            }
          }
          G.restore();
        },
      };
    },
  });
})();

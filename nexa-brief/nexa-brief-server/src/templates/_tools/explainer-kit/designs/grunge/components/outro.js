/* =============================================================================
   grunge · cierre del canal (lo agrega el motor al final del audio)
   Sin recuadro: fondo de cartelera de afiches que se pegan (o pared a rodillo,
   película, salpicaduras, foto en duotono o componente). Secuencia fija:
   GRACIAS POR VER → CANAL gigante (se pulveriza en motas, golpea en negativo,
   se reacomoda rasgado y un rodillo lo pinta detrás) → placa LIKE (al marcarse
   se vuelve menta, el pulgar se rellena y un aro a pincel la encierra) → flecha
   a pincel → brochazo SUSCRÍBETE + campana que suena → apoyo palabra por
   palabra → youtube.com/@canal tipeado. Tiempos: Kit.hook.outroTimes.
   ========================================================================== */
(function () {
  const K = Kit, GR = Kit.grunge, Hk = Kit.grunge.hook, { clamp } = K;
  const { CREAM, DK, rgba, fr24, slab, stroke, label, labelW, shake } = Hk;
  const MINT = GR.COLORS.mint.c, CORAL = GR.COLORS.coral.c;
  const THUMB = new Path2D("M9.2 10.2V6.8c0-.65.35-1.26.92-1.58.57-.32 1.28-.27 1.8.12l1.66 1.27c.42.32.67.82.67 1.35v2.24h3.25c1.02 0 1.79.96 1.56 1.96l-1.1 4.76c-.2.86-.97 1.47-1.85 1.47H9.2v-6.19ZM5.4 10.2h2v8.19h-2z");
  const up = s => String(s || "").toUpperCase();

  /** campana plana (x,y = centro), s = escala, rot = oscilación */
  function bell(G, x, y, s, rot, color) {
    G.save(); G.translate(x, y - s * 4.5); G.rotate(rot); G.translate(0, s * 4.5); G.fillStyle = color;
    G.beginPath(); G.moveTo(0, -s * 4.5);
    G.bezierCurveTo(-s * 2.6, -s * 4.5, -s * 3.5, -s * 2.4, -s * 3.5, -s * 0.2); G.lineTo(-s * 3.5, s * 2.4); G.lineTo(-s * 4.7, s * 3.7);
    G.lineTo(s * 4.7, s * 3.7); G.lineTo(s * 3.5, s * 2.4); G.lineTo(s * 3.5, -s * 0.2);
    G.bezierCurveTo(s * 3.5, -s * 2.4, s * 2.6, -s * 4.5, 0, -s * 4.5); G.fill();
    G.beginPath(); G.arc(0, s * 4.5, s * 1.15, 0, Math.PI); G.fill();
    G.beginPath(); G.arc(0, -s * 4.9, s * 0.7, 0, 7); G.fill();
    G.restore();
  }
  const quad = (x0, y0, mx, my, x1, y1, n = 24) => Array.from({ length: n + 1 }, (_, k) => { const s = k / n, a = 1 - s; return [a * a * x0 + 2 * a * s * mx + s * s * x1, a * a * y0 + 2 * a * s * my + s * s * y1]; });
  const ring = (cx, cy, rx, ry, seed) => { const r = K.rng(seed), pts = []; for (let k = 0; k <= 30; k++) { const a = -2.4 + k / 30 * 6.9, j = 1 + (r() - 0.5) * 0.06; pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); } return pts; };

  K.register({
    name: "grunge.outro", tags: ["cierre", "canal", "like", "suscribirse"], layer: "main", post: 0,
    summary: "Cierre del canal SIN recuadro (bg: posters | roller | film | splatter | image con src en duotono | component con use/useParams). Por defecto una cartelera de afiches de colores que se pegan en stop-motion. GRACIAS POR VER → nombre del canal GIGANTE que se pulveriza en motas, golpea en negativo, se reacomoda rasgado y un rodillo de color lo pinta detrás → placa LIKE que se marca (se vuelve menta, pulgar relleno, aro a pincel, salpicaduras) → flecha a pincel → brochazo coral SUSCRÍBETE (con negativo) + campana que suena → apoyo palabra por palabra → youtube.com/@canal. Tiempos sincronizables con la despedida narrada (likeAt, subscribeAt, bellAt, supportAt).",
    example: { thanks: "GRACIAS POR VER", channel: "NODETECH", cta: "SUSCRÍBETE", support: "Apoya el canal y comparte el video.", handle: "youtube.com/@nodetech" },
    params: {
      ...K.hook.outroParams({ support: "Apoya el canal y comparte el video." }),
      color: { type: "string", default: "mustard", doc: "Color del rodillo detrás del canal y del handle: mustard | mint | coral | petrol | pink | #hex." },
      ...K.hook.bgParams(Hk.PRESETS),
      dim: { type: "number", default: 0.66, min: 0, max: 1, doc: "Oscurecido del fondo foto/componente (el cierre tiene mucho texto)." },
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const { W, H, u, portrait } = ctx.stage, cx = W / 2, sc = Hk.scene(p, "mustard"), name = up(p.channel);
      const nfs = Math.min(GR.fitFs([name], W * (portrait ? 0.84 : 0.62)), H * (portrait ? 0.1 : 0.19) / GR.CAP);
      const NL = GR.layout({ lines: [name], fs: nfs, align: "center", x: cx, cy: H * (portrait ? 0.32 : 0.32) });
      const tFs = u * (portrait ? 2.4 : 1.8), tY = NL.top - nfs * 0.16 - u * (portrait ? 4.2 : 3.4), tStr = up(p.thanks), tW = labelW(tStr, tFs, 0.32);
      /* fila LIKE → SUSCRÍBETE (horizontal en 16:9, en escalera en 9:16) */
      const L = portrait ? { x: cx, y: H * 0.46, w: u * 50, h: u * 15 } : { x: cx - u * (p.arrow ? 31 : 25), y: H * 0.585, w: u * 23, h: u * 9.5 };
      const B = portrait ? { x: cx - u * 5, y: H * 0.6, w: u * 74, h: u * 16 } : { x: cx + u * 13, y: H * 0.585, w: u * 40, h: u * 11 };
      const likeL = GR.layout({ lines: ["LIKE"], fs: L.h * 0.62, align: "left", x: L.x - L.w / 2 + L.h * 1.0, cy: L.y });
      const cta = up(p.cta), ctaFs = Math.min(GR.fitFs([cta], B.w * 0.8), B.h * 0.5 / GR.CAP), CL = GR.layout({ lines: [cta], fs: ctaFs, align: "center", x: B.x, cy: B.y });
      const bellX = B.x + B.w / 2 + u * (portrait ? 8 : 6), bellS = u * (portrait ? 0.95 : 0.66);
      const arrowPts = portrait
        ? quad(L.x - L.w * 0.3, L.y + L.h / 2 + u * 2, L.x - L.w * 0.62, (L.y + B.y) / 2 + u * 2, B.x - B.w * 0.36, B.y - B.h / 2 - u * 1.8)
        : quad(L.x + L.w / 2 + u * 1.6, L.y - L.h * 0.25, (L.x + B.x) / 2 - u * 2, L.y - L.h * 1.35, B.x - B.w / 2 - u * 2.2, B.y - B.h * 0.2);
      const likeRing = ring(L.x, L.y, L.w * 0.64, L.h * 0.92, 71);
      const sup = Hk.wrap(up(p.support), portrait ? 22 : 46), supFs = u * (portrait ? 3.7 : 2.6);
      const supY = portrait ? H * 0.72 : H * 0.775, handleY = supY + (sup.length - 0.4) * supFs * 1.35 + u * (portrait ? 4 : 3);
      const hFs = u * (portrait ? 3 : 2.1), hStr = String(p.handle || ""), hW = labelW(hStr, hFs, 0.14);
      const rnd = K.rng(613);
      const nameSpl = [[-1, -0.2], [1, 0.9], [1, -0.5], [-1, 1.1]].map(([sx, sy], i) => ({ x: (sx < 0 ? NL.left - nfs * (0.35 + rnd() * 0.3) : NL.right + nfs * (0.35 + rnd() * 0.3)), y: NL.top + NL.ch * sy, r: u * (1 + rnd() * 1.5), seed: Math.floor(rnd() * 1e9), at: (i % 2) * 0.042 }));
      const pressSpl = [0, 1, 2].map(i => ({ x: L.x + (i - 1) * L.w * 0.55 + (rnd() - 0.5) * u * 3, y: L.y + (i === 1 ? -L.h * 0.85 : L.h * 0.55), r: u * (0.9 + rnd() * 1.2), seed: Math.floor(rnd() * 1e9), at: 0 }));
      const bellSpl = [0, 1].map(i => ({ x: bellX + (i ? 1 : -1) * u * 5.5, y: B.y - u * (2 + rnd() * 3), r: u * (0.6 + rnd()), seed: Math.floor(rnd() * 1e9), at: 0 }));
      const LC = { fill: CREAM, tex: [{ tex: GR.S.tex.scratch, color: GR.mix(CREAM, DK, 0.5), alpha: 0.4 }] };
      const LD = { fill: DK, tex: [{ tex: GR.S.tex.scratch, color: sc.T, alpha: 0.35 }] };
      const BG = Hk.bg(ctx, p, sc, "posters");
      const at = (defs, t0) => defs.map(d => ({ ...d, at: d.at + t0 }));
      return {
        dispose() { BG.dispose(); },
        render(lt, b) {
          const G = ctx.g.main, { likeAt, subAt, bellAt, supAt } = K.hook.outroTimes(p, b.dur);
          const exit = K.prog(lt, b.dur - 0.4, 0.4, "in"), live = exit <= 0;
          GR.current(ctx, sc);
          BG.render(lt, b);
          if (BG.mode === "image" || BG.mode === "component") GR.grime(ctx, CREAM, 0.3, lt);
          else if (BG.mode !== "none") { G.fillStyle = rgba(DK, 0.42); G.fillRect(0, 0, W, H); }
          /* franjas negras de rodillo detrás de cada bloque de texto (legibilidad) */
          GR.band(ctx, { y0: tY - u * 3, y1: NL.bottom + nfs * 0.35, color: DK, alpha: 0.82, wipe: clamp((fr24(lt) + 1) / 4), v: 1, dx: -W * 0.1, sx: 1.2 });
          if (lt >= likeAt - 0.1) GR.band(ctx, { y0: Math.min(L.y - L.h, B.y - B.h) - u * 2, y1: Math.max(L.y + L.h, B.y + B.h) + u * 2, color: DK, alpha: 0.78, wipe: clamp((fr24(lt - likeAt + 0.1) + 1) / 4), v: 0, sx: 1.25, dx: -W * 0.12 });
          if (lt >= supAt - 0.1) GR.band(ctx, { y0: supY - supFs * 1.6, y1: handleY + hFs * 1.8, color: DK, alpha: 0.8, wipe: clamp((fr24(lt - supAt + 0.1) + 1) / 4), v: 1, sx: 1.2, dx: -W * 0.1 });

          /* GRACIAS POR VER (se enciende parpadeando) */
          if (lt >= 0.08 && fr24(lt - 0.08) !== 2) {
            label(G, tStr, cx + tFs * 0.16, tY, tFs, CREAM, "center", 0.32);
            G.fillStyle = sc.S; for (const d of [-1, 1]) G.fillRect(cx + d * (tW / 2 + tFs * 1.2) - (d < 0 ? tFs * 3 : 0), tY - tFs * 0.12, tFs * 3, tFs * 0.26);
          }
          /* canal: motas → negativo → rasgado que se reacomoda → rodillo de color detrás */
          const n0 = 0.25, bandAt = n0 + 0.75;
          if (lt >= n0) {
            const f = fr24(lt - n0), bf = fr24(lt - bandAt), painted = lt >= bandAt;
            if (painted) { GR.splats(ctx, at(nameSpl, bandAt), lt, sc.S); slab(G, NL.left - nfs * 0.2, NL.top - nfs * 0.15, NL.right - NL.left + nfs * 0.4, NL.ch + nfs * 0.3, sc.S, 6161, clamp((bf + 1) / 4)); }
            const look = f < 6 ? { fill: { tex: GR.S.tex.speck[Math.min(2, f >> 1)], color: CREAM, sc: 1.3, ox: -W * 0.3 } } : painted && bf >= 2 ? LD : LC;
            const qn = clamp((f - 6) / 6), amt = f >= 6 && f < 12 ? W * 0.05 * Math.pow(1 - qn, 1.5) : 0;
            GR.ink(ctx, { L: NL, ...look, holes: f < 6 ? null : { alpha: 0.7, ox: -W * 0.05 } });
            const r = K.rng(GR.boilFrame(lt) * 31 + 61), [sx, sy] = shake(lt, [n0 + 0.25, bandAt], u * 0.6);
            GR.put(ctx, { dx: (r() - 0.5) * u * 0.22 + sx, dy: (r() - 0.5) * u * 0.22 + sy, slices: amt > 0.5 ? GR.tear(NL, amt) : null });
            if (live && f >= 6 && f < 9) GR.fx(ctx, { neg: true });
          }
          /* LIKE: cae en 2 cuadros; al marcarse pasa a menta, pulgar relleno, aro a pincel */
          if (lt >= likeAt) {
            const f = fr24(lt - likeAt), pressAt = likeAt + 0.3, pressed = lt >= pressAt, pf = fr24(lt - pressAt);
            const k = pressed && pf < 2 ? 0.9 : 1, w = L.w * k, h = L.h * k, dy = f === 0 ? -u * 2.5 : f === 1 ? -u * 0.6 : 0;
            if (pressed) GR.splats(ctx, at(pressSpl, pressAt), lt, MINT);
            slab(G, L.x - w / 2, L.y - h / 2 + dy, w, h, pressed ? MINT : CREAM, 515, f === 0 ? 0.65 : 1);
            const isz = h * 0.66;
            G.save(); G.translate(L.x - w / 2 + h * 0.2, L.y + dy - isz / 2); G.scale(isz / 24, isz / 24);
            G.fillStyle = DK; G.fill(THUMB); if (!pressed) { G.fillStyle = CREAM; G.translate(2.6, 2.6); G.scale(0.82, 0.82); G.fill(THUMB); }
            G.restore();
            GR.ink(ctx, { L: likeL, fill: DK, holes: { alpha: 0.3 } }); GR.put(ctx, { dy });
            if (pressed) stroke(G, likeRing, clamp(pf / 8), u * (portrait ? 1 : 0.75), CREAM, 72, 0.95);
          }
          /* flecha a pincel */
          if (p.arrow) {
            const a0 = Math.min(likeAt + 0.35, subAt - 0.15), ad = Math.max(0.25, subAt + 0.1 - a0), q = clamp(Math.floor((lt - a0) * 24) / (ad * 24));
            if (q > 0) {
              stroke(G, arrowPts, q, u * (portrait ? 0.9 : 0.7), CREAM, 73);
              if (q >= 1) {
                const [x1, y1] = arrowPts[arrowPts.length - 1], [xa, ya] = arrowPts[arrowPts.length - 3], ang = Math.atan2(y1 - ya, x1 - xa), hl = u * (portrait ? 3.4 : 2.6);
                for (const d of [-0.55, 0.55]) stroke(G, [[x1, y1], [x1 - Math.cos(ang + d) * hl, y1 - Math.sin(ang + d) * hl]], 1, u * (portrait ? 0.9 : 0.7), CREAM, 74);
              }
            }
          }
          /* SUSCRÍBETE: brochazo coral en 3 cuadros, texto rasgado que se reacomoda, negativo */
          if (lt >= subAt) {
            const f = fr24(lt - subAt), [sx, sy] = shake(lt, [subAt + 0.05], u * 0.7);
            slab(G, B.x - B.w / 2 + sx, B.y - B.h / 2 + sy, B.w, B.h, CORAL, 727, clamp((f + 1) / 3));
            if (f >= 1) {
              const qn = clamp((f - 1) / 6), amt = W * 0.05 * Math.pow(1 - qn, 1.5);
              GR.ink(ctx, { L: CL, fill: CREAM, tex: [{ tex: GR.S.tex.scratch, color: GR.mix(CORAL, DK, 0.4), alpha: 0.3 }], holes: { alpha: 0.45, ox: -W * 0.15 } });
              GR.put(ctx, { dx: sx, dy: sy, slices: amt > 0.5 ? GR.tear(CL, amt) : null });
            }
            if (live && f >= 1 && f < 4) GR.fx(ctx, { neg: true });
          }
          /* campana: cae y suena (oscilación amortiguada en stop-motion) + ondas a pincel */
          if (lt >= bellAt) {
            const d = Math.floor((lt - bellAt) * 24) / 24, rot = Math.sin(d * 16) * Math.exp(-d * 2.6) * 0.5;
            GR.splats(ctx, at(bellSpl, bellAt), lt, CORAL);
            bell(G, bellX, B.y + (d < 0.042 ? -u * 2 : 0), bellS, rot, CREAM);
            const rq = clamp(1 - d / 1.4);
            if (rq > 0) for (const s of [-1, 1]) {
              const rr = bellS * (6.4 + (1 - rq) * 1.6), pts = [];
              for (let k = 0; k <= 8; k++) { const a = (s < 0 ? Math.PI : 0) + s * (-0.45 + k / 8 * 0.9); pts.push([bellX + Math.cos(a) * rr, B.y - bellS * 0.6 + Math.sin(a) * rr]); }
              stroke(G, pts, 1, bellS * 0.55, CREAM, 80 + s, rq * 0.9);
            }
          }
          /* apoyo: palabra por palabra (cortes de 3 cuadros) + dirección tipeada */
          if (lt >= supAt) {
            let n = 1 + Math.floor((lt - supAt) / 0.125);
            sup.forEach((s, i) => {
              const ws = s.split(" "), k = Math.min(ws.length, n); n -= k; if (k <= 0) return;
              const fw = labelW(s, supFs, 0.06);
              label(G, ws.slice(0, k).join(" "), cx - fw / 2, supY + i * supFs * 1.35, supFs, CREAM, "left", 0.06);
            });
            const hq = clamp((lt - supAt - 0.35) / 0.5);
            if (hStr && hq > 0) {
              const txt = hStr.slice(0, Math.ceil(hStr.length * Math.floor(hq * 12) / 12));
              label(G, txt, cx - hW / 2, handleY, hFs, sc.S, "left", 0.14);
              G.fillStyle = sc.S; G.fillRect(cx - hW / 2, handleY + hFs * 0.85, hW * hq, Math.max(1, u * 0.3));
            }
          }
          /* fundido final */
          if (exit > 0) { G.fillStyle = rgba(DK, exit); G.fillRect(0, 0, W, H); }
        },
      };
    },
  });
})();

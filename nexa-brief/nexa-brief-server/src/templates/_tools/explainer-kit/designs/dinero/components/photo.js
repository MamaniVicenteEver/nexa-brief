/* =============================================================================
   dinero · planos de foto: ráfaga de billetes (ref. 1,1–2,0 s) y mano contando
   billetes en teal con texto que se decodifica (ref. 3,2–3,7 s).
   ========================================================================== */
(function () {
  const K = Kit, D = Kit.dinero, { clamp, lerp, prog } = K;

  /* ------------------------------------------------------------------ ráfaga de billetes */
  K.register({
    name: "dinero.cash", tags: ["foto", "dinero", "ráfaga", "billetes"], layer: "main",
    summary: "Ráfaga de fotos de billetes en teal frío (ref. 1,1 s): la 1ª entra desenfocada y oscura y se enfoca, cortes rápidos a la 2ª girada y re-encuadrada, un cuadro oscuro con líneas de barrido y la última queda con empuje lento. Para el momento en que aparece el dinero (cifras, presupuesto, pago).",
    example: { src1: "../designs/dinero/samples/billete100.jpg", src2: "../designs/dinero/samples/abanico.jpg", src3: "../designs/dinero/samples/dolar1957.jpg" },
    params: {
      src1: { type: "image", required: true, doc: "Primera foto (entra desenfocada)." },
      src2: { type: "image", default: "", doc: "Segunda foto (girada; vacío = src1)." },
      src3: { type: "image", default: "", doc: "Foto final que queda (vacío = src2 o src1)." },
      pace: { type: "number", default: 1, min: 0.5, max: 3, doc: "Multiplica la duración de los cortes (1 = ritmo de la referencia: 0,63 s de ráfaga)." },
      ...D.FOCUS, ...D.FX("whip"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, c1 = D.tint(ctx, p.src1, "cash"), c2 = p.src2 ? D.tint(ctx, p.src2, "cash") : c1, c3 = p.src3 ? D.tint(ctx, p.src3, "cash") : c2;
      const g3 = D.tint(ctx, p.src3 || p.src2 || p.src1, "dark"), k = p.pace, fo = p.focus || [0.5, 0.5];
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, { W, H, u } = ctx.stage, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G);
          D.solid(G, W, H, P.black);
          const a = 0.27 * k, bq = 0.47 * k, c = 0.57 * k, g = 0.63 * k;
          if (lt < a) {
            const blur = lt < 0.1 * k ? lerp(14, 0, prog(lt, 0, 0.1 * k, "out")) : lt > 0.2 * k ? 6 * Math.sin(prog(lt, 0.2 * k, 0.07 * k, "linear") * Math.PI) : 0;
            D.cover(G, c1, 0, 0, W, H, { zoom: lerp(1.32, 1.12, prog(lt, 0, a, "out")), fx: fo[0], fy: fo[1], blur: blur * u * 0.12, dy: lt > 0.2 * k ? -u * 4 * prog(lt, 0.2 * k, 0.07 * k) : 0 });
            G.save(); G.fillStyle = D.rgba(P.black, 0.35 * (1 - prog(lt, 0, 0.12 * k))); G.fillRect(0, 0, W, H); G.restore();
            D.vignette(G, W, H, 0.75, P.black, 0.3);
          } else if (lt < bq) {
            D.cover(G, c2, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2, { zoom: 1.22, rot: lerp(-0.13, -0.06, prog(lt, a, bq - a, "out")), dx: -u * 6 * prog(lt, a, bq - a, "linear"), fx: fo[0], fy: fo[1] });
            D.vignette(G, W, H, 0.45, P.black, 0.4);
          } else if (lt < c) {
            D.cover(G, c2, -W * 0.1, -H * 0.1, W * 1.2, H * 1.2, { zoom: 1.45, rot: 0.2, dx: u * 4 * prog(lt, bq, c - bq, "linear"), fx: 1 - fo[0], fy: fo[1] });
            D.vignette(G, W, H, 0.5, P.black, 0.4);
          } else if (lt < g) {
            D.cover(G, g3, 0, 0, W, H, { zoom: 1.3, fx: fo[0], fy: fo[1] });
            D.scanFrame(G, W, H, u, P, D.frameOf(lt));
          } else {
            const q = lt - g;
            D.cover(G, c3, 0, 0, W, H, { zoom: 1.16 + q * 0.025, dx: -u * q * 0.6, fx: fo[0], fy: fo[1] });
            D.vignette(G, W, H, 0.4, P.black, 0.45);
          }
          T.end(G);
        },
      };
    },
  });

  /* ------------------------------------------------------------------ mano contando + texto que se decodifica */
  K.register({
    name: "dinero.count", tags: ["foto", "texto", "decodificar", "dinero"], layer: "main",
    summary: "Foto en teal frío con empuje y paneo lentos y luz cálida en la esquina (ref. 3,2 s, mano contando billetes); encima, un rótulo FINO en mayúsculas y una línea en minúsculas que se DECODIFICAN letra por letra con una raya fina a la izquierda. Para nombrar una cifra, un trámite o una pregunta sobre la foto.",
    example: { src: "../designs/dinero/samples/abanico.jpg", text: "13.500 DÓLARES", sub: "pidieron" },
    params: {
      src: { type: "image", required: true, doc: "Foto de fondo." },
      text: { type: "string", required: true, doc: "Rótulo principal (MAYÚSCULAS finas, ≤ 18 caracteres)." },
      sub: { type: "string", default: "", doc: "Segunda línea en minúsculas (≤ 22 caracteres)." },
      cps: { type: "number", default: 12, min: 3, doc: "Letras por segundo que se resuelven." },
      ...D.FOCUS, ...D.FX("whip"),
    },
    create(ctx, p) {
      const P = ctx.C.palette, cv = D.tint(ctx, p.src, "cash"), fo = p.focus || [0.5, 0.5];
      const { W, H, u, portrait } = ctx.stage, txt = String(p.text).toUpperCase();
      const fs = Math.min(D.fit(txt, W * (portrait ? 0.84 : 0.6), 1e9, s => D.THIN(s, 300), 0.04), u * (portrait ? 10 : 8.5));
      const ss = fs * 0.88, x0 = W / 2 - D.measure(txt, D.THIN(fs, 300), fs * 0.04) / 2, y0 = H * (portrait ? 0.42 : 0.44);
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G);
          D.cover(G, cv, 0, 0, W, H, { zoom: 1.12 + lt * 0.02, dx: u * 3 - u * lt * 1.3, fx: fo[0], fy: fo[1] });
          G.save(); G.globalCompositeOperation = "screen";
          const gl = G.createRadialGradient(W * 0.95, 0, 0, W * 0.95, 0, Math.max(W, H) * 0.55);
          gl.addColorStop(0, D.rgba(P.gold, 0.55)); gl.addColorStop(1, D.rgba(P.leak, 0)); G.fillStyle = gl; G.fillRect(0, 0, W, H); G.restore();
          D.vignette(G, W, H, 0.45, P.black, 0.4);
          G.save(); G.shadowColor = D.rgba(P.black, 0.55); G.shadowBlur = u * 2 * ctx.dpr; G.shadowOffsetY = u * 0.4 * ctx.dpr;
          const lq = prog(lt, 0.02, 0.25, "out");
          G.fillStyle = D.rgba(P.white, 0.85); G.fillRect(x0 - u * 7 * lq, y0 + u * 0.8, u * 6 * lq, Math.max(1, u * 0.18));
          D.text(G, D.decode(txt, lt - 0.05, p.cps, 3), x0, y0, { font: D.THIN(fs, 300), color: P.white, sp: fs * 0.04, alpha: 0.95 });
          if (p.sub) D.text(G, D.decode(p.sub, lt - 0.25, p.cps, 7), x0 - fs * 0.25, y0 + ss * 1.05, { font: D.THIN(ss, 200), color: P.white, alpha: 0.9 });
          G.restore();
          T.end(G);
        },
      };
    },
  });
})();

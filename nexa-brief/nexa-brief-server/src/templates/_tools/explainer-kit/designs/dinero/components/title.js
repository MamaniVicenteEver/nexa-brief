/* =============================================================================
   dinero · plano 1 de la referencia (0,0–1,0 s): palabra GIGANTE en didona condensada
   verde oscuro sobre gris verdoso; las letras se paran una por una mientras la cámara
   las sigue, un objeto (foto) entra deslizando desde la izquierda con desenfoque de
   movimiento y en ~0,5 s la cámara se aleja de golpe y revela la escena. Sale con un
   barrido desenfocado. `dinero.serif` es el plano; `dinero.title` es la apertura.
   ========================================================================== */
(function () {
  const K = Kit, D = Kit.dinero, { clamp, lerp, prog, ease } = K;

  /** escena serif reutilizable (también la usan title e intros) */
  function serifScene(ctx, p) {
    const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage;
    const raw = portrait && p.textPortrait ? p.textPortrait : p.text;
    const lines = (String(raw).includes("\n") ? String(raw).toUpperCase().split("\n").map(s => s.trim()).filter(Boolean) : D.wrap(String(raw).toUpperCase(), portrait ? 8 : 14));
    const nL = Math.max(1, lines.length);
    const widest = Math.max(...lines.map(l => D.measure(l, D.SERIF(100)) / 100));
    const fs = Math.min(W * (portrait ? 0.9 : 0.84) / widest, H * (portrait ? 0.42 : 0.56) / (nL * 0.86));
    const lh = fs * 0.84, cyText = H * (portrait ? 0.38 : 0.4), y0 = cyText - (nL - 1) * lh / 2 + fs * 0.36;
    /* letras con su posición final (mundo a escala 1) y su tiempo de aparición */
    const step = p.reveal ?? Math.min(0.075, 1.1 / Math.max(1, lines.join("").length));
    const L = []; let k = 0;
    lines.forEach((ln, li) => {
      const gl = D.glyphs(ln, D.SERIF(fs), fs * 0.01), x0 = (W - gl.width) / 2;
      gl.list.forEach(g => { if (g.c !== " ") L.push({ c: g.c, x: x0 + g.x, w: g.w, y: y0 + li * lh, t: 0.05 + k * step }); k++; });
    });
    const revealEnd = (L.at(-1)?.t ?? 0) + 0.12, pullAt = p.pull != null && p.pull >= 0 ? p.pull : revealEnd + 0.05;
    const band = { y: H * (portrait ? 0.47 : 0.58), h: H * (portrait ? 0.5 : 0.4) };
    const cv = p.src ? D.tint(ctx, p.src, "silver") : null, cv2 = p.src2 ? D.tint(ctx, p.src2, "silver") : null, fo = p.focus || [0.5, 0.5];
    function camera(lt) {
      const q = prog(lt, pullAt, 0.14, "expoOut");
      const cur = L.filter(l => l.t <= lt).at(-1) || L[0] || { x: W / 2, y: cyText, w: 0 };
      const fx = clamp(cur.x + cur.w * 0.5 - W * 0.12, W * 0.3, W * 0.7), fy = cyText;
      const z = lerp(1.55, 1, q) * (1 + 0.035 * clamp((lt - pullAt) / 4));
      const cx = lerp(fx, W / 2, q) + (q >= 1 ? -u * 0.4 * (lt - pullAt) : 0), cy = lerp(fy, H / 2, q);
      return { z, cx, cy, q };
    }
    function draw(G, lt, b) {
      D.fogBg(G, W, H, P);
      const cam = camera(lt);
      G.save(); G.translate(W / 2, H / 2); G.scale(cam.z, cam.z); G.translate(-cam.cx, -cam.cy);
      /* letras: se "paran" desde la línea de base con sombra proyectada a la izquierda */
      const dpr = ctx.dpr;
      for (const l of L) {
        const q = prog(lt, l.t, 0.13, "out"); if (q <= 0) continue;
        G.save(); G.translate(l.x + l.w / 2, l.y);
        G.transform(1, 0, -0.35 * (1 - q), 1, 0, 0); G.scale(1, 0.15 + 0.85 * q);
        G.globalAlpha = Math.min(1, q * 1.6);
        G.shadowColor = D.rgba(P.black, 0.42); G.shadowBlur = fs * 0.05 * cam.z * dpr;
        G.shadowOffsetX = -fs * 0.075 * cam.z * dpr; G.shadowOffsetY = fs * 0.012 * cam.z * dpr;
        D.text(G, l.c, 0, 0, { font: D.SERIF(fs), color: P.deep, align: "center" });
        G.restore();
      }
      /* objeto: entra desde la izquierda con desenfoque de movimiento, después deriva lenta */
      if (cv) {
        const qi = prog(lt, 0, Math.max(0.3, revealEnd * 0.9), "out"), vel = 1 - qi;
        const dx = lerp(-W * 0.75, 0, qi) - (cam.q >= 1 ? u * 0.5 * (lt - pullAt) : 0);
        const n = vel > 0.05 ? 4 : 1, [sc, sg] = D.scratch(ctx, 1);
        for (let i = 0; i < n; i++) {
          sg.save(); sg.globalAlpha = n > 1 ? 0.3 : 1;
          D.cover(sg, cv, dx - i * vel * W * 0.035, band.y, W, band.h, { fx: fo[0], fy: fo[1], zoom: 1.04 });
          sg.restore();
        }
        /* fundido del borde superior de la foto con la pared (máscara alfa) */
        const gr = sg.createLinearGradient(0, band.y, 0, band.y + band.h * 0.45);
        gr.addColorStop(0, "rgba(0,0,0,0)"); gr.addColorStop(1, "rgba(0,0,0,1)");
        sg.globalCompositeOperation = "destination-in"; sg.fillStyle = gr; sg.fillRect(0, band.y, W, band.h); sg.globalCompositeOperation = "source-over";
        G.drawImage(sc, 0, 0, W, H);
      }
      /* segunda foto (figuras) que aparece a la derecha al alejarse la cámara */
      if (cv2 && cam.q > 0) {
        const x = W * (portrait ? 0.56 : 0.72), w = W * (portrait ? 0.44 : 0.28), y = H * (portrait ? 0.46 : 0.3), h = H - y;
        G.save(); G.globalAlpha = cam.q; D.cover(G, cv2, x + (1 - cam.q) * w * 0.3, y, w, h, { fx: 0.5, fy: 0.4 });
        const g2 = G.createLinearGradient(x, 0, x + w * 0.35, 0); g2.addColorStop(0, P.fog); g2.addColorStop(1, D.rgba(P.fog, 0));
        G.fillStyle = g2; G.fillRect(x - 1, y, w * 0.35 + 1, h); G.restore();
      }
      G.restore();
      /* piso: sombra verde abajo + viñeta */
      const fl = G.createLinearGradient(0, H * 0.82, 0, H);
      fl.addColorStop(0, D.rgba(P.deep, 0)); fl.addColorStop(1, D.rgba(P.deep, 0.45 * cam.q));
      G.fillStyle = fl; G.fillRect(0, H * 0.82, W, H * 0.18);
      D.vignette(G, W, H, 0.3, P.black, 0.5);
      /* alejamiento brusco: un cuadro de desenfoque */
      if (cam.q > 0 && cam.q < 0.98) D.smear(ctx, 0, u * 2, 3, 0.2);
      return cam;
    }
    return { draw, revealEnd, pullAt, lines, fs, cyText };
  }
  D.serifScene = serifScene;

  const PARAMS = {
    text: { type: "string", required: true, doc: "Palabra o frase corta (MAYÚSCULAS automáticas). '\\n' parte renglones; 1 palabra = el plano de la referencia." },
    textPortrait: { type: "string", default: "", doc: "Renglones para 9:16 (vacío = se reparten solos, ≤ 8 letras)." },
    src: { type: "image", default: "", doc: "Objeto/escena de abajo (foto en plata verdosa que entra desde la izquierda)." },
    src2: { type: "image", default: "", doc: "Segunda foto (figuras) que aparece a la derecha al alejarse la cámara." },
    reveal: { type: "number", default: 0.075, min: 0.02, max: 0.3, doc: "Segundos entre letra y letra." },
    pull: { type: "number", default: -1, doc: "Segundo del alejamiento de cámara (-1 = al terminar las letras)." },
    ...D.FOCUS,
  };

  K.register({
    name: "dinero.serif", tags: ["texto", "impacto", "foto", "cámara"], layer: "main",
    summary: "Palabra GIGANTE en didona condensada verde oscuro sobre pared gris verdosa (ref. 0,0 s 'MONEY'): las letras se paran una por una con sombra proyectada mientras la cámara las sigue; la foto entra desde la izquierda con desenfoque de movimiento; al terminar, la cámara se aleja de golpe y revela todo; sale con un barrido. Para la palabra/cifra que abre un tema.",
    example: { text: "DINERO", src: "../designs/dinero/samples/billete100.jpg" },
    params: { ...PARAMS, ...D.FX("cut") },
    create(ctx, p) {
      const S = serifScene(ctx, p);
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G); S.draw(G, lt, b); T.end(G);
          const out = lt - (b.dur - 0.13);
          if (out > 0) D.smear(ctx, ctx.stage.W * 0.09 * clamp(out / 0.13), 0, 6, 0.18);
        },
      };
    },
  });

  K.register({
    name: "dinero.title", tags: ["intro", "título", "apertura"], layer: "main",
    summary: "Título de apertura (t = 0) con el plano 1 de la referencia: el TÍTULO en didona condensada gigante verde oscuro, letra por letra con la cámara siguiéndolas, foto que entra desde la izquierda, alejamiento brusco y rótulo fino (kicker) que se escribe debajo. Sin subtítulos.",
    example: { text: "EL PRECIO\nDE UNA IDEA", kicker: "DARTMOUTH · 1956", src: "../designs/dinero/samples/contando.jpg" },
    params: {
      ...PARAMS,
      text: { type: "string", required: true, doc: "Título (2–4 renglones cortos con '\\n')." },
      kicker: { type: "string", default: "", doc: "Rótulo fino (Montserrat 200) que se escribe al alejarse la cámara." },
      ...D.FX("cut"),
    },
    create(ctx, p) {
      ctx.beat.hideCaptions = true;
      const S = serifScene(ctx, { ...p, reveal: Math.min(p.reveal, 0.06) });
      const P = ctx.C.palette, { W, H, u, portrait } = ctx.stage;
      return {
        render(lt, b) {
          if (!D.keep(ctx, b, lt)) return;
          const G = ctx.g.main, T = D.enter(ctx, p.fx, lt, b);
          T.begin(G);
          const cam = S.draw(G, lt, b);
          if (p.kicker && cam.q > 0) {
            const s = D.decode(p.kicker.toUpperCase(), lt - S.pullAt - 0.05, 22, 3), fs = u * (portrait ? 3.4 : 2.6);
            const y = S.cyText - S.lines.length * S.fs * 0.42 - u * (portrait ? 4 : 3);
            G.save(); G.fillStyle = D.rgba(P.black, 0.18 * cam.q); G.fillRect(W / 2 - D.measure(p.kicker, D.THIN(fs, 300), fs * 0.3) / 2 - u * 2, y - fs * 1.1, D.measure(p.kicker, D.THIN(fs, 300), fs * 0.3) + u * 4, fs * 1.6); G.restore();
            D.text(G, s, W / 2, y, { font: D.THIN(fs, 300), color: P.white, align: "center", sp: fs * 0.3, alpha: cam.q });
          }
          T.end(G);
          const out = lt - (b.dur - 0.13);
          if (out > 0) D.smear(ctx, W * 0.09 * clamp(out / 0.13), 0, 6, 0.18);
        },
      };
    },
  });
})();

/* =============================================================================
   memorias · planos de la referencia ("Historical Memories")
   -----------------------------------------------------------------------------
   title → portada: título manuscrito grande + subtítulo en Quicksand sobre el
           papel, con bocetos a lápiz en las esquinas (center) o un boceto grande
           a un costado (side, como "Baburka video · motion graphics")
   scene → el plano de la referencia: boceto a lápiz → foto que se colorea por
           manchas → salpicadura de acuarela con gotas → bloque de texto
           (manuscrita + MAYÚSCULAS armadas letra a letra) + periódico fantasma
   ========================================================================== */
(function () {
  const K = Kit, M = Kit.memorias, { clamp, prog, lerp } = K;

  const FOCUS = { type: "array", default: [0.5, 0.5], doc: "Punto de interés [x,y] 0..1 para el recorte 'cover'." };
  const AUTO_SPLASH = { bl: "tr", br: "tl", tl: "r", tr: "l", none: "tr" };

  /* ------------------------------------------------------------ title */
  K.register({
    name: "memorias.title", tags: ["apertura", "título", "portada", "boceto"], layer: "main",
    summary: "Portada 'Historical Memories': título manuscrito grande (Mr Dafoe) que se escribe de izquierda a derecha + subtítulo en Quicksand, sobre papel de yeso con humo gris; bocetos a lápiz de una o dos fotos en las esquinas (layout center) o un boceto grande a un costado con el texto arriba a la izquierda (layout side).",
    example: { title: "La noche del Muro", sub: "Berlín · 9 de noviembre de 1989", src: "assets/media/brandenburgo.jpg", src2: "assets/media/bernauer.jpg", layout: "center" },
    params: {
      title: { type: "string", required: true, doc: "Título manuscrito ('\\n' parte renglones)." },
      sub: { type: "string", default: "", doc: "Subtítulo chico (Quicksand)." },
      src: { type: "image", default: "", doc: "Foto que se dibuja como boceto (arriba a la derecha en center; a la derecha en side)." },
      src2: { type: "image", default: "", doc: "Segunda foto en boceto (abajo a la izquierda, solo center)." },
      layout: { type: "enum", options: ["center", "side"], default: "center", doc: "center = título al medio y bocetos en las esquinas; side = texto arriba a la izquierda y boceto grande a la derecha." },
      focus: FOCUS, focus2: FOCUS,
      titlePortrait: { type: "string", default: "", doc: "Título alternativo para 9:16 ('\\n' parte renglones)." },
    },
    create(ctx, p) {
      const { W, H, portrait } = ctx.stage, P = ctx.C.palette;
      const side = p.layout === "side";
      const parts = [];
      if (p.src) parts.push(M.scene(ctx, side
        ? { src: p.src, focus: p.focus, box: portrait ? [0, 0.38, 1, 0.62] : [0.3, 0, 0.7, 1], reveal: "none", splash: "none", ghost: false, smokes: 2, sketch: 1.1,
            sketchLobes: [{ x: 0.55, y: 0.55, rx: 0.5, ry: 0.55 }, { x: 0.75, y: 0.3, rx: 0.3, ry: 0.35 }], sketchDur: 1.3 }
        : { src: p.src, focus: p.focus, box: portrait ? [0.25, 0, 0.75, 0.3] : [0.62, 0, 0.38, 0.47], reveal: "none", splash: "none", ghost: false, smokes: 2, sketch: 1.1,
            sketchLobes: [{ x: 0.65, y: 0.35, rx: 0.55, ry: 0.55 }, { x: 0.9, y: 0.75, rx: 0.3, ry: 0.4 }], sketchDur: 1.2 }));
      if (p.src2 && !side) parts.push(M.scene(ctx, { src: p.src2, focus: p.focus2, box: portrait ? [0, 0.74, 0.65, 0.26] : [0, 0.72, 0.42, 0.28], reveal: "none", splash: "none", ghost: false, smokes: 0, sketch: 1.1,
        sketchLobes: [{ x: 0.3, y: 0.6, rx: 0.5, ry: 0.6 }, { x: 0.6, y: 0.8, rx: 0.4, ry: 0.4 }], sketchAt: 0.3, sketchDur: 1.1 }));
      if (!parts.length) parts.push(M.scene(ctx, { reveal: "none", splash: "none", ghost: false, smokes: 3 }));
      /* título: tamaño por ancho (≈62 % en 16:9) y limitado por alto */
      const title = String((portrait && p.titlePortrait) || p.title), lines = title.split("\n");
      const ref = 100, wMax = Math.max(...lines.map(l => M.measure(l, `400 ${ref}px 'Mr Dafoe'`)));
      const fs = Math.min(ref * W * (portrait ? 0.84 : side ? 0.42 : 0.62) / wMax, H * (portrait ? 0.085 : 0.15));
      const subFs = fs * (portrait ? 0.3 : 0.32);
      const cx = side ? (portrait ? W * 0.08 : W * 0.1) : W / 2, align = side ? "left" : "center";
      const lh = fs * 0.98, blockH = lh * lines.length + (p.sub ? subFs * 1.6 : 0);
      const y0 = side ? (portrait ? H * 0.14 : H * 0.2) : (portrait ? H * 0.5 : H * 0.53) - blockH / 2;
      return {
        render(lt, b, t) {
          const G = ctx.g.main, out = 1 - prog(lt, b.dur - 0.2, 0.7, "sine");
          for (const s of parts) s.render(lt, b, t);
          if (out <= 0.002) return;
          G.save(); G.textAlign = align; G.textBaseline = "alphabetic";
          G.shadowColor = M.rgba(P.paperHi, 0.7); G.shadowBlur = fs * 0.12;
          /* manuscrita: se escribe con un barrido de recorte (con entrada desde el papel) */
          lines.forEach((ln, i) => {
            const t0 = 0.45 + i * 0.4, q = M.ease4((lt - t0) / 1.05);
            if (q <= 0) return;
            const w = M.measure(ln, `400 ${fs}px 'Mr Dafoe'`), x0 = align === "center" ? cx - w / 2 : cx, y = y0 + lh * (i + 0.78);
            G.save(); G.beginPath(); G.rect(x0 - fs * 0.6, y - fs * 1.2, (w + fs * 1.2) * q, fs * 1.8); G.clip();
            G.globalAlpha = out * clamp((lt - t0) / 0.2); G.fillStyle = P.script; G.font = `400 ${fs}px 'Mr Dafoe'`; G.fillText(ln, cx, y);
            G.restore();
          });
          if (p.sub) {
            const t0 = 0.95 + lines.length * 0.25, q = M.ease4((lt - t0) / 0.8), y = y0 + lh * lines.length + subFs * 1.15;
            const w = M.measure(p.sub, `700 ${subFs}px Quicksand`), x0 = align === "center" ? cx - w / 2 : cx;
            if (q > 0) { G.save(); G.beginPath(); G.rect(x0 - subFs, y - subFs * 1.3, (w + subFs * 2) * q, subFs * 2); G.clip(); G.globalAlpha = out; G.fillStyle = P.ink; G.font = `700 ${subFs}px Quicksand`; G.fillText(p.sub, cx, y); G.restore(); }
          }
          G.restore();
        },
        dispose() { for (const s of parts) s.dispose(); },
      };
    },
  });

  /* ------------------------------------------------------------ scene */
  K.register({
    name: "memorias.scene", tags: ["foto", "lugar", "monumento", "acuarela", "boceto", "dato"], layer: "main",
    summary: "El plano de la referencia: la foto aparece primero como BOCETO A LÁPIZ sobre el papel, después se colorea por manchas de tinta (reveal: full/right/left/center/bottom; lo demás queda en boceto), revienta una salpicadura de acuarela azul con gotas (negra con tone=bw) y aparece el bloque de texto: renglón manuscrito (kicker) + renglones en MAYÚSCULAS que se arman letra a letra (text, '\\n' = renglón). Detrás, un recorte de periódico fantasma; zoom lento durante el plano y salida con humo.",
    example: { src: "assets/media/brandenburgo.jpg", kicker: "Berlín, 1989", text: "Puerta de Brandeburgo\nEl muro pasaba detrás", pos: "bl", reveal: "right", splash: "auto" },
    params: {
      src: { type: "image", required: true, doc: "La foto (a color para lugares; cielo visible ayuda)." },
      kicker: { type: "string", default: "", doc: "Renglón manuscrito arriba del bloque (Mr Dafoe)." },
      text: { type: "string", default: "", doc: "Renglones en MAYÚSCULAS ('\\n' parte renglones; 1–3 renglones cortos)." },
      kicker2: { type: "string", default: "", doc: "Segundo renglón manuscrito, entre el 1.º y el 2.º renglón de text (como 'Modular Structure / FIRST… / Easily edit scenes / SECOND…')." },
      pos: { type: "enum", options: ["bl", "tl", "tr", "br"], default: "bl", doc: "Esquina del bloque de texto (bl abajo-izq., tl arriba-izq., tr arriba-der., br abajo-der.)." },
      tone: { type: "enum", options: ["color", "bw"], default: "color", doc: "color = acuarela azul; bw = foto B/N con manchas de tinta negra (retratos, archivo)." },
      reveal: { type: "enum", options: ["full", "right", "left", "center", "bottom", "none"], default: "full", doc: "Qué parte se colorea; lo demás queda en boceto (none = solo boceto)." },
      splash: { type: "enum", options: ["auto", "none", "tl", "tr", "t", "l", "r", "c", "bl", "br"], default: "auto", doc: "Dónde revienta la salpicadura (auto = lejos del texto)." },
      splashSize: { type: "number", default: 0.26, min: 0.08, max: 0.7, doc: "Radio de la salpicadura (fracción del lado corto; 0,5–0,7 = aguada grande que pinta el cielo)." },
      splashColor: { type: "color", default: "", doc: "Color de la salpicadura (vacío = palette.splash, o tinta negra en bw)." },
      focus: FOCUS,
      ghost: { type: "bool", default: true, doc: "Recorte de periódico + titular fantasma en el papel." },
      drift: { type: "number", default: 0.07, min: 0, max: 0.3, doc: "Zoom lento durante el plano." },
      cut: { type: "enum", options: ["auto", "wash", "whip"], default: "auto", doc: "Corte de SALIDA: wash = se borra con una mancha de papel mientras asoma el boceto siguiente; whip = barrido de cámara con estela y el siguiente entra deslizándose; auto = como la referencia (barrido cada 3 escenas)." },
    },
    create(ctx, p) {
      const caps = String(p.text || "").split("\n").map(s => s.trim()).filter(Boolean);
      const lines = [];
      if (p.kicker) lines.push({ kind: "script", text: p.kicker });
      caps.forEach((c, i) => { lines.push({ kind: "caps", text: c }); if (i === 0 && p.kicker2) lines.push({ kind: "script", text: p.kicker2 }); });
      if (!caps.length && p.kicker2) lines.push({ kind: "script", text: p.kicker2 });
      return M.scene(ctx, {
        src: p.src, focus: p.focus, tone: p.tone, reveal: p.reveal,
        splash: p.splash === "auto" ? AUTO_SPLASH[p.pos] || "tr" : p.splash, splashSize: p.splashSize, splashColor: p.splashColor || null,
        ghost: p.ghost, drift: p.drift, lines, textPos: p.pos,
      });
    },
  });
})();

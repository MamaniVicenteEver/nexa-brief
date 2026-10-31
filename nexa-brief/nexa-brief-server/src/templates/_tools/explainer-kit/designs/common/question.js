/* =============================================================================
   common · pregunta de cierre compartida por todas las familias
   ----------------------------------------------------------------------------
   Tarjeta grande y legible para el último acto narrado. Usa solo la paleta del
   diseño, se adapta al marco corto de 9:16 y 16:9, y no añade iconos ni emojis.
   ========================================================================== */
(function () {
  const K = Kit, { clamp } = K;

  function wrap(text, maxWidth, measure) {
    const words = String(text).trim().split(/\s+/).filter(Boolean);
    const lines = [];
    let line = "";
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure.measureText(next).width > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    if (line) lines.push(line);
    return lines;
  }

  K.register({
    name: "common.question",
    tags: ["pregunta", "comentarios", "cierre", "texto"],
    layer: "overlay",
    summary: "Tarjeta grande para la pregunta final del video; ocupa el acto completo y se adapta a 9:16 y 16:9.",
    example: { text: "¿La IA te quita trabajo?" },
    params: {
      text: { type: "string", required: true, doc: "Pregunta exacta del guion (máximo 8 palabras)." },
      y: { type: "number", default: 0.5, min: 0.2, max: 0.8, doc: "Centro vertical de la tarjeta (fracción del cuadro)." },
    },
    create(ctx, p) {
      const { W, H, u, content } = ctx.stage;
      const C = ctx.C;
      const font = C.fonts?.main || "Inter";
      const measure = document.createElement("canvas").getContext("2d");
      const maxTextWidth = content.w * 0.84;
      measure.font = `900 100px ${font}`;
      const lines = wrap(p.text, maxTextWidth * 100 / Math.max(1, u * 5.4), measure);
      const baseSize = Math.min(u * 5.4, content.h * 0.2);
      const widest = Math.max(1, ...lines.map(line => measure.measureText(line).width));
      const fs = Math.min(baseSize, maxTextWidth * 100 / widest, content.h * 0.46 / (lines.length * 1.12));
      const lineWidth = widest * fs / 100;
      const padX = u * (ctx.stage.portrait ? 3.4 : 3.8), padY = u * 2.1;
      const cardWidth = Math.min(content.w * 0.94, lineWidth + padX * 2);
      const cardHeight = fs * lines.length * 1.12 + padY * 2;
      const card = K.el("div", null, {
        position: "absolute",
        left: `${(W - cardWidth) / 2}px`,
        top: `${H * p.y - cardHeight / 2}px`,
        width: `${cardWidth}px`,
        minHeight: `${cardHeight}px`,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: `${padY}px ${padX}px`,
        border: `${Math.max(2, u * 0.18)}px solid ${C.palette.accent || C.palette.ink}`,
        borderRadius: `${u * 1.2}px`,
        background: "rgba(0,0,0,0.9)",
        color: "#ffffff",
        boxShadow: "0 14px 44px rgba(0,0,0,0.36)",
        textAlign: "center",
        fontFamily: font,
        fontWeight: "900",
        fontSize: `${fs}px`,
        lineHeight: "1.12",
        letterSpacing: "-0.025em",
        overflowWrap: "anywhere",
        whiteSpace: "normal",
        transform: "translateY(0.4em) scale(0.98)",
        opacity: "0",
      }, ctx.layers.dom);
      card.textContent = lines.join("\n");
      card.style.whiteSpace = "pre-line";
      ctx.beat.hideCaptions = true;
      return {
        render(lt, beat) {
          const enter = clamp(lt / 0.35);
          const leave = clamp((beat.dur - lt) / 0.35);
          card.style.opacity = String(Math.min(enter, leave));
          card.style.transform = `translateY(${(1 - enter) * u * 1.4}px) scale(${0.98 + enter * 0.02})`;
        },
        dispose() { card.remove(); },
      };
    },
  });
})();

/* =============================================================================
   imperio · textos que van ENCIMA de cualquier plano con mapa (capa overlay)
   imperio.word   = título condensado blanco que sube con degradé y después se achica
                    lentamente mientras sigue el plano (ref 10.1–27.7 s)
   imperio.native = título en idioma original (kanji, alemán, ruso…) + traducción
                    tipeada; se borra de derecha a izquierda (ref 4.9–9.9 s)
   ========================================================================== */
(function () {
  "use strict";
  const K = Kit, IM = Kit.imperio, { clamp, prog } = K;
  const D2R = Math.PI / 180;

  K.register({
    name: "imperio.word", tags: ["título", "texto", "nombre", "imperio", "condensada"], layer: "overlay", post: 0.6,
    summary: "Título condensado BLANCO (Fjalla One) sobre el plano en curso: cada renglón SUBE desde abajo con degradé de opacidad (arriba aparece primero) y desenfoque, y después el título se ACHICA lento y exponencial (rápido al principio) mientras el mapa sigue moviéndose (ref 10–27 s: 'JAPANESE EMPIRE'). Usalo como overlay sobre imperio.archive / imperio.map para el nombre del imperio, la doctrina o el tema del bloque.",
    example: { text: "JAPANESE\nEMPIRE", at: 0.2, shrinkAt: 2.8, shrinkTo: 0.18, tau: 2.8 },
    params: {
      text: { type: "string", required: true, doc: "Texto ('\\n' parte renglones). Mayúsculas automáticas." },
      textPortrait: { type: "string", default: "", doc: "Versión para 9:16." },
      at: { type: "number", default: 0.2, doc: "Segundo en que sube (acepta '@palabra'). −1 = ya está (continúa el título de imperio.title sin volver a entrar)." },
      shrinkAt: { type: "number", default: 2.8, doc: "Segundo en que empieza a achicarse (−1 = nunca)." },
      shrinkTo: { type: "number", default: 0.18, min: 0.1, max: 1, doc: "Escala final a la que tiende." },
      tau: { type: "number", default: 2.8, min: 0.3, doc: "Constante de tiempo del achique (s): más chico = más rápido." },
      y: { type: "number", default: 0.68, min: 0.1, max: 0.9, doc: "Centro vertical (fracción del alto) en 16:9." },
      size: { type: "number", default: 0.62, min: 0.2, max: 0.95, doc: "Ancho del renglón más largo (fracción del ancho) en 16:9; en 9:16 se usa 0.86." },
      rise: { type: "number", default: 0.06, min: -0.3, max: 0.3, doc: "Mientras se achica sube hacia el centro (fracción del alto)." },
      tilt: { type: "number", default: 0, min: -15, max: 15, doc: "Giro inicial en grados." },
      spin: { type: "number", default: 0.25, min: -3, max: 3, doc: "Grados por segundo que gira (acompaña al mapa)." },
    },
    create(ctx, p) {
      const st = ctx.stage, { W, H, portrait } = st, text = (portrait && p.textPortrait) || p.text;
      const L = IM.wordLayout(text, W * (portrait ? 0.86 : p.size), portrait ? W * 0.3 : H * 0.25);
      const y0 = portrait ? 0.55 : p.y;
      return {
        render(lt, b) {
          const s = p.shrinkAt < 0 ? 1 : IM.shrink(lt, p.shrinkAt, p.shrinkTo, p.tau), k = (1 - s) / Math.max(0.01, 1 - p.shrinkTo);
          const out = 1 - prog(lt, b.dur, 0.5, "inOut");
          IM.word(ctx.g.main, st, { layout: L, x: W / 2, y: H * (y0 - p.rise * k), at: p.at < 0 ? null : p.at, scale: s, rot: (p.tilt + p.spin * lt) * D2R, alpha: out, stagger: 0.78, reveal: 0.45 }, lt);
        },
      };
    },
  });

  K.register({
    name: "imperio.native", tags: ["título", "idioma original", "kanji", "doctrina", "cita", "traducción"], layer: "overlay", post: 0.4,
    summary: "Nombre en su IDIOMA ORIGINAL (kanji, alemán, ruso, árabe latinizado…) en gris grande: cada carácter entra con escala y desenfoque escalonados, la traducción en mayúsculas negras se tipea debajo, y al final se borra de derecha a izquierda (ref 4.9–9.9 s: '南進論 · SOUTHERN EXPANSION DOCTRINE'). Overlay sobre un plano con mapa claro (imperio.map / imperio.title).",
    example: { text: "南進論", sub: "DOCTRINA DE EXPANSIÓN AL SUR" },
    params: {
      text: { type: "string", required: true, doc: "Texto en el idioma original (corto: 1–3 palabras o 2–6 caracteres CJK)." },
      sub: { type: "string", default: "", doc: "Traducción (mayúsculas automáticas)." },
      at: { type: "number", default: 0.2, doc: "Segundo en que entra el primer carácter (acepta '@palabra')." },
      outAt: { type: "number", default: -1, doc: "Segundo en que se borra (−1 = 1 s antes del final del beat)." },
      x: { type: "number", default: 0.64, min: 0, max: 1, doc: "Borde izquierdo (fracción del ancho) en 16:9. En 9:16 va centrado." },
      y: { type: "number", default: 0.6, min: 0.1, max: 0.9, doc: "Línea base (fracción del alto)." },
      width: { type: "number", default: 0.3, min: 0.1, max: 0.9, doc: "Ancho máximo (fracción del ancho) en 16:9; en 9:16 se usa 0.7." },
      tilt: { type: "number", default: 0, min: -15, max: 15, doc: "Giro en grados." },
    },
    create(ctx, p) {
      const st = ctx.stage, { W, H, portrait } = st;
      return {
        render(lt, b) {
          const o = portrait ? { x: W / 2, y: H * Math.min(p.y, 0.62), width: W * 0.7, align: "center" } : { x: W * p.x, y: H * p.y, width: W * p.width, align: "left" };
          IM.native(ctx.g.main, st, { ...o, text: p.text, sub: p.sub, at: p.at, outAt: p.outAt < 0 ? Math.max(p.at + 1, b.dur - 1) : p.outAt, rot: p.tilt * D2R, maxFs: H * (portrait ? 0.1 : 0.15) }, lt);
        },
      };
    },
  });
})();

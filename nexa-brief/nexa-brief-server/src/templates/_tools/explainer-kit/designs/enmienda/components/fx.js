/* =============================================================================
   enmienda · efectos de corte (overlay) y cierre de canal
   ========================================================================== */
(function () {
  const K = Kit, E = Kit.enm, { clamp, prog, lerp } = K;

  /* ================================================================= flicker */
  K.register({
    name: "enmienda.flicker", tags: ["transición", "golpe", "corte"], layer: "overlay", post: 0,
    summary: "Golpe de proyector sobre la escena: destello blanco de 2 cuadros que se apaga, caída a negro, o parpadeo de exposición irregular (lámpara inestable).",
    example: { kind: "white", dur: 0.4 },
    params: {
      kind: { type: "enum", options: ["white", "black", "exposure"], default: "white", doc: "Tipo de golpe." },
      strength: { type: "number", default: 0.85, min: 0, max: 1, doc: "Intensidad máxima." },
    },
    create(ctx, p) {
      return {
        render(lt, b) {
          if (lt > b.dur) return;
          const G = ctx.g.top, { W, H } = ctx.stage, fr = Math.floor(lt * E.FPS);
          let a = 0, c = "255,252,246";
          if (p.kind === "white") a = fr < 2 ? p.strength : p.strength * 0.6 * (1 - clamp(lt / b.dur));
          else if (p.kind === "black") { c = "0,0,0"; a = p.strength * Math.sin(Math.PI * clamp(lt / b.dur)); }
          else { const r = K.rng(77 + fr)(); a = p.strength * 0.5 * r; c = r < 0.5 ? "0,0,0" : "255,252,246"; }
          if (a <= 0.01) return;
          G.save(); G.fillStyle = `rgba(${c},${a.toFixed(3)})`; G.fillRect(0, 0, W, H); G.restore();
        },
      };
    },
  });

})();

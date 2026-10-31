/* Piel «rough» (NodeTech) para el motor de imágenes: cuadrícula sutil, subrayado a mano bajo la
   cifra y marco con sombra lima en la foto. La estructura la pone engine/image-engine.js. */
(function () {
  const SVG = "http://www.w3.org/2000/svg";

  function background(root) {
    const grid = document.createElement("div");
    grid.className = "rough-grid";
    root.appendChild(grid);
  }

  // Subrayado a mano del ancho real de la cifra (se mide después del ajuste de fuente).
  function underline(root, ctx) {
    const stat = root.querySelector('[data-block="stat"]');
    if (!stat || !window.rough) return;
    const range = document.createRange();
    range.selectNodeContents(stat);
    const text = range.getBoundingClientRect();
    const box = root.getBoundingClientRect();
    const width = Math.min(text.width, box.width) + 24 * ctx.scale;
    const svg = document.createElementNS(SVG, "svg");
    svg.setAttribute("class", "rough-underline");
    svg.setAttribute("aria-hidden", "true");
    svg.style.left = (text.left - box.left - 8 * ctx.scale) + "px";
    svg.style.top = (text.bottom - box.top - 6 * ctx.scale) + "px";
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(34 * ctx.scale));
    const generator = window.rough.generator();
    const strokes = [0, 1].map(pass => generator.line(4, 12 * ctx.scale + pass * 9 * ctx.scale, width - 4,
      8 * ctx.scale + pass * 11 * ctx.scale, {seed: ctx.plan.seed + pass * 7 + 3, roughness: 1.4, strokeWidth: 6 * ctx.scale}));
    for (const drawable of strokes) {
      for (const path of generator.toPaths(drawable)) {
        const node = document.createElementNS(SVG, "path");
        node.setAttribute("d", path.d);
        node.setAttribute("fill", "none");
        node.setAttribute("stroke", ctx.style.palette.accent);
        node.setAttribute("stroke-width", String(path.strokeWidth || 6));
        node.setAttribute("stroke-linecap", "round");
        svg.appendChild(node);
      }
    }
    root.appendChild(svg);
  }

  window.ImageEngine.registerSkin({
    id: "rough",
    className: "skin-rough",
    brand: ctx => ctx.style.brand?.name || "NodeTech",
    background,
    afterLayout: underline,
  });
})();

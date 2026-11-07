/* Piel «binary» (NodeHistory) para el motor de imágenes: campo de dígitos solo en la esquina
   (se desvanece antes del texto), kicker en itálica clásica y filete bajo la cifra.
   La estructura la pone engine/image-engine.js. */
(function () {
  function background(root, ctx) {
    const field = document.createElement("div");
    field.className = "binary-field";
    let seed = (ctx.plan.seed || 0) + ctx.slideIndex * 101 + 7;
    const random = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    for (let row = 0; row < 26; row += 1) {
      const line = document.createElement("div");
      line.className = "binary-row";
      line.textContent = Array.from({length: 46}, () => (random() > .5 ? "1" : "0")).join("");
      field.appendChild(line);
    }
    root.appendChild(field);
  }

  window.ImageEngine.registerSkin({
    id: "binary",
    className: "skin-binary",
    brand: ctx => ctx.style.brand?.name || "NodeHistory",
    background,
  });
})();

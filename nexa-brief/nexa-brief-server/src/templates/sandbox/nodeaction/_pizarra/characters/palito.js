/* characters/palito.js · el monigote de la referencia (doble trazo, cabeza redonda con mechones).
 * Es el personaje por defecto y el ejemplo a copiar para uno nuevo (ver ../PERSONAJES.md).
 */
(() => {
  "use strict";
  const R = window.Pizarra.rig;
  window.Pizarra.characters.palito = {
    name: "Palito (referencia)",
    draw(g, J, o) {
      R.tubes(g, J, o);
      R.feet(g, J, o);
      R.hands(g, J, o);
      R.waveLines(g, J, o);
      R.headCircle(g, J, o, (g, r) => {
        for (const [a, l] of [[-0.35, 0.28], [-0.1, 0.36], [0.18, 0.3]]) { // mechones
          const bx = Math.sin(a) * r, by = -Math.cos(a) * r;
          R.curve(g, [bx, by], [bx + r * 0.12, by - r * l * 0.6], [bx + r * 0.05 + a * r * 0.4, by - r * l], o.lw * 0.9, o.ink);
        }
        R.face(g, r * 0.06 * (o.lookX || 0), r * 0.05, r, o.face, o.t, o.lw);
      });
    },
  };
})();

/* characters/abuelo.js · abuelo de sienes plateadas, barba corta y bastón opcional. */
(() => {
  "use strict";
  const R = window.Pizarra.rig;

  window.Pizarra.characters.abuelo = {
    name: "Abuelo",
    draw(g, J, o) {
      R.tubes(g, J, o);
      const h = J.h, [x, y] = J.hip;
      // La chaqueta disimula la línea recta del rig y marca una espalda encorvada.
      g.beginPath(); g.moveTo(J.sh[0] - h * 0.105, J.sh[1]);
      g.quadraticCurveTo(x + h * 0.055, J.sh[1] + h * 0.06, x + h * 0.105, y + h * 0.055);
      g.lineTo(x - h * 0.09, y + h * 0.055);
      g.quadraticCurveTo(x - h * 0.13, y - h * 0.12, J.sh[0] - h * 0.105, J.sh[1]);
      g.closePath(); g.fillStyle = o.fill || o.bg; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.lineJoin = "round"; g.stroke();
      R.line(g, [[J.sh[0] + h * 0.012, J.sh[1] + h * 0.02], [x + h * 0.05, y + h * 0.035]], o.lw * 0.8, o.ink);
      // El bastón nace en la mano izquierda y apoya en el pie izquierdo en cualquier pose.
      const hand = J.armL[1];
      if (o.look?.cane) {
        const dx = -h * 0.035, endY = J.legL[1][1];
        R.curve(g, [hand[0], hand[1]], [hand[0] + dx, hand[1] + h * 0.035], [hand[0] + dx, hand[1] + h * 0.09], o.lw * 1.25, o.ink);
        R.line(g, [[hand[0] + dx, hand[1] + h * 0.07], [hand[0] + dx, endY]], o.lw * 1.25, o.ink);
      }
      R.feet(g, J, o); R.hands(g, J, o); R.waveLines(g, J, o);

      const head = { ...J.head, x: J.head.x + h * 0.012, y: J.head.y + h * 0.008, tilt: J.head.tilt + 0.07 };
      R.headCircle(g, { ...J, head }, o, (g, r) => {
        // Calva despejada y mechones a ambos lados de las sienes.
        for (const s of [-1, 1]) {
          R.curve(g, [s * r * 0.82, -r * 0.42], [s * r * 1.02, -r * 0.03], [s * r * 0.78, r * 0.28], o.lw * 1.15, o.ink);
          R.curve(g, [s * r * 0.79, -r * 0.05], [s * r * 0.96, r * 0.15], [s * r * 0.67, r * 0.36], o.lw * 0.85, o.ink);
        }
        R.face(g, r * 0.02 * (o.lookX || 0), r * 0.035, r, o.face, o.t, o.lw);
        // Barba recortada en la mandíbula; deja la boca de las expresiones visible.
        R.curve(g, [-r * 0.62, r * 0.43], [-r * 0.34, r * 0.78], [0, r * 0.77], o.lw * 1.05, o.ink);
        R.curve(g, [0, r * 0.77], [r * 0.35, r * 0.78], [r * 0.62, r * 0.43], o.lw * 1.05, o.ink);
        for (const x of [-r * 0.34, r * 0.34]) {
          g.beginPath(); g.arc(x, -r * 0.12, r * 0.235, 0, Math.PI * 2);
          g.strokeStyle = o.ink; g.lineWidth = o.lw * 0.9; g.stroke();
        }
        R.line(g, [[-r * 0.105, -r * 0.12], [r * 0.105, -r * 0.12]], o.lw * 0.75, o.ink);
      });
    },
  };
})();

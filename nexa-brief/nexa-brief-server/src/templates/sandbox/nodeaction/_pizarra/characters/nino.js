/* characters/nino.js · niño con gorra y mochila lateral. */
(() => {
  "use strict";
  const R = window.Pizarra.rig;

  function roundRect(g, x, y, w, h, r, o) {
    g.beginPath(); g.roundRect(x, y, w, h, r); g.fillStyle = o.fill || o.bg; g.fill();
    g.strokeStyle = o.ink; g.lineWidth = o.lw; g.stroke();
  }

  window.Pizarra.characters.nino = {
    name: "Niño",
    scale: { height: 0.72, head: 1.25 },
    draw(g, J, o) {
      const h = J.h, [x, y] = J.hip;
      // Dos costados acolchados asoman detrás del torso, sin formar un marco frontal.
      const packTop = J.neck[1] + h * 0.055, packHeight = h * 0.31;
      roundRect(g, x - h * 0.125, packTop, h * 0.055, packHeight, h * 0.025, o);
      roundRect(g, x + h * 0.07, packTop, h * 0.055, packHeight, h * 0.025, o);
      R.tubes(g, J, o, [], ["legs", "torso"]);
      // Una correa cruza el pecho desde el hombro; brazos y manos quedan delante.
      R.line(g, [[J.sh[0] - h * 0.055, J.sh[1] + h * 0.025], [x + h * 0.065, y - h * 0.095]], o.lw * 1.25, o.ink);
      R.tubes(g, J, o, [], ["arms"]);
      R.feet(g, J, o); R.hands(g, J, o); R.waveLines(g, J, o);
      R.headCircle(g, J, o, (g, r) => {
        // Gorra con copa baja y visera que sobresale hacia el frente.
        g.beginPath(); g.moveTo(-r * 0.86, -r * 0.44);
        g.quadraticCurveTo(-r * 0.64, -r * 1.16, r * 0.12, -r * 1.02);
        g.quadraticCurveTo(r * 0.69, -r * 0.95, r * 0.82, -r * 0.39);
        g.lineTo(r * 1.12, -r * 0.25); g.quadraticCurveTo(r * 0.68, -r * 0.16, r * 0.17, -r * 0.28);
        g.quadraticCurveTo(-r * 0.35, -r * 0.29, -r * 0.86, -r * 0.44);
        g.closePath(); g.fillStyle = o.bg; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.lineJoin = "round"; g.stroke();
        R.curve(g, [-r * 0.12, -r * 0.91], [r * 0.18, -r * 0.85], [r * 0.42, -r * 0.68], o.lw * 0.75, o.ink);
        R.face(g, r * 0.035 * (o.lookX || 0), r * 0.05, r, o.face, o.t, o.lw);
      });
    },
  };
})();

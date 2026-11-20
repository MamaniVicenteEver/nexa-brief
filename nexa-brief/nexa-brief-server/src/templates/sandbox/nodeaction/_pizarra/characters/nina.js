/* characters/nina.js · estudiante con flequillo, coleta animada y falda trapecio. */
(() => {
  "use strict";
  const R = window.Pizarra.rig;

  function poly(g, pts, o) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fillStyle = o.fill || o.bg; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.lineJoin = "round"; g.stroke();
  }

  window.Pizarra.characters.nina = {
    name: "Nina",
    draw(g, J, o) {
      R.tubes(g, J, o, [], ["legs", "torso"]);
      const h = J.h, [x, y] = J.hip;
      // Falda evasé, sobre la parte alta de las piernas y bajo los brazos.
      poly(g, [[x - h * 0.075, y - h * 0.025], [x + h * 0.075, y - h * 0.025], [x + h * 0.16, y + h * 0.14], [x - h * 0.16, y + h * 0.14]], o);
      R.line(g, [[x - h * 0.12, y + h * 0.105], [x + h * 0.12, y + h * 0.105]], o.lw * 0.75, o.ink);
      R.tubes(g, J, o, [], ["arms"]);
      R.feet(g, J, o); R.hands(g, J, o); R.waveLines(g, J, o);
      // La coleta nace detrás de la cabeza; el giro acompaña la inclinación de cada pose.
      const head = J.head, r = head.r;
      const side = (o.lookX || 0) < 0 ? 1 : -1;
      const swing = Math.sin(o.t * 4.2) * 0.2;
      g.save(); g.translate(head.x, head.y); g.rotate(head.tilt);
      g.beginPath();
      g.moveTo(side * r * 0.62, -r * 0.36);
      g.quadraticCurveTo(side * r * (1.08 + swing), -r * (0.62 + swing), side * r * 1.43, -r * (0.12 + swing));
      g.quadraticCurveTo(side * r * (1.22 + swing), r * 0.16, side * r * 0.68, r * 0.08);
      g.closePath(); g.fillStyle = o.ink; g.fill();
      g.beginPath(); g.arc(side * r * 0.69, -r * 0.29, r * 0.085, 0, Math.PI * 2);
      g.fillStyle = o.ink; g.fill();
      g.restore();
      R.headCircle(g, J, o, (g, r) => {
        // Flequillo corto, en mechones redondeados.
        g.beginPath(); g.moveTo(-r * 0.9, -r * 0.3);
        g.quadraticCurveTo(-r * 0.78, -r * 1.05, -r * 0.12, -r * 0.99);
        g.quadraticCurveTo(r * 0.62, -r * 1.02, r * 0.9, -r * 0.31);
        g.quadraticCurveTo(r * 0.68, -r * 0.52, r * 0.48, -r * 0.34);
        g.lineTo(r * 0.21, -r * 0.49); g.lineTo(-r * 0.02, -r * 0.31);
        g.lineTo(-r * 0.29, -r * 0.48); g.lineTo(-r * 0.57, -r * 0.32);
        g.closePath(); g.fillStyle = o.ink; g.fill();
        R.face(g, r * 0.025 * (o.lookX || 0), r * 0.04, r, o.face, o.t, o.lw);
      });
    },
  };
})();

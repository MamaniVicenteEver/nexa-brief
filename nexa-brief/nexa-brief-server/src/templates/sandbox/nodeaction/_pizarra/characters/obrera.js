/* characters/obrera.js · trabajadora con casco de seguridad y overol con tirantes. */
(() => {
  "use strict";
  const R = window.Pizarra.rig;

  function poly(g, pts, o, fill = o.fill || o.bg) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.lineJoin = "round"; g.stroke();
  }

  window.Pizarra.characters.obrera = {
    name: "Obrera",
    draw(g, J, o) {
      R.tubes(g, J, o, [], ["legs", "torso"]);
      const h = J.h, [x, y] = J.hip;
      // Pantalón trapezoidal hasta las rodillas y peto pequeño en el pecho.
      const hemY = Math.max(J.legR[0][1], J.legL[0][1]);
      poly(g, [[x - h * 0.105, y - h * 0.035], [x + h * 0.105, y - h * 0.035], [x + h * 0.082, hemY], [x - h * 0.082, hemY]], o);
      R.line(g, [[x - h * 0.08, hemY], [x + h * 0.08, hemY]], o.lw * 0.8, o.ink);
      poly(g, [[x - h * 0.067, J.sh[1] + h * 0.105], [x + h * 0.067, J.sh[1] + h * 0.105], [x + h * 0.062, y - h * 0.045], [x - h * 0.062, y - h * 0.045]], o);
      // Tirantes desde el peto hasta los hombros.
      R.line(g, [[x - h * 0.05, J.sh[1] + h * 0.11], [J.sh[0] - h * 0.078, J.sh[1] + h * 0.014]], o.lw * 1.35, o.ink);
      R.line(g, [[x + h * 0.05, J.sh[1] + h * 0.11], [J.sh[0] + h * 0.078, J.sh[1] + h * 0.014]], o.lw * 1.35, o.ink);
      R.tubes(g, J, o, [], ["arms"]);
      R.feet(g, J, o); R.hands(g, J, o); R.waveLines(g, J, o);
      // Moño bajo, separado del casco y sin el aro que producía la forma de Q.
      const head = J.head, r = head.r;
      g.save(); g.translate(head.x, head.y); g.rotate(head.tilt);
      g.beginPath(); g.ellipse(-r * 0.84, -r * 0.12, r * 0.16, r * 0.11, -0.25, 0, Math.PI * 2);
      g.fillStyle = o.ink; g.fill();
      g.restore();
      R.headCircle(g, J, o, (g, r) => {
        R.face(g, r * 0.02 * (o.lookX || 0), r * 0.04, r, o.face, o.t, o.lw);
        // Casco: copa redondeada, ala amplia y pequeña banda frontal.
        g.beginPath(); g.moveTo(-r * 0.94, -r * 0.46);
        g.quadraticCurveTo(-r * 0.78, -r * 1.18, 0, -r * 1.17);
        g.quadraticCurveTo(r * 0.78, -r * 1.18, r * 0.94, -r * 0.46);
        g.quadraticCurveTo(r * 0.5, -r * 0.34, 0, -r * 0.41);
        g.quadraticCurveTo(-r * 0.52, -r * 0.34, -r * 0.94, -r * 0.46);
        g.closePath(); g.fillStyle = o.bg; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.lineJoin = "round"; g.stroke();
        R.curve(g, [-r * 0.52, -r * 0.54], [0, -r * 0.67], [r * 0.52, -r * 0.54], o.lw * 0.65, o.ink);
      });
    },
  };
})();

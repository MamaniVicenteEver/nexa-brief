/* characters/profe.js · docente con saco, corbata, bigote y anteojos redondos. */
(() => {
  "use strict";
  const R = window.Pizarra.rig;

  function poly(g, pts, o, fill = o.fill || o.bg) {
    g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) g.lineTo(pts[i][0], pts[i][1]);
    g.closePath(); g.fillStyle = fill; g.fill(); g.strokeStyle = o.ink; g.lineWidth = o.lw; g.lineJoin = "round"; g.stroke();
  }

  window.Pizarra.characters.profe = {
    name: "Profe",
    draw(g, J, o) {
      R.tubes(g, J, o, [], ["legs", "torso"]);

      // Saco entallado: sigue los hombros y se estrecha hacia la cadera.
      const h = J.h, [sx, sy] = J.sh, [hx, hy] = J.hip;
      poly(g, [[sx - h * 0.105, sy + h * 0.012], [sx + h * 0.105, sy + h * 0.012], [hx + h * 0.078, hy + h * 0.045], [hx - h * 0.078, hy + h * 0.045]], o);
      // Cuello y solapas abiertas en V; la camisa deja sitio a la corbata.
      poly(g, [[sx - h * 0.033, sy + h * 0.018], [sx + h * 0.033, sy + h * 0.018], [hx + h * 0.032, hy - h * 0.025], [hx - h * 0.032, hy - h * 0.025]], o);
      R.line(g, [[sx - h * 0.035, sy + h * 0.012], [sx - h * 0.078, sy + h * 0.08], [hx - h * 0.035, hy - h * 0.025]], o.lw * 1.05, o.ink);
      R.line(g, [[sx + h * 0.035, sy + h * 0.012], [sx + h * 0.078, sy + h * 0.08], [hx + h * 0.035, hy - h * 0.025]], o.lw * 1.05, o.ink);
      poly(g, [[sx - h * 0.032, sy + h * 0.016], [sx, sy + h * 0.075], [sx + h * 0.032, sy + h * 0.016]], o);
      poly(g, [[sx, sy + h * 0.073], [sx + h * 0.018, sy + h * 0.108], [sx, sy + h * 0.15], [sx - h * 0.018, sy + h * 0.108]], o, o.ink);

      R.tubes(g, J, o, [], ["arms"]);
      R.feet(g, J, o); R.hands(g, J, o); R.waveLines(g, J, o);
      R.headCircle(g, J, o, (g, r) => {
        // Pelo corto peinado hacia un lado, con una raya clara.
        g.beginPath(); g.moveTo(-r * 0.91, -r * 0.32);
        g.quadraticCurveTo(-r * 0.72, -r * 1.12, -r * 0.08, -r * 1.01);
        g.quadraticCurveTo(r * 0.58, -r * 1.08, r * 0.91, -r * 0.35);
        g.quadraticCurveTo(r * 0.47, -r * 0.65, -r * 0.14, -r * 0.62);
        g.quadraticCurveTo(-r * 0.56, -r * 0.55, -r * 0.91, -r * 0.32);
        g.closePath(); g.fillStyle = o.ink; g.fill();
        R.curve(g, [-r * 0.2, -r * 0.91], [r * 0.1, -r * 0.79], [r * 0.47, -r * 0.88], o.lw * 0.7, o.bg);
        R.face(g, r * 0.03 * (o.lookX || 0), r * 0.04, r, o.face, o.t, o.lw);
        // Aros redondos sobre los ojos.
        for (const x of [-r * 0.34, r * 0.34]) {
          g.beginPath(); g.arc(x, -r * 0.12, r * 0.235, 0, Math.PI * 2);
          g.strokeStyle = o.ink; g.lineWidth = o.lw * 0.9; g.stroke();
        }
        R.line(g, [[-r * 0.105, -r * 0.12], [r * 0.105, -r * 0.12]], o.lw * 0.75, o.ink);
        // Bigote breve, por encima de la boca.
        R.curve(g, [-r * 0.38, r * 0.22], [-r * 0.18, r * 0.39], [0, r * 0.27], o.lw * 1.25, o.ink);
        R.curve(g, [0, r * 0.27], [r * 0.18, r * 0.39], [r * 0.38, r * 0.22], o.lw * 1.25, o.ink);
      });
    },
  };
})();

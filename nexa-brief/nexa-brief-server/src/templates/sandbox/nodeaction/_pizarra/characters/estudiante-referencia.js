/* Personaje articulado para pizarra. Cabello y sudadera son parámetros de look.colors. */
(() => {
  "use strict";
  const R = Pizarra.rig;
  const stroke = (g, color, width) => { g.strokeStyle = color; g.lineWidth = width; g.lineCap = "round"; g.lineJoin = "round"; g.stroke(); };
  function face(g, r, kind, t, ink) {
    const w = r * 0.032;
    g.fillStyle = ink;
    for (const x of [-0.27, 0.27]) { g.beginPath(); g.ellipse(x*r, -0.02*r, 0.045*r, 0.075*r, 0, 0, Math.PI*2); g.fill(); }
    g.beginPath();
    if (kind === "worried" || kind === "think") {
      g.moveTo(-.20*r,.42*r); g.quadraticCurveTo(0,.30*r,.20*r,.42*r);
    } else if (kind === "shock" || kind === "talk") {
      g.ellipse(0,.40*r,.09*r,(kind === "shock" ? .15 : .08)*r,0,0,Math.PI*2);
    } else {
      g.moveTo(-.23*r,.33*r); g.quadraticCurveTo(0,.48*r,.23*r,.33*r);
    }
    stroke(g, ink, w);
    g.beginPath();
    if (kind === "worried") { g.moveTo(-.39*r,-.24*r); g.lineTo(-.16*r,-.30*r); g.moveTo(.16*r,-.30*r); g.lineTo(.39*r,-.24*r); }
    else { g.moveTo(-.39*r,-.23*r); g.quadraticCurveTo(-.27*r,-.28*r,-.16*r,-.23*r); g.moveTo(.16*r,-.23*r); g.quadraticCurveTo(.27*r,-.28*r,.39*r,-.23*r); }
    stroke(g, ink, w*.7);
    g.globalAlpha = .28; g.fillStyle = "#b9856d";
    for (const x of [-.50,.50]) { g.beginPath(); g.ellipse(x*r,.22*r,.10*r,.05*r,0,0,Math.PI*2); g.fill(); } g.globalAlpha = 1;
  }
  Pizarra.characters.estudianteReferencia = {
    name: "Estudiante articulado",
    scale: { head: 1.48 },
    draw(g, J, o) {
      const h=J.h, ink=o.ink, lw=h*.006, colors=o.look.colors || {};
      const shirt=colors.shirt || "#f4c531", hair=colors.hair || "#85442a", skin=colors.skin || "#fffaf4", accent=colors.accent || "#ed922d";
      const x=J.hip[0], hip=J.hip[1], top=J.neck[1]+h*.035;
      g.save();
      // Piernas sencillas y pies apoyados: el dibujo sigue las articulaciones del motor.
      for (const [leg,side] of [[J.legL,-1],[J.legR,1]]) {
        g.beginPath(); g.moveTo(x+side*h*.042, hip-h*.025); g.lineTo(leg[0][0],leg[0][1]); g.lineTo(leg[1][0],leg[1][1]); g.lineTo(leg[1][0]+side*h*.045,leg[1][1]); stroke(g,ink,lw*.72);
      }
      // Sudadera redondeada, sin la falda del personaje anterior.
      g.beginPath(); g.moveTo(x-h*.095,top); g.quadraticCurveTo(x-h*.135,top+h*.045,x-h*.12,hip+h*.015);
      g.quadraticCurveTo(x-h*.11,hip+h*.045,x,hip+h*.047); g.quadraticCurveTo(x+h*.11,hip+h*.045,x+h*.12,hip+h*.015);
      g.quadraticCurveTo(x+h*.135,top+h*.045,x+h*.095,top); g.closePath(); g.fillStyle=shirt; g.fill(); stroke(g,ink,lw);
      g.beginPath(); g.moveTo(x-h*.085,top+h*.045); g.quadraticCurveTo(x,top+h*.13,x+h*.085,top+h*.045); stroke(g,ink,lw*.6);
      g.beginPath(); g.moveTo(x-h*.013,top+h*.10); g.lineTo(x-h*.013,top+h*.16); g.moveTo(x+h*.013,top+h*.10); g.lineTo(x+h*.013,top+h*.16); stroke(g,ink,lw*.55);
      // Cabeza, flequillo y auriculares, en el marco que se inclina con la pose.
      const {r,tilt}=J.head; g.translate(J.head.x,J.head.y); g.rotate(tilt);
      g.beginPath(); g.ellipse(0,0,r*.93,r,0,0,Math.PI*2); g.fillStyle=skin; g.fill(); stroke(g,ink,lw);
      g.beginPath(); g.moveTo(-.91*r,-.36*r); g.quadraticCurveTo(-1.04*r,-1.01*r,-.48*r,-1.12*r); g.lineTo(-.57*r,-1.27*r);
      g.quadraticCurveTo(-.17*r,-1.17*r,.05*r,-1.24*r); g.lineTo(.13*r,-1.34*r); g.quadraticCurveTo(.85*r,-1.15*r,.96*r,-.42*r);
      g.quadraticCurveTo(.72*r,-.55*r,.55*r,-.59*r); g.quadraticCurveTo(.30*r,-.43*r,.03*r,-.60*r);
      g.quadraticCurveTo(-.28*r,-.43*r,-.53*r,-.58*r); g.quadraticCurveTo(-.72*r,-.48*r,-.91*r,-.36*r); g.closePath(); g.fillStyle=hair; g.fill(); stroke(g,ink,lw*.85);
      face(g,r,o.face,o.t,ink);
      // Auriculares alrededor del cuello, como en la referencia.
      g.beginPath(); g.moveTo(-.72*r,.84*r); g.quadraticCurveTo(0,1.35*r,.72*r,.84*r); stroke(g,ink,lw*2.2);
      for (const s of [-1,1]) { g.beginPath(); g.ellipse(s*.68*r,.91*r,.16*r,.21*r,0,0,Math.PI*2); g.fillStyle=accent; g.fill(); stroke(g,ink,lw*.7); }
      g.restore();
      // Manos bajas fuera de la sudadera; la mano pensativa se apoya en la barbilla.
      for (const [arm,side] of [[J.armL,-1],[J.armR,1]]) {
        const sx=J.sh[0]+side*h*.105, sy=top+h*.055, hand=[...arm[1]];
        if (side === 1 && o.face === "think") {
          const k=Math.max(0,Math.min(1,-(o.P.head || 0)/4));
          hand[0]+=(J.head.x+J.head.r*.42-hand[0])*k; hand[1]+=(J.head.y+J.head.r*.70-hand[1])*k;
        }
        else if (hand[1] > top+h*.20 && Math.abs(hand[0]-x) < h*.13) hand[0]=x+side*h*.14;
        arm[1]=hand; // Los objetos sostenidos usan la misma posición que la mano visible.
        const elbow=R.ik(sx,sy,hand[0],hand[1],h*.165,h*.165,side)[0];
        g.beginPath(); g.moveTo(sx,sy); g.quadraticCurveTo(elbow[0],elbow[1],hand[0],hand[1]); stroke(g,ink,lw*.75);
        g.beginPath(); g.ellipse(hand[0],hand[1],h*.012,h*.018,0,0,Math.PI*2); g.fillStyle=ink; g.fill();
      }
    }
  };
})();

/* Elementos reutilizables de pizarra editorial: panel y red de apoyo. */
(() => {
  "use strict";
  const R = Pizarra.rig;
  const { clamp } = Proto.U;
  const INK = "#23302f", GREEN = "#3d7a72", YELLOW = "#f4c84a";
  Object.assign(Pizarra.props, {
    panel(g, s, p) {
      const h = p.height || s * .62, radius = p.radius || 38;
      g.beginPath(); g.roundRect(-s/2, -h/2, s, h, radius);
      g.fillStyle = p.fill || "#f3f7f5"; g.fill();
      g.strokeStyle = p.stroke || "#e2ebe6"; g.lineWidth = 2; g.stroke();
      g.fillStyle = p.accent || GREEN;
      g.beginPath(); g.roundRect(-s/2 + 48, -h/2 + 44, 54, 7, 3.5); g.fill();
    },
    redApoyo(g, s, p, t, k) {
      const q = clamp((t-k._t0)/1.15), pts = [[-.31,-.05],[0,-.25],[.31,-.05],[-.17,.24],[.18,.24]];
      g.save(); g.strokeStyle = GREEN; g.lineWidth = s*.016; g.lineCap = "round";
      for (const [a,b] of [[0,1],[1,2],[0,3],[1,3],[1,4],[2,4],[3,4]]) {
        g.beginPath(); g.moveTo(pts[a][0]*s,pts[a][1]*s); g.lineTo((pts[a][0]+(pts[b][0]-pts[a][0])*q)*s,(pts[a][1]+(pts[b][1]-pts[a][1])*q)*s); g.stroke();
      }
      pts.forEach((v,i) => {
        const x=v[0]*s,y=v[1]*s,r=s*(i===1?.085:.065);
        g.beginPath(); g.arc(x,y,r,0,Math.PI*2); g.fillStyle=i===1?YELLOW:"#fff"; g.fill(); g.strokeStyle=INK; g.lineWidth=s*.015; g.stroke();
      }); g.restore();
    },
    ruta(g, s, p, t, k) {
      const q=clamp((t-k._t0)/1.8), n=5;
      g.save(); g.lineCap="round"; g.lineJoin="round"; g.strokeStyle="#a8c5b9"; g.lineWidth=s*.035;
      g.beginPath(); g.moveTo(-s*.42,s*.16); g.bezierCurveTo(-s*.20,-s*.12,s*.1,s*.23,s*.42,-s*.13); g.stroke();
      for(let i=0;i<n;i++) {
        const x=(-.38+i*.19)*s,y=(.10 - .18*i/(n-1)+Math.sin(i*.8)*.07)*s;
        g.globalAlpha=clamp(q*n-i); g.beginPath();g.arc(x,y,s*.048,0,Math.PI*2);g.fillStyle=i===n-1?YELLOW:GREEN;g.fill();
      }
      g.restore();
    },
    puerta(g, s, p, t, k) {
      const q=clamp((t-k._t0)/1.2);
      g.save(); g.lineJoin="round"; g.lineCap="round";
      g.strokeStyle=INK; g.lineWidth=s*.023; g.fillStyle="#fff";
      g.beginPath(); g.roundRect(-s*.24,-s*.36,s*.48,s*.72,s*.025); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-s*.20,-s*.32); g.lineTo(-s*.20,s*.32);
      g.lineTo(s*(.12+.09*q),s*(.27+.04*q)); g.lineTo(s*(.12+.09*q),-s*(.27+.04*q));
      g.closePath(); g.fillStyle="#dceee6"; g.fill(); g.stroke();
      g.beginPath(); g.arc(s*(.06+.09*q),0,s*.017,0,Math.PI*2); g.fillStyle=GREEN; g.fill();
      g.restore();
    }
  });
})();

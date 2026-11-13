// Editorial outline symbols, normalized to [-1, 1]. No badges or backgrounds.
// One stroke system keeps the small on-map symbols consistent at every scale.
const PI=Math.PI;
function path(g,points,close=false){g.beginPath();points.forEach(([x,y],i)=>(i?g.lineTo:g.moveTo).call(g,x,y));if(close)g.closePath();g.stroke();}
function circle(g,x,y,r){g.beginPath();g.arc(x,y,r,0,PI*2);g.stroke();}
const icons={
 db(g){
  g.beginPath();g.ellipse(0,-.58,.72,.25,0,0,PI*2);g.stroke();
  for(const y of [0,.58]){g.beginPath();g.moveTo(-.72,y-.1);g.bezierCurveTo(-.72,y+.26,.72,y+.26,.72,y-.1);g.stroke();}
  path(g,[[-.72,-.58],[-.72,.48]]);path(g,[[.72,-.58],[.72,.48]]);
 },
 eye(g){g.beginPath();g.moveTo(-.9,0);g.bezierCurveTo(-.45,-.72,.45,-.72,.9,0);g.bezierCurveTo(.45,.72,-.45,.72,-.9,0);g.closePath();g.stroke();circle(g,0,0,.24);},
 gavel(g){g.save();g.rotate(-PI/4);path(g,[[-.52,-.7],[.52,-.7],[.52,-.28],[-.52,-.28]],true);path(g,[[0,-.28],[0,.7]]);g.restore();path(g,[[-.76,.86],[.2,.86]]);},
 doc(g){path(g,[[-.58,-.86],[.15,-.86],[.58,-.43],[.58,.86],[-.58,.86]],true);path(g,[[.15,-.86],[.15,-.43],[.58,-.43]]);for(const y of [-.06,.25,.56])path(g,[[-.3,y],[.3,y]]);},
 shield(g){g.beginPath();g.moveTo(0,-.9);g.lineTo(.72,-.6);g.lineTo(.66,.06);g.bezierCurveTo(.62,.46,.27,.75,0,.9);g.bezierCurveTo(-.27,.75,-.62,.46,-.66,.06);g.lineTo(-.72,-.6);g.closePath();g.stroke();path(g,[[-.3,-.02],[-.08,.2],[.33,-.22]]);},
 bolt(g){path(g,[[.13,-.9],[-.57,.14],[-.06,.14],[-.14,.9],[.57,-.18],[.06,-.18]],true);},
 drop(g){g.beginPath();g.moveTo(0,-.9);g.bezierCurveTo(.18,-.54,.65,-.03,.65,.3);g.bezierCurveTo(.65,1.02,-.65,1.02,-.65,.3);g.bezierCurveTo(-.65,-.03,-.18,-.54,0,-.9);g.closePath();g.stroke();g.beginPath();g.arc(0,.27,.34,.25*PI,.78*PI);g.stroke();},
 chart(g){path(g,[[-.84,-.78],[-.84,.8],[.86,.8]]);path(g,[[-.56,.36],[-.16,-.02],[.16,.2],[.7,-.48]]);path(g,[[.3,-.48],[.7,-.48],[.7,-.08]]);},
 lock(g){g.beginPath();g.roundRect(-.62,-.08,1.24,.94,.14);g.stroke();g.beginPath();g.arc(0,-.1,.42,PI,0);g.stroke();circle(g,0,.28,.08);path(g,[[0,.36],[0,.55]]);},
 ban(g){circle(g,0,0,.84);path(g,[[-.59,-.59],[.59,.59]]);},
 vote(g){path(g,[[-.8,.08],[-.8,.84],[.8,.84],[.8,.08]]);path(g,[[-.45,.08],[.45,.08]]);g.save();g.rotate(-.22);path(g,[[-.37,-.9],[.37,-.9],[.37,-.06],[-.37,-.06]],true);path(g,[[-.19,-.5],[-.04,-.34],[.22,-.61]]);g.restore();},
 people(g){for(const x of [-.4,.4]){circle(g,x,-.43,.24);g.beginPath();g.arc(x,.7,.44,PI,PI*2);g.stroke();}},
 star(g){path(g,Array.from({length:10},(_,i)=>{const a=-PI/2+i*PI/5,r=i%2?.39:.9;return [Math.cos(a)*r,Math.sin(a)*r];}),true);},
 globe(g){circle(g,0,0,.84);g.beginPath();g.ellipse(0,0,.37,.84,0,0,PI*2);g.stroke();path(g,[[-.84,0],[.84,0]]);},
 drone(g){
  g.beginPath();g.roundRect(-.2,-.24,.4,.48,.09);g.stroke();
  for(const x of [-.64,.64])for(const y of [-.58,.58]){path(g,[[Math.sign(x)*.16,Math.sign(y)*.17],[x,y]]);circle(g,x,y,.24);path(g,[[x-.3,y],[x+.3,y]]);}
 },
 warn(g){path(g,[[0,-.88],[.88,.74],[-.88,.74]],true);path(g,[[0,-.3],[0,.18]]);circle(g,0,.45,.045);},
};
export const newsIconNames=Object.freeze(Object.keys(icons));
export function drawNewsIcon(g,name){g.lineWidth=.1;g.lineCap='round';g.lineJoin='round';(icons[name]||icons.globe)(g);}

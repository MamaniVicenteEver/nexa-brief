/* flags.js · banderas dibujadas en código (sin archivos ni red), para medallón o mástil.
 *
 * Interfaz (la usan layers.js y cualquier componente):
 *   Mapas.flags.draw(g, id, x, y, w, h, wave = 0, t = 0)   rectángulo (wave 0..1 = al viento)
 *   Mapas.flags.badge(g, id, x, y, r)                      medallón redondo con aro blanco
 *   Mapas.flags.ids()                                      ids disponibles
 * Datos de cada bandera (FLAGS[id]):
 *   h: [colores]  franjas horizontales (arriba → abajo) · v: [colores] franjas verticales
 *   ratio: [n…] proporción de cada franja (por defecto iguales)
 *   tri: { color, w } triángulo desde el asta (w = fracción del ancho)
 *   canton: { color, w, h } rectángulo arriba a la izquierda
 *   cross: { color, w, nordic? } cruz · disc: { color, r, x?, y? } círculo · star: { color, r, x?, y?, n? }
 *   emblem: (g, w, h) => {} dibujo propio simplificado (escudos: forma reconocible, sin detalle fino)
 */
(() => {
  "use strict";
  // Emblemas reducidos a formas legibles en el mapa; no intentan reproducir escudos finos.
  const em = {
    us(g, w, h) {
      g.fillStyle = "#3c3b6e"; g.fillRect(0, 0, w * 0.4, h * 7 / 13);
      g.fillStyle = "#ffffff";
      for (let row = 0; row < 9; row++) for (let col = 0; col < 11; col++) {
        if ((row % 2 === 0 && col % 2 === 0) || (row % 2 === 1 && col % 2 === 1)) {
          g.beginPath(); g.arc(w * (0.035 + col * 0.032), h * (0.045 + row * 0.038), h * 0.012, 0, Math.PI * 2); g.fill();
        }
      }
    },
    eu(g, w, h) {
      g.fillStyle = "#ffcc00";
      for (let i = 0; i < 12; i++) { const a = -Math.PI / 2 + i * Math.PI / 6; starPath(g, w * (0.5 + 0.23 * Math.cos(a)), h * (0.5 + 0.34 * Math.sin(a)), h * 0.055); g.fill(); }
    },
    maple(g, w, h) {
      g.fillStyle = "#d80621"; g.beginPath();
      const p = [[.5,.16],[.57,.34],[.72,.25],[.68,.43],[.82,.43],[.68,.57],[.72,.72],[.56,.66],[.55,.86],[.45,.86],[.44,.66],[.28,.72],[.32,.57],[.18,.43],[.32,.43],[.28,.25],[.43,.34]];
      p.forEach(([x,y],i)=>i?g.lineTo(x*w,y*h):g.moveTo(x*w,y*h)); g.closePath(); g.fill();
    },
    sun(g, w, h, color="#f7c843", cx=.5, cy=.5, r=.15) {
      g.fillStyle = color;
      for (let i=0;i<12;i++){const a=i*Math.PI/6, r1=r*.74, r2=r*1.35; g.beginPath();g.moveTo((cx+Math.cos(a)*r1)*w,(cy+Math.sin(a)*r1)*h);g.lineTo((cx+Math.cos(a-.09)*r2)*w,(cy+Math.sin(a-.09)*r2)*h);g.lineTo((cx+Math.cos(a+.09)*r2)*w,(cy+Math.sin(a+.09)*r2)*h);g.closePath();g.fill();}
      g.beginPath();g.arc(cx*w,cy*h,r*h,0,Math.PI*2);g.fill();
    },
    crescentStar(g,w,h,bg="#d21034",fg="#ffffff",cx=.40,cy=.5,r=.22) {
      g.fillStyle=fg;g.beginPath();g.arc(cx*w,cy*h,r*h,0,Math.PI*2);g.fill();
      g.fillStyle=bg;g.beginPath();g.arc((cx+r*.38)*w,cy*h,r*.82*h,0,Math.PI*2);g.fill();
      g.fillStyle=fg;starPath(g,(cx+r*1.18)*w,cy*h,r*.30*h);g.fill();
    },
    br(g,w,h) {
      g.fillStyle="#ffdf00";g.beginPath();g.moveTo(w*.5,h*.13);g.lineTo(w*.92,h*.5);g.lineTo(w*.5,h*.87);g.lineTo(w*.08,h*.5);g.closePath();g.fill();
      g.fillStyle="#002776";g.beginPath();g.arc(w*.5,h*.5,h*.24,0,Math.PI*2);g.fill();
      g.fillStyle="#ffffff";for(let i=0;i<9;i++){const a=-1.1+i*.28;g.beginPath();g.arc(w*(.5+.19*Math.cos(a)),h*(.5+.18*Math.sin(a)),h*.012,0,Math.PI*2);g.fill();}
    },
    ar(g,w,h){em.sun(g,w,h,"#f6b40e",.5,.5,.12);},
    uy(g,w,h){em.sun(g,w,h,"#f6b40e",.25,.25,.10);},
    py(g,w,h){g.strokeStyle="#0038a8";g.lineWidth=h*.05;g.beginPath();g.arc(w*.5,h*.5,h*.16,0,Math.PI*2);g.stroke();g.fillStyle="#ffffff";g.beginPath();g.arc(w*.5,h*.5,h*.115,0,Math.PI*2);g.fill();},
    co(g,w,h){g.fillStyle="#b21f2d";g.beginPath();g.arc(w*.5,h*.5,h*.12,0,Math.PI*2);g.fill();},
    ec(g,w,h){em.co(g,w,h);},
    gy(g,w,h){g.fillStyle="#fcd116";g.beginPath();g.moveTo(0,0);g.lineTo(w*.78,h*.5);g.lineTo(0,h);g.closePath();g.fill();g.fillStyle="#ffffff";g.beginPath();g.moveTo(0,0);g.lineTo(w*.42,h*.5);g.lineTo(0,h);g.closePath();g.fill();g.fillStyle="#ce1126";g.beginPath();g.moveTo(0,0);g.lineTo(w*.36,h*.5);g.lineTo(0,h);g.closePath();g.fill();g.fillStyle="#000000";g.beginPath();g.moveTo(0,0);g.lineTo(w*.22,h*.5);g.lineTo(0,h);g.closePath();g.fill();},
    sr(g,w,h){g.fillStyle="#377e3f";g.beginPath();g.moveTo(w*.5,h*.27);g.lineTo(w*.56,h*.46);g.lineTo(w*.76,h*.46);g.lineTo(w*.60,h*.58);g.lineTo(w*.67,h*.78);g.lineTo(w*.5,h*.65);g.lineTo(w*.33,h*.78);g.lineTo(w*.40,h*.58);g.lineTo(w*.24,h*.46);g.lineTo(w*.44,h*.46);g.closePath();g.fill();},
    ve(g,w,h){g.fillStyle="#ffffff";for(let i=0;i<8;i++){const a=-1.12+i*.32;starPath(g,w*(.5+.23*Math.cos(a)),h*(.5+.23*Math.sin(a)),h*.035);g.fill();}},
    gt(g,w,h){g.strokeStyle="#795548";g.lineWidth=h*.025;g.beginPath();g.arc(w*.5,h*.5,h*.19,0,Math.PI*2);g.stroke();em.sun(g,w,h,"#d4af37",.5,.5,.06);},
    ni(g,w,h){g.fillStyle="#ffffff";g.strokeStyle="#003893";g.lineWidth=h*.018;g.beginPath();g.moveTo(w*.5,h*.35);g.lineTo(w*.65,h*.60);g.lineTo(w*.35,h*.60);g.closePath();g.fill();g.stroke();g.fillStyle="#003893";g.beginPath();g.arc(w*.5,h*.48,h*.045,0,Math.PI*2);g.fill();},
    pa(g,w,h){g.fillStyle="#d21034";g.fillRect(w/2,0,w/2,h/2);g.fillStyle="#003893";g.fillRect(0,h/2,w/2,h/2);g.fillStyle="#003893";starPath(g,w*.25,h*.25,h*.12);g.fill();g.fillStyle="#d21034";starPath(g,w*.75,h*.75,h*.12);g.fill();},
    mx(g,w,h){g.fillStyle="#8b5a2b";g.beginPath();g.arc(w*.5,h*.5,h*.16,0,Math.PI*2);g.fill();g.fillStyle="#16843d";g.beginPath();g.arc(w*.47,h*.48,h*.11,0,Math.PI*2);g.fill();},
    cu(g,w,h){g.fillStyle="#cf142b";g.beginPath();g.moveTo(0,0);g.lineTo(w*.36,h*.5);g.lineTo(0,h);g.closePath();g.fill();g.fillStyle="#ffffff";starPath(g,w*.12,h*.5,h*.11);g.fill();},
    ag(g,w,h){g.fillStyle="#ffffff";g.fillRect(0,h*.70,w,h*.10);g.fillStyle="#0072c6";g.fillRect(0,h*.80,w,h*.20);g.fillStyle="#000000";g.beginPath();g.moveTo(w*.22,0);g.lineTo(w*.78,0);g.lineTo(w*.5,h*.58);g.closePath();g.fill();em.sun(g,w,h,"#f9d616",.5,.16,.12);},
    bs(g,w,h){g.fillStyle="#000000";g.beginPath();g.moveTo(0,0);g.lineTo(w*.33,h*.5);g.lineTo(0,h);g.closePath();g.fill();},
    bb(g,w,h){g.fillStyle="#f7d116";g.beginPath();g.moveTo(w*.50,h*.30);g.lineTo(w*.57,h*.50);g.lineTo(w*.53,h*.50);g.lineTo(w*.53,h*.73);g.lineTo(w*.47,h*.73);g.lineTo(w*.47,h*.50);g.lineTo(w*.43,h*.50);g.closePath();g.fill();},
    dm(g,w,h){g.strokeStyle="#fcd116";g.lineWidth=h*.13;g.beginPath();g.moveTo(0,h*.5);g.lineTo(w,h*.5);g.moveTo(w*.5,0);g.lineTo(w*.5,h);g.stroke();g.fillStyle="#d41c30";g.beginPath();g.arc(w*.5,h*.5,h*.19,0,Math.PI*2);g.fill();},
    do(g,w,h){g.fillStyle="#ffffff";g.fillRect(w*.43,0,w*.14,h);g.fillRect(0,h*.40,w,h*.20);g.fillStyle="#002d62";g.fillRect(0,0,w*.43,h*.4);g.fillRect(w*.57,0,w*.43,h*.4);g.fillRect(0,h*.6,w*.43,h*.4);g.fillRect(w*.57,h*.6,w*.43,h*.4);g.fillStyle="#ce1126";g.beginPath();g.arc(w*.5,h*.5,h*.07,0,Math.PI*2);g.fill();},
    ht(g,w,h){g.fillStyle="#ffffff";g.fillRect(w*.40,h*.35,w*.20,h*.30);g.strokeStyle="#003399";g.lineWidth=h*.03;g.strokeRect(w*.40,h*.35,w*.20,h*.30);},
    jm(g,w,h){g.fillStyle="#ffb81c";g.beginPath();g.moveTo(0,0);g.lineTo(w*.5,h*.5);g.lineTo(0,h);g.closePath();g.fill();g.beginPath();g.moveTo(w,0);g.lineTo(w*.5,h*.5);g.lineTo(w,h);g.closePath();g.fill();g.fillStyle="#000000";g.beginPath();g.moveTo(0,0);g.lineTo(w*.43,h*.5);g.lineTo(0,h);g.closePath();g.fill();g.beginPath();g.moveTo(w,0);g.lineTo(w*.57,h*.5);g.lineTo(w,h);g.closePath();g.fill();},
    kn(g,w,h){g.fillStyle="#ce1126";g.beginPath();g.moveTo(w*.76,0);g.lineTo(w,h*.12);g.lineTo(w,h);g.lineTo(w*.76,h);g.closePath();g.fill();g.strokeStyle="#fcd116";g.lineWidth=h*.14;g.beginPath();g.moveTo(w*.12,h*.94);g.lineTo(w*.88,h*.06);g.stroke();g.fillStyle="#ffffff";starPath(g,w*.39,h*.64,h*.07);g.fill();starPath(g,w*.60,h*.40,h*.07);g.fill();},
    lc(g,w,h){g.fillStyle="#fcd116";g.beginPath();g.moveTo(w*.5,h*.15);g.lineTo(w*.77,h*.75);g.lineTo(w*.23,h*.75);g.closePath();g.fill();g.fillStyle="#000000";g.beginPath();g.moveTo(w*.5,h*.32);g.lineTo(w*.68,h*.75);g.lineTo(w*.32,h*.75);g.closePath();g.fill();},
    vc(g,w,h){g.fillStyle="#fcd116";for(const [x,y] of [[.5,.5],[.46,.52],[.54,.52]]){g.beginPath();g.moveTo(w*x,h*(y-.10));g.lineTo(w*(x+.055),h*y);g.lineTo(w*x,h*(y+.10));g.lineTo(w*(x-.055),h*y);g.closePath();g.fill();}},
    tt(g,w,h){g.strokeStyle="#ffffff";g.lineWidth=h*.28;g.beginPath();g.moveTo(w*.08,h*.04);g.lineTo(w*.92,h*.96);g.stroke();g.strokeStyle="#000000";g.lineWidth=h*.16;g.beginPath();g.moveTo(w*.08,h*.04);g.lineTo(w*.92,h*.96);g.stroke();},
    bz(g,w,h){g.strokeStyle="#ffffff";g.lineWidth=h*.025;g.beginPath();g.arc(w*.5,h*.5,h*.2,0,Math.PI*2);g.stroke();g.fillStyle="#a71c31";g.fillRect(w*.47,h*.37,w*.06,h*.26);},
    kr(g,w,h){const cx=w*.5,cy=h*.5,r=h*.15;g.fillStyle="#ffffff";g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.fill();g.fillStyle="#cd2e3a";g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,r,Math.PI,Math.PI*2);g.closePath();g.fill();g.fillStyle="#0047a0";g.beginPath();g.moveTo(cx,cy);g.arc(cx,cy,r,0,Math.PI);g.closePath();g.fill();g.fillStyle="#0047a0";g.beginPath();g.arc(cx,cy-r/2,r/2,0,Math.PI*2);g.fill();g.fillStyle="#cd2e3a";g.beginPath();g.arc(cx,cy+r/2,r/2,0,Math.PI*2);g.fill();g.strokeStyle="#000000";g.lineWidth=h*.035;for(const [x,y,dx,dy] of [[.28,.33,.10,.03],[.72,.33,.10,.03],[.28,.67,.10,.03],[.72,.67,.10,.03]]){g.beginPath();g.moveTo(w*x,h*y);g.lineTo(w*(x+dx),h*(y+dy));g.stroke();}},
    in(g,w,h){g.strokeStyle="#128807";g.lineWidth=h*.012;g.beginPath();g.arc(w*.5,h*.5,h*.12,0,Math.PI*2);g.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(w*.5,h*.5);g.lineTo(w*(.5+.12*Math.cos(a)),h*(.5+.12*Math.sin(a)));g.stroke();}},
    pk(g,w,h){em.crescentStar(g,w,h,"#01411c","#ffffff",.63,.48,.20);},
    iq(g,w,h){g.fillStyle="#ffffff";for(let i=0;i<3;i++){g.beginPath();g.arc(w*(.42+i*.08),h*.5,h*.035,0,Math.PI*2);g.fill();}},
    il(g,w,h){g.strokeStyle="#0038b8";g.lineWidth=h*.025;for(const flip of [false,true]){g.beginPath();for(let i=0;i<3;i++){const a=-Math.PI/2+i*Math.PI*2/3,x=w*(.5+.15*Math.cos(flip?-a:a)),y=h*(.5+.27*Math.sin(flip?-a:a));i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();g.stroke();}},
    sa(g,w,h){em.crescentStar(g,w,h,"#006c35","#ffffff",.40,.63,.11);g.strokeStyle="#ffffff";g.lineWidth=h*.018;g.beginPath();g.moveTo(w*.23,h*.76);g.lineTo(w*.75,h*.76);g.stroke();g.fillStyle="#ffffff";for(let i=0;i<6;i++){g.fillRect(w*(.25+i*.075),h*.35,w*.045,h*.018);}},
    eg(g,w,h){g.fillStyle="#c09300";g.beginPath();g.moveTo(w*.43,h*.37);g.lineTo(w*.57,h*.37);g.lineTo(w*.62,h*.62);g.lineTo(w*.5,h*.70);g.lineTo(w*.38,h*.62);g.closePath();g.fill();},
    ma(g,w,h){g.strokeStyle="#006233";g.lineWidth=h*.035;g.beginPath();g.moveTo(w*.32,h*.67);g.lineTo(w*.68,h*.33);g.moveTo(w*.35,h*.45);g.lineTo(w*.46,h*.56);g.moveTo(w*.54,h*.44);g.lineTo(w*.64,h*.55);g.stroke();},
    dz(g,w,h){em.crescentStar(g,w,h,"#ffffff","#d21034",.54,.5,.14);},
    et(g,w,h){g.fillStyle="#0782c4";g.beginPath();g.arc(w*.5,h*.5,h*.14,0,Math.PI*2);g.fill();g.fillStyle="#fcd116";starPath(g,w*.5,h*.5,h*.085);g.fill();},
    ke(g,w,h){g.fillStyle="#000000";g.beginPath();g.ellipse(w*.5,h*.5,w*.13,h*.24,0,0,Math.PI*2);g.fill();g.fillStyle="#bb0000";g.beginPath();g.ellipse(w*.5,h*.5,w*.09,h*.20,0,0,Math.PI*2);g.fill();g.fillStyle="#ffffff";g.fillRect(w*.47,h*.29,w*.06,h*.42);},
    za(g,w,h){
      g.fillStyle="#ffffff";g.beginPath();g.moveTo(0,h*.23);g.lineTo(w*.38,h*.5);g.lineTo(0,h*.77);g.closePath();g.fill();
      g.fillStyle="#ffb612";g.beginPath();g.moveTo(0,h*.32);g.lineTo(w*.28,h*.5);g.lineTo(0,h*.68);g.closePath();g.fill();
      g.fillStyle="#007a4d";g.beginPath();g.moveTo(0,h*.42);g.lineTo(w*.16,h*.5);g.lineTo(0,h*.58);g.lineTo(0,h*.78);g.lineTo(w*.40,h*.5);g.lineTo(0,h*.22);g.closePath();g.fill();
      g.fillStyle="#de3831";g.fillRect(w*.4,0,w*.6,h*.49);g.fillStyle="#002395";g.fillRect(w*.4,h*.51,w*.6,h*.49);
    },
    tz(g,w,h){g.strokeStyle="#fcd116";g.lineWidth=h*.24;g.beginPath();g.moveTo(w*.12,h*.92);g.lineTo(w*.88,h*.08);g.stroke();g.strokeStyle="#000000";g.lineWidth=h*.14;g.beginPath();g.moveTo(w*.12,h*.92);g.lineTo(w*.88,h*.08);g.stroke();},
    ph(g,w,h){g.fillStyle="#fcd116";g.beginPath();g.moveTo(0,0);g.lineTo(w*.48,h*.5);g.lineTo(0,h);g.closePath();g.fill();em.sun(g,w,h,"#fcd116",.15,.5,.055);for(const [x,y] of [[.38,.25],[.38,.75],[.04,.5]]){g.fillStyle="#ffffff";starPath(g,w*x,h*y,h*.035);g.fill();}},
    au(g,w,h){g.save();g.beginPath();g.rect(0,0,w*.5,h*.5);g.clip();em.uk(g,w*.5,h*.5);g.restore();g.fillStyle="#ffffff";starPath(g,w*.73,h*.26,h*.075);g.fill();for(const [x,y,r] of [[.72,.72,.055],[.86,.56,.04],[.58,.73,.04],[.86,.86,.04],[.50,.55,.04]]){g.beginPath();g.arc(w*x,h*y,h*r,0,Math.PI*2);g.fill();}},
    nz(g,w,h){g.save();g.beginPath();g.rect(0,0,w*.5,h*.5);g.clip();em.uk(g,w*.5,h*.5);g.restore();g.strokeStyle="#ffffff";g.lineWidth=h*.025;for(const [x,y] of [[.70,.35],[.84,.51],[.68,.67],[.88,.77]]){g.beginPath();g.arc(w*x,h*y,h*.055,0,Math.PI*2);g.stroke();g.fillStyle="#c8102e";g.beginPath();g.arc(w*x,h*y,h*.036,0,Math.PI*2);g.fill();}},
    cn(g,w,h){g.fillStyle="#ffde00";starPath(g,w*.28,h*.28,h*.13);g.fill();for(const [x,y,a] of [[.50,.14,.15],[.58,.27,.40],[.57,.44,.68],[.48,.56,.92]]){g.save();g.translate(w*x,h*y);g.rotate(a);starPath(g,0,0,h*.045);g.fill();g.restore();}},
    uk(g,w,h){g.fillStyle="#ffffff";g.beginPath();g.moveTo(0,0);g.lineTo(w*.13,0);g.lineTo(w,h*.87);g.lineTo(w,h);g.lineTo(w*.87,h);g.lineTo(0,h*.13);g.closePath();g.fill();g.beginPath();g.moveTo(w*.87,0);g.lineTo(w,0);g.lineTo(w,h*.87);g.lineTo(w,h);g.lineTo(w*.87,h);g.lineTo(0,h*.13);g.lineTo(0,0);g.lineTo(w*.13,0);g.closePath();g.fill();g.fillStyle="#c8102e";g.beginPath();g.moveTo(0,0);g.lineTo(w*.08,0);g.lineTo(w,h*.92);g.lineTo(w,h);g.lineTo(w*.92,h);g.lineTo(0,h*.08);g.closePath();g.fill();g.beginPath();g.moveTo(w*.92,0);g.lineTo(w,0);g.lineTo(w,h*.08);g.lineTo(w,h);g.lineTo(w*.92,h);g.lineTo(0,h*.08);g.lineTo(0,0);g.lineTo(w*.08,0);g.closePath();g.fill();g.fillStyle="#ffffff";g.fillRect(w*.40,0,w*.20,h);g.fillRect(0,h*.35,w,h*.30);g.fillStyle="#c8102e";g.fillRect(w*.44,0,w*.12,h);g.fillRect(0,h*.41,w,h*.18);},
    de(g,w,h){g.strokeStyle="#ffce00";g.lineWidth=h*.025;g.beginPath();g.arc(w*.5,h*.5,h*.17,0,Math.PI*2);g.stroke();g.strokeStyle="#dd0000";g.lineWidth=h*.045;g.beginPath();g.moveTo(w*.5,h*.35);g.lineTo(w*.5,h*.57);g.moveTo(w*.5,h*.39);g.lineTo(w*.59,h*.48);g.moveTo(w*.5,h*.57);g.lineTo(w*.42,h*.66);g.stroke();},
    ottoman(g,w,h){em.crescentStar(g,w,h,"#e30a17","#ffffff",.38,.5,.21);},
    hr(g,w,h){g.fillStyle="#ffffff";for(let y=0;y<3;y++)for(let x=0;x<3;x++){g.fillStyle=(x+y)%2?"#ffffff":"#d80621";g.fillRect(w*(.40+x*.07),h*(.31+y*.09),w*.07,h*.09);}g.strokeStyle="#ffffff";g.lineWidth=h*.018;g.beginPath();g.moveTo(w*.40,h*.58);g.lineTo(w*.60,h*.58);g.stroke();},
    ba(g,w,h){g.fillStyle="#fcd116";g.beginPath();g.moveTo(w*.50,0);g.lineTo(w*.70,h);g.lineTo(w*.50,h);g.closePath();g.fill();for(let i=0;i<7;i++){g.fillStyle="#ffffff";starPath(g,w*(.79+i*.025),h*(.10+i*.11),h*.04);g.fill();}},
    al(g,w,h){g.fillStyle="#000000";g.beginPath();g.moveTo(w*.22,h*.55);g.lineTo(w*.38,h*.36);g.lineTo(w*.46,h*.45);g.lineTo(w*.5,h*.31);g.lineTo(w*.54,h*.45);g.lineTo(w*.62,h*.36);g.lineTo(w*.78,h*.55);g.lineTo(w*.66,h*.57);g.lineTo(w*.75,h*.73);g.lineTo(w*.56,h*.65);g.lineTo(w*.5,h*.82);g.lineTo(w*.44,h*.65);g.lineTo(w*.25,h*.73);g.lineTo(w*.34,h*.57);g.closePath();g.fill();},
    mk(g,w,h){em.sun(g,w,h,"#f7d116",.5,.5,.11);},
    cy(g,w,h){g.fillStyle="#d57800";g.beginPath();g.ellipse(w*.5,h*.48,w*.18,h*.11,-.16,0,Math.PI*2);g.fill();g.strokeStyle="#3b8f43";g.lineWidth=h*.012;g.beginPath();g.moveTo(w*.38,h*.64);g.quadraticCurveTo(w*.5,h*.79,w*.64,h*.63);g.stroke();},
    ge(g,w,h){g.fillStyle="#d40000";g.fillRect(w*.45,0,w*.10,h);g.fillRect(0,h*.40,w,h*.20);for(const [x,y] of [[.22,.22],[.78,.22],[.22,.78],[.78,.78]]){g.fillRect(w*(x-.035),h*(y-.07),w*.07,h*.14);g.fillRect(w*(x-.07),h*(y-.035),w*.14,h*.07);}},
    xk(g,w,h){g.fillStyle="#f6d21a";g.beginPath();g.moveTo(w*.48,h*.38);g.lineTo(w*.56,h*.38);g.lineTo(w*.60,h*.58);g.lineTo(w*.51,h*.68);g.lineTo(w*.43,h*.56);g.closePath();g.fill();for(let i=0;i<6;i++){const a=-Math.PI/2+i*Math.PI/3;g.fillStyle="#ffffff";g.beginPath();g.arc(w*(.5+.30*Math.cos(a)),h*(.5+.30*Math.sin(a)),h*.022,0,Math.PI*2);g.fill();}},
    auh(g,w,h){g.fillStyle="#ffd100";g.fillRect(w*.45,h*.4,w*.1,h*.2);},
    np(g,w,h){g.fillStyle="#dc143c";g.beginPath();g.moveTo(0,0);g.lineTo(w*.62,h*.38);g.lineTo(w*.22,h*.38);g.lineTo(w*.83,h);g.lineTo(0,h);g.closePath();g.fill();g.strokeStyle="#003893";g.lineWidth=h*.035;g.stroke();g.fillStyle="#ffffff";g.beginPath();g.arc(w*.21,h*.28,h*.055,0,Math.PI*2);g.fill();g.beginPath();g.arc(w*.38,h*.69,h*.07,0,Math.PI*2);g.fill();},
    mg(g,w,h){g.fillStyle="#d21034";g.fillRect(w*.43,h*.42,w*.14,h*.16);g.strokeStyle="#006233";g.lineWidth=h*.025;g.beginPath();g.moveTo(w*.5,h*.36);g.lineTo(w*.5,h*.64);g.stroke();},
    my(g,w,h){em.crescentStar(g,w,h,"#010066","#ffcc00",.37,.25,.16);},
    sg(g,w,h){em.crescentStar(g,w,h,"#ed2939","#ffffff",.29,.31,.14);for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;g.fillStyle="#ffffff";starPath(g,w*(.36+.10*Math.cos(a)),h*(.31+.10*Math.sin(a)),h*.025);g.fill();}},
    vn(g,w,h){g.fillStyle="#ffde00";starPath(g,w*.5,h*.5,h*.24);g.fill();},
    th(g,w,h){g.fillStyle="#ffffff";g.fillRect(0,h*.30,w,h*.40);g.fillStyle="#2d2a4a";g.fillRect(0,h*.40,w,h*.20);},
    kh(g,w,h){g.fillStyle="#ffffff";g.beginPath();g.moveTo(w*.32,h*.61);g.lineTo(w*.5,h*.35);g.lineTo(w*.68,h*.61);g.closePath();g.fill();g.fillRect(w*.37,h*.60,w*.26,h*.08);},
    lk(g,w,h){g.fillStyle="#ffb700";g.strokeStyle="#ffb700";g.lineWidth=h*.035;g.strokeRect(w*.38,h*.18,w*.38,h*.64);g.fillStyle="#ffb700";g.beginPath();g.arc(w*.55,h*.5,h*.11,0,Math.PI*2);g.fill();},
    ir(g,w,h){g.fillStyle="#da0000";g.beginPath();g.moveTo(w*.5,h*.37);g.lineTo(w*.56,h*.47);g.lineTo(w*.64,h*.47);g.lineTo(w*.58,h*.54);g.lineTo(w*.61,h*.65);g.lineTo(w*.5,h*.58);g.lineTo(w*.39,h*.65);g.lineTo(w*.42,h*.54);g.lineTo(w*.36,h*.47);g.lineTo(w*.44,h*.47);g.closePath();g.fill();},
    sd(g,w,h){g.fillStyle="#007a3d";for(const x of [.43,.57]){starPath(g,w*x,h*.5,h*.09);g.fill();}},
    twh(g,w,h){g.fillStyle="#ff0000";g.fillRect(w*.50,0,w*.50,h*.5);g.fillStyle="#000095";g.fillRect(0,0,w*.5,h*.5);g.fillStyle="#ffffff";g.beginPath();g.arc(w*.25,h*.25,h*.11,0,Math.PI*2);g.fill();},
    ci(g,w,h){g.fillStyle="#f77f00";g.beginPath();g.arc(w*.5,h*.5,h*.12,0,Math.PI*2);g.fill();},
    bo(g,w,h){g.fillStyle="#000000";g.beginPath();g.arc(w*.5,h*.5,h*.17,0,Math.PI*2);g.fill();},
    rw(g,w,h){g.fillStyle="#f1f1f1";g.beginPath();g.arc(w*.5,h*.5,h*.15,0,Math.PI*2);g.fill();},
    zm(g,w,h){g.fillStyle="#ef7d00";g.beginPath();g.moveTo(w*.76,h*.62);g.lineTo(w*.89,h*.60);g.lineTo(w*.78,h*.84);g.closePath();g.fill();},
    hn(g,w,h){g.fillStyle="#0073cf";for(const [x,y] of [[.42,.43],[.50,.43],[.58,.43],[.46,.57],[.54,.57]]){starPath(g,w*x,h*y,h*.045);g.fill();}},
    gr(g,w,h){g.fillStyle="#0d5eaf";g.fillRect(0,0,w*.38,h*.48);g.fillStyle="#ffffff";g.fillRect(w*.13,0,w*.12,h*.48);g.fillRect(0,h*.17,w*.38,h*.14);},
    hk(g,w,h){g.fillStyle="#ffffff";for(let i=0;i<5;i++){const a=-Math.PI/2+i*Math.PI*2/5;g.beginPath();g.arc(w*(.5+.13*Math.cos(a)),h*(.5+.13*Math.sin(a)),h*.08,0,Math.PI*2);g.fill();}g.beginPath();g.arc(w*.5,h*.5,h*.06,0,Math.PI*2);g.fill();},
    my(g,w,h){g.fillStyle="#010066";g.fillRect(0,0,w*.5,h*.5);em.crescentStar(g,w,h,"#010066","#ffcc00",.25,.25,.15);g.fillStyle="#ffcc00";for(let i=0;i<14;i++){const a=-Math.PI/2+i*Math.PI*2/14;starPath(g,w*(.25+.20*Math.cos(a)),h*(.25+.20*Math.sin(a)),h*.022);g.fill();}},
    az(g,w,h){em.crescentStar(g,w,h,"#ef3340","#ffffff",.42,.5,.15);},
    kp(g,w,h){g.fillStyle="#ffffff";g.beginPath();g.arc(w*.30,h*.5,h*.12,0,Math.PI*2);g.fill();g.fillStyle="#ed1c27";starPath(g,w*.30,h*.5,h*.075);g.fill();},
    mt(g,w,h){g.strokeStyle="#cf142b";g.lineWidth=h*.035;g.beginPath();g.moveTo(w*.12,h*.18);g.lineTo(w*.27,h*.18);g.moveTo(w*.195,h*.105);g.lineTo(w*.195,h*.255);g.stroke();},
    li(g,w,h){g.fillStyle="#ffd700";g.beginPath();g.moveTo(w*.70,h*.31);g.lineTo(w*.76,h*.43);g.lineTo(w*.70,h*.55);g.lineTo(w*.62,h*.55);g.lineTo(w*.62,h*.31);g.closePath();g.fill();},
    me(g,w,h){g.fillStyle="#c9a23f";g.beginPath();g.moveTo(w*.5,h*.30);g.lineTo(w*.38,h*.46);g.lineTo(w*.25,h*.38);g.lineTo(w*.32,h*.65);g.lineTo(w*.5,h*.77);g.lineTo(w*.68,h*.65);g.lineTo(w*.75,h*.38);g.lineTo(w*.62,h*.46);g.closePath();g.fill();},
    sm(g,w,h){g.strokeStyle="#167b3e";g.lineWidth=h*.025;g.beginPath();g.arc(w*.5,h*.5,h*.15,0,Math.PI*2);g.stroke();g.fillStyle="#d4af37";g.beginPath();g.arc(w*.5,h*.5,h*.09,0,Math.PI*2);g.fill();},
    va(g,w,h){g.strokeStyle="#d4af37";g.lineWidth=h*.035;g.beginPath();g.moveTo(w*.5,h*.34);g.lineTo(w*.5,h*.65);g.moveTo(w*.39,h*.46);g.lineTo(w*.61,h*.46);g.stroke();},
    bn(g,w,h){g.strokeStyle="#ffffff";g.lineWidth=h*.26;g.beginPath();g.moveTo(w*.08,h*.1);g.lineTo(w*.92,h*.9);g.stroke();g.strokeStyle="#000000";g.lineWidth=h*.18;g.beginPath();g.moveTo(w*.08,h*.1);g.lineTo(w*.92,h*.9);g.stroke();g.fillStyle="#d21034";g.beginPath();g.arc(w*.5,h*.5,h*.12,0,Math.PI*2);g.fill();},
    ussr(g,w,h){g.fillStyle="#ffd700";starPath(g,w*.20,h*.25,h*.12);g.fill();g.strokeStyle="#ffd700";g.lineWidth=h*.028;g.beginPath();g.arc(w*.20,h*.28,h*.14,Math.PI*.78,Math.PI*1.85);g.moveTo(w*.20,h*.43);g.lineTo(w*.20,h*.70);g.lineTo(w*.31,h*.78);g.moveTo(w*.20,h*.59);g.lineTo(w*.10,h*.77);g.stroke();},
    mo(g,w,h){g.strokeStyle="#006233";g.lineWidth=h*.035;g.beginPath();for(let i=0;i<5;i++){const a=-Math.PI/2+i*4*Math.PI/5,x=w*(.5+.20*Math.cos(a)),y=h*(.5+.32*Math.sin(a));i?g.lineTo(x,y):g.moveTo(x,y);}g.closePath();g.stroke();},
    mn(g,w,h){g.fillStyle="#f9cf02";g.beginPath();g.arc(w*.5,h*.33,h*.075,0,Math.PI*2);g.fill();g.fillRect(w*.455,h*.39,w*.09,h*.28);g.fillRect(w*.39,h*.68,w*.22,h*.035);g.fillRect(w*.42,h*.75,w*.16,h*.035);g.fillRect(w*.43,h*.81,w*.14,h*.035);},
    in(g,w,h){g.strokeStyle="#128807";g.lineWidth=h*.012;g.beginPath();g.arc(w*.5,h*.5,h*.12,0,Math.PI*2);g.stroke();for(let i=0;i<12;i++){const a=i*Math.PI/6;g.beginPath();g.moveTo(w*.5,h*.5);g.lineTo(w*(.5+.12*Math.cos(a)),h*(.5+.12*Math.sin(a)));g.stroke();}},
    ps(g,w,h){g.fillStyle="#000000";g.beginPath();g.moveTo(0,0);g.lineTo(w*.36,h*.5);g.lineTo(0,h);g.closePath();g.fill();},
    gd(g,w,h){g.fillStyle="#007a5e";g.fillRect(w*.10,h*.12,w*.80,h*.76);g.fillStyle="#fcd116";g.fillRect(w*.10,h*.39,w*.80,h*.22);for(let i=0;i<6;i++){const x=w*(.18+i*.128);starPath(g,x,h*.07,h*.035);g.fill();starPath(g,x,h*.93,h*.035);g.fill();}starPath(g,w*.50,h*.5,h*.09);g.fill();g.fillStyle="#ce1126";g.beginPath();g.moveTo(w*.10,h*.25);g.lineTo(w*.32,h*.5);g.lineTo(w*.10,h*.75);g.closePath();g.fill();},
    by(g,w,h){g.fillStyle="#ffffff";g.fillRect(0,0,w*.14,h);g.fillStyle="#d22730";for(let i=0;i<7;i++){g.fillRect(w*.035,h*(.04+i*.13),w*.07,h*.055);g.fillRect(w*.07,h*(.055+i*.13),w*.035,h*.035);}},
    cd(g,w,h){g.strokeStyle="#f7d618";g.lineWidth=h*.29;g.beginPath();g.moveTo(w*.12,h*.9);g.lineTo(w*.88,h*.1);g.stroke();g.strokeStyle="#ce1021";g.lineWidth=h*.19;g.beginPath();g.moveTo(w*.12,h*.9);g.lineTo(w*.88,h*.1);g.stroke();},
    mz(g,w,h){g.fillStyle="#ffffff";g.fillRect(0,h*.31,w,h*.06);g.fillStyle="#000000";g.fillRect(0,h*.37,w,h*.22);g.fillStyle="#ffffff";g.fillRect(0,h*.59,w,h*.06);g.fillStyle="#fce100";g.fillRect(0,h*.65,w,h*.35);g.fillStyle="#d21034";g.beginPath();g.moveTo(0,0);g.lineTo(w*.40,h*.5);g.lineTo(0,h);g.closePath();g.fill();g.fillStyle="#fce100";starPath(g,w*.16,h*.5,h*.10);g.fill();},
    tz2(g,w,h){em.tz(g,w,h);},
  };
  const FLAGS = {
    de: { h: ["#000000", "#dd0000", "#ffce00"] },
    ddr: { h: ["#000000", "#dd0000", "#ffce00"], emblem: em.de },
    hu: { h: ["#ce2939", "#ffffff", "#477050"] },
    at: { h: ["#ed2939", "#ffffff", "#ed2939"] },
    pl: { h: ["#ffffff", "#dc143c"] },
    cs: { h: ["#ffffff", "#d7141a"], tri: { color: "#11457e", w: 0.5 } },
    bo: { h: ["#d52b1e", "#f9e300", "#007934"] },
    cl: { h: ["#ffffff", "#d52b1e"], canton: { color: "#0039a6", w: 0.333, h: 0.5 }, star: { color: "#ffffff", r: 0.12, x: 0.1667, y: 0.25 } },
    pe: { v: ["#d91023", "#ffffff", "#d91023"] },
    // América del Norte, Centroamérica, Sudamérica y el Caribe.
    ag: { h: ["#ce1126"], emblem: em.ag }, ar: { h: ["#74acdf", "#ffffff", "#74acdf"], emblem: em.ar },
    bb: { v: ["#00267f", "#ffc726", "#00267f"], emblem: em.bb }, bs: { h: ["#00abc9", "#fcd116", "#00abc9"], emblem: em.bs },
    bz: { h: ["#ce1126", "#003f87", "#ce1126"], ratio: [1, 8, 1], emblem: em.bz },
    br: { bg: "#009739", emblem: em.br }, ca: { v: ["#d80621", "#ffffff", "#d80621"], ratio: [1, 2, 1], emblem: em.maple },
    co: { h: ["#fcd116", "#003893", "#ce1126"], ratio: [2, 1, 1] }, cr: { h: ["#002b7f", "#ffffff", "#ce1126", "#ffffff", "#002b7f"], ratio: [1, 1, 2, 1, 1] },
    cu: { h: ["#002a8f", "#ffffff", "#002a8f", "#ffffff", "#002a8f"], emblem: em.cu },
    dm: { bg: "#006b3f", emblem: em.dm }, do: { bg: "#ffffff", emblem: em.do },
    ec: { h: ["#ffdd00", "#034ea2", "#ed1c24"], ratio: [2, 1, 1], emblem: em.ec },
    sv: { h: ["#0047ab", "#ffffff", "#0047ab"], emblem: em.ni }, gd: { bg: "#ce1126", emblem: em.gd },
    gt: { v: ["#4997d0", "#ffffff", "#4997d0"], emblem: em.gt }, gy: { bg: "#009e49", emblem: em.gy }, ht: { h: ["#00209f", "#d21034"], emblem: em.ht },
    hn: { h: ["#0073cf", "#ffffff", "#0073cf"], emblem: em.hn }, jm: { bg: "#009b3a", emblem: em.jm },
    mx: { v: ["#006847", "#ffffff", "#ce1126"], emblem: em.mx }, ni: { h: ["#0067c6", "#ffffff", "#0067c6"], emblem: em.ni },
    pa: { bg: "#ffffff", emblem: em.pa }, py: { h: ["#d52b1e", "#ffffff", "#0038a8"], emblem: em.py },
    pr: { h: ["#ed0000", "#ffffff", "#ed0000", "#ffffff", "#ed0000"], emblem: em.cu },
    kn: { bg: "#009739", emblem: em.kn }, lc: { bg: "#66ccff", emblem: em.lc }, vc: { h: ["#0057b8", "#fcd116", "#007a3d"], ratio: [3, 2, 1], emblem: em.vc },
    sr: { h: ["#377e3f", "#ffffff", "#b40a2d", "#ffffff", "#377e3f"], ratio: [2, 1, 4, 1, 2], emblem: em.sr },
    tt: { bg: "#ce1126", emblem: em.tt }, us: { h: ["#b22234", "#ffffff", "#b22234", "#ffffff", "#b22234", "#ffffff", "#b22234", "#ffffff", "#b22234", "#ffffff", "#b22234", "#ffffff", "#b22234"], emblem: em.us },
    uy: { h: ["#ffffff", "#0038a8", "#ffffff", "#0038a8", "#ffffff", "#0038a8", "#ffffff", "#0038a8", "#ffffff"], emblem: em.uy },
    ve: { h: ["#f4c300", "#0033a0", "#cf142b"], emblem: em.ve },
    // Europa completa, incluidas las banderas nacionales balcánicas y los microestados.
    eu: { bg: "#003399", emblem: em.eu }, al: { bg: "#e41e20", emblem: em.al }, ad: { v: ["#10069f", "#fedd00", "#d50000"], emblem: em.co },
    am: { h: ["#d90012", "#0033a0", "#f2a800"] }, az: { h: ["#00b5e2", "#ef3340", "#509e2f"], emblem: em.az },
    by: { h: ["#d22730", "#007d2c"], ratio: [2, 1], emblem: em.by }, be: { v: ["#000000", "#fae042", "#ed2939"] },
    ba: { bg: "#002395", emblem: em.ba }, bg: { h: ["#ffffff", "#00966e", "#d62612"] },
    hr: { h: ["#ff0000", "#ffffff", "#171796"], emblem: em.hr }, cy: { bg: "#ffffff", emblem: em.cy },
    cz: { h: ["#ffffff", "#d7141a"], tri: { color: "#11457e", w: 0.5 } }, dk: { bg: "#c8102e", cross: { color: "#ffffff", w: 0.18, nordic: true } },
    ee: { h: ["#4891d9", "#000000", "#ffffff"] }, fi: { bg: "#ffffff", cross: { color: "#003580", w: 0.18, nordic: true } },
    fr: { v: ["#0055a4", "#ffffff", "#ef4135"] },
    gr: { h: ["#0d5eaf", "#ffffff", "#0d5eaf", "#ffffff", "#0d5eaf", "#ffffff", "#0d5eaf", "#ffffff", "#0d5eaf"], emblem: em.gr },
    is: { bg: "#003897", cross: { color: "#ffffff", w: 0.22, nordic: true } },
    ie: { v: ["#169b62", "#ffffff", "#ff883e"] }, it: { v: ["#009246", "#ffffff", "#ce2b37"] },
    lv: { h: ["#9e3039", "#ffffff", "#9e3039"], ratio: [2, 1, 2] }, li: { h: ["#002b7f", "#ce1126"], emblem: em.li },
    lt: { h: ["#fdb913", "#006a44", "#c1272d"] }, lu: { h: ["#ed2939", "#ffffff", "#00a1de"] },
    mt: { v: ["#ffffff", "#cf142b"], emblem: em.mt }, md: { v: ["#0033a0", "#ffde00", "#cc092f"], emblem: em.eg },
    mc: { h: ["#ce1126", "#ffffff"] }, me: { bg: "#c8102e", emblem: em.me },
    nl: { h: ["#ae1c28", "#ffffff", "#21468b"] }, mk: { bg: "#d20000", emblem: em.mk },
    no: { bg: "#ba0c2f", cross: { color: "#ffffff", w: 0.22, nordic: true }, emblem: (g,w,h)=>{g.fillStyle="#00205b";g.fillRect(w*.30,0,w*.09,h);g.fillRect(0,h*.42,w,h*.16);} },
    pt: { v: ["#006600", "#ff0000"], ratio: [2, 3], emblem: em.eg },
    ro: { v: ["#002b7f", "#fcd116", "#ce1126"] }, ru: { h: ["#ffffff", "#0039a6", "#d52b1e"] },
    sm: { h: ["#5eb6e4", "#ffffff"], emblem: em.sm }, rs: { h: ["#c6363c", "#0c4076", "#ffffff"], emblem: em.hr },
    sk: { h: ["#ffffff", "#0b4ea2", "#ee1c25"], emblem: em.eg }, si: { h: ["#ffffff", "#005da4", "#ed1c24"], emblem: em.eg },
    es: { h: ["#aa151b", "#f1bf00", "#aa151b"], ratio: [1, 2, 1], emblem: em.eg }, se: { bg: "#006aa7", cross: { color: "#fecc00", w: 0.18, nordic: true } },
    ch: { bg: "#d52b1e", cross: { color: "#ffffff", w: 0.28 } }, ua: { h: ["#0057b7", "#ffd700"] },
    gb: { bg: "#012169", emblem: em.uk }, va: { v: ["#ffe000", "#ffffff"], emblem: em.va },
    tr: { bg: "#e30a17", emblem: em.ottoman }, xk: { bg: "#244aa5", emblem: em.xk },
    // Asia y Oceanía: banderas de mayor relevancia histórica y geográfica.
    af: { v: ["#000000", "#d32011", "#007a36"] }, bd: { bg: "#006a4e", disc: { color: "#f42a41", r: 0.2, x: 0.45 } },
    bn: { bg: "#f7e017", emblem: em.bn }, kh: { h: ["#032ea1", "#e00025", "#032ea1"], ratio: [1, 2, 1], emblem: em.kh },
    cn: { bg: "#de2910", emblem: em.cn }, hk: { bg: "#de2910", emblem: em.hk }, id: { h: ["#ce1126", "#ffffff"] }, in: { h: ["#ff9933", "#ffffff", "#138808"], emblem: em.in },
    ir: { h: ["#239f40", "#ffffff", "#da0000"], emblem: em.ir }, iq: { h: ["#ce1126", "#ffffff", "#000000"], emblem: em.iq },
    il: { h: ["#ffffff", "#0038b8", "#ffffff", "#0038b8", "#ffffff"], ratio: [1, 1, 2, 1, 1], emblem: em.il }, ps: { h: ["#000000", "#ffffff", "#007a3d"], emblem: em.ps },
    jp: { bg: "#ffffff", disc: { color: "#bc002d", r: 0.3 } }, kp: { h: ["#024fa2", "#ffffff", "#ed1c27", "#ffffff", "#024fa2"], ratio: [1, .1, 2, .1, 1], emblem: em.kp },
    kr: { bg: "#ffffff", emblem: em.kr }, my: { h: ["#cc0000", "#ffffff", "#cc0000", "#ffffff", "#cc0000", "#ffffff", "#cc0000", "#ffffff", "#cc0000", "#ffffff", "#cc0000", "#ffffff", "#cc0000", "#ffffff", "#cc0000"], emblem: em.my },
    mn: { v: ["#c4272f", "#015197", "#c4272f"], emblem: em.mn }, mm: { h: ["#fecb00", "#34b233", "#ea2839"], star: { color: "#ffffff", r: .18 } },
    np: { bg: "#003893", emblem: em.np }, pk: { v: ["#ffffff", "#01411c"], ratio: [1, 3], emblem: em.pk },
    ph: { h: ["#0038a8", "#ce1126"], emblem: em.ph }, sa: { bg: "#006c35", emblem: em.sa },
    sg: { h: ["#ed2939", "#ffffff"], emblem: em.sg }, lk: { bg: "#ffb700", emblem: em.lk },
    sy: { h: ["#ce1126", "#ffffff", "#000000"], emblem: em.sd }, th: { h: ["#a51931", "#f4f5f8", "#2d2a4a", "#f4f5f8", "#a51931"], ratio: [1, 1, 2, 1, 1] },
    vn: { bg: "#da251d", emblem: em.vn }, tw: { bg: "#fe0000", emblem: em.twh },
    ae: { h: ["#00732f", "#ffffff", "#000000"], tri: { color: "#ff0000", w: 0.25 } }, au: { bg: "#00008b", canton: { color: "#012169", w: .5, h: .5 }, emblem: em.au },
    nz: { bg: "#00247d", canton: { color: "#012169", w: .5, h: .5 }, emblem: em.nz },
    // África: países solicitados y otras banderas regionales frecuentes.
    dz: { v: ["#006633", "#ffffff"], emblem: em.dz }, eg: { h: ["#ce1126", "#ffffff", "#000000"], emblem: em.eg },
    et: { h: ["#078930", "#fcd116", "#da121a"], emblem: em.et }, gh: { h: ["#ce1126", "#fcd116", "#006b3f"], star: { color: "#000000", r: .11 } },
    ke: { h: ["#000000", "#ffffff", "#bb0000", "#ffffff", "#006600"], ratio: [2, .15, 3, .15, 2], emblem: em.ke },
    ma: { bg: "#c1272d", emblem: em.mo }, ng: { v: ["#008751", "#ffffff", "#008751"] },
    za: { bg: "#de3831", emblem: em.za },
    bw: { h: ["#75aadb", "#ffffff", "#000000", "#ffffff", "#75aadb"], ratio: [4, .25, 1, .25, 4] },
    cm: { v: ["#007a5e", "#ce1126", "#fcd116"], star: { color: "#fcd116", r: .09 } },
    cd: { bg: "#007fff", emblem: em.cd }, ci: { v: ["#f77f00", "#ffffff", "#009e60"] },
    ly: { h: ["#e70013", "#000000", "#239e46"], ratio: [1, 2, 1], emblem: em.ottoman },
    ml: { v: ["#14b53a", "#fcd116", "#ce1126"] }, mr: { h: ["#ce1126", "#006233", "#ce1126"], emblem: em.sr },
    mz: { bg: "#009739", emblem: em.mz },
    ne: { h: ["#e05206", "#ffffff", "#0db02b"], disc: { color: "#e05206", r: .16 } }, rw: { h: ["#00a1de", "#fad201", "#20603d"], ratio: [2, 1, 1], star: { color: "#e5be01", r: .09 } },
    sn: { v: ["#00853f", "#fdef42", "#e31b23"], star: { color: "#00853f", r: .08 } }, sd: { h: ["#d21034", "#ffffff", "#000000"], tri: { color: "#007229", w: .34 } },
    tz: { bg: "#1eb53a", emblem: em.tz }, tn: { h: ["#e70013"], disc: { color: "#ffffff", r: .29 }, emblem: em.ottoman },
    ug: { h: ["#000000", "#fcdc04", "#d90000", "#000000", "#fcdc04", "#d90000"] }, zm: { h: ["#198a00"], emblem: em.zm },
    zw: { h: ["#006400", "#ffd200", "#d40000", "#000000", "#d40000", "#ffd200", "#006400"] },
    // Seis históricas pedidas: DDR y Checoslovaquia se conservan arriba.
    ussr: { bg: "#cc0000", emblem: em.ussr }, yu: { h: ["#d00c27", "#164f9a", "#ffffff"], star: { color: "#f4c430", r: .15 } },
    ottoman: { bg: "#e30a17", emblem: em.ottoman }, "de-empire": { h: ["#000000", "#ffffff", "#d00000"] },
  };

  function draw(g, id, x, y, w, h, wave = 0, t = 0) {
    const F = FLAGS[id] || FLAGS.de, n = wave ? 18 : 1;
    // se dibuja una vez en un lienzo chico y se corta en tiras verticales con onda (bandera al viento)
    const off = flagCanvas(id, F, Math.max(8, Math.round(w)), Math.max(6, Math.round(h)));
    for (let i = 0; i < n; i++) {
      const u0 = i / n, sw = w / n, dy = wave ? Math.sin(u0 * 5 - t * 5) * h * 0.06 * u0 : 0;
      g.drawImage(off, (u0 * off.width), 0, off.width / n + 0.5, off.height, x + u0 * w, y + dy, sw + 0.6, h);
      if (wave) { g.fillStyle = `rgba(0,0,0,${0.12 * (0.5 + 0.5 * Math.sin(u0 * 5 - t * 5 + 1.4)) * u0})`; g.fillRect(x + u0 * w, y + dy, sw + 0.6, h); }
    }
  }
  const CACHE = new Map();
  function flagCanvas(id, F, w, h) {
    const key = id + w + "x" + h; if (CACHE.has(key)) return CACHE.get(key);
    const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d");
    paint(g, F, w, h); CACHE.set(key, c); return c;
  }
  function stripes(g, cols, ratio, w, h, vertical) {
    const tot = (ratio || cols.map(() => 1)).reduce((a, b) => a + b, 0); let acc = 0;
    cols.forEach((col, i) => { const r = (ratio ? ratio[i] : 1) / tot; g.fillStyle = col; if (vertical) g.fillRect(acc * w, 0, r * w + 0.5, h); else g.fillRect(0, acc * h, w, r * h + 0.5); acc += r; });
  }
  function starPath(g, cx, cy, r, n = 5) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const rr = i % 2 ? r * 0.4 : r, an = -Math.PI / 2 + (i * Math.PI) / n; g.lineTo(cx + Math.cos(an) * rr, cy + Math.sin(an) * rr); } g.closePath(); }
  function paint(g, F, w, h) {
    if (F.h) stripes(g, F.h, F.ratio, w, h, false);
    if (F.v) stripes(g, F.v, F.ratio, w, h, true);
    if (F.bg) { g.fillStyle = F.bg; g.fillRect(0, 0, w, h); }
    if (F.cross) { const cw = F.cross.w * h, cx = F.cross.nordic ? w * 0.36 : w / 2; g.fillStyle = F.cross.color; g.fillRect(cx - cw / 2, 0, cw, h); g.fillRect(0, h / 2 - cw / 2, w, cw); }
    if (F.canton) { g.fillStyle = F.canton.color; g.fillRect(0, 0, F.canton.w * w, F.canton.h * h); }
    if (F.tri) { g.fillStyle = F.tri.color; g.beginPath(); g.moveTo(0, 0); g.lineTo(F.tri.w * w, h / 2); g.lineTo(0, h); g.closePath(); g.fill(); }
    if (F.disc) { const d = F.disc; g.beginPath(); g.arc((d.x ?? 0.5) * w, (d.y ?? 0.5) * h, d.r * h, 0, Math.PI * 2); if (d.ring) { g.strokeStyle = d.color; g.lineWidth = h * 0.06; g.stroke(); } else { g.fillStyle = d.color; g.fill(); } }
    if (F.star) { const s = F.star; g.fillStyle = s.color; starPath(g, (s.x ?? 0.5) * w, (s.y ?? 0.5) * h, s.r * h, s.n || 5); g.fill(); }
    if (F.emblem) { g.save(); F.emblem(g, w, h); g.restore(); }
  }
  function badge(g, id, x, y, r) {
    g.save(); g.shadowColor = "rgba(0,0,0,.55)"; g.shadowBlur = r * 0.6; g.shadowOffsetY = r * 0.12;
    g.beginPath(); g.arc(x, y, r * 1.14, 0, Math.PI * 2); g.fillStyle = "#fff"; g.fill(); g.restore();
    g.save(); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.clip(); draw(g, id, x - r * 1.5, y - r, r * 3, r * 2);
    const gl = g.createLinearGradient(x, y - r, x, y + r); gl.addColorStop(0, "rgba(255,255,255,.35)"); gl.addColorStop(0.5, "rgba(255,255,255,0)"); gl.addColorStop(1, "rgba(0,0,0,.2)");
    g.fillStyle = gl; g.fillRect(x - r, y - r, r * 2, r * 2); g.restore();
  }

  window.Mapas = window.Mapas || {};
  window.Mapas.flags = { FLAGS, draw, badge, ids: () => Object.keys(FLAGS), starPath };
})();

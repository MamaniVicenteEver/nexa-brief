export const FX=['shock','?','!','sweat','blush','tears','sparkle','hearts','motion'];
export function drawFX(c,fx,head,scale,t){
 if(fx.intensity<=.01)return;const offset=fx.offset??[.19,-.14],p=fx.point??[head[0]+scale*offset[0],head[1]+scale*offset[1]],r=scale*.08*(fx.size??1);
 c.save();c.translate(...p);c.globalAlpha*=fx.intensity;c.lineWidth=scale*.006;c.lineCap='round';c.lineJoin='round';c.strokeStyle='#33303c';c.fillStyle='#f2d27c';
 const stroke=pts=>{c.beginPath();pts.forEach((p,i)=>i?c.lineTo(...p):c.moveTo(...p));c.stroke();};
 if(fx.type==='shock'||fx.type==='motion'){for(let i=0;i<5;i++){const a=-Math.PI*.8+i*Math.PI*.3;stroke([[Math.cos(a)*r*.6,Math.sin(a)*r*.6],[Math.cos(a)*r*(1.2+i%2*.4),Math.sin(a)*r*(1.2+i%2*.4)]]);}}
 if(fx.type==='?'||fx.type==='!'){c.font=`${r*1.8}px VidaAnton`;c.strokeText(fx.type,-r*.35,r*.3);c.fillStyle='#fcf3d8';c.fillText(fx.type,-r*.35,r*.3);}
 if(fx.type==='sparkle'){c.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4,rr=i%2?r*.25:r;c.lineTo(Math.cos(a)*rr,Math.sin(a)*rr);}c.closePath();c.fill();c.stroke();}
 if(fx.type==='sweat'||fx.type==='tears'){c.fillStyle='#85c7da';c.beginPath();c.moveTo(0,-r);c.bezierCurveTo(-r*.8,0,-r*.5,r*.7,0,r*.7);c.bezierCurveTo(r*.5,r*.7,r*.8,0,0,-r);c.fill();c.stroke();}
 if(fx.type==='blush'){c.strokeStyle='#ce827e';for(let i=-1;i<2;i++)stroke([[i*r*.25,-r*.15],[i*r*.25-r*.10,r*.2]]);}
 if(fx.type==='hearts'){c.fillStyle='#db8989';c.beginPath();c.moveTo(0,r*.6);c.bezierCurveTo(-r*1.5,-r*.3,-r*.5,-r,0,-r*.4);c.bezierCurveTo(r*.5,-r,r*1.5,-r*.3,0,r*.6);c.fill();c.stroke();}
 c.restore();
}

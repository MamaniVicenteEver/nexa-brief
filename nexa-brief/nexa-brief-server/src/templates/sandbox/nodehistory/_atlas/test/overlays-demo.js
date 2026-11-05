import { createOverlays } from '../overlays.js';
const canvas=document.querySelector('canvas'), g=canvas.getContext('2d');
function picture(a,b){const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d'),grad=x.createLinearGradient(0,0,320,240);grad.addColorStop(0,a);grad.addColorStop(1,b);x.fillStyle=grad;x.fillRect(0,0,320,240);x.fillStyle='rgba(255,255,255,.3)';x.beginPath();x.arc(210,75,45,0,Math.PI*2);x.fill();x.fillStyle='rgba(20,30,32,.45)';x.fillRect(0,160,320,80);return c;}
const pictures={portrait:picture('#b9a08a','#364c53'),supplier:picture('#a1a78c','#3c594e'),train:picture('#9fb0b2','#37474d')};
import { scene } from './overlays-demo-scene.js';
const env={T:(v,f)=>typeof v==='number'?v:f,loadImg:async src=>pictures[src]||null,img:src=>pictures[src]||null,font:'Montserrat, sans-serif'};
const overlay=createOverlays(scene,env);await overlay.ready();
const params=new URLSearchParams(location.search),start=Number(params.get('t')||3),playing=params.get('play')==='1',initial=performance.now();
function frame(now){const dpr=devicePixelRatio||1,W=innerWidth,H=innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;canvas.style.width=W+'px';canvas.style.height=H+'px';g.setTransform(dpr,0,0,dpr,0,0);const bg=g.createLinearGradient(0,0,0,H);bg.addColorStop(0,'#aeb6ad');bg.addColorStop(.45,'#788070');bg.addColorStop(1,'#4c5748');g.fillStyle=bg;g.fillRect(0,0,W,H);
 const view={W,H,pitch:60,zoom:3,bearing:0,project(lon,lat){const unit=Math.min(W,H)/1080,depth=1+(lat+45)/230,k=1/depth;return{x:W*.49+lon*6*unit*k,y:H*.66-lat*4*unit*k,visible:true,k};}};
 g.strokeStyle='rgba(255,255,255,.1)';g.lineWidth=1;for(let lat=-60;lat<=60;lat+=20){g.beginPath();for(let lon=-120;lon<=120;lon+=5){const p=view.project(lon,lat);if(lon===-120)g.moveTo(p.x,p.y);else g.lineTo(p.x,p.y);}g.stroke();}overlay.draw(g,playing?start+(now-initial)/1000:start,view);if(playing)requestAnimationFrame(frame);}
requestAnimationFrame(frame);

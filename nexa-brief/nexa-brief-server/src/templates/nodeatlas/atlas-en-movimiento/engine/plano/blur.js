import {createView,transform} from './view.js';
export function blurSettings(value) {
  if(value===false)return {enabled:false};
  const cfg=value&&typeof value==='object'?value:{};
  return {enabled:cfg.enabled!==false,mode:cfg.mode==null||cfg.mode==='affine'?'affine':'exact',samples:Math.max(2,Math.min(12,Math.round(cfg.samples??4))),
    fps:Math.max(1,cfg.fps??30),shutter:Math.max(0,Math.min(1,cfg.shutter??.5)),threshold:Math.max(0,cfg.thresholdPx??2)};
}
export function sampleTimes(camera,t,W,H,settings) {
  if(!settings.enabled||!settings.shutter)return {times:[t],displacement:0};
  const dt=settings.shutter/settings.fps, start=Math.max(0,t-dt);
  const a=createView(camera.at(start),W,H),b=createView(camera.at(t),W,H);
  let displacement=0;
  for(const [x,y] of [[0,0],[W,0],[W,H],[0,H],[W/2,H/2]]) {
    const m=transform(a.screenToMercator,x,y),p=transform(b.mercatorToScreen,m.x,m.y);
    displacement=Math.max(displacement,Math.hypot(p.x-x,p.y-y));
  }
  if(displacement<=settings.threshold)return {times:[t],displacement};
  return {times:Array.from({length:settings.samples},(_,i)=>start+(t-start)*i/(settings.samples-1)),displacement};
}
export function createBlur() {
  let sample=null,accumulation=null;
  return {
    draw(g,times,W,H,draw) {
      // Quieto: ni buffers, ni copias, ni filtros. Solo se dibuja una vez.
      if(times.length===1){draw(g,times[0]);return;}
      if(!sample||sample.width!==W||sample.height!==H){
        sample=new OffscreenCanvas(W,H);accumulation=new OffscreenCanvas(W,H);
      }
      const sg=sample.getContext('2d',{willReadFrequently:true}),ag=accumulation.getContext('2d',{willReadFrequently:true});
      ag.resetTransform();ag.clearRect(0,0,W,H);ag.globalCompositeOperation='source-over';
      times.forEach((time,i)=>{
        sg.resetTransform();sg.globalAlpha=1;sg.globalCompositeOperation='source-over';sg.clearRect(0,0,W,H);
        draw(sg,time);
        // Media incremental de muestras opacas, sin dependencia del cuadro anterior.
        ag.globalAlpha=1/(i+1);ag.drawImage(sample,0,0);
      });
      ag.globalAlpha=1;g.drawImage(accumulation,0,0);
    },
  };
}

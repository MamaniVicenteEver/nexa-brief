import {resolveView} from '../core/view.js';
export const SAFE={left:60,right:1020,top:1360,bottom:1500};
export const subtitleY=ui=>Math.max(SAFE.top+(ui?.size??78)*.6+5,ui?.y??1430);
export function subtitleAt(compiled,t){
 const line=compiled.lines.find(l=>t>=l.t0&&t<l.t1);if(!line)return null;
 const local=t-line.t0+line.trimIn,words=(line.subtitleWords??line.words).filter(w=>w.e>line.trimIn&&w.s<line.trimOut);const at=words.findIndex(w=>local>=w.s&&local<w.e);if(at<0)return null;
 let start=0;while(start<words.length){let end=Math.min(start+(compiled.episode.ui?.subtitles?.maxWords??3),words.length);for(let i=start;i<end;i++)if(/[.!?,;:]$/.test(words[i].w)){end=i+1;break;}if(at<end)return {italic:line.offscreen===true,words:words.slice(start,end),active:at-start,text:words.slice(start,end).map(w=>w.w.trim()).join(' ')};start=end;}
 return null;
}
function label(ctx,text,x,y,maxWidth,size=76,italic=false){ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`${italic?'italic ':''}${size}px VidaAnton`;while(ctx.measureText(text).width>maxWidth&&size>30){size-=2;ctx.font=`${italic?'italic ':''}${size}px VidaAnton`;}const measured=ctx.measureText(text).width;if(measured>maxWidth-12){ctx.translate(x,y);ctx.scale(Math.max(1,maxWidth-12)/measured,1);x=0;y=0;}ctx.lineWidth=10;ctx.lineJoin='round';ctx.strokeStyle='#18191f';ctx.strokeText(text,x,y);ctx.fillStyle='#fffdf5';ctx.fillText(text,x,y);ctx.restore();}
export function drawUI(ctx,compiled,t,options={}){
 const view=resolveView(options.view);
 if(options.framing!=='tight'){
  const ui=compiled.episode.ui??{},sub=subtitleAt(compiled,t),size=Math.min(view.orientation==='landscape'?58:78,ui.subtitles?.size??78);
  if(ui.subtitles!==false&&sub)label(ctx,sub.text,view.w/2,view.h*.915,view.w*.90,size,sub.italic);
  if(ui.title&&t<(ui.title.dur??1.2)){ctx.save();ctx.globalAlpha=Math.min(1,(ui.title.dur??1.2)-t);label(ctx,ui.title.text??compiled.episode.title,view.w/2,view.h*.14,view.w*.88,64);ctx.restore();}
  if(ui.end&&t>compiled.duration-(ui.end.dur??1.5))label(ctx,ui.end.text,view.w/2,view.h*.20,view.w*.88,70);
  return;
 }
 ctx.save();ctx.scale(view.w/1080,view.h/1920);
 const ui=compiled.episode.ui??{},sub=subtitleAt(compiled,t);
 if(ui.subtitles!==false&&sub)label(ctx,sub.text,ui.subtitles?.x??540,subtitleY(ui.subtitles),Math.min(940,2*Math.min((ui.subtitles?.x??540)-60,1020-(ui.subtitles?.x??540))),ui.subtitles?.size??78,sub.italic);
 if(ui.title&&t<(ui.title.dur??1.2)){ctx.save();ctx.globalAlpha=Math.min(1,(ui.title.dur??1.2)-t);label(ctx,ui.title.text??compiled.episode.title,540,320,920,64);ctx.restore();}
 if(ui.end&&t>compiled.duration-(ui.end.dur??1.5))label(ctx,ui.end.text,540,410,900,70);
ctx.restore();
}

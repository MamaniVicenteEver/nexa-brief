import {clamp,lerp,smoothstep} from '../core/math.js';
const gesture=(left,right,shape='open',tilt=.07)=>({left,right,shape,tilt});
// Six distinct silhouettes per intent, cycled deterministically over voiced accents.
export const GESTURES={
 explain:[gesture([-.25,-.03],[.025,.24]),gesture([-.025,.24],[.25,-.08]),gesture([-.20,-.08],[.20,-.08]),gesture([-.14,.04],[.24,-.02],'point'),gesture([-.24,-.13],[.04,.16]),gesture([-.06,.14],[.18,-.18],'flat')],
 ask:[gesture([-.24,-.04],[.24,-.04]),gesture([-.18,-.16],[.18,-.16]),gesture([-.26,.02],[.18,-.10]),gesture([-.18,-.10],[.26,.02]),gesture([-.10,-.17],[.24,-.10]),gesture([-.24,-.10],[.10,-.17])],
 exclaim:[gesture([-.20,-.17],[.03,.20],'point'),gesture([-.03,.20],[.20,-.17],'point'),gesture([-.24,-.05],[.24,-.05],'point'),gesture([-.08,-.21],[.17,-.15],'point'),gesture([-.25,-.02],[.07,.12],'point'),gesture([-.10,.10],[.12,-.24],'point')],
 deny:[gesture([-.25,-.02],[.04,.19],'flat'),gesture([-.04,.19],[.25,-.02],'flat'),gesture([-.21,-.10],[.21,-.10],'flat'),gesture([.10,.09],[-.10,.09],'flat'),gesture([-.14,-.18],[.22,.02],'flat'),gesture([-.22,.02],[.14,-.18],'flat')],
 whisper:[gesture([-.06,-.16],[.035,.23],'flat'),gesture([-.035,.23],[.06,-.16],'flat'),gesture([-.09,-.12],[.09,-.12],'flat'),gesture([-.055,-.20],[.14,.08],'point'),gesture([-.14,.08],[.055,-.20],'point'),gesture([-.15,-.05],[.06,-.16],'flat')],
 list:[gesture([-.24,-.04],[.04,.19],'point'),gesture([-.04,.19],[.24,-.04],'point'),gesture([-.20,-.11],[.20,-.11],'point'),gesture([-.10,.10],[.14,-.21],'point'),gesture([-.14,-.21],[.10,.10],'point'),gesture([-.22,.01],[.22,-.05],'open')]
};
export function planAccents(line,dur) {
 const candidates=(line?.words??[]).map((w,i)=>({at:w.s-line.trimIn+Math.min(.13,(w.e-w.s)*.25),word:i,score:w.w.replace(/\W/g,'').length+(line.rms?.[Math.round(w.s*line.rmsHz)]??0)*7})).filter(a=>a.at>=0&&a.at<dur-.25);
 const accents=[];
 for(const a of candidates){const prev=accents.at(-1);if(!prev||a.at-prev.at>=.86)accents.push(a);else if(a.score>prev.score&&a.at-(accents.at(-2)?.at??-2)>=.86)accents[accents.length-1]=a;}
 if(!accents.length)accents.push({at:Math.min(.25,dur*.2),score:4});
 return accents.map((a,index)=>({...a,index,hold:clamp(.3+a.score*.025,.3,.8)}));
}
export function talkPose(s,t){
 const bank=GESTURES[s.intent??'explain'],accents=s.accents??[{at:.25,index:0,hold:.45}];
 const p={hands:{left:[-.025,.279],right:[.025,.279]},handShapes:{left:'open',right:'open'},handAngles:{left:null,right:null},armLayer:{left:1,right:1},headTilt:0};
 // Crossfade from the previous held silhouette: no reset between accents.
 let previous=null;
 for(const a of accents){
   if(t<a.at-.20)break;
   const source=bank[a.index%bank.length],g={...source,left:[...source.left],right:[...source.right]},dt=t-a.at;
   if(s.heldHands?.length===1){const held=s.heldHands[0],free=held==='left'?'right':'left',energy=p=>Math.hypot(p[0],p[1]-.279);if(energy(g[held])>energy(g[free]))g[free]=[-g[held][0],g[held][1]];}
   const attack=smoothstep(clamp((dt+.12)/.24));
   const anticipation=dt<-.12?-.08*Math.sin(Math.PI*clamp((dt+.2)/.08)):0;
   const decay=1-smoothstep(clamp((dt-.12-a.hold)/.28));
   for(const side of ['left','right']){
     const base=p.hands[side];
     p.hands[side]=g[side].map((v,i)=>lerp(base[i],v,attack*decay+anticipation));
     p.handShapes[side]=attack>.45?g.shape:(previous?.shape??'open');
     p.handAngles[side]=g.shape==='point'?(s.intent==='list'||s.intent==='exclaim'?0:(side==='left'?-1:1)*Math.PI/2):(side==='left'?-.8:.8);
   }
   p.headTilt=(s.intent==='deny'?Math.sin(dt*10):a.index%2?1:-1)*g.tilt*attack*decay;
   previous=g;
 }
 return p;
}

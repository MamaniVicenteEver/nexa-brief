import {clamp,lerp} from '../core/math.js';
// Minimum-jerk quintic: zero velocity and acceleration at both endpoints.
export const smooth=u=>{u=clamp(u);return u*u*u*(10+u*(-15+6*u));};
const bezier=(t,a,b)=>3*(1-t)**2*t*a+3*(1-t)*t*t*b+t**3;
export function progress(u,curve='smoother'){
 u=clamp(u);if(u===0||u===1)return u;
 // Warping the minimum-jerk profile retains zero endpoint derivatives, also for legacy names.
 const named={'ease-in':[.42,0,1,1],'ease-out':[0,0,.58,1],'ease-in-out':[.42,0,.58,1],gentle:[.25,.1,.75,.9]};
 const c=Array.isArray(curve)?curve:named[curve];if(!c)return smooth(u);
 let lo=0,hi=1;for(let i=0;i<32;i++){const m=(lo+hi)/2;if(bezier(m,c[0],c[2])<u)lo=m;else hi=m;}
 return smooth(bezier((lo+hi)/2,c[1],c[3]));
}
const coefficients=new Map();
export function profileBounds(curve){
 const key=JSON.stringify(curve??'smoother');if(coefficients.has(key))return coefficients.get(key);
 const n=2000,values=Array.from({length:n+1},(_,i)=>progress(i/n,curve));let v=[],a=[],j=[];
 for(let i=1;i<values.length;i++)v.push((values[i]-values[i-1])*n);
 for(let i=1;i<v.length;i++)a.push((v[i]-v[i-1])*n);
 for(let i=1;i<a.length;i++)j.push((a[i]-a[i-1])*n);
 const result={v:Math.max(...v.map(Math.abs))*1.03,a:Math.max(...a.map(Math.abs))*1.03,j:Math.max(...j.map(Math.abs))*1.03};coefficients.set(key,result);return result;
}
export function minimumDuration(a,b,config,curve){
 const z=Math.abs(Math.log2(b.h/a.h)),p=Math.hypot(b.cx-a.cx,b.cy-a.cy)/Math.min(a.w,b.w),k=profileBounds(curve);
 // Denominator changes during zoom: conservative factor for normalized pan derivatives.
 const ratio=Math.max(a.h/b.h,b.h/a.h),pan=p*ratio**3;
 return Math.max(k.v*z/config.maxZoomRate,k.v*pan/config.maxPan,Math.sqrt(k.a*z/config.maxZoomAcceleration),Math.sqrt(k.a*pan/config.maxPanAcceleration),Math.cbrt(k.j*z/config.maxZoomJerk),Math.cbrt(k.j*pan/config.maxPanJerk));
}
export function interpolate(a,b,q,aspect,linearZoom=false){
 const h=a.h===b.h?a.h:linearZoom?1/lerp(1/a.h,1/b.h,q):Math.exp(lerp(Math.log(a.h),Math.log(b.h),q));
 return {cx:lerp(a.cx,b.cx,q),cy:lerp(a.cy,b.cy,q),h,w:h*aspect};
}
export function breath(t,seed=1,amount=0){
 if(!amount)return [0,0];
 const phase=(seed*2.399963229728653)%6.283185307179586;
 return [amount*.0035*(.6*Math.sin(t*2*Math.PI*.23+phase)+.4*Math.sin(t*2*Math.PI*.41+phase*1.7)),amount*.0035*(.6*Math.sin(t*2*Math.PI*.29+phase*2.1)+.4*Math.sin(t*2*Math.PI*.53+phase*.7))];
}
/** Gaussian filtering of staging roots, never heads/hands or gait rootY. Continuous at any seek. */
export function rootTrack(samples,t,smoothing,deadzone,width){
 const first=samples[0],sigma=Math.max(.15,smoothing);let total=0,x=0,y=0;
 for(const s of samples){const dt=(s.t-t)/sigma,w=Math.exp(-.5*dt*dt);total+=w;x+=s.x*w;y+=s.y*w;}
 x=x/total-first.x;y=y/total-first.y;
 // Smooth deadzone (zero first three derivatives at its inner edge).
 const dead=v=>{const a=Math.abs(v),d=deadzone*width;return Math.sign(v)*(a<=d?0:a<2*d?(a-d)*smooth((a-d)/d):a-d);};
 return [dead(x),dead(y)];
}

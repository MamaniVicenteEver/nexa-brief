import { animationAt } from './animation.js';
const PI = Math.PI;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const ease = x => { x = clamp(x); return x * x * (3 - 2 * x); };
const pop = x => { x = clamp(x); return 1 + 2.70158 * (x - 1) ** 3 + 1.70158 * (x - 1) ** 2; };
const value = (s, upper) => upper === false ? String(s ?? '') : String(s ?? '').toUpperCase();
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const font = (size, family, weight = 800) => `${weight} ${Math.max(1, size)}px ${family}`;

function rounded(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r); g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h); g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r); g.quadraticCurveTo(x, y, x + r, y); g.closePath();
}
function hex(g, x, y, r) {
  g.beginPath(); for (let i = 0; i < 6; i++) { const a = PI / 3 * i - PI / 2; (i ? g.lineTo : g.moveTo).call(g, x + r * Math.cos(a), y + r * Math.sin(a)); } g.closePath();
}
function wrap(text, maxWidth, measure, maxLines = 4) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean), lines = [];
  for (const word of words) {
    let rest = word;
    while (rest) {
      const last = lines.length - 1;
      if (last >= 0 && measure(lines[last] + ' ' + rest) <= maxWidth) { lines[last] += ' ' + rest; break; }
      if (lines.length >= maxLines) { let s = lines[maxLines - 1]; while (s && measure(s + '…') > maxWidth) s = s.slice(0, -1); lines[maxLines - 1] = s + '…'; return lines; }
      let n = rest.length; while (n > 1 && measure(rest.slice(0, n)) > maxWidth) n--;
      lines.push(rest.slice(0, n)); rest = rest.slice(n);
    }
  }
  return lines;
}
function greatCircle(a, b, s) {
  const xyz = p => { const lon = p[0] * PI / 180, lat = p[1] * PI / 180; return [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)]; };
  const u = xyz(a), v = xyz(b), angle = Math.acos(clamp(u.reduce((n, x, i) => n + x * v[i], 0), -1, 1));
  let p;
  if (angle < 1e-8) p = u;
  else if (PI - angle < 1e-7) { const axis = Math.abs(u[2]) < 0.9 ? [0, 0, 1] : [0, 1, 0], dot = u.reduce((n, x, i) => n + x * axis[i], 0), q = axis.map((x, i) => x - dot * u[i]), len = Math.hypot(...q); p = u.map((x, i) => x * Math.cos(PI * s) + q[i] / len * Math.sin(PI * s)); }
  else p = u.map((x, i) => (x * Math.sin((1 - s) * angle) + v[i] * Math.sin(s * angle)) / Math.sin(angle));
  return [Math.atan2(p[1], p[0]) * 180 / PI, Math.atan2(p[2], Math.hypot(p[0], p[1])) * 180 / PI];
}

export function createOverlays(scene, env) {
  const layers = (scene.layers || []).map(l => {
    const data = l.dataRef ? scene.data?.[l.dataRef] : null;
    return {...l,...(data ? {value:data.value,unit:data.unit,label:data.label ?? l.label} : {}),
      ...(l.type === 'arrow' ? {type:'arc',head:l.head || 'arrow'} : {})};
  }), family = env.font || 'Montserrat, sans-serif', failed = new Set(), images = new Map();
  const T = env.T || ((v, fallback) => typeof v === 'number' ? v : fallback);
  const source = src => { if (!src) return ''; try { return env.base ? new URL(src, env.base).href : src; } catch { return String(env.base || '') + src; } };
  const jobs = [...new Set(layers.map(l => l.src).filter(Boolean))].map(src => Promise.resolve().then(() => env.loadImg(source(src))).then(im => { if (im) images.set(src, im); else failed.add(src); }, () => failed.add(src)));
  const image = src => images.get(src) || (env.img && (env.img(source(src)) || env.img(src))) || null;
  function point(at, view, alt = 0) {
    const p = Array.isArray(at) ? at : env.place?.(at);
    if (!p || !Number.isFinite(+p[0]) || !Number.isFinite(+p[1])) return null;
    const q = view.project(+p[0], +p[1], alt); if (!q || !q.visible || !Number.isFinite(q.x) || !Number.isFinite(q.y)) return null;
    return { x: q.x, y: q.y, k: clamp(Number.isFinite(q.k) ? q.k : 1, .35, 1.5) };
  }
  function timing(l, t) {
    const start = T(l.t, 0), dur = Math.max(.001, T(l.dur, l.type === 'arc' ? 1.5 : .6)), out = l.out == null ? Infinity : T(l.out, Infinity);
    const end = out + (l.exit ? Math.max(.001,l.exit.dur ?? .6) : 0);
    return { start, dur, out, progress: clamp((t - start) / dur), alpha: t < start || t >= end ? 0 : 1 };
  }
  function geometry(t, view) {
    const rects = [], items = [], unit = Math.min(view.W, view.H) / 1080;
    layers.forEach((l, index) => {
      const time = timing(l, t); if (!time.alpha) return;
      const p = l.type === 'title' ? { x: view.W / 2, y: view.H * (l.y ?? .22), k: 1 } : l.type === 'metric' && l.at == null ? {x:view.W*(l.x ?? .5),y:view.H*(l.y ?? .24),k:1} : l.type === 'arc' ? null : point(l.at, view, l.altM || 0);
      if (!p && l.type !== 'arc') return;
      const scale = unit * (p?.k ?? 1), s = n => n * scale;
      const item = { l, index, time, p, scale, s }; items.push(item);
      let x, y, w, h;
      if (l.type === 'pole-photo' || l.type === 'hex-photo') { const side = l.side === 'left' ? -1 : 1, size = s(l.size || (l.type === 'hex-photo' ? 90 : 74)); w = s(l.type === 'hex-photo' ? 260 : 210); h = s(l.type === 'hex-photo' ? 126 : 62); x = p.x + (side > 0 ? size + s(24) : -size - s(24) - w); y = p.y - s(l.type === 'pole-photo' ? Math.max(140,l.poleH || 155) : (l.poleH || 155)) - h / 2; }
      if (l.type === 'tag') { w = s(Math.max(120, value(l.text, l.upper).length * 16 + 38)); h = s(52); x = p.x - w / 2; y = p.y - s(l.up || 115) - h / 2; }
      if (l.type === 'panel') { w = s(275); h = s(130); x = p.x + (l.anchor === 'left' ? -s(590) : s(30)); y = p.y - s(230); }
      if (l.type === 'bars') { w = s(Math.max(190, value(l.text, l.upper).length * 18 + 40)); h = s(58); x = p.x + s(85); y = p.y - s(175); }
      if (l.type === 'title') { w = Math.min(view.W * .9, s(Math.max(300, value(l.text, l.upper).length * (l.size || 65) * .7))); h = s((l.size || 65) * (l.sub ? 1.9 : 1.15)); x = p.x - w / 2; y = p.y - h / 2; }
      if (l.type === 'metric') {w=s(l.width ?? 420);h=s(155);x=p.x-w/2;y=p.y-h/2;}
      if (w != null && w > 0 && h > 0) {
        const textRect={x,y,w,h,index}; let rect={...textRect};
        if (l.type==='pole-photo' || l.type==='hex-photo') {
          const radius=s(l.size || (l.type==='hex-photo'?90:74))+s(8), cy=p.y-s(l.type==='pole-photo'?Math.max(140,l.poleH||155):(l.poleH||155));
          const left=Math.min(x,p.x-radius), top=Math.min(y,cy-radius), right=Math.max(x+w,p.x+radius), bottom=Math.max(y+h,cy+radius);
          rect={x:left,y:top,w:right-left,h:bottom-top,index};
        }
        while (rects.some(r => overlaps(r, rect))) rect.y -= rect.h + s(12);
        item.dy=rect.y-(l.type==='pole-photo'||l.type==='hex-photo'?Math.min(y,p.y-s(l.type==='pole-photo'?Math.max(140,l.poleH||155):(l.poleH||155))-s(l.size || (l.type==='hex-photo'?90:74))-s(8)):y);
        textRect.y+=item.dy; rects.push(rect); item.rect=textRect;
      }
    });
    return { items, rects };
  }
  function draw(g, t, view) {
    const { items } = geometry(t, view), unit = Math.min(view.W, view.H) / 1080;
    g.save();
    try { for (const { l, time, p, s, rect, dy=0 } of items) {
      g.save(); try {
        g.globalAlpha *= time.alpha; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#fff'; g.fillStyle = '#fff';
        const animation=animationAt(l,t,time.start,time.out,unit), ax=p?.x ?? view.W/2, ay=p?.y ?? view.H/2;
        g.globalAlpha *= animation.alpha;
        if (animation.x || animation.y || animation.scale!==1) {g.translate(ax+animation.x,ay+animation.y);g.scale(animation.scale,animation.scale);g.translate(-ax,-ay);}
        const prog = ease(time.progress), elapsed = t - time.start;
        const shadow = () => { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = s(16); g.shadowOffsetY = s(4); };
        const line = (x1,y1,x2,y2) => { g.beginPath(); g.moveTo(x1,y1); g.lineTo(x2,y2); g.stroke(); };
        const text = (str,x,y,size,weight=800) => { g.font = font(s(size), family, weight); g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(value(str,l.upper),x,y); };
        const paragraph = (str,x,y,width,size=17) => { g.font = font(s(size), family, 700); const lines = wrap(value(str,l.upper), width, a => g.measureText(a).width); lines.forEach((v,i) => g.fillText(v,x,y+i*s(size*1.3))); };
        const ground = (radius, dashed = false, progress = 1) => { g.beginPath(); if (dashed) g.setLineDash([s(3),s(7)]); g.ellipse(p.x,p.y,radius,Math.max(.01,radius * Math.max(.08,Math.abs(Math.cos((view.pitch || 0)*PI/180)))),0,-PI/2,-PI/2+2*PI*progress); g.stroke(); if (dashed) g.setLineDash([]); };
        const photo = (im,x,y,w,h) => { if (!im || !(im.width > 0 && im.height > 0) || w <= 0 || h <= 0) return; const z = Math.max(w/im.width,h/im.height), f=l.focus || [.5,.5]; g.drawImage(im,x+(w-im.width*z)*clamp(f[0]),y+(h-im.height*z)*clamp(f[1]),im.width*z,im.height*z); };
        if (l.type === 'arc') {
          const to = point(l.to, view, l.altM || 0); if (!to) continue;
          const a = Array.isArray(l.from) ? l.from : l.from == null ? null : env.place?.(l.from), b = Array.isArray(l.to) ? l.to : env.place?.(l.to);
          if (!b || (l.from != null && !a)) continue;
          const n = 64, head = time.progress, tail = clamp(l.tail ?? .3, 0, 1), keep = !!l.keep, col = l.color || (l.style === 'magenta' ? '#a3126f' : '#18b4f0'), pts = [];
          const origin=a && point(a,view);
          for (let i=0;i<=n;i++) { const u=i/n; let q; if (a) { if(l.path==='straight' || l.path==='curve')q=origin?{x:origin.x+(to.x-origin.x)*u,y:origin.y+(to.y-origin.y)*u,k:origin.k+(to.k-origin.k)*u,visible:true}:null;else {const loc=greatCircle(a,b,u); q=point(loc,view,(l.altM || 0)*Math.sin(PI*u));} } else q={x: -view.W*.12+(to.x+view.W*.12)*u,y:to.y-view.H*.25*(1-u),k:to.k}; if (q) q={...q,y:q.y-(l.path==='straight'?0:l.lift ?? (l.style === 'magenta' ? 180 : 100))*unit*q.k*Math.sin(PI*u)}; pts.push(q); }
          const baseAlpha=time.alpha*animation.alpha;
          for (let i=1;i<=n;i++) { const u=i/n; if (u > head || !pts[i] || !pts[i-1] || (l.dashed && Math.floor(i/3)%2)) continue; const fade = keep ? 1 : tail > 0 ? clamp((u-(head-tail))/tail) : 0; if (!fade) continue; g.globalAlpha = baseAlpha*fade; g.strokeStyle=col; g.lineWidth=(l.width || (l.style==='magenta'?4:9))*unit*pts[i].k; g.shadowColor=col; g.shadowBlur=12*unit*pts[i].k; line(pts[i-1].x,pts[i-1].y,pts[i].x,pts[i].y); }
          function drawHead(index,reverse=false) {const hp=pts[index],prev=pts[clamp(index+(reverse?1:-1),0,n)];if(!hp||!prev)return;g.globalAlpha=baseAlpha;g.shadowColor=col;g.shadowBlur=25*unit*hp.k;g.fillStyle=l.head==='arrow'?col:'#fff';g.beginPath();if(l.head==='arrow'){const angle=Math.atan2(hp.y-prev.y,hp.x-prev.x),r=(l.headSize ?? 17)*unit*hp.k;g.moveTo(hp.x+r*Math.cos(angle),hp.y+r*Math.sin(angle));g.lineTo(hp.x+r*.7*Math.cos(angle+2.5),hp.y+r*.7*Math.sin(angle+2.5));g.lineTo(hp.x+r*.7*Math.cos(angle-2.5),hp.y+r*.7*Math.sin(angle-2.5));g.closePath();}else g.arc(hp.x,hp.y,5*unit*hp.k,0,2*PI);g.fill();}
          if(l.head!=='none' && (head<1||keep)){drawHead(Math.min(n,Math.floor(head*n)));if(l.bidirectional && head>0)drawHead(0,true);}
          if(l.flow && head>0){for(let j=0;j<4;j++){const u=((elapsed*(l.flowSpeed ?? .22)+j/4)%1);if(u<=head)drawHead(Math.max(1,Math.floor(u*n)));}}
          const middle=pts[Math.floor(n/2)];
          if(middle && head>=.5 && (l.label || Number.isFinite(l.value))){const label=[l.label,Number.isFinite(l.value)?`${l.value}${l.unit || ''}`:''].filter(Boolean).join(' · ');g.globalAlpha=baseAlpha;g.font=font(25*unit,family);g.textAlign='center';g.textBaseline='bottom';g.shadowColor='#000';g.shadowBlur=8*unit;g.fillStyle='#fff';g.fillText(label,middle.x,middle.y-14*unit);}
          continue;
        }
        if (l.type === 'ring' || l.type === 'dot') { const r=s(l.r || (l.type==='dot'?7:42)); g.lineWidth=s(2.5); g.strokeStyle=l.color||'#fff'; if (l.type==='ring') ground(r,false,clamp(elapsed/.5)); if (l.pulse !== false) { const phase=(elapsed%1.5)/1.5; g.globalAlpha=time.alpha*animation.alpha*(1-phase)*.7; ground(r*(1+phase),false,1); g.globalAlpha=time.alpha*animation.alpha; } g.fillStyle=l.color||'#fff'; g.beginPath(); g.arc(p.x,p.y,s(l.type==='dot'?6:4),0,2*PI); g.fill(); continue; }
        if (l.type === 'pole-photo' || l.type === 'hex-photo') {
          const rad=s(l.size || (l.type==='hex-photo'?90:74))*pop(time.progress), cy=p.y-s(l.type==='pole-photo'?Math.max(140,l.poleH||155):(l.poleH||155))*prog+dy; g.lineWidth=s(2); line(p.x,p.y,p.x,cy); shadow();
          if (l.type==='pole-photo') { g.beginPath(); g.arc(p.x,cy,Math.max(.01,rad),0,2*PI); g.fillStyle='#fff'; g.fill(); g.save(); g.beginPath(); g.arc(p.x,cy,Math.max(.01,rad-s(6)),0,2*PI); g.clip(); photo(image(l.src),p.x-rad,cy-rad,2*rad,2*rad); g.restore(); if(l.ring!==false) { g.shadowBlur=0; g.beginPath(); g.arc(p.x,cy,rad+s(6),0,2*PI); g.stroke(); } }
          else { hex(g,p.x,cy,rad); g.fillStyle='rgba(255,255,255,.28)'; g.fill(); const fillAt=T(l.fillAt,time.start+time.dur); if(t>=fillAt) { g.save(); hex(g,p.x,cy,rad); g.clip(); g.globalAlpha*=ease((t-fillAt)/.4); photo(image(l.src),p.x-rad,cy-rad,rad*2,rad*2); g.restore(); } g.strokeStyle='#fff'; g.stroke(); hex(g,p.x,cy,rad+s(6)); g.strokeStyle='#d5bc75'; g.stroke(); }
          if(rect) { g.globalAlpha*=ease((time.progress-.35)/.65); shadow(); text(l.label || l.title,rect.x,rect.y,25); if(l.type==='hex-photo') paragraph(l.text,rect.x,rect.y+s(36),rect.w); else if(l.sub) text(l.sub,rect.x,rect.y+s(32),16,700); } continue;
        }
        if (l.type==='tag') { g.lineWidth=s(2); ground(s(34),true); const r=rect, k=pop(time.progress), cx=r.x+r.w/2, cy=r.y+r.h/2; g.translate(cx,cy); g.scale(k,k); shadow(); rounded(g,-r.w/2,-r.h/2,r.w,r.h,s(12)); g.fillStyle=l.color||'#a3126f'; g.fill(); g.shadowBlur=0; g.font=font(s(23),family); g.textAlign='center'; g.textBaseline='middle'; g.fillStyle='#fff'; g.fillText(value(l.text,l.upper),0,0); continue; }
        if (l.type==='panel') { const r=rect, side=l.anchor==='left'?-1:1, edge=side>0?r.x:r.x+r.w, yy=r.y+r.h; g.lineWidth=s(2); const v=clamp(time.progress*2), h=clamp(time.progress*2-1); line(p.x,p.y,p.x,p.y+(yy-p.y)*v); if(h) line(p.x,yy,p.x+(edge-p.x)*h,yy); const ix=side>0?r.x+r.w+s(20):r.x-s(245), iw=s(225), ih=s(140); shadow(); g.fillStyle='rgba(255,255,255,.22)'; g.fillRect(ix,r.y,iw,ih); const reveal=ease((elapsed-(l.blankFor||0))/.5); if(reveal>0){g.save();g.beginPath();g.rect(ix,r.y,iw*reveal,ih);g.clip();photo(image(l.src),ix,r.y,iw,ih);g.restore();} g.fillStyle=l.accent||'#18b4f0';g.fillRect(side>0?ix:ix+iw-s(5),r.y,s(5),ih); g.globalAlpha*=ease((time.progress-.35)/.65); text(l.title,r.x,r.y,25); paragraph(l.text,r.x,r.y+s(38),r.w); continue; }
        if (l.type==='bars') { const r=rect, k=ease(time.progress*2); g.lineWidth=s(4); line(p.x,p.y,p.x+s(45),r.y+r.h/2); line(p.x+s(45),r.y+r.h/2,r.x,r.y+r.h/2); g.fillRect(r.x,r.y,r.w*k,s(4)); g.fillRect(r.x,r.y+r.h-s(4),r.w*k,s(4)); if(time.progress>.5){g.globalAlpha*=ease((time.progress-.5)*2); g.fillStyle='#70183e';g.fillRect(r.x,r.y+s(5),r.w,r.h-s(10));text(l.text,r.x+s(16),r.y+s(14),23);} continue; }
        if (l.type==='metric') {const r=rect;shadow();rounded(g,r.x,r.y,r.w,r.h,s(16));g.fillStyle=l.background||'rgba(7,20,32,.9)';g.fill();g.shadowBlur=0;g.fillStyle=l.color||'#18b4f0';g.fillRect(r.x,r.y,s(5),r.h);text(l.label||l.text,r.x+s(24),r.y+s(16),20,700);text(Number.isFinite(l.value)?`${l.value}${l.unit||''}`:'—',r.x+s(24),r.y+s(48),58,900);if(l.sub)text(l.sub,r.x+s(24),r.y+s(116),15,700);continue;}
        if (l.type==='title') { const str=value(l.text,l.upper), count=Math.floor(str.length*prog), r=rect; g.textAlign='center';g.textBaseline='top';g.font=font(s(l.size||65),family);g.filter=`blur(${s(12)*(1-prog)}px)`; shadow();g.fillText(str.slice(0,count),view.W/2,r.y);g.filter='none';if(l.sub && prog>.5){g.font=font(s(24),family,700);g.fillText(value(l.sub,l.upper),view.W/2,r.y+s((l.size||65)*1.25));} }
      } finally { g.restore(); }
    } } finally { g.restore(); }
  }
  return { layers, ready: () => Promise.all(jobs).then(() => undefined), draw, missing: () => [...failed], layout: (t, view) => geometry(t, view).rects };
}

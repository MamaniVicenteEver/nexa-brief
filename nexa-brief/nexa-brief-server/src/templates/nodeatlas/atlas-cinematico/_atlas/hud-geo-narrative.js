/* Piezas geográficas y narrativas Original; sin estado temporal acumulado. */
import { arcPoint, greatCircle, distance, destination } from './map-geometry.js';
import { choroplethScale } from './choropleth.js';
import { wrapText } from './text-layout.js';
export const GEO_NARRATIVE_TYPES = new Set(['range-ring','pulse','route-icon','front-line','geo-label','choropleth','quote-card','timeline']);
const PI = Math.PI, clamp = x => Math.max(0,Math.min(1,x)), ease = x => 1-(1-clamp(x))**3;

// Rumbo intrínseco de los dibujos de la biblioteca, medido desde la derecha.
export const ICON_BEARINGS = {plane:-PI/4,'fighter-jet':-PI/2,ship:-PI/2,warship:0,tank:0};
export function prepareGeoNarrative(items, { T, place, warn }) {
  const prepared = new Map();
  const resolve = at => Array.isArray(at) ? at : place?.(at);
  let needsLibrary = false;
  for (const l of items.filter(l => GEO_NARRATIVE_TYPES.has(l.type))) {
    const s = {};
    if (l.type === 'route-icon') {
      needsLibrary = true;
      s.nodes = [l.from,...(l.via || []),l.to].map(resolve);
      s.lengths = s.nodes.slice(1).map((b,i) => s.nodes[i] && b ? distance(s.nodes[i],b) : 0);
      s.total = s.lengths.reduce((a,b)=>a+b,0) || 1;
    }
    if (l.type === 'front-line') {
      s.points = []; s.lengths = [0];
      for (let j=1;j<(l.points || []).length;j++) for (let i=j===1?0:1;i<=16;i++) {
        const p = greatCircle(l.points[j-1],l.points[j],i/16), prev = s.points.at(-1);
        if (prev) s.lengths.push(s.lengths.at(-1)+distance(prev,p));
        s.points.push(p);
      }
    }
    if (l.type === 'range-ring') {
      s.rings = l.rings || [l.radiusKm ?? 1500];
      const fmt = new Intl.NumberFormat('es-ES',{maximumFractionDigits:0,useGrouping:'always'});
      s.labels = s.rings.map(km => fmt.format(km)+' km');
    }
    if (l.type === 'quote-card') {
      const chars = Array.from(String(l.text || ''));
      if (chars.length>160) warn('quote-card: text supera 160 caracteres; se recorta con …');
      s.quote = chars.length>160 ? chars.slice(0,159).join('')+'…' : chars.join('');
    }
    if (l.type === 'timeline') {
      s.events = (l.events || []).map((e,i)=>({...e,at:T(e.t,T(l.t,0)+i*(l.interval ?? 1.5))}));
      needsLibrary ||= s.events.some(e=>e.icon);
    }
    if (l.type === 'choropleth') {
      const {domain} = choroplethScale(l);
      const fmt = new Intl.NumberFormat('es-ES',{maximumFractionDigits:2,useGrouping:'always'});
      s.labels = [fmt.format(domain[0]),fmt.format(domain.at(-1))].map(v=>v+(l.unit ? ' '+l.unit : ''));
    }
    prepared.set(l,s);
  }

  function draw(l, tm, {g,t,view,u,S,text,measure,anchor,rrect,col,theme,image,drawIcon}) {
    const s = prepared.get(l), c = col(l.color || 'blue'), W=view.W,H=view.H, portrait=W<H;
    const point = (at,v=view) => {
      const p=resolve(at); if (!p) return null;
      const q=v.project(p[0],p[1]);
      return q?.visible && Number.isFinite(q.x+q.y) ? q : null;
    };
    const line = (a,b) => {g.moveTo(a.x,a.y);g.lineTo(b.x,b.y);};
    const trim = (str, width, size, o={}) => {
      str=String(str ?? ''); if (measure(str,size,o)<=width) return str;
      while (str && measure(str+'…',size,o)>width) str=str.slice(0,-1);
      return str+'…';
    };
    const label = (str,x,y,size=l.size ?? 28,o={}) => text(str,x,y,size,{color:col(l.color || 'white'),...o});
    const icon = (name,x,y,r,angle=0,reflect=false) => {
      g.save();g.translate(x,y);g.rotate(angle);g.scale(reflect?-r:r,r);g.strokeStyle=c;g.fillStyle=c;g.lineWidth=.14;drawIcon(g,name);g.restore();
    };
    if (l.type === 'range-ring') {
      const at=resolve(l.at);if (!at) return;
      const alpha=g.globalAlpha;
      s.rings.forEach((km,j)=>{
        const radius=km*ease(tm.p), pts=[];
        for (let i=0;i<=96;i++) pts.push(point(destination(at,radius,i/96*2*PI)));
        g.beginPath();let prev=null;
        for (const p of pts) {if (p) {if (prev && Math.abs(p.x-prev.x)<W/2) g.lineTo(p.x,p.y);else g.moveTo(p.x,p.y);}prev=p;}
        if (pts.every(Boolean)) {g.closePath();g.fillStyle=c;g.globalAlpha=alpha*(l.fillOpacity ?? .08);g.fill();}
        g.globalAlpha=alpha;g.lineWidth=S(l.width ?? 2);g.strokeStyle=c;g.stroke();
        const a=pts[Math.floor(96*(.08+j*.12))];
        if (a && tm.p>.1) label(l.label && s.rings.length===1 ? l.label : s.labels[j],a.x,a.y-S(18),l.size ?? 26,{align:'center',color:c});
      });
    } else if (l.type === 'pulse') {
      const a=anchor(l,view,u);if (!a) return;
      const alpha=g.globalAlpha, period=l.period ?? 1.8, r=S(l.r ?? 110);
      const sy=Math.max(.25,Math.cos((view.pitch || 0)*PI/180));
      for (let i=0;i<3;i++) {
        const phase=((tm.el/period+i/3)%1+1)%1;
        g.globalAlpha=alpha*(1-phase)*ease(tm.p);g.beginPath();g.ellipse(a.x,a.y,r*phase,r*phase*sy,0,0,PI*2);g.strokeStyle=c;g.lineWidth=S(l.width ?? 3);g.shadowColor=c;g.shadowBlur=S(10);g.stroke();
      }
      g.globalAlpha=alpha;g.shadowBlur=0;g.beginPath();g.arc(a.x,a.y,S(5),0,2*PI);g.fillStyle=c;g.fill();
    } else if (l.type === 'route-icon') {
      if (s.nodes.some(p=>!p) || tm.p>=1 && l.keep===false) return;
      const unit=S(1), progress=tm.p, edge=progress*s.total, tail=(l.tail ?? .28)*s.total;
      let offset=0, head=null, before=null;
      g.strokeStyle=c;g.lineWidth=S(l.width ?? 3);g.shadowColor=c;g.shadowBlur=S(9);
      s.lengths.forEach((len,j)=>{
        const a=s.nodes[j],b=s.nodes[j+1],origin=point(a),to=point(b);
        const project=q=>point(q), local=clamp((edge-offset)/Math.max(1e-10,len));
        // La proyección y elevación son exactamente las de arc.
        const sample=k=>arcPoint(a,b,k,view,unit,l,project,origin,to);
        g.beginPath();let prev=null;
        for(let i=0;i<=64;i++) {
          const k=Math.min(local,i/64), pos=offset+k*len, q=sample(k);
          if (pos>=Math.max(0,edge-tail) && pos<=edge && q) {
            if(prev && Math.abs(q.x-prev.x)<W/2) line(prev,q);prev=q;
          } else prev=null;
          if (i/64>=local) break;
        }
        g.stroke();
        if (edge>=offset && (edge<offset+len || j===s.lengths.length-1)) {
          head=sample(local);before=sample(Math.max(0,local-.002));
          if (local===0) {const next=sample(.002);if(head && next)before={x:2*head.x-next.x,y:2*head.y-next.y};}
        }
        offset+=len;
      });
      g.shadowBlur=0;
      if (head && before) {
        const name=l.icon || 'plane', bearing=(l.iconAngle != null ? l.iconAngle*PI/180 : ICON_BEARINGS[name] ?? 0);
        const angle=Math.atan2(head.y-before.y,head.x-before.x)-bearing;
        // Los perfiles laterales conservan casco y orugas abajo al ir al oeste.
        const reflect=['warship','tank'].includes(name) && bearing===0 && Math.cos(angle)<0;
        icon(name,head.x,head.y,S(l.size ?? 30),reflect?angle+(angle<0?PI:-PI):angle,reflect);
      }
    } else if (l.type === 'front-line') {
      const edge=(s.lengths.at(-1) || 0)*ease(tm.p);let prev=null,last=null;
      g.beginPath();
      for(let i=0;i<s.points.length;i++) {
        if(s.lengths[i]>edge)break;
        const q=point(s.points[i]);if(q){if(prev && Math.abs(q.x-prev.x)<W/2)g.lineTo(q.x,q.y);else g.moveTo(q.x,q.y);}prev=q;if(q)last=q;
      }
      g.setLineDash([S(l.dash ?? 12),S(l.gap ?? 8)]);g.strokeStyle=c;g.lineWidth=S(l.width ?? 4);g.shadowColor=c;g.shadowBlur=S(l.glow ?? 14);g.stroke();g.setLineDash([]);g.shadowBlur=0;
      if(l.label && last)label(l.label,last.x+S(12),last.y-S(22),l.size ?? 26,{color:c});
    } else if (l.type === 'geo-label') {
      const a=anchor(l,view,u);if (!a)return;
      g.translate(a.x,a.y);g.rotate((l.angle ?? 0)*PI/180);g.globalAlpha*=(l.opacity ?? .5)*ease(tm.p);
      label(String(l.text || '').toUpperCase(),0,0,l.size ?? 30,{align:'center',tracking:l.tracking ?? 5,weight:l.weight ?? 500,style:'italic'});
    } else {
      const size=l.size ?? (l.type==='quote-card'?40:28), width=l.width ?? (l.type==='timeline' && portrait?260:900);
      const events=s.events || [], n=events.length, vertical=l.type==='timeline' && portrait;
      const quoteLines=l.type==='quote-card'?wrapText(s.quote,S(width-132),str=>measure(str,size),5):null;
      const step=Math.max(104,3*size+8);
      const h=l.type==='quote-card'?Math.max(440,200+quoteLines.length*size*1.22):l.type==='timeline'?(vertical?n*step+38:Math.max(170,100+2.5*size)):110;
      const margin=Math.min(W,H)*.035, fit=Math.min(1,(W-2*margin)/S(width),(H*.8-2*margin)/S(h));
      const a=anchor({...l,x:l.x ?? (vertical?.17:.5),y:l.y ?? (l.type==='quote-card'?.42:l.type==='choropleth'?.72:vertical?.47:.68)},view,u);if(!a)return;
      const halfW=S(width)*fit/2,halfH=S(h)*fit/2;
      const cx=Math.max(margin+halfW,Math.min(W-margin-halfW,a.x)),cy=Math.max(margin+halfH,Math.min(H*.8-margin-halfH,a.y));
      g.translate(cx,cy);g.scale(fit,fit);g.globalAlpha*=ease(tm.p);
      const left=-S(width/2),top=-S(h/2);
      rrect(g,left,top,S(width),S(h),S(8));g.fillStyle=theme.colors.panel;g.fill();
      const pad=S(26),inner=S(width)-2*pad;
      if (l.type==='quote-card') {
        g.save();g.beginPath();g.rect(left,top,S(width)*ease(tm.p),S(h));g.clip();
        label('“',left+pad,top+S(76),110,{color:c});
        quoteLines.forEach((str,i)=>label(str,left+pad+S(64),top+S(76+i*size*1.22),size,{weight:l.weight ?? 600}));
        const im=image(l.src),photo=im?S(64):0,by=top+S(h-80);
        if(im){g.save();g.beginPath();g.arc(left+pad+photo/2,by,photo/2,0,2*PI);g.clip();const z=Math.max(photo/im.width,photo/im.height);g.drawImage(im,left+pad+(photo-im.width*z)/2,by-photo/2+(photo-im.height*z)/2,im.width*z,im.height*z);g.restore();}
        const x=left+pad+(im?photo+S(20):0),space=inner-(im?photo+S(20):0);
        label(trim(l.name,space,30),x,by-S(8),30,{color:c});
        if(l.role)label(trim(l.role,space,22),x,by+S(24),22,{color:col('dim'),weight:500});
        g.restore();
      } else if (l.type==='timeline') {
        let current=-1;for(let i=0;i<n;i++)if(t>=events[i].at)current=i;
        const cell=vertical?S(step):inner/Math.max(1,n),start=left+pad;
        events.forEach((e,i)=>{
          const x=vertical?start+S(18):start+cell*(i+.5),y=vertical?top+S(64)+cell*i:top+S(48),active=t>=e.at,alpha=g.globalAlpha;
          g.globalAlpha=alpha*(active?1:.3);
          if(i<n-1){g.beginPath();line({x,y},{x:vertical?x:x+cell,y:vertical?y+cell:y});g.strokeStyle=i<current?c:col('dim');g.lineWidth=S(2);g.stroke();}
          if(i===current){g.beginPath();g.arc(x,y,S(17),0,PI*2);g.strokeStyle=c;g.lineWidth=S(2);g.stroke();}
          g.beginPath();g.arc(x,y,S(7),0,PI*2);g.fillStyle=active?c:col('dim');g.fill();
          const tx=vertical?x+S(34):x,ty=vertical?y-S(17):y+S(42),space=vertical?inner-S(54):cell-S(12),align=vertical?'left':'center';
          label(trim(e.date,space,size-4),tx,ty,size-4,{align,color:col('dim'),weight:500});
          const rows=wrapText(e.label,space,str=>measure(str,size),2);
          rows.forEach((str,j)=>label(str,tx,ty+S((j+1)*(size+3)),size,{align,color:active?col('white'):col('dim')}));
          if(e.icon)icon(e.icon,vertical?left+S(width)-S(24):x,vertical?y+S(57):y-S(24),S(12));
          g.globalAlpha=alpha;
        });
      } else if (l.type==='choropleth') {
        const {colors,domain}=choroplethScale(l,col),x=left+pad,y=top+S(26),barWidth=inner;
        const gr=g.createLinearGradient(x,0,x+barWidth,0);colors.forEach((c,i)=>gr.addColorStop(domain.length===colors.length && domain.at(-1)>domain[0]?(domain[i]-domain[0])/(domain.at(-1)-domain[0]):i/(colors.length-1),c));
        g.fillStyle=gr;g.fillRect(x,y,barWidth,S(18));
        label(trim(s.labels[0],inner*.45,size),x,y+S(48),size,{weight:l.weight ?? 500});
        label(trim(s.labels[1],inner*.45,size),x+barWidth,y+S(48),size,{align:'right',weight:l.weight ?? 500});
      }
    }
  }
  return {needsLibrary,draw};
}

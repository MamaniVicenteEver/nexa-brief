export function overlaps(a,b,gap=0){return a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;}
export function safeRect(W,H,layout){const s=layout.safe;return {x:W*s.left,y:H*s.top,w:W*(1-s.left-s.right),h:H*(1-s.top-s.bottom)};}
const limit=(n,a,b)=>Math.max(a,Math.min(b,n));
// Stable ordering and conservative full-size bounds make seeking independent of history.
function place(nodes,safe,gap,gravity=false){
 const boxes=[],overflow=[];
 const ordered=[...nodes].sort(gravity?((a,b)=>Number(b.w>safe.w*.6)-Number(a.w>safe.w*.6)||(a.w>safe.w*.6?b.priority-a.priority:b.h-a.h)||a.index-b.index):((a,b)=>b.priority-a.priority||a.index-b.index));
 for(const node of ordered){
  const w=Math.min(node.w,safe.w),h=node.h;
  if(h>safe.h){overflow.push({id:node.id,reason:'too_tall'});continue;}
  const px=limit(node.preferred.x-w/2,safe.x,safe.x+safe.w-w),py=limit(node.preferred.y-h/2,safe.y,safe.y+safe.h-h);
  const xs=[px,safe.x,safe.x+safe.w-w,...boxes.flatMap(b=>[b.x+b.w+gap,b.x-w-gap])].filter(x=>x>=safe.x-.01&&x+w<=safe.x+safe.w+.01);
  const ys=[py,safe.y,safe.y+safe.h-h,...boxes.flatMap(b=>[b.y+b.h+gap,b.y-h-gap])].filter(y=>y>=safe.y-.01&&y+h<=safe.y+safe.h+.01);
  let best=null,cost=Infinity;
  for(const x of new Set(xs))for(const y of new Set(ys)){
   const candidate={id:node.id,x,y,w,h};
   if(boxes.some(b=>overlaps(candidate,b,gap)))continue;
   const score=gravity?(y-safe.y)*1e6+x-safe.x:(x-px)**2+(y-py)**2;
   if(score<cost){best=candidate;cost=score;}
  }
  if(best)boxes.push({...best,node});else overflow.push({id:node.id,reason:'capacity'});
 }
 return {boxes,overflow};
}
export function arrange(nodes,safe,gap){
 const preferred=place(nodes,safe,gap);
 if(!preferred.overflow.length)return preferred;
 // Repack fragmented empty space before treating it as genuine capacity overflow.
 const compact=place(nodes,safe,gap,true);
 return compact.overflow.length<preferred.overflow.length?compact:preferred;
}
export function wrap(text,maxWidth,measure){
 const lines=[];let current='';
 for(const word of String(text??'').split(/\s+/).filter(Boolean)){
  if(measure(word)>maxWidth){
   if(current){lines.push(current);current='';}
   for(const letter of word){if(current&&measure(current+letter)>maxWidth){lines.push(current);current='';}current+=letter;}
  }else if(current&&measure(current+' '+word)>maxWidth){lines.push(current);current=word;}
  else current=current?current+' '+word:word;
 }
 if(current)lines.push(current);return lines;
}

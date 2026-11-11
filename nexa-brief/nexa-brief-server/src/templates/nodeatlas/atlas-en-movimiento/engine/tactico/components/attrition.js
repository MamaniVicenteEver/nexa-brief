export const attritionParams={
  losses:{type:'array',default:[],doc:'Bajas [{at: segundos relativos, count: entero positivo}]; retira las últimas unidades.'},
  reinforce:{type:'array',default:[],doc:'Refuerzos [{at: segundos relativos, count: entero positivo}]; entran por el borde.'},
  persist:{type:'boolean',default:false,doc:'Conserva las unidades estacionadas hasta out o fin de escena.'},
};
export function attritionErrors(i){const errors=[];for(const kind of ['losses','reinforce']){if(!Array.isArray(i[kind]??[])){errors.push(`${kind} requiere una lista`);continue;}for(const event of i[kind]||[])if(!event||!Number.isFinite(event.at)||event.at<0||!Number.isInteger(event.count)||event.count<1)errors.push(`${kind} requiere {at: segundos relativos >= 0, count: entero positivo}`);}if(i.persist!=null&&typeof i.persist!=='boolean')errors.push('persist requiere booleano');return errors;}
export function attrition(i,lt,base){const rein=(i.reinforce||[]).filter(e=>lt>=e.at).reduce((n,e)=>n+e.count,0),lost=(i.losses||[]).filter(e=>lt>=e.at).reduce((n,e)=>n+e.count,0);return Math.max(0,base+rein-lost);}
export function fadeLoss(g,i,lt,x,y,size,color){for(const e of i.losses||[]){const age=lt-e.at;if(age<0||age>.35)continue;g.save();g.globalAlpha*=1-age/.35;g.strokeStyle=color;g.lineWidth=Math.max(1,size*.07);g.beginPath();g.arc(x,y,size*(.3+age),0,Math.PI*2);g.stroke();g.restore();}}
export function labelCount(label,n){return String(label||'').replaceAll('{n}',String(n));}

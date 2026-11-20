// Misma sintaxis y normalización que Proto.makeTimer, sin cargar su reproductor DOM.
const norm=s=>String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]/g,'').trim();
export function timerFromWords(words=[]){
  const W=words.map(w=>({w:norm(w.word),s:w.start,e:w.end}));
  const missing=new Set();
  function T(value,fallback=0){
    if(value==null)return fallback;
    if(typeof value==='number')return value;
    let s=String(value).trim();
    if(!s.startsWith('@'))return /^[-+]?\d+(\.\d+)?$/.test(s)?Number(s):fallback;
    s=s.slice(1);let offset=0,m=s.match(/([+-]\d+(?:\.\d+)?)$/);
    if(m){offset=Number(m[1]);s=s.slice(0,-m[1].length);}
    const end=s.endsWith(':end');if(end)s=s.slice(0,-4);
    let nth=1;m=s.match(/#(\d+)$/);if(m){nth=+m[1];s=s.slice(0,-m[0].length);}
    const tokens=norm(s).split(/\s+/).filter(Boolean);let hit=0;
    for(let i=0;tokens.length&&i+tokens.length<=W.length;i++)if(tokens.every((v,j)=>W[i+j].w===v)&&++hit===nth)return(end?W[i+tokens.length-1].e:W[i].s)+offset;
    missing.add(value);return fallback;
  }
  T.missing=missing;return T;
}

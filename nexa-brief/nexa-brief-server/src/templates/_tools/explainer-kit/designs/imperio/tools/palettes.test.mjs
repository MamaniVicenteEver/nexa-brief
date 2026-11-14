import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const file = new URL('../components/_imperio.js', import.meta.url);
function runtime() {
 const K = { fonts: new Set(), norm: s => String(s).normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().trim(), family() {}, clamp: (v,a=0,b=1)=>Math.min(b,Math.max(a,v)), lerp:(a,b,q)=>a+(b-a)*q, ease:{out:q=>q} };
 vm.runInNewContext(fs.readFileSync(file,'utf8'), { window:{Kit:K}, console, URLSearchParams, location:{search:"?paused=1"}, document:{createElement:()=>({getContext:()=>({})})} });
 return K.imperio;
}
test('país y alias no dependen de la carga de mapas; Alemania conserva negro/rojo/oro',()=>{
 const IM=runtime();
 for(const name of ['Germany','Alemania','alemania','DE']) assert.deepEqual(Array.from(IM.flagFor(name).colors), ['#000000','#dd0000','#ffce00']);
 assert.deepEqual(Array.from(IM.flagFor('FR').colors),['#0055a4','#ffffff','#ef4135']);
 assert.equal(IM.flagFor('Japón'),null);
});
test('paleta histórica explícita, fallback neutro y hex corto válidos',()=>{
 const IM=runtime();
 assert.deepEqual(Array.from(IM.flagFor('Germany','#000000,#ffffff,#dd0000').colors),['#000000','#ffffff','#dd0000']);
 assert.deepEqual(Array.from(IM.flagFor('Atlantis').colors),Array.from(IM.flagFor('','neutral').colors));
 assert.notEqual(IM.flagFor('Atlantis'),null);
 assert.notEqual(IM.flagFor('Germany','red,broken'),null);
 assert.equal(IM.flagFor('Germany','classic'),null);
 assert.equal(IM.tone('#d00'), 'rgba(221,0,0,1)');
});
test('el disco y los rayos pintan la paleta alemana sin carmesí japonés ni NaN',()=>{
 const IM=runtime(), colors=[];
 const gradient={addColorStop:(q,c)=>colors.push(c)};
 const G=new Proxy({createRadialGradient:()=>gradient,createLinearGradient:()=>gradient,fillRect(){colors.push(this.fillStyle);}}, {get:(o,k)=>k in o?o[k]:(()=>{})});
 IM.tex=()=>({sun:{}});
 const flag=IM.flagFor('Germany');
 IM.sun(G,20,20,10,0,{flag});
 assert.ok(colors.includes('rgba(255,206,0,1)'));
 colors.length=0;
 IM.rays(G,20,20,{n:12,grow:1,len:100,colors:flag.rays});
 assert.ok(colors.some(c=>c.startsWith('rgba(255,206,0,')));
 assert.ok(colors.some(c=>c.startsWith('rgba(221,0,0,')));
 assert.ok(colors.every(c=>!c.includes('NaN')));
});

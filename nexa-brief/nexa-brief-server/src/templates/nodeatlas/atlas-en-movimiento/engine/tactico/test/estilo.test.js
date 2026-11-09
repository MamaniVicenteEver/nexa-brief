import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {makeEstilo} from '../util.js';
import {create,validateScene} from '../core.js';
const data=JSON.parse(await readFile(new URL('../estilos/v4-atlas.json',import.meta.url),'utf8'));
test('fusión profunda, formato, colores y dibujo del token',()=>{
 const s=makeEstilo(data,'escritorio',{colores:{tinta2:'#123456@.5'},formatos:{escritorio:{estilos:{unidad:{nombre:{tam:31}}}}}});
 assert.equal(s.txt('unidad.nombre').size,31);assert.equal(s.txt('unidad.tipo').size,16);
 assert.equal(s.col('tinta2@.5'),'rgba(18,52,86,0.25)');assert.equal(s.col('#ffffff@.5'),'rgba(255,255,255,0.5)');
 assert.equal(s.slot('titular').izq,96);assert.equal(s.fijo('flag.marker'),true);assert.equal(s.fijo('label.unit'),false);
 assert.equal(typeof s.num('trazos.flecha.linea.grosor'),'number');assert.throws(()=>s.num('ausente'));
 const painted=[],g={save(){},restore(){},fillText(...args){painted.push(args)},strokeText(){}};
 s.txt('unidad.nombre').draw(g,'Prueba',5,6);assert.ok(painted.length);assert.equal(painted.at(-1)[0],'PRUEBA');
});
test('runtime rechaza estilo desconocido y formato inválido',async()=>{
 const c={st:{W:100,H:100,U:1}};await assert.rejects(create(c,{items:[],estilo:'no-existe'}),/Estilo desconocido/);
 assert.ok(validateScene({items:[],formato:'cuadrado'}).errors.some(e=>e.path==='formato'));
});
test('prepare y draw reciben los tokens del estilo y el formato resuelto',async()=>{
 const {Tactico}=await import('../core.js');let prepared,drawn;
 Tactico.component('prueba.estilo',{prepare(item,ctx){prepared=[ctx.estilo.id,ctx.formato];},draw(g,s,v,env){drawn=[env.estilo.col('acento'),env.estilo.txt('unidad.nombre').tam,env.formato];}});
 const c={st:{W:1080,H:1080,U:1}};
 const r=await create(c,{items:[{id:'demo',type:'prueba.estilo',t:0,fade:0}],estilo:'v4-atlas',formato:'escritorio',estiloOverrides:{colores:{acento:'#123456'}}});
 r.draw({save(){},restore(){},globalAlpha:1},{},1);
 assert.deepEqual(prepared,['v4-atlas','escritorio']);assert.deepEqual(drawn,['rgb(18,52,86)',26,'escritorio']);
});

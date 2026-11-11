import test from 'node:test';
import assert from 'node:assert/strict';
import {Tactico,create,loadComponents} from '../core.js';
import {attrition,attritionErrors,labelCount} from '../components/attrition.js';

test('bajas y refuerzos conservan el conteo en seeks fuera de orden',()=>{
  const item={losses:[{at:3,count:4}],reinforce:[{at:5,count:3}]};
  assert.deepEqual([7,2,4,10,3].map(t=>attrition(item,t,12)),[11,12,8,11,8]);
  assert.equal(labelCount('TROPAS {n}',11),'TROPAS 11');
  assert.deepEqual(attritionErrors({losses:[{at:-1,count:2}]}).length,1);
});

test('persist mantiene el item después de dur y lo retira en out',async()=>{
  await loadComponents();
  Tactico.component('test.persistencia',{animated:false,draw(g,s){g.samples.push(s.lt);}});
  const c={st:{W:1080,H:1920,U:1}},runtime=await create(c,{duration:12,items:[{id:'p',type:'test.persistencia',t:0,dur:3,persist:true,fade:0}]});
  const g={samples:[],globalAlpha:1,save(){},restore(){}},v={W:1080,H:1920,project:()=>({x:0,y:0,visible:true})};
  runtime.draw(g,v,10);runtime.draw(g,v,2);runtime.draw(g,v,12);
  assert.deepEqual(g.samples,[10,2]);
});

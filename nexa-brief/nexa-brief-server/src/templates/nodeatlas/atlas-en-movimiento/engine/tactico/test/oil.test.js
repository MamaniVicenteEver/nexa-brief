import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Tactico} from '../core.js';
import '../components/oil.js';

test('oil components validate options and advance only their animated mechanisms', async () => {
  const previous = globalThis.Image;
  globalThis.Image = class { async decode() {} };
  try {
    for (const name of ['oil.barrel','oil.pumpjack','oil.derrick','oil.platform']) {
      const def = Tactico.get(name);
      assert.deepEqual(def.validate(def.demo), []);
      assert.ok(def.validate({scale:-1}).length);
      assert.ok(def.validate({period:0}).length);
      const internal = await def.prepare(def.demo, {});
      assert.equal(internal.frames.length, name === 'oil.barrel' ? 1 : 8);
      const seen = [];
      const g = {globalAlpha:1, save(){}, restore(){}, translate(){}, drawImage(img){seen.push(img.src)}};
      const item = {...def.demo, entrance:0};
      const view = {project:()=>({x:0,y:0,visible:true})};
      def.draw(g,{item,internal,lt:0},view,{U:1});
      def.draw(g,{item,internal,lt:.6},view,{U:1});
      if (name === 'oil.barrel') assert.equal(seen[0], seen[1]);
      else assert.notEqual(seen[0], seen[1]);
      assert.equal(def.animated({item:{...item,animate:false},lt:2}), false);
    }
  } finally {
    if (previous === undefined) delete globalThis.Image;
    else globalThis.Image = previous;
  }
});

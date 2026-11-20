import test from 'node:test';
import assert from 'node:assert/strict';
import {createGeo} from '../geo.js';

test('La Escocia declarada no se sustituye por un condado estadounidense homónimo',()=>{
  const county={type:'Feature',properties:{id:'US-NC-165',name:'Scotland'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}};
  const scotland={label:[-4,56],geometry:{type:'Polygon',coordinates:[[[-5,55],[-3,55],[-3,58],[-5,55]]]}};
  const geo=createGeo({regions:{scotland}}, {}, [{features:[county]}]);
  assert.equal(geo.region('scotland'),scotland);
  assert.deepEqual(geo.place('Scotland'),[-4,56]);
  assert.equal(geo.region('US-NC-165').geometry,county.geometry);
});

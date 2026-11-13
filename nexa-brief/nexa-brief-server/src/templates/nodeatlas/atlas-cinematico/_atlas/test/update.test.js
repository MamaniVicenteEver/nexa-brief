import {test} from 'node:test';
import assert from 'node:assert/strict';
import {apply} from '../update.js';
import {createCamera} from '../camera.js';

test('padding de cámara es determinista en seeks y se recalcula con la altura',()=>{
 const camera=createCamera([{t:0,center:[0,0],zoom:1},{t:1,center:[0,0],zoom:1,lift:0.3,dur:2}]);
 const levels=Array.from({length:4},()=>({minzoom:0,maxzoom:20,size:10,color:'#fff',width:1}));
 const look={dem:'land',projection:'globe',sky:{},terrain:{exaggeration:1},sat:{visible:false},base:{visible:false},shade:{visible:false},borders:{visible:false,levels},labels:{visible:false,levels},highlight:{styles:{}}};
 let last; const map={getSource:()=>({tiles:['/cache/terrain-land/{z}/{x}/{y}.png']}),getProjection:()=>({type:'globe'}),getSky:()=>look.sky,getTerrain:()=>({source:'dem',exaggeration:1}),jumpTo:p=>{last=structuredClone(p);},getLayer:()=>null};
 const c={camera,lookAt:()=>look,map,providers:[{id:'terrain-land'}],base:'/',st:{W:800,H:1000},satIds:[],baseLayers:[],highlights:[]};
 apply(c,3); const first=last; assert.deepEqual(first.padding,{top:600,bottom:0,left:0,right:0});
 apply(c,0); assert.deepEqual(last.padding,{top:0,bottom:0,left:0,right:0});
 apply(c,3); assert.deepEqual(last,first);
 c.st.H=500; apply(c,3); assert.equal(last.padding.top,300);
});

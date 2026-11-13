const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const regs = {};
const elem = (text='') => ({textContent:text, setAttribute(){},remove(){}});
let rendered;
const R = {SKETCHES:{},root:()=>elem(),measure:()=>100,shape:()=>[], text:(_ctx,_g,text)=>{rendered=elem(text);return rendered;}, label:()=>elem(), hand:()=>elem(),draw(){},type(){},exitFx(){}};
const Kit = {rough:R,lerp:(a,b,t)=>a+(b-a)*t,clamp:x=>x,prog:()=>1,register:x=>{regs[x.name]=x}};
vm.runInNewContext(fs.readFileSync(process.argv[2],'utf8'),{Kit,window:{},console});
const counter=regs['rough.counter'];
function render(locale) {
 const ctx={C:{palette:{},...(locale ? {locale}: {})},stage:{W:1920,H:1080,u:10,cx:960,cy:540,portrait:false}};
 const p={prefix:'',suffix:'',from:0,to:6000000000,dur:2.2,label:'',unit:''};
 const instance=counter.create(ctx,p);
 instance.render(4,{dur:8},4);
 return rendered.textContent;
}
assert.equal(render(), '6.000.000.000');
assert.equal(render('es-419'), '6.000.000.000');
assert.equal(render('en-US'), '6,000,000,000');
assert.equal(render('pt-BR'), '6.000.000.000');
console.log('actual rough.counter: ES default, es-419, en-US, pt-BR passed');

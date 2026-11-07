import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTranscript} from '../components/captions.js';
import {Tactico,validateScene} from '../core.js';

test('transcripción: una pausa larga no arrastra palabras al grupo siguiente y la puntuación cierra el grupo',()=>{
 const words=[{word:' Uno',start:0,end:.1},{word:' dos.',start:.1,end:.2},{word:' tres',start:.3,end:.4},{word:' cuatro',start:2,end:2.2}];
 const groups=buildTranscript(words,4,{maxWords:3});
 assert.deepEqual(groups.map(c=>c.text),['Uno dos','tres','cuatro']);
 assert.equal(groups[0].t1,.3);assert.equal(groups[1].t1,1);assert.ok(Math.abs(groups[2].t1-2.8)<1e-12);
 assert.equal(buildTranscript(words,1,{maxWords:1}).length,3);
});

test('transcripción: el renderer respeta desplazamiento de tiempo, color y contorno configurados sin estado del cuadro anterior',()=>{
 const d=Tactico.get('caption.transcript'),calls=[];
 const g={save(){},restore(){},translate(){},scale(){},strokeText(t){calls.push(['stroke',this.strokeStyle,this.lineWidth,t]);},fillText(t){calls.push(['fill',this.fillStyle,t]);}};
 const caps=buildTranscript([{word:' Uno',start:1,end:2}],3,{});
 const item={timeOffset:1,size:50,strokeColor:'#123456',strokeWidth:4,color:'#abcdef',upper:false};
 d.draw(g,{t:.5,item,internal:{caps}},null,{W:1080,H:1920,U:1});
 assert.deepEqual(calls,[['stroke','#123456',4,'Uno'],['fill','#abcdef','Uno']]);
 calls.length=0;d.draw(g,{t:5,item,internal:{caps}},null,{W:1080,H:1920,U:1});assert.equal(calls.length,0);
 d.draw(g,{t:.5,item,internal:{caps}},null,{W:1080,H:1920,U:1});assert.equal(calls.length,2);
});

test('transcripción: rechaza acceso fuera de la plantilla y cantidades de palabras fraccionarias',()=>{
 for(const patch of [{lyricsUrl:'../otra/letra.json'},{lyricsUrl:'https://example.com/lyrics.json'},{maxWords:2.5}]){
  const result=validateScene({duration:14,items:[{id:'cap',type:'caption.transcript',t:0,dur:14,...patch}]});
  assert.ok(result.errors.length>0);
 }
});

test('transcripción: reducción regulable y posición horizontal diez píxeles más abajo',()=>{
 const d=Tactico.get('caption.transcript'),translations=[],fonts=[];
 const g={save(){},restore(){},translate(x,y){translations.push([x,y]);},scale(){},strokeText(){},fillText(){fonts.push(this.font);}};
 const caps=buildTranscript([{word:' Texto',start:1,end:2}],3,{});
 const item={enabled:true,size:45,reductionPercent:35.6,y:.9,yLandscape:.915,yOffsetLandscape:10,color:'#ffffff'};
 d.draw(g,{t:1.3,item,internal:{caps}},null,{W:1920,H:1080,U:1});
 assert.ok(Math.abs(parseFloat(fonts[0].split(' ')[1])-31.878)<1e-10);
 assert.ok(Math.abs(translations[0][1]-998.2)<1e-10);
 d.draw(g,{t:1.3,item,internal:{caps}},null,{W:1080,H:1920,U:1});
 assert.ok(Math.abs(parseFloat(fonts[1].split(' ')[1])-28.98)<1e-10);assert.equal(translations[1][1],1728);
 for(const percent of [0,30,35,40]){
  item.reductionPercent=percent;d.draw(g,{t:1.3,item,internal:{caps}},null,{W:1080,H:1920,U:1});
  assert.ok(Math.abs(parseFloat(fonts.at(-1).split(' ')[1])-45*(1-percent/100))<1e-10);
 }
});
test('transcripción: enabled false no dibuja; porcentajes inválidos se rechazan',()=>{
 const d=Tactico.get('caption.transcript');
 d.draw(new Proxy({},{get(){throw Error('No debe dibujar ni modificar el canvas');}}),{t:1.3,item:{enabled:false},internal:{caps:buildTranscript([{word:' Texto',start:1,end:2}],3,{})}},null,{W:1080,H:1920,U:1});
 for(const patch of [{reductionPercent:-1},{reductionPercent:96},{reductionPercent:NaN},{enabled:'false'},{yOffsetLandscape:Infinity}]){
  const result=validateScene({duration:14,items:[{id:'cap',type:'caption.transcript',t:0,dur:14,...patch}]});assert.ok(result.errors.length>0);
 }
 assert.equal(d.params.enabled.default,true);assert.equal(d.params.reductionPercent.default,35.6);assert.equal(d.params.color.default,'#ffffff');
});

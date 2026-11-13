async demos => {
  const {createHud}=await import('/nodeatlas/atlas-cinematico/_atlas/hud.js');
  const {destination,distance,arcPoint}=await import('/nodeatlas/atlas-cinematico/_atlas/map-geometry.js');
  const {nearestLongitude}=await import('/nodeatlas/atlas-cinematico/_atlas/projection.js');
  const {ICON_BEARINGS}=await import('/nodeatlas/atlas-cinematico/_atlas/hud-geo-narrative.js');
  const {createChoropleths}=await import('/nodeatlas/atlas-cinematico/_atlas/choropleth.js');
  const assert=(v,s)=>{if(!v)throw Error(s);};
  const canvas=document.createElement('canvas'),g=canvas.getContext('2d',{willReadFrequently:true});
  let labels=[],rotations=[],warnings=[],strokeTransforms=[],bounds=[];
  const text=g.fillText.bind(g),rotate=g.rotate.bind(g),stroke=g.stroke.bind(g),oldWarn=console.warn;
  g.stroke=(...a)=>{if(a[0] instanceof Path2D)strokeTransforms.push(g.getTransform());return stroke(...a);};
  console.warn=(...a)=>warnings.push(a.join(' '));
  g.fillText=(s,x,y,...a)=>{
    labels.push(String(s));const w=g.measureText(s).width,fs=Number(g.font.match(/([\d.]+)px/)[1]),left=x-(g.textAlign==='center'?w/2:g.textAlign==='right'?w:0),tr=g.getTransform();
    const pts=[[left,y-fs/2],[left+w,y-fs/2],[left,y+fs/2],[left+w,y+fs/2]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(tr));
    bounds.push([Math.min(...pts.map(p=>p.x)),Math.min(...pts.map(p=>p.y)),Math.max(...pts.map(p=>p.x)),Math.max(...pts.map(p=>p.y))]);text(s,x,y,...a);
  };
  g.rotate=a=>{rotations.push(a);rotate(a);};
  const times={'@inicio':1,'@medio':2,'@tercero':3,'@fin':7};
  const env={T:(v,d)=>typeof v==='number'?v:times[v]??d,place:v=>({origen:[-90,38],destino:[-65,39]})[v],loadImg:src=>new Promise(resolve=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>resolve(null);im.src=src;})};
  const view=(W,H,center=-77)=>({W,H,pitch:45,project:(lon,lat)=>({x:W*.5+(nearestLongitude(lon,center)-center)*W/80,y:H*.48-(lat-38)*H/80,k:1,visible:true})});
  const draw=(hud,t,v)=>{g.clearRect(0,0,canvas.width,canvas.height);labels=[];rotations=[];strokeTransforms=[];bounds=[];hud.draw(g,t,v);return canvas.toDataURL();};
  const results=[],prepared=[];
  for (const demo of demos) {
    const d=structuredClone(demo);d.t='@inicio';d.out='@fin';d.dur=2;
    if(d.type==='timeline')d.events=d.events.slice(0,3).map((e,i)=>({...e,t:['@inicio','@medio','@tercero'][i]}));
    const scene=d.type==='choropleth'?{layers:[d]}:{hud:[d]};
    const hud=createHud(scene,env);await hud.ready();prepared.push(hud);
    for(const [W,H] of [[576,1024],[1280,720]]) {
      canvas.width=W;canvas.height=H;const v=view(W,H);
      const before=draw(hud,.5,v),one=draw(hud,1.2,v),two=draw(hud,2.6,v);
      assert(before!==two,d.type+' no visible');assert(one!==two,d.type+' sin animación');
      draw(hud,5,v);assert(draw(hud,2.6,v)===two,d.type+' seek no determinista');
      assert(draw(hud,8,v)===before,d.type+' no sale');
      results.push({type:d.type,format:[W,H],seek:true,animated:true,exit:true});
    }
  }
  const largeFonts=[];
  for(const type of ['quote-card','timeline'])for(const [W,H] of [[576,1024],[1280,720]]){
    const d=structuredClone(demos.find(d=>d.type===type));d.size=60;d.width=1500;d.scale=1.4;d.x=.98;d.y=.94;
    if(type==='quote-card')d.text='Una declaración extensa para comprobar el tamaño de letra configurable sin invadir la atribución ni los subtítulos. '.repeat(2).slice(0,160);
    else d.events=d.events.map(e=>({...e,label:'Un acontecimiento con nombre extenso'}));
    const hud=createHud({hud:[d]},env);await hud.ready();canvas.width=W;canvas.height=H;draw(hud,2.6,view(W,H));
    assert(bounds.every(([x,y,r,b])=>x>=0&&y>=0&&r<=W&&b<=H*.8),'fuente grande fuera del cuadro '+type+' '+W);
    largeFonts.push({type,format:[W,H],size:60,safe:true});
  }
  // Distancias reales y determinismo del pulso periódico.
  const end=destination([12,45],1500,.8);assert(Math.abs(distance([12,45],end)*6371.0088-1500)<1e-7,'radio geodésico');
  canvas.width=576;canvas.height=1024;
  const pulse=createHud({hud:[{type:'pulse',at:[-77,38],t:0,period:1.8,dur:.1}]},env);await pulse.ready();
  assert(draw(pulse,2,view(576,1024))===draw(pulse,3.8,view(576,1024)),'periodo del pulso');
  const headings=[];
  for(const name of ['plane','warship','tank'])for(const anti of [false,true])for(const east of [true,false]){
    const a=anti?[170,35]:[-90,35],b=anti?[-170,35]:[-65,35];
    const d={type:'route-icon',icon:name,from:east?a:b,to:east?b:a,t:0,dur:4,lift:0,keep:true};
    const hud=createHud({hud:[d]},env);await hud.ready();const v=view(576,1024,anti?180:-77);
    draw(hud,2,v);const matrix=strokeTransforms.at(-1);const angle=Math.atan2(matrix.b,matrix.a)+(ICON_BEARINGS[name]||0);
    assert(east?Math.cos(angle)>.99:Math.cos(angle)<-.99,'rumbo '+name+' '+anti+' '+east);
    if(name!=='plane')assert(matrix.d>0,'casco/orugas invertidos '+name);
    headings.push({icon:name,antimeridian:anti,direction:east?'east':'west',angle,upright:matrix.d>0});
  }
  const route={type:'route-icon',from:'origen',via:[[-80,40]],to:'destino',icon:'plane',t:0,dur:2,keep:false};
  const transient=createHud({hud:[route]},env);await transient.ready();assert(draw(transient,3,view(576,1024))===draw(transient,-1,view(576,1024)),'keep false');
  const hiddenView={...view(576,1024),project:()=>({visible:false,x:0,y:0,k:1})};
  for(const type of ['pulse','range-ring','geo-label','route-icon','front-line']){
    const d=demos.find(d=>d.type===type),hud=createHud({hud:[d]},env);await hud.ready();
    assert(draw(hud,2.6,hiddenView)===draw(hud,-1,hiddenView),'ocultación '+type);
  }
  const quote=createHud({hud:[{type:'quote-card',t:0,text:'á'.repeat(170),name:'Prueba'}]},env);await quote.ready();
  draw(quote,2,view(576,1024));draw(quote,3,view(576,1024));assert(warnings.filter(w=>w.includes('supera 160')).length===1,'aviso de cita');
  // Espiar la preparación confirma 159 caracteres y una elipsis, sin leer el dibujo.
  const {prepareGeoNarrative}=await import('/nodeatlas/atlas-cinematico/_atlas/hud-geo-narrative.js');
  const item={type:'quote-card',text:'á'.repeat(170)};let shown='';
  const prep=prepareGeoNarrative([item],{T:x=>x,warn:()=>{}});
  prep.draw(item,{p:1,el:2,dur:.5},{g,t:2,view:view(576,1024),u:1,S:x=>x,text:str=>{if(String(str).length===160)shown=str;},measure:()=>0,anchor:()=>({x:288,y:400}),rrect:()=>{},col:x=>x,theme:{colors:{panel:'#000'}},image:()=>null,drawIcon:()=>{}});
  assert(shown==='á'.repeat(159)+'…','recorte Unicode de cita');
  const portrait=createHud({hud:[{type:'quote-card',t:0,text:'Prueba de retrato opcional.',name:'LAYOUT DE EJEMPLO',src:location.origin+'/sandbox/nodepolitics/resumen-geopolitico-demo/assets/media/noticiero-logo-test.png'}]},env);
  await portrait.ready();assert(portrait.missing().length===0,'precarga retrato de cita');draw(portrait,2,view(576,1024));
  const a=[-90,38],b=[-65,39],v=view(576,1024),project=at=>v.project(...at);
  const arc=arcPoint(a,b,.5,v,1,{lift:100},project,project(a),project(b));
  assert(Number.isFinite(arc.x+arc.y),'curva común de arc');
  // Una fuente y una capa para 35 regiones, sin fuentes ni setData durante cuadros.
  const choro=demos.find(d=>d.type==='choropleth'),style={sources:{},layers:[{id:'satellite',type:'raster'},{id:'labels',type:'symbol'}]};
  const choropleths=createChoropleths({layers:[choro]},{T:env.T,region:id=>({geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,0]]]}}),col:c=>c,missing:()=>{}});
  choropleths.appendTo(style);assert(Object.keys(style.sources).length===1 && style.layers.filter(l=>l.type==='fill').length===1,'capas coroplético');
  assert(style.layers[1].type==='fill' && style.layers[2].type==='symbol','relleno intercalado tras símbolos');
  assert(Object.values(style.sources)[0].data.features.length>=25,'países');let paint=0;
  const map={setPaintProperty:()=>paint++};for(let i=0;i<180;i++)choropleths.apply(map,2.6);assert(paint===1,'actualiza pintura asentada');
  // Durante el dibujo no se crean recursos pesados ni relojes.
  const resources={Image:0,canvas:0,Path2D:0,Intl:0,timer:0};
  const image=window.Image,path=window.Path2D,intl=Intl.NumberFormat,element=document.createElement.bind(document),timeout=window.setTimeout;
  window.Image=function(...a){resources.Image++;return new image(...a);};window.Path2D=function(...a){resources.Path2D++;return new path(...a);};
  Intl.NumberFormat=function(...a){resources.Intl++;return new intl(...a);};document.createElement=(n,...a)=>{if(n==='canvas')resources.canvas++;return element(n,...a);};window.setTimeout=(...a)=>{resources.timer++;return timeout(...a);};
  const bench=[];
  try{
    for(let j=0;j<prepared.length;j++){
      const start=performance.now();for(let i=0;i<180;i++)prepared[j].draw(g,1+(i%100)/30,view(576,1024));
      bench.push({type:demos[j].type,meanMs:(performance.now()-start)/180});
    }
  }finally{window.Image=image;window.Path2D=path;Intl.NumberFormat=intl;document.createElement=element;window.setTimeout=timeout;console.warn=oldWarn;}
  assert(Object.values(resources).every(v=>v===0),'recursos por cuadro '+JSON.stringify(resources));
  return {results,largeFonts,headings,resources,bench,warnings,choropleth:{countries:Object.keys(choro.values).length,sources:1,layers:1,settledPaintUpdates:paint}};
}

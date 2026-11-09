import { runAtlas } from '../atlas.js';

// Every preview uses the public JSON entry through the production renderer.
// No visual component is implemented here a second time.
const status=document.getElementById('status');
try {
  const response=await fetch('../components.json');
  if(!response.ok)throw Error('No se pudo cargar el catálogo.');
  const query=new URLSearchParams(location.search);
  const catalog=await response.json(),name=query.get('only') || 'atlas.arrow';
  const component=catalog.components.find(item=>item.name===name);
  if(!component)throw Error('Componente no encontrado en el catálogo.');
  const scene={format:'atlas-v1',duration:8,lang:'es',look:'satelite-realista',camera:[{t:0,focus:[-97,34],span:60,pitch:58,bearing:4}],layers:[]};
  const demo=structuredClone(component.demo);
  if(component.target==='layers') {
    if(Array.isArray(demo.at))scene.camera[0].focus=demo.at;
    if(['arc','arrow'].includes(demo.type)) {
      // Use the existing demo's cached US→Brazil corridor.
      scene.camera=[{t:0,focus:[-58,-6],span:100,pitch:45,bearing:0}];
      demo.from=[-75,10];demo.to=[-52,-4];
    }
    if(demo.src)demo.src=new URL('../../atlas-cinematico/assets/'+demo.src,location.href).href;
    scene.layers.push(demo);
  } else if(component.target==='camera') {if(component.name==='atlas.cameraFly')scene.camera[0].focus=[3.5,48];scene.camera.push(demo);}
  else if(component.target==='looks')scene.looks=[demo];
  else if(component.target==='scene')Object.assign(scene,demo);
  else if(component.target==='scene.dataEntry') {const {id,...data}=demo;scene.data={[id]:data};scene.layers=[{type:'metric',dataRef:id,sub:'Mismo dato para flechas y tarjetas',t:0}];}
  else if(component.target==='scene.intro')scene.intro=demo;
  else if(component.target==='scene.captions')scene.captions=demo;
  else if(component.name==='atlas.animation')scene.layers=[{type:'metric',x:.5,y:.3,label:'ENTRADA Y SALIDA',value:25,unit:'%',sub:'Ejemplo ilustrativo',t:.5,...demo}];
  else if(component.target==='config.audio')scene.layers=[{type:'title',text:'NARRACIÓN + MAPAS',sub:'Entrada: song.mp3 + lyrics.json',t:0,y:.2,size:45}];
  const words='Los subtítulos siguen las palabras de la narración'.split(' ').map((word,i)=>({word,start:i*.65,end:(i+1)*.65}));
  await runAtlas({showcase:true,loadData:async()=>({scene,config:{configs:[{}]},lyrics:{segments:[{words}]}})});
  // The gallery owns its loop; Proto starts frozen so only one clock draws it.
  const total=window.__promo.total;
  const position=query.get("framePosition");
  const initial=position==="first" ? 0 : position==="middle" ? total/2 : position==="last" ? Math.max(0,total-.1) : Number(query.get("t"))>0 ? Math.min(Number(query.get("t")),total-.01) : 2.6;
  await window.__promo.seek(initial);
  const missing=window.__promo.missingTiles();
  status.textContent=missing.length ? 'Faltan recursos del mapa; preparar la caché antes de grabar.' : '';
  window.__atlasPreview={name,target:component.target,illustrative:true,currentTime:initial,missing};
  if(parent!==window)parent.postMessage({type:'nexa-animation-ready'},'*');
  if(query.get('autoplay')==='1') {
    let start;
    const tick=now=>{
      if(start==null)start=now;
      const t=(initial+(now-start)/1000)%total;
      window.__atlasPreview.currentTime=t;
      window.__nexaProtoControl.setTime(t,false);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
} catch(error) {
  status.textContent=error.message;console.error('[atlas showcase]',error);
  if(parent!==window)parent.postMessage({type:'nexa-animation-error'},'*');
}

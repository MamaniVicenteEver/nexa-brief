/* Isolated examples use the actual shared map renderer, never a production scene. */
(() => {
  const name = new URLSearchParams(location.search).get('only') || 'map.layer.arrow';
  const mapRoot = '/api/v1/explainer/files/sandbox/nodehistory/_mapas/';
  const cases = {
    'map.layer.fill': {type:'fill', region:'Bolivia', color:'#e3122a'},
    'map.layer.line': {type:'line', from:'Antofagasta', to:'La Paz', color:'#ffd21a', w:8, draw:2},
    'map.layer.arrow': {type:'arrow', from:'Antofagasta', to:'La Paz', color:'#ffd21a', w:8, draw:2},
    'map.layer.label': {type:'label', at:'Bolivia', text:'BOLIVIA', size:84, style:'big'},
    'map.layer.pin': {type:'pin', at:'La Paz', text:'LA PAZ', size:48},
    'map.layer.icon': {type:'icon', at:'La Paz', icon:'battle', size:150, text:'BATALLA'},
    'map.layer.flag': {type:'flag', at:'Bolivia', flag:'bo', size:130},
    'map.layer.photo': {type:'photo', at:'Bolivia', src:mapRoot+'media/sat-sudamerica.jpg', size:200, name:'IMAGEN'},
    'map.layer.year': {type:'year', text:'1904', size:150},
    'map.layer.big': {type:'big', text:'1879', sub:'AÑO DECISIVO', size:230},
    'map.layer.dot': {type:'dot', at:'La Paz', r:40},
    'map.layer.crowd': {type:'crowd', at:'La Paz', n:50, radius:150, dotR:9},
    'map.camera.key': {type:'pin', at:'La Paz', text:'CÁMARA', size:48},
    'map.region': {type:'fill', region:'Bolivia', color:'#e3122a'},
    'map.place': {type:'pin', at:'La Paz', text:'LUGAR', size:48},
    'map.satellite': {type:'label', at:'Bolivia', text:'MAPA SATELITAL', size:70},
    'map.transition.fade-in': {type:'label', at:'Bolivia', text:'ENTRADA', size:84, style:'big', fade:2},
    'map.transition.fade-out': {type:'label', at:'Bolivia', text:'SALIDA', size:84, style:'big', out:2, fadeOut:2},
  };
  const original = Proto.run;
  Proto.run = engine => {
    const isIntro = name === 'proto.intro';
    const isOutro = name === 'proto.outro';
    const scene = {end:8, camera:[{t:0,c:[-67,-20],span:32}], layers:cases[name] ? [{t:0,...cases[name]}] : []};
    if (name === 'map.camera.key') scene.camera.push({t:2,c:[-66,-16],span:12,dur:3});
    if (isIntro) scene.intro = {style:'v1',text:'UNA HISTORIA EN EL MAPA',dur:4};
    if (isOutro) scene.outro = {channel:'NODEHISTORY',handle:'@nodehistory',dur:6};
    const lyrics = {segments:[{words:[{word:'Una',start:0,end:1},{word:'historia',start:1,end:2},{word:'en',start:2,end:3},{word:'mapas',start:3,end:4}]}]};
    if (name === 'proto.captions') scene.captions = {enabled:true};
    const options = {...engine,sceneOptIn:true,loadData:async()=>({config:{configs:[{}]},scene,lyrics}),
      setup:async ctx=>{
        await engine.setup(ctx);
        if (name === 'proto.media-window') ctx.mediaWindows = {items:[{at:0,dur:7,kind:'photo',src:mapRoot+'media/sat-sudamerica.jpg',caption:'Imagen de ejemplo',aspect:'16:9',w:45}]};
      }};
    return original(options).then(async()=>{
      if (window.__promo) { await window.__promo.seek(isOutro ? 4 : 1); window.__promo.release(); }
      parent.postMessage({type:'nexa-animation-ready'},location.origin);
    }).catch(()=>parent.postMessage({type:'nexa-animation-error'},location.origin));
  };
})();

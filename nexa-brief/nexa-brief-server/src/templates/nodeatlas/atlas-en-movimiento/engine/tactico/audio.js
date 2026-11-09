import {makePlan, cueGain, duckGain} from './audio-plan.js';
const rootURL = new URL('../../',import.meta.url);
async function json(url) { const r = await fetch(url); if (!r.ok) throw Error(`Audio ${r.status}: ${url}`); return r.json(); }

// El audio de narración sigue siendo el reloj y la salida de Proto/NexaPlayerBridge.
// Nunca se conecta a MediaElementSource: volumen, mute y autoplay conservan su contrato.
export async function createAudio({scene, lyrics, T, derived, media, duration, baseURL=rootURL, context} = {}) {
  const catalog = await json(new URL('./sfx.json',import.meta.url));
  const plan = await makePlan(scene,catalog,{lyrics,T,derived,duration});
  const ac = context || new AudioContext(), master = ac.createGain(); master.connect(ac.destination);
  const buffers = new Map(), active = new Map(), listeners = [], problems = [];
  let frozen = true, disposed = false, anchor = null, timer, volume = 1, serial = 0;
  await Promise.all([...new Set(plan.cues.map(c => c.file))].map(async file => {
    try { const r = await fetch(new URL(file,baseURL)); if (!r.ok) throw Error(`HTTP ${r.status}`); buffers.set(file,await ac.decodeAudioData(await r.arrayBuffer())); }
    catch(e) { problems.push(`${file}: ${e.message}`); }
  }));
  const listen = (target,name,fn,opts) => { target?.addEventListener(name,fn,opts); listeners.push(() => target?.removeEventListener(name,fn,opts)); };
  function stop() { serial++; anchor = null; for (const {source,gain} of active.values()) { source.onended=null; try {source.stop();} catch {} source.disconnect(); gain.disconnect(); } active.clear(); }
  function setVolume(value = volume) { volume = Math.max(0,Math.min(1,Number(value)||0)); master.gain.value = volume*(media?.muted ? 0 : media?.volume ?? 1); }
  function schedule(cue, t, rate) {
    const buffer = buffers.get(cue.file); if (!buffer || active.has(cue.cue_id)) return;
    const from = Math.max(t,cue.at), end = cue.at+cue.dur;
    if (from >= end) return;
    const when = ac.currentTime + Math.max(0,(from-t)/rate), source = ac.createBufferSource(), gain = ac.createGain();
    source.buffer=buffer; source.playbackRate.value=rate; source.loop=cue.loop;
    source.loopStart=cue.source_in; source.loopEnd=buffer.duration;
    source.connect(gain); gain.connect(master);
    const value = at => cueGain(cue,at)*duckGain(at,plan.speech_ranges,plan.duck_db);
    gain.gain.setValueAtTime(value(from),when);
    // 20 ms: incluye extremos exactos de fades y ducking; seek retoma la envolvente absoluta.
    const points = new Set([from,end,cue.at+cue.fade_in,end-cue.fade_out]);
    for (const [s,e] of plan.speech_ranges) for (const p of [s-.02,s,e,e+.08]) points.add(p);
    for (let at=from+.02;at<end;at+=.02) points.add(at);
    for (const at of [...points].filter(p=>p>from&&p<=end).sort((a,b)=>a-b)) gain.gain.linearRampToValueAtTime(value(at),when+(at-from)/rate);
    const span = buffer.duration-cue.source_in, elapsed = from-cue.at;
    const offset = cue.source_in + (cue.loop ? elapsed%span : elapsed);
    source.onended=()=>{if(active.get(cue.cue_id)?.source===source)active.delete(cue.cue_id);source.disconnect();gain.disconnect();};
    active.set(cue.cue_id,{source,gain,at:from,end,offset});
    source.start(when,Math.min(offset,buffer.duration-.00001)); source.stop(when+(end-from)/rate);
  }
  function sync() {
    if (disposed || frozen || !media || media.paused || media.ended || media.seeking || media.readyState<3 || ac.state!=='running') { if(active.size)stop(); return; }
    const t=media.currentTime, rate=media.playbackRate || 1;
    if (t>=plan.duration) {stop();return;}
    if (anchor && Math.abs(t-(anchor.t+(ac.currentTime-anchor.clock)*anchor.rate))>.08) stop();
    if(!anchor)anchor={t,clock:ac.currentTime,rate};
    for(const cue of plan.cues)if(cue.at<t+.15*rate&&cue.at+cue.dur>t)schedule(cue,t,rate);
  }
  async function unlock() { if(disposed)return; try {await ac.resume();sync();}catch(e){problems.push(e.message);} }
  const resume = () => {frozen=false;stop();void unlock();};
  listen(media,'play',resume); listen(media,'playing',()=>{stop();sync();});
  for(const name of ['pause','ended','waiting','seeking'])listen(media,name,stop);
  for(const name of ['seeked','ratechange'])listen(media,name,()=>{stop();sync();});
  listen(media,'volumechange',()=>setVolume());
  listen(globalThis.window,'pointerdown',unlock,{capture:true}); listen(globalThis.window,'keydown',unlock,{capture:true});
  timer=setInterval(sync,25); setVolume();
  return {plan, context:ac, unlock, setVolume, pause(){frozen=true;stop();}, release(){frozen=false;sync();},
    seek(){frozen=true;stop();}, sync,
    stats:()=>({active:active.size,sources:[...active.entries()].map(([id,v])=>({id,at:v.at,end:v.end,offset:v.offset})),decoded:buffers.size,master_gain:master.gain.value,volume,context:ac.state,frozen,serial,errors:[...problems]}),
    dispose(){if(disposed)return;disposed=true;clearInterval(timer);stop();listeners.splice(0).forEach(f=>f());master.disconnect();if(!context)void ac.close();},
  };
}

// Instalar ANTES de importar atlas.js/plano.js; solo envuelve esta página.
export function installProtoAudio(Proto = globalThis.Proto) {
  if(!Proto || Proto.__tacticoAudioInstalled)return;
  Proto.__tacticoAudioInstalled=true;
  const run=Proto.run;
  Proto.run=function(options){
    const setup=options.setup,ready=options.onReady;let audio;
    return run.call(this,{...options,
      async setup(c){
        await setup?.(c);
        if(c.scene.sound?.enabled===false)return;
        const media=document.getElementById('audio');
        if(!c.C.audio?.src || !media)return;
        let lyrics={segments:[{words:c.words || []}]};
        if(!c.words?.length && c.C.lyricsUrl)lyrics=await json(new URL(c.C.lyricsUrl,location.href));
        const derived=c.tactico?.sfx();
        try { audio=await createAudio({scene:c.scene,lyrics,T:c.T,derived,media,duration:c.scene.duration ?? c.scene.end ?? lyrics.metadata?.duration ?? media.duration}); }
        catch(error){console.error('Tactico audio:',error);window.__tacticoAudioError=error.message;}
      },
      onReady(c){
        ready?.(c);
        if(!audio)return;
        window.__tacticoAudio=audio;
        const promo=window.__promo,seek=promo.seek,release=promo.release;
        promo.seek=async function(...args){audio.seek();return seek.apply(this,args);};
        promo.release=function(...args){const result=release.apply(this,args);audio.release();return result;};
        // Bridge usa __nexaProtoControl.release (no __promo.release).
        // Al reanudar, el evento media.play rearma el mismo reloj.
        addEventListener('pagehide',()=>audio.dispose(),{once:true});
      },
    });
  };
}

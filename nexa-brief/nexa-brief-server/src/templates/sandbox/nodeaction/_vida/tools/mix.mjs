import {mkdir,mkdtemp,rm,copyFile,writeFile,readFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {loadEpisode} from './runtime.mjs';
import {connectedActivity} from './voice.mjs';
import {run,killChildren} from './process.mjs';
const RATE=48000;
const db=x=>20*Math.log10(Math.max(x,1e-12));
function rms(samples,a=0,b=samples.length){
 a=Math.max(0,a);b=Math.min(samples.length,b);let sum=0;
 for(let i=a;i<b;i++)sum+=samples[i]**2;
 return b>a?Math.sqrt(sum/(b-a)):0;
}
async function decode(file,tmp,name){
 const dest=join(tmp,`${name}.f32`);
 await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',file,'-ar',String(RATE),'-ac','1','-f','f32le',dest]);
 const bytes=await readFile(dest);return new Float32Array(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
}
async function levels(file){
 const result=await run('ffmpeg',['-hide_banner','-i',file,'-af','loudnorm=I=-16:TP=-2:LRA=11:print_format=json','-f','null','-']);
 const match=result.stderr.match(/\{\s*"input_i"[\s\S]*?\}/);
 if(!match)throw new Error('No se pudieron medir LUFS y true peak');
 return JSON.parse(match[0]);
}
export function mixLine(line,clipDuration){
 if(!line.words?.length)throw new Error(`${line.id}: faltan palabras de Whisper para medir la actividad conectada`);
 const lastWord=Math.max(...line.words.map(w=>w.e));
 const trimOut=Math.min(clipDuration,line.trimOut??clipDuration);
 if(!(trimOut>line.trimIn))throw new Error(`${line.id}: recorte de audio vacío`);
 // El fin de Whisper no es un límite acústico: respetar solo el trim explícito.
 return {...line,trimOut,lastWord,audio_t1:line.t0+trimOut-line.trimIn};
}
// Región de voz: al menos 60 ms de bloques activos, con huecos <80 ms.
// Contar actividad, no la anchura total, evita unir clic + señal tenue como voz.
export function voiceRegions(samples,rate=RATE){
 const frame=Math.max(1,Math.round(rate*.005)),regions=[];
 for(let a=0;a<samples.length;a+=frame){
  const b=Math.min(samples.length,a+frame);
  if(db(rms(samples,a,b))<=-48)continue;
  const prev=regions.at(-1);
  if(prev&&a-prev[1]<Math.round(rate*.08)){prev[1]=b;prev[2]+=b-a;}
  else regions.push([a,b,b-a]);
 }
 return regions.filter(r=>r[2]>=Math.round(rate*.06)).map(([a,b])=>[a,b]);
}

// Detector independiente en el PCM final: ventanas de 4 ms, paso de una muestra.
// Energía = media de cuadrados, no amplitud RMS. DFT rectangular exacta.
export function startClicks(samples,rate=RATE,voiceRegions=null){
 const frame=Math.max(1,Math.round(rate*.005)),regions=[],prefix=new Float64Array(samples.length+1);
 for(let i=0;i<samples.length;i++)prefix[i+1]=prefix[i]+samples[i]**2;
 for(let a=0;a<samples.length;a+=frame){
  const b=Math.min(samples.length,a+frame);
  if((prefix[b]-prefix[a])/(b-a)<=10**(-48/10))continue;
  if(regions.length&&a-regions.at(-1)[1]<=Math.round(rate*.02))regions.at(-1)[1]=b;
  else regions.push([a,b]);
 }
 const voice=(voiceRegions??regions).filter(([a,b])=>b-a>=Math.round(rate*.06)).sort((a,b)=>a[0]-b[0]);
 const width=Math.round(rate*.004),history=Math.round(rate*.03),hop=1,details=[];
 // Tabla DFT: resolución de muestra sin repetir trigonometría por ventana.
 const bins=Math.floor(width/2)+1,cosine=new Float64Array(bins*width),sine=new Float64Array(bins*width);
 for(let k=0;k<bins;k++)for(let j=0;j<width;j++){
  const angle=2*Math.PI*k*j/width;cosine[k*width+j]=Math.cos(angle);sine[k*width+j]=Math.sin(angle);
 }
 let v=0;
 for(let a=history;a+width<=samples.length;a+=hop){
  const b=a+width;
  while(v<voice.length&&voice[v][1]<=a)v++;
  if(v<voice.length&&voice[v][0]<b)continue;
  const energy=(prefix[b]-prefix[a])/width,previous=(prefix[a]-prefix[a-history])/history;
  if(energy<=30*Math.max(previous,1e-24)||energy<=10**(-48/10))continue;
  let total=0,high=0;
  for(let k=0;k<=Math.floor(width/2);k++){
   let real=0,imag=0;
   for(let j=0;j<width;j++){real+=samples[a+j]*cosine[k*width+j];imag-=samples[a+j]*sine[k*width+j];}
   const power=(real*real+imag*imag)*(k===0||k===width/2?1:2);total+=power;
   if(k*rate/width>4000)high+=power;
  }
  if(total>0&&high/total>.4)details.push({t0:a/rate,t1:b/rate,energy_ratio:energy/Math.max(previous,1e-24),rms_db:10*Math.log10(energy),high_frequency_fraction:high/total});
 }
 return details;
}

export function audioMetrics(samples,lines,{ambient=false}={}){
 const windows=[],protectedVoice=[];
 const reports=lines.map(l=>{
  const nextStart=Math.min(samples.length/RATE,...lines.filter(n=>n.t0>l.t0).map(n=>n.t0));
  const start=Math.max(0,Math.round(l.t0*RATE)),end=Math.min(samples.length,Math.round(l.audio_t1*RATE));
  const region=l.connected_activity_end==null?connectedActivity(samples.subarray(start,end),RATE,l.lastWord-l.trimIn):null;
  const activityEnd=l.connected_activity_end??(region?region[1]/RATE+l.trimIn:null);
  if(activityEnd==null)throw new Error(`${l.id}: no se encontró actividad conectada`);
  const absoluteEnd=l.t0+activityEnd-l.trimIn;
  const regions=l.voice_regions??voiceRegions(samples.subarray(start,end),RATE).map(([a,b])=>[a/RATE+l.trimIn,b/RATE+l.trimIn]);
  const leading=l.voice_start??regions[0]?.[0]??l.trimIn;
  for(const [a,b] of regions)protectedVoice.push([Math.round((l.t0+Math.max(l.trimIn,a)-l.trimIn)*RATE),Math.round((l.t0+Math.min(l.trimOut,b)-l.trimIn)*RATE)]);
  const beforeEnd=Math.min(end,Math.max(start,Math.round((l.t0+leading-l.trimIn)*RATE)));
  let jump=0;
  for(const t of [l.t0,absoluteEnd+.04,l.audio_t1,l.t1]){
   const q=Math.round(t*RATE),a=Math.max(1,q-240),b=Math.min(samples.length,q+241);
   for(let i=a;i<b;i++)jump=Math.max(jump,Math.abs(samples[i]-samples[i-1]));
  }
  // Las palabras de Whisper pueden acabar antes que la sílaba real. Medir solo
  // después de su actividad conectada; nunca etiquetar sus huecos como ruido.
  const a=Math.max(0,Math.round(absoluteEnd*RATE));
  const b=Math.min(samples.length,Math.round(nextStart*RATE));
  let tail=0;
  for(let i=a;i<b;i+=960){
   const stop=Math.min(b,i+960),value=rms(samples,i,stop);tail=Math.max(tail,value);
   if(db(value)>-35)windows.push({id:l.id,t0:i/RATE,t1:stop/RATE,db:db(value)});
  }
  return {id:l.id,t0:l.t0,t1:l.t1,audio_t1:l.audio_t1,trimIn:l.trimIn,trimOut:l.trimOut,clip:l.clip,
   last_word:l.lastWord,connected_activity_end:activityEnd,voice_start:leading,voice_regions:regions,
   leading_energy_before_voice_db:db(rms(samples,start,beforeEnd)),
   tail_db_after_last_word:db(tail),boundary_jump:jump,
   ...(l.final_syllable_reference_rms>0?{final_syllable_rms_delta_db:db(rms(samples,
    Math.round((l.t0+Math.max(l.trimIn,l.lastWord)-l.trimIn)*RATE),Math.round(absoluteEnd*RATE)))-db(l.final_syllable_reference_rms)}:{})};
 });
 // También informar energía anterior a la primera línea (p.ej. un ambiente).
 const first=Math.round(Math.min(samples.length/RATE,...lines.map(l=>l.t0))*RATE);
 for(let a=0;a<first;a+=960){const b=Math.min(first,a+960),value=db(rms(samples,a,b));
  if(value>-35)windows.push({t0:a/RATE,t1:b/RATE,db:value});}
 const clicks=startClicks(samples,RATE,protectedVoice);
 return {lines:reports,start_clicks:clicks.length,start_click_details:clicks,non_speech_loud_windows:windows.length,non_speech_loud_window_details:windows,
  metrics_definition:{leading:'RMS integral entre inicio de línea y primera región de voz en WAV fuente; 5 ms a -48 dBFS, >=60 ms activos acumulados, huecos <80 ms; sin Whisper',
   start_clicks:'ventanas de 4 ms, paso 1 muestra (48 kHz); energía media >30 veces los 30 ms previos; RMS >-48 dBFS y DFT rectangular con >40% de energía estrictamente sobre 4 kHz; fuera de regiones de voz con >=60 ms activos acumulados, 5 ms a -48 dBFS y huecos <80 ms (WAV fuente; sin Whisper para el inicio); contadas en MP3 decodificado',tail:'máxima RMS de ventanas de 20 ms desde fin de actividad conectada hasta siguiente línea o fin de mezcla; campo histórico tail_db_after_last_word',
   activity:'bloques de 10 ms > -48 dBFS, huecos <150 ms; región que contiene we-100 ms o primera que empieza después de we; medida en WAV fuente',
   boundary:'máximo |Δmuestra| en ±5 ms de t0, actividad+40 ms, audio_t1 y t1, MP3 final decodificado',
   non_speech:'ventanas de 20 ms después de actividad conectada y antes de la siguiente línea (también antes de la primera), RMS > -35 dBFS; Whisper puede adelantarse a la voz real',ambient_included:ambient}};
}
export async function mixDialogue(c,output){
 const tmp=await mkdtemp('/tmp/vida-escena-mix-');
 const onSignal=signal=>{process.exitCode=signal==='SIGINT'?130:143;killChildren(signal);};
 process.on('SIGINT',onSignal);process.on('SIGTERM',onSignal);
 try{
  const sampleCount=Math.round(c.duration*RATE),ambient=c.episode.resources?.ambient;
  const out=join(tmp,'dialogue.mp3');
  if(!c.lines.length&&!ambient){
   await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','anullsrc=r=48000:cl=mono',
    '-af',`atrim=end_sample=${sampleCount}`,'-c:a','libmp3lame','-b:a','192k',out]);
   const report={duration:c.duration,decoded_samples:sampleCount,lufs:null,true_peak_db:null,
    ...audioMetrics(new Float32Array(sampleCount),[]),normalization:'silencio digital; LUFS no definido'};
   await mkdir(dirname(resolve(output)),{recursive:true});await copyFile(out,output);
   await writeFile(output.replace(/\.mp3$/,'.mix.json'),JSON.stringify(report,null,2)+'\n');return report;
  }
  const lines=[];
  for(const [i,l] of c.lines.entries()){
   const pcm=await decode(resolve(c.paths.audioBase,l.clip),tmp,`line-${i}`);
   const line=mixLine(l,pcm.length/RATE),region=connectedActivity(pcm,RATE,line.lastWord);
   if(!region)throw new Error(`${l.id}: no se encontró actividad conectada`);
   const activityEnd=Math.min(region[1]/RATE,line.trimOut);
   const syllableStart=Math.max(line.trimIn,line.lastWord),syllableEnd=activityEnd;
   const regions=voiceRegions(pcm,RATE).map(([a,b])=>[a/RATE,b/RATE]);
   lines.push({...line,connected_activity_end:activityEnd,voice_start:regions[0]?.[0]??line.trimIn,voice_regions:regions,
    final_syllable_reference_rms:rms(pcm,Math.round(syllableStart*RATE),Math.round(syllableEnd*RATE))});
  }
  const args=['-hide_banner','-loglevel','error','-y'];
  for(const l of lines)args.push('-i',resolve(c.paths.audioBase,l.clip));
  if(ambient)args.push('-stream_loop','-1','-i',resolve(dirname(c.paths.episode),ambient));
  const filters=lines.map((l,i)=>`[${i}:a]atrim=start=${l.trimIn}:end=${l.trimOut},asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0,l.trimOut-l.trimIn-.025)}:d=0.025,adelay=${Math.round(l.t0*RATE)}S:all=1[a${i}]`);
  if(ambient)filters.push(`[${lines.length}:a]volume=${c.episode.resources.ambientGain??.08}[amb]`);
  filters.push(`${lines.map((_,i)=>`[a${i}]`).join('')}${ambient?'[amb]':''}amix=inputs=${lines.length+(ambient?1:0)}:normalize=0,apad,atrim=end_sample=${sampleCount}[mix]`);
  const raw=join(tmp,'dialogue.wav');
  await run('ffmpeg',[...args,'-filter_complex',filters.join(';'),'-map','[mix]','-ar',String(RATE),'-ac','1','-c:a','pcm_s24le',raw]);
  const m=await levels(raw);
  const norm=`loudnorm=I=-16:TP=-2:LRA=11:measured_I=${m.input_i}:measured_TP=${m.input_tp}:measured_LRA=${m.input_lra}:measured_thresh=${m.input_thresh}:offset=${m.target_offset}:linear=true`;
  const normalized=join(tmp,'normalized.wav');
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',raw,'-af',`${norm},aresample=48000,aformat=channel_layouts=mono,apad,atrim=end_sample=${sampleCount}`,'-ar',String(RATE),'-ac','1','-c:a','pcm_s24le',normalized]);
  await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',normalized,'-c:a','libmp3lame','-b:a','192k',out]);
  let measured=await levels(out),gain=0,ceiling=-2.2;
  // Verify the encoded file: MP3 can overshoot the PCM true peak.
  for(let pass=0;pass<4;pass++){
   const level=Number(measured.input_i),peak=Number(measured.input_tp);
   if(Math.abs(level+16)<=.2&&peak<=-1.5)break;
   gain+=-16-level;
   if(peak>-1.5)ceiling-=Math.max(.2,peak+1.7);
   // alimiter lookahead at 192 kHz / attack=5 ms is 959 samples.
   // Explicit pad/trim also works on ffmpeg 4.4 (no latency option).
   const limit=10**(ceiling/20);
   await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-i',normalized,'-af',
    `aresample=192000,volume=${gain}dB,apad=pad_len=959,alimiter=limit=${limit}:attack=5:release=50:level=false,atrim=start_sample=959,asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=mono,apad,atrim=end_sample=${sampleCount}`,
    '-c:a','libmp3lame','-b:a','192k',out]);
   measured=await levels(out);
  }
  if(!Number.isFinite(Number(measured.input_i))||Math.abs(Number(measured.input_i)+16)>.5||Number(measured.input_tp)>-1.5)
   throw new Error(`Mezcla fuera de nivel: ${measured.input_i} LUFS / ${measured.input_tp} dBTP`);
  let decoded=await decode(out,tmp,'final');
  if(!ambient){
   // Quitar ruido cambia el loudness integrado. Conservar además el RMS de la
   // sílaba fuente: ganancia local, transición antes de we, sin recortar muestras.
   // Repetir sobre PCM (no MP3) para evitar pérdidas acumuladas del códec.
   const protectedPcm=decoded;
   let masterGain=1;
   for(let pass=0;pass<4;pass++){
    const pcm=Float32Array.from(protectedPcm,v=>v*masterGain);
    for(const l of lines){
     const a=Math.max(0,Math.round((l.t0+Math.max(l.trimIn,l.lastWord)-l.trimIn)*RATE));
     const b=Math.min(pcm.length,Math.round((l.t0+l.connected_activity_end-l.trimIn)*RATE));
     const current=rms(pcm,a,b);
     if(!(b>a&&current>0&&l.final_syllable_reference_rms>0))continue;
     const gain=l.final_syllable_reference_rms/current;
     const rampStart=Math.max(Math.round(l.t0*RATE),a-2400),rampEnd=Math.min(pcm.length,b+1920);
     for(let i=rampStart;i<rampEnd;i++){
      const weight=i<a?(i-rampStart)/Math.max(1,a-rampStart):i<b?1:(rampEnd-i)/Math.max(1,rampEnd-b);
      pcm[i]*=1+(gain-1)*weight;
     }
    }
    const protectedFile=join(tmp,'syllables.f32');
    await writeFile(protectedFile,Buffer.from(pcm.buffer));
    await run('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','f32le','-ar',String(RATE),'-ac','1','-i',protectedFile,
     '-c:a','libmp3lame','-b:a','192k',out]);
    measured=await levels(out);decoded=await decode(out,tmp,'final');
    const level=Number(measured.input_i),peak=Number(measured.input_tp);
    const syllablesOk=lines.every(l=>{
     const a=Math.round((l.t0+Math.max(l.trimIn,l.lastWord)-l.trimIn)*RATE),b=Math.round((l.t0+l.connected_activity_end-l.trimIn)*RATE);
     return b<=a||!l.final_syllable_reference_rms||Math.abs(db(rms(decoded,a,b))-db(l.final_syllable_reference_rms))<=.5;
    });
    if(Math.abs(level+16)<=.5&&peak<=-1.5&&syllablesOk)break;
    if(pass===3)throw new Error('No se pueden preservar sílabas y nivel/pico en la misma mezcla');
    masterGain*=10**((-16-level)/20);
   }
  }
  if(decoded.length!==sampleCount)throw new Error(`Duración alterada: ${decoded.length} != ${sampleCount} muestras`);
  const report={duration:c.duration,decoded_samples:decoded.length,lufs:Number(measured.input_i),true_peak_db:Number(measured.input_tp),
   ...audioMetrics(decoded,lines,{ambient:!!ambient}),normalization:'EBU R128, dos pasadas; -16 LUFS ±0,5; true peak verificado en MP3 ≤ -1,5 dBTP; sin ambiente, RMS de sílaba final preservado ±0,5 dB con ganancia local suave'};
  await mkdir(dirname(resolve(output)),{recursive:true});await copyFile(out,output);
  await writeFile(output.replace(/\.mp3$/,'.mix.json'),JSON.stringify(report,null,2)+'\n');return report;
 }finally{process.off('SIGINT',onSignal);process.off('SIGTERM',onSignal);await rm(tmp,{recursive:true,force:true});}
}
if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url){try{
 const path=process.argv[2];if(!path)throw new Error('Uso: node tools/mix.mjs <episodio.json> [dialogue.mp3]');
 const c=await loadEpisode(path,{images:false}),out=process.argv[3]??resolve(dirname(c.paths.episode),c.episode.resources?.dialogue??'dialogue.mp3');
 console.log(JSON.stringify(await mixDialogue(c,out),null,2));
}catch(e){console.error(e.message);process.exitCode=1;}}

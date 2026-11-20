#!/usr/bin/env node
// VARIANTE EFECTOS AUDIBLES: ganancia por cue = pico objetivo (dBFS, antes del ducking) - pico medido del archivo de origen.
const SRC_PEAK={"naval-engine-low":-7.4,"explosion-far":-1.4,"whoosh":-2.8,"industrial-hum":-2.1,"jet-pass":-6.3,"helicopter":-4.6};
const TGT_PEAK={"naval-engine-low":-17,"explosion-far":-6,"whoosh":-12,"industrial-hum":-24,"jet-pass":-9,"helicopter":-10};
const fxGain=c=>Math.round(((TGT_PEAK[c.id]??-12)-(SRC_PEAK[c.id]??-3))*10)/10;
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import {makePlan,dbGain} from '../audio-plan.js';
const exec=promisify(execFile);
const run=async args=>(await exec('ffmpeg',['-hide_banner','-nostdin','-y','-threads','1','-filter_complex_threads','1',...args],{maxBuffer:16*1024*1024}));
const readJSON=async p=>JSON.parse(await readFile(p,'utf8'));
async function facts(path){const {stdout}=await exec('ffprobe',['-v','error','-select_streams','a:0','-show_entries','stream=duration,sample_rate,channels:format=duration','-of','json',path]);const p=JSON.parse(stdout);return {duration:Number(p.streams[0].duration??p.format.duration),sample_rate:Number(p.streams[0].sample_rate),channels:p.streams[0].channels};}
const normFilter='loudnorm=I=-16:TP=-1.5:LRA=11';
function parseMeasure(stderr){const blocks=stderr.match(/\{\s*"input_i"[\s\S]*?\}/g);if(!blocks?.length)throw Error('ffmpeg no devolvió medición LUFS');return JSON.parse(blocks.at(-1));}
async function measure(path){return parseMeasure((await run(['-i',path,'-af',normFilter+':print_format=json','-f','null','-'])).stderr);}
function duckExpression(ranges){const low=dbGain(-4),parts=ranges.map(([s,e])=>`if(lt(t,${s-.02}),1,if(lt(t,${s}),1+(${low}-1)*(t-${s}+.02)/.02,if(lte(t,${e}),${low},if(lt(t,${e+.08}),${low}+(1-${low})*(t-${e})/.08,1))))`);return parts.length?parts.join('*'):'1';}
export async function mixdown({root=resolve(process.cwd()),sceneFile=join(root,'assets/scene.json'),narration=join(root,'assets/song.mp3'),lyricsFile=join(root,'assets/lyrics.json'),output=join(root,'assets/mix.mp3'),planFile=join(dirname(output),'mix.plan.json'),duration}={}){
  root=resolve(root);
  const temp=await mkdtemp(join(tmpdir(),'atlas-mix-'));
  try{
    const scene=await readJSON(sceneFile),catalog=await readJSON(fileURLToPath(new URL('../sfx.json',import.meta.url))),lyrics=await readJSON(lyricsFile);
    const voice=join(temp,'voice.wav');
    const cut=duration==null?[]:['-t',String(duration)];
    await run(['-v','error','-i',narration,...cut,'-ar','48000','-ac','2','-c:a','pcm_s16le',voice]);
    const voiceFacts=await facts(voice);duration=voiceFacts.duration;
    const plan=await makePlan(scene,catalog,{lyrics,duration});
    const inputs=['-i',voice],filters=[],labels=[];
    filters.push('[0:a]asetpts=PTS-STARTPTS[voice]');
    for(const [i,c] of plan.cues.entries()){
      const file=resolve(root,c.file);if(file!==root&&!file.startsWith(root+'/'))throw Error(`Asset fuera de plantilla: ${c.file}`);
      inputs.push('-i',file);
      const span=c.duration-c.source_in;
      const loop=c.loop?`,aloop=loop=-1:size=${Math.round(span*48000)}`:'';
      filters.push(`[${i+1}:a]aresample=48000,aformat=channel_layouts=stereo,atrim=start=${c.source_in},asetpts=PTS-STARTPTS${loop},atrim=duration=${c.dur},volume=${fxGain(c)}dB,afade=t=in:st=0:d=${c.fade_in},afade=t=out:st=${c.dur-c.fade_out}:d=${c.fade_out},adelay=${Math.round(c.at*48000)}S:all=1[s${i}]`);
      labels.push(`[s${i}]`);
    }
    if(labels.length){filters.push(`${labels.join('')}amix=inputs=${labels.length}:normalize=0:dropout_transition=0,volume='${duckExpression(plan.speech_ranges)}':eval=frame[fx]`);filters.push(`[voice][fx]amix=inputs=2:normalize=0:dropout_transition=0,apad,atrim=duration=${duration}[out]`);}
    else filters.push(`[voice]anull[out]`);
    const graph=join(temp,'graph.txt'),raw=join(temp,'raw.wav');await writeFile(graph,filters.join(';\n'));
    await run(['-v','error',...inputs,'-filter_complex_script',graph,'-map','[out]','-ar','48000','-c:a','pcm_f32le',raw]);
    const measured=await measure(raw);
    const pass2=`${normFilter}:measured_I=${measured.input_i}:measured_TP=${measured.input_tp}:measured_LRA=${measured.input_lra}:measured_thresh=${measured.input_thresh}:offset=${measured.target_offset}:linear=true`;
    await mkdir(dirname(output),{recursive:true});
    await run(['-v','error','-i',raw,'-af',pass2,'-ar','48000','-ac','2','-c:a','libmp3lame','-b:a','192k',output]);
    const measuredFinal=await measure(output);
    // Verificar la duración decodificada (MP3 contiene delay/padding fuera del audio útil).
    const check=join(temp,'decoded.wav');await run(['-v','error','-i',output,'-ar','48000','-ac','2','-c:a','pcm_s16le',check]);
    const finalFacts=await facts(check),encodedFacts=await facts(output);
    const integrated=Number(measuredFinal.input_i),peak=Number(measuredFinal.input_tp);
    const verified={integrated_lufs:integrated,true_peak_dbtp:peak,decoded_duration:finalFacts.duration,container_duration:encodedFacts.duration,narration_duration:duration,duration_delta:finalFacts.duration-duration,pass:Math.abs(integrated+16)<=.5&&peak<=-1&&Math.abs(finalFacts.duration-duration)<=1/48000};
    const hash=createHash('sha256').update(await readFile(narration)).digest('hex');
    const result={...plan,narration:{file:narration,sha256:hash,source_unchanged:true,...voiceFacts},scene:sceneFile,output,normalization:{target_lufs:-16,target_true_peak:-1.5,method:'loudnorm two-pass whole mix; original song file unchanged',before:measured,after:measuredFinal},verification:verified,filter_graph:filters,notes:['Ganancia absoluta por cue; ducking adicional -9 dB sobre bus SFX, voz sin ducking.','Duración de narración decodificada; --duration solo para recortar la prueba.','Para grabar: muxear este MP3; el audio WebAudio de preview no se captura en frames.']};
    await mkdir(dirname(planFile),{recursive:true});await writeFile(planFile,JSON.stringify(result,null,2)+'\n');
    if(!verified.pass)throw Error(`Mezcla fuera de objetivo: ${JSON.stringify(verified)}`);
    return result;
  }finally{await rm(temp,{recursive:true,force:true});}
}
export async function runCLI(defaults={}){
  try{const args=process.argv.slice(2),opts={...defaults},names={'--root':'root','--scene':'sceneFile','--narration':'narration','--lyrics':'lyricsFile','--output':'output','--plan':'planFile','--duration':'duration'};
    for(let i=0;i<args.length;i++){const key=names[args[i]];if(!key||args[i+1]==null)throw Error('Uso: node tools/mixdown.mjs [--root DIR] [--scene JSON] [--narration MP3] [--lyrics JSON] [--output MP3] [--plan JSON] [--duration segundos]');opts[key]=key==='duration'?Number(args[++i]):resolve(args[++i]);}
    if(opts.duration!=null&&(!Number.isFinite(opts.duration)||opts.duration<=0))throw Error('--duration debe ser positivo');
    const plan=await mixdown(opts);console.log(JSON.stringify({output:plan.output,cues:plan.cues.length,...plan.verification},null,2));
  }catch(e){console.error(e.message);process.exitCode=1;}
}

if(process.argv[1]&&pathToFileURL(resolve(process.argv[1])).href===import.meta.url)await runCLI();

import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import {worker,connectedActivity,leadingActivity} from '../tools/voice.mjs';
import {mixLine,audioMetrics,mixDialogue,startClicks,voiceRegions} from '../tools/mix.mjs';
const exec=promisify(execFile);
const python=process.env.VIDA_PYTHON??new URL('../../../../../../.venv/bin/python',import.meta.url).pathname;
const harness=String.raw`
import ast,json,math,re,subprocess,wave,tempfile
from pathlib import Path
from types import SimpleNamespace as NS
import numpy as np
source=json.loads(__import__('sys').argv[1])
names={'readwav','writewav','ffmpeg','levels','active_regions','connected_activity','trailing_burst','trailing_noise','postprocess','inspect','leading_click','remove_leading_click'}
tree=ast.parse(source)
exec(compile(ast.Module(body=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name in names],type_ignores=[]),'offline-worker','exec'))
tokens=lambda text:re.findall(r'\w+',text.lower())
import difflib,os
rate=48000
x=np.zeros(round(1.6*rate))
a,b=round(.1*rate),round(.9*rate)
x[a:b]=.15*np.sin(2*np.pi*220*np.arange(b-a)/rate)
a,b=round(1.25*rate),round(1.4*rate)
x[a:b]=.7*np.sin(2*np.pi*7300*np.arange(b-a)/rate)
words=[{'w':'hola','s':.1,'e':.9}]
class Whisper:
 def transcribe(self,*args,**kwargs):
  return [NS(text='hola',words=[NS(word='hola',start=.1,end=.9)])],None
whisper=Whisper()
`;
async function offline(code){
 const result=await exec(python,['-B','-c',harness+'\n'+code,JSON.stringify(worker)],{maxBuffer:2**20,env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
 return JSON.parse(result.stdout);
}
test('la regla detecta la ráfaga aislada y protege palabras, pausas cortas y regiones largas',async()=>{
 const r=await offline(String.raw`
found=trailing_burst(x,rate,.9)
short=np.zeros_like(x);short[:round(.9*rate)]=x[:round(.9*rate)];short[round(1.0*rate):round(1.15*rate)]=.5
long=np.zeros_like(x);long[:round(.9*rate)]=x[:round(.9*rate)];long[round(1.1*rate):]=.5
print(json.dumps({'found':[i/rate for i in found], 'short':trailing_burst(short,rate),'long':trailing_burst(long,rate),
 'word':trailing_burst(x,rate,1.3),'single':trailing_burst(x[:round(.95*rate)],rate)}))
`);
 assert.deepEqual(r.found,[1.25,1.4,.9]);
 for(const key of ['short','long','word','single'])assert.equal(r[key],null,key);
});
test('postprocess elimina la ráfaga antes de medir loudnorm y mantiene voz y nivel',async()=>{
 const r=await offline(String.raw`
with tempfile.TemporaryDirectory(prefix='vida-audio-test-') as d:
 work=Path(d);raw=work/'raw.wav';out=work/'final.wav';writewav(raw,x)
 original_levels=levels;seen={}
 def levels(p):
  if p.name=='trimmed.wav':
   signal,sr=readwav(p);seen['duration_before_norm']=len(signal)/sr;seen['peak_before_norm']=float(abs(signal).max())
  return original_levels(p)
 profile={'lead':.1,'tail':.16,'postprocess':{'tempo':1.,'lufs':-16,'true_peak_db':-1.5}}
 lufs,peak=postprocess(raw,out,profile);signal,sr=readwav(out)
 seen.update(lufs=lufs,peak=peak,tail_peak=float(abs(signal[-round(.16*sr):]).max()),voice_rms=float(np.sqrt(np.mean(signal[round(.2*sr):round(.7*sr)]**2))))
 print(json.dumps(seen))
`);
 assert.ok(r.duration_before_norm<1.25);
 assert.ok(r.peak_before_norm<.16,'la ráfaga de 0,7 no entra a loudnorm');
 assert.ok(r.voice_rms>.05);assert.equal(r.tail_peak,0);
 assert.ok(Math.abs(r.lufs+16)<.5);assert.ok(r.peak<=-1.4);
});
test('inspect rechaza trailing_noise sin palabras extras y lo acepta con silencio digital',async()=>{
 const r=await offline(String.raw`
with tempfile.TemporaryDirectory(prefix='vida-audio-test-') as d:
 clip=Path(d)/'line.wav';writewav(clip,x);bad=inspect(clip,{'text':'hola','who':'test','id':'T01'},{} )['qc']
 x[round(.92*rate):]=0;writewav(clip,x);good=inspect(clip,{'text':'hola','who':'test','id':'T01'},{} )['qc']
 print(json.dumps({'bad':bad,'good':good,'missing_words':trailing_noise(x,rate,[])[0]}))
`);
 assert.equal(r.bad.ok,false);assert.equal(r.bad.trailing_noise,true);
 assert.deepEqual(r.bad.extra,[]);assert.deepEqual(r.bad.missing,[]);
 assert.equal(r.good.ok,true);assert.equal(r.good.trailing_noise,false);
 assert.ok(r.good.trailing_noise_db<-45);assert.equal(r.missing_words,true);
});
test('trim de mezcla conserva colas reales y respeta duración y recorte explícito sin mover calendario',()=>{
 const line={id:'T01',words:[{s:.1,e:.9}],trimIn:.05,trimOut:2,t0:8,t1:9.95};
 assert.equal(mixLine(line,2).trimOut,2);
 assert.equal(mixLine({...line,trimOut:1.1},2).trimOut,1.1);
 assert.equal(mixLine(line,1.2).trimOut,1.2);
 const result=mixLine(line,2);assert.equal(result.t0,8);assert.equal(result.t1,9.95);assert.equal(line.trimOut,2);
 assert.throws(()=>mixLine({...line,words:[]},2),/Whisper/);
});
test('métricas encuentran un ruido fuera de palabras y saltos en el corte sin diluirlos',()=>{
 const x=new Float32Array(48000),line={id:'T01',clip:'x.wav',words:[{s:.1,e:.4}],lastWord:.4,trimIn:0,trimOut:1,t0:0,t1:1,audio_t1:1};
 x.fill(.2,4800,19200);assert.equal(audioMetrics(x,[line]).non_speech_loud_windows,0);
 x.fill(.4,36000,36960);x[1]=.3;
 const m=audioMetrics(x,[line]);assert.ok(m.non_speech_loud_windows>=1);
 assert.ok(m.lines[0].tail_db_after_last_word>-12);assert.ok(m.lines[0].boundary_jump>.29);
});
test('mezclar silencio conserva muestras y declara LUFS no definido',async()=>{
 const tmp=await mkdtemp('/tmp/vida-audio-test-');
 try{const r=await mixDialogue({duration:.1,lines:[],episode:{}},`${tmp}/silence.mp3`);
  assert.equal(r.decoded_samples,4800);assert.equal(r.lufs,null);assert.equal(r.non_speech_loud_windows,0);
 }finally{await rm(tmp,{recursive:true,force:true});}
});
test('mezcla de voz sintética verifica MP3, fades, cola, niveles y duración exacta',async()=>{
 const tmp=await mkdtemp('/tmp/vida-audio-test-');
 try{
  await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i',"aevalsrc=if(between(t\\,0.1\\,0.65)\\,0.15*sin(2*PI*220*t)\\,0):s=48000:d=2",'-c:a','pcm_s16le',`${tmp}/line.wav`]);
  const line={id:'T01',clip:'line.wav',words:[{s:.1,e:.65}],trimIn:0,trimOut:2,t0:.2,t1:2.2};
  const c={duration:2.5,lines:[line],episode:{},paths:{audioBase:tmp}};
  const r=await mixDialogue(c,`${tmp}/dialogue.mp3`);
  assert.equal(r.decoded_samples,120000);assert.equal(r.lines[0].trimOut,2);
  assert.equal(r.lines[0].t0,.2);assert.equal(r.lines[0].t1,2.2);
  assert.equal(r.non_speech_loud_windows,0);assert.ok(r.lines[0].tail_db_after_last_word<-50);
  assert.ok(r.lines[0].boundary_jump<.05);assert.ok(Math.abs(r.lufs+16)<=.5);assert.ok(r.true_peak_db<=-1.5);
 }finally{await rm(tmp,{recursive:true,force:true});}
});

test('QC conserva cola vocal de 300 ms y rechaza ráfaga y segmento tras 900 ms de silencio',async()=>{
 const r=await offline(String.raw`
y=np.zeros(round(2.8*rate));y[round(.1*rate):round(1.2*rate)]=.1
with tempfile.TemporaryDirectory(prefix='vida-audio-test-') as d:
 clip=Path(d)/'line.wav';writewav(clip,y);real=inspect(clip,{'text':'hola','who':'test','id':'T01'},{} )['qc']
 y[round(2.1*rate):round(2.6*rate)]=.3;writewav(clip,y);extra=inspect(clip,{'text':'hola','who':'test','id':'T01'},{} )['qc']
 y[round(2.1*rate):]=0;y[round(1.8*rate):round(1.95*rate)]=.3;writewav(clip,y);burst=inspect(clip,{'text':'hola','who':'test','id':'T01'},{} )['qc']
 print(json.dumps({'real':real,'extra':extra,'burst':burst}))
`);
 assert.equal(r.real.ok,true);assert.equal(r.real.trailing_noise,false);
 for(const key of ['extra','burst']){assert.equal(r[key].ok,false);assert.equal(r[key].trailing_noise,true);}
});
test('actividad conectada: paridad Python/JS, huecos estrictamente menores de 150 ms y colas largas',async()=>{
 const cases=[
  {we:.5,regions:[[.1,.6],[.74,1.4],[2,2.15]]},
  {we:.5,regions:[[.1,.6],[.75,1.4]]},
  {we:.8,regions:[[.1,.2],[.9,1.1]]},
  {we:.8,regions:[[.1,.2]]},
 ];
 const r=await offline(`cases=json.loads('${JSON.stringify(cases)}')
result=[]
for case in cases:
 y=np.zeros(144000)
 for a,b in case['regions']:y[round(a*rate):round(b*rate)]=.1
 result.append(connected_activity(y,rate,case['we']))
print(json.dumps(result))`);
 for(const [i,c] of cases.entries()){
  const signal=new Float64Array(144000);for(const [a,b] of c.regions)signal.fill(.1,Math.round(a*48000),Math.round(b*48000));
  assert.deepEqual(connectedActivity(signal,48000,c.we),r[i]);
 }
 assert.deepEqual(r,[[4800,67200],[4800,28800],[43200,52800],null]);
});
test('métricas aceptan sílaba real posterior a Whisper y detectan energía aislada posterior',()=>{
 const signal=new Float32Array(144000),line={id:'T01',clip:'x.wav',words:[{s:.1,e:.9}],lastWord:.9,trimIn:0,trimOut:3,t0:0,t1:3,audio_t1:3};
 signal.fill(.1,4800,57600);
 const clean=audioMetrics(signal,[line]);assert.equal(clean.non_speech_loud_windows,0);assert.equal(clean.lines[0].connected_activity_end,1.2);assert.ok(clean.lines[0].tail_db_after_last_word<-60);
 signal.fill(.2,100800,150240);
 const dirty=audioMetrics(signal,[line]);assert.ok(dirty.non_speech_loud_windows>0);assert.ok(dirty.lines[0].tail_db_after_last_word>-20);
});

test('MP3 conserva RMS de sílaba real de 300 ms aun al normalizar el cuerpo de la voz',async()=>{
 const tmp=await mkdtemp('/tmp/vida-audio-test-');
 try{
  await exec('ffmpeg',['-v','error','-y','-f','lavfi','-i',"aevalsrc=if(between(t\\,0.1\\,0.95)\\,0.15*sin(2*PI*220*t)\\,0):s=48000:d=1.6",'-c:a','pcm_s16le',`${tmp}/line.wav`]);
  const line={id:'T01',clip:'line.wav',words:[{s:.1,e:.65}],trimIn:0,trimOut:1.6,t0:.2,t1:1.8};
  const r=await mixDialogue({duration:2,lines:[line],episode:{},paths:{audioBase:tmp}},`${tmp}/dialogue.mp3`);
  assert.equal(r.decoded_samples,96000);assert.equal(r.lines[0].trimOut,1.6);
  assert.ok(Math.abs(r.lines[0].final_syllable_rms_delta_db)<=.5);
  assert.ok(r.lines[0].connected_activity_end>=.95);assert.equal(r.non_speech_loud_windows,0);
  assert.ok(r.lines[0].boundary_jump<.05);assert.ok(Math.abs(r.lufs+16)<=.5);assert.ok(r.true_peak_db<=-1.5);
 }finally{await rm(tmp,{recursive:true,force:true});}
});


test('clic inicial: paridad Python/JS, silencio exacto y voz intacta; hueco corto solo se informa',async()=>{
 const cases=[{gap:.1,duration:.005},{gap:.075,duration:.005},{gap:.08,duration:.005},{gap:.1,duration:.04},{gap:0,duration:.2},{gap:.11,duration:.005,amplitude:.005}];
 const result=await offline(`cases=json.loads('${JSON.stringify(cases)}')
results=[]
for case in cases:
 y=np.zeros(rate);a=round(.1*rate);b=a+round(case['duration']*rate);n=b+round(case['gap']*rate)
 y[a:b]=case.get('amplitude',.7);y[n:round(.8*rate)]=.1
 cleaned,found=remove_leading_click(y,rate)
 results.append({'found':found,'unchanged_voice':bool(np.array_equal(y[b+round(.003*rate):],cleaned[b+round(.003*rate):])),
  'unchanged_all':bool(np.array_equal(y,cleaned)),'leading_zero':bool(np.all(cleaned[:b+round(.003*rate)]==0))})
print(json.dumps(results))`);
 for(const [i,c] of cases.entries()){
  const y=new Float64Array(48000),a=4800,b=a+Math.round(c.duration*48000),n=b+Math.round(c.gap*48000);
  y.fill(c.amplitude??.7,a,b);y.fill(.1,n,38400);
  assert.deepEqual(leadingActivity(y,48000),result[i].found);
  assert.equal(result[i].unchanged_voice,true);
 }
 for(const i of [0,2]){assert.equal(result[i].found.removable,true);assert.equal(result[i].leading_zero,true);}
 assert.equal(result[1].found.candidate,true);assert.equal(result[1].found.removable,false);
 for(const i of [1,3,4,5])assert.equal(result[i].unchanged_all,true);
});
test('inspect rechaza clic aislado y reporta el cercano sin silenciarlo',async()=>{
 const r=await offline(String.raw`
with tempfile.TemporaryDirectory(prefix='vida-audio-test-') as d:
 clip=Path(d)/'line.wav';results=[]
 for onset in [.205,.175,.105]:
  y=np.zeros(round(1.2*rate));y[round(.1*rate):round(.105*rate)]=.7
  y[round(onset*rate):round(.9*rate)]=.1;writewav(clip,y)
  results.append(inspect(clip,{'text':'hola','who':'test','id':'T01'},{} )['qc'])
 print(json.dumps(results))`);
 assert.equal(r[0].ok,false);assert.equal(r[0].leading_click,true);
 assert.equal(r[1].leading_click,false);assert.equal(r[1].leading_click_candidate,true);assert.equal(r[1].leading_click_gap_ms,70);
 assert.equal(r[2].leading_click,false);assert.equal(r[2].leading_click_candidate,false);
});
test('postprocess retira clic de entrada antes de loudnorm sin tratar voz inmediata ni hueco corto',async()=>{
 const r=await offline(String.raw`
results=[]
with tempfile.TemporaryDirectory(prefix='vida-audio-test-') as d:
 work=Path(d);raw=work/'raw.wav';out=work/'final.wav';original_levels=levels
 for onset in [.205,.175,.105]:
  y=np.zeros(rate);y[round(.1*rate):round(.105*rate)]=.7
  a,b=round(onset*rate),round(.9*rate);y[a:b]=.1*np.sin(2*np.pi*220*np.arange(b-a)/rate)
  writewav(raw,y);seen={}
  def levels(p):
   if p.name=='trimmed.wav':
    signal,sr=readwav(p);seen['peak_before_norm']=float(abs(signal).max())
   return original_levels(p)
  postprocess(raw,out,{'lead':.1,'tail':.16,'postprocess':{'tempo':1.,'lufs':-16,'true_peak_db':-1.5}})
  results.append(seen)
print(json.dumps(results))`);
 assert.ok(r[0].peak_before_norm<.11);
 assert.ok(r[1].peak_before_norm>.69);assert.ok(r[2].peak_before_norm>.69);
});
test('métrica de clic usa razón de energía, espectro >4k y excluye voz sostenida',()=>{
 const x=new Float32Array(48000);
 for(let i=4800;i<5040;i++)x[i]=.7*Math.sin(2*Math.PI*9000*i/48000);
 for(let i=14400;i<38400;i++)x[i]=.1*Math.sin(2*Math.PI*220*i/48000);
 assert.ok(startClicks(x).some(c=>c.t0>=.096&&c.t0<=.104));
 const m=audioMetrics(x,[{id:'T',t0:0,t1:1,audio_t1:1,lastWord:.8,trimIn:0,trimOut:1}]);
 assert.ok(m.lines[0].leading_energy_before_voice_db>-30);
 x.fill(0,0,5184);assert.equal(startClicks(x).length,0);
 const clean=audioMetrics(x,[{id:'T',t0:0,t1:1,audio_t1:1,lastWord:.8,trimIn:0,trimOut:1}]);
 assert.equal(clean.start_clicks,0);assert.equal(clean.lines[0].leading_energy_before_voice_db,-240);
 const sustained=new Float32Array(48000);for(let i=4800;i<14400;i++)sustained[i]=.4*Math.sin(2*Math.PI*9000*i/48000);
 assert.equal(startClicks(sustained).length,0);
 const low=new Float32Array(48000);for(let i=4800;i<24000;i++){
  const fade=Math.min(1,(i-4800)/480,(24000-i)/480);low[i]=.4*fade*Math.sin(2*Math.PI*250*i/48000);
 }
 assert.equal(startClicks(low,48000,[]).length,0,'tono grave con entrada y salida suaves, sin máscara de voz');
});

test('región de voz acumula 60 ms activos y conserva consonante corta, sin unir clic y señal tenue',()=>{
 const x=new Float32Array(48000);x.fill(.7,4800,5040);x.fill(.005,8400,8880);
 x.fill(.2,12720,12960);x.fill(.1,14400,24000);
 assert.deepEqual(voiceRegions(x),[[12720,24000]]);
 const consonant=new Float32Array(48000);consonant.fill(.1,14160,14400);consonant.fill(.1,16800,24000);
 assert.deepEqual(voiceRegions(consonant),[[14160,24000]]);
 const silent=new Float32Array(48000);assert.deepEqual(voiceRegions(silent),[]);
});

test('detector a resolución de muestra encuentra impulso entre puntos de una grilla de 1 ms',()=>{
 const x=new Float32Array(48000);x[4807]=.7;
 const hits=startClicks(x);assert.ok(hits.some(c=>Math.round(c.t0*48000)%48!==0));
 assert.ok(hits.every(c=>c.energy_ratio>30&&c.high_frequency_fraction>.4));
});

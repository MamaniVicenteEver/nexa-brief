"""Prueba secuencial local 190–210 s. Ejecutar después de analizar.py."""
import os
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['MPLCONFIGDIR']='/tmp/vozref-matplotlib'
import json, re, subprocess
from pathlib import Path
import numpy as np
from scipy import signal
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

R=Path(__file__).resolve().parent
def run(args):return subprocess.run(args,check=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
def measure(path):
 p=run(['ffmpeg','-hide_banner','-nostdin','-threads','1','-i',str(path),'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-'])
 m=re.search(r'\{\s*"input_i".*?\}',p.stderr.decode(),re.S)
 return json.loads(m.group())
def decode(path):return np.frombuffer(run(['ffmpeg','-v','error','-threads','1','-i',str(path),'-ac','1','-ar','16000','-f','f32le','-']).stdout,dtype='<f4').astype(float)
src=R/'Picker_Rickmansworth_88_mp3.mp3'; dry=R/'prueba-fx-fuente.wav'; offset=190
run(['ffmpeg','-v','error','-nostdin','-y','-threads','1','-ss',str(offset),'-i',str(src),'-t','20','-ac','1','-ar','48000','-c:a','pcm_s24le',str(dry)])
a=json.loads((R/'analisis.json').read_text())
# Dos eventos en veinte segundos equivalen a seis por minuto.
slots=[('exhale-02',.9,.18,7.515),('sigh-03',.17,.22,17.90)]
series=np.load(R/'series-acusticas.npz')
quiet_threshold=a['energy']['speech_frames_dbfs']['median']-8
cues=[]
dry_rms=20*np.log10(np.sqrt(np.mean(decode(dry)**2)))
for slug,trim,length,start in slots:
 p=R/'sfx-cc0'/f'{slug}.wav'
 if not p.exists():raise SystemExit(f'Falta SFX para prueba: {slug}')
 absolute=start+offset
 gap=next((g for g in a['pauses']['events'] if g['start']<=absolute-.06 and g['end']>=absolute+length+.06),None)
 if not gap:raise SystemExit(f'No hay hueco medido con margen para {slug}')
 ix=(series['time']>=absolute)&(series['time']<=absolute+length)
 assert ix.any() and np.all(series['rms_dbfs'][ix]<quiet_threshold)
 cues.append({'file':str(p),'start':start,'absolute_reference_start':absolute,'source_start':trim,'duration':length,'target_rms_dbfs':float(dry_rms-22),'license':'CC0','provider_sound_id':slug,'measured_gap':gap,'acoustic_quiet_threshold_dbfs':quiet_threshold,'acoustic_rms_max_dbfs':float(series['rms_dbfs'][ix].max()),'selection_note':'Recorte alrededor del pico informado por el proveedor; pendiente de escucha, no aprobación editorial.'})
manifest=R/'respiraciones-prueba.json';manifest.write_text(json.dumps({'cues':cues},ensure_ascii=False,indent=2))
wet=R/'prueba-fx-despues.wav'
run(['bash',str(R/'fx-veterano.sh'),str(dry),str(wet),str(manifest)])
# El antes se masteriza por separado a la misma sonoridad, sin EQ/saturación/sala.
v=measure(dry)
normal=f'loudnorm=I=-16:TP=-1.5:LRA=9:measured_I={v["input_i"]}:measured_TP={v["input_tp"]}:measured_LRA={v["input_lra"]}:measured_thresh={v["input_thresh"]}:offset={v["target_offset"]}:linear=true'
before=R/'prueba-fx-antes.mp3'; after=R/'prueba-fx-despues.mp3'
run(['ffmpeg','-v','error','-nostdin','-y','-threads','1','-i',str(dry),'-af',normal,'-t','20','-ar','48000','-c:a','libmp3lame','-b:a','192k',str(before)])
run(['ffmpeg','-v','error','-nostdin','-y','-threads','1','-i',str(wet),'-ar','48000','-c:a','libmp3lame','-b:a','192k',str(after)])
bm=measure(before); am=measure(after)
# Igualar por atenuación, evitando elevar los picos para perseguir −16 LUFS.
# Se vuelve a codificar desde el WAV fuente, nunca desde otro MP3.
gain_before=min(0,float(am['input_i'])-float(bm['input_i']))
gain_after=min(0,float(bm['input_i'])-float(am['input_i']))
if gain_before<-.05:
 run(['ffmpeg','-v','error','-nostdin','-y','-threads','1','-i',str(dry),'-af',normal+f',volume={gain_before:.4f}dB','-t','20','-ar','48000','-c:a','libmp3lame','-b:a','192k',str(before)])
if gain_after<-.05:
 run(['ffmpeg','-v','error','-nostdin','-y','-threads','1','-i',str(wet),'-af',f'volume={gain_after:.4f}dB','-ar','48000','-c:a','libmp3lame','-b:a','192k',str(after)])
report={'source':src.name,'excerpt_start_s':offset,'excerpt_duration_s':20,'purpose':'Comparación técnica, no publicar ni considerar voz final de Malvinas','api_calls':0,'breath_cues':cues,'comparison_gain_db':{'before':gain_before,'after':gain_after},'mastering_note':'Objetivo del master −16 LUFS. El límite de picos puede dejar la medición más baja. La comparación se igualó atenuando la versión más fuerte, sin aumentar picos.','before':measure(before),'after':measure(after),'audio':{}}
data={}
for name,path in [('before',before),('after',after)]:
 x=decode(path);data[name]=x
 f,p=signal.welch(x,16000,nperseg=2048)
 def power(a,b):return float(p[(f>=a)&(f<=b)].sum())
 report['audio'][name]={'decoded_duration_s':len(x)/16000,'rms_dbfs':float(20*np.log10(np.sqrt(np.mean(x*x)))),'sample_peak_dbfs':float(20*np.log10(np.max(np.abs(x)))),'clipped_samples':int((np.abs(x)>=1).sum()),'low_80_250_to_mid_500_1500_db':float(10*np.log10(power(80,250)/power(500,1500))),'presence_2000_4000_to_mid_500_1500_db':float(10*np.log10(power(2000,4000)/power(500,1500)))}
report['integrated_loudness_difference_lu']=float(report['after']['input_i'])-float(report['before']['input_i'])
assert abs(report['integrated_loudness_difference_lu'])<=.5
assert all(v['clipped_samples']==0 for v in report['audio'].values())
assert abs(report['audio']['before']['decoded_duration_s']-20)<.01
assert abs(report['audio']['after']['decoded_duration_s']-20)<.01
(R/'prueba-fx-validacion.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
fig,axs=plt.subplots(2,1,figsize=(13,7))
for name,color in [('before','#315b74'),('after','#95502c')]:
 x=data[name]; n=480; frames=np.lib.stride_tricks.sliding_window_view(x,n)[::160];t=(np.arange(len(frames))*160+n/2)/16000
 axs[0].plot(t,20*np.log10(np.maximum(1e-8,np.sqrt(np.mean(frames**2,axis=1)))),label=name,color=color,lw=.8)
 f,p=signal.welch(x,16000,nperseg=2048);axs[1].semilogx(f,10*np.log10(np.maximum(p,1e-20)),label=name,color=color)
for c in cues:axs[0].axvspan(c['start'],c['start']+c['duration'],color='#5eaba6',alpha=.6)
axs[0].set(xlabel='Tiempo relativo al fragmento 190–210 s',ylabel='RMS dBFS',title='Comparación de sonoridad equivalente · turquesa: dos respiraciones CC0',ylim=(-70,-4));axs[0].legend()
axs[1].set(xlabel='Frecuencia (Hz)',ylabel='PSD dB/Hz',xlim=(70,8000),title='Color espectral antes y después');axs[1].legend()
fig.tight_layout();fig.savefig(R/'04-prueba-fx.png',dpi=140);plt.close(fig)
print(json.dumps(report,ensure_ascii=False,indent=2))

"""Análisis reproducible. Ejecutar después de transcribir.py, en el venv temporal."""
import os
os.environ['OMP_NUM_THREADS']='3'
os.environ['OPENBLAS_NUM_THREADS']='1'
os.environ['MPLCONFIGDIR']='/tmp/vozref-matplotlib'
import json, re, subprocess, hashlib, textwrap
from pathlib import Path
import numpy as np
from scipy import signal, ndimage
import parselmouth
from parselmouth.praat import call
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

R=Path(__file__).resolve().parent
src=R/'Picker_Rickmansworth_88_mp3.mp3'
raw=subprocess.check_output(['ffmpeg','-v','error','-threads','1','-i',str(src),'-ac','1','-ar','16000','-f','f32le','-'])
x=np.frombuffer(raw,dtype='<f4').astype(float); sr=16000; dur=len(x)/sr
tr=json.loads((R/'transcripcion.json').read_text())
words=[dict(w) for s in tr['segments'] for w in s['words']]
bad=[w for w in words if round(w['end']-w['start'],6)<.02]
words=[w for w in words if round(w['end']-w['start'],6)>=.02]
def wc(t): return len(re.findall(r"\b[\w]+(?:['’][\w]+)*\b",t))
def stats(v):
    a=np.array(v,dtype=float); a=a[np.isfinite(a)]
    return dict(n=len(a),p10=float(np.percentile(a,10)),median=float(np.median(a)),p90=float(np.percentile(a,90)),mean=float(np.mean(a)),min=float(np.min(a)),max=float(np.max(a))) if len(a) else {'n':0}
def db(v): return 20*np.log10(np.maximum(v,1e-10))
def cat(w):
    t=w['word'].rstrip('”\"»’')
    return 'punto' if re.search(r'[.!?]$',t) else 'coma' if t.endswith(',') else 'dos_puntos_o_punto_coma' if re.search(r'[:;]$',t) else 'sin_puntuacion'
N=sum(wc(w['word']) for w in words)
gaps=[]
for a,b in zip(words,words[1:]):
    d=round(b['start']-a['end'],6)
    gaps.append({'start':a['end'],'end':b['start'],'duration':max(0,d),'after':a['word'],'before':b['word'],'punctuation':cat(a)})
pauses=[g for g in gaps if g['duration']>=.12]
sent=[]; buf=[]
for w in words:
    buf.append(w)
    if cat(w)=='punto':
        sent.append({'start':buf[0]['start'],'end':buf[-1]['end'],'text':''.join(w['word'] for w in buf).strip(),'words':sum(wc(w['word']) for w in buf)}); buf=[]
if buf: sent.append({'start':buf[0]['start'],'end':buf[-1]['end'],'text':''.join(w['word'] for w in buf).strip(),'words':sum(wc(w['word']) for w in buf)})
for s in sent: s['duration']=s['end']-s['start']; s['wpm']=s['words']/s['duration']*60
# 30 ms frames / 10 ms step, spectra in power units.
frames=np.lib.stride_tricks.sliding_window_view(x,480)[::160]
tm=(np.arange(len(frames))*160+240)/sr
rms=np.sqrt(np.mean(frames**2,axis=1)); rmsdb=db(rms)
spec=np.abs(np.fft.rfft(frames*np.hanning(480),n=512))**2+1e-20
freq=np.fft.rfftfreq(512,1/sr)
flat=np.exp(np.mean(np.log(spec[:,(freq>=300)&(freq<=6000)]),axis=1))/np.mean(spec[:,(freq>=300)&(freq<=6000)],axis=1)
band=10*np.log10(spec[:,(freq>=2000)&(freq<=5000)].sum(axis=1)/spec[:,(freq>=80)&(freq<=7800)].sum(axis=1))
lo=10*np.log10(spec[:,(freq>=200)&(freq<=1000)].sum(axis=1)); hi=10*np.log10(spec[:,(freq>=2000)&(freq<=5000)].sum(axis=1))
fl=(freq>=300)&(freq<=4000); f_oct=np.log2(freq[fl]/1000); slope=((10*np.log10(spec[:,fl])-10*np.log10(spec[:,fl]).mean(axis=1,keepdims=True))@(f_oct-f_oct.mean()))/np.sum((f_oct-f_oct.mean())**2)
wordmask=np.zeros(len(tm),bool)
for w in words: wordmask |= (tm>=w['start'])&(tm<=w['end'])
floor=float(np.percentile(rmsdb,10)); threshold=max(-50,min(-30,floor+10))
active=(rmsdb>threshold)
active=ndimage.binary_closing(active,iterations=4)
snd=parselmouth.Sound(x,sampling_frequency=sr)
pitch=snd.to_pitch_ac(time_step=.01,pitch_floor=60,pitch_ceiling=400,voicing_threshold=.5)
pt=pitch.xs(); f0=pitch.selected_array['frequency']; f0[f0==0]=np.nan
# Revisión tras mirar las gráficas: ráfagas altas muy breves, próximas a un
# tercer armónico, no representan el registro predominante. Se excluyen sin
# inventar una F0 corregida; se conserva todo el trazado crudo para auditoría.
f0raw=f0.copy(); rejected=[]
high=np.zeros(len(f0),bool)
for i in np.flatnonzero(np.isfinite(f0)):
    context=f0raw[max(0,i-150):min(len(f0),i+151)]
    context=context[np.isfinite(context)]
    if len(context)>=15 and f0raw[i]>2*np.median(context):high[i]=True
lab=ndimage.label(high)[0]
for k in range(1,lab.max()+1):
    ix=np.flatnonzero(lab==k)
    if len(ix)<=35:
        rejected.append({'start':float(pt[ix[0]]),'end':float(pt[ix[-1]]+.01),'frames':len(ix),'median_raw_hz':float(np.median(f0raw[ix])),'reason':'Ráfaga <=350 ms, >octava sobre mediana sonora local de ±1500 ms; posible seguimiento de armónico. Excluida, no reemplazada.'})
        f0[ix]=np.nan
voiced=np.isfinite(f0); sti=12*np.log2(f0/100)
alt=snd.to_pitch_ac(time_step=.01,pitch_floor=75,pitch_ceiling=500,voicing_threshold=.5)
af=alt.selected_array['frequency']; af[af==0]=np.nan
afi=np.interp(pt,alt.xs(),af)
valid=voiced&np.isfinite(afi)
diff=12*np.log2(afi[valid]/f0[valid])
f0frame=np.interp(tm,pt,np.nan_to_num(f0,nan=0))
# Final contour: last 350 ms of voicing against preceding 350 ms, within each sentence.
for s in sent:
    idx=np.flatnonzero((pt>=s['start'])&(pt<=s['end'])&voiced)
    if len(idx)>=12:
        last=pt[idx[-1]]
        a=sti[(pt>=last-.70)&(pt<last-.35)&(pt>=s['start'])&voiced]
        b=sti[(pt>=last-.35)&(pt<=last)&voiced]
        if len(a)>=5 and len(b)>=5:
            delta=float(np.median(b)-np.median(a)); s['final_delta_semitones']=delta
            s['final_contour']='baja' if delta<-.75 else 'sube' if delta>.75 else 'estable'
# RMS and pitch of words; local energy difference helps distinguish stress from mastering.
word_features=[]
for w in words:
    a,b=w['start'],w['end']; ix=(tm>=a)&(tm<=b); pi=(pt>=a)&(pt<=b)&voiced
    if not ix.any(): continue
    ctx=(tm>=a-1.5)&(tm<=b+1.5)&wordmask
    val=float(np.percentile(rmsdb[ix],90))
    word_features.append(dict(w,rms_p90_dbfs=val,rms_median_dbfs=float(np.median(rmsdb[ix])),local_energy_delta_db=val-float(np.median(rmsdb[ctx])),f0_median_hz=float(np.median(f0[pi])) if pi.any() else None))
transient_threshold=float(np.percentile(rmsdb[wordmask],99)+6)
transient_words=[w for w in word_features if w['rms_p90_dbfs']>transient_threshold]
emph=sorted([w for w in word_features if wc(w['word']) and w['end']-w['start']>=.09 and w['rms_p90_dbfs']<=transient_threshold],key=lambda w:w['local_energy_delta_db'],reverse=True)[:25]
# Breath candidates: aperiodic, above noise floor, low compared with speech, before lexical onset.
# Deliberately label these candidates: fricatives, room noise and MP3 artifacts may pass.
speechmedian=float(np.median(rmsdb[wordmask]))
breaths=[]
for g in pauses:
    if g['duration']<.18: continue
    ix=np.flatnonzero((tm>=g['start']+.035)&(tm<=g['end']-.025))
    if not len(ix): continue
    good=(rmsdb[ix]>floor+4)&(rmsdb[ix]<speechmedian-5)&(flat[ix]>.06)&(f0frame[ix]<60)
    runs=ndimage.label(good)[0]
    for k in range(1,runs.max()+1):
        ids=ix[runs==k]; a=tm[ids[0]]-.005; b=tm[ids[-1]]+.005
        if .10<=b-a<=.60 and 0<=g['end']-b<=.45:
            breaths.append({'start':float(a),'end':float(b),'duration':float(b-a),'before':g['before'],'gap_start':g['start'],'gap_end':g['end'],'rms_dbfs':float(np.median(rmsdb[ids])),'flatness':float(np.median(flat[ids])),'classification':'candidato_no_confirmado'})
# Stable voiced islands, maximum 600 ms, >=250 ms: perturbation estimates on compressed narration.
stability=[]
label=ndimage.label(voiced)[0]
for k in range(1,label.max()+1):
    ix=np.flatnonzero(label==k)
    if len(ix)<25: continue
    a=float(pt[ix[0]]); b=min(float(pt[ix[-1]]),a+.60)
    sub=snd.extract_part(a,b,preserve_times=False)
    try:
        pp=call(sub,'To PointProcess (periodic, cc)',60,400)
        jitter=call(pp,'Get jitter (local)',0,0,1/400,1/60,1.3)
        shimmer=call([sub,pp],'Get shimmer (local)',0,0,1/400,1/60,1.3,1.6)
        h=sub.to_harmonicity_cc(time_step=.01,minimum_pitch=60,silence_threshold=.1,periods_per_window=1)
        hn=h.values[0]; hn=hn[hn>-100]
        if np.isfinite(jitter) and np.isfinite(shimmer): stability.append({'start':a,'end':b,'jitter_local_pct':jitter*100,'shimmer_local_pct':shimmer*100,'hnr_db':float(np.median(hn)) if len(hn) else None})
    except parselmouth.PraatError: pass
rhythm=[]
for a in np.arange(0,dur,20):
    b=min(dur,a+20); ww=[w for w in words if a<=(w['start']+w['end'])/2<b]
    rhythm.append({'start':float(a),'end':float(b),'words':sum(wc(w['word']) for w in ww),'wpm':sum(wc(w['word']) for w in ww)/(b-a)*60,'pause_seconds':sum(max(0,min(b,g['end'])-max(a,g['start'])) for g in pauses)})
bycat={c:{'all_boundaries':stats([g['duration'] for g in gaps if g['punctuation']==c]),'pauses_ge120ms':stats([g['duration'] for g in pauses if g['punctuation']==c])} for c in ['coma','punto','dos_puntos_o_punto_coma','sin_puntuacion']}
clauses=[]; buf=[]
for w in words:
    buf.append(w)
    if cat(w)!='sin_puntuacion':
        clauses.append({'start':buf[0]['start'],'end':buf[-1]['end'],'words':sum(wc(v['word']) for v in buf),'text':''.join(v['word'] for v in buf).strip()}); buf=[]
if buf: clauses.append({'start':buf[0]['start'],'end':buf[-1]['end'],'words':sum(wc(v['word']) for v in buf),'text':''.join(v['word'] for v in buf).strip()})
idea_gaps=[g for g in gaps if g['punctuation']=='punto' and g['duration']>=.6]
out={'source':src.name,'sha256':hashlib.sha256(src.read_bytes()).hexdigest(),'duration_s':dur,'method':{'decode':'mono mean, 16 kHz float; original stereo 44.1 kHz','frame_ms':30,'hop_ms':10,'pitch':'Praat autocorrelation 60–400 Hz, voicing threshold .5; comparison 75–500 Hz','pause_definition':'interword ASR gap >=120 ms; not pure acoustic silence','active_threshold_dbfs':threshold,'noise_p10_dbfs':floor,'breath_definition':'100–600 ms aperiodic bursts, floor+4 < RMS < speech median−5 dB, flatness>.06, within .45 s before a word; candidates only','sentence_definition':'ASR punctuation .!?; not manually verified','spectral_slope':'OLS log-power vs log2(freq), 300–4000 Hz; dB/octave, no preemphasis','perturbation':'Praat periodic cc on voiced islands 250–600 ms, period 1/400–1/60; compressed speech, descriptive not clinical'},'transcription_qc':{'word_objects':len(words),'discarded_short_words':bad,'language':tr['language'],'language_probability':tr['language_probability'],'word_probability':stats([w['probability'] for w in words])},'tempo':{'lexical_words':N,'total_wpm':N/dur*60,'asr_word_span_s':sum(w['end']-w['start'] for w in words),'articulation_wpm_word_spans':N/sum(w['end']-w['start'] for w in words)*60,'speech_time_excluding_ge120ms_gaps_s':dur-sum(g['duration'] for g in pauses)-words[0]['start']-(dur-words[-1]['end']),'wpm_excluding_ge120ms_gaps':N/(dur-sum(g['duration'] for g in pauses)-words[0]['start']-(dur-words[-1]['end']))*60,'acoustic_activity_s':float(active.sum()*.01),'wpm_acoustic_activity':N/(active.sum()*.01)*60,'sentence_word_length':stats([s['words'] for s in sent]),'sentence_duration_s':stats([s['duration'] for s in sent]),'rhythm_20s':rhythm},'pauses':{'count':len(pauses),'per_minute':len(pauses)/dur*60,'total_s':sum(g['duration'] for g in pauses),'duration_s':stats([g['duration'] for g in pauses]),'by_punctuation':bycat,'long_ge800ms_per_minute':sum(g['duration']>=.8 for g in pauses)/dur*60,'longest':sorted(pauses,key=lambda g:g['duration'],reverse=True)[:15],'events':pauses},'pitch':{'hz':stats(f0),'semitones_relative_100hz':stats(sti),'p10_p90_span_semitones':float(np.nanpercentile(sti,90)-np.nanpercentile(sti,10)),'voiced_fraction':float(voiced.mean()),'alternative_hz':stats(af),'comparison_common_frames':int(valid.sum()),'octave_disagreement_fraction':float((np.abs(diff)>9).mean()),'endings':{c:sum(s.get('final_contour')==c for s in sent) for c in ['baja','sube','estable']},'final_delta_semitones':stats([s['final_delta_semitones'] for s in sent if 'final_delta_semitones' in s])},'energy':{'full_rms_dbfs':float(db(np.sqrt(np.mean(x*x)))),'sample_peak_dbfs':float(db(np.max(np.abs(x)))),'crest_db':float(db(np.max(np.abs(x)))-db(np.sqrt(np.mean(x*x)))),'speech_frames_dbfs':stats(rmsdb[wordmask]),'speech_p90_p10_db':float(np.percentile(rmsdb[wordmask],90)-np.percentile(rmsdb[wordmask],10)),'emphasis_candidates':emph},'roughness':{'spectral_slope_db_octave_voiced':stats(slope[(f0frame>=60)&wordmask]),'band_2_5khz_db_fraction_voiced':stats(band[(f0frame>=60)&wordmask]),'high_minus_low_db_voiced':stats((hi-lo)[(f0frame>=60)&wordmask]),'jitter_local_pct':stats([v['jitter_local_pct'] for v in stability]),'shimmer_local_pct':stats([v['shimmer_local_pct'] for v in stability]),'hnr_db':stats([v['hnr_db'] for v in stability if v['hnr_db'] is not None]),'windows':stability},'breaths':{'candidate_count':len(breaths),'candidates_per_minute':len(breaths)/dur*60,'confirmed_count':None,'events':breaths},'sentences':sent,'word_features':word_features}
out['pitch']['raw_hz']=stats(f0raw)
out['pitch']['rejected_high_bursts']=rejected
out['pitch']['rejected_frames']=int(np.sum(np.isfinite(f0raw)&~np.isfinite(f0)))
out['energy']['transient_word_threshold_dbfs']=transient_threshold
out['energy']['transient_word_candidates']=transient_words
out['energy']['transient_note']='Picos >p99 de RMS de habla +6 dB: posible transitorio o mezcla, no énfasis verbal confirmado. No se quitaron del audio ni del RMS global.'
out['energy']['peak_note']='Medición sobre decodificación float del MP3: sus transitorios superan 0 dBFS. Se conserva esa amplitud en el análisis; no se recorta ni normaliza antes de medir.'
out['tempo']['clause_word_length']=stats([c['words'] for c in clauses])
out['clauses']=clauses
out['pauses']['between_ideas_proxy']={'definition':'Fin de oración ASR con hueco >=600 ms; no prueba semántica de cambio de idea','duration_s':stats([g['duration'] for g in idea_gaps]),'events':idea_gaps}
(R/'analisis.json').write_text(json.dumps(out,ensure_ascii=False,indent=2,allow_nan=False))
np.savez_compressed(R/'series-acusticas.npz',time=tm,rms_dbfs=rmsdb,pitch_time=pt,f0_hz=f0,f0_raw_hz=f0raw,flatness=flat,band_2_5khz_db=band,slope_db_octave=slope)
plt.rcParams.update({'font.size':10,'figure.facecolor':'#f8f8f5','axes.facecolor':'white'})
fig,axs=plt.subplots(3,1,figsize=(15,9),sharex=True)
axs[0].plot(tm,rmsdb,color='#315b74',lw=.45); axs[0].axhline(threshold,color='gray',ls='--',label='Umbral de actividad'); axs[0].set(ylabel='RMS dBFS',ylim=(-70,0)); axs[0].legend(loc='lower right')
axs[1].scatter(pt,f0raw,s=2,color='#bbbbbb',label='Crudo'); axs[1].scatter(pt,f0,s=1,color='#95502c',label='Tras excluir ráfagas altas'); axs[1].set(ylabel='F0 Hz (Praat)',ylim=(55,405)); axs[1].legend(loc='upper right',markerscale=3)
axs[2].bar([r['start'] for r in rhythm],[r['wpm'] for r in rhythm],width=[r['end']-r['start'] for r in rhythm],align='edge',color='#5c7763',alpha=.7); axs[2].set(ylabel='Palabras/min (20 s)',xlabel='Tiempo (s)')
for ax in axs:
    for g in pauses:
        if g['duration']>=.8: ax.axvspan(g['start'],g['end'],color='#cbb596',alpha=.5)
    for b in breaths: ax.axvspan(b['start'],b['end'],color='#5eaba6',alpha=.6)
    ax.grid(alpha=.15)
fig.suptitle('Referencia completa · pausas ≥0,8 s beige · respiraciones candidatas turquesa'); fig.tight_layout(); fig.savefig(R/'01-panorama.png',dpi=140); plt.close(fig)
fig,axs=plt.subplots(2,2,figsize=(12,8))
axs[0,0].hist([g['duration'] for g in pauses],bins=np.arange(.12,max(g['duration'] for g in pauses)+.24,.12),color='#315b74'); axs[0,0].set(xlabel='Hueco entre palabras (s)',ylabel='Cantidad',title='Pausas ≥120 ms; incluidos todos los eventos')
cats=['coma','punto','sin_puntuacion']; vv=[[g['duration'] for g in gaps if g['punctuation']==c] for c in cats]
axs[0,1].boxplot(vv,labels=['Coma','Fin de oración','Sin puntuación'],showfliers=False); axs[0,1].set(ylabel='Hueco (s)',title='Todos los límites, incluidos <120 ms')
axs[1,0].hist(f0raw[np.isfinite(f0raw)],bins=np.arange(55,405,5),color='#bbbbbb',label='Crudo'); axs[1,0].hist(f0[np.isfinite(f0)],bins=np.arange(55,405,5),color='#95502c',label='Depurado'); axs[1,0].set(xlabel='F0 (Hz)',ylabel='Frames',title='Control de octavas: crudo y depurado'); axs[1,0].legend()
axs[1,1].hist(rmsdb[wordmask],bins=45,color='#5c7763'); axs[1,1].set(xlabel='RMS en palabras (dBFS)',ylabel='Frames',title='Dinámica de 30 ms, no LUFS')
fig.tight_layout(); fig.savefig(R/'02-distribuciones.png',dpi=140); plt.close(fig)
# Eight annotated sentence plots, chosen for duration and coverage across the recording.
eligible=[s for s in sent if 2<=s['duration']<=16]
chosen=[]
for target in np.linspace(0,dur-10,8):
    opts=[s for s in eligible if s not in chosen]
    if opts: chosen.append(min(opts,key=lambda s:abs(s['start']-target)))
fig,axs=plt.subplots(4,2,figsize=(16,15))
for ax,s in zip(axs.flat,chosen):
    a=max(0,s['start']-.35); b=min(dur,s['end']+.7); ix=(tm>=a)&(tm<=b); pi=(pt>=a)&(pt<=b)
    ax.plot(tm[ix],rmsdb[ix],color='#315b74',lw=.8); ax.set_ylim(-65,-2)
    twin=ax.twinx(); twin.scatter(pt[pi],f0[pi],s=3,color='#95502c',alpha=.65); twin.set_ylim(60,400)
    for g in pauses:
        if a<g['start']<b: ax.axvspan(g['start'],min(b,g['end']),color='#cbb596',alpha=.5)
    for br in breaths:
        if a<br['start']<b: ax.axvspan(br['start'],br['end'],color='#5eaba6',alpha=.6)
    ww=[w for w in word_features if s['start']<=w['start']<s['end']]
    top=sorted(ww,key=lambda w:w['local_energy_delta_db'],reverse=True)[:2]
    for j,w in enumerate(top): ax.annotate(w['word'].strip(),((w['start']+w['end'])/2,w['rms_p90_dbfs']),xytext=(0,7+10*j),textcoords='offset points',fontsize=8,ha='center')
    contour=f"{s.get('final_contour')} · {s['final_delta_semitones']:+.1f} st" if 'final_delta_semitones' in s else 'cierre no estimable'
    ax.set_title(f"{s['start']:.2f}–{s['end']:.2f} s · {contour}\n"+textwrap.fill(s['text'],width=78),fontsize=8.5)
    ax.set(xlabel='Tiempo (s)',ylabel='RMS dBFS'); twin.set_ylabel('F0 Hz',color='#95502c')
fig.tight_layout(); fig.savefig(R/'03-frases.png',dpi=140); plt.close(fig)
(R/'frases-seleccionadas.json').write_text(json.dumps(chosen,ensure_ascii=False,indent=2))
print(json.dumps({k:out[k] for k in ['tempo','pitch']},ensure_ascii=False,indent=2))
print('Pausas',len(pauses),'Respiraciones candidatas',len(breaths),'Ventanas de perturbación',len(stability))

"""Procesado local reproducible; sin red ni clientes TTS. Ejecutar desde la plantilla.

nice -n 15 ~/Documentos/Proyectos/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python -I work/voz-natural/humanizar.py
Solo escribe en esta carpeta. --help muestra los controles de color.
"""
import os
os.environ.update(OMP_NUM_THREADS='1', OPENBLAS_NUM_THREADS='1', MKL_NUM_THREADS='1',
                  MPLCONFIGDIR='/tmp/voz-natural-matplotlib')
import sys
from pathlib import Path
sys.path.append('/tmp/vozref-venv/lib/python3.10/site-packages')
sys.path.append(str(Path.home()/'.local/lib/python3.10/site-packages'))
import argparse, hashlib, json, re, subprocess
import numpy as np
from scipy import signal
import parselmouth

R=Path(__file__).resolve().parent
ROOT=R.parent.parent
SRC=ROOT/'work/voz/muestras'
REF=ROOT/'work/voz-ref'
SR=48000

def dump(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, allow_nan=False)+'\n')

def run(args):
    p=subprocess.run(args,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    if p.returncode: raise RuntimeError(p.stderr.decode(errors='replace')[-4000:])
    return p

def ff(*args):
    return run(['ffmpeg','-hide_banner','-nostdin','-y','-threads','1','-filter_threads','1',*map(str,args)])

def decode(path, sr=SR):
    return np.frombuffer(ff('-i',path,'-ac','1','-ar',sr,'-f','f32le','-').stdout,dtype='<f4').astype(float)

def wav(path,x):
    # Float WAV avoids intermediate quantization of the very quiet room floor.
    from scipy.io import wavfile
    wavfile.write(path,SR,np.asarray(x,dtype=np.float32))

def stat(a):
    a=np.asarray(a,dtype=float)
    return {k:float(f(a)) for k,f in [('median',np.median),('min',np.min),('max',np.max)]}|{'n':len(a)} if len(a) else {'n':0}

def db(a): return float(20*np.log10(max(float(a),1e-12)))

def silences(path):
    p=ff('-i',path,'-af','silencedetect=noise=-40dB:d=0.12','-f','null','-')
    txt=p.stderr.decode()
    starts=[float(v) for v in re.findall(r'silence_start: ([\d.]+)',txt)]
    ends=[float(v) for v in re.findall(r'silence_end: ([\d.]+)',txt)]
    spans=[]
    for a,b in zip(starts,ends):
        if spans and a-spans[-1]['end']<=.04:
            spans[-1]['end']=b; spans[-1]['seconds']=b-spans[-1]['start']
        else: spans.append(dict(start=a,end=b,seconds=b-a))
    duration=len(decode(path,16000))/16000
    internal=[g for g in spans if g['start']>.02 and g['end']<duration-.02]
    return spans,internal,duration

def words(voice):
    return [w for s in json.loads((SRC/f'transcripcion-{voice}.json').read_text())['segments'] for w in s['words']]

def context(pauses,ww):
    # Match punctuation boundaries monotonically. ASR often assigns silence to
    # the next word: use proximity to the previous word end, NOT gap overlap.
    boundaries=[(i,w) for i,w in enumerate(ww[:-1]) if re.search(r'[,.!?]$',w['word'])]
    used=set(); result=[dict(g) for g in pauses]
    for i,w in boundaries:
        choices=[j for j,g in enumerate(pauses) if j not in used and -.10<=g['start']-w['end']<=.65]
        if choices:
            j=min(choices,key=lambda j:abs(pauses[j]['start']-w['end']))
            used.add(j)
            result[j].update(after=w['word'].strip(),before=ww[i+1]['word'].strip(),
                punctuation='coma' if w['word'].endswith(',') else 'punto',
                asr_previous_end=w['end'],asr_next_start=ww[i+1]['start'],
                offset_from_asr_end_s=pauses[j]['start']-w['end'],
                alignment='proximidad; ASR absorbe silencio, no alineación fonética')
    for j,g in enumerate(result):
        if j not in used:
            w=min(ww,key=lambda w:abs((w['start']+w['end'])/2-(g['start']+g['end'])/2))
            g.update(after=w['word'].strip(),before='',punctuation='sin puntuación',
                     alignment='dentro del intervalo ASR; posible vacilación o consonante débil')
    return result

def loudness(path):
    p=ff('-i',path,'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-')
    return json.loads(re.search(r'\{\s*"input_i".*?\}',p.stderr.decode(),re.S).group())

def measure(path,n=27,pitch=True):
    allp,internal,dur=silences(path)
    start=allp[0]['end'] if allp and allp[0]['start']<=.02 else 0
    end=allp[-1]['start'] if allp and allp[-1]['end']>=dur-.02 else dur
    x=decode(path,16000); m=loudness(path)
    out=dict(file=str(path.relative_to(ROOT)),sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
             duration_s=dur,words=n,ppm_file=n*60/dur,ppm_narration=n*60/(end-start),
             activity_start=start,activity_end=end,pauses=internal,
             pause_stats_s=stat([g['seconds'] for g in internal]),
             lufs=float(m['input_i']),true_peak_dbtp=float(m['input_tp']),
             clipped_samples=int(np.sum(np.abs(x)>=1)))
    if pitch:
        snd=parselmouth.Sound(x,sampling_frequency=16000)
        p=snd.to_pitch_ac(time_step=.01,pitch_floor=60,pitch_ceiling=400,voicing_threshold=.5)
        q=snd.to_pitch_ac(time_step=.01,pitch_floor=75,pitch_ceiling=500,voicing_threshold=.5)
        f=p.selected_array['frequency']; alt=np.interp(p.xs(),q.xs(),q.selected_array['frequency'])
        mask=(f>0)&(alt>0)
        out['f0_hz']=stat(f[f>0]);out['f0_p10_p90_hz']=list(map(float,np.percentile(f[f>0],[10,90])))
        out['pitch_disagreement_gt9st_percent']=float(np.mean(np.abs(12*np.log2(f[mask]/alt[mask]))>9)*100)
    return out

def humanize(x,pauses,seed):
    pieces=[]; edits=[]; cursor=0; removed=0; fade=int(.020*SR)
    for g in pauses:
        # The Sheffield attack is the only dramatic beat. Never lengthen pauses.
        dramatic=g.get('after')=='completo.'
        target=.55 if dramatic else (.18 if g['punctuation']=='coma' else .28 if g['punctuation']=='punto' else .14)
        target=min(target,g['seconds'])
        a=int(round(g['start']*SR));b=int(round(g['end']*SR))
        remove=int(round((g['seconds']-target)*SR))
        e=dict(g,target_s=target,dramatic=dramatic)
        if remove>=int(.025*SR):
            # Crossfade only the CENTER of the low-amplitude interval. Keep
            # >=45 ms intact at each edge, including weak word tails.
            center=(a+b)//2
            left=center-remove//2+fade//2
            right=left+remove-fade
            assert left-fade-a>=int(.045*SR) and b-right-fade>=int(.045*SR)
            weight=.5-.5*np.cos(np.linspace(0,np.pi,fade))
            cross=x[left-fade:left]*(1-weight)+x[right:right+fade]*weight
            pieces.extend([x[cursor:left-fade],cross])
            # Record actual join discontinuity and low-energy cutting area.
            join_start=(left-fade)/SR-removed/SR
            edits.append(e|dict(cut_left_s=left/SR,cut_right_s=right/SR,
                removed_s=remove/SR,fade_ms=20,edge_guard_ms=45,join_start_s=join_start,
                cut_zone_peak_dbfs=db(np.max(np.abs(np.r_[x[left-fade:left],x[right:right+fade]]))),
                splice_delta_peak_dbfs=db(np.max(np.abs(np.diff(np.r_[x[left-fade-1],cross,x[right+fade]]))))))
            cursor=right+fade
            removed+=remove
        e['output_start_s']=g['start']-(removed-(remove if remove>=int(.025*SR) else 0))/SR
        e['output_end_s']=e['output_start_s']+target
        g['humanized_slot']=e
    pieces.append(x[cursor:]);y=np.concatenate(pieces)
    # A continuous, deterministic, colored air floor: NOT a recorded room.
    rng=np.random.default_rng(seed);noise=signal.lfilter([1],[1,-.88],rng.normal(size=len(y)))
    noise=signal.sosfilt(signal.butter(2,[90,7500],btype='bandpass',fs=SR,output='sos'),noise)
    noise*=10**(-68/20)/np.sqrt(np.mean(noise**2))
    # Gentle file-edge envelopes, entirely within original quiet margins.
    nf=int(.025*SR);noise[:nf]*=np.linspace(0,1,nf);noise[-nf:]*=np.linspace(1,0,nf)
    y+=noise
    return y,edits

def add_breath(x,pauses,human):
    g=next(g for g in pauses if g.get('after')=='completo.')
    slot=g['humanized_slot'] if human else dict(output_start_s=g['start'],output_end_s=g['end'])
    source=REF/'sfx-cc0/exhale-02.wav';t=.18
    breath=decode(source)[int(.90*SR):int((.90+t)*SR)]
    breath=signal.sosfilt(signal.butter(2,[180,4500],btype='bandpass',fs=SR,output='sos'),breath)
    breath*=10**(-46/20)/np.sqrt(np.mean(breath**2))
    nf=int(.025*SR);breath[:nf]*=np.linspace(0,1,nf);breath[-nf:]*=np.linspace(1,0,nf)
    start=(slot['output_start_s']+slot['output_end_s']-t)/2
    a=int(start*SR);y=x.copy();y[a:a+len(breath)]+=breath
    return y,dict(source=str(source.relative_to(ROOT)),source_sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
        license='CC0 según ficha local de SFXMint',source_start_s=.90,start_s=start,duration_s=t,
        rms_before_chain_dbfs=-46,fade_ms=25,kind='fragmento de exhalación; no inhalación añadida',
        note='Un solo evento por archivo; pendiente de escucha, no certificación perceptual de ausencia de jadeo')

def chain(profile,args):
    medium=profile=='media';st=args.pitch_media if medium else args.pitch_suave
    amt=args.saturation_media if medium else args.saturation_suave
    # Parallel tanh with input compensation: modest, adjustable tape-like color.
    drive=2.3 if medium else 1.7
    expr=f'(1-{amt})*val(0)+{amt}*tanh({drive}*val(0))/{drive}'
    return ','.join([
        f'rubberband=tempo=1:pitch={2**(st/12):.9f}:formant=preserved:pitchq=quality',
        'highpass=f=65',f'bass=g={2 if medium else 1}:f=150:w=0.7',
        f'equalizer=f=3500:t=q:w=0.9:g={1.1 if medium else .7}',
        f"aeval=exprs='{expr}'",f'deesser=i={.20 if medium else .12}:m=0.20:f=0.5',
        # Quiet early reflections, with the tail contained in existing margins.
        f'aecho=1:1:13|23:{.035 if medium else .020}|{.018 if medium else .010}'
    ])

def master(source,dest,mp3=True):
    m=loudness(source)
    norm=('loudnorm=I=-16:TP=-2.5:LRA=11:'+':'.join(f'{k}={m[v]}' for k,v in
        [('measured_I','input_i'),('measured_TP','input_tp'),('measured_LRA','input_lra'),
         ('measured_thresh','input_thresh'),('offset','target_offset')])+':linear=true')
    gain=0.
    for _ in range(4):
        codec=['-c:a','libmp3lame','-b:a','192k'] if mp3 else ['-c:a','pcm_s24le']
        ff('-i',source,'-af',norm+f',volume={gain:.5f}dB','-ac','1','-ar',SR,*codec,dest)
        post=loudness(dest);error=-16-float(post['input_i'])
        if abs(error)<=.04:break
        gain+=error
    assert abs(float(post['input_i'])+16)<=.10,post
    assert float(post['input_tp'])<=-1.45,post
    return dict(filter=norm,post_encode_gain_db=gain,measured=post)

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--pitch-suave',type=float,default=0)
    ap.add_argument('--pitch-media',type=float,default=-1.2)
    ap.add_argument('--saturation-suave',type=float,default=.08)
    ap.add_argument('--saturation-media',type=float,default=.16)
    args=ap.parse_args()
    assert all(-2<=p<=0 for p in [args.pitch_suave,args.pitch_media])
    assert all(0<=p<=.3 for p in [args.saturation_suave,args.saturation_media])
    report=dict(api_calls=0,arguments=vars(args),sample_words=27,source_hashes={},originals=[],variants=[],edits={},breaths={},chains={},masters={},humanized_clean=[])
    originals=[SRC/f'malvinas-{v}{s}.mp3' for v in ['algenib','orus'] for s in ['', '-fx']]
    sources=originals+[SRC/f'malvinas-{v}.wav' for v in ['algenib','orus']]
    report['source_hashes']={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in sources}
    for p in originals:
        v='algenib' if 'algenib' in p.name else 'orus'
        m=measure(p);m['context_pauses']=context(m['pauses'],words(v))
        ww=words(v)
        m['asr_gaps']=[dict(after=a['word'].strip(),before=b['word'].strip(),start=a['end'],end=b['start'],seconds=round(b['start']-a['end'],6)) for a,b in zip(ww,ww[1:]) if round(b['start']-a['end'],6)>=.12]
        report['originals'].append(m)
        master(p,R/(p.stem+'-referencia-16LUFS.wav'),mp3=False)
        print('original',p.name,m['pause_stats_s'],flush=True)
    for vi,v in enumerate(['algenib','orus']):
        source=SRC/f'malvinas-{v}.wav';x=decode(source)
        sm=measure(source);pauses=context(sm['pauses'],words(v))
        human,edits=humanize(x,pauses,123+vi)
        clean=R/f'{v}-humanizada-limpia.wav';wav(clean,human)
        report['humanized_clean'].append(measure(clean))
        report['edits'][v]=dict(source=sm,pauses=pauses,splices=edits,room_floor_dbfs=-68)
        for mode,y in [('originales',x),('humanizadas',human)]:
            withbreath,cue=add_breath(y,pauses,mode=='humanizadas')
            stage=R/f'{v}-{mode}-con-aire.wav';wav(stage,withbreath)
            report['breaths'][f'{v}-{mode}']=cue
            for profile in ['suave','media']:
                stem=f'{v}-pausas-{mode}-madurez-{profile}'
                wet=R/f'{stem}.wav';dest=R/f'{stem}.mp3'
                filters=chain(profile,args)
                ff('-i',stage,'-af',filters,'-t',len(y)/SR,'-ar',SR,'-c:a','pcm_f32le',wet)
                report['chains'][stem]=filters;report['masters'][stem]=master(wet,dest)
                m=measure(dest);m.update(voice=v,pause_mode=mode,maturity=profile)
                report['variants'].append(m)
                print(stem,round(m['ppm_narration'],1),m['lufs'],m['true_peak_dbtp'],flush=True)
    reference=REF/'Picker_Rickmansworth_88_mp3.mp3'
    report['reference_same_acoustic_method']=measure(reference,n=753,pitch=False)
    report['reference_asr']=json.loads((REF/'analisis.json').read_text())['pauses']
    for p,h in report['source_hashes'].items():assert hashlib.sha256((ROOT/p).read_bytes()).hexdigest()==h
    variants=report['variants']; spread=max(m['lufs'] for m in variants)-min(m['lufs'] for m in variants)
    assert spread<=.3
    assert all(m['clipped_samples']==0 and m['duration_s']<20 for m in variants)
    assert all(110<=m['ppm_narration']<=140 for m in variants if m['pause_mode']=='humanizadas')
    assert len(list(R.glob('*.mp3')))==8
    report['validation']=dict(lufs_spread=spread,sources_unchanged=True,mp3_count=8,
        zero_clipped_samples=True,humanized_ppm_in_110_140=True,
        max_splice_delta_dbfs=max(e['splice_delta_peak_dbfs'] for v in report['edits'].values() for e in v['splices']))
    dump(R/'mediciones.json',report)
    print('VALIDADO',report['validation'],flush=True)

if __name__=='__main__':main()

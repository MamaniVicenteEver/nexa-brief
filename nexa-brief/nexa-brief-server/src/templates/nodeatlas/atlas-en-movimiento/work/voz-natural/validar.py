"""QA local de uniones, señales conservadas y referencias. No modifica audios."""
import os
os.environ.update(OMP_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1')
import importlib.util,json,hashlib
from pathlib import Path
import numpy as np
R=Path(__file__).resolve().parent;ROOT=R.parent.parent
spec=importlib.util.spec_from_file_location('humanizar',R/'humanizar.py')
h=importlib.util.module_from_spec(spec);spec.loader.exec_module(h)
d=json.loads((R/'mediciones.json').read_text())
out=dict(splices=[],preserved_audio=[],final_mp3_join_windows=[],references=[])
for voice,plan in d['edits'].items():
    x=h.decode(ROOT/'work/voz/muestras'/f'malvinas-{voice}.wav')
    y=h.decode(R/f'{voice}-humanizada-limpia.wav')
    src_cursor=0;dst_cursor=0;residuals=[]
    for e in plan['splices']:
        fade=round(e['fade_ms']/1000*h.SR)
        a=round(e['cut_left_s']*h.SR)-fade;b=round(e['cut_right_s']*h.SR)+fade
        n=a-src_cursor
        residuals.append(y[dst_cursor:dst_cursor+n]-x[src_cursor:a])
        j=dst_cursor+n
        diffs=[abs(y[j]-y[j-1]),abs(y[j+fade]-y[j+fade-1])]
        check=dict(voice=voice,after=e['after'],join_start_s=j/h.SR,
                   splice_edge_delta_dbfs=[h.db(s) for s in diffs],
                   entire_splice_delta_peak_dbfs=h.db(np.max(np.abs(np.diff(y[j-1:j+fade+1])))),
                   protected_edge_ms=e['edge_guard_ms'],cut_zone_peak_dbfs=e['cut_zone_peak_dbfs'])
        # Any discontinuity in these quiet zones would be a corrective failure.
        assert max(check['splice_edge_delta_dbfs']) < -40,check
        assert check['entire_splice_delta_peak_dbfs'] < -40,check
        out['splices'].append(check)
        src_cursor=b;dst_cursor=j+fade
    residuals.append(y[dst_cursor:]-x[src_cursor:])
    z=np.concatenate(residuals)
    preserved=dict(voice=voice,samples=len(z),residual_rms_dbfs=h.db(np.sqrt(np.mean(z*z))),
                   residual_peak_dbfs=h.db(np.max(np.abs(z))),
                   note='Señal fuera de los fundidos: única diferencia prevista, piso de aire añadido; precisión float WAV.')
    assert preserved['residual_rms_dbfs']<-65,preserved
    out['preserved_audio'].append(preserved)
    for m in d['variants']:
        if m['voice']!=voice or m['pause_mode']!='humanizadas':continue
        decoded=h.decode(ROOT/m['file']);delta=np.diff(decoded)
        for e in plan['splices']:
            t=e['join_start_s'];a=max(0,round((t-.010)*h.SR));b=round((t+.030)*h.SR)
            win=delta[a:b]
            check=dict(file=m['file'],after=e['after'],window_start_s=a/h.SR,
                window_end_s=b/h.SR,max_sample_delta_dbfs=h.db(np.max(np.abs(win))),
                note='Ventana cubre ambos extremos del cruce; fase alterada por pitch/MP3, no una prueba perceptual.')
            assert check['max_sample_delta_dbfs']<-28,check
            out['final_mp3_join_windows'].append(check)
    slots=[g['humanized_slot'] for g in plan['pauses']]
    assert sum(g['target_s']>=.5 for g in slots)<=1
    assert all(g['target_s']<=.7 for g in slots)
for m in d['originals']:
    path=R/(Path(m['file']).stem+'-referencia-16LUFS.wav')
    lm=h.loudness(path)
    assert abs(float(lm['input_i'])+16)<=.1
    assert float(lm['input_tp'])<=-1.45
    out['references'].append(dict(file=path.name,lufs=float(lm['input_i']),true_peak_dbtp=float(lm['input_tp'])))
for path,expected in d['source_hashes'].items():
    assert hashlib.sha256((ROOT/path).read_bytes()).hexdigest()==expected
out['passed']=True
out['subjective_listening']='No realizada; métricas no certifican ausencia perceptual de clics ni integridad de consonantes.'
h.dump(R/'validacion-uniones.json',out)
print('QA completada',len(out['splices']),'fundidos,',len(out['final_mp3_join_windows']),'ventanas finales.')

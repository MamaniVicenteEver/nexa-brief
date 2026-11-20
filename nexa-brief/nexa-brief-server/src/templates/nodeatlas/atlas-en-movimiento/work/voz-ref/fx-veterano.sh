#!/usr/bin/env bash
# Uso: bash fx-veterano.sh entrada.wav salida.wav [respiraciones.json]
# También admite salida.mp3. No descarga, genera voz ni llama servicios.
# Manifest: {"cues":[{"file":"/ruta/CC0.wav","start":8.2,
#   "source_start":0.1,"duration":0.35,"target_rms_dbfs":-40}]}
# start es tiempo en el WAV de entrada; insertar solo en huecos ya comprobados.
set -euo pipefail
if [[ $# -lt 2 || $# -gt 3 ]]; then
  printf 'Uso: bash %s entrada.wav salida.wav [respiraciones.json]\n' "$0" >&2
  exit 2
fi
exec nice -n 15 python3 - "$@" <<'PY'
import sys, json, subprocess, tempfile, pathlib, math, struct, re, os
inp=pathlib.Path(sys.argv[1]).resolve(); out=pathlib.Path(sys.argv[2]).resolve()
if inp==out: raise SystemExit('Entrada y salida deben ser diferentes')
manifest=pathlib.Path(sys.argv[3]).resolve() if len(sys.argv)>3 else None
cues=json.loads(manifest.read_text()).get('cues',[]) if manifest else []
if not inp.is_file(): raise SystemExit('No existe la entrada')
if not out.parent.is_dir(): raise SystemExit('No existe la carpeta de salida')
def run(a,**kw): return subprocess.run(a,check=True,**kw)
def capture(a): return subprocess.check_output(a)
dur=float(capture(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',str(inp)]))
base=['ffmpeg','-hide_banner','-nostdin','-y','-threads','1','-filter_complex_threads','1','-i',str(inp)]
filters=['[0:a]aformat=sample_fmts=fltp:channel_layouts=mono,highpass=f=70,'
         'bass=g=2.2:f=150:w=0.7,equalizer=f=3000:t=q:w=0.8:g=1.2,lowpass=f=7500,'
         "aeval=exprs='tanh(1.10*val(0))/tanh(1.10)',"
         'aecho=in_gain=0.98:out_gain=1:delays=29|43:decays=0.035|0.020[v]']
labels=['[v]']; applied=[]
for i,c in enumerate(cues,1):
    p=pathlib.Path(c['file']); p=p if p.is_absolute() else manifest.parent/p
    p=p.resolve(); start=float(c['start']); trim=float(c.get('source_start',0)); length=float(c.get('duration',.35))
    target=float(c.get('target_rms_dbfs',-40))
    if not (0<=start<dur and .1<=length<=.6 and start+length<=dur and trim>=0):
        raise SystemExit(f'Cue {i}: tiempo fuera de rango o duración no comprendida entre 100 y 600 ms')
    raw=capture(['ffmpeg','-v','error','-threads','1','-ss',str(trim),'-t',str(length),'-i',str(p),'-af','highpass=f=180,lowpass=f=5500','-ar','16000','-ac','1','-f','f32le','-'])
    samples=[s[0] for s in struct.iter_unpack('<f',raw)]
    if not samples: raise SystemExit(f'Cue {i}: vacío')
    rms=math.sqrt(sum(s*s for s in samples)/len(samples)); gain=target-20*math.log10(max(rms,1e-10))
    base+=['-i',str(p)]
    filters.append(f'[{i}:a]atrim=start={trim}:duration={length},asetpts=PTS-STARTPTS,aformat=channel_layouts=mono,highpass=f=180,lowpass=f=5500,volume={gain:.5f}dB,afade=t=in:d=0.035,afade=t=out:st={max(0,length-.08):.5f}:d=0.08,adelay={round(start*1000)}:all=1[b{i}]')
    labels.append(f'[b{i}]'); applied.append(dict(c,source_rms_dbfs=20*math.log10(max(rms,1e-10)),gain_db=gain))
filters.append(''.join(labels)+f'amix=inputs={len(labels)}:duration=first:normalize=0,atrim=duration={dur},asetpts=PTS-STARTPTS[mix]')
with tempfile.TemporaryDirectory(prefix='fx-veterano-',dir='/tmp') as td:
    mixed=pathlib.Path(td)/'mezcla.wav'
    run(base+['-filter_complex',';'.join(filters),'-map','[mix]','-ar','48000','-c:a','pcm_f32le',str(mixed)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    first=run(['ffmpeg','-hide_banner','-nostdin','-threads','1','-i',str(mixed),'-af','loudnorm=I=-16:TP=-1.5:LRA=9:print_format=json','-f','null','-'],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    text=first.stderr.decode(); m=re.search(r'\{\s*"input_i".*?\}',text,re.S)
    if not m: raise SystemExit('No se pudo medir loudnorm')
    v=json.loads(m.group()); normal=f'loudnorm=I=-16:TP=-1.5:LRA=9:measured_I={v["input_i"]}:measured_TP={v["input_tp"]}:measured_LRA={v["input_lra"]}:measured_thresh={v["input_thresh"]}:offset={v["target_offset"]}:linear=true:print_format=json'
    codec=['-c:a','libmp3lame','-b:a','192k'] if out.suffix.lower()=='.mp3' else ['-c:a','pcm_s24le']
    final=run(['ffmpeg','-hide_banner','-nostdin','-y','-threads','1','-i',str(mixed),'-af',normal,'-t',str(dur),'-ar','48000']+codec+[str(out)],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE)
    log={'input':str(inp),'output':str(out),'duration_s':dur,'filter_complex':filters,'breaths':applied,'loudnorm_first_pass':v,'final_ffmpeg_log':final.stderr.decode(),'note':'EQ, saturación y sala modifican color, no convierten una voz en otra. Revisar escucha y pico después de MP3.'}
    out.with_suffix(out.suffix+'.fx.json').write_text(json.dumps(log,ensure_ascii=False,indent=2))
print(str(out))
PY

#!/usr/bin/env node
/** Per-line Gemini TTS + raw Whisper QC. Python lives only in a cleaned /tmp directory. */
import {spawn} from 'node:child_process';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {fileURLToPath, pathToFileURL} from 'node:url';
import path from 'node:path';

// Misma regla acústica que connected_activity del worker Python; paridad probada sin red.
export function connectedActivity(samples, rate, lastWord){
 const frame=Math.max(1,Math.round(rate*.01)),regions=[];
 for(let a=0;a<samples.length;a+=frame){
  const b=Math.min(samples.length,a+frame);let energy=0;
  for(let i=a;i<b;i++)energy+=samples[i]**2;
  if(Math.sqrt(energy/(b-a))<=10**(-48/20))continue;
  const previous=regions.at(-1);
  if(previous&&a-previous[1]<Math.round(rate*.15))previous[1]=b;
  else regions.push([a,b]);
 }
 const seed=(lastWord-.1)*rate;
 return regions.find(([a,b])=>a<=seed&&seed<b)??regions.find(([a])=>a>lastWord*rate)??null;
}

// Bloques contiguos de 5 ms; no usar timestamps de Whisper al inicio.
export function leadingActivity(samples, rate){
 const frame=Math.max(1,Math.round(rate*.005)),regions=[];
 for(let a=0;a<samples.length;a+=frame){
  const b=Math.min(samples.length,a+frame);let energy=0;
  for(let i=a;i<b;i++)energy+=samples[i]**2;
  if(Math.sqrt(energy/(b-a))<=10**(-48/20))continue;
  if(regions.length&&a===regions.at(-1)[1])regions.at(-1)[1]=b;
  else regions.push([a,b]);
 }
 const first=regions[0]??null,next=regions[1]??null;
 let firstEnergy=0; if(first)for(let i=first[0];i<first[1];i++)firstEnergy+=samples[i]**2;
 const strong=!!first&&firstEnergy/(first[1]-first[0])>10**(-35/10);
 const candidate=!!(strong&&next&&first[1]-first[0]<Math.round(rate*.04));
 const gap=candidate?next[0]-first[1]:null;
 return {first,next,candidate,gap,removable:candidate&&gap>=Math.round(rate*.08),
  voice_start:first?(candidate?next[0]:first[0]):null};
}

export const worker = String.raw`
import sys
sys.dont_write_bytecode = True
import contextlib, difflib, hashlib, io, json, math, os, re, shutil, signal, subprocess, time, wave
from pathlib import Path
import numpy as np
import jsonschema

root, prototype, work, only_arg, force_arg = sys.argv[1:]
root, prototype, work = Path(root), Path(prototype), Path(work)
kit = root.parents[2] / '_tools' / 'explainer-kit' / 'tools'
sys.path.insert(0, str(kit))
import tts
from narrate import norm, NUMW
VERSION = 1
started = time.monotonic()
audio = prototype / 'assets/audio'
lines_dir = audio / 'lines'
lines_dir.mkdir(parents=True, exist_ok=True)
# The shared kit quota ledger must not be modified by this isolated task.
tts.STATE = audio / 'gemini-quota.json'
metrics = {'version': VERSION, 'started': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'prototype': str(prototype), 'tts_calls': 0, 'tts_generations': 0, 'qc_retries': 0,
           'cache_hits': 0, 'generated': [], 'failures': [], 'attempts': []}
original_urlopen = tts.urllib.request.urlopen
original_available, original_mark_exhausted = tts._available, tts._mark_exhausted
billing_unavailable = set()
quota_kind = None
def available(model):
    return [(name,key) for name,key in original_available(model) if (name,model) not in billing_unavailable]
def mark_exhausted(name, model):
    if quota_kind == 'billing':
        # Credit may be restored at any time: skip this key only for this run.
        billing_unavailable.add((name, model))
    else:
        original_mark_exhausted(name, model)
tts._available, tts._mark_exhausted = available, mark_exhausted

def counted_urlopen(*args, **kwargs):
    global quota_kind
    metrics['tts_calls'] += 1
    try:
        return original_urlopen(*args, **kwargs)
    except tts.urllib.error.HTTPError as exc:
        # Inspect the complete quota details before the kit truncates the message.
        # Daily quota IDs may occur after the first 400 characters.
        body = exc.read()
        detail = body.decode(errors='replace')
        if exc.code == 402 and ('RESOURCE_EXHAUSTED' in detail or 'credits' in detail.lower()):
            quota_kind = 'billing'
            metrics['billing_quota_errors'] = metrics.get('billing_quota_errors', 0) + 1
            raise tts.QuotaError('HTTP 402: saldo prepago agotado; rotar clave conservando voz/modelo') from None
        if exc.code == 429 and re.search(r'per.?day|requestsperday', detail, re.I):
            quota_kind = 'daily'
            metrics.setdefault('daily_quota_errors', 0)
            metrics['daily_quota_errors'] += 1
            raise tts.QuotaError('HTTP 429: cuota diaria agotada; rotar clave conservando voz/modelo') from None
        raise tts.urllib.error.HTTPError(exc.url, exc.code, exc.msg, exc.hdrs, io.BytesIO(body)) from None
tts.urllib.request.urlopen = counted_urlopen

def digest(value):
    return hashlib.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
def filehash(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()
def save(p, value):
    # Atomic publish on the destination filesystem; staging is in the authorized audio directory.
    temporary = p.with_name(p.name + '.tmp')
    try:
        temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + '\n')
        os.replace(temporary, p)
    finally:
        temporary.unlink(missing_ok=True)
def ffmpeg(args):
    p = subprocess.run(['ffmpeg', '-nostdin', '-y', '-hide_banner', *args], capture_output=True, text=True)
    if p.returncode:
        raise RuntimeError('ffmpeg: ' + p.stderr[-1600:])
    return p.stderr

def readwav(p):
    with wave.open(str(p)) as w:
        if w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError('WAV debe ser PCM16 mono')
        rate = w.getframerate()
        return np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768, rate

def writewav(p, x, rate=48000):
    with wave.open(str(p), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(rate)
        w.writeframes(np.round(np.clip(x, -1, 32767/32768) * 32768).astype('<i2').tobytes())

def levels(p):
    log = ffmpeg(['-i', str(p), '-af', 'loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'])
    matches = re.findall(r'\{\s*"input_i"[\s\S]*?\}', log)
    if not matches: raise RuntimeError('No se pudo medir LUFS')
    return json.loads(matches[-1])

def active_regions(x, rate):
    # 10 ms blocks, -48 dBFS; bridge gaps <=20 ms within a phoneme.
    frame = max(1, round(rate * .01))
    active = [np.sqrt(np.mean(x[i:i+frame]**2)) > 10**(-48/20)
              for i in range(0, len(x), frame)]
    regions = []
    for i, on in enumerate(active):
        if not on: continue
        a, b = i*frame, min(len(x), (i+1)*frame)
        if regions and a-regions[-1][1] <= round(rate*.02): regions[-1][1] = b
        else: regions.append([a, b])
    return regions

def trailing_burst(x, rate, last_word=None):
    regions = active_regions(x, rate)
    if len(regions) < 2: return None
    previous, final = regions[-2:]
    a, b = final
    if (a-previous[1])/rate < .12 or (b-a)/rate >= .4: return None
    if last_word is not None and a/rate <= last_word: return None
    return a, b, previous[1]

def connected_activity(x, rate, last_word):
    # Whisper suele adelantarse: unir huecos <150 ms y seguir la actividad real.
    frame = max(1, round(rate*.01))
    regions = []
    for a in range(0, len(x), frame):
        b = min(len(x), a+frame)
        if np.sqrt(np.mean(x[a:b]**2)) <= 10**(-48/20): continue
        if regions and a-regions[-1][1] < round(rate*.15): regions[-1][1] = b
        else: regions.append([a,b])
    seed = (last_word-.1)*rate
    return next((r for r in regions if r[0] <= seed < r[1]),
                next((r for r in regions if r[0] > last_word*rate), None))

def leading_click(x, rate):
    # Primera región estrictamente contigua; preservar incluso señales tenues.
    frame = max(1, round(rate*.005))
    regions = []
    for a in range(0, len(x), frame):
        b = min(len(x), a+frame)
        if np.sqrt(np.mean(x[a:b]**2)) <= 10**(-48/20): continue
        if regions and a == regions[-1][1]: regions[-1][1] = b
        else: regions.append([a,b])
    first = regions[0] if regions else None
    following = regions[1] if len(regions)>1 else None
    strong = bool(first) and float(np.mean(x[first[0]:first[1]]**2)) > 10**(-35/10)
    candidate = bool(strong and following and first[1]-first[0] < round(rate*.04))
    gap = following[0]-first[1] if candidate else None
    return {'first':first, 'next':following, 'candidate':candidate, 'gap':gap,
            'removable':candidate and gap >= round(rate*.08),
            'voice_start':(following[0] if candidate else first[0]) if first else None}

def remove_leading_click(x, rate):
    found = leading_click(x, rate)
    if not found['removable']: return x, found
    x = x.copy()
    x[:min(len(x), found['first'][1]+round(rate*.003))] = 0
    return x, found

def trailing_noise(x, rate, words):
    # No confundir una sílaba final real con ruido por el adelanto de Whisper.
    if not words: return True, 0.0
    region = connected_activity(x, rate, max(w['e'] for w in words))
    if region is None: return True, 0.0
    a = min(len(x), region[1]+round(.1*rate))
    frame = max(1, round(rate*.02))
    rms = max((float(np.sqrt(np.mean(x[i:i+frame]**2)))
               for i in range(a, len(x), frame)), default=0.0)
    db = 20*math.log10(max(rms, 1e-12))
    return db >= -45, round(db, 3)

def postprocess(raw, out, profile):
    stretched = work / 'tempo.wav'
    pp = profile['postprocess']
    ffmpeg(['-loglevel', 'error', '-i', str(raw), '-af', f"atempo={pp['tempo']}", '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', str(stretched)])
    x, rate = readwav(stretched)
    # Retirar el clic antes del recorte por bordes y de medir loudnorm.
    # Mantener offsets: solo sustituir muestras, nunca desplazar voz.
    x, _ = remove_leading_click(x, rate)
    # Edge-only trim at -48 dBFS, with a 40 ms guard to retain weak consonants.
    frame = 480
    activity = np.array([np.sqrt(np.mean(x[i:i+frame]**2)) for i in range(0,len(x),frame)])
    active = np.flatnonzero(activity > 10**(-48/20))
    if not len(active): raise RuntimeError('Audio vacío o sin voz')
    a, b = max(0, int(active[0]*frame)-1920), min(len(x), int((active[-1]+1)*frame)+1920)
    x = x[a:b]
    # Remove the isolated final region BEFORE loudnorm can include its energy.
    burst = trailing_burst(x, rate)
    if burst:
        _, _, speech_end = burst
        x = x[:min(len(x), speech_end+round(.04*rate))].copy()
        fade = min(speech_end, round(.02*rate))
        x[speech_end-fade:speech_end] *= np.linspace(1, 0, fade)
        x[speech_end:] = 0
    x = np.concatenate([np.zeros(round(profile['lead']*rate)), x, np.zeros(round(profile['tail']*rate))])
    trimmed = work / 'trimmed.wav'; writewav(trimmed, x)
    measure = levels(trimmed)
    if not math.isfinite(float(measure['input_i'])): raise RuntimeError('Audio sin energía medible')
    filters = (f"loudnorm=I={pp['lufs']}:TP={pp['true_peak_db']}:LRA=11:"
               f"measured_I={measure['input_i']}:measured_TP={measure['input_tp']}:"
               f"measured_LRA={measure['input_lra']}:measured_thresh={measure['input_thresh']}:"
               f"offset={measure['target_offset']}:linear=true")
    ffmpeg(['-loglevel','error','-i',str(trimmed),'-af',filters,'-ar','48000','-ac','1','-c:a','pcm_s16le',str(out)])
    final = levels(out)
    # On very short phrases loudnorm can undershoot its target. Correct the
    # measured level locally, limiting transients rather than spending more TTS.
    for _ in range(3):
        adjustment = pp['lufs'] - float(final['input_i'])
        if abs(adjustment) <= 0.25 and float(final['input_tp']) <= pp['true_peak_db'] + 0.1: break
        corrected = work / 'level-corrected.wav'
        ceiling = 10 ** ((pp['true_peak_db'] - 0.2) / 20)
        ffmpeg(['-loglevel','error','-i',str(out),'-af',
                f'aresample=192000,volume={adjustment}dB,apad=pad_len=959,alimiter=limit={ceiling}:attack=5:release=50:level=false,atrim=start_sample=959,asetpts=PTS-STARTPTS,aresample=48000',
                '-ar','48000','-ac','1','-c:a','pcm_s16le',str(corrected)])
        os.replace(corrected, out)
        final = levels(out)
    return float(final['input_i']), float(final['input_tp'])

def tokens(text):
    return [v for w in norm(text) for v in NUMW(w).split()]

whisper = None
def inspect(clip, line, profile):
    global whisper
    if whisper is None:
        from faster_whisper import WhisperModel
        whisper = WhisperModel('large-v3', device='cpu', compute_type='int8', cpu_threads=4, local_files_only=True)
    names = ', '.join(sorted(set(re.findall(r'\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+',line['text']))))[:400]
    segments, _ = whisper.transcribe(str(clip), language='es', word_timestamps=True, beam_size=5,
        vad_filter=True, initial_prompt=f'Diálogo en español. Nombres: {names}.', condition_on_previous_text=False)
    segments = list(segments)
    transcript = ' '.join(s.text.strip() for s in segments)
    words = [{'w':w.word.strip(), 's':round(w.start,3), 'e':round(w.end,3)} for s in segments for w in (s.words or [])]
    ref, hyp = tokens(line['text']), tokens(transcript)
    missing, extra = [], []
    for op,a,b,c,d in difflib.SequenceMatcher(a=ref,b=hyp,autojunk=False).get_opcodes():
        if op in ('delete','replace'): missing += ref[a:b]
        if op in ('insert','replace'): extra += hyp[c:d]
    x, rate = readwav(clip)
    dur = len(x)/rate
    frame = rate//100
    rms = np.array([np.sqrt(np.mean(x[i:i+frame]**2)) for i in range(0,len(x),frame)])
    envelope = (rms / rms.max()) if rms.max() else rms
    silent = rms < 10**(-45/20)
    runs = []
    a = None
    for i, is_silent in enumerate([*silent, False]):
        if is_silent and a is None: a=i
        if not is_silent and a is not None:
            if a>0 and i<len(silent) and (i-a)/100>1.2: runs.append({'s':a/100,'e':i/100})
            a=None
    # Ellipses authorize a pause only at their actual position in the script.
    allowed = []
    for m in re.finditer(r'\.{3}|…',line['text']):
        before = tokens(line['text'][:m.start()]); after = tokens(line['text'][m.end():])
        normalized = [tokens(w['w']) for w in words]
        cumulative=0
        for i, ws in enumerate(normalized[:-1]):
            cumulative += len(ws)
            if cumulative==len(before) and before and after:
                allowed.append((words[i]['e']-0.12, words[i+1]['s']+0.12))
    bad_silences=[r for r in runs if not any(r['s']>=a and r['e']<=b for a,b in allowed)]
    timestamps_ok = bool(words) and all(0<=w['s']<w['e']<=dur+0.025 for w in words) and all(a['e']<=b['s']+0.025 for a,b in zip(words,words[1:]))
    noise, tail_db = trailing_noise(x, rate, words)
    leading = leading_click(x, rate)
    qc={'ok':not missing and not extra and not bad_silences and timestamps_ok and not noise and not leading['removable'],
        'model':'faster-whisper large-v3','transcript':transcript,'missing':missing,'extra':extra,
        'long_silences':runs,'unexpected_silences':bad_silences,'timestamps_ok':timestamps_ok,
        'leading_click':leading['removable'],'leading_click_candidate':leading['candidate'],
        'leading_click_gap_ms':round(leading['gap']/rate*1000,3) if leading['gap'] is not None else None,
        'trailing_noise':noise,'trailing_noise_db':tail_db,
        'words_ref':len(ref),'words_transcribed':len(hyp),'peak_dbfs':round(20*math.log10(max(np.max(np.abs(x)),1e-10)),3),
        'wpm':round(len(ref)/dur*60,1)}
    return {'speaker':line['who'],'clip':f"audio/lines/{line['id']}.wav",'dur':round(dur,6),
            'words':words,'rms':[round(float(v),5) for v in envelope],'rmsHz':100,'text':line['text'],'qc':qc}

def safe_error(exc):
    message = str(exc)
    # Defense in depth: an upstream error must never disclose an API key.
    for _,key in tts.gemini_keys(): message=message.replace(key,'[redacted]')
    if isinstance(exc, tts.QuotaError) and metrics.get('billing_quota_errors'):
        message += ' (HTTP 402: saldo prepago agotado en claves configuradas)'
    return message[:2000]

def main():
    episode=json.loads((prototype/'assets/episode.json').read_text())
    script=episode['script']
    if not script: raise ValueError('episode.script está vacío')
    ids=[line['id'] for line in script]
    if len(set(ids))!=len(ids) or any(not re.fullmatch(r'[A-Za-z][A-Za-z0-9_-]*',id) for id in ids): raise ValueError('IDs de línea inválidos o duplicados')
    only=set(only_arg.split(',')) if only_arg else set(ids)
    if only-set(ids): raise ValueError('Líneas desconocidas en --only: '+','.join(sorted(only-set(ids))))
    schema=json.loads((root/'schema/voice.schema.json').read_text())
    profiles={}
    for speaker in {line['who'] for line in script}:
        if not re.fullmatch(r'[a-z][a-z0-9_-]*',speaker): raise ValueError('Hablante inválido')
        p=json.loads((root/'voices'/f'{speaker}.json').read_text())
        jsonschema.validate(p,schema)
        if p['id']!=speaker or p['voice'].lower()=='puck': raise ValueError(f'Perfil incompatible: {speaker}')
        profiles[speaker]=p
    if len({p['model'] for p in profiles.values()})!=1: raise ValueError('Los perfiles deben usar un único modelo fijo')
    if len({p['voice'].lower() for p in profiles.values()})!=len(profiles): raise ValueError('Cada personaje necesita una voz distinta')
    timing={'version':1,'fps':30,'lines':{}}
    for line in script:
        id=line['id']; p=profiles[line['who']]
        sha=digest({'text':line['text'],'emotion':line['emotion'],'profile':p,'pipeline_version':VERSION})
        clip=lines_dir/f'{id}.wav'; sidecar=lines_dir/f'{id}.json'
        cached=None
        try:
            doc=json.loads(sidecar.read_text())
            if (doc['hash']==sha and doc['wav_sha256']==filehash(clip) and doc['timing']['qc']['ok']
                and doc['pipeline_version']==VERSION and not leading_click(*readwav(clip))['removable'] and not trailing_noise(*readwav(clip), doc['timing']['words'])[0]):
                cached=doc['timing']
        except (OSError,KeyError,ValueError): pass
        if id not in only or (cached and force_arg!='true'):
            if cached:
                timing['lines'][id]=cached
                if id in only:
                    metrics['cache_hits']+=1; print(f'{id} {line["who"]}: caché ✓',flush=True)
            continue
        calls_start=metrics['tts_calls']; generated_start=time.monotonic()
        attempts=[]
        try:
            for attempt in range(3):
                metrics['tts_generations']+=1
                if attempt: metrics['qc_retries']+=1
                raw=work/'raw.wav'; final=work/'final.wav'
                prompt=(f"AUDIO PROFILE: {p['direction']}\n"
                    f"DIRECTOR'S NOTES: Ritmo objetivo de {p['pace']} palabras por minuto. "
                    f"Emoción de esta línea: {line['emotion']}. Interpreta la emoción sin añadir risas, "
                    "interjecciones ni palabras al texto. No leas instrucciones. Dicción clara y natural. "
                    "Pausas breves entre frases, ninguna pausa interior mayor de un segundo salvo puntos suspensivos. "
                    "Lee exactamente una vez el TRANSCRIPT, sin introducción ni despedida.\n"
                    f"TRANSCRIPT:\n{line['text']}")
                print(f'{id} {line["who"]}: {p["voice"]} / {p["model"]}, intento {attempt+1}',flush=True)
                with contextlib.redirect_stdout(io.StringIO()):
                    tts.with_key_rotation(p['model'],lambda key:tts.gemini_director(prompt,raw,voice=p['voice'],model=p['model'],api_key=key))
                lufs, peak=postprocess(raw,final,p)
                entry=inspect(final,line,p)
                qc=entry['qc']; qc.update(lufs=round(lufs,2),true_peak_db=round(peak,2))
                if abs(lufs-p['postprocess']['lufs'])>1.0 or peak>p['postprocess']['true_peak_db']+0.3:
                    qc['ok']=False; qc['level_error']=True
                attempts.append({'attempt':attempt+1,**qc})
                metrics['attempts'].append({'line':id,'attempt':attempt+1,'qc':qc})
                print(f'{id}: {entry["dur"]:.2f}s, {lufs:.1f} LUFS, QC={qc["ok"]}; faltan={qc["missing"]}, sobran={qc["extra"]}',flush=True)
                if qc['ok']:
                    qc['attempts']=attempt+1
                    staging = clip.with_name(clip.name + '.tmp')
                    try:
                        shutil.copyfile(final, staging)
                        os.replace(staging, clip)
                    finally:
                        staging.unlink(missing_ok=True)
                    save(sidecar,{'hash':sha,'pipeline_version':VERSION,'wav_sha256':filehash(clip),
                        'voice':p['voice'],'model':p['model'],'profile':p,'emotion':line['emotion'],
                        'tts_calls':metrics['tts_calls']-calls_start,'seconds':round(time.monotonic()-generated_start,3),
                        'attempts':attempts,'timing':entry})
                    timing['lines'][id]=entry; metrics['generated'].append(id)
                    break
            else:
                raise RuntimeError('QC falló tras 3 intentos con la misma voz/modelo: '+json.dumps(attempts[-1],ensure_ascii=False))
        except Exception as exc:
            message=safe_error(exc)
            metrics['failures'].append({'line':id,'error':message})
            print(f'{id}: ERROR {message}',file=sys.stderr,flush=True)
    save(prototype/'assets/timing.json',timing)
    if metrics['failures']: raise RuntimeError('Líneas fallidas: '+', '.join(x['line'] for x in metrics['failures']))

try:
    main()
except Exception as exc:
    metrics['error']=safe_error(exc)
    print('ERROR: '+metrics['error'],file=sys.stderr,flush=True)
finally:
    metrics['seconds']=round(time.monotonic()-started,3)
    with (audio/'voice-runs.jsonl').open('a') as f: f.write(json.dumps(metrics,ensure_ascii=False,allow_nan=False)+'\n')
    print(json.dumps({k:v for k,v in metrics.items() if k!='attempts'},ensure_ascii=False),flush=True)
if metrics.get('error'): sys.exit(1)
`;

async function main() {
  const args = process.argv.slice(2);
  const prototypeArg = args.shift();
  if (!prototypeArg || prototypeArg.startsWith('--')) throw new Error('Uso: voice.mjs <carpetaPrototipo> [--only L05,L06] [--force]');
  let only = '', force = false;
  while (args.length) {
    const arg = args.shift();
    if (arg === '--force') force = true;
    else if (arg === '--only' && args[0] && !args[0].startsWith('--')) only = args.shift();
    else throw new Error(`Opción inválida: ${arg}`);
  }
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const server = path.resolve(root, '../../../../..');
  const python = process.env.VIDA_PYTHON || path.join(server, '.venv/bin/python');
  const temporary = await mkdtemp('/tmp/vida-voces-');
  let child;
  const cleanup = () => child?.kill('SIGTERM');
  process.once('SIGINT', cleanup); process.once('SIGTERM', cleanup);
  try {
    const script = path.join(temporary, 'worker.py');
    await writeFile(script, worker);
    const code = await new Promise((resolve, reject) => {
      child = spawn(python, ['-B', script, root, path.resolve(prototypeArg), temporary, only, String(force)], {stdio: 'inherit', env: {...process.env, PYTHONDONTWRITEBYTECODE: '1'}});
      child.once('error', reject);
      child.once('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
    process.exitCode = code;
  } finally {
    process.removeListener('SIGINT', cleanup); process.removeListener('SIGTERM', cleanup);
    await rm(temporary, {recursive: true, force: true});
  }
}
if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

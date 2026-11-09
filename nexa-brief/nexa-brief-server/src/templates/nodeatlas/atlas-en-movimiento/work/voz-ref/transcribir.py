"""Transcripción enteramente local, sin VAD ni acceso a servicios."""
import json, os, time
from pathlib import Path
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['OMP_NUM_THREADS'] = '3'
os.environ['OPENBLAS_NUM_THREADS'] = '1'
from faster_whisper import WhisperModel

root = Path(__file__).resolve().parent
model_path = Path.home()/'.cache/huggingface/hub/models--Systran--faster-whisper-large-v3/snapshots/edaa852ec7e145841d8ffdb056a99866b5f0a478'
t = time.monotonic()
model = WhisperModel(str(model_path), device='cpu', compute_type='int8', cpu_threads=3, num_workers=1, local_files_only=True)
segments, info = model.transcribe(str(root/'Picker_Rickmansworth_88_mp3.mp3'), word_timestamps=True, vad_filter=False, beam_size=5, temperature=0, condition_on_previous_text=True)
data = {'source':'Picker_Rickmansworth_88_mp3.mp3', 'model':'Systran/faster-whisper-large-v3', 'revision':model_path.name, 'device':'cpu', 'compute_type':'int8', 'cpu_threads':3, 'vad_filter':False, 'word_timestamps':True, 'language':info.language, 'language_probability':info.language_probability, 'duration':info.duration, 'segments':[]}
print(f'Idioma: {info.language}; probabilidad: {info.language_probability:.6f}', flush=True)
for seg in segments:
    s = seg._asdict()
    s['words'] = [w._asdict() for w in seg.words or []]
    data['segments'].append(s)
    (root/'transcripcion.parcial.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
    print(f'[{seg.start:.2f}–{seg.end:.2f}] {seg.text}', flush=True)
data['elapsed_seconds'] = time.monotonic()-t
(root/'transcripcion.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
(root/'transcripcion.txt').write_text(f"Idioma detectado: {info.language}\nConfianza del detector de idioma: {info.language_probability:.6%} (no es exactitud de transcripción)\nModelo: large-v3 local; CPU int8, 3 hilos; sin VAD.\n\n"+'\n'.join(f"[{s['start']:07.2f}–{s['end']:07.2f}] {s['text'].strip()}" for s in data['segments'])+'\n')
print(f'Terminado en {data["elapsed_seconds"]:.1f} s', flush=True)

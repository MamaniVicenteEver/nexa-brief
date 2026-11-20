"""Alineación de escenas con ataques musicales, sin generar vídeo."""
from __future__ import annotations

import subprocess
from pathlib import Path
from src.core.nodemotion.promo.paths import work_script_path
from src.core.nodemotion.promo.workspace import audio as workspace_audio

import numpy as np


def onsets(path: Path, duration: float, rate: int = 11025, hop: float = 0.1):
    command = ['ffmpeg', '-v', 'error', '-i', str(path), '-t', str(duration),
               '-ac', '1', '-ar', str(rate), '-f', 'f32le', 'pipe:1']
    samples = np.frombuffer(subprocess.run(command, capture_output=True, check=True).stdout, dtype='<f4')
    size = round(rate * hop)
    frames = len(samples) // size
    if frames < round(duration / hop) - 1:
        raise ValueError('la música es más corta que la duración solicitada')
    energy = np.sqrt(np.mean(samples[:frames * size].reshape(frames, size) ** 2, axis=1))
    attacks = np.maximum(0, np.diff(energy, prepend=energy[0]))
    scale = float(np.max(attacks))
    return attacks / scale if scale else attacks


def align(attack, count: int, duration: float, hop: float = 0.1):
    ticks = round(duration / hop)
    minimum, maximum = round(1.4 / hop), round(2.4 / hop)
    if not count * minimum <= ticks <= count * maximum:
        raise ValueError('la duración no permite segmentos de 1,4 a 2,4 segundos')
    score = np.full((count + 1, ticks + 1), -np.inf)
    previous = np.full((count + 1, ticks + 1), -1, dtype=int)
    score[0, 0] = 0
    for segment in range(1, count + 1):
        for end in range(segment * minimum, min(segment * maximum, ticks) + 1):
            if segment < count and (end >= len(attack) or attack[end] <= 0 or
                                    attack[end] < attack[end - 1] or
                                    (end + 1 < len(attack) and attack[end] < attack[end + 1])):
                continue
            if not (count - segment) * minimum <= ticks - end <= (count - segment) * maximum:
                continue
            best = max(range(max(0, end - maximum), end - minimum + 1), key=lambda start: score[segment - 1, start], default=-1)
            if best < 0 or not np.isfinite(score[segment - 1, best]):
                continue
            score[segment, end] = score[segment - 1, best] + (float(attack[min(end, len(attack) - 1)]) if segment < count else 0)
            previous[segment, end] = best
    if previous[count, ticks] < 0:
        raise ValueError('no se encontró una secuencia de pulsos válida')
    boundaries = [ticks]
    for segment in range(count, 0, -1):
        boundaries.append(int(previous[segment, boundaries[-1]]))
    return [round(value * hop, 3) for value in reversed(boundaries)]


def run(target: Path, read_json, write_json, validate):
    script = read_json(work_script_path(target))
    validate('guion', script)
    duration = float(script['duration_seconds'])
    audio = workspace_audio(target)
    boundaries = align(onsets(audio, duration), len(script['segments']), duration)
    segments = []
    for index, item in enumerate(script['segments']):
        start, end = boundaries[index:index + 2]
        lines = item['lines']
        step = (end - start) / len(lines)
        words = [{'word': line, 'start': round(start + step * n, 3),
                  'end': round(start + step * (n + 1), 3)} for n, line in enumerate(lines)]
        segments.append({'id': item.get('n', index + 1), 'start': start, 'end': end,
                         'text': ' '.join(lines), 'lines': lines, 'words': words})
    result = {'metadata': {'kind': 'guion', 'audio_duration_sec': duration}, 'segments': segments}
    validate('guion', result)
    write_json(target / 'assets/timeline.json', result)
    write_json(target / 'assets/lyrics.json', result)
    return result

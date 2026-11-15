#!/usr/bin/env python3
"""Deterministic, offline 48 kHz sound effects. Example: sfx_synth.py OUTDIR."""
import argparse
import json
from pathlib import Path
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
SEED = 20261114
DURATIONS = {'impacto_grave': 1.8, 'subida': 3.0, 'tic_mecanico': .22,
             'teletipo': 2.4, 'latido': 1.35, 'whoosh': 1.5,
             'papel': 2.0, 'maquinas': 6.0, 'golpe_cifra': .7, 'quiebre_bolsa': 2.6}

def generate(kind, variant):
    if kind not in DURATIONS or variant not in (1, 2):
        raise ValueError('Unknown effect or variant')
    rng = np.random.default_rng(SEED + list(DURATIONS).index(kind) * 10 + variant)
    n = round(DURATIONS[kind] * SR)
    t = np.arange(n) / SR
    noise = rng.standard_normal(n)
    def band(x, lo, hi):
        return signal.sosfilt(signal.butter(3, [lo, hi], btype='bandpass', fs=SR, output='sos'), x)
    def pulse(at, length, freq, decay):
        u = np.maximum(t-at, 0)
        return (t >= at) * (t < at+length) * np.sin(2*np.pi*freq*u) * np.exp(-decay*u)
    v = variant - 1
    if kind == 'impacto_grave':
        x = np.sin(2*np.pi*(48+12*v)*t + 25*(1-np.exp(-7*t))) * np.exp(-3.2*t) + .35*band(noise, 90, 2500)*np.exp(-17*t)
    elif kind == 'subida':
        x = (signal.chirp(t, 90+20*v, t[-1], 1800+300*v, method='logarithmic')*.32 + band(noise, 350, 6500)*.45) * (t/t[-1])**1.7
    elif kind == 'tic_mecanico':
        x = band(noise, 900+300*v, 8000)*np.exp(-48*t) + pulse(.014, .08, 1800+300*v, 48)*.4
    elif kind == 'teletipo':
        x = np.zeros(n)
        for at in np.arange(.08, 2.2, .105+v*.013):
            at += rng.uniform(-.025, .025)
            x += pulse(at, .09, rng.uniform(850, 2200), rng.uniform(35, 55)) * rng.uniform(.3, 1)
        x += band(noise, 1000, 8000)*np.minimum(1, np.abs(x)*2)*.4
    elif kind == 'latido':
        x = pulse(.12, .38, 62+v*8, 15) + .7*pulse(.39, .38, 50+v*7, 13)
        x += band(noise, 40, 260)*np.exp(-((t-.16)/.08)**2)*.3
    elif kind == 'whoosh':
        carrier = band(noise, 250+v*100, 7000)
        x = carrier * np.exp(-((t-(.68+v*.12))/.35)**2) + .12*signal.chirp(t, 350, t[-1], 90)*np.exp(-((t-.7)/.35)**2)
    elif kind == 'papel':
        x = band(noise, 1000, 11000)*np.exp(-2*t)*(0.25+0.75*np.abs(np.sin(2*np.pi*(7+v*2)*t)))
        x += band(noise, 300, 4000)*np.exp(-((t-1.25-v*.15)/.09)**2)*.5
    elif kind == 'maquinas':
        x = sum(np.sin(2*np.pi*(50+v*10)*k*t)/(k*k) for k in range(1, 7))
        x = x*(.7+.15*np.sin(2*np.pi*.37*t)) + .08*band(noise, 60, 1200)
    elif kind == 'golpe_cifra':
        x = pulse(0, .6, 130+30*v, 10) + .6*band(noise, 1000, 7000)*np.exp(-22*t)
    else:
        x = signal.chirp(t, 1900-200*v, t[-1], 110, method='logarithmic')*.45*np.exp(-1.3*t)
        x += band(noise, 400, 9000)*np.exp(-3*t)*(1+.5*np.sin(2*np.pi*19*t))
        x += pulse(.2, 1, 70, 5)*.7
    # Short endpoint ramps prevent clicks; peak normalization leaves 1 dB headroom.
    ramp = min(int(.012*SR), n//2)
    x[:ramp] *= np.linspace(0, 1, ramp)
    x[-ramp:] *= np.linspace(1, 0, ramp)
    x = x / np.max(np.abs(x)) * 10**(-1/20)
    return np.asarray(x, dtype=np.float32)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)
    for kind in DURATIONS:
        for variant in (1, 2):
            wavfile.write(args.output / f'{kind}-{variant}.wav', SR, generate(kind, variant))
    (args.output / 'parametros.json').write_text(json.dumps({'sample_rate': SR, 'seed': SEED, 'peak_dbfs': -1, 'durations': DURATIONS, 'variants': [1, 2]}, indent=2, ensure_ascii=False)+'\n')

if __name__ == '__main__':
    main()

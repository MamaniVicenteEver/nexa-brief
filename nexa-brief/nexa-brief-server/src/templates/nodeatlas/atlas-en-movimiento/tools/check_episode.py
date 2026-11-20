#!/usr/bin/env python3
"""Comprobar que un episodio Atlas consume el motor principal sin duplicarlo."""
from pathlib import Path
import argparse
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[5]))
from src.core.explainer.episode_runtime import validate_atlas_episode_runtime, validate_atlas_episode_entry

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('episode', type=Path)
parser.add_argument('--active-only', action='store_true', help='Auditar solo la entrada activa de episodios históricos cuya limpieza está aplazada.')
args = parser.parse_args()
try:
    check = validate_atlas_episode_entry if args.active_only else validate_atlas_episode_runtime
    check(args.episode.resolve())
except ValueError as error:
    raise SystemExit(str(error))
print('OK: entrada activa con una sola referencia al motor Atlas principal' if args.active_only else 'OK: episodio de datos sin motor privado')

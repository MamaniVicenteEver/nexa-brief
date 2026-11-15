#!/usr/bin/env python3
"""Plan or apply a conservative migration of one selected v3 profile."""
from __future__ import annotations
import argparse
import contextlib
import asyncio
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[5]
sys.path.insert(0, str(ROOT))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--profile', required=True, type=Path)
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument('--dry-run', action='store_true')
    mode.add_argument('--apply', action='store_true')
    parser.add_argument('--retire-verified', action='store_true',
                        help='Retire verified legacy files after migration, with a resumable journal')
    args = parser.parse_args()
    if not args.profile.is_absolute() or not (args.profile / 'profile.json').is_file():
        parser.error('--profile must be an absolute existing profile directory')
    os.environ['NEXA_PROFILE_DIR'] = str(args.profile.resolve())
    # This offline operation requires no secrets or .env files. Select the
    # profile from the explicit argument before initializing the settings singleton.
    from pydantic_settings import DotEnvSettingsSource
    original = DotEnvSettingsSource._read_env_files
    DotEnvSettingsSource._read_env_files = lambda self: {}
    try:
        from src.config.settings import settings  # noqa: F401
    finally:
        DotEnvSettingsSource._read_env_files = original
    from src.core.nodemotion.shared.migration import migrate
    # Keep JSON stdout machine-readable even when library registration logs.
    with contextlib.redirect_stdout(sys.stderr):
        result = asyncio.run(migrate(args.profile, apply=args.apply, retire_verified=args.retire_verified))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if any(item['status'] == 'needs-review' for item in result['projects']) else 0


if __name__ == '__main__':
    raise SystemExit(main())

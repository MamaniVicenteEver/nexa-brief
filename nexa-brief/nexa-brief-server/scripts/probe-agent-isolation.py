#!/usr/bin/env python3
"""Read-only capability probe with synthetic data, never an agent launcher.

Returns non-zero unless the filesystem *and* network isolation tests succeed.
The test intentionally starts no host services and reads no profile data.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path


def main() -> int:
    bwrap = shutil.which('bwrap')
    python = Path('/usr/bin/python3.10')
    if not bwrap or not python.is_file():
        print(json.dumps({'filesystem_isolated': False, 'network_isolated': False, 'reason': 'probe_dependencies_unavailable'}))
        return 1
    with tempfile.TemporaryDirectory(prefix='nexa-sandbox-probe-') as temp:
        root = Path(temp)
        work = root / 'workspace'
        work.mkdir()
        data = root / 'data' / 'private.txt'
        data.parent.mkdir()
        data.write_bytes(b'synthetic-private')
        credentials = root / 'credentials.txt'
        credentials.write_bytes(b'synthetic-credential')
        (work / 'escape').symlink_to(data)
        probe = r'''
import json, os, pathlib
checks = {}
for label, name in [('data', os.environ['TEST_DATA']), ('credentials', os.environ['TEST_CREDENTIALS']), ('symlink', '/workspace/escape')]:
    try:
        pathlib.Path(name).read_bytes()
    except (FileNotFoundError, PermissionError):
        checks[label] = True
    else:
        checks[label] = False
pathlib.Path('/workspace/allowed.txt').write_text('ok')
checks['workspace'] = pathlib.Path('/workspace/allowed.txt').read_text() == 'ok'
checks['env'] = 'SYNTHETIC_API_KEY' not in os.environ
checks['home'] = not os.path.exists('/home/university')
checks['sockets'] = not os.path.exists('/run/docker.sock') and not os.path.exists('/var/run/docker.sock')
print(json.dumps(checks))
'''
        common = [bwrap, '--unshare-user', '--unshare-pid', '--unshare-ipc', '--unshare-uts',
                  '--die-with-parent', '--new-session', '--clearenv',
                  '--setenv', 'PATH', '/usr/bin:/bin', '--setenv', 'HOME', '/home/agent',
                  '--setenv', 'TEST_DATA', str(data), '--setenv', 'TEST_CREDENTIALS', str(credentials),
                  '--ro-bind', '/usr', '/usr', '--ro-bind', '/lib', '/lib', '--ro-bind', '/lib64', '/lib64',
                  '--proc', '/proc', '--dev', '/dev', '--tmpfs', '/tmp', '--dir', '/home', '--dir', '/home/agent',
                  '--bind', str(work), '/workspace', '--chdir', '/workspace']
        env = {**os.environ, 'SYNTHETIC_API_KEY': 'synthetic'}
        try:
            result = subprocess.run([*common, '--', str(python), '-c', probe], env=env,
                                    capture_output=True, text=True, timeout=15, close_fds=True)
            checks = json.loads(result.stdout) if result.returncode == 0 else {}
            isolated = bool(checks) and all(checks.values())
            # A network namespace is essential but its creation alone does not
            # prove a deployment's broker policy; it is only a capability probe.
            network = subprocess.run([*common, '--unshare-net', '--', '/usr/bin/true'], env=env,
                                     capture_output=True, text=True, timeout=15, close_fds=True)
            net_available = network.returncode == 0
            print(json.dumps({'filesystem_isolated': isolated, 'filesystem_checks': checks,
                              'network_namespace_available': net_available,
                              'network_isolated_verified': False,
                              'ready_for_agents': False}))
        except (OSError, ValueError, subprocess.TimeoutExpired):
            print(json.dumps({'filesystem_isolated': False, 'network_namespace_available': False,
                              'network_isolated_verified': False, 'ready_for_agents': False}))
    # Namespace availability is not an end-to-end security certification.
    return 1


if __name__ == '__main__':
    sys.exit(main())

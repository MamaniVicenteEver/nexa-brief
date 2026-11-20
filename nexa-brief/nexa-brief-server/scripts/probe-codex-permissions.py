#!/usr/bin/env python3
"""Probe Codex command isolation with synthetic files; never calls a model.

Uses a fresh CODEX_HOME, a disposable workspace and a local stdio app-server.
It cannot certify that every native tool and integration is isolated.
"""
from __future__ import annotations

import argparse
import json
import os
import selectors
import shutil
import socket
import subprocess
import tempfile
import time
from pathlib import Path

PROFILE = '''default_permissions = "isolated"
web_search = "disabled"
[permissions.isolated.filesystem]
":root" = "deny"
":minimal" = "read"
":slash_tmp" = "deny"
":tmpdir" = "deny"
[permissions.isolated.filesystem.":workspace_roots"]
"." = "write"
[permissions.isolated.network]
enabled = false
'''


def appserver_probe(binary: str, root: Path, env: dict[str, str], secret: Path) -> str:
    process = subprocess.Popen([binary, 'app-server', '--listen', 'stdio://'], cwd=root, env=env,
                               stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                               text=True, bufsize=1, close_fds=True)
    selector = selectors.DefaultSelector()
    selector.register(process.stdout, selectors.EVENT_READ)
    pending = b''

    def call(number: int, method: str, params: dict) -> dict:
        nonlocal pending
        process.stdin.write(json.dumps({'jsonrpc': '2.0', 'id': number, 'method': method, 'params': params}) + '\n')
        process.stdin.flush()
        deadline = time.monotonic() + 8
        while time.monotonic() < deadline:
            if b'\n' not in pending:
                if not selector.select(max(0, deadline - time.monotonic())):
                    return {}
                received = os.read(process.stdout.fileno(), 65536)
                if not received:
                    return {}
                pending += received
            while b'\n' in pending:
                line, pending = pending.split(b'\n', 1)
                message = json.loads(line)
                if message.get('id') == number:
                    return message
        return {}

    try:
        init = call(1, 'initialize', {'clientInfo': {'name': 'synthetic-probe', 'version': '1'},
                                      'capabilities': {'experimentalApi': True}})
        if 'result' not in init:
            return 'unavailable'
        process.stdin.write(json.dumps({'jsonrpc': '2.0', 'method': 'initialized'}) + '\n')
        process.stdin.flush()
        response = call(2, 'fs/readFile', {'path': str(secret)})
        return 'host_read_allowed' if 'result' in response else 'denied_or_unavailable'
    finally:
        selector.close()
        process.terminate()
        try:
            process.wait(timeout=3)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--codex', default=shutil.which('codex') or '/usr/lib/chatgpt/resources/codex')
    parser.add_argument('--scratch-dir', default='.', help='Writable parent for a deleted temporary fixture')
    args = parser.parse_args()
    result = {'filesystem': 'not_verified', 'network': 'not_verified', 'ready_for_agents': False}
    try:
        with tempfile.TemporaryDirectory(prefix='.nexa-permission-probe-', dir=Path(args.scratch_dir).resolve()) as temp:
            root = Path(temp)
            home, runtime, work, private = (root / name for name in ('home', 'runtime', 'work', 'private'))
            for path in (home, runtime, work, private):
                path.mkdir(mode=0o700)
            secret = private / 'synthetic.txt'
            secret.write_bytes(b'fixture-data')
            session = home / 'synthetic-session.txt'
            session.write_bytes(b'fixture-session')
            (work / 'escape').symlink_to(secret)
            # The CLI creates its linux sandbox helper here. Do not grant read
            # to all of CODEX_HOME: a session may live next to this directory.
            helpers = home / 'tmp/arg0'
            helpers.mkdir(parents=True, mode=0o700)
            (helpers / 'escape').symlink_to(session)
            policy = PROFILE.replace('":minimal" = "read"',
                                     '":minimal" = "read"\n' + json.dumps(str(helpers)) + ' = "read"')
            (home / 'config.toml').write_text(policy, encoding='utf-8')
            env = {'PATH': '/usr/bin:/bin', 'HOME': str(home), 'CODEX_HOME': str(home),
                   'XDG_CONFIG_HOME': str(home / 'config'), 'XDG_CACHE_HOME': str(home / 'cache'),
                   'XDG_RUNTIME_DIR': str(runtime), 'TMPDIR': str(runtime), 'LANG': 'C.UTF-8',
                   'TEST_PRIVATE': str(secret), 'TEST_SESSION': str(session),
                   'SYNTHETIC_SECRET': 'fixture', 'TEST_HELPER_ESCAPE': str(helpers / 'escape')}
            # This local listener is a controlled fixture, never an external request.
            listener = None
            try:
                listener = socket.socket()
                listener.bind(('127.0.0.1', 0))
                listener.listen()
                port = listener.getsockname()[1]
                control = socket.socket()
                control.settimeout(1)
                try:
                    env['HOST_CONTROL'] = str(control.connect_ex(('127.0.0.1', port)) == 0)
                finally:
                    control.close()
                env['TEST_PORT'] = str(port)
            except OSError:
                if listener is not None:
                    listener.close()
                listener = None
            child = r'''import json,os,pathlib,socket
r={}
for label,name in [('private',os.environ['TEST_PRIVATE']),('session',os.environ['TEST_SESSION']),('symlink','escape'),('helper_symlink',os.environ['TEST_HELPER_ESCAPE'])]:
 try: pathlib.Path(name).read_bytes(); r[label+'_denied']=False
 except (FileNotFoundError,PermissionError): r[label+'_denied']=True
try: pathlib.Path('allowed.txt').write_text('ok');r['workspace_write']=True
except OSError: r['workspace_write']=False
r['test_environment_inherited']='SYNTHETIC_SECRET' in os.environ
r['host_control'] = os.environ.get('HOST_CONTROL') == 'True'
r['localhost_denied'] = None
if r['host_control']:
 try:
  sock=socket.socket(); sock.settimeout(1)
  r['localhost_denied']=sock.connect_ex(('127.0.0.1', int(os.environ['TEST_PORT']))) != 0
  sock.close()
 except PermissionError:
  r['localhost_denied']=True
print(json.dumps(r))'''
            command = [args.codex, 'sandbox', '-P', 'isolated', '-C', str(work), '--', '/usr/bin/python3.10', '-c', child]
            current_umask = os.umask(0o077)
            try:
                sandbox = subprocess.run(command, env=env, text=True, capture_output=True, timeout=15, close_fds=True)
                if sandbox.returncode == 0:
                    result['filesystem_checks'] = json.loads(sandbox.stdout)
                    keys = ('private_denied', 'session_denied', 'symlink_denied', 'helper_symlink_denied', 'workspace_write')
                    result['filesystem'] = 'passed' if all(result['filesystem_checks'].get(k) for k in keys) else 'failed'
                    if result['filesystem_checks'].get('host_control'):
                        result['network'] = ('localhost_denied' if result['filesystem_checks'].get('localhost_denied')
                                             else 'localhost_reachable')
                else:
                    result['sandbox_error'] = 'sandbox initialization or execution failed'
                result['appserver_stdio_rpc'] = appserver_probe(args.codex, root, env, secret)
            finally:
                if listener is not None:
                    listener.close()
                os.umask(current_umask)
    except (OSError, ValueError, subprocess.TimeoutExpired):
        result['error'] = 'probe setup or execution failed'
    print(json.dumps(result, sort_keys=True))
    # Filesystem and a host RPC probe alone do not certify the agent boundary.
    return 1


if __name__ == '__main__':
    raise SystemExit(main())

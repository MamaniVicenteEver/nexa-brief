#!/usr/bin/env python3
"""Cliente del chat de promos; toda la producción pasa por la API local."""
from __future__ import annotations
import argparse
import json
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

BASE = 'http://localhost:8000/api/v1/promos'


def call(method, path, payload=None):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode('utf-8')
    request = Request(BASE + path, data=data, method=method, headers={'Content-Type': 'application/json'})
    try:
        with urlopen(request, timeout=30) as response:
            return json.loads(response.read())
    except HTTPError as exc:
        raise RuntimeError(f'API respondió HTTP {exc.code}: {exc.read(2048).decode("utf-8", errors="replace")}') from exc
    except URLError as exc:
        raise RuntimeError(f'API local no disponible: {exc.reason}') from exc


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest='command', required=True)
    create = sub.add_parser('create')
    create.add_argument('--template', required=True)
    create.add_argument('--message', required=True)
    create.add_argument('--provider', choices=('auto', 'codex', 'claude'), default='auto')
    for name in ('status', 'message', 'approve', 'usage', 'retry'):
        command = sub.add_parser(name)
        command.add_argument('--id', required=True)
        if name == 'message': command.add_argument('--message', required=True)
        if name == 'approve': command.add_argument('--revision', required=True, type=int)
    args = parser.parse_args(argv)
    try:
        if args.command == 'create':
            provider = call('GET', '/agents')['default_provider'] if args.provider == 'auto' else args.provider
            result = call('POST', '/sessions', {'template_id': args.template, 'message': args.message, 'provider': provider})
        else:
            path = '/sessions/' + quote(args.id, safe='')
            if args.command == 'message':
                result = call('POST', path + '/messages', {'message': args.message})
            elif args.command == 'retry':
                result = call('POST', path + '/retry', {})
            elif args.command == 'approve':
                result = call('POST', path + '/approve', {'revision': args.revision})
            else:
                result = call('GET', path)
                if args.command == 'usage': result = result['usage']
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (RuntimeError, KeyError, ValueError) as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())

"""Register geographic commands in the Atlas CLI."""
import json
from pathlib import Path

from src.adapters.maps.geodata import AmbiguousRegion, GeoData


def _run(args):
    geo = GeoData()
    try:
        if args.geo_command == 'build':
            result = geo.build(country=args.country, level=args.level)
        elif args.geo_command == 'resolve':
            try:
                query = json.loads(args.query)
            except json.JSONDecodeError:
                query = args.query
            result = geo.resolve(query)
        elif args.geo_command == 'scene':
            result = str(geo.resolve_scene(Path(args.scene)))
        else:
            result = geo.list_regions(args.level, args.country)
    except (ValueError, LookupError, FileNotFoundError) as exc:
        if isinstance(exc, AmbiguousRegion):
            print(json.dumps({'error': str(exc), 'candidates': exc.candidates}, ensure_ascii=False))
        else:
            print(str(exc))
        return 1
    print(json.dumps(result, ensure_ascii=False))
    return 0


def register(subparsers):
    geo = subparsers.add_parser('geo', help='Build and resolve administrative geometries')
    commands = geo.add_subparsers(dest='geo_command', required=True)
    build = commands.add_parser('build')
    build.add_argument('--country')
    build.add_argument('--level', type=int)
    resolve = commands.add_parser('resolve')
    resolve.add_argument('query')
    scene = commands.add_parser('scene')
    scene.add_argument('scene')
    listing = commands.add_parser('list')
    listing.add_argument('--level', type=int, required=True)
    listing.add_argument('--country')
    geo.set_defaults(func=_run)


if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    register(parser.add_subparsers(required=True))
    arguments = parser.parse_args()
    raise SystemExit(arguments.func(arguments))

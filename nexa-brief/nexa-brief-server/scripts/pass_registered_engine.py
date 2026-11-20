"""Review or correct a registered principal demo's shared engine; never generate media."""
import argparse
import asyncio
import json

from src.adapters.showcase.engine_production import RegisteredEngineProduction
from src.adapters.showcase.filesystem import FilesystemShowcaseAdapter
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings


async def main(args):
    workflow = RegisteredEngineProduction(FilesystemShowcaseAdapter.from_settings(), layout_for_settings(settings))
    if args.recover:
        await workflow.recover()
        print(json.dumps({'state': 'recovered'}))
    else:
        print(json.dumps(await workflow.pass_to_production(args.design, apply=args.apply)))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--design', required=True)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--recover', action='store_true')
    asyncio.run(main(parser.parse_args()))

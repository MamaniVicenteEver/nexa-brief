"""Usage: python -m scripts.migrate_resource_provenance [--apply]. Default: dry run."""
import argparse
import asyncio
import json
from src.core.library.provenance_migration import migrate_provenance

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    print(json.dumps({"apply": args.apply, **asyncio.run(migrate_provenance(args.apply))}))

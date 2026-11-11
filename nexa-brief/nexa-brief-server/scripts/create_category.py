#!/usr/bin/env python3
"""Create one explainer category and its profile folder scaffold.

Example (from nexa-brief-server after selecting the desired storage profile):
    .venv/bin/python scripts/create_category.py --name "NodeExplainer" \
        --topic "Clear explainers about current events" --language en

The API uses the same service, so this script is a standalone entry point rather
than a second implementation of category setup.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

SERVER_ROOT = Path(__file__).resolve().parents[1]
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from src.core.category_creation import (
    CategoryCreationError,
    CategoryProvisioningError,
    create_category,
)


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an explainer category and its folders.")
    parser.add_argument("--name", required=True, help="Visible category name, e.g. NodeExplainer")
    parser.add_argument("--topic", default="", help="What this category explains")
    parser.add_argument("--language", choices=("en", "es-419"), default="es-419")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Show the result without changing files",
    )
    args = parser.parse_args()

    try:
        result = create_category(
            args.name,
            topic=args.topic,
            language=args.language,
            dry_run=args.dry_run,
        )
    except (CategoryCreationError, CategoryProvisioningError) as exc:
        parser.exit(2, f"Error: {exc}\n")

    action = "Would create" if result.dry_run else "Created"
    print(f"{action} {result.category.display_name} (id: {result.category_id})")
    for path in result.created_paths:
        print(f"  {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

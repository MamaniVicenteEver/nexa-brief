"""Operator entry point; production is owned by the same private API as the web."""
from .cli import main


if __name__ == "__main__":
    raise SystemExit(main())

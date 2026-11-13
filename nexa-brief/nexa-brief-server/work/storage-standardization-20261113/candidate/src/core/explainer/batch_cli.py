"""Chat/terminal entry point. Uses the same producer and datastore as the API."""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
from pathlib import Path

from src.core.explainer.batches import PreparationItem, batch_status, delete_batch, resume_batch, submit_batch, validate_batch, worker_loop
from src.core.explainer.producer import ExplainerProducer
from src.core.explainer.runtime import MAX_PRODUCERS, configure_parallel, parallel_limit
from src.core.data import collection


def emit(value):
    print(json.dumps(value, ensure_ascii=False, indent=2, default=str), flush=True)


async def execute(args):
    if args.command == "configure":
        await configure_parallel(args.parallel)
        emit({"parallel": parallel_limit(), "maximum": MAX_PRODUCERS})
    elif args.command == "submit":
        payload = json.loads(Path(args.file).read_text(encoding="utf-8"))
        entries = payload if isinstance(payload, list) else payload["items"]
        producer = ExplainerProducer()
        batch = await submit_batch(producer, [PreparationItem.model_validate(x) for x in entries],
            parallel=args.parallel, at=args.at, zone=args.timezone, label=args.label, request_id=args.request_id)
        emit(batch)
        # CLI submission persists only: API/worker owns execution, even after this CLI exits.
        await producer.shutdown()
    elif args.command == "status":
        emit(batch_status(args.batch_id) if args.batch_id else
             {"parallel": parallel_limit(), "batches": [batch_status(r["batch_id"]) for r in collection("explainer_batches").list()]})
    elif args.command == "validate":
        emit(await validate_batch(ExplainerProducer(), args.batch_id))
    elif args.command == "resume":
        emit(await resume_batch(args.batch_id))
    elif args.command == "delete":
        emit(await delete_batch(args.batch_id, delete_files=args.files))
    elif args.command == "worker":
        producer = ExplainerProducer()
        try:
            await worker_loop(producer, primary=True)
        finally:
            await producer.shutdown()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    configure = sub.add_parser("configure")
    configure.add_argument("--parallel", type=int, required=True, choices=range(1, MAX_PRODUCERS + 1))
    submit = sub.add_parser("submit")
    submit.add_argument("--file", required=True)
    submit.add_argument("--parallel", type=int, default=1, choices=range(1, MAX_PRODUCERS + 1))
    submit.add_argument("--at", help="ISO date/time; naive values use --timezone")
    submit.add_argument("--timezone", default="America/La_Paz")
    submit.add_argument("--label", default="Preparación desde chat")
    submit.add_argument("--request-id", required=True, help="Stable idempotency key for this chat request")
    status = sub.add_parser("status")
    status.add_argument("batch_id", nargs="?")
    validate = sub.add_parser("validate")
    validate.add_argument("batch_id")
    resume = sub.add_parser("resume")
    resume.add_argument("batch_id")
    delete = sub.add_parser("delete")
    delete.add_argument("batch_id")
    delete.add_argument("--files", action="store_true", help="Also remove this batch's owned preparation folders")
    sub.add_parser("worker")
    args = parser.parse_args()
    from src.config.logging_config import setup_logging
    import logging
    setup_logging()
    for handler in logging.getLogger().handlers:
        handler.setStream(sys.stderr)
    try:
        asyncio.run(execute(args))
    except (ValueError, KeyError) as exc:
        print(str(exc), file=sys.stderr)
        raise SystemExit(2) from exc


if __name__ == "__main__":
    main()

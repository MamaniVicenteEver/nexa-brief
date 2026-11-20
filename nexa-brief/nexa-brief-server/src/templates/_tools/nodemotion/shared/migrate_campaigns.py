#!/usr/bin/env python3
"""Plan or apply exact legacy campaign reference migration in an isolated process."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import sys

SERVER = Path(__file__).resolve().parents[5]
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--profile", type=Path, required=True)
    parser.add_argument("--plan", type=Path)
    parser.add_argument("--expected-plan-sha256")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--retire-verified", action="store_true")
    parser.add_argument("--only", action="append", default=[], help="Exact campaign directory name")
    args = parser.parse_args(argv)
    if args.retire_verified and not args.apply:
        parser.error("--retire-verified requires --apply")
    if args.apply and (not args.plan or not args.expected_plan_sha256):
        parser.error("--apply requires the reviewed --plan and --expected-plan-sha256")
    if not args.profile.is_absolute() or not (args.profile / "profile.json").is_file():
        parser.error("--profile must be an absolute existing profile directory")
    profile = args.profile.resolve(strict=True)
    if json.loads((profile / "profile.json").read_bytes()).get("schema_version") != 3:
        parser.error("Campaign migration requires an explicitly selected v3 profile")
    if args.output and (args.output.resolve().is_relative_to(profile) or args.output.is_symlink()):
        parser.error("Write reports outside the selected profile, without symlinks")
    os.environ["NEXA_PROFILE_DIR"] = str(profile)
    # This offline operation needs only the explicitly selected profile.
    # Initialize settings without reading any dotenv files or secrets.
    from pydantic_settings import DotEnvSettingsSource
    original = DotEnvSettingsSource._read_env_files
    DotEnvSettingsSource._read_env_files = lambda self: {}
    try:
        from src.config.settings import settings
    finally:
        DotEnvSettingsSource._read_env_files = original
    settings.storage_profile_dir = profile
    settings.storage_layout_version = 3
    settings.data_dir = profile / "data"
    from src.core.nodemotion.promo.campaign_migration import apply_campaign_plan, plan_campaigns
    if args.plan:
        content = args.plan.read_bytes()
        if args.expected_plan_sha256 and hashlib.sha256(content).hexdigest() != args.expected_plan_sha256:
            parser.error("Reviewed campaign plan file changed")
        report = json.loads(content)
        if (report.get("kind") != "nodemotion-campaign-plan" or report.get("schema_version") != 1
                or report.get("profile") != str(profile)):
            parser.error("Plan belongs to another profile or migration contract")
    else:
        report = plan_campaigns(profile)
    failures = 0
    if args.apply:
        selected = set(args.only)
        known = {Path(row["root"]).name for row in report["projects"]}
        if selected - known:
            parser.error("Unknown campaign in --only")
        results = []
        for row in report["projects"]:
            if selected and Path(row["root"]).name not in selected:
                continue
            if row.get("status") != "planned":
                results.append({"root": row["root"], "state": row.get("status")})
                continue
            try:
                result = apply_campaign_plan(profile, row, retire_verified=args.retire_verified)
            except (OSError, ValueError, KeyError, TypeError) as exc:
                result = {"root": row["root"], "state": "needs-review", "reason": str(exc)}
                failures += 1
            print(json.dumps({"event": "campaign-result", **result}, ensure_ascii=False), file=sys.stderr, flush=True)
            results.append(result)
        report = {"kind": "nodemotion-campaign-result", "profile": str(profile), "projects": results,
                  "counts": {state: sum(row["state"] == state for row in results)
                             for state in ("published", "complete", "needs-review")}}
    encoded = json.dumps(report, ensure_ascii=False, indent=2)
    if args.output:
        args.output.write_text(encoded + "\n")
    else:
        print(encoded)
    return 2 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())

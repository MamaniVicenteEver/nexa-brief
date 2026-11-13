"""Kit subprocess lifecycle. No provider is called until a real job runs."""
import asyncio
import os
import signal
import sys

from src.config.settings import settings
from src.core.explainer.catalog import KIT_DIR


class EditionTools:
    def readiness(self, edition):
        from .readiness import tool_issues
        return tool_issues(edition)

    async def run(self, command, production, stage, edition):
        env = {**os.environ, "NEXA_PROFILE_DIR": str(settings.storage_profile_dir),
               "NEXA_PRODUCTION_DIR": str(production), "NEXA_EDITION_STAGING_DIR": str(stage)}
        # This host broker has explicit commands; it never launches an agent CLI.
        log = stage / f"{command}.log"
        with log.open("ab") as stream:
            process = await asyncio.create_subprocess_exec(
                sys.executable, str(KIT_DIR / "tools/edition_job.py"), command,
                "--edition", str(stage / "edition.json"), cwd=str(KIT_DIR.parents[2]),
                stdout=stream, stderr=stream, env=env, start_new_session=True)
            try:
                await asyncio.wait_for(process.wait(), timeout=3600)
            except (asyncio.CancelledError, asyncio.TimeoutError):
                try:
                    os.killpg(process.pid, signal.SIGTERM)
                except ProcessLookupError:
                    pass
                try:
                    await asyncio.wait_for(process.wait(), 5)
                except asyncio.TimeoutError:
                    try:
                        os.killpg(process.pid, signal.SIGKILL)
                    except ProcessLookupError:
                        pass
                    await process.wait()
                raise
        if process.returncode:
            tail = log.read_text(encoding="utf-8", errors="replace")[-1600:]
            raise RuntimeError(f"La herramienta {command} terminó con código {process.returncode}: {tail}")

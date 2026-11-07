"""Supervisor for long kit commands, with the lock inherited by their subprocesses."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import traceback

import job

TOOLS = Path(__file__).resolve().parent


def worker(video, fd, name, args):
    work = video / "work"
    state = dict(state="running", phase=name, pid=os.getpid(),
                 started_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
    ok = False
    try:
        job.write_status(work, name, **state)
        env = dict(os.environ, NEXA_KIT_JOB_FD=str(fd))
        result = subprocess.run([sys.executable, str(TOOLS / "kit.py"), *args], env=env, pass_fds=(fd,))
        if result.returncode:
            raise RuntimeError(f"{name} terminó con código {result.returncode}")
        ok = True
    except BaseException as exc:
        traceback.print_exc()
        state["error"] = str(exc) or type(exc).__name__
    finally:
        state.update(state="completed" if ok else "failed", phase="done",
                     finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
        try:
            job.write_status(work, name, **state)
        finally:
            os.close(fd)
    return 0 if ok else 1


def launch(video, name, background, args):
    return job.launch(video, name, background, lambda v, fd: worker(v, fd, name, args),
                      TOOLS / "kit_job.py", (name, json.dumps(args)))


if __name__ == "__main__":
    sys.exit(worker(Path(sys.argv[1]), int(sys.argv[2]), sys.argv[3], json.loads(sys.argv[4])))

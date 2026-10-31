"""Detached, per-video transcription job. The flock is held for the entire job."""
import datetime
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback

import job
import outro
import usage

TOOLS = Path(__file__).resolve().parent


def write_status(work, **data):
    job.write_status(work, "transcribe", **data)


def read_status(work):
    return job.read_status(work, "transcribe")


def lock(work):
    return job.lock(work, "transcribe")


def worker(video, fd):
    work = video / "work"
    start = time.monotonic()
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    state = dict(state="running", phase="whisper", pid=os.getpid(), started_at=started)
    ok = False
    try:
        write_status(work, **state)
        result = subprocess.run([sys.executable, str(TOOLS / "transcribe.py"), str(video / "assets/song.mp3"),
                                 str(video / "assets/script.json"), str(video / "assets/lyrics.json")], pass_fds=(fd,))
        if result.returncode:
            raise RuntimeError(f"Whisper terminó con código {result.returncode}")
        state["phase"] = "outro"
        write_status(work, **state)
        outro.apply(video)
        ok = True
    except BaseException as exc:
        traceback.print_exc()
        state["error"] = str(exc) or type(exc).__name__
    finally:
        state.update(state="completed" if ok else "failed", phase="done", finished_at=datetime.datetime.now(datetime.timezone.utc).isoformat())
        try:
            write_status(work, **state)
            usage.record(video, provider="whisper", model="large-v3", role="transcribe", ok=ok, seconds=time.monotonic() - start)
        finally:
            os.close(fd)
    return 0 if ok else 1


def launch(video, background):
    return job.launch(video, "transcribe", background, worker, TOOLS / "transcribe_job.py")


def wait(video, timeout):
    return job.wait(video, "transcribe", timeout)


if __name__ == "__main__":
    sys.exit(worker(Path(sys.argv[1]), int(sys.argv[2])))

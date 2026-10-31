"""Shared detached per-video job state, locking and bounded polling."""
import fcntl
import json
import os
import subprocess
import sys
import time


def write_status(work, name, **data):
    path = work / f"{name}.status.json"
    tmp = work / f".{name}.status.{os.getpid()}.tmp"
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n")
    os.replace(tmp, path)


def read_status(work, name):
    try:
        return json.loads((work / f"{name}.status.json").read_text())
    except (OSError, ValueError):
        return {}


def lock(work, name):
    work.mkdir(parents=True, exist_ok=True)
    fd = os.open(work / f"{name}.lock", os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(fd)
        return None
    return fd


def launch(video, name, background, worker, worker_script, extra=()):
    work = video / "work"
    fd = lock(work, name)
    if fd is None:
        print(f"Ya hay una tarea {name} en curso: {read_status(work, name)}")
        return 0 if background else 1
    if not background:
        return worker(video, fd)
    try:
        write_status(work, name, state="starting", phase="starting", pid=None)
        with (work / f"{name}.log").open("ab", buffering=0) as log:
            proc = subprocess.Popen([sys.executable, str(worker_script), str(video), str(fd), *extra],
                                    stdin=subprocess.DEVNULL, stdout=log, stderr=log,
                                    start_new_session=True, pass_fds=(fd,))
        print(f"{name} iniciado (PID {proc.pid}); estado: {work / (name + '.status.json')}")
        return 0
    except Exception as exc:
        write_status(work, name, state="failed", phase="starting", error=str(exc))
        raise
    finally:
        os.close(fd)


def wait(video, name, timeout):
    work = video / "work"
    deadline = time.monotonic() + timeout
    while True:
        fd = lock(work, name)
        if fd is not None:
            try:
                state = read_status(work, name)
                if state.get("state") in ("starting", "running"):
                    state.update(state="failed", error="Proceso interrumpido sin finalizar; se puede volver a iniciar")
                    write_status(work, name, **state)
                print(json.dumps(state or {"state": "not_started"}, ensure_ascii=False))
                return 0 if state.get("state") == "completed" else 1
            finally:
                os.close(fd)
        if time.monotonic() >= deadline:
            print(json.dumps(read_status(work, name) or {"state": "starting"}, ensure_ascii=False))
            print(f"Sigue en curso; repetir --wait. Log: {work / (name + '.log')}")
            return 2
        time.sleep(min(1, max(0, deadline - time.monotonic())))

"""Adaptador de imágenes: Codex con sesión ChatGPT y posprocesado local."""

from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
import signal
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Protocol, Sequence

from PIL import Image, ImageOps

from src.adapters.image_gen.presets import get_preset
from src.adapters.image_gen.roles import edit_prompt, generate_prompt
from src.core.ports.image_generation_port import ImageGenerationResult

_API_ENV = {"OPENAI_API_KEY", "CODEX_API_KEY", "OPENAI_BASE_URL"}
_TOKEN_FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens")
_SIZE = re.compile(r"^(\d{2,5})x(\d{2,5})$")
_TASK = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$")


class Runner(Protocol):
    def run(self, cmd: list[str], prompt: str, cwd: Path, env: dict[str, str], timeout: float) -> tuple[int, str, float]: ...


class SubprocessRunner:
    def run(self, cmd: list[str], prompt: str, cwd: Path, env: dict[str, str], timeout: float) -> tuple[int, str, float]:
        """Mata el grupo completo si el agente supera el límite."""
        started = time.monotonic()
        proc = subprocess.Popen(cmd, cwd=cwd, env=env, stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                text=True, start_new_session=True)
        try:
            out, err = proc.communicate(prompt, timeout=timeout)
        except subprocess.TimeoutExpired as exc:
            os.killpg(proc.pid, signal.SIGTERM)
            try:
                proc.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                os.killpg(proc.pid, signal.SIGKILL)
                proc.communicate()
            raise TimeoutError(f"Codex excedió {timeout:g} s") from exc
        return proc.returncode, out + "\n" + err, time.monotonic() - started


def _usage(events: str) -> tuple[str, dict[str, int], str]:
    """Lee JSONL; suma turn.completed como en cli_runner.py."""
    thread_id = ""
    last = ""
    tokens = dict.fromkeys(_TOKEN_FIELDS, 0)
    for line in events.splitlines():
        try:
            event = json.loads(line)
        except ValueError:
            continue
        if event.get("type") == "thread.started":
            thread_id = str(event.get("thread_id") or "")
        elif event.get("type") == "turn.completed":
            usage = event.get("usage") or {}
            for key in _TOKEN_FIELDS:
                source = "reasoning_output_tokens" if key == "reasoning_tokens" else key
                tokens[key] += int(usage.get(source) or 0)
        elif event.get("type") == "item.completed":
            item = event.get("item") or {}
            if item.get("type") == "agent_message":
                last = str(item.get("text") or "")
    return thread_id, tokens, last


def _dimensions(size: str) -> tuple[int, int]:
    match = _SIZE.fullmatch(size)
    if not match:
        raise ValueError("Tamaño inválido; usa ANCHOxALTO, por ejemplo 1920x1080")
    width, height = map(int, match.groups())
    if not 64 <= width <= 4096 or not 64 <= height <= 4096:
        raise ValueError("Cada dimensión debe estar entre 64 y 4096 píxeles")
    return width, height


class CodexCLIImageAdapter:
    def __init__(self, *, model: str = "luna-xhigh", output_root: Path | None = None,
                 work_root: Path | None = None, codex_home: Path | None = None,
                 binary: str = "/home/alfred/.local/bin/codex", timeout: float = 240,
                 runner: Runner | None = None) -> None:
        self.preset_name = model
        self.preset = get_preset(model)
        self.output_root = Path(output_root or Path.cwd() / "output" / "image_gen").resolve()
        self.work_root = Path(work_root or self.output_root / ".work").resolve()
        self.codex_home = Path(codex_home or os.environ.get("CODEX_HOME") or Path.home() / ".codex").resolve()
        self.binary = binary
        self.timeout = timeout
        self.runner = runner or SubprocessRunner()

    def generate(self, task: str, prompt: str, size: str = "1024x1024",
                 refs: Sequence[Path] = ()) -> ImageGenerationResult:
        if not _TASK.fullmatch(task):
            raise ValueError("task debe ser un identificador corto sin rutas")
        dimensions = _dimensions(size)
        return self._native(task, generate_prompt(task, prompt, size), refs, dimensions)

    def edit(self, image: Path, instructions: str, *, task: str | None = None) -> ImageGenerationResult:
        source = Path(image).resolve(strict=True)
        with Image.open(source) as im:
            size = im.size
        return self._native(task or source.stem + "-edit", edit_prompt(instructions), (source,), size)

    def remove_background(self, image: Path, *, task: str | None = None) -> ImageGenerationResult:
        """Recorte reproducible con rembg; no consume tokens de Codex."""
        model_home = Path(os.environ.get("U2NET_HOME") or Path.home() / ".cache" / "nexa-brief" / "rembg")
        model_home.mkdir(parents=True, exist_ok=True)
        os.environ.setdefault("U2NET_HOME", str(model_home))
        from rembg import new_session, remove

        source = Path(image).resolve(strict=True)
        started = time.monotonic()
        with Image.open(source) as im:
            output = remove(im.convert("RGBA"), session=new_session("u2netp"))
        destination = self._destination(task or source.stem + "-sin-fondo")
        output.save(destination)
        seconds = time.monotonic() - started
        return ImageGenerationResult(destination, "rembg-u2netp/local", dict.fromkeys(_TOKEN_FIELDS, 0),
                                     seconds, ("Recorte local con rembg u2netp; los bordes requieren revisión.",))

    def variations(self, image: Path, n: int) -> list[ImageGenerationResult]:
        if not 1 <= n <= 8:
            raise ValueError("n debe estar entre 1 y 8")
        return [self.edit(image, f"Crea la variante visual {index + 1} de {n}; conserva el tema y la composición principal, cambia paleta y detalles.")
                for index in range(n)]

    def _native(self, task: str, prompt: str, refs: Sequence[Path], size: tuple[int, int]) -> ImageGenerationResult:
        self.work_root.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(prefix="run-", dir=self.work_root) as temp:
            work = Path(temp)
            attached = self._attach(refs, work)
            cmd = [self.binary, "exec", "--json", "--ephemeral", "--skip-git-repo-check",
                   "-C", str(work), "-s", "workspace-write",
                   "-c", 'forced_login_method="chatgpt"', "-m", self.preset.model,
                   "-c", f'model_reasoning_effort="{self.preset.effort}"']
            for ref in attached:
                cmd.extend(("-i", str(ref)))
            cmd.append("-")
            env = {key: value for key, value in os.environ.items() if key not in _API_ENV}
            env["CODEX_HOME"] = str(self.codex_home)
            code, events, seconds = self.runner.run(cmd, prompt, work, env, self.timeout)
            # El espacio de trabajo se borra; conservar el JSONL permite auditar fallos y tokens.
            log_dir = self.output_root / "logs"
            log_dir.mkdir(parents=True, exist_ok=True)
            log_path = log_dir / f"{re.sub(r'[^a-zA-Z0-9_-]+', '-', task)[:80]}-{time.time_ns()}.jsonl"
            log_path.write_text(events, encoding="utf-8")
            thread_id, tokens, last = _usage(events)
            if code != 0:
                raise RuntimeError(f"Codex terminó con código {code}: {events[-800:]}")
            image = self._generated_image(thread_id, last)
            destination = self._destination(task)
            with Image.open(image) as im:
                ImageOps.fit(im.convert("RGBA") if "A" in im.getbands() else im.convert("RGB"),
                             size, method=Image.Resampling.LANCZOS).save(destination)
            self._record(task, tokens, seconds)
            notes = ("Imagen nativa; el modelo interno de image_gen no se informa en JSONL.",
                     f"Log: {log_path}",
                     f"Original: {image.name}; ajuste final: {size[0]}x{size[1]}.")
            return ImageGenerationResult(destination, self.preset_name, tokens, seconds, notes)

    def _attach(self, refs: Sequence[Path], work: Path) -> list[Path]:
        if len(refs) > 5:
            raise ValueError("Se admiten hasta 5 referencias")
        attached = []
        for index, ref in enumerate(refs):
            source = Path(ref).resolve(strict=True)
            with Image.open(source) as im:
                im.verify()
            dest = work / f"reference-{index}{source.suffix.lower()}"
            shutil.copyfile(source, dest)
            attached.append(dest)
        return attached

    def _generated_image(self, thread_id: str, last: str) -> Path:
        if not re.fullmatch(r"[a-f0-9-]{36}", thread_id):
            raise RuntimeError("Codex no informó un thread_id válido")
        folder = self.codex_home / "generated_images" / thread_id
        images = sorted(folder.glob("*.png"), key=lambda path: path.stat().st_mtime)
        if not images:
            raise RuntimeError(f"Codex no produjo un PNG para el hilo {thread_id}: {last[-400:]}")
        return images[-1]

    def _destination(self, task: str) -> Path:
        safe = re.sub(r"[^a-zA-Z0-9_-]+", "-", task).strip("-")[:80] or "imagen"
        self.output_root.mkdir(parents=True, exist_ok=True)
        stamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%S%f")
        return self.output_root / f"{safe}-{stamp}.png"

    def _record(self, task: str, tokens: dict[str, int], seconds: float) -> None:
        """Formato compatible con work/usage.jsonl del kit."""
        entry = {"ts": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
                 "provider": "codex", "model": self.preset.model, "role": "image_gen",
                 "step": task, "iteration": 1, **tokens, "seconds": round(seconds, 2),
                 "ok": True, "billing": "suscripción", "note": "image_gen nativo"}
        with (self.output_root / "usage.jsonl").open("a", encoding="utf-8") as log:
            log.write(json.dumps(entry, ensure_ascii=False) + "\n")

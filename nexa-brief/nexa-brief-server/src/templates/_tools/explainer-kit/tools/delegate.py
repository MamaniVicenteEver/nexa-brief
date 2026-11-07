#!/usr/bin/env python3
"""Delegar un trabajo acotado a DeepSeek API o Codex CLI y registrar su uso.

El productor (Codex/Claude) sigue a cargo: delega borradores y segundas lecturas, después revisa.
Qué modelo hace cada rol: src/skills/models/roles.json (rol → proveedor, modelo y prompt de sistema).

  kit.py delegate <video-id> <rol> --prompt-file work/pedido.md [--out work/borrador.md] [--context PLAN.md]

  rol            rol delegable de roles.json (DeepSeek o Codex)
  --prompt-file  el pedido, escrito por el productor DENTRO de la carpeta del video
  --context      archivos del video que se agregan al pedido (PLAN.md, assets/script.json…)
  --out          dónde guardar el resultado (dentro del video). Si el rol devuelve js/json se guarda
                 solo el bloque de código; si no, el texto Markdown completo.

Siempre deja work/delegate/<rol>-<paso>-<vuelta>.md y una línea en work/usage.jsonl.
DeepSeek lee su clave del .env del servidor; Codex usa el runner local con login ChatGPT forzado,
sin variables de claves API y con escritura aislada a la carpeta del video.
"""
from __future__ import annotations

import asyncio
import json
import pathlib
import re
import time
import urllib.request

import tts
import usage
from places import KIT, SERVER

ROLES_FILE = SERVER / "src" / "skills" / "models" / "roles.json"
API_URL = "https://api.deepseek.com/chat/completions"
_FENCE = {"js": r"```(?:js|javascript)?\s*\n([\s\S]+?)```", "json": r"```(?:json)?\s*\n([\s\S]+?)```"}


def roles() -> dict:
    return json.loads(ROLES_FILE.read_text(encoding="utf-8"))


def inside(video_dir: pathlib.Path, rel: str) -> pathlib.Path:
    path = (video_dir / rel).resolve()
    if not path.is_relative_to(video_dir.resolve()):
        raise SystemExit(f"{rel}: tiene que estar dentro de la carpeta del video")
    return path


def ask_deepseek(model: str, system: str, user: str) -> tuple[dict, float]:
    body = {"model": model, "temperature": 0.4, "max_tokens": 8000, "thinking": {"type": "disabled"},
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    req = urllib.request.Request(API_URL, data=json.dumps(body).encode(), headers={
        "Authorization": "Bearer " + tts._key("DEEPSEEK_API_KEY"), "Content-Type": "application/json",
        "User-Agent": "nexa-explainer-kit/1.0"})
    started = time.time()
    for attempt in range(4):   # la API a veces deja la conexión colgada
        try:
            with urllib.request.urlopen(req, timeout=180) as r:
                return json.loads(r.read()), time.time() - started
        except Exception as exc:  # noqa: BLE001
            print(f"  intento {attempt + 1} falló: {type(exc).__name__}; reintento…", flush=True)
            time.sleep(5 + attempt * 10)
    raise SystemExit("DeepSeek no respondió")


def codex_runner():
    """Construye el runner compartido, que fuerza login ChatGPT y quita claves API."""
    from src.adapters.agent.infrastructure.cli_runner import CodexRunner

    return CodexRunner()


def write_output(path: pathlib.Path, text: str) -> None:
    """Escribe dentro del video y reemplaza el destino solo cuando terminó la escritura."""
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{time.time_ns()}.tmp")
    try:
        temporary.write_text(text, encoding="utf-8")
        temporary.replace(path)
    except Exception:
        temporary.unlink(missing_ok=True)
        raise


def run(video_dir: pathlib.Path, role: str, prompt_file: str, out: str = "", context: list[str] | None = None) -> pathlib.Path:
    cfg = roles()
    spec = cfg["roles"].get(role)
    if not spec:
        raise SystemExit(f"rol desconocido {role!r}. Roles: {', '.join(cfg['roles'])}")
    if not spec.get("delegatable"):
        raise SystemExit(f"el rol {role!r} no admite delegación con kit.py delegate")
    provider = spec["provider"]
    if provider not in ("deepseek", "codex"):
        raise SystemExit(f"el rol {role!r} lo hace {provider}, proveedor no soportado por kit.py delegate")

    provider_config = cfg["providers"][provider]
    alias = spec.get("model", "flash" if provider == "deepseek" else "")
    model = (provider_config.get("models") or {}).get(alias, alias)
    if not model:
        raise SystemExit(f"el rol {role!r} no declara un modelo para delegación")
    system = (KIT / spec["prompt"]).read_text(encoding="utf-8") if spec.get("prompt") else ""
    request = inside(video_dir, prompt_file).read_text(encoding="utf-8")
    for rel in context or []:
        request += f"\n\n--- {rel} ---\n" + inside(video_dir, rel).read_text(encoding="utf-8")

    step = pathlib.Path(out).name if out else pathlib.Path(prompt_file).stem
    output_target = inside(video_dir, out) if out else None
    iteration = usage.next_iteration(video_dir, role, step)
    log = video_dir / "work" / "delegate" / f"{role}-{step}-{iteration}.md"
    if output_target == log:
        raise SystemExit("--out no puede reemplazar el registro de la delegación")
    log.parent.mkdir(parents=True, exist_ok=True)
    data, secs, text, ok, note = {}, 0.0, "", True, ""

    try:
        if provider == "deepseek":
            data, secs = ask_deepseek(model, system, request)
            text = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
            if not text.strip():
                ok, note = False, "DeepSeek terminó sin contenido de respuesta"
        else:
            from src.core.ports.agent_port import AgentScope

            cli_log = video_dir / "work" / "delegate" / f"{role}-{step}-{iteration}.cli.jsonl"
            prompt = (
                f"Rol de borrador: {role}.\n"
                f"Instrucciones del rol:\n{system.strip()}\n\n"
                f"Pedido y contexto:\n{request}\n\n"
                "Entrega el borrador como texto Markdown. Trabaja solo con el pedido y el contexto provistos; "
                "no inventes hechos ni escribas archivos."
            )
            result = asyncio.run(codex_runner().run(
                prompt,
                cwd=video_dir,
                log_path=cli_log,
                timeout_seconds=1800,
                scope=AgentScope(
                    writable_dir=".",
                    os_sandbox_dir=".",
                    model=model,
                    reasoning_effort=spec.get("reasoning_effort"),
                ),
            ))
            data["usage"] = result.usage or {}
            secs = result.duration_seconds
            text = result.last_message.strip()
            if not result.ok:
                ok = False
                note = "Codex excedió el tiempo límite" if result.timed_out else f"Codex terminó con código {result.exit_code}"
                if text:
                    note += f": {text[-240:]}"
            elif not text:
                ok, note = False, "Codex terminó sin una respuesta final; no se escribió resultado"
    except SystemExit as exc:
        ok, note = False, str(exc)
    except Exception as exc:  # noqa: BLE001 - registrar fallos del CLI sin simular una respuesta
        ok, note = False, f"falló {provider}: {type(exc).__name__}: {exc}"

    u = data.get("usage") or {}
    detail = f"\n- error: {note}\n" if not ok else ""
    input_tokens = u.get("input_tokens", u.get("prompt_tokens", 0))
    cached_tokens = u.get("cached_input_tokens", u.get("prompt_cache_hit_tokens", 0))
    output_tokens = u.get("output_tokens", u.get("completion_tokens", 0))
    target = log
    if output_target is not None:
        kind = spec.get("output", "md")
        match = re.search(_FENCE[kind], text) if kind in _FENCE else None
        try:
            if ok:
                write_output(output_target, (match.group(1) if match else text).strip() + "\n")
                target = output_target
        except OSError as exc:
            ok, note = False, f"no se pudo escribir --out: {type(exc).__name__}: {exc}"
            detail = f"\n- error: {note}\n"

    log.write_text(
        f"# {role} · {step} · vuelta {iteration}\n\n- proveedor: {provider}\n- modelo: {model}\n- segundos: {secs:.1f}\n"
        f"- tokens: entrada {input_tokens} (caché {cached_tokens}), salida {output_tokens}\n{detail}\n"
        f"## Pedido\n\n{request}\n\n## Respuesta\n\n{text if ok else '(sin resultado)'}\n",
        encoding="utf-8",
    )
    usage.record(
        video_dir, provider=provider, model=model, role=role, step=step, iteration=iteration, seconds=secs, ok=ok,
        input_tokens=u.get("input_tokens", u.get("prompt_tokens")),
        cached_input_tokens=u.get("cached_input_tokens", u.get("prompt_cache_hit_tokens")),
        output_tokens=u.get("output_tokens", u.get("completion_tokens")),
        reasoning_tokens=u.get("reasoning_tokens", (u.get("completion_tokens_details") or {}).get("reasoning_tokens")),
        note=note,
    )
    if not ok:
        raise SystemExit(note)
    print(f"✓ {role} ({provider}/{model}, vuelta {iteration}, {secs:.0f} s, {input_tokens}+{output_tokens} tokens) → "
          f"{target.relative_to(video_dir)}  · registro: {log.relative_to(video_dir)}")
    return target

#!/usr/bin/env python3
"""Delegar un trabajo acotado a un modelo por API (hoy DeepSeek) y dejarlo anotado en el registro de uso.

El productor (Codex/Claude) sigue a cargo: delega borradores y segundas lecturas, después revisa.
Qué modelo hace cada rol: src/skills/models/roles.json (rol → proveedor, modelo y prompt de sistema).

  kit.py delegate <video-id> <rol> --prompt-file work/pedido.md [--out assets/components/x.js] [--context PLAN.md]

  rol            uno de roles.json con proveedor por API (component_draft, copy_draft, fact_check…)
  --prompt-file  el pedido, escrito por el productor DENTRO de la carpeta del video
  --context      archivos del video que se agregan al pedido (PLAN.md, assets/script.json…)
  --out          dónde guardar el resultado (dentro del video). Si el rol devuelve js/json se guarda
                 solo el bloque de código; si no, el texto completo.

Siempre deja: work/delegate/<rol>-<n>.md (pedido, respuesta, tokens, segundos) + una línea en work/usage.jsonl.
La clave se lee del .env del servidor y nunca se imprime.
"""
from __future__ import annotations

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


def run(video_dir: pathlib.Path, role: str, prompt_file: str, out: str = "", context: list[str] | None = None) -> pathlib.Path:
    cfg = roles()
    spec = cfg["roles"].get(role)
    if not spec:
        raise SystemExit(f"rol desconocido {role!r}. Roles: {', '.join(cfg['roles'])}")
    provider = spec["provider"]
    if provider != "deepseek":
        raise SystemExit(f"el rol {role!r} lo hace {provider} (no se delega por API: lo hace el productor)")
    model = cfg["providers"]["deepseek"]["models"].get(spec.get("model", "flash"), spec.get("model"))
    system = (KIT / spec["prompt"]).read_text(encoding="utf-8") if spec.get("prompt") else ""
    request = inside(video_dir, prompt_file).read_text(encoding="utf-8")
    for rel in context or []:
        request += f"\n\n--- {rel} ---\n" + inside(video_dir, rel).read_text(encoding="utf-8")

    step = pathlib.Path(out).name if out else pathlib.Path(prompt_file).stem
    iteration = usage.next_iteration(video_dir, role, step)
    ok, note = True, ""
    try:
        data, secs = ask_deepseek(model, system, request)
        text = (data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    except SystemExit as exc:
        data, secs, text, ok, note = {}, 0.0, "", False, str(exc)
    u = data.get("usage") or {}
    usage.record(
        video_dir, provider="deepseek", model=model, role=role, step=step, iteration=iteration, seconds=secs, ok=ok,
        input_tokens=u.get("prompt_tokens"), cached_input_tokens=u.get("prompt_cache_hit_tokens"),
        output_tokens=u.get("completion_tokens"),
        reasoning_tokens=(u.get("completion_tokens_details") or {}).get("reasoning_tokens"), note=note,
    )
    if not ok:
        raise SystemExit(note)

    log = video_dir / "work" / "delegate" / f"{role}-{step}-{iteration}.md"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(
        f"# {role} · {step} · vuelta {iteration}\n\n- modelo: {model}\n- segundos: {secs:.1f}\n"
        f"- tokens: entrada {u.get('prompt_tokens', 0)} (caché {u.get('prompt_cache_hit_tokens', 0)}), "
        f"salida {u.get('completion_tokens', 0)}\n\n## Pedido\n\n{request}\n\n## Respuesta\n\n{text}\n",
        encoding="utf-8",
    )
    target = log
    if out:
        target = inside(video_dir, out)
        target.parent.mkdir(parents=True, exist_ok=True)
        kind = spec.get("output", "md")
        match = re.search(_FENCE[kind], text) if kind in _FENCE else None
        target.write_text((match.group(1) if match else text).strip() + "\n", encoding="utf-8")
    print(f"✓ {role} ({model}, vuelta {iteration}, {secs:.0f} s, {u.get('prompt_tokens', 0)}+{u.get('completion_tokens', 0)} tokens) → "
          f"{target.relative_to(video_dir)}  · registro: {log.relative_to(video_dir)}")
    return target

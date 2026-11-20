"""Adaptadores del laboratorio a los servicios existentes del servidor.

Se ejecuta con el Python del servidor. No modifica src ni los perfiles de voz.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import json
import subprocess
import sys
import time
import wave
from pathlib import Path

from speech_lab import SCHEMA, digest, load, report, validate_batch, verify_review, word_count, write


async def draft(server, root, logs=None):
    sys.path.insert(0, str(server))
    from src.adapters.models.hub import agent_for, model_for, roles_config
    from src.core.ports.agent_port import AgentScope
    if (root / "scripts.json").exists():
        raise ValueError("Ya existe un borrador; usar un estudio nuevo para otra llamada")
    try:
        agent = agent_for("dialogue_draft")
        if not agent.available():
            raise RuntimeError("agent_unavailable")
    except Exception as exc:
        write(root / "agent.metrics.json", {"backend": "configured-agent", "status": "blocked_before_inference",
              "error_type": type(exc).__name__, "provider_calls": 0, "usage": None, "monetary_cost": None})
        raise
    work = root / "agent"
    work.mkdir(exist_ok=False)
    logs = logs or work
    logs.mkdir(parents=True, exist_ok=True)
    write(work / "response.schema.json", SCHEMA)
    prompt = (root / "draft.prompt.txt").read_text()
    spec = roles_config()["roles"]["dialogue_draft"]
    started = time.monotonic()
    try:
        result = await agent.run(prompt, cwd=work, log_path=logs / "events.jsonl", timeout_seconds=120,
                                scope=AgentScope(writable_dir=".", read_only=True,
                                                 model=model_for("dialogue_draft") or None,
                                                 reasoning_effort=spec.get("reasoning_effort"),
                                                 output_schema=work / "response.schema.json"))
    except Exception as exc:
        write(root / "agent.metrics.json", {"provider": agent.name, "status": "failed", "error_type": type(exc).__name__,
              "usage": None, "monetary_cost": None, "elapsed_seconds": round(time.monotonic()-started, 3), "attempts": 1})
        raise
    metrics = {"provider": agent.name, "model": result.model, "usage": result.usage,
               "elapsed_seconds": round(time.monotonic()-started, 3), "exit_code": result.exit_code,
               "timed_out": result.timed_out, "monetary_cost": result.usage.get("cost_usd"),
               "cost_status": "reported" if result.usage.get("cost_usd") is not None else "unknown",
               "attempts": 1, "prompt_hash": digest(prompt)}
    write(root / "agent.metrics.json", metrics)
    (work / "response.txt").write_text(result.last_message)
    if not result.ok:
        raise RuntimeError("agent_failed_or_isolation_unavailable; consultar agent.metrics.json")
    data = json.loads(result.last_message)
    # Guardar respuesta incluso si falla la validación: auditar sin repetir gasto.
    write(root / "scripts.json", data)
    validate_batch(root, data)
    study = load(root / "study.json")
    study["metrics"]["agent"] = metrics
    study["status"] = "draft_validated_pending_editorial_review"
    write(root / "study.json", study)


async def draft_api(server, root):
    sys.path.insert(0, str(server))
    from src.adapters.ai.infrastructure.deepseek_adapter import DeepSeekAdapter
    from jsonschema import validate
    if (root / "scripts.json").exists():
        raise ValueError("Ya existe un borrador; usar un estudio nuevo para otra llamada")
    adapter = DeepSeekAdapter(max_retries=1)
    # El SDK no debe añadir reintentos invisibles a la medición de esta prueba.
    adapter._client = adapter._client.with_options(max_retries=0)
    started = time.monotonic()
    try:
        data, usage = await asyncio.wait_for(adapter.complete_json_with_usage(
            "Eres redactor de piezas breves. Responde solo JSON, sin investigar. Esquema obligatorio: " + json.dumps(SCHEMA),
            (root / "draft.prompt.txt").read_text(), structured=True), timeout=120)
    except Exception as exc:
        write(root / "draft-api.failure.json", {"provider": "deepseek", "error_type": type(exc).__name__,
              "usage": None, "monetary_cost": None, "elapsed_seconds": round(time.monotonic()-started, 3), "attempts": 1})
        raise
    metrics = {"backend": "text_api", "provider": "deepseek", "usage": usage,
               "elapsed_seconds": round(time.monotonic()-started, 3), "attempts": 1,
               "monetary_cost": usage.get("cost_usd"),
               "cost_status": "reported" if usage.get("cost_usd") is not None else "unknown"}
    write(root / "draft.metrics.json", metrics)
    write(root / "scripts.json", data)
    validate(data, SCHEMA)
    validate_batch(root, data)
    study = load(root / "study.json")
    study["metrics"]["agent"] = {"status": "not_executed", "reason": "isolated_cli_unavailable"}
    study["metrics"]["draft"] = metrics
    study["status"] = "draft_validated_pending_editorial_review"
    write(root / "study.json", study)


def synthesize(server, root):
    data = load(root / "scripts.json")
    scripts = validate_batch(root, data)
    verify_review(root, data)
    profiles = {p["id"]: p for p in load(root / "profiles.snapshot.json")}
    sys.path.insert(0, str(server))
    from src.adapters.voice.infrastructure.gemini_key_pool import KeyPool
    pool = KeyPool()
    output = root / "audio"
    output.mkdir(exist_ok=True)
    for script in scripts:
        ident = script["character_id"]
        voice = profiles[ident]["voice"]
        if voice["selection_status"] != "selected_by_user":
            raise ValueError("Voz no seleccionada: " + ident)
        wav, mp3 = output / (ident + ".wav"), output / (ident + ".mp3")
        metrics_path = output / (ident + ".metrics.json")
        text = " ".join(s["text"] for s in script["segments"])
        prompt = "GENERATE SPEECH AUDIO ONLY. Do not read instructions or headings.\nAUDIO PROFILE\n" + voice["direction"] + "\nDIRECTOR NOTES\nRead the exact transcript in neutral Latin American Spanish. Natural short pauses. No extra words, music or sound effects.\nTRANSCRIPT BEGINS\n" + text + "\nTRANSCRIPT ENDS"
        signature = digest({"prompt": prompt, "voice": voice["name"], "model": voice["model"]})
        if wav.exists() or mp3.exists():
            if not metrics_path.exists() or load(metrics_path).get("request_hash") != signature:
                raise ValueError("Salida existente sin coincidencia de solicitud; usar un estudio nuevo")
            print(json.dumps({"character": ident, "status": "reused_no_api_call"}), flush=True)
            continue
        (output / (ident + ".prompt.txt")).write_text(prompt)
        start = time.monotonic()
        try:
            seconds, usage, attempts = speak(pool, prompt, wav, voice["name"], voice["model"],
                                            skip_primary=(output / (ident + ".failure.json")).exists())
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-n", "-i", str(wav), "-codec:a", "libmp3lame", "-b:a", "128k", str(mp3)], check=True)
        except Exception as exc:
            write(output / (ident + ".failure.json"), {"error_type": type(exc).__name__, "elapsed_seconds": time.monotonic()-start, "usage_status": "unknown", "monetary_cost": None})
            raise
        metrics = {"character_id": ident, "provider": "Gemini TTS", "model": voice["model"], "voice": voice["name"],
                   "request_hash": signature, "profile_hash": digest(profiles[ident]), "script_hash": digest(script),
                   "usage": usage, "elapsed_seconds": round(time.monotonic()-start, 3), "duration_seconds": seconds,
                   "provider_attempts": attempts,
                   "word_count": word_count(text), "opening_words": word_count(script["segments"][0]["text"]),
                   "self_intro_words": 0, "closing_words": sum(word_count(s["text"]) for s in script["segments"] if s["role"] == "closing"),
                   "monetary_cost": None, "cost_status": "not_reported", "editorial_review": "pending",
                   "postprocess": "MP3 encoding only; no tempo change, no padding, no clipping"}
        write(metrics_path, metrics)
        print(json.dumps({"character": ident, "duration": round(seconds, 2), "usage": usage}), flush=True)
    study = load(root / "study.json")
    study["metrics"]["tts"] = [load(p) for p in sorted(output.glob("*.metrics.json"))]
    study["status"] = "audio_generated_pending_user_review"
    write(root / "study.json", study)
    report(root)


def speak(pool, prompt, destination, voice, model, *, skip_primary=False):
    """Misma API TTS; pool existente. Una petición por clave, máximo tres.

    Sin cambio de modelo ni reintentos ciegos de cuotas por minuto/día.
    Nunca archiva cabeceras, credenciales o cuerpos de error del proveedor.
    """
    import httpx
    keys = pool.available(model)
    if skip_primary and pool.keys:
        keys = [k for k in keys if k.label != pool.keys[0].label]
    attempts = []
    body = {"contents": [{"parts": [{"text": prompt}]}], "generationConfig": {
        "responseModalities": ["AUDIO"], "speechConfig": {"voiceConfig": {"prebuiltVoiceConfig": {"voiceName": voice}}}}}
    with httpx.Client(timeout=90) as client:
        for key in keys[:3]:
            response = client.post("https://generativelanguage.googleapis.com/v1beta/models/"+model+":generateContent",
                                   headers={"x-goog-api-key": key.value}, json=body)
            row = {"credential_label": key.label, "http_status": response.status_code}
            attempts.append(row)
            if response.status_code in (402, 429):
                payload = response.json()
                daily = response.status_code == 402 or "perday" in json.dumps(payload).replace("_", "").lower()
                row["status"] = "daily_quota" if daily else "rate_limited"
                if daily:
                    pool.mark_exhausted(key, model)
                    continue
                write(destination.with_suffix(".attempts.json"), attempts)
                raise RuntimeError("TTS rate limited: detener y reintentar más tarde")
            if response.status_code != 200:
                row["status"] = "failed"
                write(destination.with_suffix(".attempts.json"), attempts)
                raise RuntimeError("TTS HTTP " + str(response.status_code))
            payload = response.json()
            candidates = payload.get("candidates") or []
            parts = candidates[0].get("content", {}).get("parts", []) if candidates else []
            pcm = b"".join(base64.b64decode(p["inlineData"]["data"]) for p in parts if "inlineData" in p)
            if not pcm or len(pcm) % 2:
                raise RuntimeError("TTS no devolvió PCM válido")
            with wave.open(str(destination), "wb") as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(24000)
                wav.writeframes(pcm)
            row["status"] = "ok"
            write(destination.with_suffix(".attempts.json"), attempts)
            return len(pcm) / 48000, payload.get("usageMetadata") or {}, attempts
    write(destination.with_suffix(".attempts.json"), attempts)
    raise RuntimeError("TTS: sin cuota disponible en las credenciales configuradas probadas")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["draft", "synthesize"])
    parser.add_argument("--server", type=Path, required=True)
    parser.add_argument("--study", type=Path, required=True)
    parser.add_argument("--logs", type=Path)
    parser.add_argument("--provider", choices=["configured-agent", "deepseek"], default="configured-agent")
    args = parser.parse_args()
    if args.command == "draft":
        if args.provider == "deepseek":
            asyncio.run(draft_api(args.server.resolve(), args.study.resolve()))
        else:
            asyncio.run(draft(args.server.resolve(), args.study.resolve(), args.logs.resolve() if args.logs else None))
    else:
        synthesize(args.server.resolve(), args.study.resolve())

"""CLI for outer operators; the isolated editorial worker does not run this."""
from __future__ import annotations

import argparse
import json
import math
import time

from .client import APIClientError, DEFAULT_API_URL, EditionClient, identifier, locale_code, safe_error


def emit(value):
    print(json.dumps(value, ensure_ascii=False), flush=True)


def public_result(value):
    if isinstance(value, dict):
        result = {}
        for key, item in value.items():
            if any(word in key.lower() for word in ("password", "secret", "credential", "authorization", "api_key")):
                result[key] = "[redactado]"
            elif key in {"error", "detail", "message"} and isinstance(item, str):
                result[key] = safe_error(item)
            else:
                result[key] = public_result(item)
        return result
    if isinstance(value, list):
        return [public_result(item) for item in value]
    return value


def _seconds(value):
    number = float(value)
    if not math.isfinite(number) or number <= 0:
        raise argparse.ArgumentTypeError("Usa una duración positiva y finita")
    return number


def _identifier(value):
    try:
        identifier(value)
        return value
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def _locale(value):
    try:
        return locale_code(value)
    except ValueError as exc:
        raise argparse.ArgumentTypeError(str(exc)) from exc


def parser():
    result = argparse.ArgumentParser(description="Ediciones nativas: el mismo flujo privado de la web, operado por API")
    result.add_argument("--api-url", default=DEFAULT_API_URL)
    result.add_argument("--request-timeout", type=_seconds, default=15)
    commands = result.add_subparsers(dest="command", required=True)
    show = commands.add_parser("show", help="Inspeccionar el contrato local original, sin producir medios")
    show.add_argument("--production", required=True)
    show.add_argument("--locale", default="es-419")
    show.add_argument("--revision", default="rev-001")
    show.add_argument("--format", dest="format_id")
    show.add_argument("--duration-seconds", type=float)
    for name in ("preflight", "create", "list"):
        command = commands.add_parser(name)
        command.add_argument("video_id", type=_identifier)
        if name != "list":
            command.add_argument("--locale", type=_locale, required=True)
        if name == "create":
            command.add_argument("--new-version", action="store_true", help="Solicitar explícitamente otra versión aun si existe una edición lista")
            _wait_options(command)
    for name in ("status", "resume"):
        command = commands.add_parser(name)
        command.add_argument("job_id", type=_identifier)
        _wait_options(command)
    return result


def _wait_options(command):
    command.add_argument("--wait", action="store_true", help="Seguir el trabajo de la API sin ejecutarlo dentro del CLI")
    command.add_argument("--wait-timeout", type=_seconds, default=1800, help="Máximo de espera en segundos; no cancela el trabajo (1800)")
    command.add_argument("--poll-interval", type=_seconds, default=3, help="Intervalo entre consultas, de 2 a 5 segundos (3)")


def job_result(value):
    result = {key: value.get(key) for key in ("job_id", "video_id", "locale", "status", "stage", "percent", "revision", "resumable")}
    if value.get("error"):
        result["error"] = safe_error(value["error"])
    return result


def wait_for_job(client, job_id, *, timeout=1800, interval=3, output=emit, clock=time.monotonic, sleep=time.sleep):
    deadline, last = clock() + timeout, None
    while True:
        if last is not None and clock() >= deadline:
            output({"event": "wait_timeout", "job": last, "continues_on_server": True,
                    "next_action": "status", "message": "Terminó la espera local; el trabajo sigue siendo de la API. Conserva su job_id."})
            return 124
        remaining = max(.001, deadline - clock())
        try:
            job = job_result(client.status(job_id, timeout=min(getattr(client, "timeout", 15), remaining)))
        except APIClientError:
            if clock() >= deadline:
                output({"event": "wait_timeout", "job": last or {"job_id": job_id, "status": "unknown", "resumable": None},
                        "continues_on_server": True, "next_action": "status"})
                return 124
            raise
        if job != last:
            output({"event": "progress", "job": job})
            last = job
        if job["status"] == "completed":
            output({"event": "completed", "job": job, "next_action": "review"})
            return 0
        if job["status"] in {"failed", "cancelled", "canceled"}:
            output({"event": "failed", "job": job, "next_action": "resume" if job.get("resumable") else "preflight"})
            return 1
        remaining = deadline - clock()
        if remaining <= 0:
            output({"event": "wait_timeout", "job": job, "continues_on_server": True,
                    "next_action": "status", "message": "Terminó la espera local; el trabajo sigue siendo de la API. Conserva su job_id."})
            return 124
        sleep(min(interval, remaining))


def main(argv=None, *, client_factory=EditionClient, output=emit):
    args = parser().parse_args(argv)
    if args.command == "show":
        from .resolver import build_edition
        values = {key: getattr(args, key) for key in ("production", "locale", "revision", "format_id", "duration_seconds")}
        print(build_edition(**values).model_dump_json(by_alias=True, indent=2))
        return 0
    destination = output
    def output(value):
        destination(public_result(value))
    context = {key: getattr(args, key) for key in ("video_id", "locale", "job_id") if hasattr(args, key)}
    try:
        if args.request_timeout > 60:
            raise ValueError("El timeout de cada solicitud no puede superar 60 segundos")
        if hasattr(args, "poll_interval") and not 2 <= args.poll_interval <= 5:
            raise ValueError("El intervalo de consulta debe estar entre 2 y 5 segundos")
        client = client_factory(args.api_url, timeout=args.request_timeout)
        if args.command == "preflight":
            data = client.preflight(args.video_id, args.locale)
            output({"event": "preflight", "preflight": data})
            return 0 if data.get("ready") else 3
        if args.command == "list":
            output({"event": "editions", **client.list(args.video_id)})
            return 0
        if args.command == "create":
            preflight = client.preflight(args.video_id, args.locale)
            output({"event": "preflight", "preflight": preflight})
            action = preflight.get("next_action")
            if action in {"ready", "review"} and not args.new_version:
                output({"event": "reused", **context, "revision": preflight.get("revision"), "next_action": action})
                return 0
            if action == "wait" and preflight.get("job_id"):
                context["job_id"] = preflight["job_id"]
                job = client.status(context["job_id"])
            elif action == "resume" or not preflight.get("ready") or action not in {"create", "ready", "review"}:
                output({"event": "blocked", **context, "job_id": preflight.get("job_id"),
                        "next_action": action or "preflight", "issues": preflight.get("issues", [])})
                return 3
            else:
                job = client.create(args.video_id, args.locale)
        elif args.command == "resume":
            job = client.resume(args.job_id)
        else:
            job = client.status(args.job_id)
        job = job_result(job)
        if not job.get("job_id"):
            raise APIClientError("La API no devolvió el job_id; consulta list antes de repetir")
        context["job_id"] = job["job_id"]
        output({"event": "job", "job": job})
        if args.wait:
            if not context.get("job_id"):
                raise APIClientError("La API no devolvió el job_id; consulta list antes de repetir")
            return wait_for_job(client, context["job_id"], timeout=args.wait_timeout,
                                interval=args.poll_interval, output=output)
        return 1 if job.get("status") in {"failed", "cancelled", "canceled"} else 0
    except KeyboardInterrupt:
        output({"event": "interrupted", **context, "continues_on_server": True,
                "next_action": "status" if context.get("job_id") else "preflight",
                "message": "Se interrumpió el cliente; no se canceló el trabajo de la API. Consulta su estado antes de repetir."})
        return 130
    except (APIClientError, ValueError) as exc:
        output({"event": "error", **context, "error": safe_error(str(exc)),
                "http_status": getattr(exc, "status", None), "next_action": "status" if context.get("job_id") else "preflight"})
        return 1

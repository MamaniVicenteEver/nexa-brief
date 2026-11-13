#!/usr/bin/env python3
"""Host-only, resumable Atlas preparation. Never renders or publishes."""
from __future__ import annotations

import argparse
import asyncio
import contextlib
import copy
import datetime as dt
import fcntl
import hashlib
import html
import io
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from types import SimpleNamespace
import uuid

SERVER = Path(__file__).resolve().parents[1]
TOOLS = SERVER / "src/templates/_tools/explainer-kit/tools"
TEMPLATES = SERVER / "src/templates"
if str(SERVER) not in sys.path:
    sys.path.insert(0, str(SERVER))
from src.core.explainer.engine_locations import engine_root
ATLAS = engine_root(TEMPLATES, "nodehistory/_atlas")
ORCHESTRATION = ATLAS / "orchestration.json"
SLUG = re.compile(r"[a-z0-9]+(?:-[a-z0-9]+)*\Z")
TOKEN_FIELDS = ("input_tokens", "cached_input_tokens", "output_tokens", "reasoning_tokens")
PUBLIC_HASHES = {
    "atlas.js": ATLAS / "atlas.js", "voice.json": ATLAS / "voice.json",
    "narrative.json": ATLAS / "narrative.json",
    "maplibre-gl.css": ATLAS / "vendor/maplibre-gl.css",
    "fonts.css": ATLAS / "assets/fonts/fonts.css",
    "proto.js": SERVER / "src/templates/sandbox/_proto/proto.js",
    **{name: ATLAS / name for name in ("flag-fill.js", "hud.js", "overlays.js", "camera.js",
                                      "components.json", "orchestration.json", "projection.js", "geo.js",
                                      "produce.mjs", "validate.mjs")},
}


class StageError(RuntimeError):
    """An intentionally public, credential-free diagnostic."""


def utc():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def digest(path):
    if not path.is_file():
        return None
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def checked(path, root):
    """No traversal, symlinks or multiply-linked episode/log files."""
    path, root = Path(path), Path(root)
    if not path.is_relative_to(root):
        raise StageError("La ruta sale de su carpeta asignada")
    for item in (root, *[root.joinpath(*path.relative_to(root).parts[:i])
                          for i in range(1, len(path.relative_to(root).parts) + 1)]):
        if item.is_symlink():
            raise StageError("No se permiten enlaces simbólicos en la carpeta asignada")
        if item.is_file() and item.stat().st_nlink != 1:
            raise StageError("No se permiten archivos con enlaces múltiples")
    return path


def write_json(path, value, root):
    path = checked(path, root)
    path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    temp = path.with_name(path.name + "." + uuid.uuid4().hex + ".tmp")
    try:
        with temp.open("x", encoding="utf-8") as stream:
            json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
            stream.write("\n")
        temp.chmod(0o600)
        temp.replace(path)
    finally:
        temp.unlink(missing_ok=True)


def private_tree(root):
    checked(root, root).chmod(0o700)
    for path in root.rglob("*"):
        checked(path, root).chmod(0o700 if path.is_dir() else 0o600)


def tools_modules():
    if str(TOOLS) not in sys.path:
        sys.path.insert(0, str(TOOLS))
    import usage
    return usage


def statuses():
    from src.adapters.agent.factory import agents_status
    return [{"name": row["name"], "available": bool(row["available"])}
            for row in agents_status()]


class Context:
    def __init__(self, layout, profile, episode, category="nodeatlas", title="", status_fn=statuses):
        if not SLUG.fullmatch(episode) or len(episode) > 100 or not SLUG.fullmatch(category):
            raise StageError("episode y category deben ser slugs en minúsculas")
        self.layout, self.profile = layout, profile
        self.root = layout.root.resolve()
        self.sandbox = layout.sandbox_dir
        if layout.schema_version < 2 or not self.sandbox.resolve().is_relative_to(self.root):
            raise StageError("Se requiere un perfil v2/v3 seleccionado con sandbox propio")
        checked(self.sandbox, self.root)
        self.episode = checked(self.sandbox / category / episode, self.root)
        self.log = checked(layout.logs_dir / "atlas-factory" / category / episode, self.root)
        self.test = self.episode / "work/results/test"
        self.title, self.status_fn = title or episode, status_fn
        self.owned = False

    def file(self, relative):
        return checked(self.episode / relative, self.episode)

    def require(self):
        if not self.episode.is_dir() or not self.file("info.json").is_file():
            raise StageError("El episodio no está inicializado")
        info = load(self.file("info.json"))
        if info.get("design") != "atlas-cinematico" or info.get("engine") != "nodehistory/_atlas":
            raise StageError("La carpeta no es un episodio Atlas de este controlador")
        self.owned = True
        private_tree(self.episode)

    def save(self, relative, value):
        write_json(self.file(relative), value, self.episode)

    def checkpoint(self, stage, result):
        result = {"stage": stage, "at": utc(), **result}
        write_json(self.log / (stage + "-" + uuid.uuid4().hex + ".json"), result, self.log)
        if self.owned and self.episode.is_dir():
            self.save("work/results/test/stage-" + stage + ".json", result)
        return result

    def previous(self, stage):
        path = self.file("work/results/test/stage-" + stage + ".json")
        return load(path) if path.is_file() else {}


def snapshot(ctx):
    memory = {}
    for line in Path("/proc/meminfo").read_text().splitlines():
        key, _, value = line.partition(":")
        if key in ("MemAvailable", "SwapFree"):
            memory[key + "_kB"] = int(value.split()[0])
    files = {}
    if ctx.episode.is_dir():
        for path in sorted(ctx.episode.rglob("*")):
            checked(path, ctx.episode)
            if path.is_file():
                files[path.relative_to(ctx.episode).as_posix()] = {
                    "bytes": path.stat().st_size, "sha256": digest(path)}
    return {"timestamp_utc": utc(), "profile": ctx.profile, "memory": memory,
            "factory": ctx.status_fn(), "factory_availability_is_authentication": False,
            "shared_hashes": {name: digest(path) for name, path in PUBLIC_HASHES.items()},
            "manifest": files}


def render_wrapper(title):
    """Canonical, single-config loader; no optional 404 probes or duplicated engine."""
    base = "/api/v1/explainer/files/bundled/" + ATLAS.relative_to(TEMPLATES).as_posix() + "/"
    proto = "/api/v1/explainer/files/bundled/sandbox/_proto/proto.js"
    return f'''<!doctype html>
<html lang="es" data-atlas-manual="true"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{html.escape(title)}</title>
<link rel="stylesheet" href="{base}assets/fonts/fonts.css">
<link rel="stylesheet" href="{base}vendor/maplibre-gl.css">
<style>html,body{{margin:0;height:100%;background:#000;overflow:hidden}}#stage,#stage>canvas{{position:fixed;inset:0;display:block}}</style>
</head><body><audio id="audio" preload="auto"></audio><div id="stage"></div>
<script src="{proto}"></script><script type="module">
import {{runAtlas}} from '{base}atlas.js';
const episodeBase = new URL('./', location.href);
async function readJSON(path) {{
  const url = new URL(path, episodeBase);
  if (url.origin !== location.origin || !url.pathname.startsWith(episodeBase.pathname)) throw Error('Ruta JSON fuera del episodio');
  const response = await fetch(url, {{cache:'no-cache'}});
  if (!response.ok) throw Error(`Atlas host: HTTP ${{response.status}} en ${{url.pathname}}`);
  return response.json();
}}
runAtlas({{loadData: async () => {{
  const config = await readJSON('assets/config.json');
  const active = config.configs?.[0];
  if (!active) throw Error('Atlas host: falta configs[0]');
  const [scene, lyrics, info] = await Promise.all([
    readJSON(active.sceneUrl || 'assets/scene.json'),
    active.lyricsUrl ? readJSON(active.lyricsUrl) : Promise.resolve({{segments:[]}}),
    readJSON('info.json')
  ]);
  return {{config, scene, lyrics, info}};
}}}}).catch(error => console.error('[atlas-host]', error));
</script></body></html>
'''


def initialize(ctx):
    if ctx.episode.exists():
        raise StageError("El episodio ya existe; init nunca sobrescribe")
    ctx.episode.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
    ctx.episode.mkdir(mode=0o700)
    ctx.owned = True
    for relative in ("assets/media", "work/agent-context", "work/results/test"):
        ctx.file(relative).mkdir(parents=True, mode=0o700)
    ctx.file("index.html").write_text(render_wrapper(ctx.title), encoding="utf-8")
    ctx.save("info.json", {"version": 1, "title": ctx.title, "summary": "Episodio Atlas Cinemático en preparación editorial y visual.",
                           "design": "atlas-cinematico", "engine": "nodehistory/_atlas", "based_on": "nodehistory/_atlas",
                           "is_new_design": False, "status": "en progreso", "created_at": utc()[:10], "libraries": [],
                           "inputs": ["assets/episode-data.json", "research.json", "assets/script.json", "assets/lyrics.json"],
                           "notes": ["Preparación host del episodio; requiere revisión editorial, escucha y QA visual."]})
    ctx.save("assets/config.json", {"activeId": "default", "configs": [{"id": "default",
             "sceneUrl": "assets/scene.json", "audio": {"src": "assets/song.mp3"}, "lyricsUrl": "assets/lyrics.json"}]})
    ctx.save("assets/overlays.json", {"items": []})
    ctx.save("assets/geo.resolved.json", {"regions": []})
    ctx.save("work/results/test/initial.json", snapshot(ctx))
    private_tree(ctx.episode)
    return {"ok": True, "episode": str(ctx.episode), "initial": "work/results/test/initial.json"}


def inputs(ctx):
    names = ("assets/episode-data.json", "research.json", "work/brief.json")
    if any(not ctx.file(name).is_file() for name in names):
        raise StageError("Se requieren assets/episode-data.json, research.json y work/brief.json")
    data, research, brief = [load(ctx.file(name)) for name in names]
    countries, facts, sources = data.get("countries", []), research.get("facts", []), research.get("sources", [])
    if (len(countries) != 8 or {c.get("rank") for c in countries} != set(range(1, 9))
            or len({c.get("iso2") for c in countries}) != 8):
        raise StageError("El dataset requiere ocho países con rank 1..8 e ISO2 únicos")
    source_ids = {s.get("id") for s in sources}
    fact_ids = {f.get("id") for f in facts}
    if not facts or None in fact_ids or len(fact_ids) != len(facts):
        raise StageError("research.facts requiere IDs únicos")
    for fact in facts:
        if not fact.get("claim") or not fact.get("sourceIds") or not set(fact["sourceIds"]) <= source_ids:
            raise StageError("Cada fact requiere claim y sourceIds válidos")
    for source in sources:
        if not source.get("id") or not re.match(r"https?://", str(source.get("url", ""))):
            raise StageError("Cada fuente requiere id y URL HTTP(S)")
    for country in countries:
        regions = country.get("regions", [])
        if (not re.fullmatch(r"[A-Z]{2}", country.get("iso2", "")) or len(regions) < 2
                or len({r.get("id") for r in regions}) != len(regions)
                or any(not r.get("id") or not r.get("criterion") for r in regions)):
            raise StageError("Cada país requiere ISO2 y dos regiones con id y criterio explícito")
    return data, research, brief


def validate_script(script, data, research, voice, styles):
    """Contract checks only: this does not establish factual truth or editorial quality."""
    if not isinstance(script, dict) or not isinstance(script.get("title"), str):
        raise StageError("script requiere title y objeto JSON")
    if script.get("voice") != "Orus" or script.get("voice_direction") != voice["voice"]["base"]:
        raise StageError("script debe usar Orus y voice_direction STRING exacto del perfil público")
    segments = script.get("segments", [])
    if len(segments) != 34 or len({s.get("id") for s in segments}) != 34:
        raise StageError("script requiere intro + ocho grupos de cuatro + outro, con IDs únicos")
    known = {f["id"] for f in research["facts"]}
    total = 0
    expected = [("intro", None, None)]
    for c in sorted(data["countries"], key=lambda c: c["rank"], reverse=True):
        expected += [("country", c["iso2"], None), ("insight", c["iso2"], None)]
        expected += [("region", c["iso2"], r["id"]) for r in c["regions"][:2]]
    expected.append(("outro", None, None))
    for segment, (kind, country, region) in zip(segments, expected):
        text, plan, references = segment.get("text", ""), segment.get("plan", {}), segment.get("fact_ids")
        intensity = segment.get("intensity")
        if (not isinstance(text, str) or not text.strip() or not segment.get("id")
                or segment.get("tone") not in styles or type(intensity) not in (float, int)
                or not math.isfinite(intensity) or not 0 <= intensity <= 1):
            raise StageError("Segmento inválido: id/text/tone/intensity")
        if re.search(r"\b(PENDIENTE|REEMPLAZAR|TODO)\b", text, re.I):
            raise StageError("No se sintetizan marcadores de trabajo")
        if not isinstance(references, list) or not set(references) <= known:
            raise StageError("fact_ids debe referenciar research.json")
        if any(re.search(r"(?<!\w)" + re.escape(str(fact)) + r"(?!\w)", text) for fact in references):
            raise StageError("fact_ids debe quedar fuera del texto hablado")
        if (plan.get("kind") != kind or (country and plan.get("country") != country)
                or (region and plan.get("region") != region) or (country and not references)):
            raise StageError("plan debe seguir ranking 8→1 y regiones del dataset con hechos referidos")
        if any(key in plan for key in ("t", "start", "end", "duration", "seconds")):
            raise StageError("El guion no debe crear tiempos estimados")
        total += len(text.split())
    if not 900 <= total <= 1100:
        raise StageError("El guion debe tener entre 900 y 1100 palabras")
    return {"words": total, "segments": len(segments), "structural_checks": True,
            "factual_validation": "requires_supervisor", "editorial_review": "requires_supervisor"}


def choose_agent(policy, status):
    if policy.get("fallback_policy") != "provider_unavailable_only":
        raise StageError("La política Atlas solo admite fallback por proveedor no disponible")
    candidates = []
    for key in ("preferred", "fallback"):
        spec = policy.get(key, {})
        if (not isinstance(spec, dict) or any(not isinstance(spec.get(field), str) or not spec[field].strip()
                for field in ("provider", "model", "reasoning_effort"))):
            raise StageError("La política Atlas requiere provider/model/reasoning_effort explícitos")
        candidates.append({field: spec[field] for field in ("provider", "model", "reasoning_effort")})
    available = {row.get("name") for row in status if row.get("available") is True}
    for index, spec in enumerate(candidates):
        if spec["provider"] in available:
            return {**spec, "requested": candidates[0], "selected": spec, "actual": None,
                    "selection_source": "atlas_orchestration_preferred" if index == 0 else "atlas_orchestration_fallback",
                    "fallback_reason": "preferred_provider_unavailable:" + candidates[0]["provider"] if index else None,
                    "availability": status}
    raise StageError("No hay agente aislado disponible; no se intentará un CLI directo")


def selection_audit(ctx):
    records = []
    for path in sorted(ctx.log.glob("agent-result-*.json")):
        saved = load(checked(path, ctx.log))
        selection = saved.get("selection", {})
        actual = selection.get("actual")
        if actual is None and saved.get("model"):
            actual = {"provider": selection.get("provider"), "model": saved["model"],
                      "reasoning_effort": None, "reasoning_effort_verification": "not_reported_by_adapter"}
        records.append({"result_file": path.name, "ok": saved.get("ok"),
            "requested": selection.get("requested"), "selected": selection.get("selected"),
            "actual": actual, "fallback_reason": selection.get("fallback_reason"),
            "policy_source": selection.get("policy_source"), "policy_sha256": selection.get("policy_sha256"),
            "metadata_complete": all(key in selection for key in ("requested", "selected", "actual", "fallback_reason"))})
    return records


def safe_message(message):
    text = str(message)[:3000]
    text = re.sub(r"(?i)(bearer\s+|(?:api[_-]?key|password|secret|token)\s*[:=]\s*)[^\s\"']+", r"\1[REDACTED]", text)
    return re.sub(r"\b(?:sk-|AIza)[A-Za-z0-9_\-]{16,}", "[REDACTED]", text)


def numeric_usage(raw):
    return {key: value for key, value in raw.items()
            if key in (*TOKEN_FIELDS, "cost_usd") and type(value) in (int, float)
            and math.isfinite(value) and value >= 0}


def normalize_agent_usage(provider, raw):
    normalized = numeric_usage(raw)
    if provider == "claude":
        if "cache_creation_input_tokens" in raw:
            normalized["input_tokens"] = int(raw.get("input_tokens") or 0) + int(raw["cache_creation_input_tokens"] or 0)
        if "cache_read_input_tokens" in raw:
            normalized["cached_input_tokens"] = int(raw["cache_read_input_tokens"] or 0)
        thinking = (raw.get("output_tokens_details") or {}).get("thinking_tokens")
        if type(thinking) is int and thinking >= 0:
            normalized["reasoning_tokens"] = thinking
    return normalized


def agent_usage_metadata(path):
    """Read only numeric result metadata from this episode's own stream; never persist message blocks."""
    if not path.is_file() or path.stat().st_size > 16 * 1024 * 1024:
        return {}
    found = {}
    with path.open(encoding="utf-8") as stream:
        for line in stream:
            try:
                event = json.loads(line)
            except ValueError:
                continue
            if not isinstance(event, dict) or event.get("type") != "result":
                continue
            raw = event.get("usage") or {}
            keys = (*TOKEN_FIELDS, "cache_creation_input_tokens", "cache_read_input_tokens")
            clean = {k: v for k, v in raw.items() if k in keys and type(v) in (int, float) and math.isfinite(v) and v >= 0}
            thinking = (raw.get("output_tokens_details") or {}).get("thinking_tokens")
            if type(thinking) is int and thinking >= 0:
                clean["output_tokens_details"] = {"thinking_tokens": thinking}
            model_keys = ("inputTokens", "outputTokens", "cacheReadInputTokens", "cacheCreationInputTokens", "thinkingTokens", "costUSD")
            models = {name: {k: v for k, v in fields.items() if k in model_keys and type(v) in (int, float)
                            and math.isfinite(v) and v >= 0} for name, fields in (event.get("modelUsage") or {}).items()
                      if isinstance(name, str) and re.fullmatch(r"[a-zA-Z0-9_.:-]{1,120}", name) and isinstance(fields, dict)}
            found = {"usage": clean, "modelUsage": models,
                     **{k: event[k] for k in ("total_cost_usd", "num_turns", "duration_api_ms", "duration_ms")
                        if type(event.get(k)) in (int, float) and math.isfinite(event[k]) and event[k] >= 0}}
    return found


def reconcile_usage(ctx, rows, usage_module=None):
    """Keep canonical history immutable and make the effective audit correction explicit."""
    effective, reconciliations, accounting_ids = [dict(row) for row in rows], [], set()
    indexed = {row.get("event_id"): row for row in effective if row.get("event_id")}
    for path in sorted(ctx.log.glob("agent-*.jsonl")):
        checked(path, ctx.log)
        result_path = ctx.log / path.name.replace("agent-", "agent-result-", 1).replace(".jsonl", ".json")
        checked(result_path, ctx.log)
        if not result_path.is_file():
            continue
        saved = load(result_path)
        row = indexed.get(saved.get("usage_event_id"))
        metadata = agent_usage_metadata(path)
        if not row or row.get("provider") != "claude" or not metadata.get("usage"):
            continue
        normalized = normalize_agent_usage("claude", metadata["usage"])
        if any(row.get(key) != value for key, value in normalized.items()):
            delta = {key: int(normalized.get(key, row.get(key) or 0)) - int(row.get(key) or 0) for key in TOKEN_FIELDS}
            accounting_id = row["event_id"] + "-usage-reconciliation-v1"
            accounting = None
            if all(value >= 0 for value in delta.values()) and any(delta.values()):
                if usage_module is not None:
                    accounting = usage_module.record(ctx.episode, provider="claude", model=row.get("model", ""),
                        role="accounting", step="atlas-usage-reconciliation", seconds=0, ok=True, usage_known=True,
                        event_id=accounting_id, note="Ajuste contable del evento " + row["event_id"] + "; no solicitud IA", **delta)
                existing = accounting or next((e for e in rows if e.get("event_id") == accounting_id), None)
                if existing and not existing.get("record_error") and all(existing.get(key) == value for key, value in delta.items()):
                    accounting_ids.add(accounting_id)
            reconciliations.append({"event_id": row["event_id"], "source": path.name + ":result.usage",
                "canonical_fields": {key: row.get(key) for key in TOKEN_FIELDS}, "effective_fields": normalized,
                "accounting_event_id": accounting_id, "accounting_delta": delta,
                "accounting_persisted": accounting_id in accounting_ids,
                "provider_metadata": metadata,
                "note": "Canonical ledger unchanged. Fresh Claude input includes cache creation; cache reads separate. Thinking is already included in output."})
            row.update(normalized, usage_known=True, usage_reconciled=True)
    return [row for row in effective if row.get("event_id") not in accounting_ids], reconciliations


async def script_stage(ctx, force=False):
    from src.adapters.agent.factory import get_agent
    from src.core.ports.agent_port import AgentScope
    usage = tools_modules()
    import narrate
    data, research, brief = inputs(ctx)
    voice = load(ATLAS / "voice.json")
    script_path = ctx.file("assets/script.json")
    if script_path.exists() and not force:
        metrics = validate_script(load(script_path), data, research, voice, narrate.STYLE)
        return {"ok": True, "reused": True, "script_sha256": digest(script_path), **metrics}
    orchestration = load(ORCHESTRATION)
    if orchestration.get("schema_version") != 1 or orchestration.get("design") != "atlas-cinematico":
        raise StageError("Contrato de orquestación Atlas desconocido")
    selection = choose_agent(orchestration["script_agent"], ctx.status_fn())
    selection.update(policy_source=str(ORCHESTRATION.relative_to(SERVER)), policy_sha256=digest(ORCHESTRATION))
    context = ctx.file("work/agent-context")
    for name, value in (("episode-data.json", data), ("research.json", research), ("brief.json", brief),
                        ("voice.json", voice), ("narrative.json", load(ATLAS / "narrative.json"))):
        write_json(context / name, value, ctx.episode)
    prompt = '''Escribe SOLO assets/script.json en español latinoamericano, sin modificar ningún otro archivo.
Lee únicamente work/agent-context/{episode-data,research,brief,voice,narrative}.json. No leas motores,
otros proyectos, configuración, credenciales ni variables de entorno. No uses red, herramientas externas
ni comandos. Tus herramientas de archivo dentro de este episodio son suficientes.
Redacta un relato entretenido y cercano de 900–1100 palabras, sin relleno, como guía informado.
Abre con un hook concreto, varía transiciones y aporta un contraste verificado por capítulo.
Cierra respondiendo al hook y con una pregunta específica para comentarios, sin tono de informe o tráiler.
Ranking de ocho países de 8 a 1: intro, y por cada país country + insight + dos region; final outro:
exactamente 34 segmentos, aproximadamente 20–40 palabras cada uno. Sigue el orden rank descendente
y las dos primeras regiones de cada país. Los únicos hechos permitidos son los verificados en research.
Menciona nombres y cargos correctos de dirigentes; deja fechas en notas visuales salvo necesidad narrativa.
No atribuyas el PIB al presidente ni al gobierno, ni inventes causas u opiniones políticas.
Explica PIB, métrica, unidad, fuente y año del ranking; llama proyecciones a los datos de 2026.
Incluye datos interesantes y regiones clave con criterio explícito; no afirmes top dos sin evidencia.
Evita poder militar, propaganda, superlativos sin fuente y las palabras PENDIENTE, REEMPLAZAR, TODO.
Cada segmento requiere id único, text, tone (una clave exacta de STYLE indicada abajo), intensity 0..1,
fact_ids (IDs de research, fuera del texto hablado), plan {kind:'intro'|'country'|'insight'|'region'|'outro',
country:'ISO2' para los capítulos del país, region:'id del dataset' solo en region}.
No generes escenas, audio, temporizadores ni tiempos. No hagas autovalidaciones de verdad factual.
Cada afirmación comprobable debe apoyarse en fact_ids. Redondea coherentemente y pronuncia unidades en español.
Lleva las advertencias metodológicas a notas/fuentes si no son necesarias para entender lo hablado.
Objeto raíz: title, language:'es', design:'atlas-cinematico', voice:'Orus', voice_direction STRING
exactamente igual a voice.json.voice.base, segments:[...]. Respeta el perfil narrativo público.
STYLE: ''' + ", ".join(narrate.STYLE)
    run_id = uuid.uuid4().hex
    log_path = checked(ctx.log / ("agent-" + run_id + ".jsonl"), ctx.log)
    write_json(ctx.log / ("selection-" + run_id + ".json"), selection, ctx.log)
    started = time.monotonic()
    try:
        result = await get_agent(selection["provider"]).run(
            prompt, cwd=ctx.episode, log_path=log_path, timeout_seconds=900,
            scope=AgentScope(writable_dir=str(ctx.episode), os_sandbox_dir=str(ctx.episode),
                             model=selection.get("model"), reasoning_effort=selection.get("reasoning_effort")))
    except Exception as exc:
        usage.record(ctx.episode, provider=selection["provider"], model=selection.get("model", ""),
                     role="script", step="atlas-factory", seconds=time.monotonic() - started,
                     ok=False, usage_known=False, note="Factory/run failed: " + type(exc).__name__)
        write_json(ctx.log / ("agent-result-" + run_id + ".json"),
                   {"selection": selection, "error_type": type(exc).__name__, "usage": None}, ctx.log)
        raise StageError("La factoría no pudo ejecutar el agente; revisar el resultado propio del host") from None
    selection["actual"] = {"provider": selection["provider"], "model": result.model or None,
                           "reasoning_effort": None, "reasoning_effort_verification": "not_reported_by_adapter"}
    raw_usage = normalize_agent_usage(selection["provider"], result.usage)
    provider_metadata = agent_usage_metadata(log_path)
    entry = usage.record(ctx.episode, provider=selection["provider"], model=result.model or selection.get("model", ""),
                         role="script", step="atlas-factory", seconds=result.duration_seconds, ok=result.ok,
                         usage_known=bool(result.usage), **raw_usage)
    report = {"selection": selection, "exit_code": result.exit_code, "ok": result.ok,
              "timed_out": result.timed_out, "duration_seconds": result.duration_seconds,
              "model": result.model, "usage": raw_usage if result.usage else None,
              "provider_metadata": provider_metadata,
              "usage_known": bool(result.usage), "usage_event_id": entry["event_id"],
              "last_message": safe_message(result.last_message)}
    write_json(ctx.log / ("agent-result-" + run_id + ".json"), report, ctx.log)
    private_tree(ctx.episode)
    if not result.ok:
        raise StageError("El agente aislado falló; disponibilidad no demuestra autenticación")
    if not script_path.is_file():
        raise StageError("El agente terminó sin assets/script.json")
    metrics = validate_script(load(script_path), data, research, voice, narrate.STYLE)
    return {"ok": True, "reused": False, "selection": selection,
            "script_sha256": digest(script_path), "usage_event_id": entry["event_id"], **metrics}


def extract_tts_usage(response):
    raw = response.get("usageMetadata") or response.get("usage") or {}
    allowed = {"promptTokenCount", "cachedContentTokenCount", "candidatesTokenCount", "thoughtsTokenCount",
               "totalTokenCount", "total_input_tokens", "total_cached_tokens", "total_output_tokens",
               "total_thought_tokens", "total_tokens"}
    raw = {k: v for k, v in raw.items() if k in allowed and type(v) in (int, float)
           and math.isfinite(v) and v >= 0}
    mapping = {"promptTokenCount": "total_input_tokens", "cachedContentTokenCount": "total_cached_tokens",
               "candidatesTokenCount": "total_output_tokens", "thoughtsTokenCount": "total_thought_tokens",
               "totalTokenCount": "total_tokens"}
    normalized = {key: raw.get(key, raw.get(alias)) for key, alias in mapping.items()
                  if key in raw or alias in raw}
    return raw, normalized


def audio_duration(path):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "json", str(path)], capture_output=True, text=True, check=True, timeout=30)
    value = float(json.loads(result.stdout)["format"]["duration"])
    if not math.isfinite(value) or value <= 0:
        raise StageError("Duración de audio inválida")
    return round(value, 3)


def voice_stage(ctx, force=False):
    usage = tools_modules()
    import narrate
    import tts
    data, research, _ = inputs(ctx)
    profile = load(ATLAS / "voice.json")
    script_path, out = ctx.file("assets/script.json"), ctx.file("assets/song")
    metrics = validate_script(load(script_path), data, research, profile, narrate.STYLE)
    mp3, wav = out.with_suffix(".mp3"), out.with_suffix(".wav")
    previous, script_hash = ctx.previous("voice"), digest(script_path)
    review_path = ctx.file("work/results/test/editorial-review.json")
    review = load(review_path) if review_path.is_file() else {}
    if review.get("approved_for_tts") is not True or review.get("script_sha256") != script_hash:
        raise StageError("Se requiere editorial-review.json aprobado para TTS y vinculado al hash del guion actual")
    if (mp3.exists() or wav.exists()) and not force:
        if (mp3.is_file() and wav.is_file() and previous.get("ok")
                and previous.get("script_sha256") == script_hash and previous.get("audio_sha256") == digest(mp3)):
            return {**previous, "reused": True}
        raise StageError("Ya existe audio sin checkpoint compatible; revisar o usar --force explícito")
    old_post, old_record, old_argv = tts._post, usage.record, sys.argv
    old_state, old_env, old_video = tts.STATE, tts.ENV_FILES, narrate.VIDEO_DIR
    captures, event_ids = [], []
    def post(*args, **kwargs):
        tts.LAST_USAGE.clear()
        response = old_post(*args, **kwargs)
        raw, normalized = extract_tts_usage(response)
        tts.LAST_USAGE.clear()
        tts.LAST_USAGE.update(normalized)
        captures.append({"at": utc(), "raw": raw or None, "normalized": normalized or None,
                         "usage_known": bool(raw)})
        return response
    def record(*args, **kwargs):
        kwargs.update(cached_input_tokens=tts.LAST_USAGE.get("cachedContentTokenCount"),
                      usage_known=bool(tts.LAST_USAGE) if kwargs.get("ok") else False,
                      note="Single-part TTS" if kwargs.get("ok") else "TTS failed; details suppressed")
        entry = old_record(*args, **kwargs)
        event_ids.append(entry["event_id"])
        return entry
    started = time.monotonic()
    try:
        tts._post, usage.record = post, record
        tts.STATE, tts.ENV_FILES = ctx.log / "gemini-quota.json", [SERVER / ".env"]
        sys.argv = ["narrate.py", str(script_path), str(out), "--design", str(ATLAS / "voice.json"),
                    "--voice", "Orus", "--model", profile["voice"]["models"][0], "--parts", "1", "--no-qc"]
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            narrate.main()
    except (Exception, SystemExit) as exc:
        raise StageError("La voz falló: " + type(exc).__name__ + "; no se ejecutó Whisper ni otra vía de síntesis") from None
    finally:
        tts._post, usage.record, sys.argv = old_post, old_record, old_argv
        tts.STATE, tts.ENV_FILES, narrate.VIDEO_DIR = old_state, old_env, old_video
        write_json(ctx.log / ("voice-provider-usage-" + uuid.uuid4().hex + ".json"),
                   {"at": utc(), "responses": captures, "usage_event_ids": event_ids}, ctx.log)
    if not mp3.is_file() or not wav.is_file():
        raise StageError("La síntesis no produjo ambos WAV y MP3")
    duration = audio_duration(mp3)
    return {"ok": True, "reused": False, "script_sha256": script_hash, "audio_sha256": digest(mp3),
            "wav_sha256": digest(wav), "duration_seconds": duration, "wav_duration_seconds": audio_duration(wav),
            "seconds": round(time.monotonic() - started, 2), "words": metrics["words"],
            "wpm": round(metrics["words"] * 60 / duration, 2), "usage_event_ids": event_ids,
            "provider_responses": len(captures), "qc": "separate_transcribe_stage"}


def transcribe_stage(ctx, force=False):
    usage = tools_modules()
    import transcribe
    audio, lyrics = ctx.file("assets/song.mp3"), ctx.file("assets/lyrics.json")
    raw_path = ctx.file("work/results/test/transcript-raw.json")
    if not audio.is_file():
        raise StageError("Falta el MP3 final")
    audio_hash, previous = digest(audio), ctx.previous("transcribe")
    if (lyrics.exists() or raw_path.exists()) and not force:
        if (lyrics.is_file() and raw_path.is_file() and previous.get("ok")
                and previous.get("audio_sha256") == audio_hash
                and load(lyrics).get("metadata", {}).get("audio_sha256") == audio_hash):
            return {**previous, "reused": True}
        raise StageError("La transcripción existente no corresponde al audio; revisar o usar --force")
    from faster_whisper import WhisperModel
    from faster_whisper.utils import download_model
    try:
        model_path = download_model("large-v3", local_files_only=True)
    except Exception:
        raise StageError("Whisper large-v3 no está en caché; no se descargó ningún modelo") from None
    script = load(ctx.file("assets/script.json"))
    reference = " ".join(s["text"] for s in script["segments"])
    names = ", ".join(sorted(set(re.findall(r"\b[A-ZÁÉÍÓÚ][a-záéíóúñ]+", reference))))[:400]
    duration, started = audio_duration(audio), time.monotonic()
    model = WhisperModel(model_path, device="cpu", compute_type="int8", cpu_threads=2,
                         num_workers=1, local_files_only=True)
    segments, info = model.transcribe(str(audio), language="es", word_timestamps=True,
        beam_size=5, vad_filter=True, condition_on_previous_text=False,
        initial_prompt="Documental narrado en español. Nombres: " + names)
    raw = []
    for segment in segments:
        raw.append({"start": segment.start, "end": segment.end, "text": segment.text,
                    "words": [{"word": w.word, "start": w.start, "end": w.end, "probability": w.probability}
                              for w in (segment.words or [])]})
    del model
    metadata = {"source": audio.name, "audio_sha256": audio_hash, "model": "faster-whisper large-v3",
                "language": "es", "duration": duration, "whisper_duration": info.duration,
                "device": "cpu", "compute_type": "int8", "cpu_threads": 2, "num_workers": 1}
    ctx.save("work/results/test/transcript-raw.json", {"metadata": metadata, "segments": raw})
    if not raw or not any(s["words"] for s in raw):
        raise StageError("Whisper no devolvió palabras; se conservó la salida cruda")
    cleaned = copy.deepcopy(raw)
    merged = transcribe.merge_split_numbers(cleaned)
    # Keep real recognized words. clean_with_script can insert/relabel words; do not use it as QC evidence.
    ctx.save("assets/lyrics.json", {"metadata": {**metadata, "merged_split_numbers": merged,
             "script_alignment_applied": False, "qc_status": "requires_supervisor_raw_audio_review"}, "segments": cleaned})
    words = sum(len(s["words"]) for s in raw)
    elapsed = time.monotonic() - started
    event = usage.record(ctx.episode, provider="whisper", model="large-v3", role="transcribe",
                         step="atlas-factory", seconds=elapsed, usage_known=False,
                         note="Local CPU int8, two threads; no token meter")
    return {"ok": True, "reused": False, "audio_sha256": audio_hash, "duration_seconds": duration,
            "words": words, "wpm": round(words * 60 / duration, 2), "seconds": round(elapsed, 2),
            "usage_event_id": event["event_id"], "billing": "local", "tokens": None,
            "qc": "raw_preserved; normalized numbers/acronyms diff and listening require supervisor"}


def usage_report(rows):
    providers = {}
    normalized = []
    for row in rows:
        provider = row.get("provider", "unknown")
        known = row.get("usage_known") is True
        item = {**row, **{key: row.get(key) if known else None for key in TOKEN_FIELDS}}
        fresh = item["input_tokens"]
        if known and provider == "codex":
            fresh = max(0, (fresh or 0) - (item["cached_input_tokens"] or 0))
        item["fresh_input_tokens"] = fresh
        normalized.append(item)
        bucket = providers.setdefault(provider, {"calls": 0, "known_calls": 0, "unknown_calls": 0,
                       "seconds": 0.0, **{key: None for key in (*TOKEN_FIELDS, "fresh_input_tokens", "input_plus_output_tokens")}})
        bucket["calls"] += 1
        bucket["known_calls" if known else "unknown_calls"] += 1
        bucket["seconds"] = round(bucket["seconds"] + float(row.get("seconds") or 0), 2)
        if known:
            for key in (*TOKEN_FIELDS, "fresh_input_tokens"):
                bucket[key] = (bucket[key] or 0) + (item.get(key) or 0)
            bucket["input_plus_output_tokens"] = bucket["input_tokens"] + bucket["output_tokens"]
    known = [row for row in normalized if row.get("usage_known") is True]
    totals = {key: sum(row.get(key) or 0 for row in known) if known else None
              for key in (*TOKEN_FIELDS, "fresh_input_tokens")}
    totals["fresh_input_plus_output_tokens"] = (totals["fresh_input_tokens"] + totals["output_tokens"]) if known else None
    return {"entries": normalized, "by_provider": providers, "known_totals": totals,
            "unknown_calls": sum(row.get("usage_known") is not True for row in normalized),
            "accounting": "Known calls only. Codex fresh=input-cached; Claude fresh=input. Cache is not added to totals. "
                          "Input+output is a descriptive count, not a universal billed-token total. Reasoning is retained separately "
                          "and never added to output here. Unknown usage remains null and counted separately."}


def audit(ctx):
    usage = tools_modules()
    final = snapshot(ctx)
    initial_path = ctx.file("work/results/test/initial.json")
    initial = load(initial_path) if initial_path.is_file() else {}
    required = ["index.html", "info.json", "research.json", "assets/episode-data.json", "work/brief.json",
                "assets/config.json", "assets/script.json", "assets/song.wav", "assets/song.mp3",
                "assets/lyrics.json", "assets/scene.json", "work/results/test/transcript-raw.json"]
    checks = {"required_files": {name: ctx.file(name).is_file() for name in required},
              "initial_snapshot": bool(initial),
              "shared_files_unchanged": bool(initial) and all(final["shared_hashes"].values())
              and initial.get("shared_hashes") == final["shared_hashes"]}
    pending = ["Revisión factual/editorial del supervisor y escucha de omisiones reales",
               "Composición/validación de escenas y revisión visual; no ejecutadas por este controlador",
               "Atlas Cinemático aún no integra NATIVE_DESIGNS del backend; esta CLI es integración host independiente",
               "Una corrida no demuestra costo mínimo global ni validación completa de la fábrica"]
    durations = {}
    for name in ("song.wav", "song.mp3"):
        path = ctx.file("assets/" + name)
        durations[name] = audio_duration(path) if path.is_file() else None
    script_metrics = None
    if ctx.file("assets/script.json").is_file():
        try:
            import narrate
            data, research, _ = inputs(ctx)
            script_metrics = validate_script(load(ctx.file("assets/script.json")), data, research,
                                             load(ATLAS / "voice.json"), narrate.STYLE)
            checks["script_contract"] = True
        except (StageError, ValueError, KeyError, TypeError):
            checks["script_contract"] = False
    audio_hash = digest(ctx.file("assets/song.mp3"))
    for label, relative in (("lyrics_match_audio", "assets/lyrics.json"),
                            ("raw_matches_audio", "work/results/test/transcript-raw.json")):
        path = ctx.file(relative)
        checks[label] = bool(audio_hash and path.is_file()
                             and load(path).get("metadata", {}).get("audio_sha256") == audio_hash)
    canonical_rows = usage.entries(ctx.episode)
    effective_rows, reconciliations = reconcile_usage(ctx, canonical_rows, usage)
    canonical_rows = usage.entries(ctx.episode)
    consumption = usage_report(effective_rows)
    accounting = [row for row in canonical_rows if row.get("role") == "accounting" and row.get("step") == "atlas-usage-reconciliation"]
    consumption.update(canonical_entries=canonical_rows, reconciliations=reconciliations, accounting_entries=accounting,
                       call_counts={"model_or_agent": sum(row.get("provider") not in ("kit", "whisper") for row in effective_rows),
                                    "local_stages": sum(row.get("provider") in ("kit", "whisper") for row in effective_rows),
                                    "accounting_events": len(accounting)})
    report = {"ok": True, "preparation_complete": False, "checks": checks, "pending": pending,
              "durations": durations, "script_metrics": script_metrics,
              "usage": consumption, "snapshot": final, "agent_selections": selection_audit(ctx),
              "current_script_agent_policy": {"source": str(ORCHESTRATION.relative_to(SERVER)),
                  "sha256": digest(ORCHESTRATION), "policy": load(ORCHESTRATION)["script_agent"],
                  "applies_to_future_calls_only": True}}
    ctx.save("work/results/test/final.json", report)
    ctx.save("usage-report.json", report["usage"])
    return {"ok": True, "preparation_complete": False, "required_files_present": sum(checks["required_files"].values()),
            "required_files_total": len(required), "shared_files_unchanged": checks["shared_files_unchanged"],
            "report": "work/results/test/final.json", "usage": report["usage"]["by_provider"], "pending": pending}


def self_test():
    """Synthetic host smoke: no settings, agent, TTS, Whisper or credentials."""
    from tempfile import TemporaryDirectory
    with TemporaryDirectory(prefix="atlas-factory-smoke-", dir="/tmp") as tmp:
        root = Path(tmp)
        layout = SimpleNamespace(root=root, sandbox_dir=root / "sandbox", logs_dir=root / "logs", schema_version=3)
        ctx = Context(layout, {"id": "synthetic", "schema_version": 3}, "demo", status_fn=lambda: [
                      {"name": "codex", "available": False}, {"name": "claude", "available": True}])
        ctx.log.mkdir(parents=True, mode=0o700)
        initialize(ctx)
        assert load(ctx.file("info.json"))["design"] == "atlas-cinematico"
        info = load(ctx.file("info.json"))
        assert {"version", "title", "summary", "engine", "based_on", "is_new_design", "status",
                "created_at", "libraries", "inputs", "notes"} <= info.keys()
        assert info["status"] == "en progreso" and dt.date.fromisoformat(info["created_at"])
        assert "src=\"/api/v1/explainer/files/bundled/sandbox/_proto/proto.js\"" in ctx.file("index.html").read_text()
        try:
            initialize(ctx)
            raise AssertionError("init overwrote existing episode")
        except StageError:
            pass
        policy = load(ORCHESTRATION)["script_agent"]
        selected = choose_agent(policy, ctx.status_fn())
        assert selected["model"] == "claude-haiku-5-5" and selected["reasoning_effort"] == "medium"
        assert selected["requested"]["model"] == "gpt-6.1-terra" and selected["fallback_reason"]
        preferred = choose_agent(policy, [{"name": "codex", "available": True}, {"name": "claude", "available": True}])
        assert preferred["provider"] == "codex" and preferred["model"] == "gpt-6.1-terra"
        assert preferred["reasoning_effort"] == "high" and preferred["fallback_reason"] is None
        try:
            choose_agent(policy, [{"name": "codex", "available": False}, {"name": "claude", "available": False}])
            raise AssertionError("Unavailable providers accepted")
        except StageError:
            pass
        raw, normalized = extract_tts_usage({"usage": {"total_input_tokens": 12, "total_output_tokens": 4,
                        "total_cached_tokens": 2, "total_thought_tokens": 1, "total_tokens": 17}, "audio": "omitted"})
        assert normalized["promptTokenCount"] == 12 and normalized["candidatesTokenCount"] == 4 and "audio" not in raw
        report = usage_report([{"provider": "codex", "usage_known": True, "input_tokens": 12,
                    "cached_input_tokens": 7, "output_tokens": 4, "reasoning_tokens": 3},
                              {"provider": "claude", "usage_known": False, "input_tokens": 0}])
        assert report["by_provider"]["codex"]["fresh_input_tokens"] == 5
        assert report["by_provider"]["codex"]["input_plus_output_tokens"] == 16
        assert report["by_provider"]["claude"]["input_tokens"] is None
        claude = normalize_agent_usage("claude", {"input_tokens": 8, "cache_creation_input_tokens": 81490,
            "cache_read_input_tokens": 130803, "output_tokens": 54595, "output_tokens_details": {"thinking_tokens": 46314}})
        assert claude == {"input_tokens": 81498, "cached_input_tokens": 130803,
                          "output_tokens": 54595, "reasoning_tokens": 46314}
        try:
            Context(layout, {}, "../escape")
            raise AssertionError("traversal accepted")
        except StageError:
            pass
        ctx.file("escape").symlink_to(root / "outside")
        try:
            ctx.file("escape")
            raise AssertionError("symlink accepted")
        except StageError:
            pass
        ctx.episode.joinpath("escape").unlink()
        assert ctx.file("info.json").stat().st_mode & 0o777 == 0o600
    return {"ok": True, "mode": "synthetic", "checks": ["profile_paths", "init_exclusive", "wrapper_urls",
            "role_fallback", "tts_usage_normalization", "unknown_usage", "cache_accounting", "traversal", "symlink", "permissions"],
            "not_exercised": ["remote host", "authentication", "agent execution", "TTS", "Whisper", "render"]}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("stage", nargs="?", choices=["init", "run-script", "voice", "transcribe", "audit"])
    parser.add_argument("--episode")
    parser.add_argument("--category", default="nodeatlas")
    parser.add_argument("--title", default="")
    parser.add_argument("--force", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if args.self_test:
        print(json.dumps(self_test(), ensure_ascii=False))
        return 0
    if not args.stage or not args.episode:
        parser.error("stage y --episode son obligatorios")
    if args.force and args.stage not in ("run-script", "voice", "transcribe"):
        parser.error("--force solo aplica a run-script, voice o transcribe")
    sys.path.insert(0, str(SERVER))
    sys.dont_write_bytecode = True
    ctx, lock_owned = None, False
    started = time.monotonic()
    try:
        from src.config.settings import settings
        from src.config.profile_layout import layout_for_settings
        layout = layout_for_settings(settings)
        if not settings.storage_profile_dir:
            raise StageError("Selecciona un perfil v2/v3; no se admiten rutas legacy")
        manifest_path = layout.root / "profile.json"
        manifest = load(manifest_path)
        if manifest["id"] != settings.storage_profile_id or manifest["schema_version"] != layout.schema_version:
            raise StageError("El manifiesto no coincide con el perfil efectivo del proceso")
        profile = {"id": manifest["id"], "schema_version": manifest["schema_version"],
                   "manifest_sha256": digest(manifest_path), "real_root": str(layout.root.resolve())}
        ctx = Context(layout, profile, args.episode, args.category, args.title)
        ctx.log.mkdir(parents=True, exist_ok=True, mode=0o700)
        checked(ctx.log / "run.lock", ctx.log)
        with (ctx.log / "run.lock").open("a") as lock:
            try:
                fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
                lock_owned = True
            except BlockingIOError:
                raise StageError("Otra etapa está activa para este episodio") from None
            if args.stage != "init":
                ctx.require()
            if args.stage == "init":
                result = initialize(ctx)
            elif args.stage == "run-script":
                result = asyncio.run(script_stage(ctx, args.force))
            elif args.stage == "voice":
                result = voice_stage(ctx, args.force)
            elif args.stage == "transcribe":
                result = transcribe_stage(ctx, args.force)
            else:
                result = audit(ctx)
            result["host_seconds"] = round(time.monotonic() - started, 2)
            ctx.checkpoint(args.stage, result)
            private_tree(ctx.episode)
            private_tree(ctx.log)
            print(json.dumps({"stage": args.stage, **result}, ensure_ascii=False))
            return 0
    except Exception as exc:
        failure = {"ok": False, "error": str(exc) if isinstance(exc, StageError) else type(exc).__name__,
                   "host_seconds": round(time.monotonic() - started, 2)}
        if ctx is not None and lock_owned and ctx.log.is_dir():
            try:
                ctx.checkpoint(args.stage, failure)
            except Exception:
                pass
        print(json.dumps({"stage": args.stage, **failure}, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())

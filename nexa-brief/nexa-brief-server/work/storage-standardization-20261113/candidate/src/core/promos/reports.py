"""Informe de sesión y evidencia sin duplicar instrucciones compartidas."""

from __future__ import annotations
import json
import os
import re
import tempfile
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from src.config.content_paths import sandbox_root
from src.config.profile_layout import layout_for_settings
from src.config.settings import settings
from src.core.explainer.agent_context import _safe


def _text(value):
    if value is None:
        return "null"
    if isinstance(value, (dict, list)):
        value = json.dumps(value, ensure_ascii=False, sort_keys=True)
    return str(value).replace("\n", " ").replace("\r", " ").replace("|", "\\|")[:2000]


def _url(value):
    try:
        parsed = urlsplit(value or "")
        if parsed.scheme not in ("http", "https") or not parsed.hostname or parsed.username or parsed.password:
            return "sin dato"
        query = urlencode(
            [
                (k, "[redactado]" if re.search(r"token|secret|key|signature|password|credential|auth", k, re.I) else v)
                for k, v in parse_qsl(parsed.query, keep_blank_values=True)
            ]
        )
        return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, ""))
    except (TypeError, ValueError):
        return "sin dato"


def _write(path: Path, text: str):
    if path.is_symlink():
        raise ValueError("El informe no admite enlaces simbólicos")
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.is_file() and path.read_text(encoding="utf-8") == text:
        return
    fd, tmp = tempfile.mkstemp(prefix=".promo-report-", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            stream.write(text)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def _json(root, *parts):
    try:
        path = _safe(root, *parts)
        if not path.is_file() or path.stat().st_size > 2_000_000:
            return None
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError, TypeError):
        return None


def _target(project, sid, revision):
    ref = _json(project, "work", "content.json")
    sibling = f"{sid}-r{revision}"
    if not isinstance(ref, dict) or ref.get("project_id") != sibling or ref.get("revision") != revision:
        return None
    target = _safe(sandbox_root(), "nodemotion", sibling)
    return target if target.is_dir() else None


def _resource_rows(target):
    if target is None:
        return []
    plan, music = _json(target, "media-plan.json"), _json(target, "music.json")
    uses = []
    for item in plan.get("items", []) if isinstance(plan, dict) else []:
        if isinstance(item, dict) and item.get("kind") in ("image", "video"):
            uses.append((item.get("kind"), item.get("asset_id")))
    if isinstance(music, dict):
        uses.append(("music", music.get("asset_id")))
    result, seen = [], set()
    root = layout_for_settings(settings).resources_dir
    for kind, ident in uses:
        if not isinstance(ident, str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,127}", ident):
            continue
        if (kind, ident) in seen:
            continue
        seen.add((kind, ident))
        folder = {"image": "images", "video": "videos", "music": "music"}[kind]
        record = _json(root, folder, ident, "resource.json")
        if not isinstance(record, dict) or record.get("id") != ident:
            result.append({"id": ident, "type": kind})
        else:
            result.append(record)
    return result


def _review(row, project, target):
    # Los comentarios solo corresponden al draft y la huella revisados en ese momento.
    review = _json(project, "work", "orchestrator-review.json")
    if review is None and target is not None:
        review = _json(target, "work", "orchestrator-review.json")
    if not isinstance(review, dict) or not row.get("draft_id") or not row.get("review_fingerprint"):
        return None
    if review.get("draft_id") != row["draft_id"] or review.get("fingerprint") != row["review_fingerprint"]:
        return None
    try:
        from src.core.data import collection
        from src.core.promos.readiness import snapshot_fingerprint

        draft = collection("drafts").get(row["draft_id"])
        if not draft or snapshot_fingerprint(draft) != review["fingerprint"]:
            return None
    except (OSError, ValueError, KeyError, TypeError):
        return None
    return review


def write_report(row: dict, project: Path):
    sid, revision = row.get("session_id"), row.get("revision")
    if not isinstance(sid, str) or not re.fullmatch(r"[a-f0-9]{32}", sid) or type(revision) is not int or revision < 1:
        raise ValueError("Identidad de sesión inválida")
    expected = _safe(sandbox_root(), "nodemotion", sid)
    project = Path(project)
    if project != expected or project.is_symlink():
        raise ValueError("El informe no pertenece a la sesión del perfil")
    project.mkdir(parents=True, exist_ok=True)
    target = _target(project, sid, revision)
    quality = row.get("quality") if isinstance(row.get("quality"), dict) else {}
    usage = row.get("usage") if isinstance(row.get("usage"), dict) else {"steps": [], "totals": {}}
    steps = [x for x in (usage.get("steps") or []) if isinstance(x, dict)]
    ref = row.get("prompt_ref") or {}
    brief = _json(target, "brief.json") if target else None
    research = _json(target, "work", "research", "research.json") if target else None
    review = _review(row, project, target)
    criteria = review.get("criteria", {}) if review and isinstance(review.get("criteria"), dict) else {}
    draft_id = row.get("draft_id")
    link = (
        f"/api/v1/drafts/{draft_id}"
        if isinstance(draft_id, str) and re.fullmatch(r"[A-Za-z0-9_-]{1,128}", draft_id)
        else "sin dato"
    )
    unresolved = [str(x) for x in (quality.get("errors") or [])]
    if row.get("error"):
        unresolved.insert(0, str(row["error"]))
    if not review or any(
        not isinstance(criteria.get(key), str) or not criteria[key].strip()
        for key in ("relleno", "cifras", "medios", "texto", "miniaturas", "creditos")
    ):
        unresolved.append(
            "Revisión del orquestador de fuentes, medios, texto, miniaturas y licencias pendiente o sin evidencia vigente."
        )
    if row.get("approved_revision") != revision or row.get("state") != "ready":
        unresolved.append("Aprobación humana de esta revisión pendiente.")
    if quality.get("passed") is not True:
        unresolved.append("La puerta técnica no consta aprobada.")
    lines = [
        "# Informe: " + _text((brief or {}).get("name") if isinstance(brief, dict) else row.get("template_id")),
        "",
        f"{_text(sid)} · {_text(row.get('template_id'))} · duración: {_text((brief or {}).get('duration_seconds') if isinstance(brief, dict) else None)} s · Estado: {_text(row.get('state'))} · {_text(row.get('updated_at'))}",
        f"Ver: {link}",
        f"Revisión: {_text(revision)} · draft: {_text(draft_id)} · etapa: {_text(row.get('stage'))} · etapa fallida: {_text(row.get('failed_stage'))}",
        f"Creación: {_text(row.get('created_at'))} · proveedor: {_text(row.get('provider'))}",
        f"Prompts de sesión: {_text(ref.get('version'))} · hashes: {_text(ref.get('hashes'))}",
        f"Referencia comprobada del draft importado: {_text(row.get('source_prompt_ref')) if 'source_prompt_ref' in row else 'no aplica'}",
        "",
        "## Lo que no se cumplió",
        "",
    ]
    lines += [f"- {_text(item)}" for item in unresolved] if unresolved else ["- Nada informado."]
    lines += [
        "",
        "## 1. Consumo de modelos",
        "",
        "Valores `null`: sin dato. Costes y su base no son una factura.",
        "",
        "| Etapa | Proveedor | Modelo | Esfuerzo | Resultado | Entrada | Caché | Salida | Razonamiento | Total | Segundos | Coste USD | Base del coste |",
        "|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ]
    fields = (
        "stage",
        "provider",
        "model",
        "reasoning_effort",
        "ok",
        "input_tokens",
        "cached_input_tokens",
        "output_tokens",
        "reasoning_tokens",
        "total_tokens",
        "seconds",
        "cost_usd",
        "cost_basis",
    )
    lines += ["| " + " | ".join(_text(item.get(k)) for k in fields) + " |" for item in steps if item.get("model")]
    lines += [
        "",
        "Totales y subtotales conocidos: `" + _text(usage.get("totals")) + "`.",
        "Orquestador y coste adicionales: sin dato cuando no están registrados.",
        "",
        "## 2. Búsquedas y descargas",
        "",
        "| Proveedor | Búsquedas | Descargas | Segundos registrados |",
        "|---|---:|---:|---:|",
    ]
    activity = {}
    for item in steps:
        stage = str(item.get("stage") or item.get("step") or "").lower()
        category = (
            "search" if "search" in stage else "download" if "download" in stage or stage == "research-fetch" else None
        )
        if category and item.get("provider") and item.get("provider") != "local":
            group = activity.setdefault(
                str(item["provider"]), {"search": 0, "download": 0, "times": [], "unknown": False}
            )
            group[category] += 1
            seconds = item.get("seconds")
            if isinstance(seconds, (int, float)) and not isinstance(seconds, bool) and seconds >= 0:
                group["times"].append(seconds)
            else:
                group["unknown"] = True
    for provider, group in sorted(activity.items()):
        seconds = None if group["unknown"] or not group["times"] else sum(group["times"])
        lines.append(
            f"| {_text(provider)} | {_text(group['search'] or None)} | {_text(group['download'] or None)} | {_text(seconds)} |"
        )
    if not activity:
        lines.append("| sin dato | null | null | null |")
    lines += [
        "",
        "## 3. Recursos usados",
        "",
        "| ID | Tipo | Qué muestra | Fuente | Autor | Licencia |",
        "|---|---|---|---|---|---|",
    ]
    resources = _resource_rows(target)
    for item in resources:
        lines.append(
            "| "
            + " | ".join(
                _text(_url(item.get(k)) if k == "source_url" else item.get(k))
                for k in ("id", "type", "name", "source_url", "author", "license")
            )
            + " |"
        )
    if not resources:
        lines.append("| sin dato | null | null | null | null | null |")
    lines += [
        "",
        "Descartados y motivos: sin dato salvo que consten en la evidencia del contenido.",
        "",
        "## 4. Datos y fuentes",
        "",
    ]
    findings = research.get("findings", []) if isinstance(research, dict) else []
    for finding in findings:
        if not isinstance(finding, dict):
            continue
        lines.append(f"- {_text(finding.get('claim'))}")
        for source in finding.get("sources", []):
            if isinstance(source, dict):
                lines.append(
                    f"  - {_text(source.get('title'))}: {_text(_url(source.get('url')))}; fecha del dato {_text(source.get('data_date'))}; consulta {_text(source.get('accessed_at'))}"
                )
    if not findings:
        lines.append("- Investigación estructurada: sin dato.")
    if isinstance(research, dict):
        for item in research.get("discarded", []):
            lines.append(f"- Descartado: {_text(item)}")
    for doc in row.get("source_context") or []:
        if not isinstance(doc, dict):
            continue
        url = doc.get("url")
        try:
            parsed = urlsplit(url or "")
        except ValueError:
            continue
        if parsed.scheme in ("https", "http") and parsed.hostname and not parsed.username and not parsed.password:
            lines.append(
                f"- Documento consultado {_text(doc.get('title') or doc.get('provider'))}: {_text(_url(url))}; consulta {_text(doc.get('accessed_at'))}"
            )
    lines += [
        "",
        "## 5. Puerta de calidad",
        "",
        f"Comprobaciones técnicas: {_text(quality.get('passed'))}; no certifican por sí solas fuentes, licencias ni revisión visual.",
        f"Aprobación humana de revisión: {_text(row.get('approved_revision'))}.",
        "",
    ]
    dimensions = [
        ("relleno", "Relleno"),
        ("cifras", "Cifras y fechas"),
        ("medios", "Medios"),
        ("texto", "Texto en pantalla"),
        ("miniaturas", "Miniaturas"),
        ("creditos", "Créditos y licencias"),
    ]
    for index, (key, label) in enumerate(dimensions, 1):
        value = criteria.get(key)
        observation = _text(value) if isinstance(value, str) and value.strip() else "pendiente de revisión documentada"
        lines.append(f"{index}. {label}: {observation}.")
    if review:
        lines += [
            "",
            "Observaciones del orquestador asociadas al draft y huella vigentes; no constituyen aprobación humana.",
        ]
    for check in quality.get("checks") or []:
        lines.append(f"- Control técnico: {_text(check)}")
    for warning in quality.get("warnings") or []:
        lines.append(f"- Advertencia técnica: {_text(warning)}")
    lines += ["", "## 6. Decisiones y siguientes pasos", ""]
    if review and review.get("decisions"):
        lines.append("- Decisiones documentadas: " + _text(review["decisions"]))
    else:
        lines.append("- Decisiones del orquestador: sin dato.")
    lines.append(
        "- La persona debe revisar evidencias y decidir la aprobación vigente; grabar o publicar requiere instrucción adicional."
    )
    lines += [
        "",
        "## 7. Archivos",
        "",
        "- Sesión: `work/content.json`, `work/quality.json`, `use_tokens/usage.json`.",
        "- Contenido: `brief.json`, `work/guion.json`, `work/research/research.json`, `work/research/research.md`, `media-plan.json`, `logs/usage.jsonl`, `work/results/`.",
        "- Resultado de cada pasada y capturas: consultar `logs/` y `work/results/`; ausencia de archivo significa sin dato.",
        "",
    ]
    text = "\n".join(lines)
    _write(_safe(project, "INFORME.md"), text)
    _write(_safe(project, "work", "informes", f"{revision}.md"), text)
    if target is not None:
        _write(_safe(target, "INFORME.md"), text)
        _write(
            _safe(target, "use_tokens", "usage.json"),
            json.dumps(usage, ensure_ascii=False, indent=2, sort_keys=True) + "\n",
        )

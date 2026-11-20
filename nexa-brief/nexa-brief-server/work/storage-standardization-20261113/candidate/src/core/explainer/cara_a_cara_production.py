"""Host adapter for Cara a Cara episodes; all authored data stays in the profile.

Uses the persistent producer, isolated file-only runner, stock broker and existing
narration/transcription tools. The shared renderer and character sheets are linked
through public HTTP URLs, never copied into an episode or exposed to the agent.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import math
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from src.config.settings import settings

DESIGN = "cara-a-cara"
PROFILE = "leo-comparaciones-v1"
CHARACTERS = {"alma", "leo", "nara", "lia", "nora-vega"}


def _json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


PUBLICATION_LIMITS = {
    "youtube_title": 100, "youtube_description": 400,
    "instagram_title": 100, "instagram_description": 280,
    "facebook_title": 100, "facebook_description": 280,
    "tiktok_caption": 100,
}


def _publication_errors(root):
    try:
        value = json.loads((root / "publish.json").read_text())
    except (OSError, ValueError):
        return ["Falta publish.json con textos por plataforma"]
    if not isinstance(value, dict):
        return ["publish.json debe ser un objeto"]
    errors = []
    for field, limit in PUBLICATION_LIMITS.items():
        text = value.get(field)
        if not isinstance(text, str) or not text.strip():
            errors.append(f"Falta {field} antes de preparar la voz")
        elif len(text.strip()) > limit:
            errors.append(f"{field} supera el límite editorial de {limit} caracteres")
        elif not re.sub(r"https?://\S+", "", text).strip():
            errors.append(f"{field} contiene solo fuentes; falta texto de publicación")
    return errors


def _script_review_pending(root):
    path = root / "work/script-review.json"
    if not path.exists():
        return False
    value = json.loads(path.read_text())
    return value.get("status") != "approved"


def identity(character_id):
    if character_id not in CHARACTERS:
        raise ValueError("Cara a Cara requiere un character_id registrado")
    base = settings.templates_dir / "nodeactualidad/cara-a-cara/assets/avatar"
    path = base / (f"identities/{character_id}.json" if character_id in {"leo", "lia"}
                   else f"characters/{character_id}/identity.json")
    value = json.loads(path.read_text(encoding="utf-8"))
    if value.get("id") != character_id or not value.get("voz", {}).get("nombre"):
        raise ValueError("Identidad o voz del personaje incompleta")
    if character_id == "leo":
        approved = json.loads((settings.templates_dir / "sandbox/nodeaction/_pizarra/profiles/leo.json").read_text())
        value["voz"]["direccion"] = approved["voice"]["base"]
        value["voz"]["direccion_fuente"] = "sandbox/nodeaction/_pizarra/profiles/leo.json#voice.base"
        value["voz"]["ritmo"] = approved.get("postprocess", {}).get("tempo", 1.0)
    return value


def visual_contract(character_id):
    profile = json.loads((settings.templates_dir / "sandbox/nodeaction/_pizarra/profiles/leo.json").read_text())
    character = profile.get("avatar", {}).get("characters", {}).get(character_id)
    if not character:
        raise ValueError("El personaje no tiene poses registradas en el motor compartido")
    return {"profile_id": profile["id"], "character_id": character_id,
            "poses": sorted(character.get("poses", {}))}


def selected_style(estilo=None):
    # A fixed renderer layout, not an invented Showcase style selection.
    if estilo not in (None, "mobile"):
        raise ValueError("Cara a Cara utiliza el layout fijo mobile (9:16)")
    return {"id": "mobile", "revision": "1"}, {"default": "mobile", "styles": []}


def scaffold(rec, root):
    if root.exists():
        raise ValueError("La carpeta del episodio ya existe")
    editorial = rec.get("character_identity") or identity(rec.get("character_id"))
    voice = editorial["voz"]
    (root / "assets/media").mkdir(parents=True)
    (root / "work/agent-context").mkdir(parents=True)
    _json(root / "assets/character-identity.json", editorial)
    _json(root / "assets/config.json", {"activeId": "default", "configs": [{
        "id": "default", "design": DESIGN, "sceneUrl": "assets/scene.json",
        "lyricsUrl": "assets/lyrics.json", "overlaysUrl": "assets/overlays.json",
        "audio": {"src": "assets/song.mp3"}, "character_id": editorial["id"],
    }]})
    _json(root / "assets/script.json", {
        "title": rec["topic"], "design": DESIGN, "voice": voice["nombre"],
        "voice_direction": voice.get("direccion", "Español latinoamericano, directo y natural."),
        "language": "es", "target_minutes": rec["target_minutes"],
        "format": "short_preparation" if rec.get("short_test") else "standard", "segments": [],
    })
    _json(root / "manifest.json", {
        "title": rec["topic"], "design": DESIGN, "native_scene": True,
        "native_orientation": "9:16", "formats": ["9:16"], "video_formats": [{"id": "reels", "aspect_ratio": "9:16", "width": 1080, "height": 1920}],
        "estilo": "mobile", "style_revision": "1", "character_id": editorial["id"],
        "identity_revision": hashlib.sha256(json.dumps(editorial, sort_keys=True).encode()).hexdigest(),
        "status": "en progreso", "profile_id": PROFILE,
    })
    _json(root / "publish.json", {})
    _json(root / "assets/overlays.json", {"items": []})
    # Scaffold is independently coherent; _prepare_video stamps the same selected
    # narrative later, but neither agents nor standalone callers need to infer it.
    if rec.get("narrative_id"):
        for path in (root / "assets/config.json", root / "assets/script.json", root / "manifest.json"):
            value = json.loads(path.read_text())
            target = value["configs"][0] if "configs" in value else value
            target["narrative_id"] = rec["narrative_id"]
            if rec.get("title_level"):
                target["title_level"] = rec["title_level"]
            _json(path, value)
    (root / "PLAN.md").write_text("# Plan\n\nFuentes, evidencia y revisión pendientes.\n")
    base = "/api/v1/explainer/files/bundled/"
    (root / "index.html").write_text(
        '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<title>Cara a Cara</title><link href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=DM+Sans:wght@700;800;900&display=swap" rel="stylesheet">'
        '<style>html,body{margin:0;background:#fff;overflow:hidden}#stage,canvas{position:fixed;inset:0}</style>'
        '<audio id="audio" preload="auto"></audio><div id="stage"></div>'
        f'<script src="{base}sandbox/_proto/proto.js"></script>'
        f'<script src="{base}sandbox/nodeaction/_pizarra/comparacion.js"></script></html>', encoding="utf-8")


def prepare_context(root, rec):
    from src.core.explainer.native_production import service
    context = root / "work/agent-context"
    entries = context / "entries"
    entries.mkdir(parents=True, exist_ok=True)
    catalog = service().catalog(DESIGN)
    index = []
    for entry in catalog.entries:
        if not entry.id.startswith("comparacion."):
            continue
        _json(entries / (entry.id + ".json"), entry.model_dump(exclude_none=True))
        index.append({"id": entry.id, "summary": entry.summary})
    _json(context / "index.json", {"design": DESIGN, "format": "9x16", "entries": index})
    _json(context / "identity.json", rec.get("character_identity") or identity(rec["character_id"]))
    _json(context / "character-visual.json", visual_contract(rec["character_id"]))
    guide = settings.templates_dir / "nodeactualidad/cara-a-cara/assets/guides/crear-escena.json"
    shutil.copyfile(guide, context / "scene-contract.json")
    shutil.copyfile(guide.parent / "editorial-policy.json", context / "editorial-policy.json")
    (context / "QUICK.md").write_text(
        "Cara a Cara, móvil 9:16. Lee editorial-policy.json, identity.json, character-visual.json, scene-contract.json e index.json y solo contratos elegidos. "
        "El motor y las láminas son compartidos: no copiarlos ni modificarlos. "
        "Escribe datos del episodio en assets/scene.json y assets/overlays.json, guion en assets/script.json. "
        "El host genera voz, transcripción y medios. Cada shot lleva character igual al personaje elegido. "
        "Los medios se muestran dentro de tarjetas; single permite noticia/dato sin comparación forzada. "
        "shots[].subject no existe: usa shots[].subjects:[{id,...}] con IDs registrados. "
        "subjects[].src nunca null: conservar src previo o usar un archivo importado/editorial real. "
        "Todo archivo de apoyo o SVG editorial debe existir; rótulos ARCHIVO/ILUSTRACIÓN visibles cuando correspondan.\n")


def prompt(rec, phase, qc=""):
    character = rec["character_id"]
    intro = (f"Prepara un episodio real de Cara a Cara, móvil 9:16, personaje {character}, tema {rec['topic']}. "
             f"Duración objetivo {rec['target_minutes']:g} minutos. "
             "Trabaja solo mediante herramientas de archivos dentro de esta carpeta aislada. "
             "No ejecutes CLI, no uses red, no delegues ni renderices; el host obtiene medios, voz y transcripción. "
             "Lee BRIEF.md, work/agent-context/QUICK.md y work/agent-context/editorial-policy.json. Respeta identity.json y sus reglas editoriales. "
             "Empieza directamente por un hecho o pregunta concreta del tema. Sin saludo, nombre, presentación ni eslogan inicial. "
             "Cierre opcional, una frase corta. Español latinoamericano. No inventes actualidad, cifras, fuentes ni enlaces; "
             "trabaja con la evidencia del brief y registra límites en PLAN.md. "
             + rec.get("description", "") + " ")
    if rec.get("narrative_id"):
        from src.core.explainer import narrative
        story = narrative.get_service().get(rec["narrative_id"])
        intro += " Actos válidos para segments[].act: " + json.dumps([
            {"id": act.id, "function": act.function, "narrative_intensity": act.intensity}
            for act in story.spoken_acts], ensure_ascii=False) + ". "
    if phase == "media_seleccion":
        return intro + (
            "Lee work/agent-context/media-candidates.json y las imágenes candidatas. "
            'Escribe work/media-selection.json: {"version":1,"selections":[{"request_id":"id","candidate_id":"id","depiction":"Qué muestra realmente y pertinencia"}]}. '
            "Cada candidate_id debe pertenecer a su request_id en media-candidates; depiction tiene entre 8 y 300 caracteres. "
            "Solo ids existentes; rechaza imágenes que no correspondan al guion. No cambies guion ni solicitudes.")
    if phase == "guion":
        return intro + (
            "Conserva narrative_id, voice, voice_direction, format, design, language y target_minutes de assets/script.json. "
            "Completa entre 220 y 260 palabras para dos minutos, 6–10 segments con id, text, tone, intensity y act según la narrativa si existe. "
            "segments[].intensity es un número finito entre 0 y 1, por ejemplo 0.6; nunca texto, enum ni booleano. "
            "narrative_intensity describe la estructura del acto; no se copia como intensidad vocal. "
            "Mantén el orden narrativo sin teatralizar noticias ni presentar hechos inciertos como confirmados. "
            "Cada segmento incluye un plan visual: prioriza fotos y clips pertinentes; evita láminas de texto y esquemas de relleno. PLAN.md relaciona hechos con fuentes y fechas. "
            'Solicita 5–10 fotos pertinentes con work/media-requests.json: {"version":1,"requests":[{"id":"foto1","anchor":"frase exacta del guion","shows":"sujeto visible","queries":["consulta concreta en inglés","segunda consulta"]}]}. '
            "Sin URLs de descarga inventadas. publish.json es obligatorio desde esta fase: "
            "escribe youtube_title, youtube_description, instagram_title, instagram_description, facebook_title, facebook_description y tiktok_caption. "
            "Títulos hasta 100 caracteres; descripciones de Instagram/Facebook hasta 280 y YouTube hasta 400; TikTok solo título corto hasta 100. "
            "Texto real, sin enlaces como sustituto, ni hashtags o miniaturas obligatorias. Fuentes separadas en sources. "
            'Al terminar escribe work/phase.json con {"phase":"script_ready"}.')
    return intro + (
        "Conserva el guion y audio. Lee assets/lyrics.json y work/agent-context/media-imported.json. "
        "Escribe assets/scene.json con profile_id leo-comparaciones-v1, end al final real del audio, subjects y shots. "
        "Pon character:'" + character + "' en CADA shot; avatar.timeline puede añadir poses pero nunca sustituir la identidad. "
        "Usa duo solo en comparativas; single para noticias y datos. Titulares cortos legibles en móvil. "
        "Usa al menos 12 shots distribuidos por todo el audio, cambios cada 4–9 segundos, nunca una imagen genérica sin relación. "
        "Los tiempos pueden ser números o @frase única EXACTA de lyrics.json. Primer shot t:0. "
        "shots[].subject NO existe; para seleccionar o sobrescribir usa shots[].subjects:[{id,...}] con IDs de subjects. "
        "subjects[].src y sus reemplazos nunca null y solo rutas assets/media/ existentes. "
        "Para tarjetas abstractas crea realmente un SVG editorial local rotulado como esquema; no inventes archivos ni logos. "
        "Los materiales de archivo e ilustraciones llevan rótulos visibles ARCHIVO o ILUSTRACIÓN según corresponda. "
        "Escribe assets/overlays.json {items:[{subject,kind:'photo'|'video',src,at,dur,shows,media_review}]}. "
        "Los recursos seleccionados llevan créditos existentes; no inventes archivos. "
        "Cubre visualmente todo el episodio con fotos y clips reales pertinentes; usa subjects[].fit:cover para llenar el cuadro sin franjas blancas. "
        "No recortes sujetos importantes: elige otro encuadre/medio si cover los corta. Titulares de 3–7 palabras, subtítulos y datos breves; no láminas de párrafos. "
        "Alterna detalle, plano general, foto y clip según la narración; los esquemas solo cuando explican algo que la foto no muestra. " + qc)


def _needs_voice(root, marker, digest):
    return (marker.get("script_sha256") != digest or not (root / "assets/song.mp3").exists()
            or marker.get("phase") not in {"voice_ready", "storyboard", "scene_ready"})


def _approved_preview_plan(root):
    """Host-only approved data: reuse the spoken draft without another writer call."""
    from src.core.explainer.producer import _script_hash
    path = root / "work/approved-preview-plan.json"
    if not path.exists():
        return None
    if path.is_symlink() or path.stat().st_size > 256 * 1024:
        raise ValueError("Plan de vista previa no seguro")
    review = json.loads((root / "work/script-review.json").read_text())
    if (review.get("status") != "approved" or review.get("script_sha256") != _script_hash(root)
            or review.get("preview_plan_sha256") != hashlib.sha256(path.read_bytes()).hexdigest()):
        raise ValueError("El guion o plan de vista previa no corresponde a la aprobación")
    plan = json.loads(path.read_text())
    if plan.get("version") != 1 or plan.get("script_sha256") != _script_hash(root):
        raise ValueError("Plan de vista previa obsoleto")
    blocks = plan.get("blocks", [])
    if not 2 <= len(blocks) <= 12 or not 12 <= sum(len(b.get("variants", [])) for b in blocks) <= 80:
        raise ValueError("El plan requiere bloques y entre 12 y 80 planos")
    ids = {row["id"] for row in plan.get("subjects", [])}
    if len(ids) < 4:
        raise ValueError("El plan requiere al menos cuatro sujetos visuales")
    def local(value):
        if not isinstance(value, str) or not value.startswith("assets/media/"):
            raise ValueError("Medio del plan fuera del episodio")
        target = root / value
        if target.is_symlink() or not target.is_file() or not target.resolve().is_relative_to((root / "assets/media").resolve()):
            raise ValueError("Medio del plan ausente o no seguro")
    for subject in plan["subjects"]:
        local(subject.get("src"))
        if subject.get("fit") != "cover":
            raise ValueError("Los cuadros del plan aprobado deben usar cover")
    for block in blocks:
        if not block.get("variants"):
            raise ValueError("Bloque sin planos")
        for variant in block["variants"]:
            if not variant.get("subjects") or any(row.get("id") not in ids for row in variant["subjects"]):
                raise ValueError("Sujeto de plano no registrado")
            if variant.get("clip"):
                local(variant["clip"].get("src"))
    return plan


def _materialize_approved_preview(root, rec, plan):
    lyrics = json.loads((root / "assets/lyrics.json").read_text())
    words = lyrics if isinstance(lyrics, list) else lyrics.get("words", [])
    if not words:
        words = [word for segment in lyrics.get("segments", []) for word in segment.get("words", [])]
    duration = _audio_duration(root)
    starts = [0.0] + [_resolve_time("@" + b["anchor"], words) for b in plan["blocks"][1:]]
    if any(b <= a for a, b in zip(starts, starts[1:] + [duration])):
        raise ValueError("Bloques de vista previa fuera de orden")
    shots, overlays = [], []
    for block, start, end in zip(plan["blocks"], starts, starts[1:] + [duration]):
        variants = block["variants"]
        for index, variant in enumerate(variants):
            shot = dict(variant)
            clip = shot.pop("clip", None)
            t = start + (end - start) * index / len(variants)
            until = start + (end - start) * (index + 1) / len(variants)
            shot.update(t=round(t, 3), character=rec["character_id"])
            shots.append(shot)
            if clip:
                overlays.append({"subject": variant["subjects"][0]["id"], "kind": "video", **clip,
                                 "at": round(t, 3), "dur": round(until-t, 3)})
    _json(root / "assets/scene.json", {"profile_id": PROFILE, "end": duration,
                                      "subjects": plan["subjects"], "shots": shots})
    _json(root / "assets/overlays.json", {"items": overlays})
    return {"source": "user_approved_preview_plan", "shots": len(shots), "clips": len(overlays),
            "agent_calls": 0, "render_requested": False}


def _audio_duration(root):
    result = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                             "-of", "default=nw=1:nk=1", str(root / "assets/song.mp3")],
                            capture_output=True, text=True, timeout=20, check=True)
    return float(result.stdout.strip())


def _resolve_time(value, words):
    if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
        return float(value)
    if isinstance(value, str) and value.startswith("@"):
        norm = lambda s: re.sub(r"[^\w ]", "", str(s).casefold()).split()
        target = norm(value[1:])
        tokens = [norm(w.get("word", w.get("text", ""))) for w in words]
        flat = [(token, i) for i, row in enumerate(tokens) for token in row]
        hits = [i for i in range(len(flat) - len(target) + 1)
                if target and [t[0] for t in flat[i:i + len(target)]] == target]
        if len(hits) == 1:
            return float(words[flat[hits[0]][1]].get("start", words[flat[hits[0]][1]].get("t", 0)))
    raise ValueError(f"Tiempo/ancla inválido o ambiguo: {value!r}")


def _voice_errors(script):
    errors = []
    for index, segment in enumerate(script.get("segments", []), 1):
        intensity = segment.get("intensity")
        if (isinstance(intensity, bool) or not isinstance(intensity, (int, float))
                or not math.isfinite(intensity) or not 0 <= intensity <= 1):
            errors.append(f"Segmento {index}: intensity debe ser número finito entre 0 y 1")
    return errors


def validate_prepared(rec, root, *, require_marker=True):
    from src.core.explainer.producer import _read_phase, _script_hash
    if _script_review_pending(root):
        raise ValueError("Guion pendiente de revisión; no generar voz ni grabar")
    publication_errors = _publication_errors(root)
    if publication_errors:
        raise ValueError("; ".join(publication_errors))
    if require_marker:
        marker = _read_phase(root)
        if marker.get("phase") != "scene_ready" or marker.get("script_sha256") != _script_hash(root):
            raise ValueError("Voz/escena no corresponde al guion; usa Retomar")
    script = json.loads((root / "assets/script.json").read_text())
    voice_errors = _voice_errors(script)
    if voice_errors:
        raise ValueError("; ".join(voice_errors))
    editorial = json.loads((root / "assets/character-identity.json").read_text())
    if rec.get("character_identity") and editorial != rec["character_identity"]:
        raise ValueError("La identidad del episodio cambió después de la admisión")
    if script.get("voice") != editorial["voz"]["nombre"]:
        raise ValueError("La voz no corresponde a la identidad elegida")
    duration = _audio_duration(root)
    if not 90 <= duration <= 300:
        raise ValueError(f"Duración real {duration:.1f}s fuera de 90–300s")
    lyrics = json.loads((root / "assets/lyrics.json").read_text())
    words = lyrics if isinstance(lyrics, list) else lyrics.get("words", [])
    if not words and isinstance(lyrics, dict):
        words = [word for segment in lyrics.get("segments", []) for word in segment.get("words", [])]
    if not words:
        raise ValueError("Transcripción vacía")
    scene = json.loads((root / "assets/scene.json").read_text())
    if scene.get("profile_id") != PROFILE or not scene.get("subjects") or len(scene.get("shots", [])) < 12:
        raise ValueError("Escena incompleta: perfil, sujetos y al menos 12 planos")
    if abs(float(scene.get("end", 0)) - duration) > 1.5:
        raise ValueError("La escena no cubre el audio real")
    allowed_poses = set(visual_contract(rec["character_id"])["poses"])
    times = []
    paths = []
    def media_path(value):
        if not isinstance(value, str) or not value.startswith("assets/media/"):
            raise ValueError("Los medios deben pertenecer a este episodio")
        path = root / value
        if not path.resolve().is_relative_to((root / "assets/media").resolve()) or not path.is_file() or path.is_symlink():
            raise ValueError("Medio ausente o fuera del episodio")
        paths.append(value)
    for subject in scene["subjects"]:
        media_path(subject.get("src"))
    subject_ids = {row["id"] for row in scene["subjects"]}
    for shot in scene["shots"]:
        if "subject" in shot:
            raise ValueError("shots[].subject no existe; usa shots[].subjects con IDs")
        if not isinstance(shot.get("subjects", []), list):
            raise ValueError("shots[].subjects debe ser un array de objetos con id")
        if shot.get("character") != rec["character_id"] or shot.get("mode") not in {"duo", "single"}:
            raise ValueError("Personaje o modo de plano inválido")
        if shot.get("pose", "talk") not in allowed_poses:
            raise ValueError("Pose de personaje no registrada")
        t = _resolve_time(shot.get("t"), words)
        if not 0 <= t < duration or (times and t <= times[-1]):
            raise ValueError("Planos fuera de orden o del audio")
        times.append(t)
        for subject in shot.get("subjects", []):
            if not isinstance(subject, dict) or subject.get("id") not in subject_ids:
                raise ValueError("shots[].subjects requiere IDs registrados")
            if "src" in subject:
                media_path(subject["src"])
    if times[0] != 0 or max(b-a for a,b in zip(times, times[1:]+[duration])) > 15:
        raise ValueError("La composición deja más de 15s sin cambiar de plano")
    for pose in scene.get("avatar", {}).get("timeline", []):
        if pose.get("pose") not in allowed_poses:
            raise ValueError("Pose de timeline no registrada")
        _resolve_time(pose.get("at"), words)
    overlays = json.loads((root / "assets/overlays.json").read_text())
    for item in overlays.get("items", []):
        media_path(item.get("src"))
        if item.get("kind") not in {"photo", "video"}:
            raise ValueError("Tipo de apoyo inválido")
        start = _resolve_time(item.get("at"), words)
        if "until" in item:
            end = _resolve_time(item["until"], words)
        else:
            dur = item.get("dur")
            if not isinstance(dur, (int, float)) or isinstance(dur, bool) or not math.isfinite(dur) or dur <= 0:
                raise ValueError("Cada apoyo requiere dur positiva o until válido")
            end = start + dur
        if item.get("subject") not in {row["id"] for row in scene["subjects"]} or not 0 <= start < end <= duration + 1.5:
            raise ValueError("Sujeto o intervalo de apoyo inválido")
    if len(set(paths)) < 4:
        raise ValueError("Faltan medios diversos: se necesitan al menos cuatro")
    return {"duration_seconds": round(duration, 3), "shots": len(times), "media": len(set(paths)),
            "character_id": rec["character_id"], "voice": script["voice"], "format": "9x16"}


async def run(owner, rec, resume):
    from src.core.explainer.native_production import command
    from src.core.explainer.producer import (_read_phase, _write_phase, _script_hash, _validate_script,
                                           host_timeout_seconds, agent_timeout_seconds, KIT_DIR)
    from src.core.explainer.agent_context import ensure_private_workspace
    from src.core.explainer import host_media
    from src.core.ports.agent_port import AgentScope
    root, log = owner._root(rec) / rec["video_id"], Path(rec["log_path"])
    if _script_review_pending(root):
        await owner._update(rec["production_id"], state="incomplete", phase="script_review",
                            video_status="guion para revisar", error="Guion pendiente de aprobación; voz y grabación detenidas.")
        return
    log.parent.mkdir(parents=True, exist_ok=True)
    if not resume:
        scaffold(rec, root)
        owner._prepare_video(rec, root)
    prepare_context(root, rec)
    ensure_private_workspace(root)
    # Explicit economical model from the existing producer role's Claude policy.
    from src.adapters.models.hub import roles_config
    producer = roles_config()["roles"]["producer"]
    model = producer.get("model") if producer.get("provider") == rec["agent"] else producer.get("fallback", {}).get("model")
    chosen = producer if producer.get("provider") == rec["agent"] else producer.get("fallback", {})
    scope = AgentScope(writable_dir=str(root.resolve()), os_sandbox_dir=str(root.resolve()), model=model or "",
                       reasoning_effort=chosen.get("reasoning_effort"))
    timeout = max(settings.agent_production_timeout_seconds, agent_timeout_seconds(rec.get("target_minutes")))
    marker = _read_phase(root)
    resume_phase = {"script_ready": "media_seleccion", "voice_ready": "transcribe", "storyboard": "storyboard", "scene_ready": "review"}.get(marker.get("phase"), "guion")
    await owner._update(rec["production_id"], state="producing", phase=resume_phase)
    if marker.get("phase") not in {"script_ready", "voice_ready", "storyboard", "scene_ready"}:
        await owner._update(rec["production_id"], state="producing", phase="guion")
        result = await owner._run_agent(rec, root, log, scope, timeout, "guion", resume=resume)
        if not result.ok:
            raise RuntimeError("El agente no terminó el guion; usa Retomar")
    errors = _validate_script(root, rec.get("narrative_id"), rec.get("target_minutes"))
    editorial = json.loads((root / "assets/character-identity.json").read_text())
    script = json.loads((root / "assets/script.json").read_text())
    errors.extend(_voice_errors(script))
    errors.extend(_publication_errors(root))
    if rec.get("character_identity") and editorial != rec["character_identity"]:
        errors.append("La identidad del episodio cambió después de la admisión")
    if script.get("voice") != editorial["voz"]["nombre"] or script.get("voice_direction") != editorial["voz"].get("direccion", "Español latinoamericano, directo y natural."):
        errors.append("El agente cambió el perfil vocal elegido")
    opening = " ".join(str(s.get("text", "")) for s in script.get("segments", []))[:220].casefold()
    if re.match(r"\s*[¡¿]?\s*(hola\b|bienvenid[oa]s?\b|soy\b|me llamo\b)", opening):
        errors.append("La apertura presenta al personaje en lugar de entrar al tema")
    if errors:
        raise ValueError("; ".join(errors))
    digest = _script_hash(root)
    approved_plan = _approved_preview_plan(root)
    marker = _read_phase(root)
    if _needs_voice(root, marker, digest):
        _write_phase(root, "script_ready", digest)
        if approved_plan:
            # All resources were imported and frozen in the approved host plan.
            state = {"request_count": 0, "candidates": []}
        else:
            host_media.initialize_legacy_requests(root, rec.get("media") or [], allow_existing_references=resume)
            state = await asyncio.wait_for(host_media.prepare(root, rec["production_id"]), 150)
        if state.get("request_count") and not state.get("candidates"):
            raise ValueError("No hay medios pertinentes; revisa las solicitudes y retoma")
        if state.get("candidates"):
            try:
                host_media.apply_selection(root, rec["production_id"], state, require_nonempty=True)
            except host_media.MediaBrokerError:
                result = await owner._run_agent(rec, root, log, scope, timeout, "media_seleccion", resume=True)
                if not result.ok or _script_hash(root) != digest:
                    raise ValueError("La selección de medios falló o cambió el guion")
                host_media.apply_selection(root, rec["production_id"], state, require_nonempty=True)
        await owner._update(rec["production_id"], phase="voice")
        voice = editorial["voz"]
        _json(root / "work/voice-design.json", {"voice": {
            "voice": voice["nombre"], "models": [voice.get("modelo", "gemini-3.8-flash-tts")],
            "base": voice.get("direccion", "Español latinoamericano, directo y natural."),
            "lead": 0.2, "tail": 0.5}})
        await command([sys.executable, KIT_DIR / "tools/narrate.py", root / "assets/script.json",
                       root / "work/narration", "--design", root / "work/voice-design.json", "--voice", voice["nombre"],
                       "--model", voice.get("modelo", "gemini-3.8-flash-tts"), "--lead", "0.2", "--tail", "0.5"],
                      log, host_timeout_seconds(rec.get("target_minutes")))
        qc = json.loads((root / "work/narration.qc.json").read_text())
        if qc.get("voice") != voice["nombre"] or float(qc.get("wer_aprox", 1)) > 0.25:
            raise ValueError("QC de voz no corresponde al guion o al personaje; revisa y retoma")
        tempo = float(voice.get("ritmo", 1)) if rec["character_id"] == "leo" else 1.0
        if not 0.5 <= tempo <= 2:
            raise ValueError("Ritmo de voz aprobado fuera de rango")
        if tempo != 1:
            await command(["ffmpeg", "-y", "-loglevel", "error", "-i", root / "work/narration.mp3",
                           "-af", f"atempo={tempo:g}", "-b:a", "192k", root / "assets/song.mp3"], log, 120)
            _json(root / "work/voice-postprocess.json", {"character_id": "leo", "tempo": tempo,
                  "pitch_preserved": True, "source": "work/narration.mp3", "output": "assets/song.mp3"})
        else:
            shutil.copyfile(root / "work/narration.mp3", root / "assets/song.mp3")
        _write_phase(root, "voice_ready", digest)
    marker = _read_phase(root)
    if marker.get("phase") not in {"storyboard", "scene_ready"} or not (root / "assets/lyrics.json").exists():
        await owner._update(rec["production_id"], phase="transcribe")
        started = time.monotonic()
        await command([sys.executable, KIT_DIR / "tools/transcribe.py", root / "assets/song.mp3",
                       root / "assets/script.json", root / "assets/lyrics.json"], log,
                      host_timeout_seconds(rec.get("target_minutes")))
        from src.core.explainer.usage import _tool
        _tool().record(root, provider="whisper", model="large-v3", role="transcribe", step="transcribe",
                       seconds=time.monotonic() - started, ok=True, usage_known=False)
        _write_phase(root, "storyboard", digest)
    if approved_plan and _read_phase(root).get("phase") != "scene_ready":
        materialized = _materialize_approved_preview(root, rec, approved_plan)
        _json(root / "work/approved-preview-result.json", materialized)
        _write_phase(root, "scene_ready", digest)
    if _read_phase(root).get("phase") != "scene_ready":
        await owner._update(rec["production_id"], phase="storyboard")
        result = await owner._run_agent(rec, root, log, scope, timeout, "storyboard", resume=True)
        if not result.ok:
            raise RuntimeError("El agente no terminó la escena; usa Retomar")
    if _script_hash(root) != digest:
        raise ValueError("El guion cambió; retoma para regenerar voz y transcripción")
    review = validate_prepared(rec, root, require_marker=False)
    _write_phase(root, "scene_ready", digest)
    _json(root / "work/native-validation.json", review)
    manifest = json.loads((root / "manifest.json").read_text())
    manifest.update(status="en progreso", duration_seconds=review["duration_seconds"],
                    quality_issues=["Revisión visual/editorial móvil pendiente antes de grabar."])
    _json(root / "manifest.json", manifest)
    from src.adapters.content.local_inventory import LocalContentInventory
    from src.core.content_registry import index_production_assets
    await index_production_assets(rec["video_id"], root, LocalContentInventory())
    from src.core.explainer.usage import summarize
    summary = summarize(root)
    await owner._update(rec["production_id"], usage_totals=summary["totals"])
    await owner._update(rec["production_id"], state="incomplete", phase="review", video_status="en progreso",
                        error="Revisión visual/editorial móvil pendiente antes de grabar.")


def refresh_manifest(root, video_id):
    """Keep native validation and reviewed status when the shared exporter closes.

    A successful technical check never grants editorial approval. The caller must
    record its visual review and set listo explicitly before requesting a render.
    """
    from src.core.explainer.render_paths import full_render_files
    manifest = json.loads((root / "manifest.json").read_text())
    result = validate_prepared({"character_id": manifest["character_id"]}, root)
    manifest.update(video_id=video_id, duration_seconds=result["duration_seconds"],
                    design_name="Cara a Cara", native_validation=result)
    if manifest.get("status") in {"listo", "renderizado"} and not manifest.get("render_revision_stale") and full_render_files(root):
        manifest["status"] = "renderizado"
    _json(root / "manifest.json", manifest)
    return manifest


async def approve_review(owner, rec, *, evidence_paths, reviewer="agent-review"):
    """Explicit host action after viewing the mobile episode; never called by run.

    Keeps the visual evidence and the technical result with the episode, then
    permits the existing recorder to export it. This action does not publish.
    """
    from datetime import datetime, timezone
    from src.config.profile_layout import layout_for_settings
    root = owner._root(rec) / rec["video_id"]
    profile = layout_for_settings(settings).root.resolve()
    if not evidence_paths:
        raise ValueError("La revisión requiere capturas móviles de evidencia")
    checked = []
    for source in evidence_paths:
        path = Path(source)
        if (path.suffix.lower() not in {".png", ".jpg", ".jpeg", ".webp"}
                or not path.is_file() or path.is_symlink()
                or not path.resolve().is_relative_to(profile)):
            raise ValueError("Evidencia de revisión ausente o fuera del perfil activo")
        checked.append(str(path.resolve()))
    result = validate_prepared(rec, root)
    stamp = datetime.now(timezone.utc).isoformat()
    review = {"status": "approved", "reviewer": reviewer, "reviewed_at": stamp,
              "format": "9x16", "evidence": checked, "technical": result}
    _json(root / "work/mobile-review.json", review)
    manifest = json.loads((root / "manifest.json").read_text())
    manifest.update(status="listo", quality_issues=[], mobile_review=review)
    _json(root / "manifest.json", manifest)
    await owner._update(rec["production_id"], state="ready", phase="ready",
                        video_status="listo", error=None, finished_at=stamp)
    return review

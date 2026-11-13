"""Adaptador de escenas nativas: usa la cola, aislamiento y presupuesto del productor."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import signal
import sys
from pathlib import Path

from src.config.settings import settings
from src.core.ports.agent_port import AgentScope
from src.core.explainer.episode_runtime import ATLAS_ENGINE_URL, validate_atlas_episode_runtime

NATIVE_DESIGNS = {
    "cara-a-cara": {"name": "Cara a Cara", "category": "node_actualidad", "default": "mobile"},
    "mapas-satelitales": {
        "name": "Mapas satelitales",
        "category": "node_history",
        "default": "dynamic",
    },
    "atlas-en-movimiento": {
        "name": "Atlas en Movimiento",
        "category": "node_atlas",
        "default": "v4-atlas",
    },
}


def refresh_native_designs():
    from src.core.explainer.production_templates import definitions
    for design, _ in definitions(settings.templates_dir):
        if design.get('engine_id') == 'nodehistory/_atlas':
            NATIVE_DESIGNS[design['id']] = {'name': design['name'],
                'category': design.get('category_path') or 'node_atlas', 'default': 'original', 'news': True}
    return NATIVE_DESIGNS


def is_news(design):
    return bool(refresh_native_designs().get(design, {}).get('news'))


def service():
    # Composición del adaptador de host; el agente recibe únicamente contratos públicos.
    from src.adapters.showcase.styles import PublicStyleDefinitions
    from src.core.showcase.service import ShowcaseService

    return ShowcaseService(PublicStyleDefinitions(settings.templates_dir))


def selected_style(design, estilo=None):
    if design == "cara-a-cara":
        from src.core.explainer.cara_a_cara_production import selected_style as choose
        return choose(estilo)

    from src.core.showcase.ports import ShowcaseInvalid, ShowcaseNotFound

    try:
        api = service()
        listing = api.styles(design)
        chosen = estilo or listing["default"]
        return api.style(design, chosen), listing
    except (ShowcaseInvalid, ShowcaseNotFound) as exc:
        raise ValueError(str(exc)) from exc


def _json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def prepare_context(video_dir, design, estilo):
    api = service()
    catalog = api.catalog(design, estilo)
    context = video_dir / "work/agent-context"
    (context / "entries").mkdir(parents=True, exist_ok=True)
    index = []
    for entry in catalog.entries:
        if entry.section == "sprites" or entry.id.startswith("sprite-"):
            continue
        _json(
            context / "entries" / (entry.id + ".json"),
            entry.model_dump(exclude_none=True),
        )
        index.append({"id": entry.id, "summary": entry.summary})
    listing = api.styles(design)
    _json(
        context / "index.json",
        {
            "design": design,
            "estilo": estilo,
            "styles": listing["styles"],
            "entries": index,
        },
    )
    quick = (
        "Diseño: "
        + design
        + "; estilo elegido: "
        + estilo
        + ". No leer ni copiar motores.\n"
        "Lee index.json y solo entries/<id>.json de las piezas elegidas. appearance describe la tipografía, "
        "tamaños y ranuras de este estilo. Hereda esos valores; usa excepciones locales solo si hacen falta.\n"
        "Un episodio es guion, medios con crédito y scene.json. No se duplican componentes. "
        "No renderizar ni generar voz: el host hace voz y transcripción una vez, y genera la escena.\n"
    )
    if is_news(design):
        quick += ('Después de recibir lyrics.json escribe assets/scene.json con format:"atlas-v1", '
            'look:"noticiero-globo", attribution:false, duration, camera, layers y hud. '
            'Usa exclusivamente los tipos y parámetros de los contratos elegidos. '
            'Una escena es datos: no escribas JavaScript, generadores ni motores. '
            'Los tiempos usan anclas exactas de la voz.\n')
    elif design == "atlas-en-movimiento":
        quick += (
            "Obligatorio: index.html carga el motor central; no crear engine/, components/ ni un renderizador propio. "
            "Los componentes nuevos se implementan y registran en el motor compartido, nunca en el episodio. "
            "En cada segmento escribe plan: {camara:{center:[lon,lat],zoom:5}, texto:{fecha,lugar,titular}, "
            "componentes:[{tipo:<id>,offset:0,dur:8,...parámetros}], medios:[...]}. "
            "El host usa el generador universal existente build_scene.py; no escribas otro generador. "
            "Cada segmento necesita plan y una pieza visual que represente el hecho, además del texto.\n"
        )
    else:
        quick += (
            "Después de recibir lyrics.json escribe assets/scene.json: {version:1,estilo,estiloRevision:1,"
            "camera:[{t:0,c:[lon,lat],span:30}],layers:[{type:'label',t:'@frase',at:[lon,lat],text:'...'}]}. "
            "Usa tipos map.layer.<type> del índice, anclas exactas, lugares por nombre y regiones con fuente.\n"
        )
    (context / "QUICK.md").write_text(quick, encoding="utf-8")


def prompt(record, phase, qc=""):
    if record["design"] == "cara-a-cara":
        from src.core.explainer.cara_a_cara_production import prompt as build
        return build(record, phase, qc)

    common = (
        f"Prepara {record['design']} con estilo {record['estilo']}; tema: {record['topic']}. "
        f"Duración: {record.get('target_minutes', 10)} minutos. "
        "Trabaja solo en esta carpeta usando lectura y escritura. Lee BRIEF.md y work/agent-context/QUICK.md; "
        "después index.json y únicamente los contratos de las piezas elegidas. "
        "No leas motores, no ejecutes CLI, no delegues, no renderices ni generes voz. "
        "No inventes fuentes ni afirmes haber investigado si el brief no aporta evidencia; registra lo pendiente en PLAN.md. "
        "Cada afirmación requiere fuente y cada medio, crédito. No edites audio ni transcripción. "
    )
    if record.get("description"):
        common += "Descripción del pedido: " + record["description"] + ". "
    if record["design"] == "atlas-en-movimiento":
        common += (
            "Está prohibido crear o copiar engine/, components/, scripts de renderizado o build_scene.py en este episodio. "
            "Usa el motor central mediante JSON. Si falta una pieza, registra la necesidad en PLAN.md para implementarla "
            "en la biblioteca principal y en Showcase; no fabriques un motor alternativo. "
        )
    if record.get("narrative_id"):
        from src.core.explainer import narrative
        from src.core.explainer.narrative.prompts import script_level_rules
        story = narrative.get_service().get(record["narrative_id"])
        contract = {"id": story.id, "acts": [
            {"act": act.id, "intensity": act.intensity, "function": act.function,
             "rules": act.rules, "tones": story.voice.allowed_tones.get(act.id, [])}
            for act in story.spoken_acts], "script_rules": script_level_rules(story,record.get("title_level"))}
        if story.question:
            contract["question"] = story.question.model_dump(include={"act","screen_max_words","tone","delivery_note"})
        common += ("Cada segmento lleva act e intensity; maxima >= 0.9, alta >= 0.7, media >= 0.4. "
                   "La pregunta final lleva on_screen_question con el límite de palabras indicado. "
                   "Contrato narrativo: " + json.dumps(contract,ensure_ascii=False) + ". ")
    if phase == "guion":
        return common + (
            "Escribe assets/script.json conservando title, design, target_minutes y escena.estilo. "
            "Incluye segments con id, text, tone, intensity y un plan visual por segmento. "
            "Conserva la narrativa y sus actos si figuran en assets/config.json; usa unos 130 vocablos por minuto. "
            'Escribe PLAN.md y publish.json. Solicita imágenes con work/media-requests.json: {"version":1,"requests":[{"id":"foto1","anchor":"frase exacta","shows":"sujeto visible","queries":["consulta concreta en inglés","segunda consulta"]}]}; hasta 16 solicitudes, sin URLs. '
            'Al terminar escribe work/phase.json con {"phase":"script_ready"}.'
        )
    return common + (
        "Usa la voz y las anclas reales de assets/lyrics.json. Escribe assets/scene.json con el estilo elegido "
        "y los componentes de sus contratos. Conserva el guion. Revisa que cada segmento tenga apoyo visual y "
        "que toda ruta de medio exista. Guarda lo que requiera revisión en PLAN.md. "
        + qc
    )


def scaffold(rec, root):
    if root.exists():
        raise ValueError("La carpeta del nuevo episodio ya existe")
    (root / "assets/media").mkdir(parents=True)
    (root / "work").mkdir()
    _json(
        root / "assets/config.json",
        {
            "configs": [
                {
                    "design": rec["design"],
                    "estilo": rec["estilo"],
                    "sceneUrl": "assets/scene.json",
                    "lyricsUrl": "assets/lyrics.json",
                    "audio": {"src": "assets/song.mp3"},
                }
            ]
        },
    )
    _json(
        root / "assets/script.json",
        {
            "title": rec["topic"],
            "design": rec["design"],
            "voice": "Charon",
            "language": "es",
            "target_minutes": rec["target_minutes"],
            "escena": {"estilo": rec["estilo"]},
            "segments": [],
        },
    )
    _json(
        root / "manifest.json",
        {
            "title": rec["topic"],
            "design": rec["design"],
            "native_scene": True,
            "estilo": rec["estilo"],
            "style_revision": rec["style_revision"],
            "status": "en progreso",
        },
    )
    _json(root / "publish.json", {})
    (root / "PLAN.md").write_text(
        "# Plan del episodio\n\nFuentes, guion, plan visual y revisión pendientes.\n"
    )
    prefix = "/api/v1/explainer/files/"
    scripts = [f'<script src="{prefix}sandbox/_proto/proto.js"></script>']
    if rec["design"] == "mapas-satelitales":
        libs = [
            "d3-array.min.js",
            "d3-geo.min.js",
            "topojson-client.min.js",
            "countries-50m.js",
        ]
        scripts = [
            f'<script src="{prefix}_tools/explainer-kit/vendor/geo/{lib}"></script>'
            for lib in libs
        ] + scripts
        scripts += [
            f'<script src="{prefix}sandbox/nodehistory/_mapas/{name}.js"></script>'
            for name in ["geo", "camera", "flags", "layers", "mapas"]
        ]
    elif is_news(rec['design']):
        from src.core.explainer.engine_locations import engine_root
        engine_relative = engine_root(settings.templates_dir, 'nodehistory/_atlas').relative_to(settings.templates_dir).as_posix()
        scripts += [f'<script type="module" src="{prefix}bundled/{engine_relative}/atlas.js"></script>']
    else:
        scripts += [
            f'<script type="module" src="{ATLAS_ENGINE_URL}"></script>'
        ]
    (root / "index.html").write_text(
        '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Video</title><style>html,body{margin:0;background:#000;overflow:hidden}#stage,canvas{position:fixed;inset:0}</style><body><audio id="audio" preload="auto"></audio><div id="stage"></div>'
        + "\n".join(scripts)
        + "</body></html>",
        encoding="utf-8",
    )
    if rec["design"] == "atlas-en-movimiento":
        validate_atlas_episode_runtime(root)


async def command(argv, log_path, timeout):
    with log_path.open("ab", buffering=0) as log:
        process = await asyncio.create_subprocess_exec(
            *map(str, argv),
            stdout=log,
            stderr=log,
            stdin=asyncio.subprocess.DEVNULL,
            start_new_session=True,
        )
        try:
            await asyncio.wait_for(process.wait(), timeout)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                await asyncio.wait_for(process.wait(), 10)
            except asyncio.TimeoutError:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                await process.wait()
            raise
        if process.returncode:
            raise RuntimeError(
                f"Paso nativo falló (código {process.returncode}); revisa el log"
            )


def validate_prepared(rec, root):
    """Validar un lote ya preparado sin ejecutar agente, voz ni render."""
    if rec["design"] == "cara-a-cara":
        from src.core.explainer.cara_a_cara_production import validate_prepared as validate
        return validate(rec, root)
    if rec["design"] == "atlas-en-movimiento":
        validate_atlas_episode_runtime(root)
    from src.core.explainer.producer import _read_phase, _script_hash
    from src.core.showcase.prepare import prepare_scene

    marker = _read_phase(root)
    if marker.get("phase") != "scene_ready" or marker.get("script_sha256") != _script_hash(root):
        raise ValueError("La voz/escena no corresponde al guion; usa Retomar")
    if not all((root / "assets" / name).is_file() for name in ("song.mp3", "lyrics.json", "scene.json")):
        raise ValueError("Faltan voz, transcripción o escena; usa Retomar")
    api = service()
    if api.style(rec["design"], rec["estilo"])["revision"] != rec["style_revision"]:
        raise ValueError("La revisión del estilo cambió; vuelve a seleccionar el estilo")
    scene = json.loads((root / "assets/scene.json").read_text())
    if not (scene.get('hud') if is_news(rec['design']) else scene.get("layers" if rec["design"] == "mapas-satelitales" else "items")):
        raise ValueError("La escena no tiene componentes; usa Retomar")
    prepare_scene(api, rec["design"], estilo=rec["estilo"], scene=scene,
                  config=json.loads((root / "assets/config.json").read_text()), format="16x9")


async def run(owner, rec, resume):
    if rec["design"] == "cara-a-cara":
        from src.core.explainer.cara_a_cara_production import run as produce
        return await produce(owner, rec, resume)

    from src.core.explainer.producer import (
        _read_phase,
        _write_phase,
        _script_hash,
        _validate_script,
        ProductionState,
        KIT_DIR,
        host_timeout_seconds,
        agent_timeout_seconds,
    )
    from src.core.explainer.agent_context import ensure_private_workspace

    root = owner._root(rec) / rec["video_id"]
    log = Path(rec["log_path"])
    log.parent.mkdir(parents=True, exist_ok=True)
    if not resume:
        scaffold(rec, root)
        owner._prepare_video(rec, root)
    current_style, _ = selected_style(rec["design"], rec["estilo"])
    if current_style["revision"] != rec["style_revision"]:
        raise ValueError(
            "La revisión del estilo cambió desde el pedido; vuelve a seleccionar el estilo"
        )
    prepare_context(root, rec["design"], rec["estilo"])
    ensure_private_workspace(root)
    scope = AgentScope(
        writable_dir=str(root.resolve()), os_sandbox_dir=str(root.resolve())
    )
    timeout = max(
        settings.agent_production_timeout_seconds,
        agent_timeout_seconds(rec.get("target_minutes")),
    )
    marker = _read_phase(root)
    digest = _script_hash(root)
    if marker.get("phase") not in {
        "script_ready",
        "voice_ready",
        "storyboard",
        "scene_ready",
    }:
        await owner._update(
            rec["production_id"], state=ProductionState.producing.value, phase="guion"
        )
        result = await owner._run_agent(
            rec, root, log, scope, timeout, "guion", resume=resume
        )
        if not result.ok:
            raise RuntimeError("El agente no terminó el guion; usa Retomar")
    if rec["design"] == "atlas-en-movimiento":
        validate_atlas_episode_runtime(root)
    errors = _validate_script(root, rec.get("narrative_id"), rec.get("target_minutes"))
    if errors:
        raise ValueError("; ".join(errors))
    digest = _script_hash(root)
    tools = KIT_DIR / "tools"
    if (
        marker.get("script_sha256") != digest
        or not (root / "assets/song.mp3").is_file()
    ):
        _write_phase(root, "script_ready", digest)
        from src.core.explainer import host_media

        host_media.initialize_legacy_requests(
            root, rec.get("media") or [], allow_existing_references=resume
        )
        media = await host_media.prepare(root, rec["production_id"])
        if media.get("request_count"):
            host_media.apply_selection(
                root, rec["production_id"], media, require_nonempty=True
            )
        await owner._update(rec["production_id"], phase="voice")
        await command(
            [
                sys.executable,
                tools / "narrate.py",
                root / "assets/script.json",
                root / "work/narration",
                "--design",
                "binary",
                "--lead",
                "1.2",
                "--tail",
                "6.0",
            ],
            log,
            host_timeout_seconds(rec.get("target_minutes")),
        )
        shutil.copy2(root / "work/narration.mp3", root / "assets/song.mp3")
        _write_phase(root, "voice_ready", digest)
    if (
        marker.get("phase") not in {"storyboard", "scene_ready"}
        or marker.get("script_sha256") != digest
        or not (root / "assets/lyrics.json").is_file()
    ):
        await owner._update(rec["production_id"], phase="transcribe")
        await command(
            [
                sys.executable,
                tools / "transcribe.py",
                root / "assets/song.mp3",
                root / "assets/script.json",
                root / "assets/lyrics.json",
            ],
            log,
            host_timeout_seconds(rec.get("target_minutes")),
        )
        _write_phase(root, "storyboard", digest)
    await owner._update(rec["production_id"], phase="storyboard")
    existing_scene = root / "assets/scene.json"
    if (
        marker.get("phase") != "scene_ready"
        or marker.get("script_sha256") != digest
        or not existing_scene.is_file()
    ):
        if rec["design"] == "atlas-en-movimiento":
            script_path = root / "assets/script.json"
            script = json.loads(script_path.read_text())
            script.setdefault("escena", {})["estilo"] = rec["estilo"]
            _json(script_path, script)
            await command(
                [
                    sys.executable,
                    settings.templates_dir
                    / "nodeatlas/atlas-en-movimiento/tools/build_scene.py",
                    root,
                ],
                log,
                120,
            )
        else:
            result = await owner._run_agent(
                rec, root, log, scope, timeout, "storyboard", resume=True
            )
            if not result.ok:
                raise RuntimeError("La escena no está terminada; usa Retomar")
    if rec["design"] == "atlas-en-movimiento":
        validate_atlas_episode_runtime(root)
    scene_path = root / "assets/scene.json"
    scene = json.loads(scene_path.read_text())
    if not (scene.get('hud') if is_news(rec['design']) else scene.get("layers" if rec["design"] == "mapas-satelitales" else "items")):
        raise ValueError("La escena necesita componentes visuales")
    if _script_hash(root) != digest:
        raise ValueError("El guion cambió; retoma para regenerar voz y tiempos")
    from src.core.showcase.prepare import prepare_scene

    api = service()
    prepared = prepare_scene(
        api,
        rec["design"],
        estilo=rec["estilo"],
        scene=scene,
        config=json.loads((root / "assets/config.json").read_text()),
        format="16x9",
    )
    _json(scene_path, prepared["scene"])
    _write_phase(root, "scene_ready", digest)
    _json(root / "assets/config.json", prepared["config"])
    manifest = json.loads((root / "manifest.json").read_text())
    manifest.update(
        estilo=rec["estilo"],
        style_revision=rec["style_revision"],
        status="en progreso",
        quality_issues=[
            "Revisión visual de escena nativa pendiente en ambos formatos."
        ],
    )
    _json(root / "manifest.json", manifest)
    from src.adapters.content.local_inventory import LocalContentInventory
    from src.core.content_registry import index_production_assets

    await index_production_assets(rec["video_id"], root, LocalContentInventory())
    await owner._update(
        rec["production_id"],
        state=ProductionState.incomplete.value,
        phase="review",
        video_status="en progreso",
        error="Revisión visual de escena nativa pendiente en ambos formatos.",
    )

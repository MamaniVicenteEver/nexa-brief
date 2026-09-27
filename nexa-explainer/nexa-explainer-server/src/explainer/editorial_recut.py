"""Director JSON and renderer for the source-led editorial recut prototype."""

from __future__ import annotations

import html
import base64
import json
from pathlib import Path
from typing import Any, Iterable

from src.explainer.models import (
    EditorialAction,
    EditorialPlan,
    EditorialScriptSegment,
    EditorialSegment,
)


INTRO_SECONDS = 3.0
OUTRO_SECONDS = 2.5


# The text is a Spanish editorial translation of the already-transcribed
# source. It is intentionally a generic narrator script, not a recreated voice
# or a claim that the original speaker said these Spanish words.
OBAMA_SPANISH_SCRIPT: tuple[EditorialScriptSegment, ...] = (
    EditorialScriptSegment(
        source_start=0.0, source_end=18.24,
        title="El llamado",
        text=("Poco después de las protestas de Stonewall, hace cuarenta años, sonó el teléfono en la casa de Gene Manford, una maestra de primaria de voz serena. Era la una de la mañana. Llamaba la policía."),
        emphasis=["LA UNA DE LA MAÑANA"], phase="FASE 1 · EL LLAMADO", emotion="serious",
    ),
    EditorialScriptSegment(
        source_start=18.24, source_end=36.48,
        title="Una nueva convicción",
        text=("Su hijo Morty había estado en Stonewall la noche de los disturbios. Desde entonces sentía un nuevo propósito. Cuando el agente dijo que lo habían arrestado, algo que ocurría con frecuencia, Gene no se sorprendió."),
        emphasis=["UN NUEVO PROPÓSITO"], phase=None, emotion="serious",
    ),
    EditorialScriptSegment(
        source_start=36.48, source_end=54.72,
        title="La respuesta",
        text=("Pero el agente añadió: «Y usted sabe que él es homosexual». El policía esperaba otra reacción. Gene respondió: «Sí, lo sé. ¿Por qué lo están molestando?»."),
        emphasis=["¿POR QUÉ LO ESTÁN MOLESTANDO?"], phase="FASE 2 · LA RESPUESTA", emotion="resolute",
    ),
    EditorialScriptSegment(
        source_start=54.72, source_end=72.97,
        title="Caminar juntos",
        text=("Poco después, Gene marchó junto a su hijo por las calles de Nueva York. Llevaba un cartel de apoyo. La gente la aplaudía y muchos jóvenes le pedían que hablara con sus padres."),
        emphasis=["CAMINAR JUNTOS"], phase=None, emotion="warm",
    ),
    EditorialScriptSegment(
        source_start=72.97, source_end=91.21,
        title="Una idea colectiva",
        text=("Aquella marcha les dio una idea. En el aniversario de Stonewall, en medio de la violencia y la tensión de un país dividido, Gene y su esposo Jules decidieron apoyar a otros padres y también a sus hijos."),
        emphasis=["APOYAR A OTROS PADRES"], phase="FASE 3 · LA CAUSA", emotion="resolute",
    ),
    EditorialScriptSegment(
        source_start=91.21, source_end=109.45,
        title="El primer paso",
        text=("En la primera reunión, celebrada en mil novecientos setenta y tres, llegaron unas veinte personas. Poco a poco el interés creció. La vida de Morty terminó trágicamente a causa del sida, pero la causa continuó."),
        emphasis=["LA CAUSA CONTINUÓ"], phase=None, emotion="serious",
    ),
    EditorialScriptSegment(
        source_start=109.45, source_end=127.69,
        title="El alcance",
        text=("Hoy, la organización que fundaron para padres, familias y amigos de personas lesbianas y gays cuenta con más de doscientos mil miembros y colaboradores. Ha cambiado la vida de innumerables familias."),
        emphasis=["MÁS DE 200.000 PERSONAS"], phase=None, emotion="resolute",
    ),
    EditorialScriptSegment(
        source_start=127.69, source_end=145.93,
        title="No iba a permitirlo",
        text=("Gene diría después: «Siempre me consideré una persona tradicional. Ni siquiera cruzaba la calle con el semáforo en rojo. Pero no iba a permitir que nadie pisoteara a Morty»."),
        emphasis=["NO IBA A PERMITIRLO"], phase=None, emotion="resolute",
    ),
    EditorialScriptSegment(
        source_start=145.93, source_end=164.17,
        title="Esperanza contra el odio",
        text=("Esa es la historia de ciudadanos comunes que se organizan y defienden el cambio. Esperanza más fuerte que el odio. Amor más poderoso que cualquier insulto o herida."),
        emphasis=["ESPERANZA MÁS FUERTE QUE EL ODIO"], phase="FASE 4 · LA PROMESA", emotion="warm",
    ),
    EditorialScriptSegment(
        source_start=164.17, source_end=182.413,
        title="La promesa",
        text=("Personas que luchan para construir una nación en la que nadie sea un ciudadano de segunda clase, donde nadie pierda sus derechos básicos y todos sean libres para vivir. Esa es la promesa que debemos cumplir, día a día, ley a ley, mente a mente."),
        emphasis=["DÍA A DÍA · MENTE A MENTE"], phase=None, emotion="resolute",
    ),
)


def _safe_script(script_segments: Iterable[EditorialScriptSegment] | None, source_duration: float) -> list[EditorialScriptSegment]:
    requested = list(script_segments or ())
    if not requested and 160 <= source_duration <= 210:
        requested = list(OBAMA_SPANISH_SCRIPT)
    if not requested:
        span = max(4.0, source_duration / 6)
        requested = [
            EditorialScriptSegment(
                source_start=index * span,
                source_end=min(source_duration, (index + 1) * span),
                title=f"Idea {index + 1}",
                text="Contenido narrado pendiente de adaptación editorial.",
                emphasis=["IDEA PRINCIPAL"],
                phase=None,
            )
            for index in range(max(1, int(source_duration // span)))
        ]
    result: list[EditorialScriptSegment] = []
    for item in requested:
        start = max(0.0, min(source_duration, float(item.source_start)))
        end = max(start + 0.2, min(source_duration, float(item.source_end)))
        if end <= start:
            continue
        result.append(item.model_copy(update={"source_start": start, "source_end": end}))
    return result


def build_editorial_plan(
    source_duration: float,
    *,
    source_label: str,
    script_segments: Iterable[EditorialScriptSegment] | None = None,
    audio_provider: str = "pending",
) -> EditorialPlan:
    script = _safe_script(script_segments, source_duration)
    total = INTRO_SECONDS + source_duration + OUTRO_SECONDS
    segments: list[EditorialSegment] = []
    actions: list[EditorialAction] = [
        EditorialAction(
            id="intro",
            type="intro",
            start=0,
            end=INTRO_SECONDS,
            text="UNA PROMESA QUE SOBREVIVE",
            position="center",
            payload={"logo": "nexa-pyramid-placeholder", "disclosure": "DOBLAJE SINTÉTICO EN ESPAÑOL"},
        ),
        EditorialAction(
            id="global-grade",
            type="dark_filter",
            start=INTRO_SECONDS,
            end=INTRO_SECONDS + source_duration,
            intensity=0.23,
            payload={"brightness": 0.82, "saturation": 0.76, "contrast": 1.08},
        ),
    ]
    for index, item in enumerate(script):
        timeline_start = INTRO_SECONDS + item.source_start
        timeline_end = INTRO_SECONDS + item.source_end
        phase = item.phase
        segment = EditorialSegment(
            id=f"segment-{index + 1:02d}",
            source_start=round(item.source_start, 3),
            source_end=round(item.source_end, 3),
            timeline_start=round(timeline_start, 3),
            timeline_end=round(timeline_end, 3),
            title=item.title or f"Idea {index + 1}",
            narration=item.text,
            emphasis=item.emphasis,
            phase=phase,
            emotion=item.emotion,
            cut="hard_cut",
            reframe={"scale": 1.0 + (0.018 if index % 3 == 1 else 0.0), "x": -0.6 if index % 2 else 0.6},
        )
        segments.append(segment)
        actions.append(
            EditorialAction(
                id=f"cut-{index + 1:02d}", type="cut", start=timeline_start, end=min(timeline_end, timeline_start + 0.18),
                position="center", intensity=0.85,
                payload={"source_start": item.source_start, "source_end": item.source_end, "mode": "hard_cut_black_flash", "reframe": segment.reframe},
            )
        )
        if index in {0, 2, 4, 7, len(script) - 1}:
            actions.append(
                EditorialAction(
                    id=f"title-{index + 1:02d}", type="title", start=min(timeline_end - 0.5, timeline_start + 0.8), end=min(timeline_end, timeline_start + 4.5),
                    text=segment.title, position="left" if index % 2 == 0 else "right", intensity=0.95,
                    payload={"kicker": "", "supporting": "", "font_scale": 1.0},
                )
            )
        if item.emphasis:
            emphasis_start = min(timeline_end - 0.8, timeline_start + max(3.0, (timeline_end - timeline_start) * 0.47))
            actions.append(
                EditorialAction(
                    id=f"emphasis-{index + 1:02d}", type="emphasis", start=emphasis_start, end=min(timeline_end, emphasis_start + 1.65),
                    text=item.emphasis[0], position="left" if index % 2 == 0 else "right", intensity=1.0,
                    payload={"style": "impact_word", "audio_duck_db": -5},
                )
            )
        if phase:
            phase_start = min(timeline_end - 0.7, timeline_start + 0.22)
            actions.append(
                EditorialAction(
                id=f"phase-{index + 1:02d}", type="phase", start=phase_start, end=min(timeline_end, phase_start + 1.55),
                    text=phase, position="center", intensity=1.0,
                    payload={"blackout": True, "sound": "low_impact", "transition": "black_hold"},
                )
            )
    actions.append(
        EditorialAction(
            id="outro", type="outro", start=INTRO_SECONDS + source_duration, end=total,
            text="EL CAMBIO COMIENZA CUANDO ALGUIEN DECIDE NO CALLAR",
            position="center", payload={"logo": "nexa-pyramid-placeholder", "disclosure": "DOBLAJE SINTÉTICO EN ESPAÑOL"},
        )
    )
    return EditorialPlan(
        source_label=source_label,
        source_duration_seconds=round(source_duration, 3),
        duration_seconds=round(total, 3),
        brand={
            "logo_asset": "nexa-pyramid-placeholder",
            "logo_status": "placeholder_until_portfolio_svg_is_provided",
            "palette": {"primary": "#000000", "foreground": "#FFFFFF", "muted": "#AAAAAA", "accent": "#FFFFFF"},
            "typography": {"display": "Space Grotesk", "body": "Inter", "fallbacks": ["Helvetica Neue", "Arial", "sans-serif"]},
        },
        audio={
            "provider": audio_provider,
            "language": "es",
            "mode": "synthetic_narration",
            "source_voice_imitation": False,
            "disclosure": "Voz sintética genérica; no imita la voz de la persona del video.",
        },
        grade={
            "base_filter": "dark_editorial",
            "black_overlay_opacity": 0.23,
            "phase_blackout_opacity": 0.98,
            "allowed": ["brightness", "saturation", "contrast", "black_overlay", "subtle_grain"],
        },
        segments=segments,
        actions=sorted(actions, key=lambda action: (action.start, action.end, action.id)),
        quality_gates=[
            "El material de origen debe tener autorización o licencia para edición y publicación.",
            "La voz generada debe permanecer identificada como sintética y no imitar al orador.",
            "Toda cifra o afirmación visual debe trazarse a la transcripción fuente.",
            "Revisión humana obligatoria antes de aprobar o publicar.",
        ],
        warnings=[
            "El logo de pirámide es un placeholder porque no se encontró un SVG del portafolio en el workspace.",
            "La traducción es editorial y debe revisarse contra el discurso original antes de publicar.",
        ],
    )


def _script_json(plan: EditorialPlan) -> str:
    return json.dumps(plan.model_dump(mode="json"), ensure_ascii=False).replace("<", "\\u003c")


def apply_emotional_grade(plan: EditorialPlan, analysis: dict[str, Any]) -> EditorialPlan:
    """Turn the validated DeepSeek emotion curve into restrained B/W grades."""
    by_id = {
        item.get("id"): item
        for item in analysis.get("segments", [])
        if isinstance(item, dict) and item.get("id")
    }
    additions: list[EditorialAction] = []
    for segment in plan.segments:
        item = by_id.get(segment.id, {})
        emotion = item.get("emotion") if isinstance(item.get("emotion"), dict) else {}
        try:
            intensity = max(0.0, min(1.0, float(emotion.get("intensity", 0.5))))
        except (TypeError, ValueError):
            intensity = 0.5
        additions.append(EditorialAction(
            id=f"grade-{segment.id}", type="emotion_grade",
            start=segment.timeline_start, end=segment.timeline_end,
            intensity=intensity,
            payload={
                "black_overlay_opacity": round(0.11 + intensity * 0.14, 3),
                "contrast": round(1.08 + intensity * 0.08, 3),
                "source_emotion": str(emotion.get("primary") or "serious")[:80],
            },
        ))
    return plan.model_copy(update={
        "actions": sorted([*(action for action in plan.actions if action.type != "emotion_grade"), *additions], key=lambda action: (action.start, action.end, action.id)),
        "grade": {**plan.grade, "source": "deepseek_emotional_analysis", "palette": "monochrome"},
    })


def build_editorial_recut_html(
    plan: EditorialPlan,
    *,
    video_src: str = "editorial-source.mp4",
    audio_src: str = "editorial-narration.wav",
) -> str:
    spec = _script_json(plan)
    raw_variants = plan.audio.get("variants") if isinstance(plan.audio, dict) else None
    variants = raw_variants if isinstance(raw_variants, dict) and raw_variants else {
        "default": {
            "label": f"{plan.audio.get('voice', 'Voz sintética')} · narración editorial",
            "filename": audio_src.removeprefix("../"),
            "voice": plan.audio.get("voice", "Voz sintética"),
        },
    }
    audio_variants = {
        key: {
            **value,
            "src": "../" + str(value.get("filename") or audio_src.removeprefix("../")),
        }
        for key, value in variants.items()
        if isinstance(value, dict)
    }
    font_dir = Path(__file__).resolve().parent / "assets" / "fonts"
    font_faces = []
    for family, filename in (
        ("Inter", "Inter-Variable.ttf"),
        ("Space Grotesk", "SpaceGrotesk-Variable.ttf"),
        ("Playfair Display", "PlayfairDisplay-Variable.ttf"),
    ):
        path = font_dir / filename
        if path.is_file():
            encoded = base64.b64encode(path.read_bytes()).decode("ascii")
            font_faces.append(
                f"@font-face{{font-family:'{family}';font-style:normal;font-weight:100 900;"
                f"font-display:block;src:url(data:font/ttf;base64,{encoded}) format('truetype')}}"
            )
    # `__VIDEO_SRC__` is inside an HTML attribute, not a JavaScript string.
    # Serializing it with json.dumps would generate src=""file.mp4"" and
    # prevent Chromium from loading the media asset in the preview.
    return (
        _HTML.replace("__PLAN__", spec)
        .replace("__AUDIO_VARIANTS__", json.dumps(audio_variants, ensure_ascii=False).replace("<", "\\u003c"))
        .replace("__FONT_FACE__", "\n".join(font_faces))
        .replace("__VIDEO_SRC__", video_src)
        .replace("__AUDIO_SRC__", audio_src)
    )


_HTML = r'''<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Editorial Recut</title>
  <style>
    __FONT_FACE__
    * { box-sizing:border-box; }
    html,body { width:100%;height:100%;margin:0;overflow:hidden;background:#000; }
    body { display:grid;place-items:center;color:#fff;font-family:Inter,"Helvetica Neue",Arial,sans-serif; }
    .stage { position:relative;width:min(100vw,177.7778vh);height:min(100vh,56.25vw);aspect-ratio:16/9;overflow:hidden;background:#000;isolation:isolate;--ink:#fff;--muted:rgba(255,255,255,.68);--panel:rgba(0,0,0,.66);--line:rgba(255,255,255,.25); }
    #source { position:absolute;inset:0;width:100%;height:100%;display:block;object-fit:cover;transform:scale(1);transition:transform .55s cubic-bezier(.2,.75,.2,1);filter:grayscale(1) brightness(.94) contrast(1.12); }
    .dark-filter { position:absolute;inset:0;z-index:2;background:linear-gradient(90deg,rgba(0,0,0,.42),transparent 37%,transparent 63%,rgba(0,0,0,.42)),#000;opacity:.23;pointer-events:none;transition:opacity .5s ease; }
    .grain { position:absolute;inset:0;z-index:3;opacity:.055;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.45) .55px,transparent .7px);background-size:4px 4px;mix-blend-mode:screen; }
    .colour-wash { position:absolute;inset:0;z-index:3;pointer-events:none;opacity:0;mix-blend-mode:soft-light;background:radial-gradient(circle at 16% 18%,rgba(255,184,99,.52),transparent 31%),radial-gradient(circle at 83% 82%,rgba(139,55,25,.46),transparent 36%);transition:opacity .4s ease; }
    .motion-canvas { position:absolute;inset:0;z-index:3;display:none;width:100%;height:100%;pointer-events:none;opacity:.7;mix-blend-mode:screen; }
    .three-stage { position:absolute;inset:0;z-index:3;display:none;pointer-events:none;opacity:.74;mix-blend-mode:screen; }
    .three-stage canvas { display:block;width:100%;height:100%; }
    .vignette { position:absolute;inset:0;z-index:4;pointer-events:none;background:radial-gradient(circle at center,transparent 42%,rgba(0,0,0,.54) 100%);opacity:.35;transition:opacity .3s ease; }
    .scanlines { position:absolute;inset:0;z-index:4;pointer-events:none;opacity:0;background:repeating-linear-gradient(0deg,rgba(255,235,215,.075) 0 1px,transparent 1px 4px);mix-blend-mode:overlay;transition:opacity .2s ease; }
    .critical-flash { position:absolute;inset:0;z-index:9;pointer-events:none;background:linear-gradient(115deg,rgba(255,230,189,.82),rgba(255,255,255,.13) 34%,rgba(82,25,7,.42));opacity:0;mix-blend-mode:screen; }
    .critical-flash.is-visible { animation:critical-flash .42s ease-out both; }
    @keyframes critical-flash { 0%{opacity:0} 18%{opacity:.85} 100%{opacity:0} }
    .top-rail { display:none; }
    .copy { position:absolute;z-index:5;left:5.4vw;bottom:18vh;width:min(34vw,650px);display:grid;gap:1.35vh;opacity:0;transform:translateY(15px);transition:opacity .28s ease,transform .38s cubic-bezier(.2,.75,.2,1);pointer-events:none; }
    .copy[data-position="right"] { left:auto;right:5.4vw;text-align:right;align-items:end; }
    .copy.is-visible { opacity:1;transform:none; }
    .kicker { color:var(--ink);font-size:clamp(10px,.72vw,15px);font-weight:700;letter-spacing:.2em;text-transform:uppercase; }
    .kicker:empty,.supporting:empty { display:none; }
    .title { margin:0;max-width:12em;color:var(--ink);font-family:"Space Grotesk",Inter,Arial,sans-serif;font-size:clamp(42px,5.6vw,116px);line-height:.88;letter-spacing:-.08em;text-wrap:balance;text-shadow:0 4px 22px rgba(0,0,0,.55); }
    .supporting { max-width:26em;color:rgba(255,255,255,.68);font-size:clamp(12px,1vw,20px);line-height:1.4; }
    .emphasis { position:absolute;z-index:6;left:5.4vw;top:19vh;max-width:49vw;color:var(--ink);font-family:"Space Grotesk",Inter,Arial,sans-serif;font-size:clamp(32px,5vw,104px);font-weight:600;line-height:.9;letter-spacing:-.08em;opacity:0;transform:translateX(-22px);transition:opacity .22s ease,transform .28s cubic-bezier(.2,.75,.2,1);pointer-events:none;text-shadow:0 4px 20px rgba(0,0,0,.7); }
    .emphasis[data-position="right"] { left:auto;right:5.4vw;text-align:right;transform:translateX(22px); }
    .emphasis.is-visible { opacity:1;transform:none; }
    .emphasis::before { content:"";display:block;width:3.2em;height:2px;background:#fff;margin-bottom:1.1vh;transform-origin:left;animation:rule-in .35s ease both; }
    @keyframes rule-in { from { transform:scaleX(0); } to { transform:scaleX(1); } }
    .phase,.intro,.outro { position:absolute;inset:0;z-index:10;display:grid;place-items:center;background:#000;opacity:0;pointer-events:none;transition:opacity .12s ease; }
    .phase.is-visible,.intro.is-visible,.outro.is-visible { opacity:1; }
    .phase-inner,.brand-lockup { display:grid;gap:1.5vh;place-items:center;text-align:center; }
    .brand-lockup { width:min(90vw,1500px);min-height:76%;align-content:center; }
    .phase-number { color:#aaa;font:700 clamp(11px,1vw,17px)/1 Inter,Arial,sans-serif;letter-spacing:.25em;text-transform:uppercase; }
    .phase-title,.outro-title { margin:0;max-width:92vw;color:var(--ink);font:700 clamp(52px,8.8vw,180px)/.82 "Space Grotesk",Inter,Arial,sans-serif;letter-spacing:-.105em;text-wrap:balance; }
    .phase-description,.intro-description,.outro-description { margin:0;max-width:43em;color:var(--muted);font:500 clamp(12px,1.1vw,20px)/1.4 Inter,Arial,sans-serif;letter-spacing:.015em; }
    .phase-inner { width:min(92vw,1560px);min-height:58%;padding:4vh 4vw;border-top:1px solid var(--line);border-bottom:1px solid var(--line); }
    .phase-description { max-width:34em;text-transform:uppercase;letter-spacing:.14em;font-size:clamp(10px,.86vw,16px); }
    .intro-title { order:1;width:min(88vw,980px);max-width:88vw;font-size:clamp(70px,11vw,220px);line-height:.75;text-transform:uppercase; }
    .intro-description { order:2;max-width:34em; }
    .intro .prism-mark,.intro .template-glyph,.intro .prism-word,.outro .prism-mark,.outro .template-glyph,.outro .prism-word { order:3; }
    .intro .prism-word,.outro .prism-word { margin-top:-.8vh; }
    .intro .disclosure,.outro .disclosure { order:4; }
    .intro.is-visible .prism-mark,.intro.is-visible .template-glyph,.outro.is-visible .prism-mark,.outro.is-visible .template-glyph { animation:mark-spin 1.85s cubic-bezier(.16,.78,.2,1) both; }
    @keyframes mark-spin { 0%{opacity:0;transform:rotate(-150deg) scale(.35)} 65%{opacity:1;transform:rotate(18deg) scale(1.06)} 100%{opacity:1;transform:rotate(0) scale(1)} }
    .pyramid { width:clamp(46px,5vw,100px);height:clamp(46px,5vw,100px); }
    .pyramid polygon { fill:#fff; }
    .pyramid path { fill:#000; }
    .disclosure { color:#aaa;font-size:clamp(9px,.7vw,14px);letter-spacing:.16em;text-transform:uppercase; }
    .cut-flash { position:absolute;inset:0;z-index:9;background:#000;opacity:0;pointer-events:none; }
    .cut-flash.is-visible { opacity:.83; }
    .preview-controls { position:absolute;left:5.4vw;right:5.4vw;bottom:3.2vh;z-index:20;display:flex;align-items:center;gap:10px;padding:10px 12px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.62);backdrop-filter:blur(12px);color:#fff;font:600 11px/1 Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase; }
    .preview-controls button { border:1px solid rgba(255,255,255,.28);background:rgba(255,255,255,.08);color:#fff;padding:8px 10px;cursor:pointer;font:inherit;letter-spacing:inherit;white-space:nowrap; }
    .preview-controls button:hover,.preview-controls button:focus-visible { border-color:#fff;color:#fff;outline:none; }
    .preview-controls input[type="range"] { flex:1;min-width:100px;accent-color:#fff;cursor:pointer; }
    .preview-controls .status { color:#aaa;white-space:nowrap; }
    .design-panel { position:absolute;right:3.3vw;top:3.2vh;z-index:22;width:min(25vw,360px);padding:14px 15px 16px;border:1px solid var(--line);background:var(--panel);backdrop-filter:blur(16px);font:600 11px/1.25 Inter,"Helvetica Neue",Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase; }
    .design-panel h2 { margin:0 0 13px;color:var(--ink);font:600 14px/1 "Space Grotesk",Inter,sans-serif;letter-spacing:.01em;text-transform:none; }
    .control-row { display:grid;gap:6px;margin-top:11px;color:var(--muted); }
    .control-row select { width:100%;appearance:none;border:1px solid var(--line);border-radius:0;background:rgba(0,0,0,.34);color:var(--ink);padding:10px 30px 10px 10px;font:600 12px/1 Inter,Arial,sans-serif;background-image:linear-gradient(45deg,transparent 50%,currentColor 50%),linear-gradient(135deg,currentColor 50%,transparent 50%);background-position:calc(100% - 14px) 50%,calc(100% - 9px) 50%;background-size:5px 5px,5px 5px;background-repeat:no-repeat; }
    .control-note { margin:11px 0 0;color:var(--muted);font-size:10px;line-height:1.45;letter-spacing:.04em;text-transform:none; }
    .icon-slot { position:absolute;right:5.4vw;bottom:17vh;z-index:7;width:clamp(48px,5.7vw,110px);height:clamp(48px,5.7vw,110px);display:grid;place-items:center;opacity:0;transform:translateY(14px) scale(.9);color:var(--ink);border:1px solid rgba(255,255,255,.52);background:rgba(0,0,0,.17);backdrop-filter:blur(4px);transition:opacity .2s ease,transform .3s cubic-bezier(.2,.75,.2,1),color .2s ease; }
    .icon-slot.is-visible { opacity:1;transform:none; }
    .icon-slot svg { width:52%;height:52%;stroke:currentColor;stroke-width:1.55;fill:none;stroke-linecap:round;stroke-linejoin:round; }
    .prism-mark { width:clamp(76px,9vw,176px);height:clamp(76px,9vw,176px);overflow:visible; }
    .prism-mark polygon { fill:none;stroke:var(--ink);stroke-width:.34;transform-origin:50% 55%;opacity:calc(.15 + var(--i) * .08);animation:prism-echo 2.2s cubic-bezier(.2,.7,.2,1) both;animation-delay:calc(var(--i) * .055s); }
    @keyframes prism-echo { from { transform:rotate(-125deg) scale(.16);opacity:0 } to { transform:rotate(0) scale(1); } }
    .prism-word { color:var(--ink);font:700 clamp(10px,.8vw,16px)/1 Inter,Arial,sans-serif;letter-spacing:.38em;text-indent:.38em; }
    .template-glyph { width:clamp(58px,7vw,132px);height:clamp(58px,7vw,132px);border:1px solid var(--ink);transform:rotate(45deg);opacity:.85;position:relative; }
    .template-glyph::before,.template-glyph::after { content:"";position:absolute;background:var(--ink);opacity:.8; }
    .template-glyph::before { width:1px;height:145%;left:50%;top:-22%;transform:rotate(45deg); }
    .template-glyph::after { height:1px;width:145%;left:-22%;top:50%;transform:rotate(45deg); }
    .stage[data-template="prism-echo"] { --ink:#fff7ed;--muted:rgba(255,231,203,.72);--panel:rgba(30,16,10,.54);--line:rgba(255,226,193,.37); }
    .stage[data-template="prism-echo"] .colour-wash { opacity:.9; }
    .stage[data-template="prism-echo"] .vignette { opacity:.75; }
    .stage[data-template="prism-echo"] .scanlines { opacity:.24; }
    .stage[data-template="prism-echo"] .dark-filter { background:linear-gradient(90deg,rgba(22,9,4,.57),transparent 44%,rgba(27,10,4,.42)),linear-gradient(180deg,rgba(25,7,2,.18),transparent 45%,rgba(0,0,0,.34)); }
    .stage[data-template="prism-echo"] .title,.stage[data-template="prism-echo"] .emphasis { text-shadow:0 4px 26px rgba(0,0,0,.78); }
    .stage[data-template="prism-echo"] .emphasis::before { background:linear-gradient(90deg,#ffe2bb,rgba(255,226,187,.1)); }
    .stage[data-template="noir-editorial"] { --ink:#f5f5f2;--muted:rgba(245,245,242,.62);--panel:rgba(4,4,4,.72);--line:rgba(255,255,255,.26);background:#050505; }
    .stage[data-template="noir-editorial"] .colour-wash { opacity:0; }
    .stage[data-template="noir-editorial"] .vignette { opacity:.88;background:radial-gradient(circle at 51% 48%,transparent 24%,rgba(0,0,0,.72) 100%); }
    .stage[data-template="noir-editorial"] .scanlines { opacity:.12;background:repeating-linear-gradient(0deg,rgba(255,255,255,.08) 0 1px,transparent 1px 5px); }
    .stage[data-template="noir-editorial"] #source { filter:grayscale(1) contrast(1.28) brightness(.86); }
    .stage[data-template="noir-editorial"] .dark-filter { background:linear-gradient(90deg,rgba(0,0,0,.76),transparent 42%,rgba(0,0,0,.6)),#000; }
    .stage[data-template="noir-editorial"] .copy { left:5.4vw;top:14vh;bottom:auto;width:min(45vw,820px); }
    .stage[data-template="noir-editorial"] .copy[data-position="right"] { left:5.4vw;right:auto;text-align:left;align-items:start; }
    .stage[data-template="noir-editorial"] .title { font-size:clamp(50px,7.2vw,148px);text-transform:uppercase;letter-spacing:-.105em; }
    .stage[data-template="noir-editorial"] .emphasis { top:auto;bottom:20vh;font-size:clamp(40px,6.3vw,132px);text-transform:uppercase; }
    .stage[data-template="noir-editorial"] .template-glyph { border-radius:50%;transform:none;border-width:2px; }
    .stage[data-template="noir-editorial"] .prism-mark { display:none; }
    .stage[data-template="noir-editorial"] .template-glyph::before { width:72%;height:2px;left:14%;top:50%;transform:none; }
    .stage[data-template="noir-editorial"] .template-glyph::after { height:72%;width:2px;left:50%;top:14%;transform:none; }
    .stage[data-template="noir-editorial"] .intro,.stage[data-template="noir-editorial"] .outro { background:#f5f5f2;--ink:#080808; }
    .stage[data-template="noir-editorial"] .phase { background:#000;--ink:#fff;--muted:rgba(255,255,255,.62);--line:rgba(255,255,255,.36); }
    .stage[data-template="noir-editorial"] .intro-title,.stage[data-template="noir-editorial"] .phase-title,.stage[data-template="noir-editorial"] .outro-title { font-family:Inter,Arial,sans-serif;font-weight:900;letter-spacing:-.115em; }
    .stage[data-template="noir-editorial"] .intro-description,.stage[data-template="noir-editorial"] .outro-description { max-width:32em;text-transform:uppercase;letter-spacing:.12em;font-size:clamp(10px,.82vw,15px); }
    .stage[data-template="noir-editorial"] .phase-description { color:#9d9d98; }
    .stage[data-template="noir-editorial"] .phase-number,.stage[data-template="noir-editorial"] .disclosure { color:#595959; }
    .stage[data-template="noir-editorial"] .prism-mark { filter:invert(1); }
    .stage[data-template="archive-signal"] { --ink:#341c12;--muted:rgba(52,28,18,.68);--panel:rgba(239,222,194,.91);--line:rgba(52,28,18,.28);background:#ead9bd; }
    .stage[data-template="archive-signal"] #source { inset:0 auto 0 0;width:64%;height:100%;object-fit:cover;clip-path:polygon(0 0,100% 0,92% 100%,0 100%); }
    .stage[data-template="archive-signal"] .dark-filter { right:36%;background:linear-gradient(90deg,rgba(49,22,12,.48),transparent 80%);opacity:.2; }
    .stage[data-template="archive-signal"] .colour-wash { opacity:.68;mix-blend-mode:multiply;background:linear-gradient(90deg,rgba(132,53,21,.24),transparent 74%),radial-gradient(circle at 60% 15%,rgba(239,184,107,.28),transparent 36%); }
    .stage[data-template="archive-signal"] .vignette { opacity:.22;background:radial-gradient(circle at 32% 50%,transparent 36%,rgba(58,25,10,.35) 100%); }
    .stage[data-template="archive-signal"] .scanlines { opacity:0; }
    .stage[data-template="archive-signal"] .grain { opacity:.09;background-image:radial-gradient(rgba(64,26,10,.55) .55px,transparent .7px);mix-blend-mode:multiply; }
    .stage[data-template="archive-signal"] .copy { left:auto;right:5.5vw;bottom:18vh;width:27vw;align-items:start;color:var(--ink); }
    .stage[data-template="archive-signal"] .copy[data-position="right"] { right:5.5vw;text-align:left;align-items:start; }
    .stage[data-template="archive-signal"] .title { color:var(--ink);font-family:"Playfair Display",Georgia,serif;font-size:clamp(38px,4.3vw,88px);font-weight:650;line-height:.93;letter-spacing:-.055em;text-shadow:none; }
    .stage[data-template="archive-signal"] .kicker { color:#9a3d1e;letter-spacing:.28em; }
    .stage[data-template="archive-signal"] .emphasis { left:auto;right:5.5vw;top:18vh;max-width:30vw;color:#9a3d1e;font-family:"Playfair Display",Georgia,serif;text-shadow:none; }
    .stage[data-template="archive-signal"] .emphasis::before { background:#9a3d1e; }
    .stage[data-template="archive-signal"] .icon-slot { right:38%;bottom:16vh;color:#9a3d1e;border-color:rgba(154,61,30,.52);background:rgba(239,222,194,.36); }
    .stage[data-template="archive-signal"] .intro,.stage[data-template="archive-signal"] .outro { background:#ead9bd;--ink:#341c12; }
    .stage[data-template="archive-signal"] .phase { background:#000;--ink:#f1dfc2;--muted:rgba(241,223,194,.68);--line:rgba(241,223,194,.34); }
    .stage[data-template="archive-signal"] .phase-number,.stage[data-template="archive-signal"] .disclosure { color:#8d6d58; }
    .stage[data-template="archive-signal"] .phase-title,.stage[data-template="archive-signal"] .outro-title { font-family:"Playfair Display",Georgia,serif;letter-spacing:-.04em; }
    .stage[data-template="archive-signal"] .intro-title { font-family:"Playfair Display",Georgia,serif;font-weight:700;letter-spacing:-.065em;text-transform:none;line-height:.82; }
    .stage[data-template="archive-signal"] .intro-description,.stage[data-template="archive-signal"] .outro-description { max-width:31em;font-family:"Playfair Display",Georgia,serif;font-size:clamp(14px,1.25vw,24px); }
    .stage[data-template="archive-signal"] .phase-description { color:#c5a988; }
    .stage[data-template="archive-signal"] .prism-mark { display:none; }
    .stage[data-template="archive-signal"] .template-glyph { border-color:#9a3d1e;border-radius:50%;transform:none; }
    .stage[data-template="archive-signal"] .template-glyph::before { background:#9a3d1e;width:68%;height:1px;left:16%;top:50%;transform:rotate(30deg); }
    .stage[data-template="archive-signal"] .template-glyph::after { background:#9a3d1e;height:68%;width:1px;left:50%;top:16%;transform:rotate(30deg); }
    .stage[data-template="emerald-covenant"] { --ink:#e9ffeb;--muted:rgba(211,255,218,.72);--panel:rgba(2,24,15,.78);--line:rgba(137,255,157,.36);background:#03130c; }
    .stage[data-template="emerald-covenant"] #source { filter:brightness(.7) contrast(1.38) saturate(.72) hue-rotate(58deg); }
    .stage[data-template="emerald-covenant"] .dark-filter { background:linear-gradient(90deg,rgba(0,12,7,.84),transparent 44%,rgba(0,9,5,.68)),linear-gradient(180deg,rgba(0,26,14,.18),rgba(0,0,0,.56)); }
    .stage[data-template="emerald-covenant"] .colour-wash { opacity:.78;mix-blend-mode:screen;background:radial-gradient(circle at 19% 16%,rgba(51,255,124,.2),transparent 27%),radial-gradient(circle at 77% 72%,rgba(0,98,58,.42),transparent 42%); }
    .stage[data-template="emerald-covenant"] .motion-canvas { display:block;color:#83ff9a;opacity:.58; }
    .stage[data-template="emerald-covenant"] .vignette { opacity:.9;background:radial-gradient(circle at 50% 45%,transparent 28%,rgba(0,0,0,.82) 100%); }
    .stage[data-template="emerald-covenant"] .scanlines { opacity:.1;background:repeating-linear-gradient(0deg,rgba(155,255,175,.1) 0 1px,transparent 1px 6px); }
    .stage[data-template="emerald-covenant"] .title,.stage[data-template="emerald-covenant"] .emphasis { color:#c9ffd1;text-shadow:0 0 22px rgba(70,255,125,.32); }
    .stage[data-template="emerald-covenant"] .emphasis::before { background:#76ff91;box-shadow:0 0 16px rgba(118,255,145,.65); }
    .stage[data-template="emerald-covenant"] .template-glyph { border-color:#76ff91;border-radius:50%;transform:rotate(45deg);box-shadow:0 0 24px rgba(76,255,126,.38),inset 0 0 18px rgba(76,255,126,.15); }
    .stage[data-template="emerald-covenant"] .template-glyph::before,.stage[data-template="emerald-covenant"] .template-glyph::after { background:#76ff91; }
    .stage[data-template="emerald-covenant"] .phase,.stage[data-template="emerald-covenant"] .intro,.stage[data-template="emerald-covenant"] .outro { background:#000;--ink:#e9ffeb;--muted:rgba(211,255,218,.72); }
    .stage[data-template="emerald-covenant"] .phase-title,.stage[data-template="emerald-covenant"] .outro-title { font-family:"Space Grotesk",Inter,Arial,sans-serif;letter-spacing:-.12em;text-shadow:0 0 28px rgba(70,255,125,.28); }
    .stage[data-template="emerald-covenant"] .phase-description { color:#76ff91; }
    .stage[data-template="emerald-covenant"] .icon-slot { color:#76ff91;border-color:rgba(118,255,145,.72);background:rgba(0,31,18,.58);box-shadow:0 0 22px rgba(76,255,126,.22); }
    .stage[data-template="kinetic-scramble"] { --ink:#10100b;--muted:rgba(16,16,11,.68);--panel:rgba(245,243,226,.9);--line:rgba(16,16,11,.28);background:#f1efdf; }
    .stage[data-template="kinetic-scramble"] #source { filter:contrast(1.36) brightness(.94) saturate(1.32) sepia(.18) hue-rotate(-8deg); }
    .stage[data-template="kinetic-scramble"] .dark-filter { background:linear-gradient(90deg,rgba(16,16,10,.5),transparent 50%,rgba(16,16,10,.2));opacity:.27; }
    .stage[data-template="kinetic-scramble"] .colour-wash { opacity:.62;mix-blend-mode:multiply;background:linear-gradient(112deg,rgba(202,255,36,.46),transparent 38%),radial-gradient(circle at 80% 15%,rgba(255,103,0,.25),transparent 32%); }
    .stage[data-template="kinetic-scramble"] .motion-canvas { display:block;opacity:.34;mix-blend-mode:multiply; }
    .stage[data-template="kinetic-scramble"] .vignette { opacity:.2;background:radial-gradient(circle at center,transparent 48%,rgba(27,27,18,.35) 100%); }
    .stage[data-template="kinetic-scramble"] .scanlines { opacity:.06;background:repeating-linear-gradient(0deg,rgba(20,20,10,.24) 0 1px,transparent 1px 5px);mix-blend-mode:multiply; }
    .stage[data-template="kinetic-scramble"] .copy { top:13vh;bottom:auto;left:5.4vw;width:min(45vw,800px); }
    .stage[data-template="kinetic-scramble"] .copy[data-position="right"] { left:auto;right:5.4vw;text-align:right;align-items:end; }
    .stage[data-template="kinetic-scramble"] .title,.stage[data-template="kinetic-scramble"] .emphasis { color:#10100b;font-family:Inter,Arial,sans-serif;font-weight:900;letter-spacing:-.12em;text-transform:uppercase;text-shadow:none; }
    .stage[data-template="kinetic-scramble"] .emphasis::before { background:#ff5a1f; }
    .stage[data-template="kinetic-scramble"] .template-glyph { border-color:#ff5a1f;transform:skewX(-18deg) rotate(45deg); }
    .stage[data-template="kinetic-scramble"] .template-glyph::before,.stage[data-template="kinetic-scramble"] .template-glyph::after { background:#ff5a1f; }
    .stage[data-template="kinetic-scramble"] .phase,.stage[data-template="kinetic-scramble"] .intro,.stage[data-template="kinetic-scramble"] .outro { background:#10100b;--ink:#f4f2df;--muted:rgba(244,242,223,.68);--line:rgba(202,255,36,.42); }
    .stage[data-template="kinetic-scramble"] .phase-title,.stage[data-template="kinetic-scramble"] .outro-title { font-family:Inter,Arial,sans-serif;font-weight:900;letter-spacing:-.13em;text-transform:uppercase; }
    .stage[data-template="kinetic-scramble"] .phase-description { color:#caff24; }
    .stage[data-template="kinetic-scramble"] .icon-slot { color:#ff5a1f;border-color:rgba(255,90,31,.72);background:rgba(244,242,223,.8); }
    .stage[data-template="crimson-walk"] { --ink:#fff3ed;--muted:rgba(255,222,211,.7);--panel:rgba(37,6,8,.76);--line:rgba(255,75,78,.45);background:#120507; }
    .stage[data-template="crimson-walk"] #source { filter:contrast(1.34) brightness(.77) saturate(1.42) sepia(.14) hue-rotate(-18deg); }
    .stage[data-template="crimson-walk"] .dark-filter { background:linear-gradient(0deg,rgba(18,1,4,.76),transparent 48%,rgba(0,0,0,.35)),linear-gradient(90deg,rgba(50,0,4,.44),transparent 53%); }
    .stage[data-template="crimson-walk"] .colour-wash { opacity:.92;mix-blend-mode:soft-light;background:radial-gradient(circle at 50% 85%,rgba(255,43,57,.46),transparent 34%),linear-gradient(0deg,rgba(97,6,16,.3),transparent 52%); }
    .stage[data-template="crimson-walk"] .motion-canvas { display:block;opacity:.68;mix-blend-mode:screen; }
    .stage[data-template="crimson-walk"] .vignette { opacity:.76;background:radial-gradient(circle at 50% 58%,transparent 29%,rgba(8,0,2,.78) 100%); }
    .stage[data-template="crimson-walk"] .copy { left:5.4vw;bottom:14vh;width:min(38vw,720px); }
    .stage[data-template="crimson-walk"] .title,.stage[data-template="crimson-walk"] .emphasis { color:#fff3ed;text-shadow:0 5px 24px rgba(0,0,0,.88); }
    .stage[data-template="crimson-walk"] .emphasis { top:15vh;max-width:52vw;font-family:"Playfair Display",Georgia,serif;font-style:italic; }
    .stage[data-template="crimson-walk"] .emphasis::before { background:#ff3d4f; }
    .stage[data-template="crimson-walk"] .template-glyph { border-color:#ff3d4f;border-radius:50%;transform:scaleX(.62) rotate(45deg);box-shadow:0 0 26px rgba(255,61,79,.34); }
    .stage[data-template="crimson-walk"] .template-glyph::before,.stage[data-template="crimson-walk"] .template-glyph::after { background:#ff3d4f; }
    .stage[data-template="crimson-walk"] .phase,.stage[data-template="crimson-walk"] .intro,.stage[data-template="crimson-walk"] .outro { background:#070102;--ink:#fff3ed;--muted:rgba(255,222,211,.68);--line:rgba(255,61,79,.46); }
    .stage[data-template="crimson-walk"] .phase-title,.stage[data-template="crimson-walk"] .outro-title { font-family:"Playfair Display",Georgia,serif;font-style:italic;letter-spacing:-.06em; }
    .stage[data-template="crimson-walk"] .phase-description { color:#ff6570; }
    .stage[data-template="crimson-walk"] .icon-slot { color:#ff6570;border-color:rgba(255,101,112,.76);background:rgba(39,2,7,.56); }
    .stage[data-template="orbital-stack"] { --ink:#eef0ff;--muted:rgba(211,216,255,.7);--panel:rgba(9,11,31,.76);--line:rgba(139,151,255,.42);background:#070817; }
    .stage[data-template="orbital-stack"] #source { filter:grayscale(.26) brightness(.72) contrast(1.42) saturate(1.32) hue-rotate(168deg); }
    .stage[data-template="orbital-stack"] .dark-filter { background:radial-gradient(circle at 50% 45%,transparent 20%,rgba(4,5,20,.65) 100%),linear-gradient(90deg,rgba(4,5,20,.58),transparent 52%,rgba(4,5,20,.56)); }
    .stage[data-template="orbital-stack"] .colour-wash { opacity:.78;mix-blend-mode:screen;background:radial-gradient(circle at 70% 25%,rgba(89,104,255,.4),transparent 32%),radial-gradient(circle at 21% 78%,rgba(179,78,255,.26),transparent 38%); }
    .stage[data-template="orbital-stack"] .motion-canvas { display:block;opacity:.34;mix-blend-mode:screen; }
    .stage[data-template="orbital-stack"] .three-stage { display:block; }
    .stage[data-template="orbital-stack"] .vignette { opacity:.78;background:radial-gradient(circle at 52% 44%,transparent 30%,rgba(2,3,17,.78) 100%); }
    .stage[data-template="orbital-stack"] .copy { left:auto;right:5.4vw;bottom:16vh;width:min(34vw,640px);text-align:right;align-items:end; }
    .stage[data-template="orbital-stack"] .copy[data-position="left"] { left:auto;right:5.4vw;text-align:right;align-items:end; }
    .stage[data-template="orbital-stack"] .title,.stage[data-template="orbital-stack"] .emphasis { color:#eef0ff;text-shadow:0 0 28px rgba(118,137,255,.6); }
    .stage[data-template="orbital-stack"] .emphasis { top:18vh;left:auto;right:5.4vw;text-align:right; }
    .stage[data-template="orbital-stack"] .emphasis::before { margin-left:auto;background:#9aa6ff; }
    .stage[data-template="orbital-stack"] .template-glyph { border-color:#9aa6ff;border-radius:50%;transform:none;box-shadow:0 0 24px rgba(118,137,255,.4); }
    .stage[data-template="orbital-stack"] .template-glyph::before,.stage[data-template="orbital-stack"] .template-glyph::after { background:#9aa6ff; }
    .stage[data-template="orbital-stack"] .phase,.stage[data-template="orbital-stack"] .intro,.stage[data-template="orbital-stack"] .outro { background:#02030b;--ink:#eef0ff;--muted:rgba(211,216,255,.68);--line:rgba(139,151,255,.46); }
    .stage[data-template="orbital-stack"] .phase-title,.stage[data-template="orbital-stack"] .outro-title { font-family:"Space Grotesk",Inter,Arial,sans-serif;letter-spacing:-.12em; }
    .stage[data-template="orbital-stack"] .phase-description { color:#9aa6ff; }
    .stage[data-template="orbital-stack"] .icon-slot { right:auto;left:5.4vw;color:#9aa6ff;border-color:rgba(154,166,255,.76);background:rgba(8,10,35,.55); }
    [hidden] { display:none !important; }
    @media (max-width:850px) { .preview-controls{left:3vw;right:3vw;bottom:2vh;flex-wrap:wrap}.preview-controls input[type="range"]{order:2;flex-basis:55%}.preview-controls .status{font-size:9px}.design-panel{right:3vw;top:2vh;width:min(45vw,300px)} }
    .outro { z-index:11; }
    @media (max-width:850px) { .copy{width:42vw;bottom:9vh}.emphasis{max-width:52vw}.title{font-size:clamp(28px,6vw,56px)} }
  </style>
</head>
<body>
  <main class="stage" data-mode="source-led-editorial-recut" data-template="prism-echo" data-template-source="VIDEO-prism-echo/index.html">
    <video id="source" src="__VIDEO_SRC__" playsinline preload="auto"></video>
    <audio id="narration" src="__AUDIO_SRC__" preload="auto"></audio>
    <div id="dark-filter" class="dark-filter"></div>
    <div class="colour-wash" aria-hidden="true"></div>
    <div class="vignette" aria-hidden="true"></div>
    <div class="scanlines" aria-hidden="true"></div>
    <div class="grain" aria-hidden="true"></div>
    <canvas id="motion-canvas" class="motion-canvas" aria-hidden="true"></canvas>
    <div id="three-stage" class="three-stage" aria-hidden="true"></div>
    <section id="copy" class="copy" data-position="left"><span id="kicker" class="kicker"></span><h1 id="title" class="title"></h1><span id="supporting" class="supporting"></span></section>
    <strong id="emphasis" class="emphasis" data-position="left"></strong>
    <div id="icon-slot" class="icon-slot" aria-hidden="true"></div>
    <div id="cut-flash" class="cut-flash"></div>
    <div id="critical-flash" class="critical-flash" aria-hidden="true"></div>
    <section id="intro" class="intro is-visible"><div class="brand-lockup"><svg class="prism-mark" viewBox="0 0 100 100" role="img" aria-label="Prism Echo"><polygon style="--i:1" points="50,7 93,82 7,82"/><polygon style="--i:2" points="50,7 93,82 7,82"/><polygon style="--i:3" points="50,7 93,82 7,82"/><polygon style="--i:4" points="50,7 93,82 7,82"/><polygon style="--i:5" points="50,7 93,82 7,82"/><polygon style="--i:6" points="50,7 93,82 7,82"/><polygon style="--i:7" points="50,7 93,82 7,82"/></svg><div class="template-glyph" aria-hidden="true"></div><span class="prism-word brand-word">NEXA</span><h1 class="phase-title intro-title">UNA PROMESA<br>QUE SOBREVIVE</h1><p class="intro-description">Una edición de ideas, tensión y memoria que deja la pantalla respirar.</p><span class="disclosure intro-disclosure">DOBLAJE SINTÉTICO EN ESPAÑOL · VOZ GENÉRICA</span></div></section>
    <section id="phase" class="phase"><div class="phase-inner"><span id="phase-number" class="phase-number"></span><h2 id="phase-title" class="phase-title"></h2><p id="phase-description" class="phase-description"></p></div></section>
    <section id="outro" class="outro"><div class="brand-lockup"><svg class="prism-mark" viewBox="0 0 100 100" role="img" aria-label="Prism Echo"><polygon style="--i:1" points="50,7 93,82 7,82"/><polygon style="--i:2" points="50,7 93,82 7,82"/><polygon style="--i:3" points="50,7 93,82 7,82"/><polygon style="--i:4" points="50,7 93,82 7,82"/><polygon style="--i:5" points="50,7 93,82 7,82"/><polygon style="--i:6" points="50,7 93,82 7,82"/><polygon style="--i:7" points="50,7 93,82 7,82"/></svg><div class="template-glyph" aria-hidden="true"></div><span class="prism-word brand-word">NEXA</span><h2 id="outro-title" class="outro-title"></h2><p class="outro-description">Una idea clara merece una última imagen que permanezca.</p><span class="disclosure outro-disclosure">DOBLAJE SINTÉTICO EN ESPAÑOL · REVISAR DERECHOS ANTES DE PUBLICAR</span></div></section>
    <aside class="design-panel" aria-label="Opciones de dirección visual">
      <h2>Dirección de previsualización</h2>
      <label class="control-row" for="template-select">Plantilla
        <select id="template-select">
          <option value="prism-echo">Prism Echo · cálido y cinematográfico</option>
          <option value="noir-editorial">Noir Manifesto · blanco y negro</option>
          <option value="archive-signal">Archive Signal · editorial cálida</option>
          <option value="emerald-covenant">Emerald Covenant · verde oscuro</option>
          <option value="kinetic-scramble">Kinetic Scramble · tipografía cinética</option>
          <option value="crimson-walk">Crimson Walk · recorrido carmesí</option>
          <option value="orbital-stack">Orbital Stack · órbita 3D</option>
        </select>
      </label>
      <label class="control-row" for="audio-select">Narración
        <select id="audio-select"></select>
      </label>
      <p class="control-note">7 direcciones visuales reutilizables. Cada una tiene intro, cortes, pausas, filtros, tipografía y cierre propios.</p>
    </aside>
    <div id="preview-controls" class="preview-controls" aria-label="Controles de previsualización">
      <button id="play-toggle" type="button">Reproducir</button>
      <button id="reset-preview" type="button">Reiniciar</button>
      <input id="timeline-range" type="range" min="0" max="1" value="0" step="0.01" aria-label="Posición de la previsualización" />
      <span id="timecode" class="status">00:00 / 00:00</span>
      <span id="audio-status" class="status">Audio español</span>
    </div>
  </main>
  <script type="module">
    import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.184.0/build/three.module.js';
    const PLAN = __PLAN__;
    const AUDIO_VARIANTS = __AUDIO_VARIANTS__;
    const ICONS = {
      phone: '<svg viewBox="0 0 24 24"><path d="M22 16.9v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.34 1.78.65 2.63a2 2 0 0 1-.45 2.11L8.04 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.31 1.73.53 2.63.65A2 2 0 0 1 22 16.9Z"/></svg>',
      compass: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/></svg>',
      shield: '<svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/></svg>',
      people: '<svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      layers: '<svg viewBox="0 0 24 24"><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/></svg>',
      candle: '<svg viewBox="0 0 24 24"><path d="M9 21h6"/><path d="M12 3c1.4 1.5 2.5 3.1 2.5 4.8A2.5 2.5 0 0 1 12 10.3 2.5 2.5 0 0 1 9.5 7.8C9.5 6.1 10.6 4.5 12 3Z"/><path d="M9 21V11h6v10"/></svg>',
      network: '<svg viewBox="0 0 24 24"><circle cx="6" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="m7.7 7.1 2.9 9M16.3 7.1l-2.9 9M8 6h8"/></svg>',
      quote: '<svg viewBox="0 0 24 24"><path d="M3 21c3 0 5-2 5-5V9H3v7h3c0 1.4-1.2 2.6-3 2.6V21Zm13 0c3 0 5-2 5-5V9h-5v7h3c0 1.4-1.2 2.6-3 2.6V21Z"/></svg>',
      heart: '<svg viewBox="0 0 24 24"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.9-8.6a5.5 5.5 0 0 0-.1-7.8Z"/></svg>',
      arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    };
    const ICON_RULES = {
      'segment-01': { name:'phone', trigger:'emphasis' },
      'segment-03': { name:'shield', trigger:'emphasis' },
      'segment-04': { name:'people', trigger:'title' },
      'segment-05': { name:'network', trigger:'emphasis' },
      'segment-07': { name:'layers', trigger:'title' },
      'segment-08': { name:'quote', trigger:'emphasis' },
      'segment-09': { name:'heart', trigger:'emphasis' },
      'segment-10': { name:'arrow', trigger:'emphasis' },
    };
    const CRITICAL_SEGMENTS = new Set(['segment-03','segment-08','segment-10']);
    const SEGMENT_ZOOMS = { 'segment-01':1.015,'segment-02':1.035,'segment-03':1.105,'segment-04':1.045,'segment-05':1.08,'segment-06':1.025,'segment-07':1.12,'segment-08':1.055,'segment-09':1.085,'segment-10':1.14 };
    const PHASE_DESCRIPTIONS = {
      'prism-echo': { 'FASE 1':'Una llamada abre una historia que nadie quiso mirar.', 'FASE 2':'La respuesta cambia el eje y obliga a escuchar.', 'FASE 3':'La causa deja de ser privada: ahora tiene testigos.', 'FASE 4':'La promesa entra en el presente y exige una decisión.' },
      'noir-editorial': { 'FASE 1':'ARCHIVO 01 / EL LLAMADO', 'FASE 2':'CORTE 02 / LA RESPUESTA', 'FASE 3':'EVIDENCIA 03 / LA CAUSA', 'FASE 4':'RESOLUCIÓN 04 / LA PROMESA' },
      'archive-signal': { 'FASE 1':'Registro de origen', 'FASE 2':'Testimonio y fricción', 'FASE 3':'Organización de la memoria', 'FASE 4':'Una promesa activa' },
      'emerald-covenant': { 'FASE 1':'SEÑAL 01 / EL ORIGEN', 'FASE 2':'SEÑAL 02 / LA RESPUESTA', 'FASE 3':'SEÑAL 03 / LA RESPONSABILIDAD', 'FASE 4':'SEÑAL 04 / EL COMPROMISO' },
      'kinetic-scramble': { 'FASE 1':'FRAME 01 / RUIDO', 'FASE 2':'FRAME 02 / TENSIÓN', 'FASE 3':'FRAME 03 / DECISIÓN', 'FASE 4':'FRAME 04 / RESOLUCIÓN' },
      'crimson-walk': { 'FASE 1':'PASO 01 / LA HISTORIA', 'FASE 2':'PASO 02 / EL DOLOR', 'FASE 3':'PASO 03 / LA RESPUESTA', 'FASE 4':'PASO 04 / SEGUIR' },
      'orbital-stack': { 'FASE 1':'ÓRBITA 01 / PREGUNTA', 'FASE 2':'ÓRBITA 02 / EVIDENCIA', 'FASE 3':'ÓRBITA 03 / CAMBIO', 'FASE 4':'ÓRBITA 04 / FUTURO' },
    };
    const TEMPLATE_DEFINITIONS = {
      'prism-echo': {
        brand: 'NEXA',
        intro: 'UNA PROMESA<br>AHORA',
        introDescription: 'Una edición de ideas, tensión y memoria que deja la pantalla respirar.',
        outro: 'NO CALLAR<br>NUNCA',
        outroDescription: 'La última imagen no cierra la historia: la deja en movimiento.',
        disclosure: 'DOBLAJE SINTÉTICO EN ESPAÑOL · VOZ GENÉRICA',
      },
      'noir-editorial': {
        brand: 'NEXA / MANIFESTO',
        intro: 'NADIE ES<br>SEGUNDO',
        introDescription: 'Una dirección de alto contraste para una idea que no acepta ruido.',
        outro: 'LA PROMESA<br>SE DEFIENDE',
        outroDescription: 'El corte final queda suspendido como una pregunta abierta.',
        disclosure: 'EDICIÓN NOIR · VOZ SINTÉTICA · REVISIÓN HUMANA',
      },
      'archive-signal': {
        brand: 'NEXA / ARCHIVE',
        intro: 'UNA HISTORIA<br>CAMBIA',
        introDescription: 'Una composición de archivo para convertir testimonio en contexto.',
        outro: 'LA MEMORIA<br>ACTÚA',
        outroDescription: 'El documento se queda con la audiencia después del último cuadro.',
        disclosure: 'EDICIÓN ARCHIVE · VOZ SINTÉTICA · REVISIÓN HUMANA',
      },
      'emerald-covenant': {
        brand: 'NEXA / FIELD',
        intro: 'LA TIERRA<br>RESPONDE',
        introDescription: 'Una lectura profunda, oscura y consciente para ideas que piden responsabilidad.',
        outro: 'CUIDAR<br>ES ACTUAR',
        outroDescription: 'La señal permanece cuando la edición deja espacio para decidir.',
        disclosure: 'EDICIÓN FIELD · RETÍCULA VIVA · REVISIÓN HUMANA',
      },
      'kinetic-scramble': {
        brand: 'NEXA / SIGNAL',
        intro: 'NO ES<br>RUIDO',
        introDescription: 'Palabras que se rompen, se ordenan y terminan golpeando en el momento exacto.',
        outro: 'EL MENSAJE<br>QUEDA',
        outroDescription: 'El último frame se queda suspendido antes de desaparecer.',
        disclosure: 'EDICIÓN SIGNAL · TIPOGRAFÍA CINÉTICA · REVISIÓN HUMANA',
      },
      'crimson-walk': {
        brand: 'NEXA / WALK',
        intro: 'CAMINAR<br>JUNTOS',
        introDescription: 'Una dirección emocional construida con pasos, pausas y una línea que nunca se detiene.',
        outro: 'SEGUIR<br>DE PIE',
        outroDescription: 'La trayectoria continúa fuera de la pantalla.',
        disclosure: 'EDICIÓN WALK · RITMO HUMANO · REVISIÓN HUMANA',
      },
      'orbital-stack': {
        brand: 'NEXA / ORBIT',
        intro: 'UNA IDEA<br>EN ÓRBITA',
        introDescription: 'Capas de profundidad para una narrativa que conecta causa, evidencia y futuro.',
        outro: 'CAMBIAR<br>LA ÓRBITA',
        outroDescription: 'El cierre no concluye: desplaza la perspectiva.',
        disclosure: 'EDICIÓN ORBIT · THREE.JS · REVISIÓN HUMANA',
      },
    };
    const TEMPLATE_SOURCES = {
      'prism-echo': 'VIDEO-prism-echo/index.html',
      'noir-editorial': 'VIDEO-noir-manifesto/index.html',
      'archive-signal': 'VIDEO-archive-signal/index.html',
      'emerald-covenant': 'VIDEO-emerald-covenant/index.html',
      'kinetic-scramble': 'VIDEO-kinetic-scramble/index.html',
      'crimson-walk': 'VIDEO-crimson-walk/index.html',
      'orbital-stack': 'VIDEO-orbital-stack/index.html',
    };
    const stage = document.querySelector('.stage');
    const video = document.getElementById('source');
    const audio = document.getElementById('narration');
    const actions = PLAN.actions || [];
    const segments = PLAN.segments || [];
    const copy = document.getElementById('copy');
    const kicker = document.getElementById('kicker');
    const title = document.getElementById('title');
    const supporting = document.getElementById('supporting');
    const emphasis = document.getElementById('emphasis');
    const darkFilter = document.getElementById('dark-filter');
    const cutFlash = document.getElementById('cut-flash');
    const intro = document.getElementById('intro');
    const phase = document.getElementById('phase');
    const phaseNumber = document.getElementById('phase-number');
    const phaseTitle = document.getElementById('phase-title');
    const phaseDescription = document.getElementById('phase-description');
    const outro = document.getElementById('outro');
    const outroTitle = document.getElementById('outro-title');
    const controls = document.getElementById('preview-controls');
    const playToggle = document.getElementById('play-toggle');
    const resetPreview = document.getElementById('reset-preview');
    const timelineRange = document.getElementById('timeline-range');
    const timecode = document.getElementById('timecode');
    const audioStatus = document.getElementById('audio-status');
    const iconSlot = document.getElementById('icon-slot');
    const criticalFlash = document.getElementById('critical-flash');
    const templateSelect = document.getElementById('template-select');
    const audioSelect = document.getElementById('audio-select');
    const motionCanvas = document.getElementById('motion-canvas');
    const motionContext = motionCanvas.getContext('2d');
    const threeStage = document.getElementById('three-stage');
    let threeRenderer = null;
    let threeScene = null;
    let threeCamera = null;
    let threeRings = [];
    let lastState = '';
    let lastIcon = '';
    let lastCritical = '';
    function initThreeMotion() {
      if (!THREE || !threeStage) return;
      threeRenderer = new THREE.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'high-performance' });
      threeRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      threeStage.appendChild(threeRenderer.domElement);
      threeScene = new THREE.Scene();
      threeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 100);
      threeCamera.position.z = 10;
      for (let i = 0; i < 6; i += 1) {
        const geometry = new THREE.TorusGeometry(1.05 + i * .11, .012 + i * .002, 8, 96);
        const material = new THREE.MeshBasicMaterial({ color: i % 2 ? 0x9aa6ff : 0x6674ff, transparent:true, opacity:.22 + i * .035, wireframe:true });
        const ring = new THREE.Mesh(geometry, material);
        ring.userData.index = i;
        threeScene.add(ring);
        threeRings.push(ring);
      }
      resizeMotionSurface();
    }
    function resizeMotionSurface() {
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (motionCanvas.width !== Math.round(width * dpr) || motionCanvas.height !== Math.round(height * dpr)) {
        motionCanvas.width = Math.round(width * dpr);
        motionCanvas.height = Math.round(height * dpr);
        motionContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
      if (threeRenderer && threeCamera) {
        threeRenderer.setSize(width, height, false);
        threeCamera.left = -width / 2;
        threeCamera.right = width / 2;
        threeCamera.top = height / 2;
        threeCamera.bottom = -height / 2;
        threeCamera.updateProjectionMatrix();
        const scale = Math.min(width, height) * .22;
        threeRings.forEach((ring, index) => {
          ring.scale.setScalar(scale * (1 + index * .035));
          ring.position.set(width * .08, height * -.03, -index * .12);
        });
      }
    }
    function renderMotion(time) {
      resizeMotionSurface();
      const width = Math.max(1, stage.clientWidth);
      const height = Math.max(1, stage.clientHeight);
      const template = stage.dataset.template;
      motionContext.clearRect(0, 0, width, height);
      const t = Number(time || 0);
      if (template === 'emerald-covenant') {
        motionContext.save();
        motionContext.strokeStyle = 'rgba(123,255,148,.24)';
        motionContext.lineWidth = 1;
        const stepX = width / 12;
        const stepY = height / 7;
        for (let x = stepX; x < width; x += stepX) { motionContext.beginPath(); motionContext.moveTo(x, 0); motionContext.lineTo(x + Math.sin(t * .28 + x) * 10, height); motionContext.stroke(); }
        for (let y = stepY; y < height; y += stepY) { motionContext.beginPath(); motionContext.moveTo(0, y); motionContext.lineTo(width, y + Math.cos(t * .22 + y) * 8); motionContext.stroke(); }
        motionContext.strokeStyle = 'rgba(141,255,162,.72)';
        motionContext.fillStyle = 'rgba(141,255,162,.92)';
        motionContext.beginPath();
        for (let i = 0; i < 8; i += 1) {
          const x = width * (.12 + i * .11);
          const y = height * (.48 + Math.sin(i * 1.45 + t * .45) * .12);
          if (i === 0) motionContext.moveTo(x, y); else motionContext.lineTo(x, y);
          motionContext.beginPath(); motionContext.arc(x, y, 3 + (i % 3), 0, Math.PI * 2); motionContext.fill();
          motionContext.beginPath();
          if (i > 0) { const px = width * (.12 + (i - 1) * .11); const py = height * (.48 + Math.sin((i - 1) * 1.45 + t * .45) * .12); motionContext.moveTo(px, py); motionContext.lineTo(x, y); motionContext.stroke(); }
        }
        motionContext.restore();
      } else if (template === 'kinetic-scramble') {
        motionContext.save();
        const bars = ['rgba(202,255,36,.84)','rgba(255,90,31,.7)','rgba(16,16,11,.22)'];
        for (let i = 0; i < 14; i += 1) {
          const x = ((i * 173 + t * (92 + i * 5)) % (width + 280)) - 140;
          const y = height * (.14 + (i % 8) * .105);
          motionContext.fillStyle = bars[i % bars.length];
          motionContext.fillRect(x, y, 68 + (i % 4) * 34, 2 + (i % 3) * 2);
        }
        motionContext.strokeStyle = 'rgba(16,16,11,.32)';
        motionContext.setLineDash([5, 11]);
        motionContext.beginPath(); motionContext.moveTo(0, height * .52); motionContext.lineTo(width, height * .52); motionContext.stroke();
        motionContext.restore();
      } else if (template === 'crimson-walk') {
        motionContext.save();
        motionContext.strokeStyle = 'rgba(255,61,79,.72)';
        motionContext.fillStyle = 'rgba(255,61,79,.9)';
        motionContext.lineWidth = 2;
        const travel = (t * 34) % (width + 240);
        motionContext.beginPath(); motionContext.moveTo(-120 + travel, height * .83); motionContext.lineTo(80 + travel, height * .83); motionContext.stroke();
        for (let i = 0; i < 8; i += 1) {
          const x = -80 + ((travel + i * 118) % (width + 180));
          const y = height * (.79 + (i % 2) * .035);
          motionContext.beginPath(); motionContext.arc(x, y, 4 + (i % 2) * 2, 0, Math.PI * 2); motionContext.fill();
          motionContext.beginPath(); motionContext.moveTo(x - 14, y + 12); motionContext.lineTo(x + 14, y + 12); motionContext.stroke();
        }
        motionContext.restore();
      } else if (template === 'orbital-stack') {
        // Respaldo determinista para navegadores donde WebGL o el módulo externo no carga.
        // Mantiene la profundidad visual durante seek, pausa y reproducción.
        motionContext.save();
        const cx = width * .34;
        const cy = height * .48;
        const base = Math.min(width, height) * .16;
        motionContext.translate(cx, cy);
        motionContext.rotate(-.18 + Math.sin(t * .12) * .05);
        for (let i = 0; i < 5; i += 1) {
          const rx = base * (1 + i * .22);
          const ry = base * (.34 + i * .035);
          motionContext.beginPath();
          motionContext.ellipse(0, 0, rx, ry, i * .18, 0, Math.PI * 2);
          motionContext.strokeStyle = i % 2 ? 'rgba(154,166,255,.38)' : 'rgba(102,116,255,.52)';
          motionContext.lineWidth = 1 + i * .35;
          motionContext.stroke();
          const angle = t * (.22 + i * .035) + i * 1.23;
          const nodeX = Math.cos(angle) * rx;
          const nodeY = Math.sin(angle) * ry;
          motionContext.beginPath();
          motionContext.arc(nodeX, nodeY, 3 + i * .6, 0, Math.PI * 2);
          motionContext.fillStyle = i % 2 ? 'rgba(179,78,255,.86)' : 'rgba(154,166,255,.92)';
          motionContext.fill();
          motionContext.beginPath();
          motionContext.moveTo(0, 0);
          motionContext.lineTo(nodeX, nodeY);
          motionContext.strokeStyle = 'rgba(154,166,255,.14)';
          motionContext.stroke();
        }
        motionContext.beginPath();
        motionContext.arc(0, 0, base * .28, 0, Math.PI * 2);
        motionContext.fillStyle = 'rgba(238,240,255,.08)';
        motionContext.fill();
        motionContext.strokeStyle = 'rgba(238,240,255,.78)';
        motionContext.lineWidth = 1.5;
        motionContext.stroke();
        motionContext.restore();
      }
      if (threeRenderer && threeScene && threeCamera) {
        const visible = template === 'orbital-stack';
        threeStage.style.display = visible ? 'block' : 'none';
        if (visible) {
          threeRings.forEach((ring, index) => {
            ring.rotation.x = .42 + Math.sin(t * .18 + index) * .12;
            ring.rotation.y = t * (.035 + index * .004);
            ring.rotation.z = t * (.02 + index * .002) + index * .25;
          });
          threeRenderer.render(threeScene, threeCamera);
        }
      }
    }
    function populateAudioSelect() {
      Object.entries(AUDIO_VARIANTS).forEach(([key, variant]) => {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = variant.label || variant.voice || key;
        audioSelect.append(option);
      });
    }
    function formatTime(value) {
      const total = Math.max(0, Math.floor(Number(value) || 0));
      const minutes = Math.floor(total / 60).toString().padStart(2, '0');
      const seconds = (total % 60).toString().padStart(2, '0');
      return `${minutes}:${seconds}`;
    }
    function syncAudio(force = false) {
      if (!Number.isFinite(video.currentTime)) return;
      if (force || Math.abs((audio.currentTime || 0) - video.currentTime) > 0.18) audio.currentTime = video.currentTime;
    }
    function updateTransport() {
      const duration = Number.isFinite(video.duration) ? video.duration : (PLAN.duration_seconds || 1);
      timelineRange.max = duration;
      timelineRange.value = Math.min(duration, Number(video.currentTime || 0));
      timecode.textContent = `${formatTime(video.currentTime)} / ${formatTime(duration)}`;
    }
    async function playMedia() {
      syncAudio(true);
      try {
        await video.play();
        await audio.play();
        playToggle.textContent = 'Pausa';
        audioStatus.textContent = `Audio ${PLAN.audio?.language || 'es'} · ${PLAN.audio?.provider || 'sintético'}`;
      } catch (error) {
        audioStatus.textContent = 'Haz clic para activar el audio';
        await video.play().catch(() => {});
        playToggle.textContent = 'Pausa';
      }
    }
    function pauseMedia() {
      video.pause();
      audio.pause();
      playToggle.textContent = 'Reproducir';
    }
    function setTemplate(template) {
      stage.dataset.template = template;
      stage.dataset.templateSource = TEMPLATE_SOURCES[template] || TEMPLATE_SOURCES['prism-echo'];
      templateSelect.value = template;
      const definition = TEMPLATE_DEFINITIONS[template] || TEMPLATE_DEFINITIONS['prism-echo'];
      document.querySelectorAll('.brand-word').forEach((node) => { node.textContent = definition.brand; });
      document.querySelector('.intro-title').innerHTML = definition.intro;
      document.querySelector('.intro-description').textContent = definition.introDescription;
      document.querySelector('.outro-title').innerHTML = definition.outro;
      document.querySelector('.outro-description').textContent = definition.outroDescription;
      document.querySelector('.intro-disclosure').textContent = definition.disclosure;
      document.querySelector('.outro-disclosure').textContent = definition.disclosure;
      tick();
    }
    async function selectAudioVariant(key) {
      const variant = AUDIO_VARIANTS[key];
      if (!variant) return;
      const wasPlaying = !video.paused;
      const time = video.currentTime || 0;
      audio.pause();
      audio.src = variant.src;
      audio.addEventListener('loadedmetadata', async () => {
        audio.currentTime = time;
        if (wasPlaying) await audio.play().catch(() => {});
      }, { once: true });
      audio.load();
      audioStatus.textContent = `Audio español · ${variant.label || variant.voice || key}`;
    }
    if (window.location.protocol === 'file:') controls.hidden = true;
    function activeAt(type, time) { return actions.find((item) => item.type === type && time >= item.start && time < item.end); }
    function segmentAt(time) { return segments.find((item) => time >= item.timeline_start && time < item.timeline_end); }
    function setCopy(action, segment) {
      if (!action) { copy.classList.remove('is-visible'); lastState = ''; return; }
      const state = action.id;
      if (state === lastState) return;
      lastState = state;
      copy.dataset.position = action.position || 'left';
      kicker.textContent = action.payload?.kicker || '';
      title.textContent = action.text || segment?.title || '';
      // The full narration remains in the director JSON and audio transcript;
      // the screen only shows a short editorial label, never a subtitle wall.
      supporting.textContent = '';
      copy.classList.remove('is-visible');
      window.setTimeout(() => copy.classList.add('is-visible'), 20);
    }
    function setIcon(segment, titleAction, emphasisAction, phaseAction) {
      const rule = ICON_RULES[segment?.id];
      const triggerActive = rule?.trigger === 'title' ? Boolean(titleAction) : Boolean(emphasisAction);
      const visible = Boolean(rule && triggerActive && !phaseAction);
      if (rule && rule.name !== lastIcon) { iconSlot.innerHTML = ICONS[rule.name]; lastIcon = rule.name; }
      iconSlot.classList.toggle('is-visible', visible);
    }
    function videoFilter(emotionGrade) {
      const contrast = emotionGrade?.payload?.contrast || 1.12;
      if (stage.dataset.template === 'prism-echo') return `brightness(1.04) contrast(${Math.max(1.13, contrast)}) saturate(1.12)`;
      if (stage.dataset.template === 'archive-signal') return `sepia(.1) brightness(1.1) contrast(${Math.max(1.08, contrast)}) saturate(1.18)`;
      if (stage.dataset.template === 'emerald-covenant') return `brightness(.72) contrast(${Math.max(1.26, contrast)}) saturate(.72) hue-rotate(58deg)`;
      if (stage.dataset.template === 'kinetic-scramble') return `brightness(.96) contrast(${Math.max(1.3, contrast)}) saturate(1.32) sepia(.18) hue-rotate(-8deg)`;
      if (stage.dataset.template === 'crimson-walk') return `brightness(.8) contrast(${Math.max(1.28, contrast)}) saturate(1.44) sepia(.12) hue-rotate(-18deg)`;
      if (stage.dataset.template === 'orbital-stack') return `grayscale(.26) brightness(.74) contrast(${Math.max(1.34, contrast)}) saturate(1.3) hue-rotate(168deg)`;
      return `grayscale(1) brightness(.94) contrast(${contrast})`;
    }
    function tick() {
      const time = Number(video.currentTime || 0);
      const segment = segmentAt(time);
      const titleAction = activeAt('title', time);
      const emphasisAction = activeAt('emphasis', time);
      const phaseAction = activeAt('phase', time);
      const cutAction = activeAt('cut', time);
      const emotionGrade = activeAt('emotion_grade', time);
      const introAction = activeAt('intro', time);
      const outroAction = activeAt('outro', time);
      intro.classList.toggle('is-visible', Boolean(introAction));
      outro.classList.toggle('is-visible', Boolean(outroAction));
      phase.classList.toggle('is-visible', Boolean(phaseAction) && !introAction && !outroAction);
      if (phaseAction) {
        const phaseKey = phaseAction.text.split(' · ')[0] || 'FASE';
        phaseNumber.textContent = phaseKey;
        phaseTitle.textContent = phaseAction.text.split(' · ')[1] || phaseAction.text;
        phaseDescription.textContent = PHASE_DESCRIPTIONS[stage.dataset.template]?.[phaseKey] || 'Cambio de capítulo';
      }
      if (outroAction) outroTitle.textContent = outroAction.text;
      setCopy(titleAction, segment);
      emphasis.textContent = emphasisAction?.text || '';
      emphasis.dataset.position = emphasisAction?.position || 'left';
      emphasis.classList.toggle('is-visible', Boolean(emphasisAction) && !phaseAction && !introAction && !outroAction);
      setIcon(segment, titleAction, emphasisAction, phaseAction || introAction || outroAction);
      cutFlash.classList.toggle('is-visible', Boolean(cutAction));
      const critical = CRITICAL_SEGMENTS.has(segment?.id) && emphasisAction ? `${segment.id}:${emphasisAction.id}` : '';
      if (critical && critical !== lastCritical) {
        criticalFlash.classList.remove('is-visible');
        void criticalFlash.offsetWidth;
        criticalFlash.classList.add('is-visible');
      }
      if (!critical) lastCritical = '';
      else lastCritical = critical;
      const base = emotionGrade?.payload?.black_overlay_opacity ?? PLAN.grade?.black_overlay_opacity ?? .23;
      darkFilter.style.opacity = phaseAction ? .98 : (cutAction ? .46 : base);
      video.style.filter = videoFilter(emotionGrade);
      const segmentZoom = SEGMENT_ZOOMS[segment?.id] || 1;
      const planZoom = segment?.reframe?.scale || 1;
      const templateBoost = ({'noir-editorial':.018,'prism-echo':.008,'emerald-covenant':.026,'kinetic-scramble':.04,'crimson-walk':.034,'orbital-stack':.03}[stage.dataset.template] || 0);
      const x = segment?.reframe?.x || 0;
      video.style.transform = `scale(${Math.max(segmentZoom, planZoom) + templateBoost}) translateX(${x}px)`;
      renderMotion(time);
    }
    video.addEventListener('timeupdate', tick);
    video.addEventListener('timeupdate', () => { syncAudio(); updateTransport(); });
    video.addEventListener('loadedmetadata', () => { updateTransport(); tick(); });
    video.addEventListener('play', () => { playToggle.textContent = 'Pausa'; });
    video.addEventListener('pause', () => { if (!video.ended) playToggle.textContent = 'Reproducir'; });
    video.addEventListener('ended', () => { pauseMedia(); video.currentTime = 0; audio.currentTime = 0; updateTransport(); tick(); });
    audio.addEventListener('loadedmetadata', () => { const selected = AUDIO_VARIANTS[audioSelect.value]; audioStatus.textContent = `Audio ${PLAN.audio?.language || 'es'} · ${selected?.label || PLAN.audio?.provider || 'sintético'}`; });
    // A replacement audio element can decode a few frames before the source
    // video after a seek. Correct from both clocks, not only video timeupdate.
    audio.addEventListener('timeupdate', () => { if (!video.paused) syncAudio(); });
    playToggle.addEventListener('click', () => video.paused ? playMedia() : pauseMedia());
    resetPreview.addEventListener('click', () => { pauseMedia(); video.currentTime = 0; audio.currentTime = 0; lastState = ''; updateTransport(); tick(); });
    timelineRange.addEventListener('input', () => { const next = Number(timelineRange.value); video.currentTime = next; audio.currentTime = next; updateTransport(); tick(); });
    templateSelect.addEventListener('change', () => setTemplate(templateSelect.value));
    audioSelect.addEventListener('change', () => { selectAudioVariant(audioSelect.value); });
    initThreeMotion();
    populateAudioSelect();
    setTemplate('prism-echo');
    updateTransport();
    tick();
  </script>
</body>
</html>'''

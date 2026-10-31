"""Cómo se le cuenta una narrativa a la IA: el estratega del brief y el agente de producción.

Con la documental (`DOCUMENTAL_ID`) no se agrega nada: los prompts quedan como antes del módulo.
"""

from __future__ import annotations

from src.core.explainer.narrative.models import NarrativeStrategy
from src.core.explainer.narrative.service import DOCUMENTAL_ID

WEIGHT_TEXT = {
    "apertura": "la apertura, muy breve",
    "primer_tramo": "el primer tramo del video (tú decides cuánto según la duración)",
    "corto": "corto",
    "medio": "medio",
    "mayor_parte": "la mayor parte del video",
    "cierre": "breve, al final",
}


def _acts_table(narrative: NarrativeStrategy) -> list[dict]:
    return [
        {
            "orden": i,
            "acto": a.id,
            "nombre": a.name,
            "peso": WEIGHT_TEXT[a.weight],
            "intensidad": a.intensity,
            "va_en_el_guion": a.spoken,
            "funcion": a.function,
            "reglas": a.rules,
            "tono_sugerido": narrative.voice.allowed_tones.get(a.id, []),
        }
        for i, a in enumerate(narrative.acts, 1)
    ]


def _title_rules(narrative: NarrativeStrategy, category_id: str, title_level: str | None) -> dict | None:
    level = narrative.title_level(title_level)
    if not narrative.title or level is None:
        return None
    spec = narrative.title.levels[level]
    return {
        "nivel": level,
        "nombre": spec.name,
        "descripcion": spec.description,
        "reglas": spec.rules,
        "ejemplos": spec.examples.get(category_id, []),
        "criterios_imagen": narrative.title.image_criteria,
    }


def brief_context(narrative: NarrativeStrategy | None, category_id: str, title_level: str | None) -> dict | None:
    """Bloque `narrativa` del pedido al estratega; None = prompt de siempre."""
    if narrative is None or narrative.id == DOCUMENTAL_ID:
        return None
    example = narrative.examples.get(category_id)
    ctx = {
        "instruccion": (
            f"Este video usa la narrativa «{narrative.label}». Sus reglas MANDAN sobre las reglas generales de "
            "títulos y de estructura del sistema: hook = la frase del primer acto; angle = el miedo concreto y el "
            "giro que lo desarma; thesis = la verdad completa; outline = los actos hablados en orden (sin duraciones); "
            "la descripción de YouTube y la de Facebook terminan con la pregunta del video. "
            "El logo aparece 1–2 veces por marca, siempre ACOMPAÑANDO una foto/video, nunca solo ni en tarjeta."
        ),
        "id": narrative.id,
        "descripcion": narrative.description,
        "actos": _acts_table(narrative),
        "gancho": narrative.hook.model_dump(),
        "retention": [technique.model_dump() for technique in narrative.retention],
    }
    if (titles := _title_rules(narrative, category_id, title_level)) is not None:
        ctx["titulos"] = titles
    if narrative.thumbnail:
        ctx["miniatura"] = narrative.thumbnail.model_dump()
    if narrative.question:
        ctx["pregunta_final"] = narrative.question.model_dump(include={"screen_max_words", "do", "dont"})
    if example:
        ctx["ejemplo_de_tono"] = example.model_dump(exclude_defaults=True)
    return ctx


def production_lines(narrative: NarrativeStrategy | None, category_id: str, title_level: str | None) -> list[str]:
    """Instrucciones para el agente de producción; [] = guion documental de siempre."""
    if narrative is None or narrative.id == DOCUMENTAL_ID:
        return []
    acts = " → ".join(
        f"{a.id} ({WEIGHT_TEXT[a.weight]}, intensidad {a.intensity})" for a in narrative.spoken_acts
    )
    lines = [
        f"NARRATIVA DEL GUION: «{narrative.label}» (`{narrative.id}`). Reemplaza el arco de storytelling.md §3; "
        f"todo lo demás de la guía (§4–7: voz, script.json, duración) sigue igual. Detalle completo: "
        f"src/skills/explainer/strategies/narrative/{narrative.id}.json.",
        f"Actos hablados, en este orden: {acts}. Las duraciones las decides tú según target_minutes; "
        "no hay segundos fijos. Videos largos: varias rondas «miedo → verdad» dentro del acto de la verdad.",
        "Cada segmento de assets/script.json lleva `act` con el id de su acto. La `intensity` (0–1) sigue la "
        "intensidad del acto: maxima ≥ 0.9, alta ≥ 0.7, media ≥ 0.4.",
    ]
    for act in narrative.spoken_acts:
        tones = narrative.voice.allowed_tones.get(act.id, [])
        lines.append(f"Acto `{act.id}`: {act.function} Reglas: {'; '.join(act.rules)}." +
                     (f" Tonos permitidos: {', '.join(tones)}." if tones else ""))
    if narrative.hook.hedge_words:
        lines.append("En golpe/miedo evita: " + ", ".join(narrative.hook.hedge_words) +
                     "; solo admite atribución a fuente nombrada en la misma oración o cita textual verificable.")
    if example := narrative.examples.get(category_id):
        lines.append(f"Ejemplos del tema: golpe correcto: {example.hook_correct}; incorrecto: {example.hook_incorrect}. "
                     f"Miedo correcto: {example.fear_correct}; incorrecto: {example.fear_incorrect}.")
    if narrative.retention:
        lines.append(
            "Técnicas de retención (guía editorial; no son checks automáticos): "
            + " | ".join(
                f"{technique.id} ({technique.name}; acto: {technique.act}): {technique.how} "
                f"Ejemplo NodeTech: {technique.example}"
                for technique in narrative.retention
            )
        )
    if narrative.hook.prohibited:
        lines.append(
            "Gancho: " + " ".join(narrative.hook.rules)
            + " Técnicas permitidas: " + "; ".join(narrative.hook.allowed_techniques)
            + ". PROHIBIDO: " + "; ".join(narrative.hook.prohibited) + "."
        )
    if (q := narrative.question) is not None:
        lines += [
            f"Acto `{q.act}`: una sola pregunta directa al espectador. Su segmento lleva `on_screen_question` "
            f"(máx. {q.screen_max_words} palabras, termina en «?»), `tone: \"{q.tone}\"` y "
            f"`delivery_note: \"{q.delivery_note}\"`. Sí: {'; '.join(q.do)}. No: {'; '.join(q.dont)}.",
            "En assets/storyboard.json, un beat `common.question` (capa overlay) con `params.text` = on_screen_question "
            "exacto, `at` = primeras palabras de la pregunta y `until` = primeras palabras del outro con voz del canal.",
        ]
    if narrative.checks.pinned_repeats_question:
        lines.append(
            "publish.json → pinned_comment: su PRIMERA pregunta repite exactamente on_screen_question; la segunda "
            "pide el próximo tema."
        )
    if (titles := _title_rules(narrative, category_id, title_level)) is not None:
        lines.append(
            f"Títulos y miniaturas en nivel «{titles['nombre']}»: {titles['descripcion']} "
            + " ".join(titles["reglas"])
            + (" Criterios de imagen para la miniatura: " + "; ".join(titles["criterios_imagen"]) + "." if titles["criterios_imagen"] else "")
            + (f" Ejemplos: {' · '.join(titles['ejemplos'])}." if titles["ejemplos"] else "")
        )
    if (thumb := narrative.thumbnail) is not None:
        lines.append(
            f"Miniatura preferida: opción {thumb.preferred_option} (`common.tabloid`). En `publish.json` v2, "
            "completa `thumbnail.tabloid` con `text`, `accent`, `bullet`, `image`, `focus` e `image_review` y los campos "
            "opcionales que correspondan (`image_after`, `strap`, `seal`, `tape_text`); usa `palette: \"brand\"` "
            "para conservar los colores y la fuente del diseño, con rojo/amarillo solo en alertas puntuales; deja "
            "`thumbnail.chosen: \"tabloid\"`. "
            f"Máximo {thumb.max_words} palabras en el titular. " + " ".join(thumb.rules)
            + " Conserva A/B como alternativas para Test & Compare. Si no hay renders MP4, ejecuta "
            "`.venv/bin/python -m src.core.explainer.publishing build <id>`; si existen, no lo ejecutes "
            "porque puede borrarlos y reporta la apertura pendiente. Ejecuta "
            "`.venv/bin/python -m src.core.explainer.publishing check <id>` antes de publicar."
        )
        if thumb.require_bullet:
            lines.append("Amarillista: la opción C es obligatoria. El 20 % de alerta rojo/amarillo va en un bullet con dato real dicho en el guion (referencia: «250 PUESTOS»); el check bloquea su ausencia.")
    return lines

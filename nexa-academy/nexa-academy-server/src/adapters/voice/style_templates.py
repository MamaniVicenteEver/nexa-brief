"""Plantillas de estilo de narración — instrucción + emoción, con variables.

Cambiar el tono de una lección es elegir una `template_key` + llenar sus
variables (`.format(**variables)`), sin tocar código de ningún adapter —
mismo patrón que ya usan `prompt_architect.py`/`result_summarizer.py` para
sus propios prompts (constantes `_TEMPLATE = "...{variable}..."`).

`instruction` es lo que interpreta Gemini (se antepone al texto, ver
docstring de gemini_tts_adapter.py). `emotion` es lo que interpreta Novita —
MiniMax lo usa tal cual como su enum (`calm|happy|sad|fearful|disgusted|
surprised|fluent|whisper|angry`), Fish lo traduce a una etiqueta inline
`(serious)`/`(sad)`/etc. Ningún adapter falla si el otro campo no le sirve —
cada uno usa el suyo e ignora el resto.
"""

from __future__ import annotations

VOICE_STYLE_TEMPLATES: dict[str, dict[str, str]] = {
    "documental_serio": {
        "instruction": (
            "Narra como un gran documental histórico. Voz {voice_desc}, SERENA y calmada, "
            "pero cargada de EMOCIÓN genuina y MADUREZ, como un narrador experimentado. "
            "Ritmo pausado, respiración natural, énfasis suave en los momentos clave. "
            "NO grites ni sobreactúes. Español latino neutro."
        ),
        "emotion": "calm",
    },
    "cercano_cotidiano": {
        "instruction": (
            "Narra como si le explicaras algo a un amigo cercano — tono {voice_desc}, "
            "natural, conversacional, sin solemnidad. Español latino neutro."
        ),
        "emotion": "fluent",
    },
    "entusiasta_motivador": {
        "instruction": (
            "Narra con energía y entusiasmo genuino, voz {voice_desc}, como quien está "
            "genuinamente emocionado de compartir algo interesante. Ritmo ágil, sin "
            "apurarse. Español latino neutro."
        ),
        "emotion": "happy",
    },
}


def render_style(template_key: str, **variables: str) -> tuple[str, str]:
    """Devuelve (instruction, emotion) ya con las variables aplicadas.

    Raises KeyError si template_key no existe — fail-fast, mismo criterio que
    el resto del proyecto (ver niches.json / template_manifest.py)."""
    tpl = VOICE_STYLE_TEMPLATES[template_key]
    return tpl["instruction"].format(**variables), tpl["emotion"]

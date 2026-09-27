"""Module 4 — Prompt Architect.

- pipeline_type "freeform_html" (default): ensambla el prompt para que
  html_generator (DeepSeek) genere un index.html completo desde cero.
  Comportamiento original, sin cambios.
- pipeline_type "config_driven_template": arma el *user prompt* del Config
  Mapper (Prompt 2 de la plantilla) a partir de job.artifacts.vision_analysis
  (producido por visual_designer) + song_info. El *system prompt* (contenido
  de config_prompt_path) se vuelve a leer directamente en html_generator.py
  — no se duplica acá para no tener que pasar un campo extra en JobArtifacts.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

import structlog

from src.config.niche_config import NicheConfig
from src.config.settings import settings
from src.core.job import Job, JobStage

logger = structlog.get_logger(__name__)

_CONFIG_MAPPER_USER_TEMPLATE = """\
## VISION JSON
{vision_json}

{text_content_block}
## OUTPUT
Devuelve ÚNICAMENTE el JSON de config.json, sin texto adicional ni bloques de código.
"""

_TEXT_OVERRIDE_BLOCK = """\
## TEXT CONTENT (override)
* TEXT_LEFT: "{text_left}"
* TEXT_RIGHT: "{text_right}"
"""

# IMPORTANTE: si no hay texto propio que inyectar, este bloque se OMITE por
# completo — nunca se manda TEXT_LEFT/TEXT_RIGHT como comillas vacías. Un
# override "" explícito se interpretaba como "el texto debe estar vacío" en
# vez de "no hay override", y el mapeo terminaba escribiendo texts.left/right
# en blanco incluso cuando el Vision JSON ya traía suggested_text (bug real
# observado: config.json con texts:{"left":"","right":""} en vez de usar los
# valores sugeridos por safe_typography_zones).
_NO_TEXT_OVERRIDE_BLOCK = """\
## TEXT CONTENT
No se proveyó texto propio (song_info) — usar los valores de \
safe_typography_zones.left_text_block.suggested_text y \
safe_typography_zones.right_text_block.suggested_text del VISION JSON de arriba.
"""

# ─────────────────────────────────────────────────────────────────────────────
# config_driven_template SIN vision extraction (ej. plantillas de letras: no
# hay ninguna imagen que analizar, el config.json sale solo de song_info +
# el estilo ya fijado por el nicho elegido).
# ─────────────────────────────────────────────────────────────────────────────

_NO_VISION_CONFIG_MAPPER_TEMPLATE = """\
## ESTILO FORZADO
Este nicho ya tiene un estilo visual fijo — no elegir estilo, usar directamente \
el definido para "{niche_display_name}".

## INFORMACIÓN DE LA CANCIÓN
{song_info_block}
{user_context_block}
## OUTPUT
Devuelve ÚNICAMENTE el JSON de config.json, sin texto adicional ni bloques de código.
"""

_NO_SONG_INFO_BLOCK_NO_VISION = "No se proveyó información adicional de la canción — usar valores genéricos razonables.\n"

# ─────────────────────────────────────────────────────────────────────────────
# Template: imagen + audio puro (sin visualizador, sin texto, sin animaciones)
# Usado cuando html_visualizer.template == "image_only_ambient" o similar
# ─────────────────────────────────────────────────────────────────────────────

_IMAGE_ONLY_TEMPLATE = """\
{html_skill_autoplay}

---

## MODO: Imagen de fondo + Audio puro

Genera un HTML extremadamente simple que cumpla estas reglas sin excepción:

### Reglas absolutas

1. **La imagen `bg.jpg` ocupa el 100% del ancho y alto** usando `object-fit: cover` y `object-position: center`.
   - Esto escala la imagen proporcionalmente para llenar la pantalla sin deformarla.
   - Si la imagen es más ancha que alta, se recortarán los bordes laterales. Nunca se estira.
   - `width: 100vw; height: 100vh; position: fixed; top:0; left:0;`

2. **Cero texto en pantalla** — sin título, sin subtítulo, sin watermark, sin ningún texto visible.

3. **Cero visualizador de audio** — sin barras, sin canvas, sin waveform, sin espectro.

4. **Cero animaciones** — sin fade, sin pulse, sin breathing, sin partículas, sin efectos.

5. **Cero overlay oscuro** — NO agregar `rgba(0,0,0,X)` encima de la imagen.
   El overlay máximo permitido es `rgba(0,0,0,0.05)` y solo si es técnicamente necesario.

6. **Aplicar estos filtros CSS directamente en la imagen** (no en el body, en el `<img>`):
   `filter: {filters};`

7. **El audio `song.mp3` se reproduce en loop automáticamente** (elemento `<audio>` invisible):
{autoplay_code}

### Estructura HTML requerida

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Ambient</title>
<style>
  *, *::before, *::after {{ margin: 0; padding: 0; box-sizing: border-box; }}
  html, body {{ width: 100%; height: 100%; overflow: hidden; background: #000; }}
  .bg {{
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
    filter: {filters};
  }}
</style>
</head>
<body>
  <img class="bg" src="bg.jpg" alt="">
  <audio id="audio" src="song.mp3" loop preload="auto"></audio>
  <script>
    window.addEventListener('DOMContentLoaded', function() {{
      var a = document.getElementById('audio');
      a.play().catch(function() {{ setTimeout(function() {{ a.play(); }}, 500); }});
    }});
  </script>
</body>
</html>
```

Genera EXACTAMENTE este patrón. No agregues nada más. No hay Canvas. No hay JavaScript adicional.
Comenzar con `<!DOCTYPE html>` sin bloques de código markdown.
{user_context_block}
"""

# ─────────────────────────────────────────────────────────────────────────────
# Template estándar: visualizador completo con animaciones
# ─────────────────────────────────────────────────────────────────────────────

_FULL_TEMPLATE = """\
{html_skill}

---

## ⚠️ CRÍTICO — Entorno de ejecución

Este HTML se ejecuta en un navegador Chromium headless completamente desatendido.
No hay ningún usuario presente. No hay teclado, ratón ni interacción humana de ninguna forma.

**PROHIBIDO absoluto:**
- Overlays de "click to enter", "click to start", o similares
- Botones de inicio o modales que requieran interacción
- Cualquier lógica que espere un evento de usuario para iniciar el audio

**OBLIGATORIO:**
- El audio y el visualizador arrancan automáticamente al cargar la página
- Usar `DOMContentLoaded` + `audioCtx.resume()` + `audio.play()` en secuencia
- El visualizador empieza a animar sin esperar ningún input

---
{safe_zone_block}
## Diseño Visual

Género: {genre}
Estilo: {style}
Paleta de colores: {colors}
Tipografías: {fonts}
Animación principal: {animation}
Estilo de fondo: {background_style}
{css_filters_block}{user_context_block}
## Recursos

- Imagen de fondo: `bg.jpg` (en el mismo directorio que el HTML)
- Pista de audio: `song.mp3` (en el mismo directorio que el HTML)

## Requerimientos técnicos

- HTML autónomo, CSS interno en <style>, JavaScript interno en <script>
- Visualizador de audio usando Web Audio API en un elemento <canvas>
- Animaciones CSS suaves que reflejen el estilo "{animation}"
- La imagen bg.jpg como fondo con el tratamiento "{background_style}"
- Responsive: funciona a 1920×1080

## Instrucciones de salida

Genera ÚNICAMENTE el código HTML completo, comenzando con <!DOCTYPE html>.
No incluyas explicaciones, comentarios fuera del código ni bloques de código markdown.
"""

_SAFE_ZONE_BLOCK = """\
## ⚠️ ZONA SEGURA — Compatibilidad 9:16

Este video se exportará en formato 9:16 (vertical) para Reels e Instagram.
El crop se hace desde el centro de la imagen 16:9 original.

**OBLIGATORIO para todos los elementos visuales y textuales:**
- Todo el contenido importante (texto, canvas, logo, título) debe estar en el **60% central horizontal** de la pantalla
- El margen izquierdo y derecho debe tener al menos 20% de espacio libre (sin elementos críticos)
- El visualizador de audio (canvas) debe estar centrado y no exceder el 60% del ancho
- Esto garantiza que al recortar a 9:16, nada quede cortado

---
"""

_CSS_FILTERS_BLOCK_TEMPLATE = """\
## Filtros CSS del Nicho

Los siguientes filtros CSS se aplicarán sobre el video final en post-procesamiento.
Diseña el HTML teniendo en cuenta que el resultado final tendrá estos filtros:
`{filters}`

Esto significa: {filters_meaning}

---
"""

_FILTERS_MEANING = {
    "grayscale(1)": "la imagen final será en blanco y negro",
    "grayscale(100%)": "la imagen final será en blanco y negro",
    "contrast(1.15)": "el contraste aumentará un 15%",
    "contrast(1.2)": "el contraste aumentará un 20%",
    "contrast(120%)": "el contraste aumentará un 20%",
    "brightness(0.92)": "el brillo bajará ligeramente al 92%",
    "brightness(0.85)": "el brillo bajará al 85%",
    "brightness(80%)": "el brillo bajará al 80%",
    "hue-rotate(10deg)": "ligero desplazamiento de tono",
    "saturate(110%)": "saturación levemente aumentada",
    "brightness(90%)": "brillo ligeramente reducido",
}


def _filters_meaning(filters: list[str]) -> str:
    return ", ".join(_FILTERS_MEANING.get(f, f) for f in filters)


def _load_html_skill() -> str:
    skill_path = settings.skills_dir / "html" / "html_design.md"
    if skill_path.exists():
        return skill_path.read_text(encoding="utf-8")
    return "Soy un director creativo especializado en visualizadores musicales modernos y elegantes."


def _image_only_templates() -> set[str]:
    return {"image_only_ambient", "image_only", "still_image"}


_AUTOPLAY_CODE = """\
   ```javascript
   window.addEventListener('DOMContentLoaded', function() {
     var a = document.getElementById('audio');
     a.play().catch(function() { setTimeout(function() { a.play(); }, 500); });
   });
   ```"""


async def run(job: Job, niche_cfg: NicheConfig) -> Job:
    if niche_cfg.pipeline_type == "config_driven_template":
        return await _run_config_mapper_prompt(job, niche_cfg)

    t_start = time.monotonic()
    design = job.artifacts.visual_design
    logger.info("prompt_architect_start", job_id=job.job_id, template=niche_cfg.html_visualizer.template)

    user_context_block = ""
    if job.input.user_context:
        user_context_block = f"\nDirección creativa adicional del usuario: {job.input.user_context}\n"

    filters_str = " ".join(niche_cfg.html_visualizer.filters) if niche_cfg.html_visualizer.filters else "none"
    template = niche_cfg.html_visualizer.template

    if template in _image_only_templates():
        # Modo imagen pura: sin texto, sin visualizador, sin animaciones
        html_skill_autoplay = _load_html_skill().split("## The scene")[0].strip()
        prompt = _IMAGE_ONLY_TEMPLATE.format(
            html_skill_autoplay=html_skill_autoplay,
            filters=filters_str,
            autoplay_code=_AUTOPLAY_CODE,
            user_context_block=user_context_block,
        )
    else:
        # Modo completo: visualizador + animaciones
        safe_zone_block = _SAFE_ZONE_BLOCK if niche_cfg.has_reels_format() else ""
        css_filters_block = ""
        if niche_cfg.html_visualizer.filters:
            css_filters_block = _CSS_FILTERS_BLOCK_TEMPLATE.format(
                filters=filters_str,
                filters_meaning=_filters_meaning(niche_cfg.html_visualizer.filters),
            )
        html_skill = _load_html_skill()
        prompt = _FULL_TEMPLATE.format(
            html_skill=html_skill,
            safe_zone_block=safe_zone_block,
            genre=design.genre,
            style=design.style,
            colors=", ".join(design.colors),
            fonts=", ".join(design.fonts),
            animation=design.animation,
            background_style=design.background_style,
            css_filters_block=css_filters_block,
            user_context_block=user_context_block,
        )

    logs_dir: Path = job.artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "03_prompt_generacion.txt").write_text(prompt, encoding="utf-8")

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "prompt_architect_done",
        job_id=job.job_id,
        template=template,
        prompt_length=len(prompt),
        elapsed=elapsed,
    )

    artifacts = job.artifacts.model_copy(update={"prompt_text": prompt})
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.PROMPT_BUILT)


# ─────────────────────────────────────────────────────────────────────────────
# pipeline_type == "config_driven_template"
# ─────────────────────────────────────────────────────────────────────────────

def _build_no_vision_prompt(job: Job, niche_cfg: NicheConfig) -> str:
    """config_driven_template con requires_vision_extraction=False — no hay VISION
    JSON, el config sale del estilo ya fijado por el nicho elegido (sin song_info,
    poda de dominio musical — ver docs/investigaciones)."""
    song_info_block = _NO_SONG_INFO_BLOCK_NO_VISION

    user_context_block = ""
    if job.input.user_context:
        user_context_block = f"\nDirección creativa adicional del usuario: {job.input.user_context}\n"

    return _NO_VISION_CONFIG_MAPPER_TEMPLATE.format(
        niche_display_name=niche_cfg.display_name,
        song_info_block=song_info_block,
        user_context_block=user_context_block,
    )


async def _run_config_mapper_prompt(job: Job, niche_cfg: NicheConfig) -> Job:
    t_start = time.monotonic()
    logger.info(
        "prompt_architect_config_mapper_start",
        job_id=job.job_id,
        template=niche_cfg.template.template_id,
    )

    if not niche_cfg.template.requires_vision_extraction:
        prompt = _build_no_vision_prompt(job, niche_cfg)
    else:
        vision_analysis = job.artifacts.vision_analysis
        if vision_analysis is None:
            raise RuntimeError(
                "prompt_architect(config_driven_template): job.artifacts.vision_analysis es None. "
                "visual_designer debe correr antes y producir el análisis del Vision Extractor."
            )

        # Sin song_info (poda de dominio musical, ver docs/investigaciones): nunca
        # hay override de texto propio todavía — el Config Mapper siempre usa los
        # valores sugeridos por el Vision Extractor.
        text_content_block = _NO_TEXT_OVERRIDE_BLOCK

        prompt = _CONFIG_MAPPER_USER_TEMPLATE.format(
            vision_json=json.dumps(vision_analysis, indent=2, ensure_ascii=False),
            text_content_block=text_content_block,
        )

    logs_dir: Path = job.artifacts.output_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    (logs_dir / "03_prompt_generacion.txt").write_text(prompt, encoding="utf-8")

    elapsed = round(time.monotonic() - t_start, 2)
    logger.info(
        "prompt_architect_config_mapper_done",
        job_id=job.job_id,
        prompt_length=len(prompt),
        elapsed=elapsed,
    )

    artifacts = job.artifacts.model_copy(update={"prompt_text": prompt})
    return job.model_copy(update={"artifacts": artifacts}).advance(JobStage.PROMPT_BUILT)

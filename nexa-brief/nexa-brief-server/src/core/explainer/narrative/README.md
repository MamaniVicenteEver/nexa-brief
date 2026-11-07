# Narrativas de los explainers

El arco que sigue el guion de un video. **Datos, no código**: cambiar el tono, los actos o los ejemplos es
editar un JSON. Estudio que lo originó: `docs/investigaciones/estrategia-amarillista-2026-10.md`.

| qué | dónde |
|---|---|
| estrategias | `src/skills/explainer/strategies/narrative/<id>.json` |
| default por categoría | `src/skills/explainer/strategies/narrative/_active.json` (hoy: amarillista para todas) |
| esquema | `models.py` (actos con orden + peso + intensidad, **sin segundos**; técnicas de retención; niveles de título; pregunta final; checks) |
| puerto / adapter | `src/core/ports/narrative_port.py` / `src/adapters/narrative/` (JSON con caché por fecha) |
| prompts | `prompts.py` (brief: bloque `narrativa`, incluida `retention`; producción: `production_lines`, con técnicas de retención) |
| grabado en el video | `video.py` → `assets/config.json`, `manifest.json`, `publish.json → strategies_used.narrative` |
| checks del servidor | `checks.py` (comentario fijado = pregunta del video), dentro de `publishing check` |
| checks del kit | `explainer-kit/tools/narrative_check.py` (orden de actos, apertura, pregunta en pantalla; la retención es guía y no se valida) via `kit.py check` |
| API | `GET /api/v1/explainer/options?category=` → `narratives`, `default_narrative`; brief y producción aceptan `narrative_id` y `title_level` |
| web | `nexa-brief-web/src/features/explainer/components/NarrativePicker.tsx` |

La estrategia amarillista usa **negro** por defecto: hasta 60 caracteres, con datos verificables y
sin atribuir causalidad que las fuentes no demuestran. Los ejemplos de títulos viven en
`title.levels.<nivel>.examples`; `examples` conserva ejemplos de tono, no títulos de otros niveles.
Las cinco técnicas de `retention` orientan al guionista y llegan a ambos prompts, pero no son checks.

## Agregar o cambiar una narrativa

1. No edites una que ya se usó en videos: copiala a `narrative_<nombre>_v2.json` y cambiá su `id`.
2. Para que sea la de por defecto: `_active.json` → `{"_default": "<id>"}` o solo para una categoría
   (`"node_history": "<id>"`). Se relee sola: no hace falta reiniciar.
3. `uv run pytest tests/unit/test_narrative.py` valida todos los JSON de la carpeta.

## Cuando algo falla

- Todos los errores son `NarrativeError` (`NotFound`, `Invalid`) y dicen narrativa, archivo y campo:
  `[narrativa narrative_x_v1] Field required (archivo …/narrative_x_v1.json, campo acts.2.weight)`.
- En los logs: `narrative_skipped` (un JSON roto no aparece en la lista), `narrative_default_unavailable`
  (el default no carga: los videos nuevos salen con el arco documental de siempre),
  `narrative_check_skipped` (no se pudo validar el comentario fijado).
- Aislamiento: si la carpeta falta o todo está roto, el selector desaparece de la web y la producción sigue
  como antes del módulo. Solo una narrativa **elegida a mano** que no existe es un error (400).

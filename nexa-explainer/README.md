# nexa-explainer

## Voces escuchables para el recorte de Obama

La voz elegida es **Gacrux**: [muestra emocional aprobada con Gemini 3.1, 28 s](http://127.0.0.1:8766/emotion_tests/gemini31_gacrux_dolor.wav). En la generación completa Gemini 3.1 respondió con límite de cuota (HTTP 429), por lo que el sistema usó **Gemini 2.5 Flash Preview TTS / Gacrux**. El resultado completo puede sonar diferente a la muestra 3.1 y debe aprobarse escuchándolo. Las otras pruebas de voces, con sus modelos y enlaces directos, están en [el README de pruebas de voz](../html-templates-poc/production/06-voz-creation-cont/README.md#obama-pruebas-de-voces-para-llamada-de-atención). Allí se registran Algenib, Orus, Alnilam, Rasalgethi, Sulafat, Vindemiatrix, Determined_Man, Imposing_Manner y Elegant_Man sin asignarles una categoría.

## Prototipo editorial de Obama

- [Previsualización 16:9 con controles y audio completo](http://127.0.0.1:8000/api/v1/explainer/projects/d60783b91d5047e99440b21beb9619d2/preview/)
- [Escuchar sólo la narración española](http://127.0.0.1:8000/api/v1/explainer/projects/d60783b91d5047e99440b21beb9619d2/asset/editorial-narration.wav)
- [Escuchar narración masculina Charon](http://127.0.0.1:8000/api/v1/explainer/projects/d60783b91d5047e99440b21beb9619d2/asset/editorial-narration-charon.wav) — Gemini 3.1 Flash TTS, 188 s.
- [Transcripción fuente en inglés](http://127.0.0.1:8000/api/v1/explainer/projects/d60783b91d5047e99440b21beb9619d2/asset/transcript.json), [análisis emocional de DeepSeek](http://127.0.0.1:8000/api/v1/explainer/projects/d60783b91d5047e99440b21beb9619d2/asset/editorial-emotion-analysis.json), [prompts de voz de Gemini Flash](http://127.0.0.1:8000/api/v1/explainer/projects/d60783b91d5047e99440b21beb9619d2/asset/editorial-tts-prompts.json) y [plan de dirección](http://127.0.0.1:8000/api/v1/explainer/projects/d60783b91d5047e99440b21beb9619d2/asset/editorial-plan.json).

La previsualización incluye un panel lateral con tres ediciones independientes: **Prism Echo** (geometría cálida y cinematográfica), **Noir Manifesto** (blanco y negro, tipografía monumental) y **Archive Signal** (composición editorial cálida con Playfair Display). Cada una tiene intro, cierre, tratamiento de video, paleta, tipografía, escala, posición de títulos e iconografía propios. También permite alternar Gacrux/Charon sin perder la posición de reproducción. El selector sólo afecta la vista de revisión; la plantilla elegida se fijará en el render final después de aprobación.

La voz española es una **adaptación editorial sintética**, no una traducción literal ni una imitación de Obama. Este entregable es una previsualización reproducible, no un MP4 final. Revisar transcripción, fidelidad del guion y derechos del video fuente antes de publicar. Los enlaces locales requieren el servidor API encendido en el puerto 8000.

Sistema 1 de `nexa-docs/nexa-pocs/dos-sistemas-nuevos-desde-nexa-brief-y-nexa-render.md` — leer ese documento completo antes de escribir código acá, tiene el paso a paso, los requerimientos y qué falta construir.

**Qué hace**: el usuario graba un video 16:9 hablando a cámara (posicionado a la izquierda). El sistema arma automáticamente el 50% derecho con títulos, gráficas y subtítulos que aparecen sincronizados con lo que va diciendo — como si un editor/motion designer hubiera post-producido el video.

**Estado**: vertical slice funcional implementado. El flujo propio de Nexa Explainer ya está aislado del dominio musical: upload multipart → validación horizontal → primer frame + audio → análisis de frame → transcripción real o fallback controlado → escenas semánticas → preview → feedback → aprobación → MP4 final H.264/AAC. La UI operativa está en `/es/explainer` y `/en/explainer`.

Antes de instalar dependencias: `cd nexa-explainer-server && uv sync` y `cd nexa-explainer-web && pnpm install` (los `.venv`/`node_modules` no se copiaron).

## Piezas a copiar de `nexa-brief-server` (copiadas, no importadas — ver documento, sección "Análisis: ¿clonar nexa-brief o construir aparte?")

1. Esqueleto hexagonal puertos/adaptadores (`src/core/ports/*`, `src/adapters/*/factory.py`).
2. `faster_whisper_adapter.py` tal cual — transcripción con timestamp por palabra.
3. Patrón `vision_extractor` + "Config Mapper" (prompt de visión → JSON → `config.json`) — para detectar zona segura del presentador y no taparlo con el panel de gráficos.

## Lo implementado

- `src/explainer/media.py`: ffprobe/ffmpeg, primer frame, audio normalizado y validación de relación horizontal.
- `src/explainer/service.py`: ciclo de vida persistido, escenas, feedback, aprobación y render.
- `src/explainer/templates.py`: tres plantillas cerradas, tipografía profesional y SVG internos sin emojis.
- `src/presentation/api/routers/explainer.py`: contrato HTTP documentado en `nexa-explainer-server/docs/explainer-workflow.md`.
- `src/features/explainer/`: workspace web con selección de plantilla, upload, estado, preview, feedback y botón de aprobación.
- `tests/unit/test_explainer.py`: contratos de catálogo, normalización y HTML.

## Motor de render

El vertical slice actual usa Playwright + FFmpeg local para que el flujo sea
ejecutable sin otro servicio. `NEXA_RENDER_URL` queda reservado para conectar el
orquestador remoto cuando se cierre el contrato de subida de assets de
`nexa-render`; la composición HTML y el esquema de escenas ya son independientes
del motor.

## Ejecución

~~~bash
cd nexa-explainer-server
EXPLAINER_WHISPER_MODE=auto .venv/bin/uvicorn src.presentation.main:app --reload --port 8000

cd ../nexa-explainer-web
pnpm dev --port 3001
~~~

Para transcripción real en producción, usar un modelo local precargado y GPU:

~~~dotenv
EXPLAINER_WHISPER_MODE=local
WHISPER_DEVICE=cuda
WHISPER_COMPUTE_TYPE=float16
~~~

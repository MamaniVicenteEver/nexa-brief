# Progreso de grabación

La grabación del Explainer ahora emite progreso por formato y por fase. La bandeja flotante y `/biblioteca` consultan ese estado cada 3 segundos mientras haya una grabación activa; al terminar, se invalidan las consultas del job, los videos y la biblioteca.

## Cambios

- `src/templates/_tools/commercial/render_promo.py`: contador compartido de cuadros, línea `@@progress <hechos> <total>` aproximadamente una vez por segundo y emisión final, más `@@phase encode` antes de ffmpeg.
- `src/templates/_tools/explainer-kit/tools/kit.py`: línea `@@format <fmt> <i> <n>` por formato y salida del render sin buffering.
- `src/core/explainer/recorder.py`: lectura de stdout línea a línea con callback opcional, progreso global y ETA; los runners existentes sin callback siguen funcionando. El error conserva las últimas 800 letras de salida.
- API: `GET /api/v1/explainer/jobs?active=true` lista jobs activos y trabajos finalizados durante las últimas 24 horas (`active=false` devuelve el historial completo en memoria). La respuesta incluye `progress`, `progress_format`, `progress_phase`, `started_at` y `eta_seconds`; también `title` y `poster_url` para la tarjeta de Biblioteca.
- Web: tipos y servicio Explainer, tarjeta de progreso reutilizable en la bandeja y Biblioteca, estado de fallos con error y textos en español e inglés.

## Archivos de esta tarea

- Backend: `src/templates/_tools/commercial/render_promo.py`, `src/templates/_tools/explainer-kit/tools/kit.py`, `src/core/explainer/recorder.py`, `src/presentation/api/routers/explainer.py`, `src/presentation/api/schemas/explainer_schema.py`.
- Pruebas: `tests/conftest.py`, `tests/unit/test_explainer.py`, `tests/unit/test_explainer_production.py`, `tests/unit/test_explainer_sandbox.py`.
- Web: `src/features/explainer/types.ts`, `src/features/explainer/api/explainer-service.ts`, `src/features/explainer/hooks/useExplainer.ts`, `src/features/explainer/components/RecordingProgress.tsx`, `src/features/explainer/components/RecordingTrayCard.tsx`, `src/features/explainer/components/ExplainerPrepSection.tsx`, `src/features/library/components/BibliotecaView.tsx`, `src/features/library/components/ExplainerRecordingCard.tsx`, `messages/es.json`, `messages/en.json`.

Las pruebas de rutas usan el cliente ASGI asíncrono disponible en el entorno. Las comprobaciones de archivos estáticos consultan el handler, pues el transporte ASGI instalado no completa respuestas `FileResponse`. Se actualizaron también expectativas de pruebas antiguas para que reflejen el catálogo y los artefactos disponibles en este workspace.

## Verificación

- `UV_CACHE_DIR=/tmp/nexa-brief-uv-cache ~/.local/bin/uv run pytest tests/unit -q -k "recorder or explainer"`: **99 passed**, 460 deselected. Queda una advertencia deprecada de Starlette/httpx.
- `node_modules/.bin/tsc --noEmit` desde `nexa-brief-web`: **correcto**.
- `node_modules/.bin/biome lint .` desde `nexa-brief-web`: **sin errores** en 384 archivos; muestra 6 avisos informativos de estilo.
- `git diff --check`: **correcto**.
- Los comandos `pnpm` solicitados no pudieron arrancar porque Corepack intentó acceder al registro npm y el entorno respondió `EAI_AGAIN`; se ejecutaron las herramientas locales equivalentes.

No se ejecutaron renders, publicaciones ni reinicios de servicios.

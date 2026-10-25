# Tarea: progreso de grabación visible en la web (sin recargar)

Repo: ~/Projects/Git-Projects/nexa-brief/nexa-brief (nexa-brief-server = FastAPI, nexa-brief-web = Next.js).
Lee AGENTS.md de la raíz y de cada subproyecto y respeta su estilo (comentarios en español, mismo idioma de código).

## Problema
Al apretar "Grabar" un video explainer (10–12 min de video tarda ~35 min), la web solo muestra "Renderizando…" sin
avance, y al terminar hay que recargar la página para ver el resultado. Se quiere:
1. Barra de progreso (porcentaje, formato actual "Móvil 9:16" / "Desktop 16:9", fase "capturando"/"codificando",
   tiempo restante estimado) en el modal/aviso flotante "Videos en proceso" (nexa-brief-web/src/features/studio/hooks/
   useRecordPrototype.ts y el componente que pinta "Videos en proceso"/"Renderizando…"; búscalos con grep).
2. En /biblioteca (nexa-brief-web/src/app/[locale]/(admin)/biblioteca/page.tsx) una TARJETA con el mismo estilo que las
   demás para cada grabación en curso (miniatura/poster si hay, título, badge "Grabando", barra de progreso, formato, fase,
   ETA; si falla: badge "Falló" con el error). Debe contar en la pestaña "En proceso".
3. Que todo se actualice solo: sondeo cada ~3 s mientras haya grabaciones activas (y nada cuando no hay), y al terminar una
   grabación invalidar/refrescar los datos de la biblioteca y del modal para que aparezca el video sin recargar.

## Backend (nexa-brief-server)
- src/templates/_tools/commercial/render_promo.py: hoy cada worker imprime "  [w1]  12.03s". Añade un contador compartido de
  cuadros y emite líneas de máquina con flush: `@@progress <hechos> <total>` (como mucho ~1 por segundo) y `@@phase encode`
  antes de ffmpeg. No cambies el resto del comportamiento ni los argumentos.
- src/templates/_tools/explainer-kit/tools/kit.py cmd_render: antes de cada formato imprime `@@format <fmt> <i> <n>` (flush) y
  asegúrate de que la salida del hijo llegue en vivo (sin buffer).
- src/core/explainer/recorder.py: run_kit_render debe leer stdout línea a línea (no communicate()) y reportar el progreso a un
  callback opcional; guarda en RecordJob: progress (0..1 global sobre todos los formatos), progress_format, progress_phase
  ("capturing"|"encoding"), started_at y eta_seconds. Mantén compatibles los RenderRunner inyectados en tests (callback
  opcional). Conserva las últimas ~800 letras de salida para el mensaje de error.
- API (src/presentation/api/routers/explainer.py): expón esos campos en la respuesta del job y añade (si no existe) un endpoint
  para listar los jobs de grabación activos y los terminados recientemente (p. ej. GET /explainer/jobs?active=true) que use
  la web. Actualiza esquemas Pydantic.
- Tests: amplía/ajusta tests unitarios del recorder (parser de @@progress/@@format/@@phase y cálculo global). Ejecuta
  `~/.local/bin/uv run pytest tests/unit -q -k "recorder or explainer"` hasta verde.

## Frontend (nexa-brief-web)
- Tipos en src/features/explainer/types.ts y servicio en src/features/explainer/api/explainer-service.ts.
- Usa los componentes/estilos existentes (busca una barra de progreso ya hecha; si no hay, una simple con Tailwind).
- Textos en español e inglés si la app usa i18n (messages/*.json).
- Verifica: `pnpm -C nexa-brief-web exec tsc --noEmit` y el lint del proyecto, sin errores nuevos.

## Reglas
- NO lances renders reales ni publiques nada. No reinicies servicios (uvicorn y next tienen recarga en caliente). Sin commit.
- Cambios mínimos y enfocados. Al final escribe nexa-brief-server/docs/investigaciones/progreso-grabacion-resumen.md con
  archivos tocados, endpoints/campos nuevos y resultado de tests/tsc.

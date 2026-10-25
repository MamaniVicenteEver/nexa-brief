# Tarea: estudio del sistema de grabación ("Grabar" en la app)

Pregunta del usuario: si aprieta "Grabar" para un video completo (10–12 min), ¿se grabará todo bien?
Hay un render de prueba de 60 s corriendo AHORA en esta misma máquina (no lo interrumpas, no lances otro render).

## Lee y analiza (SOLO LECTURA de código; no modifiques nada salvo escribir el informe)
- src/presentation/api/routers/explainer.py (POST /explainer/videos/{id}/record) y src/core/explainer/recorder.py
- src/templates/_tools/explainer-kit/tools/kit.py (cmd_render), tools/shoot.py, tools/poster.py, engine/kit.js (seek / render cuadro a cuadro)
- Cómo se sirven las páginas al navegador headless, fps, formatos 16x9/9x16, ffmpeg, audio, salida a output/<categoría>/,
  publicación posterior (YouTube privado→HD→público, Instagram 300MB, etc.), timeouts, reintentos, jobs en memoria.
- Máquina: Ubuntu 26.04, i3-8100 4 núcleos, 7 GB RAM, sin GPU dedicada. Playwright no soporta Ubuntu 26.04: Chromium se
  instaló con PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 (headless shell en ~/.cache/ms-playwright). ¿El servidor
  (uvicorn) encontrará ese Chromium? ¿Falta alguna dependencia del sistema?
- Revisa los dos videos listos: src/templates/nodetech/programadores-nueva-era y src/templates/nodehistory/y2k-medianoche
  (medios referenciados existen, videos .mp4 de assets/media, fuentes, duración ~11–12 min).
- Puedes ejecutar comandos de solo lectura (ls, df -h, free -h, ffmpeg -version, uv run python -c "import ...").

## Entregable
Escribe docs/investigaciones/grabacion-estudio-2026-10.md (español, conciso):
1. Cómo funciona el flujo paso a paso (con archivo:línea).
2. Riesgos concretos de que falle una grabación larga (memoria, disco, timeouts, Chromium, cuadros perdidos, desfase
   audio/video, video .mp4 dentro del navegador, procesos colgados, reinicio de uvicorn a mitad), cada uno con
   probabilidad (alta/media/baja) y cómo detectarlo.
3. Estimación de tiempo/disco por video completo y por formato (deja un hueco para el dato real del render de 60 s).
4. Recomendaciones ordenadas por impacto (sin implementarlas).

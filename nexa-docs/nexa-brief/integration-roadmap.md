# Roadmap de integración: server + web + prototipo + plantillas

## Contexto

El proyecto tiene 4 piezas que hoy no están conectadas entre sí:

- **`nexa-brief-server`** — backend FastAPI que ya corre el pipeline completo (análisis → diseño visual → recursos → prompt → HTML → grabación → resumen → empaquetado → publicación opcional), pero nació para correr por script/CLI, no para servir a un frontend web.
- **`nexa-brief-web`** — proyecto Next.js recién scaffoldeado (aparentemente en otra sesión/herramienta, hoy mismo): stack moderno (Next 16, React 19, shadcn, TanStack Query, RHF+Zod, Zustand) con un README que ya documenta las 7 rutas planeadas y un contrato de API — pero **cero páginas reales**, solo el boilerplate de `create-next-app` y carpetas de features vacías (`export {}`).
- **`html-templates-poc/web`** — el prototipo estático que armamos juntos: todas las pantallas y flujos ya diseñados y funcionando con datos de ejemplo (`data.json`). Es el plano de referencia de cómo se ve y se comporta cada sección.
- **`html-templates-poc/production`** — las 5 plantillas HTML reales (imagen con fondo, PNG sin fondo, paisaje, video en loop, letras) que hoy **no están conectadas al pipeline**: el backend genera el HTML desde cero con DeepSeek en cada video, no elige entre estas plantillas.

El objetivo es un plan por fases — no todo junto — empezando por una porción chica pero completamente funcional de punta a punta, y llegando gradualmente a que el sistema pueda auto-generar/publicar solo, pero siempre con la opción de intervenir manualmente desde la web (subir imagen/canción propia, elegir plantilla, etc. — como ya está en el prototipo).

## Diagnóstico verificado del backend (no es solo "desactualizado", son 4 huecos concretos)

Auditoría real de código (no supuestos):

1. **No hay CORS configurado.** `grep -r CORS src/` no devuelve nada. Next.js en otro puerto no puede llamar a la API hasta que se agregue `CORSMiddleware`. Esto bloquea *cualquier* integración, es lo primero que hay que tocar.

2. **`POST /api/v1/videos` es síncrono de punta a punta.** Aunque devuelve `202`, el `await` no vuelve hasta que termina *todo* el batch (que puede ser horas, dado que los videos duran 1–5h). Una request HTTP no puede quedar colgada así — hace falta un job en background + un endpoint de estado para hacer polling. Esto es lo que hay que resolver antes de que el botón "Generar lote" del prototipo pueda ser real.

3. **Búsqueda de imagen/música no es accesible por HTTP.** Los adaptadores (`Unsplash/Pexels/Pixabay`, `Pixabay Music/Jamendo/yt-dlp`) existen y funcionan, pero el pipeline los llama internamente — no hay `/images/search` ni `/music/search`. Por eso hoy la web no puede "buscar y mostrar candidatos", solo podría subir un archivo propio.

4. **Ya existen endpoints reales y usables hoy mismo:** `GET /api/v1/categories(/{id})`, `GET /api/v1/publish/accounts`, y todo el flujo OAuth (`/publish/auth/{tiktok,youtube,facebook}/start|callback`) — probados y funcionando. También hay un router de YouTube OAuth **duplicado y legacy** (`youtube_oauth.py`) coexistiendo con el bueno (dentro de `publisher.py`) — es limpieza pendiente, no bloquea nada.

Nota menor: el README de `html-templates-poc/web` ya trae una sección "Integración con APIs" (agregada en otra sesión) con un contrato bastante fiel al código real — `BatchResponse`/`JobStatusResponse` coinciden exactamente. Solo el shape de cuentas está un poco desactualizado (el real usa `expires_in_seconds` + `has_refresh_token`, no `last_checked`). Vale la pena reconciliar esa sección con este roadmap más adelante para no tener dos fuentes de verdad.

## Decisión de arquitectura para las fases (a confirmar con el uso, no bloquea el arranque)

Para el job queue (punto 2 del diagnóstico): dado que es una herramienta de un solo operador, alcanza con algo simple — `BackgroundTasks` de FastAPI + una tabla/archivo de estado (SQLite o incluso JSON en disco, ya que el pipeline ya escribe logs por etapa a disco). No hace falta Redis/Celery para este tamaño de uso.

**Pregunta abierta que no se resuelve acá porque es una decisión de producto, no de plomería:** ¿las 5 plantillas de `production/` van a *reemplazar* la generación desde cero con DeepSeek (el pipeline elige/llena una plantilla en vez de escribir HTML nuevo), o van a coexistir como una opción más? Esto define qué tan real puede ser el selector "Plantilla visual" del formulario Crear Video. Se deja como decisión explícita en la Fase 5, no antes.

## Fases

### Fase 0 — Desbloquear la conexión (chica, prerequisito de todo)

- Agregar `CORSMiddleware` a `nexa-brief-server` (origen `http://localhost:3000` en dev).
- Eliminar el router legacy `youtube_oauth.py` (duplicado de lo que ya hace bien `publisher.py`).
- Confirmar en `nexa-brief-web/.env.local` que `NEXT_PUBLIC_API_URL=http://localhost:8000` apunta al server corriendo.
- **Criterio de hecho:** desde una página cualquiera de Next.js, un `fetch(NEXT_PUBLIC_API_URL + '/health')` responde sin error de CORS.

### Fase 1 — Primera sección 100% real: Canales

Se eligió **Canales** como primer corte vertical porque ya existen los endpoints que necesita (`GET /publish/accounts`, y los `/auth/*/start` que ya redirigen a cada plataforma), es de solo lectura + un par de botones (bajo riesgo), y prueba la cadena completa (CORS → fetch → TanStack Query → render) sin tocar el pipeline pesado.

- Construir `nexa-brief-web/src/app/channels/page.tsx` + `features/channels/*` portando el diseño de `html-templates-poc/web` (tarjetas por plataforma, estado de cuenta, botón conectar/reconectar).
- Conectar a `GET /api/v1/publish/accounts` con TanStack Query; los botones "Conectar"/"Reconectar" abren `GET /publish/auth/{platform}/{alias}/start` en una ventana/redirect.
- De paso: conectar el `<select>` de nicho en Crear Video a `GET /api/v1/categories` (mismo patrón de fetch, mínimo esfuerzo adicional ya que el endpoint también es de solo lectura).
- **Criterio de hecho:** Canales en la web muestra las cuentas reales configuradas en `accounts.json`, y conectar una cuenta nueva de verdad guarda el token.

### Fase 2 — El loop central: Crear video + Biblioteca (async real)

La parte más grande e importante — es la que convierte esto en una herramienta real de producción, no una demo.

- Backend: convertir `POST /api/v1/videos` en asíncrono real — encolar con `BackgroundTasks`, guardar estado por job (SQLite simple), y agregar `GET /api/v1/videos/{job_id}` (o `/jobs`) para polling.
- Backend: eliminar/ajustar el flag `enable_auto_publishing` si corresponde para que quede coherente con el nuevo flujo async.
- Web: `create/page.tsx` con el formulario real (nicho opcional, plantilla — todavía cosmético hasta Fase 5, canal+cuenta, recursos opcionales, duración) enviando `POST /videos`.
- Web: `library/page.tsx` con las pestañas Listos/En cola/Publicados/Fallidos haciendo polling de estado real (reemplaza el `data.json` mock).
- **Criterio de hecho:** desde la web se genera un video real de punta a punta y aparece en Biblioteca cuando termina, sin que el navegador se quede colgado esperando.

### Fase 3 — Búsqueda de imagen/música expuesta a la web

Habilita el pedido explícito de "poder buscar imágenes, música" desde la web, no solo que el sistema las elija a ciegas.

- Backend: nuevos endpoints livianos `GET /api/v1/images/search?q=` y `GET /api/v1/music/search?q=` que reusen los adaptadores existentes (`ImagePort`/`MusicPort`) y devuelvan candidatos con preview URL.
- Web: en "Recursos" de Crear Video, además de subir archivo propio, mostrar resultados de búsqueda para elegir uno (o dejarlo en automático).
- **Criterio de hecho:** se puede buscar y previsualizar una imagen/canción real desde el formulario antes de generar.

### Fase 4 — Publicación y programación automatizadas

Construye sobre el job model de la Fase 2.

- Web: `schedule/page.tsx` real — hoy no existe scheduler de publicación por horario en el backend (solo hay un refresco de tokens vía APScheduler), así que esto requiere un job programado nuevo del lado servidor.
- Web: botón "Publicar ahora" en Biblioteca conectado a `POST /publish/`.
- **Criterio de hecho:** un video queda agendado y se publica solo a la hora configurada, sin intervención manual.

### Fase 5 — Decisión y conexión de Plantillas (`production/`)

Depende de la decisión de producto planteada arriba. Una vez resuelta:

- Si las plantillas reemplazan la generación libre: el stage de "Generación de HTML" del pipeline pasa a elegir una plantilla de `production/` y llenar su `config.json` (vía IA o determinista) en lugar de escribir HTML desde cero.
- Web: el selector "Plantilla visual" de Crear Video pasa de cosmético a funcional, y la sección Plantillas puede mostrar el catálogo real (ya casi calca lo que se hizo en el prototipo).
- **Criterio de hecho:** elegir una plantilla en Crear Video efectivamente determina el estilo visual del video generado.

### Fase 6 — Historial y Notificaciones (observabilidad, menor prioridad)

- Web: `history/page.tsx` leyendo los logs reales por etapa que el pipeline ya escribe a disco (`0X_*.json` por job).
- Backend + web: eventos reales de notificación (token expirado, publicación fallida, video listo) — hoy la sección es un placeholder a propósito.

## Próximo paso

Este documento es el estudio/roadmap pedido. No implica que ya se haya tocado código de `nexa-brief-server` ni `nexa-brief-web` — se arranca a programar fase por fase cuando se indique explícitamente con cuál empezar (por ejemplo: "arranquemos con la fase 0 y 1").

# nexa-render

Servicio independiente que convierte HTML/CSS/JS (o un componente React) en
un archivo de video (.mp4), eligiendo entre 3 motores de render
intercambiables. No es parte del pipeline de marketing de Nexa Brief — es un
sistema genérico y reusable, con su propia interfaz gráfica, su propia API
REST, y una interfaz MCP para que agentes de IA lo llamen directo.

## Qué es / qué no es

- **Es:** un servicio de "dame HTML/React + audio, elegí motor y worker,
  devolveme un video". Puerta de entrada por REST, MCP, o su propia GUI.
- **No es:** parte de `nexa-brief-server` (el pipeline de generación/publicación
  de contenido de marketing). No sabe nada de nichos, canciones, ni
  publicación en redes — solo graba HTML/React a video.

Contexto e investigación previa que motivó este proyecto:
`nexa-brief-server/docs/investigaciones/motor-prompt-a-video.md` y
`sistema-independiente-render-engine.md`.

## Arquitectura

```
nexa-render/
├── web/       Next.js — interfaz gráfica. SOLO habla con server/ por REST HTTP.
└── server/    Node/TS — API REST, servidor MCP, cola de jobs (BullMQ), 3 motores de render.
```

`web/` nunca importa código de motores ni de la cola — es un cliente HTTP más.
El servidor MCP (`server/src/mcp/`) es una segunda puerta de entrada a la
MISMA lógica de negocio de `server/` (jobs/cola/motores), no una
implementación paralela.

### Los 3 motores

| Motor | Cómo corre | Estado |
|---|---|---|
| **Playwright** | in-process, Chromium headless + FFmpeg — el único verdaderamente genérico (HTML/CSS/JS arbitrario) | ✅ Fase 1 — real |
| **Remotion** | subproceso — composiciones React, mismo contrato que `nexa-brief-remotion/scripts/render-node.mjs` | ⏳ Fase 2 |
| **HyperFrames** | subproceso — binario local `hyperframes`, requiere convención `data-*`/GSAP (ver `hyperframes-poc/`) | ⏳ Fase 2 |

### Workers (dónde corre el render)

| Worker | Estado |
|---|---|
| `local` | ✅ Fase 1 |
| `aws` | ⏳ Fase 3 — bloqueado por no tener cuenta AWS todavía (mismo estado que Remotion Lambda en `nexa-brief-remotion`) |

## Prerequisitos

- Node.js 22+, `pnpm` 10+ (`corepack enable` si hace falta)
- Redis (local: `docker compose up -d redis`, o cualquier Redis accesible)
- FFmpeg instalado en el sistema (`ffmpeg -version`)
- Chromium de Playwright: `pnpm --filter nexa-render-server exec playwright install chromium`

## Quickstart

```bash
pnpm install
docker compose up -d redis

# Backend (API REST + servidor MCP + workers de cola)
pnpm --filter nexa-render-server dev

# Frontend (en otra terminal)
pnpm --filter nexa-render-web dev
```

`GET http://localhost:4000/api/v1/health` confirma que el backend está arriba.
`GET http://localhost:4000/api/v1/engines` muestra qué motor está realmente
implementado (`implemented: true|false`) — la GUI y el MCP nunca mienten
sobre qué funciona todavía.

## Docker (stack completo)

Para ejecutar la aplicación completa, sin instalar Redis, Chromium ni FFmpeg
en el host:

```bash
docker compose up -d --build
```

| Servicio | URL / acceso | Persistencia |
|---|---|---|
| Web | http://localhost:3000 | — |
| API y Swagger | http://localhost:4000 / http://localhost:4000/docs | renders en `render-data` |
| Redis | solo red interna Docker | datos AOF en `redis-data` |

`web`, `server` y `redis` están aislados en `nexa-render-network`. Solo web y
API publican puertos al host; Redis no se expone. El servidor depende de que
Redis esté saludable y de un inicializador que asigna los directorios
persistentes al usuario no privilegiado `node`.

La URL pública de la API se incorpora durante el build del frontend. Para un
host remoto, define la dirección que verá el navegador antes de construir:

```bash
NEXT_PUBLIC_API_URL=https://api.ejemplo.com docker compose up -d --build
```

Los healthchecks se ejecutan cada 5 segundos, tienen timeout de 5 segundos y
fallan tras 3 intentos. Redis y los procesos de aplicación usan como máximo 3
reinicios por fallo; la conexión Redis del servidor espera como máximo 5
segundos y reintenta hasta 3 veces.

### Verificación reproducible

Con Docker y `curl` disponibles, este comando inicia el stack y prueba Redis,
API, interfaz web, cola BullMQ, Playwright, FFmpeg y la descarga del MP4
generado:

```bash
./scripts/verify-docker.sh
```

### Aplicar cambios de backend o frontend

Docker no copia automáticamente los cambios de código a una imagen ya creada.
El script de actualización recibe el servicio que cambió:

```bash
# Solo cambios en frontend (web/)
./scripts/rebuild-app-images.sh web

# Solo cambios en backend, workers o Dockerfile del servidor (server/)
./scripts/rebuild-app-images.sh server

# Cambios compartidos, dependencias o ambos servicios
./scripts/rebuild-app-images.sh all
```

Si se omite el destino, se usa `all`. El script reconstruye únicamente las
imágenes elegidas y recrea únicamente sus contenedores. Redis, el otro servicio
y los volúmenes persistentes no se eliminan, por lo que no se pierden la cola
ni los renders existentes.

Si necesitas ignorar completamente el caché Docker —por ejemplo, después de
un problema de dependencias o de una imagen base— usa:

```bash
./scripts/rebuild-app-images.sh all --no-cache
```

También puedes ejecutar directamente el equivalente manual:

```bash
docker compose build web
docker compose up -d --force-recreate web
```

Por defecto Docker publica API en el puerto `4000` y web en `3000`. Si ya
tienes `pnpm ... dev` ejecutándose en el host, esos puertos estarán ocupados.
Detén el modo local **o** usa puertos alternativos; en ese segundo caso también
debes indicar la URL que usará el navegador para la API:

```bash
SERVER_PORT=4001 WEB_PORT=3001 NEXT_PUBLIC_API_URL=http://localhost:4001 \
  ./scripts/rebuild-app-images.sh
```

La aplicación quedará entonces disponible en `http://localhost:3001` y su API
en `http://localhost:4001`. El Compose incluye ambos puertos (`3000`/`3001`)
en CORS; si eliges otros puertos, define también los orígenes permitidos:

```bash
SERVER_PORT=4002 WEB_PORT=3002 NEXT_PUBLIC_API_URL=http://localhost:4002 \
ALLOWED_ORIGINS=http://localhost:3002,http://127.0.0.1:3002 \
  ./scripts/rebuild-app-images.sh all
```

La web usa dos URLs deliberadamente: `NEXT_PUBLIC_API_URL` para el navegador
y `API_INTERNAL_URL=http://server:4000` para el renderizado interno de Next.js.
No reemplaces la segunda por `localhost`, porque dentro del contenedor
`localhost` es la propia web y el editor de plantillas no podría cargarse.

Para detener la aplicación conservando los videos y datos de Redis:

```bash
docker compose down
```

Para borrar también los datos persistentes (operación destructiva):

```bash
docker compose down --volumes
```

## Estado por fase

| Fase | Contenido | Estado |
|---|---|---|
| 1 | MCP + motor Playwright + worker local + API REST completa (con Swagger en `/docs`) + sandboxing | ✅ hecho |
| 1.5 | `web/` — flujo completo `/plantillas` → editor (CodeMirror + preview vivo) → configurar (motor/worker/fps/formato) → Grabar → `/trabajos/[jobId]`, adelantado desde la Fase 4 original | ✅ hecho (solo con el motor Playwright real) |
| 2 | Motores Remotion + HyperFrames | ⏳ pendiente |
| 3 | Worker AWS | ⏳ pendiente (bloqueado por infraestructura) |
| 4 | Modo "traé tu React" en el editor, dashboard de jobs recientes, auto-selector de motor "inteligente" | ⏳ pendiente |

**Documentación interactiva de la API:** `http://localhost:4000/docs`
(Swagger UI, generado automáticamente desde los schemas zod de cada ruta).

Ver `server/README.md` y `web/README.md` para el detalle de cada mitad.

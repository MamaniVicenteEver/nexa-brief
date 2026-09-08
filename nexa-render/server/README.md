# nexa-render-server

Backend de `nexa-render`: API REST, servidor MCP, cola de jobs (BullMQ) y los
3 motores de render. `web/` es su único consumidor — nunca al revés.

## Layout

```
src/
├── api/            Fastify: rutas REST, esquemas zod, mapeo de errores
├── mcp/             servidor MCP (stdio): render / getStatus / configureWorker
├── engines/
│   ├── port.ts       interfaz RenderEngine + tipos compartidos
│   ├── factory.ts     getEngine(nombre) + selectEngine(input) [regla simple]
│   ├── playwright/     motor genérico — REAL (Fase 1)
│   ├── remotion/         composiciones React — stub (Fase 2)
│   └── hyperframes/       timelines GSAP — stub (Fase 2)
├── queue/             BullMQ: 3 colas (una por motor) + sus Workers
├── jobs/                modelo de job mínimo {id, input, status, result} + job.service.ts
├── sandbox/              timeout por job, workdir efímero, persistencia de resultados
├── config/                env validado con zod
├── templates/              3 plantillas default servidas por GET /templates
├── index.ts                 arranca REST + Workers de cola (un proceso)
└── mcp-index.ts              arranca el servidor MCP (proceso SEPARADO — ver abajo)
```

## La interfaz de motor

```ts
interface RenderEngine {
  readonly name: "playwright" | "remotion" | "hyperframes";
  canHandle(input: RenderInput): boolean;
  render(input: RenderInput, options: EngineOptions): Promise<EngineResult>;
}
```

Puerto de `nexa-brief-server/src/core/ports/recorder_port.py` — misma forma
(puerto + factory + adaptador por motor), generalizada para 3 motores y para
aceptar tanto HTML plano como un componente React.

## Estado por motor

| Motor | Invocación | Estado |
|---|---|---|
| **Playwright** | in-process (paquete `playwright`), Chromium + FFmpeg | ✅ real |
| **Remotion** | subproceso, puerto de `nexa-brief-video-test/scripts/render-node.mjs` | ⏳ Fase 2 (stub que lanza `EngineNotImplementedError`) |
| **HyperFrames** | subproceso, binario local `node_modules/.bin/hyperframes` (nunca `npx`) | ⏳ Fase 2 (stub) |

**Motor Playwright — dos diferencias deliberadas frente al adaptador Python
de Nexa Brief:**
1. Espera `page.waitForLoadState('networkidle')` antes del primer frame
   (ausente en el original) — evita fuentes/imágenes a medio cargar.
2. **No** usa `--disable-web-security`. En cambio, `sandbox/network-guard.ts`
   instala un allowlist de red (`page.route()`): solo el servidor estático
   efímero del propio job + los dominios en `NETWORK_ALLOWLIST`. Necesario
   porque acá el HTML puede venir de un tercero, a diferencia de Nexa Brief
  (siempre HTML generado por su propia IA).

### Recursos externos

Las referencias estáticas `https://`/`http://` que aparezcan en HTML, CSS, JS,
JSX, props o `audioUrl` se descargan antes del render, una sola vez por job, y
se sustituyen por URLs de un servidor loopback efímero. Esto funciona de forma
uniforme en Playwright, Remotion y HyperFrames para imágenes, videos, audio,
fuentes, SVG, JSON/Lottie y scripts estáticos. El host debe figurar exactamente
en `NETWORK_ALLOWLIST`; se bloquean IPs directas/redes privadas, redirecciones
no autorizadas y archivos que excedan `REMOTE_ASSET_MAX_BYTES`. Las URLs que un
script construye dinámicamente y streams DRM/HLS no se pueden materializar de
forma fiable y quedan fuera de este contrato.

**Auto-selección de motor** (`selectEngine()` en `factory.ts`) — regla simple,
no IA: ¿React? → Remotion. ¿HTML con la convención de HyperFrames
(`data-start`+`class="clip"`+`window.__timelines`)? → HyperFrames. Cualquier
otra cosa → Playwright.

## Cola (BullMQ)

Una `Queue`+`Worker` por motor (`render-playwright`, `render-remotion`,
`render-hyperframes`), concurrencia configurable por separado
(`PLAYWRIGHT_CONCURRENCY` etc. en `.env`) — no un pool compartido, porque
cada motor tiene un perfil de sensibilidad a CPU/timing distinto.

El job vive como `job.data`/`job.returnvalue` de BullMQ — no hay una
estructura Redis duplicada aparte.

## Sandboxing (desde el día uno, no una fase futura)

- Timeout duro por job (`JOB_TIMEOUT_MS`) vía `sandbox/limits.ts::withTimeout`.
- `workDir` efímero por job, borrado al terminar salvo `KEEP_WORKDIRS=true`.
- **Los artefactos se persisten en `OUT_DIR/<motor>/<jobId>/` ANTES de borrar
  `workDir`**. Cada job conserva `metadata.json`, `resources/` (inputs del
  usuario) y `outputs/` (mp4 finales). La galería y la descarga de videos leen
  exclusivamente desde esta estructura mediante `output-gallery.service.ts`.
- Playwright: allowlist de red, sin relajar same-origin.

## Documentación interactiva (Swagger)

`http://localhost:4000/docs` — generada automáticamente desde los schemas zod
de cada ruta (`fastify-type-provider-zod` + `@fastify/swagger`/`swagger-ui`),
no mantenida a mano — si se agrega un campo al schema, aparece solo en el
spec. JSON crudo del spec en `/docs/json`.

## API REST

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/api/v1/health` | healthcheck |
| GET | `/api/v1/templates` | lista las 3 plantillas default |
| GET | `/api/v1/templates/:slug` | detalle de una plantilla (html/css/js) |
| GET | `/api/v1/engines` | motores + `implemented: true\|false` |
| POST | `/api/v1/jobs` | encola un job → `{ jobId, engineUsed }` |
| GET | `/api/v1/jobs/:jobId` | estado del job → `{ status, result?, error? }` |
| GET | `/files/:jobId/:archivo` | sirve el mp4 desde `OUT_DIR/<motor>/<jobId>/outputs` (con fallback histórico) |

**Convención de error** (idéntica a la ya documentada en
`nexa-brief-server/docs/api-videos-frontend.md`, para que `web/` pueda portar
`nexa-brief-web/src/infrastructure/api/api-error.ts` casi literal):
- Negocio (400/404/500/501) → `{ "detail": "string" }`
- Validación zod (422) → `{ "detail": [{ "loc": [...], "msg": "...", "type": "..." }] }`

## MCP

```
render(html?, css?, js?, reactComponent?, audioUrl?, engine?, worker?, fps?, formats?) -> { jobId, engineUsed }
getStatus(jobId) -> { status, videoUrls?, error? }
configureWorker(engine, target) -> { ok: true } | error si no está implementado
```

**Importante:** `mcp-index.ts` es un proceso SEPARADO de `index.ts` — no
arranca Workers de cola, solo produce/consulta jobs contra el mismo Redis.
Para que un job enviado por MCP se procese de verdad, `pnpm dev` (que sí
arranca los Workers) tiene que estar corriendo en paralelo.

## Configuración

Ver `.env.example` — todo validado con zod en `src/config/env.ts` (falla
rápido al arrancar si falta algo, no en el primer request).

## Desarrollo local

```bash
docker compose up -d redis          # desde la raíz de nexa-render/
pnpm install
pnpm exec playwright install chromium
cp .env.example .env

pnpm dev            # API REST + Workers de cola
pnpm dev:mcp         # servidor MCP (otra terminal, opcional)
```

## Verificación

Ver la raíz de `nexa-render/README.md` → "Verificación de punta a punta"
para el flujo completo (REST directo → MCP → GUI).

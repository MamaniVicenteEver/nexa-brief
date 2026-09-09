# Nexa Render

Servicio independiente que convierte **cualquier composición HTML/CSS/JS (o un componente React)** en un video (.mp4), eligiendo entre motores de render intercambiables. Nació dentro de Nexa Brief — el motor de grabación (`PlaywrightFFmpegAdapter`) fue identificado como la pieza realmente genérica del sistema (ver `nexa-brief/nexa-brief-server/docs/investigaciones/motor-prompt-a-video.md` y `sistema-independiente-render-engine.md`) y se extrajo como producto propio, sin acoplarse a nichos, música ni publicación social. Ver también la tesis general en [nexa-docs/README.md](../README.md).

## Qué hace hoy (verificado en código, no solo en el README del proyecto)

Tres entradas al mismo motor de negocio:
- **API REST** (Fastify, documentada con Swagger en `/docs`): `POST /api/v1/jobs`, `GET /api/v1/jobs/:jobId`, `GET /api/v1/templates`, `GET /api/v1/engines`, `GET /files/:jobId/:archivo`.
- **Servidor MCP** (para agentes de IA): herramientas `render(...)`, `getStatus(jobId)`, `configureWorker(engine, target)` — corre como proceso separado de los workers de la cola.
- **GUI propia** (`web/`, Next.js): flujo completo `/plantillas` → editor con vista previa en vivo (CodeMirror) → configurar motor/worker/fps/formato → grabar → ver resultado en `/trabajos/[jobId]`.

**Motores de render — estado real:**

| Motor | README del proyecto dice | Código real |
|---|---|---|
| Playwright | ✅ implementado | ✅ implementado (Chromium in-process + mux FFmpeg) |
| Remotion | ⏳ pendiente | ✅ **implementado**, incluye worker en AWS Lambda |
| HyperFrames | ⏳ pendiente | ✅ **implementado**, incluye worker en AWS Lambda (S3 + `hyperframes lambda render`) |

> ⚠️ **Hallazgo a corregir:** `server/src/api/routes/engines.routes.ts` reporta `{ playwright: true, remotion: true, hyperframes: true }` — el propio código dice que los tres motores están completos. La tabla "Estado por fase" del `README.md` del proyecto (`nexa-render/README.md`) todavía marca Remotion y HyperFrames como "Fase 2 — pendiente", y lo mismo el soporte AWS ("Fase 3 — bloqueado, sin cuenta de AWS todavía") pese a que el código de worker AWS ya existe para ambos motores. Vale la pena actualizar ese README del proyecto para que refleje el estado real, ya que el propio proyecto se define por el principio de que "la GUI y el MCP nunca mienten sobre qué funciona todavía" — hoy el README sí lo hace.

Manejo de assets remotos: antes de grabar, cualquier URL externa referenciada en el HTML/CSS/JS se descarga una vez (validada contra un allowlist de hosts, sin IPs privadas), se reescribe a un servidor loopback efímero, y se graba solo contra esa copia local — de forma uniforme en los tres motores. Ver detalle en `nexa-render/docs/remote-assets-study.md` (vive junto al código, no se duplicó acá). Limitación explícita: no cubre URLs construidas dinámicamente en runtime, HLS/DASH, DRM ni recursos con sesión/cookies.

## El giro hacia publicidad profesional

Existe un único ejemplo bajo `nexa-render/advertising/aurel-watch/`: un anuncio de 14s de un reloj premium ("AUREL", 4 escenas: hero, detalle, specs, CTA) animado con GSAP. Es una prueba de concepto de una sola plantilla, no todavía una librería de plantillas publicitarias ni lógica de negocio específica de publicidad.

> ⚠️ **Bug conocido:** `template.js` registra el timeline como `window.__timelines.main`, pero la composición declara `data-composition-id="aurel-watch"`. La validación de HyperFrames (`HyperframesEngine.validateComposition()`) exige que el nombre coincida con el id de composición — como está hoy, este ejemplo **fallaría** al grabarse con el motor HyperFrames, pese a que el README del ejemplo instruye a usarlo así. Corregir a `window.__timelines["aurel-watch"]` antes de usarlo como demo.

Propuesta de posicionamiento y modelo comercial para este giro: [`plan-comercial-publicidad.md`](plan-comercial-publicidad.md).

## Tech stack

- **server/**: Node ≥22, Fastify 5 + Zod + Swagger, BullMQ + Redis (una cola por motor), `@modelcontextprotocol/sdk`, Playwright 1.49, `@remotion/bundler`/`@remotion/renderer`/`@remotion/lambda`, `hyperframes`/`@hyperframes/aws-lambda`, `@aws-sdk/client-s3`, `execa`, `pino`, `vitest`.
- **web/**: Next.js 15.1, React 19, TanStack Query, CodeMirror, Tailwind CSS 4, `next-intl`, GSAP (preview), Biome.

## Principios de diseño (del README del proyecto)

- `web/` nunca importa código de motores/cola directamente — solo habla REST con `server/`.
- El servidor MCP es "una segunda puerta a la misma lógica de negocio", no una implementación paralela.
- Sandboxing (timeout por job, directorio de trabajo efímero, allowlist de red en vez de deshabilitar seguridad web) está presente desde el día uno, no como fase futura.

## Documentos

- [`costos_infraestructura_vps_cloud.md`](costos_infraestructura_vps_cloud.md) — dimensionamiento de VPS/cloud para render en paralelo a escala (5-10 renders Remotion simultáneos).
- [`estudio_servidor_propio_vs_vps.md`](estudio_servidor_propio_vs_vps.md) — usar hardware propio vs. cloud, umbral de migración.
- [`guia_compra_pc_servidor_renders.md`](guia_compra_pc_servidor_renders.md) — guía de compra de hardware para escalar el número de renders paralelos.
- [`plan-comercial-publicidad.md`](plan-comercial-publicidad.md) — propuesta de modelo de negocio para el giro publicitario.

> Nota: estos tres documentos de infraestructura vinieron originalmente de la carpeta plana `nexa-brief-docs/` y se reclasificaron acá porque dimensionan renders en paralelo a una escala (5-10 simultáneos con Remotion) que corresponde al motor genérico, no al tamaño real de producción de Nexa Brief (2 jobs paralelos). Documentación técnica adicional del motor de assets remotos vive junto al código en `nexa-render/docs/remote-assets-study.md`.

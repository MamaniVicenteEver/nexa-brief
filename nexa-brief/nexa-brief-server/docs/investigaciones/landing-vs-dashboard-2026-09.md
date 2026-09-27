# Landing pública vs Dashboard — ¿una pantalla o dos?

Fecha: 2026-09-26 · Alcance: `nexa-brief-web` (`/` y `/dashboard`)

## Recomendación

**Mantener las dos, pero con propósitos que no se pisen:**

| | `/` (landing) | `/dashboard` |
|---|---|---|
| Para quién | Visitante sin cuenta | Usuario con sesión (admin hoy) |
| Objetivo | Convencer y pedir acceso | Operar: qué pasó, qué falta, qué falla |
| Datos | Mensajes de marketing (o métricas públicas agregadas) | Datos reales y accionables del sistema |
| Tono | Visual, emocional, poco texto | Denso, escaneable, con enlaces a cada sección |

No conviene fusionarlas: una landing de venta y un panel de control tienen
lectores y objetivos opuestos. Lo que sobra hoy es la **duplicación de
contenido de marketing dentro del dashboard**, no la existencia de dos páginas.

## Diagnóstico actual

### `/` — `app/[locale]/(public)/page.tsx`
Hero, BelowHero, TechMarquee, TemplatesRow, PurposeSection, CtaSection.
- Todo el contenido es estático. El contador **"128+ videos publicados en los
  últimos 30 días" está hardcodeado** (`BelowHero.tsx`, `StatCounter target={128}`):
  no refleja datos reales.
- No redirige a usuarios con sesión: un admin logueado que entra a `/` ve
  "Solicitar acceso".

### `/dashboard` — `app/[locale]/(admin)/dashboard/page.tsx`
- 3 tarjetas: categorías activas, categorías totales, email de la sesión.
  Solo las dos primeras son datos (y de poco valor operativo).
- "Actividad reciente" muestra un texto **obsoleto**: dice que el backend no
  expone historial de trabajos — hoy existen `GET /videos/jobs` y `GET /history`.
- Repite el panel de marketing de la landing ("Un vistazo, cero fricción" +
  "Crear video"). Esta es la duplicación que se percibe.

## Qué debería mostrar el Dashboard

Todos estos datos **ya existen** en el backend; no hace falta generar nada nuevo:

| Bloque | Contenido | Fuente actual |
|---|---|---|
| KPIs | Videos totales · listos para publicar · publicados · en proceso · fallidos | `GET /videos/jobs` (+ cola para "publicado") |
| Publicaciones | Total y por plataforma (YouTube / Facebook / TikTok) | `GET /publish/accounts` (`published_count`) |
| Canales | Cada cuenta: nombre, plataforma, estado del token, vence en, **enlace al canal**, videos publicados | `GET /publish/accounts` |
| Alertas | Cuentas a reconectar, publicaciones fallidas, jobs fallidos | cuentas (`requires_reauth`), cola (`failed`), jobs (`failed`) |
| Próximas publicaciones | Siguientes 5 programadas | `GET /schedule/queue?status=queued` |
| Actividad reciente | Últimos eventos del pipeline / publicaciones | `GET /history`, cola |
| Catálogo | Plantillas disponibles · nichos activos | `GET /templates`, `GET /niches` |
| Rendimiento | Tiempo medio de generación, etapa más lenta | `generation_seconds` en jobs + historial |
| Accesos rápidos | Crear video · Biblioteca (por publicar) · Programación · Canales | — |

Diseño sugerido (una sola pantalla, sin scroll largo en desktop):

```
[ KPIs: Videos | Por publicar | Publicados | En proceso | Fallidos ]
[ Alertas (solo si hay) ....................................... ]
[ Canales (tarjetas con estado + link) ] [ Próximas publicaciones ]
[ Actividad reciente .................. ] [ Catálogo + rendimiento ]
```

Cada número enlaza a la vista filtrada correspondiente (ej. "Por publicar" →
`/biblioteca` con esa pestaña), así el dashboard es el punto de partida y no
un callejón sin salida.

### Implementación recomendada
1. **Backend:** un endpoint agregado `GET /api/v1/dashboard/summary` que
   devuelva todo en una respuesta (se calcula con los repositorios del
   DataStore). Evita 6 requests desde el navegador y, al migrar a una base de
   datos, el agregado se resuelve con consultas en un solo lugar.
2. **Frontend:** `features/dashboard/` con componentes por bloque
   (`KpiRow`, `AlertsPanel`, `ChannelsPanel`, `UpcomingPanel`, `ActivityPanel`),
   refresco con los eventos en tiempo real que ya existen
   (`queue_entry_changed`, `channel_status_changed`, `job_deleted`).
3. **Quitar** del dashboard el panel de marketing duplicado y el texto obsoleto.

## Qué hacer con la landing

- **Redirigir a `/dashboard`** a quien entra a `/` con sesión iniciada.
- **Números de marketing:** o bien se dejan como mensaje fijo sin cifra
  concreta, o se alimentan de un endpoint público de métricas agregadas
  (ej. total de videos publicados). Publicar una cifra inventada ("128+") es un
  riesgo de credibilidad; recomiendo quitar la cifra hasta tener el dato real.
- El resto (hero, plantillas, propósito, CTA "Solicitar acceso") está bien:
  es contenido de venta y le corresponde a esta página.

## Resumen

Dos pantallas, sin contenido repetido: **la landing vende, el dashboard
informa**. El trabajo real está en el dashboard: pasar de 3 tarjetas casi
decorativas a un resumen operativo con videos, publicaciones, canales (con sus
enlaces), alertas y próximas publicaciones, todo con datos que ya existen.

---

## Plan detallado (propuesta para revisar)

### Datos: un servicio, dos endpoints
- `core/stats_service.py` calcula todo desde los repositorios (jobs, cola,
  log de publicaciones, canales, plantillas). Un solo lugar = sin duplicación.
- `GET /api/v1/stats/public` → **solo agregados seguros** para la landing
  (conteos, plataformas, plantillas, último video público). Nunca tokens,
  errores ni datos internos.
- `GET /api/v1/dashboard/summary` → todo el detalle para el dashboard.

### `/` (landing) — sección por sección

| Sección | Hoy (hardcodeado) | Propuesta |
|---|---|---|
| Hero | Texto fijo | Se mantiene. |
| BelowHero · contador | `128+` inventado | Videos publicados reales (últimos 30 días o total). Si es 0, se oculta la cifra. |
| BelowHero · círculos YT/TT/FB | Letras fijas | Avatares reales de las plataformas conectadas + "N canales conectados" (+ enlace al canal público si se aprueba). |
| BelowHero · "Ver una publicación real" | `sample-publication.mp4` fijo | Último video publicado real (archivo propio) + enlace a YouTube. |
| BelowHero · mini-card plantilla | Imagen fija | Plantilla real más usada / más reciente. |
| TechMarquee | Lista fija | Se mantiene (es real); sumar HyperFrames y Facebook. |
| TemplatesRow | 5 plantillas con PNG fijos | Plantillas reales desde `/templates` con su vista previa animada al hover y "Ver las N plantillas". |
| **Nuevo: "En números"** | — | Franja con: videos generados · publicados · plataformas · plantillas · horas de video · tiempo medio de generación. |
| PurposeSection | Texto personal | Se mantiene. |
| CtaSection | "Solicitar acceso" | Se mantiene para visitantes; con sesión → "Ir al panel". |
| Usuario con sesión en `/` | Ve "Solicitar acceso" | Redirigir a `/dashboard` (o mostrar "Ir al panel"). |

Mejoras de interfaz detectadas: header móvil se superpone al logo
(`AdminHeader`/`PublicHeader`), números con animación de conteo real,
estado vacío elegante cuando todavía no hay datos.

### `/dashboard` — qué se quita y qué se agrega

**Se quita:** tarjeta "Sesión actual" (el email va al menú de usuario),
tarjetas de categorías como protagonistas, texto obsoleto de actividad,
panel de marketing "Un vistazo, cero fricción".

**Se agrega (con enlaces a la vista filtrada):**
1. **KPIs:** videos totales · por publicar · publicados · en proceso · fallidos.
2. **Alertas** (solo si hay): cuentas a reconectar, token por vencer,
   publicaciones fallidas, jobs colgados.
3. **Publicaciones por plataforma:** YouTube / Facebook / TikTok (total y últimos 7 días).
4. **Canales:** tarjeta por cuenta con avatar, nombre, estado del token,
   vence en, videos publicados, última publicación y **enlace al canal**.
5. **Próximas publicaciones:** siguientes programadas (fecha, cuenta, video).
6. **Últimos videos generados:** miniaturas con estado (reutiliza VideoCard compacto).
7. **Actividad reciente:** eventos de pipeline y publicaciones.
8. **Catálogo:** plantillas (N) · nichos activos (N) · motores disponibles.
9. **Rendimiento:** tiempo medio de generación, etapa más lenta, minutos de video producidos.
10. **Accesos rápidos:** Crear video · Biblioteca · Programación · Canales.

### Decisiones pendientes del dueño
1. ¿Qué datos reales se muestran en público? (solo conteos / + nombres y
   enlaces de canales / + último video publicado).
2. Contador de la landing: ¿últimos 30 días o total histórico?
3. Usuario con sesión en `/`: ¿redirigir al dashboard o mostrar la landing con "Ir al panel"?

---

## Implementado (2026-09-26)

Decisiones del dueño: en público se muestra todo lo que prueba que el sistema
funciona (cifras, canales con enlace, última publicación); el contador grande
es el **total histórico** con "N en los últimos 30 días" debajo; con sesión, `/`
redirige a `/dashboard`.

**Backend — `src/core/stats/`**
- `context.py`: carga cada fuente una vez por request; las cuentas se inyectan
  (`accounts_loader`) para que `core` no dependa de `adapters`.
- `sections/`: una función pura por sección (videos, publications, channels,
  catalog, performance, showcase, alerts, upcoming, activity).
- `registry.py`: qué secciones van en `PUBLIC_SECTIONS` y `DASHBOARD_SECTIONS`.
- Router `stats.py`: `GET /api/v1/stats/public`, `GET /api/v1/dashboard/summary`.
- Tests: `tests/unit/test_stats.py` (contexto con datos falsos).
- `?norec=1` en `/templates/{id}/showcase/index.html` oculta el botón de grabar.

**Frontend**
- `features/stats/`: tipos, servicio (landing cacheada 60 s en el servidor), hook
  del dashboard con invalidación por eventos en tiempo real.
- Landing: BelowHero con datos reales, `HowItWorksSection` (reemplaza
  PurposeSection), `TemplatesCarousel` (2 filas, TemplateCard real con
  `hideRecorder`), `LiveNumbersSection`, `CtaSection` rediseñado.
- Dashboard: `features/dashboard/` con un componente por bloque (KPIs, alertas,
  canales, publicaciones, actividad, próximas, rendimiento, catálogo).

Para agregar un dato: modelo + función en `sections/` + línea en `registry.py`
(backend) → campo en `features/stats/types.ts` → usarlo en el componente.

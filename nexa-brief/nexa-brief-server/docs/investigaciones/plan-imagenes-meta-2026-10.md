# Plan: publicaciones de imagen en Facebook e Instagram (NodeHistory y NodeTech)

Fecha: 2026-10-25 · Estado: plan aprobable, sin implementar
Base: [meta-imagenes-api-2026-10.md](meta-imagenes-api-2026-10.md) (API de Meta, Codex Sol) e
[imagenes-integracion-2026-10.md](imagenes-integracion-2026-10.md) (nuestro código, Codex Luna).

## Decisión en una línea

Sí, conviene: la API de Meta permite todo lo que necesitamos (foto, multi-foto, carrusel de hasta 20
ítems y Story), la cuota no es un límite (3 posts/día contra 50–100/24 h) y gran parte del sistema
ya existe (cuentas, tokens, scheduler, URL firmada para Meta). El cuello de botella es **producir
imágenes buenas, distintas y con datos verificados**, no la API. Por eso el plan arranca por la
plantilla de imagen y una prueba de 4 semanas.

## Qué publicamos

| Formato | Red | Para qué | Plantilla |
|---|---|---|---|
| **Dato del día** (imagen única 4:5, 1080×1350) | FB + IG | Alcance rápido, gancho visual | NodeTech: diseño `rough`. NodeHistory: `binary` / `cronica` / `periodico` |
| **Carrusel "en 5 láminas"** (4:5, 5–7 láminas) | IG (FB como multi-foto) | Guardados y compartidos → crecimiento | Mismos diseños, una lámina por idea + portada + cierre con CTA |
| **Story** (9:16) | IG | Recordar el video o el carrusel del día | Recorte automático de la pieza del día (fase posterior) |
| **Video** (ya existe) | FB + IG | — | Pipeline actual de Reels |

Contenido: sale del material que ya verificamos para los videos (guion, `publish.json`, fuentes), así
la imagen y el video del día se refuerzan entre sí y no hay que investigar dos veces. Regla de la
categoría: ningún dato que no esté en el material verificado.

## Ritmo

El objetivo es **2 imágenes + 1 video por día en cada red**. Recomiendo llegar a ese ritmo en dos
etapas, no desde el primer día:

| Semanas | Por canal y por red | Condición para subir |
|---|---|---|
| 1–2 | 1 imagen (alternando dato/carrusel) + 1 video | Pipeline estable, cero errores de publicación |
| 3–4 | **2 imágenes + 1 video** | Guardados + compartidos por pieza no bajan al subir el volumen |
| 5+ | Ajustar según métricas | Se reduce si cae la calidad o se repiten temas |

Total en el ritmo completo: 2 canales × 2 redes × 3 posts = **12 publicaciones/día**, 8 de ellas
imágenes. Es mucho para revisar a mano; por eso la revisión humana es opcional por canal y la
validación automática (formato, texto legible, datos con fuente) es obligatoria.

Horarios iniciales (hipótesis a medir, no regla de Meta): 12–14 h y 18–21 h hora local del público
principal; el video en la franja que ya usa el scheduler. Ajustar con `online_followers` cuando la
cuenta tenga ≥ 100 seguidores.

## Arquitectura (resumen; detalle en el análisis de integración)

```
material verificado del video ─┐
                               ├─> ImagePostService (core) ──> ImageRenderer (Playwright, plantilla
roles.json (texto: DeepSeek)  ─┘        │                       estática por diseño, perfiles 4:5/1:1/9:16)
                                         ├─> validación (JPEG ≤ 8 MB, 1080 px, aspecto, alt text, caption ≤ 2200)
                                         ├─> revisión opcional (draft → approved)
                                         └─> Scheduler (slots por canal/red/tipo) ──> PublisherFacade
                                                   ├─ FacebookAdapter: /photos · multi-foto (attached_media) · scheduled_publish_time
                                                   └─ InstagramAdapter: image_url · CAROUSEL · STORIES → media_publish
                                         └─> Insights (48 h y 7 d) → aprender qué funciona
```

- **Entidades nuevas:** `ImagePost`, `Carousel` (slides ordenadas con alt text), `RenderedAsset`,
  `Delivery` (por red, con IDs remotos, estado e idempotencia). No reutilizar `VideoMetadata` ni
  meter `image_path` en el adaptador de Reels.
- **URL para Meta:** Instagram exige una URL pública HTTPS. Se reutiliza la URL firmada que ya usan
  los Reels (`/api/v1/publish/instagram/media/{token}`), extendida a JPEG.
- **Idempotencia:** guardar el ID del contenedor antes de publicar y, si hay un timeout, consultar
  antes de reintentar. Si no, se duplican posts.
- **Cuota:** leer `content_publishing_limit` en vivo. La propia documentación de Meta dice 100 en un
  lugar y 50 en otro (verificado): no se fija ningún número en el código.
- **Permisos:** los Reels ya publican, así que `instagram_content_publish` y `pages_manage_posts`
  probablemente ya están concedidos. Para métricas falta `instagram_manage_insights`, y para el
  primer comentario `instagram_manage_comments`. Hay que confirmarlo en la app de Meta.

## Plantillas de imagen = la fábrica de prototipos

Una plantilla de imagen es un prototipo más del sandbox, con salida estática: se crea con
`sandbox/PROTOTIPO.md` a partir de referencias (`sandbox/referencias/<cat>/`), reutiliza los
componentes del explainer-kit (que ya dibujan cifras, fotos, cronologías y diagramas) y se revisa
en `/plantillas?cat=sandbox`. Cambio necesario en la fábrica: el tipo de salida `image` (perfiles
4:5 / 1:1 / 9:16 y exportación JPEG), además de video.

## Fases

| # | Fase | Quién | Estimado |
|---|---|---|---|
| 0 | Confirmar en la app de Meta los permisos y el tipo de cuenta (Business/Creator) de NodeHistory y NodeTech | usuario + Claude | ½ día |
| 1 | Dominio y persistencia (`ImagePost`, `Carousel`, `Delivery`) | Codex Luna | 2–3 d |
| 2 | Renderer estático + 1.ª plantilla "dato del día" para cada canal (vía fábrica de prototipos) | líder + Luna | 3–5 d |
| 3 | Adaptadores Meta: FB foto/multi-foto, IG imagen/carrusel, URL firmada JPEG, errores | Codex Luna (Sol revisa) | 3–5 d |
| 4 | Scheduler y UI: slots 1→2 imágenes/día, cola, revisión opcional, vista previa | Codex Luna | 2–4 d |
| 5 | Insights e idempotencia/reconciliación | Codex Luna | 2–4 d |
| 6 | Canary: 1 semana publicando solo en NodeTech; después NodeHistory | todos | 1 semana |

MVP más corto (útil para empezar a crecer ya): fases 0 + 1 + 2 (solo "dato del día") + 3 (solo
imagen única FB/IG) + publicación manual desde la UI. El carrusel y el scheduler automático vienen
después.

## Riesgos

- **Contenido repetido o de baja calidad:** Meta reduce la distribución de spam y de contenido no
  original. Mitigación: datos verificados, rotación de temas y validación automática.
- **Derechos de imagen:** en las fotos históricas hay que registrar autor, licencia y fuente por
  imagen. Las recreaciones con IA se marcan con `is_ai_generated` en IG.
- **Texto en español largo:** se corta o queda ilegible en el móvil. Mitigación: límites por lámina
  y una revisión automática de legibilidad (Gemini).
- **Seguridad:** la URL firmada es la única ruta pública de medios. Regresión ya encontrada y
  corregida el 2026-10-25: al proteger la API con sesión, esa ruta había quedado bloqueada para Meta.

## Evaluación de modelos (prueba pedida por el usuario)

| | Codex **Sol** (`gpt-6-sol`, high) | Codex **Luna** (`gpt-6-luna`, xhigh) |
|---|---|---|
| Tarea | Investigación web de la API de Meta (fuentes oficiales) | Análisis de nuestro código |
| Tokens | **143 k** | 247 k |
| Tiempo | ~10 min | ~10 min |
| Calidad | Muy alta: cita cada dato, detecta 2 contradicciones reales de Meta (carrusel 10 vs 20, cuota 50 vs 100) que verifiqué en la página oficial, separa lo oficial de lo inferido y recomienda con prudencia | Alta: rutas `archivo:línea`, tabla de lo que hay y lo que falta, plan por fases. Lee mucho código, por eso gasta más |

Conclusión: Sol rinde muy bien en investigación y en decisiones con matices, con un consumo
moderado. Uso recomendado: **Sol** para investigar, diseñar y revisar entregas importantes; **Luna**
para implementar y ejecutar tareas mecánicas largas.

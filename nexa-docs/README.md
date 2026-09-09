# Nexa — Documentación

Este monorepo contiene **dos productos** que comparten un mismo origen técnico. Esta carpeta (`nexa-docs/`, antes `nexa-brief-docs/`) documenta a cada uno por separado:

- **[nexa-brief/](nexa-brief/README.md)** — el producto original: fábrica automatizada de videos musicales/con letra que se publican solos en YouTube, Facebook y TikTok.
- **[nexa-render/](nexa-render/README.md)** — el motor de render que nació *dentro* de nexa-brief y se extrajo como servicio independiente: convierte cualquier composición HTML/CSS/JS (o React) en video, pensado para escalar hacia clientes de publicidad profesional.

## La tesis del proyecto

nexa-brief resuelve un caso concreto — videos de letras de canciones — pero ese caso es **la prueba, no el objetivo final**. El objetivo es que el mismo motor sirva para cualquier nicho o idioma cambiando solo configuración, no código:

- El backend de nexa-brief usa **arquitectura hexagonal + microkernel** (`core` con puertos, `adapters` intercambiables, `niches.json` como catálogo de configuración). Ya hoy conviven 16 nichos distintos (fondo de imagen, "landscape ambient", video de letras con 9 variantes visuales) sobre los mismos adaptadores de IA, imagen, música y publicación — sin tocar el motor. Replicar el proyecto a un nicho nuevo (otro idioma, otro tipo de contenido, con o sin voz) es, en teoría, añadir una entrada a `niches.json` + una carpeta de plantilla, no reescribir el pipeline.
- Dos investigaciones internas (`nexa-brief/nexa-brief-server/docs/investigaciones/motor-prompt-a-video.md` y `sistema-independiente-render-engine.md`) ya habían identificado que la pieza realmente genérica y reutilizable del sistema es el **motor de grabación** (HTML/CSS/JS → video), independiente de nichos, marketing o publicación social. **nexa-render es esa idea llevada a producto**: mismo principio de "adaptadores intercambiables" (Playwright, Remotion, HyperFrames como motores de render enchufables), pero como servicio aparte, con su propia API REST, servidor MCP y GUI, sin saber nada de canciones ni de redes sociales.

En otras palabras: nexa-brief demuestra que la arquitectura permite escalar *contenido* (nichos, idiomas, plantillas) a gran escala mediante configuración; nexa-render demuestra que la misma arquitectura permite escalar el *motor* fuera del caso de uso original. Ambos son la misma apuesta de diseño aplicada en dos direcciones.

## Qué leer primero

| Si querés... | Andá a... |
|---|---|
| Entender qué hace nexa-brief hoy y sus planes de negocio | [nexa-brief/README.md](nexa-brief/README.md) |
| Entender qué hace nexa-render hoy y su enfoque publicitario | [nexa-render/README.md](nexa-render/README.md) |
| El detalle técnico más completo y vigente de nexa-brief | [nexa-brief/estudio_tecnico_completo.md](nexa-brief/estudio_tecnico_completo.md) |
| Documentación de código de cada proyecto (vive junto al código, no acá) | `nexa-brief/nexa-brief-server/docs/` y `nexa-render/docs/` |

## Nota sobre esta reorganización (2026-09-08)

Antes había una sola carpeta plana `nexa-brief-docs/` con 18 documentos mezclando ambos productos y distintas épocas del proyecto (algunos ya superados por el código actual). Se reorganizó así:

- Los documentos específicos de la fábrica de videos musicales/publicación social quedaron en `nexa-brief/`.
- Los tres documentos de investigación de infraestructura para **render en paralelo a gran escala** (VPS cloud, PC propio, compra de hardware) se reclasificaron a `nexa-render/`, porque describían un caso de uso de 5-10 renders concurrentes con Remotion que no corresponde al tamaño real de producción de nexa-brief (2 jobs paralelos en un VPS pequeño), sino al motor de render genérico pensado para escalar.
- Documentos superados por el código actual (versión anterior del pipeline de 7 etapas, stack sin el sistema de publicación, un informe con bloqueadores ya resueltos) se movieron a `nexa-brief/archivo/` con una nota explicando por qué quedaron obsoletos, en vez de borrarlos.
- Se corrigieron un par de errores puntuales de documentación (un typo minutos/segundos en `requirements.md`, contenido roto/copiado a medias en `SCRAPING_WORKFLOW.md` y `contex-ia.md`).

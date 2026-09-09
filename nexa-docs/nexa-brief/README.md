# Nexa Brief

Fábrica automatizada de videos de contenido musical (fondo con imagen, "landscape" ambiental, y video de letras kinético) que **se genera y se publica sola** en YouTube, Facebook y TikTok. Es el producto original del monorepo y, hoy, la prueba de concepto de una tesis más grande: ver [nexa-docs/README.md](../README.md).

> Para el detalle técnico completo y vigente (pipeline de 9 etapas, modelo de dominio, todos los endpoints), ver [`estudio_tecnico_completo.md`](estudio_tecnico_completo.md). Este README resume propósito, capacidades reales y estrategia de negocio.

## Qué hace hoy (código, no promesas)

Pipeline de 9 etapas por cada video solicitado:

1. **Analizador de entrada** (Gemini) — completa categoría, género, duración, etiquetas.
2. **Diseñador visual** (Gemini + skill del nicho) — define paleta, tipografía, tipo de animación.
3. **Resource fetcher** — imagen (Unsplash → Pexels → Pixabay → gradiente CSS) y música (caché local → Pixabay Music → Jamendo → yt-dlp), con validación de calidad por visión (Gemini) sobre las imágenes.
4. **Prompt architect + generador HTML** (DeepSeek, con fallback a Gemini) — o una plantilla `config_driven_template` ya preparada, según el nicho.
5. **Grabación** — Playwright + Chromium headless + FFmpeg (motor por defecto) o Remotion (React, local o AWS Lambda) como motor alterno; exporta 16:9, 9:16 y opcionalmente un clip de 61s para TikTok.
6. **Resumen SEO** (Gemini) — título, descripción, tags y hashtags por plataforma.
7. **Empaquetado** — artefactos + registro de auditoría inmutable.
8. **Publicación social** (opcional) — YouTube, Facebook y TikTok vía OAuth, con reintentos y backoff.

**Nichos activos hoy:** 14 de 16 configurados en `niches.json` — familia `IMG-*` (fondo de imagen, "landscape" ambiental) y familia `LYRICS-*` (9 variantes visuales de video de letras, con transcripción vía faster-whisper). Ver detalle por nicho en `nexa-brief/nexa-brief-server/docs/niches-reference.md`.

**Arquitectura:** hexagonal + microkernel — `core` (dominio, puertos, orquestador) desacoplado de `adapters` intercambiables (IA, imagen, música, grabación, publicación, letras, tiempo real). Cambiar de proveedor de imágenes, de motor de IA o de plataforma de publicación es añadir un adapter, no tocar el core. Ver [`architecture.md`](architecture.md).

**Publicación multi-cuenta:** el sistema ya soporta múltiples cuentas/páginas por plataforma (`accounts.json` está indexado por `plataforma.alias`, con tokens cifrados con Fernet y refresco automático cada 15 min vía APScheduler). Hoy hay 3 cuentas reales conectadas (1 canal de YouTube, 1 página de Facebook, 1 cuenta de TikTok).

**Estado real de tracción (2026-08, según `docs/investigaciones/diagnostico-punto-muerto-agosto-2026.md`):** el pipeline funciona y ya publicó automáticamente en YouTube, pero solo se generaron ~28 videos en total y no hay datos de vistas/suscriptores todavía. La recomendación vigente del propio equipo es *publicar contenido real antes de seguir construyendo funciones* (panel admin, scheduling, i18n) — tenerlo presente al priorizar.

## Límites conocidos por plataforma (para diseñar planes)

Esto es lo que se sabe hoy de las plataformas — **no hay todavía un sistema de planes/cuotas de usuario implementado en código** (se verificó por grep: no existe lógica de "free/premium/tier" en `src/`, solo un comentario a futuro sobre nichos "premium" con un modelo de IA más caro). Los límites reales son de las plataformas, no del producto:

- **YouTube (Data API v3):** la cuota (10 000 unidades/día) es **por proyecto de Google Cloud**, no por canal — cada subida de video cuesta ~1600 unidades, así que un solo proyecto soporta ~6 subidas/día repartidas entre todos los canales que autorice ese proyecto. Para más volumen de subidas por día hace falta más de un proyecto de GCP (cada uno con su propia cuota), no más cuentas de YouTube per se.
- **Facebook (Graph API / Páginas):** una misma app / Business Manager puede administrar muchas páginas sin límite práctico para uso propio; para publicar en páginas de terceros a escala, Meta exige que la app pase revisión (App Review) para los permisos de publicación.
- **TikTok (Content Posting API):** las apps sin auditar quedan en modo sandbox, limitadas a un número reducido de cuentas autorizadas manualmente (las del propio desarrollador/testers) hasta que TikTok audita la app para uso público.

**Recomendación:** verificar los números y políticas vigentes en cada consola de desarrollador antes de fijar cifras exactas en el plan comercial — estos límites cambian con el tiempo y las políticas de cada plataforma.

Propuesta de planes basada en esto: [`planes-y-modelo-negocio.md`](planes-y-modelo-negocio.md).

## La tesis de replicación (por qué esto no es "solo un canal de letras de canciones")

El nicho musical es el caso de prueba; el diseño está pensado para replicarse:

- **Nuevo nicho/idioma sin tocar el motor:** agregar una entrada a `niches.json` + carpeta de plantilla en `src/templates/` + skill de estilo en Markdown (ver [`estrategia_niche_config.md`](estrategia_niche_config.md) para el esquema de configuración por nicho, y [`estrategia_v3.md`](estrategia_v3.md) — el roadmap original que dio origen al modo "Lyric Video" siguiendo exactamente este patrón).
- **Ejemplos de expansión ya identificados** (mencionados en la conversación de origen de este documento): citas/quotes en inglés, agregar narración por voz (TTS) — ambos encajan como un nicho nuevo con su propio adapter de audio/idioma, reutilizando el resto del pipeline.
- **El motor de grabación ya se identificó como reutilizable fuera de este dominio** — es exactamente lo que se convirtió en **nexa-render** (ver [nexa-render/README.md](../nexa-render/README.md)). Las investigaciones que documentan ese razonamiento viven en `nexa-brief/nexa-brief-server/docs/investigaciones/motor-prompt-a-video.md` y `sistema-independiente-render-engine.md`.
- **La meta de fondo es un "agente que automatiza":** una vez que agregar un nicho es configuración y no código, el paso siguiente (no implementado todavía) es que un agente pueda proponer/generar esa configuración (nicho, plantilla, skill) a partir de una descripción, en vez de que un humano edite `niches.json` a mano.

## Índice de documentos

- [`architecture.md`](architecture.md) — arquitectura hexagonal + microkernel, principios de diseño.
- [`estudio_tecnico_completo.md`](estudio_tecnico_completo.md) — **referencia técnica más completa y vigente** (pipeline, modelo de dominio, adaptadores, API, seguridad de tokens).
- [`requirements.md`](requirements.md) — requisitos funcionales/no funcionales originales.
- [`api_reference_platforms.md`](api_reference_platforms.md) — mecánica cruda de las APIs de YouTube/Facebook/TikTok (endpoints, scopes, límites).
- [`social_publishing_guide.md`](social_publishing_guide.md) — cómo se configura y usa la publicación multi-cuenta desde Nexa Brief.
- [`estrategia_niche_config.md`](estrategia_niche_config.md) — esquema de configuración por nicho (con nota de vigencia: la propuesta de YAML no se adoptó, se usa `niches.json`).
- [`estrategia_v3.md`](estrategia_v3.md) — roadmap histórico que originó el modo "Lyric Video", perfiles de canal, voz TTS.
- [`integration-roadmap.md`](integration-roadmap.md) — plan para conectar backend, dashboard y prototipos estáticos.
- [`contex-ia.md`](contex-ia.md) — qué modelo de IA hace qué tarea y por qué.
- [`SCRAPING_WORKFLOW.md`](SCRAPING_WORKFLOW.md) — flujo de scraping + remoción de fondo para imágenes de personajes.
- [`infraestructura/`](infraestructura/) — decisiones de despliegue a la escala real de nexa-brief (VPS pequeño, migración de Remotion a Lambda).
- [`archivo/`](archivo/) — snapshots históricos superados por el código actual, conservados por contexto.
- [`planes-y-modelo-negocio.md`](planes-y-modelo-negocio.md) — propuesta de plan gratuito/pago.

Documentación técnica adicional (vive junto al código, no se duplicó acá): `nexa-brief/nexa-brief-server/docs/` — pipeline de grabación, referencia de nichos, contratos de API del dashboard, y las investigaciones sobre generalizar el motor de render.

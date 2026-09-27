# nexa-academy

Sistema 2 de `nexa-docs/nexa-pocs/dos-sistemas-nuevos-desde-nexa-brief-y-nexa-render.md` — leer ese documento completo antes de escribir código acá, tiene el paso a paso, el flujo de aprobación y el modelo de dominio genérico.

**Qué hace**: un agente estructura un temario por niveles (ej. CEFR A1→B1, pero el esquema es configurable), decide cuántas lecciones generar, y por cada lección arma un video narrado con texto resaltado en sincronía con la voz — con identidad visual consistente por nivel, como una productora educativa real.

**Estado**: `nexa-academy-server/` y `nexa-academy-web/` son una copia completa (solo archivos versionados, sin `.venv`/`node_modules`/`.next`) de `nexa-brief-server`/`nexa-brief-web` a fecha 2026-09-17 — punto de partida funcional, NO el sistema final. El dominio (`Job`/`Pipeline`/`NicheConfig`, nichos) todavía es el de `nexa-brief` tal cual — hay que reemplazarlo por `Topic/Scheme/Level/Lesson` (ver abajo), no es un fork a mantener sincronizado. `.env`/`.env.local` se armaron desde `.env.example` (sin secretos reales) — completar credenciales propias antes de correrlo. Primer sistema a implementar de los 2 (ver documento, sección "Plan sugerido") — el riesgo más grande (calidad/costo real del TTS) conviene despejarlo temprano.

Antes de instalar dependencias: `cd nexa-academy-server && uv sync` y `cd nexa-academy-web && pnpm install` (los `.venv`/`node_modules` no se copiaron).

## Modelo de dominio — genérico desde el día uno, NO hardcodear "inglés"

```
Topic (tema)          → "Inglés", o después "Finanzas personales", "Historia del arte", etc.
  └─ Scheme (esquema)  → CEFR (A1..C2) es una instancia, "básico/intermedio/avanzado" sería otra.
      └─ Level          → un nivel dentro del esquema (ej. A1)
          └─ Lesson      → unidad generable: objetivos, contenido, plantilla asignada
```

## Flujo de aprobación (ver documento, sección completa)

`DRAFT` (agente propone temario, no crea jobs) → `PENDING_APPROVAL` (usuario revisa/ajusta) → aprobación explícita por palabra clave (ej. `APROBAR A1`, nunca inferida) → `APPROVED` → `GENERATING` (recién ahí se crean jobs reales).

## Piezas a copiar de `nexa-brief-server` (copiadas, no importadas)

1. Esqueleto hexagonal puertos/adaptadores.
2. `faster_whisper_adapter.py` tal cual — para re-transcribir el audio TTS y obtener timestamps por palabra (resaltado sincronizado, mismo mecanismo que los templates `LYRICS-*`).
3. Patrón `config_driven_template` (plantilla fija + IA solo llena `config.json`) — para la familia de templates `LESSON-*`.
4. `job_tracker.py` (patrón de índice JSON atómico) — aplicado a "planes de currículo" además de a jobs.

## Lo nuevo a construir (el hueco más grande de los 2 sistemas)

- Agente "arquitecto de currículo" (tema → temario ordenado por niveles).
- `VoicePort` + adaptador de TTS real — **no existe ningún adaptador de texto-a-voz en ningún repo hoy**, es la pieza más nueva.
- Orquestador de lote: temario aprobado → N jobs de lección encolados, con progreso y capacidad de detenerse en cualquier nivel.
- Familia de templates `LESSON-*` con diseño propio por nivel.

## Motor de render y publicación

Render vía la API de `nexa-render` (no reimplementar motores). Empaquetado/publicación: reusar `packager.py`/`social_publisher.py` de `nexa-brief-server` tal cual (copiados), sin tocar su lógica.

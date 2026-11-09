---
name: atlas-en-movimiento
description: Producir un video de mapas animados con Atlas en Movimiento sobre cualquier tema (guerra, suceso histórico, política, economía). Usar cuando se pida un video narrado con mapa, unidades, flechas, documentos, imágenes y cifras; cubre investigación, guion con plan visual, medios, voz, escena y auditorías. No graba MP4.
---

# Atlas en Movimiento (skill)

Esta plantilla no tiene tema: el tema sale del pedido. Tiene más de 100 componentes (unidades, flechas, efectos,
territorios, documentos, imágenes, retratos, cifras); un video bueno los usa, no solo texto sobre un mapa.

1. Lee `AGENTE.md` (proceso, roles, respaldo si Codex falla, puertas de calidad).
2. Lee `GUION.md` antes de escribir una palabra (cómo se genera el diálogo y el plan visual).
3. Lee `MENU-VISUAL.md` y `engine/tactico/animations/index.json` completo antes de planificar.
4. Genera la escena con `tools/build_scene.py` y no la des por lista hasta pasar
   `tools/cobertura-audit.mjs` **y** `work/escena/estilo-audit.mjs`.

Reglas fijas: no grabes MP4, no hagas commit, no publiques, no inventes datos; si algo falta (cuota de Codex,
imágenes, fuentes), dilo primero en el reporte y no entregues una versión reducida como si fuera completa.

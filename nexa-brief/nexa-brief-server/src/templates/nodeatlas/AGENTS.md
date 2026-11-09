# AGENTS.md · NodeAtlas (categoría)

Videos de mapas animados sobre cualquier tema (guerras, sucesos históricos, política, economía). Hoy hay una
plantilla: `atlas-en-movimiento/`. **Lee primero `atlas-en-movimiento/AGENTE.md`**: proceso, roles (con respaldo
Haiku 5.5 si Codex falla), puertas de calidad y menú de más de 100 componentes. Luego `GUION.md` (cómo se
genera el diálogo) y `MENU-VISUAL.md`.

- Motor y mapas compartidos: `_atlas/`, `_mapas/`; episodios nuevos: `nodeatlas/<id>/` con `tools/build_scene.py`.
- Antes de dar un video por listo: `node atlas-en-movimiento/tools/cobertura-audit.mjs <episodio>` y `estilo-audit.mjs`.
- No grabar MP4, no commit, no publicar. Estado de pruebas: "en preparación".

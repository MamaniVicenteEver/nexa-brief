# AGENTS.md · NodeAtlas (categoría)

Videos de mapas animados sobre cualquier tema (guerras, sucesos históricos, política, economía). Hoy hay una
plantilla: `atlas-en-movimiento/`. **Lee primero `atlas-en-movimiento/AGENTE.md`**: proceso, roles (con respaldo
Haiku 5.5 si Codex falla), puertas de calidad y menú de más de 100 componentes. Luego `GUION.md` (cómo se
genera el diálogo) y `MENU-VISUAL.md`.

- Motor táctico único: `atlas-en-movimiento/engine/`; mapa y recursos compartidos: `_atlas/`, `_mapas/`.
  Los episodios viven en `$NEXA_PROFILE_DIR/productions/nodeatlas/<id>/` y contienen JSON y medios.
  **Prohibido crear o copiar motores, componentes, renderizadores o generadores dentro del episodio.**
  El orquestador llama al motor principal pasando tipos, parámetros y tiempos mediante JSON.
- Los componentes nuevos se desarrollan una sola vez en el motor principal y se registran en Showcase.
  Una variante por país o tema es un ejemplo JSON del mismo componente, nunca una implementación por video.
- Antes de dar un video por listo: `python atlas-en-movimiento/tools/check_episode.py <episodio>`,
  `node atlas-en-movimiento/tools/cobertura-audit.mjs <episodio>` y `estilo-audit.mjs`.
- No grabar MP4, no commit, no publicar. Estado de pruebas: `"listo"` en manifest.json e info.json (la pestaña Preparación solo muestra `listo`; `renderizado` pasa a Renderizados). Nunca `"en preparación"`.

## Blender (MCP): abrir, usar y CERRAR

Cada trabajo debe cerrar los procesos Blender y conexiones MCP que abrió, una vez
que sus archivos estén guardados y verificados. No dejar procesos propios vivos
«por si acaso». La edad de un proceso o un intervalo breve sin CPU no demuestran
que otro trabajo haya terminado.

1. Antes de iniciar, inspecciona la instancia, los clientes y el estado de la escena;
   conserva cualquier trabajo ajeno. Si reutilizas una instancia compartida,
   identifícala como compartida y no la cierres mientras tenga clientes de otros trabajos.
2. Registra los PID exactos que inicies. En procesos de shell propios, usa `trap` para
   cerrarlos al terminar o ante errores. Los procesos `blender -b` deben finalizar;
   comprueba también el cierre de sus envolturas y clientes.
3. Para conexiones MCP gestionadas por el cliente, identifica el PID concreto de tu
   conexión antes de cerrarla. Desde esta plantilla usa
   `bash tools/cerrar-blender-mcp.sh --pid <PID>` únicamente con PID identificados
   como propios. Sin argumentos el script solo muestra el inventario.
4. Comprueba con `ps` que los procesos propios finalizaron. Si quedan procesos de
   otras sesiones o una instancia compartida, informa cuáles permanecen y por qué;
   no los cierres solo por su antigüedad o por estar temporalmente inactivos.
5. La instancia compartida puede cerrarse cuando se confirme que ya no hay otros
   trabajos utilizándola y después de guardar o preservar la escena abierta. No
   cierres ni pierdas datos sin guardar. Las conexiones gestionadas externamente
   pueden requerir que el cliente libere su sesión; no prometas cierre automático
   si no se ha implementado y verificado.

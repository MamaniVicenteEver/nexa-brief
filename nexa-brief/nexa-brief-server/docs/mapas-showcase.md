# Mapas Satelitales en Showcase y producción

`mapas-satelitales` conserva la identidad de su motor `nodehistory/_mapas`.
Su raíz física de producción se declara en `engine_root`:
`src/templates/nodeatlas/mapas-satelitales/_mapas/`. Las raíces antiguas se
resuelven mediante `legacy_engine_roots`, sin copias ni enlaces simbólicos.

La demo principal Fronteras pertenece al repositorio en
`src/templates/nodeatlas/fronteras-demo/`. Bolivia al mar es un episodio y
pertenece a `productions/node_atlas_bol/bolivia-mar/` del perfil activo.
Las pruebas, prototipos y referencias viven en el `sandbox/` del perfil;
no permanecen como proyectos dentro del Sandbox del repositorio. Las
categorías adicionales apuntan al mismo diseño sin copiar carpetas.
Norma: [ubicación de demos, pruebas y episodios](ubicacion-demos-pruebas-episodios.md).

## Catálogo compuesto y vistas aisladas

El catálogo estándar está en `_tools/design-definitions/mapas-satelitales/`.
Contiene las 16 piezas de `_mapas/components.json`, las 5 piezas compartidas de
`_proto/components.json` y dos ejemplos de entrada/salida con parámetros reales
de capas: **23 entradas**. Ambos catálogos nativos usan la clave heredada `comps`.
`map.transition.fade-in` y `map.transition.fade-out` son presets de capas;
no son otros tipos del motor ni justifican borrar o inventar componentes.

Las vistas `_mapas/showcase/` usan escenas aisladas y el renderizador real.
Los medios del ejemplo se resuelven desde la URL del motor que carga la galería,
sin depender de la profundidad de la carpeta de un episodio. Cambiar datos del
episodio solo afecta a ese video; cambiar el motor compartido puede afectar a
todas sus demos y episodios. Se prueban también los estilos implementados
`dynamic` y `documentary`, sin generar contenido editorial.

Antes de preparar miniaturas, inventaría diseño, componente, estilo y revisión.
Conserva las imágenes existentes válidas y sus bytes al cambiar rutas. El traslado
no captura imágenes; solo se preparan faltantes o inválidas del estilo solicitado
fuera de la revisión técnica.

## Pasar a producción

El flujo es **Preparar para producción → Verificar archivos y rutas → Pasar a
producción**, sin IA. La demo principal va al repositorio y los episodios al
`productions/` del perfil. Un motor compartido experimental se traslada una sola
vez a su raíz de producción mediante el mismo servicio con diario y rollback.

Si la demo ya está registrada en el repositorio y su motor sigue en Sandbox,
`RegisteredEngineProduction` revisa y completa ese traslado; la CLI
`scripts/pass_registered_engine.py --design mapas-satelitales` solo revisa.
`--apply` es una acción explícita de traslado y usa el mismo servicio. No edites
solo el estado de Showcase para ocultar una ubicación física incorrecta.

La API valida el catálogo compuesto existente, las rutas, las colisiones y los
consumidores antes de mover. Conserva IDs, revisiones, recursos, medios y consumo.
Después se comprueban las 23 entradas aisladas, sus posters existentes y las
rutas de Fronteras y Bolivia. Una respuesta HTTP no sustituye la revisión visual.

La creación de episodios usa `POST /api/v1/explainer/productions` con
`design: "mapas-satelitales"`, el estilo elegido y `auto_record: false`.
La preparación editorial con IA ocurre después, desde su categoría; no se graba
ni publica durante la revisión o el traslado. Contratos del estilo y guía corta:
`/api/v1/showcase/designs/mapas-satelitales/production-guide?estilo=<id>`.

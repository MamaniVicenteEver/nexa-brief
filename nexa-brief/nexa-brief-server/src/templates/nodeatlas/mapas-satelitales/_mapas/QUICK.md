# Mapas satelitales: entrada rápida

Un video es solo datos. Motor compartido `_mapas`; estilos `dynamic` y `documentary`.
La raíz compartida de producción es `src/templates/nodeatlas/mapas-satelitales/_mapas/`;
`engine_id: nodehistory/_mapas` conserva su identidad y `engine_root` declara la ubicación.
La demo principal Fronteras vive en `src/templates/nodeatlas/fronteras-demo/`.
Los episodios viven en `productions/` del perfil; todas las pruebas y referencias
van a su `sandbox/`. No copies el motor ni crees episodios junto a él.

Consulta `/api/v1/showcase/designs/mapas-satelitales/production-guide?estilo=<id>` y después
solo `/catalog/<componente>?estilo=<id>&format=9x16`. Cada pieza entrega parámetros, ejemplo y apariencia.
No leas `mapas.js` ni `layers.js` para producir un episodio.

`scene.json`: `version:1`, `estilo`, `estiloRevision:1`, `camera`, `layers`; configura además intro,
subtítulos y cierre si corresponden. Los lugares aceptan nombres; los tiempos aceptan `@frase` de la
transcripción real. Tipos de capas: fill, line, arrow, label, pin, icon, flag, photo, year, big, dot, crowd.
Los valores omitidos heredan el preset; las excepciones explícitas prevalecen. Ajustes por orientación:
`portrait` / `landscape` de la capa. `captions.y` es vertical y `captions.yLandscape` horizontal.

Creación: `POST /api/v1/explainer/productions` con `design:"mapas-satelitales"`, `estilo` y
`auto_record:false`; el host prepara el contexto mínimo. Si ya tienes la escena, `POST
/api/v1/showcase/designs/mapas-satelitales/prepare` valida y devuelve los JSON sin consumir modelos.
Guía completa: `docs/estilos-produccion.md`; formato cartográfico: `ESCENA.md` solo cuando haga falta.

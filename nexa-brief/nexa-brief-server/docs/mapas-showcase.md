# Mapas satelitales en Showcase

`mapas-satelitales` es una única definición del motor compartido
`sandbox/nodehistory/_mapas`. Showcase agrupa por el campo `engine` del `info.json`
los proyectos del sandbox del perfil activo, incluyendo `fronteras-demo` y
`bolivia-mar`. No copia proyectos, motores ni datos de otros perfiles.

El catálogo estándar está en `_tools/design-definitions/mapas-satelitales/`.
Expone las 16 piezas declaradas por `_mapas/components.json`, las 5 de
`_proto/components.json` y dos ejemplos de entrada/salida que usan parámetros
reales de las capas. Flechas, iconos y medios incluyen parámetros y ejemplos.
Los ejemplos `map.transition.*` son presets de capas, no tipos nuevos del motor.

Las vistas aisladas viven en `_mapas/showcase/`: crean escenas de demostración
propias y utilizan el motor real. Cambiar parámetros en una escena del perfil
afecta solo esa escena; editar el código compartido del motor sí puede afectar
a todos sus videos. Antes de cambiar el contrato común, probar ambos proyectos.
Las miniaturas son caché regenerable por revisión del diseño y formato.

## Promoción

El diálogo permite elegir una categoría principal y categorías compartidas.
La asociación del diseño se guarda en el perfil; no copia el motor ni crea
registros de producción. El selector de creación del explainer-kit aún solo
admite sus propios diseños: la asociación en Showcase no convierte Mapas en un
diseño de ese kit.

Cada proyecto se promueve por separado desde Plantillas → Sandbox. La promoción
conserva sus recursos, registra una sola carpeta en la categoría principal y
usa `shared_categories` como referencias para las demás. Las dependencias
compartidas del código se resuelven mediante URLs de la API: `_proto` y `_mapas`
siguen físicamente en el repositorio, con una sola copia. Se conserva `render/`
como material histórico; no se trata como grabación actual. Los mapas se
registran como `en progreso`, aparecen en Preparación y no habilitan el
renderizador del explainer-kit. Bolivia requiere corregir el pin vertical y
volver a grabar antes de considerarse final.

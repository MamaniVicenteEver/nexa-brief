# Fixtures y convenciones de showcase

`contracts.ts` exporta modelos tipados, envolturas de red sintéticas y mensajes
para que WP1–3 compartan casos. Incluye familia distinta del ID, parámetros JSON
heterogéneos, componente común, metadata parcial de video y fuente ausente.
Los DTO de red son entradas de prueba, no tipos públicos del repositorio.

La clave es `design:` + `JSON.stringify([designId, name])` o `video:` +
`JSON.stringify([video, source ?? "", name])`. Un duplicado exacto se informa
como dato duplicado y se distingue agregando su índice estable de origen a la
tupla de **cada** entrada duplicada; nunca se colapsa. `source` se conserva al
fusionar metadata viva. Una entrada no disponible mantiene sus datos y motivo.

`getDesigns`, `getLibrary` y `getCatalog` rechazan errores y abortos; los
consumidores conservan el error y permiten reintentar. `previewUrl` es síncrono
y lanza `ShowcasePreviewError` ante una entrada inválida, sin diseño o con una
fuente de video no ejecutable. Los errores de datos o red no se convierten en arrays vacíos.
El contexto lleva los diseños y sus scripts; los scripts comunes se deducen de
esa lista, preservando orden y eliminando duplicados.

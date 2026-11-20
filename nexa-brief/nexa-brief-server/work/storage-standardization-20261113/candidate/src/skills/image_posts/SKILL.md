Antes: [CALIDAD.md](../CALIDAD.md) (manda) y, si orquestas, [ORQUESTACION.md](../ORQUESTACION.md).
Al delegar: [PLANTILLA-BRIEF.md](../PLANTILLA-BRIEF.md). Al entregar: [PLANTILLA-INFORME.md](../PLANTILLA-INFORME.md) como `INFORME.md`.

## Específico de esta skill

# Publicaciones de imagen

Cinco publicaciones son cinco piezas independientes, no necesariamente cinco láminas de
un carrusel. Determina tema, categoría y fuente para cada una con lo que pidió el humano;
no inventes esos datos. Si faltan y no se pueden inferir de contenido autorizado, solicita
la información necesaria y continúa solo las tareas independientes. No publiques ni programes.

El flujo actual de la aplicación parte de un video fuente existente: consulta estilos y
estrategias en `GET /api/v1/image-posts/styles?category_id=<id>` y
`GET /api/v1/image-posts/strategies`. Con una sesión autorizada, crea un plan por pieza
con `POST /api/v1/image-posts/plans`, cabecera `Idempotency-Key` única y JSON:

```json
{"category_id":"node_tech","source_video_id":"ID_EXISTENTE","template_id":"daily_fact","style_id":"ID_DEVUELTO","format":"4:5"}
```

`daily_fact` y `five_slides` son plantillas distintas; el segundo es un carrusel. Los IDs
y estilos deben salir de la app. El servicio necesita video fuente: si el pedido no lo
incluye, no inventes uno ni prometas que el endpoint admite un tema libre. Si hay acceso,
revisa hechos y `claim_refs` contra investigación actualizada; la generación automática
no sustituye las dos fuentes por cifra ni la lectura de las fuentes. Guarda investigación,
URLs y fechas; aplica [MEDIOS.md](../MEDIOS.md) a imágenes y créditos.

Revisa y corrige el plan en el editor o `PUT /api/v1/image-posts/plans/<plan_id>` con
`If-Match` de la revisión y el plan completo. Para preparar imágenes, la app o
`POST /api/v1/image-posts/plans/<plan_id>/render` con `{"review_required":true}` genera
las piezas; consulta el estado y revisa cada imagen y texto a tamaño real y reducido,
recortes, legibilidad, fuente, licencia, atribución y relevancia. Este render de láminas
no es grabar video ni publicar. No crees deliveries ni llames a publish. Si el entorno o
la fuente no permiten completar el flujo, registra el error exacto y no declares listo.

Por cada pieza guarda `INFORME.md` según la plantilla común con consumo, fuentes, créditos,
respuestas de la puerta de calidad aplicables a imagen y lo que falte al inicio. Conserva
IDs, revisión y enlace a la pieza. Para imágenes sin video, la puerta de hojas 16:9/9:16 y
miniaturas se marca «no aplica», con revisión de los formatos solicitados en su lugar.

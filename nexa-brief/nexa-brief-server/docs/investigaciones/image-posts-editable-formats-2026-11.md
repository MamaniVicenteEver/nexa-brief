# Posts editables y formatos de publicación

El plan de composición es la fuente editable. Los JPEG son archivos derivados e
inmutables; no deben usarse como fuente para corregir textos o cambiar proporciones.

## Responsabilidades

- `core/image_posts/profiles.py`: registro de tamaños; 9:16 es el valor por defecto
  para planes nuevos. Los documentos antiguos sin formato conservan 4:5.
- `core/image_posts/plan.py`: datos, referencias y hash del plan.
- `engine/image-engine.*` y `image-stage-runtime.js`: composición exclusiva de
  imágenes, compartida por la previsualización y la exportación.
- `tools/image_export.py`: HTML aislado sin acceso a red, render a PNG sin pérdida,
  codificación JPEG 95/sRGB/4:4:4 y control de calidad.
- `core/image_posts/artwork.py`: vista previa sin persistencia y nuevas revisiones
  de JPEG sin reescribir textos editoriales ni llamar a modelos de IA.
- `ImageFormatSelector`, `CodeSlidePreview` y `CodeSlideFrame`: controles y vista
  editable. El iframe permite scripts del motor y carece de `allow-same-origin`.
- `ImagePostPublishingPanel`: preparación del JPEG y revisión del archivo antes de
  aprobar y enviar a los canales elegidos.

## Flujo

1. Elegir formato cambia únicamente la vista previa.
2. Preparar JPEG genera una revisión nueva si cambió el formato o el motor.
3. El archivo final se muestra en el modal. Se conservan título, captions, fuentes,
   alt text y los archivos de revisiones anteriores.
4. Aprobar/publicar vuelve a leer la revisión vigente, comprueba formato y canales
   y utiliza únicamente los archivos archivados de esa revisión.

Una revisión con entregas enviadas, en curso o de resultado desconocido conserva
su formato. Las diferencias de revisión durante una exportación producen 409; no
se descartan cambios de otro editor ni se publica una versión distinta.

## Formatos

| Perfil | Dimensiones |
| --- | --- |
| 4:5 | 1080 × 1350 |
| 3:5 | 1080 × 1800 |
| 9:16 | 1080 × 1920 |

Al añadir un perfil, actualizar el registro, el tipo de esquema HTTP/persistencia
y `image-formats.ts`. La API de capacidades expone los perfiles disponibles.
Una proporción diferente requiere recomponer desde la fuente, nunca estirar un
JPEG anterior. La cuadrícula sutil pertenece al motor de imágenes y se aplica a
fondos oscuros sin fotografía; no modifica componentes de video.

## Contratos HTTP

- `GET /image-posts/{post_id}/preview?format=9:16&slide_id=...`: documento HTML,
  dimensiones, revisión y hashes. Requiere acceso a la categoría del post.
- `POST /image-posts/{post_id}/format`: `{revision, format}`. Exporta sin publicar
  y devuelve el post con su revisión actualizada y revisión editorial pendiente.
- La UI proxy usa las mismas rutas bajo `/api/image-posts`.

El HTML de previsualización integra código, fuentes y medios verificados locales.
Su CSP no permite conexiones ni recursos externos. La exportación comparte el
mismo runtime y verifica desbordamiento, contraste, legibilidad, tamaño y sRGB.
El hash del código del renderizador evita reutilizar JPEG de un motor anterior.
Los cambios deliberados del motor también deben incrementar su versión.

## Restricciones por red

Según la documentación oficial consultada el 2026-11-01:

- Instagram Graph feed: JPEG, máximo 8 MB, ancho 320–1440, relación entre 4:5 y
  1.91:1. De los perfiles del módulo, solo 4:5 cumple. Carruseles: 2–20 imágenes.
  No trasladar los requisitos de Stories a las publicaciones del feed.
- Facebook fotos: el módulo entrega JPEG de menos de 4 MB; admite los tres
  perfiles. El límite de 20 imágenes es una decisión del producto.
- TikTok: el servidor principal aún no tiene habilitada esta ruta de fotos; la UI
  no debe ofrecer una publicación simulada ni declarar éxito sin integración.

Referencias: [Instagram Media](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media/),
[Facebook Photos](https://developers.facebook.com/docs/graph-api/reference/page/photos/).

Los adaptadores validan todos los JPEG antes de acceder a la red y conservan la
conciliación de resultados ambiguos y la prevención de envíos duplicados.

## Verificación

Ejecutar las pruebas de `tests/unit/image_posts` y `tests/unit/publishing`, y las
pruebas web del módulo `features/image-posts`. Los casos clave son exportaciones
reales de los tres perfiles, equivalencia de previsualización y captura PNG,
compatibilidad 4:5 antigua, aislamiento del iframe, cambios concurrentes,
preservación de originales y bloqueo de formatos incompatibles antes del envío.

La validación visual debe recorrer un post sin foto y otro con fotos, comparar los
tres tamaños y revisar el JPEG final en escritorio y móvil. Las pruebas no deben
realizar publicaciones reales en redes.

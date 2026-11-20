# Configuración de Atlas en Movimiento

La transcripción y el estilo 01 de los cinco componentes editoriales están aplicados a la plantilla. La galería permite comparar el fondo predeterminado con variantes más oscuras.

## Transcripción

En `assets/scene.json`, y en el generador `work/escena/build.mjs`:

```json
{
  "captions": {
    "enabled": true,
    "size": 45,
    "reductionPercent": 35.6,
    "color": "#ffffff",
    "stroke": true,
    "strokeColor": "#000000",
    "background": "",
    "y": 0.9,
    "yLandscape": 0.915,
    "yOffsetLandscape": 10
  }
}
```

- `enabled: false` oculta la transcripción. Es un booleano, sin comillas.
- `size` es la referencia, no el tamaño final. El valor aplicado 35,6 % equivale a 28,98 px en 1080×1920, o 31,878 px en 1920×1080. El 8 % adicional se calcula sobre la versión ya reducida un 30 %.
- Para probar una reducción total del 35 % o 40 %, cambiar `reductionPercent` a 35 o 40. El control permite otros valores.
- `color` es el relleno de las letras, blanco puro por defecto. La caja de fondo sigue transparente (`background: ""`).
- `yOffsetLandscape` se mide en U: una U es 1 px en 1920×1080 y 2/3 px en 1280×720. No mueve el texto en vertical.
- Se conserva la fuente, el peso, las mayúsculas, los grupos y la animación originales.
- La entrada auxiliar `index.caption-propio.html` usa los mismos valores; desactiva la transcripción de Proto solo dentro de su contexto para dibujar una única capa HUD. Los dos accesos respetan enabled.

Los controles del HTML prueban variantes en el navegador y permiten descargar sus ajustes. Restablecer recupera los valores aplicados a la plantilla. No guardan silenciosamente nuevos colores o tamaños en el video.

## Componentes editoriales: estilo aprobado 01

`editorial.press`, `callout.photo`, `inventory.units`, `portrait.badge` y `portrait.cutout` usan por defecto la opción 01: tarjeta y marco grafito `#20252b`; títulos `#e6e6e6`, subtítulos `#f4f4f4` y descripciones o créditos `#ffffff`, todos con contorno negro. Se conservan la geometría, las fotos, los datos y los créditos de cada componente.

La IA puede oscurecer el fondo de la tarjeta y la placa o borde de la imagen juntos mediante un campo opcional del item:

```json
{"type":"editorial.press","appearance":{"cardColor":"#0f1216"}}
```

El ejemplo es el fondo oscuro de la opción 03; sin `appearance`, se usa el grafito aprobado `#20252b`. El mismo ajuste sirve para los cinco tipos. Si es necesario variar solo el borde de la imagen, agregar `"photoBorderColor":"#171c21"`; `photoBackplateColor` permite controlar por separado la placa detrás de la foto. Los colores se escriben como `#RRGGBB`. Mantener los colores de las letras de la opción 01 salvo que se indique lo contrario. `inventory.units` no lleva imagen: `cardColor` controla su fondo. Los ajustes se declaran en los datos de cada item, sin alterar la paleta de los demás componentes.

Las imágenes de `capturas-editorial/` y el HTML de comparación son vistas de referencia; modificar sus controles no guarda cambios en el episodio. La fecha superior es un `label.chip` separado, no forma parte de estos cinco componentes.

## Verificación

Las pruebas tácticas incluyen cinco verificaciones del estilo 01 y del color configurable; la escena valida con cero errores y cero avisos.


La transcripción se verificó con las pruebas del núcleo táctico y de Proto. La revisión nativa en navegador confirma una sola transcripción blanca a y=998,2 en 1920×1080 y fuente de 31,878 px. Las entradas normal y HUD dejan de dibujarla con enabled=false. El panel se revisó a 1440 y 390 px, con presets de reducción, interruptor y variantes de la tarjeta; sin errores de consola ni desbordamiento horizontal. El reporte de captura está en `transcripcion-aplicada-qa.json`.

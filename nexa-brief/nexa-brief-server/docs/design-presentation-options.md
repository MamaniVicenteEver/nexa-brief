# Opciones de presentación y categoría de YouTube

Cada diseño explainer puede declarar `options.json` en su carpeta de
`src/templates/_tools/design-definitions/<id>/`. Los campos son opcionales:

```json
{
  "preview_mode": "mobile",
  "youtube_category_id": "27"
}
```

`preview_mode` admite `desktop` y `mobile`, y controla la vista inicial y el
formato inicial de grabación. Sin valor se usa `desktop`. Una elección guardada
por el usuario en la sesión prevalece sobre ese valor inicial.

`youtube_category_id` es un ID numérico válido de YouTube, o `null` para omitir
la categoría en la solicitud de subida. Cada `manifest.json` de un episodio
puede sobrescribir cualquiera de estos dos campos, incluido `null` para quitar
una categoría establecida por su diseño. La categoría se conserva en el paquete
de publicación para su uso en envíos directos y programados. La clasificación
como Short depende del formato y de la duración final, y la determina YouTube.

Cara a Cara declara `mobile` y `youtube_category_id: null`.

Para plantillas del pipeline de nichos, el campo equivalente se configura en
`publishing.youtube_category_id` del nicho asociado a la plantilla en
`niches.json`. Su valor también es un ID numérico como `"27"`, o `null` para
omitirlo. El resumen preparado conserva ese valor para publicaciones directas
y para la cola programada. Sin configuración se omite para todos los diseños.

# Contenido y ampliación

## Fuente de verdad

`src/features/channels/data/channels.json` contiene siete marcas, propósito, idiomas, acento, archivos de identidad, posición del emblema y perfiles sociales. `src/features/network/data/networks.json` contiene la familia NODE. Los nombres y textos no se duplican en una configuración alternativa de respaldo.

## URLs de YouTube proporcionadas por el propietario

| Canal        | URL                                      |
| ------------ | ---------------------------------------- |
| NODEMOTION   | https://www.youtube.com/@nodemotiondc    |
| NODETECH     | https://www.youtube.com/@nodetechdc      |
| NODEHISTORY  | https://www.youtube.com/@nodehistory     |
| NODEPOLITICS | https://www.youtube.com/@nodepolitics_es |
| NODECONOMY   | https://www.youtube.com/@nodeconomy_es   |
| NODEATLAS    | https://www.youtube.com/@nodeatlas_es    |
| NODEMIND     | https://www.youtube.com/@nodemind_es     |

La fuente es la captura y texto adjuntos del 2 de noviembre de 2026. La página de administración requiere sesión; no se solicitaron contraseñas ni se importaron tokens para esta web institucional. Se conservó la escritura **NODECONOMY** del canal real.

Instagram: `@nodemotion_es`, `@nodetech_es`, `@nodehistory`, `@nodepolitics`, `@nodeconomy`. TikTok: `@nodetech`. Facebook y los perfiles restantes esperan una URL confirmada. Un nombre de página o ID interno como `pagina_2` no se convierte en una URL inventada. No se incorporan Aeternum, Online Store o Drova a la red NODE porque no forman parte de los siete canales solicitados.

## Añadir un canal

1. Crear un ID estable y asignar una red existente.
2. Escribir categoría, titular, descripción, propósito y temas en `es` y `en`.
3. Guardar medallón y símbolo transparente bajo `public/assets/<id>/`.
4. Incorporar el perfil público y la URL real. Un perfil futuro usa `handle: null`, `url: null`.
5. Definir el acento hexadecimal y posición porcentual dentro del emblema.
6. Ejecutar `npm run check`, `npm test` y `npm run build`, y revisar la composición.

Para otro rubro: añadir la red en `networks.json` y asociar sus canales por `networkId`. El selector de redes y las rutas públicas de una segunda familia se implementan cuando exista su contenido; el modelo ya permite la separación. No se publican familias vacías.

## Vistas y descargas

Las cuatro pestañas conservan la misma marca y cambian su presentación. Solo existe el botón de visita cuando hay URL confirmada. La línea editorial sirve de ejemplo visual y no representa videos publicados. Las descargas incluyen medallón PNG, símbolo RGBA y portada exportada en el navegador.

Tamaños de exportación: YouTube 2560×1440, Facebook 1640×924, Instagram y TikTok 1080×1080 para pieza de identidad. La portada YouTube mantiene el texto central dentro de un espacio prudente; comprobar recortes al subir cada archivo a la plataforma.

Los enlaces de vista previa usan `?canal=<id>&red=<plataforma>`. Se validan los IDs contra el catálogo. Los textos y enlaces conocidos se renderizan por Astro; no se ejecuta HTML aportado por el usuario.

# Fondos personalizados en plantillas de letras

Las plantillas `lyrics-impact`, `lyrics-romantic`, `lyrics-suave` y `lyrics-triste` aceptan imagen o video como fondo. La transparencia inicial es 20 % (opacidad 0,8). El control muestra el cambio al instante en el navegador sin volver a generar el prototipo, y no modifica texto ni audio principal. El ajuste temporal por prototipo usa el CRUD `createExpiringJsonStore` de la web y vence tras 24 horas sin edición; no hay sondeos. El video de fondo se reproduce en bucle y silenciado.

Al grabar, la web envía `background_opacity` entre 0 y 1 al servicio de grabación. La aplicación incorpora el valor en `config.bg.opacity` antes de iniciar el trabajo, de modo que HTML y Remotion reciben la misma apariencia. El ajuste enviado queda integrado en la configuración del video; no depende del almacenamiento temporal del navegador una vez iniciada la grabación. Las demos originales no reciben este ajuste.

Los ajustes de otros medios, textos o canción siguen requiriendo una previsualización nueva. Para `lyrics-impact`, si la intro no trae título, se utiliza el nombre de la canción seleccionada; tanto la previsualización de prototipos anteriores como la grabación reciben ese valor sin modificar la letra ni pedir otra transcripción.

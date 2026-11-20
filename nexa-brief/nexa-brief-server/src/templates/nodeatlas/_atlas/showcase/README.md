# Vistas previas de Atlas Cinemático

La app abre `Biblioteca` por defecto y lee todos los elementos de `../components.json`.
Las pestañas de `atlas-cinematico/info.json` solo agrupan esa lista: no limitan el catálogo.
`Prototipo` conserva el ejemplo completo con sus variantes; no es el inventario de componentes.

- `thumbs/thumbs.json` debe tener una imagen JPEG de 480 × 480 por cada nombre del catálogo.
- Las imágenes se capturan del canvas de `index.html?only=<nombre>&t=2.6`, con el mismo motor y recursos del ejemplo animado. No son dibujos alternativos del componente.
- No se inicializa MapLibre en las tarjetas hasta que se pulsa el icono de reproducir. Al parar se desmonta el reproductor y se vuelve a la imagen.
- `previewReady: true` mantiene la imagen hasta recibir `nexa-animation-ready` del iframe. `load` no significa que el mapa haya dibujado su primer cuadro.
- La galería inicia Proto congelado y administra un único reloj de animación. `autoplay=1` activa el bucle después del primer cuadro preparado.
- El fondo del contenedor y del control es blanco. El contenido de cada mapa conserva su look (satélite, político, espacio, etc.).

Al añadir un componente, capturar su fotograma, añadirlo a `thumbs/thumbs.json` y ejecutar:

```sh
node --test src/templates/sandbox/nodehistory/_atlas/showcase/catalog.test.mjs
```

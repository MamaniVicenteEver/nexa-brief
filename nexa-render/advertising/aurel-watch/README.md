# Aurel No. 01 — pieza publicitaria

Publicidad de reloj premium en formato `1920×1080`, `14s`, `30fps`.

Archivos:

- `template.html`: estructura, escenas, imágenes y video ambiental.
- `template.css`: identidad visual Aurel, layout y responsive visual del frame.
- `template.js`: timeline GSAP compatible con HyperFrames.

## Usar en nexa-render

Para HyperFrames, pega el contenido de los tres archivos en los campos HTML,
CSS y JS de una plantilla HTML. Selecciona HyperFrames y graba con formato
Desktop. El HTML ya incluye `data-start`, `data-duration` y
`data-track-index`.

Para Playwright, usa los mismos tres campos. Playwright captura el estado
animado en el tiempo indicado por el navegador; para la secuencia completa,
usa HyperFrames.

Las imágenes y el video son URLs externas de demostración. Para producción,
descarga los recursos y sírvelos localmente para que el render sea
determinista.

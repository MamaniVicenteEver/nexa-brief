# shared/

Carpeta para código realmente reutilizable entre `src/movil/` y `src/desktop/` (o cualquier feature
nueva que se agregue más adelante — `cuadrado/`, `carousel/`, etc.).

## Por qué está vacía hoy

`movil/` y `desktop/` se diseñaron con estéticas deliberadamente distintas (news-brief frío vs.
tech-stats dinámico), así que **hoy no hay ningún archivo literalmente idéntico** entre sus
`components/` — cada plantilla (`text-block.js` vs `kinetic-text.js`, `transition-wipe.js` vs
`elastic-push.js`, etc.) tiene su propia lógica de animación. Copiar algo acá "porque se parece" sería
una abstracción prematura — mejor esperar a que un patrón se repita de verdad, igual, en un tercer lugar,
antes de extraerlo.

## Qué sí pertenece acá cuando aparezca

- **Componentes GSAP genuinamente idénticos** entre dos o más features (mismo código, mismos `opts`,
  sin bifurcar comportamiento por feature).
- **Constantes de marca compartidas** (paleta de colores oficial de Nexa Brief, tipografía, logo) si
  algún día `movil/` y `desktop/` empiezan a usar la misma identidad visual en vez de paletas propias
  por diseño.
- **Utilidades de infraestructura** que no son específicas de una composición: por ejemplo, un script
  de verificación (`ffprobe` + duración/resolución esperada) que hoy se corre a mano por feature.

## Cómo se usaría

Cada `index.html` de `movil/`/`desktop/` cargaría el archivo compartido con una ruta relativa hacia
acá, por ejemplo `<script src="../shared/components/algo.js"></script>` — **ojo**: si ese archivo
termina usándose en un render de AWS Lambda, hay que confirmar que la subida del "site" a S3 incluya
la carpeta `shared/` (el comando `hyperframes lambda sites create` empaqueta el directorio del proyecto
que se le pasa; si `shared/` queda fuera de ese directorio, no viajaría con el resto). Validarlo con un
`hyperframes lambda render` real antes de asumir que funciona.

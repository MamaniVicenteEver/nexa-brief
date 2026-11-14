# promo-breaking · miniaturas A/B

Las miniaturas usan el **sistema real de miniaturas de NodeMotion** (el mismo editor
y el mismo JPG que el resto de plantillas), no un componente propio de la plantilla:

| pieza | archivo | qué aporta para promo-breaking |
|---|---|---|
| diseño por defecto | `src/core/draft_thumbnails.py` (`_THEMES`, `_FALLBACK_PALETTES`, `_default_options`) | layout `breaking`, paleta (negro, blanco, rojo, rojo profundo), titular y placa por defecto |
| tipografía | `src/templates/nodemotion/design-tokens.json` → `promo-breaking` | Poppins 800 (archivo local `nodemotion/assets/fonts/poppins-normal-800.ttf`, OFL) |
| dibujo | `src/core/draft_thumbnail_renderer.js` → `renderBreakingSvg` | composiciones A y B (vista del editor y JPG final usan el mismo renderer) |
| fondo | `src/core/draft_thumbnail_assets.py` | fotograma de los clips del draft o de la plantilla, imagen subida o color |

## Textos

- **Titular** (A y B): renglón 1 del primer segmento del guion (la intro), máx. 5 palabras;
  si no existe, el título del draft. Editable en la app.
- **Placa**: renglón 2 del primer segmento, o `brand.tag`, o `brand.url` (máx. 40).

## Opción A · «Titular de última hora»

Escena intro / `word` (segundo 1–2): fondo en blanco y negro (duotono `mono`
del video), letras gigantes claras al 60 % con un trozo de la palabra más larga,
tinte rojo desde la esquina superior izquierda, viñeta, cruces y rombos, titular
Poppins 800 centrado con el tramo central de la palabra más larga **en contorno**,
subrayado rojo y la placa espaciada debajo. NODEMOTION discreto abajo a la derecha.

## Opción B · «Filas urgentes»

Escena `repeat` (segundo 5): foto en duotono rojo, cuatro filas espaciadas del
titular (sólidas y en contorno, desplazadas), banda negra central con el titular
grande con tramo en contorno, subrayado blanco y la placa.

## Qué se edita en la app

Texto de cada opción, fondo (fotograma del video con tiempo y encuadre, imagen
subida o color sólido) y oscurecido manual. Colores, tipografía y composición
pertenecen a la plantilla (`_safe_design` no los acepta del cliente).

## Verificación

- Renderizado con el renderer real, Poppins local y un fotograma de la plantilla:
  A y B legibles a 1280×720 y en pequeño (captura de control generada en el servidor).
- `tests/unit/test_draft_thumbnails.py` incluye `promo-breaking` (layout `breaking`).
- **Pendiente**: crear un draft real de esta plantilla en la app, editar A/B,
  guardar y comprobar el JPG final y la previsualización del editor (no se creó
  ningún draft en esta tarea).

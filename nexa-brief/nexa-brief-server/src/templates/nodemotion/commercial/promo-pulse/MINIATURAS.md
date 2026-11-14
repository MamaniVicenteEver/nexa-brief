# promo-pulse · miniaturas A/B

Usan el **sistema real de miniaturas de NodeMotion**:

| pieza | archivo | qué aporta para promo-pulse |
|---|---|---|
| diseño por defecto | `src/core/draft_thumbnails.py` (`_THEMES`, `_FALLBACK_PALETTES`, `_default_options`) | layout `pulse`, paleta (negro, crema, verde), titular, placa y rótulo de esquina |
| tipografía | `src/templates/nodemotion/design-tokens.json` → `promo-pulse` | Anton 400 local (itálica sintética con sesgo de 10°, como el video) |
| dibujo | `src/core/draft_thumbnail_renderer.js` → `renderPulseSvg` | composiciones A y B |
| fondo | `src/core/draft_thumbnail_assets.py` | fotograma de los clips, imagen subida o color |

## Textos

- **Titular** (A y B): renglón 1 del primer segmento (máx. 5 palabras) o título del draft.
- **Placa**: renglón 2 del primer segmento (frase corta), o `brand.tag`/`brand.url`.
- **Esquina**: `brand.corner` (máx. 24), arriba a la derecha como en el video.

## Opción A · «Video enmarcado»

Escena intro / `framed`: fondo negro, palabra más larga gigante en contorno verde,
fotograma con grade `cine` enmarcado con sombra y el cuadrito verde, titular crema
en itálica sobre el cuadro y la placa en el borde inferior del marco.

## Opción B · «Palabra calada»

Escena `knockout`: el fotograma oscurecido de fondo y la palabra más larga a todo
el ancho con la foto (aclarada) **dentro** de las letras y contorno crema; medidor
verde segmentado y placa debajo. Si el titular tiene varias palabras, el titular
completo va arriba.

## Qué se edita en la app

Texto de cada opción y fondo (fotograma, imagen o color). Colores, tipografía y
composición pertenecen a la plantilla.

## Verificación

- Render con el renderer real, Anton local y un fotograma de la plantilla: A y B legibles.
- `tests/unit/test_draft_thumbnails.py` incluye `promo-pulse` (layout `pulse`).
- **Pendiente**: prueba con un draft real en la app (editar, guardar y JPG final).

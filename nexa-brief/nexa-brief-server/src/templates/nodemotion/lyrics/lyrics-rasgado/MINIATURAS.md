# lyrics-rasgado · miniaturas A/B

Usan el **sistema real de miniaturas de NodeMotion**:

| pieza | archivo | aporte |
|---|---|---|
| diseño por defecto | `src/core/draft_thumbnails.py` (`_THEMES` → layout `rasgado`, `_FALLBACK_PALETTES`) | paleta papel `#DEDEE4`, carbón `#262626`, lima `#90DE66` |
| tipografía | `src/templates/nodemotion/design-tokens.json` → `lyrics-rasgado` | A: Anton (condensada); B: Archivo 900 (extendida); ambas locales |
| dibujo | `src/core/draft_thumbnail_renderer.js` → `renderRasgadoSvg` | composiciones A y B (vista del editor y JPG) |
| fondo | `src/core/draft_thumbnail_assets.py` | fotograma del video, imagen subida o color |

Textos (como en el resto de plantillas de letras): **A** = título de la canción
(máximo 5 palabras) y **B** = una frase real de la letra (5–14 palabras). La
etiqueta «LETRAS» la impone el sistema.

- **A · «Hoja rasgada»**: escena `giant`/`build`. Hoja gris con fibra, jirón lima
  arriba y jirón carbón abajo con reborde blanco, título enorme en la condensada
  ligeramente inclinado, «LETRAS» sobre una pincelada lima, X y triángulo de marcador.
  No usa la foto.
- **B · «Tira sobre el medio»**: escena con fondo `media`. Fotograma en B/N con
  acento lima, jirón lima arriba, frase en la extendida negra dentro de una tira de
  papel rasgado inclinada y «LETRAS» en lima.

Se editan en la app el texto de cada opción y el fondo; colores, tipografías y
composición son de la plantilla. Verificado con el renderer real y fuentes locales.
**Pendiente**: un draft real (editar, guardar y JPG final).

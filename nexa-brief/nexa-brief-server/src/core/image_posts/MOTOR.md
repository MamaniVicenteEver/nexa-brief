# Motor de imágenes — mapa para cambiarlo sin leer todo

Rutas relativas a `nexa-brief-server/`. Cada capa se cambia sola: tocar una no rompe las otras.

| Quiero cambiar… | Archivo | Nota |
|---|---|---|
| Qué se dice y en qué orden (una estrategia) | `src/core/image_posts/strategies/<id>.py` | `build()` arma las láminas; `brief` guía al redactor |
| Agregar una estrategia | crear `strategies/<id>.py` con `STRATEGY` + sumarla en `strategies/__init__.py` | la API y la web la leen del registro |
| Cómo se redactan cifra/titular/contexto | `strategies/copywriter.py` (`SYSTEM`) | modelo del rol `copy_draft` en `src/skills/models/roles.json` |
| Reglas sin modelo (cifras, cortes, fuentes) | `strategies/base.py` | `extract_stat`, `trim_words`, `spanish_numbers`, `readable_source` |
| Orden visual de los bloques de una lámina | `src/templates/_tools/explainer-kit/engine/image-engine.js` → `LAYOUTS` | listas de bloques; `?` = opcional |
| Tamaños de letra base y mínimos | `image-engine.js` → `TYPE` | el stage achica hasta el mínimo |
| Cómo se dibuja un bloque | `image-engine.js` → `BLOCKS` | una función por bloque |
| Estructura y espaciado (CSS) | `engine/image-engine.css` | columna flex dentro de `grid.margin_px` |
| Decoración de un diseño | `designs/<rough|binary>/image-components.js` + `engine/image-skins.css` | solo decoración, nunca posiciones |
| Colores, fuentes, @cuenta de una categoría | `src/skills/image_posts/styles/<categoria>.json` | `palette`, `fonts`, `brand` |
| Qué roles de texto existen / cuáles citan fuente | `src/core/image_posts/validate.py` → `FACTUAL_ROLES`, `NON_FACTUAL_ROLES` | todo dato afirmado debe tener `claim_refs` |

## Flujo

```
PLAN.md §3 (hechos con fuente publicada)
  → estrategia.pick (hechos con cifra más fuerte)
  → copywriter (modelo; cada cifra debe estar en el hecho, si no → reglas campo por campo)
  → estrategia.build → ImagePlan (layout "<estrategia>:<receta>" por lámina)
  → validate (roles, fuentes, límites)
  → image_export.py → showcase/image-stage.html → ImageEngine.render + piel → QC → JPEG
```

### Aprobación editorial de hechos

El armador lee la cuarta columna de la tabla de `PLAN.md §3` (`cotejo / uso`). Solo toma una fila si
su celda comienza con `Sí`, `Si`, `Aprobado`, `Aprobada` o `Publicar` como palabra completa, seguida
opcionalmente por `;`, `:` o una explicación. Una frase que comienza con `No publicar`, `No
publicable`, `No aprobado` o `No aprobada` siempre se excluye. El resto de las filas se considera
sin aprobación explícita, aunque tenga fuente y cotejo.

Además, la URL de la fuente debe aparecer en `publish.json`. El locator de cada `claim_ref` guarda el
texto de cotejo/uso que autorizó la fila, para que la decisión viaje con el plan archivado. Para
habilitar un hecho, quien revisa el material lo marca, por ejemplo: `Sí; usar con el denominador de
la encuesta y aclarar que es autoselección.`

## Depurar barato

- El QC dice qué bloque no entró: `overflow_blocks: ["stat"]` o `["columna completa"]`.
- `IMAGE_QC_DEBUG_DIR=/tmp/x` guarda la captura de la lámina que falló.
- El log `image_post_copy` dice por cada hecho si el texto vino del `modelo` o de `reglas: <motivo>`.
- `NEXA_IMAGE_COPY_MODEL=off` apaga el modelo (tests, o para comparar contra las reglas).
- Probar sin la app: `.venv/bin/python src/core/image_posts/strategies/sample_render.py <categoria> <video-id> /tmp/out` (`src/core/image_posts/strategies/sample_render.py`).

## Estrategias actuales

| id | Nombre | Formato | Objetivo |
|---|---|---|---|
| `cifra_que_frena` | Cifra que frena el scroll | imagen única 4:5 | alcance y compartidos |
| `hilo_guardable` | Hilo para guardar | carrusel 5 láminas | guardados y seguidores |
| `prueba_a_la_vista` | La prueba a la vista | imagen única con foto real (Wikimedia, con licencia) | comprensión y compartidos |

Fundamento de tamaños, colores y recetas con foto: `docs/investigaciones/principios-diseno-imagenes-2026-10.md`.
Recetas con foto (`image-engine.js` → `LAYOUTS`): `photo_top` (B, por defecto, foto horizontal), `photo_side` (C, vertical/estrecha), `photo_full` (A, casi 4:5, con velo). La elige `prueba_a_la_vista.recipe_for` por proporción y tamaño mínimo.
Fotos: `src/core/image_posts/media_sources.py` (Wikimedia Commons + imagen principal de Wikipedia, licencias PD/CC0/CC BY/CC BY-SA, caché por sha256 en `data/media-cache/wikimedia/`). El render toma los bytes de la caché (`service._cached_media`). La atribución nunca se trunca.

### Lecturas locales

`ImagePostService` consume puertos para el repositorio de publicaciones, el material verificado, el
catálogo de estilos, el mapeo de cuentas y la caché de fotos. `adapters/data/local_image_post_resources.py`
y `local_image_media_cache.py` implementan esas lecturas para el backend local. El servicio recibe
objetos validados, IDs lógicos y bytes con hash; no conoce rutas ni abre JSON.

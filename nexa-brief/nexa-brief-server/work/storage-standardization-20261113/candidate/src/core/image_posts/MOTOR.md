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

## Amarillista (propuesta aislada, ronda 4)

Es la estrategia predeterminada del carrusel, nivel negro. `daily_fact` explícito conserva su imagen única y las otras estrategias siguen disponibles por ID. Objetivo propio: alcance, comentarios y nuevos seguidores.

Entrada para cualquier agente: `src/skills/image_posts/strategies/AMARILLISTA.md`. Contrato ejecutable: `image_amarillista_v1.json` en el mismo directorio. Define roles, orden, rango 5–8, fuentes/visuales, reflexión obligatoria, límites, niveles, ejemplos, esquemas nativos y juicio de fotos.

Desde el servidor: `python -m src.core.image_posts.render_post <carpeta-con-PLAN-y-post.json> --out <salida> --strategy amarillista --level negro`, con `with-env.sh` y `nice -n 10` en esta instalación. `--levels negro alto` compara carruseles completos. El wrapper de la copia es `render_post.py`.

- PLAN §3 usa roles explícitos y aprobación con fuente HTTPS. Sin giro o reflexión documentados se detiene; no se inventan ni se sustituyen por reglas.
- Gemini redacta los cuatro titulares/reflexiones con esquema JSON nativo; DeepSeek repara una sola vez los campos rechazados y realiza cotejo independiente. Rechazos, campos conservados y tokens se archivan.
- Búsquedas por concepto/rol con pausa, licencias, dimensiones, motivo del modelo y deduplicación por identidad/hash. Las fotos aprobadas se conservan al cambiar de nivel. Un gráfico informativo puede reemplazar una foto; una tarjeta de texto no cuenta como gráfico. Una variación porcentual no se representa como partes de 100.
- Reflexión: frase con significado personal, fuente visible y visual, negro directo en segunda persona y alto sereno; no exageración médica. Prueba, giro y cierre conservan sus funciones. La API acepta `level` y predetermina el carrusel.
- El comando valida plan/JPEG/QC y entrega JPEG, captions, auditoría y hojas. Falla de manera explícita y sin publicar. `--recheck-approved` exige nuevo cotejo y admite una sola reparación antes de reutilizar un borrador anterior ante cambios de contrato/entrada.

La suite y las pruebas propias están en `tests-r4-estandar-final.txt`, `out-pruebas/` y `BITACORA.md`. **Sueño/actividad quedaron rechazados; IA completó la ejecución técnica pero su recotejo también rechazó copy. No hay piezas editoriales finales aprobadas ni equivalencia de calidad demostrada con cualquier modelo.** El resultado de ronda 4 documenta proveedores 503, rechazos y pendientes. El parche no está aplicado.

### Entregas de fotos en TikTok

TikTok usa de forma deliberada el caption y el primer comentario editables de Instagram. Es aceptable para este puente porque ambos destinos comparten el texto aprobado y así se evita crear un campo que el editor actual no permite revisar; no permite variantes por red. Si se necesita texto distinto para TikTok, hay que ampliar juntos el modelo y el editor antes de usarlo. Los hashtags se añaden al caption y el comentario solo se solicita con permiso; queda pendiente hasta recibir confirmación específica.

Al recibir el ID del job de fotos, se guarda en la entrega antes de esperar su resultado. La conciliación consulta ese job sin volver a publicar y solo confirma con `post_id` y URL. Si aún no está confirmado, conserva `outcome_unknown`; si no se recibió o guardó el ID (por ejemplo, se perdió la respuesta al POST), marca `TIKTOK_MANUAL_REVIEW` y requiere revisión humana. No se debe reenviar automáticamente una entrega incierta.

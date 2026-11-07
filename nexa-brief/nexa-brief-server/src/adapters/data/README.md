# adapters/data — persistencia intercambiable

El dominio usa `core/data.py` y los contratos de `core/ports/data_port.py`:
colecciones de registros, documentos JSON y archivos binarios. Las claves y
nombres lógicos se declaran en `layout.py`. Una operación compuesta que debe
coordinar workers usa `coordination(name)` del proveedor de registros; el
dominio no conoce locks ni rutas del adapter.

En perfiles v1 (y sin perfil seleccionado) se conservan las rutas originales:
registros y documentos en `data/`, binarios de biblioteca en
`data/library/files/<tipo>/`, y archivo de publicaciones en `data/publicaciones/`.
En perfiles v2, los registros y documentos siguen en `data/`, mientras que los
binarios nuevos de biblioteca se guardan en `resources/<tipo>/<categoría>/<clave>`
y los medios y trazas de publicaciones en `productions/_publicaciones/`.
Los locks y temporales de estos adapters se guardan en `.system/runtime/`.
La lectura de claves antiguas busca solo en `data/` del mismo perfil; al borrar
una clave se eliminan sus representaciones actual y legacy. No se importa nada
de otro perfil. Las claves lógicas existentes `categoría/nombre` se conservan.

`factory.py` compone los proveedores de registros y archivos de forma
independiente. `records:json` y `files:filesystem` son locales; proveedores
externos se registran mediante `register_provider`. El kind `files` implementa
`FileStorageProvider` para biblioteca; el kind `media` existente corresponde al
puerto de medios de publicaciones, que tiene un contrato distinto. Un proveedor
no instalado falla explícitamente y no recurre silenciosamente a otro perfil o
backend. Un proveedor remoto de registros debe implementar también
`coordination` con exclusión entre procesos para las operaciones de cola.

Los archivos locales se escriben primero en un temporal y se sustituyen de forma
atómica. El directorio técnico y el destino deben estar en el mismo sistema de
archivos para que la sustitución atómica sea posible.

## Ubicaciones de metadata

Las rutas siguientes son relativas a `data/` en v1 y v2. El mapa completo está
en `layout.py`; no repetir estas rutas en servicios del dominio.

| Nombre lógico | Ubicación local |
| --- | --- |
| `jobs`, `history_events` | `jobs/jobs.json`, `jobs/history_events.json` |
| `content_videos`, `content_resources` | `content/videos.json`, `content/resources.json` |
| `content_video_details` | `content/video_details/<video_id>.json` |
| `execution_logs` | `logs/index.json`, referencias sin el contenido real |
| `content_catalog_snapshots` | `catalog/snapshots/<version>.json`, derivados del código |
| `image_assets`, `music_assets`, `sound_assets`, `video_assets` | `library/<images,music,sounds,videos>.json` |
| `template_configs`, `template_config_files` | índice `library/template_configs.json` y documentos `library/template_config_files/` |
| `image_vision`, `video_vision`, `lyrics`, `stock_search_cache` | documentos JSON en `library/cache/<nombre>/` |
| `drafts`, `draft_jobs`, `media_plans`, `template_originals` | índices y documentos JSON en `studio/` |
| `explainer_productions`, `explainer_batches`, `explainer_runtime` | estado JSON en `explainer/` |
| `prototype_runs` | `prototypes/runs.json` |
| `queue_entries`, `schedule_slots`, `content_plan` | cola y planificación en `schedule/` |
| `channels`, `channel_categories`, `channel_publications`, `published_videos` | información de canales y publicaciones en `canales/` |
| `publication_index` | `publicaciones/index.json`, proyección del archivo de publicaciones |
| `notifications`, `progress` | `notifications/`, `progress/` |

Para añadir un backend, implementar los contratos de registros, documentos y
coordinación, registrar el proveedor y ejecutar sus pruebas de contrato. Los
archivos usan otro proveedor; `local_path()` debe materializar una copia técnica
cuando el renderizador necesite acceso en disco. La transición futura está en
`docs/future-supabase.md`; no basta con cambiar una variable a `supabase`.

### Perfiles v3: secciones JSON

Las colecciones y documentos se agrupan en `data/json/<sección>.json` con una
revisión por archivo, bloqueo entre procesos y escritura atómica. Las rutas y
nombres de los namespaces están declarados en `section_store.py`. El archivo
`publicaciones.json` conserva las publicaciones y recibos idempotentes como
fuente única. `image-posts.json` contiene un índice **derivado y reconstruible**:
`rebuild_image_post_index()` lo reconcilia desde las publicaciones y guarda la
revisión de origen en `index_metadata.source_revision`; puede quedar atrasado
entre reconciliaciones y no se usa como fuente para modificar publicaciones.

Para migración offline se ofrece `import_legacy_data(source_data_dir,
destination_data_dir)` desde `import_legacy_sections.py`. Se ejecuta únicamente
sobre staging saneado, no sobrescribe secciones existentes y conserva sus
archivos fuente. Rechaza recibos idempotentes desconocidos o referencias a
publicaciones faltantes. No abre archivos de conexiones, sesiones ni contenidos
de logs; importa sus índices JSON y la metadata de canales ya saneada.

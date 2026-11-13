# Catálogo modular: contrato y migración por etapas

Estado: primera etapa implementada; retirada de compatibilidad pendiente de revisión humana.
Referencia de código: alfred-server, base 1ff17dd. No se trasladan episodios privados ni motores.

## Decisiones acordadas

- La galería pública muestra demos de repositorio, portada primero y reproductor únicamente al pulsar.
- Si existe un MP4 completo se utiliza; en su ausencia se abre el motor interactivo.
- El público solo recibe reproducción, volumen, progreso, formato y pantalla completa. El estudio exige sesión.
- La vista interna «Ver todo» consulta el mismo catálogo, con sidebar y herramientas al abrir una ficha.
- El filtro y tamaño iniciales son `all`; tamaños numéricos y páginas son configurables.
- Primero se valida la nueva vía. Ningún endpoint o flujo heredado se elimina en esta etapa.

## Capas y dependencias

`presentation/api/routers/catalog.py` → `core/catalog/service.py` → `core/catalog/ports.py`.
La composición está en `adapters/catalog/factory.py`. El núcleo no importa adaptadores,
FastAPI, rutas de disco ni JSON. Los contratos usan IDs, referencias URL y streams.

| Puerto | Proveedor actual | Sustitución futura |
|---|---|---|
| CategoryRepository | JsonCategoryRepository | BD de categorías con el mismo snapshot lógico |
| CatalogRepository | FilesystemCatalogRepository | Índice SQL/documental de demos |
| CatalogMedia | RepositoryCatalogMedia | Almacenamiento de objetos/CDN con control de publicación |
| CatalogClient (web) | httpCatalogClient | Otro transporte que respete los mismos DTO |

La vista llama a `features/catalog/service.ts`, nunca compone endpoints ni conoce archivos.
No se añade una opción `audience=admin`: el servidor y el proxy autentican las rutas internas.
Cada módulo futuro mantendrá sus propios puertos; compartir modelos de página/error cuando sean idénticos.
No crear un servicio global con lógica de todos los dominios.

## Fuente de verdad y publicación

- Categorías: `settings.niches_path` del perfil activo, validadas con las reglas del árbol existente.
- Motion: showcases registrados en `src/templates/templates.json`, excluyendo disabled/testing y `demo:false`.
  Su showcase es la demo existente. La configuración de nichos asigna categoría; el folder es fallback.
- Otras demos: exclusivamente `src/templates/<categoría>/<id>/manifest.json` con `demo:true`.
  Se excluyen sandbox, carpetas ocultas, symlinks y episodios sin la marca.
- Categorías compartidas son referencias al mismo ID; `all` cuenta cada demo una sola vez.
- No se escanea el perfil de producciones, no se elige un episodio privado como fallback de un diseño.
- Los medios se sirven desde el repositorio mediante allowlist de archivos web de demos y sus motores.
  El namespace público jamás resuelve `productions/`, `renders/` del perfil ni sandbox de episodios.
  Los manifiestos, publish.json, instrucciones, logs, credenciales y trabajo quedan fuera del transporte público.

## HTTP y paginación

- `GET /api/v1/catalog`: listado público de demos.
- `GET /api/v1/catalog/internal`: mismo listado, requiere autenticación interna.
- `GET /api/v1/catalog/internal/items/{id}/studio`: detalle para el estudio, protegido.
- `GET /api/v1/catalog/media/{key}`: medios públicos autorizados; ETag y Range para MP4.

Listas: `category=all|<id>`, `page=1`, `page_size=all|1..100`.
Respuesta estable: `items`, `categories`, `total`, `page`, `page_size`, `total_pages`, `category_counts`.
Orden por título normalizado e ID; filtro antes de paginar. `total` es el total filtrado,
`category_counts` cuenta todo el catálogo. Con `all` solo se admite `page=1`.
Las páginas fuera del rango devuelven lista vacía; no se trunca silenciosamente el modo all.
Para grandes catálogos un proveedor puede optimizar la consulta conservando estas reglas;
añadir cursor requiere versionar el contrato, no cambiar sus significados implícitamente.

## Reproducción y MP4

`playback` contiene `engine_url`, `engine`, `desktop_video_url`, `mobile_video_url`.
`features/catalog/playback.ts` selecciona MP4 si hay alguno; si no, iframe con `norec=1`.
Los formatos no disponibles se deshabilitan en el reproductor existente.

Un video de fondo como `assets/bg.mp4` NO es una demo completa.
Para Motion se declaran `demo_video` y/o `demo_video_portrait` en su entrada de templates.json,
con ruta relativa a la carpeta de esa plantilla. Para otras demos se admiten los mismos campos
en su manifest o `render/<id>-16x9.mp4` / `render/<id>-9x16.mp4`.
Los recursos deben estar dentro de la demo (assets/render), nunca en otro perfil.
No se generan ni graban MP4 como efecto de abrir/listar el catálogo.

## Compatibilidad y plan explícito de eliminación

| Elemento anterior | Reemplazo | Otros consumidores / condición antes de retirarlo |
|---|---|---|
| TemplatesCarousel.LegacyTemplatesCarousel y combinación de 2 queries | CatalogCarousel + CatalogClient | Conservar durante revisión visual; después retirar export y sus imports sobrantes |
| home/catalog templateItems/designItems | CatalogEntry + playbackSource | Buscar usos; conservar assignShapes/MarqueeRow/CatalogTile, que son presentación reutilizada |
| AllDesignsWindow y useTemplateCatalog/template-catalog-service | CatalogWindow + useCatalog | Revisar que no haya consumidores/tests; retirar después de aprobar el nuevo Ver todo |
| GET /templates/catalog y template_catalog_schema | CatalogService | Confirmar ausencia de clientes externos y documentar retirada antes de borrar |
| GET /templates y sus DTO | Adaptador de detalle del estudio | Usados por creación, ventanas internas y estudio; NO son eliminables todavía |
| GET /explainer/design-groups | Servicio de catálogo o puerto de diseños de creación | También selector de creación; migrar ese uso antes de retirar |
| presentation/api/catalog_studio.py y presenter legacy con catalog_item | Presentador propio del estudio | Puente explícito: aún reutiliza DTO de estudios existentes y sus operaciones |
| Lecturas/escrituras legacy de core/categories y consumidores directos de niches.json | Puerto de categorías de cada módulo | Migración posterior de comandos, locks, invalidación e integridad; NO afirmar que DATA_BACKEND ya las migra |
| Excepciones públicas antiguas de proxy para archivos/listas | Transporte catalog/media | Auditar otras páginas y enlaces existentes antes de cerrar rutas; no abrir carpetas del perfil |

Ningún endpoint de producción, publicación, creación, sandbox, biblioteca o render cambia de contrato.
Las ventanas por categoría siguen accesibles con sus herramientas actuales. El estudio común se obtiene
al abrir, no por cada miniatura. Los detalles de demos del repositorio no agregan automáticamente
publicaciones privadas ni paquetes del perfil al catálogo.

Para cada eliminación registrar: archivo/símbolo, motivo, reemplazo, `rg` de consumidores,
pruebas ejecutadas y aprobación de revisión. No retirar código solo porque una pantalla dejó de usarlo.

## Validación y cambio de proveedor

- Contratos de repositorio en memoria y filesystem: mismos filtros, IDs únicos y páginas.
- Demos públicas vs privadas, archivos de perfil, traversal y symlinks: denegación verificable.
- Engine + MP4, ETag y Range; miniaturas sin motor montado antes del clic.
- Visitante sin sesión: catálogo/medios accesibles, detalle y estudio denegados.
- Usuario con acceso: modal, sidebar y acciones existentes; ninguna grabación automática.
- Medir procesos/memoria antes y después de abrir/cerrar; comprobar que desaparecen iframe/video.

Un adaptador nuevo necesita migración y las mismas pruebas, además de coherencia de IDs/referencias.
Cambiar metadatos de BD no mueve los medios. La selección del proveedor se hace en la factoría;
la continuidad durante un despliegue exige su propio plan de migración y reversión.

# Biblioteca: consulta paginada y límites de almacenamiento

`GET /api/v1/biblioteca` es la lectura de contenido terminado y grabaciones
activas. El navegador accede por `GET /api/biblioteca`, que reenvía la identidad
de Auth.js y el token interno mediante el proxy de sesión compartido.
Crear video, publicar, eliminar y abrir detalles conservan sus flujos existentes.
No se incluye un chat ni una API de conversación.

Parámetros: `media=videos|images`, `q` (hasta 200 caracteres), `category` (ID
principal del catálogo), `status=all|pending|published|processing|failed`,
`sort=newest|oldest|longest|title`, `page` (desde 1). La página contiene hasta
20 elementos. `longest` se ofrece para videos. La respuesta incluye `items`,
`total`, `page`, `page_size`, `unfiltered_total`, `categories`, `status_counts`
y `has_active_jobs`. Una página fuera del rango se ajusta a la última existente.

El servidor aplica búsqueda y categoría antes de contar estados, y el estado
antes de ordenar y paginar. Los contadores de categoría siguen la búsqueda y los
de estado siguen búsqueda + categoría. Los empates tienen ID como segundo orden.
Los nichos y diseños se resuelven al dueño principal del catálogo. Un ID antiguo
sin correspondencia aparece en «Sin categoría»; no se convierte en una categoría
inventada ni se modifica el registro histórico.

## Fronteras

- Interfaz → `BibliotecaPort` → `httpBibliotecaAdapter` → proxy autenticado.
- Router → `BibliotecaService` → `LibraryQueryPort` → adaptador de consultas.
- `StoredLibraryQueries` utiliza el `DataStore` existente para jobs, historial y
  cola, y `PublicationLibrarySourcePort` para publicaciones; no lee rutas JSON
  desde el dominio ni crea una segunda copia de los datos.
- Las imágenes se reducen a su última revisión antes de comprobar la misma
  política de categoría/cuentas del editor. Los conteos excluyen los registros
  no autorizados. Los DTO de tarjetas omiten archivos, credenciales y cuerpos
  completos de publicaciones. Las grabaciones mantienen su proyección existente.

## Cambiar de base de datos

El almacenamiento JSON actual necesita recorrer registros para buscar y calcular
conteos exactos. Ese límite queda dentro del adaptador: la paginación HTTP evita
transferir toda la colección, pero no convierte JSON en un índice SQL.

Un proveedor SQL puede implementar `LibraryQueryPort.query` con filtros, conteos,
orden y límite en la base. Se registra mediante
`register_provider("library_queries", DATA_BACKEND, builder)` en la factoría;
si registros o publicaciones usan un backend distinto de JSON, la factoría exige
ese proveedor de consulta en lugar de degradar silenciosamente a un escaneo.
El builder recibe `recordings` y `image_visible`; debe preservar autorización,
revisión más reciente, agregaciones y el contrato de 20 elementos. Migrar datos e
índices es una operación separada; no se hace desde una solicitud de Biblioteca.
La prueba `test_service_accepts_an_alternative_query_provider_without_storage_knowledge`
comprueba la sustitución del proveedor sin cambiar servicio, API o interfaz.

## Coste y actualización

El adaptador local lee cada colección una vez por consulta, sin ventanas
arbitrarias de 100 videos o 200 publicaciones de cola. Solo enriquece los tiempos
históricos de la página visible con un único recorrido del historial. El perfil
v3 obtiene las publicaciones mediante una lectura de sección, evitando una
lectura del JSON completo por cada imagen. No inspecciona ni renderiza medios.

La interfaz descarga una página, cancela consultas obsoletas y escucha eventos
existentes de publicación/eliminación. Sondea cada 10 segundos solamente si el
servidor informa trabajo activo; React Query libera ese intervalo al desmontar.
Las claves conservan el prefijo `jobs` para la invalidación existente; las acciones
de imágenes también invalidan la consulta de Biblioteca.

## Verificación

`tests/unit/test_biblioteca_query.py` cubre más de 100 elementos, paginación,
categorías reales, cola de más de 200 entradas, permisos, revisiones, orden,
tiempo histórico y contrato HTTP. Las pruebas web de `image-library.test.tsx`
cubren página de 20, filtros, orden, cambio de medio y el modal de imagen existente.

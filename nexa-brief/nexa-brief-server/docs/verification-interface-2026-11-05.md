# Revisión de Showcase y Biblioteca — 2026-11-05

Showcase recupera la cuadrícula de componentes, selección directa de Producción / Sandbox y botones de diseño. Conserva el contrato estándar de diseños y catálogo, búsqueda, etiquetas, formatos, promoción y episodios. Las vistas del kit usan reloj sintético y reciben las órdenes de reproducción; los motores independientes conservan su protocolo de inicio. Solo se montan los iframes cercanos a la zona visible y se suspenden al abrir un detalle.

Biblioteca incorpora Videos / Imágenes junto a Crear video. Las imágenes usan el servicio existente de publicaciones, recorren su paginación y abren PublishedPostModal por post_id. Las tarjetas muestran portada completa, categoría, estado, título, número de láminas y formato. El filtro por categoría conserva las restricciones de acceso del servidor. El detalle por post resuelve también la URL firmada de su reel y reconoce duration_sec y los mensajes de error de publicación actuales y heredados.

## Validación

- Suite web final: 226 pruebas en 39 archivos; TypeScript sin errores.
- Backend: 7 pruebas de Showcase, incluido el reloj sintético en perfiles v1/v2/v3.
- Después del ajuste de portada: 9 pruebas dirigidas de Biblioteca. El contrato del detalle de reel está cubierto por dos pruebas nuevas; los 14 casos dirigidos de detalle y publicación pasan.
- Biome check pasa en los componentes, pruebas y traducciones modificados de esta entrega; el servicio de imágenes conserva su formato heredado y pasa Biome lint. Una comprobación ampliada detectó formato previo en ExplainerRecordingCard y VideoCard, que esta entrega no modifica.
- Chromium, Showcase: componentes React y CSS reales contra la API de desarrollo mediante un túnel local. Selección directa, catálogo, modal, cambio de formato y reproducción/pausa del kit; escritorio y móvil sin errores JavaScript ni desbordamiento horizontal.
- Chromium, Biblioteca: componentes y CSS reales con API, navegación y eventos simulados. Tarjetas de imágenes y videos, modal de detalle, estados vacío/error/reintento, escritorio y móvil sin desbordamiento. El error HTTP 500 de ese ensayo fue inducido deliberadamente.

Las capturas temporales se guardaron fuera del repositorio, en /tmp. Estos ensayos comprueban los flujos descritos; no demuestran fidelidad visual de cada componente ni sustituyen la revisión de una sesión autenticada en el navegador del usuario. No se invocaron modelos, publicación social, promoción real ni grabación de producciones. Esta entrega no migra ni activa perfiles, y no cambia autenticación, credenciales ni Supabase.

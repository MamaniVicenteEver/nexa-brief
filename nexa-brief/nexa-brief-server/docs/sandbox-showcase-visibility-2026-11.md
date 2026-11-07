# Proyectos de Sandbox y selección de componentes — 6 de noviembre de 2026

Plantillas → Sandbox muestra todos los proyectos del perfil activo. Cada tarjeta
abre su video principal, sin cargar un selector ni tarjetas de componentes
individuales dentro de esa vista. Las referencias siguen en su pestaña separada.

Los diseños ya registrados conservan sus IDs, catálogos, estados y promoción.
En Profesional permanecen los tres diseños Sandbox existentes: Atlas Cinemático,
Cara a Cara y Vida en Escena. Atlas en Movimiento conserva su estado de producción.
Los episodios de un diseño registrado tampoco crean otra biblioteca duplicada.

Los proyectos restantes ofrecen «Mostrar componentes en Showcase». La elección
es explícita, persistente y reversible con «Ocultar componentes de Showcase».
«Ver en Showcase» abre directamente ese proyecto en la sección Sandbox. Mostrarlo
no mueve su carpeta ni lo convierte en una plantilla de producción.

La visibilidad se guarda mediante la colección lógica `sandbox_showcase` en la
sección `data/json/designs.json` del perfil. No se modifica `info.json`, no se copian
motores ni catálogos compartidos y no se crean carpetas `designs/` en el perfil.
Un perfil distinto empieza sin esas selecciones, aunque tenga proyectos con los
mismos nombres. La persistencia usa el puerto de datos, listo para otro proveedor.

La entrada HTTP es `/api/v1/showcase/designs/sandbox/projects` (GET). El cambio
usa PUT en `.../sandbox/projects/<categoría>/<proyecto>`, con cuerpo
`{"visible": true}` o `{"visible": false}` y la misma autenticación interna que
las operaciones de promoción. La web envía el cambio a su ruta del mismo origen
`/api/showcase/designs/sandbox/projects/<categoría>/<proyecto>`. El proxy compartido
valida la sesión y agrega la autorización interna exclusivamente en el servidor;
no entrega credenciales al navegador. Router → servicio Showcase → adaptador de proyectos
→ puerto de datos conserva las responsabilidades de cada capa.

Solo se consulta el sandbox del perfil activo, sin seguir enlaces simbólicos ni
buscar episodios de otro perfil. Los IDs derivados incluyen la categoría para
evitar colisiones entre proyectos con el mismo nombre. Showcase resuelve solo
los proyectos seleccionados; sus vistas previas no recorren todo el sandbox.

Para componentes nuevos, declara `info.json.catalog` con componentes y galería,
según el contrato existente. También se aceptan las declaraciones
`info.json.components` como contratos de datos cuando no tienen una galería.
Un proyecto sin componentes individuales puede marcarse para aparecer, pero
Showcase indica expresamente que están pendientes de declarar: no se inventan
piezas ni se presenta el video completo como si fuera un componente individual.
Al agregar el catálogo, la misma selección e identidad continúan vigentes.

Las pruebas de activación y desactivación usan perfiles temporales. No activar
proyectos reales para probar la interfaz ni modificar los tres diseños existentes.

# Arquitectura y plan: showcase React del explainer-kit

Fecha: 2026-11-01. Diseño sobre el checkout actual, incluidos cambios locales preexistentes; no es implementación. Fuentes: `BRIEF-sc-comun.md`, los dos `RESULT-sc-estudio-actual*.md` y `RESULT-sc-estudio-web.md` en `~/codex/nexa-brief/`, contrastados con el código. Los conteos son instantáneas, no contratos.

## Decisiones y límites

- Feature `showcase` en `nexa-brief-web/src/features/showcase/`; página `src/app/[locale]/(admin)/showcase/page.tsx`, URL española `/showcase` y `/en/showcase` por la configuración actual. Agregar enlace «Showcase» en navegación admin. La página nueva exige sesión por el layout admin; el índice antiguo y GET públicos del kit siguen accesibles sin sesión. Se acepta esa diferencia durante la convivencia; no modificar auth, túnel ni proxy para ocultarla.
- React es dueño de pestañas, preferencias, búsqueda, tarjetas, presentación de parámetros/ejemplos, visibilidad, modal, copia y controles. Sin emojis; textos de UI en español incluso bajo locale `en`. Usar namespace independiente en ambos catálogos next-intl, con el mismo contenido español por requisito vigente.
- `showcase/stage.html` sigue siendo el motor de catálogo, preview y player, servido en su URL original bajo `/api/v1/explainer/files/_tools/explainer-kit/`; conserva scripts, fuentes y rutas relativas. `image-stage.html` y `icons.html` siguen siendo herramientas auxiliares existentes, sin UI inventada; no migrar `engine/`, `designs/` ni sus contratos. `icons.html` tiene rutas obsoletas: no prometer su funcionamiento ni repararlo en este feature.
- Mantener `showcase/index.html` intacto mientras se implementa y valida. Tras paridad y confirmar consumidores, proponer redirección de esa URL antigua a `/showcase` en la capa HTTP que atienda cada origen, sin afectar `stage.html` ni vecinos. El cambio público→login y acceso directo al backend son cambios de contrato: no activar redirección hasta acordar acceso y comprobar ambos caminos; hasta entonces conservar el índice. No incluir ese corte en los WP de paridad.
- Acceso de datos por interfaz propia; `stage.html` es una implementación, no un detalle conocido por los componentes. Dependencias hacia dominio/contratos, adaptadores hacia contratos, hooks hacia interfaz y componentes hacia props/hooks; ningún import de otro feature. Usar primitivas `shared` y QueryClient existente; estado efímero local, sin store global.
- Preservar semántica de búsqueda: minúsculas, subcadena sin trim ni normalizar tildes, sobre nombre/resumen/tags/video. Conservar `kit.design` y `kit.orient`, pero validar valores y tolerar storage inaccesible. Búsqueda sobre biblioteca usa metadata disponible, no promete tags que solo llegan al modal. Fallback de IntersectionObserver: montar preview inmediatamente si la API no existe.
- Nuevos diseños se descubren desde `designs/index.json` y sus `design.json`, no por una lista en React. Nuevo componente/param se representa por datos y tipos abiertos. Nuevos formatos requieren un módulo de preset en `lib/formats.ts`, no cambios transversales; formatos de paridad 9:16 y 16:9. No añadir una UI de filtros o formatos que no existe hoy.

## Evidencia y discrepancias resueltas

- `showcase/index.html:104-110,128-139,200-212` usa índice de diseños, biblioteca y catálogo vivo por iframe, pese al comentario que dice `catalog.json`. `stage.html:42-53` usa otra lista, `showcase/designs.json`, para `list=1`; son registros distintos. No sustituir catálogo vivo por el JSON generado.
- Los estudios difieren en amplitud de `options`: `engine/kit.js:81-85` copia el valor sin validar; representar valores JSON heterogéneos y `null`, no limitar a `string[]`. `type`, `layer` y metadata son extensibles. Validar la envoltura y señalar error recuperable ante datos malformados, sin descartar tipos nuevos.
- La biblioteca no contiene necesariamente tags/capa/ejemplo: `index.html:179-185,201-205` fusiona metadata viva solo para el modal, no para tarjeta ni búsqueda. Conservar origen y claves de biblioteca al fusionar. `component_library.py:53-67`: refresh v3 sin video no redescubre altas/bajas; no tratar biblioteca como inventario infalible.
- Ambos estudios son complementarios: el primero es estático; el segundo documenta recorrido parcial de Chromium y advierte un posible `ready` duplicado. En el modo sintético usado aquí, `player.js:41-104` retorna antes de su emisor de `ready` no sintético (`player.js:194-203`); `stage.html:88-91` emite el `ready` observado. El receptor igual debe tolerar duplicados. Ninguno demuestra paridad visual exhaustiva ni exportación completa. El plan exige ambas verificaciones donde corresponda.
- Prefijo de nombre de componente de video se usa hoy como ID de diseño (`index.html:210`); en el checkout los `family` coinciden con ID, pero no es contrato garantizado. Resolver ID exacto primero; si no existe, única coincidencia `family`; si falta o es ambigua mostrar error de esa entrada, nunca seleccionar un diseño arbitrario.

## Árbol propuesto y responsabilidades

Rutas relativas a `nexa-brief-web/`. Árbol completo de producción del feature; tests listados junto a sus dueños. Una línea por archivo.

```text
src/features/showcase/
  index.ts                            # exporta solo ShowcaseView para la página
  types.ts                            # modelos de dominio y estados compartidos del feature
  api/showcase-repository.ts          # interfaz de datos e inyección del repositorio
  api/kit-showcase-repository.ts      # fetch, validación, catálogo vivo e implementación del puerto
  api/kit-stage-transport.ts          # iframe efímero de catálogo, mensajes, timeout y limpieza
  lib/kit-urls.ts                     # origen relativo, URLs y scripts comunes y de video validados
  lib/filters.ts                      # selección, orden estable y búsqueda puras
  lib/formats.ts                      # presets y proporciones, abiertos a agregar formatos
  lib/messages.ts                     # decodifica mensajes de stage y crea comandos tipados
  lib/clipboard.ts                    # copia segura y fallback con selección manual
  hooks/useShowcaseData.ts            # queries de índice, biblioteca y catálogo activo
  hooks/useShowcaseState.ts           # selección, búsqueda, formato y persistencia local
  hooks/useLazyStage.ts               # observer, montaje diferido y replay por tarjeta
  hooks/useStagePlayer.ts             # handshake, estado, metadata y comandos de un iframe modal
  hooks/useShowcaseModal.ts           # apertura/cierre, componente activo y formato modal
  components/ShowcaseView.tsx         # contenedor: conecta repositorio, hooks y vistas
  components/ShowcaseToolbar.tsx      # pestañas, búsqueda, contador y formato por props
  components/ShowcaseGrid.tsx         # estados y listado estable de tarjetas por props
  components/ComponentCard.tsx       # vista de metadata y acciones de tarjeta por props
  components/StagePreview.tsx        # contenedor de un iframe perezoso y replay
  components/ComponentDetails.tsx    # parámetros, etiquetas y ejemplo reutilizables por props
  components/ShowcaseModal.tsx       # contenedor accesible del diálogo y del player
  components/StagePlayer.tsx         # vista de iframe y controles por props, sin protocolo propio
  __tests__/repository.test.ts       # adaptador, cancelación, URL y catálogo
  __tests__/domain.test.ts           # filtros, identidad, formatos, serialización y validación
  __tests__/player.test.ts           # protocolo, aislamiento, duplicados y cierre
  __tests__/showcase.browser.spec.ts # paridad y regresión mediante navegador real
```

Integración fuera del feature: `src/app/[locale]/(admin)/showcase/page.tsx` monta la vista; `src/shared/components/layout/AdminHeader.tsx` agrega enlace/activo; `messages/es/showcase.json` y `messages/en/showcase.json` contienen textos; `src/i18n/request.ts` registra `showcase`. No mover estilos de dominio a globales. Los tests browser requieren runner explícito en WP4: no existe hoy un script de test general.

## Dominio y contratos

Referencias TS conceptuales; propiedades opcionales reflejan ausencia real, no un esquema cerrado. DTOs de red permanecen privados en el adaptador y se validan antes del mapeo.

```ts
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Param = { type: string; default?: Json; doc?: string; required?: boolean;
  options?: Json[] | null; min?: number | null; max?: number | null };
type Design = { id: string; family: string; name: string; tagline: string; scripts: string[] };
type Component = { name: string; summary?: string; layer?: string; tags?: string[];
  params: Record<string, Param>; example?: Record<string, Json> | null };
type Source = { video: string; source: string | null; sheet?: string;
  sheetExists?: boolean; sourceSheet?: string; sourceSha256?: string | null };
type Item = { key: string; designId: string | null; component: Component; source?: Source;
  unavailableReason?: string }; // diseño desconocido o fuente inválida: tarjeta con error, sin preview
type Selection = { kind: 'design'; id: string } | { kind: 'videos' };
type FormatId = string; // presets activos: '9x16' y '16x9'; validar contra registry

type CatalogContext = { designs: Design[] }; // orden y scripts comunes también son dependencias
interface ShowcaseRepository {
  getDesigns(signal?: AbortSignal): Promise<Design[]>;
  getLibrary(designs: Design[], signal?: AbortSignal): Promise<Item[]>;
  getCatalog(designId: string, context: CatalogContext, signal?: AbortSignal): Promise<Item[]>;
  previewUrl(item: Item, context: CatalogContext, mode: 'card' | 'modal'): string;
}
```

`key`: diseño = `design:<id>:<name>`; video = `video:<video>:<source-or-empty>:<name>` mediante serialización inequívoca de tupla, sin colisiones por separadores. Si hubiera duplicados exactos, informar dato duplicado y usar índice estable de origen como discriminador, sin colapsarlos. Prefijos `common.*` se ordenan al final con orden relativo conservado; propia familia primero. `source` y `video` permanecen en `Item` al recibir metadata. `previewUrl` no hace fetch; falla con error tipado si `designId` es null o la entrada es inválida; la tarjeta conserva su metadata y ofrece diagnóstico.

### Adaptador, query keys y ciclo de vida

- `getDesigns`: `GET designs/index.json` y cada `design.json` en orden de índice, `no-cache`, comprobar HTTP, forma y IDs; deduplicar unión ordenada de `designs/common/` y agregar a stage únicamente scripts ausentes del diseño. Los errores de un diseño se informan con reintento; `getLibrary` es query separada y su error no bloquea las pestañas de diseño.
- `getLibrary`: `GET component-library.json`, validar rutas relativas a templates y mapear cada entrada. Conservar y mostrar error por entrada si falta diseño o source; no ejecutar `source` arbitrario. Admitir solamente rutas de archivos esperadas, relativas, sin `..`, esquema, query ni fragmento, segmentos vacíos/ocultos o separadores codificados; construir y codificar por segmentos. Aplicar restricciones equivalentes a scripts comunes leídos de diseños. En caso de rutas válidas pero protegidas, mostrar error: no relajar auth.
- `getCatalog`: iframe oculto `stage.html?d=<id>&catalog=1` más `js` comunes faltantes en orden; escuchar antes de insertar, aceptar solo `origin === window.location.origin`, `source === frame.contentWindow`, tipo, `design` solicitado y payload válido. Timeout 30 s, abort y cualquier resolución eliminan listener, timer e iframe; falla/abort no queda cacheado como éxito. Las consultas compartidas dependen de la cancelación del QueryClient, no de desmontar arbitrariamente un consumidor individual.
- `previewUrl`: base relativa fija del proxy Next, no `NEXT_PUBLIC_API_URL`; `URLSearchParams` para `d`, `c`, `solo`, `dur=6`, `gallery`, `js` comunes y `../../../<source>` validado si existe. Modal agrega `controls=1&clock=synthetic`; no `p` para conservar demos. Nunca interpolar rutas sin validar. El servidor valida contención adicionalmente.
- Claves exportadas por `useShowcaseData.ts`: `['showcase','designs']`, `['showcase','library', fingerprintDiseños]`, `['showcase','catalog', designId, fingerprintScripts]`. Fingerprint determinista de IDs/familias/scripts en orden; si cambia la fuente, cambiar también la identidad del repositorio en las claves o invalidar el prefijo. React Query deduplica; `signal` se propaga, reintento manual por query, y el cambio de selección no presenta resultados de otra clave. Sin caché adicional de promesas que conserve rechazos.
- GET del kit y categorías públicas pasa sin sesión por proxy, pero Next necesita credencial interna configurada; `sandbox` y `referencias` requieren sesión. Revisar en ejecución ETag/304, política de framing efectiva, fuentes externas y disponibilidad de archivos; no exponer credenciales ni cambiar políticas. Comunicación usa siempre el origen de la página, no `*`.

### Hooks y componentes

```ts
function useShowcaseData(repo: ShowcaseRepository, selection: Selection): {
  designs: QueryResult<Design[]>; library: QueryResult<Item[]>;
  catalog: QueryResult<Item[]>; items: Item[]; retryActive(): void;
}; // QueryResult expone data, isPending, error y refetch; queries condicionales
function useShowcaseState(designs: Design[]): {
  selection: Selection; setSelection(v: Selection): void; query: string; setQuery(v: string): void;
  format: FormatId; setFormat(v: FormatId): void;
};
function useLazyStage(src: string): {
  hostRef: RefCallback<HTMLElement>; shouldMount: boolean; replayKey: number; replay(): void;
};
function useShowcaseModal(): {
  active: Item | null; open(item: Item): void; close(): void;
  format: FormatId; setFormat(v: FormatId): void;
};
function useStagePlayer(frameRef: RefObject<HTMLIFrameElement | null>, item: Item,
  onClose: () => void): { status: 'loading' | 'playing' | 'paused' | 'ended' | 'error';
  component: Component; playPause(): void; replay(): void; retry(): void };
```

El proveedor concreto se instancia una vez en `ShowcaseView`; los hooks aceptan un puerto inyectable para pruebas. `useShowcaseData` expone los estados de cada query sin disfrazar error como vacío; consulta biblioteca solo en videos y catálogo solo para diseño activo. No leer `localStorage` durante SSR: hidratar al montar, aplicar fallback y guardar solo después de restaurar. `useLazyStage` observa con margen 200 px, monta al entrar y conserva iframe hasta desmontaje; replay monta si falta o cambia key para recargar. Desconectar observer al desmontar o cambiar URL; sin `IntersectionObserver`, montar inmediatamente.

El modal abre en 16:9 independientemente de la grilla, enfoca cerrar y restaura foco al disparador si sigue conectado. Cerrar por botón, backdrop, Escape local o `kit-stage-close`; desmontar iframe, listeners y timers. `useStagePlayer` acepta solo mensajes válidos del origen y `contentWindow` del iframe activo; ignora mensajes tardíos de una apertura anterior. Gestiona `kit-stage-component`, `nexa-template-ready`, `state`, `time`, `ended`, `kit-stage-close`; `ready` duplicado es idempotente, no confundir `load` con listo. Tras `ended`, seek a `max(0, duration - 0.04)` y pausar, usando duración reportada y fallback 6; reanudar desde fin busca 0. Enviar `nexa-template-playback`/`nexa-template-seek` al origen exacto; timeout de ready con reintento y feedback. Cambiar formato modal solo cambia tamaño, no recarga. El player del iframe acepta comandos sin validar emisor: esta capa valida entradas propias, no corrige esa deuda interna.

```ts
type ToolbarProps = { designs: Design[]; selection: Selection; onSelect(v: Selection): void;
  query: string; onQuery(v: string): void; format: FormatId; onFormat(v: FormatId): void; count: number };
type GridProps = { items: Item[]; format: FormatId; state: 'loading'|'error'|'empty'|'ready';
  error?: string; onRetry(): void; onOpen(item: Item): void; context: CatalogContext; repo: ShowcaseRepository };
type CardProps = { item: Item; preview: ReactNode; onOpen(): void };
type PreviewProps = { src: string; title: string; format: FormatId };
type DetailsProps = { component: Component; source?: Source; mode: 'card'|'modal' };
type ModalProps = { item: Item | null; context: CatalogContext; repo: ShowcaseRepository;
  format: FormatId; onFormat(v: FormatId): void; onClose(): void };
type PlayerProps = { frameRef: RefObject<HTMLIFrameElement | null>; src: string; title: string;
  status: 'loading'|'playing'|'paused'|'ended'|'error'; onPlayPause(): void; onReplay(): void; onRetry(): void };
```

Toolbar, Grid, Card, Details y Player son presentacionales; Grid recibe repo/context solo para pasarlos a `StagePreview` (o recibir una fábrica de preview inyectada), sin invocar acceso a datos. View, Preview y Modal son contenedores. `ComponentDetails` presenta parámetros, tipos, opciones, requeridos, defaults y docs; ejemplo `{at:'palabras ancla',use:name,params:example ?? {}}` seleccionable. Modal agrega copia `navigator.clipboard` en contexto seguro y fallback textarea; anunciar éxito/error por `role=status`. Texto React escapado por defecto; no HTML de catálogo sin sanear. Usar tabs/botones accesibles, título de iframe, labels, diálogo y foco de primitivas existentes.

## Paquetes de trabajo paralelos

Antes de ola 1, el integrador congela las firmas de este documento, convención de errores y fixtures; WP4 prepara Vitest, Playwright y sus configuraciones en ola 0; cada agente trabaja en su conjunto exclusivo, sin editar archivos de otro WP. Ante cambio de contrato, proponerlo al integrador; no editar simultáneamente el contrato. Las rutas `src/...` siguientes son relativas a `nexa-brief-web/`; rutas abreviadas `api/`, `lib/`, `hooks/`, `components/` y `__tests__/` cuelgan de `src/features/showcase/`. Leer `node_modules/next/dist/docs/` pertinente antes de escribir código Next, como exige `nexa-brief-web/AGENTS.md`. Ningún WP toca motor, diseños ni índice antiguo.

**Ola 0 — WP0, contratos e integración (agente 1).** Posee `src/features/showcase/types.ts`, `api/showcase-repository.ts`, `index.ts`, `src/app/[locale]/(admin)/showcase/page.tsx`, `src/shared/components/layout/AdminHeader.tsx`, `messages/{es,en}/showcase.json`, `src/i18n/request.ts`. Entrega primero tipos/interfaz estables y fixtures contractuales documentados para las otras olas; luego conecta página/barrel y traducciones. Depende de WP1–3 para integración final. Aceptación: ruta con sesión, enlace activo y namespace cargado en ambos locales, sin imports de otros features. Validar con `pnpm lint` y `pnpm exec tsc --noEmit --incremental false` desde web.

**Ola 1 — WP1, datos (agente 2).** Posee `api/kit-showcase-repository.ts`, `api/kit-stage-transport.ts`, `lib/kit-urls.ts`, `hooks/useShowcaseData.ts`, `__tests__/repository.test.ts`. Depende de contratos WP0; no modifica UI. Aceptación: índice ordenado, comunes, biblioteca, catálogo vivo por diseño, rutas y mensajes validados, error/reintento/cancelación sin fugas; datos alternativos inyectables. Validar con `pnpm exec vitest run src/features/showcase/__tests__/repository.test.ts`, lint y TS de WP0; además `pnpm exec playwright test src/features/showcase/__tests__/showcase.browser.spec.ts --grep "catálogo|abort"`.

**Ola 1 — WP2, grilla (agente 3).** Posee `lib/filters.ts`, `lib/formats.ts`, `hooks/useShowcaseState.ts`, `hooks/useLazyStage.ts`, `components/ShowcaseToolbar.tsx`, `ShowcaseGrid.tsx`, `ComponentCard.tsx`, `StagePreview.tsx`, `ComponentDetails.tsx`, `__tests__/domain.test.ts`. Depende solo de contratos WP0; usar repositorio fake mientras WP1 trabaja. Aceptación: filtro/orden/persistencia, estados y formatos, metadata completa, lazy/replay y accesibilidad básica sin recargas masivas. Validar con `pnpm exec vitest run src/features/showcase/__tests__/domain.test.ts`, lint y TS; `pnpm exec playwright test src/features/showcase/__tests__/showcase.browser.spec.ts --grep grilla` comprueba común, propio y video.

**Ola 1 — WP3, modal y player (agente 4).** Posee `lib/messages.ts`, `lib/clipboard.ts`, `hooks/useStagePlayer.ts`, `hooks/useShowcaseModal.ts`, `components/ShowcaseModal.tsx`, `StagePlayer.tsx`, `__tests__/player.test.ts`. Depende de contratos WP0; usa `ComponentDetails` de WP2 mediante props acordadas, o stub durante desarrollo. Aceptación: handshake idempotente, metadata/foco/copia, play/pause/replay/fin y cierre, limpieza y rechazo de mensajes ajenos. Validar con `pnpm exec vitest run src/features/showcase/__tests__/player.test.ts`, lint/TS y `pnpm exec playwright test src/features/showcase/__tests__/showcase.browser.spec.ts --grep modal` con stage real.

**Olas 0 y 2 — WP4, infraestructura de pruebas, composición y verificación (agente 1).** Posee `components/ShowcaseView.tsx`, `__tests__/showcase.browser.spec.ts` y, si hace falta infraestructura nueva de test, archivos de configuración/dependencias de test del web (`package.json`, lockfile y configuración del runner), exclusivamente este WP. En ola 0 configura Vitest y Playwright y comunica fixtures y comandos; en ola 2 depende de WP1–3 e integra sin editar archivos ajenos: devuelve defectos al dueño. Instalar explícitamente dependencias y navegador en el entorno de pruebas; no asumir Playwright instalado. Aceptación: checklist completo, no-regresión, errores y accesibilidad registrados con evidencia; validación de stage/list/image-stage sin regeneradores ni modificaciones del motor. Si no se dispone del runner, registrar bloqueo y ejecutar pruebas manuales reproducibles, sin declarar suite automatizada aprobada.

Comandos de WP4 desde `nexa-brief-web/`: `pnpm lint`; `pnpm exec tsc --noEmit --incremental false`; `pnpm build` con configuración habitual disponible; `pnpm exec node --test src/features/image-posts/__tests__/*.test.mjs`. Ejecutar además `pnpm exec vitest run src/features/showcase/__tests__` y `pnpm exec playwright test src/features/showcase/__tests__/showcase.browser.spec.ts`, con servidor de pruebas aislado y fixtures. Los checks browser específicos de WP1–3 se ejecutan en ola 2 una vez que WP4 entregue esa suite; las pruebas unitarias se ejecutan en ola 1. Configurar Vitest para excluir los archivos Playwright. `pnpm format` y `pnpm check` modifican archivos: no usarlos como verificación de solo lectura. No ejecutar `kit.py catalog`, `library`, renders ni generadores sobre checkout productivo.

## Paridad y no regresión: criterios de salida

Registrar entorno, versión/fecha, datos, comandos y resultado; comparar índice viejo y React sobre el mismo checkout, sin fijar conteos de componentes ni confiar solo en snapshots.

- [ ] Pestañas en orden de índice, nombre/ID y videos; comunes después de propios, orden estable e identidades duplicadas conservadas. Probar diseño nuevo por fixture, sin hardcodear lista.
- [ ] Restaurar/guardar diseño y orientación, defaults y storage inaccesible/inválido; búsqueda y formato se mantienen entre pestañas; subcadenas, acentos, espacios, resumen/tags/origen, contador, vacío y carga/error/reintento.
- [ ] Biblioteca con varias fuentes, metadata incompleta y fuente nula/protegida; merge del modal preserva origen y no finge enriquecer la búsqueda. Comparar campos, params JSON heterogéneos y ejemplo desplegable.
- [ ] Grilla responsive 9:16/16:9, cabecera y modal utilizables en móvil; iframes solo cerca de pantalla, ejecución de 6 s, último cuadro y replay antes/después del montaje. Probar componente común, propio, overlay, imagen y video, con recursos de muestra y fuentes.
- [ ] Modal abre siempre desktop, alterna móvil sin recargar, muestra metadatos reales, ejemplo y copia con fallback; play/pause, reanudación, replay y fin; mensajes ready duplicados/tardíos y frame/origen incorrectos no alteran sesión vigente.
- [ ] Cierre por botón/backdrop/Escape del padre y del iframe, foco inicial y retorno, controles etiquetados, navegación teclado, estados anunciados y título iframe. Cerrar durante carga y cambiar pestañas rápidamente sin listeners, timers ni resultados obsoletos.
- [ ] Errores independientes: índice, un design, biblioteca, catálogo timeout, source 401/404, script o recurso ausente, iframe sin ready; recuperación explícita. Verificar que fallo silencioso de script del stage no se reporte como preview exitoso sin evidencia.
- [ ] Con servidor/proxy real: ruta admin con y sin sesión, índice viejo público, GET públicos de kit y categoría, source sandbox protegido, token interno ausente configurado sin imprimirlo, ETag/304 y rutas relativas; probar origen/túnel efectivo y headers de framing. Sin cambiar reglas de acceso.
- [ ] Mantener `stage?catalog`, `stage?list=1`, `KitReady`, `__catalog`, `__promo`, `ImageStageReady` y `ImageStage.render/qc/setProgress`; ejecutar smoke de exportación de imagen/reel en entorno aislado con fixtures si está disponible. `icons.html` se comprueba como auxiliar existente con deuda conocida, no como funcionalidad nueva.
- [ ] Smoke de login, navegación admin, plantillas, sandbox, explainer e image-posts; lint, TypeScript, build y tests existentes. Comparar HTTP/errores antes y después y verificar que no cambió el motor ni los archivos ajenos al feature.

## Riesgos y mitigación

- **Origen y acceso:** abrir backend directamente, CORS o framing del proxy externo puede impedir iframe; usar ruta relativa Next y probar headers efectivos. La redirección posterior cambia acceso público a login: decisión explícita antes de activarla.
- **JS cargado por stage:** fuente de biblioteca ejecuta scripts y player acepta mensajes de cualquier emisor; validar rutas, origen, fuente y forma, conservar controles de backend y registrar deuda del player para otro encargo. Validación de React no aísla ejecución del iframe.
- **Catálogo y datos cambian:** listas duplicadas, source viejo o scripts fallidos pueden producir catálogo parcial; fingerprints, errores por entrada, reintento y comparación contra stage real. `stage` tolera fallo de script: detectar metadata ausente y no afirmar éxito por `load`.
- **Costo y carreras:** muchos iframes y motor animado pueden consumir CPU aun pausado; lazy, desmontaje al cerrar, limpieza, medir scroll prolongado y limitar carga concurrente si evidencia lo requiere, sin ocultar previews visibles.
- **Paridad incompleta:** estudios tienen cobertura visual parcial e iconos con deuda; checklist con navegador, fixtures representativos y smoke exportador. Muestras sin seguimiento o fuentes remotas pueden faltar en despliegue: verificar empaquetado y créditos antes del corte.
- **Conflictos de integración:** contratos congelados, dueños exclusivos y correcciones por propietario; WP4 registra pendientes en vez de atribuir éxito a tests inexistentes. Mantener cambios locales preexistentes y no ejecutar generadores que los sobrescriban.

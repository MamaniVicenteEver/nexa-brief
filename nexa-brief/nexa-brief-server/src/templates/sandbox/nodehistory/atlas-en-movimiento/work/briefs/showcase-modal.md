# Brief · showcase-modal (Sol 6.1 high) — cada tarjeta abre un modal

## Pedido del usuario (literal): «que cada card tenga su modal»
En `/showcase`, para el prototipo «Atlas en Movimiento» (pestañas Prototipo, Biblioteca (86) y Sprites (69), ya implementadas en
`nexa-brief-web/src/features/showcase/components/SandboxCatalog.tsx`, `SandboxShowcase.tsx` y `lib/sandbox-catalog.ts`), **cada tarjeta debe abrir un modal** al pulsarla (o con Enter), cerrable con Esc y clic fuera.
Hay un modal ya hecho para el resto del Showcase: `components/ShowcaseModal.tsx` (+ `StagePlayer.tsx`, `StagePreview.tsx`, `ComponentDetails.tsx`). Estudia su estilo y reutiliza lo que sirva SIN romperlo.

## Permisos (importante)
Puedes y DEBES escribir en `nexa-brief-web/src/features/showcase/**` (componentes, lib y tests). Está autorizado por este brief y por el lanzador (rutas extra). No edites ningún `.py` ni nada bajo `nexa-brief-server/src/`
(uvicorn con `--reload`). No reinicies el servidor web: Next recarga en caliente. Sin dependencias nuevas, sin emojis, textos en español.

## Qué debe tener cada modal
- **Biblioteca** (componente táctico): reproductor GRANDE en vivo (iframe a `work/tactico/demo.html?only=<nombre>&loop=1&bare=1&aspect=…`, 9:16 o 16:9 según la barra), botones reiniciar/pausar si la galería lo permite (si no, recargar el iframe),
  nombre, resumen, familia, capa, estados, tabla completa de parámetros (tipo, default, doc, rango), «Usado por», y el item JSON de ejemplo (`demo`) con botón «Copiar JSON». Navegación anterior/siguiente (flechas del teclado y botones) dentro de la lista filtrada.
- **Sprites**: imagen grande con selector de estado (normal, detected, burning, wrecked) y de fondo (océano oscuro, desierto claro, cuadriculado), datos (archivo, eslora relativa, ancla, proa, variantes/librea) y las demás variantes del mismo sprite en miniaturas. Descarga del PNG opcional.
- **Prototipo** (tarjeta «Prototipo completo» y las de `components`): el reproductor grande del prototipo con los mismos controles que hoy.
- Accesibilidad: `role="dialog"`, `aria-modal`, foco atrapado y devuelto a la tarjeta, cierre con Esc, scroll del fondo bloqueado, anuncio del título. Responsive (móvil y escritorio). Máximo 1 iframe activo en el modal; al cerrar se descarga.
- El comportamiento actual de las tarjetas (botón «Reproducir» en la propia tarjeta) puede conservarse; el clic en el resto de la tarjeta abre el modal.

## Pruebas y verificación
Amplía `__tests__/sandbox-showcase.test.tsx` o crea `__tests__/sandbox-modal.test.tsx`: abrir/cerrar, Esc, navegación siguiente/anterior, estados y fondos de sprite, copiar JSON, no regresión. Corre SOLO ese archivo con `nice -n 19` (`npx vitest run <archivo>` desde `nexa-brief-web/`) y `tsc --noEmit` si es rápido.
Verificación visual: al final, UNA captura con Playwright desde `nexa-brief-server/.venv/bin/python` en `/tmp` (login por el botón «Entrar directo (solo en desarrollo)», pestaña Biblioteca, abrir un modal, esperar a que cargue; `nice -n 15`, una sola página); adjunta la ruta en el RESULT y revísala tú mismo.
Entrega: `work/results/showcase-modal.md` con archivos tocados, pruebas ejecutadas y lo no verificado.

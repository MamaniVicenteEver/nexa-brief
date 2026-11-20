# Estado de la refactorización local — 5 de noviembre de 2026

Esta revisión describe el cierre anterior de v2. La estructura solicitada
después, las verificaciones nuevas y el estado de los perfiles reales están
en [profile-layout-v3-2026-11.md](profile-layout-v3-2026-11.md).

Base: `49380b3`, publicada en `feat/nodetech-paquete-publicacion`.
Trabajo aislado: rama `codex/perfiles-datos-medios`. No se activó el layout v2
en Profesional, no se migraron sus datos, no se modificaron sus sesiones ni se
desplegó sobre los servicios en uso. Supabase todavía no está implementado.

## Implementado

El manifiesto selecciona explícitamente v1 o v2. La resolución de rutas es
común para servidor, scripts y web. Se conserva v1 sin migración implícita.
Un perfil v2 se crea vacío, con defaults del producto e instrucciones por
carpeta, sin copiar usuarios, canales, medios ni credenciales de otro perfil.

```text
<perfil>/
├── profile.json
├── AGENTS.md / CLAUDE.md
├── config/                       # defaults del producto configurables por perfil
├── data/                         # registros, documentos e índices JSON
├── logs/                         # contenido real de logs y consumo
├── productions/                  # proyectos y recursos generados
│   └── <categoría>/<video_id>/
├── renders/<video_id>/<grabación>/ # videos terminados
├── resources/                    # archivos subidos sin producción asociada
├── sandbox/                      # pruebas y referencias del perfil
└── .system/
    ├── runtime/                  # coordinación, colas técnicas y temporales
    ├── cache/                    # contenido derivado y descargado
    ├── connections/              # credenciales gestionadas por el servidor
    ├── web-data/                 # usuarios y sesiones web locales
    ├── browser-profiles/         # sesiones legacy migradas sin inspeccionar su contenido
    └── tiktok/                   # estado privado del servicio
```

Los motores permanecen en `src/templates/_tools/` del repositorio. No existe
una copia `_tools/` dentro del perfil. El dominio usa puertos para registros,
documentos, inventario y archivos; los adapters resuelven la persistencia local.
Los proveedores no instalados fallan explícitamente.

El registro de contenido relaciona videos, recursos, grabaciones y logs por ID.
La biblioteca puede servir recursos de producciones sin copiar sus bytes y
protege su borrado desde Recursos. Los archivos finales v2 se graban directamente
en renders y no se comprime automáticamente el único máster. Los auxiliares de
sandbox, promoción, miniaturas, uso y respaldos tienen rutas v2 compatibles.

NodeMotion también separa los recursos nuevos en `assets/`, los logs y los
renders. Al reanudar trabajos ya existentes conserva sus rutas anteriores.
El catálogo compartido incorpora muestras de componentes y un ejemplo largo
editable de NodeTech, separado de las producciones del perfil. Showcase y
Plantillas permiten filtrarlas y abrir su vista previa. El ejemplo largo dura
90 segundos y no tiene narración; no es una grabación final entregada.

El migrador local dispone de plan, preparación, activación y rollback, con
verificación de hashes y diario de recuperación. Reescribe referencias
reconocidas, indexa videos y grabaciones heredados e instala defaults públicos
ausentes sin sustituir personalizaciones. Las carpetas de credenciales se
renombran opacamente; solo se extrae metadata de canales validada. Este flujo
se ensayó con datos sintéticos y no se aplicó a Profesional. Las URL dinámicas
construidas por código personalizado requieren revisión. Ver
[profile-migration-local.md](profile-migration-local.md).

## Verificación

La última ejecución completa de `pytest tests/unit -q` terminó con **1552
aprobadas, 0 fallidas y 1 omitida** en 228,39 segundos, con configuración
sintética y sin credenciales reales. También pasaron tres pruebas del supervisor
de respaldos. En el worktree de entrega se repitieron **33 pruebas** de
migración, vista previa, NodeMotion, muestras y persistencia v2.

La comparación inicial con la base registró 1384 aprobadas y 52 fallidas; el
primer refactor conservó esas mismas fallas. Durante el cierre se actualizaron
fixtures dependientes de archivos locales o de contratos obsoletos y se aisló
el entorno de pruebas CLI. Se corrigió además el limitador de audio para el
FFmpeg local, con una prueba de señal. Las respuestas actuales de OAuth y sus
comprobaciones de estado firmado se conservaron; no se restauraron rutas QR
retiradas para satisfacer expectativas antiguas. El historial de resultados
está en `tests-baseline-comparison.json`.

La suite completa de la web terminó con **207 pruebas aprobadas**. Pasaron
TypeScript, Biome sobre los archivos modificados y la compilación de producción
con Webpack. Ruff no encontró errores de la familia F en los Python modificados;
no se afirma haber corregido todo el lint histórico del repositorio.

Se verificaron creación concurrente de perfiles, rechazo de cruces de perfil,
rutas, recursos con Range, índices JSON, guardias de agentes y recuperación de
migraciones. Las sesiones del navegador se mueven opacamente: las pruebas
instrumentadas rechazan lecturas y enumeración interna y comprueban el mismo
inodo tras activar y revertir. Su contenido no se valida ni debe permanecer
en uso durante la migración.

Se probaron el arranque y apagado de FastAPI, renders sintéticos reales de
Explainer y NodeMotion y una migración fresca seguida de vista previa y
grabación con Chromium y ffmpeg. Detalles y límites en
[verification-local-v2.md](verification-local-v2.md). Estas comprobaciones no
validan modelos, conexiones o publicaciones reales ni sustituyen la activación
controlada sobre el servidor en uso.

## Pendientes que impiden declarar el sistema terminado

1. **Ejecutor de agentes aislado.** V2 rechaza Codex y Claude porque todavía no
   existe un backend verificado que proteja lecturas, entorno, sockets y todas
   las herramientas manteniendo la autenticación de suscripción. Los probes de
   comandos con archivos sintéticos pasaron fuera del sandbox del editor; no
   verifican una producción real con modelo. No se habilitó un escape para
   omitir esta protección. Ver [agent-isolation-design.md](agent-isolation-design.md).
2. **Activación sobre el perfil existente.** Falta inventariar su contenido y
   propiedad real, disponer de backup independiente, detener los procesos,
   ejecutar la migración y verificar sus pantallas antes de volver a permitir
   escrituras. `data/` de un perfil v1 conserva sus archivos hasta esa operación
   explícita. La copia original del repositorio y sus medios no se elimina.
3. **Catálogo histórico.** Se agregaron muestras explícitas; no se reclasificaron
   todas las plantillas históricas ni se convirtieron producciones privadas en
   defaults compartidos. Esto requiere selección editorial por categoría.
4. **Identidad y operación.** No se implementaron membresías de varias cuentas
   por perfil ni una pantalla de alta/selección. El alta disponible es el CLI.
   Cambiar perfil exige reiniciar API, web y servicio TikTok coordinadamente.
   No se verificaron conexiones o publicaciones reales ni rendimiento de videos
   largos sobre el servidor de producción.

Supabase es la siguiente transición, después de cerrar estos puntos locales.
Las variables propuestas y los contratos necesarios están en
[future-supabase.md](future-supabase.md); no son variables activas todavía.

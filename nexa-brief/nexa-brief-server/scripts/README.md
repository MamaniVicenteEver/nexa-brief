# Scripts del servidor

Los scripts son entradas operativas; las reglas de negocio y la persistencia
permanecen en los servicios y adapters. Ejecutar desde la raíz del servidor.

| Script | Uso |
| --- | --- |
| `youtube_auth_once.py --alias canal_1` | Autorizar YouTube y guardar tokens mediante el almacenamiento de conexiones. |
| `facebook_setup.py` | Preparar una conexión de página de Facebook. |
| `youtube_oauth_setup.py` | Configuración OAuth web heredada. |
| `tiktok_setup.py` | Preparación de TikTok; revisar su ayuda antes de usar. |
| `test_publisher_tokens.py` | Diagnóstico interactivo que puede publicar realmente; no forma parte de las pruebas aisladas. |
| `scrape_backgrounds_v3.py` | Descarga de imágenes y música para recursos. |
| `scrape_backgrounds.py` | Descargador de fondos heredado. |
| `scrape_anime.py` | Descarga de recursos de anime y arte. |
| `nexa_brief_ds_scraper.py` | Preparación de datasets. |

## Migración vigente: layout v3

Usa `migrate-profile-layout.py --local-plan`, `--local-prepare` y
`--local-activate`, con mantenimiento exclusivo y diario de recuperación.
El destino predeterminado es v3. Consulta
[`docs/profile-layout-v3-2026-11.md`](../docs/profile-layout-v3-2026-11.md)
antes de operar sobre un perfil existente.

## Preparación heredada por copias para v2

`migrate-profile-layout.py` prepara copias locales verificadas; **no activa v2**,
no elimina el origen y no modifica `profile.json`. Usar solo con rutas revisadas
por el operador. Sin opciones de aplicación presenta rutas de origen/destino y
conteos, incluidos orígenes ausentes, exclusiones y conflictos:

```sh
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --templates-dir /ruta/plantillas
```

Detener todos los procesos que usen el perfil, también en otros hosts, y verificar
que las producciones bajo las plantillas elegidas pertenecen a este perfil. La
herramienta no puede demostrar ninguna de esas condiciones. Luego, solo tras
revisar el plan:

```sh
python scripts/migrate-profile-layout.py --profile-dir /ruta/perfil --templates-dir /ruta/plantillas --apply --confirm-maintenance --confirm-templates-owned
```

Copia las categorías de plantillas a `productions`, `sandbox` a `sandbox`,
`output` a `renders`, los archivos de biblioteca y música licenciada a `resources`, medios de
publicaciones a `productions/_publicaciones`, logs de modelos/prototipos a
`logs`, y miniaturas a `.system/cache`. Las claves relativas de biblioteca y
publicación se conservan; los JSON permanecen en `data`. El estado de runtime,
los locks, los leases y los eventos se dejan atrás para que se regeneren.
Orígenes ausentes se informan, no se crean datos inventados.

No se incluyen conexiones, credenciales ni rutas con nombres habitualmente
usados para secretos. La exclusión por nombre no puede detectar credenciales
embebidas en contenidos arbitrarios: hay que revisar las producciones y logs
antes de copiar o compartirlos. No se exploran ni imprimen contenidos durante
el plan. Se rechazan symlinks y archivos especiales, y no se sobrescribe ningún
destino. El directorio de staging y los destinos deben compartir un filesystem
para instalar cada archivo con enlace atómico. La confirmación de mantenimiento
es imprescindible porque la aplicación podría crear archivos o modificar
orígenes después de inspeccionarlos.

El manifiesto privado `.system/migrations/<id>/manifest.json` contiene rutas,
hashes SHA-256, tamaños y estados de cada copia. Una interrupción puede dejar
archivos creados o un staging temporal: conservar el manifiesto e inspeccionar
sus estados `planned`, `verified` y `created`. `verified` puede significar que
el archivo final ya se enlazó antes de una interrupción; comprobar su hash y
revisar su pertenencia antes de retirar manualmente cualquier destino. Nunca
borrar el origen como parte de la recuperación. Si un destino ya existía, la
herramienta se detiene sin sobrescribirlo; no hay rollback automático.

Antes de activar v2 todavía se deben revisar las rutas absolutas guardadas en
JSON, el traslado seguro de conexiones/credenciales, los orígenes ausentes,
los resultados excluidos, el espacio y los permisos. Estos pasos y la activación
son deliberadamente manuales; la preparación no equivale a una migración
completa ni garantiza que archivos arbitrarios estén libres de secretos.

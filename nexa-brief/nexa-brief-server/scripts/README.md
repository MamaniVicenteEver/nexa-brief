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
| `generate_showcase_posters.py` | Recuperar o generar miniaturas WebP 16:9 en rutas estables por diseño y componente. |
| `index_usage_history.py` | Inspeccionar e indexar referencias históricas de consumo del perfil activo. |
| `scrape_backgrounds_v3.py` | Descarga de imágenes y música para recursos. |
| `scrape_backgrounds.py` | Descargador de fondos heredado. |
| `scrape_anime.py` | Descarga de recursos de anime y arte. |
| `nexa_brief_ds_scraper.py` | Preparación de datasets. |

`python scripts/index_usage_history.py` muestra referencias pendientes; con
`--apply` las añade al índice del perfil activo sin mover ni cambiar los archivos
originales. La operación es repetible. El índice usa la ruta completa del
contenido para distinguir Sandbox y producción. No recupera llamadas que nunca
se registraron ni reconstruye desgloses ausentes. Algunos flujos aún no escriben
en el ledger común, por lo que los totales disponibles son parciales.

## Crear una categoría explicativa

La web y este comando usan el mismo servicio de creación. Desde la raíz de
`nexa-brief-server`, selecciona primero el perfil y revisa el plan sin escribir:

```sh
. ../scripts/profile-env.sh
.venv/bin/python scripts/create_category.py --name "NodeExplainer" \
  --topic "Clear explainers about current events" --language en --dry-run
```

Quita `--dry-run` para guardar la categoría y crear sus carpetas de Sandbox,
producción, instrucciones `AGENTS.md` y, en layout v3, las carpetas de renders.

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

## Miniaturas del Showcase

Con la API local iniciada y el perfil correcto activo, ejecuta desde la raíz del servidor:

```sh
.venv/bin/python scripts/generate_showcase_posters.py
```

Para preparar solo las variantes V1, V2 y V3 de las miniaturas de los diseños de producción, repite
`--design` para cada ID y añade `--miniaturas`:

```sh
.venv/bin/python scripts/generate_showcase_posters.py --miniaturas \
  --design acuarela --design atlas --design binary --design carta --design collage \
  --design cronica --design dinero --design enmienda --design grunge --design imperio \
  --design memorias --design pelicula --design periodico --design pop --design rough
```

Por defecto recorre los diseños de los motores `_atlas` y `_mapas`. Crea imágenes
WebP a 640×360 en la caché del perfil y captura a la mitad de la duración del
ejemplo. Si ese fotograma está vacío, prueba el instante de mayor visibilidad
del motor y otros instantes próximos; deja constancia en el registro. Abre un
solo navegador y una sola página a la vez. Se puede interrumpir
y volver a ejecutar: conserva los resultados ya preparados. Opciones: `--design ID`
(repetible), `--all`, `--limit N`, `--force` y `--port`. Muestra errores por entrada
y termina con código distinto de cero si alguna falla. El Showcase sirve las
imágenes preparadas, sin iniciar capturas al entrar; la reproducción animada
continúa bajo demanda. Para otros motores se usan las miniaturas JPEG antiguas si no existe WebP.

Las miniaturas usan rutas estables:
`showcase-posters/<diseño>/16x9/default/<motor>.<diseño>.<componente>.webp`.
Los diseños con estilos usan `<estilo>` en lugar de `default`; cada estilo tiene
sus propias imágenes. Para actualizar un estilo concreto usa `--estilo <id>`;
para preparar todos los estilos declarados del diseño usa `--all-styles`.
El comando sin esas opciones prepara únicamente las imágenes sin estilo explícito.
Al ejecutar el generador, recupera las capturas anteriores que coinciden con la
versión actual y las coloca en esa ruta. Si falta una imagen o cambió el componente,
captura de nuevo y reemplaza el mismo archivo. El manifiesto oculto
`.showcase-posters.json` permite detectar cambios sin agregar códigos a las rutas.

```sh
.venv/bin/python scripts/generate_showcase_posters.py --all
.venv/bin/python scripts/generate_showcase_posters.py --design cara-a-cara \
  --component comparacion.dos-tarjetas
```

`--component` recibe el ID exacto del catálogo, requiere `--design` y siempre
reemplaza su captura. `--force` vuelve a generar todas las miniaturas de los
diseños seleccionados.

Con `--frame first`, `--frame middle` o `--frame last` se selecciona el primer,
el central o el último fotograma (por defecto, el central). Si se cambia el
fotograma solicitado, se reemplaza la imagen en la misma ruta estable. Las
capturas antiguas de fotograma central no se usan como si fueran el último.
Si el primer o último fotograma está vacío, se informa el error para revisarlo;
no se sustituye silenciosamente por otro instante.
Con `--frame last --allow-last-visible`, si el final está vacío, busca hacia
atrás un instante visible y registra la excepción como `last-visible`.

Para preparar el último fotograma de CARTA y los diez diseños solicitados:

```sh
.venv/bin/python scripts/generate_showcase_posters.py --frame last \
  --design carta --design collage --design cronica --design dinero --design enmienda \
  --design grunge --design imperio --design memorias --design pelicula \
  --design periodico --design pop
```

## Comprobación de instrucciones de agentes

Desde la raíz del servidor ejecuta `python3 scripts/check_agent_docs.py`; para incluir
el perfil activo usa `python3 scripts/check_agent_docs.py --profile "$NEXA_PROFILE_DIR"`.
Comprueba el inventario, los enlaces Markdown locales, las rutas del índice, las
referencias estáticas inequívocas a documentos Markdown, los bloques comunes y los
punteros CLAUDE. Los ejemplos en bloques de código, variables, rutas de trabajo que se
crean al producir y expresiones dinámicas requieren revisión manual; no se verifican.

# Estudio para dejar un proyecto activo y llevar los respaldos al HDD

Servidor `alfred-server`. Revisión del 2 de noviembre de 2026, con datos recogidos aproximadamente entre las 18:44 y las 18:56 de Bolivia (UTC−4). **Estudio de solo lectura: no se borraron ni trasladaron datos, no se montó el HDD, no se reconstruyó Docker ni se reiniciaron servicios.**

## Dictamen

La organización pedida es viable: **un checkout original y un perfil de datos activos en el SSD; un respaldo consolidado en el HDD**. No hacen falta varias copias completas de `output/` en el SSD ni las capturas de renders históricos abortados.

Se comprobaron duplicados de MP4 por **tamaño y SHA-256**, no solo por nombre. Hay dos excepciones a una eliminación indiscriminada: la copia experimental de Amarillista conserva trabajo propio por rescatar, y los respaldos también contienen estado y conexiones de la aplicación que deben conservarse antes de retirar las carpetas completas.

| Zona | Hallazgo | Decisión recomendada |
|---|---|---|
| Capturas `frame_*.jpg` y sus `work-*` históricos | Seis juegos del mismo material de prueba; **8,42 GB físicos** en carpetas de trabajo | Descartar las carpetas concretas inventariadas; excluirlas de futuros respaldos |
| Respaldo del 2/nov, **17,38 GB** | Guarda producción y desarrollo previos a unificar el perfil | Consolidar los datos necesarios en el HDD; retirar la copia del SSD después de verificarla |
| Respaldo del 24/oct, **8,15 GB** | Copia del esquema anterior: `output`, `server-data`, `web-data`, `accounts` | Preservar su estado necesario en HDD; no necesita otra copia de sus MP4 en SSD |
| `wt-amarillista`, **10,97 GB** | Copia experimental sin Git válido; sus MP4 están duplicados, pero hay fuentes y recursos propios | Rescatar lo único, revisar/integrar el parche y retirar la copia completa después |
| Docker/containerd, **82,05 GB físicos** en la auditoría anterior | Versiones de imágenes, capas extraídas, blobs, caché y volúmenes anteriores | Conservar las imágenes operativas, limitar caché y retirar versiones/volúmenes revisados mediante Docker |
| Servidor original, **9,52 GB** | Código, plantillas, medios, voces, renders, trabajo y entorno Python | Conservar el proyecto; depurar únicamente artefactos identificados, no toda la carpeta |

## 1. Los frames son intermedios descartables: se encontró una sexta copia

La búsqueda empezó en los dos respaldos y se extendió a los datos activos, la copia experimental y el volumen Docker antiguo `nexa-brief-output`, montado exclusivamente en lectura para el estudio.

| Conjunto | Carpetas `work-*` | JPEG de cuadros | Bytes físicos de archivos dentro de `work-*` |
|---|---:|---:|---:|
| Respaldo 2/nov: `production/output` | 5 | 1.609 | 1.404.133.376 |
| Respaldo 2/nov: `development/output` | 5 | 1.609 | 1.404.133.376 |
| Respaldo 24/oct: `output` | 5 | 1.609 | 1.404.133.376 |
| Perfil profesional activo: `output` | 5 | 1.609 | 1.404.133.376 |
| Copia Amarillista: `output` | 5 | 1.609 | 1.404.133.376 |
| Volumen Docker anterior: `nexa-brief-output` | 5 | 1.609 | 1.404.133.376 |
| **Total** | **30** | **9.654** | **8.424.800.256 ≈ 8,42 GB / 7,85 GiB** |

En total son 9.714 archivos: 9.654 JPEG, 30 `compiled/index.html` y 30 `audio.m4a`. Los JPEG por sí solos ocupan **8.383.438.848 bytes asignados**, unos 8,38 GB. Los cinco primeros juegos tienen inodos distintos verificados: son copias físicas, no enlaces duros. El volumen es otra ubicación física del esquema anterior.

Por cada conjunto hay dos intentos de Grunge, uno de Ceniza, uno de Mixtas y uno de Lluvia gris. Están bajo `hf-demo-*/work-<UUID>/`, en subcarpetas de captura. Son restos de pruebas de HyperFrames, no fotografías originales ni miniaturas. Las muestras `frame_000488.jpg` comparadas entre copias tienen el mismo SHA-256.

Estos frames **no hacen falta para reproducir los MP4 ni para volver a renderizar desde un proyecto fuente completo**. Son candidatos concretos a limpieza. La regla debe identificar esas carpetas de captura; no debe convertirse en «eliminar todos los JPG» ni «eliminar todos los work», porque hay medios originales y estado de producción fuera de ellas.

### Por qué quedaron

- `output/hf-demo-batch.log`, líneas 13, 28 y 88 del respaldo del 24/oct, registra tiempos agotados de 1.800 segundos en Ceniza y dos intentos de Grunge, el 4/oct.
- `src/adapters/recorder/infrastructure/subprocess_progress.py:94` usa `proc.kill()` al agotar el tiempo.
- `hyperframes_adapter.py:544` limpia `_hyperframes_site`, pero los `work-*` vecinos creados por el CLI quedan fuera de esa limpieza.
- Las migraciones posteriores copiaron también esos restos. No se aplicó un filtro para excluirlos del respaldo.

El CLI histórico no está instalado actualmente para revisar toda su limpieza interna. Los registros, las rutas, el código del timeout y la limpieza limitada respaldan el diagnóstico: **intentos interrumpidos dejaron capturas y las copias posteriores multiplicaron el problema**. No fue la prueba de 20 segundos de esta conversación: aquella eliminó sus JPEG correctamente.

Para que no reaparezca: directorio temporal identificable por trabajo, cancelación que finalice y espere los subprocesos, limpieza del directorio propio también al fallar y exclusión de capturas en los respaldos. Un modo de diagnóstico que conserve frames debería ser explícito y tener límite de tiempo/espacio. No se cambió código durante este estudio.

## 2. Comparación completa de los MP4 históricos

| Ubicación histórica | MP4 examinados | Bytes lógicos | MP4 idénticos presentes en `output` activo |
|---|---:|---:|---:|
| Respaldo 2/nov: desarrollo | 252 | 6.186.373.885 | **252 de 252** |
| Respaldo 2/nov: producción | 250 | 6.080.272.067 | **250 de 250** |
| Respaldo 24/oct | 250 | 6.080.272.067 | **250 de 250** |
| `wt-amarillista/output` | 252 | 6.186.373.885 | **252 de 252** |
| Volumen Docker anterior | 250 | 6.080.272.067 | **250 de 250** |
| **Total de copias históricas** | **1.254** | **30.613.563.971 ≈ 30,61 GB** | **Todos tienen un equivalente activo** |

El `output` activo contiene 256 archivos MP4, 6.287.189.322 bytes. Algunos MP4 son medios de apoyo copiados en paquetes de pruebas; la extensión no convierte automáticamente cada archivo en una exportación final. Los resultados anteriores comparan todos los MP4 de esas ubicaciones, sin afirmar que todos sean videos finales distintos.

No apareció ningún MP4 histórico exclusivo de estos cinco árboles. Esto demuestra que **sus copias de MP4 pueden retirarse después de preservar el conjunto canónico y comprobar el respaldo**. No demuestra que toda su configuración, base de datos o conexión sea idéntica. El contenido de credenciales y archivos prohibidos no se inspeccionó.

## 3. Qué hay en los dos respaldos y por qué son grandes

### Respaldo del 2 de noviembre: 17,38 GB

Ruta:

```text
/home/alfred/.local/share/nexa-brief/backups/professional-migration-20261102T172920Z/
├── development/   ≈9,24 GB
│   ├── output/     8,09 GB
│   ├── data/       0,50 GB
│   └── tiktok/     0,64 GB, además de archivos menores
└── production/    ≈8,15 GB
    ├── output/     7,99 GB
    └── data/       0,16 GB, además de archivos menores
```

Se creó para poder revertir la migración que unificó desarrollo y producción en el perfil profesional compartido. Lo documentan `docs/investigaciones/perfil-profesional-compartido-2026-11.md:90` y el informe de migración. Al conservar ambos árboles completos, se conservaron por duplicado muchos videos, pruebas y frames.

La finalidad del respaldo era válida durante la migración. Mantener ambos árboles completos indefinidamente en el SSD no es necesario para que funcione el perfil vigente. Conviene consolidar lo necesario en el HDD y conservar un registro de lo que se retiró.

### Respaldo del 24 de octubre: 8,15 GB

Contiene exactamente estas ramas superiores:

```text
/home/alfred/.local/share/nexa-brief-migration-20261024/
├── output/         7,99 GB
├── server-data/    ≈0,16 GB
├── web-data/
└── accounts/
```

Es una copia de datos del esquema anterior de la aplicación, no otro proyecto de código. Sus 250 MP4 son idénticos a archivos del perfil actual y al conjunto de producción del respaldo posterior. No se encontró documentación que permita afirmar el motivo exacto de la operación del 24/oct; el nombre y fecha por sí solos no bastan para reconstruirlo.

No debería permanecer como otro árbol completo en el SSD una vez consolidada y verificada la recuperación en HDD. Los datos de cuentas y estado deben preservarse sin exponerlos ni restaurarlos ciegamente sobre el perfil actual, que ha seguido cambiando.

## 4. Por qué existe `wt-amarillista` y qué hay que rescatar

Ruta: `/home/alfred/codex/nexa-brief/wt-amarillista`, **10.974.756.864 bytes asignados**. Dentro, `output/` aporta **8.094.932.992 bytes**.

`CAMBIOS.md` y `BITACORA.md` describen una **copia aislada de experimentación para el motor amarillista/hilo, ronda 9**, con un «parche sin aplicar». La carpeta nació el 30/oct. Hoy no es un worktree Git válido: los `.git` inspeccionados están vacíos, y el Git principal solo registra el checkout original. No se encontraron procesos accesibles, servicios revisados ni scripts operativos que referencien esa ruta.

La comparación SHA-256 de fuentes y recursos encontró:

- 1.023 archivos de fuentes/configuración/documentación idénticos.
- **171 diferentes y 26 ausentes en la misma ruta del proyecto actual**.
- 481 recursos no MP4 idénticos y **13 recursos ausentes en la misma ruta del proyecto actual**, principalmente de `sandbox/nodepolitics/imperio-demo`.
- Eliminando el solapamiento entre inventarios, son **208 archivos distintos por revisar, 29.185.979 bytes**.
- Además están `amarillista.patch`, de unos 471 kB, y sus notas y entregables experimentales.
- Los **228 MP4 de su `src/`, 1.854.573.266 bytes, tienen todos un equivalente idéntico en el servidor original**, aunque la ruta relativa puede haber cambiado.

**Recomendación:** rescatar ese conjunto pequeño de trabajo propio y sus correspondencias de recursos; revisarlo o integrarlo sin reemplazar a ciegas código actual por código antiguo. Después puede retirarse la copia de 10,97 GB. Su `output` no necesita conservar otros 252 MP4 ni otro juego de frames: todo MP4 fue confirmado en el perfil activo.

El estudio no recomienda borrar la carpeta entera antes de rescatar los archivos distintos. Para restaurar experimentos con medios reubicados debe conservarse también el mapa entre sus rutas antiguas y los archivos originales actuales.

## 5. Docker: por qué hay 63 GB en snapshots

El servidor usa Docker Engine 29.1.3 con `io.containerd.snapshotter.v1`. Este backend conserva tanto las capas comprimidas recibidas como las capas extraídas que usa para ejecutar los contenedores; eso explica las dos ramas. Es el diseño descrito por la [documentación oficial de Docker](https://docs.docker.com/engine/storage/containerd/).

Medición física previa de estas mismas carpetas:

```text
/var/lib/containerd/                         73,71 GB
├── ...overlayfs/snapshots/                  63,06 GB
└── ...content/blobs/                        10,65 GB
/var/lib/docker/                             8,34 GB
└── volumes/                                 8,15 GB, principalmente datos anteriores
```

El tamaño es excesivo para conservar solo la versión operativa: hay **19 imágenes anteriores con 20 etiquetas**. Una imagen también tiene el alias `meta-covers-20261102`; eliminar únicamente nombres `before-*` no retiraría todas las referencias antiguas.

Además, el Dockerfile copia `.venv` en una capa de unos 1,17 GB y después copia `/app`, incluyendo otra vez `.venv`, en una capa de unos 1,4 GB. Cada reconstrucción de esa segunda capa puede retener otra copia grande al conservar la imagen anterior.

Docker informa 38,27 GB de imágenes recuperables y 21,63 GB de caché recuperable. **No son dos ahorros independientes que puedan sumarse sin medir:** comparten referencias/capas. La suma redondeada `UNIQUE SIZE` de las imágenes anteriores es unos 33,02 GB y tampoco se añade a las otras cifras.

La política recomendada es conservar la versión operativa coherente —API, web, túnel y el inicializador que aún necesite el despliegue—, guardar la recuperación necesaria en HDD y retirar las versiones anteriores revisadas. Los snapshots se gestionan con Docker, no borrando carpetas internas. La caché puede tener un presupuesto pequeño, por ejemplo 5–10 GB, ajustado al uso real; Docker ofrece [recolección automática por tamaño/edad](https://docs.docker.com/build/cache/garbage-collection/) y [limpieza de caché no utilizada](https://docs.docker.com/reference/cli/docker/builder/prune/).

Antes de consolidar el despliegue conviene corregir la doble copia de `.venv` y verificar la coherencia entre plantillas montadas y código de la imagen, pues la prueba anterior detectó un módulo `runtime` ausente. No se aplicó ese cambio ni se hizo un build aquí.

## 6. Los 9,52 GB del servidor original

El directorio original no es una copia íntegramente prescindible. El inventario encontró aproximadamente:

| Rama | Tamaño asignado |
|---|---:|
| `src/` | 8,10 GB |
| `.venv/` | 1,29 GB |
| `pruebas/` | 0,07 GB |
| `.cache/` | 0,04 GB |
| Otros archivos y metadatos | resto pequeño |

Las plantillas incluyen medios y renders, no solo texto de programación. `nodemotion` ronda 2,40 GB; `nodeatlas` 1,60 GB; `sandbox` 1,51 GB; `nodetech` 1,06 GB. Se detectaron 514 MP4 en todo el servidor original, con 4,70 GB lógicos entre medios, pruebas y exportaciones.

Hay 31 MP4 bajo carpetas `render/`, unos 1,25 GB; **ocho, con 244,71 MB, coinciden con MP4 del perfil activo**. Esos renders pueden tratarse como caché revisable. Los otros no son duplicados confirmados del perfil activo.

El recorrido del `src` completo no encontró los `frame_<número>.jpg/jpeg/png` ni los `work-*` históricos descritos arriba. Sus carpetas normales `work/` sí pueden contener voz, planes y estado de producciones en curso; no son equivalentes a esas capturas fallidas. El `output` activo está enlazado al perfil externo y no forma parte de estos 9,52 GB contados sin seguir enlaces.

Guardar solo un MP4 permite reproducirlo, recortarlo o añadirle elementos. Para reeditar texto, escenas y diseño hacen falta el HTML, código/versión del motor, configuración, guion/storyboard, voz/audio, tiempos/letra y medios originales. Guardar `index.html` sin sus recursos no es un proyecto restaurable. Los frames intermedios no sustituyen esas fuentes.

## 7. El HDD existe y tiene capacidad suficiente

El sistema está en un **SSD SATA de 512 GB, `/dev/sda`**. El segundo disco es un **Toshiba de 1 TB, `/dev/sdb`**. Sus particiones NTFS no estaban montadas.

Se consultó el bitmap NTFS con `ntfsinfo` usando dispositivos autorizados **solo para lectura**, sin montar ni modificar las particiones:

| Partición | Etiqueta | Capacidad del volumen | Libre medido | Usado aproximado |
|---|---|---:|---:|---:|
| `/dev/sdb2` | `Documentos` | 503,32 GB | **495,61 GB** | 7,71 GB |
| `/dev/sdb3` | `VideosImagenesOtros` | 496,83 GB | **485,26 GB** | 11,57 GB |

La partición propuesta para el respaldo es `VideosImagenesOtros`, identificada por UUID `6E2621FB2621C4C5`. Ya tiene datos: se utilizaría una carpeta nueva, sin formatear ni reemplazar su contenido existente. No se creó esa carpeta durante el estudio.

Los respaldos actuales están bajo `/home` en el SSD. **Ninguno de esos directorios usa hoy el HDD sin montar.** Para el traslado habrá que establecer un montaje estable, verificar el UUID y exigir que el disco esté realmente montado antes de respaldar; si falta, la tarea debe detenerse en vez de escribir silenciosamente en una carpeta del SSD.

## 8. Organización propuesta y orden de consolidación

Esta estructura es una propuesta, todavía no creada:

```text
SSD
├── /home/alfred/Projects/Git-Projects/nexa-brief/       único checkout original
└── /home/alfred/.local/share/nexa-brief/profiles/
    └── profesional/                                  únicos datos activos

HDD: partición VideosImagenesOtros
└── /mnt/nexa-backups/nexa-brief/                       montaje propuesto
    ├── actual/                                       respaldo consolidado
    │   ├── proyecto-fuentes/                         código + medios originales
    │   ├── datos/                                    estado de aplicación necesario
    │   ├── videos-finales/                           exportaciones canónicas
    │   └── manifest-sha256.json
    └── rescate-historico/                             solo material único pendiente de revisar
```

El respaldo restaurable debe incluir el estado necesario del sistema, no solo videos. Los paquetes regenerables —`.venv`, `node_modules`, cachés, builds y capturas— pueden excluirse siempre que queden manifiestos de dependencias, versiones y fuentes suficientes.

Orden recomendado para una ejecución posterior:

1. Fijar el checkout y el perfil actuales como ubicaciones canónicas y preparar el HDD sin tocar sus datos existentes.
2. Rescatar las fuentes y recursos propios de Amarillista y el estado histórico necesario. No restaurar datos antiguos sobre los actuales.
3. Crear el respaldo consolidado filtrado: conservar fuentes/medios y datos necesarios, excluir las 30 carpetas de captura y evitar guardar otra vez cada MP4 histórico idéntico.
4. Verificar hashes e inventario en HDD y probar que el respaldo permite recuperar una muestra del proyecto y de sus videos.
5. Retirar del SSD los dos árboles de respaldo; retirar Amarillista después de resolver su trabajo propio; retirar los volúmenes anteriores después de verificar sus datos; retirar los cinco `work-*` fallidos del perfil activo.
6. Consolidar la versión de Docker, retirar versiones anteriores revisadas y reducir caché. Medir `df` después de cada fase.
7. Aplicar la limpieza por trabajo y los filtros de respaldo para que no vuelva a crecer por la misma causa.

### Espacio potencial sin sumar dos veces los frames

Si se completa y verifica la consolidación, estos bloques no se solapan:

| Bloque del SSD que podría retirarse | Bytes observados |
|---|---:|
| Respaldo 2/nov completo | 17.384.345.600 |
| Respaldo 24/oct completo | 8.146.165.760 |
| Amarillista completo, después del rescate | 10.974.756.864 |
| Volúmenes Docker anteriores, después de preservar su estado | 8.147.591.168 |
| Capturas fallidas del perfil activo | 1.404.133.376 |
| **Total de consolidación posible** | **46.056.992.768 ≈ 46,06 GB** |

Los frames contenidos en respaldos, Amarillista y volúmenes ya están dentro de esas filas; **no se añaden otra vez los 8,42 GB**. Esta estimación tampoco incluye los posibles ahorros de imágenes/caché Docker, ni promete que el mismo número se recupere antes de completar los rescates y verificaciones. La nueva copia del respaldo ocuparía el HDD, no el SSD.

## Evidencia

El resumen está en `estudio-consolidacion-backups-frames-docker-hdd-2026-11-02.evidencia.json`, junto a este informe. El inventario detallado de MP4, hashes de fuentes/recursos, capturas y lectura NTFS se conserva, comprimido cuando corresponde, en:

```text
/home/alfred/.local/share/nexa-brief/profiles/profesional/reports/consolidacion-20261102/
```

No se inspeccionó el contenido de `.env`, cuentas, usuarios, tokens, secretos de cliente ni perfiles de navegador. Eso limita la deduplicación de estado protegido: sus archivos no se han declarado basura por parecerse de nombre o tamaño. Los únicos resultados persistentes nuevos son este estudio y sus metadatos de evidencia.

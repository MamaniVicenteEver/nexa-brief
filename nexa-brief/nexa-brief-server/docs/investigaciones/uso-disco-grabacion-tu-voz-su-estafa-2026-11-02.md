# Uso de disco al grabar «Tu voz, su estafa»

**Auditoría posterior de todo el sistema:** [árbol de uso de disco](arbol-uso-disco-sistema-2026-11-02.md). Se midieron 82,05 GB físicos de Docker/containerd y 87,44 GB en `/home/alfred`. Se confirmó que `/tmp` del host está en tmpfs y sus 3,19 GB no forman parte del disco raíz.

**Actualización con prueba real:** se grabaron y midieron 20 segundos en ambos formatos. Véase [prueba medida de disco y RAM](prueba-medida-render-20s-2026-11-02.md): pico de disco de unos 98 MB; incremento final de 10,46 MB contando videos, copias y registros; ambos lotes de JPEG eliminados. La revisión siguiente conserva las mediciones previas a esa prueba.

Revisión en `alfred-server` (`alfred`, `192.168.20.2`), 2 de noviembre de 2026, alrededor de las **18:12, hora de Bolivia (UTC−4)**. Checkout remoto: `feat/nodetech-paquete-publicacion`, HEAD `ebe4e0a`. Las mediciones se hicieron por SSH sobre el servidor real; no se extrapolaron desde el equipo local.

## Resultado

**El video consultado no dejó 27 GB de archivos persistentes.** Sus dos MP4 finales suman **96.373.164 bytes: 96,37 MB decimales o 91,91 MiB**. La Biblioteca ocupa **96,87 MB** contando miniaturas, directorios y metadatos. La interfaz muestra 44,0 y 47,9 «MB», cifras que corresponden a MiB y concuerdan con los archivos reales.

Incluyendo la carpeta de producción completa —medios originales, voz, archivos de trabajo, miniaturas y otra copia de los MP4— este video ocupa **339.554.304 bytes, unos 340 MB / 323,82 MiB** entre producción y Biblioteca. Es menos de 0,34 GB persistentes, no 27 GB.

Sí existen dos problemas distintos:

1. **Un pico temporal durante la grabación:** el motor guarda todos los cuadros como JPEG antes de codificar. Un MP4 pequeño puede necesitar muchos más GB mientras se produce.
2. **Acumulación persistente ajena a ese MP4:** respaldos de migraciones, imágenes anteriores de Docker, caché de builds, antiguos volúmenes y copias de desarrollo. Estos son los principales consumidores encontrados.

No existe una medición histórica conservada de `df` inmediatamente antes y después del salto declarado de 160 a 187 GB. Por tanto, **no es posible atribuir exactamente esos 27 GB a un solo evento**. Las cifras siguientes demuestran qué ocupa espacio ahora; no reconstruyen un pico pasado.

## 1. Estado real del disco

Medición de `df -B1 /` a las 18:11:43 de Bolivia:

| Concepto | Bytes | Equivalencia |
|---|---:|---:|
| Capacidad del sistema de archivos | 464.422.191.104 | 464,42 GB / 432,53 GiB |
| Usado | 180.876.558.336 | **180,88 GB / 168,45 GiB** |
| Disponible para usuarios | 263.536.144.384 | 263,54 GB / 245,44 GiB |
| Ocupación informada por `df` | — | 41 % |

El banner aportado por el usuario ya expresaba el disco en **GiB**. Compararlo con una herramienta que usa **GB decimales** cambia el número sin que se hayan creado archivos. Un GB son 1.000.000.000 bytes; un GiB son 1.073.741.824 bytes. Esta diferencia de unidades no basta, por sí sola, para explicar un crecimiento real de 27 GB.

RAM y swap son otras métricas: la swap rondaba 3,8 GiB usados de una capacidad fija de 4 GiB. Su porcentaje alto no demuestra que el MP4 esté creciendo ni explica 27 GB nuevos en el disco.

## 2. Archivos del video concreto

Identificador de producción: `clonan-tu-voz-con-3-segundos-de-audio-las-llamad`. Grabación de Biblioteca: `7c53aa5c`.

Producción:

```text
/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/src/templates/nodetech/clonan-tu-voz-con-3-segundos-de-audio-las-llamad/
```

Biblioteca:

```text
/home/alfred/.local/share/nexa-brief/profiles/profesional/output/node_tech/rough/clonan-tu-voz-con-3-segundos-de-audio-las-llamad/7c53aa5c/
```

| Archivo final | Bytes | Tamaño que muestra la interfaz | Duración / formato |
|---|---:|---:|---|
| `…-16x9.mp4` | 46.159.772 | 44,0 MiB | 583,637 s; 1920 × 1080; 30 fps |
| `…-9x16.mp4` | 50.213.392 | 47,9 MiB | 583,637 s; 1080 × 1920; 30 fps |

`ffprobe` confirmó H.264 y AAC en ambos archivos. El bitrate total es aproximadamente 0,633 y 0,688 Mbps, respectivamente; incluye audio y contenedor. Por eso diez minutos de video pueden ocupar solo unas decenas de MB.

Tamaños asignados en disco, medidos con `du -B1`:

| Ubicación | Bytes | MB decimales | Qué contiene |
|---|---:|---:|---|
| Producción: `render/` | 97.288.192 | 97,29 | Los dos MP4 y miniaturas |
| Producción: `assets/` | 69.201.920 | 69,20 | Voz y medios usados en el video |
| Producción: `work/` | 76.095.488 | 76,10 | WAV, partes de narración y capturas de revisión |
| Producción completa | 242.683.904 | 242,68 | Incluye las tres filas anteriores |
| Biblioteca: grabación `7c53aa5c` | 96.866.304 | 96,87 | MP4, miniaturas y metadatos |
| Biblioteca: carpeta del video completa | 96.870.400 | 96,87 | Incluye el directorio padre |
| **Producción completa + Biblioteca completa** | **339.554.304** | **339,55** | Total de este video en esas dos ubicaciones |

No deben sumarse otra vez las subcarpetas a la fila «Producción completa». Los tamaños de `du` incluyen bloques asignados y directorios; pueden superar ligeramente la suma de tamaños lógicos de los archivos.

Se calcularon SHA-256 de los cuatro MP4: cada copia de `render/` coincide exactamente con su correspondiente copia de Biblioteca, y tienen inodos distintos. Son copias físicas separadas, no dos enlaces al mismo archivo. Esta duplicación añade unos **96,37 MB** de MP4 a este caso, no decenas de GB.

## 3. Por qué el render puede ocupar mucho más temporalmente

La ruta usada por estas plantillas es:

```text
ExplainerRecorder → kit.py render → commercial/render_promo.py → JPEG por cuadro → FFmpeg → MP4
```

Evidencia del código remoto:

- `src/core/explainer/recorder.py:129`: define la llamada a `kit.py render`.
- `src/templates/_tools/explainer-kit/tools/kit.py:289`: selecciona los formatos y los renderiza uno después del otro, con cuatro workers dentro de cada formato.
- `src/templates/_tools/commercial/render_promo.py:43`: escribe un archivo `000000.jpg`, `000001.jpg`, etc., con calidad JPEG 92.
- `render_promo.py:64`: usa `tempfile.TemporaryDirectory()`.
- `render_promo.py:73`: calcula todos los cuadros de la duración solicitada.
- `render_promo.py:85`: solo después de capturarlos ejecuta FFmpeg para comprimirlos como H.264.

A 30 fps, 583,637 segundos son aproximadamente **17.509 JPEG por formato**, unos 35.018 cuadros entre los dos formatos. Los JPEG comprimen cada imagen por separado; H.264 también aprovecha lo que se repite entre cuadros. Sus tamaños no son comparables directamente.

Ejemplos de espacio para **un formato**, según el tamaño medio de cada JPEG:

| JPEG medio supuesto | Espacio de 17.509 cuadros |
|---|---:|
| 100 KiB | 1,79 GB |
| 500 KiB | 8,96 GB |
| 1,5 MiB | 27,54 GB |

**Estos son cálculos ilustrativos, no una medición del pico de esta grabación.** Los formatos se procesan secuencialmente; no corresponde sumar automáticamente los dos picos. Los cuatro workers reparten los cuadros, no guardan cuatro copias de cada uno.

`TemporaryDirectory()` elimina la secuencia al salir normalmente, incluso cuando una excepción se propaga a través del bloque. Una muerte abrupta del proceso puede impedir esa limpieza. No se encontró un mecanismo específico para identificar y retirar tandas huérfanas de este renderizador después de una interrupción abrupta.

Estado al revisar:

- `/tmp` del contenedor API actual: **225.280 bytes**, sin una tanda grande de cuadros.
- Capa escribible del contenedor API: aproximadamente **487 kB**, según Docker.
- En los archivos accesibles de `/tmp` y `/var/tmp` del host: **cero** archivos con el patrón de cuadros `000000.jpg`.
- `/tmp` del host ocupa unos **3,19 GB**, principalmente carpetas de pruebas y revisiones anteriores; no es una secuencia de cuadros de este video. La auditoría posterior confirmó que está en **tmpfs (RAM/swap)** y no suma esos 3,19 GB al disco raíz.
- No había procesos de captura ni FFmpeg activos dentro del contenedor API inspeccionado.

**Límite de la comprobación:** el contenedor API actual arrancó a las **17:53:16 de Bolivia**, después de terminar los MP4 a las 16:28 y 16:44. Su `/tmp` actual no permite conocer el pico ni los temporales del contenedor anterior, que ya fue reemplazado.

## 4. Dónde está el consumo persistente grande

Las filas siguientes son ubicaciones o categorías diferentes. Las métricas de Docker tienen capas compartidas y **no deben sumarse como si todas fueran bytes físicos independientes**.

| Consumidor | Tamaño observado | Explicación |
|---|---:|---|
| Respaldo de migración de hoy | **17,38 GB** | `~/.local/share/nexa-brief/backups/professional-migration-20261102T172920Z/` |
| Respaldo de migración del 24 de octubre | **8,15 GB** | `~/.local/share/nexa-brief-migration-20261024/` |
| Volúmenes Docker anteriores | **8,139 GB** | Cuatro volúmenes sin contenedores asociados; `nexa-brief-output` aporta unos 7,981 GB |
| Imágenes Docker | **71,46 GB informados por Docker** | 26 imágenes; Docker marca 38,27 GB como recuperables |
| Caché de builds Docker | **50,89 GB informados por Docker** | 201 entradas; Docker marca 21,63 GB como recuperables |
| Perfil profesional vigente completo | **9,50 GB** | Incluye 8,19 GB de `output/`; son datos activos de muchos videos |
| Todas las plantillas del checkout | **8,04 GB** | Código, medios, trabajo y renders de múltiples producciones |
| Worktree `~/codex/nexa-brief/wt-amarillista` | **10,97 GB** | Otra copia de desarrollo con sus dependencias y archivos |
| Caché del usuario `~/.cache` | **7,73 GB** | Incluye Hugging Face, uv y navegadores Playwright |
| Caché npm `~/.npm` | **2,51 GB** | Dependencias/caché de Node |
| `/tmp` del host | **3,19 GB en tmpfs** | Pruebas y revisiones en RAM/swap; no son uso adicional del disco raíz |
| `/var/log` | **0,21 GB** | Los logs accesibles no son el consumidor principal |

### Respaldos de la migración

El directorio del respaldo de hoy nació a las **13:29:20 de Bolivia**, antes de terminar el video. Contiene:

- `development/`: **9,24 GB**; de ellos, unos 8,09 GB en `output/`.
- `production/`: **8,15 GB**; de ellos, unos 7,99 GB en `output/`.

La documentación existente, `docs/investigaciones/perfil-profesional-compartido-2026-11.md:90`, confirma que se conservaron copias de producción y directorios originales de desarrollo durante la unificación del perfil. También confirma que quedaron disponibles los volúmenes y las imágenes anteriores.

Esto explica por qué hay varios conjuntos de datos antiguos además del perfil vigente. **No significa que los 17,38 GB del respaldo se hayan añadido íntegramente al disco ese día:** parte de los originales pudo haberse trasladado. El crecimiento neto de esa migración requiere una medición anterior que no está disponible.

### Imágenes anteriores y builds

Hay **19 imágenes etiquetadas `before-*`**: diez de API y nueve de web. Son puntos de reversión de cambios de la aplicación. Las imágenes de API rondan **5,82–5,87 GB** cada una en el listado; las de web, unos 541 MB. Muchas se crearon el mismo 2 de noviembre.

La suma de sus columnas `UNIQUE SIZE` ronda **33,02 GB**. Es una referencia de magnitud basada en cifras redondeadas; no una garantía de recuperación adicional a las otras cifras de Docker. `docker system df` ya informa el total recuperable según su contabilidad.

El Dockerfile de API también contribuye al tamaño de las reconstrucciones:

- `nexa-brief-server/Dockerfile:43` copia `/app/.venv` desde `dependencies`.
- `Dockerfile:44` vuelve a copiar **todo `/app`** desde `build`, que también contiene `.venv`, con cambio de propietario.
- El historial de la imagen actual muestra capas de aproximadamente **1,17 GB** para la primera copia de `.venv` y **1,4 GB** para la copia de `/app`.

La primera capa sigue formando parte de la imagen aunque otra posterior reescriba sus archivos. Además, una modificación de código puede obligar a generar de nuevo la capa que incluye todo `/app`. Retener imágenes anteriores y sus cachés conserva estos bloques. **Es consumo por construir y respaldar versiones de la aplicación; no por el peso del video final.**

El `.dockerignore` raíz ya excluye MP4, WebM, MOV, MP3, WAV, `output`, cachés, `work` de plantillas y `sandbox`. Eso limita lo que entra al build; no elimina imágenes históricas que ya existen ni evita la doble copia de `.venv` descrita.

## 5. Por qué cada nueva grabación añade otra carpeta

`src/core/explainer/recorder.py:397–412` crea un identificador nuevo para cada grabación completa y copia los MP4 desde `render/` a `output/…/<recording_id>/`. No reemplaza automáticamente las grabaciones anteriores de Biblioteca. Es una decisión para conservarlas como elementos independientes.

En este video solo se encontró la grabación `7c53aa5c` dentro de su carpeta de Biblioteca. En otros videos, grabar repetidamente puede acumular varias copias aunque se reutilice el render almacenado. La interfaz informa el tamaño de cada MP4, no el de sus medios originales, copias, trabajo, respaldos y contenedores.

## 6. Aviso de la captura: «job no encontrado»

`ExplainerRecorder` mantiene los trabajos de grabación en un diccionario en memoria (`recorder.py:219`). El endpoint responde 404 cuando ese identificador ya no está (`src/presentation/api/routers/explainer.py:376–378`).

El reinicio/reemplazo de la API pierde esos identificadores de seguimiento. Como el contenedor actual es posterior a la grabación, el aviso de la captura es **compatible con consultar un trabajo del proceso anterior**. No se pudo probar la historia exacta del ID `df6f6c142926` sin el estado anterior. Los dos MP4 existen, son legibles por `ffprobe` y conservan sus copias verificadas.

## 7. Correcciones recomendadas, por prioridad

1. **Controlar la retención de builds y respaldos.** Inventariar los puntos de reversión necesarios y aplicar un límite de versiones/antigüedad. Revisar primero la caché de builds recuperable y las 19 imágenes `before-*`. Las categorías de Docker se solapan: medir `df` después de cada limpieza, sin sumar sus estimaciones de recuperación.
2. **Revisar las copias de migración y los volúmenes anteriores.** Conservar una copia verificada del estado necesario para recuperar datos; después retirar solo duplicados confirmados. «Sin contenedores asociados» no significa que un volumen carezca de datos útiles.
3. **Reducir la imagen de API.** Evitar copiar `.venv` dos veces y separar el código de las dependencias en las capas finales. Mantener los datos generados fuera de la imagen. Esto requiere un cambio y una validación de build independientes; no se aplicó durante esta auditoría.
4. **Evitar almacenar todos los JPEG antes de codificar.** Alimentar FFmpeg mediante una cola acotada y ordenada de cuadros, o codificar fragmentos pequeños y eliminar cada tanda después. Hay que respetar el orden de los cuatro workers y comprobar duración, audio y calidad de salida.
5. **Hacer explícito el ciclo de vida del render.** Usar un directorio temporal identificable por trabajo, registrar su tamaño/pico, terminar los subprocesos al cancelar y limpiar únicamente carpetas huérfanas verificadas. Registrar el espacio libre antes y después del render permite demostrar el crecimiento real de la próxima grabación.
6. **Mostrar y administrar las copias por video.** Diferenciar en la interfaz «MP4 finales», «archivos de producción» e «histórico de grabaciones». Añadir una política de conservación para `work/`, previews y grabaciones antiguas, protegiendo elementos programados o publicados.
7. **Persistir el seguimiento de grabaciones.** Guardar el estado del trabajo o recuperar su resultado tras reiniciar la API, para evitar el 404 de identificadores antiguos.

No se ejecutó ninguna limpieza, reconstrucción ni reinicio. No se modificó el motor de grabación, no se grabaron videos y no se publicaron contenidos durante esta revisión.

## 8. Evidencia y límites

Se adjunta `uso-disco-grabacion-tu-voz-su-estafa-2026-11-02.evidencia.json`, con fecha local, `df`, `du`, inventario del video, tamaños y hashes SHA-256 de los MP4, `ffprobe`, almacenamiento Docker, montajes de API/web y fechas de los contenedores. No contiene credenciales.

Comandos de comprobación de solo lectura:

```bash
ssh alfred-server
df -B1 /
docker system df
docker system df -v
du -s -B1 ~/.local/share/nexa-brief/backups/professional-migration-20261102T172920Z
du -s -B1 ~/.local/share/nexa-brief/profiles/profesional/output
docker exec nexa-brief-api-1 du -B1 -d2 /tmp
```

No se solicitó contraseña de `sudo`. El acceso directo a directorios de Docker propiedad de root no estaba disponible; se usaron sus comandos de almacenamiento. La búsqueda de archivos borrados aún abiertos solo pudo cubrir los procesos visibles para el usuario, por lo que no descarta casos de otros usuarios. La web pública no fue accesible mediante la herramienta de navegación; el diagnóstico se apoya en archivos y código medidos directamente por SSH.

**Conclusión:** el tamaño de los MP4 que muestra la aplicación es coherente. Este video conserva alrededor de **340 MB** incluyendo su producción y su copia en Biblioteca. El motor sí puede tener un pico temporal grande al guardar miles de JPEG; no quedó evidencia suficiente para medir el pico pasado. La acumulación persistente demostrada se concentra en **respaldos de migración, versiones y caché de Docker, y copias de desarrollo**.

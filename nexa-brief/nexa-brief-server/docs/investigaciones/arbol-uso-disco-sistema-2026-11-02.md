# Árbol de uso de disco de alfred-server

Medición del 2 de noviembre de 2026, entre las 18:29 y 18:35, hora de Bolivia. Último `df` de cierre: **180.931.858.432 bytes usados, 180,93 GB / 168,51 GiB**, de 464,42 GB de capacidad.

**Los dos grandes bloques son Docker/containerd, con 82,05 GB físicos, y `/home/alfred`, con 87,44 GB. Juntos concentran aproximadamente el 93,7 % del espacio encontrado.** El resto, incluidos el sistema y la swap, ronda los 11,5 GB.

Los tamaños siguientes son **GB decimales**, redondeados. Las ramas con `/` en su nombre comprimen niveles intermedios para que el árbol quede parcialmente desplegado. Los hijos ya están incluidos en su padre; no se vuelven a sumar.

```text
/                                                    ≈180,93 GB usados
├── home/alfred/                                       87,44 GB
│   ├── .local/                                       42,08 GB
│   │   ├── share/nexa-brief/                          26,89 GB
│   │   │   ├── backups/                              17,38 GB  RESPALDO MIGRACIÓN
│   │   │   └── profiles/profesional/                  9,51 GB  DATOS ACTIVOS
│   │   │       └── output/                             8,20 GB  videos de Biblioteca
│   │   ├── share/nexa-brief-migration-20261024/         8,15 GB  OTRO RESPALDO
│   │   ├── lib/node_modules/                           4,08 GB  herramientas Node/IA
│   │   └── share/pnpm/                                 2,33 GB  almacén de paquetes
│   ├── Projects/                                     19,11 GB
│   │   └── Git-Projects/nexa-brief/                   17,46 GB
│   │       ├── nexa-brief/nexa-brief-server/            9,51 GB  fuentes, medios, entornos
│   │       └── nexa-brief/nexa-brief-web/               4,96 GB
│   │           └── .next/                              4,09 GB
│   │               └── dev.backup-2026-11-01/          2,76 GB  BUILD RESPALDADO
│   ├── codex/                                        11,51 GB
│   │   └── nexa-brief/wt-amarillista/                 10,97 GB  OTRA COPIA DEL PROYECTO
│   │       └── nexa-brief-server/output/               8,09 GB  otra carpeta de videos
│   ├── .cache/                                        7,73 GB
│   │   ├── huggingface/                                3,17 GB  modelo Whisper y caché
│   │   ├── uv/                                         2,49 GB  paquetes Python
│   │   └── ms-playwright/                              1,38 GB  navegadores Chromium
│   ├── .hermes/                                       2,93 GB  agente y herramientas
│   ├── .npm/                                          2,51 GB  caché npm
│   ├── .codex/                                        1,27 GB  sesiones y datos
│   └── otras carpetas y archivos/                     ≈0,30 GB
├── var/                                              84,45 GB
│   ├── lib/                                          82,55 GB
│   │   ├── containerd/                               73,71 GB  ALMACENAMIENTO DOCKER
│   │   │   ├── ...overlayfs/snapshots/                63,06 GB  capas desempaquetadas
│   │   │   └── ...content/blobs/                      10,65 GB  contenido de imágenes
│   │   └── docker/                                    8,34 GB
│   │       └── volumes/                                8,15 GB  VOLÚMENES ANTERIORES
│   │           └── nexa-brief-output/                  7,99 GB  videos del esquema viejo
│   ├── cache/                                         1,68 GB  Netdata + apt, principalmente
│   └── log/                                           0,21 GB
├── usr/                                               4,76 GB  sistema y programas
├── swap.img                                           4,29 GB  archivo de swap de 4 GiB
└── otros archivos y directorios/                     ≈0,01 GB
```

El árbol omite carpetas pequeñas dentro de varias ramas. `du` encontró unos 180,95 GB asignados durante el recorrido; `df` de cierre marcó 180,93 GB. El servidor siguió trabajando durante el escaneo, por lo que no son una instantánea atómica.

## Por qué Docker ocupa tanto

Se midieron físicamente **73.712.873.472 bytes** en `/var/lib/containerd` y **8.338.227.200 bytes** en `/var/lib/docker`: **82.051.100.672 bytes en total**. Son directorios distintos del disco; esta suma sí es válida para esta medición.

En este servidor Docker usa el almacén de imágenes de containerd. Por eso gran parte del espacio aparece bajo `/var/lib/containerd`, aunque `DockerRootDir` diga `/var/lib/docker`. El subdirectorio `docker/buildkit` es pequeño; no representa por sí solo el volumen de capas conservadas por la caché de builds.

`docker system df` informa aproximadamente:

- Imágenes: 71,46 GB; **38,27 GB marcados como recuperables**.
- Caché de builds: 50,89 GB; **21,63 GB marcados como recuperables**.
- Volúmenes locales anteriores: 8,139 GB lógicos.

**No se suman 71,46 + 50,89 GB ni sus dos estimaciones recuperables:** hay capas y referencias compartidas. La medición física conjunta de 82,05 GB evita ese doble conteo. Hay 19 imágenes etiquetadas `before-*`, además de las actuales; se fueron conservando puntos de reversión de despliegues.

La limpieza de estos datos debe hacerse mediante Docker y su política de retención, conservando las imágenes activas y los puntos de reversión necesarios. Los directorios de capas son estructuras internas, no carpetas de videos para retirar manualmente.

## Copias históricas y cachés que conviene revisar primero

| Candidato | Tamaño observado | Qué supone retirarlo |
|---|---:|---|
| Caché de builds Docker recuperable | Hasta unos **21,63 GB**, según Docker | Se regenerará en futuras construcciones; comprobar espacio real liberado con `df` |
| Imágenes Docker anteriores recuperables | Hasta unos **38,27 GB**, según Docker | Revisar qué versiones de reversión se conservan; no sumar esta cifra a la anterior como garantía |
| Dos respaldos de migraciones | **25,53 GB** entre ambos | Comprobar recuperación y conservación fuera del servidor antes de retirar copias |
| Volúmenes Docker del esquema anterior | **8,15 GB físicos** | Validar la migración; los datos activos usan el perfil externo, y los volúmenes listados no tenían contenedores asociados |
| `output/` del worktree `wt-amarillista` | **8,09 GB** | Comprobar que sus grabaciones o trabajos no sean necesarios; no borrar el worktree sin revisar sus cambios |
| Build web `dev.backup-2026-11-01` | **2,76 GB** | Es una copia de build anterior, separada de `.next/dev` |
| Caché npm del usuario | **2,51 GB** | Los paquetes tendrán que descargarse otra vez cuando hagan falta |

Los respaldos de migración, volúmenes antiguos y el `output/` adicional del worktree suman alrededor de **41,8 GB de conjuntos históricos a revisar**, sin contar las imágenes de Docker. No se declaró que cada archivo sea idéntico ni que todo ese volumen carezca de valor.

El perfil profesional vigente de 9,51 GB contiene datos activos. El modelo Whisper de unos 3,09 GB dentro de Hugging Face sirve para transcripción. Las carpetas `.hermes`, `.codex` y los paquetes globales contienen software y datos de herramientas; su tamaño por sí solo no los convierte en residuos.

## Aclaración: `/tmp` no forma parte de estos 180,9 GB

El host monta `/tmp` como **tmpfs**: durante esta revisión tenía unos **3,19 GB** de datos temporales en RAM, con posible respaldo en la swap ya asignada. No son 3,19 GB adicionales en el sistema de archivos raíz. Debe corregirse esa distinción al interpretar el listado del informe inicial.

Para medir únicamente el disco raíz, el escaneo se hizo sobre un montaje de solo lectura sin submontajes recursivos. Así no se sumaron `/tmp`, `/proc`, `/sys`, las imágenes de Snap montadas ni las vistas overlay de contenedores activos como si fueran nuevos archivos del disco raíz.

## Método y evidencia

- Se leyeron tamaños y metadatos; no el contenido de credenciales.
- Se usó la imagen BusyBox que ya estaba instalada, con `--pull=never`, sin red, raíz de contenedor de solo lectura y el disco del host montado en solo lectura. Los dos contenedores de auditoría fueron efímeros y se eliminaron al terminar.
- El recorrido general `du -x -k -d 3` se completó sin errores. También se desplegaron los directorios protegidos de Docker y las ramas grandes del usuario.
- El conteo general evita repetir enlaces duros; las subcarpetas medidas por separado pueden mostrar más bytes que la porción atribuida en un recorrido global si comparten inodos. Por ejemplo, `.local` dio 43,43 GB al medirse aisladamente y 42,08 GB en el recorrido general. Se usa este último para el árbol general. Retirar una copia enlazada no garantiza liberar todo su tamaño hasta quitar la última referencia.
- No se observaron procesos accesibles cuyo directorio de trabajo fuera `wt-amarillista` al cierre. Eso no demuestra por sí solo que sus archivos no se utilicen.
- No se borraron cachés, respaldos, volúmenes, grabaciones ni fuentes; los únicos resultados persistentes nuevos de esta revisión son el informe y su evidencia.

La evidencia está en `arbol-uso-disco-sistema-2026-11-02.evidencia.json`, junto a este documento. Conserva el inventario de tamaños y las mediciones de Docker que permiten abrir otras ramas después.

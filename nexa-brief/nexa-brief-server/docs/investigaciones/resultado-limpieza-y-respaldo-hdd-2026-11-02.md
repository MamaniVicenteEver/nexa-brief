# Resultado de limpieza y respaldo en HDD — 2 de noviembre de 2026

Servidor `alfred-server`. Medición final: 2026-11-02T23:30:34Z (UTC). Tres agentes Terra 6.1 con razonamiento alto realizaron tareas por SSH, con revisión del agente principal. No se hizo commit ni push, ni se aplicó el parche Amarillista.

El uso del SSD raíz pasó de **181,00 GB a 86,65 GB**: **94,35 GB menos**, aproximadamente 52.1 %. Quedaron unos 357,77 GB disponibles según `df`. El valor inicial medido fue 181 GB; los 187 GB indicados por el usuario pertenecen a una observación anterior. Todas las cifras GB de este informe son decimales; padres e hijos del árbol no se suman.

| Zona | Resultado comprobado |
|---|---|
| Capturas antiguas | Eliminados 9.654 JPEG en 30 directorios, 8,38 GB asignados. Se conservaron 30 audios y 30 HTML compilados. |
| Copias de migración en SSD | Retiradas las dos raíces históricas después de verificar 11.302 archivos y el inventario sin filtros. Liberaron 21,34 GB adicionales, después de descontar los JPEG ya eliminados. |
| Volúmenes Docker antiguos | Retirados cuatro volúmenes sin referencias de contenedores, tras respaldar y verificar sus 1.533 archivos. Liberaron 6,75 GB adicionales después de los JPEG. |
| Imágenes y caché Docker | Retiradas 22 etiquetas históricas de 21 IDs, la imagen de demostración hello-world y caché no usada. Se conservaron imágenes, capas y ancestros necesarios. |
| Amarillista | Conservado el directorio experimental: 9,58 GB tras retirar sus JPEG. Rescatadas sus variantes en el HDD; ningún cambio aplicado al servicio. |
| Proyecto y datos operativos | Conservados en sus rutas originales. API y web saludables; túnel activo al terminar. |

El ahorro global se mide con `df`. Los tamaños de imágenes, caché, capas comprimidas y snapshots pueden compartir almacenamiento: **no deben sumarse entre sí ni a los JPEG/volúmenes anteriores**. Los 25,53 GB originales de respaldos incluían 4,19 GB de JPEG; después de retirarlos quedaban los 21,34 GB que se retiraron del SSD.

## Árbol final del SSD

```text
/                                               86,65 GB usados
├── home/alfred/                                 59,17 GB
│   ├── Projects/Git-Projects/                   19,12 GB
│   │   └── nexa-brief/                          17,47 GB  proyecto original
│   ├── .local/                                 15,15 GB
│   │   ├── share/                               9,72 GB
│   │   │   └── nexa-brief/profiles/profesional/   8,12 GB  datos activos
│   │   │       └── output/                       6,80 GB
│   │   └── lib/                                 4,07 GB  paquetes instalados
│   ├── codex/nexa-brief/                        10,11 GB
│   │   └── wt-amarillista/                       9,58 GB  conservado para revisión
│   ├── .cache/                                  7,73 GB
│   │   ├── huggingface/                         3,17 GB  modelos/caché
│   │   ├── uv/                                  2,49 GB
│   │   └── ms-playwright/                       1,38 GB  navegadores
│   ├── .hermes/                                 2,93 GB
│   ├── .npm/                                    2,51 GB
│   └── .codex/                                  1,31 GB
├── var/                                        18,41 GB
│   ├── lib/                                    16,49 GB  principalmente Docker/containerd
│   ├── cache/                                   1,69 GB
│   └── log/                                     0,22 GB
├── usr/                                         4,76 GB
└── otros archivos y directorios                 diferencia hasta el total
```

El árbol utiliza bloques asignados y no sigue enlaces de `data`/`output`. No incluye el HDD ni `/tmp`, que es tmpfs. Las cachés restantes no se eliminaron indiscriminadamente: modelos y navegadores pueden ser necesarios para las funciones actuales.

## Un respaldo por carpetas en el HDD

Destino: `/home/alfred/.local/mnt/nexa-backups/nexa-brief/`, aproximadamente **12,49 GB físicos**. Partición existente `/dev/sdb3`, etiqueta VideosImagenesOtros, UUID `6E2621FB2621C4C5`. No se formateó. El HDD conserva sus datos anteriores y tiene aproximadamente 472,75 GB disponibles. Montaje persistente NTFS3 con `nofail`, propietario Alfred y permisos privados; fstab validado y su versión anterior conservada.

```text
nexa-brief/                   único respaldo consolidado
├── proyecto/                 fuentes, Git, index, recursos, medios y renders
├── datos/                    perfil profesional, output y estado de la aplicación
├── recuperacion/             únicamente versiones distintas de migraciones,
│                             volúmenes antiguos y experimento Amarillista
├── manifiestos/              mapa de rutas, hashes, permisos y verificaciones
├── RESTAURAR.py              reconstrucción hacia una carpeta nueva
└── LEEME.txt                 alcance y uso
```

Archivos idénticos en el proyecto y los datos se conservan con enlaces duros dentro del respaldo: las rutas existen y comparten una sola copia física. En los históricos se omiten archivos idénticos y se registra su destino en `archivos.jsonl`; la reconstrucción usa ese mapa. Los dos respaldos antiguos solo añadieron **249,66 MB** de variantes; Amarillista añadió **68,94 MB** y los volúmenes **21.118 bytes**. Las variantes incluyen estado y credenciales privadas copiadas sin mostrar su contenido.

Se excluyeron entornos regenerables (`.venv`, `node_modules`, `.next`), cachés seleccionadas, bytecode y directorios de captura. También se excluyeron 917 PNG de comparación visual de `src/.../japon-expansion-prueba/work/results/` (1,13 GB lógicos, 0,24 GB físicos por los enlaces idénticos). Sus originales siguen en `src`; no son recursos de producción. No se excluyeron indiscriminadamente los demás `work/`, guiones, audios, recursos ni índices. Un segundo inventario **sin filtros** comprobó que en las dos copias históricas y los cuatro volúmenes no quedó ningún archivo sin respaldo: 11.302 + 1.533 archivos regulares, sin enlaces ni tipos especiales. Se registraron también 2.089 + 301 directorios y sus atributos.

Validación: 31.401 entradas del respaldo del host; 14.518 contenidos destino distintos verificados por SHA-256 y los 11.302 archivos históricos cotejados con sus fuentes; 1.533 archivos de volúmenes cotejados con sus fuentes y destinos. La retirada de las dos raíces históricas volvió a comprobar contenido y estabilidad de ambas antes del primer borrado y vinculó la operación al hash del manifiesto. Cero errores. Esa verificación incluyó inicialmente los 917 PNG de QA; su exclusión posterior comprobó que ningún otro registro dependía de esas rutas y conservó el manifiesto anterior para auditarlo. El manifiesto actual contiene 32.017 entradas, incluidos los volúmenes. Se probaron cinco archivos restaurados del respaldo de octubre y una sección pequeña completa de web-data, con contenido y modos correctos; los cambios de UID/GID de la segunda requieren ejecutar el restaurador como root.

El respaldo de datos actuales se copió por archivo estable mientras el sistema seguía funcionando; no es un snapshot transaccional global ni una restauración completa de la aplicación ensayada. Los datos operativos y las fuentes siguen en sus rutas habituales; se retiraron las capturas autorizadas y las copias históricas verificadas. La credencial externa del túnel Cloudflare no se copió, conforme a las reglas del proyecto. No se instaló una programación automática de respaldos.

Los enlaces de la copia se ajustaron para resolver dentro del propio HDD: diez de diez, con sus destinos originales registrados. Para restaurar, usar una carpeta nueva; no editar directamente archivos del respaldo enlazados entre sí. Los manifiestos y `RESTAURAR.py` deben conservarse junto con las carpetas.

## Qué ocupa src

```text
nexa-brief-server/src/                            8,11 GB
├── templates/                                   8,10 GB
│   ├── nodemotion/                              2,40 GB
│   │   ├── lyrics/                              1,24 GB
│   │   └── commercial/                          1,14 GB
│   ├── nodeatlas/                               1,60 GB
│   │   └── japon-expansion-prueba/
│   │       ├── work/                            1,19 GB
│   │       │   └── results/                      1,15 GB
│   │       └── assets/                          0,41 GB
│   ├── sandbox/                                 1,51 GB
│   ├── nodetech/                                1,06 GB
│   ├── nodepolitics/                            0,59 GB
│   ├── nodehistory/                             0,55 GB
│   ├── _tools/                                  0,37 GB
│   └── nodeeconomy/                             0,02 GB
├── core/                                        4,26 MB
├── adapters/                                    3,01 MB
├── skills/                                      2,71 MB
└── presentation/                                1,73 MB
```

Casi todo el tamaño corresponde a plantillas, medios, previews y resultados, no al código Python. `.venv` ocupa aparte 1,30 GB. El estudio detectó ocho renders con duplicado comprobado (244,71 MB), pero no se eliminaron de `src`: algunas rutas pueden estar referenciadas. De los 1,15 GB de resultados de Japón, 1,13 GB son 917 PNG de comparación antes/después; ya se excluyeron del respaldo, pero permanecen en el original para la revisión solicitada. Estos resultados y el preview grande de Imperio son candidatos a revisión individual, no una autorización para borrar todos los `work/`.

## Dictamen de Amarillista

El motor de hilo/Amarillista ya está parcialmente en el sistema activo. Del parche de 58 rutas, 31 son idénticas, 21 distintas y seis faltan en la misma ruta actual: cuatro componentes/diseños y dos tests de integración. La prueba `git apply --check` falla. Copiarlo completo podría revertir cambios posteriores en adaptadores y motor compartido.

**No aplicar el parche completo.** Primero revisar los dos tests, los cuatro diseños y las diferencias compartidas por funcionalidad. El inventario amplio conserva 208 archivos fuente/recursos distintos por ruta (29,19 MB), además de notas, parche y otras variantes del experimento. No se ha establecido que cada diferencia sea una mejora ni se volvió a ejecutar la batería histórica. El directorio experimental sigue en el SSD; no se retirará como parte de esta intervención. Detalle en `amarillista-y-desglose-src-2026-11-02.md`.

## Prevención Docker y explicación del crecimiento

Los comandos habituales `make docker-build`, `scripts/docker-refresh.sh` y la verificación Docker ejecutan limpieza tras sus pasos exitosos. Protegen `latest`, imágenes usadas por cualquier contenedor y ancestros, y etiquetas ajenas al proyecto; retiran históricos Nexa sin forzar. La caché compartida se limpia con objetivo de 5 GB. La vista de Docker aún declara 10,56 GB de caché, que puede incluir contenido compartido/protegido: el objetivo no constituye un límite físico estricto. `docker compose build` directo omite este hook; usar los comandos documentados.

Se corrigió el Dockerfile para copiar `.venv` una sola vez: la etapa build ya hereda las dependencias. Ese cambio se aplicará a la próxima imagen; no se reconstruyeron ni reiniciaron los servicios en esta limpieza. Validación: sintaxis Bash, Make en seco y simulación de las protecciones de latest, contenedores detenidos, ancestros, etiquetas ajenas e inspección fallida. No se ensayó un build real nuevo.

Los dos videos completos de “Tu voz, su estafa” pesan 46.159.772 y 50.213.392 bytes: **96,37 MB en total**. La prueba real anterior de 20 segundos produjo dos MP4 de 4,44 MB combinados y unos 10,46 MB retenidos incluyendo copias y telemetría; las capturas temporales normales se limpiaron. No hay medición previa que permita atribuir exactamente el salto histórico 160→187 GB a ese render. La ocupación encontrada se concentraba en imágenes/caché Docker acumuladas, respaldos duplicados y capturas de octubre replicadas en seis lugares.

La revisión automática rechazó inicialmente borrar las carpetas completas de captura por incluir audios e índices. Se usó la alternativa más acotada: borrar solo los JPEG verificados y conservar esos archivos; al retirar posteriormente los respaldos antiguos, su contenido completo ya estaba preservado en HDD.

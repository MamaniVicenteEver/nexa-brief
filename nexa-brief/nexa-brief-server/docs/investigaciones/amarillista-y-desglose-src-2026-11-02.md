# Amarillista y desglose de src — revisión de solo lectura

Servidor `alfred-server`, 2 de noviembre de 2026. Base: `/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server`. Medidas `du` en GiB/MiB salvo indicación; las del estudio previo en GB decimales son bytes asignados. Ningún cambio en el servidor, aplicación de parche ni reinicio se realizó para este análisis. Los datos son una fotografía y deben comprobarse otra vez antes de cualquier limpieza.

## Dictamen sobre wt-amarillista

El trabajo de Amarillista sí aporta historial y materiales de prueba, pero buena parte del motor **ya está en el sistema actual**. No hay evidencia de que el worktree sea necesario para ejecutar el servicio: el estudio previo no encontró referencias en procesos, servicios ni scripts revisados. No implica que se pueda eliminar sin conservar sus diferencias y su contexto.

`CAMBIOS.md` describe narrativa en hilo de 5–7 láminas, verificación de entrada sin red, redacción/cotejo con respaldo, copy auditable y render con recursos existentes. Sus propias notas reportan 261 tests unitarios y nueve integraciones con modelos simulados; una prueba real de texto usó DeepSeek tras indisponibilidad de Codex. Esos resultados son históricos, no se volvieron a ejecutar ni demuestran comportamiento actual ni aprobación editorial universal.

El parche `amarillista.patch` contiene 58 rutas (7.256 inserciones y 123 eliminaciones). Comparando con SHA-256 cada ruta del parche entre la copia y la versión actual: **31 idénticas, 21 distintas y 6 ausentes en la misma ruta actual**. Entre las idénticas están `input_check.py`, estrategia `amarillista.py`, configuración y varios tests; entre las distintas `hilo_pipeline.py`, `render_post.py`, `service.py`, adaptadores, motor visual y roles. Las seis ausentes son dos pruebas de integración y cuatro archivos de componentes/diseño atlas, dinero y motion. Ausencia en la misma ruta no prueba ausencia de una función equivalente en otro lugar.

`git apply --check --directory=nexa-brief` desde la raíz Git correcta falla en numerosas rutas: incluye archivos ya presentes y cambios en código compartido. **No aplicar el parche acumulado ni copiar los 21 archivos divergentes encima del sistema actual**; un cambio viejo podría revertir funcionalidad posterior y tocar adaptadores/roles comunes. La prueba histórica de dry-run descrita en CAMBIOS correspondía a copias temporales de una base anterior y no valida el estado de hoy.

La comparación más amplia de fuentes y recursos, distinta del alcance del parche, arrojó 1.023 fuentes idénticas, 171 diferentes y 26 ausentes por ruta; 481 recursos no MP4 idénticos y 13 ausentes por ruta. Descontando solapamiento son **208 archivos distintos, 29.185.979 bytes lógicos**. Incluyen la carpeta experimental `sandbox/nodepolitics/imperio-demo`, dos audios y medios asociados, seis archivos `tiktok_web`, los cuatro diseños y dos pruebas citados. No todos son cambios de Amarillista ni mejoras: el inventario incluye evolución general y rutas reubicadas. No se ha hecho revisión semántica de los 208 ni cotejo por hash global de todos los recursos no MP4; no afirmar que cada uno es único globalmente. Los 228 MP4 de `src` de la copia tienen equivalente SHA-256 en el original; los 252 de su `output`, en el perfil activo.

Orden seguro propuesto: guardar en respaldo verificable los 208 archivos, parche, CAMBIOS, BITACORA, pruebas e inventarios de hashes; conservar el mapa de rutas de MP4 reubicados. Revisar selectivamente los dos tests de integración y cuatro diseños para determinar utilidad y equivalentes actuales; comparar los 21 archivos compartidos por funcionalidad, con base histórica si se obtiene, y portar solo mejoras justificadas en una copia aislada con pruebas relevantes. Respetar las instrucciones del repositorio y una ventana sin producciones: `uvicorn --reload` reinicia al editar Python bajo `src`. El descarte eventual de toda la copia requiere verificar el rescate, no está recomendado de inmediato.

## Árbol semiabierto de src original

`src` ocupa aproximadamente **8,10 GB decimales / 7,6 GiB físicos**, de los cuales casi todo es `templates`. Cifras redondeadas y anidadas: no sumar padres con hijos.

```text
src/                                      7,6 GiB
├── templates/                            7,6 GiB
│   ├── nodemotion/                       2,3 GiB
│   │   ├── lyrics/                       1,2 GiB  proyectos musicales y sus recursos
│   │   └── commercial/                   1,1 GiB  promos; _source 82 MiB
│   ├── nodeatlas/                        1,5 GiB
│   │   └── japon-expansion-prueba/       1,5 GiB
│   │       ├── work/                     1,2 GiB  incluye results 1,1 GiB
│   │       └── assets/                   388 MiB  sound-design 358 MiB
│   ├── sandbox/                          1,5 GiB  prototipos y referencias
│   │   ├── nodehistory/                  616 MiB  _referencias 340 MiB
│   │   ├── nodeaction/                   375 MiB
│   │   ├── nodeeconomy/                  130 MiB
│   │   ├── referencias/                  126 MiB
│   │   └── nodemotion/                   118 MiB
│   ├── nodetech/                        1015 MiB  fuentes, recursos, work y render
│   │   ├── programadores-nueva-era/      241 MiB  work 111 MiB; render 111 MiB
│   │   └── clonan-tu-voz-.../            236 MiB  assets 66; work 73; render 98 MiB
│   ├── nodepolitics/                     561 MiB
│   │   └── imperio-demo/render/          535 MiB  preview 534 MiB
│   ├── nodehistory/                      521 MiB
│   │   └── y2k-medianoche/               136 MiB  work 89; assets 47 MiB
│   ├── _tools/                           354 MiB
│   │   ├── hyperframes/media_originals/  281 MiB  medios originales
│   │   └── explainer-kit/                 73 MiB  motor, diseños, herramientas
│   └── nodeeconomy/                       17 MiB
├── core/                                 4,1 MiB
├── adapters/                             2,9 MiB
├── skills/                               2,6 MiB
└── presentation/                         1,7 MiB
```

Clasificación: plantillas, HTML, JSON, código, guiones, medios de `assets`, `_source`, `media_originals` y referencias pueden ser necesarios para restaurar/editar; conservarlos y su relación con licencias. `render/` contiene exportaciones y previews que pueden regenerarse si el proyecto y el entorno son completos, pero algunas pueden ser la única copia disponible. `work/` mezcla estado, audio, storyboard, recursos y resultados; no tratarla toda como basura. `work/results` de Japón (1,1 GiB) y `imperio-demo/render/preview` (534 MiB) merecen inventario individual y revisión de uso/duplicados antes de decidir. Cachés `__pycache__` y entornos son regenerables con dependencias disponibles; `.venv` de 1,29 GB y `.cache` de 0,04 GB están **fuera** de `src`, por lo que no se suman a su desglose. No se comprobaron aquí dependencias de ejecución de cada archivo.

## Candidatos concretos, no eliminación automática

El inventario previo halló 31 MP4 bajo `render/` (1,25 GB lógicos); solo **ocho, 244.711.757 bytes**, coinciden por tamaño y SHA-256 con archivos de `output` activo. Son candidatos revisables, no prueba de que sus rutas no se usen. Los ocho son:

- `nodetech/clonan-tu-voz-con-3-segundos-de-audio-las-llamad/render/`: 16x9 y 9x16 completos y los dos previews de 20 s.
- `nodetech/programadores-nueva-era/render/`: 16x9 y 9x16 completos.
- `nodehistory/turing-enigma/render/preview/`: 16x9 y 9x16 de 10 s.

Rutas completas, hashes y equivalentes: `/tmp/nexa-duplicate-study-20261102/inventory.json` en el equipo de análisis y copia de evidencia del estudio en el servidor bajo `~/.local/share/nexa-brief/profiles/profesional/reports/consolidacion-20261102/`. Comprobar que el destino activo siga presente, revisar referencias y respaldo, y solo entonces decidir si retirar cada copia local. Los otros 23 MP4 no cuentan con duplicado confirmado en ese perfil. La búsqueda previa no encontró en `src` los `frame_<número>.jpg/jpeg/png` ni los `work-*` históricos inventariados fuera de `src`.

Fuentes: estudio `docs/investigaciones/estudio-consolidacion-backups-frames-docker-hdd-2026-11-02.md`; `/tmp/nexa-worktree-source-hashes-20261102.json`, `/tmp/nexa-worktree-template-assets-hashes-20261102.json`, `/tmp/nexa-worktree-runtime-refs-20261102.json` y `/tmp/nexa-duplicate-study-20261102/worktree-src-mp4.json` en el equipo de análisis. No se consultaron credenciales ni archivos prohibidos.

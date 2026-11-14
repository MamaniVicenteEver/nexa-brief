# Biblioteca de capas · contrato 1

Una biblioteca compartida por cualquier diseño del explainer-kit. El catálogo
principal comienza con `assets: []`: no contiene material experimental ni inventa
un personaje aprobado. El fixture de desarrollo tiene un catálogo independiente
en `tests/fixtures/`; sus máscaras son aproximadas y su licencia de origen es
desconocida. No sirve como material aprobado de publicación.

## Agregar una imagen o un personaje

1. Confirmar el perfil efectivo con **bash**, desde la raíz del repositorio:
   `source scripts/profile-env.sh`, comprobar `NEXA_PROFILE_DIR`, su ruta real y
   `profile.json`. No imprimir `.env`. El perfil no se copia al repositorio.
2. Registrar el original y la licencia en
   `$NEXA_PROFILE_DIR/resources/images/<resource-id>/resource.json` según
   `src/skills/MEDIOS.md`. Guardar el editable en `masters/<asset-id>.xcf`.
3. Añadir **un asset por personaje**, con todas sus poses dentro de `poses`.
   La ficha tiene identidad, descripción narrativa en español, etiquetas,
   procedencia, licencia, revisión, lienzo, pivote, altura de referencia,
   zonas, animaciones, valores predeterminados y límites. El esquema exacto está
   en `schema/catalog.schema.json`. Desconocidos: `null`; licencia desconocida:
   `"desconocida"`. Comenzar con `status: "con-defectos"` hasta revisar.
4. Exportar cada pose RGBA transparente conservando **el mismo lienzo**. Usar
   `assets/<asset-id>/<pose>.webp` sin pérdida o PNG RGBA. No recortar cada pose
   por separado: desplazaría las anclas y el pivote.
5. Calcular SHA-256 de cada exportación en `poses.<pose>.sha256`. El exportador
   lo actualiza. Al cambiar una exportación, ancla o zona aprobada, subir
   `asset.version` y repetir la revisión.

`pivot: [x,y]` es el apoyo (pies/base) en píxeles del lienzo. La posición de escena
se refiere a él. `height_ref` es la altura de pie en píxeles, común a todas las
poses; escala 1 representa el 60 % del alto del cuadro.

## Poses, anclas y máscaras

- Añadir cada pose a `poses`, con `file`, `sha256`, `anchors`, `masks` y notas
  opcionales. `default_pose` debe existir. No crear otro asset por cada pose.
- Una ancla es `[x,y]` en píxeles de la pose: comprobar su contacto real con la
  imagen. `validate` exige un píxel con alfa ≥128 a distancia ≤6 px. Los nombres
  de `asset.anchors` se garantizan en **todas** las poses; pueden existir anclas
  extra específicas de una pose. Una conexión exige su ancla en cada pose usada
  durante el beat, incluidos los cambios de pose de eventos.
- Declarar cada zona como `color_zones.<zona>: {default:"#RRGGBB",doc:"…"}`.
  Cada pose necesita su máscara en
  `assets/<asset-id>/<pose>.<zona>.png`: gris `L` o `1`, mismo lienzo, blanco
  donde se aplica el color, negro fuera; los grises suavizan bordes. Las zonas
  ajenas a la silueta se recortan por su alfa. No exportar máscaras RGB.
- `estilo.brillo` y `defaults.rim` son colores de luz de borde; `halo`/`glow`
  van de 0 a 1; `sombra`/`shadow` son booleanos. `silueta` rellena de tinta y
  conserva la luz de borde. `zonas` sustituye colores por máscara.

## Exportar desde el XCF

El maestro declarado en `master: {resource_id,file}` se busca dentro de
`$NEXA_PROFILE_DIR/resources/images/<resource_id>/<file>`, normalmente
`masters/<asset-id>.xcf`. Preparar capas de nivel superior, al tamaño completo
del lienzo, llamadas **`pose:<pose-id>`** y **`mask:<pose-id>:<zona>`**.
Cada capa de pose debe contener el compuesto completo de esa pose; una máscara
contiene su cobertura en gris. Conservar el XCF editable como original.

Con `gimp-console`, `gimp-console-3.0` o `gimp-console-2.10` instalado:

```bash
# Desde la raíz del repositorio, con bash y el perfil ya comprobado:
source scripts/profile-env.sh
nexa-brief-server/.venv/bin/python nexa-brief-server/src/templates/_tools/explainer-kit/tools/capas.py export ejecutivo
```

El CLI soporta Script-Fu de GIMP 2.10 y Python-Fu de GIMP 3, exporta a un
directorio temporal, normaliza RGBA/máscaras L con Pillow, escribe los destinos
declarados y actualiza hashes. No cambia el estado de aprobación.

**Esta máquina no dispone de GIMP Console.** El comando falla con un mensaje
explícito. Exportar en la máquina donde se preparan los XCF y está instalado
GIMP; traer únicamente las exportaciones a `capas/assets/` y la ficha al
catálogo. Después ejecutar `validate` y `sheet` aquí. No trasladar maestros ni
credenciales al repositorio. La rama real GIMP requiere esa máquina; aquí se
verifica el error de ausencia y no se simula una exportación exitosa.

## Escenas y API

`designs/common/capas.js` registra `common.capas`; cada diseño decide cargarlo
en sus scripts. El componente carga `runtime/capas.js` bajo demanda y el núcleo
espera su hook `prepare` antes del primer cuadro, también al capturar o buscar.
No se habilita automáticamente en diseños existentes.

| Parámetro | Forma |
|---|---|
| `elenco` obligatorio | `[{id,asset,pose?,x?,y?,escala?,profundidad?,espejo?,estilo?,entrada?,anim?}]` |
| `fondo` | `{preset,color,acento,grano,vineta}`; presets foco/degradado/horizonte/ciudad/sala/rayos/liso |
| `camara` | `{mov,intensidad}`; acercar/alejar/paneo-izq/paneo-der/fijo/temblor; intensidad 0..0.2 |
| `conexiones` | `[{de:"id:ancla",a:"id:ancla",tipo:"hilo\|linea\|cadena",color?}]` |
| `eventos` | `[{en,id,accion,valor}]`, segundos locales del beat |
| `textos` | `[{texto,pos?,estilo?,color?}]`; arriba/centro/abajo; titulo/subtitulo/etiqueta |
| `formato` | `{"9x16":{elenco:{id:{x?,y?,escala?,profundidad?,espejo?}}},"16x9":{…}}` |

Coordenadas/profundidad, grano, viñeta y halo: 0..1. Escala: .05..5 y dentro
de los límites del asset. `espejo` es booleano. Entrada:
`{anim:"entrar-sube|entrar-cae|entrar-desliza",dur:segundos}`.
Las acciones de evento son `pose` (ID de pose), `mover` (`{x,y,dur}`),
`escala` (`{valor,dur}`), `color` (`{zona,color,dur}`), `silueta` (booleano),
`salir` (`"salir-cae"|"salir-funde"`) y `anim` (ID compatible).
Las interpolaciones usan smoothstep y parten del valor vigente al interrumpir
otra transición. Pose y silueta cambian en el segundo indicado. Una salida
dura .5 s; las animaciones continuas toman tiempo local desde su activación.

El kit solo resuelve `@palabra` en parámetros de primer nivel: **no** en
`eventos[].en`. Aquí se exigen segundos y cada transición debe terminar dentro
del beat. Los overrides de formato cambian la colocación inicial; los destinos
de eventos siguen siendo los expresados en los eventos.

El esquema de escena es cerrado, JSON Schema 2020-12. Se rechazan claves
desconocidas, rutas, URL, HTML, colores distintos de `#RRGGBB`, referencias
inexistentes, assets sin aprobar, duplicados y números fuera de rango.
Una escena inválida muestra una tarjeta completa de error, sin figuras parciales.
`kit.py check` la rechaza incluso si `minDur` de otra escena la ocultaría.

API de `Kit.capas` para herramientas y pruebas:

```js
await Kit.capas.load();                         // catálogo y esquemas locales
Kit.capas.validateCatalog(catalog);             // string[] (estructura/referencias)
Kit.capas.validateScene(params, catalog, dur);   // string[]; idéntico veredicto Python
await Kit.capas.prepare(params, dur);            // {errors,media,ready,scene}
const inst = Kit.capas.create(ctx, params, dur); // ctx.g.main,ctx.stage,ctx.C
inst.render(t);                                // t local, determinista
inst.anchors(t);                               // puntos ya transformados
inst.stats();                                 // superficies, máscaras, tintes, píxeles
inst.dispose();                               // libera superficies de esa instancia
Kit.capas.clear();                             // descarta precargas al cerrar un consumidor
```

`configure({catalog,sceneSchema,catalogSchema,baseURL})` es una API de herramientas
confiables para fixtures; no es un parámetro de escena. El runtime carga un
máximo de dos archivos a la vez. Medios decodificados: **64 MiB / 128 archivos**
por página; composiciones: **128 MiB** por instancia. Si se exceden, se muestra
una tarjeta con la causa, sin asignar más superficies. Las composiciones se
rasterizan a la resolución necesaria para el formato, hasta el tamaño original;
las anclas siempre conservan las coordenadas originales. Los tintes se cachean
por asset, pose, zona y color; las máscaras se leen una sola vez por instancia,
sin `getImageData` por cuadro. No hay timers, observadores ni bucles propios.

## Animaciones

`entrar-sube`, `entrar-cae`, `entrar-desliza`, `salir-cae`, `salir-funde`,
`respirar`, `flotar`, `temblar`, `girar`, `caer`, `latir` están implementadas como
funciones del tiempo. La ficha de cada asset admite un subconjunto compatible.
Para añadir otra: implementar `motion` en el runtime, declararla en los enums
de ambos esquemas y el catálogo, actualizar `tools/capas.py:ANIMATIONS`,
documentarla y añadir casos de compatibilidad Python/JS y capturas de seek.
No se aceptan expresiones, funciones ni código en el catálogo o la escena.

## Comandos y revisión

Desde `nexa-brief-server/` (`K=src/templates/_tools/explainer-kit`):

```bash
.venv/bin/python $K/tools/capas.py validate
.venv/bin/python $K/tools/capas.py list --tags poder,control --json
.venv/bin/python $K/tools/capas.py scene-check storyboard.json
.venv/bin/python $K/tools/capas.py scene-check beat.json --duration 6
.venv/bin/python $K/tools/capas.py sheet ejecutivo
.venv/bin/python $K/tools/capas.py export ejecutivo
# El selector --catalog va ANTES del subcomando:
.venv/bin/python $K/tools/capas.py --catalog $K/capas/tests/fixtures/catalog.json validate
.venv/bin/python $K/tools/capas.py --catalog $K/capas/tests/fixtures/catalog.json sheet ejecutivo --output /tmp/ejecutivo.jpg
.venv/bin/python -m pytest tests/unit/test_capas.py tests/unit/test_capas_storyboard.py -q
node $K/capas/tests/validation.cjs
node $K/capas/tests/preparation.cjs
.venv/bin/python $K/tools/capas_qa.py --output /home/alfred/codex/nexa-brief/titanes/capas-motor
```

`scene-check` acepta beat o storyboard, valida cada `common.capas` y exige `dur`
numérico cuando todavía no se han resuelto los tiempos. El check completo del
kit usa duración efectiva resuelta. `kit.py check archivo.json` también permite
esa comprobación aislada sin crear proyectos; `kit.py check <video-id>` conserva
las verificaciones editoriales existentes.

Mirar la hoja de **cada pose**, sobre claro/oscuro/damero, zonas teñidas y anclas;
revisar transparencia, huecos, halos, contacto, coherencia y licencia. Guardar
el resultado en `review`, con autor, fecha, hoja y defectos. Solo una revisión
explícita permite pasar el asset a `aprobado`. Después revisar el componente
en 16:9 y 9:16: cambios de pose, color, hilos, sombra/halo y profundidad, además
de la tarjeta de error. El script QA captura seis instantes por formato, mide
150 cuadros, comprueba seek determinista y cinco reaperturas del beat, y cierra
su navegador/servidor. El fixture nunca se mezcla con el catálogo principal.

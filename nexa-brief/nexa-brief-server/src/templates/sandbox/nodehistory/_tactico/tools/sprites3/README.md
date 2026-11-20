# Sprites militares

Esta tanda es independiente de `sprites2`. El catálogo `sprites3/sprites3.json` se puede elegir mediante `scene.spriteManifest`; no se fusiona automáticamente con el catálogo del motor. Conserva `file`, `mask`, `tint_mask`, `anchor`, `bow`, `length_relative`, `variant`, `states` y los metadatos de escala física/editorial. El campo adicional `livery` describe la pintura.

Cada terrestre tiene nombre base para `olive`, sufijo `-desert` y sufijo `-camo`; cada librea tiene `normal`, `detected`, `burning` y `wrecked`. La máscara de tinte es vacía deliberadamente para que la pintura y las marcas sanitarias no se conviertan en pintura de identidad. La máscara de sombra contiene la silueta alfa negra y se desplaza al dibujar.

Los IDs civiles `ship-tug` y `ship-tanker-vlcc` se reemplazan por `ship-landing-craft` y `ship-oiler`. La plataforma petrolera también se reemplaza por `ship-support-platform`, una base naval logística con defensa y comunicaciones. Las esloras relativas de los tres puestos se conservan por compatibilidad editorial; sus `length_m` son los valores heredados orientativos, no certifican una clase de embarcación.

El modo seguro impidió cargar bibliotecas `.blend`. Se reconstruyeron por MCP los modelos reproducibles de `sprites2`, se añadieron detalles militares y se crearon shaders PBR propios. Ninguna construcción de vehículo ocurre en el render headless. El código exacto enviado al MCP está en `mcp-sources.zip`, como `<id>.py.txt`: conserva las 50 fuentes completas y reduce duplicación sin modificar los píxeles. `mcp-source-hashes.json` verifica su contenido. `build-sources.py.txt` prepara el código y `materials.py.txt` contiene los materiales y añadidos de campaña. Las revisiones de malla están en `evidence/<id>-qa.json`.

Reproducción:

1. Leer `<id>.py.txt` de `mcp-sources.zip` (o extraerlo en `/tmp`) y enviar su contenido como `code` a `mcp__blender_servidor__execute_blender_code`, con `user_prompt` literal `EL VEHÍCULO TIENE QUE SER MILITAR, TODO MILITAR`. Colección propia `AEM_militar/AEM_M3_<id>`, raíz X=18000; no sustituir ni borrar datos ajenos. La lectura del ZIP ocurre en el host; Blender recibe exclusivamente el código seguro, sin imports externos ni `exec`.
2. Ejecutar `SPRITE='<id>'` más `qa.py.txt` por MCP, revisar con `look(mode='angles', views=['top','three_quarter'], shading='material', max_size=512)` y guardar mediante `bpy.ops.wm.save_as_mainfile(..., copy=True, compress=True)`. Retirar exclusivamente la colección propia después de guardar.
3. Renderizar una copia a la vez; el script limpia únicamente los datos de su proceso separado:

```sh
nice -n 19 /home/alfred/.local/bin/blender \
  --background ../_tactico/sprites3/blend/tank-main.blend --threads 1 \
  --python ../_tactico/tools/sprites3/render-final.py.txt -- \
  --sprite tank-main --output /tmp/aem-militar-raw \
  --blend ../_tactico/sprites3/blend/tank-main.blend
```

4. Al terminar todos los renders:

```sh
nice -n 19 ../../../../../.venv/bin/python \
  ../_tactico/tools/sprites3/postprocess.py.txt --raw /tmp/aem-militar-raw
nice -n 19 ../../../../../.venv/bin/python \
  ../_tactico/tools/sprites3/validate.py.txt
```

`configure-output.py.txt` registra la adaptación inicial del posproceso copiado; no se debe volver a ejecutar sobre una adaptación ya configurada. No editar un script mientras se ejecuta. No se generaron videos.

Pinturas dieléctricas mate; metal expuesto, caucho, vidrio y lona con parámetros específicos. Camuflaje de tres tonos mediante ruido 3D en coordenadas comunes de la raíz, determinista y sin UV repetidos. Ruido fino para suciedad/polvo y microrelieve; Pointiness para rozaduras en biseles; hollín y estiba complementados con geometría. La pintura de neumáticos conserva caucho sucio, las orugas llevan barro. No hay mapas externos, banderas, matrículas ni textos. Cruz y media luna están sobre un cuadro blanco local; carrocería oliva/arena/camuflada.

La imagen se renderiza ortográfica, con alfa, sol arriba a la izquierda, Cycles CPU, ocho muestras y denoise. Se usa un hilo; `render-adaptive.py.txt` admite `--cpu-threads 2` únicamente después de comprobar que la carga de un minuto en `/proc/loadavg` es menor de 2, según el brief. Cada elección se registra en `evidence/<id>-execution.json` y los tiempos guardan los hilos reales. El PNG fuente RGBA de 1152 px se recorta simétricamente y se entrega a 1024 px de lado largo. Los archivos finales usan PNG indexado con alfa, 96 colores opacos y niveles de alfa canónicos 0,4,…,248,255; los bordes translúcidos son oscuros. Todos los estados mantienen exactamente el mismo alfa y ancla. Los daños PIL son deterministas, estáticos y limitados a la silueta; humo y fuego animados corresponden al motor.

`hoja3.png` compara los cuatro estados de las cincuenta libreas en océano y desierto. `hoja3-escalas.png` muestra cada una a 120, 240 y 480 px en ambos fondos; abrir al 100 %. Los fondos procedurales y todos los modelos/materiales añadidos son propios. Las referencias se observaron sin copiar sus píxeles. `source-hashes.json` permite verificar que la tanda anterior no cambió.

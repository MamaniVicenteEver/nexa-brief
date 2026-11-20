# Sprites de vehículos — extensión aislada

24 modelos originales creados por `execute_blender_code` del MCP `blender_servidor`, con las skills locales `blender-core`, `blender-pbr-materials` y `blender-asset-qa`. Colección temporal `AEM_vehiculos`, subcolecciones `AEM_<id>` y raíz X=12000. La sesión compartida conserva su escena, motor, selección y unidades; las colecciones propias se retiraron tras guardar cada modelo.

## Archivos y reproducción

- `originals/`: copias intactas de las seis herramientas solicitadas; hashes en `source-snapshot.json`. Nunca se modificaron los originales de `../sprites/`.
- `models.py.txt`: extensión de sus primitivas volumétricas y materiales para creación por MCP seguro. No se ejecuta mediante Blender headless.
- `<id>.py.txt`: código exacto de la creación aceptada por el MCP, incluyendo reparaciones cuando correspondan. Enviar su contenido como `code` a `execute_blender_code`; conservar el `user_prompt` literal del brief. No ejecutar sobre una colección existente del mismo nombre.
- `qa.py.txt` + `evidence/<id>-qa.json`: comprobaciones reales de malla evaluada y shaders, efectuadas por MCP.
- `evidence/<id>-lifecycle.py.txt`: guardado como copia y retirada de los objetos propios.
- `render-final.py.txt`: render de un `.blend` YA modelado, en proceso independiente; no construye geometría del vehículo. Crea un estudio limpio, sin Freestyle, compositor ni secuenciador heredados.
- `render.py.txt`: primera prueba descartada por heredar Freestyle. No usar para la entrega final.
- `isolate-saved.py.txt`: limpieza de datos ajenos exclusivamente dentro de las copias, sin modificar la sesión viva; auditoría en `../../sprites2/blend-audit.json`.
- `postprocess.py.txt`: reutiliza las funciones PIL de contorno, daño, detección y sombra de `originals/postprocess.py.txt`; extiende emblemas, máscaras, catálogo y hojas.
- `validate.py.txt`: contrato de imágenes, escalas, estados, peso, emblemas y registros de QA.

Las extensiones `.py.txt` evitan activar `uvicorn --reload` bajo `src/`. Python y Blender aceptan estos archivos como scripts. No modificar un archivo mientras un proceso lo esté usando.

Un solo render a la vez, con prioridad baja y un hilo:

```sh
nice -n 19 /home/alfred/.local/bin/blender \
  --background engine/tactico/sprites2/blend/tank-main.blend --threads 1 \
  --python engine/tactico/tools/sprites2/render-final.py.txt -- \
  --sprite tank-main --output /tmp/aem-vehiculos-final \
  --blend "$PWD/engine/tactico/sprites2/blend/tank-main.blend"

nice -n 19 ../../../../../.venv/bin/python \
  engine/tactico/tools/sprites2/postprocess.py.txt --raw /tmp/aem-vehiculos-final

nice -n 19 ../../../../../.venv/bin/python \
  engine/tactico/tools/sprites2/validate.py.txt
```

Cycles CPU, 16 muestras con denoise, preview de 256 px y original de 1280 px, recortado sin pérdida a 1024 px por el lado largo. Sol desde `[-75,100,145]`; cámara ortográfica cenital, proa hacia +Y de Blender y `[0,-1]` en PNG. Cada sprite tiene `.blend` independiente y comprimido, sin imágenes ni acciones del avatar compartido.

## Contrato y escalas

`sprites2.json` mantiene `base_sprites` y `sprites`; las entradas conservan `file`, `mask`, `anchor`, `bow`, `length_relative`, `length_m`, `length_pixels`, `variant`, `family`, `state`, `states`, `size`, `base` y `shadow_opacity`. Los campos adicionales son compatibles con el esquema original. No se fusiona automáticamente con `sprites.json`.

```js
const factor = carrierLengthPx * meta.length_relative / meta.length_pixels;
const width = image.width * factor, height = image.height * factor;
ctx.drawImage(image, -width * .5, -height * .5, width, height);
```

Terrestres: `length_relative` es escala editorial para legibilidad, conforme al brief: tanque .10, camión .09, ambulancia .06, obús .10. `physical_relative_length = length_m / 332` permite volver a una escala física común. Buques y aviones usan longitud física / 332. Las dimensiones son orientativas; no son réplicas de clases reales. La geometría de construcción usa unidades normalizadas: escalar por la longitud/eslora de la malla para obtener metros físicos.

Aeronaves: `span_relative = span_m / 332` mide envergadura por separado. El pesado tiene 60 m de envergadura y `hero_scale_multiplier = .55/(60/332)`: aplicar este factor adicional si se quiere la envergadura editorial .55 del portaaviones. El rumbo y el ancla no cambian entre estados.

Las máscaras `-shadow.png` son negras con alfa de silueta, para componer antes del sprite con desplazamiento hacia abajo-derecha y desenfoque. Las sombras del volumen sobre su propia superficie sí están en el render. `-tint.png` es una zona monocroma en modo L; no pintar vidrio/caucho oscuros, detalles claros ni ninguna parte de las ambulancias blancas y sus emblemas rojos. En estas dos variantes la máscara de tinte es intencionalmente vacía.

Estados: `normal`, `detected`, `burning`, `wrecked`. El daño conserva el alfa y el encuadre; burning muestra hollín y brasas dentro de la silueta como base para los efectos animados del motor. No incluye humo ni llamas congeladas fuera del vehículo. Wrecked es una representación táctica calcinada, no una nueva simulación de fracturas 3D.

## Revisión y límites

Cada modelo se revisó mediante `look`: `angles`, vistas `top` y `three_quarter`, `material`, 512 px. QA: topología evaluada (incluidos biseles), bordes abiertos/no manifold, vértices sueltos, caras degeneradas y duplicadas por índices, normales finitas, volumen firmado y escalas unitarias. Se comprobaron asignaciones Principled y valores de metallic/roughness. No se corrió QA de contactos entre piezas, solapes UV, z-fighting automático, deformación ni el script de auditoría completo de la skill. La inspección visual complementa esos límites.

Pintura mate dieléctrica, metal expuesto metallic .82/roughness .38, caucho .90 de roughness, lona .95, cristal .13 y carrocería sanitaria blanca .48. Texturas de variación y microbump procedurales: no se importaron mapas de imagen; por tanto no hay texturas con espacio de color sRGB/Non-Color que configurar. Los valores Principled son lineales. Colores normales neutralizados en PIL, salvo los emblemas sanitarios.

`hoja2.png` compara todas las variantes y estados en océano oscuro y desierto claro. `hoja2-escalas.png` presenta las 24 variantes a 120, 240 y 480 px en ambos fondos; abrir al 100 %. Fondos de revisión procedurales propios; no hay dependencias de imágenes externas. Las referencias del brief se inspeccionaron visualmente sin extraer sus píxeles.

# Generación de sprites tácticos

Modelos originales procedurales, sin mallas, texturas ni tipografías descargadas. Las medidas son
orientativas de cada familia; estos modelos no identifican barcos, aeronaves ni clases históricas concretas.

## Reproducir

Desde `atlas-en-movimiento/`, con Blender 5.2.3 y el Python del proyecto (Pillow y NumPy ya instalados):

```bash
mkdir -p /tmp/blender-cfg /tmp/blender-scripts /tmp/blender-user /tmp/blender-extensions /tmp/blender-data
BLENDER_USER_CONFIG=/tmp/blender-cfg \
BLENDER_USER_SCRIPTS=/tmp/blender-scripts \
BLENDER_USER_RESOURCES=/tmp/blender-user \
BLENDER_USER_EXTENSIONS=/tmp/blender-extensions \
BLENDER_USER_DATAFILES=/tmp/blender-data \
OMP_NUM_THREADS=2 OPENBLAS_NUM_THREADS=2 \
~/.local/opt/blender-5.2.3-linux-x64/blender --background --threads 2 \
  --python engine/tactico/tools/sprites/render.py -- --output /tmp/atlas-sprites-raw

../../../../../.venv/bin/python engine/tactico/tools/sprites/postprocess.py \
  --raw /tmp/atlas-sprites-raw \
  --ocean ../_atlas/cache/gibs-bluemarble/6/40/33.jpg

../../../../../.venv/bin/python engine/tactico/tools/sprites/validate.py
```

No hay procesos en paralelo. La escena fija dos hilos también dentro de Blender. Cycles CPU, 64 muestras,
semilla 581, denoising, cámara ortográfica exactamente cenital y sol fijo procedente de arriba izquierda.
Se renderizan originales RGBA de 1280 × 1280 en `/tmp`; el recorte final conserva detalle y exporta
1024 px por el lado largo. `--only carrier-super` permite renderizar una sola variante; `--save-blend`
guarda el modelo editable en el mismo directorio temporal. No editar scripts mientras Blender los use.

`postprocess.py --only carrier-super --output /tmp/sprites-preview` permite revisar el posproceso parcial.
Sin `--ocean`, genera un fondo oceánico procedural propio. Los PNG son RGBA de 8 bits sin reducción
de paleta, comprimidos sin pérdida. Semillas por SHA-256 del identificador; posproceso determinista.

## Archivos

- `catalog.py`: tipos, medidas orientativas y proporciones.
- `models.py`: construcción bpy, geometría, materiales y detalles.
- `render.py`: cámara, luz, render y medición individual.
- `postprocess.py`: contorno oscuro, cuatro estados, submarino azul, sombras y hoja.
- `validate.py`: comprueba los PNG reales, estados, escala, anclas, alfa, máscaras, límites y peso total.
- `../../sprites/sprites.json`: manifiesto consumible sin Blender.
- `../../sprites/render-times.json`: tiempos de modelado y render de los originales finales.
- `../../sprites/hoja.png`: revisión de todas las variantes y estados, más comparación de escala común.

## Contrato para dibujar

La raíz del manifiesto contiene `sprites` (diccionario por id) y `base_sprites` (orden de variantes).
Las rutas `file` y `mask` son relativas al directorio de `sprites.json`. Cada entrada de estado también
es un sprite completo: por ejemplo `cargo-tanker-burning`. `states` traduce el estado al identificador.
Todos tienen `anchor:[0.5,0.5]`, `bow:[0,-1]`; rumbo 0 = norte, positivo = horario en Canvas.

Para una referencia de portaaviones de `carrierLengthPx` y una unidad con metadatos `m`:

```js
const factor = carrierLengthPx * m.length_relative / m.length_pixels;
const w = image.width * factor, h = image.height * factor;
g.save();
g.translate(x, y);
g.rotate(heading * Math.PI / 180);
g.drawImage(image, -w * m.anchor[0], -h * m.anchor[1], w, h);
g.restore();
```

`length_relative` mide eslora/longitud de fuselaje, **no envergadura**. `length_pixels` es la extensión
longitudinal del PNG: evita que el ala volante, cuyo lado largo es transversal, termine demasiado pequeña.
`length_m` y `span_m` son orientativos; las proporciones pedidas de .45/.38/1.05/.48 son exactas.

La máscara es un PNG negro con alfa de silueta, sin sombra horneada sobre el agua. Dibujarla antes del
sprite con opacidad, desplazamiento y desenfoque del motor; el desplazamiento ocurre en pantalla hacia
abajo derecha, después de transformar/rotar la silueta. Las sombras de la isla, torres y equipo sobre
su propia cubierta sí están en el render. El estado detectado incluye solo borde cian; anillos o haces
de radar corresponden a efectos. Incendiado incluye hollín y brasas dentro del casco, para agregar
`fx.fire`/`fx.smoke` sin congelar llamas ni ocultar la geometría. Calcinado no contiene fuego.

El submarino sumergido lleva azul y alfa .56 ya aplicado; su máscara conserva la silueta opaca de
superficie y recomienda menor `shadow_opacity`. Sus estados son representaciones tácticas, no una
simulación física de combustión bajo el agua. Los estados de daño mantienen encuadre y alfa idénticos.

El helicóptero lleva el buje pero no las palas principales. `attachments.main_rotor.anchor` da el
punto de montaje normalizado **en la imagen del cuerpo**; el rotor se dibuja allí, con su propio centro
y ángulo independiente. Su diámetro corresponde a 18.3 m; tiene solo estado normal porque los daños
pertenecen al cuerpo. No estirar el rotor al rectángulo estrecho del fuselaje. `carrier-super-empty`
comparte encuadre y pivote con `carrier-super`: cambiar de cubierta no desplaza el barco.
Las alas que sobresalen de la cubierta desaparecen con los aviones; cada variante lleva su máscara propia.

## Procedencia

Geometría, materiales, desgaste, estados y máscaras: creación procedural original para este prototipo.
Las referencias del brief se analizaron visualmente; no se extrajeron píxeles ni texturas de ellas.
La hoja usa un recorte oceánico de la caché existente `gibs-bluemarble/6/40/33.jpg`, gradado a petróleo:
**Imagery: NASA GIBS / Blue Marble**, https://earthdata.nasa.gov/data/imagery.
El catálogo local `_atlas/providers.json` lo registra como “NASA Earth data, uso abierto” y conserva
la nota de confirmación comercial pendiente. Este fondo solo está en la hoja de revisión, nunca en los sprites.

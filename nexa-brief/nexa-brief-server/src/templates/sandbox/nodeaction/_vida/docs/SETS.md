# Escenarios de Vida · calibración etapa 2

Las cuatro láminas existentes son PNG aprobados de **1536×1024**. No se regeneraron ni se
recomprimieron. Los hashes originales están en `sets/<id>/set.json`, campo `credits.sha256`.
El brief vigente reemplaza las antiguas notas de generación pendiente y la escala de 300 px.

| Set | Inicio visible de suelo | Apoyo principal | Altura nominal | Revisión aplicada |
|---|---:|---:|---:|---|
| escuela-entrada | 719 | 960 | 560 | portón en el hueco x≈1085–1379; meet=820, arrive=580, entrada=340; póster discreto |
| aula | 710 | 960 | 560 | sillas de 155×330, asiento=816; escritorios 230 px, superficie=675; reloj y estante |
| parque | 683 | 960 | 560 | banco 480×330, asiento=816; asientos x=670/910; jardinera |
| casa-comedor | 688 | 960 | 560 | puerta alineada al hueco x≈163–422, manija explícita; mesa 470 px, sillas, lámpara, planta, cuadro y alfombra |

`walk=[140,1396]` conserva margen para cabeza y pies. Las anclas son **apoyo de pies** en píxeles
absolutos de la lámina, origen arriba a la izquierda. `seatY` indica la altura real de la cadera
sentada; `surfaceY` la superficie donde se dejan objetos. El motor exige acercarse al asiento antes
de `sit`, conserva pies al suelo y resuelve rodillas por IK. No hay búsqueda de caminos: evitar
cruzar muebles mediante los destinos del episodio.

Cada prop tiene `id`, `prop`, `x`, `y`, `w`, `layer` y `params`. `x` es centro, `y` base, `h` altura.
`back` se dibuja detrás de personajes y `front` delante. Silla/banco separan respaldo y labio del
asiento. `handleY` permite medir la manija independientemente del alto; `open` gira la hoja.
Decoraciones declarativas disponibles: wall-clock, frame, shelf, rug y poster. Colores de la familia
crema/durazno/salvia/turquesa de las láminas; línea más fina que la de los personajes.

```sh
# Desde _vida; equivalente Node de la revisión solicitada
node tools/review-sets.mjs
# O el punto de entrada anterior:
bash sets/REVISAR.sh
```

La hoja `_vida/review/sets.jpg` contiene **20 vistas, un personaje de prueba parado en cada ancla**.
Valida el schema y las medidas del PNG antes de dibujar. Nunca escribe sobre el original.
El set se inspecciona también compuesto con objetos y cámara en `review/actions.jpg` y en la prueba
corta. La cámara vertical no puede mostrar todo el ancho de la lámina simultáneamente: dos actores
con gestos amplios necesitan cercanía horizontal (el plano completo mide como máximo 576 px de ancho).

`GENERAR.sh` y `prompt.txt` son recursos del paso de generación anterior y permanecen separados.
Para agregar un set nuevo: crear su lámina por el flujo autorizado, medir en píxeles originales,
copiar la ficha, ajustar suelo/escala/anclas/props/luz, validar y producir una hoja de anclas.
La calibración de un motor no autoriza regenerar una lámina aprobada.

## Heladería y escala de encuadre

Heladería conserva charHeight=400 y la lámina original. `heladero` usa x=600, y=720,
`behind: "mostrador"`. Counter frontal en x=600, y=760, w=300, surfaceY=600, h=160;
color coral `#f0bd8d`, tapa clara `#f7dcc0`. El pequeño ajuste horizontal permite la
apertura con tres personajes sin recortes ni sujetos inferiores al 28%.
La cámara convierte escala real a pantalla: no necesita overrides por cambiar charHeight.
Para comparar sets a 400/560/700, conservar la puesta en escena en alturas de personaje
(distancias relativas entre anclas); una separación absoluta grande puede exigir cobertura
individual en el set menor. El JSON del episodio conserva las mismas referencias a anclas.

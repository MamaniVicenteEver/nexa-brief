# atlas · mapamundi 2.5D

Réplica del lenguaje visual del video de referencia de Klickpin (`From Klickpin.com- Save Beautiful minimalist bedroom decor…`, 93,1 s, 1280×720, 25 fps). El diseño convierte el mapa en escenario continuo: la cámara se acerca y viaja entre países, que se iluminan en blanco; alfileres negros con sello circular señalan cada lugar.

## 1. Análisis de la referencia

### Ritmo y recorrido

- 0–8 s: mapamundi completo, sin título, con una deriva lateral lenta; la cámara empieza a acercarse a América del Norte.
- 8–16 s: Canadá y Estados Unidos; después México y Centroamérica. El país activo pasa a blanco, cae el alfiler y aparece su rótulo.
- Desde aproximadamente 18 s: recorrido encadenado por Sudamérica, África y Europa. La hoja de 18–22 s muestra Colombia, Ecuador y los siguientes países andinos; en Europa se acumulan alfileres mientras la cámara sigue viajando.
- Tramo final: Asia meridional y oriental, sudeste asiático y Oceanía; luego la cámara se retira al mapamundi con muchos países marcados.
- 88–93 s: pausa sobre el mapa completo y cierre tipográfico oscuro con el dato «82 COUNTRIES LISTENING».
- El alfiler activo es grande; los anteriores se reducen. Los países previos pueden permanecer blancos o volver a gris. Los cambios de estado hacen un parpadeo breve, no un fundido largo.

### Paleta

Muestreo con PIL de cuadros del video. La compresión, la viñeta y el brillo de costa mueven algunos valores unos puntos; los tokens elegidos conservan el contraste de la referencia.

| rol | muestra de referencia | token usado |
|---|---:|---:|
| océano | `#42423f` aprox. | `#3f3d3b` |
| tierra | `#353535` | `#353535` |
| país activo | `#f8f8f8` | `#f8f8f8` |
| borde y tinta | negro casi puro | `#0d0d0d` |
| brillo de costa | cian, con halo y sombra azul | `#56e2f2` + `#1650b8` |
| etiqueta | negro sobre halo claro | `#0b0b0b` |

### Tipografía y sello

- Países y cifras: sans geométrica muy pesada; **Archivo Black** es el equivalente elegido para mantener los rótulos cortos y contundentes.
- Rótulos auxiliares: **Archivo**; subtítulos: **PT Sans Narrow** para conservar legibilidad sin competir con el mapa.
- El sello circular de la referencia contiene una marca. Se reemplaza por un globo esquemático o por una foto documental en blanco y negro. No se copia Fiverr ni la marca circular de la referencia.

## 2. Identidad y construcción

- Canal provisional: **NODEPOLITICS**. El material de la demo es el guion de Berlín ya producido; los primeros segundos usan una ruta corta por América para presentar la gramática visual de la referencia antes de volver a Berlín.
- La superficie es una sola capa geográfica continua: océano oscuro, tierra oscura, fronteras negras finas y resplandor cian extruido en las costas. La perspectiva leve levanta el mapa sin introducir una cámara 3D externa.
- La proyección y las formas salen de **d3-geo + topojson + `KIT_WORLD_50m`** local. No se usan teselas ni solicitudes geográficas externas.
- La cámara interpola escala y posición desde la duración del beat; los países, líneas, alfileres y estados se vuelven a dibujar como función pura del tiempo para que el seek sea repetible.
- En 9:16 el mapa ocupa toda la altura. Los puntos de interés se declaran como `[lon, lat]`; para países pequeños conviene fijarlos explícitamente y mover la etiqueta al lado con más espacio.

## 3. Movimientos de referencia → componentes

| movimiento | componente y dirección |
|---|---|
| Mapamundi entero; acercamiento gradual a una región | `atlas.title` (con texto vacío cuando la referencia abre sin título) y `atlas.world` (`region`, `center`, `span`, `move`) |
| País activo que prende en blanco; alfiler cae y rótulo entra desde atrás | `atlas.country` (`country` en inglés, `pin: [lon,lat]`, `label`, `state`) |
| Viaje país por país; alfiler activo grande y los anteriores chicos | `atlas.route` (`items`, `camera: "follow"`, `state`, `clear`) |
| Muro o frontera dibujada sobre el mapa con resplandor cian | `atlas.border` (`line`, `style: "wall"`, `tags`, `countries`) |
| Imagen documental dentro del sello o fijada al mapa | `atlas.photo` (`src`, `pin`, `focus`) |
| Dato grande sobre el mapa atenuado | `atlas.stat`; `atlas.compare` cuando hay dos lugares o estados que contrastar |
| Gancho tipográfico y salida de canal | `atlas.introv1`, `atlas.introv2` y `atlas.outro`, bajo el contrato compartido de `designs/common/hook.js` |

El runtime compartido vive en `components/_atlas.js`; la cámara y el mapa se dibujan desde `components/map.js`, los datos y títulos desde `components/data.js`, y los hooks/cierre desde `components/intros.js` y `components/outro.js`.

## 4. Qué quedó igual y qué difiere

**Igual o muy cerca:** mapamundi gris oscuro, bordes finos, halo cian en la costa, inclinación 2.5D, países blancos, alfileres negros con medallón, rótulo oscuro, escala distinta para el pin activo y recorrido con paneo/zoom suave. El idioma y los nombres de países siguen siendo datos del storyboard.

**Difiere, por una razón concreta:**

- La secuencia original recorre muchos países durante 93 s. La demo conserva el recorrido inicial de Canadá, Estados Unidos, México, Honduras y El Salvador; después pasa al relato de Berlín del material existente, en el primer beat de Berlín (13,4 s). Así se prueba el diseño dentro del guion real sin generar voz nueva.
- El medallón usa un globo o una foto documental en vez de reproducir la marca estampada de la referencia.
- Se omite la marca de agua de Fiverr.
- La cámara y el brillo se aproximan con un mapa vectorial y una extrusión procedural; el resultado permanece offline y determinista.

## 5. Componentes disponibles

| componente | función |
|---|---|
| `atlas.title` | apertura y acercamiento desde el mundo |
| `atlas.world` | contexto regional, encuadre conjunto y países en gris/blanco |
| `atlas.country` | país activo, pin, etiqueta y sello opcional |
| `atlas.route` | secuencia de países con cámara seguidora |
| `atlas.border` | muro, frontera o ruta trazada |
| `atlas.photo` | foto documental como sello o tarjeta clavada |
| `atlas.stat` | cifra o frase corta sobre el mapa atenuado |
| `atlas.compare` | contraste de dos lugares o países |
| `atlas.introv1`, `atlas.introv2` | ganchos de apertura |
| `atlas.outro` | cierre del canal |

## 6. Verificación

- `kit.py check atlas-demo`: **OK**, 47 beats, 219,0 s efectivos según el audio configurado, sin errores ni advertencias. El rótulo de inicio dura 2,4 s y la ruta 8,0 s; el máximo del validador para una ruta es 8 s.
- `kit.py sheet atlas-demo --orient both`: hojas de 9:16 y 16:9 revisadas en `sandbox/nodepolitics/atlas-demo/work/sheet-9x16.png` y `sheet-16x9.png`.
- `shoot.py` sobre la página de la demo: 13 capturas por orientación, en `scratchpad/codex/atlas/route-final-9x16.png` y `route-final-16x9.png`. Se revisaron el mapa inicial, cada país de la ruta y la transición a Berlín.
- Seek fuera de orden: repetí 0,5; 5,5; 9,5; 10,5 y 13,6 s en 16:9 y 9:16; los hashes de cuadro coincidieron. Resultado guardado en `scratchpad/codex/atlas/determinism.py`.
- `kit.py manifest atlas-demo`: estado `listo`; mantiene `demo: true` y `category: node_politics`.
- `kit.py render atlas-demo --formats 9x16,16x9 --seconds 20`: dos avances H.264/AAC de 20 s, 30 fps, 1080×1920 y 1920×1080. Ambos se revisaron en `scratchpad/codex/atlas/render-9x16.jpg` y `render-16x9.jpg`; el render corto no es el render final.
- El navegador informa el 404 esperado al probar primero `config.json` en la raíz del demo; el loader continúa con `assets/config.json`. No aparecen errores ni avisos `[kit]`.

## Lecciones

- `country` debe usar el nombre inglés de `properties.name`; el rótulo visible va por separado en `label`. Poner coordenadas explícitas con `pin` mantiene el foco en la ciudad o el centro correcto.
- Países muy pequeños de Centroamérica necesitan un `side` explícito en el rótulo para que no salga del encuadre vertical.
- El verificador limita `atlas.route` a 8 s. Se pueden espaciar los `items.at` dentro de esos 8 s y dejar que el país final permanezca mientras llega el beat siguiente.
- La primera captura del kit ocurre dentro del beat; para comprobar el paneo previo a la primera caída del pin, hay que capturar tiempos absolutos con `shoot.py --page`.

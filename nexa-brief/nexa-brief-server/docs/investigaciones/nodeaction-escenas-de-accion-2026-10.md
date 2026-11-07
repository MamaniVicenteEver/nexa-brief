# NodeAction · escenas de acción con personajes (estudio y decisiones)

> 2026-10-16 · Motor y demo en `src/templates/sandbox/nodeaction/` (casa de pruebas, no sale en la app).
> Guía operativa para agentes: `sandbox/nodeaction/AGENTS.md` (formato completo de `scene.json`, flujo, reglas).

## 1. Qué se pidió

Replicar el tipo de video de la referencia *Paint Wick*: figuras estilo stickman con borde blanco
("sticker") en dos bandos que se disparan pintura. Lo que importa de la referencia:

- **Coordinación causa → efecto**: cuando una bola llega, ese personaje cae, y la pintura queda donde pegó.
- **Un protagonista fluido**: corre, salta, apunta y dispara, todo encadenado.
- **Al final queda uno.**

El pedido no era una pieza suelta sino un **estándar**: que con datos (JSON) se puedan armar miles de
escenas (batallas antiguas, disturbios, persecuciones…), con fondo blanco por ahora, que también acepte
imagen o video de fondo y una narración en JSON de voz.

## 2. Análisis de la referencia (capturas del usuario)

| rasgo | cómo se ve | cómo lo resolvimos |
|---|---|---|
| Personajes | stickman negro, extremidades gruesas redondeadas, borde blanco grueso alrededor de toda la silueta, manos blancas | esqueleto 2D + 3 grupos de dibujo (brazo de atrás · cuerpo · brazo de adelante), cada uno con borde blanco propio |
| Protagonista | melena negra con mechones que gotean sobre la cara | cabeza `bob`: negra con la cara descubierta abajo-adelante y 3 mechones en gota |
| Rivales | torso del color del equipo, casco del mismo color, visera negra con brillo | cabeza `visor` + torso `$body` |
| Arma | pistola negra con la bola de pintura arriba | `gun()` con tolva del color de la pintura del tirador |
| Disparo | estrella amarilla en la boca, bola con estela | destello de 8 puntas (0,09 s) + bola con estela degradada |
| Impacto | salpicadura en el cuerpo, gotas que vuelan, mancha en el piso, el blanco cae de espaldas y queda tendido | marca en el torso, 12–18 gotas balísticas, mancha detrás, caída de espaldas con rebote, charco |
| Espacio | mundo 3D (escritorio real), los lejanos más chicos, sombra de contacto | mundo 2.5D con proyección perspectiva, orden por profundidad, sombra elíptica |
| Cámara | planos con rótulo ("SHOT 1 · THE NOTEBOOK"), cámara baja | `camera.keys` con `label`, transiciones, cámara en mano y sacudón |

## 3. Decisión de arquitectura

**Motor propio en un nodo nuevo (`sandbox/nodeaction`), con el contrato de los motores existentes.**

- **Por qué no es un diseño del explainer-kit.** El explainer arma *planos* sobre una narración: cada
  componente dibuja su plano y desaparece. Acá el contenido es una **simulación entre actores**: posiciones
  persistentes, proyectiles que dependen de dónde está el blanco cuando llegan, muertes que cancelan
  acciones futuras, manchas que se acumulan. Eso necesita su propio modelo de mundo.
- **Qué se reutiliza** (principios probados):
  - **contrato de grabación:** `window.__promo.seek(t)`. Se graba con `_tools/commercial/render_promo.py`
    sin escribir un grabador nuevo;
  - **voz y tiempos:** `explainer-kit/tools/narrate.py` (Gemini TTS) y `transcribe.py` (Whisper con el
    guion como guía);
  - **anclas `"@palabra"`;**
  - **determinismo total:** todo es función de `t`, con semillas;
  - **config:** `config.json` con `configs[]`.
- **Escena = datos.** `index.html` solo carga el motor. Cualquier cosa nueva entra al motor y sirve a
  todas las escenas.

### 3.1 Piezas (1266 líneas de JS + 4 herramientas Python)

| pieza | responsabilidad |
|---|---|
| `core.js` | anclas, compilación de la escena a pistas por actor, disparos en orden (vuelo, impacto, muerte, corte de acciones futuras), `impactAt`, cámara (keys, follow, focus, end-x), proyección, reloj, `__promo`, eventos sonoros |
| `rig.js` | poses como **objetivos** (pies/manos) + IK de 2 huesos; andares con fase = distancia recorrida (los pies no patinan); salto con impulso/vuelo/aterrizaje; rodilla en tierra; apuntar en espacio de pantalla; retroceso; estremecimiento; caída con rebote; estilos y dibujo sticker; sombras |
| `fx.js` | gotas balísticas y manchas precalculadas, manchas proyectadas punto a punto sobre el suelo, destellos, estela |
| `planner.js` | director `skirmish`: elige blancos, movimientos (correr/saltar/arrodillarse/de pie), posiciones (avanza a distancia de combate, no se encima), fuego cruzado, caída de aliados, victoria; sincroniza bajas con palabras |
| `tools/review.py` | hoja de cuadros + resumen (quién cayó, por quién, cuándo, avisos) |
| `tools/sfx.py` | sonido sintetizado desde la escena (disparo, impacto, salpicadura, caída, salto, aterrizaje; paneo y volumen por distancia; sala chica) + mezcla con voz/música → `song.mp3` |
| `tools/new.py` | escena nueva desde `_escena-base/` |
| `tools/delegate_text.py` | textos a DeepSeek (guiones, títulos); las animaciones no se delegan |

### 3.2 Decisiones técnicas clave

1. **Poses por objetivos e IK, no por ángulos.** Mezclar poses (correr → arrodillarse → apuntar) promedia
   posiciones de pies y manos, y la IK reconstruye rodillas y codos. Por eso nunca se rompe el cuerpo y
   los pies apoyan en el suelo.
2. **Fase del andar = distancia recorrida.** Con aceleración o frenado, las piernas siguen al suelo: no
   hay "moonwalk".
3. **Apuntar en pantalla.** El ángulo del brazo se calcula entre el hombro y el pecho del blanco
   *proyectados*. Así el brazo apunta exactamente por donde va a viajar la bola, aunque el blanco esté a
   otra profundidad.
4. **Disparos compilados en orden de tiempo.** Una muerte solo puede venir de un disparo anterior, así
   que se resuelve en una pasada. Luego se cortan los movimientos, las poses y los disparos posteriores
   del caído.
5. **`impactAt`.** El director pide "que caiga en la palabra *verde*". El motor calcula el vuelo real y
   adelanta el disparo. Medido: cada baja cae en el mismo centésimo de segundo que su palabra.
6. **Todo precalculado.** Gotas, dónde caen, manchas y charcos se calculan con semillas por impacto;
   dibujar un cuadro solo evalúa fórmulas cerradas.

## 4. Resultado medido (demo `paintwick-demo`)

- **Contenido:** 8 personajes (héroe + 2 aliados vs 5 rivales de colores), 43 s, fondo blanco, voz
  Charon (Gemini TTS, 1 pedido, WER 0, 94 ppm) con guion escrito por DeepSeek y editado.
- **Sincronía:**
  - bajas en las palabras exactas: aliados en "compañero" (9,39 s) y "otro" (11,77 s); rivales en
    "verde" 21,07 · "naranja" 23,65 · "cian" 26,19 · "morado" 31,13 · "amarillo" 33,51;
  - saltar, correr, arrodillarse y disparar anclados a "Salta, corre, se arrodilla y dispara";
  - victoria en "pie";
  - 4 planos de cámara con rótulo anclados a la voz;
  - subtítulos karaoke.
- **Sonido:** 111 efectos sincronizados (versión con más fuego cruzado), mezclados bajo la voz.
- **Render** (`render_promo.py`, 4 procesos, CPU): **~0,06 s por cuadro en 1080p**. 15 s se grabaron en
  27 s; 43 s, en unos 2 min por formato. Es mucho más rápido que las plantillas pesadas de HyperFrames
  (0,3–0,46 s/cuadro), porque es canvas 2D sin videos.
- **Formatos:** 16:9 (1920×1080) y 9:16 (1080×1920), con encuadre propio para el vertical (horizonte y
  zoom).

## 5. Estandarización: qué ya sirve para "miles de escenas"

- **Cualquier enfrentamiento por bandos** con `plan.mode = "skirmish"`: N equipos, colores, quién gana,
  en qué orden caen, cuándo (a la palabra), qué movimientos usa el protagonista, cadencia del fuego
  cruzado. Otra semilla da otra coreografía.
- **Coreografía a mano** (`timeline`) mezclada con la del director.
- **Narración:** cualquier guion con palabras ancla dirige la escena; el flujo de voz es el mismo del
  explainer-kit.
- **Fondos:** color, imagen o video (calibrando horizonte y altura de cámara).
- **Personajes:** 4 estilos (`hero`, `trooper`, `ink`, `plain`) con colores por equipo y `look` por
  personaje; 2 armas (`paint`, `rock` para disturbios); 5 poses con nombre; 4 andares; 3 tipos de salto.

## 6. Hoja de ruta (para batallas antiguas, disturbios y lo demás)

Por prioridad, pensando en el contenido que se quiere producir.

| # | qué | para qué | esfuerzo |
|---|---|---|---|
| 1 | **Cuerpo a cuerpo**: espada, lanza, garrote, escudo; acciones `strike`, `block`, `parry`; reacción por golpe | batallas antiguas, duelos | medio |
| 2 | **Armas a distancia antiguas**: arco (flecha en parábola que queda clavada), jabalina, honda; "lluvia de flechas" | batallas antiguas | bajo (el motor de proyectiles ya existe) |
| 3 | **Multitudes y formaciones**: filas que avanzan en bloque, carga, retirada, huida, empujones; director `charge`/`line`; 50–200 actores (pintar en lotes por profundidad) | batallas, disturbios | medio-alto |
| 4 | **Modos del director**: `duel` (1 vs 1 con intercambio), `riot` (manifestantes vs línea de escudos, piedras, humo), `chase`, `ambush`, `last_stand` | variedad de historias | medio |
| 5 | **Estilos de época**: casco romano/vikingo/samurái, escudos con emblema, estandartes, ropa (túnica, capa), caballos | historia | medio |
| 6 | **Efectos**: humo, polvo al caer/correr, fuego, chispas de choque, lluvia, banderas al viento | atmósfera | bajo-medio |
| 7 | **Globos de diálogo y rótulos en el mundo** (nombres sobre los personajes, "1453", flechas) | explicar mientras pasa | bajo |
| 8 | **Escenarios de fondo**: suelo dibujado (pasto, empedrado, arena), muros, coberturas que bloquean disparos, calibración de fotos/videos | contexto | medio |
| 9 | **Componente `action.scene` del explainer-kit**: un beat del storyboard que reproduce una escena NodeAction entre otros planos | videos de NodeHistory con batallas animadas | medio |
| 10 | **Música** (pista con licencia) bajo la voz y los efectos; `sfx.py --music` ya mezcla | ritmo | bajo |
| 11 | **Promover** a una categoría de la app (registro + render desde el estudio), como el explainer | producción | medio |

## 7. Riesgos y límites conocidos

- **El vertical recorta campo lateral.** Con muchos actores separados hay que usar más `focus` o planos
  más abiertos.
- **Movimientos solo en el plano del personaje.** Correr hacia la cámara se ve "de costado" (estilizado,
  como en la referencia). Si hiciera falta, un andar de frente sería un estilo nuevo.
- **Exceso de fuego cruzado** ensucia el suelo y la mezcla de sonido; hay que dosificarlo en piezas
  narradas.
- **La voz consume cuota de Gemini.** Una sola vez, con el guion final, igual que en el explainer.
- **Es un prototipo de sandbox.** Para producción falta promover: registro, ruta del motor y grabación
  desde la app.

## 8. Estudio de los tirones de cámara (2026-10-17)

**Síntoma reportado:** al moverse la cámara había momentos "trabados" y pequeños golpes.

**Medición** (`tools/camcheck.py`: cámara muestreada a 30 cuadros/s, aceleración y jerk por eje) sobre
`paintwick-demo`:

| | cámara vieja | cámara nueva |
|---|---|---|
| aceleración máx. en x | 55 u/s² | 7,4 u/s² |
| jerk p99 en x | 1545 | 25 |
| cuadros con aceleración > 8 u/s² | 135 | 0 |

**Causas encontradas:**
1. **Traba (la principal).** El modo `focus` calculaba el encuadre promediando 8 muestras del "próximo
   blanco". Cuando una muestra cambiaba de blanco, el promedio saltaba 1/8 de golpe: el movimiento era una
   escalera y no una curva. La velocidad alternaba cuadro a cuadro entre 0,2 y 3,3 u/s (de 19 a 32 s,
   después de cada baja).
2. **Golpes.** Había un sacudón de 95 Hz en cada disparo del protagonista (picos sueltos en y).
3. **En el Somme:** el temblor de cada uno de los 91 obuses del bombardeo.

**Solución: cámara "dron con estabilizador".** Cada key define un **objetivo** (posición, altura, zoom,
inclinación, a quién seguir o qué grupo encuadrar). La cámara lo persigue con un filtro de primer orden
más un resorte críticamente amortiguado, simulados una sola vez a 120 Hz desde t = 0. `camAt(t)`
interpola, así que el resultado es determinista para el grabador cuadro a cuadro.

- **Suavidad:** un cambio brusco de objetivo se convierte en una curva suave.
- **Cortes:** `cut: true` sigue disponible para un corte seco.
- **Sin sacudón por disparo.**
- **Explosiones:** solo las grandes (minas) producen una ondulación lenta (1,1–1,6 Hz) que crece y se
  apaga suave.
- **Inclinación (`pitch`):** permite planos de dron que miran hacia abajo. Los personajes se acortan un
  poco en vertical según la inclinación.

**Resultado en `somme-1916`** (2:27, cámara de dron con vuelos largos entre sectores): todos los ejes en
verde, |a| máx 7,8 u/s², jerk p99 ≤ 14.

## 9. Segunda escena: el primer día del Somme (2026-10-17)

- **Contenido:** 48 personajes en 2 sectores del frente (principal y Beaumont-Hamel). Británicos con la
  bandera del Reino Unido en el uniforme y casco Brodie; alemanes con la bandera del Imperio alemán y
  casco Stahlhelm.
- **Lo nuevo del motor:** bombardeo, minas, trincheras, alambre de púas, parapetos, cráteres, director
  `advance` (oleadas que salen y marchan, bajas por tandas, sobrevivientes en cráteres), noche (`tint`) y
  amapolas al final.
- **Guion:** datos verificados en Wikipedia (First day on the Somme, Battle of the Somme, Royal
  Newfoundland Regiment). DeepSeek hizo un borrador que no respetó las anclas ni el largo; el texto final
  se reescribió a mano (267 palabras).
- **Voz:** Charon, 2:24 después de corregir "Terranova", que el TTS había pronunciado "Terranuda". Se
  regeneró solo esa frase y se empalmó en los silencios.

## 10. Estudio: personajes con volumen real (que no parezcan un PNG que gira) — 2026-10-17

**Pedido.** Cada persona tiene que tener alto, ancho y profundidad, y mantener un solo estado al caminar,
disparar, agacharse o caer, desde cualquier lado. Sin cambiar de "dibujo" según la vista ni girar como una
hoja de papel. Que se sienta como un cubo.

**Cómo es hoy.** El personaje es un dibujo 2D que existe en tres versiones (perfil, espaldas y frente). El motor
elige una según hacia dónde mira respecto de la cámara y, al cambiar, la angosta y la vuelve a abrir. Por eso
parece una imagen que da vuelta. Apuntar, caer y estar cuerpo a tierra solo existen de perfil.

### Estrategias de videojuego evaluadas

| estrategia | ejemplos | cómo se ve | veredicto |
|---|---|---|---|
| A. Sprites por dirección (8 o 16 imágenes por pose) | Doom, Age of Empires, Diablo II | sigue siendo un PNG; salta entre ángulos | ✗ es justo lo que no queremos |
| B. "Papel que gira" (lo actual) | Paper Mario | plano, se angosta al girar | ✗ |
| C. **Esqueleto 3D + dibujo 2D** (huesos en 3D proyectados y dibujados como cápsulas con contorno) | juegos de stickman 3D, rigs vectoriales, *impostors* de cápsula | el mismo estilo sticker, pero con volumen y continuo desde cualquier ángulo | ✓ **recomendado** |
| D. 3D real (WebGL/Three.js: modelos low-poly, sombreado toon y contorno por "casco invertido") | Superhot, juegos *low-poly* | volumen y luz verdaderos | posible, pero más lento en la grabación (WebGL por software en Chrome sin GPU), más dependencias, y cuesta mantener el look sticker |

### Por qué C
- **Un solo personaje, un solo estado.** Cada articulación (cadera, rodillas, pies, hombros, codos, manos,
  cabeza) tiene posición x, y, z. Caminar, apuntar, arrodillarse y caer son poses en 3D. La cámara proyecta
  esos puntos, así que de frente, de costado o de 3/4 es **el mismo cuerpo** visto desde otro lado. No hay
  vistas que cambiar ni giros de papel.
- **Apuntar de verdad.** El fusil es un segmento 3D que apunta al blanco en el mundo. Visto desde cualquier
  ángulo, la bala sale por donde apunta, sin trucos de pantalla. Se puede disparar de frente, de espaldas o
  en diagonal.
- **Caídas reales.** El cuerpo rota en 3D hacia donde lo empuja el impacto, y la cámara lo ve caer desde
  donde esté.
- **Mismo estilo.** Sigue siendo canvas 2D: colores planos, borde blanco tipo sticker. Es determinista y casi
  igual de rápido de grabar. Las escenas (`scene.json`) no cambian.

### Trucos para que se sienta "cubo" (volumen)
1. **Torso como caja** (ancho, alto y profundidad), con la cara frontal (bandera), la trasera (mochila) y las
   laterales. Se dibujan las caras que miran a la cámara, con la lateral un 12–18 % más oscura. En 3/4 se ve
   el frente y el costado a la vez.
2. **Orden por profundidad por pieza** (algoritmo del pintor): brazo lejano, pierna lejana, torso, pierna
   cercana, brazo cercano. Se recalcula en cada cuadro según la cámara.
3. **Grosor por profundidad.** Cada cápsula se escala con su distancia; las extremidades lejanas van un
   poco más oscuras (señal de profundidad).
4. **Cabeza como esfera y casco como elipsoide proyectado.** El ala del casco Brodie se ve como elipse más o
   menos abierta según la inclinación de la cámara.
5. **Contorno blanco de la silueta completa** (como hoy) más un borde interior fino entre piezas que se
   superponen, para que se lea qué está adelante.
6. **Sombra de contacto** calculada desde los pies 3D: se separa del cuerpo al saltar o caer.

### Plan propuesto
1. `rig3d.js`: esqueleto 3D. Las poses se definen como objetivos de pies y manos en el marco del personaje
   (x adelante, y arriba, z costado). IK de 2 huesos con vector de "polo", para que rodillas y codos doblen
   hacia el lado correcto. Los andares, saltos, rodilla en tierra, apuntar, retroceso y muertes actuales se
   portan a 3D.
2. Render: proyección de cada articulación con la cámara actual (yaw y pitch), lista de piezas con
   profundidad, orden del pintor y dibujo sticker. Torso caja, cabeza esfera, casco, fusil 3D, bandera en la
   cara frontal y mochila en la trasera.
3. **Prueba "giradiscos"**: un soldado en el centro mientras la cámara lo rodea 360°, haciendo en secuencia
   caminar, apuntar, arrodillarse, disparar y caer. Así se ve que es un solo cuerpo desde todos los ángulos.
4. Migrar `somme-1916` sin tocar su JSON, y revisar con `review.py`, `camcheck.py` y `frame.py`.

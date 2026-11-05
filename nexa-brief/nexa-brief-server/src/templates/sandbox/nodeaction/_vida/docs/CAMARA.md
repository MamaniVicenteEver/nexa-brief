# Cámara de Vida: contrato JSON

`cameraAt(compiled, t, state?, {view, framing})` es una función de tiempo absoluto.
La óptica no depende del cuadro anterior ni del orden de los seeks. El caché externo
`WeakMap` guarda geometría y trayectorias derivadas, no altera `compiled` y se libera
con él. Los episodios compilados se consideran inmutables: recompilar tras editar JSON.

## Configuración del episodio

```json
{
  "camera": {
    "style": "cine",
    "maxZoomRate": 0.24,
    "maxPan": 0.28,
    "smoothing": 0.8,
    "anticipation": 1,
    "deadzone": 0.04,
    "handheld": 0.12,
    "seed": 17,
    "defaultEase": "smoother"
  }
}
```

Sin bloque se aplica `estable`. Las propiedades explícitas prevalecen sobre el estilo.
`view` y `framing` siguen a nivel episodio o como opciones de la API: portrait
1080×1920, landscape 1920×1080; `fit` por defecto y `tight` para recorte editorial.
La misma decisión de montaje sirve a ambas vistas; cada una calcula su óptica.

| Parámetro | estable | cine | documental | Rango / unidad |
|---|---:|---:|---:|---|
| maxZoomRate | .30 | .24 | .30 | .01–2 octavas/s |
| maxPan | .35 | .28 | .35 | .01–2 anchos de cuadro/s, vector 2D |
| maxZoomAcceleration | 1.2 | .9 | 1.2 | .05–10 octavas/s² |
| maxPanAcceleration | 1.4 | 1 | 1.4 | .05–10 anchos/s² |
| maxZoomJerk | 8 | 6 | 8 | .1–100 octavas/s³ |
| maxPanJerk | 10 | 8 | 10 | .1–100 anchos/s³ |
| smoothing | .65 | .8 | .55 | .1–3 segundos |
| anticipation | .8 | 1 | .8 | 0–3 segundos |
| deadzone | .035 | .04 | .025 | 0–.3 del ancho óptico |
| handheld | 0 | .12 | .25 | 0–1 |
| minShot | 1.2 | 1.6 | 1.2 | 1.2–10 segundos, director |
| breath | .02 | .02 | .015 | 0–.03, zoom de drift |
| seed | 1 | 1 | 1 | entero 0–2147483647 |
| defaultEase | smoother | smoother | smoother | curva descrita abajo |

Una octava equivale a duplicar la escala. Se mide `log2(h)`, por lo que el límite
es independiente del tamaño del escenario y de la resolución del raster.

## Planos de escena

`scenes[].camera` sigue siendo una lista. Cada entrada necesita `type`:
`wide`, `two`, `medium`, `close` o `insert`. `target` identifica actor, objeto o ancla;
`targets` contiene dos o más IDs. `at` y `until` aceptan segundos relativos a la
escena o anclas existentes (`@L04.Hoy`, `@L24:end+2.5`). `dur` delimita el plano
cuando no hay `until`; no desplaza diálogo ni acciones.

```json
{
  "at": "@L04.Hoy", "dur": 2,
  "type": "close", "target": "tomas", "move": "push",
  "from": {"zoom": 0.9, "offset": [0, -35]},
  "to": {"zoom": 0.972, "offset": [0, -35]},
  "ramp": 1.6, "hold": 0.1, "settle": 0.2,
  "ease": "smoother", "transition": "cut", "locked": true
}
```

| Campo | Uso |
|---|---|
| move | Movimiento; omitido equivale a fixed/hold. |
| from / to | Objetos con `zoom` (.5–3), `offset:[x,y]` en unidades del escenario y/o `target`. |
| zoom | Zoom de referencia (.5–3), default 1. |
| lens | Multiplicador óptico de la base (.5–3), default 1. No simula profundidad de campo física. |
| zoomFrom / zoomTo | Alias heredados para los extremos de dolly. |
| fromTarget | Alias heredado de `from.target` para pan/move. |
| offset | Desplazamiento base `[x,y]`, default `[0,0]`. |
| amount | Cambio relativo de zoom .01–.2; push/pull .06, punch .08, drift usa breath. |
| ramp | Duración solicitada del movimiento, .001–120 s. Puede ampliarse por límites. |
| hold | Espera inicial 0–120 s. |
| settle | Reserva final 0–30 s; no introduce oscilación artificial. |
| ease | smooth, smoother, linear, gentle, ease-in-out, ease-in, ease-out o Bézier `[x1,y1,x2,y2]`. |
| transition | cut, move, whip, dissolve. |
| locked | Conserva el override editorial. `two` sin locked deja actuar al director. |
| fit | false permite recorte explícito; locked por sí solo no desactiva la protección. |
| handheld | Sobrescribe el episodio, 0–1. |
| preset | natural, tercios o retrato. |
| headroom | Mínimo espacio superior normalizado, 0–.35. |
| leadRoom | Mínimo espacio hacia la mirada, 0–.35. |
| thirds | Colocación horizontal en tercios según la mirada, booleano. |
| eyeLine | Altura óptica deseada de la cabeza/ojos, .1–.8. |

Las curvas Bézier deben tener cuatro números finitos en [0,1], con x1≤x2 y y1≤y2.
El perfil base es quintic smootherstep (`10u³−15u⁴+6u⁵`), de velocidad y aceleración
nulas en ambos extremos. Los nombres smooth/linear se aceptan por compatibilidad,
pero la entrada y salida son suaves; dolly con linear conserva la interpolación de
los valores de zoom. Las curvas Bézier deforman el tiempo del perfil suave.
No se permite overshoot: podría romper el margen seguro.

Los máximos de derivadas del perfil determinan la duración: no basta `distancia/v`;
se usa además la velocidad pico del easing, raíz cuadrada de distancia/aceleración
y raíz cúbica de distancia/jerk. En un movimiento imposible de completar antes del
corte, la trayectoria se alarga y queda interrumpida por el corte previsto. Se avisa;
no se acelera ni se retima el episodio. `cameraAt(...).motion.duration` informa la
duración efectiva y `.motion.warnings` las restricciones ópticas y cinemáticas.
`compiled.camera.warnings` contiene diagnósticos editoriales y de duración conocidos
al compilar. Las advertencias no se acumulan al hacer seek.

## Movimientos: ejemplos

Cada objeto siguiente se usa como entrada de `scenes[].camera`; completar `at`/`dur`
según la escena. No es necesario cambiar JavaScript.

```json
[
  {"type":"close","target":"tomas","move":"push","amount":0.06,"ramp":1.5,"dur":3},
  {"type":"medium","target":"tomas","move":"pull","amount":0.08,"ramp":2,"dur":4},
  {"type":"close","target":"tomas","move":"drift","amount":0.02,"dur":6},
  {"type":"medium","target":"nico","move":"pan","from":{"target":"tomas"},"to":{"target":"nico"},"dur":4},
  {"type":"wide","target":"tomas","move":"track","dur":4},
  {"type":"wide","targets":["tomas","mama"],"move":"dolly","from":{"zoom":1.15,"offset":[0,30]},"to":{"zoom":1,"offset":[30,30]},"dur":3},
  {"type":"two","targets":["tomas","nico"],"move":"reveal","amount":0.08,"dur":3},
  {"type":"medium","target":"nico","move":"hold","dur":3},
  {"type":"close","target":"nico","move":"whip","from":{"target":"tomas"},"ramp":0.22,"dur":2},
  {"type":"close","target":"tomas","move":"punch","ramp":0.4,"dur":2}
]
```

- **push/pull**: acercan/alejan alrededor de la base, normalmente 4–12% en .6–2 s.
  Los límites físicos pueden exigir más tiempo.
- **drift**: 1–3% durante todo el plano. El director lo usa en medium/close largos.
- **track**: filtra x/y de la raíz de puesta en escena, sin rootY de la marcha, manos
  ni cabeza. Usa un kernel gaussiano simétrico, zona muerta con borde suave y
  limitación del recorrido; el encuadre reserva el movimiento que no puede seguir.
- **pan**: traslada el centro entre objetivos/offsets; **dolly** suma zoom.
- **reveal**: pull destinado a abrir al grupo; usar two/wide y targets del grupo.
- **hold**: mantiene un encuadre, incluyendo la envolvente de los gestos futuros.
- **whip**: única excepción de velocidad, con blur y perfil suave, .22 s por defecto.
- **punch** heredado: push de 8%, mínimo .40 s y duración ampliable por límites.
- Alias: `fixed → hold`, `follow → track`, `move → pan`.

`transition:move` conecta con la óptica anterior; los tramos continuos no constituyen
un nuevo corte. `cut` cambia directamente de plano. `whip` hace esa conexión rápida.
`dissolve` en este módulo interpola **rectángulos ópticos** con el mismo perfil de move;
no hace una doble exposición de imágenes. Una disolución fotográfica requeriría
ampliar el renderer, que queda fuera del alcance autorizado de esta tarea.

## Encuadre seguro y presets

| Preset | headroom | leadRoom | eyeLine | thirds |
|---|---:|---:|---:|---|
| natural | .06 | .08 | .32 | false |
| tercios | .06 | .12 | 1/3 | true |
| retrato | .08 | .08 | .38 | false |

Las propiedades explícitas del plano sobrescriben el preset. Los tercios y la línea
de ojos son preferencias: la protección de sujetos tiene prioridad en fit.
Headroom y leadRoom declarados se verifican en review.

En `fit`, wide/two/medium protegen todos los actores y objetos que llevan; close
protege cara y pelo, insert el objeto y la cara del comensal. No significa mostrar
el cuerpo entero en un primer plano. El área segura es 3–97% horizontal y 3–84%
vertical con subtítulos (3–97% sin ellos).

La geometría pintada se muestrea a 30 Hz y en los límites de acciones. Se reserva
una envolvente conservadora del **tramo completo**, extendida a tramos consecutivos
del mismo sujeto, con margen adicional .009 × charHeight. Es deliberadamente más
conservadora que una ventana de .8 s: un hold no cambia zoom aunque haya varios gestos.
El zoom se interpola en espacio logarítmico. `anticipation` interviene junto con
`smoothing` en el ancho del kernel de seguimiento; no recorta la reserva de fit.
Se comparte la geometría entre vistas y se cachea la trayectoria por plano/vista.
Un guardián de geometría exacta cubre seeks entre muestras y casos patológicos;
`camera.safetyCorrection` lo expone. Review no excluye estas correcciones de las
métricas: una emergencia brusca debe fallar, no quedar disimulada.

La respiración usa suma de senos deterministas, frecuencias .23/.41 y .29/.53 Hz,
amplitud máxima .35% × handheld de cada dimensión. Se resta esta amplitud del margen
seguro antes de planear. `handheld:0` la apaga totalmente.

## Director y prioridad

El director propone planos en inicios de línea, reacciones, caminatas, llegadas y
acciones con objetos. No inventa un corte al cumplirse 5.5 s. Una escena larga sin
acción puede permanecer en un mismo plano; esto reemplaza la antigua exigencia de
cortar por reloj. En el siguiente beat disponible puede mostrar al oyente para
variar atención sin introducir un corte arbitrario.

Líneas emocionales y reacciones motivan push; llegadas motivan reveal; líneas largas
pueden usar drift. La duración automática mínima es minShot (al menos 1.2 s), salvo
inserts y whip. Los restos automáticos breves se fusionan o continúan la óptica anterior.
Los overrides conservan sus anclas y prioridades; un override demasiado breve genera
aviso. Entre planos del mismo sujeto se exige un cambio de tamaño de al menos 25%
o una transición continua. Tras insert se recupera la cobertura anterior, sujeta a fit.

## Cómo escribir un plano

1. Elegir qué acción o palabra justifica iniciar y terminar el plano. Usar anclas.
2. Elegir sujetos y type. Probar fit en ambas vistas antes de pedir más zoom.
3. Elegir hold, track si camina, push si cambia la emoción, reveal si importa el grupo.
4. Ajustar 4–8% primero; reservar tiempo suficiente y una pausa final con settle.
5. Añadir preset/leadRoom y revisar que nadie mire contra el borde.
6. Usar handheld pequeño solo si aporta al estilo; fijar seed para repetir el resultado.
7. Leer warnings y review. Si no cabe el movimiento, ampliar su tiempo o reducir
   su recorrido. No usar whip para esconder un movimiento normal demasiado rápido.

Evitar cambios de zoom en cada gesto, apuntar track a las manos, encadenar primeros
planos casi idénticos a corte, duraciones diminutas o desactivar fit accidentalmente.
`locked` no equivale a `fit:false`.

## Medición reproducible

`review.mjs` evalúa a 30 fps, por plano y vista, y añade `camera_motion` con valores,
criterios y lista `failed`. Las gráficas de evidencia separan cortes de trayectorias.

| Criterio | Medición y motivo |
|---|---|
| camara_continuidad | Compara óptica en t−1e-7 y t de cada unión move/dissolve; error máximo <.01 unidades de escenario. También se incluyen tres muestras anteriores al derivar esas uniones. |
| camara_velocidad | p99 por plano de abs Δlog2(h)/Δt y norma de Δcentro/(mínimo ancho·Δt). Límites del estilo; evita que un promedio esconda un plano brusco. |
| camara_aceleracion | p99 de diferencias de velocidades firmadas por segundo. Umbrales del estilo limitan arranques. |
| camara_jerk | p99 de diferencias de aceleraciones firmadas por segundo. Umbrales del estilo limitan golpes de aceleración. |
| sin_bombeo | Hold/fixed sin transición de movimiento: rango ln(h)≤.015 y cero cambios de sentido próximos en una ventana de 1 s. Tolerancia 1e-5 octavas/s para ruido numérico. |
| plano_minimo | Toma ≥1.2 s, salvo insert/whip. Tramos unidos mediante move forman una toma continua. |
| sin_salto | Mismo conjunto declarado de sujetos y corte con max(hA/hB,hB/hA)−1<.25. Move/whip/dissolve se evalúan como transiciones. |
| margen_headroom | Borde superior de cara/pelo ≥ mínimo declarado; tolerancia .0001 del alto. |
| leadRoom | Distancia del borde de cara/pelo al borde de imagen hacia la mirada ≥ mínimo declarado. |

Los límites .30 octavas/s y .35 anchos/s provienen del brief. Los presupuestos
1.2 octavas/s² y 8 octavas/s³ permiten, por ejemplo, un push de 8% en aproximadamente
1 s con el perfil quintic: picos teóricos de .208 octavas/s, .641 octavas/s² y
6.662 octavas/s³. Un pan de .1 anchos en 1 s tiene picos .188, .577 y 6, por debajo
de .35 / 1.4 / 10. Son presupuestos reproducibles; no una garantía estética universal.

No se derivan diferencias a través de cortes. Whip se informa por separado y se
excluye de los límites cinemáticos. La cifra agregada es el **máximo p99 por plano**,
no el p99 agrupando todo el episodio. Las inversiones también se informan para
planos con movimiento, aunque sin_bombeo solo penaliza los estacionarios.

```sh
node --test test/camera-*.test.mjs
node tools/validate.mjs ../vida-en-escena/assets/episode.json --view both
node tools/review.mjs ../vida-en-escena/assets/episode.json ../vida-en-escena/review/camara --view both --times 0,25,30,70,122
```

Las mediciones y límites no sustituyen mirar el video en movimiento. Las pruebas de
píxeles demuestran determinismo, y las hojas de cuadros ayudan a revisar composición,
pero no certifican por sí solas una percepción cinematográfica natural.

## Compatibilidad del validador externo

El esquema y `compile` admiten el contrato nuevo. El prechequeo heredado de
`engine/core/capabilities.js`, que queda fuera de la lista de archivos autorizados,
aún restringe nombres a fixed/follow/dolly/pan/punch/move y cut/whip. Por ello
`tools/validate.mjs` valida los dos episodios entregados (usan aliases compatibles),
pero rechaza un episodio que escriba literalmente push/track, una curva nueva o
transition:move antes de llegar al esquema. Se solicitó autorización para que
únicamente ese prechequeo reutilice el contrato nuevo; no se modificó el archivo.
La API compile y runtime/render sí reciben el contrato completo.

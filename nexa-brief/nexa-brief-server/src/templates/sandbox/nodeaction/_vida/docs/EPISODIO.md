# Contrato breve de un episodio Vida

Salida: 1080×1920, 30 fps. El episodio es JSON, el motor es compartido. Los nombres/rangos/defaults
exactos están en `../catalog.json`; ejemplo ejecutable: `../../vida-en-escena/assets/episodes/capacidades.json`.
Para una producción con diálogo continuo, `../../vida-en-escena/assets/episode.json`.

- Raíz: `version:1`, `id`, `cast`, `scenes`; opcionales `title`, `script`, `resources`, `ui`.
- `resources.timing` y `audioBase` se resuelven desde el JSON. `script:[{id,who,text,emotion}]`
  conserva el guion. `say` solo admite ids con audio/timing existentes. Whisper da anclas/visemas;
  el guion da subtítulos alineados. No inventar ni reescribir timing para cubrir clips ausentes.
- `cast`: `{tomas:"tomas",narrador:{voice:"narrador",offscreen:true}}`. La voz offscreen no está
  en actors y no tiene objetos proxy. Nadie la mira ni escucha; subtítulo en cursiva.
- Escena: `{set,actors,objects,steps,actions?,camera?,transition?,dur?}`. Los ids de set y anclas
  están en catálogo y `sets/<id>/set.json`. Las coordenadas/anclas usan píxeles de lámina.
- `actors` mapa por id o lista con `id`. Actor: `{at,view?,face?,start?}`. `start` admite
  `seated:<ancla seat>`, `view`, `expression`, `wearing:<objeto mochila>` y
  `holding:{right:<id>|{object,carry,hug},left:...}`. Se aplica sin animación ni tiempo extra.
- `objects`: mapa por id con `{prop,owner?,hidden?,params?}`. Un dueño inicial es
  `{actor,hand:"left"|"right"}`, `{actor,slot:"back"|"pocket"}` o `{anchor:<nombre>|[x,y]}`.
  Puede omitirse si lo asigna `start`; una contradicción es error. Cada mano/slot admite un objeto.
- `steps` secuenciales: `{say:"L01",intent?,face?,intensity?,gap?,listen?}`, `{do:<acción>|[acciones]}`,
  `{wait:segundos}` o `{parallel:[steps]}`. El paralelo dura el máximo. `say` dura el clip real.
- Acción: `{who,action,dur?,hand?,...parámetros}`. En `actions` añadir `at` relativo a la escena
  o ancla `@L01`, `@L01:end`, `@L01.palabra`, `@L01.palabra#2`, `@L01.palabra-0.2`.
  Solo son válidas palabras presentes en Whisper. `at` en una acción dentro de `do` no cambia
  el reloj del paso: usar `actions` para anclas.
- Capas: dos acciones explícitas incompatibles fallan; `blend:true` permite una combinación
  intencional. Caminar y sentarse juntos sigue siendo error. Hablar/escuchar son automáticos.
  Objetos reservan su mano; highfive/give reservan también la mano del receptor.

Elecciones de acción frecuentes (ver catálogo para parámetros):

| Intención | Acción |
|---|---|
| Guardar y sacar celular | `stow` / `unstow`, slot pocket; no coordenadas fuera de escena |
| Quitar mochila | `unwear` o `take` desde back propio; luego `put` |
| Empezar sentado/leyendo | `start.seated`, `start.holding`, `hold.hug` |
| Comer | `eat.item`; spoon exige plate; icecream hace 3 lamidas por defecto |
| Pregunta muda | `gesture` y `fx.kind:"?"`; no inventar una línea de talk |
| Encoger hombros/rendirse | `gesture.kind:"shrug"` / `"open-arms"` |
| Sudor con sonrisa | `say.face:"grin"` más `fx.kind:"sweat"` |
| Reacción sentada | `react` normal, el motor conserva cadera y pies |

Cámara opcional: `type=wide|two|medium|close|insert`, `target` o `targets`, `at`, `dur` o `until`.
`move=fixed|follow|dolly|pan|punch|move`; `ease=smooth|smoother|linear`. Dolly out:
`{type:"wide",targets:["tomas","mama"],move:"dolly",zoomFrom:1.15,zoomTo:1,dur:2.5}`.
Pan continuo: `fromTarget` → `target`. El director cubre turnos/reacciones y retorna de inserts.
`two` permite esa cobertura salvo `locked:true`; los demás overrides prevalecen.

Transición **entrante** de escena: `transition:"cut"|"fade"|"wipe"|"dip-white"`, `dur` default .6
(>0, ≤5 y dentro de escena). No mueve anclas ni añade tiempo al audio.

`framing:"fit"` (default) y `view:"auto"` (default del navegador) son opcionales a nivel episodio.
`view:"landscape"` = 1920×1080; `"portrait"` = 1080×1920. El mismo JSON funciona en ambas vistas.
`?view=auto|landscape|portrait` y `?framing=fit|tight` prevalecen sobre el episodio.

En fit, wide/two/medium contienen todos los personajes presentes, con pelo, manos, pies y objetos,
dentro de 3% de margen y por encima del 84% de altura cuando hay subtítulos. Close protege cara/pelo;
insert protege el objeto (y la cara al comer). Portrait puede alejarse del cover y usa relleno de
la lámina estirada, desenfocada y atenuada. Landscape comienza con el ancho completo de la lámina.
Los subtítulos se centran en 91,5% y ocupan la banda 86–97%. `ui.end:{text,dur:2}` sostiene el cierre.
`locked:true` mantiene el plano editorial; para conservar un recorte deliberado hace falta `fit:false`
en ese override. Zoom/offsets no ganan a la protección de fit. `framing:"tight"` conserva la cámara,
la banda 1360–1500 y los criterios anteriores; el director puede sustituir two por medium.

`behind:"id-prop"` en actor o ancla admite oclusión diseñada por un prop front como counter.
Review informa `actores_completos` (bbox de las rutas de dibujo, incluyendo tinta y accesorios),
`sin_zona_vacia` (relleno opaco, texturado y borde desvanecido), `sujeto_suficiente` (fit: cuerpo ≥18%
portrait, ≥28% landscape, cara close ≥25%; tight: 55/28/25%) y `objeto_no_tapa_cuerpo` (35% torso/cara,
excepto behind o asiento propio). La banda inferior ilustrada de fit sustituye la regla de suelo vacío.
Desde `_vida/`:

```sh
node tools/validate.mjs ../vida-en-escena/assets/episode.json --view both
node tools/review.mjs ../vida-en-escena/assets/episode.json ../vida-en-escena/work/review-episodio --view both --every 2
```

Ambos deben terminar con código 0 y review con `passed:true`. Abrir y mirar la hoja, no solo el JSON.
Los objetos ocultos/guardados o fuera de lámina no cuentan como recortes; un objeto parcialmente
cortado sigue fallando. Revisar dueño, contacto de manos, pies, subtítulos y miradas en los beats.
No renderizar un MP4 si el pedido solo autoriza preparación. El mix/render se ejecuta únicamente
cuando lo pide la producción; reutilizar siempre las voces existentes que correspondan.

Render: `node tools/render.mjs <episode.json> [salida.mp4] --view landscape|portrait --framing fit|tight`.
Default portrait; salida landscape automática `render/<id>-16x9.mp4`. `--from`/`--to` permiten muestras.
Review/validate default both. `review --cuts 1 --name vida` produce hojas por corte y orientación.
Navegador: `node tools/browser-check.mjs <outDir> --view both`, sin descargas.

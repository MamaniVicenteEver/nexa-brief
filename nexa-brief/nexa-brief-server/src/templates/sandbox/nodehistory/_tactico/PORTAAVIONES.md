> Biblioteca instalada en `_tactico/`. Las rutas `work/` y `PLAN.md` de este documento parten del episodio `../atlas-en-movimiento/`. Las páginas candidatas usan el sufijo `.new.html`; las activas siguen con el motor local hasta habilitar `_tactico` en la API.

# Unidades terrestres, navales y aéreas

Implementación: `components/units.js`, `components/naval.js`, `components/air.js`. Las definiciones se registran en `Tactico`; `units.json` documenta sprites, esloras relativas, velocidades nominales editoriales en nudos, dominio y sonido. No se usan esas velocidades como especificaciones históricas. El campo `path.speed` del núcleo sigue expresándose en km Mercator/s.

## Portaaviones por datos

`work/tactico/scene-unidades.json` conserva **exactamente** el item Enterprise de `PLAN.md` §5. Declara las palabras de prueba `Enterprise`, `navegaba`, `despegan`, además de una cámara `follow`. Se puede abrir con `work/tactico/unidades.new.html`, que resuelve esas anclas con el temporizador compartido. Para una escena narrada se usan las palabras reales de la transcripción.

- `variant`: `supercarrier` (cubierta angulada e isla), `stovl` (más corto, rampa), `hero` (escala simbólica ×2,05), `inventory` (rejilla de `count` unidades sobre `region`/`country`).
- `deck.aircraft`: entero de 0 a 40. Los aviones de cubierta se dibujan por separado; el sprite preferido es `carrier-super-empty`.
- `escorts`: `{formation:"diamond",units:["naval.warship:cg","naval.warship:ddg","naval.warship:ff"]}`. También admite ids de items navales u objetos `{type,variant,…}`. `cg`, `ddg`, `ff` son alias de cruiser, destroyer, frigate.
- Formaciones: `line` (columna de convoy), `diamond`, `box`, `escort-ring`. `spacing` es un factor de la eslora del líder. Los desplazamientos permanecen fijos en el sistema de coordenadas del líder y giran con la tangente de la ruta: se conserva la distancia entre cada par. No es una simulación de dinámica de navegación.
- `heading:"auto"` calcula el rumbo en Mercator y lo proyecta con el bearing de cámara. Para giros continuos usar `path.curve:"smooth"`; una polilínea `line` tiene esquinas geométricas intencionales.
- `scaleMode:"screen"` mantiene la eslora en píxeles relativos a `U`; `scaleMode:"geo",kmLength:…` la proyecta geográficamente. El factor `scale` se aplica después. Cuando existe una imagen se usa su `relativeLength` de `sprites.json`.
- Estados: `normal`, `detected`, `targeted`, `hit`, `burning`, `wrecked`, `sunk`, `flightops`. `states:[{at,state,dur}]` usa las mezclas del núcleo. Detectado/objetivo: anillos y rótulo rojo; incendio: casco carbonizado y efectos propios; hundimiento: escora, reducción, desaparición y espuma; operaciones: luces de cubierta y vapor de catapulta.

## Acciones aéreas

Acción embebida: `actions:[{type:"air.launch",at:4,count:2,unit:"air.jet:a6",to:[62,21.5]}]`. Como item independiente: `{id:"salida",type:"air.launch",carrier:"enterprise",at:"enterprise",t:4,dur:7,count:2,unit:"air.jet:a6",to:[62,21.5]}`.

`air.recover` usa el mismo `carrier` y un `from:[lon,lat]` opcional. Predice la posición de la cubierta al tocarla; la aproximación continúa por la popa de la pista angulada, frenando hacia la proa. Parámetros compartidos: `interval` (0,65 s), `deckDur` (0,75 s), `flightDur` (3,8 s), `count`, `scale`. `a6` es el alias visual de avión de ataque, no un modelo histórico detallado. Despegue y recuperación tienen tangente continua al cambiar de tramo. La cubierta y los aviones en vuelo son funciones del tiempo absoluto; no se acumula movimiento entre cuadros.

**Despegues, recuperaciones y caída visible de bombas son agregados de la demo: no aparecen en las referencias revisadas.** Las referencias sí muestran aviones sobre el mapa, sombras, estelas y grupos navales. `deck.aircraft` representa el inventario aparcado indicado por la escena; no es un inventario logístico que reste automáticamente cada salida. Las acciones embebidas se ven durante la vida visible del portaaviones. Para que un vuelo continúe fuera de esa toma, usar un item aéreo independiente.

`air.drop` usa `to`, `count`, `interval`, `fallDur` y `height`: la sombra converge con cada bomba y el impacto produce un destello. `air.helicopter` gira el rotor por `t`; `air.prop` anima las hélices. `contrail:true` conecta `trail.contrail` cuando está registrado, sin modificar la API.

## Otras unidades

`unit.token`, `unit.group`, `unit.move`, `unit.advance`, `unit.retreat`: `flag`, `count`, `formation:line|wedge|column`, `path`, `scale`, `trail`, estados `idle|active|retreat|hit|destroyed`. Las fichas mantienen bandera y soldado verticales mientras su formación gira. `fx.clash` acepta `groups:[idA,idB]` y toma el punto medio de sus rutas.

`naval.cargo`: tanker/container/bulk; `naval.warship`: destroyer/frigate/cruiser; `naval.submarine`: normal/translucent, o `translucent:true`, rótulo azul con guía. `air.bomber`: wing/swept; `air.jet`: attack/fighter; `air.helicopter`: utility; `air.prop`: transport.

La ruta del líder se valida contra tierra con Natural Earth en el núcleo. Los offsets simbólicos de una formación en pantalla no constituyen rutas geográficas independientes; cerca de la costa conviene dejar margen o reducir la escala. Una rejilla `inventory` utiliza puntos interiores de la geometría del territorio y excluye sus huecos.

## Revisión reproducible

- Galería compartida: `work/tactico/demo.new.html?items=items-units.json`, `?items=items-naval.json`, `?items=items-air.json`.
- Escena completa con anclas: `work/tactico/unidades.new.html`.
- Casos: `cases-unidades.json`; capturas: `shots/units`, `shots/naval`, `shots/air`; hojas: `sheets/units.jpg`, `sheets/naval.jpg`, `sheets/air.jpg`.
- Movimiento: `scene-unidades-movimiento.json`, `sheets/unidades-tira-10fps.jpg`.
- Pruebas geométricas y de contrato: `node --test work/tactico/unidades.test.mjs`.
- Navegador: copiar `work/tactico/check-unidades.py.txt` a una ruta nueva de `/tmp`, ejecutar desde la raíz de esta plantilla con el Python del proyecto. El script toma `/tmp/atlas-tactico-chromium.lock`, abre una sola página y usa SwiftShader con dos hilos de raster. No genera MP4.
- Medidas y límites verificados: `work/results/tactico-unidades.md`.

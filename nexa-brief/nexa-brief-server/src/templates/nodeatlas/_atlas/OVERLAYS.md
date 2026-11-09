# Atlas overlays

`createOverlays(scene, env)` recibe `scene.layers` y `env` con `T(valor, fallback)`, `loadImg(src)`, `img(src)`, `place(nombre)`, `font` y `base`. `ready()` espera las imágenes; `missing()` devuelve sus nombres originales fallidos. `draw(ctx, t, view)` dibuja sin conservar estado entre cuadros; `layout(t, view)` devuelve rectángulos `{x,y,w,h,index}` ocupados (incluidas las fotos). Los rótulos y fotos cercanos se desplazan automáticamente para evitar solapes; el poste conecta el ancla con la ficha desplazada. `view` provee `W`, `H`, `pitch`, `zoom`, `bearing` y `project(lon,lat,altM)`. Coordenadas geográficas son `[longitud,latitud]` o nombres resueltos por `place`. El tamaño de diseño escala por `min(W,H)/1080` y perspectiva. Los tiempos `t`, `out`, `dur` y `fillAt` aceptan números o anclas interpretadas por `T`; `out` inicia la salida de duración `dur`. Texto en mayúsculas salvo `upper:false`. Las rutas de imágenes se resuelven contra `base`.

Ejemplos de capas (tiempos en segundos):

```json
{"type":"ring","at":[-97,31],"t":0,"r":42,"color":"#fff","pulse":true}
{"type":"pole-photo","at":[-97,31],"t":1,"src":"portrait.jpg","label":"Headquarter","sub":"Texas","poleH":155,"size":74,"side":"right","ring":true}
{"type":"hex-photo","at":[-50,-10],"t":2,"src":"factory.jpg","fillAt":3,"title":"Supplier","text":"Descripción del proveedor","side":"right"}
{"type":"tag","at":[-120,38],"t":2,"text":"Research","color":"#a3126f","up":115}
{"type":"panel","at":[40,55],"t":3,"src":"train.jpg","title":"Distributor","text":"Descripción de la ruta","anchor":"left","accent":"#18b4f0","blankFor":0.5}
{"type":"bars","at":[23,-2],"t":4,"text":"Warehouse"}
{"type":"arc","from":[2,48],"to":[-97,31],"t":0,"dur":2,"style":"cyan","lift":100,"tail":0.3,"keep":true}
{"type":"dot","at":[2,48],"t":0,"r":7}
{"type":"title","text":"A connected world","sub":"Atlas","y":0.2,"size":65,"t":1}
```

En `arc`, `style` puede ser `cyan` o `magenta`; `from:null` entra desde fuera de pantalla. `lift` es desplazamiento vertical en píxeles de diseño; `altM` se pasa a la proyección. La demo `test/overlays-demo.html?t=3` muestra todas las capas; `?t=0&play=1` anima desde cero. Servir por HTTP para cargar módulos ES.

## Entradas reutilizables y producción

La fuente de entradas para agentes es `components.json`: `produce.mjs catalog` busca piezas y `example <nombre>` devuelve `target`, tipos, valores y ejemplo. El showcase usa ese catálogo y el mismo renderizador, sin implementar otra versión del componente.

- `arrow` es un alias de `arc` con punta triangular. `path` admite `great-circle`, `straight` y `curve`; `head` admite `dot`, `arrow` y `none`. `dashed`, `bidirectional` y `flow` son opciones combinables. `flowSpeed` expresa vueltas por segundo y `headSize` píxeles de diseño. En doble sentido, usar dos capas si cada dirección necesita su propia cifra.
- `label`, `value` y `unit` permiten rotular una ruta. En episodios documentales, `dataRef` toma el valor, la unidad y el nombre desde `scene.data[id]`, prevaleciendo sobre los valores ilustrativos de un ejemplo. El dato contiene también `source`, `year` y `scope`; `%` requiere describir su denominador. `check --ready` bloquea cifras pendientes de evidencia.
- `metric` dibuja una tarjeta numérica. Puede usar `at` geográfico o `x`, `y` como fracciones de pantalla al omitir `at`; comparte `dataRef`. No se necesita un componente nuevo para cada porcentaje.
- Las capas de overlays admiten `enter` y `exit`: `{ "style": "fade", "dur": 0.6 }`. Estilos: `fade`, `rise`, `scale`, `slide-left`, `slide-right`; `distance` opcional en píxeles de diseño. La salida empieza en `out` y acaba en `out + exit.dur`; sin `exit` conserva el corte anterior. Estos transformados no se aplican a los polígonos `highlight` del mapa.
- Las fotos circular, hexagonal y de panel aceptan `focus: [0.5,0.5]` para el centro del recorte. Todas las imágenes de un tipo comparten un dibujante; sólo cambian `src`, ubicación, textos y tiempos. `src` es relativo a `assets/` del episodio.

Procedimiento de voz, montaje, preparación y revisión: `SKILL.md` → `PRODUCIR.md`. Los ejemplos numéricos del catálogo no son estadísticas reales.

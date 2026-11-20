# Contrato de la biblioteca táctica (`engine/tactico/`)

Todas las tareas de Codex que construyen componentes DEBEN cumplir este contrato. Si algo falta, se propone en el
RESULT; no se inventa una convención distinta. Escrito el 2026-11-03.

## 1. Dónde vive cada cosa

```
atlas-en-movimiento/
├── engine/plano/        renderizador 2D (dueño: tarea plano-rendimiento). Gancho tactico ya puesto (ver §2).
├── engine/tactico/
│   ├── core.js          registro, línea de tiempo, validación, cámara macros, SFX, sprites   (tarea tactico-core)
│   ├── util.js          easing, curvas, rumbo, escala, ruido con semilla, texto con contorno    (tactico-core)
│   ├── sprites.js       carga de sprites.json y dibujo con sombra y rumbo                       (tactico-core)
│   ├── components/      UN archivo por familia: territory.js, units.js, naval.js, air.js, strike.js, fx.js,
│   │                    sites.js, economy.js, editorial.js, labels.js, routes.js, intro.js …  (tareas posteriores)
│   ├── sprites/         PNG + sprites.json (tarea sprites)
│   ├── sfx.json         catálogo de sonidos                                                      (tarea sonido)
│   ├── components.json  catálogo generado (`node tools/catalog.mjs`)                             (tactico-core)
│   └── tools/           validate.mjs, catalog.mjs, previews, scripts bpy
├── assets/scene.json    el episodio: SOLO datos
└── work/…               briefs, results, research, bench
```

## 2. Integración con Atlas plano (ya implementada en `engine/plano/plano.js`)

`plano.js` hace, si `scene.items` existe:
1. `tm = await import('../tactico/core.js'); tm.expandScene(scene, {T})` ANTES de crear la cámara. `T(valor, defecto)` resuelve
   tiempos (segundos o anclas de voz `@palabra`). `expandScene` MUTA `scene.camera`: expande las macros
   (`follow`, `zoomThrough`, `reframe`, `focus` por id de unidad) a keys explícitas del contrato de `_atlas/camera.js`.
2. `c.tactico = await tm.create(c, scene)` después de los territorios. `c` trae `st {W,H,U}`, `T`, `shared`, `look`, `geo`,
   `camera`, `tiles`, `territories`. Debe devolver `{draw(g, view, t, info), key(t), missing(), sfx(), duration}`.
3. En cada muestra de dibujo (también las del desenfoque de movimiento): `c.tactico.draw(g, view, t, {sample:true})`
   después del mapa. `g` es un contexto 2D con `resetTransform` ya hecho; `view` es el contrato de plano (`W,H,zoom,bearing,
   project(lon,lat)→{x,y,visible,k}`, `mercatorToScreen`, `bounds`). `key(t)` devuelve un valor serializable que cambia cuando
   cambia algo visible (se usa para reutilizar el último bitmap en reposo): si un item anima, su estado entra en la clave.

`draw` debe ser **función pura de `t`**: nada de `Math.random`, `Date`, `performance.now`, acumuladores ni dependencia del
cuadro anterior. Se verifica con seek fuera de orden (mismo hash).

## 3. Escena (`assets/scene.json`), formato `items`

```jsonc
{
  "duration": 270, "planoLook": "tactico", "lang": "es",
  "tiles": {"provider": "gibs-bluemarble", "manifest": "…"},
  "motionBlur": {"samples": 4, "fps": 30, "shutter": 0.5, "thresholdPx": 2},
  "places": {"Kharg": [50.33, 29.25]},                       // nombres → [lon,lat] (igual que Atlas)
  "defs": {"mar": {"flagMode": "marker"}},                    // opcional: valores por defecto reutilizables
  "camera": [ {"t": 0, "center": [56.5, 26.5], "zoom": 6},
              {"t": "@frase", "follow": "bridgeton", "zoom": 8, "dur": 3, "ease": "inOut"},
              {"t": 40, "zoomThrough": {"to": "Abadán", "zoom": 9, "spin": 25}, "dur": 2.5} ],
  "layers": [ {"type": "territory.fill", "region": "IR", "flag": "IR", "flagMode": "fill", "t": 0} ],   // heredado de plano
  "items": [
    {"id": "bridgeton", "type": "naval.cargo", "variant": "tanker", "flag": "US", "label": "Bridgeton",
     "at": "Kharg", "heading": "auto", "scale": 1,
     "path": {"via": [[50.3,29.2],[52,28],[56.2,26.6]], "t": "@navegaba", "dur": 12, "ease": "inOut"},
     "t": 2, "dur": 40, "out": 42, "z": 0,
     "states": [{"at": "@mina", "state": "hit"}], "sfx": "naval-engine-low"}
  ],
  "sound": {"mix": "assets/mix.mp3", "cues": [ … ]}            // lo escribe la tarea sonido
}
```

Reglas generales de todo item:
- Campos comunes: `id` (único), `type` (nombre del componente), `t` (inicio), `dur`, `out` (inicio del fade de salida),
  `fade` (s, por defecto 0.35), `z` (orden dentro de su capa), `layer` (opcional, reemplaza la capa por defecto),
  `at` (nombre de `places`, o `[lon,lat]`, o id de otro item), `label`, `sfx` (id de `sfx.json` o lista), `note`.
- Tiempos: número o ancla `@palabra[:end][+0.4]` resuelta con `T`. Todo tiempo de un sub-objeto (`path.t`, `states[].at`,
  `actions[].at`) usa lo mismo.
- Posición animada: `path: {via:[[lon,lat],…], t, dur, ease, curve?:"line"|"arc"|"smooth", speed?}` → `util.pathAt(path, t)`
  devuelve `{lon,lat,heading,u}` (heading en grados desde el norte, calculado en Mercator, no en lon/lat crudo).
  `heading:"auto"` usa la tangente de la trayectoria; un número fija el rumbo.
- Tamaños: en píxeles de pantalla relativos a `U = W/1080` (`st.U`) y a `view.zoom` si el componente es de tamaño
  geográfico (`scaleMode: "screen"` por defecto | `"geo"` con `kmLength`). Sprites usan la eslora relativa de `sprites.json`.
- Estados visuales: cada componente declara los suyos; un cambio de estado se hace con `states:[{at,state,dur?}]` y se
  interpola (p. ej. normal → hit → burning → wrecked → sunk).
- Rutas marítimas (`route.sea`, `path` de unidades con `domain:"sea"`): `validate` rechaza trazados cuyo segmento cruce tierra
  (usa `c.territories`/Natural Earth land) y propone waypoints; los aéreos no se validan.
- Capas (z global, menor = debajo): 10 territorios/relleno · 15 rutas/flechas planas · 20 sitios (puertos, refinerías,
  plataformas) · 30 unidades terrestres · 40 unidades navales · 50 aéreas · 60 efectos (fx, strike) · 70 rótulos/callouts ·
  80 editorial (retratos, prensa, fotos) · 90 HUD (año, contador, intro/cierre).
- Colores solo desde `defs.palette`/`planoLook` (`tactico.json`) y `identity` de banderas; texto con fuente declarada.
- Sin emojis en ningún texto.

## 4. API de un componente

```js
Tactico.component('naval.carrier', {
  layer: 40,
  summary: 'Portaaviones: variantes supercarrier|stovl|hero|inventory, escoltas, aviones en cubierta, estados.',
  params: { variant:{type:'enum', values:['supercarrier','stovl','hero','inventory'], default:'supercarrier'}, … },
  states: ['normal','flightops','detected','hit','burning','wrecked','sunk'],
  validate(item, ctx) { return [ /* mensajes de error */ ]; },
  prepare(item, ctx) { /* resolver tiempos, cargar sprites; devuelve estado interno inmutable */ },
  draw(g, s, view, env) { /* s = {item, t, lt, u, alpha, pos, heading, state, stateT, internal} ; dibuja con view.project */ },
  sfx(item, ctx) { return [ {sfx:'naval-engine-low', at:…, dur:…, gain_db:-14} ]; },   // eventos de sonido derivados
  demo: { /* item de ejemplo que valida y se ve bien */ },
});
```

`env` = `{W,H,U,zoom,k,rng(seed),sprite(name),flag(code),font(name),palette,debug}`. `rng(seed)` es un PRNG determinista
(mulberry32) para texturas o partículas: la misma semilla y el mismo `t` dan el mismo resultado.

## 5. Validación y catálogo

- `node engine/tactico/tools/validate.mjs assets/scene.json` → lista de errores/avisos por item (tipos desconocidos,
  tiempos sin resolver, ids duplicados, ruta marítima sobre tierra, sprite faltante, anclas no encontradas) y sale con
  código ≠ 0 si hay errores.
- `node engine/tactico/tools/catalog.mjs` regenera `components.json` (nombre, summary, layer, params, states, demo,
  file, used_by) desde el registro.
- Cada componente nuevo agrega un item `demo` y aparece en `work/tactico/demo.html` (galería con control de tiempo).

## 6. Prohibido (todas las tareas)

Grabar video MP4; tocar archivos fuera de `atlas-en-movimiento/`, `/tmp` y cachés; reiniciar servicios; leer `.env` o
tokens; editar `engine/plano/*` salvo la tarea que lo posee; usar emojis; inventar citas o titulares de medios reales;
usar assets sin licencia anotada.

## Estilo de textos y cierre aprobado

Los componentes de texto usan por defecto una paleta independiente del mapa y las unidades: grafito `#20252b`, blancos neutros y contorno de letras negro. Se pueden ajustar las claves mediante `scene.defs.textPalette`; no sustituir el color del mapa global para cambiar los textos. `label.chip` es texto sin recuadro. La transcripción conserva su configuración independiente en `scene.captions`.

`outro.channel` presenta el mapa mundial en color y una secuencia sin recuadro general: agradecimiento, canal, me gusta, suscripción y campana, apoyo y dirección. La imagen local del mundo es `assets/media/mapa-mundo-cierre.jpg`; debe acompañar al motor en las copias de la plantilla. `dim` controla el oscurecimiento (0,20 predeterminado; 0,30 para una alternativa más oscura); `bg` admite `world` o `none`, y `titleColor`, `textColor`, `secondaryColor`, `cta` y `arrow` son configurables. Mantener el mapa en color y sin leyendas técnicas sobre el video.

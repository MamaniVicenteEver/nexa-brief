> Promoción del motor preparada el 2026-11-03: copia en `_atlas/plano/`, `_atlas/looks/tactico.json` y `_tactico/`. No conmutada: la API aún rechaza `_tactico`. Las rutas y decisiones históricas de abajo describen el prototipo original; estado vigente y evidencia en `work/results/promover-motor.md`.

# Atlas en Movimiento · plan (2026-11-03)

Prototipo Sandbox (NodeHistory): mapas tácticos 9:16 para geografía, historia, comercio y geopolítica.
Evoluciona **bolivia-mar** (`_mapas`) y aprovecha el motor **Atlas** (`_atlas`, MapLibre, hecho hoy por otra sesión).
Análisis de las 5 referencias: `REFERENCIAS.md` (evidencia en `work/ref/`). Estado: **en preparación, sin grabar**.

## 1. Decisión técnica

| Opción | A favor | En contra |
|---|---|---|
| Ampliar `_mapas` (d3 + satélite estático JPG) | rápido, determinista, ya hace rellenos con mezcla y banderas (148) | un JPG por región; pierde nitidez al acercarse; mundo entero → Kamchatka → Ormuz exige varias imágenes enormes |
| Usar `_atlas` 3D (MapLibre) tal cual | teselas a cualquier zoom, relieve, etiquetas | 1–2 s/cuadro a 1080p en SwiftShader (≈ 4 h para 5 min); sin modos de mezcla; las referencias son cenitales (no necesitan 3D) |
| **Atlas plano** (nuevo renderizador 2D de la familia Atlas) | usa la caché de teselas y geodatos de Atlas; Mercator cenital = transformación afín → teselas y territorios con `drawImage`/`Path2D` + modos de mezcla como `_mapas`; misma imagen en vivo y en grabación; objetivo < 60 ms/cuadro | hay que escribir el renderizador de teselas (pequeño) |

**Recomendado: Atlas plano + biblioteca táctica común.** No se toca bolivia-mar ni `_mapas`.
De `_atlas` solo se agrega, si hace falta, un gancho opcional para registrar tipos de overlay (sin cambio de
salida en atlas-cinematico). La decisión se confirma con una **medición previa** (tarea `base-medicion`):
ms/cuadro a 1080×1920 de las dos bases (Atlas 3D raster sin relieve, pitch 0 · Atlas plano) en el mismo tramo.

```
sandbox/nodehistory/
├── _atlas/                 (existe) caché de teselas, providers.json, data/geo, camera.js, looks
├── _atlas/plano/           NUEVO renderizador 2D: teselas + cámara + desenfoque de movimiento + view
├── _tactico/               NUEVA biblioteca de componentes (dibujan contra `view`, no saben qué base hay)
│   ├── components.json     catálogo (formato explainer-kit: name, summary, tags, layer, params, file, demo, used_by)
│   ├── units.json          tipos de unidad (sprites, eslora relativa, velocidad, sonido por defecto)
│   ├── sfx.json            biblioteca de efectos (id, archivo/asset_id, procedencia, licencia, gain, fades)
│   ├── sprites/            atlas de sprites PNG con alfa (generados con Blender, cenitales)
│   ├── CONTRATO.md         contrato JSON del episodio + validación
│   └── PORTAAVIONES.md     cómo reutilizar el portaaviones sin tocar el motor
└── atlas-en-movimiento/    datos del demo (scene.json, voz, medios) + variante breve
```

**Ubicación mientras es prototipo:** `delegate.sh` solo deja escribir a Codex en la carpeta del prototipo,
`/tmp` y las cachés. Por eso, hasta que el usuario apruebe el motor, `_atlas/plano/` vive en
`atlas-en-movimiento/engine/plano/` y `_tactico/` en `atlas-en-movimiento/engine/tactico/` (rutas a `_atlas`
centralizadas en `engine/plano/paths.js`). Con el OK, Claude los mueve a su sitio final y ajusta esa ruta.
En la tabla de §10, leer `_atlas/plano/` y `_tactico/` con esa equivalencia.

Contrato `view` (ya usado por `_atlas/overlays.js`): `W, H, zoom, bearing, pitch, project(lon,lat) → {x,y,visible,k}`.
Atlas plano agrega `mercatorToScreen` (matriz afín) para dibujar polígonos cacheados como `Path2D` con `setTransform`.

## 2. Formato
**9:16, 1080×1920, 30 fps** (las 5 referencias son verticales). Zonas seguras: nada importante en el 8 % superior
ni en el 20 % inferior (subtítulos en y ≈ 0.72–0.78). 16:9 queda como salida secundaria del mismo scene.json.

## 3. Mapa base (look `tactico`)
Satélite **NASA GIBS Blue Marble con relieve sombreado y batimetría** (`BlueMarble_ShadedRelief_Bathymetry`, z ≤ 8;
la tarea verifica el id y la licencia en `_atlas/providers.json`), gradación: océano azul petróleo oscuro, tierra
algo desaturada, viñeta fuerte. Fronteras desde `_atlas/data/geo` (Natural Earth): finas, claras, brillo leve.

## 4. Biblioteca `_tactico` (familias obligatorias)
Todo en `[lon,lat]` o nombres de lugar/país; tiempos en segundos o anclas `"@palabra"`; estados con `at`.

- **A · Territorios**: `territory.fill` (color mezclado con el relieve: multiply+screen+overlay como `_mapas`),
  `territory.flag` (bandera recortada por el límite, franjas alineadas a pantalla o al país), `territory.hatch`,
  `territory.glow` (borde neón), `territory.extrude` (losa con canto), `territory.state` (transición de estado
  con barrido direccional: bandera → color del ocupante, por frente o por radio), `flag.marker` (bandera en mástil
  que ondea, independiente del relleno). Modo por JSON: `"flagMode": "fill" | "marker" | "both" | "none"`.
- **B · Unidades**: `unit.token` (ficha octógono con fondo de bandera + soldado, aro dorado, sombra),
  `unit.group` (formación línea/cuña/columna), `unit.move` (por ruta), `unit.advance`/`unit.retreat`
  (semántica + color del frente), `front.line`, `range.ring`, estados `idle|active|retreat|hit|destroyed`, `fx.clash`.
- **C · Navegación y aviación** (sprites cenitales, proa = rumbo de la trayectoria, sombra desplazada, estela):
  `naval.cargo` (petrolero/carga/portacontenedores), `naval.warship` (fragata/destructor), `naval.carrier`
  (§5), `naval.submarine`, `naval.group` (escoltas en formación alrededor de un líder), `air.bomber`, `air.jet`,
  `air.helicopter` (rotor girando), `trail.contrail`, acciones `air.drop` (bombas que caen con sombra que
  converge), `air.launch`/`air.recover` (agregadas), `strike.missile`, `strike.torpedo`, `strike.salvo`
  (abanico/llovizna), estados de buque `normal|detected|targeted|hit|burning|wrecked|sunk`.
  Las rutas marítimas se trazan por agua: `route.sea` usa puntos de paso y la tarea agrega un validador que
  rechaza tramos que cruzan tierra (máscara de tierra de Natural Earth).
- **D · Infraestructura y economía**: `site.plant`, `site.refinery`, `site.oilfield`, `site.port`, `site.base`,
  `site.platform` (plataforma petrolera) en isométrico con estados `active|hit|burning|destroyed`;
  `money.stack` (fajos que se deslizan y apilan), `money.flow` (billetes por una ruta), `label.figure`
  (cifra grande inclinada), `route.lanes` (haz de rutas), `arrow.flow`.
- **E · Flechas y efectos**: `arrow.route`, `arrow.curve`, `arrow.flow` (con avance), `arrow.bolt`,
  `fx.explosion`, `fx.impact` (tierra/agua: columna de agua), `fx.shockwave`, `fx.smoke` (persistente con
  deriva), `fx.fire`. Semilla por instancia; tamaño ligado a `k` y acotado para no tapar información.
- **F · Editorial**: `portrait.badge` (octógono neón), `portrait.cutout` (recorte que sale del país, borde
  blanco brillante), `editorial.press` (retrato + documento/foto inclinado con procedencia y fecha; nunca un
  titular inventado atribuido a un medio real), `callout.photo` (ficha foto con haz hacia la unidad),
  `label.callout` (rótulo con línea guía y estrella), `label.neon`, `label.chip`, `text.year`,
  `badge.count` (número que rueda), `inventory.units` (N unidades dentro de un país), `icon.badge`.
- **G · Cámara** (`_atlas/camera.js`, pura de `t`, C1): `view`, `focus` a país/región/lugar, `follow`
  (sigue una unidad o la cabeza de una ruta con adelanto), `zoomThrough` (zoom acelerado + giro), `reframe`
  (deja hueco para retrato/documento: desplaza el centro óptico), desenfoque de movimiento opcional
  proporcional a la velocidad de pantalla (sin aplicar en tomas quietas).

## 5. Portaaviones (`naval.carrier`)
```json
{"type":"naval.carrier","id":"enterprise","variant":"supercarrier","flag":"US","label":"USS Enterprise",
 "at":[58.4,24.9],"heading":"auto","t":"@Enterprise","scale":1.0,
 "path":{"via":[[58.4,24.9],[57.2,25.6]],"t":"@navegaba","dur":9,"ease":"inOut"},
 "escorts":{"formation":"diamond","units":["naval.warship:cg","naval.warship:ddg","naval.warship:ff"]},
 "deck":{"aircraft":12},
 "states":[{"at":"@despegan","state":"flightops"}],
 "actions":[{"type":"air.launch","at":"@despegan","count":2,"unit":"air.jet:a6","to":[51.3,26.2]}],
 "follow":true, "sfx":"naval-engine-low"}
```
Variantes: `supercarrier` (cubierta en ángulo, isla a estribor), `stovl` (rampa de esquí, más corto),
`hero` (escala simbólica grande, ref5 0:12) e `inventory` (ícono repetido dentro de un país, ref5 0:04).
Diferencia visual clara: carga = casco ancho y contenedores/tanques de colores; buque = gris estrecho con
torres; portaaviones = cubierta plana gris oscura con marcas y aviones.

## 6. Sonido
Reutiliza `src/adapters/sound_effects` (SFXMint) + biblioteca `/api/v1/library/sounds` + plan de cues con
ducking (como `nodeatlas/japon-expansion-prueba/assets/sound-design/*/plan.json`). Eventos en JSON:
`{"sfx":"explosion-near","at":"@impacto","dur":2.5,"gain_db":-9,"fade_out":0.4}`; cada componente puede
declarar su sonido por defecto en `units.json` y la escena lo apaga con `"sfx": false`. Vista previa: WebAudio
programado por tiempo de composición (pausa y seek detienen y reprograman); grabación: mezcla offline al MP4.
Criterio: una explosión importante cada tanto, nunca un golpe por cada aparición.

## 7. Intro y cierre (nuevos, por datos)
- **Intro** (≤ 6 s): el mapa desde el primer cuadro, un hecho concreto en pantalla (cifra/fecha) y una primera
  acción (p. ej. el petrolero que explota), título corto anclado al mapa. Variantes `golpe` y `pregunta`.
- **Cierre** (≤ 8 s): balance visual (el frente vuelve a la línea inicial / contador final) + frase editorial
  + firma discreta del canal anclada al mapa. Sin pantalla de suscripción genérica.

## 8. Historia del demo (propuesta, ~4:30) — se verifica en la tarea `investigar`
**«La guerra de los petroleros» (Golfo Pérsico, 1980–1988)**: un caso documentado que pide todas las familias.
1. Gancho: petrolero escoltado que choca con una mina en el Golfo (Bridgeton, 24 jul 1987).
2. Contexto: Irán e Irak con banderas dentro del territorio; retratos de los dirigentes del periodo; sept. 1980
   avance iraquí en Juzestán (fichas), refinería de Abadán alcanzada; 1982 retroceso (Jorramchar).
3. Petróleo = dinero: flujos desde Kharg y Kuwait por Ormuz hacia Japón, Europa y EE. UU.; zoom al mundo con
   banderas en modo marcador.
4. Guerra de los petroleros: bombarderos iraquíes sobre la terminal de Kharg (caída de bombas, incendio);
   ataques a mercantes; USS Stark alcanzado por misiles (17 may 1987) → composición editorial con foto oficial.
5. Earnest Will: petroleros con nueva bandera en convoy; grupo de portaaviones en el golfo de Omán;
   helicópteros sobre el Iran Ajr (21 sep 1987).
6. Mantis Religiosa (18 abr 1988): plataformas petroleras destruidas; aviones del portaaviones contra fragatas.
7. Cierre: resolución 598 aceptada (jul 1988), alto el fuego (20 ago 1988); el frente vuelve casi a la línea de 1980.
**Variante breve por datos (~50 s):** Malvinas 1982 (portaaviones, bombardero, helicópteros, buques alcanzados)
sin tocar motor ni biblioteca.

## 9. Rendimiento (objetivos medibles)
- Vista previa (navegador del usuario con GPU): media ≤ 16 ms/cuadro, p95 ≤ 25 ms en los tramos más cargados.
- Exportación (alfred-server, SwiftShader, 1 render a la vez): ≤ 150 ms/cuadro a 1080×1920.
- Video exportado: 0 cuadros duplicados/congelados en vuelos de cámara (diferencia entre cuadros consecutivos > 0).
- Nada de red, geocodificación ni decodificación de imágenes en el cuadro: barrido de precarga de teselas y
  sprites antes de reproducir (`__atlas.sweep`), `missingTiles()` vacío para grabar.

## 10. Fases, agentes y puertas
Modelos verificados en el servidor: `gpt-6-astra`, `gpt-6.1-sol` (high/xhigh). Lanzamiento:
`AGENT_CODEX_MODEL=<modelo> _tools/sandbox/delegate.sh nodehistory/atlas-en-movimiento <tarea> --bg`.

| ola | tarea | modelo | toca | puerta (revisa Claude) |
|---|---|---|---|---|
| 1 | `investigar` hechos + medios + sonidos | Sol 6.1 | `work/research/` | fuentes y licencias |
| 1 | `base-medicion` Atlas plano + benchmark | Astra | `_atlas/plano/`, `work/bench/` | ms/cuadro, hoja de capturas |
| 2 | `sprites` Blender (8 unidades + estados) | Sol 6.1 | `_tactico/sprites/`, `_tactico/tools/` | hoja de sprites vs ref5/ref3/ref4 |
| 2 | `tactico-territorios-fx` (A, E) | Sol 6.1 | `_tactico/territory*.js`, `fx*.js` | demo navegador |
| 3 | `tactico-unidades` (B, C, portaaviones) | Astra | `_tactico/units*.js`, `naval*.js`, `air*.js` | demo + tira de movimiento |
| 3 | `tactico-editorial-economia` (D, F) | Sol 6.1 | `_tactico/sites*.js`, `editorial*.js` | demo |
| 4 | `sonido` catálogo + cues + vista previa | Sol 6.1 | `_tactico/sfx*`, `atlas-en-movimiento/assets/sound*` | sync, pausa/seek |
| 4 | `intro-cierre` | Sol 6.1 | `_tactico/intro*.js`, `outro*.js` | hoja |
| 5 | `prueba-corta` 25 s (cámara + unidades + ruta + impacto + retrato + sonido) | Sol 6.1 | escena de prueba | comparación con ref (compare.py) |
| 6 | `guion-voz` + `escena-completa` | Sol 6.1 | `atlas-en-movimiento/assets/` | hojas + matriz |
| 6 | `variante-malvinas` | Sol 6.1 | `atlas-en-movimiento/variantes/malvinas/` | 0 cambios en motor |
| — | revisión adversarial de base y cámara | Astra | solo lectura | — |

Máximo 2 tareas en paralelo y nunca sobre los mismos archivos. Nada de grabar MP4: el resultado queda
**en preparación** (listo para grabar) y el usuario decide.

## 11. Verificación y cierre
Hojas de capturas por tramo, tiras de movimiento a 10 fps en los vuelos, seek fuera de orden idéntico,
consola sin errores, `missingTiles()` vacío, validador del scene.json en 0 errores, plantillas afectadas
(bolivia-mar, atlas-cinematico) sin cambios de salida, matriz completa en `REFERENCIAS.md`, tokens en `info.json`.

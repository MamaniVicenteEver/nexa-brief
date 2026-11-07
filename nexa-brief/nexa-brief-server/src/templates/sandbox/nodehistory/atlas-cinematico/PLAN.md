# Atlas Cinemático · plan (2026-11-03)

Prototipo Sandbox (NodeHistory) de mapas 3D cinematográficos. Un video = datos (`assets/scene.json`); el motor (`../_atlas/`) no se toca.
Referencia: `../../referencias/nodeaction/maps/From Klickpin.com- High Protein Lunch Ideas…-715579828300640400.mp4`
(copiada y verificada con SHA-256 `63b21b65…c5c7`). Formato conservado: **960×540, 16:9, 25 fps** (se renderiza a 1920×1080/30 fps, mismo 16:9).

## 1. Estudio temporal de la referencia (0–24 s)
Es una plantilla de «conexiones sobre la Tierra»: globo real inclinado con relieve, países resaltados, arcos y fichas.
**O** = observado; **E** = estimado (no hay metadatos de cámara en el video).

| t (s) | O: qué se ve | E: cámara |
|---|---|---|
| 0.0–1.0 | Vista oblicua sobre Europa occidental/Atlántico Norte, bruma blanca en el horizonte, nubes sobre el relieve. Punto blanco que late (≈ Francia) | pitch ≈ 58–62°, zoom ≈ 3.5, rumbo ≈ 0° |
| 1.0–3.0 | Sale un arco cian (cinta gruesa, cabeza brillante). La cámara va hacia el oeste siguiendo la cabeza del arco; entra EE. UU. por la derecha | avance ≈ 70° de longitud en 2 s, aceleración suave, sin parar |
| 3.0–3.5 | Llega a Texas: anillo que se dibuja; EE. UU. se tiñe oliva dejando ver el relieve; Texas se rellena rosa | frena a casi 0 con deriva lenta |
| 3.5–5.5 | Poste con ficha circular de foto («HEADQUARTER»), texto a la derecha | quieta + deriva |
| 5.5–8.5 | Arcos magenta elevados (lazos) a California, Montana y noreste; esos estados rosa; pestañas magenta «RESEARCH / DEVELOPMENT / OFFICES» con anillo punteado | ligera rotación |
| 9.0–10.5 | Cámara baja hacia el sur; arco cian sube por arriba; horizonte alto | pitch sube a ≈ 70°, rumbo cambia |
| 10.5–12.5 | Sudamérica: poste + hexágono vacío (11.0) que se llena con foto (12.0) y texto «SUPPLIER»; Brasil oliva | pausa corta |
| 13.5–16.0 | Barrido al este: Atlántico → Sahara → Mediterráneo → Eurasia, con arco cian en la esquina | travesía continua ≈ 100° en 2.5 s |
| 16.0–18.5 | Rusia oliva con frontera; panel en blanco (16.0) → panel foto de tren + texto «DISTRIBUTOR» (16.5), anillo-mira en el punto | quieta con deriva |
| 19.0–22.0 | Giro al sur hacia África central; arco cian cae sobre RD Congo (oliva con fronteras interiores); barras de etiqueta se despliegan → «WAREHOUSE» (21.5) | zoom en acercamiento |
| 22.0–22.4 | Corte seco a negro | — |
| 22.4–24.0 | Horizonte de la Tierra desde el espacio, resplandor de atmósfera; título aparece ≈ 23.4 | pitch ≈ 85°, globo |

**Anclado al mapa:** punto, anillos, postes, fichas, hexágonos, paneles, arcos, resaltados (se mueven con la cámara).
**Anclado a pantalla:** título final, viñeta/bruma.
**Estilo de la imagen:** satélite tipo Blue Marble con relieve, cielo/bruma blanco-azulada, nubes tenues; países resaltados en oliva semitransparente con borde claro; texto Montserrat-like blanco.
No se inventan coordenadas: las de la escena demo son **E** (lugares genéricos que el video muestra) y están en `assets/scene.json`.

## 2. Qué se reutiliza y qué se crea
- De **bolivia-mar / `_mapas`**: contrato `scene.json` (anclas `"@palabra"`, `places`, `regions`, `camera[]`, `layers[]`), núcleo `_proto/proto.js` (reloj, subtítulos, intro/cierre, ventana de medios, `__promo`), idea de cámara que conserva velocidad (`camera.js`), `places.json` como inspiración de gazetteer.
- De **«La noche que cayó el muro» (`nodepolitics/atlas-demo`, motor explainer-kit:atlas)**: solo el criterio visual de países que se iluminan y alfileres con rótulos. Su motor es d3 2D; no sirve para 3D.
- **No se tocan** esos prototipos. Único cambio en código compartido: un gancho opcional `E.prepare(ctx,t)` en `proto.js` (sin efecto si el motor no lo define).
- **Nuevo:** `nodehistory/_atlas/` (motor 3D), `src/adapters/maps/` + `_tools/atlas/` (datos, caché, geometrías), `nodehistory/atlas-cinematico/` (datos del video demo).

## 3. Tecnología elegida: MapLibre GL JS 6.16 (+ Protomaps PMTiles, NASA GIBS, AWS Terrarium)
Por qué MapLibre y no Cesium: estilos = JSON intercambiable (requisito: «el mapa cambia de estilo»), etiquetas vectoriales nativas hasta nivel calle, globo/terreno/cielo integrados, autohospedable sin clave, y corre en Chromium sin GPU. Cesium: terreno mundial exige token ion (comercial de pago), sin style JSON, más pesado en SwiftShader.
Medido hoy en alfred-server (4 CPU, Chromium + SwiftShader): primera carga 8.9 s; fotograma 1920×1080 con terreno **1–2 s con teselas en caché local, ~15 s si hay que descargar** → la caché local es obligatoria.

| capa | fuente | licencia / nota |
|---|---|---|
| Satélite global z0–8 | NASA GIBS `BlueMarble_NextGeneration` (+ VIIRS TrueColor z9 detalle medio) | datos abiertos, acknowledgment NASA GIBS; caché comercial: pendiente de confirmar por escrito |
| Satélite detalle | USGS Imagery (solo EE. UU., ≤ z16). EOX 2018-25 y Esri **excluidos** (no comercial) | `commercial_ok:false` bloquea el prefetch |
| Relieve | AWS Terrain Tiles (Terrarium, z≤15) | atribuciones USGS/SRTM/Copernicus |
| Nombres y límites (estados, comarcas, ciudades, barrios) | Protomaps basemaps v4 PMTiles (OSM, build diario) extraído por región | ODbL, atribución OSM/Protomaps |
| Resaltado exacto países/estados/condados | Natural Earth admin-0/1 (+admin-2 EE. UU.) PD; geoBoundaries gbOpen ADM2 resto del mundo (CC BY 4.0) | atribución geoBoundaries si se usa |
| Fuentes/sprites | protomaps basemaps-assets copiados local | — |

## 4. Arquitectura (cuatro piezas separadas)
1. **Proveedor y datos** — `src/adapters/maps/` (puertos `TileProviderPort`, `TileCachePort`, `GeoDataPort`; registro `providers.json` con `license`, `commercial_ok`, `attribution`, `max_zoom`; sin credenciales).
2. **Caché de recursos** — `sandbox/nodehistory/_atlas/cache/{proveedor}/{z}/{x}/{y}.ext` + `vector/*.pmtiles` (gitignored, servido estático con Range). Los renders solo leen la caché. `atlas.py warm scene.json` recorre la cámara en Chromium y baja lo que falta (intercepta peticiones a `/_atlas/cache/**`); sin claves en logs.
3. **Motor visual y cámara** — `_atlas/` módulos ES: `camera.js` (función pura de `t`), `style.js` (compone estilo desde **looks**), `looks/*.json`, `layers.js`, `overlays.js`, `atlas.js` (enlaza con `Proto.run`).
4. **Datos por video** — `assets/scene.json` (+ `geo.resolved.json` generado, `overlays.json`).

**Looks (estilos intercambiables):** un solo style con grupos de capas (`sat`, `relieve`, `base-politico`, `fronteras`, `etiquetas`, `cielo`); un *look* es un JSON con las propiedades de pintura de cada grupo + gradación de color. `scene.look` y `scene.looks[{t,look,dur}]` interpolan entre looks de forma determinista (cambio de estilo a mitad del video). Looks iniciales: `satelite-realista` (referencia), `satelite-noticiero`, `oscuro`, `claro`, `politico`, `historico-papel`, `espacio` (horizonte/título).

**Cámara (`camera.js`, mía):** canal por componente — centro en espacio Mercator unwrap, zoom, pitch, rumbo (camino angular corto). Cada vuelo = Hermite cúbico con velocidad inicial igual a la que traía (continuidad C1), velocidad final = deriva configurada; limitador monótono (sin rebote). Zoom con «arco» automático en saltos largos. `follow` opcional sigue la cabeza de un arco. Pura de `t` ⇒ `seek` fuera de orden da la misma pose.

**Anclaje:** todo en `[lon,lat(,alt)]`; los elementos 2D (pines, fichas, paneles, etiquetas) se colocan con `map.project()`/proyección del motor y se ocultan si el punto está tras el horizonte/ocluido; resaltados, rutas y fronteras son capas GeoJSON del propio mapa (se mueven con el terreno). Arcos elevados: lazos proyectados con altitud.

**Determinismo y precarga:** `prepare(t)` = `jumpTo` → esperar `areTilesLoaded()` → `redraw()` → copiar canvas al lienzo 2D de proto. `fadeDuration:0`, `pixelRatio` fijo. Al abrir, barrido de precarga de la cámara cada 0.25 s con barra de progreso; después el reproductor no espera red. `__promo.missingTiles()` debe ser `[]` para renderizar.

## 5. Pruebas
- Unitarias: `camera.test.js` (continuidad C1, sin rebote, seek fuera de orden idéntico), resolver (`US-TX`, `Brazil`, `COD`, `Russia`, condado), proveedores (licencias bloquean).
- Visual: hoja comparativa referencia↔prototipo en t = 0, 3, 5, 8, 12, 17, 20, 21, 22.5, 23.5; zoom a estado → condado → localidad con nombres (San Antonio TX, etc.).
- Movimiento: grabación de 20–24 s y fotogramas consecutivos; saltos adelante/atrás.
- Rendimiento: ms por fotograma (1080p, SwiftShader, 4 CPU, un solo render a la vez) con caché caliente; fps de preview en GPU del usuario no se mide aquí (se declara).
- Consola sin errores, 0 recursos faltantes (`missingTiles`, `missingAnchors`).

## 6. Fases
A adaptador+caché+vectores · B geodatos y resolver · C cámara · D motor+looks · E overlays · F escena demo 24 s · G validación y limpieza. Delegación: Codex Terra/Sol (alto/xhigh) por brief; yo diseño cámara, looks y reviso hojas.

## 7. Resultados (2026-11-03) y diferencias con la referencia
Construido: motor `_atlas/` (camera, style/looks, overlays, update, geo, atribución), adaptador `src/adapters/maps/` + `_tools/atlas/` (proveedores, caché, plan/fetch por cálculo, vectores, geodatos, créditos), escena `assets/scene.json` (24 s) y `assets/scene-zoom.json` (30 s: EE. UU. -> Texas -> condado de Travis -> centro de Austin con nombres). Nada grabado ni renderizado a video; todo en preparación.
Comparación 20–24 s: `work/comparacion-ref-20-24s.jpg` (arriba referencia, abajo prototipo).
Medido (alfred-server, 4 CPU, Chromium + SwiftShader, SIN GPU, con otra tarea ajena usando CPU): 960×540 ≈ 0.36–0.40 s por cuadro; 1920×1080 ≈ 0.07–0.17 s en tramos estables (primer cuadro de cada salto 0.7–1.3 s). **Parada intermitente**: tras un salto atrás se observaron cuadros de 5–22 s a t≈12 s (no reproducible aislado; sin peticiones de red; causa sin identificar). FPS de reproducción en GPU real: NO medido.
Determinismo (`_atlas/test/determinism.py`): corregido el fallo grave (resaltados no repintados tras saltos). Queda ruido de borde en resaltados: <0.4 % de píxeles, normalmente ≤ 40/255 (un caso hasta 128) en instantes 3.4, 12.5, 17, 20.4; **no es bit-exacto**. 
Diferencias pendientes: sin nubes (la referencia las tiene), mar más oscuro/azul marino que la referencia (teal), relieve de la referencia más suave/pintado; el final de la referencia es el limbo de la Tierra desde órbita con sol naciente, el nuestro un globo completo; fichas con textos genéricos; coordenadas de la escena estimadas; arcos elevados sin altura real (`altM` ignorada por la API pública de MapLibre; usan `lift` en pantalla); la referencia sigue la cabeza del arco con la cámara, la nuestra usa keys equivalentes. Licencias: caché comercial de NASA GIBS pendiente de confirmar por escrito; EOX 2018-25 y Esri bloqueados.


### Salida a órbita (2026-11-03)
scene.json dura 30 s: de 21,4 a 24,6 s la cámara sube (span 78 a 112, arc 0, pitch 12) y la proyección pasa de mercator a esfera con una expresión por zoom cuyas etapas se dan en grados de encuadre (etapas {"span":N}, independientes del ancho); de 24,6 a 30 s la Tierra gira bajo el título.
- Tamaño: la esfera termina más grande que la pantalla (~1,3 veces la altura a 16:9, cerca del 70 % visible). Las etapas de la proyección deben quedar por encima del span final (mercator a span <= 99, esfera a >= 104), si no el final volvería a ser plano. A igual zoom la esfera y el mapa plano tienen casi la misma escala (medido: 95 %), por eso el cambio no produce salto de tamaño.
- El relieve se aplana antes del cambio (exaggeration 0), si no el polo se estira como una columna. Queda un tramo híbrido de ~0,2 s al cruzar de plano a esfera.
- Cada ruta de cámara nueva necesita sus teselas en caché: correr atlas.py plan scene.json --fetch (si no, aparece un bloque gris recortado y missingTiles reporta timeout).
- La réplica exacta de 24 s quedó en assets/scene-24s.json.

### Outro v1 y outro v2 como componentes (2026-11-03)
scene.json contiene ambos cierres y el visor del Sandbox deja elegir (seccion Componentes), usando el contrato de _proto/COMPONENTES.md y la API POST /explainer/component-previews con scope sandbox. Componentes declarados en info.json: atlas.outrov1 (grupo outro, por defecto), atlas.outrov2 (grupo outro) y atlas.fichas (interruptor; apaga pole-photo, hex-photo y panel).
- Outro v1: Tierra grande, mas alta que la pantalla (~70 % visible), giro rapido (~90 grados en 5,4 s), titulo sobre el globo. 30 s.
- Outro v2: la Tierra sube desde abajo y se asienta con el 30 % superior libre (canal de camara lift 0,3, globo de ~1 vez la altura), titulo centrado en esa franja, subida de 5 s y giro lento (~46 grados en 6,6 s). 33 s.
- En scene.json: camara y looks llevan when {outro: ...}; duration, out y los campos del titulo usan $by sobre el grupo outro.
- Cada ruta de camara nueva necesita sus teselas: atlas.py plan scene.json --fetch.

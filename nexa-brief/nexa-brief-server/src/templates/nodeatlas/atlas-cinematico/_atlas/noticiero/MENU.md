Catálogo completo y actualizado de piezas: `PIEZAS.md`

# MENÚ · qué piezas existen y cómo se arma cada tipo de noticia (estilo Original)

> Para el plan visual y para `work/build_scene.py`. Todo es JSON dentro de `assets/scene.json`; la biblioteca `tools/escena_lib.py` lo escribe
> (`E.U(tipo, t, out, **campos)`, `E.H(...)`, `E.arco(...)`, `E.capa("choropleth", t, out, values=..., scale=..., domain=...)`, `E.cam(...)`). Referencia completa de campos del HUD: `../HUD.md`. Ejemplo real: `plantilla/ejemplo-demo/build_scene.demo.py`.
> **Tiempos**: segundos o anclas de voz `"@palabra"`, `"@palabra+0.4"`, `"@palabra#2"`, `"@dos palabras"`. `out` por defecto = fin de la voz: ponlo siempre en las piezas de una noticia.

## 1. Piezas de pantalla (`scene.hud[]`) y de mapa

| pieza | para qué | campos que más se usan | notas del demo |
|---|---|---|---|
| `topic` | **cintillo** de la noticia: fecha · tema (arriba a la izquierda) | `text` (≤ 38 car.), `slot` (0,1,2… apila hacia abajo), `dot` (color) | uno por noticia, `out` = inicio de la siguiente; los slots 1–3 listan temas de agenda |
| `lower-title` | título grande de apertura | `lines:[{text,size,weight,gradient}]`, `meta` (fecha), `scalePortrait`, `scaleLandscape` | solo en la apertura y el cierre |
| `portrait` | **retrato octogonal** con nombre y cargo | `src`, `name`, `role`, `at`+`dx`,`dy` **o** `x`,`y`; `size` 50–64, `color`, `focus` | sin `src` = silueta (avisar). En 9:16 se agranda solo |
| `photo-frame` | foto de apoyo con esquinas y pie | `src`, `w` (330–420), `aspect` (1.5), `caption`, `color`, `x`,`y` | lugar clave de la noticia; arriba (y≈.22–.36) |
| `hemicycle` | **hemiciclo de escaños** que se llena | `seats`, `rows`, `radius`, `title`, `steps:[{t,groups:[{n,color}],stats:[{value,label,color}],note}]`, `dot`, `x`,`y` | `seats:435, rows:11, radius:160`; `steps` con anclas a las cifras |
| `counter` | **cifra que sube** con etiqueta | `value`, `prefix`/`suffix`, `decimals`, `label`, `count` (s), `size` 60–76, `color`; `text` fijo (sin animar) | contadores en pareja: `x:.27` y `x:.73`, `y:.64` |
| `chip` | icono o glifo con etiqueta | `icon` (db eye gavel doc shield bolt drop chart lock ban vote people star globe drone warn) o `glyph` («D», «UE»), `label`, `badge` (color del punto), `color`, `size`, `at`/`x,y` | el comodín: «Veto presidencial», «Kiev sin agua» |
| `city` | punto con nombre en el mapa | `at`, `text`, `side` (top/bottom/left/right), `pulse`, `color`, `size` 16–18 | una por lugar que se nombra |
| `note` | etiqueta pequeña sobre el mapa | `text`, `dot`, `at`+`dx`,`dy` o `x`,`y` | datos cortos: «Socio hasta 2025» |
| `glow` | destellos (impactos) en varios lugares | `points:[lugares]`, `color`, `r`, `speed` | ataques, explosiones |
| `brand` | marca de agua | `text`, `x`,`y`, `opacity` | opcional |
| `highlight` (en `layers`) | **ilumina una región** | `region` (ISO2, `US-TX`, o nombre de `scene.regions`), `style`, `t`, `out`, `dur`, `border` | estilos: `blue white red yellow orange green hatch-red hatch-orange`; objeto `{fill,opacity,line,width,glow,...}` para uno propio |
| `arc` (en `layers`) | **trayecto** entre dos lugares | `from`, `to` (lugar, `[lon,lat]`), `color`, `width`, `lift`, `head` (`dot`/`arrow`), `dashed`, `keep`, `tail` | ataques desde un punto; diplomacia con `dashed` |
| cámara (`scene.camera[]`) | **vuelo** entre noticias | `t`, `focus` (lugar o `[lon,lat]`) o `center`, `span` (grados), `pitch`, `dur`, `drift` | ver §3 |

Estilo de tipografía y color: por pieza (`font`, `size`, `weight`, `tracking`, `color`, `upper:false`) o global en `scene.hudTheme`
(`{"fonts":{"ui","title","num"},"colors":{"blue":"#2f8cff","red":"#ff3b5c","yellow":"#ffd21a","green":"#3ddc84","orange":"#ff8a1a","white":"#fff","dim":"#8d96a8"}}`).
Escalas: `scale`, `scalePortrait` (9:16), `scaleLandscape` (16:9). Por defecto en 9:16 el cintillo va más arriba y 1.25× y notas/ciudades 1.2×.
**No existen en Original**: `alert`, `headline`, `key-figure`, `date-card`, `message` (son de Dynamic News); `check.py` las rechaza.
Banderas sobre territorio: capa `flag-fill` (`region`, `src` SVG/PNG, `t`, `out`, `opacity`; ver `../FLAG_FILL.md`); no la usa el demo: pruébala en un cuadro antes de entregar.

## 2. Recetas: tipo de noticia → piezas (copiadas del demo)

| tipo | piezas (en este orden de entrada) |
|---|---|
| **Desastre natural / explosión** | `topic` → `city` del epicentro → `pulse` (ondas repetidas) → `range-ring` (`rings:[50,100,200]` km) → `counter` para magnitud/afectados → `timeline` de alerta, evacuación y asistencia |
| **Sanciones y aranceles** | `topic` → `choropleth` (`values` por ISO2, una sola capa; `scale` y `domain`) → `bar-compare` para los principales socios → `delta` para la variación → `route-icon` si cambia una ruta comercial |
| **Cumbre con acuerdo** | `highlight` anfitrión → `topic` → `city` sede → `timeline` con anclas en apertura, negociación y firma → `quote-card` atribuida → `counter` con la cifra del acuerdo |
| **Comparaciones económicas** | `topic` → `bar-compare` (2–6 barras, horizontal o vertical; `highlight` por etiqueta) → `delta` para explicar la variación |
| **Inflación / precio / evolución** | `topic` → `line-series` (1–3 series; `marker.t:"@palabra"`) → `delta` (`good:"down"` cuando una caída es favorable) |
| **Clasificación de países o sectores** | `topic` → `ranking` (3–5 nombres, bandera `flag` o `icon`) → `counter` con la primera cifra |
| **Reparto de resultados / presupuesto** | `topic` → `stacked-bar` (`parts`, `total`; leyenda para partes pequeñas) → `hemicycle` si son escaños |
| **Resumen de mercados** | `topic` → `ticker` (`items:[{label,value,change,unit}]`, hasta 6; franja fija, sin marquesina) |
| **Identidad de países / instituciones** | `flag-chip` (`code`) o `logo-chip` (`src`) → `topic` → `counter`; biblioteca de pictogramas en `icon-grid` por categoría |
| **Elecciones / votación** (EE. UU.) | `highlight` país en blanco → `topic` «FECHA · ELECCIONES» → `hemicycle` Cámara (`steps` por cifra) + `hemicycle` Senado → `chip` glifos de partido → `highlight` de los estados que cambian (`region_union`) |
| **Lo que podrá hacer / medidas** | `topic` → `photo-frame` del edificio → fila de 3 `chip` con icono (`db`, `eye`, `gavel`) con `y≈.62` |
| **Veto / mayoría cualificada** | `portrait` del presidente → `chip` `doc` con `badge:"red"` → 2 `hemicycle` pequeños + 2 `counter` `text:"2/3"` |
| **Ataque / guerra** | `highlight` país atacado (yellow) y atacante (red) → `highlight` `hatch-red` territorio ocupado → `topic` → `city` capitales → 2 `counter` (drones/misiles) → `glow` en los puntos de impacto → `arc` desde el atacante a cada ciudad (`tail`, `keep:False`) → `chip` icono (`bolt`, `drop`) con `badge:"red"` |
| **Ataque a una instalación** | `topic` «FECHA · LUGAR» → `city` con `pulse` → `arc` con `head:"dot"` desde el origen (`keep:True`) → `chip` icono → `chip` `drone` |
| **Cumbre / visita** | `highlight` país anfitrión → `topic` → `city` → 2 `portrait` junto a la ciudad (`dx`,`dy` opuestos) → `chip` de lo pedido → `counter` con `text` del acuerdo («437 M€») |
| **Negociación** | `highlight` de los países → `topic` + `topic` slots 1–3 (agenda) → `city` sede (`pulse`) → `arc` `dashed` desde cada capital a la sede → `portrait` del negociador |
| **Un bloque pide algo** (UE) | `highlight` del bloque (`region_union`) → `topic` → `chip` `glyph:"UE"` → `note` «Sin representación» |
| **Escándalo / renuncia** | `highlight` país → `topic` → `portrait` presidente → `counter` clientes/dinero (`suffix`) → `chip` `lock`/`chart` → `note` («Socio hasta 2025») → `hemicycle` de la votación → `topic` «RENUNCIA» → `portrait` sucesor |
| **Misión / veto cruzado / titulares** | `highlight` `hatch-orange` zona → `topic` «OTROS TITULARES» → `photo-frame` → 2 `chip` `ban` con país → `note` → segunda `photo-frame` |
| **Ataque puntual y advertencia** | `highlight` país (red) → `topic` → `city` con `pulse` → `note` del estrecho → `arc` `head:"arrow"` → `glow` |

Las seis piezas de datos usan `t` y `steps:[{t:"@palabra",…datos}]`; cada paso hereda el anterior y sustituye arrays completos. `count` controla el conteo/trazo y `stagger` la entrada por orden. `locale:"es-ES"`, `decimals` y `unit` controlan las cifras (`1.234,5`). Los paneles se ajustan completos por encima de y=.8. Demos y contratos exactos: `PIEZAS.md` / `componentes.json`.

## 3. Cámara y colocación

- **Globo entero** (apertura y titulares): `center:[-32,14]`, `span` 125–200, `pitch` 0–15.
- **País**: `focus:[lon,lat]`, `span` 40–62, `pitch` 50–58, `dur` 3. **Ciudad / región**: `span` 14–24, `pitch` 48–58.
- Una pose por noticia, cuando empieza (`"@ancla"`); `dur` 2–3.6 s para el vuelo. Un acercamiento extra para el detalle (Kiev dentro de Ucrania).
- Posición de una pieza: **`at` (lugar) + `dx`,`dy` en px de diseño** si debe seguir al mapa; **`x`,`y` (fracción del cuadro)** si debe quedarse fija.
- Zonas del cuadro: cintillo arriba-izquierda (y≈.10 en 9:16, .155 en 16:9), hemiciclos y fotos arriba (y≈.21–.36), contadores y chips al centro-bajo
  (y≈.52–.64), subtítulos abajo (y≈.9). No coloques nada más abajo de y=.8.
- Retratos: máximo 2–3 a la vez; separa con `dx`,`dy` opuestos. Contadores: en pareja a x=.27 y x=.73.

## 4. Regiones propias, lugares y subtítulos

- `E.lugares({"Kiev": [30.52, 50.45]})` y úsalos por nombre (`at`, `from`, `to`, `focus`, `points`). `check.py` avisa de nombres no declarados.
- `E.region_union("UE27", ["AT","BE",…])` junta países/estados en **una** capa (rápido); ids ISO2 o `US-TX`, `UA-43` del dataset del motor.
  Polígono propio: `E.region(nombre, geometry=GeoJSON)`; rotúlalo «aproximado» (el demo avisa que el Sahara no calza con la costa).
- Subtítulos: Poppins 27 blancos (perfil fijo). Cambia `captions` solo por pedido.
- Cierre: `Escena(cierre=1)` globo girando con título (el del demo) o `cierre=2` cintillo + mensaje. Dura 7 s y va tras la voz: `voz.py --silencio 7.2` crea `song-outro.mp3` con ese silencio extra.

Las piezas geográficas y narrativas nuevas se eligen en `PIEZAS.md`: `range-ring`, `pulse`, `route-icon`, `front-line`, `geo-label`, `choropleth`, `quote-card` y `timeline`. La cronología usa `events:[{t:"@palabra",date,label,icon}]`; sin t de hito, `interval` reparte las entradas desde t de la pieza. En 9:16 ocupa un lateral; en 16:9 una franja. `quote-card` avisa y recorta citas mayores de 160 caracteres. `choropleth.scale` es una lista de colores; para tamaño de leyenda usa `width` y `scalePortrait/scaleLandscape`.

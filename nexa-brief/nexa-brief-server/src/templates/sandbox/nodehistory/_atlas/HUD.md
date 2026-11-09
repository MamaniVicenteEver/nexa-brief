# Atlas · pack HUD de noticiero (`scene.hud[]`)

Capa 2D que se dibuja encima del globo (después de `layers`). Código: `hud.js`. Demo: `sandbox/nodepolitics/resumen-geopolitico-demo`.
Todo es función de `t`; los tiempos aceptan segundos o anclas de voz (`"@palabra"`, `"@palabra+0.4"`, `"@palabra#2"`).

Campos comunes: `type`, `t` (entra), `out` (sale), `dur` (entrada, 0.5), `exit` (0.35), `scale`. `scalePortrait` y `scaleLandscape` multiplican la escala en vertical y horizontal; por defecto son 1.
Posición: `at` (lugar de `places` o `[lon,lat]`) + `dx`,`dy` en px de diseño, **o** `x`,`y` como fracción del cuadro.
Estilo editable por ítem: `font`, `size`, `weight`, `tracking`, `color`, `upper:false`. Globales en `scene.hudTheme`:
`{"fonts":{"ui":"…","title":"…","num":"…"},"colors":{"blue":"#2f8cff","red":"#ff3b5c","yellow":"#ffd21a","green":"#3ddc84","orange":"#ff8a1a","white":"#fff","dim":"#8d96a8","panel":"rgba(8,14,26,.62)"}}`.
Los colores se pueden dar por nombre o en hex.

| type | campos clave |
|---|---|
| `brand` | `text`, `x`,`y`, `size`, `opacity` (marca de agua) |
| `topic` | `text`, `slot` (0,1,2… apila hacia abajo), `dot`, `reveal` (s de decodificado) |
| `lower-title` | `lines:[{text,size,weight,color,gradient:[..],font}]`, `meta` (fecha), `x`,`y`,`gap` |
| `hemicycle` | `seats`,`rows`,`radius`,`inner`,`title`, `steps:[{t,groups:[{n,color}],stats:[{value,label,color}],note}]`, `dimColor`, `dot` |
| `counter` | `value`,`from`,`prefix`,`suffix`,`decimals` o `text` fijo, `label`, `count` (s), `size`, `color` |
| `portrait` | `src`, `name`, `role`, `color`, `size`, `focus`; sin `src` dibuja silueta |
| `photo-frame` | `src`, `w`, `aspect`, `caption`, `color`, `corner`, `focus` |
| `chip` | `icon` (db eye gavel doc shield bolt drop chart lock ban vote people star globe drone warn) o `glyph`, `label`, `badge`, `color`, `size` |
| `city` | `text`, `side` (top/bottom/left/right), `pulse`, `r`, `color` |
| `note` | `text`, `dot` (etiqueta pequeña sobre el mapa) |
| `glow` | `points:[lugares]`, `color`, `r`, `speed` |

Resaltados (`layers[].type:"highlight"`): estilos del look `noticiero-globo` (`blue white red yellow orange green hatch-red hatch-orange`).
Un estilo puede traer `hatch:"#color"` (rayado), `glow`, `glowWidth`, `glowBlur`. `scene.regions` admite `{"geometry": GeoJSON}`; para pintar
varios países/estados con una sola capa (mucho más rápido) usar un MultiPolygon (ver `union_region` en `work/build_scene.py`).
`scene.attribution:false` oculta el pie técnico. Look sin estrellas: `"stars": false`.
Pendiente: entradas en `components.json` y miniaturas del showcase.

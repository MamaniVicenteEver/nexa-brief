# Esquema de estilos tácticos

Los archivos V2, V3 y V4 conservan los datos de `identidad-opus/identidades/`; véase allí `LEEME.md` para el esquema visual completo. Los valores son px del lienzo 1080×1920 o 1920×1080; `espaciado` está en em. Las capas `formatos.<formato>.estilos` se fusionan sobre `estilos`. Los overrides de escena se fusionan antes de resolver el formato; arrays se reemplazan.

- `fijos`: patrones de familia (`flag.*`, `fx.*`, `strike.*`, `air.*`, `naval.*`, `ground.*`). Abarcan sprites, banderas y efectos; los rótulos que acompañan a una unidad siguen siendo estilizable. Una familia fija en el inventario identifica la pieza original, no prohíbe migrar su rótulo.
- `estilos.rotuloUnidad`: nombre, tipo, guía, marcador, bandera y separación; la bandera debe permanecer visible y el texto desplazarse a su lado. `tierra`, `fecha`, `transcripcion` (`posicion`, `ancho` porcentual, `palabras` 1–5, `alto`), `leyenda`, `ficha`, `documento`, `pais`, `frente`, `callout` describen roles editoriales.
- `trazos.flecha`, `ruta`, `frente`, `guia`: `grosor`, `color`, `dash`, `punta`, `largoPunta`, `anchoPunta`, `camisa`; se conservan también las estructuras originales `linea`, dientes y demás de la referencia. Cada consumidor debe declarar la ruta exacta que lee.
- `escalas.ejercito`: dimensiones de ficha, separación y máximo por formato; `escalas.unidad` y `escalas.bandera` por formato.
- `componentes`: por ID del catálogo, `usa` contiene rutas realmente leídas y `overrides` las modificaciones propias. `predeterminadosActuales` recoge los parámetros visuales por defecto del catálogo de cada componente; `literalesArchivo` en clásico es un inventario aproximado por archivo compartido; no atribuye cada literal a cada función. Los arrays `usa` vacíos indican migración pendiente, no ausencia de literales.

`clasico` mantiene la salida anterior porque los componentes aún usan sus propios valores. Sus inventarios no son una extracción semántica completa: el JSON contiene valores compartidos por archivo, no reproduce todavía los cálculos, paletas heredadas ni tamaños calculados de cada componente. No se deben sustituir literales a ciegas con esos inventarios.

La API está en `../ESTILO.md`. Generar `PLANTILLA.json`: `node engine/tactico/tools/estilo-map.mjs --estilo v4-atlas`; auditar: `node engine/tactico/tools/estilo-validate.mjs`. El archivo generado representa una sola identidad a la vez.

## Adaptación de componentes (7 nov 2026)
- **Rótulo de unidad** (`unitLabel` en `components/units.js`): guía en línea + marca cuadrada + bandera opcional + nombre (+ tipo en 16:9). Lo usan naval, aire, tierra, ejército y `label.unit`. Opciones por unidad: `main` (marca de acento y bandera), `labelFlag`, `labelType`, `labelSide` (`izq|der|auto`). Con `clasico` conserva el texto de siempre. La bandera va dentro de la fila: nunca queda bajo el texto.
- **Ejércitos** (`army.*`): `escalas.ejercito.{movil,escritorio}.{escala,columnas}` reduce la ficha en móvil y permite más columnas en escritorio; `escalaEstilo:false` en el ítem lo desactiva. `army.clash` admite `bandos:[{n,flag,actor},…]` para batallas desiguales. El nombre del estandarte va a la derecha de la bandera, sin placa.
- **Textos con estilo**: `label.chip/front/route/neon/figure`, `text.year`, `label.callout`, `badge.count`, `icon.badge`, `intro.title` y `outro.channel` leen colores, familia, halo y marcas del estilo.
- **Piezas nuevas de V4**: `header.date`, `statement.title`, `statement.jump`, `year.big`, `legend.front`, `label.country`, `label.landunit` (`components/estilo-textos.js`). Se colocan en la ranura del estilo o con `screen`/`at`.
- **Vistas previas**: ahora oscuras por defecto (el estilo V4 usa letra clara); `?bg=white` las pasa a blanco.

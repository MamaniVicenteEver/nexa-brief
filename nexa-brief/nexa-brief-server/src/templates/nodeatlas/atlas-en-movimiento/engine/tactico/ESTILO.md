# API de estilo

Ver [esquema y límites](estilos/ESTILO.md) y [orquestación](ORQUESTACION.md).

En `draw(g, state, view, env)`, `env.formato` es `movil` o `escritorio` y `env.estilo` contiene datos fusionados y estos helpers:

- `col(spec)`: color CSS de nombre o `#RRGGBB` con `@alfa` opcional; multiplica el alfa del color almacenado.
- `txt(ruta)`: ruta relativa a `estilos`, por ejemplo `unidad.nombre`. Devuelve `font`, `fuente`, `size`/`tam`, `peso`, `ancho`, `espaciado`, `mayusculas`, `color`, `sombra` y `draw(g,texto,x,y,opts)`. Opciones: `align`, `baseline`, `maxWidth`, `color`, `font`, `halo`, `haloWidth`.
- `num(ruta)`: número por ruta completa, p. ej. `trazos.flecha.linea.grosor`; falla si falta o no es número.
- `slot(nombre)`: objeto de ranura del formato, o `undefined`.
- `fijo(id)`: indica si la familia o ID figura en `fijos`.

También están disponibles en el contexto de `prepare`. Los componentes deben registrar en cada JSON las rutas que efectivamente consultan; regenerar el mapa y las fichas después de migrarlos.

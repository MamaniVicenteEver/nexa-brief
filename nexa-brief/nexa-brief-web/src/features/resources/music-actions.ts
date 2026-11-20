/** Estilo de las acciones de una canción: siempre en una sola fila, sin saltos de línea. */
export const musicActionClass =
  "inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-1 text-[11.5px] font-semibold transition-colors disabled:opacity-60";

/** El texto se ve solo si la fila tiene espacio (consulta de contenedor). Si no, queda como
 * nombre accesible y el botón muestra solo el ícono. */
export const musicActionLabelClass = "sr-only @[19rem]:not-sr-only";

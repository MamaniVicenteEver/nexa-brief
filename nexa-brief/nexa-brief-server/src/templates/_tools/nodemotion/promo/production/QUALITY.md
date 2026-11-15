# Addendum de calidad para promos NodeMotion

Aplica primero el [estándar común](../../../../../skills/CALIDAD.md); este documento añade criterios específicos de promos.

Una promo impacta, demuestra y cierra. Investiga identidad y origen, hitos, presente y personas clave según el tema. Para equipos puede incluir palmarés; para lugares, geografía e historia; para marcas y productos, origen, características y versiones; para eventos, sede y edición. Cada cifra requiere dos fuentes independientes, una primaria, con fecha del dato y consulta.

Organiza capítulos según el ciclo de escenas: identidad y origen, hazañas históricas, presente y cierre. En Editorial hay 17 escenas por ciclo; tres ciclos duran unos 90 segundos. La escena `logo` cierra cada capítulo y la última cierra la marca. Escribe cada campo según su escena: una palabra para palabras gigantes, nombre y dato para placas, y cifras contextualizadas para escenas numéricas.

Alinea los segmentos de 1,4 a 2,4 segundos con los pulsos musicales y cubre el fundido final. Si un hueco de medios se repite en varios ciclos, conserva la misma persona en ese hueco. Una foto convertida en clip debe cubrir la duración del segmento más un segundo, a 25 o 30 fps, con encuadre y atribución revisados. Para cualquier tema, elige música de energía adecuada y considera un clímax en el capítulo final.

La repetición de un slot obliga a comprobar su sentido en **cada** aparición: una imagen húmeda no sirve bajo «en seco», aunque funcione en el primer ciclo. Cambiá el texto, la secuencia o la plantilla si no se pueden asignar medios distintos. Una palabra relacionada con el lugar no salva una frase fragmentada o vacía: revisá también la lectura de cada escena por separado y la continuidad entre ellas, sin rellenar el ciclo con nombres repetidos.

Las plantillas reutilizan cada hueco de medio en cada vuelta del ciclo de escenas. El medio debe ser válido para todas las líneas que lo acompañan: si una línea nombra un partido, año o persona, el medio debe mostrar ese hecho o el texto debe ser genérico del tema. Comprobá en `media-plan.json` qué líneas caen sobre cada hueco y consultá `slot_lines` en el resultado de `check`. Por ejemplo, una foto de Messi ante Arsenal puede acompañar «SIEMPRE BARÇA», pero no presentar como imagen del Clásico de 2026 un «2-0» de ese partido.

Capturá cada escena en ambos formatos y varios momentos de las animaciones con texto, no solo una muestra del ciclo. Revisá el tamaño real de lectura en móvil, máscaras, bandas y recortes, además de ambas miniaturas a 320 px. La hoja de contacto parcial y `ready: true` no acreditan que el conjunto pase. Comprobá que el preview efectivo muestra la secuencia y los textos pedidos, incluso los rótulos decorativos fijos de la plantilla.

Un logo, escudo o marca como gráfico independiente requiere autorización del dueño y autorización expresa del brief (`allow_trademarks: true`); registrá el material propio autorizado en `resources/`. La bandera no concede derechos.

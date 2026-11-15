# Escribir

Escribe primero un relato continuo comprensible y atractivo a partir del brief y hechos comprobados. Después adapta a los segmentos y límites del diseño; en promos sin voz los rótulos deben contar la historia por sí mismos. Relaciona datos y fuentes; evita relleno, afirmaciones incompletas y marcas o eventos no autorizados.

Cada escena debe entenderse por sí misma y el conjunto avanzar: no rellenes ciclos con palabras genéricas o con el nombre repetido. Para escenas de primera línea o palabra gigante usa solo el texto que realmente muestran; cada cifra conserva una referencia de investigación contextualizada.


Cuenta los segmentos antes de entregar: con C escenas por ciclo y duración D, elige un entero k y entrega exactamente N=C×k segmentos, donde 1,4 ≤ D/N ≤ 2,4. Respeta las cantidades permitidas que proporciona el contrato del host. No añadas escenas de relleno para completar tiempo. Cada pantalla debe tener sentido y aportar un dato, imagen o pregunta propia del tema; evita repartir una oración en fragmentos sueltos como «QUE UNO» o «LO DEMOSTRÓ». La revisión técnica no sustituye la comprobación visual de todas las escenas en ambos formatos.

Cada segmento del JSON debe declarar `kind`: `fact`, `creative` o `cta`. Cada `fact` incluye `facts` con al menos un ID de hallazgo aceptado y respaldado; si una afirmación se reparte entre varias escenas, cada fragmento lleva el mismo ID. `creative` y `cta` se reservan a identidad, recursos expresivos y llamadas a la acción que no afirman hechos comprobables. Nunca uses un hecho descartado ni lo presentes como conocimiento general para sortear la falta de fuentes. La validación de estos campos no certifica su significado: la persona revisa hechos y fuentes antes de aprobar.

Si un ejemplo parcial omite `kind` o `facts`, completa esos campos conforme a las reglas anteriores; el esquema admite proyectos antiguos, pero esta versión v4 exige `kind` en todos los segmentos.

Respeta min_text_lines y max_text_lines de cada escena; nunca entregues renglones que el motor ignore. Cuando text_source sea brand alinea los renglones con los campos visibles de marca.

# Control de fuentes y alcance de verificación

Fecha de consulta: 3 de noviembre de 2026. Evidencia por URL: `accesos.json`.

Se revisaron **99 enlaces externos distintos** de los cuatro documentos de entrega. Se hizo GET de páginas/documentos públicos leyendo como máximo los primeros 4096 bytes para comprobar respuesta y tipo. Para leer hechos se usó además la herramienta web y extracción en memoria de documentos PDF. No se guardaron PDF de archivo, imágenes, audios ni videos como assets de la plantilla.

| resultado | enlaces | qué significa |
|---|---:|---|
| HTTP 200 mediante consulta directa | 78 | El endpoint respondió; esto comprueba acceso, no por sí solo el contenido de cada afirmación. |
| Lectura de contenido con la herramienta web pese a bloqueo del cliente directo | 14 | Se pudo leer el contenido; el cliente directo recibió principalmente 403. Incluye Iranica, USNI, RAF y Royal Navy. |
| Referencias complementarias sin apertura directa completa | 7 | Se conservan como contraste o procedencia, expresamente identificadas abajo. No son la única fuente abierta de ninguna fila de hechos. |

**Las 61 filas numeradas de HECHOS.md tienen al menos una fuente que se abrió mediante uno de los dos métodos.** El control distingue ese requisito de la apertura de absolutamente todos los enlaces complementarios: no se informa falsamente «99 de 99 abiertos».

## Referencias complementarias con acceso pendiente

| referencia | resultado | tratamiento en la entrega |
|---|---|---|
| Washington Post, refinería de Abadán, 27 sep 1980 | Timeout en la consulta directa; texto localizado en buscador. | El daño de 1980 también está respaldado por el estudio de país de LoC, disponible en Country Studies. |
| UPI, reabanderamiento, 21 jul 1987 | 403 al abrir; texto localizado en buscador. | Se cruza con CSIS IX, consultable, y se separa de la salida del convoy. |
| NHHC, H-Gram 018 PDF | Error de certificado del cliente; un intento de lectura pública sin validación de certificado terminó en 404. Las páginas HTML relacionadas tampoco se pudieron abrir directamente. | Atribución de Tu-22 y discrepancia 18/19 mar 1988 **no cerradas**. No es base para fijar avión, pérdidas ni día exacto del ataque a Kharg. |
| UPI, asunción de Rajai, 2 ago 1981 | 403 al abrir; texto localizado en buscador. | Se cruza con la presidencia descrita en el estudio de país de LoC, consultable. |
| Senado estadounidense, investidura de Reagan | 403 del cliente directo. | El cambio presidencial y mandatos también tienen respaldo abierto de LoC y NARA. |
| Helion, ficha editorial de *Iraqi Mirages* | 403 directo; ficha bibliográfica localizada por la herramienta web. | Confirma referencia bibliográfica, **no** se presenta como lectura de la página 54 ni como prueba suficiente del paquete de Kharg. Para el Falcon 50 se encontró además historia oral primaria de IDA, abierta en GovInfo. |
| LoC, fotografía de Rajai `gtfy.03182` | 403 directo. | Commons ofrece la ficha y la etiqueta de licencia; se leyó también el texto de `PD-Gotfryd`. No se afirma haber inspeccionado el original visualmente. |

La URL antigua de la cronología de 1982 del RAF Museum devolvió **404 tanto en la herramienta web como en la consulta directa**. Se retiró de las filas documentales y se sustituyó por fuentes de Royal Navy, National Army Museum y Fuerza Aérea Argentina. Solo queda mencionada como antecedente de búsqueda en las notas de discrepancias.

## Qué se leyó, además del chequeo HTTP

- CSIS, capítulos IV, V, VII, IX y X: pasajes de invasión, contraofensivas, campaña del petróleo, convoy y cierre de 1988. Se anotan capítulo y páginas pertinentes en la tabla.
- USNI: entrevista del capitán del Bridgeton y relatos de participantes de Mantis Religiosa. Sirven para unidades y secuencia, sin adoptar automáticamente su interpretación política.
- IDA D-4121, *Saddam’s Generals*: entrevista con Alwan al-Abousi, páginas impresas 205–206, PDF 215–216; nota editorial 188 en el PDF 209. Atribuye el ataque al Stark a un Falcon 50 y se contrasta con la identificación contemporánea estadounidense.
- ONU: resolución 598, anuncio S/20096 y antecedentes/mandato de UNIIMOG, incluyendo notificación del 17 jul 1988 y retirada posterior.
- USSOCOM, *Tip of the Spear*, septiembre de 2005, p. 38: MH-6 y AH-6 desde Jarrett. Carta presidencial contemporánea para fecha, atacantes y abordaje.
- RAF, Royal Navy, London Gazette, National Army Museum y archivo argentino para la variante. El museo y los archivos pueden describir los hechos desde perspectivas nacionales; no se reproducen sus fórmulas celebratorias.
- Commons: metadatos y etiquetas de licencia de los candidatos, y cadena del original de Mousavi. SFXMint: búsquedas estructuradas y ficha JSON individual de los 14 sonidos.

## Validaciones documentales

- **41 filas G + 8 D + 12 M = 61**; mínimos del brief: al menos 25 del demo y 8 de Malvinas.
- Cada fila tiene fecha/periodo, hecho, coordenadas o ancla regional expresamente aproximada y al menos una URL abierta.
- **23 medios candidatos**: 10 retratos y 13 documentos/fotografías; las licencias seleccionadas están dentro de PD / CC BY / CC BY-SA. No se seleccionó NC, ND, fair use, GFDL ni OGL.
- **14 IDs SFXMint** comprobados contra su ficha individual, con duración positiva, slug coincidente y `license=CC0`. Cubren las 13 necesidades, con una alternativa adicional de agua; tres necesidades tienen sustitutos condicionados y están señaladas.
- Se corrigió una generalización de formato durante el control: `ship-cannon-whistle-splash-01` es mono; los demás candidatos revisados son estéreo. El documento ya dice uno o dos canales según asset.
- Duraciones sumadas: **270 s / 4:30** y **56 s**.
- No se hizo escucha, revisión visual de originales, mezcla, TTS, render ni pruebas del motor. No se modificó `index.html`: el checklist de plantilla y los tests de código no corresponden a esta entrega documental.

## Reservas de contenido que permanecen

La comprobación de acceso no resuelve la identificación técnica contrapuesta del avión del Stark; tampoco cierra el paquete de la primera incursión de Kharg de agosto de 1985 ni el Tu-22 y día exacto de marzo de 1988. Los frentes no están digitalizados, y los puntos `≈` no son mediciones de combate. Estos límites se trasladan a «No se dice» y a la escaleta; no se ocultaron detrás de una marca de verificación.

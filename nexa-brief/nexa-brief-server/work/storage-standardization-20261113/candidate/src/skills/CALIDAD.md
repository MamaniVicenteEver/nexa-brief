# Estándar de calidad de Nexa Brief

Vale para **todo contenido** que produzca un agente: videos explicativos (NodeTech, NodeHistory, NodeEconomy, NodePolitics, NodeAtlas…), promos y videos de NodeMotion, publicaciones de imagen, textos de publicación y miniaturas. Cada skill añade su apartado específico, pero nunca rebaja lo que dice este documento. Si una instrucción local contradice este estándar, manda este estándar; si contradice un pedido explícito del humano, manda el humano.

El listón: **un espectador que no conoce el canal debe quedarse, entender algo nuevo y creer lo que ve.** Un resultado que funciona técnicamente pero es genérico, está desactualizado o no se parece al tema **no está terminado**.

## 1. Investigación

1. **La fecha de hoy primero.** Antes de buscar, anota la fecha actual. Busca expresamente lo ocurrido en los últimos 12 meses sobre el tema: títulos, cifras, récords, lanzamientos, cambios de ley, resultados. Un dato superado es un error grave (caso real: se publicó «28 Ligas» cuando ya eran 29).
2. **Cobertura por categorías, no por un único dato.** Según el tema: origen e identidad; cifras actualizadas; hitos únicos («primero en», «único en», récords); presente y última temporada o versión; personas clave con un dato verificable cada una; contexto que el público no conoce; lo que se discute o se teme.
3. **Dos fuentes independientes por cifra, una de ellas primaria u oficial** (organismo, club, liga, empresa, estadística pública, documento original). Por cada cifra: URL, fecha del dato y fecha de consulta.
4. **Si las fuentes discrepan, no uses la cifra.** Busca una que coincida o una formulación que no dependa de ella. Regístralo en `discarded` con el motivo.
   Dos fuentes divulgativas coincidentes no cierran la revisión si otra fuente científica pertinente presenta una cronología distinta o si no está claro que las denominaciones refieran a la misma fase. Registra la diferencia y evita una relación causal simplificada hasta resolverla.
5. **Formulación exacta.** «Primer club europeo con dos tripletes», no «único del mundo» si hay excepciones. Nunca «el mejor» como hecho: se demuestra con datos. Nada de citas inventadas de personas reales.
6. **Ranking de ganchos.** Cada hallazgo lleva `strength` (1-5: cuánto sorprende o emociona al público objetivo) y `recency`. El guion se construye con los de fuerza 4-5; los de 1-2 solo si son necesarios para entender.
7. **La investigación se guarda y se reutiliza**: `research.json` (estructurado) + `research.md` (legible), en la carpeta del contenido. Otro contenido del mismo tema parte de ahí y solo actualiza lo nuevo.

## 2. Guion y texto

1. **Gancho en los primeros 3 segundos** (en video) o en la primera línea (en texto): quién o qué es y por qué importa ahora.
2. **Estructura con avance**: cada bloque añade algo nuevo (dato, giro, consecuencia). En videos largos, un re-gancho cada 2-3 minutos. En promos, capítulos que suben de intensidad y un cierre de marca.
3. **Prohibido el relleno.** Cada línea contiene al menos uno de: nombre propio, cifra, lugar, fecha, hecho concreto o una palabra con identidad del tema. Frases que valdrían para cualquier tema («UNA IDEA», «CADA JUGADA», «EN MOVIMIENTO», «la historia continúa») se reescriben.
   Esa condición es necesaria, no suficiente: una palabra suelta repetida o un fragmento como «QUE AYUDA A» puede cumplirla solo por contexto y aun así no aportar nada o no entenderse en su escena. Comprueba sentido y avance de cada línea en pantalla y del bloque completo.
4. **Cifras con contexto**: el número va junto a lo que cuenta y, si es reciente, con su fecha («29 Ligas, la última en mayo de 2026»).
5. **Escrito para el formato**: consulta el contrato de la plantilla o del diseño (qué muestra cada escena o componente, cuántas líneas caben) y escribe para eso. No fuerces texto largo en una escena de palabra gigante.
6. **Ritmo del formato**: respeta el ritmo de la plantilla original (por ejemplo, promos de 1,4 a 2,4 s por escena; explicativos al ritmo de la voz). Alinea los cambios a la música o a la voz.
7. **Personas**: si una imagen lleva el nombre de una persona, la imagen es de esa persona. Si no hay imagen libre de esa persona, no se pone su nombre sobre otra cara.
8. **Idioma**: español natural, sin calcos del inglés, sin emojis, con la ortografía y los acentos correctos (incluidos nombres propios).

## 3. Medios (imágenes, video, iconos)

**Prioridad de búsqueda**
1. **Material real del tema con licencia libre**: Wikimedia Commons (CC BY, CC BY-SA, CC0, dominio público), archivos públicos y organismos oficiales con licencia de reutilización. Es lo que hace creíble el contenido: las personas, lugares, objetos y momentos reales.
2. **Stock de ambiente** (Pexels, Pixabay, Unsplash) solo para planos de apoyo cuando no exista material real o como transición.
3. **Gráficos propios** (componentes del diseño) para cifras, comparaciones, mapas y procesos.

**Reglas**
- **Relevancia antes que cantidad**: cada medio corresponde a lo que se dice en ese momento. Un estadio cualquiera no sustituye al estadio del que se habla si existe una foto libre del real.
- **Una foto puede ocupar un hueco de video** convertida en clip con movimiento lento (zoom y desplazamiento suaves). Es una obra derivada permitida por esas licencias; la atribución lo indica.
- **Compartir igual**: cuando corresponda una licencia CC BY-SA, acreditar no basta: identificá la licencia compatible aplicable a la adaptación audiovisual y cómo se comunicará al distribuirla. Si no está resuelto, no declares lista la publicación.
- **Revisión a tamaño completo** de cada candidato: sin marcas de agua ni texto superpuesto ajeno, nítido, bien expuesto, sujeto correcto, sin situaciones privadas ni contenido sensible.
- **Marcas y derechos**: los logotipos o escudos que aparecen de forma natural en una foto real con licencia libre (camisetas, fachadas, productos) son aceptables. Un logotipo o escudo usado como gráfico propio solo si el pedido lo autoriza expresamente. Nunca imágenes de retransmisiones de TV, capturas de prensa ni contenido de pago. Una marca ajena al tema (publicidad de terceros) visible en primer plano: se descarta.
- **Registro único y reutilizable**: todo medio se guarda una vez en `resources/<tipo>/<id>/` del perfil con su ficha (`resource.json`: categoría, tipo, nombre, etiquetas, fuente, URL, autor, licencia, atribución, hash, dimensiones o duración, consulta usada, `used_by`) y se reutiliza por ID. Antes de descargar, busca en el registro.

## 4. Voz y música

- **Voz**: la del diseño o la categoría, con la pronunciación correcta de nombres propios (revisa la transcripción). Sin cortes ni silencios largos.
- **Música**: licencia comercial guardada (CC BY con atribución, CC0, licencia del proveedor que lo permita). Energía acorde al tono. Recorte en final de frase musical con fundido de 2-3 s. Bajo la voz, sin taparla.

## 5. Diseño visual y miniaturas

- **Texto legible en pantalla** en 16:9 y 9:16: sin cortes, solapes ni texto ilegible sobre fondos claros u ocupados.
- **Miniaturas A/B**: se entienden a 320 px de ancho, título de 1 a 5 palabras y máximo dos filas, una imagen real y potente del tema, el estilo del propio video. La B con las mismas palabras que la A o menos. Nada de «LETRAS» ni etiquetas ajenas al contenido.
- **El estilo del diseño o plantilla manda**: colores, tipografías y composición se respetan; no se rediseña una plantilla para un contenido.

## 6. Textos de publicación

- Títulos, descripciones y comentarios con las estrategias activas de la categoría; en español.
- Nada inventado: ni finales, ni partidos, ni declaraciones, ni cifras que no estén en `research.json`.
- Descripción con capítulos (si es largo), fuentes y **créditos completos** de cada recurso con licencia (autor, licencia, URL, «recortado/animado» si aplica) y de la música.

## 7. Puerta de calidad (obligatoria antes de decir «listo»)

Mira las hojas de contacto de ambos formatos y las miniaturas, y responde por escrito en el informe:
1. ¿Hay alguna línea genérica o de relleno?
2. ¿Alguna cifra no está en `research.json` con dos fuentes, o está desactualizada respecto a hoy?
3. ¿Algún medio no corresponde a lo que se dice, es stock cuando existía material real libre, o muestra una marca ajena?
4. ¿Algún texto se corta, se solapa o es ilegible?
5. ¿Las miniaturas se entienden en pequeño y muestran el tema real?
6. ¿Faltan créditos o licencias de algún recurso?
Si alguna respuesta es sí, se corrige antes de entregar. Si algo no se puede corregir, se dice al principio del informe y el contenido no se declara listo.

## 8. Fallos ya vistos (no repetir)

| Fallo | Qué se hace en su lugar |
|---|---|
| Dato superado («28 Ligas» con la 29 ya ganada) | Búsqueda explícita de los últimos 12 meses y fecha en cada cifra |
| Guion genérico que vale para cualquier tema | Regla de relleno del §2.3 |
| Solo stock (ciudad, césped) para un tema con material real abundante | Prioridad de medios del §3 |
| Logotipo de un patrocinador ajeno en primer plano | Revisión a tamaño completo y descarte |
| Placa «PASIÓN VS OLVIDO» o texto sin sentido para rellenar un campo | Cada campo de la plantilla se rellena con un significado real o se deja vacío según su contrato |
| Años o líneas encimados, recuadros vacíos | Puerta de calidad §7.4 sobre capturas reales |
| Entregar «base», «pendiente» o «a implementar» | Ver `ORQUESTACION.md §4`: una tarea termina con su entregable o con un bloqueo externo demostrado |
| Informe de consumo inexistente o ilegible | `PLANTILLA-INFORME.md`, siempre |

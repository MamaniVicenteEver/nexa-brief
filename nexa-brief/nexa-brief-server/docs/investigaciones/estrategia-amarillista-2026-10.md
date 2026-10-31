# Estrategia AMARILLISTA: alarma → verdad → debate (estudio, 2026-10-29)

Estado: **borrador para aprobar**. Los textos de muestra (§5) están para revisar el tono antes de grabar
nada. La parte técnica (§6) ya la está construyendo Codex con el contenido de este documento como
borrador; los textos se ajustan después en el JSON, sin tocar código.

## 1. Diagnóstico: por qué ningún video despegó

Todos los videos salen del mismo molde (`explainer-kit/guides/storytelling.md`): **un momento icónico
del pasado contado como documental**. Gancho con fecha y lugar, contexto, subidas y bajadas, clímax al
60–72 %, cierre con moraleja. Es buen documental, pero tiene tres problemas para un canal que empieza:

| problema | efecto |
|---|---|
| el tema es del pasado («la alarma 1202», «Ariane 5») | el espectador no siente que le afecta **a él, hoy** |
| el gancho informa («El 4 de junio de 1996…») en vez de asustar | nadie tiene un motivo urgente para quedarse los primeros 30 s |
| el clímax llega al 60 % | los que se van en el minuto 1 nunca lo ven |
| el cierre es una moraleja + outro | no pide nada: no hay comentarios, y el algoritmo no ve conversación |

La estrategia nueva cambia los tres a la vez: **tema actual que te afecta + miedo desde el segundo 0 +
pregunta directa al final**.

## 2. La idea en una frase

> Empezar con la versión **más extrema y aterradora** de un tema actual, sostener el miedo el primer
> minuto, después bajar la intensidad y contar la verdad completa (con datos de «antes era peor»), y
> terminar preguntándole al espectador qué opina, con su pregunta en pantalla.

Es lo que hacen los noticieros sensacionalistas («¿Tu celular te está espiando? A las 9»), pero con el
giro final que ellos no hacen: **la verdad está en el mismo video**.

## 3. Un ajuste importante: alarma extrema, sí; dato inventado, no

Pediste «empezar con una mentira muy radical». Propongo que el inicio sea **la verdad en su versión más
alarmante**, no un dato inventado. No es por cuidar las formas: es porque la mentira inventada funciona
peor para estos canales.

1. **La mayoría se va antes del giro.** En YouTube y TikTok la mayor parte del público no llega a la
   mitad del video. Si el minuto 1 es falso, la mayoría se lleva el dato falso y el giro lo ve una
   minoría. Los que sí llegan se sienten engañados y lo dicen en los comentarios («clickbait»,
   «mentiroso»), justo en el canal que queremos llenar de comentarios.
2. **Las plataformas lo penalizan.** YouTube trata título/miniatura que no cumple el video como
   metadatos engañosos (baja alcance, puede quitar monetización); Facebook/Instagram bajan el alcance
   cuando una nota o verificación marca el contenido como falso. Un canal nuevo no aguanta un strike.
3. **En política es un riesgo legal.** Atribuirle a un político real algo que no dijo es difamación,
   aunque se desmienta al minuto 3.
4. **No hace falta.** Los datos reales de estos temas ya son aterradores (ver §5): «el empleo de los
   programadores jóvenes cayó casi un 20 %», «Japón casi no se rinde por un golpe de estado»,
   «un audio falso dos días antes de una elección». El truco está en **cómo** se presentan.
5. **El sistema ya lo controla.** `publishing check` rechaza toda cifra del título, la miniatura o la
   intro que no esté en el guion o la transcripción. Una cifra inventada en el gancho no pasa.

### Las 5 formas permitidas de exagerar (todas dan miedo, ninguna es falsa)

| técnica | ejemplo |
|---|---|
| **el peor escenario de una fuente real** | «Podría desaparecer la mitad de los empleos de oficina para principiantes» (lo dijo el director de Anthropic, 2025) |
| **atribuir** («dicen», «según», «un estudio afirma») | «Un estudio de Stanford dice que el empleo de los programadores jóvenes cayó casi un 20 %» |
| **juntar hechos reales sin explicar la relación** (se explica en el giro) | «Apareció un audio falso. Dos días después, su partido perdió.» |
| **la pregunta que da miedo** | «¿Para qué te van a necesitar a ti?» |
| **quitar el contexto que tranquiliza** (se devuelve en el giro) | dar la cifra de los jóvenes y callar, hasta el giro, que los programadores con experiencia no perdieron empleo |

Prohibido: cifras inventadas, frases que una persona real no dijo, consejos de salud o de voto falsos,
y cualquier cosa del gancho que el giro no resuelva explícitamente.

## 4. La estructura (`narrative_amarillista_v1`)

**Sin segundos ni porcentajes fijos.** Si se le dan tiempos exactos, la IA escribe para cumplir el número
y no para que el video funcione. La estrategia describe el **orden** de los actos, su **peso relativo**
(«el primer tramo», «la mayor parte del video») y su **intensidad**; la IA decide cuánto dura cada uno
según la duración del video y el tema. Ejemplo: en un video de 8 min la IA puede decidir que el miedo
dure el primer minuto y medio; en uno de 30 min, varios minutos con más de una ronda.

```
intensidad
alta   |●●●●●●●●●
       |         ●●●●●
media  |              ●●
       |                ●●●●●●●  ●●●●●●●●●
baja   |                       ●●         ●●●
       +-----------------------------------------------→ orden
        GOLPE MIEDO  ESTUDIO GIRO  VERDAD      QUÉ HACER PREGUNTA OUTRO
```

| acto | peso en el video | intensidad | función | reglas |
|---|---|---|---|---|
| **Título errático** | — | — | alarma e incomodidad, ver §4.2 (niveles) | se entiende sin saber del tema |
| **1. Golpe** | la apertura, muy breve | máxima | una frase que da miedo, con número y con «tú» | 1–2 oraciones; la cifra más fuerte va aquí; nada de fechas ni contexto |
| **2. Miedo** | **el primer tramo del video** (en los cortos, alrededor del primer minuto; en los largos, los primeros minutos) | máxima, sin bajar | apilar datos reales que empeoran | «Primero… después… y lo peor…»; ningún alivio; cierra con un bucle abierto: «Pero hay un detalle que casi nadie leyó» |
| **3. El estudio** | corto | alta | la prueba más fuerte, con detalle, y un caso humano | nombra la fuente; es el punto de máximo miedo «con pruebas» |
| **4. El giro** | corto | media | «Ahora, la parte que los titulares no cuentan» | devuelve el contexto que se calló en el gancho; nunca dice «te mentí» |
| **5. La verdad** | **la mayor parte del video** | baja–media (alguna subida chica) | datos completos + **antes / ahora** | obligatorio: un ejemplo histórico con cifra («hace 200 años moría el 43 % de los niños; hoy menos del 4 %»); en videos largos, varias rondas «miedo → verdad» |
| **6. Qué hacer** | corto | baja | qué cambia para el espectador, concreto | 2–3 acciones o señales; sin sermón |
| **7. La pregunta** | breve, justo antes del outro | media | pregunta directa, en voz cercana, **con la pregunta en pantalla** | ver §4.1 |
| **8. Outro** | — | — | el outro con voz de siempre (`explainer-kit/outro/`) | sin cambios |

Lo único que el sistema valida es el **orden** y la **forma**: que el video arranque con intensidad
máxima, que el miedo venga antes del giro, que exista la verdad con un antes/ahora y que la pregunta
esté antes del outro. Las duraciones no se validan.

### 4.1 La pregunta final (que no suene a IA)

Lo que más delata a la IA es la fórmula de cierre de YouTuber («¡No olvides dejar tu comentario, darle
like y suscribirte!»). La pregunta tiene que sonar a alguien que de verdad quiere saber.

| sí | no |
|---|---|
| «Ahora te pregunto a ti, en serio:» | «¡Déjanos tu opinión en los comentarios!» |
| una sola pregunta, con **dos lados** para elegir («¿te quita trabajo o te lo ahorra?») | preguntas abiertas vagas («¿qué opinas de este fascinante tema?») |
| algo personal («Yo tengo mi opinión, pero quiero leer la tuya») | «En conclusión», «fascinante», «sumergirnos», «en este video exploramos» |
| «Los voy a leer» / «Cuéntame qué te pasó a ti» | pedir like y suscripción aquí (eso ya lo hace el outro) |

- **En pantalla:** tarjeta grande con la pregunta corta (máx. 8 palabras, p. ej. «¿Te quita trabajo o
  te lo ahorra?») durante todo el acto 7. Sin emojis (regla del sistema).
- **Voz:** el mismo narrador, más lento y más bajo, como hablando a una persona. Pausa de ~1 s antes de
  la pregunta.
- **Comentario fijado:** la primera de sus 2 preguntas es **la misma** pregunta del video, para que las
  respuestas se junten en un solo hilo.

### 4.2 Títulos: cuatro niveles de intensidad

El selector ofrece **básico, medio, alto y negro**. Negro queda como valor por defecto: sube la
intensidad con una palabra visceral y una brecha de curiosidad, manteniendo cada detalle verificable.

| nivel | cómo suena | ejemplo (tech) |
|---|---|---|
| **básico** | alarma con explicación | «La IA ya está dejando sin trabajo a los programadores» |
| **medio** | amenaza directa con «tú» | «La IA te va a reemplazar (y ya empezó)» |
| **alto** | sentencia corta, con miedo e incomodidad | «Te vas a quedar sin empleo» · «Miles de despidos. Tú eres el siguiente» |
| **negro** | palabra clave visceral, pregunta tramposa y curiosidad abierta | «Amazon DESPIDIÓ a unos 250. ¿Eres el siguiente?» |

Reglas del nivel negro:
- MAYÚSCULAS solo en la palabra o fórmula clave («Los están DESPIDIENDO», «LO HICIERON: …»).
- Usar léxico visceral («fin», «despedidos», «borrados», «trampa») sin condicionales.
- Abrir una brecha ocultando quién o qué («¿Quién lo hizo?», «LO HICIERON: …») y formular el miedo
  como pregunta directa («¿Eres tú el siguiente?»).
- Generalizar desde un caso real con cuidado: el caso inspira la pregunta, pero no demuestra que el
  mismo resultado aplique a todo el mundo ni prueba una relación causal.
- Empresas, cifras, fechas y citas deben ser reales, mantener su atribución y coincidir con la fuente
  y el guion, sin ampliar su alcance. No inventar datos ni sugerir causalidad sin pruebas.
- Máximo 60 caracteres, incluidos espacios.

Ejemplos negros (tres por categoría, basados en los casos descritos en §5 y el guion NodeTech):

| categoría | títulos |
|---|---|
| **NodeTech** | «Amazon DESPIDIÓ a unos 250. ¿Eres el siguiente?» · «¿Qué AMENAZA el primer empleo de programador?» · «Programador: ¿ya empezó el FIN?» |
| **NodeHistory** | «La grabación OCULTA que buscaron en palacio» · «¿Quién intentó FRENAR la rendición de Japón?» · «Japón: buscaron el disco para FRENAR la rendición» |
| **NodePolitics** | «Un audio FALSO apareció antes de votar en Eslovaquia» · «¿Un audio FALSO puede cambiar tu voto?» · «¿Quién puso esa voz FALSA a llamar antes de votar?» |

## 5. Textos de muestra (para aprobar el tono)

Los títulos de abajo están en nivel **básico**. En §4.2 se agregan los ejemplos de nivel **negro**, que es
el nuevo valor por defecto; la tabla siguiente conserva las referencias de medio y alto:

| | medio | alto |
|---|---|---|
| tech | La IA te va a reemplazar (y ya empezó) | Te vas a quedar sin empleo · Miles de despidos. Tú eres el siguiente · Amazon despidió a 14 000. La IA fue la excusa ⚠ |
| historia | Japón iba a pelear hasta el último hombre | Medio millón de medallas para tus muertos · Japón casi no se rinde. Nadie te lo contó |
| política | Tu voto ya no decide la elección | Tu próximo presidente lo elige una voz falsa · Te van a hacer votar con una mentira |

Datos marcados con ⚠ = confirmar la fuente exacta en la investigación del video antes de grabar.

### 5.1 NodeTech: la IA y los programadores

**Títulos (3, emociones distintas):**
1. La IA ya está dejando sin trabajo a los programadores
2. ¿Para qué te van a necesitar si la IA programa?
3. El 20 % que nadie te contó sobre la IA y tu empleo

**Miniatura:** «YA EMPEZÓ» (solo texto) · con imagen: «SIN TRABAJO» + foto de una oficina vacía.

**Golpe + miedo (0–60 s, texto final):**

> Si eres programador, presta atención, porque esto ya empezó.
>
> La mitad de los empleos de oficina para principiantes podría desaparecer en menos de cinco años. No lo
> dice un desconocido en internet. Lo dijo en 2025 el director de Anthropic, una de las empresas que
> fabrica estas inteligencias artificiales.
>
> En Google, más de una cuarta parte del código nuevo ya lo escribe una máquina. En Microsoft, hasta un
> treinta por ciento.
>
> Y mientras tú estudias, actualizas tu currículum o mandas solicitudes que nadie responde, un estudio de
> la Universidad de Stanford encontró algo peor: desde finales de 2022, el empleo de los programadores de
> entre veintidós y veinticinco años cayó casi un veinte por ciento.
>
> Veinte por ciento. En menos de tres años.
>
> Las empresas no lo anuncian. Simplemente dejan de contratar.
>
> Y la pregunta que nadie quiere hacerse en voz alta es esta: si la IA ya escribe el código… ¿para qué te
> necesitan a ti?
>
> Pero en ese mismo estudio hay un detalle que casi nadie leyó. Y lo cambia todo.

**Giro y verdad (puntos clave):**
- El giro: en el mismo estudio, el empleo de los programadores **con experiencia** no cayó; se mantuvo o
  creció. La IA no está borrando la profesión: está borrando **el primer escalón**.
- Antes / ahora: en 1954 el informe de FORTRAN prometía «eliminar prácticamente la programación» ⚠. Hoy
  hay decenas de millones de programadores en el mundo ⚠.
- Antes / ahora 2: los cajeros automáticos iban a acabar con los cajeros de banco; en EE. UU. pasaron de
  unos 300 000 en 1980 a unos 600 000 en 2010 (James Bessen) ⚠.
- Un estudio de METR (2025): programadores con experiencia fueron un 19 % **más lentos** con IA, aunque
  creían ir más rápido. La IA todavía necesita a alguien que sepa revisar.
- Qué hacer: aprender a revisar y dirigir código ajeno, entender el negocio, proyectos propios.

**La pregunta (acto 7):**

> Ahora te pregunto a ti, en serio. ¿Sientes que la IA te está quitando trabajo… o te lo está ahorrando?
> Cuéntame qué te ha pasado a ti. Los voy a leer.

En pantalla: **«¿Te quita trabajo o te lo ahorra?»**

### 5.2 NodeHistory: la rendición de Japón

**Títulos:**
1. La noche en que Japón casi no se rinde
2. Medio millón de medallas para muertos que nunca llegaron
3. La caída de Japón que no te contaron en la escuela

**Miniatura:** «CASI NO SE RINDE» · con imagen: «GOLPE EN PALACIO» + foto del Palacio Imperial, 1945.

**Golpe + miedo (0–60 s):**

> La Segunda Guerra Mundial estuvo a un disco de no terminar.
>
> Agosto de 1945. Dos bombas atómicas ya habían caído sobre Japón. Y aun así, el consejo de guerra
> japonés seguía empatado: tres querían rendirse, tres querían seguir peleando.
>
> El emperador grabó en secreto un mensaje de rendición. Pero esa misma noche, un grupo de oficiales del
> ejército mató a un general, tomó el Palacio Imperial y buscó cuarto por cuarto la grabación. Si la
> encontraban, la rendición nunca salía al aire.
>
> Del otro lado del océano, Estados Unidos preparaba la invasión. Al terminar la guerra quedaron casi
> medio millón de medallas sin entregar, destinadas a militares heridos o muertos por acción enemiga.
>
> Casi medio millón.
>
> Esta es la rendición de Japón que no te contaron en la escuela. Y lo que pasó con esas medallas te va a
> sorprender.

**Giro y verdad:**
- El giro: el golpe tenía muy pocas posibilidades: el ministro de Guerra no lo apoyó y el general a
  cargo de Tokio lo aplastó antes del amanecer ⚠. La grabación salió al mediodía del 15 de agosto.
- La discusión real (sin cerrar entre historiadores): ¿se rindió Japón por las bombas o por la entrada
  de la Unión Soviética en la guerra el 8–9 de agosto?
- Antes / ahora (puente al presente): las medallas que sobraron se siguieron entregando a soldados
  heridos durante décadas. El [National WWII Museum](https://www.nationalww2museum.org/war/articles/history-of-the-purple-heart)
  documenta un excedente de casi 500.000 al final de la guerra; no atribuye toda esa cantidad a la invasión de Japón.

**La pregunta:**

> Y aquí te dejo la pregunta que todavía divide a los historiadores. ¿Tú crees que Japón se habría
> rendido sin las bombas atómicas? Yo tengo mi respuesta, pero quiero leer la tuya.

En pantalla: **«¿Se habría rendido sin las bombas?»**

### 5.3 NodePolitics: elecciones y audios falsos

**Títulos:**
1. La próxima elección se puede ganar con un audio falso
2. Dos días antes de votar apareció este audio. Era falso.
3. ¿Le creerías a este audio de tu candidato?

**Miniatura:** «NUNCA LO DIJO» · con imagen: «AUDIO FALSO» + onda de sonido sobre una urna.

**Golpe + miedo (0–60 s):**

> Dos días antes de una elección, apareció un audio.
>
> En él, el líder de la oposición hablaba de cómo arreglar los resultados. Se compartió miles de veces.
> Y nadie podía desmentirlo en la tele, porque la ley prohibía hablar de campaña en esas horas.
>
> Esa conversación nunca existió. Era una voz fabricada con inteligencia artificial.
>
> Pasó en Eslovaquia, en 2023. Su partido perdió.
>
> Meses después, en Estados Unidos, miles de votantes recibieron una llamada con la voz del presidente
> pidiéndoles que no fueran a votar. Tampoco era él.
>
> Hoy, con unos segundos de tu voz, cualquiera con un celular puede hacerte decir lo que quiera.
>
> La próxima elección de tu país podría decidirse por una frase que nadie dijo.
>
> O eso es lo que te quieren hacer creer. Porque lo que encontraron los que estudiaron estos casos es
> todavía más raro.

**Giro y verdad:**
- El giro: nadie pudo demostrar que ese audio cambiara el resultado; las encuestas ya estaban muy
  parejas ⚠. La llamada falsa en EE. UU. terminó con una multa millonaria al responsable ⚠.
- Estudios de 2024 sobre las elecciones de ese año (Instituto Alan Turing ⚠) no encontraron pruebas de
  que la desinformación con IA cambiara resultados.
- Lo más raro, el verdadero peligro: el **«dividendo del mentiroso»**. Cuando todo puede ser falso, un
  político al que graban diciendo algo real puede decir «es IA». El riesgo no es solo creer lo falso:
  es dejar de creer lo verdadero.
- Qué hacer: desconfiar del audio que llega justo antes de votar, buscar si lo publicó algún medio,
  fijarse en quién lo comparte primero.

**La pregunta:**

> Ahora te pregunto a ti. Si mañana sale un audio de tu candidato diciendo algo terrible… ¿le creerías?
> ¿O pensarías que es falso? Dímelo en los comentarios, que me interesa de verdad.

En pantalla: **«¿Le creerías a ese audio?»**

Regla extra de NodePolitics: nunca se le atribuye a un político real algo que no dijo, ni en el gancho;
las víctimas de un audio falso pueden nombrarse como víctimas.

### 5.4 Tu ejemplo de la contaminación, en esta estructura

- **Golpe:** «Tienes plástico en el cerebro. Y tus hijos van a tener más.»
- **Miedo:** la contaminación causa unos 9 millones de muertes prematuras al año (Comisión Lancet) ⚠;
  un estudio de 2025 encontró microplásticos en cerebros humanos, más que años atrás ⚠.
- **Giro:** ese estudio no prueba que el plástico cause daño; la medición todavía se discute.
- **Verdad (antes / ahora):** hace 200 años, cerca del 43 % de los niños moría antes de los 5 años; hoy
  es menos del 4 % (Our World in Data). El aire de Londres en 1952 mató a miles en una semana; hoy es
  mucho más limpio ⚠.
- **Pregunta:** «¿Tú crees que tus hijos van a vivir mejor o peor que tú?»

## 6. Cómo entra en el sistema (lo que construye Codex)

La estrategia es **datos, no código**, como las demás de `src/skills/explainer/`:

```
src/skills/explainer/strategies/narrative/
  narrative_documental_v1.json   el arco actual de storytelling.md (los videos ya hechos no cambian)
  narrative_amarillista_v1.json  los actos de §4, técnicas de §3, la pregunta §4.1, niveles de título §4.2
active.json → "_default": { "narrative": "narrative_amarillista_v1", … }   ← POR DEFECTO, decisión del usuario
```

La amarillista es la estrategia **por defecto** en todas las categorías, para la IA y para la web. La
documental queda como opción en la lista.

1. **Tablas JSON:** cada narrativa = actos (`id`, nombre, % o segundos, intensidad, función, reglas,
   ejemplos), reglas del gancho, reglas de la pregunta y qué otras piezas fuerza (p. ej. el título
   `title_alarmista_v1` y la primera pregunta del comentario fijado = la pregunta del video). Validadas
   por el mismo cargador de estrategias (`check` rechaza campos desconocidos).
2. **Modal de creación:** al crear un video, una lista de tarjetas «Estrategia narrativa» (nombre, una
   línea, mini línea de tiempo de los actos). Por defecto la de la categoría.
3. **Brief y producción:** el `narrative_id` elegido viaja al brief (el prompt del estratega recibe las
   reglas del gancho y del título) y a la producción (el agente escribe el guion con los actos de la
   narrativa en vez del arco de `storytelling.md`; `kit check` valida golpe ≥ 0.9 de intensidad y que
   exista el acto «pregunta»). Queda en `publish.json → strategies_used.narrative`.
4. **Grabación:** el acto «pregunta» se dibuja con una tarjeta de pregunta en pantalla antes del outro,
   y la voz de ese tramo va con indicación «cercana, más lenta».
5. **Web:** la narrativa usada se ve en el detalle del video.

Brief de Codex: `~/codex/nexa-brief/BRIEF-narrativa-amarillista.md` (resultado en
`RESULT-narrativa-amarillista.md`).

## 7. Cómo saber si funciona

Publicar 3 videos con la estrategia (uno por categoría, los de §5) y comparar contra los anteriores:

| métrica | por qué |
|---|---|
| retención a los 30 s y al minuto 1 | mide el golpe y el miedo |
| % que llega al giro | mide el bucle abierto |
| comentarios por cada 1000 vistas | mide la pregunta |
| tono de los comentarios («clickbait» vs. respuestas a la pregunta) | mide si nos pasamos de exagerados |

## 8. Decisiones

Tomadas (2026-10-29):
- Sin segundos ni porcentajes: la IA decide cuánto dura cada acto según la duración del video (§4).
- La amarillista es la estrategia **por defecto** para la IA y para la web; la documental queda como opción.
- Títulos en cuatro niveles (básico / medio / alto / negro), por defecto **negro** (§4.2).

Pendientes:
1. ¿El tono de los 3 textos de §5 está bien? ¿«Tú» o «vos»?
2. ¿La pregunta final va antes del outro (como está) o reemplaza parte del outro?
3. ¿Qué 3 temas grabamos primero? (propuesta: los de §5).

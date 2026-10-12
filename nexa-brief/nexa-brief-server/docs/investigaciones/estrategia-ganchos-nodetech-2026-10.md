# Estrategia de ganchos para NodeTech / explainers (2026-10-11)

Estudio, sin cambios en el código. Objetivo: que el título de portada, la miniatura y los
primeros 3 segundos hagan que alguien que **no conoce la historia** quiera verla.

---

## 1. Diagnóstico: por qué los 4 ganchos actuales no enganchan

| Video | Título gigante (portada) | Qué entiende alguien que no sabe nada | Problema |
|---|---|---|---|
| apolo-1202 | **1202** | "un número" | Código interno. Solo intriga a quien ya conoce la historia. Lo que está en juego (abortar el alunizaje) está en letra chica. |
| codex-ariane-501 | **NO CABÍA** | "¿qué no cabía?" | Fragmento sin sujeto ni consecuencia. Lo dramático (el cohete **explotó** a los ~37 s) no aparece; "desvió" lo suaviza. |
| nacimiento-ia-dartmouth | **EL VERANO QUE INVENTÓ LA IA** | "dato histórico" | Afirmación cerrada, no hay tensión ni pregunta. Además, el efecto ASCII casi no se lee en miniatura. |
| vago-pero-emocionante | **VAGO, PERO EMOCIONANTE** | "¿quién es vago?" | Una cita que solo se entiende si ya sabes quién la dijo y sobre qué. |

**El patrón común:** las 4 portadas son **etiquetas crípticas**: un código, un fragmento o una cita. Se
entienden *después* de ver el video, pero no *antes*. Un gancho tiene que funcionar antes.

### De dónde sale ese patrón (causas en el sistema)

1. `briefs.py`: `working_title` pide "máx 5 palabras, en mayúsculas" y nada más. No pide tensión ni
   que se entienda lo que está en juego, así que el modelo tiende a dar el nombre corto más elegante.
2. `prompts/director.md` y `guides/storyboard.md`: el beat 0 es "título gigante + antetítulo
   (protagonista · fecha)". La fecha y el lugar quedan como lo único que da contexto, y eso informa pero no engancha.
3. `guides/storytelling.md`: recomienda "un número" en el gancho. Bien usado es potente, pero sin
   su consecuencia termina en "1202".
4. Los 4 videos siguen **la misma fórmula** (palabra o código + subtítulo explicativo chico), así que la
   grilla del canal se ve monótona.
5. **Los primeros segundos:** la voz arranca con 1,2 s de silencio mientras se arma el título
   (`guides/voice.md`). En Shorts/TikTok ese segundo y medio en silencio con texto quieto es justo cuando
   la gente desliza.
6. Hay tres textos distintos que no se coordinan: el título en pantalla ("1202"), `thumbnail_text`
   ("la alarma que casi aborta todo") y el título de YouTube ("El error que llevó a la humanidad a la Luna").
   El **mejor** de los tres (el de la miniatura) es el que menos se ve.

---

## 2. La estrategia propuesta

### 2.1 Regla de oro: la "prueba del desconocido"

Antes de aceptar un gancho, responder en una línea cada pregunta. Si alguna queda vacía, se rechaza:

1. **¿Qué está en juego?** (vidas, dinero, el futuro, algo que usas hoy)
2. **¿Qué es raro o contradictorio?** (algo que no debería haber pasado)
3. **¿Se entiende sin saber la historia?** (nada de códigos, siglas ni citas sin contexto)
4. **¿Es verdad?** (promete solo lo que el video muestra)

### 2.2 Los números y las citas siempre llevan su consecuencia

- ❌ `1202` → ✅ `ERROR 1202 · A 10 KM DE LA LUNA` o `LA COMPUTADORA SE RINDIÓ`
- ❌ `NO CABÍA` → ✅ `UN NÚMERO HIZO EXPLOTAR ESTE COHETE`
- ❌ `VAGO, PERO EMOCIONANTE` → ✅ `SU JEFE LA LLAMÓ "VAGA"` (y abajo: *así nació la Web*)

El código o la cita puede ir de antetítulo o de detalle visual, pero no como titular principal.

### 2.3 Fórmulas para rotar (nunca repetir la misma dos veces seguidas en el canal)

| Fórmula | Molde | Ejemplo |
|---|---|---|
| **Contradicción** | "X falló… y por eso pasó Y" | *La computadora falló. Por eso llegamos a la Luna.* |
| **Consecuencia desproporcionada** | "Algo diminuto → desastre enorme" | *Un solo número destruyó un cohete de 370 millones* |
| **Cuenta regresiva** | "N segundos / N minutos para…" | *Tenían 30 segundos para abortar el alunizaje* |
| **Predicción fallida** | "Creían que… / pasaron N años" | *Creyeron resolver la IA en un verano. Van 70 años.* |
| **El rechazo** | "Casi nadie creyó en…" | *Su jefe la llamó "vaga". Hoy la usas cada día.* |
| **Tú estás dentro** | conectar con algo que el espectador usa | *Estás leyendo esto gracias a una propuesta "vaga"* |
| **Pregunta con respuesta inesperada** | "¿Por qué…?" | *¿Por qué un cohete de 10 años de trabajo explotó a los 37 segundos?* |

> Nota: `storytelling.md` ya avisa que no se repitan fórmulas ("37 segundos"). La tabla le da al agente
> de dónde elegir.

### 2.4 Tres piezas, una sola historia

| Pieza | Trabajo | Largo |
|---|---|---|
| **Título en pantalla / portada** (beat 0) | La **tensión**, en grande y legible en 9:16 | 3–6 palabras |
| **Texto de miniatura** | El **detalle emocional** que el título no dice | 2–4 palabras |
| **Título de YouTube** | El **contexto buscable** + la curiosidad | ≤ 60–70 caracteres, lo clave en los primeros 40 |

No repetir lo mismo en las tres: se complementan. Hoy, por ejemplo, lo mejor que hay ("la alarma que
casi aborta todo") está escondido en `thumbnail_text`.

### 2.5 Los primeros 3 segundos (Shorts/TikTok)

- **La voz arranca en el segundo 0**, sin el 1,2 s de silencio. La primera frase es el gancho, no la fecha.
  - Hoy: *"Veinte de julio de mil novecientos sesenta y nueve. A diez kilómetros…"*
  - Propuesta: *"A diez kilómetros de la Luna, la computadora del Apolo 11 se rindió."*
    (la fecha pasa a la segunda frase o al antetítulo).
- **Movimiento desde el cuadro 1:** la alarma parpadeando, el cohete, un contador corriendo. Un título
  tipográfico quieto se lee como "intro" y se desliza.
- **Legibilidad en miniatura:** nada de efectos que rompan la letra (el ASCII de Dartmouth). Una palabra
  clave en el color de acento (el verde lima ya funciona).

### 2.6 Proceso: generar muchos y elegir con criterio

1. El brief pide **8 candidatos** de título de portada, cada uno con una fórmula distinta de la §2.3.
2. Un segundo paso (el mismo modelo o un "juez") los puntúa de 1 a 5 en **claridad sin contexto,
   tensión, especificidad, honestidad y legibilidad** (≤ 6 palabras). Se queda con el mejor y dos alternativas.
3. La web muestra los 3 finalistas para que **tú elijas** antes de grabar (hoy no hay ese paso).
4. Después de publicar, usar **Probar y comparar** de YouTube Studio con 2–3 miniaturas/títulos y medir el
   CTR de impresiones. En Shorts/TikTok, comparar el porcentaje de "vio vs. deslizó" y la retención a 3 s.
5. Guardar qué fórmula ganó en cada video (por ejemplo en `manifest.json`) para que el planificador
   aprenda qué funciona en cada canal.

---

## 3. Reescritura de los 4 videos actuales (para comparar)

Los datos se basan en los guiones existentes. Hay que **verificarlos con el guion final** antes de usarlos.

### apolo-1202
- **Portada:** `LA COMPUTADORA SE RINDIÓ` · antetítulo `APOLO 11 · A 10 KM DE LA LUNA`
- **Miniatura:** `ERROR 1202`
- **YouTube:** *A 10 km de la Luna, la computadora del Apolo 11 se rindió*
- **Alternativas:** *El error que casi aborta el alunizaje (y terminó salvándolo)* ·
  *La computadora falló. Por eso llegamos a la Luna.*
- **Primera frase:** "A diez kilómetros de la Luna, la computadora del Apolo once se rindió. Houston tenía segundos para decidir: abortar… o confiar."

### codex-ariane-501
- **Portada:** `UN NÚMERO HIZO EXPLOTAR ESTE COHETE`
- **Miniatura:** `37 SEGUNDOS`
- **YouTube:** *El cohete que explotó porque un número no cabía*
- **Alternativas:** *37 segundos: el bug que destruyó un cohete europeo* ·
  *Diez años de trabajo, destruidos por una línea de código*
- **Primera frase:** "Treinta y siete segundos después del despegue, el cohete más caro de Europa se autodestruyó. El culpable: un número."
- *Verificar la cifra del costo antes de ponerla en un título.*

### nacimiento-ia-dartmouth
- **Portada:** `CREYERON RESOLVER LA IA EN UN VERANO`
- **Miniatura:** `1956 → HOY`
- **YouTube:** *Creían resolver la IA en un verano. Pasaron 70 años.*
- **Alternativas:** *La reunión de 10 personas que inventó la inteligencia artificial* ·
  *El plan de 2 meses que se convirtió en la IA que usas hoy*
- **Primera frase:** "En el verano de mil novecientos cincuenta y seis, diez científicos creyeron que en dos meses iban a enseñarle a pensar a una máquina."
- *Cambiar el efecto ASCII de la portada por texto sólido.*
- *Una alternativa actual de `publish.json` dice "8 personas" y la propuesta histórica habla de un estudio de "10 hombres": unificar con el guion.*

### vago-pero-emocionante
- **Portada:** `SU JEFE LA LLAMÓ "VAGA"` · abajo `ASÍ NACIÓ LA WEB`
- **Miniatura:** `"VAGO, PERO…"` (sobre la hoja de la propuesta)
- **YouTube:** *Su jefe la llamó "vaga"… y se convirtió en la Web*
- **Alternativas:** *La propuesta que casi nadie leyó y hoy usas todos los días* ·
  *Estás aquí gracias a tres palabras escritas en una hoja*
- **Primera frase:** "En marzo de mil novecientos ochenta y nueve, un jefe escribió tres palabras en una propuesta. Hoy la usas cada día."
- *Cuidar "Web" vs "internet": el video es sobre la Web.*

---

## 4. Dónde se aplicaría (cuando decidas implementarlo)

| Archivo | Cambio |
|---|---|
| `src/core/explainer/briefs.py` (`SYSTEM_PROMPT`) | Reglas §2.1–2.3; pedir 8 candidatos de `working_title` con fórmula + puntaje; prohibir códigos/citas sueltas. |
| `src/templates/_tools/explainer-kit/prompts/director.md` + `guides/storyboard.md` | Beat 0: título = tensión, antetítulo = protagonista/contexto; movimiento desde el cuadro 1. |
| `src/templates/_tools/explainer-kit/guides/storytelling.md` | Primera frase = gancho (la fecha va después); "número + consecuencia". |
| `src/templates/_tools/explainer-kit/guides/voice.md` | Quitar el 1,2 s de silencio inicial (o bajarlo a ~0,2 s). |
| `src/templates/_tools/explainer-kit/guides/qa.md` | Checklist: "prueba del desconocido" y legibilidad en miniatura. |
| Web (modal de crear/estudio) | Mostrar 3 candidatos de portada para elegir antes de grabar. |

Orden sugerido: (1) prompts y guías, que es barato y tiene el mayor impacto; (2) volver a generar
**solo la portada y la primera frase** de los 4 videos actuales para comparar; (3) la selección en la web y
la medición del CTR.

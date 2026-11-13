Antes: [CALIDAD.md](../../../../../skills/CALIDAD.md) (manda) y, si orquestas, [ORQUESTACION.md](../../../../../skills/ORQUESTACION.md).
Al delegar: [PLANTILLA-BRIEF.md](../../../../../skills/PLANTILLA-BRIEF.md). Al entregar: [PLANTILLA-INFORME.md](../../../../../skills/PLANTILLA-INFORME.md) como `INFORME.md`.

## Específico de esta skill

# GUION · cómo habla el noticiero (estilo FIJO para todos los videos de la plantilla)

> Lo lee quien escribe el guion (Codex Terra 6.1 alto; respaldo Haiku 5.5; o el líder) y quien lo revisa.
> El estilo sale del demo `resumen-geopolitico-demo`: está medido, no inventado. Ejemplo completo en
> `plantilla/ejemplo-demo/script.demo.json`. La voz que lo dice es siempre la de `voz.json` (Charon, tono aceleración, ≈180 palabras/min).
> No usa la estrategia narrativa amarillista ni la guía cercana de Atlas Cinemático: este es un **noticiero**.

## 1. Anatomía de un segmento (lo que hace el demo)

| rasgo | regla | ejemplo del demo |
|---|---|---|
| **registro** | locutor de noticiero internacional, español latinoamericano neutro, **tercera persona**, sin «tú», sin preguntas, sin opinión ni adjetivos de valor | «Rusia lanzó en una sola noche 289 drones y 76 misiles, con más de 20 impactos en instalaciones energéticas» |
| **fórmula** | 1.ª frase = el hecho; 2.ª = la cifra o el efecto; 3.ª (si hay) = lo que viene o el contexto | «Los demócratas han ganado las dos cámaras… En la Cámara superan los 250 de 435 escaños, y en el Senado han arrebatado 7…» |
| **tiempos verbales** | pretérito perfecto/indefinido para lo ocurrido («ha presentado», «lanzó»), futuro para lo anunciado («reunirá», «controlarán») | «Y la próxima semana, Estados Unidos reunirá a rusos y ucranianos en Abu Dabi» |
| **fechas** | relativas al día de emisión: «esta semana», «el miércoles», «a principios de semana», «la próxima semana». Las fechas exactas van en pantalla (cintillo), no en la voz | «El miércoles, Zelenski acudió por sorpresa a la cumbre iberoamericana de Madrid» |
| **cifras** | en **dígitos** (`250`, `289`, `437 millones de euros`, `800 millones de dólares`): son las anclas de los contadores y hemiciclos. Siglas conocidas tal cual; el TTS las lee bien | «78 de los 80 diputados… aprobaron abrirle un juicio político» |
| **nombres** | completo la primera vez («Santiago Peña», «Pedro Sánchez»), apellido después («Peña», «Zelenski») | «el presidente Santiago Peña… Peña fue socio del grupo…» |
| **conectores** | «Además», «En cuanto a», «Por su parte», «Y la próxima semana», «Y en <lugar>», «Y para finalizar, aquí van otros titulares» | «Y en Ormuz, Estados Unidos atacó un sistema de misiles iraní» |
| **longitud** | segmento = una noticia o una parte de ella: 8–70 palabras (media 34), 1–3 oraciones de 8–25 palabras | s01 tiene 8; s13 (la más larga) 68 |
| **ritmo** | frase corta al final como golpe («Moscú ya ha confirmado su delegación.»), no se encadenan subordinadas largas | «…Moscú ya ha confirmado su delegación. En la agenda están las garantías de seguridad…» |
| **cierre** | termina con la **última noticia**, con su consecuencia; sin despedida, sin pregunta, sin «suscríbete» (el cierre visual es el outro) | «Teherán advierte de que cualquier error de Washington abriría un nuevo frente.» |
| **metadatos** | `tone: "aceleración"` e `intensity: 0.5` en todos los segmentos; `voice: "Charon"` | — |

## 2. Estructura de un resumen (semanal)

1. **Apertura fija** (segmento solo): «Este es el resumen geopolítico de la semana.» (diario: «…del día.»; otro tema: cambia el adjetivo, no la forma).
2. **Noticia 1 = la más importante** (hasta 3 segmentos). Las siguientes, de mayor a menor, agrupando por región o hilo (la guerra en dos o tres
   segmentos seguidos; la negociación después; luego Europa; luego un país concreto).
3. **Una noticia «de país» con arco** (escándalo, renuncia, elecciones): hecho → mecanismo → consecuencia, en 2–3 segmentos.
4. **«Y para finalizar, aquí van otros titulares.»** y 2–3 noticias breves, un segmento cada una (la última cierra el video).
Longitud objetivo: 400–520 palabras ≈ 2:15–2:50 a ≈180 ppm. Duración real = la del audio; no se rellena con silencio.

## 3. Cómo se piensa para imagen (el guion es la mitad del video)

- **Una idea de imagen por frase.** Si no puedes decir qué se ve mientras se dice («una columna de 289 drones sobre Ucrania», «el hemiciclo se llena
  de azul»), reescribe la frase.
- **Las palabras que se anclan son sustantivos o cifras únicas** (`@democratas`, `@250`, `@435`, `@kiev`, `@abu`, `@ormuz`). Evita repetir la misma
  palabra clave dentro de un segmento (si pasa, el ancla usa `#2`).
- **Cada persona nombrada con cargo** aparece con retrato: avisa al plan (`GUION` → `plan`) para que haya foto.
- **Cada lugar** es un punto del mapa o una región iluminada: nombra el lugar que se verá.
- Las cifras con unidad y alcance en la misma frase: «unos 3 millones de clientes», «unos 800 millones de dólares de dinero público».

## 4. Formato de `assets/script.json`

```json
{ "title": "Resumen geopolítico de la semana (10 nov 2026)", "language": "es", "voice": "Charon",
  "segments": [
    { "id": "s01", "tone": "aceleración", "intensity": 0.5, "text": "Este es el resumen geopolítico de la semana.",
      "claim_ids": [], "plan": ["apertura: globo entero, 3 retratos, título inferior"] },
    { "id": "s02", "tone": "aceleración", "intensity": 0.5, "text": "…",
      "claim_ids": ["N1-a", "N1-b"],
      "plan": ["EE. UU. en blanco, cintillo «3 NOV · ELECCIONES», hemiciclo Cámara 252/155, hemiciclo Senado, chips D y R"] } ] }
```
- `id`, `tone`, `intensity`, `text` son lo único que lee la voz (narrate.py). `claim_ids` y `plan` los ignora la voz y `check.py`: sirven al
  líder para revisar que cada frase tiene respaldo y pieza (los `claim_ids` salen del ledger `research.json`).
- Sin marcadores (`TODO`, `REEMPLAZAR`): `check.py` los rechaza. Sin emojis.

## 5. Antes de generar la voz (el líder, una sola vez)

1. Léelo en voz alta: ¿suena a locutor o a informe? Cámbialo si suena a ficha.
2. Cada cifra, fecha y nombre está en el ledger con ≥ 2 fuentes; los datos que varían entre fuentes se dicen con «unos», «más de» o se omiten.
3. Cuenta palabras: 400–520 (`python3 -c` sobre `script.json`) y segmentos ≤ 70 palabras.
4. Nombres difíciles: el TTS lee bien los frecuentes; para uno raro, ponlo como se lee y verifica tras la voz (`song.qc.json → faltan/sobran`).
5. `python3 $N/tools/check.py $EP --tarde` con 0 errores (solo valida el guion). La voz gasta cuota: **una vez**, con el guion aprobado.

## 6. Qué evitar (aprendido)

- Tono de tráiler, dramatización o adjetivos («escalofriante», «histórico») sin cita; superlativos que el ledger no respalda.
- Causalidades que la fuente no afirma («por eso», «lo que provocó») y especulación sobre intenciones; atribuye siempre («según el Pentágono»).
- Cifras provisionales dichas como definitivas («superan los 250» y no «ganaron 252» si el recuento sigue). Lo disputado lleva «según»/«más de».
- Repetir la misma conexión («Además») en segmentos seguidos; empezar dos segmentos iguales.
- Despedidas, preguntas al público, «suscríbete», y cualquier mención al video o al canal en la voz.
- Muertes y guerras: datos y fuentes, sin morbo ni imágenes explícitas; respeto en el lenguaje.

## 7. Plantilla del encargo al agente que escribe el guion

Está en `briefs/BRIEF-noticiero-investigacion-guion.md` (investigación + guion + plan visual + lista de medios en una sola tarea Terra 6.1 alto).

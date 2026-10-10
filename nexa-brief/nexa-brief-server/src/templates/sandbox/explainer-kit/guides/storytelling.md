# Guía · storytelling y guion

Cómo convertir un tema en un guion de 3–4,5 min que se escuche como un documental profesional.
Resultado de este paso: `PLAN.md` (secciones 1–6) y `assets/script.json`.

## 1. Elegir el punto crítico (lo más importante)

Un video NO cuenta "la historia de X". Cuenta **un momento icónico** de X y lo usa como columna:

| mal (enciclopedia) | bien (punto crítico) |
|---|---|
| La historia del Muro de Berlín | La conferencia de prensa en la que un funcionario se equivocó y el Muro cayó esa noche |
| Quién fue Alan Turing | Cómo rompió un código "imposible" y por qué su país le dio la espalda |
| La historia del Apolo 11 | La alarma 1202 a 10 km de la Luna |

Buscá: **una decisión, un error, un instante o un número** con antes y después.

## 2. La tesis

Una frase que el espectador se lleva. Todo segmento la empuja; lo que no la empuja se corta.
Ej.: "Innovar no es construir algo que nunca falle; es construir algo que sepa qué hacer cuando falla."

## 3. El arco (subidas y bajadas)

La curva de `intensity` (0–1) de los segmentos ES el montaje: el storyboard y la voz la siguen.

```
intensidad
1.0 |                                  ●  clímax
0.8 | ●                  ●            / \                        ●  cierre
0.6 |  \        ●       / \          /   \                      /
0.4 |   ●------/ \-----●   \--------/     \           ●--------
0.2 |                                       \---------/  caída
    +---------------------------------------------------------------→ tiempo
     gancho contexto subida1 bajada subida2  CLÍMAX  caída resolución cierre
```

| acto | % del video | función | trucos |
|---|---|---|---|
| **Gancho** (s01) | 0–8 % | fecha/lugar + algo imposible o una pregunta; presenta al protagonista | frases cortas; un número; el título gigante ya está en pantalla |
| **Contexto** | 8–20 % | qué estaba en juego, cómo funcionaba | una idea por oración; comparar con algo cotidiano |
| **Subida 1** | 20–35 % | el problema se hace enorme (la cifra imposible, la amenaza) | cifras concretas; "y aunque…" |
| **Bajada 1** | 35–45 % | obstáculo, duda, el tiempo se acaba | frases más lentas; tensión |
| **Subida 2** | 45–60 % | la idea, el giro, el protagonista actúa | "Su secreto era simple…" |
| **Clímax** | 60–72 % | el momento que el gancho prometió | frases MUY cortas, ritmo, una letra grande |
| **Caída** | 72–85 % | el precio, la consecuencia humana | baja la intensidad (0.2–0.4); silencio |
| **Resolución** | 85–93 % | qué quedó, reparación, legado | puente al presente |
| **Cierre** (último) | 93–100 % | vuelve al título/tesis; última frase memorable | callback del gancho; "Y cada vez que…" |

Reglas: **mínimo 2 bajadas reales** (sin bajadas no hay clímax). El clímax nunca en el primer
tercio. La caída emocional hace que el cierre pegue.

## 4. Escribir para la voz (TTS)

- **Oraciones de 6–18 palabras.** Una idea por oración. Sin paréntesis ni incisos largos.
- **Números en PALABRAS** ("mil novecientos ochenta y nueve", "ciento cincuenta y nueve
  trillones"): la voz los lee mejor. Whisper después los transcribe en cifras (está bien).
- **Nombres extranjeros** escritos como se leen si son difíciles; nada de siglas sin explicar.
- **Frases sueltas de impacto**: "Millones de vidas." "Seguimos." (la voz las remata).
- **Segunda persona** en el puente al presente: "…incluida la que tienes en la mano".
- **Español latino neutro**: "computadora", "celular/teléfono", "tienes" (no "tenéis").
- **Contale a una persona, no redactes un informe**: frases concretas y visuales ("el agua entraba
  por seis compartimentos") en vez de abstractas ("la seguridad cumplía una regla de papel").
- **Un protagonista humano** con nombre (quien decide, quien se equivoca, quien arregla). Los datos
  técnicos se traducen a una imagen cotidiana (la "caja enorme en un casillero pequeño"); la jerga
  ("coma flotante de 64 bits", "toberas") va como mucho una vez y explicada.
- **Unidades métricas** (metros, kilómetros, kilos) y dinero en dólares con equivalencia entendible.
- **El dato que vende**: si existe una cifra que impacta (el costo, la cantidad de víctimas, la
  velocidad), va en el gancho o en el clímax.
- **No repitas fórmulas**: si otro video del canal ya abrió con "37 segundos", buscá otro gancho.
- **Prohibido**: inventar citas textuales; datos sin fuente en PLAN.md §3; muletillas
  ("cabe destacar", "sin duda"); spoilers del clímax en el gancho (insinuar, no contar).
- **Longitud**: 420–560 palabras → 3:15–4:30 con la voz a ~120–130 ppm.

## 5. `assets/script.json`

```json
{
  "id": "muro-de-berlin", "design": "binary", "title": "LA NOCHE QUE CAYÓ EL MURO", "kicker": "BERLÍN · 9 NOV 1989",
  "language": "es-419",
  "voice_direction": "Documental íntimo; intriga al inicio, euforia contenida en el clímax, cierre reflexivo.",
  "segments": [
    { "id": "s01", "tone": "intriga", "intensity": 0.7, "text": "Nueve de noviembre de mil novecientos ochenta y nueve. …" }
  ]
}
```

- 14–20 segmentos de 15–45 palabras. Cada segmento = un tono.
- `tone` (uno de estos; cada uno tiene su dirección vocal en `tools/narrate.py`):
  `intriga, suspenso, explicativo, asombro, tensión, tensión creciente, descubrimiento,
  complicidad, aceleración, clímax, peso, silencio, curiosidad, revelación, dolor contenido,
  duelo, reparación, cierre, urgencia, alivio, reflexivo, cercano, admiración`.
  Los tonos lentos (intriga, peso, duelo…) agregan pausas entre oraciones solos.
- `intensity` 0–1 sigue la curva de §3 (se usa para la voz y para el ritmo visual).
- `title` y `kicker` = los del título gigante.

## 6. Checklist del guion

- [ ] El primer segmento tiene fecha/lugar y algo que obliga a seguir mirando.
- [ ] Hay una pregunta abierta que se responde en el clímax.
- [ ] La curva tiene ≥ 2 bajadas y el máximo (1.0) está en el 60–72 % del video.
- [ ] Cada cifra del guion está en PLAN.md §3 con fuente.
- [ ] 4–6 frases candidatas a letra grande (cortas, contundentes).
- [ ] El último segmento vuelve al título o a la primera imagen.
- [ ] 420–560 palabras, números en palabras.
- [ ] Hay un protagonista con nombre y la jerga está traducida a imágenes cotidianas.
- [ ] Leído en voz alta suena a alguien contando una historia, no a un informe.
- [ ] Cada afirmación causal tiene sentido (releer: "¿era al revés?").

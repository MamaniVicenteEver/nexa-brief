# Guía · storytelling y guion

Cómo convertir un tema en un guion que se escuche como un documental profesional: **de 5 min
(corto) a 30 min o más (largo); 10 min es lo normal**. La duración objetivo está en
`assets/script.json → target_minutes` y sus rangos en `lengths.json` (§7).
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
- **Longitud**: la de `target_minutes` (§7): ~115–138 palabras por minuto según la voz del diseño.

## 5. `assets/script.json`

```json
{
  "id": "muro-de-berlin", "design": "binary", "title": "LA NOCHE QUE CAYÓ EL MURO", "kicker": "BERLÍN · 9 NOV 1989",
  "language": "es-419",
  "voice_direction": "Documental íntimo; intriga al inicio, euforia contenida en el clímax, cierre reflexivo.",
  "segments": [
    { "id": "s01", "tone": "intriga", "intensity": 0.7, "chapter": "La noche del 9 de noviembre", "text": "Nueve de noviembre de mil novecientos ochenta y nueve. …" }
  ],
  "target_minutes": 10
}
```

- Segmentos de 15–45 palabras (la cantidad depende de la duración, §7). Cada segmento = un tono.
- `chapter` (solo en el PRIMER segmento de cada capítulo, ≤ 40 caracteres): título del capítulo de
  YouTube. `kit.py manifest` calcula los tiempos (`manifest.chapters`) para la descripción.
- `tone` (uno de estos; cada uno tiene su dirección vocal en `tools/narrate.py`):
  `intriga, suspenso, explicativo, asombro, tensión, tensión creciente, descubrimiento,
  complicidad, aceleración, clímax, peso, silencio, curiosidad, revelación, dolor contenido,
  duelo, reparación, cierre, urgencia, alivio, reflexivo, cercano, admiración`.
  Los tonos lentos (intriga, peso, duelo…) agregan pausas entre oraciones solos.
- `intensity` 0–1 sigue la curva de §3 (se usa para la voz y para el ritmo visual).
- `title` y `kicker` = los del título gigante.

## 6. Checklist del guion (todas las duraciones)

- [ ] El primer segmento tiene fecha/lugar y algo que obliga a seguir mirando.
- [ ] Hay una pregunta abierta que se responde en el clímax.
- [ ] La curva tiene ≥ 2 bajadas y el máximo (1.0) está en el 60–72 % del video.
- [ ] Cada cifra del guion está en PLAN.md §3 con fuente.
- [ ] Frases candidatas a letra grande en el rango de su duración (cortas, contundentes).
- [ ] El último segmento vuelve al título o a la primera imagen.
- [ ] Palabras, segmentos y capítulos dentro del rango de `target_minutes` (`tools/lengths.py`), números en palabras.
- [ ] Hay un protagonista con nombre y la jerga está traducida a imágenes cotidianas.
- [ ] Leído en voz alta suena a alguien contando una historia, no a un informe.
- [ ] Cada afirmación causal tiene sentido (releer: "¿era al revés?").

## 7. Duración: corto, normal, serio y largo

`kit.py new … --minutes N` (o la producción desde la app) escribe `target_minutes` en el guion.
Rangos exactos: `.venv/bin/python src/templates/_tools/explainer-kit/tools/lengths.py N --design <diseño>`.
`kit.py status` y `kit.py check` los controlan. Para la voz de `binary` (115–130 ppm):

| duración | palabras | segmentos | capítulos | letras grandes | planos | fotos | componentes propios (mín.) |
|---|---|---|---|---|---|---|---|
| 5 min (corto, mínimo) | 546–702 | 15–23 | 2–4 | 3–5 | 55–85 | 4–8 | 1 |
| 10 min (normal) | 1092–1404 | 30–45 | 4–8 | 6–10 | 110–170 | 8–16 | 2 |
| 15 min (serio) | 1638–2106 | 45–68 | 6–12 | 9–15 | 165–255 | 12–24 | 3 |
| 30 min (largo) | 3277–4212 | 90–135 | 12–24 | 18–30 | 330–510 | 24–48 | 4 |

"Componentes propios" = los que el tema necesita y el catálogo no tiene (guides/components.md §6);
si el tema no tiene objetos propios (p. ej. una idea abstracta), se justifica en PLAN §7.

### Un video largo NO es un corto estirado

- **El punto crítico sigue siendo la columna.** Los capítulos son el camino hacia él y su
  consecuencia, no una enciclopedia: cada capítulo responde UNA pregunta que el anterior dejó abierta.
- **Cada capítulo tiene su mini-arco**: pregunta → desarrollo → respuesta parcial que abre la
  siguiente. Cada capítulo tiene al menos una bajada real. El pico global (1.0) sigue en el
  **60–75 %**; los picos de los capítulos anteriores no pasan de 0.85.
- **Re-gancho cada 60–90 s**: el último segmento del capítulo cierra con una frase que obliga a
  seguir ("Pero nadie en esa sala sabía que…"). La retención en YouTube se cae en los cambios de tema.
- **Más profundidad, no más palabras**: ≥ 2 hechos con fuente por minuto en PLAN §3, al menos 3
  personas con nombre (protagonista, contraparte, testigo), el mecanismo técnico explicado con
  imágenes y una consecuencia humana. Si el tema no da para la duración pedida, decirlo en el
  reporte y proponer la duración que sí da (no rellenar).
- **Estructura de referencia (10 min)**: gancho en miniatura (0–5 %, el momento crítico sin
  spoiler) → 4–8 capítulos (contexto y personas → el problema crece → el giro → **clímax** →
  el precio → qué quedó hoy) → cierre que vuelve al gancho.
- **Voz**: el kit la parte sola por largo (un pedido cada ~650 palabras, misma voz y estilo).
- **Whisper en CPU** tarda 1,5–3 min por minuto de audio: un video de 30 min puede tardar
  45–90 min en transcribirse. No cortarlo ni reemplazarlo por tiempos sintéticos.

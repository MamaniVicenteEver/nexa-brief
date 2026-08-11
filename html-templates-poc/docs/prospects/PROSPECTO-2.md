# PROSPECTO-2 — "TINTE TOTAL" (base: index6.1.html + truco de 2.html)
**Replicabilidad: 9/10 · Esfuerzo: bajo-medio · Prioridad: ALTA (la estrategia más automatizable del lote)**

---

## 1. Qué es

Una composición cinematográfica neón donde TODO se unifica por tinte: la foto de
fondo se somete con `brightness(0.2) + hue-rotate(280°)`, el sujeto (PNG sin fondo)
se siluetea con el mismo hue, una **luz orbital** de conic-gradient magenta/ámbar
con blur 60px gira detrás del sujeto (keyframe `snakeLightOrbit`, 7s), letras
gigantes "Y O U" al fondo, y un visualizador de 32 barras con **Web Audio API real**
(el único de los 14 con AnalyserNode funcional) que degrada elegante a senoidal si
no hay señal.

Se le fusiona el truco de **2.html**: `filter: grayscale(1)` + `mix-blend-mode:
luminosity` en el sujeto — el PNG se tiñe SOLO con el degradado del fondo, sin
retoque alguno.

## 2. Por qué fue elegido para replicarse

1. **"Tíñelo todo" es oro para la automatización**: el problema eterno del pipeline
   es que cualquier imagen y cualquier sujeto tienen paletas incompatibles. Aquí NO
   importa: el tinte converge todo a UNA paleta. Cualquier foto de fondo + cualquier
   PNG del sujeto = pieza coherente, garantizado por construcción.
2. **Un solo parámetro gobierna la estética**: el hue. El JSON de visión entrega
   `accent_hue` (del color más saturado del sujeto o elegido por mood) y de él se
   derivan los `hue-rotate`, el conic-gradient de la luz orbital y el gradiente de
   las barras. Una plantilla → infinitas variantes de color.
3. **Patrón de audio correcto ya implementado**: analyser real + fallback
   procedural = el estándar que adoptamos para todos los prospectos.
4. Es la base natural para el modo "hype/neón" del PROSPECTO-TOTAL (secciones de
   coro), complementando el modo "ambient" del PROSPECTO-1 (versos).

## 3. Qué mapea directo al JSON de visión

| Del JSON v9 | Al CONFIG del prospecto |
|---|---|
| `accent_hue` (nuevo campo: hue del color más saturado del sujeto) | todos los hue-rotate + gradientes |
| caja del sujeto | posición/altura del `character-container` y radio de la luz orbital |
| tinta de alto contraste | letras gigantes y frase |
| textos sugeridos | "Y O U" / "OBSESSED WITH" (slots) |
| `subject_png` (nuevo: ruta del recorte) | sujeto (requiere paso rembg en el pipeline) |

## 4. Qué hay que construir (el refactor, en orden)

1. **Una sola `--accent-hue`**: hoy los 280°/285° están pegados en dos filtros
   distintos y los colores del conic/barras son literales. Todo debe derivarse de
   la variable (`hsl(var(--accent-hue) …)` + `hue-rotate(calc(var(--accent-hue) - 300deg))`).
2. **CONFIG raíz**: `{ media:{bg, subject, audio}, hue, letters[], phrase[], brand }`.
3. **Importar la fuente correctamente** (usa Montserrat sin cargarla — hoy cae a
   Helvetica).
4. **Variante luminosity (de 2.html)** como flag: `subjectBlend: "silhouette" |
   "luminosity"` — silueta dura (index6.1) o teñido suave (2.html).
5. **Paso de segmentación en el pipeline**: este prospecto exige PNG sin fondo →
   integrar rembg (u ordenar la IA de visión a reportar si el asset ya viene
   recortado: campo `subject_png.has_alpha`).

## 5. Qué agregarle

- **Letra sincronizada**: sustituir la frase estática "OBSESSED WITH" por el motor
  de letras con timestamps (`{t, texto}` contra `audio.currentTime`) — el hueco ya
  existe y respira con keyframe propio.
- **Luz orbital reactiva**: acelerar `snakeLightOrbit` con la energía del bajo
  (o con `beats.json`) — la órbita "baila".
- **Bass bounce** (PROSPECTO-ADRENALINA §2.1) en el wrapper del sujeto: este
  layout lo pide a gritos.
- **Modo determinista** para grabación (analyser off → curva pre-computada).

## 6. Riesgos a resolver

- `blur(60px)` sobre conic-gradient animado es lo más caro del archivo — verificar
  60fps en headless; si duele, bajar a blur 40px o pre-renderizar la luz como
  imagen radial girando (transform puro).
- Audio cross-origin deja el analyser en silencio (ya mitigado por el fallback,
  pero la regla es: assets locales).
- Autoplay: arranca con reintento a 300ms; en headless usar el flag de autoplay.

## 7. Veredicto

**El prospecto de mayor apalancamiento técnico**: una variable (hue) controla toda
la estética, y el blend luminosity elimina el retoque manual de assets para
siempre. Junto con PROSPECTO-1 forma la pareja base del sistema: "Escena Viva"
para moods ambientales, "Tinte Total" para moods neón/hype.

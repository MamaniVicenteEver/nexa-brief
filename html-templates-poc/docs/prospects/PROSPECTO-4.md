# PROSPECTO-4 — "SPOTLIGHT" (base: 1.HTML, misma familia que 2.html)
**Replicabilidad: 9/10 · Esfuerzo: BAJO · Prioridad: MEDIA-ALTA (la mecánica más distintiva)**

---

## 1. Qué es

Un "foco revelador de color": la escena entera vive en blanco y negro
(`grayscale(1) contrast(1.5)`) y un círculo de luz que recorre la pantalla con una
curva de Lissajous revela la versión A COLOR de la imagen a su paso. Técnica: las
capas (fondo y sujeto PNG) están DUPLICADAS — versión gris debajo, versión color
encima recortada con `mask-image: radial-gradient(circle 240px at var(--spotlight-x)
var(--spotlight-y))`; JS solo mueve dos variables CSS por rAF. Encima: textos
"Focus/Yourself" troceados por carácter con onda senoidal, barra lateral japonesa
vertical con barrido de color carácter a carácter, lens flare con blend `screen` y
sello rojo.

## 2. Por qué fue elegido para replicarse

1. **Mecánica única en el lote**: ningún otro prototipo tiene un gancho visual tan
   identificable. El ojo PERSIGUE el foco (atención sostenida = palanca de
   dopamina §2 del PROSPECTO-DOPAMINA: reposo activo + anticipación de qué va a
   revelar).
2. **Estructuralmente trivial**: fondo + PNG + 3 bloques de texto + 1 color de
   acento. El efecto es agnóstico al contenido — funciona con CUALQUIER imagen
   porque la máscara y el Lissajous no saben qué hay debajo.
3. **Determinista por naturaleza**: sin Math.random — el Lissajous es una función
   pura del tiempo. La grabación es reproducible con solo virtualizar el reloj.
4. **Bajo costo de GPU**: dos capas y una máscara radial; nada de blurs gigantes.

## 3. Qué mapea directo al JSON de visión

| Del JSON v9 | Al CONFIG del prospecto |
|---|---|
| imagen + `subject_png` | las dos parejas gris/color |
| caja del sujeto | anclaje del PNG (lado, altura, flip) — hoy quemado en CSS |
| color más saturado | acento (#b30006 hoy) para sello/roja lateral |
| tinta de alto contraste | textos "Focus/Yourself" |
| textos sugeridos | los 3 bloques (principal, secundario, vertical JP) |
| keepOut / zonas del sujeto | posición de los bloques de texto (motor v9) |

## 4. Qué hay que construir (el refactor, en orden)

1. **CONFIG raíz**: `{ media:{bg, subject, audio}, accent, spotlight:{radius, freqX,
   freqY, ampX, ampY}, subjectBox:{side, height, flip}, texts:{main, sub, verticalJP} }`.
2. **Anclaje del sujeto parametrizado**: hoy `bottom-right + scaleX(-1) + height:85%`
   está en CSS — debe salir del bounding box del JSON (lado con más espacio libre).
3. **Reloj inyectable**: `t` como parámetro del rAF para grabación frame-perfect.
4. **Preload**: fuentes (`document.fonts.ready`) + imágenes antes de arrancar.
5. **Audio**: no tiene nada — añadir `<audio>` + el patrón analyser/fallback estándar.

## 5. Qué agregarle

- **Spotlight al beat**: el radio del foco pulsa con el bajo (240px → 300px en cada
  golpe) y en el DROP el foco se expande a pantalla completa 400ms (¡toda la imagen
  a color = recompensa máxima!) y se contrae. Esta sola idea lo convierte en una
  pieza de sincronización espectacular con `beats.json`.
- **Foco dirigido**: en vez de Lissajous ciego, la ruta del foco puede visitar
  puntos de interés del JSON de visión (cara del sujeto → mano → logo) — atención
  guiada por diseño.
- **Letra sincronizada**: las palabras aparecen DENTRO del foco (el foco las revela
  a su paso) — fusión natural con el motor de letras cinéticas.
- **Multi-spotlight** para el clímax (2-3 focos simultáneos).

## 6. Riesgos a resolver

- Hotlinks (Unsplash/GitHub raw) → assets locales.
- `@import` de fuentes → precarga.
- Tipografías con `clamp()` pensadas en horizontal → revisar variante 9:16.
- El PNG duplicado duplica memoria de textura — irrelevante en desktop, vigilar en
  móvil de gama baja.

## 7. Veredicto

**El prospecto "firma"**: no es el más rápido de producir (necesita audio y anclaje
paramétrico) pero es el que nadie más tiene. Con el foco pulsando al beat y el
"reveal total" en el drop, es la mecánica con mayor potencial de viralidad de los
cinco — un formato reconocible que puede convertirse en identidad del canal.

# PROSPECTO-5 — "GLITCH PHONK" (base: 7.HTML + motor de adrenalina)
**Replicabilidad: 7/10 hoy → 9/10 fusionado · Esfuerzo: bajo (plantilla) + medio (fusión) · Prioridad: MEDIA (tercera ola, pero techo altísimo)**

---

## 1. Qué es

El prototipo que el dueño calificó de "impresionante siendo solo una imagen":
estética phonk/glitch 100% CSS sobre UNA foto — respiración lenta (`breathe`,
scale 1→1.08 en 8s), jitter (`shake` ±1px cada 0.2s), separación cromática RGB
(el fondo duplicado en `::before` con `mix-blend-mode: screen` que se desplaza
±20px con hue-rotate en ráfagas), scanlines CRT, ruido SVG (`feTurbulence` inline,
autocontenido), strobes de color (`club`, 10s) y un JS mínimo que randomiza
`filter` (contrast/brightness/hue) cada 250ms. Tiene un slot de texto gigante
central (`voltage-center` con text-stroke y glitch) COMENTADO — el hueco para la
letra ya está pensado.

## 2. Por qué fue elegido (y por qué solo tiene sentido FUSIONADO)

**El diagnóstico honesto**: tal cual está, su techo es bajo para el pipeline —
nada es consciente de la escena (el hue-rotate aleatorio ignora la paleta), no hay
audio, y el "ritmo" visual son keyframes de duración fija + setInterval aleatorios
que jamás coincidirán con la canción.

**Pero es exactamente el HUÉSPED que el motor de adrenalina necesita**
(PROSPECTO-ADRENALINA): cada efecto que ya tiene es un actuador esperando su señal:

| Efecto existente (ciego) | Señal que debe gobernarlo |
|---|---|
| `setInterval(250)` randomiza filter | onsets de bajo (`beats.json` / analyser) |
| ráfagas RGB-split del `::before` | transitorios de agudos |
| strobes `club` cada 10s fijos | detección de drop (con límites WCAG) |
| saltos de posición cada 4.5s | cambios de sección de la canción |
| `breathe` 8s fijo | tempo real (duración = 4 compases del BPM) |

La fusión convierte ruido aleatorio en **sincronización agresiva** — el género
phonk/hype que pide exactamente esto.

## 3. Qué mapea directo al JSON de visión

| Del JSON v9 | Al CONFIG del prospecto |
|---|---|
| imagen | la foto única (CON fondo — no necesita recorte) |
| paleta medida | `hueRange` permitido para el glitch (que el hue-rotate SOLO recorra tonos coherentes con la imagen) |
| tinta de alto contraste + acento | color del texto central y de los strobes |
| textos sugeridos / letra | slot `voltage-center` (reactivar) |
| zonas del sujeto + keepOut | posición del texto central (motor v9) |

## 4. Qué hay que construir (el refactor, en orden)

1. **CONFIG raíz**: `{ media:{bg, audio}, hueRange:[h1,h2], glitch:{intensity,
   rgbSplitMax}, strobe:{enabled, colors[], cooldownMs}, texts:{center},
   epilepsySafe:false }`.
2. **Sustituir los setInterval por el reloj de audio**: los disparos salen de
   `beats.json` (grabación determinista) o del analyser (vivo). Es el mismo
   detector de onsets del PROSPECTO-ADRENALINA §2.1/2.4 — se construye una vez,
   sirve a los dos.
3. **hueRange de paleta**: cambiar `hue-rotate(random 0-360)` por un rango derivado
   de los colores medidos → el glitch nunca produce frames incoherentes.
4. **Reactivar `voltage-center`** como slot de letra por líneas/palabras con
   timestamps (motor de letras cinéticas).
5. **Modo epilepsia-safe**: una variable CSS que atenúa `club`/`flicker`
   (obligatorio para publicación; límites del PROSPECTO-ADRENALINA §2.4).

## 5. Qué agregarle

- **Bass bounce** en `.scene` (ya respira — solo cambiar la fuente de la escala).
- **Curva de intensidad por sección**: verso = glitch 20%, coro = 60%, drop = 100%
  con strobe + RGB-split máximo. Gobernado por el timeline del PROSPECTO-TOTAL.
- **Flash de inversión** (`invert(1)` 80ms) reservado para EL drop principal.
- Variante con video en vez de foto (el motor v9 ya lo resuelve).

## 6. Riesgos a resolver

- Animar `filter` a pantalla completa cada beat es lo más caro del lote — medir
  fps en headless; alternativa: overlay con blend-mode (patrón ADRENALINA §2.4).
- Fotosensibilidad: strobes con cooldown ≥350ms SIEMPRE (hoy no hay límite).
- Hotlink Unsplash → local. `Math.random()` → seed.
- Posible moderación en plataformas por flashes → el modo safe no es opcional.

## 7. Veredicto

**El prospecto de mayor impacto emocional por segundo**, pero el último en
construirse: depende del detector de beats y de las reglas de seguridad del motor
de adrenalina. Cuando exista `beats.json`, este huésped se enciende casi solo — y
para phonk/trap/hype será la plantilla estrella. Mientras tanto, su rol es definir
los actuadores que el motor de adrenalina debe saber disparar.

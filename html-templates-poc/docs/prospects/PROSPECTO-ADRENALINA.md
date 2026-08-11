# PROSPECTO — MOTOR DE ADRENALINA
### Investigación técnica de las 4 mecánicas del v10 (bass bounce, letras cinéticas, modulación de velocidad, flashes de clímax)
**Fecha:** Julio 2026 · **Tipo:** Solo investigación (las plantillas/JSON vienen después) · **Base:** Prompt System v10 del usuario

---

## 1. RELACIÓN CON EL PROSPECTO-DOPAMINA

Dopamina y adrenalina son motores complementarios, no el mismo:

| | DOPAMINA | ADRENALINA |
|---|---|---|
| Emoción | anticipación / recompensa | urgencia / impacto físico |
| Ritmo | 70% reposo, 10% recompensa | picos violentos, alta densidad |
| Uso ideal | loops ambientales, baladas, lo-fi | drops, phonk, trap, ediciones de hype |
| Riesgo | aburrir si falta | saturar si sobra |

La elección entre uno u otro (o la mezcla) debería ser un parámetro de la plantilla
(`mood: "ambient" | "hype" | "mixed"`) decidido según la canción.

---

## 2. ANÁLISIS TÉCNICO DE LAS 4 MECÁNICAS DEL v10

### 2.1 Rebote físico (Bass Bounce)

**Concepto v10:** el lienzo escala +3–7% en cada golpe de sub-bass con inercia física.

**Análisis técnico:**
- Fuente de señal: `AnalyserNode` (fftSize 512, smoothing ~0.78), energía = promedio
  de los bins bajos (20–150Hz ≈ primeros ~4-8 bins a 44.1kHz).
- **Detección de golpe, no de nivel**: escalar por el nivel continuo del bajo produce
  un "temblor" mareante. Lo correcto es detectar el ONSET (golpe): energía actual >
  media móvil × umbral (p.ej. 1.4×) → disparo → decay exponencial. Entre golpes, el
  scale vuelve a 1 con inercia.
- Implementación barata y headless-safe: variable CSS `--bass` actualizada por rAF,
  `transform: scale(calc(1 + var(--bass) * 0.06))` en el **wrapper** (#clip), no en
  el video (una sola composición GPU).
- ⚠️ Interacción con nuestro edge fade: el scale agranda el clip → el fade y la
  costura se mueven. Dos opciones: (a) escalar TODO el conjunto clip+relleno (el
  mundo entero rebota — se ve genial y la costura rebota junta, invisible), o
  (b) escalar solo el contenido DENTRO del clip (crop dinámico). La opción (a) es
  más simple y más impactante. **Recomendada: (a)**.
- Rango seguro: `maxBounceScale` 1.03–1.07. Más de 1.08 marea en pantallas grandes.

### 2.2 Letras popping cinéticas (Kinetic Popping)

**Concepto v10:** cada palabra estalla desde escala 0.4 con rotación 3D, glow neón y
rebote elástico (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`), y al pasar se dispersa.

**Análisis técnico:**
- Estructura: un contenedor `#lyricStage` posicionado con las MISMAS reglas de
  seguridad de nuestro motor (fuera del sujeto, fuera de keepOut, tinta por región)
  — el motor v9 ya calcula esos rectángulos: se reutiliza `bestFit`/`usable()` tal cual.
- Cada palabra un `<span>`, estados: `upcoming` (opacity 0.15, scale 0.8) →
  `active` (keyframe pop con el bezier elástico) → `passed` (dispersión suave).
  El estado `upcoming` ES la anticipación del PROSPECTO-DOPAMINA §2.1 — las dos
  investigaciones convergen aquí.
- Motor de tiempo: rAF que lee `audio.currentTime` y lo compara con `lyrics[]`
  (timestamps por palabra). NO usar setTimeout (deriva). Con esto la sincronización
  es sample-exacta incluso al pausar/buscar.
- Tipografía: peso 900, mayúsculas (ya es nuestro estilo). Fuente de Google SOLO si
  se descarga y embebe (grabación headless sin red → @font-face con base64 o
  fallback a Arial Black).
- Costo: trivial (pocas decenas de spans, animaciones transform/opacity).

### 2.3 Modulación de velocidad del video (Playback Speed Modulation)

**Concepto v10:** `video.playbackRate = 1.0 + treble*0.35` — el fondo se acelera en
secciones intensas.

**Análisis técnico:**
- Es la mecánica más sutil y la más delicada:
  - `playbackRate` con saltos bruscos produce stutter visible; hay que hacer LERP
    (interpolar suave: rate += (target-rate)*0.05 por frame).
  - Rango seguro 0.9–1.35. Fuera de eso el navegador puede saltar frames.
  - En videos en LOOP cortos, la aceleración cambia el punto de loop → la costura
    temporal del loop puede notarse. Mitigación: volver SIEMPRE a 1.0 antes del
    final del ciclo (rampa de salida en el último 15%).
- ⚠️ Grabación headless: playbackRate variable + captura a fps fijo puede producir
  duplicación de frames. Para grabar: pre-computar la curva de velocidad (ver §4)
  y verificar en el resultado. Es la mecánica con más riesgo técnico de las 4.
- Veredicto: implementarla la ÚLTIMA, detrás de un flag `speedModulation: false`
  por defecto.

### 2.4 Flashes de clímax (Dopamine/Adrenaline Flashes)

**Concepto v10:** en el drop (subida >40% del volumen en <100ms), sobreexposición
temporal 120ms (`brightness(1.5) saturate(1.5)`).

**Análisis técnico:**
- Detección: igual que 2.1 pero sobre la energía TOTAL, con umbral más alto (p.ej.
  1.8× la media móvil) y cooldown mínimo de 350ms entre flashes.
- Implementación: NO animar `filter` del #stage por frame (repinta todo). Mejor un
  **overlay div** a pantalla completa con `background: white` (o el `glow` de la
  paleta), `mix-blend-mode: overlay|screen`, animando SOLO `opacity` 0 → 0.55 → 0
  en 120ms. GPU pura, mismo efecto visual.
- **LÍMITE DE SEGURIDAD (no negociable)**: WCAG 2.3.1 — máximo 3 flashes por
  segundo. Con el cooldown de 350ms se cumple por construcción. Añadir soporte
  a `prefers-reduced-motion` (flashes off) para publicación web.
- Variante de lujo: flash de COLOR invertido (`filter: invert(1)` 80ms) reservado
  para EL drop principal de la canción (1–2 veces por pieza, no más).

---

## 3. TABLA DE PARÁMETROS (futuro CONFIG.adrenaline)

| Parámetro | Rango | Default | Mecánica |
|---|---|---|---|
| `enableBounce` | bool | true | 2.1 |
| `maxBounceScale` | 1.03–1.07 | 1.05 | 2.1 |
| `bounceDecayMs` | 80–200 | 120 | 2.1 |
| `lyricStyle` | kinetic-pop / neon-drift / slide-bounce | kinetic-pop | 2.2 |
| `anticipationMs` | 150–350 | 250 | 2.2 (converge con dopamina) |
| `speedModulation` | bool | **false** | 2.3 (riesgo técnico) |
| `speedRange` | [0.9, 1.35] | [1.0, 1.25] | 2.3 |
| `enableFlashes` | bool | true | 2.4 |
| `flashCooldownMs` | ≥350 | 350 | 2.4 (seguridad WCAG) |
| `flashOpacity` | 0.3–0.7 | 0.55 | 2.4 |
| `invertOnMainDrop` | bool | false | 2.4 variante |

---

## 4. EL PROBLEMA DEL DETERMINISMO (crítico para grabación)

El análisis Web Audio en vivo da resultados ligeramente distintos en cada
reproducción (timing de rAF, buffers). Para publicar un archivo grabado esto
importa:

**Solución recomendada: análisis offline pre-computado.**
1. Un script (Python: librosa/aubio) analiza `song.mp3` UNA vez y emite
   `beats.json`: `{ "bass_onsets": [0.52, 1.04, ...], "drops": [31.2], "energy": [...] }`.
2. El motor en runtime NO analiza: lee `audio.currentTime` y consulta la tabla.
3. Resultado: cada grabación es idéntica, el bounce cae siempre en el mismo frame,
   y el costo de CPU en runtime baja a cero.
4. El AnalyserNode queda como fallback para reproducción en vivo sin beats.json
   (la plantilla soporta ambos modos con el mismo CONFIG).

Este mismo beats.json alimenta el ecualizador actual → una sola fuente de verdad.

---

## 5. ORDEN DE IMPLEMENTACIÓN RECOMENDADO (cuando toque construir)

1. **Letras cinéticas (2.2)** — mayor impacto, cero riesgo, reutiliza el motor v9.
2. **Flashes con overlay (2.4)** — barato, espectacular, límites claros.
3. **Bass bounce (2.1)** — necesita el detector de onsets (o beats.json).
4. **Speed modulation (2.3)** — al final, tras validar grabación con 1–3.

## 6. RIESGOS GLOBALES

- **Fotosensibilidad**: cooldown 350ms + opacity ≤0.7 + prefers-reduced-motion.
- **Rendimiento**: todo con transform/opacity + un canvas; jamás filter/box-shadow
  animados en nodos grandes por frame.
- **Fatiga del espectador**: adrenalina sin pausas satura en ~15s. La curva de la
  CANCIÓN debe gobernar (verso = modo dopamina, drop = modo adrenalina). Esa
  orquestación por secciones es el corazón del PROSPECTO-TOTAL.

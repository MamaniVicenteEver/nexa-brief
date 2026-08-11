# PROSPECTO-1 — "ESCENA VIVA" (base: jav-2.html)
**Replicabilidad: 9/10 · Esfuerzo: bajo-medio · Prioridad: MÁXIMA (favorito del dueño y el más listo del lote)**

---

## 1. Qué es

Una imagen completa (CON fondo) que cobra vida: partículas ambientales coherentes
con la escena (pétalos carmesí/naranja con física de viento y rotación 3D real,
niebla, nubes, grullas que cruzan), parallax sutil del fondo, y un haiku vertical
cuyos caracteres se van coloreando en ciclos (marrón↔fuego) — todo respirando al
ritmo del bajo de la canción mediante Web Audio API real.

Es la evolución directa de jav.html (imagen remota, paleta sakura) y de
index13.html (de donde hereda el motor de pétalos, el mejor sistema de partículas
de los 14 prototipos).

## 2. Por qué fue elegido para replicarse

1. **Es el que menos refactor necesita**: ya tiene `settings` documentado (viento,
   gravedad, turbulencia, petalCount, fogCount, cloudCount, birdChance, maxBirds,
   direction) y `petalPalette` como array aislado — el germen del CONFIG ya existe.
2. **Audio-reactividad real con fallback**: AnalyserNode (fftSize 64) modula
   velocidad, gravedad y giro de los pétalos con el bajo; si el audio no suena,
   simula un pulso a ~88 BPM y la escena vive igual — a prueba de headless.
3. **Un solo canvas para todo** (sprites pre-renderizados offscreen): ~180
   entidades a costo mínimo. Rendimiento sano para grabar a 60fps.
4. **Encaja perfecto con el pipeline**: imagen local (`./jav2.png`), y todo lo que
   lo define (paleta de pétalos, tintes de niebla/nube/ave, colores del ciclo del
   haiku) puede salir directo del JSON de visión v9 (colores dominantes + acento).
5. Es la materialización de PROSPECTO-DOPAMINA §2.2 (partículas coherentes con la
   escena = "reposo activo" que sostiene la mirada).

## 3. Qué mapea directo al JSON de visión (sin construir nada nuevo)

| Del JSON v9 | Al CONFIG del prospecto |
|---|---|
| imagen analizada | `media.bg` |
| paleta medida del fondo (5 dominantes/acentos) | `palette.petals[]` |
| tinte cálido/frío detectado | `palette.fog`, `palette.cloud` |
| color de silueta oscura del sujeto | `palette.bird` |
| tinta de alto contraste | `text.cycle[c1,c2]` (ciclo del haiku) |
| `scene_overview.style` | selector de bioma (ver §5) |
| texto sugerido / letra | `text.haiku` |

## 4. Qué hay que construir (el refactor, en orden)

1. **CONFIG raíz único**: `{ media:{bg,audio}, text:{haiku,brand}, palette:{petals[],
   fog, cloud, bird, textCycle[]}, physics:{...settings} }`. Hoy los tintes de
   niebla/nube/grulla están incrustados como rgba dentro de los métodos `draw()`
   y los colores del ciclo del haiku como strings JS — sacarlos a la paleta.
2. **Texto fuera del HTML**: el haiku está en el markup troceado por spans; debe
   generarse desde CONFIG.
3. **Reloj de escena por `audio.currentTime`** (hoy usa timestamp de rAF): ata la
   grabación a la canción y la hace repetible.
4. **Modo determinista**: RNG con semilla + el pulso simulado como fallback ya
   existente. Con `beats.json` (PROSPECTO-ADRENALINA §4) la reactividad queda
   idéntica en cada grabación.
5. **Assets locales y `scene-ready`**: precargar imagen/fuentes y emitir un evento
   cuando todo está listo, para que el grabador sepa cuándo empezar.

## 5. Qué agregarle (mejoras de siguiente nivel)

- **Selector de bioma**: `ambient.type = "sakura" | "autumn" | "snow" | "embers" |
  "dust" | "rain" | "birds-only" | "none"` — una factoría de sprites (hoy solo hay
  pétalo) y la IA de visión elige el bioma según la escena. Es LA mejora que lo
  convierte en plantilla universal: la misma física sirve para nieve, brasas o polvo.
- **Haiku sincronizado a beats**: el ciclo de coloreado hoy va a 160ms fijos por
  carácter; moverlo a timestamps de `beats.json` (el carácter se enciende EN el beat).
- **Sujeto opcional sin fondo**: aceptar un `subject.png` adicional (z entre fondo
  y canvas) con parallax a distinta velocidad — profundidad real (idea de 1.HTML).
- Integrar el **motor de letras cinéticas** (PROSPECTO-ADRENALINA §2.2) como capa
  opcional para versión lyric-video.

## 6. Riesgos a resolver

- Audio SoundHelix y Google Fonts por CDN → empaquetar local/base64.
- `resize` reinicia todas las entidades (salto visual) → re-proyectar en vez de recrear.
- El catálogo de sprites es temático (sakura): sin el selector de bioma del §5,
  fondos no-japoneses desentonan.

## 7. Veredicto

**El prospecto #1 sin discusión.** Mínima distancia entre lo que existe y la
plantilla final; máxima alineación con la visión del dueño (imagen con vida +
partículas según el fondo + letras vivas + canción). Con el selector de bioma y
la paleta derivada del JSON de visión, una sola plantilla cubre estéticas
completamente distintas sin tocar código.

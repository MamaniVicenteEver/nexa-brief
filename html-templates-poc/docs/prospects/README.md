# ESTUDIO-HTML — Investigación de prototipos replicables
**Fecha:** Julio 2026 · **Alcance:** SOLO investigación — las plantillas y JSON se construyen después con esta información
**Método:** los 14 prototipos de `output/prot/` fueron leídos y analizados código por código (capas, animaciones, inputs, qué está quemado, audio-reactividad, riesgos de grabación headless) y calificados por replicabilidad automática con nuestro pipeline de visión (JSON v9).

---

## 1. RANKING COMPLETO

| # | Archivo | Replicabilidad | Esfuerzo | Veredicto |
|---|---|---|---|---|
| 1 | **jav-2.html** | 9/10 | bajo-medio | ⭐ PROSPECTO-1 — el favorito del dueño y el más listo para plantilla |
| 2 | **index6.1.html** | 9/10 | bajo-medio | ⭐ PROSPECTO-2 — estrategia "tíñelo todo" + único con Web Audio real |
| 3 | **INDEX16.HTML** | 9/10 | bajo | ⭐ PROSPECTO-3 — fondo auto-derivado de la propia imagen |
| 4 | **1.HTML** | 9/10 | bajo | ⭐ PROSPECTO-4 — spotlight revelador de color, determinista |
| 5 | **7.HTML** | 7/10 | bajo | ⭐ PROSPECTO-5 — glitch phonk; solo cobra sentido fusionado con el motor de adrenalina |
| 6 | INDEX17.HTML | 9/10 | bajo | Mención: candidata a "plantilla base mínima" (póster estático, cero JS) — se absorbe como esqueleto común |
| 7 | 2.html | 8/10 | bajo | Mención: el truco `grayscale + mix-blend-mode: luminosity` (el sujeto se tiñe solo con la paleta) se ABSORBE en PROSPECTO-2 |
| 8 | index5-si.html | 8/10 | medio | Mención: layout boom-bap con texto gigante detrás; segunda ola |
| 9 | INDEX15.HTML | 8/10 | medio | Mención: plantilla "premium" 16:9 con reproductor; segunda ola (requiere variante 9:16) |
| 10 | jav.html | 8/10 | medio-bajo | Sustituido por jav-2 (misma línea, versión mejor) |
| 11 | 6.HTML | 8/10 | bajo | Mención: su waveform sintético determinista es útil para grabación; se absorbe como fallback estándar |
| 12 | INDEX18.HTML | 7/10 | medio | Aplazado: el valor es tipografía artesanal que un CONFIG plano no captura (necesita presets curados) |
| 13 | index13.html | 6/10 | medio-alto | Su motor de pétalos (el mejor del lote) ya vive en jav-2; la escena multi-asset queda para el futuro |
| 14 | INDEX14.HTML | 5/10 | alto | Descartado por ahora: exige SVG del sujeto partido en 2 mitades (el pipeline no lo produce) |

**Criterios de selección de los 5**: nota de replicabilidad, esfuerzo, diversidad de
estética (ambiental / neón-tinte / gótico / editorial-spotlight / phonk-agresivo),
y preferencia declarada del dueño (jav-2 y 7 mencionados explícitamente).

## 2. CONTENIDO DE LA CARPETA

| Archivo | Qué contiene |
|---|---|
| `PROSPECTO-1.md` | jav-2.html — "Escena Viva" (partículas ambientales + audio real) |
| `PROSPECTO-2.md` | index6.1.html — "Tinte Total" (+ truco luminosity de 2.html) |
| `PROSPECTO-3.md` | INDEX16.HTML — "Auto-Fondo" (fondo derivado de la propia imagen) |
| `PROSPECTO-4.md` | 1.HTML — "Spotlight" (revelado de color en movimiento) |
| `PROSPECTO-5.md` | 7.HTML — "Glitch Phonk" (huésped del motor de adrenalina) |
| `PROSPECTO-DOPAMINA.md` | Investigación: mecánicas de anticipación/recompensa/loop |
| `PROSPECTO-ADRENALINA.md` | Investigación: bass bounce, letras cinéticas, speed modulation, flashes (análisis técnico del v10) |
| `PROSPECTO-TOTAL.md` | LA EDICIÓN completa (canción conocida, letras entrando/saliendo todo el tiempo) + la decisión "¿un medio o varios?" |

## 3. HALLAZGOS TRANSVERSALES (aplican a TODOS los prospectos)

Problemas repetidos en los 14 prototipos que la plantilla final debe resolver de fábrica:

1. **Assets por hotlink** (Unsplash, Pinterest, wikia, Dropbox, cubeupload, SoundHelix,
   GitHub raw): cualquier caída rompe la pieza. Regla: TODOS los assets locales
   junto al HTML (`bg.jpg`, `subject.png`, `song.mp3`).
2. **Fuentes Google por @import**: FOUT/bloqueo en grabación. Regla: precargar y
   esperar `document.fonts.ready` antes de iniciar animaciones (o fuentes base64).
3. **Sin CONFIG**: solo index13/jav tienen `settings`. Regla: TODO en un CONFIG raíz
   único (media, textos, paleta, física, timings) — como nuestras plantillas v7–v9.
4. **Colores duplicados** CSS + strings JS (el mismo acento pegado en 4–10 sitios).
   Regla: una sola fuente de verdad (`--accent`, `--accent-hue`) leída desde JS.
5. **No determinismo** (`Math.random()`, `Date.now()`): dos grabaciones nunca salen
   iguales. Regla: RNG con semilla + reloj basado en `audio.currentTime` +
   análisis de audio pre-computado (`beats.json`, ver PROSPECTO-ADRENALINA §4).
6. **Autoplay**: grabación headless necesita `--autoplay-policy=no-user-gesture-required`
   y todos los prototipos deberían arrancar sin click (con el flag) manteniendo el
   click como fallback.
7. **Audio-reactividad falsa o ausente** en 12 de 14 (solo jav/jav-2/index6.1 tienen
   AnalyserNode real). El patrón correcto ya existe en index6.1: analyser real con
   fallback procedural si no hay señal — se adopta como estándar.

## 4. QUÉ SIGUE (cuando termine la fase de estudio)

1. Refactor de cada prospecto a plantilla CONFIG-única (el orden es el ranking).
2. Extender el JSON de visión v9 con los campos nuevos que piden los prospectos:
   `ambient{}` (tipo/densidad/tinte de partículas), `accent_hue`, `subject_png`
   (¿hay recorte? ¿hace falta rembg?), `mood`.
3. Construir el pipeline de audio del PROSPECTO-TOTAL: letra con timestamps por
   palabra (Whisper) + `beats.json` (librosa) — alimenta a TODOS los prospectos.
4. Prompts 1 y 2 por prospecto (mismo esquema de siempre: visión → JSON → template fill).

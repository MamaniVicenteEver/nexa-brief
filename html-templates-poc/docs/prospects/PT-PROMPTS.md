# PT — LA EDICIÓN · Prompts de replicación
**Plantilla:** `output/pt-edicion.html` (probada en Chromium headless 1600×900 con `test2.mp4`)
**Caso:** el formato integrador — video O imagen + canción muy conocida + letras entrando y saliendo TODO el tiempo, golpeando la pantalla con destellos, rebote de bajo, sacudidas, chispas y modos por sección. Máxima dopamina/adrenalina/aura. **Impredecible por diseño** (cada palabra elige su entrada con semilla determinista → espectáculo irrepetible entre piezas, idéntico entre grabaciones de la misma pieza).

**Flujo:** medio + canción → PROMPT 1 (visión) + PREPARACIÓN MUSICAL → PROMPT 2 (constructor con libertad) → HTML final.

---

## HERRAMIENTAS QUE TRAE LA PLANTILLA (lo que la IA constructora puede orquestar)

| Herramienta | Qué hace | Control en CONFIG |
|---|---|---|
| Letras cinéticas | cada palabra entra con 1 de 5 animaciones (pop / slam-izq / slam-der / rise / glitch) con rebote elástico y sombra cromática RGB | `lyrics[]` (t, text, emphasis 0-2, style) |
| Énfasis 2 = puñetazo | palabra XL al centro + flash + sacudida + ráfaga de chispas + jolt RGB | `emphasis: 2` |
| Bass bounce | el mundo entero rebota con el bajo | `adrenaline.maxBounce` |
| Flash de clímax | destello con blend screen, cooldown WCAG-safe ≥380ms | `flashOpacity`, `flashCooldownMs` |
| Sacudida | shake de 240ms en drops | `shakePx` |
| Jolt RGB | contraste/saturación/hue 130ms | `jolt` |
| Palabra fantasma | palabra gigante tenue detrás de todo, respira con el bajo | `ghostWord`, `colors.ghost` |
| Modos por sección | calm / build / drop escalan TODA la intensidad | `sections[]` |
| Chispas | ráfagas radiales en los puñetazos | automático |
| Espectro | barras abajo (analyser real o simulado) | automático |
| Tinte + grano + viñeta | acabado de color y textura fílmica | `colors.tint` |
| Fallback total | sin song.mp3 la pieza vive con patrón de kick simulado | `audio.simulatedBpm` |

---

## PROMPT 1 — MEDIA VISION EXTRACTOR PT (enviar con la captura del medio)

```
# SYSTEM PROMPT: Hype-Edit Media Extractor (PT — La Edición)

You are an expert Media Analyst for a high-adrenaline lyric-edit engine. You
will receive ONE still capture (a standalone image, or the first frame of a
looping video). The engine shows the media FULL-SCREEN (cover) behind kinetic
word-by-word lyrics with flashes, bass bounce and screen shake. Extract:

1. MEDIA: true resolution in px; type ("video" if told it is a video frame,
   else "image").
2. SUBJECT READ: what/who is in the scene (2-6 words); if it is a RECOGNIZABLE
   character, their name in caps (do not guess); the energy of the pose
   (explosive / menacing / serene / triumphant).
3. COLOR CALIBRATION (channel-level reasoning, no snapping to pure colors):
   - ink: high-contrast text color over the media's mid-tones.
   - hot: THE accent for punch words — the most electric color that fits the
     media (a saturated red/cyan/magenta present in or harmonizing with it).
   - tint: a deep tone for the bottom color-grade gradient.
   - ghost: rgba() of ink at alpha 0.04-0.07 for the giant background word.
4. GHOST WORD: one word in caps that names the piece's energy — the known
   character name if recognizable, else a power word (AURA, LIMITLESS, RAGE).
5. LYRIC SAFE NOTES: where the subject's face/focus is (the engine's center
   punch-slot may cover it briefly — flag if the face occupies the exact
   center so the builder can shift emphasis words).

## OUTPUT — raw JSON only:
{
  "media": { "type": "video", "width_px": 0, "height_px": 0 },
  "subject": { "read": "", "known_name": "", "energy": "" },
  "colors": { "ink": "#000000", "hot": "#000000", "tint": "#000000",
              "ghost": "rgba(0,0,0,0.05)", "notes": "" },
  "ghost_word": "",
  "face_center_warning": false
}
```

## PREPARACIÓN MUSICAL (sin IA de visión — scripts, una vez por canción)

```bash
# 1. Letra con timestamps por PALABRA (Whisper)
whisper song.mp3 --model medium --word_timestamps True --output_format json
# 2. (opcional, recomendado para grabación determinista) beats y secciones
#    librosa/aubio → bpm, onsets, drops, secciones por energía
```
El resultado se resume a mano o con un LLM en dos listas para el Prompt 2:
- `WORDS`: `palabra | segundo` (una por línea)
- `SECTIONS`: `tipo (calm/build/drop) | desde | hasta` — si no hay análisis,
  estimarlas escuchando la canción (intro/verso/coro/drop).

**Derechos**: letra y grabación de canciones conocidas tienen copyright — usar
catálogo licenciado o biblioteca de la plataforma antes de producir en masa.

---

## PROMPT 2 — EDIT DIRECTOR PT (constructor con libertad creativa)

```
# SYSTEM PROMPT: Hype-Edit Director (PT — CONFIG Composer)

You are an elite music-video Edit Director. You will receive a PROVEN, TESTED
HTML template ("La Edición") whose behavior is 100% driven by `const CONFIG`.
Do NOT redesign the template. Your job is DIRECTION: compose the CONFIG so the
piece hits as hard as possible.

**Fixed mapping (VISION JSON -> CONFIG):**
* media -> media (src is always "media.mp4" or "media.jpg" matching type)
* colors -> colors ; ghost_word -> ghostWord

**Your creative decisions (this is where you earn your title):**
1. LYRICS: map every WORDS entry to { t, text, emphasis, style }:
   - emphasis 2 (punch: flash+shake+sparks) ONLY for the 3-6 words everyone
     sings — the title hook, the drop word. Never two punches < 2s apart.
   - emphasis 1 for strong beats; 0 for connectives.
   - style: leave "auto" (seeded unpredictability) for most words; force
     "glitch" on aggressive words, "rise" on hopeful ones, slams to alternate
     sides on call-and-response lines.
   - If face_center_warning is true, give emphasis-2 words style "rise" so
     they land slightly below center.
2. SECTIONS: map SECTIONS to sections[] (calm/build/drop). The piece must
   BREATHE: never open at drop intensity; the drop must arrive as a release.
3. ADRENALINE: scale to the genre — phonk/trap: maxBounce 0.05-0.06,
   shakePx 8-10; pop/lo-fi: 0.03, shake 4-5. NEVER lower flashCooldownMs
   below 350 (photosensitivity safety). Keep it at 380 unless asked.
4. seed: any integer — change it to get a different (but reproducible)
   choreography for the same song.

## VISION JSON
[INJECT_VISION_JSON_HERE]

## WORDS
[palabra | segundo — una por línea]

## SECTIONS
[tipo | desde | hasta — una por línea]

## OUTPUT
Return ONLY the complete HTML (template with CONFIG composed), from
<!DOCTYPE html> to </html>. No explanations.

## TEMPLATE (copy verbatim, fill only CONFIG)
[PEGAR AQUÍ EL CONTENIDO COMPLETO DE pt-edicion.html]
```

---

## NOTAS DE REPLICACIÓN

- **Assets**: `media.mp4` (o `media.jpg`) y `song.mp3` junto al HTML. Sin
  canción, el motor simula el kick al BPM configurado (la demo funciona así).
- **Grabación headless**: `--autoplay-policy=no-user-gesture-required`. La
  coreografía es determinista por `seed`; el reloj usa `audio.currentTime`
  cuando la canción suena (sincronización sample-exacta).
- **Seguridad**: cooldown de flash ≥380ms de fábrica (≈2.6 flashes/s máx,
  dentro de WCAG 2.3.1); `shakePx` y `maxBounce` en rangos mareo-seguros.
- **La imprevisibilidad**: `style: "auto"` + `seed` — cada pieza tiene una
  coreografía única; la misma pieza siempre graba idéntica. Cambiar el seed =
  nueva coreografía gratis con los mismos assets.
- **Verificado**: video de fondo + palabra fantasma + palabras cinéticas con
  estelas + flash en drop + chispas + espectro, en dos momentos del timeline.

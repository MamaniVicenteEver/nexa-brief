# P4 — AURA · Prompts de replicación (2 enfoques en una plantilla)
**Plantilla:** `output/p4-aura.html` (probada en Chromium headless 1600×900 con `prot/6.png`, ambos layouts)
**Caso:** imagen SIN fondo (solo el sujeto: persona, coche, etc.). La IA **decide el fondo** (colores fuertes: rojo, negro, blanco... que convengan al sujeto) y elige entre 2 enfoques:
- **`center-back`**: sujeto centrado levitando + palabra gigante DETRÁS (THE GOAL, AURA, o el nombre del personaje si es conocido) — estilo 2.html.
- **`side-split`**: sujeto a un lado + palabra gigante al otro lado + línea de acento en itálica + caída de palabras que cambian de color — estilo 1.HTML, tipografías mezcladas.

**Flujo:** PNG sin fondo → PROMPT 1 → JSON → PROMPT 2 + plantilla → HTML final.

---

## PROMPT 1 — VISION EXTRACTOR P4 (enviar junto con el PNG sin fondo)

```
# SYSTEM PROMPT: Subject-Only Vision Extractor & Art Director (P4 — AURA)

You are an expert Subject Analyst and Poster Art Director. You will receive ONE
image of an ISOLATED SUBJECT on a transparent background (a person, car,
creature, product...). There is NO background to measure — instead, YOU DESIGN
the background and the composition. Your output feeds an automated poster
engine with two layouts. Precision and taste are both mandatory.

## COORDINATE SYSTEM
- Detect the TRUE native resolution in px (including transparent area).
- All coordinates are absolute px, top-left = (0,0).

## WHAT YOU MUST EXTRACT & DECIDE (5 LAYERS)

### LAYER 1 — SUBJECT IDENTITY
- label: what it is, in 3-6 words.
- known_name: if it is a RECOGNIZABLE character/car/celebrity, its name
  (e.g. "TOJI", "GOKU", "GTR"); empty string if not recognizable. Do not guess.
- attitude: the emotional read (menacing / heroic / serene / feral...).

### LAYER 2 — SUBJECT ZONES (like our standard pipeline, in px)
Split the visible subject into 3 vertical zones and report [y0, y1, x0, x1]:
- head zone (head/roof), mid zone (torso/body — include extended limbs), low
  zone (legs/wheels/base). Measure the real pixel extents of the visible art.

### LAYER 3 — BACKGROUND DESIGN (YOU decide — there is no background)
Choose STRONG colors that serve the subject. Reserve palette: reds, blacks,
whites, deep crimsons, bone, steel — bold poster colors. Rules:
- If the subject's art contains a signature color (blood red, neon cyan...),
  build around it. If the subject is monochrome (B/W ink art), choose ONE
  dramatic hue + near-black — monochrome art + one strong hue is the winning
  combo.
- Output 3 HEX stops (center → mid → edge) for a radial or vertical gradient.
- Also decide blend: "luminosity" (the background TINTS a grayscale subject —
  use it when the subject is monochrome or should fuse with the mood) or
  "none" (subject keeps its own colors — use for colorful subjects like cars).

### LAYER 4 — LAYOUT CHOICE & WORDS
- layout: "center-back" if the subject is symmetric/frontal/centered-energy;
  "side-split" if the subject reads better anchored to one side (profile pose,
  directional motion, asymmetric silhouette). subjectSide = the side that lets
  the subject FACE INTO the empty space.
- giant_word: ONE word in caps — the known_name if recognizable, otherwise a
  power word matching the attitude (AURA, THE GOAL, RELENTLESS, VELOCITY...).
- side_words: 4-6 short power words for the falling column (side-split).
- accent_line: a short italic phrase (4-7 words, lowercase poetic).
- ink: high-contrast text color over the darkest gradient stop.
- side_cycle: two HEX — a pale ink and a hot accent (falling words alternate).
- giant_color / giant_stroke: rgba() fill and stroke for the giant word —
  subtle (alpha 0.10-0.20 fill, 0.25-0.40 stroke) so it stays BEHIND the story.

### LAYER 5 — ATMOSPHERE
- particles: { type: "embers" | "stones" | "none", color: hot accent HEX,
  dark: near-black HEX, count: 18-32 }. Embers for fire/rage moods, stones for
  gravity/power moods, none for clean/product looks.
- glow: { color: accent HEX, intensity: 0.3-0.65 } — the ground glow under the
  subject.

## OUTPUT RULES
Return EXCLUSIVELY a raw JSON object. No markdown, no commentary.

## EXACT SCHEMA
{
  "subject": {
    "width_px": 0, "height_px": 0, "label": "", "known_name": "", "attitude": "",
    "zones": { "head": [0,0,0,0], "mid": [0,0,0,0], "low": [0,0,0,0] }
  },
  "background": { "colors": ["#000000", "#000000", "#000000"], "style": "radial",
                  "blend": "luminosity", "why": "" },
  "layout": { "mode": "center-back", "subjectSide": "right", "why": "" },
  "words": {
    "giant_word": "", "side_words": ["", "", "", ""], "accent_line": "",
    "ink": "#000000", "side_cycle": ["#000000", "#000000"],
    "giant_color": "rgba(0,0,0,0.16)", "giant_stroke": "rgba(0,0,0,0.35)"
  },
  "atmosphere": {
    "particles": { "type": "embers", "color": "#000000", "dark": "#000000", "count": 24 },
    "glow": { "color": "#000000", "intensity": 0.5 }
  }
}

## VALIDATION CHECKLIST
1. Zones measured on the real visible pixels ([y0,y1,x0,x1], inside bounds).
2. Background colors are STRONG poster colors that serve the subject's own art
   (justified in "why"); blend decision justified.
3. giant_word: known_name only if truly recognizable.
4. side-split only if the pose is directional; subjectSide lets the subject
   face the empty side.
5. All colors 6-digit HEX (rgba only where the schema says rgba).
6. Output is pure parseable JSON.
```

---

## PROMPT 2 — TEMPLATE FILL P4 (pegar el JSON + la plantilla)

```
# SYSTEM PROMPT: AURA Poster Builder (P4 — Template Fill)

You are a precise code assembler. You will receive a PROVEN, TESTED HTML template
("AURA") with two layouts (center-back / side-split), AI-designed strong-color
background, luminosity tinting, levitation, ground glow, rising particles,
falling side-words with color cycling, film grain and vignette. It already
works. Do NOT redesign it. Your ONLY task is to replace the values inside
`const CONFIG = {...}` using the VISION JSON below.

**Mapping (VISION JSON -> CONFIG):**
* subject.width_px/height_px -> subject.w / subject.h (src is always "subject.png")
* subject.label/known_name -> subject.label / subject.knownName
* subject.zones -> subject.zones (same [y0,y1,x0,x1] arrays)
* background.colors/style -> bg.colors / bg.style ; background.blend -> blend
* layout.mode -> layout ; layout.subjectSide -> subjectSide
* words.giant_word -> giantWord ; words.giant_color/giant_stroke -> giantColor/giantStroke
* words.side_words -> sideWords ; words.accent_line -> accentLine
* words.ink -> ink ; words.side_cycle -> sideCycle
* atmosphere.particles -> particles ; atmosphere.glow -> glow
* Keep untouched: audio, seed.

## VISION JSON
[INJECT_VISION_JSON_HERE]

## OUTPUT
Return ONLY the complete HTML (template with CONFIG filled), from <!DOCTYPE html>
to </html>. No explanations.

## TEMPLATE (copy verbatim, fill only CONFIG)
[PEGAR AQUÍ EL CONTENIDO COMPLETO DE p4-aura.html]
```

---

## NOTAS DE REPLICACIÓN

- **Assets**: `subject.png` (RGBA, sin fondo) y `song.mp3` (opcional — sin canción
  hay pulso simulado a 96 BPM que mueve levitación, glow y partículas).
- **Los dos enfoques verificados**: center-back (palabra gigante contorneada
  detrás, sujeto teñido por el degradado vía luminosity) y side-split (palabra
  apilada + línea itálica + caída de palabras con cambio de color).
- **Si el pipeline recibe una imagen CON fondo**: primero pasar rembg (u otra
  segmentación) — esta plantilla asume alfa real.
- **Grabación headless**: `--autoplay-policy=no-user-gesture-required`; semilla
  determinista en CONFIG.seed.

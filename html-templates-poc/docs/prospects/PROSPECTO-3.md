# PROSPECTO-3 — "AUTO-FONDO" (base: INDEX16.HTML)
**Replicabilidad: 9/10 · Esfuerzo: BAJO (el refactor más corto de los 5) · Prioridad: ALTA**

---

## 1. Qué es

Póster gótico por capas: el fondo es **la misma imagen del sujeto** desenfocada y
apagada (`grayscale(1) brightness(0.1) blur(12px) scale(1.1)`), el PNG del sujeto
sin fondo va encima con un `mask-image` que lo desvanece por abajo, nieve (60
copos) cayendo, y una capa completa de tipografía editorial encima: título
blackletter gigante (†Moth), tags en las esquinas, versos laterales verticales y
paneles de información. Ya usa variables CSS (`--wine-red`, `--silver`, `--dust`,
`--blood`) — medio camino andado.

## 2. Por qué fue elegido para replicarse

1. **La idea del auto-fondo es la misma de nuestro modo blur v7-v9**: el fondo se
   deriva de la propia imagen → cero costuras, cero dependencia de la precisión de
   color, y UN SOLO asset de imagen si el pipeline lo decide. Es la validación en
   "modo póster" de la estrategia que ya probamos en las plantillas seamless.
2. **El refactor más barato del lote**: paleta ya en `:root`, cero física compleja,
   posiciones en vh/vw. Extraer CONFIG y borrar el cursor externo — poco más.
3. **Es el patrón exacto que el dueño describió**: "imagen sin fondo y letras por
   encima" — el arquetipo de póster editorial que más se repite en las referencias.
4. **Determinista y sin interacción**: perfecto para grabación headless sin trucos.

## 3. Qué mapea directo al JSON de visión

| Del JSON v9 | Al CONFIG del prospecto |
|---|---|
| paleta medida | variables `:root` (`--wine-red` → `--accent`, etc.) |
| caja del sujeto | altura/posición del PNG y del mask de desvanecido |
| tinta de alto contraste | color del título y los paneles |
| `scene_overview.style` / mood | densidad y TIPO de partícula (nieve/ceniza/polvo) |
| textos sugeridos | título + ~15 slots de texto (tags, versos, paneles) |
| `embedded_text` → keepOut | reposicionar slots si la imagen ya trae texto |

## 4. Qué hay que construir (el refactor, en orden)

1. **CONFIG raíz**: `{ media:{subject, audio}, palette:{accent, silver, dust},
   texts:{title, subLabel, cornerTags[4], verses[2], manifesto, panels[4], track},
   ambient:{type, density} }`.
2. **Un solo asset de imagen**: el fondo YA puede generarse desde el mismo PNG/imagen
   (el prototipo lo insinúa usando dos URLs) — declarar solo `subject` y derivar el
   fondo con los filtros.
3. **Eliminar el cursor de cursors-4u.net** (CDN muerto, irrelevante en video).
4. **Nieve a canvas**: 60 divs DOM funcionan, pero el mini-canvas del PROSPECTO-1
   es más barato y permite densidad/tinte por CONFIG (nieve → ceniza → polvo según
   mood).
5. **Slots con límites**: los ~15 textos necesitan límite de caracteres por slot
   (validación en el Prompt 2) para no romper la composición.

## 5. Qué agregarle

- **Reveal de entrada**: fade escalonado por capa (fondo → sujeto → título → tags)
  para que funcione como intro de video (2–3s) antes del loop.
- **Título con acento extraído**: text-shadow del título en el color más saturado
  del sujeto.
- **Audio + respiración**: un AnalyserNode ligero (patrón index6.1) que haga
  respirar el título y la opacidad de la nieve con el bajo — hoy no tiene nada.
- **Variante 9:16 nativa**: las posiciones vh/vw aguantan, pero los paneles laterales
  deben re-apilarse en vertical (mismo patrón banda del motor v9).

## 6. Riesgos a resolver

- Dropbox/cubeupload/Google Fonts por CDN → assets locales.
- `mask-image` + `blur(12px)` verificados OK en Chromium headless (misma técnica
  que ya usamos en v6-v9).
- PREV/NEXT del reproductor son spans muertos → quitar o cablear.

## 7. Veredicto

**El "quick win" del sistema**: es el prospecto que antes puede estar produciendo
piezas reales, y su patrón (sujeto recortado + auto-fondo + capa tipográfica) es la
base visual de la mitad de las referencias del género. Ideal como SEGUNDA plantilla
en producción después de PROSPECTO-1, y como esqueleto para probar el motor de
letras cinéticas sin física de por medio.

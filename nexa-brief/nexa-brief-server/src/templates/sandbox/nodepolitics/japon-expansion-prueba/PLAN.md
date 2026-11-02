# Expansión del Imperio japonés · prueba de 2 minutos (Desktop)

## 1. Alcance

Prototipo para Sandbox, basado en el lenguaje visual de los primeros 30 s de `nodepolitics/imperio-demo` (atlas azul grisáceo,
sol carmesí sobre Japón, rayos, título condensado), con **video en vez de fotos** de archivo. Del par de referencias
(*¿Por qué existe un conflicto entre Rusia y Japón?* y *¿Por qué Japón atacó Pearl Harbor?*) se tomó: flechas que muestran hacia
dónde va cada avance, banderas redondas sobre el país afectado y la coordinación de la voz con el mapa (cada flecha llega en la
palabra exacta). Cuenta **solo cómo se expandió el Imperio japonés** (1868–1942). Duración: 120,1 s. No se grabó ni se publicó video.

## 2. Enfoque

Una cronología de anexiones, ocupaciones y campañas. Las flechas indican dirección, no fronteras. **China no se muestra conquistada**:
solo la costa y ciudades con flechas, y la bandera de la República de China como Estado que resistió. Termina en 1942, en la máxima
extensión; no cuenta la derrota. Tono neutral: verbos de hechos (anexó, ocupó, atacó), sin adjetivar.

## 3. Hechos y fuentes

Verificado en la fuente durante esta sesión (texto leído):

- Tratado de Portsmouth, 1905: Rusia cede el sur de Sajalín y se afirma la presencia japonesa en Corea y el sur de Manchuria. [Office of the Historian, Portsmouth Treaty](https://history.state.gov/milestones/1899-1913/portsmouth-treaty)
- 1940–41: acuerdo con la Francia de Vichy que permite a Japón entrar en Indochina y empezar su avance al sur; EE. UU. responde con embargo. [Office of the Historian, Road to Pearl Harbor](https://history.state.gov/milestones/1937-1945/pearl-harbor)

Heredados del plan anterior (fuentes comprobadas en línea, contenido no releído hoy):

- Shimonoseki, 1895: cesión de Taiwán y las Pescadores. [Taiwan Archives Online](https://archives.ith.sinica.edu.tw/collections_con2_en.php?no=175)
- Anexión de Corea, 1910. [FRUS 1910, tratado](https://history.state.gov/historicaldocuments/frus1910/d705)
- Incidente de Mukden (1931) y Manchukuo (1932). [Office of the Historian, Mukden Incident](https://history.state.gov/milestones/1921-1936/mukden-incident)
- Puente Marco Polo (1937) y guerra a gran escala con China: misma página «Road to Pearl Harbor».
- Avances de 1941–42 por el Pacífico y el Sudeste Asiático. [Imperial War Museums](https://www.iwm.org.uk/file-download/download/public/3421) (el sitio bloquea descargas automáticas: **releer a mano**).

**Por verificar con fuente antes de producción** (hechos del guion que se dan por conocidos pero sin cita en esta sesión):
restauración Meiji en 1868 y modernización militar; victoria sobre China en 1894–95; ocupación de las islas alemanas del Pacífico en
la Primera Guerra Mundial y mandato de la Sociedad de Naciones; caída de Guam y Wake en diciembre de 1941; Singapur, Indias Orientales
Neerlandesas y Birmania «en pocos meses» de 1942; el petróleo, el caucho y el estaño como objetivo del avance al sur; máxima extensión
a mediados de 1942, «de las islas Aleutianas a Nueva Guinea».

## 4. Guion (assets/script.json)

13 segmentos, 254 palabras, voz Charon, 135 ppm, WER ≈ 0,008. La voz tarda 112,9 s; con la entrada y la cola de cierre el audio dura 120,1 s.

## 5. Dirección visual

**Cámara (2026-11-01):** conserva sus movimientos (alejamiento de la apertura, empuje del plano de archivo, vuelos entre destinos). Lo que se
corrigió fueron los **tirones y pausas** que tenían: causas en el motor, corregidas en `engine/kit.js` y `designs/imperio/components/_imperio.js`
(ver `designs/imperio/DESIGN.md` § «Fluidez de la reproducción»).

- **0–10 s · `imperio.title`**: atlas que se aleja, sol, rayos al sur, kanji 日本帝国 con «IMPERIO JAPONÉS», título «EXPANSIÓN JAPONESA».
- **10–20 s · `imperio.footage`**: atlas en gris y **video de la bandera de Japón** fundido en multiplicar; sobre él `imperio.word` «RESTAURACIÓN MEIJI · 1868».
- **20–120 s · `imperio.campaign`** (un solo plano continuo): la cámara vuela entre encuadres (`cameras`); del sol salen flechas gruesas
  que llegan en la palabra de la voz (`time: "@palabra"`); al llegar, el territorio se marca en carmesí y aparece su **bandera en un círculo**
  con nombre; el año queda de sello arriba a la izquierda. Tres tramos de video de archivo (`plates`, con empuje lento, recortados sin franjas negras y a 1280 px) se funden con el atlas.
- Cierre con `imperio.word` «MÁXIMA EXTENSIÓN · 1942» y el cierre automático del diseño.

Banderas (SVG locales, simplificadas, del Estado de cada etapa): Qing (Taiwán 1895), Rusia (Sajalín 1905), Imperio de Corea (1910),
Imperio alemán (islas 1914), República de China (Manchuria 1931 y China 1937), Manchukuo (1932), Francia (Indochina), EE. UU. (Pearl Harbor, Guam),
Reino Unido (Malaya, Birmania), Mancomunidad de Filipinas (Filipinas) y Países Bajos (Indias Orientales).

## 6. Componentes propios (assets/components/japon.js)

| componente | usos | qué hace |
|---|---|---|
| `imperio.campaign` | 1 | plano continuo de mapa: cámara con vuelos, flechas sincronizadas, territorios, banderas, sello de año, tramos de video |
| `imperio.footage` | 1 | como `imperio.archive` pero con video mudo en blanco y negro |

## 7. Medios

4 clips en `assets/media` (ver `work/results/clips.md` y `CREDITS.md`) y 11 banderas en `assets/flags`.
**Faltan** clips de la Armada Imperial, de Pearl Harbor y de Malaya en 1941–42 con licencia libre. Los de Java (1942–43) se rotulan como tales.

## 8. Verificación

- `kit.py voice`: Charon, 135 ppm, sin palabras faltantes. `kit.py transcribe`: 220 palabras con tiempos reales, 120,1 s.
- `kit.py check`: OK, 0 errores. Avisos: título inicial de 10,2 s (sigue el demo), 0 `common.lyric` (el mapa lleva la información) y el ancla «máxima» salta 170 palabras (es el cierre).
- `kit.py components`: 2 componentes registrados, 0 errores.
- Revisión visual en 16:9 y 9:16 con capturas en cada llegada de flecha (`shoot.py`, `kit.py sheet`): banderas correctas, etiquetas dentro del cuadro.
- No se renderizó ni publicó video. No se probó la reproducción en vivo en un navegador de escritorio (solo capturas con seek).

## 9. Qué falta para producción

Verificar los hechos de §3 «por verificar»; conseguir metraje de la Armada y de 1941–42; decidir si `imperio.campaign` se promueve al diseño
`imperio` (`designs/imperio/components/extra.js`); revisar la cola de cierre con voz del canal (`kit.py outro`); render opcional.

## 10. Decisiones y límites

- `imperio.campaign` pasó por 4 pasadas del control (la guía pide máximo 2): se rediseñó de un beat por destino a un plano continuo por la política de repetición.
- Polígonos de Manchuria, Sajalín sur e islas del Pacífico son aproximaciones de trabajo, no catastrales.
- El video de la bandera es un stock moderno (Pixabay), no metraje histórico.
- La versión anterior (47 s) quedó en `work/v1/`. Los clips originales sin recortar, en `work/media-orig/`.
- Fluidez: se midió en reproducción real (`tools/perf_check.py` y perfiles de CPU). En esta plantilla, 62 s de reproducción pasaron de 3 pausas
  (342, 408 y 568 ms) a 1 de 132 ms, y la irregularidad del tiempo de 0,40 a 0,01–0,06. Medido en un servidor sin GPU.
- Codex `gpt-6.1-sol` midió el movimiento de la cámara en una versión intermedia con cámara fija (SIFT + RANSAC): `work/archivo-camara-fija/`.
- Los clips de archivo se redujeron (≤ 1280 px) y se recortaron sin franjas negras; los originales están en `work/media-orig/`. Copias del motor
  anterior en `work/engine-backup/` (`kit.js.orig`, `_imperio.js.orig`).

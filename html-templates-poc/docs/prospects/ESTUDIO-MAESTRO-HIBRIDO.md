# ESTUDIO MAESTRO: ARQUITECTURA DE LA META-PLANTILLA v11 (SÍNTESIS HÍBRIDA DE NEXA-BRIEF)
### Unificación de los 5 Prospectos Visuales, Motores de Dopamina/Adrenalina y Control por Sección en una sola Pieza de Software

**Autor:** Antigravity AI  
**Fecha:** Julio 2026  
**Ámbito:** Investigación, Arquitectura y Dirección Técnica de Código  
**Base de Estudio:** `PROSPECTO-1` a `PROSPECTO-5`, `PROSPECTO-TOTAL`, `PROSPECTO-DOPAMINA` y `PROSPECTO-ADRENALINA`.

---

## 1. EL DESAFÍO DE LA FRAGMENTACIÓN: POR QUÉ UNA META-PLANTILLA

Hasta ahora, el pipeline de Nexa-Brief consideraba plantillas HTML aisladas para cada género musical o estilo visual (ej. `p1-escena.html`, `p4-aura.html`, `pt-edicion.html`). Mantener 5 bases de código distintas introduce redundancia, dificulta la depuración de errores en grabación headless y requiere prompts de inyección (Prompt 2) personalizados para cada caso.

### La Solución: Meta-Plantilla v11 (Unified Composition Engine)
Proponemos unificar toda la lógica en un **único archivo maestro HTML** modular. A través de un `CONFIG` unificado, esta plantilla puede "mutar" instantáneamente de comportamiento, cargando solo los componentes requeridos:

```
                          ┌───────────────────────────┐
                          │   CONFIGURACIÓN RAÍZ v11  │
                          └─────────────┬─────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
     [ Ambient Engine ]         [ Filter Engine ]          [ Typography Engine ]
     (Sakura, Nieve,            (Luminosity blend,         (Haikus, Kinetic Lyrics,
      Brasas, Lluvia)            Spotlight Mask, Tinte)     Ghost word behind)
             │                          │                          │
             └──────────────────────────┼──────────────────────────┘
                                        │
                                        ▼
                          ┌───────────────────────────┐
                          │    Visualizer / Audio     │
                          │   (Sub-bass scale/bounce) │
                          └───────────────────────────┘
```

---

## 2. ARQUITECTURA DE LOS 6 MÓDULOS DE RENDERIZADO

La meta-plantilla se compone de 6 subsistemas que se activan mediante banderas booleanas o selectores de modo en el `CONFIG`:

### A. Módulo de Fondo (Background & Layout)
* **Funcionalidad**: Administra el lienzo de la escena. Soporta el modo `solid`, regiones multipunto (`regions`), desenfoque underlay (`blur`), y la derivación automática de fondo a partir del sujeto (`auto-fondo` del Prospecto 3).
* **Control de Costura**: El desvanecido de bordes (`edgeFade`) actúa sobre el eje libre, adaptándose si es un lienzo vertical 9:16 o si se recorta a horizontal mediante `content_box_px`.

### B. Módulo de Filtros y Revelado (Filters & Spotlight)
* **Funcionalidad**: Controla el tinte neón (Prospecto 2) y la máscara de spotlight radial (Prospecto 4).
* **Mecánicas**:
  * *Tinte Luminosity*: Convierte el PNG del sujeto a escala de grises y lo fusiona con el degradado trasero mediante `mix-blend-mode: luminosity`.
  * *Radial Spotlight*: Dibuja la máscara Lissajous que revela el color real de la imagen sobre su versión desaturada, escalando el radio con los golpes del bajo (onset).

### C. Módulo de Partículas Ambientales (Ambient Biomes)
* **Funcionalidad**: Un único `<canvas>` de alto rendimiento gestiona la caída física de partículas.
* **Biomas Soportados**:
  * `sakura`: Pétalos curvos con rotación 3D y deriva de viento.
  * `autumn`: Hojas de arce con oscilación amplia.
  * `snow`: Copos flotantes que caen en vertical estricta.
  * `embers`: Brasas incandescentes que suben desde la base con fluctuación de brillo.
  * `dust`: Polvo flotante suspendido que se mueve en Lissajous lento.
  * `rain`: Golas verticales rápidas con rebote en el suelo del viewport.
* **Reactividad**: El viento horizontal y la velocidad de caída responden en tiempo real al análisis del espectro del audio.

### D. Módulo de Física e Inercia (Physics & Parallax)
* **Funcionalidad**: Aplica el rebote al beat (`bass bounce`), la respiración sutil (`breathe`) y el parallax de profundidad.
* **Mecánica**: El wrapper global `#stage` escala y vibra. Si hay separación de capas (imagen de fondo + sujeto PNG), el sujeto recibe un parallax invertido respecto al fondo controlado por mouse o giroscopio.

### E. Módulo Tipográfico (Typography Engine)
* **Funcionalidad**: Posiciona las letras sin pisar al sujeto (usando la lógica `carve` y `bestFit` del motor v9).
* **Variantes de Texto**:
  * *Haiku*: Flujo de texto vertical carácter a carácter.
  * *Kinetic Words (Karaoke)*: Entrada y salida tridimensional elástica de palabras individuales sincronizadas por timestamps.
  * *Giant Ghost*: Nombre/texto gigante en el fondo con opacidad baja que respira al ritmo del bajo.

### F. Módulo de Efectos y Agresión (Glitch & Strobe)
* **Funcionalidad**: Inyecta la estética Phonk/Hype (Prospecto 5).
* **Mecánicas**: Ráfagas de separación cromática RGB, ruido de grano SVG (`feTurbulence`), y strobes de color overlay limitados por el cooldown de seguridad (WCAG 2.3.1) para evitar la fatiga visual.

---

## 3. MODELO DE DATOS UNIVERSAL: CONFIG v11

Este es el esquema JSON que gobierna la Meta-Plantilla, reuniendo todos los parámetros calibrables de los 5 prospectos en una única estructura:

```json
{
  "media": {
    "bg": "bg.jpg",
    "subject": "subject.png",
    "audio": "song.mp3",
    "hasSubjectAlpha": true
  },
  "canvas": {
    "w": 720, "h": 1280, "rotation": 0, "content": [0, 0, 720, 1280]
  },
  "palette": {
    "bg": "#030303",
    "ink": "#F5F2EC",
    "accent": "#FF0055",
    "accentHue": 345,
    "glow": "rgba(255, 0, 85, 0.45)",
    "regions": []
  },
  "modules": {
    "enableAmbient": true,
    "enableSpotlight": false,
    "enableTinteTotal": false,
    "enableAutoFondo": true,
    "enableGlitch": false
  },
  "ambient": {
    "type": "embers",
    "density": 0.45,
    "speed": 0.7,
    "wind": 0.1,
    "colors": ["#FF3300", "#FFaa00", "#551100"]
  },
  "adrenaline": {
    "enableBounce": true,
    "maxBounceScale": 1.05,
    "enableFlashes": true,
    "flashCooldownMs": 380,
    "strobeColors": ["#FF0055", "#ffffff"],
    "epilepsySafe": true
  },
  "typography": {
    "style": "kinetic-lyrics",
    "ghostWord": "AURA",
    "texts": { "left": "STRIKE", "right": "FORCE" }
  },
  "lyrics": [],
  "sections": [
    { "type": "calm", "start": 0, "end": 12.5 },
    { "type": "build", "start": 12.5, "end": 28.4 },
    { "type": "drop", "start": 28.4, "end": 60.0 }
  ],
  "seed": 4096
}
```

---

## 4. SISTEMA DE TRANSICIÓN DE MODOS (ORQUESTACIÓN DINÁMICA)

En lugar de recargar la página, la meta-plantilla cambia de comportamiento a lo largo de la línea de tiempo de la canción. La función `updateActiveMode(currentTime)` modifica las propiedades activas de los módulos basándose en el segmento actual del array `sections[]`:

```
                 [ LÍNEA DE TIEMPO DE LA CANCIÓN ]
┌─────────────────────┬─────────────────────┬─────────────────────┐
│    0s - 12s         │    12s - 28s        │    28s - 60s        │
│    INTRO / Calm     │    VERSO / Build    │    CORO / Drop      │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ • Bioma: Sakura     │ • Bioma: Sakura     │ • Bioma: Brasas     │
│   (lento, 0.3)      │   (acelerado, 0.6)  │   (denso, 0.9)      │
│ • Parallax sutil    │ • Tinte Total ON    │ • Glitch / RGB-split│
│ • Letra: Fade-in    │ • Letras: Pop       │ • Letras: Glitch-Pop│
│ • Bounce: OFF       │ • Bounce: ON (1.03) │ • Bounce: ON (1.06) │
│ • Flashes: OFF      │ • Flashes: OFF      │ • Flashes: ON (drop)│
└─────────────────────┴─────────────────────┴─────────────────────┘
```

Esta dinámica asegura la dosificación del estímulo visual:
* **70% de la pieza**: Reposo y acumulación de tensión (Dopamina/Anticipación).
* **30% de la pieza**: Descarga de energía visual coordinada (Adrenalina/Clímax).

---

## 5. OPTIMIZACIÓN HEADLESS Y DETERMINISMO DE GRABACIÓN

Para garantizar que la grabación a través de Playwright + FFmpeg ocurra a **60 FPS estables y sin pérdida de fotogramas**, la meta-plantilla adopta tres reglas estrictas de renderizado:

1. **Evitar filtros dinámicos sobre elementos DOM gigantes**: Animar `filter: blur()` o `filter: brightness()` en cada cuadro fuerza al navegador a repintar toda la pantalla en la CPU. Para destellos y flujos de color, se utiliza un overlay `<div id="overlay-strobe">` en la capa superior animando únicamente su `opacity` (cuyo procesamiento ocurre al 100% en la GPU).
2. **Semilla de Ruido SVG determinista**: El filtro de glitch utiliza un elemento `<feTurbulence>`. Para evitar que el ruido cambie de forma errática en cada frame (causando saltos visuales en la compresión de video), se fija la propiedad `seed` y se modifica de forma matemática determinista en base a los índices de los beats pre-computados en el `beats.json`.
3. **Control total del reloj en la captura Headless**: La plantilla expone un hook global `window.setPlaybackTime(seconds)`. El script de grabación de Playwright puede congelar el reloj real del navegador y avanzar la animación cuadro por cuadro:

$$\text{frameInterval} = \frac{1}{60} \text{ segundos}$$

Esto elimina cualquier caída de frames por retrasos de hardware, asegurando un archivo `.mp4` de salida de calidad premium de televisión.

---

## 6. VEREDICTO Y ROADMAP DE INTEGRACIÓN

La **Meta-Plantilla v11** es la consolidación madura de toda la investigación acumulada en Nexa-Brief. Evita la proliferación de archivos HTML redundantes y crea una única plataforma visual robusta.

### Fases de Implementación Recomendadas:
1. **Refactor modular**: Desarrollar la estructura base de la plantilla (los módulos de partículas Canvas y tipografía) y validar su aislamiento en un HTML de prueba.
2. **Implementación de la Orquestación**: Cablear el detector de secciones de tiempo de audio para verificar las transiciones en caliente de los módulos (ej. pasar de Sakura a Brasas al cambiar de sección).
3. **Mapeo de Visión Extendido**: Ajustar el Prompt 1 de la IA de visión para que el JSON de salida coincida con los campos del CONFIG v11 (extrayendo el tipo de bioma e indicando si la imagen cuenta con canal alfa).

# GUÍA MAESTRA DE INSPIRACIÓN Y BÚSQUEDA: LA EDICIÓN KINÉTICA EN WEB
### Cómo encontrar, replicar y superar los mejores conceptos visuales interactivos usando HTML, CSS, JS y WebGL.

Esta guía recopila los términos de búsqueda exactos, las plataformas clave, las librerías indispensables y las técnicas avanzadas que te permitirán diseñar plantillas web de nivel profesional (como `neon-letras-V3.html`), llevando "La Edición" al límite absoluto.

---

## 1. DÓNDE BUSCAR INSPIRACIÓN (PLATAFORMAS CLAVE)

### A. CodePen (El Laboratorio de Prototipos de Código)
CodePen es la fuente número uno de fragmentos de HTML/CSS/JS aislados y experimentales.
* **Cómo buscar**: Filtra por "Popular" o "Picked" y usa términos específicos en inglés.
* **Colecciones recomendadas**: Busca colecciones curadas con el nombre "Kinetic Typography", "Audio Visualizer", "Text Effects CSS".
* **Ejemplos a buscar**: "Seeded random placement text", "Neon flickering text", "CSS 3D perspective scrolling".

### B. ShaderToy (El Santo Grial de los Filtros de GPU)
ShaderToy contiene los shaders de fragmentos (fragment shaders) más rápidos y complejos del mundo, ejecutados directamente en la tarjeta gráfica. Muchos responden a frecuencias de audio.
* **Cómo buscar**: Filtra por "Audio" o busca "Audio Reactivity", "CRT Monitor Effect", "RGB Glitch Shift", "Neon plasma".
* **Utilidad**: Los códigos matemáticos de ShaderToy se pueden portar a Canvas WebGL para usarse de fondo en tus videos.

### C. Awwwards / The FWA (El Estado del Arte de la Web Comercial)
Muestra sitios web reales con presupuestos millonarios que usan WebGL y tipografías fluidas.
* **Filtros recomendados**: Busca en las categorías "WebGL", "Animation", "Typography", "3D".
* **Estilos**: Observa cómo interactúa el cursor del usuario con las letras y cómo reaccionan las tipografías al hacer scroll.

---

## 2. GLOSARIO DE TÉRMINOS DE BÚSQUEDA EFECTIVOS (KEYWORDS)

Para encontrar el código y las ideas más modernas, debes buscar en **inglés**. Estos son los conceptos clasificados por su efecto visual:

| Efecto Visual | Qué buscar en Google / CodePen / YouTube |
|---|---|
| **Tipografía en Movimiento** | *Kinetic typography JS*, *WebGL text distortion*, *HTML5 canvas text physics*, *SVG liquid text effect*, *Elastic bounce text animation*. |
| **Estética Ciberpunk y Neón** | *CSS neon flicker steps*, *Glow text-shadow performance*, *CRT scanline screen shader*, *Vector outline text CSS*, *Flickering light animation*. |
| **Cámaras y Perspectivas 3D** | *CSS 3D perspective typography scroll*, *Three.js camera path text*, *Z-axis text fly-through*, *Parallax typography layers*. |
| **Interactividad con Audio** | *Web Audio API visualizer frequency*, *Audio-reactive canvas particles*, *Sub-bass scaling animation*, *FFT audio react CSS*. |
| **Texturas y Filtros Orgánicos** | *SVG feTurbulence film grain*, *Luminosity blend mode CSS*, *RGB split chromatic aberration canvas*, *Displacement map wave text*. |

---

## 3. EL STACK TECNOLÓGICO PARA CREACIÓN KINÉTICA

Si quieres superar la maquetación CSS básica y saltar al renderizado en tiempo real de alto impacto, estas son las librerías que debes investigar y dominar:

```
                            ┌────────────────────────┐
                            │    TECNOLOGÍAS WEB     │
                            └───────────┬────────────┘
                                        │
             ┌──────────────────────────┼──────────────────────────┐
             ▼                          ▼                          ▼
     [ RENDERIZADO 2D ]        [ RENDERIZADO 3D ]         [ MOTORES DE ANIMACIÓN ]
     • PixiJS (Ultra-rápido)   • Three.js (Cámaras 3D)    • GSAP (Timelines elásticos)
     • Canvas 2D nativo        • BabylonJS                • Anime.js (Ligera, grids)
```

### A. GSAP (GreenSock Animation Platform)
Es el estándar de la industria para animaciones complejas.
* **Por qué buscarlo**: Trae plugins como **SplitText** (separa textos en caracteres o palabras automáticamente) y permite secuenciar movimientos mediante *Timelines* con curvas elásticas perfectas (`elastic.out`).
* **Búsqueda clave**: `"GSAP kinetic text animation"` o `"GSAP scrolltrigger typography"`.

### B. PixiJS (Renderizado 2D en WebGL)
* **Por qué buscarlo**: Es extremadamente rápido. Te permite aplicar **Displacement Maps** (mapas de desplazamiento). Puedes hacer que el paso de una canción (el bajo) genere ondas físicas sobre las palabras, haciéndolas flotar, derretirse o distorsionarse como agua.
* **Búsqueda clave**: `"PixiJS displacement filter text hover"` o `"PixiJS audio reactive typography"`.

### C. Three.js (Tipografías 3D Reales)
* **Por qué buscarlo**: Te permite crear geometría tipográfica 3D real (`TextGeometry`) en un espacio tridimensional. Puedes programar una cámara que vuela a través de las palabras de la canción a medida que son cantadas, similar a un videoclip en 3D.
* **Búsqueda clave**: `"Three.js text geometry shader distortion"` o `"Three.js audio reactive camera fly"`.

---

## 4. IDEAS DE EDICIÓN MÁS ALLÁ DEL NEÓN (NUEVOS PROSPECTOS)

Aquí tienes ideas de conceptos visuales avanzados listos para ser implementados en código:

1. **ASCII Art Video Reactivo**:
   * *Concepto*: El video del fondo del artista se convierte en tiempo real en texto (caracteres ASCII de colores). Las letras de las canciones se renderizan en una capa superior en tamaño gigante, borrando o distorsionando las letras ASCII de atrás cuando golpea el bajo.
   * *Búsqueda recomendada*: `"HTML5 canvas video to ASCII converter"`.
2. **Campos de Fuerza de Partículas (Flow Fields)**:
   * *Concepto*: Un lienzo lleno de millones de pequeñas partículas de polvo que fluyen por la pantalla. Cuando una palabra de la letra aparece, actúa como un "imán" o "colisionador", atrayendo las partículas para que dibujen la forma de la palabra y luego explotando con el bombo.
   * *Búsqueda recomendada*: `"HTML5 canvas text particle physics fluid flow"`.
3. **Tipografía Líquida / Metaballs**:
   * *Concepto*: Las letras parecen de mercurio líquido. Cuando dos palabras se acercan, se fusionan de forma orgánica (como gotas de agua) antes de separarse de nuevo.
   * *Búsqueda recomendada*: `"CSS SVG filter metaballs typography"`.
4. **Barridos de Foco en Máscaras de Texto**:
   * *Concepto*: La pantalla está completamente negra. La única forma de ver la imagen o video del fondo es "a través" de los contornos de las letras de la letra que se está cantando, los cuales se agrandan y achican con la voz.
   * *Búsqueda recomendada*: `"CSS mask image text clipping video background"`.

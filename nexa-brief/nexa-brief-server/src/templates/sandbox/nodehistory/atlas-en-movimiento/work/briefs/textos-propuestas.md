# Brief · textos-propuestas (Sol 6.1 high) — 3 VERSIONES NUEVAS del diseño de TODO el texto del video

## Pedido del usuario (literal)
«Dar otras 3 versiones. El subtítulo mucho más pequeño como se ve en desktop y en móvil, pero quiero un 25 % más pequeño. Quiero otros colores más profesionales, acorde a otro diseño. Lo mismo con todos los demás. No me gusta cómo están: es un diseño muy genérico. Podemos jugar con negro y blanco, o con otros colores más profesionales, y no estos colores genéricos.»
Lo que el usuario YA rechazó (no lo repitas ni lo acerques): texto **crema/amarillo `#f6edb4` con contorno negro grueso** (transcripción), **cajas azul oscuro con borde fino crema** para todos los rótulos, el **rosa/rojo** de «FRENTE · aproximado», la tarjeta crema con octógono azul. «Muy IA, muy genérico, de mala calidad».

## Qué entregar
Una página nueva **`diseno-textos-propuestas.html`** (raíz del prototipo; servida por `http://192.168.20.2:8000/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/diseno-textos-propuestas.html`; no sobrescribas `diseno-textos.html`, que otra tarea está rehaciendo) con **4 pestañas: ACTUAL, A, B, C**. Cada pestaña muestra **TODOS** los estilos de texto del video (lista en `work/texto/INVENTARIO.md` y `textos-literales.md`): transcripción, chip de fecha, leyenda, nombre de unidad o instalación, callout con línea guía, país en grande (IRÁN/IRAK), año gigante, cifra, etiqueta de frente, chip de ruta, crédito del mapa,
pie de retrato (nombre, cargo, fecha, crédito), tarjeta de documento o prensa, pie de foto, título de intro y cierre del canal. Cada uno con SU animación (entrada y salida, y la transcripción palabra a palabra), con texto REAL del video.

### Reglas de la página (las mismas que ya pidió el usuario)
SOLO texto sobre fondo LISO (sin mapas, sin imagen satelital, sin cuadros del video). **En GRANDE** (≥ 2,5× el tamaño real), con la **ficha de color a la vista**: recuadros de color con el hex escrito para relleno, contorno, fondo de caja, borde y acento, más fuente, tamaño y grosor. Selector de fondo liso (oscuro, negro, claro). Animaciones solas en bucle (sin botón de reproducir) y con «Repetir».

### La TRANSCRIPCIÓN (lo más importante)
- **25 % más pequeña que la actual** (actual: 45 U sobre 1080 de ancho → propuesta ≈ 34 U). Compruébalo con números en la ficha («actual 45 U, propuesta X U, −25 %»).
- Muéstrala **en móvil (vertical 540×960 px CSS) y en desktop (horizontal 1920×1080)** a la vez, con maqueta de pantalla sobre fondo liso, para que se vea cómo queda de verdad en cada formato (posición vertical, ancho máximo, palabras por línea, interlineado).

### Las 3 propuestas (A, B, C): distintas entre sí, NO genéricas, NADA de rojo ni rosa, NADA del crema+navy actual
- **A · Blanco y negro**: monocromo estricto (blancos y negros con una escala de grises muy cuidada), sin color de acento; jerarquía por peso, tamaño y espaciado, no por colores.
- **B y C**: dos paletas profesionales **distintas** entre sí y de A (elígelas tú con criterio de diseño de motion graphics/documental/cartografía; por ejemplo tintas oscuras y papel hueso con UN acento metálico apagado, grafito con un acento frío, verde botella con arena, etc.). Cada una con 2 o 3 colores como máximo más neutros, justificados en la ficha.
- **Distinto diseño, no solo otros colores**: cambia la **estructura** de los rótulos (no «caja con borde fino»): p. ej. regla fina y texto alineado a la izquierda, etiqueta de relleno sólido compacta, cinta o barra, tipografía en versalitas con espaciado, número grande con unidad pequeña, línea guía con punto, velo degradado en vez de contorno grueso para la transcripción, etc.
  Una familia tipográfica **diferente** por propuesta (máx. 2 por propuesta): inspecciona las fuentes locales disponibles (`_tools/explainer-kit/vendor/fonts/`, `assets/fonts/`) y, si hace falta, descarga **solo fuentes con licencia OFL** de Google Fonts y guárdalas localmente en `assets/fonts/propuestas/` con su licencia (el video se renderiza sin red).
- Coherencia: dentro de cada propuesta, un sistema (tamaños, espaciados, radios, animaciones con el mismo carácter) aplicado a TODOS los textos.
- **Legibilidad medida**: para la transcripción y los rótulos, calcula el **contraste WCAG** del texto contra cada fondo de prueba y muéstralo en la ficha; sin contornos gruesos «de pegatina».

### Datos listos para aplicar después (NO aplicar al video todavía)
Por cada propuesta: `work/texto/propuestas/<A|B|C>.tokens.json` con todos los valores (colores hex, familias y pesos, tamaños en U, contornos, bordes, radios, sombras, tiempos de animación) en la misma estructura que `caption.transcript` y los `label.*` entienden por sus parámetros (`engine/tactico/components/captions.js`, `labels.js`), de modo que aplicar una propuesta = cargar sus tokens. Un `work/texto/propuestas/LEEME.md` con la idea de cada propuesta en 3 líneas.

## Reglas
Escribir solo en `atlas-en-movimiento/` (página, `assets/fonts/propuestas/`, `work/texto/propuestas/`, `work/texto/capturas/`). No tocar `assets/scene.json`, `assets/mix.mp3`, `_proto/`, `diseno-textos.html`, ni `.py`, ni la web. Sin emojis. No grabar MP4. Carga rápida (< 5 s), sin teselas ni motor de mapa. Un Chromium a la vez, `nice -n 15`.
**Verificación obligatoria**: capturas (1440 px de ancho) de cada pestaña, de la transcripción en móvil y desktop de cada propuesta, y una comparación ACTUAL frente a A, B y C de la transcripción. **Míralas**: si ves rojo/rosa, cajas con borde fino crema, crema+contorno negro, mapas o texto pequeño, la entrega está mal y la corriges. `work/results/textos-propuestas.md`.

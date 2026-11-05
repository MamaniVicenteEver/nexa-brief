# Atlas · cuatro nuevas direcciones tipográficas

Fecha: 2026-11-04. Pedido: reemplazar la dirección visual de texto actual con cuatro propuestas, incluida una de negro, blanco y rojo puros y otra de tonos oscuros.

## Abrir

- [Comparador](../../../diseno-textos-versiones.html)
- [V1 Señal](../../../diseno-textos-v1.html): Inter, negro #000000, blanco #ffffff, rojo puro #ff0000; bandas rectas, títulos fuertes, entrada vertical de 240 ms.
- [V2 Umbral](../../../diseno-textos-v2.html): Manrope, grafito #121217, blanco frío #f5f3ff, lavanda #c4b5fd; placas grafito, composición centrada, aparición de 420 ms.
- [V3 Coordenada](../../../diseno-textos-v3.html): Space Grotesk, azul tinta #081e28, blanco #f0faf7, menta #51f6c7; eje izquierdo, reglas finas, cifras grandes, barrido de 320 ms.
- [V4 Folio](../../../diseno-textos-v4.html): DM Sans, blanco #ffffff, negro #111111, azul #193dff; títulos en caja baja, índices azules, revelado de 360 ms.

## Alcance y uso

Cada propuesta recorre los 29 tratamientos del episodio y cinco complementos de biblioteca del catálogo existente. El medallón sin glifos se identifica como icono. Las cifras de biblioteca usan los nueve explosivos y los helicópteros del ejemplo anterior, separados de las cifras sintéticas del catálogo. No se presentan como nuevos hechos históricos.

La página permite ampliar cualquier muestra, filtrar familias, alternar 16:9 y 9:16, probar sobre el fondo satelital ya existente, pausar, repetir y recorrer los cinco segundos del estudio. Las palabras de la transcripción y sus tiempos se leen de assets/lyrics.json; el estudio no reproduce audio. El fondo satelital es una imagen de contexto, no reproduce el motor de mapas.

Los tamaños de los especímenes se ajustan a la celda y no pretenden ser medidas U originales. Las vistas principales se dibujan a 1280 × 720 o 1080 × 1920 y se escalan visualmente para caber en pantalla. El cambio de fuente, composición y movimiento es deliberado; ninguna propuesta usa contorno, neón ni rebote.

app.js exporta designs, con paleta, peso, familia y movimiento de las cuatro direcciones. Las fuentes variables están en assets/fonts/versiones/ con sus licencias OFL, descargadas del repositorio oficial google/fonts. No se solicita Google Fonts en ejecución.

Estas son propuestas aisladas. No se modifica scene.json, index.html, la transcripción, el audio ni el motor compartido. El enlace de entrada se añade a diseno-textos.html; se conservan las muestras anteriores. No se graba ni se publica ningún video. Para aplicar una dirección al episodio habrá que trasladar sus tratamientos al motor táctico tras elegirla; cambiar únicamente defs.palette no implementaría la nueva composición.

## Verificación

- JavaScript: node --check.
- Navegador: cuatro pestañas y 34 tratamientos por versión; selección y ampliación; filtros; formatos y fondo; sin errores de consola.
- 408 composiciones revisadas por medición de ancho: 34 tratamientos × 4 versiones × 3 tamaños, sin líneas que superen el ancho asignado.
- Revisión visual de las cuatro portadas, transcripción y leyendas; pantalla móvil de 390 px sin desbordamiento horizontal.
- Fuentes locales cargadas: Inter, Manrope, Space Grotesk y DM Sans.
- La animación arranca pausada si el usuario prefiere movimiento reducido y deja de redibujar al pausar.
- No se dispone del desglose real de tokens de esta sesión; no se inventa consumo en usage.json.

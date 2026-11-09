# Brief · identidad-2 (Sol xhigh) · REDISEÑO COMPLETO (la primera entrega fue rechazada)

Antes: solo los puntos 8–9 de ritmo de `work/briefs/_comun.md` (el resto es de componentes del motor y NO aplica).

## Situación
El usuario rechazó TODO lo anterior: «los 3 no me gustaron para nada; el último es más o menos, pero igual no me gustó; es un trabajo muy
mediocre». Está en `identidad/` (solo para que veas qué NO repetir; NO reutilices sus paletas, tipografías, composición ni código). Empieza de cero
en la carpeta nueva `identidad-2/`. No edites `identidad/`, `identidad-opus*/`, `engine/`, `assets/scene.json` ni el `index.html` raíz.

Por qué falló (críticas concretas; evítalas):
1. Las 3 versiones eran casi la MISMA composición con otra tipografía y otro color de acento. No eran 3 direcciones distintas.
2. Texto diminuto: anclas y datos de 24–32 px en un lienzo de 1080 de ancho (a móvil real se ven como 9–11 px). Ilegible. Filetes y bordes de
   1 px casi invisibles. El caption era débil y poco contrastado.
3. Solo se mostró el formato móvil. No se aprovechó el espacio de escritorio.
4. Sensación genérica de «plantilla»: cajas finas con texto pequeño, kicker arriba, caption abajo, nada con carácter. Sin jerarquía real: todo
   pesaba parecido y no se entendía qué era lo importante en cada momento.
5. Etiquetas de buques/unidades pequeñas y pegadas al sprite, sin sistema.

## Qué se quiere (palabras del usuario)
> El proyecto es espectacular pero visualmente carece de identidad: muchos colores que no convienen entre sí; hay momentos con muchas cosas en
> pantalla y no se entiende nada. Me gusta el mapa y cómo muestran las animaciones, pero los colores de las letras, las cards donde se muestran
> las letras, las flechas, todo está desordenado (amarillos, blancos, azules, sin distinción). Quiero una identidad visual: colores,
> tipografías, tamaños, bordes. Algo limpio, atractivo, que no llene la pantalla de cosas que no se entienden. Hablaremos de geopolítica,
> guerras, sucesos históricos, batallas. No quiero que parezca generado por IA: quiero algo profesional, al nivel de documentales de miles de
> millones de presupuesto. Haz el estudio y crea la identidad visual: colores, tipografías, posiciones. Las letras que acompañan a los barcos
> también quiero cambiarlas. Toda la identidad coherente en todo el sistema para mostrar cosas importantes. El rojo actual no me gusta.
> Muéstrame solo lo esencial, no todo el sistema: unos 30 segundos de video. Primero la planificación; luego cambiamos todo en la plantilla.
> Ahora además: que se vea en móvil y en escritorio, con un botón para cambiar entre ambos, y quiero que se rediseñen los 3.

No hay paleta ni tipografía dadas: decides TÚ como director de arte. Pero cada una de las 3 debe ser una dirección DISTINTA en estructura y
carácter, no solo en color (por ejemplo distinta lógica de ubicación del texto, distinta jerarquía, distinto lenguaje de contenedor/línea,
distinta densidad, distinta personalidad). Documenta en `identidad-2/PLAN.md` la idea de cada una en 3–5 líneas y por qué conviene a geopolítica/guerra/historia.
Conserva lo que le gusta: el mapa satelital, la cámara y las animaciones (ritmo de entradas/salidas).

## Estudio previo (obligatorio, antes de diseñar)
- Lee `REFERENCIAS.md` y mira las imágenes de `work/ref/` (las referencias de mapas tácticos que inspiran la plantilla).
- Lee `engine/tactico/components/{labels,captions,editorial,intro,territory,naval,sites,routes}.js` (los que existan), `work/texto/INVENTARIO.md`.
- Mira varios fotogramas actuales en `work/escena/cuadros/` (002.70, 030.00, 074.50, 111.75, 129.50, 163.90, 195.50).
- Anota en `PLAN.md` el diagnóstico real y los principios que adoptas (máximo de elementos simultáneos, jerarquía de 3 niveles de importancia,
  cómo se distingue un bando de otro sin banderas, cómo se marca lo importante).

## Criterios de legibilidad (obligatorios)
Lienzo móvil 1080×1920 (se ve a ~390 px de ancho real, factor 0,36): texto de rótulo ≥ 40 px, datos/créditos ≥ 30 px, narración ≥ 54 px,
títulos ≥ 110 px; trazos de línea y bordes ≥ 3 px. Lienzo escritorio 1920×1080 (se ve a ~1200 px, factor 0,62 o más): rótulo ≥ 34 px, datos ≥
26 px, narración ≥ 46 px. Contraste AA mínimo contra el mapa real (mide o usa scrim/panel donde haga falta). Máximo 3 textos de primer plano.

## Entregable: `identidad-2/index.html` (autocontenido salvo `identidad-2/assets/`), español, SIN emojis
1. **Botón MÓVIL / ESCRITORIO** muy visible que cambia el formato de todas las simulaciones (9:16 ↔ 16:9). Por defecto escritorio si la
   ventana es ancha. Todo es función pura de un reloj único `t` (reproducir/pausa, scrub, bucle, `0:00 / 0:30`).
2. **Selector de dirección**: «Las tres» (comparación lado a lado en el formato elegido) / D1 / D2 / D3 a tamaño grande.
3. **Simulación de 30 s** (0–30 s del episodio) por dirección, con contenido real y MISMO en las tres (ver hitos abajo). En ESCRITORIO 16:9 el
   diseño es distinto al de móvil, pensado para el formato: aprovecha el espacio (márgenes, bandas laterales/inferiores, guías hacia el objeto) para
   que los nombres de buques, unidades, lugares y datos expliquen SIN tapar lo que ocurre en el mapa. En móvil, nada tapa al sujeto principal.
4. **Hoja de componentes** por dirección y por formato: todas las piezas con nombre (rótulo de buque/unidad, de lugar, de dato, fecha/kicker,
   cifra, nombre de territorio, línea de frente, ruta, retrato con cargo y crédito, documento con foto, narración, título de intro, cierre,
   iconos, flechas, retículas, tinte de bando), más paleta con hex, escala tipográfica y bordes.
5. **Antes / después** en t≈2,7 y t≈28 (fotogramas actuales `work/escena/cuadros/002.70.png` y `030.00.png` frente a cada dirección).
6. **Reglas** del sistema (pocas líneas) y botón de guías de zona segura (interfaz de TikTok/Reels en el último 22 % en móvil).
7. Pie visible y discreto: «Propuesta generada por Codex gpt-6.1-sol (esfuerzo xhigh)».
8. Responsive: la página se ve bien en un portátil de 1440 px y en un móvil de 390 px.

Hitos reales de los 30 s (textos de `assets/scene.json`, `work/texto/INVENTARIO.md`; palabras del caption de `assets/lyrics.json`; NO inventes):
0–5,2 intro sobre el Golfo: título «LA GUERRA DE LOS PETROLEROS», «ATLAS EN MOVIMIENTO», «1987», «Golfo Pérsico · 1980–1988», fecha «24 JUL 1987 · AL
OESTE DE FARSI» desde 1,17 s, buques Bridgeton + USS Fox/Kidd/Crommelin; 6,1–10: «Frank C. Seitz, Jr. · capitán del Bridgeton»; 14,9–18,9: «El mercante
sobrevive»; 19,45–23,2: «Las escoltas siguen su estela»; 23,45–27: «Siete años antes»; 26,4–30: «SEPTIEMBRE DE 1980», IRÁN / IRAK, retratos de Sadam Husein y
Ruhollah Jomeini con cargo y crédito, «FRENTE · aproximado»; caption durante todo el tramo.

## Insumos (ya existen en `identidad/assets/`; cópialos a `identidad-2/assets/` y complétalos)
Placas de mapa 9:16 sin texto (`placa-golfo.jpg`, `placa-golfo-b.jpg`, `placa-irak-iran.jpg`), `territorios-irak-iran.svg`, `sprites/`, `fonts/`, `antes/`,
`captions.json`. Para ESCRITORIO necesitas placas 16:9 de 1920×1080 limpias (mismo look del motor): genéralas con el motor (`engine/plano/plano.js`, mira
`identidad/work/tools/` y `identidad/work/plates-engine.html` donde ya hay un método que funciona) o con las teselas de `../_atlas/cache/gibs-bluemarble`,
con encuadres equivalentes a cada hito, y el SVG de territorios en esa pose. Tipografías libres (OFL) en `assets/fonts/` con `@font-face`: baja las que
uses (github.com/google/fonts o @fontsource en jsDelivr); la página no debe depender de internet; verifica que TODAS cargan (en la entrega anterior
varias quedaron «unloaded»).

## Verificación obligatoria
Chromium con UNA página y `nice -n 15`. Captura 6 instantes (t=2,7; 6,5; 16; 21; 24,5; 28,5) de las 3 direcciones en MÓVIL (540×960) y en ESCRITORIO (1280×720)
a `identidad-2/work/shots/`, y hojas de contacto en `identidad-2/work/sheets/`. MIRA las imágenes con ojo crítico de director de arte: ¿se entiende en 1 s qué
es lo importante?, ¿se lee a tamaño real?, ¿las 3 se ven realmente distintas?, ¿hay algo que parezca plantilla genérica o generada por IA?, ¿se aprovecha el
espacio en escritorio? Corrige y repite hasta que cumplas. Verifica con script que todas las fuentes cargaron y que no hay colores de texto/borde fuera de la paleta
de cada dirección. Captura también la página completa a 1440 y 390 px.

## Entrega
`work/results/identidad-2.md`: archivos, decisiones, aproximaciones frente al motor real, lo que no se cumplió. Escribe solo en `identidad-2/`, `work/` y /tmp.
URL: http://192.168.20.2:8000/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/identidad-2/index.html

## REANUDACIÓN Y RITMO
Servidor compartido (4 núcleos, 11 GB): `nice -n 15`, un solo Chromium a la vez, cierra hijos al terminar cada prueba. Si ya existe algo en `identidad-2/`, revísalo y continúa.

# Brief · identidad-v2v3 (Sonnet 5.5) · corregir la propuesta y dejar solo dos diseños, manejados por JSON

## Qué pasó
Hay una página de propuestas de identidad visual para «Atlas en Movimiento» en `identidad-opus/index.html` (con `PLAN.md`, `assets/`, `work/tools/`).
Tiene 5 versiones (V1 a V5) y un botón para ver en 9:16 y 16:9. Al usuario le molestó MUCHO que en el formato 16:9, sobre todo en V2 Mando, aparezca una barra
lateral (columna/panel) pegada a un lado del video que ocupa cerca del 30 % de la pantalla: tapa el mapa y no es lo que pidió. Quería aprovechar el espacio
horizontal, no ceder un tercio de la pantalla a una columna. Es un error de diseño serio: no lo repitas y no lo disfraces de otra cosa (ni columnas, ni bandas
laterales, ni paneles fijos que roben espacio al mapa). Cuando entregues, di en el informe que lo corregiste.

Respaldo: ya existe una copia intacta de la página anterior en `identidad-opus-respaldo-v5/`. Trabajas EN `identidad-opus/` (la URL que usa el usuario no cambia).

## Qué se quiere ahora
1. Solo quedan dos diseños: **V2 Mando** y **V3 Cine**. Quita V1, V4 y V5 del selector y de la página (el respaldo las conserva).
2. **V3 Cine**: al usuario le gusta como está. Déjalo igual en 9:16. Solo asegúrate de que en 16:9 no haya ninguna barra lateral (usa su composición de bandas de cine, o
   lo que ya tenía, sin columna).
3. **V2 Mando**: en 16:9 quita la barra lateral y vuelve a una composición con los textos SOBRE el mapa, como el diseño de móvil adaptado al formato ancho: más ordenada,
   con tipografías y tamaños de letra bien pensados para pantalla de escritorio, los nombres de buques y unidades junto a su objeto en el mapa (sin lista en columna). El mapa debe
   verse casi entero. En 9:16 se queda como está.
4. **Cambio de color en V2**: el acento naranja pasa a ser un ROJO. Ojo: el rojo que tenía el sistema antes (neón, `#da0000`, rosado `#d1495b`) no le gusta; elige un rojo
   bien resuelto, sobrio y serio, que funcione sobre mapa oscuro. Pero el color tiene que poder cambiarse cuando el usuario quiera sin tocar el HTML (ver punto 6).
5. **Cuadros / paneles de V2**: que se pueda decidir, desde el JSON, si los cuadros (paneles, fichas, fondos de texto) aparecen o no, y con qué opacidad. Por defecto
   deben tener muy poca opacidad (que casi no tapen el mapa) y poder subirse. Lo mismo en V3 si tiene fondos o velos.
6. **Los dos diseños deben vivir en JSON**, porque la idea es que en el sistema solo se cambien los JSON para pasar de un diseño a otro. Crea `identidad-opus/identidades/v2-mando.json` y
   `identidad-opus/identidades/v3-cine.json` con todo lo que define el diseño: colores (incluido el acento), tipografías, escala de tamaños, bordes y radios, posiciones/ranuras para
   móvil y para escritorio, visibilidad y opacidad de los cuadros, tiempos de animación, y lo que haga falta. La página los lee con `fetch` y todo el aspecto se pinta a partir de ellos:
   cambiar un valor en el JSON y recargar debe cambiar la página (por ejemplo el color del acento, `paneles.visible`, `paneles.opacidad`). Diseña el esquema pensando en que más adelante
   el motor del video lo leerá igual. Documenta el esquema y cada campo en `identidad-opus/identidades/LEEME.md` (campo, qué hace, valores válidos, valor por defecto).
7. **Ahora el tramo es de 1 minuto** (0 a 60 s del episodio) en lugar de 30 s, en móvil y en escritorio, un solo reloj, con reproducir/pausa/scrub/bucle y `0:00 / 1:00`. Toma los
   textos, tiempos y palabras de la narración reales de `assets/scene.json`, `assets/lyrics.json` y `work/texto/INVENTARIO.md` (no inventes nada): entre 30 y 60 s hay, por ejemplo,
   la invasión de 1980, el frente, Abadán y su refinería, Jorramchar, el año 1982 y las frases de la narración correspondientes. Para eso necesitarás placas de mapa limpias de esas
   zonas (sin texto), tanto verticales como horizontales: genéralas como ya se hizo (hay herramientas en `work/tools/` y `work/placas-h/`, y el motor en `engine/plano`; las
   capturas y renders se hacen en tu máquina local con una copia del motor para no cargar el servidor). Respeta lo de siempre: máximo 3 textos de primer plano a la vez, y las tarjetas
   de imagen (retratos, fotos, documentos) deben dejar claro quién es, qué es y cuándo.

## Lo que se conserva
Las tipografías, el carácter y las decisiones de V3 Cine; el carácter de V2 Mando (tipografía condensada, datos en mono, retícula). Las zonas seguras del móvil (último 22 %).
No toques `engine/`, `assets/scene.json`, el `index.html` raíz ni las carpetas `identidad`, `identidad-2`, `identidad-opus-2`, `identidad-opus-respaldo-v5`. No grabes MP4.

## Verificación (míralas tú mismo)
Captura en móvil y escritorio varios instantes repartidos en los 60 s (por ejemplo 2,7; 10; 20; 28; 35; 45; 55) de V2 y V3 y revisa a ojo: que en escritorio no haya barra lateral,
que el mapa se vea, que los textos se lean y no se pisen, y que cambiar el acento / la opacidad / la visibilidad de cuadros en el JSON cambie la página (haz esa prueba de verdad y deja
evidencia). Servidor compartido: una sola página de Chromium a la vez; mejor captura en local.

## Entrega
`identidad-opus/index.html` actualizado (pie visible: «Propuesta generada por Claude Opus 5.5 (esfuerzo alto) · ajustada por Claude Sonnet 5.5»), `identidades/*.json`, `identidades/LEEME.md`,
`PLAN.md` actualizado, y `work/results/identidad-v2v3.md` con lo hecho, lo aproximado y lo que no pudiste cumplir.
URL: http://192.168.20.2:8000/api/v1/explainer/files/sandbox/nodehistory/atlas-en-movimiento/identidad-opus/index.html

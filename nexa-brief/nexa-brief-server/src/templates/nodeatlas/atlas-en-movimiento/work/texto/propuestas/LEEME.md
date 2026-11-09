# Tres sistemas para Atlas en Movimiento

## A · Monocromo editorial
Blanco, negro y grises neutros; Barlow 700, de licencia OFL.
Regla horizontal y alineación izquierda; país, cifras y fechas se ordenan por escala y espaciado.
Movimiento vertical corto, sin rebote: entrada 0,32 s y salida 0,24 s.

## B · Grafito / acero
Grafito y un solo acento acero azulado apagado; Fjalla One 400, de licencia OFL.
Cinta sólida con pestaña lateral, composición compacta y cifras con unidad menor a un lado.
Deslizamiento lateral de 14 U: entrada 0,28 s y salida 0,22 s.

## C · Archivo / verde botella
Verde botella, papel casi blanco y salvia mineral; EB Garamond 700 con Open Sans 700 para metadatos, ambas OFL.
Serif documental, columna alineada y regla vertical; documento con texto oscuro sobre papel neutro.
Revelado por máscara, sin desplazamiento: entrada 0,48 s y salida 0,30 s.

## Abrir y comparar

[Página de propuestas](../../../diseno-textos-propuestas.html). Pestañas ACTUAL, A, B y C, fondo oscuro, negro o claro, bucles automáticos y Repetir por muestra. Teclas izquierda/derecha cambian de pestaña; Home/End van a los extremos. Sin mapas, imágenes, reproductores, audio, MP4 ni solicitudes de red externas.

Cada pestaña incluye los 29 tratamientos del inventario del episodio y los cinco complementos de biblioteca. El medallón `icon.badge` se identifica como geometría sin glifos; no se dibuja un icono en esta página de texto. Los ejemplos `label.figure` y `badge.count` usan nueve minas del Iran Ajr; `inventory.units` usa 1 MH-6 de observación y 2 AH-6 de ataque, textos del episodio. Se distinguen de sus demos sintéticas de biblioteca. No se crean titulares ni cifras históricas nuevas.

Los detalles se dibujan a **2,5×**: tamaño CSS = tamaño U × 2,5. Las maquetas son una comprobación adicional a escala de pantalla: móvil 540×960 CSS (U=0,5); desktop 1920×1080 CSS (U=1, con ×1,1 en transcripción). El desktop se reduce visualmente para verlo al lado del móvil; el botón **Ver desktop 1:1** permite inspeccionar sus 1920 píxeles mediante desplazamiento horizontal. En teléfonos la maqueta de 540 px se desplaza dentro de su panel y no agranda la página.

**Transcripción: actual 45 U → propuesta 33,75 U, −25 % exacto.** Móvil: 22,5 → 16,875 px CSS. Desktop: 49,5 → 37,125 px CSS. Centro Y: 90 % en vertical y 91,5 % en horizontal. Ancho máximo 450/1536 px CSS; máximo tres palabras por grupo y dos líneas. Cada propuesta mantiene esa medida, posición y ancho. Las palabras del ejemplo proceden de `assets/lyrics.json` y conservan sus tiempos relativos. El grupo de ACTUAL aparece completo, como el motor original; las propuestas resaltan la palabra en curso con un tono secundario legible para las demás.

La muestra ampliada y las maquetas responden a un único reloj. Cada muestra de rótulo tiene entrada, permanencia y salida con bucle de cinco segundos. Solo se actualizan las muestras visibles, hasta seis; los textos editoriales escalonan sus campos y las guías se trazan antes de completar el rótulo. Los cinco segundos son la duración de inspección, no una nueva duración para los items del episodio.

## Tokens e integración posterior

Cada `A.tokens.json`, `B.tokens.json` y `C.tokens.json` contiene:

- `palette`, `fonts` y `motion`: identidad, archivos locales y tiempos.
- `components["caption.transcript"].params`: campos existentes del componente (`size`, `font`, `weight`, `color`, `activeColor`, `inactiveColor`, `stroke`, `strokeWidth`, `background`, `padding`, `radius`, `maxWords`, `highlight`, `y` y `yLandscape`).
- `components["label.*"].params`: parámetros existentes de cada rótulo; colores hex explícitos. La familia de display se suministra a través de `scene.defs.fonts.display`.
- `components[tipo].style`: especificación completa de presentación en U (tipografía, roles, contorno, fondo, borde, radio, sombra, estructura, regla, márgenes, ancho máximo y animación). El visor carga estos valores desde los JSON; no usa una paleta paralela para A/B/C.

Ejemplo **sin escritura de escena**, para preparar una aplicación futura:

```js
const tokens = await (await fetch('work/texto/propuestas/A.tokens.json')).json();
const captionParams = tokens.components['caption.transcript'].params;
const chipParams = tokens.components['label.chip'].params;
// futura escena: captions = {...captions, ...captionParams}
// futuro item: {...item, ...chipParams}; defs.fonts.display = tokens.fonts.display
```

**Límite del motor inspeccionado:** `captions.js` acepta esos `params` de transcripción, incluido el fondo opaco y el resaltado por palabra. Fija la entrada back en 0,18 s y el factor horizontal ×1,1; no admite interlineado, máximo de líneas o la animación específica de cada propuesta. `labels.js` fija el peso 800 dentro de `fit()/ink()`, el contorno, caja, radio y borde dentro de `chip()`. Tampoco admite reglas, pestañas ni máscaras desde parámetros. `editorial.js` hornea fuentes y composición dentro de bitmaps; `intro.js` y la atribución de `plano.js` tienen su composición propia. Por tanto **cargar tokens hoy en el episodio no reproduce todo este rediseño**. Se entregan todos los valores y una vista completa que sí los interpreta, pero aplicar el sistema completo exige habilitar previamente estos campos en los dibujadores. No se ha modificado ningún motor ni el episodio. Esta limitación está también dentro de cada JSON, en `compatibility`.

`integration-contract.json` enumera, por componente, los campos existentes y las extensiones que debe consumir el futuro adaptador. Preservar el tamaño particular de cada `label.chip` del inventario al aplicar los tokens; `params.size:30` es el tamaño base, no una instrucción para borrar la jerarquía 26–45 U. Las propuestas cambian de estructura y no conservan el código de dibujo de las cajas actuales.

## Contraste y legibilidad

La ficha calcula luminancia relativa sRGB y `(Lclaro + 0,05) / (Loscuro + 0,05)`, sin redondear antes de decidir el umbral de 4,5:1. Publica **directo sobre cada fondo** y **con soporte**, además del texto secundario (las palabras inactivas de la transcripción). Se mide al texto plenamente visible: una entrada o salida con alfa parcial pierde contraste intencionalmente. En A/B/C la transcripción lleva fondo opaco del sistema; los rótulos con fondo transparente activan soporte opaco al seleccionar claro. El documento usa su papel neutro. La ficha muestra los colores exactos y evita atribuir al relleno el contraste aportado por un trazo.

Esto verifica los tres fondos lisos pedidos; no certifica imágenes satelitales futuras. Los colores de ACTUAL, incluido su rosa y crema, solo documentan la referencia y su fila de comparación.

## Fuentes y procedencia

Se reutilizan los archivos del directorio local `_tools/explainer-kit/vendor/fonts/`; no se descargó ninguna fuente ni se depende de CDN. Copias y licencias SIL Open Font License 1.1 en `assets/fonts/propuestas/`:

- `Barlow-700.ttf` + `Barlow-OFL.txt`.
- `Fjalla-One-400.ttf` + `Fjalla-One-OFL.txt`.
- `EB-Garamond-700.ttf` + `EB-Garamond-OFL.txt`.
- `Open-Sans-700.ttf` + `Open-Sans-OFL.txt`.

ACTUAL usa Archivo Black, Anton y DejaVu Sans Bold ya presentes en la plantilla. La tipografía impresa dentro de fotos o documentos queda fuera porque son píxeles de imágenes; aquí se muestran todos sus textos editables de pie, nombre, cargo, fecha y crédito.

## Verificación

Capturas en `work/texto/capturas/propuestas/`; medidas, errores de red, fuentes cargadas, formatos y estados de animación en `verificacion.json`. La entrega de lectura está en `work/results/textos-propuestas.md`. Navegador único, una página, `nice -n 15`, con lock cooperativo `/tmp/atlas-tactico-chromium.lock`.

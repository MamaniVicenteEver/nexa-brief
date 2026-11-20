# TITANES · producción por JSON

El diseño carga sus componentes desde `design.json`. Cada beat acepta `t`, `dur`, `use` y `params`. La narración puede resolver `@palabra` en parámetros temporales de primer nivel. La paleta IBM se configura por video.

```json
{"palette":{"accent":"#1F6BFF","rim":"#66D1FF"}}
```

Los componentes de datos comparten `bg`, `acento`, `borde`, `intensidad`, `semilla`, `entrada`, `salida`, `titulo` y `fuente`. Los fondos disponibles son `foco`, `horizonte`, `ciudad`, `sala`, `rayos`, `mercado` y `archivo`. La entrada habitual es `golpe` y la salida es `tinta`. Las cifras positivas usan `palette.gold` y las pérdidas usan `palette.blood`.

Los ejemplos numéricos siguientes permiten probar la composición. Los valores del episodio, referencias judiciales, citas y fechas deben proceder de la investigación aprobada. Los rótulos A/B, las series de ejemplo y los valores 100/10 son datos de demostración.

## Cifra

`valor` admite signo. `prefijo`, `sufijo`, `contexto` y `fecha` son independientes. `decimales` usa coma decimal y punto de miles. `contarEn` controla el tic mecánico.

```json
{"t":0,"dur":6,"use":"titanes.cifra","params":{"valor":-8100,"prefijo":"US$","sufijo":"M","contexto":"PÉRDIDAS","fecha":"1993"}}
```

La comparación muestra primero `antes`, luego `valor`, con flecha y tachado opcional. El color responde a la diferencia entre los valores.

```json
{"modo":"comparacion","antes":1.21,"valor":0.25,"decimales":2,"contexto":"DIVIDENDO","prefijo":"US$","cambioEn":2.2,"tachado":true}
```

La secuencia acepta hasta tres objetos. Cada objeto puede sustituir unidades, contexto y fecha. `at` expresa segundos locales. Al omitirlo, el componente reparte la duración del beat.

```json
{"modo":"secuencia","cifras":[{"valor":120,"contexto":"INGRESOS","sufijo":"M","at":0},{"valor":25,"contexto":"GANANCIA","sufijo":"M","at":2},{"valor":-15,"contexto":"PÉRDIDA","sufijo":"M","at":4}]}
```

## Bolsa

`serie` contiene objetos `{ano,valor}`. Los años numéricos crecientes conservan sus distancias temporales. Las etiquetas alfanuméricas se espacian por índice. `unidad`, `decimales` y `eventos` completan el gráfico. La escala vertical incluye cero. `dibujarEn` controla el trazado.

```json
{"t":0,"dur":6,"use":"titanes.bolsa","params":{"titulo":"LA CAÍDA","modo":"caida","serie":[{"ano":"1987","valor":175.88},{"ano":"1993","valor":40.63}],"unidad":"US$","decimales":2,"caidaIndice":0,"caidaEn":2.4,"eventos":[{"indice":0,"texto":"CUMBRE"}]}}
```

`caidaIndice` identifica el punto del quiebre. `caidaEn` controla el impacto, seguido de una caída de 0,5 s. `modo: "linea"` traza la serie con el acento normal. `modo: "barras"` muestra todas las observaciones, conserva el signo y destaca su cantidad. Las barras admiten, por ejemplo, 22 trimestres. Sus alturas deben recibir los valores reales de esos trimestres.

```json
{"titulo":"INGRESOS","modo":"barras","serie":[{"ano":"T1","valor":-3},{"ano":"T2","valor":-5},{"ano":"T3","valor":-2}],"unidad":"TRIMESTRES"}
```

El electrocardiograma es una metáfora explícita del pulso de la empresa. Se aplana a partir de `caidaEn`. `pulso` y `plano` controlan sus dos rótulos.

```json
{"titulo":"EL CORAZÓN","modo":"electrocardiograma","caidaEn":2.4,"pulso":"PULSO","plano":"SIN PULSO"}
```

## Escala

`entidades` contiene `{nombre,valor,src?}`. `forma` acepta `edificio`, `moneda`, `tarjeta` y `figura`. `proporcion: "area"` aplica la raíz del cociente a ambos ejes. `altura` hace proporcional el alto. Las imágenes conservan su relación de aspecto. Cero produce una etiqueta con objeto de tamaño cero. Se recomienda presentar dos o tres entidades por plano para conservar la lectura en móvil.

```json
{"t":0,"dur":6,"use":"titanes.escala","params":{"titulo":"CAPITAL","forma":"edificio","proporcion":"area","entidades":[{"nombre":"MATRIZ","valor":100},{"nombre":"FILIAL","valor":10}],"unidad":"M"}}
```

```json
{"forma":"figura","figura":"assets/media/ejecutivo.png","entidades":[{"nombre":"A","valor":100},{"nombre":"B","valor":10,"src":"assets/media/otra-figura.png"}]}
```

Las imágenes anidadas en `entidades` se precargan desde `prepare` por la entrada normal del kit.

## Plantilla

`desde → total → hasta` define crecimiento y recorte. `porFigura` expresa la equivalencia humana y aparece en pantalla. La última figura puede estar ocupada parcialmente. A partir de 240 celdas se ajusta la equivalencia efectiva y se imprime su valor exacto.

```json
{"t":0,"dur":6,"use":"titanes.plantilla","params":{"titulo":"PERSONAS","total":405000,"hasta":220000,"porFigura":15000,"figura":"assets/media/ejecutivo.png","crecerEn":1.7,"vaciarEn":3.1,"vaciadoDur":0.5,"abreviar":false}}
```

`abreviar: true` produce `405 mil`. El formato completo `405.000` cabe en 9:16. Para solo crecer, igualar `hasta` y `total`. `vaciarEn` admite un ancla de narración. El valor 220.000 representa el umbral del ejemplo técnico. La formulación editorial «menos de 220.000» requiere el dato exacto aprobado para su cuadrícula.

## Duelo

`lados` admite dos o tres nombres, con `metrica` opcional. `ganador` debe coincidir con un nombre. Una cadena vacía deja el enfrentamiento abierto. `ganadorEn` determina el momento de resolución y `veredicto` su rótulo.

```json
{"t":0,"dur":6,"use":"titanes.duelo","params":{"lados":[{"nombre":"OS/2"},{"nombre":"WINDOWS"}],"ganador":"WINDOWS","ganadorEn":3.2,"veredicto":"GANA"}}
```

```json
{"lados":[{"nombre":"IBM"},{"nombre":"INTEL"},{"nombre":"MICROSOFT"}],"ganador":""}
```

## Cronología

Cada era ocupa el cuadro. `eras` contiene `{ano,titulo,at?}`. Los saltos usan el año anterior como referencia. `at` es un segundo local y su ausencia reparte la duración entre las eras.

```json
{"t":0,"dur":6,"use":"titanes.cronologia","params":{"eras":[{"ano":"1964","titulo":"SYSTEM/360","at":0},{"ano":"1981","titulo":"EL PC","at":2},{"ano":"1993","titulo":"LA CRISIS","at":4}],"bg":"archivo"}}
```

## Titular

`variante` admite `documento`, `cita`, `cartel` y `titular`. Todo se compone desde texto propio. Documento añade `sello`, `referencia` y `fecha`. Cita añade `autor` y `fecha`. Titular añade `antetitulo`. `fuente` permite una atribución adicional breve.

```json
{"t":0,"dur":6,"use":"titanes.titular","params":{"variante":"documento","text":"CORTE SUPREMA","fecha":"1936","sello":"ARCHIVO","referencia":"EE. UU.","bg":"archivo"}}
```

```json
{"variante":"cita","text":"LO ÚLTIMO QUE IBM NECESITA AHORA ES UNA VISIÓN","autor":"LOU GERSTNER","fecha":"1993","bg":"foco"}
```

```json
{"variante":"cartel","text":"PIENSA","bg":"archivo"}
```

```json
{"variante":"titular","antetitulo":"IBM","text":"EL IMPERIO QUE VENDÍA SEGURIDAD","bg":"foco"}
```

Usar titulares breves y citas de hasta 25 palabras. El tamaño se ajusta al área disponible. Una referencia extensa puede quedar en los créditos del episodio, con referencia corta en pantalla.

## Foto o clip

`src` admite imagen y video. `tipo: "auto"` reconoce las extensiones MP4, WebM, MOV, M4V y OGV. El navegador debe poder decodificar el formato. Para una URL sin extensión, usar `tipo: "video"`. `poster` es un respaldo opcional.

```json
{"t":0,"dur":6,"use":"titanes.foto","params":{"src":"assets/media/nasa-ames.jpg","titulo":"NASA AMES","focus":[0.65,0.48],"zoom":0.045,"desplazar":[0.025,-0.015],"credito":"NASA · 1963 · dominio público"}}
```

```json
{"t":0,"dur":8,"use":"titanes.foto","params":{"src":"assets/media/archivo.mp4","tipo":"auto","start":1,"rate":0.8,"loop":true,"focus":[0.5,0.5],"credito":"Autor · licencia"}}
```

`focus` y `desplazar` se expresan como fracciones de la imagen. `zoom` es el acercamiento durante el plano. El clip es mudo y `ctx.clip` sincroniza sus cuadros con el tiempo del beat. `loop` repite el tramo desde `start`. La fotografía NASA de `samples/` y su procedencia están documentadas en `samples/DATOS-CREDITS.md`.

## Revisión

La vista local acepta cualquiera de los nombres nuevos.

```text
review.html?c=cifra&color=ibm&t=3.65
review.html?c=bolsa&color=ibm&t=3.65&p={JSON codificado}
```

Las hojas finales, la medición de cuadro y las pruebas de búsqueda inversa se enlazan desde `nexa-estrategi/diseno/review/datos.html`. La guía visual completa permanece en `DESIGN.md`.

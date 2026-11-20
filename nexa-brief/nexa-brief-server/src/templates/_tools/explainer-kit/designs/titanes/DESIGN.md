# TITANES · Historias de dinero y poder

Identidad aplicada desde `nexa-estrategi/docs/IDENTIDAD-TITANES.md`, versión 1 del 14 de noviembre de 2026. Base visual del canal, no episodio ni registro de producción.

## Dirección visual

Negros de tinta y noche, hueso para lectura, acento del protagonista para atmósfera y borde. Anton vendorizada en titulares condensados; Inter en rótulos, contexto y números. Una figura ilustrada con luz de borde, un titular dominante y una idea por plano. Sin logotipos, emojis ni personas dibujadas por código.

Los escenarios tienen tres capas rasterizadas a la densidad del dispositivo; la animación transforma esas capas con paralaje y un acercamiento del 1,8 %, más una deriva de cámara. La luz utiliza degradados con caída lateral, halos y niebla entre planos. El grano es fino, determinista a 18 Hz. La viñeta cierra los bordes hacia negro. El escenario histórico usa papel hueso.

Los titulares entran desde abajo con recorte, escalonados por línea. El barrido luminoso se desplaza por las letras. El golpe de apertura dura 0,35 s y sacude 8 px; el resto del movimiento tiene inercia sin rebote. Las transiciones son tinta orgánica, luz y golpe, con tiempo absoluto y semilla. No hay contadores de cuadros, timers ni azar sin semilla en los componentes.

En 16:9 el titular ocupa el lado izquierdo y la figura el derecho. En 9:16 se recompone: kicker desde 13,2 % de alto, titular en tercio superior, figura central de 46–47 % del alto, con pies alrededor del 84–85 %. Los textos principales quedan entre 8–83 % del ancho y por encima del 72 % del alto. Las acciones de cierre dejan libre la columna derecha de controles. Los fondos pueden ocupar toda la pantalla.

## Fuentes y recursos

`fonts/` contiene Anton 400, Inter 400 y 900, y sus licencias. `fontsCss` queda vacío deliberadamente: el loader resuelve ese campo desde la página del video, no desde el kit. `_titanes.js` instala las reglas `@font-face` con URL relativa a su propio script y añade las fuentes a `Kit.fonts`; `Kit.boot` espera su carga antes de medir. Así funcionan Showcase, episodios en cualquier carpeta y copias del kit sin red externa.

Las cinco figuras de `samples/` son las copias provisionales solicitadas. Consultar `samples/CREDITS.md`: no tienen licencia de publicación acreditada. Se entregan como material de prueba reemplazable por `figura`. No identifican a un ejecutivo real. La imagen se desatura (también los bordes cian de algunas muestras) y se colorea con `multiply` y se recompone `source-atop` sobre su alfa original: el negro permanece negro y las zonas claras toman `palette.rim`. No se generan máscaras ni se modifica el PNG. Se añade halo detrás, sombra al suelo y reflejo corto. Se sincronizaron las cinco muestras con los recortes limpiados de la biblioteca antes de la segunda ronda, y se guardaron hashes de ambos lados.

## Paleta por video: mecanismo real

`engine/loader.js` obtiene `assets/config.json` (o `config.json` según la entrada) y `engine/kit.js:boot` ejecuta `deepMerge(D.defaults, C0)`. Todos los colores del diseño salen de `ctx.C.palette`. `Kit.resolveParams` resuelve `palette.accent` y `palette.rim` en los parámetros de tipo `color`.

Base en `design.json.defaults.palette`: `accent: #E9B23B`, `rim: #F2C96B`, `bg: #0B1220`, `tinta: #06080C`, `graphite: #1A212C`, `ink: #EFE9DF`, `muted: #8A93A3`, `blood: #E3262F` y bordes `black: #000000`.

Para IBM, el video solo necesita:

```json
{
  "palette": { "accent": "#1F6BFF", "rim": "#66D1FF" }
}
```

`examples/ibm/assets/config.json` demuestra esa sobreescritura, y `examples/oro/assets/config.json` deja la paleta vacía para heredar la base. `review.html` carga esos archivos reales y llama al mismo `Kit.boot` que los episodios. No modifica el motor ni duplica estilos. Un plano puede sobreescribir `acento` y `borde`; usar `acento: "palette.blood"` para una caída concreta.

## Parámetros compartidos

| Param | Valor por defecto | Uso |
|---|---|---|
| `bg` | `auto` | `foco`, `horizonte`, `ciudad`, `sala`, `rayos`, `mercado`, `archivo`, `image`, `component`, `none` |
| `src` | vacío | Imagen del fondo `image`; en introv2 con escenario propio, foto protagonista en un marco duotono |
| `focus` | `[0.5,0.5]` | Foco de la imagen cover |
| `use`, `useParams` | vacío, `{}` | Componente de fondo bajo `bg: component`, según `Kit.hook.bg` |
| `dim` | `0.45` | Oscurecido de fondos foto/componente |
| `acento`, `borde` | `palette.accent`, `palette.rim` | Color del plano |
| `intensidad` | `1` | Potencia de iluminación; 0,25–1,7 |
| `semilla` | `41` | Ventanas, polvo y tinta; 1–999999 |
| `figura` | vacío | PNG transparente. Pasarlo explícitamente para mostrar al protagonista; `example` ya lo contiene |
| `escalaFigura` | `1` | 0,65–1,15 respecto a la composición |
| `entrada`, `salida` | `golpe`, `tinta` | `tinta`, `luz`, `golpe`, `ninguna`; introv2 entra con luz, capítulo con tinta |

Las cifras se dibujan por celdas de avance fijo (máximo ancho de los dígitos de la fuente), también en Canvas; no dependen de una propiedad CSS. Todo texto visible es parámetro. Mantener 2–4 palabras de titular y como máximo siete palabras simultáneas sumando rótulos; `contexto: ""` y `kicker: ""` apagan esos campos. Los saltos `\n` dan dirección editorial explícita; sin saltos, se equilibran hasta dos líneas. No usar los parámetros para meter párrafos.

## Componentes

| Componente | Parámetros propios | Fondo automático | Función |
|---|---|---|---|
| `titanes.introv1` | `text`, `kicker`, `contexto` | `foco` | Golpe, título, figura protagonista a contraluz |
| `titanes.introv2` | anteriores + `pregunta`, `revelarEn` (1,8 s) | `horizonte` | Pregunta → barrido de luz → titular y foto/figura revelada |
| `titanes.capitulo` | `numero` (string, conserva cero), `titulo`, `kicker`, `contexto` | `ciudad` | Número de capítulo, titular y figura; tinta de entrada y salida |
| `titanes.outro` | contrato común + `like`, `salida` | `rayos` | Gracias → canal → LIKE → flecha → suscripción → campana → apoyo/dirección |
| `titanes.escenario` | `escenario` + parámetros de luz | `foco` | Revisión o reutilización de un escenario sin texto ni figura |

El cierre usa `Kit.hook.outroParams` y `outroTimes`: `thanks`, `channel`, `cta`, `support`, `handle`, `arrow`, `likeAt`, `subscribeAt`, `bellAt`, `supportAt`. Los tiempos se comprimen cuando la duración baja. El handle está vacío porque no hay una dirección pública confirmada. El agradecimiento cede espacio a las acciones para evitar saturación. En vertical el texto de apoyo mide 3,7 u, LIKE 3,5 u y el handle opcional 3 u. La campana es un pictograma vectorial, no un emoji.

Al anidar un fondo con imagen en `bg: component`, repetir la ruta de `useParams.figura` o `useParams.src` en `src` del componente superior: así `Kit.boot` la precarga antes del primer cuadro. El hook compartido carga imágenes anidadas de forma asíncrona, por lo que esa declaración superior es necesaria para capturas deterministas desde el primer instante. La figura también comprueba la disponibilidad tardía al dibujar.

Para una introv2 con foto, especificar `src`, `focus` y `bg: auto`; para una foto a pantalla completa, usar `bg: image`. Para una figura, especificar `figura`. Las imágenes se precargan por el contrato `type: image` del motor; usar rutas del episodio como `assets/media/ejecutivo.png`. Los ejemplos del catálogo resuelven las muestras desde la ubicación real del script, sin rutas de esta máquina.

```json
{"t":0,"dur":6,"use":"titanes.introv1","params":{
  "text":"EL PRECIO\nDEL PODER","kicker":"IBM","bg":"foco",
  "figura":"assets/media/ejecutivo.png","salida":"tinta"
}}
```

## Escenarios y planos

| Escenario | Fondo | Medio | Frente / luz |
|---|---|---|---|
| `foco` | arquitectura oscura y cono cenital de 22 cuñas | halo, polvo y suelo reflectante | sombra/reflejo de figura, viñeta |
| `horizonte` | noche → acento, halo bajo | crestas lejanas y niebla | cresta negra cercana, borde de luz |
| `ciudad` | edificios pequeños con ventanas sembradas | segunda capa, niebla iluminada | torres cercanas oscuras y paralaje más rápido |
| `sala` | ciudad tras el ventanal | cristales, montantes y tres lámparas | mesa en perspectiva, sillas y borde pulido |
| `rayos` | noche y halo amplio | 32 haces radiales lentos con caída | núcleo luminoso y suelo con reflejo |
| `mercado` | muro desenfocado de números escenográficos | divisiones, halo y desplazamiento | cristal, barrido de luz y sombra inferior |
| `archivo` | papel hueso, grano | cuatro tarjetas perforadas con sombra y giro | lomo oscuro cercano y luz cálida lateral |

Los números de `mercado` forman una textura sintética. Las cifras del episodio se presentan mediante los componentes de datos y su fuente paramétrica.

## API interna y ciclo de vida

`Kit.titanes.scene(ctx, params, nombre)` devuelve `render(g, t)` y `dispose()`; las tres capas se crean una vez por instancia y se vacían al salir. `background` envuelve `Kit.hook.bg`, incluido su `dispose`. `figure` precalcula color y límites del alfa una sola vez y libera el lienzo al terminar. `finish` aplica grano/viñeta. `titleLayout`, `title`, `kicker` forman la tipografía. `transition(g, stage, tipo, cobertura, palette, semilla)` dibuja una cobertura 0–1; `edges` la sincroniza al inicio/final del beat. Ningún helper crea animaciones de navegador ni bucles propios.

## Revisión reproducible

Servir `src/templates/` por HTTP y abrir `_tools/explainer-kit/designs/titanes/review.html?c=introv1&color=ibm&t=3.35`; cambiar `c` por introv2/outro/capitulo/escenario y `p` por JSON codificado. La vista fija original del kit también funciona: `showcase/stage.html?d=titanes&c=titanes.introv1&solo&t=3.35`.

La herramienta del encargo es `nexa-estrategi/diseno/tools/review_titanes.py`. Genera 6 instantes por componente/escenario × 2 formatos × 2 paletas, compara hashes tras seeks invertidos, comprueba fuentes y registra consola. `--perf` mide dibujo con barrera de lectura del canvas y memoria RSS de los procesos Chromium. No graba ni publica video. Consultar el informe del encargo y `diseno/review/*-qa.json` para los resultados medidos y sus límites.

## Datos y documentos

La ampliación añade ocho componentes a `design.json.scripts` y `design.json.showcase.components`. `_datos.js` aporta composición de datos, ajuste tipográfico, formato español y ciclo de vida. Reutiliza `_titanes.js` para escenarios, luz, figuras, grano, tipografía y transiciones. El token adicional `palette.gold` conserva el oro económico cuando el acento del protagonista es azul.

| Componente | Función | Parámetros principales |
|---|---|---|
| `titanes.cifra` | Contador mecánico con unidades, fecha y contexto | `valor`, `prefijo`, `sufijo`, `contexto`, `fecha`, `decimales`, `contarEn`, `modo`, `antes`, `cambioEn`, `tachado`, `cifras` |
| `titanes.bolsa` | Línea de neón con relleno, quiebre rojo, pulso plano o barras | `serie`, `modo`, `eventos`, `unidad`, `decimales`, `dibujarEn`, `caidaIndice`, `caidaEn`, `pulso`, `plano` |
| `titanes.escala` | Entidades proporcionales mediante edificios, monedas, tarjetas o PNG | `entidades`, `forma`, `proporcion`, `figura`, `unidad`, `decimales` |
| `titanes.plantilla` | Crecimiento y recorte de una cuadrícula de figuras ilustradas | `total`, `desde`, `hasta`, `porFigura`, `crecerEn`, `vaciarEn`, `vaciadoDur`, `abreviar`, `figura` |
| `titanes.duelo` | Dos o tres nombres enfrentados y resolución final | `lados`, `ganador`, `ganadorEn`, `veredicto` |
| `titanes.cronologia` | Eras de cuadro completo con años grandes y saltos | `eras`, con `ano`, `titulo` y `at` |
| `titanes.titular` | Documento, cita, cartel y titular compuesto | `variante`, `text`, `autor`, `fecha`, `sello`, `referencia`, `antetitulo` |
| `titanes.foto` | Imagen o clip mudo con duotono, grano, marco y movimiento | `src`, `tipo`, `poster`, `focus`, `desplazar`, `zoom`, `start`, `rate`, `loop`, `credito` |

Todos admiten `titulo` y `fuente` opcionales, además de los parámetros comunes del diseño. `QUICK.md` contiene los ejemplos JSON completos y las opciones de cada variante.

### Composición y movimiento de datos

El contenido principal de 9:16 ocupa el 9–83 % del ancho y llega hasta el 72 % del alto. Las superficies y escenarios conservan el espacio atmosférico alrededor. En horizontal, las comparaciones se enfrentan lateralmente. En vertical, el duelo se apila y la escala puede repartirse en filas. Las cifras, nombres y fechas se miden con las fuentes locales ya cargadas.

Los dígitos reutilizan el avance fijo de `T.number`. Los signos y sufijos reciben su propio ancho medido para preservar el espacio de un menos y de `mil`. El contador avanza a pasos de 18 Hz calculados desde tiempo absoluto. Las cifras positivas se iluminan en oro y las pérdidas en sangre. En comparación, el color se calcula a partir del cambio entre valores.

El crecimiento de objetos dura 2,2 s con inercia. La línea de bolsa se dibuja por segmentos. Al llegar al punto de caída se abre una discontinuidad, el tramo posterior cambia a sangre, cae durante 0,5 s y la cámara sacude hasta 8 px durante 0,45 s. El electrocardiograma disminuye su amplitud hasta cero durante 0,5 s. El trazado conserva el cero de la escala, los años extremos y sus valores. Las marcas de eventos muestran el último evento alcanzado. Las barras mantienen una línea de cero y codifican el signo.

La escala usa área proporcional por defecto. Los dos ejes se multiplican por la raíz del cociente entre valores. La opción `altura` aplica el cociente al alto. Las figuras PNG conservan sus proporciones. La cuadrícula de plantilla usa la ilustración `de-pie`, precalculada en dos sprites con los helpers de la base. La equivalencia propuesta de 15.000 personas por figura produce 27 figuras para 405.000. La ocupación parcial conserva la proporción del resto. La equivalencia se ajusta y se rotula cuando la cantidad solicitada supera 240 celdas.

Las eras se sustituyen por barrido de luz. El año anterior da contexto al salto. El documento se ilumina sobre papel hueso, con referencia y sello propio. Los titulares se revelan por renglones y las citas conservan un área separada para atribución. Las fotos avanzan con un acercamiento de 4,5 % y una deriva de foco configurable.

### Medios y determinismo

`prepare` precarga las imágenes anidadas de escala y los medios de foto a través de `Kit.image`, `Kit.video`, `Kit.loaded` y `Kit.loadedVideos`. La precarga ocurre desde `Kit.boot`. El video usa el contrato `ctx.clip`, que espera el cuadro solicitado en un seek. El componente reutiliza un búfer del tamaño de su marco y lo libera en `dispose`. Se limpia la totalidad de sus píxeles físicos antes de dibujar para que los bordes fraccionales produzcan la misma imagen tras búsquedas inversas.

Los componentes carecen de relojes y bucles independientes. El tiempo del beat determina contadores, cambios de era, quiebres, vaciado, foco y zoom. Al abandonar una escena se liberan sus capas, figuras y búferes mediante `dispose`.

La muestra fotográfica representa el sistema de datos de NASA Ames en 1963, reutilizada desde el inventario local IBM. `samples/DATOS-CREDITS.md` conserva procedencia, hash y crédito. El MP4 de QA es una fotografía animada para probar el contrato de video. Las ilustraciones de la base conservan su estado provisional y su autoría pendiente de acreditar.

### Evidencias de la ampliación

`nexa-estrategi/diseno/tools/review_datos.py` ejecuta la entrada normal del diseño. Captura seis instantes en ambos formatos con acento IBM, compara búsquedas inversas y recreación de instancias, revisa fuentes y registra errores de navegador. Las variantes complementarias tienen hojas adicionales. La galería estática se abre en `nexa-estrategi/diseno/review/datos.html`. El informe de resultados, rondas y medición por cuadro es `nexa-estrategi/codex/RESULT-titanes-datos.md`.

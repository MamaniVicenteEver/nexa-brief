# Plantillas pedagógicas profesionales de Academy

## Propósito

Estas plantillas no son presentaciones ni tarjetas de contenido. Cada una es un escenario de clase con una progresión didáctica visible: una pregunta, una explicación construida, una comprobación y una práctica breve. El contenido generado llena variables aprobadas; no decide por sí solo los colores, la tipografía, el movimiento ni la composición.

## Plantillas pedagógicas actuales

| Materia | Plantilla | Escenario | Uso pedagógico |
| --- | --- | --- | --- |
| Matemática | Pizarra de resolución | Pizarra con trazo de tiza, pasos y comprobación | Procedimientos, operaciones y problemas resueltos |
| Matemática | Taller de línea numérica | Mesa de papel, fichas y recta numérica | Cantidades, agrupaciones, fracciones y comparación |
| Inglés | Estudio de diálogo | Dos interlocutores y turnos de conversación | Frases cotidianas y uso en contexto |
| Inglés | Laboratorio de pronunciación | Frase, ritmo, sílaba y onda de voz | Escucha, acento y repetición guiada |
| Inglés | Taller del verbo to be | Pronombres, mapa am/is/are y oraciones construidas | Gramática inicial y práctica contextual |

Cada plantilla define colores primario, secundario y terciario, tipografías, componentes permitidos, zonas de subtítulos, escenas y variables que el agente puede completar. La fuente de verdad legible por el sistema está en `nexa-academy-server/data/academy/template_catalog.json`.

## Librerías y responsabilidades

| Recurso | Decisión | Uso permitido |
| --- | --- | --- |
| HyperFrames | Motor de composición y render | Duración, pistas, clips, validación y previsualización |
| GSAP | Biblioteca de coreografía | Una línea de tiempo pausada, finita y sincronizable para escritura, pasos y transiciones |
| Lucide | Ya instalada en el frontend | Iconos de selección y controles; se limita a una lista blanca por plantilla |
| KaTeX | Incorporación planificada en el render matemático | Fórmulas convertidas antes del render a HTML/SVG local; no se cargan desde la red |
| dotLottie | Recurso opcional | Solo archivos locales versionados para una animación auxiliar; nunca URL remota durante el render |
| SVG y CSS | Base de los escenarios | Tiza, líneas, marcas de pronunciación, flechas, fichas y transiciones estructurales |

GSAP proporciona secuenciación precisa con líneas de tiempo y puntos de posicionamiento; eso permite sincronizar la escritura y los subtítulos con la narración. [Documentación de GSAP](https://gsap.com/docs/v3/GSAP/Timeline/)

KaTeX produce fórmulas de forma síncrona y puede prerenderizarse, por lo que es apropiado para las composiciones de matemática. [Documentación de KaTeX](https://katex.org/)

dotLottie ofrece reproductores web para archivos `.lottie` y JSON; se reservará para recursos locales y no para elementos que dependan de un CDN. [Documentación de dotLottie](https://docs.lottiefiles.com/en/runtimes/distributions/js)

## Reglas del generador visual

1. Recibe un `template_id` ya aprobado y solo puede usar sus `agent_variables`.
2. Divide el guion en escenas con inicio, fin, texto hablado, texto central y subtítulo.
3. Para matemática, genera LaTeX validable y una explicación verbal separada de la fórmula.
4. Para diálogo, mantiene un historial corto de turnos, resalta la persona activa y coloca el subtítulo centrado en la zona inferior.
5. Para pronunciación, prueba varias expresiones de forma separada y termina con un resumen de todas las frases practicadas.
6. Para el verbo `to be`, explica pronombres, relaciona `am/is/are`, desplaza los pronombres a un rail lateral y construye oraciones en el espacio liberado.
7. Mantiene el contenido principal en el centro de la escena y el subtítulo en su zona reservada inferior.
8. Cada transición comunica una acción: escribir, agrupar, enfocar, cambiar de turno o comprobar. No usa transiciones decorativas sin función pedagógica.
9. No puede cargar fuentes, iconos, Lottie ni imágenes obligatorias desde internet mientras renderiza.

## Criterio de producción

- Tres capas por escena: ambiente, contenido docente y señal de atención.
- Dos focos visuales como mínimo: el concepto y la herramienta que lo explica.
- Movimiento con inicio, respiración y resolución; no bucles infinitos.
- Tipografía legible en video, contraste comprobable y texto breve por bloque.
- La pizarra o mesa no es un fondo: el conocimiento aparece construido dentro de ella.

## Resultado que se revisará en la interfaz

La galería de Academy muestra dos plantillas de Matemática y dos de Inglés. Las de Inglés fueron replanteadas como escenarios amigables de clase: `Historia para hablar` sitúa la frase dentro de una situación cotidiana y `Mesa de frases` permite construirla pieza por pieza. Al abrir una se puede revisar en tiempo real un ejemplo de 30 segundos, el escenario, la paleta, las tipografías, los componentes, las bibliotecas, el movimiento y las variables que el agente puede completar. El botón `Pantalla completa` amplía únicamente el escenario visual. Dentro aparecen controles de adelanto de cinco segundos, pausa/reanudación y cierre; la explicación y el panel de producción permanecen fuera de esa vista. Esa revisión es anterior a renderizar el primer MP4.

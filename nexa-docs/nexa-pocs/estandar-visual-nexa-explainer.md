# Estándar visual de Nexa Explainer

**Estado:** implementado como contrato JSON y catálogo cerrado de nueve plantillas.  
**Propósito:** transformar un video de una persona hablando en una pieza explicativa, no en una presentación superpuesta.

## Decisión de producto

El video original del presentador es siempre la capa principal. El sistema sólo añade una capa visual cuando puede responder a una necesidad concreta de la frase: orientar, definir, citar, enumerar, probar una cifra, señalar un producto autorizado o mostrar una relación.

No es válido usar gráficos por relleno. Una barra, cifra o comparación sólo puede renderizarse si el plan semántico adjunta `evidence` con un valor numérico trazable a la transcripción o a una fuente declarada. Si falta esa evidencia, la validación convierte `stat` en `concept` y el render usa texto, cita, paso o conector.

## Fuente de verdad

`nexa-explainer/nexa-explainer-server/src/explainer/template-manifests.json` es el contrato operativo. Cada plantilla declara:

- paleta primaria, secundaria, terciaria y de texto con valores hexadecimales;
- familias, pesos, tamaños y orden de lectura tipográfico;
- posición del presentador, zona visual y zona segura de subtítulos;
- componentes permitidos y formas visuales posibles;
- ritmo, transiciones aprobadas y movimientos prohibidos;
- reglas de subtítulos, iconos y evidencia;
- herramientas de implementación y restricciones que recibe la IA;
- tres escenas de muestra para la previsualización de 30 segundos.

El endpoint `GET /api/v1/explainer/templates` entrega el mismo contrato a la interfaz. El planificador editorial lo recibe antes de producir escenas, por lo que no puede elegir colores, gráficos o movimientos fuera de la plantilla seleccionada.

## Familias disponibles

| Plantilla | Uso correcto | Visual principal | Cuándo no usar gráfica |
|---|---|---|---|
| Editorial Split | opinión, entrevistas, liderazgo | tesis, cita, contexto | por defecto; privilegiar cita o contraste |
| Data Brief | educación y negocio cuantitativo | cifra con fuente, comparación | si la voz no da una medida verificable |
| Signal Minimal | mensaje breve y directo | palabra clave, trazo, acción | salvo que la cifra sea el mensaje central |
| Immersive Overlay | plano humano/cinematográfico | anclaje contextual sobre video | si no hay espacio libre o evidencia |
| Centered Rails | persona centrada | rails de idea y contexto | fuera del rail libre y sin cifra real |
| Kinetic Voice | discurso con ritmo y énfasis | palabra cinética y subtítulo preciso | salvo que el número sea el golpe verbal |
| Field Notes | casos, investigación, documental | anotación, referencia, cita | casi siempre; se prefieren notas con fuente |
| Product Signal | producto y demostración | interfaz autorizada, hotspot, paso | sin métrica real de producto y fuente |
| Systems Map | procesos, causa-efecto y decisiones | nodo, conexión, secuencia | si una relación puede explicarse mejor con nodos |

## Herramientas seleccionadas

- **HyperFrames + GSAP Timeline:** composición final determinista, reproducible y sincronizada con tiempos de video.
- **CSS/WAAPI:** previsualización local de 30 segundos, sin cargar un motor de animación adicional para una interacción sencilla.
- **Lucide:** iconos semánticos y profesionales en la aplicación; el render final los convierte en SVG inline para evitar redes externas y emojis.
- **Faster-Whisper:** transcripción y timestamps por palabra para subtítulos y resaltado, no para decidir el diseño.

La regla no es acumular librerías: una herramienta se introduce sólo si cubre una responsabilidad no resuelta por las anteriores. Esto protege el bundle del estudio, el render offline y la consistencia visual.

## Restricciones de movimiento

Cada escena debe tener un ciclo **entrada → respiración → resolución**. El movimiento tiene que estar ligado a una palabra, relación, fuente o cambio de capítulo. Se prohíben rebotes, animaciones infinitas, glitches persistentes, mockups inventados, cursores erráticos y cajas que cubran rostro, manos relevantes o subtítulos.

## Qué aún debe analizarse antes de producción multiusuario

1. **Análisis temporal de encuadre.** El primer frame es suficiente para el POC, pero no para cortes de cámara, zooms o movimiento del presentador. Hace falta tracking por muestras durante todo el video.
2. **Evidencia externa.** El contrato ya impide gráficas inventadas, pero el siguiente paso es un modelo de `Source` con URL, fecha, licencia y rango de transcript para cada afirmación.
3. **Assets autorizados.** Product Signal y Field Notes requieren comprobar que una captura, imagen o marca tiene permiso antes de incluirla.
4. **Validación automática de legibilidad.** Debe medir contraste, solapamiento con el bounding box del presentador, tamaño mínimo móvil y cobertura de subtítulos antes de aprobar.
5. **Parches de revisión estructurados.** El feedback ya vuelve a generar la composición; para una revisión profesional debe guardarse un `CompositionPatch` granular con historial y comparación visual.
6. **Medición de calidad.** Registrar cobertura de transcript, escenas sin evidencia, duración de overlays, tasa de revisión y aceptación por plantilla para mejorar con datos.

## Criterio de aprobación

Una entrega queda lista cuando: la plantilla cumple su contrato, no hay gráficos sin `evidence`, los subtítulos están dentro de la zona segura, el presentador sigue visible, la timeline no tiene solapamientos y el usuario confirma la previsualización antes de renderizar el MP4.

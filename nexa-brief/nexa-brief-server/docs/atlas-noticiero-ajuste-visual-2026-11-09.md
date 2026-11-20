# Dynamic News · ajuste visual para revisión

Aplicado al motor compartido del servidor alfred-server. Se mantienen tipografía, pesos y tamaños de
letra; se retiran tarjetas envolventes y franjas verticales. Solo alerta y mensaje llevan una base azul
al 20 % detrás de cada línea; el resto usa texto con sombra suave. Iconos vectoriales de trazo uniforme,
sin fondo ni medallón. Fotos sin tarjeta ni borde añadido.

El preset JSON (revisión 2) expone `textPlate` y `mediaScale`: iconos 1.3, retratos 1.4 y fotos de apoyo
1.6. «605 %» se interpretó como 60 %. Las fotos crecen hasta el espacio libre del plano; se ajustan
proporcionalmente si el aumento completo no cabe, conservando rótulos y componentes. En móvil una
foto que ya llenaba la zona segura no puede aumentar de ancho sin salir del cuadro.

## Comprobaciones

- 13 pruebas del noticiero y 1 del renderer histórico: pasan.
- 24 pruebas de API/estilos/visibilidad/Showcase: pasan.
- 328 instantes por orientación, con fuentes y datos reales: sin overflow ni colisiones en 9:16 y 16:9.
  Medición de cajas en Canvas 2D, sin abrir el globo, capturar imágenes o grabar medios.
- API: Original conserva 18 entradas, Dynamic News 23; sus contratos muestran las nuevas escalas.
  El endpoint de preview devuelve HTML 200. No se realizó aprobación visual ni grabación de validación.
- RAM del host: 4573 MiB usados / 6730 disponibles al inicio; 3248 / 8055 al finalizar comprobaciones.
  Última muestra CPU: 99 % inactiva, sin intercambio de entrada/salida. No prueba ausencia de fugas 3D.
- La suite global tenía fallos conocidos en la sesión anterior; aquí se ejecutaron los grupos afectados.

Por instrucción expresa del usuario no se generaron capturas, miniaturas ni MP4. Las miniaturas pueden
seguir antiguas o pendientes de regeneración; revisar la reproducción desde el modal o Showcase,
seleccionando Dynamic News y recargando el reproductor.

## Preferencia editorial

Se conservó la integración editorial actualizada en el servidor: Terra 6.1/high para textos, títulos,
descripciones y diálogos; Claude solo por indisponibilidad o cuota. Se corrigieron la alternativa Luna
y el trabajador de prototipos a `max` (antes `xhigh`). Las 17 pruebas de política/delegación/hub pasan,
sin llamadas reales a modelos. No se desplegó el prototipo de otra política preparado en /tmp, para
preservar los cambios concurrentes ya instalados.

La [referencia oficial de configuración](https://learn.chatgpt.com/docs/config-file/config-reference)
admite `model_reasoning_effort` según los niveles del modelo, incluido `max`. Las pruebas con agentes
falsos verifican configuración y selección; no certifican disponibilidad de cuota de una cuenta.

Código revisable y resultados sin medios privados en `work/results/atlas-news-refine-2026-11-09/`.
Los archivos del checkout local no se sustituyeron por versiones remotas divergentes. Sin commit ni push.

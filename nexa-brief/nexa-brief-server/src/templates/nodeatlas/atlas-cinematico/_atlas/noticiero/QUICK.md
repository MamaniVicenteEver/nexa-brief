Antes: [CALIDAD.md](../../../../../skills/CALIDAD.md) (manda) y, si orquestas, [ORQUESTACION.md](../../../../../skills/ORQUESTACION.md).
Al delegar: [PLANTILLA-BRIEF.md](../../../../../skills/PLANTILLA-BRIEF.md). Al entregar: [PLANTILLA-INFORME.md](../../../../../skills/PLANTILLA-INFORME.md) como `INFORME.md`.

## Específico de esta skill

> **Plantilla completa para producir videos noticiero: `AGENTE.md` (esta carpeta).** Estilo por defecto: `original`
> (`estilos/index.json` → `default`); `dynamic-news` solo si el usuario lo pide para ese video.

# Atlas noticiero · Dynamic News

Un motor 3D compartido, escenas de datos. No copiar ni leer el motor para cada video.
Elegir `estilo: "dynamic-news"` en `scene.json` y `configs[0]`; `original` conserva la versión anterior.
Descubrir el ID estable con `/api/v1/showcase/designs/<episodio>/styles`, después consultar
`/<design_id>/production-guide?estilo=dynamic-news` y solo `/catalog/<componente>?estilo=dynamic-news&format=9x16`.

Escena: `camera`, `layers` (geografía) y `hud` (noticiero). Piezas nuevas: `alert`, `headline`,
`key-figure`, `date-card`, `message`. Tiempos reales `t`/`out` con anclas de voz; `out` corta en esa ancla para no arrastrar gráficos a la siguiente noticia. `news.enter`/`news.exit` permiten excepciones de transición; ejemplos ilustrativos.
Familia Barlow Condensed; azul editorial, rojo para alerta, amarillo para dato clave y blanco para lectura.
Los tokens completos están en `noticiero/estilos/dynamic-news.json`; no repetirlos en cada ítem.

Excepción por pieza: `news: {size: 100, width: 0.8, x: 0.5, y: 0.4}`; orientación:
`portrait: {width: 1}`, `landscape: {width: 0.5}`. Los tamaños están en unidades de diseño (1080 de lado corto),
las posiciones son fracciones del cuadro y width es fracción de la zona segura. Los cintillos simultáneos se agrupan sin perder mensajes (`layout.groupTopics`); el estilo impone mínimos
legibles, envuelve palabras y busca huecos libres. Mantener textos breves y datos con fuente/período.

Revisar `__newsHud.layout()` tras seek: `boxes` son las cajas visibles; `overflow` debe estar vacío.
Una pantalla tiene capacidad finita: si hay overflow, repartir mensajes con `t`/`out`; no dar por mostrado
lo que no cupo ni reducir el texto por debajo del mínimo. En móvil se reserva el pie para subtítulos y
controles de plataforma. Cambiar estilos en el modal no modifica el JSON guardado hasta elegirlo para el episodio.


Revisión visual 2: sin tarjetas envolventes. `news.mediaScale` controla el medio sin cambiar letras:
iconos (`chip`) 1.3; retratos (`portrait`) 1.4; fotos de apoyo (`photo-frame`) 1.6.
Las fotos se limitan al espacio libre de la zona segura: en móvil una imagen que ya llenaba ese ancho no puede crecer
otro 60 % sin salir del cuadro. `news.textPlate: false` deja solo texto con sombra; `true` añade
un fondo al 20 % únicamente detrás de cada línea. El preset lo usa solo en alertas y mensajes.
Los símbolos son vectores de trazo uniforme, sin círculo contenedor ni fondo.
Por pedido del usuario, no generar capturas, miniaturas ni grabaciones hasta su revisión.

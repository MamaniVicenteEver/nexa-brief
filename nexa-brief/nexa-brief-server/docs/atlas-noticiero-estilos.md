# Atlas noticiero: estilos y composición adaptable

`Dynamic News` (`dynamic-news`) es una variante del HUD del motor Atlas Cinemático 3D, sin duplicar
MapLibre, el globo, la geografía, la cámara, las fuentes o las teselas. El diseño histórico sigue disponible
como `original`. El proyecto Resumen geopolítico permanece en Sandbox.

## Identidad y contrato

Barlow Condensed es la única familia de rótulos y subtítulos del estilo, con pesos 700 y 800 locales.
Roles principales: azul marino `#071B36`, azul editorial `#2684FF` y blanco `#F7FAFF`. Rojo `#EF3340`
indica alerta; amarillo `#FFD34D` destaca una cifra o advertencia. Negro y azul claro sirven de apoyo.
Los colores semánticos de los hemiciclos se conservan dentro de esta paleta. Los rótulos cartográficos
nativos se apagan en esta variante para evitar competir con el HUD; los marcadores de ciudad siguen disponibles.
No se usan logos de cadenas de noticias ni se cambia la marca del canal.

Fuente de verdad: `_atlas/noticiero/estilos/*.json`. `components` define tamaños, prioridades, anchos y
zonas; `layout` define márgenes, separación, mínimos, interlineado y ranuras; `formatos` ajusta móvil y escritorio.
`estiloOverrides` en config/escena modifica tokens. `news` y `portrait`/`landscape` de un ítem permiten
excepciones visuales. Por defecto, `out` corta en el ancla declarada y no arrastra el gráfico a la siguiente noticia; `news.enter` y `news.exit` permiten ajustar la transición. Las posiciones antiguas son preferencias: el distribuidor las ajusta para evitar choques.
Los tamaños pequeños del prototipo se elevan al mínimo del estilo. Se mantiene la distribución original
al elegir Original o abrir una escena histórica sin `estilo`.

```json
{"estilo":"dynamic-news","estiloRevision":2,
 "hud":[{"type":"alert","text":"UN HECHO IMPORTANTE","detail":"Contexto breve y verificado",
         "kicker":"ÚLTIMA HORA","t":"@frase real","out":"@siguiente frase"},
        {"type":"key-figure","value":72,"suffix":" %","label":"CONTEXTO DEL DATO",
         "source":"Fuente y período","t":"@otra frase","out":"@cierre"}]}
```

Las cinco piezas nuevas son alerta (`alert`), titular (`headline`), cifra (`key-figure`), fecha (`date-card`)
y contexto (`message`). Sus demos no son hechos noticiosos. El catálogo mantiene las otras 18 piezas;
Original excluye las cinco que su renderer histórico no dibuja.

## Lectura y seguridad de composición

En 9:16 se reserva 8 % arriba, 12 % a la derecha y 22 % abajo; los márgenes son configurables.
La tipografía de cuerpo parte de 42 unidades de diseño (14 px en un cuadro de 360 px de lado corto).
El texto se mide, envuelve incluyendo palabras largas y se ubica en cajas sin superponerse. Los cintillos simultáneos se agrupan en un bloque de texto sin eliminar sus mensajes (`layout.groupTopics`); si las posiciones dejan huecos fragmentados, se intenta un reempaque compacto. Los marcadores
geográficos pueden usar líneas guía cuando se desplaza su etiqueta. El layout se recalcula de forma pura
por cuadro y orientación: seek hacia atrás no cambia el resultado. La caché de mediciones tiene límite.

No hay espacio infinito. El renderer devuelve `__newsHud.layout()` con `boxes`, `safe` y `overflow`.
Si una pieza no cabe, figura en overflow y no se debe declarar ese plano completo. Reparar el JSON:
secuenciar con anclas, reducir la cantidad simultánea, resumir o ajustar anchos/posiciones sin bajar del
mínimo legible. Validar en ambos formatos los momentos de mayor densidad; mirar también el video completo.

## API, Showcase y modal

La declaración `info.json → visual_styles` apunta al índice del motor compartido. El adaptador Sandbox
la conserva al resolver el diseño; no registra otro motor ni promueve el proyecto.
`GET /showcase/designs/<episodio>/styles` devuelve el ID canónico y los estilos; `/catalog/<id>?estilo=...&format=9x16`
entrega apariencia, mínimos y layout de la pieza. `/production-guide` evita volver a investigar el motor.
El selector ya existente del Showcase y el modal consume el mismo contrato.

`POST /showcase/designs/<id>/prepare` acepta el estilo y valida por separado `hud` y `layers` usando
los tipos declarados. Devuelve escena y configuración; no crea voz, modelos ni MP4. Esta validación
estructural no sustituye la revisión de espacio, geografía o fuentes. No habilita producción automática
del noticiero ni elimina la revisión de Sandbox.

Miniaturas: usar secuencialmente `scripts/generate_showcase_posters.py --design <id> --estilo dynamic-news`.
Las tarjetas muestran archivos estáticos; el globo solo se inicializa al abrir una reproducción.


## Ajuste visual para revisión del usuario · 2026-11-09

Se retiraron los paneles envolventes y las franjas verticales. Los textos mantienen familia, pesos y
tamaños; una sombra suave ayuda a leer sobre el satélite. Solo `alert` y `message` llevan un scrim
azul al 20 % detrás de cada línea, sin enmarcar imágenes. `news.textPlate` lo activa o desactiva.

`components.<tipo>.mediaScale` se aplica al medio, sin escalar nombres ni rótulos:
`chip: 1.3`, `portrait: 1.4`, `photo-frame: 1.6`. Se interpretó «605 %» como 60 % para la foto de apoyo.
La foto crece conservando proporción hasta el espacio libre de la zona segura; si ya lo llenaba en móvil, mantiene ese
límite. Si coincide con varios rótulos, reduce únicamente el medio hasta caber con todas las piezas. No se recorta el contenido por salir del cuadro. Iconos vectoriales propios de trazo uniforme,
sin fondo ni medallón; los glifos partidarios siguen siendo texto. Fotos sin tarjeta ni borde añadido.

La revisión 2 invalida las firmas de los posters anteriores. No se regeneran miniaturas, capturas ni
MP4 por instrucción expresa del usuario; revisar primero la reproducción desde modal o Showcase.
La comprobación automática de distribución no sustituye esa aprobación visual.

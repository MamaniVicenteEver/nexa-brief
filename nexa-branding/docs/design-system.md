# Sistema de diseño

Dirección: institucional y editorial. La identidad comunica especialización, cuidado y una finalidad explícita para cada canal. No se emplean emojis, degradados llamativos, sombras voluminosas ni controles con forma de píldora.

## Paleta

Fuente ejecutable: `src/styles/tokens.css`.

| Rol                 | Valor claro | Uso                                                   |
| ------------------- | ----------- | ----------------------------------------------------- |
| Primario · bosque   | `#172a22`   | Marca, acciones principales, pie, fondo institucional |
| Secundario · marfil | `#f3f0e8`   | Fondo editorial y áreas de lectura                    |
| Terciario · bronce  | `#80613d`   | Acentos editoriales, indicadores y enlaces            |
| Apoyo · salvia      | `#6b7b64`   | Equilibrio entre las marcas y detalles gráficos       |
| Superficie · papel  | `#faf8f3`   | Tarjetas y diálogos                                   |
| Tinta               | `#202820`   | Lectura principal                                     |
| Texto secundario    | `#60675f`   | Descripciones y metadatos                             |
| Borde               | `#d7d7cb`   | Separación de superficies                             |
| Foco                | `#526c9c`   | Navegación con teclado                                |

Tema oscuro: fondo `#101b16`, superficies `#18261e`, texto `#eeeade`, texto secundario `#afb6a9`, borde `#37473b`, acción `#d9ddcd` y acento `#c3a67e`. Nunca se cambia el color de texto aisladamente: se usa el rol semántico correspondiente. Cada canal tiene un acento editorial distinto en su configuración. Los emblemas y activos históricos mantienen su apariencia original.

## Tipografía

- **Newsreader Variable**: títulos y mensajes editoriales; pesos 400–500; interlineado 1.05–1.4.
- **Manrope Variable**: párrafos, navegación, botones y etiquetas; pesos 400–800; lectura 1.65–1.85.
- Fuentes locales mediante Fontsource, sin petición a Google Fonts en ejecución.
- Titular de portada: adaptable entre 51 y 83 px. Títulos de sección: 43–64 px. Cuerpo general: 15 px; introducciones: 16–18 px. Las etiquetas pequeñas se reservan para información auxiliar.
- Los nombres de marca se presentan en mayúsculas; los párrafos usan escritura natural.

## Componentes y estados

| Componente       | Geometría                            | Estados                                                 |
| ---------------- | ------------------------------------ | ------------------------------------------------------- |
| Botón primario   | radio 4 px, altura mínima 44 px      | normal, hover, foco visible, deshabilitado              |
| Botón secundario | radio 4 px, borde 1 px               | normal, hover, foco, deshabilitado                      |
| Acción discreta  | texto con icono de 16–18 px          | normal, hover y foco                                    |
| Botón de icono   | 42 px, radio 4 px                    | etiqueta accesible, foco visible                        |
| Tarjeta          | radio 7 px, borde 1 px, sombra sutil | hover de borde, enlaces independientes                  |
| Diálogo          | radio 10 px, máximo 92 svh           | abierto, cerrado, cierre por Escape, foco restaurado    |
| Pestaña          | borde inferior de 2 px               | seleccionada, no seleccionada, foco; flechas/Home/End   |
| Etiqueta de tema | radio 2 px, borde 1 px               | informativa, no aparenta botón                          |
| Avatar/emblema   | circular                             | el círculo comunica identidad, no se aplica a controles |

Espaciado: escala de 4, 8, 12, 16, 24, 32, 48, 64 y 96 px. Ancho de lectura y contenedor máximo: 1280 px. Adaptaciones principales: 1100, 900 y 650 px. Las tarjetas pasan de tres a dos y a una columna. El séptimo canal ocupa una tarjeta editorial amplia en escritorio.

## Iconografía

Lucide, trazos coherentes y tamaño funcional. Símbolos de las cuatro plataformas en SVG monocromo. Los iconos decorativos están ocultos al lector de pantalla; los controles que solo contienen icono tienen nombre accesible. Ningún emoji se utiliza como sustituto de un icono.

## Interacción y accesibilidad

Contraste legible en ambos temas; foco con contorno de 2 px y separación de 4 px; enlaces externos con `noopener noreferrer`; salto al contenido; navegación funcional sin depender de hover. El cambio de tema respeta la preferencia guardada. El menú móvil declara su estado expandido. Se respeta `prefers-reduced-motion` y el contenido esencial no depende de una animación.

## Tono

Concreto, humano y editorial. Cada marca explica qué cuenta, para quién tiene valor y por qué existe. No se inventan audiencias, clientes, premios, estadísticas ni promesas de resultados. Salud mental se presenta como divulgación y acompañamiento, con lenguaje respetuoso.

Guía navegable: `/identidad/`.

Comprobación de contraste: bronce `#80613d` sobre marfil supera 4.5:1. El texto secundario `#60675f` sobre marfil alcanza 5.12:1. Se mantiene un estado de éxito claro en tema oscuro.

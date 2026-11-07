# Imperio en el showcase

`stage.html?d=imperio&gallery&isolated=1` muestra las animaciones sin el atlas físico: no hornea mapas, no precalienta sus llaves y no dibuja tierra, océano, relieve ni rayados de países. Los componentes originales dibujan sol, haces, barcos, pines, textos y archivo usando **la misma proyección geográfica**.

Esta vista no es una variante de producción. El catálogo y sus ejemplos JSON son idénticos a los del diseño. Los videos siguen usando `country`, `sunAt`, `from`, `to`, `pins[].at`, `targets[].at`, `labels[].at`, `hatch`, etc. para componer las animaciones encima del mapa. No copiar el adaptador aislado a un episodio ni eliminar coordenadas por lo que muestra una miniatura.

`imperio-thumbs/index.json` describe los 23 componentes y sus fotogramas 9:16 y 16:9. Son capturas de esos componentes con el adaptador aislado. Los textos blancos comunes se presentan sobre un fondo liso para que se lean. `common.logo` es un registro obsoleto sin dibujo: se identifica como tal, no se simula un logo nuevo.

Las tarjetas cargan solo la imagen hasta pulsar reproducir; al detener o abrir un modal vuelven a la imagen. El modal conserva sus controles, abre en pausa y muestra el fotograma mientras prepara el componente. El primer cuadro no se anuncia listo antes de la tipografía de `common.tabloid`.

Al cambiar ejemplos o componentes, regenerar ambas orientaciones desde `stage.html` con `solo&gallery&isolated=1&t=<frameTime>` y esperar `__promo.seek(t)` más `__tabloidFontReady`, si existe. Capturar `#stage`, no solo el canvas (algunos componentes usan DOM). Verificar que el catálogo no cambie y que `Kit.imperio.keyStats()` tenga cero llaves y cero cola. Ejecutar `node --test .../showcase/imperio-isolated.test.mjs`.

`imperio.outrov2` añade GRACIAS POR VER un 45 % mayor, tipografía en negrita y botones LIKE/SUSCRÍBETE rojo sangre oscuro (`#700B1B`). Reutiliza el cierre original: `thanksScale`, `textWeight` y `actionColor` se declaran en el catálogo JSON, junto con los textos y tiempos habituales. Su fotograma a 4,8 s muestra las dos acciones y el mensaje de apoyo.

La selección de Imperio ahora viene de `design.json.showcase.components`: 23 piezas propias. Se excluyen de esta biblioteca los common.* que no usa el video de expansión de Japón, sin eliminarlos del motor ni de otros episodios. Se promovieron la campaña y el archivo de ese video y se exponen sus piezas internas reutilizando las mismas funciones; consultar `designs/imperio/catalog.json` y `REUSE.md`. La muestra de footage usa el clip histórico original, no demo.mp4.

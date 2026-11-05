# Blender o imágenes generadas: por qué las unidades del mapa se hicieron en Blender

Fecha: 2026-11-03 · Proyecto: «Atlas en Movimiento» (`sandbox/nodehistory/atlas-en-movimiento`)

Este documento explica una decisión técnica y deja a mano lo necesario por si estos componentes se venden o se muestran a un tercero.

## 1. Dónde verlo

| Qué | URL | Nota |
|---|---|---|
| Biblioteca de componentes (Showcase) | `https://dev-nexa-brief.everdev.space/showcase` | Elegir el diseño «Atlas en Movimiento». Pestañas: Prototipo, Biblioteca (86) y Sprites (el contador sube a 269 entradas al unir las tres tandas de sprites). Cada tarjeta abre un modal con reproductor en vivo, parámetros y JSON de ejemplo. |
| Mismo Showcase en la red local | `http://192.168.20.2:3000/showcase` | Solo desde la red local. |
| Demo de 4:22 (en preparación, sin grabar) | `https://dev-nexa-brief.everdev.space/plantillas?cat=sandbox` | Prototipo «Atlas en Movimiento». |

Son URLs de **desarrollo** con inicio de sesión. Para enseñarlas a un comprador hace falta una demostración pública aparte (ver sección 6).

## 2. La pregunta

¿Por qué modelar vehículos en Blender si hay un generador de imágenes que hace una ilustración en segundos y se le puede pedir exactamente cómo la queremos?

## 3. Qué exige cada unidad del mapa

El motor no pega una ilustración: mueve, gira, tiñe y cambia el estado de cada unidad. Eso impone cinco requisitos a la vez:

1. **El mismo objeto en muchas versiones.** 13 vehículos terrestres × 3 pinturas (oliva, desierto, camuflaje) × 4 estados (normal, detectado, en llamas, destruido). El tanque «en llamas» debe ser el mismo tanque que el «normal».
2. **Vista exactamente cenital, con la proa siempre arriba**, para que al girar por su rumbo se vea bien.
3. **Fondo transparente y sombra separada**, que se lean igual sobre el mar oscuro y sobre el desierto claro.
4. **Misma luz y misma escala en todo el catálogo**, para que el mapa no parezca un collage.
5. **Piezas que se animan por separado** (rotores, orugas, torretas).

## 4. Comparación

| Criterio | Blender (lo que hicimos) | Imágenes generadas |
|---|---|---|
| Tiempo por pieza | Alto: horas de modelado y render en total | Muy bajo: segundos |
| Coherencia entre estados y pinturas | Total: salen del mismo modelo | Débil: cada imagen es un dibujo nuevo y los detalles derivan |
| Vista cenital exacta | Garantizada (cámara ortográfica) | No garantizada: tiende a vistas inclinadas |
| Fondo transparente y sombra aparte | Directo, con máscara de sombra | Hay que recortar: bordes sucios y halos |
| Repetir o corregir una pieza | Cambias el modelo y se rehacen las 200 imágenes idénticas | Regenerar cambia todo lo demás |
| Partes animables | Sí, por separado | No, es una imagen plana |
| Realismo de una sola imagen | Bueno, no fotográfico | Puede ser más fotorrealista |
| Control con palabras | Indirecto | Directo y muy cómodo |
| Propiedad y procedencia | Modelos propios, procedimentales | Depende de los términos del generador y de la revisión caso a caso |

## 5. Dónde sí conviene generar imágenes

- Texturas de pintura, camuflaje, óxido y polvo que alimenten los materiales de Blender.
- Miniaturas de YouTube, pósters y portadas.
- Ilustraciones sueltas y arte de concepto antes de modelar.

Regla ya vigente del proyecto: nada generado con IA se presenta como documento o fotografía histórica real.

**Prueba pendiente (no hecha):** 3 tanques cenitales con sus 4 estados cada uno. Se juzgan por tres cosas: ¿es el mismo tanque en los 4 estados?, ¿la vista es realmente cenital?, ¿el recorte sirve sobre mar y desierto? Si pasa, se usan imágenes generadas para unidades secundarias. No hemos probado generar sprites con un generador de imágenes en este proyecto; lo anterior es una valoración general, no una medición.

## 6. Si vendemos o mostramos estos componentes

**Qué se entrega y su estado, según el trabajo hecho:**

- **Biblioteca táctica:** 86 componentes (territorios y banderas, unidades terrestres, barcos y portaaviones, aviones, efectos, ataques, economía, retratos y prensa, intro y cierre), validados por script y con galería en vivo.
- **Sprites de Blender:** 24 siluetas militares, 50 libreas y 200 PNG de estados con sombra y tinte, validación sin errores (`sprites3/validation.json`), y los 24 modelos `.blend` guardados. Más los sprites originales de barcos, mercantes, submarino y aviones.
- **Motor de mapa plano:** 159 ms por cuadro en 1080×1920 con desenfoque de movimiento; determinista (mismo cuadro con cualquier orden de búsqueda).
- **Demo:** 4:22 en siete bloques, voz Charon (Gemini TTS) y 15 efectos.

**Revisar antes de vender (no es asesoría legal):**

| Elemento | Origen | Qué comprobar |
|---|---|---|
| Sprites y modelos | Creados en este proyecto con Blender, modelado procedimental, sin modelos descargados | Confirmar en `sprites3/validation.json` y en los informes de cada tarea que no entró ningún activo externo |
| Efectos de sonido | SFXMint, licencia CC0 | Conservar las fichas con URL y hash en `work/sonido/` |
| Retratos y fotos de archivo | Wikimedia Commons: dominio público, CC BY y CC BY-SA | CC BY y CC BY-SA exigen atribución y, en BY-SA, compartir igual: ver `assets/media/credits.json`. Valorar sustituirlos o excluirlos en una venta |
| Mapa base | NASA GIBS Blue Marble y Natural Earth | Verificar los términos de cada fuente y citar la atribución que ya muestra el mapa |
| Tipografías | Anton y Archivo | Licencias incluidas junto a los archivos de fuente; revisar que permiten uso comercial |
| Voz | Gemini TTS | Revisar los términos de uso de Google para audio sintético en productos comerciales |
| Código de Blender | Blender es GPL | Lo renderizado por nosotros es nuestro; no se distribuye Blender |

**Para una demostración pública:** exportar una versión estática del Showcase sin inicio de sesión y sin datos de cuentas reales, con los retratos y fotos de terceros fuera o con sus créditos visibles.

## 7. Estado en una línea

Se mantiene Blender para todas las unidades del mapa por coherencia y repetibilidad; las imágenes generadas se reservan para texturas, miniaturas y arte conceptual, a la espera de la prueba de 3 tanques.

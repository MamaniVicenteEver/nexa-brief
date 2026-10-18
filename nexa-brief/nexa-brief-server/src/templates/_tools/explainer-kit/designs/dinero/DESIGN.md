# DINERO · NODECONOMY

Réplica del lenguaje de una pieza tipográfica cinética sobre dinero: didona verde, fieltro, billetes en teal, letras 3D con monedas, bloques salvia y dibujos planos sobre negro verdoso. Es una identidad reutilizable para historias económicas; las fotos y palabras concretas vienen de cada storyboard.

## Referencia y medición

- Referencia: `sandbox/nodeeconomy/From Klickpin.com- Save Beautiful minimalist bedroom decor that make your next project look polished and expensive for ideas worth saving right no (1).mp4`.
- Duración medida: **16,7667 s**, 720×540, 30 fps (503 cuadros). `ffmpeg select='gt(scene,0.2)'` detecta cambios destacados desde 0,5667 s; la pieza también usa cortes internos muy rápidos, por eso la tabla agrupa las ráfagas en un solo movimiento.
- Hoja de control anterior: `scratchpad/d1/f/` (cuadros a 10 fps); capturas preliminares de componentes: `scratchpad/d1/h*.jpg`, `s*.jpg` y `k/*.png`.

### Paleta muestreada

Los valores de `design.json` son aproximaciones redondeadas a partir de las zonas planas de la hoja. En los planos de foto hay más variación por el material de origen.

| Uso en la referencia | Muestra aproximada | Variable del diseño |
|---|---:|---|
| Negro verdoso de fondo | `#001010` | `bg` `#020c0f` |
| Verde medio de la ilustración | `#88a078` | `sage` `#7d986f` |
| Fieltro / palabra verde oscura | `#204020` | `felt` `#2a5424`, `deep` `#145027` |
| Verde intenso de palabras/acento | `#185828` | `green` `#12721e`, `leaf` `#3a7e40` |
| Gris papel de monedas | `#a0a098` | `paper` `#cac5c0` (con degradé y viñeta) |
| Blanco del ojo y del texto | `#f8f8f8` | `white` `#fcfaf8` |
| Billetes bajo luz fría | `#589888` | `teal` `#3f7a70` |

### Tipografía

- **Oranienbaum**: equivalente disponible en Google Fonts para la didona serif estrecha y contrastada de `MONEY`.
- **Montserrat 200/300**: rótulos blancos finos y elegantes sobre fieltro.
- **Open Sans 600–800**: bloques pesados, palabras de alto impacto, tarjetas y ojos.

El render carga esas fuentes antes de dibujar. Se conserva el tamaño relativo y la entrada de letras; no se incorpora una tipografía local que el repositorio no tiene.

## Partitura visual de la referencia

| Tiempo aprox. | Movimiento / transición observados | Componente |
|---:|---|---|
| 0,00–1,07 | `MONEY` didona verde oscuro sobre niebla gris verdosa; cámara acercada que sigue las letras, foto plateada entra desde la izquierda y alejamiento corto. | `dinero.title` / `dinero.serif` |
| 1,07–1,95 | Ráfaga de billetes: primer plano desenfocado, nuevo recorte girado, cuadro de barrido oscuro y último acercamiento. | `dinero.cash` |
| 1,95–3,15 | `MONEY` Montserrat fina y luminosa sobre fieltro, cursor, segunda línea, barrido, destello y subrayado trazado. | `dinero.neon` |
| 3,15–3,80 | Manos contando billetes en teal, paneo leve y texto fino superpuesto que se resuelve. | `dinero.count` |
| 3,80–8,40 | Palabras 3D sucesivas (“Dirty”, “Cash”, “Need”, “YOU”), giro, saltos de cámara y desenfoque; monedas de oro caen en capas. Alrededor de 5,5 s, la imagen rebota dentro de un lente ojo de pez redondeado. | `dinero.spin` |
| 8,40–9,50 | `MONEY TALKS` en bloque verde gigante; una barra asciende con un billete y la cámara se aleja. | `dinero.block` |
| 9,50–10,60 | Palabra 3D con ojo y rayas; se transforma en perfil plano negro con ojo blanco y tarjeta `TRY UNTIL SUCCESS`. | `dinero.head` |
| 10,60–11,55 | Rótulo mínimo centrado en una tarjeta blanca. | `dinero.note` (`bg: white`) |
| 11,55–12,25 | Persona-alfil verde asciende desde abajo; anillo blanco se cierra alrededor de su cabeza. | `dinero.pin` |
| 12,25–14,25 | Palabras rellenas y contorneadas aparecen sobre negro verdoso, con escala, posiciones y acento variable. | `dinero.outline` |
| 14,25–15,45 | Ojo almendrado verde y blanco, enorme y recortado al inicio; la cámara retrocede mientras entra el texto lateral. | `dinero.eye` |
| 15,45–16,00 | Ojos blancos de tamaños distintos flotan y miran; `NEED YOU` queda al centro. | `dinero.eyes` |
| 16,00–16,77 | `HUH!` pequeño y blanco sobre negro, tras un corte breve. | `dinero.note` (`bg: black`, tamaño reducido) |

Las transiciones se resuelven con `fx` en el componente que entra: barrido, mancha orgánica, fuga de luz, píxeles, barrido de señal, zoom o destello. El cruce de imagen anterior se conserva solo para las entradas `blob` y `pixel`, que necesitan revelar el plano nuevo encima.

## Componentes disponibles

| Componente | Uso |
|---|---|
| `dinero.title`, `dinero.serif` | Didona verde, entrada letra por letra, foto y retroceso de cámara. |
| `dinero.cash`, `dinero.count` | Ráfaga de billetes y foto de conteo con texto superpuesto. |
| `dinero.neon` | Tipografía fina luminosa sobre fieltro, segunda línea y subrayado. |
| `dinero.spin` | Palabras 3D, monedas, desenfoque y lente ojo de pez. |
| `dinero.block` | Titular sans gigante y barra/billete ascendente. |
| `dinero.head` | Palabra con ojo que vira a perfil y tarjeta ilustrada. |
| `dinero.note` | Pausa tipográfica mínima sobre blanco, salvia o negro. |
| `dinero.pin`, `dinero.outline` | Alfiler-persona y tipografía de contorno/relleno. |
| `dinero.eye`, `dinero.eyes` | Ojo gigante y conjunto de ojos flotantes. |
| `dinero.introv1`, `dinero.introv2` | Gancho de impacto y pregunta/revelación con fondos compatibles con `common/hook.js`. |
| `dinero.outro` | Cierre sin recuadro en el orden requerido por el contrato común. |

## Diferencias y límites

- No se reutiliza el auto ni el metraje de la referencia. En el demo se usan fotos licenciadas ya presentes en el repositorio (billetes, manos, monedas, retratos y Dartmouth), tintadas con la paleta. Esto preserva escala, color y ritmo, aunque el contenido fotográfico cambia.
- Las letras 3D y el ojo de pez se construyen en canvas 2D con transformaciones, capas y una malla determinista; no dependen de WebGL ni de un reloj externo.
- La fuente original exacta no está identificada; Oranienbaum/Montserrat/Open Sans son las sustituciones disponibles que conservan la jerarquía y el contraste.
- El video de muestra emplea la narración existente de Dartmouth para no generar voz nueva. La secuencia inicial del storyboard conserva el orden de la referencia, por lo que algunas imágenes de dinero ilustran una narración de otro tema: es una demo del diseño, no un video terminado para publicar.
- 9:16 redistribuye títulos y motivos para aprovechar el alto disponible; no es un recorte del encuadre 16:9.

## Verificación visual

Se capturaron los componentes en `showcase/stage.html` con `tools/shoot.py --orient both`, usando `d=dinero` y `prev=dinero.title` para el stage nuevo. Las hojas están en `scratchpad/codex/dinero/`; muestras clave: `title-stage.png`, `cash-early-stage.png`, `spin-lens-stage.png`, `block-stage.png`, `head-stage.png`, `outline-stage.png`, `eye-stage.png`, `eyes-stage.png`, `introv1-stage.png`, `introv2-stage.png` y `outro-stage.png`. Las ejecuciones terminaron sin errores ni avisos `[kit]`. Se inspeccionaron las hojas vertical y horizontal; la forma principal ocupa el encuadre y no hay cortes de los títulos de prueba.

## Lecciones

- Para comparar movimientos rápidos, capturar cuadros cercanos al inicio del componente: una ráfaga de menos de un segundo ya está en su último billete a los 0,6 s.
- El stage necesita `d=dinero` explícito mientras su lista local de prefijos no contenga esta familia; `prev=dinero.title` evita el fallback a `binary.icon`.
- Las fuentes de fotos cambian en el demo, pero conviene mantener los encuadres y tratamientos (`silver`, `cash`, `dark`) separados: la transición de dinero a texto verde depende del contraste, no de saturar toda la pieza.

## Demo con narración existente

`sandbox/nodeeconomy/dinero-demo/` conserva la canción, el guion y la transcripción del video de producción `nodetech/nacimiento-ia-dartmouth` (el ángulo asignado con cifras de financiación de la propuesta de Dartmouth). El storyboard tiene 69 beats: los primeros 16,77 s fijan los cortes medidos de la referencia; desde el remate `HUH!`, el resto sigue las anclas de `lyrics.json`. Seis momentos `common.lyric` quedan como overlays karaoke y el runtime agrega `dinero.outro` durante los últimos 6 s.

Las fotos sustituyen al auto de la referencia por fajos y conteo de dinero, y luego incorporan Dartmouth, McCarthy y Shannon cuando la narración los nombra. Se usan nueve fotos; `minsky.jpg` permanece descargada y acreditada, pero no se usa. El material de voz no tiene `song-with-outro.mp3`: el cierre es visual y cae sobre el audio existente, sin voz nueva. Esta carpeta es una demo de estilo, no una pieza lista para publicar, porque conserva la narración de historia de la IA bajo los primeros planos tipográficos sobre dinero.

## Validación de la demo

- `kit.py check dinero-demo`: **OK, 0 errores**. Los avisos de planos principales menores a 1,5 s corresponden a los cortes rápidos de la referencia.
- `kit.py manifest dinero-demo`: **listo**, 213,55 s, 69 beats y seis momentos `common.lyric`.
- `kit.py sheet dinero-demo --orient both`: hojas inspeccionadas en 9:16 y 16:9 dentro de `sandbox/nodeeconomy/dinero-demo/work/`.
- `kit.py render dinero-demo --seconds 20`: muestra de movimiento de 20 s en `sandbox/nodeeconomy/dinero-demo/render/preview/`.
- La navegación local intenta primero `config.json` en la raíz de la demo y recibe 404; luego carga correctamente `assets/config.json` según el fallback del loader. No hay avisos `[kit]` ni recursos de imagen faltantes.

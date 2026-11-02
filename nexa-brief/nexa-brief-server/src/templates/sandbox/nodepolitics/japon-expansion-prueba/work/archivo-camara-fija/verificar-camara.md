# Verificación de cámara · japon-expansion-prueba

**Resultado: queda un alejamiento con giro en el cierre automático, que empieza en 115,12 s.** La apertura, el archivo y la campaña tienen cámara fija dentro de cada plano; los cambios de encuadre se cuentan aparte.

## Método y alcance

Se ejecutó [medir.py](../camera-check/medir.py) desde esta plantilla, con Playwright del `.venv` del backend y Chromium headless. Reutiliza el servidor HTTP con soporte Range de `shoot.py`, abre `index.html?paused&t=0` y espera cada `await window.__promo.seek(t)` antes de capturar. No se generó video.

| Formato | Resolución PNG / viewport, DPR 1 | Muestreo | Capturas | Pares consecutivos |
|---|---|---|---:|---:|
| 16:9 | 1280 × 720 | 0–119 s, cada 0,5 s | 239 | 238 |
| 9:16 | 720 × 1280 | 0–118 s, cada 2 s | 60 | 59 |

Los PNG completos están en `/tmp/camera-check/{16x9,9x16}/frame-*.png`. Se guardó también `atlas-*.png`: una copia del lienzo inmediatamente después de `IM.mapCache.draw`, antes de superponer video, humo, sol, rayos, flechas, banderas y títulos. La copia se obtiene mediante una envoltura añadida **solo a la respuesta HTTP del navegador de auditoría**; conserva los argumentos y el retorno originales y no cambia archivos fuente. Así se puede medir relieve y costas incluso cuando el metraje ocupa toda la pantalla. El atlas conserva sus cambios de gris, rayado y rótulos: el ajuste robusto tolera esas variaciones locales.

Se redujo el gris al 50 % y se ajustó una similitud de cuatro parámetros mediante **SIFT + RANSAC**: traslación, escala y giro. Filtro de descriptores 0,74; tolerancia RANSAC 1,6 px originales; mínimo 10 puntos concordantes, distribuidos en al menos cuatro celdas de una grilla 4 × 3 y con extensión mayor al 20 % del ancho y alto. Se excluyen bordes y la zona inferior de subtítulos. Se estima también el movimiento sobre los PNG completos, aceptando solo puntos cuyo parche correlaciona ≥0,60 con el atlas en ambos cuadros; esta segunda medición sirve de contraste, porque archivo y texto pueden ocultar el mapa.

Los valores de píxeles de este informe están reconvertidos a la resolución original. **Traslación** significa desplazamiento del centro del cuadro por la transformación estimada; **desplazamiento de puntos** es la mediana del movimiento geométrico de las costas/relieves concordantes. Un zoom alrededor del centro puede tener traslación casi nula y, sin embargo, mover claramente todo el terreno. La escala negativa indica alejamiento; el giro positivo, giro horario en pantalla.

Como comprobación independiente se registraron la cámara y la matriz usadas realmente en cada dibujo, sin alterar sus valores. Los tres lienzos visibles mantienen `transform: none` en todas las capturas.

## Umbral y controles

Se marca movimiento continuo si, fuera de un corte, el ajuste válido del atlas supera **0,50 px de traslación**, **0,10 % de cambio de escala** o **0,05° de giro** por par.

| Ruido empírico máximo en planos de cámara constante | 16:9, 228 pares | 9:16, 55 pares |
|---|---:|---:|
| Traslación del centro | 0,1032 px | 0,0205 px |
| Cambio absoluto de escala | 0,01728 % | 0,00314 % |
| Giro absoluto | 0,01623° | 0,00385° |
| Mediana de desplazamiento de puntos | 0,0497 px | 0,0251 px |

Los umbrales superan respectivamente en 4,8, 5,8 y 3,0 veces el peor ruido observado. Los percentiles 99 del atlas en 16:9 son 0,0714 px, 0,01208 % y 0,00693°. Se usaron como controles los tramos cuyos parámetros de cámara permanecen constantes, excluyendo cambios de escena; las pequeñas estimaciones residuales provienen de rasterización y cambios fotométricos, no de una trayectoria de cámara.

- Repetir exactamente 2, 14, 36, 80 y 116 s en ambos formatos dio **diferencia de píxel 0** y movimiento estimado 0.
- Control positivo sobre el atlas: una traslación artificial de (+4, −3) px se recuperó como (+3,993, −2,972) px en 16:9 y (+4,010, −2,996) px en 9:16. Un cambio de escala de −1,50 % y giro de +0,25° se recuperó como −1,492 % / +0,253° y −1,494 % / +0,249°, respectivamente.
- Ocho capturas sin instrumentación, en 2, 14, 36 y 116 s de ambos formatos, fueron **idénticas píxel por píxel** a las instrumentadas: [probe-validation.json](../camera-check/probe-validation.json).
- Sobre la imagen compuesta, el archivo produce ruido de registro de hasta 1,964 px y 0,472 % aun con cámara constante. Por eso el criterio principal usa la capa de atlas, no una correlación indiscriminada del cuadro completo.

## Intervalos con movimiento global superior al ruido

**Único tramo continuo detectado: el cierre, desde 115,12 s.** El comienzo exacto procede del beat resuelto y de la fórmula de cámara; el par 115–115,5 s incluye el corte de entrada y se excluye del cómputo de movimiento continuo. Los siete pares interiores de 16:9 y el par interior de 9:16 superan el umbral:

| Formato | Intervalo medido (s) | Traslación del centro (px) | Desplazamiento de puntos, mediana (px) | Escala | Giro |
|---|---|---:|---:|---:|---:|
| 16:9 | 115,5–116,0 | 0,018 | 5,026 | −1,743 % | +0,198° |
| 16:9 | 116,0–116,5 | 0,006 | 5,028 | −1,717 % | +0,197° |
| 16:9 | 116,5–117,0 | 0,030 | 5,023 | −1,692 % | +0,197° |
| 16:9 | 117,0–117,5 | 0,006 | 5,069 | −1,660 % | +0,199° |
| 16:9 | 117,5–118,0 | 0,011 | 4,856 | −1,629 % | +0,202° |
| 16:9 | 118,0–118,5 | 0,025 | 4,931 | −1,601 % | +0,203° |
| 16:9 | 118,5–119,0 | 0,011 | 4,915 | −1,584 % | +0,196° |
| 9:16 | 116,0–118,0 | 5,158 | 20,504 | −6,531 % | +0,799° |

El ajuste del atlas en el cierre tiene 709–770 puntos concordantes por par horizontal, repartidos en las 12 celdas; el control vertical tiene 572. En 16:9, el máximo desplazamiento de puntos por medio segundo llega a **10,976 px**. En 9:16, el vector del centro es **(−1,061, −5,048) px**, con máximo de puntos de **34,739 px**: el pivote vertical está en `0,44 × H`, no en el centro geométrico (`_imperio.js:315`), de modo que también se desplaza el centro del cuadro al alejarse y girar.

Comparación directa acumulada entre 115,5 y 119 s en 16:9: **−11,057 % de escala**, **+1,398°**, **34,333 px de desplazamiento mediano** y **70,526 px máximo**, con 577 puntos concordantes. No se sumaron porcentajes de pares para obtener esta cifra.

**Antes de 115,12 s: ningún movimiento continuo superior al umbral.** Hay un ajuste válido de atlas para los 236 pares horizontales y los 57 verticales que no son cortes; ningún fallo de registro se interpretó como movimiento cero. La imagen compuesta tiene 27 y 9 pares no válidos, respectivamente, por oclusiones/cortes; la capa aislada resuelve todos los pares sin corte.

## Cortes y cambios de escena, separados del movimiento

Los tiempos exactos provienen de los beats resueltos, contrastados con los cambios de cámara y las imágenes; no se usó solo una diferencia de brillo, porque el archivo y sus fundidos también cambian casi toda la pantalla.

| Tiempo exacto | Pares que lo contienen, 16:9 / 9:16 | Clasificación y evidencia |
|---|---|---|
| 10,23 s | 10–10,5 / 10–12 s | Entrada de `imperio.footage` con fundido, **sin reencuadre**: sigue `[137,33,66,0]`. Atlas: 0,020 px / −0,0032 % en 16:9; 0,027 px / +0,0010 % en 9:16. No es vuelo de cámara ni corte geográfico. |
| 19,79 s | 19,5–20 / 18–20 s | **Corte de encuadre a campaña**, con fundido de entrada de 0,60 s. Pasa de `[137,33,66,0]` a `[149,015;29,011;145,596;0]` en horizontal y span 159,893° en vertical. La relación de escala de los parámetros salta −54,669 % / −58,722 %; es un salto entre dos vistas fijas, no una interpolación. El registro horizontal entre vistas no es válido y se conserva marcado como tal. |
| 115,12 s | 115–115,5 / 114–116 s | **Corte a `imperio.outro`**, desde Asia/Pacífico al atlas centrado en `[30,32]`. Cambian más de 25 niveles de gris el 89,12 % / 89,36 % de los píxeles reducidos. La diferencia media es 54,31 / 64,75 niveles. Se excluye este par del movimiento continuo; después del corte sí continúa el zoom con giro medido arriba. |

No hay otros cambios de encuadre entre las muestras. Los rótulos `imperio.word` de 12,37–17,37 s y 108,79–113,79 s son overlays sobre un plano con mapa que sigue activo; tampoco son cortes. Los tres segmentos de archivo de la campaña cambian luminancia y contenido, conservando la cámara de campaña.

## Causa en el código

La causa del movimiento del cierre está confirmada por las imágenes y por la cámara registrada, no solo sugerida por similitud visual:

1. Aunque `assets/storyboard.json` tiene cinco beats, el runtime añade un **sexto beat**: `imperio.outro`, entre **115,12 y 120,12 s**. Lo habilita `_tools/explainer-kit/designs/imperio/design.json:77` (`enabled: true`, `dur: 5`, `use: imperio.outro`). `assets/config.json` no lo sobreescribe. `_tools/explainer-kit/engine/kit.js:315` lo añade automáticamente y la línea 320 calcula su inicio.
2. `_tools/explainer-kit/designs/imperio/components/outro.js:45` crea `HK.background(ctx,p)` y la línea 64 lo dibuja. El fondo `auto` elige **atlas** en `components/intros.js:86`; `country` está vacío por defecto en `outro.js:39`, por eso el encuadre cambia al atlas centrado en longitud 30°, latitud 32°.
3. **Línea que produce el movimiento:** `_tools/explainer-kit/designs/imperio/components/intros.js:61`:

   ```js
   const q = clamp(lt / Math.max(3, b.dur)), cam = IM.zoomCam(base, 1 + 0.18 * q, 2 * q)
   ```

   Para este beat de cinco segundos, `lt = t − 115,12`, `q = lt/5`, `span = 110 × (1 + 0,18q)` y `rot = 2q`. Esto aleja y gira el atlas durante todo el cierre. `_imperio.js:260` aplica el factor al span; `_imperio.js:314` convierte el span a escala de pantalla inversa. Por ejemplo, los parámetros registrados pasan de span **113,4848° / giro 0,352°** en 116 s a **121,4048° / 1,152°** en 118 s: predicen **−6,5236 % / +0,8000°**, frente a **−6,5311 % / +0,7991°** medidos en el control vertical.

Las correcciones anteriores sí funcionan en los planos solicitados: `assets/storyboard.json:17` y `:23` fijan `from` y `to` iguales en la apertura; `:79` y `:95` hacen lo mismo en el archivo. La única cámara de campaña lleva `t: 0` y `cut: true` en `:679`; `assets/components/japon.js:219` convierte ese caso en un segmento de duración cero con `from === to`, y las líneas 235–237 mantienen esa cámara. El archivo y los tres vídeos de campaña usan recorte fijo `z = 1.06` en `japon.js:389` y `:247`.

Existe además una deriva de fondo general en `_imperio.js:874` (`1 + 0.01*dt`, `0.04*dt`), pero **no se activa en los tramos medidos**: `backdrop()` sale cuando hay un plano `opaque` activo (`:868`), y los textos son overlays. No es la causa de este hallazgo.

## Datos, reproducción y límites

- [pairs-16x9.csv](../camera-check/pairs-16x9.csv) y [pairs-9x16.csv](../camera-check/pairs-9x16.csv): una fila por par, con desplazamiento, escala, giro, validez, cortes y clasificación de movimiento; sus versiones JSON conservan las matrices y el detalle del registro.
- [captures.json](../camera-check/captures.json): beats resueltos, cámara/matriz de cada dibujo, transformaciones CSS y hashes SHA-256 de las fuentes antes/después.
- [summary.json](../camera-check/summary.json): umbrales, ruido, controles positivos, repeticiones, cortes y comparación acumulada. Los hashes de las fuentes permanecen iguales al finalizar.
- Las capturas de ambos formatos tardaron **145,3 s**. No hubo errores JavaScript; los dos avisos HTTP 404 corresponden al intento esperado de `config.json`, seguido de la carga correcta de `assets/config.json`, confirmado en la validación sin instrumentación.

Para repetir todo desde esta carpeta:

```bash
/home/alfred/Projects/Git-Projects/nexa-brief/nexa-brief/nexa-brief-server/.venv/bin/python -B work/camera-check/medir.py
```

`--analyze` reutiliza los PNG; `--summarize` reutiliza los registros de pares. El muestreo pedido no cubre imágenes posteriores a 119 s ni garantiza por sí solo detectar un movimiento que ocurriera y volviera entre dos muestras; en los tramos fijos se complementa con la comprobación de las funciones de cámara. El código del cierre prevé que su movimiento continúe hasta 120,12 s; esa cola queda fuera del rango capturado. No se editaron el storyboard, los componentes, el HTML, lanzadores ni herramientas compartidas, ni se reiniciaron servicios. Neutralidad revisada: la auditoría no cambia contenido narrativo ni posturas.

## Conclusión — tres frases

La apertura, el archivo y la campaña mantienen el mapa fijo dentro del ruido medido, salvo sus cortes de encuadre.
Queda un alejamiento y giro en el cierre automático desde 115,12 s, con −11,057 % de escala y +1,398° acumulados entre 115,5 y 119 s en 16:9, confirmado también en 9:16.
La causa es la fórmula de cámara del fondo atlas en `designs/imperio/components/intros.js:61`, invocada por `imperio.outro`, y esta entrega solo la documenta.

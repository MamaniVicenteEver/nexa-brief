# Consumo de recursos del render de «Programadores de la nueva era»

Estudio del render del 24 de octubre de 2026 en i3-8100 de 4 núcleos, 7,1 GB de RAM, 4 GB de swap y `/tmp` tmpfs de 3,6 GB. El CSV aporta 171 muestras entre 18:56:11 y 19:28:22; el muestreo empezó con la primera captura ya en curso y terminó a las 19:28:32. Las series de Netdata cubren la misma ventana.

## Resultado y tiempos

| Formato | Archivo / dimensiones | Duración, cuadros y tasa del MP4 | Captura de cuadros | Codificación FFmpeg | Resultado |
|---|---|---|---|---|---|
| 9×16 | `programadores-nueva-era-9x16.mp4` · 1080×1920 · 56,3 MB | 682,733 s (11:22,733), 20.482 cuadros, 30 fps | ≈16 min 30 s · ≈20,7 cuadros/s **(estimación)** | ≈2 min 24 s; FFmpeg aparece desde 19:07:33 y el MP4 queda escrito a las 19:09:57 | OK: H.264, AAC mono a 48 kHz; duración de audio 682,730 s |
| 16×9 | `programadores-nueva-era-16x9.mp4` · 1920×1080 · 49,8 MB | 682,733 s (11:22,733), 20.482 cuadros, 30 fps | ≈16 min 06 s · ≈21,2 cuadros/s **(aprox.)** | ≈2 min 21 s; FFmpeg aparece desde 19:26:06 y el MP4 queda escrito a las 19:28:27 | OK: H.264, AAC mono a 48 kHz; duración de audio 682,730 s |

`ffprobe` confirmó duración, cuadros, 30 fps y audio en ambos archivos. Las copias de `output/node_tech/rough/programadores-nueva-era/8d21f129/` coinciden byte por byte con las de `render/`.

La primera captura ya estaba activa en la primera muestra del CSV. Su inicio y su tasa no se pueden medir exactamente: estimé ≈16:30 descontando los ≈700 MB de ocupación preexistente que se sospechaba en `/tmp` y usando ≈86 KB por JPEG. La segunda captura queda delimitada por el cambio de Chrome a FFmpeg alrededor de 19:26; su inicio se aproxima con la muestra de 19:10. Por eso las tasas de captura son aproximadas, mientras que la duración y tasa de reproducción de los MP4 sí se verificaron directamente.

## Recursos y fases

| Fase observada | CPU ocupada, media / pico | RAM disponible mínima | Swap usada máxima | `/tmp` usado máximo | RSS máximo del proceso principal |
|---|---:|---:|---:|---:|---:|
| Captura con Chromium (145 muestras, dos tramos) | 67,5% / 91,6% | 756 MB | 2.077 MB | 2.212 MB | Chromium 3.103 MB |
| Codificación con FFmpeg (26 muestras, dos tramos) | 88,1% / 91,9% | 1.499 MB | 1.911 MB | 1.681 MB | FFmpeg 1.308 MB |

- **CPU:** Netdata da ≈70% de uso medio y ≈90% de pico para la máquina; la carga de 1 minuto llegó a 8,18 en 4 núcleos. FFmpeg mantuvo la CPU ocupada cerca del 88%, con espera de IO media de solo 0,27% (pico 7,3%). La codificación parece limitada principalmente por CPU; no hay señal de que el disco la limitara de forma sostenida.
- **RAM y swap:** el mínimo de RAM disponible fue 756 MB, cerca del 11% de los 7,1 GB. La swap llegó a 2.077 de 4.096 MB (51%); quedó aproximadamente la mitad libre. El pico de Chromium fue 3,1 GB RSS.
- **`/tmp`:** pico registrado de 2.212 MB de 3,6 GB (≈61%); quedaron alrededor de 1,4 GB. Netdata midió el pico como 2,16 GiB. `lsof +L1 /tmp` no mostró archivos borrados aún abiertos al revisar, después de terminar el render; no permite confirmar ni descartar qué causó la ocupación extra histórica de ≈700 MB.
- **Disco e IO:** `/` reportó 56 GB usados de 98 GB, con 37 GB disponibles, y el monitor mantuvo el uso en 56 GB. Netdata observó ≈2,2 MiB/s de IO combinado de media y un pico de ≈147 MiB/s a las 19:23:50. Es IO del sistema completo, no atribuible por sí solo al render.
- **Temperatura y frecuencia:** temperatura media del paquete ≈50 °C y pico 54,8 °C; frecuencia media ≈3,55 GHz y máximo 3,60 GHz. No se observa indicio de limitación térmica.

## Margen y proyecciones

- **Cerca de fallar:** el margen más ajustado fue RAM disponible (756 MB); aun así no llegó a cero. `/tmp` conservó ≈1,4 GB libres, y la swap no se agotó. El espacio de disco raíz tampoco estuvo cerca del límite.
- **Un video de 15 minutos:** probablemente viable en serie, con vigilancia. Extrapolando linealmente desde el pico de `/tmp` del formato más exigente (11:22), se ocuparían ≈2,7–2,9 GB y quedarían solo ≈0,7–0,9 GB. La RAM mínima observada aconseja no ejecutar otras cargas pesadas a la vez.
- **Un video de 30 minutos:** no es confiable con el flujo actual. La misma extrapolación da ≈4,7–5,8 GB temporales, por encima de los 3,6 GB disponibles; el render podría quedarse sin espacio en `/tmp` antes de terminar.
- **Dos renders simultáneos:** no recomendables en esta máquina. La suma de los picos observados por formato es ≈4,3 GB; incluso descontando una sola vez los ≈700 MB de ocupación preexistente sospechada, se queda prácticamente en el límite de tmpfs. Además, una sola captura ya dejó 756 MB de RAM disponible y ocupó hasta 92% de CPU.

## Recomendaciones, por impacto

1. Evitar que todos los JPEG temporales residan en tmpfs: usar almacenamiento temporal respaldado por disco o un flujo por lotes que permita liberar cuadros ya codificados.
2. Mantener concurrencia máxima de un render en esta máquina y encolar los siguientes.
3. Reducir o acotar la memoria de Chromium y vigilar RAM disponible, swap y tamaño real del directorio temporal durante la captura.
4. Si se necesita más velocidad, perfilar generación de cuadros y probar un preset de codificación más rápido con control de calidad; el cuello observado es CPU, no temperatura.
5. Medir por separado el espacio temporal atribuible al trabajo y registrar `lsof +L1 /tmp` mientras Chromium está activo para resolver la discrepancia de ≈700 MB.

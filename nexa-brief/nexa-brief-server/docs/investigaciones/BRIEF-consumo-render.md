# Tarea: estudio de consumo de recursos de una grabación completa (SOLO ESTUDIO)

PROHIBIDO hacer cambios: no edites código, ni configuración, ni archivos del proyecto, no instales nada, no
mates procesos, no lances renders. La ÚNICA escritura permitida es el informe final.

## Contexto
- Se grabó desde la app "programadores-nueva-era" (11:22 min, formatos 9x16 y 16x9, 30 fps) en esta máquina:
  i3-8100 4 núcleos, 7,1 GB RAM, swap 4 GB, /tmp es tmpfs de 3,6 GB (en RAM). render_promo.py guarda cada cuadro como JPEG
  en un TemporaryDirectory de /tmp y luego ffmpeg arma el MP4.
- Registro cada 10 s: /tmp/render-monitor.csv (columnas: ts, load1, cpu_idle, mem_avail_mb, swap_used_mb, tmp_used_mb,
  root_used_gb, chrome_rss_mb, ffmpeg_rss_mb, python_rss_mb, nproc_chrome; última línea "FIN hh:mm:ss").
- Netdata en http://127.0.0.1:19999 con historial: usa su API (/api/v1/charts, /api/v1/data?chart=system.cpu&after=...&before=...
  &points=..., system.ram, system.swap, system.io, system.load, disk_space._tmp, apps.* o app.* por proceso, cpu.cpufreq,
  sensors/temperatura si existen) para la ventana del registro.
- Datos ya observados: ~21 cuadros/s al inicio, ~86 KB por cuadro JPEG; en /tmp había ~700 MB ocupados que `du` no veía
  (¿archivos borrados aún abiertos por Chromium? compruébalo con `lsof +L1 /tmp` si está disponible, solo lectura).
- Prueba previa de 60 s: 207 s para ambos formatos, 1,3 GB RAM máx.
- Resultado del render: busca los MP4 en src/templates/nodetech/programadores-nueva-era/render/ y output/ y verifica con
  ffprobe duración (~682 s), 30 fps, audio, y número de cuadros (solo lectura).

## Entregable: docs/investigaciones/consumo-render-2026-10.md (español, conciso, con tablas)
1. Duración real de cada formato y velocidad (cuadros/s), resultado OK/fallo de los MP4.
2. CPU (media/pico, ¿cuello de botella?), RAM disponible mínima, swap, /tmp pico vs 3,6 GB, disco, IO, temperatura/frecuencia
   si hay datos. Fases: captura vs ffmpeg.
3. ¿Qué tan cerca estuvo de fallar? (margen de RAM y de /tmp). ¿Aguantaría un video de 15 o 30 min? ¿Y dos a la vez?
4. Recomendaciones ordenadas por impacto (sin implementarlas).

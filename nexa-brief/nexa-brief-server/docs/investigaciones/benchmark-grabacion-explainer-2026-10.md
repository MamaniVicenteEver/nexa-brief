# Benchmark: grabar un video del explainer en el servidor (2026-10-11)

Video: `nodetech/codex-ariane-501` (diseño PROTOTIPO/rough), **3:41** (221,5 s).
Se grabó con la misma API que usa la web: `POST /api/v1/explainer/videos/codex-ariane-501/record`
con `{"duration": "full", "publish": false}` (sin publicar).

Servidor `sever`: 4 núcleos, 14 GB de RAM, Ubuntu 26.04. Medición cada 5 s leyendo `/proc`
(`/tmp/bench/sampler.py`): 123 muestras durante la grabación y 46 de referencia en reposo.

## Resultado

| | |
|---|---|
| **Tiempo total** | **611 s = 10 min 11 s** |
| Relación | ~2,75 min de grabación por cada minuto de video (dos formatos) |
| Salida | `9x16` 1080×1920 (38 MB) y `16x9` 1920×1080 (32 MB), H.264 + AAC, 30 fps |
| Estado | `done`, registrado para programar (`scheduled_job_id` explainer-codex-ariane-501-3e2212e1) |

## Fases

| Fase | Desde–hasta | Duración | Qué trabaja |
|---|---|---|---|
| Captura 9:16 | 0–235 s | ~4 min | Chromium (4 pestañas): ~6.640 cuadros JPG a ~27 cuadros/s |
| Codificación 9:16 | 235–305 s | ~70 s | ffmpeg libx264 `-preset medium -crf 18` |
| Captura 16:9 | 305–540 s | ~4 min | Chromium |
| Codificación 16:9 | 540–611 s | ~70 s | ffmpeg |

## Recursos

| Métrica | Reposo | Promedio grabando | Pico |
|---|---|---|---|
| CPU total del sistema (100% = 4 núcleos) | 24% | **84%** | 97% |
| CPU Chromium (100% = 1 núcleo) | 0 | 160% (215% mientras captura) | 224% |
| CPU ffmpeg (100% = 1 núcleo) | 0 | 58% (~285% mientras codifica) | 291% |
| RAM usada en el sistema | 3,0 GB | **4,7 GB** | 5,1 GB |
| RAM Chromium | 0 | 1,5 GB | 2,3 GB |
| RAM ffmpeg | 0 | 0,3 GB | 1,5 GB |
| Load average (1 min) | 1,4 | 5,7 | 8,3 |
| Backend (uvicorn) | 0,1% | 0,2% | 0,8% |

El proyecto agrega **~1,7 GB de RAM** (pico +2,1 GB) y usa **~2,4 núcleos** de los 4.
El servidor nunca se quedó sin memoria y le quedaron ~9 GB libres.

## Observaciones

1. **El 24% de CPU en reposo no es del proyecto**: son hilos del kernel (`kworker …pm`,
   gestión de energía). Equivale a casi un núcleo perdido; vale la pena revisarlo aparte.
2. **Chromium no pasa de ~215%** aunque haya 4 workers: el cuello de botella es la captura de
   pantalla (screenshot + JPEG), no la CPU disponible. Subir `--workers` probablemente no ayuda.
3. **ffmpeg es la otra mitad del costo**: ~70 s por formato, con 3 núcleos. `-preset faster`
   o `veryfast` lo bajaría a la mitad o menos, con archivos algo más grandes.
4. **Los dos formatos van en serie.** Un video que solo necesite 9:16 tardaría la mitad (~5 min).
5. **El MP4 queda duplicado**: está en `src/templates/.../render/` y en `output/node_tech/...` (68 MB × 2).
6. Los cuadros temporales (JPG) se escriben en `/tmp` y se borran al terminar.

## Capacidad estimada (render en serie, uno a la vez)

| Largo del video | Tiempo de grabación (9:16 + 16:9) |
|---|---|
| 1 min | ~2,8 min |
| 3,5 min | ~10 min |
| 5 min | ~14 min |

Unos **6 videos de 3–4 min por hora**, o ~12 por hora si solo se graba 9:16.

## Problemas encontrados y corregidos

- **No estaba instalado el Chromium de Playwright** en el servidor, así que ninguna grabación podía
  funcionar. Playwright 1.60 no reconoce Ubuntu 26.04; se instaló con
  `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 .venv/bin/playwright install chromium`.
  Si se borra `~/.cache/ms-playwright` o se actualiza Playwright, hay que repetirlo.

---

## Optimizaciones aplicadas (2026-10-11, mismo día)

### 1. CPU perdido en reposo: hub USB en bucle

- **Causa:** el hub raíz USB 2.0 (`usb1`, xHCI, sin nada conectado) quedaba atascado en `suspending`:
  intentaba suspenderse, fallaba y despertaba sin parar (`hub_suspend` → `hub_resume` →
  `hub_activate` en las pilas de `kworker/u16:*-pm`). Gastaba hasta ~1 núcleo.
- **Arreglo:** regla `udev` `/etc/udev/rules.d/70-nexa-usb-root-hub-no-autosuspend.rules`
  (`ATTR{power/control}="on"` para los hubs raíz `1d6b`). Va en `70-` para correr después de
  `/usr/lib/udev/rules.d/60-autosuspend.rules`, que los pone en `auto`.
- **Resultado:** CPU en reposo de ~24% a **0,2%**.

### 2. ffmpeg `-preset veryfast` (antes `medium`)

Medido codificando 60 s de cuadros JPG reales (1080×1920, CRF 18):

| Preset | Tiempo | Tamaño | SSIM vs. cuadros |
|---|---|---|---|
| medium | 15,2 s | 13,7 MB | 0,9991 |
| faster | 13,0 s | 13,5 MB | 0,9989 |
| **veryfast** | **9,4 s** | **12,7 MB** | **0,9987** |
| superfast | 7,6 s | 22,9 MB | 0,9992 |

`veryfast`: −38% de tiempo, calidad indistinguible y archivo un poco más chico. `superfast` casi duplica
el peso. Queda como default en `render_promo.py` (`--preset`).

### 3. Workers de Chromium: sin cambio

| Workers | 20 s de video |
|---|---|
| 3 | 32,2 s |
| 4 | 30,6 s |
| 6 | 29,3 s |

Ganancia marginal (~5%): el límite es la captura de pantalla de cada pestaña. Se deja en 4.

### 4. Grabar solo los formatos elegidos

- API: `POST /explainer/videos/{id}/record` acepta `formats` (`["16x9"]` por defecto, `"9x16"` opcional).
  Publicar agrega el formato que exige cada red (TikTok → 9:16; YouTube/Facebook → 16:9).
- Web: en "Grabar y publicar", casillas **Desktop 16:9** (marcada) y **Móvil 9:16** (desmarcada).
- La Biblioteca registra solo los archivos grabados (`file_paths`/`ready_formats`).

### 5. "Generado en …" en la Biblioteca

Las grabaciones del explainer se registraban sin `generation_seconds`, y la tarjeta no mostraba el
tiempo. Ahora se guarda el tiempo real de grabación (`render_seconds`). Se completó a mano el de
Ariane (611 s, medido arriba).

### 6. Grabaciones simultáneas

Medido con 30 s de 9:16: 1 solo = 47 s; 2 a la vez = 79 s (en serie serían 95 s). Rinde solo ~16%
más y cada una tarda ~67% más. Queda configurable con `EXPLAINER_MAX_CONCURRENT_RECORDINGS`
(por defecto 1).

## Resultado final (mismo video, 3:41)

| | Antes | Después |
|---|---|---|
| Grabación por defecto | 9:16 + 16:9: **611 s (10:11)** | solo 16:9: **251 s (4:11)** |
| Codificación por formato | ~70 s | ~30 s |
| Los dos formatos (si se marcan) | 611 s | ~8 min (estimado) |
| CPU promedio del sistema grabando | 84% | 67% |
| CPU en reposo | 24% | 0,2% |

Por defecto, **−59% de tiempo**.

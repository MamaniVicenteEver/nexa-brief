# Nexa Brief — Análisis de Producción MVP

**Fecha:** 2026-07-01
**Tipo:** Análisis técnico — sin código
**Base:** Lectura completa de `src/` + restricciones reales del sistema

---

## 1. Dónde desplegar — Decisión de VPS

### Contexto técnico del sistema

Antes de elegir el servidor hay que entender qué consume el sistema durante una generación:

- **Playwright** abre un Chromium headless por cada job. Solo el navegador ocupa entre 500–800 MB de RAM.
- **FFmpeg** codifica en H.264 con `-preset fast`, usa ~80% de un core durante la fase de encoding.
- **`max_parallel_jobs=2`** en `settings.py` significa que en pico hay 2 browsers + 2 FFmpeg corriendo al mismo tiempo.
- **Python/FastAPI** base: ~200 MB adicionales.
- **Sistema operativo**: ~300 MB.
- **Total en pico con 2 jobs paralelos**: ~2.5–3.5 GB RAM + 2 cores ocupados en encoding.

### Comparativa de proveedores

| Proveedor | Plan | vCPU | RAM | Disco | Precio/mes | Veredicto |
|-----------|------|------|-----|-------|------------|-----------|
| Hetzner | CX22 | 2 | 4 GB | 40 GB SSD | €4.51 | Límite justo — puede funcionar con 1 job paralelo |
| **Hetzner** | **CX32** | **4** | **8 GB** | **80 GB SSD** | **€9.05** | **RECOMENDADO** |
| DigitalOcean | CPU-Opt 4vCPU | 4 | 8 GB | 160 GB | $48.00 | 5x más caro, mismas specs |
| AWS | t3.large | 2 | 8 GB | EBS aparte | ~$60.00 | No vale para este uso |
| Oracle Cloud | Always Free (ARM) | 4 | 24 GB | 200 GB | Gratis | Riesgo real — Oracle termina cuentas sin aviso |
| Contabo | VPS S | 4 | 8 GB | 200 GB | €5.99 | I/O lento, FFmpeg sufre, soporte malo |

### Por qué Hetzner CX32 y no CX22

El CX22 tiene 4 GB de RAM. Después del sistema operativo quedan ~3.5 GB disponibles. Con 2 jobs paralelos en pico, Playwright + FFmpeg consumirían 3+ GB. El margen es tan pequeño que cualquier variación (video más largo, imagen más grande) puede forzar swap a disco, lo que degrada la calidad del video grabado y extiende los tiempos de procesamiento.

El CX32 (8 GB) tiene margen cómodo para 2 jobs paralelos y deja espacio para crecer a 3 si en algún momento se quiere aumentar `max_parallel_jobs`.

Además, el encoding de video en el CX22 (2 vCPU) con 2 jobs paralelos deja al sistema sin CPU libre para el proceso base de FastAPI. El CX32 (4 vCPU) tiene 2 cores disponibles durante el encoding.

### Por qué no Oracle Free

Oracle termina instancias de la capa gratuita de forma unilateral cuando el consumo es bajo y/o la cuenta no tiene historial de pago. Un sistema personal que no consume GPU ni grandes transferencias de datos es candidato a terminación silenciosa. Perder el servidor sin aviso, con `accounts.json` (tokens de YouTube y Facebook) guardado ahí, no es aceptable para un sistema en producción.

### Decisión final

**Hetzner CX32 — Ashburn, Virginia (US East)** a €9.05/mes (~$10).

Ashburn es el datacenter US de Hetzner y tiene latencia baja hacia los servidores de la API de YouTube, que están en EEUU. Sistema operativo: Ubuntu 22.04 LTS.

---

## 2. ¿Vale la pena el 24/7?

### La distinción importante

El **servidor** sí debe correr 24/7 — es un costo fijo de €9/mes independientemente del uso. La pregunta real es con qué frecuencia debe **generar y subir videos**.

### El límite que manda: YouTube API Quota

| Concepto | Valor |
|---------|-------|
| Cuota diaria por Google Cloud Project | 10,000 unidades/día |
| Costo de `videos.insert` (subir 1 video) | 1,600 unidades |
| Máximo uploads/día por proyecto | **6 videos** |
| Costo de `playlistItems.insert` | 50 unidades |
| Consulta de estado de procesamiento | 1 unidad/consulta |
| Cuota usada con 2 canales × 1 video/día | **3,200 unidades (32% del límite)** |

### Problema del proyecto compartido

Actualmente ambos canales (canal_1 y el futuro canal_2) comparten el mismo **Google Cloud Project** y por tanto la misma cuota. Mientras el total de uploads/día no supere 6, no hay problema. Si en el futuro se quiere escalar a más canales, la solución es crear un Google Cloud Project separado por canal — cada proyecto tiene su propia cuota de 10,000.

### ¿Qué ritmo tiene sentido para canales nuevos?

El algoritmo de YouTube para canales de música ambient favorece **consistencia sobre volumen**. Un video al día a la misma hora genera más retención que tres videos erráticos. Para canales en etapa inicial (0–500 suscriptores), 1 video/día/canal es el ritmo óptimo.

### Horario recomendado

| Hora (UTC-5 / Eastern) | Canal 1 — @DrovaSoft | Canal 2 — pendiente |
|------------------------|---------------------|---------------------|
| 09:00 | Generar + subir video ambient | — |
| 15:00 | — | Generar + subir video (nicho 2) |

Dos uploads al día, uno por canal, separados 6 horas. El sistema tarda ~8–15 minutos en generar un video de 5 minutos (1 minuto de grabación Playwright + encoding FFmpeg + upload). No hay solapamiento.

### Respuesta directa: ¿24/7?

**Servidor: sí, 24/7.** Es un proceso fijo a €9/mes.

**Generación: no continua.** Dos disparos al día por cron. Generar continuamente sin subir no tiene sentido. Generar más de 1 video/canal/día en un canal nuevo tampoco tiene sentido para el algoritmo de YouTube.

El sistema funciona como: cron dispara → genera 1 video → sube → limpia archivos → duerme hasta el próximo disparo.

---

## 3. Problema real de duración — decisión pendiente

El sistema actual genera videos de **60–300 segundos** (1–5 minutos). Los canales de ambient music exitosos en YouTube publican videos de **1–3 horas**.

Un video de 5 minutos en YouTube tiene retención prácticamente nula para la audiencia de "música para estudiar". La gente busca sesiones largas de trabajo/estudio, no clips cortos.

### Las dos opciones para el MVP

**Opción A — YouTube Shorts (60 segundos)**

El archivo `tiktok_video.mp4` ya existe en el output del sistema: es un clip vertical 9:16 de 61 segundos con fade in/out. Subido como Short con `#Shorts` en el título, puede funcionar para construir suscriptores iniciales. Los Shorts tienen distribución diferente al feed principal — pueden viralizarse más rápido.

La restricción: el sistema ya genera este archivo sin cambios. Es el path de menor resistencia para el MVP.

**Opción B — Videos largos (30–180 minutos)**

Para monetización real con ambient music, el objetivo a mediano plazo son videos de 1 hora mínimo. Esto requiere cambiar `video_max_duration_seconds` en `settings.py` (actualmente 300 = 5 minutos) y asegurarse de que:

1. El servidor tiene suficiente disco para el archivo durante la generación (un video de 60 minutos en H.264 a 1920×1080 pesa ~3–6 GB sin comprimir en el raw webm).
2. FFmpeg tiene tiempo suficiente para el encoding (60 minutos de video tarda ~20–40 minutos de encoding en el CX32).
3. La cuota de upload de YouTube soporta archivos grandes (sí, no hay límite de tamaño en la API, solo de duración — y los canales verificados no tienen límite de duración).

**Decisión para el MVP:** empezar con Opción A (Shorts, 60 segundos) para validar el pipeline completo en producción real. Migrar a Opción B cuando los canales tengan al menos 50–100 suscriptores y el pipeline sea estable.

---

## 4. Imágenes en blanco y negro

### Estado actual de los adaptadores

El sistema usa tres fuentes de imágenes en cascada: Unsplash → Pexels → Pixabay (con CSS fallback). Las dos principales soportan filtro de color nativo.

**Unsplash:** el endpoint de búsqueda acepta el parámetro `color=black_and_white`. Devuelve fotos catalogadas específicamente como B&W. El adaptador está en `src/adapters/image/infrastructure/unsplash_adapter.py`.

**Pexels:** acepta `color=b_and_w` en la búsqueda. El adaptador está en `src/adapters/image/infrastructure/pexels_adapter.py`.

**Pixabay:** no tiene filtro de color B&W nativo. Se puede combinar con `editors_choice=true` para calidad más alta y filtrar por CSS.

### Opción inmediata sin código — CSS filter en el profile skill

El skill del perfil (`src/skills/profiles/ambient.md`, que se creará en la Fase 1) instruye al DeepSeek a aplicar `filter: grayscale(100%) contrast(1.1)` al elemento de fondo. La imagen puede ser de cualquier color — el HTML la convierte a B&W en tiempo de renderizado. Playwright graba el resultado con el filtro aplicado.

Esta opción funciona **hoy** sin modificar ningún adaptador. Es la instrucción correcta para incluir en el profile skill del canal ambient.

### Opción de mayor calidad — parámetros en la API

Agregar `color=black_and_white` al request de Unsplash y `color=b_and_w` al de Pexels cuando el perfil activo sea B&W. Esto requiere que el `resource_fetcher.py` lea el perfil y pase el parámetro al adaptador de imagen.

Son dos líneas de cambio por adaptador, pero requiere primero implementar el sistema de perfiles (Fase 1 de la estrategia v3).

### Recomendación

Empezar con el CSS filter en el profile skill (cero código). Agregar los parámetros de API cuando se implementen los perfiles, para tener stock B&W real además del filtro.

---

## 5. Música con ritmo para estudiar

### Estado actual

Los adaptadores de música usan este orden: Pixabay → Jamendo → YtDlp. El mapeo de géneros está hardcodeado en `src/adapters/music/infrastructure/jamendo_adapter.py` en el diccionario `_GENRE_MAP`.

### Géneros disponibles en Jamendo ahora mismo

Jamendo usa tags libres. Los siguientes tienen resultados de calidad y son buscables hoy:

| Tag en Jamendo | Tipo de música | Uso |
|----------------|----------------|-----|
| `chillhop` | Lo-fi beats con ritmo | Estudio con ritmo moderado |
| `lofi` | Lo-fi hip hop | Estudio tranquilo |
| `electronic` | Electrónico general | Ritmo, variedad |
| `hiphop` | Hip-hop instrumental | Más agresivo |
| `darkambient` | Ambiente oscuro | Atmosférico con tensión |
| `drums` | Percusivo | Energético |
| `synthwave` | Electrónico retro | Ritmo estructurado |

### Géneros disponibles en Pixabay ahora mismo

Pixabay Music tiene categorías propias. Las relevantes:

| Categoría Pixabay | Descripción |
|-------------------|-------------|
| `study` | Música específicamente etiquetada para estudio |
| `focus` | Concentración, ambient con ritmo |
| `hip-hop` | Beats instrumentales |
| `electronic` | Electronic general |

La categoría `study` en Pixabay es exactamente lo que se busca. Solo hay que crear una categoría en el sistema con ese nombre y agregar el mapeo.

### Qué hacer en concreto

1. Agregar al `_GENRE_MAP` en `jamendo_adapter.py`: `"study_beats": "chillhop"`, `"dark_ambient": "darkambient"`, `"chillhop": "chillhop"`.
2. Crear archivos de categoría con esos nombres en `src/categories/` (o donde el sistema los busque).
3. Crear genre skills en `src/skills/genres/study_beats.md`, `src/skills/genres/dark_ambient.md` con la dirección visual correcta.

Son cambios de configuración, no de arquitectura.

---

## 6. Arquitectura de operación autónoma

### Estado actual

El sistema requiere un `POST /api/v1/videos` manual para disparar una generación. No hay ningún mecanismo de scheduling para generación — el APScheduler que ya existe en `src/presentation/main.py` solo se usa para auto-refresh de tokens de OAuth.

### Dos opciones para automatizar

**Opción 1 — Cron del sistema operativo**

Un crontab en el VPS llama al endpoint de la API a las horas configuradas. Cero código nuevo. El servidor FastAPI ya está corriendo y puede recibir la petición HTTP.

```
# crontab -e en el VPS
# Canal 1 — 9:00 AM Eastern todos los días
0 9 * * * curl -s -X POST http://localhost:8000/api/v1/videos \
  -H "Content-Type: application/json" \
  -d '{"category_name":"ambient","profile_name":"ambient",
       "duration_seconds":60,"publishing":{"enabled":true,
       "accounts":["youtube:canal_1"]}}' >> /var/log/nexa.log 2>&1

# Canal 2 — 3:00 PM Eastern todos los días
0 15 * * * curl -s -X POST http://localhost:8000/api/v1/videos \
  -H "Content-Type: application/json" \
  -d '{"category_name":"study_beats","profile_name":"canal2",
       "duration_seconds":60,"publishing":{"enabled":true,
       "accounts":["youtube:canal_2"]}}' >> /var/log/nexa.log 2>&1
```

**Opción 2 — APScheduler integrado en la app**

APScheduler ya es una dependencia del proyecto (se usa para token refresh). Agregar un job de generación al scheduler existente en `main.py` es natural y centraliza la configuración en `.env`. La ventaja sobre el cron es que el job tiene acceso directo al `Orchestrator` sin pasar por HTTP y puede manejar reintentos de forma más elegante.

**Recomendación para el MVP:** empezar con Opción 1 (cron del sistema). Funcional en 5 minutos, no requiere código. Migrar a Opción 2 cuando el MVP esté validado y se quiera una configuración más centralizada.

### Limpieza automática de disco

Cada video generado ocupa ~150–400 MB en disco (MP4 YouTube + TikTok + imagen + audio + HTML). Con 2 videos/día sin limpiar, en 30 días son ~18–24 GB — casi la mitad del disco del CX32 (80 GB).

El flujo correcto: después de cada upload exitoso, eliminar el directorio del job. La confirmación de que el upload fue exitoso está en el `post_id` dentro del `09_publicacion_resultado.json` que escribe `social_publisher.py`. Si el archivo contiene un `post_id` válido, el video está en YouTube y el directorio local puede eliminarse.

Los logs (`logs/` dentro del job dir) pesan kilobytes. Se pueden conservar indefinidamente.

```
# Limpiar directorios de jobs con upload exitoso (mayores de 1 hora)
0 * * * * find /ruta/output -name "09_publicacion_resultado.json" \
  -not -empty | xargs -I{} dirname {} | xargs -I{} \
  sh -c 'if grep -q "post_id" {}; then rm -rf {}; fi'
```

---

## 7. Checklist real del MVP

### Ya funciona

- [x] YouTube OAuth configurado — canal @DrovaSoft (`canal_1`), tokens en `accounts.json`
- [x] Facebook OAuth configurado — Nexa-Brief (ID: 1229276370261937), token permanente
- [x] Pipeline completo 9 stages funcional
- [x] Auto-refresh de tokens OAuth (APScheduler en `main.py`)
- [x] `PublisherFacade` soporta múltiples cuentas por job
- [x] `JobPublishingConfig.accounts` soporta selección por cuenta

### Pendiente / problema conocido

- [!] TikTok en modo desarrollo — `SELF_ONLY`, pendiente aprobación de la app en el portal de TikTok

### Falta para MVP en producción

- [ ] Provisionar Hetzner CX32 — Ubuntu 22.04 LTS, Ashburn US
- [ ] Instalar en VPS: Python 3.10+, uv, FFmpeg, Playwright con Chromium (`playwright install chromium`)
- [ ] Clonar repo en VPS, configurar `.env` con todas las API keys
- [ ] Copiar `accounts.json` al VPS (tokens de YouTube y Facebook ya son válidos)
- [ ] Test end-to-end: 1 video generado y subido a YouTube desde el VPS
- [ ] Configurar systemd service para auto-restart del servidor FastAPI
- [ ] Configurar crontab para 2 uploads/día (1 por canal)
- [ ] Configurar script de limpieza de disco post-upload
- [ ] Crear segundo canal YouTube y hacer OAuth para `canal_2`
- [ ] Crear profile skill para el canal 2 con su estética y categoría de contenido
- [ ] Decidir y confirmar: ¿Shorts (60s) o videos más largos?

---

## 8. Orden de ejecución por semanas

### Semana 1 — Provisionar y test local en el VPS

1. Crear cuenta en Hetzner Cloud, provisionar CX32 Ashburn Ubuntu 22.04.
2. Instalar dependencias del sistema: `apt install ffmpeg`, Python 3.10+, uv, Playwright Chromium.
3. Clonar el repositorio, configurar `.env` con todas las API keys.
4. Copiar `accounts.json` (con tokens válidos de YouTube y Facebook).
5. Generar 1 video completo end-to-end con publishing desactivado. Objetivo: confirmar que Playwright y FFmpeg funcionan en el entorno remoto.

### Semana 1–2 — Primer upload real desde el VPS

1. Activar `ENABLE_AUTO_PUBLISHING=true` en `.env`.
2. Ejecutar 1 job manual con `ACTIVE_ACCOUNT=youtube:canal_1`.
3. Confirmar que el video aparece en el canal @DrovaSoft.
4. Configurar systemd service para que la app arranque automáticamente y se reinicie si cae.

### Semana 2 — Automatización completa

1. Configurar crontab con los 2 disparos diarios.
2. Agregar script de limpieza de disco.
3. Monitorear logs durante 3–5 días para detectar fallos: cuota agotada, tokens expirados, FFmpeg crash, Playwright timeout.
4. Ajustar `video_max_duration_seconds` si se decide cambiar de Shorts a videos más largos.

### Semana 3 — Canal 2 activado

1. Crear el segundo canal en YouTube con otra cuenta Google o en la misma.
2. Ejecutar OAuth para `canal_2` (mismo flujo que `canal_1`, usando `?alias=canal_2`).
3. Crear el profile skill del canal 2 con su estética, categoría de contenido, y playlist.
4. Activar el segundo cron job.

### Mes 2 — Ajuste de calidad

1. Revisar los primeros 30 videos publicados en ambos canales. Analizar retención y clics.
2. Ajustar genre skills para imágenes B&W, música más rítmica, timing de animaciones en el HTML.
3. Implementar el sistema de perfiles (Fase 1 de estrategia v3) si la diferenciación visual entre canales es necesaria.
4. Evaluar si la duración de 60 segundos (Shorts) está generando crecimiento o si vale la pena hacer el salto a videos de 5–30 minutos.

---

## 9. Costos operativos estimados

| Concepto | Costo/mes | Notas |
|---------|-----------|-------|
| Hetzner CX32 | €9.05 | Servidor 24/7, fijo |
| Gemini Flash Lite API | ~$1–3 | 2 videos/día × 3 llamadas = ~180 calls/mes. Precio: $0.075/1M tokens |
| DeepSeek API | ~$1–2 | 1 llamada por video, ~60 videos/mes |
| Pexels / Unsplash / Pixabay | $0 | Tier gratuito cubre ampliamente 2 videos/día |
| Jamendo / Pixabay Music | $0 | Tier gratuito |
| YouTube Data API | $0 | Cuota gratuita de 10,000 unidades/día |
| Facebook Graph API | $0 | Gratuito |
| **Total** | **~$12–15/mes** | Sistema completo 24/7, 2 canales, ~60 videos/mes |

---

## 10. Riesgos y cómo mitigarlos

### Riesgo 1 — Cuota de YouTube agotada

**Causa:** más de 6 uploads/día en el mismo Google Cloud Project.
**Mitigación:** el pipeline ya registra el resultado de cada upload en `09_publicacion_resultado.json`. Si el upload falla con error de cuota, el job queda en `FAILED` y el log lo registra. No hay uploads silenciosos fallidos.
**Solución a largo plazo:** crear un Google Cloud Project separado por canal cuando se escale a más de 2 canales.

### Riesgo 2 — Token de YouTube expirado

**Estado actual:** el TokenManager hace auto-refresh 30 minutos antes del vencimiento (APScheduler en `main.py`). El refresh token de Google no expira a menos que el usuario revoque el acceso.
**Mitigación adicional:** el endpoint `GET /api/v1/publisher/status` permite verificar el estado de los tokens en cualquier momento.

### Riesgo 3 — Playwright falla en el VPS (headless no funciona)

**Causa probable:** falta de dependencias de sistema para Chromium en Ubuntu (libatk, libcups, etc.).
**Solución:** `playwright install-deps chromium` instala todas las dependencias de sistema necesarias. Es parte del setup inicial del VPS.

### Riesgo 4 — Disco lleno

**Causa:** acumulación de videos generados sin limpiar.
**Solución:** script de limpieza post-upload (descrito en sección 6). Monitorear con `df -h` en el cron.

### Riesgo 5 — El contenido generado viola políticas de YouTube

**Contexto:** videos ambient con música e imágenes son el contenido más seguro posible para YouTube. No hay voces, no hay texto problemático, no hay copyrights de música (Jamendo y Pixabay son Creative Commons / royalty-free).
**Único riesgo real:** si la música descargada de Pixabay o Jamendo tiene algún conflicto de derechos no declarado. Riesgo bajo pero existe. El campo `provider` en `MusicFetchResult` registra la fuente de cada track para auditarlo.

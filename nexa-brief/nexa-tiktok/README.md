# nexa-tiktok

Servicio local para gestionar sesiones y publicaciones de TikTok Studio mediante un navegador persistente. Nexa Brief lo consume mediante el adaptador `tiktok_service` y muestra las cuentas con `mode: service` en Canales.

## Instalación

Requiere Python 3.12, `uv`, Xvfb y sus dependencias de sistema. Desde este directorio:

```sh
uv sync --python 3.12
uv run playwright install chromium
cp .env.example .env
```

`uv.lock` fija Playwright 1.64.1 y Chromium 1248; no actualices Playwright ni reinstales navegadores con otra versión mientras existan perfiles. Los perfiles guardan ambas versiones y el servicio rechaza perfiles con versiones distintas. Genera una clave Fernet con `uv run python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'` y configúrala como `NEXA_TIKTOK_ENCRYPTION_KEY` en `.env`. Configura también `NEXA_TIKTOK_KEY`; solo `APP_ENV=development` permite no tener clave, con aviso. Para el desarrollo integrado, configura las variables indicadas en `nexa-tiktok/.env.example` y en el `.env` raíz; `make dev` inicia el servicio junto con la API y la web. No expongas el servicio a Internet.

Para vincular la cuenta, inicia `make dev`, abre `/canales` en la web y usa la opción de conexión de TikTok por QR. Escanea el QR con la aplicación de TikTok del móvil y confirma allí el acceso. No cierres sesión en TikTok durante ni después de la vinculación: el servicio utiliza esa sesión persistente.

## API

Todas las rutas salvo `/health` requieren `X-Nexa-Tiktok-Key` si está configurada. Los errores usan `{"error":{"code":"...","message":"..."}}`.

- `GET /health`
- `GET /v1/accounts`, `GET`, `PATCH` y `DELETE /v1/accounts/{alias}`, `POST /v1/accounts/{alias}/check`.
- `POST /v1/sessions/qr` con `{"alias":"cuenta"}`; consultar `GET /v1/sessions/{id}` y cancelar con `POST /v1/sessions/{id}/cancel`.
- `POST /v1/sessions/import` con `alias`, `cookies` de Nexa Connect y `expected_username`; máximo 256 KB y se exige `sessionid` de TikTok.
- `POST /v1/accounts/{alias}/videos`: JSON con `video_path`, `caption`, `privacy`, `idempotency_key` y `first_comment` opcional; también acepta multipart con `file`. Responde 202 y un job.
- `GET /v1/accounts/{alias}/videos` y `?refresh=1` para leer Studio; `GET` o `DELETE /v1/accounts/{alias}/videos/{id}`. La eliminación responde con un job.
- `POST /v1/accounts/{alias}/videos/{id}/comments` con `text` e `idempotency_key`; responde con un job.
- `GET /v1/jobs/{id}` devuelve estado, pasos, resultado y error. `needs_review` requiere revisar Studio; nunca se reintenta automáticamente después del clic.

El proceso utiliza un único navegador headful, Xvfb propio y locks; los perfiles y datos viven en `data/` con permisos restrictivos. El backup de sesión `state.enc` usa Fernet; perder la clave impide recuperarlo. Los perfiles Chromium contienen datos sensibles aunque no sean el backup cifrado: protegé el directorio y no lo compartas. Los selectores y el formato JSON de Studio pueden cambiar. No hay resolución automática de captcha.

`NEXA_TIKTOK_JOB_TIMEOUT` limita cada operación a 1200 segundos por defecto. Un error o timeout posterior al clic queda en `needs_review`, incluso si TikTok muestra una verificación: no se puede asumir que no hubo publicación. Una coincidencia de descripción con un video anterior no confirma una publicación nueva; se exige el ID de la respuesta de publicación.

La cola de Nexa reutiliza la clave de idempotencia de cada entrada de TikTok. Quien llama directamente al adaptador debe conservar y reutilizar su propia `idempotency_key` ante respuestas perdidas. Las rutas del puente para gestionar QR requieren el token interno que envía el proxy web; la importación de la extensión conserva su firma de un solo uso.

## Pruebas

```sh
uv run pytest -q
uv run ruff check .
```

### Respaldo completo

Detén nexa-tiktok y ejecuta `scripts/backup.sh /ruta/de/respaldo` para crear un archivo tar.gz con permisos 600. El script rechaza un servicio activo y mantiene su lock hasta terminar para obtener un perfil coherente. `NEXA_TIKTOK_DATA_DIR` permite seleccionar el directorio de datos; las cachés de Chromium se excluyen y el destino debe estar fuera de él. El archivo incluye sesiones y perfiles sensibles: guárdalo en un lugar privado y respalda también la clave de cifrado por separado. El tar no está cifrado; los permisos 600 protegen el acceso local. Para recuperar, usa `scripts/restore.sh archivo.tar.gz /directorio/vacío`; la extracción aplica permisos 700 a directorios y 600 a archivos. Detén el servicio antes de sustituir datos activos y conserva los datos anteriores hasta verificar la recuperación.

`POST /v1/backups/restore` es solo para recuperación: rechaza con 409 cualquier archivo actual legible para evitar reemplazar datos buenos por versiones antiguas. Los trabajos recuperados quedan en `needs_review`. Los archivos JSON se respaldan antes de cada modificación; la primera versión todavía no tiene copia anterior. Un respaldo completo incluye el estado actual.

Al extraer un respaldo completo, `restore.sh` convierte también los trabajos `queued`, `running` y `clicked` en `needs_review`: una operación pendiente en una copia antigua podría haberse ejecutado después de tomarla. Revisa TikTok Studio antes de crear otro intento. Conservar las claves de idempotencia requiere retener el historial completo de trabajos; un respaldo antiguo no contiene los trabajos creados después de él.

No hay una barrera automática que impida reintentar trabajos ausentes del respaldo. Antes de reanudar publicaciones tras una restauración antigua, concilia manualmente todas las operaciones posteriores a la fecha de la copia con TikTok Studio y con los registros del puente. El archivo del servicio no incluye las cuentas, el historial ni la cola del puente, ni la clave de cifrado externa; respalda y recupera esos elementos por separado. No se garantiza recuperación sin pérdida con una copia incompleta.
